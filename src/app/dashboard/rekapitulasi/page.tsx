'use client';

import { useState, useEffect } from 'react';
import { FileText, Clock, CalendarDays, Download, Filter, User, BookOpen, AlertCircle, ArrowRight, Search, Eye, X, Calendar, ToggleLeft, ToggleRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';

export default function RekapitulasiPage() {
  const [role, setRole] = useState('guru');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [sortField, setSortField] = useState<'nama' | 'identifier' | 'hadir' | 'izin' | 'sakit' | 'alpha'>('nama');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  // Filter pencarian nama (client-side)
  const [searchNama, setSearchNama] = useState('');

  // Mode rentang tanggal
  const [modeRentang, setModeRentang] = useState(false);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Default tanggal_dari = awal bulan ini, tanggal_sampai = hari ini
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

  const [filter, setFilter] = useState({
    tipe: 'madin', // madin, quran, kegiatan, guru
    target_id: '',
    bulan: currentMonth.toString(),
    tahun: currentYear.toString(),
    tanggal_dari: firstDayStr,
    tanggal_sampai: todayStr,
  });

  const [options, setOptions] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    // Check User Role
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(d => {
        if (d.success && d.user) {
          setRole(d.user.role);
          if (d.user.role === 'wali_murid' || d.user.role === 'wali_alumni') {
            // Auto fetch for wali murid / wali alumni
            fetchRekap(true);
          } else {
            // Load options for the first time for teachers/admins
            loadOptions('madin');
          }
        }
      })
      .catch(() => setErrorMsg('Gagal memverifikasi akses'));
  }, []);

  const loadOptions = async (tipe: string) => {
    setLoadingOptions(true);
    try {
      const res = await fetch(`/api/kelas?type=${tipe}&aggregate=true`);
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        let optData = json.data as any[];

        // Deduplikasi kamar: jika ada nama yang sama setelah normalisasi (misal A-1 dan A1), ambil satu saja
        if (tipe === 'kegiatan') {
          const seen = new Map<string, boolean>();
          optData = optData.filter((item: any) => {
            // Normalisasi: hilangkan strip, spasi, lowercase untuk perbandingan
            const norm = (item.nama as string).replace(/[-\s]/g, '').toLowerCase();
            if (seen.has(norm)) return false;
            seen.set(norm, true);
            return true;
          });

          // Natural sort: A-1, A-2, ..., A-10 (bukan A-1, A-10, A-2)
          optData.sort((a: any, b: any) => {
            const normA = (a.nama as string).replace(/[-\s]/g, '');
            const normB = (b.nama as string).replace(/[-\s]/g, '');
            const prefA = normA.replace(/[0-9]/g, '');
            const prefB = normB.replace(/[0-9]/g, '');
            if (prefA !== prefB) return prefA.localeCompare(prefB);
            const numA = parseInt(normA.replace(/[^0-9]/g, '') || '0', 10);
            const numB = parseInt(normB.replace(/[^0-9]/g, '') || '0', 10);
            return numA - numB;
          });
        }

        setOptions(optData);
        if (tipe === 'guru') {
          setFilter(prev => ({ ...prev, target_id: 'all' })); // Default to all gurus
        } else {
          setFilter(prev => ({ ...prev, target_id: optData[0].id.toString() }));
        }
      } else {
        setOptions([]);
        setFilter(prev => ({ ...prev, target_id: '' }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleTipeChange = (e: any) => {
    const t = e.target.value;
    if (t === 'guru' && role !== 'admin' && role !== 'staff') {
      return;
    }
    setFilter(prev => ({ ...prev, tipe: t }));
    loadOptions(t);
  };

  const fetchRekap = async (isWaliMurid = false) => {
    if (!isWaliMurid && !filter.target_id) {
      setErrorMsg('Silakan pilih kelas/kamar/target terlebih dahulu');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSearchNama(''); // Reset pencarian saat fetch baru
    try {
      let qs: string;
      if (modeRentang) {
        // Mode rentang: kirim tanggal_dari & tanggal_sampai (tanpa bulan/tahun)
        const p = new URLSearchParams({
          tipe: filter.tipe,
          target_id: filter.target_id,
          tanggal_dari: filter.tanggal_dari,
          tanggal_sampai: filter.tanggal_sampai,
        });
        qs = p.toString();
      } else {
        // Mode bulan: kirim bulan & tahun seperti biasa
        const p = new URLSearchParams({
          tipe: filter.tipe,
          target_id: filter.target_id,
          bulan: filter.bulan,
          tahun: filter.tahun,
        });
        qs = p.toString();
      }
      const res = await fetch(`/api/rekapitulasi?${qs}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setSelectedIds(json.data.map((d: any) => d.id));
      } else {
        setErrorMsg(json.error);
      }
    } catch (e) {
      setErrorMsg('Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: 'nama' | 'identifier' | 'hadir' | 'izin' | 'sakit' | 'alpha') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'nama' || field === 'identifier' ? 'asc' : 'desc');
    }
  };

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const sortedData = [...data].sort((a, b) => {
    let res = 0;
    if (sortField === 'nama') {
      res = (a.nama || '').localeCompare(b.nama || '');
    } else if (sortField === 'identifier') {
      res = (a.identifier || '').localeCompare(b.identifier || '', undefined, { numeric: true, sensitivity: 'base' });
    } else {
      const valA = Number(a[sortField] || 0);
      const valB = Number(b[sortField] || 0);
      res = valA - valB;
    }
    return sortOrder === 'asc' ? res : -res;
  });

  // Filter client-side berdasarkan searchNama & identifier
  const filteredData = searchNama.trim()
    ? sortedData.filter(item =>
        (item.nama || '').toLowerCase().includes(searchNama.trim().toLowerCase()) ||
        (item.identifier || '').toLowerCase().includes(searchNama.trim().toLowerCase())
      )
    : sortedData;

  const getPeriodText = () => {
    if (modeRentang) {
      const fmt = (d: string) => {
        const dt = new Date(d);
        return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      };
      return `${fmt(filter.tanggal_dari)} s/d ${fmt(filter.tanggal_sampai)}`;
    }
    return `${months[parseInt(filter.bulan) - 1]} ${filter.tahun}`;
  };

  const handleExport = (format: 'pdf' | 'excel' = 'pdf', previewOnly = false) => {
    // Jika ada yang di-checklist, gunakan yang di-checklist. Jika tidak ada, gunakan semua data yang tampil.
    const baseData = searchNama.trim() ? filteredData : sortedData;
    const exportData = selectedIds.length > 0 
      ? baseData.filter(d => selectedIds.includes(d.id))
      : baseData;

    if (exportData.length === 0) {
      alert('Tidak ada data untuk di-export.');
      return;
    }

    let tipeText = '';
    if (filter.tipe === 'madin') tipeText = 'Absensi Madin';
    else if (filter.tipe === 'quran') tipeText = "Absensi Al-Qur'an";
    else if (filter.tipe === 'kegiatan') tipeText = 'Absensi Kegiatan Asrama';
    else if (filter.tipe === 'guru') tipeText = 'Absensi Pengajar / Guru';
    
    const targetName = options.find(o => o.id.toString() === filter.target_id)?.nama || (filter.target_id === 'all' ? 'Semua Guru' : '-');
    
    const title = 'REKAPITULASI KEHADIRAN';
    const subtitle = `Tipe: ${tipeText}\n${filter.tipe === 'guru' ? 'Guru' : 'Kelas/Kamar'}: ${targetName}`;
    const period = getPeriodText();
    const safePeriod = modeRentang
      ? `${filter.tanggal_dari}_sd_${filter.tanggal_sampai}`
      : `${months[parseInt(filter.bulan) - 1]}_${filter.tahun}`;
    const filename = `Rekap_${tipeText.replace(/[^a-zA-Z0-9]/g, '')}_${safePeriod}`;

    const tableColumn = ["No", "Nama Lengkap", "Identifier", "Hadir", "Izin", "Sakit", "Alpha", "% Kehadiran"];
    const tableRows: any[] = [];

    exportData.forEach((item, idx) => {
      const total = Number(item.hadir) + Number(item.izin) + Number(item.sakit) + Number(item.alpha);
      const percent = total === 0 ? "0%" : `${Math.round((Number(item.hadir) / total) * 100)}%`;
      
      tableRows.push([
        idx + 1,
        item.nama,
        item.identifier || '-',
        item.hadir || 0,
        item.izin || 0,
        item.sakit || 0,
        item.alpha || 0,
        percent
      ]);
    });

    if (format === 'excel') {
      exportToExcel({ title, subtitle, period, columns: tableColumn, rows: tableRows, filename });
    } else {
      const result = exportToPDF({ title, subtitle, period, columns: tableColumn, rows: tableRows, filename, previewOnly });
      if (previewOnly && result) {
        setPdfUrl(result);
        setShowPdfPreview(true);
      }
    }
  };

  if (role === 'wali_murid' || role === 'wali_alumni') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-20">
        <div className="bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-indigo-900/40 dark:to-blue-900/40 rounded-3xl p-6 shadow-sm border border-indigo-200 dark:border-indigo-800/50 relative overflow-hidden transition-colors duration-300">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 text-indigo-200/50 dark:text-indigo-800/30">
            <FileText size={120} />
          </div>
          <div className="relative z-10">
            <h1 className="text-2xl font-extrabold text-indigo-800 dark:text-indigo-400 drop-shadow-sm flex items-center gap-2">
              <FileText size={28} /> Rekapitulasi {role === 'wali_alumni' ? 'Alumni' : 'Anak'} Anda
            </h1>
            <p className="text-indigo-600 dark:text-indigo-300 text-sm mt-1 font-medium max-w-md">
              {role === 'wali_alumni' ? 'Laporan ringkas kehadiran anak Anda semasa masih aktif di pesantren.' : 'Laporan ringkas kehadiran santri bulan ini.'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-indigo-500 font-bold animate-pulse">Memuat rekap...</div>
        ) : errorMsg ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center font-bold">{errorMsg}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.map((item, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b dark:border-gray-700">{item.tipe}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-600 dark:text-green-400 font-bold">Hadir</span>
                    <span className="bg-gray-100 dark:bg-gray-900 px-3 py-1 rounded-lg font-mono font-bold">{item.hadir || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">Izin</span>
                    <span className="bg-gray-100 dark:bg-gray-900 px-3 py-1 rounded-lg font-mono font-bold">{item.izin || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-orange-600 dark:text-orange-400 font-bold">Sakit</span>
                    <span className="bg-gray-100 dark:bg-gray-900 px-3 py-1 rounded-lg font-mono font-bold">{item.sakit || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-red-600 dark:text-red-400 font-bold">Alpha</span>
                    <span className="bg-gray-100 dark:bg-gray-900 px-3 py-1 rounded-lg font-mono font-bold">{item.alpha || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // View for Admin, Staff, Guru
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40 rounded-3xl p-6 shadow-sm border border-purple-200 dark:border-purple-800/50 relative overflow-hidden transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-purple-200/50 dark:text-purple-800/30">
          <FileText size={120} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-purple-800 dark:text-purple-400 drop-shadow-sm flex items-center gap-2">
              <FileText size={28} /> Laporan Rekapitulasi
            </h1>
            <p className="text-purple-600 dark:text-purple-300 text-sm mt-1 font-medium max-w-md">
              Filter dan lihat laporan rekap kehadiran kelas dan guru.
            </p>
          </div>
          <div className="flex flex-wrap w-full md:w-auto gap-2 self-start md:self-center">
            <button
              onClick={() => handleExport('pdf', true)}
              className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-white/50 hover:bg-white dark:bg-black/20 dark:hover:bg-black/40 text-purple-800 dark:text-purple-200 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm backdrop-blur-sm text-sm"
            >
              <FileText size={16} /> Preview PDF
            </button>
            <button
              onClick={() => handleExport('pdf', false)}
              className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-purple-600/20 backdrop-blur-sm text-sm"
            >
              <Download size={16} /> PDF
            </button>
            <button
              onClick={() => handleExport('excel', false)}
              className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-green-600/20 backdrop-blur-sm text-sm"
            >
              <Download size={16} /> Excel
            </button>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Pilih Tipe */}
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 mb-1">Pilih Tipe</label>
            <select value={filter.tipe} onChange={handleTipeChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 transition-all">
              <option value="madin">Absensi Madin</option>
              <option value="quran">Absensi Al-Qur'an</option>
              <option value="kegiatan">Absensi Kegiatan Asrama</option>
              {(role === 'admin' || role === 'staff') && (
                <option value="guru">Absensi Pengajar / Guru</option>
              )}
            </select>
          </div>

          {/* Pilih Kelas / Guru */}
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 mb-1">
              {filter.tipe === 'guru' ? 'Pilih Guru' : 'Pilih Kelas / Kamar'}
            </label>
            <select 
              value={filter.target_id} 
              onChange={e => setFilter({...filter, target_id: e.target.value})} 
              disabled={loadingOptions || options.length === 0}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 disabled:opacity-50 focus:ring-2 focus:ring-purple-500 transition-all"
            >
              {loadingOptions ? (
                <option value="">Memuat...</option>
              ) : options.length === 0 ? (
                <option value="">{filter.tipe === 'guru' ? 'Tidak ada data guru' : 'Tidak ada akses / kelas'}</option>
              ) : (
                <>
                  {filter.tipe === 'guru' && <option value="all">Semua Guru</option>}
                  {options.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.nama}</option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Pencarian Manual */}
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 mb-1">
              Cari Nama / {filter.tipe === 'guru' ? 'NIP' : 'NIS'}
            </label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Ketik untuk mencari..."
                value={searchNama}
                onChange={e => setSearchNama(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 transition-all placeholder:font-normal placeholder:text-gray-400"
              />
              {searchNama && (
                <button
                  onClick={() => setSearchNama('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Filter Waktu: toggle mode bulan vs rentang */}
          <div className="flex-1">
            {/* Toggle */}
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-500">
                {modeRentang ? '📅 Rentang Tanggal' : '🗓️ Bulan / Tahun'}
              </label>
              <button
                onClick={() => setModeRentang(v => !v)}
                className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full transition-all ${
                  modeRentang
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}
                title="Ganti mode waktu"
              >
                {modeRentang ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                {modeRentang ? 'Rentang' : 'Bulan'}
              </button>
            </div>

            {modeRentang ? (
              /* Mode rentang tanggal */
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5 font-semibold">Dari</label>
                  <input
                    type="date"
                    value={filter.tanggal_dari}
                    max={filter.tanggal_sampai}
                    onChange={e => setFilter({ ...filter, tanggal_dari: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5 font-semibold">Sampai</label>
                  <input
                    type="date"
                    value={filter.tanggal_sampai}
                    min={filter.tanggal_dari}
                    onChange={e => setFilter({ ...filter, tanggal_sampai: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 transition-all"
                  />
                </div>
              </div>
            ) : (
              /* Mode bulan/tahun */
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5 font-semibold">Bulan</label>
                  <select value={filter.bulan} onChange={e => setFilter({ ...filter, bulan: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 transition-all">
                    {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5 font-semibold">Tahun</label>
                  <select value={filter.tahun} onChange={e => setFilter({ ...filter, tahun: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 transition-all">
                    {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Tombol Tampilkan */}
          <div className="md:w-32 flex items-end">
            <button
              onClick={() => fetchRekap()}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-purple-600/30 transition-all flex justify-center items-center gap-2"
            >
              <Search size={16} /> Tampilkan
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-center font-bold">
          <AlertCircle size={20} className="inline mr-2" /> {errorMsg}
        </div>
      )}

      {!loading && !errorMsg && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
          {/* Status Bar Jumlah & Hint Sort Header */}
          {data.length > 0 && (
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex flex-wrap justify-between items-center text-xs text-gray-500 dark:text-gray-400 gap-2 bg-gray-50/50 dark:bg-gray-900/30">
              <span className="font-medium">
                Menampilkan <strong className="text-gray-800 dark:text-gray-200">{filteredData.length}</strong> dari <strong className="text-gray-800 dark:text-gray-200">{data.length}</strong> data
                {searchNama && <span> untuk kata kunci &quot;<strong className="text-purple-600 dark:text-purple-400">{searchNama}</strong>&quot;</span>}
              </span>
              <span className="text-[11px] text-gray-400 font-medium">
                💡 Klik judul kolom di bawah untuk mengurutkan data
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="px-5 py-4 w-10 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                      checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(filteredData.map(d => d.id));
                        else setSelectedIds([]);
                      }}
                      title="Pilih Semua"
                    />
                  </th>
                  <th className="px-5 py-4 w-10 text-center">NO</th>
                  <th 
                    onClick={() => handleSort('nama')}
                    className="px-5 py-4 cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                    title="Klik untuk mengurutkan berdasarkan nama"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>NAMA LENGKAP</span>
                      {sortField === 'nama' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} className="text-purple-600 dark:text-purple-400" /> : <ArrowDown size={14} className="text-purple-600 dark:text-purple-400" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('hadir')}
                    className="px-5 py-4 text-center cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                    title="Klik untuk mengurutkan berdasarkan jumlah hadir"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>HADIR</span>
                      {sortField === 'hadir' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} className="text-green-600 dark:text-green-400" /> : <ArrowDown size={14} className="text-green-600 dark:text-green-400" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('izin')}
                    className="px-5 py-4 text-center cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                    title="Klik untuk mengurutkan berdasarkan jumlah izin"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>IZIN</span>
                      {sortField === 'izin' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} className="text-blue-600 dark:text-blue-400" /> : <ArrowDown size={14} className="text-blue-600 dark:text-blue-400" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('sakit')}
                    className="px-5 py-4 text-center cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                    title="Klik untuk mengurutkan berdasarkan jumlah sakit"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>SAKIT</span>
                      {sortField === 'sakit' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} className="text-orange-600 dark:text-orange-400" /> : <ArrowDown size={14} className="text-orange-600 dark:text-orange-400" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('alpha')}
                    className="px-5 py-4 text-center cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group"
                    title="Klik untuk mengurutkan berdasarkan jumlah alpha"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>ALPHA</span>
                      {sortField === 'alpha' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} className="text-red-600 dark:text-red-400" /> : <ArrowDown size={14} className="text-red-600 dark:text-red-400" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredData.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-500 font-medium">
                    {data.length === 0 ? 'Klik Tampilkan untuk memuat data.' : `Tidak ada hasil untuk "${searchNama}"`}
                  </td></tr>
                ) : (
                  filteredData.map((item, idx) => {
                    const totalPertemuan = Number(item.hadir) + Number(item.izin) + Number(item.sakit) + Number(item.alpha);
                    const presentase = totalPertemuan === 0 ? 0 : Math.round((Number(item.hadir) / totalPertemuan) * 100);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-4 text-center">
                          <input 
                            type="checkbox" 
                            className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                            checked={selectedIds.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedIds([...selectedIds, item.id]);
                              else setSelectedIds(selectedIds.filter(id => id !== item.id));
                            }}
                          />
                        </td>
                        <td className="px-5 py-4 text-center text-gray-400 font-medium">{idx + 1}</td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-gray-900 dark:text-white">{item.nama}</div>
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">{filter.tipe === 'guru' ? 'NIP' : 'NIS'}: {item.identifier || '-'}</div>
                          {totalPertemuan > 0 && (
                            <div className="mt-2 w-full max-w-[150px] bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 flex overflow-hidden">
                              <div className="bg-green-500 h-full" style={{ width: `${presentase}%` }} title={`Kehadiran ${presentase}%`}></div>
                              {presentase < 100 && <div className="bg-red-400 h-full" style={{ width: `${100 - presentase}%` }}></div>}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center"><span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-3 py-1 rounded-lg font-bold">{item.hadir || 0}</span></td>
                        <td className="px-5 py-4 text-center"><span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1 rounded-lg font-bold">{item.izin || 0}</span></td>
                        <td className="px-5 py-4 text-center"><span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-3 py-1 rounded-lg font-bold">{item.sakit || 0}</span></td>
                        <td className="px-5 py-4 text-center"><span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-3 py-1 rounded-lg font-bold">{item.alpha || 0}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-gray-800 w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <FileText className="text-purple-500" size={20} />
                Preview PDF Laporan
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('pdf', false)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors flex items-center gap-2"
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
              <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center">
                <FileText size={40} className="text-purple-500" />
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
                  className="flex items-center justify-center gap-2 w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl shadow-md transition-colors"
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
