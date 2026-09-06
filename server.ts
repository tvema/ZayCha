import cp from 'child_process';

// Security Audit Interceptor: Log and trace any process spawning from dependencies or code
const originalSpawn = cp.spawn;
const originalExec = cp.exec;
const originalExecSync = cp.execSync;
const originalFork = cp.fork;

(cp as any).spawn = function(...args: any[]) {
  console.error('⚠️ [SECURITY AUDIT] child_process.spawn called with:', args[0], args[1]);
  console.trace('Stack trace for spawn:');
  return originalSpawn.apply(this, args as any);
};

(cp as any).exec = function(...args: any[]) {
  console.error('⚠️ [SECURITY AUDIT] child_process.exec called with:', args[0]);
  console.trace('Stack trace for exec:');
  return originalExec.apply(this, args as any);
};

(cp as any).execSync = function(...args: any[]) {
  console.error('⚠️ [SECURITY AUDIT] child_process.execSync called with:', args[0]);
  console.trace('Stack trace for execSync:');
  return originalExecSync.apply(this, args as any);
};

(cp as any).fork = function(...args: any[]) {
  console.error('⚠️ [SECURITY AUDIT] child_process.fork called with:', args[0]);
  console.trace('Stack trace for fork:');
  return originalFork.apply(this, args as any);
};

import { parse } from 'url';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import next from 'next';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// 1. Manually load env files because this is a custom server entry point
// and we want variables available immediately for our Node backend
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}
if (fs.existsSync('.env')) {
  dotenv.config({ path: '.env' });
}

import { setupRoutes } from './server/routes.js';
import { setupSocket } from './server/socket.js';
import { uploadDir } from './server/upload.js';
import './server/db.js'; // Ensure DB is initialized

console.log('Starting server.ts...');
console.log('Node version:', process.version);
console.log('NODE_ENV:', process.env.NODE_ENV);

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = 3000;

console.log('Preparing Next.js app...');
app.prepare().then(() => {
  console.log('Next.js app prepared successfully.');
  const server = express();
  const httpServer = createServer(server);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  console.log('Setting up Express middleware...');
  server.use((req, res, next) => {
    const url = req.url || '';
    // Skip static assets and chunks to reduce noise and false error triggers
    if (!url.includes('/_next/static') && !url.includes('/favicon.ico')) {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      console.log(`[REQ] ${req.method} ${url} | IP: ${ip}`);
    }
    next();
  });
  server.use(express.json({ limit: '50mb' }));
  server.use(express.urlencoded({ limit: '50mb', extended: true }));
  // Serve static files from public folder (sw.js, manifest.json, etc.)
  server.use(express.static(path.join(process.cwd(), 'public')));
  server.use('/uploads', express.static(uploadDir));

  const connectedUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds

  console.log('Setting up routes and socket...');
  // Setup Routes
  setupRoutes(server, io, connectedUsers);

  console.log('Setting up socket.io handlers...');
  // Setup Socket.io
  setupSocket(io, connectedUsers);

  // API Global Error Handler to always send JSON instead of HTML
  server.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Express API Error:', err);
    res.status(500).json({ error: `Внутренняя ошибка сервера: ${err.message}` });
  });

  console.log('Setting up Next.js catch-all route...');
  // Next.js request handling
  server.all(/.*/, (req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  console.log(`Starting HTTP server on port ${port}...`);
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
}).catch(err => {
  console.error('CRITICAL: Next.js failed to prepare', err);
  process.exit(1);
});
