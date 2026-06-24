const fs = require('fs');
const Database = require('better-sqlite3');
const dbs = ['/app/applet/chat.db', '/app/applet/database.sqlite', '/app/applet/server/database.sqlite'];
for (const dbPath of dbs) {
  if (fs.existsSync(dbPath)) {
    const db = new Database(dbPath);
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      console.log(dbPath, 'Tables:', tables.length);
    } catch(e) {
      console.log(dbPath, 'Error');
    }
  }
}
