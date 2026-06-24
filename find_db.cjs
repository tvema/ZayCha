const fs = require('fs');
const path = require('path');

function findDb(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.db') || file.endsWith('.sqlite')) {
      console.log('Found:', path.join(dir, file));
    }
  }
}
findDb('/app/applet');
