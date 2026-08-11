/**
 * scripts/upload-ftp.js
 * Uploads deploy.zip + triggers Passenger app restart via tmp/restart.txt.
 * Uses basic-ftp with passive mode & rejectUnauthorized: false to prevent TLS cert errors.
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
    // Try explicit TLS first with self-signed / wildcard SSL tolerance
    await client.access({
      host: server,
      user: user,
      password: password,
      secure: true,
      secureOptions: { rejectUnauthorized: false }
    });
    console.log('✅ Connected via FTPS (explicit TLS, bypass hostname cert check)');
  } catch (err1) {
    console.warn(`⚠️ FTPS explicit failed (${err1.message}). Trying plain FTP (passive)...`);
    await client.access({
      host: server,
      user: user,
      password: password,
      secure: false
    });
    console.log('✅ Connected via plain FTP (passive mode)');
  }

  const zipPath = path.resolve(__dirname, '../upload_bundle/deploy.zip');
  if (fs.existsSync(zipPath)) {
    const sizeMb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
    console.log(`📦 Uploading deploy.zip (${sizeMb} MB) to ${targetDir}/deploy.zip...`);
    await client.uploadFile(zipPath, `${targetDir}/deploy.zip`);
    console.log('✅ deploy.zip uploaded successfully!');

    // Create / touch tmp/restart.txt to restart Phusion Passenger
    const restartTmp = path.resolve(__dirname, '../upload_bundle/restart.txt');
    fs.writeFileSync(restartTmp, new Date().toISOString());
    console.log('🔄 Updating tmp/restart.txt on server...');
    await client.ensureDir(`${targetDir}/tmp`);
    await client.uploadFile(restartTmp, `${targetDir}/tmp/restart.txt`);
    console.log('✅ tmp/restart.txt updated! App restart triggered.');
  } else {
    // Fallback: upload folder directly
    const uploadBundleDir = process.env.FTP_LOCAL_DIR
      ? path.resolve(process.cwd(), process.env.FTP_LOCAL_DIR)
      : path.resolve(__dirname, '../deploy_dist');
    console.log(`📤 Uploading directory ${uploadBundleDir} to ${targetDir}...`);
    await client.uploadFromDir(uploadBundleDir, targetDir);
    console.log('✅ Directory upload completed successfully!');
  }

  console.log('🎉 FTP Upload completed successfully!');
  client.close();
}

upload().catch(err => {
  console.error('❌ FTP Upload Error:', err.message || err);
  process.exit(1);
});
