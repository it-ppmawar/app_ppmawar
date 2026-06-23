const fs = require('fs');
const path = require('path');

function main() {
  const possiblePaths = [
    'D:\\koding\\xampp\\mysql\\data\\mysql_error.log',
    'C:\\xampp\\mysql\\data\\mysql_error.log',
    'D:\\xampp\\mysql\\data\\mysql_error.log',
  ];

  let logPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      logPath = p;
      break;
    }
  }

  if (!logPath) {
    console.log('MySQL error log not found in common locations');
    // Let's check if the directory D:\koding\xampp exists
    if (fs.existsSync('D:\\koding\\xampp')) {
      console.log('D:\\koding\\xampp exists! Let\'s list mysql/data contents:');
      try {
        const files = fs.readdirSync('D:\\koding\\xampp\\mysql\\data');
        console.log('Files in mysql/data:', files);
        // Find any file ending with .err
        const errFile = files.find(f => f.endsWith('.err'));
        if (errFile) {
          logPath = path.join('D:\\koding\\xampp\\mysql\\data', errFile);
        }
      } catch (e) {
        console.error('Error reading mysql/data:', e.message);
      }
    } else {
      console.log('D:\\koding\\xampp does not exist');
    }
  }

  if (logPath) {
    console.log('Found MySQL log at:', logPath);
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split('\n');
    console.log('--- LAST 50 LINES ---');
    console.log(lines.slice(-50).join('\n'));
  } else {
    console.log('Could not resolve mysql log path');
  }
}

main();
