'use client';

import { useState, useEffect, useRef } from 'react';
import { CalendarDays, Clock, MapPin, User, Edit, CheckSquare, FileText, Download, Upload, X, Search, ChevronDown } from 'lucide-react';
import { downloadTemplate } from '@/lib/downloadTemplate';

export default function JadwalPage() {
  const [jadwal, setJadwal] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('murid');
  const [rooms, setRooms] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'quran' | 'madin' | 'kegiatan'>('quran');

  const [selectedJadwal, setSelectedJadwal] = useState<number[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [filterGuru, setFilterGuru] = useState('');
  const [filterGuruSearch, setFilterGuruSearch] = useState('');
  const [showFilterGuruDropdown, setShowFilterGuruDropdown] = useState(false);
  const filterGuruDropdownRef = useRef<HTMLDivElement>(null);

  const [filterTempat, setFilterTempat] = useState('');
  const [filterTempatSearch, setFilterTempatSearch] = useState('');
  const [showFilterTempatDropdown, setShowFilterTempatDropdown] = useState(false);
  const filterTempatDropdownRef = useRef<HTMLDivElement>(null);

  const [waktuFilter, setWaktuFilter] = useState<'semua' | 'pagi' | 'siang' | 'sore' | 'malam'>('semua');

  const [bulkHari, setBulkHari] = useState('');
  const [bulkJamMulai, setBulkJamMulai] = useState('');
  const [bulkJamSelesai, setBulkJamSelesai] = useState('');
  const [savingBulk, setSavingBulk] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingJadwal, setEditingJadwal] = useState<any>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const [newJadwal, setNewJadwal] = useState({
    hari: 'Senin',
    jam_mulai: '',
    jam_selesai: '',
    kegiatan: '',
    tempat_id: '',
    guru_id: ''
  });
  const [tempatOptions, setTempatOptions] = useState<any[]>([]);
  const [guruOptions, setGuruOptions] = useState<any[]>([]);

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
      formData.append('type', `jadwal_${activeTab}`);
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

  // Searchable Dropdown States & Refs
  const [guruSearchAdd, setGuruSearchAdd] = useState('');
  const [showGuruDropdownAdd, setShowGuruDropdownAdd] = useState(false);
  const guruDropdownRefAdd = useRef<HTMLDivElement>(null);

  const [guruSearchEdit, setGuruSearchEdit] = useState('');
  const [showGuruDropdownEdit, setShowGuruDropdownEdit] = useState(false);
  const guruDropdownRefEdit = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (guruDropdownRefAdd.current && !guruDropdownRefAdd.current.contains(e.target as Node)) {
        setShowGuruDropdownAdd(false);
      }
      if (guruDropdownRefEdit.current && !guruDropdownRefEdit.current.contains(e.target as Node)) {
        setShowGuruDropdownEdit(false);
      }
      if (filterGuruDropdownRef.current && !filterGuruDropdownRef.current.contains(e.target as Node)) {
        setShowFilterGuruDropdown(false);
      }
      if (filterTempatDropdownRef.current && !filterTempatDropdownRef.current.contains(e.target as Node)) {
        setShowFilterTempatDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchOptions = async () => {
    try {
      const resTempat = await fetch(`/api/kelas?type=${activeTab === 'kegiatan' ? 'kamar' : activeTab}`);
      const dataTempat = await resTempat.json();
      if (dataTempat.success) setTempatOptions(dataTempat.data);

      const resGuru = await fetch('/api/kelas?type=guru');
      const dataGuru = await resGuru.json();
      if (dataGuru.success) setGuruOptions(dataGuru.data);
    } catch (e) {}
  };

  const handleOpenAddModal = () => {
    setNewJadwal({ hari: 'Senin', jam_mulai: '', jam_selesai: '', kegiatan: '', tempat_id: '', guru_id: '' });
    fetchOptions();
    setIsAddModalOpen(true);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAdd(true);
    try {
      const payload = { ...newJadwal, tipe: activeTab };
      const res = await fetch('/api/jadwal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setIsAddModalOpen(false);
        fetchData();
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Gagal menambah jadwal');
    } finally {
      setSavingAdd(false);
    }
  };

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success) setRole(data.user.role);
      } catch (err) { }
    };
    fetchMe();
    fetchData();
  }, []);

  // Roles yang selalu melihat semua 3 tab jadwal (terlepas dari data)
  const isFullTabRole = ['admin', 'staff'].includes(role);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jadwal');
      const json = await res.json();
      if (json.success) setJadwal(json.data);

      // Fetch rooms for kegiatan asrama matching
      const resRooms = await fetch('/api/kelas?type=kamar');
      const dataRooms = await resRooms.json();
      if (dataRooms.success) setRooms(dataRooms.data);
    } catch (err) {
      console.error('Failed to fetch jadwal:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compute available tabs
  // - admin & staff: selalu lihat semua 3 tab
  // - pengasuh: tabs muncul otomatis sesuai data yang dikembalikan backend (sudah difilter per asrama)
  // - role lain: tabs muncul hanya jika ada datanya
  const availableTabs = (['quran', 'madin', 'kegiatan'] as const).filter((tipe) => {
    if (isFullTabRole) return true;
    return jadwal.some((j) => j.tipe === tipe);
  });

  // Auto-switch activeTab if current tab not available
  useEffect(() => {
    if (loading || isFullTabRole) return;
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [loading, jadwal, role]);

  const matchesWaktuFilter = (jamMulai: string | undefined, filter: 'semua' | 'pagi' | 'siang' | 'sore' | 'malam') => {
    if (filter === 'semua') return true;
    if (!jamMulai) return false;
    const timeStr = jamMulai.substring(0, 5);

    if (filter === 'pagi') {
      return timeStr > '00:00' && timeStr <= '06:00';
    } else if (filter === 'siang') {
      return timeStr > '06:00' && timeStr <= '12:00';
    } else if (filter === 'sore') {
      return timeStr > '12:00' && timeStr <= '18:00';
    } else if (filter === 'malam') {
      return (timeStr > '18:00' && timeStr <= '23:59') || timeStr === '00:00';
    }
    return true;
  };

  const filteredJadwal = jadwal.filter(j => {
    return j.tipe === activeTab &&
           (filterGuru === '' || j.guru === filterGuru) &&
           (filterTempat === '' || j.tempat === filterTempat) &&
           matchesWaktuFilter(j.jam_mulai, waktuFilter);
  });

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const hariOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'];

  const sortedJadwal = [...filteredJadwal].sort((a, b) => {
    if (!sortConfig) return 0;
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];

    if (sortConfig.key === 'hari') {
      const idxA = hariOrder.indexOf(valA);
      const idxB = hariOrder.indexOf(valB);
      return sortConfig.direction === 'ascending' ? idxA - idxB : idxB - idxA;
    }

    if (valA === null || valA === undefined) valA = '';
    if (valB === null || valB === undefined) valB = '';

    const compareResult = valA.toString().localeCompare(valB.toString(), undefined, { numeric: true, sensitivity: 'base' });
    return sortConfig.direction === 'ascending' ? compareResult : -compareResult;
  });

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return ' ⇅';
    return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  };

  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  const handleExport = (format: 'pdf' | 'excel' = 'pdf', previewOnly = false) => {
    let exportData = filteredJadwal;
    
    if (!sortConfig) {
       exportData = [...filteredJadwal].sort((a, b) => {
         const hariDiff = hariOrder.indexOf(a.hari) - hariOrder.indexOf(b.hari);
         if (hariDiff !== 0) return hariDiff;
         return a.jam_mulai.localeCompare(b.jam_mulai);
       });
    } else {
       exportData = sortedJadwal;
    }

    if (selectedJadwal.length > 0) {
      exportData = exportData.filter(j => selectedJadwal.includes(j.id));
    }

    if (exportData.length === 0) {
      alert('Tidak ada data untuk di-export.');
      return;
    }

    const title = `JADWAL ${activeTab === 'quran' ? "AL-QUR'AN" : activeTab === 'madin' ? 'MADRASAH DINIYAH' : 'KEGIATAN ASRAMA'}`;
    const subtitle = `Filter Guru: ${filterGuru || 'Semua'} | Filter Kelas/Kamar: ${filterTempat || 'Semua'} | Waktu: ${waktuFilter === 'semua' ? 'Semua Waktu' : waktuFilter.toUpperCase()} | ${selectedJadwal.length > 0 ? `Export Terpilih (${selectedJadwal.length})` : 'Semua Data'}`;
    const filename = `Jadwal_${activeTab}`;

    const tableColumn = ["NO", "HARI", "JAM", "KEGIATAN", "TEMPAT", "GURU"];
    const tableRows: any[] = [];

    exportData.forEach((item, idx) => {
      tableRows.push([
        idx + 1,
        item.hari || '-',
        `${item.jam_mulai?.substring(0, 5) || '-'} s/d ${item.jam_selesai?.substring(0, 5) || '-'}`,
        item.kegiatan || '-',
        item.tempat || '-',
        item.guru || '-'
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

  const uniqueGurus = Array.from(new Set(jadwal.map(j => j.guru).filter(Boolean))).sort();
  const uniqueTempat = Array.from(new Set(jadwal.filter(j => j.tipe === activeTab).map(j => j.tempat).filter(Boolean))).sort((a: any, b: any) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const groupedJadwal = filteredJadwal.reduce((acc: any, curr: any) => {
    if (!acc[curr.hari]) acc[curr.hari] = [];
    acc[curr.hari].push(curr);
    return acc;
  }, {});

  const sortedHari = Object.keys(groupedJadwal).sort((a, b) => hariOrder.indexOf(a) - hariOrder.indexOf(b));

  const toggleSelectAll = () => {
    if (selectedJadwal.length === filteredJadwal.length) {
      setSelectedJadwal([]);
    } else {
      setSelectedJadwal(filteredJadwal.map(j => j.id));
    }
  };

  const toggleSelect = (id: number) => {
    if (selectedJadwal.includes(id)) {
      setSelectedJadwal(selectedJadwal.filter(i => i !== id));
    } else {
      setSelectedJadwal([...selectedJadwal, id]);
    }
  };

  const handleEditClick = (item: any) => {
    setEditingJadwal({
      ...item,
      jam_mulai: item.jam_mulai?.substring(0, 5) || '',
      jam_selesai: item.jam_selesai?.substring(0, 5) || '',
      tempat_id: item.tempat_id || '',
      guru_id: item.guru_id || ''
    });
    fetchOptions();
    setIsEditModalOpen(true);
  };
  const handleOpenEditModal = handleEditClick;

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      const payload = {
        ids: [editingJadwal.id],
        tipe: activeTab,
        hari: editingJadwal.hari,
        jam_mulai: editingJadwal.jam_mulai + (editingJadwal.jam_mulai.length === 5 ? ':00' : ''),
        jam_selesai: editingJadwal.jam_selesai + (editingJadwal.jam_selesai.length === 5 ? ':00' : ''),
        kegiatan: editingJadwal.kegiatan,
        tempat_id: editingJadwal.tempat_id,
        guru_id: editingJadwal.guru_id || null
      };

      const res = await fetch('/api/jadwal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setIsEditModalOpen(false);
        fetchData();
      } else {
        alert(data.error || 'Gagal menyimpan perubahan');
      }
    } catch (e) {
      alert('Gagal menyimpan perubahan');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedJadwal.length === 0) return;
    setSavingBulk(true);
    try {
      const payload: any = {
        ids: selectedJadwal,
        tipe: activeTab
      };
      if (bulkHari) payload.hari = bulkHari;
      if (bulkJamMulai) payload.jam_mulai = bulkJamMulai + (bulkJamMulai.length === 5 ? ':00' : '');
      if (bulkJamSelesai) payload.jam_selesai = bulkJamSelesai + (bulkJamSelesai.length === 5 ? ':00' : '');

      const res = await fetch('/api/jadwal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setIsBulkModalOpen(false);
        setSelectedJadwal([]);
        fetchData();
      } else {
        alert(data.error || 'Gagal memperbarui jadwal secara massal');
      }
    } catch (e) {
      alert('Gagal memperbarui jadwal secara massal');
    } finally {
      setSavingBulk(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-green-950 dark:from-emerald-950 dark:via-teal-950 dark:to-gray-900 p-6 md:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-3">
              <CalendarDays size={28} /> Jadwal Kegiatan
            </h1>
            <p className="text-green-600 dark:text-green-300 text-sm mt-1 font-medium max-w-md">
              Manajemen dan Informasi lengkap jadwal Anda.
            </p>
          </div>
          <div className="flex flex-wrap w-full md:w-auto gap-2 self-start md:self-center">
            <button onClick={() => handleExport('pdf', true)} className="flex-1 md:flex-none justify-center px-3 py-2 bg-white/10 text-white border border-white/20 rounded-xl text-xs font-bold hover:bg-white/20 transition-colors flex items-center gap-1.5" title="Preview PDF">
              <FileText size={14} /> Preview
            </button>
            <button onClick={() => handleExport('pdf', false)} className="flex-1 md:flex-none justify-center px-3 py-2 bg-red-600 text-white border border-red-500 rounded-xl text-xs font-bold hover:bg-red-700 transition-colors flex items-center gap-1.5" title="Export PDF">
              <Download size={14} /> PDF
            </button>
            <button onClick={() => handleExport('excel', false)} className="flex-1 md:flex-none justify-center px-3 py-2 bg-green-600 text-white border border-green-500 rounded-xl text-xs font-bold hover:bg-green-700 transition-colors flex items-center gap-1.5" title="Export Excel">
              <Download size={14} /> Excel
            </button>
            {(role === 'admin' || role === 'staff') && (
              <>
                <button
                  onClick={() => downloadTemplate(`jadwal_${activeTab}` as any)}
                  className="flex-1 md:flex-none justify-center px-3 py-2 bg-white text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-colors flex items-center gap-1.5"
                >
                  <Download size={14} /> Templat
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex-1 md:flex-none justify-center px-3 py-2 bg-white text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-colors flex items-center gap-1.5"
                >
                  <Upload size={14} /> Impor
                </button>
                <button onClick={handleOpenAddModal} className="bg-white hover:bg-emerald-50 text-emerald-900 font-bold px-3 py-2 rounded-xl text-sm transition-colors flex items-center justify-center gap-1" title="Tambah Jadwal">
                  <span className="hidden sm:inline">+ Tambah Jadwal</span>
                  <span className="sm:hidden text-lg leading-none">+</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs — Only show tabs relevant to the user's schedules (admin/staff see all) */}
      {availableTabs.length > 0 && (
        <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
          {availableTabs.includes('quran') && (
            <button onClick={() => { setActiveTab('quran'); setSelectedJadwal([]); setFilterTempat(''); setFilterTempatSearch(''); }} className={`flex-1 min-w-[120px] py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'quran' ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>Kelas Qur'an</button>
          )}
          {availableTabs.includes('madin') && (
            <button onClick={() => { setActiveTab('madin'); setSelectedJadwal([]); setFilterTempat(''); setFilterTempatSearch(''); }} className={`flex-1 min-w-[120px] py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'madin' ? 'bg-teal-500 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>Kelas Madin</button>
          )}
          {availableTabs.includes('kegiatan') && (
            <button onClick={() => { setActiveTab('kegiatan'); setSelectedJadwal([]); setFilterTempat(''); setFilterTempatSearch(''); }} className={`flex-1 min-w-[120px] py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'kegiatan' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>Kegiatan Asrama</button>
          )}
        </div>
      )}

      {/* Filter Controls: Filter Guru & Filter Kelas / Kamar */}
      <div className="relative z-20 flex flex-col md:flex-row gap-4 items-start md:items-center bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        {/* Filter Guru */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center w-full md:w-auto">
          <label className="text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2 shrink-0">
            <User size={16} /> Filter Guru:
          </label>
          <div className="relative w-full sm:w-60 shrink-0" ref={filterGuruDropdownRef}>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={filterGuru || 'Semua Guru'}
                value={filterGuruSearch}
                onChange={e => { setFilterGuruSearch(e.target.value); setShowFilterGuruDropdown(true); }}
                onFocus={() => setShowFilterGuruDropdown(true)}
                className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
              />
              {filterGuru && (
                <button
                  type="button"
                  onClick={() => { setFilterGuru(''); setFilterGuruSearch(''); setShowFilterGuruDropdown(false); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {showFilterGuruDropdown && (
              <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl">
                <button
                  type="button"
                  onClick={() => { setFilterGuru(''); setFilterGuruSearch(''); setShowFilterGuruDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors ${
                    !filterGuru ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Semua Guru
                </button>
                {uniqueGurus
                  .filter((g: any) => g.toLowerCase().includes(filterGuruSearch.toLowerCase()))
                  .map((g: any) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => { setFilterGuru(g); setFilterGuruSearch(''); setShowFilterGuruDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors ${
                        filterGuru === g ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {g}
                    </button>
                  ))
                }
              </div>
            )}
          </div>
        </div>

        {/* Filter Kelas / Kamar */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center w-full md:w-auto">
          <label className="text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2 shrink-0">
            <MapPin size={16} /> Filter {activeTab === 'kegiatan' ? 'Kamar' : 'Kelas'}:
          </label>
          <div className="relative w-full sm:w-60 shrink-0" ref={filterTempatDropdownRef}>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={filterTempat || `Semua ${activeTab === 'kegiatan' ? 'Kamar' : 'Kelas'}`}
                value={filterTempatSearch}
                onChange={e => { setFilterTempatSearch(e.target.value); setShowFilterTempatDropdown(true); }}
                onFocus={() => setShowFilterTempatDropdown(true)}
                className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
              />
              {filterTempat && (
                <button
                  type="button"
                  onClick={() => { setFilterTempat(''); setFilterTempatSearch(''); setShowFilterTempatDropdown(false); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {showFilterTempatDropdown && (
              <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl">
                <button
                  type="button"
                  onClick={() => { setFilterTempat(''); setFilterTempatSearch(''); setShowFilterTempatDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors ${
                    !filterTempat ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Semua {activeTab === 'kegiatan' ? 'Kamar' : 'Kelas'}
                </button>
                {uniqueTempat
                  .filter((t: any) => t.toLowerCase().includes(filterTempatSearch.toLowerCase()))
                  .map((t: any) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setFilterTempat(t); setFilterTempatSearch(''); setShowFilterTempatDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors ${
                        filterTempat === t ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Waktu Filter */}
      <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-2">
        {/* Tab Semua Waktu (full width top) */}
        <button
          onClick={() => setWaktuFilter('semua')}
          className={`w-full py-2.5 px-4 text-xs sm:text-sm font-bold rounded-xl transition-all text-center flex items-center justify-center gap-2 ${
            waktuFilter === 'semua'
              ? 'bg-slate-700 dark:bg-slate-600 text-white shadow-md'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
          }`}
        >
          ✨ Semua Waktu
        </button>

        {/* 4 Tab Berdampingan Rapi (grid 4 kolom) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { key: 'pagi', label: '🌅 Pagi (jam 00.01 - 06.00)' },
            { key: 'siang', label: '☀️ Siang (jam 06.01 - 12.00)' },
            { key: 'sore', label: '🌇 Sore (jam 12.01 - 18.00)' },
            { key: 'malam', label: '🌙 Malam (jam 18.01 - 00.00)' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setWaktuFilter(key as any)}
              className={`py-2.5 px-2 text-xs font-bold rounded-xl transition-all text-center flex items-center justify-center ${
                waktuFilter === key
                  ? 'bg-slate-700 dark:bg-slate-600 text-white shadow-md'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 bg-gray-50/50 dark:bg-gray-900/30'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {(role === 'admin' || role === 'staff') && selectedJadwal.length > 0 && (
        <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
          <button onClick={() => { setBulkHari(''); setBulkJamMulai(''); setBulkJamSelesai(''); setIsBulkModalOpen(true); }} className="px-3 py-2.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1.5">
            <CheckSquare size={14} /> Edit Jam/Hari Massal ({selectedJadwal.length})
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Memuat jadwal...</div>
      ) : availableTabs.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm text-center">
          <p className="text-gray-500 dark:text-gray-400">Anda belum memiliki jadwal kegiatan yang terdaftar.</p>
        </div>
      ) : filteredJadwal.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm text-center">
          <p className="text-gray-500 dark:text-gray-400">Tidak ada jadwal {activeTab} yang terdaftar.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  {(role === 'admin' || role === 'staff') && (
                    <th className="px-4 py-4 w-12 text-center">
                      <input type="checkbox" className="rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer" checked={selectedJadwal.length === filteredJadwal.length && filteredJadwal.length > 0} onChange={toggleSelectAll} />
                    </th>
                  )}
                  <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('hari')}>HARI{getSortIcon('hari')}</th>
                  <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('jam_mulai')}>JAM{getSortIcon('jam_mulai')}</th>
                  <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('kegiatan')}>MAJLIS / MAPEL / KEGIATAN{getSortIcon('kegiatan')}</th>
                  <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('tempat')}>KELAS / KAMAR{getSortIcon('tempat')}</th>
                  <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('guru')}>GURU{getSortIcon('guru')}</th>
                  {(role === 'admin' || role === 'staff') && (
                    <th className="px-4 py-4 text-center">AKSI</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sortConfig !== null ? (
                  sortedJadwal.map((item: any, idx: number) => (
                    <tr key={`${item.id}-${idx}`} className={`transition-colors text-gray-700 dark:text-gray-200 ${selectedJadwal.includes(item.id) ? 'bg-green-50/50 dark:bg-green-900/20' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/50'}`}>
                      {(role === 'admin' || role === 'staff') && (
                        <td className="px-4 py-3 text-center">
                          <input type="checkbox" className="rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer" checked={selectedJadwal.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                        </td>
                      )}
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                        {item.hari}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs font-medium">
                          <Clock size={14} className="text-orange-500" />
                          {item.jam_mulai.substring(0, 5)} - {item.jam_selesai.substring(0, 5)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold">{item.kegiatan}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs">
                          <MapPin size={14} className="text-blue-500" /> {item.tempat || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs">
                          <User size={14} className="text-purple-500" /> {item.guru || '-'}
                        </span>
                      </td>
                      {(role === 'admin' || role === 'staff') && (
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleEditClick(item)} className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors" title="Edit Jadwal">
                            <Edit size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  sortedHari.flatMap(hari =>
                    groupedJadwal[hari].sort((a: any, b: any) => a.jam_mulai.localeCompare(b.jam_mulai)).map((item: any, idx: number) => (
                      <tr key={`${item.id}-${idx}`} className={`transition-colors text-gray-700 dark:text-gray-200 ${selectedJadwal.includes(item.id) ? 'bg-green-50/50 dark:bg-green-900/20' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/50'}`}>
                        {(role === 'admin' || role === 'staff') && (
                          <td className="px-4 py-3 text-center">
                            <input type="checkbox" className="rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer" checked={selectedJadwal.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                          </td>
                        )}
                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                          {hari}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-xs font-medium">
                            <Clock size={14} className="text-orange-500" />
                            {item.jam_mulai.substring(0, 5)} - {item.jam_selesai.substring(0, 5)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold">{item.kegiatan}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-xs">
                            <MapPin size={14} className="text-blue-500" /> {item.tempat || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-xs">
                            <User size={14} className="text-purple-500" /> {item.guru || '-'}
                          </span>
                        </td>
                        {(role === 'admin' || role === 'staff') && (
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleEditClick(item)} className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors" title="Edit Jadwal">
                              <Edit size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Mass Edit */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 bg-indigo-600 text-white">
              <h2 className="text-lg font-bold">Edit Massal ({selectedJadwal.length} Jadwal)</h2>
              <p className="text-xs opacity-90 mt-1">Kosongkan field yang tidak ingin diubah.</p>
            </div>
            <form onSubmit={handleSaveBulk} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Hari</label>
                <select value={bulkHari} onChange={(e) => setBulkHari(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <option value="">-- Biarkan --</option>
                  {hariOrder.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Jam Mulai</label>
                  <input type="time" value={bulkJamMulai} onChange={(e) => setBulkJamMulai(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Jam Selesai</label>
                  <input type="time" value={bulkJamSelesai} onChange={(e) => setBulkJamSelesai(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsBulkModalOpen(false)} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Batal</button>
                <button type="submit" disabled={savingBulk || (!bulkHari && !bulkJamMulai && !bulkJamSelesai)} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Single Edit */}
      {isEditModalOpen && editingJadwal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 bg-indigo-600 text-white">
              <h2 className="text-lg font-bold">Edit Jadwal</h2>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Hari</label>
                <select value={editingJadwal.hari} onChange={(e) => setEditingJadwal({ ...editingJadwal, hari: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg" required>
                  {hariOrder.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Jam Mulai</label>
                  <input type="time" value={editingJadwal.jam_mulai.substring(0, 5)} onChange={(e) => setEditingJadwal({ ...editingJadwal, jam_mulai: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Jam Selesai</label>
                  <input type="time" value={editingJadwal.jam_selesai.substring(0, 5)} onChange={(e) => setEditingJadwal({ ...editingJadwal, jam_selesai: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Kegiatan / Mapel</label>
                <input type="text" value={editingJadwal.kegiatan} onChange={(e) => setEditingJadwal({ ...editingJadwal, kegiatan: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Kelas / Kamar (Tempat)</label>
                <select
                  value={editingJadwal.tempat_id || ''}
                  onChange={(e) => setEditingJadwal({ ...editingJadwal, tempat_id: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs"
                >
                  <option value="">-- Pilih Tempat --</option>
                  {tempatOptions.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}
                </select>
              </div>
              <div className="relative" ref={guruDropdownRefEdit}>
                <label className="block text-xs font-bold text-gray-500 mb-1">Guru Pengajar</label>
                
                {/* Search Input */}
                <div className="flex items-center px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-t-lg">
                  <Search className="text-gray-400 mr-2" size={13} />
                  <input
                    type="text"
                    placeholder="Ketik nama guru..."
                    value={guruSearchEdit}
                    onChange={e => setGuruSearchEdit(e.target.value)}
                    onFocus={() => setShowGuruDropdownEdit(true)}
                    className="flex-1 bg-transparent text-xs text-gray-700 dark:text-gray-200 outline-none placeholder-gray-400 w-full"
                    autoComplete="off"
                  />
                  {guruSearchEdit && (
                    <button type="button" onClick={() => setGuruSearchEdit('')} className="text-gray-400 hover:text-red-400">
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Selected Display Dropdown */}
                <div
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-b-lg text-xs text-gray-700 dark:text-gray-200 cursor-pointer flex justify-between items-center"
                  onClick={() => setShowGuruDropdownEdit(v => !v)}
                >
                  <span className={editingJadwal.guru_id ? '' : 'text-gray-400'}>
                    {editingJadwal.guru_id
                      ? (() => {
                          const guru = guruOptions.find(g => g.id.toString() === editingJadwal.guru_id.toString());
                          return guru ? guru.nama : '-- Tidak Ada / Kosong --';
                        })()
                      : '-- Tidak Ada / Kosong --'}
                  </span>
                  <ChevronDown size={13} className="text-gray-400" />
                </div>

                {showGuruDropdownEdit && (
                  <div className="absolute z-[200] w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl mt-1 max-h-56 overflow-y-auto">
                    <button
                      type="button"
                      onMouseDown={() => {
                        setEditingJadwal({ ...editingJadwal, guru_id: '' });
                        setShowGuruDropdownEdit(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-400 italic hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      -- Tidak Ada / Kosong --
                    </button>
                    {guruOptions
                      .filter(g =>
                        guruSearchEdit === '' ||
                        g.nama.toLowerCase().includes(guruSearchEdit.toLowerCase())
                      )
                      .map(g => (
                        <button
                          key={g.id}
                          type="button"
                          onMouseDown={() => {
                            setEditingJadwal({ ...editingJadwal, guru_id: g.id.toString() });
                            setShowGuruDropdownEdit(false);
                            setGuruSearchEdit('');
                          }}
                          className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                            editingJadwal.guru_id.toString() === g.id.toString()
                              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-semibold'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {g.nama}
                        </button>
                      ))}
                    {guruOptions.filter(g =>
                      guruSearchEdit === '' ||
                      g.nama.toLowerCase().includes(guruSearchEdit.toLowerCase())
                    ).length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-400 italic text-center">
                        Guru tidak ditemukan
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Batal</button>
                <button type="submit" disabled={savingEdit} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Add */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 bg-green-600 text-white">
              <h2 className="text-lg font-bold">Tambah Jadwal Baru</h2>
            </div>
            <form onSubmit={handleSaveAdd} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Hari</label>
                <select value={newJadwal.hari} onChange={(e) => setNewJadwal({ ...newJadwal, hari: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg" required>
                  {hariOrder.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Jam Mulai</label>
                  <input type="time" value={newJadwal.jam_mulai} onChange={(e) => setNewJadwal({ ...newJadwal, jam_mulai: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Jam Selesai</label>
                  <input type="time" value={newJadwal.jam_selesai} onChange={(e) => setNewJadwal({ ...newJadwal, jam_selesai: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Kegiatan / Mapel</label>
                <input type="text" value={newJadwal.kegiatan} onChange={(e) => setNewJadwal({ ...newJadwal, kegiatan: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Tempat (Kelas/Kamar)</label>
                <select value={newJadwal.tempat_id} onChange={(e) => setNewJadwal({ ...newJadwal, tempat_id: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg" required>
                  <option value="">-- Pilih Tempat --</option>
                  {tempatOptions.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}
                </select>
              </div>
              <div className="relative" ref={guruDropdownRefAdd}>
                <label className="block text-xs font-bold text-gray-500 mb-1">Guru Pengajar</label>
                
                {/* Search Input */}
                <div className="flex items-center px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-t-lg">
                  <Search className="text-gray-400 mr-2" size={13} />
                  <input
                    type="text"
                    placeholder="Ketik nama guru..."
                    value={guruSearchAdd}
                    onChange={e => setGuruSearchAdd(e.target.value)}
                    onFocus={() => setShowGuruDropdownAdd(true)}
                    className="flex-1 bg-transparent text-xs text-gray-700 dark:text-gray-200 outline-none placeholder-gray-400 w-full"
                    autoComplete="off"
                  />
                  {guruSearchAdd && (
                    <button type="button" onClick={() => setGuruSearchAdd('')} className="text-gray-400 hover:text-red-400">
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Selected Display Dropdown */}
                <div
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-b-lg text-xs text-gray-700 dark:text-gray-200 cursor-pointer flex justify-between items-center"
                  onClick={() => setShowGuruDropdownAdd(v => !v)}
                >
                  <span className={newJadwal.guru_id ? '' : 'text-gray-400'}>
                    {newJadwal.guru_id
                      ? (() => {
                          const guru = guruOptions.find(g => g.id.toString() === newJadwal.guru_id.toString());
                          return guru ? guru.nama : '-- Tidak Ada / Kosong --';
                        })()
                      : '-- Tidak Ada / Kosong --'}
                  </span>
                  <ChevronDown size={13} className="text-gray-400" />
                </div>

                {showGuruDropdownAdd && (
                  <div className="absolute z-[200] w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl mt-1 max-h-56 overflow-y-auto">
                    <button
                      type="button"
                      onMouseDown={() => {
                        setNewJadwal({ ...newJadwal, guru_id: '' });
                        setShowGuruDropdownAdd(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-400 italic hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      -- Tidak Ada / Kosong --
                    </button>
                    {guruOptions
                      .filter(g =>
                        guruSearchAdd === '' ||
                        g.nama.toLowerCase().includes(guruSearchAdd.toLowerCase())
                      )
                      .map(g => (
                        <button
                          key={g.id}
                          type="button"
                          onMouseDown={() => {
                            setNewJadwal({ ...newJadwal, guru_id: g.id.toString() });
                            setShowGuruDropdownAdd(false);
                            setGuruSearchAdd('');
                          }}
                          className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                            newJadwal.guru_id.toString() === g.id.toString()
                              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-semibold'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {g.nama}
                        </button>
                      ))}
                    {guruOptions.filter(g =>
                      guruSearchAdd === '' ||
                      g.nama.toLowerCase().includes(guruSearchAdd.toLowerCase())
                    ).length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-400 italic text-center">
                        Guru tidak ditemukan
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Batal</button>
                <button type="submit" disabled={savingAdd} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors">Simpan</button>
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
                <FileText className="text-green-500" size={20} />
                Preview PDF Jadwal
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
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
                <FileText size={40} className="text-green-500" />
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

      {/* Import Excel Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden">
            <div className="bg-green-600 dark:bg-green-900 p-5 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Upload size={20} /> Impor Jadwal {activeTab === 'madin' ? 'Madin' : activeTab === 'quran' ? "Qur'an" : 'Kegiatan'}
              </h2>
              <button onClick={() => { setIsImportModalOpen(false); setImportFile(null); }} className="text-white hover:text-gray-200"><X size={20} /></button>
            </div>
            <form onSubmit={handleImportExcel} className="p-6 space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                Silakan pilih file Excel (.xlsx) dengan kolom yang disesuaikan dengan templat.
                Sistem akan memvalidasi nama guru dan kelas/kamar secara otomatis, lalu memperbarui jadwal yang sama pada jam & hari tersebut agar tidak terjadi duplikasi.
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
                <Upload size={32} className="mx-auto text-green-600 mb-2" />
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
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
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
