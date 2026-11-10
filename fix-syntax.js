const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/payment.ts', 'utf8');

content = content.replace(/\\\`\(\\\$\{escMd\(rejectReason\)\}\)\\\`/g, "'(' + escMd(rejectReason) + ')'");

fs.writeFileSync('artifacts/api-server/src/bot/handlers/payment.ts', content);
