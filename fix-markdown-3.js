const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/payment.ts', 'utf8');

content = content.replace(
  /caption: `💳 \*Manual Payment Review\*\\nUser: \$\{ctx\.from\.first_name\} \(\$\{userId\}\)\\nAmount: ₹\$\{pending\.amount\}\\nItem: \$\{pending\.isPremium \? "Premium" : pending\.testId\}\\nStatus: Awaiting Admin Verification`,\\s*parse_mode: "Markdown",/g,
  'caption: `💳 <b>Manual Payment Review</b>\\nUser: ${ctx.from.first_name.replace(/</g, "&lt;").replace(/>/g, "&gt;")} (${userId})\\nAmount: ₹${pending.amount}\\nItem: ${pending.isPremium ? "Premium" : pending.testId}\\nStatus: Awaiting Admin Verification`,\n            parse_mode: "HTML",'
);

content = content.replace(
  /caption: ctx\.callbackQuery\.message\?\.caption \+ "\\n\\n✅ \*APPROVED by Admin\*",\\s*parse_mode: "Markdown"/g,
  'caption: (ctx.callbackQuery.message?.caption || "") + "\\n\\n✅ <b>APPROVED by Admin</b>",\n        parse_mode: "HTML"'
);

content = content.replace(
  /caption: ctx\.callbackQuery\.message\?\.caption \+ "\\n\\n❌ \*REJECTED by Admin\*",\\s*parse_mode: "Markdown"/g,
  'caption: (ctx.callbackQuery.message?.caption || "") + "\\n\\n❌ <b>REJECTED by Admin</b>",\n        parse_mode: "HTML"'
);

fs.writeFileSync('artifacts/api-server/src/bot/handlers/payment.ts', content);
