'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, Send, Sparkles, QrCode, Brain, X, User, MapPin, Camera, Image as ImageIcon, FlipHorizontal, BookOpen, HeartPulse, Check, AlertTriangle, FileText, RefreshCw, HelpCircle, Navigation, ShieldCheck } from 'lucide-react';
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
const getFotoUrl = (fotoName: string | null, nis?: string) => {
  if (!fotoName || fotoName === '-') {
    if (nis) return `https://mawar.smartpesantren.id/sekretariat/berkas/Berkas_2026_${nis}.jpg`;
    return '';
  }
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
  const actionParam = searchParams.get('action');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [kehadiran, setKehadiran] = useState<{ [muridId: number]: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);

  // Izin / Sakit States
  const [activeTab, setActiveTab] = useState<'absen' | 'izin'>(actionParam === 'izin' ? 'izin' : 'absen');
  const [izinStatus, setIzinStatus] = useState<'Izin' | 'Sakit'>('Izin');
  const [izinKeterangan, setIzinKeterangan] = useState('');
  const [izinFoto, setIzinFoto] = useState<string>('');
  const [submittingIzin, setSubmittingIzin] = useState(false);
  const [izinSuccess, setIzinSuccess] = useState<string | null>(null);

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

  const openCamera = async () => {
    stopCameraStream();
    setIsSwitchingCamera(true);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: cameraOrientation === 'portrait' ? 720 : 1280 },
          height: { ideal: cameraOrientation === 'portrait' ? 1280 : 720 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (err) {
      console.warn('Gagal membuka kamera:', err);
      alert('Tidak dapat mengakses kamera. Pastikan izin kamera telah diaktifkan di browser.');
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  const closeCamera = () => {
    stopCameraStream();
    setShowCamera(false);
  };

  const switchCamera = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    stopCameraStream();
    setIsSwitchingCamera(true);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { exact: nextMode },
          width: { ideal: cameraOrientation === 'portrait' ? 720 : 1280 },
          height: { ideal: cameraOrientation === 'portrait' ? 1280 : 720 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints).catch(async () => {
        return await navigator.mediaDevices.getUserMedia({ video: { facingMode: nextMode }, audio: false });
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Gagal switch kamera:', err);
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhotoUrl(dataUrl);
    closeCamera();
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPhotoUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => { return () => stopCameraStream(); }, [stopCameraStream]);

  const formatHariTanggalPesantren = (rawDate?: string, rawTime?: string) => {
    try {
      if (!rawDate) return '';
      const [thnStr, blnStr, tglStr] = rawDate.split('-');
      const thnNum = parseInt(thnStr, 10);
      const blnNum = parseInt(blnStr, 10);
      const tglNum = parseInt(tglStr, 10);
      if (isNaN(thnNum) || isNaN(blnNum) || isNaN(tglNum)) return rawDate;

      const d = new Date(thnNum, blnNum - 1, tglNum);
      const namaHari = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const namaBulan = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];

      const dayIdx = d.getDay();
      const hariIni = namaHari[dayIdx];
      const hariBesok = namaHari[(dayIdx + 1) % 7];
      const blnName = namaBulan[blnNum - 1];

      let isMalam = false;
      if (rawTime) {
        const timeParts = rawTime.split(':');
        const jam = parseInt(timeParts[0], 10);
        if (!isNaN(jam) && jam >= 18) {
          isMalam = true;
        }
      }

      const hariLabel = isMalam ? `${hariIni} malam ${hariBesok}` : hariIni;
      return `${hariLabel}, ${tglNum} ${blnName} ${thnNum}`;
    } catch {
      return rawDate || new Date().toLocaleDateString('id-ID');
    }
  };

  const generateWaGroupMessage = () => {
    if (!data) return '';
    const dateStr = formatHariTanggalPesantren(data.date, data.jadwal?.jam_mulai);
    const listMurid: any[] = data.murid || [];
    const total = listMurid.length;

    const hadir = listMurid.filter(m => (kehadiran[m.murid_id] || 'hadir') === 'hadir').length;
    const sakit = listMurid.filter(m => (kehadiran[m.murid_id] || 'hadir') === 'sakit');
    const izin = listMurid.filter(m => (kehadiran[m.murid_id] || 'hadir') === 'izin');
    const alpha = listMurid.filter(m => (kehadiran[m.murid_id] || 'hadir') === 'alpha');

    const namaKelas = data.jadwal?.nama_kelas || 'Kelas';
    const mapel = data.jadwal?.mata_pelajaran || data.jadwal?.mapel || '';

    const labelCategory = (() => {
      const t = (data.tipe || '').toLowerCase();
      if (t.includes('quran') || t.includes('qur_an')) return 'Majlis';
      if (t.includes('madin')) return 'Mapel';
      if (t.includes('asrama') || t.includes('kegiatan')) return 'Kegiatan';
      return 'Kegiatan/Mapel';
    })();

    let msg = `*LAPORAN KEHADIRAN ${namaKelas.toUpperCase()}*\n`;
    if (mapel) {
      msg += `📖 *${labelCategory}:* ${mapel}\n`;
    }
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

    const allAttended = sakit.length === 0 && izin.length === 0 && alpha.length === 0 && total > 0;
    let doaMsg = '';
    if (allAttended) {
      doaMsg = `_MasyaAllah, seluruh santri hadir 100%! Semoga senantiasa istiqomah & dianugerahi ilmu yang bermanfaat serta barokah oleh ALLAH Subhaanahu Wata'aala. اللهم آمين._`;
    } else {
      const parts: string[] = [];
      if (sakit.length > 0) parts.push('yang sakit lekas diberikan kesembuhan & keafiatan');
      if (izin.length > 0) parts.push('yang berhalangan izin dimudahkan segala urusannya');
      if (alpha.length > 0) parts.push('yang belum hadir diberikan semangat & kemudahan untuk kembali belajar');
      if (hadir > 0) {
        if (parts.length > 0) {
          parts.push('serta yang hadir senantiasa istiqomah & dianugerahi kefahaman ilmu yang bermanfaat');
        } else {
          parts.push('yang hadir senantiasa istiqomah & dianugerahi kefahaman ilmu yang bermanfaat');
        }
      }
      doaMsg = `_Semoga santri ${parts.join(', ')} oleh ALLAH Subhaanahu Wata'aala. اللهم آمين._`;
    }
    msg += `🤲 *Doa & Harapan:*\n${doaMsg}\n\n`;

    msg += `_Diinput via Pintasan Salam Mawar_\n_https://app.ppmawar.or.id_`;
    return msg;
  };

  const handleShareToWA = () => {
    const finalMessage = generateWaGroupMessage();
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(finalMessage)}`;
    window.open(waUrl, '_blank');
  };

  useEffect(() => {
    if (!token) {
      setError('Token absensi tidak ditemukan. Silakan klik link dari pesan WhatsApp kembali.');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Timeout 15 detik

    fetch('/api/absen/quick-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: controller.signal
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
        if (err.name === 'AbortError') {
          setError('Koneksi terlalu lambat atau server tidak merespons. Coba muat ulang halaman.');
        } else {
          setError('Gagal menghubungkan ke server: ' + err.message);
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setLoading(false);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
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
  const [detectingGps, setDetectingGps] = useState(false);
  const [showGpsModal, setShowGpsModal] = useState(false);

  const requestGpsPermission = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setError('Browser atau perangkat Anda tidak mendukung fitur deteksi lokasi (GPS).');
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setDetectingGps(false);
        setError((prev) => (prev && (prev.includes('GPS') || prev.includes('Lokasi') || prev.includes('lokasi')) ? null : prev));
      },
      (err) => {
        console.log('GPS error:', err);
        setDetectingGps(false);
        if (err.code === 1) {
          setError('Akses GPS ditolak oleh browser. Buka izin lokasi di browser atau ikuti panduan di bawah.');
        } else if (err.code === 2) {
          setError('Lokasi GPS tidak terdeteksi. Pastikan fitur Lokasi / GPS di HP Anda sudah dinyalakan.');
        } else if (err.code === 3) {
          setError('Waktu deteksi GPS habis. Silakan ketuk tombol "Cek Ulang GPS".');
        } else {
          setError('Gagal mendeteksi lokasi GPS: ' + err.message);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    requestGpsPermission();
  }, [requestGpsPermission]);

  const handleSubmit = async () => {
    if (!data || submitting) return;
    setSubmitting(true);
    setError(null);

    // Dapatkan lokasi GPS terbaru jika belum terdeteksi
    let currentLoc = userLocation;
    if (!currentLoc && 'geolocation' in navigator) {
      setDetectingGps(true);
      try {
        const pos: any = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 7000 });
        });
        if (pos && pos.coords) {
          currentLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(currentLoc);
        }
      } catch (_) {}
      setDetectingGps(false);
    }

    const listAbsensi = (murid || []).map((m: any) => ({
      murid_id: m.murid_id,
      status: kehadiran[m.murid_id] || 'hadir',
      nama_panggilan: m.nama_panggilan || ''
    }));

    const payload = {
      jadwal_id: data.jadwal.jadwal_id,
      jadwal_ids: data.jadwal.jadwal_ids || [data.jadwal.jadwal_id],
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
        setShowErrorModal(true);
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    } catch (e: any) {
      setError('Terjadi kesalahan: ' + e.message);
      setShowErrorModal(true);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleIzinSubmit = async () => {
    if (!token || submittingIzin) return;
    setSubmittingIzin(true);
    setError(null);

    try {
      const res = await fetch('/api/absen/quick-izin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          status: izinStatus,
          keterangan: izinKeterangan,
          foto_bukti: izinFoto || null
        })
      });
      const result = await res.json();
      if (result.success) {
        setIzinSuccess(result.message || `Permohonan ${izinStatus} berhasil dicatat.`);
      } else {
        setError(result.error || 'Gagal mengirim permohonan.');
        setShowErrorModal(true);
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    } catch (err: any) {
      setError('Terjadi kesalahan: ' + err.message);
      setShowErrorModal(true);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setSubmittingIzin(false);
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

  const groupedMurid = (murid || []).reduce((acc: any, m: any) => {
    const kNama = m.nama_kelas || data?.jadwal?.nama_kelas || 'Kelas';
    if (!acc[kNama]) acc[kNama] = [];
    acc[kNama].push(m);
    return acc;
  }, {});

  const classNames = Object.keys(groupedMurid);
  const isMultiClass = classNames.length > 1;
  let globalIndexCounter = 0;

  const isAlreadyFilled = Object.keys(data?.existingAbsensi || {}).length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">Pintasan Salam Mawar</h1>
              <p className="text-[11px] text-slate-400">{guru_nama}</p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60 rounded-full uppercase">
            {tipe}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Tab Switcher: Masuk (Absen Santri) vs Izin / Sakit */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-inner">
          <button
            type="button"
            onClick={() => { setActiveTab('absen'); setIzinSuccess(null); }}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 ${
              activeTab === 'absen'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen size={15} /> Absensi Santri (Masuk)
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('izin'); }}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 ${
              activeTab === 'izin'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HeartPulse size={15} /> Ajukan Izin / Sakit
          </button>
        </div>

        {/* Error Alert Interaktif (Dengan Bantuan GPS) */}
        {error && (
          <div className="bg-rose-950/90 border border-rose-500/60 text-rose-200 p-4 rounded-2xl space-y-3 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed flex-1">
                <p className="font-bold text-rose-100 mb-0.5">
                  {error.toLowerCase().includes('gps') || error.toLowerCase().includes('lokasi') ? 'Perhatian: Izin Lokasi (GPS) Diperlukan' : 'Terjadi Kesalahan'}
                </p>
                <p className="text-rose-200/90">{error}</p>
              </div>
            </div>

            {(error.toLowerCase().includes('gps') || error.toLowerCase().includes('lokasi')) && (
              <div className="flex flex-col gap-2 pt-2 border-t border-rose-900/60">
                {/* Baris 1: Panduan Buka Izin GPS — full width */}
                <button
                  type="button"
                  onClick={() => setShowGpsModal(true)}
                  className="w-full px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-300 border border-amber-500/40 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <HelpCircle className="w-3.5 h-3.5" /> Panduan Buka Izin GPS
                </button>
                {/* Baris 2: Cek Ulang GPS + Muat Ulang — berdampingan sama lebar */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={requestGpsPermission}
                    disabled={detectingGps}
                    className="flex-1 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm disabled:opacity-50"
                  >
                    {detectingGps ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Mendeteksi...</>
                    ) : (
                      <><MapPin className="w-3.5 h-3.5" /> Cek Ulang GPS</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="flex-1 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GPS Status Bar (Kecil & Informatif) */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl text-xs bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-2">
            <MapPin size={14} className={userLocation ? "text-emerald-400" : "text-amber-400"} />
            <span className="text-slate-300 text-[11px]">
              Status GPS HP:<br />
              {userLocation ? (
                <strong className="text-emerald-400">Terdeteksi &amp; Siap</strong>
              ) : detectingGps ? (
                <strong className="text-cyan-400">Sedang Mendeteksi...</strong>
              ) : (
                <strong className="text-amber-400">Belum Terdeteksi</strong>
              )}
            </span>
          </div>
          {!userLocation && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={requestGpsPermission}
                disabled={detectingGps}
                className="px-2.5 py-1 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-sm"
              >
                {detectingGps ? <Loader2 size={11} className="animate-spin" /> : <MapPin size={11} />}
                Deteksi GPS
              </button>
              <button
                type="button"
                onClick={() => setShowGpsModal(true)}
                className="p-1 text-slate-400 hover:text-amber-300 transition"
                title="Panduan Mengaktifkan GPS"
              >
                <HelpCircle size={15} />
              </button>
            </div>
          )}
        </div>

        {/* TAMPILAN 1: FORMULIR IZIN / SAKIT GURU */}
        {activeTab === 'izin' ? (
          <div className="space-y-4">
            {izinSuccess ? (
              <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-6 text-center space-y-4 shadow-xl animate-in fade-in zoom-in duration-200">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
                  <CheckCircle2 size={36} />
                </div>
                <div>
                  {/* Doa Teks Arab */}
                  <div className="text-2xl sm:text-3xl font-bold text-amber-300 font-serif mb-1 tracking-wide select-none py-1" dir="rtl">
                    {izinStatus === 'Sakit' ? 'شَفَاكُمُ اللهُ وَعَافَاكُمْ' : 'أَعَانَكُمُ اللهُ بِالتَّيْسِيْرِ'}
                  </div>
                  <p className="text-[11px] text-slate-400 italic mb-3 select-none">
                    {izinStatus === 'Sakit' ? 'Semoga Allah memberikan kesembuhan dan keafiatan kepada Anda.' : 'Semoga Allah senantiasa menolong Anda dengan segala kemudahan.'}
                  </p>
                  <h2 className="text-lg font-bold text-emerald-300">Permohonan Berhasil Dicatat</h2>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed max-w-md mx-auto">
                    {izinSuccess}
                  </p>
                </div>
                <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-[11px] text-emerald-200 text-left space-y-1">
                  <p className="font-bold flex items-center gap-1.5"><Sparkles size={13} /> Info Otomatisasi Kehadiran:</p>
                  <p>Status Anda telah tercatat sebagai <strong>{izinStatus}</strong> pada sistem. Anda <strong>tidak akan divonis Alpha otomatis</strong> saat waktu tenggang berakhir.</p>
                </div>
                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setIzinSuccess(null)}
                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
                  >
                    ✏️ Ubah Data Izin
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('absen')}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition"
                  >
                    📋 Buka Absensi Santri
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-lg">
                <div className="border-b border-slate-800 pb-3">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <HeartPulse className="text-amber-400" size={18} />
                    Formulir Izin / Sakit Mengajar
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Gunakan formulir ini jika Anda berhalangan hadir agar kehadiran tercatat resmi dan terhindar dari alpa otomatis.
                  </p>
                </div>

                {/* Info Guru & Jadwal */}
                <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Guru / Pembina:</span>
                    <span className="font-bold text-slate-200">{guru_nama}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Kelas / Kamar:</span>
                    <span className="font-bold text-emerald-400">{jadwal?.nama_kelas || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mata Pelajaran:</span>
                    <span className="font-bold text-slate-200">{jadwal?.mata_pelajaran || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Jadwal:</span>
                    <span className="font-bold text-slate-200">{jadwal?.jam_mulai} - {jadwal?.jam_selesai} WIB</span>
                  </div>
                </div>

                {/* Status Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">
                    Pilih Status Berhalangan:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIzinStatus('Izin')}
                      className={`p-3.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                        izinStatus === 'Izin'
                          ? 'bg-amber-950/60 border-amber-500 text-amber-300 shadow-md ring-2 ring-amber-500/30'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xl">🟡</span>
                      <span className="font-bold text-sm">Izin Mengajar</span>
                      <span className="text-[10px] text-slate-400">Ada Keperluan / Udzur</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIzinStatus('Sakit')}
                      className={`p-3.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                        izinStatus === 'Sakit'
                          ? 'bg-blue-950/60 border-blue-500 text-blue-300 shadow-md ring-2 ring-blue-500/30'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xl">🔵</span>
                      <span className="font-bold text-sm">Sakit</span>
                      <span className="text-[10px] text-slate-400">Kondisi Badan Tidak Fit</span>
                    </button>
                  </div>
                </div>

                {/* Alasan / Keterangan */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Alasan / Keterangan:
                  </label>
                  <textarea
                    rows={3}
                    value={izinKeterangan}
                    onChange={(e) => setIzinKeterangan(e.target.value)}
                    placeholder={izinStatus === 'Sakit' ? 'Contoh: Sakit demam tinggi sejak semalam...' : 'Contoh: Ada keperluan mendesak keluarga di luar kota...'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                  />
                  {/* Quick Reason Chips (Rata Tengah) */}
                  <div className="flex flex-wrap justify-center gap-1.5 mt-2 text-center">
                    {(izinStatus === 'Sakit' 
                      ? ['Demam / Flu', 'Sakit Kepala', 'Rawat Inap / Medis', 'Kurang Sehat'] 
                      : ['Urusan Keluarga Mendesak', 'Acara Pondok / Dinas', 'Perjalanan Luar Kota', 'Tugas Mendadak']
                    ).map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setIzinKeterangan(prev => prev ? `${prev}, ${chip}` : chip)}
                        className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-[11px] text-slate-300 rounded-lg transition active:scale-95 text-center"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lampiran Foto Bukti (Opsional) */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Foto Surat Dokter / Bukti (Opsional):
                  </label>
                  {izinFoto ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-700 max-w-xs mx-auto">
                      <img src={izinFoto} alt="Bukti Izin" className="w-full h-40 object-cover" />
                      <button
                        type="button"
                        onClick={() => setIzinFoto('')}
                        className="absolute top-2 right-2 p-1.5 bg-rose-600/90 text-white rounded-full text-xs shadow-md"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer bg-slate-950/40 transition">
                      <Camera className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs font-medium text-slate-300">Pilih atau Ambil Foto Bukti</span>
                      <span className="text-[10px] text-slate-500">JPG, PNG (Opsional)</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              if (ev.target?.result) setIzinFoto(ev.target.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="button"
                  onClick={handleIzinSubmit}
                  disabled={submittingIzin}
                  className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 active:scale-95"
                >
                  {submittingIzin ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengirim Permohonan...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Kirim Status {izinStatus}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* TAMPILAN 2: ABSENSI SANTRI (MASUK) */
          <>
            {/* Banner Notifikasi Mode Edit Absensi */}
            {isAlreadyFilled && (
              <div className="bg-blue-950/80 border border-blue-500/50 text-blue-200 p-3.5 rounded-xl text-xs shadow-md space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <p className="font-bold text-blue-300">Mode Edit / Perbarui Absensi</p>
                </div>
                <p className="text-[11px] text-blue-200/90 leading-relaxed">
                  Absensi kelas ini sudah pernah diisi sebelumnya. Status yang tersimpan telah dimuat otomatis dan dapat Anda sesuaikan kembali, lalu klik <strong>"Perbarui Absensi Kelas"</strong>.
                </p>
              </div>
            )}

            {/* Info Card */}
            <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border border-emerald-700/50 rounded-2xl p-4">
              <h2 className="text-lg font-bold text-emerald-300">{jadwal.nama_kelas}</h2>
              <p className="text-sm text-slate-300 font-medium">{jadwal.mata_pelajaran || 'Pengajaran Madin/Al-Qur\'an'}</p>
              <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-2 border-t border-emerald-800/40">
                <span>🕒 {jadwal.jam_mulai} - {jadwal.jam_selesai} WIB</span>
                <span>📅 {new Date(date + 'T00:00:00+07:00').toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).replace(/^Minggu,/i, 'Ahad,').replace(/^Minggu /i, 'Ahad ')}</span>
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

        {/* Student List (Grouped by Class if Multi-Class Schedule) */}
        <div className="space-y-6">
          {classNames.map((kelasNama) => {
            const listSantri = groupedMurid[kelasNama] || [];
            return (
              <div key={kelasNama} className="space-y-3">
                {isMultiClass && (
                  <div className="bg-slate-800/90 border border-emerald-500/30 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-md sticky top-14 z-20 backdrop-blur-md">
                    <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wide flex items-center gap-2">
                      <BookOpen size={14} className="text-emerald-400 shrink-0" />
                      --- KELAS {kelasNama.toUpperCase()} ({listSantri.length} Santri) ---
                    </span>
                  </div>
                )}
                {listSantri.map((m: any) => {
                  globalIndexCounter++;
                  const idx = globalIndexCounter;
                  const st = kehadiran[m.murid_id] || 'hadir';
                  const fotoUrl = getFotoUrl(m.foto, m.nis);

                  return (
                    <div key={m.murid_id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-sm hover:border-slate-700 transition">
                      {/* Header Row: Foto + Nama Lengkap */}
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

                        {/* Nama Santri (Maksimal 2 Baris) */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-extrabold text-sm text-slate-100 leading-snug line-clamp-2">
                            <span className="text-slate-400 font-semibold text-xs mr-1">{idx}.</span>
                            {m.nama}
                          </h3>
                        </div>
                      </div>

                      {/* Input Nama Panggilan — Baris tersendiri, rata kiri sejajar NIS & Alamat */}
                      <div className="flex items-center gap-2">
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
                          className="flex-1 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-300 placeholder:text-slate-500 transition"
                        />
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
            );
          })}
        </div>

        {/* Floating Submit Button (Khusus Mode Masuk/Absen Santri) */}
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
                  <Send className="w-5 h-5" /> {isAlreadyFilled ? 'Perbarui Absensi Kelas' : 'Simpan Absensi Kelas'}
                </>
              )}
            </button>
          </div>
        </div>
        </>
        )}
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

      {/* Modal Pop-up Gagal Absensi / Peringatan Jarak & GPS */}
      {showErrorModal && error && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-slate-900 border border-rose-500/70 rounded-3xl p-6 max-w-md w-full text-center shadow-2xl space-y-4 my-auto animate-in zoom-in-95 duration-200">
            {/* Alert Icon */}
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-500/40">
              <AlertCircle size={36} />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-rose-300 mb-1.5">
                {error.toLowerCase().includes('jarak') || error.toLowerCase().includes('radius')
                  ? 'Absensi Ditolak (Di Luar Radius)'
                  : error.toLowerCase().includes('gps') || error.toLowerCase().includes('lokasi')
                  ? 'Izin Lokasi (GPS) Diperlukan'
                  : 'Gagal Menyimpan Absensi'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                {error}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {(error.toLowerCase().includes('gps') || error.toLowerCase().includes('lokasi') || error.toLowerCase().includes('jarak')) && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowErrorModal(false);
                      requestGpsPermission();
                    }}
                    disabled={detectingGps}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                  >
                    {detectingGps ? (
                      <><Loader2 size={14} className="animate-spin" /> Mendeteksi GPS...</>
                    ) : (
                      <><MapPin size={14} /> Cek Ulang GPS</>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowErrorModal(false);
                      setShowGpsModal(true);
                    }}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/40 transition flex items-center justify-center gap-1.5"
                  >
                    <HelpCircle size={14} /> Panduan Buka Izin GPS
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setShowErrorModal(false)}
                className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-xs rounded-xl transition"
              >
                Tutup Pemberitahuan
              </button>
            </div>
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

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={handleShareToWA}
                type="button"
                className="w-full bg-[#128C7E] hover:bg-[#075E54] text-white px-4 py-3 rounded-xl font-bold text-xs transition shadow-md flex items-center justify-center gap-2 active:scale-95"
              >
                <Send size={15} /> Kirim Ringkasan Laporan ke Grup WA
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

      {/* Modal Panduan Mengaktifkan GPS */}
      {showGpsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 text-slate-100 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
                <MapPin className="w-5 h-5" />
                <span>Panduan Mengaktifkan GPS &amp; Izin Lokasi</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGpsModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
              {/* Langkah 1 */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[11px] border border-amber-500/40">1</span>
                  Nyalakan GPS di HP Anda
                </div>
                <p className="text-slate-300 pl-7 text-[11px]">
                  Tarik layar HP dari atas ke bawah (menu bar notifikasi). Pastikan ikon <strong>&quot;Lokasi&quot; / &quot;GPS&quot;</strong> dalam keadaan <strong>Menyala / Aktif (berwarna biru/hijau)</strong>.
                </p>
              </div>

              {/* Langkah 2: Chrome Android */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-300">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[11px] border border-emerald-500/40">2</span>
                  Pengguna Google Chrome (HP Android)
                </div>
                <ul className="list-disc pl-11 space-y-1 text-slate-300 text-[11px]">
                  <li>Lihat bilah alamat web paling atas tempat halaman ini dibuka (<code>app.ppmawar.or.id</code>).</li>
                  <li>Ketuk ikon <strong>Gembok 🔒 atau Setelan ⚙️ / Tombol Info</strong> di sebelah kiri alamat web.</li>
                  <li>Pilih menu <strong>Izin / Permissions</strong> ➔ aktifkan <strong>Lokasi (Location)</strong> ke <strong>Izinkan / Allow</strong>.</li>
                </ul>
              </div>

              {/* Langkah 3: iPhone / Safari */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-cyan-300">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[11px] border border-cyan-500/40">3</span>
                  Pengguna iPhone (Safari)
                </div>
                <ul className="list-disc pl-11 space-y-1 text-slate-300 text-[11px]">
                  <li>Buka <strong>Pengaturan HP (Settings)</strong> ➔ <strong>Privasi &amp; Keamanan</strong> ➔ <strong>Layanan Lokasi</strong> (pastikan Aktif).</li>
                  <li>Di Safari, ketuk tombol <strong>&apos;aA&apos;</strong> di bilah alamat ➔ <strong>Pengaturan Situs Web</strong> ➔ <strong>Lokasi</strong> ➔ Pilih <strong>Izinkan</strong>.</li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  requestGpsPermission();
                  setShowGpsModal(false);
                }}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md active:scale-95"
              >
                <MapPin size={15} /> Cek &amp; Izinkan Sekarang
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <RefreshCw size={14} /> Muat Ulang Halaman
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAbsenFallback() {
  const [showReload, setShowReload] = useState(false);

  useEffect(() => {
    // Jika loading lebih dari 8 detik, tampilkan tombol reload
    const timer = setTimeout(() => setShowReload(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 gap-4">
      <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
      <div className="text-center">
        <p className="text-emerald-200 font-semibold text-base">Memuat Halaman Absensi...</p>
        <p className="text-slate-500 text-xs mt-1">PP. Matholi&apos;ul Anwar</p>
      </div>
      {showReload && (
        <div className="text-center mt-2">
          <p className="text-slate-400 text-xs mb-3">Memuat terlalu lama? Coba muat ulang halaman.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition active:scale-95"
          >
            🔄 Muat Ulang
          </button>
        </div>
      )}
    </div>
  );
}

export default function QuickAbsenPage() {
  return (
    <Suspense fallback={<QuickAbsenFallback />}>
      <QuickAbsenContent />
    </Suspense>
  );
}
