const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/routes/learner.ts', 'utf8');

const loginEndpoint = `
router.post("/login-with-key", async (req: Request, res: Response) => {
  const body = req.body as { key?: string };
  if (!body.key || typeof body.key !== "string") {
    return res.status(400).json({ error: "Key is required" });
  }

  const { usersTable } = await import("@workspace/db");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.webLoginKey, body.key.trim().toUpperCase())).limit(1);

  if (!user) {
    return res.status(401).json({ error: "Invalid login key" });
  }

  // Issue token
  const token = createLearnerWebToken(user.userId, undefined);
  return res.json({ token, user: { fullName: user.fullName, userId: user.userId, tier: user.tier } });
});

router.post("/tests", async (req: Request, res: Response) => {
  const body = req.body as { token?: string };
  const parsed = typeof body.token === "string" ? verifyLearnerToken(body.token) : null;
  if (!parsed) return res.status(401).json({ error: "Invalid session" });
  
  const { testSeriesTable } = await import("@workspace/db");
  const tests = await db.select().from(testSeriesTable).where(eq(testSeriesTable.isActive, true));
  
  return res.json({ tests: tests.map(t => ({
    testId: t.testId,
    testName: t.testName,
    mainCategory: t.mainCategory,
    subCategory: t.subCategory,
    questionCount: t.questionsData ? (typeof t.questionsData === 'string' ? JSON.parse(t.questionsData).length : (t.questionsData as any[]).length) : 0,
    timerSeconds: t.timerSeconds,
    type: t.type
  }))});
});

router.post("/history", async (req: Request, res: Response) => {
  const body = req.body as { token?: string };
  const parsed = typeof body.token === "string" ? verifyLearnerToken(body.token) : null;
  if (!parsed) return res.status(401).json({ error: "Invalid session" });
  
  const { userHistoryTable } = await import("@workspace/db");
  const history = await db.select().from(userHistoryTable).where(eq(userHistoryTable.userId, parsed.userId)).orderBy(desc(userHistoryTable.createdAt));
  
  return res.json({ history });
});
`;

const insertPos = content.indexOf('export default router;');
content = content.substring(0, insertPos) + loginEndpoint + '\\n' + content.substring(insertPos);
content = `import { desc } from "drizzle-orm";\n` + content;

fs.writeFileSync('artifacts/api-server/src/routes/learner.ts', content);
