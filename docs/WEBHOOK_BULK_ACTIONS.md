# Webhook Bulk Select and Batch Actions

**GitHub Issue:** [#2162](https://github.com/Emmyt24/nova-launch/issues/2162)  
**Labels:** `enhancement` · `frontend` · `Stellar Wave`  
**Status:** Open  

---

## Overview

Managing webhooks one at a time is tedious when a user has many subscriptions to maintain. This feature adds checkbox-based multi-selection to the webhook management list and a batch-action toolbar that lets users enable, disable, or delete many webhooks in a single operation.

---

## Problem Statement

The current webhook management UI requires users to open each webhook individually to change its state or delete it. For users with dozens of subscriptions, a single bulk operation (e.g. "disable everything in staging") can take many clicks. Bulk select and batch actions reduce that friction to a few interactions.

---

## Feature Scope

### In Scope

- Checkbox column in the webhook list table for selecting individual rows.
- "Select all on this page" checkbox in the table header.
- Batch-action toolbar that appears when one or more rows are selected, exposing:
  - **Enable** – activate all selected webhooks.
  - **Disable** – deactivate all selected webhooks.
  - **Delete** – permanently remove all selected webhooks (requires a confirmation dialog).
- Count badge in the toolbar showing how many webhooks are selected.
- Partial-failure feedback: if some webhooks in the batch fail to update, the UI reports which ones succeeded and which failed without rolling back the successful ones.
- Clear-selection control to reset the selection without leaving the page.

### Out of Scope

- Cross-page selection (only the currently visible page is selectable).
- Bulk editing of webhook URLs or secrets.
- Undo / history for batch deletes.

---

## UI Behaviour

### Selection State

| Scenario | Header Checkbox State |
|---|---|
| No rows selected | Unchecked |
| Some rows selected | Indeterminate |
| All rows on page selected | Checked |

### Confirmation Dialog (Delete)

Before executing a bulk delete the UI must show a modal containing:

- The exact count of webhooks about to be deleted.
- A plain-language warning that the action is irreversible.
- **Confirm Delete** (destructive, red) and **Cancel** buttons.

### Partial-Failure Toast

After a batch operation completes with mixed results the toast message follows this pattern:

```
3 of 5 webhooks disabled. Failed: "Orders hook", "Payments hook".
```

Failed items remain in their original state; successfully updated items reflect their new state immediately in the list without a full page reload.

---

## Implementation Tasks

- [ ] Add a checkbox column to the webhook list component.
- [ ] Implement "select all on page" logic with indeterminate state on the header checkbox.
- [ ] Build the batch-action toolbar (appears/hides based on selection count).
- [ ] Wire Enable, Disable, and Delete actions to the existing webhook API endpoints.
- [ ] Implement the deletion confirmation dialog.
- [ ] Handle and display partial-failure results from the API.
- [ ] Add component tests for selection logic, toolbar visibility, and the confirmation dialog.

---

## API Integration

Batch operations should call the existing per-webhook endpoints in parallel (or use a future bulk endpoint if one is added). The frontend is responsible for aggregating individual responses to determine partial-failure state.

| Action | Endpoint | Method |
|---|---|---|
| Enable | `/api/webhooks/:id/enable` | `PATCH` |
| Disable | `/api/webhooks/:id/disable` | `PATCH` |
| Delete | `/api/webhooks/:id` | `DELETE` |

---

## Acceptance Criteria

- Users can select any combination of webhooks on the current page.
- The batch-action toolbar appears when at least one webhook is selected and hides when the selection is cleared.
- Enable and Disable batch actions update webhook states without a full page reload.
- Delete batch action requires explicit confirmation before proceeding.
- Partial failures are surfaced clearly; successful operations are not rolled back.
- All new UI code is covered by component tests.
- Existing tests and lint/CI checks continue to pass.
- This document is kept up to date as implementation decisions are finalized.

---

## Related Documentation

- [WEBHOOK_SIGNATURE_VERIFICATION.md](./WEBHOOK_SIGNATURE_VERIFICATION.md) – signing and verifying webhook deliveries.
- [WEBHOOK_DELIVERY_LOG.md](./WEBHOOK_DELIVERY_LOG.md) – viewing per-webhook delivery history.
- [docs/runbooks/slo-webhooks.md](./runbooks/slo-webhooks.md) – webhook delivery SLO runbook.
