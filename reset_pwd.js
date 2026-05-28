import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const db = new Database('./chat.db');
const run = async () => {
    const hash = await bcrypt.hash('password123', 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE username = 'zaqc'").run(hash);
    console.log('Password reset to password123');
};
run();
