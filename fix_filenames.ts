import * as fs from 'fs';
import * as path from 'path';

function decodeMojibake(input: string): string {
  try {
    // Reconstruct original UTF-8 bytes from the Latin-1/Binary representation
    const buf = Buffer.from(input, 'binary');
    const decoded = buf.toString('utf8');
    
    // Check if the decoded string contains Cyrillic characters or standard text
    // (a simple heuristic to ensure we don't garble already correct names)
    const hasCyrillic = /[а-яА-ЯёЁ]/.test(decoded);
    if (hasCyrillic && decoded !== input) {
      return decoded;
    }
  } catch (e) {}
  return input;
}

function processDirectory(dir: string) {
  if (!fs.existsSync(dir)) {
    console.log(`Directory does not exist: ${dir}`);
    return;
  }

  console.log(`\nScanning directory: ${dir}`);
  const items = fs.readdirSync(dir);

  // We must do a post-order traversal to rename files/directories safely.
  // First, recurse into subdirectories.
  for (const item of items) {
    if (item === 'node_modules' || item === '.git' || item === '.npm' || item === '.cache') continue;
    
    const fullPath = path.join(dir, item);
    try {
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        processDirectory(fullPath);
      }
    } catch (e: any) {
      console.error(`Error reading stats for ${fullPath}:`, e.message);
    }
  }

  // Then, rename the files and folders in the current directory.
  // We re-read the directory to get the most up-to-date names.
  const currentItems = fs.readdirSync(dir);
  for (const item of currentItems) {
    if (item === 'node_modules' || item === '.git' || item === '.npm' || item === '.cache') continue;
    if (item === 'fix_filenames.ts' || item === 'package-lock.json') continue;

    const decodedItem = decodeMojibake(item);
    if (decodedItem !== item) {
      const oldPath = path.join(dir, item);
      const newPath = path.join(dir, decodedItem);
      try {
        fs.renameSync(oldPath, newPath);
        console.log(`RENAMED successfully: "${item}" -> "${decodedItem}"`);
      } catch (err: any) {
        console.error(`Failed to rename "${item}" to "${decodedItem}":`, err.message);
      }
    }
  }
}

// Target can be passed as argument, e.g., npx tsx fix_filenames.ts public
const targetDir = process.argv[2] || '.';
console.log(`=== STARTING FILENAME RECOVERY ENGINE ===`);
console.log(`Target folder: ${path.resolve(targetDir)}`);
processDirectory(targetDir);
console.log(`=== FILENAME RECOVERY COMPLETED ===`);
