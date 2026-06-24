const fs = require('fs');
const path = require('path');
function search(dir) {
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f.startsWith('.')) continue;
      if (f === 'node_modules') continue;
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        search(full);
      } else if (f.endsWith('.db') || f.endsWith('.sqlite')) {
        console.log(full, stat.size);
      }
    }
  } catch (e) {}
}
search('/app/applet');
