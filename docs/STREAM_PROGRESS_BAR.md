# Stream Progress Bar and Remaining Time Display

**GitHub Issue:** [#2165](https://github.com/Emmyt24/nova-launch/issues/2165)  
**Labels:** `enhancement` · `frontend` · `Stellar Wave`  
**Status:** Open  

---

## Overview

Stream cards currently show raw numeric values with no visual indication of how far along a stream is or how much time remains. This feature adds a progress bar and a live-updating remaining-time counter to each stream card, along with clear handling of paused and cancelled stream states.

---

## Problem Statement

Users viewing active streams have to calculate progress themselves by comparing the streamed amount against the total — and there is no indication of when the stream will complete. Surfacing this as a visual progress bar and a human-readable remaining-time estimate gives users immediate situational awareness without any mental arithmetic.

---

## Feature Scope

### In Scope

- Progress bar on each stream card showing the ratio of `streamedAmount / totalAmount`.
- Remaining-time display updated on a regular interval while the stream is active.
- State-aware display for all stream lifecycle states:
  - `active` – progress bar fills and remaining time counts down live.
  - `paused` – progress bar is frozen; remaining time shows "Paused".
  - `cancelled` – progress bar is frozen at the point of cancellation; remaining time shows "Cancelled".
  - `completed` – progress bar at 100%; remaining time shows "Complete".
- Accessible markup: progress value exposed via `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
- Graceful handling of streams where rate or total is unknown (display "–" rather than crashing).

### Out of Scope

- Push-based real-time updates via WebSocket (polling or prop-driven updates only for this iteration).
- Animated fill transitions beyond what CSS provides respecting `prefers-reduced-motion`.
- Remaining-time estimates for streams with variable rates.

---

## UI Behaviour

### Progress Bar

```
[███████████░░░░░░░░░░] 54%   ~3h 12m remaining
```

| Property | Behaviour |
|---|---|
| Fill colour | Brand primary for `active`; muted grey for `paused`; error red for `cancelled`; success green for `completed` |
| Label | Percentage shown inside or beside the bar (never as the sole indicator of progress) |
| Animation | Smooth fill transition for `active` state; none when `prefers-reduced-motion: reduce` |

### Remaining Time Format

Remaining time is derived from the stream's flow rate and remaining balance. Display format:

| Time left | Display |
|---|---|
| > 24 hours | `~2d 4h` |
| 1–24 hours | `~3h 12m` |
| < 1 hour | `~45m` |
| < 1 minute | `< 1m` |
| State is paused | `Paused` |
| State is cancelled | `Cancelled` |
| State is completed | `Complete` |
| Rate unknown | `–` |

### Update Interval

- While a stream card is visible and the stream is `active`, remaining time recalculates every **30 seconds** using a `setInterval` tied to the component lifecycle.
- The interval is cleared when the component unmounts or the stream transitions to a terminal state (`completed`, `cancelled`).
- Tests should mock timers (`vi.useFakeTimers`) rather than waiting for real elapsed time.

---

## Implementation Tasks

- [ ] Add a progress bar component to the stream card, driven by `streamedAmount` and `totalAmount` props.
- [ ] Implement remaining-time calculation and live update logic using `setInterval`.
- [ ] Handle `active`, `paused`, `cancelled`, and `completed` states with appropriate visual and text output.
- [ ] Apply correct `role="progressbar"` ARIA attributes.
- [ ] Respect `prefers-reduced-motion` for bar fill animation.
- [ ] Handle edge cases: unknown rate, zero total, amounts exceeding total.
- [ ] Add component tests using mocked timers to cover all states and the update interval.

---

## Remaining Time Calculation

```ts
/**
 * Returns estimated seconds remaining for an active stream.
 * Returns null if rate is zero or unknown.
 */
function estimateSecondsRemaining(
  totalAmount: bigint,
  streamedAmount: bigint,
  ratePerSecond: bigint,
): number | null {
  if (ratePerSecond <= 0n) return null;
  const remaining = totalAmount - streamedAmount;
  if (remaining <= 0n) return 0;
  return Number(remaining / ratePerSecond);
}
```

The formatted display string is derived by bucketing the returned value into the display ranges in the table above.

---

## Accessibility Notes

- The `<div role="progressbar">` element must carry `aria-valuenow` (0–100), `aria-valuemin="0"`, and `aria-valuemax="100"`.
- The remaining-time text must be in a `<span>` adjacent to the bar so screen readers encounter it in natural reading order.
- Do not rely on colour alone to convey state; the text label (e.g. "Paused", "Cancelled") must always be present.
- Live remaining-time updates should use `aria-live="polite"` with a sufficiently long update cadence (30 s) to avoid flooding screen reader queues.

---

## Acceptance Criteria

- A progress bar and remaining-time display appear on every stream card.
- The progress bar accurately reflects `streamedAmount / totalAmount`.
- Remaining time updates every 30 seconds while the stream is active.
- `paused` streams show a frozen bar and "Paused" text.
- `cancelled` streams show a frozen bar and "Cancelled" text.
- `completed` streams show a full bar and "Complete" text.
- `role="progressbar"` and associated ARIA attributes are correctly set.
- `prefers-reduced-motion` is respected.
- All new UI code is covered by component tests using mocked timers.
- Existing tests and lint/CI checks continue to pass.
- This document is kept up to date as implementation decisions are finalized.

---

## Related Documentation

- [METADATA_FLOW.md](./METADATA_FLOW.md) – stream and token metadata flow.
- [docs/user-guides/GETTING_STARTED.md](./user-guides/GETTING_STARTED.md) – general platform onboarding.
- [docs/runbooks/blockchain-event-pipeline.md](./runbooks/blockchain-event-pipeline.md) – event pipeline that feeds stream state updates.
