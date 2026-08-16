'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  BookOpen, Users, Calendar, CheckCircle2, AlertCircle, Clock, 
  Search, Printer, Download, Share2, Sparkles, User, Award, 
  ChevronRight, RefreshCw, Layers
} from 'lucide-react';
import Image from 'next/image';

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

function RekapGuruContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [activeClassIdx, setActiveClassIdx] = useState(0);
  const [searchStudent, setSearchStudent] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Tautan rekapitulasi tidak valid atau tidak memiliki token akses.');
      setLoading(false);
      return;
    }

    fetch(`/api/rekapitulasi/guru-preview?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Gagal memuat rekapitulasi');
        setData(json.data);
      })
      .catch((err: any) => {
        setError(err.message || 'Terjadi kesalahan saat memuat data rekapitulasi.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const activeClass = data?.classes?.[activeClassIdx] || null;

  const filteredStudents = useMemo(() => {
    if (!activeClass || !activeClass.students) return [];
    if (!searchStudent.trim()) return activeClass.students;
    const q = searchStudent.toLowerCase();
    return activeClass.students.filter((s: any) =>
      (s.nama || '').toLowerCase().includes(q) || (s.nis || '').includes(q)
    );
  }, [activeClass, searchStudent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 flex flex-col items-center max-w-sm w-full text-center">
          <RefreshCw className="animate-spin text-emerald-600 dark:text-emerald-400 mb-4" size={36} />
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">Memuat Rekapitulasi...</h3>
          <p className="text-xs text-gray-500 mt-1">Mengambil data kehadiran guru & santri</p>
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
          <h3 className="font-extrabold text-gray-800 dark:text-gray-100 text-lg mb-2">Tautan Tidak Dapat Diakses</h3>
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

  const { guru, periode, classes } = data;
  const guruAtt = guru.kehadiran || { hadir: 0, izin: 0, sakit: 0, alpha: 0, total_sesi: 0 };

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-gray-950 text-gray-800 dark:text-gray-100 font-sans pb-16">
      {/* Top Header Navigation */}
      <header className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center font-bold text-lg text-emerald-200">
              MA
            </div>
            <div>
              <h1 className="font-extrabold text-sm sm:text-base leading-tight tracking-tight">
                Rekapitulasi Absensi Guru
              </h1>
              <p className="text-[11px] text-emerald-200/90 font-medium">
                Pondok Pesantren Matholi'ul Anwar
              </p>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            title="Cetak Rekapitulasi"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Cetak Rekap</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        {/* Guru Info & Period Banner */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-200/80 dark:border-gray-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-extrabold text-xl shadow-md shrink-0 overflow-hidden"
                style={{ backgroundColor: getAvatarColor(guru.nama) }}
              >
                {guru.foto ? (
                  <img src={getFotoUrl(guru.foto)} alt={guru.nama} className="w-full h-full object-cover" />
                ) : (
                  getInitials(guru.nama)
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] rounded-full uppercase tracking-wider border border-emerald-300/40">
                    Laporan Presensi Guru
                  </span>
                  <span className="text-xs text-gray-400 font-medium">
                    {periode.bulan_nama} {periode.tahun}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-gray-100 mt-1">
                  {guru.nama}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                  {guru.nip ? `NIP: ${guru.nip}` : 'Tenaga Pendidik'} • {guru.no_hp || '-'}
                </p>
              </div>
            </div>

            {/* Statistik Kehadiran Guru Sendiri */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3 bg-slate-50 dark:bg-gray-800/60 p-3 rounded-2xl border border-gray-200/60 dark:border-gray-700/60">
              <div className="text-center">
                <span className="text-[10px] text-gray-400 font-bold block uppercase">Hadir</span>
                <span className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400">{guruAtt.hadir || 0}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-gray-400 font-bold block uppercase">Izin</span>
                <span className="text-sm sm:text-base font-extrabold text-blue-600 dark:text-blue-400">{guruAtt.izin || 0}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-gray-400 font-bold block uppercase">Sakit</span>
                <span className="text-sm sm:text-base font-extrabold text-amber-600 dark:text-amber-400">{guruAtt.sakit || 0}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-gray-400 font-bold block uppercase">Alpha</span>
                <span className="text-sm sm:text-base font-extrabold text-red-600 dark:text-red-400">{guruAtt.alpha || 0}</span>
              </div>
            </div>
          </div>

          {/* Quick Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-5 text-xs">
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/50 dark:border-emerald-800/30 flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm">
                <BookOpen size={16} />
              </div>
              <div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-medium">Total Kelas Diampu</span>
                <span className="font-extrabold text-sm text-gray-900 dark:text-gray-100">{classes.length} Kelas / Mapel</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-200/50 dark:border-blue-800/30 flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
                <Users size={16} />
              </div>
              <div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-medium">Total Santri Terbina</span>
                <span className="font-extrabold text-sm text-gray-900 dark:text-gray-100">
                  {classes.reduce((acc: number, c: any) => acc + (c.students?.length || 0), 0)} Santri
                </span>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/50 dark:border-amber-800/30 flex items-center gap-3">
              <div className="p-2.5 bg-amber-600 text-white rounded-xl shadow-sm">
                <Calendar size={16} />
              </div>
              <div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-medium">Periode Laporan</span>
                <span className="font-extrabold text-sm text-gray-900 dark:text-gray-100">{periode.bulan_nama} {periode.tahun}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Classes Tabs / Pill Navigation */}
        {classes.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-emerald-600" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Pilih Kelas Yang Diampu ({classes.length})
                </h3>
              </div>
            </div>

            {/* Pill Tab Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {classes.map((cls: any, idx: number) => {
                const isActive = activeClassIdx === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setActiveClassIdx(idx);
                      setSearchStudent('');
                    }}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border shadow-sm ${
                      isActive
                        ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/20'
                        : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 uppercase">
                      {cls.tipe}
                    </span>
                    <span>{cls.kelas_nama}</span>
                    <span className={`text-[11px] font-normal opacity-80 ${isActive ? 'text-emerald-100' : 'text-gray-400'}`}>
                      ({cls.mata_pelajaran})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Class Content Card */}
            {activeClass && (
              <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-200/80 dark:border-gray-800 overflow-hidden">
                {/* Active Class Header */}
                <div className="p-5 bg-gradient-to-r from-slate-50 to-emerald-50/30 dark:from-gray-900 dark:to-emerald-950/20 border-b border-gray-200/80 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-emerald-600 text-white font-extrabold text-[10px] rounded-lg uppercase tracking-wider">
                        {activeClass.tipe_label}
                      </span>
                      <span className="text-xs font-bold text-gray-500">
                        {activeClass.students?.length || 0} Santri Terdaftar
                      </span>
                    </div>
                    <h4 className="text-lg font-black text-gray-900 dark:text-gray-100 mt-1">
                      {activeClass.kelas_nama} — <span className="text-emerald-700 dark:text-emerald-400">{activeClass.mata_pelajaran}</span>
                    </h4>
                    {activeClass.jadwal_info && activeClass.jadwal_info.length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                        <Clock size={12} className="text-gray-400" />
                        Jadwal: {activeClass.jadwal_info.join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Search Student in Class */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      value={searchStudent}
                      onChange={(e) => setSearchStudent(e.target.value)}
                      placeholder="Cari nama santri / NIS..."
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Table of Students */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-gray-800/60 border-b border-gray-200/80 dark:border-gray-800 text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4 w-12 text-center">No</th>
                        <th className="py-3 px-4">Santri</th>
                        <th className="py-3 px-3 text-center">NIS</th>
                        <th className="py-3 px-3 text-center text-emerald-700 dark:text-emerald-400">Hadir</th>
                        <th className="py-3 px-3 text-center text-blue-700 dark:text-blue-400">Izin</th>
                        <th className="py-3 px-3 text-center text-amber-700 dark:text-amber-400">Sakit</th>
                        <th className="py-3 px-3 text-center text-red-700 dark:text-red-400">Alpha</th>
                        <th className="py-3 px-4 text-center">Persentase</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-gray-400 text-xs">
                            {searchStudent ? 'Tidak ada santri yang cocok dengan pencarian.' : 'Belum ada data santri pada kelas ini.'}
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((s: any, idx: number) => {
                          const total = (s.hadir || 0) + (s.izin || 0) + (s.sakit || 0) + (s.alpha || 0);
                          const pct = total > 0 ? Math.round(((s.hadir || 0) / total) * 100) : 0;

                          return (
                            <tr key={s.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-gray-800/40 transition-colors">
                              <td className="py-3 px-4 text-center text-gray-400 font-medium">{idx + 1}</td>
                              <td className="py-3 px-4 font-bold text-gray-800 dark:text-gray-200">
                                <div className="flex items-center gap-2.5">
                                  <div 
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-extrabold shrink-0"
                                    style={{ backgroundColor: getAvatarColor(s.nama) }}
                                  >
                                    {s.foto ? (
                                      <img src={getFotoUrl(s.foto)} alt={s.nama} className="w-full h-full object-cover rounded-lg" />
                                    ) : (
                                      getInitials(s.nama)
                                    )}
                                  </div>
                                  <span>{s.nama}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center font-mono text-gray-500 text-[11px]">
                                {s.nis || '-'}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  {s.hadir || 0}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md font-bold text-blue-700 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300">
                                  {s.izin || 0}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300">
                                  {s.sakit || 0}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md font-bold ${
                                  (s.alpha || 0) > 0 
                                    ? 'text-red-700 bg-red-100 dark:bg-red-950/60 dark:text-red-300' 
                                    : 'text-gray-400 bg-gray-50 dark:bg-gray-800'
                                }`}>
                                  {s.alpha || 0}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${
                                        pct >= 85 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
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
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 text-center border border-dashed border-gray-300 dark:border-gray-700">
            <BookOpen size={36} className="mx-auto text-gray-400 mb-2" />
            <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm">Tidak Ada Data Kelas</h4>
            <p className="text-xs text-gray-500 mt-1">Tidak ditemukan jadwal aktif untuk kategori yang dipilih pada periode ini.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function RekapGuruPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold text-gray-400">Memuat halaman...</div>}>
      <RekapGuruContent />
    </Suspense>
  );
}
