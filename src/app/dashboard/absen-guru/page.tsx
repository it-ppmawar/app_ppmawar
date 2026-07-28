'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, CheckCircle2, XCircle, Clock, AlertCircle,
  BookOpen, RefreshCw, ChevronDown, ChevronUp, Calendar,
  ClipboardList, Wifi, WifiOff, UserCheck, UserX, MinusCircle, Search,
} from 'lucide-react';

type JadwalGuru = {
  jadwal_id: number;
  tipe: string;
  jam_mulai: string;
  jam_selesai: string;
  mata_pelajaran: string;
  nama_kelas: string;
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
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  });
  const [expandedGuruId, setExpandedGuruId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'semua' | 'madin' | 'quran'>('semua');
  const [filterStatus, setFilterStatus] = useState<'semua' | 'belum' | 'hadir' | 'alpha'>('semua');
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');

  // Auth check
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
      } catch {
        router.replace('/dashboard');
      }
    };
    checkAuth();
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/absen-guru?tanggal=${tanggal}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Gagal memuat data');
        return;
      }
      setData(json.data);
      setHari(json.hari);
      setLastUpdated(new Date());
    } catch {
      setError('Koneksi gagal. Periksa jaringan Anda.');
    } finally {
      setLoading(false);
    }
  }, [tanggal]);

  useEffect(() => {
    if (role === 'admin' || role === 'staff') {
      fetchData();
    }
  }, [role, fetchData]);

  const toggleExpand = (id: number) => {
    setExpandedGuruId(prev => (prev === id ? null : id));
  };

  // Helper: parse HH:mm:ss to seconds
  const parseTime = (t: string) => {
    const [h, m, s] = (t || '00:00:00').split(':').map(Number);
    return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
  };

  // Current time in seconds
  const nowSecs = useMemo(() => {
    const n = new Date();
    return n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
  }, [data]); // recalculate when data refreshes

  const isToday = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    return tanggal === todayStr;
  }, [tanggal]);

  // Check if a guru has an active schedule right now
  const guruHasActiveSchedule = useCallback((guru: GuruData) => {
    if (!isToday) return false;
    return guru.jadwal.some(j => {
      const mulai = parseTime(j.jam_mulai);
      const selesai = parseTime(j.jam_selesai);
      const windowStart = mulai - 30 * 60; // 30 min before
      const windowEnd = selesai + 60 * 60; // 1 hour after
      return nowSecs >= windowStart && nowSecs <= windowEnd;
    });
  }, [nowSecs, isToday]);

  // Filter by tab (madin/quran/semua)
  const filteredByTab = useMemo(() => {
    if (activeTab === 'semua') return data;
    return data.filter(g =>
      g.jadwal.some(j => j.tipe === activeTab)
    ).map(g => ({
      ...g,
      jadwal: g.jadwal.filter(j => j.tipe === activeTab),
      totalJadwal: g.jadwal.filter(j => j.tipe === activeTab).length,
      hadirCount: g.jadwal.filter(j => j.tipe === activeTab && j.status === 'Hadir').length,
      izinCount: g.jadwal.filter(j => j.tipe === activeTab && j.status === 'Izin').length,
      sakitCount: g.jadwal.filter(j => j.tipe === activeTab && j.status === 'Sakit').length,
      alphaCount: g.jadwal.filter(j => j.tipe === activeTab && j.status === 'Alpha').length,
      belumAbsenCount: g.jadwal.filter(j => j.tipe === activeTab && j.status === null).length,
    }));
  }, [data, activeTab]);

  const getStatusLabel = (g: GuruData) => {
    if (g.totalJadwal === 0) return 'libur';
    if (g.belumAbsenCount > 0) return 'belum';
    if (g.alphaCount > 0) return 'alpha';
    return 'hadir';
  };

  // Filter by search + status, then sort: active schedule first
  const filteredData = useMemo(() => {
    let result = filteredByTab.filter(g => {
      const matchSearch = !search || g.nama.toLowerCase().includes(search.toLowerCase()) || g.nip?.includes(search);
      const statusLabel = getStatusLabel(g);
      const matchFilter =
        filterStatus === 'semua' ||
        (filterStatus === 'belum' && statusLabel === 'belum') ||
        (filterStatus === 'hadir' && statusLabel === 'hadir') ||
        (filterStatus === 'alpha' && statusLabel === 'alpha');
      return matchSearch && matchFilter;
    });

    // Sort: guru with active schedule goes first, then by belumAbsen desc, then by name
    result.sort((a, b) => {
      const aActive = guruHasActiveSchedule(a) ? 1 : 0;
      const bActive = guruHasActiveSchedule(b) ? 1 : 0;
      if (bActive !== aActive) return bActive - aActive;
      // Then sort by who has pending absensi (belum) first
      const aBelum = a.belumAbsenCount > 0 ? 1 : 0;
      const bBelum = b.belumAbsenCount > 0 ? 1 : 0;
      if (bBelum !== aBelum) return bBelum - aBelum;
      return a.nama.localeCompare(b.nama);
    });

    return result;
  }, [filteredByTab, search, filterStatus, guruHasActiveSchedule]);

  // Summary counts (from filtered tab)
  const totalGuru = filteredByTab.length;
  const guruBelum = filteredByTab.filter(g => g.totalJadwal > 0 && g.belumAbsenCount > 0).length;
  const guruHadir = filteredByTab.filter(g => g.totalJadwal > 0 && g.belumAbsenCount === 0 && g.hadirCount > 0).length;
  const guruAlpha = filteredByTab.filter(g => g.alphaCount > 0).length;
  const guruLibur = filteredByTab.filter(g => g.totalJadwal === 0).length;

  const formatTime = (t: string) => (t || '').slice(0, 5);

  // Status badge color for card border
  const getBorderColor = (g: GuruData) => {
    const isActive = guruHasActiveSchedule(g);
    const label = getStatusLabel(g);
    if (isActive) return 'border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-300/50';
    if (label === 'alpha') return 'border-red-300 dark:border-red-700';
    if (label === 'belum') return 'border-amber-300 dark:border-amber-700';
    if (label === 'hadir') return 'border-emerald-200 dark:border-emerald-800/50';
    return 'border-gray-200 dark:border-gray-800';
  };

  // Compact status dot
  const getStatusDotColor = (g: GuruData) => {
    const label = getStatusLabel(g);
    if (label === 'hadir') return 'bg-emerald-500';
    if (label === 'alpha') return 'bg-red-500';
    if (label === 'belum') return 'bg-amber-400';
    return 'bg-gray-400';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={20} className="text-emerald-600 dark:text-emerald-400" />
            <div>
              <h1 className="text-sm font-extrabold text-gray-900 dark:text-white">Absen Guru</h1>
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
              className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors border border-emerald-200 dark:border-emerald-800"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total Guru', value: totalGuru, icon: <Users size={16} />, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-800' },
            { label: 'Belum Absen', value: guruBelum, icon: <Clock size={16} />, color: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/50', filter: 'belum' as const },
            { label: 'Sudah Hadir', value: guruHadir, icon: <UserCheck size={16} />, color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/50', filter: 'hadir' as const },
            { label: 'Ada Alpha', value: guruAlpha, icon: <UserX size={16} />, color: 'text-red-600 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-950/50', filter: 'alpha' as const },
          ].map((card, i) => (
            <button
              key={i}
              onClick={() => card.filter && setFilterStatus(prev => prev === card.filter ? 'semua' : card.filter!)}
              className={`${card.bg} rounded-2xl p-3 flex flex-col items-center gap-1 border border-transparent ${card.filter && filterStatus === card.filter ? 'ring-2 ring-offset-1 ring-emerald-400' : ''} transition-all`}
            >
              <span className={card.color}>{card.icon}</span>
              <span className={`text-xl font-black ${card.color}`}>{loading ? '—' : card.value}</span>
              <span className={`text-[10px] font-semibold ${card.color} opacity-70`}>{card.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Klasifikasi: Semua / Kelas Madin / Kelas Qur'an */}
        <div className="flex rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
          {[
            { key: 'semua' as const, label: 'Semua Guru' },
            { key: 'madin' as const, label: 'Kelas Madin' },
            { key: 'quran' as const, label: "Kelas Qur'an" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-bold text-center transition-all ${
                activeTab === tab.key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Info bar */}
        <div className="flex items-center justify-between gap-2">
          {lastUpdated && (
            <p className="text-[11px] text-gray-400 flex items-center gap-1">
              <Wifi size={11} className="text-emerald-500" />
              {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              {guruLibur > 0 && <span className="ml-1 text-gray-300">• {guruLibur} libur</span>}
            </p>
          )}
          {/* Search */}
          <div className="relative flex-1 max-w-xs ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari guru..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-xl pl-8 pr-3 py-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
            <WifiOff size={16} />
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-2" style={{ minWidth: `${8 * 92}px` }}>
              {[...Array(16)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl p-3 border border-gray-100 dark:border-gray-800 animate-pulse flex-shrink-0" style={{ width: '88px' }}>
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

        {/* Guru Grid - 8 kartu per baris, horizontal scroll */}
        {!loading && !error && (
          <>
            {filteredData.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Users size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Tidak ada data yang cocok</p>
              </div>
            )}

            {/* Horizontal scrollable grid — 8 kartu per baris */}
            <div className="overflow-x-auto pb-2 -mx-4 px-4">
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(8, 88px)`,
                  minWidth: `${8 * 96}px`,
                }}
              >
                {filteredData.map((guru) => {
                  const isActive = guruHasActiveSchedule(guru);
                  const isExpanded = expandedGuruId === guru.guru_id;

                  return (
                    <div
                      key={guru.guru_id}
                      className={`relative bg-white dark:bg-gray-900 rounded-2xl border ${getBorderColor(guru)} overflow-hidden shadow-sm transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5`}
                      style={{ width: '88px' }}
                      onClick={() => toggleExpand(guru.guru_id)}
                    >
                      {/* Active pulse dot */}
                      {isActive && (
                        <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse z-10" />
                      )}
                      {/* Selected indicator */}
                      {isExpanded && (
                        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-500" />
                      )}

                      {/* Compact card */}
                      <div className="p-2.5 flex flex-col items-center text-center gap-1.5">
                        {/* Avatar */}
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

                        {/* Name — 2 lines max */}
                        <div className="font-bold text-[10px] text-gray-900 dark:text-white leading-tight w-full overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {guru.nama}
                        </div>

                        {/* Mini status badges */}
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

            {/* Expanded Detail Panel — shown below grid when a guru is selected */}
            {expandedGuruId !== null && (() => {
              const guru = filteredData.find(g => g.guru_id === expandedGuruId);
              if (!guru) return null;
              return (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 shadow-md overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                    <div className="relative shrink-0">
                      {guru.foto ? (
                        <img src={guru.foto} alt={guru.nama} className="w-11 h-11 rounded-full object-cover border border-gray-200 dark:border-gray-700" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                          <Users size={20} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                      )}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 ${getStatusDotColor(guru)}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-sm text-gray-900 dark:text-white">{guru.nama}</div>
                      <div className="text-[11px] text-gray-400">NIP: {guru.nip || '—'}</div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {guru.totalJadwal === 0 ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold border border-gray-200 dark:border-gray-700">Libur</span>
                      ) : (
                        <>
                          {guru.hadirCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">{guru.hadirCount} Hadir</span>}
                          {guru.alphaCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-semibold border border-red-200 dark:border-red-800">{guru.alphaCount} Alpha</span>}
                          {guru.izinCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">{guru.izinCount} Izin</span>}
                          {guru.sakitCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">{guru.sakitCount} Sakit</span>}
                          {guru.belumAbsenCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">{guru.belumAbsenCount} Belum</span>}
                        </>
                      )}
                      <button onClick={() => setExpandedGuruId(null)} className="ml-1 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                        <ChevronUp size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Jadwal list */}
                  <div className="px-4 py-3">
                    {guru.totalJadwal === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">Tidak ada jadwal mengajar hari ini</p>
                    ) : (
                      <>
                        <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-2">Jadwal Hari Ini ({guru.totalJadwal} sesi)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {guru.jadwal.map((j, idx) => {
                            const sc = STATUS_COLOR[j.status || 'default'] || STATUS_COLOR.default;
                            const jMulai = parseTime(j.jam_mulai);
                            const jSelesai = parseTime(j.jam_selesai);
                            const isActiveNow = isToday && nowSecs >= jMulai - 30 * 60 && nowSecs <= jSelesai + 60 * 60;
                            return (
                              <div key={idx} className={`flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-2.5 border ${isActiveNow ? 'border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-300/40' : 'border-gray-100 dark:border-gray-800'}`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <BookOpen size={13} className="text-gray-400 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{j.mata_pelajaran}</div>
                                    <div className="text-[10px] text-gray-400">{j.nama_kelas} • {formatTime(j.jam_mulai)}–{formatTime(j.jam_selesai)}</div>
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
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
