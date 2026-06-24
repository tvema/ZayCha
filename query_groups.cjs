import Database from 'better-sqlite3';
const db = new Database('./database.sqlite');
const groups = db.prepare(`
  SELECT g.*, gm.role, gm.joined_at, gm.last_read_at, gm.encrypted_keys,
  (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
  (SELECT COUNT(*) FROM messages m WHERE m.group_id = g.id AND m.created_at > COALESCE(gm.last_read_at, '1970-01-01')) as unread_count,
  (SELECT MAX(created_at) FROM messages m WHERE m.group_id = g.id) as last_message_timestamp
  FROM groups g
  JOIN group_members gm ON g.id = gm.group_id
`).all();
console.log('Groups array length:', groups.length);
if (groups.length > 0) console.log(groups[0]);
