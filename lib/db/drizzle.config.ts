import { defineConfig } from "drizzle-kit";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER;
const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD;

if (process.env.DATABASE_URL && !sqlHost) {
  // Fallback to DATABASE_URL if Cloud SQL env vars are not set
  var dbCreds = { url: process.env.DATABASE_URL };
} else {
  if (!sqlHost || !sqlDbName || !user || !password) {
    throw new Error("Cloud SQL environment variables not fully set.");
  }
  var dbCreds = {
    host: sqlHost,
    user: user,
    password: password,
    database: sqlDbName,
    ssl: false,
  };
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: dbCreds,
});
