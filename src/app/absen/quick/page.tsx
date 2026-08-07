'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, Send, Sparkles, QrCode, Brain, X, User, MapPin, Camera, Image as ImageIcon, FlipHorizontal } from 'lucide-react';
import Link from 'next/link';

// Avatar & Photo helper
const AVATAR_COLORS = [
  '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#ea580c',
  '#0891b2', '#65a30d', '#7c3aed', '#db2777', '#059669',
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
  if (fotoName.startsWith('http://') || fotoName.startsWith('https://')) return fotoName;
  if (fotoName.startsWith('foto_') || fotoName.startsWith('upload_') || fotoName.startsWith('profil_')) {
    return `/uploads/${fotoName}`;
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_MITRA_FOTO_URL || 'https://mawar.smartpesantren.id/sekretariat/berkas/';
  const cleanFotoName = fotoName.startsWith('/') ? fotoName.substring(1) : fotoName;
  if (cleanFotoName.includes('sekretariat/berkas')) return `https://mawar.smartpesantren.id/${cleanFotoName}`;
  return `${baseUrl}${cleanFotoName}`;
};

function QuickAbsenContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [kehadiran, setKehadiran] = useState<{ [muridId: number]: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);

  // Camera & Photo Upload States
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraOrientation, setCameraOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const startCamera = async (mode: 'user' | 'environment') => {
    stopCameraStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: mode } }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode }
        });
        mediaStreamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play();
        }
      } catch (e: any) {
        alert('Gagal membuka kamera: ' + (e.message || 'Kamera tidak diizinkan'));
        setShowCamera(false);
      }
    }
  };

  const openCamera = () => {
    setShowCamera(true);
    setTimeout(() => {
      startCamera(facingMode);
    }, 200);
  };

  const closeCamera = () => {
    stopCameraStream();
    setShowCamera(false);
  };

  const switchCamera = async () => {
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
      const sx = (videoWidth - targetWidth) / 2;
      const sy = (videoHeight - targetHeight) / 2;
      ctx.drawImage(video, sx, sy, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhotoUrl(dataUrl);
    closeCamera();
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => { return () => stopCameraStream(); }, [stopCameraStream]);

  const generateWaGroupMessage = (uploadedPhotoUrl?: string) => {
    if (!data) return '';
    const dateStr = data.date || new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const listMurid: any[] = data.murid || [];
    const total = listMurid.length;

    const hadir = listMurid.filter(m => (kehadiran[m.murid_id] || 'hadir') === 'hadir').length;
    const sakit = listMurid.filter(m => (kehadiran[m.murid_id] || 'hadir') === 'sakit');
    const izin = listMurid.filter(m => (kehadiran[m.murid_id] || 'hadir') === 'izin');
    const alpha = listMurid.filter(m => (kehadiran[m.murid_id] || 'hadir') === 'alpha');

    const namaKelas = data.jadwal?.nama_kelas || 'Kelas';

    let msg = `*LAPORAN KEHADIRAN ${namaKelas.toUpperCase()}*\n`;
    msg += `📅 *Hari/Tanggal:* ${dateStr}\n`;
    msg += `👥 *Total Santri:* ${total}\n`;
    msg += `✅ *Hadir:* ${hadir} anak\n\n`;

    if (sakit.length > 0) {
      msg += `🤒 *Sakit (${sakit.length}):*\n`;
      sakit.forEach((m, idx) => {
        const name = m.nama_panggilan || m.nama;
        msg += `  ${idx + 1}. ${name}\n`;
      });
      msg += `\n`;
    }

    if (izin.length > 0) {
      msg += `✉️ *Izin (${izin.length}):*\n`;
      izin.forEach((m, idx) => {
        const name = m.nama_panggilan || m.nama;
        msg += `  ${idx + 1}. ${name}\n`;
      });
      msg += `\n`;
    }

    if (alpha.length > 0) {
      msg += `❌ *Alpha/Tanpa Keterangan (${alpha.length}):*\n`;
      alpha.forEach((m, idx) => {
        const name = m.nama_panggilan || m.nama;
        msg += `  ${idx + 1}. ${name}\n`;
      });
      msg += `\n`;
    }

    if (uploadedPhotoUrl) {
      msg += `📷 *Foto Kehadiran:* ${uploadedPhotoUrl}\n\n`;
    }

    msg += `_Diinput via Quick Absen Online PPMA_\n_https://app.ppmawar.or.id_`;
    return msg;
  };

  const handleShareToWA = async () => {
    let fileToShare: File | null = null;
    let serverPhotoUrl: string | null = null;

    if (photoUrl) {
      try {
        if (photoUrl.startsWith('data:')) {
          const res = await fetch(photoUrl);
          const blob = await res.blob();
          fileToShare = new File([blob], `foto_kehadiran_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
        } else if (photoUrl.startsWith('http')) {
          serverPhotoUrl = photoUrl;
          const res = await fetch(photoUrl);
          const blob = await res.blob();
          fileToShare = new File([blob], `foto_kehadiran_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
        }
      } catch (err) {
        console.warn('Error preparing photo file:', err);
      }
    }

    const textWithoutPhoto = generateWaGroupMessage();

    // 1. Coba Native Web Share API (Di HP/WhatsApp Mobile, ini melampirkan file FOTO langsung ke WhatsApp)
    if (fileToShare && typeof navigator !== 'undefined' && (navigator as any).canShare && (navigator as any).canShare({ files: [fileToShare] })) {
      try {
        await navigator.share({
          title: `LAPORAN KEHADIRAN ${(data?.jadwal?.nama_kelas || '').toUpperCase()}`,
          text: textWithoutPhoto,
          files: [fileToShare],
        });
        return;
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') return; // User membatalkan dialog share
        console.warn('Web Share API gagal, lanjut ke fallback URL:', shareErr);
      }
    }

    // 2. Fallback untuk Desktop/Browser tanpa Web Share API file: Unggah foto ke server agar mendapatkan tautan gambar publik
    if (photoUrl && photoUrl.startsWith('data:') && !serverPhotoUrl) {
      try {
        if (fileToShare) {
          const formData = new FormData();
          formData.append('file', fileToShare);
          const upRes = await fetch('/api/upload', { method: 'POST', body: formData });
          const upData = await upRes.json();
          if (upData.success && upData.url) {
            const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.ppmawar.or.id';
            serverPhotoUrl = `${origin}${upData.url}`;
          }
        }
      } catch (e) {
        console.warn('Failed to upload photo for link sharing:', e);
      }
    }

    const finalMessage = generateWaGroupMessage(serverPhotoUrl || (photoUrl && photoUrl.startsWith('http') ? photoUrl : undefined));
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(finalMessage)}`;
    window.open(waUrl, '_blank');
  };

  useEffect(() => {
    if (!token) {
      setError('Token absensi tidak ditemukan. Silakan klik link dari pesan WhatsApp kembali.');
      setLoading(false);
      return;
    }

    fetch('/api/absen/quick-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
      .then(res => res.json())
      .then(res => {
        if (!res.success) {
          setError(res.error || 'Token tidak valid atau sudah kadaluarsa.');
        } else {
          setData(res.data);
          const initialMap: { [id: number]: string } = {};
          const existing = res.data.existingAbsensi || {};
          (res.data.murid || []).forEach((m: any) => {
            initialMap[m.murid_id] = existing[m.murid_id] || 'hadir';
          });
          setKehadiran(initialMap);
        }
      })
      .catch(err => {
        setError('Gagal menghubungkan ke server: ' + err.message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const setAllStatus = (status: string) => {
    if (!data?.murid) return;
    const newMap = { ...kehadiran };
    data.murid.forEach((m: any) => {
      newMap[m.murid_id] = status;
    });
    setKehadiran(newMap);
  };

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.log('GPS error:', err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []);

  const handleSubmit = async () => {
    if (!data || submitting) return;
    setSubmitting(true);
    setError(null);

    // Dapatkan lokasi GPS terbaru jika belum terdeteksi
    let currentLoc = userLocation;
    if (!currentLoc && 'geolocation' in navigator) {
      try {
        const pos: any = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 6000 });
        });
        if (pos && pos.coords) {
          currentLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(currentLoc);
        }
      } catch (_) {}
    }

    const listAbsensi = (murid || []).map((m: any) => ({
      murid_id: m.murid_id,
      status: kehadiran[m.murid_id] || 'hadir',
      nama_panggilan: m.nama_panggilan || ''
    }));

    const payload = {
      jadwal_id: data.jadwal.jadwal_id,
      tipe: data.tipe,
      tanggal: data.date,
      absensi: listAbsensi,
      lokasi_lat: currentLoc?.lat,
      lokasi_lng: currentLoc?.lng
    };

    try {
      const res = await fetch('/api/absen/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (result.success || res.ok) {
        setShowSuccessModal(true);
      } else {
        setError(result.error || 'Gagal menyimpan absensi.');
      }
    } catch (e: any) {
      setError('Terjadi kesalahan: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
        <p className="text-emerald-200 font-medium">Memverifikasi Token Quick Absen...</p>
        <p className="text-slate-400 text-xs mt-1">PP. Miftahul Anwar (PPMA)</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-xl">
          <AlertCircle className="w-14 h-14 text-rose-400 mx-auto mb-3 animate-bounce" />
          <h1 className="text-xl font-bold text-rose-300 mb-2">Tautan Tidak Valid / Expired</h1>
          <p className="text-slate-300 text-sm mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard/absen')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Masuk ke Dashboard Absensi
          </button>
        </div>
      </div>
    );
  }

  const { guru_nama, tipe, date, jadwal, murid } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">Quick Absen PPMA</h1>
              <p className="text-[11px] text-slate-400">{guru_nama}</p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60 rounded-full uppercase">
            {tipe}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Info Card */}
        <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border border-emerald-700/50 rounded-2xl p-4">
          <h2 className="text-lg font-bold text-emerald-300">{jadwal.nama_kelas}</h2>
          <p className="text-sm text-slate-300 font-medium">{jadwal.mata_pelajaran || 'Pengajaran Madin/Al-Qur\'an'}</p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-2 border-t border-emerald-800/40">
            <span>🕒 {jadwal.jam_mulai} - {jadwal.jam_selesai} WIB</span>
            <span>📅 {date}</span>
          </div>
        </div>

        {/* Tombol Pintasan Absen (Scan QR & Scan Wajah AI) */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/dashboard/scan-absen?mode=qr"
            className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-sm text-xs font-bold transition active:scale-95"
          >
            <QrCode size={16} /> Scan QR Kartu
          </Link>
          <Link
            href="/dashboard/scan-absen?mode=face"
            className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl shadow-sm text-xs font-bold transition active:scale-95"
          >
            <Brain size={16} /> Scan Wajah AI
          </Link>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 p-3 rounded-xl flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Quick Batch Select (Set Massal Sesuai Desain HP) */}
        <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              ⚡ Set Massal ({murid?.length || 0} Santri)
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 w-full">
            <button
              onClick={() => setAllStatus('hadir')}
              className="py-2 text-xs rounded-xl bg-emerald-900/70 hover:bg-emerald-800 text-emerald-300 border border-emerald-700/60 font-bold transition text-center active:scale-95"
            >
              Hadir All
            </button>
            <button
              onClick={() => setAllStatus('izin')}
              className="py-2 text-xs rounded-xl bg-amber-900/70 hover:bg-amber-800 text-amber-300 border border-amber-700/60 font-bold transition text-center active:scale-95"
            >
              Izin All
            </button>
            <button
              onClick={() => setAllStatus('sakit')}
              className="py-2 text-xs rounded-xl bg-blue-900/70 hover:bg-blue-800 text-blue-300 border border-blue-700/60 font-bold transition text-center active:scale-95"
            >
              Sakit All
            </button>
            <button
              onClick={() => setAllStatus('alpha')}
              className="py-2 text-xs rounded-xl bg-rose-900/70 hover:bg-rose-800 text-rose-300 border border-rose-700/60 font-bold transition text-center active:scale-95"
            >
              Alpha All
            </button>
          </div>
        </div>

        {/* Student List */}
        <div className="space-y-3">
          {murid?.map((m: any, idx: number) => {
            const st = kehadiran[m.murid_id] || 'hadir';
            const fotoUrl = getFotoUrl(m.foto);

            return (
              <div key={m.murid_id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-sm hover:border-slate-700 transition">
                {/* Header Row: Foto + Nama Lengkap & Nama Panggilan di samping kanan Foto */}
                <div className="flex items-start gap-3">
                  {/* Avatar / Foto Santri (Klik untuk Zoom) */}
                  <div
                    onClick={() => fotoUrl && setZoomPhoto(fotoUrl)}
                    className={`w-12 h-12 rounded-xl shrink-0 overflow-hidden border border-slate-700 flex items-center justify-center relative mt-0.5 ${fotoUrl ? 'cursor-pointer hover:opacity-90 hover:scale-105 transition-all' : ''}`}
                    style={{ backgroundColor: getAvatarColor(m.nama) }}
                    title={fotoUrl ? 'Klik untuk memperbesar foto' : ''}
                  >
                    {fotoUrl ? (
                      <img
                        src={fotoUrl}
                        alt={m.nama}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-white font-bold text-xs">{getInitials(m.nama)}</span>
                    )}
                  </div>

                  {/* Nama Santri & Input Nama Panggilan di sebelah kanan foto */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-sm text-slate-100 leading-tight truncate">
                      <span className="text-slate-400 font-semibold text-xs mr-1">{idx + 1}.</span>
                      {m.nama}
                    </h3>

                    {/* Input Nama Panggilan Instan (Disamping Kanan Foto) */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[11px] text-slate-400 shrink-0 font-medium">Panggilan:</span>
                      <input
                        type="text"
                        placeholder="Panggilan..."
                        value={m.nama_panggilan || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setData((prev: any) => ({
                            ...prev,
                            murid: (prev.murid || []).map((item: any) =>
                              item.murid_id === m.murid_id ? { ...item, nama_panggilan: val } : item
                            )
                          }));
                        }}
                        className="w-full max-w-[160px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-300 placeholder:text-slate-500 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Info Detail: NIS, Wali & Alamat */}
                <div className="space-y-1 pt-0.5 text-xs">
                  {/* NIS & Wali dalam Satu Baris */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-300">
                    <span className="font-mono text-slate-400">NIS: <strong className="text-slate-200">{m.nis || '-'}</strong></span>
                    <span className="text-slate-600">•</span>
                    <div className="flex items-center gap-1 text-slate-400 truncate">
                      <User size={11} className="shrink-0 text-emerald-400" />
                      <span>Wali: <strong className="text-slate-200">{m.nama_wali || '-'}</strong></span>
                    </div>
                  </div>

                  {/* Alamat Maksimal 2 Baris */}
                  <div className="flex items-start gap-1 text-[11px] text-slate-400 leading-tight">
                    <MapPin size={12} className="shrink-0 text-teal-400 mt-0.5" />
                    <span className="line-clamp-2" title={m.alamat}>
                      Alamat: <span className="text-slate-300">{m.alamat || '-'}</span>
                    </span>
                  </div>
                </div>

                {/* Status Options Buttons */}
                <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-800/80">
                  {[
                    { id: 'hadir', label: 'Hadir', bgActive: 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-900/50', bgInactive: 'bg-slate-800/80 text-slate-400 hover:text-slate-200' },
                    { id: 'izin', label: 'Izin', bgActive: 'bg-amber-600 text-white font-bold shadow-md shadow-amber-900/50', bgInactive: 'bg-slate-800/80 text-slate-400 hover:text-slate-200' },
                    { id: 'sakit', label: 'Sakit', bgActive: 'bg-blue-600 text-white font-bold shadow-md shadow-blue-900/50', bgInactive: 'bg-slate-800/80 text-slate-400 hover:text-slate-200' },
                    { id: 'alpha', label: 'Alpha', bgActive: 'bg-rose-600 text-white font-bold shadow-md shadow-rose-900/50', bgInactive: 'bg-slate-800/80 text-slate-400 hover:text-slate-200' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setKehadiran(prev => ({ ...prev, [m.murid_id]: opt.id }))}
                      className={`py-2 text-xs rounded-xl transition text-center font-medium ${st === opt.id ? opt.bgActive : opt.bgInactive}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Submit Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 z-30">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-base active:scale-[0.99]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Menyimpan Absensi...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" /> Simpan Absensi Kelas
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      {/* Modal Zoom Foto Santri */}
      {zoomPhoto && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm cursor-zoom-out" onClick={() => setZoomPhoto(null)}>
          <div className="relative max-w-2xl max-h-[90vh] flex items-center justify-center animate-in zoom-in duration-200">
            <img src={zoomPhoto} alt="Zoomed Santri" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-slate-700" />
            <button className="absolute -top-3 -right-3 bg-white text-black rounded-full w-8 h-8 flex items-center justify-center font-bold hover:scale-110 transition-transform">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Pemberitahuan Sukses & Form Notifikasi WA */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-md w-full text-center shadow-2xl space-y-4 my-auto">
            {/* Success Icon */}
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40 animate-bounce">
              <CheckCircle2 size={36} />
            </div>

            {/* Arabic & Main Title */}
            <div>
              <p className="text-2xl font-serif text-emerald-400 font-bold mb-1 tracking-wide">
                الحمد لله
              </p>
              <h3 className="text-xl font-extrabold text-white">Absensi Berhasil Disimpan!</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Data presensi kelas <strong>{jadwal?.nama_kelas || 'Madin/Al-Qur\'an'}</strong> telah tersimpan di sistem.
              </p>
            </div>

            {/* Section: Ambil/Upload Foto Kehadiran (Opsional) */}
            <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-3 text-left">
              <label className="block text-xs font-bold text-slate-200 flex items-center gap-2">
                <Camera size={16} className="text-emerald-400 animate-pulse" />
                Foto Kehadiran Kelas/Kamar (Opsional)
              </label>

              {/* Camera live view */}
              {showCamera && (
                <div className="rounded-2xl overflow-hidden border-2 border-emerald-500 bg-black relative mb-3">
                  {/* Camera toolbar */}
                  <div className="flex justify-between items-center bg-slate-900 px-3 py-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${facingMode === 'environment' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                      <span className="text-xs font-semibold text-slate-300">
                        {facingMode === 'environment' ? '📷 Kamera Belakang' : '🤳 Kamera Depan'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCameraOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-xl transition"
                      >
                        <span>{cameraOrientation === 'portrait' ? '📱 Potret' : '🌅 Lanskap'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={switchCamera}
                        disabled={isSwitchingCamera}
                        className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-xl transition"
                      >
                        <FlipHorizontal size={14} className={isSwitchingCamera ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Ganti</span>
                      </button>
                      <button
                        type="button"
                        onClick={closeCamera}
                        className="bg-rose-600 p-1 rounded-lg text-white"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Video preview */}
                  <div className="relative min-h-[220px] bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full object-cover ${cameraOrientation === 'portrait' ? 'aspect-[3/4] max-h-[380px]' : 'aspect-[4/3] max-h-[300px]'}`}
                    />
                  </div>

                  <div className="flex justify-center bg-slate-900 py-2.5 px-4">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-2 rounded-full shadow-lg transition flex items-center gap-2 text-xs"
                    >
                      <Camera size={16} /> Ambil Foto
                    </button>
                  </div>
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />

              {/* Buttons side-by-side full width */}
              <div className="grid grid-cols-2 gap-2.5 w-full">
                {!showCamera ? (
                  <button
                    type="button"
                    onClick={openCamera}
                    className="w-full bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 font-bold py-3 rounded-xl border border-emerald-700/50 text-xs transition flex items-center justify-center gap-2"
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
                    id="quick-presence-photo-input"
                  />
                  <label
                    htmlFor="quick-presence-photo-input"
                    className="w-full cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-xl border border-slate-700 text-xs transition flex items-center justify-center gap-2 text-center block"
                  >
                    <ImageIcon size={16} /> Upload File
                  </label>
                </div>
              </div>

              {photoUrl && (
                <div className="mt-2.5 relative w-full h-44 rounded-xl overflow-hidden border-2 border-emerald-500/80 shadow-md">
                  <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="absolute top-2 right-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 shadow-md w-7 h-7 flex items-center justify-center"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <p className="text-[10px] text-slate-400 font-medium text-center">
                Gunakan tombol <strong>Buka Kamera</strong> untuk foto langsung, atau <strong>Upload File</strong> jika memilih dari galeri.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <button
                onClick={handleShareToWA}
                type="button"
                className="w-full bg-[#128C7E] hover:bg-[#075E54] text-white px-4 py-3 rounded-xl font-bold text-xs transition shadow-md flex items-center justify-center gap-2 active:scale-95"
              >
                <Send size={15} /> Kirim Laporan & Foto ke Grup WA
              </button>

              <Link
                href={`/dashboard/notifikasi?kegiatan=${tipe}&kelas=${jadwal?.kelas_id || ''}`}
                className="block w-full bg-[#25D366] hover:bg-[#1DA851] text-white px-4 py-3 rounded-xl font-bold text-xs transition shadow-md text-center active:scale-95"
              >
                Lanjut Kirim Pesan WA Wali Murid
              </Link>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 transition"
                >
                  ✏️ Edit Absensi
                </button>
                <button
                  onClick={() => router.push('/dashboard/absen')}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold rounded-xl text-xs border border-slate-700 transition"
                >
                  Kembali ke Jadwal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuickAbsenPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading...</div>}>
      <QuickAbsenContent />
    </Suspense>
  );
}
