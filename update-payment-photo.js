const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/payment.ts', 'utf8');

// The replacement logic
const newPhotoLogic = `bot.on("message:photo", async (ctx, next) => {
    const userId = ctx.from!.id;
    const session = getSession(userId);
    if (!session.pendingUpiPayment) return next();

    const pending = session.pendingUpiPayment;
    if (pending.cartAbandonTimer) clearTimeout(pending.cartAbandonTimer);

    const photos = ctx.message.photo!;
    const bestPhoto = photos[photos.length - 1]!;

    const processingMsg = await ctx.reply("⏳ *Scanning your payment screenshot...*", { parse_mode: "MarkdownV2" });

    try {
      // 1. Get image data
      const file = await ctx.api.getFile(bestPhoto.file_id);
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const fileUrl = \`https://api.telegram.org/file/bot\${token}/\${file.file_path}\`;
      const imgRes = await fetch(fileUrl);
      const buffer = await imgRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const dataUrl = \`data:image/jpeg;base64,\${base64}\`;

      // 2. Call AI Vision
      const { askGeminiVision } = await import("../ai.js");
      const prompt = "Extract the recipient UPI ID, amount paid in INR (return number only), and the exact transaction date and time from this payment screenshot. Return ONLY a JSON object: { \\"amount\\": number, \\"upiId\\": \\"string\\", \\"timestamp\\": \\"ISO string\\", \\"unclear\\": boolean }. If you cannot confidently read these details, set \\"unclear\\": true.";
      const aiResponse = await askGeminiVision(prompt, [dataUrl], { json: true, temperature: 0 });
      
      let parsed = { unclear: true, amount: 0, upiId: "", timestamp: "" };
      try {
        parsed = JSON.parse(aiResponse);
      } catch (e) {
        console.error("AI JSON parse error:", e);
      }

      // 3. Verify
      const adminUpi = await getAdminUpi();
      const expectedAmount = pending.amount;
      let aiPassed = false;
      let rejectReason = "";

      if (!parsed.unclear) {
        if (parsed.upiId && parsed.upiId.toLowerCase() !== adminUpi.toLowerCase()) {
          rejectReason = \`Sent to \${parsed.upiId}, expected \${adminUpi}\`;
        } else if (parsed.amount < expectedAmount) {
          rejectReason = \`Amount ₹\${parsed.amount}, expected ₹\${expectedAmount}\`;
        } else if (parsed.timestamp) {
          const txTime = new Date(parsed.timestamp).getTime();
          const now = Date.now();
          const diffMins = Math.abs((now - txTime) / 60000);
          if (diffMins > 30) {
            rejectReason = "Transaction is too old or in the future";
          } else {
            aiPassed = true;
          }
        } else {
          aiPassed = true; // Assume pass if timestamp missing but amount & UPI match
        }
      }

      const isPremiumUser = pending.isPremium;
      const paymentId = randomUUID();
      
      await db.insert(paymentsTable).values({
        paymentId,
        userId,
        method: "UPI",
        amount: pending.amount,
        testId: pending.testId ?? null,
        screenshotFileId: bestPhoto.file_id,
        status: aiPassed ? "Completed" : "Pending",
      });

      updateSession(userId, { pendingUpiPayment: undefined });

      if (aiPassed) {
        // AI verification passed!
        await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
        
        if (isPremiumUser) {
          const now = new Date();
          const newExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          await db.update(usersTable).set({ tier: "Premium", premiumExpiry: newExpiry }).where(eq(usersTable.userId, userId));
          await ctx.reply(
            \`🎉 *Payment Verified Instantly by AI\\!*\n\nYour 30 Days Premium access has been activated\\.\`,
            { parse_mode: "MarkdownV2" }
          );
        } else {
          await ctx.reply(\`🎉 *Payment Verified Instantly by AI\\!*\n\nYour test has been unlocked\\.\`, { parse_mode: "MarkdownV2" });
        }
      } else {
        // Manual verification needed
        await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id,
          \`📥 *Screenshot Received\\!* ✅\n\nAI could not instantly verify this payment \${rejectReason ? \`(\${rejectReason})\` : ""}\\.\nIt has been forwarded to the admin for manual review\\.\n\nYour \${pending.isPremium ? "Premium tier" : "test"} will be unlocked once approved\\.\`,
          { parse_mode: "MarkdownV2" }
        );

        // Notify Admin group
        const groupsRaw = await getConfig("bot_groups");
        if (groupsRaw) {
          const groups = JSON.parse(groupsRaw);
          for (const g of groups) {
            const kb = new InlineKeyboard()
              .text("✅ Approve", \`approve_pay_\${paymentId}\`)
              .text("❌ Reject", \`reject_pay_\${paymentId}\`);
            await ctx.api.sendPhoto(g.id, bestPhoto.file_id, {
              caption: \`💳 *Manual Payment Review*\nUser: \${ctx.from.first_name} (\${userId})\nAmount: ₹\${pending.amount}\nItem: \${pending.isPremium ? "Premium" : pending.testId}\nAI Note: \${rejectReason || "Unclear image"}\`,
              parse_mode: "Markdown",
              reply_markup: kb
            }).catch(() => {});
          }
        }
      }

    } catch (err) {
      logger.error({ err }, "Error saving UPI screenshot");
      await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, "❌ Error saving screenshot. Please try again.").catch(() => {});
    }
  });`;

content = content.replace(/bot\.on\("message:photo", async \(ctx, next\) => \{[\s\S]*?\}\);/g, newPhotoLogic);
fs.writeFileSync('artifacts/api-server/src/bot/handlers/payment.ts', content);
