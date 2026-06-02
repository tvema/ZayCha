const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Look for AnimatePresence followed by isOpen check and a div
      const regex = /<AnimatePresence>([\s\S]*?{isOpen([\s\S]*?)&&\s*\(([\s\S]*?))<div (className="(?:fixed|absolute)\s+inset-0[^"]*backdrop-blur[^"]*")/ig;
      
      let modified = false;
      content = content.replace(regex, (match, p1, p2, p3, p4) => {
        modified = true;
        
        let keyStr = 'key="modal"';
        // Try to create a slightly more unique key based on filename
        const baseName = path.basename(fullPath, '.tsx').toLowerCase();
        if (content.includes('user &&')) keyStr = 'key={`'+baseName+'-${user.id}`}';
        else if (content.includes('group &&')) keyStr = 'key={`'+baseName+'-${group.id}`}';
        else keyStr = 'key="'+baseName+'"';

        return `<AnimatePresence>${p1}{isOpen${p2}&& (${p3}<motion.div \n            ${keyStr}\n            initial={{ opacity: 0 }}\n            animate={{ opacity: 1 }}\n            exit={{ opacity: 0 }}\n            ${p4}`;
      });

      // We also need to change the closing div to motion.div.
      // But replacing `</div>` is risky.
      // So let's just do it file by file with edit_file, it's safer!
    }
  }
}
// Actually, let's just do standard node file editing for the known ones.
