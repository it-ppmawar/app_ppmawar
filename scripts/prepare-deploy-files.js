/**
 * scripts/prepare-deploy-files.js
 * Hanya bertugas menyalin file build ke deploy_dist/.
 * ZIP dibuat terpisah di workflow YAML.
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
  if (stats.isSymbolicLink()) return; // Skip all symlinks
  if (stats.isDirectory()) {
    if (filterFn && !filterFn(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    let children;
    try { children = fs.readdirSync(src); } catch (e) { return; }
    children.forEach(child => copyRecursiveSync(path.join(src, child), path.join(dest, child), filterFn));
  } else if (stats.isFile()) {
    if (filterFn && !filterFn(src)) return;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try { fs.copyFileSync(src, dest); } catch (e) {
      console.warn(`[WARN] Skip: ${path.relative(process.cwd(), src)} - ${e.message}`);
    }
  }
}

function main() {
  console.log('🚀 Preparing deploy_dist files...');
  console.log(`   Platform: ${process.platform}, Node: ${process.version}`);

  const rootDir = path.resolve(__dirname, '..');
  const deployDistDir = path.join(rootDir, 'deploy_dist');
  const uploadBundleDir = path.join(rootDir, 'upload_bundle');

  // Check .next exists
  const nextSrc = path.join(rootDir, '.next');
  if (!fs.existsSync(nextSrc)) {
    throw new Error(`.next directory NOT FOUND at ${nextSrc}. Build failed?`);
  }
  console.log('✅ .next directory found');

  // Clean
  if (fs.existsSync(deployDistDir)) fs.rmSync(deployDistDir, { recursive: true, force: true });
  if (fs.existsSync(uploadBundleDir)) fs.rmSync(uploadBundleDir, { recursive: true, force: true });

  fs.mkdirSync(path.join(deployDistDir, 'tmp'), { recursive: true });
  fs.mkdirSync(uploadBundleDir, { recursive: true });

  fs.writeFileSync(path.join(deployDistDir, 'tmp', 'restart.txt'), new Date().toString());

  // Copy .next (exclude cache/standalone/diagnostics/dev)
  console.log('📦 Copying .next...');
  copyRecursiveSync(nextSrc, path.join(deployDistDir, '.next'), (fp) => {
    const rel = path.relative(nextSrc, fp);
    return !['cache', 'standalone', 'diagnostics', 'dev'].some(d => rel.startsWith(d));
  });

  // Copy public (exclude models/)
  console.log('📂 Copying public...');
  const pubSrc = path.join(rootDir, 'public');
  const pubDst = path.join(deployDistDir, 'public');
  copyRecursiveSync(pubSrc, pubDst, (fp) => !path.relative(pubSrc, fp).startsWith('models'));

  // Copy root files
  ['.htaccess', 'package.json', 'package-lock.json', 'next.config.ts', 'server.js'].forEach(f => {
    const s = path.join(rootDir, f);
    if (fs.existsSync(s)) try { fs.copyFileSync(s, path.join(deployDistDir, f)); } catch (e) { }
  });

  // version.txt
  const sha = process.env.GITHUB_SHA || 'local';
  const branch = process.env.GITHUB_REF_NAME || 'main';
  fs.writeFileSync(path.join(pubDst, 'version.txt'), `Commit: ${sha}\nDate: ${new Date().toISOString()}\nBranch: ${branch}\n`);

  // unzip.php to upload_bundle
  const unzipSrc = path.join(pubSrc, 'unzip.php');
  if (fs.existsSync(unzipSrc)) fs.copyFileSync(unzipSrc, path.join(uploadBundleDir, 'unzip.php'));

  // Count files
  let count = 0;
  function countFiles(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
      const fp = path.join(dir, f);
      try {
        const s = fs.lstatSync(fp);
        if (s.isDirectory()) countFiles(fp);
        else if (s.isFile()) count++;
      } catch (e) {}
    });
  }
  countFiles(deployDistDir);
  console.log(`✅ deploy_dist prepared: ${count} files ready`);
}

main();
