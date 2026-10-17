/**
 * Resource Cost Preview
 * Presents a simulated Soroban fee and resource estimate, or a readable
 * simulation error, before the user signs a contract call.
 *
 * Issue: #2173
 */

import {
    formatBytes,
    formatStroopsAsXlm,
    type ResourceCostEstimate,
    type ResourceCostError,
} from '../../services/resourceCost';

export interface ResourceCostPreviewProps {
    estimate?: ResourceCostEstimate | null;
    error?: ResourceCostError | null;
    loading?: boolean;
}

function Row({ label, value, testId }: { label: string; value: string; testId: string }) {
    return (
        <div className="flex justify-between gap-4 py-1">
            <dt className="text-gray-600">{label}</dt>
            <dd data-testid={testId} className="font-mono text-gray-900">
                {value}
            </dd>
        </div>
    );
}

export function ResourceCostPreview({ estimate, error, loading = false }: ResourceCostPreviewProps) {
    if (loading) {
        return (
            <div data-testid="resource-cost-loading" aria-busy="true" className="text-sm text-gray-500">
                Estimating network fee…
            </div>
        );
    }

    if (error) {
        return (
            <div
                data-testid="resource-cost-error"
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm"
            >
                <p className="font-medium text-red-800">Fee estimate unavailable</p>
                <p className="mt-1 text-red-700">{error.message}</p>
                {error.suggestion && <p className="mt-1 text-red-600">{error.suggestion}</p>}
            </div>
        );
    }

    if (!estimate) return null;

    const resourceRows: { label: string; value: string; testId: string }[] = [];
    if (estimate.cpuInstructions !== undefined) {
        resourceRows.push({
            label: 'CPU instructions',
            value: estimate.cpuInstructions.toLocaleString('en-US'),
            testId: 'resource-cost-cpu',
        });
    }
    if (estimate.memoryBytes !== undefined) {
        resourceRows.push({ label: 'Memory', value: formatBytes(estimate.memoryBytes), testId: 'resource-cost-memory' });
    }
    if (estimate.readBytes !== undefined) {
        resourceRows.push({ label: 'Ledger read', value: formatBytes(estimate.readBytes), testId: 'resource-cost-read-bytes' });
    }
    if (estimate.writeBytes !== undefined) {
        resourceRows.push({ label: 'Ledger write', value: formatBytes(estimate.writeBytes), testId: 'resource-cost-write-bytes' });
    }
    if (estimate.readEntries !== undefined || estimate.writeEntries !== undefined) {
        resourceRows.push({
            label: 'Ledger entries (read / write)',
            value: `${estimate.readEntries ?? 0} / ${estimate.writeEntries ?? 0}`,
            testId: 'resource-cost-entries',
        });
    }

    return (
        <div data-testid="resource-cost-preview" className="text-sm">
            <dl className="divide-y divide-gray-100">
                <Row label="Base fee" value={formatStroopsAsXlm(estimate.inclusionFee)} testId="resource-cost-inclusion-fee" />
                <Row label="Resource fee" value={formatStroopsAsXlm(estimate.resourceFee)} testId="resource-cost-resource-fee" />
                <div className="flex justify-between gap-4 py-1 font-semibold">
                    <dt className="text-gray-900">Estimated total</dt>
                    <dd data-testid="resource-cost-total" className="font-mono text-gray-900">
                        {formatStroopsAsXlm(estimate.totalFee)}
                    </dd>
                </div>
            </dl>

            {resourceRows.length > 0 && (
                <details className="mt-3">
                    <summary className="cursor-pointer text-gray-600">Resource usage</summary>
                    <dl className="mt-2">
                        {resourceRows.map((row) => (
                            <Row key={row.testId} {...row} />
                        ))}
                    </dl>
                </details>
            )}

            <p className="mt-3 text-xs text-gray-500">
                Estimated by simulating this transaction. The fee shown in your wallet is the
                maximum you can be charged; unused resource fee is refunded.
            </p>
        </div>
    );
}

export default ResourceCostPreview;
