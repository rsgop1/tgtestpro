const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/start.ts', 'utf8');

// Ensure db and eq are defined for the new handler
content = content.replace(
  'const { usersTable } = await import("@workspace/db");',
  'const { usersTable, db } = await import("@workspace/db");\n    const { eq } = await import("drizzle-orm");'
);

fs.writeFileSync('artifacts/api-server/src/bot/handlers/start.ts', content);
