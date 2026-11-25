'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import QuizBModal from '@/app/dashboard/penilaian/QuizBModal';
import {
  Award, BookOpen, GraduationCap, Search, Filter,
  Save, CheckCircle, AlertCircle, RefreshCw, User, Calendar,
  Sparkles, Download, Edit3, ArrowUpDown, ArrowUp, ArrowDown,
  X, Trash2, Check, Clock, Phone, ShieldCheck
} from 'lucide-react';
import Link from 'next/link';

// ====== Avatar & Foto Santri ======
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

function calcPredikat(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  if (score > 0) return 'E';
  return '-';
}

function PenilaianInputContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('t') || '';

  // Auth & Guru Info State
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [guruInfo, setGuruInfo] = useState<any>(null);

  // Filter States
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>('');
  const [kurikulumList, setKurikulumList] = useState<any[]>([]);
  const [selectedMapel, setSelectedMapel] = useState<string>('');
  const [selectedKitab, setSelectedKitab] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [tahunAjaran, setTahunAjaran] = useState<string>('2025/2026');
  const [isCustomMapel, setIsCustomMapel] = useState(false);
  const customMapelInputRef = useRef<HTMLInputElement>(null);

  const isSemuaKelasMode = !selectedKelas || selectedKelas === 'SEMUA' || selectedKelas === 'all';
  const isLegerMode = !selectedMapel || selectedMapel === 'SEMUA' || selectedMapel === 'Semua Mapel';

  // Student list & Scores
  const [muridList, setMuridList] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<number, { harian: string; uts: string; uas: string; akhir: string; predikat: string; catatan: string }>>({});
  const [loadingMurid, setLoadingMurid] = useState(false);
  const [savingScores, setSavingScores] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Search & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // QuizB CBT Modal
  const [showQuizBModal, setShowQuizBModal] = useState(false);

  // Modal Detail & Edit Nilai Satuan (semua mapel santri)
  const [editingMurid, setEditingMurid] = useState<any>(null);
  const [editModalScores, setEditModalScores] = useState<any[]>([]);
  const [loadingEditModal, setLoadingEditModal] = useState(false);
  const [savingEditModal, setSavingEditModal] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Zoom foto
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);

  // Guard unsaved changes saat tutup tab
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // 1. Verifikasi Token & Ambil Info Guru
  useEffect(() => {
    if (!token) {
      setAuthError('Tautan pintasan tidak menyertakan kode token otentikasi. Silakan hubungi bagian akademik/admin.');
      setLoadingAuth(false);
      return;
    }

    const verifyShortcut = async () => {
      setLoadingAuth(true);
      setAuthError(null);
      try {
        const res = await fetch(`/api/penilaian/quick-verify?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          setGuruInfo(d);
          if (d.semester) setSemester(String(d.semester));
          if (d.tahun_ajaran) setTahunAjaran(String(d.tahun_ajaran));

          const classes = d.classes || [];
          const formattedClasses = classes.length > 1
            ? [{ kelas_id: 'SEMUA', nama_kelas: 'Semua Kelas (Seluruh Kelas Diampu)', mapels: [] }, ...classes]
            : classes;
          setKelasList(formattedClasses);

          // Pilih kelas pertama yang memiliki mapel ajar agar guru langsung masuk ke mode input nilai
          const defaultClass = classes.find((c: any) => Array.isArray(c.mapels) && c.mapels.length > 0) || classes[0];
          if (defaultClass) {
            setSelectedKelas(String(defaultClass.kelas_id));
            const firstMapels = defaultClass.mapels || [];
            const fullMapelList = [
              { id: 'SEMUA', mata_pelajaran: 'Semua Mapel', kitab: '' },
              ...firstMapels,
            ];
            setKurikulumList(fullMapelList);
            if (firstMapels.length > 0) {
              setSelectedMapel(firstMapels[0].mata_pelajaran);
              setSelectedKitab(firstMapels[0].kitab || '');
            } else {
              setSelectedMapel('Semua Mapel');
              setSelectedKitab('');
            }
          }
        } else {
          setAuthError(json.error || 'Tautan pintasan ini tidak valid atau masa berlakunya telah habis.');
        }
      } catch (err: any) {
        setAuthError('Kendala jaringan: ' + (err.message || 'Gagal memverifikasi token'));
      } finally {
        setLoadingAuth(false);
      }
    };

    verifyShortcut();
  }, [token]);

  // 2. Ketika kelas berubah, update daftar mapel untuk kelas tersebut
  useEffect(() => {
    if (!selectedKelas || kelasList.length === 0) return;

    if (isSemuaKelasMode) {
      setIsCustomMapel(false);
      setKurikulumList([{ id: 'SEMUA', mata_pelajaran: 'Semua Mapel', kitab: '' }]);
      setSelectedMapel('Semua Mapel');
      setSelectedKitab('');
      return;
    }

    const currentClass = kelasList.find(c => String(c.kelas_id) === String(selectedKelas));
    if (currentClass) {
      const mapels = currentClass.mapels || [];
      setKurikulumList([
        { id: 'SEMUA', mata_pelajaran: 'Semua Mapel', kitab: '' },
        ...mapels,
      ]);
      if (!isCustomMapel) {
        if (mapels.length > 0) {
          setSelectedMapel(mapels[0].mata_pelajaran);
          setSelectedKitab(mapels[0].kitab || '');
        } else {
          setSelectedMapel('Semua Mapel');
          setSelectedKitab('');
        }
      }
    }
  }, [selectedKelas, kelasList, isSemuaKelasMode]);

  // 3. Load Murid & Nilai saat kelas, mapel, semester, atau tahun berubah
  useEffect(() => {
    if (!selectedKelas || !token) return;

    const fetchMurid = async () => {
      setLoadingMurid(true);
      try {
        const query = new URLSearchParams({
          token,
          kelas_id: selectedKelas,
          mapel: selectedMapel || 'Semua Mapel',
          semester,
          tahun_ajaran: tahunAjaran,
        });
        const res = await fetch(`/api/penilaian/data?${query.toString()}`);
        const json = await res.json();
        if (json.success && json.muridList) {
          setMuridList(json.muridList);
          const initialScores: Record<number, any> = {};
          json.muridList.forEach((m: any) => {
            const h = m.nilai_harian !== null && m.nilai_harian !== undefined && m.nilai_harian !== '' ? String(m.nilai_harian) : '';
            const u = m.nilai_uts !== null && m.nilai_uts !== undefined && m.nilai_uts !== '' ? String(m.nilai_uts) : '';
            const a = m.nilai_uas !== null && m.nilai_uas !== undefined && m.nilai_uas !== '' ? String(m.nilai_uas) : '';
            let akh = m.nilai_akhir !== null && m.nilai_akhir !== undefined && m.nilai_akhir !== '' ? String(m.nilai_akhir) : '';
            let pred = m.predikat || '';

            if (!akh && (h || u || a)) {
              const numH = parseFloat(h) || 0;
              const numU = parseFloat(u) || 0;
              const numA = parseFloat(a) || 0;
              const autoFinal = Math.round((numH * 0.3 + numU * 0.3 + numA * 0.4) * 100) / 100;
              akh = String(autoFinal);
              pred = calcPredikat(autoFinal);
            } else if (akh && !pred) {
              pred = calcPredikat(parseFloat(akh));
            }

            initialScores[m.murid_id] = {
              harian: h,
              uts: u,
              uas: a,
              akhir: akh,
              predikat: pred,
              catatan: m.catatan || '',
            };
          });
          setScores(initialScores);
          setIsDirty(false);
        }
      } catch (err) {
        console.error('Error fetching murid for token input:', err);
      } finally {
        setLoadingMurid(false);
      }
    };

    fetchMurid();
  }, [selectedKelas, selectedMapel, semester, tahunAjaran, token, reloadTrigger]);

  // 4. Score Change Handler
  const handleScoreChange = (muridId: number, field: 'harian' | 'uts' | 'uas' | 'akhir' | 'predikat' | 'catatan', val: string) => {
    setIsDirty(true);
    setScores(prev => {
      const existing = prev[muridId] || { harian: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
      const updated = { ...existing, [field]: val };

      if (field === 'harian' || field === 'uts' || field === 'uas') {
        const h = field === 'harian' ? val : existing.harian;
        const u = field === 'uts' ? val : existing.uts;
        const a = field === 'uas' ? val : existing.uas;

        if (h !== '' || u !== '' || a !== '') {
          const numH = parseFloat(h) || 0;
          const numU = parseFloat(u) || 0;
          const numA = parseFloat(a) || 0;
          const autoFinal = Math.round((numH * 0.3 + numU * 0.3 + numA * 0.4) * 100) / 100;
          updated.akhir = String(autoFinal);
          updated.predikat = calcPredikat(autoFinal);
        } else {
          updated.akhir = '';
          updated.predikat = '';
        }
      }

      if (field === 'akhir') {
        if (val !== '') {
          const numAkhir = parseFloat(val) || 0;
          updated.predikat = calcPredikat(numAkhir);
        } else {
          updated.predikat = '';
        }
      }

      return { ...prev, [muridId]: updated };
    });
  };

  // 5. Terapkan Skor dari QuizB / CBT
  const handleApplyQuizBScores = (appliedList: Array<{ murid_id: number; skor: number; targetField: 'harian' | 'uts' | 'uas'; quizTitle: string }>) => {
    setIsDirty(true);
    setScores(prev => {
      const next = { ...prev };
      for (const item of appliedList) {
        const existing = next[item.murid_id] || { harian: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
        const updated = { ...existing, [item.targetField]: String(item.skor) };
        const numH = parseFloat(updated.harian) || 0;
        const numU = parseFloat(updated.uts) || 0;
        const numA = parseFloat(updated.uas) || 0;
        const autoFinal = Math.round((numH * 0.3 + numU * 0.3 + numA * 0.4) * 100) / 100;
        updated.akhir = String(autoFinal);
        updated.predikat = calcPredikat(autoFinal);
        next[item.murid_id] = updated;
      }
      return next;
    });
    setSaveSuccessMsg(`Berhasil menarik ${appliedList.length} nilai CBT! Klik "Simpan Semua Nilai" untuk menyimpan ke database.`);
    setTimeout(() => setSaveSuccessMsg(''), 7000);
  };

  // 6. Simpan Semua Nilai
  const handleSaveScores = async () => {
    if (!selectedKelas || isLegerMode) {
      alert('Silakan pilih kelas dan mata pelajaran spesifik terlebih dahulu.');
      return;
    }

    setSavingScores(true);
    setSaveSuccessMsg('');
    try {
      const payloadScores = muridList.map(m => {
        const s = scores[m.murid_id] || { harian: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
        return {
          murid_id: m.murid_id,
          kelas_madin_id: m.kelas_madin_id,
          nilai_harian: s.harian !== '' ? s.harian : null,
          nilai_uts: s.uts !== '' ? s.uts : null,
          nilai_uas: s.uas !== '' ? s.uas : null,
          nilai_akhir: s.akhir !== '' ? s.akhir : null,
          predikat: s.predikat || null,
          catatan: s.catatan || '',
        };
      });

      const res = await fetch('/api/penilaian/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-token': token },
        body: JSON.stringify({
          token,
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
        setSaveSuccessMsg(json.message || 'Alhamdulillah, semua nilai berhasil disimpan ke sistem pesantren!');
        setIsDirty(false);
        if (editingMurid) {
          await handleOpenEditModal(editingMurid, true);
          setModalFeedback({ type: 'success', message: json.message || 'Nilai berhasil disimpan!' });
        }
        setTimeout(() => setSaveSuccessMsg(''), 6000);
      } else {
        alert(json.error || 'Gagal menyimpan nilai. Silakan coba kembali.');
      }
    } catch (err: any) {
      alert('Kendala jaringan saat menyimpan: ' + err.message);
    } finally {
      setSavingScores(false);
    }
  };

  // 7. Modal Edit Per-Santri (semua mapel santri tsb)
  const handleOpenEditModal = async (santri: any, preserveFeedback = false) => {
    setEditingMurid(santri);
    setLoadingEditModal(true);
    if (!preserveFeedback) setModalFeedback(null);
    try {
      const res = await fetch(
        `/api/penilaian/raport?murid_id=${santri.murid_id}&semester=${semester}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}&token=${encodeURIComponent(token)}`
      );
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

  const handleUpdateScoreInModal = async (scoreItem: any) => {
    if (!editingMurid) return;
    try {
      setSavingEditModal(true);
      const harian = scoreItem.nilai_harian !== null && scoreItem.nilai_harian !== '' ? Number(scoreItem.nilai_harian) : null;
      const uts = scoreItem.nilai_uts !== null && scoreItem.nilai_uts !== '' ? Number(scoreItem.nilai_uts) : null;
      const uas = scoreItem.nilai_uas !== null && scoreItem.nilai_uas !== '' ? Number(scoreItem.nilai_uas) : null;
      const akhir = scoreItem.nilai_akhir !== null && scoreItem.nilai_akhir !== '' ? Number(scoreItem.nilai_akhir) : null;

      const res = await fetch('/api/penilaian/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-token': token },
        body: JSON.stringify({
          token,
          kelas_id: editingMurid.kelas_madin_id || selectedKelas || 'SEMUA',
          mata_pelajaran: scoreItem.mata_pelajaran,
          semester,
          tahun_ajaran: tahunAjaran,
          scores: [
            {
              murid_id: editingMurid.murid_id,
              kelas_madin_id: editingMurid.kelas_madin_id,
              nilai_harian: harian,
              nilai_uts: uts,
              nilai_uas: uas,
              nilai_akhir: akhir,
              predikat: scoreItem.predikat,
              catatan: scoreItem.catatan,
            },
          ],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setModalFeedback({ type: 'success', message: `Nilai ${scoreItem.mata_pelajaran} berhasil disimpan.` });
        setReloadTrigger(prev => prev + 1);
      } else {
        setModalFeedback({ type: 'error', message: data.error || 'Gagal menyimpan nilai' });
      }
    } catch (err: any) {
      setModalFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingEditModal(false);
    }
  };

  const handleDeleteMapelScoreInModal = async (scoreItem: any) => {
    if (!editingMurid) return;
    if (!window.confirm(`Hapus nilai mata pelajaran "${scoreItem.mata_pelajaran}" untuk ${editingMurid.nama}?`)) return;
    try {
      setSavingEditModal(true);
      const url = `/api/penilaian/save?id=${scoreItem.id}&murid_id=${editingMurid.murid_id}&mapel=${encodeURIComponent(scoreItem.mata_pelajaran)}&semester=${semester}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}&token=${encodeURIComponent(token)}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setEditModalScores(prev => prev.filter(item => item.id !== scoreItem.id));
        setModalFeedback({ type: 'success', message: `Nilai ${scoreItem.mata_pelajaran} berhasil dihapus.` });
        setReloadTrigger(prev => prev + 1);
      } else {
        setModalFeedback({ type: 'error', message: data.error || 'Gagal menghapus nilai' });
      }
    } catch (err: any) {
      setModalFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingEditModal(false);
    }
  };

  // 8. Ekspor Leger / Nilai ke Excel
  const handleExportExcel = () => {
    if (muridList.length === 0) return;
    const kelasObj = kelasList.find(k => String(k.kelas_id) === String(selectedKelas));
    const kelasNama = kelasObj?.nama_kelas || 'Kelas_Madin';
    const rows = filteredAndSortedMurid.map((m, idx) => {
      const s = scores[m.murid_id] || { harian: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
      return {
        No: idx + 1,
        'Nama Santri': m.nama,
        NIS: m.nis || '-',
        Kelas: m.nama_kelas || kelasNama,
        Kamar: m.nama_kamar || '-',
        'Kehadiran (%)': m.kehadiran_persen ?? 100,
        'Harian (30%)': s.harian || 0,
        'UTS (30%)': s.uts || 0,
        'UAS (40%)': s.uas || 0,
        'Nilai Akhir': s.akhir || 0,
        Predikat: s.predikat || '-',
        Catatan: s.catatan || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nilai Santri');
    const safeMapel = (selectedMapel || 'Leger').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeKelas = kelasNama.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `Nilai_${safeKelas}_${safeMapel}_Sem${semester}.xlsx`);
  };

  // 9. Filter & Sorting Santri
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown size={10} className="opacity-40" />;
    return sortOrder === 'asc' ? <ArrowUp size={10} className="text-amber-400" /> : <ArrowDown size={10} className="text-amber-400" />;
  };

  const filteredAndSortedMurid = useMemo(() => {
    let result = [...muridList];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(m => {
        const s = scores[m.murid_id] || {};
        return (
          (m.nama || '').toLowerCase().includes(q) ||
          (m.nis || '').toLowerCase().includes(q) ||
          (m.nama_kelas || '').toLowerCase().includes(q) ||
          (m.alamat || '').toLowerCase().includes(q) ||
          (m.nama_kamar || '').toLowerCase().includes(q) ||
          (s.harian || '').includes(q) ||
          (s.uts || '').includes(q) ||
          (s.uas || '').includes(q) ||
          (s.akhir || '').includes(q) ||
          (s.predikat || '').toLowerCase().includes(q)
        );
      });
    }

    if (sortField !== 'no') {
      result.sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (sortField === 'kehadiran') {
          valA = Number(a.kehadiran_persen ?? 100);
          valB = Number(b.kehadiran_persen ?? 100);
        } else if (['harian', 'uts', 'uas', 'akhir', 'predikat', 'catatan'].includes(sortField)) {
          valA = scores[a.murid_id]?.[sortField as keyof typeof scores[number]] || '';
          valB = scores[b.murid_id]?.[sortField as keyof typeof scores[number]] || '';
          if (['harian', 'uts', 'uas', 'akhir'].includes(sortField)) {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
          }
        }

        if (typeof valA === 'string') {
          const cmp = valA.localeCompare(String(valB), 'id');
          return sortOrder === 'asc' ? cmp : -cmp;
        }
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
    } else if (sortOrder === 'desc') {
      result.reverse();
    }

    return result;
  }, [muridList, scores, searchQuery, sortField, sortOrder]);

  // Statistik nilai terisi
  const stats = useMemo(() => {
    const total = muridList.length;
    let terisi = 0;
    muridList.forEach(m => {
      const s = scores[m.murid_id];
      if (s && (s.harian !== '' || s.uts !== '' || s.uas !== '' || s.akhir !== '')) {
        terisi++;
      }
    });
    const persen = total > 0 ? Math.round((terisi / total) * 100) : 0;
    return { total, terisi, persen };
  }, [muridList, scores]);

  const totalMapelDiampu = useMemo(() => {
    return (guruInfo?.classes || []).reduce((acc: number, c: any) => acc + (c.mapels?.length || 0), 0);
  }, [guruInfo]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#070d1e] text-white flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
          <RefreshCw size={30} className="animate-spin text-amber-400" />
        </div>
        <p className="text-base font-bold text-gray-200">Memverifikasi Tautan Pintasan Input Nilai...</p>
        <p className="text-xs text-gray-400 mt-1">Sistem Penilaian PP. Matholi&apos;ul Anwar</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-[#070d1e] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-red-400 mb-2">Tautan Tidak Dapat Diakses</h2>
        <p className="text-sm text-gray-300 max-w-md mb-6">{authError}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/dashboard/penilaian"
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all shadow-md"
          >
            Masuk Lewat Halaman Login
          </Link>
          <a
            href="https://wa.me/628133129223"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs border border-gray-700 transition-all flex items-center justify-center gap-1.5"
          >
            <Phone size={14} className="text-emerald-400" /> Hubungi Admin Pesantren
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080f21] text-gray-100 flex flex-col font-sans pb-24 selection:bg-amber-500 selection:text-white">
      {/* Top Navbar Header */}
      <header className="sticky top-0 z-40 bg-[#0c162e]/95 backdrop-blur-md border-b border-gray-800 px-4 sm:px-8 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-md shadow-amber-600/20 text-white font-serif font-black text-base">
            م
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-extrabold tracking-wide text-white uppercase flex items-center gap-2">
              <span>PP. Matholi&apos;ul Anwar</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold lowercase">
                input &amp; leger nilai
              </span>
            </h1>
            <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium">
              Penilaian &amp; Raport Digital — Pintasan Pengajar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
              <Clock size={11} /> Belum Disimpan
            </span>
          )}
          {!isLegerMode && (
            <button
              type="button"
              onClick={handleSaveScores}
              disabled={savingScores || muridList.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-md shadow-amber-500/25 transition-all active:scale-95 disabled:opacity-50"
            >
              {savingScores ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{savingScores ? 'Menyimpan...' : 'Simpan Nilai'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-4">

        {/* Hero & Banner Profil Guru (Paduan Foto 1 & Foto 4) */}
        <section className="bg-gradient-to-r from-[#853f06] via-[#5c2c09] to-[#0d1b3e] border border-amber-500/30 rounded-2xl p-4 sm:p-6 shadow-xl shadow-black/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-amber-400/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-extrabold text-white text-lg shadow-md shrink-0 border border-white/20"
                style={{ backgroundColor: getAvatarColor(guruInfo?.nama || 'Guru') }}
              >
                {getInitials(guruInfo?.nama || 'Guru')}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-amber-500/25 text-amber-200 border border-amber-400/40 inline-flex items-center gap-1">
                    <ShieldCheck size={11} /> Dokumen Resmi Penilaian
                  </span>
                  <span className="text-[10px] text-amber-100/80 font-mono">
                    NIP: {guruInfo?.nip || '-'}
                  </span>
                  {guruInfo?.exp_date_formatted && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-black/25 text-amber-200 border border-white/10 inline-flex items-center gap-1">
                      <Calendar size={10} /> Tautan berlaku s/d: {guruInfo.exp_date_formatted}
                    </span>
                  )}
                </div>
                <h2 className="text-base sm:text-xl font-black text-white leading-tight">
                  {guruInfo?.nama || 'Ustadz / Ustadzah'}
                </h2>
                <p className="text-xs text-amber-100/90 flex items-center gap-2 flex-wrap">
                  <span>Pengajar {totalMapelDiampu || (guruInfo?.classes?.length || 0)} Mapel / {(guruInfo?.classes?.length || 0)} Kelas Madin</span>
                  {guruInfo?.no_hp && (
                    <>
                      <span className="opacity-50">•</span>
                      <span>WA: {guruInfo.no_hp}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-white/15 gap-2">
              <div className="text-left lg:text-right">
                <span className="text-[10px] text-amber-200/80 uppercase font-bold block">
                  {isLegerMode ? 'Santri pada Leger Kelas' : 'Progres Pengisian Mapel Ini'}
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-white">
                  {stats.terisi} dari {stats.total} Santri ({stats.persen}%)
                </span>
              </div>
              <div className="w-28 sm:w-40 h-2.5 bg-black/30 rounded-full overflow-hidden border border-white/15">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500 rounded-full"
                  style={{ width: `${stats.persen}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Notifikasi Sukses Simpan */}
        {saveSuccessMsg && (
          <div className="bg-emerald-950/50 border border-emerald-500/50 rounded-2xl p-4 flex items-center gap-3 text-emerald-300 text-xs sm:text-sm animate-[fadeIn_0.3s_ease-out] shadow-lg">
            <CheckCircle size={20} className="shrink-0 text-emerald-400" />
            <p className="font-bold flex-1">{saveSuccessMsg}</p>
            <button
              type="button"
              onClick={() => setSaveSuccessMsg('')}
              className="text-emerald-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Filter Kelas, Mapel, Semester, Tahun Ajaran (Persis Foto 1) */}
        <section className="bg-[#0b1429] border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <Filter size={13} />
              <span>Filter Kelas &amp; Mata Pelajaran</span>
            </div>
            {!isSemuaKelasMode && (
              <button
                type="button"
                onClick={() => {
                  const nextCustom = !isCustomMapel;
                  setIsCustomMapel(nextCustom);
                  if (nextCustom) {
                    setSelectedMapel('');
                    setSelectedKitab('');
                    setTimeout(() => customMapelInputRef.current?.focus(), 100);
                  } else if (kurikulumList.length > 0) {
                    const firstSpecific = kurikulumList.find(k => k.id !== 'SEMUA') || kurikulumList[0];
                    setSelectedMapel(firstSpecific.mata_pelajaran);
                    setSelectedKitab(firstSpecific.kitab || '');
                  }
                }}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30 flex items-center gap-1 transition-all"
              >
                <Edit3 size={12} />
                <span>{isCustomMapel ? 'Pilih Mapel dari Jadwal' : 'Ketik Mapel Khusus'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Kelas Madin */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1">Kelas Madin</label>
              <select
                value={selectedKelas}
                onChange={e => setSelectedKelas(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-xs sm:text-sm font-semibold text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
              >
                {kelasList.map(k => (
                  <option key={k.kelas_id} value={String(k.kelas_id)}>
                    {k.nama_kelas}
                  </option>
                ))}
              </select>
            </div>

            {/* Mata Pelajaran */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1">
                Mata Pelajaran {selectedKitab ? `(${selectedKitab})` : ''}
              </label>
              {isCustomMapel ? (
                <div className="space-y-1.5">
                  <input
                    ref={customMapelInputRef}
                    type="text"
                    value={selectedMapel}
                    onChange={e => setSelectedMapel(e.target.value)}
                    placeholder="Nama Pelajaran / Fan (misal: Imla')"
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-amber-500/50 text-xs sm:text-sm font-semibold text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                  />
                  <input
                    type="text"
                    value={selectedKitab}
                    onChange={e => setSelectedKitab(e.target.value)}
                    placeholder="Nama Kitab / Rujukan (Opsional)"
                    className="w-full px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-700 text-xs font-semibold text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                  />
                </div>
              ) : (
                <select
                  value={selectedMapel}
                  onChange={e => {
                    setSelectedMapel(e.target.value);
                    const found = kurikulumList.find(m => m.mata_pelajaran === e.target.value);
                    if (found) setSelectedKitab(found.kitab || '');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-xs sm:text-sm font-semibold text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                >
                  {kurikulumList.length === 0 ? (
                    <option value="Semua Mapel">Semua Mapel (Mode Leger)</option>
                  ) : (
                    kurikulumList.map((m, idx) => (
                      <option key={idx} value={m.mata_pelajaran}>
                        {m.mata_pelajaran} {m.kitab ? `— ${m.kitab}` : ''}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>

            {/* Semester */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1">Semester</label>
              <select
                value={semester}
                onChange={e => setSemester(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-xs sm:text-sm font-semibold text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
              >
                <option value="1">Semester 1 (Ganjil)</option>
                <option value="2">Semester 2 (Genap)</option>
              </select>
            </div>

            {/* Tahun Ajaran */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1">Tahun Ajaran</label>
              <select
                value={tahunAjaran}
                onChange={e => setTahunAjaran(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-xs sm:text-sm font-semibold text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
              >
                <option value="2024/2025">2024/2025</option>
                <option value="2025/2026">2025/2026</option>
                <option value="2026/2027">2026/2027</option>
              </select>
            </div>
          </div>
        </section>

        {/* Section Heading & Actions (Persis Foto 1) */}
        <section className="bg-[#0b1429] border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2 flex-wrap">
                <span>
                  {isLegerMode
                    ? 'Daftar Santri — Semua Mata Pelajaran'
                    : `Daftar Santri — ${selectedMapel || 'Mata Pelajaran'}`}
                </span>
                {selectedKitab && !isLegerMode && (
                  <span className="text-xs sm:text-sm font-semibold text-amber-400">
                    ({selectedKitab})
                  </span>
                )}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                  {filteredAndSortedMurid.length} Santri
                </span>
                {isLegerMode && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold inline-flex items-center gap-1">
                    <Sparkles size={10} /> Leger Kolektif
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {isLegerMode
                  ? 'Mode Leger Kolektif: Menampilkan rata-rata akumulasi nilai santri & presensi dari seluruh mata pelajaran kelas ini.'
                  : 'Kalkulasi otomatis: Harian (30%) + UTS (30%) + UAS (40%). Nilai Akhir & Predikat fleksibel dapat diubah manual.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowQuizBModal(true)}
                disabled={muridList.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
                title="Tarik nilai hasil ujian CBT santri dari Portal Ujian ke buku nilai"
              >
                <span>📥 Tarik Nilai Ujian CBT</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={muridList.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-all active:scale-95 disabled:opacity-50"
                title="Unduh daftar nilai ini dalam format Excel (.xlsx)"
              >
                <Download size={14} className="text-amber-400" />
                <span>Ekspor Excel</span>
              </button>

              {isLegerMode ? (
                <div className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                  <Sparkles size={13} />
                  <span>Pilih mapel spesifik untuk input nilai</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveScores}
                  disabled={savingScores || muridList.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  {savingScores ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Simpan Semua Nilai</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari santri, NIS, kelas, kamar, alamat, nilai..."
              className="w-full pl-10 pr-8 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-xs sm:text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Konten Tabel (Desktop) & Kartu Input Sentuh (Mobile) */}
          {loadingMurid ? (
            <div className="py-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
              <RefreshCw size={24} className="animate-spin text-amber-500" />
              <p className="text-xs font-bold">Memuat daftar santri &amp; nilai...</p>
            </div>
          ) : filteredAndSortedMurid.length === 0 ? (
            <div className="py-12 text-center text-gray-400 border border-dashed border-gray-800 rounded-xl">
              <User size={32} className="mx-auto mb-2 text-gray-600" />
              <p className="text-xs font-bold text-gray-300">Tidak ada santri ditemukan pada filter ini</p>
              <p className="text-[11px] text-gray-500 mt-1">Pastikan kelas madin dan mata pelajaran yang dipilih sesuai jadwal</p>
            </div>
          ) : (
            <>
              {/* Mobile Quick Sort Bar */}
              <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-[10px] font-bold text-gray-400 shrink-0">Urut:</span>
                {[
                  { id: 'no', label: 'No' },
                  { id: 'nama', label: 'Nama' },
                  { id: 'akhir', label: 'Nilai Akhir' },
                  { id: 'kehadiran', label: 'Kehadiran' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSort(opt.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border shrink-0 flex items-center gap-1 ${
                      sortField === opt.id
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-gray-900 border-gray-700 text-gray-400'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {renderSortIcon(opt.id)}
                  </button>
                ))}
              </div>

              {/* Mobile Touch-Friendly Card View */}
              <div className="md:hidden space-y-3">
                {filteredAndSortedMurid.map((m, idx) => {
                  const s = scores[m.murid_id] || { harian: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
                  const fotoUrl = getFotoUrl(m.foto);

                  return (
                    <div
                      key={m.murid_id}
                      className="p-3.5 rounded-2xl bg-gray-900/90 border border-gray-800 space-y-3"
                    >
                      {/* Santri Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[10px] font-mono text-gray-500 w-5 text-center shrink-0">
                            {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => fotoUrl && setZoomPhoto(fotoUrl)}
                            className="relative w-10 h-10 rounded-xl overflow-hidden bg-gray-800 border border-gray-700 shrink-0"
                          >
                            <div
                              className="w-full h-full flex items-center justify-center text-xs font-black text-white"
                              style={{ backgroundColor: getAvatarColor(m.nama) }}
                            >
                              {getInitials(m.nama)}
                            </div>
                            {fotoUrl && (
                              <img
                                src={fotoUrl}
                                alt={m.nama}
                                className="absolute inset-0 w-full h-full object-cover"
                                onError={(e: any) => { e.target.style.display = 'none'; }}
                              />
                            )}
                          </button>
                          <div className="min-w-0">
                            <div className="font-extrabold text-white text-xs truncate">{m.nama}</div>
                            <div className="text-[10px] text-gray-400 flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono">NIS: {m.nis || '-'}</span>
                              <span>•</span>
                              <span className={m.kehadiran_persen >= 85 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                                Hadir {m.kehadiran_persen ?? 100}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(m)}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 flex items-center gap-1"
                        >
                          <Edit3 size={11} /> Detail
                        </button>
                      </div>

                      {/* Score Inputs */}
                      <div className="grid grid-cols-5 gap-1.5 pt-1">
                        <div>
                          <label className="block text-[9px] text-center text-gray-400 mb-0.5">Harian</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            disabled={isLegerMode}
                            value={s.harian}
                            onChange={e => handleScoreChange(m.murid_id, 'harian', e.target.value)}
                            className="w-full py-2 text-center text-xs font-bold rounded-lg bg-gray-950 border border-gray-700 text-white disabled:opacity-60"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-center text-gray-400 mb-0.5">UTS</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            disabled={isLegerMode}
                            value={s.uts}
                            onChange={e => handleScoreChange(m.murid_id, 'uts', e.target.value)}
                            className="w-full py-2 text-center text-xs font-bold rounded-lg bg-gray-950 border border-gray-700 text-white disabled:opacity-60"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-center text-gray-400 mb-0.5">UAS</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            disabled={isLegerMode}
                            value={s.uas}
                            onChange={e => handleScoreChange(m.murid_id, 'uas', e.target.value)}
                            className="w-full py-2 text-center text-xs font-bold rounded-lg bg-gray-950 border border-gray-700 text-white disabled:opacity-60"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-center text-amber-400 font-bold mb-0.5">Akhir</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            disabled={isLegerMode}
                            value={s.akhir}
                            onChange={e => handleScoreChange(m.murid_id, 'akhir', e.target.value)}
                            className="w-full py-2 text-center text-xs font-black rounded-lg bg-amber-950/30 border border-amber-500 text-amber-300 disabled:opacity-60"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-center text-gray-400 mb-0.5">Pred</label>
                          <select
                            disabled={isLegerMode}
                            value={s.predikat}
                            onChange={e => handleScoreChange(m.murid_id, 'predikat', e.target.value)}
                            className="w-full py-2 text-center text-xs font-bold rounded-lg bg-gray-950 border border-gray-700 text-white disabled:opacity-60"
                          >
                            <option value="">-</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                            <option value="E">E</option>
                          </select>
                        </div>
                      </div>

                      <input
                        type="text"
                        disabled={isLegerMode}
                        value={s.catatan}
                        onChange={e => handleScoreChange(m.murid_id, 'catatan', e.target.value)}
                        placeholder={isLegerMode ? 'Ringkasan leger...' : 'Catatan kemajuan santri...'}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-gray-950 border border-gray-800 text-gray-300 placeholder:text-gray-600 disabled:opacity-60"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (Persis Foto 1) */}
              <div className="hidden md:block overflow-x-auto border border-gray-800 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#0e1933] text-gray-300 font-extrabold uppercase text-[10px] tracking-wider border-b border-gray-800">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">
                        <button type="button" onClick={() => handleSort('no')} className="inline-flex items-center gap-1 hover:text-amber-400">
                          <span>No</span> {renderSortIcon('no')}
                        </button>
                      </th>
                      <th className="py-3 px-2 w-12 text-center">Foto</th>
                      <th className="py-3 px-3 min-w-[180px]">
                        <button type="button" onClick={() => handleSort('nama')} className="flex items-center gap-1 hover:text-amber-400">
                          <span>Nama Santri</span> {renderSortIcon('nama')}
                        </button>
                      </th>
                      <th className="py-3 px-3 w-24">
                        <button type="button" onClick={() => handleSort('nis')} className="flex items-center gap-1 hover:text-amber-400">
                          <span>NIS</span> {renderSortIcon('nis')}
                        </button>
                      </th>
                      <th className="py-3 px-3 text-center min-w-[90px]">
                        <button type="button" onClick={() => handleSort('kehadiran')} className="inline-flex flex-col items-center hover:text-amber-400">
                          <span className="flex items-center gap-1">Kehadiran {renderSortIcon('kehadiran')}</span>
                          <span className="text-[9px] text-gray-400 font-normal lowercase">(presensi)</span>
                        </button>
                      </th>
                      <th className="py-3 px-2 text-center w-20">
                        <button type="button" onClick={() => handleSort('harian')} className="inline-flex flex-col items-center hover:text-amber-400">
                          <span className="flex items-center gap-1">Harian {renderSortIcon('harian')}</span>
                          <span className="text-[9px] text-amber-400 font-normal">(30%)</span>
                        </button>
                      </th>
                      <th className="py-3 px-2 text-center w-20">
                        <button type="button" onClick={() => handleSort('uts')} className="inline-flex flex-col items-center hover:text-amber-400">
                          <span className="flex items-center gap-1">UTS {renderSortIcon('uts')}</span>
                          <span className="text-[9px] text-amber-400 font-normal">(30%)</span>
                        </button>
                      </th>
                      <th className="py-3 px-2 text-center w-20">
                        <button type="button" onClick={() => handleSort('uas')} className="inline-flex flex-col items-center hover:text-amber-400">
                          <span className="flex items-center gap-1">UAS {renderSortIcon('uas')}</span>
                          <span className="text-[9px] text-amber-400 font-normal">(40%)</span>
                        </button>
                      </th>
                      <th className="py-3 px-2 text-center w-24 bg-amber-500/10 border-x border-amber-500/20 text-amber-300 font-black">
                        <button type="button" onClick={() => handleSort('akhir')} className="inline-flex items-center gap-1 hover:text-amber-200">
                          <span>Nilai Akhir</span> {renderSortIcon('akhir')}
                        </button>
                      </th>
                      <th className="py-3 px-2 text-center w-16">
                        <button type="button" onClick={() => handleSort('predikat')} className="inline-flex items-center gap-1 hover:text-amber-400">
                          <span>Predikat</span> {renderSortIcon('predikat')}
                        </button>
                      </th>
                      <th className="py-3 px-3 min-w-[140px]">Catatan Perkembangan</th>
                      <th className="py-3 px-2 text-center w-14">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/80">
                    {filteredAndSortedMurid.map((m, idx) => {
                      const s = scores[m.murid_id] || { harian: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
                      const fotoUrl = getFotoUrl(m.foto);

                      return (
                        <tr
                          key={m.murid_id}
                          className="hover:bg-gray-800/40 transition-colors group"
                        >
                          {/* No */}
                          <td className="py-3 px-3 text-center text-gray-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Foto */}
                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => fotoUrl && setZoomPhoto(fotoUrl)}
                              className="inline-block relative w-9 h-9 rounded-xl overflow-hidden bg-gray-800 border border-gray-700/60 transition-transform active:scale-95"
                            >
                              <div
                                className="w-full h-full flex items-center justify-center text-[10px] font-black text-white"
                                style={{ backgroundColor: getAvatarColor(m.nama) }}
                              >
                                {getInitials(m.nama)}
                              </div>
                              {fotoUrl && (
                                <img
                                  src={fotoUrl}
                                  alt={m.nama}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  onError={(e: any) => { e.target.style.display = 'none'; }}
                                />
                              )}
                            </button>
                          </td>

                          {/* Nama Santri & Detail */}
                          <td className="py-3 px-3">
                            <div className="font-extrabold text-white text-xs group-hover:text-amber-300 transition-colors">
                              {m.nama}
                            </div>
                            <div className="text-[10px] text-gray-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                              {m.nama_kelas && (
                                <span className="px-1.5 py-0.2 rounded bg-gray-800 text-gray-300 border border-gray-700">
                                  {m.nama_kelas}
                                </span>
                              )}
                              {m.nama_kamar && (
                                <span className="text-gray-400">
                                  Kamar: {m.nama_kamar}
                                </span>
                              )}
                            </div>
                            {m.alamat && (
                              <p className="text-[9px] text-gray-500 line-clamp-1 mt-0.5">
                                {m.alamat}
                              </p>
                            )}
                          </td>

                          {/* NIS */}
                          <td className="py-3 px-3 font-mono text-[11px] text-gray-300">
                            {m.nis || '-'}
                          </td>

                          {/* Kehadiran */}
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              (m.kehadiran_persen ?? 100) >= 85
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : (m.kehadiran_persen ?? 100) >= 70
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              {m.kehadiran_persen ?? 100}%
                            </span>
                          </td>

                          {/* Harian (30%) */}
                          <td className="py-2 px-1 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              disabled={isLegerMode}
                              value={s.harian}
                              onChange={e => handleScoreChange(m.murid_id, 'harian', e.target.value)}
                              className="w-16 px-1.5 py-1.5 text-center text-xs font-bold rounded-lg bg-gray-900/90 border border-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
                              placeholder="0"
                            />
                          </td>

                          {/* UTS (30%) */}
                          <td className="py-2 px-1 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              disabled={isLegerMode}
                              value={s.uts}
                              onChange={e => handleScoreChange(m.murid_id, 'uts', e.target.value)}
                              className="w-16 px-1.5 py-1.5 text-center text-xs font-bold rounded-lg bg-gray-900/90 border border-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
                              placeholder="0"
                            />
                          </td>

                          {/* UAS (40%) */}
                          <td className="py-2 px-1 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              disabled={isLegerMode}
                              value={s.uas}
                              onChange={e => handleScoreChange(m.murid_id, 'uas', e.target.value)}
                              className="w-16 px-1.5 py-1.5 text-center text-xs font-bold rounded-lg bg-gray-900/90 border border-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
                              placeholder="0"
                            />
                          </td>

                          {/* Nilai Akhir */}
                          <td className="py-2 px-1 text-center bg-amber-500/5 border-x border-amber-500/20">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              disabled={isLegerMode}
                              value={s.akhir}
                              onChange={e => handleScoreChange(m.murid_id, 'akhir', e.target.value)}
                              className="w-18 px-1.5 py-1.5 text-center text-xs font-black rounded-lg bg-gray-950 border border-amber-500 text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-inner disabled:opacity-60"
                              placeholder="0"
                            />
                          </td>

                          {/* Predikat */}
                          <td className="py-2 px-1 text-center">
                            <select
                              disabled={isLegerMode}
                              value={s.predikat}
                              onChange={e => handleScoreChange(m.murid_id, 'predikat', e.target.value)}
                              className="px-1.5 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs font-bold text-center text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
                            >
                              <option value="">-</option>
                              <option value="A">A</option>
                              <option value="B">B</option>
                              <option value="C">C</option>
                              <option value="D">D</option>
                              <option value="E">E</option>
                            </select>
                          </td>

                          {/* Catatan Perkembangan */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              disabled={isLegerMode}
                              value={s.catatan}
                              onChange={e => handleScoreChange(m.murid_id, 'catatan', e.target.value)}
                              placeholder="Catatan kemajuan..."
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-gray-900 border border-gray-700 text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
                            />
                          </td>

                          {/* Aksi Edit */}
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(m)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all active:scale-95"
                            >
                              <Edit3 size={11} />
                              <span>Edit</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* Petunjuk Pengisian */}
        <section className="bg-amber-950/20 border border-amber-900/30 rounded-2xl p-4 text-xs text-gray-400 space-y-1.5">
          <p className="font-bold text-amber-400 flex items-center gap-1.5">
            <Sparkles size={14} /> Tips Pengisian Nilai untuk Dewan Guru:
          </p>
          <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-gray-400">
            <li>Ketik nilai pada kolom <b>Harian, UTS, atau UAS</b>, sistem akan menghitung Nilai Akhir secara otomatis (bobot 30% Harian + 30% UTS + 40% UAS).</li>
            <li>Jika ingin melihat akumulasi rata-rata seluruh mapel di kelas, pilih <b>&quot;Semua Mapel&quot;</b> pada filter Mata Pelajaran untuk Mode Leger Kolektif.</li>
            <li>Jangan lupa menekan tombol <b>&quot;Simpan Semua Nilai&quot;</b> setelah selesai menginput nilai.</li>
          </ul>
        </section>
      </main>

      {/* Floating Bottom Bar on Mobile */}
      {!isLegerMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c162e]/95 backdrop-blur-md border-t border-gray-800 p-3 sm:hidden flex items-center justify-between shadow-2xl">
          <div>
            <span className="text-[10px] text-gray-400 block">Progres Nilai:</span>
            <span className="text-xs font-bold text-amber-400">{stats.terisi} / {stats.total} Santri</span>
          </div>
          <button
            type="button"
            onClick={handleSaveScores}
            disabled={savingScores || muridList.length === 0}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/30 active:scale-95 disabled:opacity-50"
          >
            {savingScores ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{savingScores ? 'Menyimpan...' : 'Simpan Semua'}</span>
          </button>
        </div>
      )}

      {/* Modal QuizB / Tarik Nilai Ujian CBT */}
      <QuizBModal
        isOpen={showQuizBModal}
        onClose={() => setShowQuizBModal(false)}
        selectedKelas={selectedKelas}
        selectedMapel={selectedMapel}
        semester={semester}
        tahunAjaran={tahunAjaran}
        muridList={muridList}
        userRole="guru"
        quickToken={token}
        onApplyScores={handleApplyQuizBScores}
      />

      {/* Modal Zoom Foto */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setZoomPhoto(null)}
        >
          <div className="relative max-w-sm w-full bg-gray-900 border border-gray-700 rounded-3xl overflow-hidden p-2 shadow-2xl">
            <img src={zoomPhoto} alt="Foto Santri" className="w-full h-auto rounded-2xl object-cover" />
            <button
              type="button"
              onClick={() => setZoomPhoto(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Edit & Rincian Seluruh Nilai Santri */}
      {editingMurid && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#0e1933] border border-gray-700 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl relative text-gray-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 bg-[#0b1429]">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                  <Edit3 size={16} className="text-amber-400" />
                  <span>Kelola Nilai — {editingMurid.nama}</span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  NIS: {editingMurid.nis || '-'} • Semester {semester} ({tahunAjaran})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMurid(null)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {modalFeedback && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                  modalFeedback.type === 'success'
                    ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/50 border-red-500/40 text-red-300'
                }`}>
                  {modalFeedback.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                  <span>{modalFeedback.message}</span>
                </div>
              )}

              {/* Quick Edit Mapel Aktif */}
              {!isLegerMode && selectedMapel && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-amber-300">
                      Input Cepat Mapel Aktif: {selectedMapel}
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveScores}
                      disabled={savingScores}
                      className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] flex items-center gap-1"
                    >
                      <Save size={12} /> Simpan
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Harian (30%)</label>
                      <input
                        type="number"
                        value={scores[editingMurid.murid_id]?.harian || ''}
                        onChange={e => handleScoreChange(editingMurid.murid_id, 'harian', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">UTS (30%)</label>
                      <input
                        type="number"
                        value={scores[editingMurid.murid_id]?.uts || ''}
                        onChange={e => handleScoreChange(editingMurid.murid_id, 'uts', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">UAS (40%)</label>
                      <input
                        type="number"
                        value={scores[editingMurid.murid_id]?.uas || ''}
                        onChange={e => handleScoreChange(editingMurid.murid_id, 'uas', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-amber-400 font-bold mb-1">Nilai Akhir</label>
                      <input
                        type="number"
                        value={scores[editingMurid.murid_id]?.akhir || ''}
                        onChange={e => handleScoreChange(editingMurid.murid_id, 'akhir', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-gray-950 border border-amber-500 text-center font-black text-amber-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Predikat</label>
                      <select
                        value={scores[editingMurid.murid_id]?.predikat || ''}
                        onChange={e => handleScoreChange(editingMurid.murid_id, 'predikat', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-center font-bold"
                      >
                        <option value="">-</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                        <option value="E">E</option>
                      </select>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={scores[editingMurid.murid_id]?.catatan || ''}
                    onChange={e => handleScoreChange(editingMurid.murid_id, 'catatan', e.target.value)}
                    placeholder="Catatan kemajuan santri..."
                    className="w-full px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs"
                  />
                </div>
              )}

              {/* Daftar Seluruh Nilai Tersimpan di Semester Ini */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-extrabold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen size={13} className="text-amber-400" />
                  <span>Rekaman Nilai Tersimpan ({editModalScores.length} Mapel)</span>
                </h4>

                {loadingEditModal ? (
                  <div className="py-8 text-center text-gray-400 flex items-center justify-center gap-2 text-xs">
                    <RefreshCw size={16} className="animate-spin text-amber-400" />
                    <span>Memuat rekaman nilai santri...</span>
                  </div>
                ) : editModalScores.length === 0 ? (
                  <div className="py-6 text-center text-xs text-gray-500 border border-dashed border-gray-800 rounded-xl">
                    Belum ada nilai yang tersimpan untuk santri ini pada semester ini.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editModalScores.map((item, idx) => (
                      <div key={item.id || idx} className="p-3 rounded-xl bg-gray-900/90 border border-gray-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-white">{item.mata_pelajaran}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={savingEditModal}
                              onClick={() => handleUpdateScoreInModal(item)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1"
                            >
                              <Check size={11} /> Simpan
                            </button>
                            <button
                              type="button"
                              disabled={savingEditModal}
                              onClick={() => handleDeleteMapelScoreInModal(item)}
                              className="px-2 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-[10px] font-bold"
                              title="Hapus nilai mapel ini"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[11px]">
                          {(['nilai_harian', 'nilai_uts', 'nilai_uas'] as const).map(f => (
                            <div key={f}>
                              <label className="block text-[9px] text-gray-500 mb-0.5 uppercase">
                                {f.replace('nilai_', '')}
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                value={item[f] ?? ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setEditModalScores(prev =>
                                    prev.map((row, rIdx) => {
                                      if (rIdx !== idx) return row;
                                      const nextRow = { ...row, [f]: val };
                                      const h = parseFloat(nextRow.nilai_harian) || 0;
                                      const u = parseFloat(nextRow.nilai_uts) || 0;
                                      const a = parseFloat(nextRow.nilai_uas) || 0;
                                      const hasComponent = nextRow.nilai_harian !== '' || nextRow.nilai_uts !== '' || nextRow.nilai_uas !== '';
                                      const akhir = hasComponent ? Math.round((h * 0.3 + u * 0.3 + a * 0.4) * 100) / 100 : '';
                                      return {
                                        ...nextRow,
                                        nilai_akhir: akhir,
                                        predikat: akhir !== '' ? calcPredikat(Number(akhir)) : '',
                                      };
                                    })
                                  );
                                }}
                                className="w-full px-1.5 py-1 rounded-lg bg-gray-950 border border-gray-700 text-center font-bold text-gray-100"
                              />
                            </div>
                          ))}
                          <div>
                            <label className="block text-[9px] text-amber-400 font-bold mb-0.5 uppercase">akhir</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              value={item.nilai_akhir ?? ''}
                              onChange={e => {
                                const val = e.target.value;
                                setEditModalScores(prev =>
                                  prev.map((row, rIdx) => {
                                    if (rIdx !== idx) return row;
                                    return {
                                      ...row,
                                      nilai_akhir: val,
                                      predikat: val !== '' ? calcPredikat(parseFloat(val) || 0) : '',
                                    };
                                  })
                                );
                              }}
                              className="w-full px-1.5 py-1 rounded-lg bg-gray-950 border border-amber-500 text-center font-black text-amber-300"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-gray-500 mb-0.5 uppercase">Pred</label>
                            <input
                              type="text"
                              value={item.predikat ?? ''}
                              onChange={e => {
                                const val = e.target.value.toUpperCase();
                                setEditModalScores(prev =>
                                  prev.map((row, rIdx) => (rIdx === idx ? { ...row, predikat: val } : row))
                                );
                              }}
                              className="w-full px-1.5 py-1 rounded-lg bg-gray-950 border border-gray-700 text-center font-bold text-amber-300"
                            />
                          </div>
                        </div>
                        <input
                          type="text"
                          value={item.catatan ?? ''}
                          onChange={e => {
                            const val = e.target.value;
                            setEditModalScores(prev =>
                              prev.map((row, rIdx) => (rIdx === idx ? { ...row, catatan: val } : row))
                            );
                          }}
                          placeholder="Catatan perkembangan mapel ini..."
                          className="w-full px-2.5 py-1 rounded-lg bg-gray-950 border border-gray-800 text-[11px] text-gray-200 placeholder:text-gray-600"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-gray-800 bg-[#0b1429] flex justify-end">
              <button
                type="button"
                onClick={() => setEditingMurid(null)}
                className="px-5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-200"
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

export default function PenilaianInputPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#070d1e] text-white flex flex-col items-center justify-center p-4">
        <RefreshCw size={28} className="animate-spin text-amber-400 mb-3" />
        <p className="text-xs font-bold text-gray-300">Memuat Pintasan Penilaian...</p>
      </div>
    }>
      <PenilaianInputContent />
    </Suspense>
  );
}
