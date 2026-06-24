// test_request.js
import fetch from 'node-fetch';

async function test() {
  try {
    // Generate token
    const jwt = await import('jsonwebtoken');
    const token = jwt.default.sign({ userId: '1' }, 'your-secret-key-here', { expiresIn: '1h' });
    
    // We don't have the actual user ID or JWT secret, but we can bypass or just run a direct DB query
  } catch (e) {
    console.error(e);
  }
}
test();
