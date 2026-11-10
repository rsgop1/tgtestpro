const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/payment.ts', 'utf8');

const regex = /await ctx\.reply\(\s*\`🎉 \*Payment Verified Instantly by AI\\\\!\*Your 30 Days Premium access has been activated\\\\\.\\n\\n💎 \*VIP Group:\* \\nAs a premium member, join our exclusive VIP group:\\nhttps:\/\/t\\\.me\/joinchat\/vip\\\\-group\\\\-placeholder\`,\s*\{ parse_mode: "MarkdownV2" \}\s*\);\s*\} else \{\s*await ctx\.reply\(\`🎉 \*Payment Verified Instantly by AI\\\\!\*Your test has been unlocked\\\\\.\`, \{ parse_mode: "MarkdownV2" \}\);\s*\}\s*\} else \{\s*\/\/ Manual verification needed\s*await ctx\.api\.editMessageText\(ctx\.chat\.id, processingMsg\.message_id,\s*\`📥 \*Screenshot Received\\\\!\* ✅AI could not instantly verify this payment \$\{rejectReason \? \`\(\$\{escMd\(rejectReason\)\}\)\` : ""\}\\\\\.It has been forwarded to the admin for manual review\\\\\.Your \$\{pending\.isPremium \? "Premium tier" : "test"\} will be unlocked once approved\\\\\.\`,\s*\{ parse_mode: "MarkdownV2" \}\s*\);/s;

const replacement = `await ctx.reply(
            \`🎉 *Payment Verified Instantly by AI\\\\!*\n\nYour 30 Days Premium access has been activated\\\\.\n\n💎 *VIP Group:* \nAs a premium member, join our exclusive VIP group:\nhttps://t\\\\.me/joinchat/vip\\\\-group\\\\-placeholder\`,
            { parse_mode: "MarkdownV2" }
          );
        } else {
          await ctx.reply(\`🎉 *Payment Verified Instantly by AI\\\\!*\n\nYour test has been unlocked\\\\.\`, { parse_mode: "MarkdownV2" });
        }
      } else {
        // Manual verification needed
        await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id,
          \`📥 *Screenshot Received\\\\!* ✅\n\nAI could not instantly verify this payment \${rejectReason ? \\\`(\\\${escMd(rejectReason)})\\\` : ""}\\\\.\nIt has been forwarded to the admin for manual review\\\\.\n\nYour \${pending.isPremium ? "Premium tier" : "test"} will be unlocked once approved\\\\.\`,
          { parse_mode: "MarkdownV2" }
        );`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync('artifacts/api-server/src/bot/handlers/payment.ts', content);
  console.log("Replaced");
} else {
  console.log("Not found");
}
