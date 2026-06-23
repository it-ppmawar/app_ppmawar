const fs = require('fs');
const bcrypt = require('bcryptjs');

async function main() {
  const asramas = ['A', 'B', 'C', 'D', 'E', 'F'];
  const roles = ['ketua', 'staff'];
  
  let sql = '-- SQL Import untuk Akun Ketua & Staff Asrama A - F\n';
  sql += '-- Hapus akun lama (opsional) agar tidak konflik\n';
  sql += "DELETE FROM users WHERE username LIKE 'ketua_asrama_%' OR username LIKE 'staff_asrama_%';\n\n";

  for (const asrama of asramas) {
    for (const role of roles) {
      const username = `${role}_asrama_${asrama.toLowerCase()}`;
      const passwordPlain = `ppma${asrama.toLowerCase()}123`; // e.g. ppmaa123, ppmab123
      const passwordHash = await bcrypt.hash(passwordPlain, 10);
      const namaLengkap = `${role.charAt(0).toUpperCase() + role.slice(1)} Asrama ${asrama}`;
      const dbRole = 'pengurus_asrama'; // They both share pengurus_asrama role but they might have different kamar_id.

      // We use a subquery to find the kamar_id automatically if the kamar table has it.
      // Wait, what is the exact name in `kamar` table? Usually "Asrama A", "Asrama B", etc.
      // If it's just 'A', 'B', we should match with LIKE.
      const kamarName = `Asrama ${asrama}`;
      
      sql += `INSERT INTO users (username, password, role, nama, kamar_id)\n`;
      sql += `VALUES ('${username}', '${passwordHash}', '${dbRole}', '${namaLengkap}', (SELECT kamar_id FROM kamar WHERE nama_kamar LIKE '%${kamarName}%' LIMIT 1));\n\n`;
    }
  }

  sql += '-- Note: Password default untuk masing-masing adalah ppma[huruf asrama]123\n';
  sql += '-- Contoh: ppmaa123, ppmab123, dst.\n';

  fs.writeFileSync('akun_asrama.sql', sql);
  console.log('File akun_asrama.sql berhasil dibuat!');
}

main();
