import { db, configTable } from "./artifacts/db/dist/index.js";
import { eq } from "drizzle-orm";

async function run() {
  const url = "https://ais-dev-ibc7kcx2yvl3ztkoy3pqfm-182066274461.asia-east1.run.app";
  
  const existing = await db.select().from(configTable).where(eq(configTable.key, "web_app_url"));
  if (existing.length > 0) {
    await db.update(configTable).set({ value: url }).where(eq(configTable.key, "web_app_url"));
  } else {
    await db.insert(configTable).values({ key: "web_app_url", value: url });
  }
  console.log("Updated web_app_url in DB to", url);
}

run().catch(console.error).then(() => process.exit(0));
