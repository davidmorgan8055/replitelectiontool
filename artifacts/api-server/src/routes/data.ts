import { createHash, timingSafeEqual } from "node:crypto";
import { Router, json, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.use("/data", (_req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
  });
  next();
});

router.get("/data", async (_req, res): Promise<void> => {
  const result = await pool.query(
    "SELECT document FROM election_results WHERE id = 1",
  );
  res.json(result.rows.length
    ? result.rows[0].document
    : { status_note: "Awaiting data", races: [] });
});

router.post(
  "/data",
  // Use a route-local parser so no earlier default 100kb parser intercepts it.
  json({ limit: 1024 * 1024, strict: false, inflate: false }),
  async (req, res): Promise<void> => {
    const expected = process.env.ADMIN_UPDATE_TOKEN;
    const supplied = req.get("X-Update-Token") ?? "";
    // Fixed-size digests permit constant-time comparison even for unequal lengths.
    const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
    const matches = timingSafeEqual(digest(supplied), digest(expected ?? ""));
    if (!expected || !supplied || !matches) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!req.is("application/json") || req.body === undefined) {
      res.status(400).json({ error: "A JSON request body is required" });
      return;
    }
    // A single atomic upsert replaces the entire JSON, with no instance-local cache.
    // Preserve the owner's document verbatim, including its own updated_at field.
    const result = await pool.query(
      `INSERT INTO election_results (id, document, updated_at)
       VALUES (1, $1::jsonb, clock_timestamp())
       ON CONFLICT (id) DO UPDATE
       SET document = EXCLUDED.document, updated_at = EXCLUDED.updated_at
       RETURNING updated_at`,
      [JSON.stringify(req.body)],
    );
    res.json({ ok: true, updated_at: result.rows[0].updated_at.toISOString() });
  },
);

export default router;
