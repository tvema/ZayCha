import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';

const db = new Database('./chat.db');
const user = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@zstate.ru');

if (user) {
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'fallback-secret-for-dev', { expiresIn: '1h' });
  console.log('Token:', token);
} else {
  console.log('User not found');
}
