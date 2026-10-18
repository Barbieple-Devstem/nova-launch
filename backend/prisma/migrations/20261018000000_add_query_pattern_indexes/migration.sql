-- Query-pattern index review (#2218).
-- These composites match existing WHERE + ORDER BY patterns; see docs/DATABASE_INDEX_REVIEW.md.
-- IF NOT EXISTS makes the migration safe to retry on environments that already have an equivalent index.
CREATE INDEX IF NOT EXISTS "BurnRecord_tokenId_timestamp_idx"
  ON "BurnRecord" ("tokenId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "Campaign_tokenId_createdAt_idx"
  ON "Campaign" ("tokenId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Campaign_status_createdAt_idx"
  ON "Campaign" ("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Proposal_status_endTime_idx"
  ON "Proposal" ("status", "endTime" DESC);
