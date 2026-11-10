const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/start.ts', 'utf8');

const newCode = `
  bot.callbackQuery("dash_account", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "⚙️ <b>Account Settings</b>\\n\\nManage your profile and subscriptions using the Web Portal.\\nTap on '🌐 Open Web Portal' in your dashboard to view and manage your account details.",
      { parse_mode: "HTML" }
    );
  });
`;

// append to the end of the registerStartHandlers function but before the closing bracket
const insertPos = content.lastIndexOf('}');
content = content.substring(0, insertPos) + newCode + content.substring(insertPos);
fs.writeFileSync('artifacts/api-server/src/bot/handlers/start.ts', content);
