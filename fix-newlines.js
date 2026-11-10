const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/payment.ts', 'utf8');

content = content.replace(/✅AI could not/g, '✅\\n\\nAI could not');
content = content.replace(/\\\.It has been/g, '\\.\\nIt has been');
content = content.replace(/\\\.Your \$\{pending\.isPremium/g, '\\.\\n\\nYour ${pending.isPremium');
content = content.replace(/\$\{rejectReason \? `\(\$\{rejectReason\}\)` : ""\}/g, '${rejectReason ? `(${escMd(rejectReason)})` : ""}');
content = content.replace(/Your 30 Days Premium access has been activated\\\\\./g, 'Your 30 Days Premium access has been activated\\\\.\\\\n\\\\n💎 *VIP Group:* \\\\nAs a premium member, join our exclusive VIP group:\\\\nhttps://t\\\\.me/joinchat/vip\\\\-group\\\\-placeholder');

fs.writeFileSync('artifacts/api-server/src/bot/handlers/payment.ts', content);
