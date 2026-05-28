const Database = require('better-sqlite3');
const db = new Database('chat.db');
const msgs = db.prepare('SELECT id, sender_id, receiver_id, group_id, content, created_at, is_media, reply_to FROM messages ORDER BY created_at DESC LIMIT 10').all();
console.log(JSON.stringify(msgs, null, 2));
