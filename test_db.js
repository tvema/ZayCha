import Database from 'better-sqlite3';
const db = new Database('./chat.db');
const users = db.prepare('SELECT * FROM users').all();
console.log('USERS:', users.length);
if (users.length > 0) {
  console.log(users[0].username, users[0].email);
}
