const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const base = 'H:/argus/apps/argus-mobile/assets/locales';
['ru', 'en', 'uk'].forEach(lang => {
  const yml = fs.readFileSync(path.join(base, lang + '.yml'), 'utf8');
  const obj = yaml.load(yml);
  fs.writeFileSync(path.join(base, lang + '.json'), JSON.stringify(obj));
  console.log(lang + '.json OK:', Object.keys(obj).length, 'top-level keys');
});
