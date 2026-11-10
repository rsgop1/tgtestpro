import { Bot } from "grammy";
import { setApi } from "./api-instance.js";
import { registerStartHandlers } from "./handlers/start.js";
import { registerQuizHandlers } from "./handlers/quiz.js";
import { registerCommandHandlers } from "./handlers/commands.js";
import { registerPaymentHandlers, registerAdminPaymentHandlers } from "./handlers/payment.js";
import { registerLeaderboardHandlers, updateChannelLeaderboard } from "./handlers/leaderboard.js";
import { registerStatsHandlers } from "./handlers/stats.js";
import { registerChallengeHandlers, setBotUsername } from "./handlers/challenge.js";
import { registerAchievementHandlers } from "./handlers/achievements.js";
import { registerAnonDoubtHandlers } from "./handlers/anon-doubt.js";
import { registerLiveTestHandlers, startLiveTestScheduler } from "./handlers/live-test.js";
import { registerGroupQuizHandlers } from "./handlers/group-quiz.js";
import { registerCustomTestHandlers } from "./handlers/custom-test.js";
import { registerSupportHandlers } from "./handlers/support.js";
import { registerVipHandlers, startVipAccessScheduler } from "./handlers/vip.js";
import { registerNavigationHandlers } from "./handlers/navigation.js";
import { startAgenticAnalysisScheduler } from "./agentic.js";
import { registerDisabledAiHandlers } from "./handlers/ai-disabled.js";
import { registerAgenticHandlers } from "./agentic.js";
import { logger } from "../lib/logger.js";
import { emitTelemetry } from "../lib/telemetry.js";

let bot: any;
if (!process.env["TELEGRAM_BOT_TOKEN"]) {
  console.warn("[AI Studio] TELEGRAM_BOT_TOKEN is not set. Telegram bot will not function.");
  const noop = async () => {};
  const mockApi = new Proxy({}, { get: () => noop });
  bot = new Proxy({}, {
    get: (target, prop) => {
      if (prop === 'api') return mockApi;
      if (prop === 'catch') return () => {};
      if (prop === 'start') return (opts) => {
        if (opts && opts.onStart) opts.onStart({ username: 'mock_bot' });
        return Promise.resolve();
      };
      if (prop === 'callbackQuery') return () => {};
      return () => bot;
    }
  });
} else {
  bot = new Bot(process.env["TELEGRAM_BOT_TOKEN"]);
}
export { bot };

setApi(bot.api);

registerDisabledAiHandlers(bot);
registerStartHandlers(bot);
registerQuizHandlers(bot);
registerCommandHandlers(bot);
registerPaymentHandlers(bot);
registerAdminPaymentHandlers(bot);
registerLeaderboardHandlers(bot);
registerStatsHandlers(bot);
registerChallengeHandlers(bot);
registerAchievementHandlers(bot);
registerAnonDoubtHandlers(bot);
registerLiveTestHandlers(bot);
registerGroupQuizHandlers(bot);
registerCustomTestHandlers(bot);
registerSupportHandlers(bot);
registerVipHandlers(bot);
registerNavigationHandlers(bot);
registerAgenticHandlers(bot);

bot.callbackQuery("ad_noop", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "⏳ Please wait for the timer...", show_alert: false });
});

bot.catch((err) => {
  logger.error({ err: err.error, ctx: err.ctx?.update }, "Grammy unhandled error");
});

export function startBot(): void {
  bot.start({
    onStart: (info) => {
      logger.info({ username: info.username }, "Telegram bot started");
      setBotUsername(info.username);
      bot.api.setMyCommands([
        { command: "start", description: "Home and welcome" },
        { command: "test_series", description: "Browse mock tests" },
        { command: "dashboard", description: "View your progress dashboard" },
        { command: "profile", description: "View profile and Premium days" },
        { command: "createtest", description: "Create a test from your PDF" },
        { command: "mysets", description: "View your custom test sets" },
        { command: "stats", description: "View performance stats" },
        { command: "support", description: "Contact support" },
         { command: "vip", description: "Open your VIP group access" },
         { command: "menu", description: "Open the inline Study Hub" },
      ]).catch((error) => logger.warn({ error }, "Could not publish bot command menu"));
      emitTelemetry(`Bot started: @${info.username}`);

      setInterval(async () => {
        await updateChannelLeaderboard();
      }, 5 * 60 * 1000);

      startLiveTestScheduler();
      startVipAccessScheduler();
      startAgenticAnalysisScheduler();
    },
    allowed_updates: ["message", "callback_query", "poll_answer", "chat_member", "pre_checkout_query"],
  }).catch((err) => {
    logger.error({ err }, "Bot crashed");
  });
}
