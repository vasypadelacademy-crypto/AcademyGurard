const fs = require('fs');

const hack = `
const parseISO = (val: any) => {
  if (!val) return new Date();
  if (val?.toDate) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'number') return new Date(val);
  return _parseISO(val);
};
`;

function removeBadHack(filePath) {
  let c = fs.readFileSync(filePath, 'utf8');
  c = c.replace(hack, '');
  fs.writeFileSync(filePath, c);
}

removeBadHack('src/pages/Payments.tsx');
removeBadHack('src/pages/PlayerDetail.tsx');
removeBadHack('src/pages/PlayerReport.tsx');
removeBadHack('src/pages/Profit.tsx');

function fixFileCorrectly(filePath) {
  let c = fs.readFileSync(filePath, 'utf8');
  let firstImport = c.indexOf('import ');
  let p = c.indexOf('\n', firstImport) + 1;
  c = c.substring(0, p) + hack + c.substring(p);
  fs.writeFileSync(filePath, c);
  console.log('Fixed properly', filePath);
}

fixFileCorrectly('src/pages/Payments.tsx');
fixFileCorrectly('src/pages/PlayerDetail.tsx');
fixFileCorrectly('src/pages/PlayerReport.tsx');
fixFileCorrectly('src/pages/Profit.tsx');
