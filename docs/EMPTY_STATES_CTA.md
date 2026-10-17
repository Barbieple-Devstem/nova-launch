# Add Empty States With Calls to Action Across Dashboard Views

**Issue:** [#2167](https://github.com/Emmyt24/nova-launch/issues/2167)  
**Area:** Frontend — UX / dashboard views  
**Status:** Open

---

## Problem

Several dashboard views either show no empty state at all, or display a raw plain-text
message instead of using the shared `EmptyState` component. Neither approach gives the user
a clear next action when a view has no data to show.

### Current coverage audit

| View | Route | File | Empty state? | Uses `EmptyState`? | Has CTA? |
|---|---|---|---|---|---|
| Token List | `/` | `TransactionHistory/TokenList.tsx` | ✅ Yes | ✅ Yes | ✅ Yes |
| Recurring Payments | `/recurring-payments` | `app/dashboard/RecurringPayments.tsx` | ✅ Yes | ✅ Yes | ✅ Yes |
| Campaign Dashboard | `/campaigns` | `app/dashboard/CampaignDashboard.tsx` | ⚠️ Partial | ✅ Yes | ❌ No `action` prop |
| Vaults Dashboard | `/vaults` | `components/Vaults/VaultDashboard.tsx` | ⚠️ Partial | ❌ Raw `<div>` | ❌ No |
| Stream Dashboard | `/streams` | `components/Streams/StreamDashboard.tsx` | ⚠️ Partial | ❌ Raw `<div>` | ❌ No |

### Root cause

`CampaignDashboard` uses `<EmptyState>` but passes no `action` prop, so no button
renders. `VaultDashboard` and `StreamDashboard` use ad-hoc `<div>` text that bypasses the
shared component entirely, producing inconsistent styling and no actionable path for the
user.

---

## Shared Empty State System

The project already ships a complete empty state library. Use it — do not invent new
patterns.

### Base component

```
src/components/UI/EmptyState.tsx
```

```ts
interface EmptyStateProps {
    icon?: React.ReactNode;         // SVG icon, aria-hidden
    title: string;                  // Short heading
    description: string;            // One or two sentences
    action?: {
        label: string;
        onClick: () => void;
        variant?: 'primary' | 'secondary' | 'outline';
    };
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}
```

The component renders with `role="status"` and `aria-live="polite"` so screen readers
announce the transition when data loads or clears.

### Pre-built variants

```
src/components/UI/EmptyStateVariants.tsx
```

| Export | CTA label | Use case |
|---|---|---|
| `NoTokensEmptyState` | "Deploy Your First Token" | Token list |
| `NoWalletEmptyState` | "Connect Wallet" + "Learn More" | Any wallet-gated view |
| `NoSearchResultsEmptyState` | "Clear Search" | Filtered lists |
| `NoConnectionEmptyState` | "Retry Connection" | Network errors |
| `NoMetadataEmptyState` | "Refresh" | Missing token metadata |
| `ErrorEmptyState` | "Try Again" | Unexpected errors |

Both files are re-exported from `src/components/UI/index.tsx`.

### Icon primitives

`EmptyState.tsx` exports `EmptyStateIcons` — an object of SVG icon components
(`NoTokens`, `NoWallet`, `NoSearch`, `NoConnection`, `NoMetadata`, `Error`).
For new views, add an icon to this object rather than inlining SVG in the view component.

---

## Required Changes

### 1. Campaign Dashboard — wire the `action` prop

**File:** `src/app/dashboard/CampaignDashboard.tsx`

The empty-state block already uses `<EmptyState>` but passes no `action`, so no button
renders. Add a CTA that navigates to the campaign creation flow.

```tsx
// Before
{!isLoading && data && data.campaigns.length === 0 && (
  <Card className="border border-border-medium bg-background-elevated">
    <EmptyState
      title="No campaigns yet"
      description="Create a campaign to begin tracking budget execution."
    />
  </Card>
)}

// After
{!isLoading && data && data.campaigns.length === 0 && (
  <Card className="border border-border-medium bg-background-elevated">
    <EmptyState
      icon={<EmptyStateIcons.NoTokens />}
      title="No campaigns yet"
      description="Create a buyback campaign to start tracking budget execution and audit history."
      action={{
        label: 'Create Campaign',
        onClick: () => {
          // navigate to campaign creation — update this once the route exists
          window.location.href = '/campaigns/new';
        },
        variant: 'primary',
      }}
    />
  </Card>
)}
```

### 2. Vaults Dashboard — replace raw `<div>` with `EmptyState`

**File:** `src/components/Vaults/VaultDashboard.tsx`

```tsx
// Before
) : vaults.length === 0 ? (
  <div
    className="lg:col-span-3 bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center"
    role="status"
    aria-live="polite"
  >
    <p className="text-gray-500">You have no vesting vaults yet.</p>
  </div>
)

// After
) : vaults.length === 0 ? (
  <div className="lg:col-span-3">
    <EmptyState
      icon={<EmptyStateIcons.NoTokens />}
      title="No vesting vaults yet"
      description="Create a vesting vault to lock and gradually release tokens to recipients on a custom schedule."
      action={{
        label: 'Create Vault',
        onClick: () => {
          window.location.href = '/vaults/new';
        },
        variant: 'primary',
      }}
    />
  </div>
)
```

Import at the top of the file:

```tsx
import { EmptyState, EmptyStateIcons } from '../UI';
```

### 3. Stream Dashboard — replace raw `<div>` with `EmptyState`

**File:** `src/components/Streams/StreamDashboard.tsx`

```tsx
// Before
if (rows.length === 0) {
  return (
    <div className="p-6 text-center text-gray-500 border border-dashed rounded-xl">
      No payment streams found for this address.
    </div>
  );
}

// After
if (rows.length === 0) {
  return (
    <EmptyState
      icon={<EmptyStateIcons.NoTokens />}
      title="No payment streams"
      description="You have no active payment streams for this address. Create a stream to start sending continuous token payments."
      action={{
        label: 'Create Stream',
        onClick: () => {
          window.location.href = '/streams/new';
        },
        variant: 'primary',
      }}
      className="border border-dashed rounded-xl"
    />
  );
}
```

---

## Adding a New Empty State Icon

When a new dashboard view needs an icon that does not exist yet, add it to the
`EmptyStateIcons` object in `EmptyState.tsx`:

```tsx
// src/components/UI/EmptyState.tsx

export const EmptyStateIcons = {
  // ... existing icons ...

  NoVaults: () => (
    <svg
      className="w-16 h-16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  ),

  NoStreams: () => (
    <svg
      className="w-16 h-16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  ),
};
```

---

## Checklist for Any New Dashboard View

When building a new dashboard view, verify all three empty-state scenarios are handled:

- [ ] **No data + wallet connected** — `EmptyState` with a primary CTA pointing to the
  creation flow.
- [ ] **No data + wallet not connected** — `NoWalletEmptyState` with a "Connect Wallet"
  CTA.
- [ ] **Data fetch error** — `ErrorEmptyState` (or `NoConnectionEmptyState`) with a
  "Try Again" / "Retry" CTA that re-calls the data-fetch hook.

---

## Accessibility Notes

- The `EmptyState` component already includes `role="status"` and `aria-live="polite"`.
  Do not add these again on a wrapper element — duplicate live regions confuse screen readers.
- CTA buttons inside empty states must have descriptive labels ("Create Vault" is better
  than "Create" in isolation) so they make sense when read out of context by a screen reader.
- Empty state icons are decorative; `EmptyState.tsx` wraps them in a container with
  `aria-hidden="true"`.

---

## Related Files

- `src/components/UI/EmptyState.tsx` — base component
- `src/components/UI/EmptyStateVariants.tsx` — pre-built variants
- `src/components/UI/index.tsx` — re-exports
- `src/app/dashboard/CampaignDashboard.tsx` — needs `action` prop wired
- `src/components/Vaults/VaultDashboard.tsx` — needs full `EmptyState` replacement
- `src/components/Streams/StreamDashboard.tsx` — needs full `EmptyState` replacement
- `src/app/dashboard/RecurringPayments.tsx` — reference implementation (complete)
