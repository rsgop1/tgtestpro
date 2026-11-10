const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/ai.ts', 'utf8');

content = content.replace(
  /const apiKey = process\.env\["GEMINI_API_KEY"\];/g,
  'const apiKey = process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"];'
);

content = content.replace(
  /if \(\!apiKey\) throw new Error\("GEMINI_API_KEY is not set"\);/g,
  'if (!apiKey) throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY is not set");'
);

fs.writeFileSync('artifacts/api-server/src/bot/ai.ts', content);
