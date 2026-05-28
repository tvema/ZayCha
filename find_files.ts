import * as fs from 'fs';
import * as path from 'path';

const now = Date.now();
const oneHourAgo = now - 60 * 60 * 1000;

function scan(dir: string, depth = 0) {
  if (depth > 8) return;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file === 'proc' || file === 'sys' || file === 'dev' || file === 'node_modules' || file === '.npm' || file === '.cache') continue;
      const fullPath = path.join(dir, file);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          scan(fullPath, depth + 1);
        } else {
          if (stats.mtimeMs > oneHourAgo) {
            console.log(`RECENT: ${fullPath} (${stats.size} Bytes) - ${stats.mtime.toISOString()}`);
          }
        }
      } catch (e) {}
    }
  } catch (e) {}
}

console.log("=== SCANNING FOR ANY RECENT FILES (1 HOUR) ===");
scan('/');
console.log("=== SCAN COMPLETE ===");
