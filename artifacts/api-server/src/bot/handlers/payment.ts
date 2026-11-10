import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { db } from "@workspace/db";
import {
  paymentsTable,
  usersTable,
  testSeriesTable,
  purchasedTestsTable,
  flashSalesTable,
  couponCodesTable,
  couponRedemptionsTable,
} from "@workspace/db";
import { eq, and, lte, gte, sql } from "drizzle-orm";
import { getSession, updateSession } from "../session.js";
import { getConfig } from "./helpers.js";
import { activatePremium } from "./premium.js";
import { logger } from "../../lib/logger.js";
import { randomUUID, randomBytes } from "crypto";

function escMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (c) => `\\${c}`);
}

async function getAdminUpi(): Promise<string> {
  const configured = await getConfig("admin_upi_vpa");
  return configured ?? "BHARATPE.9E0K0C0H9S572997@unitype";
}

export function buildUpiPayUrl(vpa: string, payeeName: string, amount: number, note: string): string {
  const cleanVpa = vpa.trim();
  const cleanName = encodeURIComponent(payeeName.trim());
  const cleanNote = encodeURIComponent(note.trim());
  return `upi://pay?pa=${cleanVpa}&pn=${cleanName}&am=${amount}&cu=INR&tn=${cleanNote}`;
}

export function buildQrCodeUrl(upiUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=350x350&margin=10&data=${encodeURIComponent(upiUrl)}`;
}

async function getEffectivePrice(testId: string, priceInr: number, priceInStars: number): Promise<{ inr: number; stars: number; isOnSale: boolean }> {
  const now = new Date();
  const sale = await db
    .select()
    .from(flashSalesTable)
    .where(and(
      eq(flashSalesTable.testId, testId),
      eq(flashSalesTable.isActive, true),
      lte(flashSalesTable.createdAt, now),
      gte(flashSalesTable.endsAt, now),
    ))
    .limit(1);

  if (sale.length) {
    return { inr: sale[0]!.discountInr, stars: sale[0]!.discountStars, isOnSale: true };
  }
  return { inr: priceInr, stars: priceInStars, isOnSale: false };
}

async function validateCoupon(code: string, userId: number): Promise<typeof couponCodesTable.$inferSelect | null> {
  const [coupon] = await db.select().from(couponCodesTable)
    .where(and(
      eq(couponCodesTable.code, code.toUpperCase().trim()),
      eq(couponCodesTable.isActive, true),
    ))
    .limit(1);
  if (!coupon) return null;
  if (coupon.usedCount >= coupon.usageLimit) return null;
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return null;
  const [redemptions] = await db.select({ count: sql<number>`count(*)` })
    .from(couponRedemptionsTable)
    .where(and(eq(couponRedemptionsTable.couponId, coupon.id), eq(couponRedemptionsTable.userId, userId)));
  if (Number(redemptions?.count ?? 0) >= coupon.perUserLimit) return null;
  return coupon;
}

function applyDiscount(amount: number, coupon: typeof couponCodesTable.$inferSelect): number {
  let discounted = amount;
  if (coupon.discountPct > 0) {
    discounted = Math.round(amount * (1 - coupon.discountPct / 100));
  } else if (coupon.discountInr > 0) {
    discounted = Math.max(1, amount - coupon.discountInr);
  }
  return discounted;
}

function scheduleCartAbandonment(bot: Bot, userId: number, amount: number, testId?: string): ReturnType<typeof setTimeout> {
  return setTimeout(async () => {
    const session = getSession(userId);
    if (!session.pendingUpiPayment) return;

    const couponCode = `COME${randomBytes(3).toString("hex").toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.insert(couponCodesTable).values({
      code: couponCode,
      discountPct: 10,
      usageLimit: 1,
      expiresAt,
      isActive: true,
    }).onConflictDoNothing().catch((error) => logger.warn({ error, userId }, "Could not create abandoned-cart coupon"));
    const discountAmount = Math.max(1, Math.round(amount * 0.9));
    const adminUpi = await getAdminUpi();

    try {
      await bot.api.sendMessage(
        userId,
        `💸 *Payment Incomplete\\?*\n\nWe noticed you generated a payment QR but haven't completed the transaction yet\\.\n\n🎁 *Special Offer:* Pay *₹${discountAmount}* instead of *₹${amount}* \\(10% OFF\\!\\)\n\n🏷️ Your one\\-time coupon: \`${escMd(couponCode)}\`\n\nThis offer is valid for the next *5 minutes* only\\. Tap the payment button again and enter this code\\.\n\n🏦 UPI ID: \`${escMd(adminUpi)}\`\n\nSend screenshot after payment to unlock instantly\\! ⚡`,
        { parse_mode: "MarkdownV2", reply_markup: new InlineKeyboard().text("💳 Pay with Coupon", testId ? `pay_upi_${testId}` : "premium_upi") }
      );
    } catch (err) {
      logger.warn({ err, userId }, "Cart abandonment message failed");
    }
  }, 3 * 60 * 1000);
}

async function sendUpiPaymentDetails(bot: Bot, userId: number, inr: number, testId: string | undefined, isPremium: boolean, testName: string, couponCode?: string): Promise<void> {
  const adminUpi = await getAdminUpi();
  const cartTimer = scheduleCartAbandonment(bot, userId, inr, testId);
  updateSession(userId, {
    pendingUpiPayment: { testId, isPremium, amount: inr, couponCode, cartAbandonTimer: cartTimer, awaitingUtrInput: true },
    pendingCoupon: undefined,
    awaitingCouponInput: false,
  });

  const couponNote = couponCode ? `\n🏷️ Coupon: *${escMd(couponCode)}* applied ✅\n` : "";
  const itemLabel = isPremium ? "💎 Plan: *30 Days Premium Access*" : `📦 Test: *${escMd(testName)}*`;
  const noteField = isPremium ? `Premium_${userId}` : `User_${userId}_${testId ?? "Test"}`;

  const upiUrl = buildUpiPayUrl(adminUpi, "Series TestPro", inr, noteField);
  const qrImageUrl = buildQrCodeUrl(upiUrl);

  const kb = new InlineKeyboard()
    .text("✍️ Enter 12-Digit UTR", "enter_utr_manual")
    .text("❌ Cancel", "cancel_upi_pay");

  const caption = 
    `⚡ *DYNAMIC UPI PAYMENT QR*\n\n` +
    `${itemLabel}\n` +
    `💰 *Pay Exact Amount:* *₹${inr}*\n` +
    couponNote +
    `\n🏦 *BharatPe UPI ID:* \`${escMd(adminUpi)}\`\n` +
    `📝 *Note / Remarks:* \`${escMd(noteField)}\`\n\n` +
    `*Kaise Pay Karein:*\n` +
    `1️⃣ *Scan QR* \\(GPay / PhonePe / Paytm / BHIM\\) ya UPI ID par *₹${inr}* transfer karein\\.\n` +
    `2️⃣ Transfer ke baad 12\\-digit *UTR / Ref No\\.* note karein\\.\n` +
    `3️⃣ Payment ka *Screenshot* yahan bhej dein *YA* neeche *"✍️ Enter 12\\-Digit UTR"* dabakar UTR type karein\\.\n\n` +
    `🤖 *Auto\\-Verification:* Instant check hokar automatically unlock ho jayega\\! 🚀`;

  try {
    await bot.api.sendPhoto(userId, qrImageUrl, {
      caption,
      parse_mode: "MarkdownV2",
      reply_markup: kb,
    });
  } catch (err) {
    logger.warn({ err }, "Could not send QR image, sending text fallback");
    await bot.api.sendMessage(userId, caption, {
      parse_mode: "MarkdownV2",
      reply_markup: kb,
    });
  }
}

export function registerPaymentHandlers(bot: Bot): void {
  bot.callbackQuery(/^pay_upi_/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const testId = ctx.callbackQuery.data.replace("pay_upi_", "");
    const [test] = await db.select().from(testSeriesTable).where(eq(testSeriesTable.testId, testId)).limit(1);

    if (!test || test.priceInr <= 0) {
      await ctx.reply("❌ UPI payment is not available for this test.");
      return;
    }

    const userId = ctx.from.id;
    const { inr, isOnSale } = await getEffectivePrice(testId, test.priceInr, test.priceInStars);
    const saleTag = isOnSale ? " 🔥 *SALE*" : "";

    updateSession(userId, {
      pendingCoupon: { testId, isPremium: false, originalInr: inr, originalStars: test.priceInStars },
      awaitingCouponInput: false,
    });

    const { couponChoiceKeyboard } = await import("../keyboards.js");
    await ctx.reply(
      `💳 *PAY VIA UPI*${saleTag}\n\n` +
      `📦 Test: *${escMd(test.testName)}*\n` +
      `💰 Amount: *₹${inr}*\n\n` +
      `🏷️ Do you have a coupon code?`,
      { parse_mode: "MarkdownV2", reply_markup: couponChoiceKeyboard(testId, false) }
    );
  });

  bot.callbackQuery(/^pay_stars_/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const testId = ctx.callbackQuery.data.replace("pay_stars_", "");
    const [test] = await db.select().from(testSeriesTable).where(eq(testSeriesTable.testId, testId)).limit(1);

    if (!test || test.priceInStars <= 0) {
      await ctx.reply("❌ Stars payment is not configured for this test.");
      return;
    }

    const { stars, isOnSale } = await getEffectivePrice(testId, test.priceInr, test.priceInStars);

    try {
      await ctx.api.sendInvoice(
        ctx.from.id,
        test.testName,
        `Unlocks "${test.testName}" with detailed solutions and scorecard analytics.`,
        `test_${testId}_${ctx.from.id}_${Date.now()}`,
        "XTR",
        [{ label: isOnSale ? "Sale Price" : "Test Access", amount: stars }],
        { provider_token: "" }
      );
    } catch (err) {
      logger.error({ err }, "Stars invoice error");
      const adminUpi = await getAdminUpi();
      await ctx.reply(
        `⚠️ *Telegram Stars payment failed\\.*\n\nPlease use UPI payment instead\\.\nUPI ID: \`${escMd(adminUpi)}\``,
        { parse_mode: "MarkdownV2" }
      );
    }
  });

  bot.callbackQuery("premium_upi", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id;
    updateSession(userId, {
      pendingCoupon: { testId: undefined, isPremium: true, originalInr: 199, originalStars: 500 },
      awaitingCouponInput: false,
    });

    const { couponChoiceKeyboard } = await import("../keyboards.js");
    await ctx.reply(
      `💳 *PAY VIA UPI — PREMIUM UPGRADE*\n\n` +
      `💎 Plan: *30 Days Premium Access*\n` +
      `💰 Amount: *₹199*\n\n` +
      `🏷️ Do you have a coupon code?`,
      { parse_mode: "MarkdownV2", reply_markup: couponChoiceKeyboard(undefined, true) }
    );
  });

  bot.callbackQuery(/^coupon_no_/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id;
    const session = getSession(userId);
    const pending = session.pendingCoupon;
    if (!pending) { await ctx.reply("❌ Session expired. Please try again."); return; }

    try { await ctx.deleteMessage(); } catch (_) {}

    let testName = "Premium Upgrade";
    if (pending.testId) {
      const [t] = await db.select({ testName: testSeriesTable.testName }).from(testSeriesTable).where(eq(testSeriesTable.testId, pending.testId)).limit(1);
      testName = t?.testName ?? pending.testId;
    }

    await sendUpiPaymentDetails(bot, userId, pending.originalInr, pending.testId, pending.isPremium, testName);
  });

  bot.callbackQuery(/^coupon_yes_/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id;
    const session = getSession(userId);
    if (!session.pendingCoupon) { await ctx.reply("❌ Session expired. Please try again."); return; }

    updateSession(userId, { awaitingCouponInput: true });
    try { await ctx.deleteMessage(); } catch (_) {}

    await bot.api.sendMessage(userId,
      `🏷️ *Enter Your Coupon Code*\n\nType your coupon code below and send it:`,
      { parse_mode: "MarkdownV2" }
    );
  });

  bot.callbackQuery("premium_stars", async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      await ctx.api.sendInvoice(
        ctx.from.id,
        "Testbook+ Premium — 30 Days",
        "Unlocks ALL mock tests, AI Info Solver, and premium analytics for 30 Days.",
        `premium_30days_${ctx.from.id}_${Date.now()}`,
        "XTR",
        [{ label: "Premium 30 Days", amount: 500 }],
        { provider_token: "" }
      );
    } catch (err) {
      logger.error({ err }, "Stars premium invoice error");
      const adminUpi = await getAdminUpi();
      await ctx.reply(
        `⚠️ *Stars payment failed\\.*\n\nPlease use UPI payment instead\\.\n\nUPI ID: \`${escMd(adminUpi)}\`\nAmount: *₹199*`,
        { parse_mode: "MarkdownV2" }
      );
    }
  });

  bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
  });

  bot.on("message:successful_payment", async (ctx) => {
    const payment = ctx.message.successful_payment!;
    const userId = ctx.from!.id;
    const payload = payment.invoice_payload;

    try {
      const isPremium = payload.startsWith("premium_");
      const testId = isPremium ? null : payload.split("_")[1] ?? null;

      await db.insert(paymentsTable).values({
        paymentId: randomUUID(),
        userId,
        method: "TG_Stars",
        amount: payment.total_amount,
        testId,
        status: "Approved",
      });

      if (isPremium) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);
        await activatePremium(userId, 30, "Premium Stars payment");
        await ctx.reply(
          `✅ *Payment Successful\\!*\n\n💎 *Testbook\\+ Premium* is now active\\!\n📅 Valid till: *${escMd(expiry.toLocaleDateString("en-IN"))}*\n\nUse /test\\_series to access all tests\\.`,
          { parse_mode: "MarkdownV2" }
        );
      } else if (testId) {
        await db.insert(purchasedTestsTable).values({ userId, testId }).catch(() => {});
        const [test] = await db.select().from(testSeriesTable).where(eq(testSeriesTable.testId, testId)).limit(1);
        await ctx.reply(
          `✅ *Payment Successful\\!*\n\n🔓 *${escMd(test?.testName ?? testId)}* is now unlocked\\!\n\nUse /test\\_series to start the test\\.`,
          { parse_mode: "MarkdownV2" }
        );
      }
    } catch (err) {
      logger.error({ err }, "Stars payment processing error");
    }
  });

  bot.on("message:text", async (ctx, next) => {
    const userId = ctx.from!.id;
    const session = getSession(userId);
    if (!session.awaitingCouponInput || !session.pendingCoupon) return next();

    const code = ctx.message.text.trim().toUpperCase();
    const pending = session.pendingCoupon;
    const coupon = await validateCoupon(code, userId);

    if (!coupon) {
      await ctx.reply(
        `❌ *Invalid Coupon Code*\n\nThe code \`${escMd(code)}\` is either invalid, expired, or already used\\.\n\nProceed without coupon or try a different code\\.`,
        {
          parse_mode: "MarkdownV2",
          reply_markup: new InlineKeyboard()
            .text("🔄 Try Different Code", `coupon_yes_${pending.testId ? `testid_${pending.testId}` : "premium"}`).row()
            .text("✅ Proceed Without Coupon", `coupon_no_${pending.testId ? `testid_${pending.testId}` : "premium"}`),
        }
      );
      return;
    }

    const discountedInr = applyDiscount(pending.originalInr, coupon);
    await db.update(couponCodesTable)
      .set({ usedCount: sql`${couponCodesTable.usedCount} + 1` })
      .where(eq(couponCodesTable.code, coupon.code));
    await db.insert(couponRedemptionsTable).values({
      couponId: coupon.id,
      userId,
      grantedPremiumDays: coupon.discountPct >= 100 ? coupon.premiumDays : 0,
      outcome: "applied",
    });

    updateSession(userId, { awaitingCouponInput: false });

    let testName = "Premium Upgrade";
    if (pending.testId) {
      const [t] = await db.select({ testName: testSeriesTable.testName }).from(testSeriesTable).where(eq(testSeriesTable.testId, pending.testId)).limit(1);
      testName = t?.testName ?? pending.testId;
    }

    const savedAmount = pending.originalInr - discountedInr;
    if (pending.isPremium && coupon.discountPct >= 100) {
      await db.insert(paymentsTable).values({
        paymentId: randomUUID(),
        userId,
        method: "COUPON",
        amount: 0,
        testId: "premium",
        status: "Approved",
      });
      await activatePremium(userId, coupon.premiumDays, `100% coupon ${coupon.code}`);
      updateSession(userId, { pendingCoupon: undefined, pendingUpiPayment: undefined });
      await ctx.reply(
        `🎁 *100% Coupon Redeemed\\!*\n\n💎 Premium has been activated instantly for *${coupon.premiumDays} days*\\. Your VIP invite and welcome details are on the way\\.`,
        { parse_mode: "MarkdownV2" },
      );
      return;
    }
    await ctx.reply(
      `✅ *Coupon Applied\\!*\n\n🏷️ Code: \`${escMd(coupon.code)}\`\n💰 Original: ~~₹${pending.originalInr}~~\n🎉 You save: *₹${savedAmount}*\n💚 Final Amount: *₹${discountedInr}*`,
      { parse_mode: "MarkdownV2" }
    );

    await sendUpiPaymentDetails(bot, userId, discountedInr, pending.testId, pending.isPremium, testName, coupon.code);
  });

  
  // Callback to prompt user to type 12-digit UTR
  bot.callbackQuery("enter_utr_manual", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id;
    const session = getSession(userId);
    if (!session.pendingUpiPayment) {
      await ctx.reply("❌ Payment session expired. Please start payment again.");
      return;
    }
    updateSession(userId, {
      pendingUpiPayment: { ...session.pendingUpiPayment, awaitingUtrInput: true }
    });
    await ctx.reply(
      `✍️ *ENTER 12\\-DIGIT UTR / REFERENCE NO\\.*\n\n` +
      `Apne UPI app \\(GPay / PhonePe / Paytm / BHIM\\) se 12\\-digit *UTR / Transaction ID / Ref No\\.* yahan message mein type karke bhejein:\n\n` +
      `_Example: 431289564012_`,
      { parse_mode: "MarkdownV2" }
    );
  });

  bot.callbackQuery("cancel_upi_pay", async (ctx) => {
    await ctx.answerCallbackQuery("Payment cancelled");
    const userId = ctx.from.id;
    const session = getSession(userId);
    if (session.pendingUpiPayment?.cartAbandonTimer) {
      clearTimeout(session.pendingUpiPayment.cartAbandonTimer);
    }
    updateSession(userId, { pendingUpiPayment: undefined, awaitingCouponInput: false });
    try { await ctx.deleteMessage(); } catch (_) {}
    await ctx.reply("❌ Payment process cancelled. You can retry anytime with /premium or /test_series.");
  });

  // Handle Photo: Download, OCR via Gemini AI, Auto-Verify UTR & Unlock Instantly
  bot.on("message:photo", async (ctx, next) => {
    const userId = ctx.from!.id;
    const session = getSession(userId);
    if (!session.pendingUpiPayment) return next();

    const pending = session.pendingUpiPayment;
    if (pending.cartAbandonTimer) clearTimeout(pending.cartAbandonTimer);

    const photos = ctx.message.photo!;
    const bestPhoto = photos[photos.length - 1]!;

    const processingMsg = await ctx.reply("⏳ *Analyzing payment screenshot via AI\\.\\.\\.*", { parse_mode: "MarkdownV2" });

    try {
      // 1. Download file from Telegram to base64 for Gemini Vision
      const fileInfo = await ctx.api.getFile(bestPhoto.file_id);
      let base64Image: string | null = null;
      if (fileInfo.file_path && process.env["TELEGRAM_BOT_TOKEN"]) {
        const fileUrl = `https://api.telegram.org/file/bot${process.env["TELEGRAM_BOT_TOKEN"]}/${fileInfo.file_path}`;
        const imgRes = await fetch(fileUrl);
        if (imgRes.ok) {
          const arrayBuffer = await imgRes.arrayBuffer();
          base64Image = Buffer.from(arrayBuffer).toString("base64");
        }
      }

      // 2. OCR with Gemini if image was successfully retrieved
      let extractedUtr: string | null = null;
      let ocrAmount: number | null = null;
      let ocrSuccess: boolean = false;

      if (base64Image) {
        try {
          const { askGemini } = await import("../ai.js");
          const prompt = `Analyze this Indian UPI payment screenshot (PhonePe, Google Pay, Paytm, BHIM, BharatPe, etc.).
Extract the following details as JSON strictly matching this schema:
{
  "utr": "12-digit numeric string or null if not found",
  "amount": number or null,
  "status": "success" | "pending" | "failed" | "unknown",
  "payee": "payee name or UPI ID if visible or null"
}
Only output pure JSON. Do not wrap in markdown quotes if possible.`;

          const aiReply = await askGemini([
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
              ]
            }
          ], { json: true, temperature: 0.1 });

          const cleaned = aiReply.replace(/```json/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleaned) as { utr?: string; amount?: number; status?: string };
          if (parsed.utr && /^\d{12}$/.test(parsed.utr.trim())) {
            extractedUtr = parsed.utr.trim();
          }
          if (typeof parsed.amount === "number") {
            ocrAmount = parsed.amount;
          }
          ocrSuccess = parsed.status === "success" || parsed.status === "completed" || parsed.status === "done";
        } catch (ocrErr) {
          logger.warn({ ocrErr }, "AI OCR analysis failed or skipped");
        }
      }

      // 3. If valid 12-digit UTR found and status is success -> Instant Auto Verification!
      if (extractedUtr) {
        const verifyRes = await verifyAndUnlockPayment(userId, extractedUtr, pending, bestPhoto.file_id);
        if (verifyRes.success) {
          await ctx.api.editMessageText(
            ctx.chat.id,
            processingMsg.message_id,
            `🎉 <b>Payment Verified Automatically!</b> ✅\n\n` +
            `🔍 <b>Extracted UTR:</b> <code>${extractedUtr}</code>\n` +
            `💰 <b>Amount:</b> ₹${pending.amount}\n\n` +
            (pending.isPremium 
              ? `💎 <b>VIP Premium has been unlocked!</b> Welcome aboard.` 
              : `📦 <b>Mock Test has been unlocked!</b> Best of luck.`),
            { parse_mode: "HTML" }
          ).catch(() => {});
          return;
        } else if (verifyRes.reason === "duplicate") {
          await ctx.api.editMessageText(
            ctx.chat.id,
            processingMsg.message_id,
            `❌ <b>Duplicate UTR Detected!</b>\n\nUTR <code>${extractedUtr}</code> has already been redeemed previously. If you believe this is an error, please reach out via /support.`,
            { parse_mode: "HTML" }
          ).catch(() => {});
          return;
        }
      }

      // 4. Fallback: Save as Pending and notify user
      const paymentId = randomUUID();
      await db.insert(paymentsTable).values({
        paymentId,
        userId,
        method: "UPI",
        amount: pending.amount,
        testId: pending.testId ?? null,
        screenshotFileId: bestPhoto.file_id,
        utr: extractedUtr,
        status: "Pending",
      });

      updateSession(userId, { pendingUpiPayment: undefined });

      await ctx.api.editMessageText(
        ctx.chat.id, 
        processingMsg.message_id,
        `📥 <b>Screenshot Received!</b> ✅\n\n` +
        (extractedUtr ? `UTR Detected: <code>${extractedUtr}</code>\n` : `Screenshot is queued for quick review.\n`) +
        `Your ` + (pending.isPremium ? "Premium tier" : "test") + ` will be activated shortly.`,
        { parse_mode: "HTML" }
      ).catch(() => {});

    } catch (err) {
      logger.error({ err }, "Error saving UPI screenshot");
      await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, "❌ Error saving screenshot. Please try again.").catch(() => {});
    }
  });

  // Handle manual 12-digit UTR text entry
  bot.on("message:text", async (ctx, next) => {
    const userId = ctx.from!.id;
    const session = getSession(userId);

    // If awaiting coupon, let next middleware or coupon handler take it
    if (session.awaitingCouponInput) return next();

    const text = ctx.message.text.trim();
    const is12DigitNum = /^\d{12}$/.test(text);

    if (session.pendingUpiPayment && (session.pendingUpiPayment.awaitingUtrInput || is12DigitNum)) {
      if (!is12DigitNum) {
        await ctx.reply(
          `⚠️ *Invalid UTR Format*\n\n` +
          `UPI UTR / Reference number theek *12 digits* ka number hota hai \\(e\\.g\\. \`431289564012\`\\)\\.\n\n` +
          `Kripya dobara check karke 12\\-digit number bhejein ya payment ka screenshot upload karein\\.`,
          { parse_mode: "MarkdownV2" }
        );
        return;
      }

      const pending = session.pendingUpiPayment;
      const checkMsg = await ctx.reply("🔍 *Verifying UTR Reference\\.\\.\\.*", { parse_mode: "MarkdownV2" });

      const verifyRes = await verifyAndUnlockPayment(userId, text, pending);

      if (verifyRes.success) {
        const successText = `🎉 <b>Payment Auto-Verified!</b> ✅\n\n` +
          `🔢 <b>UTR Ref:</b> <code>${text}</code>\n` +
          `💰 <b>Amount:</b> ₹${pending.amount}\n\n` +
          (pending.isPremium 
            ? `💎 <b>VIP Premium has been activated!</b> Enjoy unlimited tests and features.` 
            : `📦 <b>Mock Test has been unlocked!</b> You can now start practicing.`);
        
        try {
          await ctx.api.editMessageText(ctx.chat.id, checkMsg.message_id, successText, { parse_mode: "HTML" });
        } catch {
          await ctx.reply(successText, { parse_mode: "HTML" });
        }
        return;
      } else if (verifyRes.reason === "duplicate") {
        const dupText = `❌ <b>UTR Already Used!</b>\n\nYeh UTR (<code>${text}</code>) pehle hi redeem kiya ja chuka hai. Ek transaction sirf ek hi baar use ho sakti hai.`;
        try {
          await ctx.api.editMessageText(ctx.chat.id, checkMsg.message_id, dupText, { parse_mode: "HTML" });
        } catch {
          await ctx.reply(dupText, { parse_mode: "HTML" });
        }
        return;
      } else {
        const errText = `⚠️ <b>Verification Pending</b>\n\nUTR <code>${text}</code> has been received and saved. If auto-activation takes more than a moment, our team will review it shortly.`;
        try {
          await ctx.api.editMessageText(ctx.chat.id, checkMsg.message_id, errText, { parse_mode: "HTML" });
        } catch {
          await ctx.reply(errText, { parse_mode: "HTML" });
        }
        return;
      }
    }

    return next();
  });
}

/**
 * Common verification & unlock helper:
 * - Checks UTR uniqueness in database
 * - Records approved payment record
 * - Automatically activates Premium or unlocks the specific Test
 */
async function verifyAndUnlockPayment(
  userId: number,
  utr: string,
  pending: { testId?: string; isPremium: boolean; amount: number; cartAbandonTimer?: any },
  screenshotFileId?: string
): Promise<{ success: boolean; reason?: "duplicate" | "error" }> {
  try {
    // Ensure utr column exists in payments table in database
    const { pool } = await import("@workspace/db");
    if (pool?.query) {
      await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS utr TEXT;").catch(() => {});
    }

    // 1. Check if UTR already exists in paymentsTable
    const [existing] = await db
      .select({ id: paymentsTable.id })
      .from(paymentsTable)
      .where(and(eq(paymentsTable.utr, utr), eq(paymentsTable.status, "Approved")))
      .limit(1);

    if (existing) {
      return { success: false, reason: "duplicate" };
    }

    // 2. Clear abandon timer and session
    if (pending.cartAbandonTimer) clearTimeout(pending.cartAbandonTimer);
    updateSession(userId, { pendingUpiPayment: undefined });

    const paymentId = randomUUID();

    // 3. Insert payment as Approved
    await db.insert(paymentsTable).values({
      paymentId,
      userId,
      method: "UPI",
      amount: pending.amount,
      testId: pending.testId ?? (pending.isPremium ? "premium" : null),
      screenshotFileId: screenshotFileId ?? null,
      utr,
      status: "Approved",
    });

    // 4. Unlock product
    if (pending.isPremium || !pending.testId) {
      await activatePremium(userId, 30, `Auto UPI BharatPe UTR: ${utr}`);
    } else {
      await db.insert(purchasedTestsTable).values({
        userId,
        testId: pending.testId,
      }).onConflictDoNothing().catch(() => {});
    }

    logger.info({ userId, utr, amount: pending.amount }, "Payment auto-verified and unlocked successfully");
    return { success: true };
  } catch (err) {
    logger.error({ err, userId, utr }, "Error verifying and unlocking payment");
    return { success: false, reason: "error" };
  }
}

export function registerAdminPaymentHandlers(bot: import("grammy").Bot): void {
  bot.callbackQuery(/^approve_pay_/, async (ctx) => {
    const paymentId = ctx.callbackQuery.data.replace("approve_pay_", "");
    
    // Check if the user is admin
    // For simplicity, anyone who can press the button in the admin group can approve
    try {
      const { db, paymentsTable, usersTable, eq } = await import("@workspace/db");
      const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.paymentId, paymentId)).limit(1);
      
      if (!payment || payment.status === "Completed") {
        await ctx.answerCallbackQuery("Already processed or not found.");
        return;
      }
      
      await db.update(paymentsTable).set({ status: "Completed" }).where(eq(paymentsTable.paymentId, paymentId));
      
      if (!payment.testId) {
        // It's premium
        const now = new Date();
        const newExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await db.update(usersTable).set({ tier: "Premium", premiumExpiry: newExpiry }).where(eq(usersTable.userId, payment.userId));
        await ctx.api.sendMessage(payment.userId, `🎉 *Payment Approved\\!*\n\nYour 30 Days Premium access has been activated by the admin\\.\n\n💎 *VIP Group:* \nAs a premium member, join our exclusive VIP group:\nhttps://t\\.me/joinchat/vip\\-group\\-placeholder\n\nEnjoy\\!`, { parse_mode: "MarkdownV2" }).catch(()=>{});
      } else {
        await ctx.api.sendMessage(payment.userId, `🎉 *Payment Approved\\!*\n\nYour test has been unlocked\\.\n\nGood luck\\!`, { parse_mode: "MarkdownV2" }).catch(()=>{});
      }
      
      await ctx.editMessageCaption({
        caption: (ctx.callbackQuery.message?.caption || "") + "\n\n✅ <b>APPROVED by Admin</b>",
        parse_mode: "HTML"
      }).catch(()=>{});
      await ctx.answerCallbackQuery("Approved!");
    } catch(e) {
      console.error(e);
      await ctx.answerCallbackQuery("Error processing");
    }
  });

  bot.callbackQuery(/^reject_pay_/, async (ctx) => {
    const paymentId = ctx.callbackQuery.data.replace("reject_pay_", "");
    try {
      const { db, paymentsTable, eq } = await import("@workspace/db");
      const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.paymentId, paymentId)).limit(1);
      if (!payment || payment.status !== "Pending") {
        await ctx.answerCallbackQuery("Already processed or not found.");
        return;
      }
      
      await db.update(paymentsTable).set({ status: "Failed" }).where(eq(paymentsTable.paymentId, paymentId));
      await ctx.api.sendMessage(payment.userId, `❌ *Payment Rejected\\!*\n\nYour payment screenshot was reviewed and could not be verified\\.\nPlease contact support if this is a mistake\\.`, { parse_mode: "MarkdownV2" }).catch(()=>{});
      
      await ctx.editMessageCaption({
        caption: (ctx.callbackQuery.message?.caption || "") + "\n\n❌ <b>REJECTED by Admin</b>",
        parse_mode: "HTML"
      }).catch(()=>{});
      await ctx.answerCallbackQuery("Rejected!");
    } catch(e) {
      console.error(e);
      await ctx.answerCallbackQuery("Error processing");
    }
  });
}
