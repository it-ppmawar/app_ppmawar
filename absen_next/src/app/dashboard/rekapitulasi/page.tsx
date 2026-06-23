'use client';

import { useState, useEffect } from 'react';
import { FileText, Clock, CalendarDays, Download, Filter, User, BookOpen, AlertCircle, ArrowRight, Search, Eye, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';

export default function RekapitulasiPage() {
  const [role, setRole] = useState('guru');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [sortBy, setSortBy] = useState<'nama' | 'identifier'>('nama');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [filter, setFilter] = useState({
    tipe: 'madin', // madin, quran, kegiatan, guru
    target_id: '',
    bulan: currentMonth.toString(),
    tahun: currentYear.toString()
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
          if (d.user.role === 'wali_murid') {
            // Auto fetch for wali murid
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
      const res = await fetch(`/api/kelas?type=${tipe}`);
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setOptions(json.data);
        if (tipe === 'guru') {
          setFilter(prev => ({ ...prev, target_id: 'all' })); // Default to all gurus
        } else {
          setFilter(prev => ({ ...prev, target_id: json.data[0].id.toString() }));
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
    try {
      const qs = new URLSearchParams(filter as any).toString();
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

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const sortedData = [...data].sort((a, b) => {
    if (sortBy === 'nama') return (a.nama || '').localeCompare(b.nama || '');
    if (sortBy === 'identifier') {
      return (a.identifier || '').localeCompare(b.identifier || '', undefined, { numeric: true, sensitivity: 'base' });
    }
    return 0;
  });

  const handleExport = (format: 'pdf' | 'excel' = 'pdf', previewOnly = false) => {
    // Jika ada yang di-checklist, gunakan yang di-checklist. Jika tidak ada, gunakan semua data yang tampil.
    const exportData = selectedIds.length > 0 
      ? sortedData.filter(d => selectedIds.includes(d.id))
      : sortedData;

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
    const period = `${months[parseInt(filter.bulan) - 1]} ${filter.tahun}`;
    const filename = `Rekap_${tipeText.replace(/[^a-zA-Z0-9]/g, '')}_${months[parseInt(filter.bulan) - 1]}_${filter.tahun}`;

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

  if (role === 'wali_murid') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-20">
        <div className="bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-indigo-900/40 dark:to-blue-900/40 rounded-3xl p-6 shadow-sm border border-indigo-200 dark:border-indigo-800/50 relative overflow-hidden transition-colors duration-300">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 text-indigo-200/50 dark:text-indigo-800/30">
            <FileText size={120} />
          </div>
          <div className="relative z-10">
            <h1 className="text-2xl font-extrabold text-indigo-800 dark:text-indigo-400 drop-shadow-sm flex items-center gap-2 font-theme-hero">
              <FileText size={28} /> Rekapitulasi Anak Anda
            </h1>
            <p className="text-indigo-600 dark:text-indigo-300 text-sm mt-1 font-medium max-w-md">
              Laporan ringkas kehadiran santri bulan ini.
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
            <h1 className="text-2xl font-extrabold text-purple-800 dark:text-purple-400 drop-shadow-sm flex items-center gap-2 font-theme-hero">
              <FileText size={28} /> Laporan Rekapitulasi
            </h1>
            <p className="text-purple-600 dark:text-purple-300 text-sm mt-1 font-medium max-w-md">
              Filter dan lihat laporan rekap kehadiran kelas dan guru.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => handleExport('pdf', true)}
              className="flex items-center gap-2 bg-white/50 hover:bg-white dark:bg-black/20 dark:hover:bg-black/40 text-purple-800 dark:text-purple-200 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm backdrop-blur-sm w-fit text-sm"
            >
              <FileText size={16} /> Preview PDF
            </button>
            <button
              onClick={() => handleExport('pdf', false)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-purple-600/20 backdrop-blur-sm w-fit text-sm"
            >
              <Download size={16} /> PDF
            </button>
            <button
              onClick={() => handleExport('excel', false)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-green-600/20 backdrop-blur-sm w-fit text-sm"
            >
              <Download size={16} /> Excel
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="flex flex-col md:flex-row gap-4">
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

          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 mb-1">Urutkan Berdasarkan</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 transition-all">
              <option value="nama">Nama (A-Z)</option>
              <option value="identifier">{filter.tipe === 'guru' ? 'NIP' : 'NIS'} (0-9)</option>
            </select>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Bulan</label>
              <select value={filter.bulan} onChange={e => setFilter({ ...filter, bulan: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 transition-all">
                {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Tahun</label>
              <select value={filter.tahun} onChange={e => setFilter({ ...filter, tahun: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 transition-all">
                {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="px-5 py-4 w-10 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                      checked={data.length > 0 && selectedIds.length === data.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(data.map(d => d.id));
                        else setSelectedIds([]);
                      }}
                      title="Pilih Semua"
                    />
                  </th>
                  <th className="px-5 py-4 w-10 text-center">NO</th>
                  <th className="px-5 py-4">NAMA LENGKAP</th>
                  <th className="px-5 py-4 text-center">HADIR</th>
                  <th className="px-5 py-4 text-center">IZIN</th>
                  <th className="px-5 py-4 text-center">SAKIT</th>
                  <th className="px-5 py-4 text-center">ALPHA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-500 font-medium">Klik Tampilkan untuk memuat data.</td></tr>
                ) : (
                  sortedData.map((item, idx) => {
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
