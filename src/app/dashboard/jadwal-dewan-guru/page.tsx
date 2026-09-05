'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays, Plus, Clock, Building2, Trash2, Edit3, CheckCircle,
  AlertCircle, RefreshCw, X, ShieldAlert, ArrowLeft, Filter
} from 'lucide-react';
import Link from 'next/link';

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
        if (user.role !== 'admin' && user.role !== 'staff' && !pengasuhFlag) {
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
      if (!res.ok || !json.success) {
        setError(json.error || 'Gagal memuat jadwal.');
      } else {
        setSchedules(json.data || []);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setError('Waktu pemuatan habis (timeout). Silakan klik muat ulang.');
      } else {
        setError('Koneksi gagal atau server sedang memproses. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  }, [activeHari, activeHomebase]);

  // Muat jadwal langsung saat komponen dibuka & saat filter berubah
  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const openAddModal = () => {
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
                <span>Pengaturan Jadwal Dewan Guru</span>
              </h1>
              <p className="text-[11px] text-slate-400 truncate">
                Dikelola khusus oleh Admin & Pengasuh YPMA
              </p>
            </div>
          </div>

          {/* Baris 2: 3 Tombol 1 Baris Seukuran Presisi Memenuhi Ruang Kanan Kiri */}
          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto sm:flex sm:items-center">
            {/* Tombol 1: Kembali */}
            <Link
              href="/dashboard/absen-guru"
              className="w-full sm:w-auto py-2 px-2 sm:px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-center"
              title="Kembali ke Presensi Guru"
            >
              <ArrowLeft size={15} className="shrink-0" />
              <span>Kembali</span>
            </Link>

            {/* Tombol 2: Muat Ulang */}
            <button
              onClick={fetchSchedules}
              disabled={loading}
              className="w-full sm:w-auto py-2 px-2 sm:px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-center"
              title="Segarkan data jadwal"
            >
              <RefreshCw size={13} className={`shrink-0 ${loading ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>

            {/* Tombol 3: Tambah Jadwal */}
            <button
              onClick={openAddModal}
              className="w-full sm:w-auto py-2 px-2 sm:px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-center"
              title="Tambah Jadwal Baru"
            >
              <Plus size={15} className="shrink-0" />
              <span>Jadwal</span>
            </button>
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
              Belum ada jadwal yang diatur untuk filter ini. Silakan klik tombol "Tambah Jadwal" di atas.
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
    </div>
  );
}
