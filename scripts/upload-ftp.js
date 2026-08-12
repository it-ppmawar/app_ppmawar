/**
 * scripts/upload-ftp.js
 * Uploads upload_bundle/ directory to targetDir using basic-ftp.
 * Strategy: Plain FTP first (server doesn't have valid TLS cert), FTPS as fallback.
 * Verbose mode OFF to maximize upload speed.
 */
const ftp = require('basic-ftp');
const path = require('path');
const fs = require('fs');

async function connectFTP() {
  const server = process.env.FTP_SERVER;
  const user = process.env.FTP_USERNAME;
  const password = process.env.FTP_PASSWORD;

  if (!server || !user || !password) {
    throw new Error('FTP credentials missing in environment variables!');
  }

  const client = new ftp.Client(60000); // 60s timeout
  client.ftp.verbose = false; // OFF: verbose mode slows upload dramatically

  // Attempt 1: Plain FTP (fastest, known to work with Jagoan Hosting)
  try {
    await client.access({ host: server, user, password, secure: false });
    console.log('✅ Connected via Plain FTP');
    return client;
  } catch (err1) {
    console.warn(`⚠️ Plain FTP failed: ${err1.message}`);
    client.close();
  }

  // Attempt 2: FTPS explicit TLS (ignore cert mismatch)
  const client2 = new ftp.Client(60000);
  client2.ftp.verbose = false;
  try {
    await client2.access({
      host: server, user, password,
      secure: true,
      secureOptions: { rejectUnauthorized: false }
    });
    console.log('✅ Connected via FTPS (explicit TLS)');
    return client2;
  } catch (err2) {
    console.warn(`⚠️ FTPS explicit failed: ${err2.message}`);
    client2.close();
  }

  // Attempt 3: FTPS implicit TLS (ignore cert mismatch)
  const client3 = new ftp.Client(60000);
  client3.ftp.verbose = false;
  try {
    await client3.access({
      host: server, user, password,
      secure: 'implicit',
      secureOptions: { rejectUnauthorized: false }
    });
    console.log('✅ Connected via FTPS (implicit TLS)');
    return client3;
  } catch (err3) {
    client3.close();
    throw new Error(`All FTP connection attempts failed. Last error: ${err3.message}`);
  }
}

async function uploadWithRetry(maxAttempts = 3) {
  const targetDir = process.env.FTP_TARGET_DIR || '/public_html';
  const uploadBundleDir = path.resolve(__dirname, '../upload_bundle');

  if (!fs.existsSync(uploadBundleDir)) {
    throw new Error(`upload_bundle folder NOT FOUND at ${uploadBundleDir}`);
  }

  const files = fs.readdirSync(uploadBundleDir);
  console.log(`📦 upload_bundle contents: ${files.join(', ')}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n🔌 Connecting to FTP (attempt ${attempt}/${maxAttempts})...`);
    let client;
    try {
      client = await connectFTP();
      console.log(`📤 Uploading to ${targetDir}...`);
      await client.uploadFromDir(uploadBundleDir, targetDir);
      console.log('🎉 Upload completed successfully!');
      client.close();
      return; // Success
    } catch (err) {
      if (client) client.close();
      console.error(`❌ Attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxAttempts) {
        const delay = attempt * 5000; // 5s, 10s backoff
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

uploadWithRetry().catch(err => {
  console.error('❌ FTP Upload permanently failed:', err.message || err);
  process.exit(1);
});
