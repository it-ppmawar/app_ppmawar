'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, Search, Plus, Filter, User, MapPin, CheckSquare, Edit, UserPlus, Camera, RefreshCw, FileText, Download, X, Upload, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';
import Link from 'next/link';

// ====== Avatar Lokal (tanpa service eksternal) ======
const AVATAR_COLORS = [
  '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#ea580c',
  '#0891b2', '#65a30d', '#7c3aed', '#db2777', '#059669',
  '#b45309', '#0284c7', '#be123c', '#4f46e5', '#0f766e',
];
const getInitials = (nama: string): string => {
  if (!nama) return '?';
  const words = nama.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return nama.substring(0, 2).toUpperCase();
};
const getAvatarColor = (nama: string): string => {
  if (!nama) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < nama.length; i++) {
    hash = nama.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export default function DataMuridPage() {
  const [murid, setMurid] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Debounce search agar pengetikan & penghapusan 100% responsif tanpa jeda/lag
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 120);
    return () => clearTimeout(handler);
  }, [search]);

  const [role, setRole] = useState('murid');
  const [userAsrama, setUserAsrama] = useState<string | null>(null);

  // State untuk bulk actions
  const [selectedMurid, setSelectedMurid] = useState<number[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkType, setBulkType] = useState<'madin' | 'madin2' | 'quran' | 'kamar'>('madin');
  const [bulkTargetId, setBulkTargetId] = useState('');
  const [classOptions, setClassOptions] = useState<any[]>([]);
  const [savingBulk, setSavingBulk] = useState(false);

  // State untuk Detail & Edit
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingMurid, setViewingMurid] = useState<any>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMurid, setEditingMurid] = useState<any>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);

  // Helper untuk menentukan URL Foto Santri (Lokal vs Mitra)
  const getFotoUrl = (fotoName: string | null) => {
    if (!fotoName || fotoName === '-') return '';
    // Sudah berupa URL lengkap
    if (fotoName.startsWith('http://') || fotoName.startsWith('https://')) {
      return fotoName;
    }
    
    // File lokal yang di-upload dari sistem kita sendiri
    if (fotoName.startsWith('foto_') || fotoName.startsWith('upload_') || fotoName.startsWith('profil_')) {
      return `/uploads/${fotoName}`;
    }

    // Gunakan environment variable jika tersedia, fallback ke default path
    const baseUrl = process.env.NEXT_PUBLIC_API_MITRA_FOTO_URL || 'https://mawar.smartpesantren.id/sekretariat/berkas/';
    const cleanFotoName = fotoName.startsWith('/') ? fotoName.substring(1) : fotoName;
    
    // Jika fotoName sudah mengandung 'sekretariat/berkas', jangan tambahkan lagi
    if (cleanFotoName.includes('sekretariat/berkas')) {
      return `https://mawar.smartpesantren.id/${cleanFotoName}`;
    }
    
    return `${baseUrl}${cleanFotoName}`;
  };


  // State untuk filter
  const [showFilters, setShowFilters] = useState(true);
  const [filterMadin, setFilterMadin] = useState('');
  const [filterQuran, setFilterQuran] = useState('');
  const [filterKamar, setFilterKamar] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [allMadin, setAllMadin] = useState<any[]>([]);
  const [allQuran, setAllQuran] = useState<any[]>([]);
  const [allKamar, setAllKamar] = useState<any[]>([]);

  // Jadwal-based filter visibility
  const [hasQuranJadwal, setHasQuranJadwal] = useState(true);
  const [hasMadinJadwal, setHasMadinJadwal] = useState(true);

  // Export State
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  // State untuk sinkronisasi API Mitra
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // State untuk Tambah Santri Baru
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    nama: '', nis: '', jenis_kelamin: 'Laki-laki',
    kelas_madin_id: '', kelas_quran_id: '', kamar_id: '',
    no_hp_wali: '', nama_wali: '', alamat: ''
  });

  // State untuk sinkronisasi Kelas Madin (Excel 2026-2027)
  const [syncingMadin, setSyncingMadin] = useState(false);
  const [madinSyncResult, setMadinSyncResult] = useState<any>(null);
  const [isMadinModalOpen, setIsMadinModalOpen] = useState(false);

  // State untuk Impor Cerdas (Upload File Excel/ZIP & Sync in-memory)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadMode, setUploadMode] = useState<string>('');
  const [uploadResult, setUploadResult] = useState<any>(null);

  const handleAddSantri = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.nama.trim()) { alert('Nama santri wajib diisi'); return; }
    setSavingAdd(true);
    try {
      const res = await fetch('/api/murid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm)
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${data.message}\nNIS: ${data.nis}`);
        setIsAddModalOpen(false);
        setAddForm({ nama: '', nis: '', jenis_kelamin: 'Laki-laki', kelas_madin_id: '', kelas_quran_id: '', kamar_id: '', no_hp_wali: '', nama_wali: '', alamat: '' });
        // Refresh data
        const refreshRes = await fetch('/api/murid');
        const refreshJson = await refreshRes.json();
        if (refreshJson.success) setMurid(refreshJson.data);
      } else {
        alert('❌ Gagal: ' + (data.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    } finally {
      setSavingAdd(false);
    }
  };

  const handleSmartUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFiles || uploadFiles.length === 0) {
      alert('Silakan pilih minimal satu file Excel (.xlsx) atau file (.zip) terlebih dahulu.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      uploadFiles.forEach(f => {
        formData.append('files', f);
      });
      if (uploadMode) {
        formData.append('mode', uploadMode);
      }
      const res = await fetch('/api/sync/upload-file', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setUploadResult(data);
        const refreshRes = await fetch('/api/murid');
        const refreshJson = await refreshRes.json();
        if (refreshJson.success) {
          setMurid(refreshJson.data);
          fetchFilters();
        }
      } else {
        alert(data.error || 'Gagal memproses file upload');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const fetchFilters = async () => {
    try {
      const [resMadin, resQuran, resKamar] = await Promise.all([
        fetch('/api/kelas?type=madin'),
        fetch('/api/kelas?type=quran'),
        fetch('/api/kelas?type=kamar')
      ]);
      const [jsonMadin, jsonQuran, jsonKamar] = await Promise.all([
        resMadin.json(),
        resQuran.json(),
        resKamar.json()
      ]);
      if (jsonMadin.success) setAllMadin(jsonMadin.data);
      if (jsonQuran.success) setAllQuran(jsonQuran.data);
      if (jsonKamar.success) setAllKamar(jsonKamar.data);
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  };

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success) {
          setRole(data.user.role);
          setUserAsrama(data.user.namaAsrama || null);
          // Admin/staff selalu lihat semua filter
          if (data.user.role === 'admin' || data.user.role === 'staff') {
            setHasQuranJadwal(true);
            setHasMadinJadwal(true);
            return;
          }
        }
      } catch (err) { }
    };

    const fetchJadwalVisibility = async () => {
      try {
        const res = await fetch('/api/jadwal');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const jadwal: any[] = json.data;
          setHasQuranJadwal(jadwal.some((j: any) => j.tipe === 'quran'));
          setHasMadinJadwal(jadwal.some((j: any) => j.tipe === 'madin'));
        }
      } catch (err) {}
    };

    fetchMe();
    fetchFilters();
    fetchJadwalVisibility();

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/murid');
        const json = await res.json();
        if (json.success) setMurid(json.data);
      } catch (err) {
        console.error('Failed to fetch murid:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleConvertUser = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin membuat/memperbarui User Wali Murid untuk Santri ini?')) return;
    try {
      const res = await fetch('/api/users/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'murid', id })
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

  useEffect(() => {
    if (!isBulkModalOpen) return;
    const fetchOptions = async () => {
      try {
        const apiType = bulkType === 'madin2' ? 'madin' : bulkType;
        const res = await fetch(`/api/kelas?type=${apiType}`);
        const json = await res.json();
        if (json.success) setClassOptions(json.data);
      } catch (err) {
        console.error('Failed to fetch options', err);
      }
    };
    fetchOptions();
  }, [isBulkModalOpen, bulkType]);

  const handleLuluskan = async (id: number) => {
    if (!confirm('Pindahkan santri ini ke daftar Alumni? Data santri akan dipindahkan ke tabel Alumni dan Akun User terkait akan dikonversi menjadi role Alumni (tidak dihapus).')) return;
    try {
      const res = await fetch('/api/murid/lulus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setMurid(murid.filter(m => m.murid_id !== id));
      } else {
        alert(data.error || 'Gagal memproses data');
      }
    } catch (err) {
      alert('Terjadi kesalahan sistem');
    }
  };

  const handleConvertUserBulk = async () => {
    if (!confirm(`Apakah Anda yakin ingin membuat/memperbarui User Wali Murid untuk ${selectedMurid.length} Santri ini?`)) return;
    try {
      const res = await fetch('/api/users/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'murid', ids: selectedMurid })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setSelectedMurid([]);
      } else {
        alert(data.error || 'Terjadi kesalahan');
      }
    } catch (err) {
      alert('Gagal melakukan konversi user massal');
    }
  };

  const handleLuluskanBulk = async () => {
    if (!confirm(`Pindahkan ${selectedMurid.length} santri ini ke daftar Alumni? Data santri akan dipindahkan ke tabel Alumni dan Akun User terkait akan dikonversi menjadi role Alumni (tidak dihapus).`)) return;
    try {
      const res = await fetch('/api/murid/lulus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedMurid })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setMurid(murid.filter(m => !selectedMurid.includes(m.murid_id)));
        setSelectedMurid([]);
      } else {
        alert(data.error || 'Gagal memproses data');
      }
    } catch (err) {
      alert('Terjadi kesalahan sistem');
    }
  };

  const handleViewDetail = (item: any) => {
    setViewingMurid(item);
    setIsDetailModalOpen(true);
  };

  const handleEditClick = (item: any) => {
    setEditingMurid(item);
    setPhotoFile(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      let fotoName = editingMurid.foto;

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
          setSavingEdit(false);
          return;
        }
      }

      const res = await fetch('/api/murid', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingMurid, foto: fotoName })
      });
      const json = await res.json();
      if (json.success) {
        const quranObj = allQuran.find(q => String(q.id || q.kelas_id) === String(editingMurid.kelas_quran_id));
        const kamarObj = allKamar.find(k => String(k.id || k.kamar_id) === String(editingMurid.kamar_id));
        const madin1Obj = allMadin.find(m => String(m.id || m.kelas_id) === String(editingMurid.kelas_madin_id));
        const madin2Obj = allMadin.find(m => String(m.id || m.kelas_id) === String(editingMurid.kelas_madin_2_id));

        const updatedMuridObj = {
          ...editingMurid,
          foto: fotoName,
          kelas_madin: madin1Obj ? (madin1Obj.nama || madin1Obj.nama_kelas) : (editingMurid.kelas_madin_id ? editingMurid.kelas_madin : null),
          kelas_madin_2: madin2Obj ? (madin2Obj.nama || madin2Obj.nama_kelas) : (editingMurid.kelas_madin_2_id ? editingMurid.kelas_madin_2 : null),
          kelas_quran: quranObj ? (quranObj.nama || quranObj.nama_kelas) : (editingMurid.kelas_quran_id ? editingMurid.kelas_quran : null),
          nama_kamar: kamarObj ? (kamarObj.nama_asrama ? `${kamarObj.nama_asrama} - ${kamarObj.nama || kamarObj.nama_kamar}` : (kamarObj.nama || kamarObj.nama_kamar)) : (editingMurid.kamar_id ? editingMurid.nama_kamar : null),
        };

        setMurid(murid.map(m => m.murid_id === editingMurid.murid_id ? updatedMuridObj : m));
        setIsEditModalOpen(false);
      } else {
        alert('Gagal menyimpan: ' + json.error);
      }
    } catch (err) {
      alert('Terjadi kesalahan sistem saat menyimpan.');
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredMurid = useMemo(() => {
    const s = debouncedSearch.trim().toLowerCase();

    // Tentukan batasan gender jika role adalah pengurus_asrama
    let genderConstraint: string | null = null;
    if (role === 'pengurus_asrama' && userAsrama) {
      const asr = userAsrama.toLowerCase();
      if (asr.includes('asrama a') || asr === 'a') {
        genderConstraint = 'Laki-laki';
      } else if (
        asr.includes('asrama b') ||
        asr.includes('asrama c') ||
        asr.includes('asrama d') ||
        asr.includes('asrama e') ||
        asr.includes('asrama f') ||
        ['b', 'c', 'd', 'e', 'f'].includes(asr.trim())
      ) {
        genderConstraint = 'Perempuan';
      }
    }

    return murid.filter(m => {
      const matchSearch = !s || (
        (m.nama && m.nama.toLowerCase().includes(s)) ||
        (m.nis && m.nis.toLowerCase().includes(s)) ||
        (m.kelas_madin && m.kelas_madin.toLowerCase().includes(s)) ||
        (m.kelas_quran && m.kelas_quran.toLowerCase().includes(s)) ||
        (m.nama_kamar && m.nama_kamar.toLowerCase().includes(s)) ||
        (m.alamat && m.alamat.toLowerCase().includes(s))
      );

      const matchMadin = filterMadin
        ? (filterMadin === '__none__' 
            ? ((!m.kelas_madin || m.kelas_madin === '-') && (!m.kelas_madin_2 || m.kelas_madin_2 === '-') && (!genderConstraint || m.jenis_kelamin === genderConstraint)) 
            : (m.kelas_madin === filterMadin || m.kelas_madin_2 === filterMadin))
        : true;

      const matchQuran = filterQuran
        ? (filterQuran === '__none__' 
            ? ((!m.kelas_quran || m.kelas_quran === '-') && (!genderConstraint || m.jenis_kelamin === genderConstraint)) 
            : m.kelas_quran === filterQuran)
        : true;

      const matchKamar = filterKamar
        ? (filterKamar === '__none__' 
            ? ((!m.nama_kamar || m.nama_kamar === '-') && (!genderConstraint || m.jenis_kelamin === genderConstraint)) 
            : m.nama_kamar === filterKamar)
        : true;

      return matchSearch && matchMadin && matchQuran && matchKamar;
    });
  }, [murid, debouncedSearch, filterMadin, filterQuran, filterKamar, role, userAsrama]);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Helper: normalisasi nilai sort agar tanda baca (titik, koma, dll) tidak mempengaruhi urutan
  const normalizeSortKey = (val: string): string =>
    val
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const sortedMurid = useMemo(() => {
    if (!sortConfig) return filteredMurid;
    return [...filteredMurid].sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      const strA = normalizeSortKey(valA.toString());
      const strB = normalizeSortKey(valB.toString());

      const compareResult = strA.localeCompare(strB, 'id', { numeric: true, sensitivity: 'base' });
      return sortConfig.direction === 'ascending' ? compareResult : -compareResult;
    });
  }, [filteredMurid, sortConfig]);

  const totalPages = Math.ceil(sortedMurid.length / pageSize) || 1;
  const paginatedMurid = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedMurid.slice(start, start + pageSize);
  }, [sortedMurid, currentPage, pageSize]);

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return ' ⇅';
    return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  };

  const toggleSelectAll = () => {
    if (selectedMurid.length === filteredMurid.length) {
      setSelectedMurid([]);
    } else {
      setSelectedMurid(filteredMurid.map(m => m.murid_id));
    }
  };

  const toggleSelect = (id: number) => {
    if (selectedMurid.includes(id)) {
      setSelectedMurid(selectedMurid.filter(m => m !== id));
    } else {
      setSelectedMurid([...selectedMurid, id]);
    }
  };

  const handleExport = (format: 'pdf' | 'excel' = 'pdf', previewOnly = false) => {
    const exportData = selectedMurid.length > 0 
      ? sortedMurid.filter(m => selectedMurid.includes(m.murid_id))
      : sortedMurid;

    if (exportData.length === 0) {
      alert('Tidak ada data untuk di-export.');
      return;
    }

    const title = 'DATA SANTRI';
    const subtitle = `Filter: ${filterMadin || 'Semua Madin'} | ${filterQuran || "Semua Qur'an"} | ${filterKamar || 'Semua Kamar'}`;
    const filename = `Data_Santri`;

    const tableColumn = ["NO", "NIS", "NAMA LENGKAP", "J. KELAMIN", "KELAS MADIN", "KELAS QUR'AN", "KAMAR"];
    const tableRows: any[] = [];

    exportData.forEach((item, idx) => {
      tableRows.push([
        idx + 1,
        item.nis || '-',
        item.nama,
        item.jenis_kelamin || '-',
        item.kelas_madin || '-',
        item.kelas_quran || '-',
        item.nama_kamar || '-'
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

  const openBulkModal = (type: 'madin' | 'madin2' | 'quran' | 'kamar') => {
    setBulkType(type);
    setBulkTargetId('');
    setClassOptions([]);
    setIsBulkModalOpen(true);
  };

  const handleSaveBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkTargetId || selectedMurid.length === 0) return;

    setSavingBulk(true);
    try {
      const payload: any = { murid_ids: selectedMurid };
      if (bulkType === 'madin') payload.kelas_madin_id = bulkTargetId;
      else if (bulkType === 'madin2') payload.kelas_madin_2_id = bulkTargetId;
      else if (bulkType === 'quran') payload.kelas_quran_id = bulkTargetId;
      else payload.kamar_id = bulkTargetId;

      const res = await fetch('/api/murid', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        // Update local state
        const targetOption = classOptions.find(o => o.id == bulkTargetId);
        const targetName = targetOption ? targetOption.nama : bulkTargetId;

        setMurid(murid.map(m => {
          if (selectedMurid.includes(m.murid_id)) {
            if (bulkType === 'madin') return { ...m, kelas_madin_id: bulkTargetId, kelas_madin: targetName };
            if (bulkType === 'madin2') return { ...m, kelas_madin_2_id: bulkTargetId, kelas_madin_2: targetName };
            if (bulkType === 'quran') return { ...m, kelas_quran_id: bulkTargetId, kelas_quran: targetName };
            if (bulkType === 'kamar') return { ...m, kamar_id: bulkTargetId, nama_kamar: targetName };
          }
          return m;
        }));
        setSelectedMurid([]);
        setIsBulkModalOpen(false);
        alert('Data berhasil diperbarui secara massal!');
      } else {
        alert('Gagal memperbarui: ' + json.error);
      }
    } catch (err) {
      alert('Terjadi kesalahan sistem.');
    } finally {
      setSavingBulk(false);
    }
  };

  const handleSyncMitra = async () => {
    if (!confirm('Apakah Anda yakin ingin melakukan sinkronisasi data santri dengan API Mitra Pembayaran sekarang? Proses ini akan mengunduh data terbaru dan memperbarui database absensi.')) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/sync/murid');
      const data = await res.json();
      if (data.success) {
        setSyncResult(data);
        setIsSyncModalOpen(true);
        // Refresh data murid di tabel
        const refreshRes = await fetch('/api/murid');
        const refreshJson = await refreshRes.json();
        if (refreshJson.success) {
          setMurid(refreshJson.data);
          fetchFilters();
        }
      } else {
        alert('Gagal sinkronisasi: ' + (data.error || data.message || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('Gagal menghubungi server sinkronisasi: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncMadin = async (registerMissing = false) => {
    setSyncingMadin(true);
    try {
      const res = await fetch('/api/sync/kelas-madin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registerMissing })
      });
      const data = await res.json();
      if (data.success) {
        setMadinSyncResult(data);
        setIsMadinModalOpen(true);
        // Refresh data murid di tabel
        const refreshRes = await fetch('/api/murid');
        const refreshJson = await refreshRes.json();
        if (refreshJson.success) {
          setMurid(refreshJson.data);
          fetchFilters();
        }
      } else {
        alert('Gagal sinkronisasi Madin: ' + (data.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSyncingMadin(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header Halaman */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-3xl p-6 shadow-sm border border-blue-200 dark:border-blue-800/50 relative overflow-hidden transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-blue-200/50 dark:text-blue-800/30">
          <Users size={120} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-blue-800 dark:text-blue-400 drop-shadow-sm flex items-center gap-2">
              <Users size={28} /> Data Santri
            </h1>
            <p className="text-blue-600 dark:text-blue-300 text-sm mt-1 font-medium max-w-xs">
              Manajemen informasi santri PPMA. Total {murid.length} santri terdaftar.
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
              onClick={() => handleExport('pdf', false)}
              className="flex-1 md:flex-none justify-center px-3 py-2 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5"
              title="Export PDF"
            >
              <Download size={14} /> PDF
            </button>
            <button
              onClick={() => handleExport('excel', false)}
              className="flex-1 md:flex-none justify-center px-3 py-2 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors flex items-center gap-1.5"
              title="Export Excel"
            >
              <Download size={14} /> Excel
            </button>
            {(role === 'admin' || role === 'staff') && (
              <button
                onClick={handleSyncMitra}
                disabled={syncing}
                className="flex-1 md:flex-none justify-center px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-75"
                title="Sinkronisasi Data Mitra"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{syncing ? 'Sinkronisasi...' : 'Sinkronisasi'}</span>
                <span className="sm:hidden">{syncing ? '...' : 'Sync'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tombol Aksi Admin */}
      {(role === 'admin' || role === 'staff') && (
        <div className="flex justify-center -mt-2 max-w-lg mx-auto w-full px-4">
          <Link href="/dashboard/pairing" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-2xl shadow-lg shadow-indigo-600/10 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2.5 text-sm font-extrabold tracking-wide border border-indigo-500/50">
            <Camera size={18} className="text-indigo-200" /> Pairing Kartu Barcode Santri
          </Link>
        </div>
      )}

      {/* Panel Filter Dropdown (Terpisah di Atas) */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {hasMadinJadwal && (
            <div>
              <label className="block text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Kelas Madin</label>
              <select
                value={filterMadin}
                onChange={(e) => setFilterMadin(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:text-gray-200 font-medium"
              >
                <option value="">Semua Madin</option>
                <option value="__none__">Belum ada data kelas madin</option>
                {allMadin.map((k) => (
                  <option key={k.id} value={k.nama}>
                    {k.nama}
                  </option>
                ))}
              </select>
            </div>
          )}
          {hasQuranJadwal && (
            <div>
              <label className="block text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Kelas Qur'an</label>
              <select
                value={filterQuran}
                onChange={(e) => setFilterQuran(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-gray-200 font-medium"
              >
                <option value="">Semua Qur'an</option>
                <option value="__none__">Belum ada data kelas qur'an</option>
                {allQuran.map((k) => (
                  <option key={k.id} value={k.nama}>
                    {k.nama}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Kamar Asrama</label>
            <select
              value={filterKamar}
              onChange={(e) => setFilterKamar(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 dark:text-gray-200 font-medium"
            >
              <option value="">Semua Kamar</option>
              <option value="__none__">LPPM</option>
              {allKamar.map((k) => (
                <option key={k.id} value={k.nama}>
                  {k.nama}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ===== TOMBOL AKSI BULK (Muncul di Atas Kartu Tabel jika ada santri terpilih) ===== */}
      {selectedMurid.length > 0 && (role === 'admin' || role === 'staff') && (
        <div className="grid grid-cols-2 gap-2 w-full max-w-md mx-auto sm:max-w-none sm:flex sm:flex-wrap animate-in fade-in duration-200">
          <button onClick={() => openBulkModal('quran')} className="w-full sm:w-auto px-3 py-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5">
            <CheckSquare size={14} /> Pindah Qur&apos;an ({selectedMurid.length})
          </button>
          <button onClick={() => openBulkModal('madin')} className="w-full sm:w-auto px-3 py-2 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border border-teal-200 dark:border-teal-800 rounded-xl text-xs font-bold hover:bg-teal-100 transition-colors flex items-center justify-center gap-1.5">
            <CheckSquare size={14} /> Pindah Madin 1 ({selectedMurid.length})
          </button>
          <button onClick={() => openBulkModal('madin2')} className="w-full sm:w-auto px-3 py-2 bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 rounded-xl text-xs font-bold hover:bg-cyan-100 transition-colors flex items-center justify-center gap-1.5">
            <CheckSquare size={14} /> Set Madin 2 ({selectedMurid.length})
          </button>
          <button onClick={() => openBulkModal('kamar')} className="w-full sm:w-auto px-3 py-2 bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded-xl text-xs font-bold hover:bg-orange-100 transition-colors flex items-center justify-center gap-1.5">
            <CheckSquare size={14} /> Pindah Kamar ({selectedMurid.length})
          </button>
          <button onClick={handleConvertUserBulk} className="w-full sm:w-auto px-3 py-2 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold hover:bg-purple-100 transition-colors flex items-center justify-center gap-1.5">
            <UserPlus size={14} /> Perbarui Akun ({selectedMurid.length})
          </button>
          <button onClick={handleLuluskanBulk} className="w-full sm:w-auto px-3 py-2 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors flex items-center justify-center gap-1.5">
            <CheckSquare size={14} /> Luluskan ({selectedMurid.length})
          </button>
        </div>
      )}

      {/* Tabel Data Murid & Kontrol Pencarian Langsung di Atas Tabel */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
        {/* Panel Kontrol Pencarian (Posisi Persis Secara Langsung di Atas Tabel) */}
        <div className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Cari Nama, NIS, Kelas, Kamar atau Alamat santri..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-200 transition-colors shadow-sm font-medium"
              />
            </div>

            {(role === 'admin' || role === 'staff') && (
              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  onClick={() => {
                    setUploadFiles([]);
                    setUploadMode('');
                    setUploadResult(null);
                    setIsUploadModalOpen(true);
                  }}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-colors flex items-center gap-1.5 shadow-sm shrink-0 whitespace-nowrap"
                  title="Upload & Sinkronkan Cerdas Data Kelas/Kamar dari Excel atau ZIP"
                >
                  <Upload size={14} />
                  <span>Impor Cerdas</span>
                </button>

                <button
                  onClick={() => handleSyncMadin(false)}
                  disabled={syncingMadin}
                  className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-70 shrink-0 whitespace-nowrap"
                  title="Sinkronisasi Pembagian Kelas Madin dari Excel 2026-2027"
                >
                  <RefreshCw size={14} className={syncingMadin ? 'animate-spin' : ''} />
                  <span>{syncingMadin ? 'Sync Madin...' : 'Sync Class Madin'}</span>
                </button>

                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition-colors flex items-center gap-1.5 shadow-sm shrink-0 whitespace-nowrap"
                  title="Tambah Santri Baru"
                >
                  <Plus size={14} />
                  <span>Santri</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-100/80 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs font-extrabold uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
              <tr>
                {(role === 'admin' || role === 'staff') && (
                  <th className="px-4 py-4 w-10 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={selectedMurid.length === filteredMurid.length && filteredMurid.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th className="px-4 py-4 w-12 text-center">FOTO</th>
                <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('nis')}>NIS{getSortIcon('nis')}</th>
                <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('nama')}>NAMA LENGKAP{getSortIcon('nama')}</th>
                <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('jenis_kelamin')}>J. KELAMIN{getSortIcon('jenis_kelamin')}</th>
                <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('kelas_madin')}>KELAS & KAMAR{getSortIcon('kelas_madin')}</th>
                <th className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => requestSort('alamat')}>ALAMAT{getSortIcon('alamat')}</th>
                <th className="px-4 py-4 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">Memuat data santri...</td>
                </tr>
              ) : filteredMurid.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">Data santri tidak ditemukan.</td>
                </tr>
              ) : !showAll && !search && !filterMadin && !filterQuran && !filterKamar ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm font-medium">Gunakan fitur pencarian atau filter di atas untuk menemukan data santri,<br/>atau klik tombol di bawah ini untuk melihat seluruh data santri.</p>
                    <button onClick={() => setShowAll(true)} className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 px-6 py-2.5 rounded-xl font-bold transition-colors text-sm shadow-sm inline-flex items-center gap-2">
                      <Users size={16} /> Tampilkan Semua Data Santri
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedMurid.map((item) => (
                  <tr key={item.murid_id} className={`transition-colors text-gray-700 dark:text-gray-200 ${(role === 'admin' || role === 'staff') && selectedMurid.includes(item.murid_id) ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/50'}`}>
                    {(role === 'admin' || role === 'staff') && (
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={selectedMurid.includes(item.murid_id)}
                          onChange={() => toggleSelect(item.murid_id)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      <div
                        className={`w-10 h-10 rounded-full mx-auto overflow-hidden relative ${item.foto && item.foto !== '-' ? 'cursor-pointer hover:opacity-80' : ''}`}
                        onClick={() => item.foto && item.foto !== '-' ? setZoomPhoto(getFotoUrl(item.foto)) : null}
                      >
                        {/* Avatar inisial lokal — selalu tampil sebagai lapisan dasar */}
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ backgroundColor: getAvatarColor(item.nama) }}
                        >
                          <span className="text-white text-xs font-bold leading-none">{getInitials(item.nama)}</span>
                        </div>
                        {/* Jika ada foto, overlay di atas avatar inisial */}
                        {item.foto && item.foto !== '-' && (
                          <img
                            src={getFotoUrl(item.foto)}
                            alt={item.nama}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.display = 'none'; e.currentTarget.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; }}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {item.nis || '-'}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-white max-w-[180px] whitespace-normal break-words">
                      <div className="line-clamp-3 leading-snug break-words">{item.nama}</div>
                    </td>
                    <td className="px-4 py-3 text-xs uppercase font-medium">
                      {item.jenis_kelamin || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded text-[10px] font-semibold w-max">
                          Madin 1: {item.kelas_madin || '-'}
                        </span>
                        {item.kelas_madin_2 && (
                          <span className="inline-flex items-center gap-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-2 py-0.5 rounded text-[10px] font-semibold w-max">
                            Madin 2: {item.kelas_madin_2}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-semibold w-max">
                          Qur'an: {item.kelas_quran || '-'}
                        </span>
                        <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded text-[10px] font-semibold w-max">
                          <MapPin size={10} /> Kamar: {item.nama_kamar || (item.kamar_id ? `ID ${item.kamar_id}` : '-')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[180px] whitespace-normal break-words" title={item.alamat}>
                      <div className="line-clamp-3 leading-relaxed break-words">{item.alamat || '-'}</div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="grid grid-cols-2 gap-1.5 w-[136px] mx-auto">
                        <button
                          onClick={() => handleViewDetail(item)}
                          className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition shadow-sm flex items-center justify-center gap-1"
                        >
                          Detail
                        </button>
                        {(role === 'admin' || role === 'staff') ? (
                          <>
                            <button
                              onClick={() => handleConvertUser(item.murid_id)}
                              className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg transition shadow-sm flex items-center justify-center gap-1"
                              title="Jadikan User Wali Murid"
                            >
                              <UserPlus size={13} /> Akun
                            </button>
                            <button
                              onClick={() => handleEditClick(item)}
                              className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition shadow-sm flex items-center justify-center gap-1"
                            >
                              Ubah
                            </button>
                            <button
                              onClick={() => handleLuluskan(item.murid_id)}
                              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition shadow-sm flex items-center justify-center gap-1"
                            >
                              Luluskan
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {sortedMurid.length > 0 && (
          <div className="px-4 py-3 bg-gray-50/80 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-400">
            <div>
              Menampilkan <span className="font-bold text-gray-900 dark:text-white">{Math.min((currentPage - 1) * pageSize + 1, sortedMurid.length)}</span> - <span className="font-bold text-gray-900 dark:text-white">{Math.min(currentPage * pageSize, sortedMurid.length)}</span> dari <span className="font-bold text-gray-900 dark:text-white">{sortedMurid.length}</span> santri
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm flex items-center gap-1"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <span className="px-3 py-1.5 font-bold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-xl">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm flex items-center gap-1"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Move Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
            <div className={`p-4 text-white ${bulkType === 'madin' ? 'bg-teal-600' : bulkType === 'madin2' ? 'bg-cyan-600' : bulkType === 'quran' ? 'bg-emerald-600' : 'bg-orange-600'}`}>
              <h2 className="text-lg font-bold">
                Pindah {bulkType === 'madin' ? 'Kelas Madin 1 (Utama)' : bulkType === 'madin2' ? 'Kelas Madin 2 (Sekunder)' : bulkType === 'quran' ? "Kelas Qur'an" : 'Kamar'} Massal
              </h2>
              <p className="text-xs opacity-90 mt-1">{selectedMurid.length} Santri terpilih</p>
            </div>
            <form onSubmit={handleSaveBulk} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Pilih {bulkType === 'kamar' ? 'Kamar' : 'Kelas'} Tujuan
                </label>
                <select
                  value={bulkTargetId}
                  onChange={(e) => setBulkTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="" disabled>-- Pilih Tujuan --</option>
                  {classOptions.map(k => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingBulk || !bulkTargetId}
                  className={`flex-1 py-2 text-white font-bold rounded-xl transition-colors disabled:opacity-50 ${bulkType === 'madin' ? 'bg-teal-600 hover:bg-teal-700' : bulkType === 'quran' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-600'}`}
                >
                  {savingBulk ? 'Memproses...' : 'Pindahkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal View Detail */}
      {isDetailModalOpen && viewingMurid && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-2xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh] mb-16 overflow-hidden">
            <div className="bg-blue-600 dark:bg-blue-900 p-5 text-white flex justify-between items-start shrink-0">
              <div className="flex gap-4 items-center">
                <div
                  className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/30 bg-white/10 flex items-center justify-center cursor-pointer hover:opacity-80 relative"
                  onClick={() => viewingMurid.foto && viewingMurid.foto !== '-' ? setZoomPhoto(getFotoUrl(viewingMurid.foto)) : null}
                >
                  {/* Avatar inisial lokal sebagai lapisan dasar */}
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ backgroundColor: getAvatarColor(viewingMurid.nama) }}
                  >
                    <span className="text-white text-2xl font-bold">{getInitials(viewingMurid.nama)}</span>
                  </div>
                  {/* Foto asli overlay di atas avatar inisial */}
                  {viewingMurid.foto && viewingMurid.foto !== '-' && (
                    <img
                      src={getFotoUrl(viewingMurid.foto)}
                      alt={viewingMurid.nama}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.display = 'none'; e.currentTarget.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; }}
                    />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{viewingMurid.nama} {viewingMurid.nama_panggilan ? `(${viewingMurid.nama_panggilan})` : ''}</h2>
                  <p className="text-xs text-blue-200 font-mono mt-0.5">NIS: {viewingMurid.nis || '-'} | NIK: {viewingMurid.nik || '-'}</p>
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
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">No. WhatsApp / HP</p>
                    <p className="font-semibold">{viewingMurid.no_hp || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Alamat Lengkap</p>
                    <p className="font-semibold leading-relaxed">{viewingMurid.alamat || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nilai Rata-rata</p>
                    <p className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{viewingMurid.nilai || '0.00'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl space-y-2 border border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Data Akademik & Asrama</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Kelas Madin 1:</span>
                      <span className="font-bold">{viewingMurid.kelas_madin || '-'}</span>
                    </div>
                    {viewingMurid.kelas_madin_2 && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Kelas Madin 2:</span>
                        <span className="font-bold text-teal-600 dark:text-teal-400">{viewingMurid.kelas_madin_2}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Kelas Qur'an:</span>
                      <span className="font-bold">{viewingMurid.kelas_quran || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Kamar Asrama:</span>
                      <span className="font-bold">{viewingMurid.nama_kamar || '-'}</span>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl space-y-2 border border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Data Wali</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Nama Wali:</span>
                      <span className="font-bold">{viewingMurid.nama_wali || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">No. HP Wali:</span>
                      <span className="font-bold">{viewingMurid.no_wali || '-'}</span>
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

      {/* Modal Edit Murid */}
      {isEditModalOpen && editingMurid && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-2xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh] mb-10 overflow-hidden">
            <div className="bg-indigo-600 dark:bg-indigo-900 p-5 text-white shrink-0">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Edit size={20} /> Edit Data Santri
              </h2>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-5 overflow-y-auto flex-1">

              <div className="flex flex-col sm:flex-row gap-5">
                <div className="w-full sm:w-1/3 space-y-3">
                  <div className="w-32 h-32 bg-gray-100 dark:bg-gray-900 rounded-2xl mx-auto overflow-hidden border-2 border-dashed border-gray-300 flex items-center justify-center relative">
                    {/* Avatar inisial lokal sebagai lapisan dasar */}
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ backgroundColor: getAvatarColor(editingMurid.nama) }}
                    >
                      <span className="text-gray-700 dark:text-gray-200 text-2xl font-bold opacity-30">{getInitials(editingMurid.nama)}</span>
                    </div>
                    {/* Preview foto baru jika ada */}
                    {photoFile ? (
                      <img src={URL.createObjectURL(photoFile)} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                    ) : editingMurid.foto && editingMurid.foto !== '-' ? (
                      <img
                        src={getFotoUrl(editingMurid.foto)}
                        alt={editingMurid.nama}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.display = 'none'; e.currentTarget.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; }}
                      />
                    ) : null}
                    <label className="absolute bottom-2 bg-black/60 text-white text-[10px] px-3 py-1 rounded-full cursor-pointer hover:bg-black transition-colors">
                      Ubah Foto
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>

                <div className="w-full sm:w-2/3 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Nama Lengkap</label>
                      <input
                        type="text"
                        value={editingMurid.nama || ''}
                        onChange={(e) => setEditingMurid({ ...editingMurid, nama: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Nama Panggilan</label>
                      <input
                        type="text"
                        value={editingMurid.nama_panggilan || ''}
                        onChange={(e) => setEditingMurid({ ...editingMurid, nama_panggilan: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        placeholder="Cth: Ahmad"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">NIS</label>
                      <input
                        type="text"
                        value={editingMurid.nis || ''}
                        onChange={(e) => setEditingMurid({ ...editingMurid, nis: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">NIK</label>
                      <input
                        type="text"
                        value={editingMurid.nik || ''}
                        onChange={(e) => setEditingMurid({ ...editingMurid, nik: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Kode Barcode Card (Scan di sini)</label>
                    <input
                      type="text"
                      value={editingMurid.barcode_id || ''}
                      onChange={(e) => setEditingMurid({ ...editingMurid, barcode_id: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 text-indigo-600 dark:text-indigo-400"
                      placeholder="Arahkan kursor ke sini, lalu scan kartu"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">No. WhatsApp / HP</label>
                  <input
                    type="text"
                    value={editingMurid.no_hp || ''}
                    onChange={(e) => setEditingMurid({ ...editingMurid, no_hp: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Nilai Rata-rata</label>
                  <input
                    type="number" step="0.01"
                    value={editingMurid.nilai || ''}
                    onChange={(e) => setEditingMurid({ ...editingMurid, nilai: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Kelas Madin 1 & 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    🟢 Kelas Madin 1 <span className="text-gray-400 font-normal">(Utama / Malam)</span>
                  </label>
                  <select
                    value={editingMurid.kelas_madin_id || ''}
                    onChange={(e) => setEditingMurid({ ...editingMurid, kelas_madin_id: e.target.value || null })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-green-500 dark:text-gray-200"
                  >
                    <option value="">-- Tidak ada --</option>
                    {allMadin.map((k) => (
                      <option key={k.id || k.kelas_id} value={k.id || k.kelas_id}>{k.nama || k.nama_kelas}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    🩵 Kelas Madin 2 <span className="text-gray-400 font-normal">(Sekunder / Siang / MAK)</span>
                  </label>
                  <select
                    value={editingMurid.kelas_madin_2_id || ''}
                    onChange={(e) => setEditingMurid({ ...editingMurid, kelas_madin_2_id: e.target.value || null })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-teal-200 dark:border-teal-700 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 dark:text-gray-200"
                  >
                    <option value="">-- Tidak ada --</option>
                    {allMadin.map((k) => (
                      <option key={k.id || k.kelas_id} value={k.id || k.kelas_id}>{k.nama || k.nama_kelas}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kelas Al-Qur'an & Kamar Asrama */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    📖 Kelas Al-Qur'an <span className="text-gray-400 font-normal">(Pengajian / Halqah)</span>
                  </label>
                  <select
                    value={editingMurid.kelas_quran_id || ''}
                    onChange={(e) => setEditingMurid({ ...editingMurid, kelas_quran_id: e.target.value || null })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-purple-200 dark:border-purple-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 dark:text-gray-200"
                  >
                    <option value="">-- Tidak ada --</option>
                    {allQuran.map((k) => (
                      <option key={k.id || k.kelas_id} value={k.id || k.kelas_id}>
                        {k.nama || k.nama_kelas} {k.pembina ? `(Guru: ${k.pembina})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    🏠 Kamar Santri <span className="text-gray-400 font-normal">(Kamar & Asrama)</span>
                  </label>
                  <select
                    value={editingMurid.kamar_id || ''}
                    onChange={(e) => setEditingMurid({ ...editingMurid, kamar_id: e.target.value || null })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-amber-200 dark:border-amber-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 dark:text-gray-200"
                  >
                    <option value="">-- Tidak ada --</option>
                    {allKamar.map((k) => (
                      <option key={k.id || k.kamar_id} value={k.id || k.kamar_id}>
                        {k.nama_asrama ? `${k.nama_asrama} - ` : ''}{k.nama || k.nama_kamar} {k.pembina ? `(Pembina: ${k.pembina})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Jenis Kelamin</label>
                <select
                  value={editingMurid.jenis_kelamin || ''}
                  onChange={(e) => setEditingMurid({ ...editingMurid, jenis_kelamin: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Pilih...</option>
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Alamat Lengkap</label>
                <textarea
                  value={editingMurid.alamat || ''}
                  onChange={(e) => setEditingMurid({ ...editingMurid, alamat: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 min-h-[60px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Nama Wali</label>
                  <input
                    type="text"
                    value={editingMurid.nama_wali || ''}
                    onChange={(e) => setEditingMurid({ ...editingMurid, nama_wali: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">No. HP Wali</label>
                  <input
                    type="text"
                    value={editingMurid.no_wali || ''}
                    onChange={(e) => setEditingMurid({ ...editingMurid, no_wali: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
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
                  disabled={savingEdit}
                  className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
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
                <FileText className="text-blue-500" size={20} />
                Preview PDF Data Santri
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('pdf', false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors flex items-center gap-2"
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
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                <FileText size={40} className="text-blue-500" />
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
                  className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-md transition-colors"
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

      {/* Modal Hasil Sinkronisasi */}
      {isSyncModalOpen && syncResult && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white text-center relative">
              <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3">
                <RefreshCw size={32} className="text-white animate-spin-slow" />
              </div>
              <h2 className="text-xl font-black">Sinkronisasi Berhasil!</h2>
              <p className="text-xs text-emerald-100 mt-1">Koneksi API Mitra Pembayaran</p>
            </div>
            <div className="p-6 space-y-4 text-sm text-gray-700 dark:text-gray-200">
              <p className="text-center font-medium text-gray-500 dark:text-gray-400">
                Database absensi telah diperbarui secara real-time dengan data terbaru dari SmartPesantren.
              </p>
              
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Data</div>
                  <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                    {syncResult.total_data_mitra || 0}
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-2xl border border-green-100 dark:border-green-900/30">
                  <div className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Santri Baru</div>
                  <div className="text-xl font-extrabold text-green-600 dark:text-green-400 mt-1">
                    {syncResult.new_students || 0}
                  </div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-2xl border border-purple-100 dark:border-purple-900/30">
                  <div className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">Diperbarui</div>
                  <div className="text-xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">
                    {syncResult.updated_students || 0}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100/50 dark:border-blue-900/30 text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                ℹ️ <strong>Informasi Keamanan:</strong> Kolom <code>barcode_id</code> (kartu QR) santri lama tetap dipertahankan dan tidak ditimpa demi keamanan data kartu absensi.
              </div>

              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-100 mt-2"
              >
                Mantap, Selesai!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hasil Sinkronisasi Kelas Madin */}
      {isMadinModalOpen && madinSyncResult && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white text-center relative">
              <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3">
                <RefreshCw size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-black">Sinkronisasi Madin Selesai!</h2>
              <p className="text-xs text-indigo-100 mt-1">Pembagian Kelas JADWAL MADIN 2026-2027</p>
            </div>
            <div className="p-6 space-y-4 text-sm text-gray-700 dark:text-gray-200">
              <p className="text-center font-medium text-gray-500 dark:text-gray-400">
                {madinSyncResult.message}
              </p>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-indigo-50 dark:bg-indigo-950/20 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                  <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Diperbarui</div>
                  <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
                    {madinSyncResult.details?.updatedCount || 0}
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                  <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Belum Ada di DB</div>
                  <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                    {madinSyncResult.details?.totalExcel - madinSyncResult.details?.updatedCount - madinSyncResult.details?.skippedCount || 0}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMadinModalOpen(false)}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold rounded-2xl shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-100 mt-2"
              >
                Tutup & Lihat Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Impor Cerdas (Upload & Sync in-memory) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white text-center relative">
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              <div className="mx-auto w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-2">
                <Upload size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-black">Impor Cerdas & Sinkronisasi</h2>
              <p className="text-xs text-emerald-100 mt-1">Zero-Disk Storage — File langsung diproses di memori & tanpa disimpan di server</p>
            </div>

            <div className="p-6 space-y-5">
              {!uploadResult ? (
                <form onSubmit={handleSmartUpload} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      1. Mode Sinkronisasi Data:
                    </label>
                    <select
                      value={uploadMode}
                      onChange={(e) => setUploadMode(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-200"
                    >
                      <option value="">✨ Auto-Detect Tipe Data (Rekomendasi)</option>
                      <option value="madin">📚 Kelas Madin (Ula, Wustho, MAK)</option>
                      <option value="quran">📖 Kelas Qur'an (Tahfidz / TQ)</option>
                      <option value="kamar">🏠 Kamar Asrama Santri</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      2. Pilih File (.xlsx / .zip):
                    </label>
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-5 text-center hover:border-emerald-500 transition-colors bg-gray-50/50 dark:bg-gray-900/30">
                      <input
                        type="file"
                        accept=".xlsx,.xls,.zip"
                        multiple
                        onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                        className="hidden"
                        id="smart-upload-file-input"
                      />
                      <label htmlFor="smart-upload-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                        <FileSpreadsheet size={36} className="text-emerald-500" />
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                          {uploadFiles.length > 0
                            ? uploadFiles.length === 1
                              ? uploadFiles[0].name
                              : `${uploadFiles.length} file dipilih: ${uploadFiles.map(f => f.name).join(', ')}`
                            : 'Klik atau drag untuk memilih file Excel (.xlsx) atau .zip'}
                        </span>
                        <span className="text-xs text-gray-400">Format internal madin, quran, atau kamar akan dideteksi secara otomatis</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 items-stretch">
                    <button
                      type="button"
                      onClick={() => setIsUploadModalOpen(false)}
                      className="w-full sm:w-1/3 py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-2xl transition-colors text-xs sm:text-sm text-center"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={uploading || uploadFiles.length === 0}
                      className="w-full sm:w-2/3 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs sm:text-sm shrink-0"
                    >
                      {uploading ? (
                        <>
                          <RefreshCw size={16} className="animate-spin shrink-0" />
                          <span className="truncate">Memproses In-Memory...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={16} className="shrink-0" />
                          <span className="truncate">Unggah & Sinkronkan</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4 rounded-2xl text-center space-y-1">
                    <h3 className="font-extrabold text-emerald-800 dark:text-emerald-300 text-base">
                      {uploadResult.message}
                    </h3>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      Mode Terdeteksi: <span className="uppercase font-bold">{uploadResult.detectedMode}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="text-gray-400 text-[10px]">Total Parsed</div>
                      <div className="text-base font-black text-blue-600 dark:text-blue-400 mt-1">{uploadResult.details?.totalParsed || 0}</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-xl border border-green-200 dark:border-green-800">
                      <div className="text-green-500 text-[10px]">Di-update (DB)</div>
                      <div className="text-base font-black text-green-600 dark:text-green-400 mt-1">{uploadResult.details?.updatedCount || 0}</div>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                      <div className="text-amber-500 text-[10px]">Belum Ada di DB</div>
                      <div className="text-base font-black text-amber-600 dark:text-amber-400 mt-1">{uploadResult.details?.notFoundCount || 0}</div>
                    </div>
                  </div>

                  {uploadResult.notFound && uploadResult.notFound.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        Santri di File Belum Ada di DB ({uploadResult.notFound.length} santri):
                      </h4>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-700/50 text-xs">
                        {uploadResult.notFound.map((nf: any, idx: number) => (
                          <div key={idx} className="p-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{nf.nama}</span>
                            <span className="text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-[10px]">{nf.kelasKamar}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsUploadModalOpen(false);
                      setUploadResult(null);
                      setUploadFiles([]);
                    }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-md transition-colors text-sm"
                  >
                    Selesai & Tutup
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Tambah Santri Baru ──────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                  <UserPlus size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-white font-extrabold text-lg">Tambah Santri Baru</h2>
                  <p className="text-blue-100 text-xs">NIS akan di-generate otomatis jika dikosongkan</p>
                </div>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddSantri} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Nama */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.nama}
                  onChange={e => setAddForm(f => ({ ...f, nama: e.target.value }))}
                  placeholder="Contoh: AHMAD FAUZI RAHMAN"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white uppercase"
                  required
                  style={{ textTransform: 'uppercase' }}
                />
              </div>

              {/* NIS & Gender dalam satu baris */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">NIS</label>
                  <input
                    type="text"
                    value={addForm.nis}
                    onChange={e => setAddForm(f => ({ ...f, nis: e.target.value }))}
                    placeholder="Auto (kosongkan)"
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Jenis Kelamin <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={addForm.jenis_kelamin}
                    onChange={e => setAddForm(f => ({ ...f, jenis_kelamin: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
              </div>

              {/* Kelas Madin, Kelas Quran & Kamar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Kelas Madin</label>
                  <select
                    value={addForm.kelas_madin_id}
                    onChange={e => setAddForm(f => ({ ...f, kelas_madin_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">-- Pilih Madin --</option>
                    {allMadin.map((k: any) => (
                      <option key={k.id || k.kelas_id} value={k.id || k.kelas_id}>{k.nama || k.nama_kelas}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Kelas Qur'an</label>
                  <select
                    value={addForm.kelas_quran_id}
                    onChange={e => setAddForm(f => ({ ...f, kelas_quran_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">-- Pilih Qur'an --</option>
                    {allQuran.map((k: any) => (
                      <option key={k.id || k.kelas_id} value={k.id || k.kelas_id}>{k.nama || k.nama_kelas}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Kamar Santri</label>
                  <select
                    value={addForm.kamar_id}
                    onChange={e => setAddForm(f => ({ ...f, kamar_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">-- Pilih Kamar --</option>
                    {allKamar.map((k: any) => (
                      <option key={k.id || k.kamar_id} value={k.id || k.kamar_id}>
                        {k.nama_asrama ? `${k.nama_asrama} - ` : ''}{k.nama || k.nama_kamar}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nama Wali & No HP Wali */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Nama Wali</label>
                  <input
                    type="text"
                    value={addForm.nama_wali}
                    onChange={e => setAddForm(f => ({ ...f, nama_wali: e.target.value }))}
                    placeholder="Nama orang tua/wali"
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">No HP Wali</label>
                  <input
                    type="text"
                    value={addForm.no_hp_wali}
                    onChange={e => setAddForm(f => ({ ...f, no_hp_wali: e.target.value }))}
                    placeholder="08xxxxxxxxxx"
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Alamat */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Alamat</label>
                <textarea
                  value={addForm.alamat}
                  onChange={e => setAddForm(f => ({ ...f, alamat: e.target.value }))}
                  placeholder="Alamat lengkap santri"
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                />
              </div>

              {/* Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-3 text-xs text-blue-700 dark:text-blue-300">
                <strong>ℹ️ Info:</strong> NIS akan di-generate otomatis (format: YYYYMM####) jika dikosongkan. Foto dapat ditambahkan nanti melalui tombol Edit.
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 font-bold rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingAdd}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-2xl shadow-md transition-all disabled:opacity-60 text-sm flex items-center justify-center gap-2"
                >
                  {savingAdd ? (
                    <><RefreshCw size={14} className="animate-spin" /> Menyimpan...</>
                  ) : (
                    <><UserPlus size={14} /> Tambah Santri</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

