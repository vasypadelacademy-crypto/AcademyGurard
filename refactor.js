const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('input-base') || lines[i].includes('<input') || lines[i].includes('<select') || lines[i].includes('<textarea')) {
            // It could be multi-line, so we just remove these specifically when we see them on the same line as input-base or form elements
            // Actually just removing them from the same line if "input-base" is there
            if (lines[i].includes('input-base')) {
               lines[i] = lines[i].replace(/\bfont-black\b/g, '')
                                  .replace(/\bfont-bold\b/g, '')
                                  .replace(/\bitalic\b/g, '')
                                  .replace(/\buppercase\b/g, '') // remove uppercase too, data entry in uppercase is weird
               ;
            }
        }
      }
      content = lines.join('\n');
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}

processDir(path.join(__dirname, 'src'));
console.log('Done');
