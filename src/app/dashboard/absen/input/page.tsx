'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, CheckCircle, XCircle, Clock, AlertTriangle, ArrowLeft, Save, Camera, Image, FlipHorizontal, X as XIcon, User, MapPin, QrCode, Brain, BookOpen, HeartPulse, Send, FileText, CheckCircle2, RefreshCw, HelpCircle, Loader2, AlertCircle, Copy, Check, Search, Key, Link as LinkIcon } from 'lucide-react';
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

const getFotoUrl = (fotoName: string | null, nis?: string) => {
  if (!fotoName || fotoName === '-') {
    if (nis) return `https://mawar.smartpesantren.id/sekretariat/berkas/Berkas_2026_${nis}.jpg`;
    return '';
  }
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
  const actionParam = searchParams.get('action');

  const [activeTab, setActiveTab] = useState<'absen' | 'izin'>(actionParam === 'izin' ? 'izin' : 'absen');
  const [murid, setMurid] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [namaTarget, setNamaTarget] = useState('Kelas/Kamar');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sudahAbsen, setSudahAbsen] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [jadwalInfo, setJadwalInfo] = useState<{ mata_pelajaran: string; jam_mulai: string; jam_selesai: string; guru_nama?: string } | null>(null);
  const [tanggalAbsen, setTanggalAbsen] = useState('');
  const [copiedWa, setCopiedWa] = useState(false);

  // Izin / Sakit state
  const [izinStatus, setIzinStatus] = useState<'Izin' | 'Sakit'>('Izin');
  const [izinKeterangan, setIzinKeterangan] = useState('');
  const [izinFoto, setIzinFoto] = useState<string | null>(null);
  const [submittingIzin, setSubmittingIzin] = useState(false);
  const [izinSuccess, setIzinSuccess] = useState(false);

  // Guru Badal state
  const [useBadal, setUseBadal] = useState(false);
  const [listGuru, setListGuru] = useState<any[]>([]);
  const [selectedBadalId, setSelectedBadalId] = useState<string>('');
  const [selectedBadalNama, setSelectedBadalNama] = useState<string>('');
  const [isManualBadal, setIsManualBadal] = useState(false);
  const [badalSearch, setBadalSearch] = useState('');
  const [showBadalDropdown, setShowBadalDropdown] = useState(false);
  const [izinResultData, setIzinResultData] = useState<any>(null);
  const [copiedBadalWa, setCopiedBadalWa] = useState(false);
  const [copiedBadalLink, setCopiedBadalLink] = useState(false);
  const [copiedBadalToken, setCopiedBadalToken] = useState(false);

  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [cameraOrientation, setCameraOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchData = useCallback(async () => {
    if (!tipe || !kelas_id || !jadwal_id) return;
    try {
      const res = await fetch(`/api/absen/input?tipe=${tipe}&kelas_id=${kelas_id}&jadwal_id=${jadwal_id}`);
      const json = await res.json();
      if (json.success) {
        setMurid(json.data);
        if (json.namaTarget) setNamaTarget(json.namaTarget);
        if (json.sudah_absen !== undefined) setSudahAbsen(json.sudah_absen);
        if (json.jadwalInfo) setJadwalInfo(json.jadwalInfo);
        if (json.tanggal) setTanggalAbsen(json.tanggal);
      } else {
        setErrorMsg(json.error || 'Gagal memuat data santri');
      }
    } catch (err) {
      setErrorMsg('Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  }, [tipe, kelas_id, jadwal_id]);

  const requestGpsLocation = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setLocationError('Browser Anda tidak mendukung deteksi lokasi.');
      setLoading(false);
      return;
    }
    setDetectingLocation(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLocationError('');
        setDetectingLocation(false);
        fetchData();
      },
      (err) => {
        console.error(err);
        setDetectingLocation(false);
        if (err.code === 1) {
          setLocationError('Izin akses lokasi ditolak oleh browser. Buka izin lokasi di setelan browser atau ikuti panduan di bawah.');
        } else if (err.code === 2) {
          setLocationError('Lokasi GPS tidak terdeteksi. Pastikan fitur Lokasi / GPS di HP Anda sudah dinyalakan.');
        } else if (err.code === 3) {
          setLocationError('Waktu deteksi lokasi habis. Silakan ketuk tombol "Cek Ulang GPS".');
        } else {
          setLocationError('Akses lokasi ditolak atau tidak tersedia. Anda wajib mengaktifkan GPS/Lokasi untuk melakukan absensi.');
        }
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [fetchData]);

  useEffect(() => {
    if (!tipe || !kelas_id || !jadwal_id) {
      setErrorMsg('Parameter tidak lengkap');
      setLoading(false);
      return;
    }
    requestGpsLocation();
  }, [tipe, kelas_id, jadwal_id, requestGpsLocation]);

  useEffect(() => {
    fetch('/api/kelas?type=guru')
      .then(res => res.json())
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setListGuru(res.data);
        }
      })
      .catch(err => console.warn('Gagal memuat daftar guru:', err));
  }, []);

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

  const handleIzinPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setIzinFoto(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleIzinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!izinKeterangan.trim()) {
      alert('Harap isi alasan atau keterangan izin/sakit.');
      return;
    }

    if (useBadal) {
      const resolvedNama = (selectedBadalNama || badalSearch || '').trim();
      if (!selectedBadalId && !resolvedNama) {
        alert('Harap pilih Ustadz/Ustadzah pengganti (badal), atau ketik nama pengganti jika di luar dewan guru, atau hilangkan centang badal.');
        return;
      }
    }

    const targetJadwalIds = (jadwal_id || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const primaryJadwalId = targetJadwalIds[0] || jadwal_id;

    const finalBadalNama = useBadal ? (isManualBadal ? selectedBadalNama.trim() : (selectedBadalNama || badalSearch.trim() || null)) : null;
    const finalBadalId = useBadal && !isManualBadal && selectedBadalId ? selectedBadalId : null;

    setSubmittingIzin(true);
    try {
      const res = await fetch('/api/absen/izin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipe,
          jadwal_id: primaryJadwalId,
          jadwal_ids: targetJadwalIds,
          status: izinStatus,
          keterangan: izinKeterangan,
          foto_bukti: izinFoto,
          guru_badal_id: finalBadalId,
          guru_badal_nama: finalBadalNama
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIzinResultData(data);
        setIzinSuccess(true);
      } else {
        alert(data.error || 'Gagal mengirim permohonan izin/sakit');
      }
    } catch (err) {
      alert('Terjadi kesalahan jaringan saat mengirim izin/sakit');
    } finally {
      setSubmittingIzin(false);
    }
  };

  const handleCopyBadalLink = async () => {
    const url = izinResultData?.badal_url;
    if (!url) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedBadalLink(true);
      setTimeout(() => setCopiedBadalLink(false), 3000);
    } catch (_) {}
  };

  const handleCopyBadalToken = async () => {
    const tokenStr = izinResultData?.badal_token || (izinResultData?.badal_url ? new URL(izinResultData.badal_url).searchParams.get('token') : null);
    if (!tokenStr) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(tokenStr);
      } else {
        const ta = document.createElement('textarea');
        ta.value = tokenStr;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedBadalToken(true);
      setTimeout(() => setCopiedBadalToken(false), 3000);
    } catch (_) {}
  };

  const generateBadalWaMessage = () => {
    const badalNama = izinResultData?.badal_info?.nama || 'Ustadz';
    const badalUrl = izinResultData?.badal_url || '';
    const dateStr = formatHariTanggalPesantren(tanggalAbsen || undefined, jadwalInfo?.jam_mulai);
    const mapel = jadwalInfo?.mata_pelajaran ? ` mata pelajaran *${jadwalInfo.mata_pelajaran}*` : '';
    const namaGuruAsli = jadwalInfo?.guru_nama || 'saya';

    return `Assalamu'alaikum Wr. Wb. Ustadz *${badalNama}*,\n\nMohon ridho dan bantuannya untuk berkenan membadali (menggantikan) mengajar kelas *${namaTarget}*${mapel} pada hari *${dateStr}* dikarenakan ${namaGuruAsli} berhalangan (*${izinStatus}*: ${izinKeterangan}).\n\nTautan absensi santri dapat langsung diakses di bawah ini:\n🔗 ${badalUrl}\n\nMatur suwun sanget atas bantuannya, jazakumullah khairan katsiran. 🙏`;
  };

  const handleSendBadalWa = async () => {
    if (!izinResultData?.badal_info) return;
    const msg = generateBadalWaMessage();
    let phone = (izinResultData.badal_info.no_hp || '').replace(/[^0-9]/g, '');
    if (phone.startsWith('08')) {
      phone = '628' + phone.substring(2);
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(msg);
      }
      setCopiedBadalWa(true);
      setTimeout(() => setCopiedBadalWa(false), 4000);
    } catch (_) {}

    const encodedText = encodeURIComponent(msg);
    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (phone) {
      if (isMobile) {
        window.location.href = `whatsapp://send?phone=${phone}&text=${encodedText}`;
        setTimeout(() => {
          window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`, '_blank');
        }, 1500);
      } else {
        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`, '_blank');
      }
    } else {
      if (isMobile) {
        window.location.href = `whatsapp://send?text=${encodedText}`;
        setTimeout(() => {
          window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
        }, 1500);
      } else {
        window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
      }
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

  const formatHariTanggalPesantren = (rawDate?: string, rawTime?: string) => {
    try {
      const d = rawDate ? new Date(rawDate.includes('T') ? rawDate : `${rawDate}T12:00:00+07:00`) : new Date();
      const hariArr = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const nextHariArr = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'];
      const bulanArr = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];

      const dayIdx = d.getDay();
      const hariIni = hariArr[dayIdx];
      const hariBesok = nextHariArr[dayIdx];
      const tglNum = d.getDate();
      const blnName = bulanArr[d.getMonth()];
      const thnNum = d.getFullYear();

      let isMalam = false;
      if (rawTime) {
        const hour = parseInt(rawTime.split(':')[0], 10);
        if (!isNaN(hour) && (hour >= 18 || hour < 4)) {
          isMalam = true;
        }
      } else {
        const nowHour = new Date().getHours();
        if (nowHour >= 18 || nowHour < 4) {
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
    const dateStr = formatHariTanggalPesantren(tanggalAbsen || undefined, jadwalInfo?.jam_mulai);
    const total = murid.length;
    const hadir = murid.filter(m => m.status === 'Hadir').length;
    const sakit = murid.filter(m => m.status === 'Sakit');
    const izin = murid.filter(m => m.status === 'Izin');
    const alpha = murid.filter(m => m.status === 'Alpha');

    const mapel = jadwalInfo?.mata_pelajaran || '';

    const labelCategory = (() => {
      const t = (tipe || '').toLowerCase();
      if (t.includes('quran') || t.includes('qur_an')) return 'Majlis';
      if (t.includes('madin')) return 'Mapel';
      if (t.includes('asrama') || t.includes('kegiatan')) return 'Kegiatan';
      return 'Kegiatan/Mapel';
    })();

    let msg = `*LAPORAN KEHADIRAN ${namaTarget.toUpperCase()}*\n`;
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

    // 🤲 Doa — 1 Paragraf Ringkas & Mencakup Semua
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

    msg += `🔗 *Lihat Detail Absensi:* https://app.ppmawar.or.id/dashboard/absen\n`;
    msg += `\n_Diinput via Pintasan Salam Mawar_\nhttps://app.ppmawar.or.id`;
    return msg;
  };

  const handleCopyReport = async () => {
    const text = generateWaGroupMessage();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedWa(true);
      setTimeout(() => setCopiedWa(false), 4000);
      return true;
    } catch (e) {
      console.warn('Gagal menyalin:', e);
      return false;
    }
  };

  const handleShareToWA = async () => {
    let fileToShare: File | null = null;

    if (photoUrl) {
      try {
        if (photoUrl.startsWith('data:') || photoUrl.startsWith('blob:')) {
          const res = await fetch(photoUrl);
          const blob = await res.blob();
          fileToShare = new File([blob], `foto_kehadiran_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
        }
      } catch (err) {
        console.warn('Error preparing photo file:', err);
      }
    }

    const textWithoutPhoto = generateWaGroupMessage();

    // Selalu salin teks laporan ke clipboard terlebih dahulu (penyelamat utama di iPhone / iOS jika WhatsApp hanya mengambil link/gambar saja)
    await handleCopyReport();

    // 1. Coba Native Web Share API (Di HP jika ada foto)
    if (fileToShare && typeof navigator !== 'undefined' && (navigator as any).canShare && (navigator as any).canShare({ files: [fileToShare] })) {
      try {
        await navigator.share({
          title: `LAPORAN KEHADIRAN ${namaTarget.toUpperCase()}`,
          text: textWithoutPhoto,
          files: [fileToShare],
        });
        return;
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') return;
        console.warn('Web Share API gagal, lanjut ke direct WA URL:', shareErr);
      }
    }

    // 2. Direct WhatsApp di Mobile (iOS/Android) atau Web WhatsApp di Desktop
    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const encodedText = encodeURIComponent(textWithoutPhoto);

    if (isMobile) {
      // Skema whatsapp://send langsung meluncurkan aplikasi WhatsApp tanpa redirect website perantara api.whatsapp.com yang rawan truncate di iPhone
      window.location.href = `whatsapp://send?text=${encodedText}`;
      setTimeout(() => {
        window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
      }, 1500);
    } else {
      const waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
      window.open(waUrl, '_blank');
    }
  };

  const handleSave = async () => {
    const targetJadwalIds = (jadwal_id || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const primaryJadwalId = targetJadwalIds[0] || jadwal_id;

    if (!confirm('Simpan data absensi sekarang?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/absen/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipe,
          jadwal_id: primaryJadwalId,
          jadwal_ids: targetJadwalIds,
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
        setErrorMsg(data.error || 'Gagal menyimpan absensi');
        setShowErrorModal(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      setErrorMsg('Terjadi kesalahan saat menyimpan. Periksa koneksi internet Anda.');
      setShowErrorModal(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

        {/* Section: Ambil/Upload Foto Kehadiran (Opsional - Diproses langsung di HP tanpa simpan di server) */}
        <div id="camera-section-container" className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-150 dark:border-gray-750 mb-6 space-y-3 text-left">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Camera size={18} className="text-indigo-600 dark:text-indigo-400 animate-pulse" />
              Foto Kehadiran Kelas/Kamar (Opsional)
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">Tanpa Beban Server</span>
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
            {photoUrl
              ? 'Foto siap dilampirkan langsung ke WhatsApp saat Anda menekan tombol kirim.'
              : 'Gunakan tombol Buka Kamera untuk foto langsung, atau Upload File jika ingin memilih dari galeri.'}
          </p>
        </div>

        {copiedWa && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span><strong>Teks laporan otomatis tersalin!</strong> Jika di WhatsApp kolom chat belum terisi (misal di iPhone), silakan langsung <strong>Tempel / Paste</strong>.</span>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleShareToWA}
            type="button"
            className="w-full bg-[#128C7E] hover:bg-[#075E54] text-white px-6 py-4 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
          >
            <Send size={16} /> {photoUrl ? 'Kirim Laporan & Foto ke Grup WA' : 'Kirim Ringkasan Laporan ke Grup WA'}
          </button>

          <button
            onClick={handleCopyReport}
            type="button"
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border ${
              copiedWa 
                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border-emerald-300' 
                : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {copiedWa ? <CheckCircle2 size={15} className="text-emerald-600" /> : <Copy size={15} />}
            {copiedWa ? '✅ Teks Berhasil Disalin! (Tinggal Paste di WA)' : '📋 Salin Teks Laporan (Untuk Pengguna iPhone / Cadangan)'}
          </button>

          <Link href={`/dashboard/notifikasi?kegiatan=${tipe}&kelas=${kelas_id}`} className="block w-full bg-[#25D366] hover:bg-[#1DA851] text-white px-6 py-4 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md flex items-center justify-center gap-2 text-center">
            Lanjut Kirim Pesan WA Wali Murid
          </Link>
          <Link href="/dashboard/absen" className="block w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-4 rounded-xl font-bold transition-colors text-center">
            Kembali ke Jadwal
          </Link>
        </div>
      </div>
    );
  }

  if (locationError) return (
    <div className="max-w-xl mx-auto p-6 text-center bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-3xl mt-8 shadow-xl space-y-4">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto border border-red-200 dark:border-red-800">
        <MapPin size={32} className="text-red-500" />
      </div>
      <h2 className="text-xl font-extrabold text-red-800 dark:text-red-300">Izin Lokasi (GPS) Diperlukan</h2>
      <p className="text-xs text-red-600 dark:text-red-300 leading-relaxed max-w-md mx-auto">{locationError}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-black/30 p-3 rounded-2xl border border-red-100 dark:border-red-900/30">
        Deteksi lokasi diwajibkan untuk memastikan absensi dilakukan di area pesantren. Pastikan sakelar GPS di HP Anda sudah menyala dan izin lokasi di browser diberikan.
      </p>
      
      <div className="flex flex-col gap-2 pt-2 justify-center">
        {/* Baris 1: Panduan Buka Izin GPS — full width */}
        <button
          type="button"
          onClick={() => setShowGpsModal(true)}
          className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
        >
          <HelpCircle className="w-3.5 h-3.5" /> Panduan Buka Izin GPS
        </button>

        {/* Baris 2: Cek Ulang GPS + Muat Ulang — berdampingan sama lebar */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={requestGpsLocation}
            disabled={detectingLocation}
            className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm disabled:opacity-50"
          >
            {detectingLocation ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Mendeteksi...</>
            ) : (
              <><MapPin className="w-3.5 h-3.5" /> Cek Ulang GPS</>
            )}
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 py-2.5 px-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
          </button>
        </div>

        {/* Baris 3: Kembali — full width */}
        <Link
          href="/dashboard/absen"
          className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
        >
          Kembali
        </Link>
      </div>

      {/* Modal Panduan GPS */}
      {showGpsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 text-left">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-base">
                <MapPin className="w-5 h-5" />
                <span>Panduan Mengaktifkan GPS &amp; Izin Lokasi</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGpsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800 transition"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-300">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center text-[11px] border border-amber-500/40">1</span>
                  Nyalakan GPS di HP Anda
                </div>
                <p className="text-slate-600 dark:text-slate-300 pl-7 text-[11px]">
                  Tarik layar HP dari atas ke bawah (menu bar notifikasi). Pastikan ikon <strong>&quot;Lokasi&quot; / &quot;GPS&quot;</strong> dalam keadaan <strong>Menyala / Aktif (berwarna biru/hijau)</strong>.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-300">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center text-[11px] border border-emerald-500/40">2</span>
                  Pengguna Google Chrome (HP Android)
                </div>
                <ul className="list-disc pl-11 space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                  <li>Lihat bilah alamat web paling atas tempat halaman ini dibuka (<code>app.ppmawar.or.id</code>).</li>
                  <li>Ketuk ikon <strong>Gembok 🔒 atau Setelan ⚙️ / Tombol Info</strong> di sebelah kiri alamat web.</li>
                  <li>Pilih menu <strong>Izin / Permissions</strong> ➔ aktifkan <strong>Lokasi (Location)</strong> ke <strong>Izinkan / Allow</strong>.</li>
                </ul>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-cyan-600 dark:text-cyan-300">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 flex items-center justify-center text-[11px] border border-cyan-500/40">3</span>
                  Pengguna iPhone (Safari)
                </div>
                <ul className="list-disc pl-11 space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                  <li>Buka <strong>Pengaturan HP (Settings)</strong> ➔ <strong>Privasi &amp; Keamanan</strong> ➔ <strong>Layanan Lokasi</strong> (pastikan Aktif).</li>
                  <li>Di Safari, ketuk tombol <strong>&apos;aA&apos;</strong> di bilah alamat ➔ <strong>Pengaturan Situs Web</strong> ➔ <strong>Lokasi</strong> ➔ Pilih <strong>Izinkan</strong>.</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  requestGpsLocation();
                  setShowGpsModal(false);
                }}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md active:scale-95"
              >
                <MapPin size={15} /> Cek &amp; Izinkan Sekarang
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <RefreshCw size={14} /> Muat Ulang Halaman
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Pengelompokan santri per kelas jika jadwal merupakan kelas gabungan
  const groupedMurid = (murid || []).reduce((acc: { [key: string]: any[] }, m: any) => {
    const kNama = m.nama_kelas || namaTarget || 'Kelas';
    if (!acc[kNama]) acc[kNama] = [];
    acc[kNama].push(m);
    return acc;
  }, {});

  const classNames = Object.keys(groupedMurid);
  const isMultiClass = classNames.length > 1;

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

      {/* Info Card Jadwal (Pelajaran, Jam, Tanggal+Hari) */}
      {(jadwalInfo?.mata_pelajaran || tanggalAbsen) && (
        <div className="bg-gradient-to-r from-indigo-900/40 to-blue-900/40 border border-indigo-700/50 dark:border-indigo-800/50 rounded-2xl p-4">
          {jadwalInfo?.mata_pelajaran && (
            <p className="text-base font-bold text-indigo-300 uppercase tracking-wide">
              {jadwalInfo.mata_pelajaran}
            </p>
          )}
          <div className="flex items-center justify-between text-xs text-indigo-400 mt-2.5 pt-2 border-t border-indigo-800/40 flex-wrap gap-2">
            {jadwalInfo?.jam_mulai && (
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="shrink-0" />
                {jadwalInfo.jam_mulai}{jadwalInfo.jam_selesai ? ` - ${jadwalInfo.jam_selesai}` : ''} WIB
              </span>
            )}
            {tanggalAbsen && (
              <span className="flex items-center gap-1.5">
                📅 {new Date(tanggalAbsen + 'T00:00:00+07:00').toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error Banner (Radius / Simpan gagal) */}
      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-600 rounded-2xl p-4 flex items-start gap-3 animate-in slide-in-from-top duration-300">
          <AlertTriangle size={22} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-700 dark:text-red-300 font-bold text-sm">Absensi Tidak Dapat Disimpan</p>
            <p className="text-red-600 dark:text-red-400 text-xs mt-0.5 leading-relaxed">{errorMsg}</p>
          </div>
          <button
            onClick={() => setErrorMsg('')}
            className="text-red-400 hover:text-red-600 transition-colors shrink-0 p-1"
            aria-label="Tutup notifikasi"
          >
            <XIcon size={18} />
          </button>
        </div>
      )}

      {/* Tab Switcher: Absensi Santri vs Ajukan Izin / Sakit */}
      <div className="grid grid-cols-2 p-1.5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('absen')}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeTab === 'absen'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
          }`}
        >
          <BookOpen size={16} />
          <span>Absensi Santri (Masuk)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('izin')}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeTab === 'izin'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
          }`}
        >
          <HeartPulse size={16} />
          <span>Ajukan Izin / Sakit</span>
        </button>
      </div>

      {activeTab === 'izin' ? (
        izinSuccess ? (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700 shadow-lg text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={36} />
            </div>
            
            {/* Doa Teks Arab */}
            <div className="text-2xl sm:text-3xl font-bold text-amber-500 dark:text-amber-400 font-serif mb-1 tracking-wide select-none py-1" dir="rtl">
              {izinStatus === 'Sakit' ? 'شَفَاكُمُ اللهُ وَعَافَاكُمْ' : 'أَعَانَكُمُ اللهُ بِالتَّيْسِيْرِ'}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-4 select-none">
              {izinStatus === 'Sakit' ? 'Semoga Allah memberikan kesembuhan dan keafiatan kepada Anda.' : 'Semoga Allah senantiasa menolong Anda dengan segala kemudahan.'}
            </p>

            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">
              Permohonan {izinStatus} Berhasil Tercatat!
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5 max-w-md mx-auto">
              Status ketidakhadiran Anda telah tersimpan resmi di sistem untuk jadwal ini. Anda tidak akan terkena sanksi alpa otomatis.
            </p>

            {/* Informasi & Kirim Tautan ke Guru Badal */}
            {izinResultData?.badal_info && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 mb-6 text-left space-y-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🎖️</span>
                  <div>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                      Guru Pengganti (Badal) Ditunjuk {izinResultData.badal_info.id ? '' : '(Luar Dewan Guru)'}
                    </p>
                    <p className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                      Ust. {izinResultData.badal_info.nama}
                    </p>
                    {izinResultData.badal_info.no_hp ? (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        📱 WhatsApp: {izinResultData.badal_info.no_hp}
                      </p>
                    ) : (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">
                        ℹ️ Nomor WA tidak tersimpan di sistem. Anda dapat menyalin tautan atau token di bawah.
                      </p>
                    )}
                  </div>
                </div>

                {/* Tombol Aksi WhatsApp & Salin Pesan */}
                <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleSendBadalWa}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <Send size={15} />
                    <span>{izinResultData.badal_info.no_hp ? 'Kirim Tautan via WA' : 'Buka WhatsApp (Pilih Kontak)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const msg = generateBadalWaMessage();
                      try {
                        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                          await navigator.clipboard.writeText(msg);
                        } else {
                          const ta = document.createElement('textarea');
                          ta.value = msg;
                          document.body.appendChild(ta);
                          ta.select();
                          document.execCommand('copy');
                          document.body.removeChild(ta);
                        }
                        setCopiedBadalWa(true);
                        setTimeout(() => setCopiedBadalWa(false), 3000);
                      } catch (_) {}
                    }}
                    className="py-2.5 px-4 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/60 dark:hover:bg-emerald-800 text-emerald-800 dark:text-emerald-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    {copiedBadalWa ? <Check size={15} /> : <Copy size={15} />}
                    <span>{copiedBadalWa ? 'Pesan Tersalin!' : 'Salin Pesan WA'}</span>
                  </button>
                </div>

                {/* Tombol Salin Tautan & Salin Token Saja */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyBadalLink}
                    className="flex-1 py-2 px-3 bg-white dark:bg-gray-900 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
                  >
                    {copiedBadalLink ? <Check size={14} className="text-emerald-600" /> : <LinkIcon size={14} />}
                    <span>{copiedBadalLink ? '✅ Tautan Tersalin!' : '🔗 Salin Tautan Absensi'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyBadalToken}
                    className="flex-1 py-2 px-3 bg-white dark:bg-gray-900 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
                  >
                    {copiedBadalToken ? <Check size={14} className="text-emerald-600" /> : <Key size={14} />}
                    <span>{copiedBadalToken ? '✅ Token Tersalin!' : '🔑 Salin Token Saja'}</span>
                  </button>
                </div>

                {copiedBadalWa && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 text-center font-medium">
                    ✅ Draft pesan dan tautan badal berhasil disalin ke clipboard!
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => setActiveTab('absen')}
                className="w-full px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                Buka Absensi Santri
              </button>
              <Link
                href="/dashboard/absen"
                className="w-full px-5 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition text-center"
              >
                Kembali ke Jadwal
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleIzinSubmit} className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-5 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl">
                <HeartPulse size={22} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">Formulir Izin / Sakit Mengajar</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Gunakan formulir ini jika berhalangan hadir agar kehadiran tercatat resmi dan terhindar dari alpa otomatis.</p>
              </div>
            </div>

            {/* Rincian Target */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-700/60 space-y-2 text-xs">
              {jadwalInfo?.guru_nama && (
                <div className="flex justify-between items-center py-1 border-b border-gray-200/50 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">Guru / Pembina:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{jadwalInfo.guru_nama}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-1 border-b border-gray-200/50 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">Kelas / Kamar:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{namaTarget}</span>
              </div>
              {jadwalInfo?.mata_pelajaran && (
                <div className="flex justify-between items-center py-1 border-b border-gray-200/50 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">Mata Pelajaran:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{jadwalInfo.mata_pelajaran}</span>
                </div>
              )}
              {jadwalInfo?.jam_mulai && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500 dark:text-gray-400">Jadwal:</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    {jadwalInfo.jam_mulai}{jadwalInfo.jam_selesai ? ` - ${jadwalInfo.jam_selesai}` : ''} WIB
                  </span>
                </div>
              )}
            </div>

            {/* Pilihan Status Berhalangan */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                Pilih Status Berhalangan:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIzinStatus('Izin')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 text-center ${
                    izinStatus === 'Izin'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 shadow-sm ring-2 ring-amber-400/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-amber-300 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-amber-500 mb-1" />
                  <span className="font-bold text-sm">Izin Mengajar</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">Ada Keperluan / Udzur</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIzinStatus('Sakit')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 text-center ${
                    izinStatus === 'Sakit'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 shadow-sm ring-2 ring-blue-400/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-blue-500 mb-1" />
                  <span className="font-bold text-sm">Sakit</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">Kondisi Badan Tidak Fit</span>
                </button>
              </div>
            </div>

            {/* Alasan / Keterangan */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Alasan / Keterangan:
              </label>
              <textarea
                rows={3}
                value={izinKeterangan}
                onChange={(e) => setIzinKeterangan(e.target.value)}
                placeholder={izinStatus === 'Sakit' ? 'Contoh: Sakit demam tinggi sejak semalam...' : 'Contoh: Ada keperluan mendesak keluarga di luar kota...'}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-amber-500 transition"
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
                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/80 dark:hover:bg-gray-600 text-[11px] text-gray-700 dark:text-gray-300 rounded-lg transition active:scale-95 text-center"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Opsi Tunjuk Guru Pengganti (Badal) */}
            <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/40 rounded-2xl p-4 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🎖️</span>
                  <div>
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Tunjuk Guru Pengganti (Badal)</span>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Pilih dewan guru atau ketik nama pengganti (luar dewan guru)</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={useBadal}
                  onChange={(e) => {
                    setUseBadal(e.target.checked);
                    if (!e.target.checked) {
                      setSelectedBadalId('');
                      setSelectedBadalNama('');
                      setIsManualBadal(false);
                      setBadalSearch('');
                      setShowBadalDropdown(false);
                    }
                  }}
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-600 cursor-pointer"
                />
              </label>

              {useBadal && (
                <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 space-y-2 animate-in fade-in duration-200">
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300">
                    Pilih atau Ketik Ustadz / Ustadzah Pengganti:
                  </label>

                  {/* Jika sudah ada yang dipilih */}
                  {selectedBadalNama ? (
                    <div className="bg-white dark:bg-gray-900 border border-emerald-300 dark:border-emerald-700 rounded-xl p-3 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                          {selectedBadalNama.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                            Ust. {selectedBadalNama}
                          </p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            {isManualBadal ? '✏️ Badal Manual (Luar Data Dewan Guru)' : '🎖️ Dewan Guru Terdaftar'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBadalId('');
                          setSelectedBadalNama('');
                          setIsManualBadal(false);
                          setBadalSearch('');
                          setShowBadalDropdown(true);
                        }}
                        className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold px-2 py-1 bg-rose-50 dark:bg-rose-950/40 rounded-lg transition active:scale-95"
                      >
                        Ganti / Batal
                      </button>
                    </div>
                  ) : (
                    /* Searchable Input + Dropdown */
                    <div className="space-y-1.5 relative">
                      <div className="relative">
                        <Search size={15} className="absolute left-3 top-3 text-gray-400" />
                        <input
                          type="text"
                          value={badalSearch}
                          onChange={(e) => {
                            setBadalSearch(e.target.value);
                            setShowBadalDropdown(true);
                          }}
                          onFocus={() => setShowBadalDropdown(true)}
                          placeholder="Ketik nama untuk mencari guru atau ketik nama baru..."
                          className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-900 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                        />
                      </div>

                      {/* Dropdown Hasil Pencarian & Opsi Manual */}
                      {showBadalDropdown && (
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 z-20">
                          {/* Opsi Gunakan Nama Manual */}
                          {badalSearch.trim().length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBadalId('');
                                setSelectedBadalNama(badalSearch.trim());
                                setIsManualBadal(true);
                                setShowBadalDropdown(false);
                              }}
                              className="w-full text-left p-2.5 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition flex items-center gap-2 text-amber-800 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
                            >
                              <span className="text-base shrink-0">✏️</span>
                              <div>
                                <p className="text-xs font-bold">
                                  Gunakan &quot;{badalSearch.trim()}&quot;
                                </p>
                                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                                  (Badal manual selain dewan guru: Santri Senior / Alumni / Ustadz Tamu)
                                </p>
                              </div>
                            </button>
                          )}

                          {/* List Dewan Guru */}
                          {listGuru
                            .filter((g) => {
                              if (jadwalInfo?.guru_nama && g.nama === jadwalInfo.guru_nama) return false;
                              if (!badalSearch.trim()) return true;
                              const q = badalSearch.toLowerCase();
                              return (g.nama && g.nama.toLowerCase().includes(q)) || (g.no_hp && g.no_hp.includes(q));
                            })
                            .map((g) => (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => {
                                  setSelectedBadalId(String(g.id));
                                  setSelectedBadalNama(g.nama);
                                  setIsManualBadal(false);
                                  setShowBadalDropdown(false);
                                  setBadalSearch('');
                                }}
                                className="w-full text-left p-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition flex items-center justify-between"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-[10px]">
                                    {g.nama ? g.nama.substring(0, 2).toUpperCase() : 'U'}
                                  </div>
                                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                    {g.nama}
                                  </span>
                                </div>
                                {g.no_hp && (
                                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                                    {g.no_hp}
                                  </span>
                                )}
                              </button>
                            ))}

                          {listGuru.filter((g) => {
                            if (jadwalInfo?.guru_nama && g.nama === jadwalInfo.guru_nama) return false;
                            if (!badalSearch.trim()) return true;
                            const q = badalSearch.toLowerCase();
                            return (g.nama && g.nama.toLowerCase().includes(q)) || (g.no_hp && g.no_hp.includes(q));
                          }).length === 0 && !badalSearch.trim() && (
                            <div className="p-3 text-center text-xs text-gray-400">
                              Tidak ada data guru lain
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                    💡 Cari nama ustadz terdaftar, atau ketik nama santri senior/alumni jika dibadali pihak luar. Tautan &amp; token absensi otomatis siap diteruskan ke badal.
                  </p>
                </div>
              )}
            </div>

            {/* Foto Bukti / Surat Dokter */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Foto Surat Dokter / Bukti (Opsional):
              </label>
              <label className="border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-gray-50/50 dark:bg-gray-900/30">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleIzinPhotoUpload}
                  className="hidden"
                />
                <Camera size={24} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {izinFoto ? 'Ganti Foto Bukti' : 'Pilih atau Ambil Foto Bukti'}
                </span>
                <span className="text-[10px] text-gray-400">JPG, PNG (Opsional)</span>
              </label>

              {izinFoto && (
                <div className="mt-3 relative w-full h-40 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  <img src={izinFoto} alt="Bukti Izin" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setIzinFoto(null)}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-700 transition"
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Tombol Submit */}
            <button
              type="submit"
              disabled={submittingIzin}
              className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white transition-all shadow-md flex items-center justify-center gap-2 active:scale-98 ${
                submittingIzin
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
              }`}
            >
              {submittingIzin ? (
                <span>Menyimpan Permohonan...</span>
              ) : (
                <>
                  <Send size={16} />
                  <span>Kirim Status {izinStatus}</span>
                </>
              )}
            </button>
          </form>
        )
      ) : (
        <>
          {/* Set Massal 4 Tombol */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 mb-4 animate-in fade-in duration-300">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5">⚡ Set Massal ({murid.length} Santri)</p>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => setAllStatus('Hadir')}
                className="py-2.5 text-xs font-bold rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border dark:border-emerald-800/60 transition-all active:scale-95"
              >
                Hadir All
              </button>
              <button
                onClick={() => setAllStatus('Izin')}
                className="py-2.5 text-xs font-bold rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 dark:border dark:border-amber-800/60 transition-all active:scale-95"
              >
                Izin All
              </button>
              <button
                onClick={() => setAllStatus('Sakit')}
                className="py-2.5 text-xs font-bold rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 dark:border dark:border-blue-800/60 transition-all active:scale-95"
              >
                Sakit All
              </button>
              <button
                onClick={() => setAllStatus('Alpha')}
                className="py-2.5 text-xs font-bold rounded-xl bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300 dark:border dark:border-red-800/60 transition-all active:scale-95"
              >
                Alpha All
              </button>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">
                    <th className="py-4 px-6">Santri</th>
                    <th className="py-4 px-6 text-center">Status Kehadiran</th>
                    <th className="py-4 px-6">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                  {(() => {
                    let tableCounter = 0;
                    return classNames.map((kelasNama) => {
                      const listSantri = groupedMurid[kelasNama] || [];
                      return (
                        <React.Fragment key={kelasNama}>
                          {isMultiClass && (
                            <tr className="bg-emerald-50/80 dark:bg-emerald-950/40 border-y border-emerald-200 dark:border-emerald-800/60">
                              <td colSpan={3} className="py-2.5 px-6 font-bold text-xs text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                                <div className="flex items-center gap-2">
                                  <BookOpen size={14} className="text-emerald-600 dark:text-emerald-400" />
                                  <span>--- KELAS {kelasNama.toUpperCase()} ({listSantri.length} Santri) ---</span>
                                </div>
                              </td>
                            </tr>
                          )}
                          {listSantri.map((item: any) => {
                            tableCounter++;
                            const idx = tableCounter;
                            const fotoUrl = getFotoUrl(item.foto, item.nis);
                            return (
                              <tr key={item.murid_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                                <td className="py-4 px-6">
                                  <div className="flex items-center gap-3">
                                    <div
                                      onClick={() => fotoUrl && setZoomPhoto(fotoUrl)}
                                      style={{ backgroundColor: getAvatarColor(item.nama) }}
                                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-extrabold shadow-sm shrink-0 uppercase select-none overflow-hidden ${
                                        fotoUrl ? 'cursor-pointer hover:opacity-90 hover:scale-105 transition-all' : ''
                                      }`}
                                      title={fotoUrl ? 'Klik untuk memperbesar foto' : ''}
                                    >
                                      {fotoUrl ? (
                                        <img
                                          src={fotoUrl}
                                          alt={item.nama}
                                          className="w-full h-full object-cover"
                                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                      ) : (
                                        <span>{getInitials(item.nama)}</span>
                                      )}
                                    </div>
                                    <div>
                                      <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                        <span className="text-gray-400 font-semibold text-xs">{idx}.</span>
                                        <span>{item.nama}</span>
                                      </div>
                                      {/* Input Nama Panggilan Desktop */}
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-[11px] text-gray-400 font-medium">Panggilan:</span>
                                        <input
                                          type="text"
                                          placeholder="Panggilan..."
                                          value={item.nama_panggilan || ''}
                                          onChange={(e) => handleNamaPanggilanChange(item.murid_id, e.target.value)}
                                          className="px-2 py-0.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-xs font-bold text-emerald-600 dark:text-emerald-400 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[130px]"
                                        />
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5 flex items-center gap-2">
                                        <span>NIS: {item.nis}</span>
                                        {item.nama_wali && (
                                          <span>• Wali: <strong className="text-gray-700 dark:text-gray-300">{item.nama_wali}</strong></span>
                                        )}
                                      </div>
                                      {item.alamat && (
                                        <div className="text-[11px] text-gray-400 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                                          <MapPin size={11} className="text-teal-500 shrink-0" />
                                          <span className="line-clamp-1">{item.alamat}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-6">
                                  <div className="flex items-center justify-center gap-1 bg-gray-50 dark:bg-gray-900 p-1 rounded-xl w-max mx-auto border border-gray-100 dark:border-gray-800">
                                    {['Hadir', 'Izin', 'Sakit', 'Alpha'].map((st) => (
                                      <button
                                        key={st}
                                        type="button"
                                        onClick={() => handleStatusChange(item.murid_id, st)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                          item.status === st
                                            ? st === 'Hadir'
                                              ? 'bg-green-600 text-white shadow-sm'
                                              : st === 'Izin'
                                              ? 'bg-blue-600 text-white shadow-sm'
                                              : st === 'Sakit'
                                              ? 'bg-amber-600 text-white shadow-sm'
                                              : 'bg-red-600 text-white shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                      >
                                        {st}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-4 px-6">
                                  <input
                                    type="text"
                                    placeholder="Keterangan..."
                                    value={item.keterangan || ''}
                                    onChange={(e) => handleKeteranganChange(item.murid_id, e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (Dikelompokkan Berdasarkan Kelas jika Kelas Gabungan) */}
          <div className="md:hidden space-y-6">
            {(() => {
              let mobileCounter = 0;
              return classNames.map((kelasNama) => {
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
                    {listSantri.map((item: any) => {
                      mobileCounter++;
                      const idx = mobileCounter;
                      const fotoUrl = getFotoUrl(item.foto, item.nis);
                      return (
                        <div
                          key={item.murid_id}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition"
                        >
                          {/* Header Row: Foto + Nama Lengkap */}
                          <div className="flex items-start gap-3">
                            {/* Avatar / Foto Santri (Klik untuk Zoom) */}
                            <div
                              onClick={() => fotoUrl && setZoomPhoto(fotoUrl)}
                              className={`w-12 h-12 rounded-xl shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center relative mt-0.5 ${
                                fotoUrl ? 'cursor-pointer hover:opacity-90 hover:scale-105 transition-all' : ''
                              }`}
                              style={{ backgroundColor: getAvatarColor(item.nama) }}
                              title={fotoUrl ? 'Klik untuk memperbesar foto' : ''}
                            >
                              {fotoUrl ? (
                                <img
                                  src={fotoUrl}
                                  alt={item.nama}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <span className="text-white font-bold text-xs">{getInitials(item.nama)}</span>
                              )}
                            </div>

                            {/* Nama Santri (Maksimal 2 Baris) */}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">
                                <span className="text-slate-400 font-semibold text-xs mr-1">{idx}.</span>
                                {item.nama}
                              </h3>
                            </div>
                          </div>

                          {/* Input Nama Panggilan — Baris tersendiri, rata kiri sejajar NIS & Alamat */}
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0 font-medium">Panggilan:</span>
                            <input
                              type="text"
                              placeholder="Panggilan..."
                              value={item.nama_panggilan || ''}
                              onChange={(e) => handleNamaPanggilanChange(item.murid_id, e.target.value)}
                              className="flex-1 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-700 dark:text-emerald-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition"
                            />
                          </div>

                          {/* Info Detail: NIS, Wali & Alamat */}
                          <div className="space-y-1 pt-0.5 text-xs">
                            {/* NIS & Wali dalam Satu Baris */}
                            <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-600 dark:text-slate-300">
                              <span className="font-mono text-slate-400">NIS: <strong className="text-slate-700 dark:text-slate-200">{item.nis || '-'}</strong></span>
                              <span className="text-slate-300 dark:text-slate-600">•</span>
                              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 truncate">
                                <User size={11} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <span>Wali: <strong className="text-slate-700 dark:text-slate-200">{item.nama_wali || '-'}</strong></span>
                              </div>
                            </div>

                            {/* Alamat Maksimal 2 Baris */}
                            {item.alamat && (
                              <div className="flex items-start gap-1 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                                <MapPin size={12} className="shrink-0 text-teal-600 dark:text-teal-400 mt-0.5" />
                                <span className="line-clamp-2" title={item.alamat}>
                                  Alamat: <span className="text-slate-700 dark:text-slate-300">{item.alamat}</span>
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Status Options Buttons (4 Tombol) */}
                          <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                            {[
                              { id: 'Hadir', label: 'Hadir', bgActive: 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-900/50', bgInactive: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200' },
                              { id: 'Izin', label: 'Izin', bgActive: 'bg-amber-600 text-white font-bold shadow-md shadow-amber-900/50', bgInactive: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200' },
                              { id: 'Sakit', label: 'Sakit', bgActive: 'bg-blue-600 text-white font-bold shadow-md shadow-blue-900/50', bgInactive: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200' },
                              { id: 'Alpha', label: 'Alpha', bgActive: 'bg-rose-600 text-white font-bold shadow-md shadow-rose-900/50', bgInactive: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200' }
                            ].map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleStatusChange(item.murid_id, opt.id)}
                                className={`py-2 text-xs rounded-xl transition text-center font-medium ${item.status === opt.id ? opt.bgActive : opt.bgInactive}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {/* Catatan / Keterangan (hanya jika bukan Hadir) */}
                          {item.status !== 'Hadir' && (
                            <div>
                              <input
                                type="text"
                                placeholder="Masukkan catatan (alasan izin/sakit/keterangan)..."
                                value={item.keterangan || ''}
                                onChange={(e) => handleKeteranganChange(item.murid_id, e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
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
        </>
      )}

      {/* Modal Pop-up Gagal Absensi / Peringatan Jarak & GPS */}
      {showErrorModal && errorMsg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800/80 rounded-3xl p-6 max-w-md w-full text-center shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto border border-red-200 dark:border-red-800">
              <AlertCircle size={36} />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-red-700 dark:text-red-300 mb-1.5">
                {errorMsg.toLowerCase().includes('jarak') || errorMsg.toLowerCase().includes('radius')
                  ? 'Absensi Ditolak (Di Luar Radius)'
                  : errorMsg.toLowerCase().includes('gps') || errorMsg.toLowerCase().includes('lokasi')
                  ? 'Izin Lokasi (GPS) Diperlukan'
                  : 'Gagal Menyimpan Absensi'}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed max-w-sm mx-auto">
                {errorMsg}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {(errorMsg.toLowerCase().includes('gps') || errorMsg.toLowerCase().includes('lokasi') || errorMsg.toLowerCase().includes('jarak')) && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowErrorModal(false);
                      requestGpsLocation();
                    }}
                    disabled={detectingLocation}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                  >
                    {detectingLocation ? (
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
                    className="w-full py-2.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 active:scale-95 text-amber-750 dark:text-amber-300 font-bold text-xs rounded-xl border border-amber-300 dark:border-amber-700 transition flex items-center justify-center gap-1.5"
                  >
                    <HelpCircle size={14} /> Panduan Buka Izin GPS
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setShowErrorModal(false)}
                className="w-full py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 text-gray-700 dark:text-gray-300 font-semibold text-xs rounded-xl transition"
              >
                Tutup Pemberitahuan
              </button>
            </div>
          </div>
        </div>
      )}

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
