# Transaction Fee Preview

Before your wallet asks you to sign a contract call, such as deploying a token, burning tokens, creating a proposal, or voting, Nova Launch shows a **Review network fee** dialog.

## What the dialog shows

The app simulates the transaction against Soroban RPC (`simulateTransaction`) and shows:

| Field | Meaning |
| --- | --- |
| **Base fee** | The inclusion fee for getting the transaction into a ledger (100 stroops per operation) |
| **Resource fee** | The minimum Soroban resource fee reported by simulation |
| **Estimated total** | Base fee + resource fee, in XLM |
| **Resource usage** (expandable) | CPU instructions, memory, ledger bytes read/written, and ledger entries read/written, when the RPC reports them |

Choose **Continue to wallet** to open the wallet signing prompt, or **Cancel** to stop without signing. The fee your wallet shows is the maximum you can be charged. Unused resource fee is refunded by the network.

These fees go to the Stellar network. They are separate from any Nova Launch service fee shown in the deployment form.

## When simulation fails

If the simulation fails, no wallet prompt is shown. Instead you'll see an explanation, such as an insufficient balance or an unauthorized caller, plus a suggestion where one is available. Common causes:

- The contract would reject the call (wrong parameters, missing permission, paused contract)
- Contract data the call needs has expired and must be restored first
- The Soroban RPC couldn't be reached. Check your connection and try again.

See the [Troubleshooting Guide](TROUBLESHOOTING.md) for specific error messages.

## For developers

- `frontend/src/services/resourceCost.ts`: `estimateResourceCost(server, tx)` and `parseResourceCost(sim)` turn a simulation into a `ResourceCostEstimate` or a readable `ResourceCostError`.
- `frontend/src/services/costConfirmation.ts`: the bridge `StellarService` calls before signing. When no dialog is mounted (scripts, tests), confirmation resolves to `true` automatically.
- `frontend/src/components/ResourceCost/`: `ResourceCostPreview` (display only) and `ResourceCostConfirmDialog` (mounted once in `App.tsx`).
