import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { upload } from '../upload.js';
import { authenticateToken, JWT_SECRET } from '../auth.js';
import { sendEmail } from '../mailer.js';

export function setupAuthRoutes(server: express.Express, io: any, connectedUsers: Map<string, Set<string>>) {
  // 1. Check Invite Code
  server.get('/api/invites/check/:code', (req, res) => {
    const { code } = req.params;
    const invite = db.prepare('SELECT * FROM invites WHERE code = ? AND is_used = 0').get(code);
    if (invite) {
      res.json({ valid: true, invite });
    } else {
      res.status(400).json({ valid: false, message: 'Invalid or used invite code' });
    }
  });

  // 1.1 Generate Invite
  server.post('/api/invites/generate', authenticateToken, (req: any, res) => {
    try {
      const user = db.prepare('SELECT email_verified FROM users WHERE id = ?').get(req.user.userId) as any;
      if (!user || user.email_verified !== 1) {
        return res.status(400).json({ error: 'EMAIL_NOT_VERIFIED' });
      }

      const code = uuidv4().split('-')[0].toUpperCase();
      const id = uuidv4();
      db.prepare('INSERT INTO invites (id, code, sender_id) VALUES (?, ?, ?)').run(id, code, req.user.userId);
      res.json({ code });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Register
  server.post('/api/auth/register', upload.single('avatar'), async (req, res) => {
    try {
      const { inviteCode, username, firstName, lastName, email, phone, password, publicKey, encryptedPrivateKey } = req.body;
      
      const invite = db.prepare('SELECT * FROM invites WHERE code = ? AND is_used = 0').get(inviteCode) as any;
      if (!invite) {
        return res.status(400).json({ error: 'Invalid invite code' });
      }

      const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
      if (existingUser) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      const avatarUrl = req.file ? `/uploads/${req.file.filename}` : null;

      let insertColumns = 'id, username, first_name, last_name, email, phone, password_hash, avatar_url, public_key, encrypted_private_key, invited_by';
      let insertValues = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?';
      const insertParams: any[] = [userId, username, firstName, lastName, email, phone, passwordHash, avatarUrl, publicKey || null, encryptedPrivateKey || null, invite.sender_id];

      db.prepare(`
        INSERT INTO users (${insertColumns})
        VALUES (${insertValues})
      `).run(...insertParams);

      db.prepare('UPDATE invites SET is_used = 1, used_by = ? WHERE id = ?').run(userId, invite.id);

      // Add inviter to contacts automatically (if not system)
      if (invite.sender_id !== 'system') {
        db.prepare('INSERT OR IGNORE INTO contacts (user_id, contact_id) VALUES (?, ?)').run(userId, invite.sender_id);
        db.prepare('INSERT OR IGNORE INTO contacts (user_id, contact_id) VALUES (?, ?)').run(invite.sender_id, userId);
        
        // Notify inviter about new contact
        const inviterSockets = connectedUsers.get(invite.sender_id);
        if (inviterSockets) {
          const newUser = db.prepare('SELECT id, username, first_name, last_name, email, phone, avatar_url, public_key FROM users WHERE id = ?').get(userId);
          inviterSockets.forEach(socketId => {
            io.to(socketId).emit('contact:new', newUser);
          });
        }
      }

      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
      
      // Create session
      const sessionId = uuidv4();
      const userAgent = req.headers['user-agent'] || 'Unknown Device';
      const ipAddress = req.ip || (req.socket ? req.socket.remoteAddress : null) || 'Unknown IP';
      db.prepare('INSERT INTO sessions (id, user_id, token, device_info, ip_address) VALUES (?, ?, ?, ?, ?)')
        .run(sessionId, userId, token, userAgent, ipAddress);

      res.json({ 
        token, 
        user: { 
          id: userId, 
          username, 
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          avatar_url: avatarUrl,
          public_key: publicKey || null
        } 
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Login
  server.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username) as any;
      
      if (!user) {
        return res.status(401).json({ error: 'Пользователь не найден (User not found)' });
      }
      
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Неверный пароль (Invalid password)' });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      
      // Create session
      const sessionId = uuidv4();
      const userAgent = req.headers['user-agent'] || 'Unknown Device';
      const ipAddress = req.ip || (req.socket ? req.socket.remoteAddress : null) || 'Unknown IP';
      
      try {
        db.prepare('INSERT INTO sessions (id, user_id, token, device_info, ip_address) VALUES (?, ?, ?, ?, ?)')
          .run(sessionId, user.id, token, userAgent, ipAddress);
      } catch (sessionErr: any) {
        console.error(`[AUTH] Failed to create session: ${sessionErr.message}`);
        // Continue anyway if database write failed? No, we need session
        throw new Error('Failed to create session');
      }

      res.json({ 
        token, 
        user: { 
          id: user.id, 
          username: user.username, 
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          phone: user.phone,
          avatar_url: user.avatar_url,
          public_key: user.public_key,
          encrypted_private_key: user.encrypted_private_key,
          email_verified: !!user.email_verified
        } 
      });
    } catch (err: any) {
      console.error(`[AUTH] Login error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // 3.0.1 Forgot Password
  server.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      const normalizedEmail = (email || '').trim().toLowerCase();
      
      console.log(`Password reset requested for: "${normalizedEmail}"`);
      
      // Let's do a case-insensitive lookup just to be safe
      const user = db.prepare('SELECT id, first_name FROM users WHERE LOWER(email) = ?').get(normalizedEmail) as any;
      if (!user) {
        console.warn(`User not found for email: "${normalizedEmail}"`);
        throw new Error('Пользователь с таким email не найден в базе данных.');
      }

      console.log(`User found (${user.id}), writing reset token to DB...`);
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

      db.prepare('INSERT INTO password_resets (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(uuidv4(), user.id, token, expiresAt);

      const resetLink = `https://${process.env.APP_URL || req.get('host')}/reset-password?token=${token}`;
      console.log(`Reset link generated: ${resetLink}`);
      
      const emailHtml = `
        <h3>Здравствуйте, ${user.first_name}!</h3>
        <p>Вы запросили сброс пароля для вашего аккаунта в ZayChat.</p>
        <p>Для создания нового пароля и ключей шифрования (старая история сообщений будет сброшена) перейдите по ссылке:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>Если вы не запрашивали сброс, просто проигнорируйте это письмо.</p>
        <p>Ссылка действительна 1 час.</p>
      `;

      console.log(`Sending email to ${normalizedEmail} using SMTP User: ${process.env.SMTP_USER}`);
      await sendEmail({
        to: normalizedEmail,
        subject: 'Сброс пароля ZayChat',
        html: emailHtml
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error('FORGOT PASSWORD ERROR:', err.message);
      res.status(500).json({ error: err.message || 'Ошибка обработки запроса' });
    }
  });

  // 3.0.2 Rest Password
  server.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword, publicKey, encryptedPrivateKey } = req.body;

      const resetRecord = db.prepare('SELECT * FROM password_resets WHERE token = ?').get(token) as any;
      
      if (!resetRecord) {
        return res.status(400).json({ error: 'Invalid or expired token' });
      }

      const now = new Date().toISOString();
      if (resetRecord.expires_at < now) {
        db.prepare('DELETE FROM password_resets WHERE id = ?').run(resetRecord.id);
        return res.status(400).json({ error: 'Token has expired' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      const updateStmt = db.prepare(`
        UPDATE users 
        SET password_hash = ?, public_key = ?, encrypted_private_key = ? 
        WHERE id = ?
      `);
      
      updateStmt.run(passwordHash, publicKey, encryptedPrivateKey, resetRecord.user_id);
      
      // Delete token after successful use
      db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(resetRecord.user_id);

      // Optionally, kill all existing sessions for this user
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(resetRecord.user_id);

      res.json({ success: true });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // 3.0.3 Request Email Verification
  server.post('/api/auth/send-verification-email', authenticateToken, async (req: any, res) => {
    try {
      const user = db.prepare('SELECT id, email, first_name, email_verified FROM users WHERE id = ?').get(req.user.userId) as any;
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (user.email_verified) {
        return res.status(400).json({ error: 'Email already verified' });
      }

      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 86400000).toISOString(); // 24 hours

      db.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(user.id);
      db.prepare('INSERT INTO email_verifications (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(uuidv4(), user.id, token, expiresAt);

      const verifyLink = `https://${process.env.APP_URL || req.get('host')}/verify-email?token=${token}`;
      
      const emailHtml = `
        <h3>Здравствуйте, ${user.first_name}!</h3>
        <p>Для подтверждения вашего email адреса в ZayChat, пожалуйста, перейдите по ссылке ниже:</p>
        <p><a href="${verifyLink}">${verifyLink}</a></p>
        <p>Ссылка действительна 24 часа. Подтвержденный email необходим для отправки приглашений новым пользователям.</p>
        <p>Если вы не регистрировались, просто проигнорируйте это письмо.</p>
      `;

      await sendEmail({
        to: user.email,
        subject: 'Подтверждение Email - ZayChat',
        html: emailHtml
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error('VERIFY EMAIL ERROR:', err.message);
      res.status(500).json({ error: err.message || 'Failed to send verification email' });
    }
  });

  // 3.0.4 Verify Email
  server.post('/api/auth/verify-email', async (req, res) => {
    try {
      const { token } = req.body;
      const verifyRecord = db.prepare('SELECT * FROM email_verifications WHERE token = ?').get(token) as any;
      
      if (!verifyRecord) {
        return res.status(400).json({ error: 'Неверный или просроченный токен' });
      }

      const now = new Date().toISOString();
      if (verifyRecord.expires_at < now) {
        db.prepare('DELETE FROM email_verifications WHERE id = ?').run(verifyRecord.id);
        return res.status(400).json({ error: 'Срок действия ссылки истёк' });
      }

      db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(verifyRecord.user_id);
      db.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(verifyRecord.user_id);

      res.json({ success: true });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Failed to verify email' });
    }
  });

  // 3.1 Get Active Sessions
  server.get('/api/sessions', authenticateToken, (req: any, res) => {
    try {
      const sessions = db.prepare('SELECT id, device_info, ip_address, last_active, created_at, token FROM sessions WHERE user_id = ? ORDER BY last_active DESC').all(req.user.userId);
      // Mark current session
      const sessionsWithCurrent = sessions.map((s: any) => ({
        ...s,
        is_current: s.token === req.token
      }));
      // Remove token from response for security
      sessionsWithCurrent.forEach((s: any) => delete s.token);
      res.json(sessionsWithCurrent);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3.2 Terminate Session
  server.delete('/api/sessions/:id', authenticateToken, (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(sessionId, req.user.userId) as any;
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);

      io.to(`user:${req.user.userId}`).emit('auth:session_revoked', { token: session.token });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3.3 Logout
  server.post('/api/auth/logout', authenticateToken, (req: any, res) => {
    try {
      // Find the session matching the current token
      const session = db.prepare('SELECT id FROM sessions WHERE token = ? AND user_id = ?').get(req.token, req.user.userId) as any;
      
      if (session) {
        db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
      }
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
