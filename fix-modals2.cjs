const fs = require('fs');
const path = require('path');

function fixFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixFiles(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // We want to make sure exit={{ opacity: 0 }} becomes exit={{ opacity: 0, pointerEvents: 'none' }}
      // but only if it's not already having pointerEvents
      if (content.includes('exit={{ opacity: 0 }}')) {
        content = content.replaceAll(/exit=\{\{\s*opacity:\s*0\s*\}\}/g, "exit={{ opacity: 0, pointerEvents: 'none' }}");
        fs.writeFileSync(fullPath, content);
        console.log('Fixed', fullPath);
      }
      
      // Also fix scale exit
      if (content.includes('exit={{ scale: 0.95 }}')) {
        content = content.replaceAll(/exit=\{\{\s*scale:\s*0.95\s*\}\}/g, "exit={{ scale: 0.95, pointerEvents: 'none' }}");
        fs.writeFileSync(fullPath, content);
        console.log('Fixed scale in', fullPath);
      }
    }
  }
}

fixFiles('./components');
