const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/payment.ts', 'utf8');

const s1 = '`🎉 *Payment Verified Instantly by AI\\!*Your 30 Days Premium access has been activated\\.\\n\\n💎 *VIP Group:* \\nAs a premium member, join our exclusive VIP group:\\nhttps://t\\.me/joinchat/vip\\-group\\-placeholder`';
const r1 = '`🎉 *Payment Verified Instantly by AI\\\\!*\n\nYour 30 Days Premium access has been activated\\\\.\n\n💎 *VIP Group:* \nAs a premium member, join our exclusive VIP group:\nhttps://t\\\\.me/joinchat/vip\\\\-group\\\\-placeholder`';

const s2 = '`🎉 *Payment Verified Instantly by AI\\!*Your test has been unlocked\\.`';
const r2 = '`🎉 *Payment Verified Instantly by AI\\\\!*\n\nYour test has been unlocked\\\\.`';

const s3 = '`📥 *Screenshot Received\\!* ✅AI could not instantly verify this payment ${rejectReason ? `(${escMd(rejectReason)})` : ""}\\.It has been forwarded to the admin for manual review\\.Your ${pending.isPremium ? "Premium tier" : "test"} will be unlocked once approved\\.`';
const r3 = '`📥 *Screenshot Received\\\\!* ✅\n\nAI could not instantly verify this payment ${rejectReason ? `(${escMd(rejectReason)})` : ""}\\\\.\nIt has been forwarded to the admin for manual review\\\\.\n\nYour ${pending.isPremium ? "Premium tier" : "test"} will be unlocked once approved\\\\.`';

content = content.replace(s1, r1);
content = content.replace(s2, r2);
content = content.replace(s3, r3);

fs.writeFileSync('artifacts/api-server/src/bot/handlers/payment.ts', content);
