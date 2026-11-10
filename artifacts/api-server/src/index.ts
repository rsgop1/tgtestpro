import app from "./app.js";
import { logger } from "./lib/logger.js";
import { startBot } from "./bot/index.js";

const port = 3000;

app.listen(port, "0.0.0.0", async (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening on 0.0.0.0");
  try {
    const { pool } = await import("@workspace/db");
    if (pool?.query) {
      await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS utr TEXT;");
      logger.info("Database migration: verified payments.utr column exists");
    }
  } catch (migErr) {
    logger.warn({ migErr }, "Could not run automated column migration");
  }
  startBot();
});
