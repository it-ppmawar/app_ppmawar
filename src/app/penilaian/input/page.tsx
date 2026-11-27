'use client';

import { useState, useEffect, useRef, useMemo, Suspense, Fragment } from 'react';
import { useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import QuizBModal from '@/app/dashboard/penilaian/QuizBModal';
import RaportTabSection, { RaportCatatanForm } from '@/components/penilaian/RaportTabSection';
import { KelasCollapseToggleButton, KelasGroupHeaderContent } from '@/components/penilaian/KelasCollapseControls';
import {
  calcNilaiAkhir,
  calcPredikat,
  calcPredikatFromInput,
  hasFilledGrade,
  isEmptyScoreVal,
  isResidualZeroScoreRow,
} from '@/lib/penilaian/calcNilai';
import { groupMuridByKelas } from '@/lib/penilaian/groupMuridByKelas';
import { getTahunAjaranOptions } from '@/lib/penilaian/semesterPeriode';
import {
  Award, BookOpen, GraduationCap, ClipboardCheck, Search, Filter,
  Save, CheckCircle, AlertCircle, RefreshCw, User, Calendar,
  Sparkles, Download, Edit3, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronRight, ChevronDown, X, Trash2, Check, Clock, Phone, ShieldCheck, Sun, Moon
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

const getFotoUrl = (fotoName: string | null, nis?: string) => {
  if (!fotoName || fotoName === '-') {
    if (nis) return `https://mawar.smartpesantren.id/sekretariat/berkas/Berkas_2026_${nis}.jpg`;
    return '';
  }
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

function PenilaianInputContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('t') || '';

  // Tab aktif ('input' = Input & Leger Nilai, 'raport' = Raport Santri)
  const [activeTab, setActiveTab] = useState<'input' | 'raport'>(() =>
    (searchParams.get('tab') || '').toLowerCase() === 'raport' ? 'raport' : 'input'
  );

  // Auth & Guru Info State
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [guruInfo, setGuruInfo] = useState<any>(null);

  // State Raport Santri
  const [selectedMuridId, setSelectedMuridId] = useState<string>('');
  const [raportData, setRaportData] = useState<any>(null);
  const [raportError, setRaportError] = useState<string | null>(null);
  const [loadingRaport, setLoadingRaport] = useState(false);
  const [savingRaportCatatan, setSavingRaportCatatan] = useState(false);
  const [editCatatan, setEditCatatan] = useState<RaportCatatanForm>({
    catatan_wali_kelas: '',
    akhlak: 'Baik',
    kerajinan: 'Baik',
    kebersihan: 'Baik',
    tahfidz_hafalan: '',
    status_kelulusan: 'Naik Kelas',
    batas_nilai_tuntas: '70',
    keterangan_tuntas: 'Tuntas',
    keterangan_bimbingan: 'Perlu Bimbingan',
  });

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
  const [scores, setScores] = useState<Record<number, { harian: string; lisan: string; uts: string; uas: string; akhir: string; predikat: string; catatan: string }>>({});
  const [loadingMurid, setLoadingMurid] = useState(false);
  const [savingScores, setSavingScores] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Search & Sorting & Buka-Tutup Per Kelas
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [collapsedKelasSections, setCollapsedKelasSections] = useState<Record<string, boolean>>({});
  const toggleKelasCollapse = (key: string) => {
    setCollapsedKelasSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // QuizB CBT Modal
  const [showQuizBModal, setShowQuizBModal] = useState(false);

  // Modal Detail & Edit Nilai Satuan (semua mapel santri)
  const [editingMurid, setEditingMurid] = useState<any>(null);
  const [editModalScores, setEditModalScores] = useState<any[]>([]);
  const [loadingEditModal, setLoadingEditModal] = useState(false);
  const [savingEditModal, setSavingEditModal] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Zoom foto & Logo + Theme state
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [guruFotoError, setGuruFotoError] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const logoRef = useRef<HTMLImageElement>(null);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (logoRef.current?.complete) {
      setLogoLoaded(true);
    }
  }, [loadingAuth]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setIsDark(true);
        document.documentElement.classList.add('dark');
      } else {
        setIsDark(false);
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setIsDark(true);
    }
  };

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
        // Fetch token & periode aktif secara paralel
        const [res, settingsRes] = await Promise.all([
          fetch(`/api/penilaian/quick-verify?token=${encodeURIComponent(token)}`),
          fetch('/api/settings?public=1').catch(() => null),
        ]);
        const json = await res.json();
        
        // Terapkan periode aktif dari settings sebagai default awal
        // (akan di-override oleh data token jika ada)
        if (settingsRes) {
          try {
            const settingsJson = await settingsRes.json();
            if (settingsJson.success && settingsJson.data) {
              if (settingsJson.data.semester_aktif) setSemester(settingsJson.data.semester_aktif);
              if (settingsJson.data.tahun_ajaran_aktif) setTahunAjaran(settingsJson.data.tahun_ajaran_aktif);
            }
          } catch { /* abaikan */ }
        }

        if (json.success && json.data) {
          const d = json.data;
          setGuruInfo(d);
          const urlSem = searchParams.get('semester');
          const urlThn = searchParams.get('tahun_ajaran');
          if (urlSem) setSemester(urlSem);
          else if (d.semester) setSemester(String(d.semester));
          if (urlThn) setTahunAjaran(urlThn);
          else if (d.tahun_ajaran) setTahunAjaran(String(d.tahun_ajaran));

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
            // Abaikan baris residu lama (seluruh skor 0/kosong tanpa predikat A–E dan tanpa catatan)
            const isResidual = isResidualZeroScoreRow(m);
            const h = !isResidual && !isEmptyScoreVal(m.nilai_harian) ? String(m.nilai_harian) : '';
            const l = !isResidual && !isEmptyScoreVal(m.nilai_lisan) ? String(m.nilai_lisan) : '';
            const u = !isResidual && !isEmptyScoreVal(m.nilai_uts) ? String(m.nilai_uts) : '';
            const a = !isResidual && !isEmptyScoreVal(m.nilai_uas) ? String(m.nilai_uas) : '';
            let akh = !isResidual && !isEmptyScoreVal(m.nilai_akhir) ? String(m.nilai_akhir) : '';
            let pred = !isResidual ? (m.predikat || '') : '';

            if (!akh && (h || l || u || a)) {
              const autoFinal = calcNilaiAkhir({ harian: h, lisan: l, uts: u, uas: a });
              if (autoFinal !== null) {
                akh = String(autoFinal);
                pred = autoFinal === 0 ? 'E' : calcPredikat(autoFinal);
              }
            } else if (akh && !pred) {
              const parsedAkh = parseFloat(akh);
              pred = parsedAkh === 0 ? 'E' : calcPredikat(parsedAkh);
            }

            initialScores[m.murid_id] = {
              harian: h,
              lisan: l,
              uts: u,
              uas: a,
              akhir: akh,
              predikat: pred,
              catatan: isResidual ? '' : (m.catatan || ''),
            };
          });
          setScores(initialScores);
          setIsDirty(false);
          setSelectedMuridId(prev => (
            prev && json.muridList.some((m: any) => String(m.murid_id) === prev) ? prev : ''
          ));
        }
      } catch (err) {
        console.error('Error fetching murid for token input:', err);
      } finally {
        setLoadingMurid(false);
      }
    };

    fetchMurid();
    setCollapsedKelasSections({});
  }, [selectedKelas, selectedMapel, semester, tahunAjaran, token, reloadTrigger]);

  // 3b. Muat Detail Raport Santri saat tab Raport aktif
  const fetchRaportDetail = async (mId: string) => {
    if (!mId || !token) {
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
        token,
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
            batas_nilai_tuntas: String(json.data.pengaturan_nilai?.batas_nilai_tuntas ?? 70),
            keterangan_tuntas: json.data.pengaturan_nilai?.keterangan_tuntas || 'Tuntas',
            keterangan_bimbingan: json.data.pengaturan_nilai?.keterangan_bimbingan || 'Perlu Bimbingan',
          });
        }
      } else {
        setRaportData(null);
        setRaportError(json.error || 'Gagal memuat data raport santri.');
      }
    } catch (err: any) {
      console.error('Error fetching raport in pintasan:', err);
      setRaportData(null);
      setRaportError(err?.message || 'Terjadi kendala koneksi saat memuat raport.');
    } finally {
      setLoadingRaport(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'raport' && token) {
      if (selectedMuridId) {
        fetchRaportDetail(selectedMuridId);
      } else {
        setRaportData(null);
        setRaportError(null);
      }
    }
  }, [activeTab, selectedMuridId, semester, tahunAjaran, token]);

  const handleSaveRaportCatatan = async () => {
    if (!selectedMuridId || !token) return;
    setSavingRaportCatatan(true);
    try {
      const res = await fetch('/api/penilaian/raport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-token': token },
        body: JSON.stringify({
          token,
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
    } catch {
      alert('Terjadi kesalahan jaringan saat menyimpan catatan.');
    } finally {
      setSavingRaportCatatan(false);
    }
  };

  const handleChangeKelasSafely = (nextKelas: string) => {
    if (isDirty && !window.confirm('Ada nilai yang belum disimpan pada kelas ini. Tetap ganti kelas?')) {
      return;
    }
    setSelectedKelas(nextKelas);
  };

  // 4. Score Change Handler
  const handleScoreChange = (muridId: number, field: 'harian' | 'lisan' | 'uts' | 'uas' | 'akhir' | 'predikat' | 'catatan', val: string) => {
    setIsDirty(true);
    setScores(prev => {
      const existing = prev[muridId] || { harian: '', lisan: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
      const updated = { ...existing, [field]: val };

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

      if (field === 'akhir') {
        if (val !== '') {
          const numAkhir = parseFloat(val) || 0;
          updated.predikat = numAkhir === 0 ? 'E' : calcPredikat(numAkhir);
        } else {
          updated.predikat = '';
        }
      }

      return { ...prev, [muridId]: updated };
    });
  };

  // 5. Terapkan Skor dari QuizB / CBT
  const handleApplyQuizBScores = (appliedList: Array<{ murid_id: number; skor: number; targetField: 'harian' | 'lisan' | 'uts' | 'uas'; quizTitle: string }>) => {
    setIsDirty(true);
    setScores(prev => {
      const next = { ...prev };
      for (const item of appliedList) {
        const existing = next[item.murid_id] || { harian: '', lisan: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
        const updated = { ...existing, [item.targetField]: String(item.skor) };
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
        const s = scores[m.murid_id] || { harian: '', lisan: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
        return {
          murid_id: m.murid_id,
          kelas_madin_id: m.kelas_madin_id,
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

  const updateEditModalComponent = (idx: number, field: 'nilai_harian' | 'nilai_lisan' | 'nilai_uts' | 'nilai_uas', val: string) => {
    setEditModalScores(prev =>
      prev.map((row, rIdx) => {
        if (rIdx !== idx) return row;
        const nextRow = { ...row, [field]: val };
        const autoFinal = calcNilaiAkhir({
          harian: nextRow.nilai_harian,
          lisan: nextRow.nilai_lisan,
          uts: nextRow.nilai_uts,
          uas: nextRow.nilai_uas,
        });
        return {
          ...nextRow,
          nilai_akhir: autoFinal !== null ? autoFinal : '',
          predikat: autoFinal !== null ? (autoFinal === 0 ? 'E' : calcPredikat(autoFinal)) : '',
        };
      })
    );
  };

  const handleUpdateScoreInModal = async (scoreItem: any) => {
    if (!editingMurid) return;
    try {
      setSavingEditModal(true);
      const harian = scoreItem.nilai_harian !== null && scoreItem.nilai_harian !== '' ? Number(scoreItem.nilai_harian) : null;
      const lisan = scoreItem.nilai_lisan !== null && scoreItem.nilai_lisan !== undefined && scoreItem.nilai_lisan !== '' ? Number(scoreItem.nilai_lisan) : null;
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
              nilai_lisan: lisan,
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
      const s = scores[m.murid_id] || { harian: '', lisan: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
      return {
        No: idx + 1,
        'Nama Santri': m.nama,
        NIS: m.nis || '-',
        Kelas: m.nama_kelas || kelasNama,
        Kamar: m.nama_kamar || '-',
        'Kehadiran (%)': m.kehadiran_persen ?? 100,
        'Harian (30%/25%)': s.harian || 0,
        'Ujian Lisan (25%)': !isEmptyScoreVal(s.lisan) ? s.lisan : '-',
        'UTS (30%/25%)': s.uts || 0,
        'UAS (40%/25%)': s.uas || 0,
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
          (s.lisan || '').includes(q) ||
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
        } else if (['harian', 'lisan', 'uts', 'uas', 'akhir', 'predikat', 'catatan'].includes(sortField)) {
          valA = scores[a.murid_id]?.[sortField as keyof typeof scores[number]] || '';
          valB = scores[b.murid_id]?.[sortField as keyof typeof scores[number]] || '';
          if (['harian', 'lisan', 'uts', 'uas', 'akhir'].includes(sortField)) {
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
      if (s && hasFilledGrade(s)) {
        terisi++;
      }
    });
    const persen = total > 0 ? Math.round((terisi / total) * 100) : 0;
    return { total, terisi, persen };
  }, [muridList, scores]);

  const totalMapelDiampu = useMemo(() => {
    return (guruInfo?.classes || []).reduce((acc: number, c: any) => acc + (c.mapels?.length || 0), 0);
  }, [guruInfo]);

  const kelasSections = useMemo(
    () => groupMuridByKelas(filteredAndSortedMurid, sortField === 'nama_kelas'),
    [filteredAndSortedMurid, sortField]
  );

  const renderMobileSantriCard = (m: any, idx: number) => {
    const s = scores[m.murid_id] || { harian: '', lisan: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
    const fotoUrl = getFotoUrl(m.foto, m.nis);

    return (
      <div
        key={m.murid_id}
        className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-gray-900/90 border border-slate-200/80 dark:border-gray-800 space-y-3 transition-colors"
      >
        {/* Santri Header */}
        <div className="flex items-start gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => fotoUrl && setZoomPhoto(fotoUrl)}
            className="relative w-10 h-10 rounded-xl overflow-hidden bg-slate-200 dark:bg-gray-800 border border-slate-300 dark:border-gray-700 shrink-0 mt-0.5"
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
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] font-extrabold font-mono text-amber-600 dark:text-amber-400 shrink-0">
                {idx + 1}.
              </span>
              <div className="font-extrabold text-slate-900 dark:text-white text-xs break-words leading-snug min-w-0">
                {m.nama}
              </div>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-gray-400 flex items-center gap-x-1.5 gap-y-0.5 flex-wrap mt-0.5">
              <span className="font-mono whitespace-nowrap">NIS: {m.nis || '-'}</span>
              <span>•</span>
              <span className={`whitespace-nowrap ${m.kehadiran_persen >= 85 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-amber-600 dark:text-amber-400 font-bold'}`}>
                Hadir {m.kehadiran_persen ?? 100}%
              </span>
            </div>
          </div>
        </div>

        {/* Score Inputs */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div>
            <label className="block text-[9px] text-center text-slate-500 dark:text-gray-400 mb-0.5">Harian</label>
            <input
              type="number"
              inputMode="decimal"
              disabled={isLegerMode}
              value={s.harian}
              onChange={e => handleScoreChange(m.murid_id, 'harian', e.target.value)}
              className="w-full py-2 text-center text-xs font-bold rounded-xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white disabled:opacity-60"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-[9px] text-center text-amber-600 dark:text-amber-400 mb-0.5">Lisan</label>
            <input
              type="number"
              inputMode="decimal"
              disabled={isLegerMode}
              value={s.lisan}
              onChange={e => handleScoreChange(m.murid_id, 'lisan', e.target.value)}
              className="w-full py-2 text-center text-xs font-bold rounded-xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white disabled:opacity-60"
              placeholder="-"
            />
          </div>
          <div>
            <label className="block text-[9px] text-center text-slate-500 dark:text-gray-400 mb-0.5">UTS</label>
            <input
              type="number"
              inputMode="decimal"
              disabled={isLegerMode}
              value={s.uts}
              onChange={e => handleScoreChange(m.murid_id, 'uts', e.target.value)}
              className="w-full py-2 text-center text-xs font-bold rounded-xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white disabled:opacity-60"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-[9px] text-center text-slate-500 dark:text-gray-400 mb-0.5">UAS</label>
            <input
              type="number"
              inputMode="decimal"
              disabled={isLegerMode}
              value={s.uas}
              onChange={e => handleScoreChange(m.murid_id, 'uas', e.target.value)}
              className="w-full py-2 text-center text-xs font-bold rounded-xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white disabled:opacity-60"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-[9px] text-center text-amber-600 dark:text-amber-400 font-bold mb-0.5">Akhir</label>
            <input
              type="number"
              inputMode="decimal"
              disabled={isLegerMode}
              value={s.akhir}
              onChange={e => handleScoreChange(m.murid_id, 'akhir', e.target.value)}
              className="w-full py-2 text-center text-xs font-black rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-400 dark:border-amber-500 text-amber-700 dark:text-amber-300 disabled:opacity-60"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-[9px] text-center text-slate-500 dark:text-gray-400 mb-0.5">Pred</label>
            <select
              disabled={isLegerMode}
              value={s.predikat}
              onChange={e => handleScoreChange(m.murid_id, 'predikat', e.target.value)}
              className="w-full py-2 text-center text-xs font-bold rounded-xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white disabled:opacity-60"
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
          className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 placeholder:text-slate-400 dark:placeholder:text-gray-600 disabled:opacity-60"
        />
      </div>
    );
  };

  const renderDesktopSantriRow = (m: any, idx: number) => {
    const s = scores[m.murid_id] || { harian: '', lisan: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
    const fotoUrl = getFotoUrl(m.foto, m.nis);

    return (
      <tr
        key={m.murid_id}
        className="hover:bg-slate-50/80 dark:hover:bg-gray-800/40 transition-colors group"
      >
        {/* No */}
        <td className="py-3 px-3 text-center text-slate-400 dark:text-gray-400 font-mono text-[11px]">
          {idx + 1}
        </td>

        {/* Foto */}
        <td className="py-3 px-2 text-center">
          <button
            type="button"
            onClick={() => fotoUrl && setZoomPhoto(fotoUrl)}
            className="inline-block relative w-9 h-9 rounded-xl overflow-hidden bg-slate-200 dark:bg-gray-800 border border-slate-300/70 dark:border-gray-700/60 transition-transform active:scale-95"
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
          <div className="font-extrabold text-slate-900 dark:text-white text-xs group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors">
            {m.nama}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-gray-400 flex items-center gap-1.5 flex-wrap mt-0.5">
            {m.nama_kelas && (
              <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700">
                {m.nama_kelas}
              </span>
            )}
            {m.nama_kamar && (
              <span className="text-slate-500 dark:text-gray-400">
                Kamar: {m.nama_kamar}
              </span>
            )}
          </div>
          {m.alamat && (
            <p className="text-[9px] text-slate-400 dark:text-gray-500 line-clamp-1 mt-0.5">
              {m.alamat}
            </p>
          )}
        </td>

        {/* NIS */}
        <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-gray-300">
          {m.nis || '-'}
        </td>

        {/* Kehadiran */}
        <td className="py-3 px-3 text-center">
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            (m.kehadiran_persen ?? 100) >= 85
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
              : (m.kehadiran_persen ?? 100) >= 70
                ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30'
                : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30'
          }`}>
            {m.kehadiran_persen ?? 100}%
          </span>
        </td>

        {/* Harian */}
        <td className="py-2 px-1 text-center">
          <input
            type="number"
            min="0"
            max="100"
            step="any"
            disabled={isLegerMode}
            value={s.harian}
            onChange={e => handleScoreChange(m.murid_id, 'harian', e.target.value)}
            className="w-16 px-1.5 py-1.5 text-center text-xs font-bold rounded-xl bg-slate-50 dark:bg-gray-900/90 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
            placeholder="0"
          />
        </td>

        {/* Lisan (25%) */}
        <td className="py-2 px-1 text-center">
          <input
            type="number"
            min="0"
            max="100"
            step="any"
            disabled={isLegerMode}
            value={s.lisan}
            onChange={e => handleScoreChange(m.murid_id, 'lisan', e.target.value)}
            className="w-16 px-1.5 py-1.5 text-center text-xs font-bold rounded-xl bg-slate-50 dark:bg-gray-900/90 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
            placeholder="-"
          />
        </td>

        {/* UTS */}
        <td className="py-2 px-1 text-center">
          <input
            type="number"
            min="0"
            max="100"
            step="any"
            disabled={isLegerMode}
            value={s.uts}
            onChange={e => handleScoreChange(m.murid_id, 'uts', e.target.value)}
            className="w-16 px-1.5 py-1.5 text-center text-xs font-bold rounded-xl bg-slate-50 dark:bg-gray-900/90 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
            placeholder="0"
          />
        </td>

        {/* UAS */}
        <td className="py-2 px-1 text-center">
          <input
            type="number"
            min="0"
            max="100"
            step="any"
            disabled={isLegerMode}
            value={s.uas}
            onChange={e => handleScoreChange(m.murid_id, 'uas', e.target.value)}
            className="w-16 px-1.5 py-1.5 text-center text-xs font-bold rounded-xl bg-slate-50 dark:bg-gray-900/90 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
            placeholder="0"
          />
        </td>

        {/* Nilai Akhir */}
        <td className="py-2 px-1 text-center bg-amber-50/40 dark:bg-amber-500/5 border-x border-amber-200/70 dark:border-amber-500/20">
          <input
            type="number"
            min="0"
            max="100"
            step="any"
            disabled={isLegerMode}
            value={s.akhir}
            onChange={e => handleScoreChange(m.murid_id, 'akhir', e.target.value)}
            className="w-18 px-1.5 py-1.5 text-center text-xs font-black rounded-xl bg-amber-50 dark:bg-gray-950 border border-amber-400 dark:border-amber-500 text-amber-700 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-2xs disabled:opacity-60"
            placeholder="0"
          />
        </td>

        {/* Predikat */}
        <td className="py-2 px-1 text-center">
          <select
            disabled={isLegerMode}
            value={s.predikat}
            onChange={e => handleScoreChange(m.murid_id, 'predikat', e.target.value)}
            className="px-1.5 py-1.5 rounded-xl bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-xs font-bold text-center text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
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
            className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
          />
        </td>
      </tr>
    );
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white flex flex-col items-center justify-center p-4 transition-colors">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 shadow-sm flex flex-col items-center max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center mb-4">
            <RefreshCw size={30} className="animate-spin text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-base font-bold text-slate-900 dark:text-gray-100">Memverifikasi Tautan Pintasan Input Nilai...</p>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Sistem Penilaian PP. Matholi&apos;ul Anwar</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white flex flex-col items-center justify-center p-4 sm:p-6 text-center transition-colors">
        <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/40 rounded-3xl p-7 sm:p-8 shadow-sm max-w-md w-full flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 flex items-center justify-center mb-4 text-red-500 dark:text-red-400">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Tautan Tidak Dapat Diakses</h2>
          <p className="text-sm text-slate-600 dark:text-gray-300 max-w-md mb-6">{authError}</p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
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
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 font-bold text-xs border border-slate-200 dark:border-gray-700 transition-all flex items-center justify-center gap-1.5"
            >
              <Phone size={14} className="text-emerald-500 dark:text-emerald-400" /> Hubungi Admin Pesantren
            </a>
          </div>
        </div>
      </div>
    );
  }

  const guruFotoUrl = getFotoUrl(guruInfo?.foto);

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 selection:bg-amber-500 selection:text-white print:bg-white print:text-black print:p-0 print:pb-0 ${activeTab === 'input' && !isLegerMode ? 'pb-28' : 'pb-12'}`}>
      {/* Top Floating App Bar — Serasi dengan Pintasan Absensi & Rekapitulasi */}
      <header className="print:hidden sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 py-1 shadow-xs rounded-b-2xl transition-colors min-h-[58px] h-[58px] flex items-center">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Pojok Kiri: Logo Lembaga */}
          <div className="flex items-center justify-start shrink-0">
            <div className="relative w-[46px] h-[52px] flex items-center justify-center filter drop-shadow-xs shrink-0">
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                <polygon
                  points="50,1 86,15 99,50 86,85 50,99 14,85 1,50 14,15"
                  strokeLinejoin="round"
                  strokeWidth="3.5"
                  className="fill-white stroke-slate-200 dark:stroke-slate-700/80"
                />
              </svg>
              <div
                className="relative z-10 w-full h-full flex items-center justify-center p-1.5 pt-1.5"
                style={{ clipPath: 'polygon(50% 1%, 86% 15%, 99% 50%, 86% 85%, 50% 99%, 14% 85%, 1% 50%, 14% 15%)' }}
              >
                {!logoLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-[75%] w-[75%] rounded-full bg-white/40 animate-pulse" />
                  </div>
                )}
                <img
                  ref={logoRef}
                  src="/logo.png"
                  alt="Logo Lembaga"
                  fetchPriority="high"
                  decoding="async"
                  onLoad={() => setLogoLoaded(true)}
                  className={`h-[82%] w-auto object-contain translate-y-[1px] transition-opacity duration-500 ${logoLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
              </div>
            </div>
          </div>

          {/* Teks Rata Tengah */}
          <div className="min-w-0 flex-1 flex flex-col items-center justify-center text-center">
            <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {activeTab === 'raport' ? 'Raport Santri' : 'Input & Leger Nilai'}
              </h1>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800/60 rounded-md shrink-0">
                (Guru Madin)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 text-center font-medium max-w-full break-words leading-snug">
              {guruInfo?.nama || "PP. Matholi'ul Anwar"}
            </p>
          </div>

          {/* Pojok Kanan: Tombol Mode Gelap / Terang */}
          <div className="flex items-center justify-end shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="relative w-[44px] h-[50px] flex items-center justify-center transition-transform active:scale-95 hover:scale-105 focus:outline-none cursor-pointer group shrink-0"
              aria-label="Toggle Mode Gelap/Terang"
              title={isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
            >
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none transition-all duration-300">
                <polygon
                  points="50,1 86,15 99,50 86,85 50,99 14,85 1,50 14,15"
                  strokeLinejoin="round"
                  strokeWidth="3.5"
                  className="fill-slate-100 group-hover:fill-slate-200 dark:fill-slate-800 dark:group-hover:fill-slate-700 stroke-slate-200 dark:stroke-slate-700/80"
                />
              </svg>
              <span className="relative z-10">
                {isDark ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-600 dark:text-indigo-400" />}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-4 print:max-w-none print:p-0 print:m-0 print:space-y-0">

        {/* Hero & Banner Profil Guru (Urutan data selaras Rekapitulasi Foto 5 & Rapat Kiri Sejajar Foto Guru) */}
        <section className="print:hidden bg-gradient-to-br from-amber-50/90 via-white to-orange-50/50 dark:from-[#853f06] dark:via-[#5c2c09] dark:to-[#0d1b3e] border border-amber-200/80 dark:border-amber-500/30 rounded-3xl p-4 sm:p-6 shadow-xs dark:shadow-xl dark:shadow-black/30 relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 w-72 h-72 bg-amber-200/30 dark:bg-amber-400/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
            <div className="flex-1 min-w-0">
              {/* Baris Atas: Foto / Inisial Guru + Badge Dokumen Resmi & Nama */}
              <div className="flex items-center gap-3.5">
                <div
                  onClick={() => guruFotoUrl && !guruFotoError && setZoomPhoto(guruFotoUrl)}
                  className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center font-extrabold text-white text-xl shadow-md shrink-0 border-2 border-amber-200/80 dark:border-white/20 overflow-hidden select-none ${
                    guruFotoUrl && !guruFotoError ? 'cursor-pointer hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all' : ''
                  }`}
                  style={{ backgroundColor: getAvatarColor(guruInfo?.nama || 'Guru') }}
                  title={guruFotoUrl && !guruFotoError ? 'Klik untuk memperbesar foto' : (guruInfo?.nama || 'Guru')}
                >
                  <span>{getInitials(guruInfo?.nama || 'Guru')}</span>
                  {guruFotoUrl && !guruFotoError && (
                    <img
                      src={guruFotoUrl}
                      alt={guruInfo?.nama || 'Guru'}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={() => setGuruFotoError(true)}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300/70 dark:bg-amber-500/25 dark:text-amber-200 dark:border-amber-400/40 mb-1">
                    <ShieldCheck size={11} /> Dokumen Resmi Penilaian
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight break-words">
                    {guruInfo?.nama || 'Ustadz / Ustadzah'}
                  </h2>
                </div>
              </div>

              {/* Ruang Bawah Foto/Inisial: Rapat ke Ujung Kiri Sejajar Foto Guru (Urutan Data Selaras Foto 5) */}
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-amber-100/90">
                  <span className="font-mono">
                    NIP: <strong className="text-slate-900 dark:text-white">{guruInfo?.nip || '-'}</strong>
                  </span>
                  <span>
                    Tugas: <strong className="text-slate-900 dark:text-white">Pengajar {totalMapelDiampu || (guruInfo?.classes?.length || 0)} Mapel / {(guruInfo?.classes?.length || 0)} Kelas Madin</strong>
                  </span>
                  {guruInfo?.no_hp && (
                    <span className="font-mono">
                      No. WA: <strong className="text-slate-900 dark:text-white">{guruInfo.no_hp}</strong>
                    </span>
                  )}
                </div>

                {guruInfo?.exp_date_formatted && (
                  <div className="flex justify-center sm:justify-start">
                    <div className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-xl bg-white/80 dark:bg-black/25 text-amber-900 dark:text-amber-200 border border-amber-200/80 dark:border-white/15 font-medium shadow-2xs">
                      <Calendar size={12} className="text-amber-600 dark:text-amber-300 shrink-0" />
                      <span>Tautan berlaku s/d: <strong className="font-bold text-slate-900 dark:text-white">{guruInfo.exp_date_formatted}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-stretch lg:items-end justify-between w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-amber-200/70 dark:border-white/15 gap-3 shrink-0">
              {/* Tab Switcher: Input & Leger Nilai / Raport Santri */}
              <div className="grid grid-cols-2 gap-1.5 bg-amber-100/85 dark:bg-black/35 p-1.5 rounded-2xl border border-amber-200/80 dark:border-white/15 backdrop-blur-md w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('input')}
                  className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl font-bold text-[11px] sm:text-xs text-center leading-tight transition-all cursor-pointer ${
                    activeTab === 'input'
                      ? 'bg-amber-600 dark:bg-amber-500 text-white shadow-md'
                      : 'text-amber-900/75 dark:text-amber-200/85 hover:text-amber-950 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10'
                  }`}
                >
                  <ClipboardCheck size={14} className="shrink-0" />
                  <span>Input &amp; Leger Nilai</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('raport')}
                  className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl font-bold text-[11px] sm:text-xs text-center leading-tight transition-all cursor-pointer ${
                    activeTab === 'raport'
                      ? 'bg-amber-600 dark:bg-amber-500 text-white shadow-md'
                      : 'text-amber-900/75 dark:text-amber-200/85 hover:text-amber-950 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10'
                  }`}
                >
                  <GraduationCap size={14} className="shrink-0" />
                  <span>Raport Santri</span>
                </button>
              </div>

              {activeTab === 'input' && (
                <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between w-full gap-2">
                  <div className="text-left lg:text-right">
                    <span className="text-[10px] text-amber-800/80 dark:text-amber-200/80 uppercase font-bold block">
                      {isLegerMode ? 'Santri pada Leger Kelas' : 'Progres Pengisian Mapel Ini'}
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                      {stats.terisi} dari {stats.total} Santri ({stats.persen}%)
                    </span>
                  </div>
                  <div className="w-28 sm:w-40 h-2.5 bg-amber-200/60 dark:bg-black/30 rounded-full overflow-hidden border border-amber-300/60 dark:border-white/15">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 dark:from-amber-400 dark:to-emerald-400 transition-all duration-500 rounded-full"
                      style={{ width: `${stats.persen}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {activeTab === 'input' && (
        <>

        {/* Notifikasi Sukses Simpan */}
        {saveSuccessMsg && (
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/50 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm animate-[fadeIn_0.3s_ease-out] shadow-sm">
            <CheckCircle size={20} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="font-bold flex-1">{saveSuccessMsg}</p>
            <button
              type="button"
              onClick={() => setSaveSuccessMsg('')}
              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Filter Kelas, Mapel, Semester, Tahun Ajaran */}
        <section className="bg-white dark:bg-[#0b1429] border border-slate-200/80 dark:border-gray-800 rounded-3xl p-4 sm:p-5 shadow-xs dark:shadow-lg space-y-3 transition-colors">
          <div className="flex flex-col items-center sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-slate-100 dark:border-gray-800 pb-3">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider text-center sm:text-left">
              <Filter size={13} className="shrink-0" />
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
                className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 bg-amber-50 dark:bg-amber-500/10 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-500/30 flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Edit3 size={12} />
                <span>{isCustomMapel ? 'Pilih Mapel dari Jadwal' : 'Ketik Mapel Khusus'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
            {/* Kelas Madin */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-gray-400 mb-1">Kelas Madin</label>
              <select
                value={selectedKelas}
                onChange={e => setSelectedKelas(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-xs sm:text-sm font-semibold text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
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
              <label className="block text-[11px] font-bold text-slate-600 dark:text-gray-400 mb-1">
                Mata Pelajaran
              </label>
              {isCustomMapel ? (
                <div className="space-y-1.5">
                  <input
                    ref={customMapelInputRef}
                    type="text"
                    value={selectedMapel}
                    onChange={e => setSelectedMapel(e.target.value)}
                    placeholder="Nama Pelajaran / Fan (misal: Imla')"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-gray-900 border border-amber-400 dark:border-amber-500/50 text-xs sm:text-sm font-semibold text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  />
                  <input
                    type="text"
                    value={selectedKitab}
                    onChange={e => setSelectedKitab(e.target.value)}
                    placeholder="Nama Kitab / Rujukan (Opsional)"
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-xs font-semibold text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  />
                </div>
              ) : (
                <>
                  <select
                    value={selectedMapel}
                    onChange={e => {
                      setSelectedMapel(e.target.value);
                      const found = kurikulumList.find(m => m.mata_pelajaran === e.target.value);
                      if (found) setSelectedKitab(found.kitab || '');
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-xs sm:text-sm font-semibold text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
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
                  {selectedKitab && !isLegerMode && (
                    <p className="mt-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 leading-snug">
                      ({selectedKitab})
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Semester */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-gray-400 mb-1">Semester</label>
              <select
                value={semester}
                onChange={e => setSemester(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-xs sm:text-sm font-semibold text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
              >
                <option value="1">Semester 1 (Ganjil)</option>
                <option value="2">Semester 2 (Genap)</option>
              </select>
            </div>

            {/* Tahun Ajaran */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-gray-400 mb-1">Tahun Ajaran</label>
              <select
                value={tahunAjaran}
                onChange={e => setTahunAjaran(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-xs sm:text-sm font-semibold text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
              >
                {getTahunAjaranOptions(tahunAjaran).map(thn => (
                  <option key={thn} value={thn}>{thn}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Section Heading & Actions */}
        <section className="bg-white dark:bg-[#0b1429] border border-slate-200/80 dark:border-gray-800 rounded-3xl p-4 sm:p-5 shadow-xs dark:shadow-lg space-y-4 transition-colors">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>
                  {isLegerMode
                    ? 'Daftar Santri — Semua Mata Pelajaran'
                    : `Daftar Santri — ${selectedMapel || 'Mata Pelajaran'}`}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30 font-bold">
                  {filteredAndSortedMurid.length} Santri
                </span>
                {isLegerMode && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30 font-bold inline-flex items-center gap-1">
                    <Sparkles size={10} /> Leger Kolektif
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                {isLegerMode
                  ? 'Mode Leger Kolektif: Menampilkan rata-rata akumulasi nilai santri & presensi dari seluruh mata pelajaran kelas ini.'
                  : 'Kalkulasi otomatis: Harian, Lisan, UTS, UAS (25% masing-masing jika Lisan diisi, atau 30% + 30% + 40% jika kosong). Nilai Akhir & Predikat fleksibel dapat diubah manual.'}
              </p>
            </div>

            {/* Rata tengah pada tampilan HP, 1 baris sejajar rapi pada layar tablet/PC */}
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-center lg:justify-end gap-2 w-full lg:w-auto shrink-0">
              <button
                type="button"
                onClick={() => setShowQuizBModal(true)}
                disabled={muridList.length === 0}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                title="Tarik nilai hasil ujian CBT santri dari Portal Ujian ke buku nilai"
              >
                <span>📥 Tarik Nilai Ujian CBT</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={muridList.length === 0}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-700 transition-all active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                title="Unduh daftar nilai ini dalam format Excel (.xlsx)"
              >
                <Download size={14} className="text-amber-600 dark:text-amber-400" />
                <span>Ekspor Excel</span>
              </button>

              {isLegerMode ? (
                <div className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 whitespace-nowrap shrink-0">
                  <Sparkles size={13} />
                  <span>Pilih mapel spesifik untuk input nilai</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveScores}
                  disabled={savingScores || muridList.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {savingScores ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Simpan Semua Nilai</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari santri, NIS, kelas, kamar, alamat, nilai..."
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Konten Tabel (Desktop) & Kartu Input Sentuh (Mobile) */}
          {loadingMurid ? (
            <div className="py-16 text-center text-slate-500 dark:text-gray-400 flex flex-col items-center justify-center gap-3">
              <RefreshCw size={24} className="animate-spin text-amber-600 dark:text-amber-500" />
              <p className="text-xs font-bold">Memuat daftar santri &amp; nilai...</p>
            </div>
          ) : filteredAndSortedMurid.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-gray-400 border border-dashed border-slate-200 dark:border-gray-800 rounded-2xl">
              <User size={32} className="mx-auto mb-2 text-slate-400 dark:text-gray-600" />
              <p className="text-xs font-bold text-slate-700 dark:text-gray-300">Tidak ada santri ditemukan pada filter ini</p>
              <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-1">Pastikan kelas madin dan mata pelajaran yang dipilih sesuai jadwal</p>
            </div>
          ) : (
            <>
              {/* Kontrol Buka/Tutup Semua Kelas (khusus mode Semua Kelas) */}
              {isSemuaKelasMode && kelasSections.length > 0 && (
                <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50">
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    Menampilkan {kelasSections.length} Kelas ({filteredAndSortedMurid.length} Santri)
                  </span>
                  <KelasCollapseToggleButton
                    sectionKeys={kelasSections.map(s => s.key)}
                    collapsedMap={collapsedKelasSections}
                    onChangeMap={setCollapsedKelasSections}
                  />
                </div>
              )}

              {/* Mobile Quick Sort Bar */}
              <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 shrink-0">Urut:</span>
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
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border shrink-0 flex items-center gap-1 transition-colors ${
                      sortField === opt.id
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {renderSortIcon(opt.id)}
                  </button>
                ))}
              </div>

              {/* Mobile Touch-Friendly Card View */}
              <div className="md:hidden space-y-3">
                {isSemuaKelasMode ? (
                  kelasSections.map((sec) => {
                    const isCollapsed = !searchQuery.trim() && Boolean(collapsedKelasSections[sec.key]);
                    return (
                      <div key={sec.key} className="space-y-2.5">
                        <button
                          type="button"
                          onClick={() => toggleKelasCollapse(sec.key)}
                          className="w-full py-2.5 px-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100/80 dark:hover:bg-amber-900/50 transition-colors cursor-pointer select-none"
                          title={isCollapsed ? 'Klik untuk membuka daftar santri kelas ini' : 'Klik untuk menutup daftar santri kelas ini'}
                        >
                          <KelasGroupHeaderContent
                            namaKelas={sec.namaKelas}
                            count={sec.items.length}
                            isCollapsed={isCollapsed}
                          />
                        </button>
                        {!isCollapsed && (
                          <div className="space-y-3">
                            {sec.items.map((m, idx) => renderMobileSantriCard(m, idx))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  filteredAndSortedMurid.map((m, idx) => renderMobileSantriCard(m, idx))
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto border border-slate-200 dark:border-gray-800 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-[#0e1933] text-slate-600 dark:text-gray-300 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-gray-800">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">
                        <button type="button" onClick={() => handleSort('no')} className="inline-flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-400">
                          <span>No</span> {renderSortIcon('no')}
                        </button>
                      </th>
                      <th className="py-3 px-2 w-12 text-center">Foto</th>
                      <th className="py-3 px-3 min-w-[180px]">
                        <button type="button" onClick={() => handleSort('nama')} className="flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-400">
                          <span>Nama Santri</span> {renderSortIcon('nama')}
                        </button>
                      </th>
                      <th className="py-3 px-3 w-24">
                        <button type="button" onClick={() => handleSort('nis')} className="flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-400">
                          <span>NIS</span> {renderSortIcon('nis')}
                        </button>
                      </th>
                      <th className="py-3 px-3 text-center min-w-[90px]">
                        <button type="button" onClick={() => handleSort('kehadiran')} className="inline-flex flex-col items-center hover:text-amber-600 dark:hover:text-amber-400">
                          <span className="flex items-center gap-1">Kehadiran {renderSortIcon('kehadiran')}</span>
                          <span className="text-[9px] text-slate-400 dark:text-gray-400 font-normal lowercase">(presensi)</span>
                        </button>
                      </th>
                      <th className="py-3 px-2 text-center w-20">
                        <button type="button" onClick={() => handleSort('harian')} className="inline-flex flex-col items-center hover:text-amber-600 dark:hover:text-amber-400">
                          <span className="flex items-center gap-1">Harian {renderSortIcon('harian')}</span>
                          <span className="text-[9px] text-slate-500 dark:text-gray-400 font-normal">(30%/25%)</span>
                        </button>
                      </th>
                      <th className="py-3 px-2 text-center w-20">
                        <button type="button" onClick={() => handleSort('lisan')} className="inline-flex flex-col items-center hover:text-amber-600 dark:hover:text-amber-400">
                          <span className="flex items-center gap-1">Lisan {renderSortIcon('lisan')}</span>
                          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-normal">(25%)</span>
                        </button>
                      </th>
                      <th className="py-3 px-2 text-center w-20">
                        <button type="button" onClick={() => handleSort('uts')} className="inline-flex flex-col items-center hover:text-amber-600 dark:hover:text-amber-400">
                          <span className="flex items-center gap-1">UTS {renderSortIcon('uts')}</span>
                          <span className="text-[9px] text-slate-500 dark:text-gray-400 font-normal">(30%/25%)</span>
                        </button>
                      </th>
                      <th className="py-3 px-2 text-center w-20">
                        <button type="button" onClick={() => handleSort('uas')} className="inline-flex flex-col items-center hover:text-amber-600 dark:hover:text-amber-400">
                          <span className="flex items-center gap-1">UAS {renderSortIcon('uas')}</span>
                          <span className="text-[9px] text-slate-500 dark:text-gray-400 font-normal">(40%/25%)</span>
                        </button>
                      </th>
                      <th className="py-3 px-2 text-center w-24 bg-amber-50/80 dark:bg-amber-500/10 border-x border-amber-200/80 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 font-black">
                        <button type="button" onClick={() => handleSort('akhir')} className="inline-flex items-center gap-1 hover:text-amber-900 dark:hover:text-amber-200">
                          <span>Nilai Akhir</span> {renderSortIcon('akhir')}
                        </button>
                      </th>
                      <th className="py-3 px-2 text-center w-16">
                        <button type="button" onClick={() => handleSort('predikat')} className="inline-flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-400">
                          <span>Predikat</span> {renderSortIcon('predikat')}
                        </button>
                      </th>
                      <th className="py-3 px-3 min-w-[140px]">Catatan Perkembangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800/80">
                    {isSemuaKelasMode ? (
                      kelasSections.map((sec) => {
                        const isCollapsed = !searchQuery.trim() && Boolean(collapsedKelasSections[sec.key]);
                        return (
                          <Fragment key={sec.key}>
                            <tr
                              onClick={() => toggleKelasCollapse(sec.key)}
                              className="bg-amber-50/90 dark:bg-amber-950/40 border-y border-amber-200 dark:border-amber-800/60 cursor-pointer hover:bg-amber-100/80 dark:hover:bg-amber-900/50 transition-colors select-none"
                              title={isCollapsed ? 'Klik untuk membuka daftar santri kelas ini' : 'Klik untuk menutup daftar santri kelas ini'}
                            >
                              <td colSpan={12} className="py-2.5 px-4">
                                <KelasGroupHeaderContent
                                  namaKelas={sec.namaKelas}
                                  count={sec.items.length}
                                  isCollapsed={isCollapsed}
                                />
                              </td>
                            </tr>
                            {!isCollapsed && sec.items.map((m, idx) => renderDesktopSantriRow(m, idx))}
                          </Fragment>
                        );
                      })
                    ) : (
                      filteredAndSortedMurid.map((m, idx) => renderDesktopSantriRow(m, idx))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* Petunjuk Pengisian */}
        <section className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/30 rounded-3xl p-4 sm:p-5 text-xs text-slate-600 dark:text-gray-400 space-y-1.5 transition-colors">
          <p className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <Sparkles size={14} /> Tips Pengisian Nilai untuk Dewan Guru:
          </p>
          <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-slate-600 dark:text-gray-400">
            <li>Ketik nilai pada kolom <b>Harian, Lisan, UTS, atau UAS</b>, sistem akan menghitung Nilai Akhir secara otomatis (bobot 25% masing-masing jika Lisan diisi, atau 30% Harian + 30% UTS + 40% UAS jika Lisan kosong).</li>
            <li>Jika ingin melihat akumulasi rata-rata seluruh mapel di kelas, pilih <b>&quot;Semua Mapel&quot;</b> pada filter Mata Pelajaran untuk Mode Leger Kolektif.</li>
            <li>Jangan lupa menekan tombol <b>&quot;Simpan Nilai&quot;</b> setelah selesai menginput nilai.</li>
          </ul>
        </section>
        </>
        )}

        {/* Tab 2: Raport Santri Resmi */}
        {activeTab === 'raport' && (
          <RaportTabSection
            kelasList={kelasList}
            selectedKelas={selectedKelas}
            onChangeKelas={handleChangeKelasSafely}
            semester={semester}
            onChangeSemester={setSemester}
            tahunAjaran={tahunAjaran}
            onChangeTahunAjaran={setTahunAjaran}
            muridList={muridList}
            loadingMurid={loadingMurid}
            selectedMuridId={selectedMuridId}
            onSelectMuridId={setSelectedMuridId}
            raportData={raportData}
            loadingRaport={loadingRaport}
            raportError={raportError}
            onRefreshRaport={fetchRaportDetail}
            onPrint={() => window.print()}
            getPreviewUrl={mId => {
              const p = new URLSearchParams({
                murid_id: mId,
                semester,
                tahun_ajaran: tahunAjaran,
                preview: '1',
                token,
              });
              return `/penilaian/preview?${p.toString()}`;
            }}
            getFotoUrl={getFotoUrl}
            onZoomPhoto={setZoomPhoto}
            canEditCatatan={true}
            editCatatan={editCatatan}
            onChangeEditCatatan={setEditCatatan}
            onSaveCatatan={handleSaveRaportCatatan}
            savingCatatan={savingRaportCatatan}
            variant="shortcut"
          />
        )}
      </main>

      {/* Floating Bottom Bar — Serasi dengan Pintasan Input Absensi */}
      {activeTab === 'input' && !isLegerMode && (
        <div className="print:hidden fixed bottom-0 left-0 right-0 z-40 px-4 py-3 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-5px_20px_rgba(0,0,0,0.5)] transition-colors">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-slate-500 dark:text-gray-400 block">Progres Nilai:</span>
                {isDirty && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 animate-pulse">
                    <Clock size={9} /> Belum Disimpan
                  </span>
                )}
              </div>
              <span className="text-xs sm:text-sm font-extrabold text-amber-600 dark:text-amber-400">
                {stats.terisi} / {stats.total} Santri
              </span>
            </div>
            <button
              type="button"
              onClick={handleSaveScores}
              disabled={savingScores || muridList.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-lg shadow-amber-500/25 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shrink-0"
            >
              {savingScores ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{savingScores ? 'Menyimpan...' : 'Simpan Nilai'}</span>
            </button>
          </div>
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
          <div
            className="relative max-w-sm w-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-3xl overflow-hidden p-2 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <img src={zoomPhoto} alt="Foto Profil" className="w-full h-auto rounded-2xl object-cover" />
            <button
              type="button"
              onClick={() => setZoomPhoto(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Edit & Rincian Seluruh Nilai Santri */}
      {editingMurid && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-[#0e1933] border border-slate-200 dark:border-gray-700 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl relative text-slate-800 dark:text-gray-200 overflow-hidden transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 px-6 py-4 bg-slate-50 dark:bg-[#0b1429]">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Edit3 size={16} className="text-amber-600 dark:text-amber-400" />
                  <span>Kelola Nilai — {editingMurid.nama}</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                  NIS: {editingMurid.nis || '-'} • Semester {semester} ({tahunAjaran})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMurid(null)}
                className="text-slate-400 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {modalFeedback && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                  modalFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-500/40 dark:text-emerald-300'
                    : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-500/40 dark:text-red-300'
                }`}>
                  {modalFeedback.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                  <span>{modalFeedback.message}</span>
                </div>
              )}

              {/* Quick Edit Mapel Aktif */}
              {!isLegerMode && selectedMapel && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-amber-800 dark:text-amber-300">
                      Input Cepat Mapel Aktif: {selectedMapel}
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveScores}
                      disabled={savingScores}
                      className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Save size={12} /> Simpan
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-gray-400 mb-1">Harian (30%/25%)</label>
                      <input
                        type="number"
                        value={scores[editingMurid.murid_id]?.harian || ''}
                        onChange={e => handleScoreChange(editingMurid.murid_id, 'harian', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-amber-600 dark:text-amber-400 mb-1">Lisan (25%)</label>
                      <input
                        type="number"
                        value={scores[editingMurid.murid_id]?.lisan || ''}
                        onChange={e => handleScoreChange(editingMurid.murid_id, 'lisan', e.target.value)}
                        placeholder="-"
                        className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-gray-400 mb-1">UTS (30%/25%)</label>
                      <input
                        type="number"
                        value={scores[editingMurid.murid_id]?.uts || ''}
                        onChange={e => handleScoreChange(editingMurid.murid_id, 'uts', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-gray-400 mb-1">UAS (40%/25%)</label>
                      <input
                        type="number"
                        value={scores[editingMurid.murid_id]?.uas || ''}
                        onChange={e => handleScoreChange(editingMurid.murid_id, 'uas', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-amber-700 dark:text-amber-400 font-bold mb-1">Nilai Akhir</label>
                      <input
                        type="number"
                        value={scores[editingMurid.murid_id]?.akhir || ''}
                        onChange={e => handleScoreChange(editingMurid.murid_id, 'akhir', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-gray-950 border border-amber-400 dark:border-amber-500 text-center font-black text-amber-700 dark:text-amber-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-gray-400 mb-1">Predikat</label>
                      <select
                        value={scores[editingMurid.murid_id]?.predikat || ''}
                        onChange={e => handleScoreChange(editingMurid.murid_id, 'predikat', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white text-center font-bold"
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
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-white text-xs"
                  />
                </div>
              )}

              {/* Daftar Seluruh Nilai Tersimpan di Semester Ini */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-extrabold text-slate-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen size={13} className="text-amber-600 dark:text-amber-400" />
                  <span>Rekaman Nilai Tersimpan ({editModalScores.length} Mapel)</span>
                </h4>

                {loadingEditModal ? (
                  <div className="py-8 text-center text-slate-500 dark:text-gray-400 flex items-center justify-center gap-2 text-xs">
                    <RefreshCw size={16} className="animate-spin text-amber-600 dark:text-amber-400" />
                    <span>Memuat rekaman nilai santri...</span>
                  </div>
                ) : editModalScores.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500 dark:text-gray-500 border border-dashed border-slate-200 dark:border-gray-800 rounded-2xl">
                    Belum ada nilai yang tersimpan untuk santri ini pada semester ini.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editModalScores.map((item, idx) => (
                      <div key={item.id || idx} className="p-3 rounded-2xl bg-slate-50 dark:bg-gray-900/90 border border-slate-200/80 dark:border-gray-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white">{item.mata_pelajaran}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={savingEditModal}
                              onClick={() => handleUpdateScoreInModal(item)}
                              className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 dark:text-emerald-300 dark:border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Check size={11} /> Simpan
                            </button>
                            <button
                              type="button"
                              disabled={savingEditModal}
                              onClick={() => handleDeleteMapelScoreInModal(item)}
                              className="px-2 py-1 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-600/20 dark:hover:bg-red-600/30 dark:text-red-300 dark:border-red-500/30 text-[10px] font-bold cursor-pointer"
                              title="Hapus nilai mapel ini"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-[11px]">
                          {(['nilai_harian', 'nilai_lisan', 'nilai_uts', 'nilai_uas'] as const).map(f => (
                            <div key={f}>
                              <label className="block text-[9px] text-slate-500 dark:text-gray-500 mb-0.5 uppercase">
                                {f.replace('nilai_', '')}
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                value={item[f] ?? ''}
                                placeholder={f === 'nilai_lisan' ? '-' : '0'}
                                onChange={e => updateEditModalComponent(idx, f, e.target.value)}
                                className="w-full px-1.5 py-1 rounded-xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-700 text-center font-bold text-slate-900 dark:text-gray-100"
                              />
                            </div>
                          ))}
                          <div>
                            <label className="block text-[9px] text-amber-600 dark:text-amber-400 font-bold mb-0.5 uppercase">akhir</label>
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
                                      predikat: calcPredikatFromInput(val, ''),
                                    };
                                  })
                                );
                              }}
                              className="w-full px-1.5 py-1 rounded-xl bg-amber-50 dark:bg-gray-950 border border-amber-400 dark:border-amber-500 text-center font-black text-amber-700 dark:text-amber-300"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-500 dark:text-gray-500 mb-0.5 uppercase">Pred</label>
                            <input
                              type="text"
                              value={item.predikat ?? ''}
                              onChange={e => {
                                const val = e.target.value.toUpperCase();
                                setEditModalScores(prev =>
                                  prev.map((row, rIdx) => (rIdx === idx ? { ...row, predikat: val } : row))
                                );
                              }}
                              className="w-full px-1.5 py-1 rounded-xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-700 text-center font-bold text-amber-700 dark:text-amber-300"
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
                          className="w-full px-2.5 py-1 rounded-xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 text-[11px] text-slate-700 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-600"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-[#0b1429] flex justify-end">
              <button
                type="button"
                onClick={() => setEditingMurid(null)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-xs font-bold text-slate-700 dark:text-gray-200 cursor-pointer"
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white flex flex-col items-center justify-center p-4">
        <RefreshCw size={28} className="animate-spin text-amber-600 dark:text-amber-400 mb-3" />
        <p className="text-xs font-bold text-slate-600 dark:text-gray-300">Memuat Pintasan Penilaian...</p>
      </div>
    }>
      <PenilaianInputContent />
    </Suspense>
  );
}
