const Database = require('better-sqlite3');
const db = new Database('./chat.db');
const groups = db.prepare(`
  SELECT g.name, gm.last_read_at, gm.user_id,
  (SELECT COUNT(*) FROM messages m WHERE m.group_id = g.id) as total_messages,
  (SELECT MAX(created_at) FROM messages m WHERE m.group_id = g.id) as max_msg_time,
  (SELECT COUNT(*) FROM messages m WHERE m.group_id = g.id AND m.created_at > COALESCE(gm.last_read_at, '1970-01-01')) as unread_count
  FROM groups g
  JOIN group_members gm ON g.id = gm.group_id
`).all();
console.log(groups);
