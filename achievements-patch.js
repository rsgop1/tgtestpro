const fs = require('fs');
const file = "artifacts/api-server/src/bot/handlers/achievements.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(/export const ACHIEVEMENT_DEFS[\s\S]*?};/, `export const ACHIEVEMENT_DEFS: Record<string, { title: string; emoji: string; description: string }> = {
  grandmaster:       { title: "👑 Grandmaster",      emoji: "👑", description: "Completed 500 tests total" },
  god_of_accuracy:   { title: "🎯 God of Accuracy",  emoji: "🎯", description: "100% accuracy in a test with 50+ questions" },
  the_flash_prime:   { title: "⚡ The Flash Prime", emoji: "⚡", description: "50 consecutive correct answers" },
  speed_demon:       { title: "🏎️ Speed Demon",       emoji: "🏎️", description: "Completed test in <20% time with >90% accuracy" },
  night_owl_legend:  { title: "🦇 Night Owl Legend", emoji: "🦇", description: "Completed 25 tests between 12 AM and 4 AM" },
  iron_brain:        { title: "🧠 Iron Brain",         emoji: "🧠", description: "Completed 100 tests total" },
};`);

content = content.replace(/const priority = \[.*?\];/, 'const priority = ["grandmaster", "god_of_accuracy", "the_flash_prime", "speed_demon", "night_owl_legend", "iron_brain"];');

content = content.replace(/export interface QuizResult[\s\S]*?export async function checkAndAwardAchievements\(userId: number, result: QuizResult\): Promise<string\[\]> {/, `export interface QuizResult {
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

export async function checkAndAwardAchievements(userId: number, result: QuizResult): Promise<string[]> {`);

const newLogic = `
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

  for (const type of newAchievements) {`;

content = content.replace(/const api = getApi\(\);[\s\S]*?for \(const type of newAchievements\) {/, newLogic);

// Fix manage chat perm issues. `can_invite_users` is sometimes not enough for standard group.
// The telegram API states `is_anonymous: false` is standard. Let's just use manage_chat to be safe.
content = content.replace(/can_invite_users: true,/g, "can_manage_chat: true,");

fs.writeFileSync(file, content);
