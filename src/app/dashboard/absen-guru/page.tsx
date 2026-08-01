'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Clock, RefreshCw, BookOpen, ClipboardList,
  WifiOff, UserCheck, UserX, Search, X, Home,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type JadwalItem = {
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
  jadwal: JadwalItem[];
};

type JadwalCard = JadwalItem & {
  guru_id: number;
  guru_nama: string;
  guru_foto: string | null;
  guru_nip: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const ASRAMAS_KEGIATAN = ['Asrama A', 'Asrama B', 'Asrama C', 'Asrama D', 'Asrama E', 'Asrama F'];
const ASRAMAS_QURAN = ['Asrama A', 'Asrama B', 'Asrama C', 'Asrama D', 'Asrama E', 'Asrama F', 'Tahfidz Putra', 'Tahfidz Putri'];

const STATUS_COLOR: Record<string, string> = {
  Hadir:   'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  Izin:    'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  Sakit:   'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  Alpha:   'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  default: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

const TIPE_HEADER: Record<string, string> = {
  madin:    'bg-gradient-to-r from-teal-600 to-teal-500',
  quran:    'bg-gradient-to-r from-emerald-600 to-emerald-500',
  kegiatan: 'bg-gradient-to-r from-blue-600 to-blue-500',
};

const TIPE_LABEL: Record<string, string> = {
  madin: 'Kelas Madin', quran: "Kelas Qur'an", kegiatan: 'Kegiatan Asrama',
};

const fmt = (t: string) => (t || '').slice(0, 5);

// ─── Component ────────────────────────────────────────────────────────────────
export default function AbsenGuruPage() {
  const router = useRouter();
  const [role, setRole]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [data, setData]         = useState<GuruData[]>([]);
  const [hari, setHari]         = useState('');
  const [error, setError]       = useState('');
  const [tanggal, setTanggal]   = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
  });

  // Real-time clock
  const [clockStr, setClockStr]           = useState('');
  const [dateHeaderStr, setDateHeaderStr] = useState('');
  useEffect(() => {
    const DAY = ['Ahad','Senin','Selasa','Rabu','Kamis',"Jum'at",'Sabtu'];
    const MON = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    const tick = () => {
      const n = new Date();
      setDateHeaderStr(`${DAY[n.getDay()]}, ${n.getDate()} ${MON[n.getMonth()]} ${n.getFullYear()}`);
      setClockStr(`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ─── Tab state (mirrors tabel-jadwal) ─────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState<'semua'|'madin'|'quran'|'kegiatan'>('semua');
  const [genderMode,   setGenderMode]   = useState<'PUTRA'|'PUTRI'>('PUTRA');
  const [levelTab,     setLevelTab]     = useState<'WUSTHO_MAK'|'ULA'|'WUSTHO'>('WUSTHO_MAK');
  const [activeAsrama, setActiveAsrama] = useState('Asrama A');
  const [waktuFilter,  setWaktuFilter]  = useState<'semua'|'pagi'|'siang'|'sore'|'malam'>('semua');

  // ─── UI state ─────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('');
  const [selectedCard, setSelectedCard] = useState<JadwalCard | null>(null);

  // Sync levelTab on gender change
  useEffect(() => { setLevelTab(genderMode === 'PUTRA' ? 'WUSTHO_MAK' : 'WUSTHO'); }, [genderMode]);

  // ─── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth/me');
        const d = await r.json();
        if (!d.success || (d.user.role !== 'admin' && d.user.role !== 'staff')) {
          router.replace('/dashboard'); return;
        }
        setRole(d.user.role);
      } catch { router.replace('/dashboard'); }
    })();
  }, [router]);

  // ─── Kegiatan asrama state ─────────────────────────────────────────────────
  const [kegiatanRaw, setKegiatanRaw] = useState<JadwalCard[]>([]);

  // ─── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/api/absen-guru?tanggal=${tanggal}`);
      const json = await res.json();
      if (!res.ok || !json.success) { setError(json.error || 'Gagal memuat data'); return; }
      setData(json.data); setHari(json.hari);
      setKegiatanRaw(json.kegiatanJadwal || []);
    } catch { setError('Koneksi gagal.'); }
    finally   { setLoading(false); }
  }, [tanggal]);

  useEffect(() => { if (role) fetchData(); }, [role, fetchData]);

  // ─── Flatten guru → jadwal cards (MADIN + QURAN only) ─────────────────────
  const allCards = useMemo((): JadwalCard[] =>
    data.flatMap(g =>
      g.jadwal
        .filter(j => j.tipe !== 'kegiatan')
        .map(j => ({
          ...j,
          guru_id: g.guru_id, guru_nama: g.nama,
          guru_foto: g.foto,  guru_nip:  g.nip,
        }))
    ), [data]);

  // All with kegiatan for 'semua' tab
  const allCardsWithKegiatan = useMemo(() => [...allCards, ...kegiatanRaw], [allCards, kegiatanRaw]);

  // ─── Filter helpers ────────────────────────────────────────────────────────
  const matchAsrama = (asramaProp: string | null, target: string) => {
    if (!asramaProp) return false;
    const a = asramaProp.trim().toLowerCase();
    const t = target.trim().toLowerCase();
    if (a === t) return true;
    const aClean = a.replace(/^asrama\s+/, '');
    const tClean = t.replace(/^asrama\s+/, '');
    return aClean === tClean;
  };

  const madinFilter = useCallback((c: JadwalCard) => {
    const n = (c.nama_kelas || '').toUpperCase();
    const putri = n.includes('PUTRI') || n.includes('TQ PUTRI');
    if (genderMode === 'PUTRI' ? !putri : putri) return false;
    if (genderMode === 'PUTRA') return levelTab === 'WUSTHO_MAK'
      ? (n.includes('WUSTHO') || n.includes('MAK') || n === 'TQ PUTRA')
      : n.includes('ULA');
    return levelTab === 'WUSTHO' ? (n.includes('WUSTHO') || n.includes('MAK')) : (n.includes('ULA') || n.includes('TQ PUTRI'));
  }, [genderMode, levelTab]);

  const quranFilter = useCallback((c: JadwalCard) => {
    const n = (c.nama_kelas || '').toUpperCase();
    if (activeAsrama === 'Tahfidz Putra') return n.includes('TAHFIDZ') && n.includes('ASRAMA A');
    if (activeAsrama === 'Tahfidz Putri') return n.includes('TAHFIDZ PUTRI');
    if (activeAsrama === 'Asrama A')      return n.includes('ASRAMA A') && !n.includes('TAHFIDZ');
    return n.includes(activeAsrama.toUpperCase()) && !n.includes('TAHFIDZ PUTRI');
  }, [activeAsrama]);

  const matchesWaktuFilter = (jamMulai: string | undefined, filter: 'semua' | 'pagi' | 'siang' | 'sore' | 'malam') => {
    if (filter === 'semua') return true;
    if (!jamMulai) return false;
    const timeStr = jamMulai.substring(0, 5);

    if (filter === 'pagi') {
      return timeStr > '00:00' && timeStr <= '06:00';
    } else if (filter === 'siang') {
      return timeStr > '06:00' && timeStr <= '12:00';
    } else if (filter === 'sore') {
      return timeStr > '12:00' && timeStr <= '18:00';
    } else if (filter === 'malam') {
      return (timeStr > '18:00' && timeStr <= '23:59') || timeStr === '00:00';
    }
    return true;
  };

  const filteredCards = useMemo(() => {
    let c: JadwalCard[];
    if (activeTab === 'kegiatan') {
      c = kegiatanRaw.filter(x => matchAsrama(x.nama_asrama, activeAsrama));
    } else if (activeTab === 'semua') {
      c = allCardsWithKegiatan;
    } else if (activeTab === 'madin') {
      c = allCards.filter(x => x.tipe === 'madin').filter(madinFilter);
    } else {
      c = allCards.filter(x => x.tipe === activeTab).filter(quranFilter);
    }
    if (waktuFilter !== 'semua') c = c.filter(x => matchesWaktuFilter(x.jam_mulai, waktuFilter));
    if (search) {
      const q = search.toLowerCase();
      c = c.filter(x => x.guru_nama.toLowerCase().includes(q) || (x.nama_kelas||'').toLowerCase().includes(q) || (x.mata_pelajaran||'').toLowerCase().includes(q));
    }
    return [...c].sort((a, b) => (a.jam_mulai||'').localeCompare(b.jam_mulai||'') || (a.nama_kelas||'').localeCompare(b.nama_kelas||''));
  }, [allCards, allCardsWithKegiatan, kegiatanRaw, activeTab, madinFilter, quranFilter, activeAsrama, waktuFilter, search]);

  // ─── Counts ────────────────────────────────────────────────────────────────
  const countByTab = (tab: string) => {
    if (tab === 'semua')    return allCardsWithKegiatan.length;
    if (tab === 'kegiatan') return kegiatanRaw.length;
    return allCards.filter(c => c.tipe === tab).length;
  };
  const totalCards = filteredCards.length;
  const belumCards = filteredCards.filter(c => c.status === null).length;
  const hadirCards = filteredCards.filter(c => c.status === 'Hadir').length;
  const alphaCards = filteredCards.filter(c => c.status === 'Alpha').length;

  // All schedules of selected guru (for popup)
  const selectedGuruAll = useMemo(() =>
    selectedCard ? allCardsWithKegiatan.filter(c => c.guru_id === selectedCard.guru_id) : [],
    [selectedCard, allCardsWithKegiatan]);

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">

      <div className="max-w-7xl mx-auto px-4 pt-4 space-y-3">

        {/* ── Header card — compact, persis seperti tabel-jadwal ──────────────── */}
        <div className="bg-gradient-to-br from-teal-50 to-emerald-100 dark:from-teal-950/40 dark:to-emerald-950/40 rounded-3xl p-4 sm:p-5 border border-teal-200 dark:border-teal-900/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-3 -mr-3 text-teal-200/40 dark:text-teal-900/20 pointer-events-none">
            <ClipboardList size={110} />
          </div>
          <div className="relative z-10">
            {/* Row 1: Title + desktop clock */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-extrabold text-teal-800 dark:text-teal-400 flex items-center gap-1.5 leading-tight">
                  <ClipboardList size={18} className="shrink-0" />
                  <span>Monitoring Kehadiran Guru</span>
                </h1>
                <p className="text-teal-600 dark:text-teal-300 text-xs sm:text-sm font-medium mt-0.5">
                  PP. Matholi'ul Anwar
                </p>
              </div>
              {/* Desktop clock */}
              <div className="hidden sm:block text-right shrink-0">
                <div className="text-teal-500 dark:text-teal-400 text-[11px] font-medium">{dateHeaderStr}</div>
                <div className="font-mono font-extrabold text-2xl text-teal-800 dark:text-teal-300 tracking-widest leading-tight">{clockStr}</div>
              </div>
            </div>
            {/* Row 2: Controls + mobile clock in ONE ROW */}
            <div className="flex items-center gap-2 mt-2">
              <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                className="text-xs border border-teal-200 dark:border-teal-800 rounded-xl px-2 py-1.5 bg-white/70 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-400" />
              <button onClick={fetchData} disabled={loading}
                className="p-2 rounded-xl bg-white/70 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 hover:bg-white border border-teal-200 dark:border-teal-800 transition-colors shadow-sm">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              {/* Mobile clock — same row as controls */}
              <div className="sm:hidden ml-auto font-mono font-extrabold text-base text-teal-800 dark:text-teal-300 tracking-widest">{clockStr}</div>
            </div>
          </div>
        </div>

        {/* ── Summary cards ──────────────────────────────────────────────────── */}
        <div className="space-y-2">
          {/* Total Sesi — Full Width */}
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-2.5 flex items-center justify-center gap-2 shadow-sm">
            <span className="text-gray-600 dark:text-gray-300"><BookOpen size={16}/></span>
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Total Sesi:</span>
            <span className="text-lg font-black text-gray-800 dark:text-gray-100">{loading ? '—' : totalCards}</span>
          </div>

          {/* Belum, Hadir, Alpha — 3 Kolom Sama Rata */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label:'Belum',      value:belumCards, color:'text-amber-600 dark:text-amber-300', bg:'bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900', icon:<Clock size={16}/> },
              { label:'Hadir',      value:hadirCards, color:'text-emerald-600 dark:text-emerald-300', bg:'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900', icon:<UserCheck size={16}/> },
              { label:'Alpha',      value:alphaCards, color:'text-red-600 dark:text-red-300',     bg:'bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900', icon:<UserX size={16}/> },
            ].map((c,i) => (
              <div key={i} className={`${c.bg} rounded-2xl p-2.5 flex flex-col items-center gap-0.5 shadow-sm`}>
                <span className={c.color}>{c.icon}</span>
                <span className={`text-lg font-black ${c.color}`}>{loading ? '—' : c.value}</span>
                <span className={`text-[10px] font-semibold ${c.color} opacity-70 text-center leading-tight`}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tab SEMUA (full width) ──────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <button onClick={() => setActiveTab('semua')}
            className={`w-full flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
              activeTab==='semua' ? 'bg-slate-600 dark:bg-slate-700 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}>
            Semua
            <span className={`text-[10px] px-3 py-0.5 rounded-full font-extrabold ${activeTab==='semua' ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
              {loading ? '…' : countByTab('semua')}
            </span>
          </button>
        </div>

        {/* ── Tabs Qur'an | Madin | Kegiatan ─────────────────────────────────── */}
        <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 gap-1.5">
          {([
            { key:'quran'    as const, labelFull:"Kelas Qur'an", labelShort:"Qur'an",  active:'bg-emerald-500' },
            { key:'madin'    as const, labelFull:'Kelas Madin',   labelShort:'Madin',    active:'bg-teal-500'   },
            { key:'kegiatan' as const, labelFull:'Kegiatan Asrama', labelShort:'Kegiatan', active:'bg-blue-500' },
          ]).map(tab => (
            <button key={tab.key}
              onClick={() => { setActiveTab(tab.key); if (tab.key !== 'madin') setActiveAsrama('Asrama A'); }}
              className={`flex-1 flex items-center justify-center gap-1 px-1 sm:px-3 py-2.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all ${
                activeTab===tab.key ? `${tab.active} text-white shadow-md` : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}>
              <span className="sm:hidden">{tab.labelShort}</span>
              <span className="hidden sm:inline">{tab.labelFull}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${activeTab===tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                {loading ? '…' : countByTab(tab.key)}
              </span>
            </button>
          ))}
        </div>

        {/* ── Sub-tabs ─────────────────────────────────────────────────────────── */}
        {activeTab !== 'semua' && (
          <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-3">

            {/* Madin: PUTRA / PUTRI */}
            {activeTab === 'madin' && (
              <div className="flex w-full bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700">
                {(['PUTRA','PUTRI'] as const).map(g => (
                  <button key={g} onClick={() => setGenderMode(g)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center ${genderMode===g ? 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {g}
                  </button>
                ))}
              </div>
            )}

            {/* Qur'an: asrama (flex-wrap) */}
            {activeTab === 'quran' && (
              <div className="flex w-full bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700 flex-wrap gap-1">
                {ASRAMAS_QURAN.map(asr => (
                  <button key={asr} onClick={() => setActiveAsrama(asr)}
                    className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all text-center ${activeAsrama===asr ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                    {asr}
                  </button>
                ))}
              </div>
            )}

            {/* Kegiatan: asrama — 2 baris (grid 3 kolom) */}
            {activeTab === 'kegiatan' && (
              <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700">
                {ASRAMAS_KEGIATAN.map(asr => (
                  <button key={asr} onClick={() => setActiveAsrama(asr)}
                    className={`py-2.5 text-xs font-bold rounded-lg transition-all text-center ${activeAsrama===asr ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                    {asr}
                  </button>
                ))}
              </div>
            )}

            {/* Madin: WUSTHO & MAK / ULA */}
            {activeTab === 'madin' && (
              <div className="flex w-full bg-gray-100 dark:bg-gray-900/50 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700">
                <button onClick={() => setLevelTab(genderMode==='PUTRA' ? 'WUSTHO_MAK' : 'WUSTHO')}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all text-center ${levelTab!=='ULA' ? 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  {genderMode==='PUTRA' ? 'WUSTHO & MAK' : 'WUSTHO'}
                </button>
                <button onClick={() => setLevelTab('ULA')}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all text-center ${levelTab==='ULA' ? 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  ULA
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Global Waktu Filter ──────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-2">
          {/* Tab Semua Waktu (full width top) */}
          <button
            onClick={() => setWaktuFilter('semua')}
            className={`w-full py-2.5 px-4 text-xs sm:text-sm font-bold rounded-xl transition-all text-center flex items-center justify-center gap-2 ${
              waktuFilter === 'semua'
                ? 'bg-slate-700 dark:bg-slate-600 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
            }`}
          >
            ✨ Semua Waktu
          </button>

          {/* 4 Tab Berdampingan Rapi (grid 4 kolom) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { key: 'pagi', label: '🌅 Pagi (jam 00.01 - 06.00)' },
              { key: 'siang', label: '☀️ Siang (jam 06.01 - 12.00)' },
              { key: 'sore', label: '🌇 Sore (jam 12.01 - 18.00)' },
              { key: 'malam', label: '🌙 Malam (jam 18.01 - 00.00)' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setWaktuFilter(key as any)}
                className={`py-2.5 px-2 text-xs font-bold rounded-xl transition-all text-center flex items-center justify-center ${
                  waktuFilter === key
                    ? 'bg-slate-700 dark:bg-slate-600 text-white shadow-md'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 bg-gray-50/50 dark:bg-gray-900/30'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Search ────────────────────────────────────────────────────────────── */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Cari guru, kelas, atau mata pelajaran..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-xl pl-8 pr-8 py-2.5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">
              <X size={13} />
            </button>
          )}
        </div>

        {/* ── Error ─────────────────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
            <WifiOff size={16} /> {error}
          </div>
        )}

        {/* ── Loading skeleton ─────────────────────────────────────────────────── */}
        {loading && (
          <div className="overflow-x-auto -mx-4 px-4 pb-2">
            <div className="grid gap-3 pb-1" style={{ gridTemplateColumns: 'repeat(6, minmax(150px, 1fr))', minWidth: '960px' }}>
              {[...Array(12)].map((_,i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse overflow-hidden">
                  <div className="h-10 bg-gray-200 dark:bg-gray-700" />
                  <div className="p-3 space-y-2">
                    <div className="flex gap-2 items-center"><div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0"/><div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full flex-1"/></div>
                    <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full w-3/4"/>
                    <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded-xl w-full mt-1"/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Jadwal Card Grid — 6 kartu per baris di horizontal scroll ────────────── */}
        {!loading && !error && (
          filteredCards.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <BookOpen size={48} className="mx-auto mb-3 opacity-20" />
              <p className="font-semibold">Tidak ada jadwal yang cocok</p>
              <p className="text-xs text-gray-300 mt-1">Coba ubah filter tab atau waktu</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 pb-2">
              <div className="grid gap-3 pb-1" style={{ gridTemplateColumns: 'repeat(6, minmax(150px, 1fr))', minWidth: '960px' }}>
                {filteredCards.map((card, idx) => {
                  const sc = STATUS_COLOR[card.status || 'default'] || STATUS_COLOR.default;
                  const hc = TIPE_HEADER[card.tipe] || 'bg-gray-500';
                  return (
                    <div key={`${card.guru_id}-${card.jadwal_id}-${card.jam_mulai}-${idx}`}
                      onClick={() => setSelectedCard(card)}
                      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col">

                      {/* Colored header — nama kelas + jam */}
                      <div className={`${hc} px-3 py-2 flex items-center justify-between gap-1`}>
                        <span className="text-white text-[11px] font-extrabold leading-tight flex-1 line-clamp-1">
                          {card.nama_kelas || '—'}
                        </span>
                        <span className="text-white/80 text-[10px] font-mono shrink-0 ml-1 bg-black/20 rounded px-1">
                          {fmt(card.jam_mulai)}
                        </span>
                      </div>

                      {/* Body */}
                      <div className="p-2.5 flex-1 space-y-1.5">
                        {/* Guru */}
                        <div className="flex items-center gap-1.5">
                          {card.guru_foto ? (
                            <img src={card.guru_foto} alt="" className="w-7 h-7 rounded-full object-cover border border-gray-200 dark:border-gray-700 shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                              <Users size={13} className="text-gray-400" />
                            </div>
                          )}
                          <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100 leading-tight line-clamp-2">
                            {card.guru_nama}
                          </span>
                        </div>

                        {/* Mata pelajaran */}
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium line-clamp-1">
                          {card.mata_pelajaran || '—'}
                        </div>

                        {/* Asrama (kegiatan) */}
                        {card.tipe === 'kegiatan' && card.nama_asrama && (
                          <div className="flex items-center gap-0.5 text-[9px] text-blue-500">
                            <Home size={8}/> {card.nama_asrama}
                          </div>
                        )}

                        {/* Jam range */}
                        <div className="text-[9px] text-gray-400 font-mono">
                          {fmt(card.jam_mulai)} – {fmt(card.jam_selesai)}
                        </div>
                      </div>

                      {/* Status footer */}
                      <div className="px-2.5 pb-2.5">
                        <span className={`block text-center text-[10px] px-2 py-0.5 rounded-xl font-bold border ${sc}`}>
                          {card.status || 'Belum Absen'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>

      {/* ── Popup Modal — centered, di atas bottombar ────────────────────────── */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-28 sm:pb-6"
          onClick={() => setSelectedCard(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}>

            {/* Colored header */}
            <div className={`${TIPE_HEADER[selectedCard.tipe] || 'bg-gray-500'} p-5 text-white`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold opacity-75 uppercase tracking-wider mb-1">
                    {TIPE_LABEL[selectedCard.tipe] || selectedCard.tipe}
                  </div>
                  <div className="text-xl font-extrabold leading-tight truncate">{selectedCard.nama_kelas || '—'}</div>
                  {selectedCard.nama_asrama && (
                    <div className="text-xs opacity-80 mt-0.5 flex items-center gap-1"><Home size={10}/>{selectedCard.nama_asrama}</div>
                  )}
                </div>
                <button onClick={() => setSelectedCard(null)}
                  className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white shrink-0">
                  <X size={16}/>
                </button>
              </div>
              <div className="mt-3 font-mono text-sm bg-black/20 inline-block px-3 py-1 rounded-xl">
                {fmt(selectedCard.jam_mulai)} – {fmt(selectedCard.jam_selesai)}
              </div>
            </div>

            {/* Popup body */}
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">

              {/* Guru info */}
              <div className="flex items-center gap-3">
                {selectedCard.guru_foto ? (
                  <img src={selectedCard.guru_foto} alt="" className="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-gray-700"/>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Users size={22} className="text-gray-400"/>
                  </div>
                )}
                <div>
                  <div className="font-extrabold text-sm text-gray-900 dark:text-white">{selectedCard.guru_nama}</div>
                  <div className="text-xs text-gray-400">NIP: {selectedCard.guru_nip || '—'}</div>
                </div>
              </div>

              {/* Mata pelajaran */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Mata Pelajaran</div>
                <div className="font-bold text-gray-800 dark:text-gray-100">{selectedCard.mata_pelajaran || '—'}</div>
              </div>

              {/* Status */}
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Status Kehadiran</div>
                <span className={`inline-block text-sm px-4 py-1.5 rounded-xl font-bold border ${STATUS_COLOR[selectedCard.status || 'default'] || STATUS_COLOR.default}`}>
                  {selectedCard.status || 'Belum Absen'}
                </span>
                {selectedCard.keterangan && <p className="text-xs text-gray-500 mt-2 italic">"{selectedCard.keterangan}"</p>}
              </div>

              {/* All schedules for this guru */}
              {selectedGuruAll.length > 1 && (
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                    Semua Jadwal Hari Ini — {selectedGuruAll.length} sesi
                  </div>
                  <div className="space-y-1.5">
                    {selectedGuruAll.map((j, i) => {
                      const isCurrent = j.jadwal_id === selectedCard.jadwal_id && j.jam_mulai === selectedCard.jam_mulai;
                      return (
                        <div key={i} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 border ${
                          isCurrent ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30'
                        }`}>
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold text-gray-700 dark:text-gray-200 truncate">{j.nama_kelas}</div>
                            <div className="text-[9px] text-gray-400">{j.mata_pelajaran} • {fmt(j.jam_mulai)}</div>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-lg font-semibold border shrink-0 ${STATUS_COLOR[j.status||'default']||STATUS_COLOR.default}`}>
                            {j.status || 'Belum'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
