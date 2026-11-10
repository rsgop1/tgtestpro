const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/payment.ts', 'utf8');

content = content.replace(/AI\\\\!\*Your 30 Days/g, 'AI\\\\!*\n\nYour 30 Days');
content = content.replace(/AI\\\\!\*Your test has/g, 'AI\\\\!*\n\nYour test has');
content = content.replace(/✅AI could not/g, '✅\n\nAI could not');
content = content.replace(/\\\.It has been/g, '\\.\nIt has been');
content = content.replace(/\\\.Your \$\{pending\.isPremium/g, '\\.\n\nYour ${pending.isPremium');

fs.writeFileSync('artifacts/api-server/src/bot/handlers/payment.ts', content);
