'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  QrCode, Download, Send, Search, Building2, RefreshCw, FileText,
  Archive, CheckCircle2, Phone, X, ExternalLink, Sparkles, AlertCircle, Eye,
  ChevronLeft, ChevronRight, ArrowLeft, ZoomIn
} from 'lucide-react';
import Link from 'next/link';
import { exportToExcel } from '@/lib/exportUtils';

const HOMEBASES = [
  'SEMUA',
  'TKM NU MAWAR',
  'MI BANIN',
  'MI BANAT',
  'SMP NU',
  'MTS PUTRA-PUTRI',
  'MA MAWAR',
  'SMK NU',
  'MADIN',
  'MQ',
  'KOPMA',
  'KLINIK',
  'KBIHU MAWAR'
];

export default function QrDewanGuruPage() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [isPengasuh, setIsPengasuh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedHomebase, setSelectedHomebase] = useState('SEMUA');
  const [showAllCards, setShowAllCards] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // Preview Modal
  const [previewGuru, setPreviewGuru] = useState<any>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // Send WhatsApp Modal
  const [waModalGuru, setWaModalGuru] = useState<any>(null);
  const [waCustomPhone, setWaCustomPhone] = useState('');
  const [copied, setCopied] = useState(false);

  // Check auth
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const d = await res.json();
        if (!d.success) {
          router.replace('/dashboard');
          return;
        }
        const user = d.user;
        const pengasuhFlag = user.role === 'pengasuh' || user.is_pengasuh || user.isPengasuh;
        const isGuruUser = user.role === 'guru';
        if (user.role !== 'admin' && user.role !== 'staff' && !pengasuhFlag && !isGuruUser) {
          router.replace('/dashboard');
          return;
        }
        setRole(user.role);
        setIsPengasuh(!!pengasuhFlag);
      } catch {
        router.replace('/dashboard');
      }
    })();
  }, [router]);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/dewan-guru?all=true';
      if (selectedHomebase !== 'SEMUA') url += `&homebase=${encodeURIComponent(selectedHomebase)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok && json.success) {
        setTeachers(json.data || []);
        setStats(json.stats || []);
      }
    } catch (e) {
      console.error('Failed to load dewan guru', e);
    } finally {
      setLoading(false);
    }
  }, [selectedHomebase]);

  useEffect(() => {
    if (role || isPengasuh) fetchTeachers();
  }, [role, isPengasuh, fetchTeachers]);

  const handleSync = async (mode: 'online' | 'offline') => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch(`/api/dewan-guru/sync?mode=${mode}`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Gagal sinkronisasi');
      } else {
        setSyncMsg(json.message);
        await fetchTeachers();
      }
    } catch (e: any) {
      alert('Koneksi gagal: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 24;

  const filteredTeachers = useMemo(() => {
    let list = teachers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        t =>
          (t.nama || '').toLowerCase().includes(q) ||
          (t.homebase || '').toLowerCase().includes(q) ||
          (t.no_hp || '').includes(q) ||
          (t.nip || '').includes(q)
      );
    }
    return list;
  }, [teachers, search]);

  // Reset page saat filter/search berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedHomebase]);

  const totalPages = Math.ceil(filteredTeachers.length / pageSize) || 1;
  const paginatedTeachers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTeachers.slice(start, start + pageSize);
  }, [filteredTeachers, currentPage, pageSize]);

  const openWaDialog = (guru: any) => {
    setWaModalGuru(guru);
    setWaCustomPhone(guru.no_hp || '');
    setCopied(false);
  };

  const getWaMessage = (guru: any) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.ppmawar.or.id';
    const link = `${origin}/absen/guru?token=${guru.qr_token}`;
    return `Assalamu'alaikum Wr. Wb.

Yth. *${guru.nama}*
(${guru.homebase})

Berikut kami sampaikan tautan Kartu Presensi Digital Kehadiran Dewan Guru PP. Matholi'ul Anwar:

🔗 *Link Presensi:*
${link}

Bapak/Ibu Ustadz dapat membuka tautan di atas atau menyimpan gambar QR Code untuk melakukan absensi kehadiran.

Terima kasih.
_Pondok Pesantren Matholi'ul Anwar Simo Sungelebak_`;
  };

  const handleSendWa = () => {
    if (!waModalGuru) return;
    let phone = waCustomPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);
    if (!phone) {
      alert('Mohon masukkan nomor WhatsApp yang valid.');
      return;
    }
    const msg = encodeURIComponent(getWaMessage(waModalGuru));
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const handleCopyText = () => {
    if (!waModalGuru) return;
    navigator.clipboard.writeText(getWaMessage(waModalGuru));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportExcel = () => {
    const list = filteredTeachers;
    if (list.length === 0) {
      alert('Tidak ada data guru untuk diexport.');
      return;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.ppmawar.or.id';
    const title = 'DATA QR CODE & LINK PRESENSI DEWAN GURU YPMA';
    const subtitle = `Unit / Homebase: ${selectedHomebase} | Total Guru: ${list.length}`;
    const filename = `Data_QR_Dewan_Guru_${selectedHomebase.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const columns = ['No', 'NIP', 'Nama Lengkap', 'Jenis Kelamin', 'Unit / Homebase', 'No. WhatsApp', 'Link Presensi Digital'];
    const rows = list.map((g, idx) => [
      idx + 1,
      g.nip || '-',
      g.nama || '-',
      g.jenis_kelamin || '-',
      g.homebase || '-',
      g.no_hp || '-',
      `${origin}/absen/guru?token=${g.qr_token}`
    ]);
    exportToExcel({ title, subtitle, columns, rows, filename });
  };

  // ─── Generate PDF di browser (client-side) ─────────────────────────────────
  // Solusi untuk server timeout saat generate 441 QR sekaligus
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [clientPdfUrl, setClientPdfUrl] = useState<string | null>(null);

  const handleClientPDF = async (previewOnly = false) => {
    const list = filteredTeachers;
    if (list.length === 0) {
      alert('Tidak ada data guru untuk diexport.');
      return;
    }

    setPdfGenerating(true);
    setPdfProgress(0);
    setClientPdfUrl(null);
    if (!previewOnly) setShowPdfPreview(false);

    try {
      const [jsPDFModule, QRCode] = await Promise.all([
        import('jspdf'),
        import('qrcode')
      ]);
      const { jsPDF } = jsPDFModule;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.ppmawar.or.id';

      const cols = 3;
      const rowsPerPage = 3;
      const cardWidth = 58;
      const cardHeight = 82;
      const marginX = (pageWidth - cols * cardWidth) / (cols + 1);
      const marginY = 16;
      const gapY = (pageHeight - marginY * 2 - rowsPerPage * cardHeight) / (rowsPerPage - 1);

      for (let i = 0; i < list.length; i++) {
        const pageIndex = Math.floor(i / (cols * rowsPerPage));
        const cardIndexInPage = i % (cols * rowsPerPage);
        const colIndex = cardIndexInPage % cols;
        const rowIndex = Math.floor(cardIndexInPage / cols);

        if (i > 0 && cardIndexInPage === 0) doc.addPage();

        if (cardIndexInPage === 0) {
          doc.setFontSize(10);
          doc.setTextColor(30, 41, 59);
          doc.setFont('helvetica', 'bold');
          doc.text("KARTU PRESENSI QR DEWAN GURU - PP. MATHOLI'UL ANWAR", pageWidth / 2, 9, { align: 'center' });
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          const sub = selectedHomebase !== 'SEMUA' ? `Unit: ${selectedHomebase} | Halaman ${pageIndex + 1}` : `Halaman ${pageIndex + 1}`;
          doc.text(sub, pageWidth / 2, 13, { align: 'center' });
        }

        const g = list[i];
        const qrValue = `${origin}/absen/guru?token=${encodeURIComponent(g.qr_token)}`;
        const qrDataUrl = await (QRCode as any).toDataURL(qrValue, {
          width: 160, margin: 1, color: { dark: '#042f2e', light: '#ffffff' }
        });

        const x = marginX + colIndex * (cardWidth + marginX);
        const y = marginY + rowIndex * (cardHeight + gapY);

        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');
        doc.setFillColor(15, 118, 110);
        doc.roundedRect(x, y, cardWidth, 12, 3, 3, 'F');
        doc.rect(x, y + 8, cardWidth, 4, 'F');

        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
        doc.text("PP. MATHOLI'UL ANWAR", x + cardWidth / 2, y + 5.5, { align: 'center' });
        doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
        doc.text(g.homebase || 'YPMA', x + cardWidth / 2, y + 9.5, { align: 'center' });

        const qrSize = 42;
        doc.addImage(qrDataUrl, 'PNG', x + (cardWidth - qrSize) / 2, y + 14, qrSize, qrSize);

        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
        const splitName = doc.splitTextToSize(g.nama || 'Dewan Guru', cardWidth - 6);
        doc.text(splitName, x + cardWidth / 2, y + 60, { align: 'center' });

        doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
        if (g.nip) doc.text(`NIP: ${g.nip}`, x + cardWidth / 2, y + 74, { align: 'center' });
        else doc.text('Kartu Presensi Resmi', x + cardWidth / 2, y + 74, { align: 'center' });
        doc.text('Scan untuk Absensi Kehadiran', x + cardWidth / 2, y + 77.5, { align: 'center' });

        // Update progress tiap 5 guru
        if (i % 5 === 0) {
          setPdfProgress(Math.round(((i + 1) / list.length) * 100));
          await new Promise(r => setTimeout(r, 0)); // yield ke browser
        }
      }

      const pdfName = list.length === 1
        ? `Kartu_QR_${(list[0].nama || 'Guru').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
        : `Katalog_QR_Guru_${selectedHomebase !== 'SEMUA' ? selectedHomebase.replace(/[^a-zA-Z0-9_-]/g, '_') : 'YPMA'}.pdf`;

      if (previewOnly) {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
        if (isMobile) {
          window.open(url, '_blank');
        } else {
          setClientPdfUrl(url);
          setShowPdfPreview(true);
        }
      } else {
        doc.save(pdfName);
      }
    } catch (err: any) {
      alert('Gagal membuat PDF: ' + err.message);
    } finally {
      setPdfGenerating(false);
      setPdfProgress(0);
    }
  };

  const isGuru = role === 'guru';
  const canManage = (role === 'admin' || role === 'staff' || isPengasuh) && !isGuru;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28">
      {/* Top Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-2.5 sm:py-3 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
          {/* Baris 1: Ikon & Teks Judul */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 shrink-0">
              <QrCode size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5 leading-tight truncate">
                <span>QR Code Presensi Dewan Guru</span>
                {isGuru && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                    Kartu Pribadi
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-slate-400 truncate">
                {isGuru ? 'Kartu Presensi Digital Kehadiran Pribadi' : `Total ${teachers.length} Dewan Guru & Karyawan YPMA`}
              </p>
            </div>
          </div>

          {/* Baris 2: Tombol Aksi */}
          {canManage ? (
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              {/* Tombol Kembali */}
              <Link
                href="/dashboard/absen-guru"
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                title="Kembali ke Presensi Dewan Guru"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Kembali</span>
              </Link>

              {/* Preview PDF (Client-Side) */}
              <button
                onClick={() => handleClientPDF(true)}
                disabled={pdfGenerating}
                className="flex-1 sm:flex-initial py-2 px-2 sm:px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] sm:text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-center disabled:opacity-60"
                title="Preview Dokumen PDF Katalog Kartu QR (di browser)"
              >
                <FileText size={13} className="shrink-0" />
                <span>{pdfGenerating ? `${pdfProgress}%` : 'Preview PDF'}</span>
              </button>

              {/* Unduh PDF (Client-Side) */}
              <button
                onClick={() => handleClientPDF(false)}
                disabled={pdfGenerating}
                className="flex-1 sm:flex-initial py-2 px-2 sm:px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] sm:text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-center disabled:opacity-60"
                title="Unduh Dokumen PDF Katalog Kartu A4 (di browser)"
              >
                <Download size={13} className={`shrink-0 ${pdfGenerating ? 'animate-bounce' : ''}`} />
                <span>{pdfGenerating ? `${pdfProgress}%` : 'Unduh PDF'}</span>
              </button>

              {/* Unduh Excel */}
              <button
                onClick={handleExportExcel}
                className="flex-1 sm:flex-initial py-2 px-2 sm:px-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-[11px] sm:text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-center"
                title="Unduh Daftar QR & Link Presensi ke File Excel"
              >
                <Download size={13} className="shrink-0" />
                <span>Unduh Excel</span>
              </button>

              {/* Download Bulk ZIP (tetap server-side, untuk gambar PNG) */}
              <a
                href={`/api/dewan-guru/qr/bulk?type=zip&homebase=${encodeURIComponent(selectedHomebase)}`}
                download
                className="flex-1 sm:flex-initial py-2 px-2 sm:px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-[11px] sm:text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-center"
                title="Download File ZIP Semua Gambar QR (PNG)"
              >
                <Archive size={13} className="shrink-0" />
                <span>Unduh ZIP</span>
              </a>

              {/* Tombol Sinkronisasi Online */}
              <button
                onClick={() => handleSync('online')}
                disabled={syncing}
                className="flex-1 sm:flex-initial py-2 px-2 sm:px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[11px] sm:text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer text-center"
                title="Tarik data terbaru dari Google Sheets"
              >
                <RefreshCw size={13} className={`shrink-0 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Menarik...' : 'Tarik Online'}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              {/* Tombol Kembali (Guru) */}
              <Link
                href="/dashboard"
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                title="Kembali ke Beranda"
              >
                <ArrowLeft size={16} />
                <span>Kembali</span>
              </Link>

              {/* Preview PDF Kartu Pribadi */}
              <button
                onClick={() => handleClientPDF(true)}
                disabled={pdfGenerating || filteredTeachers.length === 0}
                className="flex-1 sm:flex-initial py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-center disabled:opacity-60"
                title="Preview Kartu Presensi QR PDF"
              >
                <FileText size={13} className="shrink-0" />
                <span>{pdfGenerating ? `${pdfProgress}%` : 'Preview PDF'}</span>
              </button>

              {/* Unduh PDF Kartu Pribadi */}
              <button
                onClick={() => handleClientPDF(false)}
                disabled={pdfGenerating || filteredTeachers.length === 0}
                className="flex-1 sm:flex-initial py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-center disabled:opacity-60"
                title="Unduh Kartu Presensi QR PDF"
              >
                <Download size={13} className={`shrink-0 ${pdfGenerating ? 'animate-bounce' : ''}`} />
                <span>{pdfGenerating ? `${pdfProgress}%` : 'Unduh PDF'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Progress Overlay saat generate PDF ──────────────────────────────── */}
      {pdfGenerating && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 w-72 text-center space-y-4 border border-slate-200 dark:border-slate-700">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">Membuat PDF Katalog QR...</h3>
              <p className="text-xs text-slate-400 mt-1">Proses berlangsung di browser Anda</p>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
              <div
                className="bg-purple-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${pdfProgress}%` }}
              />
            </div>
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{pdfProgress}%</p>
            <p className="text-[11px] text-slate-400">Harap tunggu, jangan tutup halaman ini...</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 pt-4 space-y-3">
        {canManage ? (
          <>
            {/* Sync Success Notification */}
            {syncMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{syncMsg}</span>
                </div>
                <button onClick={() => setSyncMsg('')} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Homebase Filter & Search Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              {/* Search Box */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama guru, NIP, no. HP, atau homebase..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full text-xs pl-10 pr-9 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Homebase Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                {HOMEBASES.map(hb => {
                  const count = hb === 'SEMUA'
                    ? teachers.length
                    : (stats.find(s => s.homebase === hb)?.count || 0);

                  return (
                    <button
                      key={hb}
                      onClick={() => setSelectedHomebase(hb)}
                      className={`py-1.5 px-3 rounded-xl font-bold whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 ${
                        selectedHomebase === hb
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{hb === 'SEMUA' ? '🌐 Semua' : hb}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                          selectedHomebase === hb ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grid Cards (Admin / Staff / Pengasuh) */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-3 animate-pulse space-y-2">
                    <div className="w-full aspect-square bg-slate-100 dark:bg-slate-800 rounded-2xl" />
                    <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded-full w-3/4 mx-auto" />
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full w-1/2 mx-auto" />
                  </div>
                ))}
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
                <QrCode size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <h3 className="font-extrabold text-slate-700 dark:text-slate-200 text-sm">Tidak Ada Guru Ditemukan</h3>
                <p className="text-xs text-slate-400 mt-1">Coba ubah kata kunci pencarian atau filter unit.</p>
              </div>
            ) : !showAllCards && selectedHomebase === 'SEMUA' && !search.trim() ? (
              <div className="text-center py-10 sm:py-14 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto shadow-xs">
                  <QrCode size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                    Pilih Unit Lembaga atau Tampilkan Seluruh Kartu QR
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                    Untuk menjaga kecepatan browser di layar HP dan laptop, silakan pilih salah satu tombol Unit di atas atau klik tombol di bawah untuk menampilkan seluruh {teachers.length || 441} kartu QR.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setShowAllCards(true)}
                    className="py-2.5 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition-all shadow-md shadow-teal-600/20 inline-flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <QrCode size={16} />
                    <span>Tampilkan Semua Kartu QR ({teachers.length || 441} Guru)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {paginatedTeachers.map((guru, idx) => {
                    const itemIndex = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <div
                        key={guru.id}
                        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-lg transition-all p-3 flex flex-col justify-between group"
                      >
                        <div>
                          {/* Homebase Badge */}
                          <div className="flex items-center justify-between gap-1 mb-2">
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 truncate max-w-[85%]">
                              {guru.homebase}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">
                              #{itemIndex}
                            </span>
                          </div>

                          {/* QR Image Box */}
                          <div
                            onClick={() => setPreviewGuru(guru)}
                            className="w-full aspect-square bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-2 border border-slate-100 dark:border-slate-800 flex items-center justify-center cursor-pointer hover:border-teal-400 transition-colors relative"
                          >
                            <img
                              src={`/api/dewan-guru/qr?token=${encodeURIComponent(guru.qr_token)}`}
                              alt={`QR ${guru.nama}`}
                              className="w-full h-full object-contain rounded-xl"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-teal-900/0 hover:bg-teal-900/30 rounded-2xl flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                              <span className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 p-1.5 rounded-xl shadow-md">
                                <ZoomIn size={16} />
                              </span>
                            </div>
                          </div>

                          {/* Teacher Info */}
                          <div className="mt-2 text-center">
                            <h3
                              className="text-xs font-black text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight"
                              title={guru.nama}
                            >
                              {guru.nama}
                            </h3>
                            {guru.no_hp && (
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate flex items-center justify-center gap-1">
                                <Phone size={9} /> {guru.no_hp}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-1.5 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <a
                            href={`/api/dewan-guru/qr?token=${encodeURIComponent(guru.qr_token)}&download=true`}
                            download
                            className="p-2 rounded-xl bg-slate-100 hover:bg-teal-50 hover:text-teal-600 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                            title="Unduh Gambar QR"
                          >
                            <Download size={13} />
                            <span>Unduh</span>
                          </a>

                          <button
                            onClick={() => openWaDialog(guru)}
                            className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title="Kirim via WhatsApp"
                          >
                            <Send size={13} />
                            <span>Kirim</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Menampilkan <span className="font-bold text-slate-700 dark:text-slate-200">{(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredTeachers.length)}</span> dari <span className="font-bold text-teal-600 dark:text-teal-400">{filteredTeachers.length}</span> guru
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-all cursor-pointer"
                        title="Halaman Sebelumnya"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                        {currentPage} / {totalPages}
                      </span>

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-all cursor-pointer"
                        title="Halaman Selanjutnya"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* ========================================================================= */
          /* TAMPILAN KHUSUS ROLE GURU: KARTU PRESENSI DIGITAL PRIBADI                 */
          /* ========================================================================= */
          <div className="py-2 sm:py-6">
            {loading ? (
              <div className="max-w-sm sm:max-w-md mx-auto p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm animate-pulse space-y-4 text-center">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-1/3 mx-auto" />
                <div className="w-56 h-56 bg-slate-100 dark:bg-slate-800 rounded-2xl mx-auto" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-2/3 mx-auto" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-1/2 mx-auto" />
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="max-w-sm sm:max-w-md mx-auto p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-sm">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
                  <AlertCircle size={28} />
                </div>
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">
                  Data Dewan Guru Belum Ditemukan
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Akun Anda belum terhubung secara otomatis dengan basis data Dewan Guru YPMA. Silakan hubungi Admin atau Pengasuh untuk mengaitkan akun Anda agar Kartu Presensi Digital dapat ditampilkan.
                </p>
                <div className="pt-2">
                  <Link
                    href="/dashboard"
                    className="inline-block py-2.5 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all"
                  >
                    Kembali ke Beranda
                  </Link>
                </div>
              </div>
            ) : (
              (() => {
                const guru = filteredTeachers[0];
                return (
                  <div className="max-w-sm sm:max-w-md mx-auto space-y-3.5">
                    {/* Kartu Presensi Digital */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-teal-500/30 dark:border-teal-500/20 shadow-xl p-5 sm:p-6 flex flex-col items-center text-center space-y-3.5 relative overflow-hidden">
                      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-600" />

                      {/* Header Kartu */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-black px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 tracking-wider uppercase inline-block">
                          {guru.homebase || 'YPMA'}
                        </span>
                        <h2 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest pt-1">
                          PP. MATHOLI'UL ANWAR
                        </h2>
                        <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 tracking-wider uppercase">
                          Kartu Presensi Digital Kehadiran
                        </p>
                      </div>

                      {/* Box QR Code */}
                      <div
                        onClick={() => setPreviewGuru(guru)}
                        className="w-56 h-56 sm:w-64 sm:h-64 bg-white dark:bg-slate-800/80 p-3 rounded-2xl border-2 border-dashed border-teal-200 dark:border-teal-700/60 flex items-center justify-center cursor-pointer hover:border-teal-500 transition-all shadow-inner group relative"
                        title="Klik untuk memperbesar tampilan QR Code"
                      >
                        <img
                          src={`/api/dewan-guru/qr?token=${encodeURIComponent(guru.qr_token)}`}
                          alt={`QR ${guru.nama}`}
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-teal-950/30 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="bg-white/95 dark:bg-slate-900/95 text-teal-700 dark:text-teal-300 px-3 py-1.5 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5">
                            <ZoomIn size={15} /> Perbesar QR
                          </span>
                        </div>
                      </div>

                      {/* Identitas Guru */}
                      <div className="space-y-1 w-full px-2">
                        <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 leading-snug">
                          {guru.nama}
                        </h3>
                        {guru.nip ? (
                          <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                            NIP: {guru.nip}
                          </p>
                        ) : (
                          <p className="text-[11px] font-medium text-slate-400">
                            Dewan Guru & Pembina Pesantren
                          </p>
                        )}
                        {guru.no_hp && (
                          <p className="text-[11px] font-mono text-slate-400 flex items-center justify-center gap-1.5">
                            <Phone size={11} /> {guru.no_hp}
                          </p>
                        )}
                      </div>

                      {/* Tombol Aksi Langsung pada Kartu */}
                      <div className="w-full grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <a
                          href={`/api/dewan-guru/qr?token=${encodeURIComponent(guru.qr_token)}&download=true`}
                          download
                          className="py-2.5 px-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                          title="Simpan gambar QR Code ke galeri HP"
                        >
                          <Download size={14} />
                          <span>Unduh QR</span>
                        </a>

                        <button
                          onClick={() => openWaDialog(guru)}
                          className="py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                          title="Kirim link presensi digital ke WhatsApp"
                        >
                          <Send size={14} />
                          <span>Kirim WA</span>
                        </button>
                      </div>
                    </div>

                    {/* Petunjuk Penggunaan */}
                    <div className="p-3.5 bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-800/50 rounded-2xl text-[11px] text-teal-900 dark:text-teal-200 leading-relaxed flex items-start gap-2.5 shadow-2xs">
                      <Sparkles size={16} className="shrink-0 mt-0.5 text-teal-600 dark:text-teal-400" />
                      <div>
                        <p className="font-bold">Panduan Presensi Kehadiran:</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                          Tunjukkan QR Code ini langsung di hadapan kamera pos presensi saat hadir mengajar, atau unduh gambarnya ke galeri ponsel Anda untuk akses cepat tanpa perlu membuka aplikasi.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewGuru && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewGuru(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                {previewGuru.homebase}
              </span>
              <button
                onClick={() => setPreviewGuru(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="w-56 h-56 mx-auto bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
              <img
                src={`/api/dewan-guru/qr?token=${encodeURIComponent(previewGuru.qr_token)}`}
                alt={`QR ${previewGuru.nama}`}
                className="w-full h-full object-contain rounded-xl"
              />
            </div>

            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">{previewGuru.nama}</h3>
              {previewGuru.nip && <p className="text-xs text-slate-400 mt-0.5">NIP: {previewGuru.nip}</p>}
              {previewGuru.no_hp && <p className="text-xs text-slate-400 mt-0.5">WhatsApp: {previewGuru.no_hp}</p>}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <a
                href={`/api/dewan-guru/qr?token=${encodeURIComponent(previewGuru.qr_token)}&download=true`}
                download
                className="flex-1 py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Download size={15} /> Unduh PNG
              </a>
              <button
                onClick={() => {
                  const g = previewGuru;
                  setPreviewGuru(null);
                  openWaDialog(g);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Send size={15} /> Kirim Pesan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Send Dialog Modal */}
      {waModalGuru && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setWaModalGuru(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Send size={16} className="text-emerald-600" />
                <span>Kirim Kartu QR ke Guru</span>
              </h3>
              <button onClick={() => setWaModalGuru(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Penerima:</label>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-extrabold text-slate-800 dark:text-slate-200">
                  {waModalGuru.nama} ({waModalGuru.homebase})
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nomor WhatsApp Guru:</label>
                <input
                  type="text"
                  placeholder="Contoh: 08123456789 atau +628123456789"
                  value={waCustomPhone}
                  onChange={e => setWaCustomPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Teks Format Pesan:</label>
                <pre className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-sans text-[11px] leading-relaxed max-h-40 overflow-y-auto">
                  {getWaMessage(waModalGuru)}
                </pre>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleCopyText}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-bold text-xs transition-all flex items-center gap-1.5"
              >
                <span>{copied ? 'Tersalin! ✅' : 'Salin Teks'}</span>
              </button>
              <button
                type="button"
                onClick={handleSendWa}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send size={15} />
                <span>Buka WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && clientPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[88vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                    Preview Katalog PDF Kartu QR
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Unit: {selectedHomebase} | Total {filteredTeachers.length} Dewan Guru
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(clientPdfUrl, '_blank')}
                  className="py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Buka di Tab Baru Browser"
                >
                  <ExternalLink size={14} />
                  <span className="hidden sm:inline">Buka Tab Baru</span>
                </button>
                <a
                  href={clientPdfUrl}
                  download={`Katalog_QR_Guru_${selectedHomebase !== 'SEMUA' ? selectedHomebase.replace(/[^a-zA-Z0-9_-]/g, '_') : 'YPMA'}.pdf`}
                  className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} />
                  <span>Unduh PDF</span>
                </a>
                <button
                  onClick={() => { setShowPdfPreview(false); setClientPdfUrl(null); }}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 sm:p-4 overflow-hidden flex flex-col">
              <div className="sm:hidden mb-2 p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between gap-2 text-xs text-blue-700 dark:text-blue-300">
                <span>PDF tidak tampil di layar HP?</span>
                <button onClick={() => window.open(clientPdfUrl, '_blank')} className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded-lg shrink-0">
                  Buka Tab Baru
                </button>
              </div>
              <iframe
                src={clientPdfUrl}
                className="w-full flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner bg-white"
                title="Preview Katalog QR PDF"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
