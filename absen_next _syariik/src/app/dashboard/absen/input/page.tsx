'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Users, CheckCircle, XCircle, Clock, AlertTriangle, ArrowLeft, Save, Camera, Image, FlipHorizontal, X as XIcon } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import { Suspense } from 'react';

// ====== Avatar Lokal (tanpa service eksternal) ======
const AVATAR_COLORS = [
  '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#ea580c',
  '#0891b2', '#65a30d', '#7c3aed', '#db2777', '#059669',
  '#b45309', '#0284c7', '#be123c', '#4f46e5', '#0f766e',
];
const getInitials = (nama: string): string => {
  if (!nama) return '?';
  const words = nama.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return nama.substring(0, 2).toUpperCase();
};
const getAvatarColor = (nama: string): string => {
  if (!nama) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < nama.length; i++) {
    hash = nama.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getFotoUrl = (fotoName: string | null) => {
  if (!fotoName || fotoName === '-') return '';
  if (fotoName.startsWith('http://') || fotoName.startsWith('https://')) {
    return fotoName;
  }
  if (fotoName.startsWith('foto_') || fotoName.startsWith('upload_') || fotoName.startsWith('profil_')) {
    return `/uploads/${fotoName}`;
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_MITRA_FOTO_URL || 'https://mawar.smartpesantren.id/sekretariat/berkas/';
  const cleanFotoName = fotoName.startsWith('/') ? fotoName.substring(1) : fotoName;
  if (cleanFotoName.includes('sekretariat/berkas')) {
    return `https://mawar.smartpesantren.id/${cleanFotoName}`;
  }
  return `${baseUrl}${cleanFotoName}`;
};

function InputAbsenContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tipe = searchParams.get('tipe');
  const kelas_id = searchParams.get('kelas_id');
  const jadwal_id = searchParams.get('jadwal_id');

  const [murid, setMurid] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState('');
  const [namaTarget, setNamaTarget] = useState('Kelas/Kamar');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sudahAbsen, setSudahAbsen] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);

  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [cameraOrientation, setCameraOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!tipe || !kelas_id || !jadwal_id) {
      setErrorMsg('Parameter tidak lengkap');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/absen/input?tipe=${tipe}&kelas_id=${kelas_id}&jadwal_id=${jadwal_id}`);
        const json = await res.json();
        if (json.success) {
          setMurid(json.data);
          if (json.namaTarget) setNamaTarget(json.namaTarget);
          if (json.sudah_absen !== undefined) setSudahAbsen(json.sudah_absen);
        } else {
          setErrorMsg(json.error || 'Gagal memuat data santri');
        }
      } catch (err) {
        setErrorMsg('Terjadi kesalahan jaringan');
      } finally {
        setLoading(false);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          fetchData();
        },
        (err) => {
          console.error(err);
          setLocationError('Akses lokasi ditolak atau tidak tersedia. Anda wajib mengaktifkan GPS/Lokasi untuk melakukan absensi.');
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError('Browser Anda tidak mendukung deteksi lokasi.');
      setLoading(false);
    }
  }, [tipe, kelas_id, jadwal_id]);

  const handleStatusChange = (murid_id: number, status: string) => {
    setMurid(prev => prev.map(m => m.murid_id === murid_id ? { ...m, status } : m));
  };

  const handleKeteranganChange = (murid_id: number, keterangan: string) => {
    setMurid(prev => prev.map(m => m.murid_id === murid_id ? { ...m, keterangan } : m));
  };

  const handleNamaPanggilanChange = (murid_id: number, nama_panggilan: string) => {
    setMurid(prev => prev.map(m => m.murid_id === murid_id ? { ...m, nama_panggilan } : m));
  };

  const setAllStatus = (status: string) => {
    if (confirm(`Tandai semua santri sebagai ${status}?`)) {
      setMurid(prev => prev.map(m => ({ ...m, status })));
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const localUrl = URL.createObjectURL(file);
      setPhotoUrl(localUrl);
    } catch (err) {
      alert('Terjadi kesalahan saat memproses foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // --- Camera helpers ---
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    stopCameraStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert('Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan dan halaman diakses via HTTPS.');
      setShowCamera(false);
    }
  }, [stopCameraStream]);

  const openCamera = () => {
    setShowCamera(true);
    setTimeout(() => {
      startCamera(facingMode);
      const el = document.getElementById('camera-section-container');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 150);
  };

  const closeCamera = () => {
    stopCameraStream();
    setShowCamera(false);
  };

  const switchCamera = async () => {
    if (isSwitchingCamera) return;
    setIsSwitchingCamera(true);
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    await startCamera(newFacing);
    setIsSwitchingCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    let targetWidth = videoWidth;
    let targetHeight = videoHeight;
    
    if (cameraOrientation === 'portrait') {
      // Potret: rasio 3:4
      if (videoWidth > videoHeight) {
        targetWidth = (videoHeight * 3) / 4;
        targetHeight = videoHeight;
      } else {
        targetWidth = videoWidth;
        targetHeight = (videoWidth * 4) / 3;
        if (targetHeight > videoHeight) {
          targetHeight = videoHeight;
          targetWidth = (videoHeight * 3) / 4;
        }
      }
    } else {
      // Lanskap: rasio 4:3
      if (videoHeight > videoWidth) {
        targetWidth = videoWidth;
        targetHeight = (videoWidth * 3) / 4;
      } else {
        targetHeight = videoHeight;
        targetWidth = (videoHeight * 4) / 3;
        if (targetWidth > videoWidth) {
          targetWidth = videoWidth;
          targetHeight = (videoWidth * 3) / 4;
        }
      }
    }
    
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Potong dari pusat (center crop)
      const sx = (videoWidth - targetWidth) / 2;
      const sy = (videoHeight - targetHeight) / 2;
      ctx.drawImage(video, sx, sy, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight);
    }
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhotoUrl(dataUrl);
    closeCamera();
  };

  // Cleanup on unmount
  useEffect(() => { return () => stopCameraStream(); }, [stopCameraStream]);

  const generateWaGroupMessage = () => {
    const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const total = murid.length;
    const hadir = murid.filter(m => m.status === 'Hadir').length;
    const sakit = murid.filter(m => m.status === 'Sakit');
    const izin = murid.filter(m => m.status === 'Izin');
    const alpha = murid.filter(m => m.status === 'Alpha');

    let msg = `*LAPORAN KEHADIRAN ${namaTarget.toUpperCase()}*\n`;
    msg += `📅 *Hari/Tanggal:* ${dateStr}\n`;
    msg += `👥 *Total Santri:* ${total}\n`;
    msg += `✅ *Hadir:* ${hadir} anak\n\n`;

    if (sakit.length > 0) {
      msg += `🤒 *Sakit (${sakit.length}):*\n`;
      sakit.forEach((m, idx) => {
        const name = m.nama_panggilan || m.nama;
        msg += `  ${idx + 1}. ${name}${m.keterangan ? ` (${m.keterangan})` : ''}\n`;
      });
      msg += `\n`;
    }

    if (izin.length > 0) {
      msg += `✉️ *Izin (${izin.length}):*\n`;
      izin.forEach((m, idx) => {
        const name = m.nama_panggilan || m.nama;
        msg += `  ${idx + 1}. ${name}${m.keterangan ? ` (${m.keterangan})` : ''}\n`;
      });
      msg += `\n`;
    }

    if (alpha.length > 0) {
      msg += `❌ *Alpha/Tanpa Keterangan (${alpha.length}):*\n`;
      alpha.forEach((m, idx) => {
        const name = m.nama_panggilan || m.nama;
        msg += `  ${idx + 1}. ${name}${m.keterangan ? ` (${m.keterangan})` : ''}\n`;
      });
      msg += `\n`;
    }

    // Karena foto sekarang tidak diunggah ke server, kita tidak bisa menyematkan URL foto di teks WA
    // Foto akan otomatis dilampirkan oleh native share (jika didukung) atau dilewati.


    msg += `\n🔗 *Lihat Detail Absensi:* https://app.pptq.ppmawar.or.id/dashboard/absen\n`;
    msg += `\n_Diinput melalui Sistem Absensi Online PPTQ_\n_https://app.pptq.ppmawar.or.id_`;
    return msg;
  };

  const handleShareToWA = async () => {
    const text = generateWaGroupMessage();

    // Jika ada foto (dataUrl dari kamera atau blob URL dari upload), coba native share dulu
    if (photoUrl && navigator.canShare) {
      try {
        let filesArray: File[] = [];

        // Konversi dataUrl atau blob URL menjadi File object
        const response = await fetch(photoUrl);
        const blob = await response.blob();
        const mimeType = blob.type || 'image/jpeg';
        const ext = mimeType.split('/')[1] || 'jpg';
        const file = new File([blob], `foto_kehadiran_${Date.now()}.${ext}`, { type: mimeType });
        filesArray.push(file);

        const shareData: any = {
          title: `Laporan Kehadiran ${namaTarget}`,
          text: text,
          files: filesArray,
        };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      } catch (err: any) {
        // Jika error bukan karena dibatalkan user, coba fallback tanpa foto
        if (err?.name !== 'AbortError') {
          console.warn('Share dengan foto gagal, fallback tanpa foto:', err);
        } else {
          // User membatalkan — tidak perlu fallback
          return;
        }
      }
    }

    // Jika tidak ada foto atau native share tidak didukung, coba share teks saja
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Laporan Kehadiran ${namaTarget}`,
          text: text,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.warn('Share teks gagal, fallback ke URL:', err);
      }
    }

    // Fallback terakhir: buka WhatsApp Web / App
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleSave = async () => {
    if (!confirm('Simpan data absensi sekarang?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/absen/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipe,
          jadwal_id,
          absensi: murid.map(m => ({
            murid_id: m.murid_id,
            status: m.status,
            keterangan: m.keterangan,
            nama_panggilan: m.nama_panggilan
          })),
          lokasi_lat: location?.lat,
          lokasi_lng: location?.lng
        })
      });
      const data = await res.json();
      if (data.success) {
        setSudahAbsen(true);
        setIsSuccess(true);
      } else {
        alert('Gagal: ' + data.error);
      }
    } catch (err) {
      alert('Terjadi kesalahan saat menyimpan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-bold animate-pulse">Memuat data santri...</div>;

  if (isSuccess) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center bg-white dark:bg-gray-800 rounded-3xl mt-10 shadow-lg border border-gray-100 dark:border-gray-700 animate-[slideDown_0.3s_ease-out]">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={48} className="text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-800 dark:text-gray-200 mb-2">Absensi Berhasil Disimpan!</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Data kehadiran santri telah berhasil masuk ke sistem.</p>
        
        {/* Section: Ambil/Upload Foto */}
        <div id="camera-section-container" className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-150 dark:border-gray-750 mb-6 space-y-3 text-left">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <Camera size={18} className="text-indigo-600 dark:text-indigo-400 animate-pulse" />
            Foto Kehadiran Kelas/Kamar (Opsional)
          </label>

          {/* Camera live view */}
          {showCamera && (
            <div className="rounded-2xl overflow-hidden border-2 border-indigo-400 dark:border-indigo-600 bg-black relative mb-3">
              {/* Camera toolbar */}
              <div className="flex justify-between items-center bg-gray-900 px-3 py-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${facingMode === 'environment' ? 'bg-green-400' : 'bg-blue-400'}`} />
                  <span className="text-xs font-semibold text-gray-300">
                    {facingMode === 'environment' ? '📷 Kamera Belakang' : '🤳 Kamera Depan'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCameraOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait')}
                    className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
                  >
                    <span>{cameraOrientation === 'portrait' ? '📱 Potret' : '🌅 Lanskap'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={switchCamera}
                    disabled={isSwitchingCamera}
                    title={facingMode === 'environment' ? 'Ganti ke Kamera Depan' : 'Ganti ke Kamera Belakang'}
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
                    type="button"
                    onClick={closeCamera}
                    className="bg-red-500 hover:bg-red-650 p-1.5 rounded-lg transition-colors"
                    aria-label="Tutup Kamera"
                  >
                    <XIcon size={16} className="text-white" />
                  </button>
                </div>
              </div>
              {/* Video preview */}
              <div className="relative min-h-[240px] bg-black">
                {isSwitchingCamera && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 gap-2">
                    <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-white text-xs font-semibold">Mengganti kamera...</span>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full object-cover transition-all ${
                    cameraOrientation === 'portrait' ? 'aspect-[3/4] max-h-[480px]' : 'aspect-[4/3] max-h-[360px]'
                  }`}
                />
              </div>
              {/* Capture button */}
              <div className="flex justify-center bg-gray-900 py-3 px-4">
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="bg-white hover:bg-gray-100 active:scale-95 text-gray-900 font-bold px-8 py-2.5 rounded-full shadow-lg transition-all flex items-center gap-2 text-sm"
                >
                  <Camera size={16} /> Ambil Foto
                </button>
              </div>
            </div>
          )}

          {/* Canvas (hidden) for snapshot */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Buttons side-by-side full width */}
          <div className="grid grid-cols-2 gap-3 w-full">
            {!showCamera ? (
              <button
                type="button"
                onClick={openCamera}
                className="w-full cursor-pointer bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold py-3.5 rounded-xl border border-indigo-200 dark:border-indigo-850 text-xs transition-all flex items-center justify-center gap-2"
              >
                <Camera size={16} />
                {photoUrl ? 'Ambil Ulang' : 'Buka Kamera'}
              </button>
            ) : (
              <div className="w-full" />
            )}

            <div className="w-full">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                id="presence-photo-input"
              />
              <label
                htmlFor="presence-photo-input"
                className="w-full cursor-pointer bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-750 dark:text-gray-250 font-bold py-3.5 rounded-xl border border-gray-200 dark:border-gray-650 text-xs transition-all flex items-center justify-center gap-2 text-center block"
              >
                <Image size={16} /> Upload File
              </label>
            </div>
          </div>

          {photoUrl && (
            <div className="mt-3 relative w-full h-48 rounded-xl overflow-hidden border-2 border-indigo-200 dark:border-indigo-700 shadow-sm animate-in fade-in duration-300">
              <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotoUrl('')}
                className="absolute top-2 right-2 bg-red-650 hover:bg-red-750 text-white rounded-full p-1.5 shadow-md transition-colors w-7 h-7 flex items-center justify-center"
              >
                <XIcon size={14} />
              </button>
            </div>
          )}

          <p className="text-[10px] text-gray-400 font-medium text-center">
            Gunakan tombol <strong>Buka Kamera</strong> untuk foto langsung, atau <strong>Upload File</strong> jika ingin memilih dari galeri.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleShareToWA}
            type="button"
            className="w-full bg-[#128C7E] hover:bg-[#075E54] text-white px-6 py-4 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
          >
            Kirim Laporan & Foto ke Grup WA
          </button>
          <Link href={`/dashboard/notifikasi?kegiatan=${tipe}&kelas=${kelas_id}`} className="block w-full bg-[#25D366] hover:bg-[#1DA851] text-white px-6 py-4 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md flex items-center justify-center gap-2">
            Lanjut Kirim Pesan WA Wali Murid
          </Link>
          <Link href="/dashboard/absen" className="block w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-4 rounded-xl font-bold transition-colors">
            Kembali ke Jadwal
          </Link>
        </div>
      </div>
    );
  }

  if (errorMsg || locationError) return (
    <div className="max-w-3xl mx-auto p-6 text-center bg-red-50 dark:bg-red-900/20 rounded-3xl mt-10">
      <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
      <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Akses Ditolak</h2>
      <p className="text-red-600 dark:text-red-300 mb-6">{errorMsg || locationError}</p>
      {locationError && (
        <p className="text-sm text-red-500 mb-6 font-bold">
          Deteksi lokasi diwajibkan untuk menjaga ketertiban absensi. Pastikan fitur Lokasi / GPS di HP Anda menyala dan Anda mengizinkan browser mengakses lokasi.
        </p>
      )}
      <Link href="/dashboard/absen" className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold">Kembali</Link>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-indigo-900/40 dark:to-blue-900/40 rounded-3xl p-6 shadow-sm border border-indigo-200 dark:border-indigo-800/50 relative overflow-hidden transition-colors">
        <Link href="/dashboard/absen" className="absolute top-4 left-4 p-2 bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 rounded-full transition-colors z-20">
          <ArrowLeft size={20} className="text-indigo-800 dark:text-indigo-200" />
        </Link>
        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-indigo-200/50 dark:text-indigo-800/30">
          <Users size={120} />
        </div>
        <div className="relative z-10 mt-8">
          <h1 className="text-2xl font-extrabold text-indigo-800 dark:text-indigo-400 drop-shadow-sm flex items-center gap-2">
            Input Absensi: {namaTarget}
          </h1>
          <p className="text-indigo-600 dark:text-indigo-300 text-sm mt-1 font-medium max-w-md">
            Silakan centang kehadiran santri di bawah ini.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full mb-4 animate-in fade-in duration-300">
        <button
          onClick={() => setAllStatus('Alpha')}
          className="w-full text-center py-3 bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900/30 dark:text-red-400 font-extrabold rounded-xl transition-all text-xs"
        >
          Semua Absen
        </button>
        <button
          onClick={() => setAllStatus('Hadir')}
          className="w-full text-center py-3 bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900/30 dark:text-green-400 font-extrabold rounded-xl transition-all text-xs"
        >
          Semua Hadir
        </button>
      </div>

      {/* Tampilan Desktop (Tabel) */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-4 py-4 w-10 text-center">NO</th>
                <th className="px-4 py-4">NAMA SANTRI</th>
                <th className="px-4 py-4">NAMA PANGGILAN</th>
                <th className="px-4 py-4 text-center">KEHADIRAN</th>
                <th className="px-4 py-4">KETERANGAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {murid.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">Tidak ada data santri di kelas ini.</td></tr>
              ) : (
                murid.map((item, index) => (
                  <tr key={item.murid_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-center text-gray-400 font-medium">{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full overflow-hidden relative shrink-0 ${item.foto && item.foto !== '-' ? 'cursor-pointer hover:opacity-80' : ''}`}
                          onClick={() => item.foto && item.foto !== '-' ? setZoomPhoto(getFotoUrl(item.foto)) : null}
                        >
                          <div
                            className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: getAvatarColor(item.nama) }}
                          >
                            <span>{getInitials(item.nama)}</span>
                          </div>
                          {item.foto && item.foto !== '-' && (
                            <img
                              src={getFotoUrl(item.foto)}
                              alt={item.nama}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.display = 'none'; e.currentTarget.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; }}
                            />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white">{item.nama}</div>
                          <div className="text-xs text-gray-400 font-mono flex flex-col gap-0.5">
                            <span>NIS: {item.nis || '-'}</span>
                            {item.alamat && (
                              <span className="text-[10px] text-gray-500 max-w-[250px] truncate block" title={item.alamat}>
                                Alamat: {item.alamat}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="Panggilan..."
                        value={item.nama_panggilan || ''}
                        onChange={(e) => handleNamaPanggilanChange(item.murid_id, e.target.value)}
                        className="w-full max-w-[120px] px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700 dark:text-indigo-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex bg-gray-100 dark:bg-gray-900 rounded-lg p-1 gap-1">
                        {['Hadir', 'Izin', 'Sakit', 'Alpha'].map(status => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => handleStatusChange(item.murid_id, status)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                              item.status === status 
                                ? status === 'Hadir' ? 'bg-green-500 text-white shadow-sm'
                                : status === 'Izin' ? 'bg-blue-500 text-white shadow-sm'
                                : status === 'Sakit' ? 'bg-orange-500 text-white shadow-sm'
                                : 'bg-red-500 text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="Catatan..."
                        value={item.keterangan || ''}
                        onChange={(e) => handleKeteranganChange(item.murid_id, e.target.value)}
                        className="w-full min-w-[150px] px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                        disabled={item.status === 'Hadir'}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tampilan Mobile (Kartu Bertumpuk) */}
      <div className="block md:hidden space-y-4">
        {murid.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center text-gray-500 border border-gray-100 dark:border-gray-700">Tidak ada data santri di kelas ini.</div>
        ) : (
          murid.map((item, index) => (
            <div key={item.murid_id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3.5">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full overflow-hidden relative shrink-0 ${item.foto && item.foto !== '-' ? 'cursor-pointer hover:opacity-80' : ''}`}
                  onClick={() => item.foto && item.foto !== '-' ? setZoomPhoto(getFotoUrl(item.foto)) : null}
                >
                  <div
                    className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: getAvatarColor(item.nama) }}
                  >
                    <span>{getInitials(item.nama)}</span>
                  </div>
                  {item.foto && item.foto !== '-' && (
                    <img
                      src={getFotoUrl(item.foto)}
                      alt={item.nama}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.display = 'none'; e.currentTarget.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; }}
                    />
                  )}
                </div>
                <div>
                  <div className="font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5 leading-tight">
                    <span className="text-gray-400 text-xs font-semibold">{index + 1}.</span>
                    {item.nama}
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5 flex flex-col gap-0.5">
                    <span>NIS: {item.nis || '-'}</span>
                    {item.alamat && (
                      <span className="text-[10px] text-gray-500 max-w-[200px] truncate block" title={item.alamat}>
                        Alamat: {item.alamat}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Input Nama Panggilan Mobile */}
              <div className="flex items-center gap-2" style={{ marginLeft: '3.25rem' }}>
                <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 font-medium">Nama Panggilan:</span>
                <input
                  type="text"
                  placeholder="Panggilan..."
                  value={item.nama_panggilan || ''}
                  onChange={(e) => handleNamaPanggilanChange(item.murid_id, e.target.value)}
                  className="w-full max-w-[180px] px-2.5 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700 dark:text-indigo-300"
                />
              </div>

              {/* Grid Status Kehadiran Mobile */}
              <div className="grid grid-cols-4 gap-1.5 bg-gray-100 dark:bg-gray-900 rounded-xl p-1">
                {['Hadir', 'Izin', 'Sakit', 'Alpha'].map(status => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleStatusChange(item.murid_id, status)}
                    className={`py-2 text-xs font-bold rounded-lg transition-all text-center ${
                      item.status === status 
                        ? status === 'Hadir' ? 'bg-green-500 text-white shadow-sm'
                        : status === 'Izin' ? 'bg-blue-500 text-white shadow-sm'
                        : status === 'Sakit' ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-red-500 text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* Catatan (hanya jika bukan Hadir) */}
              {item.status !== 'Hadir' && (
                <div className="ml-0.5">
                  <input
                    type="text"
                    placeholder="Masukkan catatan (alasan izin/sakit/keterangan)..."
                    value={item.keterangan || ''}
                    onChange={(e) => handleKeteranganChange(item.murid_id, e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="fixed bottom-16 sm:bottom-0 left-0 w-full bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm font-bold text-gray-600 dark:text-gray-300">
            Total Hadir: <span className="text-green-600 dark:text-green-400">{murid.filter(m => m.status === 'Hadir').length}</span> / {murid.length}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || murid.length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {saving ? (
              <Clock className="animate-spin" size={20} />
            ) : (
              <Save size={20} />
            )}
            {saving 
              ? (sudahAbsen ? 'Memperbarui...' : 'Menyimpan...') 
              : (sudahAbsen ? 'Perbarui Absensi' : 'Simpan Absensi')
            }
          </button>
        </div>
      </div>
      {/* Zoom Photo Modal */}
      {zoomPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm cursor-zoom-out" onClick={() => setZoomPhoto(null)}>
          <div className="relative max-w-4xl max-h-[90vh] flex items-center justify-center animate-in zoom-in duration-200">
            <img src={zoomPhoto} alt="Zoomed" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" />
            <button className="absolute -top-4 -right-4 bg-white text-black rounded-full w-8 h-8 flex items-center justify-center font-bold hover:scale-110 transition-transform">X</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InputAbsenDetailPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-500 font-bold animate-pulse">Memuat halaman...</div>}>
      <InputAbsenContent />
    </Suspense>
  );
}
