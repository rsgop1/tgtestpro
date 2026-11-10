import { db } from "@workspace/db";
import { usersTable, achievementsTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";
import { trySetGroupTitles } from "./bot/handlers/achievements.js";
import { Bot } from "grammy";
import { setApi } from "./bot/api-instance.js";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("No TELEGRAM_BOT_TOKEN");
  const bot = new Bot(token);
  setApi(bot.api);
  
  const targetUsername = "rsg_ankit";
  console.log(`Looking up user: ${targetUsername}`);
  
  const [user] = await db.select().from(usersTable).where(ilike(usersTable.username, targetUsername)).limit(1);
  if (!user) {
    console.log("User not found!");
    process.exit(1);
  }
  
  const userId = user.userId;
  console.log(`Found user! ID: ${userId}, Name: ${user.fullName}`);
  
  console.log("Invoking trySetGroupTitles...");
  await trySetGroupTitles(userId);
  console.log("Done!");
  process.exit(0);
}

main().catch(console.error);
