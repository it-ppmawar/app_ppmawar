'use client';

import { useEffect, useState } from 'react';
import { Archive, Plus, Search, MapPin, Package, PenTool, CheckCircle, Clock, AlertTriangle, ShieldAlert, Trash2, Edit, X, Download, User, Upload, FileText } from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';
import { downloadTemplate } from '@/lib/downloadTemplate';

interface Inventaris {
  id: number;
  nama_barang: string;
  kategori: string;
  asrama: string;
  kamar_id: number | null;
  nama_kamar: string | null;
  jumlah: number;
  kondisi: string;
  keterangan: string | null;
  laporan_aktif: number;
}

interface Laporan {
  id: number;
  inventaris_id: number;
  nama_barang: string;
  asrama: string;
  kategori: string;
  pelapor_id: number;
  nama_pelapor: string;
  nama_petugas: string | null;
  deskripsi_masalah: string;
  status: string;
  tindakan_perbaikan: string | null;
  tanggal_selesai: string | null;
  created_at: string;
}

export default function InventarisPage() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('Semua');
  const [viewMode, setViewMode] = useState<'daftar' | 'laporan'>('daftar');
  
  const [items, setItems] = useState<Inventaris[]>([]);
  const [laporan, setLaporan] = useState<Laporan[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterKondisi, setFilterKondisi] = useState('');

  // Modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Inventaris | null>(null);
  
  const [showLaporanModal, setShowLaporanModal] = useState(false);
  const [reportingItem, setReportingItem] = useState<Inventaris | null>(null);
  
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updatingLaporan, setUpdatingLaporan] = useState<Laporan | null>(null);

  // Forms
  const [itemForm, setItemForm] = useState({
    nama_barang: '', kategori: 'alat', asrama: 'A', jumlah: 1, kondisi: 'Baik', keterangan: ''
  });
  const [laporanForm, setLaporanForm] = useState({ deskripsi: '' });
  const [updateForm, setUpdateForm] = useState({ status: 'Diproses', tindakan: '', kondisi_akhir: 'Baik' });

  // Import Excel State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  
  // PDF Preview State
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
           setUser(data.user);
          if (data.user.role === 'pengurus_asrama' || data.user.role === 'pengasuh' || (data.user.role === 'guru' && (data.user.is_pengasuh || data.user.is_pengurus_asrama || data.user.asrama))) {
            const str = `${data.user.asrama || ''} ${data.user.real_name || ''} ${data.user.username || ''} ${data.user.nama || ''}`;
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
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const resItems = await fetch('/api/inventaris');
      const dataItems = await resItems.json();
      if (dataItems.success) setItems(dataItems.data);

      const resLaporan = await fetch('/api/inventaris/laporan');
      const dataLaporan = await resLaporan.json();
      if (dataLaporan.success) setLaporan(dataLaporan.data);
    } catch (error) {
      console.error('Fetch error', error);
    }
    setLoading(false);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingItem ? 'PUT' : 'POST';
    const body = editingItem ? { ...itemForm, id: editingItem.id } : itemForm;
    
    try {
      const res = await fetch('/api/inventaris', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setShowItemModal(false);
        fetchData();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Gagal menghubungi server');
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus barang ini secara permanen?')) return;
    try {
      const res = await fetch('/api/inventaris', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) fetchData();
      else alert(data.error);
    } catch (err) {
      alert('Gagal menghapus');
    }
  };

  const handleKirimLaporan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingItem) return;
    try {
      const res = await fetch('/api/inventaris/laporan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventaris_id: reportingItem.id, deskripsi_masalah: laporanForm.deskripsi })
      });
      const data = await res.json();
      if (data.success) {
        setShowLaporanModal(false);
        setLaporanForm({ deskripsi: '' });
        alert('Laporan berhasil dikirim');
        fetchData();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Gagal menghubungi server');
    }
  };

  const handleUpdateLaporan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingLaporan) return;
    try {
      const res = await fetch('/api/inventaris/laporan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: updatingLaporan.id, 
          status: updateForm.status, 
          tindakan_perbaikan: updateForm.tindakan,
          kondisi_akhir: updateForm.kondisi_akhir 
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowUpdateModal(false);
        fetchData();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Gagal menghubungi server');
    }
  };

  const handleImportExcel = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      fd.append('type', 'inventaris');
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      const json = await res.json();
      setImportResult(json);
      if (json.success) fetchData();
    } catch (err) {
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

    const title = 'LAPORAN INVENTARIS ASRAMA';
    const subtitle = `Filter Asrama: ${activeTab.toUpperCase()} | Kategori: ${filterKategori || 'Semua'} | Kondisi: ${filterKondisi || 'Semua'}`;
    const filename = `Inventaris_Asrama_${activeTab}`;

    const tableColumn = ["NO", "NAMA BARANG", "KATEGORI", "ASRAMA", "JUMLAH", "KONDISI", "KETERANGAN"];
    const tableRows = filteredItems.map((item, idx) => [
      idx + 1,
      item.nama_barang,
      item.kategori,
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

  // Filter Data
  const filteredItems = items.filter(item => {
    if (activeTab !== 'Semua' && item.asrama !== activeTab && item.asrama !== `Asrama ${activeTab}`) return false;
    if (filterKategori && item.kategori !== filterKategori) return false;
    if (filterKondisi && item.kondisi !== filterKondisi) return false;
    if (search && !item.nama_barang.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredLaporan = laporan.filter(l => {
    if (activeTab !== 'Semua' && l.asrama !== activeTab && l.asrama !== `Asrama ${activeTab}`) return false;
    return true;
  });

  const dorms = ['Semua', 'A', 'B', 'C', 'D', 'E', 'F', 'Tahfid'];

  const canAddDelete = user?.role === 'admin' || user?.role === 'staff';
  const canEdit = canAddDelete || ['petugas_sarpras', 'pengurus_asrama', 'pengasuh', 'petugas_inventaris', 'petugas_inventaris_umum', 'petugas_umum'].includes(user?.role || '') || (user?.role === 'guru' && (user?.is_pengasuh || user?.is_pengurus_asrama));
  const canUpdateLaporan = canAddDelete || ['petugas_sarpras', 'petugas_inventaris', 'petugas_inventaris_umum', 'petugas_umum'].includes(user?.role || '');
  // Petugas umum, inventaris umum dan sarpras lihat semua tab asrama seperti admin
  // pengasuh & pengurus_asrama hanya lihat tab asrama mereka sendiri
  const showAllTabs = canAddDelete
    || user?.role === 'petugas_inventaris_umum'
    || user?.role === 'petugas_umum'
    || user?.role === 'petugas_sarpras';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 fade-in">
      
      {/* Header Section */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-900 rounded-3xl p-6 shadow-xl relative overflow-hidden text-white border border-indigo-700/50">
        <div className="absolute -top-10 -right-10 text-white/10 rotate-12 pointer-events-none">
          <Archive size={150} />
        </div>
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black mb-1 flex items-center gap-2 tracking-wide">
                <Package size={24} className="text-indigo-300"/> INVENTARIS ASRAMA
              </h1>
              <p className="text-indigo-200 text-xs max-w-md leading-relaxed">
                Manajemen fasilitas, sarana, dan prasarana pondok pesantren. Pantau dan laporkan kondisi barang dengan mudah.
              </p>
            </div>
            
            {/* Header Action Buttons (Format Jadwal) */}
            <div className="flex flex-wrap w-full md:w-auto gap-2 self-start md:self-center">
              <button onClick={() => handleExport('pdf', true)} className="flex-1 md:flex-none justify-center px-3 py-2 bg-white/15 hover:bg-white/25 text-white border border-indigo-500/30 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5" title="Preview PDF">
                <FileText size={14} /> Preview
              </button>
              <button onClick={() => handleExport('pdf', false)} className="flex-1 md:flex-none justify-center px-3 py-2 bg-red-500/20 text-red-200 border border-red-500/30 rounded-xl text-xs font-bold hover:bg-red-500/30 transition-colors flex items-center gap-1.5" title="Export PDF">
                <Download size={14} /> PDF
              </button>
              <button onClick={() => handleExport('excel', false)} className="flex-1 md:flex-none justify-center px-3 py-2 bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 rounded-xl text-xs font-bold hover:bg-emerald-500/30 transition-colors flex items-center gap-1.5" title="Export Excel">
                <Download size={14} /> Excel
              </button>
              {canAddDelete && (
                <>
                  <button
                    onClick={() => downloadTemplate('inventaris')}
                    className="flex-1 md:flex-none justify-center px-3 py-2 bg-white text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors flex items-center gap-1.5"
                    title="Unduh Templat Excel"
                  >
                    <Download size={14} /> Templat
                  </button>
                  <button
                    onClick={() => { setImportFile(null); setImportResult(null); setIsImportModalOpen(true); }}
                    className="flex-1 md:flex-none justify-center px-3 py-2 bg-white text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors flex items-center gap-1.5"
                    title="Impor Excel"
                  >
                    <Upload size={14} /> Impor
                  </button>
                  <button onClick={() => { setEditingItem(null); setItemForm({ nama_barang: '', kategori: 'alat', asrama: activeTab !== 'Semua' ? activeTab : 'A', jumlah: 1, kondisi: 'Baik', keterangan: '' }); setShowItemModal(true); }} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-2 rounded-xl text-sm transition-colors flex items-center justify-center gap-1" title="Tambah Barang">
                    <Plus size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Equal-width Tabs on mobile (Foto 2) */}
          <div className="w-full md:w-auto flex items-center gap-2 bg-indigo-950/50 p-1.5 rounded-2xl border border-indigo-500/30 self-start">
            <button
              onClick={() => setViewMode('daftar')}
              className={`flex-1 md:flex-none justify-center px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'daftar' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-indigo-700/50 text-indigo-300'}`}
            >
              <Package size={16} /> Daftar Barang
            </button>
            <button
              onClick={() => setViewMode('laporan')}
              className={`flex-1 md:flex-none justify-center px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'laporan' ? 'bg-amber-600 text-white shadow-lg' : 'hover:bg-amber-700/50 text-indigo-300'}`}
            >
              <AlertTriangle size={16} /> 
              Laporan Kerusakan
              {laporan.filter(l => l.status === 'Dilaporkan').length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center ml-1">
                  {laporan.filter(l => l.status === 'Dilaporkan').length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Asrama — pengurus_asrama & pengasuh & guru peran ganda hanya tampilkan tab asrama terkait */}
      {(user?.role === 'pengurus_asrama' || user?.role === 'pengasuh' || (user?.role === 'guru' && (user?.is_pengasuh || user?.is_pengurus_asrama))) ? (
        <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 w-full text-center">
          <div className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-sm w-full">
            <MapPin size={16} />
            <span>{activeTab === 'Tahfid' ? 'Asrama Tahfid' : `Asrama ${activeTab}`}</span>
          </div>
        </div>
      ) : showAllTabs ? (
        <div className="flex flex-col gap-2 w-full">
          {/* Semua — Baris tersendiri di atas, memanjang memenuhi sisi kanan kiri */}
          <div className="bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 w-full">
            <button
              onClick={() => setActiveTab('Semua')}
              className={`w-full flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'Semua'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <Archive size={16}/>
              Semua Asrama
              <span className={`text-[10px] px-3.5 py-0.5 rounded-full font-extrabold transition-colors ${
                activeTab === 'Semua' ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>{items.length}</span>
            </button>
          </div>

          {/* Asrama lainnya — berdampingan */}
          <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto scrollbar-none gap-1.5 w-full">
            {dorms.filter(d => d !== 'Semua').map(dorm => (
              <button
                key={dorm}
                onClick={() => setActiveTab(dorm)}
                className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                  activeTab === dorm
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <MapPin size={16}/>
                {dorm === 'Tahfid' ? 'Tahfid' : `Asrama ${dorm}`}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {viewMode === 'daftar' ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Controls */}
          <div className="p-4 md:p-5 border-b dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Cari barang..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)} className="px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300">
                <option value="">Semua Kategori</option>
                <option value="alat">Alat</option>
                <option value="sarana">Sarana</option>
                <option value="prasarana">Prasarana</option>
                <option value="lainnya">Lainnya</option>
              </select>
              <select value={filterKondisi} onChange={e => setFilterKondisi(e.target.value)} className="px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300">
                <option value="">Semua Kondisi</option>
                <option value="Baik">Baik</option>
                <option value="Rusak Ringan">Rusak Ringan</option>
                <option value="Rusak Berat">Rusak Berat</option>
              </select>
              {canAddDelete && (
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setItemForm({ nama_barang: '', kategori: 'alat', asrama: activeTab === 'Semua' ? 'A' : activeTab, jumlah: 1, kondisi: 'Baik', keterangan: '' });
                    setShowItemModal(true);
                  }}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus size={14} /> Tambah Barang
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-5 py-4 w-10">NO</th>
                  <th className="px-5 py-4">NAMA BARANG</th>
                  <th className="px-5 py-4">ASRAMA</th>
                  <th className="px-5 py-4 text-center">JUMLAH</th>
                  <th className="px-5 py-4">KONDISI</th>
                  <th className="px-5 py-4 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-10 animate-pulse text-indigo-500 font-bold">Memuat data...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-500 font-medium">Tidak ada barang inventaris.</td></tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-4 text-center text-gray-400 font-medium">{idx + 1}</td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${item.kategori === 'alat' ? 'bg-blue-100 text-blue-700' : item.kategori === 'sarana' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                            <Package size={16}/>
                          </div>
                          {item.nama_barang}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1 flex gap-2 uppercase tracking-wide font-bold ml-10">
                          <span>{item.kategori}</span>
                          {item.laporan_aktif > 0 && <span className="text-red-500 flex items-center gap-1"><AlertTriangle size={10}/> Dilaporkan Rusak</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold px-3 py-1 rounded-full text-[11px]">
                          {item.asrama === 'Tahfid' ? 'Tahfid' : `Asrama ${item.asrama}`}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center font-mono font-bold text-gray-700 dark:text-gray-300">
                        {item.jumlah}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.kondisi === 'Baik' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                          item.kondisi === 'Rusak Ringan' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          'bg-red-100 text-red-700 border border-red-200'
                        }`}>
                          {item.kondisi}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center items-center gap-2">
                          {canEdit && (
                            <button onClick={() => { 
                              setEditingItem(item); 
                              setItemForm({ 
                                nama_barang: item.nama_barang,
                                kategori: item.kategori,
                                asrama: item.asrama.replace('Asrama ', ''),
                                jumlah: item.jumlah,
                                kondisi: item.kondisi,
                                keterangan: item.keterangan || ''
                              }); 
                              setShowItemModal(true); 
                            }} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors" title="Edit Data">
                              <Edit size={16} />
                            </button>
                          )}
                          <button onClick={() => { setReportingItem(item); setShowLaporanModal(true); }} className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors" title="Laporkan Kerusakan">
                            <ShieldAlert size={16} />
                          </button>
                          {canAddDelete && (
                            <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors" title="Hapus">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Laporan Kerusakan View */
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-amber-50 dark:bg-amber-900/20 p-5 border-b border-amber-100 dark:border-amber-800">
            <h3 className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle size={18}/> Daftar Laporan Kerusakan
            </h3>
            <p className="text-xs text-amber-600/80 mt-1 max-w-2xl">Laporan ini dibuat ketika terdapat barang yang rusak. Petugas Sarpras akan menindaklanjuti dan memperbarui status perbaikan di sini.</p>
          </div>
          <div className="overflow-x-auto p-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredLaporan.length === 0 ? (
                <div className="col-span-full py-10 text-center text-gray-500 text-sm font-medium">Tidak ada laporan kerusakan. Alhamdulillah!</div>
              ) : (
                filteredLaporan.map(lap => (
                  <div key={lap.id} className="border border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex flex-col gap-3 relative bg-white dark:bg-gray-800 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">{lap.kategori} • {lap.asrama}</span>
                        <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm">{lap.nama_barang}</h4>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        lap.status === 'Dilaporkan' ? 'bg-red-100 text-red-700' :
                        lap.status === 'Diproses' ? 'bg-amber-100 text-amber-700' :
                        lap.status === 'Dibatalkan' ? 'bg-gray-100 text-gray-600' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {lap.status}
                      </span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                      <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">"{lap.deskripsi_masalah}"</p>
                      <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                        <User size={10}/> Dilaporkan oleh: {lap.nama_pelapor}
                      </p>
                    </div>
                    {lap.tindakan_perbaikan && (
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-100 dark:border-green-900/50">
                        <p className="text-[10px] font-bold text-green-700 dark:text-green-400 mb-1">Tindakan Perbaikan:</p>
                        <p className="text-xs text-gray-700 dark:text-gray-300">{lap.tindakan_perbaikan}</p>
                      </div>
                    )}
                    <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Clock size={10}/> {new Date(lap.created_at).toLocaleDateString('id-ID')}
                      </span>
                      {canUpdateLaporan && lap.status !== 'Selesai' && lap.status !== 'Dibatalkan' && (
                        <button 
                          onClick={() => { setUpdatingLaporan(lap); setUpdateForm({ status: lap.status === 'Dilaporkan' ? 'Diproses' : 'Selesai', tindakan: lap.tindakan_perbaikan || '', kondisi_akhir: 'Baik' }); setShowUpdateModal(true); }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <PenTool size={12}/> Update Status
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Item */}
      {showItemModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center gap-2">{editingItem ? <Edit size={18}/> : <Plus size={18}/>} {editingItem ? 'Edit Barang' : 'Tambah Barang Baru'}</h3>
              <button onClick={() => setShowItemModal(false)} className="text-white/70 hover:text-white p-1 bg-white/10 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Nama Barang / Fasilitas</label>
                <input required type="text" value={itemForm.nama_barang} onChange={e => setItemForm({...itemForm, nama_barang: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm font-medium" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Kategori</label>
                  <select required value={itemForm.kategori} onChange={e => setItemForm({...itemForm, kategori: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm font-medium">
                    <option value="alat">Alat / Perkakas</option>
                    <option value="sarana">Sarana</option>
                    <option value="prasarana">Prasarana</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Lokasi / Asrama</label>
                  <select required value={itemForm.asrama} onChange={e => setItemForm({...itemForm, asrama: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm font-medium">
                    {dorms.filter(d => d !== 'Semua').map(d => (
                      <option key={d} value={d}>{d === 'Tahfid' ? 'Tahfid' : `Asrama ${d}`}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Jumlah</label>
                  <input required type="number" min="1" value={itemForm.jumlah} onChange={e => setItemForm({...itemForm, jumlah: parseInt(e.target.value)})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Kondisi Saat Ini</label>
                  <select required value={itemForm.kondisi} onChange={e => setItemForm({...itemForm, kondisi: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm font-medium">
                    <option value="Baik">Baik</option>
                    <option value="Rusak Ringan">Rusak Ringan</option>
                    <option value="Rusak Berat">Rusak Berat</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Keterangan Tambahan (Opsional)</label>
                <textarea value={itemForm.keterangan} onChange={e => setItemForm({...itemForm, keterangan: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm min-h-[80px]" />
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors">
                Simpan Inventaris
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lapor Kerusakan */}
      {showLaporanModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-amber-200 dark:border-amber-800">
            <div className="bg-amber-600 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center gap-2"><ShieldAlert size={18}/> Laporkan Kerusakan</h3>
              <button onClick={() => setShowLaporanModal(false)} className="text-white/70 hover:text-white p-1 bg-white/20 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleKirimLaporan} className="p-6 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-900">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-bold mb-1">Barang yang dilaporkan:</p>
                <p className="text-sm font-black text-gray-800 dark:text-gray-200">{reportingItem?.nama_barang}</p>
                <p className="text-xs text-gray-500">{reportingItem?.asrama}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Jelaskan Kerusakan yang Terjadi</label>
                <textarea required placeholder="Misal: Kakinya patah, keran air bocor, dll." value={laporanForm.deskripsi} onChange={e => setLaporanForm({deskripsi: e.target.value})} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 text-sm min-h-[100px] font-medium" />
              </div>
              <p className="text-[10px] text-gray-400 italic text-center px-4">Laporan ini akan diteruskan ke Petugas Sarpras untuk segera ditindaklanjuti.</p>
              <button type="submit" className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-colors shadow-md">
                Kirim Laporan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Update Status Laporan */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-indigo-200 dark:border-indigo-800">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center gap-2"><PenTool size={18}/> Proses Perbaikan</h3>
              <button onClick={() => setShowUpdateModal(false)} className="text-white/70 hover:text-white p-1 bg-white/20 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleUpdateLaporan} className="p-6 space-y-4">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900">
                <p className="text-xs text-indigo-700 dark:text-indigo-400 font-bold mb-1">Kasus:</p>
                <p className="text-sm font-black text-gray-800 dark:text-gray-200">{updatingLaporan?.nama_barang}</p>
                <p className="text-xs text-gray-500">"{updatingLaporan?.deskripsi_masalah}"</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Update Status Laporan</label>
                <select value={updateForm.status} onChange={e => setUpdateForm({...updateForm, status: e.target.value})} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-indigo-700 dark:text-indigo-400">
                  <option value="Diproses">Tandai Sedang Diproses / Diperbaiki</option>
                  <option value="Selesai">Tandai Telah Selesai Diperbaiki</option>
                  <option value="Dibatalkan">Batalkan Laporan (Salah lapor/Tdk valid)</option>
                </select>
              </div>
              
              {updateForm.status === 'Selesai' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 mt-2">Kondisi Akhir Barang Setelah Diperbaiki</label>
                  <select value={updateForm.kondisi_akhir} onChange={e => setUpdateForm({...updateForm, kondisi_akhir: e.target.value})} className="w-full px-4 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl focus:ring-2 focus:ring-green-500 text-sm font-bold text-green-700 dark:text-green-400">
                    <option value="Baik">Kondisi Baik / Berfungsi Normal</option>
                    <option value="Rusak Ringan">Masih Rusak Ringan</option>
                    <option value="Rusak Berat">Rusak Berat (Tidak bisa diperbaiki)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Catatan Tindakan Perbaikan (Opsional)</label>
                <textarea placeholder="Misal: Sudah diganti pipa baru, dicat ulang, dsb." value={updateForm.tindakan} onChange={e => setUpdateForm({...updateForm, tindakan: e.target.value})} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm min-h-[80px]" />
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-md mt-2">
                Simpan Pembaruan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="bg-indigo-600 dark:bg-indigo-900 p-5 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2"><Upload size={20} /> Impor Data Inventaris</h2>
              <button onClick={() => setIsImportModalOpen(false)} className="bg-white/20 p-1.5 rounded-lg hover:bg-white/30"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300">
                <p className="font-bold mb-1">⚠ Perhatian</p>
                <p>Pastikan nama kolom sesuai templat. Data yang sama (nama barang & asrama) akan diperbarui otomatis.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">Pilih File Excel (.xlsx)</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }}
                  className="w-full text-sm text-gray-600 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
              {importResult && (
                <div className={`p-3 rounded-xl text-sm ${importResult.success ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                  <p className="font-bold">{importResult.success ? '✓ Berhasil' : '✗ Gagal'}</p>
                  <p>{importResult.message || importResult.error}</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setIsImportModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                  Tutup
                </button>
                <button
                  onClick={handleImportExcel}
                  disabled={!importFile || importing}
                  className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {importing ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Mengimpor...</> : <><Upload size={16} /> Impor</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-gray-800 w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <FileText className="text-indigo-500" size={20} />
                Preview PDF Data Inventaris
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('pdf', false)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors flex items-center gap-2"
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
              <iframe 
                src={pdfUrl} 
                className="w-full h-full rounded-xl shadow-inner bg-white"
                title="PDF Preview"
                style={{ minHeight: '60vh' }}
              />
            </div>
            <div className="flex md:hidden flex-1 flex-col items-center justify-center gap-5 p-8 bg-gray-50 dark:bg-gray-900/50">
              <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center">
                <FileText size={40} className="text-indigo-500" />
              </div>
              <div className="text-center font-bold text-gray-700 dark:text-gray-200">
                Preview tidak tersedia di HP, silakan langsung unduh file PDF.
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
