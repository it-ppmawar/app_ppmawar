'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Trash2, Plus, Search, MapPin, CheckCircle, Clock, AlertTriangle, ShieldAlert, Edit, X, Download, User, Leaf, Wind, Package, Upload, FileText, Eye, TableProperties } from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';
import { downloadTemplate } from '@/lib/downloadTemplate';

interface KebersIhan {
  id: number;
  nama_item: string;
  kategori: string;
  asrama: string;
  kamar_id: number | null;
  nama_kamar: string | null;
  jumlah: number;
  kondisi: 'Bersih' | 'Kotor Ringan' | 'Kotor Berat';
  keterangan: string | null;
}

interface Laporan {
  id: number;
  kebersihan_id: number;
  nama_item: string;
  asrama: string;
  kategori: string;
  kondisi_saat_ini: string;
  pelapor_id: number;
  nama_pelapor: string;
  nama_petugas: string | null;
  deskripsi_masalah: string;
  status: string;
  tindakan_kebersihan: string | null;
  tanggal_selesai: string | null;
  created_at: string;
}

const ASRAMA_LIST = ['A', 'B', 'C', 'D', 'E', 'F', 'Tahfid'];
const KATEGORI_LABEL: Record<string, string> = {
  alat_kebersihan: 'Alat Kebersihan',
  tempat_sampah: 'Tempat Sampah',
  area_pembuangan: 'Area Pembuangan',
  lainnya: 'Lainnya',
};
const KONDISI_COLOR: Record<string, string> = {
  Bersih: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'Kotor Ringan': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Kotor Berat': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};
const STATUS_COLOR: Record<string, string> = {
  Dilaporkan: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Diproses: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Selesai: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Dibatalkan: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function KebersIhanPage() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('Semua');
  const [viewMode, setViewMode] = useState<'daftar' | 'laporan'>('daftar');

  const [items, setItems] = useState<KebersIhan[]>([]);
  const [laporan, setLaporan] = useState<Laporan[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterKondisi, setFilterKondisi] = useState('');

  // Modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<KebersIhan | null>(null);
  const [showLaporanModal, setShowLaporanModal] = useState(false);
  const [reportingItem, setReportingItem] = useState<KebersIhan | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updatingLaporan, setUpdatingLaporan] = useState<Laporan | null>(null);

  // Forms
  const [itemForm, setItemForm] = useState({
    nama_item: '', kategori: 'alat_kebersihan', asrama: 'A', jumlah: 1, kondisi: 'Bersih', keterangan: ''
  });
  const [laporanForm, setLaporanForm] = useState({ deskripsi: '' });
  const [updateForm, setUpdateForm] = useState({ status: 'Diproses', tindakan: '', kondisi_akhir: 'Bersih' });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Import Excel State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // PDF Preview State
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'staff';
  // Petugas umum dan sarpras lihat semua tab asrama seperti admin
  // pengasuh & pengurus_asrama hanya lihat tab asrama mereka sendiri
  const isDoubleRoleAsrama = user?.role === 'guru' && (user?.is_pengasuh || user?.is_pengurus_asrama);
  const uRoleLower = (user?.role || '').toLowerCase();
  const isPetugas = uRoleLower.includes('petugas');
  const showAllTabs = isAdmin || isPetugas;
  const isPengasuhOrAdmin = isAdmin || isPetugas || ['pengurus_asrama', 'pengasuh'].includes(uRoleLower) || isDoubleRoleAsrama;

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setUser(d.user);
          if (d.user.role === 'pengurus_asrama' || d.user.role === 'pengasuh' || (d.user.role === 'guru' && (d.user.is_pengasuh || d.user.is_pengurus_asrama || d.user.asrama))) {
            const str = `${d.user.asrama || ''} ${d.user.real_name || ''} ${d.user.username || ''} ${d.user.nama || ''}`;
            if (/tahfid/i.test(str)) {
              setActiveTab('Tahfid');
            } else {
              const m = str.match(/asrama\s+([a-f])/i) || str.match(/(?:asrama|pengasuh)[_\-\s]?([a-f])(?:\b|_|\s|$)/i);
              if (m) setActiveTab(m[1].toUpperCase());
            }
          }
        }
      });
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/kebersihan'),
        fetch('/api/kebersihan/laporan'),
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      if (d1.success) setItems(d1.data);
      if (d2.success) setLaporan(d2.data);
    } catch {}
    setLoading(false);
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // --- FILTERED DATA ---
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const tabMatch = activeTab === 'Semua' || item.asrama === `Asrama ${activeTab}` || (activeTab === 'Tahfid' && item.asrama === 'Asrama Tahfid');
      const searchMatch = !search || item.nama_item.toLowerCase().includes(search.toLowerCase()) || item.asrama.toLowerCase().includes(search.toLowerCase());
      const kategoriMatch = !filterKategori || item.kategori === filterKategori;
      const kondisiMatch = !filterKondisi || item.kondisi === filterKondisi;
      return tabMatch && searchMatch && kategoriMatch && kondisiMatch;
    });
  }, [items, activeTab, search, filterKategori, filterKondisi]);

  const filteredLaporan = useMemo(() => {
    return laporan.filter(l => {
      const tabMatch = activeTab === 'Semua' || l.asrama === `Asrama ${activeTab}` || (activeTab === 'Tahfid' && l.asrama === 'Asrama Tahfid');
      const searchMatch = !search || l.nama_item.toLowerCase().includes(search.toLowerCase()) || l.deskripsi_masalah.toLowerCase().includes(search.toLowerCase());
      return tabMatch && searchMatch;
    });
  }, [laporan, activeTab, search]);

  // --- STATS ---
  const stats = useMemo(() => {
    const total = filteredItems.length;
    const bersih = filteredItems.filter(i => i.kondisi === 'Bersih').length;
    const kotorRingan = filteredItems.filter(i => i.kondisi === 'Kotor Ringan').length;
    const kotorBerat = filteredItems.filter(i => i.kondisi === 'Kotor Berat').length;
    const laporanAktif = filteredLaporan.filter(l => l.status === 'Dilaporkan' || l.status === 'Diproses').length;
    return { total, bersih, kotorRingan, kotorBerat, laporanAktif };
  }, [filteredItems, filteredLaporan]);

  // --- CRUD ITEM ---
  const openAddItem = () => {
    setEditingItem(null);
    setItemForm({ nama_item: '', kategori: 'alat_kebersihan', asrama: activeTab !== 'Semua' ? activeTab : 'A', jumlah: 1, kondisi: 'Bersih', keterangan: '' });
    setShowItemModal(true);
  };
  const openEditItem = (item: KebersIhan) => {
    setEditingItem(item);
    setItemForm({
      nama_item: item.nama_item,
      kategori: item.kategori,
      asrama: item.asrama.replace('Asrama ', ''),
      jumlah: item.jumlah,
      kondisi: item.kondisi,
      keterangan: item.keterangan || ''
    });
    setShowItemModal(true);
  };
  const submitItem = async () => {
    if (!itemForm.nama_item.trim()) { showToast('Nama item wajib diisi', 'error'); return; }
    setSubmitting(true);
    const asramaFull = itemForm.asrama === 'Tahfid' ? 'Asrama Tahfid' : `Asrama ${itemForm.asrama}`;
    const body = { ...itemForm, asrama: asramaFull };
    const method = editingItem ? 'PUT' : 'POST';
    const payload = editingItem ? { ...body, id: editingItem.id } : body;
    const res = await fetch('/api/kebersihan', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    setSubmitting(false);
    if (data.success) { showToast(editingItem ? 'Item berhasil diperbarui' : 'Item berhasil ditambahkan'); setShowItemModal(false); fetchData(); }
    else showToast(data.error || 'Gagal menyimpan', 'error');
  };
  const deleteItem = async (id: number, nama: string) => {
    if (!confirm(`Hapus item "${nama}"? Semua laporan terkait juga akan dihapus.`)) return;
    const res = await fetch('/api/kebersihan', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    const data = await res.json();
    if (data.success) { showToast('Item berhasil dihapus'); fetchData(); }
    else showToast(data.error || 'Gagal menghapus', 'error');
  };

  // --- LAPORAN ---
  const openLaporan = (item: KebersIhan) => { setReportingItem(item); setLaporanForm({ deskripsi: '' }); setShowLaporanModal(true); };
  const submitLaporan = async () => {
    if (!laporanForm.deskripsi.trim()) { showToast('Deskripsi masalah wajib diisi', 'error'); return; }
    setSubmitting(true);
    const res = await fetch('/api/kebersihan/laporan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kebersihan_id: reportingItem!.id, deskripsi_masalah: laporanForm.deskripsi })
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.success) { showToast('Laporan berhasil dikirim'); setShowLaporanModal(false); fetchData(); }
    else showToast(data.error || 'Gagal mengirim laporan', 'error');
  };

  // --- UPDATE LAPORAN ---
  const openUpdate = (l: Laporan) => { setUpdatingLaporan(l); setUpdateForm({ status: 'Diproses', tindakan: '', kondisi_akhir: 'Bersih' }); setShowUpdateModal(true); };
  const submitUpdate = async () => {
    if (!updateForm.status) return;
    setSubmitting(true);
    const res = await fetch('/api/kebersihan/laporan', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: updatingLaporan!.id, status: updateForm.status, tindakan_kebersihan: updateForm.tindakan, kondisi_akhir: updateForm.kondisi_akhir })
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.success) { showToast('Status laporan diperbarui'); setShowUpdateModal(false); fetchData(); }
    else showToast(data.error || 'Gagal memperbarui', 'error');
  };

  // --- EXPORT / IMPORT ---
  const handleImportExcel = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      fd.append('type', 'kebersihan');
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      const json = await res.json();
      setImportResult(json);
      if (json.success) fetchData();
    } catch {
      setImportResult({ success: false, error: 'Gagal menghubungi server' });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = (format: 'pdf' | 'excel' = 'pdf', previewOnly = false) => {
    if (filteredItems.length === 0) {
      alert('Tidak ada data untuk di-export.');
      return;
    }

    const title = 'LAPORAN KEBERSIHAN & PENGELOLAAN SAMPAH';
    const subtitle = `Filter Asrama: ${activeTab.toUpperCase()} | Kategori: ${filterKategori || 'Semua'} | Kondisi: ${filterKondisi || 'Semua'}`;
    const filename = `Kebersihan_Asrama_${activeTab}`;

    const tableColumn = ["NO", "NAMA ITEM", "KATEGORI", "ASRAMA", "JUMLAH", "KONDISI", "KETERANGAN"];
    const tableRows = filteredItems.map((item, idx) => [
      idx + 1,
      item.nama_item,
      KATEGORI_LABEL[item.kategori] || item.kategori,
      item.asrama,
      item.jumlah,
      item.kondisi,
      item.keterangan || '-'
    ]);

    if (format === 'excel') {
      exportToExcel({ title, subtitle, columns: tableColumn, rows: tableRows, filename });
    } else {
      const result = exportToPDF({ title, subtitle, columns: tableColumn, rows: tableRows, filename, previewOnly });
      if (previewOnly && result) {
        setPdfUrl(result);
        setShowPdfPreview(true);
      }
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      <p className="text-gray-500 dark:text-gray-400 text-sm">Memuat data kebersihan...</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease-out] ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-500'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header Card */}
      <div className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-tr-full pointer-events-none" />

        {/* Title row */}
        <div className="relative flex items-center gap-3 mb-4">
          <div className="bg-white/20 backdrop-blur-sm p-3 rounded-2xl shadow-inner">
            <Trash2 size={28} className="text-emerald-100" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Kebersihan & Pengelolaan Sampah</h1>
            <p className="text-emerald-200 text-xs mt-0.5">Manajemen kebersihan & pelaporan area asrama</p>
          </div>
        </div>

        {/* Action Buttons — matches jadwal page style */}
        <div className="relative flex flex-wrap gap-2">
          <button
            onClick={() => handleExport('pdf', true)}
            className="flex-1 md:flex-none justify-center flex items-center gap-1.5 px-3 py-2 bg-white/85 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold hover:bg-white transition-colors"
            title="Preview PDF"
          >
            <Eye size={14} /> Preview
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex-1 md:flex-none justify-center flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors"
            title="Export PDF"
          >
            <FileText size={14} /> PDF
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="flex-1 md:flex-none justify-center flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
            title="Export Excel"
          >
            <TableProperties size={14} /> Excel
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => downloadTemplate('kebersihan')}
                className="flex-1 md:flex-none justify-center flex items-center gap-1.5 px-3 py-2 bg-white text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-colors"
                title="Unduh Templat Excel"
              >
                <Download size={14} /> Templat
              </button>
              <button
                onClick={() => { setIsImportModalOpen(true); setImportFile(null); setImportResult(null); }}
                className="flex-1 md:flex-none justify-center flex items-center gap-1.5 px-3 py-2 bg-white text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-colors"
                title="Impor Excel"
              >
                <Upload size={14} /> Impor
              </button>
              <button
                onClick={openAddItem}
                className="flex-1 md:flex-none justify-center flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold transition-colors shadow-sm"
                title="Tambah Item"
              >
                <Plus size={14} /> <span className="hidden sm:inline">Tambah</span><span className="sm:hidden">+</span>
              </button>
            </>
          )}
        </div>

      </div>

      {/* Stats Grid — di luar header card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Item', val: stats.total, icon: <Package size={18} />, color: 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800', iconColor: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
          { label: 'Bersih', val: stats.bersih, icon: <Leaf size={18} />, color: 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800', iconColor: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
          { label: 'Kotor Ringan', val: stats.kotorRingan, icon: <AlertTriangle size={18} />, color: 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800', iconColor: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30' },
          { label: 'Laporan Aktif', val: stats.laporanAktif, icon: <Clock size={18} />, color: 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800', iconColor: 'text-red-500 bg-red-100 dark:bg-red-900/30' },
        ].map(s => (
          <div key={s.label} className={`${s.color} border rounded-2xl p-4 flex items-center gap-3 shadow-sm`}>
            <div className={`${s.iconColor} p-2.5 rounded-xl flex-shrink-0`}>
              {s.icon}
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-800 dark:text-gray-100 leading-tight">{s.val}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Asrama — pengurus_asrama & pengasuh & guru peran ganda hanya tampilkan tab asrama terkait */}
      {(user?.role === 'pengurus_asrama' || user?.role === 'pengasuh' || isDoubleRoleAsrama) ? (
        <div className="bg-white dark:bg-gray-900 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 w-full text-center">
          <div className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-sm w-full">
            <MapPin size={16} />
            <span>{activeTab === 'Tahfid' ? 'Asrama Tahfid' : `Asrama ${activeTab}`}</span>
          </div>
        </div>
      ) : showAllTabs ? (
        <div className="space-y-2">
          {/* Tab Semua — full width */}
          <button
            onClick={() => setActiveTab('Semua')}
            className={`w-full py-2.5 rounded-2xl text-xs font-bold transition-all ${activeTab === 'Semua' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border border-gray-200 dark:border-gray-700'}`}
          >
            🏠 Semua Asrama
          </button>
          {/* Asrama tabs — wrap equally */}
          <div className="flex flex-wrap gap-2">
            {ASRAMA_LIST.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 min-w-[80px] py-2 rounded-2xl text-xs font-bold transition-all ${activeTab === tab ? 'bg-emerald-600 text-white shadow-md scale-105' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border border-gray-200 dark:border-gray-700'}`}
              >
                {tab === 'Tahfid' ? 'Tahfid' : `Asrama ${tab}`}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* View Toggle & Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {/* View mode tabs — equal width on mobile */}
          <div className="flex flex-1 gap-2 min-w-full sm:min-w-0">
            <button onClick={() => setViewMode('daftar')} className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'daftar' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-emerald-50'}`}>
              <Package size={14} /> Daftar Item
            </button>
            <button onClick={() => setViewMode('laporan')} className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'laporan' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-emerald-50'}`}>
              <ShieldAlert size={14} /> Laporan Kebersihan
              {stats.laporanAktif > 0 && <span className="ml-1 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{stats.laporanAktif}</span>}
            </button>
          </div>
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-xl flex-1 min-w-[140px] max-w-xs">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari..." className="bg-transparent text-xs outline-none w-full text-gray-700 dark:text-gray-200 placeholder-gray-400" />
          </div>
        </div>
        {viewMode === 'daftar' && (
          <div className="flex gap-2 flex-wrap">
            <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)} className="text-xs px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none">
              <option value="">Semua Kategori</option>
              {Object.entries(KATEGORI_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterKondisi} onChange={e => setFilterKondisi(e.target.value)} className="text-xs px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none">
              <option value="">Semua Kondisi</option>
              {['Bersih', 'Kotor Ringan', 'Kotor Berat'].map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* DAFTAR ITEM */}
      {viewMode === 'daftar' && (
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center border border-dashed border-gray-200 dark:border-gray-700">
              <Trash2 size={40} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Belum ada item kebersihan</p>
              {isAdmin && <button onClick={openAddItem} className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors">+ Tambah Item</button>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredItems.map(item => (
                <div key={item.id} className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow group">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight truncate">{item.nama_item}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{KATEGORI_LABEL[item.kategori] || item.kategori}</p>
                    </div>
                    <span className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${KONDISI_COLOR[item.kondisi]}`}>{item.kondisi}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
                    <span className="flex items-center gap-1"><MapPin size={11} /> {item.asrama}{item.nama_kamar ? ` • ${item.nama_kamar}` : ''}</span>
                    <span className="flex items-center gap-1"><Package size={11} /> {item.jumlah} unit</span>
                  </div>
                  {item.keterangan && <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl p-2 mb-3 line-clamp-2">{item.keterangan}</p>}
                  <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    {isPengasuhOrAdmin && (
                      <button onClick={() => openLaporan(item)} className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 rounded-xl transition-colors">
                        <AlertTriangle size={13} /> Laporkan
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button onClick={() => openEditItem(item)} className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 rounded-xl transition-colors">
                          <Edit size={13} />
                        </button>
                        <button onClick={() => deleteItem(item.id, item.nama_item)} className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 rounded-xl transition-colors">
                          <X size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LAPORAN */}
      {viewMode === 'laporan' && (
        <div className="space-y-3">
          {filteredLaporan.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center border border-dashed border-gray-200 dark:border-gray-700">
              <CheckCircle size={40} className="mx-auto mb-3 text-emerald-300" />
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Belum ada laporan kebersihan</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLaporan.map(l => (
                <div key={l.id} className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">{l.nama_item}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{l.asrama} • {new Date(l.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <span className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${STATUS_COLOR[l.status] || ''}`}>{l.status}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-2.5 mb-2">{l.deskripsi_masalah}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mb-2">
                    <span className="flex items-center gap-1"><User size={11} /> Pelapor: {l.nama_pelapor}</span>
                    {l.nama_petugas && <span className="flex items-center gap-1"><Wind size={11} /> Petugas: {l.nama_petugas}</span>}
                  </div>
                  {l.tindakan_kebersihan && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-2.5 mb-2">✓ {l.tindakan_kebersihan}</p>
                  )}
                  {isPengasuhOrAdmin && (l.status === 'Dilaporkan' || l.status === 'Diproses') && (
                    <button onClick={() => openUpdate(l)} className="w-full mt-1 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 rounded-xl transition-colors">
                      Perbarui Status
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================== MODALS ======================== */}

      {/* MODAL TAMBAH/EDIT ITEM */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-4" onClick={() => setShowItemModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-gray-800 dark:text-gray-100 text-base">{editingItem ? 'Edit Item Kebersihan' : 'Tambah Item Kebersihan'}</h2>
              <button onClick={() => setShowItemModal(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">Nama Item <span className="text-red-500">*</span></label>
                <input value={itemForm.nama_item} onChange={e => setItemForm(p => ({ ...p, nama_item: e.target.value }))} placeholder="cth. Sapu, Tempat Sampah, Area Belakang..." className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 outline-none focus:border-emerald-400 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">Kategori</label>
                  <select value={itemForm.kategori} onChange={e => setItemForm(p => ({ ...p, kategori: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 outline-none">
                    {Object.entries(KATEGORI_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">Asrama</label>
                  <select value={itemForm.asrama} onChange={e => setItemForm(p => ({ ...p, asrama: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 outline-none">
                    {ASRAMA_LIST.map(a => <option key={a} value={a}>{a === 'Tahfid' ? 'Tahfid' : `Asrama ${a}`}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">Jumlah</label>
                  <input type="number" min={1} value={itemForm.jumlah} onChange={e => setItemForm(p => ({ ...p, jumlah: Number(e.target.value) }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 outline-none focus:border-emerald-400" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">Kondisi</label>
                  <select value={itemForm.kondisi} onChange={e => setItemForm(p => ({ ...p, kondisi: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 outline-none">
                    <option value="Bersih">Bersih</option>
                    <option value="Kotor Ringan">Kotor Ringan</option>
                    <option value="Kotor Berat">Kotor Berat</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">Keterangan</label>
                <textarea value={itemForm.keterangan} onChange={e => setItemForm(p => ({ ...p, keterangan: e.target.value }))} rows={2} placeholder="Keterangan tambahan (opsional)" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 outline-none focus:border-emerald-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowItemModal(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Batal</button>
              <button onClick={submitItem} disabled={submitting} className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-50 shadow-sm">
                {submitting ? 'Menyimpan...' : (editingItem ? 'Simpan Perubahan' : 'Tambah Item')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LAPORAN */}
      {showLaporanModal && reportingItem && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-4" onClick={() => setShowLaporanModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-gray-800 dark:text-gray-100 text-base">Laporan Kebersihan</h2>
              <button onClick={() => setShowLaporanModal(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><X size={18} /></button>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-3 flex items-center gap-3">
              <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{reportingItem.nama_item}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{reportingItem.asrama} • Kondisi: {reportingItem.kondisi}</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">Deskripsi Masalah <span className="text-red-500">*</span></label>
              <textarea value={laporanForm.deskripsi} onChange={e => setLaporanForm({ deskripsi: e.target.value })} rows={4} placeholder="Jelaskan kondisi kebersihan yang bermasalah, lokasi, dan detail lainnya..." className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 outline-none focus:border-amber-400 resize-none transition-colors" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowLaporanModal(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-bold hover:bg-gray-50 transition-colors">Batal</button>
              <button onClick={submitLaporan} disabled={submitting} className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors disabled:opacity-50 shadow-sm">
                {submitting ? 'Mengirim...' : 'Kirim Laporan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL UPDATE STATUS LAPORAN */}
      {showUpdateModal && updatingLaporan && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-4" onClick={() => setShowUpdateModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-gray-800 dark:text-gray-100 text-base">Perbarui Status Laporan</h2>
              <button onClick={() => setShowUpdateModal(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><X size={18} /></button>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-3">
              <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{updatingLaporan.nama_item}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{updatingLaporan.deskripsi_masalah}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">Status Baru</label>
                <select value={updateForm.status} onChange={e => setUpdateForm(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 outline-none">
                  <option value="Diproses">Diproses (sedang dikerjakan)</option>
                  <option value="Selesai">Selesai (sudah dibersihkan)</option>
                  <option value="Dibatalkan">Dibatalkan</option>
                </select>
              </div>
              {updateForm.status === 'Selesai' && (
                <div>
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">Kondisi Akhir</label>
                  <select value={updateForm.kondisi_akhir} onChange={e => setUpdateForm(p => ({ ...p, kondisi_akhir: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 outline-none">
                    <option value="Bersih">Bersih ✓</option>
                    <option value="Kotor Ringan">Kotor Ringan (sebagian)</option>
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">Tindakan yang Dilakukan</label>
                <textarea value={updateForm.tindakan} onChange={e => setUpdateForm(p => ({ ...p, tindakan: e.target.value }))} rows={3} placeholder="Ceritakan tindakan pembersihan yang telah dilakukan..." className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 outline-none focus:border-emerald-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowUpdateModal(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-bold hover:bg-gray-50 transition-colors">Batal</button>
              <button onClick={submitUpdate} disabled={submitting} className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-50 shadow-sm">
                {submitting ? 'Memperbarui...' : 'Simpan Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IMPORT EXCEL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-4" onClick={() => setIsImportModalOpen(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-gray-800 dark:text-gray-100 text-base">Impor Data Kebersihan</h2>
              <button onClick={() => setIsImportModalOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><X size={18} /></button>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-3 text-xs text-emerald-700 dark:text-emerald-300">
              <p className="font-bold mb-1">Panduan Impor:</p>
              <ul className="list-disc list-inside space-y-0.5 text-emerald-600 dark:text-emerald-400">
                <li>Unduh templat Excel terlebih dahulu</li>
                <li>Isi data sesuai format kolom yang tersedia</li>
                <li>Kolom wajib: Nama Item, Kategori, Asrama, Kondisi</li>
                <li>Upload file .xlsx atau .xls</li>
              </ul>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 block">Pilih File Excel</label>
              <div
                className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-6 text-center cursor-pointer hover:border-emerald-400 transition-colors"
                onClick={() => importFileRef.current?.click()}
              >
                <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                {importFile ? (
                  <p className="text-sm font-bold text-emerald-600">{importFile.name}</p>
                ) : (
                  <p className="text-sm text-gray-400">Klik untuk memilih file .xlsx / .xls</p>
                )}
              </div>
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => setImportFile(e.target.files?.[0] || null)}
              />
            </div>
            {importResult && (
              <div className={`rounded-2xl p-3 text-xs font-bold ${importResult.success ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                {importResult.success
                  ? `✓ Berhasil mengimpor ${importResult.inserted ?? ''} data.`
                  : `✗ ${importResult.error || 'Terjadi kesalahan saat impor.'}`}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setIsImportModalOpen(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-bold hover:bg-gray-50 transition-colors">Tutup</button>
              <button
                onClick={handleImportExcel}
                disabled={!importFile || importing}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
              >
                {importing ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Mengimpor...</>
                ) : (
                  <><Upload size={14} /> Impor Sekarang</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PDF PREVIEW */}
      {showPdfPreview && pdfUrl && (
        <div className="fixed inset-0 bg-black/80 z-[110] flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-extrabold text-gray-800 dark:text-gray-100 text-base flex items-center gap-2">
                <FileText size={18} className="text-emerald-600" /> Preview PDF Kebersihan
              </h2>
              <div className="flex items-center gap-2">
                <a
                  href={pdfUrl}
                  download={`Kebersihan_Asrama_${activeTab}.pdf`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  <Download size={14} /> Unduh PDF
                </a>
                <button onClick={() => setShowPdfPreview(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe src={pdfUrl} className="w-full h-full" style={{ minHeight: '60vh' }} title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
