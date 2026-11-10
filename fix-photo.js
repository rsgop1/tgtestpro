const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/payment.ts', 'utf8');

const matchStart = '  bot.on("message:photo", async (ctx, next) => {';
const matchEnd = 'export function registerAdminPaymentHandlers(bot: import("grammy").Bot): void {';

const startIndex = content.indexOf(matchStart);
const endIndex = content.indexOf(matchEnd);

if (startIndex !== -1 && endIndex !== -1) {
  const newLogic = `  bot.on("message:photo", async (ctx, next) => {
    const userId = ctx.from!.id;
    const session = getSession(userId);
    if (!session.pendingUpiPayment) return next();

    const pending = session.pendingUpiPayment;
    if (pending.cartAbandonTimer) clearTimeout(pending.cartAbandonTimer);

    const photos = ctx.message.photo!;
    const bestPhoto = photos[photos.length - 1]!;

    const processingMsg = await ctx.reply("⏳ Uploading your screenshot securely...");

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

      await ctx.api.editMessageText(
        ctx.chat.id, 
        processingMsg.message_id,
        "📥 <b>Screenshot Received!</b> ✅\\n\\nYour payment screenshot has been sent to the Admin Panel for manual review.\\n\\nYour " + (isPremiumUser ? "Premium tier" : "test") + " will be unlocked as soon as the admin approves it in the web dashboard.",
        { parse_mode: "HTML" }
      ).catch(() => {});

    } catch (err) {
      logger.error({ err }, "Error saving UPI screenshot");
      await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, "❌ Error saving screenshot. Please try again.").catch(() => {});
    }
  });

}

`;
  
  content = content.substring(0, startIndex) + newLogic + content.substring(endIndex);
  fs.writeFileSync('artifacts/api-server/src/bot/handlers/payment.ts', content);
  console.log("Fixed!");
} else {
  console.log("Failed to find index");
}
