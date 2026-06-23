'use client';

import { useState, useEffect, useRef } from 'react';
import { Camera, Save, XCircle, Search, CheckCircle } from 'lucide-react';
import Script from 'next/script';
import { Html5Qrcode } from 'html5-qrcode';

export default function PairingKartuPage() {
  const [nis, setNis] = useState('');
  const [scanResult, setScanResult] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{type: 'success'|'error'|'warning', title: string, text: string} | null>(null);
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (isScanning) {
      const initScanner = async () => {
        try {
          if (!html5QrCodeRef.current) {
            html5QrCodeRef.current = new Html5Qrcode("reader");
          }
          await html5QrCodeRef.current.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
            async (decodedText) => {
              stopScanner();
              setScanResult(decodedText);
              await handleSavePairing(nis, decodedText);
            },
            () => {
              // Abaikan error pada tiap frame scan
            }
          );
        } catch (err) {
          console.error(err);
          setIsScanning(false);
          setPopup({ type: 'error', title: 'Akses Kamera Gagal', text: 'Kamera tidak ditemukan atau izin belum diberikan. Pastikan menggunakan https.' });
        }
      };
      
      initScanner();
    }
  }, [isScanning, nis]);

  // Fungsi untuk memulai kamera scan
  const startScanner = async () => {
    if (!nis) {
      setPopup({ type: 'warning', title: 'Peringatan', text: 'Harap isi NIS Santri terlebih dahulu!' });
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
      }).catch(err => {
        console.error("Gagal menghentikan scanner", err);
      });
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleSavePairing = async (santriNis: string, barcodeKode: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nis: santriNis, barcode_id: barcodeKode })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        // Mainkan suara sukses singkat
        try {
          const audio = new Audio('/success-beep.mp3'); // Opsional jika punya file audio
          audio.play().catch(()=>console.log('Audio error'));
        } catch(e){}

        setPopup({ type: 'success', title: 'Berhasil!', text: `Kartu berhasil dipasangkan untuk santri: ${data.murid.nama}` });
        setNis(''); // Kosongkan NIS agar siap untuk santri berikutnya
      } else {
        // Cek jika error karena barcode sudah terdaftar untuk santri lain
        if (data.error && data.error.includes('sudah terdaftar')) {
           setPopup({ type: 'warning', title: 'Kartu Sudah Terdaftar', text: data.error });
        } else {
           setPopup({ type: 'error', title: 'Gagal Menyimpan', text: data.error || 'Terjadi kesalahan saat memproses data.' });
        }
      }
    } catch (err) {
      setPopup({ type: 'error', title: 'Koneksi Gagal', text: 'Koneksi ke server terputus. Periksa jaringan Anda.' });
    } finally {
      setLoading(false);
    }
  };

  // Keyboard shortcut: Tekan Enter untuk langsung mulai scan jika NIS sudah terisi
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      startScanner();
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-20 animate-[fadeIn_0.5s_ease-out]">
      {/* Script External Scanner PWA */}
      <Script src="https://unpkg.com/html5-qrcode" strategy="lazyOnload" />

      {/* Popup Notification Modal */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center transform animate-[zoomIn_0.3s_ease-out]">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${popup.type === 'success' ? 'bg-green-100 text-green-600' : popup.type === 'warning' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
              {popup.type === 'success' ? <CheckCircle size={32} /> : popup.type === 'warning' ? <XCircle size={32} className="text-yellow-600" /> : <XCircle size={32} />}
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{popup.title}</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-6 leading-relaxed">{popup.text}</p>
            <button onClick={() => setPopup(null)} className={`w-full py-3 rounded-xl font-bold text-white transition-transform active:scale-95 ${popup.type === 'success' ? 'bg-green-600 hover:bg-green-700' : popup.type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-red-600 hover:bg-red-700'}`}>
              Oke, Mengerti
            </button>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-indigo-700 to-purple-800 rounded-3xl p-6 text-white shadow-lg text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 opacity-20">
          <Camera size={150} />
        </div>
        <div className="relative z-10">
          <h1 className="text-2xl font-extrabold flex items-center justify-center gap-2 drop-shadow-md font-theme-hero">
            <Camera size={28} /> Pairing Kartu Santri
          </h1>
          <p className="text-indigo-200 mt-2 text-sm font-medium">
            Ketik NIS Santri, lalu Scan QR Card untuk mendaftarkan kartu secara instan.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
        
        {/* Step 1: Input NIS */}
        <div className={`transition-opacity duration-300 ${isScanning ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            1. Masukkan Nomor Induk Santri (NIS)
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Contoh: 20210112"
              value={nis}
              onChange={(e) => setNis(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl text-lg font-bold focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white transition-all shadow-inner"
              autoFocus
            />
          </div>
        </div>

        {/* Step 2: Tombol Scan atau Area Kamera */}
        {!isScanning ? (
          <button 
            onClick={startScanner}
            disabled={!nis || loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold text-lg py-4 rounded-2xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
          >
            <Camera size={24} /> {loading ? 'Memproses...' : 'Mulai Scan Kartu'}
          </button>
        ) : (
          <div className="space-y-4 animate-[zoomIn_0.3s_ease-out]">
            <div className="flex justify-between items-center bg-gray-900 p-3 rounded-t-2xl text-white">
              <span className="font-bold flex items-center gap-2"><Camera size={18} className="animate-pulse text-red-500"/> Arahkan Kamera ke Kartu</span>
              <button onClick={stopScanner} className="bg-red-500 hover:bg-red-600 p-1.5 rounded-lg transition-colors">
                <XCircle size={18} />
              </button>
            </div>
            
            {/* Tempat Render Kamera Html5-Qrcode */}
            <div className="rounded-b-2xl overflow-hidden border-2 border-indigo-500 shadow-xl relative bg-black min-h-[300px]">
              <div id="reader" className="w-full h-full"></div>
            </div>
            <p className="text-center text-xs text-gray-500 italic">Pastikan pencahayaan cukup dan kode QR tidak silau.</p>
          </div>
        )}

        {/* Info Scan Result Sementara (Debugging) */}
        {scanResult && !isScanning && !loading && popup?.type !== 'success' && (
           <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded-xl text-xs font-mono text-gray-500 break-all">
             Kode Terbaca: {scanResult}
           </div>
        )}

      </div>
    </div>
  );
}
