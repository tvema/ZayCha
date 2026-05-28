import http from 'http';

http.get('http://localhost:3000/api/push/vapid-public-key', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('VAPID:', data));
});
