'use client';

import { useEffect, useState } from 'react';
import { Clock, BookOpen, Activity, FileText, CheckCircle, XCircle, AlertTriangle, Users, User, Camera, CalendarDays, ClipboardCheck, QrCode, CreditCard, Archive, PenTool, Trash2, Pencil, X, Check } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [greeting, setGreeting] = useState('');
  const [username, setUsername] = useState('Memuat...');
  const [role, setRole] = useState('guru');
  const [isPengasuh, setIsPengasuh] = useState(false);
  const [isPengurusAsrama, setIsPengurusAsrama] = useState(false);
  const [asramaName, setAsramaName] = useState<string | null>(null);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [showFullPic, setShowFullPic] = useState(false);
  
  const [schedules, setSchedules] = useState<any[]>([]);
  const [allSchedules, setAllSchedules] = useState<any[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  
  const [dateStr, setDateStr] = useState('');
  const [hijriDateStr, setHijriDateStr] = useState('');
  const [showEditNama, setShowEditNama] = useState(false);
  const [editNamaValue, setEditNamaValue] = useState('');
  const [savingNama, setSavingNama] = useState(false);

  useEffect(() => {
    // Menentukan ucapan berdasarkan waktu
    const hour = new Date().getHours();
    if (hour < 11) setGreeting('Selamat Pagi');
    else if (hour < 15) setGreeting('Selamat Siang');
    else if (hour < 18) setGreeting('Selamat Sore');
    else setGreeting('Selamat Malam');

    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success && data.user) {
          const realName = data.user.real_name || data.user.username;
          setUsername(realName);
          setEditNamaValue(realName);
          setRole(data.user.role);
          setIsPengasuh(!!(data.user.is_pengasuh || data.user.isPengasuh || data.user.role === 'pengasuh'));
          setIsPengurusAsrama(!!(data.user.is_pengurus_asrama || data.user.isPengurusAsrama || data.user.role === 'pengurus_asrama'));
          setAsramaName(data.user.asrama || null);
        } else {
          setUsername('Tamu');
          setRole('');
        }
      } catch (e) {
        console.error('Failed to fetch user', e);
      }
    };

    // Load Profile Pic from local storage
    const storedPic = localStorage.getItem('user_avatar');
    if (storedPic) {
      setProfilePic(storedPic);
    }
    
    const fetchSchedules = async () => {
      try {
        const res = await fetch('/api/absen/jadwal');
        const json = await res.json();
        if (res.ok && json.success) {
          setSchedules(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch schedules', err);
      } finally {
        setLoadingSchedules(false);
      }
    };

    const fetchAllSchedules = async () => {
      try {
        const res = await fetch('/api/jadwal');
        const json = await res.json();
        if (res.ok && json.success) {
          setAllSchedules(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch all schedules', err);
      }
    };

    fetchUser();
    fetchSchedules();
    fetchAllSchedules();

    // Populate dates on mount to avoid hydration mismatch
    const today = new Date();
    const localDate = today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace('Minggu', 'Ahad');
    setDateStr(localDate + ' M');

    try {
      const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const arabicDay = arabicDays[today.getDay()];
      const hijriFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
      const hijriDate = hijriFormatter.format(today).replace(/هـ/g, '').trim();
      setHijriDateStr(`${arabicDay}، ${hijriDate} هـ`);
    } catch (e) {
      setHijriDateStr('');
    }
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Greeting */}
      <div className="text-center py-8 bg-gradient-to-br from-[#064e3b] to-[#022c22] rounded-3xl shadow-lg border border-green-800/50 overflow-hidden relative transition-colors duration-300">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 via-emerald-500 to-green-600"></div>
        <h2
          className="text-[clamp(2.2rem,10vw,5rem)] font-diwani text-green-300 mb-1 mt-1 drop-shadow-sm transition-all duration-300 px-2 w-full leading-relaxed tracking-[0.05em] whitespace-nowrap"
          dir="rtl"
        >
          « السَّلاَمُ عَلَيْكُمْ وَرَحْمَةُ اللهِ »
        </h2>
        <h1 className="text-xl md:text-3xl font-bold text-white transition-all duration-300 font-cinzel tracking-widest uppercase mt-2" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          {greeting} <span className="text-green-400 inline-block">!</span>
        </h1>

        {/* Foto Profil & Nama User */}
        <div className="flex flex-col items-center mt-6 relative z-10 transition-all duration-300">
          <button
            onClick={() => profilePic ? setShowFullPic(true) : alert('Silakan pergi ke menu Profil (ikon orang di bawah) untuk mengatur foto Anda.')}
            className="relative group w-20 h-20 rounded-full border-4 border-[#064e3b] shadow-md overflow-hidden bg-green-800 flex items-center justify-center transition-transform hover:scale-105"
            aria-label="Lihat Foto Profil"
          >
            {profilePic ? (
              <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={40} className="text-green-300" />
            )}
            {/* Overlay Hover */}
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={20} className="text-white mb-1" />
              <span className="text-[8px] text-white font-bold">LIHAT</span>
            </div>
          </button>

          <p className="text-green-300 font-extrabold mt-3 text-xl drop-shadow-sm flex items-center gap-2" dir="auto" style={{ fontFamily: '"Amiri", "Cairo", "Noto Naskh Arabic", system-ui, sans-serif', wordBreak: 'break-word' }}>
            <span>{username}</span>
            <button
              onClick={() => { setEditNamaValue(username); setShowEditNama(true); }}
              className="p-1 rounded-full bg-green-800/50 hover:bg-green-700/70 text-green-300 transition-colors"
              title="Edit Nama"
            >
              <Pencil size={13} />
            </button>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
            <span className="bg-[#022c22]/80 text-green-300 text-[10px] px-3 py-1 rounded-full font-bold border border-green-800/50 uppercase tracking-wide">
              {role}
            </span>
            {isPengasuh && role !== 'pengasuh' && (
              <span className="bg-emerald-900/80 text-emerald-300 text-[10px] px-3 py-1 rounded-full font-bold border border-emerald-700/50 uppercase tracking-wide">
                + PENGASUH {asramaName ? `(${asramaName})` : ''}
              </span>
            )}
            {isPengurusAsrama && role !== 'pengurus_asrama' && (
              <span className="bg-teal-900/80 text-teal-300 text-[10px] px-3 py-1 rounded-full font-bold border border-teal-700/50 uppercase tracking-wide">
                + PENGURUS {asramaName ? `(${asramaName})` : ''}
              </span>
            )}
          </div>
        {/* Tanggal — Presisi 50:50 Masehi | Hijriyah (Pemisah Tepat Di Tengah & Tanpa Terpotong) */}
        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center justify-center bg-[#0f172a]/80 px-2.5 sm:px-5 py-2.5 rounded-2xl sm:rounded-full shadow-inner border border-gray-800 transition-all duration-300 w-full max-w-[98%] sm:max-w-xl mx-auto gap-1 sm:gap-2">
          {/* Kolom Kiri: Masehi (Presisi 50%, rata kanan mendekati pemisah) */}
          <div className="flex items-center justify-end min-w-0">
            <span
              className="text-[9.5px] xs:text-[11px] sm:text-xs text-gray-200 font-semibold tracking-tighter xs:tracking-tight sm:tracking-normal text-right whitespace-nowrap"
            >
              {dateStr ? dateStr.toUpperCase() : 'MEMUAT...'}
            </span>
          </div>

          {/* Kolom Tengah: Pemisah (Terunci Presisi Tepat Di Tengah Layar) */}
          <div className="px-0.5 sm:px-1 flex items-center justify-center shrink-0">
            <span className="hidden sm:inline text-gray-500 font-light select-none">|</span>
            <span className="sm:hidden text-emerald-500/70 font-bold select-none text-[10px]">•</span>
          </div>

          {/* Kolom Kanan: Hijriyah (Presisi 50%, rata kiri mendekati pemisah) */}
          <div className="flex items-center justify-start min-w-0">
            <span
              className="text-[10.5px] xs:text-[11.5px] sm:text-xs text-emerald-400 font-bold leading-none text-left whitespace-nowrap"
              style={{ fontFamily: '"Amiri", "Cairo", "Noto Naskh Arabic", serif' }}
              dir="rtl"
            >
              {hijriDateStr || ''}
            </span>
          </div>
        </div>
      </div>
    </div>

      {(() => {
        const lowerRole = (role || '').toLowerCase();
        return (
          <>
      {/* Menu Cepat */}
      {!lowerRole.includes('petugas') && (
      <section>
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
          <Activity size={18} className="text-green-600 dark:text-green-400" /> Menu Cepat
        </h3>
        <div className={`grid gap-3 ${
          lowerRole === 'tamu'
            ? 'grid-cols-2'
            : (['admin', 'pengurus_asrama', 'pengasuh', 'staff'].includes(lowerRole) || isPengasuh || isPengurusAsrama)
            ? 'grid-cols-4'
            : lowerRole !== 'wali_murid'
            ? 'grid-cols-4'
            : 'grid-cols-3'
        }`}>
          {(['admin', 'pengurus_asrama', 'pengasuh', 'staff'].includes(lowerRole) || isPengasuh || isPengurusAsrama) && (
            <Link 
              href="/dashboard/scan-absen" 
              className="col-span-full flex flex-row items-center justify-center gap-2 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-2xl border border-green-100 dark:border-green-800/50 shadow-sm hover:bg-green-100 dark:hover:bg-green-900/50 transition"
            >
              <QrCode size={24} />
              <span className="text-[10px] font-semibold text-center">Scan Absen</span>
            </Link>
          )}
          {lowerRole !== 'wali_murid' && lowerRole !== 'tamu' && (
            <Link href="/dashboard/absen" className="flex flex-col items-center justify-center p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-2xl border border-blue-100 dark:border-blue-800/50 shadow-sm hover:bg-blue-100 dark:hover:bg-blue-900/50 transition">
              <ClipboardCheck size={24} className="mb-2" />
              <span className="text-[10px] font-semibold text-center">Input Absen</span>
            </Link>
          )}

          <Link href="/dashboard/jadwal" className="flex flex-col items-center justify-center p-3 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-2xl border border-teal-100 dark:border-teal-800/50 shadow-sm hover:bg-teal-100 dark:hover:bg-teal-900/50 transition">
            <CalendarDays size={24} className="mb-2" />
            <span className="text-[10px] font-semibold text-center">Lihat Jadwal</span>
          </Link>
          {lowerRole !== 'tamu' && (
            <Link href="/dashboard/murid" className="flex flex-col items-center justify-center p-3 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-2xl border border-orange-100 dark:border-orange-800/50 shadow-sm hover:bg-orange-100 dark:hover:bg-orange-900/50 transition">
              <Users size={24} className="mb-2" />
              <span className="text-[10px] font-semibold text-center">Data Murid</span>
            </Link>
          )}
          <Link href="/dashboard/rekapitulasi" className="flex flex-col items-center justify-center p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-2xl border border-purple-100 dark:border-purple-800/50 shadow-sm hover:bg-purple-100 dark:hover:bg-purple-900/50 transition">
            <FileText size={24} className="mb-2" />
            <span className="text-[10px] font-semibold text-center">Rekapitulasi</span>
          </Link>
        </div>
      </section>
      )}

      {/* Pintasan cepat — Kebersihan, Inventaris, Tagihan — horizontal grid mengisi penuh */}
      {(() => {
        const isPengasuhAny = lowerRole.includes('pengasuh') || isPengasuh;
        const isPengurusAny = lowerRole.includes('pengurus') || isPengurusAsrama;
        const isPetugasKeb = lowerRole.includes('kebersihan') || lowerRole === 'petugas_umum' || lowerRole === 'petugas';
        const isPetugasInv = lowerRole.includes('inventaris') || lowerRole.includes('sarpras') || lowerRole === 'petugas_umum' || lowerRole === 'petugas';

        const showKebersihan = ['admin', 'staff', 'pengurus_asrama', 'pengasuh', 'guru'].includes(lowerRole) || isPengasuhAny || isPengurusAny || isPetugasKeb;
        const showInventaris = ['admin', 'staff', 'pengurus_asrama', 'pengasuh', 'guru'].includes(lowerRole) || isPengasuhAny || isPengurusAny || isPetugasInv;
        const showTagihan = ['admin', 'staff', 'wali_murid', 'pengasuh'].includes(lowerRole) || isPengasuhAny;
        const visibleCount = [showKebersihan, showInventaris, showTagihan].filter(Boolean).length;
        if (visibleCount === 0) return null;
        return (
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${visibleCount}, minmax(0, 1fr))` }}
          >
            {showKebersihan && (
              <Link
                href="/dashboard/kebersihan"
                className="flex flex-col items-center justify-center gap-1.5 p-3 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-700 dark:text-emerald-300 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 shadow-sm hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/50 dark:hover:to-teal-900/50 transition-all text-center"
              >
                <Trash2 size={20} />
                <span className="text-[10px] font-bold leading-tight">Kebersihan &amp; Sampah</span>
              </Link>
            )}
            {showInventaris && (
              <Link
                href="/dashboard/inventaris"
                className="flex flex-col items-center justify-center gap-1.5 p-3 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 text-indigo-700 dark:text-indigo-300 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 shadow-sm hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/50 dark:hover:to-purple-900/50 transition-all text-center"
              >
                <Archive size={20} />
                <span className="text-[10px] font-bold leading-tight">Inventaris Asrama</span>
              </Link>
            )}
            {showTagihan && (
              <Link
                href="/dashboard/billing"
                className="flex flex-col items-center justify-center gap-1.5 p-3 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30 text-orange-700 dark:text-orange-300 rounded-2xl border border-orange-200 dark:border-orange-800/50 shadow-sm hover:from-orange-100 hover:to-amber-100 dark:hover:from-orange-900/50 dark:hover:to-amber-900/50 transition-all text-center"
              >
                <CreditCard size={20} />
                <span className="text-[10px] font-bold leading-tight">Info Tagihan &amp; Pembayaran</span>
              </Link>
            )}
          </div>
        );
      })()}

      {/* Daftar Jadwal Hari Ini */}
      {!lowerRole.includes('petugas') && (
      <>
      <section className="space-y-4">
        {['kegiatan', 'quran', 'madin'].filter(tipe => lowerRole === 'admin' || lowerRole === 'staff' || allSchedules.some(s => s.tipe === tipe)).map(tipe => {
          const tipeName = tipe === 'kegiatan' ? 'Kegiatan' : tipe === 'quran' ? "Qur'an" : 'Madin';
          const Icon = tipe === 'kegiatan' ? Clock : BookOpen;
          const tipeSchedules = schedules.filter(s => s.tipe === tipe);
          const activeSchedules = tipeSchedules.filter(s => s.status === 'aktif');
          
          return (
            <div key={tipe} className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
              <div className="bg-gradient-to-r from-emerald-700 to-green-600 dark:from-emerald-800 dark:to-green-700 px-4 py-3 flex justify-between items-center text-white">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Icon size={16} /> Jadwal {tipeName} Hari Ini</h3>
              </div>
              
              {loadingSchedules ? (
                <div className="p-4 text-center text-sm text-gray-500">Memuat...</div>
              ) : activeSchedules.length > 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {activeSchedules.map((sched, idx) => (
                    <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-200">{sched.mata_pelajaran || 'Mata Pelajaran'}</h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1"><Clock size={12}/> {sched.jam_mulai.substring(0,5)} - {sched.jam_selesai.substring(0,5)}</span>
                          <span className="flex items-center gap-1"><BookOpen size={12}/> {sched.nama_kelas}</span>
                        </div>
                      </div>
                      {role === 'tamu' ? (
                        <span className="px-3 py-1.5 bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-700 cursor-not-allowed select-none">
                          Hanya Lihat
                        </span>
                      ) : (
                        <Link 
                          href={`/dashboard/absen/input?tipe=${sched.tipe}&kelas_id=${sched.kelas_id}&jadwal_id=${sched.jadwal_id}`} 
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${
                            sched.sudah_absen
                              ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100'
                              : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100'
                          }`}
                        >
                          {sched.sudah_absen ? 'Perbarui' : 'Isi Absen'}
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  {tipeSchedules.length > 0 
                    ? `Ada ${tipeSchedules.length} jadwal hari ini, tapi tidak ada yang sedang aktif saat ini.` 
                    : `Tidak ada jadwal ${tipeName.toLowerCase()} mengajar hari ini.`}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Statistik */}
      <section className="space-y-4">
        {/* Khusus Admin - Statistik Guru */}
        {role === 'admin' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
            <div className="bg-gray-800 dark:bg-gray-900 px-4 py-3 text-white">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Activity size={16} /> Statistik Absensi Guru</h3>
            </div>
            <div className="grid grid-cols-4 divide-x dark:divide-gray-700 border-b dark:border-gray-700">
              <div className="p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total</p>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-200">0</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Hadir</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">0</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Izin</p>
                <p className="text-lg font-bold text-orange-500 dark:text-orange-400">0</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Alpha</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">0</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['quran', 'madin', 'kegiatan'].filter(tipe => role === 'admin' || role === 'staff' || allSchedules.some(s => s.tipe === tipe)).map((tipe) => {
            const tipeName = tipe === 'quran' ? 'Qur\'an' : tipe === 'madin' ? 'Madin' : 'Kegiatan';
            return (
            <div key={tipe} className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 transition-colors duration-300">
              <h4 className="text-xs font-bold text-green-700 dark:text-green-400 mb-3 border-b dark:border-gray-700 pb-2">Statistik Absensi {tipeName}</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs dark:text-gray-300">
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400"><XCircle size={14} /> Alpha</span>
                  <span className="font-bold">0% (0)</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5"><div className="bg-red-500 dark:bg-red-400 h-1.5 rounded-full" style={{ width: '0%' }}></div></div>

                <div className="flex justify-between items-center text-xs mt-3 dark:text-gray-300">
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle size={14} /> Hadir</span>
                  <span className="font-bold">0% (0)</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5"><div className="bg-green-500 dark:bg-green-400 h-1.5 rounded-full" style={{ width: '0%' }}></div></div>

                <div className="flex justify-between items-center text-xs mt-3 dark:text-gray-300">
                  <span className="flex items-center gap-1 text-orange-500 dark:text-orange-400"><AlertTriangle size={14} /> Izin</span>
                  <span className="font-bold">0% (0)</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5"><div className="bg-orange-400 h-1.5 rounded-full" style={{ width: '0%' }}></div></div>

                <div className="flex justify-between items-center text-xs mt-3 dark:text-gray-300">
                  <span className="flex items-center gap-1 text-blue-500 dark:text-blue-400"><Activity size={14} /> Sakit</span>
                  <span className="font-bold">0% (0)</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5"><div className="bg-blue-400 h-1.5 rounded-full" style={{ width: '0%' }}></div></div>
              </div>
            </div>
            );
          })}
        </div>
      </section>
      </>
      )}

      {/* Info Tambahan */}
      {!(role || '').toLowerCase().includes('petugas') && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
          <div className="bg-green-800 dark:bg-green-900 px-4 py-2 text-white text-xs font-semibold">Perizinan Terbaru</div>
          <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">Tidak ada perizinan 1 hari terakhir</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
          <div className="bg-green-800 dark:bg-green-900 px-4 py-2 text-white text-xs font-semibold">Pelanggaran Terbaru</div>
          <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">Tidak ada pelanggaran 1 hari terakhir</div>
        </div>
      </div>
      )}

      {/* Info Petugas */}
      {(role || '').toLowerCase().includes('petugas') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8 mt-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300 flex flex-col items-center justify-center p-6 text-center h-48">
             <PenTool size={48} className="text-amber-500 mb-3" />
             <h4 className="font-bold text-gray-800 dark:text-gray-200">Tugas & Monitoring Petugas</h4>
             <p className="text-xs text-gray-500 mt-2">Buka menu Kebersihan atau Inventaris untuk melihat detail tugas dan laporan yang perlu ditindaklanjuti.</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300 flex flex-col items-center justify-center p-6 text-center h-48">
             <Archive size={48} className="text-indigo-500 mb-3" />
             <h4 className="font-bold text-gray-800 dark:text-gray-200">Aktivitas Harian</h4>
             <p className="text-xs text-gray-500 mt-2">Anda bertanggung jawab atas kebersihan dan kelengkapan inventaris di seluruh fasilitas asrama.</p>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Modal */}
      {showFullPic && profilePic && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.3s_ease-out]"
          onClick={() => setShowFullPic(false)}
        >
          <div className="relative w-full max-w-md animate-[slideUp_0.3s_ease-out]">
            <button 
              onClick={() => setShowFullPic(false)}
              className="absolute -top-12 right-0 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition-colors"
            >
              <XCircle size={28} />
            </button>
            <img 
              src={profilePic} 
              alt="Profile Fullscreen" 
              className="w-full h-auto max-h-[80vh] object-contain rounded-2xl shadow-2xl" 
            />
          </div>
        </div>
      )}

      {/* Modal Edit Nama */}
      {showEditNama && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setShowEditNama(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-gray-900 dark:text-white text-sm">Edit Nama Tampilan</h3>
              <button onClick={() => setShowEditNama(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Masukkan nama Anda (mendukung huruf Arab, Latin, dll):
            </p>
            <input
              type="text"
              dir="auto"
              value={editNamaValue}
              onChange={e => setEditNamaValue(e.target.value)}
              placeholder="Nama Anda..."
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 mb-4"
              style={{ fontFamily: '"Amiri", "Cairo", "Noto Naskh Arabic", system-ui, sans-serif' }}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowEditNama(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Batal
              </button>
              <button
                disabled={savingNama || editNamaValue.trim().length < 2}
                onClick={async () => {
                  setSavingNama(true);
                  try {
                    const res = await fetch('/api/user/update-nama', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ nama: editNamaValue.trim() }),
                    });
                    const json = await res.json();
                    if (json.success) {
                      setUsername(json.nama);
                      setShowEditNama(false);
                    } else {
                      alert('Gagal menyimpan: ' + (json.error || 'Error'));
                    }
                  } catch {
                    alert('Koneksi gagal');
                  } finally {
                    setSavingNama(false);
                  }
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                <Check size={14} />
                {savingNama ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
          </>
        );
      })()}

    </div>
  );
}


