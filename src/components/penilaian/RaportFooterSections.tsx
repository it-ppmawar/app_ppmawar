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
  namaWali?: string | null;
  kepalaMadin?: string | null;
  showIcons?: boolean;
}

/** Format tanggal resmi raport berbahasa Indonesia dengan lokasi Lamongan. */
export function formatTanggalRaport(date: Date = new Date()): string {
  return `Lamongan, ${date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`;
}

/** Kolom tanda tangan Kepala Madrasah Diniyah dengan garis dan jarak TTD lega. */
export function KepalaMadinSignatureColumn({
  kepalaMadin,
  dateLabel,
  lineMarginClass = 'mx-8',
}: {
  kepalaMadin?: string | null;
  dateLabel?: string;
  lineMarginClass?: string;
}) {
  return (
    <div className="flex flex-col justify-between text-center">
      <div>
        {dateLabel && <p className="text-right text-gray-500 mb-2">{dateLabel}</p>}
        <p className="font-bold text-gray-700 whitespace-nowrap">
          Kepala Madrasah Diniyah
        </p>
      </div>
      <div className="mt-20">
        <p className={`font-bold border-t border-gray-400 ${lineMarginClass} pt-1 whitespace-nowrap`}>
          {kepalaMadin || 'Agus Naqoub Ashrofun Nasr'}
        </p>
      </div>
    </div>
  );
}

/**
 * Bagian bawah raport Halaman 1 A4: Tabel B (Presensi) dan Tabel C (Kedisiplinan)
 * tersusun bertumpuk penuh lebar, diikuti ruang tanda tangan resmi di bagian bawah.
 */
export default function RaportFooterSections({
  absensi,
  kedisiplinanRows,
  namaWali,
  kepalaMadin,
  showIcons = true,
}: RaportFooterSectionsProps) {
  const tanggalRaport = formatTanggalRaport();
  const presensiRows = absensi
    ? [
        { label: 'Hadir', value: `${absensi.hadir ?? 0} kali`, valueClassName: 'font-bold text-emerald-700' },
        { label: 'Izin', value: `${absensi.izin ?? 0} kali`, valueClassName: 'font-bold text-amber-700' },
        { label: 'Sakit', value: `${absensi.sakit ?? 0} kali`, valueClassName: 'font-bold text-blue-700' },
        { label: 'Alpha / Tanpa Ket.', value: `${absensi.alpha ?? absensi.alpa ?? 0} kali`, valueClassName: 'font-bold text-rose-700' },
        { label: 'Persentase Hadir', value: `${absensi.persentase ?? 100} persen`, valueClassName: 'font-black text-gray-900', highlightRow: true },
      ]
    : [];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* TABEL B & C BERTUMPUK PENUH LEBAR */}
      {presensiRows.length > 0 && (
        <div className="mb-3 print:mb-2.5 print:break-inside-avoid">
          <h5 className="font-bold text-xs print:text-[11px] uppercase tracking-wider text-gray-700 mb-1.5 flex items-center gap-1.5 whitespace-nowrap">
            {showIcons && <ClipboardCheck size={14} className="text-blue-600 shrink-0" />}
            <span>B. Rekapitulasi Presensi</span>
          </h5>
          <div className="border border-gray-300 rounded-xl overflow-hidden text-[11px]">
            <table className="w-full border-collapse">
              <tbody className="divide-y divide-gray-200">
                {presensiRows.map((row) => (
                  <tr key={row.label} className={row.highlightRow ? 'bg-gray-100 font-bold' : undefined}>
                    <td className="py-1.5 px-2.5 w-48 font-semibold bg-gray-50 border-r border-gray-200 whitespace-nowrap">
                      {row.label}
                    </td>
                    <td className={`py-1.5 px-2.5 whitespace-nowrap ${row.valueClassName}`}>
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {kedisiplinanRows && kedisiplinanRows.length > 0 && (
        <div className="mb-3 print:mb-2.5 print:break-inside-avoid">
          <h5 className="font-bold text-xs print:text-[11px] uppercase tracking-wider text-gray-700 mb-1.5 flex items-center gap-1.5 whitespace-nowrap">
            {showIcons && <ShieldCheck size={14} className="text-emerald-600 shrink-0" />}
            <span>C. Kedisiplinan &amp; Ketertiban</span>
          </h5>
          <div className="border border-gray-300 rounded-xl overflow-hidden text-[11px]">
            <table className="w-full border-collapse">
              <tbody className="divide-y divide-gray-200">
                {kedisiplinanRows.map((row) => (
                  <tr key={row.label} className={row.highlightRow ? 'bg-gray-100 font-bold' : undefined}>
                    <td className="py-1.5 px-2.5 w-48 font-semibold bg-gray-50 border-r border-gray-200 whitespace-nowrap">
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

      {/* KOLOM TANDA TANGAN RESMI — rata bawah halaman */}
      <div className="text-xs print:text-[11px] mt-auto pt-2 print:break-inside-avoid">
        <p className="text-right text-gray-500">{tanggalRaport}</p>
        <p className="text-center text-gray-500 mt-2 mb-2">Mengetahui,</p>
        <div className="grid grid-cols-2 gap-6 text-center">
          <div className="flex flex-col justify-between">
            <p className="font-bold text-gray-700">Orang Tua / Wali Santri</p>
            <div className="mt-20">
              <p className="font-bold border-t border-gray-400 mx-8 pt-1 whitespace-nowrap">
                {namaWali && String(namaWali).trim() && namaWali !== '-'
                  ? namaWali
                  : '( ......................... )'}
              </p>
            </div>
          </div>

          <KepalaMadinSignatureColumn kepalaMadin={kepalaMadin} />
        </div>
      </div>
    </div>
  );
}
