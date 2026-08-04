'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, CheckCircle, XCircle, QrCode, Shield, Wifi, RefreshCw,
  ChevronDown, FlipHorizontal, Layers, Sparkles, Brain, ScanFace,
  Loader2, Users, Zap, Info, ChevronsUpDown
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

// =====================================================
// TYPES
// =====================================================
type ScanMode = 'qr' | 'face';
type FaceAiStatus = 'idle' | 'loading-models' | 'loading-db' | 'ready' | 'scanning' | 'detected' | 'error';

interface FaceDescriptor {
  murid_id: number;
  nama: string;
  nis: string;
  jenis_kelamin: string;
  descriptor: number[];
}

// =====================================================
// EUCLIDEAN DISTANCE — Pure in browser, no server round-trip
// =====================================================
function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// =====================================================
// FACE-API DYNAMIC LOADER (Client Side Only)
// =====================================================
let faceApiInstance: any = null;
let modelsLoaded = false;

async function loadFaceApi() {
  if (faceApiInstance && modelsLoaded) return faceApiInstance;

  // Dynamically import @vladmandic/face-api — avoids SSR issues
  const faceapi = await import('@vladmandic/face-api');
  faceApiInstance = faceapi;

  const MODEL_URL = '/models';
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);

  modelsLoaded = true;
  return faceapi;
}

// =====================================================
// MAIN PAGE COMPONENT
// =====================================================
export default function ScanAbsenPage() {
  const [scanMode, setScanMode] = useState<ScanMode>('qr');
  const [selectedSchedule, setSelectedSchedule] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [isHttpWarning, setIsHttpWarning] = useState(false);
  const [popup, setPopup] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    text: string;
    foto?: string | null;
  } | null>(null);
  const [lastScan, setLastScan] = useState<{
    nama: string;
    waktu: string;
    foto?: string | null;
  } | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('user'); // Face AI prefers front camera
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);

  // Face AI specific state
  const [faceStatus, setFaceStatus] = useState<FaceAiStatus>('idle');
  const [faceStatusMsg, setFaceStatusMsg] = useState('');
  const [faceDb, setFaceDb] = useState<FaceDescriptor[]>([]);
  const [faceDbCount, setFaceDbCount] = useState(0);
  const [detectResult, setDetectResult] = useState<{ nama: string; score: number; murid_id: number } | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);

  // Refs
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceStreamRef = useRef<MediaStream | null>(null);
  const faceDetectIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cameraContainerRef = useRef<HTMLDivElement | null>(null);
  const faceApiRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isHttps = window.location.protocol === 'https:';
      if (!isLocalhost && !isHttps) {
        setIsHttpWarning(true);
      }
    }
  }, []);

  // =====================================================
  // QR MODE
  // =====================================================
  const stopQrScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        if (state === 2 || state === 3) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('QR stop error:', e);
      }
      html5QrCodeRef.current = null;
    }
  };

  const startQrScanner = async (facing: 'environment' | 'user') => {
    try {
      const readerEl = document.getElementById('reader');
      if (!readerEl) return;
      html5QrCodeRef.current = new Html5Qrcode('reader');
      await html5QrCodeRef.current.start(
        { facingMode: facing },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => {
          stopQrScanner();
          setIsScanning(false);
          handleQrScan(decodedText);
        },
        () => {}
      );
    } catch (err) {
      console.error('QR camera failed:', err);
      setIsScanning(false);
      setPopup({ type: 'error', title: 'Akses Kamera Gagal', text: 'Kamera tidak ditemukan atau izin belum diberikan.' });
    }
  };

  useEffect(() => {
    if (scanMode === 'qr' && isScanning) {
      const timer = setTimeout(() => startQrScanner(facingMode), 150);
      return () => clearTimeout(timer);
    }
  }, [isScanning, scanMode]);

  const handleQrScan = async (barcodeData: string) => {
    try {
      const res = await fetch('/api/scan-absen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcodeData, selectedSchedule })
      });
      const data = await res.json();
      const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (data.success) {
        const nama = data.nama || 'Santri/Guru';
        const foto = data.foto || null;
        setLastScan({ nama, waktu: now, foto });
        setPopup({ type: 'success', title: 'Absen Berhasil! ✅', text: data.message, foto });
      } else {
        setPopup({ type: 'warning', title: 'Kartu Tidak Dikenal', text: data.message });
      }
    } catch {
      setPopup({ type: 'error', title: 'Koneksi Gagal', text: 'Koneksi ke server terputus.' });
    }
  };

  // =====================================================
  // FACE AI MODE
  // =====================================================
  const stopFaceScanner = useCallback(() => {
    if (faceDetectIntervalRef.current) {
      clearInterval(faceDetectIntervalRef.current);
      faceDetectIntervalRef.current = null;
    }
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach(t => t.stop());
      faceStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setFaceStatus('idle');
    setDetectResult(null);
    setIsScanning(false);
  }, []);

  const loadFaceDb = useCallback(async (gender?: string) => {
    setFaceStatusMsg('Memuat database wajah santri...');
    const params = new URLSearchParams();
    if (gender) params.set('jenis_kelamin', gender);

    const res = await fetch(`/api/murid/face-descriptor?${params}`);
    const data = await res.json();

    if (!data.success) throw new Error('Gagal memuat database wajah');

    setFaceDb(data.data);
    setFaceDbCount(data.count);
    return data.data as FaceDescriptor[];
  }, []);

  const startFaceScanner = useCallback(async () => {
    if (typeof window === 'undefined') return;

    setFaceStatus('loading-models');
    setFaceStatusMsg('Memuat model AI Face Recognition...');
    setIsScanning(true);
    setDetectResult(null);

    try {
      // Load face-api models
      const faceapi = await loadFaceApi();
      faceApiRef.current = faceapi;

      // Load face descriptors from DB
      setFaceStatus('loading-db');
      const gender = selectedSchedule.includes('utri') ? 'Perempuan'
        : selectedSchedule.includes('utra') ? 'Laki-laki' : undefined;
      const db = await loadFaceDb(gender);

      if (db.length === 0) {
        setFaceStatus('error');
        setFaceStatusMsg('Belum ada santri yang ter-enroll ke Face AI. Jalankan Batch Enrollment terlebih dahulu di menu Enrollment.');
        setIsScanning(false);
        return;
      }

      // Start camera
      setFaceStatusMsg('Membuka kamera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      faceStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setFaceStatus('scanning');
      setFaceStatusMsg(`Model siap. ${db.length} santri ter-enroll. Arahkan wajah ke kamera...`);

      // Start detection loop every 800ms
      faceDetectIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current || !faceApiRef.current) return;
        if (faceStatus === 'detected') return;

        try {
          const detection = await faceApiRef.current.detectSingleFace(
            videoRef.current,
            new faceApiRef.current.SsdMobilenetv1Options({ minConfidence: 0.5 })
          )
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (!detection) return;

          const descriptor = Array.from(detection.descriptor) as number[];

          // Find closest match in DB
          let bestMatch: FaceDescriptor | null = null;
          let bestDist = Infinity;

          for (const entry of db) {
            if (!entry.descriptor || !Array.isArray(entry.descriptor)) continue;
            const dist = euclideanDistance(descriptor, entry.descriptor);
            if (dist < bestDist) {
              bestDist = dist;
              bestMatch = entry;
            }
          }

          // Threshold: distance < 0.45 = match (0 = perfect, 0.6+ = mismatch)
          const THRESHOLD = 0.45;
          if (bestMatch && bestDist < THRESHOLD) {
            const similarity = Math.round((1 - bestDist / 0.6) * 100);
            setDetectResult({ nama: bestMatch.nama, score: similarity, murid_id: bestMatch.murid_id });
            setFaceStatus('detected');
            clearInterval(faceDetectIntervalRef.current!);
            faceDetectIntervalRef.current = null;
          }
        } catch (e) {
          console.warn('Detection frame error:', e);
        }
      }, 800);

    } catch (err: any) {
      console.error('Face scanner error:', err);
      setFaceStatus('error');
      setFaceStatusMsg('Gagal membuka kamera atau memuat model AI: ' + err.message);
      setIsScanning(false);
    }
  }, [facingMode, selectedSchedule, loadFaceDb]);

  // Confirm face absensi to server
  const confirmFaceAbsen = async () => {
    if (!detectResult || confirmPending) return;
    setConfirmPending(true);

    try {
      const res = await fetch('/api/scan-absen/face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          murid_id: detectResult.murid_id,
          selectedSchedule
        })
      });
      const data = await res.json();
      const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      stopFaceScanner();

      if (data.success) {
        setLastScan({ nama: detectResult.nama, waktu: now, foto: data.foto || null });
        setPopup({ type: 'success', title: 'Absen Wajah Berhasil! ✅', text: data.message, foto: data.foto || null });
      } else {
        setPopup({ type: 'warning', title: 'Gagal Absen', text: data.message || 'Terjadi kesalahan saat merekam absensi.' });
      }
    } catch {
      setPopup({ type: 'error', title: 'Koneksi Gagal', text: 'Gagal menghubungi server.' });
    } finally {
      setConfirmPending(false);
    }
  };

  const rejectAndRescan = () => {
    setDetectResult(null);
    setFaceStatus('scanning');
    setFaceStatusMsg('Arahkan wajah ke kamera...');
    // Restart detection loop
    faceDetectIntervalRef.current = setInterval(async () => {
      // same logic — simplified restart
      if (!videoRef.current || !faceApiRef.current) return;
      try {
        const detection = await faceApiRef.current.detectSingleFace(
          videoRef.current,
          new faceApiRef.current.SsdMobilenetv1Options({ minConfidence: 0.5 })
        ).withFaceLandmarks().withFaceDescriptor();

        if (!detection) return;
        const descriptor = Array.from(detection.descriptor) as number[];
        let bestMatch: FaceDescriptor | null = null;
        let bestDist = Infinity;

        for (const entry of faceDb) {
          if (!entry.descriptor || !Array.isArray(entry.descriptor)) continue;
          const dist = euclideanDistance(descriptor, entry.descriptor);
          if (dist < bestDist) { bestDist = dist; bestMatch = entry; }
        }

        if (bestMatch && bestDist < 0.45) {
          const similarity = Math.round((1 - bestDist / 0.6) * 100);
          setDetectResult({ nama: bestMatch.nama, score: similarity, murid_id: bestMatch.murid_id });
          setFaceStatus('detected');
          clearInterval(faceDetectIntervalRef.current!);
          faceDetectIntervalRef.current = null;
        }
      } catch (e) {
        console.warn('Rescan detect error:', e);
      }
    }, 800);
  };

  // Toggle camera
  const switchCamera = async () => {
    if (isSwitchingCamera) return;
    setIsSwitchingCamera(true);
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);

    if (scanMode === 'qr' && isScanning) {
      await stopQrScanner();
      setTimeout(async () => {
        await startQrScanner(newFacing);
        setIsSwitchingCamera(false);
      }, 400);
    } else {
      setIsSwitchingCamera(false);
    }
  };

  const startScanner = () => {
    if (scanMode === 'qr') {
      setIsScanning(true);
    } else {
      startFaceScanner();
    }
    setTimeout(() => cameraContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  };

  const stopAll = () => {
    stopQrScanner();
    stopFaceScanner();
    setIsScanning(false);
  };

  // Switch mode: stop everything first
  const handleModeSwitch = (mode: ScanMode) => {
    if (isScanning) {
      stopAll();
    }
    setScanMode(mode);
    setDetectResult(null);
    setFaceStatus('idle');
    // Face mode prefers front camera
    if (mode === 'face') setFacingMode('user');
    else setFacingMode('environment');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopQrScanner();
      stopFaceScanner();
    };
  }, []);

  const dismissAndRescan = () => {
    setPopup(null);
    setDetectResult(null);
    setFaceStatus('idle');
    setTimeout(() => startScanner(), 300);
  };

  // =====================================================
  // RENDER
  // =====================================================
  const faceStatusColor: Record<FaceAiStatus, string> = {
    idle: 'text-slate-400',
    'loading-models': 'text-amber-400',
    'loading-db': 'text-blue-400',
    ready: 'text-emerald-400',
    scanning: 'text-emerald-400',
    detected: 'text-green-300',
    error: 'text-red-400'
  };

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-24 animate-[fadeIn_0.5s_ease-out]">

      {/* ====== POPUP MODAL ====== */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center">
            {popup.type === 'success' && popup.foto ? (
              <div className="mx-auto w-24 h-24 rounded-full overflow-hidden mb-4 ring-4 ring-green-400 ring-offset-2 dark:ring-offset-gray-800 shadow-lg">
                <img src={popup.foto} alt="Foto Santri" className="w-full h-full object-cover"
                  onError={(e) => {
                    const el = e.currentTarget.parentElement!;
                    el.innerHTML = '<div class="w-full h-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>';
                  }}
                />
              </div>
            ) : (
              <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
                popup.type === 'success' ? 'bg-green-100 dark:bg-green-900/50 text-green-600'
                  : popup.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600'
                  : 'bg-red-100 dark:bg-red-900/50 text-red-600'
              }`}>
                {popup.type === 'success' ? <CheckCircle size={40} /> : <XCircle size={40} />}
              </div>
            )}
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{popup.title}</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-6 leading-relaxed whitespace-pre-line">{popup.text}</p>
            <button
              onClick={dismissAndRescan}
              className={`w-full py-3.5 rounded-2xl font-bold text-white transition-transform active:scale-95 flex items-center justify-center gap-2 ${
                popup.type === 'success' ? 'bg-green-600 hover:bg-green-700'
                  : popup.type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <RefreshCw size={18} /> Scan Berikutnya
            </button>
          </div>
        </div>
      )}

      {/* ====== HEADER ====== */}
      <div className="bg-gradient-to-br from-green-700 via-emerald-700 to-teal-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -top-8 -right-8 opacity-10">
          {scanMode === 'qr' ? <QrCode size={160} /> : <ScanFace size={160} />}
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 p-2.5 rounded-xl">
              {scanMode === 'qr' ? <QrCode size={24} /> : <Brain size={24} />}
            </div>
            <h1 className="text-xl font-extrabold">
              {scanMode === 'qr' ? 'Scan Kartu Absen (QR)' : 'Scan Wajah AI (Face AI)'}
            </h1>
          </div>
          <p className="text-green-200 text-sm">
            {scanMode === 'qr'
              ? 'Scan kartu QR/Barcode santri atau guru untuk absensi otomatis.'
              : 'Absensi via deteksi wajah real-time menggunakan AI. <0.5s per santri.'
            }
          </p>
          {lastScan && (
            <div className="mt-4 bg-white/15 backdrop-blur-sm rounded-2xl p-3 flex items-center gap-3">
              {lastScan.foto ? (
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white/40">
                  <img src={lastScan.foto} alt={lastScan.nama} className="w-full h-full object-cover" />
                </div>
              ) : (
                <CheckCircle size={20} className="text-green-300 flex-shrink-0" />
              )}
              <div>
                <p className="text-xs text-green-200">Terakhir di-scan:</p>
                <p className="font-bold text-sm">{lastScan.nama} — <span className="font-normal text-green-200">{lastScan.waktu}</span></p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ====== MODE TOGGLE TAB ====== */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-1.5 shadow-sm border border-gray-100 dark:border-gray-700 flex gap-1.5">
        <button
          onClick={() => handleModeSwitch('qr')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
            scanMode === 'qr'
              ? 'bg-green-600 text-white shadow-md'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <QrCode size={16} />
          Scan QR
        </button>
        <button
          onClick={() => handleModeSwitch('face')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
            scanMode === 'face'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <Brain size={16} />
          Face AI
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-semibold">BARU</span>
        </button>
      </div>

      {/* ====== HTTP WARNING ====== */}
      {isHttpWarning && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-200 dark:border-amber-700 rounded-2xl p-4 flex gap-3">
          <Shield size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-800 dark:text-amber-300 text-sm">Akses Kamera Dibatasi</p>
            <p className="text-amber-700 dark:text-amber-400 text-xs mt-1">
              Kamera hanya bisa dibuka via <strong>https://</strong> atau localhost.
            </p>
          </div>
        </div>
      )}

      {/* ====== FACE AI INFO CARD ====== */}
      {scanMode === 'face' && !isScanning && (
        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/50 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300 font-bold text-sm">
            <Zap size={16} className="text-violet-500" />
            Face AI — Cara Kerja
          </div>
          <ul className="text-xs text-violet-600 dark:text-violet-400 space-y-1 pl-1">
            <li>🧠 Model AI dimuat sekali, cached di browser (tidak perlu download ulang)</li>
            <li>⚡ Deteksi wajah real-time menggunakan WebGL GPU acceleration</li>
            <li>🔒 Pencocokan ({faceDbCount > 0 ? faceDbCount : '...'} santri) dilakukan murni di browser (tanpa kirim foto ke server)</li>
            <li>📷 Gunakan kamera depan tablet/ponsel yang diletakkan di pos absensi</li>
          </ul>
          {faceDbCount === 0 && (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs mt-2 font-medium">
              <Info size={14} />
              Belum ada santri ter-enroll. Jalankan Batch Enrollment di menu Admin → Face AI Enrollment.
            </div>
          )}
        </div>
      )}

      {/* ====== SCAN CARD (QR & Face AI Controls) ====== */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        {/* Dropdown target absensi */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Layers size={16} className="text-green-600" />
            Pilih Target Absensi
          </label>
          <div className="relative">
            <select
              value={selectedSchedule}
              onChange={(e) => setSelectedSchedule(e.target.value)}
              disabled={isScanning}
              className="w-full appearance-none p-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl font-semibold focus:ring-4 focus:ring-green-500/20 focus:border-green-500 dark:text-white transition-all pr-10"
            >
              <option value="">⚡ Absensi Otomatis (Sesuai Jadwal Aktif)</option>
              <option value="kegiatan">🕌 Kegiatan Asrama & Pesantren</option>
              <option value="madin">📖 Madrasah Diniyah (Madin)</option>
              <option value="quran">📘 Madrasah Al-Qur&apos;an (MQ)</option>
            </select>
            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* ====== QR SCANNER ====== */}
        {scanMode === 'qr' && (
          <>
            {!isScanning ? (
              <button
                onClick={startScanner}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-lg py-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <Camera size={26} />
                Buka Kamera & Mulai Scan QR
              </button>
            ) : (
              <div ref={cameraContainerRef} className="space-y-3 animate-[zoomIn_0.3s_ease-out]">
                <div className="flex justify-between items-center bg-gray-900 dark:bg-black p-3 rounded-t-2xl text-white">
                  <span className="font-bold text-sm flex items-center gap-2">
                    <Camera size={16} className="animate-pulse text-red-400" />
                    Arahkan ke QR / Barcode Kartu
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={switchCamera}
                      disabled={isSwitchingCamera}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                        isSwitchingCamera ? 'bg-gray-600 text-gray-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 active:scale-95 text-white'
                      }`}
                    >
                      <FlipHorizontal size={14} className={isSwitchingCamera ? 'animate-spin' : ''} />
                      <span className="hidden sm:inline">
                        {isSwitchingCamera ? 'Mengganti...' : facingMode === 'environment' ? 'Kamera Depan' : 'Kamera Belakang'}
                      </span>
                    </button>
                    <button
                      onClick={stopAll}
                      className="bg-red-500 hover:bg-red-600 p-1.5 rounded-lg transition-colors"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 bg-gray-800 py-1.5 -mt-3">
                  <span className={`w-2 h-2 rounded-full ${facingMode === 'environment' ? 'bg-green-400' : 'bg-blue-400'}`} />
                  <span className="text-xs font-semibold text-gray-300">
                    {facingMode === 'environment' ? '📷 Kamera Belakang' : '🤳 Kamera Depan'}
                  </span>
                </div>
                <div className="rounded-b-2xl overflow-hidden border-2 border-green-500 shadow-xl bg-black min-h-[300px] relative">
                  {isSwitchingCamera && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 gap-3">
                      <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-white text-sm font-semibold">Mengganti kamera...</span>
                    </div>
                  )}
                  <div id="reader" className="w-full h-full" />
                </div>
                <div className="flex items-center gap-2 text-center justify-center">
                  <Wifi size={14} className="text-gray-400" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">Pastikan pencahayaan cukup & QR Code tidak silau</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ====== FACE AI SCANNER ====== */}
        {scanMode === 'face' && (
          <>
            {!isScanning ? (
              <button
                onClick={startScanner}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-lg py-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <ScanFace size={26} />
                Mulai Scan Wajah AI
              </button>
            ) : (
              <div ref={cameraContainerRef} className="space-y-3 animate-[zoomIn_0.3s_ease-out]">
                {/* Camera header */}
                <div className="flex justify-between items-center bg-gray-900 p-3 rounded-t-2xl text-white">
                  <span className="font-bold text-sm flex items-center gap-2">
                    <Brain size={16} className="text-violet-400 animate-pulse" />
                    Face AI — Scan Wajah
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${faceStatusColor[faceStatus]}`}>
                      {faceStatus === 'loading-models' && '⏳ Loading AI...'}
                      {faceStatus === 'loading-db' && '📥 Loading DB...'}
                      {faceStatus === 'scanning' && '🟢 Aktif'}
                      {faceStatus === 'detected' && '✅ Terdeteksi!'}
                      {faceStatus === 'error' && '❌ Error'}
                    </span>
                    <button onClick={stopAll} className="bg-red-500 hover:bg-red-600 p-1.5 rounded-lg transition-colors">
                      <XCircle size={18} />
                    </button>
                  </div>
                </div>

                {/* Status Bar */}
                {(faceStatus === 'loading-models' || faceStatus === 'loading-db') && (
                  <div className="flex items-center gap-3 bg-gray-800 p-3 -mt-3">
                    <Loader2 size={16} className="text-violet-400 animate-spin flex-shrink-0" />
                    <span className="text-xs text-gray-300">{faceStatusMsg}</span>
                  </div>
                )}

                {faceStatus === 'scanning' && (
                  <div className="flex items-center gap-3 bg-gray-800 p-3 -mt-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                    <span className="text-xs text-gray-300">{faceStatusMsg}</span>
                  </div>
                )}

                {faceStatus === 'error' && (
                  <div className="flex items-center gap-3 bg-red-950 p-3 -mt-3">
                    <XCircle size={16} className="text-red-400 flex-shrink-0" />
                    <span className="text-xs text-red-300">{faceStatusMsg}</span>
                  </div>
                )}

                {/* Video Camera Area */}
                <div className="relative rounded-b-2xl overflow-hidden border-2 border-violet-500 shadow-xl bg-black" style={{ minHeight: 300 }}>
                  {/* Face overlay box while scanning */}
                  {faceStatus === 'scanning' && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                      <div className="w-52 h-64 rounded-2xl border-4 border-violet-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                    </div>
                  )}

                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                  />
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                {/* DB stats */}
                {faceStatus === 'scanning' && faceDbCount > 0 && (
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                    <Users size={13} />
                    <span>Mencocokkan dengan <strong className="text-violet-400">{faceDbCount} santri</strong> ter-enroll</span>
                  </div>
                )}

                {/* ====== DETECTED RESULT ====== */}
                {faceStatus === 'detected' && detectResult && (
                  <div className="bg-gradient-to-r from-emerald-950 to-teal-950 border border-emerald-600 rounded-2xl p-4 space-y-4 animate-[fadeIn_0.3s_ease-out]">
                    <div className="text-center space-y-1">
                      <div className="flex justify-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-700 flex items-center justify-center ring-4 ring-emerald-400 ring-offset-2 ring-offset-emerald-950">
                          <ScanFace size={32} className="text-white" />
                        </div>
                      </div>
                      <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wider mt-3">Wajah Teridentifikasi</p>
                      <h3 className="text-white text-xl font-extrabold">{detectResult.nama}</h3>
                      <div className="flex items-center justify-center gap-1.5 text-emerald-300 text-sm">
                        <Sparkles size={14} className="text-amber-400" />
                        <span>Kemiripan: <strong className="text-amber-300">{detectResult.score}%</strong></span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={rejectAndRescan}
                        className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-red-900/60 text-red-300 border border-red-700/50 hover:bg-red-900 text-sm font-bold transition"
                      >
                        <XCircle size={16} />
                        Bukan Saya
                      </button>
                      <button
                        onClick={confirmFaceAbsen}
                        disabled={confirmPending}
                        className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition disabled:opacity-50"
                      >
                        {confirmPending
                          ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</>
                          : <><CheckCircle size={16} /> Ya, Absen Saya!</>
                        }
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ====== INFO FOOTER ====== */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-4 text-xs text-blue-700 dark:text-blue-300 space-y-1">
        {scanMode === 'qr' ? (
          <>
            <p className="font-bold text-sm mb-2">ℹ️ Cara Penggunaan (Mode QR):</p>
            <p>1. Pilih kategori absensi (Otomatis, Asrama, Madin, MQ)</p>
            <p>2. Klik <strong>&quot;Buka Kamera&quot;</strong> lalu arahkan ke QR/Barcode kartu</p>
            <p>3. Sistem otomatis menyesuaikan dengan jadwal aktif saat ini</p>
          </>
        ) : (
          <>
            <p className="font-bold text-sm mb-2">ℹ️ Cara Penggunaan (Mode Face AI):</p>
            <p>1. Pastikan santri sudah ter-enroll (foto sudah diproses AI)</p>
            <p>2. Klik <strong>&quot;Mulai Scan Wajah&quot;</strong> — model AI dimuat otomatis</p>
            <p>3. Arahkan wajah ke kamera — deteksi terjadi dalam &lt;1 detik</p>
            <p>4. Konfirmasi jika wajah cocok, atau klik <strong>&quot;Bukan Saya&quot;</strong> untuk rescan</p>
          </>
        )}
      </div>
    </div>
  );
}
