'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { 
  Bell, AlertTriangle, CheckCircle2, MessageCircle, Phone, Search, 
  RefreshCw, Users, Check, Smartphone, Info, ChevronDown, ChevronUp, 
  Zap, Settings2, Clock, Send, Sparkles, Loader2, Calendar, Trash2, Award, Power, QrCode 
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';

function NotifikasiContent() {
  const [showSettingsGuide, setShowSettingsGuide] = useState(false);
  const [showChromeGuide, setShowChromeGuide] = useState(false);
  const [muridList, setMuridList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const searchParams = useSearchParams();
  const rawKegiatan = searchParams.get('kegiatan');
  const initKegiatan = (rawKegiatan === 'kegiatan' ? 'kamar' : rawKegiatan) as 'madin' | 'quran' | 'kamar' || 'quran';
  const initKelas = searchParams.get('kelas') || '';

  // State untuk default pesan WA dinamis
  const [role, setRole] = useState('guru');
  const [isPengasuh, setIsPengasuh] = useState(false);
  const [isModeLibur, setIsModeLibur] = useState(false);
  const [tipePesan, setTipePesan] = useState<'madin' | 'quran' | 'kamar'>(initKegiatan);
  const [selectedKategoriId, setSelectedKategoriId] = useState(initKelas);
  const [selectedKategoriNama, setSelectedKategoriNama] = useState('');
  const [statusAbsen, setStatusAbsen] = useState('Hadir');
  const [listKategori, setListKategori] = useState<any[]>([]);
  const [loadingKategori, setLoadingKategori] = useState(false);
  // Tipe jadwal yang dimiliki user yang login (untuk filter kategori siaran WA)
  const [userScheduleTypes, setUserScheduleTypes] = useState<Set<string>>(new Set(['quran', 'madin', 'kamar']));

  // State untuk Siaran WA ke Guru (Admin/Staff)
  const [guruList, setGuruList] = useState<any[]>([]);
  const [tipeGuru, setTipeGuru] = useState<'madin' | 'quran' | 'kamar'>('quran');
  const [guruSearch, setGuruSearch] = useState('');
  const [selectedGuruId, setSelectedGuruId] = useState('');

  // Tab aktif pada kartu terpadu Admin/Staff: 'auto' | 'manual' | 'rekap' | 'info_akun'
  const [guruCardTab, setGuruCardTab] = useState<'auto' | 'manual' | 'rekap' | 'info_akun'>('auto');
  const [manualMode, setManualMode] = useState<'absensi' | 'info_akun' | 'pembayaran'>('absensi');

  // State untuk Tab Tagihan & Pembayaran
  const [billingList, setBillingList] = useState<any[]>([]);
  const [billingSearch, setBillingSearch] = useState('');
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [sentBillingIds, setSentBillingIds] = useState<Record<string, boolean>>({});

  const isRemindParam = searchParams.get('remind') === 'true';
  const [activeReminders, setActiveReminders] = useState<any[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [sentReminderIds, setSentReminderIds] = useState<Record<string, boolean>>({});
  const [subTabAuto, setSubTabAuto] = useState<'semua' | 'quran' | 'madin' | 'kamar'>('semua');

  const [showAllWaliData, setShowAllWaliData] = useState(false);
  const [showAllInfoGuru, setShowAllInfoGuru] = useState(false);

  const defaultWaliTemplate = `Assalamu'alaikum Warohmatullah, Bapak/Ibu Wali dari Ananda *{nama_santri}*.\n\nKami dari pengurus PPMA menginformasikan perkembangan kehadiran ananda hari ini:\n\n* Kegiatan: {kegiatan}\n* Tempat/Kelas: {kelas}\n* Status Absensi: *{status}*\n\nUntuk informasi kehadiran lebih lengkap, dapat dilihat melalui tautan berikut:\n{link_laporan}\n\nDemikian informasi yang dapat kami sampaikan. Atas perhatiannya kami ucapkan terima kasih.\n\nWassalamu'alaikum Warohmatullah.`;

  const defaultBillingTemplate = `Assalamu'alaikum Warohmatullah,\n\nYth. Bapak/Ibu Wali dari Ananda *{nama_santri}*,\n\nSemoga Bapak/Ibu sekeluarga senantiasa dalam keadaan sehat wal \'afiat dan mendapat lindungan serta keberkahan dari Allah SWT.\n\nMelalui pesan ini, kami dari pengurus *Pondok Pesantren Matholi'ul Anwar (PPMA)* hendak menyampaikan informasi rincian tagihan administrasi ananda yang masih tercatat belum terlunasi:\n\n📋 *Rincian Tagihan*\n• Jenis Tagihan: {nama_tagihan}\n• Periode: {periode}\n• Total Nominal: *{nominal}*\n• Status: *⚠️ Belum Lunas*\n\nBapak/Ibu dapat melakukan konfirmasi pembayaran atau melihat informasi lebih lanjut melalui aplikasi berikut:\n🔗 https://app.ppmawar.or.id/dashboard/billing\n\nApabila Bapak/Ibu telah melakukan pembayaran, mohon konfirmasi kepada pihak Tata Usaha (TU) Pesantren agar segera diproses. Jika ada pertanyaan atau kendala, kami siap membantu.\n\nDemikian informasi ini kami sampaikan. Atas perhatian dan kerjasamanya, kami ucapkan terima kasih yang sebesar-besarnya.\n\nWassalamu\'alaikum Warohmatullah.\n\n_Pengurus PP. Matholi'ul Anwar_`;

  const defaultWaliInfoTemplate = `Assalamu'alaikum Warohmatullah, Bapak/Ibu Wali dari Ananda *{nama_santri}*.\n\nBerikut kami sampaikan informasi login default untuk mengakses aplikasi absensi PPMA:\n\n* Username: *{username}*\n* Password: *{password}*\n\nSilakan akses aplikasi pada tautan berikut: https://app.ppmawar.or.id/\n\nDemi keamanan akun, kami sarankan Bapak/Ibu untuk langsung mengubah password setelah berhasil login di halaman Profil.\n\nAtas perhatiannya kami ucapkan terima kasih.\n\nWassalamu'alaikum Warohmatullah.`;

  const defaultGuruTemplate = `Assalamu'alaikum Warohmatullah, Ustadz/Ustadzah *{nama_guru}*.\n\nKami dari pengurus PPMA menginformasikan pengingat jadwal mengajar/tugas Anda:\n\n* Hari/Tanggal: {hari_tanggal}\n* Kategori: {kegiatan}\n* {label_mapel}: {mapel}\n* Tempat/Kelas: {kelas}\n* Jam: {jam}\n\nLink absensi serta izin / sakit (jika berhalangan):\n{link_absen}\n\nMohon untuk mengisi absensi tepat waktu. Atas perhatiannya kami ucapkan terima kasih.\n\nWassalamu'alaikum Warohmatullah,`;

  const defaultGuruInfoTemplate = `Assalamu'alaikum Warohmatullah, Ustadz/Ustadzah *{nama_guru}*.\n\nBerikut kami sampaikan informasi login default untuk mengakses aplikasi absensi PPMA:\n\n* Username: *{username}*\n* Password: *${"{password}"}*\n\nSilakan akses aplikasi pada tautan berikut: https://app.ppmawar.or.id/\n\nDemi keamanan akun, kami sarankan Anda untuk langsung mengubah password setelah berhasil login di halaman Profil.\n\nAtas perhatiannya kami ucapkan terima kasih.\n\nWassalamu'alaikum Warohmatullah.`;

  const defaultRekapGuruTemplate = `Assalamu'alaikum Warohmatullah,\n\nYth. {nama_guru}\n\nBerikut kami sampaikan Rekapitulasi Absensi Mengajar Anda untuk periode {bulan_tahun}:\n\n📚 *Daftar Kelas & Mapel yang Diampu:*\n{daftar_kelas}\n\n📊 *Ringkasan Kehadiran Mengajar:*\n{ringkasan_kehadiran}\n\n🔗 *Link Preview Detail Rekapitulasi:*\n{link_rekap}\n\nSilakan klik tautan di atas untuk melihat rincian presensi kehadiran santri per kelas yang Anda ampu atau mengunduh ringkasannya.\n\nWassalamu'alaikum Warohmatullah,\n_Pengurus PP. Matholi'ul Anwar_`;

  const [pesanWaliTemplate, setPesanWaliTemplate] = useState(defaultWaliTemplate);
  const [pesanWaliInfoTemplate, setPesanWaliInfoTemplate] = useState(defaultWaliInfoTemplate);
  const [pesanGuruTemplate, setPesanGuruTemplate] = useState(defaultGuruTemplate);
  const [pesanGuruInfoTemplate, setPesanGuruInfoTemplate] = useState(defaultGuruInfoTemplate);
  const [pesanBillingTemplate, setPesanBillingTemplate] = useState(defaultBillingTemplate);
  const [pesanRekapGuruTemplate, setPesanRekapGuruTemplate] = useState(defaultRekapGuruTemplate);

  const defaultKepalaMadinTemplate = `Assalamu'alaikum Warohmatullah,\n\nYth. *Kepala Madrasah Diniyah (Madin)*\nPondok Pesantren Matholi'ul Anwar\n\nBerikut kami sampaikan Laporan Rekapitulasi Kehadiran Dewan Guru Madin untuk periode {bulan_tahun}:\n\n📊 *Ringkasan Presensi Dewan Guru Madin:*\n• Total Dewan Guru: {total_guru} Guru\n• Rata-rata Kehadiran: {avg_kehadiran}%\n{ringkasan_kehadiran}\n\n🔗 *Link Preview Detail Evaluasi Dewan Guru:*\n{link_laporan}\n\nTautan di atas berisi daftar lengkap kehadiran masing-masing guru, rincian jadwal kelas yang diampu, serta fitur ekspor/cetak laporan resmi untuk evaluasi madrasah.\n\nWassalamu'alaikum Warohmatullah,\n_Pengurus PP. Matholi'ul Anwar_`;

  const [pesanKepalaMadinTemplate, setPesanKepalaMadinTemplate] = useState(defaultKepalaMadinTemplate);

  // Hitung default bulan rekapitulasi: bulan sebelum bulan berjalan (karena rekap dikirim awal bulan untuk bulan kemarin)
  const defaultPrevMonthDate = (() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  })();

  // State Siaran Rekap Bulanan Guru
  const [rekapBulan, setRekapBulan] = useState(defaultPrevMonthDate.getMonth() + 1);
  const [rekapTahun, setRekapTahun] = useState(defaultPrevMonthDate.getFullYear());
  const [rekapCategories, setRekapCategories] = useState<string[]>(['madin']); // Default Madin aktif
  const [isRekapSending, setIsRekapSending] = useState(false);
  const [isRekapScheduling, setIsRekapScheduling] = useState(false);
  const [rekapStatusMsg, setRekapStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string; details?: any[] } | null>(null);

  // State Siaran Khusus Kepala Madin (Putra vs Putri vs Gabungan)
  const [kepalaMadinTarget, setKepalaMadinTarget] = useState<'putra' | 'putri' | 'all'>('putra');
  const [selectedKepalaMadinId, setSelectedKepalaMadinId] = useState('');
  const [kepalaMadinPhone, setKepalaMadinPhone] = useState('');
  const [kepalaMadinNama, setKepalaMadinNama] = useState('Kepala Madin Putra');
  const [isKepalaMadinSending, setIsKepalaMadinSending] = useState(false);
  const [isKepalaMadinScheduling, setIsKepalaMadinScheduling] = useState(false);
  const [kepalaMadinStatusMsg, setKepalaMadinStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedGid = localStorage.getItem('kepala_madin_putra_id') || '';
      const savedPhone = localStorage.getItem('kepala_madin_putra_phone') || '';
      if (savedGid) setSelectedKepalaMadinId(savedGid);
      if (savedPhone) setKepalaMadinPhone(savedPhone);
    }
  }, []);

  const handleTargetKepalaMadinChange = (target: 'putra' | 'putri' | 'all') => {
    setKepalaMadinTarget(target);
    const targetLabel = target === 'putri' ? 'Kepala Madin Putri' : target === 'putra' ? 'Kepala Madin Putra' : 'Kepala Madrasah Diniyah';
    setKepalaMadinNama(targetLabel);
    if (typeof window !== 'undefined') {
      const savedGid = localStorage.getItem(`kepala_madin_${target}_id`) || '';
      const savedPhone = localStorage.getItem(`kepala_madin_${target}_phone`) || '';
      setSelectedKepalaMadinId(savedGid);
      setKepalaMadinPhone(savedPhone);
    }
  };

  const handleSelectKepalaMadin = (gid: string) => {
    setSelectedKepalaMadinId(gid);
    const selected = guruList.find(g => String(g.guru_id) === gid);
    if (selected) {
      const name = selected.nama || (kepalaMadinTarget === 'putri' ? 'Kepala Madin Putri' : kepalaMadinTarget === 'putra' ? 'Kepala Madin Putra' : 'Kepala Madin');
      setKepalaMadinNama(name);
      setKepalaMadinPhone(selected.whatsapp || '');
      if (typeof window !== 'undefined') {
        localStorage.setItem(`kepala_madin_${kepalaMadinTarget}_id`, gid);
        localStorage.setItem(`kepala_madin_${kepalaMadinTarget}_phone`, selected.whatsapp || '');
      }
    }
  };

  const toggleRekapCategory = (cat: string) => {
    setRekapCategories(prev => {
      if (prev.includes(cat)) {
        if (prev.length === 1) return prev; // Minimal 1 kategori
        return prev.filter(c => c !== cat);
      } else {
        return [...prev, cat];
      }
    });
  };

  const handleSendRekapWA = async (mode: 'send_now' | 'schedule_monthly') => {
    if (mode === 'schedule_monthly') {
      setIsRekapScheduling(true);
    } else {
      setIsRekapSending(true);
    }
    setRekapStatusMsg(null);

    try {
      const res = await fetch('/api/wa-scheduler/bulk-rekap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulan: rekapBulan,
          tahun: rekapTahun,
          categories: rekapCategories,
          template: pesanRekapGuruTemplate,
          mode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRekapStatusMsg({
          type: 'success',
          text: data.message,
          details: data.results,
        });
      } else {
        setRekapStatusMsg({
          type: 'error',
          text: data.error || 'Gagal memproses pengiriman rekapitulasi.',
        });
      }
    } catch {
      setRekapStatusMsg({
        type: 'error',
        text: 'Kesalahan jaringan saat mengirim rekapitulasi.',
      });
    } finally {
      setIsRekapSending(false);
      setIsRekapScheduling(false);
    }
  };

  const handleSendKepalaMadin = async (mode: 'send_now' | 'schedule_monthly') => {
    if (!kepalaMadinPhone.trim()) {
      alert('Silakan pilih guru Kepala Madin atau masukkan nomor WhatsApp tujuan terlebih dahulu.');
      return;
    }
    if (mode === 'schedule_monthly') setIsKepalaMadinScheduling(true);
    else setIsKepalaMadinSending(true);
    setKepalaMadinStatusMsg(null);

    try {
      const res = await fetch('/api/wa-scheduler/rekap-kepala-madin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulan: rekapBulan,
          tahun: rekapTahun,
          target_wilayah: kepalaMadinTarget,
          kepala_nama: kepalaMadinNama,
          phone_number: kepalaMadinPhone,
          template: pesanKepalaMadinTemplate,
          mode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setKepalaMadinStatusMsg({ type: 'success', text: data.message });
      } else {
        setKepalaMadinStatusMsg({ type: 'error', text: data.error || 'Gagal mengirim laporan ke Kepala Madin.' });
      }
    } catch {
      setKepalaMadinStatusMsg({ type: 'error', text: 'Kesalahan jaringan saat mengirim laporan.' });
    } finally {
      setIsKepalaMadinSending(false);
      setIsKepalaMadinScheduling(false);
    }
  };

  const [saveStatus, setSaveStatus] = useState<Record<string, string>>({});

  const saveTemplate = async (key: string, value: string) => {
    setSaveStatus(prev => ({ ...prev, [key]: 'saving' }));
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
      }
      const res = await fetch('/api/settings/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus(prev => ({ ...prev, [key]: 'saved' }));
        setTimeout(() => {
          setSaveStatus(prev => ({ ...prev, [key]: '' }));
        }, 4000);
      } else {
        setSaveStatus(prev => ({ ...prev, [key]: 'error' }));
      }
    } catch (err) {
      setSaveStatus(prev => ({ ...prev, [key]: 'error' }));
    }
  };

  const resetTemplate = async (key: string, defaultValue: string, setter: (val: string) => void) => {
    setter(defaultValue);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
    setSaveStatus(prev => ({ ...prev, [key]: 'resetting' }));
    try {
      await fetch('/api/settings/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', key }),
      });
      setSaveStatus(prev => ({ ...prev, [key]: 'reset' }));
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [key]: '' }));
      }, 4000);
    } catch (err) {}
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedWali = localStorage.getItem('wa_template_wali');
      if (storedWali) setPesanWaliTemplate(storedWali);

      const storedWaliInfo = localStorage.getItem('wa_template_wali_info');
      if (storedWaliInfo) setPesanWaliInfoTemplate(storedWaliInfo);

      const storedGuru = localStorage.getItem('wa_template_guru');
      if (storedGuru) setPesanGuruTemplate(storedGuru);

      const storedGuruInfo = localStorage.getItem('wa_template_guru_info');
      if (storedGuruInfo) setPesanGuruInfoTemplate(storedGuruInfo);

      const storedBilling = localStorage.getItem('wa_template_billing');
      if (storedBilling) setPesanBillingTemplate(storedBilling);

      const storedGuruRekap = localStorage.getItem('wa_template_guru_rekap');
      if (storedGuruRekap) setPesanRekapGuruTemplate(storedGuruRekap);

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

    // Ambil templat dari Database agar selalu sinkron dan permanen (bahkan jika cache browser dibersihkan)
    fetch('/api/settings/templates')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.templates) {
          const t = data.templates;
          if (t.wa_template_wali) {
            setPesanWaliTemplate(t.wa_template_wali);
            if (typeof window !== 'undefined') localStorage.setItem('wa_template_wali', t.wa_template_wali);
          }
          if (t.wa_template_wali_info) {
            setPesanWaliInfoTemplate(t.wa_template_wali_info);
            if (typeof window !== 'undefined') localStorage.setItem('wa_template_wali_info', t.wa_template_wali_info);
          }
          if (t.wa_template_guru) {
            setPesanGuruTemplate(t.wa_template_guru);
            if (typeof window !== 'undefined') localStorage.setItem('wa_template_guru', t.wa_template_guru);
          }
          if (t.wa_template_guru_info) {
            setPesanGuruInfoTemplate(t.wa_template_guru_info);
            if (typeof window !== 'undefined') localStorage.setItem('wa_template_guru_info', t.wa_template_guru_info);
          }
          if (t.wa_template_guru_rekap) {
            setPesanRekapGuruTemplate(t.wa_template_guru_rekap);
            if (typeof window !== 'undefined') localStorage.setItem('wa_template_guru_rekap', t.wa_template_guru_rekap);
          }
          if (t.wa_template_kepala_madin) {
            setPesanKepalaMadinTemplate(t.wa_template_kepala_madin);
            if (typeof window !== 'undefined') localStorage.setItem('wa_template_kepala_madin', t.wa_template_kepala_madin);
          }
          if (t.wa_template_billing) {
            setPesanBillingTemplate(t.wa_template_billing);
            if (typeof window !== 'undefined') localStorage.setItem('wa_template_billing', t.wa_template_billing);
          }
        }
      })
      .catch(() => {});

    // Ambil status mode libur
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.mode_libur === '1') {
          setIsModeLibur(true);
        }
      })
      .catch(() => {});

    // Ambil detail profil untuk mendapatkan role
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const userRole = data.user.role;
          setRole(userRole);
          setIsPengasuh(!!(data.user.is_pengasuh || data.user.isPengasuh || userRole === 'pengasuh'));
          // Untuk guru/pengurus_asrama: filter tipe jadwal berdasarkan jadwal aktual
          if (userRole !== 'admin' && userRole !== 'staff') {
            fetch('/api/absen/jadwal')
              .then(r => r.json())
              .then(jData => {
                if (jData.success && jData.data) {
                  const types = new Set<string>();
                  jData.data.forEach((s: any) => {
                    if (s.tipe === 'quran') types.add('quran');
                    else if (s.tipe === 'madin') types.add('madin');
                    else if (s.tipe === 'kegiatan') types.add('kamar');
                  });
                  if (types.size > 0) {
                    setUserScheduleTypes(types);
                    // Jika tipePesan saat ini tidak ada di jadwal user, ganti ke yang pertama
                    setTipePesan(prev => types.has(prev) ? prev : (Array.from(types)[0] as any));
                  }
                }
              })
              .catch(() => {});
          }
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

    // Scroll to WA Wali Murid section if redirecting from input absen
    const hasRedirectParams = searchParams.get('kegiatan') && searchParams.get('kelas');
    if (hasRedirectParams) {
      setTimeout(() => {
        const el = document.getElementById('siaran-wa-manual');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    }
  }, [searchParams]);

  // Scroll to reminder section if param remind=true and role is loaded
  useEffect(() => {
    if (isRemindParam && (role === 'admin' || role === 'staff')) {
      const timer = setTimeout(() => {
        const el = document.getElementById('pengingat-guru-aktif');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isRemindParam, role]);

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

  // State WA Scheduler Automation
  const [isSchedulerSending, setIsSchedulerSending] = useState(false);
  const [isClearingPending, setIsClearingPending] = useState(false);
  const [schedulerModalOpen, setSchedulerModalOpen] = useState(false);
  const [schedulerMode, setSchedulerMode] = useState<'active_today' | 'all_schedules'>('active_today');
  const [schedulerCategories, setSchedulerCategories] = useState<string[]>(['madin']); // Default Madin sesuai permintaan user
  const [schedulerLeadTime, setSchedulerLeadTime] = useState(15);
  const [schedulerIsLoop, setSchedulerIsLoop] = useState(true);
  const [schedulerStatusMsg, setSchedulerStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string; details?: any[] } | null>(null);
  const [sendingSingleKey, setSendingSingleKey] = useState<string | null>(null);

  // Sinkronisasi schedulerLeadTime & schedulerIsLoop dari pengaturan DB agar konsisten dengan halaman Pengaturan
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          const lt = parseInt(json.data.wa_scheduler_lead_time);
          if (!isNaN(lt)) setSchedulerLeadTime(lt);
          setSchedulerIsLoop(json.data.wa_scheduler_is_loop !== '0');
        }
      })
      .catch(() => {/* Gunakan default jika gagal */});
  }, []);

  const toggleSchedulerCategory = (cat: string) => {
    setSchedulerCategories(prev => {
      if (prev.includes(cat)) {
        if (prev.length === 1) return prev; // Minimal 1 kategori tetap aktif
        return prev.filter(c => c !== cat);
      } else {
        return [...prev, cat];
      }
    });
  };

  // Batalkan & Hapus semua antrean di wa.quizb.my.id saat libur mendadak
  const handleClearPending = async () => {
    if (!window.confirm('Batalkan & hapus SEMUA antrean pesan otomatis di WA Scheduler?\n\nTindakan ini akan menghentikan pengiriman pesan di gateway wa.quizb.my.id seketika agar tidak ada guru yang menerima notifikasi saat pondok libur.')) return;
    setIsClearingPending(true);
    setSchedulerStatusMsg(null);
    try {
      const res = await fetch('/api/wa-scheduler/clear-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setSchedulerStatusMsg({ type: 'success', text: data.message || 'Semua antrean pengiriman otomatis berhasil dibatalkan dan dibersihkan!' });
      } else {
        setSchedulerStatusMsg({ type: 'error', text: data.error ?? 'Gagal membatalkan antrean.' });
      }
    } catch {
      setSchedulerStatusMsg({ type: 'error', text: 'Kesalahan jaringan saat menghapus antrean.' });
    } finally {
      setIsClearingPending(false);
    }
  };

  const cleanPhoneStr = (p: string | null | undefined) => {
    if (!p) return '';
    let c = p.toString().trim().replace(/[^0-9+]/g, '');
    if (c.startsWith('+')) c = c.substring(1);
    if (c.startsWith('0')) c = '62' + c.substring(1);
    else if (c.startsWith('8')) c = '62' + c;
    return c;
  };

  const handleBulkScheduleWA = async (overrideMode?: 'active_today' | 'all_schedules') => {
    const targetMode = overrideMode || schedulerMode;
    setIsSchedulerSending(true);
    setSchedulerStatusMsg(null);
    try {
      const res = await fetch('/api/wa-scheduler/bulk-reminder', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: targetMode,
          categories: schedulerCategories,
          leadTimeMinutes: schedulerLeadTime,
          isLoop: targetMode === 'all_schedules' ? (schedulerIsLoop ? 1 : 0) : 0,
          customTemplate: pesanGuruTemplate
        })
      });

      // Deteksi jika server mengembalikan HTML (error page / redirect)
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const htmlText = await res.text();
        console.error('Non-JSON response from bulk-reminder:', res.status, htmlText.slice(0, 300));
        setSchedulerStatusMsg({
          type: 'error',
          text: res.status === 401
            ? 'Sesi login habis. Silakan refresh halaman dan login ulang.'
            : `Server error (HTTP ${res.status}). Coba refresh halaman lalu coba lagi.`
        });
        return;
      }

      const data = await res.json();
      if (data.success) {
        setSchedulerStatusMsg({
          type: 'success',
          text: data.message || `Berhasil menjadwalkan ${data.sent} pesan ke antrean WA Scheduler!`,
          details: data.results
        });
        // Update status terkirim
        if (data.results && Array.isArray(data.results)) {
          data.results.forEach((r: any) => {
            if (r.success) {
              const matched = activeReminders.find(ar => cleanPhoneStr(ar.guru_whatsapp) === r.phone);
              if (matched) {
                const key = `${matched.tipe}_${matched.jadwal_id}_${new Date().toLocaleDateString()}`;
                markReminderAsSent(key);
              }
            }
          });
        }
      } else {
        setSchedulerStatusMsg({
          type: 'error',
          text: data.error || 'Gagal mengirim antrean ke WA Scheduler'
        });
      }
    } catch (err: any) {
      setSchedulerStatusMsg({
        type: 'error',
        text: 'Kesalahan jaringan: ' + err.message
      });
    } finally {
      setIsSchedulerSending(false);
    }
  };

  const handleSingleScheduleWA = async (r: any) => {
    const reminderKey = `${r.tipe}_${r.jadwal_id}_${new Date().toLocaleDateString()}`;
    setSendingSingleKey(reminderKey);
    try {
      const res = await fetch('/api/wa-scheduler/bulk-reminder', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'custom_list',
          customItems: [r],
          leadTimeMinutes: schedulerLeadTime,
          isLoop: 0,
          customTemplate: pesanGuruTemplate
        })
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        alert(res.status === 401 ? 'Sesi login habis. Silakan login ulang.' : `Server error (HTTP ${res.status}). Silakan coba sesaat lagi.`);
        return;
      }

      const data = await res.json();
      if (data.success && data.sent > 0) {
        markReminderAsSent(reminderKey);
        alert(`Jadwal pengingat otomatis untuk ${r.guru_nama} berhasil didaftarkan ke antrean WA Scheduler!`);
      } else {
        const err = data.results?.[0]?.error || data.error || 'Gagal menjadwalkan ke WA Scheduler';
        alert(`Gagal: ${err}`);
      }
    } catch (err: any) {
      alert(`Kesalahan jaringan: ${err.message}`);
    } finally {
      setSendingSingleKey(null);
    }
  };

  // Fetch daftar kelas/kamar sesuai tipePesan (terbatasi dinamis oleh API kelas sesuai role yang login)
  useEffect(() => {
    setLoadingKategori(true);
    fetch(`/api/kelas?type=${tipePesan === 'kamar' ? 'kamar' : tipePesan}&aggregate=true`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setListKategori(data.data);
          if (data.data.length > 0) {
            // Jika ada initKelas, gunakan, jika tidak pakai 'all'
            if (initKelas && data.data.find((k:any) => k.id.toString() === initKelas)) {
                setSelectedKategoriId(initKelas);
                setSelectedKategoriNama(data.data.find((k:any) => k.id.toString() === initKelas).nama);
            } else {
                setSelectedKategoriId('all');
                setSelectedKategoriNama('');
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
    if (val === 'all') {
      setSelectedKategoriNama('');
    } else {
      const found = listKategori.find(k => k.id.toString() === val);
      if (found) setSelectedKategoriNama(found.nama);
    }
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

    if (manualMode === 'info_akun') {
      const username = (murid.nis && murid.nis.trim() !== '') ? murid.nis.trim() : `2026${murid.murid_id}`;
      const password = (murid.nis && murid.nis.trim() !== '') ? murid.nis.trim() : `2026${murid.murid_id}`;
      const text = pesanWaliInfoTemplate
        .replace(/{nama_santri}/g, murid.nama)
        .replace(/{username}/g, username)
        .replace(/{password}/g, password);
      return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    }

    let tipeLabel = tipePesan === 'madin' ? 'Kegiatan Madin' : tipePesan === 'quran' ? "Kegiatan Al-Qur'an" : 'Kegiatan Asrama';
    let tempatLabel = selectedKategoriNama ? `${selectedKategoriNama}` : '';

    const text = pesanWaliTemplate
      .replace(/{nama_santri}/g, murid.nama)
      .replace(/{kegiatan}/g, tipeLabel)
      .replace(/{kelas}/g, tempatLabel || '-')
      .replace(/{status}/g, statusAbsen)
      .replace(/{link_laporan}/g, 'https://app.ppmawar.or.id/dashboard/notifikasi');

    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  // Filter murid berdasarkan kelas/kamar yang dipilih
  const filteredByKelas = selectedKategoriId && selectedKategoriId !== 'all'
    ? muridList.filter(m => {
        if (tipePesan === 'quran') return m.kelas_quran_id?.toString() === selectedKategoriId;
        if (tipePesan === 'madin') return m.kelas_madin_id?.toString() === selectedKategoriId;
        if (tipePesan === 'kamar') return m.kamar_id?.toString() === selectedKategoriId;
        return false;
      })
    : muridList.filter(m => {
        if (tipePesan === 'quran') return m.kelas_quran_id;
        if (tipePesan === 'madin') return m.kelas_madin_id;
        if (tipePesan === 'kamar') return m.kamar_id;
        return true;
      });

  // Hanya tampilkan hasil jika ada pencarian (min 1 karakter) ATAU jika redirect dari absen (punya parameter)
  const isAutoFilter = initKegiatan && initKelas;
  const hasSearch = search.trim().length > 0 || isAutoFilter || showAllWaliData;
  const filteredMurid = hasSearch
    ? filteredByKelas.filter(m => {
        // Jika ada pencarian teks, cocokkan nama
        if (search.trim().length > 0) {
            return m.nama?.toLowerCase().includes(search.toLowerCase()) ||
                   m.nama_wali?.toLowerCase().includes(search.toLowerCase());
        }
        // Jika dari auto-filter redirect absen, tampilkan santri di kelas yang baru diabsen
        return true;
    })
    : [];


  const selectedGuruObj = guruList.find(g => g.guru_id.toString() === selectedGuruId);
  
  const [selectedJadwalGuru, setSelectedJadwalGuru] = useState('');
  const [guruQuickUrl, setGuruQuickUrl] = useState<string>('');
  const [fetchingQuickUrl, setFetchingQuickUrl] = useState(false);

  const getWaGuruLink = (guru: any) => {
    const phone = formatPhoneNumber(guru.whatsapp);
    if (!phone) return '#';

    let tipeLabel = tipeGuru === 'madin' ? 'Madin' : tipeGuru === 'quran' ? "Al-Qur'an" : 'Asrama';
    let tempatLabel = selectedJadwalGuru || 'Belum ditentukan';
    const linkAbsen = guruQuickUrl || 'https://app.ppmawar.or.id/dashboard/absen';

    const hariTanggal = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    }).format(new Date());

    let text = pesanGuruTemplate
      .replace(/{nama_guru}/g, guru.nama)
      .replace(/{hari_tanggal}/g, hariTanggal)
      .replace(/{kegiatan}/g, tipeLabel)
      .replace(/{kelas}/g, tempatLabel)
      .replace(/{jam}/g, 'Sesuai Jadwal')
      .replace(/{link_absen}/g, linkAbsen);

    if (!text.includes(hariTanggal) && !pesanGuruTemplate.includes('{hari_tanggal}')) {
      text = text.replace(/\* Kategori:/i, `* Hari/Tanggal: ${hariTanggal}\n* Kategori:`);
    }

    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const getWaGuruInfoLink = (guru: any) => {
    const phone = formatPhoneNumber(guru.whatsapp);
    if (!phone) return '#';

    const username = (guru.nip && guru.nip.trim() !== '') ? `2026${guru.nip.trim()}` : `2026${guru.guru_id}`;
    const password = (guru.nip && guru.nip.trim() !== '') ? `2026${guru.nip.trim()}` : `2026${guru.guru_id}`;

    const text = pesanGuruInfoTemplate
      .replace(/{nama_guru}/g, guru.nama)
      .replace(/{username}/g, username)
      .replace(/{password}/g, password);

    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const getWaGuruReminderLink = (reminder: any) => {
    const phone = formatPhoneNumber(reminder.guru_whatsapp);
    if (!phone) return '#';

    const t = (reminder.tipe || '').toLowerCase();
    let labelMapel = 'Mapel';
    let tipeLabel = 'Madin';
    let valMapel = reminder.mata_pelajaran || '-';

    if (t.includes('quran') || t.includes('qur_an')) {
      labelMapel = 'Majlis';
      tipeLabel = "Al-Qur'an";
      valMapel = reminder.mata_pelajaran || reminder.kelas_nama || "Majlis Qur'an";
    } else if (t.includes('kamar') || t.includes('kegiatan') || t.includes('asrama')) {
      labelMapel = 'Kegiatan';
      tipeLabel = 'Asrama';
      valMapel = reminder.mata_pelajaran || 'Kegiatan Asrama';
    } else {
      labelMapel = 'Mapel';
      tipeLabel = 'Madin';
      valMapel = reminder.mata_pelajaran || 'Pelajaran Diniyah';
    }

    const linkAbsen = reminder.quick_url || 'https://app.ppmawar.or.id/dashboard/absen';

    const rawHariTanggal = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    }).format(new Date());

    const hariTanggal = rawHariTanggal.replace(/^Minggu,/i, 'Ahad,').replace(/^Minggu /i, 'Ahad ');

    let text = pesanGuruTemplate
      .replace(/{nama_guru}/g, reminder.guru_nama)
      .replace(/{hari_tanggal}/g, hariTanggal)
      .replace(/{kegiatan}/g, tipeLabel)
      .replace(/{label_mapel}/g, labelMapel)
      .replace(/{mapel}/g, valMapel)
      .replace(/{kelas}/g, reminder.kelas_nama)
      .replace(/{jam}/g, `${reminder.jam_mulai.substring(0, 5)} - ${reminder.jam_selesai.substring(0, 5)}`)
      .replace(/{link_absen}/g, linkAbsen);

    if (!text.includes(hariTanggal) && !pesanGuruTemplate.includes('{hari_tanggal}')) {
      text = text.replace(/\* Kategori:/i, `* Hari/Tanggal: ${hariTanggal}\n* Kategori:`);
    }

    if (!text.includes(labelMapel) && !text.includes(valMapel) && valMapel !== '-') {
      text = text.replace(
        new RegExp(`(\\* Kategori:.*?\\n)`, 'i'),
        `$1* ${labelMapel}: ${valMapel}\n`
      );
    }

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

  // Fetch quick token untuk guru yang dipilih (agar {link_absen} pakai link direct absen)
  useEffect(() => {
    if (!selectedGuruObj || !selectedGuruObj.guru_id) {
      setGuruQuickUrl('');
      return;
    }
    // Cari jadwal_id dari activeReminders yang cocok guru & tipe ini
    const matchedReminder = activeReminders.find(
      (r: any) => r.guru_id === selectedGuruObj.guru_id && r.tipe === tipeGuru
    );
    if (matchedReminder?.quick_url) {
      setGuruQuickUrl(matchedReminder.quick_url);
      return;
    }
    // Jika tidak ada di activeReminders, coba minta token lewat API
    const jadwalIdFromReminder = matchedReminder?.jadwal_id;
    if (!jadwalIdFromReminder) {
      setGuruQuickUrl('');
      return;
    }
    setFetchingQuickUrl(true);
    fetch('/api/absen/quick-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guru_id: selectedGuruObj.guru_id,
        jadwal_id: jadwalIdFromReminder,
        tipe: tipeGuru,
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.url) setGuruQuickUrl(data.url);
        else setGuruQuickUrl('');
      })
      .catch(() => setGuruQuickUrl(''))
      .finally(() => setFetchingQuickUrl(false));
  }, [selectedGuruId, tipeGuru, activeReminders]);

  return (
    <div className="max-w-4xl mx-auto animate-[fadeIn_0.5s_ease-out] pb-20">
      <div className="bg-gradient-to-r from-green-800 to-green-900 rounded-2xl p-6 text-white shadow-lg mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Bell className="animate-bounce" /> Pusat Notifikasi</h2>
        <p className="text-green-100 text-sm mt-1">Daftar pemberitahuan dan informasi jadwal.</p>
      </div>

      {/* ===== CARD NOTIFIKASI TELEGRAM RESMI ===== */}
      <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-md relative overflow-hidden mb-6">
        <div className="space-y-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-sm text-white rounded-2xl shrink-0 shadow-inner">
              <Send size={22} />
            </div>
            <h3 className="font-extrabold text-base sm:text-lg text-white">
              Notifikasi Telegram Bot Resmi
            </h3>
          </div>

          <p className="text-sky-100 text-xs leading-relaxed">
            Pengingat jadwal guru, tombol Absen Cepat & Izin, dan rekap bulanan kini otomatis terkirim via bot <strong>@ppma_notif_bot</strong> tanpa risiko nomor terblokir.
          </p>

          <div className="pt-1 flex justify-center">
            <a
              href="https://t.me/ppma_notif_bot?start=start"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-6 py-2.5 bg-white text-sky-700 hover:bg-sky-50 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 text-center"
            >
              <Send size={13} />
              <span>Buka @ppma_notif_bot 📲</span>
            </a>
          </div>
        </div>
      </div>

      {/* ===== CARD OTOMATISASI WA SCHEDULER ===== */}
      {(role === 'admin' || role === 'staff') && (
        <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-200/80 dark:border-emerald-800/50 shadow-sm space-y-3">
          {/* Baris 1: Judul satu baris utuh dengan 1 ikon lampu indikator aktif */}
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h4 className="font-extrabold text-sm sm:text-base text-emerald-950 dark:text-emerald-300">
              Otomatisasi WA Scheduler (wa.quizb.my.id)
            </h4>
          </div>

          {/* Baris 2: Deskripsi satu baris utuh */}
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            Kirim notifikasi pengingat ke WhatsApp guru secara otomatis tanpa perlu membuka tautan satu per satu.
          </p>

          {/* Baris 3: Tiga Tombol Aksi - presisi dan seragam */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap md:flex-nowrap items-stretch gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setSchedulerModalOpen(true)}
              className="px-3.5 py-2.5 min-h-[44px] text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-center active:scale-95"
            >
              <Settings2 size={14} className="shrink-0" />
              <span>Opsi &amp; Looping</span>
            </button>
            <button
              type="button"
              disabled={isSchedulerSending || activeReminders.length === 0}
              onClick={() => handleBulkScheduleWA('active_today')}
              className="px-3.5 py-2.5 min-h-[44px] text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl transition-all shadow-md hover:shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2 text-center disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSchedulerSending ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Zap size={14} className="shrink-0" />}
              <span>{isSchedulerSending ? 'Menjadwalkan...' : 'Kirim Semua Otomatis'}</span>
            </button>
            {/* Tombol Batalkan / Hapus Semua Antrean (Libur Mendadak) */}
            <button
              type="button"
              disabled={isClearingPending}
              onClick={handleClearPending}
              title="Batalkan & Hapus semua antrean di WA Scheduler saat libur mendadak"
              className="col-span-2 sm:col-span-auto sm:w-auto px-4 py-2.5 min-h-[44px] text-xs font-bold text-red-700 dark:text-red-300 bg-red-100/90 hover:bg-red-200 dark:bg-red-950/60 dark:hover:bg-red-900/80 border border-red-300 dark:border-red-800 rounded-xl transition-all flex items-center justify-center gap-2 text-center disabled:opacity-50 shadow-sm active:scale-95 md:ml-auto"
            >
              {isClearingPending ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Power size={14} className="shrink-0" />}
              <span>{isClearingPending ? 'Membatalkan...' : 'Batalkan Semua Antrean (Libur)'}</span>
            </button>
          </div>

          {/* Status Alert Notifikasi Scheduler */}
          {schedulerStatusMsg && (
            <div className={`p-3 rounded-xl text-xs font-medium flex items-start justify-between gap-2 ${
              schedulerStatusMsg.type === 'success'
                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                : 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200 border border-red-300 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {schedulerStatusMsg.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={16} className="text-red-600 shrink-0" />}
                <span>{schedulerStatusMsg.text}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setSchedulerStatusMsg(null)}
                className="text-[11px] font-bold underline shrink-0"
              >
                Tutup
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== CARD PENGIRIMAN QR DEWAN GURU ===== */}
      {(role === 'admin' || role === 'staff' || isPengasuh) && (
        <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-indigo-500/10 border border-teal-200/80 dark:border-teal-800/50 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-600 text-white rounded-2xl shadow-sm shrink-0">
                <QrCode size={22} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-teal-950 dark:text-teal-200 flex items-center gap-2">
                  <span>Kirim &amp; Bagikan Kartu QR Dewan Guru YPMA</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 font-black">
                    441 Guru
                  </span>
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  Bagikan tautan presensi mandiri dan kartu QR ke 441 Dewan Guru via WhatsApp atau unduh secara massal (ZIP/PDF).
                </p>
              </div>
            </div>
            <a
              href="/dashboard/qr-dewan-guru"
              className="w-full sm:w-auto px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-black rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <span>Buka Pengelola QR Guru</span>
              <Send size={13} />
            </a>
          </div>
        </div>
      )}

      {/* ===== CARD PUSH NOTIFIKASI (PERANGKAT) ===== */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 sm:p-6 overflow-hidden mb-6">
        {/* Header Push Notifikasi: ikon lonceng di samping kiri judul + deskripsi */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-11 h-11 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Bell className="text-gray-500 dark:text-gray-400" size={22} />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-gray-800 dark:text-gray-100">Push Notifikasi (Perangkat)</h3>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">Notifikasi jadwal absensi Anda akan muncul di perangkat ini.</p>
          </div>
        </div>
        
        <div className="flex justify-center pt-1">
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
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl transition-colors text-xs sm:text-sm shadow-md w-full sm:w-auto active:scale-95 text-center"
          >
            Tes Izin Notifikasi Perangkat
          </button>
        </div>

        {showSettingsGuide && (
          <div className="mt-6 text-left bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-5 animate-[slideDown_0.3s_ease-out]">
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
            className="w-full p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-left space-y-1.5"
          >
            {/* Baris 1: Ikon HP sejajar dengan teks Ada notifikasi Chrome yang mengganggu? + Panah dropdown */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="bg-blue-100 dark:bg-blue-800/50 p-1.5 rounded-lg shrink-0">
                  <Smartphone size={16} className="text-blue-600 dark:text-blue-400" />
                </div>
                <p className="font-bold text-xs sm:text-sm text-blue-900 dark:text-blue-200">
                  Ada notifikasi Chrome yang mengganggu?
                </p>
              </div>
              {showChromeGuide ? <ChevronUp size={16} className="text-blue-500 shrink-0" /> : <ChevronDown size={16} className="text-blue-500 shrink-0" />}
            </div>

            {/* Baris 2: Merapat ke kiri sejajar ujung kiri ikon HP */}
            <p className="text-[11px] sm:text-xs text-blue-600 dark:text-blue-400 leading-tight">
              &quot;Ketuk untuk menyalin URL aplikasi ini&quot; — cara mematikannya
            </p>
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

      <div id="siaran-wa-manual" className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 overflow-hidden">
        <h3 className="font-bold text-xl text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
          <MessageCircle className="text-green-500" /> Siaran WhatsApp (Manual)
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Kirim pesan siaran langsung ke aplikasi WhatsApp asli Anda (anti-blokir). Pesan otomatis diisi, Anda hanya perlu klik tombol kirim di aplikasi WA.
        </p>

        {/* Mode Selector for Siaran WA Manual */}
        {(role === 'admin' || role === 'staff') && (
          <div className="flex bg-gray-50 dark:bg-gray-900/50 p-1 rounded-xl border border-gray-150/50 dark:border-gray-700/50 mb-6 gap-1">
            <button
              onClick={() => setManualMode('absensi')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                manualMode === 'absensi'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/30'
              }`}
            >
              Laporan Absensi
            </button>
            <button
              onClick={() => setManualMode('info_akun')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                manualMode === 'info_akun'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/30'
              }`}
            >
              Info Akun Wali Murid
            </button>
            {role === 'admin' && (
              <button
                onClick={() => {
                  setManualMode('pembayaran');
                  if (billingList.length === 0) {
                    setLoadingBilling(true);
                    fetch('/api/billing')
                      .then(r => r.json())
                      .then(d => {
                        if (d.success) setBillingList(d.data.filter((b: any) => b.status === 'Belum'));
                      })
                      .catch(console.error)
                      .finally(() => setLoadingBilling(false));
                  }
                }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                  manualMode === 'pembayaran'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/30'
                }`}
              >
                💳 Tagihan
              </button>
            )}
          </div>
        )}

        {/* ===== TAB TAGIHAN & PEMBAYARAN ===== */}
        {manualMode === 'pembayaran' && (
          <div className="space-y-4">
            {/* Templat Pesan Pengingat Tagihan */}
            <div className="bg-orange-50/30 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-900/30 rounded-2xl p-4">
              <label className="block text-xs font-bold text-orange-800 dark:text-orange-400 mb-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span>✏️ Edit Templat Pesan Pengingat Tagihan</span>
                <span className="text-[10px] font-normal text-gray-400">Placeholder: &#123;nama_santri&#125;, &#123;nama_tagihan&#125;, &#123;periode&#125;, &#123;nominal&#125;</span>
              </label>
              <textarea
                value={pesanBillingTemplate}
                onChange={(e) => {
                  setPesanBillingTemplate(e.target.value);
                  localStorage.setItem('wa_template_billing', e.target.value);
                }}
                onBlur={() => saveTemplate('wa_template_billing', pesanBillingTemplate)}
                rows={6}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-orange-400 outline-none resize-none font-mono text-gray-750 dark:text-gray-300 leading-relaxed"
              />
              <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2.5 border-t border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => resetTemplate('wa_template_billing', defaultBillingTemplate, setPesanBillingTemplate)}
                  className="text-xs text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
                >⟳ Reset ke Templat Default</button>
                {saveStatus['wa_template_billing'] === 'saved' && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 size={13} /> Tersimpan di Database ✓
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => saveTemplate('wa_template_billing', pesanBillingTemplate)}
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1 min-w-[140px]"
                >
                  Simpan Templat
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Cari nama santri, NIS, atau nama wali..."
                value={billingSearch}
                onChange={(e) => setBillingSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none text-sm"
              />
            </div>

            {/* Info count */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {loadingBilling ? 'Memuat...' : `${billingList.filter(b => {
                  if (!billingSearch.trim()) return true;
                  const q = billingSearch.toLowerCase();
                  return (b.nama_santri || '').toLowerCase().includes(q) ||
                         (b.nis || '').toLowerCase().includes(q) ||
                         (b.nama_wali || '').toLowerCase().includes(q);
                }).length} santri memiliki tunggakan`}
              </p>
              <button
                onClick={() => {
                  setLoadingBilling(true);
                  fetch('/api/billing')
                    .then(r => r.json())
                    .then(d => { if (d.success) setBillingList(d.data.filter((b: any) => b.status === 'Belum')); })
                    .catch(console.error)
                    .finally(() => setLoadingBilling(false));
                }}
                className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 font-bold"
              >
                <RefreshCw size={13} className={loadingBilling ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            {/* List Tagihan Belum Lunas */}
            {loadingBilling ? (
              <div className="flex justify-center py-8"><RefreshCw className="animate-spin text-orange-500" /></div>
            ) : (() => {
              const filteredBilling = billingList.filter(b => {
                if (!billingSearch.trim()) return true;
                const q = billingSearch.toLowerCase();
                return (b.nama_santri || '').toLowerCase().includes(q) ||
                       (b.nis || '').toLowerCase().includes(q) ||
                       (b.nama_wali || '').toLowerCase().includes(q);
              });

              if (filteredBilling.length === 0) {
                return (
                  <div className="text-center py-10 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">✅ Tidak ada tagihan yang belum lunas{billingSearch ? ` untuk "${billingSearch}"` : ''}.</p>
                  </div>
                );
              }

              const formatRupiahLocal = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

              const getBillingWaLink = (b: any) => {
                let phone = (b.no_wali || '').replace(/[^0-9]/g, '');
                if (!phone) return '#';
                if (phone.startsWith('0')) phone = '62' + phone.slice(1);
                const msg = pesanBillingTemplate
                  .replace(/{nama_santri}/g, b.nama_santri)
                  .replace(/{nama_tagihan}/g, b.nama_tagihan)
                  .replace(/{periode}/g, b.periode)
                  .replace(/{nominal}/g, formatRupiahLocal(b.nominal));
                return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
              };

              return (
                <div className="space-y-3">
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-orange-50 dark:bg-orange-950/30 text-xs uppercase font-bold text-orange-700 dark:text-orange-400 border-b border-orange-200 dark:border-orange-900/50">
                        <tr>
                          <th className="px-4 py-3">Santri & Wali</th>
                          <th className="px-4 py-3">Tagihan</th>
                          <th className="px-4 py-3">Nominal</th>
                          <th className="px-4 py-3 text-right">Kirim WA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredBilling.map((b, idx) => (
                          <tr key={`${b.id}-${idx}`} className="hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-bold text-gray-800 dark:text-gray-100">{b.nama_santri}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">NIS: {b.nis}</div>
                              {b.nama_wali && <div className="text-xs text-emerald-600 dark:text-emerald-400">Wali: {b.nama_wali}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-gray-700 dark:text-gray-200">{b.nama_tagihan}</div>
                              <div className="text-xs text-gray-400">{b.periode}</div>
                            </td>
                            <td className="px-4 py-3 font-extrabold text-red-600 dark:text-red-400">{formatRupiahLocal(b.nominal)}</td>
                            <td className="px-4 py-3 text-right">
                              {b.no_wali ? (
                                <a
                                  href={getBillingWaLink(b)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => setSentBillingIds(prev => ({ ...prev, [`${b.id}`]: true }))}
                                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-105 active:scale-95 ${
                                    sentBillingIds[`${b.id}`]
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border border-green-200 dark:border-green-800'
                                      : 'bg-[#25D366] hover:bg-[#1DA851] text-white'
                                  }`}
                                >
                                  <MessageCircle size={14} />
                                  {sentBillingIds[`${b.id}`] ? 'Terkirim ✓' : 'WA Wali'}
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400 italic">No WA kosong</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="block md:hidden space-y-3">
                    {filteredBilling.map((b, idx) => (
                      <div key={`${b.id}-m-${idx}`} className={`rounded-2xl p-4 border transition-colors ${
                        sentBillingIds[`${b.id}`]
                          ? 'bg-green-50/30 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                          : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                      }`}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-extrabold text-gray-900 dark:text-white">{b.nama_santri}</div>
                            <div className="text-xs text-gray-400 font-mono">NIS: {b.nis}</div>
                          </div>
                          <span className="text-xs bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 px-2.5 py-1.5 rounded-full font-bold border border-red-200 dark:border-red-800 whitespace-nowrap text-center leading-tight shrink-0">
                            Belum Lunas
                          </span>
                        </div>
                        <div className="bg-orange-50/50 dark:bg-orange-950/20 p-3 rounded-xl text-xs space-y-1.5 border border-orange-100 dark:border-orange-900/30 mb-3">
                          <div className="flex justify-between"><span className="text-gray-500">Tagihan:</span><span className="font-bold text-gray-800 dark:text-gray-100">{b.nama_tagihan}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Periode:</span><span className="font-semibold text-gray-700 dark:text-gray-300">{b.periode}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Nominal:</span><span className="font-extrabold text-red-600 dark:text-red-400">{formatRupiahLocal(b.nominal)}</span></div>
                          {b.nama_wali && <div className="flex justify-between"><span className="text-gray-500">Wali:</span><span className="font-bold text-emerald-600 dark:text-emerald-400">{b.nama_wali}</span></div>}
                        </div>
                        {b.no_wali ? (
                          <a
                            href={getBillingWaLink(b)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setSentBillingIds(prev => ({ ...prev, [`${b.id}`]: true }))}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                              sentBillingIds[`${b.id}`]
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border border-green-200 dark:border-green-800'
                                : 'bg-[#25D366] hover:bg-[#1DA851] text-white shadow-md'
                            }`}
                          >
                            <MessageCircle size={16} />
                            {sentBillingIds[`${b.id}`] ? '✓ Pesan Terkirim' : 'Kirim WA Pengingat Tagihan'}
                          </a>
                        ) : (
                          <div className="text-center text-xs text-gray-400 italic py-2">Nomor WA wali tidak tersedia</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Dropdown default pesan WA — hanya tampil untuk mode absensi & info_akun */}
        <div className={`${manualMode === 'pembayaran' ? 'hidden' : ''} grid grid-cols-1 ${manualMode === 'info_akun' ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4 mb-6 bg-green-50/50 dark:bg-green-950/20 p-4 rounded-2xl border border-green-100 dark:border-green-900/30`}>
          <div>
            <label className="block text-xs font-bold text-green-800 dark:text-green-400 mb-1.5">Kategori Kegiatan</label>
            <select
              value={tipePesan}
              onChange={(e) => setTipePesan(e.target.value as any)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
            >
              {(role === 'admin' || role === 'staff' || userScheduleTypes.has('quran')) && (
                <option value="quran">Kelas Qur'an (Majlis)</option>
              )}
              {(role === 'admin' || role === 'staff' || userScheduleTypes.has('madin')) && (
                <option value="madin">Kelas Madin</option>
              )}
              {(role === 'admin' || role === 'staff' || userScheduleTypes.has('kamar')) && (
                <option value="kamar">Asrama (Kamar)</option>
              )}
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
                <>
                  <option value="all">Semua {tipePesan === 'kamar' ? 'Kamar' : 'Kelas'}</option>
                  {listKategori.map(k => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </>
              )}
            </select>
          </div>
          {manualMode !== 'info_akun' && (
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
          )}
        </div>

        {/* Kolom Edit Templat Pesan Wali */}
        {manualMode === 'info_akun' ? (
          <div className="mb-6 bg-green-50/20 dark:bg-green-950/10 border border-green-200/40 dark:border-green-900/20 rounded-2xl p-4">
            <label className="block text-xs font-bold text-green-800 dark:text-green-400 mb-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span>Edit Templat Pesan Info Akun Wali Murid</span>
              <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">Placeholder: &#123;nama_santri&#125;, &#123;username&#125;, &#123;password&#125;</span>
            </label>
            <textarea
              value={pesanWaliInfoTemplate}
              onChange={(e) => {
                setPesanWaliInfoTemplate(e.target.value);
                localStorage.setItem('wa_template_wali_info', e.target.value);
              }}
              onBlur={() => saveTemplate('wa_template_wali_info', pesanWaliInfoTemplate)}
              rows={4}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-green-500 outline-none resize-none font-mono text-gray-750 dark:text-gray-300 leading-relaxed"
              placeholder="Tulis templat pesan info login..."
            />
            <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2.5 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => resetTemplate('wa_template_wali_info', defaultWaliInfoTemplate, setPesanWaliInfoTemplate)}
                className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
              >⟳ Reset ke Templat Default</button>
              {saveStatus['wa_template_wali_info'] === 'saved' && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 size={13} /> Tersimpan di Database ✓
                </span>
              )}
              <button
                type="button"
                onClick={() => saveTemplate('wa_template_wali_info', pesanWaliInfoTemplate)}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1 min-w-[140px]"
              >
                Simpan Templat
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6 bg-green-50/20 dark:bg-green-950/10 border border-green-200/40 dark:border-green-900/20 rounded-2xl p-4">
            <label className="block text-xs font-bold text-green-800 dark:text-green-400 mb-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span>Edit Templat Pesan Wali Murid</span>
              <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">Placeholder: &#123;nama_santri&#125;, &#123;kegiatan&#125;, &#123;kelas&#125;, &#123;status&#125;, &#123;link_laporan&#125;</span>
            </label>
            <textarea
              value={pesanWaliTemplate}
              onChange={(e) => {
                setPesanWaliTemplate(e.target.value);
                localStorage.setItem('wa_template_wali', e.target.value);
              }}
              onBlur={() => saveTemplate('wa_template_wali', pesanWaliTemplate)}
              rows={4}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-green-500 outline-none resize-none font-mono text-gray-750 dark:text-gray-300 leading-relaxed"
              placeholder="Tulis templat pesan..."
            />
            <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2.5 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => resetTemplate('wa_template_wali', defaultWaliTemplate, setPesanWaliTemplate)}
                className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
              >⟳ Reset ke Templat Default</button>
              {saveStatus['wa_template_wali'] === 'saved' && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 size={13} /> Tersimpan di Database ✓
                </span>
              )}
              <button
                type="button"
                onClick={() => saveTemplate('wa_template_wali', pesanWaliTemplate)}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1 min-w-[140px]"
              >
                Simpan Templat
              </button>
            </div>
          </div>
        )}

        {/* Search bar — hanya tampil untuk mode absensi & info_akun */}
        {manualMode !== 'pembayaran' && (
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
        )}

        {/* Hasil / List Murid — hanya tampil untuk mode absensi & info_akun */}
        {manualMode !== 'pembayaran' && loading ? (
          <div className="flex justify-center p-8"><RefreshCw className="animate-spin text-green-500" /></div>
        ) : manualMode !== 'pembayaran' && (
          <>
            {/* Tampilan Desktop (Tabel) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="px-5 py-4 rounded-l-xl">Nama Santri</th>
                    <th className="px-5 py-4">Wali Murid</th>
                    <th className="px-5 py-4 text-right rounded-r-xl">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {!hasSearch ? (
                    <tr>
                      <td colSpan={3} className="text-center py-12">
                        <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm font-medium">
                          Gunakan fitur pencarian di atas untuk menemukan data santri,<br/>atau klik tombol di bawah ini untuk melihat seluruh data santri.
                        </p>
                        <button
                          onClick={() => setShowAllWaliData(true)}
                          className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2.5 px-6 rounded-xl transition-colors shadow-sm inline-flex items-center gap-2"
                        >
                          <Users size={16} /> Tampilkan Semua Data
                        </button>
                      </td>
                    </tr>
                  ) : filteredMurid.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-gray-500">
                        Santri &quot;{search}&quot; tidak ditemukan
                      </td>
                    </tr>
                  ) : (
                    filteredMurid.map(m => (
                      <tr key={m.murid_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-4 font-semibold text-gray-800 dark:text-gray-200">
                          {m.nama}
                          {manualMode === 'info_akun' && (
                            <div className="text-[11px] text-gray-400 dark:text-gray-500 font-mono mt-1 font-normal">
                              User: {m.nis || `2026${m.murid_id}`} | Pass: {m.nis || `2026${m.murid_id}`}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                          {m.nama_wali || '-'} <br/>
                          <span className="text-xs">{m.no_wali || 'Nomor HP tidak ada'}</span>
                        </td>
                        <td className="px-5 py-4 text-right space-x-2">
                          {manualMode === 'info_akun' && (
                            <button
                              type="button"
                              onClick={() => {
                                const username = (m.nis && m.nis.trim() !== '') ? m.nis.trim() : `2026${m.murid_id}`;
                                const password = (m.nis && m.nis.trim() !== '') ? m.nis.trim() : `2026${m.murid_id}`;
                                const text = pesanWaliInfoTemplate
                                  .replace(/{nama_santri}/g, m.nama)
                                  .replace(/{username}/g, username)
                                  .replace(/{password}/g, password);
                                navigator.clipboard.writeText(text);
                                alert('Info login disalin ke clipboard!');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
                            >
                              Salin Info
                            </button>
                          )}
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
                              {sentWaIds[m.murid_id] ? 'Terkirim' : (manualMode === 'info_akun' ? 'Kirim Info' : 'WA Wali')}
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
            </div>

            {/* Tampilan Mobile (Kartu Bertumpuk) */}
            <div className="block md:hidden space-y-4">
              {!hasSearch ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm font-medium">
                    Gunakan fitur pencarian di atas untuk menemukan data santri,<br/>atau klik tombol di bawah ini untuk melihat seluruh data santri.
                  </p>
                  <button
                    onClick={() => setShowAllWaliData(true)}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2.5 px-6 rounded-xl transition-colors shadow-sm inline-flex items-center gap-2"
                  >
                    <Users size={16} /> Tampilkan Semua Data
                  </button>
                </div>
              ) : filteredMurid.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Santri &quot;{search}&quot; tidak ditemukan
                </div>
              ) : (
                filteredMurid.map(m => (
                  <div key={m.murid_id} className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border transition-colors ${
                    sentWaIds[m.murid_id] ? 'border-green-200 dark:border-green-800 bg-green-50/10 dark:bg-green-900/10' : 'border-gray-100 dark:border-gray-700'
                  } space-y-3`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-extrabold text-gray-900 dark:text-white text-base leading-tight">{m.nama}</div>
                        <div className="text-xs text-gray-400 font-mono mt-0.5">NIS: {m.nis || '-'}</div>
                      </div>
                    </div>

                    {manualMode === 'info_akun' ? (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-xs space-y-1.5 border border-blue-100 dark:border-blue-900/30">
                        <div className="flex justify-between">
                          <span className="text-blue-800 dark:text-blue-300 font-medium">Username:</span>
                          <span className="font-bold text-blue-900 dark:text-blue-200 font-mono">{m.nis || `2026${m.murid_id}`}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-800 dark:text-blue-300 font-medium">Password Default:</span>
                          <span className="font-bold text-blue-900 dark:text-blue-200 font-mono">{m.nis || `2026${m.murid_id}`}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-gray-400 dark:text-gray-500 font-medium">Wali Murid:</span>
                          <span className="font-bold text-gray-800 dark:text-gray-200">{m.nama_wali || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 dark:text-gray-500 font-medium">No. Wali:</span>
                          <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">{m.no_wali || 'Nomor HP tidak ada'}</span>
                        </div>
                      </div>
                    )}

                    {/* Tombol WA Wali & Salin bertumpuk */}
                    <div className="grid grid-cols-1 gap-2">
                      {manualMode === 'info_akun' && (
                        <button
                          type="button"
                          onClick={() => {
                            const username = (m.nis && m.nis.trim() !== '') ? m.nis.trim() : `2026${m.murid_id}`;
                            const password = (m.nis && m.nis.trim() !== '') ? m.nis.trim() : `2026${m.murid_id}`;
                            const text = pesanWaliInfoTemplate
                              .replace(/{nama_santri}/g, m.nama)
                              .replace(/{username}/g, username)
                              .replace(/{password}/g, password);
                            navigator.clipboard.writeText(text);
                            alert('Info login disalin ke clipboard!');
                          }}
                          className="w-full flex items-center justify-center py-2.5 bg-gray-150 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs transition-colors"
                        >
                          Salin Info Login
                        </button>
                      )}
                      {m.no_wali ? (
                        <a 
                          href={getWaLink(m)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => markAsSent(m.murid_id)}
                          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold shadow-sm transition-transform active:scale-95 ${
                            sentWaIds[m.murid_id] 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border border-green-200 dark:border-green-800'
                                : 'bg-[#25D366] hover:bg-[#1DA851] text-white'
                          }`}
                        >
                          {sentWaIds[m.murid_id] ? <Check size={16} /> : <MessageCircle size={16} />}
                          {sentWaIds[m.murid_id] ? 'Info Terkirim' : (manualMode === 'info_akun' ? 'Kirim Info Akun' : 'Kirim WA Wali')}
                        </a>
                      ) : (
                        <div className="w-full bg-gray-50 dark:bg-gray-900 text-center py-2.5 rounded-xl text-xs text-gray-400 italic">
                          Nomor WhatsApp Wali Kosong
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
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
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl transition-colors border border-gray-200 dark:border-gray-600 self-center mx-auto sm:self-auto sm:mx-0 shrink-0 shadow-sm"
            >
              <RefreshCw size={12} className={loadingReminders ? 'animate-spin' : ''} />
              Segarkan Data
            </button>
          </div>

          {/* Tab Switcher: 4 Pilihan Tab Berdampingan Rapi Model Tabel Jadwal */}
          <div className="p-3 bg-gray-50/70 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setGuruCardTab('auto')}
                className={`py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all text-center flex items-center justify-center gap-1.5 shadow-sm ${
                  guruCardTab === 'auto'
                    ? 'bg-amber-500 text-white shadow-md font-extrabold'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 border border-gray-200/70 dark:border-gray-700/70'
                }`}
              >
                <AlertTriangle size={15} className={`shrink-0 ${guruCardTab === 'auto' ? 'text-white' : 'text-amber-500'}`} />
                <span>Pengingat Otomatis</span>
                {loadingReminders ? (
                  <span className="shrink-0 w-4 h-4 flex items-center justify-center"><RefreshCw size={11} className="animate-spin text-amber-300" /></span>
                ) : activeReminders.length > 0 ? (
                  <span className={`shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                    guruCardTab === 'auto' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'
                  }`}>
                    {activeReminders.length}
                  </span>
                ) : (
                  <span className={`shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                    guruCardTab === 'auto' ? 'bg-white text-green-600' : 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400'
                  }`}>
                    ✓
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setGuruCardTab('manual')}
                className={`py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all text-center flex items-center justify-center gap-1.5 shadow-sm ${
                  guruCardTab === 'manual'
                    ? 'bg-blue-600 text-white shadow-md font-extrabold'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 border border-gray-200/70 dark:border-gray-700/70'
                }`}
              >
                <Settings2 size={15} className={`shrink-0 ${guruCardTab === 'manual' ? 'text-white' : 'text-blue-500'}`} />
                <span>Pilih Manual</span>
              </button>

              <button
                type="button"
                onClick={() => setGuruCardTab('rekap')}
                className={`py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all text-center flex items-center justify-center gap-1.5 shadow-sm ${
                  guruCardTab === 'rekap'
                    ? 'bg-purple-600 text-white shadow-md font-extrabold'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 border border-gray-200/70 dark:border-gray-700/70'
                }`}
              >
                <Calendar size={15} className={`shrink-0 ${guruCardTab === 'rekap' ? 'text-white' : 'text-purple-500'}`} />
                <span>Rekap Bulanan Guru</span>
              </button>

              <button
                type="button"
                onClick={() => setGuruCardTab('info_akun')}
                className={`py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all text-center flex items-center justify-center gap-1.5 shadow-sm ${
                  guruCardTab === 'info_akun'
                    ? 'bg-emerald-600 text-white shadow-md font-extrabold'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 border border-gray-200/70 dark:border-gray-700/70'
                }`}
              >
                <Smartphone size={15} className={`shrink-0 ${guruCardTab === 'info_akun' ? 'text-white' : 'text-emerald-500'}`} />
                <span>Info Akun Guru</span>
              </button>
            </div>
          </div>

          {/* Kolom Edit Templat Pesan Guru */}
          {guruCardTab === 'info_akun' ? (
            <div className="mx-6 mt-5 mb-1 bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-200/40 dark:border-emerald-900/20 rounded-xl p-4 animate-[fadeIn_0.3s_ease-out]">
              <label className="block text-xs font-bold text-emerald-800 dark:text-emerald-450 mb-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span>Edit Templat Pesan Info Akun Guru</span>
                <span className="text-[10px] font-normal text-gray-405 dark:text-gray-500">Placeholder: &#123;nama_guru&#125;, &#123;username&#125;, &#123;password&#125;</span>
              </label>
              <textarea
                value={pesanGuruInfoTemplate}
                onChange={(e) => {
                  setPesanGuruInfoTemplate(e.target.value);
                  localStorage.setItem('wa_template_guru_info', e.target.value);
                }}
                onBlur={() => saveTemplate('wa_template_guru_info', pesanGuruInfoTemplate)}
                rows={4}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none resize-none font-mono text-gray-750 dark:text-gray-300 leading-relaxed"
                placeholder="Tulis templat pesan info login guru..."
              />
              <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2.5 border-t border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => resetTemplate('wa_template_guru_info', defaultGuruInfoTemplate, setPesanGuruInfoTemplate)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >⟳ Reset ke Templat Default</button>
                {saveStatus['wa_template_guru_info'] === 'saved' && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 size={13} /> Tersimpan di Database ✓
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => saveTemplate('wa_template_guru_info', pesanGuruInfoTemplate)}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1 min-w-[140px]"
                >
                  Simpan Templat
                </button>
              </div>
            </div>
          ) : guruCardTab === 'rekap' ? (
            <div className="mx-6 mt-5 mb-1 bg-purple-50/20 dark:bg-purple-950/10 border border-purple-200/40 dark:border-purple-900/20 rounded-xl p-4 animate-[fadeIn_0.3s_ease-out]">
              <label className="block text-xs font-bold text-purple-900 dark:text-purple-300 mb-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span>Edit Templat Pesan Rekapitulasi Bulanan Guru</span>
                <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">Placeholder: &#123;nama_guru&#125;, &#123;bulan_tahun&#125;, &#123;daftar_kelas&#125;, &#123;ringkasan_kehadiran&#125;, &#123;link_rekap&#125;</span>
              </label>
              <textarea
                value={pesanRekapGuruTemplate}
                onChange={(e) => {
                  setPesanRekapGuruTemplate(e.target.value);
                  localStorage.setItem('wa_template_guru_rekap', e.target.value);
                }}
                onBlur={() => saveTemplate('wa_template_guru_rekap', pesanRekapGuruTemplate)}
                rows={6}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 outline-none resize-none font-mono text-gray-750 dark:text-gray-300 leading-relaxed"
                placeholder="Tulis templat pesan rekapitulasi guru..."
              />
              <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2.5 border-t border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => resetTemplate('wa_template_guru_rekap', defaultRekapGuruTemplate, setPesanRekapGuruTemplate)}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                >⟳ Reset ke Templat Default</button>
                {saveStatus['wa_template_guru_rekap'] === 'saved' && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 size={13} /> Tersimpan di Database ✓
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => saveTemplate('wa_template_guru_rekap', pesanRekapGuruTemplate)}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1 min-w-[140px]"
                >
                  Simpan Templat
                </button>
              </div>
            </div>
          ) : (
            <div className="mx-6 mt-5 mb-1 bg-amber-50/30 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-4">
              <label className="block text-xs font-bold text-amber-800 dark:text-amber-400 mb-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span>Edit Templat Pesan Guru</span>
                <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">Placeholder: &#123;nama_guru&#125;, &#123;kegiatan&#125;, &#123;label_mapel&#125;, &#123;mapel&#125;, &#123;kelas&#125;, &#123;jam&#125;</span>
              </label>
              <textarea
                value={pesanGuruTemplate}
                onChange={(e) => {
                  setPesanGuruTemplate(e.target.value);
                  localStorage.setItem('wa_template_guru', e.target.value);
                }}
                onBlur={() => saveTemplate('wa_template_guru', pesanGuruTemplate)}
                rows={5}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none resize-none font-mono text-gray-750 dark:text-gray-300 leading-relaxed"
                placeholder="Tulis templat pesan..."
              />
              <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2.5 border-t border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => resetTemplate('wa_template_guru', defaultGuruTemplate, setPesanGuruTemplate)}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                >⟳ Reset ke Templat Default</button>
                {saveStatus['wa_template_guru'] === 'saved' && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 size={13} /> Tersimpan di Database ✓
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => saveTemplate('wa_template_guru', pesanGuruTemplate)}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1 min-w-[140px]"
                >
                  Simpan Templat
                </button>
              </div>
            </div>
          )}

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

                  {/* Banner Peringatan Mode Libur */}
                  {isModeLibur && (
                    <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
                      <div className="flex items-center gap-2.5 font-bold">
                        <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                        <span>🏖️ Mode Libur Pondok Sedang Aktif — Pengingat WA otomatis dijeda sementara.</span>
                      </div>
                      <a href="/dashboard/settings" className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-sm self-start sm:self-auto shrink-0 transition-transform active:scale-95">
                        Ubah di Pengaturan
                      </a>
                    </div>
                  )}

                  <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mb-3 flex items-center gap-1.5">
                    <AlertTriangle size={13} className="animate-pulse" />
                    {activeReminders.length} guru/pengurus belum mengisi absensi pada jadwal aktif saat ini.
                  </p>
                  {/* Sub-tab Switcher */}
                  <div className="flex flex-col gap-2 mb-4">
                    {/* Semua — Baris tersendiri di atas, memanjang secara penuh */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700/50 w-full">
                      <button
                        type="button"
                        onClick={() => setSubTabAuto('semua')}
                        className={`w-full flex items-center justify-center gap-1.5 px-6 py-2 text-xs font-bold rounded-lg transition-all ${
                          subTabAuto === 'semua'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        Semua
                        <span className={`text-[10px] px-2 py-0.5 rounded-full leading-none font-extrabold ${
                          subTabAuto === 'semua' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>{activeReminders.length}</span>
                      </button>
                    </div>

                    {/* Sub-tab lainnya berdampingan di bawah */}
                    <div className="flex bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700/50 overflow-x-auto scrollbar-none gap-1.5 w-full">
                      {[
                        { id: 'quran', label: "Kelas Qur'an", count: activeReminders.filter(r => r.tipe === 'quran').length },
                        { id: 'madin', label: 'Kelas Madin', count: activeReminders.filter(r => r.tipe === 'madin').length },
                        { id: 'kamar', label: 'Kamar / Asrama', count: activeReminders.filter(r => r.tipe === 'kamar').length },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setSubTabAuto(tab.id as any)}
                          className={`flex-1 min-w-[125px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                            subTabAuto === tab.id
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
                          }`}
                        >
                          {tab.label}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full leading-none font-extrabold ${
                            subTabAuto === tab.id
                              ? 'bg-white/20 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>
                            {tab.count}
                          </span>
                        </button>
                      ))}
                    </div>
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
                                <th className="px-4 py-3 font-bold text-right rounded-r-xl">Aksi Notifikasi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {filteredActiveReminders.map(r => {
                                const reminderKey = `${r.tipe}_${r.jadwal_id}_${new Date().toLocaleDateString()}`;
                                const isSent = sentReminderIds[reminderKey];
                                const isSendingSingle = sendingSingleKey === reminderKey;
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
                                        <div className="inline-flex items-center gap-1.5">
                                          {/* Tombol Auto WA Scheduler */}
                                          <button
                                            type="button"
                                            onClick={() => handleSingleScheduleWA(r)}
                                            disabled={isSendingSingle}
                                            title="Jadwalkan otomatis via WA Scheduler"
                                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${
                                              isSent 
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' 
                                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                            }`}
                                          >
                                            {isSendingSingle ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                                            {isSent ? 'Terjadwal' : 'Auto WA'}
                                          </button>

                                          {/* Tombol Manual WA.me */}
                                          <a
                                            href={getWaGuruReminderLink(r)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => markReminderAsSent(reminderKey)}
                                            title="Kirim manual via tautan wa.me"
                                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                                          >
                                            <MessageCircle size={12} className="text-[#25D366]" />
                                            Manual
                                          </a>
                                        </div>
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
                            const isSendingSingle = sendingSingleKey === reminderKey;
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

                                {/* Tombol Aksi bertumpuk */}
                                <div className="grid grid-cols-2 gap-2">
                                  {r.guru_whatsapp ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleSingleScheduleWA(r)}
                                        disabled={isSendingSingle}
                                        className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 ${
                                          isSent
                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                        }`}
                                      >
                                        {isSendingSingle ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                                        {isSent ? 'Terjadwal' : 'Auto WA'}
                                      </button>
                                      <a
                                        href={getWaGuruReminderLink(r)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => markReminderAsSent(reminderKey)}
                                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700/60 hover:bg-gray-200 transition-all active:scale-95"
                                      >
                                        <MessageCircle size={13} className="text-[#25D366]" />
                                        Manual
                                      </a>
                                    </>
                                  ) : (
                                    <div className="col-span-2 bg-gray-50 dark:bg-gray-900 text-center py-2.5 rounded-xl text-xs text-gray-400 italic">
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
                <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                  {!selectedGuruObj ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                      Data guru tidak ditemukan
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
                      {/* Nama Guru */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                          <Users size={18} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">{selectedGuruObj.nama}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {selectedJadwalGuru ? (
                              <span>📚 {selectedJadwalGuru}</span>
                            ) : (
                              <span className="italic">Tidak ada jadwal aktif</span>
                            )}
                          </p>
                        </div>
                      </div>
                      {/* Tombol Aksi */}
                      <div className="flex flex-col gap-2">
                        {selectedGuruObj.whatsapp ? (
                          <>
                            <a
                              href={getWaGuruLink(selectedGuruObj)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1DA851] text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-transform hover:scale-105 active:scale-95 w-full"
                            >
                              <MessageCircle size={16} />
                              {fetchingQuickUrl ? 'Menyiapkan Link...' : 'Kirim WA ke Guru'}
                            </a>
                            {guruQuickUrl && (
                              <p className="text-[10px] text-center text-green-600 dark:text-green-400 font-semibold flex items-center justify-center gap-1">
                                <Zap size={10} /> Link absen cepat tersedia
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-2 text-xs text-gray-400 dark:text-gray-500 italic bg-gray-50 dark:bg-gray-900 rounded-xl">
                            Nomor WA belum diisi
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ---- TAB: Rekap Bulanan Guru ---- */}
          {guruCardTab === 'rekap' && (
            <div className="p-6 pt-4 space-y-5 animate-[fadeIn_0.3s_ease-out]">
              {/* Header Box Penjelasan */}
              <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50/40 to-purple-50/30 dark:from-purple-950/30 dark:via-indigo-950/20 dark:to-purple-950/10 rounded-2xl border border-purple-200/60 dark:border-purple-800/40">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-purple-600 text-white rounded-xl shadow-sm shrink-0">
                      <Calendar size={18} />
                    </div>
                    <h4 className="font-extrabold text-sm text-purple-950 dark:text-purple-200 leading-tight">
                      Siaran Rekapitulasi Absensi Bulanan ke Guru
                    </h4>
                  </div>
                  <p className="text-xs text-purple-800/80 dark:text-purple-300/80">
                    Kirim ringkasan mengajar dan link preview rekap santri per kelas langsung ke WhatsApp guru.
                  </p>
                </div>
              </div>

              {/* Form Konfigurasi Periode & Kategori */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Pilih Periode Bulan & Tahun */}
                <div className="p-4 bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    1. Periode Rekapitulasi
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Bulan</label>
                      <select
                        value={rekapBulan}
                        onChange={(e) => setRekapBulan(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                      >
                        {[
                          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                        ].map((m, idx) => (
                          <option key={idx + 1} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Tahun</label>
                      <select
                        value={rekapTahun}
                        onChange={(e) => setRekapTahun(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                      >
                        {[2025, 2026, 2027, 2028].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Rekapitulasi akan menghitung kehadiran guru & santri pada bulan terpilih.
                  </p>
                </div>

                {/* 2. Pilih Kategori Jadwal (Checkbox) */}
                <div className="p-4 bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    2. Kategori Jadwal Mengajar
                  </label>
                  <div className="space-y-2">
                    {[
                      { key: 'madin', label: '📚 Madrasah Diniyah (Madin)', desc: 'Jadwal & pelajaran diniyah (Aktif)' },
                      { key: 'quran', label: "🕌 Kelas Qur'an", desc: 'Majlis Al-Qur\'an & Tahfidz' },
                      { key: 'kamar', label: '🏠 Asrama / Kamar', desc: 'Kegiatan & piket asrama' },
                    ].map(({ key, label, desc }) => {
                      const checked = rekapCategories.includes(key);
                      return (
                        <label
                          key={key}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                            checked
                              ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700 text-purple-950 dark:text-purple-200'
                              : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRekapCategory(key)}
                            className="mt-0.5 accent-purple-600 w-3.5 h-3.5 shrink-0"
                          />
                          <div>
                            <span className="block text-xs font-bold">{label}</span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">{desc}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Status Alert Rekapitulasi */}
              {rekapStatusMsg && (
                <div className={`p-4 rounded-2xl border ${
                  rekapStatusMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                }`}>
                  <div className="flex items-center gap-2 font-bold mb-1 text-xs">
                    {rekapStatusMsg.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-red-600" />}
                    <span>{rekapStatusMsg.text}</span>
                  </div>
                  {rekapStatusMsg.details && Array.isArray(rekapStatusMsg.details) && (
                    <div className="mt-2.5 max-h-36 overflow-y-auto space-y-1 text-[11px] pr-1">
                      {rekapStatusMsg.details.map((det: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-black/5 dark:border-white/5">
                          <span className="font-medium">{det.guru_nama} ({det.phone})</span>
                          <span className={det.success ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                            {det.success ? '✓ Terjadwal' : `✗ ${det.error || 'Gagal'}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tombol Aksi Kirim / Jadwalkan Rekap */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isRekapScheduling || isRekapSending}
                  onClick={() => handleSendRekapWA('schedule_monthly')}
                  className="w-full sm:w-auto px-5 py-3 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  title="Jadwalkan pengiriman otomatis setiap tanggal 1 jam 08:00 WIB"
                >
                  {isRekapScheduling ? <Loader2 size={15} className="animate-spin" /> : <Clock size={15} />}
                  <span>{isRekapScheduling ? 'Menjadwalkan...' : 'Jadwalkan Tiap Tgl 1 (Looping Bulanan)'}</span>
                </button>
                <button
                  type="button"
                  disabled={isRekapSending || isRekapScheduling}
                  onClick={() => handleSendRekapWA('send_now')}
                  className="w-full sm:w-auto px-6 py-3 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  {isRekapSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  <span>{isRekapSending ? 'Sedang Mengirim...' : 'Kirim Rekap Sekarang'}</span>
                </button>
              </div>

              {/* Card Khusus Laporan ke Kepala Madin */}
              <div className="mt-8 pt-6 border-t-2 border-dashed border-purple-200 dark:border-purple-800/60 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-500 text-white rounded-xl shadow-sm shrink-0">
                      <Award size={18} />
                    </div>
                    <h4 className="font-extrabold text-sm text-gray-900 dark:text-gray-100 leading-tight">
                      Laporan Evaluasi Khusus Kepala Madrasah Diniyah (Madin)
                    </h4>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Kirim rekapitulasi kehadiran seluruh dewan guru Madin bulan terpilih langsung ke WhatsApp Kepala Madin.
                  </p>
                </div>

                {/* Pilih Sasaran Wilayah Kepala Madin: Putra vs Putri vs Semua */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Sasaran Kepala Madin
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-gray-100 dark:bg-gray-900/60 p-1 rounded-2xl border border-gray-200/50 dark:border-gray-700/60">
                    {[
                      { key: 'putra', label: 'Madin Putra' },
                      { key: 'putri', label: 'Madin Putri' },
                      { key: 'all', label: 'Semua Madin' },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => handleTargetKepalaMadinChange(tab.key as any)}
                        className={`py-2 px-1 text-xs font-bold rounded-xl transition-all text-center flex items-center justify-center gap-1 ${
                          kepalaMadinTarget === tab.key
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-purple-50/40 dark:bg-purple-950/20 p-4 rounded-2xl border border-purple-200/50 dark:border-purple-800/30">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      Pilih Akun Guru ({kepalaMadinTarget === 'putra' ? 'Kepala Madin Putra' : kepalaMadinTarget === 'putri' ? 'Kepala Madin Putri' : 'Kepala Madin'})
                    </label>
                    <select
                      value={selectedKepalaMadinId}
                      onChange={(e) => handleSelectKepalaMadin(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="">-- Pilih dari Daftar Dewan Guru / Pengurus --</option>
                      {guruList.map(g => (
                        <option key={g.guru_id} value={g.guru_id}>
                          {g.nama} {g.jabatan ? `(${g.jabatan})` : ''} - {g.whatsapp || 'No WA (-) '}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      Nomor WhatsApp Tujuan ({kepalaMadinTarget === 'putra' ? 'Madin Putra' : kepalaMadinTarget === 'putri' ? 'Madin Putri' : 'Kepala Madin'})
                    </label>
                    <input
                      type="text"
                      value={kepalaMadinPhone}
                      onChange={(e) => {
                        setKepalaMadinPhone(e.target.value);
                        if (typeof window !== 'undefined') {
                          localStorage.setItem(`kepala_madin_${kepalaMadinTarget}_phone`, e.target.value);
                        }
                      }}
                      placeholder="Contoh: 081234567890"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <div className="mt-2 p-2 bg-sky-50 dark:bg-sky-950/30 rounded-lg border border-sky-200 dark:border-sky-800 flex items-center justify-between text-xs">
                      <span className="text-sky-900 dark:text-sky-300 font-medium flex items-center gap-1.5">
                        <Send size={12} className="text-sky-500" />
                        Jalur Telegram Bot:
                      </span>
                      <a
                        href={`https://t.me/ppma_notif_bot?start=kepala_madin_${kepalaMadinTarget}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                      >
                        Hubungkan Telegram Kepala Madin 📲
                      </a>
                    </div>
                  </div>
                </div>

                {/* Status Alert Kepala Madin */}
                {kepalaMadinStatusMsg && (
                  <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 font-bold ${
                    kepalaMadinStatusMsg.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                  }`}>
                    {kepalaMadinStatusMsg.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={16} className="text-red-600 shrink-0" />}
                    <span>{kepalaMadinStatusMsg.text}</span>
                  </div>
                )}

                {/* Tombol Aksi Kepala Madin */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    disabled={isKepalaMadinScheduling || isKepalaMadinSending}
                    onClick={() => handleSendKepalaMadin('schedule_monthly')}
                    className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 border border-amber-300 dark:border-amber-700 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isKepalaMadinScheduling ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                    <span>{isKepalaMadinScheduling ? 'Menjadwalkan...' : `Jadwalkan ke Kepala ${kepalaMadinTarget === 'putri' ? 'Madin Putri' : kepalaMadinTarget === 'putra' ? 'Madin Putra' : 'Madin'} Tiap Tgl 1`}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isKepalaMadinSending || isKepalaMadinScheduling}
                    onClick={() => handleSendKepalaMadin('send_now')}
                    className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95"
                  >
                    {isKepalaMadinSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>{isKepalaMadinSending ? 'Mengirim...' : `Kirim ke Kepala ${kepalaMadinTarget === 'putri' ? 'Madin Putri' : kepalaMadinTarget === 'putra' ? 'Madin Putra' : 'Madin'} Sekarang`}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---- TAB: Info Akun Guru & Staff ---- */}
          {guruCardTab === 'info_akun' && (
            <div className="p-6 pt-4 space-y-4 animate-[fadeIn_0.3s_ease-out]">
              {/* Search input for Guru */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Cari guru/staff berdasarkan nama atau NIP..."
                  value={guruSearch}
                  onChange={(e) => setGuruSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all"
                />
              </div>

              <div className="space-y-3">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-3 rounded-l-xl">Nama Guru / Staff</th>
                        <th className="px-4 py-3">NIP</th>
                        <th className="px-4 py-3">Username / Sandi Default</th>
                        <th className="px-4 py-3 text-right rounded-r-xl">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {!(guruSearch.trim().length > 0 || showAllInfoGuru) ? (
                        <tr>
                          <td colSpan={4} className="text-center py-12">
                            <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm font-medium">
                              Gunakan fitur pencarian di atas untuk menemukan data guru/staff,<br/>atau klik tombol di bawah ini untuk melihat seluruh data guru/staff.
                            </p>
                            <button
                              onClick={() => setShowAllInfoGuru(true)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 px-6 rounded-xl transition-colors shadow-sm inline-flex items-center gap-2"
                            >
                              <Users size={16} /> Tampilkan Semua Data
                            </button>
                          </td>
                        </tr>
                      ) : (
                        (() => {
                          const filteredGurus = guruList.filter(g => 
                            g.nama?.toLowerCase().includes(guruSearch.toLowerCase()) || 
                            g.nip?.includes(guruSearch)
                          );
                          if (filteredGurus.length === 0) {
                            return (
                              <tr>
                                <td colSpan={4} className="text-center py-8 text-gray-500">
                                  Guru/Staff tidak ditemukan
                                </td>
                              </tr>
                            );
                          }
                          return filteredGurus.map((g: any) => {
                            const username = (g.nip && g.nip.trim() !== '') ? `2026${g.nip.trim()}` : `2026${g.guru_id}`;
                            const defaultPassword = (g.nip && g.nip.trim() !== '') ? `2026${g.nip.trim()}` : `2026${g.guru_id}`;
                            const waMessage = pesanGuruInfoTemplate
                              .replace(/{nama_guru}/g, g.nama)
                              .replace(/{username}/g, username)
                              .replace(/{password}/g, defaultPassword);

                            return (
                              <tr key={g.guru_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">{g.nama}</td>
                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">{g.nip || '-'}</td>
                                <td className="px-4 py-3 text-xs">
                                  <div className="font-mono"><span className="text-gray-400">User:</span> {username}</div>
                                  <div className="font-mono"><span className="text-gray-400">Pass:</span> {defaultPassword}</div>
                                </td>
                                <td className="px-4 py-3 text-right space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(waMessage);
                                      alert('Pesan info login berhasil disalin ke clipboard!');
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-lg text-xs transition-colors"
                                  >
                                    Salin Info
                                  </button>
                                  {g.whatsapp ? (
                                    <a
                                      href={getWaGuruInfoLink(g)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#1DA851] text-white font-bold rounded-lg text-xs transition-transform hover:scale-105 active:scale-95"
                                    >
                                      Kirim WA
                                    </a>
                                  ) : (
                                    <span className="text-xs text-gray-400 italic">No WA Kosong</span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })()
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="block md:hidden space-y-3">
                  {!(guruSearch.trim().length > 0 || showAllInfoGuru) ? (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-750">
                      <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm font-medium font-medium">
                        Gunakan fitur pencarian di atas untuk menemukan data guru/staff,<br/>atau klik tombol di bawah ini untuk melihat seluruh data guru/staff.
                      </p>
                      <button
                        onClick={() => setShowAllInfoGuru(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 px-6 rounded-xl transition-colors shadow-sm inline-flex items-center gap-2"
                      >
                        <Users size={16} /> Tampilkan Semua Data
                      </button>
                    </div>
                  ) : (
                    (() => {
                      const filteredGurus = guruList.filter(g => 
                        g.nama?.toLowerCase().includes(guruSearch.toLowerCase()) || 
                        g.nip?.includes(guruSearch)
                      );
                      if (filteredGurus.length === 0) {
                        return (
                          <div className="text-center py-8 text-gray-500">
                            Guru/Staff tidak ditemukan
                          </div>
                        );
                      }
                      return filteredGurus.map((g: any) => {
                        const username = (g.nip && g.nip.trim() !== '') ? `2026${g.nip.trim()}` : `2026${g.guru_id}`;
                        const defaultPassword = (g.nip && g.nip.trim() !== '') ? `2026${g.nip.trim()}` : `2026${g.guru_id}`;
                        const waMessage = pesanGuruInfoTemplate
                          .replace(/{nama_guru}/g, g.nama)
                          .replace(/{username}/g, username)
                          .replace(/{password}/g, defaultPassword);

                        return (
                          <div key={g.guru_id} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-750 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-extrabold text-gray-900 dark:text-white text-base leading-tight">{g.nama}</div>
                                <div className="text-xs text-gray-400 font-mono mt-0.5">NIP: {g.nip || '-'}</div>
                              </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl text-xs space-y-1.5 border border-gray-100 dark:border-gray-750">
                              <div className="flex justify-between">
                                <span className="text-gray-450 font-medium">Username:</span>
                                <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">{username}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-450 font-medium">Password Default:</span>
                                <span className="font-bold text-gray-800 dark:text-gray-205 font-mono">{defaultPassword}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(waMessage);
                                  alert('Pesan info login berhasil disalin ke clipboard!');
                                }}
                                className="w-full flex items-center justify-center py-2.5 bg-gray-150 hover:bg-gray-200 dark:bg-gray-750 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs transition-colors"
                              >
                                Salin Info
                              </button>
                              {g.whatsapp ? (
                                  <a
                                    href={getWaGuruInfoLink(g)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#25D366] hover:bg-[#1DA851] text-white font-bold rounded-xl text-xs transition-transform active:scale-95"
                                  >
                                    Kirim WA
                                  </a>
                              ) : (
                                <div className="w-full bg-gray-100 dark:bg-gray-800 text-center py-2.5 rounded-xl text-xs text-gray-400 italic">
                                  No WA Kosong
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Modal Dialog Konfigurasi WA Scheduler */}
      {schedulerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[78vh] sm:max-h-[82vh]">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-800 dark:text-gray-100">
                    Otomatisasi WA Scheduler
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Kirim jadwal pengingat ke wa.quizb.my.id</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSchedulerModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg font-bold p-1 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 py-3 pr-1 space-y-3.5 text-xs">
              {/* Pilihan Target Jadwal */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                  Target Pengiriman
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSchedulerMode('active_today')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      schedulerMode === 'active_today'
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 font-bold ring-2 ring-emerald-400/20'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs">Jadwal Aktif Hari Ini</span>
                      {schedulerMode === 'active_today' && <Check size={14} className="text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-normal">
                      Hanya guru pada jadwal aktif saat ini ({activeReminders.length} jadwal).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSchedulerMode('all_schedules')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      schedulerMode === 'all_schedules'
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 font-bold ring-2 ring-emerald-400/20'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs">Semua Jadwal Rutin</span>
                      {schedulerMode === 'all_schedules' && <Check size={14} className="text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-normal">
                      Seluruh jadwal Madin, Qur&apos;an, &amp; Asrama — dikirim <span className="font-bold text-emerald-700 dark:text-emerald-400">mingguan (weekly)</span> sesuai hari mengajar masing-masing guru.
                    </p>
                  </button>
                </div>
              </div>

              {/* Waktu Pengingat Sebelum Masuk */}
              <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Waktu Pengingat Sebelum Masuk
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={schedulerLeadTime}
                    onChange={(e) => setSchedulerLeadTime(parseInt(e.target.value) || 0)}
                    className="w-20 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded-lg text-center font-bold text-gray-800 dark:text-gray-200"
                  />
                  <span className="text-gray-500">Menit sebelum jam mulai mengajar</span>
                </div>
              </div>

              {/* Toggle Looping Mingguan (jika mode all_schedules) */}
              {schedulerMode === 'all_schedules' && (
                <div className="flex items-center justify-between p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/60">
                  <div>
                    <span className="font-bold text-emerald-950 dark:text-emerald-200 block">Ulangi Pengiriman Setiap Pekan (Mingguan)</span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400">Pesan hanya dikirim pada hari mengajar guru — bukan setiap hari</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={schedulerIsLoop}
                      onChange={(e) => setSchedulerIsLoop(e.target.checked)}
                    />
                    <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              )}

              {/* Pilih Kategori Jadwal */}
              <div className="p-3 bg-amber-50/40 dark:bg-amber-900/10 rounded-xl border border-amber-200/60 dark:border-amber-800/30">
                <label className="block font-bold text-amber-800 dark:text-amber-300 mb-2.5 text-[11px] uppercase tracking-wider">
                  Pilih Kategori Jadwal yang Dikirim
                </label>
                <div className="space-y-2">
                  {[
                    { key: 'madin', label: '📚 Madrasah Diniyah (Madin)', desc: 'Jadwal ngaji & pelajaran diniyah' },
                    { key: 'quran', label: "🕌 Kelas Qur'an", desc: 'Majlis Al-Qur\'an & halaqoh' },
                    { key: 'kamar', label: '🏠 Asrama / Kamar', desc: 'Kegiatan & piket asrama' },
                  ].map(({ key, label, desc }) => {
                    const checked = schedulerCategories.includes(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all select-none ${
                          checked
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSchedulerCategory(key)}
                          className="mt-0.5 accent-emerald-500 w-3.5 h-3.5 shrink-0"
                        />
                        <div>
                          <span className={`block text-xs font-bold ${checked ? 'text-emerald-900 dark:text-emerald-200' : 'text-gray-600 dark:text-gray-400'}`}>{label}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Status Ringkasan Hasil */}
              {schedulerStatusMsg && (
                <div className={`p-3.5 rounded-xl border ${
                  schedulerStatusMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                }`}>
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {schedulerStatusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{schedulerStatusMsg.text}</span>
                  </div>
                  {schedulerStatusMsg.details && Array.isArray(schedulerStatusMsg.details) && (
                    <div className="mt-2 max-h-32 overflow-y-auto space-y-1 text-[11px] pr-1">
                      {schedulerStatusMsg.details.map((det: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center py-0.5 border-b border-black/5 dark:border-white/5">
                          <span className="font-medium">{det.guru_nama} ({det.phone})</span>
                          <span className={det.success ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                            {det.success ? `✓ ${det.scheduled_time?.slice(11) || 'OK'}` : `✗ ${det.error || 'Gagal'}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0 grid grid-cols-2 gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setSchedulerModalOpen(false)}
                className="py-2.5 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={isSchedulerSending}
                onClick={() => handleBulkScheduleWA()}
                className="py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSchedulerSending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {isSchedulerSending ? 'Memproses...' : 'Mulai Jadwalkan'}
              </button>
            </div>
          </div>
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
