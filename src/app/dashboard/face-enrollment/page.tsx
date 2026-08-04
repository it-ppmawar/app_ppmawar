'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Brain, ScanFace, Users, CheckCircle2, AlertCircle, RefreshCw,
  Loader2, Play, Pause, ChevronRight, Sparkles, ImageOff,
  TrendingUp, Filter, Search, Camera
} from 'lucide-react';

// =====================================================
// TYPES
// =====================================================
interface MuridEnrollStatus {
  murid_id: number;
  nama: string;
  nis: string;
  jenis_kelamin: string;
  foto: string | null;
  kelas_madin: string | null;
  enrolled: boolean;
  descriptor_updated_at: string | null;
}

interface EnrollStats {
  total: number;
  enrolled: number;
  unenrolled: number;
  percent: number;
}

// =====================================================
// FACE-API DYNAMIC LOADER
// =====================================================
let faceApiCache: any = null;
let modelsLoadedCache = false;

async function loadFaceApi() {
  if (faceApiCache && modelsLoadedCache) return faceApiCache;
  const faceapi = await import('@vladmandic/face-api');
  faceApiCache = faceapi;
  const MODEL_URL = '/models';
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoadedCache = true;
  return faceapi;
}

function getFotoUrl(fotoName: string | null, nis?: string | null): string {
  if (!fotoName || fotoName === '-' || fotoName.trim() === '') {
    if (nis) return `/api/kartu-image/${nis}`;
    return '';
  }
  if (fotoName.startsWith('/api/')) {
    return fotoName;
  }
  if (fotoName.startsWith('foto_') || fotoName.startsWith('upload_') || fotoName.startsWith('profil_')) {
    return `/uploads/${fotoName}`;
  }

  let fullUrl = fotoName;
  if (!fotoName.startsWith('http://') && !fotoName.startsWith('https://')) {
    const cleanFotoName = fotoName.startsWith('/') ? fotoName.substring(1) : fotoName;
    if (cleanFotoName.includes('sekretariat/berkas')) {
      fullUrl = `https://mawar.smartpesantren.id/${cleanFotoName}`;
    } else {
      fullUrl = `https://mawar.smartpesantren.id/sekretariat/berkas/${cleanFotoName}`;
    }
  }

  // Bungkus dengan proxy-image API agar tidak terblokir CORS browser
  return `/api/proxy-image?url=${encodeURIComponent(fullUrl)}`;
}

async function computeDescriptorFromUrl(faceapi: any, imageUrl: string): Promise<number[] | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const detection = await faceapi
          .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          resolve(Array.from(detection.descriptor) as number[]);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}

// =====================================================
// COMPONENT
// =====================================================
export default function FaceEnrollmentPage() {
  const [list, setList] = useState<MuridEnrollStatus[]>([]);
  const [stats, setStats] = useState<EnrollStats>({ total: 0, enrolled: 0, unenrolled: 0, percent: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'enrolled' | 'unenrolled'>('all');
  const [genderFilter, setGenderFilter] = useState<'' | 'Laki-laki' | 'Perempuan'>('');

  // Batch enrollment
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchPaused, setBatchPaused] = useState(false);
  const [batchIdx, setBatchIdx] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchResults, setBatchResults] = useState({ success: 0, failed: 0, noFace: 0 });
  const [batchLog, setBatchLog] = useState<string[]>([]);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  const pausedRef = useRef(false);
  const stopRef = useRef(false);
  const faceApiRef = useRef<any>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch enrollment status ──────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/murid/face-enrollment-status');
      const data = await res.json();
      if (data.success) {
        setList(data.data);
        const enrolled = data.data.filter((d: MuridEnrollStatus) => d.enrolled).length;
        const total = data.data.length;
        setStats({
          total,
          enrolled,
          unenrolled: total - enrolled,
          percent: total > 0 ? Math.round((enrolled / total) * 100) : 0
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [batchLog]);

  // ── Load Models ──────────────────────────────────────────────────
  const handleLoadModels = async () => {
    setModelsLoading(true);
    try {
      const faceapi = await loadFaceApi();
      faceApiRef.current = faceapi;
      setModelsReady(true);
      setBatchLog(prev => [...prev, '✅ Model AI berhasil dimuat (SSD MobileNet + Face Recognition)']);
    } catch (e: any) {
      setBatchLog(prev => [...prev, '❌ Gagal memuat model: ' + e.message]);
    } finally {
      setModelsLoading(false);
    }
  };

  // ── Start Batch Enrollment ───────────────────────────────────────
  const startBatch = async () => {
    if (!faceApiRef.current) {
      setModelsLoading(true);
      setBatchLog(prev => [...prev, '⌛ Memuat model AI Face Recognition...']);
      try {
        const faceapi = await loadFaceApi();
        faceApiRef.current = faceapi;
        setModelsReady(true);
        setBatchLog(prev => [...prev, '✅ Model AI berhasil dimuat (SSD MobileNet + Face Recognition)']);
      } catch (e: any) {
        setBatchLog(prev => [...prev, '❌ Gagal memuat model AI: ' + e.message]);
        setModelsLoading(false);
        return;
      } finally {
        setModelsLoading(false);
      }
    }

    const targets = list.filter(m => !m.enrolled && m.foto);
    if (targets.length === 0) {
      setBatchLog(prev => [...prev, '✅ Semua santri yang memiliki foto sudah ter-enroll!']);
      return;
    }

    setBatchRunning(true);
    setBatchPaused(false);
    setBatchIdx(0);
    setBatchTotal(targets.length);
    setBatchResults({ success: 0, failed: 0, noFace: 0 });
    stopRef.current = false;
    pausedRef.current = false;

    setBatchLog(prev => [...prev, `🚀 Mulai batch enrollment: ${targets.length} santri belum ter-enroll`]);

    let successCount = 0;
    let failCount = 0;
    let noFaceCount = 0;

    for (let i = 0; i < targets.length; i++) {
      if (stopRef.current) {
        setBatchLog(prev => [...prev, `⏹ Dihentikan pada index ${i}`]);
        break;
      }

      // Wait if paused
      while (pausedRef.current) {
        await new Promise(r => setTimeout(r, 500));
      }

      const murid = targets[i];
      setBatchIdx(i + 1);

      const photoUrl = getFotoUrl(murid.foto, murid.nis);
      if (!photoUrl) {
        noFaceCount++;
        setBatchResults(prev => ({ ...prev, noFace: prev.noFace + 1 }));
        setBatchLog(prev => [...prev, `⚠️ [${i + 1}/${targets.length}] ${murid.nama} — Tanpa foto`]);
        continue;
      }

      try {
        const descriptor = await computeDescriptorFromUrl(faceApiRef.current, photoUrl);

        if (!descriptor) {
          noFaceCount++;
          setBatchResults(prev => ({ ...prev, noFace: prev.noFace + 1 }));
          setBatchLog(prev => [...prev, `⚠️ [${i + 1}/${targets.length}] ${murid.nama} — Wajah tidak terdeteksi`]);
          continue;
        }

        // Save to DB
        const saveRes = await fetch('/api/murid/face-descriptor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ murid_id: murid.murid_id, descriptor, foto_source: murid.foto })
        });
        const saveData = await saveRes.json();

        if (saveData.success) {
          successCount++;
          setBatchResults(prev => ({ ...prev, success: prev.success + 1 }));
          setBatchLog(prev => [...prev, `✅ [${i + 1}/${targets.length}] ${murid.nama} — Descriptor tersimpan`]);
          // Update list locally
          setList(prev => prev.map(m => m.murid_id === murid.murid_id ? { ...m, enrolled: true } : m));
        } else {
          failCount++;
          setBatchResults(prev => ({ ...prev, failed: prev.failed + 1 }));
          setBatchLog(prev => [...prev, `❌ [${i + 1}/${targets.length}] ${murid.nama} — Gagal simpan: ${saveData.error || '?'}`]);
        }
      } catch (err: any) {
        failCount++;
        setBatchResults(prev => ({ ...prev, failed: prev.failed + 1 }));
        setBatchLog(prev => [...prev, `❌ [${i + 1}/${targets.length}] ${murid.nama} — Error: ${err.message}`]);
      }

      // Small delay agar tidak overload
      await new Promise(r => setTimeout(r, 200));
    }

    setBatchRunning(false);
    setBatchLog(prev => [...prev,
      ``,
      `📊 SELESAI: ✅ ${successCount} berhasil | ⚠️ ${noFaceCount} wajah tidak terdeteksi | ❌ ${failCount} gagal`
    ]);
    fetchStatus();
  };

  const pauseBatch = () => {
    pausedRef.current = !pausedRef.current;
    setBatchPaused(pausedRef.current);
    setBatchLog(prev => [...prev, pausedRef.current ? '⏸ Dijeda...' : '▶ Dilanjutkan...']);
  };

  const stopBatch = () => {
    stopRef.current = true;
    pausedRef.current = false;
    setBatchPaused(false);
  };

  // ── Filtered list ────────────────────────────────────────────────
  const filtered = list.filter(m => {
    const matchQ = !searchQ || m.nama.toLowerCase().includes(searchQ.toLowerCase()) || m.nis.includes(searchQ);
    const matchFilter = filterMode === 'all' || (filterMode === 'enrolled' ? m.enrolled : !m.enrolled);
    const matchGender = !genderFilter || m.jenis_kelamin === genderFilter;
    return matchQ && matchFilter && matchGender;
  });

  // ── RENDER ───────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-[fadeIn_0.5s_ease-out]">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-br from-violet-700 via-indigo-700 to-blue-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -top-8 -right-8 opacity-10"><Brain size={160} /></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 p-2.5 rounded-xl"><ScanFace size={24} /></div>
            <div>
              <h1 className="text-xl font-extrabold">Face AI — Enrollment Dashboard</h1>
              <p className="text-violet-200 text-sm">Proses foto santri → simpan descriptor wajah ke database</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 bg-white/10 rounded-2xl p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold">{stats.enrolled} / {stats.total} santri ter-enroll</span>
              <span className="text-violet-200 text-sm font-bold">{stats.percent}%</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-700"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
            <div className="flex gap-4 mt-2 text-xs text-violet-200">
              <span>✅ {stats.enrolled} Enrolled</span>
              <span>⏳ {stats.unenrolled} Belum</span>
              <span>📷 {list.filter(m => !m.foto).length} Tanpa Foto</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── BATCH ENROLLMENT CONTROL ── */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-violet-500" />
          <h2 className="font-bold text-gray-800 dark:text-white">Batch Enrollment Otomatis</h2>
        </div>

        {/* Step 1: Load models */}
        <div className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${modelsReady ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'}`}>
          <div>
            <p className="font-bold text-sm text-gray-800 dark:text-white">
              {modelsReady ? '✅ Model AI Siap' : '1. Load Model AI'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              SSD MobileNet + Face Landmark + Face Recognition (~12MB, cached)
            </p>
          </div>
          {!modelsReady ? (
            <button
              onClick={handleLoadModels}
              disabled={modelsLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold transition disabled:opacity-50"
            >
              {modelsLoading ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
              {modelsLoading ? 'Loading...' : 'Load Model'}
            </button>
          ) : (
            <CheckCircle2 size={24} className="text-emerald-500 flex-shrink-0" />
          )}
        </div>

        {/* Step 2: Run batch */}
        <div className="flex gap-2">
          <button
            onClick={startBatch}
            disabled={batchRunning || !modelsReady}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold rounded-2xl transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {batchRunning
              ? <><Loader2 size={18} className="animate-spin" /> Proses berjalan...</>
              : <><Play size={18} /> Jalankan Batch Enrollment</>
            }
          </button>

          {batchRunning && (
            <>
              <button
                onClick={pauseBatch}
                className={`px-4 py-3 rounded-2xl font-bold text-sm transition flex items-center gap-1.5 ${batchPaused ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
              >
                {batchPaused ? <Play size={16} /> : <Pause size={16} />}
                {batchPaused ? 'Lanjut' : 'Jeda'}
              </button>
              <button
                onClick={stopBatch}
                className="px-4 py-3 rounded-2xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-1.5"
              >
                <Pause size={16} />
                Stop
              </button>
            </>
          )}
        </div>

        {/* Progress during batch */}
        {(batchRunning || batchTotal > 0) && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-gray-700 dark:text-gray-300">
                {batchRunning ? `Memproses ${batchIdx} / ${batchTotal}...` : `Selesai: ${batchIdx} / ${batchTotal}`}
              </span>
              <span className="text-violet-600 dark:text-violet-400">
                {batchTotal > 0 ? Math.round((batchIdx / batchTotal) * 100) : 0}%
              </span>
            </div>
            <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all"
                style={{ width: `${batchTotal > 0 ? (batchIdx / batchTotal) * 100 : 0}%` }}
              />
            </div>
            <div className="flex gap-4 text-xs text-gray-500">
              <span className="text-emerald-600 font-bold">✅ {batchResults.success} berhasil</span>
              <span className="text-amber-600 font-bold">⚠️ {batchResults.noFace} tanpa wajah</span>
              <span className="text-red-600 font-bold">❌ {batchResults.failed} gagal</span>
            </div>
          </div>
        )}

        {/* Log output */}
        {batchLog.length > 0 && (
          <div className="bg-gray-950 rounded-2xl p-3 max-h-52 overflow-y-auto font-mono text-xs space-y-0.5">
            {batchLog.map((line, i) => (
              <div key={i} className={`leading-relaxed ${
                line.startsWith('✅') ? 'text-emerald-400'
                : line.startsWith('❌') ? 'text-red-400'
                : line.startsWith('⚠️') ? 'text-amber-400'
                : line.startsWith('🚀') || line.startsWith('📊') ? 'text-violet-400 font-bold'
                : 'text-gray-400'
              }`}>{line || '\u00A0'}</div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>

      {/* ── SANTRI LIST ── */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-indigo-500" />
            <h2 className="font-bold text-gray-800 dark:text-white">Daftar Santri</h2>
            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold px-2 py-0.5 rounded-full">{filtered.length}</span>
          </div>
          <button onClick={fetchStatus} disabled={loading} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            <RefreshCw size={16} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-40">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama / NIS..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="w-full pl-8 pr-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:text-white"
            />
          </div>
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as any)}
            className="px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
          >
            <option value="all">Semua</option>
            <option value="enrolled">✅ Enrolled</option>
            <option value="unenrolled">⏳ Belum Enrolled</option>
          </select>
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value as any)}
            className="px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
          >
            <option value="">Semua Gender</option>
            <option value="Laki-laki">Putra</option>
            <option value="Perempuan">Putri</option>
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="text-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">Tidak ada data ditemukan.</div>
            ) : (
              filtered.map(m => (
                <div
                  key={m.murid_id}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                    m.enrolled
                      ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50'
                  }`}
                >
                  {/* Foto */}
                  <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ${m.enrolled ? 'ring-emerald-400' : 'ring-gray-300 dark:ring-gray-600'}`}>
                    {m.foto ? (
                      <img src={m.foto} alt={m.nama} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <ImageOff size={16} className="text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-800 dark:text-white truncate">{m.nama}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{m.nis} · {m.jenis_kelamin === 'Laki-laki' ? '🧑 Putra' : '👧 Putri'}</p>
                  </div>

                  {/* Status badge */}
                  {m.enrolled ? (
                    <div className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0">
                      <CheckCircle2 size={12} />
                      Enrolled
                    </div>
                  ) : m.foto ? (
                    <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0">
                      <AlertCircle size={12} />
                      Belum
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0">
                      <Camera size={12} />
                      Tanpa Foto
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
