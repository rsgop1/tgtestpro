import { db } from "@workspace/db";
import { achievementsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getApi } from "../api-instance.js";
import { logger } from "../../lib/logger.js";
import { getConfig } from "./helpers.js";
import type { Bot } from "grammy";

export const ACHIEVEMENT_DEFS: Record<string, { title: string; emoji: string; description: string }> = {
  grandmaster:       { title: "Grandmaster",      emoji: "👑", description: "Completed 500 tests total" },
  god_of_accuracy:   { title: "God of Accuracy",  emoji: "🎯", description: "100% accuracy in a test with 50+ questions" },
  the_flash_prime:   { title: "The Flash Prime", emoji: "⚡", description: "50 consecutive correct answers" },
  speed_demon:       { title: "Speed Demon",       emoji: "🏎️", description: "Completed test in <20% time with >90% accuracy" },
  night_owl_legend:  { title: "Night Owl Legend", emoji: "🦇", description: "Completed 25 tests between 12 AM and 4 AM" },
  iron_brain:        { title: "Iron Brain",         emoji: "🧠", description: "Completed 100 tests total" },
};

function getTitleForUser(achievementTypes: string[]): string | null {
  const priority = ["grandmaster", "god_of_accuracy", "the_flash_prime", "speed_demon", "night_owl_legend", "iron_brain"];
  for (const t of priority) {
    if (achievementTypes.includes(t)) {
      return ACHIEVEMENT_DEFS[t]?.title ?? null;
    }
  }
  return null;
}

async function hasAchievement(userId: number, type: string): Promise<boolean> {
  const [row] = await db.select().from(achievementsTable)
    .where(and(eq(achievementsTable.userId, userId), eq(achievementsTable.achievementType, type)))
    .limit(1);
  return !!row;
}

async function awardAchievement(userId: number, type: string): Promise<boolean> {
  if (await hasAchievement(userId, type)) return false;
  await db.insert(achievementsTable).values({ userId, achievementType: type });
  return true;
}

export interface QuizResult {
  testId: string;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  score: number;
  prevScore?: number;
  consecutiveCorrect: number;
  totalTestsTaken: number;
  timeSpentSeconds?: number;
  totalTimeAllocated?: number;
}

export async function checkAndAwardAchievements(userId: number, result: QuizResult): Promise<string[]> {
  
  const api = getApi();
  const newAchievements: string[] = [];
  const total = result.correctCount + result.wrongCount + result.skippedCount;

  if (total >= 50 && result.wrongCount === 0 && result.skippedCount === 0) {
    if (await awardAchievement(userId, "god_of_accuracy")) newAchievements.push("god_of_accuracy");
  }

  if (result.consecutiveCorrect >= 50) {
    if (await awardAchievement(userId, "the_flash_prime")) newAchievements.push("the_flash_prime");
  }

  const hour = new Date().getHours();
  if (hour >= 0 && hour < 4) {
    const nightCount = await db.select().from(achievementsTable)
      .where(and(eq(achievementsTable.userId, userId), eq(achievementsTable.achievementType, "night_owl_tracker")));
    
    // Using night_owl_tracker as a counter, inserting duplicate rows to count
    await db.insert(achievementsTable).values({ userId, achievementType: "night_owl_tracker" });
    if (nightCount.length >= 24) { // 24 + 1 = 25
      if (await awardAchievement(userId, "night_owl_legend")) newAchievements.push("night_owl_legend");
    }
  }

  if (result.totalTestsTaken >= 500) {
    if (await awardAchievement(userId, "grandmaster")) newAchievements.push("grandmaster");
  } else if (result.totalTestsTaken >= 100) {
    if (await awardAchievement(userId, "iron_brain")) newAchievements.push("iron_brain");
  }

  if (result.timeSpentSeconds && result.totalTimeAllocated && result.totalTimeAllocated > 0) {
    const timeRatio = result.timeSpentSeconds / result.totalTimeAllocated;
    const accuracy = result.correctCount / total;
    if (timeRatio <= 0.20 && accuracy >= 0.90 && total >= 10) {
      if (await awardAchievement(userId, "speed_demon")) newAchievements.push("speed_demon");
    }
  }

  for (const type of newAchievements) {
    const def = ACHIEVEMENT_DEFS[type];
    if (!def) continue;
    try {
      await api.sendMessage(userId,
        `🏆 *Achievement Unlocked\\!*\n\n${def.emoji} *${escMd(def.title)}*\n_${escMd(def.description)}_\n\nCongratulations\\! This title will appear in configured groups\\.`,
        { parse_mode: "MarkdownV2" }
      );
    } catch (err) {
      logger.error({ err }, "Failed to send achievement notification");
    }

    await trySetGroupTitles(userId);
  }

  return newAchievements;
}

export async function trySetGroupTitles(userId: number): Promise<void> {
  try {
    const api = getApi();
    const allAchievements = await db.select().from(achievementsTable)
      .where(eq(achievementsTable.userId, userId));
    const types = allAchievements.map(a => a.achievementType);
    const title = getTitleForUser(types);
    if (!title) return;

    const groupsRaw = await getConfig("bot_groups");
    if (!groupsRaw) return;
    const groups: Array<{ id: number | string; name?: string }> = JSON.parse(groupsRaw);

    for (const group of groups) {
      try {
        await api.promoteChatMember(group.id as number, userId, {
          can_change_info: false,
          can_post_messages: false,
          can_edit_messages: false,
          can_delete_messages: false,
          can_manage_chat: true,
          can_restrict_members: false,
          can_pin_messages: false,
          can_promote_members: false,
        });
        await new Promise(r => setTimeout(r, 500));
        await api.setChatAdministratorCustomTitle(group.id as number, userId, title);
      } catch (err) {
        logger.warn({ err, groupId: group.id }, "Could not set group title");
      }
    }
  } catch (err) {
    logger.error({ err }, "trySetGroupTitles error");
  }
}

function escMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (c) => `\\${c}`);
}

export function registerAchievementHandlers(bot: Bot): void {
  bot.on("chat_member", async (ctx) => {
    try {
      const update = ctx.chatMember;
      const newStatus = update.new_chat_member.status;
      const userId = update.new_chat_member.user.id;

      if (newStatus !== "member" && newStatus !== "administrator") return;

      const groupsRaw = await getConfig("bot_groups");
      if (!groupsRaw) return;
      const groups: Array<{ id: number | string }> = JSON.parse(groupsRaw);
      const chatId = ctx.chat.id;
      const isConfigured = groups.some(g => Number(g.id) === chatId || g.id === String(chatId));
      if (!isConfigured) return;

      await trySetGroupTitles(userId);
    } catch (err) {
      logger.error({ err }, "chat_member achievement handler error");
    }
  });
}
