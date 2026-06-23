'use client';

import { Home, CalendarDays, ClipboardCheck, Bell, User, Moon, Sun, Clock, Menu, X, LogOut, Settings, Users, FileWarning, MessageSquare, MessageCircle, UserCog, BookOpen, QrCode, Fingerprint, AlertTriangle, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();



  const [isDark, setIsDark] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [nomorCs, setNomorCs] = useState('+628133129223');
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);
  
  const [activeSchedule, setActiveSchedule] = useState<any>(null);
  const [pendingRemindersCount, setPendingRemindersCount] = useState<number>(0);

  const navItems = [
    { name: 'Beranda', href: '/dashboard', icon: Home },
    { name: 'Jadwal', href: '/dashboard/jadwal', icon: CalendarDays },
    ...(user?.role !== 'wali_murid' ? [{ name: 'Absen', href: '/dashboard/absen', icon: ClipboardCheck }] : []),
    { name: 'Notifikasi', href: '/dashboard/notifikasi', icon: Bell },
    { name: 'Profil', href: '/dashboard/profil', icon: User },
  ];

  useEffect(() => {
    const triggerDeviceNotification = (schedule: any, force = false) => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      
      const notifKey = `notified_${schedule.title}_${schedule.time}_${new Date().toLocaleDateString()}`;
      if (!force && localStorage.getItem(notifKey)) return;

      const showNotif = () => {
        const title = 'Jadwal Aktif: ' + schedule.title;
        const options = {
          body: `Waktunya mengajar ${schedule.title} (${schedule.time}). Silakan input absensi.`,
          icon: '/icon-192-v2.png',
          badge: '/icon-192-v2.png',
          data: '/dashboard/absen',
          vibrate: [200, 100, 200, 100, 200, 100, 200],
          requireInteraction: true
        };

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, options).catch(() => {
              new Notification(title, options);
            });
          }).catch(() => {
            new Notification(title, options);
          });
        } else {
          new Notification(title, options);
        }
        if(!force) localStorage.setItem(notifKey, 'true');
      };

      if (Notification.permission === 'granted') {
        showNotif();
      }
    };

    // Fetch Active Schedule dari DB (dengan cache-buster)
    fetch(`/api/jadwal/active?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.activeSchedule) {
            setActiveSchedule(data.activeSchedule);
            triggerDeviceNotification(data.activeSchedule);
          } else {
            setActiveSchedule(null);
          }
          if (data.pendingRemindersCount !== undefined) {
            setPendingRemindersCount(data.pendingRemindersCount);
          } else {
            setPendingRemindersCount(0);
          }
        }
      })
      .catch(console.error);
  }, [pathname]);

  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }

    // Fetch User Profile
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUser(data.user);
        }
      })
      .catch(console.error);

    // Fetch Settings
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data && data.data.nomor_cs) {
          setNomorCs(data.data.nomor_cs);
        }
      })
      .catch(console.error);

    // Check WebAuthn support
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      setWebAuthnSupported(true);
    }

    // Listen to registration event
    const handleFingerprintRegistered = () => {
      setUser((prev: any) => prev ? { ...prev, has_fingerprint: true } : prev);
    };
    window.addEventListener('fingerprint-registered', handleFingerprintRegistered);
    return () => window.removeEventListener('fingerprint-registered', handleFingerprintRegistered);
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 flex flex-col">
      {/* Header Mobile & Desktop */}
      <header className="bg-gradient-to-r from-green-800 to-green-900 dark:from-gray-800 dark:to-gray-900 text-white p-4 shadow-md sticky top-0 z-50 flex justify-between items-center rounded-b-2xl transition-colors duration-300 relative">
        <Link href="/dashboard" className="flex items-center gap-3 z-10 hover:opacity-80 transition-opacity" aria-label="Kembali ke Dashboard">
          <div className="bg-white rounded-xl flex items-center justify-center shadow-inner h-11 px-2 py-1">
            <img src="/logo.png" alt="Logo" className="h-full w-auto object-contain" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-bold text-lg leading-tight drop-shadow-sm">Absensi PPMA</h1>
            <p className="text-green-200 dark:text-green-400 text-xs font-medium">Sistem Absensi Online</p>
          </div>
        </Link>

        {/* Tulisan Arab di Tengah Navbar (Selalu tampil, disesuaikan untuk mobile) */}
        <Link href="/dashboard" className="absolute left-1/2 transform -translate-x-1/2 z-0 text-center flex flex-col items-center justify-center w-44 sm:w-auto mt-0.5 hover:opacity-80 transition-opacity" aria-label="Kembali ke Dashboard">
          <h2 className="text-[1.3rem] leading-tight sm:text-2xl lg:text-3xl font-diwani text-green-100/90 dark:text-gray-300 tracking-wider drop-shadow-md" dir="rtl">
            معهد مطالع الأنوار الإسلامي
          </h2>
          <p className="text-[9px] sm:hidden text-green-200/90 dark:text-green-400 font-medium tracking-wide mt-1 drop-shadow-sm">Sistem Absensi Online</p>
        </Link>

        <div className="flex items-center gap-2 relative z-10">
          {/* Tombol Lonceng Notifikasi (Sembunyikan di HP) */}
          {(activeSchedule || ((user?.role === 'admin' || user?.role === 'staff') && pendingRemindersCount > 0)) && (
            <div className="relative hidden sm:block">
              <button 
                onClick={() => setShowNotif(!showNotif)} 
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors relative"
                aria-label="Notifikasi Jadwal"
              >
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-green-800 dark:border-gray-800 animate-pulse"></span>
              </button>

              {/* Dropdown Notifikasi */}
              {showNotif && (
                <div className="absolute right-0 mt-3 w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden transform animate-[slideDown_0.3s_ease-out]">
                  {activeSchedule ? (
                    <>
                      <div className="bg-green-600 dark:bg-green-700 p-3 text-white">
                        <h4 className="font-bold text-sm flex items-center gap-2"><CalendarDays size={16} /> Jadwal Aktif Saat Ini</h4>
                      </div>
                      <div className="p-4 text-center">
                        <span className="inline-block bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 text-[10px] px-3 py-1 rounded-full font-bold mb-2 border border-orange-200 dark:border-orange-800/50">
                          {activeSchedule.status}
                        </span>
                        <h5 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-1">{activeSchedule.title}</h5>
                        <p className="text-gray-500 dark:text-gray-400 text-xs mb-4 flex items-center justify-center gap-1.5">
                          <Clock size={12} /> {activeSchedule.time}
                        </p>
                        <Link href="/dashboard/absen" onClick={() => setShowNotif(false)} className="block w-full text-center bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors shadow-sm">
                          Input Absensi Sekarang
                        </Link>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-amber-600 dark:bg-amber-700 p-3 text-white">
                        <h4 className="font-bold text-sm flex items-center gap-2"><AlertTriangle size={16} /> Pengingat Absensi</h4>
                      </div>
                      <div className="p-4 text-center">
                        <h5 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-2">Ada {pendingRemindersCount} jadwal aktif belum absen!</h5>
                        <p className="text-gray-500 dark:text-gray-400 text-xs mb-4">
                          Ustadz/Ustadzah atau pengurus asrama belum mengisi daftar kehadiran.
                        </p>
                        <Link href="/dashboard/notifikasi?remind=true" onClick={() => setShowNotif(false)} className="block w-full text-center bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors shadow-sm">
                          Ingatkan Pengajar via WA
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tombol Mode Gelap (Sembunyikan di HP) */}
          <button 
            onClick={toggleTheme} 
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors hidden sm:block"
            aria-label="Toggle Dark Mode"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          {/* Tombol Sidebar Menu */}
          <div className="relative ml-1">
            <button 
              onClick={() => setShowSidebar(true)} 
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors relative z-10"
              aria-label="Buka Menu"
            >
              <Menu size={20} />
              {(activeSchedule || ((user?.role === 'admin' || user?.role === 'staff') && pendingRemindersCount > 0)) && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border border-green-800 dark:border-gray-800 sm:hidden"></span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Overlay & Sidebar Drawer — hanya di-render saat terbuka agar tidak ada GPU layer tersembunyi */}
      {showSidebar && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setShowSidebar(false)}></div>
          <aside className="fixed top-0 right-0 h-full w-72 bg-white dark:bg-gray-900 shadow-2xl z-[70] flex flex-col">
        <div className="p-5 border-b dark:border-gray-800 flex justify-between items-center bg-gradient-to-r from-green-800 to-green-900 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1.5 rounded-full"><User size={24} className="text-green-800" /></div>
            <div>
              <p className="font-bold leading-tight capitalize">{user?.username || 'Memuat...'}</p>
              <p className="text-[10px] text-green-200 uppercase">{user?.role || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="p-2 hover:bg-white/20 rounded-full transition-colors sm:hidden" aria-label="Toggle Mode Gelap">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => setShowSidebar(false)} className="p-1.5 hover:bg-white/20 rounded-full transition-colors" aria-label="Tutup Menu">
              <X size={20} />
            </button>
          </div>
        </div>
        
          <div className="flex-1 overflow-y-auto py-4">
            
            {/* Banner Reminder Sidik Jari */}
            {webAuthnSupported && user && !user.has_fingerprint && (user.role === 'guru' || user.role === 'wali_murid') && (
              <div className="px-4 mb-5">
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl p-3 shadow-sm relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-16 h-16 bg-indigo-100 dark:bg-indigo-800/30 rounded-full opacity-50 pointer-events-none"></div>
                  <div className="flex gap-3">
                    <div className="bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300 p-2 rounded-xl flex-shrink-0">
                      <Fingerprint size={20} />
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-gray-800 dark:text-gray-200 mb-1">Login Lebih Cepat!</h5>
                      <p className="text-[10px] text-gray-600 dark:text-gray-400 mb-2 leading-tight">Untuk kemudahan login, aktifkan fitur sidik jari Anda.</p>
                      <Link href="/dashboard/profil" onClick={() => setShowSidebar(false)} className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors">
                        Aktifkan Sekarang
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Banner Pengingat Absensi untuk Admin / Staff */}
            {(user?.role === 'admin' || user?.role === 'staff') && pendingRemindersCount > 0 && (
              <div className="px-4 mb-5">
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-3 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-8 h-8 bg-amber-200 dark:bg-amber-800/50 rounded-bl-full flex items-start justify-end p-1.5">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-0.5 mt-0.5"></span>
                  </div>
                  <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
                    <AlertTriangle size={12}/> PENGINGAT ABSENSI
                  </p>
                  <h5 className="font-bold text-xs text-gray-800 dark:text-gray-200 mb-1">
                    Ada {pendingRemindersCount} jadwal belum absen!
                  </h5>
                  <p className="text-[10px] text-gray-600 dark:text-gray-400 mb-2 leading-tight">
                    Segera ingatkan guru/pengurus asrama lewat WhatsApp.
                  </p>
                  <Link href="/dashboard/notifikasi?remind=true" onClick={() => setShowSidebar(false)} className="block w-full text-center bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold py-2 rounded-xl transition-colors shadow-sm">
                    Kirim Pengingat WA
                  </Link>
                </div>
              </div>
            )}

            {/* Jadwal Aktif Khusus Mobile di Sidebar */}
          {activeSchedule && (
            <div className="sm:hidden px-4 mb-5">
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-emerald-900/20 border border-green-200 dark:border-green-800/50 rounded-2xl p-3 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-8 h-8 bg-green-200 dark:bg-green-800/50 rounded-bl-full flex items-start justify-end p-1.5">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-0.5 mt-0.5"></span>
                </div>
                <p className="text-[10px] font-bold text-green-700 dark:text-green-400 mb-1 flex items-center gap-1"><Bell size={12}/> JADWAL AKTIF</p>
                <h5 className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-2">{activeSchedule.title}</h5>
                <Link href="/dashboard/absen" onClick={() => setShowSidebar(false)} className="block w-full text-center bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold py-2 rounded-xl transition-colors">
                  Input Absensi
                </Link>
              </div>
            </div>
          )}

          <div className="px-5 mb-2">
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Menu Utama</p>
          </div>
          <ul className="space-y-1 px-3 mb-6">
            <li>
              <Link href="/dashboard" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold' : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium'}`}>
                <Home size={18} /> <span className="text-sm">Dashboard</span>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/guru" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/guru' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold'}`}>
                <UserCog size={18} /> <span className="text-sm">Data Guru & Pembina</span>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/murid" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/murid' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold' : 'hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold'}`}>
                <Users size={18} /> <span className="text-sm">Data Santri</span>
              </Link>
            </li>
            {(user?.role === 'admin' || user?.role === 'staff') && (
              <li>
                <Link href="/dashboard/alumni" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/alumni' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold' : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 font-bold'}`}>
                  <GraduationCap size={18} /> <span className="text-sm">Data Alumni</span>
                </Link>
              </li>
            )}
            <li>
              <Link href="/dashboard/kelas" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/kelas' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 font-bold' : 'hover:bg-teal-50 dark:hover:bg-teal-900/20 text-teal-600 dark:text-teal-400 font-bold'}`}>
                <BookOpen size={18} /> <span className="text-sm">Kelas Qur'an & Madin</span>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/kamar" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/kamar' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold'}`}>
                <Home size={18} /> <span className="text-sm">Kamar Asrama</span>
              </Link>
            </li>
            {(user?.role === 'admin' || user?.role === 'pengurus_asrama' || user?.role === 'staff') && (
            <li>
              <Link href="/dashboard/scan-absen" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/scan-absen' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold' : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 font-bold'}`}>
                <QrCode size={18} /> <span className="text-sm">Scan Absensi</span>
              </Link>
            </li>
            )}
            <li>
              <Link href="/dashboard/ketertiban" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/ketertiban' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold' : 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 font-bold'}`}>
                <FileWarning size={18} /> <span className="text-sm">Ketertiban Murid</span>
              </Link>
            </li>
          </ul>

          {/* Manajemen Sistem - Hanya untuk Admin / Staff Penuh */}
          {(user?.role === 'admin' || user?.role === 'staff') && (
            <>
              <div className="px-5 mb-2 mt-4">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Manajemen Sistem</p>
              </div>
              <ul className="space-y-1 px-3">
                <li>
                  <Link href="/dashboard/users" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors font-medium ${pathname === '/dashboard/users' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : ''}`}>
                    <Users size={18} /> <span className="text-sm">Manajemen Pengguna</span>
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/notifikasi" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors font-medium ${pathname === '/dashboard/notifikasi' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : ''}`}>
                    <MessageSquare size={18} /> <span className="text-sm">Notifikasi & WhatsApp</span>
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/settings" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors font-medium ${pathname === '/dashboard/settings' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : ''}`}>
                    <Settings size={18} /> <span className="text-sm">Pengaturan</span>
                  </Link>
                </li>
              </ul>
            </>
          )}
        </div>
        
        <div className="p-4 border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex flex-col gap-2">
          <a 
            href={`https://wa.me/${nomorCs.replace(/\D/g, '')}?text=${encodeURIComponent('Assalamu\'alaikum, Admin PPMA. Saya butuh bantuan terkait sistem absensi.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl bg-[#25D366] hover:bg-[#1DA851] text-white transition-colors font-bold shadow-sm"
            aria-label="Hubungi Layanan Pengguna"
            onClick={() => setShowSidebar(false)}
          >
            <MessageCircle size={20} />
            <span>Layanan Pengguna (CS)</span>
          </a>
          <button 
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/';
            }}
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors font-bold"
          >
            <LogOut size={20} />
            <span>Keluar</span>
          </button>
        </div>
          </aside>
        </>
      )}

      {/* Konten Utama */}
      <main className="flex-1 p-4 pb-28" style={{ isolation: 'isolate' }}>
        {children}
      </main>

      {/* Navigasi Bawah (Mobile App Style) */}
      <nav className="fixed bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] dark:shadow-[0_-5px_15px_rgba(0,0,0,0.3)] z-50 rounded-t-3xl pb-safe transition-colors duration-300">
        <div className="flex justify-around items-center p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href} className="flex flex-col items-center gap-1 w-16 group transition-all duration-300">
                <div className={`p-2 rounded-2xl transition-all duration-300 ${isActive ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 shadow-sm scale-110' : 'text-gray-400 dark:text-gray-500 group-hover:bg-gray-50 dark:group-hover:bg-gray-700'}`}>
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-green-700 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
