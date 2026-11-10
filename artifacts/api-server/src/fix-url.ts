import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function run() {
  const url = "https://ais-dev-ibc7kcx2yvl3ztkoy3pqfm-182066274461.asia-east1.run.app";
  
  await db.execute(sql`INSERT INTO global_config (key, value) VALUES ('web_app_url', ${url}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`);
  
  console.log("Updated web_app_url in DB to", url);
}

run().catch(console.error).then(() => process.exit(0));
