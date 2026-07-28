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
  const [waktuFilter,  setWaktuFilter]  = useState<'semua'|'pagi'|'malam'>('semua');

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

  // ─── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/api/absen-guru?tanggal=${tanggal}`);
      const json = await res.json();
      if (!res.ok || !json.success) { setError(json.error || 'Gagal memuat data'); return; }
      setData(json.data); setHari(json.hari);
    } catch { setError('Koneksi gagal.'); }
    finally   { setLoading(false); }
  }, [tanggal]);

  useEffect(() => { if (role) fetchData(); }, [role, fetchData]);

  // ─── Flatten guru → jadwal cards ──────────────────────────────────────────
  const allCards = useMemo((): JadwalCard[] =>
    data.flatMap(g =>
      g.jadwal.map(j => ({
        ...j,
        guru_id: g.guru_id, guru_nama: g.nama,
        guru_foto: g.foto,  guru_nip:  g.nip,
      }))
    ), [data]);

  // ─── Filter helpers ────────────────────────────────────────────────────────
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

  const filteredCards = useMemo(() => {
    let c = allCards;
    if (activeTab !== 'semua') c = c.filter(x => x.tipe === activeTab);
    if (activeTab === 'madin')    c = c.filter(madinFilter);
    if (activeTab === 'quran')    c = c.filter(quranFilter);
    if (activeTab === 'kegiatan') c = c.filter(x => x.nama_asrama === activeAsrama);
    if (waktuFilter !== 'semua')  c = c.filter(x => waktuFilter === 'pagi' ? x.jam_mulai < '12:00:00' : x.jam_mulai >= '12:00:00');
    if (search) {
      const q = search.toLowerCase();
      c = c.filter(x => x.guru_nama.toLowerCase().includes(q) || (x.nama_kelas||'').toLowerCase().includes(q) || (x.mata_pelajaran||'').toLowerCase().includes(q));
    }
    return [...c].sort((a, b) => (a.jam_mulai||'').localeCompare(b.jam_mulai||'') || (a.nama_kelas||'').localeCompare(b.nama_kelas||''));
  }, [allCards, activeTab, madinFilter, quranFilter, activeAsrama, waktuFilter, search]);

  // ─── Counts ────────────────────────────────────────────────────────────────
  const countByTab = (tab: string) => tab === 'semua' ? allCards.length : allCards.filter(c => c.tipe === tab).length;
  const totalCards = filteredCards.length;
  const belumCards = filteredCards.filter(c => c.status === null).length;
  const hadirCards = filteredCards.filter(c => c.status === 'Hadir').length;
  const alphaCards = filteredCards.filter(c => c.status === 'Alpha').length;

  // All schedules of selected guru (for popup)
  const selectedGuruAll = useMemo(() =>
    selectedCard ? allCards.filter(c => c.guru_id === selectedCard.guru_id) : [],
    [selectedCard, allCards]);

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">

      {/* ── Banner topbar monitoring ────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-teal-700 via-emerald-700 to-green-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} />
            <div>
              <div className="font-extrabold text-sm leading-tight">Monitoring Kehadiran Guru / Pembina</div>
              <div className="text-white/70 text-[11px] font-medium">PP. Matholi'ul Anwar</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-white/70 text-[11px]">{dateHeaderStr}</div>
              <div className="font-mono font-extrabold text-yellow-300 text-xl tracking-widest leading-tight">{clockStr}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky controls ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-400 font-medium">
            {hari}{hari ? ', ' : ''}{new Date(tanggal + 'T00:00:00').toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'})}
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            <button onClick={fetchData} disabled={loading}
              className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-3 space-y-3">

        {/* ── Summary cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label:'Total Sesi', value:totalCards, color:'text-gray-700 dark:text-gray-200',   bg:'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700', icon:<BookOpen size={16}/> },
            { label:'Belum',      value:belumCards, color:'text-amber-600 dark:text-amber-300', bg:'bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900', icon:<Clock size={16}/> },
            { label:'Hadir',      value:hadirCards, color:'text-emerald-600 dark:text-emerald-300', bg:'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900', icon:<UserCheck size={16}/> },
            { label:'Alpha',      value:alphaCards, color:'text-red-600 dark:text-red-300',     bg:'bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900', icon:<UserX size={16}/> },
          ].map((c,i) => (
            <div key={i} className={`${c.bg} rounded-2xl p-3 flex flex-col items-center gap-0.5 shadow-sm`}>
              <span className={c.color}>{c.icon}</span>
              <span className={`text-xl font-black ${c.color}`}>{loading ? '—' : c.value}</span>
              <span className={`text-[10px] font-semibold ${c.color} opacity-70 text-center leading-tight`}>{c.label}</span>
            </div>
          ))}
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
            { key:'quran'    as const, label:"Kelas Qur'an",    active:'bg-emerald-500' },
            { key:'madin'    as const, label:'Kelas Madin',      active:'bg-teal-500'   },
            { key:'kegiatan' as const, label:'Kegiatan Asrama', active:'bg-blue-500'   },
          ]).map(tab => (
            <button key={tab.key}
              onClick={() => { setActiveTab(tab.key); if (tab.key !== 'madin') setActiveAsrama('Asrama A'); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-xl transition-all ${
                activeTab===tab.key ? `${tab.active} text-white shadow-md` : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}>
              {tab.label}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${activeTab===tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                {loading ? '…' : countByTab(tab.key)}
              </span>
            </button>
          ))}
        </div>

        {/* ── Sub-tabs (mirrors tabel-jadwal exactly) ─────────────────────────── */}
        {activeTab !== 'semua' && (
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-3">

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

            {/* Qur'an: asrama */}
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

            {/* Kegiatan: asrama */}
            {activeTab === 'kegiatan' && (
              <div className="flex w-full bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700 flex-wrap gap-1">
                {ASRAMAS_KEGIATAN.map(asr => (
                  <button key={asr} onClick={() => setActiveAsrama(asr)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center ${activeAsrama===asr ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
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

        {/* ── Pagi / Malam filter ──────────────────────────────────────────────── */}
        <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 gap-1">
          {([['semua','Semua Waktu'],['pagi','🌅 Pagi (AM)'],['malam','🌙 Malam (PM)']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setWaktuFilter(k)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all text-center ${
                waktuFilter===k ? 'bg-slate-600 dark:bg-slate-700 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}>{l}</button>
          ))}
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

        {/* ── Loading skeleton ───────────────────────────────────────────────── */}
        {loading && (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {[...Array(12)].map((_,i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse overflow-hidden">
                <div className="h-10 bg-gray-200 dark:bg-gray-700" />
                <div className="p-3 space-y-2">
                  <div className="flex gap-2 items-center"><div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0"/><div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full flex-1"/></div>
                  <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full w-3/4"/>
                  <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded-xl w-full mt-1"/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Jadwal Cards Grid (auto-fill, lebar mengisi layar) ───────────────── */}
        {!loading && !error && (
          filteredCards.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <BookOpen size={48} className="mx-auto mb-3 opacity-20" />
              <p className="font-semibold">Tidak ada jadwal yang cocok</p>
              <p className="text-xs text-gray-300 mt-1">Coba ubah filter tab atau waktu</p>
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {filteredCards.map((card, idx) => {
                const sc = STATUS_COLOR[card.status || 'default'] || STATUS_COLOR.default;
                const hc = TIPE_HEADER[card.tipe] || 'bg-gray-500';
                return (
                  <div key={`${card.guru_id}-${card.jadwal_id}-${card.jam_mulai}-${idx}`}
                    onClick={() => setSelectedCard(card)}
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col">

                    {/* Card header — colored, shows nama_kelas */}
                    <div className={`${hc} px-3 py-2 flex items-center justify-between gap-1`}>
                      <span className="text-white text-[11px] font-extrabold leading-tight flex-1"
                        style={{ display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                        {card.nama_kelas || '—'}
                      </span>
                      <span className="text-white/80 text-[10px] font-mono shrink-0 ml-1 bg-black/20 rounded px-1">
                        {fmt(card.jam_mulai)}
                      </span>
                    </div>

                    {/* Card body */}
                    <div className="p-3 flex-1 space-y-2">
                      {/* Guru row */}
                      <div className="flex items-start gap-2">
                        {card.guru_foto ? (
                          <img src={card.guru_foto} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700 shrink-0 mt-0.5" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
                            <Users size={14} className="text-gray-400" />
                          </div>
                        )}
                        <span className="text-[12px] font-bold text-gray-800 dark:text-gray-100 leading-tight"
                          style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                          {card.guru_nama}
                        </span>
                      </div>

                      {/* Mata pelajaran */}
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
                        {card.mata_pelajaran || '—'}
                      </div>

                      {/* Asrama info for kegiatan */}
                      {card.tipe === 'kegiatan' && card.nama_asrama && (
                        <div className="flex items-center gap-1 text-[10px] text-blue-500">
                          <Home size={10} /> {card.nama_asrama}
                        </div>
                      )}

                      {/* Jam */}
                      <div className="text-[10px] text-gray-400 font-mono">
                        {fmt(card.jam_mulai)} – {fmt(card.jam_selesai)}
                      </div>
                    </div>

                    {/* Status badge footer */}
                    <div className="px-3 pb-3">
                      <span className={`block text-center text-[11px] px-2 py-1 rounded-xl font-bold border ${sc}`}>
                        {card.status || 'Belum Absen'}
                      </span>
                    </div>
                  </div>
                );
              })}
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
