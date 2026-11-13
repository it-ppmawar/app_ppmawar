'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles, Award, Clock, CheckCircle, AlertCircle, AlertTriangle,
  ShieldCheck, MapPin, Key, RefreshCw, Play, Plus, Trash2, Edit3,
  BookOpen, User, Users, FileText, ChevronRight, ChevronLeft, ChevronDown, Flag, X,
  ExternalLink, Lock, Unlock, HelpCircle, Check, ArrowRight,
  Filter, Search, Layers, Radio, Settings, Sun, Moon
} from 'lucide-react';

interface ExamItem {
  id: number;
  judul: string;
  deskripsi: string | null;
  mata_pelajaran: string;
  kitab: string | null;
  kelas_madin_id: number | null;
  nama_kelas?: string;
  nama_guru?: string;
  semester: string;
  tahun_ajaran: string;
  jenis_ujian: 'harian' | 'uts' | 'uas';
  durasi_menit: number;
  passing_grade: number;
  acak_soal: number;
  acak_opsi: number;
  anti_curang?: number;
  max_pelanggaran?: number;
  wajib_fullscreen?: number;
  is_active: number;
  quizb_id: string | null;
  quizb_embed_url: string | null;
  token_ujian?: string;
  wajib_token?: number;
  wajib_geofence?: number;
  max_radius_meter?: number;
  status_sesi?: 'tertutup' | 'buka' | 'selesai';
  total_soal?: number;
  total_peserta?: number;
  // Santri result (jika sudah mengerjakan)
  hasil_id?: number | null;
  skor_akhir?: number | null;
  jumlah_benar?: number | null;
  jumlah_salah?: number | null;
  status_lulus?: number | null;
  status_koreksi?: 'selesai' | 'menunggu_koreksi';
  waktu_selesai?: string | null;
}

interface QuestionItem {
  id: number;
  ujian_id: number;
  tipe_soal?: 'pilihan_ganda' | 'essay';
  nomor_urut: number;
  pertanyaan: string;
  gambar?: string | null;
  opsi_a: string;
  opsi_b: string;
  opsi_c: string;
  opsi_d?: string | null;
  opsi_e?: string | null;
  kunci_jawaban?: string;
  rubrik_kata_kunci?: string | null;
  bobot_nilai: number;
  pembahasan?: string | null;
}

// Helper untuk menentukan URL Foto Santri (Lokal vs Mitra)
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

export default function UjianCBTPage() {
  const [role, setRole] = useState<string>('santri');
  const [santriInfo, setSantriInfo] = useState<any>(null);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [mapelList, setMapelList] = useState<{ id: number; mata_pelajaran: string; kitab?: string }[]>([]);
  const [isCustomMapelInput, setIsCustomMapelInput] = useState(false);

  // Tab Utama: 'daftar' (Ujian Aktif / Berlangsung) vs 'kelola' (Manajemen & Bank Soal Guru/Admin)
  const [mainTab, setMainTab] = useState<'daftar' | 'kelola'>('daftar');

  // Filter
  const [searchQ, setSearchQ] = useState('');
  const [filterJenis, setFilterJenis] = useState('ALL');

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamItem | null>(null);
  const [formExam, setFormExam] = useState<any>({
    judul: '',
    deskripsi: '',
    mata_pelajaran: '',
    kitab: '',
    kelas_madin_id: '',
    semester: '1',
    tahun_ajaran: '2025/2026',
    jenis_ujian: 'harian',
    durasi_menit: 45,
    passing_grade: 70,
    acak_soal: 1,
    acak_opsi: 1,
    anti_curang: 1,
    max_pelanggaran: 3,
    wajib_fullscreen: 1,
    wajib_token: 1,
    wajib_geofence: 1,
    max_radius_meter: 200,
    quizb_id: '',
  });

  // Modal Soal
  const [showSoalModal, setShowSoalModal] = useState(false);
  const [selectedExamForSoal, setSelectedExamForSoal] = useState<ExamItem | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const formEditSoalRef = useRef<HTMLFormElement>(null);
  const modalSoalBodyRef = useRef<HTMLDivElement>(null);

  // State Import Soal dari QuizB
  const [quizImportSearch, setQuizImportSearch] = useState('');
  const [quizImportId, setQuizImportId] = useState('');
  const [quizImportList, setQuizImportList] = useState<any[]>([]);
  const [quizImportQuestions, setQuizImportQuestions] = useState<any[]>([]);
  const [loadingImportQuestions, setLoadingImportQuestions] = useState(false);
  const [selectedImportQids, setSelectedImportQids] = useState<Set<number>>(new Set());
  const [importingQuestions, setImportingQuestions] = useState(false);
  const [importFeedback, setImportFeedback] = useState('');

  // State Dedicated Modal Impor Paket Kuis dari QuizB
  const [showQuizBImportModal, setShowQuizBImportModal] = useState(false);
  const [quizBModalId, setQuizBModalId] = useState('');
  const [quizBModalSearch, setQuizBModalSearch] = useState('');
  const [showQuizBDropdownList, setShowQuizBDropdownList] = useState(false);
  const quizBDropdownRef = useRef<HTMLDivElement>(null);
  const [quizBModalQuestions, setQuizBModalQuestions] = useState<any[]>([]);
  const [quizBModalError, setQuizBModalError] = useState('');
  const [loadingQuizBModalQuestions, setLoadingQuizBModalQuestions] = useState(false);
  const [importingQuizBPaket, setImportingQuizBPaket] = useState(false);
  const [quizBModalForm, setQuizBModalForm] = useState<any>({
    judul: '',
    mata_pelajaran: '',
    kelas_madin_id: '',
    semester: '1',
    tahun_ajaran: '2025/2026',
    jenis_ujian: 'harian',
    durasi_menit: 45,
    passing_grade: 70,
  });

  // Checkbox auto import di Modal Buat Ujian Biasa
  const [autoImportQuestionsOnCreate, setAutoImportQuestionsOnCreate] = useState(true);
  const [formQuestion, setFormQuestion] = useState<any>({
    tipe_soal: 'pilihan_ganda',
    pertanyaan: '',
    opsi_a: '',
    opsi_b: '',
    opsi_c: '',
    opsi_d: '',
    opsi_e: '',
    kunci_jawaban: 'A',
    rubrik_kata_kunci: '',
    bobot_nilai: 10,
    pembahasan: '',
  });

  // State Template & Import Soal Excel
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const [importingExcelSoal, setImportingExcelSoal] = useState(false);

  // State Anti-Pindah Layar & Proctoring Pelanggaran
  const [violationCount, setViolationCount] = useState(0);
  const violationCountRef = useRef<number>(0);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const isDisqualifiedRef = useRef<boolean>(false);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [violationModalMsg, setViolationModalMsg] = useState('');
  const [violationLogs, setViolationLogs] = useState<Array<{ time: string; reason: string }>>([]);
  const violationLogsRef = useRef<Array<{ time: string; reason: string }>>([]);
  const [showFsToast, setShowFsToast] = useState(false);
  const userAnswersRef = useRef<Record<string, string>>({});
  const lastViolationTimeRef = useRef<number>(0);
  const isViolationModalOpenRef = useRef<boolean>(false);

  // State Modal Koreksi Essay & Asisten AI
  const [showEssayModal, setShowEssayModal] = useState(false);
  const [selectedExamForEssay, setSelectedExamForEssay] = useState<ExamItem | null>(null);
  const [essayStudentAnswers, setEssayStudentAnswers] = useState<any[]>([]);
  const [loadingEssayAnswers, setLoadingEssayAnswers] = useState(false);
  const [runningAiGrading, setRunningAiGrading] = useState(false);
  const [savingGrades, setSavingGrades] = useState(false);
  const [essayGradesDraft, setEssayGradesDraft] = useState<Record<number, { skor_final: number; catatan_guru: string }>>({});

  // Modal Sesi & Token Pengawas
  const [showSesiModal, setShowSesiModal] = useState(false);
  const [selectedExamForSesi, setSelectedExamForSesi] = useState<ExamItem | null>(null);
  const [sesiData, setSesiData] = useState<any>(null);
  const [loadingSesi, setLoadingSesi] = useState(false);
  const [geofenceRadius, setGeofenceRadius] = useState<number>(100);
  const [geofenceLoading, setGeofenceLoading] = useState(false);
  const [geofenceMsg, setGeofenceMsg] = useState('');
  const [defaultPesantrenCoords, setDefaultPesantrenCoords] = useState<any>(null);

  // State Pelaksanaan Ujian (CBT Exam Player)
  const [activeExam, setActiveExam] = useState<ExamItem | null>(null);
  const [examStep, setExamStep] = useState<'pre_check' | 'in_progress' | 'completed' | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsDistance, setGpsDistance] = useState<number | null>(null);
  const [preCheckError, setPreCheckError] = useState('');
  const [validatingPreCheck, setValidatingPreCheck] = useState(false);

  // Exam Player State
  const [examQuestions, setExamQuestions] = useState<QuestionItem[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submittingExam, setSubmittingExam] = useState(false);
  const [examResult, setExamResult] = useState<any>(null);

  // Sinkronkan ref jawaban & modal pelanggaran untuk mencegah stale closure & spam strikes
  useEffect(() => {
    userAnswersRef.current = userAnswers;
  }, [userAnswers]);

  useEffect(() => {
    isViolationModalOpenRef.current = showViolationModal;
  }, [showViolationModal]);

  useEffect(() => {
    if (showFsToast) {
      const timer = setTimeout(() => setShowFsToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showFsToast]);

  // State Mode Terang / Gelap di Layar Penuh Ujian Santri
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark') || localStorage.theme === 'dark';
      setIsDarkMode(isDark);
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    }
  };

  // State Modal Ruang Pengawasan Live Proctoring (Guru / Admin)
  const [showLiveProctorModal, setShowLiveProctorModal] = useState(false);
  const [selectedExamForLive, setSelectedExamForLive] = useState<ExamItem | null>(null);
  const [liveProctorData, setLiveProctorData] = useState<any>(null);
  const [loadingLiveProctor, setLoadingLiveProctor] = useState(false);
  const [liveProctorFilter, setLiveProctorFilter] = useState<'semua' | 'sedang_mengerjakan' | 'belum_masuk' | 'selesai' | 'didiskualifikasi'>('semua');
  const [liveAutoRefresh, setLiveAutoRefresh] = useState(true);
  const [liveCountdown, setLiveCountdown] = useState(5);
  const [actionResetLoading, setActionResetLoading] = useState<number | null>(null);

  // Fungsi Fetch Data Live Proctoring
  const fetchLiveProctorData = async (examId: number) => {
    setLoadingLiveProctor(true);
    try {
      const res = await fetch(`/api/ujian/live-proctor?ujian_id=${examId}&t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        setLiveProctorData(data);
      }
    } catch (e) {
      console.error('Error fetching live proctor data:', e);
    } finally {
      setLoadingLiveProctor(false);
    }
  };

  const openLiveProctorModal = (exam: ExamItem) => {
    setSelectedExamForLive(exam);
    setShowLiveProctorModal(true);
    setLiveProctorFilter('semua');
    setLiveCountdown(5);
    fetchLiveProctorData(exam.id);
  };

  // Auto-refresh interval 5 detik saat modal live proctor terbuka
  useEffect(() => {
    if (!showLiveProctorModal || !selectedExamForLive || !liveAutoRefresh) return;

    const timer = setInterval(() => {
      setLiveCountdown((prev) => {
        if (prev <= 1) {
          fetchLiveProctorData(selectedExamForLive.id);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showLiveProctorModal, selectedExamForLive, liveAutoRefresh]);

  // Handler Reset Sesi Santri (Dispensasi / Kendala Teknis)
  const handleResetSantriLive = async (muridId: number, namaMurid: string) => {
    if (!selectedExamForLive) return;
    if (!confirm(`Apakah Anda yakin ingin mereset sesi santri "${namaMurid}"?\n\nSantri akan diizinkan masuk dan mengerjakan kembali ujian dari awal.`)) {
      return;
    }

    setActionResetLoading(muridId);
    try {
      const res = await fetch('/api/ujian/live-proctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_santri',
          ujian_id: selectedExamForLive.id,
          target_murid_id: muridId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchLiveProctorData(selectedExamForLive.id);
        fetchExams();
      } else {
        alert(data.error || 'Gagal mereset sesi santri.');
      }
    } catch (e: any) {
      alert('Terjadi kesalahan: ' + e.message);
    } finally {
      setActionResetLoading(null);
    }
  };

  // Heartbeat live sync setiap 8 detik saat santri sedang mengerjakan ujian
  useEffect(() => {
    if (examStep !== 'in_progress' || !activeExam) return;

    const sendHeartbeat = async (extraAction = 'heartbeat') => {
      try {
        await fetch('/api/ujian/live-proctor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: extraAction,
            ujian_id: activeExam.id,
            jumlah_terjawab: Object.keys(userAnswersRef.current || {}).length,
            jumlah_ragu: flaggedQuestions.size,
            total_soal: examQuestions.length,
            jumlah_pelanggaran: violationCount,
            is_disqualified: isDisqualified,
            log_pelanggaran: violationLogs,
          }),
        });
      } catch (err) {
        // silent heartbeat error
      }
    };

    // Kirim join awal
    sendHeartbeat('join');

    // Interval heartbeat tiap 8 detik
    const interval = setInterval(() => {
      sendHeartbeat('heartbeat');
    }, 8000);

    return () => clearInterval(interval);
  }, [examStep, activeExam, violationCount, isDisqualified, flaggedQuestions.size]);

  // SSO Embed Modal
  const [ssoUrl, setSsoUrl] = useState<string | null>(null);

  // Modal Lihat Hasil Peserta (guru/admin)
  const [showHasilModal, setShowHasilModal] = useState(false);
  const [selectedExamForHasil, setSelectedExamForHasil] = useState<ExamItem | null>(null);
  const [hasilPeserta, setHasilPeserta] = useState<any[]>([]);
  const [hasilStatistik, setHasilStatistik] = useState<any>(null);
  const [hasilError, setHasilError] = useState<string>('');
  const [loadingHasil, setLoadingHasil] = useState(false);

  const fetchHasilPeserta = async (exam: ExamItem) => {
    setLoadingHasil(true);
    setHasilPeserta([]);
    setHasilStatistik(null);
    setHasilError('');
    try {
      const res = await fetch(`/api/ujian/hasil?ujian_id=${exam.id}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setHasilError(data.error || 'Gagal memuat hasil peserta');
      } else if (data.hasil) {
        setHasilPeserta(Array.isArray(data.hasil) ? data.hasil : [data.hasil]);
        setHasilStatistik(data.statistik || null);
      }
    } catch (e: any) {
      console.error('Gagal ambil hasil peserta', e);
      setHasilError(e.message || 'Koneksi gagal');
    } finally {
      setLoadingHasil(false);
    }
  };

  const userRoleLower = (role || '').toLowerCase();
  const isPengajarOrAdmin = ['admin', 'staff', 'guru', 'pengasuh', 'pengurus_asrama'].includes(userRoleLower);

  // 1. Load Data Ujian
  const fetchExams = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ujian');
      const data = await res.json();
      if (data.success) {
        setExams(data.exams || []);
        if (data.role) setRole(data.role.toLowerCase());
        if (data.santri) setSantriInfo(data.santri);
      }
    } catch (err) {
      console.error('Failed to fetch exams', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.success && data.user?.role) {
        setRole(data.user.role.toLowerCase());
      }
    } catch (e) {}
  };

  const fetchMapelList = async (targetKelasId?: string | number | null) => {
    try {
      const url = targetKelasId ? `/api/ujian/mapel?kelas_id=${targetKelasId}` : '/api/ujian/mapel';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.mapel)) {
        setMapelList(data.mapel);
      }
    } catch (e) {
      console.error('Failed to fetch mapel list', e);
    }
  };

  const fetchKelasList = async (targetMapel?: string | null) => {
    try {
      const url = targetMapel && targetMapel.trim() !== ''
        ? `/api/ujian/kelas?mata_pelajaran=${encodeURIComponent(targetMapel.trim())}`
        : '/api/ujian/kelas';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.kelas)) {
        setKelasList(data.kelas);
      }
    } catch (e) {
      console.error('Failed to fetch kelas list', e);
    }
  };

  const openCreateModal = () => {
    setEditingExam(null);
    setIsCustomMapelInput(false);
    setAutoImportQuestionsOnCreate(true);
    setFormExam({
      judul: '',
      deskripsi: '',
      mata_pelajaran: '',
      kitab: '',
      kelas_madin_id: '',
      semester: '1',
      tahun_ajaran: '2025/2026',
      jenis_ujian: 'harian',
      durasi_menit: 45,
      passing_grade: 70,
      acak_soal: 1,
      acak_opsi: 1,
      wajib_token: 1,
      wajib_geofence: 1,
      max_radius_meter: 200,
      quizb_id: '',
    });
    fetchKelasList();
    fetchMapelList();
    loadQuizzesForImport();
    setShowCreateModal(true);
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchExams();
    fetchKelasList();
    fetchMapelList();
    loadQuizzesForImport();

    const handleClickOutside = (e: MouseEvent) => {
      if (quizBDropdownRef.current && !quizBDropdownRef.current.contains(e.target as Node)) {
        setShowQuizBDropdownList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 2. Pre-Check: Deteksi GPS Perangkat Santri
  const detectGPS = () => {
    if (!navigator.geolocation) {
      alert('Perangkat Anda tidak mendukung fitur GPS / Geolokasi.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        setPreCheckError('Gagal mendeteksi lokasi: ' + err.message + '. Harap aktifkan izin lokasi di browser Anda.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // 3. Masuk Ruang Ujian (Validasi Token & Geofence)
  const handleStartExamValidation = async () => {
    if (!activeExam) return;
    setValidatingPreCheck(true);
    setPreCheckError('');

    try {
      const res = await fetch('/api/ujian/kerjakan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate',
          ujian_id: activeExam.id,
          token_input: tokenInput,
          user_lat: gpsCoords?.lat || null,
          user_lng: gpsCoords?.lng || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.exam) {
          setActiveExam((prev: any) => ({ ...prev, ...data.exam }));
        }
        setExamQuestions(data.soal || []);
        setSecondsLeft(((data.exam?.durasi_menit || activeExam.durasi_menit) || 45) * 60);
        setCurrentQIndex(0);
        setUserAnswers({});
        userAnswersRef.current = {};
        setFlaggedQuestions(new Set());
        setViolationCount(0);
        violationCountRef.current = 0;
        setIsDisqualified(false);
        isDisqualifiedRef.current = false;
        setViolationLogs([]);
        violationLogsRef.current = [];
        setShowViolationModal(false);
        isViolationModalOpenRef.current = false;
        // Grace period 4 detik saat awal masuk ujian agar inisialisasi fullscreen/animasi tidak dihitung pelanggaran
        lastViolationTimeRef.current = Date.now() + 4000;
        setShowFsToast(true);
        setExamStep('in_progress');

        // Minta Fullscreen jika diwajibkan
        if (data.exam?.wajib_fullscreen && document.documentElement.requestFullscreen) {
          try {
            await document.documentElement.requestFullscreen();
          } catch (fsErr) {
            // Browser mungkin membatasi jika belum interaksi gesture
          }
        }
      } else {
        setPreCheckError(data.error || 'Validasi ujian gagal.');
      }
    } catch (err: any) {
      setPreCheckError('Koneksi gagal: ' + err.message);
    } finally {
      setValidatingPreCheck(false);
    }
  };

  // 4. Timer Countdown Ujian
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (examStep === 'in_progress' && secondsLeft > 0) {
      timer = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmitExam(true, false); // Auto submit saat waktu habis
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [examStep, secondsLeft]);

  // 4B. Anti-Pindah Layar & Proctoring Pelanggaran Ujian
  useEffect(() => {
    if (examStep !== 'in_progress' || !activeExam) return;

    const isAntiCurang = activeExam.anti_curang !== 0;
    const maxViolations = Number(activeExam.max_pelanggaran) || 3;

    if (!isAntiCurang) return;

    const handleViolation = (reason: string) => {
      const now = Date.now();
      // Jangan re-trigger jika modal peringatan sedang aktif di depan santri
      if (isViolationModalOpenRef.current) return;
      // Debounce: Jarak minimal 3500ms (3.5 detik) antar insiden pelanggaran
      // agar kombinasi event (fullscreenchange + window blur + visibilitychange) dalam 1 aksi keluar
      // hanya dihitung sebagai 1 KALI PELANGGARAN!
      if (now - lastViolationTimeRef.current < 3500) return;
      lastViolationTimeRef.current = now;
      isViolationModalOpenRef.current = true;

      setViolationCount((prev) => {
        const newCount = prev + 1;
        violationCountRef.current = newCount;
        const nowStr = new Date().toLocaleTimeString('id-ID');
        const logEntry = { time: nowStr, reason };
        const updatedLogs = [...violationLogsRef.current, logEntry];
        violationLogsRef.current = updatedLogs;
        setViolationLogs(updatedLogs);

        // Laporkan pelanggaran ke server live proctoring secara instan
        fetch('/api/ujian/live-proctor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'violation',
            ujian_id: activeExam.id,
            jumlah_terjawab: Object.keys(userAnswersRef.current || {}).length,
            jumlah_ragu: flaggedQuestions.size,
            total_soal: examQuestions.length,
            jumlah_pelanggaran: newCount,
            is_disqualified: newCount >= maxViolations,
            log_pelanggaran: updatedLogs,
          }),
        }).catch(() => {});

        if (newCount >= maxViolations) {
          // Diskualifikasi & Auto Submit
          setIsDisqualified(true);
          isDisqualifiedRef.current = true;
          setShowViolationModal(true);
          setViolationModalMsg(
            `DISKUALIFIKASI: Anda telah melanggar batas maksimal (${newCount}/${maxViolations}) keluar dari layar ujian (${reason}). Lembar ujian dikunci dan diserahkan otomatis.`
          );
          setTimeout(() => {
            handleSubmitExam(true, true);
          }, 3000);
        } else {
          // Peringatan bertingkat
          setShowViolationModal(true);
          setViolationModalMsg(
            `PERINGATAN KELUAR LAYAR (${newCount}/${maxViolations}): Terdeteksi ${reason}. Ujian ini diawasi secara digital! Sisa toleransi Anda: ${maxViolations - newCount} kali lagi.`
          );
        }
        return newCount;
      });
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        handleViolation('berpindah tab / meminimize browser');
      }
    };

    const onWindowBlur = () => {
      handleViolation('kehilangan fokus layar (jendela lain aktif / split-screen)');
    };

    const onFullscreenChange = () => {
      if (activeExam.wajib_fullscreen && !document.fullscreenElement) {
        handleViolation('keluar dari mode layar penuh (fullscreen)');
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onCopyPaste = (e: ClipboardEvent) => e.preventDefault();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('copy', onCopyPaste);
    document.addEventListener('paste', onCopyPaste);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('copy', onCopyPaste);
      document.removeEventListener('paste', onCopyPaste);
    };
  }, [examStep, activeExam]);

  // 5. Submit Jawaban Ujian
  const handleSubmitExam = async (isAuto = false, disqualified = false) => {
    if (!activeExam) return;
    if (!isAuto && !confirm('Apakah Anda yakin ingin menyelesaikan ujian ini dan mengirimkan seluruh jawaban?')) {
      return;
    }

    setSubmittingExam(true);
    try {
      const durationSeconds = (activeExam.durasi_menit * 60) - secondsLeft;
      const currentAnswers = userAnswersRef.current || userAnswers;
      const res = await fetch('/api/ujian/kerjakan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          ujian_id: activeExam.id,
          answers: currentAnswers,
          durasi_detik: Math.max(durationSeconds, 1),
          token_dipakai: tokenInput,
          user_lat: gpsCoords?.lat || null,
          user_lng: gpsCoords?.lng || null,
          jumlah_pelanggaran: Math.max(
            violationCountRef.current,
            violationCount,
            (disqualified || isDisqualified || isDisqualifiedRef.current) ? (Number(activeExam.max_pelanggaran) || 3) : 0
          ),
          is_disqualified: disqualified || isDisqualified || isDisqualifiedRef.current,
          log_pelanggaran: violationLogsRef.current.length > 0 ? violationLogsRef.current : violationLogs,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setExamResult(data);
        setExamStep('completed');
        setShowViolationModal(false);
        fetchExams(); // Refresh list agar status selesai terupdate
      } else {
        alert(data.error || 'Gagal menyimpan hasil ujian.');
      }
    } catch (err: any) {
      alert('Error saat mengirim jawaban: ' + err.message);
    } finally {
      setSubmittingExam(false);
    }
  };

  // 6. Launch QuizB di Tab Baru (Mencegah blank screen akibat batasan iframe / X-Frame-Options)
  const handleLaunchQuizBSSO = (exam: ExamItem) => {
    const qId = exam.quizb_id || '';
    const targetUrl = qId ? `https://quizb.my.id/#/play/${qId}` : 'https://quizb.my.id/#/quizzes';
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  // 7. Pengelolaan Soal
  const openSoalManager = async (exam: ExamItem) => {
    setSelectedExamForSoal(exam);
    setShowSoalModal(true);
    setLoadingQuestions(true);
    setEditingQuestion(null);
    setFormQuestion({
      tipe_soal: 'pilihan_ganda',
      pertanyaan: '',
      opsi_a: '',
      opsi_b: '',
      opsi_c: '',
      opsi_d: '',
      opsi_e: '',
      kunci_jawaban: 'A',
      rubrik_kata_kunci: '',
      bobot_nilai: 10,
      pembahasan: '',
    });
    // Reset state import soal
    setQuizImportId('');
    setQuizImportSearch('');
    setQuizImportQuestions([]);
    setSelectedImportQids(new Set());
    setImportFeedback('');
    // Load daftar kuis QuizB untuk import
    loadQuizzesForImport();
    try {
      const res = await fetch(`/api/ujian/soal?ujian_id=${exam.id}`);
      const data = await res.json();
      if (data.success) {
        setQuestions(data.soal || []);
      }
    } catch (e) {
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleStartEditQuestion = (q: QuestionItem, index: number) => {
    const questionWithNumber = {
      ...q,
      nomor_urut: q.nomor_urut || index + 1,
    };
    setEditingQuestion(questionWithNumber);
    setFormQuestion({
      tipe_soal: q.tipe_soal || 'pilihan_ganda',
      pertanyaan: q.pertanyaan,
      opsi_a: q.opsi_a || '',
      opsi_b: q.opsi_b || '',
      opsi_c: q.opsi_c || '',
      opsi_d: q.opsi_d || '',
      opsi_e: q.opsi_e || '',
      kunci_jawaban: q.kunci_jawaban || (q.tipe_soal === 'essay' ? '' : 'A'),
      rubrik_kata_kunci: q.rubrik_kata_kunci || '',
      bobot_nilai: q.bobot_nilai || 10,
      pembahasan: q.pembahasan || '',
    });

    // Autoscroll ke kolom edit soal secara mulus
    setTimeout(() => {
      if (formEditSoalRef.current) {
        formEditSoalRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (modalSoalBodyRef.current) {
        modalSoalBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 50);
  };

  // Handler Download Template Soal Excel
  const handleDownloadTemplate = () => {
    window.open('/api/ujian/template-soal', '_blank');
  };

  // Handler Upload Excel Soal
  const handleExcelFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedExamForSoal) return;

    setImportingExcelSoal(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ujian_id', String(selectedExamForSoal.id));

      const res = await fetch('/api/ujian/soal/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        alert(`Alhamdulillah! ${data.message}`);
        openSoalManager(selectedExamForSoal);
        fetchExams();
      } else {
        alert(data.error || 'Gagal mengimpor file Excel.');
      }
    } catch (err: any) {
      alert('Error saat mengupload Excel: ' + err.message);
    } finally {
      setImportingExcelSoal(false);
      if (excelFileInputRef.current) excelFileInputRef.current.value = '';
    }
  };

  // Handler Modal Koreksi Essay & Asisten AI
  const openEssayReviewModal = async (exam: ExamItem) => {
    setSelectedExamForEssay(exam);
    setShowEssayModal(true);
    setLoadingEssayAnswers(true);
    setEssayStudentAnswers([]);
    setEssayGradesDraft({});

    try {
      const res = await fetch(`/api/ujian/essay?ujian_id=${exam.id}`);
      const data = await res.json();
      if (data.success) {
        const list = data.essay_list || [];
        setEssayStudentAnswers(list);
        const draft: Record<number, { skor_final: number; catatan_guru: string }> = {};
        list.forEach((item: any) => {
          draft[item.id] = {
            skor_final: item.skor_final !== null ? Number(item.skor_final) : (item.skor_ai !== null ? Number(item.skor_ai) : Number(item.bobot_maksimal)),
            catatan_guru: item.catatan_guru || '',
          };
        });
        setEssayGradesDraft(draft);
      }
    } catch (err: any) {
      console.error('Error fetching essay list:', err);
    } finally {
      setLoadingEssayAnswers(false);
    }
  };

  const handleRunAiGrading = async (essayId?: number) => {
    if (!selectedExamForEssay) return;
    setRunningAiGrading(true);
    try {
      const res = await fetch('/api/ujian/koreksi-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ujian_id: selectedExamForEssay.id,
          essay_id: essayId || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Alhamdulillah! ${data.message}`);
        openEssayReviewModal(selectedExamForEssay);
      } else {
        alert(data.error || 'Gagal menjalankan koreksi AI.');
      }
    } catch (err: any) {
      alert('Error saat koreksi AI: ' + err.message);
    } finally {
      setRunningAiGrading(false);
    }
  };

  const handleSaveAllEssayGrades = async (muridId?: number) => {
    if (!selectedExamForEssay) return;
    setSavingGrades(true);
    try {
      const muridIdsToProcess = muridId
        ? [muridId]
        : Array.from(new Set(essayStudentAnswers.map((a: any) => a.murid_id)));

      for (const mId of muridIdsToProcess) {
        const muridItems = essayStudentAnswers.filter((a: any) => a.murid_id === mId);
        const gradesPayload = muridItems.map((item: any) => ({
          id: item.id,
          skor_final: essayGradesDraft[item.id]?.skor_final !== undefined
            ? essayGradesDraft[item.id].skor_final
            : (item.skor_final !== null ? item.skor_final : (item.skor_ai || 0)),
          catatan_guru: essayGradesDraft[item.id]?.catatan_guru || item.catatan_guru || null,
        }));

        await fetch('/api/ujian/essay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ujian_id: selectedExamForEssay.id,
            murid_id: mId,
            grades: gradesPayload,
          }),
        });
      }

      alert('Alhamdulillah! Nilai essay santri berhasil disimpan dan disinkronkan ke Raport.');
      openEssayReviewModal(selectedExamForEssay);
      fetchExams();
    } catch (err: any) {
      alert('Gagal menyimpan nilai essay: ' + err.message);
    } finally {
      setSavingGrades(false);
    }
  };

  // Fungsi load daftar kuis QuizB untuk panel import soal
  const loadQuizzesForImport = async () => {
    try {
      const res = await fetch('/api/quizb/fetch');
      const data = await res.json();
      if (data.success) setQuizImportList(data.quizzes || []);
    } catch {}
  };

  // Fungsi ambil soal dari kuis QuizB
  const handleFetchImportQuestions = async () => {
    if (!quizImportId) return;
    setLoadingImportQuestions(true);
    setImportFeedback('');
    try {
      const qParam = quizImportSearch ? `&q=${encodeURIComponent(quizImportSearch)}` : '';
      const url = `/api/quizb/fetch?action=get_questions&quiz_id=${encodeURIComponent(quizImportId)}${qParam}`;
      const res = await fetch(url);
      const data = await res.json();
      const qs = data.questions || [];
      setQuizImportQuestions(qs);
      setSelectedImportQids(new Set(qs.map((_: any, i: number) => i)));
    } catch {
      setQuizImportQuestions([]);
    } finally {
      setLoadingImportQuestions(false);
    }
  };

  // Fungsi import soal terpilih ke bank soal ujian CBT
  const handleImportSelectedQuestions = async () => {
    if (!selectedExamForSoal || quizImportQuestions.length === 0) return;
    const toImport = quizImportQuestions.filter((_: any, i: number) => selectedImportQids.has(i));
    if (toImport.length === 0) return;
    setImportingQuestions(true);
    try {
      const res = await fetch('/api/ujian/soal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ujian_id: selectedExamForSoal.id,
          soal_list: toImport.map((q: any, i: number) => ({
            nomor_urut: questions.length + i + 1,
            pertanyaan: q.pertanyaan,
            gambar: q.gambar || null,
            opsi_a: q.opsi_a,
            opsi_b: q.opsi_b,
            opsi_c: q.opsi_c || '',
            opsi_d: q.opsi_d || null,
            opsi_e: q.opsi_e || null,
            kunci_jawaban: q.kunci_jawaban || 'A',
            bobot_nilai: q.bobot_nilai || 10,
            pembahasan: q.pembahasan || null,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setImportFeedback(`✅ ${data.message || `${toImport.length} soal berhasil diimpor!`}`);
        setQuizImportQuestions([]);
        setSelectedImportQids(new Set());
        openSoalManager(selectedExamForSoal);
      } else {
        setImportFeedback(`❌ ${data.error || 'Gagal mengimpor soal.'}`);
      }
    } catch (err: any) {
      setImportFeedback(`❌ ${err.message}`);
    } finally {
      setImportingQuestions(false);
    }
  };

  // Dedicated Modal Handler: Impor Paket Ujian dari QuizB
  const openQuizBImportModal = () => {
    loadQuizzesForImport();
    setQuizBModalId('');
    setQuizBModalSearch('');
    setShowQuizBDropdownList(false);
    setQuizBModalQuestions([]);
    setQuizBModalError('');
    setQuizBModalForm({
      judul: '',
      mata_pelajaran: mapelList[0]?.mata_pelajaran || '',
      kitab: '',
      kelas_madin_id: '',
      semester: '1',
      tahun_ajaran: '2025/2026',
      jenis_ujian: 'harian',
      durasi_menit: 45,
      passing_grade: 70,
    });
    setShowQuizBImportModal(true);
  };

  const handleSelectQuizForImportModal = async (quizId: string) => {
    setQuizBModalId(quizId);
    setQuizBModalError('');
    if (!quizId) {
      setQuizBModalQuestions([]);
      return;
    }
    const found = quizImportList.find((q: any) => String(q.id) === String(quizId));
    if (found) {
      const matched = mapelList.find((m) =>
        (found.category && m.mata_pelajaran.toLowerCase().includes(found.category.toLowerCase())) ||
        found.title.toLowerCase().includes(m.mata_pelajaran.toLowerCase())
      );
      setQuizBModalForm((prev: any) => ({
        ...prev,
        judul: found.title || '',
        mata_pelajaran: matched ? matched.mata_pelajaran : (found.category || prev.mata_pelajaran || 'Umum'),
      }));
    }
    setLoadingQuizBModalQuestions(true);
    try {
      const res = await fetch(`/api/quizb/fetch?action=get_questions&quiz_id=${encodeURIComponent(quizId)}`);
      const data = await res.json();
      if (data.success) {
        setQuizBModalQuestions(data.questions || []);
        setQuizBModalError('');
      } else {
        setQuizBModalQuestions([]);
        setQuizBModalError(data.error || 'Gagal memuat butir soal.');
      }
    } catch (err: any) {
      setQuizBModalQuestions([]);
      setQuizBModalError(err.message || 'Gagal menghubungi server.');
    } finally {
      setLoadingQuizBModalQuestions(false);
    }
  };

  const handleExecuteImportQuizBPaket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizBModalForm.judul.trim() || !quizBModalForm.mata_pelajaran.trim()) {
      alert('Judul ujian dan mata pelajaran wajib diisi.');
      return;
    }
    setImportingQuizBPaket(true);
    try {
      // 1. Buat paket ujian CBT di PPMAWAR
      const resExam = await fetch('/api/ujian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...quizBModalForm,
          quizb_id: quizBModalId,
          acak_soal: 1,
          acak_opsi: 1,
          wajib_token: 1,
          wajib_geofence: 1,
          max_radius_meter: 200,
        }),
      });
      const examData = await resExam.json();
      if (!examData.success) {
        alert(examData.error || 'Gagal membuat paket ujian.');
        setImportingQuizBPaket(false);
        return;
      }

      const newUjianId = examData.ujian_id;

      // 2. Salin seluruh butir soal ke Bank Soal ujian ini jika ada
      let importedCount = 0;
      if (quizBModalQuestions.length > 0) {
        const resSoal = await fetch('/api/ujian/soal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ujian_id: newUjianId,
            soal_list: quizBModalQuestions.map((q: any, i: number) => ({
              nomor_urut: i + 1,
              pertanyaan: q.pertanyaan,
              gambar: q.gambar || null,
              opsi_a: q.opsi_a,
              opsi_b: q.opsi_b,
              opsi_c: q.opsi_c || '',
              opsi_d: q.opsi_d || null,
              opsi_e: q.opsi_e || null,
              kunci_jawaban: q.kunci_jawaban || 'A',
              bobot_nilai: q.bobot_nilai || 10,
              pembahasan: q.pembahasan || null,
            })),
          }),
        });
        const soalData = await resSoal.json();
        if (soalData.success) {
          importedCount = quizBModalQuestions.length;
        }
      }

      alert(`✅ Berhasil mengimpor paket ujian "${quizBModalForm.judul}" beserta ${importedCount} butir soal dari QuizB! Ujian siap dikerjakan santri.`);
      setShowQuizBImportModal(false);
      setMainTab('kelola');
      fetchExams();
    } catch (err: any) {
      alert('Error saat mengimpor: ' + err.message);
    } finally {
      setImportingQuizBPaket(false);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamForSoal) return;

    try {
      const method = editingQuestion ? 'PUT' : 'POST';
      const bodyPayload = editingQuestion
        ? { id: editingQuestion.id, ...formQuestion }
        : { ujian_id: selectedExamForSoal.id, ...formQuestion };

      const res = await fetch('/api/ujian/soal', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (data.success) {
        alert('Soal berhasil disimpan!');
        setEditingQuestion(null);
        setFormQuestion({
          tipe_soal: 'pilihan_ganda',
          pertanyaan: '',
          opsi_a: '',
          opsi_b: '',
          opsi_c: '',
          opsi_d: '',
          opsi_e: '',
          kunci_jawaban: 'A',
          rubrik_kata_kunci: '',
          bobot_nilai: 10,
          pembahasan: '',
        });
        openSoalManager(selectedExamForSoal);
        fetchExams();
      } else {
        alert(data.error || 'Gagal menyimpan soal.');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteQuestion = async (qId: number) => {
    if (!confirm('Hapus soal ini?')) return;
    try {
      const res = await fetch(`/api/ujian/soal?id=${qId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success && selectedExamForSoal) {
        openSoalManager(selectedExamForSoal);
        fetchExams();
      }
    } catch (e) {}
  };

  // 8. Pengelolaan Sesi & Token Pengawas
  const openSesiPengawas = async (exam: ExamItem) => {
    setSelectedExamForSesi(exam);
    setShowSesiModal(true);
    setLoadingSesi(true);
    setGeofenceMsg('');
    try {
      const res = await fetch(`/api/ujian/sesi?ujian_id=${exam.id}`);
      const data = await res.json();
      if (data.success && data.sesi) {
        setSesiData(data.sesi);
        if (data.default_pesantren) setDefaultPesantrenCoords(data.default_pesantren);
        if (data.sesi.max_radius_meter) setGeofenceRadius(Number(data.sesi.max_radius_meter));
      }
    } catch (e) {
    } finally {
      setLoadingSesi(false);
    }
  };

  const handleLockPengawasLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert('Perangkat Anda tidak mendukung fitur GPS Geolocation.');
      return;
    }
    setGeofenceLoading(true);
    setGeofenceMsg('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const res = await fetch('/api/ujian/sesi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ujian_id: selectedExamForSesi!.id,
              action: 'update_geofence',
              lat_target: lat,
              lng_target: lng,
              max_radius_meter: geofenceRadius,
              wajib_geofence: 1,
            }),
          });
          const data = await res.json();
          if (data.success) {
            setGeofenceMsg('✅ Titik acuan berhasil dikunci pada koordinat perangkat pengawas saat ini!');
            openSesiPengawas(selectedExamForSesi!);
            fetchExams();
          } else {
            setGeofenceMsg('❌ Gagal: ' + (data.error || 'Terjadi kesalahan'));
          }
        } catch (err: any) {
          setGeofenceMsg('❌ Gagal menghubungi server: ' + err.message);
        } finally {
          setGeofenceLoading(false);
        }
      },
      (err) => {
        setGeofenceLoading(false);
        setGeofenceMsg('❌ Gagal membaca GPS pengawas: ' + err.message + '. Pastikan izin akses lokasi diizinkan di browser.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleResetToPesantren = async () => {
    if (!selectedExamForSesi) return;
    setGeofenceLoading(true);
    setGeofenceMsg('');
    try {
      const res = await fetch('/api/ujian/sesi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ujian_id: selectedExamForSesi.id,
          action: 'update_geofence',
          lat_target: null,
          lng_target: null,
          max_radius_meter: geofenceRadius,
          wajib_geofence: 1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeofenceMsg('✅ Titik acuan direset kembali mengikuti Pusat Pesantren dari Pengaturan Absensi.');
        openSesiPengawas(selectedExamForSesi);
        fetchExams();
      }
    } catch (err: any) {
      setGeofenceMsg('❌ Gagal: ' + err.message);
    } finally {
      setGeofenceLoading(false);
    }
  };

  const handleSaveRadiusOnly = async (newRadius: number) => {
    if (!selectedExamForSesi) return;
    setGeofenceRadius(newRadius);
    try {
      await fetch('/api/ujian/sesi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ujian_id: selectedExamForSesi.id,
          action: 'update_geofence',
          lat_target: sesiData?.lat_target || null,
          lng_target: sesiData?.lng_target || null,
          max_radius_meter: newRadius,
          wajib_geofence: sesiData?.wajib_geofence ?? 1,
        }),
      });
      setGeofenceMsg(`✅ Batas radius diubah menjadi ${newRadius} meter.`);
      openSesiPengawas(selectedExamForSesi);
    } catch (e) {}
  };

  const handleGenerateNewToken = async () => {
    if (!selectedExamForSesi) return;
    try {
      const res = await fetch('/api/ujian/sesi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ujian_id: selectedExamForSesi.id,
          action: 'new_token',
        }),
      });
      const data = await res.json();
      if (data.success) {
        openSesiPengawas(selectedExamForSesi);
        fetchExams();
      }
    } catch (e) {}
  };

  const handleToggleSesiStatus = async (newStatus: 'buka' | 'tertutup') => {
    if (!selectedExamForSesi) return;
    try {
      const res = await fetch('/api/ujian/sesi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ujian_id: selectedExamForSesi.id,
          action: 'toggle_status',
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        openSesiPengawas(selectedExamForSesi);
        fetchExams();
      }
    } catch (e) {}
  };

  // 9. Save Exam (Create/Edit)
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingExam ? 'PUT' : 'POST';
      const bodyPayload = editingExam ? { id: editingExam.id, ...formExam } : formExam;

      const res = await fetch('/api/ujian', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (data.success) {
        if (!editingExam && data.ujian_id && formExam.quizb_id && autoImportQuestionsOnCreate) {
          try {
            const qRes = await fetch(`/api/quizb/fetch?action=get_questions&quiz_id=${encodeURIComponent(formExam.quizb_id)}`);
            const qData = await qRes.json();
            if (qData.success && Array.isArray(qData.questions) && qData.questions.length > 0) {
              await fetch('/api/ujian/soal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ujian_id: data.ujian_id,
                  soal_list: qData.questions.map((q: any, i: number) => ({
                    nomor_urut: i + 1,
                    pertanyaan: q.pertanyaan,
                    gambar: q.gambar || null,
                    opsi_a: q.opsi_a,
                    opsi_b: q.opsi_b,
                    opsi_c: q.opsi_c || '',
                    opsi_d: q.opsi_d || null,
                    opsi_e: q.opsi_e || null,
                    kunci_jawaban: q.kunci_jawaban || 'A',
                    bobot_nilai: q.bobot_nilai || 10,
                    pembahasan: q.pembahasan || null,
                  })),
                }),
              });
              alert(`✅ Ujian berhasil dibuat beserta ${qData.questions.length} butir soal dari QuizB!`);
            } else {
              alert('Ujian berhasil dibuat!');
            }
          } catch (e) {
            alert('Ujian berhasil dibuat!');
          }
        } else {
          alert(editingExam ? 'Ujian berhasil diperbarui!' : 'Ujian berhasil dibuat!');
        }
        setShowCreateModal(false);
        setEditingExam(null);
        fetchExams();
      } else {
        alert(data.error || 'Gagal menyimpan ujian.');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteExam = async (id: number) => {
    if (!confirm('Hapus ujian ini beserta seluruh soal dan sesi pengawas?')) return;
    try {
      const res = await fetch(`/api/ujian?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchExams();
      }
    } catch (e) {}
  };

  // Filtered List
  const filteredExams = useMemo(() => {
    return exams.filter((e) => {
      const matchSearch =
        e.judul.toLowerCase().includes(searchQ.toLowerCase()) ||
        e.mata_pelajaran.toLowerCase().includes(searchQ.toLowerCase());
      const matchJenis = filterJenis === 'ALL' || e.jenis_ujian === filterJenis;
      return matchSearch && matchJenis;
    });
  }, [exams, searchQ, filterJenis]);

  // Daftar Ujian yang Ditampilkan Sesuai Tab:
  // - Tab 'daftar': Hanya ujian yang sesi pengawasnya aktif/terbuka (sesuai waktu pelaksanaan)
  // - Tab 'kelola': Seluruh paket ujian untuk dikelola oleh guru/admin
  const displayedExams = useMemo(() => {
    if (mainTab === 'daftar') {
      return filteredExams.filter((e) => e.status_sesi === 'buka');
    }
    return filteredExams;
  }, [filteredExams, mainTab]);

  // Format Helper Waktu Menit:Detik
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // =========================================================================
  // TAMPILAN CBT EXAM PLAYER (JIKA SEDANG UJIAN)
  // =========================================================================
  if (examStep === 'in_progress' && activeExam) {
    const curQ = examQuestions[currentQIndex];
    const answeredCount = Object.keys(userAnswers).length;

    return (
      <div className="fixed inset-0 z-[90] bg-gray-100 dark:bg-gray-950 flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        {/* Top Header Exam Bar (Ramping, Minimalis, Elegan) */}
        <header className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between shadow-md rounded-b-2xl sm:rounded-b-3xl shrink-0 border-b border-emerald-700/40 relative z-30">
          {/* Sisi Kiri: Tombol Selesai (Rata Kiri, ukuran presisi sama dengan tombol Terang/Gelap di kanan) */}
          <div className="w-[85px] sm:w-[105px] flex items-center justify-start">
            <button
              onClick={() => handleSubmitExam(false, false)}
              disabled={submittingExam}
              className="w-full px-2.5 sm:px-3.5 py-1 sm:py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle size={14} />
              <span>{submittingExam ? 'Mengirim...' : 'Selesai'}</span>
            </button>
          </div>

          {/* Sisi Tengah: Badge Diawasi (Rata Tengah) */}
          <div className="flex-1 flex justify-center items-center">
            {activeExam.anti_curang ? (
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-[11px] sm:text-xs shadow-xs ${
                  violationCount > 0
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-black/25 text-emerald-100 border border-white/15'
                }`}
                title="Sistem Proctoring Anti Pindah Layar Aktif"
              >
                <ShieldCheck size={13} className={violationCount > 0 ? 'text-white' : 'text-emerald-300'} />
                <span>Diawasi ({violationCount}/{activeExam.max_pelanggaran || 3}x)</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-[11px] bg-black/20 text-emerald-200 border border-white/10">
                <span>Mode Mandiri</span>
              </div>
            )}
          </div>

          {/* Sisi Kanan: Tombol Mode Terang/Gelap (Rata Kanan, ukuran sama presisi dengan tombol Selesai) */}
          <div className="w-[85px] sm:w-[105px] flex justify-end">
            <button
              onClick={toggleDarkMode}
              type="button"
              className="w-full px-2.5 sm:px-3.5 py-1 sm:py-1.5 bg-black/25 hover:bg-black/40 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl border border-white/20 shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              title={isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            >
              {isDarkMode ? <Sun size={14} className="text-amber-300" /> : <Moon size={14} className="text-sky-200" />}
              <span>{isDarkMode ? 'Terang' : 'Gelap'}</span>
            </button>
          </div>
        </header>

        {/* Exam Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28 sm:pb-32 flex flex-col max-w-4xl mx-auto w-full">
          {curQ ? (
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 sm:p-7 shadow-sm border border-gray-200 dark:border-gray-700 space-y-6 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3 gap-2">
                  {/* Sisi Kiri: Badge Tipe Soal (Ukuran Presisi Sama Persis dengan Tombol Ragu) */}
                  <div className="w-[95px] sm:w-[110px] flex items-center justify-start shrink-0">
                    {curQ.tipe_soal === 'essay' ? (
                      <span className="w-full px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold inline-flex items-center justify-center bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 tracking-wider shadow-2xs">
                        ESSAY
                      </span>
                    ) : (
                      <span className="w-full px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold inline-flex items-center justify-center bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 tracking-wider shadow-2xs">
                        PILIHAN
                      </span>
                    )}
                  </div>

                  {/* Sisi Tengah: Nomor Soal Rata Tengah Seperti Badge Diawasi Topbar */}
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-xs sm:text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-widest bg-gray-100 dark:bg-gray-700/60 px-3.5 py-1 rounded-full border border-gray-200 dark:border-gray-600/60 shadow-2xs">
                      NO. {currentQIndex + 1}
                    </span>
                  </div>

                  {/* Sisi Kanan: Tombol Ragu (Ukuran Presisi Sama Persis dengan Badge Kiri) */}
                  <div className="w-[95px] sm:w-[110px] flex items-center justify-end shrink-0">
                    <button
                      onClick={() => {
                        const next = new Set(flaggedQuestions);
                        if (next.has(curQ.id)) next.delete(curQ.id);
                        else next.add(curQ.id);
                        setFlaggedQuestions(next);
                      }}
                      className={`w-full px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                        flaggedQuestions.has(curQ.id)
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-xs ring-1 ring-amber-400'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 border border-transparent'
                      }`}
                    >
                      <Flag size={13} className={flaggedQuestions.has(curQ.id) ? 'fill-amber-500 text-amber-600' : ''} />
                      <span>Ragu</span>
                    </button>
                  </div>
                </div>

                {/* Teks Pertanyaan */}
                <div className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
                  {curQ.pertanyaan}
                </div>

                {curQ.gambar && (
                  <div className="my-3">
                    <img
                      src={curQ.gambar}
                      alt="Gambar Soal"
                      className="max-h-60 rounded-xl object-contain border border-gray-200"
                    />
                  </div>
                )}

                {/* Input Soal Essay vs Pilihan Ganda */}
                {curQ.tipe_soal === 'essay' ? (
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold bg-purple-50 dark:bg-purple-950/30 p-3 rounded-2xl border border-purple-200 dark:border-purple-800/50 text-purple-800 dark:text-purple-300">
                      <div className="flex items-center gap-2">
                        <Sparkles size={15} className="text-purple-600 dark:text-purple-400" />
                        <span>Bobot Nilai Soal: {curQ.bobot_nilai || 10} Poin</span>
                      </div>
                      <span className="text-[11px] font-normal text-purple-600 dark:text-purple-400">
                        Panjang jawaban: {(userAnswers[curQ.id] || '').length} karakter &bull; Tersimpan otomatis
                      </span>
                    </div>

                    <textarea
                      rows={6}
                      value={userAnswers[curQ.id] || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUserAnswers((prev) => ({ ...prev, [curQ.id]: val }));
                      }}
                      placeholder="Tuliskan jawaban essay Anda dengan lengkap dan jelas di sini... (Mendukung teks tulisan Arab / Pegon / Latin)"
                      className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
                    />
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-2">
                    {['A', 'B', 'C', 'D', 'E'].map((optKey) => {
                      const optText = (curQ as any)[`opsi_${optKey.toLowerCase()}`];
                      if (!optText) return null;
                      const isSelected = userAnswers[curQ.id] === optKey;

                      return (
                        <button
                          key={optKey}
                          onClick={() => {
                            setUserAnswers((prev) => ({ ...prev, [curQ.id]: optKey }));
                          }}
                          className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-500 shadow-sm'
                              : 'bg-gray-50/70 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            {optKey}
                          </span>
                          <span className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200 pt-0.5 leading-normal">
                            {optText}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Navigasi Bawah */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-2.5">
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button
                    onClick={() => setCurrentQIndex((prev) => Math.max(prev - 1, 0))}
                    disabled={currentQIndex === 0}
                    className="w-full py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-bold disabled:opacity-30 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                    <span>Sebelumnya</span>
                  </button>

                  <button
                    onClick={() => setCurrentQIndex((prev) => Math.min(prev + 1, examQuestions.length - 1))}
                    disabled={currentQIndex === examQuestions.length - 1}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold disabled:opacity-30 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-xs"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Teks Terjawab di bawahnya, rata tengah dalam 1 baris */}
                <div className="text-center text-xs font-semibold text-gray-400">
                  Terjawab: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{answeredCount}</strong> / {examQuestions.length}
                </div>
              </div>
            </div>
          ) : null}

          {/* Grid Navigasi Nomor Soal */}
          <div className="mt-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Daftar Nomor Soal:
            </p>
            <div className="flex flex-wrap gap-2">
              {examQuestions.map((q, idx) => {
                const isCurrent = idx === currentQIndex;
                const isAnswered = !!userAnswers[q.id];
                const isFlagged = flaggedQuestions.has(q.id);

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQIndex(idx)}
                    className={`w-9 h-9 rounded-xl font-black text-xs transition-all flex items-center justify-center relative ${
                      isCurrent
                        ? 'ring-2 ring-emerald-500 ring-offset-2'
                        : ''
                    } ${
                      isAnswered
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : isFlagged
                        ? 'bg-amber-400 text-amber-950'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {idx + 1}
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Bar Exam (Melengkung ke atas, tidak menutupi konten) */}
        <footer className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white px-3 sm:px-6 py-2.5 sm:py-3 shadow-[0_-5px_20px_rgba(0,0,0,0.25)] rounded-t-2xl sm:rounded-t-3xl border-t border-emerald-700/40 flex items-center justify-between">
          {/* Sisi Kiri: Nomor Soal, Nama Ujian, Mata Pelajaran */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 flex items-center justify-center font-black text-xs sm:text-sm shrink-0 border border-white/10 shadow-xs">
              {currentQIndex + 1}
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-extrabold truncate max-w-[150px] sm:max-w-md leading-tight">
                {activeExam.judul}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-emerald-200 truncate max-w-[150px] sm:max-w-md leading-tight mt-0.5">
                {activeExam.mata_pelajaran} &bull; Soal {currentQIndex + 1} dari {examQuestions.length}
              </p>
            </div>
          </div>

          {/* Sisi Kanan: Jam/Waktu Mundur (Merapat Rata Kanan) */}
          <div className="flex items-center justify-end shrink-0">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-xs sm:text-sm shadow-xs ${
                secondsLeft <= 300
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-black/25 text-emerald-100 border border-white/15'
              }`}
              title="Sisa Waktu Pengerjaan Ujian"
            >
              <Clock size={13} />
              <span>{formatTimer(secondsLeft)}</span>
            </div>
          </div>
        </footer>

        {/* Modal Peringatan Pelanggaran Layar / Anti Pindah Layar */}
        {showViolationModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-[fadeIn_0.15s_ease-out]">
            <div
              className={`p-6 sm:p-7 rounded-3xl max-w-md w-full shadow-2xl border text-center space-y-4 ${
                isDisqualified
                  ? 'bg-rose-950 border-rose-600 text-white'
                  : 'bg-white dark:bg-gray-900 border-amber-500 text-gray-900 dark:text-gray-100'
              }`}
            >
              <div className="w-16 h-16 rounded-3xl bg-rose-500/20 text-rose-500 mx-auto flex items-center justify-center">
                <AlertTriangle size={36} />
              </div>
              <h3 className="font-extrabold text-base sm:text-lg">
                {isDisqualified ? '⛔ DISKUALIFIKASI UJIAN' : '⚠️ PERINGATAN KELUAR LAYAR!'}
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                {violationModalMsg}
              </p>
              {!isDisqualified && (
                <button
                  onClick={() => {
                    setShowViolationModal(false);
                    isViolationModalOpenRef.current = false;
                    // Grace period 2 detik setelah santri klik kembali agar transisi fullscreen tidak langsung trigger strike lagi
                    lastViolationTimeRef.current = Date.now() + 2000;
                    if (activeExam?.wajib_fullscreen && document.documentElement.requestFullscreen) {
                      document.documentElement.requestFullscreen().catch(() => {});
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition-all"
                >
                  Saya Mengerti &amp; Kembali Mengerjakan
                </button>
              )}
            </div>
          </div>
        )}

        {/* Toast Notifikasi Layar Penuh (Dapat ditutup / pudar otomatis, di atas bottombar) */}
        {showFsToast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[45] max-w-sm w-[90%] bg-gray-900/95 dark:bg-black/95 text-white text-xs px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md border border-white/10 flex items-center justify-between gap-3 animate-[fadeIn_0.2s_ease-out] transition-opacity duration-500">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base shrink-0">🛡️</span>
              <p className="leading-snug text-[11px] text-gray-200">
                Mode Layar Penuh Aktif: Harap tetap di layar ujian agar tidak terkena peringatan pelanggaran.
              </p>
            </div>
            <button
              onClick={() => setShowFsToast(false)}
              className="p-1 text-gray-400 hover:text-white rounded-lg transition-colors shrink-0"
              title="Tutup pemberitahuan"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // TAMPILAN SELESAI UJIAN (HASIL INSTAN & STATUS ESSAY)
  // =========================================================================
  if (examStep === 'completed' && examResult) {
    const hasil = examResult.hasil || {};
    const isDisq = hasil.is_disqualified;
    const isWaitingEssay = hasil.status_koreksi === 'menunggu_koreksi';
    const displayScore = hasil.skor_akhir !== undefined ? hasil.skor_akhir : examResult.skor_akhir;

    return (
      <div className="max-w-xl mx-auto p-4 sm:p-6 my-10 animate-[fadeIn_0.3s_ease-out]">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 dark:border-gray-700 text-center space-y-5">
          <div
            className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto shadow-inner ${
              isDisq
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60'
                : isWaitingEssay
                ? 'bg-purple-100 text-purple-600 dark:bg-purple-950/60'
                : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60'
            }`}
          >
            {isDisq ? (
              <AlertTriangle size={36} />
            ) : isWaitingEssay ? (
              <Sparkles size={36} className="text-purple-600 animate-pulse" />
            ) : (
              <Award size={36} className="animate-bounce" />
            )}
          </div>

          <div>
            {!isDisq && (
              <p className="font-arabic text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1" dir="rtl">
                الحمد لله
              </p>
            )}
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100">
              {isDisq
                ? 'Ujian Dihentikan (Didiskualifikasi)'
                : isWaitingEssay
                ? 'Jawaban Diserahkan!'
                : 'Ujian Selesai!'}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {examResult.message || 'Jawaban Anda telah berhasil terekam di sistem digital madrasah.'}
            </p>
          </div>

          {isDisq ? (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs text-left space-y-1">
              <p className="font-bold">Catatan Pengawas Sistem:</p>
              <p>Perangkat Anda terdeteksi keluar dari layar pengerjaan melebihi batas toleransi. Nilai ujian ditandai 0 dan tercatat ke riwayat pengawas.</p>
            </div>
          ) : isWaitingEssay ? (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800/60 text-center space-y-2">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-purple-200 text-purple-900 dark:bg-purple-900/60 dark:text-purple-200">
                ⏳ MENUNGGU KOREKSI ESSAY
              </span>
              <p className="text-xs text-purple-800 dark:text-purple-300 font-medium leading-relaxed pt-1">
                Ujian ini memuat butir soal essay/uraian. Jawaban Anda sedang dalam antrean penilaian oleh dewan asatidz dengan bantuan Asisten AI. Nilai akhir resmi akan muncul setelah koreksi selesai.
              </p>
              <p className="text-xs text-gray-500 pt-1">
                Poin sementara dari Pilihan Ganda: <strong className="text-purple-700 dark:text-purple-300">{displayScore}</strong>
              </p>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800/60">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                Nilai Skor Akhir Anda
              </p>
              <p className="text-5xl font-black text-emerald-600 dark:text-emerald-400 my-2">
                {displayScore}
              </p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                  hasil.status_lulus || examResult.status_lulus
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {hasil.status_lulus || examResult.status_lulus ? '🌟 LULUS KKM' : '⚠️ Perlu Remedial'}
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Total Soal</span>
              <span className="text-lg font-black text-gray-800 dark:text-gray-100">{hasil.total_soal || examResult.total_soal || examQuestions.length}</span>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl">
              <span className="text-[10px] text-emerald-600 uppercase font-bold block">Benar (PG)</span>
              <span className="text-lg font-black text-emerald-600">{hasil.jumlah_benar !== undefined ? hasil.jumlah_benar : (examResult.jumlah_benar || 0)}</span>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
              <span className="text-[10px] text-rose-600 uppercase font-bold block">Salah (PG)</span>
              <span className="text-lg font-black text-rose-600">{hasil.jumlah_salah !== undefined ? hasil.jumlah_salah : (examResult.jumlah_salah || 0)}</span>
            </div>
          </div>

          <button
            onClick={() => {
              setExamStep(null);
              setActiveExam(null);
              setExamResult(null);
            }}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm rounded-xl shadow-md transition-all"
          >
            Kembali ke Daftar Ujian
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TAMPILAN UTAMA (PORTAL UJIAN & CBT)
  // =========================================================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header Utama Portal Ujian */}
      <div className="bg-gradient-to-br from-teal-800 via-emerald-900 to-teal-950 text-white rounded-3xl p-6 sm:p-8 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles size={14} className="animate-pulse" /> Ujian CBT &amp; Evaluasi Madin
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Portal Ujian Santri Digital
            </h1>
            <p className="text-teal-100/80 text-xs sm:text-sm mt-1 max-w-xl">
              Pelaksanaan ulangan harian, UTS, dan UAS resmi berbasis komputer/gadget santri dengan verifikasi token &amp; geolokasi.
            </p>
          </div>

          {/* Menu Tombol Header: Berdampingan Presisi di HP, Responsif di PC */}
          <div className={`grid ${isPengajarOrAdmin ? 'grid-cols-2' : 'grid-cols-1'} sm:flex sm:flex-row items-stretch sm:items-center justify-start md:justify-end gap-2.5 sm:gap-3 w-full md:w-auto pt-2 md:pt-0`}>
            {/* Tombol 1: Daftar Ujian */}
            <button
              type="button"
              onClick={() => setMainTab('daftar')}
              className={`w-full sm:w-auto px-2.5 sm:px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-start gap-2 sm:gap-3 shadow-sm min-h-[68px] sm:min-h-[56px] cursor-pointer ${
                mainTab === 'daftar'
                  ? 'bg-white text-emerald-950 shadow-md ring-2 ring-emerald-400'
                  : 'bg-emerald-950/60 text-emerald-100 hover:bg-emerald-900/80 border border-emerald-500/30'
              }`}
            >
              <Play size={18} className={mainTab === 'daftar' ? 'text-emerald-700 fill-emerald-700 shrink-0' : 'text-emerald-300 shrink-0'} />
              <div className="flex flex-col items-start justify-center leading-tight text-left min-w-0 flex-1">
                <span className="font-extrabold text-xs sm:text-sm leading-snug">Daftar Ujian</span>
                <span className={`text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-full mt-1 whitespace-nowrap ${
                  mainTab === 'daftar' ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-800/80 text-emerald-200'
                }`}>
                  {exams.filter((e) => e.status_sesi === 'buka').length} Aktif
                </span>
              </div>
            </button>

            {/* Tombol 2: Kelola Ujian & Bank Soal */}
            {isPengajarOrAdmin && (
              <button
                type="button"
                onClick={() => setMainTab('kelola')}
                className={`w-full sm:w-auto px-2.5 sm:px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-start gap-2 sm:gap-3 shadow-sm min-h-[68px] sm:min-h-[56px] cursor-pointer ${
                  mainTab === 'kelola'
                    ? 'bg-white text-emerald-950 shadow-md ring-2 ring-emerald-400'
                    : 'bg-emerald-950/60 text-emerald-100 hover:bg-emerald-900/80 border border-emerald-500/30'
                }`}
              >
                <Settings size={18} className={mainTab === 'kelola' ? 'text-emerald-700 shrink-0' : 'text-emerald-300 shrink-0'} />
                <div className="flex flex-col items-start justify-center leading-tight text-left min-w-0 flex-1">
                  <span className="font-extrabold text-[11px] sm:text-sm leading-snug line-clamp-2">Kelola Ujian &amp; Bank Soal</span>
                  <span className={`text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-full mt-1 whitespace-nowrap ${
                    mainTab === 'kelola' ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-800/80 text-emerald-200'
                  }`}>
                    {exams.length} Paket Ujian
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar Filter & Pencarian: Termasuk Tombol Buat Ujian & Impor dari QuizB */}
      <div className="bg-white dark:bg-gray-800 p-3.5 sm:p-4 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Kolom Pencarian: Rata Tengah pada HP */}
        <div className="relative w-full lg:max-w-sm xl:max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 hidden sm:block" />
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Cari ujian, mata pelajaran, atau kitab..."
            className="w-full px-4 sm:pl-10 sm:pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm text-center sm:text-left placeholder:text-center sm:placeholder:text-left focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Dropdown, Refresh, & Tombol Aksi di Toolbar Pencarian */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center lg:justify-end gap-2.5 w-full lg:w-auto">
          {/* Baris Dropdown & Tombol Refresh: Rata Tengah */}
          <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
            <select
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value)}
              className="flex-1 sm:flex-initial max-w-[260px] sm:max-w-none px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:outline-none text-center sm:text-left"
            >
              <option value="ALL">Semua Jenis Ujian</option>
              <option value="harian">Ulangan Harian</option>
              <option value="uts">Ujian Tengah Semester (UTS)</option>
              <option value="uas">Ujian Akhir Semester (UAS)</option>
            </select>

            <button
              onClick={fetchExams}
              disabled={loading}
              className="p-2.5 shrink-0 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
              title="Muat Ulang / Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Tombol Buat Ujian & Impor dari QuizB: Berdampingan dalam 1 Baris pada HP */}
          {isPengajarOrAdmin && (
            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={openCreateModal}
                className="w-full px-3 sm:px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <Plus size={15} className="shrink-0" />
                <span className="whitespace-nowrap truncate">Buat Ujian Baru</span>
              </button>

              <button
                type="button"
                onClick={openQuizBImportModal}
                className="w-full px-3 sm:px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-1.5 border border-teal-400/30"
                title="Impor kuis dan butir soal dari QuizB langsung menjadi paket ujian CBT"
              >
                <Sparkles size={15} className="text-yellow-300 shrink-0" />
                <span className="whitespace-nowrap truncate">Impor dari QuizB</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Kartu Profil Santri: Sendirian Rata Tengah di Bawah Toolbar Filter */}
      {santriInfo && (
        <div className="flex justify-center w-full">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-white dark:bg-gray-800 shadow-xs border border-gray-100 dark:border-gray-700 text-xs sm:text-sm text-gray-700 dark:text-gray-200">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <User size={14} />
            </div>
            <span>
              Santri: <strong className="text-emerald-700 dark:text-emerald-400 font-extrabold">{santriInfo.nama}</strong> <span className="text-gray-400 font-mono">({santriInfo.nis || 'NIS -'})</span>
            </span>
          </div>
        </div>
      )}

      {/* Grid Kartu Ujian (Rata Tengah) */}
      {loading ? (
        <div className="p-16 text-center text-gray-400 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 max-w-lg mx-auto">
          <RefreshCw size={28} className="animate-spin mx-auto text-emerald-600 mb-2" />
          <p className="font-bold text-sm">Memuat data ujian...</p>
        </div>
      ) : displayedExams.length === 0 ? (
        mainTab === 'daftar' ? (
          <div className="p-12 sm:p-16 text-center text-gray-400 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 space-y-3 max-w-lg mx-auto">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shadow-xs">
              <CheckCircle size={28} />
            </div>
            <div>
              <p className="font-extrabold text-base text-gray-800 dark:text-gray-200">Tidak Ada Ujian yang Sedang Aktif</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Sesi ujian saat ini belum dibuka atau telah selesai. Ujian yang dibuka sesinya oleh asatidz akan muncul di sini secara otomatis.
              </p>
            </div>
            {isPengajarOrAdmin && (
              <button
                onClick={() => setMainTab('kelola')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all"
              >
                <Settings size={14} />
                <span>Buka Kelola Ujian &amp; Bank Soal</span>
              </button>
            )}
          </div>
        ) : isPengajarOrAdmin ? (
          <div className="p-12 sm:p-16 text-center text-gray-400 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 space-y-4 max-w-lg mx-auto">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shadow-xs">
              <BookOpen size={28} />
            </div>
            <div>
              <p className="font-extrabold text-base text-gray-800 dark:text-gray-200">Belum Ada Paket Ujian CBT</p>
              <p className="text-xs text-gray-400 max-w-md mx-auto mt-1">
                Sebagai Pengajar / Asatidz / Admin, Anda dapat mulai membuat paket soal ujian, mengatur token sesi, dan radius geofence.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition-all"
              >
                <Plus size={16} />
                <span>Buat Paket Manual</span>
              </button>
              <button
                type="button"
                onClick={openQuizBImportModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition-all border border-teal-400/30"
              >
                <Sparkles size={16} className="text-yellow-300" />
                <span>Impor dari QuizB</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-16 text-center text-gray-400 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 space-y-2 max-w-lg mx-auto">
            <AlertCircle size={32} className="mx-auto text-gray-300" />
            <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Belum ada ujian yang tersedia saat ini.</p>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              Ujian yang dijadwalkan oleh asatidz untuk kelas Anda akan muncul di sini.
            </p>
          </div>
        )
      ) : (
        <div className="flex flex-wrap justify-center gap-5 w-full">
          {displayedExams.map((exam) => {
            const isCompleted = exam.skor_akhir !== null && exam.skor_akhir !== undefined;
            const isSessionOpen = exam.status_sesi === 'buka';

            return (
              <div
                key={exam.id}
                className="w-full sm:w-[350px] lg:w-[370px] max-w-md bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-xs border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        exam.jenis_ujian === 'uts'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          : exam.jenis_ujian === 'uas'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      {exam.jenis_ujian === 'uts' ? 'UTS' : exam.jenis_ujian === 'uas' ? 'UAS' : 'Ulangan Harian'}
                    </span>

                    {/* Status Sesi Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : isSessionOpen
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          <CheckCircle size={12} />
                          <span>Selesai (Skor: {exam.skor_akhir})</span>
                        </>
                      ) : isSessionOpen ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                          <span>Sesi Dibuka</span>
                        </>
                      ) : (
                        <>
                          <Lock size={12} />
                          <span>Sesi Ditutup</span>
                        </>
                      )}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-gray-800 dark:text-gray-100 line-clamp-2">
                    {exam.judul}
                  </h3>

                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    <p className="flex items-center gap-1.5 font-medium">
                      <BookOpen size={14} className="text-emerald-600" />
                      <span>{exam.mata_pelajaran} {exam.kitab ? `— ${exam.kitab}` : ''}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Layers size={14} />
                      <span>{exam.nama_kelas || 'Seluruh Kelas Madin'}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Clock size={14} />
                      <span>Durasi: {exam.durasi_menit} Menit &bull; {exam.total_soal || 0} Butir Soal</span>
                    </p>
                    {/* Peserta: dipindah ke sini, di bawah durasi */}
                    <p className="flex items-center gap-1.5">
                      <Users size={14} />
                      <span>Peserta: <strong className="text-gray-700 dark:text-gray-200">{exam.total_peserta || 0} Santri</strong></span>
                    </p>
                  </div>
                </div>

                {/* Tombol Aksi Sesuai Tab: 'daftar' vs 'kelola' */}
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700/80 flex flex-col gap-2">
                  {mainTab === 'daftar' ? (
                    // ==========================================
                    // TAB 1: DAFTAR UJIAN AKTIF (Tombol Mulai Ujian)
                    // ==========================================
                    isCompleted ? (
                      <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-center text-xs font-bold flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle size={15} />
                        <span>Nilai Anda: <strong>{exam.skor_akhir}</strong> &bull; {exam.status_lulus ? 'Lulus KKM' : 'Remedial'}</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            setActiveExam(exam);
                            setExamStep('pre_check');
                            setTokenInput('');
                            setPreCheckError('');
                            detectGPS();
                          }}
                          className="w-full py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 active:scale-95 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                          <Play size={16} className="fill-white" />
                          <span>Mulai Ujian Sekarang</span>
                        </button>

                        {isPengajarOrAdmin && (
                          <div className="flex items-center justify-center text-xs pt-1.5 px-1 text-gray-400">
                            <div className="flex items-center justify-center flex-wrap gap-3 sm:gap-4">
                              <button
                                onClick={() => openLiveProctorModal(exam)}
                                className="text-blue-600 dark:text-blue-400 hover:underline font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                title="Pantau peserta ujian secara real-time"
                              >
                                <Radio size={12} className="animate-pulse text-cyan-500" />
                                <span>Pantau Live</span>
                              </button>
                              <button
                                onClick={() => openSesiPengawas(exam)}
                                className="text-amber-600 dark:text-amber-400 hover:underline font-bold text-[11px] flex items-center gap-1"
                              >
                                <Key size={12} />
                                <span>Atur Sesi &amp; GPS</span>
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedExamForHasil(exam);
                                  setShowHasilModal(true);
                                  fetchHasilPeserta(exam);
                                }}
                                className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold text-[11px] flex items-center gap-1"
                              >
                                <Award size={12} />
                                <span>Hasil</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    // ==========================================
                    // TAB 2: KELOLA UJIAN & BANK SOAL (Fitur CRUD Guru/Admin)
                    // ==========================================
                    isPengajarOrAdmin && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => openSoalManager(exam)}
                            className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-800/70 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-transparent dark:border-blue-700/40"
                          >
                            <BookOpen size={13} />
                            <span>Bank Soal ({exam.total_soal || 0})</span>
                          </button>

                          <button
                            onClick={() => openSesiPengawas(exam)}
                            className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/50 text-amber-700 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-800/70 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-transparent dark:border-amber-700/40"
                          >
                            <Key size={13} />
                            <span>Token &amp; Sesi</span>
                          </button>
                        </div>

                        {/* 3 Tombol Aksi Berdampingan dalam 1 Baris */}
                        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                          {/* 1. Koreksi Essay & Asisten AI */}
                          <button
                            onClick={() => openEssayReviewModal(exam)}
                            className="px-2 py-2 rounded-xl bg-purple-50 dark:bg-purple-900/50 text-purple-700 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-800/70 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-colors border border-purple-200 dark:border-purple-800/40 text-center cursor-pointer shadow-2xs"
                            title="Koreksi Essay & Asisten AI"
                          >
                            <Sparkles size={13} className="text-purple-600 dark:text-purple-300 shrink-0" />
                            <span className="truncate">Koreksi Essay &amp; AI</span>
                          </button>

                          {/* 2. Ruang Pengawasan Live (Hapus emoji 📡, ada ikon Radio) */}
                          <button
                            onClick={() => openLiveProctorModal(exam)}
                            className="px-2 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all text-center cursor-pointer"
                            title="Ruang Pengawasan Live Proctoring"
                          >
                            <Radio size={13} className="animate-pulse text-cyan-200 shrink-0" />
                            <span className="truncate">Pengawasan Live</span>
                          </button>

                          {/* 3. Lihat Hasil Peserta */}
                          <button
                            onClick={() => {
                              setSelectedExamForHasil(exam);
                              setShowHasilModal(true);
                              fetchHasilPeserta(exam);
                            }}
                            className="px-2 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-800/70 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-colors border border-emerald-200 dark:border-emerald-700/40 text-center cursor-pointer shadow-2xs"
                            title={`Lihat Hasil Peserta (${exam.total_peserta || 0} Santri)`}
                          >
                            <Award size={13} className="shrink-0" />
                            <span className="truncate">Hasil ({exam.total_peserta || 0})</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          {/* Peserta Ujian: dipindah ke atas (di bawah durasi), baris ini hanya ikon aksi edit/hapus/quizb */}
                          <span className="text-[11px] text-gray-400">
                            {exam.quizb_id ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-bold text-[10px]">
                                QuizB
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                                Manual
                              </span>
                            )}
                          </span>

                          <div className="flex items-center gap-1">
                            {exam.quizb_id && (
                              <button
                                onClick={() => handleLaunchQuizBSSO(exam)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                title="Buka Kuis di QuizB (Tab Baru)"
                              >
                                <ExternalLink size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingExam(exam);
                                const isCustom = exam.mata_pelajaran && !mapelList.some((m) => m.mata_pelajaran.toLowerCase() === exam.mata_pelajaran.toLowerCase());
                                setIsCustomMapelInput(!!isCustom);
                                setFormExam({
                                  judul: exam.judul,
                                  deskripsi: exam.deskripsi || '',
                                  mata_pelajaran: exam.mata_pelajaran,
                                  kitab: exam.kitab || '',
                                  kelas_madin_id: exam.kelas_madin_id || '',
                                  semester: exam.semester,
                                  tahun_ajaran: exam.tahun_ajaran,
                                  jenis_ujian: exam.jenis_ujian,
                                  durasi_menit: exam.durasi_menit,
                                  passing_grade: exam.passing_grade,
                                  acak_soal: exam.acak_soal,
                                  acak_opsi: exam.acak_opsi,
                                  wajib_token: exam.wajib_token,
                                  wajib_geofence: exam.wajib_geofence,
                                  max_radius_meter: exam.max_radius_meter,
                                  quizb_id: exam.quizb_id || '',
                                });
                                fetchKelasList(exam.mata_pelajaran);
                                fetchMapelList(exam.kelas_madin_id);
                                setShowCreateModal(true);
                              }}
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="Edit Ujian"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteExam(exam.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title="Hapus Ujian"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: PRE-CHECK UJIAN (TOKEN KELAS & GPS GEOFENCE)                      */}
      {/* ========================================================================= */}
      {examStep === 'pre_check' && activeExam && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 pb-20 sm:pb-4 bg-black/70 backdrop-blur-xs animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-md overflow-hidden p-6 space-y-5 max-h-[85vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold">
                  <ShieldCheck size={18} />
                </div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-gray-100">
                  Verifikasi Ruang Ujian
                </h3>
              </div>
              <button
                onClick={() => setExamStep(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1 text-center">
              <h4 className="font-extrabold text-base text-gray-800 dark:text-gray-100">{activeExam.judul}</h4>
              <p className="text-xs text-gray-400">
                Durasi: {activeExam.durasi_menit} Menit &bull; KKM: {activeExam.passing_grade}
              </p>
            </div>

            {preCheckError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800 text-xs font-semibold flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{preCheckError}</span>
              </div>
            )}

            {/* Input Token Ujian */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                1. Masukkan Token Ujian Sesi Kelas:
              </label>
              <input
                type="text"
                maxLength={10}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                placeholder="Contoh: MW78A"
                className="w-full text-center tracking-widest uppercase font-mono font-black text-lg py-3 px-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
              />
              <p className="text-[11px] text-gray-400 text-center">
                Mintalah token ini kepada pengawas ujian di ruang kelas Anda.
              </p>
            </div>

            {/* Validasi Lokasi GPS */}
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 space-y-2.5">
              <div className="flex items-center gap-1.5 justify-center">
                <MapPin size={14} className="text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">2. Lokasi Perangkat</span>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={detectGPS}
                  disabled={gpsLoading}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/60 text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  <RefreshCw size={12} className={gpsLoading ? 'animate-spin' : ''} />
                  <span>{gpsLoading ? 'Mendeteksi...' : 'Cek Ulang GPS'}</span>
                </button>
              </div>

              {gpsCoords ? (
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1 text-center">
                  <CheckCircle size={13} className="shrink-0" />
                  <span>Koordinat GPS terdeteksi aktif ({gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)})</span>
                </div>
              ) : (
                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center justify-center gap-1 text-center">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span>Tekan tombol Cek Ulang GPS untuk mengaktifkan izin lokasi.</span>
                </div>
              )}
            </div>

            <button
              onClick={handleStartExamValidation}
              disabled={validatingPreCheck || !tokenInput.trim()}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-40 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {validatingPreCheck ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              <span>{validatingPreCheck ? 'Memverifikasi...' : 'Masuk & Mulai Mengerjakan'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BUAT / EDIT UJIAN                                               */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5 pb-20 sm:pb-5 bg-black/70 backdrop-blur-xs overflow-y-auto animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden my-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 p-5 sm:p-6 pb-4 shrink-0">
              <h3 className="font-extrabold text-base text-gray-900 dark:text-gray-100">
                {editingExam ? 'Edit Data Ujian' : 'Buat Ujian / Kuis CBT Baru'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Judul Ujian <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formExam.judul}
                    onChange={(e) => setFormExam({ ...formExam, judul: e.target.value })}
                    placeholder="Contoh: UTS Fiqih Ibadah Semester Ganjil"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                      Mata Pelajaran <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !isCustomMapelInput;
                        setIsCustomMapelInput(nextState);
                        if (!nextState) {
                          setFormExam((prev: any) => ({ ...prev, mata_pelajaran: '', kitab: '' }));
                          fetchKelasList();
                        }
                      }}
                      className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {isCustomMapelInput ? '📋 Pilih dari Kurikulum' : '✏️ Ketik Mapel Khusus'}
                    </button>
                  </div>

                  {isCustomMapelInput ? (
                    <input
                      type="text"
                      required
                      value={formExam.mata_pelajaran}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormExam({ ...formExam, mata_pelajaran: val });
                        fetchKelasList(val);
                      }}
                      placeholder="Ketik mata pelajaran khusus..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <select
                      required
                      value={formExam.mata_pelajaran}
                      onChange={(e) => {
                        const selectedVal = e.target.value;
                        const matchedItem = mapelList.find((m) => m.mata_pelajaran === selectedVal);
                        setFormExam((prev: any) => ({
                          ...prev,
                          mata_pelajaran: selectedVal,
                          kitab: matchedItem?.kitab || prev.kitab || '',
                        }));
                        fetchKelasList(selectedVal);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-gray-800 dark:text-gray-200 text-xs sm:text-sm"
                    >
                      <option value="">-- Pilih Mata Pelajaran --</option>
                      {formExam.mata_pelajaran && !mapelList.some((m) => m.mata_pelajaran === formExam.mata_pelajaran) && (
                        <option value={formExam.mata_pelajaran}>{formExam.mata_pelajaran} (Tersimpan)</option>
                      )}
                      {mapelList.map((m, idx) => (
                        <option key={`${m.mata_pelajaran}-${idx}`} value={m.mata_pelajaran}>
                          {m.mata_pelajaran} {m.kitab ? `(${m.kitab})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Kitab (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formExam.kitab}
                    onChange={(e) => setFormExam({ ...formExam, kitab: e.target.value })}
                    placeholder="Contoh: Safinatun Najah"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Target Kelas {formExam.mata_pelajaran ? <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">(Terkait Mapel)</span> : ''}
                  </label>
                  <select
                    value={formExam.kelas_madin_id}
                    onChange={(e) => {
                      const newKelas = e.target.value;
                      setFormExam({ ...formExam, kelas_madin_id: newKelas });
                      if (!formExam.mata_pelajaran) {
                        fetchMapelList(newKelas);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-800 dark:text-gray-200"
                  >
                    <option value="">
                      {formExam.mata_pelajaran ? 'Semua Kelas (Mapel Terkait)' : 'Semua Kelas'}
                    </option>
                    {formExam.kelas_madin_id && !kelasList.some((k) => String(k.kelas_id) === String(formExam.kelas_madin_id)) && (
                      <option value={formExam.kelas_madin_id}>Kelas Terpilih (ID: {formExam.kelas_madin_id})</option>
                    )}
                    {kelasList.map((k) => (
                      <option key={k.kelas_id} value={k.kelas_id}>
                        {k.nama_kelas}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Jenis Ujian
                  </label>
                  <select
                    value={formExam.jenis_ujian}
                    onChange={(e) => setFormExam({ ...formExam, jenis_ujian: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs"
                  >
                    <option value="harian">Ulangan Harian (30%)</option>
                    <option value="uts">UTS (30%)</option>
                    <option value="uas">UAS (40%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Durasi (Menit)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={formExam.durasi_menit}
                    onChange={(e) => setFormExam({ ...formExam, durasi_menit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    KKM / Passing Grade
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formExam.passing_grade}
                    onChange={(e) => setFormExam({ ...formExam, passing_grade: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                      Tautkan Kuis QuizB (Opsional)
                    </label>
                    {formExam.quizb_id && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        ID #{formExam.quizb_id}
                      </span>
                    )}
                  </div>
                  <select
                    value={formExam.quizb_id || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const selectedQuiz = quizImportList.find((q: any) => String(q.id) === val);
                      setFormExam((prev: any) => ({
                        ...prev,
                        quizb_id: val,
                        judul: prev.judul || (selectedQuiz ? selectedQuiz.title : ''),
                        mata_pelajaran: prev.mata_pelajaran || (selectedQuiz ? selectedQuiz.category || '' : ''),
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs"
                  >
                    <option value="">-- Buat Manual / Tanpa QuizB --</option>
                    {quizImportList.filter((q: any) => !String(q.id).startsWith('cbt_')).map((q: any) => (
                      <option key={q.id} value={String(q.id)}>
                        #{q.id} - {q.title} {q.category ? `(${q.category})` : ''}
                      </option>
                    ))}
                  </select>
                  {formExam.quizb_id && !editingExam && (
                    <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      <input
                        type="checkbox"
                        checked={autoImportQuestionsOnCreate}
                        onChange={(e) => setAutoImportQuestionsOnCreate(e.target.checked)}
                        className="accent-emerald-600 rounded"
                      />
                      <span>Otomatis salin butir soal QuizB ke Bank Soal</span>
                    </label>
                  )}
                </div>

                {/* Pengaturan Keamanan & Anti Pindah Layar */}
                <div className="col-span-1 sm:col-span-2 w-full p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-xs text-amber-900 dark:text-amber-200">
                    <ShieldCheck size={16} className="text-amber-600 dark:text-amber-400" />
                    <span>Keamanan Ujian &amp; Anti Pindah Layar (Proctoring)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={!!formExam.anti_curang}
                        onChange={(e) => setFormExam({ ...formExam, anti_curang: e.target.checked ? 1 : 0 })}
                        className="accent-amber-600 rounded"
                      />
                      <span>Aktifkan Anti Pindah Tab / Layar</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={!!formExam.wajib_fullscreen}
                        onChange={(e) => setFormExam({ ...formExam, wajib_fullscreen: e.target.checked ? 1 : 0 })}
                        className="accent-amber-600 rounded"
                      />
                      <span>Wajibkan Mode Layar Penuh</span>
                    </label>
                  </div>

                  {formExam.anti_curang ? (
                    <div className="pt-2 border-t border-amber-200/50 dark:border-amber-800/40 space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Batas Toleransi Pelanggaran:
                      </label>
                      <select
                        value={formExam.max_pelanggaran || 3}
                        onChange={(e) => setFormExam({ ...formExam, max_pelanggaran: Number(e.target.value) })}
                        className="w-full sm:w-auto min-w-[260px] px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-xs font-bold text-amber-700 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                      >
                        <option value="1">1x (Sangat Ketat - Langsung Diskualifikasi)</option>
                        <option value="2">2x Pelanggaran</option>
                        <option value="3">3x Pelanggaran (Standar Direkomendasikan)</option>
                        <option value="5">5x Pelanggaran</option>
                      </select>
                    </div>
                  ) : null}
                </div>
              </div>
              </div>{/* end scrollable body */}

              <div className="flex justify-end gap-2 p-4 sm:p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-md transition-all"
                >
                  {editingExam ? 'Simpan Perubahan' : 'Buat Ujian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1B: IMPOR PAKET UJIAN & BANK SOAL DARI QUIZB                        */}
      {/* ========================================================================= */}
      {showQuizBImportModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5 pb-20 sm:pb-5 bg-black/70 backdrop-blur-xs overflow-y-auto animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
            {/* Modal Header — gaya Verifikasi */}
            <div className="px-5 sm:px-6 pt-5 shrink-0 relative">
              <button
                type="button"
                onClick={() => setShowQuizBImportModal(false)}
                className="absolute top-5 right-5 p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10"
              >
                <X size={18} />
              </button>
              <div className="border-b border-gray-100 dark:border-gray-800 pb-4 pr-9">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-teal-100 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-gray-800 dark:text-gray-100">
                      Impor Paket Ujian dari QuizB
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Tarik butir soal dari quizb.my.id langsung menjadi paket ujian CBT santri PPMAWAR.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleExecuteImportQuizBPaket} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
                {/* 1. Pilih Kuis QuizB */}
                <div className="bg-teal-50/70 dark:bg-teal-950/20 p-4 rounded-2xl border border-teal-200 dark:border-teal-800/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-teal-900 dark:text-teal-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={14} className="text-teal-600 dark:text-teal-400" />
                      Langkah 1: Pilih Kuis dari Platform QuizB
                    </span>
                    <button
                      type="button"
                      onClick={loadQuizzesForImport}
                      className="text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw size={11} /> Refresh Daftar
                    </button>
                  </div>

                  {/* Combobox Searchable Dropdown Terpadu: 1 Kolom Saja */}
                  <div className="relative" ref={quizBDropdownRef}>
                    <div
                      onClick={() => setShowQuizBDropdownList(true)}
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-gray-800 border transition-all flex items-center gap-2 cursor-pointer ${
                        showQuizBDropdownList
                          ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
                          : 'border-gray-200 dark:border-gray-700 hover:border-teal-400'
                      }`}
                    >
                      <Search size={15} className="text-gray-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="-- Cari atau Pilih Kuis dari QuizB (misal: Alfiyah, Nahwu) --"
                        value={
                          showQuizBDropdownList
                            ? quizBModalSearch
                            : (quizImportList.find((q: any) => String(q.id) === String(quizBModalId))
                                ? `ID #${quizBModalId} • ${quizImportList.find((q: any) => String(q.id) === String(quizBModalId))?.title}${quizImportList.find((q: any) => String(q.id) === String(quizBModalId))?.category ? ` (${quizImportList.find((q: any) => String(q.id) === String(quizBModalId))?.category})` : ''}`
                                : '')
                        }
                        onChange={(e) => {
                          setQuizBModalSearch(e.target.value);
                          setShowQuizBDropdownList(true);
                        }}
                        onFocus={() => setShowQuizBDropdownList(true)}
                        className="w-full bg-transparent outline-none text-xs sm:text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 font-medium cursor-text min-w-0"
                        autoComplete="off"
                      />
                      {quizBModalId && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectQuizForImportModal('');
                            setQuizBModalSearch('');
                          }}
                          className="text-gray-400 hover:text-rose-500 shrink-0 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="Hapus pilihan kuis"
                        >
                          <X size={14} />
                        </button>
                      )}
                      <ChevronDown
                        size={15}
                        className={`text-gray-400 shrink-0 transition-transform ${
                          showQuizBDropdownList ? 'rotate-180 text-teal-600' : ''
                        }`}
                      />
                    </div>

                    {/* Dropdown Menu Floating Options */}
                    {showQuizBDropdownList && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-40 max-h-64 overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60 animate-[fadeIn_0.1s_ease-out]">
                        <button
                          type="button"
                          onMouseDown={() => {
                            handleSelectQuizForImportModal('');
                            setQuizBModalSearch('');
                            setShowQuizBDropdownList(false);
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs text-gray-400 italic hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        >
                          -- Kosongkan Pilihan --
                        </button>

                        {quizImportList
                          .filter((q: any) => !String(q.id).startsWith('cbt_'))
                          .filter((q: any) => {
                            if (!quizBModalSearch.trim()) return true;
                            const s = quizBModalSearch.toLowerCase();
                            return (
                              (q.title || '').toLowerCase().includes(s) ||
                              (q.category || '').toLowerCase().includes(s) ||
                              String(q.id).includes(s)
                            );
                          })
                          .map((q: any) => {
                            const isSelected = String(quizBModalId) === String(q.id);
                            return (
                              <button
                                key={q.id}
                                type="button"
                                onMouseDown={() => {
                                  handleSelectQuizForImportModal(String(q.id));
                                  setQuizBModalSearch('');
                                  setShowQuizBDropdownList(false);
                                }}
                                className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                  isSelected
                                    ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 font-bold'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 shrink-0">
                                      #{q.id}
                                    </span>
                                    <span className="font-bold truncate">{q.title}</span>
                                  </div>
                                  {q.category && (
                                    <p className="text-[10px] text-gray-400 mt-0.5 pl-6">
                                      Kategori: {q.category}
                                    </p>
                                  )}
                                </div>
                                {isSelected && <Check size={16} className="text-teal-600 dark:text-teal-400 shrink-0" />}
                              </button>
                            );
                          })}

                        {quizImportList
                          .filter((q: any) => !String(q.id).startsWith('cbt_'))
                          .filter((q: any) => {
                            if (!quizBModalSearch.trim()) return true;
                            const s = quizBModalSearch.toLowerCase();
                            return (
                              (q.title || '').toLowerCase().includes(s) ||
                              (q.category || '').toLowerCase().includes(s) ||
                              String(q.id).includes(s)
                            );
                          }).length === 0 && (
                          <div className="p-4 text-xs text-gray-400 italic text-center">
                            Kuis tidak ditemukan di platform QuizB
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status Fetch Questions */}
                  {loadingQuizBModalQuestions ? (
                    <div className="p-3 bg-white dark:bg-gray-800 rounded-xl flex items-center gap-2 text-xs text-gray-500">
                      <RefreshCw size={14} className="animate-spin text-teal-600" />
                      <span>Sedang mengambil butir soal dari QuizB...</span>
                    </div>
                  ) : quizBModalError ? (
                    <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                      <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                        <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                        <span>Pemberitahuan Integrasi QuizB:</span>
                      </div>
                      <p className="leading-relaxed font-medium">
                        {quizBModalError}
                      </p>
                      <p className="text-[11px] text-amber-800/80 dark:text-amber-400">
                        💡 <strong>Solusi:</strong> Salin file terbaru <code>public/quizb_bridge.php</code> yang ada di aplikasi ini ke cPanel File Manager <code>quizb.my.id</code> agar aksi penarikan butir soal aktif.
                      </p>
                    </div>
                  ) : quizBModalId && quizBModalQuestions.length > 0 ? (
                    <div className="p-3 bg-emerald-100/70 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-xs text-emerald-800 dark:text-emerald-300">
                        <span>✅ {quizBModalQuestions.length} Butir Soal Siap Diimpor</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Semua pilihan ganda &amp; kunci jawaban terdeteksi</span>
                      </div>
                      <div className="max-h-28 overflow-y-auto space-y-1 pr-1 text-[11px] text-gray-600 dark:text-gray-300">
                        {quizBModalQuestions.slice(0, 3).map((q: any, idx: number) => (
                          <div key={idx} className="bg-white/80 dark:bg-gray-800/80 p-1.5 rounded-lg border border-emerald-200/50">
                            <strong>{idx + 1}.</strong> {q.pertanyaan} (Kunci: <span className="font-bold text-emerald-600">{q.kunci_jawaban}</span>)
                          </div>
                        ))}
                        {quizBModalQuestions.length > 3 && (
                          <p className="text-[10px] text-gray-400 italic text-center pt-0.5">
                            ...dan {quizBModalQuestions.length - 3} butir soal lainnya
                          </p>
                        )}
                      </div>
                    </div>
                  ) : quizBModalId ? (
                    <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200">
                      ⚠️ Tidak ada butir soal yang ditemukan pada kuis ini di QuizB. Paket ujian tetap dapat dibuat kosong.
                    </p>
                  ) : null}
                </div>

                {/* 2. Pengaturan Paket Ujian CBT di PPMAWAR */}
                <div className="space-y-3 pt-1">
                  <span className="font-bold text-xs text-gray-800 dark:text-gray-200 uppercase tracking-wider block">
                    Langkah 2: Pengaturan Paket Ujian di PPMAWAR
                  </span>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Judul Ujian CBT <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={quizBModalForm.judul}
                      onChange={(e) => setQuizBModalForm({ ...quizBModalForm, judul: e.target.value })}
                      placeholder="Contoh: Ulangan Harian Nahwu Jilid 1"
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Mata Pelajaran <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={quizBModalForm.mata_pelajaran}
                        onChange={(e) => setQuizBModalForm({ ...quizBModalForm, mata_pelajaran: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs"
                      >
                        <option value="">-- Pilih Mata Pelajaran --</option>
                        {mapelList.map((m) => (
                          <option key={m.mata_pelajaran} value={m.mata_pelajaran}>
                            {m.mata_pelajaran}
                          </option>
                        ))}
                        {quizBModalForm.mata_pelajaran && !mapelList.some(m => m.mata_pelajaran === quizBModalForm.mata_pelajaran) && (
                          <option value={quizBModalForm.mata_pelajaran}>
                            {quizBModalForm.mata_pelajaran} (Kategori QuizB)
                          </option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Target Kelas Madin
                      </label>
                      <select
                        value={quizBModalForm.kelas_madin_id}
                        onChange={(e) => setQuizBModalForm({ ...quizBModalForm, kelas_madin_id: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs"
                      >
                        <option value="">Semua Kelas Madin</option>
                        {kelasList.map((k) => (
                          <option key={k.id} value={String(k.id)}>
                            {k.nama_kelas}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Jenis Ujian
                      </label>
                      <select
                        value={quizBModalForm.jenis_ujian}
                        onChange={(e) => setQuizBModalForm({ ...quizBModalForm, jenis_ujian: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs"
                      >
                        <option value="harian">Ulangan Harian (30%)</option>
                        <option value="uts">UTS (30%)</option>
                        <option value="uas">UAS (40%)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Durasi (Menit)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="300"
                        value={quizBModalForm.durasi_menit}
                        onChange={(e) => setQuizBModalForm({ ...quizBModalForm, durasi_menit: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        KKM (Passing Grade)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={quizBModalForm.passing_grade}
                        onChange={(e) => setQuizBModalForm({ ...quizBModalForm, passing_grade: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-2 p-4 sm:p-5 border-t border-gray-100 dark:border-gray-800 mx-0 bg-gray-50/50 dark:bg-gray-900/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowQuizBImportModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!quizBModalId || importingQuizBPaket}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-95 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {importingQuizBPaket ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Mengimpor Paket &amp; Soal...</span>
                    </>
                  ) : (
                    <span>
                      🚀 Impor &amp; Terbitkan Paket Ujian ({quizBModalQuestions.length} Soal)
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: BANK SOAL & KELOLA SOAL PILIHAN GANDA                             */}
      {/* ========================================================================= */}
      {showSoalModal && selectedExamForSoal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5 pb-20 sm:pb-5 bg-black/70 backdrop-blur-xs overflow-y-auto animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden my-auto">
            <div className="p-4 sm:p-5 bg-emerald-800 text-white shrink-0 relative">
              {/* X Button — pojok kanan atas */}
              <button
                onClick={() => setShowSoalModal(false)}
                className="absolute top-4 right-4 p-1.5 text-emerald-200 hover:text-white rounded-lg transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="pr-9">
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <BookOpen size={18} />
                  <span>Bank Soal: {selectedExamForSoal.judul}</span>
                </h3>
                <p className="text-xs text-emerald-200">
                  {selectedExamForSoal.mata_pelajaran} &bull; Total {questions.length} Butir Soal Tersimpan
                </p>
              </div>

              {/* Action Buttons: Template Excel, Upload Excel — rata tengah */}
              <div className="flex items-center justify-center flex-wrap gap-2 mt-3">
                <input
                  type="file"
                  ref={excelFileInputRef}
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelFileSelected}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all border border-white/20 shadow-xs"
                  title="Unduh format file Excel untuk input soal PG dan Essay"
                >
                  <FileText size={14} />
                  <span>Template Excel</span>
                </button>

                <button
                  type="button"
                  disabled={importingExcelSoal}
                  onClick={() => excelFileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
                  title="Unggah file Excel yang sudah diisi soal dan jawaban"
                >
                  <Sparkles size={14} />
                  <span>{importingExcelSoal ? 'Mengimpor...' : 'Impor dari Excel'}</span>
                </button>
              </div>
            </div>

            <div ref={modalSoalBodyRef} className="p-5 overflow-y-auto flex-1 space-y-6">
              {/* Form Tambah / Edit Soal */}
              <form
                ref={formEditSoalRef}
                onSubmit={handleSaveQuestion}
                className={`p-4 rounded-2xl border transition-all space-y-3.5 ${
                  editingQuestion
                    ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/60 ring-2 ring-amber-400/30'
                    : 'bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <h4 className="font-bold text-xs sm:text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    {editingQuestion ? (
                      <>
                        <Edit3 size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>
                          Edit Soal <span className="text-amber-700 dark:text-amber-300 font-extrabold underline decoration-amber-400">No. {editingQuestion.nomor_urut}</span>
                        </span>
                      </>
                    ) : (
                      <span>➕ Tambah Butir Soal Baru</span>
                    )}
                  </h4>

                  {/* Toggle Tipe Soal (Pilihan Ganda vs Essay) */}
                  <div className="flex items-center gap-1.5 bg-gray-200/80 dark:bg-gray-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFormQuestion({ ...formQuestion, tipe_soal: 'pilihan_ganda' })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        formQuestion.tipe_soal !== 'essay'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                      }`}
                    >
                      🔘 Pilihan Ganda
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormQuestion({ ...formQuestion, tipe_soal: 'essay' })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        formQuestion.tipe_soal === 'essay'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                      }`}
                    >
                      📝 Soal Essay (AI)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Pertanyaan / Soal <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={formQuestion.pertanyaan}
                    onChange={(e) => setFormQuestion({ ...formQuestion, pertanyaan: e.target.value })}
                    placeholder="Tuliskan butir soal di sini (Mendukung teks kitab, bait nadhom, dan tulisan Arab)..."
                    className="w-full p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                  />
                </div>

                {/* Bagian Input Spesifik: Essay vs Pilihan Ganda */}
                {formQuestion.tipe_soal === 'essay' ? (
                  <div className="space-y-3 p-3.5 bg-purple-50/70 dark:bg-purple-950/20 rounded-2xl border border-purple-200 dark:border-purple-800/40">
                    <div>
                      <label className="block text-xs font-bold text-purple-900 dark:text-purple-200 mb-1">
                        Kunci Jawaban Acuan / Ideal Guru (Model Answer) <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={formQuestion.kunci_jawaban}
                        onChange={(e) => setFormQuestion({ ...formQuestion, kunci_jawaban: e.target.value })}
                        placeholder="Tuliskan jawaban acuan/ideal yang diharapkan dari santri sebagai pedoman evaluasi..."
                        className="w-full p-3 rounded-xl bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-purple-900 dark:text-purple-200 mb-1 flex items-center gap-1.5">
                        <Sparkles size={13} className="text-purple-600 dark:text-purple-400" />
                        <span>Kata Kunci Pokok untuk Bantuan Koreksi AI (Pisahkan dengan koma)</span>
                      </label>
                      <input
                        type="text"
                        value={formQuestion.rubrik_kata_kunci || ''}
                        onChange={(e) => setFormQuestion({ ...formQuestion, rubrik_kata_kunci: e.target.value })}
                        placeholder="Contoh: thaharah, bersuci, hadats, najis, air mutlak"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-1">
                        Asisten AI akan mendeteksi variasi kata ini saat menganalisis jawaban santri dan merekomendasikan nilai.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Opsi A <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formQuestion.opsi_a}
                        onChange={(e) => setFormQuestion({ ...formQuestion, opsi_a: e.target.value })}
                        placeholder="Pilihan jawaban A"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Opsi B <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formQuestion.opsi_b}
                        onChange={(e) => setFormQuestion({ ...formQuestion, opsi_b: e.target.value })}
                        placeholder="Pilihan jawaban B"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Opsi C
                      </label>
                      <input
                        type="text"
                        value={formQuestion.opsi_c}
                        onChange={(e) => setFormQuestion({ ...formQuestion, opsi_c: e.target.value })}
                        placeholder="Pilihan jawaban C"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Opsi D
                      </label>
                      <input
                        type="text"
                        value={formQuestion.opsi_d}
                        onChange={(e) => setFormQuestion({ ...formQuestion, opsi_d: e.target.value })}
                        placeholder="Pilihan jawaban D"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  {formQuestion.tipe_soal !== 'essay' && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Kunci Jawaban <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formQuestion.kunci_jawaban}
                        onChange={(e) => setFormQuestion({ ...formQuestion, kunci_jawaban: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-emerald-600"
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                        <option value="E">E</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Bobot Nilai
                    </label>
                    <input
                      type="number"
                      value={formQuestion.bobot_nilai}
                      onChange={(e) => setFormQuestion({ ...formQuestion, bobot_nilai: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-2 flex items-center justify-center sm:justify-end gap-2 pt-2 sm:pt-0">
                    {editingQuestion && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingQuestion(null);
                          setFormQuestion({
                            tipe_soal: 'pilihan_ganda',
                            pertanyaan: '',
                            opsi_a: '',
                            opsi_b: '',
                            opsi_c: '',
                            opsi_d: '',
                            opsi_e: '',
                            kunci_jawaban: 'A',
                            rubrik_kata_kunci: '',
                            bobot_nilai: 10,
                            pembahasan: '',
                          });
                        }}
                        className="px-4 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all text-center"
                      >
                        Batal Edit
                      </button>
                    )}
                    <button
                      type="submit"
                      className={`w-full sm:w-auto px-6 py-2.5 rounded-xl active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md transition-all text-center flex items-center justify-center gap-1.5 ${
                        editingQuestion
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      {editingQuestion ? <Check size={14} /> : <Plus size={14} />}
                      <span>{editingQuestion ? `Simpan Soal No. ${editingQuestion.nomor_urut}` : 'Tambahkan Soal'}</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Daftar Soal yang Ada */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs sm:text-sm text-gray-800 dark:text-gray-200">
                  Daftar Soal ({questions.length})
                </h4>

                {loadingQuestions ? (
                  <p className="text-xs text-gray-400">Memuat butir soal...</p>
                ) : questions.length === 0 ? (
                  <p className="text-xs text-gray-400">Belum ada butir soal pada ujian ini.</p>
                ) : (
                  questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className={`p-4 rounded-2xl border space-y-2 text-xs transition-all ${
                        editingQuestion?.id === q.id
                          ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/20'
                          : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-600">No. {idx + 1}</span>
                          {q.tipe_soal === 'essay' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              ESSAY
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              PILIHAN GANDA
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEditQuestion(q, idx)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              editingQuestion?.id === q.id
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 ring-1 ring-amber-400'
                                : 'text-gray-500 hover:text-emerald-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                            title={`Edit Soal No. ${idx + 1}`}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <p className="font-semibold text-gray-800 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                        {q.pertanyaan}
                      </p>

                      {q.tipe_soal === 'essay' ? (
                        <div className="space-y-1.5 p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 text-[11px]">
                          <div>
                            <span className="font-bold text-purple-900 dark:text-purple-200">Kunci Acuan Guru: </span>
                            <span className="text-gray-700 dark:text-gray-300">{q.kunci_jawaban || '-'}</span>
                          </div>
                          {q.rubrik_kata_kunci && (
                            <div>
                              <span className="font-bold text-purple-900 dark:text-purple-200">Kata Kunci AI: </span>
                              <span className="text-purple-700 dark:text-purple-300 font-mono">{q.rubrik_kata_kunci}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-gray-400 pt-1">
                          <div>A. {q.opsi_a}</div>
                          <div>B. {q.opsi_b}</div>
                          {q.opsi_c && <div>C. {q.opsi_c}</div>}
                          {q.opsi_d && <div>D. {q.opsi_d}</div>}
                        </div>
                      )}

                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] text-emerald-600 font-bold flex items-center justify-between">
                        <span>{q.tipe_soal === 'essay' ? 'Tipe: Essay' : `Kunci: ${q.kunci_jawaban}`}</span>
                        <span>Bobot: {q.bobot_nilai} Poin</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* ===== SECTION IMPORT SOAL DARI QUIZB ===== */}
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 p-4 space-y-3">
                <h4 className="font-bold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <Sparkles size={15} />
                  Impor Soal dari QuizB
                </h4>

                {/* Dropdown pilih kuis QuizB */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Pilih Kuis dari QuizB
                  </label>
                  <select
                    value={quizImportId}
                    onChange={e => setQuizImportId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Pilih Kuis --</option>
                    {quizImportList.map((q: any) => (
                      <option key={q.id} value={String(q.id)}>
                        {q.title}{q.category ? ` (${q.category})` : ''}
                      </option>
                    ))}
                  </select>
                  {quizImportList.length === 0 && (
                    <p className="text-[10px] text-gray-400 mt-1">Tidak ada kuis QuizB — pastikan QuizB terhubung.</p>
                  )}
                </div>

                {/* Input pencarian + tombol ambil soal */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={quizImportSearch}
                      onChange={e => setQuizImportSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleFetchImportQuestions()}
                      placeholder="Cari soal berdasarkan kata kunci (opsional)..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchImportQuestions}
                    disabled={!quizImportId || loadingImportQuestions}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 shrink-0 transition-colors"
                  >
                    {loadingImportQuestions
                      ? <RefreshCw size={13} className="animate-spin" />
                      : <Search size={13} />
                    }
                    Ambil Soal
                  </button>
                </div>

                {/* Feedback import */}
                {importFeedback && (
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl px-3 py-2">
                    {importFeedback}
                  </p>
                )}

                {/* Preview daftar soal yang ditemukan */}
                {quizImportQuestions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        {quizImportQuestions.length} soal ditemukan:
                      </span>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedImportQids(new Set(quizImportQuestions.map((_: any, i: number) => i)))}
                          className="text-xs text-emerald-600 font-bold hover:underline"
                        >
                          Pilih Semua
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedImportQids(new Set())}
                          className="text-xs text-gray-500 font-bold hover:underline"
                        >
                          Batal Semua
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {quizImportQuestions.map((q: any, i: number) => (
                        <label
                          key={i}
                          className="flex items-start gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-emerald-400 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedImportQids.has(i)}
                            onChange={e => {
                              const next = new Set(selectedImportQids);
                              if (e.target.checked) next.add(i); else next.delete(i);
                              setSelectedImportQids(next);
                            }}
                            className="mt-0.5 shrink-0 accent-emerald-600"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 line-clamp-2">
                              {i + 1}. {q.pertanyaan}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              A. {q.opsi_a} | B. {q.opsi_b}
                              {q.opsi_c ? ` | C. ${q.opsi_c}` : ''}
                              {' '}&bull; Kunci: <span className="font-bold text-emerald-600">{q.kunci_jawaban}</span>
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleImportSelectedQuestions}
                      disabled={selectedImportQids.size === 0 || importingQuestions}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    >
                      {importingQuestions
                        ? <RefreshCw size={14} className="animate-spin" />
                        : <Plus size={14} />
                      }
                      Import {selectedImportQids.size} Soal Terpilih ke Bank Soal
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: KELOLA TOKEN & SESI PENGAWAS (ANTI JOKI)                          */}
      {/* ========================================================================= */}
      {showSesiModal && selectedExamForSesi && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5 pb-20 sm:pb-5 bg-black/70 backdrop-blur-xs overflow-y-auto animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-lg p-5 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center font-bold">
                  <Key size={18} />
                </div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-gray-100">
                  Token &amp; Sesi Pengawas
                </h3>
              </div>
              <button
                onClick={() => setShowSesiModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">{selectedExamForSesi.judul}</h4>
              <p className="text-xs text-gray-400">
                Pengaturan ini menjaga agar santri hanya bisa ujian di dalam kelas di bawah pengawasan.
              </p>
            </div>

            {loadingSesi ? (
              <p className="text-xs text-gray-400 text-center py-6">Memuat sesi pengawas...</p>
            ) : sesiData ? (
              <div className="space-y-4">
                {/* Tampilan Token Ujian */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 text-center space-y-2">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                    Token Sesi Ujian Aktif:
                  </span>
                  <div className="text-3xl font-mono font-black tracking-widest text-amber-600 dark:text-amber-400">
                    {sesiData.token_ujian || '-'}
                  </div>
                  <p className="text-[11px] text-amber-800/70 dark:text-amber-300/70">
                    Tuliskan token ini di papan tulis kelas agar santri dapat membuka soal.
                  </p>
                  <button
                    onClick={handleGenerateNewToken}
                    className="mt-2 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <RefreshCw size={13} />
                    <span>Buat Token Baru</span>
                  </button>
                </div>

                {/* Status Sesi Buka / Tutup */}
                <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">Status Sesi Ujian</span>
                    <span className="text-[11px] text-gray-400">
                      {sesiData.status_sesi === 'buka' ? '🟢 Terbuka untuk santri' : '🔴 Ditutup'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleSesiStatus(sesiData.status_sesi === 'buka' ? 'tertutup' : 'buka')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                      sesiData.status_sesi === 'buka'
                        ? 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {sesiData.status_sesi === 'buka' ? 'Tutup Sesi Ujian' : 'Buka Sesi Ujian'}
                  </button>
                </div>

                {/* Panel Kontrol Geofence & Jarak Maksimal */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 space-y-3">
                  <div className="flex flex-col items-center text-center gap-2 pb-2 border-b border-gray-200/50 dark:border-gray-700/50">
                    <div className="flex items-center justify-center gap-1.5 font-bold text-xs sm:text-sm text-gray-800 dark:text-gray-200">
                      <MapPin size={15} className="text-emerald-500 shrink-0" />
                      <span>Titik Acuan &amp; Jarak Maksimal</span>
                    </div>
                    {/* Badge status lokasi — tampilan saja, tidak bisa diklik */}
                    <div className="flex justify-center w-full">
                      {sesiData.lat_target ? (
                        <div className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold border border-emerald-300 dark:border-emerald-700 shadow-2xs select-none cursor-default">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                          <span>📍 Lokasi Pengawas (Terkunci)</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 text-[11px] font-bold border border-blue-300 dark:border-blue-700 shadow-2xs select-none cursor-default">
                          <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></span>
                          <span>🏢 Pusat Pesantren (Default)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Keterangan Koordinat */}
                  <div className="text-[11px] text-gray-500 bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700/60">
                    {sesiData.lat_target ? (
                      <div>
                        <strong className="text-emerald-600 dark:text-emerald-400 block mb-0.5">Terkunci pada Ruang Ujian Pengawas:</strong>
                        <span className="font-mono text-[10px] text-gray-400">
                          Lat: {Number(sesiData.lat_target).toFixed(6)}, Lng: {Number(sesiData.lng_target).toFixed(6)}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <strong className="text-blue-600 dark:text-blue-400 block mb-0.5">Mengikuti Halaman Pengaturan (Pusat Pesantren):</strong>
                        <span className="font-mono text-[10px] text-gray-400">
                          Lat: {defaultPesantrenCoords?.lat || -7.035992}, Lng: {defaultPesantrenCoords?.lng || 112.350798}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tombol Aksi GPS Pengawas — saling mengunci (mutual exclusive) */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Tombol Kunci GPS Pengawas: aktif/menonjol ketika lat_target BELUM dikunci (belum ada GPS custom) */}
                    <button
                      type="button"
                      disabled={geofenceLoading || !!sesiData.lat_target}
                      onClick={handleLockPengawasLocation}
                      className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        sesiData.lat_target
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-50'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md ring-2 ring-emerald-400/30'
                      }`}
                      title={sesiData.lat_target ? 'GPS Pengawas sudah dikunci. Reset ke Pesantren untuk mengubah.' : 'Kunci titik acuan ke lokasi GPS Anda saat ini'}
                    >
                      {geofenceLoading && !sesiData.lat_target ? <RefreshCw size={13} className="animate-spin" /> : <MapPin size={13} />}
                      <span>{geofenceLoading && !sesiData.lat_target ? 'Mendeteksi...' : 'Kunci GPS Pengawas'}</span>
                    </button>

                    {/* Tombol Reset ke Pesantren: aktif/menonjol ketika lat_target SUDAH ada (GPS custom aktif) */}
                    <button
                      type="button"
                      disabled={geofenceLoading || !sesiData.lat_target}
                      onClick={handleResetToPesantren}
                      className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        !sesiData.lat_target
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-50'
                          : 'bg-rose-500 hover:bg-rose-600 text-white shadow-md ring-2 ring-rose-400/30'
                      }`}
                      title={!sesiData.lat_target ? 'Tidak ada GPS Pengawas yang dikunci.' : 'Kembalikan ke titik acuan Pusat Pesantren (hapus GPS pengawas)'}
                    >
                      <RefreshCw size={13} />
                      <span>Reset ke Pesantren</span>
                    </button>
                  </div>

                  {/* Pengaturan Batas Jarak Radius */}
                  <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-700 dark:text-gray-300">Batas Jarak Maksimal:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">{geofenceRadius} Meter</strong>
                    </div>

                    {/* Tombol Pilihan Jarak Cepat */}
                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      {[30, 50, 100, 200].map((rad) => (
                        <button
                          key={rad}
                          type="button"
                          onClick={() => handleSaveRadiusOnly(rad)}
                          className={`py-1 rounded-lg text-[11px] font-bold transition-all ${
                            geofenceRadius === rad
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 border border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          {rad}m {rad === 30 || rad === 50 ? '(Kelas)' : rad === 100 ? '(Gedung)' : '(Area)'}
                        </button>
                      ))}
                    </div>

                    <p className="text-[10px] text-gray-400">
                      Santri dengan jarak lebih dari {geofenceRadius} meter dari {sesiData.lat_target ? 'perangkat Anda' : 'pusat madrasah'} akan otomatis ditolak saat membuka ujian.
                    </p>
                  </div>

                  {geofenceMsg && (
                    <div className="text-[11px] p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 animate-[fadeIn_0.2s]">
                      {geofenceMsg}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: QUIZB EMBED / SSO MIRROR MODAL                                   */}
      {/* ========================================================================= */}
      {ssoUrl && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5 pb-20 sm:pb-5 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-700 w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden my-auto">
            <div className="p-3 px-5 bg-emerald-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-emerald-300" />
                <span className="font-bold text-sm">Mode Ujian QuizB &times; PPMAWAR</span>
              </div>
              <button
                onClick={() => setSsoUrl(null)}
                className="p-1 rounded-lg text-emerald-200 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <iframe
              src={ssoUrl}
              className="w-full flex-1 border-0"
              title="QuizB Embed SSO"
              allow="camera; microphone; geolocation"
            />
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* MODAL 6: LIHAT HASIL PESERTA UJIAN (Guru/Admin)                        */}
      {/* ====================================================================== */}
      {showHasilModal && selectedExamForHasil && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 pb-24 sm:pb-5" onClick={() => setShowHasilModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col my-auto overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="font-black text-gray-900 dark:text-white text-base sm:text-lg">📊 Hasil Peserta Ujian</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{selectedExamForHasil.judul} • {selectedExamForHasil.mata_pelajaran}</p>
              </div>
              <button onClick={() => setShowHasilModal(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-3 sm:p-5 space-y-4 touch-pan-y overscroll-contain">
              {loadingHasil ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw size={28} className="animate-spin text-emerald-500" />
                  <span className="ml-3 text-gray-500 font-medium">Memuat data hasil ujian...</span>
                </div>
              ) : hasilError ? (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center space-y-2 py-8">
                  <AlertCircle size={36} className="mx-auto text-rose-500" />
                  <p className="text-rose-700 dark:text-rose-300 font-bold text-sm">{hasilError}</p>
                  <button
                    onClick={() => selectedExamForHasil && fetchHasilPeserta(selectedExamForHasil)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all"
                  >
                    <RefreshCw size={13} />
                    <span>Coba Lagi</span>
                  </button>
                </div>
              ) : hasilPeserta.length === 0 ? (
                <div className="text-center py-12">
                  <HelpCircle size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">Belum ada peserta yang menyelesaikan ujian ini.</p>
                </div>
              ) : (
                <>
                  {/* Statistik Ringkas */}
                  {hasilStatistik && (
                    <div className="space-y-2.5">
                      {/* Baris 1: Persentase Lulus Memenuhi Ruang Kanan-Kiri Penuh */}
                      <div className="bg-emerald-50/90 dark:bg-emerald-950/40 rounded-xl p-3 text-center border border-emerald-200/60 dark:border-emerald-800/50 w-full shadow-2xs">
                        <div className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300">
                          {hasilStatistik.persentase_lulus}%
                        </div>
                        <div className="text-xs text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">
                          Persentase Lulus
                        </div>
                      </div>

                      {/* Baris 2: Total Peserta, Rata-rata Nilai, Tidak Lulus (3 Kolom Berdampingan) */}
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <div className="bg-blue-50/80 dark:bg-blue-950/30 rounded-xl p-2.5 sm:p-3 text-center border border-blue-100 dark:border-blue-900/30 shadow-2xs">
                          <div className="text-xl sm:text-2xl font-black text-blue-700 dark:text-blue-300">
                            {hasilStatistik.total_peserta}
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                            Total Peserta
                          </div>
                        </div>

                        <div className="bg-amber-50/80 dark:bg-amber-950/30 rounded-xl p-2.5 sm:p-3 text-center border border-amber-100 dark:border-amber-900/30 shadow-2xs">
                          <div className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-300">
                            {hasilStatistik.rata_rata_skor}
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                            Rata-rata Nilai
                          </div>
                        </div>

                        <div className="bg-rose-50/80 dark:bg-rose-950/30 rounded-xl p-2.5 sm:p-3 text-center border border-rose-100 dark:border-rose-900/30 shadow-2xs">
                          <div className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-300">
                            {hasilStatistik.total_tidak_lulus}
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                            Tidak Lulus
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tabel Peringkat (Bisa Digeser / Di-scroll pada Mobile) */}
                  <div className="space-y-1">
                    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 touch-pan-x overscroll-x-contain shadow-2xs">
                      <table className="min-w-[760px] w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800/60 text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">
                            <th className="px-3 py-2.5 text-left">#</th>
                            <th className="px-3 py-2.5 text-left">Nama Santri</th>
                            <th className="px-3 py-2.5 text-left">NIS</th>
                            <th className="px-3 py-2.5 text-center">Nilai</th>
                            <th className="px-3 py-2.5 text-center">Benar (PG)</th>
                            <th className="px-3 py-2.5 text-center min-w-[150px] whitespace-nowrap">Pengawasan</th>
                            <th className="px-3 py-2.5 text-center min-w-[130px] whitespace-nowrap">Status</th>
                            <th className="px-3 py-2.5 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {hasilPeserta.map((h: any, idx: number) => {
                            const durasiMenit = Math.floor((h.durasi_detik || 0) / 60);
                            const durasiDetik = (h.durasi_detik || 0) % 60;
                            const isDisq = !!h.is_disqualified;
                            const isWaitingEssay = h.status_koreksi === 'menunggu_koreksi';

                            return (
                              <tr key={h.id} className={`transition-colors ${idx < 3 ? 'bg-amber-50/30 dark:bg-amber-950/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
                                <td className="px-3 py-3">
                                  <span className={`font-black text-sm ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-400' : 'text-gray-500'}`}>
                                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <span className="font-semibold text-gray-800 dark:text-gray-200 text-xs">{h.nama_lengkap || 'Santri'}</span>
                                  {h.nama_kelas && <span className="block text-[10px] text-gray-400">{h.nama_kelas}</span>}
                                </td>
                                <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{h.nis || '-'}</td>
                                <td className="px-3 py-3 text-center">
                                  <span className={`font-black text-base ${isDisq ? 'text-rose-600' : Number(h.skor_akhir) >= (selectedExamForHasil.passing_grade || 70) ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    {isDisq ? '0' : Number(h.skor_akhir).toFixed(0)}
                                  </span>
                                  {isWaitingEssay && (
                                    <span className="block text-[9px] font-bold text-purple-600 dark:text-purple-400">(Draft PG)</span>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-center text-xs text-gray-600 dark:text-gray-300">
                                  {h.jumlah_benar}/{h.total_soal}
                                </td>
                                <td className="px-3 py-3 text-center text-xs whitespace-nowrap">
                                  {isDisq ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-extrabold text-[10px] border border-rose-200 dark:border-rose-800">
                                      ⛔ Diskualifikasi
                                    </span>
                                  ) : Number(h.jumlah_pelanggaran || 0) > 0 ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold text-[10px] border border-amber-200 dark:border-amber-800">
                                      ⚠️ {h.jumlah_pelanggaran}x Pindah Layar
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                                      <ShieldCheck size={11} /> Tertib (0x)
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-center whitespace-nowrap">
                                  {isDisq ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-extrabold text-[10px] border border-rose-200 dark:border-rose-800">
                                      ⛔ Gugur
                                    </span>
                                  ) : isWaitingEssay ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 text-[10px] font-extrabold border border-purple-200 dark:border-purple-800">
                                      <Sparkles size={10} className="text-purple-600 dark:text-purple-400" />
                                      <span>Antre Essay</span>
                                    </span>
                                  ) : h.status_lulus ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                                      <Check size={11} /> Lulus
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-[10px] font-bold border border-rose-200 dark:border-rose-800">
                                      <X size={11} /> Remedial
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <button
                                    onClick={() => {
                                      setShowHasilModal(false);
                                      openEssayReviewModal(selectedExamForHasil);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center gap-1 transition-colors border border-purple-200 dark:border-purple-800"
                                    title="Tinjau dan nilai jawaban essay santri ini"
                                  >
                                    <Sparkles size={12} />
                                    <span>Koreksi Essay</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-gray-400 text-center sm:hidden pt-1">
                      👉 Geser tabel ke kanan/kiri untuk melihat rincian nilai &amp; durasi
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <button
                onClick={() => fetchHasilPeserta(selectedExamForHasil)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors mr-2"
              >
                <RefreshCw size={14} /> Refresh
              </button>
              <button
                onClick={() => setShowHasilModal(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* MODAL 7: KOREKSI JAWABAN ESSAY & ASISTEN AI (GURU/ADMIN)               */}
      {/* ====================================================================== */}
      {showEssayModal && selectedExamForEssay && (
        <div className="fixed inset-0 z-[85] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 pb-20 sm:pb-5" onClick={() => setShowEssayModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col my-auto overflow-hidden border border-gray-200 dark:border-gray-800" onClick={e => e.stopPropagation()}>
            {/* Header Modal 7: Model Verifikasi Ruang Ujian (Garis pembatas tidak sampai ujung) */}
            <div className="px-5 sm:px-6 pt-5 sm:pt-6 shrink-0 relative">
              <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
                {/* Tombol Tutup (X) Konsisten di Pojok Kanan Atas */}
                <button
                  onClick={() => setShowEssayModal(false)}
                  className="absolute top-5 right-5 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl transition-colors cursor-pointer"
                  title="Tutup Modal"
                >
                  <X size={20} />
                </button>

                {/* Info Judul & Mapel */}
                <div className="flex items-center gap-3 pr-10">
                  <div className="w-9 h-9 rounded-2xl bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold shrink-0">
                    <Sparkles size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-base sm:text-lg text-gray-900 dark:text-gray-100">
                      Koreksi Essay &amp; Asisten AI
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed break-words">
                      {selectedExamForEssay.judul} &bull; {selectedExamForEssay.mata_pelajaran} &bull; Total {essayStudentAnswers.length} Lembar Jawaban Santri
                    </p>
                  </div>
                </div>

                {/* Tombol Analisis AI Rata Tengah (Hapus ikon tambahan, cukup emoji ⚡) */}
                <div className="flex items-center justify-center mt-3">
                  <button
                    type="button"
                    onClick={() => handleRunAiGrading()}
                    disabled={runningAiGrading || essayStudentAnswers.length === 0}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    title="Gunakan AI untuk menganalisis dan memberi rekomendasi nilai pada semua jawaban essay santri"
                  >
                    {runningAiGrading && <RefreshCw size={14} className="animate-spin text-white" />}
                    <span>{runningAiGrading ? 'Menganalisis dengan AI...' : '⚡ Analisis Semua dengan AI'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {loadingEssayAnswers ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw size={28} className="animate-spin text-purple-600" />
                  <span className="ml-3 text-gray-500 font-semibold text-sm">Memuat jawaban essay santri...</span>
                </div>
              ) : essayStudentAnswers.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <BookOpen size={44} className="mx-auto text-gray-300" />
                  <p className="text-gray-500 font-bold text-sm">Belum ada jawaban essay yang disubmit oleh santri untuk ujian ini.</p>
                  <p className="text-xs text-gray-400 max-w-md mx-auto">
                    Pastikan ujian telah memuat soal bertipe Essay dan santri telah menyelesaikan pengerjaan.
                  </p>
                </div>
              ) : (
                essayStudentAnswers.map((item, idx) => {
                  const draft = essayGradesDraft[item.id] || {
                    skor_final: item.skor_final !== null ? Number(item.skor_final) : (item.skor_ai !== null ? Number(item.skor_ai) : Number(item.bobot_maksimal)),
                    catatan_guru: item.catatan_guru || '',
                  };

                  return (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700/80 p-4 sm:p-5 space-y-3 shadow-xs"
                    >
                      {/* Top Bar item */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-gray-100 dark:border-gray-700">
                        {/* Nama Santri & Info Kelas: Bertumpuk 2 baris di HP agar longgar & utuh */}
                        <div className="flex items-start sm:items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                            {idx + 1}
                          </span>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-w-0">
                            <strong className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                              {item.nama_santri}
                            </strong>
                            <span className="text-xs text-gray-400">
                              ({item.nis || '-'} &bull; {item.nama_kelas || 'Madin'})
                            </span>
                          </div>
                        </div>

                        {/* Badges Soal & Status: Bertumpuk 2 baris rata tengah di HP */}
                        <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-1.5 sm:gap-2 text-center w-full sm:w-auto">
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            Soal No. {item.nomor_urut} &bull; Bobot Max: {item.bobot_maksimal} Poin
                          </span>
                          {item.status_koreksi === 'disetujui' ? (
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 whitespace-nowrap">
                              Disetujui
                            </span>
                          ) : item.status_koreksi === 'dinilai_ai' ? (
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 whitespace-nowrap">
                              Saran AI
                            </span>
                          ) : (
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 whitespace-nowrap">
                              Belum Dinilai
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pertanyaan */}
                      <div>
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Pertanyaan:</span>
                        <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                          {item.pertanyaan}
                        </p>
                      </div>

                      {/* Kunci Acuan */}
                      <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 text-[11px] space-y-1">
                        <p className="text-gray-600 dark:text-gray-400">
                          <strong className="text-emerald-700 dark:text-emerald-400">Kunci Acuan Guru: </strong>
                          {item.kunci_ideal || '-'}
                        </p>
                        {item.rubrik_kata_kunci && (
                          <p className="text-purple-600 dark:text-purple-400 font-mono text-[10px]">
                            <strong>Kata Kunci Pokok: </strong>{item.rubrik_kata_kunci}
                          </p>
                        )}
                      </div>

                      {/* Jawaban Santri */}
                      <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 space-y-1">
                        <span className="text-[11px] font-extrabold text-amber-900 dark:text-amber-300 uppercase tracking-wider block">
                          Jawaban Santri:
                        </span>
                        <p className="text-xs sm:text-sm text-gray-800 dark:text-gray-100 font-medium whitespace-pre-wrap leading-relaxed">
                          {item.jawaban_santri || <em className="text-gray-400">(Tidak memberikan jawaban)</em>}
                        </p>
                      </div>

                      {/* Rekomendasi Asisten AI */}
                      {item.skor_ai !== null && (
                        <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
                              <strong className="text-indigo-900 dark:text-indigo-200">
                                Rekomendasi AI: {item.skor_ai} / {item.bobot_maksimal} Poin
                              </strong>
                            </div>
                            <p className="text-indigo-800 dark:text-indigo-300 text-[11px] leading-relaxed">
                              {item.feedback_ai}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEssayGradesDraft((prev) => ({
                                ...prev,
                                [item.id]: {
                                  skor_final: Number(item.skor_ai),
                                  catatan_guru: prev[item.id]?.catatan_guru || item.feedback_ai || '',
                                },
                              }));
                            }}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 transition-colors shadow-xs"
                          >
                            Gunakan Nilai AI
                          </button>
                        </div>
                      )}

                      {/* Form Input Nilai Guru */}
                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-gray-700 dark:text-gray-300 shrink-0">
                            Skor Akhir Guru:
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={item.bobot_maksimal}
                            step="0.5"
                            value={draft.skor_final}
                            onChange={(e) => {
                              const val = Math.min(Number(item.bobot_maksimal), Math.max(0, parseFloat(e.target.value) || 0));
                              setEssayGradesDraft((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  skor_final: val,
                                },
                              }));
                            }}
                            className="w-20 px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-emerald-500 font-extrabold text-xs sm:text-sm text-center text-emerald-700 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <span className="text-xs text-gray-400">/ {item.bobot_maksimal}</span>
                        </div>

                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Catatan koreksi / evaluasi untuk santri (opsional)..."
                            value={draft.catatan_guru}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEssayGradesDraft((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  catatan_guru: val,
                                },
                              }));
                            }}
                            className="w-full px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={runningAiGrading}
                          onClick={() => handleRunAiGrading(item.id)}
                          className="px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-800 dark:text-purple-300 font-bold text-xs flex items-center gap-1 transition-colors shrink-0"
                          title="Analisis butir ini dengan AI"
                        >
                          <Sparkles size={13} />
                          <span>Nilai Butir Ini</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <p className="text-xs text-gray-500 text-center sm:text-left">
                Menyimpan nilai akan otomatis mengalkulasikan skor akhir (PG + Essay) dan menyinkronkannya ke raport santri.
              </p>

              <div className="flex items-center justify-end w-full sm:w-auto">
                <button
                  type="button"
                  disabled={savingGrades || essayStudentAnswers.length === 0}
                  onClick={() => handleSaveAllEssayGrades()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-black shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  <span>{savingGrades ? 'Menyimpan...' : 'Simpan Nilai & Sinkronkan Raport'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: RUANG PENGAWASAN REAL-TIME / LIVE PROCTORING (GURU/PENGAWAS)      */}
      {/* ========================================================================= */}
      {showLiveProctorModal && selectedExamForLive && (
        <div className="fixed inset-0 z-[85] bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 pb-20 sm:pb-4" onClick={() => setShowLiveProctorModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col my-auto overflow-hidden border border-gray-200 dark:border-gray-800" onClick={e => e.stopPropagation()}>
            {/* Header Modal 8: Model Verifikasi Ruang Ujian (Garis tidak sampai ujung) */}
            <div className="px-4 sm:px-5 pt-4 sm:pt-5 shrink-0 relative">
              <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
                {/* Tombol (X) Konsisten di Pojok Kanan Atas */}
                <button
                  onClick={() => setShowLiveProctorModal(false)}
                  className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl transition-colors cursor-pointer"
                  title="Tutup ruang pengawasan"
                >
                  <X size={20} />
                </button>

                {/* Baris 1: Judul + Dot */}
                <div className="flex items-center justify-center gap-2 pr-0 sm:pr-8">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <h3 className="font-black text-sm sm:text-base text-gray-900 dark:text-gray-100 text-center">
                    Ruang Pengawasan Ujian Real-Time
                  </h3>
                </div>

                {/* Baris 2: Subtitle rata tengah agar lebih estetik */}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed break-words text-center">
                  {selectedExamForLive.judul} &bull; {selectedExamForLive.mata_pelajaran} &bull; {liveProctorData?.exam?.nama_kelas || selectedExamForLive.nama_kelas || 'Seluruh Kelas'} &bull; Token:{' '}
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded text-[11px]">
                    {liveProctorData?.exam?.token_ujian || selectedExamForLive.token_ujian || '-'}
                  </span>
                </p>

                {/* Baris 3: Kontrol Auto-Refresh & Refresh, rata tengah di HP */}
                <div className="flex items-center justify-center gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={() => setLiveAutoRefresh(!liveAutoRefresh)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      liveAutoRefresh
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/50'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                    }`}
                    title={liveAutoRefresh ? 'Auto refresh aktif' : 'Auto refresh dijeda'}
                  >
                    <span className={`w-2 h-2 rounded-full ${liveAutoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                    <span>{liveAutoRefresh ? `Auto Live (${liveCountdown}s)` : 'Jeda Auto'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={loadingLiveProctor}
                    onClick={() => {
                      fetchLiveProctorData(selectedExamForLive.id);
                      setLiveCountdown(5);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer border border-gray-200 dark:border-gray-700"
                    title="Perbarui data sekarang"
                  >
                    <RefreshCw size={14} className={loadingLiveProctor ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Area Gulir Terpadu: Dimulai langsung dari bawah header agar ruang pantau lapang di HP */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              {/* Statistik Cepat / Quick Badges */}
              <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 grid grid-cols-3 sm:grid-cols-5 gap-2 shrink-0">
                {/* Baris 1 (HP): Total Peserta memenuhi 1 baris */}
                <div className="col-span-3 sm:col-span-1 bg-white dark:bg-gray-800 p-2.5 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 shadow-2xs">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase">Total Peserta</span>
                  <span className="text-base sm:text-lg font-black text-gray-800 dark:text-gray-100">
                    {liveProctorData?.summary?.total_peserta || 0}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-1">Santri</span>
                </div>

                {/* Baris 2 (HP): Mengerjakan, Belum Masuk, Selesai berdampingan sama rata 3 kolom */}
                <div className="col-span-1 bg-emerald-50/70 dark:bg-emerald-950/30 p-2.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/40 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase truncate">Mengerjakan</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  </div>
                  <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300 block">
                    {liveProctorData?.summary?.sedang_mengerjakan || 0}
                  </span>
                  <span className="text-[10px] text-emerald-600/70">Santri Live</span>
                </div>

                <div className="col-span-1 bg-gray-100/70 dark:bg-gray-800/80 p-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xs">
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block uppercase truncate">Belum Masuk</span>
                  <span className="text-base sm:text-lg font-black text-gray-700 dark:text-gray-300 block">
                    {liveProctorData?.summary?.belum_masuk || 0}
                  </span>
                  <span className="text-[10px] text-gray-400">Santri</span>
                </div>

                <div className="col-span-1 bg-blue-50/70 dark:bg-blue-950/30 p-2.5 rounded-2xl border border-blue-200/80 dark:border-blue-800/40 shadow-2xs">
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 block uppercase truncate">Selesai</span>
                  <span className="text-base sm:text-lg font-black text-blue-700 dark:text-blue-300 block">
                    {liveProctorData?.summary?.selesai || 0}
                  </span>
                  <span className="text-[10px] text-blue-600/70">Tersimpan</span>
                </div>

                {/* Baris 3 (HP): Didiskualifikasi memenuhi 1 baris paling bawah */}
                <div className="col-span-3 sm:col-span-1 bg-rose-50/70 dark:bg-rose-950/30 p-2.5 rounded-2xl border border-rose-200/80 dark:border-rose-800/40 shadow-2xs">
                  <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 block uppercase">Didiskualifikasi</span>
                  <span className="text-base sm:text-lg font-black text-rose-700 dark:text-rose-300">
                    {liveProctorData?.summary?.didiskualifikasi || 0}
                  </span>
                  <span className="text-[10px] text-rose-600/70 ml-1">Pelanggaran</span>
                </div>
              </div>

              {/* Filter Pills: 1 baris dengan scroll horizontal */}
              <div className="sticky top-0 z-10 px-2 sm:px-4 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xs shadow-2xs">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                  {[
                    { key: 'semua', label: 'Semua Peserta', count: liveProctorData?.summary?.total_peserta || 0 },
                    { key: 'sedang_mengerjakan', label: '🟢 Mengerjakan', count: liveProctorData?.summary?.sedang_mengerjakan || 0 },
                    { key: 'belum_masuk', label: '⚪ Belum Masuk', count: liveProctorData?.summary?.belum_masuk || 0 },
                    { key: 'selesai', label: '✅ Selesai', count: liveProctorData?.summary?.selesai || 0 },
                    { key: 'didiskualifikasi', label: '⛔ Diskualifikasi', count: liveProctorData?.summary?.didiskualifikasi || 0 },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setLiveProctorFilter(f.key as any)}
                      className={`px-2.5 py-1 sm:px-3 sm:py-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all shrink-0 cursor-pointer whitespace-nowrap ${
                        liveProctorFilter === f.key
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Body: Daftar Peserta & Progress Real-Time */}
              <div className="p-3 sm:p-5 space-y-3 flex-1">
              {loadingLiveProctor && !liveProctorData ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-3">
                  <RefreshCw size={28} className="animate-spin text-blue-500" />
                  <p className="text-xs font-medium">Memuat data ruang pengawasan real-time...</p>
                </div>
              ) : (
                (() => {
                  const rawList = liveProctorData?.participants || [];
                  const filtered = rawList.filter((p: any) => {
                    if (liveProctorFilter === 'semua') return true;
                    if (liveProctorFilter === 'sedang_mengerjakan') {
                      return p.status === 'sedang_mengerjakan' || p.status === 'terputus';
                    }
                    return p.status === liveProctorFilter;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-12 text-center text-gray-400 space-y-2">
                        <Users size={32} className="mx-auto opacity-30" />
                        <p className="text-xs font-medium">Tidak ada peserta dalam kategori ini.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2.5">
                      {filtered.map((p: any) => {
                        const isDisq = p.status === 'didiskualifikasi';
                        const isOnline = p.status === 'sedang_mengerjakan';
                        const isOffline = p.status === 'terputus';
                        const isFinished = p.status === 'selesai';
                        const isNotStarted = p.status === 'belum_masuk';

                        const totalSoal = p.total_soal || liveProctorData?.exam?.total_soal || 1;
                        const pctAnswered = Math.min(Math.round((p.jumlah_terjawab / totalSoal) * 100), 100);

                        return (
                          <div
                            key={p.murid_id}
                            className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                              isDisq
                                ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/50'
                                : isOnline
                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/50 shadow-2xs'
                                : isFinished
                                ? 'bg-blue-50/30 dark:bg-blue-950/10 border-blue-200 dark:border-blue-800/40'
                                : 'bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                              {/* Sisi Kiri & Tengah: Foto + Info Santri + Progress Bar */}
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1 min-w-0 w-full">
                                {/* Baris Header Santri: Foto + Nama Santri (di HP berdampingan, di PC foto di kiri) */}
                                <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                                  {/* Foto / Inisial Avatar Santri */}
                                  <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl overflow-hidden shrink-0 shadow-2xs">
                                    <div
                                      className={`absolute inset-0 flex items-center justify-center font-black text-xs sm:text-sm ${
                                        isDisq
                                          ? 'bg-rose-500 text-white'
                                          : isOnline
                                          ? 'bg-emerald-600 text-white'
                                          : isFinished
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                      }`}
                                    >
                                      {p.nama_murid ? p.nama_murid.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    {p.foto && p.foto !== '-' && (
                                      <img
                                        src={getFotoUrl(p.foto)}
                                        alt={p.nama_murid}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    )}
                                  </div>

                                  {/* Nama Santri di HP (tampil di sebelah foto) */}
                                  <div className="min-w-0 flex-1 sm:hidden">
                                    <h4 className="font-extrabold text-xs sm:text-sm text-gray-800 dark:text-gray-100 truncate">
                                      {p.nama_murid}
                                    </h4>
                                  </div>
                                </div>

                                {/* Konten Detail: Di HP merapat ke ujung kiri rata dengan foto, di PC berada di samping foto */}
                                <div className="flex-1 min-w-0 w-full space-y-1.5">
                                  {/* Baris Info: Nama Santri (di PC) + NIS & Status Badge (Merapat Penuh ke Ujung Kiri di HP) */}
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 w-full">
                                    <h4 className="hidden sm:inline-block font-extrabold text-xs sm:text-sm text-gray-800 dark:text-gray-100">
                                      {p.nama_murid}
                                    </h4>
                                    <span className="text-[11px] text-gray-400">
                                      NIS: <span className="font-mono">{p.nis || '-'}</span> &bull; {p.jenis_kelamin === 'P' ? 'Perempuan' : 'Laki-laki'}
                                    </span>
                                    {/* Status Badge */}
                                    {isOnline && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                                        <span>Live ({p.seconds_ago !== null ? `${p.seconds_ago}s` : 'Aktif'})</span>
                                      </span>
                                    )}
                                    {isOffline && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                        <span>Layar Keluar / Idle</span>
                                      </span>
                                    )}
                                    {isNotStarted && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                        Belum Masuk
                                      </span>
                                    )}
                                    {isFinished && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300">
                                        <CheckCircle size={10} />
                                        <span>Selesai (Skor: {p.skor_akhir ?? '-'})</span>
                                      </span>
                                    )}
                                    {isDisq && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-2xs">
                                        <AlertTriangle size={10} />
                                        <span>Gugur (Diskualifikasi)</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* Baris Bawah: Progress Bar (Merapat Penuh ke Ujung Kiri di HP) */}
                                  <div className="w-full">
                                    <div className="flex items-center justify-between text-[11px] mb-1 font-bold">
                                      <span className="text-gray-600 dark:text-gray-300">
                                        Terjawab: <strong className="text-emerald-600 dark:text-emerald-400">{p.jumlah_terjawab}</strong> / {totalSoal} Soal
                                      </span>
                                      <div className="flex items-center gap-2 text-[10px]">
                                        {p.jumlah_ragu > 0 && (
                                          <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold">
                                            {p.jumlah_ragu} Ragu
                                          </span>
                                        )}
                                        <span className="text-gray-400">
                                          {p.jumlah_belum} Belum
                                        </span>
                                      </div>
                                    </div>
                                    {/* Bar Kemajuan */}
                                    <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                      <div
                                        className={`h-full transition-all duration-500 ${
                                          isDisq
                                            ? 'bg-rose-500'
                                            : isFinished
                                            ? 'bg-blue-600'
                                            : 'bg-emerald-500'
                                        }`}
                                        style={{ width: `${isNotStarted ? 0 : pctAnswered}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Sisi Kanan (Bawah di HP): Pindah Layar (1 baris inline) & Tombol Reset Sesi — Berdampingan 1 Baris di HP agar lebih tipis, Bertumpuk di PC */}
                              <div className="w-full sm:w-48 shrink-0 flex flex-row items-center justify-between sm:flex-col sm:items-end sm:justify-center gap-2 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                                {/* Catatan Pelanggaran — 1 baris inline tidak terpotong */}
                                <div className="text-left sm:text-right">
                                  {p.jumlah_pelanggaran === 0 && !isDisq ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                      <ShieldCheck size={13} />
                                      <span>Pindah Layar: 0x (Tertib)</span>
                                    </span>
                                  ) : (
                                    <span
                                      className={`inline-flex items-center gap-1 text-[11px] font-black whitespace-nowrap ${
                                        isDisq || p.jumlah_pelanggaran >= (selectedExamForLive.max_pelanggaran || 3)
                                          ? 'text-rose-600 dark:text-rose-400 animate-pulse'
                                          : 'text-amber-600 dark:text-amber-400'
                                      }`}
                                      title={p.log_pelanggaran?.map((l: any) => `${l.time}: ${l.reason}`).join(' | ')}
                                    >
                                      <AlertTriangle size={13} />
                                      <span>Pindah Layar: {Math.max(p.jumlah_pelanggaran, isDisq ? (selectedExamForLive.max_pelanggaran || 3) : 1)}x Pelanggaran</span>
                                    </span>
                                  )}
                                </div>

                                {/* Tombol Reset / Izinkan Masuk Lagi bagi santri yang bermasalah / diskualifikasi */}
                                {(isDisq || isOffline || isFinished) && (
                                  <button
                                    type="button"
                                    disabled={actionResetLoading === p.murid_id}
                                    onClick={() => handleResetSantriLive(p.murid_id, p.nama_murid)}
                                    className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold transition-all border border-amber-200 dark:border-amber-800/50 flex items-center gap-1 shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                                    title="Izinkan santri masuk kembali dan mengulang pengerjaan jika ada kendala teknis"
                                  >
                                    <RefreshCw size={12} className={actionResetLoading === p.murid_id ? 'animate-spin' : ''} />
                                    <span>Reset Sesi</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </div>

          {/* Footer Modal 8: Di HP di bawah rata tengah, di PC di ujung kanan */}
          <div className="p-3.5 sm:p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-2.5 sm:gap-3 text-xs text-gray-500 shrink-0 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>Pengawasan digital aktif: memantau kehadiran, progress butir soal, dan pelanggaran layar real-time.</span>
            </div>
            <button
              type="button"
              onClick={() => setShowLiveProctorModal(false)}
              className="px-6 sm:px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-xs transition-colors cursor-pointer shadow-2xs active:scale-95 shrink-0"
            >
              Tutup
            </button>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

