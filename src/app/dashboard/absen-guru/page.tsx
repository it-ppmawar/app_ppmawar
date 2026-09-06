'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Clock, RefreshCw, BookOpen, ClipboardList,
  WifiOff, UserCheck, UserX, Search, X, Home, Building2,
  QrCode, CalendarDays, Camera, CheckCircle2, AlertCircle,
  Sparkles, SlidersHorizontal, Check, UserPlus, Phone
} from 'lucide-react';
import Link from 'next/link';

// ─── Constants Dewan Guru ───────────────────────────────────────────────────
const HOMEBASES = [
  'SEMUA',
  'TKM NU MAWAR',
  'MI BANIN',
  'MI BANAT',
  'SMP NU',
  'MTS PUTRA-PUTRI',
  'MA MAWAR',
  'SMK NU',
  'MADIN',
  'MQ',
  'KOPMA',
  'KLINIK',
  'KBIHU MAWAR'
];

const STATUS_COLOR_DEWAN: Record<string, { badge: string; border: string; text: string }> = {
  Hadir: { badge: 'bg-emerald-500 text-white', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300' },
  Izin: { badge: 'bg-blue-500 text-white', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300' },
  Sakit: { badge: 'bg-amber-500 text-white', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300' },
  Alpha: { badge: 'bg-rose-500 text-white', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-300' },
  default: { badge: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-800', text: 'text-slate-500 dark:text-slate-400' }
};

// ─── Constants Santri KBM ───────────────────────────────────────────────────
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

export default function AbsenGuruPage() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [isPengasuh, setIsPengasuh] = useState(false);

  // Mode: dewan_guru (Utama) vs santri_kbm (Jadwal Madin/Quran/Kegiatan)
  const [mainMode, setMainMode] = useState<'dewan_guru' | 'santri_kbm'>('dewan_guru');

  // Tanggal & Jam
  const [tanggal, setTanggal] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  });
  const [clockStr, setClockStr] = useState('');
  const [dateHeaderStr, setDateHeaderStr] = useState('');

  useEffect(() => {
    const DAY = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    const tick = () => {
      const n = new Date();
      setDateHeaderStr(`${DAY[n.getDay()]}, ${n.getDate()} ${MON[n.getMonth()]} ${n.getFullYear()}`);
      setClockStr(`${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:${String(n.getSeconds()).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Auth Check
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth/me');
        const d = await r.json();
        if (!d.success) {
          router.replace('/dashboard');
          return;
        }
        const user = d.user;
        const pengasuhFlag = user.role === 'pengasuh' || user.is_pengasuh || user.isPengasuh;
        if (user.role !== 'admin' && user.role !== 'staff' && !pengasuhFlag) {
          router.replace('/dashboard');
          return;
        }
        setRole(user.role);
        setIsPengasuh(!!pengasuhFlag);
      } catch {
        router.replace('/dashboard');
      }
    })();
  }, [router]);

  // ═════════════════════════════════════════════════════════════════════════
  // STATE DEWAN GURU (TAB 1)
  // ═════════════════════════════════════════════════════════════════════════
  const [dewanLoading, setDewanLoading] = useState(true);
  const [dewanError, setDewanError] = useState('');
  const [dewanData, setDewanData] = useState<any[]>([]);
  const [dewanStats, setDewanStats] = useState({ total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0, belum: 0 });
  const [dewanHomebase, setDewanHomebase] = useState('SEMUA');
  const [dewanStatusFilter, setDewanStatusFilter] = useState('SEMUA');
  const [dewanSearch, setDewanSearch] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);

  // Modal Input Absensi Guru
  const [inputModalGuru, setInputModalGuru] = useState<any>(null);
  const [inputStatus, setInputStatus] = useState<'Hadir' | 'Izin' | 'Sakit' | 'Alpha'>('Hadir');
  const [inputKeterangan, setInputKeterangan] = useState('');
  const [submittingInput, setSubmittingInput] = useState(false);

  // Modal QR Scanner
  const [showScanner, setShowScanner] = useState(false);
  const [scanResultMsg, setScanResultMsg] = useState('');
  const html5QrCodeRef = useRef<any>(null);

  // Fetch Dewan Guru Attendance
  const fetchDewanData = useCallback(async () => {
    setDewanLoading(true);
    setDewanError('');
    try {
      let url = `/api/dewan-guru/absen?tanggal=${tanggal}`;
      if (dewanHomebase !== 'SEMUA') url += `&homebase=${encodeURIComponent(dewanHomebase)}`;

      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setDewanError(json.error || 'Gagal memuat absensi dewan guru.');
      } else {
        setDewanData(json.data || []);
        if (json.stats) setDewanStats(json.stats);
      }
    } catch {
      setDewanError('Koneksi gagal.');
    } finally {
      setDewanLoading(false);
    }
  }, [tanggal, dewanHomebase]);

  useEffect(() => {
    if ((role || isPengasuh) && mainMode === 'dewan_guru') {
      fetchDewanData();
    }
  }, [role, isPengasuh, mainMode, fetchDewanData]);

  const [dewanDisplayLimit, setDewanDisplayLimit] = useState(60);

  // Filter Dewan Guru
  const filteredDewanList = useMemo(() => {
    let list = dewanData;

    if (dewanStatusFilter !== 'SEMUA') {
      if (dewanStatusFilter === 'BELUM') {
        list = list.filter(g => !g.status);
      } else {
        list = list.filter(g => g.status === dewanStatusFilter);
      }
    }

    if (dewanSearch.trim()) {
      const q = dewanSearch.toLowerCase();
      list = list.filter(
        g =>
          (g.nama || '').toLowerCase().includes(q) ||
          (g.homebase || '').toLowerCase().includes(q) ||
          (g.nip || '').includes(q)
      );
    }

    return list;
  }, [dewanData, dewanStatusFilter, dewanSearch]);

  useEffect(() => {
    setDewanDisplayLimit(60);
  }, [dewanHomebase, dewanStatusFilter, dewanSearch]);

  const displayedDewanList = useMemo(() => {
    return filteredDewanList.slice(0, dewanDisplayLimit);
  }, [filteredDewanList, dewanDisplayLimit]);

  // Open modal input
  const openInputModal = (guru: any) => {
    setInputModalGuru(guru);
    setInputStatus(guru.status || 'Hadir');
    setInputKeterangan(guru.keterangan || '');
  };

  // Submit attendance
  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputModalGuru || submittingInput) return;

    setSubmittingInput(true);
    try {
      const res = await fetch('/api/dewan-guru/absen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guru_id: inputModalGuru.id,
          tanggal,
          status: inputStatus,
          keterangan: inputKeterangan
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Gagal menyimpan absensi');
      } else {
        setInputModalGuru(null);
        await fetchDewanData();
      }
    } catch {
      alert('Koneksi gagal.');
    } finally {
      setSubmittingInput(false);
    }
  };

  // Batch set status for remaining teachers
  const handleBatchSetStatus = async (targetStatus: 'Hadir' | 'Izin' | 'Sakit' | 'Alpha') => {
    const unrecorded = filteredDewanList.filter(g => !g.status);
    if (unrecorded.length === 0) {
      alert('Semua guru dalam daftar/filter ini sudah memiliki status absensi.');
      return;
    }
    const filterInfo = dewanHomebase !== 'SEMUA' ? ` (Unit: ${dewanHomebase})` : '';
    if (!confirm(`Tandai ${unrecorded.length} dewan guru yang belum absen${filterInfo} sebagai ${targetStatus.toUpperCase()} hari ini?`)) {
      return;
    }

    setBatchLoading(true);
    try {
      const batch = unrecorded.map(g => ({
        guru_id: g.id,
        status: targetStatus,
        keterangan: `Presensi Massal (${targetStatus})`
      }));
      const res = await fetch('/api/dewan-guru/absen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch, tanggal })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Gagal memperbarui absensi massal');
      } else {
        alert(`Berhasil menandai ${unrecorded.length} guru sebagai ${targetStatus}!`);
        await fetchDewanData();
      }
    } catch {
      alert('Koneksi gagal.');
    } finally {
      setBatchLoading(false);
    }
  };

  // QR Scanner Controller
  useEffect(() => {
    if (showScanner) {
      let isMounted = true;
      (async () => {
        try {
          const { Html5Qrcode } = await import('html5-qrcode');
          if (!isMounted) return;
          const scanner = new Html5Qrcode('qr-reader-dewan');
          html5QrCodeRef.current = scanner;

          await scanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            async (decodedText: string) => {
              let tokenFound = decodedText;
              if (decodedText.includes('token=')) {
                try {
                  const urlObj = new URL(decodedText);
                  tokenFound = urlObj.searchParams.get('token') || decodedText;
                } catch {
                  const match = decodedText.match(/token=([a-zA-Z0-9_-]+)/);
                  if (match) tokenFound = match[1];
                }
              }

              // Send to server
              try {
                const res = await fetch('/api/dewan-guru/absen', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ qr_token: tokenFound, tanggal, status: 'Hadir' })
                });
                const json = await res.json();
                if (json.success) {
                  setScanResultMsg(`✅ ${json.message}`);
                  fetchDewanData();
                } else {
                  setScanResultMsg(`⚠️ ${json.error}`);
                }
              } catch {
                setScanResultMsg('❌ Gagal menghubungi server.');
              }
            },
            () => {}
          );
        } catch (err: any) {
          console.error('Camera error', err);
        }
      })();

      return () => {
        isMounted = false;
        if (html5QrCodeRef.current) {
          html5QrCodeRef.current.stop().catch(() => {});
        }
      };
    }
  }, [showScanner, tanggal, fetchDewanData]);

  // ═════════════════════════════════════════════════════════════════════════
  // STATE SANTRI KBM (TAB 2 - EXISTING CODE PRESERVED)
  // ═════════════════════════════════════════════════════════════════════════
  const [kbmLoading, setKbmLoading] = useState(false);
  const [kbmError, setKbmError] = useState('');
  const [kbmData, setKbmData] = useState<any[]>([]);
  const [kbmHari, setKbmHari] = useState('');
  const [kegiatanRaw, setKegiatanRaw] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'semua' | 'madin' | 'quran' | 'kegiatan'>('semua');
  const [genderMode, setGenderMode] = useState<'PUTRA' | 'PUTRI'>('PUTRA');
  const [levelTab, setLevelTab] = useState<'WUSTHO_MAK' | 'ULA' | 'WUSTHO'>('WUSTHO_MAK');
  const [activeAsrama, setActiveAsrama] = useState('Asrama A');
  const [waktuFilter, setWaktuFilter] = useState<'semua' | 'pagi' | 'siang' | 'sore' | 'malam'>('semua');
  const [kbmSearch, setKbmSearch] = useState('');
  const [selectedCard, setSelectedCard] = useState<any>(null);

  const fetchKbmData = useCallback(async () => {
    setKbmLoading(true);
    setKbmError('');
    try {
      const res = await fetch(`/api/absen-guru?tanggal=${tanggal}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setKbmError(json.error || 'Gagal memuat data');
        return;
      }
      setKbmData(json.data || []);
      setKbmHari(json.hari || '');
      setKegiatanRaw(json.kegiatanJadwal || []);
    } catch {
      setKbmError('Koneksi gagal.');
    } finally {
      setKbmLoading(false);
    }
  }, [tanggal]);

  useEffect(() => {
    if ((role || isPengasuh) && mainMode === 'santri_kbm') {
      fetchKbmData();
    }
  }, [role, isPengasuh, mainMode, fetchKbmData]);

  const allCards = useMemo(
    () =>
      kbmData.flatMap(g =>
        (g.jadwal || [])
          .filter((j: any) => j.tipe !== 'kegiatan')
          .map((j: any) => ({
            ...j,
            guru_id: g.guru_id,
            guru_nama: g.nama,
            guru_foto: g.foto,
            guru_nip: g.nip
          }))
      ),
    [kbmData]
  );

  const allCardsWithKegiatan = useMemo(() => [...allCards, ...kegiatanRaw], [allCards, kegiatanRaw]);

  const matchAsrama = (asramaProp: string | null, target: string) => {
    if (!asramaProp) return false;
    const a = asramaProp.trim().toLowerCase();
    const t = target.trim().toLowerCase();
    if (a === t) return true;
    return a.replace(/^asrama\s+/, '') === t.replace(/^asrama\s+/, '');
  };

  const madinFilter = useCallback(
    (c: any) => {
      const n = (c.nama_kelas || '').toUpperCase();
      const putri = n.includes('PUTRI') || n.includes('TQ PUTRI');
      if (genderMode === 'PUTRI' ? !putri : putri) return false;
      if (genderMode === 'PUTRA') {
        return levelTab === 'WUSTHO_MAK'
          ? n.includes('WUSTHO') || n.includes('MAK') || n === 'TQ PUTRA'
          : n.includes('ULA');
      }
      return levelTab === 'WUSTHO'
        ? n.includes('WUSTHO') || n.includes('MAK')
        : n.includes('ULA') || n.includes('TQ PUTRI');
    },
    [genderMode, levelTab]
  );

  const quranFilter = useCallback(
    (c: any) => {
      const n = (c.nama_kelas || '').toUpperCase();
      if (activeAsrama === 'Tahfidz Putra') return n.includes('TAHFIDZ') && n.includes('ASRAMA A');
      if (activeAsrama === 'Tahfidz Putri') return n.includes('TAHFIDZ PUTRI');
      if (activeAsrama === 'Asrama A') return n.includes('ASRAMA A') && !n.includes('TAHFIDZ');
      return n.includes(activeAsrama.toUpperCase()) && !n.includes('TAHFIDZ PUTRI');
    },
    [activeAsrama]
  );

  const matchesWaktuFilter = (jamMulai: string | undefined, filter: string) => {
    if (filter === 'semua' || !jamMulai) return true;
    const t = jamMulai.substring(0, 5);
    if (filter === 'pagi') return t > '00:00' && t <= '06:00';
    if (filter === 'siang') return t > '06:00' && t <= '12:00';
    if (filter === 'sore') return t > '12:00' && t <= '18:00';
    if (filter === 'malam') return (t > '18:00' && t <= '23:59') || t === '00:00';
    return true;
  };

  const filteredKbmCards = useMemo(() => {
    let c: any[];
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
    if (kbmSearch) {
      const q = kbmSearch.toLowerCase();
      c = c.filter(
        x =>
          (x.guru_nama || '').toLowerCase().includes(q) ||
          (x.nama_kelas || '').toLowerCase().includes(q) ||
          (x.mata_pelajaran || '').toLowerCase().includes(q)
      );
    }
    return [...c].sort(
      (a, b) =>
        (a.jam_mulai || '').localeCompare(b.jam_mulai || '') ||
        (a.nama_kelas || '').localeCompare(b.nama_kelas || '')
    );
  }, [allCards, allCardsWithKegiatan, kegiatanRaw, activeTab, madinFilter, quranFilter, activeAsrama, waktuFilter, kbmSearch]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28">
      <div className="max-w-7xl mx-auto px-4 pt-4 space-y-3">
        {/* ── Header Card ──────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-teal-50 to-emerald-100 dark:from-teal-950/40 dark:to-emerald-950/40 rounded-3xl p-4 sm:p-5 border border-teal-200 dark:border-teal-900/50 relative overflow-hidden shadow-xs">
          <div className="absolute top-0 right-0 -mt-3 -mr-3 text-teal-200/40 dark:text-teal-900/20 pointer-events-none">
            <ClipboardList size={110} />
          </div>
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-black text-teal-800 dark:text-teal-300 flex items-center gap-1.5 leading-tight">
                  <ClipboardList size={20} className="shrink-0 text-teal-600 dark:text-teal-400" />
                  <span>Presensi Kehadiran Dewan Guru YPMA</span>
                </h1>
                <p className="text-teal-600 dark:text-teal-400 text-xs sm:text-sm font-medium mt-0.5">
                  PP. Matholi'ul Anwar Simo Sungelebak
                </p>
              </div>

              {/* Desktop Clock */}
              <div className="hidden sm:block text-right shrink-0">
                <div className="text-teal-600 dark:text-teal-400 text-[11px] font-medium">{dateHeaderStr}</div>
                <div className="font-mono font-black text-2xl text-teal-800 dark:text-teal-300 tracking-widest leading-tight">
                  {clockStr}
                </div>
              </div>
            </div>

            {/* Row 2: Controls & Navigation Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mt-3 pt-2.5 border-t border-teal-200/60 dark:border-teal-900/40">
              {/* Group 1: Pilihan Tanggal & Atur Jadwal (2 Kolom Presisi Memenuhi Lebar) */}
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                <input
                  type="date"
                  value={tanggal}
                  onChange={e => setTanggal(e.target.value)}
                  className="w-full text-xs font-bold border border-teal-200 dark:border-teal-800 rounded-xl px-2.5 py-2 bg-white/80 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-400 text-center shadow-xs cursor-pointer"
                />
                <Link
                  href="/dashboard/jadwal-dewan-guru"
                  className="w-full py-2 px-2 sm:px-3 rounded-xl bg-white/80 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 hover:bg-white border border-teal-200 dark:border-teal-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs text-center truncate"
                >
                  <CalendarDays size={13} className="shrink-0" />
                  <span>Atur Jadwal</span>
                </Link>
              </div>

              {/* Group 2: Kartu QR, Segarkan, Scan QR (3 Kolom Presisi Memenuhi Lebar) */}
              <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
                <Link
                  href="/dashboard/qr-dewan-guru"
                  className="w-full py-2 px-2 sm:px-3 rounded-xl bg-white/80 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 hover:bg-white border border-teal-200 dark:border-teal-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs text-center truncate"
                >
                  <QrCode size={13} className="shrink-0" />
                  <span>Kartu QR</span>
                </Link>

                <button
                  onClick={mainMode === 'dewan_guru' ? fetchDewanData : fetchKbmData}
                  disabled={dewanLoading || kbmLoading}
                  className="w-full py-2 px-2 sm:px-3 rounded-xl bg-white/80 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 hover:bg-white border border-teal-200 dark:border-teal-800 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-center truncate"
                  title="Segarkan data"
                >
                  <RefreshCw size={13} className={`shrink-0 ${(dewanLoading || kbmLoading) ? 'animate-spin' : ''}`} />
                  <span>Segarkan</span>
                </button>

                <button
                  onClick={() => setShowScanner(true)}
                  className="w-full py-2 px-2 sm:px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer text-center truncate"
                >
                  <Camera size={13} className="shrink-0" />
                  <span>Scan QR</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Mode Switcher: Dewan Guru YPMA vs Jadwal Santri ────────────────── */}
        <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 gap-1.5">
          <button
            onClick={() => setMainMode('dewan_guru')}
            className={`flex-1 py-2.5 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
              mainMode === 'dewan_guru'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users size={15} />
            <span>Dewan Guru YPMA (441 Guru)</span>
          </button>

          <button
            onClick={() => setMainMode('santri_kbm')}
            className={`flex-1 py-2.5 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
              mainMode === 'santri_kbm'
                ? 'bg-slate-700 text-white shadow-md'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen size={15} />
            <span>Jadwal Mengajar Santri (KBM)</span>
          </button>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* VIEW 1: DEWAN GURU YPMA                                              */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {mainMode === 'dewan_guru' && (
          <div className="space-y-3">
            {/* Stats Summary Cards */}
            <div className="space-y-2">
              {/* Baris 1: Total Guru (1 Baris Memenuhi Kanan Kiri) */}
              <div className="bg-white dark:bg-slate-900 px-4 py-2.5 sm:py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
                    <Users size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Guru</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block">Dewan Guru & Staf YPMA</p>
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">{dewanStats.total}</p>
              </div>

              {/* Baris 2: Hadir, Sakit, Izin, Alpha (1 Baris Berdampingan 4 Kolom) */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
                {/* 1. Hadir */}
                <div
                  onClick={() => setDewanStatusFilter(dewanStatusFilter === 'Hadir' ? 'SEMUA' : 'Hadir')}
                  className={`p-2 sm:p-2.5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                    dewanStatusFilter === 'Hadir'
                      ? 'bg-emerald-500 text-white border-emerald-600'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase opacity-80 truncate">Hadir</p>
                  <p className="text-lg sm:text-xl font-black">{dewanStats.hadir}</p>
                </div>

                {/* 2. Sakit */}
                <div
                  onClick={() => setDewanStatusFilter(dewanStatusFilter === 'Sakit' ? 'SEMUA' : 'Sakit')}
                  className={`p-2 sm:p-2.5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                    dewanStatusFilter === 'Sakit'
                      ? 'bg-amber-600 text-white border-amber-700'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase opacity-80 truncate">Sakit</p>
                  <p className="text-lg sm:text-xl font-black">{dewanStats.sakit}</p>
                </div>

                {/* 3. Izin */}
                <div
                  onClick={() => setDewanStatusFilter(dewanStatusFilter === 'Izin' ? 'SEMUA' : 'Izin')}
                  className={`p-2 sm:p-2.5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                    dewanStatusFilter === 'Izin'
                      ? 'bg-blue-500 text-white border-blue-600'
                      : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase opacity-80 truncate">Izin</p>
                  <p className="text-lg sm:text-xl font-black">{dewanStats.izin}</p>
                </div>

                {/* 4. Alpha */}
                <div
                  onClick={() => setDewanStatusFilter(dewanStatusFilter === 'Alpha' ? 'SEMUA' : 'Alpha')}
                  className={`p-2 sm:p-2.5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                    dewanStatusFilter === 'Alpha'
                      ? 'bg-rose-500 text-white border-rose-600'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase opacity-80 truncate">Alpha</p>
                  <p className="text-lg sm:text-xl font-black">{dewanStats.alpha}</p>
                </div>
              </div>

              {/* Baris 3: Belum Absen (1 Baris Memenuhi Kanan Kiri) */}
              <div
                onClick={() => setDewanStatusFilter(dewanStatusFilter === 'BELUM' ? 'SEMUA' : 'BELUM')}
                className={`px-4 py-2.5 sm:py-3 rounded-2xl border transition-all cursor-pointer shadow-xs flex items-center justify-between ${
                  dewanStatusFilter === 'BELUM'
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${dewanStatusFilter === 'BELUM' ? 'bg-amber-600 text-white' : 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400'}`}>
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider opacity-90">Belum Absen</p>
                    <p className="text-xs opacity-75 font-medium hidden sm:block">Saring guru yang belum presensi</p>
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-black">{dewanStats.belum}</p>
              </div>
            </div>

            {/* Filter Bar: Homebase Pills + Search */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              {/* Homebase Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                {HOMEBASES.map(hb => (
                  <button
                    key={hb}
                    onClick={() => setDewanHomebase(hb)}
                    className={`py-1.5 px-3 rounded-xl font-bold whitespace-nowrap shrink-0 transition-all ${
                      dewanHomebase === hb
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {hb === 'SEMUA' ? '🌐 Semua Unit' : hb}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative w-full pt-1 border-t border-slate-100 dark:border-slate-800">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 mt-0.5" />
                <input
                  type="text"
                  placeholder="Cari nama guru, homebase, atau NIP..."
                  value={dewanSearch}
                  onChange={e => setDewanSearch(e.target.value)}
                  className="w-full text-xs pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
                {dewanSearch && (
                  <button
                    onClick={() => setDewanSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 mt-0.5"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Set Massal 4 Tombol */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    ⚡ Set Massal ({filteredDewanList.filter(g => !g.status).length} Guru Belum Absen)
                  </p>
                  {batchLoading && (
                    <span className="text-[11px] font-bold text-teal-600 animate-pulse">
                      Memproses...
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  <button
                    disabled={batchLoading}
                    onClick={() => handleBatchSetStatus('Hadir')}
                    className="py-2.5 text-xs font-bold rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border dark:border-emerald-800/60 transition-all active:scale-95 text-center cursor-pointer disabled:opacity-50"
                  >
                    Hadir All
                  </button>
                  <button
                    disabled={batchLoading}
                    onClick={() => handleBatchSetStatus('Izin')}
                    className="py-2.5 text-xs font-bold rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 dark:border dark:border-blue-800/60 transition-all active:scale-95 text-center cursor-pointer disabled:opacity-50"
                  >
                    Izin All
                  </button>
                  <button
                    disabled={batchLoading}
                    onClick={() => handleBatchSetStatus('Sakit')}
                    className="py-2.5 text-xs font-bold rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 dark:border dark:border-amber-800/60 transition-all active:scale-95 text-center cursor-pointer disabled:opacity-50"
                  >
                    Sakit All
                  </button>
                  <button
                    disabled={batchLoading}
                    onClick={() => handleBatchSetStatus('Alpha')}
                    className="py-2.5 text-xs font-bold rounded-xl bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300 dark:border dark:border-red-800/60 transition-all active:scale-95 text-center cursor-pointer disabled:opacity-50"
                  >
                    Alpha All
                  </button>
                </div>
              </div>
            </div>

            {/* Error Notification */}
            {dewanError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <WifiOff size={15} /> {dewanError}
              </div>
            )}

            {/* Teacher Attendance Cards */}
            {dewanLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-3 animate-pulse space-y-2">
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full w-3/4 mx-auto" />
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full w-1/2 mx-auto" />
                  </div>
                ))}
              </div>
            ) : filteredDewanList.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
                <Users size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <h3 className="font-extrabold text-slate-700 dark:text-slate-200 text-sm">Tidak Ada Data Guru</h3>
                <p className="text-xs text-slate-400 mt-1">Coba sesuaikan filter status atau kata kunci pencarian.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                  {displayedDewanList.map((guru, idx) => {
                    const statusConf = STATUS_COLOR_DEWAN[guru.status || 'default'] || STATUS_COLOR_DEWAN.default;

                    return (
                      <div
                        key={guru.id}
                        onClick={() => openInputModal(guru)}
                        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all p-3 flex flex-col justify-between cursor-pointer group"
                      >
                        <div>
                          {/* Header: Homebase & Gender */}
                          <div className="flex items-center justify-between gap-1 mb-2">
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 truncate max-w-[75%]">
                              {guru.homebase}
                            </span>
                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${
                              guru.jenis_kelamin === 'P'
                                ? 'bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300'
                                : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                            }`}>
                              {guru.jenis_kelamin}
                            </span>
                          </div>

                          {/* Avatar Initial */}
                          <div className="flex items-center justify-center my-2">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-sm">
                              {guru.nama ? guru.nama[0] : 'G'}
                            </div>
                          </div>

                          {/* Name & NIP */}
                          <div className="text-center">
                            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight group-hover:text-teal-600 transition-colors">
                              {guru.nama}
                            </h3>
                            {guru.nip ? (
                              <p className="text-[10px] text-slate-400 mt-0.5">NIP: {guru.nip}</p>
                            ) : guru.no_hp ? (
                              <p className="text-[9px] font-mono text-slate-400 mt-0.5 truncate">{guru.no_hp}</p>
                            ) : null}
                          </div>
                        </div>

                        {/* Status / Action Button */}
                        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className={`py-1.5 px-2 rounded-xl text-center text-[10px] font-black transition-all flex items-center justify-center gap-1 ${
                            guru.status
                              ? statusConf.badge
                              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-dashed border-slate-300 dark:border-slate-700 group-hover:border-teal-400 group-hover:bg-teal-50 dark:group-hover:bg-teal-950/40 group-hover:text-teal-700 dark:group-hover:text-teal-300'
                          }`}>
                            {guru.status ? (
                              <span>{guru.status}</span>
                            ) : (
                              <span>Catat Absen</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Load More Controls for Desktop/Mobile Performance */}
                {filteredDewanList.length > displayedDewanList.length && (
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2 pb-4">
                    <button
                      onClick={() => setDewanDisplayLimit(prev => prev + 60)}
                      className="py-2.5 px-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      Muat Lebih Banyak (+60 guru)
                    </button>
                    <button
                      onClick={() => setDewanDisplayLimit(filteredDewanList.length)}
                      className="py-2.5 px-5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition-all shadow-xs cursor-pointer"
                    >
                      Tampilkan Semua ({filteredDewanList.length} guru)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* VIEW 2: SANTRI KBM (EXISTING DETAILED SCHEDULE VIEW)                 */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {mainMode === 'santri_kbm' && (
          <div className="space-y-3">
            {/* Tab SEMUA (full width) */}
            <div className="bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('semua')}
                className={`w-full flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                  activeTab === 'semua'
                    ? 'bg-slate-600 dark:bg-slate-700 text-white shadow-md'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                Semua KBM
                <span className="text-[10px] px-3 py-0.5 rounded-full font-extrabold bg-white/20 text-white">
                  {allCardsWithKegiatan.length}
                </span>
              </button>
            </div>

            {/* Tabs Qur'an | Madin | Kegiatan */}
            <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700 gap-1.5">
              {[
                { key: 'quran' as const, labelFull: "Kelas Qur'an", labelShort: "Qur'an", active: 'bg-emerald-500' },
                { key: 'madin' as const, labelFull: 'Kelas Madin', labelShort: 'Madin', active: 'bg-teal-500' },
                { key: 'kegiatan' as const, labelFull: 'Kegiatan Asrama', labelShort: 'Kegiatan', active: 'bg-blue-500' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    if (tab.key !== 'madin') setActiveAsrama('Asrama A');
                  }}
                  className={`flex-1 flex items-center justify-center gap-1 px-1 sm:px-3 py-2.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all ${
                    activeTab === tab.key ? `${tab.active} text-white shadow-md` : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <span className="sm:hidden">{tab.labelShort}</span>
                  <span className="hidden sm:inline">{tab.labelFull}</span>
                </button>
              ))}
            </div>

            {/* Sub-tabs Madin / Qur'an / Kegiatan */}
            {activeTab !== 'semua' && (
              <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700 flex flex-col gap-3">
                {activeTab === 'madin' && (
                  <div className="flex w-full bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700">
                    {(['PUTRA', 'PUTRI'] as const).map(g => (
                      <button
                        key={g}
                        onClick={() => setGenderMode(g)}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center ${
                          genderMode === g ? 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 shadow-xs' : 'text-gray-500'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'quran' && (
                  <div className="flex w-full bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700 flex-wrap gap-1">
                    {ASRAMAS_QURAN.map(asr => (
                      <button
                        key={asr}
                        onClick={() => setActiveAsrama(asr)}
                        className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all text-center ${
                          activeAsrama === asr ? 'bg-emerald-500 text-white shadow-xs' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {asr}
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'kegiatan' && (
                  <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700">
                    {ASRAMAS_KEGIATAN.map(asr => (
                      <button
                        key={asr}
                        onClick={() => setActiveAsrama(asr)}
                        className={`py-2.5 text-xs font-bold rounded-lg transition-all text-center ${
                          activeAsrama === asr ? 'bg-blue-500 text-white shadow-xs' : 'text-gray-500'
                        }`}
                      >
                        {asr}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Search KBM */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari guru, kelas, atau mata pelajaran..."
                value={kbmSearch}
                onChange={e => setKbmSearch(e.target.value)}
                className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-xl pl-8 pr-8 py-2.5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* KBM Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pb-1">
              {filteredKbmCards.map((card, idx) => {
                const sc = STATUS_COLOR[card.status || 'default'] || STATUS_COLOR.default;
                const hc = TIPE_HEADER[card.tipe] || 'bg-gray-500';

                return (
                  <div
                    key={`${card.guru_id}-${card.jadwal_id}-${idx}`}
                    onClick={() => setSelectedCard(card)}
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col"
                  >
                    <div className={`${hc} px-3 py-2 flex items-center justify-between gap-1`}>
                      <span className="text-white text-[11px] font-extrabold leading-tight flex-1 line-clamp-1">
                        {card.nama_kelas || '—'}
                      </span>
                      <span className="text-white/80 text-[10px] font-mono shrink-0 ml-1 bg-black/20 rounded px-1">
                        {fmt(card.jam_mulai)}
                      </span>
                    </div>

                    <div className="p-2.5 flex-1 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                          <Users size={13} className="text-gray-400" />
                        </div>
                        <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100 leading-tight line-clamp-2">
                          {card.guru_nama}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium line-clamp-1">
                        {card.mata_pelajaran || '—'}
                      </div>
                    </div>

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
        )}
      </div>

      {/* ── Modal Input / Edit Status Absensi Guru ───────────────────────────── */}
      {inputModalGuru && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setInputModalGuru(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">Catat Presensi Guru</h3>
                  <p className="text-[10px] text-slate-400">{tanggal}</p>
                </div>
              </div>
              <button onClick={() => setInputModalGuru(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">{inputModalGuru.nama}</h4>
              <p className="text-xs text-teal-600 dark:text-teal-400 font-bold mt-0.5">{inputModalGuru.homebase}</p>
              {inputModalGuru.nip && <p className="text-[10px] text-slate-400">NIP: {inputModalGuru.nip}</p>}
            </div>

            <form onSubmit={handleSaveAttendance} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">Pilih Status:</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['Hadir', 'Izin', 'Sakit', 'Alpha'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setInputStatus(st)}
                      className={`py-2 px-2 rounded-xl font-black text-xs border transition-all ${
                        inputStatus === st
                          ? st === 'Hadir'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : st === 'Izin'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : st === 'Sakit'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Keterangan / Catatan:</label>
                <textarea
                  rows={2}
                  value={inputKeterangan}
                  onChange={e => setInputKeterangan(e.target.value)}
                  placeholder="Catatan kehadiran (opsional)..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setInputModalGuru(null)}
                  className="py-2.5 px-4 rounded-xl text-slate-500 hover:bg-slate-100 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingInput}
                  className="py-2.5 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black shadow-md shadow-teal-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {submittingInput ? 'Menyimpan...' : 'Simpan Presensi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Camera QR Scanner ─────────────────────────────────────────── */}
      {showScanner && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowScanner(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Camera size={16} className="text-teal-600" />
                <span>Pindai QR Presensi Guru</span>
              </h3>
              <button onClick={() => setShowScanner(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div id="qr-reader-dewan" className="w-full aspect-square rounded-2xl overflow-hidden bg-black" />

            {scanResultMsg && (
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-center text-slate-700 dark:text-slate-200">
                {scanResultMsg}
              </div>
            )}

            <p className="text-[10px] text-slate-400 text-center">
              Arahkan kamera ke Kartu QR Dewan Guru untuk mencatat absensi otomatis.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
