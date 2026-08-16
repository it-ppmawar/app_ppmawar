'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  BookOpen, Users, Calendar, CheckCircle2, AlertCircle, Clock, 
  Search, Printer, Download, Sparkles, Award, Filter, RefreshCw, 
  Check, AlertTriangle, ShieldCheck, UserCheck, ChevronRight
} from 'lucide-react';

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

function RekapKepalaMadinContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [searchTeacher, setSearchTeacher] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'excellent' | 'needs_attention' | 'has_alpha'>('all');

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

    // Filter by search
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

    // Filter by status category
    if (filterCategory === 'excellent') {
      list = list.filter((t: any) => (t.attendance?.percentage || 0) >= 90);
    } else if (filterCategory === 'needs_attention') {
      list = list.filter((t: any) => ((t.attendance?.izin || 0) + (t.attendance?.sakit || 0)) > 0);
    } else if (filterCategory === 'has_alpha') {
      list = list.filter((t: any) => (t.attendance?.alpha || 0) > 0);
    }

    return list;
  }, [data, searchTeacher, filterCategory]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 flex flex-col items-center max-w-sm w-full text-center">
          <RefreshCw className="animate-spin text-purple-600 dark:text-purple-400 mb-4" size={36} />
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">Memuat Laporan Dewan Guru...</h3>
          <p className="text-xs text-gray-500 mt-1">Mengompilasi data kehadiran seluruh guru Madin</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-xl border border-red-100 dark:border-red-900/30 flex flex-col items-center max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-950/50 rounded-2xl flex items-center justify-center text-red-600 mb-4">
            <AlertCircle size={28} />
          </div>
          <h3 className="font-extrabold text-gray-800 dark:text-gray-100 text-lg mb-2">Laporan Tidak Dapat Diakses</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
            {error || 'Tautan ini mungkin sudah kedaluwarsa atau tidak valid. Silakan hubungi admin pondok pesantren.'}
          </p>
          <div className="text-[11px] font-medium text-gray-400">
            PP. Matholi'ul Anwar Simo Sungelebak Karanggeneng Lamongan
          </div>
        </div>
      </div>
    );
  }

  const { periode, summary } = data;

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-gray-950 text-gray-800 dark:text-gray-100 font-sans pb-16">
      {/* Top Header Navigation */}
      <header className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center font-bold text-lg text-purple-200">
              KM
            </div>
            <div>
              <h1 className="font-extrabold text-sm sm:text-base leading-tight tracking-tight">
                Laporan Evaluasi Kehadiran Dewan Guru
              </h1>
              <p className="text-[11px] text-purple-200/90 font-medium">
                Kepala Madrasah Diniyah • PP. Matholi'ul Anwar
              </p>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            title="Cetak Laporan"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Cetak Laporan</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* Banner Periode & KPI Cards */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-200/80 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-gray-100 dark:border-gray-800">
            <div>
              <span className="px-2.5 py-0.5 bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-bold text-[10px] rounded-full uppercase tracking-wider border border-purple-300/40">
                Evaluasi Bulanan Pimpinan
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">
                Rekapitulasi Presensi Mengajar Madin
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Periode Laporan: <strong className="text-purple-700 dark:text-purple-400">{periode.bulan_nama} {periode.tahun}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950/30 px-4 py-2 rounded-2xl border border-purple-200/50 dark:border-purple-800/30">
              <ShieldCheck className="text-purple-600 dark:text-purple-400" size={20} />
              <div className="text-right">
                <span className="text-[10px] text-gray-400 font-bold block uppercase">Rata-Rata Kehadiran</span>
                <span className="text-lg font-black text-purple-700 dark:text-purple-300">{summary.avg_attendance_pct}%</span>
              </div>
            </div>
          </div>

          {/* 4 Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 text-xs">
            <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl border border-purple-200/50 dark:border-purple-800/30 flex items-center gap-3">
              <div className="p-2.5 bg-purple-600 text-white rounded-xl shadow-sm shrink-0">
                <Users size={16} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block font-bold uppercase">Total Dewan Guru</span>
                <span className="font-extrabold text-base text-gray-900 dark:text-gray-100">{summary.total_guru} Guru</span>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/50 dark:border-emerald-800/30 flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block font-bold uppercase">Sesi Terlaksana</span>
                <span className="font-extrabold text-base text-emerald-700 dark:text-emerald-300">{summary.total_hadir} Sesi</span>
              </div>
            </div>

            <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-200/50 dark:border-blue-800/30 flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm shrink-0">
                <Calendar size={16} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block font-bold uppercase">Total Izin / Sakit</span>
                <span className="font-extrabold text-base text-blue-700 dark:text-blue-300">{summary.total_izin + summary.total_sakit} Sesi</span>
              </div>
            </div>

            <div className="p-3.5 bg-red-50/50 dark:bg-red-950/20 rounded-2xl border border-red-200/50 dark:border-red-800/30 flex items-center gap-3">
              <div className="p-2.5 bg-red-600 text-white rounded-xl shadow-sm shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block font-bold uppercase">Tanpa Keterangan</span>
                <span className="font-extrabold text-base text-red-700 dark:text-red-300">{summary.total_alpha} Sesi</span>
              </div>
            </div>
          </div>
        </div>

        {/* Table & Controls Section */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-200/80 dark:border-gray-800 overflow-hidden">
          {/* Filter Bar */}
          <div className="p-5 bg-gradient-to-r from-slate-50 to-purple-50/20 dark:from-gray-900 dark:to-purple-950/10 border-b border-gray-200/80 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                value={searchTeacher}
                onChange={(e) => setSearchTeacher(e.target.value)}
                placeholder="Cari guru / NIP / mapel / kelas..."
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                type="button"
                onClick={() => setFilterCategory('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
                  filterCategory === 'all'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                Semua ({data.teachers?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('excellent')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
                  filterCategory === 'excellent'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-emerald-700 dark:text-emerald-400 hover:bg-gray-200'
                }`}
              >
                ⭐ Sangat Baik (≥90%)
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('needs_attention')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
                  filterCategory === 'needs_attention'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-blue-700 dark:text-blue-400 hover:bg-gray-200'
                }`}
              >
                ⚠️ Izin/Sakit
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('has_alpha')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
                  filterCategory === 'has_alpha'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-red-700 dark:text-red-400 hover:bg-gray-200'
                }`}
              >
                ❌ Ada Alpha
              </button>
            </div>
          </div>

          {/* Table of Teachers */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-gray-800/60 border-b border-gray-200/80 dark:border-gray-800 text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Dewan Guru</th>
                  <th className="py-3 px-4">Kelas & Mapel yang Diampu</th>
                  <th className="py-3 px-3 text-center">Total Sesi</th>
                  <th className="py-3 px-3 text-center text-emerald-700 dark:text-emerald-400">Hadir</th>
                  <th className="py-3 px-3 text-center text-blue-700 dark:text-blue-400">Izin</th>
                  <th className="py-3 px-3 text-center text-amber-700 dark:text-amber-400">Sakit</th>
                  <th className="py-3 px-3 text-center text-red-700 dark:text-red-400">Alpha</th>
                  <th className="py-3 px-4 text-center">Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">
                      Tidak ada data guru yang cocok dengan filter yang dipilih.
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((t: any, idx: number) => {
                    const att = t.attendance || { hadir: 0, izin: 0, sakit: 0, alpha: 0, total_sesi: 0, percentage: 0 };
                    const pct = att.percentage;

                    return (
                      <tr key={t.guru_id || idx} className="hover:bg-slate-50/80 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="py-3.5 px-4 text-center text-gray-400 font-medium">{idx + 1}</td>
                        <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[11px] font-extrabold shrink-0 shadow-sm overflow-hidden"
                              style={{ backgroundColor: getAvatarColor(t.nama) }}
                            >
                              {t.foto ? (
                                <img src={getFotoUrl(t.foto)} alt={t.nama} className="w-full h-full object-cover" />
                              ) : (
                                getInitials(t.nama)
                              )}
                            </div>
                            <div>
                              <span className="block">{t.nama}</span>
                              <span className="text-[10px] text-gray-400 font-normal">{t.nip ? `NIP: ${t.nip}` : t.no_hp || '-'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
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
                        <td className="py-3.5 px-3 text-center font-bold text-gray-700 dark:text-gray-300">
                          {att.total_sesi}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {att.hadir}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md font-bold text-blue-700 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300">
                            {att.izin}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300">
                            {att.sakit}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md font-bold ${
                            att.alpha > 0 
                              ? 'text-red-700 bg-red-100 dark:bg-red-950/60 dark:text-red-300' 
                              : 'text-gray-400 bg-gray-50 dark:bg-gray-800'
                          }`}>
                            {att.alpha}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                            <span className="font-extrabold text-[11px] w-8 text-right">{pct}%</span>
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
    </div>
  );
}

export default function RekapKepalaMadinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold text-gray-400">Memuat laporan...</div>}>
      <RekapKepalaMadinContent />
    </Suspense>
  );
}
