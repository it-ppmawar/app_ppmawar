'use client';

import { useState, useEffect, useRef } from 'react';
import { FileText, Clock, CalendarDays, Download, Filter, User, BookOpen, AlertCircle, ArrowRight, Search, Eye, X, Calendar, ToggleLeft, ToggleRight, ArrowUpDown, ArrowUp, ArrowDown, MapPin, List, ChevronRight, CheckCircle, AlertTriangle, Info, Loader2, BarChart3, PieChart, TrendingUp, Award, Users, CheckCircle2, XCircle, LayoutGrid, Table } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportToPDF, exportToExcel, exportStatsPDF } from '@/lib/exportUtils';

// ====== Avatar & Foto Helpers ======
const AVATAR_COLORS = [
  '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#ea580c',
  '#0891b2', '#65a30d', '#7c3aed', '#db2777', '#059669',
  '#b45309', '#0284c7', '#be123c', '#4f46e5', '#0f766e',
];
const getInitials = (nama: string): string => {
  if (!nama) return '?';
  const words = nama.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
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

// Komponen Input Tanggal dengan Format Tampilan Presisi: Tanggal/Bulan/Tahun (DD/MM/YYYY)
function FormattedDateInput({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  min?: string;
  max?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const formatDisplay = (valStr: string) => {
    if (!valStr || !/^\d{4}-\d{2}-\d{2}$/.test(valStr)) return 'Pilih Tanggal';
    const [y, m, d] = valStr.split('-');
    return `${d}/${m}/${y}`; // Tanggal/Bulan/Tahun (DD/MM/YYYY)
  };

  const handleOpenPicker = () => {
    if (inputRef.current) {
      if ('showPicker' in HTMLInputElement.prototype && typeof inputRef.current.showPicker === 'function') {
        try {
          inputRef.current.showPicker();
          return;
        } catch (_) {}
      }
      inputRef.current.focus();
      inputRef.current.click();
    }
  };

  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 mb-1">{label}</label>
      <div
        onClick={handleOpenPicker}
        className="relative flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 justify-between cursor-pointer transition-all shadow-sm group select-none"
      >
        <span className="font-mono text-xs sm:text-sm">{formatDisplay(value)}</span>
        <Calendar size={15} className="text-purple-500 group-hover:scale-110 shrink-0 ml-1.5 transition-transform" />
        <input
          ref={inputRef}
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none -z-10"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}

export default function RekapitulasiPage() {
  const [role, setRole] = useState('guru');
  const [isPengasuh, setIsPengasuh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [sortField, setSortField] = useState<'nama' | 'identifier' | 'nama_wali' | 'alamat' | 'hadir' | 'izin' | 'sakit' | 'alpha'>('nama');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);

  // Modal Detail Absensi
  const [detailModal, setDetailModal] = useState<{
    item: any;
    data: any[];
    loading: boolean;
    error: string;
    activeStatus: string; // 'semua' | 'Hadir' | 'Izin' | 'Sakit' | 'Alpha'
  } | null>(null);

  // Sorting di dalam Modal Detail Absensi
  const [detailSortField, setDetailSortField] = useState<'tanggal' | 'waktu' | 'mata_pelajaran' | 'status' | 'keterangan' | 'penginput'>('tanggal');
  const [detailSortOrder, setDetailSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter pencarian nama / nis / wali / alamat (client-side)
  const [searchNama, setSearchNama] = useState('');

  // Mode rentang tanggal
  const [modeRentang, setModeRentang] = useState(false);

  // Pilihan Tampilan: 'tabel' (Data Tabel Saja) | 'grafik' (Data Grafik Saja) | 'keduanya' (Semua)
  const [viewMode, setViewMode] = useState<'tabel' | 'grafik' | 'keduanya'>('tabel');

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Default tanggal_dari = awal bulan ini, tanggal_sampai = hari ini
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

  const [filter, setFilter] = useState({
    tipe: 'madin', // madin, quran, kegiatan, guru
    target_id: '',
    bulan: currentMonth.toString(),
    tahun: currentYear.toString(),
    tanggal_dari: firstDayStr,
    tanggal_sampai: todayStr,
  });

  const [options, setOptions] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [availableTipes, setAvailableTipes] = useState<string[]>(['madin', 'quran', 'kegiatan']);

  // Sub-filter: Majlis / Mapel / Kegiatan
  const [subFilter, setSubFilter] = useState('');
  const [subFilterOptions, setSubFilterOptions] = useState<string[]>([]);
  const [loadingSubFilter, setLoadingSubFilter] = useState(false);

  // Data timeline riwayat aktivitas presensi santri (khusus akun wali santri)
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Data tren grafik fluktuasi kehadiran harian (untuk semua role akun)
  const [trendData, setTrendData] = useState<Array<{
    tanggal: string;
    hadir: number;
    izin: number;
    sakit: number;
    alpha: number;
    total: number;
    pctHadir: number;
    pctIzin?: number;
    pctSakit?: number;
    pctAlpha?: number;
  }>>([]);
  const [hoveredTrend, setHoveredTrend] = useState<any | null>(null);

  // Toggle status garis pada grafik tren kehadiran (Hadir, Izin, Sakit, Alpha)
  const [visibleTrendLines, setVisibleTrendLines] = useState<{
    hadir: boolean;
    izin: boolean;
    sakit: boolean;
    alpha: boolean;
  }>({
    hadir: true,
    izin: true,
    sakit: true,
    alpha: true,
  });

  const toggleTrendLine = (key: 'hadir' | 'izin' | 'sakit' | 'alpha') => {
    setVisibleTrendLines(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    // Check User Role & Fetch User's Jadwal
    Promise.all([
      fetch('/api/auth/me').then(res => res.json()),
      fetch('/api/jadwal').then(res => res.json()).catch(() => ({ success: false, data: [] }))
    ])
      .then(([authData, jadwalData]) => {
        if (authData.success && authData.user) {
          const userRole = authData.user.role;
          const userIsPengasuh = userRole === 'pengasuh' || !!authData.user.is_pengasuh;
          setRole(userRole);
          setIsPengasuh(userIsPengasuh);

          const isFullRole = ['admin', 'staff'].includes(userRole);
          let allowedTipes = ['madin', 'quran', 'kegiatan'];

          if (!isFullRole && jadwalData.success && Array.isArray(jadwalData.data)) {
            const activeTipes = (['madin', 'quran', 'kegiatan'] as const).filter(t =>
              jadwalData.data.some((j: any) => j.tipe === t)
            );
            if (activeTipes.length > 0) {
              allowedTipes = activeTipes;
            }
          }

          setAvailableTipes(allowedTipes);
          const initialTipe = allowedTipes.includes('madin') ? 'madin' : allowedTipes[0];
          setFilter(prev => ({ ...prev, tipe: initialTipe }));
          loadOptions(initialTipe, userRole);
        }
      })
      .catch(() => setErrorMsg('Gagal memverifikasi akses'));
  }, []);

  const loadOptions = async (tipe: string, currentRole?: string) => {
    const activeRole = currentRole || role;
    // Special handling for dewan_guru: fixed list of homebases
    if (tipe === 'dewan_guru') {
      const homebases = [
        { id: 'SEMUA', nama: 'SEMUA UNIT / HOMEBASE' },
        { id: 'TKM NU MAWAR', nama: 'TKM NU MAWAR' },
        { id: 'MI BANIN', nama: 'MI BANIN' },
        { id: 'MI BANAT', nama: 'MI BANAT' },
        { id: 'SMP NU', nama: 'SMP NU' },
        { id: 'MTS PUTRA-PUTRI', nama: 'MTS PUTRA-PUTRI' },
        { id: 'MA MAWAR', nama: 'MA MAWAR' },
        { id: 'SMK NU', nama: 'SMK NU' },
        { id: 'MADIN', nama: 'MADIN' },
        { id: 'MQ', nama: 'MQ' },
        { id: 'KOPMA', nama: 'KOPMA' },
        { id: 'KLINIK', nama: 'KLINIK' },
        { id: 'KBIHU MAWAR', nama: 'KBIHU MAWAR' },
      ];
      setOptions(homebases);
      setFilter(prev => ({ ...prev, target_id: 'SEMUA' }));
      return;
    }

    setLoadingOptions(true);
    try {
      const res = await fetch(`/api/kelas?type=${tipe}&aggregate=true`);
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        let optData = json.data as any[];

        // Deduplikasi kamar: jika ada nama yang sama setelah normalisasi (misal A-1 dan A1), ambil satu saja
        if (tipe === 'kegiatan') {
          const seen = new Map<string, boolean>();
          optData = optData.filter((item: any) => {
            const norm = (item.nama as string).replace(/[-\s]/g, '').toLowerCase();
            if (seen.has(norm)) return false;
            seen.set(norm, true);
            return true;
          });

          optData.sort((a: any, b: any) => {
            const normA = (a.nama as string).replace(/[-\s]/g, '');
            const normB = (b.nama as string).replace(/[-\s]/g, '');
            const prefA = normA.replace(/[0-9]/g, '');
            const prefB = normB.replace(/[0-9]/g, '');
            if (prefA !== prefB) return prefA.localeCompare(prefB);
            const numA = parseInt(normA.replace(/[^0-9]/g, '') || '0', 10);
            const numB = parseInt(normB.replace(/[^0-9]/g, '') || '0', 10);
            return numA - numB;
          });
        }

        setOptions(optData);
        let targetId = optData[0].id.toString();
        if (tipe === 'guru') {
          targetId = 'all';
          setFilter(prev => ({ ...prev, target_id: 'all' })); // Default to all gurus
        } else {
          setFilter(prev => ({ ...prev, target_id: targetId }));
        }

        if (['madin', 'quran', 'kegiatan'].includes(tipe)) {
          loadSubFilterOptions(tipe, targetId);
        }

        if (activeRole === 'wali_murid' || activeRole === 'wali_alumni') {
          fetchRekap({ tipe, target_id: targetId });
        }
      } else {
        if (activeRole === 'wali_murid' || activeRole === 'wali_alumni') {
          const fallbackOpt = [{ id: 'my_child', nama: 'Santri Anda' }];
          setOptions(fallbackOpt);
          setFilter(prev => ({ ...prev, target_id: 'my_child' }));
          fetchRekap({ tipe, target_id: 'my_child' });
        } else {
          setOptions([]);
          setFilter(prev => ({ ...prev, target_id: '' }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOptions(false);
    }
  };

  const loadSubFilterOptions = async (tipe: string, targetId: string) => {
    if (!['madin', 'quran', 'kegiatan'].includes(tipe)) {
      setSubFilterOptions([]);
      setSubFilter('');
      return;
    }
    const isSemuaTarget = !targetId || ['all', 'putra', 'putri', 'SEMUA'].includes(targetId) || targetId.startsWith('asrama_');
    if (isSemuaTarget) {
      setSubFilterOptions([]);
      setSubFilter('');
      return;
    }
    setLoadingSubFilter(true);
    try {
      const qs = new URLSearchParams({ tipe, target_id: targetId }).toString();
      const res = await fetch(`/api/rekapitulasi/sub-filter?${qs}`);
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setSubFilterOptions(json.data.map((r: any) => r.nama));
      } else {
        setSubFilterOptions([]);
      }
    } catch {
      setSubFilterOptions([]);
    } finally {
      setLoadingSubFilter(false);
    }
    setSubFilter('');
  };

  const handleTipeChange = (e: any) => {
    const t = e.target.value;
    if (t === 'guru' && role !== 'admin' && role !== 'staff') {
      return;
    }
    if (t === 'dewan_guru' && role !== 'admin' && role !== 'staff' && !isPengasuh) {
      return;
    }
    if (!['admin', 'staff'].includes(role) && !availableTipes.includes(t)) {
      return;
    }
    setFilter(prev => ({ ...prev, tipe: t }));
    setSubFilter('');
    setSubFilterOptions([]);
    loadOptions(t);
  };

  const fetchTimeline = async (muridId: number | string, activeFilter: any) => {
    setLoadingTimeline(true);
    try {
      const p = new URLSearchParams({
        tipe: activeFilter.tipe,
        murid_id: String(muridId),
        ...(modeRentang ? {
          tanggal_dari: activeFilter.tanggal_dari,
          tanggal_sampai: activeFilter.tanggal_sampai,
        } : {
          bulan: activeFilter.bulan,
          tahun: activeFilter.tahun,
        })
      });
      if (subFilter) p.set('sub_filter', subFilter);
      const res = await fetch(`/api/rekapitulasi/detail?${p.toString()}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const sorted = [...json.data].sort((a: any, b: any) => {
          const dtA = `${a.tanggal || ''} ${a.jam_mulai || ''}`;
          const dtB = `${b.tanggal || ''} ${b.jam_mulai || ''}`;
          return dtB.localeCompare(dtA);
        });
        setTimelineData(sorted);
      } else {
        setTimelineData([]);
      }
    } catch {
      setTimelineData([]);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const fetchRekap = async (customFilter?: Partial<typeof filter>) => {
    const activeFilter = { ...filter, ...(customFilter || {}) };
    const isWali = role === 'wali_murid' || role === 'wali_alumni';
    if (!isWali && !activeFilter.target_id) {
      setErrorMsg('Silakan pilih kelas/kamar/target terlebih dahulu');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSearchNama(''); // Reset pencarian saat fetch baru
    try {
      let qs: string;
      if (modeRentang) {
        const p = new URLSearchParams({
          tipe: activeFilter.tipe,
          target_id: activeFilter.target_id || '',
          tanggal_dari: activeFilter.tanggal_dari,
          tanggal_sampai: activeFilter.tanggal_sampai,
        });
        if (subFilter) p.set('sub_filter', subFilter);
        qs = p.toString();
      } else {
        const p = new URLSearchParams({
          tipe: activeFilter.tipe,
          target_id: activeFilter.target_id || '',
          bulan: activeFilter.bulan,
          tahun: activeFilter.tahun,
        });
        if (subFilter) p.set('sub_filter', subFilter);
        qs = p.toString();
      }
      const res = await fetch(`/api/rekapitulasi?${qs}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setSelectedIds(json.data.map((d: any) => d.id));
        setTrendData(json.trend || []);
        if (isWali && json.data.length > 0) {
          fetchTimeline(json.data[0].id, activeFilter);
        } else {
          setTimelineData([]);
        }
      } else {
        setErrorMsg(json.error);
        setTimelineData([]);
        setTrendData([]);
      }
    } catch (e) {
      setErrorMsg('Terjadi kesalahan jaringan');
      setTimelineData([]);
      setTrendData([]);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (item: any, initialStatus: string = 'semua') => {
    setDetailSortField('tanggal');
    setDetailSortOrder('desc');
    setDetailModal({
      item,
      data: [],
      loading: true,
      error: '',
      activeStatus: initialStatus,
    });

    try {
      let qs: string;
      if (modeRentang) {
        const p = new URLSearchParams({
          tipe: filter.tipe,
          tanggal_dari: filter.tanggal_dari,
          tanggal_sampai: filter.tanggal_sampai,
        });
        if (filter.tipe === 'guru' || filter.tipe === 'dewan_guru') {
          p.set('guru_id', item.id.toString());
        } else {
          p.set('murid_id', item.id.toString());
        }
        qs = p.toString();
      } else {
        const p = new URLSearchParams({
          tipe: filter.tipe,
          bulan: filter.bulan,
          tahun: filter.tahun,
        });
        if (filter.tipe === 'guru' || filter.tipe === 'dewan_guru') {
          p.set('guru_id', item.id.toString());
        } else {
          p.set('murid_id', item.id.toString());
        }
        qs = p.toString();
      }

      const res = await fetch(`/api/rekapitulasi/detail?${qs}`);
      const json = await res.json();
      if (json.success) {
        setDetailModal(prev => prev ? { ...prev, data: json.data || [], loading: false } : null);
      } else {
        setDetailModal(prev => prev ? { ...prev, error: json.error || 'Gagal memuat detail', loading: false } : null);
      }
    } catch (err: any) {
      setDetailModal(prev => prev ? { ...prev, error: 'Terjadi kesalahan jaringan', loading: false } : null);
    }
  };

  const handleSort = (field: 'nama' | 'identifier' | 'nama_wali' | 'alamat' | 'hadir' | 'izin' | 'sakit' | 'alpha') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'nama' || field === 'identifier' || field === 'nama_wali' || field === 'alamat' ? 'asc' : 'desc');
    }
  };

  const handleDetailSort = (field: 'tanggal' | 'waktu' | 'mata_pelajaran' | 'status' | 'keterangan' | 'penginput') => {
    if (detailSortField === field) {
      setDetailSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setDetailSortField(field);
      setDetailSortOrder(field === 'tanggal' ? 'desc' : 'asc');
    }
  };

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const sortedData = [...data].sort((a, b) => {
    let res = 0;
    if (sortField === 'nama') {
      res = (a.nama || '').localeCompare(b.nama || '');
    } else if (sortField === 'identifier') {
      res = (a.identifier || '').localeCompare(b.identifier || '', undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortField === 'nama_wali') {
      res = (a.nama_wali || '').localeCompare(b.nama_wali || '');
    } else if (sortField === 'alamat') {
      res = (a.alamat || '').localeCompare(b.alamat || '');
    } else {
      const valA = Number(a[sortField] || 0);
      const valB = Number(b[sortField] || 0);
      res = valA - valB;
    }
    return sortOrder === 'asc' ? res : -res;
  });

  // Filter client-side berdasarkan searchNama, identifier, wali, atau alamat
  const filteredData = searchNama.trim()
    ? sortedData.filter(item =>
        (item.nama || '').toLowerCase().includes(searchNama.trim().toLowerCase()) ||
        (item.identifier || '').toLowerCase().includes(searchNama.trim().toLowerCase()) ||
        (item.nama_wali || '').toLowerCase().includes(searchNama.trim().toLowerCase()) ||
        (item.alamat || '').toLowerCase().includes(searchNama.trim().toLowerCase())
      )
    : sortedData;

  // Komputasi Metrik & Statistik untuk Visualisasi Grafik & Ringkasan
  const statsSummary = (() => {
    const totalOrang = filteredData.length;
    const totalHadir = filteredData.reduce((acc, cur) => acc + Number(cur.hadir || 0), 0);
    const totalIzin = filteredData.reduce((acc, cur) => acc + Number(cur.izin || 0), 0);
    const totalSakit = filteredData.reduce((acc, cur) => acc + Number(cur.sakit || 0), 0);
    const totalAlpha = filteredData.reduce((acc, cur) => acc + Number(cur.alpha || 0), 0);
    const totalPresensi = totalHadir + totalIzin + totalSakit + totalAlpha;

    const pctHadir = totalPresensi > 0 ? (totalHadir / totalPresensi) * 100 : 0;
    const pctIzin = totalPresensi > 0 ? (totalIzin / totalPresensi) * 100 : 0;
    const pctSakit = totalPresensi > 0 ? (totalSakit / totalPresensi) * 100 : 0;
    const pctAlpha = totalPresensi > 0 ? (totalAlpha / totalPresensi) * 100 : 0;

    // Kategori Individu berdasarkan kepatuhan kehadiran & catatan pelanggaran (Alpha)
    const tierPrima = filteredData.filter(d => {
      const tot = Number(d.hadir || 0) + Number(d.izin || 0) + Number(d.sakit || 0) + Number(d.alpha || 0);
      if (tot === 0) return false;
      const alpha = Number(d.alpha || 0);
      const pctHadir = Number(d.hadir || 0) / tot;
      // Prima jika kehadiran murni >= 90% ATAU (nihil alpha dan kehadiran terkonfirmasi dengan hadir mayoritas)
      return (pctHadir >= 0.90) || (alpha === 0 && (Number(d.hadir || 0) + Number(d.izin || 0) + Number(d.sakit || 0)) === tot && pctHadir >= 0.50);
    });
    const tierCukup = filteredData.filter(d => {
      const tot = Number(d.hadir || 0) + Number(d.izin || 0) + Number(d.sakit || 0) + Number(d.alpha || 0);
      if (tot === 0) return false;
      const alpha = Number(d.alpha || 0);
      const pctHadir = Number(d.hadir || 0) / tot;
      // Jika alpha === 0 tapi belum masuk prima, otomatis masuk Cukup (izin/sakit resmi terkonfirmasi)
      if (alpha === 0 && !tierPrima.some(p => p.id === d.id)) return true;
      return pctHadir >= 0.75 && pctHadir < 0.90 && alpha <= 1;
    });
    const tierKurang = filteredData.filter(d => {
      const tot = Number(d.hadir || 0) + Number(d.izin || 0) + Number(d.sakit || 0) + Number(d.alpha || 0);
      if (tot === 0) return false;
      // Hanya masuk Perlu Perhatian jika ada Alpha > 0 dan belum masuk kategori prima atau cukup
      return !tierPrima.some(p => p.id === d.id) && !tierCukup.some(c => c.id === d.id);
    });

    // Top individu dengan catatan Alpha terbanyak (perlu perhatian / pembinaan)
    const listAlpha = [...filteredData]
      .filter(d => Number(d.alpha || 0) > 0)
      .sort((a, b) => Number(b.alpha || 0) - Number(a.alpha || 0))
      .slice(0, 5);

    // Top individu dengan kehadiran terbanyak dan tanpa alpha (teladan / sangat disiplin)
    const listTeladan = [...filteredData]
      .filter(d => Number(d.hadir || 0) > 0 && Number(d.alpha || 0) === 0)
      .sort((a, b) => Number(b.hadir || 0) - Number(a.hadir || 0))
      .slice(0, 5);

    return {
      totalOrang,
      totalHadir,
      totalIzin,
      totalSakit,
      totalAlpha,
      totalPresensi,
      pctHadir,
      pctIzin,
      pctSakit,
      pctAlpha,
      tierPrima,
      tierCukup,
      tierKurang,
      listAlpha,
      listTeladan,
    };
  })();

  const getPeriodText = () => {
    if (modeRentang) {
      const fmt = (d: string) => {
        const dt = new Date(d);
        return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      };
      return `${fmt(filter.tanggal_dari)} s/d ${fmt(filter.tanggal_sampai)}`;
    }
    return `${months[parseInt(filter.bulan) - 1]} ${filter.tahun}`;
  };

  const handleExport = (format: 'pdf' | 'excel' = 'pdf', previewOnly = false) => {
    const baseData = searchNama.trim() ? filteredData : sortedData;
    const exportData = selectedIds.length > 0 
      ? baseData.filter(d => selectedIds.includes(d.id))
      : baseData;

    if (exportData.length === 0) {
      alert('Tidak ada data untuk di-export.');
      return;
    }

    let tipeText = '';
    if (filter.tipe === 'madin') tipeText = 'Absensi Madin';
    else if (filter.tipe === 'quran') tipeText = "Absensi Al-Qur'an";
    else if (filter.tipe === 'kegiatan') tipeText = 'Absensi Kegiatan Asrama';
    else if (filter.tipe === 'guru') tipeText = 'Absensi Pengajar / Guru';
    else if (filter.tipe === 'dewan_guru') tipeText = 'Presensi Dewan Guru YPMA';
    
    const rawTargetName = options.find(o => o.id.toString() === filter.target_id)?.nama || (filter.target_id === 'all' ? 'Semua Guru' : filter.target_id === 'SEMUA' ? 'Semua Unit' : '-');
    const targetName = rawTargetName.replace(/[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}]/gu, '').trim();
    
    const title = filter.tipe === 'dewan_guru' ? 'REKAPITULASI PRESENSI DEWAN GURU YPMA' : 'REKAPITULASI KEHADIRAN';
    const subtitle = filter.tipe === 'dewan_guru'
      ? `Unit / Homebase: ${targetName}`
      : `Tipe: ${tipeText}\n${filter.tipe === 'guru' ? 'Guru' : 'Kelas/Kamar'}: ${targetName}`;
    const period = getPeriodText();
    const safePeriod = modeRentang
      ? `${filter.tanggal_dari}_sd_${filter.tanggal_sampai}`
      : `${months[parseInt(filter.bulan) - 1]}_${filter.tahun}`;
    const filename = `Rekap_${tipeText.replace(/[^a-zA-Z0-9]/g, '')}_${safePeriod}`;

    const tableColumn = filter.tipe === 'dewan_guru'
      ? ["No", "Nama Lengkap", "NIP", "Unit / Homebase", "No HP / WA", "Hadir", "Izin", "Sakit", "Alpha", "% Kehadiran"]
      : ["No", "Nama Lengkap", "Identifier", "Wali / No HP", "Alamat", "Hadir", "Izin", "Sakit", "Alpha", "% Kehadiran"];
    const tableRows: any[] = [];

    exportData.forEach((item, idx) => {
      const total = Number(item.hadir) + Number(item.izin) + Number(item.sakit) + Number(item.alpha);
      const percent = total === 0 ? "0%" : `${Math.round((Number(item.hadir) / total) * 100)}%`;
      
      if (filter.tipe === 'dewan_guru') {
        tableRows.push([
          idx + 1,
          item.nama,
          item.identifier || '-',
          item.homebase || item.alamat || '-',
          item.nama_wali || item.no_hp || '-',
          item.hadir || 0,
          item.izin || 0,
          item.sakit || 0,
          item.alpha || 0,
          percent
        ]);
      } else {
        tableRows.push([
          idx + 1,
          item.nama,
          item.identifier || '-',
          item.nama_wali || '-',
          item.alamat || '-',
          item.hadir || 0,
          item.izin || 0,
          item.sakit || 0,
          item.alpha || 0,
          percent
        ]);
      }
    });

    if (format === 'excel') {
      exportToExcel({ title, subtitle, period, columns: tableColumn, rows: tableRows, filename });
    } else {
      let result: string | void;

      if (viewMode === 'grafik') {
        result = exportStatsPDF({
          title: filter.tipe === 'dewan_guru' ? 'REKAPITULASI STATISTIK DEWAN GURU YPMA' : 'REKAPITULASI STATISTIK & TREN KEHADIRAN',
          subtitle,
          period,
          summary: {
            totalOrang: statsSummary.totalOrang,
            totalPresensi: statsSummary.totalPresensi,
            totalHadir: statsSummary.totalHadir,
            totalIzin: statsSummary.totalIzin,
            totalSakit: statsSummary.totalSakit,
            totalAlpha: statsSummary.totalAlpha,
            pctHadir: statsSummary.pctHadir,
            pctIzin: statsSummary.pctIzin,
            pctSakit: statsSummary.pctSakit,
            pctAlpha: statsSummary.pctAlpha,
          },
          trendRows: trendData,
          listAlpha: statsSummary.listAlpha,
          listTeladan: statsSummary.listTeladan,
          filename: `${filename}_Statistik`,
          previewOnly
        });
      } else if (viewMode === 'keduanya') {
        result = exportStatsPDF({
          title: filter.tipe === 'dewan_guru' ? 'REKAPITULASI PRESENSI DEWAN GURU YPMA (KOMPREHENSIF)' : 'REKAPITULASI KEHADIRAN KOMPREHENSIF',
          subtitle,
          period,
          summary: {
            totalOrang: statsSummary.totalOrang,
            totalPresensi: statsSummary.totalPresensi,
            totalHadir: statsSummary.totalHadir,
            totalIzin: statsSummary.totalIzin,
            totalSakit: statsSummary.totalSakit,
            totalAlpha: statsSummary.totalAlpha,
            pctHadir: statsSummary.pctHadir,
            pctIzin: statsSummary.pctIzin,
            pctSakit: statsSummary.pctSakit,
            pctAlpha: statsSummary.pctAlpha,
          },
          trendRows: trendData,
          listAlpha: statsSummary.listAlpha,
          listTeladan: statsSummary.listTeladan,
          detailTable: {
            columns: tableColumn,
            rows: tableRows
          },
          filename: `${filename}_Komprehensif`,
          previewOnly
        });
      } else {
        result = exportToPDF({ title, subtitle, period, columns: tableColumn, rows: tableRows, filename, previewOnly });
      }

      if (previewOnly && result) {
        setPdfUrl(result);
        setShowPdfPreview(true);
      }
    }
  };

  const handleExportDetail = (format: 'pdf' | 'excel' = 'pdf', previewOnly = false) => {
    if (!detailModal || detailModal.data.length === 0) {
      alert('Tidak ada data absensi untuk diexport.');
      return;
    }

    const rawList = detailModal.activeStatus === 'semua'
      ? detailModal.data
      : detailModal.data.filter((d: any) => d.status === detailModal.activeStatus);

    if (rawList.length === 0) {
      alert(`Tidak ada data untuk status ${detailModal.activeStatus}.`);
      return;
    }

    const list = [...rawList].sort((a: any, b: any) => {
      let valA = '';
      let valB = '';
      if (detailSortField === 'tanggal') {
        valA = `${a.tanggal || ''} ${a.jam_mulai || ''}`;
        valB = `${b.tanggal || ''} ${b.jam_mulai || ''}`;
      } else if (detailSortField === 'waktu') {
        valA = a.jam_mulai || '';
        valB = b.jam_mulai || '';
      } else if (detailSortField === 'mata_pelajaran') {
        valA = (a.mata_pelajaran || '').toLowerCase();
        valB = (b.mata_pelajaran || '').toLowerCase();
      } else if (detailSortField === 'status') {
        valA = (a.status || '').toLowerCase();
        valB = (b.status || '').toLowerCase();
      } else if (detailSortField === 'keterangan') {
        valA = (a.keterangan || '').toLowerCase();
        valB = (b.keterangan || '').toLowerCase();
      } else if (detailSortField === 'penginput') {
        valA = (a.penginput || '').toLowerCase();
        valB = (b.penginput || '').toLowerCase();
      }
      return detailSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    const item = detailModal.item;
    const isGuru = filter.tipe === 'guru' || filter.tipe === 'dewan_guru';
    const tipeLabel = filter.tipe === 'madin' ? 'Madin' : filter.tipe === 'quran' ? "Qur'an" : filter.tipe === 'kegiatan' ? 'Kegiatan Asrama' : filter.tipe === 'dewan_guru' ? 'Dewan Guru YPMA' : 'Guru / Pengajar';

    const title = 'RINCIAN KEHADIRAN INDIVIDUAL';
    const subtitle = `Nama: ${item.nama}\n${isGuru ? 'NIP' : 'NIS'}: ${item.identifier || '-'}\nKategori: ${tipeLabel}${detailModal.activeStatus !== 'semua' ? `\nFilter Status: ${detailModal.activeStatus}` : ''}`;
    const period = getPeriodText();
    const safeNama = (item.nama || 'Individu').replace(/[^a-zA-Z0-9]/g, '_');
    const safePeriod = modeRentang
      ? `${filter.tanggal_dari}_sd_${filter.tanggal_sampai}`
      : `${months[parseInt(filter.bulan) - 1]}_${filter.tahun}`;
    const filename = `Rincian_Absensi_${safeNama}_${safePeriod}`;

    const columns = filter.tipe === 'dewan_guru'
      ? ['No', 'Hari, Tanggal', 'Jam Masuk', 'Sesi / Kegiatan', 'Unit / Homebase', 'Status', 'Keterangan', 'Metode / Pencatat']
      : ['No', 'Hari, Tanggal', 'Waktu', 'Jadwal / Mapel / Kegiatan', 'Kelas / Kamar', 'Status', 'Keterangan', 'Diinput Oleh'];
    const rows = list.map((r: any, idx: number) => [
      idx + 1,
      `${r.hari}, ${r.tanggal}`,
      r.jam_mulai ? `${r.jam_mulai}${r.jam_selesai ? ` - ${r.jam_selesai}` : ''}` : (r.jam_absen || '-'),
      r.mata_pelajaran || r.nama_sesi || '-',
      filter.tipe === 'dewan_guru' ? (r.kelas_nama || r.homebase || '-') : (r.kelas_nama || '-'),
      r.status || '-',
      r.keterangan || '-',
      r.penginput || '-',
    ]);

    if (format === 'excel') {
      exportToExcel({ title, subtitle, period, columns, rows, filename });
    } else {
      const result = exportToPDF({ title, subtitle, period, columns, rows, filename, previewOnly });
      if (previewOnly && result) {
        setPdfUrl(result);
        setShowPdfPreview(true);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40 rounded-3xl p-6 shadow-sm border border-purple-200 dark:border-purple-800/50 relative overflow-hidden transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-purple-200/50 dark:text-purple-800/30">
          <FileText size={120} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-purple-800 dark:text-purple-400 drop-shadow-sm flex items-center gap-2">
              <FileText size={28} /> {role === 'wali_alumni' ? 'Rekapitulasi Alumni' : role === 'wali_murid' ? 'Rekapitulasi Santri' : 'Laporan Rekapitulasi'}
            </h1>
            <p className="text-purple-600 dark:text-purple-300 text-sm mt-1 font-medium max-w-md">
              {role === 'wali_murid' || role === 'wali_alumni'
                ? 'Filter dan pantau laporan rekapitulasi kehadiran santri/anak Anda.'
                : 'Filter dan lihat laporan rekap kehadiran kelas dan guru.'}
            </p>
          </div>
          <div className="grid grid-cols-3 md:flex w-full md:w-auto gap-2 self-start md:self-center">
            <button
              onClick={() => handleExport('pdf', true)}
              className="flex items-center justify-center gap-1.5 bg-white/50 hover:bg-white dark:bg-black/20 dark:hover:bg-black/40 text-purple-800 dark:text-purple-200 px-2 sm:px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm backdrop-blur-sm text-xs sm:text-sm"
            >
              <FileText size={15} /> Preview
            </button>
            <button
              onClick={() => handleExport('pdf', false)}
              className="flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-2 sm:px-4 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-purple-600/20 backdrop-blur-sm text-xs sm:text-sm"
            >
              <Download size={15} /> PDF
            </button>
            <button
              onClick={() => handleExport('excel', false)}
              className="flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-2 sm:px-4 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-green-600/20 backdrop-blur-sm text-xs sm:text-sm"
            >
              <Download size={15} /> Excel
            </button>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300 space-y-3">

        {/* ── Baris 1: Dropdown filter — urutan: Cari Nama | Pilih Tipe | Pilih Guru/Kelas | Pilih Mapel ── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">

          {/* Kolom 1: Pencarian Nama / NIS / NIP */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">
              Cari Nama / {filter.tipe === 'guru' || filter.tipe === 'dewan_guru' ? 'NIP' : 'NIS'}
            </label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={filter.tipe === 'dewan_guru' ? 'Cari Nama / NIP / Unit...' : 'Ketik untuk mencari...'}
                value={searchNama}
                onChange={e => setSearchNama(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 transition-all placeholder:font-normal placeholder:text-gray-400"
              />
              {searchNama && (
                <button
                  onClick={() => setSearchNama('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Kolom 2: Pilih Tipe */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Pilih Tipe</label>
            <select value={filter.tipe} onChange={handleTipeChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 transition-all">
              {availableTipes.includes('madin') && (
                <option value="madin">Absensi Madin</option>
              )}
              {availableTipes.includes('quran') && (
                <option value="quran">Absensi Al-Qur'an</option>
              )}
              {availableTipes.includes('kegiatan') && (
                <option value="kegiatan">Absensi Kegiatan Asrama</option>
              )}
              {(role === 'admin' || role === 'staff') && (
                <option value="guru">Absensi Pengajar / Guru</option>
              )}
              {(role === 'admin' || role === 'staff' || isPengasuh) && (
                <option value="dewan_guru">Presensi Dewan Guru YPMA</option>
              )}
            </select>
          </div>

          {/* Kolom 3: Pilih Guru / Kelas / Homebase */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">
              {filter.tipe === 'guru' ? 'Pilih Guru' : filter.tipe === 'dewan_guru' ? 'Pilih Unit / Homebase' : 'Pilih Kelas / Kamar'}
            </label>
            <select
              value={filter.target_id}
              onChange={e => {
                const newTargetId = e.target.value;
                setFilter({...filter, target_id: newTargetId});
                if (['madin', 'quran', 'kegiatan'].includes(filter.tipe)) {
                  loadSubFilterOptions(filter.tipe, newTargetId);
                }
              }}
              disabled={loadingOptions || options.length === 0}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 disabled:opacity-50 focus:ring-2 focus:ring-purple-500 transition-all"
            >
              {loadingOptions ? (
                <option value="">Memuat...</option>
              ) : options.length === 0 ? (
                <option value="">{filter.tipe === 'guru' ? 'Tidak ada data guru' : filter.tipe === 'dewan_guru' ? 'Tidak ada unit' : 'Tidak ada akses / kelas'}</option>
              ) : (
                <>
                  {filter.tipe === 'guru' && <option value="all">Semua Guru</option>}
                  {options.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.nama}</option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Kolom 4: Sub-filter Mapel / Majlis / Kegiatan — hanya tampil jika relevan, selalu di ujung kanan */}
          <div>
            {['madin', 'quran', 'kegiatan'].includes(filter.tipe) ? (
              <>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  {filter.tipe === 'quran' ? 'Pilih Majlis' : filter.tipe === 'madin' ? 'Pilih Mapel' : 'Pilih Kegiatan'}
                </label>
                <select
                  value={subFilter}
                  onChange={e => setSubFilter(e.target.value)}
                  disabled={loadingSubFilter}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 disabled:opacity-50 focus:ring-2 focus:ring-purple-500 transition-all"
                >
                  <option value="">
                    {loadingSubFilter ? 'Memuat...' : filter.tipe === 'quran' ? 'Semua Majlis' : filter.tipe === 'madin' ? 'Semua Mapel' : 'Semua Kegiatan'}
                  </option>
                  {subFilterOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </>
            ) : (
              /* Kolom kosong untuk tipe Guru/Dewan Guru — tetap mengisi grid agar Cari Nama tidak bergeser */
              <div className="hidden md:block" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* ── Baris 2: Filter waktu + Tombol Tampilkan — 4 kolom seimbang & presisi ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">

          {/* Kolom 1: Toggle Mode Waktu */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 truncate">
              {modeRentang ? '📅 Rentang Tanggal' : '🗓️ Bulan / Tahun'}
            </label>
            <button
              type="button"
              onClick={() => setModeRentang(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 rounded-xl text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 transition-all shadow-sm cursor-pointer select-none"
              title="Klik untuk beralih mode waktu"
            >
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                {modeRentang ? 'Mode Rentang' : 'Mode Bulanan'}
              </span>
              <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg transition-all ${
                modeRentang
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {modeRentang ? <ToggleRight size={15} className="text-purple-600 dark:text-purple-400" /> : <ToggleLeft size={15} className="text-gray-500 dark:text-gray-400" />}
                {modeRentang ? 'Rentang' : 'Bulan'}
              </span>
            </button>
          </div>

          {/* Kolom 2 & 3: Input Waktu (Konsisten 2 kolom di kedua mode) */}
          {modeRentang ? (
            <>
              <div>
                <FormattedDateInput
                  label="Dari (Tgl/Bln/Thn)"
                  value={filter.tanggal_dari}
                  max={filter.tanggal_sampai}
                  onChange={val => setFilter({ ...filter, tanggal_dari: val })}
                />
              </div>
              <div>
                <FormattedDateInput
                  label="Sampai (Tgl/Bln/Thn)"
                  value={filter.tanggal_sampai}
                  min={filter.tanggal_dari}
                  onChange={val => setFilter({ ...filter, tanggal_sampai: val })}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Bulan</label>
                <select
                  value={filter.bulan}
                  onChange={e => setFilter({ ...filter, bulan: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 transition-all cursor-pointer"
                >
                  {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Tahun</label>
                <select
                  value={filter.tahun}
                  onChange={e => setFilter({ ...filter, tahun: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 transition-all cursor-pointer"
                >
                  {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Kolom 4: Tombol Tampilkan */}
          <div>
            <label className="block text-xs font-bold text-transparent mb-1 select-none hidden lg:block">
              Aksi
            </label>
            <button
              onClick={() => fetchRekap()}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-75 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Memuat...</>
              ) : (
                <><Search size={16} /> Tampilkan</>
              )}
            </button>
          </div>
        </div>


      </div>
      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-center font-bold">
          <AlertCircle size={20} className="inline mr-2" /> {errorMsg}
        </div>
      )}

      {!loading && !errorMsg && (
        <div className="space-y-6">

          {/* Status Bar Jumlah, Hint Sort & Quick Switcher Tampilan */}
          {data.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 sm:px-5 py-3 shadow-xs border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center text-xs text-gray-500 dark:text-gray-400 gap-2.5 sm:gap-3">
              <div className="flex items-center justify-center sm:justify-start w-full sm:w-auto gap-2 flex-wrap text-center sm:text-left">
                <span className="font-medium">
                  Menampilkan <strong className="text-gray-800 dark:text-gray-200">{filteredData.length}</strong> dari <strong className="text-gray-800 dark:text-gray-200">{data.length}</strong> data
                  {searchNama && <span> untuk kata kunci &quot;<strong className="text-purple-600 dark:text-purple-400">{searchNama}</strong>&quot;</span>}
                </span>
                {viewMode !== 'grafik' && (
                  <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">
                    • 💡 Klik judul kolom untuk mengurutkan
                  </span>
                )}
              </div>

              {/* Quick View Mode Switcher Pills (Memenuhi ruang & rata tengah di HP) */}
              <div className="w-full sm:w-auto grid grid-cols-3 sm:flex items-center bg-gray-100 dark:bg-gray-700/70 p-1 rounded-xl text-xs font-bold gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setViewMode('tabel')}
                  className={`px-2 sm:px-3 py-2 sm:py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none text-center ${
                    viewMode === 'tabel'
                      ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-xs font-black'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                  }`}
                  title="Tampilkan data dalam bentuk tabel saja"
                >
                  <Table size={14} className="shrink-0" />
                  <span>Tabel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grafik')}
                  className={`px-2 sm:px-3 py-2 sm:py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none text-center ${
                    viewMode === 'grafik'
                      ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-xs font-black'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                  }`}
                  title="Tampilkan data dalam bentuk grafik statistik saja"
                >
                  <BarChart3 size={14} className="shrink-0" />
                  <span>Grafik</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('keduanya')}
                  className={`px-2 sm:px-3 py-2 sm:py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none text-center ${
                    viewMode === 'keduanya'
                      ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-xs font-black'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                  }`}
                  title="Tampilkan grafik statistik dan tabel rincian sekaligus"
                >
                  <LayoutGrid size={14} className="shrink-0" />
                  <span>Keduanya</span>
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              BAGIAN 1: GRAFIK & STATISTIK REKAPITULASI
              (Tampil jika viewMode === 'grafik' atau 'keduanya')
             ═══════════════════════════════════════════════════════ */}
          {(viewMode === 'grafik' || viewMode === 'keduanya') && (
            data.length === 0 ? (
              viewMode === 'grafik' ? (
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-10 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <BarChart3 size={32} />
                  </div>
                  <h3 className="text-base font-bold text-gray-800 dark:text-white mb-1">Grafik Statistik Rekapitulasi</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    Silakan tentukan filter di atas lalu klik tombol <strong>Tampilkan</strong> untuk memuat visualisasi data grafik.
                  </p>
                </div>
              ) : null
            ) : (
              <div className="space-y-4">
                {/* 5 KPI Metric Cards: Tingkat Hadir 1 baris penuh di HP, 4 kartu status berdampingan di bawahnya */}
                <div className="grid grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                  {/* KPI 1: % Tingkat Kehadiran — Full-width di HP */}
                  <div className="col-span-4 lg:col-span-1 bg-white dark:bg-gray-800 rounded-2xl p-3.5 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400 mb-1">
                      <span className="flex items-center gap-1.5">
                        <TrendingUp size={15} />
                        Tingkat Hadir
                      </span>
                      <span className="text-[11px] font-semibold text-gray-400 sm:hidden">
                        {statsSummary.totalHadir} dari {statsSummary.totalPresensi} presensi
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between my-0.5">
                      <div className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-white">
                        {statsSummary.totalPresensi > 0 ? `${statsSummary.pctHadir.toFixed(1)}%` : '0%'}
                      </div>
                      <p className="text-[11px] text-gray-400 hidden sm:block truncate">
                        {statsSummary.totalHadir} dari {statsSummary.totalPresensi} presensi
                      </p>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-purple-600 h-full rounded-full transition-all duration-500" style={{ width: `${statsSummary.pctHadir}%` }} />
                    </div>
                  </div>

                  {/* KPI 2: Hadir — Ramping berdampingan (Kolom 1 dari 4) */}
                  <div className="col-span-1 bg-white dark:bg-gray-800 rounded-2xl p-2 sm:p-3.5 lg:p-4 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-green-600 dark:text-green-400 mb-0.5 sm:mb-1">
                      <span className="truncate">Hadir</span>
                      <CheckCircle2 size={12} className="shrink-0 hidden sm:inline" />
                    </div>
                    <div className="text-sm sm:text-2xl lg:text-3xl font-black text-gray-800 dark:text-white truncate">
                      {statsSummary.totalHadir}
                    </div>
                    <p className="text-[9px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
                      {statsSummary.pctHadir.toFixed(0)}% <span className="hidden sm:inline">dari total</span>
                    </p>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 h-1 sm:h-1.5 rounded-full mt-1.5 sm:mt-2.5 overflow-hidden">
                      <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{ width: `${statsSummary.pctHadir}%` }} />
                    </div>
                  </div>

                  {/* KPI 3: Izin — Ramping berdampingan (Kolom 2 dari 4) */}
                  <div className="col-span-1 bg-white dark:bg-gray-800 rounded-2xl p-2 sm:p-3.5 lg:p-4 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 mb-0.5 sm:mb-1">
                      <span className="truncate">Izin</span>
                      <Info size={12} className="shrink-0 hidden sm:inline" />
                    </div>
                    <div className="text-sm sm:text-2xl lg:text-3xl font-black text-gray-800 dark:text-white truncate">
                      {statsSummary.totalIzin}
                    </div>
                    <p className="text-[9px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
                      {statsSummary.pctIzin.toFixed(0)}% <span className="hidden sm:inline">dari total</span>
                    </p>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 h-1 sm:h-1.5 rounded-full mt-1.5 sm:mt-2.5 overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${statsSummary.pctIzin}%` }} />
                    </div>
                  </div>

                  {/* KPI 4: Sakit — Ramping berdampingan (Kolom 3 dari 4) */}
                  <div className="col-span-1 bg-white dark:bg-gray-800 rounded-2xl p-2 sm:p-3.5 lg:p-4 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-orange-600 dark:text-orange-400 mb-0.5 sm:mb-1">
                      <span className="truncate">Sakit</span>
                      <Clock size={12} className="shrink-0 hidden sm:inline" />
                    </div>
                    <div className="text-sm sm:text-2xl lg:text-3xl font-black text-gray-800 dark:text-white truncate">
                      {statsSummary.totalSakit}
                    </div>
                    <p className="text-[9px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
                      {statsSummary.pctSakit.toFixed(0)}% <span className="hidden sm:inline">dari total</span>
                    </p>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 h-1 sm:h-1.5 rounded-full mt-1.5 sm:mt-2.5 overflow-hidden">
                      <div className="bg-orange-500 h-full rounded-full transition-all duration-500" style={{ width: `${statsSummary.pctSakit}%` }} />
                    </div>
                  </div>

                  {/* KPI 5: Alpha — Ramping berdampingan (Kolom 4 dari 4) */}
                  <div className="col-span-1 bg-white dark:bg-gray-800 rounded-2xl p-2 sm:p-3.5 lg:p-4 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-red-600 dark:text-red-400 mb-0.5 sm:mb-1">
                      <span className="truncate">Alpha</span>
                      <AlertTriangle size={12} className="shrink-0 hidden sm:inline" />
                    </div>
                    <div className="text-sm sm:text-2xl lg:text-3xl font-black text-gray-800 dark:text-white truncate">
                      {statsSummary.totalAlpha}
                    </div>
                    <p className="text-[9px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
                      {statsSummary.pctAlpha.toFixed(0)}% <span className="hidden sm:inline">dari total</span>
                    </p>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 h-1 sm:h-1.5 rounded-full mt-1.5 sm:mt-2.5 overflow-hidden">
                      <div className="bg-red-500 h-full rounded-full transition-all duration-500" style={{ width: `${statsSummary.pctAlpha}%` }} />
                    </div>
                  </div>
                </div>

                {/* 2 Main Visualizations: Donut Chart & Distribusi Kedisiplinan */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Card 1: Donut Chart Proporsi */}
                  <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                          <PieChart size={18} />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-gray-800 dark:text-white">Proporsi Kehadiran</h4>
                          <p className="text-[11px] text-gray-400">Rasio persentase status dari {statsSummary.totalPresensi} catatan</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
                      {/* SVG Donut Chart */}
                      {(() => {
                        const circumference = 251.327; // 2 * PI * 40
                        const hadirDash = (statsSummary.pctHadir / 100) * circumference;
                        const izinDash = (statsSummary.pctIzin / 100) * circumference;
                        const sakitDash = (statsSummary.pctSakit / 100) * circumference;
                        const alphaDash = (statsSummary.pctAlpha / 100) * circumference;

                        const offsetHadir = 0;
                        const offsetIzin = -hadirDash;
                        const offsetSakit = -(hadirDash + izinDash);
                        const offsetAlpha = -(hadirDash + izinDash + sakitDash);

                        return (
                          <div className="relative w-40 h-40 sm:w-44 sm:h-44 flex items-center justify-center shrink-0">
                            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                                stroke="currentColor"
                                strokeWidth="12"
                                className="text-gray-100 dark:text-gray-700/60"
                              />
                              {statsSummary.totalPresensi > 0 && (
                                <>
                                  {hadirDash > 0 && (
                                    <circle
                                      cx="50"
                                      cy="50"
                                      r="40"
                                      fill="transparent"
                                      stroke="#22c55e"
                                      strokeWidth="12"
                                      strokeDasharray={`${hadirDash} ${circumference}`}
                                      strokeDashoffset={offsetHadir}
                                      className="transition-all duration-500"
                                    />
                                  )}
                                  {izinDash > 0 && (
                                    <circle
                                      cx="50"
                                      cy="50"
                                      r="40"
                                      fill="transparent"
                                      stroke="#3b82f6"
                                      strokeWidth="12"
                                      strokeDasharray={`${izinDash} ${circumference}`}
                                      strokeDashoffset={offsetIzin}
                                      className="transition-all duration-500"
                                    />
                                  )}
                                  {sakitDash > 0 && (
                                    <circle
                                      cx="50"
                                      cy="50"
                                      r="40"
                                      fill="transparent"
                                      stroke="#f97316"
                                      strokeWidth="12"
                                      strokeDasharray={`${sakitDash} ${circumference}`}
                                      strokeDashoffset={offsetSakit}
                                      className="transition-all duration-500"
                                    />
                                  )}
                                  {alphaDash > 0 && (
                                    <circle
                                      cx="50"
                                      cy="50"
                                      r="40"
                                      fill="transparent"
                                      stroke="#ef4444"
                                      strokeWidth="12"
                                      strokeDasharray={`${alphaDash} ${circumference}`}
                                      strokeDashoffset={offsetAlpha}
                                      className="transition-all duration-500"
                                    />
                                  )}
                                </>
                              )}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                              <span className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-white leading-none">
                                {statsSummary.totalPresensi > 0 ? `${statsSummary.pctHadir.toFixed(0)}%` : '0%'}
                              </span>
                              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-1">
                                Hadir
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Detail Status Breakdown */}
                      <div className="flex-1 space-y-2.5 w-full">
                        {/* Hadir */}
                        <div>
                          <div className="flex justify-between items-center text-xs font-bold mb-1">
                            <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                              <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                              Hadir
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              <strong className="text-green-600 dark:text-green-400">{statsSummary.totalHadir}</strong> ({statsSummary.pctHadir.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700/60 rounded-full h-2 overflow-hidden">
                            <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{ width: `${statsSummary.pctHadir}%` }} />
                          </div>
                        </div>

                        {/* Izin */}
                        <div>
                          <div className="flex justify-between items-center text-xs font-bold mb-1">
                            <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                              Izin
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              <strong className="text-blue-600 dark:text-blue-400">{statsSummary.totalIzin}</strong> ({statsSummary.pctIzin.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700/60 rounded-full h-2 overflow-hidden">
                            <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${statsSummary.pctIzin}%` }} />
                          </div>
                        </div>

                        {/* Sakit */}
                        <div>
                          <div className="flex justify-between items-center text-xs font-bold mb-1">
                            <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                              Sakit
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              <strong className="text-orange-600 dark:text-orange-400">{statsSummary.totalSakit}</strong> ({statsSummary.pctSakit.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700/60 rounded-full h-2 overflow-hidden">
                            <div className="bg-orange-500 h-full rounded-full transition-all duration-500" style={{ width: `${statsSummary.pctSakit}%` }} />
                          </div>
                        </div>

                        {/* Alpha */}
                        <div>
                          <div className="flex justify-between items-center text-xs font-bold mb-1">
                            <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                              Alpha
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              <strong className="text-red-600 dark:text-red-400">{statsSummary.totalAlpha}</strong> ({statsSummary.pctAlpha.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700/60 rounded-full h-2 overflow-hidden">
                            <div className="bg-red-500 h-full rounded-full transition-all duration-500" style={{ width: `${statsSummary.pctAlpha}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Grafik Tren Kehadiran Harian (%) — Time-Series Line & Area Chart (Untuk Semua Role Akun) */}
                  <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <div>
                      {/* Header Card 2 */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shrink-0">
                            <TrendingUp size={18} />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-gray-800 dark:text-white">
                              Tren Kehadiran {modeRentang ? 'Rentang Tanggal' : 'Bulanan'} (%)
                            </h4>
                            <p className="text-[11px] text-gray-400">
                              Fluktuasi tingkat kehadiran per tanggal sesi
                            </p>
                          </div>
                        </div>

                        {/* Legend & Interactive Status Toggle Pills */}
                        <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0 flex-wrap">
                          <button
                            type="button"
                            onClick={() => toggleTrendLine('hadir')}
                            className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                              visibleTrendLines.hadir
                                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-xs'
                                : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60 line-through'
                            }`}
                            title="Klik untuk tampilkan/sembunyikan tren Hadir"
                          >
                            <span className={`w-2 h-2 rounded-full ${visibleTrendLines.hadir ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                            Hadir
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleTrendLine('izin')}
                            className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                              visibleTrendLines.izin
                                ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-xs'
                                : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60 line-through'
                            }`}
                            title="Klik untuk tampilkan/sembunyikan tren Izin"
                          >
                            <span className={`w-2 h-2 rounded-full ${visibleTrendLines.izin ? 'bg-blue-500' : 'bg-gray-400'}`} />
                            Izin
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleTrendLine('sakit')}
                            className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                              visibleTrendLines.sakit
                                ? 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-700 shadow-xs'
                                : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60 line-through'
                            }`}
                            title="Klik untuk tampilkan/sembunyikan tren Sakit"
                          >
                            <span className={`w-2 h-2 rounded-full ${visibleTrendLines.sakit ? 'bg-orange-500' : 'bg-gray-400'}`} />
                            Sakit
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleTrendLine('alpha')}
                            className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                              visibleTrendLines.alpha
                                ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 shadow-xs'
                                : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60 line-through'
                            }`}
                            title="Klik untuk tampilkan/sembunyikan tren Alpha"
                          >
                            <span className={`w-2 h-2 rounded-full ${visibleTrendLines.alpha ? 'bg-red-500' : 'bg-gray-400'}`} />
                            Alpha
                          </button>

                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-lg border border-amber-200/50 dark:border-amber-800/40">
                            <span className="w-3 h-0.5 bg-amber-500 rounded-full" />
                            Target 85%
                          </span>

                          {/* Tombol Cepat Cetak PDF Statistik & Tren */}
                          <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-1.5 ml-0.5">
                            <button
                              type="button"
                              onClick={() => handleExport('pdf', true)}
                              className="flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800/40 transition-all cursor-pointer shadow-xs"
                              title="Pratinjau PDF Laporan Statistik & Tren"
                            >
                              <FileText size={12} />
                              <span>Preview PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExport('pdf', false)}
                              className="flex items-center gap-1 text-[11px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-2.5 py-1 rounded-lg transition-all shadow-xs cursor-pointer"
                              title="Unduh PDF Laporan Statistik & Tren"
                            >
                              <Download size={12} />
                              <span>PDF</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Hover Info Bar */}
                      <div className="min-h-[38px] mb-2 flex items-center justify-between text-xs px-3 py-1.5 rounded-xl bg-gray-50/80 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/60 transition-all">
                        {hoveredTrend ? (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-1.5 sm:gap-2 animate-in fade-in duration-200">
                            <span className="font-extrabold text-gray-800 dark:text-gray-100 flex items-center gap-1.5 shrink-0">
                              <Calendar size={13} className="text-purple-600 dark:text-purple-400" />
                              {(() => {
                                const parts = (hoveredTrend.tanggal || '').split('-');
                                if (parts.length !== 3) return hoveredTrend.tanggal;
                                const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                                return dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                              })()}
                            </span>
                            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] flex-wrap">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 px-1.5 py-0.5 rounded-md">
                                {(hoveredTrend.pctHadir ?? 0).toFixed(1)}% Hadir ({hoveredTrend.hadir})
                              </span>
                              <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 px-1.5 py-0.5 rounded-md">
                                {(hoveredTrend.pctIzin ?? 0).toFixed(1)}% Izin ({hoveredTrend.izin})
                              </span>
                              <span className="font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-800/40 px-1.5 py-0.5 rounded-md">
                                {(hoveredTrend.pctSakit ?? 0).toFixed(1)}% Sakit ({hoveredTrend.sakit})
                              </span>
                              <span className="font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200/60 dark:border-red-800/40 px-1.5 py-0.5 rounded-md">
                                {(hoveredTrend.pctAlpha ?? 0).toFixed(1)}% Alpha ({hoveredTrend.alpha})
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full text-[11px] text-gray-500 dark:text-gray-400">
                            <span>Arahkan kursor atau sentuh titik grafik untuk rincian status</span>
                            <span className="font-bold text-gray-700 dark:text-gray-300">
                              {trendData.length} Hari Pertemuan
                            </span>
                          </div>
                        )}
                      </div>

                      {/* SVG Chart Area */}
                      {trendData.length === 0 ? (
                        <div className="py-12 text-center bg-gray-50/60 dark:bg-gray-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                          <CalendarDays size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Belum ada catatan aktivitas presensi pada rentang waktu ini.
                          </p>
                        </div>
                      ) : (
                        (() => {
                          const svgW = 600;
                          const svgH = 210;
                          const padL = 40;
                          const padR = 20;
                          const padT = 20;
                          const padB = 40;
                          const plotW = svgW - padL - padR;
                          const plotH = svgH - padT - padB;

                          const getY = (pct: number) => padT + plotH * (1 - Math.max(0, Math.min(100, pct)) / 100);
                          const getX = (idx: number) => {
                            if (trendData.length === 1) return padL + plotW / 2;
                            return padL + (idx / (trendData.length - 1)) * plotW;
                          };

                          const targetY = getY(85);

                          const buildSmoothPath = (pts: { x: number; y: number }[]) => {
                            return pts.reduce((acc, p, i, arr) => {
                              if (i === 0) return `M ${p.x} ${p.y}`;
                              const prev = arr[i - 1];
                              const cp1x = prev.x + (p.x - prev.x) / 2;
                              const cp1y = prev.y;
                              const cp2x = prev.x + (p.x - prev.x) / 2;
                              const cp2y = p.y;
                              return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`;
                            }, '');
                          };

                          const pointsHadir = trendData.map((d, i) => ({
                            x: getX(i),
                            y: getY(d.pctHadir ?? 0),
                            val: d.pctHadir ?? 0,
                            data: d,
                          }));

                          const pointsIzin = trendData.map((d, i) => ({
                            x: getX(i),
                            y: getY(d.pctIzin ?? 0),
                            val: d.pctIzin ?? 0,
                            data: d,
                          }));

                          const pointsSakit = trendData.map((d, i) => ({
                            x: getX(i),
                            y: getY(d.pctSakit ?? 0),
                            val: d.pctSakit ?? 0,
                            data: d,
                          }));

                          const pointsAlpha = trendData.map((d, i) => ({
                            x: getX(i),
                            y: getY(d.pctAlpha ?? 0),
                            val: d.pctAlpha ?? 0,
                            data: d,
                          }));

                          const pathHadir = buildSmoothPath(pointsHadir);
                          const pathIzin = buildSmoothPath(pointsIzin);
                          const pathSakit = buildSmoothPath(pointsSakit);
                          const pathAlpha = buildSmoothPath(pointsAlpha);

                          const areaPathHadir = pointsHadir.length > 0
                            ? `${pathHadir} L ${pointsHadir[pointsHadir.length - 1].x} ${padT + plotH} L ${pointsHadir[0].x} ${padT + plotH} Z`
                            : '';

                          // Interval label tanggal agar tidak bertumpukan
                          const totalPoints = pointsHadir.length;
                          const labelInterval = totalPoints > 20 ? 4 : totalPoints > 10 ? 2 : 1;

                          return (
                            <div className="relative w-full overflow-hidden select-none">
                              <svg
                                className="w-full h-auto"
                                viewBox={`0 0 ${svgW} ${svgH}`}
                                onMouseLeave={() => setHoveredTrend(null)}
                              >
                                <defs>
                                  <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                                    <stop offset="90%" stopColor="#10b981" stopOpacity="0.02" />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                  </linearGradient>
                                </defs>

                                {/* Grid Horizontal Y-Axis (0%, 25%, 50%, 75%, 100%) */}
                                {[100, 75, 50, 25, 0].map(pct => {
                                  const y = getY(pct);
                                  return (
                                    <g key={pct}>
                                      <line
                                        x1={padL}
                                        y1={y}
                                        x2={padL + plotW}
                                        y2={y}
                                        stroke="currentColor"
                                        strokeWidth="1"
                                        strokeDasharray={pct === 0 ? 'none' : '3 3'}
                                        className="text-gray-100 dark:text-gray-700/60"
                                      />
                                      <text
                                        x={padL - 6}
                                        y={y + 3}
                                        textAnchor="end"
                                        className="text-[9px] font-bold fill-gray-400 dark:fill-gray-500"
                                      >
                                        {pct}%
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* Garis Ambang Batas Target 85% */}
                                <line
                                  x1={padL}
                                  y1={targetY}
                                  x2={padL + plotW}
                                  y2={targetY}
                                  stroke="#f59e0b"
                                  strokeWidth="1.2"
                                  strokeDasharray="4 4"
                                  className="opacity-75"
                                />

                                {/* Area Gradient di bawah Garis Tren Hadir (jika aktif) */}
                                {visibleTrendLines.hadir && areaPathHadir && (
                                  <path d={areaPathHadir} fill="url(#trendAreaGradient)" />
                                )}

                                {/* Garis Tren Izin (Biru) */}
                                {visibleTrendLines.izin && pathIzin && (
                                  <path
                                    d={pathIzin}
                                    fill="none"
                                    stroke="#3b82f6"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                )}

                                {/* Garis Tren Sakit (Orange) */}
                                {visibleTrendLines.sakit && pathSakit && (
                                  <path
                                    d={pathSakit}
                                    fill="none"
                                    stroke="#f97316"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                )}

                                {/* Garis Tren Alpha (Merah) */}
                                {visibleTrendLines.alpha && pathAlpha && (
                                  <path
                                    d={pathAlpha}
                                    fill="none"
                                    stroke="#ef4444"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                )}

                                {/* Garis Tren Hadir (Hijau Emerald) */}
                                {visibleTrendLines.hadir && pathHadir && (
                                  <path
                                    d={pathHadir}
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth="2.75"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                )}

                                {/* Titik Dots & Tooltip Hitbox */}
                                {pointsHadir.map((p, idx) => {
                                  const isHovered = hoveredTrend?.tanggal === p.data.tanggal;
                                  const showLabel = idx === 0 || idx === pointsHadir.length - 1 || idx % labelInterval === 0;
                                  const tglParts = (p.data.tanggal || '').split('-');
                                  const displayLabel = tglParts.length === 3 ? `${tglParts[2]}/${tglParts[1]}` : p.data.tanggal;

                                  return (
                                    <g
                                      key={idx}
                                      className="cursor-pointer"
                                      onMouseEnter={() => setHoveredTrend(p.data)}
                                      onTouchStart={() => setHoveredTrend(p.data)}
                                    >
                                      {/* Invisible Hitbox tinggi penuh untuk memudahkan hover / touch pada ponsel */}
                                      <rect
                                        x={p.x - 12}
                                        y={padT}
                                        width="24"
                                        height={plotH}
                                        fill="transparent"
                                      />

                                      {/* Garis bantu vertikal saat di-hover */}
                                      {isHovered && (
                                        <line
                                          x1={p.x}
                                          y1={padT}
                                          x2={p.x}
                                          y2={padT + plotH}
                                          stroke="#6b7280"
                                          strokeWidth="1"
                                          strokeDasharray="2 2"
                                          className="opacity-50"
                                        />
                                      )}

                                      {/* Dots untuk Izin */}
                                      {visibleTrendLines.izin && (
                                        <circle
                                          cx={p.x}
                                          cy={pointsIzin[idx].y}
                                          r={isHovered ? 5 : 2.5}
                                          fill={isHovered ? '#3b82f6' : '#ffffff'}
                                          stroke="#3b82f6"
                                          strokeWidth={isHovered ? 2 : 1.5}
                                          className="transition-all duration-150"
                                        />
                                      )}

                                      {/* Dots untuk Sakit */}
                                      {visibleTrendLines.sakit && (
                                        <circle
                                          cx={p.x}
                                          cy={pointsSakit[idx].y}
                                          r={isHovered ? 5 : 2.5}
                                          fill={isHovered ? '#f97316' : '#ffffff'}
                                          stroke="#f97316"
                                          strokeWidth={isHovered ? 2 : 1.5}
                                          className="transition-all duration-150"
                                        />
                                      )}

                                      {/* Dots untuk Alpha */}
                                      {visibleTrendLines.alpha && (
                                        <circle
                                          cx={p.x}
                                          cy={pointsAlpha[idx].y}
                                          r={isHovered ? 5 : 2.5}
                                          fill={isHovered ? '#ef4444' : '#ffffff'}
                                          stroke="#ef4444"
                                          strokeWidth={isHovered ? 2 : 1.5}
                                          className="transition-all duration-150"
                                        />
                                      )}

                                      {/* Dots untuk Hadir (Paling Depan) */}
                                      {visibleTrendLines.hadir && (
                                        <circle
                                          cx={p.x}
                                          cy={p.y}
                                          r={isHovered ? 6 : 3}
                                          fill={isHovered ? '#10b981' : '#ffffff'}
                                          stroke="#10b981"
                                          strokeWidth={isHovered ? 2.5 : 2}
                                          className="transition-all duration-150"
                                        />
                                      )}

                                      {/* Label Sumbu X (Tanggal) */}
                                      {showLabel && (
                                        <text
                                          x={p.x}
                                          y={padT + plotH + 18}
                                          textAnchor="middle"
                                          className={`text-[9px] font-semibold transition-colors ${
                                            isHovered
                                              ? 'fill-emerald-600 dark:fill-emerald-400 font-bold'
                                              : 'fill-gray-400 dark:fill-gray-500'
                                          }`}
                                        >
                                          {displayLabel}
                                        </text>
                                      )}
                                    </g>
                                  );
                                })}
                              </svg>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
                </div>

                {/* Highlights Section: Khusus Wali Santri (Evaluasi Personal) ATAU Guru/Admin (2 Ranking Cards) */}
                {role === 'wali_murid' || role === 'wali_alumni' ? (
                  <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                          <Award size={18} />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-gray-800 dark:text-white">Evaluasi & Catatan Kehadiran Santri</h4>
                          <p className="text-[11px] text-gray-400">Ringkasan kedisiplinan dan pembinaan ananda</p>
                        </div>
                      </div>
                    </div>

                    {statsSummary.totalAlpha === 0 ? (
                      <div className="p-6 text-center bg-emerald-50/70 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/40">
                        <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
                        <div className="font-bold text-base text-emerald-800 dark:text-emerald-300">MasyaAllah! Nihil Catatan Alpha</div>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 max-w-md mx-auto">
                          Ananda tertib dan tidak memiliki catatan bolos / alpha pada periode ini. Ketidakhadiran (jika ada) telah terkonfirmasi dengan izin resmi. Terima kasih atas dukungan dan perhatian Bapak/Ibu Wali Santri.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs font-bold">
                          <span className="px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200">
                            ✅ {statsSummary.totalHadir}x Hadir
                          </span>
                          <span className="px-3 py-1 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
                            📝 {statsSummary.totalIzin}x Izin Resmi
                          </span>
                          <span className="px-3 py-1 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200">
                            💊 {statsSummary.totalSakit}x Sakit
                          </span>
                          <span className="px-3 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            🎉 0 Alpha
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center bg-red-50/70 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-800/40">
                        <AlertTriangle size={36} className="mx-auto text-red-500 mb-2" />
                        <div className="font-bold text-base text-red-800 dark:text-red-300">
                          Catatan Pembinaan: Terdapat {statsSummary.totalAlpha}x Pertemuan Alpha
                        </div>
                        <p className="text-xs text-red-700 dark:text-red-400 mt-1 max-w-md mx-auto">
                          Terdapat catatan ketidakhadiran tanpa keterangan pada periode ini. Mohon berkenan konfirmasi atau berkoordinasi dengan wali kelas / pengurus asrama.
                        </p>
                        {filteredData.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openDetail(filteredData[0], 'Alpha')}
                            className="mt-4 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-red-600/20 cursor-pointer"
                          >
                            <Eye size={14} /> Lihat Tanggal & Detail Alpha
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* 2 Highlights Cards untuk Guru/Admin/Staf (Alpha Terbanyak & Teladan Disiplin) */
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Highlight 1: Alpha Terbanyak */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                            <AlertTriangle size={18} />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-gray-800 dark:text-white">Perhatian: Alpha Terbanyak</h4>
                            <p className="text-[11px] text-gray-400">Individu yang paling membutuhkan perhatian / tindak lanjut</p>
                          </div>
                        </div>
                      </div>

                      {statsSummary.listAlpha.length === 0 ? (
                        <div className="p-6 text-center bg-emerald-50/70 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/40">
                          <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                          <div className="font-bold text-sm text-emerald-800 dark:text-emerald-300">Nihil Catatan Alpha</div>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                            MasyaAllah! Seluruh {filter.tipe === 'guru' || filter.tipe === 'dewan_guru' ? 'pengajar' : 'santri'} tertib (0 Alpha pada periode ini).
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {statsSummary.listAlpha.map((item, idx) => {
                            const fotoUrl = getFotoUrl(item.foto);
                            const totalPertemuan = Number(item.hadir) + Number(item.izin) + Number(item.sakit) + Number(item.alpha);
                            const presentase = totalPertemuan === 0 ? 0 : Math.round((Number(item.hadir) / totalPertemuan) * 100);
                            return (
                              <div
                                key={item.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-3 bg-gray-50/70 dark:bg-gray-900/40 hover:bg-red-50/40 dark:hover:bg-red-950/20 rounded-2xl transition-colors border border-gray-100 dark:border-gray-700/50 gap-2 sm:gap-3"
                              >
                                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                                  <span className="w-5 text-center text-xs font-bold text-gray-400 shrink-0">{idx + 1}</span>
                                  <div
                                    className={`w-9 h-9 rounded-full overflow-hidden relative border border-gray-200 dark:border-gray-700 shrink-0 ${fotoUrl ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                                    onClick={() => fotoUrl && setZoomPhoto(fotoUrl)}
                                    title={fotoUrl ? 'Klik untuk memperbesar' : item.nama}
                                  >
                                    {fotoUrl ? (
                                      <img src={fotoUrl} alt={item.nama} className="w-full h-full object-cover" />
                                    ) : (
                                      <div
                                        className="w-full h-full flex items-center justify-center text-white text-[11px] font-bold"
                                        style={{ backgroundColor: getAvatarColor(item.nama) }}
                                      >
                                        {getInitials(item.nama)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div
                                      onClick={() => openDetail(item, 'Alpha')}
                                      className="text-xs font-bold text-gray-800 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer truncate"
                                      title={item.nama}
                                    >
                                      {item.nama}
                                    </div>
                                    <div className="text-[10px] text-gray-400 truncate">
                                      {filter.tipe === 'guru' || filter.tipe === 'dewan_guru' ? 'NIP' : 'NIS'}: {item.identifier || '-'} • Kehadiran {presentase}%
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pl-7 sm:pl-0 pt-1.5 sm:pt-0 border-t border-gray-100 dark:border-gray-800/60 sm:border-t-0">
                                  <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-extrabold text-xs px-2.5 py-1 rounded-lg">
                                    {item.alpha}x Alpha
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openDetail(item, 'Alpha')}
                                    className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline px-2 py-1 cursor-pointer bg-purple-50 dark:bg-purple-950/30 sm:bg-transparent sm:dark:bg-transparent rounded-lg sm:rounded-none"
                                    title="Buka rincian data absensi"
                                  >
                                    Rincian
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Highlight 2: Disiplin Tertinggi (Teladan) */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                            <Award size={18} />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-gray-800 dark:text-white">Apresiasi: Disiplin Tertinggi</h4>
                            <p className="text-[11px] text-gray-400">Individu dengan kehadiran terbanyak tanpa catatan alpha</p>
                          </div>
                        </div>
                      </div>

                      {statsSummary.listTeladan.length === 0 ? (
                        <div className="p-6 text-center bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-200 dark:border-gray-700">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Belum ada catatan kehadiran santri dengan 0 alpha pada periode yang dipilih.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {statsSummary.listTeladan.map((item, idx) => {
                            const fotoUrl = getFotoUrl(item.foto);
                            const totalPertemuan = Number(item.hadir) + Number(item.izin) + Number(item.sakit) + Number(item.alpha);
                            const presentase = totalPertemuan === 0 ? 0 : Math.round((Number(item.hadir) / totalPertemuan) * 100);
                            return (
                              <div
                                key={item.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-3 bg-gray-50/70 dark:bg-gray-900/40 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 rounded-2xl transition-colors border border-gray-100 dark:border-gray-700/50 gap-2 sm:gap-3"
                              >
                                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                                  <span className="w-5 text-center text-xs font-bold text-amber-500 shrink-0">#{idx + 1}</span>
                                  <div
                                    className={`w-9 h-9 rounded-full overflow-hidden relative border border-gray-200 dark:border-gray-700 shrink-0 ${fotoUrl ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                                    onClick={() => fotoUrl && setZoomPhoto(fotoUrl)}
                                    title={fotoUrl ? 'Klik untuk memperbesar' : item.nama}
                                  >
                                    {fotoUrl ? (
                                      <img src={fotoUrl} alt={item.nama} className="w-full h-full object-cover" />
                                    ) : (
                                      <div
                                        className="w-full h-full flex items-center justify-center text-white text-[11px] font-bold"
                                        style={{ backgroundColor: getAvatarColor(item.nama) }}
                                      >
                                        {getInitials(item.nama)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div
                                      onClick={() => openDetail(item, 'Hadir')}
                                      className="text-xs font-bold text-gray-800 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer truncate"
                                      title={item.nama}
                                    >
                                      {item.nama}
                                    </div>
                                    <div className="text-[10px] text-gray-400 truncate">
                                      {filter.tipe === 'guru' || filter.tipe === 'dewan_guru' ? 'NIP' : 'NIS'}: {item.identifier || '-'} • Kehadiran {presentase}%
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pl-7 sm:pl-0 pt-1.5 sm:pt-0 border-t border-gray-100 dark:border-gray-800/60 sm:border-t-0">
                                  <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-extrabold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1">
                                    <CheckCircle2 size={12} /> {item.hadir}x Hadir
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openDetail(item, 'Hadir')}
                                    className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline px-2 py-1 cursor-pointer bg-purple-50 dark:bg-purple-950/30 sm:bg-transparent sm:dark:bg-transparent rounded-lg sm:rounded-none"
                                    title="Buka rincian data absensi"
                                  >
                                    Rincian
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* Pemisah Antara Grafik dan Tabel jika Mode Keduanya Aktif */}
          {viewMode === 'keduanya' && data.length > 0 && (
            <div className="flex items-center gap-3 pt-2">
              <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 flex items-center gap-1.5 shadow-2xs">
                <Table size={13} className="text-purple-500" /> Rincian Data Tabel
              </span>
              <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              BAGIAN 2: TABEL DATA
              (Tampil jika viewMode === 'tabel' atau 'keduanya')
             ═══════════════════════════════════════════════════════ */}
          {(viewMode === 'tabel' || viewMode === 'keduanya') && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
              <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="px-5 py-4 w-10 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                      checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(filteredData.map(d => d.id));
                        else setSelectedIds([]);
                      }}
                      title="Pilih Semua"
                    />
                  </th>
                  <th className="px-5 py-4 w-10 text-center">NO</th>
                  <th className="px-3 py-4 text-center">FOTO</th>
                  <th 
                    onClick={() => handleSort('nama')}
                    className="px-5 py-4 cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                    title="Klik untuk mengurutkan berdasarkan nama"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>NAMA LENGKAP</span>
                      {sortField === 'nama' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} className="text-purple-600 dark:text-purple-400" /> : <ArrowDown size={14} className="text-purple-600 dark:text-purple-400" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('nama_wali')}
                    className="px-5 py-4 cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                    title="Klik untuk mengurutkan berdasarkan wali / no hp"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{filter.tipe === 'guru' || filter.tipe === 'dewan_guru' ? 'NO. HP' : 'WALI'}</span>
                      {sortField === 'nama_wali' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} className="text-purple-600 dark:text-purple-400" /> : <ArrowDown size={14} className="text-purple-600 dark:text-purple-400" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('alamat')}
                    className="px-5 py-4 cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                    title="Klik untuk mengurutkan berdasarkan alamat"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{filter.tipe === 'dewan_guru' ? 'UNIT / HOMEBASE' : 'ALAMAT'}</span>
                      {sortField === 'alamat' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} className="text-purple-600 dark:text-purple-400" /> : <ArrowDown size={14} className="text-purple-600 dark:text-purple-400" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('hadir')}
                    className="px-5 py-4 text-center cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                    title="Klik untuk mengurutkan berdasarkan jumlah hadir"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>HADIR</span>
                      {sortField === 'hadir' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} className="text-green-600 dark:text-green-400" /> : <ArrowDown size={14} className="text-green-600 dark:text-green-400" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('izin')}
                    className="px-5 py-4 text-center cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                    title="Klik untuk mengurutkan berdasarkan jumlah izin"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>IZIN</span>
                      {sortField === 'izin' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} className="text-blue-600 dark:text-blue-400" /> : <ArrowDown size={14} className="text-blue-600 dark:text-blue-400" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('sakit')}
                    className="px-5 py-4 text-center cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                    title="Klik untuk mengurutkan berdasarkan jumlah sakit"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>SAKIT</span>
                      {sortField === 'sakit' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} className="text-orange-600 dark:text-orange-400" /> : <ArrowDown size={14} className="text-orange-600 dark:text-orange-400" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('alpha')}
                    className="px-5 py-4 text-center cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                    title="Klik untuk mengurutkan berdasarkan jumlah alpha"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>ALPHA</span>
                      {sortField === 'alpha' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} className="text-red-600 dark:text-red-400" /> : <ArrowDown size={14} className="text-red-600 dark:text-red-400" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredData.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-10 text-gray-500 font-medium">
                    {data.length === 0 ? 'Klik Tampilkan untuk memuat data.' : `Tidak ada hasil untuk "${searchNama}"`}
                  </td></tr>
                ) : (
                  filteredData.map((item, idx) => {
                    const totalPertemuan = Number(item.hadir) + Number(item.izin) + Number(item.sakit) + Number(item.alpha);
                    const presentase = totalPertemuan === 0 ? 0 : Math.round((Number(item.hadir) / totalPertemuan) * 100);
                    const fotoUrl = getFotoUrl(item.foto);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-4 text-center">
                          <input 
                            type="checkbox" 
                            className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                            checked={selectedIds.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedIds([...selectedIds, item.id]);
                              else setSelectedIds(selectedIds.filter(id => id !== item.id));
                            }}
                          />
                        </td>
                        <td className="px-5 py-4 text-center text-gray-400 font-medium">{idx + 1}</td>
                        <td className="px-3 py-4 text-center">
                          <div
                            className={`w-10 h-10 rounded-full mx-auto overflow-hidden relative border border-gray-200 dark:border-gray-700 shadow-sm ${
                              fotoUrl ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
                            }`}
                            onClick={() => (fotoUrl ? setZoomPhoto(fotoUrl) : null)}
                          >
                            {fotoUrl ? (
                              <img src={fotoUrl} alt={item.nama} className="w-full h-full object-cover" />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center text-white text-xs font-extrabold"
                                style={{ backgroundColor: getAvatarColor(item.nama) }}
                              >
                                {getInitials(item.nama)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div 
                            onClick={() => openDetail(item, 'semua')}
                            className="font-bold text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer transition-colors"
                            title="Klik untuk melihat seluruh riwayat absensi individu ini"
                          >
                            {item.nama}
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">{filter.tipe === 'guru' || filter.tipe === 'dewan_guru' ? 'NIP' : 'NIS'}: {item.identifier || '-'}</div>
                          {totalPertemuan > 0 && (
                            <div className="mt-2 w-full max-w-[150px] bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 flex overflow-hidden">
                              <div className="bg-green-500 h-full" style={{ width: `${presentase}%` }} title={`Kehadiran ${presentase}%`}></div>
                              {presentase < 100 && <div className="bg-red-400 h-full" style={{ width: `${100 - presentase}%` }}></div>}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 max-w-[180px] truncate" title={filter.tipe === 'dewan_guru' ? (item.nama_wali || item.no_hp || '-') : (item.nama_wali || '-')}>
                            <User size={13} className="text-purple-500 shrink-0" />
                            <span className="truncate">{filter.tipe === 'dewan_guru' ? (item.nama_wali || item.no_hp || '-') : (item.nama_wali || '-')}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1.5 max-w-[200px] truncate" title={filter.tipe === 'dewan_guru' ? (item.homebase || item.alamat || '-') : (item.alamat || '-')}>
                            <MapPin size={13} className="text-blue-500 shrink-0" />
                            <span className="truncate">{filter.tipe === 'dewan_guru' ? (item.homebase || item.alamat || '-') : (item.alamat || '-')}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => openDetail(item, 'Hadir')}
                            className="bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400 px-3 py-1 rounded-lg font-bold transition-all transform hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                            title="Klik untuk melihat tanggal & detail Hadir"
                          >
                            {item.hadir || 0}
                          </button>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => openDetail(item, 'Izin')}
                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 px-3 py-1 rounded-lg font-bold transition-all transform hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                            title="Klik untuk melihat tanggal & detail Izin"
                          >
                            {item.izin || 0}
                          </button>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => openDetail(item, 'Sakit')}
                            className="bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 dark:text-orange-400 px-3 py-1 rounded-lg font-bold transition-all transform hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                            title="Klik untuk melihat tanggal & detail Sakit"
                          >
                            {item.sakit || 0}
                          </button>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => openDetail(item, 'Alpha')}
                            className="bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 px-3 py-1 rounded-lg font-bold transition-all transform hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                            title="Klik untuk melihat tanggal & detail Alpha"
                          >
                            {item.alpha || 0}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          </div>
          )}

        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-gray-800 w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <FileText className="text-purple-500" size={20} />
                Preview PDF Laporan {viewMode === 'grafik' ? 'Statistik & Tren' : viewMode === 'keduanya' ? 'Komprehensif (Statistik & Tabel)' : 'Rekapitulasi'}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('pdf', false)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors flex items-center gap-2"
                >
                  <Download size={16} /> Download
                </button>
                <button
                  onClick={() => setShowPdfPreview(false)}
                  className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 p-2 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            {/* Desktop: iframe preview */}
            <div className="hidden md:block flex-1 bg-gray-200 dark:bg-black/50 p-4 h-full">
              <iframe 
                src={pdfUrl} 
                className="w-full h-full rounded-xl shadow-inner bg-white"
                title="PDF Preview"
                style={{ minHeight: '60vh' }}
              />
            </div>
            {/* Mobile: fallback card */}
            <div className="flex md:hidden flex-1 flex-col items-center justify-center gap-5 p-8 bg-gray-50 dark:bg-gray-900/50">
              <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center">
                <FileText size={40} className="text-purple-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">Preview PDF tidak tersedia di HP</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Browser HP tidak mendukung tampilan PDF dalam aplikasi. Gunakan tombol di bawah untuk membuka atau mengunduh file PDF.</p>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl shadow-md transition-colors"
                >
                  <FileText size={18} /> Buka di Tab Baru
                </a>
                <a
                  href={pdfUrl}
                  download
                  className="flex items-center justify-center gap-2 w-full py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-2xl transition-colors"
                >
                  <Download size={18} /> Unduh PDF
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Absensi Individual Modal */}
      {detailModal && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setDetailModal(null)}
        >
          <div 
            className="bg-white dark:bg-gray-800 w-[96vw] sm:w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out] border border-gray-100 dark:border-gray-700 mx-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-purple-50 via-white to-purple-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900/50">
              {/* Row atas: avatar + info + tombol tutup */}
              <div className="flex items-start gap-3">
                {/* Foto / Avatar — rapat ke atas sejajar nama */}
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl overflow-hidden shadow-md shrink-0 border border-purple-200 dark:border-purple-800/50 mt-0.5">
                  {detailModal.item.foto && getFotoUrl(detailModal.item.foto) ? (
                    <img 
                      src={getFotoUrl(detailModal.item.foto)} 
                      alt={detailModal.item.nama} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div 
                      className="w-full h-full flex items-center justify-center text-white font-extrabold text-sm"
                      style={{ backgroundColor: getAvatarColor(detailModal.item.nama) }}
                    >
                      {getInitials(detailModal.item.nama)}
                    </div>
                  )}
                </div>

                {/* Info: nama + badge + NIS — di dalam flex row sejajar avatar */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2 flex-wrap">
                    <h3 className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-white leading-tight">
                      {detailModal.item.nama}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 shrink-0 mt-0.5">
                      {filter.tipe === 'madin' ? 'Madin' : filter.tipe === 'quran' ? "Qur'an" : filter.tipe === 'kegiatan' ? 'Kegiatan' : filter.tipe === 'dewan_guru' ? 'Dewan Guru' : 'Guru'}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>{filter.tipe === 'guru' || filter.tipe === 'dewan_guru' ? 'NIP' : 'NIS'}: <strong className="font-mono text-gray-700 dark:text-gray-300">{detailModal.item.identifier || '-'}</strong></span>
                  </p>
                </div>

                {/* Tombol Tutup — pojok kanan atas */}
                <button
                  onClick={() => setDetailModal(null)}
                  className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer shrink-0 mt-0"
                  title="Tutup (Esc)"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Periode — full width, rata kiri sejajar tepi foto dan tombol */}
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-2">
                Periode: <strong className="text-purple-600 dark:text-purple-400">{getPeriodText()}</strong>
              </p>

              {/* Row bawah: 3 tombol ekspor full width */}
              <div className="grid grid-cols-3 gap-2 mt-2.5">
                <button
                  onClick={() => handleExportDetail('pdf', true)}
                  className="bg-white hover:bg-purple-50 dark:bg-gray-700 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 border border-purple-200 dark:border-purple-700 cursor-pointer shadow-sm"
                  title="Preview PDF Rincian Kehadiran"
                >
                  <FileText size={13} />
                  Preview
                </button>
                <button
                  onClick={() => handleExportDetail('pdf', false)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-purple-500/20"
                  title="Unduh PDF Rincian Kehadiran"
                >
                  <Download size={13} />
                  PDF
                </button>
                <button
                  onClick={() => handleExportDetail('excel', false)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/20"
                  title="Unduh Excel Rincian Kehadiran"
                >
                  <Download size={13} />
                  Excel
                </button>
              </div>
            </div>

            {/* Filter Tabs Status */}
            <div className="px-4 sm:px-6 py-2.5 bg-gray-50/70 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2 overflow-x-auto no-scrollbar w-full">
              {[
                { id: 'semua', label: 'Semua Status', count: detailModal.data.length },
                { id: 'Hadir', label: 'Hadir', count: detailModal.data.filter((d: any) => d.status === 'Hadir').length },
                { id: 'Izin', label: 'Izin', count: detailModal.data.filter((d: any) => d.status === 'Izin').length },
                { id: 'Sakit', label: 'Sakit', count: detailModal.data.filter((d: any) => d.status === 'Sakit').length },
                { id: 'Alpha', label: 'Alpha', count: detailModal.data.filter((d: any) => d.status === 'Alpha').length },
              ].map(tab => {
                const isActive = detailModal.activeStatus === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setDetailModal(prev => prev ? { ...prev, activeStatus: tab.id } : null)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-purple-300'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body / Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 space-y-3 min-h-[320px] w-full">
              {detailModal.loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3 w-full">
                  <Loader2 className="animate-spin text-purple-600 dark:text-purple-400" size={32} />
                  <p className="text-sm font-semibold text-gray-500">Memuat rincian absensi...</p>
                </div>
              ) : detailModal.error ? (
                <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-center w-full">
                  <AlertCircle size={28} className="mx-auto text-red-500 mb-2" />
                  <p className="text-sm font-bold text-red-700 dark:text-red-300">{detailModal.error}</p>
                </div>
              ) : (() => {
                const rawList = detailModal.activeStatus === 'semua'
                  ? detailModal.data
                  : detailModal.data.filter((d: any) => d.status === detailModal.activeStatus);

                if (rawList.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center w-full">
                      <CalendarDays size={38} className="mx-auto mb-2.5 text-gray-300 dark:text-gray-600" />
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-200">Tidak ada catatan absensi</p>
                      <p className="text-xs text-gray-400 mt-1 max-w-sm">
                        {detailModal.activeStatus !== 'semua' ? `Tidak ada jadwal kehadiran dengan status ${detailModal.activeStatus}.` : 'Belum ada data kehadiran pada periode ini.'}
                      </p>
                    </div>
                  );
                }

                const list = [...rawList].sort((a: any, b: any) => {
                  let valA = '';
                  let valB = '';
                  if (detailSortField === 'tanggal') {
                    valA = `${a.tanggal || ''} ${a.jam_mulai || ''}`;
                    valB = `${b.tanggal || ''} ${b.jam_mulai || ''}`;
                  } else if (detailSortField === 'waktu') {
                    valA = a.jam_mulai || '';
                    valB = b.jam_mulai || '';
                  } else if (detailSortField === 'mata_pelajaran') {
                    valA = (a.mata_pelajaran || '').toLowerCase();
                    valB = (b.mata_pelajaran || '').toLowerCase();
                  } else if (detailSortField === 'status') {
                    valA = (a.status || '').toLowerCase();
                    valB = (b.status || '').toLowerCase();
                  } else if (detailSortField === 'keterangan') {
                    valA = (a.keterangan || '').toLowerCase();
                    valB = (b.keterangan || '').toLowerCase();
                  } else if (detailSortField === 'penginput') {
                    valA = (a.penginput || '').toLowerCase();
                    valB = (b.penginput || '').toLowerCase();
                  }
                  return detailSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                });

                return (
                  <div className="overflow-x-auto w-full border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm bg-white dark:bg-gray-800">
                    <table className="w-full min-w-[860px] text-left text-xs sm:text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900/70 text-gray-500 dark:text-gray-400 font-bold uppercase text-[11px] border-b border-gray-100 dark:border-gray-700">
                        <tr>
                          <th className="py-3 px-4 text-center w-12 min-w-[48px]">No</th>
                          <th 
                            onClick={() => handleDetailSort('tanggal')}
                            className="py-3 px-4 w-[160px] min-w-[160px] cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                            title="Klik untuk mengurutkan berdasarkan tanggal"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Hari, Tanggal</span>
                              {detailSortField === 'tanggal' ? (
                                detailSortOrder === 'asc' ? <ArrowUp size={13} className="text-purple-600 dark:text-purple-400" /> : <ArrowDown size={13} className="text-purple-600 dark:text-purple-400" />
                              ) : (
                                <ArrowUpDown size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleDetailSort('waktu')}
                            className="py-3 px-4 w-[130px] min-w-[130px] cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                            title="Klik untuk mengurutkan berdasarkan waktu"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Waktu</span>
                              {detailSortField === 'waktu' ? (
                                detailSortOrder === 'asc' ? <ArrowUp size={13} className="text-purple-600 dark:text-purple-400" /> : <ArrowDown size={13} className="text-purple-600 dark:text-purple-400" />
                              ) : (
                                <ArrowUpDown size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleDetailSort('mata_pelajaran')}
                            className="py-3 px-4 w-[260px] min-w-[260px] cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                            title="Klik untuk mengurutkan berdasarkan jadwal/mapel/kegiatan"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Jadwal / Mapel / Kegiatan</span>
                              {detailSortField === 'mata_pelajaran' ? (
                                detailSortOrder === 'asc' ? <ArrowUp size={13} className="text-purple-600 dark:text-purple-400" /> : <ArrowDown size={13} className="text-purple-600 dark:text-purple-400" />
                              ) : (
                                <ArrowUpDown size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleDetailSort('status')}
                            className="py-3 px-4 text-center w-[100px] min-w-[100px] cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                            title="Klik untuk mengurutkan berdasarkan status"
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <span>Status</span>
                              {detailSortField === 'status' ? (
                                detailSortOrder === 'asc' ? <ArrowUp size={13} className="text-purple-600 dark:text-purple-400" /> : <ArrowDown size={13} className="text-purple-600 dark:text-purple-400" />
                              ) : (
                                <ArrowUpDown size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleDetailSort('keterangan')}
                            className="py-3 px-4 w-[140px] min-w-[140px] cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                            title="Klik untuk mengurutkan berdasarkan keterangan"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Keterangan</span>
                              {detailSortField === 'keterangan' ? (
                                detailSortOrder === 'asc' ? <ArrowUp size={13} className="text-purple-600 dark:text-purple-400" /> : <ArrowDown size={13} className="text-purple-600 dark:text-purple-400" />
                              ) : (
                                <ArrowUpDown size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleDetailSort('penginput')}
                            className="py-3 px-4 w-[150px] min-w-[150px] cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                            title="Klik untuk mengurutkan berdasarkan penginput"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Diinput Oleh</span>
                              {detailSortField === 'penginput' ? (
                                detailSortOrder === 'asc' ? <ArrowUp size={13} className="text-purple-600 dark:text-purple-400" /> : <ArrowDown size={13} className="text-purple-600 dark:text-purple-400" />
                              ) : (
                                <ArrowUpDown size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                              )}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {list.map((row: any, i: number) => {
                          const statusColor = 
                            row.status === 'Hadir' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800' :
                            row.status === 'Izin' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                            row.status === 'Sakit' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';

                          return (
                            <tr key={i} className="hover:bg-purple-50/30 dark:hover:bg-gray-700/30 transition-colors">
                              <td className="py-3 px-4 text-center text-gray-400 font-medium">{i + 1}</td>
                              <td className="py-3 px-4 font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Calendar size={13} className="text-purple-500 shrink-0" />
                                  <span>{row.hari}, {row.tanggal}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-gray-600 dark:text-gray-300 font-mono text-xs whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <Clock size={12} className="text-gray-400 shrink-0" />
                                  <span>{row.jam_mulai ? `${row.jam_mulai}${row.jam_selesai ? ` - ${row.jam_selesai}` : ''}` : '-'}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-gray-900 dark:text-white leading-snug">{row.mata_pelajaran}</div>
                                {row.kelas_nama && row.kelas_nama !== '-' && (
                                  <div className="text-[11px] text-gray-400 mt-0.5">{row.kelas_nama}</div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-block border ${statusColor}`}>
                                  {row.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-gray-600 dark:text-gray-300 text-xs">
                                {row.keterangan ? (
                                  <span className="italic font-medium">{row.keterangan}</span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-xs whitespace-nowrap">
                                {row.penginput === 'Sistem Otomatis' ? (
                                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md font-medium text-[11px] border border-slate-200 dark:border-slate-700">
                                    🤖 {row.penginput}
                                  </span>
                                ) : (
                                  <span className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md font-medium text-[11px] border border-purple-200 dark:border-purple-800">
                                    👤 {row.penginput || 'Pengajar'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Footer Modal */}
            <div className="p-3.5 sm:p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Total data: <strong>{detailModal.data.length}</strong> sesi kehadiran
              </div>
              <button
                onClick={() => setDetailModal(null)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md shadow-purple-500/20 transition-all cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Photo Modal */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setZoomPhoto(null)}
        >
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setZoomPhoto(null)}
              className="absolute -top-3 -right-3 z-10 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-full p-1.5 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={18} />
            </button>
            <img
              src={zoomPhoto}
              alt="Foto Santri / Guru"
              className="w-full rounded-2xl shadow-2xl object-cover"
            />
          </div>
        </div>
      )}
    </div>
  );
}
