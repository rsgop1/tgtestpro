const fs = require('fs');
const file = "artifacts/api-server/src/routes/admin.ts";
let content = fs.readFileSync(file, "utf8");

// Add /reports/:id patch route
const patchRoute = `
router.patch("/reports/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params["id"]);
    const { reason } = req.body as { reason?: string };
    await db.update(reportsTable).set({
      reason: reason ?? null,
    }).where(eq(reportsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update report" });
  }
});

router.patch("/reports/:id/resolve",`;
content = content.replace(/router\.patch\("\/reports\/:id\/resolve",/g, patchRoute);

// Also add a delete route for reports if it doesn't exist
const delRoute = `
router.delete("/reports/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params["id"]);
    await db.delete(reportsTable).where(eq(reportsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete report" });
  }
});
`;
if(!content.includes('router.delete("/reports/:id"')) {
  content = content + "\n" + delRoute;
}

fs.writeFileSync(file, content);
