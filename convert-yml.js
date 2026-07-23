const yaml = require('js-yaml');
const fs = require('fs');
const langs = ['ru', 'en', 'uk'];
langs.forEach(l => {
  const content = fs.readFileSync(`H:/argus/apps/argus-mobile/assets/locales/${l}.yml`, 'utf8');
  const obj = yaml.load(content);
  fs.writeFileSync(`H:/argus/apps/argus-mobile/assets/locales/${l}.json`, JSON.stringify(obj));
  console.log(`${l}.json written`);
});
