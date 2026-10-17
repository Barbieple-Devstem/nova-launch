# Confirm Dialog Focus Management

`useConfirmDialog` and `ConfirmDialog` follow the WAI-ARIA modal dialog pattern for focus:

1. **On open**: `confirm()` records `document.activeElement` (usually the button that triggered
   the dialog). `ConfirmDialog` then moves focus to its panel (`tabIndex={-1}`), so the dialog
   is announced via `aria-labelledby` and `aria-describedby`.
2. **On close**: `handleConfirm` and `handleCancel` both resolve the pending promise and return
   focus to the recorded element on the next animation frame, after the dialog has unmounted.
3. **Guards**: focus is not restored if the trigger was removed from the DOM or disabled while
   the dialog was open. Focus is also not restored if `document.body` was focused when the
   dialog opened.

Escape, the Cancel button, a backdrop click, the Confirm button and Enter all go through
`handleCancel`/`handleConfirm`, so focus is restored the same way for each.

## Usage

There's nothing extra to wire up. Call `confirm()` from the trigger's event handler, while the
trigger still has focus:

```tsx
const { isOpen, options, confirm, handleConfirm, handleCancel } = useConfirmDialog();

<button onClick={async () => { if (await confirm({ ... })) doThing(); }}>Burn</button>
```

If your code calls `confirm()` after an `await`, focus may already have moved somewhere else.
In that case, the element focused at call time is the one that gets restored.

## Screen reader verification notes

To check this manually:

| Step | NVDA + Firefox / JAWS + Chrome | VoiceOver + Safari |
| --- | --- | --- |
| Tab to the trigger and press Enter/Space | Announces "dialog, *title*", then the message | Announces "*title*, web dialog", then the message |
| Press Esc | Dialog closes and reading resumes on the trigger button ("*label*, button") | Same, and the VO cursor lands on the trigger |
| Reopen, then Tab to Confirm and press Enter | Focus returns to the trigger after the action resolves | Same |
| Disable or remove the trigger inside the confirm handler | Focus stays on the document and nothing throws | Same |

Expected result: after the dialog closes, keyboard and screen reader users never land at the
top of the page.
