'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, XCircle, Search, Calendar, FileText, AlertCircle, Building2, GraduationCap, RefreshCw } from 'lucide-react';

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [tagihan, setTagihan] = useState<any[]>([]);
  const [totalLunas, setTotalLunas] = useState(0);
  const [totalBelum, setTotalBelum] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('Semua'); // Semua, Lunas, Belum
  const [filterKategori, setFilterKategori] = useState('Semua'); // Semua, pesantren, madrasah
  const [selectedSubTab, setSelectedSubTab] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(false);

  const fetchBilling = (kategori?: string) => {
    setLoading(true);
    const params = kategori && kategori !== 'Semua' ? `?kategori=${kategori}` : '';
    fetch(`/api/billing${params}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTagihan(data.data);
          setTotalLunas(data.total_lunas || 0);
          setTotalBelum(data.total_belum || 0);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleSyncBilling = async () => {
    if (!confirm('Apakah Anda yakin ingin menyinkronkan data billing dari Google Sheets? Proses ini akan memperbarui data tagihan di database.')) {
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch('/api/sync/billing', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`Sinkronisasi berhasil! ${data.inserted} data tagihan berhasil diimpor/diperbarui.`);
        fetchBilling(filterKategori);
      } else {
        alert(`Sinkronisasi gagal: ${data.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      alert(`Terjadi kesalahan jaringan: ${err.message}`);
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


  const filteredTagihan = tagihan.filter(t => {
    // 1. Status Filter
    if (filterStatus !== 'Semua' && t.status !== filterStatus) return false;

    // 2. Kategori Filter (if not Semua)
    if (filterKategori !== 'Semua') {
      if (t.kategori !== filterKategori) return false;

      // 3. Sub Tab Filter
      if (selectedSubTab !== 'Semua') {
        if (filterKategori === 'pesantren') {
          const cleanAsrama = (t.asrama || '').trim().toUpperCase();
          const targetLetter = selectedSubTab.toUpperCase();
          const isMatch = cleanAsrama === targetLetter || 
                          cleanAsrama === `ASRAMA ${targetLetter}` || 
                          cleanAsrama.endsWith(` ${targetLetter}`);
          if (!isMatch) return false;
        } else if (filterKategori === 'madrasah') {
          const cleanAsrama = (t.asrama || '').trim().toUpperCase();
          if (!cleanAsrama.includes(selectedSubTab.toUpperCase())) return false;
        }
      }
    }

    // 4. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (t.nama_santri || '').toLowerCase().includes(q) ||
        (t.nis || '').toLowerCase().includes(q) ||
        (t.asrama || '').toLowerCase().includes(q) ||
        (t.nama_tagihan || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-medium animate-pulse">Menghubungkan ke server tagihan...</p>
      </div>
    );
  }

  const isAccessAllowed = userRole && ['admin', 'staff', 'wali_murid', 'pengasuh'].includes(userRole);

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

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 transition-transform hover:scale-[1.02]">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center shrink-0">
            <XCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Tunggakan (Belum Lunas)</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{formatRupiah(totalBelum)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 transition-transform hover:scale-[1.02]">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Pembayaran Lunas</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{formatRupiah(totalLunas)}</p>
          </div>
        </div>
      </div>

      {/* Info Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex gap-3 text-sm">
        <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={20} />
        <p className="text-blue-800 dark:text-blue-300">
          <strong>Perhatian:</strong> Data tagihan ini disinkronisasikan langsung dari sistem pusat Smart Pesantren. Jika terdapat ketidaksesuaian data, silakan hubungi pihak tata usaha (TU) pesantren.
        </p>
      </div>

      {/* Main Content Area */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        
        {/* Category Filters (for admin/staff only) */}
        {userRole && ['admin', 'staff'].includes(userRole) && (
          <div className="p-4 md:p-5 border-b dark:border-gray-700 flex flex-col gap-3">
            <div className="flex flex-col gap-2 w-full">
              <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Kategori Utama</span>
              
              {/* Semua Kategori — Baris tersendiri di atas */}
              <div className="bg-gray-50 dark:bg-gray-800/40 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 w-full flex">
                <button 
                  onClick={() => {
                    setFilterKategori('Semua');
                    setSelectedSubTab('Semua');
                  }}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                    filterKategori === 'Semua' 
                      ? 'bg-slate-650 dark:bg-slate-700 text-white shadow-md' 
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                >
                  Semua Kategori
                </button>
              </div>

              {/* Pesantren & Madrasah — Dibawahnya sama rata */}
              <div className="flex bg-gray-50 dark:bg-gray-800/40 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 gap-1.5 w-full">
                <button 
                  onClick={() => {
                    setFilterKategori('pesantren');
                    setSelectedSubTab('Semua');
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                    filterKategori === 'pesantren' 
                      ? 'bg-emerald-500 text-white shadow-md' 
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
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
                      ? 'bg-blue-500 text-white shadow-md' 
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <GraduationCap size={16} /> Madrasah
                </button>
              </div>
            </div>
            
            {/* Sub-tabs based on Category selection */}
            {filterKategori === 'pesantren' && (
              <div className="flex flex-col gap-2 w-full pt-1">
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Sub-Kategori: Asrama</span>
                <div className="flex bg-gray-50 dark:bg-gray-800/40 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-x-auto scrollbar-none gap-1.5 w-full">
                  {['Semua', 'A', 'B', 'C', 'D', 'E', 'F'].map((dorm) => (
                    <button
                      key={dorm}
                      onClick={() => setSelectedSubTab(dorm)}
                      className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                        selectedSubTab === dorm
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      {dorm === 'Semua' ? 'Semua Asrama' : `Asrama ${dorm}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filterKategori === 'madrasah' && (
              <div className="flex flex-col gap-2 w-full pt-1">
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Sub-Kategori: Unit Sekolah</span>
                <div className="flex bg-gray-50 dark:bg-gray-800/40 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-x-auto scrollbar-none gap-1.5 w-full">
                  {['Semua', 'MA', 'SMK', 'MTS', 'SMP'].map((unit) => (
                    <button
                      key={unit}
                      onClick={() => setSelectedSubTab(unit)}
                      className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                        selectedSubTab === unit
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      {unit === 'Semua' ? 'Semua Unit' : unit}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status Filters + Search */}
        <div className="p-4 md:p-5 border-b dark:border-gray-700 flex flex-col gap-3">
          <div className="flex flex-col gap-2 w-full">
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Filter Status</span>
            
            {/* Semua Status — Baris tersendiri di atas */}
            <div className="bg-gray-50 dark:bg-gray-800/40 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 w-full flex">
              <button 
                onClick={() => setFilterStatus('Semua')}
                className={`w-full flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                  filterStatus === 'Semua' 
                    ? 'bg-slate-650 dark:bg-slate-700 text-white shadow-md' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                Semua ({tagihan.length})
              </button>
            </div>

            {/* Belum Lunas & Sudah Lunas — Dibawahnya sama rata */}
            <div className="flex bg-gray-50 dark:bg-gray-800/40 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 gap-1.5 w-full">
              <button 
                onClick={() => setFilterStatus('Belum')}
                className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                  filterStatus === 'Belum' 
                    ? 'bg-red-500 text-white shadow-md' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                Belum Lunas ({tagihan.filter(t => t.status === 'Belum').length})
              </button>
              <button 
                onClick={() => setFilterStatus('Lunas')}
                className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                  filterStatus === 'Lunas' 
                    ? 'bg-green-500 text-white shadow-md' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                Sudah Lunas ({tagihan.filter(t => t.status === 'Lunas').length})
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="w-full pt-1">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Cari nama, NIS, asrama..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm bg-gray-50 dark:bg-gray-800 text-gray-850 dark:text-gray-200 border border-gray-200 dark:border-gray-705 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Content List / Table */}
        <div className="p-4 md:p-5">
          {filteredTagihan.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Tidak ada tagihan</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Tidak ditemukan data tagihan untuk filter yang dipilih.</p>
            </div>
          ) : (
            userRole === 'wali_murid' ? (
              /* CARD VIEW FOR WALI MURID (Modern Mobile-Friendly) */
              <div className="space-y-4">
                {filteredTagihan.map((t) => (
                  <div key={t.id} className="border border-gray-100 dark:border-gray-700 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 transition-colors">
                    <div className="flex gap-4 items-start sm:items-center">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${t.status === 'Lunas' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30'}`}>
                        {t.status === 'Lunas' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-100 text-base">{t.nama_tagihan}</h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1"><Calendar size={14} /> Periode: {t.periode}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>NIS: {t.nis}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between border-t sm:border-0 border-gray-100 dark:border-gray-700 pt-3 sm:pt-0">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 sm:hidden">Total Bayar:</span>
                      <span className="text-lg font-bold text-gray-800 dark:text-gray-100">{formatRupiah(t.nominal)}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 ${t.status === 'Lunas' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* TABLE VIEW FOR ADMIN/STAFF/PENGASUH */
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-3 rounded-tl-xl">Nama Santri / NIS</th>
                      <th className="px-4 py-3">Asrama / Kamar</th>
                      <th className="px-4 py-3">Nama Tagihan</th>
                      <th className="px-4 py-3">Periode</th>
                      <th className="px-4 py-3">Nominal</th>
                      {userRole && ['admin', 'staff'].includes(userRole) && (
                        <th className="px-4 py-3">Kategori</th>
                      )}
                      <th className="px-4 py-3 rounded-tr-xl text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredTagihan.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800 dark:text-gray-200">{t.nama_santri}</div>
                          <div className="text-xs text-gray-500 font-mono">NIS: {t.nis}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.asrama}</div>
                          {t.kamar && t.kamar !== '-' && <div className="text-xs text-gray-500">{t.kamar}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">{t.nama_tagihan}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{t.periode}</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-800 dark:text-gray-200">{formatRupiah(t.nominal)}</td>
                        {userRole && ['admin', 'staff'].includes(userRole) && (
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${t.kategori === 'pesantren' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                              {t.kategori === 'pesantren' ? <Building2 size={11} /> : <GraduationCap size={11} />}
                              {t.kategori === 'pesantren' ? 'Pesantren' : 'Madrasah'}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${t.status === 'Lunas' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {t.status === 'Lunas' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
