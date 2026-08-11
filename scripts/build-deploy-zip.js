/**
 * scripts/build-deploy-zip.js
 * Script bundling 100% Pure Node.js (yazl) - Tanpa ketergantungan OS CLI zip / apt-get.
 * Mengcopy .next, public, dan file server ke deploy_dist, lalu membuat upload_bundle/deploy.zip dengan forward slash (Linux compatible).
 */
const fs = require('fs');
const path = require('path');
const yazl = require('yazl');

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

function createZipWithYazl(sourceDir, targetZipPath) {
  return new Promise((resolve, reject) => {
    const zipfile = new yazl.ZipFile();
    const output = fs.createWriteStream(targetZipPath);

    output.on('close', () => {
      resolve();
    });

    zipfile.outputStream.pipe(output).on('error', (err) => reject(err));

    function walkDir(currentDir) {
      const items = fs.readdirSync(currentDir);
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const relativePath = path.relative(sourceDir, fullPath);
        // Normalize path to Linux forward slash '/'
        const zipRelativePath = relativePath.split(path.sep).join('/');
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (stat.isFile()) {
          zipfile.addFile(fullPath, zipRelativePath);
        }
      }
    }

    walkDir(sourceDir);
    zipfile.end();
  });
}

async function main() {
  console.log('🚀 [Deploy Script] Starting 100% Pure Node.js production bundle preparation...');

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

  // 7. Zip deploy_dist into upload_bundle/deploy.zip using yazl
  console.log('🗜️ Creating upload_bundle/deploy.zip (Pure Node.js yazl)...');
  const zipPath = path.join(uploadBundleDir, 'deploy.zip');

  await createZipWithYazl(deployDistDir, zipPath);

  if (fs.existsSync(zipPath) && fs.statSync(zipPath).size > 1000) {
    const stats = fs.statSync(zipPath);
    console.log(`✅ Production bundle created successfully! Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
  } else {
    throw new Error('ZIP file creation failed!');
  }
}

main().catch(err => {
  console.error('❌ Build script error:', err);
  process.exit(1);
});
