/**
 * scripts/build-deploy-zip.js
 * Script bundling 100% Pure Node.js (yazl) - Tanpa ketergantungan OS CLI zip / apt-get.
 */
const fs = require('fs');
const path = require('path');

function copyRecursiveSync(src, dest, filterFn) {
  if (!fs.existsSync(src)) return;
  let stats;
  try {
    stats = fs.lstatSync(src); // lstatSync agar tidak follow symlink
  } catch (e) {
    console.warn(`[WARN] Cannot stat: ${src} -> ${e.message}`);
    return;
  }
  if (stats.isSymbolicLink()) {
    // Skip symlinks entirely to avoid issues
    return;
  }
  if (stats.isDirectory()) {
    if (filterFn && !filterFn(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    let children;
    try {
      children = fs.readdirSync(src);
    } catch (e) {
      console.warn(`[WARN] Cannot readdir: ${src} -> ${e.message}`);
      return;
    }
    children.forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName),
        filterFn
      );
    });
  } else if (stats.isFile()) {
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
  const yazl = require('yazl');
  return new Promise((resolve, reject) => {
    const zipfile = new yazl.ZipFile();
    const output = fs.createWriteStream(targetZipPath);

    output.on('close', () => resolve());
    output.on('error', (err) => reject(err));
    zipfile.outputStream.pipe(output);

    function walkDir(currentDir) {
      let items;
      try {
        items = fs.readdirSync(currentDir);
      } catch (e) {
        console.warn(`[WARN] Cannot readdir for zip: ${currentDir} -> ${e.message}`);
        return;
      }
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        let stat;
        try {
          stat = fs.lstatSync(fullPath);
        } catch (e) {
          console.warn(`[WARN] Cannot lstat for zip: ${fullPath} -> ${e.message}`);
          continue;
        }
        if (stat.isSymbolicLink()) continue; // Skip symlinks
        const relativePath = path.relative(sourceDir, fullPath);
        const zipRelativePath = relativePath.split(path.sep).join('/');
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (stat.isFile()) {
          try {
            zipfile.addFile(fullPath, zipRelativePath);
          } catch (e) {
            console.warn(`[WARN] Cannot add to zip: ${fullPath} -> ${e.message}`);
          }
        }
      }
    }

    try {
      walkDir(sourceDir);
    } catch (e) {
      reject(e);
      return;
    }
    zipfile.end();
  });
}

async function main() {
  console.log('🚀 [Deploy Script] Starting Pure Node.js production bundle (yazl)...');
  console.log(`   Node.js: ${process.version}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   CWD: ${process.cwd()}`);

  const rootDir = path.resolve(__dirname, '..');
  const deployDistDir = path.join(rootDir, 'deploy_dist');
  const uploadBundleDir = path.join(rootDir, 'upload_bundle');

  console.log(`   rootDir: ${rootDir}`);
  console.log(`   deployDistDir: ${deployDistDir}`);

  // Check .next exists
  const nextSrc = path.join(rootDir, '.next');
  if (!fs.existsSync(nextSrc)) {
    throw new Error(`.next directory not found at ${nextSrc}. Did npm run build succeed?`);
  }
  console.log(`✅ .next directory found`);

  // Clean old output
  if (fs.existsSync(deployDistDir)) fs.rmSync(deployDistDir, { recursive: true, force: true });
  if (fs.existsSync(uploadBundleDir)) fs.rmSync(uploadBundleDir, { recursive: true, force: true });

  fs.mkdirSync(path.join(deployDistDir, 'tmp'), { recursive: true });
  fs.mkdirSync(uploadBundleDir, { recursive: true });

  // Restart trigger
  fs.writeFileSync(path.join(deployDistDir, 'tmp', 'restart.txt'), new Date().toString());

  // Copy .next
  console.log('📦 Copying .next build directory...');
  copyRecursiveSync(nextSrc, path.join(deployDistDir, '.next'), (filePath) => {
    const rel = path.relative(nextSrc, filePath);
    if (rel.startsWith('cache') || rel.startsWith('standalone') || rel.startsWith('diagnostics') || rel.startsWith('dev')) return false;
    return true;
  });
  console.log('✅ .next copied');

  // Copy public
  console.log('📂 Copying public assets...');
  const pubSrc = path.join(rootDir, 'public');
  const pubDst = path.join(deployDistDir, 'public');
  copyRecursiveSync(pubSrc, pubDst, (filePath) => {
    const rel = path.relative(pubSrc, filePath);
    if (rel.startsWith('models')) return false;
    return true;
  });
  console.log('✅ public copied');

  // Copy root files
  const rootFiles = ['.htaccess', 'package.json', 'package-lock.json', 'next.config.ts', 'server.js'];
  rootFiles.forEach(file => {
    const s = path.join(rootDir, file);
    const d = path.join(deployDistDir, file);
    if (fs.existsSync(s)) {
      try { fs.copyFileSync(s, d); } catch (e) { console.warn(`[WARN] Skip ${file}: ${e.message}`); }
    }
  });

  // version.txt
  const sha = process.env.GITHUB_SHA || 'local';
  const branch = process.env.GITHUB_REF_NAME || 'main';
  fs.writeFileSync(path.join(pubDst, 'version.txt'), `Commit: ${sha}\nDate: ${new Date().toISOString()}\nBranch: ${branch}\n`);

  // unzip.php
  const unzipSrc = path.join(pubSrc, 'unzip.php');
  if (fs.existsSync(unzipSrc)) {
    fs.copyFileSync(unzipSrc, path.join(uploadBundleDir, 'unzip.php'));
  }

  // Create ZIP
  console.log('🗜️ Creating upload_bundle/deploy.zip using yazl...');
  const zipPath = path.join(uploadBundleDir, 'deploy.zip');
  await createZipWithYazl(deployDistDir, zipPath);
  console.log('✅ ZIP created');

  if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 1000) {
    throw new Error('ZIP file is missing or too small!');
  }

  const sizeMB = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Production bundle ready! Size: ${sizeMB} MB`);
}

main().catch(err => {
  console.error('❌ Build script error:', err.message || err);
  process.exit(1);
});
