'use client';

import { useState, useEffect } from 'react';
import { UserCog, Search, Plus, Trash2, Edit, Phone, MapPin, BookOpen, Home as HomeIcon, UserPlus, FileText, Download, X } from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';

export default function GuruPage() {
  const [guru, setGuru] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('guru');
  const [myGuruId, setMyGuruId] = useState<number | null>(null);

  // State untuk bulk actions
  const [selectedGuru, setSelectedGuru] = useState<number[]>([]);

  // Detail Modal State
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingGuru, setViewingGuru] = useState<any>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingGuru, setEditingGuru] = useState<any>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);

  // Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [filterMadin, setFilterMadin] = useState('');
  const [filterQuran, setFilterQuran] = useState('');
  const [filterKamar, setFilterKamar] = useState('');

  // Export State
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success) {
          setRole(data.user.role);
          if (data.user.guruId) setMyGuruId(data.user.guruId);
        }
      } catch (err) { }
    };
    fetchMe();

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/guru');
        const json = await res.json();
        if (json.success) setGuru(json.data);
      } catch (err) {
        console.error('Failed to fetch guru:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleConvertUser = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin membuat/memperbarui User untuk Guru ini?')) return;
    try {
      const res = await fetch('/api/users/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'guru', id })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`${data.message}\nUsername: ${data.username}\nPassword: ${data.defaultPassword}`);
      } else {
        alert(data.error || 'Terjadi kesalahan');
      }
    } catch (err) {
      alert('Gagal melakukan konversi user');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data guru ini?')) return;
    try {
      const res = await fetch(`/api/guru?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setGuru(guru.filter(g => g.guru_id !== parseInt(id)));
        setSelectedGuru(selectedGuru.filter(gId => gId !== parseInt(id)));
      } else {
        alert('Gagal: ' + json.error);
      }
    } catch (err) {
      alert('Terjadi kesalahan sistem');
    }
  };

  const handleDeleteBulk = async () => {
    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedGuru.length} data guru ini?`)) return;
    try {
      // Create a function that handles multiple deletes or just loop here if API doesn't support bulk DELETE
      let successCount = 0;
      for (const id of selectedGuru) {
        const res = await fetch(`/api/guru?id=${id}`, { method: 'DELETE' });
        if (res.ok) successCount++;
      }
      if (successCount > 0) {
        setGuru(guru.filter(g => !selectedGuru.includes(g.guru_id)));
        setSelectedGuru([]);
        alert(`Berhasil menghapus ${successCount} data guru.`);
      }
    } catch (err) {
      alert('Terjadi kesalahan sistem saat menghapus massal');
    }
  };

  const handleConvertUserBulk = async () => {
    if (!confirm(`Apakah Anda yakin ingin membuat/memperbarui User untuk ${selectedGuru.length} Guru ini?`)) return;
    try {
      const res = await fetch('/api/users/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'guru', ids: selectedGuru })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setSelectedGuru([]);
      } else {
        alert(data.error || 'Terjadi kesalahan');
      }
    } catch (err) {
      alert('Gagal melakukan konversi user massal');
    }
  };

  const handleViewDetail = (item: any) => {
    setViewingGuru(item);
    setIsDetailModalOpen(true);
  };

  const handleEditClick = (item: any) => {
    setEditingGuru(item);
    setPhotoFile(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let fotoName = editingGuru.foto;

      // Handle photo upload if any
      if (photoFile) {
        const formData = new FormData();
        formData.append('file', photoFile);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        const uploadJson = await uploadRes.json();
        if (uploadJson.success) {
          fotoName = uploadJson.fileName;
        } else {
          alert('Gagal mengupload foto: ' + uploadJson.error);
          setSaving(false);
          return;
        }
      }

      const res = await fetch('/api/guru', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guru_id: editingGuru.guru_id,
          nama: editingGuru.nama,
          jenis_kelamin: editingGuru.jenis_kelamin,
          jabatan: editingGuru.jabatan,
          alamat: editingGuru.alamat,
          whatsapp: editingGuru.whatsapp || editingGuru.no_hp,
          foto: fotoName
        })
      });
      const json = await res.json();
      if (json.success) {
        setGuru(guru.map(g => g.guru_id === editingGuru.guru_id ? { ...g, ...editingGuru, no_hp: editingGuru.whatsapp, foto: fotoName } : g));
        setIsEditModalOpen(false);
      } else {
        alert('Gagal menyimpan: ' + json.error);
      }
    } catch (err) {
      alert('Terjadi kesalahan sistem saat menyimpan data.');
    } finally {
      setSaving(false);
    }
  };

  const madinList = Array.from(new Set(guru.flatMap(g => g.kelas_madin || []))).sort() as string[];
  const quranList = Array.from(new Set(guru.flatMap(g => g.kelas_quran || []))).sort() as string[];
  const kamarList = Array.from(new Set(guru.flatMap(g => g.kamar || []))).sort() as string[];

  const filteredGuru = guru.filter(g => {
    const s = search.toLowerCase();
    const matchSearch = g.nama.toLowerCase().includes(s) ||
      (g.nip && g.nip.toLowerCase().includes(s)) ||
      (g.alamat && g.alamat.toLowerCase().includes(s)) ||
      (g.jabatan && g.jabatan.toLowerCase().includes(s)) ||
      (g.whatsapp && g.whatsapp.toLowerCase().includes(s)) ||
      (g.kelas_madin && g.kelas_madin.some((k: string) => k.toLowerCase().includes(s))) ||
      (g.kelas_quran && g.kelas_quran.some((k: string) => k.toLowerCase().includes(s))) ||
      (g.kamar && g.kamar.some((k: string) => k.toLowerCase().includes(s)));

    const matchMadin = filterMadin ? (g.kelas_madin && g.kelas_madin.includes(filterMadin)) : true;
    const matchQuran = filterQuran ? (g.kelas_quran && g.kelas_quran.includes(filterQuran)) : true;
    const matchKamar = filterKamar ? (g.kamar && g.kamar.includes(filterKamar)) : true;

    return matchSearch && matchMadin && matchQuran && matchKamar;
  });

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedGuru = [...filteredGuru].sort((a, b) => {
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

  const toggleSelectAll = () => {
    if (selectedGuru.length === filteredGuru.length) {
      setSelectedGuru([]);
    } else {
      setSelectedGuru(filteredGuru.map(g => g.guru_id));
    }
  };

  const toggleSelect = (id: number) => {
    if (selectedGuru.includes(id)) {
      setSelectedGuru(selectedGuru.filter(gId => gId !== id));
    } else {
      setSelectedGuru([...selectedGuru, id]);
    }
  };

  const handleExport = (format: 'pdf' | 'excel' = 'pdf', previewOnly = false) => {
    const exportData = selectedGuru.length > 0 
      ? sortedGuru.filter(g => selectedGuru.includes(g.guru_id))
      : sortedGuru;

    if (exportData.length === 0) {
      alert('Tidak ada data untuk di-export.');
      return;
    }

    const title = 'DATA GURU DAN PEMBINA';
    const subtitle = `Filter: ${filterMadin || 'Semua Madin'} | ${filterQuran || "Semua Qur'an"} | ${filterKamar || 'Semua Kamar'}`;
    const filename = `Data_Guru_Pembina`;

    const tableColumn = ["NO", "NIP", "NAMA LENGKAP", "J. KELAMIN", "JABATAN / TUGAS", "NO. HP", "ALAMAT"];
    const tableRows: any[] = [];

    exportData.forEach((item, idx) => {
      const tugas = [
        item.jabatan || 'Guru',
        item.kelas_madin?.length ? `Madin: ${item.kelas_madin.join(', ')}` : '',
        item.kelas_quran?.length ? `Quran: ${item.kelas_quran.join(', ')}` : '',
        item.kamar?.length ? `Kamar: ${item.kamar.join(', ')}` : ''
      ].filter(Boolean).join('\n');

      tableRows.push([
        idx + 1,
        item.nip || '-',
        item.nama,
        item.jenis_kelamin || '-',
        tugas,
        item.whatsapp || item.no_hp || '-',
        item.alamat || '-'
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 rounded-3xl p-6 shadow-sm border border-indigo-200 dark:border-indigo-800/50 relative overflow-hidden transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-indigo-200/50 dark:text-indigo-800/30">
          <UserCog size={120} />
        </div>
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-indigo-800 dark:text-indigo-400 drop-shadow-sm flex items-center gap-2 font-theme-hero">
              <UserCog size={28} /> Data Guru & Pembina
            </h1>
            <p className="text-indigo-600 dark:text-indigo-300 text-sm mt-1 font-medium max-w-sm">
              Manajemen informasi dewan asatidz dan pembina kamar.
            </p>
          </div>
          {(role === 'admin' || role === 'staff') && (
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-sm transition-transform hover:scale-105 flex items-center justify-center font-bold" title="Tambah Data">
              <Plus size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Pencarian & Bulk Actions & Filter Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Cari nama, NIP, alamat, kontak, kelas, kamar, atau jabatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200 transition-colors"
          />
        </div>

        {selectedGuru.length > 0 && (role === 'admin' || role === 'staff') && (
          <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
            <button onClick={handleConvertUserBulk} className="px-3 py-2.5 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold hover:bg-purple-100 transition-colors flex items-center gap-1.5">
              <UserPlus size={14} /> Perbarui Akun ({selectedGuru.length})
            </button>
            <button onClick={handleDeleteBulk} className="px-3 py-2.5 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5">
              <Trash2 size={14} /> Hapus ({selectedGuru.length})
            </button>
          </div>
        )}

        <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-2.5 border rounded-xl flex items-center justify-center transition-colors shrink-0 ${showFilters || filterMadin || filterQuran || filterKamar ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
          <Search size={18} /> <span className="ml-2 text-xs font-bold">Filter</span>
        </button>

        <div className="flex gap-2 shrink-0 ml-auto sm:ml-0">
          <button onClick={() => handleExport('pdf', true)} className="px-3 py-2.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1.5" title="Preview PDF">
            <FileText size={14} /> Preview
          </button>
          <button onClick={() => handleExport('pdf', false)} className="px-3 py-2.5 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5" title="Export PDF">
            <Download size={14} /> PDF
          </button>
          <button onClick={() => handleExport('excel', false)} className="px-3 py-2.5 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors flex items-center gap-1.5" title="Export Excel">
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-2 duration-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tugas Madin</label>
            <select value={filterMadin} onChange={(e) => setFilterMadin(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
              <option value="">Semua Kelas Madin</option>
              {madinList.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tugas Qur'an</label>
            <select value={filterQuran} onChange={(e) => setFilterQuran(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
              <option value="">Semua Kelas Qur'an</option>
              {quranList.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tugas Kamar (Pembina)</label>
            <select value={filterKamar} onChange={(e) => setFilterKamar(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
              <option value="">Semua Kamar</option>
              {kamarList.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Tabel */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-green-800 dark:bg-green-900 text-white font-bold border-b border-green-900 dark:border-gray-700">
              <tr>
                {(role === 'admin' || role === 'staff') && (
                  <th className="px-4 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={selectedGuru.length === filteredGuru.length && filteredGuru.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th className="px-4 py-4 w-12 text-center">FOTO</th>
                <th className="px-4 py-4 cursor-pointer hover:bg-green-700 select-none" onClick={() => requestSort('nama')}>NIP & NAMA{getSortIcon('nama')}</th>
                <th className="px-4 py-4 cursor-pointer hover:bg-green-700 select-none" onClick={() => requestSort('jenis_kelamin')}>J. KELAMIN{getSortIcon('jenis_kelamin')}</th>
                <th className="px-4 py-4 cursor-pointer hover:bg-green-700 select-none" onClick={() => requestSort('jabatan')}>TUGAS & KELAS{getSortIcon('jabatan')}</th>
                <th className="px-4 py-4 cursor-pointer hover:bg-green-700 select-none" onClick={() => requestSort('alamat')}>KONTAK & ALAMAT{getSortIcon('alamat')}</th>
                <th className="px-4 py-4 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">Memuat data...</td>
                </tr>
              ) : filteredGuru.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">Data tidak ditemukan.</td>
                </tr>
              ) : (
                sortedGuru.map((item) => (
                  <tr key={item.guru_id} className={`transition-colors text-gray-700 dark:text-gray-200 ${(role === 'admin' || role === 'staff') && selectedGuru.includes(item.guru_id) ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/50'}`}>
                    {(role === 'admin' || role === 'staff') && (
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={selectedGuru.includes(item.guru_id)}
                          onChange={() => toggleSelect(item.guru_id)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto overflow-hidden bg-gray-200 dark:bg-gray-700 ${item.foto ? 'cursor-pointer hover:opacity-80' : ''}`}
                        onClick={() => item.foto ? setZoomPhoto(`/uploads/${item.foto}`) : null}
                      >
                        {item.foto ? (
                          <img src={`/uploads/${item.foto}`} alt={item.nama} className="w-full h-full object-cover" />
                        ) : (
                          <UserCog size={20} className="text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900 dark:text-white">{item.nama}</div>
                      <div className="text-xs text-gray-500">{item.nip || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs uppercase font-medium">
                      {item.jenis_kelamin || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-indigo-600 dark:text-indigo-400 mb-1">{item.jabatan || 'Guru'}</div>
                      <div className="flex flex-col gap-1">
                        {item.kelas_madin?.map((k: string, i: number) => (
                          <span key={`m-${i}`} className="inline-flex items-center gap-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded text-[10px] font-semibold w-max">
                            <BookOpen size={10} /> Madin: {k}
                          </span>
                        ))}
                        {item.kelas_quran?.map((k: string, i: number) => (
                          <span key={`q-${i}`} className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-semibold w-max">
                            <BookOpen size={10} /> Qur'an: {k}
                          </span>
                        ))}
                        {item.kamar?.map((k: string, i: number) => (
                          <span key={`k-${i}`} className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded text-[10px] font-semibold w-max">
                            <HomeIcon size={10} /> Kamar: {k}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
                          <Phone size={12} /> {item.whatsapp || item.no_hp || '-'}
                        </span>
                        <span className="flex items-start gap-1.5 text-xs text-gray-500 max-w-[200px] whitespace-normal">
                          <MapPin size={12} className="shrink-0 mt-0.5" />
                          <span className="line-clamp-2" title={item.alamat}>{item.alamat || '-'}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleViewDetail(item)} className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors" title="Detail">
                          <BookOpen size={14} />
                        </button>
                        {(role === 'admin' || role === 'staff') && (
                          <button onClick={() => handleConvertUser(item.guru_id)} className="p-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors" title="Jadikan User Akun">
                            <UserPlus size={14} />
                          </button>
                        )}
                        {(role === 'admin' || role === 'staff' || (role === 'guru' && myGuruId === item.guru_id)) && (
                          <button onClick={() => handleEditClick(item)} className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors" title="Edit">
                            <Edit size={14} />
                          </button>
                        )}
                        {role === 'admin' && (
                          <button onClick={() => handleDelete(item.guru_id)} className="p-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors" title="Hapus">
                            <Trash2 size={14} />
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

      {/* Detail Modal */}
      {isDetailModalOpen && viewingGuru && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-2xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh] mb-16 overflow-hidden">
            <div className="bg-indigo-600 dark:bg-indigo-900 p-5 text-white flex justify-between items-start shrink-0">
              <div className="flex gap-4 items-center">
                <div
                  className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/30 bg-white/10 flex items-center justify-center cursor-pointer hover:opacity-80"
                  onClick={() => viewingGuru.foto ? setZoomPhoto(`/uploads/${viewingGuru.foto}`) : null}
                >
                  {viewingGuru.foto ? (
                    <img src={`/uploads/${viewingGuru.foto}`} alt={viewingGuru.nama} className="w-full h-full object-cover" />
                  ) : (
                    <UserCog size={32} className="text-white/70" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{viewingGuru.nama}</h2>
                  <p className="text-xs text-indigo-200 font-mono mt-0.5">NIP: {viewingGuru.nip || '-'}</p>
                </div>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                X
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 text-sm text-gray-700 dark:text-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Jabatan Utama</p>
                    <p className="font-semibold text-indigo-600 dark:text-indigo-400">{viewingGuru.jabatan || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Jenis Kelamin</p>
                    <p className="font-semibold">{viewingGuru.jenis_kelamin || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">No. WhatsApp / HP</p>
                    <p className="font-semibold flex items-center gap-2"><Phone size={14} className="text-gray-400" /> {viewingGuru.whatsapp || viewingGuru.no_hp || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Alamat Lengkap</p>
                    <p className="font-semibold leading-relaxed flex items-start gap-2"><MapPin size={14} className="text-gray-400 shrink-0 mt-1" /> {viewingGuru.alamat || '-'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl space-y-3 border border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b dark:border-gray-700 pb-2">Tugas Akademik & Asrama</p>

                    <div>
                      <span className="text-xs text-gray-500 mb-1 block">Tugas Kelas Madin:</span>
                      {viewingGuru.kelas_madin && viewingGuru.kelas_madin.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {viewingGuru.kelas_madin.map((k: string, i: number) => <span key={i} className="inline-flex items-center gap-1 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded text-xs font-semibold"><BookOpen size={10} /> {k}</span>)}
                        </div>
                      ) : <span className="text-xs font-semibold text-gray-400">-</span>}
                    </div>

                    <div>
                      <span className="text-xs text-gray-500 mb-1 block">Tugas Kelas Qur'an:</span>
                      {viewingGuru.kelas_quran && viewingGuru.kelas_quran.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {viewingGuru.kelas_quran.map((k: string, i: number) => <span key={i} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded text-xs font-semibold"><BookOpen size={10} /> {k}</span>)}
                        </div>
                      ) : <span className="text-xs font-semibold text-gray-400">-</span>}
                    </div>

                    <div>
                      <span className="text-xs text-gray-500 mb-1 block">Tugas Pembina Kamar:</span>
                      {viewingGuru.kamar && viewingGuru.kamar.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {viewingGuru.kamar.map((k: string, i: number) => <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded text-xs font-semibold"><HomeIcon size={10} /> {k}</span>)}
                        </div>
                      ) : <span className="text-xs font-semibold text-gray-400">-</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-end shrink-0">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-300 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingGuru && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-lg border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh] mb-16 overflow-hidden">
            <div className="bg-indigo-600 dark:bg-indigo-900 p-5 text-white shrink-0">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Edit size={20} /> Edit Data Guru
              </h2>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto flex-1">

              <div className="flex flex-col sm:flex-row gap-5">
                <div className="w-full sm:w-1/3 space-y-3">
                  <div className="w-32 h-32 bg-gray-100 dark:bg-gray-900 rounded-2xl mx-auto overflow-hidden border-2 border-dashed border-gray-300 flex items-center justify-center relative">
                    {photoFile ? (
                      <img src={URL.createObjectURL(photoFile)} alt="Preview" className="w-full h-full object-cover" />
                    ) : editingGuru.foto ? (
                      <img src={`/uploads/${editingGuru.foto}`} alt={editingGuru.nama} className="w-full h-full object-cover" />
                    ) : (
                      <UserCog size={40} className="text-gray-400" />
                    )}
                    <label className="absolute bottom-2 bg-black/60 text-white text-[10px] px-3 py-1 rounded-full cursor-pointer hover:bg-black transition-colors">
                      Ubah Foto
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>

                <div className="w-full sm:w-2/3 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      value={editingGuru.nama || ''}
                      onChange={(e) => setEditingGuru({ ...editingGuru, nama: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Jenis Kelamin</label>
                      <select
                        value={editingGuru.jenis_kelamin || ''}
                        onChange={(e) => setEditingGuru({ ...editingGuru, jenis_kelamin: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="LAKI-LAKI">LAKI-LAKI</option>
                        <option value="PEREMPUAN">PEREMPUAN</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Jabatan</label>
                      <input
                        type="text"
                        value={editingGuru.jabatan || ''}
                        onChange={(e) => setEditingGuru({ ...editingGuru, jabatan: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        disabled={role === 'guru'}
                      />
                      {role === 'guru' && <p className="text-[10px] text-gray-400 mt-1">Hubungi admin untuk ubah jabatan</p>}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">No. WhatsApp</label>
                <input
                  type="text"
                  value={editingGuru.whatsapp || editingGuru.no_hp || ''}
                  onChange={(e) => setEditingGuru({ ...editingGuru, whatsapp: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Alamat Lengkap</label>
                <textarea
                  value={editingGuru.alamat || ''}
                  onChange={(e) => setEditingGuru({ ...editingGuru, alamat: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Zoom Photo Modal */}
      {zoomPhoto && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm cursor-zoom-out" onClick={() => setZoomPhoto(null)}>
          <div className="relative max-w-4xl max-h-[90vh] flex items-center justify-center animate-in zoom-in duration-200">
            <img src={zoomPhoto} alt="Zoomed" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" />
            <button className="absolute -top-4 -right-4 bg-white text-black rounded-full w-8 h-8 flex items-center justify-center font-bold hover:scale-110 transition-transform">X</button>
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
                Preview PDF Data Guru
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
              <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center">
                <FileText size={40} className="text-indigo-500" />
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
                  className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-md transition-colors"
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
