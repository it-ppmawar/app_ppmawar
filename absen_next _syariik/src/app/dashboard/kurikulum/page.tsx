'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Plus, Edit2, Trash2, Save, X, FileText, Download } from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';

interface KurikulumItem {
  id: number;
  tingkat: string;
  mata_pelajaran: string;
  kitab: string;
  keterangan: string | null;
}

export default function KurikulumPage() {
  const [items, setItems] = useState<KurikulumItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('murid');
  const [activeTab, setActiveTab] = useState<'ULA' | 'WUSTHO' | 'MAK'>('ULA');

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<KurikulumItem>>({
    tingkat: 'ULA',
    mata_pelajaran: '',
    kitab: '',
    keterangan: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success) setRole(data.user.role);
      } catch (err) {}
    };

    fetchMe();
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/kurikulum');
      const json = await res.json();
      if (json.success) {
        setItems(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch kurikulum:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setCurrentItem({
      tingkat: activeTab,
      mata_pelajaran: '',
      kitab: '',
      keterangan: ''
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: KurikulumItem) => {
    setCurrentItem({ ...item });
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const method = isEditMode ? 'PUT' : 'POST';
      const res = await fetch('/api/kurikulum', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentItem)
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        alert(data.error || 'Gagal menyimpan data');
      }
    } catch (err) {
      alert('Gagal menghubungi server');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus kurikulum ini?')) return;
    try {
      const res = await fetch(`/api/kurikulum?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Gagal menghapus data');
      }
    } catch (err) {
      alert('Gagal menghubungi server');
    }
  };

  // Export State
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  const handleExport = (format: 'pdf' | 'excel' = 'pdf', previewOnly = false) => {
    if (items.length === 0) {
      alert('Tidak ada data untuk di-export.');
      return;
    }

    const exportData = items.filter(item => item.tingkat.toUpperCase() === activeTab);

    if (exportData.length === 0) {
      alert(`Tidak ada data kurikulum tingkat ${activeTab} untuk di-export.`);
      return;
    }

    const title = `KURIKULUM MADRASAH DINIYAH - TINGKAT ${activeTab}`;
    const subtitle = `Daftar kitab pelajaran dan jenjang tingkatan`;
    const filename = `Kurikulum_Madin_${activeTab}`;

    const tableColumn = ["NO", "MATA PELAJARAN", "JENJANG KITAB / BUKU PELAJARAN", "KETERANGAN"];
    const tableRows: any[] = [];

    exportData.forEach((item, idx) => {
      tableRows.push([
        idx + 1,
        item.mata_pelajaran,
        item.kitab,
        item.keterangan || '-'
      ]);
    });

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

  const filteredItems = items.filter(
    (item) => item.tingkat.toUpperCase() === activeTab
  );

  const isEditable = role === 'admin' || role === 'staff';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-indigo-950/40 dark:to-purple-950/40 rounded-3xl p-6 border border-indigo-150 dark:border-indigo-900/50 relative overflow-hidden transition-all duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-indigo-200/50 dark:text-indigo-900/20">
          <BookOpen size={120} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-indigo-850 dark:text-indigo-400 drop-shadow-sm flex items-center gap-2">
              <BookOpen size={28} /> Kurikulum Madin
            </h1>
            <p className="text-indigo-600 dark:text-indigo-300 text-sm mt-1 font-medium max-w-md">
              Informasi daftar kitab pelajaran dan jenjang tingkatan di Madrasah Diniyah.
            </p>
          </div>
          <div className="flex w-full md:w-auto gap-2 self-start md:self-center">
            <button onClick={() => handleExport('pdf', true)} className="flex-1 justify-center px-3 py-2 bg-white/85 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5" title="Preview PDF">
              <FileText size={14} /> Preview
            </button>
            <button onClick={() => handleExport('pdf', false)} className="flex-1 justify-center px-3 py-2 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5" title="Export PDF">
              <Download size={14} /> PDF
            </button>
            <button onClick={() => handleExport('excel', false)} className="flex-1 justify-center px-3 py-2 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors flex items-center gap-1.5" title="Export Excel">
              <Download size={14} /> Excel
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab('ULA')}
          className={`flex-1 min-w-[100px] py-2.5 text-sm font-bold rounded-xl transition-all ${
            activeTab === 'ULA'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          ULA
        </button>
        <button
          onClick={() => setActiveTab('WUSTHO')}
          className={`flex-1 min-w-[100px] py-2.5 text-sm font-bold rounded-xl transition-all ${
            activeTab === 'WUSTHO'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          WUSTHO
        </button>
        <button
          onClick={() => setActiveTab('MAK')}
          className={`flex-1 min-w-[100px] py-2.5 text-sm font-bold rounded-xl transition-all ${
            activeTab === 'MAK'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          MAK (Keagamaan)
        </button>
      </div>

      {/* Action Header */}
      {isEditable && (
        <div className="flex justify-center">
          <button
            onClick={handleOpenAddModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus size={16} />
            <span>Tambah Kurikulum</span>
          </button>
        </div>
      )}

      {/* Content Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Memuat kurikulum...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Belum ada kurikulum yang ditambahkan untuk tingkat {activeTab}.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 w-12 text-center">NO</th>
                  <th className="px-6 py-4">MATA PELAJARAN</th>
                  <th className="px-6 py-4">JENJANG KITAB</th>
                  <th className="px-6 py-4">KETERANGAN</th>
                  {isEditable && <th className="px-6 py-4 w-28 text-center">AKSI</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors text-gray-700 dark:text-gray-200"
                  >
                    <td className="px-6 py-4 text-center font-semibold text-gray-400">
                      {idx + 1}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                      {item.mata_pelajaran}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 font-medium px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                        {item.kitab}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs max-w-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      {item.keterangan || '-'}
                    </td>
                    {isEditable && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center items-center gap-2">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={14} />
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
          </div>
        </div>
      )}

      {/* Edit/Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 bg-indigo-600 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">
                {isEditMode ? 'Edit Kurikulum' : 'Tambah Kurikulum Baru'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                  Tingkatan
                </label>
                <select
                  value={currentItem.tingkat}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, tingkat: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                  required
                >
                  <option value="ULA">ULA</option>
                  <option value="WUSTHO">WUSTHO</option>
                  <option value="MAK">MAK (Keagamaan)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                  Mata Pelajaran
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Fiqh, Nahwu, dll"
                  value={currentItem.mata_pelajaran}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, mata_pelajaran: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                  Jenjang Kitab / Buku Pelajaran
                </label>
                <textarea
                  placeholder="Contoh: Mabadi' Fiqhiyyah => Fathul Qorib"
                  value={currentItem.kitab}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, kitab: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 h-20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                  Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Catatan tambahan"
                  value={currentItem.keterangan || ''}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, keterangan: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-1.5"
                >
                  <Save size={16} />
                  <span>{saving ? 'Menyimpan...' : 'Simpan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" style={{ paddingTop: '72px', paddingBottom: '72px' }}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-5xl h-full mx-4 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
              <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <FileText className="text-green-600" size={20} />
                Preview PDF Kurikulum
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('pdf', false)}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors flex items-center gap-2"
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
            {/* Desktop: iframe preview */}
            <div className="hidden md:block flex-1 bg-gray-200 dark:bg-black/50 p-4 overflow-hidden">
              <iframe 
                src={pdfUrl} 
                className="w-full h-full rounded-xl shadow-inner bg-white"
                title="PDF Preview"
              />
            </div>
            {/* Mobile: fallback card */}
            <div className="flex md:hidden flex-1 flex-col items-center justify-center gap-5 p-8 bg-gray-50 dark:bg-gray-900/50">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
                <FileText size={40} className="text-green-600" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">Preview PDF tidak tersedia di HP</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Browser HP Anda tidak mendukung tampilan PDF secara tertanam. Silakan gunakan tombol di bawah untuk membuka atau mengunduh file PDF.</p>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl shadow-md transition-colors"
                >
                  <FileText size={18} /> Buka di Tab Baru
                </a>
                <a
                  href={pdfUrl}
                  download
                  className="flex items-center justify-center gap-2 w-full py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-2xl transition-colors"
                >
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
