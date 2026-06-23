'use client';

import { useState, useEffect } from 'react';
import { CalendarCheck, Clock, BookOpen, Users, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function InputAbsenPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hari, setHari] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        // Fetch role info in parallel with schedules
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
        } else {
          setErrorMsg(json.error || 'Akses ditolak');
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('Terjadi kesalahan jaringan.');
      } finally {
        setLoading(false);
      }
    };
    fetchSchedules();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
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

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
          Jadwal Hari {hari}
        </h2>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Memuat jadwal...</div>
      ) : errorMsg ? (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-3xl p-8 border border-red-100 dark:border-red-800/50 shadow-sm text-center">
          <div className="bg-red-100 dark:bg-red-900/50 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4 text-red-500">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-lg font-bold text-red-800 dark:text-red-400 mb-2">Akses Ditolak</h3>
          <p className="text-sm text-red-600 dark:text-red-300 mb-6 max-w-sm mx-auto">
            {errorMsg}
          </p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schedules.map((sched) => {
            const isAktif = sched.status === 'aktif';
            const isSelesai = sched.status === 'selesai';
            
            const cardContent = (
                <div className={`p-5 rounded-2xl border transition-all ${
                  isAktif 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:shadow-md cursor-pointer group' 
                    : isSelesai
                      ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-75 cursor-not-allowed'
                      : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 opacity-75 cursor-not-allowed'
                }`}>
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg flex items-center gap-1.5 w-max ${
                      isAktif 
                        ? 'bg-blue-600 text-white animate-pulse' 
                        : isSelesai
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400'
                    }`}>
                      {isAktif ? <Clock size={12} className="animate-spin-slow" /> : <Clock size={12} />}
                      {isAktif ? 'BISA DIISI SEKARANG' : isSelesai ? 'WAKTU HABIS' : 'BELUM WAKTUNYA'}
                    </span>
                    <span className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400">
                      {sched.jam_mulai.substring(0, 5)} - {sched.jam_selesai.substring(0, 5)}
                    </span>
                  </div>
                  
                  <h3 className={`text-lg font-bold mb-1 transition-colors ${isAktif ? 'text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {sched.mata_pelajaran || 'Mata Pelajaran'}
                  </h3>
                  
                  <div className="flex items-center gap-4 text-xs font-semibold mt-4">
                    <div className={`flex items-center gap-1.5 ${isAktif ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}`}>
                      <BookOpen size={14} className={sched.tipe === 'madin' ? 'text-teal-500' : 'text-emerald-500'} />
                      <span>{sched.nama_kelas}</span>
                    </div>
                    {isAktif ? (
                      <div className="flex items-center gap-1.5 ml-auto text-blue-600 dark:text-blue-400">
                        Input Absen <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    ) : (
                      <div className="ml-auto text-gray-400 italic">
                        {isSelesai ? 'Ditutup' : 'Terkunci'}
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
      )}
    </div>
  );
}
