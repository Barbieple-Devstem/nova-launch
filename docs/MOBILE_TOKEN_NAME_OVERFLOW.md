# Fix Layout Overflow of Long Token Names on Mobile

**Issue:** [#2166](https://github.com/Emmyt24/nova-launch/issues/2166)  
**Area:** Frontend — responsive layout / typography  
**Status:** Open

---

## Problem

Long token names cause horizontal overflow and broken layouts on mobile viewports across
several dashboard views. The root cause is missing CSS overflow utilities on elements that
render user-supplied token names.

### Affected components

| Component | File | Problem |
|---|---|---|
| `TokenCard` | `src/components/TransactionHistory/TokenCard.tsx` | `<h3>` has `text-xl font-bold text-gray-900` with no truncation. A name like "My Absolutely Enormous Token Name" overflows the card width on narrow screens. |
| `ReviewStep` | `src/components/TokenDeployForm/ReviewStep.tsx` | Token name sits inside a `grid-cols-2` cell with `text-sm font-medium text-gray-900`. The grid does not collapse to a single column on small screens, and names are not clipped. |
| `TokenAnalyticsPage` | `src/pages/TokenAnalyticsPage.tsx` | Token name is embedded directly in an `<h1>` as `"{stats?.name ?? 'Token'} Analytics"`. No wrapping guard is applied. The `KpiCard` sub-component already uses `truncate` on its values but the page title does not follow the same pattern. |
| `DashboardLayout` (sidebar nav) | `src/components/Layout/DashboardLayout.tsx` | Sidebar nav item labels (`item.label`) have `text-sm font-medium` with no `truncate`. The wallet address in the same sidebar already uses `truncate`, but nav labels do not. |

---

## Expected Behaviour

- Token names that exceed their container width are truncated with an ellipsis on a single line,
  or wrap cleanly to a second line, depending on the context.
- No horizontal scrollbars appear on any dashboard view at viewport widths ≥ 320 px.
- The full token name is accessible via a `title` attribute tooltip on truncated elements.

---

## Implementation Guide

### 1. `TokenCard` — single-line truncation

```tsx
// src/components/TransactionHistory/TokenCard.tsx

// Before
<h3 className="text-xl font-bold text-gray-900">{displayName}</h3>

// After
<h3
  className="text-xl font-bold text-gray-900 truncate"
  title={displayName}
>
  {displayName}
</h3>
```

`truncate` applies `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.
The `title` attribute surfaces the full name on hover / via assistive technologies.

### 2. `ReviewStep` — two-column grid fix

The `grid-cols-2` layout for token detail pairs is too tight on small screens.
Add `sm:grid-cols-2` so the grid is single-column by default and only goes two-column
at ≥ 640 px. Apply `break-words` to the name value so very long names wrap without
overflowing:

```tsx
// src/components/TokenDeployForm/ReviewStep.tsx

// Before
<div className="grid grid-cols-2 gap-4">
  <div>
    <p className="text-xs text-gray-500 uppercase tracking-wide">Name</p>
    <p className="text-sm font-medium text-gray-900 mt-1">{basicInfo.name}</p>
  </div>
  ...
</div>

// After
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div>
    <p className="text-xs text-gray-500 uppercase tracking-wide">Name</p>
    <p className="text-sm font-medium text-gray-900 mt-1 break-words">{basicInfo.name}</p>
  </div>
  ...
</div>
```

### 3. `TokenAnalyticsPage` — page title wrapping

The page header uses a `flex` row with the title on the left and a Refresh button on the
right. Add `min-w-0` to the text container so it can shrink within the flex row, and
`break-words` to the `<h1>` to allow wrapping:

```tsx
// src/pages/TokenAnalyticsPage.tsx

// Before
<div>
  <h1 className="text-2xl font-bold text-gray-900">
    {stats?.name ?? 'Token'} Analytics
  </h1>
  ...
</div>

// After
<div className="min-w-0">
  <h1 className="text-2xl font-bold text-gray-900 break-words">
    {stats?.name ?? 'Token'} Analytics
  </h1>
  ...
</div>
```

### 4. `DashboardLayout` sidebar — nav label truncation

```tsx
// src/components/Layout/DashboardLayout.tsx

// Before
{!sidebarCollapsed && item.label}

// After
{!sidebarCollapsed && (
  <span className="truncate" title={item.label}>{item.label}</span>
)}
```

---

## CSS Utility Reference

| Class | Effect | Use when |
|---|---|---|
| `truncate` | Single-line clip with `…` | Fixed-height rows, card headers |
| `break-words` | Wraps at word boundaries | Multi-line fields, form reviews |
| `line-clamp-2` | Two-line clip with `…` | Descriptions, secondary text |
| `min-w-0` | Allows flex child to shrink below content size | Any flex row containing text |

---

## Accessibility Notes

- Always pair `truncate` with a `title={fullValue}` attribute so the full name is reachable
  without zooming on desktop, and exposed to assistive technologies.
- Do **not** use `title` alone as the primary label — it is invisible to touch users.
- On mobile, prefer `break-words` over `truncate` for content the user typed themselves
  (e.g., the review step), so they can verify what they entered.

---

## Related Files

- `src/components/TransactionHistory/TokenCard.tsx`
- `src/components/TokenDeployForm/ReviewStep.tsx`
- `src/pages/TokenAnalyticsPage.tsx`
- `src/components/Layout/DashboardLayout.tsx`
- `docs/Mobile Navigation Menu/src/app/components/mobile-nav.tsx` — reference mobile nav
  implementation using Shadcn `Sheet`; `HamburgerButton` has animated open/close states and
  full ARIA support. This component is not yet integrated into `Header.tsx`.
