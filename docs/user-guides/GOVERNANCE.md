# Governance Guide

How to find proposals and understand your voting power on the Nova Launch governance page (`/governance`).

---

## Finding proposals

The proposal list has a search box and status filters above it.

- **Search** matches text in a proposal's title or description (case-insensitive). Results update shortly after you stop typing.
- **Status filters** narrow the list to one status:

  | Filter | Meaning |
  | --- | --- |
  | Active | Voting is open |
  | Passed | Voting ended and the proposal met quorum and threshold |
  | Failed | Voting ended and the proposal did not pass (stored as `REJECTED`) |
  | Queued | Passed and waiting in the timelock before it can be executed |
  | Executed / Cancelled / Expired | Final states |

- **Shareable links.** Search and status are saved in the page URL, for example:

  ```
  /governance?q=treasury&status=queued
  ```

  Bookmark or share that link to open the same filtered view. `status` accepts `active`, `passed`, `failed` (or `rejected`), `queued`, `executed`, `cancelled`, `expired`.

---

## How voting power is calculated

When your wallet is connected, the governance page shows your **voting power**. Click or hover the **?** next to it to see the breakdown:

| Line | What it is |
| --- | --- |
| **Own balance** | Governance tokens held by your address |
| **Delegated to you** | Voting power other holders have delegated to you |
| **Delegated away** | Your own balance that you have delegated to someone else |
| **Effective voting power** | Own balance + delegated to you − delegated away |

### How delegation works

- Delegating moves your **entire balance's** voting power to the delegatee. While delegated, your own balance does not count for you.
- Delegation is one level deep: power delegated to you can't be passed on again. You can only re-delegate your own balance.
- You can't delegate to yourself, and two addresses can't delegate to each other.

For the contract-level rules, see [`contracts/governance/src/delegation.rs`](../../contracts/governance/src/delegation.rs).

### Zero voting power

If the breakdown shows 0, you can't vote yet. Either acquire the governance token, or ask a holder to delegate their voting power to you.

> **Note:** The backend doesn't index delegation events yet. Until it does, the app treats your full reported voting power as your own balance and shows 0 for both delegation lines.

The link target for "Learn how voting power works" can be overridden with the `VITE_GOVERNANCE_DOCS_URL` environment variable.
