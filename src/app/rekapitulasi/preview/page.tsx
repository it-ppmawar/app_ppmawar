'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Printer, Calendar, Clock, User, CheckCircle2, XCircle, AlertCircle, HelpCircle, FileText, ArrowLeft, RefreshCw, Sparkles, MapPin, BookOpen, ShieldCheck, Sun, Moon, X, TrendingUp, CalendarDays, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { exportToPDF } from '@/lib/exportUtils';

const AVATAR_COLORS = [
  '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#ea580c',
  '#0891b2', '#65a30d', '#7c3aed', '#db2777', '#059669',
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
  for (let i = 0; i < nama.length; i++) hash = nama.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getFotoUrl = (fotoName: string | null, nis?: string) => {
  if (!fotoName || fotoName === '-') {
    if (nis) return `https://mawar.smartpesantren.id/sekretariat/berkas/Berkas_2026_${nis}.jpg`;
    return '';
  }
  if (fotoName.startsWith('http://') || fotoName.startsWith('https://')) return fotoName;
  if (fotoName.startsWith('foto_') || fotoName.startsWith('upload_') || fotoName.startsWith('profil_')) {
    return `/uploads/${fotoName}`;
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_MITRA_FOTO_URL || 'https://mawar.smartpesantren.id/sekretariat/berkas/';
  const cleanFotoName = fotoName.startsWith('/') ? fotoName.substring(1) : fotoName;
  if (cleanFotoName.includes('sekretariat/berkas')) return `https://mawar.smartpesantren.id/${cleanFotoName}`;
  return `${baseUrl}${cleanFotoName}`;
};

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Mengonversi elemen SVG menjadi URL data PNG resolusi tinggi (2x)
 * dengan latar belakang putih agar tajam dan rapi saat disematkan ke PDF.
 */
const svgToDataUrl = (svgId: string): Promise<string | null> => {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const el = document.getElementById(svgId) as SVGSVGElement | null;
  if (!el) return Promise.resolve(null);

  const cloned = el.cloneNode(true) as SVGSVGElement;

  cloned.querySelectorAll('line').forEach(line => {
    const stroke = line.getAttribute('stroke');
    if (!stroke || stroke === 'currentColor') {
      line.setAttribute('stroke', '#e2e8f0');
    }
  });

  cloned.querySelectorAll('text').forEach(text => {
    const fill = text.getAttribute('fill');
    if (!fill || fill === 'currentColor') {
      text.setAttribute('fill', '#64748b');
    }
  });

  const vb = el.viewBox?.baseVal;
  const width = vb?.width || 800;
  const height = vb?.height || 210;

  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('width', String(width));
  bgRect.setAttribute('height', String(height));
  bgRect.setAttribute('fill', '#ffffff');
  cloned.insertBefore(bgRect, cloned.firstChild);

  cloned.setAttribute('width', String(width));
  cloned.setAttribute('height', String(height));

  const serialized = new XMLSerializer().serializeToString(cloned);
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
};

function RekapPreviewContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('t') || searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [murid, setMurid] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('semua');
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // State Grafik Tren Kehadiran
  const [hoveredTrend, setHoveredTrend] = useState<any | null>(null);
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

  // Dark/Light Theme State
  const [isDark, setIsDark] = useState(false);

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

  useEffect(() => {
    if (!token) {
      setError('Tautan presensi tidak valid atau telah kedaluwarsa. Silakan hubungi pengurus pesantren.');
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/rekapitulasi/detail?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setData(res.data || []);
          setMurid(res.murid || null);
          setMeta(res.meta || null);
        } else {
          setError(res.error || 'Gagal memuat detail rekapitulasi.');
        }
      })
      .catch(err => {
        setError('Terjadi kendala jaringan saat memuat data: ' + err.message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Statistik Kehadiran
  const stats = useMemo(() => {
    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let alpha = 0;

    data.forEach(item => {
      const s = (item.status || '').toLowerCase();
      if (s === 'hadir') hadir++;
      else if (s === 'izin') izin++;
      else if (s === 'sakit') sakit++;
      else if (s === 'alpha' || s === 'alpa' || s === '') alpha++;
    });

    const total = hadir + izin + sakit + alpha;
    const persentase = total > 0 ? Math.round((hadir / total) * 100) : 0;

    return { hadir, izin, sakit, alpha, total, persentase };
  }, [data]);

  // State Pengurutan Tabel Detail
  type SortField = 'tanggal' | 'waktu' | 'mata_pelajaran' | 'status' | 'penginput';
  type SortOrder = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('tanggal');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'tanggal' ? 'desc' : 'asc');
    }
  };

  // Filter & Urutkan Baris Data
  const filteredData = useMemo(() => {
    const base = statusFilter === 'semua'
      ? data
      : data.filter(item => (item.status || '').toLowerCase() === statusFilter.toLowerCase());

    return [...base].sort((a: any, b: any) => {
      let valA = '';
      let valB = '';
      if (sortField === 'tanggal') {
        valA = `${a.tanggal || ''} ${a.jam_mulai || ''}`;
        valB = `${b.tanggal || ''} ${b.jam_mulai || ''}`;
      } else if (sortField === 'waktu') {
        valA = a.jam_mulai || '';
        valB = b.jam_mulai || '';
      } else if (sortField === 'mata_pelajaran') {
        valA = (a.mata_pelajaran || '').toLowerCase();
        valB = (b.mata_pelajaran || '').toLowerCase();
      } else if (sortField === 'status') {
        valA = (a.status || '').toLowerCase();
        valB = (b.status || '').toLowerCase();
      } else if (sortField === 'penginput') {
        valA = (a.penginput || '').toLowerCase();
        valB = (b.penginput || '').toLowerCase();
      }
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }, [data, statusFilter, sortField, sortOrder]);

  // Periode Label
  const periodeLabel = useMemo(() => {
    if (!meta) return '-';
    if (meta.isRentang && meta.tanggal_dari && meta.tanggal_sampai) {
      return `${meta.tanggal_dari} s/d ${meta.tanggal_sampai}`;
    }
    if (meta.bulan && meta.tahun) {
      const bIdx = parseInt(meta.bulan) - 1;
      return `${MONTH_NAMES[bIdx] || meta.bulan} ${meta.tahun}`;
    }
    return '-';
  }, [meta]);

  // Kategori Label
  const tipeLabel = useMemo(() => {
    if (!meta) return 'Presensi';
    if (meta.tipe === 'madin') return 'Madrasah Diniyah (Madin)';
    if (meta.tipe === 'quran') return "Al-Qur'an (Tahfidz/Tartil)";
    if (meta.tipe === 'kegiatan') return 'Kegiatan Asrama / Pesantren';
    if (meta.tipe === 'guru') return 'Absensi Pengajar / Guru';
    if (meta.tipe === 'dewan_guru') return 'Presensi Dewan Guru YPMA';
    return meta.tipe;
  }, [meta]);

  // Label Badge Topbar (Ringkas agar topbar tidak tinggi/tebal)
  const tipeShortBadge = useMemo(() => {
    if (!meta?.tipe) return '';
    const t = meta.tipe.toLowerCase();
    if (t === 'madin') return '(Madin)';
    if (t === 'quran') return "(Qur'an)";
    if (t === 'kegiatan') return '(Kegiatan)';
    if (t === 'guru') return '(Guru)';
    if (t === 'dewan_guru') return '(Dewan Guru)';
    return `(${meta.tipe})`;
  }, [meta]);

  // Data Tren Kehadiran per Tanggal Sesi Presensi
  const trendData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const mapByDate = new Map<string, { hadir: number; izin: number; sakit: number; alpha: number; total: number }>();

    data.forEach(item => {
      const tgl = item.tanggal;
      if (!tgl) return;
      if (!mapByDate.has(tgl)) {
        mapByDate.set(tgl, { hadir: 0, izin: 0, sakit: 0, alpha: 0, total: 0 });
      }
      const rec = mapByDate.get(tgl)!;
      const s = (item.status || '').toLowerCase();
      if (s === 'hadir') rec.hadir++;
      else if (s === 'izin') rec.izin++;
      else if (s === 'sakit') rec.sakit++;
      else if (s === 'alpha' || s === 'alpa' || s === '') rec.alpha++;
      rec.total++;
    });

    const sortedDates = Array.from(mapByDate.keys()).sort((a, b) => a.localeCompare(b));

    return sortedDates.map(tanggal => {
      const rec = mapByDate.get(tanggal)!;
      const tot = rec.total || 1;
      return {
        tanggal,
        hadir: rec.hadir,
        izin: rec.izin,
        sakit: rec.sakit,
        alpha: rec.alpha,
        total: rec.total,
        pctHadir: Math.round((rec.hadir / tot) * 1000) / 10,
        pctIzin: Math.round((rec.izin / tot) * 1000) / 10,
        pctSakit: Math.round((rec.sakit / tot) * 1000) / 10,
        pctAlpha: Math.round((rec.alpha / tot) * 1000) / 10,
      };
    });
  }, [data]);

  // Handler Unduh PDF
  const handleDownloadPdf = async () => {
    if (!murid || data.length === 0) return;

    setIsDownloadingPdf(true);
    try {
      // Tangkap gambar SVG grafik jika ada untuk disematkan dalam PDF
      let chartImg: string | undefined;
      if (trendData.length > 0) {
        try {
          const dataUrl = await svgToDataUrl('preview-trend-svg');
          if (dataUrl) chartImg = dataUrl;
        } catch (e) {
          console.warn('Gagal merender grafik SVG untuk PDF:', e);
        }
      }

      const isGuru = meta?.tipe === 'guru' || meta?.tipe === 'dewan_guru' || murid.jenis_kelamin === 'Guru' || murid.jenis_kelamin === 'Dewan Guru';
      const title = isGuru ? 'RINCIAN REKAPITULASI PRESENSI PENGAJAR & DEWAN GURU' : 'RINCIAN REKAPITULASI PRESENSI SANTRI';
      const subtitle = isGuru
        ? `Nama: ${murid.nama || '-'}\nNIP: ${murid.nis || '-'}\nUnit / Alamat: ${murid.kelas_madin || '-'}\nKategori: ${tipeLabel}${meta?.sub_filter ? ` (${meta.sub_filter})` : ''}`
        : `Nama: ${murid.nama || '-'}\nNIS: ${murid.nis || '-'}\nKelas / Kamar: ${murid.kelas_madin || murid.kelas_quran || murid.nama_kamar || '-'}\nKategori: ${tipeLabel}${meta?.sub_filter ? ` (${meta.sub_filter})` : ''}`;
      const period = periodeLabel;
      const safeNama = (murid.nama || (isGuru ? 'Guru' : 'Santri')).replace(/[^a-zA-Z0-9]/g, '_');
      const safePeriod = periodeLabel.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Rekap_Presensi_${safeNama}_${safePeriod}`;

      const columns = ['No', 'Hari, Tanggal', 'Waktu', 'Jadwal / Mapel / Kegiatan', 'Status', 'Keterangan', 'Diinput Oleh'];
      const rows = filteredData.map((r, idx) => [
        idx + 1,
        `${r.hari || ''}, ${r.tanggal || ''}`,
        r.jam_mulai ? `${r.jam_mulai}${r.jam_selesai ? ` - ${r.jam_selesai}` : ''}` : '-',
        r.mata_pelajaran || '-',
        r.status || '-',
        r.keterangan || '-',
        r.penginput || '-',
      ]);

      exportToPDF({
        title,
        subtitle,
        period,
        columns,
        rows,
        filename,
        previewOnly: false,
        chartImg,
        stats: {
          hadir: stats.hadir,
          izin: stats.izin,
          sakit: stats.sakit,
          alpha: stats.alpha,
          total: stats.total,
          persentase: stats.persentase,
        }
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center max-w-sm text-center">
          <RefreshCw size={36} className="text-purple-600 animate-spin mb-4" />
          <h3 className="text-base font-bold text-gray-800">Menyiapkan Rekapitulasi Presensi...</h3>
          <p className="text-xs text-gray-500 mt-1">Mengambil data resmi dari Sistem Presensi PPMA</p>
        </div>
      </div>
    );
  }

  if (error || !murid) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-red-100 flex flex-col items-center max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-800">Informasi Tidak Dapat Ditampilkan</h3>
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">{error || 'Data santri tidak ditemukan.'}</p>
          <div className="mt-6 pt-4 border-t border-gray-100 w-full text-center">
            <p className="text-[11px] text-gray-400">Pondok Pesantren Matholi&apos;ul Anwar (PPMA)</p>
          </div>
        </div>
      </div>
    );
  }

  const avatarBg = getAvatarColor(murid.nama || '');
  const initials = getInitials(murid.nama || '');
  const fotoSrc = getFotoUrl(murid.foto, murid.nis);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200 pb-16">
      {/* Top Floating App Bar (Print hidden) */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 shadow-xs rounded-b-2xl print:hidden transition-colors">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          {/* Pojok Kiri: Logo Pesantren */}
          <div className="flex items-center justify-start shrink-0">
            <div className="bg-white rounded-xl flex items-center justify-center shadow-xs h-9 px-1.5 py-0.5 border border-slate-200 dark:border-slate-700/60">
              <img src="/logo.png" alt="Logo Lembaga" className="h-full w-auto object-contain" />
            </div>
          </div>

          {/* Teks Rata Tengah */}
          <div className="min-w-0 flex-1 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Rekapitulasi Presensi
              </h1>
              {tipeShortBadge && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800/60 rounded-md shrink-0">
                  {tipeShortBadge}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 text-center font-medium">
              Pondok Pesantren Matholi&apos;ul Anwar
            </p>
          </div>

          {/* Pojok Kanan: Fitur Mode Gelap / Terang */}
          <div className="w-8 flex items-center justify-end shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 dark:bg-slate-800/80 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700/60 shadow-xs cursor-pointer"
              aria-label="Toggle Mode Gelap/Terang"
              title={isDark ? "Ganti ke Mode Terang" : "Ganti ke Mode Gelap"}
            >
              {isDark ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-indigo-600" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* Surat / Lembar Identitas Dokumen */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 sm:p-7 relative overflow-hidden transition-colors">
          {/* Aksen Latar Belakang */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-50 dark:bg-purple-950/30 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

          {/* Header Identitas Lembaga */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-6 border-b border-slate-100 dark:border-slate-800 text-center sm:text-left">
            <div
              onClick={() => {
                if (fotoSrc && !imgError) {
                  setZoomPhoto(fotoSrc);
                }
              }}
              style={{ backgroundColor: !fotoSrc || imgError ? avatarBg : undefined }}
              className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden shadow-xs border-2 border-purple-100 dark:border-purple-800/60 select-none ${
                fotoSrc && !imgError
                  ? 'cursor-pointer hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all'
                  : 'bg-purple-50 dark:bg-purple-950/50'
              }`}
              title={fotoSrc && !imgError ? 'Klik untuk melihat foto layar penuh' : murid.nama}
            >
              {fotoSrc && !imgError ? (
                <img
                  src={fotoSrc}
                  alt={murid.nama}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <span className="text-2xl font-black text-white tracking-wider drop-shadow-xs">
                  {initials}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                <ShieldCheck size={12} /> Dokumen Resmi Presensi
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                {murid.nama}
              </h2>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 mt-2 text-xs text-slate-600 dark:text-slate-400">
                {meta?.tipe === 'guru' || meta?.tipe === 'dewan_guru' || murid.jenis_kelamin === 'Guru' || murid.jenis_kelamin === 'Dewan Guru' ? (
                  <>
                    <span className="font-mono">NIP: <strong className="text-slate-800 dark:text-slate-200">{murid.nis || '-'}</strong></span>
                    <span>•</span>
                    <span>Unit / Alamat: <strong className="text-slate-800 dark:text-slate-200">{murid.kelas_madin || '-'}</strong></span>
                    {murid.no_hp_wali && (
                      <>
                        <span>•</span>
                        <span className="font-mono">No. HP: <strong className="text-slate-800 dark:text-slate-200">{murid.no_hp_wali}</strong></span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span className="font-mono">NIS: <strong className="text-slate-800 dark:text-slate-200">{murid.nis || '-'}</strong></span>
                    <span>•</span>
                    <span>Kelas: <strong className="text-slate-800 dark:text-slate-200">{murid.kelas_madin || murid.kelas_quran || murid.nama_kamar || '-'}</strong></span>
                    {murid.nama_wali && (
                      <>
                        <span>•</span>
                        <span>Wali: <strong className="text-slate-800 dark:text-slate-200">{murid.nama_wali}</strong></span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons for Desktop */}
            <div className="hidden sm:flex items-center gap-2 shrink-0 pt-1 print:hidden">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700"
                title="Cetak Dokumen"
              >
                <Printer size={15} /> Cetak
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
              >
                {isDownloadingPdf ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
                <span>{isDownloadingPdf ? 'Menyiapkan...' : 'Unduh PDF'}</span>
              </button>
            </div>

            {/* Quick Action Button for Mobile */}
            <div className="sm:hidden w-full pt-3 print:hidden">
              <button
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-2xl text-xs font-bold shadow-md shadow-purple-600/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                {isDownloadingPdf ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                <span>{isDownloadingPdf ? 'Menyiapkan Dokumen PDF...' : 'Unduh Dokumen PDF'}</span>
              </button>
            </div>
          </div>

          {/* Metadata Kegiatan & Periode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-5 text-xs">
            <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">Kategori & Jadwal</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <BookOpen size={14} className="text-purple-600 shrink-0" />
                {tipeLabel} {meta?.sub_filter ? `(${meta.sub_filter})` : ''}
              </span>
            </div>
            <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">Periode Rekapitulasi</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Calendar size={14} className="text-purple-600 shrink-0" />
                {periodeLabel}
              </span>
            </div>
          </div>

          {/* Badge Keabsahan & Batas Waktu Token */}
          {meta?.expires_at && (
            <div className="mt-3 bg-purple-50/60 dark:bg-purple-950/40 border border-purple-150/70 dark:border-purple-800/50 rounded-2xl p-2.5 px-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] text-purple-900 dark:text-purple-300">
              <span className="flex items-center gap-1.5 font-bold">
                <ShieldCheck size={14} className="text-purple-600 shrink-0" />
                <span>Dokumen Resmi Terautentikasi Pesantren</span>
              </span>
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                <Clock size={12} className="text-purple-500 shrink-0" />
                <span>Tautan preview ini berlaku s/d: <strong className="text-purple-700 dark:text-purple-300">{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(meta.expires_at))}</strong></span>
              </span>
            </div>
          )}
        </div>

        {/* Ringkasan Statistik Presensi */}
        <div className="space-y-3">
          {/* Kartu Hadir - 1 Baris Tersendiri Memenuhi Ruang Kanan & Kiri */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex items-center justify-between transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">Hadir</span>
                <span className="text-[11px] text-slate-400 font-medium">Kehadiran Sesi Presensi</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-none">{stats.hadir}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Pertemuan</span>
            </div>
          </div>

          {/* Kartu Izin, Sakit, Alpha - 1 Baris Berdampingan (3 Kolom) */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-xs transition-colors">
              <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
                <span className="text-xs font-bold">Izin</span>
                <FileText size={16} />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{stats.izin}</div>
              <span className="text-[10px] text-slate-400">Pertemuan</span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-xs transition-colors">
              <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
                <span className="text-xs font-bold">Sakit</span>
                <AlertCircle size={16} />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{stats.sakit}</div>
              <span className="text-[10px] text-slate-400">Pertemuan</span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-xs transition-colors">
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1">
                <span className="text-xs font-bold">Alpha</span>
                <XCircle size={16} />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{stats.alpha}</div>
              <span className="text-[10px] text-slate-400">Pertemuan</span>
            </div>
          </div>
        </div>

        {/* Persentase Kehadiran Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Tingkat Kehadiran:</span>
              <span className="text-base font-black text-purple-600">{stats.persentase}%</span>
              <span className="text-xs text-slate-400 font-medium">({stats.hadir} dari {stats.total} sesi)</span>
            </div>
            <div className="w-full sm:w-64 bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden flex">
              <div className="bg-purple-600 h-full rounded-full transition-all" style={{ width: `${stats.persentase}%` }} />
            </div>
          </div>

          {/* Filter Status Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 text-[11px] font-bold w-full sm:w-auto overflow-x-auto">
            {['semua', 'hadir', 'izin', 'sakit', 'alpha'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg capitalize transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs font-black'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Visualisasi Grafik Tren Kehadiran (%) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200/80 dark:border-slate-800 transition-colors">
          {/* Header Card Tren */}
          <div className="flex flex-col gap-2.5 mb-3">
            {/* Baris 1: Ikon + Judul + Subjudul di kiri, Tombol PDF di kanan */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 shrink-0">
                  <TrendingUp size={18} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate">
                    Tren Kehadiran Sesi Presensi (%)
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                    Fluktuasi tingkat kehadiran per tanggal sesi
                  </p>
                </div>
              </div>

              {/* Tombol PDF Sebaris di Kanan */}
              <div className="flex items-center gap-1.5 shrink-0 print:hidden">
                <button
                  type="button"
                  disabled={isDownloadingPdf}
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-1 text-[11px] font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-60 px-2.5 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
                  title="Unduh Dokumen PDF beserta Grafik"
                >
                  {isDownloadingPdf ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Download size={12} />
                  )}
                  <span>{isDownloadingPdf ? 'Memproses...' : 'PDF'}</span>
                </button>
              </div>
            </div>

            {/* Baris 2: Toggle Pills Status + Badge Target 85% */}
            <div className="flex flex-wrap justify-center items-center gap-1.5 w-full">
              <button
                type="button"
                onClick={() => toggleTrendLine('hadir')}
                className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  visibleTrendLines.hadir
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-xs'
                    : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60 line-through'
                }`}
                title="Klik untuk tampilkan/sembunyikan tren Hadir"
              >
                <span className={`w-2 h-2 rounded-full ${visibleTrendLines.hadir ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                Hadir
              </button>

              <button
                type="button"
                onClick={() => toggleTrendLine('izin')}
                className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  visibleTrendLines.izin
                    ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-xs'
                    : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60 line-through'
                }`}
                title="Klik untuk tampilkan/sembunyikan tren Izin"
              >
                <span className={`w-2 h-2 rounded-full ${visibleTrendLines.izin ? 'bg-blue-500' : 'bg-slate-400'}`} />
                Izin
              </button>

              <button
                type="button"
                onClick={() => toggleTrendLine('sakit')}
                className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  visibleTrendLines.sakit
                    ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 shadow-xs'
                    : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60 line-through'
                }`}
                title="Klik untuk tampilkan/sembunyikan tren Sakit"
              >
                <span className={`w-2 h-2 rounded-full ${visibleTrendLines.sakit ? 'bg-amber-500' : 'bg-slate-400'}`} />
                Sakit
              </button>

              <button
                type="button"
                onClick={() => toggleTrendLine('alpha')}
                className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  visibleTrendLines.alpha
                    ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 shadow-xs'
                    : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60 line-through'
                }`}
                title="Klik untuk tampilkan/sembunyikan tren Alpha"
              >
                <span className={`w-2 h-2 rounded-full ${visibleTrendLines.alpha ? 'bg-rose-500' : 'bg-slate-400'}`} />
                Alpha
              </button>

              <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-lg border border-amber-200/50 dark:border-amber-800/40">
                <span className="w-3 h-0.5 bg-amber-500 rounded-full" />
                Target 85%
              </span>
            </div>
          </div>

          {/* Interactive Hover Info Bar */}
          <div className="min-h-[44px] mb-2 flex items-center justify-center text-xs px-3 py-1.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 transition-all">
            {hoveredTrend ? (
              <div className="flex flex-col items-center justify-center w-full gap-1 animate-in fade-in duration-200 text-center">
                {/* Baris 1: Tanggal & Prosentase Hadir */}
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 shrink-0 text-xs">
                    <Calendar size={13} className="text-purple-600 dark:text-purple-400" />
                    {(() => {
                      const parts = (hoveredTrend.tanggal || '').split('-');
                      if (parts.length !== 3) return hoveredTrend.tanggal;
                      const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                      return dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                    })()}
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 px-2 py-0.5 rounded-md text-[11px]">
                    {(hoveredTrend.pctHadir ?? 0).toFixed(1)}% Hadir ({hoveredTrend.hadir} sesi)
                  </span>
                </div>

                {/* Baris 2: Prosentase yang lain (Izin, Sakit, Alpha) */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap text-[10px] sm:text-[11px]">
                  <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 px-1.5 py-0.5 rounded-md">
                    {(hoveredTrend.pctIzin ?? 0).toFixed(1)}% Izin ({hoveredTrend.izin})
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 px-1.5 py-0.5 rounded-md">
                    {(hoveredTrend.pctSakit ?? 0).toFixed(1)}% Sakit ({hoveredTrend.sakit})
                  </span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40 px-1.5 py-0.5 rounded-md">
                    {(hoveredTrend.pctAlpha ?? 0).toFixed(1)}% Alpha ({hoveredTrend.alpha})
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center text-center w-full text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium py-0.5">
                <span>
                  Arahkan kursor atau sentuh titik grafik untuk rincian status{' '}
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    ({trendData.length} Sesi Terdata)
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* SVG Chart Area */}
          {trendData.length === 0 ? (
            <div className="py-10 text-center bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <CalendarDays size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Belum ada catatan aktivitas presensi pada rentang waktu ini.
              </p>
            </div>
          ) : (
            (() => {
              const svgW = 800;
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
                if (pts.length === 0) return '';
                if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
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

              const pathHadir = pointsHadir.length > 1 ? buildSmoothPath(pointsHadir) : '';
              const pathIzin = pointsIzin.length > 1 ? buildSmoothPath(pointsIzin) : '';
              const pathSakit = pointsSakit.length > 1 ? buildSmoothPath(pointsSakit) : '';
              const pathAlpha = pointsAlpha.length > 1 ? buildSmoothPath(pointsAlpha) : '';

              const areaPathHadir = pointsHadir.length > 1 && pathHadir
                ? `${pathHadir} L ${pointsHadir[pointsHadir.length - 1].x} ${padT + plotH} L ${pointsHadir[0].x} ${padT + plotH} Z`
                : '';

              const totalPoints = pointsHadir.length;
              const labelInterval = totalPoints > 28 ? 3 : totalPoints > 14 ? 2 : 1;

              return (
                <div className="relative w-full overflow-hidden select-none">
                  <svg
                    id="preview-trend-svg"
                    className="w-full h-auto"
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    onMouseLeave={() => setHoveredTrend(null)}
                  >
                    <defs>
                      <linearGradient id="previewTrendAreaGradient" x1="0" y1="0" x2="0" y2="1">
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
                            className="text-slate-100 dark:text-slate-800"
                          />
                          <text
                            x={padL - 6}
                            y={y + 3}
                            textAnchor="end"
                            className="text-[9px] font-bold fill-slate-400 dark:fill-slate-500"
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
                      <path d={areaPathHadir} fill="url(#previewTrendAreaGradient)" />
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
                          {/* Hitbox tinggi penuh */}
                          <rect
                            x={p.x - 14}
                            y={padT}
                            width="28"
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
                              stroke="#64748b"
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
                                  : 'fill-slate-400 dark:fill-slate-500'
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

        {/* Tabel Detail Riwayat Kehadiran (Foto 2) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar size={16} className="text-purple-600" />
              Catatan Rincian Presensi Sesi
            </h3>
            <span className="text-xs text-slate-400 font-medium">{filteredData.length} Catatan</span>
          </div>

          {filteredData.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Tidak ada catatan presensi untuk kriteria yang dipilih.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 w-12 text-center select-none">No</th>
                    <th 
                      onClick={() => handleSort('tanggal')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors select-none group whitespace-nowrap"
                      title="Klik untuk mengurutkan berdasarkan tanggal"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Hari, Tanggal</span>
                        {sortField === 'tanggal' ? (
                          sortOrder === 'asc' ? <ArrowUp size={12} className="text-purple-600 dark:text-purple-400 shrink-0" /> : <ArrowDown size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('waktu')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors select-none group whitespace-nowrap"
                      title="Klik untuk mengurutkan berdasarkan waktu"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Waktu</span>
                        {sortField === 'waktu' ? (
                          sortOrder === 'asc' ? <ArrowUp size={12} className="text-purple-600 dark:text-purple-400 shrink-0" /> : <ArrowDown size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('mata_pelajaran')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors select-none group whitespace-nowrap"
                      title="Klik untuk mengurutkan berdasarkan jadwal/mapel/kegiatan"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Jadwal / Mapel / Kegiatan</span>
                        {sortField === 'mata_pelajaran' ? (
                          sortOrder === 'asc' ? <ArrowUp size={12} className="text-purple-600 dark:text-purple-400 shrink-0" /> : <ArrowDown size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('status')}
                      className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors select-none group whitespace-nowrap"
                      title="Klik untuk mengurutkan berdasarkan status"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Status</span>
                        {sortField === 'status' ? (
                          sortOrder === 'asc' ? <ArrowUp size={12} className="text-purple-600 dark:text-purple-400 shrink-0" /> : <ArrowDown size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('penginput')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors select-none group whitespace-nowrap"
                      title="Klik untuk mengurutkan berdasarkan penginput"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Diinput Oleh</span>
                        {sortField === 'penginput' ? (
                          sortOrder === 'asc' ? <ArrowUp size={12} className="text-purple-600 dark:text-purple-400 shrink-0" /> : <ArrowDown size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 shrink-0" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                  {filteredData.map((row, idx) => {
                    const st = (row.status || '').toLowerCase();
                    const badgeClass =
                      st === 'hadir'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                        : st === 'izin'
                        ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                        : st === 'sakit'
                        ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                        : 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';

                    return (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-white">{row.hari || '-'}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{row.tanggal || '-'}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {row.jam_mulai ? `${row.jam_mulai}${row.jam_selesai ? ` - ${row.jam_selesai}` : ''}` : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{row.mata_pelajaran || '-'}</div>
                          {row.keterangan && (
                            <div className="text-[11px] text-slate-400 italic mt-0.5">Ket: {row.keterangan}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeClass}`}>
                            {row.status || 'Alpha'}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400 text-[11px]">
                          {row.penginput || 'Pengajar'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer Dokumen */}
          <div className="p-5 bg-slate-50/60 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 gap-3 text-center sm:text-left">
            <span>Dokumen ini diterbitkan sah oleh Sistem Presensi Terpadu Pondok Pesantren Matholi&apos;ul Anwar.</span>
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="inline-flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-bold hover:underline cursor-pointer disabled:opacity-60"
            >
              {isDownloadingPdf ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
              <span>{isDownloadingPdf ? 'Menyiapkan...' : 'Unduh PDF Lengkap'}</span>
            </button>
          </div>
        </div>

      </main>

      {/* Modal Foto Layar Penuh (Zoom Photo) */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out] print:hidden cursor-pointer"
          onClick={() => setZoomPhoto(null)}
        >
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setZoomPhoto(null)}
              className="absolute -top-3 -right-3 z-10 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full p-2 shadow-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              title="Tutup"
            >
              <X size={18} />
            </button>
            <img
              src={zoomPhoto}
              alt={murid?.nama || 'Foto Santri'}
              className="w-full rounded-2xl shadow-2xl object-cover max-h-[85vh] bg-black"
            />
            <p className="text-center text-xs text-white/90 font-bold mt-2.5">
              {murid?.nama || 'Foto Santri'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RekapPreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <RefreshCw size={32} className="text-purple-600 animate-spin" />
      </div>
    }>
      <RekapPreviewContent />
    </Suspense>
  );
}
