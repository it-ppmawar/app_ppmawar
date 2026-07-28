'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, CheckCircle2, Clock, RefreshCw, BookOpen,
  ClipboardList, Wifi, WifiOff, UserCheck, UserX, Search, X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type JadwalGuru = {
  jadwal_id: number;
  tipe: string;
  jam_mulai: string;
  jam_selesai: string;
  mata_pelajaran: string;
  nama_kelas: string;
  nama_asrama: string | null;
  status: string | null;
  keterangan: string | null;
};

type GuruData = {
  guru_id: number;
  nip: string;
  nama: string;
  foto: string | null;
  totalJadwal: number;
  hadirCount: number;
  izinCount: number;
  sakitCount: number;
  alphaCount: number;
  belumAbsenCount: number;
  jadwal: JadwalGuru[];
};

// ─── Constants (same as tabel-jadwal) ────────────────────────────────────────
const ASRAMAS_KEGIATAN = ['Asrama A', 'Asrama B', 'Asrama C', 'Asrama D', 'Asrama E', 'Asrama F'];
const ASRAMAS_QURAN = ['Asrama A', 'Asrama B', 'Asrama C', 'Asrama D', 'Asrama E', 'Asrama F', 'Tahfidz Putra', 'Tahfidz Putri'];

const STATUS_COLOR: Record<string, string> = {
  Hadir: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  Izin: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  Sakit: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  Alpha: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  default: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

export default function AbsenGuruPage() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GuruData[]>([]);
  const [hari, setHari] = useState('');
  const [tanggal, setTanggal] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ─── Tab State ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'semua' | 'madin' | 'quran' | 'kegiatan'>('semua');
  const [genderMode, setGenderMode] = useState<'PUTRA' | 'PUTRI'>('PUTRA');
  const [levelTab, setLevelTab] = useState<'WUSTHO_MAK' | 'ULA' | 'WUSTHO'>('WUSTHO_MAK');
  const [activeAsrama, setActiveAsrama] = useState('Asrama A');

  // ─── UI State ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'semua' | 'belum' | 'hadir' | 'alpha'>('semua');
  const [selectedGuru, setSelectedGuru] = useState<GuruData | null>(null); // popup modal

  // ─── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const d = await res.json();
        if (!d.success || (d.user.role !== 'admin' && d.user.role !== 'staff')) {
          router.replace('/dashboard');
          return;
        }
        setRole(d.user.role);
      } catch { router.replace('/dashboard'); }
    };
    checkAuth();
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/absen-guru?tanggal=${tanggal}`);
      const json = await res.json();
      if (!res.ok || !json.success) { setError(json.error || 'Gagal memuat data'); return; }
      setData(json.data);
      setHari(json.hari);
      setLastUpdated(new Date());
    } catch { setError('Koneksi gagal.'); }
    finally { setLoading(false); }
  }, [tanggal]);

  useEffect(() => { if (role) fetchData(); }, [role, fetchData]);

  // ─── Sync levelTab when gender changes ───────────────────────────────────
  useEffect(() => {
    setLevelTab(genderMode === 'PUTRA' ? 'WUSTHO_MAK' : 'WUSTHO');
  }, [genderMode]);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const parseTime = (t: string) => {
    const [h, m, s] = (t || '00:00:00').split(':').map(Number);
    return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
  };
  const formatTime = (t: string) => (t || '').slice(0, 5);

  const isToday = useMemo(() => {
    const now = new Date();
    return tanggal === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, [tanggal]);

  const nowSecs = useMemo(() => {
    const n = new Date();
    return n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
  }, [data]);

  const guruHasActiveSchedule = useCallback((guru: GuruData) => {
    if (!isToday) return false;
    return guru.jadwal.some(j => {
      const s = parseTime(j.jam_mulai) - 30 * 60;
      const e = parseTime(j.jam_selesai) + 60 * 60;
      return nowSecs >= s && nowSecs <= e;
    });
  }, [nowSecs, isToday]);

  const getStatusLabel = (g: GuruData) => {
    if (g.totalJadwal === 0) return 'libur';
    if (g.belumAbsenCount > 0) return 'belum';
    if (g.alphaCount > 0) return 'alpha';
    return 'hadir';
  };

  const getStatusDotColor = (g: GuruData) => {
    const l = getStatusLabel(g);
    if (l === 'hadir') return 'bg-emerald-500';
    if (l === 'alpha') return 'bg-red-500';
    if (l === 'belum') return 'bg-amber-400';
    return 'bg-gray-400';
  };

  const getBorderColor = (g: GuruData) => {
    if (guruHasActiveSchedule(g)) return 'border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-300/50';
    const l = getStatusLabel(g);
    if (l === 'alpha') return 'border-red-300 dark:border-red-700';
    if (l === 'belum') return 'border-amber-300 dark:border-amber-700';
    if (l === 'hadir') return 'border-emerald-200 dark:border-emerald-800/50';
    return 'border-gray-200 dark:border-gray-800';
  };

  // ─── Tab Filtering Logic (mirrors tabel-jadwal) ───────────────────────────
  const filterGuruByTab = useCallback((g: GuruData): JadwalGuru[] => {
    if (activeTab === 'semua') return g.jadwal;
    const byType = g.jadwal.filter(j => j.tipe === activeTab);
    if (activeTab === 'madin') {
      return byType.filter(j => {
        const n = (j.nama_kelas || '').toUpperCase();
        const isPutri = n.includes('PUTRI') || n.includes('TQ PUTRI');
        const matchGender = genderMode === 'PUTRI' ? isPutri : !isPutri;
        if (!matchGender) return false;
        if (genderMode === 'PUTRA') {
          return levelTab === 'WUSTHO_MAK'
            ? n.includes('WUSTHO') || n.includes('MAK') || n === 'TQ PUTRA'
            : n.includes('ULA');
        } else {
          return levelTab === 'WUSTHO'
            ? n.includes('WUSTHO') || n.includes('MAK')
            : n.includes('ULA') || n.includes('TQ PUTRI');
        }
      });
    }
    if (activeTab === 'quran') {
      return byType.filter(j => {
        const n = (j.nama_kelas || '').toUpperCase();
        if (activeAsrama === 'Tahfidz Putra') return n.includes('TAHFIDZ') && n.includes('ASRAMA A');
        if (activeAsrama === 'Tahfidz Putri') return n.includes('TAHFIDZ PUTRI');
        if (activeAsrama === 'Asrama A') return n.includes('ASRAMA A') && !n.includes('TAHFIDZ');
        return n.includes(activeAsrama.toUpperCase()) && !n.includes('TAHFIDZ PUTRI');
      });
    }
    if (activeTab === 'kegiatan') {
      return byType.filter(j => j.nama_asrama === activeAsrama);
    }
    return byType;
  }, [activeTab, genderMode, levelTab, activeAsrama]);

  // Build filtered guru list
  const filteredData = useMemo(() => {
    let result = data.map(g => {
      const filteredJadwal = filterGuruByTab(g);
      return {
        ...g,
        jadwal: filteredJadwal,
        totalJadwal: filteredJadwal.length,
        hadirCount: filteredJadwal.filter(j => j.status === 'Hadir').length,
        izinCount: filteredJadwal.filter(j => j.status === 'Izin').length,
        sakitCount: filteredJadwal.filter(j => j.status === 'Sakit').length,
        alphaCount: filteredJadwal.filter(j => j.status === 'Alpha').length,
        belumAbsenCount: filteredJadwal.filter(j => j.status === null).length,
      };
    });

    // For non-semua tabs: only show guru that have jadwal in this tab
    if (activeTab !== 'semua') {
      result = result.filter(g => g.totalJadwal > 0);
    }

    // Search filter
    if (search) {
      result = result.filter(g =>
        g.nama.toLowerCase().includes(search.toLowerCase()) || g.nip?.includes(search)
      );
    }

    // Status filter
    if (filterStatus !== 'semua') {
      result = result.filter(g => getStatusLabel(g) === filterStatus);
    }

    // Sort: active schedule → belum → others → by name
    result.sort((a, b) => {
      const aA = guruHasActiveSchedule(a) ? 1 : 0;
      const bA = guruHasActiveSchedule(b) ? 1 : 0;
      if (bA !== aA) return bA - aA;
      const aB = a.belumAbsenCount > 0 ? 1 : 0;
      const bB = b.belumAbsenCount > 0 ? 1 : 0;
      if (bB !== aB) return bB - aB;
      return a.nama.localeCompare(b.nama);
    });

    return result;
  }, [data, filterGuruByTab, search, filterStatus, guruHasActiveSchedule, activeTab]);

  // Counts for summary cards (based on filteredData)
  const totalGuru = filteredData.length;
  const guruBelum = filteredData.filter(g => g.totalJadwal > 0 && g.belumAbsenCount > 0).length;
  const guruHadir = filteredData.filter(g => g.totalJadwal > 0 && g.belumAbsenCount === 0 && g.hadirCount > 0).length;
  const guruAlpha = filteredData.filter(g => g.alphaCount > 0).length;

  // Count by tab (all data, not filtered by status/search)
  const countByTab = (tab: string) => {
    if (tab === 'semua') return data.length;
    return data.filter(g => g.jadwal.some(j => j.tipe === tab)).length;
  };

  // Available asramas for kegiatan tab
  const availableKegiatanAsramas = ASRAMAS_KEGIATAN.filter(asr =>
    data.some(g => g.jadwal.some(j => j.tipe === 'kegiatan' && j.nama_asrama === asr))
  );
  const availableQuranAsramas = ASRAMAS_QURAN.filter(asr =>
    data.some(g => g.jadwal.some(j => j.tipe === 'quran'))
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      {/* ─── Sticky Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={20} className="text-emerald-600 dark:text-emerald-400" />
            <div>
              <h1 className="text-sm font-extrabold text-gray-900 dark:text-white">Monitoring Absen Guru</h1>
              <p className="text-[11px] text-gray-400">
                {hari ? `${hari}, ` : ''}{new Date(tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={tanggal}
              onChange={e => setTanggal(e.target.value)}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors border border-emerald-200 dark:border-emerald-800"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3 max-w-7xl mx-auto">
        {/* ─── Summary Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total', value: totalGuru, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-800', icon: <Users size={16} /> },
            { label: 'Belum', value: guruBelum, color: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/50', icon: <Clock size={16} />, filter: 'belum' as const },
            { label: 'Hadir', value: guruHadir, color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/50', icon: <UserCheck size={16} />, filter: 'hadir' as const },
            { label: 'Alpha', value: guruAlpha, color: 'text-red-600 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-950/50', icon: <UserX size={16} />, filter: 'alpha' as const },
          ].map((c, i) => (
            <button key={i}
              onClick={() => c.filter && setFilterStatus(p => p === c.filter ? 'semua' : c.filter!)}
              className={`${c.bg} rounded-2xl p-3 flex flex-col items-center gap-1 border border-transparent ${c.filter && filterStatus === c.filter ? 'ring-2 ring-offset-1 ring-emerald-400' : ''} transition-all`}
            >
              <span className={c.color}>{c.icon}</span>
              <span className={`text-xl font-black ${c.color}`}>{loading ? '—' : c.value}</span>
              <span className={`text-[10px] font-semibold ${c.color} opacity-70`}>{c.label}</span>
            </button>
          ))}
        </div>

        {/* ─── Tab: Semua (full width, like absen page) ──────────────────── */}
        <div className="bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 w-full">
          <button
            onClick={() => setActiveTab('semua')}
            className={`w-full flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
              activeTab === 'semua'
                ? 'bg-slate-600 dark:bg-slate-700 text-white shadow-md'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            Semua
            <span className={`text-[10px] px-3 py-0.5 rounded-full font-extrabold ${activeTab === 'semua' ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
              {loading ? '…' : countByTab('semua')}
            </span>
          </button>
        </div>

        {/* ─── Tab: Qur'an | Madin | Kegiatan (like absen page) ─────────── */}
        <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 gap-1.5 w-full">
          {[
            { key: 'quran' as const, label: "Kelas Qur'an", active: 'bg-emerald-500' },
            { key: 'madin' as const, label: 'Kelas Madin', active: 'bg-teal-500' },
            { key: 'kegiatan' as const, label: 'Kegiatan Asrama', active: 'bg-blue-500' },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => { setActiveTab(tab.key); if (tab.key !== 'madin') setActiveAsrama('Asrama A'); }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold rounded-xl transition-all ${
                activeTab === tab.key
                  ? `${tab.active} text-white shadow-md`
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                {loading ? '…' : countByTab(tab.key)}
              </span>
            </button>
          ))}
        </div>

        {/* ─── Sub-tabs (like tabel-jadwal) ──────────────────────────────── */}
        {activeTab !== 'semua' && (
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-3">

            {/* Madin: PUTRA / PUTRI */}
            {activeTab === 'madin' && (
              <div className="flex w-full bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700">
                {['PUTRA', 'PUTRI'].map(g => (
                  <button key={g}
                    onClick={() => setGenderMode(g as 'PUTRA' | 'PUTRI')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center ${
                      genderMode === g ? 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >{g}</button>
                ))}
              </div>
            )}

            {/* Quran: by Asrama */}
            {activeTab === 'quran' && (
              <div className="flex w-full bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700 flex-wrap gap-1">
                {ASRAMAS_QURAN.map(asr => (
                  <button key={asr}
                    onClick={() => setActiveAsrama(asr)}
                    className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all text-center ${
                      activeAsrama === asr ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >{asr}</button>
                ))}
              </div>
            )}

            {/* Kegiatan: by Asrama */}
            {activeTab === 'kegiatan' && (
              <div className="flex w-full bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700">
                {(availableKegiatanAsramas.length > 0 ? availableKegiatanAsramas : ASRAMAS_KEGIATAN).map(asr => (
                  <button key={asr}
                    onClick={() => setActiveAsrama(asr)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center ${
                      activeAsrama === asr ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >{asr}</button>
                ))}
              </div>
            )}

            {/* Madin level sub-tab: WUSTHO & MAK / ULA */}
            {activeTab === 'madin' && (
              <div className="flex w-full bg-gray-100 dark:bg-gray-900/50 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700">
                <button
                  onClick={() => setLevelTab(genderMode === 'PUTRA' ? 'WUSTHO_MAK' : 'WUSTHO')}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all text-center ${
                    levelTab !== 'ULA' ? 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {genderMode === 'PUTRA' ? 'WUSTHO & MAK' : 'WUSTHO'}
                </button>
                <button
                  onClick={() => setLevelTab('ULA')}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all text-center ${
                    levelTab === 'ULA' ? 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  ULA
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── Info + Search bar ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <p className="text-[11px] text-gray-400 flex items-center gap-1 shrink-0">
              <Wifi size={11} className="text-emerald-500" />
              {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
          <div className="relative flex-1 ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari guru atau NIP..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-xl pl-8 pr-3 py-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>

        {/* ─── Error ─────────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
            <WifiOff size={16} /> {error}
          </div>
        )}

        {/* ─── Loading Skeleton ───────────────────────────────────────────── */}
        {loading && (
          <div className="overflow-x-auto pb-2 -mx-4 px-4">
            <div className="flex gap-2" style={{ minWidth: `${8 * 92}px` }}>
              {[...Array(16)].map((_, i) => (
                <div key={i} className="flex-shrink-0 bg-white dark:bg-gray-900 rounded-2xl p-3 border border-gray-100 dark:border-gray-800 animate-pulse" style={{ width: '88px' }}>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                    <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full w-full" />
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Guru Grid ─────────────────────────────────────────────────── */}
        {!loading && !error && (
          <>
            {filteredData.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Users size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Tidak ada data yang cocok</p>
              </div>
            )}

            {/* Horizontal scroll grid — 8 kolom fixed, scroll ke kanan */}
            <div className="overflow-x-auto pb-2 -mx-4 px-4">
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(8, 88px)`, minWidth: `${8 * 96}px` }}
              >
                {filteredData.map(guru => {
                  const isActive = guruHasActiveSchedule(guru);
                  const isSelected = selectedGuru?.guru_id === guru.guru_id;
                  return (
                    <div
                      key={guru.guru_id}
                      onClick={() => setSelectedGuru(isSelected ? null : guru)}
                      className={`relative bg-white dark:bg-gray-900 rounded-2xl border ${getBorderColor(guru)} overflow-hidden shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all`}
                      style={{ width: '88px' }}
                    >
                      {isActive && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse z-10" />}
                      {isSelected && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-500" />}

                      <div className="p-2.5 flex flex-col items-center text-center gap-1.5">
                        <div className="relative">
                          {guru.foto ? (
                            <img src={guru.foto} alt={guru.nama} className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                              <Users size={16} className="text-emerald-600 dark:text-emerald-400" />
                            </div>
                          )}
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${getStatusDotColor(guru)}`} />
                        </div>
                        <div
                          className="font-bold text-[10px] text-gray-900 dark:text-white leading-tight w-full overflow-hidden"
                          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                        >{guru.nama}</div>
                        {guru.totalJadwal === 0 ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-400 font-semibold">Libur</span>
                        ) : (
                          <div className="flex flex-wrap justify-center gap-0.5">
                            {guru.hadirCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold">{guru.hadirCount}H</span>}
                            {guru.belumAbsenCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold">{guru.belumAbsenCount}B</span>}
                            {guru.alphaCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold">{guru.alphaCount}A</span>}
                            {guru.izinCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold">{guru.izinCount}I</span>}
                            {guru.sakitCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold">{guru.sakitCount}S</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─── POPUP MODAL (centered, above bottombar) ─────────────────────── */}
      {selectedGuru && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-24 sm:pb-4"
          onClick={() => setSelectedGuru(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[70vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-gray-900 shrink-0">
              <div className="relative shrink-0">
                {selectedGuru.foto ? (
                  <img src={selectedGuru.foto} alt={selectedGuru.nama} className="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-gray-700" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                    <Users size={22} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                )}
                <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 ${getStatusDotColor(selectedGuru)}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-sm text-gray-900 dark:text-white">{selectedGuru.nama}</div>
                <div className="text-[11px] text-gray-400">NIP: {selectedGuru.nip || '—'}</div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {selectedGuru.totalJadwal === 0 ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold border border-gray-200 dark:border-gray-700">Libur</span>
                ) : (
                  <>
                    {selectedGuru.hadirCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">{selectedGuru.hadirCount} Hadir</span>}
                    {selectedGuru.alphaCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-red-50 text-red-700 font-semibold border border-red-200">{selectedGuru.alphaCount} Alpha</span>}
                    {selectedGuru.izinCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-200">{selectedGuru.izinCount} Izin</span>}
                    {selectedGuru.sakitCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 font-semibold border border-amber-200">{selectedGuru.sakitCount} Sakit</span>}
                    {selectedGuru.belumAbsenCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 font-semibold border border-amber-200">{selectedGuru.belumAbsenCount} Belum</span>}
                  </>
                )}
                <button onClick={() => setSelectedGuru(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Jadwal list — scrollable */}
            <div className="px-5 py-4 overflow-y-auto">
              {selectedGuru.jadwal.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Tidak ada jadwal mengajar hari ini</p>
              ) : (
                <>
                  <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-3">
                    Jadwal Hari Ini — {selectedGuru.jadwal.length} sesi
                  </p>
                  <div className="space-y-2">
                    {selectedGuru.jadwal.map((j, idx) => {
                      const sc = STATUS_COLOR[j.status || 'default'] || STATUS_COLOR.default;
                      const jMulai = parseTime(j.jam_mulai);
                      const jSelesai = parseTime(j.jam_selesai);
                      const isActiveNow = isToday && nowSecs >= jMulai - 30 * 60 && nowSecs <= jSelesai + 60 * 60;
                      return (
                        <div key={idx} className={`flex items-center justify-between gap-2 rounded-xl p-3 border ${isActiveNow ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-300/40' : 'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30'}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <BookOpen size={13} className="text-gray-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{j.mata_pelajaran}</div>
                              <div className="text-[10px] text-gray-400">
                                {j.nama_kelas}
                                {j.nama_asrama && <span className="ml-1 text-gray-300">• {j.nama_asrama}</span>}
                                {' '}• {formatTime(j.jam_mulai)}–{formatTime(j.jam_selesai)}
                              </div>
                            </div>
                          </div>
                          <span className={`text-[11px] px-2 py-0.5 rounded-lg font-semibold border shrink-0 ${sc}`}>
                            {j.status || 'Belum'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
