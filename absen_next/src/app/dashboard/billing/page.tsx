'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, XCircle, Search, Calendar, FileText, AlertCircle } from 'lucide-react';

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [tagihan, setTagihan] = useState<any[]>([]);
  const [totalLunas, setTotalLunas] = useState(0);
  const [totalBelum, setTotalBelum] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('Semua'); // Semua, Lunas, Belum

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
    fetch('/api/billing')
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
  }, []);

  const filteredTagihan = tagihan.filter(t => {
    if (filterStatus === 'Semua') return true;
    return t.status === filterStatus;
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

  const isAccessAllowed = userRole && ['admin', 'staff', 'wali_murid'].includes(userRole);

  if (!isAccessAllowed) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-3xl p-8 border border-red-100 dark:border-red-800/50 shadow-sm text-center max-w-md mx-auto my-12">
        <div className="bg-red-100 dark:bg-red-900/50 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4 text-red-500">
          <AlertCircle size={32} />
        </div>
        <h3 className="text-lg font-bold text-red-800 dark:text-red-400 mb-2">Akses Ditolak</h3>
        <p className="text-sm text-red-600 dark:text-red-300 mb-6">
          Halaman Informasi Tagihan hanya dapat diakses oleh Admin, Staff, dan Wali Murid.
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
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 font-theme-hero">Informasi Tagihan & Pembayaran</h1>
          <p className="text-emerald-50 opacity-90 text-sm sm:text-base max-w-xl">
            {userRole === 'wali_murid' 
              ? 'Pantau status pembayaran administrasi putra/putri Anda secara langsung dari sistem.' 
              : 'Dasbor pemantauan status tagihan santri secara menyeluruh dari sistem keuangan pusat.'}
          </p>
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
        
        {/* Filters */}
        <div className="p-4 md:p-5 border-b dark:border-gray-700 flex gap-2 overflow-x-auto">
          <button 
            onClick={() => setFilterStatus('Semua')}
            className={`font-theme-hero px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === 'Semua' ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
          >
            Semua Tagihan
          </button>
          <button 
            onClick={() => setFilterStatus('Belum')}
            className={`font-theme-hero px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === 'Belum' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40'}`}
          >
            Belum Lunas
          </button>
          <button 
            onClick={() => setFilterStatus('Lunas')}
            className={`font-theme-hero px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === 'Lunas' ? 'bg-green-500 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40'}`}
          >
            Sudah Lunas
          </button>
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
              /* TABLE VIEW FOR ADMIN/STAFF */
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-3 rounded-tl-xl">ID Tagihan</th>
                      <th className="px-4 py-3">Nama Santri / NIS</th>
                      <th className="px-4 py-3">Nama Tagihan</th>
                      <th className="px-4 py-3">Periode</th>
                      <th className="px-4 py-3">Nominal</th>
                      <th className="px-4 py-3 rounded-tr-xl text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredTagihan.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">#{t.id}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800 dark:text-gray-200">{t.nama_santri}</div>
                          <div className="text-xs text-gray-500 font-mono">NIS: {t.nis}</div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">{t.nama_tagihan}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{t.periode}</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-800 dark:text-gray-200">{formatRupiah(t.nominal)}</td>
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
