# Add Error Boundary With Recovery Actions Per Route

**Issue:** [#2169](https://github.com/Emmyt24/nova-launch/issues/2169)  
**Area:** Frontend — error handling / resilience  
**Status:** Open

---

## Problem

The application has a single global `ErrorBoundary` wrapping the entire `App`. When any
route component throws an unhandled render error, the whole application is replaced by the
generic "Something went wrong" fallback screen. Users lose navigation context and must
reload the entire app to recover, even when the error is isolated to one route.

### Current setup

```
main.tsx
└── ErrorContextProvider
    └── ErrorBoundary          ← single global boundary
        └── ToastProvider
            └── App
                └── <Suspense>
                    └── {page}  ← all routes render here; one throw kills everything
```

`App.tsx` also has a second `<ErrorBoundary>` inside the `<Suspense>`, but there are no
per-route boundaries. A crash in `CampaignDashboard`, `StreamDashboard`, `VaultDashboard`,
`RecurringPayments`, or `GovernancePage` takes down the entire app rather than just that
route's content area.

---

## What Already Exists

### `ErrorBoundary` component

**File:** `src/components/UI/ErrorBoundary.tsx`

A class component that:
- Integrates with `ErrorContextProvider` to attach Stellar transaction context
  (`txContext`) to error reports
- Calls `reportError(buildErrorReportPayload(...))` via `src/services/errorReportingService`
- Default fallback: full-screen centred panel with "Try Again" (resets state) and "Reload"
  (`window.location.reload()`) buttons
- Accepts a `fallback?: ReactNode` prop for custom fallback UI

### `ErrorContextProvider`

**File:** `src/providers/ErrorContextProvider.tsx`  
Provides a `txContext` object (`walletAddress`, `network`, `route`, `txHash`) that the
boundary reads via `static contextType = ErrorContext`. Must be an ancestor of any
`ErrorBoundary` instance — it is already at the root in `main.tsx`.

---

## Required Changes

### 1. Create `RouteErrorFallback`

Add a reusable fallback component that accepts route-specific recovery actions. This
keeps per-route fallbacks consistent while allowing different CTAs.

```tsx
// src/components/UI/RouteErrorFallback.tsx

import React from 'react';
import { Button } from './Button';

interface RecoveryAction {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'outline';
}

interface RouteErrorFallbackProps {
    title?: string;
    description?: string;
    error?: Error | null;
    onReset: () => void;
    recoveryActions?: RecoveryAction[];
}

export function RouteErrorFallback({
    title = 'Something went wrong',
    description = 'This section encountered an unexpected error.',
    error,
    onReset,
    recoveryActions = [],
}: RouteErrorFallbackProps) {
    return (
        <div
            className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12 text-center"
            role="alert"
            aria-live="assertive"
        >
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 space-y-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                    <svg
                        className="w-6 h-6 text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                        />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                <p className="text-sm text-gray-600">{description}</p>
                {error?.message && (
                    <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded p-2 break-words">
                        {error.message}
                    </p>
                )}
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <Button onClick={onReset} variant="primary" className="flex-1">
                        Try Again
                    </Button>
                    {recoveryActions.map((action) => (
                        <Button
                            key={action.label}
                            onClick={action.onClick}
                            variant={action.variant ?? 'outline'}
                            className="flex-1"
                        >
                            {action.label}
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
}
```

### 2. Expose `onReset` from `ErrorBoundary`

The existing `ErrorBoundary` resets state via a private `handleReset` method. To allow
`RouteErrorFallback` to call it, pass `handleReset` as a prop into the fallback:

```tsx
// src/components/UI/ErrorBoundary.tsx  (additions only)

// Update the render method to pass onReset when using the custom fallback prop
public render() {
    if (this.state.hasError) {
        if (this.props.fallback) {
            // If fallback is a function, call it with reset + error
            if (typeof this.props.fallback === 'function') {
                return (this.props.fallback as (props: {
                    error: Error | null;
                    onReset: () => void;
                }) => ReactNode)({
                    error: this.state.error,
                    onReset: this.handleReset,
                });
            }
            return this.props.fallback;
        }
        // ... existing default fallback unchanged
    }
    return this.props.children;
}
```

Update the `Props` type:

```ts
interface Props {
    children: ReactNode;
    fallback?: ReactNode | ((props: { error: Error | null; onReset: () => void }) => ReactNode);
}
```

### 3. Wrap each route in `App.tsx`

Replace the flat `{page}` render in `App.tsx` with per-route `ErrorBoundary` wrappers.
Each boundary receives a `fallback` render prop that mounts `RouteErrorFallback` with
route-appropriate recovery actions.

```tsx
// src/App.tsx

import { ErrorBoundary } from './components/UI/ErrorBoundary';
import { RouteErrorFallback } from './components/UI/RouteErrorFallback';

// Helper to avoid repetition
function withBoundary(
    children: ReactNode,
    fallbackProps: Omit<React.ComponentProps<typeof RouteErrorFallback>, 'onReset' | 'error'>
) {
    return (
        <ErrorBoundary
            fallback={({ error, onReset }) => (
                <RouteErrorFallback
                    {...fallbackProps}
                    error={error}
                    onReset={onReset}
                />
            )}
        >
            {children}
        </ErrorBoundary>
    );
}
```

Then update the `page` memo:

```tsx
const page = useMemo(() => {
    if (pathname === '/campaigns') {
        return (
            <DashboardLayout ...>
                {withBoundary(
                    <CampaignDashboard ... />,
                    {
                        title: 'Campaign Dashboard error',
                        description: 'Failed to load campaigns. Your data is safe.',
                        recoveryActions: [
                            { label: 'Go to Home', onClick: () => navigate('/'), variant: 'outline' },
                        ],
                    }
                )}
            </DashboardLayout>
        );
    }

    if (pathname === '/recurring-payments') {
        return (
            <DashboardLayout ...>
                {withBoundary(
                    <RecurringPayments />,
                    {
                        title: 'Recurring Payments error',
                        description: 'Failed to load recurring payments.',
                        recoveryActions: [
                            { label: 'Go to Home', onClick: () => navigate('/'), variant: 'outline' },
                        ],
                    }
                )}
            </DashboardLayout>
        );
    }

    if (pathname === '/streams') {
        return (
            <DashboardLayout ...>
                {withBoundary(
                    <StreamDashboard />,
                    {
                        title: 'Streams error',
                        description: 'Failed to load payment streams.',
                        recoveryActions: [
                            { label: 'Go to Home', onClick: () => navigate('/'), variant: 'outline' },
                        ],
                    }
                )}
            </DashboardLayout>
        );
    }

    if (pathname === '/governance') {
        return (
            <DashboardLayout ...>
                {withBoundary(
                    <GovernancePage wallet={wallet} />,
                    {
                        title: 'Governance error',
                        description: 'Failed to load governance proposals.',
                        recoveryActions: [
                            { label: 'Go to Home', onClick: () => navigate('/'), variant: 'outline' },
                        ],
                    }
                )}
            </DashboardLayout>
        );
    }

    if (pathname === '/' || pathname === '/deploy') {
        return (
            <ErrorBoundary
                fallback={({ error, onReset }) => (
                    <RouteErrorFallback
                        title="Deployment form error"
                        description="Failed to load the token deployment form."
                        error={error}
                        onReset={onReset}
                        recoveryActions={[
                            { label: 'Reload Page', onClick: () => window.location.reload(), variant: 'outline' },
                        ]}
                    />
                )}
            >
                <LandingPage ... />
            </ErrorBoundary>
        );
    }

    return <NotFoundRoute />;
}, [pathname, wallet, connect, disconnect, isConnecting]);
```

The global `ErrorBoundary` in `main.tsx` remains in place as a last-resort catch for
anything outside route components (e.g., provider-level errors).

---

## Recovery Action Matrix

| Route | Primary CTA | Secondary CTA |
|---|---|---|
| `/campaigns` | Try Again (reset boundary) | Go to Home |
| `/recurring-payments` | Try Again | Go to Home |
| `/streams` | Try Again | Go to Home |
| `/governance` | Try Again | Go to Home |
| `/` or `/deploy` | Try Again | Reload Page |
| Global fallback (main.tsx) | Try Again | Reload |

"Try Again" resets the `ErrorBoundary` state, allowing React to re-render the route
component from scratch. This resolves transient errors (network blips, race conditions)
without a full page reload. "Reload Page" is the right escalation when state may be
corrupted.

---

## Error Reporting

`ErrorBoundary.componentDidCatch` already calls `reportError` when `txContext` is
available. Per-route boundaries inherit this behaviour automatically because
`ErrorContextProvider` is at the root. No additional reporting setup is needed.

To attach the current route to reported errors, `App.tsx` already calls
`setTxContext({ route: window.location.pathname })` inside `handleDeploy`. For other
routes, call `setTxContext` with the route path whenever navigation occurs so the context
is fresh if a boundary fires.

---

## Testing Approach

Do not run tests. To manually verify each boundary in development:

1. Add a temporary `throw new Error('test')` at the top of a route component's render.
2. Navigate to that route — only that route's content area should show the
   `RouteErrorFallback` panel.
3. The sidebar/nav and other routes remain functional.
4. "Try Again" removes the error throw and re-renders the component.
5. Remove the temporary throw before committing.

---

## Accessibility Notes

- `RouteErrorFallback` uses `role="alert"` and `aria-live="assertive"` so screen readers
  announce the error immediately when the boundary catches.
- The error panel is centred within the main content area, not full-screen, so the
  sidebar navigation remains reachable by keyboard.
- Focus should be programmatically moved to the error panel heading when it mounts.
  Add a `useEffect` or `autoFocus` on the heading `<h2>` to achieve this.

---

## Related Files

- `src/components/UI/ErrorBoundary.tsx` — existing boundary; needs `fallback` type update
- `src/components/UI/RouteErrorFallback.tsx` — new component to create
- `src/App.tsx` — route definitions; needs per-route boundary wrappers
- `src/main.tsx` — global boundary and provider setup; no changes needed
- `src/providers/ErrorContextProvider.tsx` — supplies `txContext` to all boundaries
- `src/services/errorReportingService.ts` — `reportError` + `buildErrorReportPayload`
