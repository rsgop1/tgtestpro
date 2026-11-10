const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/payment.ts', 'utf8');

// Replace everything between try { // 1. Get image data and // 3. Verify
// with just storing the info and sending for manual verification.
const newPhotoLogic = `
  bot.on("message:photo", async (ctx, next) => {
    const userId = ctx.from!.id;
    const session = getSession(userId);
    if (!session.pendingUpiPayment) return next();

    const pending = session.pendingUpiPayment;
    if (pending.cartAbandonTimer) clearTimeout(pending.cartAbandonTimer);

    const photos = ctx.message.photo!;
    const bestPhoto = photos[photos.length - 1]!;

    const processingMsg = await ctx.reply("⏳ *Sending your screenshot to admins for manual review\\.\\.\\.*", { parse_mode: "MarkdownV2" });

    try {
      const isPremiumUser = pending.isPremium;
      const paymentId = randomUUID();
      
      await db.insert(paymentsTable).values({
        paymentId,
        userId,
        method: "UPI",
        amount: pending.amount,
        testId: pending.testId ?? null,
        screenshotFileId: bestPhoto.file_id,
        status: "Pending",
      });

      updateSession(userId, { pendingUpiPayment: undefined });

      // Manual verification needed
      await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id,
        \`📥 *Screenshot Received\\!* ✅\\n\\nYour screenshot has been forwarded to the admin for manual review\\.\\n\\nYour \${pending.isPremium ? "Premium tier" : "test"} will be unlocked once approved\\.\`,
        { parse_mode: "MarkdownV2" }
      ).catch(() => {});

      // Notify Admin group
      const groupsRaw = await getConfig("bot_groups");
      if (groupsRaw) {
        const groups = JSON.parse(groupsRaw);
        for (const g of groups) {
          const { InlineKeyboard } = await import("grammy");
          const kb = new InlineKeyboard()
            .text("✅ Approve", \`approve_pay_\${paymentId}\`)
            .text("❌ Reject", \`reject_pay_\${paymentId}\`);
          await ctx.api.sendPhoto(g.id, bestPhoto.file_id, {
            caption: \`💳 *Manual Payment Review*\\nUser: \${ctx.from.first_name} (\${userId})\\nAmount: ₹\${pending.amount}\\nItem: \${pending.isPremium ? "Premium" : pending.testId}\\nStatus: Awaiting Admin Verification\`,
            parse_mode: "Markdown",
            reply_markup: kb
          }).catch(() => {});
        }
      }
    } catch (err) {
      logger.error({ err }, "Error saving UPI screenshot");
      await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, "❌ Error saving screenshot. Please try again.").catch(() => {});
    }
  });
`;

// we need to replace the whole `bot.on("message:photo", ...)` block
const matchStart = 'bot.on("message:photo", async (ctx, next) => {';
const matchEnd = '  });\n\n}\n\nexport function registerAdminPaymentHandlers';

const startIndex = content.indexOf(matchStart);
const endIndex = content.indexOf(matchEnd);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + newPhotoLogic + "\n}\n\nexport function registerAdminPaymentHandlers" + content.substring(endIndex + matchEnd.length);
  fs.writeFileSync('artifacts/api-server/src/bot/handlers/payment.ts', content);
  console.log("Successfully replaced photo handler");
} else {
  console.log("Could not find start/end indexes");
}
