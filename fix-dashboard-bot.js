const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/start.ts', 'utf8');

content = content.replace(
  'const dashKb = new InlineKeyboard()',
  `const { createLearnerWebUrl } = await import("../../routes/learner.js");
      const webUrl = await createLearnerWebUrl(userId);
      const dashKb = new InlineKeyboard()`
);

content = content.replace(
  '.text("👥 Referral", "dash_ref")',
  `.text("👥 Referral", "dash_ref")
        .row()
        .url("🌐 Open Web Portal", webUrl || "https://testbook.com")`
);

fs.writeFileSync('artifacts/api-server/src/bot/handlers/start.ts', content);
