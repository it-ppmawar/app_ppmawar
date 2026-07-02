'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, UserX, FileWarning, Search, Filter, Plus, Calendar, Clock, ChevronDown, CheckCircle, Trash2, Edit, FileText, Download, X, Save, User } from 'lucide-react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────
interface RowItem {
  id: number;
  nama: string;
  jenis_kelamin?: string;
  kelas: string;
  tanggal: string;
  raw_tanggal: string;
  keterangan?: string;
  jenis?: string;
  poin?: number;
  ditindak: boolean;
  murid_id?: number;
  deskripsi?: string;
}

interface MuridOption { murid_id: number; nama: string; nis: string; }

const JENIS_PELANGGARAN = [
  'Tidak Hadir (Alpa)',
  'Sakit',
  'Izin',
  'Terlambat',
  'HP / Gadget Tanpa Izin',
  'Keluar Asrama Tanpa Izin',
  'Tidak Memakai Seragam',
  'Membawa Barang Terlarang',
  'Perkelahian / Kekerasan',
  'Pelanggaran Tata Tertib Lainnya',
];

// ─── Modal Komponen ────────────────────────────────────────────────────────────
function PelanggaranModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'edit';
  initial?: RowItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().substring(0, 10);
  const [muridList, setMuridList] = useState<MuridOption[]>([]);
  const [muridSearch, setMuridSearch] = useState('');
  const [selectedMurid, setSelectedMurid] = useState<MuridOption | null>(null);
  const [jenis, setJenis] = useState(initial?.jenis || initial?.keterangan || '');
  const [deskripsi, setDeskripsi] = useState(initial?.deskripsi || '');
  const [tanggal, setTanggal] = useState(
    initial?.raw_tanggal ? new Date(initial.raw_tanggal).toISOString().substring(0, 10) : today
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetch('/api/murid')
      .then(r => r.json())
      .then(d => { if (d.success) setMuridList(d.data || []); })
      .catch(console.error);
  }, []);

  const filteredMurid = muridList.filter(m =>
    m.nama.toLowerCase().includes(muridSearch.toLowerCase()) ||
    m.nis?.toLowerCase().includes(muridSearch.toLowerCase())
  ).slice(0, 20);

  const handleSave = async () => {
    if (mode === 'add' && !selectedMurid) { setError('Pilih santri terlebih dahulu'); return; }
    if (!jenis) { setError('Jenis pelanggaran wajib diisi'); return; }
    if (!tanggal) { setError('Tanggal wajib diisi'); return; }

    setSaving(true);
    setError('');
    try {
      let res;
      if (mode === 'add') {
        res = await fetch('/api/ketertiban', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ murid_id: selectedMurid!.murid_id, jenis, deskripsi, tanggal }),
        });
      } else {
        res = await fetch('/api/ketertiban', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: initial!.id, jenis, deskripsi, tanggal }),
        });
      }
      const data = await res.json();
      if (res.ok && data.success) {
        onSaved();
        onClose();
      } else {
        setError(data.error || 'Terjadi kesalahan');
      }
    } catch (e: any) {
      setError('Koneksi gagal: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 bg-gradient-to-r from-red-600 to-orange-500 text-white">
          <h3 className="font-bold flex items-center gap-2">
            {mode === 'add' ? <Plus size={20} /> : <Edit size={20} />}
            {mode === 'add' ? 'Tambah Catatan Pelanggaran' : 'Edit Catatan Pelanggaran'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm px-4 py-2.5 rounded-xl">
              {error}
            </div>
          )}

          {/* Pilih Santri (hanya saat mode add) */}
          {mode === 'add' && (
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5">
                Santri <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-red-400">
                  <User size={16} className="ml-3 text-gray-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Cari nama atau NIS santri..."
                    value={selectedMurid ? selectedMurid.nama : muridSearch}
                    onChange={e => {
                      setMuridSearch(e.target.value);
                      setSelectedMurid(null);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 outline-none"
                  />
                  {selectedMurid && (
                    <button onClick={() => { setSelectedMurid(null); setMuridSearch(''); }} className="mr-2 text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  )}
                </div>
                {showDropdown && !selectedMurid && filteredMurid.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredMurid.map(m => (
                      <li
                        key={m.murid_id}
                        className="px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-800 last:border-0"
                        onMouseDown={() => { setSelectedMurid(m); setShowDropdown(false); setMuridSearch(''); }}
                      >
                        <span className="font-semibold">{m.nama}</span>
                        <span className="text-xs text-gray-400 ml-2">NIS: {m.nis}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {selectedMurid && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <CheckCircle size={12} /> Terpilih: <strong>{selectedMurid.nama}</strong> (NIS: {selectedMurid.nis})
                </p>
              )}
            </div>
          )}

          {/* Jenis Pelanggaran */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5">
              Jenis Pelanggaran <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={jenis}
                onChange={e => setJenis(e.target.value)}
                className="w-full appearance-none px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-red-400"
              >
                <option value="">-- Pilih Jenis --</option>
                {JENIS_PELANGGARAN.map(j => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
            </div>
            {/* Custom jenis jika tidak ada di daftar */}
            <input
              type="text"
              placeholder="Atau tulis jenis pelanggaran lain..."
              value={JENIS_PELANGGARAN.includes(jenis) ? '' : jenis}
              onChange={e => setJenis(e.target.value)}
              className="w-full mt-2 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>

          {/* Deskripsi */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5">
              Keterangan / Deskripsi
            </label>
            <textarea
              value={deskripsi}
              onChange={e => setDeskripsi(e.target.value)}
              rows={3}
              placeholder="Tambahkan keterangan detail (opsional)..."
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
          </div>

          {/* Tanggal */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5">
              Tanggal <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={tanggal}
              onChange={e => setTanggal(e.target.value)}
              max={today}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
          >
            {saving ? 'Menyimpan...' : <><Save size={18} /> Simpan</>}
          </button>
          <button
            onClick={onClose}
            className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 px-5 rounded-xl transition-colors"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function KetertibanPage() {
  const [activeTab, setActiveTab] = useState<'alpa' | 'pelanggaran'>('alpa');

  const [dataAlpa, setDataAlpa] = useState<RowItem[]>([]);
  const [dataPelanggaran, setDataPelanggaran] = useState<RowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editItem, setEditItem] = useState<RowItem | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const resAlpa = await fetch('/api/ketertiban?tab=alpa');
      const jsonAlpa = await resAlpa.json();
      if (jsonAlpa.success) setDataAlpa(jsonAlpa.data);

      const resPelanggaran = await fetch('/api/ketertiban?tab=pelanggaran');
      const jsonPelanggaran = await resPelanggaran.json();
      if (jsonPelanggaran.success) setDataPelanggaran(jsonPelanggaran.data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => { if (data.success) setRole(data.user.role); })
      .catch(console.error);
  }, []);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return ' ⇅';
    return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  };

  const filteredAlpa = dataAlpa.filter(item =>
    item.nama?.toLowerCase().includes(search.toLowerCase()) ||
    item.kelas?.toLowerCase().includes(search.toLowerCase()) ||
    item.keterangan?.toLowerCase().includes(search.toLowerCase()) ||
    item.jenis_kelamin?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPelanggaran = dataPelanggaran.filter(item =>
    item.nama?.toLowerCase().includes(search.toLowerCase()) ||
    item.kelas?.toLowerCase().includes(search.toLowerCase()) ||
    item.jenis?.toLowerCase().includes(search.toLowerCase()) ||
    item.jenis_kelamin?.toLowerCase().includes(search.toLowerCase())
  );

  const sortData = (dataList: RowItem[]) => {
    if (!sortConfig) return dataList;
    return [...dataList].sort((a: any, b: any) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      if (sortConfig.key === 'tanggal') {
        const dateA = a.raw_tanggal ? new Date(a.raw_tanggal).getTime() : 0;
        const dateB = b.raw_tanggal ? new Date(b.raw_tanggal).getTime() : 0;
        return sortConfig.direction === 'ascending' ? dateA - dateB : dateB - dateA;
      }
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';
      const compareResult = valA.toString().localeCompare(valB.toString(), undefined, { numeric: true, sensitivity: 'base' });
      return sortConfig.direction === 'ascending' ? compareResult : -compareResult;
    });
  };

  const sortedAlpa = sortData(filteredAlpa);
  const sortedPelanggaran = sortData(filteredPelanggaran);

  // Export State
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  const handleExport = (format: 'pdf' | 'excel' = 'pdf', previewOnly = false) => {
    const exportData = activeTab === 'alpa' ? sortedAlpa : sortedPelanggaran;
    if (exportData.length === 0) { alert('Tidak ada data untuk di-export.'); return; }

    const title = activeTab === 'alpa' ? "DATA ALPA (TIDAK HADIR)" : 'DATA PELANGGARAN';
    const subtitle = `Filter Pencarian: ${search || 'Semua Data'}`;
    const filename = `Data_Ketertiban_${activeTab}`;

    const tableColumn = activeTab === 'alpa'
      ? ["NO", "TANGGAL", "NAMA SANTRI", "J. KELAMIN", "KETERANGAN ALPA"]
      : ["NO", "TANGGAL", "NAMA SANTRI", "J. KELAMIN", "PELANGGARAN"];

    const tableRows: any[] = [];
    exportData.forEach((item, idx) => {
      if (activeTab === 'alpa') {
        tableRows.push([idx + 1, item.tanggal || '-', item.nama || '-', item.jenis_kelamin || '-', item.keterangan || '-']);
      } else {
        tableRows.push([idx + 1, item.tanggal || '-', item.nama || '-', item.jenis_kelamin || '-', item.jenis || '-']);
      }
    });

    if (format === 'excel') {
      import('@/lib/exportUtils').then(({ exportToExcel }) => exportToExcel({ title, subtitle, columns: tableColumn, rows: tableRows, filename }));
    } else {
      import('@/lib/exportUtils').then(({ exportToPDF }) => {
        const result = exportToPDF({ title, subtitle, columns: tableColumn, rows: tableRows, filename, previewOnly });
        if (previewOnly && result) { setPdfUrl(result); setShowPdfPreview(true); }
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Apakah Anda yakin ingin menghapus catatan ini?')) {
      const res = await fetch(`/api/ketertiban?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchData();
      else alert(data.error || 'Gagal menghapus data');
    }
  };

  const handleEdit = (item: RowItem) => {
    setEditItem(item);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditItem(null);
    setModalMode('add');
    setShowModal(true);
  };

  const canManage = role === 'admin' || role === 'staff' || role === 'pengurus_asrama' || role === 'guru';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header Halaman */}
      <div className="bg-gradient-to-br from-red-50 to-orange-100 dark:from-red-900/40 dark:to-orange-900/40 rounded-3xl p-6 shadow-sm border border-red-200 dark:border-red-800/50 relative overflow-hidden transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-red-200/50 dark:text-red-800/30">
          <AlertTriangle size={120} />
        </div>
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-red-800 dark:text-red-400 drop-shadow-sm flex items-center gap-2">
              <FileWarning size={28} /> Ketertiban Murid
            </h1>
            <p className="text-red-600 dark:text-red-300 text-sm mt-1 font-medium max-w-xs">
              Sistem pencatatan otomatis siswa alpa dan riwayat pelanggaran tata tertib pesantren.
            </p>
          </div>
          {canManage && (
            <button
              onClick={handleAdd}
              className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-lg transition-all hover:scale-105 flex items-center justify-center active:scale-95"
              title="Tambah Catatan Pelanggaran"
            >
              <Plus size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Ringkasan Statistik */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center transition-colors">
          <div className="bg-red-100 dark:bg-red-900/50 p-2 rounded-full mb-2">
            <UserX size={20} className="text-red-600 dark:text-red-400" />
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Total Alpa</p>
          <p className="text-2xl font-black text-gray-800 dark:text-gray-100">{dataAlpa.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center transition-colors">
          <div className="bg-orange-100 dark:bg-orange-900/50 p-2 rounded-full mb-2">
            <Clock size={20} className="text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Total Izin</p>
          <p className="text-2xl font-black text-gray-800 dark:text-gray-100">
            {dataAlpa.filter(a => a.keterangan?.toLowerCase().includes('izin')).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center transition-colors">
          <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-full mb-2">
            <AlertTriangle size={20} className="text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Pelanggaran</p>
          <p className="text-2xl font-black text-gray-800 dark:text-gray-100">{dataPelanggaran.length}</p>
        </div>
      </div>

      {/* Kontrol Pencarian & Filter & Export */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Cari nama murid..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 dark:text-gray-200 transition-colors"
          />
        </div>
        <div className="flex w-full sm:w-auto gap-2 shrink-0 overflow-x-auto pb-2 sm:pb-0">
          <button onClick={() => handleExport('pdf', true)} className="flex-1 justify-center px-3 py-2.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1.5 shrink-0" title="Preview PDF">
            <FileText size={14} /> Preview
          </button>
          <button onClick={() => handleExport('pdf', false)} className="flex-1 justify-center px-3 py-2.5 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5 shrink-0" title="Export PDF">
            <Download size={14} /> PDF
          </button>
          <button onClick={() => handleExport('excel', false)} className="flex-1 justify-center px-3 py-2.5 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors flex items-center gap-1.5 shrink-0" title="Export Excel">
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('alpa')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'alpa' ? 'bg-white dark:bg-gray-700 shadow-sm text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
        >
          Rekap Alpa & Izin
        </button>
        <button
          onClick={() => setActiveTab('pelanggaran')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'pelanggaran' ? 'bg-white dark:bg-gray-700 shadow-sm text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
        >
          Pelanggaran Lain
        </button>
      </div>

      {/* Daftar Konten Tabel */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Memuat data...</div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'alpa' ? (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('nama')}>Nama Santri{getSortIcon('nama')}</th>
                    <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('jenis_kelamin')}>J. Kelamin{getSortIcon('jenis_kelamin')}</th>
                    <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('keterangan')}>Keterangan{getSortIcon('keterangan')}</th>
                    <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('tanggal')}>Tanggal{getSortIcon('tanggal')}</th>
                    <th className="px-4 py-4 text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('ditindak')}>Status{getSortIcon('ditindak')}</th>
                    {canManage && <th className="px-4 py-4 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sortedAlpa.length === 0 ? (
                    <tr><td colSpan={canManage ? 6 : 5} className="text-center py-8 text-gray-500 dark:text-gray-400">Tidak ada data Alpa/Izin.</td></tr>
                  ) : sortedAlpa.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors text-gray-700 dark:text-gray-200">
                      <td className="px-4 py-3 font-bold">{item.nama}</td>
                      <td className="px-4 py-3 text-xs font-medium uppercase text-gray-600 dark:text-gray-300">{item.jenis_kelamin || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
                          String(item.keterangan || '').toLowerCase().includes('alpa')
                            ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50'
                            : 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50'
                        }`}>
                          {item.keterangan || 'Tanpa Keterangan'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 font-medium">
                          <Calendar size={12} className="text-gray-400" /> {item.tanggal}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.ditindak ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full border border-green-200 dark:border-green-800/30">
                            <CheckCircle size={12} /> Selesai
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-orange-600 dark:text-orange-400 font-bold bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full border border-orange-200 dark:border-orange-800/30">
                            Menunggu
                          </span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                              title="Hapus"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('nama')}>Nama Santri{getSortIcon('nama')}</th>
                    <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('jenis_kelamin')}>J. Kelamin{getSortIcon('jenis_kelamin')}</th>
                    <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('jenis')}>Jenis Pelanggaran{getSortIcon('jenis')}</th>
                    <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('tanggal')}>Tanggal{getSortIcon('tanggal')}</th>
                    <th className="px-4 py-4 text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('ditindak')}>Status{getSortIcon('ditindak')}</th>
                    {canManage && <th className="px-4 py-4 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sortedPelanggaran.length === 0 ? (
                    <tr><td colSpan={canManage ? 6 : 5} className="text-center py-8 text-gray-500 dark:text-gray-400">Tidak ada data pelanggaran lain.</td></tr>
                  ) : sortedPelanggaran.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors text-gray-700 dark:text-gray-200">
                      <td className="px-4 py-3 font-bold">{item.nama}</td>
                      <td className="px-4 py-3 text-xs font-medium uppercase text-gray-600 dark:text-gray-300">{item.jenis_kelamin || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="bg-gray-50 dark:bg-gray-900/50 px-2.5 py-1 rounded-lg border border-gray-100 dark:border-gray-700 inline-block">
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{item.jenis}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 font-medium">
                          <Calendar size={12} className="text-gray-400" /> {item.tanggal}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.ditindak ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full border border-green-200 dark:border-green-800/30">
                            <CheckCircle size={12} /> Selesai
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-orange-600 dark:text-orange-400 font-bold bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full border border-orange-200 dark:border-orange-800/30">
                            Menunggu
                          </span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                              title="Hapus"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Tambah/Edit Modal */}
      {showModal && (
        <PelanggaranModal
          mode={modalMode}
          initial={editItem}
          onClose={() => setShowModal(false)}
          onSaved={fetchData}
        />
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-gray-800 w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <FileText className="text-red-500" size={20} />
                Preview PDF Data Ketertiban
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('pdf', false)}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors flex items-center gap-2"
                >
                  <Download size={16} /> Download
                </button>
                <button
                  onClick={() => setShowPdfPreview(false)}
                  className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 p-2 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="hidden md:block flex-1 bg-gray-200 dark:bg-black/50 p-4 h-full">
              <iframe src={pdfUrl} className="w-full h-full rounded-xl shadow-inner bg-white" title="PDF Preview" style={{ minHeight: '60vh' }} />
            </div>
            <div className="flex md:hidden flex-1 flex-col items-center justify-center gap-5 p-8 bg-gray-50 dark:bg-gray-900/50">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center">
                <FileText size={40} className="text-red-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">Preview PDF tidak tersedia di HP</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Gunakan tombol di bawah untuk membuka atau mengunduh file PDF.</p>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-md transition-colors">
                  <FileText size={18} /> Buka di Tab Baru
                </a>
                <a href={pdfUrl} download className="flex items-center justify-center gap-2 w-full py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-2xl transition-colors">
                  <Download size={18} /> Unduh PDF
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
