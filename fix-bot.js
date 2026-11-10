const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/start.ts', 'utf8');

// replace the dashboard button
content = content.replace(
  '.url("🌐 Open Web Portal", `${appUrl}`)',
  '.url("🌐 Open Web Portal", `${appUrl}`)\n        .text("🔑 Web Login Key", "web_key")'
);

const newHandler = `
  bot.callbackQuery("web_key", async (ctx) => {
    await ctx.answerCallbackQuery();
    const { usersTable } = await import("@workspace/db");
    
    // Generate a random 8 char key if they don't have one
    const user = await getPremiumUser(ctx.from!.id);
    if (!user) return ctx.reply("Please use /start first.");
    
    let key = user.webLoginKey;
    if (!key) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let res = "";
      for (let i = 0; i < 8; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
      key = "VIP-" + res.substring(0,4) + "-" + res.substring(4);
      
      await db.update(usersTable).set({ webLoginKey: key }).where(eq(usersTable.userId, ctx.from!.id));
    }

    await ctx.reply(
      \`🔑 <b>Your Unique Web Key:</b>\\n\\n<pre>\${key}</pre>\\n\\nTap to copy this key, then go to the <b>Web Portal</b> to sync all your Telegram mock test progress.\`,
      { parse_mode: "HTML" }
    );
  });
`;

const insertPos = content.indexOf('bot.callbackQuery("dash_account",');
content = content.substring(0, insertPos) + newHandler + content.substring(insertPos);

fs.writeFileSync('artifacts/api-server/src/bot/handlers/start.ts', content);
