'use client';

import { useState, useEffect } from 'react';
import { Settings, Power, Clock, Save, AlertTriangle, CheckCircle, Bell, RefreshCw, Calendar, Building2, Database, ChevronDown, ChevronUp, MessageSquare, Sheet, ExternalLink, Loader2, Megaphone, BookOpen, Users, MapPin } from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);

  const [settings, setSettings] = useState({
    absensi_otomatis: false,
    absensi_otomatis_madin: true,
    absensi_otomatis_quran: false,
    absensi_otomatis_kegiatan: false,
    mode_libur: false,
    waktu_tenggang: 2,
    waktu_mulai: 30,
    lat_pesantren: '',
    lng_pesantren: '',
    radius_absen: 50,
    rutinitas_sinkronisasi: 'manual',
    terakhir_sinkronisasi: '',
    nomor_cs: '+628133129223',
    wa_scheduler_api_key: 'wa-key-923332d62d67d2511393e0c6d8ff5e59',
    wa_scheduler_lead_time: 15,
    wa_scheduler_is_loop: true,
    wa_scheduler_endpoint: 'https://wa.quizb.my.id/api/send.php',
    jeda_panggilan_wali: 5,
    jeda_panggilan_pengurus: 2,
    radius_panggilan_wali: true
  });

  const [testingWa, setTestingWa] = useState(false);
  const [testWaPhone, setTestWaPhone] = useState('');
  const [testWaResult, setTestWaResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // State untuk Kontrol Darurat WA Scheduler
  const [cancelingWa, setCancelingWa] = useState(false);
  const [reschedulingWa, setReschedulingWa] = useState(false);
  const [waActionMsg, setWaActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleCancelAllWa = async () => {
    if (!window.confirm('Batalkan & hapus semua pengiriman pesan otomatis di WA Scheduler?\n\nTindakan ini akan menghentikan seluruh antrean pesan di gateway wa.quizb.my.id seketika.')) {
      return;
    }
    setCancelingWa(true);
    setWaActionMsg(null);
    try {
      const res = await fetch('/api/wa-scheduler/clear-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        setWaActionMsg({ type: 'success', text: json.message || 'Semua pengiriman otomatis berhasil dibatalkan dan antrean dibersihkan!' });
      } else {
        setWaActionMsg({ type: 'error', text: json.error || 'Gagal membatalkan pengiriman.' });
      }
    } catch {
      setWaActionMsg({ type: 'error', text: 'Kesalahan jaringan saat membatalkan pengiriman.' });
    } finally {
      setCancelingWa(false);
    }
  };

  const handleRescheduleAllWa = async () => {
    if (!window.confirm('Aktifkan & jadwalkan ulang seluruh pengingat mengajar otomatis ke dewan guru?')) {
      return;
    }
    setReschedulingWa(true);
    setWaActionMsg(null);
    try {
      const res = await fetch('/api/wa-scheduler/bulk-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'all_schedules',
          categories: ['madin'],
          leadTimeMinutes: settings.wa_scheduler_lead_time,
          isLoop: settings.wa_scheduler_is_loop ? 1 : 0,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setWaActionMsg({ type: 'success', text: json.message || 'Pengiriman otomatis berhasil diaktifkan & dijadwalkan ulang!' });
      } else {
        setWaActionMsg({ type: 'error', text: json.error || 'Gagal menjadwalkan ulang pengiriman.' });
      }
    } catch {
      setWaActionMsg({ type: 'error', text: 'Kesalahan jaringan saat menjadwalkan ulang.' });
    } finally {
      setReschedulingWa(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchGSheetStatus();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      if (json.success) {
        setSettings({
          absensi_otomatis: json.data.absensi_otomatis_guru === '1' || json.data.absensi_otomatis === '1',
          absensi_otomatis_madin: json.data.absensi_otomatis_madin !== '0',
          absensi_otomatis_quran: json.data.absensi_otomatis_quran === '1',
          absensi_otomatis_kegiatan: json.data.absensi_otomatis_kegiatan === '1',
          mode_libur: json.data.mode_libur === '1',
          waktu_tenggang: isNaN(parseInt(json.data.waktu_tenggang_absensi)) ? 2 : parseInt(json.data.waktu_tenggang_absensi),
          waktu_mulai: isNaN(parseInt(json.data.waktu_mulai_absensi)) ? 30 : parseInt(json.data.waktu_mulai_absensi),
          lat_pesantren: json.data.lat_pesantren || '',
          lng_pesantren: json.data.lng_pesantren || '',
          radius_absen: parseInt(json.data.radius_absen) || 50,
          rutinitas_sinkronisasi: json.data.rutinitas_sinkronisasi || 'manual',
          terakhir_sinkronisasi: json.data.terakhir_sinkronisasi || '',
          nomor_cs: json.data.nomor_cs || '+628133129223',
          wa_scheduler_api_key: json.data.wa_scheduler_api_key || 'wa-key-923332d62d67d2511393e0c6d8ff5e59',
          wa_scheduler_lead_time: isNaN(parseInt(json.data.wa_scheduler_lead_time)) ? 15 : parseInt(json.data.wa_scheduler_lead_time),
          wa_scheduler_is_loop: json.data.wa_scheduler_is_loop !== '0',
          wa_scheduler_endpoint: json.data.wa_scheduler_endpoint || 'https://wa.quizb.my.id/api/send.php',
          jeda_panggilan_wali: isNaN(parseInt(json.data.jeda_panggilan_wali)) ? 5 : parseInt(json.data.jeda_panggilan_wali),
          jeda_panggilan_pengurus: isNaN(parseInt(json.data.jeda_panggilan_pengurus)) ? 2 : parseInt(json.data.jeda_panggilan_pengurus),
          radius_panggilan_wali: json.data.radius_panggilan_wali !== '0'
        });
      } else {
        setError(json.error || 'Gagal memuat pengaturan');
      }
    } catch (e) {
      setError('Kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handleTestWa = async () => {
    if (!testWaPhone) {
      alert('Masukkan nomor WhatsApp tujuan uji coba (contoh: 081234567890)');
      return;
    }
    setTestingWa(true);
    setTestWaResult(null);
    try {
      const res = await fetch('/api/wa-scheduler/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: testWaPhone,
          apiKey: settings.wa_scheduler_api_key
        })
      });
      const json = await res.json();
      if (json.success) {
        setTestWaResult({ success: true, message: json.message + ` (Dijadwalkan: ${json.scheduled_time})` });
      } else {
        setTestWaResult({ success: false, message: json.error || 'Gagal mengirim pesan uji coba' });
      }
    } catch (err: any) {
      setTestWaResult({ success: false, message: 'Kesalahan jaringan: ' + err.message });
    } finally {
      setTestingWa(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm('Anda yakin ingin menyimpan perubahan pengaturan sistem?')) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const json = await res.json();
      if (json.success) {
        setSuccess('Pengaturan berhasil disimpan!');
        setIsSavedSuccess(true);
        setTimeout(() => {
          setSuccess('');
          setIsSavedSuccess(false);
        }, 3500);
      } else {
        setError(json.error || 'Gagal menyimpan pengaturan');
      }
    } catch (e) {
      setError('Kesalahan jaringan saat menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState('');
  const [syncInfo, setSyncInfo] = useState<any>(null);

  // Google Sheets Sync
  const [gsheetSyncing, setGsheetSyncing] = useState(false);
  const [gsheetError, setGsheetError] = useState('');
  const [gsheetSuccess, setGsheetSuccess] = useState('');
  const [gsheetResults, setGsheetResults] = useState<any>(null);
  const [lastGSheetSync, setLastGSheetSync] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>('');

  // Setup Asrama
  const [showSetupAsrama, setShowSetupAsrama] = useState(false);
  const [asramaData, setAsramaData] = useState<any>(null);
  const [loadingAsrama, setLoadingAsrama] = useState(false);
  const [fixingAsrama, setFixingAsrama] = useState(false);
  const [fixAsramaResult, setFixAsramaResult] = useState<any>(null);
  const [fixAsramaError, setFixAsramaError] = useState('');

  // Sort state untuk tabel Akun Pengurus Asrama
  const [asramaSortKey, setAsramaSortKey] = useState<string>('nama_kamar');
  const [asramaSortDir, setAsramaSortDir] = useState<'asc' | 'desc'>('asc');

  const handleAsramaSort = (key: string) => {
    if (asramaSortKey === key) {
      setAsramaSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setAsramaSortKey(key);
      setAsramaSortDir('asc');
    }
  };

  const getSortedAsramaUsers = (users: any[]) => {
    if (!users) return [];
    return [...users].sort((a, b) => {
      let valA = a[asramaSortKey] ?? '';
      let valB = b[asramaSortKey] ?? '';
      // Numeric sort untuk kamar_id
      if (asramaSortKey === 'kamar_id') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return asramaSortDir === 'asc' ? valA - valB : valB - valA;
      }
      // Sort status: OK dulu atau Kosong dulu
      if (asramaSortKey === 'status') {
        valA = a.nama_asrama ? 1 : 0;
        valB = b.nama_asrama ? 1 : 0;
        return asramaSortDir === 'asc' ? valB - valA : valA - valB;
      }
      return asramaSortDir === 'asc'
        ? String(valA).localeCompare(String(valB), 'id', { numeric: true })
        : String(valB).localeCompare(String(valA), 'id', { numeric: true });
    });
  };

  const AsramaSortIcon = ({ col }: { col: string }) => {
    if (asramaSortKey !== col) return <span className="ml-1 text-gray-300 dark:text-gray-600">⇅</span>;
    return asramaSortDir === 'asc'
      ? <span className="ml-1 text-amber-500">↑</span>
      : <span className="ml-1 text-amber-500">↓</span>;
  };

  // Sort state untuk tabel semua kamar
  const [kamarSortKey, setKamarSortKey] = useState<string>('nama_kamar');
  const [kamarSortDir, setKamarSortDir] = useState<'asc' | 'desc'>('asc');

  const handleKamarSort = (key: string) => {
    if (kamarSortKey === key) {
      setKamarSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setKamarSortKey(key);
      setKamarSortDir('asc');
    }
  };

  const getSortedKamar = (kamar: any[]) => {
    if (!kamar) return [];
    return [...kamar].sort((a, b) => {
      let valA = a[kamarSortKey] ?? '';
      let valB = b[kamarSortKey] ?? '';
      if (kamarSortKey === 'kamar_id') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return kamarSortDir === 'asc' ? valA - valB : valB - valA;
      }
      return kamarSortDir === 'asc'
        ? String(valA).localeCompare(String(valB), 'id', { numeric: true })
        : String(valB).localeCompare(String(valA), 'id', { numeric: true });
    });
  };

  const KamarSortIcon = ({ col }: { col: string }) => {
    if (kamarSortKey !== col) return <span className="ml-1 text-gray-300 dark:text-gray-600">⇅</span>;
    return kamarSortDir === 'asc'
      ? <span className="ml-1 text-amber-500">↑</span>
      : <span className="ml-1 text-amber-500">↓</span>;
  };

  const fetchGSheetStatus = async () => {
    try {
      const res = await fetch('/api/sync/status');
      const json = await res.json();
      if (json.success) {
        setLastGSheetSync(json.last_sync);
        setSpreadsheetUrl(json.spreadsheet_url || '');
      }
    } catch { /* abaikan */ }
  };

  const handleSyncGSheet = async () => {
    setGsheetSyncing(true);
    setGsheetError('');
    setGsheetSuccess('');
    setGsheetResults(null);
    try {
      const res = await fetch('/api/sync/googlesheet', { method: 'POST' });
      const json = await res.json();
      if (json.success || json.results) {
        setGsheetSuccess(json.message || 'Sinkronisasi ke Google Sheets berhasil!');
        setGsheetResults(json.results);
        setLastGSheetSync(json.synced_at);
        if (json.spreadsheet_url) setSpreadsheetUrl(json.spreadsheet_url);
      } else {
        setGsheetError(json.error || 'Gagal sinkronisasi ke Google Sheets');
      }
    } catch (e) {
      setGsheetError('Kesalahan jaringan saat sinkronisasi Google Sheets');
    } finally {
      setGsheetSyncing(false);
    }
  };

  const fetchAsramaData = async () => {
    setLoadingAsrama(true);
    try {
      const res = await fetch('/api/debug/setup-asrama');
      const json = await res.json();
      if (json.error) {
        setFixAsramaError(json.error);
      } else {
        setAsramaData(json);
      }
    } catch (e) {
      setFixAsramaError('Gagal memuat data asrama');
    } finally {
      setLoadingAsrama(false);
    }
  };

  const handleAutoFixAsrama = async () => {
    if (!confirm('Auto-fix akan mengisi kolom nama_asrama berdasarkan pola nama kamar (misal A1→Asrama A). Lanjutkan?')) return;
    setFixingAsrama(true);
    setFixAsramaError('');
    setFixAsramaResult(null);
    try {
      const res = await fetch('/api/debug/setup-asrama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'auto' })
      });
      const json = await res.json();
      if (json.error) {
        setFixAsramaError(json.error);
      } else {
        setFixAsramaResult(json);
        // Refresh data
        await fetchAsramaData();
      }
    } catch (e) {
      setFixAsramaError('Gagal melakukan auto-fix');
    } finally {
      setFixingAsrama(false);
    }
  };

  const handleSyncManual = async () => {
    setSyncing(true);
    setSyncError('');
    setSyncSuccess('');
    setSyncInfo(null);

    try {
      const res = await fetch('/api/sync/murid');
      const json = await res.json();
      if (json.success) {
        setSyncSuccess('Sinkronisasi data santri berhasil dilakukan!');
        setSyncInfo({
          total: json.total_data_mitra || 0,
          new_students: json.new_students || 0,
          updated_students: json.updated_students || 0
        });
        
        // Perbarui tanggal terakhir sinkronisasi di state local
        setSettings(prev => ({
          ...prev,
          terakhir_sinkronisasi: new Date().toISOString()
        }));
      } else {
        setSyncError(json.error || json.message || 'Gagal sinkronisasi data santri');
      }
    } catch (e) {
      setSyncError('Kesalahan jaringan saat melakukan sinkronisasi');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse text-gray-400 font-bold">Memuat Pengaturan...</div>;

  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 dark:from-slate-900 dark:to-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-4 -top-10 opacity-20 text-white">
          <Settings size={150} className="animate-[spin_20s_linear_infinite]" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Settings size={32} />
            Pengaturan Sistem
          </h1>
          <p className="text-slate-300 mt-2 text-sm max-w-xl">
            Kontrol absensi otomatis dan preferensi sistem lainnya. 
            Sangat berguna untuk mengantisipasi libur panjang atau masa ujian.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 font-bold flex items-center gap-2">
          <AlertTriangle size={20} /> {error}
        </div>
      )}

      {success && (
        <>
          {/* Floating Toast Pop-up */}
          <div className="fixed top-5 right-5 z-[999] max-w-sm bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-emerald-400/40 flex items-center gap-3 animate-pulse">
            <CheckCircle className="w-6 h-6 text-white shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Berhasil Disimpan!</h4>
              <p className="text-xs text-emerald-100">{success}</p>
            </div>
          </div>

          <div className="bg-green-50 text-green-600 p-4 rounded-xl border border-green-200 font-bold flex items-center gap-2">
            <CheckCircle size={20} /> {success}
          </div>
        </>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2 pb-4 border-b border-gray-100 dark:border-gray-700">
          <Power size={22} className="text-purple-500" />
          Otomatisasi Kehadiran
        </h2>

        <form onSubmit={handleSave} className="space-y-8" id="settings-form">
          <div className="p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <MessageSquare size={18} className="text-green-500" />
                Nomor WhatsApp Layanan Pengguna (CS)
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Nomor WhatsApp ini akan ditampilkan sebagai tombol bantuan di seluruh halaman untuk semua pengguna. Gunakan format kode negara (contoh: +6281234...).
              </p>
            </div>
            <div className="flex items-center gap-4">
              <input 
                type="text" 
                value={settings.nomor_cs}
                onChange={(e) => setSettings({ ...settings, nomor_cs: e.target.value })}
                className="w-full max-w-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-xl font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-green-500 transition-all"
              />
            </div>
          </div>

          <div className="p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg">Status Absensi Otomatis (Master)</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-lg">
                  Jika diaktifkan, sistem akan otomatis mencatat status &quot;Alpha&quot; untuk Guru/Pembina yang memiliki jadwal pada hari ini namun tidak menekan tombol absensi hingga batas waktu tenggang habis.
                </p>
              </div>
              
              <div className="flex flex-col items-end gap-2 shrink-0">
                <label className="relative inline-flex items-center cursor-pointer scale-125 origin-right">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={settings.absensi_otomatis}
                    onChange={(e) => setSettings({ ...settings, absensi_otomatis: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                </label>
                <span className={`font-black text-sm ${settings.absensi_otomatis ? 'text-green-600' : 'text-gray-400'}`}>
                  {settings.absensi_otomatis ? 'AKTIF' : 'NONAKTIF'}
                </span>
              </div>
            </div>

            {/* Perincian Target Kategori Jadwal */}
            {settings.absensi_otomatis && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Target Kategori Jadwal Otomatis:
                  </h4>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    Pilih kategori yang ingin diberlakukan pencatatan Alpa otomatis
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. Madin */}
                  <div className={`p-3.5 rounded-xl border transition shadow-sm flex items-center justify-between gap-3 ${settings.absensi_otomatis_madin ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/60' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                    <div>
                      <p className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <BookOpen size={14} className="text-indigo-600 dark:text-indigo-400" /> Guru Madin
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Jadwal Madrasah Diniyah</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={settings.absensi_otomatis_madin}
                        onChange={(e) => setSettings({ ...settings, absensi_otomatis_madin: e.target.checked })}
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {/* 2. Qur'an */}
                  <div className={`p-3.5 rounded-xl border transition shadow-sm flex items-center justify-between gap-3 ${settings.absensi_otomatis_quran ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                    <div>
                      <p className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <BookOpen size={14} className="text-emerald-600 dark:text-emerald-400" /> Guru Qur'an
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Jadwal Kelas Al-Qur'an</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={settings.absensi_otomatis_quran}
                        onChange={(e) => setSettings({ ...settings, absensi_otomatis_quran: e.target.checked })}
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {/* 3. Kegiatan Asrama */}
                  <div className={`p-3.5 rounded-xl border transition shadow-sm flex items-center justify-between gap-3 ${settings.absensi_otomatis_kegiatan ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                    <div>
                      <p className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <Users size={14} className="text-amber-600 dark:text-amber-400" /> Pembina Kegiatan
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Jadwal Kegiatan Asrama</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={settings.absensi_otomatis_kegiatan}
                        onChange={(e) => setSettings({ ...settings, absensi_otomatis_kegiatan: e.target.checked })}
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-amber-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg flex items-center gap-2">
                🏖️ Mode Libur Pondok (Day Off / Libur Mendadak)
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-lg">
                Jika diaktifkan, seluruh proses pencatatan alpa otomatis (Auto-Alpa) dan pengiriman notifikasi pengingat WA dijeda sementara selama masa liburan.
              </p>
            </div>
            
            <div className="flex flex-col items-end gap-2 shrink-0">
              <label className="relative inline-flex items-center cursor-pointer scale-125 origin-right">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={settings.mode_libur}
                  onChange={async (e) => {
                    const isChecked = e.target.checked;
                    if (isChecked) {
                      const confirmClear = window.confirm(
                        'Aktifkan Mode Libur Pondok?\n\n' +
                        'Sistem juga akan otomatis membatalkan/menghapus seluruh antrean pengingat di WhatsApp Scheduler agar tidak ada guru yang menerima notifikasi saat libur.'
                      );
                      if (confirmClear) {
                        setSettings(prev => ({ ...prev, mode_libur: true }));
                        // Panggil auto-clear pending di background
                        fetch('/api/wa-scheduler/clear-pending', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => {});
                      }
                    } else {
                      setSettings(prev => ({ ...prev, mode_libur: false }));
                    }
                  }}
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
              </label>
              <span className={`font-black text-sm ${settings.mode_libur ? 'text-green-600' : 'text-gray-400'}`}>
                {settings.mode_libur ? 'LIBUR AKTIF' : 'NORMAL / MASUK'}
              </span>
            </div>
          </div>

          {/* Tips Mengelola Libur */}
          <div className="bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/60 rounded-2xl p-4 flex items-start gap-3.5">
            <Bell className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-bold text-sm text-blue-900 dark:text-blue-300 mb-0.5">Tips Mengelola Libur</h4>
              <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-400">
                Ketika Pesantren memasuki masa libur (Ramadhan, haul, atau libur mendadak), aktifkan <strong>Mode Libur Pondok</strong> ini. Sistem akan otomatis membatalkan pengingat WA dan mencegah sistem mencatat &quot;Alpha&quot; secara terus-menerus ke seluruh dewan guru. Saat kegiatan aktif kembali, matikan mode libur dan tekan tombol <strong>Aktifkan & Jadwalkan Kembali</strong>.
              </p>
            </div>
          </div>

          <div className="p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Clock size={18} className="text-blue-500" />
                Waktu Mulai (Menit)
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Berapa menit batas waktu yang diberikan kepada pengajar untuk dapat mengakses absen sebelum kelas/kegiatan dimulai.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <input 
                type="number" 
                min="0" 
                max="120" 
                value={settings.waktu_mulai}
                onChange={(e) => setSettings({ ...settings, waktu_mulai: parseInt(e.target.value) || 0 })}
                className="w-24 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-xl text-center font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 transition-all"
              />
              <span className="text-sm font-bold text-gray-400">Menit sebelum jadwal</span>
            </div>
          </div>

          <div className="p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <AlertTriangle size={18} className="text-orange-500" />
                Waktu Tenggang (Jam)
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Berapa jam batas waktu yang diberikan kepada pengajar untuk absen setelah kelas/kegiatan dimulai sebelum sistem menyatakan "Alpha".
              </p>
            </div>
            <div className="flex items-center gap-4">
              <input 
                type="number" 
                min="0" 
                max="24" 
                value={settings.waktu_tenggang}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setSettings({ ...settings, waktu_tenggang: isNaN(val) ? 0 : val });
                }}
                className="w-24 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-xl text-center font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 transition-all"
              />
              <span className="text-sm font-bold text-gray-400">Jam setelah kelas dimulai</span>
            </div>
          </div>
        {/* Form continues below in the location section */}

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-600">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
          <AlertTriangle size={22} className="text-red-500" />
          Pengaturan Lokasi Pesantren (Radius Absen)
        </h2>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Latitude Pesantren</label>
              <input 
                type="text" 
                value={settings.lat_pesantren}
                onChange={(e) => setSettings({ ...settings, lat_pesantren: e.target.value })}
                placeholder="-7.1234567"
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-xl text-sm font-bold focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Longitude Pesantren</label>
              <input 
                type="text" 
                value={settings.lng_pesantren}
                onChange={(e) => setSettings({ ...settings, lng_pesantren: e.target.value })}
                placeholder="112.1234567"
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-xl text-sm font-bold focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Batas Jarak Radius (Meter)</label>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">Jarak maksimal Guru dari titik pesantren agar diizinkan menekan tombol Absen.</p>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                min="10" 
                max="5000" 
                value={settings.radius_absen}
                onChange={(e) => setSettings({ ...settings, radius_absen: parseInt(e.target.value) || 50 })}
                className="w-24 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-xl text-center font-bold focus:ring-2 focus:ring-red-500"
              />
              <span className="text-sm font-bold text-gray-500">Meter</span>
            </div>
          </div>
        </div>
      </div>

          {/* Pengaturan Integrasi WhatsApp Scheduler */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-600 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Bell size={22} className="text-emerald-500" />
                  Integrasi Otomatisasi WhatsApp (wa.quizb.my.id)
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Kirim pengingat absensi guru otomatis tanpa perlu mengklik tautan secara manual. Pesan diproses via HP Android Admin.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40">
                <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider mb-2">
                  API Key WA Scheduler
                </label>
                <input 
                  type="text" 
                  value={settings.wa_scheduler_api_key}
                  onChange={(e) => setSettings({ ...settings, wa_scheduler_api_key: e.target.value })}
                  placeholder="wa-key-..."
                  className="w-full bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 px-4 py-2.5 rounded-xl text-sm font-mono font-bold text-emerald-950 dark:text-emerald-200 focus:ring-2 focus:ring-emerald-500 transition-all"
                />
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1.5">
                  Diperoleh dari dashboard akun Anda di <a href="https://wa.quizb.my.id/user_dashboard.php" target="_blank" rel="noreferrer" className="underline font-bold">wa.quizb.my.id</a>
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                  Waktu Pengingat Sebelum Masuk (Menit)
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    min="0" 
                    max="180" 
                    value={settings.wa_scheduler_lead_time}
                    onChange={(e) => setSettings({ ...settings, wa_scheduler_lead_time: parseInt(e.target.value) || 0 })}
                    className="w-24 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-xl text-center font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Menit sebelum jam mulai kelas/kegiatan
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Misal diisi 15, jadwal jam 14:00 akan dikirimkan otomatis pada pukul 13:45.
                </p>
              </div>
            </div>

            {/* Opsi Weekly Looping Sesuai Hari Mengajar */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">Ulangi Pengiriman Mingguan (Weekly Looping Sesuai Hari Mengajar)</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Aktifkan agar jadwal pengingat berulang otomatis setiap pekan tepat pada hari dan jam mengajar guru (misal jadwal Ahad berulang tiap Ahad, bukan tiap hari).
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={settings.wa_scheduler_is_loop}
                  onChange={(e) => setSettings({ ...settings, wa_scheduler_is_loop: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                <span className={`ml-3 text-xs font-bold ${settings.wa_scheduler_is_loop ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {settings.wa_scheduler_is_loop ? 'Looping Mingguan Aktif' : 'Sekali Saja'}
                </span>
              </label>
            </div>

            {/* Kotak Uji Coba Koneksi Langsung */}
            <div className="p-4 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-200/80 dark:border-blue-800/40">
              <h4 className="font-bold text-xs uppercase tracking-wider text-blue-900 dark:text-blue-300 mb-1 flex items-center gap-1.5">
                <RefreshCw size={14} className={testingWa ? 'animate-spin' : ''} />
                Uji Coba Kirim Pesan Tes ke WhatsApp
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                Kirim pesan pengujian untuk memverifikasi apakah server WA Scheduler dan APK Android di HP Anda aktif.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input 
                  type="text" 
                  value={testWaPhone}
                  onChange={(e) => setTestWaPhone(e.target.value)}
                  placeholder="Nomor WA Tujuan (Contoh: 081234567890)"
                  className="bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 px-3 py-2 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 flex-1"
                />
                <button
                  type="button"
                  onClick={handleTestWa}
                  disabled={testingWa}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
                >
                  {testingWa ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {testingWa ? 'Mengirim...' : 'Kirim Pesan Tes'}
                </button>
              </div>
              {testWaResult && (
                <div className={`mt-2.5 p-2.5 rounded-lg text-xs font-bold flex items-center gap-2 ${
                  testWaResult.success 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300' 
                    : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-300'
                }`}>
                  {testWaResult.success ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                  <span>{testWaResult.message}</span>
                </div>
              )}
            </div>

            {/* Kontrol Darurat Libur Mendadak & Jadwalkan Ulang */}
            <div className="p-5 bg-gradient-to-r from-red-50/80 via-amber-50/40 to-emerald-50/80 dark:from-red-950/25 dark:via-amber-950/20 dark:to-emerald-950/25 rounded-2xl border border-red-200/80 dark:border-red-900/40 space-y-3.5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-red-600 text-white rounded-xl shadow-sm shrink-0 mt-0.5">
                  <Power size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-gray-900 dark:text-gray-100">
                    Kontrol Darurat: Batalkan / Aktifkan Pengiriman Otomatis
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">
                    Gunakan tombol di bawah jika pondok <strong>libur mendadak</strong> untuk membatalkan seluruh antrean pesan seketika, atau <strong>aktifkan kembali</strong> saat kegiatan belajar-mengajar normal.
                  </p>
                </div>
              </div>

              {/* Status Alert Aksi WA */}
              {waActionMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  waActionMsg.type === 'success'
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200 border border-red-300 dark:border-red-800'
                }`}>
                  {waActionMsg.type === 'success' ? <CheckCircle size={15} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={15} className="text-red-600 shrink-0" />}
                  <span>{waActionMsg.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  disabled={cancelingWa || reschedulingWa}
                  onClick={handleCancelAllWa}
                  className="py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  {cancelingWa ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                  <span>{cancelingWa ? 'Membatalkan Antrean...' : '🛑 Batalkan Semua Antrean (Libur)'}</span>
                </button>

                <button
                  type="button"
                  disabled={reschedulingWa || cancelingWa}
                  onClick={handleRescheduleAllWa}
                  className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  {reschedulingWa ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span>{reschedulingWa ? 'Mengaktifkan Jadwal...' : '▶️ Aktifkan & Jadwalkan Ulang (Normal)'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pengaturan Jeda Panggilan Santri (Anti-Crowded / Giliran Merata) */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-600 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Megaphone size={22} className="text-orange-500" />
                Jeda Antrian Panggilan Santri (Anti-Crowded)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Atur jeda waktu tunggu (cooldown) setelah mengirim panggilan sebelum akun Wali Murid atau Pengurus Asrama dapat mengirim panggilan kembali, agar antrian tertib dan giliran santri merata.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Jeda Wali Murid */}
              <div className="p-4 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl border border-orange-200/60 dark:border-orange-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-orange-900 dark:text-orange-300 uppercase tracking-wider">
                    Jeda untuk Wali Murid / Alumni
                  </label>
                  <span className="text-xs font-black text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/50 px-2 py-0.5 rounded-md">
                    {settings.jeda_panggilan_wali === 0 ? 'Tanpa Jeda (0 mnt)' : `${settings.jeda_panggilan_wali} Menit`}
                  </span>
                </div>
                <p className="text-[11px] text-orange-700 dark:text-orange-400">
                  Waktu tunggu antar panggilan yang dikirim oleh Wali Murid / Alumni. (0 = nonaktif / bebas kirim).
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <input 
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={settings.jeda_panggilan_wali}
                    onChange={(e) => setSettings({ ...settings, jeda_panggilan_wali: parseInt(e.target.value) || 0 })}
                    className="w-full accent-orange-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input 
                      type="number"
                      min="0"
                      max="120"
                      value={settings.jeda_panggilan_wali}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setSettings({ ...settings, jeda_panggilan_wali: isNaN(v) ? 0 : Math.max(0, v) });
                      }}
                      className="w-16 bg-white dark:bg-gray-800 border border-orange-300 dark:border-orange-700 px-2 py-1 rounded-lg text-center font-bold text-xs text-orange-950 dark:text-orange-200"
                    />
                    <span className="text-xs font-bold text-orange-800 dark:text-orange-300">Menit</span>
                  </div>
                </div>
              </div>

              {/* Jeda Pengurus Asrama */}
              <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200/60 dark:border-amber-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                    Jeda untuk Pengurus Asrama
                  </label>
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-md">
                    {settings.jeda_panggilan_pengurus === 0 ? 'Tanpa Jeda (0 mnt)' : `${settings.jeda_panggilan_pengurus} Menit`}
                  </span>
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Waktu tunggu antar panggilan yang dikirim oleh akun Pengurus Asrama. (0 = nonaktif / bebas kirim).
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <input 
                    type="range"
                    min="0"
                    max="15"
                    step="1"
                    value={settings.jeda_panggilan_pengurus}
                    onChange={(e) => setSettings({ ...settings, jeda_panggilan_pengurus: parseInt(e.target.value) || 0 })}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input 
                      type="number"
                      min="0"
                      max="60"
                      value={settings.jeda_panggilan_pengurus}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setSettings({ ...settings, jeda_panggilan_pengurus: isNaN(v) ? 0 : Math.max(0, v) });
                      }}
                      className="w-16 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 px-2 py-1 rounded-lg text-center font-bold text-xs text-amber-950 dark:text-amber-200"
                    />
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300">Menit</span>
                  </div>
                </div>
              </div>

              {/* Batasan Radius Lokasi Pesantren untuk Wali Murid / Alumni */}
              <div className="md:col-span-2 p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200/60 dark:border-purple-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-purple-600 dark:text-purple-400" />
                    <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider">
                      Wajibkan Lokasi Radius Pesantren untuk Wali Murid & Alumni
                    </h4>
                  </div>
                  <p className="text-xs text-purple-700 dark:text-purple-300 max-w-xl">
                    Jika diaktifkan, panggilan santri hanya dapat dikirim jika perangkat Wali Murid / Alumni terdeteksi berada di dalam radius pesantren (<span className="font-bold">{settings.radius_absen >= 1000 ? `${(settings.radius_absen / 1000).toFixed(1)} km` : `${settings.radius_absen} meter`}</span>). Mencegah panggilan prematur saat wali masih di rumah / perjalanan.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <span className={`text-xs font-black ${settings.radius_panggilan_wali ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`}>
                    {settings.radius_panggilan_wali ? 'AKTIF' : 'NONAKTIF'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={settings.radius_panggilan_wali}
                      onChange={(e) => setSettings({ ...settings, radius_panggilan_wali: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
            <button 
              type="submit" 
              disabled={saving || isSavedSuccess}
              className={`font-bold py-3 px-8 rounded-xl shadow-lg transition-all duration-300 flex items-center gap-2 disabled:opacity-90 ${
                isSavedSuccess 
                  ? 'bg-emerald-600 text-white scale-105 ring-4 ring-emerald-400/40 shadow-emerald-500/30' 
                  : 'bg-slate-800 hover:bg-slate-900 dark:bg-white dark:hover:bg-gray-200 dark:text-slate-900 text-white'
              }`}
            >
              {saving ? (
                <Clock className="animate-spin" size={20} />
              ) : isSavedSuccess ? (
                <CheckCircle size={20} className="animate-bounce" />
              ) : (
                <Save size={20} />
              )}
              {saving ? 'Menyimpan...' : isSavedSuccess ? 'Berhasil Menyimpan!' : 'Simpan Semua Pengaturan'}
            </button>
          </div>
        </form>
      </div>

      {/* Card Sinkronisasi Data Santri */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2 pb-4 border-b border-gray-100 dark:border-gray-700">
          <RefreshCw size={22} className="text-emerald-500" />
          Sinkronisasi Data Santri (Mitra Pembayaran)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bagian Sinkronisasi Manual */}
          <div className="p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg flex items-center gap-2">
                <RefreshCw size={18} className="text-emerald-500" />
                Sinkronisasi Manual
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Tarik data santri terbaru langsung dari server mitra pembayaran (smartpesantren.id). Proses ini akan menambahkan murid baru dan memperbarui data profil tanpa menghapus barcode_id yang sudah ada.
              </p>
              
              {settings.terakhir_sinkronisasi && (
                <div className="mt-3 text-xs font-semibold text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                  <Clock size={12} />
                  Terakhir Sinkron: {new Date(settings.terakhir_sinkronisasi).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSyncManual}
                disabled={syncing}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
              </button>
            </div>
          </div>

          {/* Bagian Jadwal Rutinitas */}
          <div className="p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg flex items-center gap-2">
                <Calendar size={18} className="text-blue-500" />
                Rutinitas Otomatis
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Atur jadwal otomatisasi untuk sinkronisasi murid dari API Mitra. Sistem (background worker) akan mencocokkan waktu terakhir sinkron dan menjalankannya secara berkala.
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Jadwal Rutinitas</label>
              <select
                value={settings.rutinitas_sinkronisasi}
                onChange={(e) => setSettings({ ...settings, rutinitas_sinkronisasi: e.target.value })}
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="manual">Manual (Tidak Aktif)</option>
                <option value="harian">Setiap Hari (Harian)</option>
                <option value="mingguan">Setiap Minggu (Mingguan)</option>
                <option value="bulanan">Setiap Bulan (Bulanan)</option>
              </select>
              {settings.rutinitas_sinkronisasi !== 'manual' && (
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-300">
                  <p className="font-bold flex items-center gap-1.5 mb-1">
                    <Bell size={14} /> Integrasi Cron Job:
                  </p>
                  Panggil endpoint <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded font-mono text-[11px]">GET /api/sync/murid</code> dengan header <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded font-mono text-[11px]">Authorization: Bearer ppma_sync_secret_2024_secure</code> via cPanel Cron Jobs atau cron-job.org. Sistem akan mengeksekusi sinkronisasi secara cerdas sesuai interval {settings.rutinitas_sinkronisasi} yang dipilih.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notifikasi Status Sinkronisasi Manual */}
        {syncError && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm font-semibold flex items-start gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Gagal Sinkronisasi</p>
              <p className="text-xs opacity-90 mt-0.5">{syncError}</p>
            </div>
          </div>
        )}

        {syncSuccess && (
          <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200 text-sm font-semibold space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{syncSuccess}</p>
                {syncInfo && (
                  <p className="text-xs opacity-90 mt-1">
                    Detail hasil: Total data mitra {syncInfo.total}, {syncInfo.new_students} santri baru, {syncInfo.updated_students} santri diperbarui.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card Google Sheets Sync */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 pb-4 border-b border-gray-100 dark:border-gray-700">
          <Sheet size={22} className="text-green-600" />
          Sinkronisasi ke Google Sheets
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Kolom Kiri: Info & Tombol */}
          <div className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200 dark:border-green-800 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg flex items-center gap-2">
                <Sheet size={18} className="text-green-600" />
                Sinkronisasi Manual
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Kirim seluruh data utama (Santri, Guru, Jadwal) dan data log (Rekap Absensi, Ketertiban) ke Google Sheets sekarang juga. Data master akan di-<strong>overwrite</strong>, data log akan di-<strong>append</strong> (tanpa duplikat).
              </p>
              {lastGSheetSync && (
                <div className="mt-3 text-xs font-semibold text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                  <Clock size={12} />
                  Terakhir Sync: {new Date(lastGSheetSync).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              )}
              {!lastGSheetSync && (
                <div className="mt-3 text-xs font-semibold text-amber-500 flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  Belum pernah disinkronisasi
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleSyncGSheet}
              disabled={gsheetSyncing}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {gsheetSyncing
                ? <><Loader2 size={18} className="animate-spin" /> Menyinkronkan...</>
                : <><Sheet size={18} /> Sinkronkan ke Google Sheets</>}
            </button>
          </div>

          {/* Kolom Kanan: Info Sheet & Cron */}
          <div className="p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg flex items-center gap-2">
                <Calendar size={18} className="text-blue-500" />
                Struktur Tab di Spreadsheet
              </h3>
              <div className="mt-3 space-y-1.5 text-sm">
                {[
                  { tab: 'Data_Santri', mode: 'Overwrite (Timpa Baru)', color: 'blue' },
                  { tab: 'Data_Guru', mode: 'Overwrite (Timpa Baru)', color: 'blue' },
                  { tab: 'Jadwal', mode: 'Overwrite (Timpa Baru)', color: 'blue' },
                  { tab: 'Rekap_Absensi', mode: 'Append (Tambah ke Bawah)', color: 'amber' },
                  { tab: 'Ketertiban', mode: 'Append (Tambah ke Bawah)', color: 'amber' },
                ].map(item => (
                  <div key={item.tab} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-1 border-b border-gray-100/50 dark:border-gray-800/30 last:border-0">
                    <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{item.tab}</span>
                    <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full w-fit ${
                      item.color === 'blue'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}>{item.mode}</span>
                  </div>
                ))}
              </div>
            </div>
            {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:border-green-500 hover:text-green-600 text-gray-700 dark:text-gray-200 font-bold py-2.5 px-4 rounded-xl text-sm transition-all"
              >
                <ExternalLink size={16} /> Buka Google Spreadsheet
              </a>
            )}
          </div>
        </div>

        {/* Hasil Sinkronisasi */}
        {gsheetError && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm font-semibold flex items-start gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Gagal Sinkronisasi Google Sheets</p>
              <p className="text-xs opacity-90 mt-0.5">{gsheetError}</p>
            </div>
          </div>
        )}

        {gsheetSuccess && (
          <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200 text-sm font-semibold space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="shrink-0" />
              <p className="font-bold">{gsheetSuccess}</p>
            </div>
            {gsheetResults && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {Object.entries(gsheetResults).map(([key, val]: [string, any]) => (
                  <div key={key} className={`p-2 rounded-lg text-center text-xs ${
                    val.status === 'ok' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    <div className="font-black text-sm">
                      {val.status === 'ok' ? '✓' : '✗'}
                    </div>
                    <div className="font-bold capitalize mt-0.5">{key}</div>
                    <div className="text-gray-500 mt-0.5">
                      {val.rows !== undefined ? `${val.rows} baris` : ''}
                      {val.appended !== undefined ? `+${val.appended}` : ''}
                      {val.status === 'error' ? val.message?.substring(0, 30) : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300 flex gap-3">
          <Bell size={18} className="shrink-0 mt-0.5" />
          <div>
            <strong>Sinkronisasi Otomatis:</strong> Untuk mengaktifkan cron job harian otomatis, panggil endpoint
            <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded text-xs mx-1 font-mono">POST /api/sync/googlesheet</code>
            dengan header <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded text-xs font-mono">Authorization: Bearer ppma_sync_secret_2024_secure</code> menggunakan layanan cron job eksternal (seperti cron-job.org atau Vercel Cron).
          </div>
        </div>
      </div>

      {/* Card Setup Asrama - Hanya Admin */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <button
          onClick={() => { setShowSetupAsrama(!showSetupAsrama); if (!asramaData) fetchAsramaData(); }}
          className="w-full flex items-center justify-between text-left"
        >
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Building2 size={22} className="text-amber-500" />
            Setup Asrama & Diagnosa Akun Pengurus
          </h2>
          {showSetupAsrama ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>

        {showSetupAsrama && (
          <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Panel ini membantu admin memastikan kolom <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">nama_asrama</code> di tabel kamar sudah terisi dengan benar, sehingga akun Pengurus Asrama dapat mengakses data santri asrama mereka.
            </p>

            {fixAsramaError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-200 text-sm font-semibold flex items-center gap-2">
                <AlertTriangle size={16} /> {fixAsramaError}
              </div>
            )}

            {fixAsramaResult && (
              <div className="bg-green-50 text-green-700 p-3 rounded-xl border border-green-200 text-sm font-semibold">
                <CheckCircle size={16} className="inline mr-1" />
                Auto-fix selesai: {fixAsramaResult.updated_kamar} kamar diperbarui, {fixAsramaResult.fixed_users} user diperbaiki.
              </div>
            )}

            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={fetchAsramaData}
                disabled={loadingAsrama}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-xl text-sm transition-all disabled:opacity-50 shadow-sm"
              >
                <Database size={16} className={loadingAsrama ? 'animate-pulse' : ''} />
                {loadingAsrama ? 'Memuat...' : 'Cek Data Asrama'}
              </button>
              <button
                onClick={handleAutoFixAsrama}
                disabled={fixingAsrama}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-5 rounded-xl text-sm transition-all disabled:opacity-50 shadow-sm"
              >
                <RefreshCw size={16} className={fixingAsrama ? 'animate-spin' : ''} />
                {fixingAsrama ? 'Memproses...' : 'Auto-Fix nama_asrama'}
              </button>
            </div>

            {asramaData && (
              <div className="space-y-4">
                {/* Ringkasan */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl text-center">
                    <div className="text-2xl font-black text-gray-800 dark:text-gray-100">{asramaData.total_kamar}</div>
                    <div className="text-xs text-gray-500 mt-1">Total Kamar</div>
                  </div>
                  <div className={`p-3 rounded-xl text-center ${asramaData.kamar_tanpa_asrama > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                    <div className={`text-2xl font-black ${asramaData.kamar_tanpa_asrama > 0 ? 'text-red-600' : 'text-green-600'}`}>{asramaData.kamar_tanpa_asrama}</div>
                    <div className="text-xs text-gray-500 mt-1">Kamar Tanpa Asrama</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl text-center">
                    <div className="text-2xl font-black text-gray-800 dark:text-gray-100">{asramaData.asrama_terdaftar?.filter((a: any) => a.nama_asrama).length || 0}</div>
                    <div className="text-xs text-gray-500 mt-1">Asrama Terdaftar</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl text-center">
                    <div className="text-2xl font-black text-gray-800 dark:text-gray-100">{asramaData.users_asrama?.length || 0}</div>
                    <div className="text-xs text-gray-500 mt-1">Akun Pengurus</div>
                  </div>
                </div>

                {/* Tabel User Pengurus */}
                {asramaData.users_asrama?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">Akun Pengurus Asrama</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse whitespace-nowrap" style={{ minWidth: '600px' }}>
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-700">
                            {[
                              { key: 'username', label: 'Username' },
                              { key: 'kamar_id', label: 'kamar_id' },
                              { key: 'nama_kamar', label: 'Nama Kamar' },
                              { key: 'nama_asrama', label: 'nama_asrama' },
                              { key: 'status', label: 'Status' },
                            ].map(col => (
                              <th
                                key={col.key}
                                className="px-3 py-2 text-left font-bold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 select-none transition-colors"
                                onClick={() => handleAsramaSort(col.key)}
                              >
                                {col.label}<AsramaSortIcon col={col.key} />
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {getSortedAsramaUsers(asramaData.users_asrama).map((u: any) => (
                            <tr key={u.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                              <td className="px-3 py-2 font-mono">{u.username}</td>
                              <td className="px-3 py-2">{u.kamar_id ?? <span className="text-red-500 font-bold">NULL</span>}</td>
                              <td className="px-3 py-2">{u.nama_kamar ?? <span className="text-gray-400">-</span>}</td>
                              <td className="px-3 py-2">{u.nama_asrama ?? <span className="text-red-500 font-bold">NULL</span>}</td>
                              <td className="px-3 py-2">
                                {u.nama_asrama ? 
                                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✓ OK</span> :
                                  <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">✗ Kosong</span>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Santri per Asrama */}
                {asramaData.santri_per_asrama?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">Santri per Asrama</h4>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const mergedMap = new Map<string, number>();
                        asramaData.santri_per_asrama.forEach((a: any) => {
                          let name = (a.nama_asrama || '').trim();
                          if (/^[A-Fa-f]$/.test(name)) name = `Asrama ${name.toUpperCase()}`;
                          const prev = mergedMap.get(name) || 0;
                          mergedMap.set(name, prev + Number(a.jumlah_santri || 0));
                        });
                        return Array.from(mergedMap.entries()).map(([nama, jumlah]) => (
                          <div key={nama} className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-lg text-sm">
                            <span className="font-bold text-indigo-700 dark:text-indigo-300">{nama}</span>
                            <span className="text-indigo-500 ml-2">{jumlah} santri</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {/* Sample Kamar */}
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-400 hover:text-gray-600 font-semibold">Lihat semua data kamar ({asramaData.total_kamar} kamar)</summary>
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full border-collapse whitespace-nowrap" style={{ minWidth: '400px' }}>
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700">
                          {[
                            { key: 'kamar_id', label: 'ID' },
                            { key: 'nama_kamar', label: 'Nama Kamar' },
                            { key: 'nama_asrama', label: 'Nama Asrama' },
                          ].map(col => (
                            <th
                              key={col.key}
                              className="px-3 py-1.5 text-left font-bold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 select-none transition-colors"
                              onClick={() => handleKamarSort(col.key)}
                            >
                              {col.label}<KamarSortIcon col={col.key} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {getSortedKamar(asramaData.kamar || []).map((k: any) => (
                          <tr key={k.kamar_id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-3 py-1">{k.kamar_id}</td>
                            <td className="px-3 py-1 font-mono">{k.nama_kamar}</td>
                            <td className="px-3 py-1">
                              {k.nama_asrama ? (
                                /^[A-Fa-f]$/.test(k.nama_asrama.trim()) ? `Asrama ${k.nama_asrama.trim().toUpperCase()}` : k.nama_asrama
                              ) : <span className="text-red-500">NULL</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
