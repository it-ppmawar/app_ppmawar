export const rpName = 'Sistem Absensi PPMA';
export const rpID = process.env.NODE_ENV === 'production' ? 'app.ppmawar.or.id' : 'localhost';
export const origin = process.env.NODE_ENV === 'production' ? `https://${rpID}` : `http://${rpID}:3000`;
