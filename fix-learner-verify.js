const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/routes/learner.ts', 'utf8');

content = content.replace(
  'if (!Number.isInteger(parsed.userId) || !parsed.testId || parsed.exp < Math.floor(Date.now() / 1000)) return null;',
  'if (!Number.isInteger(parsed.userId) || parsed.exp < Math.floor(Date.now() / 1000)) return null;'
);

fs.writeFileSync('artifacts/api-server/src/routes/learner.ts', content);
