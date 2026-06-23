'use client';

import { useState, useEffect, useRef } from 'react';
import { Home, Search, Plus, Edit, Users, UserPlus, X, FileText, Download } from 'lucide-react';


export default function KamarPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('guru');

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const json = await res.json();
        if (json.success) setRole(json.user.role);
      } catch (err) {}
    };
    fetchMe();

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/kelas?type=kamar');
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (err) {
        console.error('Failed to fetch kamar:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredData = data.filter(item => 
    item.nama.toLowerCase().includes(search.toLowerCase())
  );

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig) return 0;
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];
    if (valA === null || valA === undefined) valA = '';
    if (valB === null || valB === undefined) valB = '';

    // Gunakan numeric localeCompare untuk natural sort
    const compareResult = valA.toString().localeCompare(valB.toString(), undefined, { numeric: true, sensitivity: 'base' });
    return sortConfig.direction === 'ascending' ? compareResult : -compareResult;
  });

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return ' ⇅';
    return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  };

  // Export State
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  const handleExport = (format: 'pdf' | 'excel' = 'pdf', previewOnly = false) => {
    if (sortedData.length === 0) {
      alert('Tidak ada data untuk di-export.');
      return;
    }

    const title = 'DATA KAMAR ASRAMA';
    const subtitle = `Filter Pencarian: ${search || 'Semua Data'}`;
    const filename = `Data_Kamar_Asrama`;

    const tableColumn = ["NO", "NAMA KAMAR", "PEMBINA KAMAR", "JUMLAH PENGHUNI"];
    const tableRows: any[] = [];

    sortedData.forEach((item, idx) => {
      tableRows.push([
        idx + 1,
        item.nama,
        item.pembina || item.wali_kelas || '-',
        item.jumlah_murid || '0'
      ]);
    });

    if (format === 'excel') {
      import('@/lib/exportUtils').then(({ exportToExcel }) => exportToExcel({ title, subtitle, columns: tableColumn, rows: tableRows, filename }));
    } else {
      import('@/lib/exportUtils').then(({ exportToPDF }) => {
        const result = exportToPDF({ title, subtitle, columns: tableColumn, rows: tableRows, filename, previewOnly });
        if (previewOnly && result) {
          setPdfUrl(result);
          setShowPdfPreview(true);
        }
      });
    }
  };

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingKamar, setEditingKamar] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingKamar, setViewingKamar] = useState<any>(null);
  const [muridList, setMuridList] = useState<any[]>([]);
  const [loadingMurid, setLoadingMurid] = useState(false);

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [movingMurid, setMovingMurid] = useState<any>(null);
  const [targetKamarId, setTargetKamarId] = useState('');
  const [moving, setMoving] = useState(false);

  // State untuk fitur Tambah Santri ke Kamar
  const [isAddMuridModalOpen, setIsAddMuridModalOpen] = useState(false);
  const [searchTambah, setSearchTambah] = useState('');
  const [loadingTambah, setLoadingTambah] = useState(false);
  const [muridTersedia, setMuridTersedia] = useState<any[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const searchTambahRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canEdit = role === 'admin' || role === 'staff' || role === 'pengurus_asrama';


  const handleEditClick = (item: any) => {
    setEditingKamar(item);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/kelas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingKamar.id,
          nama: editingKamar.nama,
          type: 'kamar'
        })
      });
      const json = await res.json();
      if (json.success) {
        setData(data.map(d => d.id === editingKamar.id ? { ...d, nama: editingKamar.nama } : d));
        setIsEditModalOpen(false);
      } else {
        alert('Gagal menyimpan: ' + json.error);
      }
    } catch (err) {
      alert('Terjadi kesalahan sistem saat menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleViewMurid = async (item: any) => {
    setViewingKamar(item);
    setIsViewModalOpen(true);
    setLoadingMurid(true);
    try {
      const res = await fetch(`/api/murid?kamar_id=${item.id}`);
      const json = await res.json();
      if (json.success) setMuridList(json.data);
    } catch (err) {
      console.error('Gagal memuat murid', err);
    } finally {
      setLoadingMurid(false);
    }
  };

  const handleMoveMurid = (murid: any) => {
    setMovingMurid(murid);
    setTargetKamarId('');
    setIsMoveModalOpen(true);
  };

  const handleSaveMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetKamarId) return;
    
    setMoving(true);
    try {
      const res = await fetch('/api/murid', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          murid_id: movingMurid.murid_id,
          kamar_id: targetKamarId
        })
      });
      const json = await res.json();
      if (json.success) {
        setMuridList(muridList.filter(m => m.murid_id !== movingMurid.murid_id));
        setData(data.map(d => d.id === viewingKamar.id ? { ...d, jumlah_murid: d.jumlah_murid - 1 } : d));
        setIsMoveModalOpen(false);
      } else {
        alert('Gagal memindahkan: ' + json.error);
      }
    } catch (err) {
      alert('Terjadi kesalahan sistem');
    } finally {
      setMoving(false);
    }
  };

  // Cari santri yang belum punya kamar (kamar_id = NULL)
  const handleSearchTambah = async (keyword: string) => {
    setSearchTambah(keyword);
    if (keyword.trim().length < 2) {
      setMuridTersedia([]);
      return;
    }
    if (searchTambahRef.current) clearTimeout(searchTambahRef.current);
    searchTambahRef.current = setTimeout(async () => {
      setLoadingTambah(true);
      try {
        const res = await fetch(`/api/murid?tanpa_kamar=1`);
        const json = await res.json();
        if (json.success) {
          const filtered = json.data.filter((m: any) =>
            m.nama?.toLowerCase().includes(keyword.toLowerCase()) ||
            m.nis?.includes(keyword)
          );
          setMuridTersedia(filtered);
        }
      } catch (err) {
        console.error('Gagal mencari santri', err);
      } finally {
        setLoadingTambah(false);
      }
    }, 300);
  };

  const handleTambahSantri = async (murid: any) => {
    setAdding(murid.murid_id);
    try {
      const res = await fetch('/api/murid', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ murid_id: murid.murid_id, kamar_id: viewingKamar.id })
      });
      const json = await res.json();
      if (json.success) {
        setMuridList(prev => [...prev, murid]);
        setMuridTersedia(prev => prev.filter(m => m.murid_id !== murid.murid_id));
        setData(data.map(d => d.id === viewingKamar.id ? { ...d, jumlah_murid: d.jumlah_murid + 1 } : d));
      } else {
        alert('Gagal menambahkan: ' + json.error);
      }
    } catch (err) {
      alert('Terjadi kesalahan sistem');
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="bg-gradient-to-br from-blue-50 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 rounded-3xl p-6 shadow-sm border border-blue-200 dark:border-blue-800/50 relative overflow-hidden transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-blue-200/50 dark:text-blue-800/30">
          <Home size={120} />
        </div>
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-blue-800 dark:text-blue-400 drop-shadow-sm flex items-center gap-2">
              <Home size={28} /> Manajemen Kamar
            </h1>
            <p className="text-blue-600 dark:text-blue-300 text-sm mt-1 font-medium max-w-sm">
              Kelola data kamar asrama beserta pembinanya.
            </p>
          </div>
          {(role === 'admin' || role === 'staff') && (
            <button className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-sm transition-transform hover:scale-105 flex items-center justify-center font-bold" title="Tambah Kamar">
              <Plus size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input 
            type="text" 
            placeholder="Cari nama kamar..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-gray-200 transition-colors"
          />
        </div>

        <div className="flex gap-2 shrink-0 ml-auto sm:ml-0 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          <button onClick={() => handleExport('pdf', true)} className="px-3 py-2.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1.5 shrink-0" title="Preview PDF">
            <FileText size={14} /> Preview
          </button>
          <button onClick={() => handleExport('pdf', false)} className="px-3 py-2.5 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5 shrink-0" title="Export PDF">
            <Download size={14} /> PDF
          </button>
          <button onClick={() => handleExport('excel', false)} className="px-3 py-2.5 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors flex items-center gap-1.5 shrink-0" title="Export Excel">
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-blue-800 dark:bg-blue-900 text-white font-bold border-b border-blue-900 dark:border-gray-700">
              <tr>
                <th className="px-4 py-4 w-16 cursor-pointer hover:bg-blue-700 select-none" onClick={() => requestSort('id')}>ID{getSortIcon('id')}</th>
                <th className="px-4 py-4 cursor-pointer hover:bg-blue-700 select-none" onClick={() => requestSort('nama')}>NAMA KAMAR{getSortIcon('nama')}</th>
                <th className="px-4 py-4 cursor-pointer hover:bg-blue-700 select-none" onClick={() => requestSort('pembina')}>PEMBINA KAMAR{getSortIcon('pembina')}</th>
                <th className="px-4 py-4 text-center cursor-pointer hover:bg-blue-700 select-none" onClick={() => requestSort('jumlah_murid')}>PENGHUNI{getSortIcon('jumlah_murid')}</th>
                <th className="px-4 py-4 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">Memuat data kamar...</td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">Kamar tidak ditemukan.</td>
                </tr>
              ) : (
                sortedData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors text-gray-700 dark:text-gray-200">
                    <td className="px-4 py-3 font-mono text-xs">{item.id}</td>
                    <td className="px-4 py-3 font-bold">{item.nama}</td>
                    <td className="px-4 py-3 text-xs">{item.pembina || <span className="text-gray-400 italic">Belum ada pembina</span>}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full font-bold text-xs">
                        {item.jumlah_murid} Santri
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleViewMurid(item)} className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors" title="Lihat Penghuni">
                          <Users size={14} />
                        </button>
                        {canEdit && (
                          <button onClick={() => handleEditClick(item)} className="p-1.5 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors" title="Edit">
                            <Edit size={14} />
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

      {/* Modal Edit Kamar */}
      {isEditModalOpen && editingKamar && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
            <div className="bg-blue-600 dark:bg-blue-900 p-5 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Edit size={20} /> Edit Nama Kamar
              </h2>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">ID Kamar (Tidak dapat diubah)</label>
                <input 
                  type="text" 
                  value={editingKamar.id} 
                  disabled
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nama Kamar</label>
                <input 
                  type="text" 
                  value={editingKamar.nama || ''} 
                  onChange={(e) => setEditingKamar({...editingKamar, nama: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal View Murid */}
      {isViewModalOpen && viewingKamar && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh] mb-16">
            <div className="bg-blue-600 dark:bg-blue-900 p-5 text-white shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Home size={20} /> Kamar {viewingKamar.nama}
                  </h2>
                  <p className="text-blue-100 text-sm mt-1">Pembina: {viewingKamar.pembina || 'Belum ditugaskan'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button
                      onClick={() => { setIsAddMuridModalOpen(true); setSearchTambah(''); setMuridTersedia([]); }}
                      className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition"
                      title="Tambah Santri ke Kamar Ini"
                    >
                      <Plus size={18} />
                    </button>
                  )}
                  <button onClick={() => setIsViewModalOpen(false)} className="bg-white/20 p-2 rounded-lg hover:bg-white/30 transition">
                    Kembali
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-0 overflow-y-auto flex-1">
              {loadingMurid ? (
                <div className="p-8 text-center text-gray-500">Memuat data penghuni...</div>
              ) : muridList.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Belum ada penghuni di kamar ini.</div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700 sticky top-0">
                    <tr>
                      <th className="px-4 py-3">NIS</th>
                      <th className="px-4 py-3">NAMA SANTRI</th>
                      <th className="px-4 py-3 text-center">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {muridList.map(m => (
                      <tr key={m.murid_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.nis}</td>
                        <td className="px-4 py-3 font-bold">{m.nama}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleMoveMurid(m)} className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-3 py-1.5 rounded-lg font-bold hover:bg-orange-200 transition-colors">
                            Pindah Kamar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Santri ke Kamar */}
      {isAddMuridModalOpen && viewingKamar && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
            <div className="bg-green-600 dark:bg-green-800 p-5 text-white shrink-0 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <UserPlus size={20} /> Tambah Santri ke Kamar {viewingKamar.nama}
                </h2>
                <p className="text-green-100 text-xs mt-1">Hanya santri yang belum memiliki kamar yang ditampilkan</p>
              </div>
              <button onClick={() => setIsAddMuridModalOpen(false)} className="bg-white/20 p-2 rounded-lg hover:bg-white/30 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Ketik nama atau NIS santri (min. 2 karakter)..."
                  value={searchTambah}
                  onChange={(e) => handleSearchTambah(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-4 pb-4">
              {loadingTambah ? (
                <div className="text-center py-6 text-gray-400 text-sm">Mencari santri...</div>
              ) : searchTambah.trim().length < 2 ? (
                <div className="text-center py-8 text-gray-400">
                  <Users size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Ketik minimal 2 karakter untuk mencari santri</p>
                </div>
              ) : muridTersedia.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">
                  Tidak ada santri tanpa kamar yang cocok dengan pencarian &quot;{searchTambah}&quot;
                </div>
              ) : (
                <div className="space-y-2">
                  {muridTersedia.map(m => (
                    <div key={m.murid_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 transition-colors">
                      <div>
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{m.nama}</p>
                        <p className="text-xs text-gray-400 font-mono">{m.nis}</p>
                      </div>
                      <button
                        onClick={() => handleTambahSantri(m)}
                        disabled={adding === m.murid_id}
                        className="bg-green-500 hover:bg-green-600 text-white text-sm font-bold p-2 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 shrink-0"
                        title={adding === m.murid_id ? 'Menambahkan...' : 'Tambah ke kamar ini'}
                      >
                        {adding === m.murid_id
                          ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                          : <UserPlus size={16} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Pindah Kamar */}
      {isMoveModalOpen && movingMurid && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
            <div className="bg-orange-500 dark:bg-orange-700 p-4 text-white">
              <h2 className="text-lg font-bold">Pindah Kamar</h2>
              <p className="text-xs text-orange-100 mt-1">{movingMurid.nama}</p>
            </div>
            <form onSubmit={handleSaveMove} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Pilih Kamar Tujuan</label>
                <select 
                  value={targetKamarId} 
                  onChange={(e) => setTargetKamarId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="" disabled>-- Pilih Kamar --</option>
                  {data.map(k => (
                    <option key={k.id} value={k.id} disabled={k.id === viewingKamar?.id}>
                      {k.nama} {k.id === viewingKamar?.id ? '(Kamar Saat Ini)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsMoveModalOpen(false)}
                  className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={moving || !targetKamarId}
                  className="flex-1 py-2 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {moving ? 'Menyimpan...' : 'Pindahkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-gray-800 w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <FileText className="text-orange-500" size={20} />
                Preview PDF Data Kamar
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('pdf', false)}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors flex items-center gap-2"
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
            <div className="hidden md:block flex-1 bg-gray-200 dark:bg-black/50 p-4 h-full">
              <iframe 
                src={pdfUrl} 
                className="w-full h-full rounded-xl shadow-inner bg-white"
                title="PDF Preview"
                style={{ minHeight: '60vh' }}
              />
            </div>
            {/* Mobile: fallback card */}
            <div className="flex md:hidden flex-1 flex-col items-center justify-center gap-5 p-8 bg-gray-50 dark:bg-gray-900/50">
              <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center">
                <FileText size={40} className="text-orange-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">Preview PDF tidak tersedia di HP</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Browser HP tidak mendukung tampilan PDF dalam aplikasi. Gunakan tombol di bawah untuk membuka atau mengunduh file PDF.</p>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-2xl shadow-md transition-colors"
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
