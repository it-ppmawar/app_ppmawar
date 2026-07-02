'use client';

import { useState, useEffect } from 'react';
import { Settings, Power, Clock, Save, AlertTriangle, CheckCircle, Bell, RefreshCw, Calendar, Building2, Database, ChevronDown, ChevronUp, MessageSquare, Sheet, ExternalLink, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [settings, setSettings] = useState({
    absensi_otomatis: false,
    mode_libur: false,
    waktu_tenggang: 2,
    waktu_mulai: 30,
    lat_pesantren: '',
    lng_pesantren: '',
    radius_absen: 50,
    rutinitas_sinkronisasi: 'manual',
    terakhir_sinkronisasi: '',
    nomor_cs: '+628133129223'
  });

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
          absensi_otomatis: json.data.absensi_otomatis_guru === '1',
          mode_libur: json.data.mode_libur === '1',
          waktu_tenggang: parseInt(json.data.waktu_tenggang_absensi) || 2,
          waktu_mulai: parseInt(json.data.waktu_mulai_absensi) || 30,
          lat_pesantren: json.data.lat_pesantren || '',
          lng_pesantren: json.data.lng_pesantren || '',
          radius_absen: parseInt(json.data.radius_absen) || 50,
          rutinitas_sinkronisasi: json.data.rutinitas_sinkronisasi || 'manual',
          terakhir_sinkronisasi: json.data.terakhir_sinkronisasi || '',
          nomor_cs: json.data.nomor_cs || '+628133129223'
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
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(json.error || 'Gagal menyimpan pengaturan');
      }
    } catch (e) {
      setError('Kesalahan jaringan saat menyimpan');
    } finally {
      setSaving(false);
    }
  };


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
        <div className="bg-green-50 text-green-600 p-4 rounded-xl border border-green-200 font-bold flex items-center gap-2 animate-[pulse_1s_ease-in-out]">
          <CheckCircle size={20} /> {success}
        </div>
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

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg">Status Absensi Otomatis</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-lg">
                Jika diaktifkan, sistem akan otomatis mencatat status "Alpha" untuk Guru/Pembina yang memiliki jadwal pada hari ini namun tidak menekan tombol absensi hingga batas waktu tenggang habis.
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

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg">Mode Libur Semester</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-lg">
                Jika diaktifkan, seluruh proses pencatatan alpa otomatis (Auto-Alpa) dan notifikasi akan dinonaktifkan sementara selama masa liburan sekolah/semester.
              </p>
            </div>
            
            <div className="flex flex-col items-end gap-2 shrink-0">
              <label className="relative inline-flex items-center cursor-pointer scale-125 origin-right">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={settings.mode_libur}
                  onChange={(e) => setSettings({ ...settings, mode_libur: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
              </label>
              <span className={`font-black text-sm ${settings.mode_libur ? 'text-green-600' : 'text-gray-400'}`}>
                {settings.mode_libur ? 'AKTIF' : 'NONAKTIF'}
              </span>
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
                min="1" 
                max="24" 
                value={settings.waktu_tenggang}
                onChange={(e) => setSettings({ ...settings, waktu_tenggang: parseInt(e.target.value) || 1 })}
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

          <div className="flex justify-end pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
            <button 
              type="submit" 
              disabled={saving}
              className="bg-slate-800 hover:bg-slate-900 dark:bg-white dark:hover:bg-gray-200 dark:text-slate-900 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Clock className="animate-spin" size={20} /> : <Save size={20} />}
              {saving ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}
            </button>
          </div>
        </form>
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
                      {asramaData.santri_per_asrama.map((a: any) => (
                        <div key={a.nama_asrama} className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-lg text-sm">
                          <span className="font-bold text-indigo-700 dark:text-indigo-300">{a.nama_asrama}</span>
                          <span className="text-indigo-500 ml-2">{a.jumlah_santri} santri</span>
                        </div>
                      ))}
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
                            <td className="px-3 py-1">{k.nama_asrama ?? <span className="text-red-500">NULL</span>}</td>
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

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-3xl p-6 flex gap-4">
        <Bell className="text-blue-500 shrink-0 mt-1" size={24} />
        <div>
          <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-1">Tips Mengelola Libur</h3>
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Ketika Pesantren memasuki masa libur Ramadhan atau libur panjang lainnya, segera nonaktifkan sistem absensi otomatis ini. Hal ini mencegah sistem mencatat &quot;Alpha&quot; secara terus-menerus ke seluruh staf dan pembina yang dapat merusak data persentase kehadiran bulanan.
          </p>
        </div>
      </div>
    </div>
  );
}
