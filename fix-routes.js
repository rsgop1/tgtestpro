const fs = require('fs');
let content = fs.readFileSync('artifacts/testbook-web/src/App.tsx', 'utf8');

// Replace the imports
content = content.replace(
  'import { DashboardPage } from "./pages/dashboard.tsx";',
  `import { DashboardPage } from "./pages/dashboard.tsx";
import { LoginPage } from "./pages/login.tsx";
import { TestsPage } from "./pages/tests.tsx";
import { HistoryPage } from "./pages/history.tsx";`
);

// Add the routes
content = content.replace(
  '<Route path="/result" component={ResultPage} />',
  `<Route path="/result" component={ResultPage} />
    <Route path="/login" component={LoginPage} />
    <Route path="/tests" component={TestsPage} />
    <Route path="/history" component={HistoryPage} />`
);

fs.writeFileSync('artifacts/testbook-web/src/App.tsx', content);
