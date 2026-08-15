/**
 * scripts/prepare-deploy-files.js
 * Menyalin file build ke deploy_dist/ dengan aman.
 */
const fs = require('fs');
const path = require('path');

function copyRecursiveSync(src, dest, filterFn) {
  if (!fs.existsSync(src)) return;
  let stats;
  try {
    stats = fs.lstatSync(src);
  } catch (e) {
    return;
  }
  if (stats.isSymbolicLink()) return; // Skip symlinks
  if (stats.isDirectory()) {
    if (filterFn && !filterFn(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    let children;
    try {
      children = fs.readdirSync(src);
    } catch (e) {
      return;
    }
    children.forEach(child => {
      copyRecursiveSync(path.join(src, child), path.join(dest, child), filterFn);
    });
  } else if (stats.isFile()) {
    if (filterFn && !filterFn(src)) return;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      fs.copyFileSync(src, dest);
    } catch (e) {
      console.warn(`[WARN] Skip copy file: ${path.relative(process.cwd(), src)} - ${e.message}`);
    }
  }
}

function main() {
  console.log('🚀 Preparing deploy_dist files...');
  console.log(`   Platform: ${process.platform}, Node: ${process.version}`);

  const rootDir = path.resolve(__dirname, '..');
  const deployDistDir = path.join(rootDir, 'deploy_dist');
  const uploadBundleDir = path.join(rootDir, 'upload_bundle');
  const pubDst = path.join(deployDistDir, 'public');

  // Check .next exists
  const nextSrc = path.join(rootDir, '.next');
  if (!fs.existsSync(nextSrc)) {
    throw new Error(`.next directory NOT FOUND at ${nextSrc}. Did npm run build succeed?`);
  }
  console.log('✅ .next directory found');

  // Clean old folders safely
  try {
    if (fs.existsSync(deployDistDir)) fs.rmSync(deployDistDir, { recursive: true, force: true });
    if (fs.existsSync(uploadBundleDir)) fs.rmSync(uploadBundleDir, { recursive: true, force: true });
  } catch (e) {
    console.warn(`[WARN] Clean warning: ${e.message}`);
  }

  // Ensure directories exist
  fs.mkdirSync(path.join(deployDistDir, 'tmp'), { recursive: true });
  fs.mkdirSync(pubDst, { recursive: true });
  fs.mkdirSync(uploadBundleDir, { recursive: true });

  // 1. Restart trigger file
  fs.writeFileSync(path.join(deployDistDir, 'tmp', 'restart.txt'), new Date().toString());

  // 2. Copy .next (exclude cache, standalone, diagnostics, dev)
  console.log('📦 Copying .next build directory...');
  copyRecursiveSync(nextSrc, path.join(deployDistDir, '.next'), (fp) => {
    const rel = path.relative(nextSrc, fp);
    return !['cache', 'standalone', 'diagnostics', 'dev'].some(d => rel === d || rel.startsWith(d + path.sep));
  });
  console.log('✅ .next copied successfully');

  // 3. Copy public (exclude models/ and uploads/)
  console.log('📂 Copying public assets...');
  const pubSrc = path.join(rootDir, 'public');
  if (fs.existsSync(pubSrc)) {
    copyRecursiveSync(pubSrc, pubDst, (fp) => {
      const rel = path.relative(pubSrc, fp);
      return !rel.startsWith('models') && !rel.startsWith('uploads');
    });
  }
  console.log('✅ public copied successfully');

  // 4. Copy essential root files
  ['.htaccess', 'package.json', 'package-lock.json', 'next.config.ts', 'server.js'].forEach(f => {
    const s = path.join(rootDir, f);
    if (fs.existsSync(s)) {
      try {
        fs.copyFileSync(s, path.join(deployDistDir, f));
      } catch (e) {
        console.warn(`[WARN] Skip root file ${f}: ${e.message}`);
      }
    }
  });

  // 5. Write version.txt
  const sha = process.env.GITHUB_SHA || 'local';
  const branch = process.env.GITHUB_REF_NAME || 'main';
  fs.writeFileSync(path.join(pubDst, 'version.txt'), `Commit: ${sha}\nDate: ${new Date().toISOString()}\nBranch: ${branch}\n`);
  console.log('✅ version.txt created');

  // 6. Copy server.js and package.json to upload_bundle
  ['server.js', 'package.json'].forEach(f => {
    const s = path.join(rootDir, f);
    if (fs.existsSync(s)) {
      try {
        fs.copyFileSync(s, path.join(uploadBundleDir, f));
        console.log(`✅ ${f} copied to upload_bundle`);
      } catch (e) {
        console.warn(`[WARN] Skip ${f} copy: ${e.message}`);
      }
    }
  });

  // 7. Count files
  let count = 0;
  function countFiles(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      fs.readdirSync(dir).forEach(f => {
        const fp = path.join(dir, f);
        try {
          const s = fs.lstatSync(fp);
          if (s.isDirectory()) countFiles(fp);
          else if (s.isFile()) count++;
        } catch (e) {}
      });
    } catch (e) {}
  }
  countFiles(deployDistDir);
  console.log(`🎉 deploy_dist prepared successfully! Total ${count} files ready.`);
}

try {
  main();
} catch (err) {
  console.error('❌ FATAL PREPARE SCRIPT ERROR:');
  console.error(err.stack || err);
  process.exit(1);
}
