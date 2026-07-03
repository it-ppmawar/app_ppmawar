'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Calendar, Clock, MapPin, User, Plus, Edit, Trash2, FileText, Download, Upload, X, Search } from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';
import { downloadTemplate } from '@/lib/downloadTemplate';

export default function JurnalPage() {
  const [jurnalData, setJurnalData] = useState<any>({ madin: [], quran: [], kamar: [] });
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('tamu');
  const [userId, setUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'madin' | 'quran' | 'kamar'>('madin');

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('type', `jurnal_${activeTab}`);
      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setIsImportModalOpen(false);
        setImportFile(null);
        fetchData();
      } else {
        alert(data.error || 'Gagal mengimpor data');
      }
    } catch {
      alert('Terjadi kesalahan koneksi');
    } finally {
      setImporting(false);
    }
  };

  // Filter States
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Dropdown options for adding/editing
  const [kelasMadinOptions, setKelasMadinOptions] = useState<any[]>([]);
  const [kelasQuranOptions, setKelasQuranOptions] = useState<any[]>([]);
  const [kamarOptions, setKamarOptions] = useState<any[]>([]);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingJurnal, setEditingJurnal] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [formTanggal, setFormTanggal] = useState('');
  const [formKelasId, setFormKelasId] = useState('');
  const [formMateri, setFormMateri] = useState('');
  const [formCatatan, setFormCatatan] = useState('');
  const [formKendala, setFormKendala] = useState('');

  // PDF Preview
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success) {
          setRole(data.user.role);
          setUserId(data.user.userId || data.user.id || null);
        }
      } catch (err) {}
    };
    fetchMe();
    fetchData();
    fetchOptions();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jurnal');
      const json = await res.json();
      if (json.success) {
        setJurnalData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch jurnal data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const resMadin = await fetch('/api/kelas?type=madin');
      const dataMadin = await resMadin.json();
      if (dataMadin.success) setKelasMadinOptions(dataMadin.data);

      const resQuran = await fetch('/api/kelas?type=quran');
      const dataQuran = await resQuran.json();
      if (dataQuran.success) setKelasQuranOptions(dataQuran.data);

      const resKamar = await fetch('/api/kelas?type=kamar');
      const dataKamar = await resKamar.json();
      if (dataKamar.success) setKamarOptions(dataKamar.data);
    } catch (e) {}
  };

  const getFilteredData = () => {
    const data = jurnalData[activeTab] || [];
    return data.filter((item: any) => {
      const s = search.toLowerCase();
      const matchSearch =
        !s ||
        item.materi?.toLowerCase().includes(s) ||
        item.kegiatan?.toLowerCase().includes(s) ||
        item.catatan?.toLowerCase().includes(s) ||
        item.kendala?.toLowerCase().includes(s) ||
        item.guru_nama?.toLowerCase().includes(s) ||
        item.pembina_nama?.toLowerCase().includes(s) ||
        item.kelas_nama?.toLowerCase().includes(s) ||
        item.kamar_nama?.toLowerCase().includes(s);

      const matchDateFrom = !dateFrom || new Date(item.tanggal) >= new Date(dateFrom);
      const matchDateTo = !dateTo || new Date(item.tanggal) <= new Date(dateTo);

      return matchSearch && matchDateFrom && matchDateTo;
    });
  };

  const filteredJurnal = getFilteredData();

  // Helper formatting
  const formatDateString = (sqlDate: string) => {
    if (!sqlDate) return '-';
    const date = new Date(sqlDate);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // CRUD Otorisasi Check
  const canModify = (item: any) => {
    if (role === 'admin' || role === 'staff') return true;
    if (role === 'guru' || role === 'pengurus_asrama') {
      const ownerId = item.guru_id || item.pembina_id;
      return ownerId === userId;
    }
    return false;
  };

  const canAdd = role === 'admin' || role === 'staff' || role === 'guru' || role === 'pengurus_asrama';

  // Add Jurnal
  const handleOpenAdd = () => {
    const today = new Date().toISOString().split('T')[0];
    setFormTanggal(today);
    setFormKelasId('');
    setFormMateri('');
    setFormCatatan('');
    setFormKendala('');
    setIsAddModalOpen(true);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        tipe: activeTab,
        tanggal: formTanggal,
        kelas_id: parseInt(formKelasId),
        materi: formMateri,
        catatan: formCatatan,
        kendala: formKendala || null,
      };
      const res = await fetch('/api/jurnal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setIsAddModalOpen(false);
        fetchData();
      } else {
        alert(data.error || 'Gagal menambahkan jurnal');
      }
    } catch {
      alert('Terjadi kesalahan sistem');
    } finally {
      setSaving(false);
    }
  };

  // Edit Jurnal
  const handleOpenEdit = (item: any) => {
    setEditingJurnal(item);
    setFormTanggal(item.tanggal ? new Date(item.tanggal).toISOString().split('T')[0] : '');
    setFormKelasId(String(item.kelas_id || item.kelas_quran_id || item.kamar_id || ''));
    setFormMateri(item.materi || item.kegiatan || '');
    setFormCatatan(item.catatan || '');
    setFormKendala(item.kendala || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        id: editingJurnal.id,
        tipe: activeTab,
        tanggal: formTanggal,
        kelas_id: parseInt(formKelasId),
        materi: formMateri,
        catatan: formCatatan,
        kendala: formKendala || null,
      };
      const res = await fetch('/api/jurnal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setIsEditModalOpen(false);
        fetchData();
      } else {
        alert(data.error || 'Gagal mengubah jurnal');
      }
    } catch {
      alert('Terjadi kesalahan sistem');
    } finally {
      setSaving(false);
    }
  };

  // Delete Jurnal
  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus jurnal ini?')) return;
    try {
      const res = await fetch(`/api/jurnal?id=${id}&tipe=${activeTab}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Gagal menghapus jurnal');
      }
    } catch {
      alert('Terjadi kesalahan sistem');
    }
  };

  // Export PDF & Excel
  const handleExport = (format: 'pdf' | 'excel', previewOnly = false) => {
    if (filteredJurnal.length === 0) {
      alert('Tidak ada data untuk diekspor');
      return;
    }

    const title = `JURNAL KEGIATAN ${activeTab === 'madin' ? 'MADRASAH DINIYAH' : activeTab === 'quran' ? "AL-QUR'AN" : 'ASRAMA'}`;
    const subtitle = `Filter Tanggal: ${dateFrom || 'Semua'} s/d ${dateTo || 'Semua'}`;
    const filename = `Jurnal_${activeTab}`;

    const columns = ['NO', 'TANGGAL', 'PENGAJAR / PEMBINA', 'KELAS / KAMAR', 'MATERI / KEGIATAN', 'CATATAN', 'KENDALA'];
    const rows = filteredJurnal.map((item: any, idx: number) => [
      idx + 1,
      formatDateString(item.tanggal),
      item.guru_nama || item.pembina_nama || '-',
      item.kelas_nama || item.kamar_nama || '-',
      item.materi || item.kegiatan || '-',
      item.catatan || '-',
      item.kendala || '-',
    ]);

    if (format === 'excel') {
      exportToExcel({ title, subtitle, columns, rows, filename });
    } else {
      const result = exportToPDF({ title, subtitle, columns, rows, filename, previewOnly });
      if (previewOnly && result) {
        setPdfUrl(result);
        setShowPdfPreview(true);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 rounded-3xl p-6 shadow-sm border border-blue-200 dark:border-blue-800/50 relative overflow-hidden transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-blue-200/50 dark:text-blue-800/30">
          <BookOpen size={120} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-blue-800 dark:text-blue-400 drop-shadow-sm flex items-center gap-2">
              <BookOpen size={28} /> Jurnal Kegiatan Pembelajaran
            </h1>
            <p className="text-blue-600 dark:text-blue-300 text-sm mt-1 font-medium max-w-md">
              Rekapitulasi materi, catatan pembelajaran, dan kendala kelas.
            </p>
          </div>
          <div className="flex flex-wrap w-full md:w-auto gap-2 self-start md:self-center">
            <button
              onClick={() => handleExport('pdf', true)}
              className="flex-1 md:flex-none justify-center px-3 py-2 bg-white/85 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5"
              title="Preview PDF"
            >
              <FileText size={14} /> Preview
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="flex-1 md:flex-none justify-center px-3 py-2 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5"
              title="Export PDF"
            >
              <Download size={14} /> PDF
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="flex-1 md:flex-none justify-center px-3 py-2 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors flex items-center gap-1.5"
              title="Export Excel"
            >
              <Download size={14} /> Excel
            </button>
            {(role === 'admin' || role === 'staff') && (
              <>
                <button
                  onClick={() => downloadTemplate(`jurnal_${activeTab}` as any)}
                  className="flex-1 md:flex-none justify-center px-3 py-2 bg-white text-blue-700 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors flex items-center gap-1.5"
                  title="Unduh Templat Excel"
                >
                  <Download size={14} /> Templat
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex-1 md:flex-none justify-center px-3 py-2 bg-white text-blue-700 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors flex items-center gap-1.5"
                  title="Impor Excel"
                >
                  <Upload size={14} /> Impor
                </button>
              </>
            )}
            {canAdd && (
              <button
                onClick={handleOpenAdd}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded-xl text-sm transition-colors flex items-center justify-center gap-1"
                title="Isi Jurnal"
              >
                <span className="hidden sm:inline">+ Isi Jurnal</span>
                <span className="sm:hidden text-lg leading-none">+</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
        {(['madin', 'quran', 'kamar'] as const).map((tab) => {
          const isActive = activeTab === tab;
          let activeBg = 'bg-blue-500 text-white shadow-md';
          if (tab === 'quran') activeBg = 'bg-emerald-500 text-white shadow-md';
          if (tab === 'madin') activeBg = 'bg-indigo-500 text-white shadow-md';
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setSearch('');
              }}
              className={`flex-1 min-w-[120px] py-2.5 text-sm font-bold rounded-xl transition-all ${
                isActive
                  ? activeBg
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {tab === 'madin' ? 'Madrasah Diniyah (Madin)' : tab === 'quran' ? "Al-Qur'an" : 'Kegiatan Kamar'}
            </button>
          );
        })}
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Cari materi, pengajar, catatan, kelas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-200"
          />
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs dark:text-gray-200"
          />
          <span className="text-gray-400 text-xs">s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs dark:text-gray-200"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-blue-800 dark:bg-blue-900 text-white font-bold border-b dark:border-gray-700">
              <tr>
                <th className="px-4 py-4 w-12 text-center">NO</th>
                <th className="px-4 py-4"><Calendar size={14} className="inline mr-1" />TANGGAL</th>
                <th className="px-4 py-4"><User size={14} className="inline mr-1" />PENGAJAR / PEMBINA</th>
                <th className="px-4 py-4"><MapPin size={14} className="inline mr-1" />KELAS / KAMAR</th>
                <th className="px-4 py-4">MATERI / KEGIATAN</th>
                <th className="px-4 py-4">CATATAN</th>
                <th className="px-4 py-4">KENDALA</th>
                <th className="px-4 py-4 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                      <span>Memuat jurnal...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredJurnal.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">
                    Belum ada data jurnal pada rentang ini.
                  </td>
                </tr>
              ) : (
                filteredJurnal.map((item: any, idx: number) => (
                  <tr
                    key={item.id}
                    className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors text-gray-700 dark:text-gray-200"
                  >
                    <td className="px-4 py-3 text-center font-bold text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700 dark:text-blue-400">
                      {formatDateString(item.tanggal)}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                      {item.guru_nama || item.pembina_nama || '-'}
                    </td>
                    <td className="px-4 py-3">{item.kelas_nama || item.kamar_nama || '-'}</td>
                    <td className="px-4 py-3 whitespace-normal max-w-[200px] leading-relaxed">
                      {item.materi || item.kegiatan || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-normal max-w-[200px] text-gray-500 text-xs">
                      {item.catatan || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-normal max-w-[150px] text-red-500 text-xs">
                      {item.kendala || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canModify(item) ? (
                          <>
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors"
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 transition-colors"
                              title="Hapus"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">Read-only</span>
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

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-lg border border-gray-100 dark:border-gray-700 flex flex-col max-h-[80vh] overflow-hidden">
            <div className="bg-blue-600 dark:bg-blue-900 p-5 text-white shrink-0 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2"><BookOpen size={20} /> Isi Jurnal {activeTab === 'madin' ? 'Madin' : activeTab === 'quran' ? "Qur'an" : 'Kamar'}</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white hover:text-gray-200"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveAdd} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tanggal *</label>
                <input
                  type="date"
                  required
                  value={formTanggal}
                  onChange={(e) => setFormTanggal(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {activeTab === 'madin' ? 'Kelas Madin *' : activeTab === 'quran' ? "Kelas Qur'an *" : 'Kamar Asrama *'}
                </label>
                <select
                  required
                  value={formKelasId}
                  onChange={(e) => setFormKelasId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                >
                  <option value="">Pilih...</option>
                  {activeTab === 'madin' &&
                    kelasMadinOptions.map((k) => <option key={k.kelas_id} value={k.kelas_id}>{k.nama_kelas}</option>)}
                  {activeTab === 'quran' &&
                    kelasQuranOptions.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                  {activeTab === 'kamar' &&
                    kamarOptions.map((k) => <option key={k.kamar_id} value={k.kamar_id}>{k.nama_kamar}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {activeTab === 'kamar' ? 'Nama Kegiatan *' : 'Materi Pembelajaran *'}
                </label>
                <textarea
                  required
                  value={formMateri}
                  onChange={(e) => setFormMateri(e.target.value)}
                  placeholder="Deskripsi materi/kegiatan..."
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Catatan</label>
                <textarea
                  value={formCatatan}
                  onChange={(e) => setFormCatatan(e.target.value)}
                  placeholder="Catatan kemajuan atau keaktifan..."
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Kendala / Masalah (Opsional)</label>
                <textarea
                  value={formKendala}
                  onChange={(e) => setFormKendala(e.target.value)}
                  placeholder="Kendala proses pembelajaran..."
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-300 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-lg border border-gray-100 dark:border-gray-700 flex flex-col max-h-[80vh] overflow-hidden">
            <div className="bg-blue-600 dark:bg-blue-900 p-5 text-white shrink-0 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2"><Edit size={20} /> Edit Jurnal {activeTab === 'madin' ? 'Madin' : activeTab === 'quran' ? "Qur'an" : 'Kamar'}</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-white hover:text-gray-200"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tanggal *</label>
                <input
                  type="date"
                  required
                  value={formTanggal}
                  onChange={(e) => setFormTanggal(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {activeTab === 'madin' ? 'Kelas Madin *' : activeTab === 'quran' ? "Kelas Qur'an *" : 'Kamar Asrama *'}
                </label>
                <select
                  required
                  value={formKelasId}
                  onChange={(e) => setFormKelasId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                >
                  <option value="">Pilih...</option>
                  {activeTab === 'madin' &&
                    kelasMadinOptions.map((k) => <option key={k.kelas_id} value={k.kelas_id}>{k.nama_kelas}</option>)}
                  {activeTab === 'quran' &&
                    kelasQuranOptions.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                  {activeTab === 'kamar' &&
                    kamarOptions.map((k) => <option key={k.kamar_id} value={k.kamar_id}>{k.nama_kamar}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {activeTab === 'kamar' ? 'Nama Kegiatan *' : 'Materi Pembelajaran *'}
                </label>
                <textarea
                  required
                  value={formMateri}
                  onChange={(e) => setFormMateri(e.target.value)}
                  placeholder="Deskripsi materi/kegiatan..."
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Catatan</label>
                <textarea
                  value={formCatatan}
                  onChange={(e) => setFormCatatan(e.target.value)}
                  placeholder="Catatan kemajuan atau keaktifan..."
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Kendala / Masalah (Opsional)</label>
                <textarea
                  value={formKendala}
                  onChange={(e) => setFormKendala(e.target.value)}
                  placeholder="Kendala proses pembelajaran..."
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-300 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 shrink-0">
              <h3 className="font-bold text-gray-800 dark:text-gray-200">Preview PDF</h3>
              <button onClick={() => setShowPdfPreview(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X size={20} /></button>
            </div>
            <iframe src={pdfUrl} className="flex-1 w-full" />
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden">
            <div className="bg-blue-600 dark:bg-blue-900 p-5 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2"><Upload size={20} /> Impor Jurnal</h2>
              <button onClick={() => { setIsImportModalOpen(false); setImportFile(null); }} className="text-white hover:text-gray-200"><X size={20} /></button>
            </div>
            <form onSubmit={handleImportExcel} className="p-6 space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                Silakan pilih file Excel (.xlsx) dengan kolom yang disesuaikan dengan templat yang disediakan.
                Data jurnal akan ditambahkan otomatis.
              </p>
              <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-6 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors relative">
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
                <Upload size={32} className="mx-auto text-blue-500 mb-2" />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                  {importFile ? importFile.name : 'Pilih File Excel (.xlsx)'}
                </span>
                <span className="text-[10px] text-gray-400 block mt-1">Maksimal ukuran file: 10MB</span>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsImportModalOpen(false); setImportFile(null); }}
                  className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-300 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={importing || !importFile}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  {importing ? 'Mengimpor...' : 'Mulai Impor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
