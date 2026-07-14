'use client';

import { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle, XCircle, QrCode, Shield, Wifi, RefreshCw, ChevronDown, FlipHorizontal } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

export default function ScanAbsenPage() {
  const [kegiatanList, setKegiatanList] = useState<string[]>([]);
  const [selectedKegiatan, setSelectedKegiatan] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [isHttpWarning, setIsHttpWarning] = useState(false);
  const [popup, setPopup] = useState<{ type: 'success' | 'error' | 'warning', title: string, text: string } | null>(null);
  const [lastScan, setLastScan] = useState<{ nama: string; waktu: string } | null>(null);
  
  // Kamera: 'environment' = kamera belakang (default), 'user' = kamera depan
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const cameraContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isHttps = window.location.protocol === 'https:';
      if (!isLocalhost && !isHttps) {
        setIsHttpWarning(true);
      }
    }

    fetch('/api/kegiatan/list')
      .then(res => res.json())
      .then(data => { if (data.success) setKegiatanList(data.kegiatan); })
      .catch(console.error);
  }, []);

  // Helper: hentikan scanner yang sedang berjalan
  const stopScannerInternal = async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        // State 2 = SCANNING, State 3 = PAUSED
        if (state === 2 || state === 3) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Gagal menghentikan scanner:', e);
      }
      html5QrCodeRef.current = null;
    }
  };

  // Helper: mulai scanner dengan facingMode tertentu
  const startScannerInternal = async (facing: 'environment' | 'user') => {
    try {
      // Pastikan elemen #reader tersedia di DOM
      const readerEl = document.getElementById('reader');
      if (!readerEl) return;

      html5QrCodeRef.current = new Html5Qrcode('reader');
      await html5QrCodeRef.current.start(
        { facingMode: facing },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => {
          stopScanner();
          handleScan(decodedText);
        },
        () => { /* Abaikan error tiap frame */ }
      );
    } catch (err) {
      console.error('Inisialisasi kamera gagal:', err);
      setIsScanning(false);
      setPopup({
        type: 'error',
        title: 'Akses Kamera Gagal',
        text: 'Kamera tidak ditemukan atau izin belum diberikan. Pastikan Anda mengakses via HTTPS dan sudah mengizinkan kamera.'
      });
    }
  };

  // Efek: jalankan scanner saat isScanning berubah menjadi true
  useEffect(() => {
    if (isScanning) {
      // Tunggu sebentar agar DOM (elemen #reader) selesai dirender
      const timer = setTimeout(() => {
        startScannerInternal(facingMode);
      }, 150);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning]);

  const startScanner = () => {
    if (typeof window === 'undefined') return;
    setIsScanning(true);
    setTimeout(() => {
      cameraContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const stopScanner = () => {
    setIsScanning(false);
    stopScannerInternal();
  };

  // Toggle antara kamera depan dan belakang
  const switchCamera = async () => {
    if (isSwitchingCamera) return;
    setIsSwitchingCamera(true);
    
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    
    // Hentikan kamera yang sedang berjalan
    await stopScannerInternal();
    setFacingMode(newFacing);
    
    // Tunggu sebentar lalu mulai kembali dengan kamera baru
    setTimeout(async () => {
      await startScannerInternal(newFacing);
      setIsSwitchingCamera(false);
    }, 400);
  };

  // Cleanup saat komponen di-unmount
  useEffect(() => {
    return () => { stopScannerInternal(); };
  }, []);

  const handleScan = async (barcodeData: string) => {
    try {
      const res = await fetch('/api/scan-absen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcodeData, nama_kegiatan: selectedKegiatan })
      });
      const data = await res.json();
      
      const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      if (data.success) {
        const namaMatch = data.message.match(/✅ (.+?) \(/);
        const nama = namaMatch ? namaMatch[1] : 'Santri/Guru';
        setLastScan({ nama, waktu: now });
        setPopup({ type: 'success', title: 'Absen Berhasil! ✅', text: data.message });
      } else {
        setPopup({ type: 'warning', title: 'Kartu Tidak Dikenal', text: data.message });
      }
    } catch (err) {
      setPopup({ type: 'error', title: 'Koneksi Gagal', text: 'Koneksi ke server terputus. Periksa jaringan Anda.' });
    }
  };

  const dismissAndRescan = () => {
    setPopup(null);
    setTimeout(() => startScanner(), 300);
  };

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-24 animate-[fadeIn_0.5s_ease-out]">
      {/* Popup Modal */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
              popup.type === 'success' ? 'bg-green-100 dark:bg-green-900/50 text-green-600' 
              : popup.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600' 
              : 'bg-red-100 dark:bg-red-900/50 text-red-600'
            }`}>
              {popup.type === 'success' 
                ? <CheckCircle size={40} /> 
                : <XCircle size={40} />}
            </div>
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

      {/* Header */}
      <div className="bg-gradient-to-br from-green-700 via-emerald-700 to-teal-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -top-8 -right-8 opacity-10">
          <QrCode size={160} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 p-2.5 rounded-xl">
              <QrCode size={24} />
            </div>
            <h1 className="text-xl font-extrabold">Scan Absen Asrama</h1>
          </div>
          <p className="text-green-200 text-sm">Scan kartu QR santri/pengurus untuk absensi otomatis.</p>
          
          {lastScan && (
            <div className="mt-4 bg-white/15 backdrop-blur-sm rounded-2xl p-3 flex items-center gap-3">
              <CheckCircle size={20} className="text-green-300 flex-shrink-0" />
              <div>
                <p className="text-xs text-green-200">Terakhir di-scan:</p>
                <p className="font-bold text-sm">{lastScan.nama} — <span className="font-normal text-green-200">{lastScan.waktu}</span></p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Warning HTTP */}
      {isHttpWarning && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-200 dark:border-amber-700 rounded-2xl p-4 flex gap-3">
          <Shield size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-800 dark:text-amber-300 text-sm">Akses Kamera Dibatasi</p>
            <p className="text-amber-700 dark:text-amber-400 text-xs mt-1 leading-relaxed">
              Kamera hanya bisa dibuka via <strong>https://</strong> atau localhost. Setelah di-deploy ke domain cPanel dengan SSL, kamera akan langsung bisa digunakan.
            </p>
          </div>
        </div>
      )}

      {/* Pilih Kegiatan + Tombol Scan */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            Pilih Jenis Kegiatan
          </label>
          <div className="relative">
            <select
              value={selectedKegiatan}
              onChange={(e) => setSelectedKegiatan(e.target.value)}
              disabled={isScanning}
              className="w-full appearance-none p-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl font-semibold focus:ring-4 focus:ring-green-500/20 focus:border-green-500 dark:text-white transition-all pr-10"
            >
              <option value="">📋 Absensi Harian & Kegiatan (Otomatis)</option>
              {kegiatanList.map(k => (
                <option key={k} value={k}>🕌 {k}</option>
              ))}
            </select>
            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {!isScanning ? (
          <button
            onClick={startScanner}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-lg py-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            <Camera size={26} />
            Buka Kamera & Mulai Scan
          </button>
        ) : (
          <div ref={cameraContainerRef} className="space-y-3 animate-[zoomIn_0.3s_ease-out]">
            {/* Header kamera */}
            <div className="flex justify-between items-center bg-gray-900 dark:bg-black p-3 rounded-t-2xl text-white">
              <span className="font-bold text-sm flex items-center gap-2">
                <Camera size={16} className="animate-pulse text-red-400" />
                Arahkan ke QR Code Kartu
              </span>
              <div className="flex items-center gap-2">
                {/* Tombol Toggle Kamera Depan/Belakang */}
                <button
                  onClick={switchCamera}
                  disabled={isSwitchingCamera}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                    isSwitchingCamera
                      ? 'bg-gray-600 text-gray-400 cursor-wait'
                      : 'bg-blue-600 hover:bg-blue-500 active:scale-95 text-white'
                  }`}
                  title={facingMode === 'environment' ? 'Ganti ke Kamera Depan' : 'Ganti ke Kamera Belakang'}
                >
                  <FlipHorizontal size={14} className={isSwitchingCamera ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline">
                    {isSwitchingCamera ? 'Mengganti...' : facingMode === 'environment' ? 'Kamera Depan' : 'Kamera Belakang'}
                  </span>
                </button>
                {/* Tombol Tutup Kamera */}
                <button 
                  onClick={stopScanner} 
                  className="bg-red-500 hover:bg-red-600 p-1.5 rounded-lg transition-colors"
                  aria-label="Tutup Kamera"
                >
                  <XCircle size={18} />
                </button>
              </div>
            </div>

            {/* Indikator kamera aktif */}
            <div className="flex items-center justify-center gap-2 bg-gray-800 py-1.5 -mt-3">
              <span className={`w-2 h-2 rounded-full ${facingMode === 'environment' ? 'bg-green-400' : 'bg-blue-400'}`} />
              <span className="text-xs font-semibold text-gray-300">
                {facingMode === 'environment' ? '📷 Kamera Belakang' : '🤳 Kamera Depan'}
              </span>
            </div>

            {/* Area Kamera */}
            <div className="rounded-b-2xl overflow-hidden border-2 border-green-500 shadow-xl bg-black min-h-[300px] relative">
              {isSwitchingCamera && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 gap-3">
                  <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-white text-sm font-semibold">Mengganti kamera...</span>
                </div>
              )}
              <div id="reader" className="w-full h-full"></div>
            </div>

            <div className="flex items-center gap-2 text-center justify-center">
              <Wifi size={14} className="text-gray-400" />
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">Pastikan pencahayaan cukup & QR Code tidak silau</p>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-4 text-xs text-blue-700 dark:text-blue-300 space-y-1">
        <p className="font-bold text-sm mb-2">ℹ️ Cara Penggunaan:</p>
        <p>1. Pilih jenis kegiatan (atau biarkan default untuk absensi otomatis)</p>
        <p>2. Klik <strong>"Buka Kamera"</strong> lalu arahkan ke QR Code di kartu</p>
        <p>3. Scanner akan otomatis mendeteksi & menyimpan absensi</p>
        <p>4. Klik <strong>"Scan Berikutnya"</strong> untuk lanjut ke santri berikutnya</p>
        <p className="mt-1 text-blue-600 dark:text-blue-400">📱 Gunakan tombol <strong>Kamera Depan/Belakang</strong> untuk beralih antar kamera</p>
      </div>
    </div>
  );
}
