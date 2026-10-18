/**
 * Bridge between the transaction service layer and the cost preview UI.
 *
 * StellarService calls `requestCostConfirmation` after simulating a contract
 * call and before asking the wallet to sign. A mounted
 * `ResourceCostConfirmDialog` registers itself as the handler and resolves
 * with the user's decision. When no handler is registered (scripts, tests,
 * non-UI contexts) the request resolves to `true` so signing proceeds as
 * before.
 *
 * Issue: #2173
 */

import type { ResourceCostEstimate } from './resourceCost';

export interface CostConfirmationRequest {
  /** Contract method being invoked, e.g. "vote" or "create_tokens" */
  action: string;
  estimate: ResourceCostEstimate;
}

export type CostConfirmationHandler = (request: CostConfirmationRequest) => Promise<boolean>;

let handler: CostConfirmationHandler | null = null;

/**
 * Register the UI handler. Returns an unregister function.
 */
export function setCostConfirmationHandler(next: CostConfirmationHandler): () => void {
  handler = next;
  return () => {
    if (handler === next) {
      handler = null;
    }
  };
}

export async function requestCostConfirmation(request: CostConfirmationRequest): Promise<boolean> {
  if (!handler) return true;
  return handler(request);
}
