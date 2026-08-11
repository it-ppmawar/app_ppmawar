/**
 * scripts/build-deploy-zip.js
 * Script bundling otomatis & ultra-reliable untuk GitHub Actions & Local Deploy.
 * Mengcopy .next, public, dan file server ke deploy_dist, lalu membuat upload_bundle/deploy.zip.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function copyRecursiveSync(src, dest, filterFn) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (filterFn && !filterFn(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName),
        filterFn
      );
    });
  } else {
    if (filterFn && !filterFn(src)) return;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      fs.copyFileSync(src, dest);
    } catch (e) {
      console.warn(`[WARN] Skipped copy file: ${src} -> ${e.message}`);
    }
  }
}

function main() {
  console.log('🚀 [Deploy Script] Starting production bundle preparation...');

  const rootDir = path.resolve(__dirname, '..');
  const deployDistDir = path.join(rootDir, 'deploy_dist');
  const uploadBundleDir = path.join(rootDir, 'upload_bundle');

  // Clean old output directories
  if (fs.existsSync(deployDistDir)) {
    fs.rmSync(deployDistDir, { recursive: true, force: true });
  }
  if (fs.existsSync(uploadBundleDir)) {
    fs.rmSync(uploadBundleDir, { recursive: true, force: true });
  }

  fs.mkdirSync(path.join(deployDistDir, 'tmp'), { recursive: true });
  fs.mkdirSync(uploadBundleDir, { recursive: true });

  // 1. Restart trigger file
  fs.writeFileSync(path.join(deployDistDir, 'tmp', 'restart.txt'), new Date().toString());

  // 2. Copy .next directory (exclude cache, standalone, diagnostics, dev)
  console.log('📦 Copying .next build directory...');
  const nextSrc = path.join(rootDir, '.next');
  const nextDst = path.join(deployDistDir, '.next');
  copyRecursiveSync(nextSrc, nextDst, (filePath) => {
    const rel = path.relative(nextSrc, filePath);
    if (rel.startsWith('cache') || rel.startsWith('standalone') || rel.startsWith('diagnostics') || rel.startsWith('dev')) {
      return false;
    }
    return true;
  });

  // 3. Copy public directory (exclude models if any)
  console.log('📂 Copying public assets directory...');
  const pubSrc = path.join(rootDir, 'public');
  const pubDst = path.join(deployDistDir, 'public');
  copyRecursiveSync(pubSrc, pubDst, (filePath) => {
    const rel = path.relative(pubSrc, filePath);
    if (rel.startsWith('models')) return false;
    return true;
  });

  // 4. Copy essential root files
  const rootFiles = ['.htaccess', 'package.json', 'package-lock.json', 'next.config.ts', 'server.js'];
  rootFiles.forEach(file => {
    const s = path.join(rootDir, file);
    const d = path.join(deployDistDir, file);
    if (fs.existsSync(s)) {
      try {
        fs.copyFileSync(s, d);
      } catch (e) {
        console.warn(`[WARN] Failed to copy ${file}: ${e.message}`);
      }
    }
  });

  // 5. Create version.txt
  const sha = process.env.GITHUB_SHA || 'local';
  const branch = process.env.GITHUB_REF_NAME || 'main';
  const versionContent = `Commit: ${sha}\nDate: ${new Date().toISOString()}\nBranch: ${branch}\n`;
  fs.writeFileSync(path.join(pubDst, 'version.txt'), versionContent);

  // 6. Copy unzip.php to upload_bundle
  const unzipSrc = path.join(pubSrc, 'unzip.php');
  if (fs.existsSync(unzipSrc)) {
    fs.copyFileSync(unzipSrc, path.join(uploadBundleDir, 'unzip.php'));
  }

  // 7. Zip deploy_dist into upload_bundle/deploy.zip
  console.log('🗜️ Creating upload_bundle/deploy.zip...');
  const zipPath = path.join(uploadBundleDir, 'deploy.zip');

  try {
    if (process.platform === 'win32') {
      execSync(`node "${path.join(rootDir, 'scratch_zip_crossplatform.js')}"`, { stdio: 'inherit' });
      const rootZip = path.join(rootDir, 'deploy.zip');
      if (fs.existsSync(rootZip)) {
        fs.copyFileSync(rootZip, zipPath);
      }
    } else {
      execSync(`cd "${deployDistDir}" && zip -q -r "${zipPath}" .`, { stdio: 'inherit' });
    }
  } catch (err) {
    console.error('Error creating ZIP via command, trying fallback yazl script...', err.message);
    execSync(`node "${path.join(rootDir, 'scratch_zip_crossplatform.js')}"`, { stdio: 'inherit' });
    const rootZip = path.join(rootDir, 'deploy.zip');
    if (fs.existsSync(rootZip)) {
      fs.copyFileSync(rootZip, zipPath);
    }
  }

  if (fs.existsSync(zipPath)) {
    const stats = fs.statSync(zipPath);
    console.log(`✅ Production bundle created successfully! Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
  } else {
    throw new Error('ZIP file creation failed!');
  }
}

main();
