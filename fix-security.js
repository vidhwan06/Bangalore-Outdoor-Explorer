const fs = require('fs');
const content = fs.readFileSync('lib/security/index.ts', 'utf8');
const newContent = content.replace(".replace(/'/g, ''')", ".replace(/'/g, '&apos;')");
fs.writeFileSync('lib/security/index.ts', newContent);
console.log('Fixed');
