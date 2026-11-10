const fs = require('fs');
const file = "artifacts/api-server/src/bot/handlers/achievements.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(/title: "👑 Grandmaster"/g, 'title: "Grandmaster"');
content = content.replace(/title: "🎯 God of Accuracy"/g, 'title: "God of Accuracy"');
content = content.replace(/title: "⚡ The Flash Prime"/g, 'title: "The Flash Prime"');
content = content.replace(/title: "🏎️ Speed Demon"/g, 'title: "Speed Demon"');
content = content.replace(/title: "🦇 Night Owl Legend"/g, 'title: "Night Owl Legend"');
content = content.replace(/title: "🧠 Iron Brain"/g, 'title: "Iron Brain"');

fs.writeFileSync(file, content);
