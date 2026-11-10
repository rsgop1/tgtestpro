const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/payment.ts', 'utf8');

// Replace all instances of `parse_mode: "Markdown"` that have to do with manual review manually
content = content.replace(
  'caption: `💳 *Manual Payment Review*\\nUser: ${ctx.from.first_name} (${userId})\\nAmount: ₹${pending.amount}\\nItem: ${pending.isPremium ? "Premium" : pending.testId}\\nStatus: Awaiting Admin Verification`,',
  'caption: `💳 <b>Manual Payment Review</b>\\nUser: ${ctx.from.first_name.replace(/</g, "&lt;").replace(/>/g, "&gt;")} (${userId})\\nAmount: ₹${pending.amount}\\nItem: ${pending.isPremium ? "Premium" : pending.testId}\\nStatus: Awaiting Admin Verification`,'
);

content = content.replace(
  /caption: `💳 <b(.*?)Awaiting Admin Verification`,\n(\s*)parse_mode: "Markdown",/g,
  'caption: `💳 <b$1Awaiting Admin Verification`,\n$2parse_mode: "HTML",'
);

content = content.replace(
  /caption: ctx\.callbackQuery\.message\?\.caption \+ "\\n\\n✅ \*APPROVED by Admin\*",\n(\s*)parse_mode: "Markdown"/g,
  'caption: (ctx.callbackQuery.message?.caption || "") + "\\n\\n✅ <b>APPROVED by Admin</b>",\n$1parse_mode: "HTML"'
);

content = content.replace(
  /caption: ctx\.callbackQuery\.message\?\.caption \+ "\\n\\n❌ \*REJECTED by Admin\*",\n(\s*)parse_mode: "Markdown"/g,
  'caption: (ctx.callbackQuery.message?.caption || "") + "\\n\\n❌ <b>REJECTED by Admin</b>",\n$1parse_mode: "HTML"'
);

fs.writeFileSync('artifacts/api-server/src/bot/handlers/payment.ts', content);
