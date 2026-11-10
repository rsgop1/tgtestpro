const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/app.ts', 'utf8');

// Replace the admin panel serving to add testbook-web serving as well
const regex = /\/\/ Serve admin-panel static files[\s\S]*?export default app;/;
const newCode = `// Serve user web app (testbook-web) static files on /app
const userWebPath = path.join(__dirname, "../../testbook-web/dist/public");
app.use("/app", express.static(userWebPath));
app.get(/^\\/app(.*)/, (req, res) => {
  res.sendFile(path.join(userWebPath, "index.html"));
});

// Serve admin-panel static files on /
const adminPanelPath = path.join(__dirname, "../../admin-panel/dist/public");
app.use(express.static(adminPanelPath));
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(adminPanelPath, "index.html"));
});

export default app;`;

content = content.replace(regex, newCode);
fs.writeFileSync('artifacts/api-server/src/app.ts', content);
