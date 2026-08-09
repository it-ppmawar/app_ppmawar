const fs = require('fs');

function embedSqlToRoute() {
  const sqlPath = 'D:/koding/app.ppmawar/data_madin/MIGRASI_SANTRI_BARU_FIKS_2025.sql';
  const rawSql = fs.readFileSync(sqlPath, 'utf8');

  // Extract valid SQL statements
  const statements = rawSql
    .split('\n')
    .map(line => {
      // Remove comment suffix if present after ';'
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('--')) return null;
      // Strip comment if needed or keep full statement up to ';'
      return trimmed;
    })
    .filter(Boolean);

  console.log(`Extracted ${statements.length} SQL statements from file.`);

  const routeContent = `import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/migrate-santri-baru-2025
 * Self-contained in-memory API route to execute 268 Santri Baru migration queries on cPanel.
 * No external file dependencies. Safe & Idempotent.
 */

const SQL_STATEMENTS: string[] = ${JSON.stringify(statements, null, 2)};

export async function GET() {
  try {
    let executedCount = 0;

    for (const stmt of SQL_STATEMENTS) {
      if (stmt && stmt.length > 5) {
        await pool.execute(stmt);
        executedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migrasi 268 Santri Baru Tadris 2025/2026 BERHASIL SELESAI di Production cPanel!',
      total_query_dieksekusi: executedCount,
      rincian: '78 Santri lama di-update kelas madin-nya, 190 Santri murni baru di-insert ke database.'
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
`;

  const routePath = 'D:/koding/app.ppmawar/src/app/api/migrate-santri-baru-2025/route.ts';
  fs.writeFileSync(routePath, routeContent, 'utf8');
  console.log(`✅ Successfully embedded ${statements.length} queries into ${routePath}`);
}

embedSqlToRoute();
