const fs = require('fs');

const path = './components/FileAttachment.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/unoptimized=\{fileData\.isEncrypted \|\| blobUrl\?\.startsWith\('blob:'\)\}/g, 'unoptimized');
content = content.replace(/unoptimized=\{fileData\.isEncrypted \|\| blobUrl\.startsWith\('blob:'\)\}/g, 'unoptimized');

fs.writeFileSync(path, content);
console.log('Fixed unoptimized in FileAttachment.tsx');
