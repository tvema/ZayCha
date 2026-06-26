import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authenticateToken } from '../auth.js';
import { upload } from '../upload.js';

export function setupGroupRoutes(server: express.Express, io: any, connectedUsers: Map<string, Set<string>>) {
  // 8.3 Get Groups
  server.get('/api/groups', authenticateToken, (req: any, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const groups = db.prepare(`
        SELECT g.*, gm.role, gm.joined_at, gm.last_read_at, gm.encrypted_keys,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
        (SELECT COUNT(*) FROM messages m WHERE m.group_id = g.id AND datetime(m.created_at) > datetime(COALESCE(gm.last_read_at, '1970-01-01'))) as unread_count,
        (SELECT MAX(created_at) FROM messages m WHERE m.group_id = g.id) as last_message_timestamp
        FROM groups g
        JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = ?
      `).all(req.user.userId);
      console.log('GET /api/groups result sample:', groups.length > 0 ? groups[0] : 'empty');
      res.json(groups);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8.2 Create Group
  server.post('/api/groups', authenticateToken, upload.single('avatar'), (req: any, res) => {
    try {
      const { name, description, members } = req.body;
      const groupId = uuidv4();
      const creatorId = req.user.userId;
      const avatarUrl = req.file ? `/uploads/${req.file.filename}` : null;
      
      let parsedMembers: Array<{id: string, encrypted_key: string}> = [];
      if (members) {
        try {
          parsedMembers = JSON.parse(members);
        } catch (e) {
          console.error("Failed to parse members JSON", e);
        }
      }

      // Use a transaction for atomic group creation
      const createGroupTransaction = db.transaction(() => {
        db.prepare('INSERT INTO groups (id, name, description, avatar_url, creator_id) VALUES (?, ?, ?, ?, ?)').run(groupId, name, description, avatarUrl, creatorId);
        
        // Add creator as admin
        const nowIso = new Date().toISOString();
        let creatorKeysJson = null;
        if (req.body.encrypted_keys) {
          creatorKeysJson = req.body.encrypted_keys;
        } else if (members) {
          const creatorData = parsedMembers.find(m => m.id === creatorId);
          creatorKeysJson = creatorData ? JSON.stringify({ '1': creatorData.encrypted_key }) : null;
        }
        
        db.prepare('INSERT INTO group_members (group_id, user_id, role, encrypted_keys, last_read_at) VALUES (?, ?, ?, ?, ?)').run(
          groupId, creatorId, 'admin', creatorKeysJson, nowIso
        );

        // Make the creator's socket join the group room
        const creatorSockets = connectedUsers.get(creatorId);
        if (creatorSockets) {
          creatorSockets.forEach(socketId => {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
              socket.join(`group:${groupId}`);
            }
          });
        }

        // Add other members
        for (const member of parsedMembers) {
          if (member.id !== creatorId) {
            const nowIso = new Date().toISOString();
            db.prepare('INSERT INTO group_members (group_id, user_id, encrypted_keys, last_read_at) VALUES (?, ?, ?, ?)').run(
              groupId, member.id, JSON.stringify({ '1': member.encrypted_key }), nowIso
            );
            
            // Notify other members via socket if online
            const mSockets = connectedUsers.get(member.id);
            if (mSockets) {
              mSockets.forEach(socketId => {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                  socket.join(`group:${groupId}`);
                  io.to(socketId).emit('group:new', { id: groupId, name, description, avatar_url: avatarUrl, creator_id: creatorId, member_count: parsedMembers.length });
                }
              });
            }
          }
        }
      });
      
      createGroupTransaction();
      
      const newGroup = db.prepare(`
        SELECT g.*, gm.role, gm.joined_at, gm.last_read_at, gm.encrypted_keys,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
        (SELECT COUNT(*) FROM messages m WHERE m.group_id = g.id AND datetime(m.created_at) > datetime(COALESCE(gm.last_read_at, '1970-01-01'))) as unread_count,
        (SELECT MAX(created_at) FROM messages m WHERE m.group_id = g.id) as last_message_timestamp
        FROM groups g
        JOIN group_members gm ON g.id = gm.group_id
        WHERE g.id = ? AND gm.user_id = ?
      `).get(groupId, creatorId);

      res.json(newGroup);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // 8.3 Add Group Member
  server.post('/api/groups/:groupId/members', authenticateToken, (req: any, res) => {
    try {
      const { groupId } = req.params;
      const { userId, encrypted_key, key_version, encrypted_keys } = req.body;
      
      // Check if current user is admin
      const member = db.prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, req.user.userId) as any;
      if (!member || member.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can add members' });
      }

      // Check if the user being added has blacklisted the admin, or if admin has blacklisted the user.
      const isBlacklisted = db.prepare(`
        SELECT COUNT(*) as count FROM contact_circles cc
        JOIN contact_circle_members ccm ON cc.id = ccm.circle_id
        WHERE cc.is_blacklist = 1 AND (
          (cc.user_id = ? AND ccm.contact_id = ?) OR 
          (cc.user_id = ? AND ccm.contact_id = ?)
        )
      `).get(req.user.userId, userId, userId, req.user.userId) as any;
      
      if (isBlacklisted && isBlacklisted.count > 0) {
         return res.status(403).json({ error: 'Cannot add this user to the group due to blacklist settings.' });
      }

      let keysJson = null;
      if (encrypted_keys) {
        keysJson = typeof encrypted_keys === 'string' ? encrypted_keys : JSON.stringify(encrypted_keys);
      } else if (encrypted_key) {
        keysJson = JSON.stringify({ [key_version || '1']: encrypted_key });
      }
      
      const nowIso = new Date().toISOString();
      db.prepare('INSERT INTO group_members (group_id, user_id, encrypted_keys, last_read_at) VALUES (?, ?, ?, ?)').run(groupId, userId, keysJson, nowIso);

      // Notify the added user via socket if online
      const addedUserSockets = connectedUsers.get(userId);
      const groupData = db.prepare(`
        SELECT g.*,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
        FROM groups g WHERE id = ?
      `).get(groupId);

      if (addedUserSockets && groupData) {
        addedUserSockets.forEach(socketId => {
          io.to(socketId).emit('group:new', groupData); 
          // Make the added user's socket join the group room
          const socket = io.sockets.sockets.get(socketId);
          if (socket) socket.join(`group:${groupId}`);
        });
      }

      // Notify existing members
      io.to(`group:${groupId}`).emit('group:member_added', { groupId, userId });
      io.to(`group:${groupId}`).emit('group:updated', groupId);

      res.json({ success: true });
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        return res.status(400).json({ error: 'User is already in group' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // 8.4 Leave Group
  server.post('/api/groups/:groupId/leave', authenticateToken, (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = req.user.userId;

      // Check if user is in group
      const member = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
      if (!member) {
        return res.status(400).json({ error: 'You are not in this group' });
      }

      db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, userId);

      // Notify others in the group that the user left
      io.to(`group:${groupId}`).emit('group:member_left', { groupId, userId });
      io.to(`group:${groupId}`).emit('group:updated', groupId);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8.5 Get Group Members
  server.get('/api/groups/:groupId/members', authenticateToken, (req: any, res) => {
    try {
      const { groupId } = req.params;
      const members = db.prepare(`
        SELECT u.id, u.username, u.first_name, u.last_name, u.avatar_url, u.public_key, gm.role, gm.joined_at, gm.encrypted_keys
        FROM users u
        JOIN group_members gm ON u.id = gm.user_id
        WHERE gm.group_id = ?
      `).all(groupId);
      res.json(members);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8.5 Remove Group Member
  server.delete('/api/groups/:groupId/members/:userId', authenticateToken, (req: any, res) => {
    try {
      const { groupId, userId } = req.params;
      
      // Check if current user is admin
      const adminMember = db.prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, req.user.userId) as any;
      if (!adminMember || adminMember.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can remove members' });
      }

      db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, userId);

      // Notify the removed user via socket if online
      const removedUserSockets = connectedUsers.get(userId);
      if (removedUserSockets) {
        removedUserSockets.forEach(socketId => {
          io.to(socketId).emit('group:removed', { groupId });
          const socket = io.sockets.sockets.get(socketId);
          if (socket) socket.leave(groupId);
        });
      }

      // Notify remaining members
      io.to(`group:${groupId}`).emit('group:member_removed', { groupId, userId });
      io.to(`group:${groupId}`).emit('group:updated', groupId);

      res.json({ success: true });
    } catch (err: any) {
       res.status(500).json({ error: err.message });
    }
  });

  // 8.6 Update Group Member Role
  server.put('/api/groups/:groupId/members/:userId', authenticateToken, (req: any, res) => {
     try {
      const { groupId, userId } = req.params;
      const { role } = req.body;
      
      // Check if current user is admin
      const adminMember = db.prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, req.user.userId) as any;
      if (!adminMember || adminMember.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can change roles' });
      }

      db.prepare('UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?').run(role, groupId, userId);
      
      io.to(`group:${groupId}`).emit('group:role_updated', { groupId, userId, role });

      res.json({ success: true });
    } catch (err: any) {
       res.status(500).json({ error: err.message });
    }
  });

  // 8.7 Delete Group
  server.delete('/api/groups/:groupId', authenticateToken, (req: any, res) => {
    try {
       const { groupId } = req.params;
       // Check if current user is admin
       const adminMember = db.prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, req.user.userId) as any;
       if (!adminMember || (adminMember.role !== 'admin' && adminMember.role !== 'owner')) {
         return res.status(403).json({ error: 'Only admins or owners can delete a group' });
       }
 
       db.transaction(() => {
         db.prepare('DELETE FROM group_members WHERE group_id = ?').run(groupId);
         db.prepare('DELETE FROM messages WHERE group_id = ?').run(groupId);
         db.prepare('DELETE FROM groups WHERE id = ?').run(groupId);
       })();
 
       // Notify all members
       io.to(`group:${groupId}`).emit('group:deleted', { groupId });
 
       res.json({ success: true });
    } catch (err: any) {
       res.status(500).json({ error: err.message });
    }
  });
  
  // 4.1.1 Update Group Avatar
  server.put('/api/groups/:groupId/avatar', authenticateToken, upload.single('avatar'), (req: any, res) => {
    try {
      const { groupId } = req.params;
      const avatarUrl = req.file ? `/uploads/${req.file.filename}` : null;

      // Ensure user is admin of group
      const adminMember = db.prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, req.user.userId) as any;
      if (!adminMember || adminMember.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can change group avatar' });
      }
      
      const updateStmt = db.prepare('UPDATE groups SET avatar_url = ? WHERE id = ?');
      updateStmt.run(avatarUrl, groupId);
      
      const groupData = db.prepare(`
        SELECT g.*,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
        FROM groups g WHERE id = ?
      `).get(groupId);
      
      // Notify members via websocket
      io.to(`group:${groupId}`).emit('group:avatar_updated', groupData);

      // We should probably emit a system message into the chat as well, but for now just updating struct
      // ...
      
      res.json({ avatar_url: avatarUrl });
    } catch (err: any) {
      console.error("Error updating group avatar: ", err);
      res.status(500).json({ error: err.message });
    }
  });
}
