'use client';

import { useState, useEffect } from 'react';
import { Users, ShieldAlert, Edit, Trash2, Plus, Search, Shield, UserCog, User, BookOpen, KeyRound, FileText, Download, X, Fingerprint } from 'lucide-react';
import Link from 'next/link';

export default function UsersManagementPage() {
  const [activeTab, setActiveTab] = useState('pengelola');
  const [users, setUsers] = useState<any[]>([]);
  const [kamarList, setKamarList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'admin',
    nama: '',
    nip: '',
    kamar_id: null as number | null
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users?role=${activeTab}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      } else {
        setErrorMsg(data.error);
      }
    } catch (e) {
      setErrorMsg('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const fetchKamarList = async () => {
    try {
      const res = await fetch('/api/kamar/list');
      const data = await res.json();
      if (data.success) {
        setKamarList(data.data);
      }
    } catch (e) {
      console.error('Failed to load kamar');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [activeTab]);

  const filteredUsers = users.filter(u => 
    u.nama?.toLowerCase().includes(search.toLowerCase()) || 
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedUsers = [...filteredUsers].sort((a, b) => {
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
    if (sortedUsers.length === 0) {
      alert('Tidak ada data untuk di-export.');
      return;
    }

    const title = 'DATA PENGGUNA SISTEM';
    const subtitle = `Filter Role: ${activeTab.toUpperCase()} | Pencarian: ${search || 'Semua'}`;
    const filename = `Data_Pengguna_${activeTab}`;

    const tableColumn = ["NO", "NAMA PENGGUNA", "USERNAME", "ROLE", "NIP"];
    const tableRows: any[] = [];

    sortedUsers.forEach((item, idx) => {
      tableRows.push([
        idx + 1,
        item.nama || 'User Tanpa Nama',
        item.username || '-',
        item.role || '-',
        item.nip || '-'
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

  const handleOpenModal = (user: any = null) => {
    if (user) {
      setEditingId(user.id);
      setFormData({
        username: user.username,
        password: '',
        role: user.role,
        nama: user.nama,
        nip: user.nip || '',
        kamar_id: user.kamar_id || null
      });
    } else {
      setEditingId(null);
      setFormData({
        username: '',
        password: '',
        role: activeTab === 'pengelola' ? 'staff' : activeTab,
        nama: '',
        nip: '',
        kamar_id: null
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { ...formData, id: editingId } : formData;

      const res = await fetch('/api/users', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (data.success) {
        alert(data.message);
        setShowModal(false);
        fetchUsers();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Terjadi kesalahan jaringan');
    }
  };

  const handleResetFingerprint = async (id: number, nama: string) => {
    if (!confirm(`Hapus/reset data sidik jari untuk ${nama}?`)) return;
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, reset_fingerprint: true })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchUsers();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Gagal mereset sidik jari');
    }
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!confirm(`Hapus permanen akun ${nama}? (Aksi ini tidak bisa dibatalkan)`)) return;
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Gagal menghapus');
    }
  };

  const tabs = [
    { id: 'pengelola', label: 'Pengelola (Admin/Staff)', icon: Shield },
    { id: 'pengurus_asrama', label: 'Pengurus Asrama', icon: ShieldAlert },
    { id: 'guru', label: 'Akun Guru', icon: UserCog },
    { id: 'wali_murid', label: 'Akun Wali Murid', icon: Users }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-indigo-900/40 dark:to-blue-900/40 rounded-3xl p-6 shadow-sm border border-indigo-200 dark:border-indigo-800/50 relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-indigo-200/50 dark:text-indigo-800/30">
          <KeyRound size={120} />
        </div>
        <div className="relative z-10">
          <h1 className="text-2xl font-extrabold text-indigo-800 dark:text-indigo-400 drop-shadow-sm flex items-center gap-2 font-theme-hero">
            Manajemen Pengguna
          </h1>
          <p className="text-indigo-600 dark:text-indigo-300 text-sm mt-1 font-medium max-w-md">
            Kelola hak akses, tambah akun, dan ubah password dari satu tempat.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold whitespace-nowrap transition-all ${
                isActive 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-indigo-50 dark:hover:bg-gray-700'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {errorMsg ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-center font-bold">
          {errorMsg}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 md:p-5 border-b dark:border-gray-700 flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Cari nama atau username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div className="flex gap-2 shrink-0 overflow-x-auto pb-2 sm:pb-0">
              <button onClick={() => handleExport('pdf', true)} className="px-3 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1.5 shrink-0" title="Preview PDF">
                <FileText size={14} /> Preview
              </button>
              <button onClick={() => handleExport('pdf', false)} className="px-3 py-2 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5 shrink-0" title="Export PDF">
                <Download size={14} /> PDF
              </button>
              <button onClick={() => handleExport('excel', false)} className="px-3 py-2 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors flex items-center gap-1.5 shrink-0" title="Export Excel">
                <Download size={14} /> Excel
              </button>

              {(activeTab === 'pengelola' || activeTab === 'guru' || activeTab === 'pengurus_asrama') && (
                <button
                  onClick={() => handleOpenModal()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl shadow-sm transition-transform hover:scale-105 flex items-center justify-center font-bold gap-2 shrink-0"
                  title={`Tambah ${activeTab === 'pengelola' ? 'Pengelola' : activeTab === 'pengurus_asrama' ? 'Pengurus Asrama' : 'Guru'}`}
                >
                  <Plus size={16} /> <span className="hidden sm:inline">Tambah</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="px-5 py-4 w-10 text-center">NO</th>
                  <th className="px-5 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('nama')}>INFORMASI AKUN{getSortIcon('nama')}</th>
                  <th className="px-5 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('username')}>USERNAME{getSortIcon('username')}</th>
                  <th className="px-5 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('role')}>ROLE{getSortIcon('role')}</th>
                  <th className="px-5 py-4 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-10 animate-pulse text-indigo-500 font-bold">Memuat...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-500 font-medium">Tidak ada data pengguna</td></tr>
                ) : (
                  sortedUsers.map((u, idx) => (
                    <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-4 text-center text-gray-400 font-medium">{idx + 1}</td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400 flex items-center justify-center text-xs">
                            {(u.nama || u.username || 'US').substring(0,2).toUpperCase()}
                          </div>
                          {u.nama || u.username || 'User Tanpa Nama'}
                        </div>
                        {u.nip && <div className="text-[11px] text-gray-400 font-mono mt-1 ml-10">NIP: {u.nip}</div>}
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {u.username}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          u.role === 'staff' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          u.role === 'guru' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        }`}>
                          {u.role.includes('asrama') ? u.role.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center items-center gap-2">
                          {u.has_fingerprint > 0 && (
                            <button onClick={() => handleResetFingerprint(u.id, u.nama || u.username)} title="Reset Sidik Jari" className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors">
                              <Fingerprint size={16} />
                            </button>
                          )}
                          <button onClick={() => handleOpenModal(u)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                            <Edit size={16} />
                          </button>
                          <button onClick={() => handleDelete(u.id, u.nama || u.username)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
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

      {/* Modal Tambah/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-bold">{editingId ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}</h3>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white"><Trash2 size={18} className="hidden" />Tutup</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nama Lengkap</label>
                <input required type="text" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Username</label>
                  <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Role/Jabatan</label>
                  <select 
                    required 
                    value={formData.role} 
                    onChange={e => {
                      setFormData({...formData, role: e.target.value, kamar_id: null});
                    }} 
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="" disabled>Pilih Role...</option>
                    {activeTab === 'pengelola' && (
                      <>
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                      </>
                    )}
                    {activeTab === 'pengurus_asrama' && (
                      <>
                        <option value="ketua_asrama_a">Ketua Asrama A</option>
                        <option value="staff_asrama_a">Staff Asrama A</option>
                        <option value="ketua_asrama_b">Ketua Asrama B</option>
                        <option value="staff_asrama_b">Staff Asrama B</option>
                        <option value="ketua_asrama_c">Ketua Asrama C</option>
                        <option value="staff_asrama_c">Staff Asrama C</option>
                        <option value="ketua_asrama_d">Ketua Asrama D</option>
                        <option value="staff_asrama_d">Staff Asrama D</option>
                        <option value="ketua_asrama_e">Ketua Asrama E</option>
                        <option value="staff_asrama_e">Staff Asrama E</option>
                        <option value="ketua_asrama_f">Ketua Asrama F</option>
                        <option value="staff_asrama_f">Staff Asrama F</option>
                      </>
                    )}
                    {activeTab === 'guru' && <option value="guru">Guru</option>}
                    {activeTab === 'wali_murid' && <option value="wali_murid">Wali Murid</option>}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Password {editingId && <span className="text-indigo-400 font-normal">(Kosongkan jika tidak ingin diubah)</span>}
                </label>
                <input type="password" required={!editingId} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl transition-colors">
                  Batal
                </button>
                <button type="submit" className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-colors">
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
                <FileText className="text-indigo-500" size={20} />
                Preview PDF Data Pengguna
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
