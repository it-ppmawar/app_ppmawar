'use client';

import { Home, CalendarDays, ClipboardCheck, Bell, User, Moon, Sun, Clock, Menu, X, LogOut, Settings, Users, FileWarning, MessageSquare, MessageCircle, UserCog, BookOpen, QrCode, Fingerprint, AlertTriangle, GraduationCap, UserRound, Download, CreditCard, Archive, Trash2, ClipboardList, Brain, FileText, Calendar, Link2, Megaphone, Shield, ChevronDown, Database, Layers, Sparkles, Send, ExternalLink, Globe, Smartphone } from 'lucide-react';
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
  const [sidebarAvatar, setSidebarAvatar] = useState<string | null>(null);
  const [showAvatarFull, setShowAvatarFull] = useState(false);
  
  // State accordion grup menu sidebar (default SEMUANYA TERTUTUP sesuai permintaan user)
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    menuUtama: false,
    manajemenData: false,
    aplikasiLainnya: false,
    manajemenSistem: false,
  });

  const toggleSection = (sectionKey: 'menuUtama' | 'manajemenData' | 'aplikasiLainnya' | 'manajemenSistem') => {
    setOpenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };
  
  const [activeSchedule, setActiveSchedule] = useState<any>(null);
  const [pendingRemindersCount, setPendingRemindersCount] = useState<number>(0);
  const [pwaInstallable, setPwaInstallable] = useState(false);
  const [userSchedules, setUserSchedules] = useState<any[]>([]);

  let navItems = [
    { name: 'Beranda', href: '/dashboard', icon: Home },
    { name: 'Jadwal', href: '/dashboard/jadwal', icon: CalendarDays },
    ...(user?.role !== 'wali_murid' && user?.role !== 'wali_alumni' && user?.role !== 'tamu' ? [{ name: 'Absen', href: '/dashboard/absen', icon: ClipboardCheck }] : []),
    ...(user?.role !== 'tamu' ? [{ name: 'Notifikasi', href: '/dashboard/notifikasi', icon: Bell }] : []),
    { name: 'Profil', href: '/dashboard/profil', icon: User },
  ];

  const userRoleLower = (user?.role || '').toLowerCase();
  if (userRoleLower.includes('petugas')) {
    const showKeb = userRoleLower.includes('kebersihan') || userRoleLower === 'petugas_umum' || userRoleLower === 'petugas';
    const showInv = userRoleLower.includes('inventaris') || userRoleLower.includes('sarpras') || userRoleLower === 'petugas_umum' || userRoleLower === 'petugas';
    navItems = [
      { name: 'Beranda', href: '/dashboard', icon: Home },
      ...(showKeb ? [{ name: 'Kebersihan', href: '/dashboard/kebersihan', icon: Trash2 }] : []),
      ...(showInv ? [{ name: 'Inventaris', href: '/dashboard/inventaris', icon: Archive }] : []),
      { name: 'Profil', href: '/dashboard/profil', icon: User },
    ];
  }

  const isTamu = user?.role === 'tamu';

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

    // Load avatar from localStorage
    const savedAvatar = localStorage.getItem('user_avatar');
    if (savedAvatar) setSidebarAvatar(savedAvatar);
    const handleAvatarUpdated = () => {
      const updated = localStorage.getItem('user_avatar');
      setSidebarAvatar(updated);
    };
    window.addEventListener('avatar-updated', handleAvatarUpdated);
    window.addEventListener('storage', handleAvatarUpdated);

    // PWA Install logic for sidebar
    const checkPwa = () => {
      if ((window as any).deferredPrompt) {
        setPwaInstallable(true);
      }
    };
    checkPwa();
    window.addEventListener('pwa-available', checkPwa);
    window.addEventListener('pwa-closed', checkPwa); // Even if closed on screen, we want it in sidebar

    return () => {
      window.removeEventListener('fingerprint-registered', handleFingerprintRegistered);
      window.removeEventListener('avatar-updated', handleAvatarUpdated);
      window.removeEventListener('storage', handleAvatarUpdated);
      window.removeEventListener('pwa-available', checkPwa);
      window.removeEventListener('pwa-closed', checkPwa);
    };
  }, []);

  const [hasAlumniTunggakan, setHasAlumniTunggakan] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'staff') {
      fetch('/api/jadwal')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setUserSchedules(data.data);
          }
        })
        .catch(console.error);
    }

    if (user && user.role === 'wali_alumni') {
      fetch('/api/billing')
        .then(res => res.json())
        .then(data => {
          if (data.success && Number(data.total_belum) > 0) {
            setHasAlumniTunggakan(true);
          } else {
            setHasAlumniTunggakan(false);
          }
        })
        .catch(console.error);
    }
  }, [user]);

  const hasQuran = userSchedules.some(s => s.tipe === 'quran');
  const hasMadin = userSchedules.some(s => s.tipe === 'madin');
  const hasKegiatan = userSchedules.some(s => s.tipe === 'kegiatan');

  const isPengasuhRole = userRoleLower.includes('pengasuh') || userRoleLower.includes('pengurus') || !!user?.is_pengasuh || !!user?.isPengasuh || !!user?.is_pengurus_asrama || !!user?.isPengurusAsrama;
  // canAccessBilling: wali_alumni HANYA bisa akses billing jika masih punya tunggakan
  const canAccessBilling = ['admin', 'wali_murid'].includes(userRoleLower)
    || (userRoleLower === 'wali_alumni' && hasAlumniTunggakan)
    || userRoleLower.includes('pengasuh') || !!user?.is_pengasuh || !!user?.isPengasuh;

  const showQuranMadin = user?.role === 'admin' || user?.role === 'staff' || hasQuran || hasMadin;
  const showKamarAsrama = userRoleLower === 'admin' || userRoleLower === 'staff' || isPengasuhRole || hasKegiatan;
  const showDataSantri = userRoleLower === 'admin' || userRoleLower === 'staff' || isPengasuhRole || hasQuran || hasMadin || hasKegiatan;
  const showDataGuru = userRoleLower === 'admin' || userRoleLower === 'staff' || isPengasuhRole || hasQuran || hasMadin || hasKegiatan;

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
      <header className="bg-gradient-to-r from-green-900 via-green-800 to-gray-900 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 text-white py-1.5 px-4 shadow-lg sticky top-0 z-50 flex justify-between items-center rounded-b-2xl transition-colors duration-300 relative border-b border-green-700/30">
        <Link href="/dashboard" className="flex items-center gap-3 z-10 hover:opacity-80 transition-opacity" aria-label="Kembali ke Dashboard">
          <div className="bg-white rounded-xl flex items-center justify-center shadow-inner h-11 px-2 py-1">
            <img src="/logo.png" alt="Logo" className="h-full w-auto object-contain" />
          </div>
        </Link>

        {/* Tulisan Arab di Tengah Navbar (Selalu tampil, disesuaikan untuk mobile) */}
        <Link href="/dashboard" className="absolute left-1/2 transform -translate-x-1/2 z-0 text-center flex flex-col items-center justify-center w-[75%] sm:w-auto max-w-sm mt-0.5 hover:opacity-80 transition-opacity" aria-label="Kembali ke Dashboard">
          <h2 className="text-[clamp(1.4rem,5.5vw,2.5rem)] leading-tight sm:text-2xl lg:text-3xl font-diwani text-green-100/90 dark:text-gray-300 tracking-[0.05em] drop-shadow-md whitespace-nowrap" dir="rtl">
            المعهد مطالع الأنوار الإسلامي
          </h2>
          <p className="text-[12px] sm:text-sm text-green-400 font-bold tracking-widest mt-1 drop-shadow-sm uppercase" style={{ fontFamily: '"Courier New", Courier, monospace' }}>Salam Mawar</p>
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
                      <div className="p-4 space-y-3">
                        <div>
                          <span className="text-[10px] bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 font-bold px-2 py-0.5 rounded-full uppercase">
                            {activeSchedule.tipe}
                          </span>
                          <p className="font-bold text-gray-800 dark:text-gray-100 text-sm mt-1">{activeSchedule.nama_kegiatan || activeSchedule.nama_kelas}</p>
                          <p className="text-gray-500 dark:text-gray-400 text-xs">Pukul {activeSchedule.jam_mulai} - {activeSchedule.jam_selesai}</p>
                        </div>
                        <Link href="/dashboard/absen" onClick={() => setShowNotif(false)} className="block w-full text-center bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 rounded-xl transition-colors">
                          Mulai Absensi
                        </Link>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-amber-600 dark:bg-amber-700 p-3 text-white">
                        <h4 className="font-bold text-sm flex items-center gap-2"><AlertTriangle size={16} /> Pengingat Guru Belum Absen</h4>
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
                <>
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border border-green-800 dark:border-gray-800 sm:hidden z-10"></span>
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping opacity-75 sm:hidden"></span>
                </>
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
                <div
                  className={`${sidebarAvatar ? 'w-10 h-10 rounded-full overflow-hidden border-2 border-white/40 flex-shrink-0' : 'bg-white p-1.5 rounded-full'} ${sidebarAvatar ? 'cursor-pointer hover:ring-2 hover:ring-white/60 transition-all' : ''}`}
                  onClick={() => sidebarAvatar && setShowAvatarFull(true)}
                  title={sidebarAvatar ? 'Lihat foto profil' : ''}
                >
                  {sidebarAvatar ? (
                    <img src={sidebarAvatar} alt="Foto Profil" className="w-full h-full object-cover" />
                  ) : (
                    <User size={24} className="text-green-800" />
                  )}
                </div>
                <div>
                  <p className="font-bold leading-tight capitalize">{user?.real_name || user?.username || 'Memuat...'}</p>
                  <p className="text-[10px] text-green-200 uppercase">
                    {[
                      user?.role === 'staff'
                        ? (user?.asrama === 'Putra' ? '👳‍♂️ Staff Putra' : user?.asrama === 'Putri' ? '🧕 Staff Putri' : '🌐 Staff Umum')
                        : user?.role,
                      (user?.is_pengasuh || user?.isPengasuh) && user?.role !== 'pengasuh' ? 'Pengasuh' : null,
                      (user?.is_pengurus_asrama || user?.isPengurusAsrama) && user?.role !== 'pengurus_asrama' ? 'Pengurus Asrama' : null
                    ].filter(Boolean).join(' + ')}
                  </p>
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

            {/* Banner Mode Tamu */}
            {isTamu && (
              <div className="px-4 mb-5">
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-3 shadow-sm">
                  <div className="flex gap-3 items-start">
                    <div className="bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-300 p-2 rounded-xl flex-shrink-0">
                      <UserRound size={18} />
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-gray-800 dark:text-gray-200 mb-1">Mode Tamu</h5>
                      <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-tight">Anda masuk sebagai tamu. Hanya dapat melihat struktur menu tanpa akses data.</p>
                      <button
                        onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/'; }}
                        className="mt-2 inline-block bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Masuk dengan Akun
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Banner Reminder Sidik Jari — hanya tampil untuk role yg punya fitur WebAuthn di halaman profil */}
            {webAuthnSupported && user && !user.has_fingerprint && (['guru', 'wali_murid'].includes(user.role)) && (
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

            {/* Banner PWA Install */}
            {pwaInstallable && (
              <div className="px-4 mb-5">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 border border-green-200 dark:border-green-800/50 rounded-2xl p-3 shadow-sm relative overflow-hidden">
                  <div className="flex gap-3 items-start">
                    <div className="bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-300 p-2 rounded-xl flex-shrink-0">
                      <Download size={18} />
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-gray-800 dark:text-gray-200 mb-1">Install Aplikasi SALAM</h5>
                      <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-tight mb-2">Tambahkan ke layar utama HP Anda agar lebih cepat diakses seperti aplikasi biasa.</p>
                      <button
                        onClick={() => {
                          const e = (window as any).deferredPrompt;
                          if (e) {
                            e.prompt();
                            e.userChoice.then((choiceResult: any) => {
                              if (choiceResult.outcome === 'accepted') {
                                setPwaInstallable(false);
                              }
                            });
                          }
                        }}
                        className="inline-block bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Install Sekarang
                      </button>
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

          {/* ========================================================================= */}
          {/* 1. GRUP MENU UTAMA (Collapsible Accordion — Default Tertutup)            */}
          {/* ========================================================================= */}
          <div className="px-3 mb-3">
            <button
              onClick={() => toggleSection('menuUtama')}
              className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-100 dark:border-gray-700/60 shadow-sm group"
              aria-label="Toggle Menu Utama"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-xl bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 group-hover:scale-105 transition-transform">
                  <Layers size={16} />
                </div>
                <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                  Menu Utama
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform duration-300 ${
                    openSections.menuUtama ? 'rotate-180 text-green-600 dark:text-green-400' : 'rotate-0'
                  }`}
                />
              </div>
            </button>

            {openSections.menuUtama && (
              <ul className="space-y-1 mt-2 pl-1 pr-1 animate-[fadeIn_0.2s_ease-out]">
                <li>
                  <Link href="/dashboard" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold' : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium'}`}>
                    <Home size={18} /> <span className="text-sm">Dashboard</span>
                  </Link>
                </li>
                {/* Khusus Petugas Kebersihan / Kebersihan Umum / Petugas Umum */}
                {((user?.role || '').toLowerCase().includes('kebersihan') || (user?.role || '').toLowerCase() === 'petugas_umum' || (user?.role || '').toLowerCase() === 'petugas') && (
                  <li>
                    <Link href="/dashboard/kebersihan" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname.startsWith('/dashboard/kebersihan') ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-bold'}`}>
                      <Trash2 size={18} /> <span className="text-sm">Kebersihan & Sampah</span>
                    </Link>
                  </li>
                )}
                {/* Khusus Petugas Inventaris / Sarpras / Petugas Umum */}
                {((user?.role || '').toLowerCase().includes('inventaris') || (user?.role || '').toLowerCase().includes('sarpras') || (user?.role || '').toLowerCase() === 'petugas_umum' || (user?.role || '').toLowerCase() === 'petugas') && (
                  <li>
                    <Link href="/dashboard/inventaris" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname.startsWith('/dashboard/inventaris') ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold'}`}>
                      <Archive size={18} /> <span className="text-sm">Inventaris Asrama</span>
                    </Link>
                  </li>
                )}
                {/* Khusus Petugas Pemanggilan Santri */}
                {((user?.role || '').toLowerCase().includes('panggilan') || (user?.role || '').toLowerCase() === 'petugas_umum' || (user?.role || '').toLowerCase() === 'petugas') && (
                  <li>
                    <Link href="/dashboard/panggilan" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname.startsWith('/dashboard/panggilan') ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold' : 'hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold'}`}>
                      <Megaphone size={18} /> <span className="text-sm">Panggilan TOA</span>
                    </Link>
                  </li>
                )}
                {!(user?.role || '').toLowerCase().includes('petugas') && (
                  <>
                    {['admin', 'staff', 'pengurus_asrama', 'pengasuh', 'guru'].includes(userRoleLower) || isPengasuhRole ? (
                      <li>
                        <Link href="/dashboard/absen" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/absen' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold' : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 font-bold'}`}>
                          <ClipboardCheck size={18} /> <span className="text-sm">Input Absensi</span>
                        </Link>
                      </li>
                    ) : null}
                    {['admin', 'staff', 'pengurus_asrama'].includes(userRoleLower) || isPengasuhRole ? (
                      <li>
                        <Link href="/dashboard/jadwal" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/jadwal' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold'}`}>
                          <Calendar size={18} /> <span className="text-sm">Kelola Jadwal</span>
                        </Link>
                      </li>
                    ) : null}
                    <li>
                      <Link href="/dashboard/tabel-jadwal" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/tabel-jadwal' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 font-bold' : 'hover:bg-teal-50 dark:hover:bg-teal-900/20 text-teal-600 dark:text-teal-400 font-bold'}`}>
                        <CalendarDays size={18} /> <span className="text-sm">Tabel Jadwal</span>
                      </Link>
                    </li>
                    {['admin', 'staff', 'pengurus_asrama', 'pengasuh', 'guru'].includes(userRoleLower) || isPengasuhRole ? (
                      <li>
                        <Link href="/dashboard/rekapitulasi" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/rekapitulasi' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold' : 'hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-bold'}`}>
                          <FileText size={18} /> <span className="text-sm">Rekapitulasi Absensi</span>
                        </Link>
                      </li>
                    ) : null}
                    {(['admin', 'staff'].includes(userRoleLower) || isPengasuhRole) && (
                      <>
                        <li>
                          <Link href="/dashboard/absen-guru" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/absen-guru' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-bold'}`}>
                            <ClipboardList size={18} /> <span className="text-sm">Absen Dewan Guru</span>
                          </Link>
                        </li>
                        <li>
                          <Link href="/dashboard/jadwal-dewan-guru" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/jadwal-dewan-guru' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 font-bold' : 'hover:bg-teal-50 dark:hover:bg-teal-900/20 text-teal-600 dark:text-teal-400 font-bold'}`}>
                            <CalendarDays size={18} /> <span className="text-sm">Jadwal Dewan Guru</span>
                          </Link>
                        </li>
                        <li>
                          <Link href="/dashboard/qr-dewan-guru" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/qr-dewan-guru' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold'}`}>
                            <QrCode size={18} /> <span className="text-sm">QR Code Dewan Guru</span>
                          </Link>
                        </li>
                      </>
                    )}
                    <li>
                      <Link href="/dashboard/jurnal" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/jurnal' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold'}`}>
                        <BookOpen size={18} /> <span className="text-sm">Jurnal Kegiatan</span>
                      </Link>
                    </li>
                    <li>
                      <Link href="/dashboard/jadwal-alumni" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/jadwal-alumni' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold' : 'hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-bold'}`}>
                        <CalendarDays size={18} /> <span className="text-sm">Jadwal Alumni</span>
                      </Link>
                    </li>
                    {canAccessBilling && (
                      <li>
                        <Link href="/dashboard/billing" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/billing' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold' : 'hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold'}`}>
                          <CreditCard size={18} /> <span className="text-sm">Info Tagihan</span>
                        </Link>
                      </li>
                    )}
                    {['admin', 'pengurus_asrama', 'pengasuh', 'staff', 'guru'].includes(userRoleLower) || isPengasuhRole ? (
                      <li>
                        <Link href="/dashboard/scan-absen" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/scan-absen' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold' : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 font-bold'}`}>
                          <QrCode size={18} /> <span className="text-sm">Scan Absensi</span>
                        </Link>
                      </li>
                    ) : null}
                    <li>
                      <Link href="/dashboard/ketertiban" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/ketertiban' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold' : 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 font-bold'}`}>
                        <FileWarning size={18} /> <span className="text-sm">Ketertiban Murid</span>
                      </Link>
                    </li>
                    {/* Panggilan Santri */}
                    {(['admin', 'staff', 'pengurus_asrama', 'pengasuh', 'wali_murid'].includes(userRoleLower) || isPengasuhRole) ? (
                      <li>
                        <Link href="/dashboard/panggilan" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname.startsWith('/dashboard/panggilan') ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold' : 'hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold'}`}>
                          <Megaphone size={18} /> <span className="text-sm">Panggilan Santri</span>
                        </Link>
                      </li>
                    ) : null}
                    {/* Kebersihan & Sampah - di bawah Ketertiban Murid */}
                    {['admin', 'staff', 'pengurus_asrama', 'pengasuh', 'guru', 'petugas', 'petugas_umum', 'petugas_sarpras', 'petugas_kebersihan', 'petugas_kebersihan_umum'].includes(userRoleLower) || isPengasuhRole ? (
                      <li>
                        <Link href="/dashboard/kebersihan" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname.startsWith('/dashboard/kebersihan') ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-bold'}`}>
                          <Trash2 size={18} /> <span className="text-sm">Kebersihan & Sampah</span>
                        </Link>
                      </li>
                    ) : null}
                  </>
                )}
              </ul>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 2. GRUP MANAJEMEN DATA (Collapsible Accordion — Default Tertutup)         */}
          {/* ========================================================================= */}
          {!isTamu && !(user?.role || '').toLowerCase().includes('petugas') && (
            <div className="px-3 mb-3">
              <button
                onClick={() => toggleSection('manajemenData')}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-100 dark:border-gray-700/60 shadow-sm group"
                aria-label="Toggle Manajemen Data"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 group-hover:scale-105 transition-transform">
                    <Database size={16} />
                  </div>
                  <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                    Manajemen Data
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform duration-300 ${
                      openSections.manajemenData ? 'rotate-180 text-blue-600 dark:text-blue-400' : 'rotate-0'
                    }`}
                  />
                </div>
              </button>

              {openSections.manajemenData && (
                <ul className="space-y-1 mt-2 pl-1 pr-1 animate-[fadeIn_0.2s_ease-out]">
                  {showDataGuru && (
                    <li>
                      <Link href="/dashboard/guru" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/guru' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold'}`}>
                        <UserCog size={18} /> <span className="text-sm">Data Guru & Pembina</span>
                      </Link>
                    </li>
                  )}
                  {showDataSantri && (
                    <li>
                      <Link href="/dashboard/murid" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/murid' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold' : 'hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold'}`}>
                        <Users size={18} /> <span className="text-sm">Data Santri</span>
                      </Link>
                    </li>
                  )}
                  {['admin', 'staff', 'pengurus_asrama'].includes(userRoleLower) && (
                    <li>
                      <Link
                        href="/dashboard/pairing"
                        onClick={() => setShowSidebar(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                          pathname.startsWith('/dashboard/pairing') || pathname.startsWith('/dashboard/face-enrollment')
                            ? 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 font-bold'
                            : 'hover:bg-cyan-50 dark:hover:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 font-bold'
                        }`}
                      >
                        <QrCode size={18} /> <span className="text-sm">Pairing & Face AI</span>
                      </Link>
                    </li>
                  )}
                  {(user?.role === 'admin' || user?.role === 'staff') && (
                    <li>
                      <Link href="/dashboard/alumni" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/alumni' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold' : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 font-bold'}`}>
                        <GraduationCap size={18} /> <span className="text-sm">Data Alumni</span>
                      </Link>
                    </li>
                  )}
                  {showQuranMadin && (
                    <li>
                      <Link href="/dashboard/kelas" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/kelas' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 font-bold' : 'hover:bg-teal-50 dark:hover:bg-teal-900/20 text-teal-600 dark:text-teal-400 font-bold'}`}>
                        <BookOpen size={18} /> <span className="text-sm">Manajemen Kelas</span>
                      </Link>
                    </li>
                  )}
                  {showQuranMadin && (
                    <li>
                      <Link href="/dashboard/kurikulum" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/kurikulum' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold'}`}>
                        <BookOpen size={18} /> <span className="text-sm">Kurikulum Madin</span>
                      </Link>
                    </li>
                  )}
                  {showKamarAsrama && (
                    <li>
                      <Link href="/dashboard/kamar" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/dashboard/kamar' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold'}`}>
                        <Home size={18} /> <span className="text-sm">Kamar Asrama</span>
                      </Link>
                    </li>
                  )}
                  {/* Inventaris Asrama */}
                  {['admin', 'staff', 'petugas_sarpras', 'pengurus_asrama', 'pengasuh', 'guru', 'petugas', 'petugas_umum', 'petugas_inventaris', 'petugas_inventaris_umum'].includes(userRoleLower) || isPengasuhRole ? (
                    <li>
                      <Link href="/dashboard/inventaris" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname.startsWith('/dashboard/inventaris') ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold'}`}>
                        <Archive size={18} /> <span className="text-sm">Inventaris Asrama</span>
                      </Link>
                    </li>
                  ) : null}
                </ul>
              )}
            </div>
          )}


          {/* ========================================================================= */}
          {/* 3. GRUP APLIKASI LAINNYA (Tautan Ekosistem Pesantren)                     */}
          {/* ========================================================================= */}
          <div className="px-3 mb-3">
            <button
              onClick={() => toggleSection('aplikasiLainnya')}
              className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-100 dark:border-gray-700/60 shadow-sm group"
              aria-label="Toggle Aplikasi Lainnya"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 group-hover:scale-105 transition-transform">
                  <Globe size={16} />
                </div>
                <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider whitespace-nowrap">
                  Aplikasi Lainnya
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform duration-300 ${
                    openSections.aplikasiLainnya ? 'rotate-180 text-amber-600 dark:text-amber-400' : 'rotate-0'
                  }`}
                />
              </div>
            </button>

            {openSections.aplikasiLainnya && (
              <ul className="space-y-1 mt-2 pl-1 pr-1 animate-[fadeIn_0.2s_ease-out]">
                <li>
                  <a
                    href="https://ppmawar.or.id/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowSidebar(false)}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-gray-700 dark:text-gray-200 transition-colors font-medium group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Globe size={17} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-800 dark:text-gray-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 truncate">
                          PP. MATHOLI'UL ANWAR
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                          Website Resmi Pesantren
                        </div>
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 shrink-0" />
                  </a>
                </li>

                <li>
                  <a
                    href="https://play.google.com/store/apps/details?id=id.quizb.bukuwirid"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowSidebar(false)}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/30 text-gray-700 dark:text-gray-200 transition-colors font-medium group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Smartphone size={17} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 truncate">
                          Mafatihul Akhyar (Beta)
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                          Aplikasi Wirid &amp; Doa Santri
                        </div>
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0" />
                  </a>
                </li>

                <li>
                  <a
                    href="https://app.mamawar.sch.id/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowSidebar(false)}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-gray-700 dark:text-gray-200 transition-colors font-medium group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <Sparkles size={17} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-800 dark:text-gray-100 group-hover:text-rose-700 dark:group-hover:text-rose-400 truncate">
                          Rose App
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                          MA Matholi'ul Anwar
                        </div>
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-gray-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 shrink-0" />
                  </a>
                </li>
              </ul>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 4. GRUP MANAJEMEN SISTEM / NOTIFIKASI                                    */}
          {/* ========================================================================= */}
          {['admin', 'staff'].includes(userRoleLower) && (
            <div className="px-3 mb-3">
              <button
                onClick={() => toggleSection('manajemenSistem')}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-100 dark:border-gray-700/60 shadow-sm group"
                aria-label="Toggle Manajemen Sistem"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 group-hover:scale-105 transition-transform">
                    {userRoleLower === 'admin' ? <Shield size={16} /> : <MessageSquare size={16} />}
                  </div>
                  <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider whitespace-nowrap">
                    {userRoleLower === 'admin' ? 'Manajemen Sistem' : 'Pusat Pesan & WA'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform duration-300 ${
                      openSections.manajemenSistem ? 'rotate-180 text-purple-600 dark:text-purple-400' : 'rotate-0'
                    }`}
                  />
                </div>
              </button>

              {openSections.manajemenSistem && (
                <ul className="space-y-1 mt-2 pl-1 pr-1 animate-[fadeIn_0.2s_ease-out]">
                  {userRoleLower === 'admin' && (
                    <li>
                      <Link href="/dashboard/users" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors font-medium ${pathname === '/dashboard/users' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : ''}`}>
                        <Users size={18} /> <span className="text-sm">Manajemen Pengguna</span>
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link href="/dashboard/notifikasi" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors font-medium ${pathname === '/dashboard/notifikasi' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : ''}`}>
                      <MessageSquare size={18} /> <span className="text-sm">Notifikasi & WhatsApp</span>
                    </Link>
                  </li>
                  {userRoleLower === 'admin' && (
                    <>
                      <li>
                        <Link href="/dashboard/audit" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors font-medium ${pathname === '/dashboard/audit' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : ''}`}>
                          <Shield size={18} /> <span className="text-sm">Audit Log</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/dashboard/settings" onClick={() => setShowSidebar(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors font-medium ${pathname === '/dashboard/settings' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : ''}`}>
                          <Settings size={18} /> <span className="text-sm">Pengaturan</span>
                        </Link>
                      </li>
                    </>
                  )}
                </ul>
              )}
            </div>
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
      <main className="flex-1 p-4 pb-28">
        {/* Banner Tamu di halaman */}
        {isTamu && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl text-amber-800 dark:text-amber-300">
            <UserRound size={16} className="shrink-0" />
            <span className="text-xs font-semibold">Mode Tamu — Anda hanya dapat melihat tampilan aplikasi. Tidak ada data yang ditampilkan.</span>
            <button
              onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/'; }}
              className="ml-auto shrink-0 text-[10px] font-bold bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Login
            </button>
          </div>
        )}
        {children}
      </main>

      {/* Navigasi Bawah (Mobile App Style) */}
      <nav className="fixed bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] dark:shadow-[0_-5px_15px_rgba(0,0,0,0.3)] z-50 rounded-t-3xl pb-safe transition-colors duration-300">
        <div className="flex justify-around items-center py-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href} className="flex flex-col items-center gap-0.5 w-16 group transition-all duration-300">
                <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 shadow-sm scale-105' : 'text-gray-400 dark:text-gray-500 group-hover:bg-gray-50 dark:group-hover:bg-gray-700'}`}>
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

      {/* Modal Fullscreen Foto Profil */}
      {showAvatarFull && sidebarAvatar && (
        <div
          className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setShowAvatarFull(false)}
        >
          <div className="relative max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowAvatarFull(false)}
              className="absolute -top-3 -right-3 bg-white text-gray-800 rounded-full p-1.5 shadow-lg z-10 hover:bg-gray-100 transition-colors"
              aria-label="Tutup"
            >
              <X size={18} />
            </button>
            <img
              src={sidebarAvatar}
              alt="Foto Profil"
              className="w-full rounded-2xl shadow-2xl border-4 border-white/20 object-cover"
            />
            <p className="text-center text-white/70 text-xs mt-3 font-medium capitalize">
              {user?.real_name || user?.username}
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
