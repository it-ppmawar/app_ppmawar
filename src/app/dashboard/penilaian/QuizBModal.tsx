'use client';

import { useState, useEffect } from 'react';
import {
  X, Sparkles, RefreshCw, CheckCircle, AlertCircle, HelpCircle,
  Copy, Download, ExternalLink, ArrowRight, Database, Settings,
  Radio, FileText, Check, ShieldCheck, AlertTriangle
} from 'lucide-react';

interface QuizBModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedKelas: string;
  selectedMapel: string;
  semester: string;
  tahunAjaran: string;
  muridList: any[];
  userRole?: string;
  onApplyScores: (appliedList: Array<{ murid_id: number; skor: number; targetField: 'harian' | 'uts' | 'uas'; quizTitle: string }>) => void;
}

function matchQuizWithMapels(quiz: any, mapelList: string[]): boolean {
  if (!mapelList || mapelList.length === 0) return true;
  const qTitle = (quiz.title || '').toLowerCase();
  const qCat = (quiz.category || '').toLowerCase();

  return mapelList.some((mp) => {
    const mpLower = mp.toLowerCase().trim();
    if (!mpLower) return false;

    // 1. Cek langsung substring di title atau category (dua arah)
    if (qTitle.includes(mpLower) || qCat.includes(mpLower) || (qCat && mpLower.includes(qCat))) {
      return true;
    }

    // 2. Tokenisasi kata kunci (misal: "NAHWU — Al-Ajurrumiyyah / Imriti" -> "nahwu", "ajurrumiyyah", "imriti")
    const words = mpLower
      .split(/[\s\-\—\/\\(),]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 3 && !['dan', 'atau', 'bab', 'jilid', 'kelas', 'mak', 'mts', 'madin'].includes(w));

    return words.some((word) => qTitle.includes(word) || qCat.includes(word) || (qCat && word.includes(qCat)));
  });
}

export default function QuizBModal({
  isOpen,
  onClose,
  selectedKelas,
  selectedMapel,
  semester,
  tahunAjaran,
  muridList,
  userRole,
  onApplyScores,
}: QuizBModalProps) {
  const [activeTab, setActiveTab] = useState<'fetch' | 'manual' | 'config' | 'logs'>('fetch');
  
  // State Tarik Otomatis
  const [loadingFetch, setLoadingFetch] = useState(false);
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [bridgeMessage, setBridgeMessage] = useState('');
  const [bridgeUrl, setBridgeUrl] = useState('');
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [targetField, setTargetField] = useState<'harian' | 'uts' | 'uas'>('harian');
  
  // State Preview Match
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<any>(null);

  // State Manual Paste
  const [rawText, setRawText] = useState('');
  const [manualTargetField, setManualTargetField] = useState<'harian' | 'uts' | 'uas'>('harian');
  const [manualQuizTitle, setManualQuizTitle] = useState('Quiz Online');

  // State Config & Webhook
  const [webhookUrl, setWebhookUrl] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // State Riwayat
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  // Filter kuis berdasarkan mapel yang sedang aktif
  const [quizSearchQuery, setQuizSearchQuery] = useState('');
  // Daftar mapel yang diizinkan user (RBAC dari jadwal_madin) — kosong = semua boleh (admin/staff)
  const [allowedMapel, setAllowedMapel] = useState<string[]>([]);

  // Notifikasi Berhasil
  const [successToast, setSuccessToast] = useState('');

  // 1. Load Data Awal saat Modal Dibuka
  useEffect(() => {
    if (isOpen) {
      if (!['admin', 'staff'].includes((userRole || '').toLowerCase()) && activeTab === 'config') {
        setActiveTab('fetch');
      }
      loadInitialData();
      loadSettings();
    }
  }, [isOpen, userRole]);

  const loadInitialData = async () => {
    setLoadingFetch(true);
    try {
      const res = await fetch('/api/quizb/fetch');
      const data = await res.json();
      if (data.success) {
        setBridgeConnected(data.bridge_connected || false);
        setBridgeMessage(data.bridge_message || '');
        setBridgeUrl(data.bridge_url || '');
        setQuizzes(data.quizzes || []);
        setRecentLogs(data.recent_logs || []);
        
        // Simpan daftar mapel yang diizinkan berdasarkan RBAC
        const serverAllowed: string[] = Array.isArray(data.allowed_mapel) ? data.allowed_mapel : [];
        setAllowedMapel(serverAllowed);

        const listToPick = serverAllowed.length > 0
          ? (data.quizzes || []).filter((q: any) => matchQuizWithMapels(q, serverAllowed))
          : (data.quizzes || []);

        if (listToPick.length > 0) {
          const isSpecific = selectedMapel && !['semua', 'semua mapel', 'all'].includes(selectedMapel.toLowerCase());
          const matchedList = isSpecific
            ? listToPick.filter((q: any) => matchQuizWithMapels(q, [selectedMapel]))
            : listToPick;

          const candidates = matchedList.length > 0 ? matchedList : listToPick;
          // Prioritaskan kuis / paket ujian yang sudah memiliki santri yang mengerjakan (total_peserta > 0)
          const withScores = candidates.filter((q: any) => (q.total_peserta || 0) > 0);
          const chosen = withScores.length > 0 ? withScores[0] : candidates[0];
          setSelectedQuizId(String(chosen.id));
        } else if (data.quizzes && data.quizzes.length > 0) {
          const withScores = data.quizzes.filter((q: any) => (q.total_peserta || 0) > 0);
          const chosen = withScores.length > 0 ? withScores[0] : data.quizzes[0];
          setSelectedQuizId(String(chosen.id));
        }
      }
    } catch (err: any) {
      setBridgeMessage('Gagal mengambil status QuizB: ' + err.message);
    } finally {
      setLoadingFetch(false);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/quizb/settings');
      const data = await res.json();
      if (data.success) {
        setWebhookUrl(data.webhook_url || '');
        setSecretKey(data.secret_key || '');
        if (data.bridge_url) setBridgeUrl(data.bridge_url);
      }
    } catch (e) {
      // ignore
    }
  };

  // 2. Preview Match dari QuizB
  const handlePreviewFromQuizB = async () => {
    if (!selectedQuizId) return;
    setPreviewing(true);
    setPreviewResult(null);

    const selQuiz = quizzes.find(q => String(q.id) === String(selectedQuizId));
    const qTitle = selQuiz ? selQuiz.title : `Quiz #${selectedQuizId}`;

    try {
      const res = await fetch('/api/quizb/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quiz_id: selectedQuizId,
          quiz_title: qTitle,
          kelas_id: selectedKelas,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewResult(data);
      } else {
        alert(data.error || 'Gagal memuat hasil kuis dari QuizB.');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setPreviewing(false);
    }
  };

  // 3. Parse Manual Text (JSON atau format Baris Nama, Nilai)
  const handleParseManual = async () => {
    if (!rawText.trim()) {
      alert('Silakan tempel (paste) data hasil kuis terlebih dahulu.');
      return;
    }

    setPreviewing(true);
    setPreviewResult(null);

    let parsedScores: any[] = [];

    // Coba parsing JSON
    try {
      const json = JSON.parse(rawText);
      if (Array.isArray(json)) {
        parsedScores = json;
      } else if (json.results && Array.isArray(json.results)) {
        parsedScores = json.results;
      } else if (json.scores && Array.isArray(json.scores)) {
        parsedScores = json.scores;
      }
    } catch (e) {
      // Jika bukan JSON, parse format baris demi baris:
      // Format 1: NIS, Skor
      // Format 2: Nama, Skor
      // Format 3: NIS, Nama, Skor
      const lines = rawText.trim().split('\n');
      for (const line of lines) {
        const parts = line.split(/[,\t|]/).map(p => p.trim());
        if (parts.length >= 2) {
          const lastPart = parts[parts.length - 1];
          const scoreNum = parseFloat(lastPart);
          if (!isNaN(scoreNum)) {
            if (parts.length === 2) {
              const first = parts[0];
              if (/^\d{6,}$/.test(first)) {
                parsedScores.push({ nis: first, skor: scoreNum });
              } else {
                parsedScores.push({ nama: first, skor: scoreNum });
              }
            } else if (parts.length >= 3) {
              parsedScores.push({ nis: parts[0], nama: parts[1], skor: scoreNum });
            }
          }
        }
      }
    }

    if (parsedScores.length === 0) {
      setPreviewing(false);
      alert('Format teks tidak dikenali. Harap gunakan format JSON atau baris "Nama, Nilai" atau "NIS, Nilai".');
      return;
    }

    try {
      const res = await fetch('/api/quizb/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quiz_id: 'manual_' + Date.now(),
          quiz_title: manualQuizTitle,
          scores_raw: parsedScores,
          kelas_id: selectedKelas,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewResult(data);
      } else {
        alert(data.error || 'Gagal memproses data manual.');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setPreviewing(false);
    }
  };

  // 4. Terapkan Nilai ke Tabel Penilaian
  const handleApplyToTable = (chosenTargetField: 'harian' | 'uts' | 'uas', quizTitle: string) => {
    if (!previewResult || !previewResult.matched || previewResult.matched.length === 0) {
      alert('Tidak ada santri yang cocok untuk diterapkan nilainya.');
      return;
    }

    const applied = previewResult.matched.map((m: any) => ({
      murid_id: m.murid_id,
      skor: m.skor,
      targetField: chosenTargetField,
      quizTitle: quizTitle || 'QuizB',
    }));

    onApplyScores(applied);
    setSuccessToast(`Berhasil menerapkan nilai QuizB untuk ${applied.length} santri ke kolom ${chosenTargetField.toUpperCase()}! Silakan tinjau dan klik "Simpan Semua Nilai".`);
    
    setTimeout(() => {
      onClose();
    }, 1800);
  };

  const copyToClipboard = (text: string, type: 'key' | 'webhook') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5 pb-20 sm:pb-5 bg-black/60 backdrop-blur-xs overflow-y-auto animate-[fadeIn_0.15s_ease-out]">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh] my-auto">
        
        {/* Header Modal */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-emerald-700 via-teal-800 to-emerald-950 text-white flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-emerald-200 shadow-inner">
              <Sparkles size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <h3 className="font-black text-lg sm:text-xl text-white tracking-tight leading-tight">
                  Tarik Nilai Ujian CBT / QuizB
                </h3>
                <span className="self-start sm:self-auto px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-400 text-emerald-950 shadow-xs">
                  CBT &amp; QuizB
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Sinkronkan nilai ujian CBT santri dari Portal Ujian ke buku nilai &amp; raport santri
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-100 hover:text-white hover:bg-white/15 transition-colors relative z-10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 shrink-0 px-4 pt-2 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('fetch')}
            className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 border-b-2 ${
              activeTab === 'fetch'
                ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 border-emerald-600'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 border-transparent'
            }`}
          >
            <Database size={15} />
            <span>Tarik Nilai Ujian CBT</span>
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 border-b-2 ${
              activeTab === 'manual'
                ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 border-emerald-600'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 border-transparent'
            }`}
          >
            <FileText size={15} />
            <span>Tempel / Input Cepat</span>
          </button>

          {/* Tab Webhook & Bridge hanya tampil untuk admin / staff */}
          {['admin', 'staff'].includes((userRole || '').toLowerCase()) && (
            <button
              onClick={() => setActiveTab('config')}
              className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 border-b-2 ${
                activeTab === 'config'
                  ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 border-emerald-600'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 border-transparent'
              }`}
            >
              <Settings size={15} />
              <span>Webhook &amp; Bridge PHP</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 border-b-2 ${
              activeTab === 'logs'
                ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 border-emerald-600'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 border-transparent'
            }`}
          >
            <Radio size={15} />
            <span>Riwayat Sinkronisasi</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {successToast && (
            <div className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 text-sm font-bold shadow-xs animate-[fadeIn_0.2s_ease-out]">
              <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: TARIK OTOMATIS DARI QUIZB                                          */}
          {/* ========================================================================= */}
          {activeTab === 'fetch' && (
            <div className="space-y-5">
              {/* Status Bridge Banner */}
              <div
                className={`p-4 rounded-2xl border text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  bridgeConnected
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                    : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      bridgeConnected ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                    }`}
                  >
                    {bridgeConnected ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
                  </div>
                  <div>
                    <p className="font-extrabold text-sm">
                      {bridgeConnected ? 'QuizB Terhubung (Rumahweb)' : 'QuizB Bridge Siap Dihubungkan'}
                    </p>
                    <p className="text-xs opacity-85 mt-0.5">
                      {bridgeMessage || `Target: ${bridgeUrl}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={loadInitialData}
                    disabled={loadingFetch}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-bold text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 flex items-center gap-1.5 shadow-2xs"
                  >
                    <RefreshCw size={12} className={loadingFetch ? 'animate-spin' : ''} />
                    <span>Cek Ulang</span>
                  </button>
                  <a
                    href="https://quizb.my.id/#/quizzes"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs"
                  >
                    <span>Buka QuizB</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {/* Form Pemilihan Kuis */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                      Pilih Ujian CBT Santri / Kuis
                    </label>
                    {selectedMapel && !['semua', 'semua mapel', 'all'].includes(selectedMapel.toLowerCase()) ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                        🎯 Filter: {selectedMapel}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        📋 Semua Mapel
                      </span>
                    )}
                  </div>
                  {quizzes.length > 0 ? (() => {
                    // Filter RBAC: Hanya kuis yang cocok dengan mapel yang diizinkan (role guru: mapel yang diampu, role admin: mapel yang ada di PPMAWAR)
                    const rbacFilteredQuizzes = allowedMapel.length > 0
                      ? quizzes.filter((q) => matchQuizWithMapels(q, allowedMapel))
                      : quizzes;

                    const isSpecific = selectedMapel && !['semua', 'semua mapel', 'all'].includes(selectedMapel.toLowerCase());
                    const searchLower = quizSearchQuery.toLowerCase();

                    // Kuis yang cocok langsung dengan mapel yang sedang aktif dipilih di halaman rapor
                    const mapelFilteredQuizzes = isSpecific
                      ? rbacFilteredQuizzes.filter((q) => matchQuizWithMapels(q, [selectedMapel]))
                      : rbacFilteredQuizzes;

                    const relatedQuizzes = (isSpecific ? mapelFilteredQuizzes : rbacFilteredQuizzes).filter((q) =>
                      !searchLower ||
                      (q.title || '').toLowerCase().includes(searchLower) ||
                      (q.category || '').toLowerCase().includes(searchLower)
                    );

                    // Kuis mapel lain HANYA dari kuis yang diizinkan oleh RBAC (bukan kuis asing dari luar mapel pesantren)
                    const otherQuizzes = isSpecific
                      ? rbacFilteredQuizzes
                          .filter((q) => !mapelFilteredQuizzes.includes(q))
                          .filter((q) =>
                            !searchLower ||
                            (q.title || '').toLowerCase().includes(searchLower) ||
                            (q.category || '').toLowerCase().includes(searchLower)
                          )
                      : [];

                    // Kelompokkan Ujian CBT PPMAWAR di atas dan Kuis QuizB eksternal di bawah
                    const allFiltered = [...relatedQuizzes, ...otherQuizzes];
                    const cbtQuizzes = allFiltered.filter((q) => String(q.id).startsWith('cbt_'));
                    const externalQuizzes = allFiltered.filter((q) => !String(q.id).startsWith('cbt_'));

                    return (
                      <div className="space-y-1.5">
                        {/* Search bar untuk filter tambahan */}
                        <input
                          type="text"
                          placeholder={isSpecific ? `Cari kuis ${selectedMapel}...` : 'Cari judul kuis di QuizB...'}
                          value={quizSearchQuery}
                          onChange={(e) => setQuizSearchQuery(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs placeholder-gray-400"
                        />
                        <select
                          value={selectedQuizId}
                          onChange={(e) => setSelectedQuizId(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                        >
                          {cbtQuizzes.length > 0 && (
                            <optgroup label="🏆 HASIL UJIAN CBT SANTRI PPMAWAR (Disarankan)">
                              {cbtQuizzes.map((q) => (
                                <option key={q.id} value={q.id}>
                                  {q.title} {q.category ? `(${q.category})` : ''} &bull; Nilai CBT Tersedia
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {externalQuizzes.length > 0 && (
                            <optgroup label="🌐 KUIS ONLINE QUIZB">
                              {externalQuizzes.map((q) => (
                                <option key={q.id} value={q.id}>
                                  {q.title} {q.category ? `(${q.category})` : ''} — ID #{q.id}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {allFiltered.length === 0 && (
                            <option disabled value="">
                              {isSpecific
                                ? `Tidak ada kuis CBT/QuizB untuk mapel ${selectedMapel}`
                                : 'Tidak ada kuis CBT/QuizB yang terkait'}
                            </option>
                          )}
                        </select>
                        {isSpecific && mapelFilteredQuizzes.length === 0 && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                            {otherQuizzes.length > 0
                              ? `⚠️ Belum ada kuis QuizB yang cocok untuk mapel ${selectedMapel}. Pilih dari daftar kuis mapel Anda di atas.`
                              : `⚠️ Belum ada kuis QuizB yang sesuai dengan mata pelajaran ${selectedMapel}.`}
                          </p>
                        )}
                      </div>
                    );
                  })() : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Ketik ID Kuis atau Judul Kuis di QuizB..."
                        value={selectedQuizId}
                        onChange={(e) => setSelectedQuizId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                      />
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1">
                    Kuis di QuizB berisi soal latihan, tugas pertemuan, UTS, atau UAS yang telah dikerjakan santri.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Terapkan Sebagai Nilai
                  </label>
                  <select
                    value={targetField}
                    onChange={(e) => setTargetField(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  >
                    <option value="harian">Nilai Harian (Bobot 30%)</option>
                    <option value="uts">Nilai UTS (Bobot 30%)</option>
                    <option value="uas">Nilai UAS (Bobot 40%)</option>
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Kolom target di rapor santri
                  </p>
                </div>
              </div>

              {/* Tombol Aksi Preview */}
              <div className="flex justify-end">
                <button
                  onClick={handlePreviewFromQuizB}
                  disabled={previewing || !selectedQuizId}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2"
                >
                  {previewing ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  <span>{previewing ? 'Mencocokkan Santri...' : 'Tarik Hasil & Cocokkan Santri'}</span>
                </button>
              </div>

              {/* Hasil Preview */}
              {renderPreviewTable(targetField, quizzes.find(q => String(q.id) === String(selectedQuizId))?.title || `Quiz #${selectedQuizId}`)}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: INPUT / TEMPEL MANUAL HASIL QUIZB                                  */}
          {/* ========================================================================= */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800/60 text-xs text-blue-900 dark:text-blue-200">
                <p className="font-bold mb-1 flex items-center gap-1.5 text-sm">
                  <HelpCircle size={15} /> Mode Tempel Cepat (Offline/Manual)
                </p>
                Gunakan mode ini jika Anda menyalin hasil kuis dari QuizB secara langsung atau mengunduh excel/csv dari QuizB. Sistem akan mencocokkan nama santri atau NIS secara otomatis ke database PPMAWAR.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Nama Kuis / Keterangan
                  </label>
                  <input
                    type="text"
                    value={manualQuizTitle}
                    onChange={(e) => setManualQuizTitle(e.target.value)}
                    placeholder="Contoh: Kuis Fiqih Bab Wudhu"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Terapkan Sebagai Nilai
                  </label>
                  <select
                    value={manualTargetField}
                    onChange={(e) => setManualTargetField(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  >
                    <option value="harian">Nilai Harian (Bobot 30%)</option>
                    <option value="uts">Nilai UTS (Bobot 30%)</option>
                    <option value="uas">Nilai UAS (Bobot 40%)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Tempelkan (Paste) Teks Hasil Kuis
                </label>
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Contoh format yang didukung:\n\nAhmad Fadhil, 85\nBudi Santoso, 92\n2026001234, 88\n\nAtau tempelkan JSON hasil export dari QuizB`}
                  className="w-full p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleParseManual}
                  disabled={previewing || !rawText.trim()}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2"
                >
                  {previewing ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  <span>{previewing ? 'Memproses...' : 'Cocokkan Santri'}</span>
                </button>
              </div>

              {renderPreviewTable(manualTargetField, manualQuizTitle)}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: KONFIGURASI WEBHOOK & BRIDGE SCRIPT                                */}
          {/* ========================================================================= */}
          {activeTab === 'config' && (
            <div className="space-y-5">
              <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 text-xs sm:text-sm text-emerald-950 dark:text-emerald-200 space-y-2">
                <p className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-600" />
                  Jembatan Dua Server: VPS Sumopod &times; Rumahweb cPanel
                </p>
                <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed">
                  Karena <strong>https://quizb.my.id</strong> berada di hosting cPanel Rumahweb dan aplikasi kita di <strong>VPS Sumopod</strong>, kita menggunakan file jembatan ringan <code>quizb_bridge.php</code> yang membaca database QuizB lokal di Rumahweb dan mengirimkannya ke API PPMAWAR secara instan.
                </p>
              </div>

              {/* Langkah 1: Download file Bridge */}
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-xs sm:text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black inline-flex items-center justify-center">1</span>
                      <span>Unduh File Jembatan (Bridge PHP)</span>
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Letakkan file ini di folder <code>public_html</code> domain <code>quizb.my.id</code> melalui File Manager cPanel Rumahweb.
                    </p>
                  </div>
                  <a
                    href="/quizb_bridge.php"
                    download="quizb_bridge.php"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <Download size={14} />
                    <span>Unduh quizb_bridge.php</span>
                  </a>
                </div>
              </div>

              {/* Langkah 2: Webhook Endpoint untuk Rekan Senior */}
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 space-y-3">
                <h4 className="font-extrabold text-xs sm:text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black inline-flex items-center justify-center">2</span>
                  <span>Endpoint Webhook PPMAWAR (Otomatis Masuk Real-Time)</span>
                </h4>
                <p className="text-xs text-gray-400">
                  Rekan senior pengembang QuizB dapat langsung menembakkan POST request ke URL ini ketika santri menyelesaikan kuis:
                </p>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 font-mono text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">POST</span>
                    <span className="truncate flex-1 text-gray-700 dark:text-gray-200">{webhookUrl || 'https://app.ppmawar.or.id/api/quizb/webhook'}</span>
                    <button
                      onClick={() => copyToClipboard(webhookUrl || 'https://app.ppmawar.or.id/api/quizb/webhook', 'webhook')}
                      className="px-2.5 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-emerald-600 hover:text-white transition-colors flex items-center gap-1 font-sans text-xs font-bold"
                    >
                      {copiedWebhook ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedWebhook ? 'Tersalin' : 'Salin URL'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 font-mono text-xs">
                    <span className="text-gray-500 font-bold">Secret Key:</span>
                    <span className="truncate flex-1 text-gray-700 dark:text-gray-200">{secretKey || 'ppmawar-quizb-2026-secret'}</span>
                    <button
                      onClick={() => copyToClipboard(secretKey || 'ppmawar-quizb-2026-secret', 'key')}
                      className="px-2.5 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-emerald-600 hover:text-white transition-colors flex items-center gap-1 font-sans text-xs font-bold"
                    >
                      {copiedKey ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedKey ? 'Tersalin' : 'Salin Key'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: RIWAYAT SINKRONISASI                                               */}
          {/* ========================================================================= */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <h4 className="font-extrabold text-xs sm:text-sm text-gray-800 dark:text-gray-100">
                10 Riwayat Terakhir Sinkronisasi Nilai QuizB
              </h4>
              {recentLogs.length === 0 ? (
                <div className="p-8 text-center text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-2xl">
                  Belum ada catatan riwayat sinkronisasi nilai QuizB.
                </div>
              ) : (
                <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-900/80 text-gray-500 uppercase font-bold border-b border-gray-100 dark:border-gray-700">
                      <tr>
                        <th className="p-3">Waktu</th>
                        <th className="p-3">Judul Kuis</th>
                        <th className="p-3">Target Nilai</th>
                        <th className="p-3 text-center">Tersinkron</th>
                        <th className="p-3 text-center">Metode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {recentLogs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                          <td className="p-3 text-gray-500 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 font-bold text-gray-800 dark:text-gray-200">
                            {log.quiz_title}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-bold uppercase text-[10px]">
                              {log.target_field}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                              {log.total_matched}
                            </span>
                            <span className="text-gray-400"> / {log.total_received}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                              {log.source}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Nilai yang diterapkan akan masuk ke tabel dan dapat Anda review sebelum disimpan permanen.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );

  // Helper Render Tabel Preview Pencocokan Santri
  function renderPreviewTable(targetCol: 'harian' | 'uts' | 'uas', qTitle: string) {
    if (!previewResult) return null;

    return (
      <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700 animate-[fadeIn_0.2s_ease-out]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-extrabold text-xs sm:text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-600" />
              <span>Hasil Pencocokan: {previewResult.matched_count} dari {previewResult.total_items} Santri Cocok</span>
            </h4>
            <p className="text-xs text-gray-400">
              Target kolom: <strong className="text-emerald-600 uppercase">Nilai {targetCol}</strong>
            </p>
          </div>

          <button
            onClick={() => handleApplyToTable(targetCol, qTitle)}
            disabled={previewResult.matched_count === 0}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Check size={16} />
            <span>Terapkan ke Tabel Penilaian ({previewResult.matched_count} Santri)</span>
          </button>
        </div>

        {/* Tabel Preview */}
        <div className="max-h-60 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100/80 dark:bg-gray-800 text-gray-500 uppercase font-bold sticky top-0">
              <tr>
                <th className="p-2.5 pl-3">Nama di QuizB</th>
                <th className="p-2.5">Cocok Santri PPMAWAR</th>
                <th className="p-2.5 text-center">NIS</th>
                <th className="p-2.5 text-center">Skor QuizB</th>
                <th className="p-2.5 text-center">Metode Cocok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {previewResult.matched.map((m: any, idx: number) => (
                <tr key={idx} className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20">
                  <td className="p-2.5 pl-3 font-semibold text-gray-600 dark:text-gray-300">
                    {m.quizb_nama || m.nama}
                  </td>
                  <td className="p-2.5 font-bold text-emerald-700 dark:text-emerald-400">
                    {m.nama}
                  </td>
                  <td className="p-2.5 text-center font-mono text-gray-500">
                    {m.nis || '-'}
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black">
                      {m.skor}
                    </span>
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold">
                      {m.match_method}
                    </span>
                  </td>
                </tr>
              ))}

              {previewResult.unmatched && previewResult.unmatched.map((u: any, idx: number) => (
                <tr key={'un_' + idx} className="bg-rose-50/40 dark:bg-rose-950/20">
                  <td className="p-2.5 pl-3 font-semibold text-rose-800 dark:text-rose-300">
                    {u.quizb_nama || '-'}
                  </td>
                  <td className="p-2.5 text-rose-600 dark:text-rose-400 italic font-semibold">
                    (Tidak ditemukan di data santri)
                  </td>
                  <td className="p-2.5 text-center font-mono text-gray-400">
                    {u.quizb_nis || '-'}
                  </td>
                  <td className="p-2.5 text-center text-gray-500 font-bold">
                    {u.skor}
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 text-[10px] font-bold">
                      Belum Cocok
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}
