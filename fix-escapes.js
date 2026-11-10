const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/payment.ts', 'utf8');

content = content.replace(/Your 30 Days Premium access has been activated\\\./g, 'Your 30 Days Premium access has been activated\\\\.');
content = content.replace(/https:\/\/t\\\.me\/joinchat\/vip\\-group\\-placeholder/g, 'https://t\\\\.me/joinchat/vip\\\\-group\\\\-placeholder');
content = content.replace(/Your test has been unlocked\\\./g, 'Your test has been unlocked\\\\.');
content = content.replace(/📥 \*Screenshot Received\\!\* ✅/g, '📥 *Screenshot Received\\\\!* ✅');
content = content.replace(/AI could not instantly verify this payment \$\{rejectReason \? `\(\$\{rejectReason\}\)` : ""\}\\\./g, 'AI could not instantly verify this payment ${rejectReason ? `(${rejectReason})` : ""}\\\\.');
content = content.replace(/It has been forwarded to the admin for manual review\\\./g, 'It has been forwarded to the admin for manual review\\\\.');
content = content.replace(/Your \$\{pending\.isPremium \? "Premium tier" : "test"\} will be unlocked once approved\\\./g, 'Your ${pending.isPremium ? "Premium tier" : "test"} will be unlocked once approved\\\\.');
content = content.replace(/Scanning your payment screenshot\.\.\./g, 'Scanning your payment screenshot\\\\.\\\\.\\\\.');

fs.writeFileSync('artifacts/api-server/src/bot/handlers/payment.ts', content);
