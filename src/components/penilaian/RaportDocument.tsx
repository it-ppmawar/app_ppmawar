'use client';

import { BookOpen, ClipboardList } from 'lucide-react';
import { calcPredikatFromInput, isEmptyScoreVal } from '@/lib/penilaian/calcNilai';
import RaportKopHeader from '@/components/penilaian/RaportKopHeader';
import RaportFooterSections, {
  KepalaMadinSignatureColumn,
  RaportKedisiplinanRow,
  formatTanggalRaport,
} from '@/components/penilaian/RaportFooterSections';

const AVATAR_COLORS = [
  '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#ea580c',
  '#0891b2', '#65a30d', '#7c3aed', '#db2777', '#059669',
];

function getInitials(nama: string): string {
  if (!nama) return '?';
  const parts = nama.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : nama.substring(0, 2).toUpperCase();
}

function getAvatarColor(nama: string): string {
  if (!nama) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < nama.length; i++) hash = nama.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function displayValue(value: unknown, fallback = '-'): string {
  return value !== null && value !== undefined && String(value).trim() !== ''
    ? String(value)
    : fallback;
}

/** Kotak foto santri dengan fallback inisial dan aksi perbesar opsional. */
function SantriPhoto({
  nama,
  fotoSrc,
  className,
  onZoomPhoto,
}: {
  nama: string;
  fotoSrc: string;
  className: string;
  onZoomPhoto?: (url: string) => void;
}) {
  const canZoom = Boolean(fotoSrc && onZoomPhoto);
  return (
    <div
      className={`rounded-xl overflow-hidden relative shadow-xs border-2 border-gray-300 bg-gray-100 ${canZoom ? 'cursor-pointer hover:opacity-90' : ''} ${className}`}
      onClick={() => (canZoom ? onZoomPhoto?.(fotoSrc) : null)}
      title={canZoom ? 'Foto Santri (klik untuk memperbesar)' : undefined}
    >
      <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: getAvatarColor(nama) }}>
        <span className="text-white text-base font-bold leading-none">{getInitials(nama)}</span>
      </div>
      {fotoSrc && (
        <img
          src={fotoSrc}
          alt={nama || 'Foto Santri'}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.display = 'none'; }}
        />
      )}
    </div>
  );
}

export interface RaportDocumentProps {
  raportData: any;
  editCatatan?: {
    catatan_wali_kelas?: string;
    akhlak?: string;
    tahfidz_hafalan?: string;
    status_kelulusan?: string;
  };
  getFotoUrl: (fotoName: string | null, nis?: string) => string;
  onZoomPhoto?: (url: string) => void;
}

/** Preview dan cetak raport dalam dua lembar A4: ringkasan lalu transkrip nilai. */
export default function RaportDocument({
  raportData,
  editCatatan,
  getFotoUrl,
  onZoomPhoto,
}: RaportDocumentProps) {
  if (!raportData) return null;

  const santri = raportData.santri || {};
  const listNilai = Array.isArray(raportData.nilai) ? raportData.nilai : [];
  const semesterLabel = raportData.semester === '1' ? '1 (Ganjil)' : '2 (Genap)';
  const totalMapel = Number(raportData.ringkasan_nilai?.total_mapel ?? listNilai.length);
  const totalDinilai = Number(raportData.ringkasan_nilai?.total_mapel_dinilai ?? 0);
  const totalNilaiAkhir = Number(raportData.ringkasan_nilai?.total_nilai_akhir ?? 0);
  const rataRata = totalNilaiAkhir > 0 ? displayValue(raportData.ringkasan_nilai?.rata_rata) : '-';
  const fotoSrc = getFotoUrl(santri.foto, santri.nis);
  const catatan = raportData.catatan || {};
  const catatanWaliText = editCatatan?.catatan_wali_kelas ?? catatan.catatan_wali_kelas ?? '';
  const tahfidzText = editCatatan?.tahfidz_hafalan ?? catatan.tahfidz_hafalan ?? '';
  const keputusanText = editCatatan?.status_kelulusan ?? catatan.status_kelulusan ?? 'Lanjut ke Semester Berikutnya';

  const identitasPage1 = [
    { label: 'Nama Santri', value: displayValue(santri.nama), valueClass: 'font-black text-gray-900' },
    { label: 'Nomor Induk (NIS)', value: displayValue(santri.nis) },
    { label: 'Kelas Madin', value: displayValue(santri.nama_kelas_madin) },
    { label: 'Semester / TA', value: `${semesterLabel} / ${displayValue(raportData.tahun_ajaran)}`, valueClass: 'font-bold' },
    { label: 'Kamar / Asrama', value: `${displayValue(santri.nama_kamar)} (${displayValue(santri.nama_asrama)})` },
    { label: 'Alamat', value: displayValue(santri.alamat), valueClass: 'leading-snug' },
  ];

  const identitasPage2 = [
    { label: 'Nama', labelWidth: 'w-32 print:w-28', value: displayValue(santri.nama), valueClass: 'font-bold text-gray-900' },
    { label: 'Kelas Madin', labelWidth: 'w-24 print:w-[86px]', value: displayValue(santri.nama_kelas_madin) },
    { label: 'Nomor Induk (NIS)', labelWidth: 'w-32 print:w-28', value: displayValue(santri.nis) },
    { label: 'Semester / TA', labelWidth: 'w-24 print:w-[86px]', value: `${semesterLabel} / ${displayValue(raportData.tahun_ajaran)}` },
  ];

  const kedisiplinanRows: RaportKedisiplinanRow[] = [
    {
      label: 'Total Poin Pelanggaran',
      value: `${raportData.rekap_kedisiplinan?.total_poin ?? 0} Poin`,
      valueClassName: 'font-bold text-gray-900',
    },
    {
      label: 'Predikat Kedisiplinan',
      value: raportData.rekap_kedisiplinan?.predikat || 'Sangat Baik',
      valueClassName: 'font-black text-emerald-800',
    },
    {
      label: 'Catatan Pelanggaran',
      value:
        !raportData.rekap_kedisiplinan?.riwayat || raportData.rekap_kedisiplinan.riwayat.length === 0
          ? 'Tidak ada catatan pelanggaran.'
          : `${raportData.rekap_kedisiplinan.riwayat[0].jenis} (${raportData.rekap_kedisiplinan.riwayat[0].deskripsi || '-'})`,
      valueClassName: 'text-gray-600 italic font-normal',
    },
    {
      label: 'Predikat Akhlak',
      value: editCatatan?.akhlak ?? catatan.akhlak ?? 'Baik',
      valueClassName: 'font-bold text-gray-800',
    },
    {
      label: 'Capaian Tahfidz',
      value: tahfidzText || '-',
      valueClassName: 'font-bold text-gray-800',
    },
    {
      label: 'Keputusan Akhir',
      value: keputusanText,
      valueClassName: 'font-black text-emerald-800',
      highlightRow: true,
    },
  ];

  const pageShell = 'raport-print-page bg-white text-gray-900 w-[794px] min-h-[1123px] flex flex-col mx-auto p-9 print:w-full print:h-[277mm] print:min-h-[277mm] print:max-h-[277mm] print:p-0 print:m-0 print:shadow-none print:border-none print:rounded-none';

  return (
    <div className="w-full overflow-x-auto pb-4 print:overflow-visible print:pb-0">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 12mm; }
          html, body { margin: 0 !important; background: #fff !important; }
          .raport-print-page {
            box-sizing: border-box;
            overflow: hidden;
            break-after: page;
            page-break-after: always;
          }
          .raport-print-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          .raport-print-page table { break-inside: auto; }
          .raport-print-page tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="flex flex-col items-center gap-6 print:block print:gap-0" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
        {/* HALAMAN 1: RINGKASAN RAPORT DAN IDENTITAS SANTRI */}
        <article className={`${pageShell} rounded-3xl shadow-md border border-gray-200`}>
          <RaportKopHeader />

          <section className="flex flex-row items-start gap-4 mb-4 bg-gray-50 print:bg-transparent p-3.5 rounded-2xl border border-gray-200/60 print:border-gray-300 print:p-3 print:mb-3">
            <div className="shrink-0">
              <SantriPhoto
                nama={santri.nama || ''}
                fotoSrc={fotoSrc}
                className="w-[88px] h-[104px] print:w-[80px] print:h-[96px]"
                onZoomPhoto={onZoomPhoto}
              />
            </div>

            <div className="flex-1 min-w-0 text-xs sm:text-[13px] print:text-[11px] space-y-1 print:space-y-0.5">
              {identitasPage1.map((item) => (
                <div key={item.label} className="flex items-baseline">
                  <span className="w-40 shrink-0 font-bold text-gray-600 print:w-36">{item.label}</span>
                  <span className="shrink-0 whitespace-pre">: </span>
                  <span className={`flex-1 min-w-0 break-words ${item.valueClass || ''}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-4 print:mb-3">
            <h5 className="font-bold text-xs print:text-[11px] uppercase tracking-wider text-gray-700 mb-1.5 flex items-center gap-1.5">
              <BookOpen size={14} /> A. Ringkasan Hasil Belajar
            </h5>
            <div className="grid grid-cols-3 gap-2 print:gap-2">
              <div className="rounded-xl border border-gray-300 bg-gray-50 print:bg-white px-3 py-2">
                <div className="text-[10px] print:text-[9px] uppercase text-gray-500 font-bold">Nilai Rata-rata</div>
                <div className="text-lg print:text-base font-black text-emerald-800">{rataRata}</div>
              </div>
              <div className="rounded-xl border border-gray-300 bg-gray-50 print:bg-white px-3 py-2">
                <div className="text-[10px] print:text-[9px] uppercase text-gray-500 font-bold">Jumlah Mata Pelajaran</div>
                <div className="text-lg print:text-base font-black text-gray-900">{totalMapel} <span className="text-xs font-semibold">mapel</span></div>
              </div>
              <div className="rounded-xl border border-gray-300 bg-gray-50 print:bg-white px-3 py-2">
                <div className="text-[10px] print:text-[9px] uppercase text-gray-500 font-bold">Mata Pelajaran Dinilai</div>
                <div className="text-lg print:text-base font-black text-gray-900">{totalDinilai} <span className="text-xs font-semibold">mapel</span></div>
              </div>
            </div>
          </section>

          <RaportFooterSections
            absensi={raportData.rekap_absensi || {}}
            kedisiplinanRows={kedisiplinanRows}
            namaWali={santri.nama_wali}
            kepalaMadin={raportData.kepala_madin}
          />

          <div className="pt-2 text-center text-[9px] print:text-[8px] text-gray-500">Halaman 1 dari 2</div>
        </article>

        {/* HALAMAN 2: TRANSKRIP AKADEMIK, SEMUA MAPEL DAN CATATAN WALI KELAS */}
        <article className={`${pageShell} rounded-3xl shadow-md border border-gray-200`}>
          <RaportKopHeader title="TRANSKRIP AKADEMIK" />

          <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-3 print:mb-2 text-[10px] print:text-[9px] border border-gray-300 rounded-lg p-2 print:p-1.5">
            {identitasPage2.map((item) => (
              <div key={item.label} className="flex items-baseline">
                <span className={`${item.labelWidth} shrink-0 font-bold text-gray-700`}>{item.label}</span>
                <span className="shrink-0 whitespace-pre">: </span>
                <span className={`flex-1 min-w-0 break-words ${item.valueClass || ''}`}>{item.value}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 mb-1.5 print:mb-1">
            <h5 className="font-bold text-xs print:text-[10px] uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <ClipboardList size={14} /> A. Transkrip Nilai Per Mata Pelajaran
            </h5>
            <span className="text-[9px] print:text-[8px] text-gray-600 whitespace-nowrap">KKM: 70</span>
          </div>

          <div className="border border-gray-400 rounded-lg overflow-hidden">
            <table className="w-full table-fixed text-left border-collapse text-[9px] print:text-[7.5px] leading-tight">
              <colgroup>
                <col style={{ width: '4%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '19%' }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-100 border-b border-gray-400 font-bold text-gray-800">
                  {['No', 'Mata Pelajaran / Kitab', 'KKM', 'Harian', 'Lisan', 'UTS', 'UAS', 'Nilai Akhir', 'Predikat', 'Kehadiran', 'Keterangan'].map((label) => (
                    <th key={label} className="py-1.5 px-1 print:py-1 print:px-0.5 text-center border-r border-gray-300 last:border-r-0">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listNilai.length === 0 ? (
                  <tr><td colSpan={11} className="py-4 text-center text-gray-500 italic">Belum ada mata pelajaran pada jadwal kelas ini.</td></tr>
                ) : listNilai.map((n: any, idx: number) => {
                  const hasFinal = !isEmptyScoreVal(n.nilai_akhir) && String(n.nilai_akhir).trim() !== '-';
                  const finalNumber = hasFinal ? Number(n.nilai_akhir) : NaN;
                  const keterangan = n.catatan || (
                    Number.isFinite(finalNumber)
                      ? finalNumber >= 70 ? 'Tuntas' : 'Perlu Bimbingan'
                      : 'Belum Dinilai'
                  );
                  const hasKehadiran =
                    n.kehadiran_persen !== null &&
                    n.kehadiran_persen !== undefined &&
                    Number(n.kehadiran_total ?? 0) > 0;
                  const kehadiranText = hasKehadiran ? `${n.kehadiran_persen}%` : '-';
                  return (
                    <tr key={n.id || `${n.mata_pelajaran}-${idx}`} className="border-b border-gray-300 last:border-b-0">
                      <td className="py-1.5 px-1 print:py-1 print:px-0.5 text-center border-r border-gray-300">{idx + 1}</td>
                      <td className="py-1.5 px-1.5 print:py-1 print:px-1 border-r border-gray-300">
                        <div className="font-bold break-words">{displayValue(n.mata_pelajaran)}</div>
                        <div className="italic text-gray-600 break-words">{displayValue(n.kitab)}</div>
                      </td>
                      <td className="py-1.5 px-1 print:py-1 print:px-0.5 text-center border-r border-gray-300">70</td>
                      {['nilai_harian', 'nilai_lisan', 'nilai_uts', 'nilai_uas', 'nilai_akhir'].map((field) => (
                        <td key={field} className={`py-1.5 px-1 print:py-1 print:px-0.5 text-center border-r border-gray-300 ${field === 'nilai_akhir' ? 'font-bold' : ''}`}>
                          {displayValue(n[field])}
                        </td>
                      ))}
                      <td className="py-1.5 px-1 print:py-1 print:px-0.5 text-center font-bold border-r border-gray-300">
                        {displayValue(n.predikat, calcPredikatFromInput(n.nilai_akhir, '-'))}
                      </td>
                      <td className="py-1.5 px-1 print:py-1 print:px-0.5 text-center font-semibold border-r border-gray-300">
                        {kehadiranText}
                      </td>
                      <td className="py-1.5 px-1.5 print:py-1 print:px-1 break-words">{displayValue(keterangan)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 border-t border-gray-400 font-bold">
                  <td colSpan={7} className="py-1.5 px-2 print:py-1 print:px-1 text-right border-r border-gray-300 uppercase">Nilai Rata-rata Akhir</td>
                  <td className="py-1.5 px-1 print:py-1 print:px-0.5 text-center text-emerald-800 border-r border-gray-300">{rataRata}</td>
                  <td className="py-1.5 px-1 print:py-1 print:px-0.5 text-center border-r border-gray-300">
                    {rataRata !== '-' ? calcPredikatFromInput(rataRata, '-') : '-'}
                  </td>
                  <td className="py-1.5 px-1 print:py-1 print:px-0.5 text-center text-emerald-800 border-r border-gray-300">
                    {Number(raportData.rekap_absensi?.total ?? 0) > 0
                      ? `${raportData.rekap_absensi?.persentase ?? 100}%`
                      : '-'}
                  </td>
                  <td className="py-1.5 px-1.5 print:py-1 print:px-1">{totalMapel} mapel · {totalDinilai} dinilai</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-3 print:mt-2 border border-gray-300 rounded-lg p-2 print:p-1.5 text-[9px] print:text-[8px] text-gray-700">
            <span className="font-bold uppercase">Keterangan nilai: </span>
            Nilai akhir ≥ 70: Tuntas · Nilai akhir &lt; 70: Perlu Bimbingan · Tanda “-”: belum diisi.
          </div>

          {/* B. CATATAN WALI KELAS (dipindahkan dari halaman 1) */}
          <div className="mt-3 print:mt-2 border border-gray-300 rounded-xl p-3 bg-gray-50 print:bg-transparent print:break-inside-avoid min-h-[84px] flex flex-col">
            <h6 className="font-bold text-[11px] uppercase tracking-wider text-gray-700 mb-1">B. Catatan Wali Kelas:</h6>
            <div className="text-xs text-gray-800">
              <p className="italic leading-snug">&quot;{catatanWaliText || 'Tingkatkan terus prestasi belajar dan ketaatan ibadah.'}&quot;</p>
            </div>
          </div>

          {/* FOTO SANTRI (rata tengah presisi) & TTD KEPALA MADIN — rata ujung bawah halaman */}
          <div className="mt-auto pt-4 print:pt-2 text-xs print:text-[11px] print:break-inside-avoid">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
              <div aria-hidden="true" />

              <div className="flex justify-center">
                <SantriPhoto
                  nama={santri.nama || ''}
                  fotoSrc={fotoSrc}
                  className="w-[90px] h-[120px] print:w-[81px] print:h-[108px]"
                  onZoomPhoto={onZoomPhoto}
                />
              </div>

              <KepalaMadinSignatureColumn
                kepalaMadin={raportData.kepala_madin}
                dateLabel={formatTanggalRaport()}
                lineMarginClass="mx-4"
              />
            </div>
          </div>

          <div className="pt-2 text-center text-[9px] print:text-[8px] text-gray-500">Halaman 2 dari 2</div>
        </article>
      </div>
    </div>
  );
}
