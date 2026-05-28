import http from 'http';

const data = JSON.stringify({
  username: "testuser123",
  password: "password123"
});

const req = http.request('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', body.substring(0, 500)));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
