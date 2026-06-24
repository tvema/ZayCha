const Database = require('better-sqlite3');
const db = new Database(':memory:');
db.exec(`
  CREATE TABLE messages (created_at DATETIME);
  CREATE TABLE group_members (last_read_at TEXT);
  INSERT INTO messages (created_at) VALUES ('2026-06-24T12:10:00.000Z');
  INSERT INTO group_members (last_read_at) VALUES ('2026-06-24T12:15:00.000Z');
`);
const rows = db.prepare(`
  SELECT 
    m.created_at, 
    gm.last_read_at,
    m.created_at > gm.last_read_at as is_greater
  FROM messages m, group_members gm
`).all();
console.log(rows);
