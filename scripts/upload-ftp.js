/**
 * scripts/upload-ftp.js
 * Uploads deploy_dist/ directory directly to targetDir using basic-ftp
 * with 3-level fallback (FTPS implicit -> FTPS explicit -> Plain FTP passive).
 */
const ftp = require('basic-ftp');
const path = require('path');
const fs = require('fs');

async function upload() {
  const client = new ftp.Client();
  client.ftp.verbose = true;

  const server = process.env.FTP_SERVER;
  const user = process.env.FTP_USERNAME;
  const password = process.env.FTP_PASSWORD;
  const targetDir = process.env.FTP_TARGET_DIR || '/public_html';

  if (!server || !user || !password) {
    throw new Error('FTP credentials missing in environment variables!');
  }

  console.log(`🔌 Connecting to FTP server: ${server} (target dir: ${targetDir})...`);

  let connected = false;

  // Attempt 1: FTPS implicit TLS
  try {
    await client.access({
      host: server,
      user: user,
      password: password,
      secure: 'implicit',
      secureOptions: { rejectUnauthorized: false }
    });
    console.log('✅ Connected via FTPS (implicit TLS)');
    connected = true;
  } catch (err1) {
    console.warn(`⚠️ FTPS implicit failed: ${err1.message}`);
  }

  // Attempt 2: FTPS explicit TLS
  if (!connected) {
    try {
      await client.access({
        host: server,
        user: user,
        password: password,
        secure: true,
        secureOptions: { rejectUnauthorized: false }
      });
      console.log('✅ Connected via FTPS (explicit TLS)');
      connected = true;
    } catch (err2) {
      console.warn(`⚠️ FTPS explicit failed: ${err2.message}`);
    }
  }

  // Attempt 3: Plain FTP (passive mode)
  if (!connected) {
    try {
      await client.access({
        host: server,
        user: user,
        password: password,
        secure: false
      });
      console.log('✅ Connected via Plain FTP (passive mode)');
      connected = true;
    } catch (err3) {
      console.error(`❌ Plain FTP failed: ${err3.message}`);
      throw err3;
    }
  }

  const uploadBundleDir = path.resolve(__dirname, '../upload_bundle');
  if (!fs.existsSync(uploadBundleDir)) {
    throw new Error(`upload_bundle folder NOT FOUND at ${uploadBundleDir}`);
  }

  console.log(`📤 Uploading zip bundle from ${uploadBundleDir} to ${targetDir}...`);
  await client.uploadFromDir(uploadBundleDir, targetDir);
  console.log('🎉 Fast Zip Bundle FTP Upload completed successfully!');
  client.close();
}

upload().catch(err => {
  console.error('❌ FTP Upload Error:', err.message || err);
  process.exit(1);
});
