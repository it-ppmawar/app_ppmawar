'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles, Award, Clock, CheckCircle, AlertCircle, AlertTriangle,
  ShieldCheck, MapPin, Key, RefreshCw, Play, Plus, Trash2, Edit3,
  BookOpen, User, FileText, ChevronRight, ChevronLeft, ChevronDown, Flag, X,
  ExternalLink, Lock, Unlock, HelpCircle, Check, ArrowRight,
  Filter, Search, Layers, Radio, Settings
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
  waktu_selesai?: string | null;
}

interface QuestionItem {
  id: number;
  ujian_id: number;
  nomor_urut: number;
  pertanyaan: string;
  gambar?: string | null;
  opsi_a: string;
  opsi_b: string;
  opsi_c: string;
  opsi_d?: string | null;
  opsi_e?: string | null;
  kunci_jawaban?: string;
  bobot_nilai: number;
  pembahasan?: string | null;
}

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
    pertanyaan: '',
    opsi_a: '',
    opsi_b: '',
    opsi_c: '',
    opsi_d: '',
    opsi_e: '',
    kunci_jawaban: 'A',
    bobot_nilai: 10,
    pembahasan: '',
  });

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

  // SSO Embed Modal
  const [ssoUrl, setSsoUrl] = useState<string | null>(null);

  // Modal Lihat Hasil Peserta (guru/admin)
  const [showHasilModal, setShowHasilModal] = useState(false);
  const [selectedExamForHasil, setSelectedExamForHasil] = useState<ExamItem | null>(null);
  const [hasilPeserta, setHasilPeserta] = useState<any[]>([]);
  const [hasilStatistik, setHasilStatistik] = useState<any>(null);
  const [loadingHasil, setLoadingHasil] = useState(false);

  const fetchHasilPeserta = async (exam: ExamItem) => {
    setLoadingHasil(true);
    setHasilPeserta([]);
    setHasilStatistik(null);
    try {
      const res = await fetch(`/api/ujian/hasil?ujian_id=${exam.id}`);
      const data = await res.json();
      if (data.hasil) {
        setHasilPeserta(Array.isArray(data.hasil) ? data.hasil : [data.hasil]);
        setHasilStatistik(data.statistik || null);
      }
    } catch (e) {
      console.error('Gagal ambil hasil peserta', e);
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
        setExamQuestions(data.soal || []);
        setSecondsLeft((activeExam.durasi_menit || 45) * 60);
        setCurrentQIndex(0);
        setUserAnswers({});
        setFlaggedQuestions(new Set());
        setExamStep('in_progress');
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
            handleSubmitExam(true); // Auto submit saat waktu habis
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [examStep, secondsLeft]);

  // 5. Submit Jawaban Ujian
  const handleSubmitExam = async (isAuto = false) => {
    if (!activeExam) return;
    if (!isAuto && !confirm('Apakah Anda yakin ingin menyelesaikan ujian ini dan mengirimkan seluruh jawaban?')) {
      return;
    }

    setSubmittingExam(true);
    try {
      const durationSeconds = (activeExam.durasi_menit * 60) - secondsLeft;
      const res = await fetch('/api/ujian/kerjakan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          ujian_id: activeExam.id,
          answers: userAnswers,
          durasi_detik: Math.max(durationSeconds, 1),
          token_dipakai: tokenInput,
          user_lat: gpsCoords?.lat || null,
          user_lng: gpsCoords?.lng || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setExamResult(data);
        setExamStep('completed');
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

  // 6. Launch QuizB SSO
  const handleLaunchQuizBSSO = async (exam: ExamItem) => {
    try {
      const qId = exam.quizb_id || '';
      const res = await fetch(`/api/ujian/sso?quiz_id=${qId}&mode=exam`);
      const data = await res.json();
      if (data.success && data.sso_url) {
        setSsoUrl(data.sso_url);
      } else {
        window.open('https://quizb.my.id/#/quizzes', '_blank');
      }
    } catch (e) {
      window.open('https://quizb.my.id', '_blank');
    }
  };

  // 7. Pengelolaan Soal
  const openSoalManager = async (exam: ExamItem) => {
    setSelectedExamForSoal(exam);
    setShowSoalModal(true);
    setLoadingQuestions(true);
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
          pertanyaan: '',
          opsi_a: '',
          opsi_b: '',
          opsi_c: '',
          opsi_d: '',
          opsi_e: '',
          kunci_jawaban: 'A',
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
        {/* Top Header Exam Bar */}
        <header className="bg-emerald-800 text-white p-3 sm:p-4 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center font-black">
              {currentQIndex + 1}
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-extrabold line-clamp-1">{activeExam.judul}</h2>
              <p className="text-[11px] text-emerald-200">
                {activeExam.mata_pelajaran} &bull; Soal {currentQIndex + 1} dari {examQuestions.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Timer Countdown */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono font-bold text-xs sm:text-sm shadow-inner ${
                secondsLeft <= 300
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-black/30 text-emerald-200 border border-white/10'
              }`}
            >
              <Clock size={16} />
              <span>{formatTimer(secondsLeft)}</span>
            </div>

            <button
              onClick={() => handleSubmitExam(false)}
              disabled={submittingExam}
              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <CheckCircle size={15} />
              <span>{submittingExam ? 'Mengirim...' : 'Selesai'}</span>
            </button>
          </div>
        </header>

        {/* Exam Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col max-w-4xl mx-auto w-full">
          {curQ ? (
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 sm:p-7 shadow-sm border border-gray-200 dark:border-gray-700 space-y-6 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Butir Soal No. {currentQIndex + 1}
                  </span>
                  <button
                    onClick={() => {
                      const next = new Set(flaggedQuestions);
                      if (next.has(curQ.id)) next.delete(curQ.id);
                      else next.add(curQ.id);
                      setFlaggedQuestions(next);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                      flaggedQuestions.has(curQ.id)
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Flag size={13} />
                    <span>{flaggedQuestions.has(curQ.id) ? 'Ragu-ragu (Ditandai)' : 'Ragu-ragu'}</span>
                  </button>
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

                {/* Pilihan Opsi A, B, C, D, E */}
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
              </div>

              {/* Navigasi Bawah */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex items-center justify-between gap-3">
                <button
                  onClick={() => setCurrentQIndex((prev) => Math.max(prev - 1, 0))}
                  disabled={currentQIndex === 0}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-bold disabled:opacity-30 transition-all flex items-center gap-1.5"
                >
                  <ChevronLeft size={16} />
                  <span>Sebelumnya</span>
                </button>

                <div className="text-xs font-semibold text-gray-400">
                  Terjawab: <strong className="text-emerald-600">{answeredCount}</strong> / {examQuestions.length}
                </div>

                <button
                  onClick={() => setCurrentQIndex((prev) => Math.min(prev + 1, examQuestions.length - 1))}
                  disabled={currentQIndex === examQuestions.length - 1}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold disabled:opacity-30 transition-all flex items-center gap-1.5"
                >
                  <span>Berikutnya</span>
                  <ChevronRight size={16} />
                </button>
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
      </div>
    );
  }

  // =========================================================================
  // TAMPILAN SELESAI UJIAN (HASIL INSTAN)
  // =========================================================================
  if (examStep === 'completed' && examResult) {
    return (
      <div className="max-w-xl mx-auto p-4 sm:p-6 my-10 animate-[fadeIn_0.3s_ease-out]">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 dark:border-gray-700 text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <Award size={36} className="animate-bounce" />
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100">
              Alhamdulillah, Ujian Selesai!
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Jawaban Anda telah terekam dan disinkronkan ke buku rapor madrasah.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800/60">
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Nilai Skor Akhir Anda
            </p>
            <p className="text-5xl font-black text-emerald-600 dark:text-emerald-400 my-2">
              {examResult.skor_akhir}
            </p>
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                examResult.status_lulus
                  ? 'bg-emerald-200 text-emerald-900'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {examResult.status_lulus ? '🌟 LULUS KKM' : '⚠️ Perlu Remedial'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Total Soal</span>
              <span className="text-lg font-black text-gray-800 dark:text-gray-100">{examResult.total_soal}</span>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl">
              <span className="text-[10px] text-emerald-600 uppercase font-bold block">Benar</span>
              <span className="text-lg font-black text-emerald-600">{examResult.jumlah_benar}</span>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
              <span className="text-[10px] text-rose-600 uppercase font-bold block">Salah</span>
              <span className="text-lg font-black text-rose-600">{examResult.jumlah_salah}</span>
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

            {santriInfo && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 text-xs font-semibold text-emerald-100">
                <User size={14} />
                <span>
                  Santri: <strong>{santriInfo.nama}</strong> ({santriInfo.nis || 'NIS -'})
                </span>
              </div>
            )}
          </div>

          {/* Menu Tombol Header: Tersusun Rapi & Lapang (Hanya 2 Tombol Tab di Hero) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-start md:justify-end gap-3 w-full md:w-auto pt-2 md:pt-0">
            {/* Tombol 1: Daftar Ujian */}
            <button
              type="button"
              onClick={() => setMainTab('daftar')}
              className={`px-4 sm:px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center sm:justify-start gap-3 shadow-sm min-h-[48px] ${
                mainTab === 'daftar'
                  ? 'bg-white text-emerald-950 shadow-md ring-2 ring-emerald-400'
                  : 'bg-emerald-950/60 text-emerald-100 hover:bg-emerald-900/80 border border-emerald-500/30'
              }`}
            >
              <Play size={16} className={mainTab === 'daftar' ? 'text-emerald-700 fill-emerald-700 shrink-0' : 'text-emerald-300 shrink-0'} />
              <div className="flex flex-col items-start leading-tight text-left min-w-0">
                <span className="font-extrabold whitespace-nowrap">Daftar Ujian</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full mt-0.5 ${
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
                className={`px-4 sm:px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center sm:justify-start gap-3 shadow-sm min-h-[48px] ${
                  mainTab === 'kelola'
                    ? 'bg-white text-emerald-950 shadow-md ring-2 ring-emerald-400'
                    : 'bg-emerald-950/60 text-emerald-100 hover:bg-emerald-900/80 border border-emerald-500/30'
                }`}
              >
                <Settings size={16} className={mainTab === 'kelola' ? 'text-emerald-700 shrink-0' : 'text-emerald-300 shrink-0'} />
                <div className="flex flex-col items-start leading-tight text-left min-w-0">
                  <span className="font-extrabold whitespace-nowrap">Kelola Ujian &amp; Bank Soal</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full mt-0.5 ${
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
        <div className="relative w-full lg:max-w-sm xl:max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Cari ujian, mata pelajaran, atau kitab..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Dropdown, Refresh, & Tombol Aksi di Toolbar Pencarian */}
        <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2.5 w-full lg:w-auto">
          <select
            value={filterJenis}
            onChange={(e) => setFilterJenis(e.target.value)}
            className="px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:outline-none"
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

          {isPengajarOrAdmin && (
            <>
              <button
                type="button"
                onClick={openCreateModal}
                className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center gap-1.5"
              >
                <Plus size={16} className="shrink-0" />
                <span className="whitespace-nowrap">Buat Ujian Baru</span>
              </button>

              <button
                type="button"
                onClick={openQuizBImportModal}
                className="px-3.5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center gap-1.5 border border-teal-400/30"
                title="Impor kuis dan butir soal dari QuizB langsung menjadi paket ujian CBT"
              >
                <Sparkles size={15} className="text-yellow-300 shrink-0" />
                <span className="whitespace-nowrap">Impor dari QuizB</span>
              </button>
            </>
          )}
        </div>
      </div>

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
                          <div className="flex items-center justify-between text-xs pt-1 px-1 text-gray-400">
                            <span className="text-[11px]">
                              Peserta: <strong className="text-gray-700 dark:text-gray-200">{exam.total_peserta || 0} Santri</strong>
                            </span>
                            <div className="flex items-center gap-2">
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
                            className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <BookOpen size={13} />
                            <span>Bank Soal ({exam.total_soal || 0})</span>
                          </button>

                          <button
                            onClick={() => openSesiPengawas(exam)}
                            className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Key size={13} />
                            <span>Token &amp; Sesi</span>
                          </button>
                        </div>

                        {/* Tombol Lihat Hasil Peserta */}
                        <button
                          onClick={() => {
                            setSelectedExamForHasil(exam);
                            setShowHasilModal(true);
                            fetchHasilPeserta(exam);
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Award size={13} />
                          <span>Lihat Hasil Peserta ({exam.total_peserta || 0} Santri)</span>
                        </button>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] text-gray-400">
                            Peserta Ujian: <strong className="text-gray-700 dark:text-gray-200">{exam.total_peserta || 0} Santri</strong>
                          </span>

                          <div className="flex items-center gap-1">
                            {exam.quizb_id && (
                              <button
                                onClick={() => handleLaunchQuizBSSO(exam)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                                title="Buka Mirror QuizB SSO"
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

            <div className="space-y-1">
              <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">{activeExam.judul}</h4>
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
            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <MapPin size={14} className="text-emerald-600" />
                  <span>2. Lokasi Perangkat (Anti-Joki)</span>
                </span>
                <button
                  type="button"
                  onClick={detectGPS}
                  disabled={gpsLoading}
                  className="text-xs text-emerald-600 font-bold hover:underline"
                >
                  {gpsLoading ? 'Mendeteksi...' : 'Cek Ulang GPS'}
                </button>
              </div>

              {gpsCoords ? (
                <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle size={13} />
                  <span>Koordinat GPS terdeteksi aktif ({gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)})</span>
                </div>
              ) : (
                <div className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                  <AlertTriangle size={13} />
                  <span>Tekan tombol di atas untuk mengaktifkan izin GPS perangkat.</span>
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
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-700 to-emerald-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-yellow-300">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">
                    Impor Paket Ujian dari QuizB
                  </h3>
                  <p className="text-xs text-emerald-100/80">
                    Tarik butir soal dari quizb.my.id langsung menjadi paket ujian CBT santri PPMAWAR.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuizBImportModal(false)}
                className="p-1.5 text-emerald-200 hover:text-white rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
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
              <div className="flex justify-end gap-2 p-4 sm:p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 shrink-0">
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
                    <>
                      <Sparkles size={14} className="text-yellow-300" />
                      <span>
                        🚀 Impor &amp; Terbitkan Paket Ujian ({quizBModalQuestions.length} Soal)
                      </span>
                    </>
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
            <div className="p-4 sm:p-5 bg-emerald-800 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-extrabold text-base text-white">
                  Bank Soal: {selectedExamForSoal.judul}
                </h3>
                <p className="text-xs text-emerald-200">
                  {selectedExamForSoal.mata_pelajaran} &bull; Total {questions.length} Butir Soal Tersimpan
                </p>
              </div>
              <button
                onClick={() => setShowSoalModal(false)}
                className="p-1.5 text-emerald-200 hover:text-white rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-6">
              {/* Form Tambah / Edit Soal */}
              <form onSubmit={handleSaveQuestion} className="bg-gray-50 dark:bg-gray-900/60 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
                <h4 className="font-bold text-xs sm:text-sm text-gray-800 dark:text-gray-200">
                  {editingQuestion ? 'Edit Soal' : '➕ Tambah Butir Soal Baru'}
                </h4>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Pertanyaan / Soal <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={formQuestion.pertanyaan}
                    onChange={(e) => setFormQuestion({ ...formQuestion, pertanyaan: e.target.value })}
                    placeholder="Tuliskan butir soal di sini..."
                    className="w-full p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                            pertanyaan: '',
                            opsi_a: '',
                            opsi_b: '',
                            opsi_c: '',
                            opsi_d: '',
                            opsi_e: '',
                            kunci_jawaban: 'A',
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
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md transition-all text-center flex items-center justify-center gap-1.5"
                    >
                      <Plus size={14} />
                      <span>{editingQuestion ? 'Simpan Soal' : 'Tambahkan Soal'}</span>
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
                      className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-bold text-emerald-600">No. {idx + 1}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingQuestion(q);
                              setFormQuestion({
                                pertanyaan: q.pertanyaan,
                                opsi_a: q.opsi_a,
                                opsi_b: q.opsi_b,
                                opsi_c: q.opsi_c,
                                opsi_d: q.opsi_d || '',
                                opsi_e: q.opsi_e || '',
                                kunci_jawaban: q.kunci_jawaban || 'A',
                                bobot_nilai: q.bobot_nilai,
                                pembahasan: q.pembahasan || '',
                              });
                            }}
                            className="p-1 rounded text-gray-500 hover:bg-gray-100"
                            title="Edit"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <p className="font-semibold text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                        {q.pertanyaan}
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-gray-400 pt-1">
                        <div>A. {q.opsi_a}</div>
                        <div>B. {q.opsi_b}</div>
                        {q.opsi_c && <div>C. {q.opsi_c}</div>}
                        {q.opsi_d && <div>D. {q.opsi_d}</div>}
                      </div>

                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] text-emerald-600 font-bold">
                        Kunci Jawaban: {q.kunci_jawaban} &bull; Bobot: {q.bobot_nilai} Poin
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
                      <span>Titik Acuan &amp; Jarak Maksimal (Anti-Joki)</span>
                    </div>
                    <div className="flex justify-center w-full">
                      {sesiData.lat_target ? (
                        <button
                          type="button"
                          onClick={handleResetToPesantren}
                          title="Klik untuk ubah / reset ke Pusat Pesantren"
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/70 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold border border-emerald-300 dark:border-emerald-700 transition-colors shadow-2xs"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>📍 Lokasi Pengawas (Terkunci)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleLockPengawasLocation}
                          title="Klik untuk kunci lokasi GPS pengawas saat ini"
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-100 hover:bg-blue-200 dark:bg-blue-950/70 dark:hover:bg-blue-900 text-blue-800 dark:text-blue-300 text-[11px] font-bold border border-blue-300 dark:border-blue-700 transition-colors shadow-2xs"
                        >
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          <span>🏢 Pusat Pesantren (Default)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Keterangan Koordinat */}
                  <div className="text-[11px] text-gray-500 bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700/60">
                    {sesiData.lat_target ? (
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <strong className="text-emerald-600 dark:text-emerald-400">Terkunci pada Ruang Ujian Pengawas:</strong>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">GPS Pengawas Aktif</span>
                        </div>
                        <span className="font-mono text-[10px] text-gray-400">
                          Lat: {Number(sesiData.lat_target).toFixed(6)}, Lng: {Number(sesiData.lng_target).toFixed(6)}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <strong className="text-blue-600 dark:text-blue-400">Mengikuti Halaman Pengaturan (Pusat Pesantren):</strong>
                          <span className="text-[10px] text-blue-700 dark:text-blue-300 font-bold bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md">Pesantren Default</span>
                        </div>
                        <span className="font-mono text-[10px] text-gray-400">
                          Lat: {defaultPesantrenCoords?.lat || -7.035992}, Lng: {defaultPesantrenCoords?.lng || 112.350798}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tombol Aksi GPS Pengawas */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={geofenceLoading}
                      onClick={handleLockPengawasLocation}
                      className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 ${
                        sesiData.lat_target
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md ring-2 ring-emerald-400/30'
                      }`}
                      title="Kunci titik acuan agar santri harus berada dekat perangkat Anda di kelas"
                    >
                      {geofenceLoading ? <RefreshCw size={13} className="animate-spin" /> : <MapPin size={13} />}
                      <span>{geofenceLoading ? 'Mendeteksi...' : 'Kunci GPS Pengawas'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={geofenceLoading || !sesiData.lat_target}
                      onClick={handleResetToPesantren}
                      className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 ${
                        !sesiData.lat_target
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700'
                          : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-700 dark:text-gray-200 shadow-xs'
                      }`}
                      title="Kembalikan titik acuan ke pusat pesantren dari halaman pengaturan"
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
                      <table className="min-w-[560px] w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800/60 text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">
                            <th className="px-3 py-2.5 text-left">#</th>
                            <th className="px-3 py-2.5 text-left">Nama Santri</th>
                            <th className="px-3 py-2.5 text-left">NIS</th>
                            <th className="px-3 py-2.5 text-center">Nilai</th>
                            <th className="px-3 py-2.5 text-center">Benar</th>
                            <th className="px-3 py-2.5 text-center">Status</th>
                            <th className="px-3 py-2.5 text-center">Durasi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {hasilPeserta.map((h: any, idx: number) => {
                            const durasiMenit = Math.floor((h.durasi_detik || 0) / 60);
                            const durasiDetik = (h.durasi_detik || 0) % 60;
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
                                  <span className={`font-black text-base ${Number(h.skor_akhir) >= (selectedExamForHasil.passing_grade || 70) ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {Number(h.skor_akhir).toFixed(0)}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-center text-xs text-gray-600 dark:text-gray-300">
                                  {h.jumlah_benar}/{h.total_soal}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {h.status_lulus ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                      <Check size={10} /> Lulus
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                                      <X size={10} /> Tidak Lulus
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                                  {durasiMenit}m {durasiDetik}d
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
    </div>
  );
}
