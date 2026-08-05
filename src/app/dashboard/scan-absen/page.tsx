'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Camera, CheckCircle, XCircle, QrCode, Shield, Wifi, RefreshCw,
  ChevronDown, FlipHorizontal, Layers, Sparkles, Brain, ScanFace,
  Loader2, Users, Zap, Info, Link2, Search, UserPlus, CheckCircle2,
  AlertTriangle
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

interface MuridSearchResult {
  murid_id: number;
  nama: string;
  nis: string;
  kelas: string;
  foto: string | null;
}

// =====================================================
// EUCLIDEAN DISTANCE
// =====================================================
function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; sum += d * d; }
  return Math.sqrt(sum);
}

// =====================================================
// FACE-API LOADER
// =====================================================
let faceApiInstance: any = null;
let modelsLoaded = false;

async function loadFaceApi() {
  if (faceApiInstance && modelsLoaded) return faceApiInstance;
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
// QUICK PAIRING PANEL COMPONENT
// =====================================================
function QuickPairingPanel({
  mode,
  unknownCode,
  unknownDescriptor,
  onSuccess,
  onCancel,
}: {
  mode: 'barcode' | 'face';
  unknownCode?: string;
  unknownDescriptor?: number[];
  onSuccess: (nama: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MuridSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<MuridSearchResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const searchTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/murid?q=${encodeURIComponent(query)}&limit=8`);
        const data = await res.json();
        if (data.data) {
          setResults(data.data.map((m: any) => ({
            murid_id: m.murid_id,
            nama: m.nama,
            nis: m.nis,
            kelas: m.kelas_madin || m.kelas_quran || '—',
            foto: m.foto || null,
          })));
        }
      } catch { /* ignore */ }
      setSearching(false);
    }, 350);
    return () => clearTimeout(searchTimeout.current);
  }, [query]);

  const handleSave = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setSaveMsg('');

    try {
      if (mode === 'barcode' && unknownCode) {
        // Pairing barcode → murid
        const res = await fetch('/api/pairing/barcode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ murid_id: selected.murid_id, barcode_id: unknownCode }),
        });
        const data = await res.json();
        if (data.success) {
          setSaveMsg(`✅ Kartu berhasil dipasangkan ke ${selected.nama}!`);
          setTimeout(() => onSuccess(selected.nama), 1200);
        } else {
          setSaveMsg(`❌ Gagal: ${data.message || data.error}`);
        }
      } else if (mode === 'face' && unknownDescriptor) {
        // Pairing descriptor wajah → murid
        const res = await fetch('/api/murid/face-descriptor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ murid_id: selected.murid_id, descriptor: unknownDescriptor }),
        });
        const data = await res.json();
        if (data.success) {
          setSaveMsg(`✅ Wajah berhasil didaftarkan ke ${selected.nama}!`);
          setTimeout(() => onSuccess(selected.nama), 1200);
        } else {
          setSaveMsg(`❌ Gagal: ${data.error || '?'}`);
        }
      }
    } catch (e: any) {
      setSaveMsg(`❌ Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-[slideUp_0.3s_ease-out]">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${mode === 'barcode' ? 'bg-green-100 dark:bg-green-900/50 text-green-600' : 'bg-violet-100 dark:bg-violet-900/50 text-violet-600'}`}>
            {mode === 'barcode' ? <Link2 size={20} /> : <ScanFace size={20} />}
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900 dark:text-white text-base">
              {mode === 'barcode' ? '🔗 Daftarkan Kartu Ini' : '🔗 Daftarkan Wajah Ini'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {mode === 'barcode'
                ? `Kode: ${unknownCode || '—'}`
                : 'Pasangkan wajah yang baru terdeteksi ke santri'}
            </p>
          </div>
          <button onClick={onCancel} className="ml-auto p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <XCircle size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            type="text"
            placeholder="Ketik nama atau NIS santri..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:text-white"
          />
          {searching && <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin" />}
        </div>

        {/* Results */}
        {results.length > 0 && !selected && (
          <div className="max-h-52 overflow-y-auto space-y-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 p-2">
            {results.map(m => (
              <button
                key={m.murid_id}
                onClick={() => setSelected(m)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition text-left"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-700">
                  {m.foto
                    ? <img src={m.foto} alt={m.nama} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-gray-400"><Users size={16} /></div>
                  }
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-800 dark:text-white">{m.nama}</p>
                  <p className="text-xs text-gray-500">{m.nis} · {m.kelas}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Selected confirmation */}
        {selected && (
          <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 ring-2 ring-indigo-400">
                {selected.foto
                  ? <img src={selected.foto} alt={selected.nama} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-400"><Users size={20} /></div>
                }
              </div>
              <div>
                <p className="font-extrabold text-gray-900 dark:text-white">{selected.nama}</p>
                <p className="text-xs text-gray-500">{selected.nis} · {selected.kelas}</p>
              </div>
              <button onClick={() => setSelected(null)} className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline">Ganti</button>
            </div>

            {saveMsg ? (
              <p className={`text-sm font-bold text-center ${saveMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>
                {saveMsg}
              </p>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition disabled:opacity-50"
              >
                {saving
                  ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</>
                  : <><UserPlus size={16} /> {mode === 'barcode' ? 'Pasangkan Kartu Ini' : 'Daftarkan Wajah Ini'}</>
                }
              </button>
            )}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && !searching && !selected && (
          <p className="text-center text-sm text-gray-400 py-2">Santri tidak ditemukan. Coba kata kunci lain.</p>
        )}
      </div>
    </div>
  );
}

// =====================================================
// MAIN PAGE COMPONENT (inner — needs Suspense wrapper)
// =====================================================
function ScanAbsenInner() {
  const searchParams = useSearchParams();

  // Mode dari URL param (?mode=qr atau ?mode=face)
  const urlMode = searchParams.get('mode') as ScanMode | null;

  const [scanMode, setScanMode] = useState<ScanMode>(urlMode === 'face' ? 'face' : 'qr');
  const [selectedSchedule, setSelectedSchedule] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [isHttpWarning, setIsHttpWarning] = useState(false);
  const [popup, setPopup] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    text: string;
    foto?: string | null;
    unknownCode?: string;
    unknownDescriptor?: number[];
  } | null>(null);
  const [lastScan, setLastScan] = useState<{ nama: string; waktu: string; foto?: string | null } | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(urlMode === 'face' ? 'user' : 'environment');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);

  // Quick pairing state
  const [showPairing, setShowPairing] = useState(false);
  const [pairingMode, setPairingMode] = useState<'barcode' | 'face'>('barcode');
  const [pairingCode, setPairingCode] = useState('');
  const [pairingDescriptor, setPairingDescriptor] = useState<number[] | undefined>();

  // Face AI state
  const [faceStatus, setFaceStatus] = useState<FaceAiStatus>('idle');
  const [faceStatusMsg, setFaceStatusMsg] = useState('');
  const [faceDb, setFaceDb] = useState<FaceDescriptor[]>([]);
  const [faceDbCount, setFaceDbCount] = useState(0);
  const [enrollStats, setEnrollStats] = useState<{ total: number; enrolled: number; percent: number } | null>(null);
  const [detectResult, setDetectResult] = useState<{ nama: string; score: number; murid_id: number } | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const [lastUnknownDescriptor, setLastUnknownDescriptor] = useState<number[] | undefined>();

  // Refs
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceStreamRef = useRef<MediaStream | null>(null);
  const faceDetectIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cameraContainerRef = useRef<HTMLDivElement | null>(null);
  const faceApiRef = useRef<any>(null);
  const faceDbRef = useRef<FaceDescriptor[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isHttps = window.location.protocol === 'https:';
      if (!isLocalhost && !isHttps) setIsHttpWarning(true);
    }
  }, []);

  // Auto-switch mode dari URL param saat mount
  useEffect(() => {
    if (urlMode === 'face') {
      setScanMode('face');
      setFacingMode('user');
    } else if (urlMode === 'qr') {
      setScanMode('qr');
      setFacingMode('environment');
    }
  }, [urlMode]);

  // Fetch enrollment stats for status badge
  useEffect(() => {
    if (scanMode === 'face') {
      fetch('/api/murid/face-enrollment-status')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const percent = data.total > 0 ? Math.round((data.enrolled / data.total) * 100) : 0;
            setEnrollStats({ total: data.total, enrolled: data.enrolled, percent });
            setFaceDbCount(data.enrolled);
          }
        })
        .catch(err => console.warn('Fetch enrollment status error:', err));
    }
  }, [scanMode]);

  // ── QR SCANNER ────────────────────────────────────────────────────
  const stopQrScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        if (state === 2 || state === 3) await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) { console.warn('QR stop:', e); }
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
        (decodedText) => { stopQrScanner(); setIsScanning(false); handleQrScan(decodedText); },
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
        setLastScan({ nama, waktu: now, foto: data.foto || null });
        setPopup({ type: 'success', title: 'Absen Berhasil! ✅', text: data.message, foto: data.foto || null });
      } else {
        // Kartu tidak dikenal → siapkan quick pairing
        setPopup({
          type: 'warning',
          title: 'Kartu Tidak Dikenal',
          text: data.message,
          unknownCode: barcodeData
        });
      }
    } catch {
      setPopup({ type: 'error', title: 'Koneksi Gagal', text: 'Koneksi ke server terputus.' });
    }
  };

  // ── FACE AI SCANNER ───────────────────────────────────────────────
  const stopFaceScanner = useCallback(() => {
    if (faceDetectIntervalRef.current) { clearInterval(faceDetectIntervalRef.current); faceDetectIntervalRef.current = null; }
    if (faceStreamRef.current) { faceStreamRef.current.getTracks().forEach(t => t.stop()); faceStreamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setFaceStatus('idle');
    setDetectResult(null);
    setIsScanning(false);
  }, []);

  const loadFaceDb = useCallback(async () => {
    const res = await fetch('/api/murid/face-descriptor');
    const data = await res.json();
    if (!data.success) throw new Error('Gagal memuat database wajah');
    faceDbRef.current = data.data;
    setFaceDb(data.data);
    setFaceDbCount(data.count);
    return data.data as FaceDescriptor[];
  }, []);

  const runDetectionLoop = useCallback((faceapi: any, db: FaceDescriptor[]) => {
    faceDetectIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !faceapi) return;
      try {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) return;
        const descriptor = Array.from(detection.descriptor) as number[];

        let bestMatch: FaceDescriptor | null = null;
        let bestDist = Infinity;
        for (const entry of db) {
          if (!entry.descriptor || !Array.isArray(entry.descriptor)) continue;
          const dist = euclideanDistance(descriptor, entry.descriptor);
          if (dist < bestDist) { bestDist = dist; bestMatch = entry; }
        }

        const THRESHOLD = 0.45;
        if (bestMatch && bestDist < THRESHOLD) {
          const similarity = Math.round((1 - bestDist / 0.6) * 100);
          setDetectResult({ nama: bestMatch.nama, score: similarity, murid_id: bestMatch.murid_id });
          setFaceStatus('detected');
          clearInterval(faceDetectIntervalRef.current!);
          faceDetectIntervalRef.current = null;
        } else {
          // Wajah terdeteksi tapi tidak cocok → simpan descriptor untuk quick pairing
          setLastUnknownDescriptor(descriptor);
        }
      } catch (e) { console.warn('Detection frame error:', e); }
    }, 800);
  }, []);

  const startFaceScanner = useCallback(async () => {
    if (typeof window === 'undefined') return;
    setFaceStatus('loading-models');
    setFaceStatusMsg('Memuat model AI Face Recognition...');
    setIsScanning(true);
    setDetectResult(null);
    setLastUnknownDescriptor(undefined);

    try {
      const faceapi = await loadFaceApi();
      faceApiRef.current = faceapi;

      setFaceStatus('loading-db');
      setFaceStatusMsg('Memuat database wajah santri...');
      const db = await loadFaceDb();

      if (db.length === 0) {
        setFaceStatus('error');
        setFaceStatusMsg('Belum ada santri ter-enroll. Jalankan Batch Enrollment di menu Face AI Enrollment.');
        setIsScanning(false);
        return;
      }

      setFaceStatusMsg('Membuka kamera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } }
      });
      faceStreamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }

      setFaceStatus('scanning');
      setFaceStatusMsg(`${db.length} santri ter-enroll. Arahkan wajah ke kamera...`);
      runDetectionLoop(faceapi, db);
    } catch (err: any) {
      console.error('Face scanner error:', err);
      setFaceStatus('error');
      setFaceStatusMsg('Gagal membuka kamera: ' + err.message);
      setIsScanning(false);
    }
  }, [facingMode, loadFaceDb, runDetectionLoop]);

  const confirmFaceAbsen = async () => {
    if (!detectResult || confirmPending) return;
    setConfirmPending(true);
    try {
      const res = await fetch('/api/scan-absen/face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ murid_id: detectResult.murid_id, selectedSchedule })
      });
      const data = await res.json();
      const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      stopFaceScanner();
      if (data.success) {
        setLastScan({ nama: detectResult.nama, waktu: now, foto: data.foto || null });
        setPopup({ type: 'success', title: 'Absen Wajah Berhasil! ✅', text: data.message, foto: data.foto || null });
      } else {
        setPopup({ type: 'warning', title: 'Gagal Absen', text: data.message || 'Terjadi kesalahan.' });
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
    if (faceApiRef.current && faceDbRef.current.length > 0) {
      runDetectionLoop(faceApiRef.current, faceDbRef.current);
    }
  };

  // Wajah tidak cocok → trigger quick pairing
  const handleFaceNotFound = () => {
    if (lastUnknownDescriptor) {
      setPairingMode('face');
      setPairingDescriptor(lastUnknownDescriptor);
      setShowPairing(true);
    } else {
      setPopup({ type: 'warning', title: 'Wajah Tidak Dikenal', text: 'Wajah belum terdaftar di sistem. Coba lagi atau minta admin untuk enrollment.' });
    }
  };

  // Toggle camera
  const switchCamera = async () => {
    if (isSwitchingCamera) return;
    setIsSwitchingCamera(true);
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    if (scanMode === 'qr' && isScanning) {
      await stopQrScanner();
      setTimeout(async () => { await startQrScanner(newFacing); setIsSwitchingCamera(false); }, 400);
    } else { setIsSwitchingCamera(false); }
  };

  const stopAll = () => { stopQrScanner(); stopFaceScanner(); setIsScanning(false); };

  const handleModeSwitch = (mode: ScanMode) => {
    if (isScanning) stopAll();
    setScanMode(mode);
    setDetectResult(null);
    setFaceStatus('idle');
    if (mode === 'face') setFacingMode('user');
    else setFacingMode('environment');
  };

  const startScanner = () => {
    if (scanMode === 'qr') setIsScanning(true);
    else startFaceScanner();
    setTimeout(() => cameraContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  };

  useEffect(() => { return () => { stopQrScanner(); stopFaceScanner(); }; }, []);

  const dismissAndRescan = () => {
    setPopup(null);
    setDetectResult(null);
    setFaceStatus('idle');
    setTimeout(() => startScanner(), 300);
  };

  // Open quick pairing from popup (QR unknown card)
  const handleOpenPairing = () => {
    if (!popup?.unknownCode) return;
    setPairingMode('barcode');
    setPairingCode(popup.unknownCode);
    setPopup(null);
    setShowPairing(true);
  };

  // ── Styling helpers ───────────────────────────────────────────────
  const faceStatusColor: Record<FaceAiStatus, string> = {
    idle: 'text-slate-400', 'loading-models': 'text-amber-400', 'loading-db': 'text-blue-400',
    ready: 'text-emerald-400', scanning: 'text-emerald-400', detected: 'text-green-300', error: 'text-red-400'
  };

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto space-y-5 pb-24 animate-[fadeIn_0.5s_ease-out]">

      {/* ====== QUICK PAIRING PANEL ====== */}
      {showPairing && (
        <QuickPairingPanel
          mode={pairingMode}
          unknownCode={pairingCode}
          unknownDescriptor={pairingDescriptor}
          onSuccess={(nama) => {
            setShowPairing(false);
            setPopup({ type: 'success', title: 'Pendaftaran Berhasil! ✅', text: `${pairingMode === 'barcode' ? 'Kartu' : 'Wajah'} berhasil didaftarkan ke ${nama}. Coba scan lagi.` });
          }}
          onCancel={() => setShowPairing(false)}
        />
      )}

      {/* ====== POPUP MODAL ====== */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center">
            {popup.type === 'success' && popup.foto ? (
              <div className="mx-auto w-24 h-24 rounded-full overflow-hidden mb-4 ring-4 ring-green-400 ring-offset-2 dark:ring-offset-gray-800 shadow-lg">
                <img src={popup.foto} alt="Foto" className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full bg-green-100 flex items-center justify-center text-green-600"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>'; }}
                />
              </div>
            ) : (
              <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
                popup.type === 'success' ? 'bg-green-100 text-green-600'
                : popup.type === 'warning' ? 'bg-yellow-100 text-yellow-600'
                : 'bg-red-100 text-red-600'
              }`}>
                {popup.type === 'success' ? <CheckCircle size={40} /> : popup.type === 'warning' ? <AlertTriangle size={40} /> : <XCircle size={40} />}
              </div>
            )}

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{popup.title}</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 leading-relaxed whitespace-pre-line">{popup.text}</p>

            {/* Quick Pairing Button — muncul saat kartu tidak dikenal */}
            {popup.type === 'warning' && popup.unknownCode && (
              <button
                onClick={handleOpenPairing}
                className="w-full mb-3 py-3 rounded-2xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center justify-center gap-2"
              >
                <UserPlus size={18} /> Daftarkan Kartu Ini ke Santri
              </button>
            )}

            <button
              onClick={dismissAndRescan}
              className={`w-full py-3 rounded-2xl font-bold text-white transition active:scale-95 flex items-center justify-center gap-2 ${
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
            {scanMode === 'qr' ? 'Scan kartu QR/Barcode santri atau guru untuk absensi otomatis.' : 'Absensi via deteksi wajah real-time menggunakan AI.'}
          </p>
          {lastScan && (
            <div className="mt-4 bg-white/15 backdrop-blur-sm rounded-2xl p-3 flex items-center gap-3">
              {lastScan.foto
                ? <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white/40"><img src={lastScan.foto} alt={lastScan.nama} className="w-full h-full object-cover" /></div>
                : <CheckCircle size={20} className="text-green-300 flex-shrink-0" />
              }
              <div>
                <p className="text-xs text-green-200">Terakhir di-scan:</p>
                <p className="font-bold text-sm">{lastScan.nama} — <span className="font-normal text-green-200">{lastScan.waktu}</span></p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ====== MODE TOGGLE ====== */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-1.5 shadow-sm border border-gray-100 dark:border-gray-700 flex gap-1.5">
        <button onClick={() => handleModeSwitch('qr')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${scanMode === 'qr' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
          <QrCode size={16} /> Scan QR
        </button>
        <button onClick={() => handleModeSwitch('face')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${scanMode === 'face' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
          <Brain size={16} /> Scan Wajah AI
        </button>
      </div>

      {/* ====== HTTP WARNING ====== */}
      {isHttpWarning && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-200 rounded-2xl p-4 flex gap-3">
          <Shield size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-800 dark:text-amber-300 text-sm">Akses Kamera Dibatasi</p>
            <p className="text-amber-700 dark:text-amber-400 text-xs mt-1">Kamera hanya bisa dibuka via <strong>https://</strong> atau localhost.</p>
          </div>
        </div>
      )}

      {/* ====== FACE AI INFO ====== */}
      {scanMode === 'face' && !isScanning && (
        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/50 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300 font-bold text-sm">
            <Zap size={16} className="text-violet-500" /> Face AI — Cara Kerja
          </div>
          <ul className="text-xs text-violet-600 dark:text-violet-400 space-y-1 pl-1">
            <li>🧠 Model AI dimuat sekali, cached di browser</li>
            <li>⚡ Deteksi wajah real-time menggunakan WebGL GPU acceleration</li>
            <li>🔒 Pencocokan dilakukan murni di browser (tanpa kirim foto ke server)</li>
            <li>📋 Otomatis mencatat ke jadwal aktif — sinkron dengan Rekapitulasi ✅</li>
          </ul>
          {enrollStats && enrollStats.enrolled > 0 ? (
            <div className="flex items-center justify-between text-xs mt-3 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                <span>{enrollStats.enrolled} / {enrollStats.total} santri ter-enroll ({enrollStats.percent}%) — Face AI Siap!</span>
              </div>
              <Link href="/dashboard/face-enrollment" className="text-emerald-700 dark:text-emerald-300 hover:underline font-bold text-xs flex items-center gap-1 flex-shrink-0 ml-2">
                Kelola →
              </Link>
            </div>
          ) : (
            <Link href="/dashboard/face-enrollment" className="flex items-center gap-2 text-amber-600 hover:text-amber-700 hover:underline text-xs mt-2 font-bold bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 transition">
              <Info size={16} className="flex-shrink-0" />
              <span>Belum ada santri ter-enroll. <u>Klik di sini untuk buka Batch Enrollment</u> di menu Face AI Enrollment →</span>
            </Link>
          )}
        </div>
      )}

      {/* ====== SCAN CARD ====== */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        {/* Target dropdown */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Layers size={16} className="text-green-600" /> Pilih Target Absensi
          </label>
          <div className="relative">
            <select value={selectedSchedule} onChange={(e) => setSelectedSchedule(e.target.value)} disabled={isScanning}
              className="w-full appearance-none p-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl font-semibold focus:ring-4 focus:ring-green-500/20 focus:border-green-500 dark:text-white transition-all pr-10">
              <option value="">⚡ Absensi Otomatis (Sesuai Jadwal Aktif)</option>
              <option value="kegiatan">🕌 Kegiatan Asrama & Pesantren</option>
              <option value="madin">📖 Madrasah Diniyah (Madin)</option>
              <option value="quran">📘 Madrasah Al-Qur&apos;an (MQ)</option>
            </select>
            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* ── QR SCANNER ── */}
        {scanMode === 'qr' && (
          <>
            {!isScanning ? (
              <button onClick={startScanner}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-lg py-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3">
                <Camera size={26} /> Mulai Scan QR
              </button>
            ) : (
              <div ref={cameraContainerRef} className="space-y-3 animate-[zoomIn_0.3s_ease-out]">
                <div className="flex justify-between items-center bg-gray-900 p-3 rounded-t-2xl text-white">
                  <span className="font-bold text-sm flex items-center gap-2">
                    <Camera size={16} className="animate-pulse text-red-400" /> Arahkan ke QR / Barcode Kartu
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={switchCamera} disabled={isSwitchingCamera}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${isSwitchingCamera ? 'bg-gray-600 text-gray-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                      <FlipHorizontal size={14} className={isSwitchingCamera ? 'animate-spin' : ''} />
                      <span className="hidden sm:inline">{isSwitchingCamera ? 'Mengganti...' : facingMode === 'environment' ? 'Kamera Depan' : 'Kamera Belakang'}</span>
                    </button>
                    <button onClick={stopAll} className="bg-red-500 hover:bg-red-600 p-1.5 rounded-lg"><XCircle size={18} /></button>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 bg-gray-800 py-1.5 -mt-3">
                  <span className={`w-2 h-2 rounded-full ${facingMode === 'environment' ? 'bg-green-400' : 'bg-blue-400'}`} />
                  <span className="text-xs font-semibold text-gray-300">{facingMode === 'environment' ? '📷 Kamera Belakang' : '🤳 Kamera Depan'}</span>
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
                <div className="flex items-center gap-2 justify-center">
                  <Wifi size={14} className="text-gray-400" />
                  <p className="text-xs text-gray-500 italic">Pastikan pencahayaan cukup & QR Code tidak silau</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── FACE AI SCANNER ── */}
        {scanMode === 'face' && (
          <>
            {!isScanning ? (
              <button onClick={startScanner}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-lg py-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3">
                <ScanFace size={26} /> Mulai Scan Wajah AI
              </button>
            ) : (
              <div ref={cameraContainerRef} className="space-y-3 animate-[zoomIn_0.3s_ease-out]">
                <div className="flex justify-between items-center bg-gray-900 p-3 rounded-t-2xl text-white">
                  <span className="font-bold text-sm flex items-center gap-2">
                    <Brain size={16} className="text-violet-400 animate-pulse" /> Face AI — Scan Wajah
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${faceStatusColor[faceStatus]}`}>
                      {faceStatus === 'loading-models' && '⏳ Loading AI...'}{faceStatus === 'loading-db' && '📥 Loading DB...'}
                      {faceStatus === 'scanning' && '🟢 Aktif'}{faceStatus === 'detected' && '✅ Terdeteksi!'}{faceStatus === 'error' && '❌ Error'}
                    </span>
                    <button onClick={stopAll} className="bg-red-500 hover:bg-red-600 p-1.5 rounded-lg"><XCircle size={18} /></button>
                  </div>
                </div>

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

                <div className="relative rounded-b-2xl overflow-hidden border-2 border-violet-500 shadow-xl bg-black" style={{ minHeight: 300 }}>
                  {faceStatus === 'scanning' && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                      <div className="w-52 h-64 rounded-2xl border-4 border-violet-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                    </div>
                  )}
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"
                    style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                {faceStatus === 'scanning' && faceDbCount > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Users size={13} />
                      <span>Mencocokkan dengan <strong className="text-violet-400">{faceDbCount} santri</strong></span>
                    </div>
                    {/* Tombol "Wajah Tidak Cocok" saat scanning cukup lama */}
                    <button onClick={handleFaceNotFound}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1">
                      <UserPlus size={12} /> Daftarkan Wajah Baru
                    </button>
                  </div>
                )}

                {/* DETECTED RESULT */}
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
                      <button onClick={rejectAndRescan}
                        className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-red-900/60 text-red-300 border border-red-700/50 hover:bg-red-900 text-sm font-bold transition">
                        <XCircle size={16} /> Bukan Saya
                      </button>
                      <button onClick={confirmFaceAbsen} disabled={confirmPending}
                        className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition disabled:opacity-50">
                        {confirmPending ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : <><CheckCircle size={16} /> Ya, Absen Saya!</>}
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
          <><p className="font-bold text-sm mb-2">ℹ️ Cara Penggunaan (Mode QR):</p>
            <p>1. Pilih kategori absensi lalu klik &quot;Mulai Scan QR&quot;</p>
            <p>2. Arahkan ke QR/Barcode kartu santri atau guru</p>
            <p>3. Jika kartu belum terdaftar, klik <strong>&quot;Daftarkan Kartu Ini ke Santri&quot;</strong></p>
          </>
        ) : (
          <><p className="font-bold text-sm mb-2">ℹ️ Cara Penggunaan (Mode Face AI):</p>
            <p>1. Klik &quot;Mulai Scan Wajah AI&quot; — model dimuat otomatis</p>
            <p>2. Arahkan wajah ke kamera, deteksi terjadi dalam &lt;1 detik</p>
            <p>3. Jika wajah belum terdaftar, klik <strong>&quot;Daftarkan Wajah Baru&quot;</strong></p>
            <p>4. Absensi otomatis tercatat ke jadwal aktif & sinkron rekapitulasi ✅</p>
          </>
        )}
      </div>
    </div>
  );
}

// Suspense wrapper — wajib karena pakai useSearchParams
export default function ScanAbsenPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ScanAbsenInner />
    </Suspense>
  );
}

