const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const base = 'H:/argus/apps/argus-mobile/assets/locales';

// Read clean ru.yml and convert
const ruYml = fs.readFileSync(path.join(base, 'ru.yml'), 'utf8');
const ruObj = yaml.load(ruYml);
fs.writeFileSync(path.join(base, 'ru.json'), JSON.stringify(ruObj));
console.log('ru.json OK:', Object.keys(ruObj).length, 'top-level keys');

// Verify en.json and uk.json exist
try {
  JSON.parse(fs.readFileSync(path.join(base, 'en.json'), 'utf8'));
  console.log('en.json OK');
} catch { console.log('en.json MISSING'); }
try {
  JSON.parse(fs.readFileSync(path.join(base, 'uk.json'), 'utf8'));
  console.log('uk.json OK');
} catch { console.log('uk.json MISSING'); }
