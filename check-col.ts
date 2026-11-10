import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function run() {
  try {
    const res = await db.execute(sql`SELECT web_login_key FROM users LIMIT 1`);
    console.log("Success:", res);
  } catch(e) {
    console.log("ERROR:", e);
  }
}
run().then(() => process.exit(0));
