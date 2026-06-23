const https = require('https');

function testPlain() {
  const url = 'https://mawar.smartpesantren.id/api_absensi/api_bridge.php?action=get_santri';
  
  const headers = {
    'User-Agent': 'PostmanRuntime/7.36.3',
    'Accept': 'application/json, text/plain, */*',
    'Connection': 'keep-alive'
  };

  https.get(url, { headers }, (res) => {
    console.log('Status:', res.statusCode);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Total length:', data.length);
      try {
        const parsed = JSON.parse(data);
        console.log('API Status:', parsed.status);
        if (parsed.data && parsed.data.length > 0) {
          console.log('Sample Data (First 3 items):');
          console.log(JSON.stringify(parsed.data.slice(0, 3), null, 2));
          console.log('Keys in data[0]:', Object.keys(parsed.data[0]));
        } else {
          console.log('No data or different format:', parsed);
        }
      } catch (e) {
        console.log('Failed to parse JSON. Raw response start:', data.substring(0, 500));
      }
    });
  }).on('error', (err) => {
    console.error('Error:', err);
  });
}

testPlain();
