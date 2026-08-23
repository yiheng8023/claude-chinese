const fs = require('fs');
const path = require('path');

const dir = 'C:/Program Files/WindowsApps/Claude_1.34493.1.0_x64__pzs8sxrjxfjjc/app/resources/ion-dist/assets/v1';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
console.log('Total JS files:', files.length);

const regexAdd = /((?:[\w$]+)=\["en-US"(?:,"[^"]+")+\])/;

for (const file of files) {
  const fullPath = path.join(dir, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes('"en-US"')) {
    const match = content.match(regexAdd);
    console.log('Found "en-US" in:', file, 'Match:', match ? match[0] : 'NO');
    if (match) {
      console.log('Full matched array string:', match[1]);
    }
  }
}
