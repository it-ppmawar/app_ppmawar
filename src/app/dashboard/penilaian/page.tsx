'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import QuizBModal from './QuizBModal';
import RaportTabSection, { RaportCatatanForm } from '@/components/penilaian/RaportTabSection';
import { calcNilaiAkhir, calcPredikat, calcPredikatFromInput } from '@/lib/penilaian/calcNilai';
import { getTahunAjaranOptions } from '@/lib/penilaian/semesterPeriode';
import {
  Award, BookOpen, GraduationCap, ClipboardCheck, Search, Filter,
  Save, CheckCircle, AlertCircle, RefreshCw,
  ShieldCheck, ChevronRight, ChevronDown, Sparkles,
  Edit3, ArrowUpDown, ArrowUp, ArrowDown, X, Trash2
} from 'lucide-react';

// ====== Avatar Lokal & URL Foto Santri (Persis Halaman Data Murid) ======
const AVATAR_COLORS = [
  '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#ea580c',
  '#0891b2', '#65a30d', '#7c3aed', '#db2777', '#059669',
];

const getInitials = (nama: string): string => {
  if (!nama) return '?';
  const parts = nama.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return nama.substring(0, 2).toUpperCase();
};

const getAvatarColor = (nama: string): string => {
  if (!nama) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < nama.length; i++) {
    hash = nama.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getFotoUrl = (fotoName: string | null) => {
  if (!fotoName || fotoName === '-') return '';
  if (fotoName.startsWith('http://') || fotoName.startsWith('https://')) {
    return fotoName;
  }
  if (fotoName.startsWith('foto_') || fotoName.startsWith('upload_') || fotoName.startsWith('profil_')) {
    return `/uploads/${fotoName}`;
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_MITRA_FOTO_URL || 'https://mawar.smartpesantren.id/sekretariat/berkas/';
  const cleanFotoName = fotoName.startsWith('/') ? fotoName.substring(1) : fotoName;
  if (cleanFotoName.includes('sekretariat/berkas')) {
    return `https://mawar.smartpesantren.id/${cleanFotoName}`;
  }
  return `${baseUrl}${cleanFotoName}`;
};

export default function PenilaianRaportPage() {
  const [activeTab, setActiveTab] = useState<'input' | 'raport'>('input');
  const [showPetunjuk, setShowPetunjuk] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  
  // Data Master
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [kurikulumList, setKurikulumList] = useState<any[]>([]);
  
  // Filter Input Nilai
  const [selectedKelas, setSelectedKelas] = useState<string>('');
  const [selectedMapel, setSelectedMapel] = useState<string>('');
  const [selectedKitab, setSelectedKitab] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [tahunAjaran, setTahunAjaran] = useState<string>('2025/2026');
  const [isCustomMapel, setIsCustomMapel] = useState(false);
  const customMapelInputRef = useRef<HTMLInputElement>(null);
  const isLegerMode = !selectedMapel || selectedMapel === 'SEMUA' || selectedMapel === 'Semua Mapel';
  const isSemuaKelasMode = !selectedKelas || selectedKelas === 'SEMUA' || selectedKelas === 'all';

  // State Loading Progress Bar (animasi seperti billing)
  const [loadProgress, setLoadProgress] = useState(0);

  // Role Pengguna & Mode Tamu
  const [userRole, setUserRole] = useState<string>('guru');
  const isTamu = userRole === 'tamu';
  const isWaliOrSantri = userRole === 'wali_murid' || userRole === 'wali_alumni' || userRole === 'santri';

  // State Tabel Input Nilai
  const [muridList, setMuridList] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<number, { harian: string; lisan: string; uts: string; uas: string; akhir: string; predikat: string; catatan: string }>>({});
  const [loadingMurid, setLoadingMurid] = useState(false);
  const [savingScores, setSavingScores] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Fitur Pencarian Universal & Pengurutan Kolom (Sorting berpola Rekapitulasi)
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal Integrasi QuizB
  const [showQuizBModal, setShowQuizBModal] = useState(false);

  // Trigger Reload Data Nilai
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const refreshScores = () => setReloadTrigger(prev => prev + 1);

  // Modal Edit & Hapus Nilai Santri (untuk mengelola atau menghapus hasil uji coba / evaluasi)
  const [editModalSantri, setEditModalSantri] = useState<any>(null);
  const [editModalScores, setEditModalScores] = useState<any[]>([]);
  const [loadingEditModal, setLoadingEditModal] = useState(false);
  const [savingEditModal, setSavingEditModal] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleOpenEditModal = async (santri: any) => {
    setEditModalSantri(santri);
    setLoadingEditModal(true);
    setModalFeedback(null);
    try {
      const res = await fetch(`/api/penilaian/raport?murid_id=${santri.murid_id}&semester=${semester}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}&t=${Date.now()}`);
      const data = await res.json();
      const nilaiArr = Array.isArray(data?.data?.nilai) ? data.data.nilai : (Array.isArray(data?.nilai) ? data.nilai : null);
      if (data.success && nilaiArr) {
        setEditModalScores(nilaiArr);
      } else {
        setEditModalScores([]);
      }
    } catch (err) {
      console.error('Error fetching student scores for edit modal:', err);
      setEditModalScores([]);
    } finally {
      setLoadingEditModal(false);
    }
  };

  const handleQuickResetScore = async (santri: any) => {
    const targetDesc = !isLegerMode && selectedMapel ? `mata pelajaran "${selectedMapel}"` : 'seluruh mata pelajaran';
    if (!window.confirm(`Hapus/reset nilai percobaan untuk santri "${santri.nama}" pada ${targetDesc}?`)) {
      return;
    }

    try {
      setSavingScores(true);
      const url = `/api/penilaian/save?murid_id=${santri.murid_id}&semester=${semester}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}${!isLegerMode && selectedMapel ? `&mapel=${encodeURIComponent(selectedMapel)}` : ''}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg(`Nilai percobaan santri "${santri.nama}" berhasil dihapus.`);
        setTimeout(() => setSaveSuccessMsg(''), 4000);
        refreshScores();
      } else {
        alert(data.error || 'Gagal menghapus nilai santri');
      }
    } catch (err: any) {
      alert(`Terjadi kesalahan: ${err.message}`);
    } finally {
      setSavingScores(false);
    }
  };

  const handleDeleteMapelScoreInModal = async (scoreItem: any) => {
    if (!editModalSantri) return;
    if (!window.confirm(`Hapus nilai mata pelajaran "${scoreItem.mata_pelajaran}" untuk ${editModalSantri.nama}?`)) return;

    try {
      setSavingEditModal(true);
      const url = `/api/penilaian/save?id=${scoreItem.id}&murid_id=${editModalSantri.murid_id}&mapel=${encodeURIComponent(scoreItem.mata_pelajaran)}&semester=${semester}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setEditModalScores(prev => prev.filter(item => item.id !== scoreItem.id));
        setModalFeedback({ type: 'success', message: `Nilai ${scoreItem.mata_pelajaran} berhasil dihapus.` });
        refreshScores();
      } else {
        setModalFeedback({ type: 'error', message: data.error || 'Gagal menghapus nilai mapel' });
      }
    } catch (err: any) {
      setModalFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingEditModal(false);
    }
  };

  const handleDeleteAllScoresInModal = async () => {
    if (!editModalSantri) return;
    if (!window.confirm(`PERINGATAN: Anda akan menghapus SELURUH nilai percobaan santri "${editModalSantri.nama}" pada Semester ${semester} (${tahunAjaran}) ini. Lanjutkan?`)) return;

    try {
      setSavingEditModal(true);
      const url = `/api/penilaian/save?murid_id=${editModalSantri.murid_id}&semester=${semester}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setEditModalScores([]);
        setModalFeedback({ type: 'success', message: 'Seluruh nilai percobaan santri ini berhasil dibersihkan.' });
        refreshScores();
        setTimeout(() => {
          setEditModalSantri(null);
        }, 1200);
      } else {
        setModalFeedback({ type: 'error', message: data.error || 'Gagal menghapus nilai' });
      }
    } catch (err: any) {
      setModalFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingEditModal(false);
    }
  };

  const handleUpdateScoreInModal = async (scoreItem: any) => {
    if (!editModalSantri) return;
    try {
      setSavingEditModal(true);
      const harian = scoreItem.nilai_harian !== null && scoreItem.nilai_harian !== '' ? Number(scoreItem.nilai_harian) : null;
      const lisan = scoreItem.nilai_lisan !== null && scoreItem.nilai_lisan !== undefined && scoreItem.nilai_lisan !== '' ? Number(scoreItem.nilai_lisan) : null;
      const uts = scoreItem.nilai_uts !== null && scoreItem.nilai_uts !== '' ? Number(scoreItem.nilai_uts) : null;
      const uas = scoreItem.nilai_uas !== null && scoreItem.nilai_uas !== '' ? Number(scoreItem.nilai_uas) : null;
      const akhir = scoreItem.nilai_akhir !== null && scoreItem.nilai_akhir !== '' ? Number(scoreItem.nilai_akhir) : null;

      const payload = {
        kelas_id: editModalSantri.kelas_madin_id || selectedKelas || 'SEMUA',
        mata_pelajaran: scoreItem.mata_pelajaran,
        semester,
        tahun_ajaran: tahunAjaran,
        scores: [
          {
            murid_id: editModalSantri.murid_id,
            kelas_madin_id: editModalSantri.kelas_madin_id,
            nilai_harian: harian,
            nilai_lisan: lisan,
            nilai_uts: uts,
            nilai_uas: uas,
            nilai_akhir: akhir,
            predikat: scoreItem.predikat,
            catatan: scoreItem.catatan,
          }
        ]
      };

      const res = await fetch('/api/penilaian/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setModalFeedback({ type: 'success', message: `Nilai ${scoreItem.mata_pelajaran} berhasil disimpan.` });
        refreshScores();
      } else {
        setModalFeedback({ type: 'error', message: data.error || 'Gagal menyimpan nilai' });
      }
    } catch (err: any) {
      setModalFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingEditModal(false);
    }
  };

  const handleApplyQuizBScores = (appliedList: Array<{ murid_id: number; skor: number; targetField: 'harian' | 'lisan' | 'uts' | 'uas'; quizTitle: string }>) => {
    setScores(prev => {
      const next = { ...prev };
      appliedList.forEach(item => {
        const existing = next[item.murid_id] || { harian: '', lisan: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
        const valStr = String(item.skor);
        const updated = { ...existing };

        if (item.targetField === 'harian') updated.harian = valStr;
        else if (item.targetField === 'lisan') updated.lisan = valStr;
        else if (item.targetField === 'uts') updated.uts = valStr;
        else if (item.targetField === 'uas') updated.uas = valStr;

        const autoFinal = calcNilaiAkhir({
          harian: updated.harian,
          lisan: updated.lisan,
          uts: updated.uts,
          uas: updated.uas,
        });
        if (autoFinal !== null) {
          updated.akhir = String(autoFinal);
          updated.predikat = autoFinal === 0 ? 'E' : calcPredikat(autoFinal);
        }

        const note = `QuizB: ${item.quizTitle} (${item.skor})`;
        updated.catatan = updated.catatan ? `${updated.catatan}; ${note}` : note;

        next[item.murid_id] = updated;
      });
      return next;
    });
  };

  const updateEditModalComponent = (sIdx: number, field: 'nilai_harian' | 'nilai_lisan' | 'nilai_uts' | 'nilai_uas', val: string) => {
    setEditModalScores(prev => prev.map((item, idx) => {
      if (idx !== sIdx) return item;
      const nextItem = { ...item, [field]: val };
      const autoFinal = calcNilaiAkhir({
        harian: nextItem.nilai_harian,
        lisan: nextItem.nilai_lisan,
        uts: nextItem.nilai_uts,
        uas: nextItem.nilai_uas,
      });
      return {
        ...nextItem,
        nilai_akhir: autoFinal !== null ? autoFinal : '',
        predikat: autoFinal !== null ? (autoFinal === 0 ? 'E' : calcPredikat(autoFinal)) : '-',
      };
    }));
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(['harian', 'lisan', 'uts', 'uas', 'akhir', 'kehadiran'].includes(field) ? 'desc' : 'asc');
    }
  };

  // 1. Pengurutan Data Santri secara Global (Pola Handal Rekapitulasi)
  const sortedMurid = useMemo(() => {
    const list = [...muridList];
    if (sortField === 'no') {
      return sortOrder === 'asc' ? list : [...list].reverse();
    }

    return list.sort((a, b) => {
      const curA = scores[a.murid_id] || {};
      const curB = scores[b.murid_id] || {};
      let res = 0;

      if (sortField === 'nama') {
        res = (a.nama || '').trim().localeCompare((b.nama || '').trim(), 'id', { sensitivity: 'base' });
      } else if (sortField === 'nama_kelas') {
        res = (a.nama_kelas || '').trim().localeCompare((b.nama_kelas || '').trim(), 'id');
      } else if (sortField === 'kamar') {
        const valA = `${a.nama_kamar || ''} ${a.nama_asrama || ''}`.trim();
        const valB = `${b.nama_kamar || ''} ${b.nama_asrama || ''}`.trim();
        res = valA.localeCompare(valB, 'id');
      } else if (sortField === 'alamat') {
        res = (a.alamat || '').trim().localeCompare((b.alamat || '').trim(), 'id');
      } else if (sortField === 'nis') {
        res = (a.nis || '').trim().localeCompare((b.nis || '').trim(), undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortField === 'kehadiran') {
        const numA = a.kehadiran_persen !== undefined && a.kehadiran_persen !== null ? Number(a.kehadiran_persen) : -1;
        const numB = b.kehadiran_persen !== undefined && b.kehadiran_persen !== null ? Number(b.kehadiran_persen) : -1;
        res = numA - numB;
      } else if (sortField === 'harian') {
        const rawA = curA.harian !== undefined && curA.harian !== '' ? curA.harian : a.nilai_harian;
        const rawB = curB.harian !== undefined && curB.harian !== '' ? curB.harian : b.nilai_harian;
        const numA = rawA !== null && rawA !== undefined && rawA !== '' && rawA !== '-' ? parseFloat(String(rawA)) : -1;
        const numB = rawB !== null && rawB !== undefined && rawB !== '' && rawB !== '-' ? parseFloat(String(rawB)) : -1;
        res = numA - numB;
      } else if (sortField === 'lisan') {
        const rawA = curA.lisan !== undefined && curA.lisan !== '' ? curA.lisan : a.nilai_lisan;
        const rawB = curB.lisan !== undefined && curB.lisan !== '' ? curB.lisan : b.nilai_lisan;
        const numA = rawA !== null && rawA !== undefined && rawA !== '' && rawA !== '-' ? parseFloat(String(rawA)) : -1;
        const numB = rawB !== null && rawB !== undefined && rawB !== '' && rawB !== '-' ? parseFloat(String(rawB)) : -1;
        res = numA - numB;
      } else if (sortField === 'uts') {
        const rawA = curA.uts !== undefined && curA.uts !== '' ? curA.uts : a.nilai_uts;
        const rawB = curB.uts !== undefined && curB.uts !== '' ? curB.uts : b.nilai_uts;
        const numA = rawA !== null && rawA !== undefined && rawA !== '' && rawA !== '-' ? parseFloat(String(rawA)) : -1;
        const numB = rawB !== null && rawB !== undefined && rawB !== '' && rawB !== '-' ? parseFloat(String(rawB)) : -1;
        res = numA - numB;
      } else if (sortField === 'uas') {
        const rawA = curA.uas !== undefined && curA.uas !== '' ? curA.uas : a.nilai_uas;
        const rawB = curB.uas !== undefined && curB.uas !== '' ? curB.uas : b.nilai_uas;
        const numA = rawA !== null && rawA !== undefined && rawA !== '' && rawA !== '-' ? parseFloat(String(rawA)) : -1;
        const numB = rawB !== null && rawB !== undefined && rawB !== '' && rawB !== '-' ? parseFloat(String(rawB)) : -1;
        res = numA - numB;
      } else if (sortField === 'akhir') {
        const rawA = curA.akhir !== undefined && curA.akhir !== '' ? curA.akhir : a.nilai_akhir;
        const rawB = curB.akhir !== undefined && curB.akhir !== '' ? curB.akhir : b.nilai_akhir;
        const numA = rawA !== null && rawA !== undefined && rawA !== '' && rawA !== '-' ? parseFloat(String(rawA)) : -1;
        const numB = rawB !== null && rawB !== undefined && rawB !== '' && rawB !== '-' ? parseFloat(String(rawB)) : -1;
        res = numA - numB;
      } else if (sortField === 'predikat') {
        const valA = (curA.predikat || a.predikat || '').trim().toUpperCase();
        const valB = (curB.predikat || b.predikat || '').trim().toUpperCase();
        if (!valA && !valB) res = 0;
        else if (!valA) res = -1;
        else if (!valB) res = 1;
        else res = valA.localeCompare(valB);
      } else if (sortField === 'catatan') {
        const valA = (curA.catatan || a.catatan || '').trim().toLowerCase();
        const valB = (curB.catatan || b.catatan || '').trim().toLowerCase();
        res = valA.localeCompare(valB);
      }

      return sortOrder === 'asc' ? res : -res;
    });
  }, [muridList, sortField, sortOrder, scores]);

  // 2. Pencarian Universal Client-Side
  const filteredAndSortedMurid = useMemo(() => {
    if (!searchQuery.trim()) return sortedMurid;
    const q = searchQuery.toLowerCase().trim();
    return sortedMurid.filter(m => {
      const cur = scores[m.murid_id] || {};
      const fields = [
        m.nama || '',
        m.nis || '',
        m.nama_kelas || '',
        m.nama_kamar || '',
        m.nama_asrama || '',
        m.alamat || '',
        m.jenis_kelamin || '',
        String(m.kehadiran_persen ?? ''),
        String(cur.harian ?? m.nilai_harian ?? ''),
        String(cur.lisan ?? m.nilai_lisan ?? ''),
        String(cur.uts ?? m.nilai_uts ?? ''),
        String(cur.uas ?? m.nilai_uas ?? ''),
        String(cur.akhir ?? m.nilai_akhir ?? ''),
        String(cur.predikat ?? m.predikat ?? ''),
        String(cur.catatan ?? m.catatan ?? ''),
      ];
      return fields.some(f => f.toLowerCase().includes(q));
    });
  }, [sortedMurid, searchQuery, scores]);



  // State Raport
  const [selectedMuridId, setSelectedMuridId] = useState<string>('');
  const [raportData, setRaportData] = useState<any>(null);
  const [raportError, setRaportError] = useState<string | null>(null);
  const initialSantriIdRef = useRef<string>('');
  const [loadingRaport, setLoadingRaport] = useState(false);
  const [savingRaportCatatan, setSavingRaportCatatan] = useState(false);
  const [editCatatan, setEditCatatan] = useState<RaportCatatanForm>({
    catatan_wali_kelas: '',
    akhlak: 'Baik',
    kerajinan: 'Baik',
    kebersihan: 'Baik',
    tahfidz_hafalan: '',
    status_kelulusan: 'Naik Kelas',
  });

  // Toggle Input Mapel Khusus (mengosongkan input dan mengarahkan kursor otomatis)
  const handleToggleCustomMapel = () => {
    if (!isCustomMapel) {
      setIsCustomMapel(true);
      setSelectedMapel('');
      setSelectedKitab('');
      setTimeout(() => {
        customMapelInputRef.current?.focus();
      }, 60);
    } else {
      setIsCustomMapel(false);
      if (kurikulumList.length > 0) {
        setSelectedMapel(kurikulumList[0].mata_pelajaran);
        setSelectedKitab(kurikulumList[0].kitab || '');
      }
    }
  };

  // 0. Fetch Role Pengguna (untuk mode tamu & wali)
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.user) {
          setUserRole(d.user.role);
          // Wali murid, santri & mode tamu langsung arahkan ke tab Raport
          const role = (d.user.role || '').toLowerCase();
          if (role === 'wali_murid' || role === 'wali_alumni' || role === 'santri' || role === 'tamu') {
            setActiveTab('raport');
          }
        }
      })
      .catch(() => {});
  }, []);

  // 0b. Auto-select Periode Akademik Aktif dari pengaturan sistem (kecuali sudah di-override query URL)
  useEffect(() => {
    fetch('/api/settings?public=1')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
          if (!sp?.get('semester') && d.data.semester_aktif) {
            setSemester(d.data.semester_aktif);
          }
          if (!sp?.get('tahun_ajaran') && d.data.tahun_ajaran_aktif) {
            setTahunAjaran(d.data.tahun_ajaran_aktif);
          }
        }
      })
      .catch(() => {});
  }, []);

  // 1. Load Data Master (Daftar Kelas)
  useEffect(() => {
    const fetchMaster = async () => {
      try {
        const res = await fetch('/api/penilaian/data');
        const json = await res.json();
        if (json.success) {
          const kList = json.kelas || [];
          setKelasList(kList);

          let initialKelas = '';
          let initialMapel = '';
          if (typeof window !== 'undefined') {
            const sp = new URLSearchParams(window.location.search);
            const urlTab = (sp.get('tab') || '').toLowerCase();
            const urlSantriId = sp.get('santri_id') || sp.get('murid_id') || '';
            const urlKelas = sp.get('kelas_id') || sp.get('kelas');
            const urlMapel = sp.get('mapel');
            const urlSem = sp.get('semester');
            const urlThn = sp.get('tahun_ajaran');
            if (urlTab === 'raport' || urlTab === 'raport-santri' || urlSantriId) {
              setActiveTab('raport');
            }
            if (urlSantriId) {
              initialSantriIdRef.current = urlSantriId;
            }
            if (urlSem) setSemester(urlSem);
            if (urlThn) setTahunAjaran(urlThn);
            if (urlKelas && kList.some((k: any) => String(k.kelas_id) === urlKelas)) {
              initialKelas = urlKelas;
            }
            if (urlMapel) initialMapel = urlMapel;
          }

          if (initialKelas) {
            setSelectedKelas(initialKelas);
          } else if (kList.length > 0) {
            setSelectedKelas(String(kList[0].kelas_id));
          }

          if (initialMapel) {
            setSelectedMapel(initialMapel);
          }
        }
      } catch (err) {
        console.error('Failed to load master penilaian', err);
      }
    };
    fetchMaster();
  }, []);

  // 1b. Reload daftar Mata Pelajaran tiap kali kelas berubah (tersinkronisasi jadwal_madin)
  useEffect(() => {
    if (!selectedKelas) return;

    // Jika "Semua Kelas", kunci pilihan mapel ke "Semua Mapel" saja tanpa variasi mapel lain
    if (isSemuaKelasMode) {
      setIsCustomMapel(false);
      setKurikulumList([{ id: 'SEMUA', mata_pelajaran: 'Semua Mapel', kitab: '' }]);
      setSelectedMapel('Semua Mapel');
      setSelectedKitab('');
      return;
    }

    const fetchMapel = async () => {
      try {
        const res = await fetch(`/api/penilaian/data?kelas_id=${selectedKelas}`);
        const json = await res.json();
        if (json.success) {
          const mList = json.kurikulum || [];
          setKurikulumList(mList);
          if (!isCustomMapel) {
            const urlMapel = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('mapel') : null;
            const matchMapel = urlMapel && mList.some((m: any) => m.mata_pelajaran === urlMapel) ? urlMapel : null;

            if (matchMapel) {
              setSelectedMapel(matchMapel);
              const found = mList.find((k: any) => k.mata_pelajaran === matchMapel);
              if (found) setSelectedKitab(found.kitab || '');
            } else if (mList.length > 0) {
              setSelectedMapel(mList[0].mata_pelajaran);
              setSelectedKitab(mList[0].kitab || '');
            } else {
              setSelectedMapel('Semua Mapel');
              setSelectedKitab('');
            }
          }
        }
      } catch (err) {
        console.error('Failed to reload mapel list', err);
      }
    };
    fetchMapel();
  }, [selectedKelas, isSemuaKelasMode]);

  const isRaportAllSantri = activeTab === 'raport' && isSemuaKelasMode;

  // 2. Load Murid & Nilai saat Kelas / Mapel / Semester / Tahun berubah
  useEffect(() => {
    if (!selectedKelas) return;

    const fetchMuridDanNilai = async () => {
      setLoadingMurid(true);
      try {
        const query = new URLSearchParams({
          kelas_id: selectedKelas,
          mapel: selectedMapel,
          semester,
          tahun_ajaran: tahunAjaran,
          ...(isRaportAllSantri ? { for_raport: '1' } : {}),
        });
        const res = await fetch(`/api/penilaian/data?${query.toString()}`);
        const json = await res.json();
        if (json.success && json.muridList) {
          setMuridList(json.muridList);
          const initialScores: Record<number, any> = {};
          json.muridList.forEach((m: any) => {
            const h = m.nilai_harian !== null && m.nilai_harian !== undefined && m.nilai_harian !== '' ? String(m.nilai_harian) : '';
            const l = m.nilai_lisan !== null && m.nilai_lisan !== undefined && m.nilai_lisan !== '' ? String(m.nilai_lisan) : '';
            const u = m.nilai_uts !== null && m.nilai_uts !== undefined && m.nilai_uts !== '' ? String(m.nilai_uts) : '';
            const a = m.nilai_uas !== null && m.nilai_uas !== undefined && m.nilai_uas !== '' ? String(m.nilai_uas) : '';
            let finalVal = m.nilai_akhir !== null && m.nilai_akhir !== undefined && m.nilai_akhir !== '' ? String(m.nilai_akhir) : '';
            let pred = m.predikat || '';

            // Jika belum ada nilai akhir tersimpan tetapi komponen terisi, hitung preview
            if (!finalVal && (h || l || u || a)) {
              const autoFinal = calcNilaiAkhir({ harian: h, lisan: l, uts: u, uas: a });
              if (autoFinal !== null) {
                finalVal = String(autoFinal);
                pred = autoFinal === 0 ? 'E' : calcPredikat(autoFinal);
              }
            }

            initialScores[m.murid_id] = {
              harian: h,
              lisan: l,
              uts: u,
              uas: a,
              akhir: finalVal,
              predikat: pred,
              catatan: m.catatan || '',
            };
          });
          setScores(initialScores);

          // Jika datang dari tautan URL ?santri_id=..., terapkan sekali
          const urlTargetId = initialSantriIdRef.current;
          if (urlTargetId && json.muridList.some((m: any) => String(m.murid_id) === urlTargetId)) {
            initialSantriIdRef.current = '';
            setSelectedMuridId(urlTargetId);
          } else {
            // Pertahankan pilihan santri hanya jika masih ada di kelas baru; default kosong agar pengguna memilih santri secara eksplisit
            setSelectedMuridId(prev => (
              prev && json.muridList.some((m: any) => String(m.murid_id) === prev) ? prev : ''
            ));
          }
        }
      } catch (err) {
        console.error('Failed to fetch murid dan nilai', err);
      } finally {
        setLoadingMurid(false);
      }
    };

    fetchMuridDanNilai();
  }, [selectedKelas, selectedMapel, semester, tahunAjaran, reloadTrigger, isRaportAllSantri]);

  // Untuk akun wali murid / santri yang hanya punya data anaknya sendiri, tampilkan raport otomatis
  useEffect(() => {
    if (isWaliOrSantri && !selectedMuridId && muridList.length > 0) {
      setSelectedMuridId(String(muridList[0].murid_id));
    }
  }, [isWaliOrSantri, muridList, selectedMuridId]);

  // 2b. Animasi Progress Bar saat loadingMurid (seperti billing page)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loadingMurid) {
      setLoadProgress(8);
      timer = setInterval(() => {
        setLoadProgress(prev => {
          if (prev >= 90) { clearInterval(timer); return 90; }
          const step = prev < 40 ? 12 : prev < 70 ? 7 : 3;
          return Math.min(prev + step, 90);
        });
      }, 280);
    } else {
      setLoadProgress(100);
      const t = setTimeout(() => setLoadProgress(0), 300);
      return () => clearTimeout(t);
    }
    return () => clearInterval(timer);
  }, [loadingMurid]);

  // 3. Load Raport Detail Santri
  const fetchRaportDetail = async (mId: string) => {
    if (!mId) {
      setRaportData(null);
      setRaportError(null);
      return;
    }
    setLoadingRaport(true);
    setRaportError(null);
    try {
      const query = new URLSearchParams({
        murid_id: mId,
        semester,
        tahun_ajaran: tahunAjaran,
      });
      const res = await fetch(`/api/penilaian/raport?${query.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setRaportData(json.data);
        if (json.data.catatan) {
          setEditCatatan({
            catatan_wali_kelas: json.data.catatan.catatan_wali_kelas || '',
            akhlak: json.data.catatan.akhlak || 'Baik',
            kerajinan: json.data.catatan.kerajinan || 'Baik',
            kebersihan: json.data.catatan.kebersihan || 'Baik',
            tahfidz_hafalan: json.data.catatan.tahfidz_hafalan || '',
            status_kelulusan: json.data.catatan.status_kelulusan || 'Naik Kelas',
          });
        }
      } else {
        setRaportData(null);
        setRaportError(json.error || 'Gagal memuat data raport santri.');
      }
    } catch (err: any) {
      console.error('Failed to fetch raport', err);
      setRaportData(null);
      setRaportError(err?.message || 'Terjadi kendala koneksi saat memuat raport.');
    } finally {
      setLoadingRaport(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'raport') {
      if (selectedMuridId) {
        fetchRaportDetail(selectedMuridId);
      } else {
        setRaportData(null);
        setRaportError(null);
      }
    }
  }, [activeTab, selectedMuridId, semester, tahunAjaran]);

  // Handle Score Input dengan otomatisasi sekaligus fleksibilitas manual override
  const handleScoreChange = (muridId: number, field: 'harian' | 'lisan' | 'uts' | 'uas' | 'akhir' | 'predikat' | 'catatan', val: string) => {
    setScores(prev => {
      const existing = prev[muridId] || { harian: '', lisan: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
      const updated = { ...existing, [field]: val };

      // Jika yang diubah adalah komponen Harian, Lisan, UTS, atau UAS, hitung otomatis nilai akhir & predikat
      if (field === 'harian' || field === 'lisan' || field === 'uts' || field === 'uas') {
        const autoFinal = calcNilaiAkhir({
          harian: updated.harian,
          lisan: updated.lisan,
          uts: updated.uts,
          uas: updated.uas,
        });

        if (autoFinal !== null) {
          updated.akhir = String(autoFinal);
          updated.predikat = autoFinal === 0 ? 'E' : calcPredikat(autoFinal);
        } else {
          updated.akhir = '';
          updated.predikat = '';
        }
      }

      // Jika yang diubah langsung adalah nilai akhir secara manual, otomatis sesuaikan predikatnya
      if (field === 'akhir') {
        const numAkhir = parseFloat(val);
        if (!isNaN(numAkhir)) {
          updated.predikat = numAkhir === 0 ? 'E' : calcPredikat(numAkhir);
        }
      }

      return {
        ...prev,
        [muridId]: updated,
      };
    });
  };

  // Simpan Nilai Masal
  const handleSaveScores = async () => {
    setSavingScores(true);
    setSaveSuccessMsg('');
    try {
      const payloadScores = muridList.map(m => {
        const s = scores[m.murid_id] || { harian: '', lisan: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
        return {
          murid_id: m.murid_id,
          nilai_harian: s.harian !== '' ? s.harian : null,
          nilai_lisan: s.lisan !== '' ? s.lisan : null,
          nilai_uts: s.uts !== '' ? s.uts : null,
          nilai_uas: s.uas !== '' ? s.uas : null,
          nilai_akhir: s.akhir !== '' ? s.akhir : null,
          predikat: s.predikat || null,
          catatan: s.catatan || '',
        };
      });

      const res = await fetch('/api/penilaian/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kelas_id: selectedKelas,
          mata_pelajaran: selectedMapel,
          kitab: selectedKitab,
          semester,
          tahun_ajaran: tahunAjaran,
          scores: payloadScores,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSaveSuccessMsg(json.message || 'Nilai berhasil disimpan!');
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      } else {
        alert(json.error || 'Gagal menyimpan nilai');
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi saat menyimpan.');
    } finally {
      setSavingScores(false);
    }
  };

  // Simpan Catatan Raport
  const handleSaveRaportCatatan = async () => {
    if (!selectedMuridId) return;
    setSavingRaportCatatan(true);
    try {
      const res = await fetch('/api/penilaian/raport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          murid_id: selectedMuridId,
          semester,
          tahun_ajaran: tahunAjaran,
          ...editCatatan,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert('Catatan & kepribadian raport berhasil disimpan!');
        fetchRaportDetail(selectedMuridId);
      } else {
        alert(json.error || 'Gagal menyimpan catatan raport');
      }
    } catch (err) {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setSavingRaportCatatan(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 print:p-0 print:m-0 print:max-w-none">
      {/* Header Utama (Hidden saat print) */}
      <div className="print:hidden bg-gradient-to-br from-amber-800 via-amber-900 to-yellow-950 text-white rounded-3xl p-6 sm:p-8 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 text-center md:text-left">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-bold uppercase tracking-wider mb-2">
              <Award size={14} /> Akademik &amp; Evaluasi Santri
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center md:justify-start gap-3">
              Penilaian &amp; Raport Digital
            </h1>
            <p className="text-amber-100/80 text-xs sm:text-sm mt-1 max-w-xl mx-auto md:mx-0">
              Pusat input nilai harian, ujian lisan, UTS, UAS, otomatisasi rekap presensi &amp; kedisiplinan, serta cetak lembar raport resmi santri.
            </p>
          </div>

          {/* Kanan: Pintasan Portal Ujian (Atas) + Tab Switcher + Siaran WA */}
          <div className="flex flex-col gap-2 w-full md:w-auto">
            {/* Pintasan ke Portal Ujian Santri Digital — Dipindah ke Atas Tab */}
            <div className="pb-1 border-b border-amber-700/40">
              <a
                href="/dashboard/ujian"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/35 border border-teal-400/30 text-teal-200 hover:text-white text-xs font-bold transition-all"
              >
                <ShieldCheck size={14} className="shrink-0" />
                <span>Portal Ujian Santri Digital</span>
                <ChevronRight size={13} className="shrink-0 opacity-70" />
              </a>
            </div>

            {/* Switcher Tab: Hanya tampilkan tab Raport untuk wali santri dan mode tamu */}
            {isWaliOrSantri || isTamu ? (
              <div className="w-full sm:w-auto max-w-md mx-auto md:mx-0 flex bg-black/35 p-1.5 rounded-2xl backdrop-blur-md border border-white/10 shrink-0">
                <div className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm w-full text-center bg-amber-500 text-white shadow-md">
                  <GraduationCap size={16} />
                  <span>Raport Santri</span>
                </div>
              </div>
            ) : (
              <div className="w-full sm:w-auto max-w-md mx-auto md:mx-0 grid grid-cols-2 gap-2 bg-black/35 p-1.5 rounded-2xl backdrop-blur-md border border-white/10 shrink-0">
                <button
                  onClick={() => setActiveTab('input')}
                  className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all w-full text-center ${
                    activeTab === 'input'
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'text-amber-200/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <ClipboardCheck size={16} />
                  <span>Input &amp; Leger Nilai</span>
                </button>
                <button
                  onClick={() => setActiveTab('raport')}
                  className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all w-full text-center ${
                    activeTab === 'raport'
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'text-amber-200/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <GraduationCap size={16} />
                  <span>Raport Santri</span>
                </button>
              </div>
            )}

            {/* Pintasan ke halaman notifikasi: Siaran WA Input & Leger Nilai Guru (Admin/Staff) */}
            {(userRole === 'admin' || userRole === 'staff') && (
              <div className="pt-1 border-t border-amber-700/40">
                <a
                  href="/dashboard/notifikasi?guru_tab=input_nilai"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/30 text-amber-200 hover:text-white text-xs font-bold transition-all"
                >
                  <Award size={14} className="shrink-0" />
                  <span>Siaran WA Input Nilai ke Guru</span>
                  <ChevronRight size={13} className="shrink-0 opacity-70" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: INPUT NILAI & LEGER KELAS (HANYA UNTUK GURU / ADMIN / STAF)       */}
      {/* ========================================================================= */}
      {!isWaliOrSantri && !isTamu && activeTab === 'input' && (
        <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
          {/* Petunjuk Penggunaan — Collapsible, dipindah ke atas filter */}
          <div className="bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl border border-amber-200/60 dark:border-amber-800/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPetunjuk(p => !p)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-xs sm:text-sm font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Cara Menggunakan Halaman Penilaian</span>
              </div>
              <ChevronDown
                size={16}
                className={`shrink-0 text-amber-600 dark:text-amber-400 transition-transform duration-200 ${showPetunjuk ? 'rotate-180' : ''}`}
              />
            </button>
            {showPetunjuk && (
              <div className="px-4 pb-4 text-xs text-amber-900 dark:text-amber-200">
                <ol className="list-decimal list-inside space-y-1 text-amber-800/90 dark:text-amber-300/90 pl-1 leading-relaxed">
                  <li>Pilih <strong>Kelas Madin</strong> dan <strong>Mata Pelajaran</strong> pada filter di bawah (daftar santri akan langsung muncul di tabel bawah).</li>
                  <li>Ketik nilai pada kolom <strong>Harian</strong>, <strong>Ujian Lisan</strong>, <strong>UTS</strong>, dan <strong>UAS</strong> (bobot 25% masing-masing jika Lisan diisi, atau 30% Harian + 30% UTS + 40% UAS jika Lisan kosong). Nilai Akhir &amp; Predikat terhitung otomatis seketika, dan dapat diedit manual bila diperlukan.</li>
                  <li>Klik tombol <strong>&quot;Simpan Semua Nilai&quot;</strong> di kanan atas tabel untuk menyimpan seluruh nilai santri sekelas sekaligus.</li>
                  <li>Beralih ke tab <strong>&quot;Raport Santri&quot;</strong> untuk melihat atau mencetak lembar raport resmi yang telah terintegrasi dengan data presensi dan kedisiplinan santri.</li>
                </ol>
              </div>
            )}
          </div>

          {/* Baris Filter & Pemilihan Mapel */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            <div className="flex flex-col items-center justify-center text-center gap-1.5 pb-0.5">
              <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <Filter size={14} className="text-amber-600 dark:text-amber-400" /> Filter Kelas &amp; Mata Pelajaran
              </div>
              {!isTamu && !isWaliOrSantri && (
                <button
                  type="button"
                  onClick={handleToggleCustomMapel}
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-3.5 py-1.5 rounded-full border border-amber-200/70 dark:border-amber-800/50 transition-all shadow-xs"
                >
                  <Edit3 size={13} />
                  <span>{isCustomMapel ? 'Kembali ke Pilihan Kurikulum' : 'Ketik Mapel Khusus'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Pilih Kelas Madin */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Kelas Madin
                </label>
                <select
                  value={selectedKelas}
                  onChange={(e) => setSelectedKelas(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                >
                  {kelasList.length === 0 ? (
                    <option value="">(Memuat kelas...)</option>
                  ) : (
                    kelasList.map(k => (
                      <option key={k.kelas_id} value={k.kelas_id}>
                        {k.nama_kelas}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Pilih Mata Pelajaran / Kitab */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Mata Pelajaran {selectedKitab ? `(${selectedKitab})` : ''}
                </label>
                {isCustomMapel ? (
                  <div className="space-y-1.5">
                    <input
                      ref={customMapelInputRef}
                      type="text"
                      value={selectedMapel}
                      onChange={(e) => setSelectedMapel(e.target.value)}
                      placeholder="Nama Pelajaran / Fan (misal: Imla')"
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-amber-300 dark:border-amber-600 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                    />
                    <input
                      type="text"
                      value={selectedKitab}
                      onChange={(e) => setSelectedKitab(e.target.value)}
                      placeholder="Nama Kitab / Rujukan (Opsional)"
                      className="w-full px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                    />
                  </div>
                ) : (
                  <select
                    value={selectedMapel}
                    onChange={(e) => {
                      setSelectedMapel(e.target.value);
                      const found = kurikulumList.find(k => k.mata_pelajaran === e.target.value);
                      if (found) setSelectedKitab(found.kitab || '');
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                  >
                    {kurikulumList.length === 0 ? (
                      <option value="">(Memuat kurikulum...)</option>
                    ) : (
                      kurikulumList.map(k => (
                        <option key={k.id || k.mata_pelajaran} value={k.mata_pelajaran}>
                          {k.mata_pelajaran} {k.kitab ? `— ${k.kitab}` : ''}
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>

              {/* Semester */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Semester
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                >
                  <option value="1">Semester 1 (Ganjil)</option>
                  <option value="2">Semester 2 (Genap)</option>
                </select>
              </div>

              {/* Tahun Ajaran */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Tahun Ajaran
                </label>
                <select
                  value={tahunAjaran}
                  onChange={(e) => setTahunAjaran(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                >
                  {getTahunAjaranOptions(tahunAjaran).map(thn => (
                    <option key={thn} value={thn}>{thn}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Notifikasi Sukses Simpan */}
          {saveSuccessMsg && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-sm font-bold shadow-xs animate-[fadeIn_0.2s_ease-out]">
              <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Tabel Input Nilai Santri */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-center sm:text-left">
              <div className="w-full sm:w-auto">
                <h3 className="font-extrabold text-gray-800 dark:text-gray-100 text-base sm:text-lg flex flex-col sm:flex-row sm:items-center justify-center sm:justify-start gap-1 sm:gap-2">
                  <span>
                    {isLegerMode ? 'Daftar Santri — Semua Mata Pelajaran' : `Daftar Santri — ${selectedMapel || 'Mata Pelajaran'}`}
                  </span>
                  {selectedKitab && !isLegerMode && (
                    <span className="text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400 block sm:inline">
                      ({selectedKitab})
                    </span>
                  )}
                  {isSemuaKelasMode && (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-300 dark:border-blue-800/60 inline-flex items-center gap-1 mx-auto sm:mx-0">
                      ✨ Semua Kelas
                    </span>
                  )}
                  {isLegerMode && (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 inline-flex items-center gap-1 mx-auto sm:mx-0">
                      <Sparkles size={12} /> Leger Kolektif Kelas
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 sm:mt-0.5 max-w-xl mx-auto sm:mx-0">
                  {isLegerMode
                    ? 'Mode Leger Kolektif: Menampilkan rata-rata akumulasi nilai santri & presensi seluruh sesi dari semua mata pelajaran kelas ini.'
                    : 'Kalkulasi otomatis: Harian, Lisan, UTS, UAS (25% masing-masing jika Lisan diisi, atau 30% + 30% + 40% jika kosong). Nilai Akhir & Predikat fleksibel dapat diubah manual.'}
                </p>
              </div>

              {isWaliOrSantri ? (
                <div className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-bold shadow-2xs">
                  <GraduationCap size={14} className="shrink-0" />
                  <span>Mode Santri / Wali — Akses Hanya Lihat</span>
                </div>
              ) : isLegerMode ? (
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowQuizBModal(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all"
                    title="Tarik nilai hasil ujian CBT santri dari Portal Ujian ke buku nilai"
                  >
                    <span>📥 Tarik Nilai Ujian CBT</span>
                  </button>

                  <div className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-bold shadow-2xs">
                    <Sparkles size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Pilih mapel tertentu untuk input / edit nilai</span>
                  </div>
                </div>
              ) : isTamu ? (
                <div className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-xl text-xs font-bold shadow-2xs">
                  <ShieldCheck size={14} className="shrink-0" />
                  <span>Mode Tamu — hanya lihat data</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowQuizBModal(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all"
                    title="Tarik nilai hasil ujian CBT santri dari Portal Ujian ke buku nilai"
                  >
                    <span>📥 Tarik Nilai Ujian CBT</span>
                  </button>

                  <button
                    onClick={handleSaveScores}
                    disabled={savingScores || muridList.length === 0}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all shrink-0"
                  >
                    {savingScores ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{savingScores ? 'Menyimpan...' : 'Simpan Semua Nilai'}</span>
                  </button>
                </div>
              )}
            </div>

            {loadingMurid ? (
              <div className="p-8 sm:p-12 text-center">
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-6 sm:p-8 w-full max-w-sm mx-auto text-center space-y-4 border border-gray-100 dark:border-gray-700">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
                    <BookOpen size={24} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-gray-800 dark:text-gray-100 text-sm sm:text-base">
                      Memuat Data Santri & Nilai...
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">Menghubungkan ke server database penilaian</p>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${loadProgress}%` }}
                    />
                  </div>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{loadProgress}%</p>
                  <p className="text-[11px] text-gray-400">Harap tunggu, proses sedang berlangsung...</p>
                </div>
              </div>
            ) : muridList.length === 0 ? (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                <AlertCircle size={28} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm font-semibold">Belum ada santri terdaftar di kelas ini.</p>
              </div>
            ) : (
              <>
                {/* Toolbar Pencarian & Filter Cepat */}
                <div className="p-3 sm:p-4 bg-gray-50/70 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:max-w-md">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari santri, NIS, kelas, kamar, alamat, nilai..."
                      className="w-full pl-9 pr-8 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-gray-800 dark:text-gray-100 placeholder:text-gray-400 shadow-2xs"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                        title="Hapus pencarian"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {searchQuery && (
                      <span className="bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-300 dark:border-amber-800/60">
                        Hasil: {filteredAndSortedMurid.length} dari {muridList.length} santri
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-gray-400">Urut:</span>
                      <span className="font-bold text-gray-700 dark:text-gray-200 capitalize">
                        {sortField === 'no' ? 'Nomor' : sortField === 'nama_kelas' ? 'Kelas' : sortField} ({sortOrder === 'asc' ? 'A-Z / Naik' : 'Z-A / Turun'})
                      </span>
                      {sortField !== 'no' && (
                        <button
                          type="button"
                          onClick={() => { setSortField('no'); setSortOrder('asc'); }}
                          className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-bold border-b border-gray-200 dark:border-gray-700 text-xs sm:text-sm">
                        {/* Kolom No */}
                        <th
                          onClick={() => handleSort('no')}
                          className="py-3.5 px-3 w-12 text-center cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                          title="Klik untuk mengurutkan Nomor Urut Asli"
                        >
                          <div className="inline-flex items-center justify-center gap-1">
                            <span>No</span>
                            {sortField === 'no' ? (
                              sortOrder === 'asc' ? <ArrowUp size={12} className="text-amber-600 dark:text-amber-400" /> : <ArrowDown size={12} className="text-amber-600 dark:text-amber-400" />
                            ) : (
                              <ArrowUpDown size={11} className="opacity-30" />
                            )}
                          </div>
                        </th>

                        {/* Kolom Foto (Persis Halaman Data Murid & Rekapitulasi) */}
                        <th className="py-3.5 px-3 w-14 text-center select-none text-gray-700 dark:text-gray-300 font-bold">
                          Foto
                        </th>

                        {/* Kolom Nama Santri + Sub-sort: Kelas, Kamar, Alamat */}
                        <th className="py-3.5 px-4 min-w-[210px]">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleSort('nama')}
                              className="inline-flex items-center gap-1 font-bold hover:text-amber-600 dark:hover:text-amber-400 transition"
                              title="Klik untuk mengurutkan Nama Santri (A-Z)"
                            >
                              <span>Nama Santri</span>
                              {sortField === 'nama' ? (
                                sortOrder === 'asc' ? <ArrowUp size={13} className="text-amber-600 dark:text-amber-400" /> : <ArrowDown size={13} className="text-amber-600 dark:text-amber-400" />
                              ) : (
                                <ArrowUpDown size={12} className="opacity-35" />
                              )}
                            </button>
                            <div className="flex items-center gap-1 text-[10px] font-normal">
                              <button
                                type="button"
                                onClick={() => handleSort('nama_kelas')}
                                title="Urutkan berdasarkan Rombel/Kelas"
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition ${
                                  sortField === 'nama_kelas'
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-amber-600 border-gray-200 dark:border-gray-700'
                                }`}
                              >
                                Kelas {sortField === 'nama_kelas' && (sortOrder === 'asc' ? '↑' : '↓')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSort('kamar')}
                                title="Urutkan berdasarkan Kamar/Asrama"
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition ${
                                  sortField === 'kamar'
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-amber-600 border-gray-200 dark:border-gray-700'
                                }`}
                              >
                                Kamar {sortField === 'kamar' && (sortOrder === 'asc' ? '↑' : '↓')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSort('alamat')}
                                title="Urutkan berdasarkan Alamat"
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition ${
                                  sortField === 'alamat'
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-amber-600 border-gray-200 dark:border-gray-700'
                                }`}
                              >
                                Alamat {sortField === 'alamat' && (sortOrder === 'asc' ? '↑' : '↓')}
                              </button>
                            </div>
                          </div>
                        </th>

                        {/* Kolom NIS */}
                        <th
                          onClick={() => handleSort('nis')}
                          className="py-3.5 px-3 w-24 text-center cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                          title="Klik untuk mengurutkan NIS"
                        >
                          <div className="inline-flex items-center justify-center gap-1">
                            <span>NIS</span>
                            {sortField === 'nis' ? (
                              sortOrder === 'asc' ? <ArrowUp size={12} className="text-amber-600 dark:text-amber-400" /> : <ArrowDown size={12} className="text-amber-600 dark:text-amber-400" />
                            ) : (
                              <ArrowUpDown size={11} className="opacity-30" />
                            )}
                          </div>
                        </th>

                        {/* Kolom Kehadiran */}
                        <th
                          onClick={() => handleSort('kehadiran')}
                          className="py-3.5 px-2.5 w-24 text-center cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                          title="Klik untuk mengurutkan Persentase Kehadiran"
                        >
                          <div className="flex flex-col items-center justify-center">
                            <div className="inline-flex items-center gap-1">
                              <span>Kehadiran</span>
                              {sortField === 'kehadiran' ? (
                                sortOrder === 'asc' ? <ArrowUp size={12} className="text-amber-600 dark:text-amber-400" /> : <ArrowDown size={12} className="text-amber-600 dark:text-amber-400" />
                              ) : (
                                <ArrowUpDown size={11} className="opacity-30" />
                              )}
                            </div>
                            <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">
                              {isLegerMode ? '(Total Sesi)' : '(Presensi)'}
                            </span>
                          </div>
                        </th>

                        {/* Kolom Harian */}
                        <th
                          onClick={() => handleSort('harian')}
                          className="py-3.5 px-2 w-24 text-center cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                          title="Klik untuk mengurutkan Nilai Harian"
                        >
                          <div className="flex flex-col items-center justify-center">
                            <div className="inline-flex items-center gap-1">
                              <span>Harian</span>
                              {sortField === 'harian' ? (
                                sortOrder === 'asc' ? <ArrowUp size={12} className="text-amber-600 dark:text-amber-400" /> : <ArrowDown size={12} className="text-amber-600 dark:text-amber-400" />
                              ) : (
                                <ArrowUpDown size={11} className="opacity-30" />
                              )}
                            </div>
                            <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">
                              {isLegerMode ? '(Rerata)' : '(30% / 25%)'}
                            </span>
                          </div>
                        </th>

                        {/* Kolom Ujian Lisan */}
                        <th
                          onClick={() => handleSort('lisan')}
                          className="py-3.5 px-2 w-24 text-center cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                          title="Klik untuk mengurutkan Nilai Ujian Lisan"
                        >
                          <div className="flex flex-col items-center justify-center">
                            <div className="inline-flex items-center gap-1">
                              <span>Lisan</span>
                              {sortField === 'lisan' ? (
                                sortOrder === 'asc' ? <ArrowUp size={12} className="text-amber-600 dark:text-amber-400" /> : <ArrowDown size={12} className="text-amber-600 dark:text-amber-400" />
                              ) : (
                                <ArrowUpDown size={11} className="opacity-30" />
                              )}
                            </div>
                            <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">
                              {isLegerMode ? '(Rerata)' : '(25%)'}
                            </span>
                          </div>
                        </th>

                        {/* Kolom UTS */}
                        <th
                          onClick={() => handleSort('uts')}
                          className="py-3.5 px-2 w-24 text-center cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                          title="Klik untuk mengurutkan Nilai UTS"
                        >
                          <div className="flex flex-col items-center justify-center">
                            <div className="inline-flex items-center gap-1">
                              <span>UTS</span>
                              {sortField === 'uts' ? (
                                sortOrder === 'asc' ? <ArrowUp size={12} className="text-amber-600 dark:text-amber-400" /> : <ArrowDown size={12} className="text-amber-600 dark:text-amber-400" />
                              ) : (
                                <ArrowUpDown size={11} className="opacity-30" />
                              )}
                            </div>
                            <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">
                              {isLegerMode ? '(Rerata)' : '(30% / 25%)'}
                            </span>
                          </div>
                        </th>

                        {/* Kolom UAS */}
                        <th
                          onClick={() => handleSort('uas')}
                          className="py-3.5 px-2 w-24 text-center cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                          title="Klik untuk mengurutkan Nilai UAS"
                        >
                          <div className="flex flex-col items-center justify-center">
                            <div className="inline-flex items-center gap-1">
                              <span>UAS</span>
                              {sortField === 'uas' ? (
                                sortOrder === 'asc' ? <ArrowUp size={12} className="text-amber-600 dark:text-amber-400" /> : <ArrowDown size={12} className="text-amber-600 dark:text-amber-400" />
                              ) : (
                                <ArrowUpDown size={11} className="opacity-30" />
                              )}
                            </div>
                            <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">
                              {isLegerMode ? '(Rerata)' : '(40% / 25%)'}
                            </span>
                          </div>
                        </th>

                        {/* Kolom Nilai Akhir */}
                        <th
                          onClick={() => handleSort('akhir')}
                          className="py-3.5 px-2 w-28 text-center cursor-pointer select-none bg-amber-100/90 dark:bg-amber-950/70 text-amber-950 dark:text-amber-200 font-black border-l border-r border-amber-200 dark:border-amber-800/60 hover:bg-amber-200/90 transition-colors"
                          title="Klik untuk mengurutkan Nilai Akhir"
                        >
                          <div className="inline-flex items-center justify-center gap-1">
                            <span>{isLegerMode ? 'Nilai Akhir (Rerata)' : 'Nilai Akhir'}</span>
                            {sortField === 'akhir' ? (
                              sortOrder === 'asc' ? <ArrowUp size={12} className="text-amber-700 dark:text-amber-300" /> : <ArrowDown size={12} className="text-amber-700 dark:text-amber-300" />
                            ) : (
                              <ArrowUpDown size={11} className="opacity-30" />
                            )}
                          </div>
                        </th>

                        {/* Kolom Predikat */}
                        <th
                          onClick={() => handleSort('predikat')}
                          className="py-3.5 px-2 w-24 text-center cursor-pointer select-none bg-amber-100/90 dark:bg-amber-950/70 text-amber-950 dark:text-amber-200 font-black border-r border-amber-200 dark:border-amber-800/60 hover:bg-amber-200/90 transition-colors"
                          title="Klik untuk mengurutkan Predikat"
                        >
                          <div className="inline-flex items-center justify-center gap-1">
                            <span>{isLegerMode ? 'Predikat Umum' : 'Predikat'}</span>
                            {sortField === 'predikat' ? (
                              sortOrder === 'asc' ? <ArrowUp size={12} className="text-amber-700 dark:text-amber-300" /> : <ArrowDown size={12} className="text-amber-700 dark:text-amber-300" />
                            ) : (
                              <ArrowUpDown size={11} className="opacity-30" />
                            )}
                          </div>
                        </th>

                        {/* Kolom Catatan / Kelengkapan Nilai */}
                        <th
                          onClick={() => handleSort('catatan')}
                          className="py-3.5 px-4 min-w-[160px] cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                          title="Klik untuk mengurutkan Catatan/Kelengkapan"
                        >
                          <div className="inline-flex items-center gap-1">
                            <span>{isLegerMode ? 'Kelengkapan Nilai' : 'Catatan Perkembangan'}</span>
                            {sortField === 'catatan' ? (
                              sortOrder === 'asc' ? <ArrowUp size={12} className="text-amber-600 dark:text-amber-400" /> : <ArrowDown size={12} className="text-amber-600 dark:text-amber-400" />
                            ) : (
                              <ArrowUpDown size={11} className="opacity-30" />
                            )}
                          </div>
                        </th>

                        {/* Kolom Aksi (Edit & Hapus Nilai Percobaan) */}
                        <th className="py-3.5 px-3 w-28 text-center select-none text-gray-700 dark:text-gray-300 font-bold">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredAndSortedMurid.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="py-10 text-center text-gray-500 dark:text-gray-400">
                            <AlertCircle size={24} className="mx-auto text-amber-500 mb-2" />
                            <p className="font-semibold text-xs sm:text-sm">Tidak ditemukan data santri yang cocok dengan &quot;{searchQuery}&quot;</p>
                            <button
                              type="button"
                              onClick={() => setSearchQuery('')}
                              className="mt-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
                            >
                              Reset Pencarian
                            </button>
                          </td>
                        </tr>
                      ) : (
                        filteredAndSortedMurid.map((m, idx) => {
                      const cur = scores[m.murid_id] || { harian: '', lisan: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
                      const fotoUrl = getFotoUrl(m.foto);

                      return (
                        <tr key={m.murid_id} className="hover:bg-amber-50/40 dark:hover:bg-gray-700/40 transition-colors">
                          <td className="py-3 px-3 text-center text-gray-500 font-semibold">{idx + 1}</td>

                          {/* Kolom Foto Santri (Persis Pola Halaman Rekapitulasi) */}
                          <td className="py-2.5 px-2 text-center">
                            <div
                              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full mx-auto overflow-hidden relative border border-gray-200 dark:border-gray-700 shadow-2xs ${
                                fotoUrl ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
                              }`}
                              onClick={() => (fotoUrl ? setZoomPhoto(fotoUrl) : null)}
                              title={fotoUrl ? 'Klik untuk memperbesar foto' : m.nama}
                            >
                              {fotoUrl ? (
                                <img
                                  src={fotoUrl}
                                  alt={m.nama}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fallback = e.currentTarget.parentElement?.querySelector('.avatar-fallback');
                                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div
                                className={`avatar-fallback w-full h-full flex items-center justify-center text-white text-[11px] font-bold ${
                                  fotoUrl ? 'hidden' : ''
                                }`}
                                style={{ backgroundColor: getAvatarColor(m.nama) }}
                              >
                                {getInitials(m.nama)}
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 font-bold text-gray-800 dark:text-gray-100 min-w-[160px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{m.nama}</span>
                              {isSemuaKelasMode && m.nama_kelas && (
                                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                                  🏷️ {m.nama_kelas}
                                </span>
                              )}
                            </div>
                            {(m.nama_kamar || m.nama_asrama) ? (
                              <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold leading-tight mt-0.5">
                                🛏 {[m.nama_kamar, m.nama_asrama].filter(Boolean).join(' — ')}
                              </span>
                            ) : null}
                            {m.alamat ? (
                              <span className="block text-[10px] text-gray-400 font-normal leading-tight">
                                📍 {m.alamat}
                              </span>
                            ) : null}
                            {!m.nama_kamar && !m.nama_asrama && !m.alamat && (
                              <span className="block text-[10px] text-gray-400 font-normal">
                                {m.jenis_kelamin === 'Perempuan' ? 'Santri Putri' : 'Santri Putra'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center text-gray-500 font-mono text-xs">{m.nis || '-'}</td>
                          
                          {/* KOLOM PROSENTASE KEHADIRAN OTOMATIS */}
                          <td className="py-3 px-2.5 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold shadow-2xs ${
                                (m.kehadiran_persen ?? 100) >= 85
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                  : (m.kehadiran_persen ?? 100) >= 70
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              }`}
                              title={m.kehadiran_total > 0 ? `${m.kehadiran_hadir} dari ${m.kehadiran_total} sesi hadir` : 'Presensi terekap otomatis'}
                            >
                              {m.kehadiran_persen !== undefined ? `${m.kehadiran_persen}%` : '100%'}
                            </span>
                          </td>

                          {isLegerMode ? (
                            <>
                              <td className="py-3 px-2 text-center font-semibold text-gray-700 dark:text-gray-300">
                                {cur.harian !== '' ? cur.harian : '-'}
                              </td>
                              <td className="py-3 px-2 text-center font-semibold text-amber-700 dark:text-amber-300">
                                {cur.lisan !== '' ? cur.lisan : '-'}
                              </td>
                              <td className="py-3 px-2 text-center font-semibold text-gray-700 dark:text-gray-300">
                                {cur.uts !== '' ? cur.uts : '-'}
                              </td>
                              <td className="py-3 px-2 text-center font-semibold text-gray-700 dark:text-gray-300">
                                {cur.uas !== '' ? cur.uas : '-'}
                              </td>
                              <td className="py-2.5 px-2 text-center bg-amber-50/40 dark:bg-amber-950/20 border-l border-r border-amber-100 dark:border-amber-900/40">
                                <span className="inline-block px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/70 font-black text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
                                  {cur.akhir !== '' ? cur.akhir : '-'}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-center bg-amber-50/40 dark:bg-amber-950/20 border-r border-amber-100 dark:border-amber-900/40">
                                <span className="inline-block px-2.5 py-0.5 rounded-full font-bold text-xs bg-white dark:bg-gray-800 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-600 shadow-2xs">
                                  {cur.predikat || '-'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-400">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  (m.total_mapel_dinilai || 0) > 0
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                }`}>
                                  {m.catatan || 'Belum Ada Nilai'}
                                </span>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="any"
                                  value={cur.harian}
                                  onChange={(e) => handleScoreChange(m.murid_id, 'harian', e.target.value)}
                                  placeholder="0"
                                  className="w-16 sm:w-18 text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="any"
                                  value={cur.lisan}
                                  onChange={(e) => handleScoreChange(m.murid_id, 'lisan', e.target.value)}
                                  placeholder="-"
                                  className="w-16 sm:w-18 text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="any"
                                  value={cur.uts}
                                  onChange={(e) => handleScoreChange(m.murid_id, 'uts', e.target.value)}
                                  placeholder="0"
                                  className="w-16 sm:w-18 text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="any"
                                  value={cur.uas}
                                  onChange={(e) => handleScoreChange(m.murid_id, 'uas', e.target.value)}
                                  placeholder="0"
                                  className="w-16 sm:w-18 text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                                />
                              </td>
                              {/* NILAI AKHIR (DAPAT DIUBAH MANUAL OLEH PENGGUNA/GURU) */}
                              <td className="py-2 px-2 text-center bg-amber-50/40 dark:bg-amber-950/20 border-l border-r border-amber-100 dark:border-amber-900/40">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="any"
                                  value={cur.akhir}
                                  onChange={(e) => handleScoreChange(m.murid_id, 'akhir', e.target.value)}
                                  placeholder="0"
                                  className="w-20 text-center py-1.5 px-2 bg-white dark:bg-gray-900 rounded-lg border-2 border-amber-400 dark:border-amber-500 font-black text-amber-900 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                                  title="Nilai Akhir: Terhitung otomatis, dapat diedit langsung jika ingin override manual"
                                />
                              </td>
                              {/* PREDIKAT (DAPAT DIUBAH MANUAL OLEH PENGGUNA/GURU) */}
                              <td className="py-2 px-2 text-center bg-amber-50/40 dark:bg-amber-950/20 border-r border-amber-100 dark:border-amber-900/40">
                                <select
                                  value={cur.predikat}
                                  onChange={(e) => handleScoreChange(m.murid_id, 'predikat', e.target.value)}
                                  className="w-16 text-center py-1.5 px-1 bg-white dark:bg-gray-900 rounded-lg border border-amber-400 dark:border-amber-500 font-black text-xs text-amber-900 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                                >
                                  <option value="">-</option>
                                  <option value="A">A</option>
                                  <option value="B">B</option>
                                  <option value="C">C</option>
                                  <option value="D">D</option>
                                  <option value="E">E</option>
                                </select>
                              </td>
                              <td className="py-2 px-4">
                                <input
                                  type="text"
                                  value={cur.catatan}
                                  onChange={(e) => handleScoreChange(m.murid_id, 'catatan', e.target.value)}
                                  placeholder="Catatan kemajuan..."
                                  className="w-full py-1.5 px-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                              </td>
                            </>
                          )}

                          {/* Kolom Aksi (Edit & Hapus Nilai Percobaan) */}
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            {isWaliOrSantri || isTamu ? (
                              <span className="text-[11px] text-gray-400 italic">Lihat Saja</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(m)}
                                  className="p-1.5 text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 rounded-lg border border-amber-200 dark:border-amber-800/60 transition-all text-xs font-bold inline-flex items-center gap-1 shadow-2xs"
                                  title="Edit / Kelola Nilai Santri Ini"
                                >
                                  <Edit3 size={13} />
                                  <span className="hidden sm:inline">Edit</span>
                                </button>
                                {((isLegerMode && (m.total_mapel_dinilai || 0) > 0) || (!isLegerMode && (cur.harian !== '' || cur.lisan !== '' || cur.uts !== '' || cur.uas !== '' || cur.akhir !== ''))) && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickResetScore(m)}
                                    className="p-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 rounded-lg border border-rose-200 dark:border-rose-800/60 transition-all text-xs font-bold inline-flex items-center gap-1 shadow-2xs"
                                    title="Hapus Nilai / Reset Hasil Percobaan"
                                  >
                                    <Trash2 size={13} />
                                    <span className="hidden sm:inline">Hapus</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RAPORT SANTRI & CETAK RESMI                                        */}
      {/* ========================================================================= */}
      {(isWaliOrSantri || isTamu || activeTab === 'raport') && (
        <RaportTabSection
          kelasList={kelasList}
          selectedKelas={selectedKelas}
          onChangeKelas={setSelectedKelas}
          semester={semester}
          onChangeSemester={setSemester}
          tahunAjaran={tahunAjaran}
          onChangeTahunAjaran={setTahunAjaran}
          muridList={muridList}
          loadingMurid={loadingMurid}
          selectedMuridId={selectedMuridId}
          onSelectMuridId={id => {
            setSelectedMuridId(id);
            if (!id) {
              setRaportData(null);
              setRaportError(null);
            }
          }}
          raportData={raportData}
          loadingRaport={loadingRaport}
          raportError={raportError}
          onRefreshRaport={fetchRaportDetail}
          onPrint={handlePrint}
          getPreviewUrl={mId => {
            const p = new URLSearchParams({
              murid_id: mId,
              semester,
              tahun_ajaran: tahunAjaran,
              preview: '1',
            });
            return `/dashboard/penilaian/preview?${p.toString()}`;
          }}
          getFotoUrl={getFotoUrl}
          onZoomPhoto={setZoomPhoto}
          canEditCatatan={['admin', 'staff', 'guru', 'pengasuh', 'pengurus_asrama'].includes(userRole)}
          isWaliOrSantri={isWaliOrSantri}
          editCatatan={editCatatan}
          onChangeEditCatatan={setEditCatatan}
          onSaveCatatan={handleSaveRaportCatatan}
          savingCatatan={savingRaportCatatan}
          variant="dashboard"
        />
      )}

      {/* Zoom Photo Modal (Persis Halaman Data Murid) */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm cursor-zoom-out animate-[fadeIn_0.15s_ease-out]"
          onClick={() => setZoomPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex items-center justify-center animate-[zoomIn_0.2s_ease-out]">
            <img src={zoomPhoto} alt="Zoomed Foto Santri" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" />
            <button
              onClick={() => setZoomPhoto(null)}
              className="absolute -top-3 -right-3 bg-white text-black rounded-full w-8 h-8 flex items-center justify-center font-bold hover:scale-110 transition-transform shadow-lg cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Modal Integrasi QuizB */}
      <QuizBModal
        isOpen={showQuizBModal}
        onClose={() => setShowQuizBModal(false)}
        selectedKelas={selectedKelas}
        selectedMapel={selectedMapel}
        semester={semester}
        tahunAjaran={tahunAjaran}
        muridList={muridList}
        userRole={userRole}
        onApplyScores={handleApplyQuizBScores}
      />

      {/* MODAL EDIT & HAPUS NILAI SANTRI (HASIL PERCOBAAN / EVALUASI) */}
      {editModalSantri && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-transparent to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full overflow-hidden relative border border-gray-200 dark:border-gray-700 shadow-2xs shrink-0">
                  {getFotoUrl(editModalSantri.foto) ? (
                    <img
                      src={getFotoUrl(editModalSantri.foto)!}
                      alt={editModalSantri.nama}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: getAvatarColor(editModalSantri.nama) }}
                    >
                      {getInitials(editModalSantri.nama)}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-gray-800 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                    <span>{editModalSantri.nama}</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      NIS: {editModalSantri.nis || '-'}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Kelola &amp; Hapus Nilai • Semester {semester} • TA {tahunAjaran}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalSantri(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Feedback Message */}
            {modalFeedback && (
              <div className={`px-5 py-2.5 text-xs font-bold flex items-center justify-between ${
                modalFeedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800/40'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-b border-rose-200 dark:border-rose-800/40'
              }`}>
                <span>{modalFeedback.message}</span>
                <button type="button" onClick={() => setModalFeedback(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
              </div>
            )}

            {/* Isi Modal (Scrollable) */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {loadingEditModal ? (
                <div className="py-12 text-center text-gray-500">
                  <RefreshCw size={28} className="animate-spin mx-auto text-amber-500 mb-2" />
                  <p className="text-xs font-bold">Memuat rincian nilai santri...</p>
                </div>
              ) : editModalScores.length === 0 ? (
                <div className="py-10 text-center text-gray-500 dark:text-gray-400">
                  <AlertCircle size={32} className="mx-auto text-amber-500 mb-2" />
                  <p className="font-bold text-sm">Belum Ada Nilai Tersimpan</p>
                  <p className="text-xs text-gray-400 mt-1">Santri ini belum memiliki riwayat nilai pada semester {semester} ({tahunAjaran}).</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                      Daftar Mata Pelajaran ({editModalScores.length} Mapel Dinilai):
                    </span>
                    <button
                      type="button"
                      onClick={handleDeleteAllScoresInModal}
                      disabled={savingEditModal}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-2xs"
                    >
                      <Trash2 size={13} />
                      <span>Hapus Semua Nilai Santri Ini</span>
                    </button>
                  </div>

                  {editModalScores.map((score, sIdx) => (
                    <div
                      key={score.id || sIdx}
                      className="p-3.5 bg-gray-50 dark:bg-gray-900/60 rounded-2xl border border-gray-200/80 dark:border-gray-700 space-y-3"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-gray-800 dark:text-gray-100">
                            📚 {score.mata_pelajaran}
                          </span>
                          {score.kitab && (
                            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/40">
                              📖 {score.kitab}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateScoreInModal(score)}
                            disabled={savingEditModal}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-2xs transition-all"
                            title="Simpan perubahan nilai mapel ini"
                          >
                            <Save size={12} />
                            <span>Simpan</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMapelScoreInModal(score)}
                            disabled={savingEditModal}
                            className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/70 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-2xs transition-all"
                            title="Hapus nilai mapel ini"
                          >
                            <Trash2 size={12} />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>

                      {/* Baris Input Nilai */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                        {([
                          { field: 'nilai_harian', label: 'Harian (30%/25%)', placeholder: '0' },
                          { field: 'nilai_lisan', label: 'Lisan (25%)', placeholder: '-' },
                          { field: 'nilai_uts', label: 'UTS (30%/25%)', placeholder: '0' },
                          { field: 'nilai_uas', label: 'UAS (40%/25%)', placeholder: '0' },
                        ] as const).map(({ field, label, placeholder }) => (
                          <div key={field}>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{label}</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              value={score[field] ?? ''}
                              placeholder={placeholder}
                              onChange={(e) => updateEditModalComponent(sIdx, field, e.target.value)}
                              className="w-full text-center py-1.5 px-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                        ))}

                        <div>
                          <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase mb-1">Akhir</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            value={score.nilai_akhir ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditModalScores(prev => prev.map((item, idx) => {
                                if (idx !== sIdx) return item;
                                return {
                                  ...item,
                                  nilai_akhir: val,
                                  predikat: calcPredikatFromInput(val, '-'),
                                };
                              }));
                            }}
                            className="w-full text-center py-1.5 px-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-300 dark:border-amber-700 text-xs font-black text-amber-900 dark:text-amber-200 focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Predikat</label>
                          <input
                            type="text"
                            value={score.predikat || '-'}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase();
                              setEditModalScores(prev => prev.map((item, idx) => idx === sIdx ? { ...item, predikat: val } : item));
                            }}
                            className="w-full text-center py-1.5 px-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-black text-gray-800 dark:text-gray-100"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex items-center justify-between">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                💡 Menghapus nilai di sini akan langsung membersihkan data uji coba dari raport &amp; leger.
              </span>
              <button
                type="button"
                onClick={() => setEditModalSantri(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
