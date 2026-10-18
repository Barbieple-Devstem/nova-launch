# Database index review (#2218)

## Scope and methodology

The repository does not include a checked-in slow-query log export. The review therefore used the existing Prisma query patterns in `backend/src` and the repository's documented performance-test methodology (`backend/src/__tests__/queryPerformance.integration.test.ts`). No live `EXPLAIN`, `EXPLAIN ANALYZE`, migration, test, or benchmark was run for this change.

For production validation, capture `db_query_duration_seconds` by `operation`/`table`, rank the highest p95 and total-time query shapes, and run parameterized `EXPLAIN (ANALYZE, BUFFERS)` for representative values in a staging clone. Compare planning/execution time, buffer hits, and rows removed by filter before and after applying the migration; repeat cold-cache and warm-cache samples and record p50/p95. The migration is intentionally documented as rationale rather than fabricated timing results.

## Findings and focused indexes

| Query shape observed in repository | Index added | Rationale |
| --- | --- | --- |
| `BurnRecord` by `tokenId`, newest `timestamp` first | `BurnRecord_tokenId_timestamp_idx` | Covers the token burn-history include/pagination pattern and avoids a sort after filtering. |
| `Campaign` by `tokenId`, newest `createdAt` first | `Campaign_tokenId_createdAt_idx` | Covers token campaign listing and its ordering. |
| `Campaign` by `status`, newest `createdAt` first | `Campaign_status_createdAt_idx` | Covers active/status dashboard listings with ordering. |
| `Proposal` by `status`, newest `endTime` first | `Proposal_status_endTime_idx` | Covers active/expiry-oriented governance queries and ordering. |

Each index is also represented in `schema.prisma`; the SQL uses `CREATE INDEX IF NOT EXISTS` so retries are safe. No unrelated columns or tables were changed.
