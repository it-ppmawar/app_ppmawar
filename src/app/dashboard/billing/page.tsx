'use client';

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, CheckCircle2, XCircle, Search, Calendar, FileText, AlertCircle, 
  Building2, GraduationCap, RefreshCw, MessageCircle, User, MapPin, Phone, 
  X, ArrowUpDown, ArrowUp, ArrowDown, Eye
} from 'lucide-react';
import Link from 'next/link';

type SortField = 'nama_santri' | 'nama_tagihan' | 'asrama' | 'nominal' | 'status';
type SortOrder = 'asc' | 'desc';

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [tagihan, setTagihan] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isPengasuhUser, setIsPengasuhUser] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState('Semua'); // Semua, Lunas, Belum
  const [filterKategori, setFilterKategori] = useState('Semua'); // Semua, pesantren, madrasah
  const [selectedSubTab, setSelectedSubTab] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('nama_santri');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Modal Image Preview State
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Modal Detail Santri / Tagihan State
  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);

  const fetchBilling = (kategori?: string) => {
    setLoading(true);
    const params = kategori && kategori !== 'Semua' ? `?kategori=${kategori}` : '';
    fetch(`/api/billing${params}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTagihan(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleSyncBilling = async () => {
    if (!confirm('Apakah Anda yakin ingin menyinkronkan data billing dari Google Sheets (KELAS I, II, III)?\nProses ini akan memperbarui data tagihan di database.')) {
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch('/api/sync/billing', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const errMsg = data.errors?.length > 0 ? `\n\nPeringatan (${data.errors.length} error):\n${data.errors.slice(0,3).join('\n')}` : '';
        alert(`✅ Sinkronisasi berhasil!\n\n• ${data.inserted} santri diimpor/diperbarui\n• ${data.skipped} baris dilewati\n• Waktu: ${new Date(data.synced_at).toLocaleString('id-ID')}${errMsg}`);
        fetchBilling(filterKategori);
      } else {
        alert(`❌ Sinkronisasi gagal:\n${data.error || 'Terjadi kesalahan tidak terduga'}`);
      }
    } catch (err: any) {
      alert(`❌ Terjadi kesalahan jaringan: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    // 1. Get User Role
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUserRole(data.user.role);
        }
      })
      .catch(console.error);

    // 2. Fetch Billing Data
    fetchBilling();
  }, []);

  useEffect(() => {
    if (userRole) {
      fetchBilling(filterKategori);
    }
  }, [filterKategori]);

  // Handler Klik Header Kolom Tabel untuk Sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // === FILTER DATA ACCORDING TO SELECTED CATEGORY, SUB-TAB, AND SEARCH ===
  const tabFilteredTagihan = tagihan.filter(t => {
    // 1. Kategori Filter
    if (filterKategori !== 'Semua') {
      if (t.kategori !== filterKategori) return false;

      // 2. Sub Tab Filter
      if (selectedSubTab !== 'Semua') {
        if (filterKategori === 'pesantren') {
          const cleanAsrama = (t.asrama || '').trim().toUpperCase();
          const targetLetter = selectedSubTab.toUpperCase();
          const isMatch =
            cleanAsrama === targetLetter ||
            cleanAsrama === `ASRAMA ${targetLetter}` ||
            cleanAsrama.endsWith(` ${targetLetter}`);
          if (!isMatch) return false;
        } else if (filterKategori === 'madrasah') {
          const cleanAsrama      = (t.asrama || '').trim().toUpperCase();
          const cleanNamaTagihan = (t.nama_tagihan || '').trim().toUpperCase();
          const cleanKamar       = (t.kamar || '').trim().toUpperCase();
          const target = selectedSubTab.toUpperCase();
          const isMatch =
            cleanAsrama.includes(target) ||
            cleanNamaTagihan.includes(target) ||
            cleanKamar.includes(target);
          if (!isMatch) return false;
        }
      }
    }

    // 3. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (t.nama_santri || '').toLowerCase().includes(q) ||
        (t.nis || '').toLowerCase().includes(q) ||
        (t.nama_wali || '').toLowerCase().includes(q) ||
        (t.asrama || '').toLowerCase().includes(q) ||
        (t.kamar || '').toLowerCase().includes(q) ||
        (t.nama_tagihan || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Dynamic Total calculation for the active tab selection
  const dynamicTotalBelum = tabFilteredTagihan
    .filter(t => t.status === 'Belum')
    .reduce((sum, t) => sum + Number(t.nominal || 0), 0);

  const dynamicTotalLunas = tabFilteredTagihan
    .filter(t => t.status === 'Lunas')
    .reduce((sum, t) => sum + Number(t.nominal || 0), 0);

  // Status counts for buttons
  const countSemua = tabFilteredTagihan.length;
  const countBelum = tabFilteredTagihan.filter(t => t.status === 'Belum').length;
  const countLunas = tabFilteredTagihan.filter(t => t.status === 'Lunas').length;

  // Final table list further filtered by status & sorted
  const filteredTagihan = tabFilteredTagihan
    .filter(t => {
      if (filterStatus !== 'Semua' && t.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'nominal') {
        aVal = Number(aVal || 0);
        bVal = Number(bVal || 0);
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
  };

  // Helper untuk format URL WhatsApp
  const formatWaUrl = (noHp: string, namaSantri: string, namaTagihan: string, nominal: number, periode: string) => {
    if (!noHp) return '#';
    let cleanNumber = noHp.replace(/[^0-9]/g, '');
    if (cleanNumber.startsWith('0')) {
      cleanNumber = '62' + cleanNumber.slice(1);
    }
    const message = `Assalamu'alaikum Wr. Wb. Yth. Bapak/Ibu Wali dari Ananda *${namaSantri}*.\n\n` +
      `Melalui pesan ini kami menginformasikan rincian tagihan administrasi ananda:\n` +
      `• Tagihan: ${namaTagihan}\n` +
      `• Periode: ${periode}\n` +
      `• Nominal: *${formatRupiah(nominal)}*\n` +
      `• Status: *Belum Lunas*\n\n` +
      `Informasi selengkapnya dapat dilihat pada tautan berikut: https://app.ppmawar.or.id/dashboard/billing\n\n` +
      `Atas perhatian dan kerjasamanya kami ucapkan terima kasih.\nWassalamu'alaikum Wr. Wb.`;
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-medium animate-pulse">Menghubungkan ke server tagihan...</p>
      </div>
    );
  }

  const isAccessAllowed = userRole && (['admin', 'staff', 'wali_murid', 'pengasuh', 'pengurus_asrama', 'guru'].includes(userRole) || isPengasuhUser);

  if (!isAccessAllowed) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-3xl p-8 border border-red-100 dark:border-red-800/50 shadow-sm text-center max-w-md mx-auto my-12">
        <div className="bg-red-100 dark:bg-red-900/50 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4 text-red-500">
          <AlertCircle size={32} />
        </div>
        <h3 className="text-lg font-bold text-red-800 dark:text-red-400 mb-2">Akses Ditolak</h3>
        <p className="text-sm text-red-600 dark:text-red-300 mb-6">
          Halaman Informasi Tagihan hanya dapat diakses oleh Admin, Staff, Wali Murid, dan Pengasuh.
        </p>
      </div>
    );
  }

  const activeTabLabel = filterKategori === 'Semua' 
    ? 'Semua Kategori' 
    : `${filterKategori === 'pesantren' ? 'Pesantren' : 'Madrasah'}${selectedSubTab !== 'Semua' ? ` • ${selectedSubTab}` : ''}`;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <CreditCard size={120} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Informasi Tagihan & Pembayaran</h1>
            <p className="text-emerald-50 opacity-90 text-sm sm:text-base max-w-xl">
              {userRole === 'wali_murid' 
                ? 'Pantau status pembayaran administrasi putra/putri Anda secara langsung dari sistem.' 
                : (userRole === 'pengasuh' || userRole === 'pengurus_asrama')
                ? 'Pantau status tagihan santri di asrama Anda secara langsung dari sistem keuangan.'
                : 'Dasbor pemantauan status tagihan santri secara menyeluruh dari sistem keuangan pusat.'}
            </p>
          </div>
          {userRole && ['admin', 'staff'].includes(userRole) && (
            <button
              onClick={handleSyncBilling}
              disabled={syncing}
              className="self-start md:self-center px-5 py-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-2xl transition-all flex items-center gap-2 border border-white/20 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Menyinkronkan...' : 'Sinkron Google Sheets'}
            </button>
          )}
        </div>
      </div>

      {/* Info Notice */}
      <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl p-4 flex gap-3 text-sm backdrop-blur-sm">
        <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={20} />
        <p className="text-blue-900 dark:text-blue-200">
          <strong>Perhatian:</strong> Data tagihan ini disinkronisasikan langsung dari sistem pusat Smart Pesantren. Jika terdapat ketidaksesuaian data, silakan hubungi pihak tata usaha (TU) pesantren.
        </p>
      </div>

      {/* Main Content Area */}
      <div className="bg-white dark:bg-gray-800/90 rounded-3xl shadow-md border border-gray-200/80 dark:border-gray-700/80 overflow-hidden backdrop-blur-sm">
        
        {/* Category Filters (for admin/staff only) */}
        {userRole && ['admin', 'staff'].includes(userRole) && (
          <div className="p-4 md:p-5 border-b border-gray-200/80 dark:border-gray-700/80 flex flex-col gap-3">
            <div className="flex flex-col gap-2 w-full">
              <span className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">Kategori Utama</span>
              
              {/* Semua Kategori */}
              <div className="bg-gray-100/70 dark:bg-gray-900/60 p-1.5 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 w-full flex">
                <button 
                  onClick={() => {
                    setFilterKategori('Semua');
                    setSelectedSubTab('Semua');
                  }}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                    filterKategori === 'Semua' 
                      ? 'bg-slate-700 dark:bg-slate-700 text-white shadow-md' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  Semua Kategori
                </button>
              </div>

              {/* Pesantren & Madrasah */}
              <div className="flex bg-gray-100/70 dark:bg-gray-900/60 p-1.5 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 gap-1.5 w-full">
                <button 
                  onClick={() => {
                    setFilterKategori('pesantren');
                    setSelectedSubTab('Semua');
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                    filterKategori === 'pesantren' 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <Building2 size={16} /> Pesantren
                </button>
                <button 
                  onClick={() => {
                    setFilterKategori('madrasah');
                    setSelectedSubTab('Semua');
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                    filterKategori === 'madrasah' 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <GraduationCap size={16} /> Madrasah
                </button>
              </div>
            </div>
            
            {/* Sub-tabs based on Category selection */}
            {filterKategori === 'pesantren' && (
              <div className="flex flex-col gap-2 w-full pt-1">
                <span className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">Sub-Kategori: Asrama</span>
                <div className="flex bg-gray-100/70 dark:bg-gray-900/60 p-1.5 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 overflow-x-auto scrollbar-none gap-1.5 w-full">
                  {['Semua', 'A', 'B', 'C', 'D', 'E', 'F'].map((dorm) => (
                    <button
                      key={dorm}
                      onClick={() => setSelectedSubTab(dorm)}
                      className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                        selectedSubTab === dorm
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      {dorm === 'Semua' ? 'Semua Asrama' : `Asrama ${dorm}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filterKategori === 'madrasah' && (
              <div className="flex flex-col gap-3 w-full pt-1">
                {/* Sub-tab Tingkat Kelas */}
                <div>
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Tingkat Kelas</span>
                  <div className="flex bg-gray-100/70 dark:bg-gray-900/60 p-1.5 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 overflow-x-auto scrollbar-none gap-1.5 w-full">
                    {[
                      { key: 'Semua',    label: 'Semua Kelas' },
                      { key: 'KELAS I',  label: 'Kelas I' },
                      { key: 'KELAS II', label: 'Kelas II' },
                      { key: 'KELAS III',label: 'Kelas III' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setSelectedSubTab(key)}
                        className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                          selectedSubTab === key
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub-tab Unit Sekolah & Diniyah */}
                <div>
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Unit Sekolah & Diniyah</span>
                  <div className="flex bg-gray-100/70 dark:bg-gray-900/60 p-1.5 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 overflow-x-auto scrollbar-none gap-1.5 w-full">
                    {[
                      { key: 'MA',     label: 'MA (Wustho)' },
                      { key: 'MTS',    label: 'MTs (Ula)' },
                      { key: 'SMK',    label: 'SMK (Wustho)' },
                      { key: 'SMP',    label: 'SMP (Ula)' },
                      { key: 'WUSTHO', label: 'Wustho (MA/SMK)' },
                      { key: 'ULA',    label: 'Ula (MTs/SMP)' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setSelectedSubTab(key)}
                        className={`flex-1 min-w-[110px] flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                          selectedSubTab === key
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Catatan Edukasi */}
                <div className="text-xs text-blue-800 dark:text-blue-200 bg-blue-50/80 dark:bg-blue-900/30 p-2.5 rounded-xl border border-blue-200/80 dark:border-blue-800/50 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-blue-500" />
                  <span>
                    <strong>Struktur Tingkatan:</strong> <u>Wustho</u> = MA & SMK | <u>Ula</u> = MTs & SMP. Sistem pembayaran saat ini diprioritaskan untuk sekolah formal <strong>MA</strong>.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status Filters + Search */}
        <div className="p-4 md:p-5 border-b border-gray-200/80 dark:border-gray-700/80 flex flex-col gap-3">
          <div className="flex flex-col gap-2 w-full">
            <span className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">Filter Status</span>
            
            {/* Semua Status */}
            <div className="bg-gray-100/70 dark:bg-gray-900/60 p-1.5 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 w-full flex">
              <button 
                onClick={() => setFilterStatus('Semua')}
                className={`w-full flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                  filterStatus === 'Semua' 
                    ? 'bg-slate-700 dark:bg-slate-700 text-white shadow-md' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                }`}
              >
                Semua ({countSemua})
              </button>
            </div>

            {/* Belum Lunas & Sudah Lunas */}
            <div className="flex bg-gray-100/70 dark:bg-gray-900/60 p-1.5 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 gap-1.5 w-full">
              <button 
                onClick={() => setFilterStatus('Belum')}
                className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                  filterStatus === 'Belum' 
                    ? 'bg-red-600 text-white shadow-md' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                }`}
              >
                Belum Lunas ({countBelum})
              </button>
              <button 
                onClick={() => setFilterStatus('Lunas')}
                className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                  filterStatus === 'Lunas' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                }`}
              >
                Sudah Lunas ({countLunas})
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="w-full pt-1">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Cari nama santri, NIS, nama wali, asrama..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Summary Cards - NEW SLEEK DESIGN */}
        <div className="p-4 md:p-5 bg-slate-900/90 dark:bg-slate-950/90 border-b border-gray-700/80 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>📊</span>
              <span>Ringkasan Nilai ({activeTabLabel})</span>
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card Belum Lunas */}
            <div className="bg-slate-800/90 dark:bg-slate-900/90 rounded-2xl p-5 border border-red-500/30 flex items-center gap-4 shadow-inner">
              <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-xl flex items-center justify-center shrink-0 border border-red-500/30">
                <XCircle size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Total Tunggakan (Belum Lunas)</p>
                <p className="text-xl sm:text-2xl font-black text-red-400 mt-0.5 tracking-tight">{formatRupiah(dynamicTotalBelum)}</p>
              </div>
            </div>

            {/* Card Lunas */}
            <div className="bg-slate-800/90 dark:bg-slate-900/90 rounded-2xl p-5 border border-emerald-500/30 flex items-center gap-4 shadow-inner">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center shrink-0 border border-emerald-500/30">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Total Pembayaran Lunas</p>
                <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5 tracking-tight">{formatRupiah(dynamicTotalLunas)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content List / Table */}
        <div className="p-4 md:p-5">
          {filteredTagihan.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700/60 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Tidak ada tagihan</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Tidak ditemukan data tagihan untuk filter yang dipilih.</p>
            </div>
          ) : (
            userRole === 'wali_murid' ? (
              /* CARD VIEW FOR WALI MURID (Mobile-Friendly) */
              <div className="space-y-4">
                {filteredTagihan.map((t) => (
                  <div key={t.id} className="border border-gray-200/80 dark:border-gray-700/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex gap-4 items-start sm:items-center">
                      {/* Avatar / Foto Santri */}
                      <button 
                        onClick={() => t.foto_url && setPreviewImage({ url: t.foto_url, title: t.nama_santri })}
                        className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center group relative cursor-pointer"
                      >
                        {t.foto_url ? (
                          <img src={t.foto_url} alt={t.nama_santri} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                        ) : (
                          <User size={22} className="text-emerald-600 dark:text-emerald-400" />
                        )}
                      </button>
                      <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-100 text-base">{t.nama_tagihan}</h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1"><Calendar size={14} /> Periode: {t.periode}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>NIS: {t.nis}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between border-t sm:border-0 border-gray-200 dark:border-gray-700 pt-3 sm:pt-0">
                      <span className="text-xs text-gray-400 dark:text-gray-500 sm:mb-1">Nominal Tagihan</span>
                      <span className={`text-lg font-bold ${t.status === 'Lunas' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatRupiah(t.nominal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* TABLE VIEW FOR ADMIN, STAFF & PENGASUH WITH SORTING & SANTRI DETAILS */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-700 dark:text-gray-200">
                  <thead className="bg-gray-100/80 dark:bg-gray-900/80 text-xs uppercase font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3.5 cursor-pointer hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors select-none" onClick={() => handleSort('nama_santri')}>
                        <div className="flex items-center gap-1.5">
                          <span>Santri & Wali</span>
                          {sortField === 'nama_santri' ? (sortOrder === 'asc' ? <ArrowUp size={14} className="text-emerald-500" /> : <ArrowDown size={14} className="text-emerald-500" />) : <ArrowUpDown size={13} className="opacity-40" />}
                        </div>
                      </th>
                      <th className="px-4 py-3.5 cursor-pointer hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors select-none" onClick={() => handleSort('nama_tagihan')}>
                        <div className="flex items-center gap-1.5">
                          <span>Tagihan</span>
                          {sortField === 'nama_tagihan' ? (sortOrder === 'asc' ? <ArrowUp size={14} className="text-emerald-500" /> : <ArrowDown size={14} className="text-emerald-500" />) : <ArrowUpDown size={13} className="opacity-40" />}
                        </div>
                      </th>
                      <th className="px-4 py-3.5 cursor-pointer hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors select-none" onClick={() => handleSort('asrama')}>
                        <div className="flex items-center gap-1.5">
                          <span>Asrama / Kelas</span>
                          {sortField === 'asrama' ? (sortOrder === 'asc' ? <ArrowUp size={14} className="text-emerald-500" /> : <ArrowDown size={14} className="text-emerald-500" />) : <ArrowUpDown size={13} className="opacity-40" />}
                        </div>
                      </th>
                      <th className="px-4 py-3.5 cursor-pointer hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors select-none" onClick={() => handleSort('nominal')}>
                        <div className="flex items-center gap-1.5">
                          <span>Nominal</span>
                          {sortField === 'nominal' ? (sortOrder === 'asc' ? <ArrowUp size={14} className="text-emerald-500" /> : <ArrowDown size={14} className="text-emerald-500" />) : <ArrowUpDown size={13} className="opacity-40" />}
                        </div>
                      </th>
                      <th className="px-4 py-3.5 cursor-pointer hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors select-none" onClick={() => handleSort('status')}>
                        <div className="flex items-center gap-1.5">
                          <span>Status</span>
                          {sortField === 'status' ? (sortOrder === 'asc' ? <ArrowUp size={14} className="text-emerald-500" /> : <ArrowDown size={14} className="text-emerald-500" />) : <ArrowUpDown size={13} className="opacity-40" />}
                        </div>
                      </th>
                      <th className="px-4 py-3.5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
                    {filteredTagihan.map((t) => {
                      const waUrl = formatWaUrl(t.no_wali, t.nama_santri, t.nama_tagihan, t.nominal, t.periode);
                      return (
                        <tr key={t.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors">
                          {/* Santri & Wali */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {/* Thumbnail Foto Santri */}
                              <button 
                                onClick={() => t.foto_url && setPreviewImage({ url: t.foto_url, title: t.nama_santri })}
                                title="Klik untuk memperbesar foto"
                                className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center group relative cursor-pointer"
                              >
                                {t.foto_url ? (
                                  <img src={t.foto_url} alt={t.nama_santri} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                ) : (
                                  <User size={18} className="text-emerald-600 dark:text-emerald-400" />
                                )}
                              </button>

                              <div>
                                <div className="font-bold text-gray-900 dark:text-gray-100">{t.nama_santri}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                  <span>NIS: {t.nis}</span>
                                  {t.nama_wali && t.nama_wali !== '-' && (
                                    <>
                                      <span>•</span>
                                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Wali: {t.nama_wali}</span>
                                    </>
                                  )}
                                </div>
                                {t.alamat && t.alamat !== '-' && (
                                  <div className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                                    <MapPin size={11} className="shrink-0" />
                                    <span className="truncate max-w-[200px]">{t.alamat}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Tagihan */}
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-800 dark:text-gray-200">{t.nama_tagihan}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Periode: {t.periode}</div>
                          </td>

                          {/* Asrama / Kelas */}
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                              {t.asrama} {t.kamar ? `(${t.kamar})` : ''}
                            </span>
                          </td>

                          {/* Nominal */}
                          <td className="px-4 py-3 font-extrabold text-gray-900 dark:text-gray-100">
                            {formatRupiah(t.nominal)}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                              t.status === 'Lunas'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                                : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800'
                            }`}>
                              {t.status === 'Lunas' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                              {t.status}
                            </span>
                          </td>

                          {/* Aksi (Detail & WhatsApp Direct) */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              {/* Detail Modal Trigger */}
                              <button
                                onClick={() => setSelectedDetailItem(t)}
                                title="Lihat Detail Lengkap Santri"
                                className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors"
                              >
                                <Eye size={16} />
                              </button>

                              {/* WhatsApp Direct / Direct Notification */}
                              {t.status === 'Belum' && t.no_wali ? (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`Kirim WA ke Wali (${t.nama_wali})`}
                                  className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 transition-colors"
                                >
                                  <MessageCircle size={16} />
                                </a>
                              ) : (
                                <Link
                                  href={`/dashboard/notifikasi?tab=pembayaran&nis=${t.nis}`}
                                  title="Buka Halaman Notifikasi"
                                  className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                  <MessageCircle size={16} />
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      {/* MODAL 1: PREVIEW FOTO SANTRI LAYAR PENUH */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative max-w-lg w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700">
            <div className="p-4 bg-slate-800/80 flex items-center justify-between border-b border-slate-700">
              <span className="font-bold text-white text-base">{previewImage.title}</span>
              <button 
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 flex justify-center bg-black/50">
              <img 
                src={previewImage.url} 
                alt={previewImage.title} 
                className="max-h-[70vh] w-auto object-contain rounded-2xl shadow-lg border border-slate-700" 
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DETAIL LENGKAP SANTRI & TAGIHAN */}
      {selectedDetailItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700 space-y-0">
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white flex items-center justify-between relative">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => selectedDetailItem.foto_url && setPreviewImage({ url: selectedDetailItem.foto_url, title: selectedDetailItem.nama_santri })}
                  className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/80 bg-white/20 shrink-0 flex items-center justify-center cursor-pointer shadow-md"
                >
                  {selectedDetailItem.foto_url ? (
                    <img src={selectedDetailItem.foto_url} alt={selectedDetailItem.nama_santri} className="w-full h-full object-cover" />
                  ) : (
                    <User size={28} className="text-white" />
                  )}
                </button>
                <div>
                  <h3 className="font-extrabold text-lg text-white leading-tight">{selectedDetailItem.nama_santri}</h3>
                  <p className="text-xs text-emerald-100 mt-0.5">NIS: {selectedDetailItem.nis}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDetailItem(null)}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Detail */}
            <div className="p-6 space-y-4 text-sm text-gray-700 dark:text-gray-200">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-900/50 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700/60">
                <div>
                  <span className="text-xs text-gray-400 block font-semibold">Nama Wali</span>
                  <span className="font-bold text-gray-800 dark:text-gray-100">{selectedDetailItem.nama_wali || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-semibold">No HP / WA Wali</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Phone size={13} />
                    {selectedDetailItem.no_wali || '-'}
                  </span>
                </div>
              </div>

              {selectedDetailItem.alamat && selectedDetailItem.alamat !== '-' && (
                <div className="bg-gray-50 dark:bg-gray-900/50 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700/60">
                  <span className="text-xs text-gray-400 block font-semibold">Alamat Santri</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200 flex items-start gap-1.5 mt-0.5">
                    <MapPin size={15} className="shrink-0 text-emerald-500 mt-0.5" />
                    {selectedDetailItem.alamat}
                  </span>
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400 font-semibold">Jenis Tagihan</span>
                  <span className="font-bold text-gray-800 dark:text-gray-100">{selectedDetailItem.nama_tagihan}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400 font-semibold">Periode</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedDetailItem.periode}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400 font-semibold">Asrama / Kamar / Kelas</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedDetailItem.asrama} {selectedDetailItem.kamar ? `(${selectedDetailItem.kamar})` : ''}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Total Nominal</span>
                  <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{formatRupiah(selectedDetailItem.nominal)}</span>
                </div>
              </div>
            </div>

            {/* Footer Modal Action */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => setSelectedDetailItem(null)}
                className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-2xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Tutup
              </button>
              {selectedDetailItem.no_wali && (
                <a
                  href={formatWaUrl(selectedDetailItem.no_wali, selectedDetailItem.nama_santri, selectedDetailItem.nama_tagihan, selectedDetailItem.nominal, selectedDetailItem.periode)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  <MessageCircle size={18} />
                  Kirim WA Wali
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
