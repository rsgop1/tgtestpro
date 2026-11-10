const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

pkg.scripts.dev = "npm run build --workspace=artifacts/admin-panel && npm run build --workspace=artifacts/testbook-web && npm run dev --workspace=artifacts/api-server";

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
