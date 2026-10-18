/**
 * Resource Cost Confirm Dialog
 * Mount once near the app root. Registers itself with the cost confirmation
 * bridge so every contract call shows its estimated fee and resources and
 * waits for the user to continue before the wallet signing prompt opens.
 *
 * Issue: #2173
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import {
    setCostConfirmationHandler,
    type CostConfirmationRequest,
} from '../../services/costConfirmation';
import { ResourceCostPreview } from './ResourceCostPreview';

export function ResourceCostConfirmDialog() {
    const [request, setRequest] = useState<CostConfirmationRequest | null>(null);
    const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

    useEffect(() => {
        const unregister = setCostConfirmationHandler(
            (next) =>
                new Promise<boolean>((resolve) => {
                    // A newer request supersedes any pending one.
                    resolverRef.current?.(false);
                    resolverRef.current = resolve;
                    setRequest(next);
                }),
        );
        return () => {
            unregister();
            resolverRef.current?.(false);
            resolverRef.current = null;
        };
    }, []);

    const settle = useCallback((confirmed: boolean) => {
        resolverRef.current?.(confirmed);
        resolverRef.current = null;
        setRequest(null);
    }, []);

    return (
        <Modal
            isOpen={request !== null}
            onClose={() => settle(false)}
            title="Review network fee"
            size="sm"
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => settle(false)} data-testid="resource-cost-cancel">
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={() => settle(true)} data-testid="resource-cost-continue">
                        Continue to wallet
                    </Button>
                </div>
            }
        >
            {request && (
                <div>
                    <p className="mb-3 text-sm text-gray-700">
                        <span className="font-medium capitalize">{request.action}</span> — estimated cost
                        before you sign:
                    </p>
                    <ResourceCostPreview estimate={request.estimate} />
                </div>
            )}
        </Modal>
    );
}

export default ResourceCostConfirmDialog;
