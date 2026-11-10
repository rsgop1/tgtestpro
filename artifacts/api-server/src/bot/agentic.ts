import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { testSeriesTable, userHistoryTable, usersTable } from "@workspace/db";
import { askGemini, BOT_AGENT_CONTEXT } from "./ai.js";
import { getConfig } from "./handlers/helpers.js";
import { getApi } from "./api-instance.js";
import { clearAgenticSession, getSession, updateSession } from "./session.js";
import { logger } from "../lib/logger.js";

type QuestionAnalysis = { question: string; topics: string[]; skills: string[]; difficulty: string; focus: string };
type SetAnalysis = { topics: string[]; skills: string[]; difficulty: string; focus: string; questions: QuestionAnalysis[] };
const setAnalysisCache = new Map<string, { analysis: SetAnalysis; updatedAt: number }>();
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
let analysisRunning = false;
let lastRunAt: number | null = null;
let lastCompletedAt: number | null = null;
let lastError: string | null = null;
let lastRunStats = { sets: 0, questions: 0 };

export function agenticRoomKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📊 Analyze my tests", "agentic_insights");
}

export function agenticRoomText(): string {
  return "🤖 AI Space\n\nYour personal study agent is ready.\n\nIt can analyse your completed tests, explain weak topics, solve exam doubts, and help with any Series TestPro problem.\n\nTap Analyse to get a detailed performance report, or send a message.";
}

export async function openAgenticWorkspace(ctx: any): Promise<void> {
  const currentMessageId = ctx.callbackQuery?.message?.message_id;
  const [user] = await db.select({ tier: usersTable.tier, premiumExpiry: usersTable.premiumExpiry })
    .from(usersTable).where(eq(usersTable.userId, ctx.from.id)).limit(1);
  const premium = user?.tier === "Premium" && !!user.premiumExpiry && user.premiumExpiry > new Date();
  if (!premium) {
    await ctx.reply("🔒 AI Space is available for active Premium users. Use /premium to unlock your personal study agent.");
    return;
  }
  updateSession(ctx.from.id, { agenticActive: true, agenticMessageIds: currentMessageId ? [currentMessageId] : [] });
  refreshAgenticIdle(ctx.from.id);
  try {
    await ctx.editMessageText(agenticRoomText(), { reply_markup: agenticRoomKeyboard() });
  } catch {
    const sent = await ctx.reply(agenticRoomText(), { reply_markup: agenticRoomKeyboard() });
    updateSession(ctx.from.id, { agenticMessageIds: [sent.message_id] });
  }
}

function refreshAgenticIdle(userId: number): void {
  const current = getSession(userId);
  if (current.agenticIdleTimer) clearTimeout(current.agenticIdleTimer);
  const timer = setTimeout(async () => {
    const session = getSession(userId);
    if (!session.agenticActive) return;
    await deleteTrackedAgenticMessages(userId);
    clearAgenticSession(userId);
    logger.info({ userId }, "Agentic AI session expired after idle timeout");
  }, IDLE_TIMEOUT_MS);
  updateSession(userId, { agenticIdleTimer: timer });
}

async function deleteTrackedAgenticMessages(userId: number, keepMessageId?: number): Promise<void> {
  const session = getSession(userId);
  const ids = session.agenticMessageIds ?? [];
  for (const id of ids) {
    if (id === keepMessageId) continue;
    try { await getApi().deleteMessage(userId, id); } catch {}
  }
  updateSession(userId, { agenticMessageIds: keepMessageId ? [keepMessageId] : [] });
}

export async function closeAgenticWorkspace(ctx: any, goHome: () => Promise<void>): Promise<void> {
  await deleteTrackedAgenticMessages(ctx.from.id, ctx.callbackQuery?.message?.message_id);
  clearAgenticSession(ctx.from.id);
  await goHome();
}

export async function clearAgenticChat(userId: number, keepMessageId?: number): Promise<void> {
  await deleteTrackedAgenticMessages(userId, keepMessageId);
  updateSession(userId, { agenticActive: true, agenticMessageIds: keepMessageId ? [keepMessageId] : [] });
}

export function registerAgenticHandlers(bot: Bot): void {
  bot.callbackQuery("agentic_open", async (ctx) => {
    await ctx.answerCallbackQuery();
    await openAgenticWorkspace(ctx);
  });

  bot.callbackQuery("agentic_back", async (ctx) => {
    await ctx.answerCallbackQuery();
    const { showHomeForUser } = await import("./handlers/navigation.js");
    await closeAgenticWorkspace(ctx, () => showHomeForUser(ctx));
  });

  bot.callbackQuery("agentic_clear", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Agentic chat cleared" });
    await clearAgenticChat(ctx.from.id, ctx.callbackQuery.message?.message_id);
    await ctx.editMessageText(agenticRoomText(), { reply_markup: agenticRoomKeyboard() });
  });

  bot.callbackQuery("agentic_insights", async (ctx) => {
    refreshAgenticIdle(ctx.from.id);
    await ctx.answerCallbackQuery({ text: "Building your insights…" });
    await sendAgenticToolResult(ctx, "Personal Insights", "Give me a concise personal dashboard: my weak areas, strong areas, recent trend, and the best next 3 actions.");
  });

  bot.on("message:text", async (ctx, next) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const session = getSession(userId);
    if (!session.agenticActive || text.startsWith("/")) return next();

    refreshAgenticIdle(userId);
    trackMessage(userId, ctx.message.message_id);
    const thinking = await ctx.reply("🧠 Agentic AI is thinking through your request…");
    trackMessage(userId, thinking.message_id);
    try {
      const answer = await answerAgenticMessage(userId, text);
      await ctx.api.editMessageText(ctx.chat.id, thinking.message_id, renderAgenticText(`🧠 Agentic AI\n\n${answer}`), {
        parse_mode: "HTML",
        reply_markup: agenticRoomKeyboard(),
      });
    } catch (error) {
      logger.error({ error, userId }, "Agentic AI response failed");
      await ctx.api.editMessageText(ctx.chat.id, thinking.message_id, "⚠️ I could not complete that request right now. Please try again.", {
        parse_mode: "HTML",
        reply_markup: agenticRoomKeyboard(),
      });
    }
  });
}

function trackMessage(userId: number, messageId: number): void {
  const session = getSession(userId);
  const ids = session.agenticMessageIds ?? [];
  if (!ids.includes(messageId)) updateSession(userId, { agenticMessageIds: [...ids, messageId] });
}

async function sendAgenticToolResult(ctx: any, title: string, request: string): Promise<void> {
  refreshAgenticIdle(ctx.from.id);
  const thinking = await ctx.reply(`🧠 ${title} is being prepared…`);
  trackMessage(ctx.from.id, thinking.message_id);
  try {
    const answer = await answerAgenticMessage(ctx.from.id, request);
    await ctx.api.editMessageText(ctx.chat.id, thinking.message_id, renderAgenticText(`🧠 ${title}\n\n${answer}`), {
      parse_mode: "HTML",
      reply_markup: agenticRoomKeyboard(),
    });
  } catch (error) {
    logger.error({ error }, "Agentic tool failed");
    await ctx.api.editMessageText(ctx.chat.id, thinking.message_id, "⚠️ Agentic analysis is temporarily unavailable.", {
      parse_mode: "HTML",
      reply_markup: agenticRoomKeyboard(),
    });
  }
}

function renderAgenticText(value: string): string {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/gs, "<b>$1</b>")
    .replace(/__(.+?)__/gs, "<b>$1</b>")
    .replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, "<i>$1</i>")
    .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "<i>$1</i>");
}

async function getUserInsights(userId: number): Promise<string> {
  const [user] = await db.select({
    fullName: usersTable.fullName, tier: usersTable.tier, targetExamSub: usersTable.targetExamSub,
  }).from(usersTable).where(eq(usersTable.userId, userId)).limit(1);
  const attempts = await db.select({
    testId: userHistoryTable.testId, score: userHistoryTable.score, accuracy: userHistoryTable.accuracy,
    correctCount: userHistoryTable.correctCount, wrongCount: userHistoryTable.wrongCount,
    userAnswers: userHistoryTable.userAnswers,
  }).from(userHistoryTable).where(eq(userHistoryTable.userId, userId)).orderBy(desc(userHistoryTable.completedAt)).limit(20);

  const testRows = await db.select({
    testId: testSeriesTable.testId,
    testName: testSeriesTable.testName,
    questionsData: testSeriesTable.questionsData,
  }).from(testSeriesTable);
  const testMap = new Map(testRows.map((t) => [t.testId, t]));
  const testGroups = new Map<string, typeof attempts>();
  for (const attempt of attempts) {
    const group = testGroups.get(attempt.testId) ?? [];
    group.push(attempt);
    testGroups.set(attempt.testId, group);
  }
  const allAttempts = testGroups.size
    ? await db.select({
      testId: userHistoryTable.testId,
      score: userHistoryTable.score,
      userAnswers: userHistoryTable.userAnswers,
      correctCount: userHistoryTable.correctCount,
      wrongCount: userHistoryTable.wrongCount,
      accuracy: userHistoryTable.accuracy,
    }).from(userHistoryTable).where(inArray(userHistoryTable.testId, [...testGroups.keys()]))
    : [];
  const allGroups = new Map<string, typeof allAttempts>();
  for (const attempt of allAttempts) {
    const group = allGroups.get(attempt.testId) ?? [];
    group.push(attempt);
    allGroups.set(attempt.testId, group);
  }
  const performance = attempts.length
    ? [...testGroups.entries()].slice(0, 12).map(([testId, rows]) => {
      const title = testMap.get(testId)?.testName ?? testId;
      const avg = rows.reduce((sum, row) => sum + row.accuracy, 0) / rows.length;
      const population = allGroups.get(testId) ?? [];
      const topper = population.reduce((max, row) => Math.max(max, row.score), -Infinity);
      const test = testMap.get(testId);
      const qCount = Array.isArray(test?.questionsData) ? test.questionsData.length : 0;
       const questionData = Array.isArray(test?.questionsData) ? test.questionsData as any[] : [];
      const questionStats = Array.from({ length: qCount }, (_, index) => {
        const valid = rows.filter((row) => Array.isArray(row.userAnswers) && typeof (row.userAnswers as unknown[])[index] === "number");
         const correct = valid.filter((row) => (row.userAnswers as unknown[])[index] === questionData[index]?.correctOptionIndex).length;
        return valid.length ? correct / valid.length : null;
      }).filter((v): v is number => v !== null);
      const weakQuestionAccuracy = questionStats.length ? Math.min(...questionStats) * 100 : null;
       const mistakes = rows.flatMap((row) => {
         const answers = Array.isArray(row.userAnswers) ? row.userAnswers : [];
         return questionData.flatMap((question, index) => {
           const answerIndex = answers[index];
           if (typeof answerIndex !== "number" || answerIndex === question.correctOptionIndex) return [];
           return [`Question: ${String(question.question).slice(0, 260)} | User answer: ${question.options?.[answerIndex] ?? "unknown"} | Correct answer: ${question.options?.[question.correctOptionIndex] ?? "unknown"} | Explanation: ${String(question.explanation ?? "").slice(0, 260)}`];
         });
       }).slice(0, 40);
      const sorted = [...population].sort((a, b) => b.score - a.score);
      const band = Math.max(1, Math.ceil(sorted.length * 0.27));
      const accuracyFor = (group: typeof rows) => {
        const answered = group.reduce((sum, row) => sum + row.correctCount + row.wrongCount, 0);
        return answered ? group.reduce((sum, row) => sum + row.correctCount, 0) / answered : 0;
      };
      const discrimination = sorted.length >= 4 ? (accuracyFor(sorted.slice(0, band)) - accuracyFor(sorted.slice(-band))) * 100 : null;
      const indexed = setAnalysisCache.get(testId)?.analysis;
      const topics = indexed?.topics?.length ? indexed.topics.join(", ") : "not indexed yet";
       return `Title: ${title}; attempts=${rows.length}; average accuracy=${avg.toFixed(1)}%; best personal score=${rows.reduce((max, row) => Math.max(max, row.score), -Infinity)}; topper score=${topper === -Infinity ? "unknown" : topper}; weak topics from question intelligence=${topics}; weakest question accuracy=${weakQuestionAccuracy === null ? "not enough data" : `${weakQuestionAccuracy.toFixed(1)}%`}; discrimination index=${discrimination === null ? "not reliable yet" : discrimination.toFixed(1)}\nMistakes to coach:\n${mistakes.length ? mistakes.join("\n") : "No recorded mistakes in the available attempts."}`;
    }).join("\n")
    : "No completed attempts yet";
  const weak = attempts.length
    ? attempts.filter((a) => a.accuracy < 60).map((a) => testMap.get(a.testId)?.testName ?? "Untitled test").slice(0, 5).join(", ")
    : "Not enough data yet";
  const strong = attempts.length
    ? attempts.filter((a) => a.accuracy >= 80).map((a) => testMap.get(a.testId)?.testName ?? "Untitled test").slice(0, 5).join(", ")
    : "Not enough data yet";
  const last3 = [...allAttempts].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime()).slice(0, 3).map(a => {
    return `${testMap.get(a.testId)?.testName ?? a.testId} (Score: ${a.score}, Accuracy: ${a.accuracy}%)`;
  }).join(", ");

  const totalPercentile = attempts.length > 0 ? (attempts.reduce((sum, row) => sum + (row.percentile || 0), 0) / attempts.length).toFixed(1) : "N/A";

  return `Student: ${user?.fullName ?? "Student"} | Plan: ${user?.tier ?? "Free"} | Target: ${user?.targetExamSub ?? "Not set"}
Average Percentile: ${totalPercentile}
Last 3 Tests: ${last3 || "None"}
Completed test analysis (use titles, not IDs):
${performance}
Likely weak sets: ${weak}
Strong sets: ${strong}`;
}

export async function answerAgenticMessage(userId: number, text: string): Promise<string> {
  const insights = await getUserInsights(userId);
  const testTitles = await db.select({ testId: testSeriesTable.testId, testName: testSeriesTable.testName })
    .from(testSeriesTable);
  const titleMap = new Map(testTitles.map((test) => [test.testId, test.testName]));
  const cached = [...setAnalysisCache.entries()].slice(0, 12)
    .map(([testId, value]) => {
      const questionDetails = value.analysis.questions.map((question, index) =>
        `Q${index + 1} "${question.question}": topics=${question.topics.join(", ") || "unknown"}; skills=${question.skills.join(", ") || "unknown"}; difficulty=${question.difficulty}; focus=${question.focus}`
      ).join("\n");
      return `Test title: ${titleMap.get(testId) ?? "Untitled test"}; topics=${value.analysis.topics.join(",")}; focus=${value.analysis.focus}\n${questionDetails}`;
    }).join("\n");
  try {
    return await askGemini([
        { role: "system", content: `${BOT_AGENT_CONTEXT}
You are the always-on Agentic AI strategist inside Series TestPro. You can act as a tutor, performance analyst, study planner, practice-set designer, revision coach, and exam accountability partner.
Use the student's real context below. Be personal and actionable. If asked to do work, do it directly in the response. Never claim an action happened if it did not. Keep responses under 350 words, plain text, readable in Telegram.
Never show internal test IDs to the user. Use test titles. Report average accuracy, weak topics, strong topics, topper score, and discrimination index only when available in the context; otherwise say that data is insufficient.
You have access to question-level intelligence and the student's answer arrays. When a question was answered incorrectly, identify the question by its text/short title, explain the likely mistake, and recommend a correction. Never reveal an internal question ID or test ID.
Student context:
${insights}
Background question intelligence:
${cached || "Still building the question intelligence index."}` },
      { role: "user", content: text.slice(0, 5000) },
    ], { maxTokens: 8192, temperature: 0.4 });
  } catch (error) {
    logger.warn({ error, userId }, "Direct AI call failed for agentic message, returning structured summary");
    return `🎯 Personal Strategy & Insights\n\n${insights}\n\n💡 Next Steps:\n1. Focus on practicing questions from your weak sections in /test_series.\n2. Review your incorrect answers in /notebook.\n3. Take 1 full-length timed mock test daily to build speed and accuracy.`;
  }
}

export async function agenticInsights(userId: number): Promise<string> {
  return answerAgenticMessage(userId, "Give me a concise personal dashboard: my weak areas, strong areas, recent trend, and the best next 3 actions.");
}

async function analyzeTestSet(test: { testId: string; testName: string; questionsData: unknown }): Promise<void> {
  const questions = Array.isArray(test.questionsData) ? test.questionsData : [];
  if (!questions.length) return;
  const prompt = questions.map((q: any, i) => `Q${i + 1}: ${q.question}\nOptions: ${(q.options ?? []).join(" | ")}\nExplanation: ${q.explanation ?? ""}`).join("\n\n");
  
  const rawConfig = await getConfig("subjects");
  const subjectsMap = rawConfig ? JSON.parse(rawConfig) : { 
    SSC: ["CGL", "CHSL", "Stenographer"],
    Railway: ["NTPC"],
    Banking: ["IBPS PO"],
    Bihar: ["BPSC Pre"]
  };
  const availableTopics = Object.values(subjectsMap).flat().concat(Object.keys(subjectsMap));

  let parsed: Partial<SetAnalysis> | null = null;

  try {
    const raw = await askGemini([
      { role: "system", content: `Extract exam intelligence for the complete question set. Return JSON with:
topics (array max 8), skills (array max 8), difficulty (easy/medium/hard), focus (one sentence),
questions (one object for EVERY input question, in the same order, with question (short label), topics (array max 3), skills (array max 3), difficulty, focus).
Do not solve questions and do not omit any question.
CRITICAL: ONLY tag topics from this allowed list (if none perfectly fit, pick the closest one or leave empty): ${availableTopics.join(", ")}.` },
      { role: "user", content: `Test: ${test.testName}\n${prompt}` },
    ], { json: true, maxTokens: 8192 });
    parsed = JSON.parse(raw) as Partial<SetAnalysis>;
  } catch (apiErr) {
    logger.debug({ testId: test.testId, err: apiErr }, "AI API call unavailable for test analysis, generating heuristic tags");
    
    // Heuristic analysis based on test name and question keywords
    const matchedTopics = availableTopics.filter(t => 
      test.testName.toLowerCase().includes(t.toLowerCase()) || 
      prompt.toLowerCase().includes(t.toLowerCase())
    );
    const assignedTopics = matchedTopics.length ? matchedTopics.slice(0, 5) : [availableTopics[0] || "General Practice"];
    
    parsed = {
      topics: assignedTopics,
      skills: ["Concept Knowledge", "Problem Solving", "Time Management"],
      difficulty: "medium",
      focus: `${test.testName} standard exam preparation`,
      questions: questions.map((q: any) => ({
        question: String(q.question ?? "").slice(0, 60),
        topics: assignedTopics.slice(0, 2),
        skills: ["Subject Knowledge", "Accuracy"],
        difficulty: "medium",
        focus: String(q.question ?? "").slice(0, 40),
      })),
    };
  }

  const questionInsights = Array.isArray(parsed?.questions) ? parsed.questions : [];
  
  // Also update DB with the AI analysis tags
  const updatedQuestionsData = questions.map((q: any, i) => {
    const aiInsight = questionInsights[i];
    if (aiInsight) {
      return { ...q, topics: aiInsight.topics || [] };
    }
    return q;
  });

  await db.update(testSeriesTable)
    .set({ 
      questionsData: updatedQuestionsData, 
      isAiAnalyzed: true 
    })
    .where(eq(testSeriesTable.testId, test.testId));

  setAnalysisCache.set(test.testId, {
    analysis: {
      topics: Array.isArray(parsed?.topics) ? parsed.topics.slice(0, 8).map(String) : [],
      skills: Array.isArray(parsed?.skills) ? parsed.skills.slice(0, 8).map(String) : [],
      difficulty: String(parsed?.difficulty ?? "medium"),
      focus: String(parsed?.focus ?? "Mixed exam practice"),
      questions: questionInsights.map((item) => ({
        question: String(item.question ?? ""),
        topics: Array.isArray(item.topics) ? item.topics.slice(0, 3).map(String) : [],
        skills: Array.isArray(item.skills) ? item.skills.slice(0, 3).map(String) : [],
        difficulty: String(item.difficulty ?? "medium"),
        focus: String(item.focus ?? ""),
      })),
    },
    updatedAt: Date.now(),
  });
}

export async function runAgenticAnalysis(): Promise<void> {
  if (analysisRunning) return;
  analysisRunning = true;
  lastRunAt = Date.now();
  lastError = null;
  try {
    const tests = await db.select({ testId: testSeriesTable.testId, testName: testSeriesTable.testName, questionsData: testSeriesTable.questionsData })
      .from(testSeriesTable).where(and(eq(testSeriesTable.isActive, true), eq(testSeriesTable.isAiAnalyzed, false)));
    let analyzedSets = 0;
    let analyzedQuestions = 0;
    for (const test of tests) {
      try {
        await analyzeTestSet(test);
        analyzedSets++;
        analyzedQuestions += Array.isArray(test.questionsData) ? test.questionsData.length : 0;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        logger.warn({ error, testId: test.testId }, "Agentic set analysis failed");
      }
    }
    lastRunStats = { sets: analyzedSets, questions: analyzedQuestions };
    lastCompletedAt = Date.now();
  } finally {
    analysisRunning = false;
  }
}

export function getAgenticAnalysisStatus() {
  const sets = [...setAnalysisCache.entries()].map(([testId, item]) => ({
    testId,
    updatedAt: new Date(item.updatedAt).toISOString(),
    topics: item.analysis.topics,
    skills: item.analysis.skills,
    difficulty: item.analysis.difficulty,
    focus: item.analysis.focus,
    questionCount: item.analysis.questions.length,
    questions: item.analysis.questions,
  }));
  return {
    running: analysisRunning,
    lastRunAt: lastRunAt ? new Date(lastRunAt).toISOString() : null,
    lastCompletedAt: lastCompletedAt ? new Date(lastCompletedAt).toISOString() : null,
    lastError,
    lastRunStats,
    analyzedSets: sets.length,
    analyzedQuestions: sets.reduce((sum, set) => sum + set.questionCount, 0),
    sets,
  };
}

export function startAgenticAnalysisScheduler(): void {
  logger.info("Agentic AI 24/7 analysis scheduler started");
  void runAgenticAnalysis()
    .then(() => logger.info("Agentic AI initial question analysis completed"))
    .catch((error) => logger.warn({ error }, "Initial agentic analysis failed"));
  setInterval(() => void runAgenticAnalysis()
    .then(() => logger.info("Agentic AI question analysis cycle completed"))
    .catch((error) => logger.warn({ error }, "Agentic analysis cycle failed")), 15 * 60 * 1000);
}

export { deleteTrackedAgenticMessages };