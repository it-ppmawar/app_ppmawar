'use client';

/**
 * Kop resmi raport A4 Pondok Pesantren Matholi'ul Anwar dengan logo pesantren di sebelah kiri,
 * judul dan badge raport presisi di tengah, serta aturan cetak @page A4 portrait.
 */
export default function RaportKopHeader() {
  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
        }
      `}</style>
      <div className="border-b-4 border-double border-gray-900 pb-6 sm:pb-7 print:pb-5 mb-4">
        <div className="flex items-center justify-between gap-3 px-0.5">
          <div className="w-[98px] h-[114px] print:w-[84px] print:h-[98px] shrink-0 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Logo Pondok Pesantren Matholi'ul Anwar"
              loading="eager"
              decoding="sync"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex-1 min-w-0 text-center">
            <h3 className="text-lg sm:text-[21px] print:text-[19px] font-black tracking-wide uppercase">
              PONDOK PESANTREN MATHOLI&apos;UL ANWAR
            </h3>
            <h4 className="text-sm sm:text-base print:text-[15px] font-bold uppercase text-emerald-800">
              MADRASAH DINIYAH &amp; MADRASATUL QUR&apos;AN
            </h4>
            <p className="text-[11px] text-gray-600 mt-0.5">
              Simo - Lamongan - Jawa Timur | Website: ppmawar.or.id
            </p>
            <div className="mt-2 text-center">
              <div className="inline-block bg-gray-900 text-white font-bold text-xs sm:text-[13px] print:text-xs px-5 py-1 rounded-full uppercase tracking-widest">
                LAPORAN HASIL BELAJAR SANTRI (RAPORT)
              </div>
            </div>
          </div>

          {/* Penyeimbang lebar logo kiri agar judul instansi tetap tepat di tengah halaman A4 */}
          <div className="w-[98px] print:w-[84px] shrink-0" aria-hidden="true" />
        </div>
      </div>
    </>
  );
}
