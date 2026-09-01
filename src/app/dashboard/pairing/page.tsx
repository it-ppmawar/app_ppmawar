'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Camera, Save, XCircle, Search, CheckCircle, Upload, FileImage,
  Loader2, Brain, ScanFace, Users, CheckCircle2, AlertCircle,
  RefreshCw, Play, Pause, ChevronRight, Sparkles, ImageOff,
  QrCode, Trash2, Check, ArrowRight, ShieldAlert, Sparkle, Link2, HelpCircle
} from 'lucide-react';
import Script from 'next/script';
import { Html5Qrcode } from 'html5-qrcode';
import { SantriPutraIcon, SantriPutriIcon, GenderBadge } from '@/components/SantriIcons';

// =====================================================
// TYPES
// =====================================================
interface MuridPairingStatus {
  murid_id: number;
  nama: string;
  nis: string;
  jenis_kelamin: string;
  foto: string | null;
  barcode_id: string | null;
  kelas_madin: string | null;
  paired: boolean;
}

interface PairingStats {
  total: number;
  paired: number;
  unpaired: number;
  percent: number;
  putra: { total: number; paired: number; unpaired: number; percent: number };
  putri: { total: number; paired: number; unpaired: number; percent: number };
}

interface MuridEnrollStatus {
  murid_id: number;
  nama: string;
  nis: string;
  jenis_kelamin: string;
  foto: string | null;
  kelas_madin: string | null;
  enrolled: boolean;
  descriptor_updated_at: string | null;
}

interface EnrollStats {
  total: number;
  enrolled: number;
  unenrolled: number;
  percent: number;
}

// =====================================================
// FACE-API LOADER & UTILS FOR TAB 2
// =====================================================
let faceApiCache: any = null;
let modelsLoadedCache = false;

async function loadFaceApi() {
  if (faceApiCache && modelsLoadedCache) return faceApiCache;
  const faceapi = await import('@vladmandic/face-api');
  faceApiCache = faceapi;
  const MODEL_URL = '/models';
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoadedCache = true;
  return faceapi;
}

function getFotoUrl(fotoName: string | null, nis?: string | null): string {
  if (!fotoName || fotoName === '-' || fotoName.trim() === '') {
    if (nis) return `/api/kartu-image/${nis}`;
    return '';
  }
  if (fotoName.startsWith('/api/')) {
    return fotoName;
  }
  if (fotoName.startsWith('foto_') || fotoName.startsWith('upload_') || fotoName.startsWith('profil_')) {
    return `/uploads/${fotoName}`;
  }

  let fullUrl = fotoName;
  if (!fotoName.startsWith('http://') && !fotoName.startsWith('https://')) {
    const cleanFotoName = fotoName.startsWith('/') ? fotoName.substring(1) : fotoName;
    if (cleanFotoName.includes('sekretariat/berkas')) {
      fullUrl = `https://mawar.smartpesantren.id/${cleanFotoName}`;
    } else {
      fullUrl = `https://mawar.smartpesantren.id/sekretariat/berkas/${cleanFotoName}`;
    }
  }

  return `/api/proxy-image?url=${encodeURIComponent(fullUrl)}`;
}

async function computeDescriptorFromUrl(faceapi: any, imageUrl: string): Promise<number[] | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const detection = await faceapi
          .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          resolve(Array.from(detection.descriptor) as number[]);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}

// =====================================================
// MAIN COMPONENT
// =====================================================
function PairingAndFacePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Tab utama: 'pairing' (Kartu QR) atau 'face' (Face AI)
  const initialTab = searchParams.get('tab') === 'face' ? 'face' : 'pairing';
  const [mainTab, setMainTab] = useState<'pairing' | 'face'>(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'face') setMainTab('face');
    else if (tabParam === 'pairing') setMainTab('pairing');
  }, [searchParams]);

  const handleSwitchTab = (tab: 'pairing' | 'face') => {
    setMainTab(tab);
    router.replace(`/dashboard/pairing?tab=${tab}`, { scroll: false });
  };

  // ===================================================
  // TAB 1: PAIRING KARTU STATES & HANDLERS
  // ===================================================
  const [pairingList, setPairingList] = useState<MuridPairingStatus[]>([]);
  const [pairingStats, setPairingStats] = useState<PairingStats>({
    total: 0,
    paired: 0,
    unpaired: 0,
    percent: 0,
    putra: { total: 0, paired: 0, unpaired: 0, percent: 0 },
    putri: { total: 0, paired: 0, unpaired: 0, percent: 0 },
  });
  const [loadingPairing, setLoadingPairing] = useState(true);
  const [pairingSearch, setPairingSearch] = useState('');
  const [pairingStatusFilter, setPairingStatusFilter] = useState<'all' | 'paired' | 'unpaired'>('all');
  const [pairingGenderFilter, setPairingGenderFilter] = useState<'' | 'Laki-laki' | 'Perempuan'>('');

  const [nis, setNis] = useState('');
  const [scanResult, setScanResult] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [popup, setPopup] = useState<{ type: 'success' | 'error' | 'warning'; title: string; text: string } | null>(null);
  const [pairingToolTab, setPairingToolTab] = useState<'scan' | 'upload'>('scan');

  // Fitur upload kartu
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const nisInputRef = useRef<HTMLInputElement>(null);

  // Fetch data status pairing kartu
  const fetchPairingStatus = useCallback(async () => {
    setLoadingPairing(true);
    try {
      const res = await fetch('/api/pairing/status');
      const data = await res.json();
      if (data.success) {
        setPairingList(data.data);
        if (data.stats) {
          setPairingStats(data.stats);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPairing(false);
    }
  }, []);

  useEffect(() => {
    fetchPairingStatus();
  }, [fetchPairingStatus]);

  // Upload handler
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    setUploadFiles(prev => [...prev, ...dropped]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleUploadPairing = async () => {
    if (uploadFiles.length === 0) return;
    setIsUploading(true);
    setUploadResults([]);
    try {
      const formData = new FormData();
      uploadFiles.forEach(f => formData.append('files', f));
      const res = await fetch('/api/pairing/upload-kartu', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.results) {
        setUploadResults(data.results);
      }
      setPopup({
        type: data.berhasil > 0 ? 'success' : 'error',
        title: data.berhasil > 0 ? 'Selesai!' : 'Semua Gagal',
        text: data.message
      });
      fetchPairingStatus();
    } catch {
      setPopup({ type: 'error', title: 'Koneksi Gagal', text: 'Koneksi ke server terputus.' });
    } finally {
      setIsUploading(false);
    }
  };

  // QR Scanner logic
  useEffect(() => {
    if (isScanning) {
      const initScanner = async () => {
        try {
          if (!html5QrCodeRef.current) {
            html5QrCodeRef.current = new Html5Qrcode('pairing-reader');
          }
          await html5QrCodeRef.current.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
            async (decodedText) => {
              stopScanner();
              setScanResult(decodedText);
              await handleSavePairing(nis, decodedText);
            },
            () => {}
          );
        } catch (err) {
          console.error(err);
          setIsScanning(false);
          setPopup({ type: 'error', title: 'Akses Kamera Gagal', text: 'Kamera tidak ditemukan atau izin belum diberikan.' });
        }
      };
      initScanner();
    }
  }, [isScanning, nis]);

  const startScanner = async () => {
    if (!nis) {
      setPopup({ type: 'warning', title: 'Peringatan', text: 'Harap masukkan NIS Santri terlebih dahulu!' });
      return;
    }
    setIsScanning(true);
    setPopup(null);
    setScanResult('');
  };

  const stopScanner = () => {
    setIsScanning(false);
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().then(() => {
        html5QrCodeRef.current?.clear();
      }).catch(err => console.error(err));
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleSavePairing = async (santriNis: string, barcodeKode: string) => {
    setPairingLoading(true);
    try {
      const res = await fetch('/api/pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nis: santriNis, barcode_id: barcodeKode })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        try {
          const audio = new Audio('/success-beep.mp3');
          audio.play().catch(() => {});
        } catch {}

        setPopup({ type: 'success', title: 'Berhasil!', text: `Kartu berhasil dipasangkan untuk santri: ${data.murid?.nama || santriNis}` });
        setNis('');
        fetchPairingStatus();
      } else {
        if (data.error && data.error.includes('sudah terdaftar')) {
          setPopup({ type: 'warning', title: 'Kartu Sudah Terdaftar', text: data.error });
        } else {
          setPopup({ type: 'error', title: 'Gagal Menyimpan', text: data.error || 'Terjadi kesalahan saat memproses data.' });
        }
      }
    } catch {
      setPopup({ type: 'error', title: 'Koneksi Gagal', text: 'Koneksi ke server terputus. Periksa jaringan Anda.' });
    } finally {
      setPairingLoading(false);
    }
  };

  // Reset / Hapus pairing kartu
  const handleResetPairing = async (muridId: number, namaMurid: string) => {
    if (!confirm(`Yakin ingin melepas/mereset kartu santri "${namaMurid}"?`)) return;
    try {
      const res = await fetch('/api/pairing', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ murid_id: muridId })
      });
      const data = await res.json();
      if (data.success) {
        setPopup({ type: 'success', title: 'Reset Berhasil', text: `Kartu ${namaMurid} telah dilepas.` });
        fetchPairingStatus();
      } else {
        setPopup({ type: 'error', title: 'Gagal Reset', text: data.error || 'Gagal mereset kartu.' });
      }
    } catch {
      setPopup({ type: 'error', title: 'Koneksi Gagal', text: 'Koneksi ke server terputus.' });
    }
  };

  // Quick action pasang kartu dari tabel
  const handleQuickPairFromList = (targetNis: string) => {
    setNis(targetNis);
    setPairingToolTab('scan');
    window.scrollTo({ top: 300, behavior: 'smooth' });
    setTimeout(() => {
      nisInputRef.current?.focus();
    }, 400);
  };

  // Filter list pairing
  const filteredPairingList = pairingList.filter(m => {
    const matchQ = !pairingSearch || m.nama.toLowerCase().includes(pairingSearch.toLowerCase()) || m.nis.includes(pairingSearch) || (m.barcode_id && m.barcode_id.toLowerCase().includes(pairingSearch.toLowerCase()));
    const matchStatus = pairingStatusFilter === 'all' || (pairingStatusFilter === 'paired' ? m.paired : !m.paired);
    const matchGender = !pairingGenderFilter || m.jenis_kelamin === pairingGenderFilter;
    return matchQ && matchStatus && matchGender;
  });

  // ===================================================
  // TAB 2: FACE AI ENROLLMENT STATES & HANDLERS
  // ===================================================
  const [faceList, setFaceList] = useState<MuridEnrollStatus[]>([]);
  const [faceStats, setFaceStats] = useState<EnrollStats>({ total: 0, enrolled: 0, unenrolled: 0, percent: 0 });
  const [loadingFace, setLoadingFace] = useState(true);
  const [faceSearch, setFaceSearch] = useState('');
  const [faceFilterMode, setFaceFilterMode] = useState<'all' | 'enrolled' | 'unenrolled'>('all');
  const [faceGenderFilter, setFaceGenderFilter] = useState<'' | 'Laki-laki' | 'Perempuan'>('');

  const [batchRunning, setBatchRunning] = useState(false);
  const [batchPaused, setBatchPaused] = useState(false);
  const [batchIdx, setBatchIdx] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchResults, setBatchResults] = useState({ success: 0, failed: 0, noFace: 0 });
  const [batchLog, setBatchLog] = useState<string[]>([]);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  const pausedRef = useRef(false);
  const stopRef = useRef(false);
  const faceApiRef = useRef<any>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchFaceStatus = useCallback(async () => {
    setLoadingFace(true);
    try {
      const res = await fetch('/api/murid/face-enrollment-status');
      const data = await res.json();
      if (data.success) {
        setFaceList(data.data);
        const enrolled = data.data.filter((d: MuridEnrollStatus) => d.enrolled).length;
        const total = data.data.length;
        setFaceStats({
          total,
          enrolled,
          unenrolled: total - enrolled,
          percent: total > 0 ? Math.round((enrolled / total) * 100) : 0
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFace(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === 'face') {
      fetchFaceStatus();
    }
  }, [mainTab, fetchFaceStatus]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [batchLog]);

  const handleLoadModels = async () => {
    setModelsLoading(true);
    try {
      const faceapi = await loadFaceApi();
      faceApiRef.current = faceapi;
      setModelsReady(true);
      setBatchLog(prev => [...prev, '✅ Model AI berhasil dimuat (SSD MobileNet + Face Recognition)']);
    } catch (e: any) {
      setBatchLog(prev => [...prev, '❌ Gagal memuat model: ' + e.message]);
    } finally {
      setModelsLoading(false);
    }
  };

  const startBatch = async () => {
    if (!faceApiRef.current) {
      setModelsLoading(true);
      setBatchLog(prev => [...prev, '⌛ Memuat model AI Face Recognition...']);
      try {
        const faceapi = await loadFaceApi();
        faceApiRef.current = faceapi;
        setModelsReady(true);
        setBatchLog(prev => [...prev, '✅ Model AI berhasil dimuat (SSD MobileNet + Face Recognition)']);
      } catch (e: any) {
        setBatchLog(prev => [...prev, '❌ Gagal memuat model AI: ' + e.message]);
        setModelsLoading(false);
        return;
      } finally {
        setModelsLoading(false);
      }
    }

    const targets = faceList.filter(m => !m.enrolled && m.foto);
    if (targets.length === 0) {
      setBatchLog(prev => [...prev, '✅ Semua santri yang memiliki foto sudah ter-enroll!']);
      return;
    }

    setBatchRunning(true);
    setBatchPaused(false);
    setBatchIdx(0);
    setBatchTotal(targets.length);
    setBatchResults({ success: 0, failed: 0, noFace: 0 });
    stopRef.current = false;
    pausedRef.current = false;

    setBatchLog(prev => [...prev, `🚀 Mulai batch enrollment: ${targets.length} santri belum ter-enroll`]);

    let successCount = 0;
    let failCount = 0;
    let noFaceCount = 0;

    for (let i = 0; i < targets.length; i++) {
      if (stopRef.current) {
        setBatchLog(prev => [...prev, `⏹ Dihentikan pada index ${i}`]);
        break;
      }

      while (pausedRef.current) {
        await new Promise(r => setTimeout(r, 500));
      }

      const murid = targets[i];
      setBatchIdx(i + 1);

      const photoUrl = getFotoUrl(murid.foto, murid.nis);
      if (!photoUrl) {
        noFaceCount++;
        setBatchResults(prev => ({ ...prev, noFace: prev.noFace + 1 }));
        setBatchLog(prev => [...prev, `⚠️ [${i + 1}/${targets.length}] ${murid.nama} — Tanpa foto`]);
        continue;
      }

      try {
        const descriptor = await computeDescriptorFromUrl(faceApiRef.current, photoUrl);

        if (!descriptor) {
          noFaceCount++;
          setBatchResults(prev => ({ ...prev, noFace: prev.noFace + 1 }));
          setBatchLog(prev => [...prev, `⚠️ [${i + 1}/${targets.length}] ${murid.nama} — Wajah tidak terdeteksi`]);
          continue;
        }

        const saveRes = await fetch('/api/murid/face-descriptor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ murid_id: murid.murid_id, descriptor, foto_source: murid.foto })
        });
        const saveData = await saveRes.json();

        if (saveData.success) {
          successCount++;
          setBatchResults(prev => ({ ...prev, success: prev.success + 1 }));
          setBatchLog(prev => [...prev, `✅ [${i + 1}/${targets.length}] ${murid.nama} — Descriptor tersimpan`]);
          setFaceList(prev => prev.map(m => m.murid_id === murid.murid_id ? { ...m, enrolled: true } : m));
        } else {
          failCount++;
          setBatchResults(prev => ({ ...prev, failed: prev.failed + 1 }));
          setBatchLog(prev => [...prev, `❌ [${i + 1}/${targets.length}] ${murid.nama} — Gagal simpan: ${saveData.error || '?'}`]);
        }
      } catch (err: any) {
        failCount++;
        setBatchResults(prev => ({ ...prev, failed: prev.failed + 1 }));
        setBatchLog(prev => [...prev, `❌ [${i + 1}/${targets.length}] ${murid.nama} — Error: ${err.message}`]);
      }

      await new Promise(r => setTimeout(r, 200));
    }

    setBatchRunning(false);
    setBatchLog(prev => [
      ...prev,
      '',
      `📊 SELESAI: ✅ ${successCount} berhasil | ⚠️ ${noFaceCount} wajah tidak terdeteksi | ❌ ${failCount} gagal`
    ]);
    fetchFaceStatus();
  };

  const pauseBatch = () => {
    pausedRef.current = !pausedRef.current;
    setBatchPaused(pausedRef.current);
    setBatchLog(prev => [...prev, pausedRef.current ? '⏸ Dijeda...' : '▶ Dilanjutkan...']);
  };

  const stopBatch = () => {
    stopRef.current = true;
    pausedRef.current = false;
    setBatchPaused(false);
  };

  const filteredFaceList = faceList.filter(m => {
    const matchQ = !faceSearch || m.nama.toLowerCase().includes(faceSearch.toLowerCase()) || m.nis.includes(faceSearch);
    const matchFilter = faceFilterMode === 'all' || (faceFilterMode === 'enrolled' ? m.enrolled : !m.enrolled);
    const matchGender = !faceGenderFilter || m.jenis_kelamin === faceGenderFilter;
    return matchQ && matchFilter && matchGender;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-[fadeIn_0.5s_ease-out]">
      <Script src="https://unpkg.com/html5-qrcode" strategy="lazyOnload" />

      {/* Popup Notification Modal */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center transform animate-[zoomIn_0.3s_ease-out]">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${popup.type === 'success' ? 'bg-green-100 text-green-600' : popup.type === 'warning' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
              {popup.type === 'success' ? <CheckCircle size={32} /> : popup.type === 'warning' ? <XCircle size={32} className="text-yellow-600" /> : <XCircle size={32} />}
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{popup.title}</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 leading-relaxed">{popup.text}</p>

            {/* Panduan Izin Kamera — hanya muncul saat error kamera */}
            {popup.type === 'error' && popup.title === 'Akses Kamera Gagal' && (
              <div className="mb-4 text-left space-y-3">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-2xl">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                    <HelpCircle size={14} /> Cara Mengizinkan Kamera:
                  </p>
                  <ol className="text-xs text-amber-700 dark:text-amber-300 space-y-1 pl-1 list-decimal list-inside leading-relaxed">
                    <li>Ketuk ikon <strong>🔒 kunci / info</strong> di bilah alamat browser</li>
                    <li>Pilih <strong>Izin situs</strong> atau <strong>Pengaturan</strong></li>
                    <li>Ubah <strong>Kamera</strong> dari &ldquo;Blokir&rdquo; menjadi <strong>Izinkan</strong></li>
                    <li>Muat ulang halaman ini</li>
                  </ol>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-2.5 rounded-2xl font-bold text-white bg-amber-500 hover:bg-amber-600 transition active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                  <RefreshCw size={16} /> Muat Ulang Halaman
                </button>
              </div>
            )}

            <button onClick={() => setPopup(null)} className={`w-full py-3 rounded-xl font-bold text-white transition-transform active:scale-95 ${popup.type === 'success' ? 'bg-green-600 hover:bg-green-700' : popup.type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-red-600 hover:bg-red-700'}`}>
              Oke, Mengerti
            </button>
          </div>
        </div>
      )}

      {/* ── TOP LEVEL SEGMENTED TAB SELECTOR (2 TAB TERPADU) ── */}
      <div className="bg-white dark:bg-gray-800 p-2 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleSwitchTab('pairing')}
            className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl font-extrabold text-sm sm:text-base transition-all duration-300 ${
              mainTab === 'pairing'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 scale-[1.01]'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/60 font-semibold'
            }`}
          >
            <QrCode size={20} className={mainTab === 'pairing' ? 'text-white' : 'text-indigo-500'} />
            <span>Pairing Kartu Santri</span>
          </button>

          <button
            onClick={() => handleSwitchTab('face')}
            className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl font-extrabold text-sm sm:text-base transition-all duration-300 ${
              mainTab === 'face'
                ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-500/20 scale-[1.01]'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/60 font-semibold'
            }`}
          >
            <Brain size={20} className={mainTab === 'face' ? 'text-white' : 'text-violet-500'} />
            <span>Face AI Enrollment</span>
          </button>
        </div>
      </div>

      {/* =================================================================================== */}
      {/* ── TAB 1: PAIRING KARTU SANTRI ── */}
      {/* =================================================================================== */}
      {mainTab === 'pairing' && (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
          {/* Header & Progress Card */}
          <div className="bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-6 -mr-6 opacity-15 pointer-events-none">
              <Camera size={170} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-sm">
                  <QrCode size={24} />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2">
                    Pairing Kartu Santri
                  </h1>
                  <p className="text-indigo-100 text-xs sm:text-sm font-medium">
                    Daftarkan kartu QR/Barcode santri ke sistem absensi
                  </p>
                </div>
              </div>

              {/* Progress Bar Monitoring Status Pairing */}
              <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold">
                    {pairingStats.paired} / {pairingStats.total} santri terpasang kartu
                  </span>
                  <span className="text-indigo-200 text-sm font-extrabold">
                    {pairingStats.percent}%
                  </span>
                </div>

                <div className="h-3.5 bg-white/20 rounded-full overflow-hidden p-0.5 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 rounded-full transition-all duration-700 shadow-sm"
                    style={{ width: `${pairingStats.percent}%` }}
                  />
                </div>

                {/* Pill Stats Detail dengan Ikon Santri Islami (2 Baris Rapi) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 flex flex-col justify-center font-bold">
                    <span className="flex items-center gap-1 text-emerald-200 text-[11px]">
                      <Check size={13} /> Terpasang
                    </span>
                    <span className="text-white text-sm font-extrabold mt-0.5">{pairingStats.paired}</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 flex flex-col justify-center font-bold">
                    <span className="flex items-center gap-1 text-amber-200 text-[11px]">
                      <AlertCircle size={13} /> Belum
                    </span>
                    <span className="text-white text-sm font-extrabold mt-0.5">{pairingStats.unpaired}</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 flex flex-col justify-center font-bold">
                    <span className="flex items-center gap-1 text-cyan-200 text-[11px]">
                      <SantriPutraIcon size={13} /> Putra
                    </span>
                    <span className="text-white text-xs font-extrabold mt-0.5">
                      {pairingStats.putra.paired}/{pairingStats.putra.total} <span className="text-cyan-200 text-[10px]">({pairingStats.putra.percent}%)</span>
                    </span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 flex flex-col justify-center font-bold">
                    <span className="flex items-center gap-1 text-pink-200 text-[11px]">
                      <SantriPutriIcon size={13} /> Putri
                    </span>
                    <span className="text-white text-xs font-extrabold mt-0.5">
                      {pairingStats.putri.paired}/{pairingStats.putri.total} <span className="text-pink-200 text-[10px]">({pairingStats.putri.percent}%)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Alat Pairing: Scan Kamera / Upload Gambar */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            <div className="space-y-3">
              <h2 className="font-extrabold text-base text-gray-800 dark:text-white flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-600" />
                Alat Pairing Kartu
              </h2>
              {/* Sub-tab Selector - 1 Baris Penuh Tersendiri */}
              <div className="grid grid-cols-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-2xl gap-1">
                <button
                  onClick={() => setPairingToolTab('scan')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-xs transition ${
                    pairingToolTab === 'scan'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600'
                  }`}
                >
                  <Camera size={15} /> Scan Kamera
                </button>
                <button
                  onClick={() => setPairingToolTab('upload')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-xs transition ${
                    pairingToolTab === 'upload'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600'
                  }`}
                >
                  <Upload size={15} /> Upload Gambar
                </button>
              </div>
            </div>

            {/* Sub-tab 1: Scan Kamera */}
            {pairingToolTab === 'scan' && (
              <div className="space-y-4">
                <div className={`transition-opacity duration-300 ${isScanning ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                  <label className="block text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    1. Masukkan Nomor Induk Santri (NIS)
                  </label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      ref={nisInputRef}
                      type="text"
                      placeholder="Contoh: 20210112"
                      value={nis}
                      onChange={(e) => setNis(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') startScanner(); }}
                      className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl text-base font-bold focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white transition-all shadow-inner"
                    />
                  </div>
                </div>

                {!isScanning ? (
                  <button
                    onClick={startScanner}
                    disabled={!nis || pairingLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold text-base py-3.5 rounded-2xl shadow-lg shadow-indigo-600/20 transition-transform active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Camera size={20} /> {pairingLoading ? 'Memproses...' : 'Mulai Scan Kartu QR'}
                  </button>
                ) : (
                  <div className="space-y-3 animate-[zoomIn_0.3s_ease-out]">
                    <div className="flex justify-between items-center bg-gray-900 p-3 rounded-t-2xl text-white">
                      <span className="font-bold flex items-center gap-2 text-xs sm:text-sm">
                        <Camera size={16} className="animate-pulse text-red-500" />
                        Arahkan Kamera ke Kartu QR Santri (NIS: {nis})
                      </span>
                      <button onClick={stopScanner} className="bg-red-500 hover:bg-red-600 p-1.5 rounded-lg transition-colors">
                        <XCircle size={16} />
                      </button>
                    </div>

                    <div className="rounded-b-2xl overflow-hidden border-2 border-indigo-500 shadow-xl relative bg-black min-h-[260px]">
                      <div id="pairing-reader" className="w-full h-full"></div>
                    </div>
                    <p className="text-center text-xs text-gray-500 italic">
                      Pastikan pencahayaan cukup dan kode QR tidak silau.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: Upload Gambar */}
            {pairingToolTab === 'upload' && (
              <div className="space-y-4">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 scale-[1.01]'
                      : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <FileImage size={36} className="mx-auto mb-2 text-indigo-400" />
                  <p className="font-bold text-gray-700 dark:text-gray-300 text-sm">
                    Drag & Drop atau Klik untuk Upload Foto Kartu
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Format JPG/PNG · Nama file = NIS santri (contoh: 2026050008.jpg)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                {uploadFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{uploadFiles.length} file dipilih:</p>
                      <button
                        onClick={() => { setUploadFiles([]); setUploadResults([]); }}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                      >
                        Hapus Semua
                      </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {uploadFiles.map((f, i) => {
                        const result = uploadResults.find(r => r.filename === f.name);
                        return (
                          <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs ${
                            result?.status === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                            : result ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                            : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}>
                            <span className="flex items-center gap-2 truncate">
                              {result?.status === 'success' ? '✅' : result ? '❌' : '📄'}
                              <span className="truncate font-medium">{f.name}</span>
                            </span>
                            {result && (
                              <span className="text-[10px] ml-2 flex-shrink-0">
                                {result.status === 'success' ? 'Berhasil' : result.status === 'qr_not_found' ? 'QR tidak terbaca' : 'Gagal'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleUploadPairing}
                  disabled={uploadFiles.length === 0 || isUploading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-bold text-sm py-3.5 rounded-2xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <><Loader2 size={18} className="animate-spin" /> Memproses {uploadFiles.length} file...</>
                  ) : (
                    <><Upload size={18} /> Proses & Pairing {uploadFiles.length > 0 ? `(${uploadFiles.length} file)` : ''}</>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* ── DAFTAR SANTRI & MONITORING PAIRING ── */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-indigo-600" />
                <h2 className="font-bold text-gray-800 dark:text-white">Daftar Santri & Status Kartu</h2>
                <span className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {filteredPairingList.length}
                </span>
              </div>
              <button
                onClick={fetchPairingStatus}
                disabled={loadingPairing}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                title="Segarkan Data"
              >
                <RefreshCw size={16} className={`text-gray-500 ${loadingPairing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Filter Controls: Search, Status Dropdown, Gender Dropdown */}
            <div className="space-y-2">
              <div className="relative w-full">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nama / NIS / kode kartu..."
                  value={pairingSearch}
                  onChange={(e) => setPairingSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 w-full">
                <select
                  value={pairingStatusFilter}
                  onChange={(e) => setPairingStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white font-medium"
                >
                  <option value="all">Semua Status Kartu</option>
                  <option value="paired">✅ Terpasang (Paired)</option>
                  <option value="unpaired">⏳ Belum Terpasang</option>
                </select>

                <select
                  value={pairingGenderFilter}
                  onChange={(e) => setPairingGenderFilter(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white font-medium"
                >
                  <option value="">Semua Gender</option>
                  <option value="Laki-laki">👳 Santri Putra</option>
                  <option value="Perempuan">🧕 Santri Putri</option>
                </select>
              </div>
            </div>

            {/* Santri List Content */}
            {loadingPairing ? (
              <div className="flex justify-center py-12">
                <Loader2 size={32} className="text-indigo-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {filteredPairingList.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    Tidak ada santri yang sesuai kriteria pencarian/filter.
                  </div>
                ) : (
                  filteredPairingList.map((m) => (
                    <div
                      key={m.murid_id}
                      className={`p-3 rounded-2xl border transition-all ${
                        m.paired
                          ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50'
                      }`}
                    >
                      {/* Baris 1: Foto + Nama + Action */}
                      <div className="flex items-center gap-3">
                        {/* Avatar / Foto */}
                        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden flex-shrink-0 ring-2 ${m.paired ? 'ring-emerald-400' : 'ring-gray-300 dark:ring-gray-600'}`}>
                          {m.foto ? (
                            <img src={m.foto} alt={m.nama} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                              {m.jenis_kelamin === 'Perempuan' ? (
                                <SantriPutriIcon size={18} className="text-rose-400" />
                              ) : (
                                <SantriPutraIcon size={18} className="text-teal-500" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Nama Santri */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-gray-900 dark:text-white leading-snug">
                            {m.nama}
                          </p>
                        </div>

                        {/* Actions & Status Badge di Kanan Atas */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {m.paired ? (
                            <>
                              <div className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-2 py-0.5 rounded-full">
                                <CheckCircle2 size={12} />
                                <span className="hidden sm:inline">Terpasang</span>
                              </div>
                              <button
                                onClick={() => handleResetPairing(m.murid_id, m.nama)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                title="Lepas / Reset Kartu"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleQuickPairFromList(m.nis)}
                              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl shadow-sm transition active:scale-95"
                            >
                              <Camera size={12} />
                              <span>Pairing</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Baris 2: NIS & Kelas — Merapat ke kiri sejajar dengan awal foto */}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
                        NIS: <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{m.nis}</span>
                        {m.kelas_madin && ` · ${m.kelas_madin}`}
                      </p>

                      {/* Baris 3: Gender Badge & QR — Merapat ke kiri sejajar dengan awal foto */}
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/60 flex-wrap">
                        <GenderBadge gender={m.jenis_kelamin} size="xs" />
                        {m.barcode_id && (
                          <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded font-bold border border-indigo-200/50 dark:border-indigo-800/40 truncate max-w-[160px] sm:max-w-xs inline-block" title={m.barcode_id}>
                            QR: {m.barcode_id.length > 14 ? `${m.barcode_id.slice(0, 14)}...` : m.barcode_id}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================================== */}
      {/* ── TAB 2: FACE AI ENROLLMENT DASHBOARD ── */}
      {/* =================================================================================== */}
      {mainTab === 'face' && (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
          {/* Header Dashboard Face AI */}
          <div className="bg-gradient-to-br from-violet-700 via-indigo-700 to-blue-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute -top-8 -right-8 opacity-10 pointer-events-none">
              <Brain size={160} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
                  <ScanFace size={24} />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold">Face AI Enrollment</h1>
                  <p className="text-violet-200 text-xs sm:text-sm">
                    Proses foto santri → simpan descriptor biometrik wajah ke database
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold">
                    {faceStats.enrolled} / {faceStats.total} santri ter-enroll
                  </span>
                  <span className="text-violet-200 text-sm font-bold">{faceStats.percent}%</span>
                </div>
                <div className="h-3.5 bg-white/20 rounded-full overflow-hidden p-0.5 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-700"
                    style={{ width: `${faceStats.percent}%` }}
                  />
                </div>
                {/* 3 Badges: Maksimal 2 di baris 1, sisanya rata tengah di baris 2 pada HP */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 text-xs text-violet-100 font-bold text-center">
                  <div className="bg-white/10 backdrop-blur-sm px-2.5 py-2 rounded-xl flex items-center justify-center gap-1.5">
                    <span>✅</span> <span>{faceStats.enrolled} Enrolled</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm px-2.5 py-2 rounded-xl flex items-center justify-center gap-1.5">
                    <span>⏳</span> <span>{faceStats.unenrolled} Belum</span>
                  </div>
                  <div className="col-span-2 sm:col-span-1 bg-white/10 backdrop-blur-sm px-2.5 py-2 rounded-xl flex items-center justify-center gap-1.5">
                    <span>📷</span> <span>{faceList.filter(m => !m.foto).length} Tanpa Foto</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Batch Enrollment Control */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-violet-500" />
              <h2 className="font-bold text-gray-800 dark:text-white">Batch Enrollment Otomatis</h2>
            </div>

            {/* Step 1: Load models */}
            <div className={`flex flex-col gap-3 p-4 rounded-2xl border-2 transition-all ${modelsReady ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-gray-800 dark:text-white">
                    {modelsReady ? '✅ Model AI Siap' : '1. Load Model AI'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    SSD MobileNet + Face Landmark + Face Recognition (~12MB, cached)
                  </p>
                </div>
                {modelsReady && <CheckCircle2 size={24} className="text-emerald-500 flex-shrink-0" />}
              </div>
              {!modelsReady && (
                <button
                  onClick={handleLoadModels}
                  disabled={modelsLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold transition disabled:opacity-50 shadow-md shadow-violet-600/20"
                >
                  {modelsLoading ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
                  {modelsLoading ? 'Loading...' : 'Load Model'}
                </button>
              )}
            </div>

            {/* Step 2: Run batch */}
            <div className="flex gap-2">
              <button
                onClick={startBatch}
                disabled={batchRunning || !modelsReady}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold rounded-2xl transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {batchRunning
                  ? <><Loader2 size={18} className="animate-spin" /> Proses berjalan...</>
                  : <><Play size={18} /> Jalankan Batch Enrollment</>
                }
              </button>

              {batchRunning && (
                <>
                  <button
                    onClick={pauseBatch}
                    className={`px-4 py-3 rounded-2xl font-bold text-sm transition flex items-center gap-1.5 ${batchPaused ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
                  >
                    {batchPaused ? <Play size={16} /> : <Pause size={16} />}
                    {batchPaused ? 'Lanjut' : 'Jeda'}
                  </button>
                  <button
                    onClick={stopBatch}
                    className="px-4 py-3 rounded-2xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-1.5"
                  >
                    <Pause size={16} />
                    Stop
                  </button>
                </>
              )}
            </div>

            {/* Progress during batch */}
            {(batchRunning || batchTotal > 0) && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-700 dark:text-gray-300">
                    {batchRunning ? `Memproses ${batchIdx} / ${batchTotal}...` : `Selesai: ${batchIdx} / ${batchTotal}`}
                  </span>
                  <span className="text-violet-600 dark:text-violet-400">
                    {batchTotal > 0 ? Math.round((batchIdx / batchTotal) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all"
                    style={{ width: `${batchTotal > 0 ? (batchIdx / batchTotal) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span className="text-emerald-600 font-bold">✅ {batchResults.success} berhasil</span>
                  <span className="text-amber-600 font-bold">⚠️ {batchResults.noFace} tanpa wajah</span>
                  <span className="text-red-600 font-bold">❌ {batchResults.failed} gagal</span>
                </div>
              </div>
            )}

            {/* Log output */}
            {batchLog.length > 0 && (
              <div className="bg-gray-950 rounded-2xl p-3 max-h-52 overflow-y-auto font-mono text-xs space-y-0.5">
                {batchLog.map((line, i) => (
                  <div key={i} className={`leading-relaxed ${
                    line.startsWith('✅') ? 'text-emerald-400'
                    : line.startsWith('❌') ? 'text-red-400'
                    : line.startsWith('⚠️') ? 'text-amber-400'
                    : line.startsWith('🚀') || line.startsWith('📊') ? 'text-violet-400 font-bold'
                    : 'text-gray-400'
                  }`}>{line || '\u00A0'}</div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>

          {/* ── SANTRI LIST FOR FACE ENROLLMENT ── */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-indigo-500" />
                <h2 className="font-bold text-gray-800 dark:text-white">Daftar Santri & Status Biometrik Wajah</h2>
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold px-2 py-0.5 rounded-full">
                  {filteredFaceList.length}
                </span>
              </div>
              <button
                onClick={fetchFaceStatus}
                disabled={loadingFace}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <RefreshCw size={16} className={`text-gray-500 ${loadingFace ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Filters */}
            <div className="space-y-2">
              <div className="relative w-full">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nama / NIS..."
                  value={faceSearch}
                  onChange={(e) => setFaceSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 w-full">
                <select
                  value={faceFilterMode}
                  onChange={(e) => setFaceFilterMode(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white font-medium"
                >
                  <option value="all">Semua Status</option>
                  <option value="enrolled">✅ Enrolled</option>
                  <option value="unenrolled">⏳ Belum Enrolled</option>
                </select>
                <select
                  value={faceGenderFilter}
                  onChange={(e) => setFaceGenderFilter(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white font-medium"
                >
                  <option value="">Semua Gender</option>
                  <option value="Laki-laki">👳 Santri Putra</option>
                  <option value="Perempuan">🧕 Santri Putri</option>
                </select>
              </div>
            </div>

            {/* List */}
            {loadingFace ? (
              <div className="flex justify-center py-12">
                <Loader2 size={32} className="text-indigo-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {filteredFaceList.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">Tidak ada data ditemukan.</div>
                ) : (
                  filteredFaceList.map((m) => (
                    <div
                      key={m.murid_id}
                      className={`p-3 rounded-2xl border transition-all ${
                        m.enrolled
                          ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50'
                      }`}
                    >
                      {/* Baris 1: Foto + Nama + Status Badge */}
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden flex-shrink-0 ring-2 ${m.enrolled ? 'ring-emerald-400' : 'ring-gray-300 dark:ring-gray-600'}`}>
                          {m.foto ? (
                            <img src={m.foto} alt={m.nama} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                              {m.jenis_kelamin === 'Perempuan' ? (
                                <SantriPutriIcon size={18} className="text-rose-400" />
                              ) : (
                                <SantriPutraIcon size={18} className="text-teal-500" />
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-gray-900 dark:text-white leading-snug">
                            {m.nama}
                          </p>
                        </div>

                        <div className="flex-shrink-0">
                          {m.enrolled ? (
                            <div className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-2 py-0.5 rounded-full">
                              <CheckCircle2 size={12} />
                              <span className="hidden sm:inline">Enrolled</span>
                            </div>
                          ) : m.foto ? (
                            <div className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full">
                              <AlertCircle size={12} />
                              <span className="hidden sm:inline">Belum</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-bold px-2 py-0.5 rounded-full">
                              <Camera size={12} />
                              <span className="hidden sm:inline">Tanpa Foto</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Baris 2: NIS & Kelas — Merapat ke kiri sejajar dengan awal foto */}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
                        NIS: <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{m.nis}</span>
                        {m.kelas_madin && ` · ${m.kelas_madin}`}
                      </p>

                      {/* Baris 3: Gender Badge & Biometrik — Merapat ke kiri sejajar dengan awal foto */}
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/60 flex-wrap">
                        <GenderBadge gender={m.jenis_kelamin} size="xs" />
                        {m.enrolled ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/40">
                            Biometrik Wajah Aktif
                          </span>
                        ) : m.foto ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200/50 dark:border-amber-800/40">
                            Foto Siap Di-enroll
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded border border-gray-200/50 dark:border-gray-700/40">
                            Foto Belum Tersedia
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PairingAndFacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 size={36} className="text-indigo-600 animate-spin" />
        </div>
      }
    >
      <PairingAndFacePageInner />
    </Suspense>
  );
}
