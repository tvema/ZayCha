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
      
      let modified = false;

      // Outer wrapper usually has opacity: 0
      if (content.includes("exit={{ opacity: 0, pointerEvents: 'none' }}")) {
        content = content.replaceAll(/exit=\{\{\s*opacity:\s*0,\s*pointerEvents:\s*'none'\s*\}\}/g, "exit={{ opacity: 0, backdropFilter: 'blur(0px)', pointerEvents: 'none' }}");
        modified = true;
      }
      
      if (modified) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed blur in', fullPath);
      }
    }
  }
}

fixFiles('./components');
