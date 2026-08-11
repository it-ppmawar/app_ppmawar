/**
 * scripts/upload-ftp.js
 * Uploads files using basic-ftp with passive mode & robust timeout handling.
 * Supports FTP_LOCAL_DIR env to specify which folder to upload.
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

  try {
    // Attempt 1: Secure FTPS with passive mode
    await client.access({
      host: server,
      user: user,
      password: password,
      secure: 'implicit',
      secureOptions: { rejectUnauthorized: false }
    });
    console.log('✅ Connected via FTPS (implicit TLS)');
  } catch (err1) {
    console.warn(`⚠️ FTPS implicit failed (${err1.message}). Trying explicit TLS...`);
    try {
      await client.access({
        host: server,
        user: user,
        password: password,
        secure: true,
        secureOptions: { rejectUnauthorized: false }
      });
      console.log('✅ Connected via FTPS (explicit TLS)');
    } catch (err2) {
      console.warn(`⚠️ FTPS explicit failed (${err2.message}). Trying plain FTP (passive)...`);
      await client.access({
        host: server,
        user: user,
        password: password,
        secure: false
      });
      console.log('✅ Connected via plain FTP (passive mode)');
    }
  }

  const uploadBundleDir = process.env.FTP_LOCAL_DIR
    ? path.resolve(process.cwd(), process.env.FTP_LOCAL_DIR)
    : path.resolve(__dirname, '../deploy_dist');
  console.log(`📤 Uploading files from ${uploadBundleDir} to ${targetDir}...`);
  await client.uploadFromDir(uploadBundleDir, targetDir);
  console.log('🎉 FTP Upload completed successfully!');
  client.close();
}

upload().catch(err => {
  console.error('❌ FTP Upload Error:', err.message || err);
  process.exit(1);
});
