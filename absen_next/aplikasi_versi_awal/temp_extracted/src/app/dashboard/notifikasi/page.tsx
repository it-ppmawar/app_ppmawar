'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { Bell, AlertTriangle, CheckCircle2, MessageCircle, Phone, Search, RefreshCw, Users, Check, Smartphone, Info, ChevronDown, ChevronUp, Zap, Settings2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

function NotifikasiContent() {
  const [showSettingsGuide, setShowSettingsGuide] = useState(false);
  const [showChromeGuide, setShowChromeGuide] = useState(false);
  const [muridList, setMuridList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const searchParams = useSearchParams();
  const initKegiatan = searchParams.get('kegiatan') as 'madin' | 'quran' | 'kamar' || 'quran';
  const initKelas = searchParams.get('kelas') || '';

  // State untuk default pesan WA dinamis
  const [role, setRole] = useState('guru');
  const [tipePesan, setTipePesan] = useState<'madin' | 'quran' | 'kamar'>(initKegiatan);
  const [selectedKategoriId, setSelectedKategoriId] = useState(initKelas);
  const [selectedKategoriNama, setSelectedKategoriNama] = useState('');
  const [statusAbsen, setStatusAbsen] = useState('Hadir');
  const [listKategori, setListKategori] = useState<any[]>([]);
  const [loadingKategori, setLoadingKategori] = useState(false);

  // State untuk Siaran WA ke Guru (Admin/Staff)
  const [guruList, setGuruList] = useState<any[]>([]);
  const [tipeGuru, setTipeGuru] = useState<'madin' | 'quran' | 'kamar'>('quran');
  const [guruSearch, setGuruSearch] = useState('');
  const [selectedGuruId, setSelectedGuruId] = useState('');

  // Tab aktif pada kartu terpadu Admin/Staff: 'auto' | 'manual'
  const [guruCardTab, setGuruCardTab] = useState<'auto' | 'manual'>('auto');

  const isRemindParam = searchParams.get('remind') === 'true';
  const [activeReminders, setActiveReminders] = useState<any[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [sentReminderIds, setSentReminderIds] = useState<Record<string, boolean>>({});
  const [subTabAuto, setSubTabAuto] = useState<'semua' | 'quran' | 'madin' | 'kamar'>('semua');

  const defaultWaliTemplate = `Assalamu'alaikum Wr. Wb. Bapak/Ibu Wali dari Ananda *{nama_santri}*.\n\nKami dari pengurus PPMA menginformasikan perkembangan kehadiran ananda hari ini:\n\n* Kegiatan: {kegiatan}\n* Tempat/Kelas: {kelas}\n* Status Absensi: *{status}*\n\nDemikian informasi yang dapat kami sampaikan. Atas perhatiannya kami ucapkan terima kasih.\n\nWassalamu'alaikum Wr. Wb.`;

  const defaultGuruTemplate = `Assalamu'alaikum Wr. Wb. Ustadz/Ustadzah *{nama_guru}*.\n\nKami dari pengurus PPMA menginformasikan pengingat jadwal mengajar/tugas Anda:\n\n* Kategori: {kegiatan}\n* Tempat/Kelas: {kelas}\n* Jam: {jam}\n\nMohon untuk mengisi absensi tepat waktu. Atas perhatiannya kami ucapkan terima kasih.\n\nWassalamu'alaikum Wr. Wb.`;

  const [pesanWaliTemplate, setPesanWaliTemplate] = useState(defaultWaliTemplate);
  const [pesanGuruTemplate, setPesanGuruTemplate] = useState(defaultGuruTemplate);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedWali = localStorage.getItem('wa_template_wali');
      if (storedWali) setPesanWaliTemplate(storedWali);

      const storedGuru = localStorage.getItem('wa_template_guru');
      if (storedGuru) setPesanGuruTemplate(storedGuru);

      try {
        const storageKey = 'wa_reminded_teachers';
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          const now = new Date().getTime();
          if (now - parsed.timestamp > 10800000) {
            localStorage.removeItem(storageKey);
            setSentReminderIds({});
          } else {
            setSentReminderIds(parsed.data || {});
          }
        }
      } catch (e) {
        setSentReminderIds({});
      }
    }

    // Ambil detail profil untuk mendapatkan role
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setRole(data.user.role);
        }
      })
      .catch(() => {});

    // Ambil list santri untuk WA
    fetch('/api/whatsapp-list')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMuridList(data.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Ambil list guru untuk WA Guru (Admin/Staff)
    fetch('/api/guru')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setGuruList(data.data);
        }
      })
      .catch(() => {});

    // Scroll to reminder section if param remind=true
    if (isRemindParam) {
      setTimeout(() => {
        const el = document.getElementById('pengingat-guru-aktif');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    }
  }, [isRemindParam]);

  const fetchActiveReminders = () => {
    setLoadingReminders(true);
    fetch(`/api/jadwal/active?t=${Date.now()}`)
      .then(async res => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error('[API ERROR] /api/jadwal/active status:', res.status, errData);
          throw new Error(errData.error || `HTTP error ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.success) {
          setActiveReminders(data.data || []);
        } else {
          console.error('[API ERROR] success is false:', data);
        }
        setLoadingReminders(false);
      })
      .catch((err) => {
        console.error('[FETCH ERROR] failed to fetch active reminders:', err);
        setLoadingReminders(false);
      });
  };

  useEffect(() => {
    if (role === 'admin' || role === 'staff') {
      fetchActiveReminders();
    }
  }, [role]);

  const markReminderAsSent = (reminderKey: string) => {
    setSentReminderIds(prev => {
      const newState = { ...prev, [reminderKey]: true };
      localStorage.setItem('wa_reminded_teachers', JSON.stringify({
        timestamp: new Date().getTime(),
        data: newState
      }));
      return newState;
    });
  };

  // Fetch daftar kelas/kamar sesuai tipePesan (terbatasi dinamis oleh API kelas sesuai role yang login)
  useEffect(() => {
    setLoadingKategori(true);
    fetch(`/api/kelas?type=${tipePesan === 'kamar' ? 'kamar' : tipePesan}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setListKategori(data.data);
          if (data.data.length > 0) {
            // Jika ada initKelas, gunakan, jika tidak pakai yang pertama
            if (initKelas && data.data.find((k:any) => k.id.toString() === initKelas)) {
                setSelectedKategoriId(initKelas);
                setSelectedKategoriNama(data.data.find((k:any) => k.id.toString() === initKelas).nama);
            } else {
                setSelectedKategoriId(data.data[0].id.toString());
                setSelectedKategoriNama(data.data[0].nama);
            }
          } else {
            setSelectedKategoriId('');
            setSelectedKategoriNama('');
          }
        } else {
          setListKategori([]);
          setSelectedKategoriId('');
          setSelectedKategoriNama('');
        }
        setLoadingKategori(false);
      })
      .catch(() => {
        setListKategori([]);
        setSelectedKategoriId('');
        setSelectedKategoriNama('');
        setLoadingKategori(false);
      });
  }, [tipePesan]);

  const handleKategoriChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedKategoriId(val);
    const found = listKategori.find(k => k.id.toString() === val);
    if (found) setSelectedKategoriNama(found.nama);
  };

  const [sentWaIds, setSentWaIds] = useState<Record<number, boolean>>({});

  // Load state from localStorage on mount and clear if older than 3 hours
  useEffect(() => {
    try {
      const storageKey = `wa_sent_${tipePesan}_${selectedKategoriId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        const now = new Date().getTime();
        // Cek apakah data sudah lebih dari 3 jam (3 * 60 * 60 * 1000 = 10800000 ms)
        if (now - parsed.timestamp > 10800000) {
          localStorage.removeItem(storageKey);
          setSentWaIds({});
        } else {
          setSentWaIds(parsed.data || {});
        }
      } else {
        setSentWaIds({});
      }
    } catch (e) {
      setSentWaIds({});
    }
  }, [tipePesan, selectedKategoriId]);

  const markAsSent = (muridId: number) => {
    setSentWaIds(prev => {
      const newState = { ...prev, [muridId]: true };
      const storageKey = `wa_sent_${tipePesan}_${selectedKategoriId}`;
      localStorage.setItem(storageKey, JSON.stringify({
        timestamp: new Date().getTime(),
        data: newState
      }));
      return newState;
    });
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    let p = phone.replace(/\D/g, '');
    if (p.startsWith('0')) p = '62' + p.substring(1);
    return p;
  };

  const getWaLink = (murid: any) => {
    const phone = formatPhoneNumber(murid.no_wali);
    if (!phone) return '#';

    let tipeLabel = tipePesan === 'madin' ? 'Kegiatan Madin' : tipePesan === 'quran' ? "Kegiatan Al-Qur'an" : 'Kegiatan Asrama';
    let tempatLabel = selectedKategoriNama ? `${selectedKategoriNama}` : '';

    const text = pesanWaliTemplate
      .replace(/{nama_santri}/g, murid.nama)
      .replace(/{kegiatan}/g, tipeLabel)
      .replace(/{kelas}/g, tempatLabel || '-')
      .replace(/{status}/g, statusAbsen);

    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  // Jika diakses setelah absen, bisa filter otomatis by kelas, tapi untuk sekarang kita filter dari list murid
  const filteredByKelas = selectedKategoriId 
    ? muridList.filter(m => (m.kelas_quran_id?.toString() === selectedKategoriId) || (m.kelas_madin_id?.toString() === selectedKategoriId) || (m.kamar_id?.toString() === selectedKategoriId) || true) // Simplified for demo, backend should ideally filter, but since all murid is loaded, we fallback to all
    : muridList;

  // Hanya tampilkan hasil jika ada pencarian (min 1 karakter) ATAU jika redirect dari absen (punya parameter)
  const isAutoFilter = initKegiatan && initKelas;
  const hasSearch = search.trim().length > 0 || isAutoFilter;
  const filteredMurid = hasSearch
    ? muridList.filter(m => {
        // Jika ada pencarian, cocokkan nama
        if (search.trim().length > 0) {
            return m.nama?.toLowerCase().includes(search.toLowerCase()) ||
                   m.nama_wali?.toLowerCase().includes(search.toLowerCase());
        }
        // Jika dari auto filter, tampilkan semua (backend /api/whatsapp-list bisa ditingkatkan untuk filter ini nanti)
        return true; 
    })
    : [];


  const selectedGuruObj = guruList.find(g => g.guru_id.toString() === selectedGuruId);
  
  const [selectedJadwalGuru, setSelectedJadwalGuru] = useState('');

  const getWaGuruLink = (guru: any) => {
    const phone = formatPhoneNumber(guru.whatsapp);
    if (!phone) return '#';

    let tipeLabel = tipeGuru === 'madin' ? 'Madin' : tipeGuru === 'quran' ? "Al-Qur'an" : 'Asrama';
    let tempatLabel = selectedJadwalGuru || 'Belum ditentukan';

    const text = pesanGuruTemplate
      .replace(/{nama_guru}/g, guru.nama)
      .replace(/{kegiatan}/g, tipeLabel)
      .replace(/{kelas}/g, tempatLabel)
      .replace(/{jam}/g, 'Sesuai Jadwal');

    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const getWaGuruReminderLink = (reminder: any) => {
    const phone = formatPhoneNumber(reminder.guru_whatsapp);
    if (!phone) return '#';

    let tipeLabel = reminder.tipe === 'madin' ? 'Madin' : reminder.tipe === 'quran' ? "Al-Qur'an" : 'Asrama';
    const text = pesanGuruTemplate
      .replace(/{nama_guru}/g, reminder.guru_nama)
      .replace(/{kegiatan}/g, tipeLabel)
      .replace(/{kelas}/g, reminder.kelas_nama)
      .replace(/{jam}/g, `${reminder.jam_mulai.substring(0, 5)} - ${reminder.jam_selesai.substring(0, 5)}`);

    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  // Get options for Jadwal based on selected Guru and Tipe
  let jadwalOptions: string[] = [];
  if (selectedGuruObj) {
    if (tipeGuru === 'madin') jadwalOptions = selectedGuruObj.kelas_madin || [];
    else if (tipeGuru === 'quran') jadwalOptions = selectedGuruObj.kelas_quran || [];
    else if (tipeGuru === 'kamar') jadwalOptions = selectedGuruObj.kamar || [];
  }

  // Update selectedJadwalGuru when options change
  useEffect(() => {
    if (jadwalOptions.length > 0 && !jadwalOptions.includes(selectedJadwalGuru)) {
      setSelectedJadwalGuru(jadwalOptions[0]);
    } else if (jadwalOptions.length === 0) {
      setSelectedJadwalGuru('');
    }
  }, [jadwalOptions, selectedJadwalGuru]);

  return (
    <div className="max-w-4xl mx-auto animate-[fadeIn_0.5s_ease-out] pb-20">
      <div className="bg-gradient-to-r from-green-800 to-green-900 rounded-2xl p-6 text-white shadow-lg mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Bell className="animate-bounce" /> Pusat Notifikasi</h2>
        <p className="text-green-100 text-sm mt-1">Daftar pemberitahuan dan informasi jadwal.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 text-center mb-6">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Bell className="text-gray-400 dark:text-gray-500" size={32} />
        </div>
        <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2">Push Notifikasi (Perangkat)</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Notifikasi jadwal absensi Anda akan muncul di perangkat ini.</p>
        
        <button 
          onClick={async () => {
            if (typeof window === 'undefined' || !('Notification' in window)) {
              alert('Browser Anda tidak mendukung notifikasi.');
              return;
            }

            const fireTestNotification = async () => {
              const title = 'Tes Notifikasi PPMA';
              const options = {
                body: 'Ini adalah tes notifikasi. Jika Anda melihat ini, berarti fitur Push Notification BEKERJA!',
                icon: '/logo.png',
                badge: '/logo.png',
                vibrate: [200, 100, 200]
              };
              try {
                if ('serviceWorker' in navigator) {
                  // Tambahkan timeout 2 detik agar tidak hang selamanya jika SW belum siap
                  const reg = await Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                  ]).catch(() => null);

                  if (reg) {
                    await reg.showNotification(title, options);
                    alert('Berhasil ditembakkan dari Service Worker! Cek bagian atas layar/laci notifikasi Anda.');
                    setShowSettingsGuide(true);
                    return;
                  }
                }
                
                // Fallback jika Service Worker tidak siap atau tidak ada
                new Notification(title, options);
                alert('Berhasil ditembakkan (API Standar).');
              } catch (err: any) {
                alert('Gagal memunculkan: ' + err.message);
              }
              setShowSettingsGuide(true);
            };

            if (Notification.permission === 'granted') {
              await fireTestNotification();
            } else if (Notification.permission !== 'denied') {
              const p = await Notification.requestPermission();
              if (p === 'granted') {
                alert('Izin diberikan! Menembakkan notifikasi pertama...');
                await fireTestNotification();
              } else {
                alert('Izin notifikasi ditolak.');
              }
            } else {
              alert('Anda sebelumnya telah memblokir notifikasi. Silakan ubah di pengaturan browser.');
            }
          }}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm shadow-md w-full sm:w-auto"
        >
          Tes Izin Notifikasi Perangkat
        </button>

        {showSettingsGuide && (
          <div className="mt-8 text-left bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-5 animate-[slideDown_0.3s_ease-out]">
            <h4 className="font-bold text-orange-800 dark:text-orange-400 mb-2 flex items-center gap-2">
              <AlertTriangle size={18} /> Notifikasi tidak muncul/berbunyi?
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              Jika notifikasi tes tidak muncul di layar atau masuk ke mode <strong>Senyap</strong>, sistem HP Android Anda mungkin memblokirnya. Aplikasi web (PWA) tidak memiliki akses untuk membuka pengaturan HP secara otomatis. Anda harus mengubahnya secara manual:
            </p>
            <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-3 list-decimal pl-4">
              <li className="pl-1">Buka aplikasi <strong>Pengaturan (Settings)</strong> bawaan HP Anda.</li>
              <li className="pl-1">Pilih menu <strong className="text-gray-800 dark:text-gray-200">Aplikasi (Apps)</strong> lalu cari dan pilih <strong>Chrome</strong>.</li>
              <li className="pl-1">Pilih menu <strong className="text-gray-800 dark:text-gray-200">Notifikasi</strong>.</li>
              <li className="pl-1">Pastikan pengaturan <strong>TIDAK</strong> disetel ke Senyap (Silent). Ubah menjadi <strong className="text-green-600 dark:text-green-400">&quot;Izinkan Suara dan Getaran&quot;</strong> atau &quot;Penting&quot;.</li>
            </ol>
            <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg flex gap-3 border border-gray-100 dark:border-gray-700 shadow-sm">
              <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={16} />
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Langkah ini hanya perlu dilakukan satu kali agar notifikasi jadwal mengajar Anda tidak terlewat.</p>
            </div>
          </div>
        )}

        {/* Panduan Notifikasi Chrome PWA */}
        <div className="mt-6 border border-blue-200 dark:border-blue-800/50 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowChromeGuide(!showChromeGuide)}
            className="w-full flex items-center justify-between gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 dark:bg-blue-800/50 p-2 rounded-full">
                <Smartphone size={16} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-bold text-sm text-blue-800 dark:text-blue-300">Ada notifikasi Chrome yang mengganggu?</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">&quot;Ketuk untuk menyalin URL aplikasi ini&quot; — cara mematikannya</p>
              </div>
            </div>
            {showChromeGuide ? <ChevronUp size={16} className="text-blue-500 shrink-0" /> : <ChevronDown size={16} className="text-blue-500 shrink-0" />}
          </button>

          {showChromeGuide && (
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-blue-100 dark:border-blue-800/30 animate-[slideDown_0.3s_ease-out]">
              <div className="flex gap-2 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  Notifikasi <strong>&quot;Ketuk untuk menyalin URL aplikasi ini&quot;</strong> bukan dari aplikasi PPMA — ini adalah notifikasi otomatis dari browser <strong>Chrome</strong> yang muncul saat aplikasi dibuka sebagai PWA (shortcut di layar utama). Kita tidak dapat mematikannya dari dalam aplikasi, namun Anda dapat mematikannya secara manual melalui pengaturan HP.
                </p>
              </div>

              <h5 className="font-bold text-sm text-gray-700 dark:text-gray-200 mb-3">Langkah-langkah mematikan notifikasi tersebut:</h5>
              <ol className="space-y-3">
                <li className="flex gap-3 items-start">
                  <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Buka <strong>Pengaturan</strong> (Settings) bawaan HP Android Anda.</p>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Pilih <strong>Aplikasi</strong> → cari dan pilih <strong>Chrome</strong>.</p>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Pilih <strong>Notifikasi</strong>.</p>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">4</span>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Cari grup notifikasi bernama <strong>&quot;PPMA Absen&quot;</strong> atau <strong>&quot;Aplikasi Web (PWA)&quot;</strong>, lalu <strong>matikan (toggle off)</strong>.</p>
                </li>
              </ol>

              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-xl flex gap-2">
                <CheckCircle2 size={15} className="text-green-500 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  Langkah ini <strong>tidak akan memengaruhi</strong> notifikasi jadwal mengajar dari PPMA. Notifikasi jadwal mengajar tetap berfungsi normal karena dikelola secara terpisah.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 overflow-hidden">
        <h3 className="font-bold text-xl text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
          <MessageCircle className="text-green-500" /> Siaran WhatsApp (Manual)
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Kirim pesan siaran langsung ke aplikasi WhatsApp asli Anda (anti-blokir). Pesan otomatis diisi, Anda hanya perlu klik tombol kirim di aplikasi WA.
        </p>

        {/* Dropdown default pesan WA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-green-50/50 dark:bg-green-950/20 p-4 rounded-2xl border border-green-100 dark:border-green-900/30">
          <div>
            <label className="block text-xs font-bold text-green-800 dark:text-green-400 mb-1.5">Kategori Kegiatan</label>
            <select
              value={tipePesan}
              onChange={(e) => setTipePesan(e.target.value as any)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
            >
              <option value="quran">Kelas Qur'an (Majlis)</option>
              <option value="madin">Kelas Madin</option>
              <option value="kamar">Asrama (Kamar)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-green-800 dark:text-green-400 mb-1.5">Pilihan Kelas / Kamar</label>
            <select
              value={selectedKategoriId}
              onChange={handleKategoriChange}
              disabled={loadingKategori || listKategori.length === 0}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-60"
            >
              {loadingKategori ? (
                <option>Memuat...</option>
              ) : listKategori.length === 0 ? (
                <option>Tidak ada data</option>
              ) : (
                listKategori.map(k => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-green-800 dark:text-green-400 mb-1.5">Status Absensi</label>
            <select
              value={statusAbsen}
              onChange={(e) => setStatusAbsen(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
            >
              <option value="Hadir">Hadir</option>
              <option value="Sakit">Sakit</option>
              <option value="Izin">Izin</option>
              <option value="Absen (Alpha)">Absen (Alpha)</option>
            </select>
          </div>
        </div>

        {/* Kolom Edit Templat Pesan Wali */}
        <div className="mb-6 bg-green-50/20 dark:bg-green-950/10 border border-green-200/40 dark:border-green-900/20 rounded-2xl p-4">
          <label className="block text-xs font-bold text-green-800 dark:text-green-400 mb-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>Edit Templat Pesan Wali Murid</span>
            <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">Placeholder: &#123;nama_santri&#125;, &#123;kegiatan&#125;, &#123;kelas&#125;, &#123;status&#125;</span>
          </label>
          <textarea
            value={pesanWaliTemplate}
            onChange={(e) => {
              setPesanWaliTemplate(e.target.value);
              localStorage.setItem('wa_template_wali', e.target.value);
            }}
            rows={4}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-green-500 outline-none resize-none font-mono text-gray-750 dark:text-gray-300 leading-relaxed"
            placeholder="Tulis templat pesan..."
          />
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Ketik nama santri atau nama wali untuk mencari..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm transition-all"
          />
        </div>

        {/* Hint saat belum ada pencarian */}
        {!hasSearch && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-3">
              <Users size={28} className="text-green-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              {loading ? 'Memuat data santri...' : 'Daftar Siaran Siap Digunakan'}
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
              Ketik nama santri atau nama wali di kolom pencarian di atas untuk memulai
            </p>
          </div>
        )}

        {/* Hasil pencarian */}
        {hasSearch && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center p-8"><RefreshCw className="animate-spin text-green-500" /></div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-5 py-4 font-bold rounded-l-xl">Nama Santri</th>
                    <th className="px-5 py-4 font-bold">Wali Murid</th>
                    <th className="px-5 py-4 font-bold text-right rounded-r-xl">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredMurid.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-gray-500">
                        Santri &quot;{search}&quot; tidak ditemukan
                      </td>
                    </tr>
                  ) : (
                    filteredMurid.map(m => (
                      <tr key={m.murid_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-4 font-semibold text-gray-800 dark:text-gray-200">{m.nama}</td>
                        <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                          {m.nama_wali || '-'} <br/>
                          <span className="text-xs">{m.no_wali || 'Nomor HP tidak ada'}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {m.no_wali ? (
                            <a 
                              href={getWaLink(m)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => markAsSent(m.murid_id)}
                              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-transform hover:scale-105 active:scale-95 ${
                                sentWaIds[m.murid_id] 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border border-green-200 dark:border-green-800'
                                    : 'bg-[#25D366] hover:bg-[#1DA851] text-white'
                              }`}
                            >
                              {sentWaIds[m.murid_id] ? <Check size={16} /> : <MessageCircle size={16} />}
                              {sentWaIds[m.murid_id] ? 'Terkirim' : 'WA Wali'}
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No WA Kosong</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ===== KARTU TERPADU: Siaran WA Guru & Staff (Admin/Staff Only) ===== */}
      {(role === 'admin' || role === 'staff') && (
        <div id="pengingat-guru-aktif" className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mt-6 animate-[fadeIn_0.3s_ease-out]">

          {/* Header Kartu */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex-1">
              <h3 className="font-bold text-xl text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Users className="text-blue-500" /> Siaran WA Guru & Staff
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                Kirim pengingat ke guru/pembina yang belum absen, atau pilih guru secara manual.
              </p>
            </div>
            <button
              onClick={fetchActiveReminders}
              disabled={loadingReminders}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl transition-colors border border-gray-200 dark:border-gray-600 self-start sm:self-auto shrink-0 shadow-sm"
            >
              <RefreshCw size={12} className={loadingReminders ? 'animate-spin' : ''} />
              Segarkan Data
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
            <button
              onClick={() => setGuruCardTab('auto')}
              className={`flex-1 py-3 text-sm font-bold transition-colors ${
                guruCardTab === 'auto'
                  ? 'text-amber-700 dark:text-amber-400 border-b-2 border-amber-500 bg-white dark:bg-gray-800'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="inline-flex items-center justify-center gap-1.5 max-w-full text-center px-2">
                <AlertTriangle size={15} className={`shrink-0 ${guruCardTab === 'auto' ? 'text-amber-500' : 'text-gray-400'}`} />
                <span>Pengingat Otomatis</span>
                {loadingReminders ? (
                  <span className="shrink-0 w-4 h-4 flex items-center justify-center"><RefreshCw size={11} className="animate-spin text-amber-400" /></span>
                ) : activeReminders.length > 0 ? (
                  <span className="shrink-0 bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none">{activeReminders.length}</span>
                ) : (
                  <span className="shrink-0 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none">✓</span>
                )}
              </span>
            </button>
            <button
              onClick={() => setGuruCardTab('manual')}
              className={`flex-1 py-3 text-sm font-bold transition-colors ${
                guruCardTab === 'manual'
                  ? 'text-blue-700 dark:text-blue-400 border-b-2 border-blue-500 bg-white dark:bg-gray-800'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="inline-flex items-center justify-center gap-1.5 max-w-full text-center px-2">
                <Settings2 size={15} className={`shrink-0 ${guruCardTab === 'manual' ? 'text-blue-500' : 'text-gray-400'}`} />
                <span>Pilih Manual</span>
              </span>
            </button>
          </div>

          {/* Kolom Edit Templat Pesan Guru — dipakai oleh kedua tab */}
          <div className="mx-6 mt-5 mb-1 bg-amber-50/30 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-4">
            <label className="block text-xs font-bold text-amber-800 dark:text-amber-400 mb-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span>Edit Templat Pesan Guru</span>
              <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">Placeholder: &#123;nama_guru&#125;, &#123;kegiatan&#125;, &#123;kelas&#125;, &#123;jam&#125;</span>
            </label>
            <textarea
              value={pesanGuruTemplate}
              onChange={(e) => {
                setPesanGuruTemplate(e.target.value);
                localStorage.setItem('wa_template_guru', e.target.value);
              }}
              rows={4}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none resize-none font-mono text-gray-750 dark:text-gray-300 leading-relaxed"
              placeholder="Tulis templat pesan..."
            />
          </div>

          {/* ---- TAB: Pengingat Otomatis ---- */}
          {guruCardTab === 'auto' && (
            <div className="p-6 pt-4">
              {loadingReminders ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <RefreshCw className="animate-spin text-amber-500 mb-3" size={28} />
                  <p className="text-sm text-gray-400">Memeriksa jadwal yang belum diabsen...</p>
                </div>
              ) : activeReminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-green-200 dark:border-green-800/50 rounded-2xl bg-green-50/30 dark:bg-green-900/10">
                  <CheckCircle2 size={40} className="text-green-500 mb-3" />
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Semua Absensi Sudah Diisi!</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Tidak ada jadwal aktif yang belum diabsen saat ini.</p>
                  <button
                    onClick={() => setGuruCardTab('manual')}
                    className="mt-4 inline-flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
                  >
                    <Settings2 size={13} /> Kirim pesan manual ke guru
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mb-3 flex items-center gap-1.5">
                    <AlertTriangle size={13} className="animate-pulse" />
                    {activeReminders.length} guru/pengurus belum mengisi absensi pada jadwal aktif saat ini.
                  </p>

                  {/* Sub-tab Switcher */}
                  <div className="flex flex-wrap gap-2 mb-4 p-1.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                    {[
                      { id: 'semua', label: 'Semua', count: activeReminders.length },
                      { id: 'quran', label: "Kelas Qur'an", count: activeReminders.filter(r => r.tipe === 'quran').length },
                      { id: 'madin', label: 'Kelas Madin', count: activeReminders.filter(r => r.tipe === 'madin').length },
                      { id: 'kamar', label: 'Kamar / Asrama', count: activeReminders.filter(r => r.tipe === 'kamar').length },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSubTabAuto(tab.id as any)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                          subTabAuto === tab.id
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {tab.label}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full leading-none font-extrabold ${
                          subTabAuto === tab.id
                            ? 'bg-white/20 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {(() => {
                    const filteredActiveReminders = activeReminders.filter(r => {
                      if (subTabAuto === 'semua') return true;
                      return r.tipe === subTabAuto;
                    });

                    if (filteredActiveReminders.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50/20 dark:bg-gray-900/10">
                          <CheckCircle2 size={32} className="text-green-500 mb-2" />
                          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Selesai / Tidak Ada Jadwal</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Semua absensi pada kategori ini telah selesai diisi.</p>
                        </div>
                      );
                    }

                    const remindedCount = filteredActiveReminders.filter(r => {
                      const reminderKey = `${r.tipe}_${r.jadwal_id}_${new Date().toLocaleDateString()}`;
                      return sentReminderIds[reminderKey];
                    }).length;

                    return (
                      <>
                        {/* Tampilan Desktop (Tabel) */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                              <tr>
                                <th className="px-4 py-3 font-bold rounded-l-xl">Nama Guru / Pengurus</th>
                                <th className="px-4 py-3 font-bold">Kelas / Kamar</th>
                                <th className="px-4 py-3 font-bold">Jam</th>
                                <th className="px-4 py-3 font-bold text-right rounded-r-xl">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {filteredActiveReminders.map(r => {
                                const reminderKey = `${r.tipe}_${r.jadwal_id}_${new Date().toLocaleDateString()}`;
                                const isSent = sentReminderIds[reminderKey];
                                const tipeLabel = r.tipe === 'madin' ? 'Madin' : r.tipe === 'quran' ? "Al-Qur'an" : 'Asrama';
                                return (
                                  <tr key={reminderKey} className={`transition-colors ${
                                    isSent ? 'bg-green-50/60 dark:bg-green-900/10' : 'hover:bg-amber-50/40 dark:hover:bg-amber-900/10'
                                  }`}>
                                    <td className="px-4 py-3">
                                      <div className="font-semibold text-gray-800 dark:text-gray-200">{r.guru_nama}</div>
                                      <div className="text-[11px] text-gray-400 font-mono">{r.guru_whatsapp || 'No HP Kosong'}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold mr-1 ${
                                        r.tipe === 'madin' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400' :
                                        r.tipe === 'quran' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' :
                                        'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400'
                                      }`}>
                                        {tipeLabel}
                                      </span>
                                      <span className="text-gray-700 dark:text-gray-300 font-medium text-xs">{r.kelas_nama}</span>
                                      {r.mata_pelajaran && (
                                        <div className="text-[11px] text-gray-400 italic mt-0.5">{r.mata_pelajaran}</div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
                                      {r.jam_mulai.substring(0, 5)} – {r.jam_selesai.substring(0, 5)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      {r.guru_whatsapp ? (
                                        <a
                                          href={getWaGuruReminderLink(r)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={() => markReminderAsSent(reminderKey)}
                                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-105 active:scale-95 ${
                                            isSent
                                              ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border border-green-200 dark:border-green-800'
                                              : 'bg-[#25D366] hover:bg-[#1DA851] text-white'
                                          }`}
                                        >
                                          {isSent ? <Check size={13} /> : <MessageCircle size={13} />}
                                          {isSent ? 'Terkirim' : 'Ingatkan'}
                                        </a>
                                      ) : (
                                        <span className="text-[11px] text-gray-400 italic">No WA Kosong</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Tampilan Mobile (Kartu Bertumpuk) */}
                        <div className="block md:hidden space-y-4">
                          {filteredActiveReminders.map(r => {
                            const reminderKey = `${r.tipe}_${r.jadwal_id}_${new Date().toLocaleDateString()}`;
                            const isSent = sentReminderIds[reminderKey];
                            const tipeLabel = r.tipe === 'madin' ? 'Madin' : r.tipe === 'quran' ? "Al-Qur'an" : 'Asrama';
                            return (
                              <div key={reminderKey} className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border transition-colors ${
                                isSent ? 'border-green-200 dark:border-green-800 bg-green-50/10 dark:bg-green-900/10' : 'border-gray-100 dark:border-gray-700'
                              } space-y-3.5`}>
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-extrabold text-gray-900 dark:text-white text-base leading-tight">{r.guru_nama}</div>
                                    <div className="text-xs text-gray-400 font-mono mt-0.5">{r.guru_whatsapp || 'No HP Kosong'}</div>
                                  </div>
                                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                                    r.tipe === 'madin' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400' :
                                    r.tipe === 'quran' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' :
                                    'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400'
                                  }`}>
                                    {tipeLabel}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-xl">
                                    <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-bold block mb-0.5">Kelas / Kamar</span>
                                    <span className="font-bold text-gray-800 dark:text-gray-200">{r.kelas_nama}</span>
                                    {r.mata_pelajaran && (
                                      <span className="text-[10px] text-gray-400 block italic mt-0.5">{r.mata_pelajaran}</span>
                                    )}
                                  </div>
                                  <div className="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-xl">
                                    <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-bold block mb-0.5">Jam Mengajar</span>
                                    <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">{r.jam_mulai.substring(0, 5)} – {r.jam_selesai.substring(0, 5)}</span>
                                  </div>
                                </div>

                                {/* Tombol Ingatkan bertumpuk di bawah */}
                                <div>
                                  {r.guru_whatsapp ? (
                                    <a
                                      href={getWaGuruReminderLink(r)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={() => markReminderAsSent(reminderKey)}
                                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 ${
                                        isSent
                                          ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border border-green-200 dark:border-green-800'
                                          : 'bg-[#25D366] hover:bg-[#1DA851] text-white'
                                      }`}
                                    >
                                      {isSent ? <Check size={16} /> : <MessageCircle size={16} />}
                                      {isSent ? 'Pengingat Terkirim' : 'Kirim WA Ingatkan Guru'}
                                    </a>
                                  ) : (
                                    <div className="w-full bg-gray-50 dark:bg-gray-900 text-center py-2.5 rounded-xl text-xs text-gray-400 italic">
                                      Nomor WhatsApp Kosong
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Ringkasan progres pengiriman */}
                        <div className="mt-4 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 rounded-xl px-4 py-2.5">
                          <div className="flex-1">
                            <span className="font-bold text-gray-700 dark:text-gray-300">
                              {remindedCount}
                            </span> dari {filteredActiveReminders.length} pesan terkirim
                          </div>
                          {remindedCount === filteredActiveReminders.length && filteredActiveReminders.length > 0 && (
                            <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-bold">
                              <CheckCircle2 size={13} /> Semua terkirim!
                            </span>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* ---- TAB: Pilih Manual ---- */}
          {guruCardTab === 'manual' && (
            <div className="p-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5 bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                <div>
                  <label className="block text-xs font-bold text-blue-800 dark:text-blue-400 mb-1.5">1. Cari & Pilih Guru</label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Ketik untuk memfilter nama..."
                      value={guruSearch}
                      onChange={(e) => setGuruSearch(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                    />
                    <select
                      value={selectedGuruId}
                      onChange={(e) => setSelectedGuruId(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">-- Pilih Guru/Pengurus --</option>
                      {guruList
                        .filter(g => g.nama?.toLowerCase().includes(guruSearch.toLowerCase()))
                        .map(g => (
                          <option key={g.guru_id} value={g.guru_id}>{g.nama}</option>
                        ))
                      }
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-800 dark:text-blue-400 mb-1.5">2. Kategori Pengajar</label>
                  <select
                    value={tipeGuru}
                    onChange={(e) => setTipeGuru(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="quran">Al-Qur'an</option>
                    <option value="madin">Madin</option>
                    <option value="kamar">Asrama</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-800 dark:text-blue-400 mb-1.5">3. Jadwal / Kelas</label>
                  <select
                    value={selectedJadwalGuru}
                    onChange={(e) => setSelectedJadwalGuru(e.target.value)}
                    disabled={jadwalOptions.length === 0}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                  >
                    {jadwalOptions.length === 0 ? (
                      <option value="">Tidak ada jadwal aktif</option>
                    ) : (
                      jadwalOptions.map((j, i) => (
                        <option key={i} value={j}>{j}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {!selectedGuruId ? (
                <div className="flex flex-col items-center justify-center py-8 text-center border-t border-gray-100 dark:border-gray-700">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-3">
                    <Users size={24} className="text-blue-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                    {guruList.length === 0 ? 'Memuat data guru...' : `${guruList.length} data guru/staff tersedia`}
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                    Pilih guru/pengurus di atas untuk mulai mengirim pesan
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border-t border-gray-100 dark:border-gray-700 pt-4">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                      <tr>
                        <th className="px-5 py-4 font-bold rounded-l-xl">Nama Guru / Pengurus</th>
                        <th className="px-5 py-4 font-bold">Mengajar / Tugas di</th>
                        <th className="px-5 py-4 font-bold text-right rounded-r-xl">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {!selectedGuruObj ? (
                        <tr>
                          <td colSpan={3} className="text-center py-8 text-gray-500">
                            Data guru tidak ditemukan
                          </td>
                        </tr>
                      ) : (
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-5 py-4 font-semibold text-gray-800 dark:text-gray-200">{selectedGuruObj.nama}</td>
                          <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                            {selectedJadwalGuru || '-'}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {selectedGuruObj.whatsapp ? (
                              <a
                                href={getWaGuruLink(selectedGuruObj)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1DA851] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-transform hover:scale-105 active:scale-95"
                              >
                                <MessageCircle size={16} /> WA Guru
                              </a>
                            ) : (
                              <span className="text-xs text-gray-400 italic">No WA Kosong</span>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function NotifikasiPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-500 font-bold animate-pulse">Memuat halaman...</div>}>
      <NotifikasiContent />
    </Suspense>
  );
}
