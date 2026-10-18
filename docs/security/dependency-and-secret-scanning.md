# Dependency and Secret Scanning Policy

Nova Launch treats backend dependency updates and leaked credentials as release-blocking security concerns. The `Security` GitHub Actions workflow runs the backend audit against production dependencies with `npm audit --omit=dev --audit-level=high`; high and critical advisories fail the job. The generated JSON report is retained as a workflow artifact for triage. Dependabot opens weekly grouped update and security PRs for `backend/` through `.github/dependabot.yml`.

When an audit reports an advisory, first identify the affected package and reachable code path, then update the direct dependency or regenerate the lockfile with the smallest compatible version. If no fix exists, record the advisory, affected release, exploitability assessment, compensating control, owner, and review date in the security issue before requesting a temporary exception. Do not suppress an audit failure by lowering the threshold or removing a dependency without documenting the replacement.

Gitleaks runs against the full Git history in CI using `.gitleaks.toml` and `.gitleaks-baseline.json`. The baseline is intentionally empty for new findings; an existing false positive may be added only after confirming that the value is non-sensitive and documenting the matching path or rule. Never add a real credential to the baseline. Rotate any exposed credential immediately, remove it from the repository history where practical, invalidate related sessions, and document the incident through the security response process.

Developers can opt into the same scan before committing by installing Gitleaks and setting `GITLEAKS_PRE_COMMIT=1` in the shell that runs `git commit`. The repository hook remains fast by default and still performs its existing staged-file checks. CI is authoritative even when the local option is disabled.

## WebSocket token refresh

The `/ws` live-event WebSocket accepts an optional `Authorization: Bearer <access-token>` header. A connected client can refresh an expiring token without opening a second connection by sending `{ "type": "refresh_token", "token": "<new-access-token>" }` (the `auth` message type is accepted as an alias). The server replies with `token_refreshed` and the token expiry timestamp. When the active token expires, the server closes the connection with code `4001` and reason `Authentication token expired; refresh required`; clients should obtain a new access token and reconnect or send a refresh message before expiry.

## Deployment status SSE

Clients that need push updates can subscribe to `GET /api/v1/deploy/<txHash>/events?network=testnet` (the unversioned `/api` alias is also available). The endpoint emits `deployment_status` events only when the confirmation state changes, sends comment heartbeats to keep intermediaries from closing idle connections, and stops after finalization or an on-chain failure. The poll interval defaults to three seconds and can be adjusted with `DEPLOY_STATUS_STREAM_INTERVAL_MS` (minimum 500 ms). Closing the client connection cancels polling and all timers.
