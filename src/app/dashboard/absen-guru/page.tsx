'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, CheckCircle2, XCircle, Clock, AlertCircle,
  BookOpen, RefreshCw, ChevronDown, ChevronUp, Calendar,
  ClipboardList, Wifi, WifiOff, UserCheck, UserX, MinusCircle,
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

const STATUS_COLOR = {
  Hadir: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  Izin: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  Sakit: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  Alpha: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  default: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

const STATUS_ICON = {
  Hadir: <CheckCircle2 size={13} className="text-emerald-500" />,
  Izin: <MinusCircle size={13} className="text-blue-500" />,
  Sakit: <AlertCircle size={13} className="text-amber-500" />,
  Alpha: <XCircle size={13} className="text-red-500" />,
  default: <Clock size={13} className="text-gray-400" />,
};

export default function AbsenGuruPage() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GuruData[]>([]);
  const [hari, setHari] = useState('');
  const [tanggal, setTanggal] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [expandedGuruId, setExpandedGuruId] = useState<number | null>(null);
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

  const getStatusLabel = (g: GuruData) => {
    if (g.totalJadwal === 0) return 'libur';
    if (g.belumAbsenCount > 0) return 'belum';
    if (g.alphaCount > 0) return 'alpha';
    return 'hadir';
  };

  const filteredData = data.filter(g => {
    const matchSearch = !search || g.nama.toLowerCase().includes(search.toLowerCase()) || g.nip?.includes(search);
    const statusLabel = getStatusLabel(g);
    const matchFilter =
      filterStatus === 'semua' ||
      (filterStatus === 'belum' && statusLabel === 'belum') ||
      (filterStatus === 'hadir' && statusLabel === 'hadir') ||
      (filterStatus === 'alpha' && statusLabel === 'alpha');
    return matchSearch && matchFilter;
  });

  // Summary counts
  const totalGuru = data.length;
  const guruBelum = data.filter(g => g.totalJadwal > 0 && g.belumAbsenCount > 0).length;
  const guruHadir = data.filter(g => g.totalJadwal > 0 && g.belumAbsenCount === 0 && g.hadirCount > 0).length;
  const guruAlpha = data.filter(g => g.alphaCount > 0).length;
  const guruLibur = data.filter(g => g.totalJadwal === 0).length;

  const formatTime = (t: string) => (t || '').slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={20} className="text-emerald-600 dark:text-emerald-400" />
            <div>
              <h1 className="text-sm font-extrabold text-gray-900 dark:text-white">Absen Guru</h1>
              <p className="text-[11px] text-gray-400">
                {hari ? `${hari}, ` : ''}{new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={tanggal}
              max={new Date().toLocaleDateString('en-CA')}
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

      <div className="max-w-5xl mx-auto px-4 pt-4 space-y-4">
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

        {/* Last updated + Libur info */}
        {lastUpdated && (
          <p className="text-[11px] text-gray-400 text-right flex items-center justify-end gap-1">
            <Wifi size={11} className="text-emerald-500" />
            Diperbarui: {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            {guruLibur > 0 && <span className="ml-2 text-gray-300">• {guruLibur} guru tidak punya jadwal hari ini</span>}
          </p>
        )}

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Cari nama guru atau NIP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
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
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full w-1/3" />
                    <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full w-1/5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Guru List */}
        {!loading && !error && (
          <div className="space-y-3">
            {filteredData.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Users size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Tidak ada data yang cocok</p>
              </div>
            )}
            {filteredData.map((guru) => {
              const statusLabel = getStatusLabel(guru);
              const isExpanded = expandedGuruId === guru.guru_id;

              const cardBorder =
                statusLabel === 'hadir'
                  ? 'border-emerald-200 dark:border-emerald-800/50'
                  : statusLabel === 'alpha'
                  ? 'border-red-200 dark:border-red-800/50'
                  : statusLabel === 'belum'
                  ? 'border-amber-200 dark:border-amber-800/50'
                  : 'border-gray-200 dark:border-gray-800';

              return (
                <div
                  key={guru.guru_id}
                  className={`bg-white dark:bg-gray-900 rounded-2xl border ${cardBorder} overflow-hidden shadow-sm transition-all`}
                >
                  {/* Guru header row */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                    onClick={() => toggleExpand(guru.guru_id)}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {guru.foto ? (
                        <img src={guru.foto} alt={guru.nama} className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                          <Users size={18} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                      )}
                      {/* Status dot */}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${
                        statusLabel === 'hadir' ? 'bg-emerald-500' :
                        statusLabel === 'alpha' ? 'bg-red-500' :
                        statusLabel === 'belum' ? 'bg-amber-400' : 'bg-gray-400'
                      }`} />
                    </div>

                    {/* Name + NIP */}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-gray-900 dark:text-white truncate">{guru.nama}</div>
                      <div className="text-[11px] text-gray-400">{guru.nip || 'NIP tidak tersedia'}</div>
                    </div>

                    {/* Stats chips */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {guru.totalJadwal === 0 ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-semibold border border-gray-200 dark:border-gray-700">
                          Libur
                        </span>
                      ) : (
                        <>
                          {guru.hadirCount > 0 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                              {guru.hadirCount} Hadir
                            </span>
                          )}
                          {guru.alphaCount > 0 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-semibold border border-red-200 dark:border-red-800">
                              {guru.alphaCount} Alpha
                            </span>
                          )}
                          {guru.izinCount > 0 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                              {guru.izinCount} Izin
                            </span>
                          )}
                          {guru.belumAbsenCount > 0 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">
                              {guru.belumAbsenCount} Belum
                            </span>
                          )}
                        </>
                      )}
                      {isExpanded ? <ChevronUp size={15} className="text-gray-400 ml-1" /> : <ChevronDown size={15} className="text-gray-400 ml-1" />}
                    </div>
                  </button>

                  {/* Jadwal detail (collapsible) */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-2 bg-gray-50/50 dark:bg-gray-950/30">
                      {guru.totalJadwal === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">Tidak ada jadwal mengajar hari ini</p>
                      ) : (
                        <>
                          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-2">
                            Jadwal Hari Ini ({guru.totalJadwal} sesi)
                          </p>
                          {guru.jadwal.map((j, idx) => {
                            const sc = (STATUS_COLOR as any)[j.status || 'default'] || STATUS_COLOR.default;
                            const si = (STATUS_ICON as any)[j.status || 'default'] || STATUS_ICON.default;
                            return (
                              <div key={idx} className="flex items-center justify-between gap-2 bg-white dark:bg-gray-900 rounded-xl p-2.5 border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-2 min-w-0">
                                  <BookOpen size={13} className="text-gray-400 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{j.mata_pelajaran}</div>
                                    <div className="text-[10px] text-gray-400">{j.nama_kelas} • {formatTime(j.jam_mulai)}–{formatTime(j.jam_selesai)}</div>
                                  </div>
                                </div>
                                <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg font-semibold border shrink-0 ${sc}`}>
                                  {si}
                                  {j.status || 'Belum'}
                                </span>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
