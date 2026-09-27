'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Award, BookOpen, GraduationCap, ClipboardCheck, Search, Filter,
  Save, Printer, CheckCircle, AlertCircle, RefreshCw, User, Calendar,
  ShieldCheck, AlertTriangle, FileText, ChevronRight, Sparkles, Download,
  Edit3
} from 'lucide-react';

export default function PenilaianRaportPage() {
  const [activeTab, setActiveTab] = useState<'input' | 'raport'>('input');
  
  // Data Master
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [kurikulumList, setKurikulumList] = useState<any[]>([]);
  
  // Filter Input Nilai
  const [selectedKelas, setSelectedKelas] = useState<string>('');
  const [selectedMapel, setSelectedMapel] = useState<string>('');
  const [selectedKitab, setSelectedKitab] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [tahunAjaran, setTahunAjaran] = useState<string>('2025/2026');
  const [isCustomMapel, setIsCustomMapel] = useState(false);
  const customMapelInputRef = useRef<HTMLInputElement>(null);
  const isLegerMode = !selectedMapel || selectedMapel === 'SEMUA' || selectedMapel === 'Semua Mapel';

  // State Tabel Input Nilai
  const [muridList, setMuridList] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<number, { harian: string; uts: string; uas: string; akhir: string; predikat: string; catatan: string }>>({});
  const [loadingMurid, setLoadingMurid] = useState(false);
  const [savingScores, setSavingScores] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // State Raport
  const [selectedMuridId, setSelectedMuridId] = useState<string>('');
  const [raportData, setRaportData] = useState<any>(null);
  const [loadingRaport, setLoadingRaport] = useState(false);
  const [savingRaportCatatan, setSavingRaportCatatan] = useState(false);
  const [editCatatan, setEditCatatan] = useState({
    catatan_wali_kelas: '',
    akhlak: 'Baik',
    kerajinan: 'Baik',
    kebersihan: 'Baik',
    tahfidz_hafalan: '',
    status_kelulusan: 'Naik Kelas',
  });

  // Helper kalkulasi predikat otomatis
  const calcPredikat = (score: number) => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'E';
  };

  // Toggle Input Mapel Khusus (mengosongkan input dan mengarahkan kursor otomatis)
  const handleToggleCustomMapel = () => {
    if (!isCustomMapel) {
      setIsCustomMapel(true);
      setSelectedMapel('');
      setSelectedKitab('');
      setTimeout(() => {
        customMapelInputRef.current?.focus();
      }, 60);
    } else {
      setIsCustomMapel(false);
      if (kurikulumList.length > 0) {
        setSelectedMapel(kurikulumList[0].mata_pelajaran);
        setSelectedKitab(kurikulumList[0].kitab || '');
      }
    }
  };

  // 1. Load Data Master (Daftar Kelas)
  useEffect(() => {
    const fetchMaster = async () => {
      try {
        const res = await fetch('/api/penilaian/data');
        const json = await res.json();
        if (json.success) {
          const kList = json.kelas || [];
          setKelasList(kList);
          if (kList.length > 0) {
            setSelectedKelas(String(kList[0].kelas_id));
          }
        }
      } catch (err) {
        console.error('Failed to load master penilaian', err);
      }
    };
    fetchMaster();
  }, []);

  // 1b. Reload daftar Mata Pelajaran tiap kali kelas berubah (tersinkronisasi jadwal_madin)
  useEffect(() => {
    if (!selectedKelas) return;
    const fetchMapel = async () => {
      try {
        const res = await fetch(`/api/penilaian/data?kelas_id=${selectedKelas}`);
        const json = await res.json();
        if (json.success) {
          const mList = json.kurikulum || [];
          setKurikulumList(mList);
          if (!isCustomMapel) {
            if (mList.length > 0) {
              setSelectedMapel(mList[0].mata_pelajaran);
              setSelectedKitab(mList[0].kitab || '');
            } else {
              setSelectedMapel('');
              setSelectedKitab('');
            }
          }
        }
      } catch (err) {
        console.error('Failed to reload mapel list', err);
      }
    };
    fetchMapel();
  }, [selectedKelas]);

  // 2. Load Murid & Nilai saat Kelas / Mapel / Semester / Tahun berubah
  useEffect(() => {
    if (!selectedKelas) return;

    const fetchMuridDanNilai = async () => {
      setLoadingMurid(true);
      try {
        const query = new URLSearchParams({
          kelas_id: selectedKelas,
          mapel: selectedMapel,
          semester,
          tahun_ajaran: tahunAjaran,
        });
        const res = await fetch(`/api/penilaian/data?${query.toString()}`);
        const json = await res.json();
        if (json.success && json.muridList) {
          setMuridList(json.muridList);
          const initialScores: Record<number, any> = {};
          json.muridList.forEach((m: any) => {
            const h = m.nilai_harian !== null && m.nilai_harian !== undefined && m.nilai_harian !== '' ? String(m.nilai_harian) : '';
            const u = m.nilai_uts !== null && m.nilai_uts !== undefined && m.nilai_uts !== '' ? String(m.nilai_uts) : '';
            const a = m.nilai_uas !== null && m.nilai_uas !== undefined && m.nilai_uas !== '' ? String(m.nilai_uas) : '';
            let finalVal = m.nilai_akhir !== null && m.nilai_akhir !== undefined && m.nilai_akhir !== '' ? String(m.nilai_akhir) : '';
            let pred = m.predikat || '';

            // Jika belum ada nilai akhir tersimpan tetapi komponen terisi, hitung preview
            if (!finalVal && (h || u || a)) {
              const numH = parseFloat(h) || 0;
              const numU = parseFloat(u) || 0;
              const numA = parseFloat(a) || 0;
              const autoFinal = Math.round((numH * 0.3 + numU * 0.3 + numA * 0.4) * 100) / 100;
              finalVal = String(autoFinal);
              pred = calcPredikat(autoFinal);
            }

            initialScores[m.murid_id] = {
              harian: h,
              uts: u,
              uas: a,
              akhir: finalVal,
              predikat: pred,
              catatan: m.catatan || '',
            };
          });
          setScores(initialScores);

          // Sinkronkan murid pertama untuk raport jika belum ada murid yang dipilih atau berpindah kelas
          if (json.muridList.length > 0) {
            setSelectedMuridId(String(json.muridList[0].murid_id));
          } else {
            setSelectedMuridId('');
            setRaportData(null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch murid dan nilai', err);
      } finally {
        setLoadingMurid(false);
      }
    };

    fetchMuridDanNilai();
  }, [selectedKelas, selectedMapel, semester, tahunAjaran]);

  // 3. Load Raport Detail Santri
  const fetchRaportDetail = async (mId: string) => {
    if (!mId) return;
    setLoadingRaport(true);
    try {
      const query = new URLSearchParams({
        murid_id: mId,
        semester,
        tahun_ajaran: tahunAjaran,
      });
      const res = await fetch(`/api/penilaian/raport?${query.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setRaportData(json.data);
        if (json.data.catatan) {
          setEditCatatan({
            catatan_wali_kelas: json.data.catatan.catatan_wali_kelas || '',
            akhlak: json.data.catatan.akhlak || 'Baik',
            kerajinan: json.data.catatan.kerajinan || 'Baik',
            kebersihan: json.data.catatan.kebersihan || 'Baik',
            tahfidz_hafalan: json.data.catatan.tahfidz_hafalan || '',
            status_kelulusan: json.data.catatan.status_kelulusan || 'Naik Kelas',
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch raport', err);
    } finally {
      setLoadingRaport(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'raport' && selectedMuridId) {
      fetchRaportDetail(selectedMuridId);
    }
  }, [activeTab, selectedMuridId, semester, tahunAjaran]);

  // Handle Score Input dengan otomatisasi sekaligus fleksibilitas manual override
  const handleScoreChange = (muridId: number, field: 'harian' | 'uts' | 'uas' | 'akhir' | 'predikat' | 'catatan', val: string) => {
    setScores(prev => {
      const existing = prev[muridId] || { harian: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
      const updated = { ...existing, [field]: val };

      // Jika yang diubah adalah komponen Harian, UTS, atau UAS, hitung otomatis nilai akhir & predikat jika belum dioverride manual
      if (field === 'harian' || field === 'uts' || field === 'uas') {
        const h = field === 'harian' ? val : existing.harian;
        const u = field === 'uts' ? val : existing.uts;
        const a = field === 'uas' ? val : existing.uas;

        if (h !== '' || u !== '' || a !== '') {
          const numH = parseFloat(h) || 0;
          const numU = parseFloat(u) || 0;
          const numA = parseFloat(a) || 0;
          const autoFinal = Math.round((numH * 0.3 + numU * 0.3 + numA * 0.4) * 100) / 100;
          updated.akhir = String(autoFinal);
          updated.predikat = calcPredikat(autoFinal);
        } else {
          updated.akhir = '';
          updated.predikat = '';
        }
      }

      // Jika yang diubah langsung adalah nilai akhir secara manual, otomatis sesuaikan predikatnya
      if (field === 'akhir') {
        const numAkhir = parseFloat(val);
        if (!isNaN(numAkhir)) {
          updated.predikat = calcPredikat(numAkhir);
        }
      }

      return {
        ...prev,
        [muridId]: updated,
      };
    });
  };

  // Simpan Nilai Masal
  const handleSaveScores = async () => {
    setSavingScores(true);
    setSaveSuccessMsg('');
    try {
      const payloadScores = muridList.map(m => {
        const s = scores[m.murid_id] || { harian: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };
        return {
          murid_id: m.murid_id,
          nilai_harian: s.harian !== '' ? s.harian : null,
          nilai_uts: s.uts !== '' ? s.uts : null,
          nilai_uas: s.uas !== '' ? s.uas : null,
          nilai_akhir: s.akhir !== '' ? s.akhir : null,
          predikat: s.predikat || null,
          catatan: s.catatan || '',
        };
      });

      const res = await fetch('/api/penilaian/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kelas_id: selectedKelas,
          mata_pelajaran: selectedMapel,
          kitab: selectedKitab,
          semester,
          tahun_ajaran: tahunAjaran,
          scores: payloadScores,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSaveSuccessMsg(json.message || 'Nilai berhasil disimpan!');
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      } else {
        alert(json.error || 'Gagal menyimpan nilai');
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi saat menyimpan.');
    } finally {
      setSavingScores(false);
    }
  };

  // Simpan Catatan Raport
  const handleSaveRaportCatatan = async () => {
    if (!selectedMuridId) return;
    setSavingRaportCatatan(true);
    try {
      const res = await fetch('/api/penilaian/raport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          murid_id: selectedMuridId,
          semester,
          tahun_ajaran: tahunAjaran,
          ...editCatatan,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert('Catatan & kepribadian raport berhasil disimpan!');
        fetchRaportDetail(selectedMuridId);
      } else {
        alert(json.error || 'Gagal menyimpan catatan raport');
      }
    } catch (err) {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setSavingRaportCatatan(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 print:p-0 print:m-0 print:max-w-none">
      {/* Header Utama (Hidden saat print) */}
      <div className="print:hidden bg-gradient-to-br from-amber-800 via-amber-900 to-yellow-950 text-white rounded-3xl p-6 sm:p-8 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 text-center md:text-left">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-bold uppercase tracking-wider mb-2">
              <Award size={14} /> Akademik &amp; Evaluasi Santri
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center md:justify-start gap-3">
              Penilaian &amp; Raport Digital
            </h1>
            <p className="text-amber-100/80 text-xs sm:text-sm mt-1 max-w-xl mx-auto md:mx-0">
              Pusat input nilai harian, UTS, UAS, otomatisasi rekap presensi &amp; kedisiplinan, serta cetak lembar raport resmi santri.
            </p>
          </div>

          {/* Switcher Tab Symmetris & Rata Tengah Presisi di HP */}
          <div className="w-full sm:w-auto max-w-md mx-auto md:mx-0 grid grid-cols-2 gap-2 bg-black/35 p-1.5 rounded-2xl backdrop-blur-md border border-white/10 shrink-0">
            <button
              onClick={() => setActiveTab('input')}
              className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all w-full text-center ${
                activeTab === 'input'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-amber-200/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <ClipboardCheck size={16} />
              <span>Input &amp; Leger Nilai</span>
            </button>
            <button
              onClick={() => setActiveTab('raport')}
              className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all w-full text-center ${
                activeTab === 'raport'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-amber-200/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <GraduationCap size={16} />
              <span>Raport Santri</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: INPUT NILAI & LEGER KELAS                                          */}
      {/* ========================================================================= */}
      {activeTab === 'input' && (
        <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
          {/* Baris Filter & Pemilihan Mapel */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            <div className="flex flex-col items-center justify-center text-center gap-1.5 pb-0.5">
              <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <Filter size={14} className="text-amber-600 dark:text-amber-400" /> Filter Kelas &amp; Mata Pelajaran
              </div>
              <button
                type="button"
                onClick={handleToggleCustomMapel}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-3.5 py-1.5 rounded-full border border-amber-200/70 dark:border-amber-800/50 transition-all shadow-xs"
              >
                <Edit3 size={13} />
                <span>{isCustomMapel ? 'Kembali ke Pilihan Kurikulum' : 'Ketik Mapel Khusus'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Pilih Kelas Madin */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Kelas Madin
                </label>
                <select
                  value={selectedKelas}
                  onChange={(e) => setSelectedKelas(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                >
                  {kelasList.length === 0 ? (
                    <option value="">(Memuat kelas...)</option>
                  ) : (
                    kelasList.map(k => (
                      <option key={k.kelas_id} value={k.kelas_id}>
                        {k.nama_kelas}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Pilih Mata Pelajaran / Kitab */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Mata Pelajaran {selectedKitab ? `(${selectedKitab})` : ''}
                </label>
                {isCustomMapel ? (
                  <div className="space-y-1.5">
                    <input
                      ref={customMapelInputRef}
                      type="text"
                      value={selectedMapel}
                      onChange={(e) => setSelectedMapel(e.target.value)}
                      placeholder="Nama Pelajaran / Fan (misal: Imla')"
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-amber-300 dark:border-amber-600 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                    />
                    <input
                      type="text"
                      value={selectedKitab}
                      onChange={(e) => setSelectedKitab(e.target.value)}
                      placeholder="Nama Kitab / Rujukan (Opsional)"
                      className="w-full px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                    />
                  </div>
                ) : (
                  <select
                    value={selectedMapel}
                    onChange={(e) => {
                      setSelectedMapel(e.target.value);
                      const found = kurikulumList.find(k => k.mata_pelajaran === e.target.value);
                      if (found) setSelectedKitab(found.kitab || '');
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                  >
                    {kurikulumList.length === 0 ? (
                      <option value="">(Memuat kurikulum...)</option>
                    ) : (
                      kurikulumList.map(k => (
                        <option key={k.id || k.mata_pelajaran} value={k.mata_pelajaran}>
                          {k.mata_pelajaran} {k.kitab ? `— ${k.kitab}` : ''}
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>

              {/* Semester */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Semester
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                >
                  <option value="1">Semester 1 (Ganjil)</option>
                  <option value="2">Semester 2 (Genap)</option>
                </select>
              </div>

              {/* Tahun Ajaran */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Tahun Ajaran
                </label>
                <select
                  value={tahunAjaran}
                  onChange={(e) => setTahunAjaran(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                >
                  <option value="2024/2025">2024/2025</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026/2027">2026/2027</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notifikasi Sukses Simpan */}
          {saveSuccessMsg && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-sm font-bold shadow-xs animate-[fadeIn_0.2s_ease-out]">
              <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Petunjuk Penggunaan Singkat & Informatif */}
          <div className="bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl p-4 border border-amber-200/60 dark:border-amber-800/40 text-xs sm:text-sm text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <Sparkles size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Cara Menggunakan Halaman Penilaian:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-xs text-amber-800/90 dark:text-amber-300/90 pl-1 leading-relaxed">
              <li>Pilih <strong>Kelas Madin</strong> dan <strong>Mata Pelajaran</strong> pada filter di atas (daftar santri akan langsung muncul di tabel bawah).</li>
              <li>Ketik nilai pada kolom <strong>Harian (30%)</strong>, <strong>UTS (30%)</strong>, dan <strong>UAS (40%)</strong>. Nilai Akhir &amp; Predikat terhitung otomatis seketika, dan dapat diedit manual bila diperlukan.</li>
              <li>Klik tombol <strong>&quot;Simpan Semua Nilai&quot;</strong> di kanan atas tabel untuk menyimpan seluruh nilai santri sekelas sekaligus.</li>
              <li>Beralih ke tab <strong>&quot;Raport Santri&quot;</strong> untuk melihat atau mencetak lembar raport resmi yang telah terintegrasi dengan data presensi dan kedisiplinan santri.</li>
            </ol>
          </div>

          {/* Tabel Input Nilai Santri */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-center sm:text-left">
              <div className="w-full sm:w-auto">
                <h3 className="font-extrabold text-gray-800 dark:text-gray-100 text-base sm:text-lg flex flex-col sm:flex-row sm:items-center justify-center sm:justify-start gap-1 sm:gap-2">
                  <span>
                    {isLegerMode ? 'Daftar Santri — Semua Mata Pelajaran' : `Daftar Santri — ${selectedMapel || 'Mata Pelajaran'}`}
                  </span>
                  {selectedKitab && !isLegerMode && (
                    <span className="text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400 block sm:inline">
                      ({selectedKitab})
                    </span>
                  )}
                  {isLegerMode && (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 inline-flex items-center gap-1 mx-auto sm:mx-0">
                      <Sparkles size={12} /> Leger Kolektif Kelas
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 sm:mt-0.5 max-w-xl mx-auto sm:mx-0">
                  {isLegerMode
                    ? 'Mode Leger Kolektif: Menampilkan rata-rata akumulasi nilai santri & presensi seluruh sesi dari semua mata pelajaran kelas ini.'
                    : 'Kalkulasi otomatis: Harian (30%) + UTS (30%) + UAS (40%). Nilai Akhir & Predikat fleksibel dapat diubah manual.'}
                </p>
              </div>

              {isLegerMode ? (
                <div className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-bold shadow-2xs">
                  <Sparkles size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Pilih mapel tertentu untuk input / edit nilai</span>
                </div>
              ) : (
                <button
                  onClick={handleSaveScores}
                  disabled={savingScores || muridList.length === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all shrink-0"
                >
                  {savingScores ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{savingScores ? 'Menyimpan...' : 'Simpan Semua Nilai'}</span>
                </button>
              )}
            </div>

            {loadingMurid ? (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                <RefreshCw size={28} className="animate-spin mx-auto text-amber-600 mb-2" />
                <p className="text-sm font-semibold">Memuat daftar santri dan nilai...</p>
              </div>
            ) : muridList.length === 0 ? (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                <AlertCircle size={28} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm font-semibold">Belum ada santri terdaftar di kelas ini.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-bold border-b border-gray-200 dark:border-gray-700 text-xs sm:text-sm">
                      <th className="py-3.5 px-3 w-10 text-center">No</th>
                      <th className="py-3.5 px-4 min-w-[170px]">Nama Santri</th>
                      <th className="py-3.5 px-3 w-24 text-center">NIS</th>
                      <th className="py-3.5 px-2.5 w-24 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <span>Kehadiran</span>
                          <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">
                            {isLegerMode ? '(Total Sesi)' : '(Presensi)'}
                          </span>
                        </div>
                      </th>
                      <th className="py-3.5 px-2 w-24 text-center">
                        {isLegerMode ? 'Harian (Rerata)' : 'Harian (30%)'}
                      </th>
                      <th className="py-3.5 px-2 w-24 text-center">
                        {isLegerMode ? 'UTS (Rerata)' : 'UTS (30%)'}
                      </th>
                      <th className="py-3.5 px-2 w-24 text-center">
                        {isLegerMode ? 'UAS (Rerata)' : 'UAS (40%)'}
                      </th>
                      <th className="py-3.5 px-2 w-28 text-center bg-amber-100/90 dark:bg-amber-950/70 text-amber-950 dark:text-amber-200 font-black border-l border-r border-amber-200 dark:border-amber-800/60">
                        {isLegerMode ? 'Nilai Akhir (Rerata)' : 'Nilai Akhir (Auto/Manual)'}
                      </th>
                      <th className="py-3.5 px-2 w-24 text-center bg-amber-100/90 dark:bg-amber-950/70 text-amber-950 dark:text-amber-200 font-black border-r border-amber-200 dark:border-amber-800/60">
                        {isLegerMode ? 'Predikat Umum' : 'Predikat'}
                      </th>
                      <th className="py-3.5 px-4 min-w-[160px]">
                        {isLegerMode ? 'Kelengkapan Nilai' : 'Catatan Perkembangan'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {muridList.map((m, idx) => {
                      const cur = scores[m.murid_id] || { harian: '', uts: '', uas: '', akhir: '', predikat: '', catatan: '' };

                      return (
                        <tr key={m.murid_id} className="hover:bg-amber-50/40 dark:hover:bg-gray-700/40 transition-colors">
                          <td className="py-3 px-3 text-center text-gray-500 font-semibold">{idx + 1}</td>
                          <td className="py-3 px-4 font-bold text-gray-800 dark:text-gray-100 min-w-[160px]">
                            {m.nama}
                            {(m.nama_kamar || m.nama_asrama) ? (
                              <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold leading-tight mt-0.5">
                                🛏 {[m.nama_kamar, m.nama_asrama].filter(Boolean).join(' — ')}
                              </span>
                            ) : null}
                            {m.alamat ? (
                              <span className="block text-[10px] text-gray-400 font-normal leading-tight">
                                📍 {m.alamat}
                              </span>
                            ) : null}
                            {!m.nama_kamar && !m.nama_asrama && !m.alamat && (
                              <span className="block text-[10px] text-gray-400 font-normal">
                                {m.jenis_kelamin === 'Perempuan' ? 'Santri Putri' : 'Santri Putra'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center text-gray-500 font-mono text-xs">{m.nis || '-'}</td>
                          
                          {/* KOLOM PROSENTASE KEHADIRAN OTOMATIS */}
                          <td className="py-3 px-2.5 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold shadow-2xs ${
                                (m.kehadiran_persen ?? 100) >= 85
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                  : (m.kehadiran_persen ?? 100) >= 70
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              }`}
                              title={m.kehadiran_total > 0 ? `${m.kehadiran_hadir} dari ${m.kehadiran_total} sesi hadir` : 'Presensi terekap otomatis'}
                            >
                              {m.kehadiran_persen !== undefined ? `${m.kehadiran_persen}%` : '100%'}
                            </span>
                          </td>

                          {isLegerMode ? (
                            <>
                              <td className="py-3 px-2 text-center font-semibold text-gray-700 dark:text-gray-300">
                                {cur.harian !== '' ? cur.harian : '-'}
                              </td>
                              <td className="py-3 px-2 text-center font-semibold text-gray-700 dark:text-gray-300">
                                {cur.uts !== '' ? cur.uts : '-'}
                              </td>
                              <td className="py-3 px-2 text-center font-semibold text-gray-700 dark:text-gray-300">
                                {cur.uas !== '' ? cur.uas : '-'}
                              </td>
                              <td className="py-2.5 px-2 text-center bg-amber-50/40 dark:bg-amber-950/20 border-l border-r border-amber-100 dark:border-amber-900/40">
                                <span className="inline-block px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/70 font-black text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
                                  {cur.akhir !== '' ? cur.akhir : '-'}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-center bg-amber-50/40 dark:bg-amber-950/20 border-r border-amber-100 dark:border-amber-900/40">
                                <span className="inline-block px-2.5 py-0.5 rounded-full font-bold text-xs bg-white dark:bg-gray-800 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-600 shadow-2xs">
                                  {cur.predikat || '-'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-400">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  (m.total_mapel_dinilai || 0) > 0
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                }`}>
                                  {m.catatan || 'Belum Ada Nilai'}
                                </span>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="any"
                                  value={cur.harian}
                                  onChange={(e) => handleScoreChange(m.murid_id, 'harian', e.target.value)}
                                  placeholder="0"
                                  className="w-18 sm:w-20 text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="any"
                                  value={cur.uts}
                                  onChange={(e) => handleScoreChange(m.murid_id, 'uts', e.target.value)}
                                  placeholder="0"
                                  className="w-18 sm:w-20 text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="any"
                                  value={cur.uas}
                                  onChange={(e) => handleScoreChange(m.murid_id, 'uas', e.target.value)}
                                  placeholder="0"
                                  className="w-18 sm:w-20 text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                                />
                              </td>
                              {/* NILAI AKHIR (DAPAT DIUBAH MANUAL OLEH PENGGUNA/GURU) */}
                              <td className="py-2 px-2 text-center bg-amber-50/40 dark:bg-amber-950/20 border-l border-r border-amber-100 dark:border-amber-900/40">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="any"
                                  value={cur.akhir}
                                  onChange={(e) => handleScoreChange(m.murid_id, 'akhir', e.target.value)}
                                  placeholder="0"
                                  className="w-20 text-center py-1.5 px-2 bg-white dark:bg-gray-900 rounded-lg border-2 border-amber-400 dark:border-amber-500 font-black text-amber-900 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                                  title="Nilai Akhir: Terhitung otomatis, dapat diedit langsung jika ingin override manual"
                                />
                              </td>
                              {/* PREDIKAT (DAPAT DIUBAH MANUAL OLEH PENGGUNA/GURU) */}
                              <td className="py-2 px-2 text-center bg-amber-50/40 dark:bg-amber-950/20 border-r border-amber-100 dark:border-amber-900/40">
                                <select
                                  value={cur.predikat}
                                  onChange={(e) => handleScoreChange(m.murid_id, 'predikat', e.target.value)}
                                  className="w-16 text-center py-1.5 px-1 bg-white dark:bg-gray-900 rounded-lg border border-amber-400 dark:border-amber-500 font-black text-xs text-amber-900 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                                >
                                  <option value="">-</option>
                                  <option value="A">A</option>
                                  <option value="B">B</option>
                                  <option value="C">C</option>
                                  <option value="D">D</option>
                                  <option value="E">E</option>
                                </select>
                              </td>
                              <td className="py-2 px-4">
                                <input
                                  type="text"
                                  value={cur.catatan}
                                  onChange={(e) => handleScoreChange(m.murid_id, 'catatan', e.target.value)}
                                  placeholder="Catatan kemajuan..."
                                  className="w-full py-1.5 px-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RAPORT SANTRI & CETAK RESMI                                        */}
      {/* ========================================================================= */}
      {activeTab === 'raport' && (
        <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
          {/* Header Kontrol Raport: Format Presisi HP (Pilih Santri di Atas Full-Width, Kelas & Semester Berdampingan 50%-50%, Tombol Print Rata Tengah) */}
          <div className="print:hidden bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            <div className="flex flex-col gap-3 w-full">
              {/* Baris 1: Filter Pilih Santri Memenuhi Ruang Kanan dan Kiri */}
              <div className="w-full">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Pilih Santri
                </label>
                <select
                  value={selectedMuridId}
                  onChange={(e) => {
                    setSelectedMuridId(e.target.value);
                    fetchRaportDetail(e.target.value);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                >
                  {muridList.length === 0 ? (
                    <option value="">(Belum ada data santri)</option>
                  ) : (
                    muridList.map(m => (
                      <option key={m.murid_id} value={m.murid_id}>
                        {m.nama} {m.nis ? `(${m.nis})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Baris 2: Filter Pilih Kelas dan Pilih Semester Berdampingan Rata Tengah dengan Ukuran Presisi Sama */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Pilih Kelas
                  </label>
                  <select
                    value={selectedKelas}
                    onChange={(e) => {
                      setSelectedKelas(e.target.value);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                  >
                    {kelasList.map(k => (
                      <option key={k.kelas_id} value={k.kelas_id}>{k.nama_kelas}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Pilih Semester
                  </label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                  >
                    <option value="1">Semester 1 (Ganjil)</option>
                    <option value="2">Semester 2 (Genap)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tombol Cetak / Download PDF: Rata Tengah Rapi */}
            <div className="flex justify-center w-full pt-1">
              <button
                onClick={handlePrint}
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Printer size={16} />
                <span>Cetak / Download PDF</span>
              </button>
            </div>
          </div>

          {loadingRaport ? (
            <div className="p-16 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
              <RefreshCw size={32} className="animate-spin mx-auto text-amber-600 mb-3" />
              <p className="font-bold">Menyiapkan Lembar Raport Santri...</p>
              <p className="text-xs text-gray-400 mt-1">Menyinkronkan nilai, rekap absensi, dan poin kedisiplinan</p>
            </div>
          ) : !raportData ? (
            <div className="p-16 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
              <AlertCircle size={32} className="mx-auto text-gray-400 mb-3" />
              <p className="font-bold">Silakan pilih santri untuk melihat raport.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* LEMBAR RAPORT RESMI (TAMPILAN CETAK A4) */}
              <div className="bg-white text-gray-900 rounded-3xl shadow-md border border-gray-200 p-8 sm:p-12 print:border-none print:shadow-none print:p-0 print:m-0 max-w-4xl mx-auto">
                {/* KOP RESMI PESANTREN */}
                <div className="border-b-4 border-double border-gray-900 pb-4 mb-6 text-center">
                  <h3 className="text-xl sm:text-2xl font-black tracking-wider uppercase font-serif">
                    PONDOK PESANTREN MATHOLI'UL ANWAR
                  </h3>
                  <h4 className="text-base sm:text-lg font-bold uppercase text-emerald-800 font-serif">
                    MADRASAH DINIYAH &amp; LEMBAGA TAHFIDZ AL-QUR'AN
                  </h4>
                  <p className="text-xs text-gray-600 mt-1 font-sans">
                    Sugio - Lamongan - Jawa Timur | Website: ppmawar.or.id
                  </p>
                  <div className="mt-3 inline-block bg-gray-900 text-white font-bold text-xs sm:text-sm px-6 py-1 rounded-full uppercase tracking-widest">
                    LAPORAN HASIL BELAJAR SANTRI (RAPORT)
                  </div>
                </div>

                {/* IDENTITAS SANTRI */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs sm:text-sm mb-6 bg-gray-50 print:bg-transparent p-4 rounded-2xl border border-gray-200/60 print:border-none print:p-0">
                  <div className="space-y-1.5">
                    <div className="flex">
                      <span className="w-32 font-bold text-gray-600">Nama Santri</span>
                      <span className="font-black text-gray-900">: {raportData.santri.nama}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 font-bold text-gray-600">Nomor Induk (NIS)</span>
                      <span>: {raportData.santri.nis || '-'}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 font-bold text-gray-600">Kelas Madin</span>
                      <span>: {raportData.santri.nama_kelas_madin}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex">
                      <span className="w-32 font-bold text-gray-600">Semester / TA</span>
                      <span className="font-bold">: {raportData.semester === '1' ? '1 (Ganjil)' : '2 (Genap)'} / {raportData.tahun_ajaran}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 font-bold text-gray-600">Kamar / Asrama</span>
                      <span>: {raportData.santri.nama_kamar} ({raportData.santri.nama_asrama})</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 font-bold text-gray-600">Wali Kelas</span>
                      <span>: {raportData.santri.wali_kelas || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* TABEL A: HASIL BELAJAR / NILAI AKADEMIK */}
                <div className="mb-6">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">
                    <BookOpen size={14} /> A. Nilai Hasil Belajar (Madrasah Diniyah)
                  </h5>
                  <div className="border border-gray-300 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-300 font-bold text-gray-800">
                          <th className="py-2.5 px-3 w-10 text-center border-r border-gray-300">No</th>
                          <th className="py-2.5 px-3 border-r border-gray-300">Mata Pelajaran</th>
                          <th className="py-2.5 px-3 border-r border-gray-300">Kitab yang Dipelajari</th>
                          <th className="py-2.5 px-2 w-16 text-center border-r border-gray-300">KKM</th>
                          <th className="py-2.5 px-2 w-16 text-center border-r border-gray-300">Nilai</th>
                          <th className="py-2.5 px-2 w-16 text-center border-r border-gray-300">Predikat</th>
                          <th className="py-2.5 px-3">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {raportData.nilai.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-4 text-center text-gray-500 italic">
                              Belum ada nilai yang diinput untuk santri ini pada semester ini.
                            </td>
                          </tr>
                        ) : (
                          raportData.nilai.map((n: any, idx: number) => (
                            <tr key={n.id} className="hover:bg-gray-50">
                              <td className="py-2 px-3 text-center border-r border-gray-200">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold border-r border-gray-200">{n.mata_pelajaran}</td>
                              <td className="py-2 px-3 italic text-gray-700 border-r border-gray-200">{n.kitab || '-'}</td>
                              <td className="py-2 px-2 text-center border-r border-gray-200">70</td>
                              <td className="py-2 px-2 text-center font-bold text-gray-900 border-r border-gray-200">{n.nilai_akhir}</td>
                              <td className="py-2 px-2 text-center font-black border-r border-gray-200">{n.predikat}</td>
                              <td className="py-2 px-3 text-gray-600">
                                {Number(n.nilai_akhir) >= 70 ? 'Tuntas' : 'Perlu Bimbingan'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {raportData.nilai.length > 0 && (
                        <tfoot>
                          <tr className="bg-gray-100 font-bold border-t border-gray-300">
                            <td colSpan={4} className="py-2.5 px-3 text-right border-r border-gray-300 uppercase">
                              Nilai Rata-Rata Akhir:
                            </td>
                            <td className="py-2.5 px-2 text-center font-black text-emerald-800 border-r border-gray-300">
                              {raportData.ringkasan_nilai.rata_rata}
                            </td>
                            <td colSpan={2} className="py-2.5 px-3 text-xs text-gray-600">
                              Dari total {raportData.ringkasan_nilai.total_mapel} mata pelajaran
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* SINKRONISASI 1: TABEL B & C (PRESENSI & KEDISIPLINAN OTOMATIS) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {/* TABEL B: REKAPITULASI PRESENSI */}
                  <div>
                    <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">
                      <ClipboardCheck size={14} className="text-blue-600" /> B. Rekapitulasi Presensi (Otomatis)
                    </h5>
                    <div className="border border-gray-300 rounded-xl overflow-hidden text-xs">
                      <table className="w-full">
                        <tbody className="divide-y divide-gray-200">
                          <tr>
                            <td className="py-2 px-3 font-semibold bg-gray-50 border-r border-gray-200">Hadir</td>
                            <td className="py-2 px-3 font-bold text-emerald-700">{raportData.rekap_absensi.hadir} kali</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold bg-gray-50 border-r border-gray-200">Izin</td>
                            <td className="py-2 px-3 font-bold text-amber-700">{raportData.rekap_absensi.izin} kali</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold bg-gray-50 border-r border-gray-200">Sakit</td>
                            <td className="py-2 px-3 font-bold text-blue-700">{raportData.rekap_absensi.sakit} kali</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold bg-gray-50 border-r border-gray-200">Alpha / Tanpa Keterangan</td>
                            <td className="py-2 px-3 font-bold text-rose-700">{raportData.rekap_absensi.alpha} kali</td>
                          </tr>
                          <tr className="bg-gray-100 font-bold">
                            <td className="py-2 px-3 border-r border-gray-200">Persentase Kehadiran</td>
                            <td className="py-2 px-3 font-black text-gray-900">{raportData.rekap_absensi.persentase}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* TABEL C: CATATAN KEDISIPLINAN */}
                  <div>
                    <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-600" /> C. Kedisiplinan &amp; Ketertiban (Otomatis)
                    </h5>
                    <div className="border border-gray-300 rounded-xl overflow-hidden text-xs">
                      <table className="w-full">
                        <tbody className="divide-y divide-gray-200">
                          <tr>
                            <td className="py-2 px-3 font-semibold bg-gray-50 border-r border-gray-200">Total Poin Pelanggaran</td>
                            <td className="py-2 px-3 font-bold text-gray-900">{raportData.rekap_kedisiplinan.total_poin} Poin</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold bg-gray-50 border-r border-gray-200">Predikat Kedisiplinan</td>
                            <td className="py-2 px-3 font-black text-emerald-800">{raportData.rekap_kedisiplinan.predikat}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold bg-gray-50 border-r border-gray-200">Catatan Pelanggaran</td>
                            <td className="py-2 px-3 text-gray-600 italic">
                              {raportData.rekap_kedisiplinan.riwayat.length === 0
                                ? 'Tidak ada catatan pelanggaran (Disiplin baik).'
                                : `${raportData.rekap_kedisiplinan.riwayat[0].jenis} (${raportData.rekap_kedisiplinan.riwayat[0].deskripsi || '-'})`}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold bg-gray-50 border-r border-gray-200">Capaian Tahfidz</td>
                            <td className="py-2 px-3 font-bold text-gray-800">{editCatatan.tahfidz_hafalan || '-'}</td>
                          </tr>
                          <tr className="bg-gray-100 font-bold">
                            <td className="py-2 px-3 border-r border-gray-200">Keputusan Akhir</td>
                            <td className="py-2 px-3 font-black text-emerald-800">{editCatatan.status_kelulusan}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* CATATAN WALI KELAS */}
                <div className="border border-gray-300 rounded-xl p-4 mb-8 bg-gray-50 print:bg-transparent">
                  <h6 className="font-bold text-xs uppercase text-gray-700 mb-1">Catatan Wali Kelas:</h6>
                  <p className="text-xs text-gray-800 italic leading-relaxed">
                    "{editCatatan.catatan_wali_kelas || 'Tingkatkan terus prestasi belajar dan ketaatan ibadah.'}"
                  </p>
                </div>

                {/* KOLOM TANDA TANGAN RESMI */}
                <div className="grid grid-cols-3 gap-4 text-center text-xs mt-10 pt-4">
                  <div>
                    <p className="text-gray-500 mb-16">Mengetahui,<br /><strong>Orang Tua / Wali Santri</strong></p>
                    <p className="font-bold border-t border-gray-400 mx-4 pt-1">( ........................................ )</p>
                  </div>

                  <div>
                    <p className="text-gray-500 mb-16">Lamongan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br /><strong>Wali Kelas</strong></p>
                    <p className="font-bold border-t border-gray-400 mx-4 pt-1">{raportData.santri.wali_kelas || '( ........................................ )'}</p>
                  </div>

                  <div>
                    <p className="text-gray-500 mb-16">Kepala Madrasah Diniyah<br /><strong>PP. Matholi'ul Anwar</strong></p>
                    <p className="font-bold border-t border-gray-400 mx-4 pt-1">KH. Ahmad Taufiq, M.Pd.I</p>
                  </div>
                </div>
              </div>

              {/* FORM PENGISIAN CATATAN WALI KELAS & KEPRIBADIAN (Print-hidden) */}
              <div className="print:hidden bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                  <h4 className="font-extrabold text-sm sm:text-base text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <Sparkles size={18} className="text-amber-500" /> Pengaturan Catatan &amp; Kepribadian Raport
                  </h4>
                  <button
                    onClick={handleSaveRaportCatatan}
                    disabled={savingRaportCatatan}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all"
                  >
                    {savingRaportCatatan ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>{savingRaportCatatan ? 'Menyimpan...' : 'Simpan Catatan'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Capaian Tahfidz / Hafalan
                    </label>
                    <input
                      type="text"
                      value={editCatatan.tahfidz_hafalan}
                      onChange={(e) => setEditCatatan({ ...editCatatan, tahfidz_hafalan: e.target.value })}
                      placeholder="Contoh: Juz 30 (Al-A'la - An-Nas)"
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-800 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Keputusan Kenaikan / Kelulusan
                    </label>
                    <select
                      value={editCatatan.status_kelulusan}
                      onChange={(e) => setEditCatatan({ ...editCatatan, status_kelulusan: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-800 dark:text-gray-100"
                    >
                      <option value="Naik Kelas">Naik Kelas</option>
                      <option value="Tinggal di Kelas">Tinggal di Kelas</option>
                      <option value="Lulus">Lulus</option>
                      <option value="Lanjut ke Semester Berikutnya">Lanjut ke Semester Berikutnya</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Predikat Akhlak Santri
                    </label>
                    <select
                      value={editCatatan.akhlak}
                      onChange={(e) => setEditCatatan({ ...editCatatan, akhlak: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-800 dark:text-gray-100"
                    >
                      <option value="Sangat Baik">Sangat Baik</option>
                      <option value="Baik">Baik</option>
                      <option value="Cukup">Cukup</option>
                      <option value="Perlu Pembinaan">Perlu Pembinaan</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Catatan Wali Kelas untuk Santri &amp; Orang Tua
                  </label>
                  <textarea
                    rows={2}
                    value={editCatatan.catatan_wali_kelas}
                    onChange={(e) => setEditCatatan({ ...editCatatan, catatan_wali_kelas: e.target.value })}
                    placeholder="Tuliskan motivasi, saran, dan evaluasi untuk santri..."
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
