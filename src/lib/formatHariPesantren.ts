/**
 * Helper format hari dan tanggal khas pesantren
 * Menambahkan keterangan malam untuk jadwal malam (jam >= 18:00 atau jam < 04:00)
 * Contoh:
 * - "Selasa malam Rabu, 22 September 2026"
 * - "Ahad malam Senin, 20 September 2026"
 * - Jika siang (jam 04:00 - 17:59): "Selasa, 22 September 2026"
 */

const HARI_ARR = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const NEXT_HARI_ARR = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'];
const BULAN_ARR = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function parseDateObject(rawDate?: string | Date): Date {
  if (!rawDate) return new Date();
  if (rawDate instanceof Date) return isNaN(rawDate.getTime()) ? new Date() : rawDate;

  const str = String(rawDate).trim();
  if (!str) return new Date();

  if (str.includes('T')) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  // Format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T12:00:00+07:00`);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

function checkIsMalam(rawTime?: string): boolean {
  if (rawTime) {
    const hour = parseInt(String(rawTime).split(':')[0], 10);
    if (!isNaN(hour)) {
      return hour >= 18 || hour < 4;
    }
  }
  const nowHour = new Date().getHours();
  return nowHour >= 18 || nowHour < 4;
}

export function formatHariTanggalPesantren(rawDate?: string | Date, rawTime?: string): string {
  try {
    const d = parseDateObject(rawDate);
    const dayIdx = d.getDay();
    const hariIni = HARI_ARR[dayIdx];
    const hariBesok = NEXT_HARI_ARR[dayIdx];
    const tglNum = d.getDate();
    const blnName = BULAN_ARR[d.getMonth()];
    const thnNum = d.getFullYear();

    const isMalam = checkIsMalam(rawTime);
    const hariLabel = isMalam ? `${hariIni} malam ${hariBesok}` : hariIni;

    return `${hariLabel}, ${tglNum} ${blnName} ${thnNum}`;
  } catch {
    return typeof rawDate === 'string' ? rawDate : new Date().toLocaleDateString('id-ID');
  }
}

export function formatHariPesantren(rawDate?: string | Date, rawTime?: string): string {
  try {
    const d = parseDateObject(rawDate);
    const dayIdx = d.getDay();
    const hariIni = HARI_ARR[dayIdx];
    const hariBesok = NEXT_HARI_ARR[dayIdx];

    const isMalam = checkIsMalam(rawTime);
    return isMalam ? `${hariIni} malam ${hariBesok}` : hariIni;
  } catch {
    return 'Hari ini';
  }
}
