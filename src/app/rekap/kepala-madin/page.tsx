'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  BookOpen, Users, Calendar, CheckCircle2, AlertCircle, Clock, 
  Search, Printer, Download, Sparkles, Award, Filter, RefreshCw, 
  Check, AlertTriangle, ShieldCheck, UserCheck, ChevronRight,
  Sun, Moon, X, TrendingUp, CalendarDays, FileText, XCircle
} from 'lucide-react';
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
  for (let i = 0; i < nama.length; i++) {
    hash = nama.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getFotoUrl = (fotoName: string | null) => {
  if (!fotoName || fotoName === '-') return '';
  if (fotoName.startsWith('http://') || fotoName.startsWith('https://')) return fotoName;
  if (fotoName.startsWith('foto_') || fotoName.startsWith('upload_') || fotoName.startsWith('profil_')) {
    return `/uploads/${fotoName}`;
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_MITRA_FOTO_URL || 'https://mawar.smartpesantren.id/sekretariat/berkas/';
  const cleanFotoName = fotoName.startsWith('/') ? fotoName.substring(1) : fotoName;
  if (cleanFotoName.includes('sekretariat/berkas')) return `https://mawar.smartpesantren.id/${cleanFotoName}`;
  return `${baseUrl}${cleanFotoName}`;
};

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

function RekapKepalaMadinContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [searchTeacher, setSearchTeacher] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'excellent' | 'needs_attention' | 'has_alpha'>('all');

  // Theme Mode Gelap/Terang
  const [isDark, setIsDark] = useState<boolean>(false);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // Filter Garis Tren Grafik
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

  const toggleTrendLine = (type: 'hadir' | 'izin' | 'sakit' | 'alpha') => {
    setVisibleTrendLines(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const [hoveredTrend, setHoveredTrend] = useState<{
    tanggal: string;
    hadir: number;
    izin: number;
    sakit: number;
    alpha: number;
    total: number;
    pctHadir?: number;
    pctIzin?: number;
    pctSakit?: number;
    pctAlpha?: number;
  } | null>(null);

  // Inisialisasi tema
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialDark = stored === 'dark' || (!stored && prefersDark);
      setIsDark(initialDark);
      if (initialDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        if (next) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('theme', 'dark');
        } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('theme', 'light');
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (!token) {
      setError('Tautan laporan tidak valid atau tidak memiliki token otentikasi.');
      setLoading(false);
      return;
    }

    fetch(`/api/rekapitulasi/kepala-madin?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Gagal memuat laporan');
        setData(json.data);
      })
      .catch((err: any) => {
        setError(err.message || 'Terjadi kesalahan saat memuat data laporan Kepala Madin.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const filteredTeachers = useMemo(() => {
    if (!data?.teachers) return [];
    let list = data.teachers;

    // Filter pencarian
    if (searchTeacher.trim()) {
      const q = searchTeacher.toLowerCase();
      list = list.filter((t: any) =>
        (t.nama || '').toLowerCase().includes(q) ||
        (t.nip || '').includes(q) ||
        (t.classes || []).some((c: any) =>
          (c.kelas_nama || '').toLowerCase().includes(q) ||
          (c.mata_pelajaran || '').toLowerCase().includes(q)
        )
      );
    }

    // Filter kategori status
    if (filterCategory === 'excellent') {
      list = list.filter((t: any) => (t.attendance?.percentage || 0) >= 90);
    } else if (filterCategory === 'needs_attention') {
      list = list.filter((t: any) => ((t.attendance?.izin || 0) + (t.attendance?.sakit || 0)) > 0);
    } else if (filterCategory === 'has_alpha') {
      list = list.filter((t: any) => (t.attendance?.alpha || 0) > 0);
    }

    return list;
  }, [data, searchTeacher, filterCategory]);

  const trendData = useMemo<any[]>(() => {
    if (!data?.daily_trends || !Array.isArray(data.daily_trends)) return [];
    return data.daily_trends;
  }, [data]);

  // Handler Unduh PDF
  const handleDownloadPdf = async () => {
    if (!data || !data.teachers || data.teachers.length === 0) return;

    setIsDownloadingPdf(true);
    try {
      let chartImg: string | undefined;
      if (trendData.length > 0) {
        try {
          const dataUrl = await svgToDataUrl('preview-trend-svg');
          if (dataUrl) chartImg = dataUrl;
        } catch (e) {
          console.warn('Gagal merender grafik SVG untuk PDF:', e);
        }
      }

      const wilayahStr = data.periode.wilayah === 'putra' 
        ? 'Madin Putra' 
        : data.periode.wilayah === 'putri' 
          ? 'Madin Putri' 
          : 'Semua Madin';

      const title = 'LAPORAN EVALUASI KEHADIRAN DEWAN GURU MADIN';
      const subtitle = `Sasaran: Kepala Madrasah Diniyah (${wilayahStr})\nLembaga: Pondok Pesantren Matholi'ul Anwar Simo Sungelebak Lamongan\nPeriode Rekapitulasi: ${data.periode.bulan_nama} ${data.periode.tahun}\nTotal Guru Terdata: ${data.summary.total_guru} Guru | Rata-Rata Kehadiran: ${data.summary.avg_attendance_pct}%`;
      const period = `${data.periode.bulan_nama} ${data.periode.tahun}`;
      const filename = `Laporan_Evaluasi_Madin_${data.periode.wilayah || 'all'}_${data.periode.bulan}_${data.periode.tahun}`;

      const columns = ['No', 'Nama Dewan Guru', 'NIP / Kontak', 'Kelas & Mapel yang Diampu', 'Total Sesi', 'Hadir', 'Izin', 'Sakit', 'Alpha', 'Kehadiran (%)'];
      const rows = filteredTeachers.map((t: any, idx: number) => {
        const att = t.attendance || {};
        const classesStr = (t.classes || []).map((c: any) => `${c.kelas_nama}: ${c.mata_pelajaran}`).join('; ');
        return [
          idx + 1,
          t.nama || '-',
          t.nip || t.no_hp || '-',
          classesStr || '-',
          att.total_sesi ?? 0,
          att.hadir ?? 0,
          att.izin ?? 0,
          att.sakit ?? 0,
          att.alpha ?? 0,
          `${att.percentage ?? 0}%`,
        ];
      });

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
          hadir: data.summary.total_hadir,
          izin: data.summary.total_izin,
          sakit: data.summary.total_sakit,
          alpha: data.summary.total_alpha,
          total: data.summary.total_sesi,
          persentase: data.summary.avg_attendance_pct,
        }
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center max-w-sm text-center">
          <RefreshCw size={36} className="text-purple-600 dark:text-purple-400 animate-spin mb-4" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Menyiapkan Laporan Kepala Madin...</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Mengompilasi data presensi seluruh dewan guru Madin</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-red-100 dark:border-red-900/30 flex flex-col items-center max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/50 text-red-500 flex items-center justify-center mb-4">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Informasi Tidak Dapat Ditampilkan</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
            {error || 'Tautan ini mungkin sudah kedaluwarsa atau tidak valid. Silakan hubungi admin pondok pesantren.'}
          </p>
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 w-full text-center">
            <p className="text-[11px] text-slate-400">Pondok Pesantren Matholi&apos;ul Anwar (PPMA)</p>
          </div>
        </div>
      </div>
    );
  }

  const { periode, summary, meta } = data;
  const wilayahLabel = periode.wilayah === 'putra' 
    ? 'Madin Putra' 
    : periode.wilayah === 'putri' 
      ? 'Madin Putri' 
      : 'Madrasah Diniyah';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200 pb-16 font-sans">
      {/* 1. TOP FLOATING APP BAR (Print Hidden) - Seragam seperti Foto 2 & Foto 3 */}
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
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800/60 rounded-md shrink-0">
                {wilayahLabel}
              </span>
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
        
        {/* 2. SURAT / LEMBAR IDENTITAS DOKUMEN (KARTU PROFIL UTAMA) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 sm:p-7 relative overflow-hidden transition-colors">
          {/* Aksen Latar Belakang */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-50 dark:bg-purple-950/30 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

          {/* Header Identitas Lembaga & Evaluasi */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-6 border-b border-slate-100 dark:border-slate-800 text-center sm:text-left">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden shadow-xs border-2 border-purple-200 dark:border-purple-800/60 select-none bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-800 text-white"
            >
              <div className="text-center">
                <span className="text-xl font-black tracking-wider block drop-shadow-xs">KM</span>
                <span className="text-[9px] font-bold opacity-80 uppercase tracking-tighter">Madin</span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                <ShieldCheck size={12} /> Dokumen Resmi Evaluasi Kepala Madin
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Laporan Evaluasi Kehadiran Dewan Guru {wilayahLabel}
              </h2>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 mt-2 text-xs text-slate-600 dark:text-slate-400">
                <span>Sasaran: <strong className="text-slate-800 dark:text-slate-200">Kepala Madrasah Diniyah ({wilayahLabel})</strong></span>
                <span>•</span>
                <span>Lembaga: <strong className="text-slate-800 dark:text-slate-200">PP. Matholi&apos;ul Anwar Lamongan</strong></span>
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
                Presensi Mengajar Dewan Guru ({wilayahLabel})
              </span>
            </div>
            <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">Periode Rekapitulasi</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Calendar size={14} className="text-purple-600 shrink-0" />
                {periode.bulan_nama} {periode.tahun}
              </span>
            </div>
          </div>

          {/* Badge Keabsahan & Batas Waktu Token */}
          <div className="mt-3 bg-purple-50/60 dark:bg-purple-950/40 border border-purple-150/70 dark:border-purple-800/50 rounded-2xl p-2.5 px-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] text-purple-900 dark:text-purple-300">
            <span className="flex items-center gap-1.5 font-bold">
              <ShieldCheck size={14} className="text-purple-600 shrink-0" />
              <span>Dokumen Resmi Terautentikasi Pesantren</span>
            </span>
            {meta?.expires_at && (
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                <Clock size={12} className="text-purple-500 shrink-0" />
                <span>Tautan preview ini berlaku s/d: <strong className="text-purple-700 dark:text-purple-300">{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(meta.expires_at))}</strong></span>
              </span>
            )}
          </div>
        </div>

        {/* 3. RINGKASAN STATISTIK PRESENSI - Seragam seperti Foto 2 & Foto 3 */}
        <div className="space-y-3">
          {/* Kartu Hadir - 1 Baris Penuh */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex items-center justify-between transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">Hadir</span>
                <span className="text-[11px] text-slate-400 font-medium">Kehadiran Sesi Presensi Mengajar</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-none">{summary.total_hadir}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Pertemuan Terlaksana</span>
            </div>
          </div>

          {/* Kartu Izin, Sakit, Alpha - 1 Baris Berdampingan (3 Kolom) */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-xs transition-colors">
              <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
                <span className="text-xs font-bold">Izin</span>
                <FileText size={16} />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{summary.total_izin}</div>
              <span className="text-[10px] text-slate-400">Pertemuan</span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-xs transition-colors">
              <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
                <span className="text-xs font-bold">Sakit</span>
                <AlertCircle size={16} />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{summary.total_sakit}</div>
              <span className="text-[10px] text-slate-400">Pertemuan</span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-xs transition-colors">
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1">
                <span className="text-xs font-bold">Alpha</span>
                <XCircle size={16} />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{summary.total_alpha}</div>
              <span className="text-[10px] text-slate-400">Pertemuan</span>
            </div>
          </div>
        </div>

        {/* 4. PERSENTASE KEHADIRAN & FILTER STATUS */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Tingkat Kehadiran Dewan Guru:</span>
              <span className="text-base font-black text-purple-600 dark:text-purple-400">{summary.avg_attendance_pct}%</span>
              <span className="text-xs text-slate-400 font-medium">({summary.total_hadir} dari {summary.total_sesi} sesi terlaksana)</span>
            </div>
            <div className="w-full sm:w-64 bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden flex">
              <div className="bg-purple-600 h-full rounded-full transition-all" style={{ width: `${summary.avg_attendance_pct}%` }} />
            </div>
          </div>

          {/* Filter Status Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 text-[11px] font-bold w-full sm:w-auto overflow-x-auto">
            {[
              { key: 'all', label: `Semua (${data.teachers?.length || 0})` },
              { key: 'excellent', label: '⭐ Sangat Baik (≥90%)' },
              { key: 'needs_attention', label: '⚠️ Izin/Sakit' },
              { key: 'has_alpha', label: '❌ Ada Alpha' },
            ].map((st) => (
              <button
                key={st.key}
                onClick={() => setFilterCategory(st.key as any)}
                className={`flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  filterCategory === st.key
                    ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs font-black'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* 5. VISUALISASI GRAFIK TREN KEHADIRAN (%) - Seragam seperti Foto 2 & Foto 3 */}
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
                    Tren Kehadiran Sesi Presensi Dewan Guru (%)
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                    Fluktuasi tingkat kehadiran dewan guru per tanggal sesi mengajar
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
                    ({trendData.length} Hari Sesi Terdata)
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
                Belum ada catatan aktivitas presensi mengajar pada bulan terpilih.
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

              const pointsHadir = trendData.map((d: any, i: number) => ({
                x: getX(i),
                y: getY(d.pctHadir ?? 0),
                val: d.pctHadir ?? 0,
                data: d,
              }));

              const pointsIzin = trendData.map((d: any, i: number) => ({
                x: getX(i),
                y: getY(d.pctIzin ?? 0),
                val: d.pctIzin ?? 0,
                data: d,
              }));

              const pointsSakit = trendData.map((d: any, i: number) => ({
                x: getX(i),
                y: getY(d.pctSakit ?? 0),
                val: d.pctSakit ?? 0,
                data: d,
              }));

              const pointsAlpha = trendData.map((d: any, i: number) => ({
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

                    {/* Garis Target Ambang Batas 85% */}
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
                    {pointsHadir.map((p: any, idx: number) => {
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

        {/* 6. TABEL RINCIAN EVALUASI DEWAN GURU MADIN - Seragam seperti Foto 2 & Foto 3 */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
          {/* Header Tabel & Input Pencarian */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                Rincian Evaluasi Presensi Seluruh Dewan Guru
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daftar lengkap kehadiran mengajar masing-masing ustadz/ustadzah ({filteredTeachers.length} guru ditampilkan)
              </p>
            </div>

            {/* Input Pencarian */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                value={searchTeacher}
                onChange={(e) => setSearchTeacher(e.target.value)}
                placeholder="Cari guru / NIP / mapel / kelas..."
                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none text-slate-800 dark:text-slate-100"
              />
              {searchTeacher && (
                <button
                  type="button"
                  onClick={() => setSearchTeacher('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Table of Teachers */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center rounded-l-xl">No</th>
                  <th className="py-3.5 px-4">Dewan Guru</th>
                  <th className="py-3.5 px-4">Kelas & Mapel yang Diampu</th>
                  <th className="py-3.5 px-3 text-center">Total Sesi</th>
                  <th className="py-3.5 px-3 text-center text-emerald-600 dark:text-emerald-400">Hadir</th>
                  <th className="py-3.5 px-3 text-center text-blue-600 dark:text-blue-400">Izin</th>
                  <th className="py-3.5 px-3 text-center text-amber-600 dark:text-amber-400">Sakit</th>
                  <th className="py-3.5 px-3 text-center text-rose-600 dark:text-rose-400">Alpha</th>
                  <th className="py-3.5 px-4 text-center rounded-r-xl">Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      Tidak ada data guru yang cocok dengan pencarian atau filter yang dipilih.
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((t: any, idx: number) => {
                    const att = t.attendance || { hadir: 0, izin: 0, sakit: 0, alpha: 0, total_sesi: 0, percentage: 0 };
                    const pct = att.percentage;
                    const fotoSrc = getFotoUrl(t.foto);

                    return (
                      <tr key={t.guru_id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3.5 px-4 text-center text-slate-400 font-medium">{idx + 1}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-3">
                            <div 
                              onClick={() => {
                                if (fotoSrc) setZoomPhoto(fotoSrc);
                              }}
                              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-extrabold shrink-0 shadow-xs overflow-hidden select-none ${
                                fotoSrc ? 'cursor-pointer hover:opacity-90 active:scale-95 transition-all' : ''
                              }`}
                              style={{ backgroundColor: getAvatarColor(t.nama) }}
                              title={fotoSrc ? 'Klik untuk melihat foto penuh' : t.nama}
                            >
                              {fotoSrc ? (
                                <img src={fotoSrc} alt={t.nama} className="w-full h-full object-cover" />
                              ) : (
                                getInitials(t.nama)
                              )}
                            </div>
                            <div>
                              <span className="block text-slate-900 dark:text-slate-100 font-bold text-xs">{t.nama}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                {t.nip ? `NIP: ${t.nip}` : t.no_hp ? `No. HP: ${t.no_hp}` : '-'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-normal">
                          <div className="flex flex-wrap gap-1 max-w-sm">
                            {(t.classes || []).map((c: any, cIdx: number) => (
                              <span 
                                key={cIdx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 text-[10px] font-medium border border-purple-200/50 dark:border-purple-800/30"
                              >
                                <strong>{c.kelas_nama}</strong>: {c.mata_pelajaran}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                          {att.total_sesi}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-md font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {att.hadir}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-md font-bold text-blue-700 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300">
                            {att.izin}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-md font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300">
                            {att.sakit}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-md font-bold ${
                            att.alpha > 0 
                              ? 'text-rose-700 bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300' 
                              : 'text-slate-400 bg-slate-50 dark:bg-slate-800'
                          }`}>
                            {att.alpha}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-extrabold text-[11px] w-9 text-right text-slate-800 dark:text-slate-200">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Lightbox Zoom Foto */}
      {zoomPhoto && (
        <div
          onClick={() => setZoomPhoto(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
        >
          <div className="relative max-w-sm w-full bg-slate-900 rounded-3xl overflow-hidden p-2 border border-slate-700 shadow-2xl">
            <button
              onClick={() => setZoomPhoto(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
            <img
              src={zoomPhoto}
              alt="Foto Penuh"
              className="w-full h-auto rounded-2xl object-cover max-h-[75vh]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function RekapKepalaMadinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center font-bold text-slate-400">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw size={28} className="text-purple-600 animate-spin" />
          <span>Memuat laporan...</span>
        </div>
      </div>
    }>
      <RekapKepalaMadinContent />
    </Suspense>
  );
}
