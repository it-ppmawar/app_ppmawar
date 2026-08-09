'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Plus, Pencil, Trash2, Save, X, CheckCircle2, AlertCircle, Volume2, Globe, Hash } from 'lucide-react';

interface Format {
  id: number;
  nama: string;
  bahasa: 'id' | 'ar' | 'en';
  template: string;
  urutan: number;
  aktif: number;
}

const PLACEHOLDERS = [
  { key: '{nama}', desc: 'Nama panggilan santri' },
  { key: '{kamar}', desc: 'Nama kamar santri' },
  { key: '{asrama}', desc: 'Nama asrama' },
  { key: '{tujuan}', desc: 'Tujuan panggilan' },
  { key: '{teks}', desc: 'Teks bebas (untuk format bebas)' },
];

export default function FormatPanggilanPage() {
  const [formats, setFormats] = useState<Format[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form
  const [formNama, setFormNama] = useState('');
  const [formBahasa, setFormBahasa] = useState<'id' | 'ar' | 'en'>('id');
  const [formTemplate, setFormTemplate] = useState('');
  const [formUrutan, setFormUrutan] = useState(0);

  const fetchFormats = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/panggilan/format');
      const d = await r.json();
      if (d.success) setFormats(d.data);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { fetchFormats(); }, []);

  const resetForm = () => {
    setFormNama(''); setFormBahasa('id'); setFormTemplate(''); setFormUrutan(0);
    setEditingId(null); setShowForm(false);
  };

  const handleEdit = (f: Format) => {
    setFormNama(f.nama);
    setFormBahasa(f.bahasa);
    setFormTemplate(f.template);
    setFormUrutan(f.urutan);
    setEditingId(f.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formNama.trim() || !formTemplate.trim()) {
      setErrorMsg('Nama dan template wajib diisi');
      return;
    }
    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId
        ? { id: editingId, nama: formNama, bahasa: formBahasa, template: formTemplate, urutan: formUrutan, aktif: 1 }
        : { nama: formNama, bahasa: formBahasa, template: formTemplate, urutan: formUrutan };

      const r = await fetch('/api/panggilan/format', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.success) {
        setSuccessMsg(editingId ? 'Format diperbarui' : 'Format baru ditambahkan');
        resetForm();
        fetchFormats();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(d.error || 'Gagal menyimpan');
      }
    } catch (_) { setErrorMsg('Koneksi bermasalah'); }
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!confirm(`Hapus format "${nama}"?`)) return;
    try {
      const r = await fetch('/api/panggilan/format', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (d.success) {
        setSuccessMsg('Format dihapus');
        fetchFormats();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(d.error || 'Gagal menghapus');
      }
    } catch (_) { setErrorMsg('Koneksi bermasalah'); }
  };

  const handlePreview = (template: string, bahasa: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const preview = template
      .replace(/{nama}/g, 'Ahmad Fauzi')
      .replace(/{kamar}/g, 'Kamar Al-Ikhlas')
      .replace(/{asrama}/g, 'Asrama A')
      .replace(/{tujuan}/g, 'kantor pengurus')
      .replace(/{teks}/g, 'Harap segera hadir.');
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(preview);
    utter.lang = bahasa === 'ar' ? 'ar-SA' : bahasa === 'en' ? 'en-US' : 'id-ID';
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
  };

  const insertPlaceholder = (key: string) => {
    setFormTemplate(prev => prev + key);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-5 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full pointer-events-none" />
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2.5 rounded-xl">
            <BookOpen size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black">Kelola Format Panggilan</h1>
            <p className="text-indigo-200 text-xs">Template teks pengumuman TOA</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl text-green-700 dark:text-green-300">
          <CheckCircle2 size={16} className="shrink-0" />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0" />
          <span className="text-sm font-semibold">{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Tambah Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
        >
          <Plus size={18} /> Tambah Format Baru
        </button>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              {editingId ? <Pencil size={16} className="text-indigo-500" /> : <Plus size={16} className="text-indigo-500" />}
              {editingId ? 'Edit Format' : 'Format Baru'}
            </h2>
            <button onClick={resetForm} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X size={16} className="text-gray-400" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Nama Format</label>
                <input
                  type="text"
                  value={formNama}
                  onChange={e => setFormNama(e.target.value)}
                  placeholder="Contoh: Format Standar"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Bahasa</label>
                <select
                  value={formBahasa}
                  onChange={e => setFormBahasa(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="id">🇮🇩 Indonesia</option>
                  <option value="ar">🇸🇦 Arab</option>
                  <option value="en">🇬🇧 Inggris</option>
                </select>
              </div>
            </div>

            {/* Placeholder helper */}
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Sisipkan Placeholder</p>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map(ph => (
                  <button
                    key={ph.key}
                    onClick={() => insertPlaceholder(ph.key)}
                    title={ph.desc}
                    className="text-[11px] font-mono font-bold px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-100 dark:border-indigo-800"
                  >
                    {ph.key}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Klik placeholder untuk menambahkan ke template</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Template Teks</label>
              <textarea
                value={formTemplate}
                onChange={e => setFormTemplate(e.target.value)}
                rows={5}
                dir={formBahasa === 'ar' ? 'rtl' : 'ltr'}
                placeholder="Contoh: Santri {nama} dari {kamar}, harap segera menuju {tujuan}."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none leading-relaxed font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Urutan Tampil</label>
              <input
                type="number"
                value={formUrutan}
                onChange={e => setFormUrutan(parseInt(e.target.value))}
                min={0}
                className="w-32 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all active:scale-95"
              >
                <Save size={16} /> Simpan
              </button>
              {formTemplate && (
                <button
                  onClick={() => handlePreview(formTemplate, formBahasa)}
                  className="flex items-center gap-2 px-4 py-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-bold rounded-xl hover:bg-orange-200 transition-colors"
                >
                  <Volume2 size={16} /> Preview
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Daftar Format */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 dark:text-gray-100">Format Tersedia</h2>
          <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{formats.length}</span>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-700">
          {loading ? (
            <div className="py-10 text-center text-gray-400 text-sm">Memuat...</div>
          ) : formats.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">Belum ada format</div>
          ) : formats.map(f => (
            <div key={f.id} className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">{f.nama}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                      {f.bahasa === 'ar' ? '🇸🇦 Arab' : f.bahasa === 'en' ? '🇬🇧 EN' : '🇮🇩 ID'}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Hash size={9}/>{f.urutan}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono line-clamp-2" dir={f.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                    {f.template}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handlePreview(f.template, f.bahasa)}
                    className="p-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-gray-400 hover:text-orange-500 rounded-lg transition-colors"
                    title="Preview suara"
                  >
                    <Volume2 size={15} />
                  </button>
                  <button
                    onClick={() => handleEdit(f)}
                    className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-400 hover:text-indigo-500 rounded-lg transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(f.id, f.nama)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panduan placeholder */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl p-4">
        <h3 className="font-bold text-indigo-700 dark:text-indigo-300 text-sm mb-2 flex items-center gap-2">
          <Globe size={14}/> Panduan Placeholder
        </h3>
        <div className="space-y-1">
          {PLACEHOLDERS.map(ph => (
            <div key={ph.key} className="flex items-center gap-2">
              <code className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-indigo-900/40 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-700">
                {ph.key}
              </code>
              <span className="text-xs text-indigo-600 dark:text-indigo-400">→ {ph.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
