'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, Printer, RefreshCw } from 'lucide-react';
import RaportDocument from '@/components/penilaian/RaportDocument';

const getFotoUrl = (fotoName: string | null, nis?: string) => {
  if (!fotoName || fotoName === '-') {
    if (nis) return `https://mawar.smartpesantren.id/sekretariat/berkas/Berkas_2026_${nis}.jpg`;
    return '';
  }
  if (fotoName.startsWith('http://') || fotoName.startsWith('https://')) return fotoName;
  if (fotoName.startsWith('foto_') || fotoName.startsWith('upload_') || fotoName.startsWith('profil_')) return `/uploads/${fotoName}`;
  const baseUrl = process.env.NEXT_PUBLIC_API_MITRA_FOTO_URL || 'https://mawar.smartpesantren.id/sekretariat/berkas/';
  const cleanFotoName = fotoName.startsWith('/') ? fotoName.substring(1) : fotoName;
  if (cleanFotoName.includes('sekretariat/berkas')) return `https://mawar.smartpesantren.id/${cleanFotoName}`;
  return `${baseUrl}${cleanFotoName}`;
};

/** Preview cetak menggunakan dokumen raport yang sama dengan tab raport dashboard. */
export default function RaportPreviewClient() {
  const params = useSearchParams();
  const murid_id = params.get('murid_id') || '';
  const semester = params.get('semester') || '1';
  const tahun_ajaran = params.get('tahun_ajaran') || '2025/2026';
  const token = params.get('token') || params.get('t') || '';

  const [raportData, setRaportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!murid_id) {
      setError('Parameter tidak lengkap.');
      setLoading(false);
      return;
    }
    const q = new URLSearchParams({ murid_id, semester, tahun_ajaran });
    if (token) q.set('token', token);

    fetch(`/api/penilaian/raport?${q.toString()}`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) setRaportData(json.data);
        else setError(json.error || 'Data raport tidak ditemukan.');
      })
      .catch(() => setError('Gagal memuat data raport.'))
      .finally(() => setLoading(false));
  }, [murid_id, semester, tahun_ajaran, token]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
        <RefreshCw size={32} className="animate-spin text-amber-600" />
        <p className="font-bold text-gray-600">Memuat Raport Santri...</p>
      </div>
    );
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600 font-bold p-8 text-center">{error}</div>;
  }
  if (!raportData) return null;

  return (
    <div className="min-h-screen print:min-h-0 bg-gray-100 print:bg-white">
      <div className="print:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between gap-2 px-4 py-2.5 z-50">
        <div className="flex items-center gap-2 text-amber-700 font-bold text-xs sm:text-sm min-w-0">
          <BookOpen size={18} className="shrink-0" />
          <span className="truncate">Preview Raport — {raportData.santri?.nama || '-'}</span>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 shrink-0 cursor-pointer"
        >
          <Printer size={15} />
          <span>Cetak / Simpan PDF</span>
        </button>
      </div>

      <div className="pt-14 print:pt-0 w-full overflow-x-auto print:overflow-visible">
        <RaportDocument raportData={raportData} getFotoUrl={getFotoUrl} />
      </div>
    </div>
  );
}
