'use client';

import type { ReactNode } from 'react';
import { ClipboardCheck, ShieldCheck } from 'lucide-react';

export interface RaportKedisiplinanRow {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  highlightRow?: boolean;
}

interface RaportFooterSectionsProps {
  absensi: {
    hadir?: number | null;
    izin?: number | null;
    sakit?: number | null;
    alpha?: number | null;
    alpa?: number | null;
    persentase?: number | null;
  } | null;
  kedisiplinanRows: RaportKedisiplinanRow[] | null;
  catatanTitle: string;
  catatanContent: ReactNode;
  namaWali?: string | null;
  kepalaMadin?: string | null;
  showIcons?: boolean;
}

/**
 * Bagian bawah raport A4: Tabel B (Presensi, lebar ringkas presisi sesuai isi tanpa ruang kosong berlebih)
 * dan Tabel C (Kedisiplinan, melebar mengisi sisa ruang) berdampingan dengan tinggi presisi sama rata,
 * diikuti Catatan Wali Kelas dan ruang tanda tangan lega di bawahnya.
 */
export default function RaportFooterSections({
  absensi,
  kedisiplinanRows,
  catatanTitle,
  catatanContent,
  namaWali,
  kepalaMadin,
  showIcons = true,
}: RaportFooterSectionsProps) {
  const showSideBySide = Boolean(absensi && kedisiplinanRows && kedisiplinanRows.length > 0);

  return (
    <>
      {/* TABEL B & C BERDAMPINGAN (B SESUAI LEBAR ISI, C MELEBAR, TINGGI PRESISI SAMA RATA) */}
      {(absensi || (kedisiplinanRows && kedisiplinanRows.length > 0)) && (
        <div
          className={
            showSideBySide
              ? 'grid grid-cols-[max-content_1fr] gap-3.5 items-stretch mb-3.5 print:break-inside-avoid'
              : 'mb-3.5 print:break-inside-avoid'
          }
        >
          {/* TABEL B: REKAPITULASI PRESENSI */}
          {absensi && (
            <div className="flex flex-col min-w-0">
              <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-1.5 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                {showIcons && <ClipboardCheck size={14} className="text-blue-600 shrink-0" />}
                <span>B. Rekapitulasi Presensi</span>
              </h5>
              <div className="flex-1 border border-gray-300 rounded-xl overflow-hidden text-[11px] flex flex-col">
                <table className="w-full h-full flex-1 border-collapse">
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="py-1.5 px-2.5 font-semibold bg-gray-50 border-r border-gray-200 whitespace-nowrap">
                        Hadir
                      </td>
                      <td className="py-1.5 px-2.5 font-bold text-emerald-700 whitespace-nowrap">
                        {absensi.hadir ?? 0} kali
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2.5 font-semibold bg-gray-50 border-r border-gray-200 whitespace-nowrap">
                        Izin
                      </td>
                      <td className="py-1.5 px-2.5 font-bold text-amber-700 whitespace-nowrap">
                        {absensi.izin ?? 0} kali
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2.5 font-semibold bg-gray-50 border-r border-gray-200 whitespace-nowrap">
                        Sakit
                      </td>
                      <td className="py-1.5 px-2.5 font-bold text-blue-700 whitespace-nowrap">
                        {absensi.sakit ?? 0} kali
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2.5 font-semibold bg-gray-50 border-r border-gray-200 whitespace-nowrap">
                        Alpha / Tanpa Ket.
                      </td>
                      <td className="py-1.5 px-2.5 font-bold text-rose-700 whitespace-nowrap">
                        {absensi.alpha ?? absensi.alpa ?? 0} kali
                      </td>
                    </tr>
                    <tr className="bg-gray-100 font-bold">
                      <td className="py-1.5 px-2.5 border-r border-gray-200 whitespace-nowrap">
                        Persentase Hadir
                      </td>
                      <td className="py-1.5 px-2.5 font-black text-gray-900 whitespace-nowrap">
                        {absensi.persentase ?? 100} persen
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABEL C: KEDISIPLINAN & KETERTIBAN */}
          {kedisiplinanRows && kedisiplinanRows.length > 0 && (
            <div className="flex flex-col min-w-0">
              <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-1.5 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                {showIcons && <ShieldCheck size={14} className="text-emerald-600 shrink-0" />}
                <span>C. Kedisiplinan &amp; Ketertiban</span>
              </h5>
              <div className="flex-1 border border-gray-300 rounded-xl overflow-hidden text-[11px] flex flex-col">
                <table className="w-full h-full flex-1 border-collapse">
                  <tbody className="divide-y divide-gray-200">
                    {kedisiplinanRows.map((row) => (
                      <tr key={row.label} className={row.highlightRow ? 'bg-gray-100 font-bold' : undefined}>
                        <td className="py-1.5 px-2.5 w-40 font-semibold bg-gray-50 border-r border-gray-200 whitespace-nowrap">
                          {row.label}
                        </td>
                        <td className={`py-1.5 px-2.5 ${row.valueClassName || 'text-gray-800 font-bold'}`}>
                          {row.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CATATAN WALI KELAS */}
      <div className="border border-gray-300 rounded-xl p-3 mb-2 bg-gray-50 print:bg-transparent print:break-inside-avoid">
        <h6 className="font-bold text-[11px] uppercase tracking-wider text-gray-700 mb-0.5">{catatanTitle}</h6>
        <div className="text-xs text-gray-800">{catatanContent}</div>
      </div>

      {/* KOLOM TANDA TANGAN RESMI — TEKS RAPAT KE ATAS AGAR RUANG TANDA TANGAN LEGA */}
      <div className="text-xs mt-1.5 pt-0.5 print:break-inside-avoid">
        <p className="text-right text-gray-500">
          Lamongan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <p className="text-center text-gray-500 mt-2 mb-2">Mengetahui,</p>
        <div className="grid grid-cols-2 gap-6 text-center">
          <div className="flex flex-col justify-between">
            <p className="font-bold text-gray-700">Orang Tua / Wali Santri</p>
            <div className="mt-24">
              <p className="font-bold border-t border-gray-400 mx-8 pt-1 whitespace-nowrap">
                {namaWali && String(namaWali).trim() && namaWali !== '-'
                  ? namaWali
                  : '( ......................... )'}
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between">
            <p className="font-bold text-gray-700 whitespace-nowrap">
              Kepala Madrasah Diniyah PP. Matholi&apos;ul Anwar
            </p>
            <div className="mt-24">
              <p className="font-bold border-t border-gray-400 mx-8 pt-1 whitespace-nowrap">
                {kepalaMadin || 'Agus Naqoub Ashrofun Nasr'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
