-- Supports keyset (cursor) pagination on GET /api/tokens/search:
--   WHERE creator = $1 [AND (createdAt, id) < ($2, $3)] ORDER BY createdAt, id
CREATE INDEX "Token_creator_createdAt_id_idx" ON "Token"("creator", "createdAt", "id");
