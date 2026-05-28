import { setupGroupRoutes } from './routes/groups.js';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from './db';
import { upload } from './upload';
import { authenticateToken, JWT_SECRET } from './auth';
import { GoogleGenAI } from '@google/genai';
import Groq, { toFile } from 'groq-sdk';
import nodeFetch from 'node-fetch';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { sendEmail } from './mailer';
import { setupAuthRoutes } from './routes/auth.js';

let vapidKeys = { publicKey: process.env.VAPID_PUBLIC_KEY || '', privateKey: process.env.VAPID_PRIVATE_KEY || '' };
const vapidPath = path.join(process.cwd(), 'vapid_keys.json');

try {
  if (vapidKeys.publicKey && vapidKeys.privateKey) {
    // Already set via env
  } else if (fs.existsSync(vapidPath)) {
    vapidKeys = JSON.parse(fs.readFileSync(vapidPath, 'utf8'));
  } else {
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(vapidPath, JSON.stringify(vapidKeys));
  }
  webpush.setVapidDetails('mailto:admin@zstate.ru', vapidKeys.publicKey, vapidKeys.privateKey);
} catch (e) {
  console.error("Failed to initialize VAPID keys", e);
}

export function setupRoutes(server: express.Express, io: any, connectedUsers: Map<string, Set<string>>) {
  const notifyContactUpdated = (userId1: string, userId2: string) => {
    [userId1, userId2].forEach(userId => {
      if (!userId) return;
      const targetSockets = connectedUsers.get(userId);
      if (targetSockets) {
        targetSockets.forEach(socketId => io.to(socketId).emit('contact:updated'));
      }
    });
  };

  // Auth routes are moved to server/routes/auth.ts
  // 1-3. Auth Routes (Register, Login, Password Reset, Email Verify, Sessions, Invites)
  setupAuthRoutes(server, io, connectedUsers);

  setupGroupRoutes(server, io, connectedUsers);


  // Upload file endpoint
  server.post('/api/upload', authenticateToken, upload.single('file'), (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      
      // Fix for multer/busboy latin1 encoding issue with utf8 filenames
      let originalName = req.file.originalname;
      try {
        originalName = decodeURIComponent(originalName);
      } catch(e) {
        try {
          originalName = Buffer.from(originalName, 'latin1').toString('utf8');
        } catch (e2) {}
      }
      
      res.json({ url: fileUrl, name: originalName, size: req.file.size, mime: req.file.mimetype });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Download file endpoint
  server.get('/api/download', async (req: any, res) => {
    try {
      const fileUrl = req.query.url;
      const filename = req.query.filename || 'download';
      
      if (!fileUrl || typeof fileUrl !== 'string') {
        return res.status(400).send('Missing url parameter');
      }

      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      
      if (fileUrl.startsWith('/uploads/') || fileUrl.includes('/uploads/')) {
         // handle both absolute and relative URLs
         const match = fileUrl.match(/\/uploads\/(.+)$/);
         if (match && match[1]) {
           let theFile = match[1];
           if (theFile.includes('?')) {
               theFile = theFile.split('?')[0];
           }
           const filepath = path.join(uploadDir, theFile);
           if (fs.existsSync(filepath)) {
              return res.download(filepath, filename);
           }
         }
      }
      
      // If it's an external URL, proxy it to force download headers
      if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
        try {
          const response = await fetch(fileUrl);
          if (response.ok && response.body) {
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
            
            // @ts-ignore
            const { Readable } = require('stream');
            const readable = Readable.fromWeb(response.body);
            readable.pipe(res);
            return;
          }
        } catch (fetchErr) {
          console.error("Proxy download failed:", fetchErr);
        }
      }

      // Fallback
      res.redirect(fileUrl);
    } catch(err) {
      res.status(500).send('Download failed');
    }
  });

  // 9. Get Messages
  server.get('/api/messages/:contactId', authenticateToken, (req: any, res) => {
    try {
      const { contactId } = req.params;
      const isGroup = req.query.isGroup === 'true';
      const before = req.query.before as string;
      const after = req.query.after as string;
      const limit = after ? 1000 : (parseInt(req.query.limit as string) || 30);
      
      let messages;
      if (isGroup) {
        let query = `
          SELECT m.*, mt.thumbnail as external_thumbnail,
                 u.username as sender_username, u.first_name as sender_first_name, u.last_name as sender_last_name, u.avatar_url as sender_avatar_url,
                 u2.username as forwarded_from_username,
                 (SELECT json_group_array(json_object('id', r.id, 'emoji', r.emoji, 'user_id', r.user_id))
                  FROM reactions r WHERE r.message_id = m.id) as reactions
          FROM messages m
          LEFT JOIN users u ON m.sender_id = u.id
          LEFT JOIN users u2 ON m.forwarded_from = u2.id
          LEFT JOIN message_thumbnails mt ON m.id = mt.message_id
          WHERE m.group_id = ?
        `;
        const params: any[] = [contactId];
        
        if (before) {
          query += ` AND m.created_at < ?`;
          params.push(before);
        }
        
        if (after) {
          query += ` AND m.created_at > ?`;
          params.push(after);
        }
        
        query += ` ORDER BY m.created_at DESC LIMIT ?`;
        params.push(limit);
        
        messages = db.prepare(query).all(...params);
        
        // Update last_read_at for group member
        db.prepare('UPDATE group_members SET last_read_at = CURRENT_TIMESTAMP WHERE group_id = ? AND user_id = ?')
          .run(contactId, req.user.userId);
      } else {
        let query = `
          SELECT m.*, mt.thumbnail as external_thumbnail,
                 u.username as sender_username, u.first_name as sender_first_name, u.last_name as sender_last_name, u.avatar_url as sender_avatar_url,
                 u2.username as forwarded_from_username,
                 (SELECT json_group_array(json_object('id', r.id, 'emoji', r.emoji, 'user_id', r.user_id))
                  FROM reactions r WHERE r.message_id = m.id) as reactions
          FROM messages m
          LEFT JOIN users u ON m.sender_id = u.id
          LEFT JOIN users u2 ON m.forwarded_from = u2.id
          LEFT JOIN message_thumbnails mt ON m.id = mt.message_id
          WHERE ((m.sender_id = ? AND m.receiver_id = ?)
             OR (m.sender_id = ? AND m.receiver_id = ?))
        `;
        const params: any[] = [req.user.userId, contactId, contactId, req.user.userId];
        
        if (before) {
          query += ` AND m.created_at < ?`;
          params.push(before);
        }
        
        if (after) {
          query += ` AND m.created_at > ?`;
          params.push(after);
        }
        
        query += ` ORDER BY m.created_at DESC LIMIT ?`;
        params.push(limit);
        
        messages = db.prepare(query).all(...params);
      }
      
      // Parse JSON reactions and encryption_data, and reverse to get ASC order
      const parsedMessages = messages.map((m: any) => ({
        ...m,
        reactions: JSON.parse(m.reactions || '[]'),
        encryption_data: m.encryption_data ? JSON.parse(m.encryption_data) : null
      })).reverse();
      
      res.json(parsedMessages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.get('/api/messages/:contactId/media', authenticateToken, (req: any, res) => {
    try {
      const { contactId } = req.params;
      const isGroup = req.query.isGroup === 'true';
      const limit = parseInt(req.query.limit as string) || 50;
      const before = req.query.before as string;
      
      let messages;
      if (isGroup) {
        let query = `
          SELECT m.*, mt.thumbnail as external_thumbnail
          FROM messages m
          LEFT JOIN message_thumbnails mt ON m.id = mt.message_id
          WHERE m.group_id = ? 
          AND (m.content LIKE '%"type":"file"%' OR m.content LIKE '%"type":"link"%' OR m.content LIKE '%http%' OR m.is_media = 1)
        `;
        const params: any[] = [contactId];
        
        if (before) {
          query += ` AND m.created_at < ?`;
          params.push(before);
        }
        
        query += ` ORDER BY m.created_at DESC LIMIT ?`;
        params.push(limit);
        
        messages = db.prepare(query).all(...params);
      } else {
        let query = `
          SELECT m.*, mt.thumbnail as external_thumbnail
          FROM messages m
          LEFT JOIN message_thumbnails mt ON m.id = mt.message_id
          WHERE ((m.sender_id = ? AND m.receiver_id = ?)
             OR (m.sender_id = ? AND m.receiver_id = ?))
          AND (m.content LIKE '%"type":"file"%' OR m.content LIKE '%"type":"link"%' OR m.content LIKE '%http%' OR m.is_media = 1)
        `;
        const params: any[] = [req.user.userId, contactId, contactId, req.user.userId];
        
        if (before) {
          query += ` AND m.created_at < ?`;
          params.push(before);
        }
        
        query += ` ORDER BY m.created_at DESC LIMIT ?`;
        params.push(limit);
        
        messages = db.prepare(query).all(...params);
      }
      
      const parsedMessages = messages.map((m: any) => ({
        ...m,
        encryption_data: m.encryption_data ? JSON.parse(m.encryption_data) : null
      }));
      
      res.json(parsedMessages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reminders
  server.get('/api/reminders', authenticateToken, (req: any, res) => {
    try {
      const reminders = db.prepare(`
        SELECT r.*, 
               CASE WHEN m.id IS NOT NULL THEN json_object(
                 'id', m.id, 'content', m.content, 'sender_id', m.sender_id, 'created_at', m.created_at,
                 'sender_username', u.username, 'sender_first_name', u.first_name, 'sender_last_name', u.last_name,
                 'encryption_data', m.encryption_data, 'group_id', m.group_id
               ) ELSE NULL END as message
        FROM message_reminders r
        LEFT JOIN messages m ON r.message_id = m.id
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE r.user_id = ?
        ORDER BY r.remind_at ASC
      `).all(req.user.userId);

      const parsedReminders = reminders.map((r: any) => ({
        ...r,
        is_pinned: Boolean(r.is_pinned),
        is_dismissed: Boolean(r.is_dismissed),
        message: r.message ? JSON.parse(r.message) : undefined
      }));

      res.json(parsedReminders);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.post('/api/reminders', authenticateToken, (req: any, res) => {
    try {
      const { chat_id, message_id, remind_at, is_pinned, comment, recurrence, target_user_ids } = req.body;
      
      let targetUserIds = [req.user.userId];
      if (Array.isArray(target_user_ids) && target_user_ids.length > 0) {
        targetUserIds = target_user_ids;
      }
      
      const addedReminders: { id: string, userId: string }[] = [];
      const stmt = db.prepare(`
        INSERT INTO message_reminders (id, user_id, chat_id, message_id, remind_at, is_pinned, comment, recurrence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      db.transaction(() => {
        for (const targetUserId of targetUserIds) {
          const id = uuidv4();
          stmt.run(id, targetUserId, chat_id, message_id || '', remind_at, is_pinned ? 1 : 0, comment || null, recurrence || 'none');
          addedReminders.push({ id, userId: targetUserId });
        }
      })();

      let newReminder = null;
      const myReminderObj = addedReminders.find(r => r.userId === req.user.userId);
      
      if (myReminderObj) {
        newReminder = db.prepare(`
          SELECT r.*, 
                 CASE WHEN m.id IS NOT NULL THEN json_object(
                   'id', m.id, 'content', m.content, 'sender_id', m.sender_id, 'created_at', m.created_at,
                   'sender_username', u.username, 'sender_first_name', u.first_name, 'sender_last_name', u.last_name,
                   'encryption_data', m.encryption_data, 'group_id', m.group_id
                 ) ELSE NULL END as message
          FROM message_reminders r
          LEFT JOIN messages m ON r.message_id = m.id
          LEFT JOIN users u ON m.sender_id = u.id
          WHERE r.id = ?
        `).get(myReminderObj.id) as any;

        newReminder.is_pinned = Boolean(newReminder.is_pinned);
        newReminder.is_dismissed = Boolean(newReminder.is_dismissed);
        if (newReminder.message) newReminder.message = JSON.parse(newReminder.message);
      }

      // Notify targeted users to refresh reminders
      for (const targetUserId of targetUserIds) {
        if (targetUserId !== req.user.userId) { // Current user will rely on REST response
          const sockets = connectedUsers.get(targetUserId);
          if (sockets) {
            sockets.forEach(socketId => io.to(socketId).emit('reminders_updated'));
          }
        }
      }

      res.json(newReminder || { success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.delete('/api/reminders/:id', authenticateToken, (req: any, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM message_reminders WHERE id = ? AND user_id = ?').run(id, req.user.userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.put('/api/reminders/:id', authenticateToken, (req: any, res) => {
    try {
      const { id } = req.params;
      const { remind_at, comment, recurrence } = req.body;
      db.prepare(`
        UPDATE message_reminders 
        SET remind_at = ?, comment = ?, recurrence = ?, is_dismissed = 0 
        WHERE id = ? AND user_id = ?
      `).run(remind_at, comment || null, recurrence || 'none', id, req.user.userId);
      
      const updatedReminder = db.prepare(`
        SELECT r.*, 
               CASE WHEN m.id IS NOT NULL THEN json_object(
                 'id', m.id, 'content', m.content, 'sender_id', m.sender_id, 'created_at', m.created_at,
                 'sender_username', u.username, 'sender_first_name', u.first_name, 'sender_last_name', u.last_name,
                 'encryption_data', m.encryption_data, 'group_id', m.group_id
               ) ELSE NULL END as message
        FROM message_reminders r
        LEFT JOIN messages m ON r.message_id = m.id
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE r.id = ?
      `).get(id) as any;

      if (updatedReminder) {
        updatedReminder.is_pinned = Boolean(updatedReminder.is_pinned);
        updatedReminder.is_dismissed = Boolean(updatedReminder.is_dismissed);
        if (updatedReminder.message) updatedReminder.message = JSON.parse(updatedReminder.message);
      }

      res.json(updatedReminder);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.put('/api/reminders/:id/snooze', authenticateToken, (req: any, res) => {
    try {
      const { id } = req.params;
      const { remind_at } = req.body;
      db.prepare('UPDATE message_reminders SET remind_at = ?, is_dismissed = 0 WHERE id = ? AND user_id = ?').run(remind_at, id, req.user.userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.put('/api/reminders/:id/dismiss', authenticateToken, (req: any, res) => {
    try {
      const { id } = req.params;
      const reminder = db.prepare('SELECT * FROM message_reminders WHERE id = ? AND user_id = ?').get(id, req.user.userId) as any;
      
      if (!reminder) {
        return res.status(404).json({ error: 'Reminder not found' });
      }

      if (reminder.recurrence && reminder.recurrence !== 'none') {
        const d = new Date(reminder.remind_at);
        if (reminder.recurrence === 'daily') d.setDate(d.getDate() + 1);
        if (reminder.recurrence === 'weekly') d.setDate(d.getDate() + 7);
        if (reminder.recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
        if (reminder.recurrence === 'yearly') d.setFullYear(d.getFullYear() + 1);

        db.prepare('UPDATE message_reminders SET remind_at = ?, is_dismissed = 0 WHERE id = ? AND user_id = ?').run(d.toISOString(), id, req.user.userId);
      } else {
        db.prepare('UPDATE message_reminders SET is_dismissed = 1 WHERE id = ? AND user_id = ?').run(id, req.user.userId);
      }
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper for symmetric chat IDs in private chats
  const getSymmetricChatId = (userId: string, requestedChatId: string) => {
    const isGroup = db.prepare('SELECT id FROM groups WHERE id = ?').get(requestedChatId);
    if (isGroup) return requestedChatId;
    return [userId, requestedChatId].sort().join('_');
  };

  // Pinned Messages
  server.get('/api/chats/:chatId/pinned', authenticateToken, (req: any, res) => {
    try {
      const { chatId } = req.params;
      const actualChatId = getSymmetricChatId(req.user.userId, chatId);
      
      const pinned = db.prepare(`
        SELECT p.*, 
               json_object(
                 'id', m.id, 'content', m.content, 'sender_id', m.sender_id, 'created_at', m.created_at,
                 'sender_username', u.username, 'sender_first_name', u.first_name, 'sender_last_name', u.last_name,
                 'encryption_data', m.encryption_data, 'group_id', m.group_id
               ) as message
        FROM pinned_messages p
        JOIN messages m ON p.message_id = m.id
        JOIN users u ON m.sender_id = u.id
        WHERE p.chat_id = ?
        ORDER BY p.created_at ASC
      `).all(actualChatId);

      const parsedPinned = pinned.map((p: any) => ({
        ...p,
        message: JSON.parse(p.message)
      }));

      res.json(parsedPinned);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.post('/api/chats/:chatId/pinned', authenticateToken, (req: any, res) => {
    try {
      const { chatId } = req.params;
      const { message_id, snippet } = req.body;
      const id = uuidv4();
      const actualChatId = getSymmetricChatId(req.user.userId, chatId);
      
      db.prepare(`
        INSERT OR IGNORE INTO pinned_messages (id, chat_id, message_id, pinned_by)
        VALUES (?, ?, ?, ?)
      `).run(id, actualChatId, message_id, req.user.userId);

      const isGroup = db.prepare('SELECT id FROM groups WHERE id = ?').get(chatId);
      if (isGroup) {
         const sysMsgId = uuidv4();
         const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.user.userId) as any;
         
         let contentText = `Пользователь ${user.username} закрепил сообщение`;
         if (snippet) {
           contentText += `: «${snippet}»`;
         }
         
         const nowIso = new Date().toISOString();
         db.prepare('INSERT INTO messages (id, sender_id, receiver_id, group_id, content, status, reply_to, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
           sysMsgId, 'system', null, actualChatId, contentText, 'sent', message_id, nowIso
         );
         const newMsg = {
           id: sysMsgId,
           sender_id: 'system',
           receiver_id: null,
           group_id: actualChatId,
           content: contentText,
           status: 'sent',
           reply_to: message_id,
           encryption_data: null,
           is_edited: false,
           created_at: nowIso,
           sender_username: 'System',
           sender_first_name: 'Система',
           sender_last_name: ''
         };
         io.to(`group:${actualChatId}`).emit('message:new', newMsg);
         io.to(`group:${actualChatId}`).emit('pinned_updated', { chatId: actualChatId });
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.delete('/api/chats/:chatId/pinned/:messageId', authenticateToken, (req: any, res) => {
    try {
      const { chatId, messageId } = req.params;
      const { snippet } = req.body || {};
      const actualChatId = getSymmetricChatId(req.user.userId, chatId);
      
      db.prepare('DELETE FROM pinned_messages WHERE chat_id = ? AND message_id = ?').run(actualChatId, messageId);

      const isGroup = db.prepare('SELECT id FROM groups WHERE id = ?').get(chatId);
      if (isGroup) {
         const sysMsgId = uuidv4();
         const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.user.userId) as any;
         
         let contentText = `Пользователь ${user.username} открепил сообщение`;
         if (snippet) {
           contentText += `: «${snippet}»`;
         }
         
         const nowIso = new Date().toISOString();
         db.prepare('INSERT INTO messages (id, sender_id, receiver_id, group_id, content, status, reply_to, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
           sysMsgId, 'system', null, actualChatId, contentText, 'sent', messageId, nowIso
         );
         const newMsg = {
           id: sysMsgId,
           sender_id: 'system',
           receiver_id: null,
           group_id: actualChatId,
           content: contentText,
           status: 'sent',
           reply_to: messageId,
           encryption_data: null,
           is_edited: false,
           created_at: nowIso,
           sender_username: 'System',
           sender_first_name: 'Система',
           sender_last_name: ''
         };
         io.to(`group:${actualChatId}`).emit('message:new', newMsg);
         io.to(`group:${actualChatId}`).emit('pinned_updated', { chatId: actualChatId });
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.post('/api/transcribe', authenticateToken, async (req: any, res) => {
    try {
      const { base64Audio, mimeType } = req.body;
      
      const groqApiKey = process.env.GROQ_API_KEY;
      if (groqApiKey) {
        // Use Groq Whisper API (much faster and avoids Gemini regional locks)
        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
        
        let customFetch: any;
        if (proxyUrl) {
           let agent;
           if (proxyUrl.startsWith('socks')) {
             agent = new SocksProxyAgent(proxyUrl);
           } else {
             agent = new HttpsProxyAgent(proxyUrl);
           }
           customFetch = (url: any, init: any) => nodeFetch(url as any, { ...init, agent } as any);
        }

        const groq = new Groq({ 
          apiKey: groqApiKey,
          baseURL: process.env.GROQ_BASE_URL,
          fetch: customFetch
        });
        
        const buffer = Buffer.from(base64Audio, 'base64');
        
        let fileObj;
        try {
           fileObj = await toFile(buffer, 'audio.webm', { type: mimeType || 'audio/webm' });
        } catch(e) {
           // Fallback to File constructor if available globally
           fileObj = new File([buffer], 'audio.webm', { type: mimeType || 'audio/webm' });
        }

        const transcription = await groq.audio.transcriptions.create({
          file: fileObj,
          model: "whisper-large-v3",
          prompt: "Please transcribe this audio exactly as spoken.",
          response_format: "json",
          language: "ru", // Hint for Russian
          temperature: 0.0
        });
        
        console.log('Groq transcription response:', transcription.text);
        return res.json({ transcription: transcription.text });
      }

      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
         return res.status(500).json({ error: 'Server is missing Gemini API key.' });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Prevent WebM from being treated as video by Gemini which causes "0 Frames found" error
      let safeMimeType = (mimeType || "").split(';')[0];
      if (safeMimeType === 'audio/webm' || safeMimeType === 'video/webm') {
        safeMimeType = 'audio/mp4'; // Send as mp4 to bypass strict video frame checks; ffmpeg backend will probe file format correctly
      }
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            { text: "Transcript this audio perfectly in the language it is spoken. Provide only the transcript text." },
            {
              inlineData: {
                data: base64Audio,
                mimeType: safeMimeType
              }
            }
          ]
        }
      });
      
      console.log('Gemini transcription response:', response.text);
      res.json({ transcription: response.text });
    } catch (err: any) {
      console.error('Server transcription error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  server.get('/api/push/vapid-public-key', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  server.post('/api/push/subscribe', authenticateToken, (req: any, res) => {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }
    
    try {
      db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(endpoint);
      db.prepare(`
        INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) 
        VALUES (?, ?, ?, ?, ?)
      `).run(
        uuidv4(), 
        req.user.userId, 
        endpoint, 
        keys.p256dh, 
        keys.auth
      );
      res.status(201).json({ success: true });
    } catch(err) {
      console.error('Subscription error:', err);
      res.status(500).json({ error: 'Failed to subscribe' });
    }
  });

  server.get('/api/feed', authenticateToken, (req: any, res) => {
    try {
      // Auto-delete expired posts
      db.prepare(`
        DELETE FROM feed_posts 
        WHERE (expires_at IS NOT NULL AND expires_at < datetime('now'))
        OR (expires_at IS NULL AND created_at < datetime('now', '-1 day'))
      `).run();

      const posts = db.prepare(`
        SELECT p.*, u.username, u.first_name, u.last_name, u.avatar_url,
          (SELECT COUNT(*) FROM feed_likes WHERE post_id = p.id) as likes_count,
          (SELECT COUNT(*) FROM feed_comments WHERE post_id = p.id) as comments_count,
          EXISTS(SELECT 1 FROM feed_likes WHERE post_id = p.id AND user_id = ?) as is_liked,
          EXISTS(SELECT 1 FROM feed_views WHERE post_id = p.id AND user_id = ?) as is_viewed
        FROM feed_posts p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
        LIMIT 200
      `).all(req.user.userId, req.user.userId);
      res.json(posts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.post('/api/feed/:postId/view', authenticateToken, (req: any, res) => {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO feed_views (post_id, user_id) VALUES (?, ?)
      `).run(req.params.postId, req.user.userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.post('/api/feed', authenticateToken, (req: any, res) => {
    try {
      const { content, media_url, media_type, media_width, media_height, duration_hours = 24 } = req.body;
      const id = uuidv4();
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + Number(duration_hours));

      db.prepare(`
        INSERT INTO feed_posts (id, user_id, content, media_url, media_type, media_width, media_height, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, req.user.userId, content || '', media_url || null, media_type || null, media_width || null, media_height || null, expiresAt.toISOString());
      
      const post = db.prepare(`
        SELECT p.*, u.username, u.first_name, u.last_name, u.avatar_url,
          0 as likes_count, 0 as comments_count, 0 as is_liked
        FROM feed_posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
      `).get(id);
      
      io.emit('feed:new_post', post);
      res.json(post);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.delete('/api/feed/:id', authenticateToken, (req: any, res) => {
    const postId = req.params.id;
    try {
      const post: any = db.prepare('SELECT user_id FROM feed_posts WHERE id = ?').get(postId);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      if (post.user_id !== req.user.userId) {
        return res.status(403).json({ error: 'Unauthorized to delete this post' });
      }
      db.prepare('DELETE FROM feed_posts WHERE id = ?').run(postId);
      io.emit('feed:post_deleted', { postId });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete post' });
    }
  });

  server.post('/api/feed/:id/like', authenticateToken, (req: any, res) => {
    try {
      const postId = req.params.id;
      const existing = db.prepare('SELECT 1 FROM feed_likes WHERE post_id = ? AND user_id = ?').get(postId, req.user.userId);
      
      if (existing) {
        db.prepare('DELETE FROM feed_likes WHERE post_id = ? AND user_id = ?').run(postId, req.user.userId);
      } else {
        db.prepare('INSERT INTO feed_likes (post_id, user_id) VALUES (?, ?)').run(postId, req.user.userId);
      }
      io.emit('feed:like_update', { postId, userId: req.user.userId, isLiked: !existing });
      res.json({ liked: !existing });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.get('/api/feed/:id/comments', authenticateToken, (req: any, res) => {
    try {
      const comments = db.prepare(`
        SELECT c.*, u.username, u.first_name, u.last_name, u.avatar_url
        FROM feed_comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
      `).all(req.params.id);
      res.json(comments);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  server.post('/api/feed/:id/comments', authenticateToken, (req: any, res) => {
    try {
      const { content } = req.body;
      const postId = req.params.id;
      const id = uuidv4();
      
      db.prepare(`
        INSERT INTO feed_comments (id, post_id, user_id, content)
        VALUES (?, ?, ?, ?)
      `).run(id, postId, req.user.userId, content);
      
      const comment = db.prepare(`
        SELECT c.*, u.username, u.first_name, u.last_name, u.avatar_url
        FROM feed_comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `).get(id);
      
      io.emit('feed:new_comment', { postId, comment });
      res.json(comment);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

 // Fallback for Share Target if Service Worker is not active or hasn't intercepted the POST
  server.post('/share-target', upload.any(), (req, res) => {
    let redirectUrl = '/?shared=true';
    const params = new URLSearchParams();
    if (req.body.text) params.append('text', req.body.text);
    if (req.body.title) params.append('title', req.body.title);
    if (req.body.url) params.append('url', req.body.url);
    if (params.toString()) {
      redirectUrl += '&' + params.toString();
    }
    res.redirect(redirectUrl);
  });

}
