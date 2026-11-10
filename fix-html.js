const fs = require('fs');
let content = fs.readFileSync('artifacts/testbook-web/index.html', 'utf8');

content = content.replace(
  '</head>',
  '  <script src="https://telegram.org/js/telegram-web-app.js"></script>\n  </head>'
);

fs.writeFileSync('artifacts/testbook-web/index.html', content);
