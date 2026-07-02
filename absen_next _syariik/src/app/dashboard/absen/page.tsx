'use client';

import { useState, useEffect } from 'react';
import { CalendarCheck, Clock, BookOpen, AlertCircle, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

type TipeFilter = 'semua' | 'quran' | 'madin' | 'kegiatan';

export default function InputAbsenPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hari, setHari] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [role, setRole] = useState<string>('');
  const [filter, setFilter] = useState<TipeFilter>('semua');

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const [resMe, res] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/absen/jadwal')
        ]);
        const meData = await resMe.json();
        if (meData.success) setRole(meData.user.role);

        const json = await res.json();
        if (res.ok && json.success) {
          setSchedules(json.data);
          setHari(json.hari);

          // Auto-set filter ke tipe pertama yang ada, kecuali semua
          const tipeAda = new Set<string>(json.data.map((s: any) => s.tipe));
          if (tipeAda.size === 1) {
            setFilter(Array.from(tipeAda)[0] as TipeFilter);
          }
        } else {
          setErrorMsg(json.error || 'Akses ditolak');
        }
      } catch (err) {
        setErrorMsg('Terjadi kesalahan jaringan.');
      } finally {
        setLoading(false);
      }
    };
    fetchSchedules();
  }, []);

  // Hitung jumlah per tipe (untuk badge filter)
  const countByTipe = (tipe: string) => schedules.filter(s => s.tipe === tipe).length;
  const tipeAda = new Set<string>(schedules.map(s => s.tipe));

  // Jadwal yang ditampilkan sesuai filter
  const filteredSchedules = filter === 'semua'
    ? schedules
    : schedules.filter(s => s.tipe === filter);

  // Label tipe
  const tipeLabel: Record<string, string> = {
    quran: "Al-Qur'an",
    madin: 'Madin',
    kegiatan: 'Kegiatan / Asrama',
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-3xl p-6 shadow-sm border border-blue-200 dark:border-blue-800/50 relative overflow-hidden transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-blue-200/50 dark:text-blue-800/30">
          <CalendarCheck size={120} />
        </div>
        <div className="relative z-10">
          <h1 className="text-2xl font-extrabold text-blue-800 dark:text-blue-400 drop-shadow-sm flex items-center gap-2">
            <CalendarCheck size={28} /> Jadwal Anda Hari Ini
          </h1>
          <p className="text-blue-600 dark:text-blue-300 text-sm mt-1 font-medium max-w-md">
            {role === 'pengurus_asrama'
              ? 'Pilih kelas untuk mulai menginput data kehadiran santri asrama Anda.'
              : 'Pilih kelas untuk mulai menginput data kehadiran santri.'}
          </p>
        </div>
      </div>

      {/* Judul hari */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
          Jadwal Hari {hari}
        </h2>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCw className="animate-spin text-blue-500" size={32} />
          <p className="text-gray-500 text-sm">Memuat jadwal...</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-3xl p-8 border border-red-100 dark:border-red-800/50 shadow-sm text-center">
          <div className="bg-red-100 dark:bg-red-900/50 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4 text-red-500">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-lg font-bold text-red-800 dark:text-red-400 mb-2">Akses Ditolak</h3>
          <p className="text-sm text-red-600 dark:text-red-300 mb-6 max-w-sm mx-auto">{errorMsg}</p>
          <Link href="/dashboard" className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors">
            Kembali ke Dashboard
          </Link>
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm text-center">
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4 text-gray-400">
            <CalendarCheck size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">
            {role === 'pengurus_asrama' ? 'Tidak Ada Jadwal Hari Ini' : 'Tidak Ada Jadwal Mengajar'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            {role === 'pengurus_asrama'
              ? 'Tidak ada jadwal kelas pada hari ini untuk asrama Anda.'
              : 'Anda tidak memiliki jadwal mengajar pada hari ini.'}
          </p>
        </div>
      ) : (
        <>
          {/* Filter Tab — hanya tampil jika ada lebih dari 1 tipe */}
          {tipeAda.size > 1 && (
            <div className="flex flex-col gap-2 w-full">
              {/* Semua — Baris tersendiri di atas, memanjang memenuhi sisi kanan kiri */}
              <div className="bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 w-full">
                <button
                  onClick={() => setFilter('semua')}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                    filter === 'semua'
                      ? 'bg-slate-600 dark:bg-slate-700 text-white shadow-md'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  Semua
                  <span className={`text-[10px] px-3.5 py-0.5 rounded-full font-extrabold transition-colors ${
                    filter === 'semua' ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>{schedules.length}</span>
                </button>
              </div>

              {/* Tipe lainnya (Qur'an, Madin, Kegiatan Asrama) */}
              <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto scrollbar-none gap-1.5 w-full">
                {/* Quran */}
                {tipeAda.has('quran') && (
                  <button
                    onClick={() => setFilter('quran')}
                    className={`flex-1 min-w-[135px] flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                      filter === 'quran'
                        ? 'bg-emerald-500 text-white shadow-md'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    Kelas Qur'an
                    <span className={`text-[10px] px-3.5 py-0.5 rounded-full font-extrabold transition-colors ${
                      filter === 'quran' ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>{countByTipe('quran')}</span>
                  </button>
                )}

                {/* Madin */}
                {tipeAda.has('madin') && (
                  <button
                    onClick={() => setFilter('madin')}
                    className={`flex-1 min-w-[135px] flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                      filter === 'madin'
                        ? 'bg-teal-500 text-white shadow-md'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    Kelas Madin
                    <span className={`text-[10px] px-3.5 py-0.5 rounded-full font-extrabold transition-colors ${
                      filter === 'madin' ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>{countByTipe('madin')}</span>
                  </button>
                )}

                {/* Kegiatan */}
                {tipeAda.has('kegiatan') && (
                  <button
                    onClick={() => setFilter('kegiatan')}
                    className={`flex-1 min-w-[170px] flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                      filter === 'kegiatan'
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    Kegiatan Asrama
                    <span className={`text-[10px] px-3.5 py-0.5 rounded-full font-extrabold transition-colors ${
                      filter === 'kegiatan' ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>{countByTipe('kegiatan')}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Daftar Jadwal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSchedules.map((sched) => {
              const isAktif = sched.status === 'aktif';
              const isSelesai = sched.status === 'selesai';
              const sudahAbsen = sched.sudah_absen === true;

              const badgeTipe: Record<string, string> = {
                quran: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
                madin: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
                kegiatan: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
              };

              const cardContent = (
                <div className={`p-5 rounded-2xl border transition-all ${
                  isAktif
                    ? `${sudahAbsen ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'} hover:shadow-md cursor-pointer group`
                    : isSelesai
                      ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-75 cursor-not-allowed'
                      : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 opacity-75 cursor-not-allowed'
                }`}>
                  <div className="flex justify-between items-start mb-3 gap-2 flex-wrap">
                    <div className="flex flex-col gap-1.5">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg flex items-center gap-1.5 w-max ${
                        isAktif
                          ? sudahAbsen
                            ? 'bg-green-600 text-white'
                            : 'bg-blue-600 text-white animate-pulse'
                          : isSelesai
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400'
                      }`}>
                        {isAktif ? (sudahAbsen ? <CheckCircle2 size={12} /> : <Clock size={12} className="animate-spin-slow" />) : <Clock size={12} />}
                        {isAktif ? (sudahAbsen ? 'SUDAH DIISI' : 'BISA DIISI SEKARANG') : isSelesai ? 'WAKTU HABIS' : 'BELUM WAKTUNYA'}
                      </span>
                      {/* Badge tipe */}
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md w-max ${badgeTipe[sched.tipe] || ''}`}>
                        {tipeLabel[sched.tipe] || sched.tipe}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400 shrink-0">
                      {sched.jam_mulai.substring(0, 5)} - {sched.jam_selesai.substring(0, 5)}
                    </span>
                  </div>

                  <h3 className={`text-lg font-bold mb-1 transition-colors ${
                    isAktif
                      ? sudahAbsen
                        ? 'text-green-800 dark:text-green-300 group-hover:text-green-600'
                        : 'text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {sched.mata_pelajaran || 'Mata Pelajaran'}
                  </h3>

                  <div className="flex items-center gap-4 text-xs font-semibold mt-4">
                    <div className={`flex items-center gap-1.5 ${isAktif ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}`}>
                      <BookOpen size={14} className={sched.tipe === 'madin' ? 'text-teal-500' : sched.tipe === 'kegiatan' ? 'text-purple-500' : 'text-emerald-500'} />
                      <span>{sched.nama_kelas}</span>
                    </div>
                    {isAktif ? (
                      <div className={`flex items-center gap-1.5 ml-auto font-bold ${sudahAbsen ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        {sudahAbsen ? 'Perbarui Absensi' : 'Input Absen'}
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    ) : (
                      <div className="ml-auto text-gray-400 italic">
                        {isSelesai ? (sudahAbsen ? <span className="text-green-500 not-italic flex items-center gap-1"><CheckCircle2 size={12} /> Selesai & Terisi</span> : 'Ditutup') : 'Terkunci'}
                      </div>
                    )}
                  </div>
                </div>
              );

              return isAktif ? (
                <Link
                  href={`/dashboard/absen/input?tipe=${sched.tipe}&kelas_id=${sched.kelas_id}&jadwal_id=${sched.jadwal_id}`}
                  key={`${sched.tipe}-${sched.jadwal_id}`}
                >
                  {cardContent}
                </Link>
              ) : (
                <div key={`${sched.tipe}-${sched.jadwal_id}`}>
                  {cardContent}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
