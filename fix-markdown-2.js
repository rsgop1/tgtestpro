const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/payment.ts', 'utf8');

// Replace the manual verification editMessageText block
content = content.replace(
  /await ctx\.api\.editMessageText\(ctx\.chat\.id, processingMsg\.message_id,[\s\S]*?\{ parse_mode: "MarkdownV2" \}\s*\)\.catch\(\(\) => \{\}\);/m,
  `await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id,
        "📥 *Screenshot Received!* ✅\\n\\nYour screenshot has been forwarded to the admin for manual review.\\n\\nYour " + (pending.isPremium ? "Premium tier" : "test") + " will be unlocked once approved.",
        { parse_mode: "Markdown" }
      ).catch(() => {});`
);

fs.writeFileSync('artifacts/api-server/src/bot/handlers/payment.ts', content);
