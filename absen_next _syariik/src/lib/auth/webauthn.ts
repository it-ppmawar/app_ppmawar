export const rpName = 'Sistem Absensi PPTQ';
export const rpID = process.env.NODE_ENV === 'production' ? 'app.pptq.ppmawar.or.id' : 'localhost';
export const origin = process.env.NODE_ENV === 'production' ? `https://${rpID}` : `http://${rpID}:3000`;
