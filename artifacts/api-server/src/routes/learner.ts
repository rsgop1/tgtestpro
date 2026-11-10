import { desc } from "drizzle-orm";
import { Router, type Request, type Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, reportsTable, testSeriesTable, userHistoryTable, usersTable } from "@workspace/db";
import type { QuestionData } from "@workspace/db";
import { createHmac, timingSafeEqual } from "crypto";
import { getApi } from "../bot/api-instance.js";
import { scorecardKeyboard } from "../bot/keyboards.js";
import { askGroq, BOT_HELP_CONTEXT } from "../bot/ai.js";
import { logger } from "../lib/logger.js";
import { updateSession } from "../bot/session.js";
import { getConfig } from "../bot/handlers/helpers.js";

const router = Router();
const WEB_TOKEN_SECRET = process.env["SESSION_SECRET"] ?? "fallback-secret-change-me";
const TOKEN_TTL_SECONDS = 6 * 60 * 60;

function encode(payload: object): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function signature(value: string): string {
  return createHmac("sha256", WEB_TOKEN_SECRET).update(value).digest("base64url");
}

export function createLearnerWebToken(userId: number, testId?: string): string {
  const payload = encode({ userId, testId, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS });
  return `${payload}.${signature(payload)}`;
}

export async function createLearnerWebUrl(userId: number, testId?: string): Promise<string | undefined> {
  const configured = (await getConfig("web_app_url"))?.trim();
  const fallbackDomain = process.env["APP_URL"]?.trim() || process.env["REPLIT_DEV_DOMAIN"]?.trim() || process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
  const rawBase = configured || (fallbackDomain ? (fallbackDomain.startsWith("http") ? fallbackDomain : `https://${fallbackDomain}`) : "");
  if (!rawBase) return undefined;

  try {
    const parsed = new URL(rawBase.includes("://") ? rawBase : `https://${rawBase}`);
    parsed.search = "";
    parsed.hash = "";
    const pathname = parsed.pathname.replace(/\/+$/, "");
    parsed.pathname = pathname === "" || pathname === "/" ? "/app/" : `${pathname}/`;
    if (testId) parsed.searchParams.set("testId", testId);
    parsed.searchParams.set("token", createLearnerWebToken(userId, testId));
    return parsed.toString();
  } catch (error) {
    logger.warn({ error }, "Invalid learner web app URL configuration");
    return undefined;
  }
}

type LearnerToken = { userId: number; testId: string; exp: number };

function verifyLearnerToken(token: string): LearnerToken | null {
  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature) return null;
  const expected = signature(payload);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(providedSignature);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as LearnerToken;
    if (!Number.isInteger(parsed.userId) || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function getPremiumUser(userId: number) {
  const [user] = await db.select({
    userId: usersTable.userId,
    fullName: usersTable.fullName,
    username: usersTable.username,
    tier: usersTable.tier,
    premiumExpiry: usersTable.premiumExpiry,
  }).from(usersTable).where(eq(usersTable.userId, userId)).limit(1);
  if (!user || user.tier !== "Premium" || !user.premiumExpiry || user.premiumExpiry <= new Date()) return null;
  return user;
}

function normalizedQuestions(raw: unknown): Array<QuestionData & { section: string; imageUrl: string | null }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const question = item as Partial<QuestionData> & { section?: string; imageUrl?: string | null };
    return {
      id: String(question.id ?? `q${index + 1}`),
      question: String(question.question ?? ""),
      options: Array.isArray(question.options) ? question.options.map(String) : [],
      correctOptionIndex: Number(question.correctOptionIndex ?? 0),
      explanation: String(question.explanation ?? ""),
      language: question.language,
      section: String(question.section ?? "General"),
      imageUrl: question.imageUrl ?? null,
    };
  });
}

router.get("/web-session", async (req: Request, res: Response) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const parsed = verifyLearnerToken(token);
  if (!parsed) return res.status(401).json({ error: "Invalid or expired web session" });
  const user = await getPremiumUser(parsed.userId);
  if (!user) return res.status(401).json({ error: "An active Premium plan is required" });
  return res.json({ ...user, premiumExpiry: user.premiumExpiry?.toISOString() ?? null });
});

router.get("/test", async (req: Request, res: Response) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const testId = typeof req.query.testId === "string" ? req.query.testId : "";
  const parsed = verifyLearnerToken(token);
  if (!parsed || (parsed.testId && parsed.testId !== testId)) return res.status(401).json({ error: "Invalid or expired web session" });
  if (!testId) return res.status(400).json({ error: "Test ID is required" });
  const user = await getPremiumUser(parsed.userId);
  if (!user) return res.status(401).json({ error: "An active Premium plan is required" });
  const [test] = await db.select().from(testSeriesTable).where(and(eq(testSeriesTable.testId, testId), eq(testSeriesTable.isActive, true))).limit(1);
  if (!test) return res.status(404).json({ error: "Test not found" });
  const questions = normalizedQuestions(test.questionsData);
  return res.json({
    testId: test.testId,
    testName: test.testName,
    mainCategory: test.mainCategory,
    subCategory: test.subCategory,
    positiveMarking: test.positiveMarking,
    negativeMarking: test.negativeMarking,
    timerSeconds: test.timerSeconds,
    webTimerSeconds: test.webTimerSeconds,
    questionCount: questions.length,
    sections: [...new Set(questions.map((question) => question.section))],
    questions: questions.map(({ id, question, options, section, imageUrl }) => ({ id, question, options, section, imageUrl })),
  });
});

router.post("/attempts", async (req: Request, res: Response) => {
  const body = req.body as {
    token?: string;
    testId?: string;
    answers?: Record<string, number>;
    markedForReview?: string[];
    timeSpentSeconds?: number;
  };
  const parsed = typeof body.token === "string" ? verifyLearnerToken(body.token) : null;
  if (!parsed || (parsed.testId && parsed.testId !== body.testId)) return res.status(401).json({ error: "Invalid or expired web session" });
  if (!body.testId) return res.status(400).json({ error: "Test ID is required" });
  const reqTestId = body.testId;
  const user = await getPremiumUser(parsed.userId);
  if (!user) return res.status(401).json({ error: "An active Premium plan is required" });
  const [test] = await db.select().from(testSeriesTable).where(eq(testSeriesTable.testId, reqTestId)).limit(1);
  if (!test) return res.status(404).json({ error: "Test not found" });
  const questions = normalizedQuestions(test.questionsData);
  const answers = body.answers ?? {};
  const answerArray = questions.map((question) => Number.isInteger(answers[question.id]) ? answers[question.id]! : null);
  const attempted = answerArray.filter((answer): answer is number => answer !== null).length;
  const correct = Number(answerArray.reduce<number>((total, answer, index) => total + (answer !== null && answer === questions[index]?.correctOptionIndex ? 1 : 0), 0) ?? 0);
  const incorrect = attempted - correct;
  const skipped = questions.length - attempted;
  const score = correct * test.positiveMarking - incorrect * test.negativeMarking;
  const maxScore = questions.length * test.positiveMarking;
  const accuracy = attempted ? (correct / attempted) * 100 : 0;
  const sectionNames = [...new Set(questions.map((question) => question.section))];
  const sections = sectionNames.map((name) => {
    const indexes = questions.map((question, index) => question.section === name ? index : -1).filter((index) => index >= 0);
    const sectionAnswers = indexes.map((index) => answerArray[index]);
    const sectionAttempted = sectionAnswers.filter((answer): answer is number => answer !== null).length;
    const sectionCorrect = Number(sectionAnswers.reduce<number>((total, answer, index) => total + (answer !== null && answer === questions[indexes[index]]?.correctOptionIndex ? 1 : 0), 0) ?? 0);
    const sectionIncorrect = sectionAttempted - sectionCorrect;
    const sectionSkipped = sectionAnswers.length - sectionAttempted;
    return {
      name,
      attempted: sectionAttempted,
      correct: sectionCorrect,
      incorrect: sectionIncorrect,
      skipped: sectionSkipped,
      score: sectionCorrect * test.positiveMarking - sectionIncorrect * test.negativeMarking,
      percentage: sectionAttempted ? Number(((sectionCorrect / sectionAttempted) * 100).toFixed(1)) : 0,
    };
  });
  const review = questions.map((question, index) => {
    const selectedOption = answerArray[index] ?? null;
    return {
      id: question.id,
      question: question.question,
      options: question.options,
      section: question.section,
      imageUrl: question.imageUrl ?? null,
      selectedOption,
      correctOptionIndex: question.correctOptionIndex,
      explanation: question.explanation || "No detailed explanation has been added for this question yet.",
      status: selectedOption === null ? "skipped" : selectedOption === question.correctOptionIndex ? "correct" : "incorrect",
    };
  });
  const orderedSections = [...sections].sort((a, b) => b.percentage - a.percentage);
  const strengths = orderedSections.filter((section) => section.attempted > 0 && section.percentage >= 70).slice(0, 3).map((section) => section.name);
  const focusAreas = orderedSections.filter((section) => section.attempted > 0 && section.percentage < 60).slice(0, 3).map((section) => section.name);
  const recommendation = focusAreas.length
    ? `Revise ${focusAreas.join(", ")} first, then retake this paper with a tighter skip strategy.`
    : "Your fundamentals look steady. Review the marked questions and take the next paper under the same time pressure.";
  const [history] = await db.insert(userHistoryTable).values({
    userId: parsed.userId,
    testId: reqTestId,
    score,
    maxScore,
    correctCount: correct,
    wrongCount: incorrect,
    skippedCount: skipped,
    accuracy,
    userAnswers: answerArray,
  }).returning({ id: userHistoryTable.id });
  updateSession(parsed.userId, {
    solution: {
      testId: reqTestId,
      testName: test.testName,
      questions,
      userAnswers: answerArray,
      currentIndex: 0,
      attemptId: history.id,
    },
  });
  let telegramSynced = false;
  try {
    const telegramText =
      `Testbook+ result` +
      `${test.testName}` +
      `Score: ${score}/${maxScore}` +
      `Correct: ${correct}  Wrong: ${incorrect}  Skipped: ${skipped}` +
      `Accuracy: ${accuracy.toFixed(1)}%` +
      `Your detailed solutions and analysis are available in the web app.`;
    await getApi().sendMessage(parsed.userId, telegramText, { reply_markup: scorecardKeyboard(reqTestId) });
    telegramSynced = true;
  } catch (error) {
    logger.warn({ error, userId: parsed.userId, testId: reqTestId }, "Could not sync web result to Telegram");
  }
  return res.status(201).json({
    attemptId: history.id,
    testName: test.testName,
    totalQuestions: questions.length,
    attempted,
    correct,
    incorrect,
    skipped,
    score,
    maxScore,
    accuracy,
    rankPercentile: Math.min(99.9, Math.max(1, accuracy * 0.92)),
    timeSpentSeconds: Math.max(0, Number(body.timeSpentSeconds ?? 0)),
    markedForReview: Array.isArray(body.markedForReview) ? body.markedForReview : [],
    telegramSynced,
    sections,
    review,
    strengths,
    focusAreas,
    recommendation,
  });
});

router.post("/reports", async (req: Request, res: Response) => {
  const body = req.body as { token?: string; testId?: string; questionId?: string; reportText?: string };
  const parsed = typeof body.token === "string" ? verifyLearnerToken(body.token) : null;
  if (!parsed || (parsed.testId && parsed.testId !== body.testId)) return res.status(401).json({ error: "Invalid or expired web session" });
  if (!body.testId) return res.status(400).json({ error: "Test ID is required" });
  const reqTestId = body.testId;
  const user = await getPremiumUser(parsed.userId);
  if (!user) return res.status(401).json({ error: "An active Premium plan is required" });
  const reportText = String(body.reportText ?? "").trim();
  if (reportText.length < 3 || reportText.length > 1000) return res.status(400).json({ error: "Report must be between 3 and 1000 characters" });
  const [test] = await db.select({ questionsData: testSeriesTable.questionsData }).from(testSeriesTable).where(eq(testSeriesTable.testId, reqTestId)).limit(1);
  const questions = normalizedQuestions(test?.questionsData);
  const questionIndex = questions.findIndex((question) => question.id === body.questionId);
  if (!test || questionIndex < 0) return res.status(404).json({ error: "Question not found" });
  const question = questions[questionIndex]!;
  await db.insert(reportsTable).values({
    userId: parsed.userId,
    testId: reqTestId,
    questionIndex,
    questionText: question.question,
    userAnswer: null,
    correctAnswer: question.correctOptionIndex,
    reportText,
  });
  return res.status(201).json({ success: true, message: "Question report submitted to the faculty team." });
});

router.post("/ai-chat", async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    
    // Check Authorization header for learner_token
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    const parsed = verifyLearnerToken(token);
    
    if (!parsed) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const userId = Number(parsed.userId);
    // Dynamic import to avoid circular dependencies if any
    const { answerAgenticMessage } = await import("../bot/agentic.js");
    const reply = await answerAgenticMessage(userId, message);
    return res.json({ reply });
  } catch (err: any) {
    logger.error({ error: err }, "AI Chat failed");
    return res.status(500).json({ error: "Failed to process AI chat" });
  }
});

router.post("/create-test", async (req: Request, res: Response) => {
  try {
    const { topic, numQuestions } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic is required" });
    
    // Check Authorization header for learner_token
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    const parsed = verifyLearnerToken(token);
    
    if (!parsed) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const limit = Math.min(Number(numQuestions) || 5, 20);
    const userId = Number(parsed.userId);
    
    const { askGemini } = await import("../bot/ai.js");
    const { db } = await import("@workspace/db");
    const { userCustomSetsTable } = await import("@workspace/db");
    const crypto = await import("crypto");
    
    const prompt = `Generate a ${limit} question multiple choice test on the topic: ${topic}.
Return ONLY a valid JSON array of objects. Each object MUST have this exact structure:
{
  "question": "The question text",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": 0,
  "explanation": "Why this is correct"
}
Ensure correctAnswer is the integer index (0-3) of the correct option. Do NOT wrap in markdown \`\`\`json.`;

    const raw = await askGemini([
      { role: "system", content: "You are a test generator. Return exactly valid JSON." },
      { role: "user", content: prompt }
    ], { json: true, maxTokens: 4096 });
    
    const questions = JSON.parse(raw);
    const shareToken = crypto.randomBytes(8).toString("hex");
    
    const inserted = await db.insert(userCustomSetsTable).values({
      userId,
      title: `AI Custom: ${topic}`,
      questionCount: questions.length,
      questionsData: questions,
      status: "ready",
      shareToken,
      sourceFileName: "AI Generated"
    }).returning();
    
    return res.json({ success: true, test: inserted[0] });
  } catch (err: any) {
    logger.error({ error: err }, "Create test failed");
    return res.status(500).json({ error: "Failed to create test" });
  }
});

router.post("/ai-info", async (req: Request, res: Response) => {
  const body = req.body as { token?: string; testId?: string; questionId?: string };
  const parsed = typeof body.token === "string" ? verifyLearnerToken(body.token) : null;
  if (!parsed || (parsed.testId && parsed.testId !== body.testId)) return res.status(401).json({ error: "Invalid or expired web session" });
  if (!body.testId) return res.status(400).json({ error: "Test ID is required" });
  const reqTestId = body.testId;
  const user = await getPremiumUser(parsed.userId);
  if (!user) return res.status(401).json({ error: "An active Premium plan is required" });
  const [test] = await db.select().from(testSeriesTable).where(eq(testSeriesTable.testId, reqTestId)).limit(1);
  const question = normalizedQuestions(test?.questionsData).find((item) => item.id === body.questionId);
  if (!test || !question) return res.status(404).json({ error: "Question not found" });
  try {
    const answer = await askGroq([
      { role: "system", content: `${BOT_HELP_CONTEXT}You are a concise exam tutor. Use plain text, no markdown symbols.` },
      { role: "user", content: `Test: ${test.testName}Question: ${question.question}Options: ${question.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join(" | ")}Correct answer: ${question.options[question.correctOptionIndex]}Existing explanation: ${question.explanation || "None"}Explain the answer in 3 short paragraphs and add one exam tip. Keep it under 180 words.` },
    ], { maxTokens: 700 });
    return res.json({ questionId: question.id, answer });
  } catch (error) {
    logger.warn({ error, testId: reqTestId, questionId: question.id }, "Learner AI info failed");
    return res.status(503).json({ error: "AI tutor is temporarily unavailable" });
  }
});


router.get("/profile", async (req: Request, res: Response) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const parsed = verifyLearnerToken(token);
  if (!parsed) return res.status(401).json({ error: "Invalid session" });
  
  const [user] = await db.select({
    userId: usersTable.userId,
    fullName: usersTable.fullName,
    username: usersTable.username,
    tier: usersTable.tier,
    premiumExpiry: usersTable.premiumExpiry,
    referralCount: usersTable.referralCount,
    totalTestsTaken: usersTable.totalTestsTaken,
    targetExamSub: usersTable.targetExamSub,
  }).from(usersTable).where(eq(usersTable.userId, parsed.userId)).limit(1);

  if (!user) return res.status(401).json({ error: "User not found" });

  // Get user's promo code if any
  const { couponCodesTable } = await import("@workspace/db");
  const [coupon] = await db
    .select()
    .from(couponCodesTable)
    .where(eq(couponCodesTable.campaignName, `referral_${parsed.userId}`))
    .limit(1);

  return res.json({ 
    ...user, 
    premiumExpiry: user.premiumExpiry?.toISOString() ?? null,
    promoCode: coupon?.code ?? null,
    coins: user.referralCount ?? 0,
    testsTaken: user.totalTestsTaken ?? 0,
    examTarget: user.targetExamSub ?? "Not set",
    fullName: user.fullName
  });
});

router.post("/generate-promo", async (req: Request, res: Response) => {
  const body = req.body as { token?: string };
  const parsed = typeof body.token === "string" ? verifyLearnerToken(body.token) : null;
  if (!parsed) return res.status(401).json({ error: "Invalid session" });
  
  const user = await getPremiumUser(parsed.userId);
  if (!user) return res.status(401).json({ error: "Premium plan required" });

  const { couponCodesTable } = await import("@workspace/db");
  
  // Check if exists
  const [existing] = await db
    .select()
    .from(couponCodesTable)
    .where(eq(couponCodesTable.campaignName, `referral_${parsed.userId}`))
    .limit(1);
    
  if (existing) return res.json({ code: existing.code });

  const prefix = (user.fullName.split(' ')[0] || "VIP").toUpperCase().replace(/[^A-Z]/g, "");
  const code = `${prefix}${parsed.userId.toString().substring(0,4)}20`;

  await db.insert(couponCodesTable).values({
    code,
    discountPct: 20,
    isActive: true,
    campaignName: `referral_${parsed.userId}`,
    internalNote: "Generated by VIP referral system"
  });

  return res.json({ code });
});

router.post("/support-ticket", async (req: Request, res: Response) => {
  const body = req.body as { token?: string, subject?: string, message?: string };
  const parsed = typeof body.token === "string" ? verifyLearnerToken(body.token) : null;
  if (!parsed) return res.status(401).json({ error: "Invalid session" });
  
  const user = await getPremiumUser(parsed.userId);
  if (!user) return res.status(401).json({ error: "Premium plan required" });

  const subject = body.subject?.trim() || "General";
  const message = body.message?.trim() || "";
  
  if (message.length < 5) return res.status(400).json({ error: "Message too short" });

  // Send to admin group
  const groupsRaw = await getConfig("bot_groups");
  if (groupsRaw) {
    const groups = JSON.parse(groupsRaw);
    for (const g of groups) {
      await getApi().sendMessage(
        g.id,
        `🎫 <b>New Support Ticket</b>User: ${user.fullName.replace(/</g, "&lt;").replace(/>/g, "&gt;")} (${parsed.userId})Subject: <b>${subject}</b>Message:<i>${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</i>`,
        { parse_mode: "HTML" }
      ).catch(() => {});
    }
  }

  // Send acknowledgment to user
  await getApi().sendMessage(
    parsed.userId,
    `🎫 <b>Support Ticket Created</b>Your message regarding <b>${subject}</b> has been sent to our AI & Admin team. We will resolve it shortly.`,
    { parse_mode: "HTML" }
  ).catch(() => {});

  return res.json({ success: true });
});


router.post("/login-with-key", async (req: Request, res: Response) => {
  const body = req.body as { key?: string };
  if (!body.key || typeof body.key !== "string") {
    return res.status(400).json({ error: "Key is required" });
  }

  const { usersTable } = await import("@workspace/db");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.webLoginKey, body.key.trim().toUpperCase())).limit(1);

  if (!user) {
    return res.status(401).json({ error: "Invalid login key" });
  }

  // Issue token
  const token = createLearnerWebToken(user.userId, undefined);
  return res.json({ token, user: { fullName: user.fullName, userId: user.userId, tier: user.tier } });
});

router.post("/tests", async (req: Request, res: Response) => {
  const body = req.body as { token?: string };
  const parsed = typeof body.token === "string" ? verifyLearnerToken(body.token) : null;
  if (!parsed) return res.status(401).json({ error: "Invalid session" });
  
  const { testSeriesTable } = await import("@workspace/db");
  const tests = await db.select().from(testSeriesTable).where(eq(testSeriesTable.isActive, true));
  
  return res.json({ tests: tests.map(t => ({
    testId: t.testId,
    testName: t.testName,
    mainCategory: t.mainCategory,
    subCategory: t.subCategory,
    questionCount: t.questionsData ? (typeof t.questionsData === 'string' ? JSON.parse(t.questionsData).length : (t.questionsData as any[]).length) : 0,
    timerSeconds: t.timerSeconds,
    type: t.type
  }))});
});

router.post("/history", async (req: Request, res: Response) => {
  const body = req.body as { token?: string };
  const parsed = typeof body.token === "string" ? verifyLearnerToken(body.token) : null;
  if (!parsed) return res.status(401).json({ error: "Invalid session" });
  
  const { userHistoryTable } = await import("@workspace/db");
  const history = await db.select().from(userHistoryTable).where(eq(userHistoryTable.userId, parsed.userId)).orderBy(desc(userHistoryTable.completedAt));
  
  return res.json({ history });
});
export default router;
