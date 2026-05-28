import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const TARGET_DIR = '/app/applet';

function findZipFile(): string | null {
  try {
    const files = fs.readdirSync(TARGET_DIR);
    const zips = files.filter(f => f.endsWith('.zip') && f !== 'find_files.ts' && f !== 'unzip_project.ts');
    if (zips.length > 0) {
      return path.join(TARGET_DIR, zips[0]);
    }
  } catch (e) {}
  return null;
}

function extractZip(zipPath: string, encoding: string): boolean {
  console.log(`\nAttempting to unzip ${zipPath} with encoding ${encoding}...`);
  try {
    // Run unzip with filename encoding option -O
    // unzip -O cp866 file.zip -d /app/applet/ -y (to overwrite) or -o to overwrite
    const command = `unzip -o -O ${encoding} "${zipPath}" -d "${TARGET_DIR}"`;
    console.log(`Executing: ${command}`);
    const output = execSync(command, { encoding: 'utf8' });
    console.log("Unzip command output successfully.");
    return true;
  } catch (err: any) {
    console.error(`Failed unzipping with ${encoding}: ${err.message}`);
    if (err.stdout) console.log("Stdout:", err.stdout);
    if (err.stderr) console.error("Stderr:", err.stderr);
    return false;
  }
}

function verifyFilenames() {
  console.log("\nVerifying extracted filenames in workspace...");
  try {
    const files = fs.readdirSync(TARGET_DIR);
    console.log("Files in workspace root:");
    for (const file of files) {
      if (file === 'package-lock.json' || file === 'find_files.ts' || file === 'unzip_project.ts' || file.startsWith('.')) {
        continue;
      }
      // Check if file contains Cyrillic characters
      const isCyrillic = /[а-яА-ЯёЁ]/.test(file);
      const isReadable = !file.includes('├') && !file.includes('┼') && !file.includes('╧');
      console.log(` - ${file} [Cyrillic detected: ${isCyrillic}, UTF-8 readable: ${isReadable}]`);
    }
  } catch (e: any) {
    console.error("Error reading dir during verification:", e.message);
  }
}

function run() {
  const zipPath = findZipFile();
  if (!zipPath) {
    console.log("No uploaded ZIP file found in the workspace root.");
    console.log("Please upload your ZIP archive using the chat attachment or file explorer.");
    return;
  }

  console.log(`\nFound ZIP archive to restore: ${zipPath}`);
  
  // Windows DOS uses CP866, Windows GUI zip usually uses CP1251
  // We try CP866 first as it is the standard for legacy ZIPs containing Cyrillic.
  let success = extractZip(zipPath, 'cp866');
  if (!success) {
    success = extractZip(zipPath, 'cp1251');
  }
  
  if (success) {
    console.log("\nExtraction completed successfully!");
    verifyFilenames();
  } else {
    console.error("\nFailed to extract the zip file using standard Russian folder encodings.");
  }
}

run();
