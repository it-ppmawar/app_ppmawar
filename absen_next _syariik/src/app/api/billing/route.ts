import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

// MOCK DATA (Data Palsu)
// Data ini nanti akan diganti dengan hasil fetch() ke API Smart Pesantren asli
const mockBillingData = [
  {
    id: 1,
    nis: "123456",
    nama_santri: "A.M. SHOFA NIMAS SYAFANA",
    nama_tagihan: "INFAQ MA UGL",
    nominal: 210000,
    status: "Lunas",
    periode: "10-2023",
    timestamp: "2023-10-15T10:00:00Z"
  },
  {
    id: 2,
    nis: "123456",
    nama_santri: "A.M. SHOFA NIMAS SYAFANA",
    nama_tagihan: "INFAQ PPMA.",
    nominal: 450000,
    status: "Lunas",
    periode: "10-2023",
    timestamp: "2023-10-16T11:00:00Z"
  },
  {
    id: 3,
    nis: "123456",
    nama_santri: "A.M. SHOFA NIMAS SYAFANA",
    nama_tagihan: "EXTRA TFD.",
    nominal: 200000,
    status: "Lunas",
    periode: "10-2023",
    timestamp: "2023-10-17T09:30:00Z"
  },
  {
    id: 4,
    nis: "123456",
    nama_santri: "A.M. SHOFA NIMAS SYAFANA",
    nama_tagihan: "INFAQ MA UGL",
    nominal: 210000,
    status: "Belum",
    periode: "11-2023",
    timestamp: "2023-11-01T08:00:00Z"
  },
  {
    id: 5,
    nis: "654321",
    nama_santri: "AHMAD FULAN",
    nama_tagihan: "WISUDA 2026.",
    nominal: 320000,
    status: "Belum",
    periode: "05-2026",
    timestamp: "2026-05-01T08:00:00Z"
  }
];

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { role, username } = payload;

    const allowedRoles = ['admin', 'staff', 'wali_murid'];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak: Peran tidak diizinkan' }, { status: 403 });
    }
    
    // TODO: Ganti block ini dengan fetch() ke API Smart Pesantren
    // const res = await fetch(`https://api.smartpesantren.com/billing?nis=${nis}`, { headers: { Authorization: 'Bearer ...' }});
    // const data = await res.json();
    
    let resultData = mockBillingData;

    // Jika yang login adalah wali murid, hanya tampilkan tagihan anaknya
    if (role === 'wali_murid') {
      // asumsi username wali murid adalah NIS anak, atau ada murid_id di payload
      // untuk saat ini kita mock dengan NIS 123456
      const nisAnak = "123456"; 
      resultData = mockBillingData.filter(b => b.nis === nisAnak);
    }

    return NextResponse.json({ 
      success: true, 
      data: resultData,
      total_lunas: resultData.filter(r => r.status === 'Lunas').reduce((acc, curr) => acc + curr.nominal, 0),
      total_belum: resultData.filter(r => r.status === 'Belum').reduce((acc, curr) => acc + curr.nominal, 0)
    });

  } catch (error: any) {
    console.error('Error GET /api/billing:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
