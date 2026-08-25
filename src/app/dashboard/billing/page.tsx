'use client';

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, CheckCircle2, XCircle, Search, Calendar, FileText, AlertCircle, 
  Building2, GraduationCap, RefreshCw, MessageCircle, User, MapPin, Phone, 
  X, ArrowUpDown, ArrowUp, ArrowDown, Lightbulb, ChevronRight, Layers, ListFilter,
  Download
} from 'lucide-react';
import Link from 'next/link';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';

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

  // View Mode: 'ringkasan' (Total per Santri) vs 'rincian' (Detail per Item Tagihan)
  const [viewMode, setViewMode] = useState<'ringkasan' | 'rincian'>('ringkasan');

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('nama_santri');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Modal Image Preview State
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Modal Detail Santri / Tagihan State
  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);
  const [selectedDetailGroup, setSelectedDetailGroup] = useState<any | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userAsrama, setUserAsrama] = useState<string | null>(null);

  const displayAsramaName = React.useMemo(() => {
    if (!userAsrama) return 'Asrama A';
    const clean = userAsrama.trim();
    if (/^asrama\s+/i.test(clean)) {
      const letter = clean.replace(/^asrama\s+/i, '').trim();
      return letter.toLowerCase() === 'tahfid' ? 'Asrama Tahfid' : `Asrama ${letter.toUpperCase()}`;
    }
    return clean.toLowerCase() === 'tahfid' ? 'Asrama Tahfid' : `Asrama ${clean.toUpperCase()}`;
  }, [userAsrama]);

  const fetchBilling = (kategori?: string) => {
    setLoading(true);
    setErrorMsg(null);
    const params = kategori && kategori !== 'Semua' ? `?kategori=${kategori}` : '';
    fetch(`/api/billing${params}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTagihan(data.data);
          if (data.user_asrama) setUserAsrama(data.user_asrama);
        } else {
          setErrorMsg(data.error || 'Gagal mengambil data tagihan');
          setTagihan([]);
        }
      })
      .catch(err => {
        setErrorMsg('Terjadi kesalahan jaringan: ' + err.message);
        setTagihan([]);
      })
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
          setIsPengasuhUser(!!(data.user.is_pengasuh || data.user.isPengasuh || data.user.is_pengurus_asrama || data.user.isPengurusAsrama || (data.user.role || '').includes('pengasuh')));
          if (data.user.asrama) setUserAsrama(data.user.asrama);
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
          const rawAsrama = (t.asrama || '').trim().toUpperCase();
          const rawKamar  = (t.kamar || '').trim().toUpperCase();
          const cleanAsrama = rawAsrama.replace(/^ASRAMA\s*/i, '').trim();
          const targetLetter = selectedSubTab.replace(/^ASRAMA\s*/i, '').trim().toUpperCase();

          if (selectedSubTab === 'Lainnya') {
            const isUnassigned =
              rawAsrama === '-' ||
              rawAsrama === '' ||
              rawAsrama.includes('(-)') ||
              (!rawKamar.match(/^[A-F]/i) && cleanAsrama.length > 1);
            if (!isUnassigned) return false;
          } else {
            // Jika record asrama berisi "(-)" atau "-" atau kosong:
            if (rawAsrama.includes('(-)') || rawAsrama === '-' || !rawAsrama) {
              const matchesKamar = rawKamar.startsWith(`${targetLetter}-`) || rawKamar.startsWith(`${targetLetter}/`);
              if (!matchesKamar) return false;
            } else {
              const isMatch =
                cleanAsrama === targetLetter ||
                rawAsrama === targetLetter ||
                rawAsrama === `ASRAMA ${targetLetter}` ||
                rawKamar.startsWith(`${targetLetter}-`) ||
                rawKamar.startsWith(`${targetLetter}/`);
              if (!isMatch) return false;
            }
          }
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

  // Dynamic Total calculation for active selection (bebas double counting)
  const dynamicTotalBelum = tabFilteredTagihan
    .filter(t => t.status === 'Belum')
    .reduce((sum, t) => sum + Number(t.nominal || 0), 0);

  const dynamicTotalLunas = tabFilteredTagihan
    .filter(t => t.status === 'Lunas')
    .reduce((sum, t) => sum + Number(t.nominal || 0), 0);

  // Grouping Per Santri (untuk Mode Ringkasan Total)
  const groupedSantriList = React.useMemo(() => {
    const map = new Map<string, {
      key: string;
      nis: string;
      nama_santri: string;
      nama_wali: string;
      no_wali: string;
      foto_url: string | null;
      alamat: string;
      asrama: string;
      kamar: string;
      totalBelum: number;
      totalLunas: number;
      overallStatus: string;
      items: any[];
    }>();

    tabFilteredTagihan.forEach(item => {
      const key = (item.nis && item.nis !== '-' ? item.nis : item.nama_santri || '').trim().toLowerCase();
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          key,
          nis: item.nis || '-',
          nama_santri: item.nama_santri || 'Tanpa Nama',
          nama_wali: item.nama_wali || '-',
          no_wali: item.no_wali || '',
          foto_url: item.foto_url || null,
          alamat: item.alamat || '-',
          asrama: item.asrama || '-',
          kamar: item.kamar || '-',
          totalBelum: 0,
          totalLunas: 0,
          overallStatus: 'Lunas',
          items: []
        });
      }
      const entry = map.get(key)!;
      entry.items.push(item);
      if (item.status === 'Belum') {
        entry.totalBelum += Number(item.nominal || 0);
      } else {
        entry.totalLunas += Number(item.nominal || 0);
      }
    });

    map.forEach(entry => {
      entry.overallStatus = entry.totalBelum > 0 ? 'Belum' : 'Lunas';
    });

    let list = Array.from(map.values());

    // Filter status pada mode ringkasan santri
    if (filterStatus !== 'Semua') {
      list = list.filter(s => s.overallStatus === filterStatus);
    }

    // Sort list santri
    list.sort((a, b) => {
      let aVal: any = a.nama_santri;
      let bVal: any = b.nama_santri;
      if (sortField === 'nominal') {
        aVal = a.totalBelum;
        bVal = b.totalBelum;
      } else if (sortField === 'status') {
        aVal = a.overallStatus;
        bVal = b.overallStatus;
      } else if (sortField === 'asrama') {
        aVal = a.asrama;
        bVal = b.asrama;
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [tabFilteredTagihan, filterStatus, sortField, sortOrder]);

  // Status counts untuk tombol filter
  const countSemua = viewMode === 'ringkasan' ? groupedSantriList.length : tabFilteredTagihan.length;
  const countBelum = viewMode === 'ringkasan' 
    ? groupedSantriList.filter(s => s.overallStatus === 'Belum').length 
    : tabFilteredTagihan.filter(t => t.status === 'Belum').length;
  const countLunas = viewMode === 'ringkasan' 
    ? groupedSantriList.filter(s => s.overallStatus === 'Lunas').length 
    : tabFilteredTagihan.filter(t => t.status === 'Lunas').length;

  // Final list rincian tagihan (Mode Rincian)
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

  // Helper pengelompokan badge tagihan & penggabungan nominal otomatis
  const getGroupedItemBadges = (items: any[]) => {
    const totalNominalMap: Record<string, number> = {};
    const statusMap: Record<string, string> = {};

    items.forEach((it: any) => {
      const key = (it.nama_tagihan || '').trim();
      if (!key) return;

      if (!totalNominalMap[key]) totalNominalMap[key] = 0;
      totalNominalMap[key] += Number(it.nominal || 0);

      if (it.status !== 'Lunas') {
        statusMap[key] = 'Belum';
      } else if (!statusMap[key]) {
        statusMap[key] = 'Lunas';
      }
    });

    const seen: Record<string, boolean> = {};
    const result: {
      nama_tagihan: string;
      totalNominal: number;
      status: string;
    }[] = [];

    items.forEach((it: any) => {
      const key = (it.nama_tagihan || '').trim();
      if (!key || seen[key]) return;
      seen[key] = true;

      result.push({
        nama_tagihan: key,
        totalNominal: totalNominalMap[key] || Number(it.nominal || 0),
        status: statusMap[key] || it.status || 'Belum'
      });
    });

    return result;
  };

  // Helper untuk format URL WhatsApp tunggal
  const formatWaUrl = (noHp: string, namaSantri: string, namaTagihan: string, nominal: number, periode: string) => {
    if (!noHp) return '#';
    let cleanNumber = noHp.replace(/[^0-9]/g, '');
    if (cleanNumber.startsWith('0')) {
      cleanNumber = '62' + cleanNumber.slice(1);
    }
    const message = `Assalamu'alaikum Warohmatullah, Yth. Bapak/Ibu Wali dari Ananda *${namaSantri}*.\n\n` +
      `Melalui pesan ini kami menginformasikan rincian tagihan administrasi ananda:\n` +
      `• Tagihan: ${namaTagihan}\n` +
      `• Periode: ${periode}\n` +
      `• Nominal: *${formatRupiah(nominal)}*\n` +
      `• Status: *Belum Lunas*\n\n` +
      `Informasi selengkapnya dapat dilihat pada tautan berikut: https://app.ppmawar.or.id/dashboard/billing\n\n` +
      `Atas perhatian dan kerjasamanya kami ucapkan terima kasih.\nWassalamu'alaikum Warohmatullah.`;
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
  };

  // Helper untuk format URL WhatsApp gabungan (Ringkasan per Santri)
  const formatWaUrlGrouped = (noHp: string, namaSantri: string, items: any[], totalNominal: number) => {
    if (!noHp) return '#';
    let cleanNumber = noHp.replace(/[^0-9]/g, '');
    if (cleanNumber.startsWith('0')) {
      cleanNumber = '62' + cleanNumber.slice(1);
    }
    const belumItems = getGroupedItemBadges(items).filter(b => b.status === 'Belum');
    const itemLines = belumItems.length > 0
      ? belumItems.map(b => `• ${b.nama_tagihan}: *${formatRupiah(b.totalNominal)}*`).join('\n')
      : '• Seluruh Tagihan TELAH LUNAS';
    
    const message = `Assalamu'alaikum Warohmatullah, Yth. Bapak/Ibu Wali dari Ananda *${namaSantri}*.\n\n` +
      `Melalui pesan ini kami menginformasikan rincian tunggakan administrasi ananda:\n` +
      `${itemLines}\n\n` +
      `📌 *TOTAL TUNGGAKAN*: *${formatRupiah(totalNominal)}*\n\n` +
      `Informasi selengkapnya dapat dilihat pada tautan berikut: https://app.ppmawar.or.id/dashboard/billing\n\n` +
      `Atas perhatian dan kerjasamanya kami ucapkan terima kasih.\nWassalamu'alaikum Warohmatullah.`;
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
  };

  const handleExportBilling = (type: 'pdf' | 'excel', previewOnly: boolean = false) => {
    const title = 'INFORMASI TAGIHAN & PEMBAYARAN SANTRI';
    const subtitle = `Kategori: ${filterKategori} | Status: ${filterStatus} | Mode: ${viewMode === 'ringkasan' ? 'Ringkasan Santri' : 'Rincian Tagihan'}`;
    const filename = `Laporan_Tagihan_${filterKategori}_${new Date().toISOString().slice(0, 10)}`;

    let columns: string[];
    let rows: any[][];

    if (viewMode === 'ringkasan') {
      columns = ['No', 'NIS', 'Nama Santri', 'Asrama', 'Kamar', 'Nama Wali', 'Tunggakan Belum Lunas', 'Status'];
      rows = groupedSantriList.map((item, idx) => [
        idx + 1,
        item.nis || '-',
        item.nama_santri,
        item.asrama || '-',
        item.kamar || '-',
        item.nama_wali || '-',
        `Rp ${(item.totalBelum || 0).toLocaleString('id-ID')}`,
        item.overallStatus
      ]);
    } else {
      columns = ['No', 'NIS', 'Nama Santri', 'Asrama', 'Kamar', 'Nama Tagihan', 'Nominal', 'Status'];
      rows = tabFilteredTagihan.map((item, idx) => [
        idx + 1,
        item.nis || '-',
        item.nama_santri || '-',
        item.asrama || '-',
        item.kamar || '-',
        item.nama_tagihan || '-',
        `Rp ${Number(item.nominal || 0).toLocaleString('id-ID')}`,
        item.status || '-'
      ]);
    }

    if (type === 'pdf') {
      const url = exportToPDF({
        title,
        subtitle,
        columns,
        rows,
        filename,
        previewOnly
      });
      if (previewOnly && url) {
        window.open(url, '_blank');
      }
    } else {
      exportToExcel({
        title,
        subtitle,
        columns,
        rows,
        filename
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-medium animate-pulse">Menghubungkan ke server tagihan...</p>
      </div>
    );
  }

  // Otorisasi Akses
  const isAccessAllowed = userRole && (['admin', 'staff', 'wali_murid', 'wali_alumni', 'pengasuh'].includes(userRole) || isPengasuhUser);

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

  if (userRole === 'wali_alumni' && !loading && dynamicTotalBelum === 0) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-3xl p-8 border border-emerald-200 dark:border-emerald-800 text-center max-w-lg mx-auto my-12">
        <div className="bg-emerald-100 dark:bg-emerald-900/50 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={40} />
        </div>
        <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mb-2">Seluruh Tagihan Telah LUNAS</h3>
        <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-6">
          Alhamdulillah, akun Alumni / Wali Alumni Anda tidak memiliki tanggungan tagihan administrasi yang belum ditunaikan. Terima kasih atas ketaatan dan kerja samanya.
        </p>
        <Link href="/dashboard" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors inline-flex items-center gap-2">
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  if (userRole === 'staff' || userRole === 'pengurus_asrama') {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4 mt-12">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Akses Dibatasi</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Informasi tagihan dan pembayaran hanya dapat diakses oleh Admin Keuangan, Pengasuh, atau Wali Murid terkait.
        </p>
        <Link href="/dashboard" className="inline-block px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-sm hover:bg-emerald-700 transition-colors">
          Kembali ke Dashboard
        </Link>
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
              {userRole === 'wali_murid' || userRole === 'wali_alumni'
                ? (userRole === 'wali_alumni'
                  ? 'Lihat riwayat tagihan administrasi putra/putri Anda yang telah lulus/alumni.'
                  : 'Pantau status pembayaran administrasi putra/putri Anda secara langsung dari sistem.') 
                : (userRole === 'pengasuh' || isPengasuhUser)
                ? 'Pantau status tagihan santri di asrama Anda secara langsung dari sistem keuangan.'
                : 'Dasbor pemantauan status tagihan santri secara menyeluruh dari sistem keuangan pusat.'}
            </p>
          </div>
          <div className="flex flex-col w-full md:w-auto gap-2 self-start md:self-center">
            <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
              <button
                onClick={() => handleExportBilling('pdf', true)}
                className="px-2 sm:px-3 py-2 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 border border-white/20 shadow-sm"
                title="Preview PDF"
              >
                <FileText size={14} /> Preview
              </button>
              <button
                onClick={() => handleExportBilling('pdf')}
                className="px-2 sm:px-3 py-2 bg-red-500/80 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
                title="Download PDF"
              >
                <Download size={14} /> PDF
              </button>
              <button
                onClick={() => handleExportBilling('excel')}
                className="px-2 sm:px-3 py-2 bg-green-500/80 hover:bg-green-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
                title="Download Excel"
              >
                <Download size={14} /> Excel
              </button>
            </div>
            {userRole && (userRole === 'admin' || userRole === 'pengasuh' || isPengasuhUser) && (
              <button
                onClick={handleSyncBilling}
                disabled={syncing}
                className="w-full px-3 py-2 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 border border-white/20 disabled:opacity-50 shadow-sm"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Menyinkronkan...' : 'Sinkron'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info Notice */}
      <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl p-4 flex gap-3 text-sm backdrop-blur-sm">
        <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={20} />
        <p className="text-blue-900 dark:text-blue-200">
          <strong>Perhatian:</strong> Data tagihan ini disinkronisasikan langsung dari sistem pusat Koperasi Mawar. Jika terdapat ketidaksesuaian data, silakan hubungi pihak pembayaran (Kasir) Kopma.
        </p>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-2xl p-4 flex gap-3 text-sm text-red-800 dark:text-red-300">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <strong>Gagal Memuat Data:</strong> {errorMsg}
          </div>
        </div>
      )}

      {/* Single Tab Asrama Standalone — Khusus Pengasuh / Peran Terbatas */}
      {(userRole && !['admin', 'staff'].includes(userRole)) || isPengasuhUser ? (
        <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 w-full text-center">
          <div className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-sm w-full">
            <MapPin size={16} />
            <span>{displayAsramaName}</span>
          </div>
        </div>
      ) : null}

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
                  {['Semua', 'A', 'B', 'C', 'D', 'E', 'F', 'Lainnya'].map((dorm) => (
                    <button
                      key={dorm}
                      onClick={() => setSelectedSubTab(dorm)}
                      className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                        selectedSubTab === dorm
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      {dorm === 'Semua' ? 'Semua Asrama' : dorm === 'Lainnya' ? 'Tanpa Asrama' : `Asrama ${dorm}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filterKategori === 'madrasah' && (
              <div className="flex flex-col gap-3 w-full pt-1">
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

                <div className="text-xs text-blue-800 dark:text-blue-200 bg-blue-50/80 dark:bg-blue-900/30 p-2.5 rounded-xl border border-blue-200/80 dark:border-blue-800/50 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-blue-500" />
                  <span>
                    <strong>Struktur Tingkatan:</strong> <u>Wustho</u> = MA & SMK | <u>Ula</u> = MTs & SMP. Sistem pembayaran saat ini diprioritaskan untuk <strong>Pondok Pesantren Matholi'ul Anwar</strong>.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* View Mode Switcher + Status Filters + Search */}
        <div className="p-4 md:p-5 border-b border-gray-200/80 dark:border-gray-700/80 flex flex-col gap-4">
          
          {/* SAKELAR MODE TAMPILAN: TOTAL PER SANTRI VS RINCIAN DETAIL */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">Mode Tampilan Data</span>
            <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 gap-1.5 w-full">
              <button
                onClick={() => setViewMode('ringkasan')}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-extrabold rounded-xl transition-all ${
                  viewMode === 'ringkasan'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800/60'
                }`}
              >
                <Layers size={16} />
                <span>Total Per Santri</span>
              </button>
              <button
                onClick={() => setViewMode('rincian')}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-extrabold rounded-xl transition-all ${
                  viewMode === 'rincian'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800/60'
                }`}
              >
                <ListFilter size={16} />
                <span>Rincian Tagihan</span>
              </button>
            </div>
          </div>

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

            {/* Belum Lunas & Sudah Lunas - grid 2 kolom agar tidak meluber di HP */}
            <div className="grid grid-cols-2 bg-gray-100/70 dark:bg-gray-900/60 p-1.5 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 gap-1.5 w-full">
              <button 
                onClick={() => setFilterStatus('Belum')}
                className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 text-xs font-bold rounded-xl transition-all text-center ${
                  filterStatus === 'Belum' 
                    ? 'bg-red-600 text-white shadow-md' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                }`}
              >
                <span className="text-[11px] font-extrabold leading-tight">Belum Lunas</span>
                <span className="text-base font-black leading-tight">({countBelum})</span>
              </button>
              <button 
                onClick={() => setFilterStatus('Lunas')}
                className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 text-xs font-bold rounded-xl transition-all text-center ${
                  filterStatus === 'Lunas' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                }`}
              >
                <span className="text-[11px] font-extrabold leading-tight">Sudah Lunas</span>
                <span className="text-base font-black leading-tight">({countLunas})</span>
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

        {/* Dynamic Summary Cards */}
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
          {viewMode === 'ringkasan' ? (
            /* === MODE RINGKASAN: TOTAL PER SANTRI === */
            groupedSantriList.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700/60 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText className="text-gray-400" size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Tidak ada santri</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Tidak ditemukan data santri untuk filter yang dipilih.</p>
              </div>
            ) : userRole === 'wali_murid' || userRole === 'wali_alumni' ? (
              /* CARD VIEW FOR WALI MURID (Mobile-Friendly) */
              <div className="space-y-4">
                {groupedSantriList.map((group) => {
                  const waUrlGroup = formatWaUrlGrouped(group.no_wali, group.nama_santri, group.items, group.totalBelum);
                  return (
                    <div key={group.key} className="border border-gray-200/80 dark:border-gray-700/80 rounded-2xl p-5 bg-gray-50/50 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-700/50 transition-all space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3.5 items-center">
                          <button 
                            onClick={() => group.foto_url && setPreviewImage({ url: group.foto_url, title: group.nama_santri })}
                            className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center group relative cursor-pointer"
                          >
                            {group.foto_url ? (
                              <img src={group.foto_url} alt={group.nama_santri} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                            ) : (
                              <User size={22} className="text-emerald-600 dark:text-emerald-400" />
                            )}
                          </button>
                          <div>
                            <h4 className="font-bold text-gray-900 dark:text-gray-100 text-base">{group.nama_santri}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">NIS: {group.nis} • {group.asrama}</p>
                          </div>
                        </div>

                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                          group.overallStatus === 'Lunas'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                            : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800'
                        }`}>
                          {group.overallStatus === 'Lunas' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                          {group.overallStatus}
                        </span>
                      </div>

                      {/* Rincian Komponen Tagihan Pills */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {getGroupedItemBadges(group.items).map((badge, idx) => (
                          <div
                            key={idx}
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium border flex items-center gap-1.5 ${
                              badge.status === 'Lunas'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300'
                            }`}
                          >
                            <span>{badge.nama_tagihan}:</span>
                            <span className="font-bold">{formatRupiah(badge.totalNominal)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-gray-400 block">Total Tunggakan</span>
                          <span className={`text-lg font-black ${group.totalBelum > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {formatRupiah(group.totalBelum)}
                          </span>
                        </div>

                        <button
                          onClick={() => setSelectedDetailGroup(group)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1"
                        >
                          <span>Rincian</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TABLE VIEW FOR ADMIN, STAFF & PENGASUH (RINGKASAN TOTAL PER SANTRI) */
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
                      <th className="px-4 py-3.5">
                        <span>Rincian Tagihan</span>
                      </th>
                      <th className="px-4 py-3.5 cursor-pointer hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors select-none" onClick={() => handleSort('asrama')}>
                        <div className="flex items-center gap-1.5">
                          <span>Asrama / Kelas</span>
                          {sortField === 'asrama' ? (sortOrder === 'asc' ? <ArrowUp size={14} className="text-emerald-500" /> : <ArrowDown size={14} className="text-emerald-500" />) : <ArrowUpDown size={13} className="opacity-40" />}
                        </div>
                      </th>
                      <th className="px-4 py-3.5 cursor-pointer hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors select-none" onClick={() => handleSort('nominal')}>
                        <div className="flex items-center gap-1.5">
                          <span>Total Tunggakan</span>
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
                    {groupedSantriList.map((group) => {
                      const waUrlGroup = formatWaUrlGrouped(group.no_wali, group.nama_santri, group.items, group.totalBelum);
                      return (
                        <tr key={group.key} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors">
                          {/* Santri & Wali */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => group.foto_url && setPreviewImage({ url: group.foto_url, title: group.nama_santri })}
                                title="Klik untuk memperbesar foto"
                                className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center group relative cursor-pointer"
                              >
                                {group.foto_url ? (
                                  <img src={group.foto_url} alt={group.nama_santri} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                ) : (
                                  <User size={18} className="text-emerald-600 dark:text-emerald-400" />
                                )}
                              </button>

                              <div>
                                <div className="font-bold text-gray-900 dark:text-gray-100">{group.nama_santri}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                  <span>NIS: {group.nis}</span>
                                  {group.nama_wali && group.nama_wali !== '-' && (
                                    <>
                                      <span>•</span>
                                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Wali: {group.nama_wali}</span>
                                    </>
                                  )}
                                </div>
                                {group.alamat && group.alamat !== '-' && (
                                  <div className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                                    <MapPin size={11} className="shrink-0" />
                                    <span className="truncate max-w-[180px]">{group.alamat}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Rincian Komponen Tagihan (Pills) */}
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                              {getGroupedItemBadges(group.items).map((badge, idx) => (
                                <span 
                                  key={idx} 
                                  className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${
                                    badge.status === 'Lunas'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                                  }`}
                                >
                                  {badge.nama_tagihan}: {formatRupiah(badge.totalNominal)}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Asrama / Kelas */}
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                              {group.asrama} {group.kamar ? `(${group.kamar})` : ''}
                            </span>
                          </td>

                          {/* Total Tunggakan */}
                          <td className="px-4 py-3.5 font-extrabold text-gray-900 dark:text-gray-100">
                            <span className={group.totalBelum > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                              {formatRupiah(group.totalBelum)}
                            </span>
                          </td>

                          {/* Status Overall */}
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                              group.overallStatus === 'Lunas'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                                : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800'
                            }`}>
                              {group.overallStatus === 'Lunas' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                              {group.overallStatus}
                            </span>
                          </td>

                          {/* Aksi */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center gap-2">
                              {/* Detail Group Modal */}
                              <button
                                onClick={() => setSelectedDetailGroup(group)}
                                title="Lihat Rincian Lengkap Santri"
                                className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors"
                              >
                                <Lightbulb size={16} />
                              </button>

                              {/* WhatsApp Direct Group Message */}
                              {group.totalBelum > 0 && group.no_wali ? (
                                <a
                                  href={waUrlGroup}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`Kirim WA Rincian ke Wali (${group.nama_wali})`}
                                  className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 transition-colors"
                                >
                                  <MessageCircle size={16} />
                                </a>
                              ) : (
                                <Link
                                  href={`/dashboard/notifikasi?tab=pembayaran&nis=${group.nis}`}
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
          ) : (
            /* === MODE RINCIAN: ITEM RINCIAN PER TAGIHAN === */
            filteredTagihan.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700/60 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText className="text-gray-400" size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Tidak ada tagihan</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Tidak ditemukan data tagihan untuk filter yang dipilih.</p>
              </div>
            ) : userRole === 'wali_murid' || userRole === 'wali_alumni' ? (
              /* CARD VIEW FOR WALI MURID */
              <div className="space-y-4">
                {filteredTagihan.map((t) => (
                  <div key={t.id} className="border border-gray-200/80 dark:border-gray-700/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex gap-4 items-start sm:items-center">
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
              /* TABLE VIEW FOR ADMIN, STAFF & PENGASUH (MODE RINCIAN ITEM) */
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
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
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

                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-800 dark:text-gray-200">{t.nama_tagihan}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Periode: {t.periode}</div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                              {t.asrama} {t.kamar ? `(${t.kamar})` : ''}
                            </span>
                          </td>

                          <td className="px-4 py-3 font-extrabold text-gray-900 dark:text-gray-100">
                            {formatRupiah(t.nominal)}
                          </td>

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

                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setSelectedDetailItem(t)}
                                title="Lihat Detail Lengkap Santri"
                                className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors"
                              >
                                <Lightbulb size={16} />
                              </button>

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
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
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

      {/* MODAL 2: DETAIL GROUP SANTRI & RINCIAN TAGIHAN (MODE RINGKASAN) */}
      {selectedDetailGroup && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pb-20 sm:pb-0 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[78vh] sm:max-h-[88vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700">
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white flex items-center justify-between relative">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => selectedDetailGroup.foto_url && setPreviewImage({ url: selectedDetailGroup.foto_url, title: selectedDetailGroup.nama_santri })}
                  className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/80 bg-white/20 shrink-0 flex items-center justify-center cursor-pointer shadow-md"
                >
                  {selectedDetailGroup.foto_url ? (
                    <img src={selectedDetailGroup.foto_url} alt={selectedDetailGroup.nama_santri} className="w-full h-full object-cover" />
                  ) : (
                    <User size={28} className="text-white" />
                  )}
                </button>
                <div>
                  <h3 className="font-extrabold text-lg text-white leading-tight">{selectedDetailGroup.nama_santri}</h3>
                  <p className="text-xs text-emerald-100 mt-0.5">NIS: {selectedDetailGroup.nis} • {selectedDetailGroup.asrama}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDetailGroup(null)}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Detail Group */}
            <div className="p-5 space-y-4 text-sm text-gray-700 dark:text-gray-200 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-900/50 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700/60">
                <div>
                  <span className="text-xs text-gray-400 block font-semibold">Nama Wali</span>
                  <span className="font-bold text-gray-800 dark:text-gray-100">{selectedDetailGroup.nama_wali || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-semibold">No HP / WA Wali</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Phone size={13} />
                    {selectedDetailGroup.no_wali || '-'}
                  </span>
                </div>
              </div>

              {selectedDetailGroup.alamat && selectedDetailGroup.alamat !== '-' && (
                <div className="bg-gray-50 dark:bg-gray-900/50 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700/60">
                  <span className="text-xs text-gray-400 block font-semibold">Alamat Santri</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200 flex items-start gap-1.5 mt-0.5">
                    <MapPin size={15} className="shrink-0 text-emerald-500 mt-0.5" />
                    {selectedDetailGroup.alamat}
                  </span>
                </div>
              )}

              {/* Rincian Komponen Tagihan */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2.5">
                <span className="text-xs font-extrabold uppercase text-gray-400 tracking-wider block">Rincian Komponen Tagihan</span>
                <div className="space-y-2">
                  {getGroupedItemBadges(selectedDetailGroup.items).map((badge, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700/50">
                      <div>
                        <div className="font-bold text-gray-800 dark:text-gray-100 text-xs">{badge.nama_tagihan}</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-black text-xs ${badge.status === 'Lunas' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatRupiah(badge.totalNominal)}
                        </div>
                        <span className={`text-[10px] font-extrabold uppercase ${badge.status === 'Lunas' ? 'text-emerald-500' : 'text-red-500'}`}>
                          {badge.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-dashed border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Total Tunggakan</span>
                  <span className={`text-xl font-black ${selectedDetailGroup.totalBelum > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatRupiah(selectedDetailGroup.totalBelum)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Modal Action */}
            <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-gray-50 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-700 flex gap-3 shrink-0">
              <button
                onClick={() => setSelectedDetailGroup(null)}
                className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-2xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Tutup
              </button>
              {selectedDetailGroup.no_wali && (
                <a
                  href={formatWaUrlGrouped(selectedDetailGroup.no_wali, selectedDetailGroup.nama_santri, selectedDetailGroup.items, selectedDetailGroup.totalBelum)}
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

      {/* MODAL 3: DETAIL SINGLE ITEM TAGIHAN */}
      {selectedDetailItem && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pb-20 sm:pb-0 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[78vh] sm:max-h-[88vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700">
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
            <div className="p-5 space-y-4 text-sm text-gray-700 dark:text-gray-200 overflow-y-auto flex-1">
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
            <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-gray-50 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-700 flex gap-3 shrink-0">
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
