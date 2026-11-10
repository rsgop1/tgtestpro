const fs = require('fs');
let content = fs.readFileSync('artifacts/api-server/src/routes/learner.ts', 'utf8');

const newRoutes = `
router.get("/profile", async (req: Request, res: Response) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const parsed = verifyLearnerToken(token);
  if (!parsed) return res.status(401).json({ error: "Invalid session" });
  const user = await getPremiumUser(parsed.userId);
  if (!user) return res.status(401).json({ error: "Premium plan required" });

  // Get user's promo code if any
  const { couponCodesTable } = await import("@workspace/db");
  const [coupon] = await db
    .select()
    .from(couponCodesTable)
    .where(eq(couponCodesTable.referrerUserId, parsed.userId))
    .limit(1);

  return res.json({ 
    ...user, 
    premiumExpiry: user.premiumExpiry?.toISOString() ?? null,
    promoCode: coupon?.code ?? null,
    coins: user.referralCount ?? 0,
    testsTaken: user.totalTestsTaken ?? 0,
    examTarget: user.targetExamSub ?? "Not set",
    fullName: user.fullName
  });
});

router.post("/generate-promo", async (req: Request, res: Response) => {
  const body = req.body as { token?: string };
  const parsed = typeof body.token === "string" ? verifyLearnerToken(body.token) : null;
  if (!parsed) return res.status(401).json({ error: "Invalid session" });
  
  const user = await getPremiumUser(parsed.userId);
  if (!user) return res.status(401).json({ error: "Premium plan required" });

  const { couponCodesTable } = await import("@workspace/db");
  
  // Check if exists
  const [existing] = await db
    .select()
    .from(couponCodesTable)
    .where(eq(couponCodesTable.referrerUserId, parsed.userId))
    .limit(1);
    
  if (existing) return res.json({ code: existing.code });

  const prefix = (user.fullName.split(' ')[0] || "VIP").toUpperCase().replace(/[^A-Z]/g, "");
  const code = \`\${prefix}\${parsed.userId.toString().substring(0,4)}20\`;

  await db.insert(couponCodesTable).values({
    code,
    type: "percentage",
    discountAmount: 20,
    isActive: true,
    referrerUserId: parsed.userId
  });

  return res.json({ code });
});

router.post("/support-ticket", async (req: Request, res: Response) => {
  const body = req.body as { token?: string, subject?: string, message?: string };
  const parsed = typeof body.token === "string" ? verifyLearnerToken(body.token) : null;
  if (!parsed) return res.status(401).json({ error: "Invalid session" });
  
  const user = await getPremiumUser(parsed.userId);
  if (!user) return res.status(401).json({ error: "Premium plan required" });

  const subject = body.subject?.trim() || "General";
  const message = body.message?.trim() || "";
  
  if (message.length < 5) return res.status(400).json({ error: "Message too short" });

  // Send to admin group
  const groupsRaw = await getConfig("bot_groups");
  if (groupsRaw) {
    const groups = JSON.parse(groupsRaw);
    for (const g of groups) {
      await getApi().sendMessage(
        g.id,
        \`🎫 <b>New Support Ticket</b>\\n\\nUser: \${user.fullName.replace(/</g, "&lt;").replace(/>/g, "&gt;")} (\${parsed.userId})\\nSubject: <b>\${subject}</b>\\n\\nMessage:\\n<i>\${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</i>\`,
        { parse_mode: "HTML" }
      ).catch(() => {});
    }
  }

  // Send acknowledgment to user
  await getApi().sendMessage(
    parsed.userId,
    \`🎫 <b>Support Ticket Created</b>\\n\\nYour message regarding <b>\${subject}</b> has been sent to our AI & Admin team. We will resolve it shortly.\`,
    { parse_mode: "HTML" }
  ).catch(() => {});

  return res.json({ success: true });
});

export default router;
`;

content = content.replace("export default router;", newRoutes);
fs.writeFileSync('artifacts/api-server/src/routes/learner.ts', content);
