const fs = require('fs');
const files = [
  'artifacts/testbook-web/src/pages/login.tsx',
  'artifacts/testbook-web/src/pages/tests.tsx',
  'artifacts/testbook-web/src/pages/history.tsx',
  'artifacts/testbook-web/src/pages/profile.tsx',
  'artifacts/testbook-web/src/pages/dashboard.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\\\`/g, '`').replace(/\\\$/g, '$');
  fs.writeFileSync(file, content);
}
