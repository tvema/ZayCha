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

// Global safety catchers to prevent unhandled errors from terminating Node.js
process.on('uncaughtException', (err) => {
  console.error('🚨 [Process] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 [Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

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

  // Configure timeouts for network stability (prevents ERR_CONNECTION_ABORTED on reverse proxy / mobile networks)
  httpServer.keepAliveTimeout = 65000;
  httpServer.headersTimeout = 66000;

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  console.log('Setting up Express middleware...');

  // 1. Instant drop for vulnerability scanners, exploit probes, and sensitive files
  const SCANNER_PROBE_REGEX = /(?:^\/\.(?:env|git|aws|ssh|svn|htaccess|config)|wp-json|wp-admin|wp-content|wp-includes|xmlrpc|index\.php|phpmyadmin|cgi-bin|\.php(?:$|\?)|\.asp(?:$|\?)|\.jsp(?:$|\?)|rest_route=)/i;

  server.use((req, res, next) => {
    const rawUrl = req.url || '';

    // Immediate 404 for exploit probes (saves CPU/RAM from Next.js SSR)
    if (SCANNER_PROBE_REGEX.test(rawUrl)) {
      res.writeHead(404, { 'Content-Type': 'text/plain', 'Connection': 'close' });
      res.end('Not Found');
      return;
    }

    // Reject mutating methods (POST/PUT/PATCH/DELETE) on non-API routes
    // (Prevents bots from sending POST / to overload React SSR)
    const isApi = rawUrl.startsWith('/api/') || rawUrl.startsWith('/socket.io');
    const isNextInternal = rawUrl.startsWith('/_next/');
    const isMutatingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '');

    if (isMutatingMethod && !isApi && !isNextInternal) {
      res.writeHead(405, { 'Content-Type': 'text/plain', 'Connection': 'close' });
      res.end('Method Not Allowed');
      return;
    }

    // Skip static assets and chunks in logging to keep logs clean
    if (!rawUrl.includes('/_next/static') && !rawUrl.includes('/favicon.ico')) {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      console.log(`[REQ] ${req.method} ${rawUrl} | IP: ${ip}`);
    }
    next();
  });
  server.use(express.json({ limit: '50mb' }));
  server.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Static chunks (.next/static) are hashed and immutable in production
  server.use('/_next/static', express.static(path.join(process.cwd(), '.next/static'), {
    maxAge: '365d',
    immutable: true,
    fallthrough: true
  }));

  // Serve static files from public folder (sw.js, manifest.json, icons, etc.)
  server.use(express.static(path.join(process.cwd(), 'public'), {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else if (filePath.endsWith('manifest.json')) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    }
  }));

  server.use('/uploads', express.static(uploadDir, {
    maxAge: '30d'
  }));

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
  // Next.js request handling, passing socket.io through to httpServer handlers
  server.all(/.*/, (req, res, next) => {
    if (req.url && req.url.startsWith('/socket.io')) {
      return next();
    }
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
