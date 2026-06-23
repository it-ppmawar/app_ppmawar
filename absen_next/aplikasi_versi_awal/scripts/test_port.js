const net = require('net');

const server = net.createServer();

server.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('PORT 3306 IS BLOCKED! Another application is using it.');
  } else {
    console.log('Port error:', err.message);
  }
  process.exit(1);
});

server.once('listening', () => {
  console.log('PORT 3306 IS FREE! No other application is using it.');
  server.close();
  process.exit(0);
});

server.listen(3306, '127.0.0.1');
