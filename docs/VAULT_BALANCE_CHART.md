# Vault Balance Chart Over Time

**GitHub Issue:** [#2164](https://github.com/Emmyt24/nova-launch/issues/2164)  
**Labels:** `enhancement` · `frontend` · `Stellar Wave`  
**Status:** Open  

---

## Overview

The Vaults UI currently displays only the current balance of a vault, giving users no sense of historical trend. This feature adds a time-series chart of vault balance alongside an accessible data table fallback, with support for 7-day, 30-day, and 90-day time ranges.

---

## Problem Statement

Users managing vaults need to understand balance trends over time — not just the present value. Without a chart, detecting anomalies (unexpected drawdowns, slow leaks, or stalled top-ups) requires exporting raw data and graphing it externally. A built-in chart makes this immediately visible in the dashboard.

---

## Feature Scope

### In Scope

- Time-series line chart rendered inside the vault detail view.
- Data sourced from the existing backend vault balance-history endpoints.
- Time-range selector: **7 d**, **30 d**, **90 d** (default: 30 d).
- Tooltip showing exact balance and timestamp on hover/focus.
- Accessible data table fallback beneath the chart (initially collapsed) for screen reader users and low-motion preferences.
- Empty state when no historical data is available for the selected range.
- Loading skeleton while data is fetching.
- Error state with a retry action if the request fails.

### Out of Scope

- Custom date-range picker (covered by a future iteration).
- Comparing multiple vaults on a single chart.
- Balance forecasting or projections.
- CSV export of chart data (tracked separately).

---

## UI Behaviour

### Time-Range Selector

Tabs or segmented control placed above the chart:

| Label | Range |
|---|---|
| 7d | Last 7 days |
| 30d | Last 30 days (default) |
| 90d | Last 90 days |

Switching range triggers a new data fetch and re-renders the chart. The selected range is reflected in the URL query string.

### Chart Specification

| Property | Value |
|---|---|
| Chart type | Line chart |
| X-axis | Time (auto-scaled to selected range) |
| Y-axis | Balance in the vault's native token unit |
| Data points | One per available snapshot; exact frequency depends on backend resolution |
| Interaction | Hover/keyboard-focus shows a tooltip with `balance` and `timestamp` |
| Animation | Respects `prefers-reduced-motion`; animation disabled when set |

### Accessible Table Fallback

A `<details>`/`<summary>` element labelled "View as table" below the chart expands to show the same data points in a `<table>` with columns: **Timestamp** and **Balance**. This ensures the data is accessible without requiring chart library support in assistive technologies.

---

## Implementation Tasks

- [ ] Add a balance-history chart section to the vault detail view.
- [ ] Fetch time-series data from the backend vault balance-history endpoint.
- [ ] Implement the 7d/30d/90d time-range selector.
- [ ] Render the line chart with hover/focus tooltips.
- [ ] Respect `prefers-reduced-motion` for chart animations.
- [ ] Build the accessible data table fallback.
- [ ] Handle loading skeleton, empty state, and error state.
- [ ] Sync selected range to URL query params.
- [ ] Add component tests for range switching, data rendering, empty/error states, and table fallback.

---

## API Integration

| Purpose | Endpoint | Method |
|---|---|---|
| Fetch balance history | `/api/vaults/:id/balance-history` | `GET` |
| 7-day range | `?range=7d` | query param |
| 30-day range | `?range=30d` | query param |
| 90-day range | `?range=90d` | query param |

Expected response shape:

```json
{
  "vaultId": "vault_abc123",
  "range": "30d",
  "dataPoints": [
    { "timestamp": "2026-09-17T00:00:00Z", "balance": "1000000" },
    { "timestamp": "2026-09-18T00:00:00Z", "balance": "998500" }
  ]
}
```

Balance values are returned as strings to preserve precision for large token amounts.

---

## Accessibility Notes

- The chart `<svg>` must include an `aria-label` summarising its content (e.g. "Vault balance over the last 30 days").
- Interactive chart elements (data points, tooltip trigger area) must be keyboard-navigable.
- The accessible table fallback must be present in the DOM at all times (not just rendered on toggle), hidden visually via the `<details>` element, so screen readers can access it without user interaction.
- Colour is not the sole means of conveying information; axis labels and the tooltip must include text values.

---

## Acceptance Criteria

- The chart renders balance history for the 7d, 30d, and 90d ranges.
- Switching ranges re-fetches data and updates the chart without a full page reload.
- Hovering or focusing a data point shows a tooltip with balance and timestamp.
- Chart animations are disabled when `prefers-reduced-motion: reduce` is set.
- An accessible data table fallback is available beneath the chart.
- Loading, empty, and error states are handled gracefully.
- Selected range is preserved in the URL.
- All new UI code is covered by component tests.
- Existing tests and lint/CI checks continue to pass.
- This document is kept up to date as implementation decisions are finalized.

---

## Related Documentation

- [METADATA_FLOW.md](./METADATA_FLOW.md) – how vault and token metadata flows through the system.
- [docs/user-guides/TOKEN_DEPLOYMENT.md](./user-guides/TOKEN_DEPLOYMENT.md) – token and vault deployment guide.
- [STELLAR_READ_CACHE.md](./STELLAR_READ_CACHE.md) – caching layer that backs vault balance reads.
