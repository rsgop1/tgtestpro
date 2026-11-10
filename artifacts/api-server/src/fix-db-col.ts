import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function run() {
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN web_login_key TEXT UNIQUE;`);
    console.log("Added column");
  } catch(e) {
    console.log(e.message);
  }
}
run().then(() => process.exit(0));
