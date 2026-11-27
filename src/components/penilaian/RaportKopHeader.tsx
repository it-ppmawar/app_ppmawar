'use client';

/**
 * Kop resmi raport Pondok Pesantren Matholi'ul Anwar dengan logo pesantren di sebelah kiri
 * serta penyeimbang kanan agar judul dan badge raport tetap presisi di tengah halaman.
 */
export default function RaportKopHeader() {
  return (
    <div className="border-b-4 border-double border-gray-900 pb-4 mb-6">
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        <div className="w-20 h-20 print:w-[72px] print:h-[72px] shrink-0 flex items-center justify-center">
          <img
            src="/logo.png"
            alt="Logo Pondok Pesantren Matholi'ul Anwar"
            loading="eager"
            decoding="sync"
            className="w-full h-full object-contain"
          />
        </div>

        <div className="flex-1 min-w-0 text-center">
          <h3 className="text-xl sm:text-2xl print:text-[20px] font-black tracking-wide sm:tracking-wider print:tracking-wide uppercase">
            PONDOK PESANTREN MATHOLI&apos;UL ANWAR
          </h3>
          <h4 className="text-base sm:text-lg print:text-base font-bold uppercase text-emerald-800">
            MADRASAH DINIYAH &amp; MADRASATUL QUR&apos;AN
          </h4>
          <p className="text-xs text-gray-600 mt-1">
            Simo - Lamongan - Jawa Timur | Website: ppmawar.or.id
          </p>
        </div>

        {/* Penyeimbang lebar logo kiri agar judul instansi tetap tepat di tengah halaman */}
        <div className="w-20 print:w-[72px] shrink-0" aria-hidden="true" />
      </div>

      <div className="mt-3 text-center">
        <div className="inline-block bg-gray-900 text-white font-bold text-sm px-6 py-1 rounded-full uppercase tracking-widest">
          LAPORAN HASIL BELAJAR SANTRI (RAPORT)
        </div>
      </div>
    </div>
  );
}
