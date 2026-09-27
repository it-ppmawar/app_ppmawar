'use client';

import { useState, useEffect } from 'react';
import {
  Award, BookOpen, GraduationCap, ClipboardCheck, Search, Filter,
  Save, Printer, CheckCircle, AlertCircle, RefreshCw, User, Calendar,
  ShieldCheck, AlertTriangle, FileText, ChevronRight, Sparkles, Download
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

  // State Tabel Input Nilai
  const [muridList, setMuridList] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<number, { harian: string; uts: string; uas: string; catatan: string }>>({});
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

  // Load Data Master Awal
  useEffect(() => {
    const fetchMaster = async () => {
      try {
        const res = await fetch('/api/penilaian/data');
        const json = await res.json();
        if (json.success) {
          setKelasList(json.kelas || []);
          setKurikulumList(json.kurikulum || []);
          if (json.kelas && json.kelas.length > 0) {
            setSelectedKelas(String(json.kelas[0].kelas_id));
          }
        }
      } catch (err) {
        console.error('Failed to load master penilaian', err);
      }
    };
    fetchMaster();
  }, []);

  // Update mapel pilihan saat kelas atau kurikulum berubah
  useEffect(() => {
    if (selectedKelas && kurikulumList.length > 0) {
      const currentKls = kelasList.find(k => String(k.kelas_id) === String(selectedKelas));
      const filtered = kurikulumList.filter(k => !currentKls || !k.tingkat || String(k.tingkat) === String(currentKls.tingkat));
      const firstMapel = filtered[0] || kurikulumList[0];
      if (firstMapel) {
        setSelectedMapel(firstMapel.mata_pelajaran);
        setSelectedKitab(firstMapel.kitab || '');
      }
    }
  }, [selectedKelas, kurikulumList, kelasList]);

  // Load Murid & Nilai saat filter berubah
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
            initialScores[m.murid_id] = {
              harian: m.nilai_harian !== null && m.nilai_harian !== undefined ? String(m.nilai_harian) : '',
              uts: m.nilai_uts !== null && m.nilai_uts !== undefined ? String(m.nilai_uts) : '',
              uas: m.nilai_uas !== null && m.nilai_uas !== undefined ? String(m.nilai_uas) : '',
              catatan: m.catatan || '',
            };
          });
          setScores(initialScores);

          if (!selectedMuridId && json.muridList.length > 0) {
            setSelectedMuridId(String(json.muridList[0].murid_id));
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

  // Load Raport Detail
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

  // Handle Score Input
  const handleScoreChange = (muridId: number, field: 'harian' | 'uts' | 'uas' | 'catatan', val: string) => {
    setScores(prev => ({
      ...prev,
      [muridId]: {
        ...(prev[muridId] || { harian: '', uts: '', uas: '', catatan: '' }),
        [field]: val,
      },
    }));
  };

  // Simpan Nilai Masal
  const handleSaveScores = async () => {
    setSavingScores(true);
    setSaveSuccessMsg('');
    try {
      const payloadScores = muridList.map(m => ({
        murid_id: m.murid_id,
        nilai_harian: scores[m.murid_id]?.harian || null,
        nilai_uts: scores[m.murid_id]?.uts || null,
        nilai_uas: scores[m.murid_id]?.uas || null,
        catatan: scores[m.murid_id]?.catatan || '',
      }));

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

  // Hitung Nilai Akhir & Predikat Preview
  const computeScorePreview = (h: string, u: string, a: string) => {
    const numH = parseFloat(h) || 0;
    const numU = parseFloat(u) || 0;
    const numA = parseFloat(a) || 0;
    if (!h && !u && !a) return { final: '-', predikat: '-' };
    const finalScore = Math.round((numH * 0.3 + numU * 0.3 + numA * 0.4) * 100) / 100;
    let predikat = 'E';
    if (finalScore >= 90) predikat = 'A';
    else if (finalScore >= 80) predikat = 'B';
    else if (finalScore >= 70) predikat = 'C';
    else if (finalScore >= 60) predikat = 'D';
    return { final: finalScore, predikat };
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 print:p-0 print:m-0 print:max-w-none">
      {/* Header Utama (Hidden when printing) */}
      <div className="print:hidden bg-gradient-to-br from-amber-800 via-amber-900 to-yellow-950 text-white rounded-3xl p-6 sm:p-8 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-bold uppercase tracking-wider mb-2">
              <Award size={14} /> Akademik &amp; Evaluasi Santri
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Penilaian &amp; Raport Digital
            </h1>
            <p className="text-amber-100/80 text-xs sm:text-sm mt-1 max-w-xl">
              Pusat input nilai harian, UTS, UAS, otomatisasi rekap presensi &amp; kedisiplinan, serta cetak lembar raport resmi santri.
            </p>
          </div>

          {/* Switcher Tab Antara Input Nilai vs Cetak Raport */}
          <div className="flex bg-black/30 p-1.5 rounded-2xl backdrop-blur-md border border-white/10 shrink-0 self-start md:self-auto">
            <button
              onClick={() => setActiveTab('input')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
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
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              <Filter size={14} /> Filter Kelas &amp; Mata Pelajaran
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
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {kelasList.map(k => (
                    <option key={k.kelas_id} value={k.kelas_id}>
                      {k.nama_kelas} (Tingkat {k.tingkat})
                    </option>
                  ))}
                </select>
              </div>

              {/* Pilih Mata Pelajaran / Kitab */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Mata Pelajaran (Kitab)
                </label>
                <select
                  value={selectedMapel}
                  onChange={(e) => {
                    setSelectedMapel(e.target.value);
                    const found = kurikulumList.find(k => k.mata_pelajaran === e.target.value);
                    if (found) setSelectedKitab(found.kitab || '');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {kurikulumList.map(k => (
                    <option key={k.id} value={k.mata_pelajaran}>
                      {k.mata_pelajaran} {k.kitab ? `— ${k.kitab}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Semester
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
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

          {/* Tabel Input Nilai Santri */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-gray-800 dark:text-gray-100 text-base">
                  Daftar Santri — {selectedMapel} ({selectedKitab || 'Mata Pelajaran'})
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Bobot penilaian: Harian (30%) + UTS (30%) + UAS (40%). Predikat dihitung otomatis.
                </p>
              </div>

              <button
                onClick={handleSaveScores}
                disabled={savingScores || muridList.length === 0}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all"
              >
                {savingScores ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{savingScores ? 'Menyimpan...' : 'Simpan Semua Nilai'}</span>
              </button>
            </div>

            {loadingMurid ? (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                <RefreshCw size={28} className="animate-spin mx-auto text-amber-600 mb-2" />
                <p className="text-sm font-semibold">Memuat daftar santri dan nilai...</p>
              </div>
            ) : muridList.length === 0 ? (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                <AlertCircle size={28} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm font-semibold">Belum ada data murid di kelas ini.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-750 text-gray-600 dark:text-gray-300 font-bold border-b border-gray-100 dark:border-gray-700">
                      <th className="py-3 px-4 w-12 text-center">No</th>
                      <th className="py-3 px-4 min-w-[180px]">Nama Santri</th>
                      <th className="py-3 px-4 w-28 text-center">NIS</th>
                      <th className="py-3 px-3 w-28 text-center">Harian (30%)</th>
                      <th className="py-3 px-3 w-28 text-center">UTS (30%)</th>
                      <th className="py-3 px-3 w-28 text-center">UAS (40%)</th>
                      <th className="py-3 px-3 w-28 text-center">Nilai Akhir</th>
                      <th className="py-3 px-3 w-24 text-center">Predikat</th>
                      <th className="py-3 px-4 min-w-[160px]">Catatan / Evaluasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {muridList.map((m, idx) => {
                      const cur = scores[m.murid_id] || { harian: '', uts: '', uas: '', catatan: '' };
                      const preview = computeScorePreview(cur.harian, cur.uts, cur.uas);

                      return (
                        <tr key={m.murid_id} className="hover:bg-amber-50/40 dark:hover:bg-gray-750/50 transition-colors">
                          <td className="py-3 px-4 text-center text-gray-500 font-semibold">{idx + 1}</td>
                          <td className="py-3 px-4 font-bold text-gray-800 dark:text-gray-100">
                            {m.nama}
                            <span className="block text-[10px] text-gray-400 font-normal">
                              {m.jenis_kelamin === 'Perempuan' ? 'Santri Putri' : 'Santri Putra'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-gray-500 font-mono text-xs">{m.nis || '-'}</td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={cur.harian}
                              onChange={(e) => handleScoreChange(m.murid_id, 'harian', e.target.value)}
                              placeholder="0"
                              className="w-20 text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 font-bold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={cur.uts}
                              onChange={(e) => handleScoreChange(m.murid_id, 'uts', e.target.value)}
                              placeholder="0"
                              className="w-20 text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 font-bold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={cur.uas}
                              onChange={(e) => handleScoreChange(m.murid_id, 'uas', e.target.value)}
                              placeholder="0"
                              className="w-20 text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 font-bold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </td>
                          <td className="py-3 px-3 text-center font-black text-amber-700 dark:text-amber-400">
                            {preview.final}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-block font-extrabold px-2.5 py-0.5 rounded-full text-xs ${
                              preview.predikat === 'A' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                              preview.predikat === 'B' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                              preview.predikat === 'C' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                              preview.predikat === 'D' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' :
                              'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {preview.predikat}
                            </span>
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="text"
                              value={cur.catatan}
                              onChange={(e) => handleScoreChange(m.murid_id, 'catatan', e.target.value)}
                              placeholder="Catatan kemajuan..."
                              className="w-full py-1.5 px-2.5 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </td>
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
          {/* Header Kontrol Raport (Hidden saat print) */}
          <div className="print:hidden bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Pilih Kelas
                </label>
                <select
                  value={selectedKelas}
                  onChange={(e) => setSelectedKelas(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs font-bold text-gray-800 dark:text-gray-100"
                >
                  {kelasList.map(k => (
                    <option key={k.kelas_id} value={k.kelas_id}>{k.nama_kelas}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Pilih Santri
                </label>
                <select
                  value={selectedMuridId}
                  onChange={(e) => {
                    setSelectedMuridId(e.target.value);
                    fetchRaportDetail(e.target.value);
                  }}
                  className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs font-bold text-gray-800 dark:text-gray-100 max-w-xs truncate"
                >
                  {muridList.map(m => (
                    <option key={m.murid_id} value={m.murid_id}>{m.nama} ({m.nis || '-'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Semester
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs font-bold text-gray-800 dark:text-gray-100"
                >
                  <option value="1">Semester 1</option>
                  <option value="2">Semester 2</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95"
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
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs sm:text-sm mb-6 bg-gray-50 print:bg-transparent p-4 rounded-2xl border border-gray-200/60 print:border-none print:p-0">
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
                      <span>: {raportData.santri.nama_kelas_madin} (Tingkat {raportData.santri.tingkat_madin})</span>
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
