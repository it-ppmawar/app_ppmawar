'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Award, BookOpen, GraduationCap, ClipboardCheck, Search, Filter,
  Save, Printer, CheckCircle, AlertCircle, RefreshCw, User, Calendar,
  ShieldCheck, AlertTriangle, FileText, ChevronRight, ChevronDown, Sparkles, Download,
  Edit3, ArrowUpDown, ArrowUp, ArrowDown, X
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

  // State Tabel Input Nilai
  const [muridList, setMuridList] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<number, { harian: string; uts: string; uas: string; akhir: string; predikat: string; catatan: string }>>({});
  const [loadingMurid, setLoadingMurid] = useState(false);
  const [savingScores, setSavingScores] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Fitur Pencarian Universal & Pengurutan Kolom (Sorting berpola Rekapitulasi)
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(['harian', 'uts', 'uas', 'akhir', 'kehadiran'].includes(field) ? 'desc' : 'asc');
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
  // Searchable combobox Pilih Santri (tab Raport)
  const [muridSearch, setMuridSearch] = useState<string>('');
  const [showMuridDropdown, setShowMuridDropdown] = useState(false);
  const muridComboRef = useRef<HTMLDivElement>(null);
  const [loadingRaport, setLoadingRaport] = useState(false);
  const [savingRaportCatatan, setSavingRaportCatatan] = useState(false);
  const [editCatatan, setEditCatatan] = useState({
    catatan_wali_kelas: '',
    akhlak: 'Baik',
    kerajinan: 'Baik',
    kebersihan: 'Baik',
    tahfidz_hafalan: '',
    status_kelulusan: 'Naik Kelas',
  });

  // Helper kalkulasi predikat otomatis
  const calcPredikat = (score: number) => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'E';
  };

  // Export Raport Santri ke Excel
  const handleExportRaportExcel = () => {
    if (!raportData) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Nilai Akademik
    const nilaiRows = [
      ['LAPORAN HASIL BELAJAR SANTRI (RAPORT)'],
      ['Pondok Pesantren Matholi\'ul Anwar — Madrasah Diniyah'],
      [],
      ['Nama Santri', raportData.santri.nama],
      ['NIS', raportData.santri.nis || '-'],
      ['Kelas Madin', raportData.santri.nama_kelas_madin],
      ['Kamar / Asrama', `${raportData.santri.nama_kamar} (${raportData.santri.nama_asrama})`],
      ['Wali Kelas', raportData.santri.wali_kelas || '-'],
      ['Semester / Tahun Ajaran', `${raportData.semester === '1' ? 'Semester 1 (Ganjil)' : 'Semester 2 (Genap)'} / ${raportData.tahun_ajaran}`],
      [],
      ['A. NILAI HASIL BELAJAR'],
      ['No', 'Mata Pelajaran', 'Kitab yang Dipelajari', 'KKM', 'Nilai Akhir', 'Predikat', 'Keterangan'],
      ...(raportData.nilai || []).map((n: any, i: number) => [
        i + 1,
        n.mata_pelajaran,
        n.kitab || '-',
        70,
        n.nilai_akhir,
        n.predikat,
        Number(n.nilai_akhir) >= 70 ? 'Tuntas' : 'Perlu Bimbingan',
      ]),
      [],
      ['', '', '', 'Nilai Rata-Rata Akhir:', raportData.ringkasan_nilai?.rata_rata, '', `Dari ${raportData.ringkasan_nilai?.total_mapel} mata pelajaran`],
      [],
      ['B. REKAPITULASI PRESENSI'],
      ['Hadir', raportData.rekap_absensi?.hadir + ' kali'],
      ['Izin', raportData.rekap_absensi?.izin + ' kali'],
      ['Sakit', raportData.rekap_absensi?.sakit + ' kali'],
      ['Alpha / Tanpa Keterangan', raportData.rekap_absensi?.alpha + ' kali'],
      ['Persentase Kehadiran', raportData.rekap_absensi?.persentase + '%'],
      [],
      ['C. KEDISIPLINAN & KETERTIBAN'],
      ['Total Poin Pelanggaran', raportData.rekap_kedisiplinan?.total_poin + ' Poin'],
      ['Predikat Kedisiplinan', raportData.rekap_kedisiplinan?.predikat],
      ['Capaian Tahfidz', editCatatan.tahfidz_hafalan || '-'],
      ['Keputusan Akhir', editCatatan.status_kelulusan],
      [],
      ['D. CATATAN WALI KELAS'],
      [editCatatan.catatan_wali_kelas || 'Tingkatkan terus prestasi belajar dan ketaatan ibadah.'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(nilaiRows);
    ws['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 30 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Raport Santri');

    const namaSantri = (raportData.santri.nama || 'Santri').replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
    const smstr = raportData.semester === '1' ? 'Ganjil' : 'Genap';
    XLSX.writeFile(wb, `Raport_${namaSantri}_Sem${smstr}_${raportData.tahun_ajaran?.replace('/', '-')}.xlsx`);
  };

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

  // Computed: filter daftar santri berdasarkan teks pencarian di combobox Raport
  const filteredMuridOptions = useMemo(() => {
    if (!muridSearch.trim()) return muridList;
    const q = muridSearch.toLowerCase().trim();
    return muridList.filter(m =>
      (m.nama || '').toLowerCase().includes(q) ||
      (m.nis || '').toLowerCase().includes(q) ||
      (m.nama_kelas || '').toLowerCase().includes(q)
    );
  }, [muridList, muridSearch]);

  // Close combobox Pilih Santri saat klik di luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (muridComboRef.current && !muridComboRef.current.contains(e.target as Node)) {
        setShowMuridDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 0. Fetch Role Pengguna (untuk mode tamu)
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.success && d.user) setUserRole(d.user.role); })
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
          if (kList.length > 0) {
            setSelectedKelas(String(kList[0].kelas_id));
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
            if (mList.length > 0) {
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
            let finalVal = m.nilai_akhir !== null && m.nilai_akhir !== undefined && m.nilai_akhir !== '' ? String(m.nilai_akhir) : '';
            let pred = m.predikat || '';

            // Jika belum ada nilai akhir tersimpan tetapi komponen terisi, hitung preview
            if (!finalVal && (h || u || a)) {
              const numH = parseFloat(h) || 0;
              const numU = parseFloat(u) || 0;
              const numA = parseFloat(a) || 0;
              const autoFinal = Math.round((numH * 0.3 + numU * 0.3 + numA * 0.4) * 100) / 100;
              finalVal = String(autoFinal);
              pred = calcPredikat(autoFinal);
            }

            initialScores[m.murid_id] = {
              harian: h,
              uts: u,
              uas: a,
              akhir: finalVal,
              predikat: pred,
              catatan: m.catatan || '',
            };
          });
          setScores(initialScores);

          // Sinkronkan murid pertama untuk raport jika belum ada murid yang dipilih atau berpindah kelas
          if (json.muridList.length > 0) {
            setSelectedMuridId(String(json.muridList[0].murid_id));
          } else {
            setSelectedMuridId('');
            setRaportData(null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch murid dan nilai', err);
      } finally {
        setLoadingMurid(false);
      }
    };

    fetchMuridDanNilai();
  }, [selectedKelas, selectedMapel, semester, tahunAjaran]);

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
    if (!mId) return;
    setLoadingRaport(true);
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
      }
    } catch (err) {
      console.error('Failed to fetch raport', err);
    } finally {
      setLoadingRaport(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'raport' && selectedMuridId) {
      fetchRaportDetail(selectedMuridId);
    }
  }, [activeTab, selectedMuridId, semester, tahunAjaran]);

  // Handle Score Input dengan otomatisasi sekaligus fleksibilitas manual override
  const handleScoreChange = (muridId: number, field: 'harian' | 'uts' | 'uas' | 'akhir' | 'predikat' | 'catatan', val: string) => {
    setScores(prev => {
      const existing = prev[muridId] || { harian: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
      const updated = { ...existing, [field]: val };

      // Jika yang diubah adalah komponen Harian, UTS, atau UAS, hitung otomatis nilai akhir & predikat jika belum dioverride manual
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

      // Jika yang diubah langsung adalah nilai akhir secara manual, otomatis sesuaikan predikatnya
      if (field === 'akhir') {
        const numAkhir = parseFloat(val);
        if (!isNaN(numAkhir)) {
          updated.predikat = calcPredikat(numAkhir);
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
        const s = scores[m.murid_id] || { harian: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
        return {
          murid_id: m.murid_id,
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
              Pusat input nilai harian, UTS, UAS, otomatisasi rekap presensi &amp; kedisiplinan, serta cetak lembar raport resmi santri.
            </p>
          </div>

          {/* Switcher Tab Symmetris & Rata Tengah Presisi di HP */}
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
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: INPUT NILAI & LEGER KELAS                                          */}
      {/* ========================================================================= */}
      {activeTab === 'input' && (
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
                  <li>Ketik nilai pada kolom <strong>Harian (30%)</strong>, <strong>UTS (30%)</strong>, dan <strong>UAS (40%)</strong>. Nilai Akhir &amp; Predikat terhitung otomatis seketika, dan dapat diedit manual bila diperlukan.</li>
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
              {!isTamu && (
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
                  <option value="2024/2025">2024/2025</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026/2027">2026/2027</option>
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
                    : 'Kalkulasi otomatis: Harian (30%) + UTS (30%) + UAS (40%). Nilai Akhir & Predikat fleksibel dapat diubah manual.'}
                </p>
              </div>

              {isLegerMode ? (
                <div className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-bold shadow-2xs">
                  <Sparkles size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Pilih mapel tertentu untuk input / edit nilai</span>
                </div>
              ) : isTamu ? (
                <div className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-xl text-xs font-bold shadow-2xs">
                  <ShieldCheck size={14} className="shrink-0" />
                  <span>Mode Tamu — hanya lihat data</span>
                </div>
              ) : (
                <button
                  onClick={handleSaveScores}
                  disabled={savingScores || muridList.length === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all shrink-0"
                >
                  {savingScores ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{savingScores ? 'Menyimpan...' : 'Simpan Semua Nilai'}</span>
                </button>
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
                          <div className="inline-flex items-center justify-center gap-1">
                            <span>{isLegerMode ? 'Harian (Rerata)' : 'Harian (30%)'}</span>
                            {sortField === 'harian' ? (
                              sortOrder === 'asc' ? <ArrowUp size={12} className="text-amber-600 dark:text-amber-400" /> : <ArrowDown size={12} className="text-amber-600 dark:text-amber-400" />
                            ) : (
                              <ArrowUpDown size={11} className="opacity-30" />
                            )}
                          </div>
                        </th>

                        {/* Kolom UTS */}
                        <th
                          onClick={() => handleSort('uts')}
                          className="py-3.5 px-2 w-24 text-center cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                          title="Klik untuk mengurutkan Nilai UTS"
                        >
                          <div className="inline-flex items-center justify-center gap-1">
                            <span>{isLegerMode ? 'UTS (Rerata)' : 'UTS (30%)'}</span>
                            {sortField === 'uts' ? (
                              sortOrder === 'asc' ? <ArrowUp size={12} className="text-amber-600 dark:text-amber-400" /> : <ArrowDown size={12} className="text-amber-600 dark:text-amber-400" />
                            ) : (
                              <ArrowUpDown size={11} className="opacity-30" />
                            )}
                          </div>
                        </th>

                        {/* Kolom UAS */}
                        <th
                          onClick={() => handleSort('uas')}
                          className="py-3.5 px-2 w-24 text-center cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                          title="Klik untuk mengurutkan Nilai UAS"
                        >
                          <div className="inline-flex items-center justify-center gap-1">
                            <span>{isLegerMode ? 'UAS (Rerata)' : 'UAS (40%)'}</span>
                            {sortField === 'uas' ? (
                              sortOrder === 'asc' ? <ArrowUp size={12} className="text-amber-600 dark:text-amber-400" /> : <ArrowDown size={12} className="text-amber-600 dark:text-amber-400" />
                            ) : (
                              <ArrowUpDown size={11} className="opacity-30" />
                            )}
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredAndSortedMurid.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="py-10 text-center text-gray-500 dark:text-gray-400">
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
                      const cur = scores[m.murid_id] || { harian: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };

                      return (
                        <tr key={m.murid_id} className="hover:bg-amber-50/40 dark:hover:bg-gray-700/40 transition-colors">
                          <td className="py-3 px-3 text-center text-gray-500 font-semibold">{idx + 1}</td>

                          {/* Kolom Foto Santri (Avatar Lokal + Foto Mitra + Zoom Klik) */}
                          <td className="py-2.5 px-2 text-center">
                            <div
                              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full mx-auto overflow-hidden relative shadow-2xs border border-gray-200 dark:border-gray-700 ${m.foto && m.foto !== '-' ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                              onClick={() => m.foto && m.foto !== '-' ? setZoomPhoto(getFotoUrl(m.foto)) : null}
                              title={m.foto && m.foto !== '-' ? 'Klik untuk memperbesar foto' : m.nama}
                            >
                              {/* Avatar inisial lokal — selalu tampil sebagai background */}
                              <div
                                className="absolute inset-0 flex items-center justify-center"
                                style={{ backgroundColor: getAvatarColor(m.nama) }}
                              >
                                <span className="text-white text-[11px] font-bold leading-none">{getInitials(m.nama)}</span>
                              </div>
                              {/* Overlay foto santri jika ada */}
                              {m.foto && m.foto !== '-' && (
                                <img
                                  src={getFotoUrl(m.foto)}
                                  alt={m.nama}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.opacity = '0';
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                                  }}
                                />
                              )}
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
                                  className="w-18 sm:w-20 text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
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
                                  className="w-18 sm:w-20 text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
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
                                  className="w-18 sm:w-20 text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
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
      {activeTab === 'raport' && (
        <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
          {/* Header Kontrol Raport: Format Presisi HP (Pilih Santri di Atas Full-Width, Kelas & Semester Berdampingan 50%-50%, Tombol Print Rata Tengah) */}
          <div className="print:hidden bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            <div className="flex flex-col gap-3 w-full">
              {/* Baris 1: Filter Pilih Santri — Searchable Combobox */}
              <div className="w-full" ref={muridComboRef}>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Pilih Santri
                </label>
                <div className="relative">
                  {/* Input pencarian */}
                  <div
                    className={`w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 border ${showMuridDropdown ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-gray-200 dark:border-gray-600'} text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100 shadow-xs cursor-text transition-all`}
                    onClick={() => { setShowMuridDropdown(true); }}
                  >
                    <Search size={14} className="text-gray-400 shrink-0" />
                    <input
                      type="text"
                      value={showMuridDropdown ? muridSearch : (muridList.find(m => String(m.murid_id) === selectedMuridId)?.nama || '')}
                      onChange={e => { setMuridSearch(e.target.value); setShowMuridDropdown(true); }}
                      onFocus={() => { setMuridSearch(''); setShowMuridDropdown(true); }}
                      placeholder={muridList.length === 0 ? '(Belum ada data santri)' : 'Ketik nama atau NIS santri...'}
                      className="flex-1 bg-transparent outline-none font-bold text-gray-800 dark:text-gray-100 placeholder:font-normal placeholder:text-gray-400 min-w-0"
                    />
                    {selectedMuridId && !showMuridDropdown && (
                      <span className="text-[10px] font-semibold text-gray-400 shrink-0">
                        {muridList.find(m => String(m.murid_id) === selectedMuridId)?.nis || ''}
                      </span>
                    )}
                    <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform duration-200 ${showMuridDropdown ? 'rotate-180 text-amber-500' : ''}`} />
                  </div>

                  {/* Dropdown list */}
                  {showMuridDropdown && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-2xl shadow-xl overflow-hidden max-h-64 flex flex-col">
                      {filteredMuridOptions.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-gray-400 text-center">
                          {muridSearch ? `Tidak ditemukan: "${muridSearch}"` : 'Belum ada data santri'}
                        </div>
                      ) : (
                        <>
                          <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 text-[10px] text-gray-400">
                            {filteredMuridOptions.length} santri {muridSearch ? `cocok dengan "${muridSearch}"` : 'tersedia'}
                          </div>
                          <ul className="overflow-y-auto flex-1">
                            {filteredMuridOptions.map(m => {
                              const isSelected = String(m.murid_id) === selectedMuridId;
                              const q = muridSearch.trim().toLowerCase();
                              const name = m.nama || '';
                              const nis = m.nis || '';
                              // Highlight teks yang cocok
                              const highlightText = (text: string) => {
                                if (!q) return <span>{text}</span>;
                                const idx = text.toLowerCase().indexOf(q);
                                if (idx === -1) return <span>{text}</span>;
                                return (
                                  <span>
                                    {text.slice(0, idx)}
                                    <mark className="bg-amber-200 dark:bg-amber-700 text-amber-900 dark:text-amber-100 rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
                                    {text.slice(idx + q.length)}
                                  </span>
                                );
                              };
                              return (
                                <li key={m.murid_id}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedMuridId(String(m.murid_id));
                                      setMuridSearch('');
                                      setShowMuridDropdown(false);
                                      fetchRaportDetail(String(m.murid_id));
                                    }}
                                    className={`w-full text-left px-3.5 py-2 flex items-center gap-2.5 transition-colors ${isSelected ? 'bg-amber-50 dark:bg-amber-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'}`}
                                  >
                                    {/* Thumbnail Foto Santri */}
                                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 relative border border-gray-200 dark:border-gray-700 shadow-2xs">
                                      <div
                                        className="absolute inset-0 flex items-center justify-center"
                                        style={{ backgroundColor: getAvatarColor(name) }}
                                      >
                                        <span className="text-white text-[10px] font-bold leading-none">{getInitials(name)}</span>
                                      </div>
                                      {m.foto && m.foto !== '-' && (
                                        <img
                                          src={getFotoUrl(m.foto)}
                                          alt={name}
                                          className="absolute inset-0 w-full h-full object-cover"
                                          onError={(e) => {
                                            e.currentTarget.style.opacity = '0';
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                                          }}
                                        />
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className={`text-xs font-bold truncate ${isSelected ? 'text-amber-700 dark:text-amber-300' : 'text-gray-800 dark:text-gray-100'}`}>
                                        {highlightText(name)}
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        {nis && <span className="text-[10px] text-gray-400 font-mono">{highlightText(nis)}</span>}
                                        {m.nama_kelas && (
                                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                                            {m.nama_kelas}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {isSelected && <CheckCircle size={14} className="text-amber-500 shrink-0" />}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Baris 2: Filter Pilih Kelas dan Pilih Semester Berdampingan Rata Tengah dengan Ukuran Presisi Sama */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Pilih Kelas
                  </label>
                  <select
                    value={selectedKelas}
                    onChange={(e) => {
                      setSelectedKelas(e.target.value);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                  >
                    {kelasList.map(k => (
                      <option key={k.kelas_id} value={k.kelas_id}>{k.nama_kelas}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Pilih Semester
                  </label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                  >
                    <option value="1">Semester 1 (Ganjil)</option>
                    <option value="2">Semester 2 (Genap)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tombol Aksi PDF + Excel (Berdampingan 3 Kolom di HP seperti Rekapitulasi) */}
            <div className="grid grid-cols-3 sm:flex sm:justify-center gap-2 w-full pt-1">
              {/* Preview PDF */}
              <button
                onClick={() => {
                  if (!selectedMuridId) return;
                  const params = new URLSearchParams({
                    murid_id: selectedMuridId,
                    semester,
                    tahun_ajaran: tahunAjaran,
                    preview: '1',
                  });
                  window.open(`/dashboard/penilaian/preview?${params.toString()}`, '_blank', 'noopener');
                }}
                disabled={!raportData}
                className="px-2 sm:px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 sm:gap-2"
                title="Preview Lembar Raport PDF"
              >
                <FileText size={15} />
                <span>Preview<span className="hidden sm:inline"> PDF</span></span>
              </button>
              {/* Cetak / Download PDF */}
              <button
                onClick={handlePrint}
                disabled={!raportData}
                className="px-2 sm:px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 sm:gap-2"
                title="Cetak atau Download Raport PDF"
              >
                <Printer size={15} />
                <span className="sm:hidden">PDF</span>
                <span className="hidden sm:inline">Cetak / Download PDF</span>
              </button>
              {/* Unduh Excel */}
              <button
                onClick={handleExportRaportExcel}
                disabled={!raportData}
                className="px-2 sm:px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 sm:gap-2"
                title="Unduh Raport Format Excel (.xlsx)"
              >
                <Download size={15} />
                <span className="sm:hidden">Excel</span>
                <span className="hidden sm:inline">Unduh Excel</span>
              </button>
            </div>
          </div>

          {loadingRaport ? (
            <div className="p-16 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
              <RefreshCw size={32} className="animate-spin mx-auto text-amber-600 mb-3" />
              <p className="font-bold">Menyiapkan Lembar Raport Santri...</p>
              <p className="text-xs text-gray-400 mt-1">Menyinkronkan nilai, rekap absensi, dan poin kedisiplinan</p>
            </div>
          ) : !raportData ? (
            <div className="p-16 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
              <AlertCircle size={32} className="mx-auto text-gray-400 mb-3" />
              <p className="font-bold">Silakan pilih santri untuk melihat raport.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* LEMBAR RAPORT RESMI (TAMPILAN CETAK A4) */}
              <div className="bg-white text-gray-900 rounded-3xl shadow-md border border-gray-200 p-8 sm:p-12 print:border-none print:shadow-none print:p-0 print:m-0 max-w-4xl mx-auto">
                {/* KOP RESMI PESANTREN */}
                <div className="border-b-4 border-double border-gray-900 pb-4 mb-6 text-center">
                  <h3 className="text-xl sm:text-2xl font-black tracking-wider uppercase font-serif">
                    PONDOK PESANTREN MATHOLI'UL ANWAR
                  </h3>
                  <h4 className="text-base sm:text-lg font-bold uppercase text-emerald-800 font-serif">
                    MADRASAH DINIYAH &amp; LEMBAGA TAHFIDZ AL-QUR'AN
                  </h4>
                  <p className="text-xs text-gray-600 mt-1 font-sans">
                    Sugio - Lamongan - Jawa Timur | Website: ppmawar.or.id
                  </p>
                  <div className="mt-3 inline-block bg-gray-900 text-white font-bold text-xs sm:text-sm px-6 py-1 rounded-full uppercase tracking-widest">
                    LAPORAN HASIL BELAJAR SANTRI (RAPORT)
                  </div>
                </div>

                {/* IDENTITAS SANTRI DENGAN PAS FOTO RESMI */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-6 bg-gray-50 print:bg-transparent p-4 rounded-2xl border border-gray-200/60 print:border-none print:p-0">
                  {/* Pas Foto Santri Resmi */}
                  <div className="shrink-0">
                    <div
                      className={`w-20 h-24 sm:w-24 sm:h-28 rounded-xl overflow-hidden relative shadow-xs border-2 border-gray-300 dark:border-gray-600 bg-gray-100 ${raportData.santri.foto && raportData.santri.foto !== '-' ? 'cursor-pointer hover:opacity-90' : ''}`}
                      onClick={() => raportData.santri.foto && raportData.santri.foto !== '-' ? setZoomPhoto(getFotoUrl(raportData.santri.foto)) : null}
                      title="Foto Santri (klik untuk memperbesar)"
                    >
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ backgroundColor: getAvatarColor(raportData.santri.nama) }}
                      >
                        <span className="text-white text-base font-bold leading-none">{getInitials(raportData.santri.nama)}</span>
                      </div>
                      {raportData.santri.foto && raportData.santri.foto !== '-' && (
                        <img
                          src={getFotoUrl(raportData.santri.foto)}
                          alt={raportData.santri.nama}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.opacity = '0';
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Rincian Identitas Santri */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs sm:text-sm w-full">
                    <div className="space-y-1.5">
                      <div className="flex">
                        <span className="w-32 font-bold text-gray-600">Nama Santri</span>
                        <span className="font-black text-gray-900">: {raportData.santri.nama}</span>
                      </div>
                      <div className="flex">
                        <span className="w-32 font-bold text-gray-600">Nomor Induk (NIS)</span>
                        <span>: {raportData.santri.nis || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="w-32 font-bold text-gray-600">Kelas Madin</span>
                        <span>: {raportData.santri.nama_kelas_madin}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex">
                        <span className="w-32 font-bold text-gray-600">Semester / TA</span>
                        <span className="font-bold">: {raportData.semester === '1' ? '1 (Ganjil)' : '2 (Genap)'} / {raportData.tahun_ajaran}</span>
                      </div>
                      <div className="flex">
                        <span className="w-32 font-bold text-gray-600">Kamar / Asrama</span>
                        <span>: {raportData.santri.nama_kamar} ({raportData.santri.nama_asrama})</span>
                      </div>
                      <div className="flex">
                        <span className="w-32 font-bold text-gray-600">Wali Kelas</span>
                        <span>: {raportData.santri.wali_kelas || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TABEL A: HASIL BELAJAR / NILAI AKADEMIK */}
                <div className="mb-6">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">
                    <BookOpen size={14} /> A. Nilai Hasil Belajar (Madrasah Diniyah)
                  </h5>
                  <div className="border border-gray-300 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-300 font-bold text-gray-800">
                          <th className="py-2.5 px-3 w-10 text-center border-r border-gray-300">No</th>
                          <th className="py-2.5 px-3 border-r border-gray-300">Mata Pelajaran</th>
                          <th className="py-2.5 px-3 border-r border-gray-300">Kitab yang Dipelajari</th>
                          <th className="py-2.5 px-2 w-16 text-center border-r border-gray-300">KKM</th>
                          <th className="py-2.5 px-2 w-16 text-center border-r border-gray-300">Nilai</th>
                          <th className="py-2.5 px-2 w-16 text-center border-r border-gray-300">Predikat</th>
                          <th className="py-2.5 px-3">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {raportData.nilai.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-4 text-center text-gray-500 italic">
                              Belum ada nilai yang diinput untuk santri ini pada semester ini.
                            </td>
                          </tr>
                        ) : (
                          raportData.nilai.map((n: any, idx: number) => (
                            <tr key={n.id} className="hover:bg-gray-50">
                              <td className="py-2 px-3 text-center border-r border-gray-200">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold border-r border-gray-200">{n.mata_pelajaran}</td>
                              <td className="py-2 px-3 italic text-gray-700 border-r border-gray-200">{n.kitab || '-'}</td>
                              <td className="py-2 px-2 text-center border-r border-gray-200">70</td>
                              <td className="py-2 px-2 text-center font-bold text-gray-900 border-r border-gray-200">{n.nilai_akhir}</td>
                              <td className="py-2 px-2 text-center font-black border-r border-gray-200">{n.predikat}</td>
                              <td className="py-2 px-3 text-gray-600">
                                {Number(n.nilai_akhir) >= 70 ? 'Tuntas' : 'Perlu Bimbingan'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {raportData.nilai.length > 0 && (
                        <tfoot>
                          <tr className="bg-gray-100 font-bold border-t border-gray-300">
                            <td colSpan={4} className="py-2.5 px-3 text-right border-r border-gray-300 uppercase">
                              Nilai Rata-Rata Akhir:
                            </td>
                            <td className="py-2.5 px-2 text-center font-black text-emerald-800 border-r border-gray-300">
                              {raportData.ringkasan_nilai.rata_rata}
                            </td>
                            <td colSpan={2} className="py-2.5 px-3 text-xs text-gray-600">
                              Dari total {raportData.ringkasan_nilai.total_mapel} mata pelajaran
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* SINKRONISASI 1: TABEL B & C (PRESENSI & KEDISIPLINAN OTOMATIS) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {/* TABEL B: REKAPITULASI PRESENSI */}
                  <div>
                    <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">
                      <ClipboardCheck size={14} className="text-blue-600" /> B. Rekapitulasi Presensi (Otomatis)
                    </h5>
                    <div className="border border-gray-300 rounded-xl overflow-hidden text-xs">
                      <table className="w-full">
                        <tbody className="divide-y divide-gray-200">
                          <tr>
                            <td className="py-2 px-3 font-semibold bg-gray-50 border-r border-gray-200">Hadir</td>
                            <td className="py-2 px-3 font-bold text-emerald-700">{raportData.rekap_absensi.hadir} kali</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold bg-gray-50 border-r border-gray-200">Izin</td>
                            <td className="py-2 px-3 font-bold text-amber-700">{raportData.rekap_absensi.izin} kali</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold bg-gray-50 border-r border-gray-200">Sakit</td>
                            <td className="py-2 px-3 font-bold text-blue-700">{raportData.rekap_absensi.sakit} kali</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold bg-gray-50 border-r border-gray-200">Alpha / Tanpa Keterangan</td>
                            <td className="py-2 px-3 font-bold text-rose-700">{raportData.rekap_absensi.alpha} kali</td>
                          </tr>
                          <tr className="bg-gray-100 font-bold">
                            <td className="py-2 px-3 border-r border-gray-200">Persentase Kehadiran</td>
                            <td className="py-2 px-3 font-black text-gray-900">{raportData.rekap_absensi.persentase}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* TABEL C: CATATAN KEDISIPLINAN */}
                  <div>
                    <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-600" /> C. Kedisiplinan &amp; Ketertiban (Otomatis)
                    </h5>
                    <div className="border border-gray-300 rounded-xl overflow-hidden text-xs">
                      <table className="w-full">
                        <tbody className="divide-y divide-gray-200">
                          <tr>
                            <td className="py-2 px-3 font-semibold bg-gray-50 border-r border-gray-200">Total Poin Pelanggaran</td>
                            <td className="py-2 px-3 font-bold text-gray-900">{raportData.rekap_kedisiplinan.total_poin} Poin</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold bg-gray-50 border-r border-gray-200">Predikat Kedisiplinan</td>
                            <td className="py-2 px-3 font-black text-emerald-800">{raportData.rekap_kedisiplinan.predikat}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold bg-gray-50 border-r border-gray-200">Catatan Pelanggaran</td>
                            <td className="py-2 px-3 text-gray-600 italic">
                              {raportData.rekap_kedisiplinan.riwayat.length === 0
                                ? 'Tidak ada catatan pelanggaran (Disiplin baik).'
                                : `${raportData.rekap_kedisiplinan.riwayat[0].jenis} (${raportData.rekap_kedisiplinan.riwayat[0].deskripsi || '-'})`}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold bg-gray-50 border-r border-gray-200">Capaian Tahfidz</td>
                            <td className="py-2 px-3 font-bold text-gray-800">{editCatatan.tahfidz_hafalan || '-'}</td>
                          </tr>
                          <tr className="bg-gray-100 font-bold">
                            <td className="py-2 px-3 border-r border-gray-200">Keputusan Akhir</td>
                            <td className="py-2 px-3 font-black text-emerald-800">{editCatatan.status_kelulusan}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* CATATAN WALI KELAS */}
                <div className="border border-gray-300 rounded-xl p-4 mb-8 bg-gray-50 print:bg-transparent">
                  <h6 className="font-bold text-xs uppercase text-gray-700 mb-1">Catatan Wali Kelas:</h6>
                  <p className="text-xs text-gray-800 italic leading-relaxed">
                    "{editCatatan.catatan_wali_kelas || 'Tingkatkan terus prestasi belajar dan ketaatan ibadah.'}"
                  </p>
                </div>

                {/* KOLOM TANDA TANGAN RESMI */}
                <div className="grid grid-cols-3 gap-4 text-center text-xs mt-10 pt-4">
                  <div>
                    <p className="text-gray-500 mb-16">Mengetahui,<br /><strong>Orang Tua / Wali Santri</strong></p>
                    <p className="font-bold border-t border-gray-400 mx-4 pt-1">( ........................................ )</p>
                  </div>

                  <div>
                    <p className="text-gray-500 mb-16">Lamongan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br /><strong>Wali Kelas</strong></p>
                    <p className="font-bold border-t border-gray-400 mx-4 pt-1">{raportData.santri.wali_kelas || '( ........................................ )'}</p>
                  </div>

                  <div>
                    <p className="text-gray-500 mb-16">Kepala Madrasah Diniyah<br /><strong>PP. Matholi'ul Anwar</strong></p>
                    <p className="font-bold border-t border-gray-400 mx-4 pt-1">KH. Ahmad Taufiq, M.Pd.I</p>
                  </div>
                </div>
              </div>

              {/* FORM PENGISIAN CATATAN WALI KELAS & KEPRIBADIAN (Print-hidden) */}
              <div className="print:hidden bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                  <h4 className="font-extrabold text-sm sm:text-base text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <Sparkles size={18} className="text-amber-500" /> Pengaturan Catatan &amp; Kepribadian Raport
                  </h4>
                  <button
                    onClick={handleSaveRaportCatatan}
                    disabled={savingRaportCatatan}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all"
                  >
                    {savingRaportCatatan ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>{savingRaportCatatan ? 'Menyimpan...' : 'Simpan Catatan'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Capaian Tahfidz / Hafalan
                    </label>
                    <input
                      type="text"
                      value={editCatatan.tahfidz_hafalan}
                      onChange={(e) => setEditCatatan({ ...editCatatan, tahfidz_hafalan: e.target.value })}
                      placeholder="Contoh: Juz 30 (Al-A'la - An-Nas)"
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-800 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Keputusan Kenaikan / Kelulusan
                    </label>
                    <select
                      value={editCatatan.status_kelulusan}
                      onChange={(e) => setEditCatatan({ ...editCatatan, status_kelulusan: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-800 dark:text-gray-100"
                    >
                      <option value="Naik Kelas">Naik Kelas</option>
                      <option value="Tinggal di Kelas">Tinggal di Kelas</option>
                      <option value="Lulus">Lulus</option>
                      <option value="Lanjut ke Semester Berikutnya">Lanjut ke Semester Berikutnya</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Predikat Akhlak Santri
                    </label>
                    <select
                      value={editCatatan.akhlak}
                      onChange={(e) => setEditCatatan({ ...editCatatan, akhlak: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-800 dark:text-gray-100"
                    >
                      <option value="Sangat Baik">Sangat Baik</option>
                      <option value="Baik">Baik</option>
                      <option value="Cukup">Cukup</option>
                      <option value="Perlu Pembinaan">Perlu Pembinaan</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Catatan Wali Kelas untuk Santri &amp; Orang Tua
                  </label>
                  <textarea
                    rows={2}
                    value={editCatatan.catatan_wali_kelas}
                    onChange={(e) => setEditCatatan({ ...editCatatan, catatan_wali_kelas: e.target.value })}
                    placeholder="Tuliskan motivasi, saran, dan evaluasi untuk santri..."
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
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
    </div>
  );
}
