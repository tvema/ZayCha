import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authenticateToken } from '../auth.js';
import { upload } from '../upload.js';

export function setupUserRoutes(server: express.Express, io: any, connectedUsers: Map<string, Set<string>>) {
  const notifyContactUpdated = (userId1: string, userId2: string) => {
    [userId1, userId2].forEach(userId => {
      if (!userId) return;
      const targetSockets = connectedUsers.get(userId);
      if (targetSockets) {
        targetSockets.forEach(socketId => io.to(socketId).emit('contact:updated'));
      }
    });
  };

  // 4. Get Profile
  server.get('/api/users/me', authenticateToken, (req: any, res) => {
    try {
      let user: any;
      try {
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
        if (!user) {
          console.warn(`[AUTH] Profile check failed: User ${req.user.userId} not found`);
          return res.status(404).json({ error: 'User not found' });
        }
      } catch (e: any) {
        console.error(`[AUTH] Profile DB error: ${e.message}`);
        throw e;
      }
      res.json(user);
    } catch (err: any) {
      console.error('Error in /api/users/me:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 4.1 Update Avatar
  server.post('/api/users/avatar', authenticateToken, upload.single('avatar'), (req: any, res) => {
    try {
      if (!req.file) {
        console.warn(`[AVATAR] No file uploaded for user ${req.user.userId}`);
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const avatarUrl = `/uploads/${req.file.filename}`;
      console.log(`[AVATAR] Updating user ${req.user.userId} avatar to ${avatarUrl}`);
      db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.user.userId);
      res.json({ avatarUrl });
    } catch (err: any) {
      console.error('[AVATAR] Error updating user avatar:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 4.2 Update Profile
  server.put('/api/users/profile', authenticateToken, (req: any, res) => {
    try {
      const { firstName, lastName, email, phone } = req.body;
      db.prepare('UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE id = ?')
        .run(firstName, lastName, email, phone, req.user.userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4.3 Change Password
  server.put('/api/users/password', authenticateToken, async (req: any, res) => {
    try {
      const { oldPassword, newPassword, encryptedPrivateKey } = req.body;
      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.userId) as any;
      
      if (!user || !(await bcrypt.compare(oldPassword, user.password_hash))) {
        return res.status(401).json({ error: 'Invalid old password' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      
      if (encryptedPrivateKey) {
        db.prepare('UPDATE users SET password_hash = ?, encrypted_private_key = ? WHERE id = ?').run(passwordHash, encryptedPrivateKey, req.user.userId);
      } else {
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, req.user.userId);
      }
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4.4 Update Keys (for old users)
  server.put('/api/users/keys', authenticateToken, (req: any, res) => {
    try {
      const { publicKey, encryptedPrivateKey } = req.body;
      if (!publicKey || !encryptedPrivateKey) {
        return res.status(400).json({ error: 'Missing keys' });
      }
      
      const user = db.prepare('SELECT public_key FROM users WHERE id = ?').get(req.user.userId) as any;
      if (user && user.public_key) {
        return res.status(400).json({ error: 'User already has keys' });
      }

      db.prepare('UPDATE users SET public_key = ?, encrypted_private_key = ? WHERE id = ?').run(publicKey, encryptedPrivateKey, req.user.userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Generate Invite (Kept here or auth?) -> Moved to auth, so skip it here, wait, I already copied it to auth, let me check later if it was duplicated, it will be stripped. Wait, the original had it in both. Let's just leave it out here because we put it in auth.ts.

  // 6. Search Users
  server.get('/api/users/search', authenticateToken, (req: any, res) => {
    try {
      const { q } = req.query;
      
      let users: any[];
      try {
        if (q) {
          users = db.prepare(`
            SELECT u.*,
                   (SELECT MAX(created_at) FROM messages 
                    WHERE (sender_id = ? AND receiver_id = u.id) 
                       OR (sender_id = u.id AND receiver_id = ?)) as last_message_timestamp
            FROM users u
            WHERE (u.username LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.phone LIKE ?)
            AND u.id != ? AND u.id != 'system'
            LIMIT 20
          `).all(req.user.userId, req.user.userId, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, req.user.userId);
        } else {
          users = db.prepare(`
            SELECT u.*,
                   (SELECT MAX(created_at) FROM messages 
                    WHERE (sender_id = ? AND receiver_id = u.id) 
                       OR (sender_id = u.id AND receiver_id = ?)) as last_message_timestamp
            FROM users u
            WHERE u.id != ? AND u.id != 'system'
            LIMIT 50
          `).all(req.user.userId, req.user.userId, req.user.userId);
        }
      } catch (e: any) {
        throw e;
      }
      
      const usersWithOnlineStatus = users.map((u: any) => ({
        ...u,
        is_online: connectedUsers.has(u.id) && (connectedUsers.get(u.id)?.size || 0) > 0
      }));
      
      res.json(usersWithOnlineStatus);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Add Contact
  server.post('/api/contacts', authenticateToken, (req: any, res) => {
    const { contactId } = req.body;
    try {
      db.prepare('INSERT OR IGNORE INTO contacts (user_id, contact_id) VALUES (?, ?)').run(req.user.userId, contactId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7.05 Bulk Add Contacts
  server.post('/api/contacts/bulk', authenticateToken, (req: any, res) => {
    const { contactIds } = req.body;
    if (!Array.isArray(contactIds)) {
      return res.status(400).json({ error: 'contactIds must be an array' });
    }
    try {
      const stmt = db.prepare('INSERT OR IGNORE INTO contacts (user_id, contact_id) VALUES (?, ?)');
      let added = 0;
      db.transaction(() => {
        for (const cid of contactIds) {
          if (cid && cid !== req.user.userId) {
            const info = stmt.run(req.user.userId, cid);
            if (info.changes > 0) added++;
          }
        }
      })();
      res.json({ success: true, added });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7.1 Remove Contact
  server.delete('/api/contacts/:contactId', authenticateToken, (req: any, res) => {
    const { contactId } = req.params;
    try {
      db.prepare('DELETE FROM contacts WHERE user_id = ? AND contact_id = ?').run(req.user.userId, contactId);
      notifyContactUpdated(req.user.userId, contactId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7.1.1 Change Contact Circle
  server.put('/api/contacts/:contactId/circle', authenticateToken, (req: any, res) => {
    const { contactId } = req.params;
    const { circle_type } = req.body;
    if (!['normal', 'dnd', 'blacklist'].includes(circle_type)) {
      return res.status(400).json({ error: 'Invalid circle type' });
    }
    try {
      db.prepare('UPDATE contacts SET circle_type = ? WHERE user_id = ? AND contact_id = ?').run(circle_type, req.user.userId, contactId);
      notifyContactUpdated(req.user.userId, contactId);
      res.json({ success: true, circle_type });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7.2 Clear Chat
  server.delete('/api/messages/:contactId/clear', authenticateToken, (req: any, res) => {
    const { contactId } = req.params;
    const isGroup = req.query.isGroup === 'true';
    try {
      if (isGroup) {
        const member = db.prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?').get(contactId, req.user.userId);
        if (!member) return res.status(403).json({ error: 'Not a member of this group' });
        db.prepare('DELETE FROM messages WHERE group_id = ?').run(contactId);
      } else {
        db.prepare('DELETE FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)')
          .run(req.user.userId, contactId, contactId, req.user.userId);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Get Contacts
  server.get('/api/contacts', authenticateToken, (req: any, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      let contacts: any[];
      try {
        contacts = db.prepare(`
          SELECT u.*, 
                 COALESCE(c.is_pinned, 0) as is_pinned,
                 COALESCE(c.circle_type, 'normal') as circle_type,
                 (SELECT CASE WHEN circle_type = 'blacklist' THEN 1 ELSE 0 END FROM contacts WHERE user_id = u.id AND contact_id = ?) as is_blacklisted_by,
                 CASE WHEN c.contact_id IS NOT NULL THEN 1 ELSE 0 END as is_contact,
                 (SELECT COUNT(*) FROM messages m WHERE m.sender_id = u.id AND m.receiver_id = ? AND m.status != 'read') as unread_count,
                 (SELECT MAX(created_at) FROM messages m WHERE (m.sender_id = u.id AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = u.id)) as last_message_timestamp
          FROM users u
          LEFT JOIN contacts c ON u.id = c.contact_id AND c.user_id = ?
          WHERE (c.contact_id IS NOT NULL 
             OR u.id IN (
                 SELECT sender_id FROM messages WHERE receiver_id = ?
                 UNION
                 SELECT receiver_id FROM messages WHERE sender_id = ?
             ))
          AND u.id != 'system'
        `).all(req.user.userId, req.user.userId, req.user.userId, req.user.userId, req.user.userId, req.user.userId, req.user.userId);
        
        // Filter out the current user from the results
        contacts = contacts.filter((c: any) => c.id !== req.user.userId);
      } catch (e: any) {
        throw e;
      }
      
      const contactsWithOnlineStatus = contacts.map((c: any) => ({
        ...c,
        is_online: connectedUsers.has(c.id) && (connectedUsers.get(c.id)?.size || 0) > 0
      }));
      
      res.json(contactsWithOnlineStatus);
    } catch (err: any) {
      console.error('Error in /api/contacts:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Request unblock
  server.post('/api/contacts/:contactId/request_unblock', authenticateToken, (req: any, res) => {
    try {
      const { contactId } = req.params;
      const messageId = uuidv4();
      const content = "[[SYSTEM_REQUEST_UNBLOCK]]";
      
      db.prepare('INSERT INTO messages (id, sender_id, receiver_id, content, status, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        messageId, req.user.userId, contactId, content, 'sent', new Date().toISOString()
      );
      
      const targetSockets = connectedUsers.get(contactId);
      if (targetSockets && targetSockets.size > 0) {
        const sender = db.prepare('SELECT username FROM users WHERE id = ?').get(req.user.userId) as any;
        targetSockets.forEach(socketId => io.to(socketId).emit('message:new', {
          id: messageId,
          sender_id: req.user.userId,
          sender_username: sender?.username || 'Unknown',
          receiver_id: contactId,
          content,
          status: 'sent',
          created_at: new Date().toISOString(),
          reactions: []
        }));
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8.2 Contact Circles
  server.get('/api/contact-circles', authenticateToken, (req: any, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const circles = db.prepare('SELECT * FROM contact_circles WHERE user_id = ?').all(req.user.userId);
      const circlesWithMembers = circles.map((circle: any) => {
        const members = db.prepare('SELECT contact_id FROM contact_circle_members WHERE circle_id = ?').all(circle.id);
        return { ...circle, members: members.map((m: any) => m.contact_id) };
      });
      res.json(circlesWithMembers);
    } catch (err: any) {
      console.error('Error in GET /api/contact-circles:', err);
      res.status(500).json({ error: err.message });
    }
  });

  server.post('/api/contact-circles', authenticateToken, (req: any, res) => {
    const { name, do_not_disturb, is_hidden, is_blacklist, password } = req.body;
    const id = uuidv4();
    let password_hash = null;
    if (password) {
      password_hash = bcrypt.hashSync(password, 10);
    }
    try {
      db.prepare(`
        INSERT INTO contact_circles (id, user_id, name, do_not_disturb, is_hidden, is_blacklist, password_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, req.user.userId, name, do_not_disturb ? 1 : 0, is_hidden ? 1 : 0, is_blacklist ? 1 : 0, password_hash);
      res.json({ id, name, do_not_disturb: do_not_disturb ? 1 : 0, is_hidden: is_hidden ? 1 : 0, is_blacklist: is_blacklist ? 1 : 0, members: [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.put('/api/contact-circles/:id', authenticateToken, (req: any, res) => {
    const { name, do_not_disturb, is_hidden, is_blacklist, password } = req.body;
    let password_hash = undefined;
    if (password !== undefined) {
      password_hash = password ? bcrypt.hashSync(password, 10) : null;
    }
    
    try {
      const circle = db.prepare('SELECT * FROM contact_circles WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
      if (!circle) return res.status(404).json({ error: 'Circle not found' });

      if (password_hash !== undefined) {
        db.prepare(`
          UPDATE contact_circles SET name = ?, do_not_disturb = ?, is_hidden = ?, is_blacklist = ?, password_hash = ? WHERE id = ?
        `).run(name, do_not_disturb ? 1 : 0, is_hidden ? 1 : 0, is_blacklist ? 1 : 0, password_hash, req.params.id);
      } else {
        db.prepare(`
          UPDATE contact_circles SET name = ?, do_not_disturb = ?, is_hidden = ?, is_blacklist = ? WHERE id = ?
        `).run(name, do_not_disturb ? 1 : 0, is_hidden ? 1 : 0, is_blacklist ? 1 : 0, req.params.id);
      }
      res.json({ id: req.params.id, name, do_not_disturb: do_not_disturb ? 1 : 0, is_hidden: is_hidden ? 1 : 0, is_blacklist: is_blacklist ? 1 : 0 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.delete('/api/contact-circles/:id', authenticateToken, (req: any, res) => {
    try {
      db.prepare('DELETE FROM contact_circle_members WHERE circle_id = ?').run(req.params.id);
      db.prepare('DELETE FROM contact_circles WHERE id = ? AND user_id = ?').run(req.params.id, req.user.userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.post('/api/contact-circles/:id/members', authenticateToken, (req: any, res) => {
    const { contactId } = req.body;
    try {
      const circle = db.prepare('SELECT * FROM contact_circles WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
      if (!circle) return res.status(404).json({ error: 'Circle not found' });
      
      db.prepare('INSERT OR IGNORE INTO contact_circle_members (circle_id, contact_id) VALUES (?, ?)').run(req.params.id, contactId);
      notifyContactUpdated(req.user.userId, contactId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.delete('/api/contact-circles/:id/members/:contactId', authenticateToken, (req: any, res) => {
    try {
      const circle = db.prepare('SELECT * FROM contact_circles WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
      if (!circle) return res.status(404).json({ error: 'Circle not found' });

      db.prepare('DELETE FROM contact_circle_members WHERE circle_id = ? AND contact_id = ?').run(req.params.id, req.params.contactId);
      notifyContactUpdated(req.user.userId, req.params.contactId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.post('/api/contact-circles/:id/unlock', authenticateToken, (req: any, res) => {
    const { password } = req.body;
    try {
      const circle = db.prepare('SELECT * FROM contact_circles WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId) as any;
      if (!circle) return res.status(404).json({ error: 'Circle not found' });
      
      if (!circle.password_hash) return res.json({ success: true });
      
      if (bcrypt.compareSync(password, circle.password_hash)) {
        res.json({ success: true });
      } else {
        res.status(401).json({ error: 'Invalid password' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.post('/api/contact-circles/move', authenticateToken, (req: any, res) => {
    const { contactId, fromCircleId, toCircleId } = req.body;
    try {
      db.transaction(() => {
        if (fromCircleId) {
          db.prepare('DELETE FROM contact_circle_members WHERE circle_id = ? AND contact_id = ?').run(fromCircleId, contactId);
        }
        if (toCircleId) {
          db.prepare('INSERT OR IGNORE INTO contact_circle_members (circle_id, contact_id) VALUES (?, ?)').run(toCircleId, contactId);
        }
      })();
      notifyContactUpdated(req.user.userId, contactId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
