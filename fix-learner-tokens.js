const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/routes/learner.ts', 'utf8');

content = content.replace(
  'export function createLearnerWebToken(userId: number, testId: string): string {',
  `export function createLearnerWebToken(userId: number, testId?: string): string {`
);

content = content.replace(
  /export async function createLearnerWebUrl\(userId: number, testId: string\): Promise<string \| undefined> \{/g,
  'export async function createLearnerWebUrl(userId: number, testId?: string): Promise<string | undefined> {'
);

content = content.replace(
  'parsed.pathname = pathname === "" || pathname === "/" ? "/testbook-web/" : `${pathname}/`;',
  'parsed.pathname = pathname === "" || pathname === "/" ? "/app/" : `${pathname}/`;'
);

content = content.replace(
  'parsed.searchParams.set("testId", testId);',
  'if (testId) parsed.searchParams.set("testId", testId);'
);

fs.writeFileSync('artifacts/api-server/src/routes/learner.ts', content);
