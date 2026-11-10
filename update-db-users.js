const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await pool.query('ALTER TABLE users ADD COLUMN web_login_key TEXT UNIQUE;');
    console.log('Added web_login_key column');
  } catch (e) {
    if (e.code === '42701') {
      console.log('Column already exists');
    } else {
      console.error(e);
    }
  }
  process.exit(0);
}
run();
