'use client';

import { useState, useEffect } from 'react';
import { CalendarDays, Clock, MapPin, Plus, Edit, Trash2, FileText, Download, Upload, X, Search, Star } from 'lucide-react';
import { downloadTemplate } from '@/lib/downloadTemplate';

export default function JadwalAlumniPage() {
  const [jadwal, setJadwal] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');

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
      formData.append('type', 'jadwal_alumni');
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

  // Pasaran Jawa
  const [wetonHariIni, setWetonHariIni] = useState('');
  const [nextAhadLegi, setNextAhadLegi] = useState<Date | null>(null);
  const [isAhadLegiToday, setIsAhadLegiToday] = useState(false);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ jam_mulai: '', jam_selesai: '', kegiatan: '', tempat: '', keterangan: '' });

  // Export
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  const canEdit = role === 'admin' || role === 'staff';

  useEffect(() => {
    // Load Javanese calendar
    import('@/lib/javaneseCalendar').then(({ getWeton, isAhadLegi, getNextAhadLegi }) => {
      const today = new Date();
      setWetonHariIni(getWeton(today));
      setIsAhadLegiToday(isAhadLegi(today));
      setNextAhadLegi(getNextAhadLegi(today));
    });

    // Fetch role
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (data.success) setRole(data.user.role);
    }).catch(() => {});

    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jadwal/alumni');
      const json = await res.json();
      if (json.success) setJadwal(json.data);
    } catch (err) {
      console.error('Failed to fetch jadwal alumni:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredJadwal = jadwal.filter(j => {
    const s = search.toLowerCase();
    return !s || j.kegiatan?.toLowerCase().includes(s) || j.tempat?.toLowerCase().includes(s) || j.keterangan?.toLowerCase().includes(s);
  });

  // Hitung countdown
  const getCountdown = () => {
    if (!nextAhadLegi) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(nextAhadLegi);
    target.setHours(0, 0, 0, 0);
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return `${diff} hari lagi`;
  };

  const formatTanggal = (date: Date) => {
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  // CRUD handlers
  const handleAdd = () => {
    setFormData({ jam_mulai: '', jam_selesai: '', kegiatan: '', tempat: '', keterangan: '' });
    setIsAddModalOpen(true);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/jadwal/alumni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) { setIsAddModalOpen(false); fetchData(); }
      else alert(data.error);
    } catch { alert('Gagal menambah jadwal'); }
    finally { setSaving(false); }
  };

  const handleEditClick = (item: any) => {
    setEditingItem(item);
    setFormData({
      jam_mulai: item.jam_mulai?.substring(0, 5) || '',
      jam_selesai: item.jam_selesai?.substring(0, 5) || '',
      kegiatan: item.kegiatan || '',
      tempat: item.tempat || '',
      keterangan: item.keterangan || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/jadwal/alumni', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingItem.id, ...formData })
      });
      const data = await res.json();
      if (data.success) { setIsEditModalOpen(false); fetchData(); }
      else alert(data.error);
    } catch { alert('Gagal mengedit jadwal'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus jadwal ini?')) return;
    try {
      const res = await fetch(`/api/jadwal/alumni?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchData();
      else alert(data.error);
    } catch { alert('Gagal menghapus jadwal'); }
  };

  const handleExport = (format: 'pdf' | 'excel', previewOnly = false) => {
    const exportData = filteredJadwal;
    if (exportData.length === 0) { alert('Tidak ada data untuk di-export.'); return; }

    const title = 'JADWAL ALUMNI - AHAD LEGI';
    const subtitle = nextAhadLegi ? `Ahad Legi berikutnya: ${formatTanggal(nextAhadLegi)}` : '';
    const filename = 'Jadwal_Alumni_Ahad_Legi';
    const columns = ['NO', 'JAM', 'KEGIATAN', 'TEMPAT', 'KETERANGAN'];
    const rows = exportData.map((item: any, idx: number) => [
      idx + 1,
      `${item.jam_mulai?.substring(0, 5) || '-'} - ${item.jam_selesai?.substring(0, 5) || '-'}`,
      item.kegiatan || '-',
      item.tempat || '-',
      item.keterangan || '-'
    ]);

    if (format === 'excel') {
      import('@/lib/exportUtils').then(({ exportToExcel }) => exportToExcel({ title, subtitle, columns, rows, filename }));
    } else {
      import('@/lib/exportUtils').then(({ exportToPDF }) => {
        const result = exportToPDF({ title, subtitle, columns, rows, filename, previewOnly });
        if (previewOnly && result) { setPdfUrl(result); setShowPdfPreview(true); }
      });
    }
  };

  // Form modal component
  const FormModal = ({ isOpen, onClose, onSubmit, title: modalTitle }: { isOpen: boolean; onClose: () => void; onSubmit: (e: React.FormEvent) => void; title: string }) => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-lg border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh] mb-16 overflow-hidden">
          <div className="bg-amber-600 dark:bg-amber-900 p-5 text-white shrink-0">
            <h2 className="text-xl font-bold flex items-center gap-2"><Star size={20} /> {modalTitle}</h2>
          </div>
          <form onSubmit={onSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Jam Mulai *</label>
                <input type="time" required value={formData.jam_mulai} onChange={e => setFormData({ ...formData, jam_mulai: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 dark:text-white" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Jam Selesai *</label>
                <input type="time" required value={formData.jam_selesai} onChange={e => setFormData({ ...formData, jam_selesai: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 dark:text-white" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Kegiatan *</label>
              <input type="text" required value={formData.kegiatan} onChange={e => setFormData({ ...formData, kegiatan: e.target.value })} placeholder="Nama kegiatan..." className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 dark:text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tempat *</label>
              <input type="text" required value={formData.tempat} onChange={e => setFormData({ ...formData, tempat: e.target.value })} placeholder="Lokasi kegiatan..." className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 dark:text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Keterangan</label>
              <textarea value={formData.keterangan} onChange={e => setFormData({ ...formData, keterangan: e.target.value })} rows={3} placeholder="Keterangan tambahan (opsional)..." className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 dark:text-white resize-none" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-300 transition-colors">Batal</button>
              <button type="submit" disabled={saving} className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/40 rounded-3xl p-6 shadow-sm border border-amber-200 dark:border-amber-800/50 relative overflow-hidden transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-amber-200/50 dark:text-amber-800/30">
          <Star size={120} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-amber-800 dark:text-amber-400 drop-shadow-sm flex items-center gap-2">
              <CalendarDays size={28} /> Jadwal Alumni — Ahad Legi
            </h1>
            <p className="text-amber-600 dark:text-amber-300 text-sm mt-1 font-medium max-w-md">
              Jadwal kegiatan alumni setiap Ahad Legi (siklus 35 hari).
            </p>
          </div>
          <div className="flex flex-wrap w-full md:w-auto gap-2 self-start md:self-center">
            <button
              onClick={() => handleExport('pdf', true)}
              className="flex-1 md:flex-none justify-center px-3 py-2 bg-white/85 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5"
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
            {canEdit && (
              <>
                <button
                  onClick={() => downloadTemplate('jadwal_alumni')}
                  className="flex-1 md:flex-none justify-center px-3 py-2 bg-white text-amber-700 border border-amber-200 rounded-xl text-xs font-bold hover:bg-amber-50 transition-colors flex items-center gap-1.5"
                  title="Unduh Templat Excel"
                >
                  <Download size={14} /> Templat
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex-1 md:flex-none justify-center px-3 py-2 bg-white text-amber-700 border border-amber-200 rounded-xl text-xs font-bold hover:bg-amber-50 transition-colors flex items-center gap-1.5"
                  title="Impor Excel"
                >
                  <Upload size={14} /> Impor
                </button>
                <button
                  onClick={handleAdd}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-2 rounded-xl text-sm transition-colors flex items-center justify-center gap-1"
                  title="Tambah Jadwal"
                >
                  <span className="hidden sm:inline">+ Tambah Jadwal</span>
                  <span className="sm:hidden text-lg leading-none">+</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Weton Info Cards (Outside Hero Card) */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 ${isAhadLegiToday ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700 animate-pulse' : 'bg-white/70 dark:bg-gray-800/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700'}`}>
          <CalendarDays size={16} />
          Hari ini: {wetonHariIni || '...'}
          {isAhadLegiToday && <span className="ml-1 text-green-600">🎉 AHAD LEGI!</span>}
        </div>
        {nextAhadLegi && !isAhadLegiToday && (
          <div className="px-4 py-2.5 bg-white/70 dark:bg-gray-800/70 rounded-xl text-sm font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 flex items-center gap-2">
            <Clock size={16} />
            Ahad Legi berikutnya: {formatTanggal(nextAhadLegi)} ({getCountdown()})
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={16} className="text-gray-400" /></div>
          <input type="text" placeholder="Cari kegiatan, tempat, keterangan..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-gray-200 transition-colors" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-amber-700 dark:bg-amber-900 text-white font-bold">
              <tr>
                <th className="px-4 py-4 w-12 text-center">NO</th>
                <th className="px-4 py-4"><Clock size={14} className="inline mr-1" />JAM</th>
                <th className="px-4 py-4">KEGIATAN</th>
                <th className="px-4 py-4"><MapPin size={14} className="inline mr-1" />TEMPAT</th>
                <th className="px-4 py-4">KETERANGAN</th>
                {canEdit && <th className="px-4 py-4 text-center">AKSI</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={canEdit ? 6 : 5} className="text-center py-12 text-gray-500">
                  <div className="flex flex-col items-center gap-2"><div className="w-8 h-8 border-4 border-amber-300 border-t-amber-600 rounded-full animate-spin" /><span>Memuat data...</span></div>
                </td></tr>
              ) : filteredJadwal.length === 0 ? (
                <tr><td colSpan={canEdit ? 6 : 5} className="text-center py-12 text-gray-500">
                  <div className="flex flex-col items-center gap-2"><Star size={32} className="text-gray-300" /><span>Belum ada jadwal alumni.</span></div>
                </td></tr>
              ) : filteredJadwal.map((item, idx) => (
                <tr key={item.id} className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors text-gray-700 dark:text-gray-200">
                  <td className="px-4 py-3 text-center font-bold text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                    {item.jam_mulai?.substring(0, 5)} - {item.jam_selesai?.substring(0, 5)}
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{item.kegiatan}</td>
                  <td className="px-4 py-3">{item.tempat || '-'}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[200px] whitespace-normal text-xs">{item.keterangan || '-'}</td>
                  {canEdit && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEditClick(item)} className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors" title="Edit"><Edit size={14} /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 transition-colors" title="Hapus"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <FormModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSubmit={handleSaveAdd} title="Tambah Jadwal Alumni" />
      <FormModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSubmit={handleSaveEdit} title="Edit Jadwal Alumni" />

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
            <div className="bg-amber-600 dark:bg-amber-900 p-5 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2"><Upload size={20} /> Impor Jadwal Alumni</h2>
              <button onClick={() => { setIsImportModalOpen(false); setImportFile(null); }} className="text-white hover:text-gray-200"><X size={20} /></button>
            </div>
            <form onSubmit={handleImportExcel} className="p-6 space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                Silakan pilih file Excel (.xlsx) dengan kolom yang disesuaikan dengan templat yang disediakan.
                Data jadwal alumni akan ditambahkan otomatis.
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
                <Upload size={32} className="mx-auto text-amber-500 mb-2" />
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
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
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
