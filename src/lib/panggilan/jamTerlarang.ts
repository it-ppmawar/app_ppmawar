export const JAM_TERLARANG_SETTING_KEY = 'jam_terlarang_panggilan';

export const HARI_INDONESIA = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Ahad',
] as const;

export interface JamTerlarangSlot {
  id: string;
  label: string;
  mulai: string;   // Format HH:mm
  selesai: string; // Format HH:mm
  hari: string[];  // Array kosong = Setiap Hari; contoh ['Jumat'] = khusus Jumat
  aktif: boolean;
}

export interface JamTerlarangTarget {
  wali: boolean;
  pengurus: boolean;
  staff: boolean;
  petugas: boolean;
}

export interface JamTerlarangConfig {
  aktif: boolean;
  berlaku_untuk: JamTerlarangTarget;
  slots: JamTerlarangSlot[];
}

export interface JamTerlarangCheckResult {
  blocked: boolean;
  slot: JamTerlarangSlot | null;
  waktuWib: string;
  hariWib: string;
  pesan: string;
}

export const DEFAULT_JAM_TERLARANG_SLOTS: JamTerlarangSlot[] = [
  {
    id: 'preset-subuh',
    label: 'Sholat Subuh Berjamaah',
    mulai: '04:00',
    selesai: '05:15',
    hari: [],
    aktif: true,
  },
  {
    id: 'preset-dzuhur',
    label: 'Sholat Dzuhur Berjamaah',
    mulai: '11:40',
    selesai: '12:25',
    hari: [],
    aktif: true,
  },
  {
    id: 'preset-jumat',
    label: 'Sholat Jumat Berjamaah',
    mulai: '11:15',
    selesai: '12:45',
    hari: ['Jumat'],
    aktif: true,
  },
  {
    id: 'preset-ashar',
    label: 'Sholat Ashar Berjamaah',
    mulai: '14:55',
    selesai: '15:35',
    hari: [],
    aktif: true,
  },
  {
    id: 'preset-maghrib-isya',
    label: 'Sholat Maghrib, Ngaji & Isya',
    mulai: '17:20',
    selesai: '19:45',
    hari: [],
    aktif: true,
  },
  {
    id: 'preset-malam',
    label: 'Jam Istirahat Malam',
    mulai: '21:30',
    selesai: '04:00',
    hari: [],
    aktif: true,
  },
];

export const DEFAULT_JAM_TERLARANG_CONFIG: JamTerlarangConfig = {
  aktif: false,
  berlaku_untuk: {
    wali: true,
    pengurus: true,
    staff: false,
    petugas: false,
  },
  slots: DEFAULT_JAM_TERLARANG_SLOTS.map(s => ({ ...s, hari: [...s.hari] })),
};

export function createDefaultJamTerlarangPresets(): JamTerlarangSlot[] {
  return DEFAULT_JAM_TERLARANG_SLOTS.map(s => ({ ...s, hari: [...s.hari] }));
}

export function isValidTimeHHmm(val?: string | null): val is string {
  return Boolean(val && /^([01]\d|2[0-3]):[0-5]\d$/.test(val.trim()));
}

export function parseMinutesFromHHmm(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Menormalkan input mentah (JSON string dari DB atau objek dari form) menjadi JamTerlarangConfig yang aman.
 */
export function sanitizeJamTerlarangConfig(raw: unknown): JamTerlarangConfig {
  let parsed: any = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return {
        ...DEFAULT_JAM_TERLARANG_CONFIG,
        berlaku_untuk: { ...DEFAULT_JAM_TERLARANG_CONFIG.berlaku_untuk },
        slots: createDefaultJamTerlarangPresets(),
      };
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return {
        ...DEFAULT_JAM_TERLARANG_CONFIG,
        berlaku_untuk: { ...DEFAULT_JAM_TERLARANG_CONFIG.berlaku_untuk },
        slots: createDefaultJamTerlarangPresets(),
      };
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      ...DEFAULT_JAM_TERLARANG_CONFIG,
      berlaku_untuk: { ...DEFAULT_JAM_TERLARANG_CONFIG.berlaku_untuk },
      slots: createDefaultJamTerlarangPresets(),
    };
  }

  const targetRaw = parsed.berlaku_untuk && typeof parsed.berlaku_untuk === 'object' ? parsed.berlaku_untuk : {};
  const berlaku_untuk: JamTerlarangTarget = {
    wali: targetRaw.wali !== undefined ? Boolean(targetRaw.wali) : true,
    pengurus: targetRaw.pengurus !== undefined ? Boolean(targetRaw.pengurus) : true,
    staff: targetRaw.staff !== undefined ? Boolean(targetRaw.staff) : false,
    petugas: targetRaw.petugas !== undefined ? Boolean(targetRaw.petugas) : false,
  };

  const validDaySet = new Set<string>(HARI_INDONESIA);
  const slotsRaw = Array.isArray(parsed.slots) ? parsed.slots : createDefaultJamTerlarangPresets();

  const slots: JamTerlarangSlot[] = slotsRaw
    .filter((item: any) => item && typeof item === 'object')
    .map((item: any, idx: number) => {
      const hariArr = Array.isArray(item.hari)
        ? Array.from(
            new Set(
              item.hari
                .map((h: any) => String(h).trim())
                .filter((h: string) => validDaySet.has(h))
            )
          )
        : [];
      return {
        id: String(item.id || `slot-${idx + 1}`).trim() || `slot-${idx + 1}`,
        label: String(item.label || '').trim(),
        mulai: String(item.mulai || '').trim(),
        selesai: String(item.selesai || '').trim(),
        hari: hariArr as string[],
        aktif: item.aktif !== undefined ? Boolean(item.aktif) : true,
      };
    });

  return {
    aktif: Boolean(parsed.aktif),
    berlaku_untuk,
    slots,
  };
}

/** Validasi kelengkapan slot sebelum disimpan; mengembalikan null bila valid. */
export function validateJamTerlarangConfig(config: JamTerlarangConfig): string | null {
  for (let i = 0; i < config.slots.length; i++) {
    const s = config.slots[i];
    if (!s.aktif) continue;
    if (!s.label) {
      return `Keterangan jadwal terlarang ke-${i + 1} wajib diisi.`;
    }
    if (!isValidTimeHHmm(s.mulai) || !isValidTimeHHmm(s.selesai)) {
      return `Format jam mulai/selesai pada "${s.label}" harus HH:mm yang valid.`;
    }
    if (s.mulai === s.selesai) {
      return `Jam mulai dan selesai pada "${s.label}" tidak boleh sama.`;
    }
  }
  return null;
}

const WEEKDAY_EN_TO_ID: Record<string, number> = {
  Sun: 6, // Ahad
  Mon: 0, // Senin
  Tue: 1, // Selasa
  Wed: 2, // Rabu
  Thu: 3, // Kamis
  Fri: 4, // Jumat
  Sat: 5, // Sabtu
};

/** Mengambil hari & jam saat ini dalam zona waktu WIB (Asia/Jakarta) secara konsisten di server/browser. */
export function getWibTimeContext(now: Date = new Date()): {
  dayName: string;
  prevDayName: string;
  hhmm: string;
  minutes: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const partMap: Record<string, string> = {};
  parts.forEach(p => {
    partMap[p.type] = p.value;
  });

  const dayIdx = WEEKDAY_EN_TO_ID[partMap.weekday] ?? 0;
  const prevIdx = (dayIdx + 6) % 7;
  const hour = Number(partMap.hour || 0) % 24;
  const minute = Number(partMap.minute || 0) % 60;
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');

  return {
    dayName: HARI_INDONESIA[dayIdx],
    prevDayName: HARI_INDONESIA[prevIdx],
    hhmm: `${hh}:${mm}`,
    minutes: hour * 60 + minute,
  };
}

/** Mengecek apakah sebuah slot jam terlarang sedang aktif pada konteks waktu WIB tertentu (mendukung lintas tengah malam). */
export function isSlotActiveAtTime(
  slot: JamTerlarangSlot,
  ctx: { dayName: string; prevDayName: string; minutes: number }
): boolean {
  if (!slot.aktif || !isValidTimeHHmm(slot.mulai) || !isValidTimeHHmm(slot.selesai)) {
    return false;
  }

  const startMin = parseMinutesFromHHmm(slot.mulai);
  const endMin = parseMinutesFromHHmm(slot.selesai);
  if (startMin === endMin) return false;

  const hasDayFilter = Array.isArray(slot.hari) && slot.hari.length > 0;
  const matchesToday = !hasDayFilter || slot.hari.includes(ctx.dayName);
  const matchesYesterday = !hasDayFilter || slot.hari.includes(ctx.prevDayName);

  // Rentang normal dalam 1 hari (misal 17:20 -> 19:45)
  if (startMin < endMin) {
    return matchesToday && ctx.minutes >= startMin && ctx.minutes < endMin;
  }

  // Rentang lintas tengah malam (misal 21:30 -> 04:00)
  return (
    (matchesToday && ctx.minutes >= startMin) ||
    (matchesYesterday && ctx.minutes < endMin)
  );
}

/**
 * Menentukan apakah peran pengguna harus diblokir saat jam terlarang aktif.
 * Hanya Admin & Pengasuh yang selalu dikecualikan untuk kebutuhan darurat.
 */
export function shouldRestrictRoleForJamTerlarang(
  role?: string | null,
  isPengasuh?: boolean,
  config?: JamTerlarangConfig
): boolean {
  if (!config?.aktif) return false;

  const r = String(role || '').toLowerCase().trim();
  if (isPengasuh || r === 'admin' || r.includes('pengasuh')) {
    return false;
  }

  if (r === 'wali_murid' || r === 'wali_alumni' || r === 'alumni') {
    return Boolean(config.berlaku_untuk.wali);
  }
  if (r.includes('pengurus_asrama') || r === 'pengurus') {
    return Boolean(config.berlaku_untuk.pengurus);
  }
  if (r === 'staff' || r.startsWith('staff_') || r.includes('staff')) {
    return Boolean(config.berlaku_untuk.staff);
  }
  if (r.includes('petugas')) {
    return Boolean(config.berlaku_untuk.petugas);
  }
  return false;
}

function getRemainingMinutesInSlot(slot: JamTerlarangSlot, currentMinutes: number): number {
  const startMin = parseMinutesFromHHmm(slot.mulai);
  const endMin = parseMinutesFromHHmm(slot.selesai);
  if (startMin < endMin) {
    return Math.max(0, endMin - currentMinutes);
  }
  return currentMinutes >= startMin
    ? (1440 - currentMinutes) + endMin
    : Math.max(0, endMin - currentMinutes);
}

/** Mengecek status jam terlarang saat ini (WIB) untuk ditampilkan di UI maupun validasi backend. */
export function checkJamTerlarang(
  config: JamTerlarangConfig,
  now: Date = new Date()
): JamTerlarangCheckResult {
  const ctx = getWibTimeContext(now);
  if (!config.aktif) {
    return { blocked: false, slot: null, waktuWib: ctx.hhmm, hariWib: ctx.dayName, pesan: '' };
  }

  const activeSlots = config.slots.filter(slot => isSlotActiveAtTime(slot, ctx));
  if (activeSlots.length === 0) {
    return { blocked: false, slot: null, waktuWib: ctx.hhmm, hariWib: ctx.dayName, pesan: '' };
  }

  // Bila beberapa jadwal beririsan (misal Dzuhur & Sholat Jumat), pilih yang selesainya paling akhir agar estimasi buka akurat.
  const activeSlot = activeSlots.reduce((best, curr) => {
    const bestRem = getRemainingMinutesInSlot(best, ctx.minutes);
    const currRem = getRemainingMinutesInSlot(curr, ctx.minutes);
    if (currRem !== bestRem) return currRem > bestRem ? curr : best;
    const currSpecific = curr.hari.length > 0 ? 1 : 0;
    const bestSpecific = best.hari.length > 0 ? 1 : 0;
    return currSpecific > bestSpecific ? curr : best;
  });

  const label = activeSlot.label || 'Waktu Sholat / Kegiatan Aktif';
  const pesan = `Pengiriman panggilan dinonaktifkan sementara karena sedang ${label} (${activeSlot.mulai} – ${activeSlot.selesai} WIB). Panggilan dapat dikirim kembali pukul ${activeSlot.selesai} WIB.`;

  return {
    blocked: true,
    slot: activeSlot,
    waktuWib: ctx.hhmm,
    hariWib: ctx.dayName,
    pesan,
  };
}
