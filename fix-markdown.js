const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/payment.ts', 'utf8');

content = content.replace(
  'const processingMsg = await ctx.reply("⏳ *Sending your screenshot to admins for manual review\\.\\.\\.*", { parse_mode: "MarkdownV2" });',
  'const processingMsg = await ctx.reply("⏳ Sending your screenshot to admins for manual review...");'
);

content = content.replace(
  /`📥 \*Screenshot Received\\\\!\* ✅\\n\\nYour screenshot has been forwarded to the admin for manual review\\\\.\\n\\nYour \$\{pending\.isPremium \? "Premium tier" : "test"\} will be unlocked once approved\\\\.`/g,
  '`📥 *Screenshot Received!* ✅\\n\\nYour screenshot has been forwarded to the admin for manual review.\\n\\nYour ${pending.isPremium ? "Premium tier" : "test"} will be unlocked once approved.`'
);

fs.writeFileSync('artifacts/api-server/src/bot/handlers/payment.ts', content);
