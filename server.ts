import cp from 'child_process';

// Security Audit & Active Defense Interceptor: Block any suspicious process spawning from dependencies
const originalSpawn = cp.spawn;
const originalExec = cp.exec;
const originalExecSync = cp.execSync;
const originalFork = cp.fork;

function isSuspicious(cmd: any): boolean {
  const str = Array.isArray(cmd) ? cmd.join(' ') : String(cmd || '');
  const lower = str.toLowerCase();
  if (
    lower.includes('/.') || 
    lower.includes('\\.') || 
    lower.includes('/tmp/') || 
    lower.includes('\\tmp\\') ||
    lower.includes('upx') ||
    (lower.includes('pm2') && !lower.includes('node_modules'))
  ) {
    return true;
  }
  return false;
}

(cp as any).spawn = function(...args: any[]) {
  if (isSuspicious(args[0]) || isSuspicious(args[1])) {
    console.error('🚨 [BLOCKED MALICIOUS SPAWN] Attempted to spawn suspicious process:', args[0], args[1]);
    console.trace('Malicious spawn stack trace:');
    throw new Error('Security policy violation: Unauthorized process execution blocked.');
  }
  return originalSpawn.apply(this, args as any);
};

(cp as any).exec = function(...args: any[]) {
  if (isSuspicious(args[0])) {
    console.error('🚨 [BLOCKED MALICIOUS EXEC] Attempted to execute suspicious command:', args[0]);
    console.trace('Malicious exec stack trace:');
    throw new Error('Security policy violation: Unauthorized command execution blocked.');
  }
  return originalExec.apply(this, args as any);
};

(cp as any).execSync = function(...args: any[]) {
  if (isSuspicious(args[0])) {
    console.error('🚨 [BLOCKED MALICIOUS EXEC_SYNC] Attempted to execute suspicious command synchronously:', args[0]);
    console.trace('Malicious execSync stack trace:');
    throw new Error('Security policy violation: Unauthorized synchronous command execution blocked.');
  }
  return originalExecSync.apply(this, args as any);
};

(cp as any).fork = function(...args: any[]) {
  if (isSuspicious(args[0])) {
    console.error('🚨 [BLOCKED MALICIOUS FORK] Attempted to fork suspicious module:', args[0]);
    console.trace('Malicious fork stack trace:');
    throw new Error('Security policy violation: Unauthorized fork blocked.');
  }
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
