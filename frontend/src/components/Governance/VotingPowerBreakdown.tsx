/**
 * Voting Power Breakdown
 * Shows a user's effective voting power with a tooltip explaining how it is
 * composed from their own balance and any delegation in or out.
 *
 * Issue: #2172
 */

import { useId, useRef, useState } from 'react';
import {
    getVotingPowerBreakdown,
    type VoterInfo,
} from '../../services/governanceApi';

export const VOTING_POWER_DOCS_URL =
    import.meta.env.VITE_GOVERNANCE_DOCS_URL ||
    'https://github.com/Emmyt24/nova-launch/blob/main/docs/user-guides/GOVERNANCE.md#how-voting-power-is-calculated';

export interface VotingPowerBreakdownProps {
    /** Voter info for the connected wallet; null while unknown */
    voterInfo: VoterInfo | null;
    /** Whether voter info is being fetched */
    loading?: boolean;
    /** Override the documentation link */
    docsUrl?: string;
}

function formatAmount(value: bigint): string {
    return value.toLocaleString('en-US');
}

export function VotingPowerBreakdown({
    voterInfo,
    loading = false,
    docsUrl = VOTING_POWER_DOCS_URL,
}: VotingPowerBreakdownProps) {
    const [open, setOpen] = useState(false);
    const tooltipId = useId();
    const closeTimer = useRef<number | null>(null);

    const show = () => {
        if (closeTimer.current !== null) {
            window.clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
        setOpen(true);
    };

    // Small delay so the pointer can move from the trigger into the tooltip
    // (to reach the docs link) without it closing.
    const hide = () => {
        closeTimer.current = window.setTimeout(() => setOpen(false), 150);
    };

    if (loading) {
        return (
            <div
                data-testid="voting-power-loading"
                className="flex items-center gap-2 text-sm text-gray-500"
                aria-busy="true"
            >
                <span className="inline-block h-4 w-24 animate-pulse rounded bg-gray-200" />
                <span className="sr-only">Loading voting power…</span>
            </div>
        );
    }

    if (!voterInfo) {
        return null;
    }

    const breakdown = getVotingPowerBreakdown(voterInfo);
    const isZero = breakdown.effective === 0n;

    return (
        <div
            className="relative inline-flex items-center gap-2 text-sm"
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    hide();
                }
            }}
            onKeyDown={(event) => {
                if (event.key === 'Escape') setOpen(false);
            }}
        >
            <span className="text-gray-600">Voting power:</span>
            <span data-testid="voting-power-total" className="font-semibold text-gray-900">
                {formatAmount(breakdown.effective)}
            </span>
            <button
                type="button"
                data-testid="voting-power-info"
                aria-label="How is my voting power calculated?"
                aria-expanded={open}
                aria-describedby={open ? tooltipId : undefined}
                onClick={() => setOpen((value) => !value)}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-xs text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                ?
            </button>

            {open && (
                <div
                    id={tooltipId}
                    role="tooltip"
                    data-testid="voting-power-tooltip"
                    className="absolute left-0 top-full z-50 mt-2 w-72 rounded-lg bg-gray-900 p-3 text-white shadow-lg"
                >
                    {isZero ? (
                        <p data-testid="voting-power-zero" className="mb-2 text-gray-200">
                            You have no voting power yet. Hold the governance token, or
                            ask a holder to delegate their voting power to you.
                        </p>
                    ) : null}

                    <dl className="space-y-1">
                        <div className="flex justify-between">
                            <dt className="text-gray-300">Own balance</dt>
                            <dd data-testid="voting-power-own">
                                {formatAmount(breakdown.ownBalance)}
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-300">Delegated to you</dt>
                            <dd data-testid="voting-power-delegated-in">
                                +{formatAmount(breakdown.delegatedIn)}
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-300">
                                Delegated away
                                {voterInfo.delegate && breakdown.delegatedOut > 0n
                                    ? ` to ${voterInfo.delegate.slice(0, 4)}…${voterInfo.delegate.slice(-4)}`
                                    : ''}
                            </dt>
                            <dd data-testid="voting-power-delegated-out">
                                −{formatAmount(breakdown.delegatedOut)}
                            </dd>
                        </div>
                        <div className="flex justify-between border-t border-gray-700 pt-1 font-semibold">
                            <dt>Effective voting power</dt>
                            <dd>{formatAmount(breakdown.effective)}</dd>
                        </div>
                    </dl>

                    <a
                        href={docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="voting-power-docs-link"
                        className="mt-2 inline-block text-blue-300 underline hover:text-blue-200"
                    >
                        Learn how voting power works
                    </a>
                </div>
            )}
        </div>
    );
}

export default VotingPowerBreakdown;
