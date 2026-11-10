const fs = require('fs');
let content = fs.readFileSync('artifacts/testbook-web/src/App.tsx', 'utf8');

if (!content.includes('import { ProfilePage }')) {
  content = content.replace(
    'import { DashboardPage } from "./pages/dashboard.tsx";',
    `import { DashboardPage } from "./pages/dashboard.tsx";\nimport { ProfilePage } from "./pages/profile.tsx";\nimport { SupportPage } from "./pages/support.tsx";`
  );

  content = content.replace(
    '<Route path="/result" component={ResultPage} />',
    `<Route path="/result" component={ResultPage} />\n    <Route path="/profile" component={ProfilePage} />\n    <Route path="/support" component={SupportPage} />`
  );

  fs.writeFileSync('artifacts/testbook-web/src/App.tsx', content);
}
