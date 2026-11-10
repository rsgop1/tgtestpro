const fs = require('fs');
let content = fs.readFileSync('artifacts/admin-panel/src/pages/reports.tsx', 'utf8');
content = content.replace(/status: "open"[\s\S]*?reason: string \| null;/m, 'status: "open" | "resolved";\n  reason: string | null;');
fs.writeFileSync('artifacts/admin-panel/src/pages/reports.tsx', content);
