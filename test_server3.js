import http from 'http';

const req = http.get('http://localhost:3000', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('HTML HEADERS:', data.substring(0, 500)));
});

req.on('error', (e) => {
  console.error(`Got error: ${e.message}`);
});
