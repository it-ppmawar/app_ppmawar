const fs = require('fs');
const path = require('path');

const mappings = JSON.parse(fs.readFileSync(path.join(__dirname, 'kartu-emaal-mapping.json'), 'utf8'));

// Generate batch UPDATE query or array of tuples
const tuples = mappings.map(m => `[${JSON.stringify(m.barcode_id)}, ${JSON.stringify(m.nis)}]`).join(',\n      ');

const codeToInsert = `
    // Bulk update 337 eMaal QR tokens
    try {
      const emaalPairs = [
      ${tuples}
      ];
      let updatedEmaal = 0;
      for (const [token, nis] of emaalPairs) {
        const [r] = await pool.execute('UPDATE murid SET barcode_id = ? WHERE nis = ?', [token, nis]);
        if ((r as any).affectedRows > 0) updatedEmaal++;
      }
      results.push(\`✅ Bulk pairing eMaal: \${updatedEmaal} dari \${emaalPairs.length} santri berhasil diupdate!\`);
    } catch (e: any) {
      results.push('❌ Failed bulk eMaal pairing: ' + e.message);
    }
`;

fs.writeFileSync(path.join(__dirname, 'emaal_block.ts'), codeToInsert);
console.log('Done generating block!');
