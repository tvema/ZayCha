const Database = require('better-sqlite3');
const db = new Database(':memory:');
db.exec(`
  CREATE TABLE t_num (d DATETIME);
  CREATE TABLE t_txt (d TEXT);
  INSERT INTO t_num (d) VALUES ('2026-06-24T10:00:00.000Z');
  INSERT INTO t_txt (d) VALUES ('2026-06-24T11:00:00.000Z');
`);
const res1 = db.prepare("SELECT * FROM t_num n, t_txt t WHERE n.d < t.d").all();
console.log('n.d < t.d:', res1.length > 0);
const res2 = db.prepare("SELECT * FROM t_num n, t_txt t WHERE n.d > t.d").all();
console.log('n.d > t.d:', res2.length > 0);
const numType = db.prepare("SELECT typeof(d) as t FROM t_num").get().t;
const txtType = db.prepare("SELECT typeof(d) as t FROM t_txt").get().t;
console.log('types:', numType, txtType);
