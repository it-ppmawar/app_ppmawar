'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Utensils, CheckCircle2, AlertTriangle, XCircle, Clock,
  Camera, Volume2, VolumeX, RefreshCw, User, ShieldAlert,
  Search, Check, Trash2, ArrowLeft, Coffee, Sun, Moon,
  Sparkles, Info, Settings2, AlertCircle, CalendarClock,
  SlidersHorizontal, X, Save, ClipboardCheck, QrCode, MapPin
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface SantriInfo {
  murid_id: number;
  nama: string;
  nis: string;
  asrama: string;
  kamar: string;
  foto?: string | null;
}

interface ScanResult {
  status: 'BERHASIL' | 'DISPENSASI' | 'TUNGGAKAN' | 'SUDAH_AMBIL' | 'TIDAK_DITEMUKAN' | 'ERROR';
  message: string;
  santri?: SantriInfo;
  sesi?: string;
  waktu?: string;
  totalTunggakan?: number;
  tunggakan?: any[];
  waktuSebelumnya?: string;
  crossAsramaWarning?: boolean;
}

interface SesiMakan {
  id: number;
  kode_sesi: string;
  nama_sesi: string;
  jam_mulai: string;
  jam_selesai: string;
  is_aktif: number;
  urutan: number;
  keterangan: string | null;
}

interface StatsData {
  totalScans: number;
  totalPorsi: number;
  totalBerhasil: number;
  totalDispensasi: number;
  totalDitolak: number;
}

export default function KuponMakanPage() {
  const [sessions, setSessions] = useState<SesiMakan[]>([]);
  const [activeSesi, setActiveSesi] = useState<string>('siang');
  const [presetAktif, setPresetAktif] = useState<string>('reguler_2x');
  const [porsiPerSesi, setPorsiPerSesi] = useState<Record<string, number>>({});
  
  const [barcodeInput, setBarcodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [stats, setStats] = useState<StatsData>({
    totalScans: 0,
    totalPorsi: 0,
    totalBerhasil: 0,
    totalDispensasi: 0,
    totalDitolak: 0
  });
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');

  // RBAC Authentication State
  const [authChecking, setAuthChecking] = useState(true);
  const [loadProgress, setLoadProgress] = useState(15);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userRole, setUserRole] = useState<string>('');

  // Asrama State (Tab klasifikasi & RBAC filter)
  const [selectedAsrama, setSelectedAsrama] = useState<string>('Semua');
  const [userAsrama, setUserAsrama] = useState<string | null>(null);
  const [canSwitchAsrama, setCanSwitchAsrama] = useState<boolean>(false);
  const [totalSantriLunas, setTotalSantriLunas] = useState<number>(0);

  // Animasi progress bar interaktif saat memuat data E-Kupon Makan
  useEffect(() => {
    let progressTimer: NodeJS.Timeout;
    if (authChecking) {
      setLoadProgress(15);
      progressTimer = setInterval(() => {
        setLoadProgress(prev => {
          if (prev >= 90) return prev;
          const inc = Math.floor(Math.random() * 10) + 7;
          return Math.min(prev + inc, 92);
        });
      }, 150);
    }
    return () => clearInterval(progressTimer);
  }, [authChecking]);

  // Modal Pengaturan Sesi & Jadwal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editableSessions, setEditableSessions] = useState<SesiMakan[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const cameraButtonRef = useRef<HTMLButtonElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Audio synthesizer via Web Audio API
  const playSound = useCallback((type: 'success' | 'warning' | 'error') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'success') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'warning') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(329.63, ctx.currentTime); // E4
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (_) {}
  }, [soundEnabled]);

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).format(now) + ' WIB'
      );
      setCurrentDateStr(
        new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }).format(now)
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Sesi & Stats
  const fetchStatsAndSesi = useCallback(async (asramaOverride?: string) => {
    try {
      const asramaQuery = asramaOverride ?? selectedAsrama;
      const params = new URLSearchParams();
      if (asramaQuery && asramaQuery !== 'Semua') params.set('asrama', asramaQuery);
      const res = await fetch(`/api/kupon-makan/stats${params.toString() ? `?${params}` : ''}`);
      const json = await res.json();
      if (json.success) {
        setStats(json.stats);
        setRecentScans(json.recentScans || []);
        setPorsiPerSesi(json.porsiPerSesi || {});
        if (typeof json.totalSantriLunas === 'number') {
          setTotalSantriLunas(json.totalSantriLunas);
        }
        if (json.userAsrama !== undefined) setUserAsrama(json.userAsrama);
        if (typeof json.canSwitchAsrama === 'boolean') setCanSwitchAsrama(json.canSwitchAsrama);
        if (json.sessions) {
          setSessions(json.sessions);
          setEditableSessions(JSON.parse(JSON.stringify(json.sessions)));
        }
        if (json.activeSesi) {
          setActiveSesi(prev => {
            // Jika user belum memilih secara manual atau sesi sebelumnya tidak aktif, ikuti database
            const isPrevActive = json.sessions?.some((s: SesiMakan) => s.kode_sesi === prev && s.is_aktif === 1);
            return isPrevActive ? prev : json.activeSesi;
          });
        }
        if (json.settings?.preset_aktif) {
          setPresetAktif(json.settings.preset_aktif);
        }
      }
    } catch (e) {
      console.error('Error fetching stats:', e);
    }
  }, [selectedAsrama]);

  useEffect(() => {
    const initAuthAndData = async () => {
      try {
        const resMe = await fetch('/api/auth/me');
        const dataMe = await resMe.json();
        if (dataMe.success && dataMe.user) {
          const r = (dataMe.user.role || '').toLowerCase();
          const isPengasuhOrPengurus = !!(
            dataMe.user.is_pengasuh ||
            dataMe.user.isPengasuh ||
            dataMe.user.is_pengurus_asrama ||
            dataMe.user.isPengurusAsrama ||
            r.includes('pengasuh') ||
            r.includes('pengurus')
          );
          const isMurniGuru = r === 'guru' && !isPengasuhOrPengurus;
          const allowed = (['admin', 'staff', 'pengurus_asrama', 'pengasuh', 'pengurus'].includes(r) || isPengasuhOrPengurus) && !isMurniGuru;

          setUserRole(r);
          setIsAuthorized(allowed);
          if (allowed) {
            await fetchStatsAndSesi();
            if (inputRef.current) inputRef.current.focus();
          }
        } else {
          setIsAuthorized(false);
        }
      } catch (err) {
        console.error('Auth check error:', err);
        setIsAuthorized(false);
      } finally {
        setLoadProgress(100);
        setTimeout(() => setAuthChecking(false), 200);
      }
    };

    initAuthAndData();
  }, [fetchStatsAndSesi]);

  // Re-fetch stats ketika tab asrama berubah (hanya setelah auth selesai)
  useEffect(() => {
    if (!authChecking && isAuthorized) {
      fetchStatsAndSesi(selectedAsrama);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAsrama]);

  // Process Scan
  const handleScan = async (code: string, forceDispensasi = false, catatan = '') => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    setLoading(true);
    try {
      const res = await fetch('/api/kupon-makan/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcodeData: cleanCode,
          sesi: activeSesi,
          forceDispensasi,
          catatanDispensasi: catatan
        })
      });

      const json = await res.json();

      if (json.status === 'BERHASIL') {
        playSound('success');
        setLastResult({
          status: 'BERHASIL',
          message: json.message,
          santri: json.data.santri,
          sesi: json.data.sesi,
          waktu: json.data.waktu,
          crossAsramaWarning: json.crossAsramaWarning
        });
      } else if (json.status === 'DISPENSASI') {
        playSound('success');
        setLastResult({
          status: 'DISPENSASI',
          message: json.message,
          santri: json.data.santri,
          sesi: json.data.sesi,
          waktu: json.data.waktu,
          totalTunggakan: json.data.totalTunggakan,
          crossAsramaWarning: json.crossAsramaWarning
        });
      } else if (json.status === 'SUDAH_AMBIL') {
        playSound('warning');
        setLastResult({
          status: 'SUDAH_AMBIL',
          message: json.message,
          santri: json.data.santri,
          sesi: json.data.sesi,
          waktuSebelumnya: json.data.waktu_sebelumnya,
          crossAsramaWarning: json.crossAsramaWarning
        });
      } else if (json.status === 'TUNGGAKAN') {
        playSound('error');
        setLastResult({
          status: 'TUNGGAKAN',
          message: json.message,
          santri: json.data.santri,
          sesi: json.data.sesi,
          totalTunggakan: json.data.totalTunggakan,
          tunggakan: json.data.tunggakan,
          crossAsramaWarning: json.crossAsramaWarning
        });
      } else {
        playSound('error');
        setLastResult({
          status: 'TIDAK_DITEMUKAN',
          message: json.message || 'Santri tidak ditemukan.'
        });
      }

      setBarcodeInput('');
      fetchStatsAndSesi(selectedAsrama);
    } catch (err: any) {
      playSound('error');
      setLastResult({
        status: 'ERROR',
        message: 'Koneksi gagal atau terjadi error server: ' + err.message
      });
    } finally {
      setLoading(false);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 100);
    }
  };

  const handleSubmitInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      handleScan(barcodeInput);
    }
  };

  const handleBeriDispensasi = () => {
    if (!lastResult?.santri?.nis) return;
    handleScan(lastResult.santri.nis, true, 'Dispensasi 1x Makan oleh Petugas Kantin (Uji Coba Lapangan)');
  };

  const handleDeleteScan = async (id: number) => {
    if (!confirm('Apakah yakin ingin membatalkan catatan scan ini?')) return;
    try {
      const res = await fetch(`/api/kupon-makan/stats?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchStatsAndSesi();
      }
    } catch (e) {
      alert('Gagal membatalkan scan.');
    }
  };

  // Terapkan Preset Jadwal (Ramadhan, Reguler 2x, Reguler 3x)
  const handleApplyPreset = async (preset: 'reguler_2x' | 'ramadhan' | 'reguler_3x') => {
    try {
      setSavingSettings(true);
      const res = await fetch('/api/kupon-makan/sesi', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset })
      });
      const json = await res.json();
      if (json.success) {
        await fetchStatsAndSesi();
        setShowSettingsModal(false);
      } else {
        alert(json.message || 'Gagal menerapkan preset.');
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Simpan Perubahan Jadwal Sesi Manual
  const handleSaveSessionTimes = async () => {
    try {
      setSavingSettings(true);
      for (const ses of editableSessions) {
        await fetch('/api/kupon-makan/sesi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ses)
        });
      }
      await fetchStatsAndSesi();
      setShowSettingsModal(false);
    } catch (err: any) {
      alert('Gagal menyimpan jadwal: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const scrollToCamera = useCallback(() => {
    if (cameraButtonRef.current) {
      const rect = cameraButtonRef.current.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      // Beri ruang lega 80px di atas tombol agar tombol Proses & Kamera terlihat utuh sempurna
      const targetY = rect.top + scrollTop - 80;
      window.scrollTo({
        top: Math.max(0, targetY),
        behavior: 'smooth'
      });
    }
  }, []);

  const toggleCamera = () => {
    if (isCameraActive) {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().then(() => {
          html5QrCodeRef.current?.clear();
          html5QrCodeRef.current = null;
          setIsCameraActive(false);
        }).catch(err => {
          console.error('Stop camera error:', err);
          setIsCameraActive(false);
        });
      } else {
        setIsCameraActive(false);
      }
    } else {
      setIsCameraActive(true);
      setTimeout(() => {
        scrollToCamera();
      }, 50);
      setTimeout(() => {
        const qr = new Html5Qrcode('qr-reader');
        html5QrCodeRef.current = qr;
        qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            handleScan(decodedText);
          },
          () => {}
        ).catch(err => {
          console.error('Start camera error:', err);
          setIsCameraActive(false);
          alert('Gagal membuka kamera: ' + err);
        });
        scrollToCamera();
      }, 300);
    }
  };

  useEffect(() => {
    if (isCameraActive) {
      scrollToCamera();
    }
  }, [isCameraActive, scrollToCamera]);

  // Helper Ikon Sesi
  const getSesiIcon = (kode: string) => {
    switch (kode) {
      case 'pagi': return <Coffee size={16} />;
      case 'siang': return <Sun size={16} />;
      case 'malam': return <Moon size={16} />;
      case 'sahur': return <Moon size={16} className="text-indigo-400" />;
      case 'buka_puasa': return <Sparkles size={16} className="text-amber-400" />;
      default: return <Utensils size={16} />;
    }
  };

  const activeSessionsList = sessions.filter(s => s.is_aktif === 1);
  const currentSesiObj = sessions.find(s => s.kode_sesi === activeSesi);

  // Label asrama yang terkunci (untuk pengurus/pengasuh non-admin)
  const displayAsramaName = React.useMemo(() => {
    const name = userAsrama;
    if (!name) return 'Asrama Saya';
    const clean = name.trim();
    if (/^asrama\s+/i.test(clean)) {
      const letter = clean.replace(/^asrama\s+/i, '').trim();
      return letter.toLowerCase() === 'tahfid' ? 'Asrama Tahfid' : `Asrama ${letter.toUpperCase()}`;
    }
    return clean.toLowerCase() === 'tahfid' ? 'Asrama Tahfid' : `Asrama ${clean.toUpperCase()}`;
  }, [userAsrama]);

  // Loading screen interaktif saat memuat data E-Kupon Makan (seperti halaman tagihan)
  if (authChecking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 animate-[fadeIn_0.3s_ease-out]">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 sm:p-7 w-full max-w-sm text-center space-y-4 border border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
            <Utensils size={24} className="animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
              Memuat E-Kupon Makan...
            </h3>
            <p className="text-xs text-slate-400 mt-1">Menghubungkan ke server database santri &amp; sesi makan</p>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{loadProgress}%</p>
          <p className="text-[11px] text-slate-400">Harap tunggu, proses sedang berlangsung...</p>
        </div>
      </div>
    );
  }

  // Tampilan Akses Ditolak (RBAC)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 max-w-md w-full p-8 rounded-3xl border border-slate-200 dark:border-slate-800 text-center shadow-xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shadow-inner">
            <ShieldAlert size={36} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Akses Ditolak</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Halaman pemindaian dan pengaturan E-Kupon Makan ini dikhususkan bagi <strong>Pengasuh, Admin, Staff, atau Pengurus</strong>. Akun Anda ({userRole || 'tamu'}) tidak memiliki wewenang untuk fitur ini.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-all shadow-md"
            >
              <ArrowLeft size={16} /> Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 animate-[fadeIn_0.3s_ease-out]">

        {/* Switcher 3 Tab Terpadu: Mode Manual vs Mode Scan vs Kupon Makan */}
        <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-gray-100 dark:bg-gray-800/90 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-inner">
          <Link
            href="/dashboard/absen"
            className="flex flex-col items-center justify-center text-center py-2.5 px-1 rounded-xl font-bold text-xs sm:text-sm transition-all text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
          >
            <ClipboardCheck size={20} className="mb-1 flex-shrink-0" />
            <span className="leading-tight">
              Mode Manual
              <span className="block text-[10px] font-normal opacity-80">(Pilih Jadwal)</span>
            </span>
          </Link>
          <Link
            href="/dashboard/scan-absen"
            className="flex flex-col items-center justify-center text-center py-2.5 px-1 rounded-xl font-bold text-xs sm:text-sm transition-all text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
          >
            <QrCode size={20} className="mb-1 flex-shrink-0" />
            <span className="leading-tight">
              Mode Scan
              <span className="block text-[10px] font-normal opacity-80">(QR &amp; Wajah)</span>
            </span>
          </Link>
          <Link
            href="/dashboard/kupon-makan"
            className="flex flex-col items-center justify-center text-center py-2.5 px-1 rounded-xl font-black text-xs sm:text-sm transition-all bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-300 shadow-sm border border-gray-200/60 dark:border-gray-600"
          >
            <Utensils size={20} className="mb-1 flex-shrink-0" />
            <span className="leading-tight">
              Kupon Makan
              <span className="block text-[10px] font-normal opacity-80">(QR Santri)</span>
            </span>
          </Link>
        </div>

        {/* ===== TAB KLASIFIKASI ASRAMA ===== */}
        {/* Admin/Staff: Tab bar scrollable */}
        {canSwitchAsrama && (
          <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin size={13} className="text-emerald-500 flex-shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filter Asrama</span>
            </div>
            <div className="flex bg-slate-100/70 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto scrollbar-none gap-1">
              {['Semua', 'A', 'B', 'C', 'D', 'E', 'F', 'Lainnya'].map((dorm) => (
                <button
                  key={dorm}
                  onClick={() => setSelectedAsrama(dorm === 'Semua' ? 'Semua' : dorm === 'Lainnya' ? 'Lainnya' : `Asrama ${dorm}`)}
                  className={`flex-1 min-w-[60px] text-center px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${
                    (dorm === 'Semua' && selectedAsrama === 'Semua') ||
                    (dorm === 'Lainnya' && selectedAsrama === 'Lainnya') ||
                    (dorm !== 'Semua' && dorm !== 'Lainnya' && selectedAsrama === `Asrama ${dorm}`)
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {dorm === 'Semua' ? 'Semua' : dorm === 'Lainnya' ? 'Lainnya' : `Asrama ${dorm}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pengurus/Pengasuh: Badge asrama terkunci */}
        {!canSwitchAsrama && userAsrama && (
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-emerald-600 text-white font-extrabold text-xs rounded-xl w-full">
              <MapPin size={14} />
              <span>{displayAsramaName}</span>
            </div>
          </div>
        )}

        {/* HEADER KUPON MAKAN */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
          {/* Baris 1: Ikon + Teks "E-Kupon Makan Santri" di kiri, Tombol Kembali di sebelah kanan rata kanan */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex-shrink-0">
                <Utensils size={20} />
              </div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>E-Kupon Makan Santri</span>
                {presetAktif === 'ramadhan' && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 flex items-center gap-1">
                    <Moon size={11} /> Ramadhan
                  </span>
                )}
              </h1>
            </div>
            <Link
              href="/dashboard"
              className="p-2 -mr-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex-shrink-0"
              title="Kembali ke Dashboard"
            >
              <ArrowLeft size={20} />
            </Link>
          </div>

          {/* Baris 2: Deskripsi merapat ke ujung kiri */}
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Validasi jatah makan via QR Card &amp; sinkronisasi status pelunasan bulan lalu
          </p>

          {/* Baris 3: Tanggal & Jam 1 baris melebar memenuhi ruang kanan & kiri, rata tengah */}
          <div className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-800 text-center flex items-center justify-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-medium">{currentDateStr}</span>
            <span className="text-xs text-slate-300 dark:text-slate-600 hidden sm:inline">•</span>
            <span className="text-xs sm:text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
              <Clock size={13} />
              {currentTimeStr}
            </span>
          </div>

          {/* Baris 4: Tombol Muat Ulang di kiri, Tombol Atur Jadwal di tengah, Tombol Speaker di kanan */}
          <div className="flex items-center justify-between gap-2 w-full pt-0.5">
            {/* Kiri: Muat Ulang */}
            <button
              onClick={() => fetchStatsAndSesi()}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors border border-slate-200/60 dark:border-slate-700 flex items-center justify-center flex-shrink-0"
              title="Perbarui Data"
            >
              <RefreshCw size={18} />
            </button>

            {/* Tengah: Atur Jadwal */}
            <button
              onClick={() => {
                setEditableSessions(JSON.parse(JSON.stringify(sessions)));
                setShowSettingsModal(true);
              }}
              className="flex-1 max-w-sm py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-200/80 dark:border-slate-700"
              title="Atur Waktu & Preset Sesi Makan"
            >
              <CalendarClock size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span>Atur Jadwal</span>
            </button>

            {/* Kanan: Speaker */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-xl border transition-all flex items-center justify-center flex-shrink-0 ${
                soundEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
              }`}
              title={soundEnabled ? 'Suara Aktif' : 'Suara Dimatikan'}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>
        </div>

        {/* SESI MAKAN SELECTOR (DINAMIS SESUAI JADWAL AKTIF) */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center space-y-2.5">
          {/* Header Sesi Aktif + Jam: 1 baris di desktop (PC), flex-col di mobile */}
          <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2.5">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Sparkles size={16} className="text-amber-500" />
              <span>Sesi Makan Aktif:</span>
            </div>

            {currentSesiObj && (
              <div className="flex justify-center">
                <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200/60 dark:border-slate-700">
                  {currentSesiObj.jam_mulai.substring(0, 5)} - {currentSesiObj.jam_selesai.substring(0, 5)} WIB
                </span>
              </div>
            )}
          </div>

          {/* Badge / Tombol Sesi: 1 baris sejajar di desktop (PC), flex-col di mobile */}
          <div className="w-full max-w-xl flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
            {activeSessionsList.map((ses) => {
              const isSelected = activeSesi === ses.kode_sesi;
              const porsiCount = porsiPerSesi[ses.kode_sesi] || 0;

              return (
                <button
                  key={ses.id}
                  onClick={() => setActiveSesi(ses.kode_sesi)}
                  className={`w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {getSesiIcon(ses.kode_sesi)}
                  <span className="whitespace-nowrap">{ses.nama_sesi}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {porsiCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SCANNER GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* SISI KIRI: INPUT & DISPLAY SCAN (7 Kolom) */}
          <div className="lg:col-span-7 space-y-6">

            {/* BARCODE / SCANNER GUN INPUT BOX */}
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
              <form onSubmit={handleSubmitInput} className="space-y-3">
                {/* Baris 1: Kolom pencarian melebar penuh memenuhi ruang kanan dan kiri */}
                <div className="relative w-full">
                  <input
                    ref={inputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Ketik NIS lalu Enter atau Scan barcode kartu..."
                    disabled={loading}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm sm:text-base focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                  />
                  <Search className="absolute left-3.5 top-4 text-slate-400" size={20} />
                </div>

                {/* Baris 2: Tombol Proses dan Tombol Kamera di bawah kolom pencarian */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="submit"
                    disabled={loading || !barcodeInput.trim()}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm"
                  >
                    <Check size={18} />
                    <span>Proses</span>
                  </button>
                  <button
                    ref={cameraButtonRef}
                    type="button"
                    onClick={toggleCamera}
                    className={`py-3 px-4 rounded-xl border transition-all flex items-center justify-center gap-2 font-semibold text-sm scroll-mt-3 ${
                      isCameraActive
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                    title={isCameraActive ? 'Tutup Kamera' : 'Buka Kamera QR'}
                  >
                    <Camera size={18} />
                    <span>{isCameraActive ? 'Tutup' : 'Kamera'}</span>
                  </button>
                </div>
              </form>

              {/* Kamera Viewport jika diaktifkan */}
              {isCameraActive && (
                <div className="p-4 bg-slate-900 rounded-xl overflow-hidden text-center text-white">
                  <p className="text-xs text-slate-400 mb-2">Arahkan kamera ke QR Code Kartu Santri</p>
                  <div id="qr-reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-lg"></div>
                </div>
              )}
            </div>

            {/* HASIL KUPON / KARTU TAMPILAN BESAR */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[380px] flex flex-col justify-between">

              {/* JIKA BELUM ADA SCAN / STANDBY */}
              {!lastResult && !loading && (
                <div className="p-12 text-center my-auto space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <Utensils size={36} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                      Siap Memindai Kartu Santri
                    </h3>
                    <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                      Tempelkan barcode kartu santri pada scanner gun atau gunakan kamera di atas.
                    </p>
                  </div>
                </div>
              )}

              {/* JIKA SEDANG LOADING */}
              {loading && (
                <div className="p-12 text-center my-auto space-y-4">
                  <div className="w-16 h-16 mx-auto border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-medium text-slate-500">Mengecek status tagihan & riwayat makan...</p>
                </div>
              )}

              {/* JIKA ADA HASIL SCAN */}
              {lastResult && !loading && (
                <div className="p-6 space-y-6">

                  {/* BANNER STATUS UTAMA */}
                  {lastResult.status === 'BERHASIL' && (
                    <div className="p-4 rounded-xl bg-emerald-500 text-white flex items-center justify-between shadow-lg shadow-emerald-500/20">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={32} />
                        <div>
                          <div className="text-lg font-extrabold uppercase tracking-wide">KUPON SAH - BERHAK MAKAN</div>
                          <div className="text-xs opacity-90">Silakan ambil porsi makan sesi {currentSesiObj?.nama_sesi || activeSesi}</div>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold bg-white/20 px-3 py-1 rounded-full">{lastResult.waktu} WIB</span>
                    </div>
                  )}

                  {lastResult.status === 'DISPENSASI' && (
                    <div className="p-4 rounded-xl bg-blue-600 text-white flex items-center justify-between shadow-lg shadow-blue-600/20">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={32} />
                        <div>
                          <div className="text-lg font-extrabold uppercase tracking-wide">JALUR DISPENSASI (DIIZINKAN)</div>
                          <div className="text-xs opacity-90">Diberikan izin 1x makan oleh petugas dapur</div>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold bg-white/20 px-3 py-1 rounded-full">{lastResult.waktu} WIB</span>
                    </div>
                  )}

                  {lastResult.status === 'SUDAH_AMBIL' && (
                    <div className="p-4 rounded-xl bg-amber-500 text-white flex items-center justify-between shadow-lg shadow-amber-500/20">
                      <div className="flex items-center gap-3">
                        <AlertTriangle size={32} />
                        <div>
                          <div className="text-lg font-extrabold uppercase tracking-wide">SUDAH MENGAMBIL PORSI SESI INI</div>
                          <div className="text-xs opacity-90">Telah discan sebelumnya pada pukul {lastResult.waktuSebelumnya} WIB</div>
                        </div>
                      </div>
                      <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full">DUPLIKAT</span>
                    </div>
                  )}

                  {lastResult.status === 'TUNGGAKAN' && (
                    <div className="p-4 rounded-xl bg-rose-600 text-white flex items-center justify-between shadow-lg shadow-rose-600/20">
                      <div className="flex items-center gap-3">
                        <ShieldAlert size={32} />
                        <div>
                          <div className="text-lg font-extrabold uppercase tracking-wide">MOHON MAAF, ADA TUNGGAKAN BULAN LALU</div>
                          <div className="text-xs opacity-90">Belum memenuhi syarat pelunasan biaya sebelum bulan berjalan</div>
                        </div>
                      </div>
                      <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full">BELUM LUNAS</span>
                    </div>
                  )}

                  {lastResult.status === 'TIDAK_DITEMUKAN' && (
                    <div className="p-4 rounded-xl bg-slate-700 text-white flex items-center gap-3">
                      <XCircle size={32} />
                      <div>
                        <div className="text-base font-bold">KARTU TIDAK TERDAFTAR</div>
                        <div className="text-xs opacity-80">{lastResult.message}</div>
                      </div>
                    </div>
                  )}

                  {/* PROFIL SANTRI & FOTO KARTU */}
                  {lastResult.santri && (
                    <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                      <div className="w-28 h-36 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0 border-2 border-white dark:border-slate-600 shadow-md relative">
                        {lastResult.santri.foto ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={lastResult.santri.foto}
                            alt={lastResult.santri.nama}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                            <User size={40} />
                            <span className="text-[10px] mt-1 font-medium">Tanpa Foto</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 text-center sm:text-left space-y-1.5 w-full">
                        <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          NIS: {lastResult.santri.nis}
                        </span>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                          {lastResult.santri.nama}
                        </h2>
                        <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex flex-wrap gap-2 justify-center sm:justify-start">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{lastResult.santri.asrama}</span>
                          <span>•</span>
                          <span>Kamar: {lastResult.santri.kamar}</span>
                        </div>

                        {lastResult.status === 'TUNGGAKAN' && lastResult.tunggakan && (
                          <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50 text-left text-xs space-y-1">
                            <div className="font-bold text-rose-700 dark:text-rose-400 flex items-center justify-between">
                              <span>Daftar Tagihan Tertunggak:</span>
                              <span>Total: Rp {Number(lastResult.totalTunggakan || 0).toLocaleString('id-ID')}</span>
                            </div>
                            <ul className="list-disc list-inside text-rose-600 dark:text-rose-300/90 space-y-0.5">
                              {lastResult.tunggakan.slice(0, 3).map((item, idx) => (
                                <li key={idx}>
                                  {item.nama_tagihan} ({item.periode}): Rp {Number(item.nominal).toLocaleString('id-ID')}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* PERINGATAN CROSS-ASRAMA */}
                  {lastResult.crossAsramaWarning && lastResult.santri && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-800 flex items-start gap-2.5 text-xs">
                      <AlertTriangle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                      <div className="text-orange-800 dark:text-orange-300">
                        <span className="font-bold block">Perhatian: Santri Beda Asrama</span>
                        <span>Santri ini berasal dari <strong>{lastResult.santri.asrama}</strong>. Scan telah dicatat dengan keterangan cross-asrama.</span>
                      </div>
                    </div>
                  )}

                  {/* TOMBOL DISPENSASI CEPAT */}
                  {lastResult.status === 'TUNGGAKAN' && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs">
                        <AlertCircle size={20} className="flex-shrink-0" />
                        <span>Masa Uji Coba: Pengurus dapur dapat memberikan dispensasi makan satu kali jika santri membutuhkan.</span>
                      </div>
                      <button
                        onClick={handleBeriDispensasi}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all flex-shrink-0"
                      >
                        <Check size={16} /> Beri Dispensasi Makan
                      </button>
                    </div>
                  )}

                </div>
              )}

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 text-center font-medium">
                Auto-Focus USB Scanner Aktif
              </div>
            </div>

          </div>

          {/* SISI KANAN: STATISTIK & LIVE FEED TERKINI (5 Kolom) */}
          <div className="lg:col-span-5 space-y-6">

            {/* RINGKASAN STATISTIK HARI INI */}
            <div className="space-y-2.5">
              {/* Baris 1: Total Porsi 1 baris melebar memenuhi ruang kanan dan kiri */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs text-slate-400 font-medium block">Total Porsi Terambil</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 leading-none">{stats.totalPorsi}</span>
                      {totalSantriLunas > 0 && (
                        <span className="text-sm font-bold text-slate-400">/ {totalSantriLunas}</span>
                      )}
                    </div>
                  </div>
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <Utensils size={22} />
                  </div>
                </div>
                {totalSantriLunas > 0 && (
                  <>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.round((stats.totalPorsi / totalSantriLunas) * 100))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-slate-400">
                        Kuota Lunas Syahriyah: <span className="font-bold text-slate-600 dark:text-slate-300">{totalSantriLunas} santri</span>
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {Math.min(100, Math.round((stats.totalPorsi / totalSantriLunas) * 100))}%
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Baris 2: Sesi Makan (Sarapan Pagi & Makan Sore / Malam) berdampingan */}
              <div className="grid grid-cols-2 gap-2.5">
                {activeSessionsList.slice(0, 2).map((ses) => (
                  <div key={ses.id} className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                    <span className="text-[11px] text-slate-400 font-medium block truncate">{ses.nama_sesi}</span>
                    <span className="text-xl font-extrabold text-amber-500 block mt-0.5">{porsiPerSesi[ses.kode_sesi] || 0}</span>
                  </div>
                ))}
              </div>

              {/* Baris 3: Dispensasi 1 baris melebar memenuhi ruang kanan dan kiri */}
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-medium block">Dispensasi</span>
                  <span className="text-xl font-extrabold text-blue-500 leading-none mt-0.5 block">{stats.totalDispensasi}</span>
                </div>
                <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
                  <AlertTriangle size={18} />
                </div>
              </div>
            </div>

            {/* LIVE FEED REKAP SCAN */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[460px]">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Clock size={16} className="text-slate-400 flex-shrink-0" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Riwayat Scan Hari Ini ({recentScans.length})
                  </h3>
                </div>
                <div className="text-center sm:text-right">
                  <span className="text-[11px] text-slate-400 block">Terakhir discan</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2">
                {recentScans.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Belum ada santri yang memindai kupon hari ini.
                  </div>
                ) : (
                  recentScans.map((r: any) => (
                    <div key={r.id} className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center justify-between gap-3 text-xs transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
                          {r.foto ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={r.foto} alt={r.nama} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <User size={16} />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {r.nama}
                          </p>
                          <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                            <span className="uppercase font-semibold">{r.sesi}</span>
                            <span>•</span>
                            <span>{r.kamar || r.asrama || '-'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 text-right">
                        <div>
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.status === 'berhasil'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              : r.status === 'dispensasi'
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                          }`}>
                            {r.status}
                          </span>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {r.waktu_scan}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteScan(r.id)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg transition-colors"
                          title="Batalkan scan ini"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>

      {/* MODAL PENGATURAN JADWAL & SESI MAKAN */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                  <CalendarClock size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Pengaturan Jadwal Sesi Makan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sesuaikan jam operasional makan harian atau ubah ke jadwal Ramadhan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">

              {/* PRESET CEPAT 1-KLIK */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Sparkles size={15} className="text-amber-500" />
                  Preset Cepat (Ganti Mode):
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Preset 1: Reguler Pesantren 2x Makan */}
                  <button
                    onClick={() => handleApplyPreset('reguler_2x')}
                    disabled={savingSettings}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      presetAktif === 'reguler_2x'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/50'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between mb-1">
                      <span>☀️ Reguler 2x Sehari</span>
                      {presetAktif === 'reguler_2x' && <Check size={14} className="text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Sarapan Pagi (05.30-06.30) &amp; Makan Sore (16.30-17.30)
                    </p>
                  </button>

                  {/* Preset 2: Bulan Ramadhan (Sahur & Buka) */}
                  <button
                    onClick={() => handleApplyPreset('ramadhan')}
                    disabled={savingSettings}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      presetAktif === 'ramadhan'
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/50'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between mb-1">
                      <span>🌙 Bulan Ramadhan</span>
                      {presetAktif === 'ramadhan' && <Check size={14} className="text-indigo-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Sahur (02.30) & Buka Puasa (17.30)
                    </p>
                  </button>

                  {/* Preset 3: Standar 3x Makan */}
                  <button
                    onClick={() => handleApplyPreset('reguler_3x')}
                    disabled={savingSettings}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      presetAktif === 'reguler_3x'
                        ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 text-orange-900 dark:text-orange-200 ring-2 ring-orange-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/50'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between mb-1">
                      <span>🍽️ Standar 3x Sehari</span>
                      {presetAktif === 'reguler_3x' && <Check size={14} className="text-orange-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Sarapan Pagi, Siang & Malam
                    </p>
                  </button>
                </div>
              </div>

              {/* DETAIL EDIT JAM SESI */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <SlidersHorizontal size={15} />
                  Kustomisasi Jam Sesi:
                </span>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {editableSessions.map((ses, idx) => (
                    <div key={ses.id || idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`ses-aktif-${idx}`}
                          checked={ses.is_aktif === 1}
                          onChange={(e) => {
                            const copy = [...editableSessions];
                            copy[idx].is_aktif = e.target.checked ? 1 : 0;
                            setEditableSessions(copy);
                          }}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                        />
                        <div>
                          <label htmlFor={`ses-aktif-${idx}`} className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 cursor-pointer flex items-center gap-1.5">
                            {ses.nama_sesi}
                            {ses.is_aktif === 1 ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                Aktif
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">
                                Nonaktif
                              </span>
                            )}
                          </label>
                          <span className="text-[11px] text-slate-400 block">{ses.keterangan || ses.kode_sesi}</span>
                        </div>
                      </div>

                      {/* Input Jam Mulai & Jam Selesai */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl">
                          <span className="text-[10px] text-slate-400 font-medium">Mulai:</span>
                          <input
                            type="time"
                            value={ses.jam_mulai.substring(0, 5)}
                            onChange={(e) => {
                              const copy = [...editableSessions];
                              copy[idx].jam_mulai = e.target.value + ':00';
                              setEditableSessions(copy);
                            }}
                            className="bg-transparent text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                          />
                        </div>

                        <span className="text-slate-300 dark:text-slate-600">-</span>

                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl">
                          <span className="text-[10px] text-slate-400 font-medium">Selesai:</span>
                          <input
                            type="time"
                            value={ses.jam_selesai.substring(0, 5)}
                            onChange={(e) => {
                              const copy = [...editableSessions];
                              copy[idx].jam_selesai = e.target.value + ':00';
                              setEditableSessions(copy);
                            }}
                            className="bg-transparent text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveSessionTimes}
                disabled={savingSettings}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                <Save size={16} />
                <span>Simpan Perubahan</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
