import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    let results = [];
    
    // Add kamar_id to users if it doesn't exist
    try {
      await pool.execute('ALTER TABLE users ADD COLUMN kamar_id INT NULL');
      results.push('Added kamar_id to users');
    } catch (e: any) {
      results.push('users.kamar_id already exists or error: ' + e.message);
    }

    // Add barcode_id to murid
    try {
      await pool.execute('ALTER TABLE murid ADD COLUMN barcode_id VARCHAR(100) NULL');
      results.push('Added barcode_id to murid');
    } catch (e: any) {
      results.push('murid.barcode_id already exists or error: ' + e.message);
    }

    // Add kartu_emaal_url to murid
    try {
      await pool.execute('ALTER TABLE murid ADD COLUMN kartu_emaal_url VARCHAR(255) NULL');
      results.push('Added kartu_emaal_url to murid');
    } catch (e: any) {
      results.push('murid.kartu_emaal_url already exists or error: ' + e.message);
    }

    // Add barcode_id to guru
    try {
      await pool.execute('ALTER TABLE guru ADD COLUMN barcode_id VARCHAR(100) NULL');
      results.push('Added barcode_id to guru');
    } catch (e: any) {
      results.push('guru.barcode_id already exists or error: ' + e.message);
    }

    // Add kategori_mukim to alumni
    try {
      await pool.execute("ALTER TABLE alumni ADD COLUMN kategori_mukim ENUM('PPM','LPPM') NOT NULL DEFAULT 'PPM'");
      results.push('Added kategori_mukim to alumni');
    } catch (e: any) {
      results.push('alumni.kategori_mukim already exists or error: ' + e.message);
    }

    // Add is_pengasuh to users (for guru who also serve as pengasuh)
    try {
      await pool.execute('ALTER TABLE users ADD COLUMN is_pengasuh TINYINT(1) NOT NULL DEFAULT 0');
      results.push('Added is_pengasuh to users');
    } catch (e: any) {
      results.push('users.is_pengasuh already exists or error: ' + e.message);
    }

    // Add is_pengurus_asrama to users (for guru who also serve as pengurus asrama)
    try {
      await pool.execute('ALTER TABLE users ADD COLUMN is_pengurus_asrama TINYINT(1) NOT NULL DEFAULT 0');
      results.push('Added is_pengurus_asrama to users');
    } catch (e: any) {
      results.push('users.is_pengurus_asrama already exists or error: ' + e.message);
    }

    // Add asrama to users (for double-role guru assigned to specific dorm)
    try {
      await pool.execute('ALTER TABLE users ADD COLUMN asrama VARCHAR(50) NULL');
      results.push('Added asrama to users');
    } catch (e: any) {
      results.push('users.asrama already exists or error: ' + e.message);
    }

    // Modify users.role to VARCHAR(50) to support all specialized roles without truncation/nullification
    try {
      await pool.execute("ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NULL DEFAULT 'wali_murid'");
      results.push('✅ Updated users.role column to VARCHAR(50) to support all new roles');
    } catch (e: any) {
      results.push('❌ Failed to update users.role column: ' + e.message);
    }

    // Repair roles for seeded and migrated accounts unconditionally
    try {
      const [fixPengasuh] = await pool.execute("UPDATE users SET role = 'pengasuh', is_pengasuh = 1 WHERE (role IS NULL OR role = '') AND (username LIKE 'pengasuh_%' OR nama LIKE 'Pengasuh %')");
      const [fixPengurus] = await pool.execute("UPDATE users SET role = 'pengurus_asrama', is_pengurus_asrama = 1 WHERE (role IS NULL OR role = '') AND (username LIKE 'pengurus_%' OR username LIKE 'ketua_asrama%' OR username LIKE 'staff_asrama%' OR nama LIKE 'Pengurus %')");
      const [fixInventaris] = await pool.execute("UPDATE users SET role = 'petugas_inventaris' WHERE (role IS NULL OR role = '') AND (username LIKE '%petugas_inventaris%' OR username LIKE '%inventaris%')");
      const [fixKebersihan] = await pool.execute("UPDATE users SET role = 'petugas_kebersihan' WHERE (role IS NULL OR role = '') AND (username LIKE '%petugas_kebersihan%' OR username LIKE '%kebersihan%')");
      const [fixUmum] = await pool.execute("UPDATE users SET role = 'petugas_umum' WHERE (role IS NULL OR role = '') AND (username LIKE '%petugas%' OR username LIKE '%sarpras%' OR nama LIKE '%petugas%')");
      const [fixStaff] = await pool.execute("UPDATE users SET role = 'staff' WHERE (role IS NULL OR role = '') AND (username LIKE 'staff%' OR nama LIKE 'Staff%')");

      // Auto-assign Wali Murid / Wali Alumni untuk username angka (NIS)
      const [fixWaliMurid] = await pool.execute(`
        UPDATE users u
        LEFT JOIN murid m ON u.murid_id = m.murid_id OR u.username = m.nis
        SET u.role = 'wali_murid'
        WHERE (u.role IS NULL OR u.role = '') AND (u.username REGEXP '^[0-9]+$' OR u.murid_id IS NOT NULL)
      `);

      const [fixWaliAlumni] = await pool.execute(`
        UPDATE users u
        JOIN alumni a ON u.username = a.nis AND a.nis IS NOT NULL AND a.nis != ''
        SET u.role = 'wali_alumni'
        WHERE (u.role IS NULL OR u.role = '' OR u.role = 'wali_murid')
      `);

      results.push(`✅ Auto-repaired empty roles: ${(fixPengasuh as any).affectedRows} pengasuh, ${(fixPengurus as any).affectedRows} pengurus, ${(fixInventaris as any).affectedRows} inventaris, ${(fixKebersihan as any).affectedRows} kebersihan, ${(fixUmum as any).affectedRows} umum, ${(fixWaliMurid as any).affectedRows} wali murid, ${(fixWaliAlumni as any).affectedRows} wali alumni`);
    } catch (e: any) {
      results.push('❌ Failed to repair empty roles: ' + e.message);
    }

    // Repair billing table corrupted asrama records (where billing.asrama was incorrectly assigned or defaulted to Asrama A)
    try {
      const [repairLink] = await pool.execute(`
        UPDATE billing b
        JOIN murid m ON (b.nis IS NOT NULL AND b.nis != '' AND b.nis = m.nis) OR (b.nama_santri IS NOT NULL AND LOWER(TRIM(b.nama_santri)) = LOWER(TRIM(m.nama)))
        JOIN kamar k ON m.kamar_id = k.kamar_id
        SET b.asrama = CASE WHEN k.nama_asrama LIKE 'Asrama %' THEN k.nama_asrama ELSE CONCAT('Asrama ', k.nama_asrama) END,
            b.kamar = k.nama_kamar
        WHERE (b.asrama = 'Asrama A' OR b.asrama = 'Asrama A (-)' OR b.asrama IS NULL OR b.asrama = '')
          AND k.nama_asrama IS NOT NULL AND k.nama_asrama != '' AND k.nama_asrama NOT LIKE '%A%'
      `);

      const [repairPattern] = await pool.execute(`
        UPDATE billing 
        SET asrama = CONCAT('Asrama ', UPPER(SUBSTRING(kamar, 1, 1)))
        WHERE (asrama = 'Asrama A' OR asrama = 'Asrama A (-)' OR asrama IS NULL OR asrama = '')
          AND kamar REGEXP '^[B-Fb-f][0-9\\-]'
      `);

      // Explicit repair for Azqiyatul Imamiyah, Adiba Izdihar & similar unmatched cases
      const [fixAzqiyatul] = await pool.execute(`
        UPDATE billing 
        SET asrama = 'Asrama D', kamar = 'D-5'
        WHERE (nama_santri LIKE '%AZQIYATUL IMAMIYAH%' OR nis = '2026050098')
      `);

      const [fixAdiba] = await pool.execute(`
        UPDATE billing 
        SET asrama = 'Asrama E', kamar = 'E-8'
        WHERE (nama_santri LIKE '%ADIBA IZDIHAR%' OR nis = '2026050118')
      `);

      // Clean up any remaining fake "Asrama A (-)" default fallback records so they don't clog Asrama A
      const [fixUnassigned] = await pool.execute(`
        UPDATE billing 
        SET asrama = '-'
        WHERE asrama = 'Asrama A (-)' AND (kamar = '-' OR kamar IS NULL OR kamar = '' OR kamar = '0')
      `);

      results.push(`✅ Repaired corrupted billing asrama records: ${(repairLink as any).affectedRows} linked, ${(repairPattern as any).affectedRows} pattern fixed, ${(fixAzqiyatul as any).affectedRows + (fixAdiba as any).affectedRows} specific fixed, ${(fixUnassigned as any).affectedRows} fake Asrama A defaults reset`);
    } catch (e: any) {
      results.push('❌ Failed to repair billing asrama: ' + e.message);
    }

    
    // Bulk update 337 eMaal QR tokens
    try {
      const emaalPairs = [
      ["djAx2cbxwlUTxQ6Yxi9H20y7wY7sia8XOii6ItrP2XWmLvqIRWrDf+RZcatf1fHX6as=", "2026050008"],
      ["djAx21c2t60EzuCaQZePNP6sI0LbPAtR9HTMukgcTChlaGsqoL7tu2ZT6gT3d4Pvj3Q=", "2026050009"],
      ["djAx3iCBlEOZpBDVcupVyNEK26KzIOVz8ToLDWcVA9SdwYucgNMMNqglORk7erPAjFk=", "2026050012"],
      ["djAxojdtob7mGSGUW4+xRApuk+ZhNyWGIWererzMlf7/f6adcMwTKvklp6SO4n9P73M=", "2026050013"],
      ["djAxgdgiCoEJ+hXQvGWPrIZjeM28uT5z1ZndX6AsYBgTh3AkRB3PFNnktnHIxcEZPO0=", "2026050014"],
      ["djAxKtV8KUcxdAqDuPmOlzuuyaVFMhCGzB9C1z/NyoACr0eJaJ8uH/MDOSbJNLQuaA8=", "2026050015"],
      ["djAxF43AmoEp6pn2CQ+X4vB3FSyPvAFkyRfTzOVQj01+V4RjYJWiA5BmvNKI6LhLg5Y=", "2026050016"],
      ["djAx7iZT13AVs6A0nky5izgRENa6YtEqrfGEuP1qEANAQbg4WroTTJgXD7Pyo1OvbkM=", "2026050018"],
      ["djAxEeyLaabP0T0I00W9Pn3LA9/PXMc2Hpnii3/41Fv9tLwAfAgNjz1QVeeEsfnCIh8=", "2026050019"],
      ["djAxMxS8aEKLlJbXZxlJU2dc9KSOheSjtLjGtUSzk+optk2mRbsbNAGnf5MWZAFCVKg=", "2026050022"],
      ["djAxM2JAgATgvVR3Nhs2phoIjv9CACZbcvFP/e97hfgYxJ3gUeDvX96bNBYkYcPFtEE=", "2026050023"],
      ["djAxxPcu/GFw6XUlt/p3YC0EDWOvu7b3/9g439bsAPJWyI7te9o9/iX6uOWIGHNkr4I=", "2026050024"],
      ["djAxO77tVu+yiEdqpNSaRYZaZJwvtqTSKSB1ETpQ+OhEekbLF1aLRxnBMh0cfB1QW6g=", "2026050025"],
      ["djAxMkixl6yIGshcb10BcwET84N9VchqchoRSVY7zN7PgL7Vhc2KkzYfMEJHaauX7KY=", "2026050026"],
      ["djAx9RcgZNQta7x9M0kDgvN0jBH7U+hRu5He0XqqL7f/9fYitZUvPrRHJEaiLdAiyX4=", "2026050028"],
      ["djAxH+Vl+zjoFv+kkxH9LSEXTO7XIbTiC9NgiVzDSLLZkcLijB3N+6LXQz1eVmL/rFg=", "2026050029"],
      ["djAxLHwFiafEkugHhuM43+wFh1BIYvoYZXGLnNO1aSL9OZpmnQ5tZhsCbzuv0VEiZp0=", "2026050033"],
      ["djAx6irQTBZIqnhacrDNWmspgBDoCzoYU+OZcwqurGdUkKGHhD+RH7Ga/y2i77kwCOE=", "2026050034"],
      ["djAx9SRpm9wLj3F23f3DrLGZwRg1+WmTFwaWIdvT9jTdLIFEagzFDhcsovkYz353b7E=", "2026050035"],
      ["djAxi8Irt3mgiw2q40QQr1frznU2hzAeMCel4Z6NJ36PcUAg8tx/Ww9A4p4OjiSaHXc=", "2026050036"],
      ["djAxMlU86wQeyzKoU9K60I6sdl1oJTbkEKw4TsJwL94DiCvYvokqRyLj4GHxAGSPdao=", "2026050037"],
      ["djAx4KdUvMH8Iu37rmRE3wXBLiNuDu4A2MwYfsZnH0fY5zX5ABznkVOausrIMUMhSI0=", "2026050038"],
      ["djAxOoZbfecy9K+VVSUXz+wAt9bnDC0MtsuCPjeymUn5MrLxNBXPKATO2Ax6oK6eKC0=", "2026050039"],
      ["djAxbyNYTVUBfXBF+KjXhA+7ulCZomUYvj/RQNr3ECPRo6rqMr+UgLWtV9FOGhwh0l8=", "2026050041"],
      ["djAxwenn0y6rjgQWVDOcSkiSSSUIVTn15w0Oya1K/yMs2xy3AsNfKMEd+m43zkxqOrc=", "2026050042"],
      ["djAxFe752hXl7uFye2BVNZLPLLpS6aqsSxDKOj9DdhAZfBrPoKFuvxfordG548MksEA=", "2026050043"],
      ["djAxYS7b3z8/OivPSNCKMLO1tNhDMpsVEnE1MI9n8jYuAYBIwIU4T618QNGSFL3QQBo=", "2026050044"],
      ["djAxAosza9dThRsQX3Gv8357BRTIiNF76X3GjN/uPDI8ZCvbKNUE65wigVBPPJLXf3M=", "2026050045"],
      ["djAx6LfNYcyY5PJ7CcshDhuvk2mudeWEcJkVbnRzigVnI9KNT7z01VPkNoUqMW6Q+uA=", "2026050047"],
      ["djAxxybB4wYviGmA9a7wZhp1a+E4icZTnTmmjnnYz8EOudeuZxZ7WwUB8LOOn32zs78=", "2026050048"],
      ["djAxrqUau6LwyfXdKU6j5Ha2ROCL0hia6LOiNAh7L1B228cw+43rjxpMpmMSaB/Y7gI=", "2026050051"],
      ["djAxfo0fcsl7emItxkYy0qZmxgKUlAivTiDvtA5iVcqqTdqFNI2bfDRFrs6OJMwUgt8=", "2026050053"],
      ["djAxnd9klYXAcIi7z73UT6PXvARTmb4K9eOB1AYLOmJifM/QJCapnqKhmWcPyqN+/4Q=", "2026050054"],
      ["djAxBUHYBqFGaDkOFhk0aOMA2rMcl90ZaZ1aA4dHcw+CUqhXy51SFbl9osfNgqNfiKo=", "2026050055"],
      ["djAxDceWXHFlLXxJshurzHUY8m9WLVTml/keyOGknlqAl93GoC/dXQpa+oKbGPO/TB0=", "2026050056"],
      ["djAx8J3iTXvWjn6muNHvngmusv3J2kHmAbaQu5OLpvE4dfk4qYcOU6fb+upxIb3k27c=", "2026050057"],
      ["djAxHpMxJNcS1hr1zElthJqaNEne43RpDC0araGwWGo9ROXFyQCw1keK++HZEXo5yH0=", "2026050058"],
      ["djAxG/ruIEuggh5oPnAafJbetDn6eFucob9dm62DXtszhDsSNzVzFfFjczFxj28v6UE=", "2026050059"],
      ["djAxVqR0L3qWp1c1pht7SgRe2H//RKmfvq+51vJSXHUMaICpuf/YycRLcbXUYqYWn6M=", "2026050060"],
      ["djAxfPMEgZTeeXZ1R4VMQ5+pL+iVY1YgPh0tFy+n8txFUQPPVl6GhQy208JPFxTMbaE=", "2026050061"],
      ["djAx0eRBzOHeX2D94bWgfhow7huLQ07uBTr618MW1aD8mFieLr63lsh2J2E0xzAu77U=", "2026050062"],
      ["djAxZWpDL0cJG598+Gv3WrWnumQBJxoRylDAfXfyDygBBiYcAH7YPvL6BllCwTDLNro=", "2026050063"],
      ["djAxL4UNiO4S/NUwr3FhXnK7VFHqYD2Ehw6sI6W5MlbdIX+nAW6aHIlrf5u5PH4lyIQ=", "2026050065"],
      ["djAx2PlWJgXSL9G0sRwEdFkrfgNZvC3dSmeyHlotyY90HwN7OfqjbdtsGEOmcmYEo6I=", "2026050068"],
      ["djAxZJOJI6ak8ZUu5rLj8TDXVPNYpsU73hwIwe1fB/ThaH8DL+7nby0Mm+s6EiKY7QI=", "2026050069"],
      ["djAxHryZnmeapKEL+ULCcGpdsO1dvdURgbQPqCPONbWqiQ2S7phc/fNYjA79gNPP1b4=", "2026050070"],
      ["djAxansjvZqpomFodBxPiOOBcXugarKKnBx0Yiis09sV7rmDYVeaBcqw5eww+RTDFi4=", "2026050073"],
      ["djAx9w9uPsSRl9RsuaR6/Klfa3HKBp4ajLQZ3VLQyAtQqjGRYiiXYWWtS7opb2wwi1c=", "2026050074"],
      ["djAxMTY4zzWgldsbHiJrSuzDfxVpbpcLpsV+u+T4tQp2ptelrY5bb2EnAy0Ak5CVysk=", "2026050075"],
      ["djAxiHGkCWKhiGX3QGfjL4IVTMmP9ZKpAcRmSWw7RWxhr2peehjtD1IyR7v0cU9K2AA=", "2026050076"],
      ["djAxbKSlysaLjKX5F5C8ZmCyOZJt0tpk6LwdZylYWpIn8mjXTksBt+eUPNZ5Lvvbfjg=", "2026050077"],
      ["djAxVyVor8dhRlugamfdD3QiP//n+hf++dcTcBTpW7Swd63Fu4vWI8g5VDMXkQGJ4gQ=", "2026050079"],
      ["djAxp1IyxqLZ/n1AneiOeHazGMyGgxUi4RN2ON1c9eBwXQlvkbQhGdPASkVi6KCKAuk=", "2026050080"],
      ["djAx631Dxm1T/Zjxml7DvE2xkoXl3CC9P8zOuWh0KUbX2xsl6FtDAG2dJnMZMrEHu1M=", "2026050081"],
      ["djAx+/i9l5Clk183Diw3UcTOXkqkvrHtgQnhf1tRXE1y+PVu8uj4J/Tbn+grCajiGIM=", "2026050082"],
      ["djAx0p7IOS4FEfpUchmzd7OxFBISFMmO8DjyRMfN659kyI1IUSNeRZJ9UhluFbpRlh0=", "2026050083"],
      ["djAxDxEGy9QY+0YhFENWEh/cs4w3beD/+f5nArdPKLSAGp4fSnezy0qIR81x/cPtYaQ=", "2026050084"],
      ["djAxZs0cDoBE0ggb9tqWcSy8BdgSyxt1fPNc8jJDIgrEJTsIVF19UBIFKh6jXlgz0Dc=", "2026050085"],
      ["djAxg2L32Sk0yiVowdQs+oqtI7eS592rT3tl+rNCfodmOl7zMIzuYgrV56+rCsOqBS4=", "2026050086"],
      ["djAxiG0aF/dFNIJm+YMF8apPePYUi5G8dMSGJeHutn6WnSIE9Xd6a+zyXjrV6KFnREw=", "2026050087"],
      ["djAxjLYHefWruVykVoC6sAt9gk77HcCB3EeJw805Xxx1wW+tHRdk4EqEdY06Oehn9bI=", "2026050089"],
      ["djAxyn+3dazkU/xaaOeNFPPucNajLjQpGewXaZq1G5LNJ9H0VNYv8CgnlzYDuhJJhN8=", "2026050090"],
      ["djAx30RN8Sxgb95HwKrGFjGLyMu8MimS2WG838IfVsYdhTWkz7e95dXGKoy2kwdNfz4=", "2026050091"],
      ["djAxBDUNu1+Oz8raUrZhy9qAapaNuaX9XNsbpip7YRZUwM2NFGGOCEmRXrHQzkzP0u4=", "2026050092"],
      ["djAx/XdZWtbly3OhMDPRddEVYsCXZz1V5+7vkI8LjHZS9vr0cWPE7NMOtnXJTYKYeLA=", "2026050093"],
      ["djAxG1WjCbLMYliepu2S/+jBpzAbp4DlWxwaHZs1f/Hxs/74BPQLtrkCOkkz7w9d5W4=", "2026050094"],
      ["djAxpjxfwDFJs6xsCu51lSJyrHpaIjfiSXxsSJe78jarY+FLW2TwFPqEBzNQw1RzPbs=", "2026050095"],
      ["djAxD0VLsf6kI6dwnQUHwCK6gJimg1t/i6xHgI5CSrK4Qm6lJr6gFNluhBJ7nYOW0K0=", "2026050096"],
      ["djAxKkz0sz15iQs0KLi/3CYfEVt86+i/BO4l8dxbcK181BkLp1nZQjjPEXeVcrs1RNY=", "2026050097"],
      ["djAxD5ZfFqVY/73NPLldsHJd1WM0Pn8ZbueW6Dvhl/B6OHW2We2atM/gIY6o3paa5Mw=", "2026050098"],
      ["djAxtqDumadrNGytRSdmAC4YVWmU/SA0WumyaPrJy4DuC4dLAH9hBU0V1wiQe1YePTU=", "2026050099"],
      ["djAxp5IfaxZo/v3x5c4efVnUWZh1BKM8Fzo+QlPgtC6YXWneoQmedJbq+5A5me7Ngz4=", "2026050100"],
      ["djAx0Rpxl4mzCukpabbYEyP1MKVclyKiBLDM+KcNCe81/rW6zqr9dMGv7GC4oD9KRS4=", "2026050101"],
      ["djAxk9FXWRZ1qay/dWgI2XNC+H7CPqRK8ollWC+DH9urHHTpuCOmIXqKQDwn55F+4EU=", "2026050102"],
      ["djAxQc+lTLPgVGJfhF5GqrMdkLVBRFO4ENUAqzLvTqX3AunceNqdGqThFXYz8rr1ziQ=", "2026050103"],
      ["djAxPQt26Z/DMTFRWoDcG4Bi2VCMG561w4uloagrSVheKxXJ0ER56G2UkDuYWc3bpL4=", "2026050104"],
      ["djAx5HUmsZs3rkvsqKdMi1rxduTdqXVSmaWGr78kD9qUFn8n/mhsrSDokfDYvV7Yd3w=", "2026050105"],
      ["djAxDASrkKwF4vE7MrMhbJGqpd35xYzd2MjfT/WODc7+Cq34PsiCTkT5GNNoPUXiTnw=", "2026050106"],
      ["djAxF2vcx8eaNMeOnz+dxXwCkN6DPaAUhMf1m/gsfdqWyaSwdC7l2DDJl8+2kr5KJtA=", "2026050107"],
      ["djAxRa/OzjuDnewO9FAlgLBE6nbC9a+rKVIo0Y07VgHdGtSxzsUA+yHtf+PPXs2Fza0=", "2026050108"],
      ["djAx0gneAJ9fBRUVJL+vk0LD+t4bPsR5xqvcvcaQamSVYjVNsuJVgvAzfpuD1Cab72M=", "2026050109"],
      ["djAxz6Ho8jo03oJQZ832qLVyyFyZ+NPoFPjqKIIzG/r2xgwH3oqchu1y3zGsXaUEZNs=", "2026050110"],
      ["djAxvJ5lejDNmqJWlywTkDFOfjW/twC19Do9xAwYq2ZbH796v5wy4wLEEvMkoEUQQ6s=", "2026050111"],
      ["djAxrcG1l6d5fLRhaFnqjLFQ3P3p04BwXYCza2JlU+XetIZIa4mHX/ivrEjoKWSO7tM=", "2026050112"],
      ["djAxkDX0XzG0ZraoI3fluuQXj6t9jc64CMgltjcw7T1vDZBwkx6pI9Y3Jr0JxWG5WcI=", "2026050113"],
      ["djAxPYSCEKFtfelmsHsaxKb5MlrdyFVa/maT3XhnTbPmoQXsgG3qmLhjNM4mxKkXuMk=", "2026050114"],
      ["djAxpxJJQymXW+4CAyRGEhHLFmql4R8SFmIRKd0e17DcFMp8yJQ2zmER3MgE+c+jkDM=", "2026050115"],
      ["djAx/RQnuCKrv4ouJ96i9MpwAm6r2e1E+zNhfHGRMp2xXKORzNbjL6s/FnAyFU/c5/0=", "2026050118"],
      ["djAxo5bhUjBcPuWx15OrBmMWWQR6ox4hGMLp8AcIW6pTQ+zq5mE2e+6ZwYwe6BTP46c=", "2026050119"],
      ["djAxoV/mGdWseVGe0hFyDpNBrcnVUbBZI1Zm5Bpgyr9X52QyI2oN1dWhtWKoaGbgwb8=", "2026050120"],
      ["djAxqQLXqiJjkicUuQ4ORA1fTZNlwFCI4YRuC+rl3iKOwL4KpekPG2BJFu7sMWtcnE8=", "2026050121"],
      ["djAxDo1cFJ3JHsExQC4tDRKRcoM28XUaE8ftD+h1OjlxfAJDfXNFb5vj80YlGIGJa4o=", "2026050123"],
      ["djAxKdiABAHnUC9E6RYf4Q4m3wCAvPVMc+OZ12zV8EqItMK60cWhWavrISUrZ1mPDU0=", "2026050124"],
      ["djAxZv6MtaEuXc+iU84rq4JMm1Evt+m1D4RiTS4wz6ezZvpCkyWjw/letMHZw/xn9XQ=", "2026050125"],
      ["djAxX2BALJF3U8IwC5YTl0makJOdh387Q7Btz+t542xGvTev/RDdU9qPTBwov/UJJUk=", "2026050126"],
      ["djAx+Ge/3Z/WBAVbNBRjXxlmJl1UeNKbsG8tLI7vJFBZPZ8E9dZAHDRie5r0pIeRkmg=", "2026050127"],
      ["djAxNvu4Iua/Yk9W/n4EWUUO4whHjoohhnkocAlG17diBg2PcgWq1ZesPhRA2zhHG08=", "2026050128"],
      ["djAx7BqBoqdB72G+LF29i1elpQAULcvsMw43OGAD55tQmPqgATZ9Mk3QUAkaoWxOTi8=", "2026050129"],
      ["djAxHw18K7a+ZpAsPLjvjGQZv2gXjU5F6C96OZE2NFzxOYs6pyB2TNlHj6ZapywT84I=", "2026050130"],
      ["djAxdRL65jRZ8JlKqNG77GxY1BFp9KBJcZtan97jHVVKDTr51NIqGo1vEjQ/zCJsexQ=", "2026050131"],
      ["djAxLO7Zui9bqLwQo/l5OykoJ5Y8BHShDetGaNlxJtbNMbl3M+e+HE/GromzSlX0sBM=", "2026050132"],
      ["djAxKLKJvcVz0kFNvFrV9R0Q443JRGXemcNz6exaFZ+UfCBAmp19vw/HilGzhaWZkY4=", "2026050133"],
      ["djAxKD3J6yLG0dPrGWUhFlDsx3y8JEx6wUEOTanoPlbQ72stkrSaaeo/YalMclusLUU=", "2026050134"],
      ["djAxORAUwzYLoW2s/nPhpmbTsgxX5FkA5tsa2rL5nAf4NedgooM2dyWiqA6GUXByqrw=", "2026050135"],
      ["djAxM9l79HOp7BWCq34VGt5Pro9BQNN163iGo2sr5EvjA78hgyBoGXj9HrUKB3AcJ2E=", "2026050136"],
      ["djAxWKqPelVKa8k3ybb/DdRRuhGtEJvptqPLk+SnTSQWLqDRiwlOfejdpmHRLjdtvf0=", "2026050137"],
      ["djAxo1g+42RY6DesD5mWc0wcqgM+pikIqW6TA+vuFkKqX4ykiJsXJInT3bdpLUA0ZwQ=", "2026050141"],
      ["djAxVpwEo3YScjnPZFYW6+KYupR0DxUQNx8VmaVGtEAVuXEyiFpmZlYdfjOjE3L2lKk=", "2026050142"],
      ["djAxEFrx1EiRiGScPNDNZIyA/b+ArDvzHMFbS6gdlXi0O8GCtAg3SqwBy/jMgfQ8bUw=", "2026060144"],
      ["djAxsgEVJOBS691L3T0i2bDaPV1ed6MUmyuAbLcdtf9X8PZkdQhwGfSPGQU4plNwfJY=", "2026060145"],
      ["djAxFE1y09shlf4DQYPJMDlj346ieU3XRFWR76dShypVeQIAwfUm7Pte/Vl7N47yl/U=", "2026060146"],
      ["djAxrIPQ8TZXFHAHx0SlVub3EN0g+i3keheJJDmdHzJUBtnsNjfdcrJejpyoyStxBaQ=", "2026060147"],
      ["djAxQ6T4tVfiS/3j4UiS8XnIgakPZV+wJt51nSp7IqIOLX/x3Xf3HQQ9nIVaMw854g==", "2026060148"],
      ["djAxCaqVhghtYz0Jyk63D2bTdlEtl9eMcgPsJJxh79YhpeUa4IyLfXkCHYyOuot9E08=", "2026060149"],
      ["djAxvDgjR4FH79JQS9uc5NaKjWZj6PiD+hgZatvKY0kRTd0Lz8Q24Q0FGIj1gExoWXs=", "2026060150"],
      ["djAxKOQT6Og7iI8RG1XaX+lJ9bfziPwjOLpMrh6R+eCa/LJx85QGvgiHSEr3eJVaxk8=", "2026060152"],
      ["djAxUo4WjV+VUIHDbGcxuxuJ7aDuCuMOzKAnVottSlMspaN8AgvoGsZzMX77GOh/o94=", "2026060153"],
      ["djAxMrRz56i6NbPFUHYGAh7eu7nbVMilJtMH1E0yClGdQVRrstU5Oece9VbAfZGtnkA=", "2026060154"],
      ["djAxNPPArVB6aowG52f5FCUWecKNvVTPXJmYnenpNaBCYG66wjkYmgrOfbPfvE5TpUg=", "2026060155"],
      ["djAx/nOVwJo80JSgL0BB6JNicKOSRPS4uyYES+GguTF9XE7e1jSaijYgJ5HZpwjn8wA=", "2026060156"],
      ["djAxGbcs3MAUGOmT52q1u3Mdzpd6OjdNOkbd44H7MEUpSB/2cLuo22TpZ4Pfa71eLZg=", "2026060157"],
      ["djAxJhCmSRxUxn1NNCRE1/owRRRWtTEXgEItZK4QAUsjMrg8ZF6fzUeuSnwHhkbfFnM=", "2026060159"],
      ["djAxBn2IoDP+MS7mqJArihjzIN4ds0LK+g1fo96XJ3Bvg0KacP+uMBf4zvdiSKx/guw=", "2026060160"],
      ["djAxhNe0/LC4Ljub+xso9ZyPo/qIwa2Nr8M8c9LUKultST3l60pp0DQxddTm3rJsFXk=", "2026060161"],
      ["djAxHLP5EUfkgVVjG4ktRp0goNCWJBn6fNdBh9FPhzNFSNhqSBk/9CPDpWZ6PwgMoBI=", "2026060163"],
      ["djAxwVrQAq6JuqldYjAEvXGvYI1tJ8c7YGPwM780MDjjr+t6UawODNthjnFuUK6o9Qk=", "2026060164"],
      ["djAxw7qAWw95C1O+4SCUpvNi846QDFcPJiiS6PobMDFfcIPGRtbJwdLrVEOat5UJN3w=", "2026060165"],
      ["djAxAeyAd9EX8YBoydlM6Ye66Hyz6eCop764MRTjCyfLyuhKUaIxdJXJEeSDK8M+HmQ=", "2026060166"],
      ["djAxLvPqonsLt44CmXRmTrVZV52UdpCnclHpPomLEPnB5uMw6z79CqWXYnf2LD16Vyo=", "2026060167"],
      ["djAxUsyXikuYa1N8A112o6J/C5e+bsUTJG+4Pm/+8Q/C/lGmSCTWlTX68cl8M7f9l/g=", "2026060168"],
      ["djAx53hwxUXKIO6b60VdIQrJ8f5tSrbGaXz/oqwwsckJybwNDzpWwCFq23zCJmEBJjc=", "2026060169"],
      ["djAx3SfWK3DFUvtGkwAQcF0cPpxj16BoqhEYdZW1/MDuiO84oziBJVYBjTQhgcJ+/34=", "2026060170"],
      ["djAxW/VLk5MMtwlSmCLqcoP91G3SEd5tJpt04CPBBd9eGmDdBCCT5kcV7KTtQpRJ5uQ=", "2026060171"],
      ["djAxfpyciYnaR23d+hR1CbkohpbzQ4w5FB0PIv50aIgnPZI7GJ5A0EMa2t/+xbfmS1Q=", "2026060172"],
      ["djAxpW6dF8c97jvH7Mez69hK5+U1wB0L5ls9bFj9+zqQZtZmyvxATn9Yh/34nEHa0S8=", "2026060174"],
      ["djAxENaV2t//tEDTj9wEqcJMzfpg4Ty7Kz0UXK+ptbAscRo8wel6rSzHrSd2rRocESc=", "2026060175"],
      ["djAx4q3qgdOrousPjKQsumHabr8DiCEN0jVdpF6inBudYF/cB9uqL/R0cBv+2nCio4k=", "2026060176"],
      ["djAxeoN2ROooAMPpTz3RxIy96BYNMzfh9Zx5fm0/NHJjk0WsMi8D9Pn14JTH2uXA0xQ=", "2026060177"],
      ["djAxdBeozL0bRToVnBbgDg1reUkkmgkzayZ/NGDzArsLqMsMdKCNvll+jLZik87hEF8=", "2026060178"],
      ["djAxyrp9R953LPzRE2AbtFgzgiHQso5dWGia8TeuF7BbWQFOhBg8CFKssF2ugoBteQE=", "2026060180"],
      ["djAx2RmKPXA5J0ESOdjpkCBvUD1oW1Hb8+D8dokS2CfnWOAXBBBU2V4D/6PQeI/D1+o=", "2026060182"],
      ["djAxWB+fq99cgxVd9GYDPMGVhPc4SrWg8ehC56V14E5eECFaRBGvSI1G1uk1Bh7y81c=", "2026060183"],
      ["djAxPgcZcyA0D9uplFiuniqq/25OU31wBHrjOPVDws30lGjUPZ8nN8AuOydNodkB8kk=", "2026060184"],
      ["djAxkDKyRX8ygFF6HQzdyKd4xuY9eH8OjtP52NJHbk3ksv1kKZYfl3NxMkykdOnr7gI=", "2026060185"],
      ["djAx37w67yDC+rN+2ZLGdJQa1iynU+GtyPIrBar0hUoLIj+QsPsEyTvo7H1Y50deTkA=", "2026060186"],
      ["djAx93qdH4Bjt8uqTXD7iAtlmbtrhrUH16Sj7yXlToWMVE3VLpdpWEHaeiifUb11Wpc=", "2026060187"],
      ["djAx9HReQ8JcVHJL0M9eK5/ZVZLVgcbwKoHM5IKgvYEvd0dzZZWwHyPaPhaksIO4H1s=", "2026060188"],
      ["djAxIZFQ7VKwtRXWyXi56aLSxo8pX2oGgxVuyugmfUXJx42+u/+Dj0qSvSuWGcG3uwo=", "2026060190"],
      ["djAxKN1vpznameBA2GvztQBjBEy45A6voQpVGOyVHarKMPqv1qjYowKeCwfQRx7II+M=", "2026060191"],
      ["djAxRwWRNTvPQdjsxz2N/mcQHrHjHmhG0htEvx748JoSl7jlyXoHvnBaaw3UiqUOvnE=", "2026060192"],
      ["djAxqNb2tVUWLcxeCUFmlalJXNXYHk74qciRR2uAbyAHC158DP9dDt3WOPoGnVMaPsE=", "2026060193"],
      ["djAxU/KwF8DRkpT2UzP2uHivjKsg25e6KIgYeGkTjEKNzDyvLBFmHowXAc7kVtjr7lQ=", "2026060194"],
      ["djAxqnKiucRdw7M3PSTlGvOk3VUChBxyPtKaosL3ybLv/wAP+9yougzg3dlGjekOe/0=", "2026060196"],
      ["djAxUZa9PF78HCk6y0nAssN4RksK6yHTHmspC9PrtfWdsBZoLx4bFfsGFoYLk104IVk=", "2026060197"],
      ["djAxkp6biHRv0F67O2n6TXXTO+L2QOw2CVlsiO47pp9v7LJ2SCnOUCtqLEqdx7U6Ys0=", "2026060198"],
      ["djAxyu4XGp861uvgBa5N6DShAlsMeDiHD2qNyk5sTjufNbVWB6o5g1GOCOBcdgJCEs0=", "2026060199"],
      ["djAxgZ1FQhqc3oab/Miue+dq08Yre/bekGJzK8WZuPgVWDg11R4DsUMkCie2G+euoJk=", "2026060200"],
      ["djAxO1UhRcxD0psVV/RQ54qWBYCns4nBu4TLOgl5/oP4dyI7S3E5hvAe7VPl7kvYlSQ=", "2026060201"],
      ["djAxPYLsKGMC6XleUlxvVzfzrj8d0e1j2FDx3KCIDvzktYyYz+GMCBE9WzboL/mWqO4=", "2026060202"],
      ["djAxNFL/5O6+Her6Kof/y1YZzWUIo5TkmOkutCYLjwnfJhUTH4+P9aW0dItTXl3BRDo=", "2026060205"],
      ["djAxkTWwsP1m54uDPCmjFhTxGraO5SosnjvG9lOGM4Czs0tyQGU3pCAxZLi/gNZJf94=", "2026060206"],
      ["djAxxxkgNiR485fxc2+HXI2Xl7ICLC6jl88FXi9QQGYqOUAapmTnGNzo8/vjclYgoKE=", "2026060207"],
      ["djAxMTnofqLHXqSM4HSDZ3KQl93b6wiEteC9PFCW41palgYQ9FBigI1RAcz9uefamjs=", "2026060208"],
      ["djAxN3EQHGJaaD6wff2atwPQP0+OHAYozF9phm6CMNIGtzdwSulLGNJY7lWSzeYn85g=", "2026060209"],
      ["djAxmuxUhyj/+4gssuZkfp79A7qV6e6hzFy//RnXRhgnQgtJ6GVOjXnKPhxJBrrxR+M=", "2026060210"],
      ["djAxVZFgmR+/yLP3ZvaVBJ2J/d4xMaG8hoeGhB7KM/0aM7rgCIK7AN3favF7au2/atI=", "2026060211"],
      ["djAxIe061jqBweqgZb7syi5AR7D7CBI8XkpoZP0iK8TlUxtSikZ/MiwiZQ2XmbqYYMs=", "2026060212"],
      ["djAxf5JidZ30quzN3Bnmasv2fYA/ZM6XGZYrLUBVfLLXpAFrAllmgGjVBG0nGiWGYpo=", "2026060213"],
      ["djAxIBjWTHXFcrmIrfyN4DS/kdmEaTKcUMDEN0/f+7QObjDObHQtkZqcVNpcHoXTwg==", "2026060214"],
      ["djAxXGUy1lJ9wmZlC/FC0/FW74hOob6he/d8I6T6jOeygJ0htrZcnMxOORzjSGoUI7E=", "2026060215"],
      ["djAx0RKUXeWvz3lSLcvNGCJEzLaDh5oRgOZ0Iy8UUV6xiubNHqoxzV1Zt2SPkqd5Zvw=", "2026060216"],
      ["djAx5XzxG5oo29dm3ChFGwEh7VyE9KG4D0nIYIcKzpNnVnAa68kZpRwsTJaGYg/x+Q0=", "2026060218"],
      ["djAxsJ3vfTCcKP0xAMiqdduDmSerPWoNWhLgSF1xbsqdZvinakBSKovED+Dx55YcoTg=", "2026060219"],
      ["djAx6WILVkxL/rPIw/ZxmT0WpG/PxN8Ek9QzSA/Z40fzppsmUawJcs3eAJxuBH1JMMQ=", "2026060220"],
      ["djAxMmZIWA3BmpnNz0JQoJ+KIKO9LHDO6z5SxmUBtin/IT33+xkuWPo02BiH37JYgRg=", "2026060221"],
      ["djAxWJ89Qf3tKW/EBZkm131C1uAQSPfrqYcVKDTE2IguKwj2hjZWJY0/TIqT/ki3KFU=", "2026060222"],
      ["djAx/mzxX1bmjv59Axa3XDvrFzM0wMlOvfALOws3K9kMy7sxQ2T2ZHURnMIzyVnJg6U=", "2026060223"],
      ["djAxZerKSgU5iVQtrq0jKbZvu4xoG8ksNdLiY5RlkwfCskhv6WxtdfFtYik82dubGYk=", "2026060224"],
      ["djAxPSzyBzBC7RjFJKwe0jSxJAGDJ2Njriv5rmw2sdSM754UhZq13lug0TdBoBJR/Gs=", "2026060225"],
      ["djAxFwR0It7fDaOkmcUkUo7SWp2iniIRWr7nmuJpCOzATYuFxj/6vC0eYM1zDqZECb0=", "2026060226"],
      ["djAxVl2kOVV6b5cDq3Gf7VuG4wK4YCOycV2THTIMdre0rn69cfIj5fgxi3ApV2d1llU=", "2026060227"],
      ["djAxwVo5OEHaidtwlB5hZNoP5h8ipyYbv+kxqFzpu0ww3ISffnoqpfTBnXaZm3wNnlA=", "2026060228"],
      ["djAxRDPFjmZzLP3+1tC1me4jLfF7lSeI2vhTge4qoViy+noGgyAoYApvlbhSOFHBRZg=", "2026060230"],
      ["djAxYC4C8J+Kce8zqyPxxb10XOdDH2DE+aDKIj/MEcCS+xd6dMUneU7P5Bv89yJf8vw=", "2026060231"],
      ["djAxoGpoh67Uv9BTOLPto7H1dnjq34tcGhYxOAUHfnm2ONcfaPg5Vl3DM+VUTeLI9tQ=", "2026060232"],
      ["djAxpk7DDrznvCXh7heRVqVA0v5sC68a0j798deLdSOGWG4xdHwHJ0ohesAvKWxojKE=", "2026060233"],
      ["djAxKCg+8jnoudxBeQRiKIOTuyawEgnOINZKkVvjcsiyKXtxPNnt0SbYNxRmU97VMto=", "2026060234"],
      ["djAxk/OzpnkumyXmchZjHrFP1qoRy6aNFYYetrW37ylL4QLCjowMPQgO354aEjeJaLI=", "2026060235"],
      ["djAxMCOAPvFWKXupgMTyzzGfE7tzgFy47MXrsxVQkBmoq29NkI7ObgJulCjzEFX3FBM=", "2026060236"],
      ["djAxO8zaX7rBuSKkko9LVmQunMaJE3hESLufPAxqYGYjG/LciH+zTphxcdf+DELXBxE=", "2026060237"],
      ["djAxFh3CViAJfYh1TnK8T1WEbvwgAxXKc+tcu51Vq4MufiqEAFoKEaDHgssrIfrgXpM=", "2026060238"],
      ["djAxvDJBoXVSO/sN2Ai6Cw9L0i3/YJpk4UJFkoXfHMZSzyHIflbr6o5fBTOyzE/5BLY=", "2026060239"],
      ["djAxLaomVbFfpkWfqCZ6HhYeJ1jzZgioWmZbfTSpkRb5qKIvZzq18z9j70+L+xYm7og=", "2026060240"],
      ["djAxYrXKEpjH1m/xGqGuB7kHspUZZk/m5tXZIB1zTK+7aC+ZF2XoDFV7VXR0LH5Jsp8=", "2026060241"],
      ["djAxFmNynZwT/Ax3q0enh62oX6uzsi63FAz4kH+w2Z+QvRZ9V+XjpUF7DUHdmHOiRIk=", "2026060242"],
      ["djAxoTYVVP+tsJA+O2aCxJF1bW+RwoCxpI17xfQS/dor+3pG47OSPWvKXsWJix2upuM=", "2026060243"],
      ["djAxqxPfcuMk8UaXp4WXTSk0wee7QwTrCOH7KLou9rzD6/+zYKXMN8v/8w/0g+EqVRQ=", "2026060244"],
      ["djAxyIG1ry++0zLgLq+p5Upd0XGg9NA1Y6zXpWo/DbY6fv3O//QZvkd++531JXj/EWU=", "2026060245"],
      ["djAxIQB9CelMD2uOE64fpm2zSPCod1qkhkJgGfABNMfZ3Az0PW3G5cYH8amm16QnLa4=", "2026060246"],
      ["djAxmrfXXSLGXNK9j0i11G7MU1v6MYkhsL8Z0AsX+eTYJIs5TD98Rx7PUjTFuw+Jezs=", "2026060247"],
      ["djAxZEcmcMtALVi6LqhY8Z5mufwstoM90gwthe/CX8xqpHsrTWo2cEvo4w1ioMZO/zM=", "2026060249"],
      ["djAxR1IwFnAiTl6jC6NsH95O7oEZEOQ7ldkgmA/lXM8XcIIPX7aZ9s8I76K4P1J29Yk=", "2026060250"],
      ["djAx5hOA6rmSGpF5jv/p3grwHdOnRaRAhWAHugvDwHQqGgHy9/9YbaXJMY3iySEJ/5I=", "2026060251"],
      ["djAxaa8iNq0zN+YGd87gs2wQ9ypd4SFPxymWe965PXlf65iW/N0z5bDOt2hF19FRbuk=", "2026060252"],
      ["djAxoq5yz7XgOKfabf6LuxZFlG0KYlWeU2WorSqvNhVhex/5m7BRV4ioU12FrwMJRYo=", "2026060253"],
      ["djAx76ABGN+++vvkWhSQ5MTbojtU70UO9cSjzLHnU7Je+hlrDq9tE2olSdga7lE/ELY=", "2026060255"],
      ["djAxHqSou6Mfy5hKCz8BH2srRI3L6SghQeKsGRzSOTttdNrLbEPWs7Ra94LD25dspOs=", "2026060256"],
      ["djAx07w3uUon793Vn0Awcm03ZkOxI77QFEMGAxvGqX84LgxCTs3YGiKF6j1glidGdn4=", "2026060257"],
      ["djAxvyOpVF8fpYXhqs23SImZ+RQITePTrmg5YAgfCSgxqOYEjMq5u+zWLIURaVmLLzM=", "2026060258"],
      ["djAxzMuBHL7nxUHkhZLnqaj4nM4uu+xM6hwsLe6UV/b5h4fYAVbPFqHDp4XLHLCV+V4=", "2026060259"],
      ["djAxVADkFXKi2TEr57QiaRKJ9tQVZLcNCs9584rKIElYDhU33p3BbJeXv175eHa9YJ4=", "2026060260"],
      ["djAx9TlmOzKJb9hN/z8Nl79Aey3GAir/1orBj56pilWDd2L6WjRME/5kAwADm0i7HGc=", "2026060261"],
      ["djAxAKDsCeRHg+sinfwBKryVxcZyKvVYCm5qvfiZ/UXq54r37Tb2b1QDegkixU/C5YU=", "2026060262"],
      ["djAxC+q1zRyJS9xFYBEmnxPD64Uqg/c0icowH37RSiLzZy3cHlptuAg4JhuscfLLAig=", "2026060263"],
      ["djAxRif/HYarhS1s54FBFE/w0aEtQRzFkMk4luGCHpOp+SvgxsCRIrIqKPgwJ2si9jA=", "2026060264"],
      ["djAxYlTA4GanXdVfh5SynTkssJmIo20YuubGE8BCDAplW5tJbTr5zSSv/Zamy+QDUsI=", "2026060265"],
      ["djAxgzr2DHOSU226bahgPGNzd0+h+8l9hm2Kmcy1iGdF1ogp5WSKqBeez4FMNpwlCno=", "2026060266"],
      ["djAx4DMjzqD5kqNKUxUslugcWVPG9ZCvxgSwLtqtLZ5qil/hZR0exnzV/kgz6Y6yADo=", "2026060267"],
      ["djAxJB2dWt7h8+a2MaxIrgD+m9DO4QcxutP1PYE/1J79wWjjJxTVuk26QrMe7m6AyyY=", "2026060268"],
      ["djAxouLdr6izrruIwIPQV2stzqWqL49RWO/uh/lzQP5S7NR4ZYlRcW6Z6CI7CRR+Xo8=", "2026060269"],
      ["djAxCz5lkfJubUKbehm42MhZp0bo0G2D73nhx6JEkqDOtHYjd3YgwVfQOQHAxnC46as=", "2026060270"],
      ["djAxSYjK3GeTq6jQ7hNqzq2eyVqbEIeappzUR6HDe96DS4cdnHDyzQOYimS4q0NdHhM=", "2026060271"],
      ["djAxu4bmi8vZvqQNV+u3ZnwPO/jlar9ZQXCyS2YACkaUPjDEGFjncWCTGwv3tUtz2lI=", "2026060272"],
      ["djAxpjQHTF1i33A+ajA9GgM2BaLPXVL+5o/ZExpv4Gdx82X4Y54C9XSCwxo80EwRho0=", "2026060273"],
      ["djAxGgM/pIWJZAw7YwPr0ueuD1yWZL4dQ0/FiNO0qw+JdNJgDre7cl4JyN3dCIWqD0I=", "2026060274"],
      ["djAx1YRYOXYvnB9S4Owm6IeW7c1/yNTKfZrnpL/ot8TDCniIupambFdSHcaT5yP/YaE=", "2026060275"],
      ["djAx6CND/HfJM5krGgte9OtJkfFaIOSFTrgR6+DIVRmGzKWdSKRyfuqpOU8bcGAv6b0=", "2026060276"],
      ["djAx+rYIxjPDoOlu/naPQfNolOFMkGL4kXd24A4TUvwbflTeDD5fNI0MMkUbqFMvX8A=", "2026060278"],
      ["djAxMEDgrJ+4U9z+kT3uL1kQOrC2iFI3/xioHfoLY/rhMkVSTcZWgYjzddCHZNG8Gyw=", "2026060279"],
      ["djAxUIS0IKYBfX2ilr0MTZhnCT6/m/kGN7IikxW1PVE1Qzk872cR3LFADAIOyKsXtl0=", "2026060281"],
      ["djAxfDjWh6ZF9dGP8pyMzGUu15FWtXQ6gO7qN/a0w4XvZXYC1VM1j2BvALPpTbtpPPM=", "2026060282"],
      ["djAxQoNypkR5Ch4V40iE/BbPGBuVpdx0NEKLEOcxbCv3Ccaw+4kSPTtuWEme3UzHgvM=", "2026060283"],
      ["djAxxt4+lfyrlF/ECzF83O9oAPUKY0tN77bX0oO/it+VPiHnuF7qYlWg6E68XNLWzJw=", "2026060285"],
      ["djAxwWWH+NIV85+qEgTtooyq8IPaeVjiP185Ckd5ccsekpc/K7ONBxoUTR698NYSFjo=", "2026060286"],
      ["djAxcbbq4b0lwc7eVrg4W3WdJlN/S+4FiBqDnhX9faN+x6Yt7/k6dWdZFSyCL1rxStk=", "2026060287"],
      ["djAxOHcq11AVZkeyuAcn6+pqpxEvMtWsdWnysYhvuuZBvfYQqtx32O96/kNjgyEjdR4=", "2026060288"],
      ["djAxq3Jv0W53QRC0L8blpkv6cN0uJi3tV43lBfWtFiJfp7/HaAh7I2fwfou9t4X4kQ==", "2026060290"],
      ["djAxEHI6m0YOTfKZiXB0U9+BIPXjlT6OryHpv3BQtwxAEjVJnXIzZOXqwJNzeQVKAp8=", "2026060291"],
      ["djAx2+l0G7ZzNaNvJe/3C4QFDoyRiuSH3c1TlUcLBqk/5v/hiBG1CDmm0et+onIJJTQ=", "2026060293"],
      ["djAxRO7wgTGO/62HUYnOYfyU3IABHym1XtQfa3ZSGPd2eBHmysBpB4mYAeqYSHhhrPI=", "2026060297"],
      ["djAx7JzmKl4w4rFmjVAtjs1FzQ+5NCr/7iByPGaEwOXTK2k9o3zRUoDPJSci+jsf1bc=", "2026060298"],
      ["djAxluOZB+iOMdt5DzsVPIJnIPICHyIpwM+aHDuGDMtIbQ97MjkkzWX2Czr1dn/lQ2I=", "2026060300"],
      ["djAxKdzMlGl2TDUB7R11nnjCTHq2tVbwwe+wXYKpa1YkngWX5F7wOoofuyE0jqh2R7s=", "2026070301"],
      ["djAxxqZtdFfaXRTifSWWg9mXnYzIuyibKAbX6vSlCI3bUphp/LJRmvXueNvcSI+8gFw=", "2026070302"],
      ["djAx1woJfl3obB/jfIDt/eIogBCE2oKzMgu4uIv7ZJO7NMxnSTHXw9TbzmvXabrFkbE=", "2026070303"],
      ["djAxni56O8z8mB/j3HDqisoBQR0SKLivUtisl3mwnzMcgVMSNGOGlr8rBtPg50e+5TA=", "2026070304"],
      ["djAx5LTy1S+gMT0UQk+Q7zcebO7drNk6VaCGq+hGlH9EBcIF+DCwOFyDsEjmS9bPsVY=", "2026070305"],
      ["djAxtF9umBQGUnYdXm52WYcfSheG4SbBkFDfOs8Q9rag+13fJgxQNdjoLkAdo6KMXCg=", "2026070306"],
      ["djAxCWmk7dNkXkAIPxQmxwV7pYypSiteHrqcps9VwlHw7g/uaBFiN53CwSGpqkoGBNQ=", "2026070308"],
      ["djAxHlJZplKThN9GmRR416g8kjaLxGmsraDmnypiOhCeEcI35DTy8ha2PtOvUf3Wk1U=", "2026070309"],
      ["djAxq7l0vFYpEi8UoN+MSlgXPW9TybjxWmrtCDPH4bJGPdqv19NZSFp8PB24hK2T2DM=", "2026070310"],
      ["djAxXlb9pfBhsyp0NJCVQv3v+ivaaVokXBu3ceN9shVFewVEQ+vMa+1FvNCWskIKH/c=", "2026070311"],
      ["djAx7keJrYTXfumfgZZQhvqguop8zRotAVIF+Pq8xXt9eQ85VWomFuD6ilWmoIhmkJQ=", "2026070312"],
      ["djAx5LwlWzZw7jsoCJseqEZUsfMYSc4HzUjoeSFQCcIb4jbz8vowztp7ZL+UjMaUFNg=", "2026070314"],
      ["djAxfBoeoa52E2wDGnlOtf+6R33hKWmQFPRZOdPP7sgdmB9i1bnWYb+UBRsUEcMeYvQ=", "2026070315"],
      ["djAxxIQtnDdY4PvCOPlIL+f2+qsjngNXLOIJdv1iGdrE9BKbTQOl3j0gXmT1SmjJOk0=", "2026070316"],
      ["djAxy+inW897qIjVNVcn1jLe+4KKyYkN2KG1ElHDMaxSVkcv4diIVmmC5dpSSfLztUU=", "2026070319"],
      ["djAx7yUXlfw/6gLNNhJz7S18HLToctiwFAIyApxiMPxvWs8CjFLqn38QL0aYrB2Ok7s=", "2026070320"],
      ["djAx8Pjq1hNS68dNdzeUzt+bfc6vpsqTQV9zbn3b6DOzyoRc6KxYRB/oG7Y4ySfarhg=", "2026070321"],
      ["djAxinHXSzmuniLN59RAhykxfsCSuAMP9HFJT8Zty6qCmRG7rSuqSoSgb+xNkKGiLRY=", "2026070323"],
      ["djAx8UgcpCMSyOwX+O62JmaqwggJzXWnkRh+H40eL1TbfaXW5gCOpfGd+sm4WBnw1Og=", "2026070324"],
      ["djAxMsofMRZ6PKJdDu9sXQp3Wtar2FpAg47x4xmy6Jt7zX1giwuTSge+t3DcjdNM8ec=", "2026070325"],
      ["djAxY23rMZqTo4ojGhYsJ1vyumxtbxtWVT02Ep0eMtbN/fiUJj4keErZ6JrhnfIRIro=", "2026070326"],
      ["djAx2hjqQYevY4i6xxDobOlQrKNXZrOzNkdGeoUSPLqHaFCQmk8PyUNq1029k7zatf8=", "2026070327"],
      ["djAxjuaFoUWWhC4Pt2OBFZmZBs+4Q0a1x4AHjI/GG+i0JNIV7U9jhKoThB+gvbytRM0=", "2026070328"],
      ["djAx+tw2uyNTi5K059uYDyR1htfQVBWWLCyq8l8tHDel12tt4BiuJzHAetZ93ixwdvY=", "2026070329"],
      ["djAxsP0GHl7AG8kdEQ4up+cfvXm7sU9DT5aewA+3ca4+1UdSv+Q6Fd5BH1HIt5/zqlU=", "2026070331"],
      ["djAxnbyfmVlNIyryXS2IVd+qi+1ZWAtFHEOT3EwQ8/hSR8nV59B3SCLsN8UejXdjv8U=", "2026070332"],
      ["djAxsyRvm8m63+NKs0Fl8YXWdUcig6/S5o8qKE/7TUAZ/jXs1aMuvcyCHZ3WXs8ocPA=", "2026070333"],
      ["djAxm2A8Hp8bNuiGsbIWfwVm9Riem+BSZshRb7ZJ5/CxEs98sf3g7OqpsIsg47ECYbg=", "2026070334"],
      ["djAx50acNMR0kZ6K58Jxoxsw2ny1v51kRP9QNgyq1BvST26Rfmo3seubgqZb1kwnCXc=", "2026070335"],
      ["djAx82AkTpk8TDMlNDmKFxcXSeC/wSIodQc/jVTytdRqoifCvlWJ9rtwlg4iRyICwHs=", "2026070336"],
      ["djAxaEdShGexkuGlOuAdz9IHe8oywr/sw4v4Ad4s9Gc0GrWmFmgwyP6gXyyLm77vyY8=", "2026070337"],
      ["djAx+KiRnH3ea2OMPQ4IiVBnG7u4DsJNcfiNnR4suPSGE+3ktiPRdqbUVOVbsGmULWg=", "2026070338"],
      ["djAxEGru9RCWt8XdcdWn126LcziTqrSFdM7UdXq9crXda6hEqo6cv0iwkjqoCTP6LdE=", "2026070339"],
      ["djAxe/29IaWaUslHq73HRprONta9SJs6kwKYdx2LXWWIsvZ2EuWlO4PbVdVUTnoTPNU=", "2026070342"],
      ["djAx5FUStMVo02VpvZJCEN0vmvyUk5MRL8TEAd1EDd4yzZa062lTYjV9/mAksLGnirs=", "2026070343"],
      ["djAxNAwdTyQtptuWg7OZ7+21TpeFTIeGdED7MAfkAp2TcjMKP+tUHp4ZlwpxTqFDLiQ=", "2026070344"],
      ["djAxNNPCwlt6oTJZuj3iOvWxAa2HT2lpXIktpiobb6Fv9RxIBKhWaWjlfGf4QrfO4lY=", "2026070346"],
      ["djAxdzqPhAjuCNHrqpCzsDeYSzaJFXTJBGHomLW5IBXdt9usaiJd6rdng9KpXX1V5XE=", "2026070347"],
      ["djAxg28wLS/m+zVZ7aZVE48ULlQiZkSE4Fm+Ci3pK+vAGqvioPke/hsmlnIB3HS5XiY=", "2026070348"],
      ["djAxL/HviQ46J9e5CLFMTN+EJ2MPYCBnVuuGXtUa+IkmCurpAHORJMkoDmyizulev8Y=", "2026070349"],
      ["djAx13c92EzpGmP+0PIOHt/sS2xPb3gZsy6oTMDnbAVnpLltBj3qTzBkQr9kXz7OVt0=", "2026070350"],
      ["djAxGriI4QBkLfPfGgQOInADU+iMnV/uvEm57FPStlATXfRDQeNzFrPmmZbQKfNe//o=", "2026070351"],
      ["djAxTt9mun5X23FfdeN5Um1/grfCmUWf+0d0NdyZjuiWjIyrgKo9UzA1QoUraiNa7X4=", "2026070352"],
      ["djAxTsmlYZYyYRvCm7Nd/xAe5bGF/+m2LHShL1AQCfmMDnoD8DTOkkJAwARpG2xMaYY=", "2026070353"],
      ["djAxD2auqqTFRAj7+zXPd+BFxb/7NeODtSMuxkZMBMVIn4DiBe7/JhVzilOyMrCv8TI=", "2026070355"],
      ["djAxzYsyrEyCyNWr4FtB7nj/89iVkeKckS367ccDgRotVYx9gfdEiMPfX0EIhBjWsEM=", "2026070356"],
      ["djAxxk6b3zoQZug0+CUXeK/7MNnxVynnVLzeQ0XKN8dHAe9AjM6SWsfrxv6kXHqOUAo=", "2026070357"],
      ["djAxxGeWqhgJ6G3it6SUfqorVJwcRbYRPmEAhMAyi6Ql2qZmRvtBMe0GNFYZwYLHnTc=", "2026070359"],
      ["djAxbab4P1/H4/8bS3V2WRit9Yuiy0Fnc9a7GeMBl8GU8qTWsbAW+c7YVDvWbzwm3uo=", "2026070362"],
      ["djAx6frJz321UNMYmgAdnDfQP5OpIfS3Iaq6rksvf1BR8UPmyvUOa9vlHrN5zjMGODo=", "2026070363"],
      ["djAxeuHy5Ced1nykxv90J4qvhshYrBcKfAJoy413pvoVqh7yTkAKf6paY1bhBUgFU3I=", "2026070364"],
      ["djAx7QejgLXoSGfZw+bA7mf4aB5Ywy734yTatY0gYxq5TtbRD3z/wPmsfs5ZeYCBrpQ=", "2026070366"],
      ["djAxtm26dxTK3Vw9Zek1WvpLvk1duQk1+kNYe1c9Lb9q6JBUFMKVV0nd788/spGEx70=", "2026070368"],
      ["djAxsnyz0XcmvS+VqnjhY/N5+8N01CTLqtFrFKntLEhjkMnEVW5aa/IvdlnM8DFZk9c=", "2026070369"],
      ["djAxZSPaJLlIM+NUQxanACdTGHb+HSv4VVFP/pwlQtdWwrX+WyCk7hGw2ot7QQuhjWI=", "2026070371"],
      ["djAxrNcQNVETdMycKC1vHUxpYaLuMP1vzxGHpzHEdEmkOH5z+4P5/KKiH9kpxuRxxmI=", "2026070372"],
      ["djAxobPSuV+ek9YglScyXWHq3phtqr9dT2sVL+NHhYpvffkGUOlNUw4229PUcD9k1HI=", "2026070373"],
      ["djAxVo/52yG9pGu5En4oIWiuz1EJxI1zIrCglnAeT8ClvPdNalV/SuDj2gNKsPS4LWE=", "2026070375"],
      ["djAxc2Astd0RQnoi9gbF5vLEmLiJKlxy0srP/znPygAH6arJDN1r41JPi7WkiJ4znqw=", "2026070376"],
      ["djAxVTX1LiFZUVyGucsxDDYxhBOc4iAXwaFCPEGyKPv6Tpww3EH6H8CVscRfY/ni/i8=", "2026070377"],
      ["djAxCAkJTlbDX0iYe0OpvEphcvhYjKFjF7963YD3nOI4fgBy0vcjqfwfBqTNGZ/F/Uo=", "2026070378"],
      ["djAx+xwqM7PTUI2ECe/cJV88GQrhPn4FcEr10s8mh91EepYgJSI6ReXmodLy3Qkx8wM=", "2026070379"],
      ["djAx3xYE2/+MZPaPwdV0gXsUbVGuc0+3lxx86nFiisQgGyU0lUaX7TOiYOwkGNjAbMg=", "2026070380"],
      ["djAxG6mPTCbouluCpcQIcitu2fo+ldRuyohBZzw29Tqhs8h51mMofU3PG7y0q0WeVqc=", "2026070381"],
      ["djAxP4XlYptTXoDq3yg3Q7DmNM8c+t+eyKeR+71Oo+b1AQGbZadWBVmcjUW64GDad4A=", "2026070382"],
      ["djAxAG9dKRR4bdjTHaoEA+Z2OL5IVI3li4YHzvDBqOjwG1WECjrnWoT7rTHb0NbeRR8=", "2026070383"],
      ["djAx2IGVoPBWHPqCbFAYpsnVrbcK8KDAxiqTUswE5p4E6leF93FnAtQvKNDaPQCStec=", "2026070385"],
      ["djAx8lcIq5tFl9Go7O6fdjWQMPECYBYquEq9oEzLJacANIN8NHwIJOBI3JMiHleDor0=", "2026070386"],
      ["djAxo5/Qo2y49vREoRFdvw69YlYrR8XOBdIVH1x8SjtjWqqMhXke6HMs7UMGbdu8tPI=", "2026070387"],
      ["djAx/VeOpC5k036Saipw+ZifEVwmFgPXF1pMSisflU4UCxCzshMZgR7fzYy4z5obyYs=", "2026070389"],
      ["djAxlxOpbNxKKxMzklpjCVT7DV/N8WUgCyeRK2vyfDEAWaIygXVv29VdzAXJHv6C0vo=", "2026070393"],
      ["djAxvAg0Ez/SF05TjUVkMuQHPNVfgq9XCBjgXxhGl9uyEmHBfTGObmybkbAKcU/f+JY=", "2026070394"],
      ["djAxa+woId4HQY3OjZlP7TXdu1vmaC4yCT8Bugj3s+cvBTIfs0XO5AWH+k9fcAGsN1c=", "2026070397"],
      ["djAxy+QELdG+R+fP7ke4C4DySAmL45uehcdBB5MRQAisPd/6/P37tJeV/0mzLU7P1jw=", "2026070399"],
      ["djAxs7/6VoJjD62bbj3hSHQInbHIdJnGkiMyQzwHAxToylVFs9cwmg70k/644TMi/No=", "2026070400"],
      ["djAxNL8De/vMvGu79YWOqT322S2A3leZxa9zcbYS5/AnT6KJ64WdpGBo8SvTwKM3+tU=", "2026070401"],
      ["djAxLB53x6dewIWO3BTEuuQSyX99BqOTNKyHOOWLGC3GtTFsEUXCsqVzGwK5nPo68OY=", "2026070402"],
      ["djAxxIVZEHbB23Jb8hXjLLs0DplslEZ40wEKrg60jiK/61Tvs+T+l05b6xzFMF47wdo=", "2026070403"],
      ["djAx0hQ3c62FGTvmFh2ZOmFf/mWr9kD1E6rtAiHFFeiAYEh+fF+SFc7CaXu78EG8hbw=", "2026070404"],
      ["djAx2ArZl7dTleef5KxNuzAncWBhbf64uVhXtFCsmMVOHTDkKKmMa2rIgv0x0vUZXEw=", "2026070405"],
      ["djAxw72mAN9YhWvpII78f6C4OqsyUKFwC/cOIQLMxSydCjC7tFY2UoghAALaOYA2TJk=", "2026070409"],
      ["djAxFzwK2C3kf7AQ+vir3gQX62es+6QdCxfnjIXLsUT67kzxFpBOKQKrYQDRcXWd0E4=", "2026070411"],
      ["djAxTHgrZuWDlmqE0EQOhC0tIzGP+6IxRW61OKd+Aw3iZxMj7xf9XT0h5JP5m/jZAjE=", "2026070412"],
      ["djAxAF6GUBAi6MmL0zwSWDuaioU0NHX78D7YxmeB5L2AV52DjRw1zqJjYRccE30uydI=", "2026070414"],
      ["djAxnzmGobTN3dnlGxXwNNB8piQ5gTuUyEZD7XD55mTGOeIYWqfsZy4DO27KGhINM3M=", "2026070415"],
      ["djAxnI2U61Yg9Ce+NVAPfSA4eSi7DhaAiGqHGAYq3dfaUWKfbisEpoogYWd/jCQ+ZYY=", "2026070416"],
      ["djAxyHm7SP+WZ/nXS/HUQJjlFHsWC1lLSwiLrjpQ6sxzbPzLF5IOyuHE2ttZEGckDgc=", "2026070417"],
      ["djAxFqEeSJyszkJdKwiMKQC5T2hDS1yYSwuDy5bFPZUA409FgUYHJJm635/+pdlmcT0=", "2026070419"],
      ["djAxesS4PkP5sOocyuC7iNmZedNIl4P/uhQarDMVWeUNBle/Co5o+MeAN4XQYYaiYAM=", "2026070423"],
      ["djAxx2hXBt/qyygkv2v/Zy2F2jHnvrcUxOl2Och2LskDnEMD0zKSPhhDnVYdls5uI4s=", "2026070425"],
      ["djAxbn9hMLSsM+p9t9hPiQa7n+2JP/i5t9CFF6EeBdqthkR4TGu3xdBjzLrIg9FGspc=", "2026070429"],
      ["djAxqB1EtM8+uFu2zGMnBKnwNMHsg/ke0qIQWopLsgErTASkpugX4iF0L3fpbl3eZZg=", "2026070430"],
      ["djAxL3MNeIxANQrA0yj5opT0/k1xy/khwppQ2M0g+kE+oTx3iru3bv63+UdNNBR70qI=", "2506020001"],
      ["djAxFGwC3eqyXuf075yKpB7xqeLMjqlBjiACU1LK83VWlyZGgw33jQBSV8eRC3smQH8=", "2506020002"],
      ["djAxVcPmLD8E04t54O4a6c7hnP74aadPH6zWkt3ddNPaptKZd4wzcsE4OFdkwTQhRxo=", "2506020003"]
      ];
      let updatedEmaal = 0;
      for (const [token, nis] of emaalPairs) {
        const [r] = await pool.execute('UPDATE murid SET barcode_id = ? WHERE nis = ?', [token, nis]);
        if ((r as any).affectedRows > 0) updatedEmaal++;
      }
      results.push(`✅ Bulk pairing eMaal: ${updatedEmaal} dari ${emaalPairs.length} santri berhasil diupdate!`);
    } catch (e: any) {
      results.push('❌ Failed bulk eMaal pairing: ' + e.message);
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
