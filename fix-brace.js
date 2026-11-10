const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/bot/handlers/payment.ts', 'utf8');

content = content.replace(/export function registerAdminPaymentHandlers/g, '}\n\nexport function registerAdminPaymentHandlers');

fs.writeFileSync('artifacts/api-server/src/bot/handlers/payment.ts', content);
