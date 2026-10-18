# Webhook Delivery Log Viewer With Filters

**GitHub Issue:** [#2163](https://github.com/Emmyt24/nova-launch/issues/2163)  
**Labels:** `enhancement` · `frontend` · `Stellar Wave`  
**Status:** Open  

---

## Overview

Developers currently have no way to inspect individual webhook delivery attempts from the UI. This feature adds a per-subscription delivery log viewer that shows recent delivery history, lets users filter by status and date range, manually redeliver failed events, and navigate to the corresponding dead-letter queue entry.

---

## Problem Statement

When a webhook consumer reports missing events, the only current diagnostic path is to query the database directly or read backend logs — neither of which is accessible to most developers. A delivery log viewer brings this information to the surface in the dashboard, reducing mean-time-to-diagnosis for webhook delivery issues.

---

## Feature Scope

### In Scope

- Delivery log panel accessible from the detail view of a single webhook subscription.
- Table of recent deliveries showing:
  - Timestamp of the delivery attempt.
  - HTTP status code returned by the consumer endpoint.
  - Number of attempts made (including retries).
  - Outcome: `success`, `failed`, `pending`, or `retrying`.
- Filter controls:
  - Status filter (multi-select): `success`, `failed`, `pending`, `retrying`.
  - Date-range picker: from/to timestamps (defaults to the last 7 days).
- Expandable row to reveal full request/response detail:
  - Request headers and body (redacted secrets).
  - Response headers and body (truncated at 4 KB).
  - Retry timeline.
- **Redeliver** action button on failed/errored entries to trigger a manual re-attempt.
- Deep link to the dead-letter queue entry for deliveries that have exhausted all retries.

### Out of Scope

- Delivery log for all subscriptions aggregated in a single view (future work).
- Editing or replaying deliveries with a modified payload.
- Long-term log retention configuration from the UI.

---

## UI Behaviour

### Log Table Columns

| Column | Description |
|---|---|
| Timestamp | UTC time of the first delivery attempt for this event |
| Status | Outcome badge (`success` green · `failed` red · `retrying` yellow · `pending` grey) |
| HTTP Code | Response status code from the consumer, or `—` if no response was received |
| Attempts | Number of delivery attempts made so far |
| Actions | Redeliver button (shown only for failed/exhausted entries) · DLQ link |

### Filter Bar

- Status chips (toggle, multi-select) placed above the table.
- Date range picker with preset shortcuts: **Last 24 h**, **Last 7 d**, **Last 30 d**, custom.
- Filters are reflected in the URL query string so the view is bookmarkable.

### Redeliver

Clicking **Redeliver** on a log entry:

1. Shows an inline confirmation: "Redeliver this event to `<endpoint_url>`?"
2. On confirmation, calls the redeliver API endpoint.
3. Adds a new row at the top of the log for the re-attempt.

---

## Implementation Tasks

- [ ] Add a delivery log panel/tab to the webhook detail page.
- [ ] Fetch and display recent deliveries from the backend delivery-log endpoint.
- [ ] Implement status and date-range filter controls.
- [ ] Build expandable row with full request/response detail.
- [ ] Add manual redeliver action with inline confirmation.
- [ ] Link DLQ entries for exhausted deliveries.
- [ ] Sync active filters to URL query parameters.
- [ ] Add component tests covering table rendering, filter logic, and redeliver flow.

---

## API Integration

| Purpose | Endpoint | Method |
|---|---|---|
| List deliveries | `/api/webhooks/:id/deliveries` | `GET` |
| Filter by status | `?status=failed,retrying` | query param |
| Filter by date | `?from=<iso>&to=<iso>` | query params |
| Get delivery detail | `/api/webhooks/:id/deliveries/:deliveryId` | `GET` |
| Manual redeliver | `/api/webhooks/:id/deliveries/:deliveryId/redeliver` | `POST` |
| DLQ entry | `/api/webhooks/:id/dead-letter/:messageId` | `GET` |

---

## Acceptance Criteria

- The delivery log shows at least the 100 most recent delivery attempts for a subscription.
- Status and date-range filters update the table without a full page reload.
- Expanding a row reveals the full request/response detail.
- The Redeliver button is only visible on entries with a `failed` or exhausted status.
- A successful redeliver adds a new entry to the top of the log.
- Failed deliveries that have a dead-letter queue entry include a working link to it.
- Active filters are preserved in the URL.
- All new UI code is covered by component tests.
- Existing tests and lint/CI checks continue to pass.
- This document is kept up to date as implementation decisions are finalized.

---

## Related Documentation

- [WEBHOOK_SIGNATURE_VERIFICATION.md](./WEBHOOK_SIGNATURE_VERIFICATION.md) – how deliveries are signed and verified.
- [WEBHOOK_BULK_ACTIONS.md](./WEBHOOK_BULK_ACTIONS.md) – bulk enable, disable, and delete for webhook subscriptions.
- [docs/runbooks/slo-webhooks.md](./runbooks/slo-webhooks.md) – webhook delivery SLO runbook.
- [docs/runbooks/blockchain-event-pipeline.md](./runbooks/blockchain-event-pipeline.md) – event ingestion pipeline runbook.
