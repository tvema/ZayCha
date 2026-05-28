import Database from 'better-sqlite3';
import { initializeDatabase } from './schema.js';

// Setup Database
const db = new Database('chat.db');
db.pragma('journal_mode = WAL');

initializeDatabase(db);

export default db;
