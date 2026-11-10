const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/payment.ts', 'utf8');

content = content.replace(/Your 30 Days Premium access has been activated\\\\\.\\\\n\\\\n💎 \*VIP Group:\* \\\\nAs a premium member, join our exclusive VIP group:\\\\nhttps:\/\/t\\\\\.me\/joinchat\/vip\\\\-group\\\\-placeholder\\n\\n💎 \*VIP Group:\* \\nAs a premium member, join our exclusive VIP group:\\nhttps:\/\/t\\\\\.me\/joinchat\/vip\\\\-group\\\\-placeholder/g, 'Your 30 Days Premium access has been activated\\\\.\\n\\n💎 *VIP Group:* \\nAs a premium member, join our exclusive VIP group:\\nhttps://t\\\\.me/joinchat/vip\\\\-group\\\\-placeholder');

fs.writeFileSync('artifacts/api-server/src/bot/handlers/payment.ts', content);
