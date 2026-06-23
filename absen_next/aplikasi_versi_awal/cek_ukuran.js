const fs = require('fs');
const path = require('path');

function getFolderSize(folderPath) {
  let totalSize = 0;
  let fileCount = 0;
  
  if (!fs.existsSync(folderPath)) return { size: 0, count: 0 };
  
  const items = fs.readdirSync(folderPath);
  for (const item of items) {
    const itemPath = path.join(folderPath, item);
    try {
      const stats = fs.statSync(itemPath);
      if (stats.isDirectory()) {
        const sub = getFolderSize(itemPath);
        totalSize += sub.size;
        fileCount += sub.count;
      } else {
        totalSize += stats.size;
        fileCount += 1;
      }
    } catch (e) {}
  }
  return { size: totalSize, count: fileCount };
}

const nextDir = path.join(__dirname, '.next');
console.log('Menghitung ukuran folder dalam .next...\n');

const folders = fs.readdirSync(nextDir).filter(f => {
  try { return fs.statSync(path.join(nextDir, f)).isDirectory(); } catch (e) { return false; }
});

const results = [];
for (const folder of folders) {
  const result = getFolderSize(path.join(nextDir, folder));
  results.push({ name: folder, sizeMB: (result.size / (1024 * 1024)).toFixed(2), count: result.count });
}

results.sort((a, b) => b.sizeMB - a.sizeMB);
console.table(results);
