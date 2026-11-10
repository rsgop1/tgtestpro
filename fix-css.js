const fs = require('fs');
let content = fs.readFileSync('artifacts/testbook-web/src/index.css', 'utf8');

const newVars = `
  --color-sidebar: hsl(var(--sidebar));
  --color-sidebar-foreground: hsl(var(--sidebar-foreground));
  --color-sidebar-border: hsl(var(--sidebar-border));
  --color-sidebar-primary: hsl(var(--sidebar-primary));
  --color-sidebar-primary-foreground: hsl(var(--sidebar-primary-foreground));
  --color-sidebar-accent: hsl(var(--sidebar-accent));
  --color-sidebar-accent-foreground: hsl(var(--sidebar-accent-foreground));
  --color-sidebar-ring: hsl(var(--sidebar-ring));
`;

content = content.replace(
  '--color-accent-foreground: hsl(var(--accent-foreground));',
  '--color-accent-foreground: hsl(var(--accent-foreground));' + newVars
);

fs.writeFileSync('artifacts/testbook-web/src/index.css', content);
