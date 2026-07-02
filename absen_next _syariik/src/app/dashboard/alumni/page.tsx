'use client';

import { useState, useEffect } from 'react';
import { GraduationCap, Search, Edit, Trash2, RotateCcw, Download, FileText, X, Plus } from 'lucide-react';

export default function AlumniManagementPage() {
  const [alumni, setAlumni] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState(''); // '' means All, 'PPM', 'LPPM'
  const [errorMsg, setErrorMsg] = useState('');

  // Helper untuk menentukan URL Foto Santri (Lokal vs Mitra)
  const getFotoUrl = (fotoName: string | null) => {
    if (!fotoName || fotoName === '-') return '';
    if (fotoName.startsWith('http://') || fotoName.startsWith('https://')) {
      return fotoName;
    }
    if (fotoName.startsWith('foto_') || fotoName.startsWith('upload_') || fotoName.startsWith('profil_')) {
      return `/uploads/${fotoName}`;
    }
    const baseUrl = process.env.NEXT_PUBLIC_API_MITRA_FOTO_URL || 'https://mawar.smartpesantren.id/sekretariat/berkas/';
    const cleanFotoName = fotoName.startsWith('/') ? fotoName.substring(1) : fotoName;
    if (cleanFotoName.includes('sekretariat/berkas')) {
      return `https://mawar.smartpesantren.id/${cleanFotoName}`;
    }
    return `${baseUrl}${cleanFotoName}`;
  };

  // Form State for Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingAlumni, setEditingAlumni] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    alumni_id: '',
    nama: '',
    nis: '',
    nik: '',
    no_hp: '',
    alamat: '',
    tahun_masuk: '',
    tahun_keluar: '',
    status_keluar: 'Lulus',
    jenis_kelamin: 'Laki-laki',
    kategori_mukim: 'PPM',
    keterangan: '',
    kamar: '',
    madin: '',
    quran: ''
  });

  const fetchAlumni = async () => {
    setLoading(true);
    try {
      let url = `/api/alumni?search=${encodeURIComponent(search)}`;
      if (filterKategori) url += `&kategori=${encodeURIComponent(filterKategori)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setAlumni(data.data);
      } else {
        setErrorMsg(data.error || 'Gagal memuat data alumni');
      }
    } catch (e) {
      setErrorMsg('Gagal memuat data alumni due to network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlumni();
  }, [search, filterKategori]);

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedAlumni = [...alumni].sort((a, b) => {
    if (!sortConfig) return 0;
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];
    if (valA === null || valA === undefined) valA = '';
    if (valB === null || valB === undefined) valB = '';

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
  
  // Photo Viewer State
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const handleExport = (format: 'pdf' | 'excel' = 'pdf', previewOnly = false) => {
    if (sortedAlumni.length === 0) {
      alert('Tidak ada data untuk di-export.');
      return;
    }

    const title = 'DATA ALUMNI PP. TANWIRUL QULUB';
    const subtitle = `Total Alumni: ${sortedAlumni.length} | Pencarian: ${search || 'Semua'}`;
    const filename = `Data_Alumni_${new Date().getFullYear()}`;

    const tableColumn = ["NO", "NAMA LENGKAP", "NIS", "J. KELAMIN", "TAHUN MASUK", "TAHUN KELUAR", "STATUS"];
    const tableRows: any[] = [];

    sortedAlumni.forEach((item, idx) => {
      tableRows.push([
        idx + 1,
        item.nama || 'Tanpa Nama',
        item.nis || '-',
        item.jenis_kelamin || '-',
        item.tahun_masuk || '-',
        item.tahun_keluar || '-',
        item.status_keluar || 'Lulus'
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

  const handleOpenEditModal = (item: any) => {
    setEditingAlumni(item);
    
    let kamar = '';
    let madin = '';
    let quran = '';
    
    if (item.keterangan) {
      const parts = item.keterangan.split(' | ');
      parts.forEach((p: string) => {
        if (p.startsWith('Kamar: ')) kamar = p.replace('Kamar: ', '');
        else if (p.startsWith('Madin: ')) madin = p.replace('Madin: ', '');
        else if (p.startsWith("Qur'an: ")) quran = p.replace("Qur'an: ", '');
      });
    }

    setFormData({
      alumni_id: item.alumni_id.toString(),
      nama: item.nama || '',
      nis: item.nis || '',
      nik: item.nik || '',
      no_hp: item.no_hp || '',
      alamat: item.alamat || '',
      tahun_masuk: item.tahun_masuk ? item.tahun_masuk.toString() : '',
      tahun_keluar: item.tahun_keluar ? item.tahun_keluar.toString() : '',
      status_keluar: item.status_keluar || 'Lulus',
      jenis_kelamin: item.jenis_kelamin || 'Laki-laki',
      kategori_mukim: item.kategori_mukim || 'PPM',
      keterangan: item.keterangan || '',
      kamar,
      madin,
      quran
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parts = [];
      if (formData.kamar) parts.push(`Kamar: ${formData.kamar}`);
      if (formData.madin) parts.push(`Madin: ${formData.madin}`);
      if (formData.quran) parts.push(`Qur'an: ${formData.quran}`);
      const updatedKeterangan = parts.join(' | ');

      const res = await fetch('/api/alumni', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          keterangan: updatedKeterangan,
          tahun_masuk: formData.tahun_masuk ? parseInt(formData.tahun_masuk) : null,
          tahun_keluar: formData.tahun_keluar ? parseInt(formData.tahun_keluar) : null
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setShowModal(false);
        fetchAlumni();
      } else {
        alert(data.error || 'Gagal menyimpan perubahan');
      }
    } catch (err) {
      alert('Terjadi kesalahan jaringan saat menyimpan data');
    }
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus permanen data alumni: ${nama}?`)) return;
    if (!confirm(`Peringatan Kedua: Penghapusan data alumni ini bersifat permanen dan tidak dapat dipulihkan. Lanjutkan?`)) return;

    try {
      const res = await fetch(`/api/alumni?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchAlumni();
      } else {
        alert(data.error || 'Gagal menghapus data alumni');
      }
    } catch (err) {
      alert('Terjadi kesalahan jaringan saat menghapus data');
    }
  };

  const handleRestore = async (id: number, nama: string) => {
    if (!confirm(`Apakah Anda yakin ingin memulihkan kembali alumni: ${nama} menjadi Santri Aktif?`)) return;
    
    try {
      const res = await fetch('/api/alumni/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumni_id: id })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchAlumni();
      } else {
        alert(data.error || 'Gagal memulihkan data alumni');
      }
    } catch (err) {
      alert('Terjadi kesalahan jaringan saat memulihkan data');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/40 dark:to-emerald-950/30 rounded-3xl p-6 shadow-sm border border-green-200 dark:border-green-800/50 relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-green-200/50 dark:text-green-800/20">
          <GraduationCap size={120} />
        </div>
        <div className="relative z-10">
          <h1 className="text-2xl font-extrabold text-green-800 dark:text-green-400 drop-shadow-sm flex items-center gap-2">
            Manajemen Data Alumni
          </h1>
          <p className="text-green-600 dark:text-green-300 text-sm mt-1 font-medium max-w-lg">
            Daftar santri/murid yang telah diluluskan. Anda dapat mengedit data, menghapus permanen, atau memulihkan statusnya menjadi santri aktif.
          </p>
        </div>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-center font-bold">
          {errorMsg}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 md:p-5 border-b dark:border-gray-700">
            <div className="flex flex-col gap-4 mb-6">
              {/* Baris 1: Pencarian */}
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Cari nama atau NIS alumni..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-green-500 transition-all"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Baris 2: Dropdown Kategori */}
              <select
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-green-500 transition-all"
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
              >
                <option value="">Semua Kategori</option>
                <option value="PPM">PPM (Mukim)</option>
                <option value="LPPM">LPPM (Tidak Mukim)</option>
              </select>

              {/* Baris 3: Tombol Ekspor - Full Width di Mobile */}
              <div className="grid grid-cols-3 gap-2 w-full sm:flex sm:gap-2">
                <button onClick={() => handleExport('pdf', true)} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Preview PDF">
                  <FileText size={14} /> Preview
                </button>
                <button onClick={() => handleExport('pdf', false)} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors" title="Export PDF">
                  <Download size={14} /> PDF
                </button>
                <button onClick={() => handleExport('excel', false)} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors" title="Export Excel">
                  <Download size={14} /> Excel
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="px-5 py-4 w-10 text-center">NO</th>
                  <th className="px-5 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('nama')}>NAMA ALUMNI{getSortIcon('nama')}</th>
                  <th className="px-5 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('jenis_kelamin')}>J. KELAMIN{getSortIcon('jenis_kelamin')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none" onClick={() => requestSort('kategori_mukim')}>
                    Kategori{getSortIcon('kategori_mukim')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none" onClick={() => requestSort('tahun_masuk')}>TAHUN MASUK{getSortIcon('tahun_masuk')}</th>
                  <th className="px-5 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none text-center" onClick={() => requestSort('tahun_keluar')}>TAHUN KELUAR{getSortIcon('tahun_keluar')}</th>
                  <th className="px-5 py-4">KONTAK & ALAMAT</th>
                  <th className="px-5 py-4 text-center">STATUS</th>
                  <th className="px-5 py-4 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-10 animate-pulse text-green-600 font-bold">Memuat data alumni...</td></tr>
                ) : sortedAlumni.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-gray-500 font-medium">Tidak ada data alumni</td></tr>
                ) : (
                  sortedAlumni.map((item, idx) => (
                    <tr key={item.alumni_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-4 text-center text-gray-400 font-medium">{idx + 1}</td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 flex items-center justify-center text-xs font-bold overflow-hidden relative shrink-0">
                            <span className="absolute inset-0 flex items-center justify-center">
                              {(item.nama || 'AL').substring(0,2).toUpperCase()}
                            </span>
                            {item.foto && item.foto !== '-' && (
                              <img
                                src={getFotoUrl(item.foto)}
                                alt={item.nama}
                                className="absolute inset-0 w-full h-full object-cover z-10 cursor-pointer hover:scale-110 transition-transform duration-300"
                                onClick={() => setSelectedPhoto(getFotoUrl(item.foto))}
                                onError={(e) => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.display = 'none'; }}
                              />
                            )}
                          </div>
                          {item.nama}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono mt-1 ml-10 flex flex-col gap-0.5">
                          {item.nis && <span>NIS: {item.nis}</span>}
                          {item.keterangan && (
                            <span className="text-[10px] text-gray-500 font-sans italic">
                              Riwayat: {item.keterangan}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {item.jenis_kelamin || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {item.kategori_mukim === 'PPM' ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-md text-xs font-medium">PPM</span>
                        ) : item.kategori_mukim === 'LPPM' ? (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 rounded-md text-xs font-medium">LPPM</span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {item.tahun_masuk || '-'}
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-green-600 dark:text-green-400">
                        {item.tahun_keluar || '-'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-gray-800 dark:text-gray-300 font-medium">{item.no_hp || '-'}</div>
                        {item.alamat && <div className="text-xs text-gray-400 truncate max-w-xs">{item.alamat}</div>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 uppercase tracking-wider">
                          {item.status_keluar || 'Lulus'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center items-center gap-2">
                          <button
                            onClick={() => handleRestore(item.alumni_id, item.nama)}
                            className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 rounded-lg transition-colors"
                            title="Pulihkan kembali sebagai murid aktif"
                          >
                            <RotateCcw size={16} />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                            title="Edit data alumni"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.alumni_id, item.nama)}
                            className="p-2 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                            title="Hapus permanen data alumni"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Alumni Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            <div className="bg-green-600 px-6 py-4 flex justify-between items-center text-white shrink-0 rounded-t-3xl">
              <h3 className="font-bold">Edit Data Alumni</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-white/70 hover:text-white font-bold p-1">✕</button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nama Lengkap</label>
                <input required type="text" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">NIS (Nomor Induk)</label>
                  <input type="text" value={formData.nis} onChange={e => setFormData({...formData, nis: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">NIK (KTP/KK)</label>
                  <input type="text" value={formData.nik} onChange={e => setFormData({...formData, nik: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Tahun Masuk</label>
                  <input type="number" placeholder="Contoh: 2023" value={formData.tahun_masuk} onChange={e => setFormData({...formData, tahun_masuk: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Tahun Keluar/Lulus</label>
                  <input type="number" placeholder="Contoh: 2026" value={formData.tahun_keluar} onChange={e => setFormData({...formData, tahun_keluar: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nomor WhatsApp / HP</label>
                <input type="text" value={formData.no_hp} onChange={e => setFormData({...formData, no_hp: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Alamat Rumah</label>
                <textarea rows={2} value={formData.alamat} onChange={e => setFormData({...formData, alamat: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none resize-none" />
              </div>

              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/50">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Riwayat Pendidikan Terakhir</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Kelas Madin</label>
                    <input type="text" value={formData.madin} onChange={e => setFormData({...formData, madin: e.target.value})} placeholder="Contoh: 3 WUSTHO" className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Kelas Qur'an</label>
                    <input type="text" value={formData.quran} onChange={e => setFormData({...formData, quran: e.target.value})} placeholder="Contoh: Jilid 2" className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Kamar Asrama</label>
                    <input type="text" value={formData.kamar} onChange={e => setFormData({...formData, kamar: e.target.value})} placeholder="Contoh: B8 TQ 2" className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Jenis Kelamin</label>
                  <select value={formData.jenis_kelamin} onChange={e => setFormData({...formData, jenis_kelamin: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none">
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status Keluar</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                    value={formData.status_keluar}
                    onChange={e => setFormData({...formData, status_keluar: e.target.value})}
                  >
                    <option value="Lulus">Lulus</option>
                    <option value="Berhenti">Berhenti</option>
                    <option value="Dikeluarkan">Dikeluarkan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategori Mukim</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                  value={formData.kategori_mukim}
                  onChange={e => setFormData({...formData, kategori_mukim: e.target.value})}
                >
                  <option value="PPM">PPM (Mukim)</option>
                  <option value="LPPM">LPPM (Tidak Mukim)</option>
                </select>
              </div>

              <div className="pt-4 pb-2 flex gap-3 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl transition-colors">
                  Batal
                </button>
                <button type="submit" className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-600/30 transition-colors">
                  Simpan
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
                <FileText className="text-green-600" size={20} />
                Preview PDF Data Alumni
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
            <div className="hidden md:block flex-1 bg-gray-200 dark:bg-black/50 p-4 h-full">
              <iframe 
                src={pdfUrl} 
                className="w-full h-full rounded-xl shadow-inner bg-white"
                title="PDF Preview"
                style={{ minHeight: '60vh' }}
              />
            </div>
            <div className="flex md:hidden flex-1 flex-col items-center justify-center gap-5 p-8 bg-gray-50 dark:bg-gray-900/50">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
                <FileText size={40} className="text-green-600" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">Preview PDF tidak tersedia di HP</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Browser HP Anda tidak mendukung tampilan PDF secara tertanam. Silakan gunakan tombol di bawah untuk mengunduh.</p>
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

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setSelectedPhoto(null)}
        >
          <button 
            className="absolute top-4 right-4 md:top-6 md:right-6 text-white/70 hover:text-white p-2 z-[111] transition-colors"
            onClick={() => setSelectedPhoto(null)}
            title="Tutup (Esc)"
          >
            <X size={32} />
          </button>
          <img 
            src={selectedPhoto} 
            alt="Foto Full Screen" 
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl animate-[zoomIn_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
