'use client';

import { useState, useEffect, useRef } from 'react';
import { CalendarDays, Clock, User, Plus, Edit2, Trash2, X, Check, BookOpen, AlertCircle, FileText, Download, Search, ChevronDown, Sparkles } from 'lucide-react';
import { exportMatrixPDF } from '@/lib/exportUtils';

interface Guru {
  id: number;
  nama: string;
}

interface ClassOption {
  id: number;
  nama: string;
  nama_asrama?: string;
}

interface JadwalItem {
  id: number;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  kegiatan: string; // mata_pelajaran atau nama_kegiatan
  tempat: string; // nama_kelas atau nama_kamar
  tempat_id: number; // kelas_madin_id, kelas_quran_id, atau kamar_id
  guru: string;
  guru_id: number;
  tipe: 'madin' | 'quran' | 'kegiatan';
}

export default function TabelJadwalPage() {
  // Main Data States
  const [jadwalList, setJadwalList] = useState<JadwalItem[]>([]);
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [classesMadin, setClassesMadin] = useState<ClassOption[]>([]);
  const [classesQuran, setClassesQuran] = useState<ClassOption[]>([]);
  const [rooms, setRooms] = useState<ClassOption[]>([]);
  const [kurikulumList, setKurikulumList] = useState<string[]>([]);
  const [role, setRole] = useState('murid');
  const [loading, setLoading] = useState(true);

  // Global search highlight state
  const [searchQuery, setSearchQuery] = useState('');

  // Primary Tab: quran | madin | kegiatan
  const [activeTab, setActiveTab] = useState<'quran' | 'madin' | 'kegiatan'>('quran');

  // Secondary & Tertiary Tabs:
  // Madin
  const [genderMode, setGenderMode] = useState<'PUTRA' | 'PUTRI'>('PUTRA');
  const [levelTab, setLevelTab] = useState<'WUSTHO_MAK' | 'ULA' | 'WUSTHO'>('WUSTHO_MAK');
  
  // Qur'an / Kegiatan Asrama
  const [activeAsrama, setActiveAsrama] = useState<string>('Asrama A');
  const [quranLevelTab, setQuranLevelTab] = useState<string>('jilid');
  const [kegiatanLevelTab, setKegiatanLevelTab] = useState<string>('kegiatan pagi');

  // Lists of secondary options
  const ASRAMAS_QURAN = ['Asrama A', 'Asrama B', 'Asrama C', 'Asrama D', 'Asrama E', 'Asrama F', 'Tahfidz Putra', 'Tahfidz Putri'];
  const ASRAMAS_KEGIATAN = ['Asrama A', 'Asrama B', 'Asrama C', 'Asrama D', 'Asrama E', 'Asrama F'];
  const LEVELS_QURAN = ['jilid', 'pasca', 'ghorib', 'finishing', 'khotaman', 'juz', 'tahfidz'];
  const LEVELS_KEGIATAN = ['kegiatan pagi', 'kegiatan sore'];

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

  // Combobox/Search Dropdown Ref States
  const [guruSearch, setGuruSearch] = useState('');
  const [showGuruDropdown, setShowGuruDropdown] = useState(false);
  const guruDropdownRef = useRef<HTMLDivElement>(null);

  const [mapelSearch, setMapelSearch] = useState('');
  const [showMapelDropdown, setShowMapelDropdown] = useState(false);
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

  // Sync Madin level tabs on gender change
  useEffect(() => {
    if (genderMode === 'PUTRA') {
      setLevelTab('WUSTHO_MAK');
    } else {
      setLevelTab('WUSTHO');
    }
  }, [genderMode]);

  // Initial Data Fetching
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

  useEffect(() => {
    if (!loading && role !== 'admin' && role !== 'staff') {
      const availableTabs = ['quran', 'madin', 'kegiatan'].filter(
        (tipe) => jadwalList.some((s) => s.tipe === tipe)
      );
      if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
        setActiveTab(availableTabs[0] as 'quran' | 'madin' | 'kegiatan');
      }
    }
  }, [loading, jadwalList, role, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all schedules
      const resJadwal = await fetch('/api/jadwal');
      const dataJadwal = await resJadwal.json();
      if (dataJadwal.success) {
        setJadwalList(dataJadwal.data);
      }

      // Fetch Teachers
      const resGuru = await fetch('/api/kelas?type=guru');
      const dataGuru = await resGuru.json();
      if (dataGuru.success) {
        setGurus(dataGuru.data);
      }

      // Fetch Madin classes
      const resMadin = await fetch('/api/kelas?type=madin');
      const dataMadin = await resMadin.json();
      if (dataMadin.success) {
        setClassesMadin(dataMadin.data);
      }

      // Fetch Quran classes
      const resQuran = await fetch('/api/kelas?type=quran');
      const dataQuran = await resQuran.json();
      if (dataQuran.success) {
        setClassesQuran(dataQuran.data);
      }

      // Fetch Rooms for Kegiatan
      const resRooms = await fetch('/api/kelas?type=kamar');
      const dataRooms = await resRooms.json();
      if (dataRooms.success) {
        setRooms(dataRooms.data);
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

  // Dynamic Days definition
  const DAYS = activeTab === 'madin' 
    ? ['Jumat', 'Sabtu', 'Ahad', 'Senin', 'Selasa', 'Rabu'] 
    : ['Jumat', 'Sabtu', 'Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis'];

  const getDisplayMalam = (hari: string): string => {
    const mapping: { [key: string]: string } = {
      'Jumat': "Jum'at (Malam Sabtu)",
      'Sabtu': 'Sabtu (Malam Ahad)',
      'Ahad': 'Ahad (Malam Senin)',
      'Senin': 'Senin (Malam Selasa)',
      'Selasa': 'Selasa (Malam Rabu)',
      'Rabu': 'Rabu (Malam Kamis)',
      'Kamis': 'Kamis (Malam Jum\'at)'
    };
    return mapping[hari] || hari;
  };

  // Generate generic alphabet codes for all teachers (alphabetical mapping)
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

  const sortedGurus = [...gurus].sort((a, b) => a.nama.localeCompare(b.nama));
  const teacherCodeMap: { [id: number]: string } = {};
  sortedGurus.forEach((g, idx) => {
    teacherCodeMap[g.id] = getTeacherCode(idx + 1);
  });

  const renderCellContent = (text: string) => {
    if (!text) return '-';
    return (
      <span className="block w-full text-center line-clamp-3 break-words whitespace-normal" title={text}>
        {text}
      </span>
    );
  };

  // Natural sort helper: sorts strings with embedded numbers properly (A1, A2, A10 not A1, A10, A2)
  const naturalSort = (a: ClassOption, b: ClassOption) => {
    return a.nama.localeCompare(b.nama, undefined, { numeric: true, sensitivity: 'base' });
  };

  // Dynamic grouping & classification helpers
  const getQuranCategory = (name: string): string => {
    const n = name.toUpperCase();
    if (n.includes('TAHFIDZ')) return 'tahfidz';
    if (n.includes('KHOTAMAN') || n.includes('KHOTIMIN') || n.includes('PERSIAPAN')) return 'khotaman';
    if (n.includes('FINISHING')) return 'finishing';
    if (n.includes('GHORIB')) return 'ghorib';
    if (n.includes('PASCA')) return 'pasca';
    if (n.includes('JUZ')) return 'juz';
    if (n.includes('JILID')) return 'jilid';
    return 'jilid'; // fallback
  };

  // Get active row items based on the active tab and filters
  const getActiveRows = (): ClassOption[] => {
    if (activeTab === 'madin') {
      return classesMadin.filter(c => {
        const isPutri = c.nama.toUpperCase().includes('PUTRI') || c.nama.toUpperCase().includes('TQ PUTRI');
        const isMatchGender = genderMode === 'PUTRI' ? isPutri : !isPutri;
        if (!isMatchGender) return false;

        const n = c.nama.toUpperCase();
        if (genderMode === 'PUTRA') {
          if (levelTab === 'WUSTHO_MAK') {
            return n.includes('WUSTHO') || n.includes('MAK') || n === 'TQ PUTRA';
          } else {
            return n.includes('ULA');
          }
        } else {
          if (levelTab === 'WUSTHO') {
            return n.includes('WUSTHO') || n.includes('MAK');
          } else {
            return n.includes('ULA') || n.includes('TQ PUTRI');
          }
        }
      }).sort(naturalSort);
    } else if (activeTab === 'quran') {
      return classesQuran.filter(c => {
        const n = c.nama.toUpperCase();
        if (activeAsrama === 'Tahfidz Putra') {
          return n.includes('TAHFIDZ') && n.includes('ASRAMA A');
        } else if (activeAsrama === 'Tahfidz Putri') {
          return n.includes('TAHFIDZ PUTRI');
        } else if (activeAsrama === 'Asrama A') {
          return n.includes('ASRAMA A') && !n.includes('TAHFIDZ');
        } else {
          return n.includes(activeAsrama.toUpperCase()) && !n.includes('TAHFIDZ PUTRI');
        }
      }).sort(naturalSort);
    } else {
      // Kegiatan Asrama - natural sort so A1, A2, A10 sort correctly
      return rooms.filter(r => r.nama_asrama === activeAsrama).sort(naturalSort);
    }
  };

  const activeRows = getActiveRows();

  // Dynamically filter secondary and tertiary options for non-admin/staff
  const availableMadinGenders = ['PUTRA', 'PUTRI'].filter(gender => {
    if (role === 'admin' || role === 'staff') return true;
    return jadwalList.some(s => {
      if (s.tipe !== 'madin') return false;
      const isPutri = s.tempat?.toUpperCase().includes('PUTRI') || s.tempat?.toUpperCase().includes('TQ PUTRI');
      return gender === 'PUTRI' ? isPutri : !isPutri;
    });
  });

  const availableMadinLevels = (genderMode === 'PUTRA' ? ['WUSTHO_MAK', 'ULA'] : ['WUSTHO', 'ULA']).filter(lvl => {
    if (role === 'admin' || role === 'staff') return true;
    return jadwalList.some(s => {
      if (s.tipe !== 'madin') return false;
      const isPutri = s.tempat?.toUpperCase().includes('PUTRI') || s.tempat?.toUpperCase().includes('TQ PUTRI');
      const matchesGender = genderMode === 'PUTRI' ? isPutri : !isPutri;
      if (!matchesGender) return false;
      
      const n = s.tempat?.toUpperCase() || '';
      if (genderMode === 'PUTRA') {
        if (lvl === 'WUSTHO_MAK') {
          return n.includes('WUSTHO') || n.includes('MAK') || n === 'TQ PUTRA';
        } else {
          return n.includes('ULA');
        }
      } else {
        if (lvl === 'WUSTHO') {
          return n.includes('WUSTHO') || n.includes('MAK');
        } else {
          return n.includes('ULA') || n.includes('TQ PUTRI');
        }
      }
    });
  });

  const availableQuranAsramas = ASRAMAS_QURAN.filter(asr => {
    if (role === 'admin' || role === 'staff') return true;
    return jadwalList.some(s => {
      if (s.tipe !== 'quran') return false;
      const n = s.tempat?.toUpperCase() || '';
      
      if (asr === 'Tahfidz Putra') {
        return n.includes('TAHFIDZ') && n.includes('ASRAMA A');
      } else if (asr === 'Tahfidz Putri') {
        return n.includes('TAHFIDZ PUTRI');
      } else if (asr === 'Asrama A') {
        return n.includes('ASRAMA A') && !n.includes('TAHFIDZ');
      } else {
        return n.includes(asr.toUpperCase()) && !n.includes('TAHFIDZ PUTRI');
      }
    });
  });

  const availableQuranLevels = LEVELS_QURAN.filter(lvl => {
    if (role === 'admin' || role === 'staff') return true;
    return jadwalList.some(s => {
      if (s.tipe !== 'quran') return false;
      const n = s.tempat?.toUpperCase() || '';
      const matchesAsrama = activeAsrama === 'Tahfidz Putri' 
        ? n.includes('TAHFIDZ PUTRI') 
        : (n.includes(activeAsrama.toUpperCase()) && !n.includes('TAHFIDZ PUTRI'));
      if (!matchesAsrama) return false;
      return getQuranCategory(s.tempat || '') === lvl;
    });
  });

  const availableKegiatanAsramas = ASRAMAS_KEGIATAN.filter(asr => {
    if (role === 'admin' || role === 'staff') return true;
    return jadwalList.some(s => {
      if (s.tipe !== 'kegiatan') return false;
      const room = rooms.find(r => r.id === s.tempat_id);
      return room?.nama_asrama === asr;
    });
  });

  const availableKegiatanLevels = LEVELS_KEGIATAN.filter(lvl => {
    if (role === 'admin' || role === 'staff') return true;
    return jadwalList.some(s => {
      if (s.tipe !== 'kegiatan') return false;
      const room = rooms.find(r => r.id === s.tempat_id);
      if (room?.nama_asrama !== activeAsrama) return false;
      const isSore = s.jam_mulai >= '12:00:00';
      return lvl === 'kegiatan sore' ? isSore : !isSore;
    });
  });

  // Auto-sync sub-tab selection for non-admin/staff
  useEffect(() => {
    if (loading || role === 'admin' || role === 'staff') return;

    if (activeTab === 'madin') {
      if (availableMadinGenders.length > 0 && !availableMadinGenders.includes(genderMode)) {
        setGenderMode(availableMadinGenders[0] as 'PUTRA' | 'PUTRI');
      }
      if (availableMadinLevels.length > 0 && !availableMadinLevels.includes(levelTab as any)) {
        setLevelTab(availableMadinLevels[0] as any);
      }
    } else if (activeTab === 'quran') {
      if (availableQuranAsramas.length > 0 && !availableQuranAsramas.includes(activeAsrama)) {
        setActiveAsrama(availableQuranAsramas[0]);
      }
      if (availableQuranLevels.length > 0 && !availableQuranLevels.includes(quranLevelTab)) {
        setQuranLevelTab(availableQuranLevels[0]);
      }
    } else if (activeTab === 'kegiatan') {
      if (availableKegiatanAsramas.length > 0 && !availableKegiatanAsramas.includes(activeAsrama)) {
        setActiveAsrama(availableKegiatanAsramas[0]);
      }
      if (availableKegiatanLevels.length > 0 && !availableKegiatanLevels.includes(kegiatanLevelTab)) {
        setKegiatanLevelTab(availableKegiatanLevels[0]);
      }
    }
  }, [loading, role, activeTab, genderMode, activeAsrama, levelTab, quranLevelTab, kegiatanLevelTab, jadwalList, rooms]);


  // Helper to simplify row header display labels
  const getShortLabel = (nama: string) => {
    return nama
      .replace(/\s*PUTRA\s*/gi, '')
      .replace(/\s*PUTRI\s*/gi, '')
      .replace(/WUSTHO/gi, 'Wus')
      .replace(/PERSIAPAN/gi, 'Pers.')
      .replace(/TAHFIDZUL QUR'AN/gi, 'Tahfidz')
      .replace(/TAHFIDZ/gi, 'Tahfidz');
  };

  // Organize schedules in maps by key
  const schedulesMap: { [key: string]: JadwalItem[] } = {};
  
  // Filter jadwal list by the active tab
  const activeSchedules = jadwalList.filter(j => {
    if (j.tipe !== activeTab) return false;
    // For kegiatan tab, filter dynamically by pagi/sore inside the map key
    return true;
  });

  activeSchedules.forEach((j) => {
    const key = `${j.hari}_${j.tempat_id}`;
    if (!schedulesMap[key]) {
      schedulesMap[key] = [];
    }
    schedulesMap[key].push(j);
  });

  // Get matching schedule item for a cell
  const getCellSchedule = (hari: string, tempatId: number): JadwalItem | null => {
    const list = schedulesMap[`${hari}_${tempatId}`] || [];
    if (list.length === 0) return null;

    if (activeTab === 'kegiatan') {
      // Filter by start time
      return list.find(j => {
        const isSore = j.jam_mulai >= '12:00:00';
        return kegiatanLevelTab === 'kegiatan sore' ? isSore : !isSore;
      }) || null;
    }
    return list[0];
  };

  // Cell Click Handler to Open Modal
  const handleCellClick = (hari: string, rowItem: ClassOption) => {
    if (!isEditable) return;
    if (activeTab === 'madin' && hari === 'Senin') return; // Senin is Ngaji Umum

    const existingJadwal = getCellSchedule(hari, rowItem.id);

    setModalData({
      id: existingJadwal ? existingJadwal.id : null,
      hari,
      kelas_id: rowItem.id,
      kelas_nama: `${getShortLabel(rowItem.nama)}`,
      kegiatan: existingJadwal ? existingJadwal.kegiatan : '',
      guru_id: existingJadwal ? existingJadwal.guru_id : 0,
      jam_mulai: existingJadwal ? existingJadwal.jam_mulai.substring(0, 5) : (activeTab === 'kegiatan' ? '05:00' : '20:00'),
      jam_selesai: existingJadwal ? existingJadwal.jam_selesai.substring(0, 5) : (activeTab === 'kegiatan' ? '06:00' : '21:00')
    });

    setIsModalOpen(true);
  };

  // Save changes from modal
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ids: modalData.id ? [modalData.id] : undefined,
        tipe: activeTab,
        hari: modalData.hari,
        jam_mulai: modalData.jam_mulai + ':00',
        jam_selesai: modalData.jam_selesai + ':00',
        kegiatan: modalData.kegiatan,
        tempat_id: modalData.kelas_id,
        guru_id: modalData.guru_id || null
      };

      if (modalData.id) {
        // PUT update request
        const res = await fetch('/api/jadwal', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          setIsModalOpen(false);
          fetchData();
        } else {
          alert(data.error || 'Gagal menyimpan perubahan');
        }
      } else {
        // POST create request
        const res = await fetch('/api/jadwal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          setIsModalOpen(false);
          fetchData();
        } else {
          alert(data.error || 'Gagal menambahkan jadwal baru');
        }
      }
    } catch (err) {
      alert('Gagal menghubungi server');
    } finally {
      setSaving(false);
    }
  };

  // Delete schedule handler
  const handleDeleteJadwal = async () => {
    if (!modalData.id) return;
    if (!confirm('Apakah Anda yakin ingin menghapus jadwal ini?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/jadwal?id=${modalData.id}&tipe=${activeTab}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        alert(data.error || 'Gagal menghapus jadwal');
      }
    } catch (err) {
      alert('Gagal menghubungi server');
    } finally {
      setSaving(false);
    }
  };

  // Export & PDF Preview setup
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [showOrientasiModal, setShowOrientasiModal] = useState(false);
  const [pendingPreviewOnly, setPendingPreviewOnly] = useState(false);

  const handleExportMatrix = (orientation: 'landscape' | 'portrait', previewOnly = false) => {
    if (activeSchedules.length === 0) {
      alert('Tidak ada data untuk di-export.');
      return;
    }

    const typeLabels = {
      quran: 'AL-QUR\'AN',
      madin: 'MADRASAH DINIYAH',
      kegiatan: 'KEGIATAN ASRAMA'
    };

    let title = `JADWAL ${typeLabels[activeTab]}`;
    let subtitle = '';

    if (activeTab === 'madin') {
      title += ` - ${genderMode}`;
      subtitle = `Tingkat: ${levelTab === 'WUSTHO_MAK' ? 'WUSTHO & MAK' : 'ULA'}`;
    } else if (activeTab === 'quran') {
      title += ` - ${activeAsrama.toUpperCase()}`;
      subtitle = `Pondok Pesantren Matholi'ul Anwar`;
    } else {
      title += ` - ${activeAsrama.toUpperCase()}`;
      subtitle = `Waktu: ${kegiatanLevelTab.toUpperCase()}`;
    }

    if (activeTab !== 'quran') {
      subtitle += ` | Pondok Pesantren Matholi'ul Anwar`;
    }
    const filename = `Tabel_Jadwal_${activeTab}_${orientation}`;

    // Cells mapped by `${hariKey}_${kelasKey}`
    const cellData: { [k: string]: { mapel: string; guruCode: string; jam: string } | null } = {};
    activeSchedules.forEach(j => {
      let matchedClass: ClassOption | undefined;
      if (activeTab === 'madin') matchedClass = classesMadin.find(c => c.id === j.tempat_id);
      else if (activeTab === 'quran') matchedClass = classesQuran.find(c => c.id === j.tempat_id);
      else matchedClass = rooms.find(c => c.id === j.tempat_id);

      if (!matchedClass) return;

      // Filter by kegiatan pagi/sore if in kegiatan tab
      if (activeTab === 'kegiatan') {
        const isSore = j.jam_mulai >= '12:00:00';
        const matchesTab = kegiatanLevelTab === 'kegiatan sore' ? isSore : !isSore;
        if (!matchesTab) return;
      }

      const guruCode = teacherCodeMap[j.guru_id] || '?';
      cellData[`${j.hari}_${matchedClass.nama.toUpperCase()}`] = {
        mapel: j.kegiatan,
        guruCode,
        jam: j.jam_mulai.substring(0, 5),
      };
    });

    const klasListExport = activeRows.map(row => ({ key: row.nama.toUpperCase(), label: getShortLabel(row.nama) }));

    const hariListExport = DAYS.map(h => ({
      key: h,
      label: getDisplayMalam(h).replace(' (', '\n(')
    }));

    // Find teachers involved in the current active view (activeRows), excluding Monday (Senin) for Madin (Ngaji Umum)
    const involvedGuruIds = new Set<number>();
    activeRows.forEach(row => {
      DAYS.forEach(h => {
        if (activeTab === 'madin' && h === 'Senin') return;
        const cellSchedules = schedulesMap[`${h}_${row.id}`] || [];
        cellSchedules.forEach(sch => {
          if (sch.guru_id) involvedGuruIds.add(sch.guru_id);
        });
      });
    });

    const teacherLegend = sortedGurus
      .filter(g => involvedGuruIds.has(g.id))
      .map(g => ({
        code: teacherCodeMap[g.id] || '?',
        nama: g.nama
      }));

    const notes = activeTab === 'madin'
      ? (genderMode === 'PUTRA'
          ? [
              'Dimohon kepada seluruh Asatidz yang berhalangan hadir (tidak mengajar) untuk memberi informasi paling lambat pukul 18.00 WIB.',
              'Ruang Diniyah berada di Kamar Santri dan Musholla Pondok.',
            ]
          : [
              'Dimohon untuk para asatidz/ah yang berhalangan mengajar untuk konfirmasi paling lambat jam 4 sore atau mencari badal sendiri.',
              'Semua kitab pelajaran kelas 2 & 3 pada dasarnya adalah melanjutkan sampai khatamnya kitab sebelumnya.',
            ])
      : [
          'Harap menjaga ketertiban dan disiplin waktu kegiatan.',
          'Bagi pengajar yang berhalangan hadir, wajib menunjuk badal guru pengganti.'
        ];

    const result = exportMatrixPDF({
      title,
      subtitle,
      institution: 'PONDOK PESANTREN MATHOLI\'UL ANWAR - LAMONGAN',
      orientation,
      klasList: klasListExport,
      hariList: hariListExport,
      cellData,
      teacherLegend,
      notes,
      filename,
      previewOnly,
      hasNgajiUmum: activeTab === 'madin'
    });

    if (previewOnly && result) {
      setPdfUrl(result);
      setShowPdfPreview(true);
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
              <CalendarDays size={28} /> Tabel Jadwal
            </h1>
            <p className="text-green-600 dark:text-green-300 text-sm mt-1 font-medium max-w-md">
              Tampilan grid spreadsheet yang tersinkronisasi untuk mengelola kelas Qur'an, Madin, dan kegiatan asrama.
            </p>
          </div>
          <div className="flex gap-2 self-start md:self-center shrink-0">
            <button
              onClick={() => { setPendingPreviewOnly(true); setShowOrientasiModal(true); }}
              className="px-3 py-2 bg-white/90 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 border border-green-200 dark:border-green-800 rounded-xl text-xs font-bold hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 flex items-center gap-1.5 shadow-sm"
              title="Preview PDF Tabel"
            >
              <FileText size={14} className="text-green-600" /> Preview PDF
            </button>
            <button
              onClick={() => { setPendingPreviewOnly(false); setShowOrientasiModal(true); }}
              className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white border border-red-600 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 shadow-md shadow-red-500/20"
              title="Download PDF Tabel"
            >
              <Download size={14} /> Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Main Schedule Type Tabs */}
      <div className="flex w-full bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        {(role === 'admin' || role === 'staff' || jadwalList.some(s => s.tipe === 'quran')) && (
        <button 
          onClick={() => { setActiveTab('quran'); setActiveAsrama('Asrama A'); }} 
          className={`flex-1 py-3 text-sm font-extrabold rounded-xl transition-all text-center ${
            activeTab === 'quran' ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          Kelas Qur'an
        </button>
        )}
        {(role === 'admin' || role === 'staff' || jadwalList.some(s => s.tipe === 'madin')) && (
        <button 
          onClick={() => { setActiveTab('madin'); setGenderMode('PUTRA'); }} 
          className={`flex-1 py-3 text-sm font-extrabold rounded-xl transition-all text-center ${
            activeTab === 'madin' ? 'bg-teal-500 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          Kelas Madin
        </button>
        )}
        {(role === 'admin' || role === 'staff' || jadwalList.some(s => s.tipe === 'kegiatan')) && (
        <button 
          onClick={() => { setActiveTab('kegiatan'); setActiveAsrama('Asrama A'); }} 
          className={`flex-1 py-3 text-sm font-extrabold rounded-xl transition-all text-center ${
            activeTab === 'kegiatan' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          Kegiatan Asrama
        </button>
        )}
      </div>

      {/* Toggles & Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-3">
        
        {/* Dynamic Secondary Options (Asrama / PUTRA-PUTRI) */}
        <div className="w-full">
          
          {/* Madin secondary option (Gender) */}
          {activeTab === 'madin' && (
            <div className="flex w-full bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700">
              {availableMadinGenders.includes('PUTRA') && (
                <button
                  onClick={() => setGenderMode('PUTRA')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center ${genderMode === 'PUTRA' ? 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  PUTRA
                </button>
              )}
              {availableMadinGenders.includes('PUTRI') && (
                <button
                  onClick={() => setGenderMode('PUTRI')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center ${genderMode === 'PUTRI' ? 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  PUTRI
                </button>
              )}
            </div>
          )}

          {/* Qur'an Asrama selection */}
          {activeTab === 'quran' && (
            <div className="flex w-full bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700 flex-wrap gap-1">
              {ASRAMAS_QURAN.filter(asr => availableQuranAsramas.includes(asr)).map((asr) => (
                <button
                  key={asr}
                  onClick={() => setActiveAsrama(asr)}
                  className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all text-center ${
                    activeAsrama === asr 
                      ? 'bg-emerald-500 text-white shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {asr}
                </button>
              ))}
            </div>
          )}

          {/* Kegiatan Asrama selection */}
          {activeTab === 'kegiatan' && (
            <div className="flex w-full bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700">
              {ASRAMAS_KEGIATAN.filter(asr => availableKegiatanAsramas.includes(asr)).map((asr) => (
                <button
                  key={asr}
                  onClick={() => setActiveAsrama(asr)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center ${
                    activeAsrama === asr 
                      ? 'bg-blue-500 text-white shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {asr}
                </button>
              ))}
            </div>
          )}

        </div>

        {/* Dynamic Tertiary Option Selector (Level Sub-tabs) */}
        {activeTab !== 'quran' && (
          <div className="w-full">
            
            {/* Sub-tabs Level - full width evenly distributed */}
            <div className="flex w-full bg-gray-100 dark:bg-gray-900/50 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700">
              {activeTab === 'madin' && (
                <>
                  {availableMadinLevels.includes(genderMode === 'PUTRA' ? 'WUSTHO_MAK' : 'WUSTHO') && (
                    <button
                      onClick={() => setLevelTab(genderMode === 'PUTRA' ? 'WUSTHO_MAK' : 'WUSTHO')}
                      className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all text-center ${
                        levelTab !== 'ULA' 
                          ? 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 shadow-sm' 
                          : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      {genderMode === 'PUTRA' ? 'WUSTHO & MAK' : 'WUSTHO'}
                    </button>
                  )}
                  {availableMadinLevels.includes('ULA') && (
                    <button
                      onClick={() => setLevelTab('ULA')}
                      className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all text-center ${
                        levelTab === 'ULA' 
                          ? 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 shadow-sm' 
                          : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      ULA
                    </button>
                  )}
                </>
              )}

              {activeTab === 'kegiatan' && LEVELS_KEGIATAN.filter(lvl => availableKegiatanLevels.includes(lvl)).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setKegiatanLevelTab(lvl)}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all capitalize text-center ${
                    kegiatanLevelTab === lvl 
                      ? 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

          </div>
        )}

      </div>

      {/* Grid Highlights & Live Search */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-50/50 to-teal-50/20 dark:from-emerald-950/20 dark:to-gray-800/20 border border-emerald-100/50 dark:border-emerald-900/30 rounded-2xl">
        <Sparkles size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Cari guru, kitab, mapel, atau nama kelas untuk menyorot grid..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 outline-none pr-8"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 font-medium">
          Membuat spreadsheet jadwal...
        </div>
      ) : activeRows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 border border-gray-100 dark:border-gray-700 text-center shadow-sm">
          <p className="text-gray-500 dark:text-gray-400 font-medium">Tidak ada kelas / kamar yang terdaftar di kategori ini.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-300">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-center text-sm border-collapse" style={{ minWidth: `${(DAYS.length + 1) * 115}px` }}>
              <colgroup>
                {/* Class Column (left) */}
                <col style={{ width: '100px' }} />
                {DAYS.map((hari) => (
                  <col key={hari} style={{ width: `${100 / DAYS.length}%` }} />
                ))}
              </colgroup>

              {/* Header */}
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 font-extrabold border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-2 py-4 border-r border-gray-200 dark:border-gray-700 bg-gray-100/50 dark:bg-gray-900/50 text-xs">
                    {activeTab === 'kegiatan' ? 'KAMAR' : 'KELAS'}
                  </th>
                  {DAYS.map((hari) => {
                    const isSeninMadin = activeTab === 'madin' && hari === 'Senin';
                    return (
                      <th
                        key={hari}
                        className={`px-2 py-4 border-r border-gray-200 dark:border-gray-700 text-xs leading-snug ${
                          isSeninMadin ? 'bg-emerald-700 dark:bg-emerald-800 text-white' : ''
                        }`}
                      >
                        <div className="font-extrabold">{hari}</div>
                        <div className={`text-[9px] font-normal mt-0.5 ${isSeninMadin ? 'text-emerald-200' : 'text-gray-400 dark:text-gray-500'}`}>
                          {hari === 'Jumat' && '(Malam Sabtu)'}
                          {hari === 'Sabtu' && '(Malam Ahad)'}
                          {hari === 'Ahad' && '(Malam Senin)'}
                          {hari === 'Senin' && '(Malam Selasa)'}
                          {hari === 'Selasa' && '(Malam Rabu)'}
                          {hari === 'Rabu' && '(Malam Kamis)'}
                          {hari === 'Kamis' && '(Malam Jum\'at)'}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Body */}
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {activeRows.map((rowItem) => {
                  return (
                    <tr
                      key={rowItem.id}
                      className="hover:bg-gray-50/30 dark:hover:bg-gray-800/10 transition-colors"
                    >
                      {/* Class Header cell */}
                      <td 
                        className="px-2 py-3 border-r border-gray-200 dark:border-gray-700 font-extrabold bg-green-50/60 dark:bg-green-900/20 text-green-800 dark:text-green-300 text-center text-xs leading-snug break-words" 
                        style={{minHeight: '60px', wordBreak: 'break-word'}}
                        title={rowItem.nama}
                      >
                        {getShortLabel(rowItem.nama)}
                      </td>

                      {/* Day cells */}
                      {DAYS.map((hari) => {
                        const schedule = getCellSchedule(hari, rowItem.id);
                        const teacherCode = schedule ? teacherCodeMap[schedule.guru_id] || '?' : '';
                        const isSeninMadin = activeTab === 'madin' && hari === 'Senin';

                        // Apply query highlighting
                        let isHighlighted = false;
                        if (searchQuery && schedule) {
                          const q = searchQuery.toLowerCase();
                          isHighlighted = 
                            schedule.kegiatan.toLowerCase().includes(q) ||
                            (schedule.guru || '').toLowerCase().includes(q) ||
                            teacherCode.toLowerCase().includes(q) ||
                            rowItem.nama.toLowerCase().includes(q);
                        }

                        if (isSeninMadin) {
                          return (
                            <td
                              key={hari}
                              className="p-2 border-r border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-center"
                            >
                              <div className="flex flex-col items-center justify-center space-y-1 py-0.5">
                                <span className="text-[9px] font-extrabold text-emerald-700 dark:text-emerald-400">🌙 NGAJI</span>
                                <span className="text-[9px] font-extrabold text-emerald-700 dark:text-emerald-400">UMUM</span>
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={hari}
                            onClick={() => handleCellClick(hari, rowItem)}
                            className={`p-2 border-r border-gray-100 dark:border-gray-700 transition-all ${
                              isEditable
                                ? 'cursor-pointer hover:bg-green-50/60 dark:hover:bg-green-900/20 active:scale-[0.98]'
                                : ''
                            } ${
                              isHighlighted 
                                ? 'bg-amber-100 dark:bg-amber-900/50 ring-2 ring-amber-400 dark:ring-amber-500 z-10' 
                                : schedule
                                  ? 'bg-green-50/20 dark:bg-green-900/10'
                                  : 'dark:bg-gray-800 text-gray-300 dark:text-gray-600'
                            }`}
                          >
                            {schedule ? (
                              <div className="flex flex-col items-center justify-center gap-0.5 py-1 min-h-[52px]">
                                <div className="font-extrabold text-gray-900 dark:text-white text-xs text-center leading-snug w-full">
                                  {renderCellContent(schedule.kegiatan)}
                                </div>
                                <div className="flex items-center gap-1 flex-wrap justify-center">
                                  {schedule.guru_id ? (
                                    <span className="flex items-center justify-center font-bold w-8 h-6 shrink-0 text-[9px] rounded-lg bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-900/30 whitespace-nowrap">
                                      {teacherCode}
                                    </span>
                                  ) : null}
                                  <span className="text-[8px] text-gray-400 font-medium flex items-center gap-0.5 whitespace-nowrap">
                                    <Clock size={8} /> {schedule.jam_mulai.substring(0, 5)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center min-h-[52px]">
                                <span className="text-xs font-semibold text-gray-300 dark:text-gray-600">-</span>
                              </div>
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
          <span>KODE GURU & ASATIDZAH</span>
        </h3>
        {sortedGurus.length === 0 ? (
          <p className="text-gray-500 text-xs dark:text-gray-400">Belum ada data guru pengajar.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
            {sortedGurus
              .filter(g => {
                return activeRows.some(row =>
                  DAYS.some(h => {
                    if (activeTab === 'madin' && h === 'Senin') return false;
                    const cellSchedules = schedulesMap[`${h}_${row.id}`] || [];
                    return cellSchedules.some(sch => sch.guru_id === g.id);
                  })
                );
              })
              .map((g) => {
              const code = teacherCodeMap[g.id];
              if (!code) return null;
              return (
                <div
                  key={g.id}
                  className="flex items-center gap-2.5 bg-gray-50 dark:bg-gray-700/40 p-2.5 rounded-xl border border-gray-200/40 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-colors"
                >
                  <span className="flex items-center justify-center shrink-0 font-extrabold rounded-lg bg-green-500 text-white text-[10px] shadow-sm whitespace-nowrap px-2 h-7 min-w-[28px]">
                    {code}
                  </span>
                  <div className="leading-tight min-w-0">
                    <p className="font-bold text-gray-800 dark:text-gray-200 truncate text-xs">{g.nama}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">ID: {g.id}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Catatan / Keterangan Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
        <h3 className="text-sm font-extrabold text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 pb-3 flex items-center gap-2">
          <AlertCircle size={18} className="text-amber-500" />
          <span>KETERANGAN & CATATAN</span>
        </h3>
        <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
          <p>
            <strong>1.</strong> Untuk menambahkan atau memperbarui jadwal, ketuk langsung pada sel kosong atau sel jadwal yang bersangkutan (Khusus Admin/Staff).
          </p>
          <p>
            <strong>2.</strong> Pencarian di bagian atas dapat digunakan untuk menyaring dan memberikan sorotan warna kuning pada sel jadwal yang sesuai.
          </p>
          <p>
            <strong>3.</strong> Export PDF mendukung orientasi Landscape (untuk tampilan horizontal yang lebih luas) maupun Portrait (vertikal).
          </p>
        </div>
      </div>

      {/* Edit/Add Cell Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 bg-green-600 text-white flex justify-between items-center">
              <div>
                <h2 className="text-md font-bold">Atur Jadwal</h2>
                <p className="text-[10px] opacity-90 mt-0.5">
                  Hari {modalData.hari} - {activeTab === 'kegiatan' ? 'Kamar' : 'Kelas'} {modalData.kelas_nama}
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
                  {activeTab === 'kegiatan' ? 'Kegiatan' : 'Mata Pelajaran / Kitab'}
                </label>
                <div className="relative" ref={mapelDropdownRef}>
                  <input
                    type="text"
                    placeholder={activeTab === 'kegiatan' ? 'Tulis kegiatan...' : 'Ketik atau pilih dari kurikulum...'}
                    value={modalData.kegiatan}
                    onChange={(e) => {
                      const v = e.target.value;
                      setModalData({ ...modalData, kegiatan: v });
                      setMapelSearch(v);
                      setShowMapelDropdown(true);
                    }}
                    onFocus={() => { 
                      if (activeTab !== 'kegiatan') {
                        setMapelSearch(modalData.kegiatan); 
                        setShowMapelDropdown(true); 
                      }
                    }}
                    className="w-full px-3 py-2 pr-8 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                    autoComplete="off"
                  />
                  {activeTab !== 'kegiatan' && (
                    <button
                      type="button"
                      onClick={() => setShowMapelDropdown(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-600"
                    >
                      <ChevronDown size={15} />
                    </button>
                  )}
                  {showMapelDropdown && activeTab !== 'kegiatan' && (
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
                  {/* Selected Display Dropdown */}
                  <div
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-b-lg text-xs text-gray-700 dark:text-gray-200 cursor-pointer flex justify-between items-center"
                    onClick={() => setShowGuruDropdown(v => !v)}
                  >
                    <span className={modalData.guru_id ? '' : 'text-gray-400'}>
                      {modalData.guru_id
                        ? (() => {
                            const guru = sortedGurus.find(g => g.id === modalData.guru_id);
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
                      {sortedGurus
                        .map(g => ({ g, code: teacherCodeMap[g.id] || '?' }))
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
                      {sortedGurus.filter(g =>
                        guruSearch === '' ||
                        g.nama.toLowerCase().includes(guruSearch.toLowerCase()) ||
                        (teacherCodeMap[g.id] || '').toLowerCase().includes(guruSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-2 text-xs text-gray-400 italic">Tidak ditemukan</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Start & End Times */}
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

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Batal
                </button>
                {modalData.id && (
                  <button
                    type="button"
                    onClick={handleDeleteJadwal}
                    disabled={saving}
                    className="py-2.5 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-bold rounded-xl text-xs transition-colors flex items-center justify-center"
                    title="Hapus Jadwal"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs disabled:opacity-50 transition-colors"
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0 gap-3 sm:gap-4">
              <div className="flex justify-between items-center w-full sm:w-auto">
                <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 text-sm sm:text-base">
                  <FileText className="text-green-600 flex-shrink-0" size={20} />
                  <span>Preview PDF Tabel Jadwal</span>
                </h3>
                <button
                  onClick={() => setShowPdfPreview(false)}
                  className="sm:hidden bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 p-2 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleExportMatrix('landscape', false)}
                  className="flex-1 sm:flex-initial bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-xl text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download size={16} /> Lanskap
                </button>
                <button
                  onClick={() => handleExportMatrix('portrait', false)}
                  className="flex-1 sm:flex-initial bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-xl text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download size={16} /> Potret
                </button>
                <button
                  onClick={() => setShowPdfPreview(false)}
                  className="hidden sm:block bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 p-2 rounded-xl transition-colors"
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
                <p className="text-xs text-gray-500 dark:text-gray-400">Browser Pihak Ketiga pada HP tidak mendukung tampilan PDF tertanam secara langsung. Silakan gunakan tombol di bawah untuk membuka atau mengunduh PDF.</p>
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

      {/* Orientation Selection Modal */}
      {showOrientasiModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-[slideUp_0.3s_ease-out]">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-5 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-lg flex items-center gap-2">
                    <FileText size={20} /> Orientasi PDF
                  </h2>
                  <p className="text-xs text-green-100 mt-1">
                    {pendingPreviewOnly ? 'Pilih orientasi untuk preview' : 'Pilih orientasi untuk download'}
                  </p>
                </div>
                <button
                  onClick={() => setShowOrientasiModal(false)}
                  className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-3">
              {/* Landscape */}
              <button
                onClick={() => {
                  setShowOrientasiModal(false);
                  handleExportMatrix('landscape', pendingPreviewOnly);
                }}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 dark:border-gray-600 rounded-2xl hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
              >
                <div className="flex-shrink-0 w-14 h-10 border-2 border-gray-400 group-hover:border-green-500 rounded-md flex items-center justify-center bg-gray-50 dark:bg-gray-700 transition-colors">
                  <div className="w-10 h-6 bg-gray-200 dark:bg-gray-600 rounded-sm flex flex-col gap-0.5 p-0.5 group-hover:bg-green-100 dark:group-hover:bg-green-900/40 transition-colors">
                    <div className="h-1 bg-gray-400 rounded-sm w-full" />
                    <div className="h-0.5 bg-gray-300 rounded-sm w-3/4" />
                    <div className="h-0.5 bg-gray-300 rounded-sm w-1/2" />
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800 dark:text-gray-200 group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">Lanskap (A4 Mendatar)</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sangat direkomendasikan untuk tabel grid multi-kolom</p>
                </div>
              </button>

              {/* Portrait */}
              <button
                onClick={() => {
                  setShowOrientasiModal(false);
                  handleExportMatrix('portrait', pendingPreviewOnly);
                }}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 dark:border-gray-600 rounded-2xl hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all group"
              >
                <div className="flex-shrink-0 w-10 h-14 border-2 border-gray-400 group-hover:border-teal-500 rounded-md flex items-center justify-center bg-gray-50 dark:bg-gray-700 transition-colors">
                  <div className="w-6 h-10 bg-gray-200 dark:bg-gray-600 rounded-sm flex flex-col gap-0.5 p-0.5 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/40 transition-colors">
                    <div className="h-1 bg-gray-400 rounded-sm w-full" />
                    <div className="h-0.5 bg-gray-300 rounded-sm w-3/4" />
                    <div className="h-0.5 bg-gray-300 rounded-sm w-1/2" />
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800 dark:text-gray-200 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">Potret (A4 Tegak)</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tampilan vertikal standar yang lebih ringkas</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
