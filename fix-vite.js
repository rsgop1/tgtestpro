const fs = require('fs');
let content = fs.readFileSync('artifacts/testbook-web/vite.config.ts', 'utf8');

content = content.replace(
  'const basePath = process.env.BASE_PATH || "/";',
  'const basePath = process.env.BASE_PATH || "/app";'
);

fs.writeFileSync('artifacts/testbook-web/vite.config.ts', content);
