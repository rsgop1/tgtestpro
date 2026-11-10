const fs = require('fs');
const file = "lib/db/src/schema/reports.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(/reportText: text\("report_text"\)\.notNull\(\),/g, 'reason: text("reason"),\n  reportText: text("report_text").notNull(),');

fs.writeFileSync(file, content);
