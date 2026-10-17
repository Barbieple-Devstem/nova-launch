/**
 * useTransactionMonitor – polling, backoff and timeout (#2176)
 *
 * Drives the real TransactionMonitor service through its default Soroban RPC
 * transport with a stubbed fetch and fake timers. Math.random is pinned to 0
 * so the polling interval (3000ms + jitter) and the transient-error backoff
 * (USER_RETRY_CONFIG with ±10% jitter) are deterministic:
 *   - pending poll delay:       3000ms
 *   - 1st transient retry:      500ms  - 10% = 450ms
 *   - 2nd transient retry:      1000ms - 10% = 900ms
 *   - max retries (40) reached: 40 polls → 'timeout'
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransactionMonitor } from '../useTransactionMonitor';
import { DEFAULT_MONITORING_CONFIG } from '../../services/transactionMonitor';

const HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);
const POLL_MS = DEFAULT_MONITORING_CONFIG.pollingInterval;

const fetchMock = vi.fn();

function rpcResult(result: unknown) {
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ jsonrpc: '2.0', id: 1, result }),
    } as unknown as Response;
}

const pending = () => rpcResult({ status: 'NOT_FOUND' });
const success = () => rpcResult({ status: 'SUCCESS', ledger: 123 });
const failed = () => rpcResult({ status: 'FAILED' });
const badRequest = () =>
    ({ ok: false, status: 400, statusText: 'Bad Request', json: async () => ({}) } as unknown as Response);

/** Hashes requested so far, in order. */
function polledHashes(): string[] {
    return fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string).params[0]);
}

async function advance(ms: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

/** Let the in-flight request settle without moving the clock. */
const flush = () => advance(0);

describe('useTransactionMonitor – polling, backoff and timeout', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('success', () => {
        it('polls every pollingInterval while pending and stops on SUCCESS', async () => {
            fetchMock
                .mockResolvedValueOnce(pending())
                .mockResolvedValueOnce(pending())
                .mockResolvedValue(success());
            const { result } = renderHook(() => useTransactionMonitor());

            act(() => result.current.startMonitoring(HASH));
            await flush();
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(result.current.status).toBe('pending');
            expect(result.current.monitoring).toBe(true);

            await advance(POLL_MS - 1);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            await advance(1);
            expect(fetchMock).toHaveBeenCalledTimes(2);

            await advance(POLL_MS);
            expect(fetchMock).toHaveBeenCalledTimes(3);
            expect(result.current.status).toBe('success');
            expect(result.current.monitoring).toBe(false);
            expect(result.current.progress).toBe(100);
            expect(result.current.estimatedTimeMs).toBe(0);
            expect(result.current.error).toBeNull();

            await advance(POLL_MS * 10);
            expect(fetchMock).toHaveBeenCalledTimes(3);
        });

        it('sends a Soroban getTransaction request for the monitored hash', async () => {
            fetchMock.mockResolvedValue(success());
            const { result } = renderHook(() => useTransactionMonitor());

            act(() => result.current.startMonitoring(HASH));
            await flush();

            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toMatch(/soroban-(testnet|mainnet)\.stellar\.org/);
            expect((init as RequestInit).method).toBe('POST');
            expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
                method: 'getTransaction',
                params: [HASH],
            });
        });

        it('advances progress toward 90% while pending, then jumps to 100% on success', async () => {
            fetchMock.mockResolvedValue(pending());
            const { result } = renderHook(() => useTransactionMonitor());

            act(() => result.current.startMonitoring(HASH));
            expect(result.current.progress).toBe(0);
            expect(result.current.estimatedTimeMs).toBe(10_000);

            await advance(5_000);
            expect(result.current.progress).toBeCloseTo(45, 0);
            expect(result.current.estimatedTimeMs).toBe(5_000);

            await advance(20_000);
            expect(result.current.progress).toBe(90);
            expect(result.current.estimatedTimeMs).toBe(0);

            fetchMock.mockResolvedValue(success());
            await advance(POLL_MS);
            expect(result.current.progress).toBe(100);
        });
    });

    describe('failure', () => {
        it('stops with status failed when the transaction FAILED on-chain', async () => {
            fetchMock.mockResolvedValueOnce(pending()).mockResolvedValue(failed());
            const { result } = renderHook(() => useTransactionMonitor());

            act(() => result.current.startMonitoring(HASH));
            await flush();
            await advance(POLL_MS);

            expect(result.current.status).toBe('failed');
            expect(result.current.monitoring).toBe(false);
            expect(result.current.progress).toBeLessThan(100);

            await advance(POLL_MS * 5);
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('stops immediately and surfaces the message on a non-retryable RPC error', async () => {
            fetchMock.mockResolvedValue(badRequest());
            const { result } = renderHook(() => useTransactionMonitor());

            act(() => result.current.startMonitoring(HASH));
            await flush();

            expect(result.current.status).toBe('failed');
            expect(result.current.error).toBe('RPC request failed: Bad Request');
            expect(result.current.monitoring).toBe(false);

            await advance(POLL_MS * 5);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('keeps monitoring through transient errors, backing off exponentially', async () => {
            fetchMock
                .mockRejectedValueOnce(new TypeError('Failed to fetch'))
                .mockRejectedValueOnce(new TypeError('Failed to fetch'))
                .mockResolvedValue(success());
            const { result } = renderHook(() => useTransactionMonitor());

            act(() => result.current.startMonitoring(HASH));
            await flush();
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(result.current.status).toBe('pending');
            expect(result.current.monitoring).toBe(true);
            expect(result.current.error).toBeNull();

            // 1st retry after 450ms
            await advance(449);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            await advance(1);
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(result.current.status).toBe('pending');

            // 2nd retry after 900ms – longer than the first
            await advance(899);
            expect(fetchMock).toHaveBeenCalledTimes(2);
            await advance(1);
            expect(fetchMock).toHaveBeenCalledTimes(3);

            expect(result.current.status).toBe('success');
            expect(result.current.monitoring).toBe(false);
        });
    });

    describe('timeout', () => {
        it('times out after maxRetries pending polls', async () => {
            fetchMock.mockResolvedValue(pending());
            const { result } = renderHook(() => useTransactionMonitor());

            act(() => result.current.startMonitoring(HASH));
            await flush();

            for (let i = 1; i < DEFAULT_MONITORING_CONFIG.maxRetries; i++) {
                await advance(POLL_MS);
            }
            expect(fetchMock).toHaveBeenCalledTimes(DEFAULT_MONITORING_CONFIG.maxRetries);
            expect(result.current.status).toBe('pending');

            // The next scheduled poll hits the retry ceiling instead of fetching.
            await advance(POLL_MS);
            expect(fetchMock).toHaveBeenCalledTimes(DEFAULT_MONITORING_CONFIG.maxRetries);
            expect(result.current.status).toBe('timeout');
            expect(result.current.error).toBe('Max retries exceeded');
            expect(result.current.monitoring).toBe(false);
            expect(result.current.progress).toBeLessThan(100);

            await advance(POLL_MS * 5);
            expect(fetchMock).toHaveBeenCalledTimes(DEFAULT_MONITORING_CONFIG.maxRetries);
        });

        it('clears the progress interval once timed out', async () => {
            fetchMock.mockResolvedValue(pending());
            const { result } = renderHook(() => useTransactionMonitor());

            act(() => result.current.startMonitoring(HASH));
            await flush();
            for (let i = 0; i < DEFAULT_MONITORING_CONFIG.maxRetries; i++) {
                await advance(POLL_MS);
            }

            expect(result.current.status).toBe('timeout');
            expect(vi.getTimerCount()).toBe(0);
        });
    });

    describe('cleanup', () => {
        it('stops polling and clears every timer on unmount', async () => {
            fetchMock.mockResolvedValue(pending());
            const { result, unmount } = renderHook(() => useTransactionMonitor());

            act(() => result.current.startMonitoring(HASH));
            await flush();
            expect(vi.getTimerCount()).toBeGreaterThan(0);

            unmount();
            expect(vi.getTimerCount()).toBe(0);

            await advance(POLL_MS * 10);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('does not resume polling when a request in flight at unmount resolves', async () => {
            let resolveFetch!: (res: Response) => void;
            fetchMock.mockImplementationOnce(
                () => new Promise<Response>((resolve) => { resolveFetch = resolve; })
            );
            fetchMock.mockResolvedValue(pending());
            const { result, unmount } = renderHook(() => useTransactionMonitor());

            act(() => result.current.startMonitoring(HASH));
            unmount();

            resolveFetch(pending());
            await advance(POLL_MS * 10);

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(vi.getTimerCount()).toBe(0);
        });

        it('stopMonitoring() cancels the scheduled poll', async () => {
            fetchMock.mockResolvedValue(pending());
            const { result } = renderHook(() => useTransactionMonitor());

            act(() => result.current.startMonitoring(HASH));
            await flush();

            act(() => result.current.stopMonitoring());
            expect(result.current.monitoring).toBe(false);

            await advance(POLL_MS * 10);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(vi.getTimerCount()).toBe(0);
        });
    });

    describe('no duplicate polling', () => {
        it('rerendering does not start another poll loop', async () => {
            fetchMock.mockResolvedValue(pending());
            const { result, rerender } = renderHook(() => useTransactionMonitor());

            act(() => result.current.startMonitoring(HASH));
            await flush();

            for (let i = 0; i < 5; i++) rerender();

            await advance(POLL_MS * 3);
            // t = 0, 3000, 6000, 9000
            expect(fetchMock).toHaveBeenCalledTimes(4);
        });

        it('keeps stable startMonitoring/stopMonitoring identities across rerenders', () => {
            const { result, rerender } = renderHook(() => useTransactionMonitor());
            const { startMonitoring, stopMonitoring } = result.current;

            rerender();
            rerender();

            expect(result.current.startMonitoring).toBe(startMonitoring);
            expect(result.current.stopMonitoring).toBe(stopMonitoring);
        });

        it('starting a new hash replaces the previous poll loop', async () => {
            fetchMock.mockResolvedValue(pending());
            const { result } = renderHook(() => useTransactionMonitor());

            act(() => result.current.startMonitoring(HASH));
            await flush();
            act(() => result.current.startMonitoring(OTHER_HASH));
            await flush();

            await advance(POLL_MS * 2);

            expect(polledHashes()).toEqual([HASH, OTHER_HASH, OTHER_HASH, OTHER_HASH]);
        });

        it('restarting the same hash runs a single poll loop', async () => {
            fetchMock.mockResolvedValue(pending());
            const { result } = renderHook(() => useTransactionMonitor());

            act(() => result.current.startMonitoring(HASH));
            await flush();
            act(() => result.current.stopMonitoring());
            act(() => result.current.startMonitoring(HASH));
            await flush();
            expect(fetchMock).toHaveBeenCalledTimes(2);

            await advance(POLL_MS * 2);
            expect(fetchMock).toHaveBeenCalledTimes(4);
            expect(result.current.monitoring).toBe(true);
        });

        it('restarting while a request is in flight does not leave the old loop running', async () => {
            let resolveFirst!: (res: Response) => void;
            fetchMock.mockImplementationOnce(
                () => new Promise<Response>((resolve) => { resolveFirst = resolve; })
            );
            fetchMock.mockResolvedValue(pending());
            const { result } = renderHook(() => useTransactionMonitor());

            act(() => result.current.startMonitoring(HASH));
            act(() => result.current.startMonitoring(HASH));
            await flush();

            resolveFirst(pending());
            await flush();

            await advance(POLL_MS);
            // first (stale) request + restart at t=0 + one poll at t=3000
            expect(fetchMock).toHaveBeenCalledTimes(3);
        });
    });
});
