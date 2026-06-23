'use client';

import { useState, useEffect, useRef } from 'react';
import { CalendarDays, Clock, User, Plus, Edit2, Trash2, X, Check, BookOpen, AlertCircle, FileText, Download, Search, ChevronDown } from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';

interface Guru {
  id: number;
  nama: string;
  jenis_kelamin: 'Laki-laki' | 'Perempuan';
}

interface ClassOption {
  id: number;
  nama: string;
}

interface JadwalItem {
  id: number;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  kegiatan: string; // mata_pelajaran
  tempat: string; // nama_kelas
  tempat_id: number; // kelas_madin_id
  guru: string;
  guru_id: number;
  tipe: 'madin';
}

export default function JadwalMadinUmumPage() {
  const [jadwalList, setJadwalList] = useState<JadwalItem[]>([]);
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [role, setRole] = useState('murid');
  const [loading, setLoading] = useState(true);

  // Tabs
  const [genderMode, setGenderMode] = useState<'PUTRA' | 'PUTRI'>('PUTRA');
  const [levelTab, setLevelTab] = useState<'WUSTHO_MAK' | 'ULA' | 'WUSTHO'>('WUSTHO_MAK');

  // Edit/Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState({
    id: null as number | null,
    hari: '',
    kelas_id: 0,
    kelas_nama: '',
    kegiatan: '',
    guru_id: 0,
    jam_mulai: '20:00',
    jam_selesai: '21:00'
  });
  const [saving, setSaving] = useState(false);

  // Searchable guru dropdown state
  const [guruSearch, setGuruSearch] = useState('');
  const [showGuruDropdown, setShowGuruDropdown] = useState(false);
  const guruDropdownRef = useRef<HTMLDivElement>(null);

  // Kurikulum combobox state
  const [mapelSearch, setMapelSearch] = useState('');
  const [showMapelDropdown, setShowMapelDropdown] = useState(false);
  const [kurikulumList, setKurikulumList] = useState<string[]>([]);
  const mapelDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (guruDropdownRef.current && !guruDropdownRef.current.contains(e.target as Node)) {
        setShowGuruDropdown(false);
      }
      if (mapelDropdownRef.current && !mapelDropdownRef.current.contains(e.target as Node)) {
        setShowMapelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Days list according to images
  const DAYS = ['Jumat', 'Sabtu', 'Ahad', 'Senin', 'Selasa', 'Rabu'];

  // Column configuration mapping database class names to short display labels
  const putraWusthoMakCols = [
    { key: '1 WUSTHO (A) PUTRA', label: '1 Wus (A)' },
    { key: '1 WUSTHO (B) PUTRA', label: '1 Wus (B)' },
    { key: '2 WUSTHO PUTRA', label: '2 Wus' },
    { key: '3 WUSTHO PUTRA', label: '3 Wus' },
    { key: '1 MAK PUTRA', label: '1 MAK' },
    { key: '2 MAK PUTRA', label: '2 MAK' },
    { key: '3 MAK PUTRA', label: '3 MAK' }
  ];

  const putraUlaCols = [
    { key: '1 ULA (A) PUTRA', label: '1 Ula (A)' },
    { key: '1 ULA (B) PUTRA', label: '1 Ula (B)' },
    { key: '2 ULA (A) PUTRA', label: '2 Ula (A)' },
    { key: '2 ULA (B) PUTRA', label: '2 Ula (B)' },
    { key: '3 ULA (A) PUTRA', label: '3 Ula (A)' },
    { key: '3 ULA (B) PUTRA', label: '3 Ula (B)' }
  ];

  const putriWusthoCols = [
    { key: '1 WUSTHO (A) PUTRI', label: '1A' },
    { key: '1 WUSTHO (B) PUTRI', label: '1B' },
    { key: '1 WUSTHO (C) PUTRI', label: '1C' },
    { key: '1 WUSTHO (D) PUTRI', label: '1D' },
    { key: '2 WUSTHO (A) PUTRI', label: '2A' },
    { key: '2 WUSTHO (B) PUTRI', label: '2B' },
    { key: '2 WUSTHO (C) PUTRI', label: '2C' },
    { key: '3 WUSTHO (A) PUTRI', label: '3A' },
    { key: '3 WUSTHO (B) PUTRI', label: '3B' },
    { key: '3 WUSTHO (C) PUTRI', label: '3C' }
  ];

  const putriUlaCols = [
    { key: '1 ULA (A) PUTRI', label: '1A' },
    { key: '1 ULA (B) PUTRI', label: '1B' },
    { key: '1 ULA (C) PUTRI', label: '1C' },
    { key: '2 ULA (A) PUTRI', label: '2A' },
    { key: '2 ULA (B) PUTRI', label: '2B' },
    { key: '2 ULA (C) PUTRI', label: '2C' },
    { key: '3 ULA (A) PUTRI', label: '3A' },
    { key: '3 ULA (B) PUTRI', label: '3B' },
    { key: '3 ULA (C) PUTRI', label: '3C' }
  ];

  // Load levelTab appropriately based on gender mode
  useEffect(() => {
    if (genderMode === 'PUTRA') {
      setLevelTab('WUSTHO_MAK');
    } else {
      setLevelTab('WUSTHO');
    }
  }, [genderMode]);

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
      // Fetch Schedules
      const resJadwal = await fetch('/api/jadwal');
      const dataJadwal = await resJadwal.json();
      if (dataJadwal.success) {
        setJadwalList(dataJadwal.data.filter((j: any) => j.tipe === 'madin'));
      }

      // Fetch Teachers
      const resGuru = await fetch('/api/kelas?type=guru');
      const dataGuru = await resGuru.json();
      if (dataGuru.success) {
        setGurus(dataGuru.data);
      }

      // Fetch Classes
      const resKelas = await fetch('/api/kelas?type=madin');
      const dataKelas = await resKelas.json();
      if (dataKelas.success) {
        setClasses(dataKelas.data);
      }

      // Fetch Kurikulum for mapel suggestions
      const resKur = await fetch('/api/kurikulum');
      const dataKur = await resKur.json();
      if (dataKur.success && Array.isArray(dataKur.data)) {
        const mapelSet = new Set<string>();
        dataKur.data.forEach((item: any) => {
          if (item.mata_pelajaran) mapelSet.add(item.mata_pelajaran);
          if (item.kitab) mapelSet.add(item.kitab);
        });
        setKurikulumList(Array.from(mapelSet).sort());
      }
    } catch (err) {
      console.error('Gagal mengambil data:', err);
    } finally {
      setLoading(false);
    }
  };

  const isEditable = role === 'admin' || role === 'staff';

  // Filters teachers by active gender mode
  const activeGurus = gurus.filter((g) => {
    if (genderMode === 'PUTRA') {
      return g.jenis_kelamin === 'Laki-laki';
    } else {
      return g.jenis_kelamin === 'Perempuan';
    }
  });

  // Function to convert 1-based index to spreadsheet-like alphabet code: A, B, C... Z, AA, AB...
  const getTeacherCode = (index: number): string => {
    let code = '';
    let temp = index;
    while (temp > 0) {
      let remainder = (temp - 1) % 26;
      code = String.fromCharCode(65 + remainder) + code;
      temp = Math.floor((temp - remainder - 1) / 26);
    }
    return code;
  };

  // Generate lookup map for teacher codes
  const teacherCodeMap: { [id: number]: string } = {};
  activeGurus.forEach((g, idx) => {
    teacherCodeMap[g.id] = getTeacherCode(idx + 1);
  });

  // Get active columns config
  const getActiveCols = () => {
    if (genderMode === 'PUTRA') {
      return levelTab === 'WUSTHO_MAK' ? putraWusthoMakCols : putraUlaCols;
    } else {
      return levelTab === 'WUSTHO' ? putriWusthoCols : putriUlaCols;
    }
  };

  const activeCols = getActiveCols();

  // Find class ID and config in database classes
  const findClassDbObj = (colKey: string) => {
    return classes.find((c) => c.nama.toUpperCase() === colKey.toUpperCase());
  };

  const getDisplayMalam = (hari: string): string => {
    const mapping: { [key: string]: string } = {
      'Jumat': "Jum'at (Malam Sabtu)",
      'Sabtu': 'Sabtu (Malam Ahad)',
      'Ahad': 'Ahad (Malam Senin)',
      'Senin': 'Senin (Malam Selasa)',
      'Selasa': 'Selasa (Malam Rabu)',
      'Rabu': 'Rabu (Malam Kamis)'
    };
    return mapping[hari] || hari;
  };

  // Organize schedules in map by day & class ID
  const schedulesMap: { [key: string]: JadwalItem } = {};
  jadwalList.forEach((j) => {
    schedulesMap[`${j.hari}_${j.tempat_id}`] = j;
  });

  // Open Edit or Add Modal on cell click
  const handleCellClick = (hari: string, colKey: string, shortLabel: string) => {
    if (!isEditable) return;
    if (hari === 'Senin') return; // Senin is Ngaji Umum

    const classDbObj = findClassDbObj(colKey);
    if (!classDbObj) {
      alert(`Kelas "${colKey}" tidak ditemukan di database. Pastikan kelas sudah dibuat.`);
      return;
    }

    const existingJadwal = schedulesMap[`${hari}_${classDbObj.id}`];

    setModalData({
      id: existingJadwal ? existingJadwal.id : null,
      hari,
      kelas_id: classDbObj.id,
      kelas_nama: `${shortLabel} (${genderMode})`,
      kegiatan: existingJadwal ? existingJadwal.kegiatan : '',
      guru_id: existingJadwal ? existingJadwal.guru_id : 0,
      jam_mulai: existingJadwal ? existingJadwal.jam_mulai.substring(0, 5) : '20:00',
      jam_selesai: existingJadwal ? existingJadwal.jam_selesai.substring(0, 5) : '21:00'
    });

    setIsModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modalData.id) {
        // PUT request
        const res = await fetch('/api/jadwal', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: [modalData.id],
            tipe: 'madin',
            hari: modalData.hari,
            jam_mulai: modalData.jam_mulai + ':00',
            jam_selesai: modalData.jam_selesai + ':00',
            kegiatan: modalData.kegiatan,
            tempat_id: modalData.kelas_id,
            guru_id: modalData.guru_id || null
          })
        });
        const data = await res.json();
        if (data.success) {
          setIsModalOpen(false);
          fetchData();
        } else {
          alert(data.error || 'Gagal menyimpan');
        }
      } else {
        // POST request
        const res = await fetch('/api/jadwal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipe: 'madin',
            hari: modalData.hari,
            jam_mulai: modalData.jam_mulai + ':00',
            jam_selesai: modalData.jam_selesai + ':00',
            kegiatan: modalData.kegiatan,
            tempat_id: modalData.kelas_id,
            guru_id: modalData.guru_id || null
          })
        });
        const data = await res.json();
        if (data.success) {
          setIsModalOpen(false);
          fetchData();
        } else {
          alert(data.error || 'Gagal menambahkan');
        }
      }
    } catch (err) {
      alert('Gagal menghubungi server');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteJadwal = async () => {
    if (!modalData.id) return;
    if (!confirm('Apakah Anda yakin ingin menghapus jadwal ini?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/jadwal?id=${modalData.id}&tipe=madin`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        alert(data.error || 'Gagal menghapus');
      }
    } catch (err) {
      alert('Gagal menghubungi server');
    } finally {
      setSaving(false);
    }
  };

  // Export State
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  const handleExport = (format: 'pdf' | 'excel' = 'pdf', previewOnly = false) => {
    if (jadwalList.length === 0) {
      alert('Tidak ada data untuk di-export.');
      return;
    }

    const filteredJadwal = jadwalList.filter(j => {
      const classObj = classes.find(c => c.id === j.tempat_id);
      if (!classObj) return false;
      const isPutra = classObj.nama.toUpperCase().includes('PUTRA');
      return genderMode === 'PUTRA' ? isPutra : !isPutra;
    });

    const title = `JADWAL MADRASAH DINIYAH (${genderMode})`;
    const subtitle = `Tingkat: ${levelTab === 'WUSTHO_MAK' ? 'WUSTHO & MAK' : levelTab}`;
    const filename = `Jadwal_Madin_${genderMode}_${levelTab}`;

    const tableColumn = ["HARI", "JAM", "MATA PELAJARAN", "KELAS", "GURU"];
    const tableRows: any[] = [];

    const dayOrder = ['Jumat', 'Sabtu', 'Ahad', 'Senin', 'Selasa', 'Rabu'];
    const sortedExportData = [...filteredJadwal].sort((a, b) => {
      const dayDiff = dayOrder.indexOf(a.hari) - dayOrder.indexOf(b.hari);
      if (dayDiff !== 0) return dayDiff;
      return a.jam_mulai.localeCompare(b.jam_mulai);
    });

    sortedExportData.forEach((item) => {
      const teacherName = gurus.find(g => g.id === item.guru_id)?.nama || '-';
      const classLabel = classes.find(c => c.id === item.tempat_id)?.nama || '-';
      tableRows.push([
        item.hari,
        `${item.jam_mulai.substring(0, 5)} - ${item.jam_selesai.substring(0, 5)}`,
        item.kegiatan,
        classLabel,
        teacherName
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
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/40 dark:to-emerald-950/40 rounded-3xl p-6 border border-green-200 dark:border-green-900/50 relative overflow-hidden transition-all duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-green-200/50 dark:text-green-900/20">
          <CalendarDays size={120} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-green-800 dark:text-green-400 drop-shadow-sm flex items-center gap-2">
              <CalendarDays size={28} /> Jadwal Madin Umum
            </h1>
            <p className="text-green-600 dark:text-green-300 text-sm mt-1 font-medium max-w-md">
              Sinkronisasi spreadsheet jadwal mingguan pelajaran Madrasah Diniyah Matholi'ul Anwar.
            </p>
          </div>
          <div className="flex gap-2 self-start md:self-center">
            <button onClick={() => handleExport('pdf', true)} className="px-3 py-2 bg-white/85 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 border border-green-200 dark:border-green-800 rounded-xl text-xs font-bold hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5" title="Preview PDF">
              <FileText size={14} /> Preview
            </button>
            <button onClick={() => handleExport('pdf', false)} className="px-3 py-2 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5" title="Export PDF">
              <Download size={14} /> PDF
            </button>
            <button onClick={() => handleExport('excel', false)} className="px-3 py-2 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors flex items-center gap-1.5" title="Export Excel">
              <Download size={14} /> Excel
            </button>
          </div>
        </div>
      </div>

      {/* Main Gender Toggles */}
      <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 max-w-md mx-auto">
        <button
          onClick={() => setGenderMode('PUTRA')}
          className={`flex-1 py-3 text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 ${
            genderMode === 'PUTRA'
              ? 'bg-green-600 text-white shadow-md'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <span>PUTRA</span>
        </button>
        <button
          onClick={() => setGenderMode('PUTRI')}
          className={`flex-1 py-3 text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 ${
            genderMode === 'PUTRI'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <span>PUTRI</span>
        </button>
      </div>

      {/* Sub Tabs based on Level */}
      <div className="flex justify-center">
        <div className="inline-flex bg-gray-100 dark:bg-gray-900/50 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700">
          {genderMode === 'PUTRA' ? (
            <>
              <button
                onClick={() => setLevelTab('WUSTHO_MAK')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  levelTab === 'WUSTHO_MAK'
                    ? 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                WUSTHO & MAK
              </button>
              <button
                onClick={() => setLevelTab('ULA')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  levelTab === 'ULA'
                    ? 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                ULA
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setLevelTab('WUSTHO')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  levelTab === 'WUSTHO'
                    ? 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                WUSTHO
              </button>
              <button
                onClick={() => setLevelTab('ULA')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  levelTab === 'ULA'
                    ? 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                ULA
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Grid Spreadsheet */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Memuat spreadsheet jadwal...
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-300">
          {/* Scrollable table container */}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-center text-sm border-collapse min-w-[700px]">
              <colgroup>
                <col style={{ width: `${100 / (activeCols.length + 1)}%` }} />
                {activeCols.map((col) => (
                  <col key={col.key} style={{ width: `${100 / (activeCols.length + 1)}%` }} />
                ))}
              </colgroup>
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 font-extrabold border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-2 py-4 border-r border-gray-200 dark:border-gray-700 bg-gray-100/50 dark:bg-gray-900/50">
                    MALAM
                  </th>
                  {activeCols.map((col) => (
                    <th
                      key={col.key}
                      className="px-2 py-4 border-r border-gray-200 dark:border-gray-700"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                 {DAYS.map((hari) => {
                  if (hari === 'Senin') {
                    // Senin is Ngaji Umum - Spans entire row
                    return (
                      <tr key={hari} className="bg-emerald-700 dark:bg-emerald-800 text-white font-extrabold tracking-wider">
                        <td className="px-3 py-3.5 border-r border-emerald-600 dark:border-emerald-700 bg-emerald-800 dark:bg-emerald-900 text-xs text-center">
                          <div>SENIN</div>
                          <div className="text-[10px] font-normal opacity-90 mt-0.5">(MALAM SELASA)</div>
                        </td>
                        <td
                          colSpan={activeCols.length}
                          className="px-3 py-3.5 text-center text-sm font-extrabold"
                        >
                          🌙 NGAJI UMUM
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={hari}
                      className="hover:bg-gray-50/30 dark:hover:bg-gray-800/10 transition-colors"
                    >
                       {/* Hari Column */}
                      <td className="px-3 py-4 border-r border-gray-200 dark:border-gray-700 font-bold bg-gray-50/50 dark:bg-gray-800/80 text-gray-900 dark:text-white text-center leading-snug">
                        <div className="text-[12px] font-extrabold">{hari === 'Jumat' ? "Jum'at" : hari}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-normal mt-1 leading-normal">
                          {hari === 'Jumat' && '(Malam Sabtu)'}
                          {hari === 'Sabtu' && '(Malam Ahad)'}
                          {hari === 'Ahad' && '(Malam Senin)'}
                          {hari === 'Selasa' && '(Malam Rabu)'}
                          {hari === 'Rabu' && '(Malam Kamis)'}
                        </div>
                      </td>

                      {/* Class cells */}
                      {activeCols.map((col) => {
                        const classDbObj = findClassDbObj(col.key);
                        const schedule = classDbObj ? schedulesMap[`${hari}_${classDbObj.id}`] : null;
                        const teacherCode = schedule ? teacherCodeMap[schedule.guru_id] || '?' : '';

                        return (
                          <td
                            key={col.key}
                            onClick={() => handleCellClick(hari, col.key, col.label)}
                            className={`p-2 border-r border-gray-100 dark:border-gray-700 transition-all ${
                              isEditable
                                ? 'cursor-pointer hover:bg-green-50/60 dark:hover:bg-green-900/20 active:scale-[0.98]'
                                : ''
                            } ${
                              schedule
                                ? 'bg-green-50/20 dark:bg-green-900/10'
                                : 'dark:bg-gray-800 text-gray-300 dark:text-gray-600'
                            }`}
                          >
                            {schedule ? (
                              <div className="flex flex-col items-center justify-center space-y-1.5 py-1">
                                <span className="font-extrabold text-gray-900 dark:text-white text-xs text-center leading-snug">
                                  {schedule.kegiatan}
                                </span>
                                <span className="inline-flex items-center justify-center font-bold px-2 py-0.5 text-[10px] rounded-lg bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-900/30">
                                  {teacherCode}
                                </span>
                                <span className="text-[9px] text-gray-400 font-medium flex items-center gap-0.5">
                                  <Clock size={8} /> {schedule.jam_mulai.substring(0, 5)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs font-semibold">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Teacher Codes Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
        <h3 className="text-sm font-extrabold text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 pb-3 flex items-center gap-2">
          <User size={18} className="text-green-600 dark:text-green-400" />
          <span>KODE GURU & ASATIDZAH ({genderMode})</span>
        </h3>
        {activeGurus.length === 0 ? (
          <p className="text-gray-500 text-xs dark:text-gray-400">Belum ada data guru pengajar.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
            {activeGurus.map((g, idx) => {
              const code = getTeacherCode(idx + 1);
              return (
                <div
                  key={g.id}
                  className="flex items-center gap-2.5 bg-gray-50 dark:bg-gray-700/40 p-2.5 rounded-xl border border-gray-200/40 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-colors"
                >
                  <span className="flex items-center justify-center w-8 h-8 font-extrabold rounded-lg bg-green-500 text-white text-xs shadow-sm">
                    {code}
                  </span>
                  <div className="leading-tight">
                    <p className="font-bold text-gray-800 dark:text-gray-200">{g.nama}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">ID: {g.id}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notes / Catatan Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
        <h3 className="text-sm font-extrabold text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 pb-3 flex items-center gap-2">
          <AlertCircle size={18} className="text-amber-500" />
          <span>KETERANGAN & CATATAN</span>
        </h3>
        {genderMode === 'PUTRA' ? (
          <ul className="list-decimal list-inside space-y-2 text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
            <li>
              Dimohon kepada seluruh Asatidz yang berhalangan hadir (tidak mengajar) untuk memberi informasi paling lambat pukul 18.00 WIB.
            </li>
            <li>Ruang Diniyah berada di Kamar Santri dan Musholla Pondok.</li>
          </ul>
        ) : (
          <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300 font-medium">
            <p className="leading-relaxed">
              <strong>A.</strong> Dimohon untuk para asatidz/ah yang berhalangan mengajar untuk konfirmasi paling lambat jam 4 sore atau mencari badal sendiri.
            </p>
            <p className="leading-relaxed">
              <strong>B.</strong> Semua kitab pelajaran kelas 2 & 3 pada dasarnya adalah melanjutkan sampai khatamnya kitab sebelumnya. Adapun jenjang kitab lanjutan adalah sbb:
            </p>
            <div className="pl-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 mt-1">
              <div>1. Fiqh : Mabadi' fiqhiyyah jilid 3 =&gt; Matan Taqrib</div>
              <div>2. Aqidah : Aqidatul awam =&gt; Aqidatul Islamiyah =&gt; Matan Tijanud Durori</div>
              <div>3. Akhlaq : Taysirul Khollaq =&gt; Akhlaq lil Banat j.2</div>
              <div>4. B. Arab: Madarij Ta'limul Lughah jilid 2 =&gt; Madarijuddurus jilid 3</div>
              <div>5. Nahwu : Al Miftah lil 'Ulum jilid 1, 2 dst =&gt; Matan Jurumiyyah</div>
            </div>
          </div>
        )}
      </div>

      {/* Edit/Add Scheduling Cell Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 bg-green-600 text-white flex justify-between items-center">
              <div>
                <h2 className="text-md font-bold">Atur Jadwal Madin</h2>
                <p className="text-[10px] opacity-90 mt-0.5">
                  Hari {modalData.hari} - Kelas {modalData.kelas_nama}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveModal} className="p-5 space-y-4">
              {/* Mata Pelajaran Combobox */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                  Mata Pelajaran / Kitab
                </label>
                <div className="relative" ref={mapelDropdownRef}>
                  <input
                    type="text"
                    placeholder="Ketik atau pilih dari kurikulum..."
                    value={modalData.kegiatan}
                    onChange={(e) => {
                      const v = e.target.value;
                      setModalData({ ...modalData, kegiatan: v });
                      setMapelSearch(v);
                      setShowMapelDropdown(true);
                    }}
                    onFocus={() => { setMapelSearch(modalData.kegiatan); setShowMapelDropdown(true); }}
                    className="w-full px-3 py-2 pr-8 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMapelDropdown(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-600"
                  >
                    <ChevronDown size={15} />
                  </button>
                  {showMapelDropdown && (
                    <div className="absolute z-[90] mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-44 overflow-y-auto">
                      {kurikulumList
                        .filter(m => m.toLowerCase().includes((mapelSearch || '').toLowerCase()))
                        .slice(0, 30)
                        .map(m => (
                          <button
                            key={m}
                            type="button"
                            onMouseDown={() => {
                              setModalData({ ...modalData, kegiatan: m });
                              setMapelSearch(m);
                              setShowMapelDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-700 dark:hover:text-green-300 transition-colors"
                          >
                            {m}
                          </button>
                        ))}
                      {kurikulumList.filter(m => m.toLowerCase().includes((mapelSearch || '').toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-xs text-gray-400 italic">
                          Tidak ada di kurikulum — tulis bebas di atas
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Guru Searchable Dropdown */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                  Guru Pengajar / Asatidz
                </label>
                <div className="relative" ref={guruDropdownRef}>
                  {/* Search input */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-t-lg border-b-0">
                    <Search size={13} className="text-gray-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Cari nama atau kode guru..."
                      value={guruSearch}
                      onChange={e => setGuruSearch(e.target.value)}
                      onFocus={() => setShowGuruDropdown(true)}
                      className="flex-1 bg-transparent text-xs text-gray-700 dark:text-gray-200 outline-none placeholder-gray-400"
                      autoComplete="off"
                    />
                    {guruSearch && (
                      <button type="button" onClick={() => setGuruSearch('')} className="text-gray-400 hover:text-red-400">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  {/* Selected display or dropdown list */}
                  <div
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-b-lg text-xs text-gray-700 dark:text-gray-200 cursor-pointer flex justify-between items-center"
                    onClick={() => setShowGuruDropdown(v => !v)}
                  >
                    <span className={modalData.guru_id ? '' : 'text-gray-400'}>
                      {modalData.guru_id
                        ? (() => {
                            const guru = activeGurus.find(g => g.id === modalData.guru_id);
                            if (!guru) return '-- Pilih Guru --';
                            return `[${teacherCodeMap[guru.id] || '?'}] ${guru.nama}`;
                          })()
                        : '-- Pilih Guru --'}
                    </span>
                    <ChevronDown size={13} className="text-gray-400" />
                  </div>
                  {showGuruDropdown && (
                    <div className="absolute z-[90] w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        onMouseDown={() => { setModalData({ ...modalData, guru_id: 0 }); setShowGuruDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-xs text-gray-400 italic hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        -- Pilih Guru --
                      </button>
                      {activeGurus
                        .map((g, idx) => ({ g, code: getTeacherCode(idx + 1) }))
                        .filter(({ g, code }) =>
                          guruSearch === '' ||
                          g.nama.toLowerCase().includes(guruSearch.toLowerCase()) ||
                          code.toLowerCase().includes(guruSearch.toLowerCase())
                        )
                        .map(({ g, code }) => (
                          <button
                            key={g.id}
                            type="button"
                            onMouseDown={() => {
                              setModalData({ ...modalData, guru_id: g.id });
                              setShowGuruDropdown(false);
                              setGuruSearch('');
                            }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                              modalData.guru_id === g.id
                                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-semibold'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                            }`}
                          >
                            <span className="font-mono font-bold text-green-600 dark:text-green-400 mr-1.5">[{code}]</span>
                            {g.nama}
                          </button>
                        ))}
                      {activeGurus.filter(g =>
                        guruSearch === '' ||
                        g.nama.toLowerCase().includes(guruSearch.toLowerCase()) ||
                        (teacherCodeMap[g.id] || '').toLowerCase().includes(guruSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-2 text-xs text-gray-400 italic">Tidak ditemukan</div>
                      )}
                    </div>
                  )}
                </div>
                <input type="hidden" value={modalData.guru_id} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    value={modalData.jam_mulai}
                    onChange={(e) => setModalData({ ...modalData, jam_mulai: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    value={modalData.jam_selesai}
                    onChange={(e) => setModalData({ ...modalData, jam_selesai: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Batal
                </button>
                {modalData.id && (
                  <button
                    type="button"
                    onClick={handleDeleteJadwal}
                    disabled={saving}
                    className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-xs transition-colors flex items-center justify-center"
                    title="Hapus Jadwal"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Proses...' : 'Simpan'}
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
                Preview PDF Jadwal Madin
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
