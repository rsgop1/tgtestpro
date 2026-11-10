const fs = require('fs');
const file = "artifacts/api-server/src/routes/admin.ts";
let content = fs.readFileSync(file, "utf8");

const newRoute = `
router.get("/tests/:testId", requireAuth, async (req: Request, res: Response) => {
  try {
    const testId = String(req.params["testId"]);
    const [test] = await db.select().from(testSeriesTable).where(eq(testSeriesTable.testId, testId)).limit(1);
    if (!test) { res.status(404).json({ error: "Test not found" }); return; }
    res.json(test);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/tests/:testId",`;

content = content.replace(/router\.put\("\/tests\/:testId",/g, newRoute);
fs.writeFileSync(file, content);
