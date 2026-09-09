'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays, Plus, Clock, Building2, Trash2, Edit3, CheckCircle,
  AlertCircle, RefreshCw, X, ShieldAlert, ArrowLeft, Filter, FileText, Download, Upload, ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';
import { downloadTemplate } from '@/lib/downloadTemplate';

const HOMEBASES = [
  'SEMUA',
  'TKM NU MAWAR',
  'MI BANIN',
  'MI BANAT',
  'SMP NU',
  'MTS PUTRA-PUTRI',
  'MA MAWAR',
  'SMK NU',
  'MADIN',
  'MQ',
  'KOPMA',
  'KLINIK',
  'KBIHU MAWAR'
];

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'] as const;

export default function JadwalDewanGuruPage() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [isPengasuh, setIsPengasuh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [activeHari, setActiveHari] = useState('SEMUA');
  const [activeHomebase, setActiveHomebase] = useState('SEMUA');

  const isGuru = role === 'guru';
  const canManage = (role === 'admin' || role === 'staff' || isPengasuh) && !isGuru;

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [formData, setFormData] = useState({
    nama_sesi: '',
    homebase: 'SEMUA',
    hari: 'Senin',
    jam_mulai: '07:00',
    jam_selesai: '13:30',
    toleransi_menit: 15,
    keterangan: ''
  });
  const [saving, setSaving] = useState(false);

  // Export & Preview States
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  // Import Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // Check auth
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const d = await res.json();
        if (!d.success) {
          router.replace('/dashboard');
          return;
        }
        const user = d.user;
        const pengasuhFlag = user.role === 'pengasuh' || user.is_pengasuh || user.isPengasuh;
        const isGuruUser = user.role === 'guru';
        if (user.role !== 'admin' && user.role !== 'staff' && !pengasuhFlag && !isGuruUser) {
          router.replace('/dashboard');
          return;
        }
        setRole(user.role);
        setIsPengasuh(!!pengasuhFlag);
      } catch {
        router.replace('/dashboard');
      }
    })();
  }, [router]);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let url = '/api/dewan-guru/jadwal?';
      if (activeHari !== 'SEMUA') url += `hari=${activeHari}&`;
      if (activeHomebase !== 'SEMUA') url += `homebase=${encodeURIComponent(activeHomebase)}&`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      const json = await res.json();
      if (res.ok && json.success) {
        setSchedules(json.data || []);
      } else {
        setError(json.error || 'Gagal memuat jadwal.');
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setError('Waktu memuat habis. Silakan muat ulang.');
      } else {
        setError('Koneksi terputus. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  }, [activeHari, activeHomebase]);

  useEffect(() => {
    if (role || isPengasuh) {
      fetchSchedules();
    }
  }, [role, isPengasuh, fetchSchedules]);

  const openAddModal = () => {
    if (!canManage) return;
    setEditingSchedule(null);
    setFormData({
      nama_sesi: '',
      homebase: activeHomebase !== 'SEMUA' ? activeHomebase : 'SEMUA',
      hari: activeHari !== 'SEMUA' ? activeHari : 'Senin',
      jam_mulai: '07:00',
      jam_selesai: '13:30',
      toleransi_menit: 15,
      keterangan: ''
    });
    setShowModal(true);
  };

  const openEditModal = (item: any) => {
    if (!canManage) return;
    setEditingSchedule(item);
    setFormData({
      nama_sesi: item.nama_sesi || '',
      homebase: item.homebase || 'SEMUA',
      hari: item.hari || 'Senin',
      jam_mulai: (item.jam_mulai || '07:00').slice(0, 5),
      jam_selesai: (item.jam_selesai || '13:30').slice(0, 5),
      toleransi_menit: item.toleransi_menit || 15,
      keterangan: item.keterangan || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!canManage) return;
    if (!confirm('Apakah Anda yakin ingin menghapus jadwal ini?')) return;
    try {
      const res = await fetch(`/api/dewan-guru/jadwal?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Gagal menghapus jadwal');
      } else {
        fetchSchedules();
      }
    } catch {
      alert('Koneksi gagal.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const method = editingSchedule ? 'PUT' : 'POST';
      const body = editingSchedule ? { id: editingSchedule.id, ...formData } : formData;

      const res = await fetch('/api/dewan-guru/jadwal', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Gagal menyimpan jadwal');
      } else {
        setShowModal(false);
        fetchSchedules();
      }
    } catch {
      alert('Koneksi gagal.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportJadwal = (format: 'pdf' | 'excel' = 'pdf', previewOnly = false) => {
    if (schedules.length === 0) {
      alert('Tidak ada data jadwal untuk diexport.');
      return;
    }

    const title = 'JADWAL PRESENSI DEWAN GURU YPMA';
    const subtitle = `PP. Matholi'ul Anwar Simo Sungelebak\nHari: ${activeHari} | Unit: ${activeHomebase} | Total: ${schedules.length} Sesi Jadwal`;
    const filename = `Jadwal_Dewan_Guru_${activeHomebase.replace(/[^a-zA-Z0-9_-]/g, '_')}_${activeHari}`;
    const columns = ['NO', 'HARI', 'NAMA SESI / KEGIATAN', 'UNIT / HOMEBASE', 'JAM KERJA / PRESENSI', 'TOLERANSI', 'KETERANGAN'];
    const rows = schedules.map((s, idx) => [
      idx + 1,
      s.hari,
      s.nama_sesi,
      s.homebase || 'SEMUA',
      `${(s.jam_mulai || '').slice(0, 5)} - ${(s.jam_selesai || '').slice(0, 5)}`,
      `${s.toleransi_menit || 15} Menit`,
      s.keterangan || '-'
    ]);

    if (format === 'excel') {
      exportToExcel({ title, subtitle, columns, rows, filename });
    } else {
      const result = exportToPDF({ title, subtitle, columns, rows, filename, previewOnly });
      if (previewOnly && result) {
        const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
        if (isMobile) {
          window.open(result, '_blank');
        } else {
          setPdfUrl(result);
          setShowPdfPreview(true);
        }
      }
    }
  };

  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('type', 'jadwal_dewan_guru');

      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Berhasil mengimpor jadwal dewan guru');
        setIsImportModalOpen(false);
        setImportFile(null);
        fetchSchedules();
      } else {
        alert(data.error || 'Gagal mengimpor jadwal dewan guru');
      }
    } catch {
      alert('Terjadi kesalahan koneksi saat mengimpor.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-2.5 sm:py-3 space-y-2.5 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
          {/* Baris 1: Ikon & Teks Judul Merapat ke Ujung Kiri */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 shrink-0">
              <CalendarDays size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5 leading-tight truncate">
                <span>{isGuru ? 'Jadwal Dewan Guru' : 'Pengaturan Jadwal Dewan Guru'}</span>
              </h1>
              <p className="text-[11px] text-slate-400 truncate">
                {isGuru ? 'KBM & Kehadiran Dewan Guru YPMA' : 'Dikelola khusus oleh Admin & Pengasuh YPMA'}
              </p>
            </div>
          </div>

          {/* Baris 2: Tombol Aksi – Rapi & Presisi di Layar HP */}
          <div className="w-full sm:w-auto space-y-1.5 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
            {canManage ? (
              <>
                {/* Baris 1 HP: Kembali | Impor | Templat (Grid 3 Kolom) */}
                <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-1.5">
                  <Link
                    href="/dashboard/absen-guru"
                    className="py-2 px-2 sm:px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer text-center"
                    title="Kembali ke Presensi Guru"
                  >
                    <ArrowLeft size={13} className="shrink-0" />
                    <span>Kembali</span>
                  </Link>

                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="py-2 px-2 sm:px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer text-center"
                    title="Unggah / Impor Jadwal dari File Excel"
                  >
                    <Upload size={13} className="shrink-0" />
                    <span>Impor</span>
                  </button>

                  <button
                    onClick={() => downloadTemplate('jadwal_dewan_guru')}
                    className="py-2 px-2 sm:px-3 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer text-center"
                    title="Unduh Format Templat Impor Excel"
                  >
                    <Download size={13} className="shrink-0" />
                    <span>Templat</span>
                  </button>
                </div>

                {/* Baris 2 HP: Excel | Preview | PDF (Grid 3 Kolom) */}
                <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-1.5">
                  <button
                    onClick={() => handleExportJadwal('excel', false)}
                    className="py-2 px-2 sm:px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer text-center"
                    title="Unduh File Excel Jadwal Dewan Guru"
                  >
                    <Download size={13} className="shrink-0" />
                    <span>Excel</span>
                  </button>

                  <button
                    onClick={() => handleExportJadwal('pdf', true)}
                    className="py-2 px-2 sm:px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 dark:text-purple-300 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer text-center"
                    title="Preview Jadwal Dewan Guru PDF"
                  >
                    <FileText size={13} className="shrink-0" />
                    <span>Preview</span>
                  </button>

                  <button
                    onClick={() => handleExportJadwal('pdf', false)}
                    className="py-2 px-2 sm:px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer text-center"
                    title="Unduh File PDF Jadwal Dewan Guru"
                  >
                    <Download size={13} className="shrink-0" />
                    <span>PDF</span>
                  </button>
                </div>

                {/* Baris 3 HP: Muat Ulang (50%) | Jadwal (50%) - Grid 2 Kolom Presisi 50-50 */}
                <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-1.5">
                  <button
                    onClick={fetchSchedules}
                    disabled={loading}
                    className="w-full sm:w-auto py-2 px-2 sm:px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer text-center disabled:opacity-50"
                    title="Segarkan data jadwal"
                  >
                    <RefreshCw size={12} className={`shrink-0 ${loading ? 'animate-spin' : ''}`} />
                    <span>Muat Ulang</span>
                  </button>

                  <button
                    onClick={openAddModal}
                    className="w-full sm:w-auto py-2 px-3 sm:px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-center"
                    title="Tambah Jadwal Baru"
                  >
                    <Plus size={14} className="shrink-0" />
                    <span>Jadwal</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Baris 1 HP (Guru View Only): Kembali | Excel | Preview (Grid 3 Kolom) */}
                <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-1.5">
                  <Link
                    href="/dashboard"
                    className="py-2 px-2 sm:px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer text-center"
                    title="Kembali ke Dashboard"
                  >
                    <ArrowLeft size={13} className="shrink-0" />
                    <span>Kembali</span>
                  </Link>

                  <button
                    onClick={() => handleExportJadwal('excel', false)}
                    className="py-2 px-2 sm:px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer text-center"
                    title="Unduh File Excel Jadwal Dewan Guru"
                  >
                    <Download size={13} className="shrink-0" />
                    <span>Excel</span>
                  </button>

                  <button
                    onClick={() => handleExportJadwal('pdf', true)}
                    className="py-2 px-2 sm:px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 dark:text-purple-300 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer text-center"
                    title="Preview Jadwal Dewan Guru PDF"
                  >
                    <FileText size={13} className="shrink-0" />
                    <span>Preview</span>
                  </button>
                </div>

                {/* Baris 2 HP (Guru View Only): PDF (50%) | Muat Ulang (50%) - Grid 2 Kolom */}
                <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-1.5">
                  <button
                    onClick={() => handleExportJadwal('pdf', false)}
                    className="w-full sm:w-auto py-2 px-2 sm:px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer text-center"
                    title="Unduh File PDF Jadwal Dewan Guru"
                  >
                    <Download size={13} className="shrink-0" />
                    <span>PDF</span>
                  </button>

                  <button
                    onClick={fetchSchedules}
                    disabled={loading}
                    className="w-full sm:w-auto py-2 px-2 sm:px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer text-center disabled:opacity-50"
                    title="Segarkan data jadwal"
                  >
                    <RefreshCw size={12} className={`shrink-0 ${loading ? 'animate-spin' : ''}`} />
                    <span>Muat Ulang</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-4 space-y-3">
        {/* Filter Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
          {/* Hari Tab */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 shrink-0">Hari:</span>
            {['SEMUA', ...HARI_LIST].map(h => (
              <button
                key={h}
                onClick={() => setActiveHari(h)}
                className={`py-1.5 px-3 rounded-xl font-bold shrink-0 transition-all ${
                  activeHari === h
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {h}
              </button>
            ))}
          </div>

          {/* Unit / Homebase Selector */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <Building2 size={14} className="text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-500 shrink-0">Unit Lembaga:</span>
            <select
              value={activeHomebase}
              onChange={e => setActiveHomebase(e.target.value)}
              className="text-xs font-bold py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 w-full sm:w-auto"
            >
              {HOMEBASES.map(hb => (
                <option key={hb} value={hb}>
                  {hb === 'SEMUA' ? '🌐 Semua Unit / Global YPMA' : hb}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs text-rose-600 dark:text-rose-400 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchSchedules}
              className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/50 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 font-bold transition-all shrink-0 cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Schedule List Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 animate-pulse space-y-3">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-2/3" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-1/2" />
                <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              </div>
            ))}
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
            <CalendarDays size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <h3 className="font-extrabold text-slate-700 dark:text-slate-200 text-sm">Belum Ada Jadwal</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Belum ada jadwal yang diatur untuk filter ini.{canManage ? ' Silakan klik tombol "Tambah Jadwal" di atas.' : ''}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {schedules.map(item => (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                      {item.hari}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {item.homebase}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 leading-snug">
                      {item.nama_sesi}
                    </h3>
                    {item.keterangan && (
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{item.keterangan}</p>
                    )}
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-700 dark:text-slate-200">
                      <Clock size={13} className="text-teal-600" />
                      <span>{item.jam_mulai?.slice(0, 5)} - {item.jam_selesai?.slice(0, 5)}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Toleransi: ±{item.toleransi_menit || 15}m
                    </span>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit Jadwal"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="Hapus Jadwal"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-[scaleUp_0.2s_ease-out]">
            <div className="bg-gradient-to-r from-teal-700 to-emerald-700 p-4 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <CalendarDays size={16} />
                <span>{editingSchedule ? 'Edit Jadwal Dewan Guru' : 'Tambah Jadwal Baru'}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg bg-white/20 hover:bg-white/30 text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Sesi / Kegiatan:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: KBM Pagi, Rapat Mingguan, Piket"
                  value={formData.nama_sesi}
                  onChange={e => setFormData({ ...formData, nama_sesi: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Hari:</label>
                  <select
                    value={formData.hari}
                    onChange={e => setFormData({ ...formData, hari: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  >
                    {HARI_LIST.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Unit / Homebase:</label>
                  <select
                    value={formData.homebase}
                    onChange={e => setFormData({ ...formData, homebase: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  >
                    {HOMEBASES.map(hb => (
                      <option key={hb} value={hb}>{hb === 'SEMUA' ? '🌐 Semua Unit' : hb}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Jam Mulai:</label>
                  <input
                    type="time"
                    required
                    value={formData.jam_mulai}
                    onChange={e => setFormData({ ...formData, jam_mulai: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Jam Selesai:</label>
                  <input
                    type="time"
                    required
                    value={formData.jam_selesai}
                    onChange={e => setFormData({ ...formData, jam_selesai: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Toleransi (m):</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={formData.toleransi_menit}
                    onChange={e => setFormData({ ...formData, toleransi_menit: parseInt(e.target.value, 10) || 0 })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Keterangan Tambahan:</label>
                <textarea
                  placeholder="Catatan tambahan (opsional)..."
                  rows={2}
                  value={formData.keterangan}
                  onChange={e => setFormData({ ...formData, keterangan: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="py-2.5 px-4 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="py-2.5 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : editingSchedule ? 'Perbarui Jadwal' : 'Simpan Jadwal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Import Excel ────────────────────────────────────────────── */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 p-5 text-white flex justify-between items-center">
              <h2 className="text-base font-extrabold flex items-center gap-2">
                <Upload size={18} />
                <span>Impor Jadwal Dewan Guru</span>
              </h2>
              <button
                onClick={() => { setIsImportModalOpen(false); setImportFile(null); }}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleImportExcel} className="p-5 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Silakan pilih file Excel (.xlsx) sesuai format templat. Sistem akan secara otomatis menambahkan sesi jadwal baru atau memperbarui jadwal dengan sesi & hari yang sama.
              </p>
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors relative">
                <input
                  type="file"
                  accept=".xlsx"
                  required
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) setImportFile(files[0]);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload size={32} className="mx-auto text-teal-600 dark:text-teal-400 mb-2" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block truncate">
                  {importFile ? importFile.name : 'Pilih File Excel (.xlsx)'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">Maksimal ukuran file: 10MB</span>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsImportModalOpen(false); setImportFile(null); }}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={importing || !importFile}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Upload size={14} />
                  <span>{importing ? 'Mengimpor...' : 'Mulai Impor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Preview PDF ─────────────────────────────────────────────── */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[88vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                    Preview Jadwal Dewan Guru YPMA
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Hari: {activeHari} | Unit: {activeHomebase} | Total {schedules.length} Sesi
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(pdfUrl, '_blank')}
                  className="py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Buka di Tab Baru Browser"
                >
                  <ExternalLink size={14} />
                  <span className="hidden sm:inline">Buka Tab Baru</span>
                </button>
                <button
                  onClick={() => handleExportJadwal('pdf', false)}
                  className="py-2 px-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} />
                  <span>Unduh PDF</span>
                </button>
                <button
                  onClick={() => setShowPdfPreview(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 sm:p-4 overflow-hidden flex flex-col">
              <div className="sm:hidden mb-2 p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between gap-2 text-xs text-blue-700 dark:text-blue-300">
                <span>PDF tidak tampil di layar HP?</span>
                <button onClick={() => window.open(pdfUrl, '_blank')} className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded-lg shrink-0">
                  Buka Tab Baru
                </button>
              </div>
              <iframe
                src={pdfUrl}
                className="w-full flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner bg-white"
                title="Preview PDF Jadwal Dewan Guru"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
