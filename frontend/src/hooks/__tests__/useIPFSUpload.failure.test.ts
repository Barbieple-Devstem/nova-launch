/**
 * useIPFSUpload – failure, retry and abort paths (#2177)
 *
 * Covers the error shapes IPFSService can produce (network failure, partial
 * upload where the image pins but metadata does not, and an invalid Pinata
 * response), retrying the upload through useRetry, how errors reach the
 * caller, and aborting an in-flight upload when the component unmounts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIPFSUpload } from '../useIPFSUpload';
import { useRetry } from '../useRetry';
import { IPFSService } from '../../services/IPFSService';
import type { RetryConfig } from '../../utils/retry';

vi.mock('../../services/IPFSService', () => ({ IPFSService: vi.fn() }));

const FILE = new File(['img'], 'logo.png', { type: 'image/png' });
const IMAGE_CID = 'ipfs://QmImage';
const METADATA_CID = 'ipfs://QmMetadata';

// No jitter, no timeout race, and tiny delays so retries resolve quickly on real timers.
const FAST_RETRY: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 5,
    maxDelay: 5,
    backoffFactor: 1,
    jitterFactor: 0,
};

// Mirror the errors IPFSService actually throws.
const networkError = () => new TypeError('Failed to fetch');
const invalidResponseError = () => new Error('IPFS upload succeeded but no hash was returned');
const metadataNetworkError = () => new TypeError('NetworkError when attempting to fetch resource.');

type ServiceMock = {
    uploadImage: ReturnType<typeof vi.fn>;
    uploadMetadata: ReturnType<typeof vi.fn>;
};

let service: ServiceMock;

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function renderUploadWithRetry() {
    return renderHook(() => {
        const ipfs = useIPFSUpload();
        const retry = useRetry<string>({ config: FAST_RETRY });
        return { ipfs, retry };
    });
}

describe('useIPFSUpload – failure, retry and abort paths', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});

        service = {
            uploadImage: vi.fn().mockResolvedValue(IMAGE_CID),
            uploadMetadata: vi.fn().mockResolvedValue(METADATA_CID),
        };
        (IPFSService as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => service);
    });

    describe('failure modes', () => {
        it('network failure on the image upload rejects and skips the metadata step', async () => {
            service.uploadImage.mockRejectedValue(networkError());
            const { result } = renderHook(() => useIPFSUpload());

            await act(async () => {
                await expect(result.current.upload(FILE, 'desc', 'Token')).rejects.toThrow('Failed to fetch');
            });

            expect(service.uploadMetadata).not.toHaveBeenCalled();
            expect(result.current.error).toBe('Failed to fetch');
            expect(result.current.uploading).toBe(false);
            expect(result.current.progress).toBeLessThan(50);
        });

        it('partial upload (image pinned, metadata failed) rejects without reporting completion', async () => {
            service.uploadMetadata.mockRejectedValue(new Error('IPFS upload failed (500): Internal Server Error'));
            const { result } = renderHook(() => useIPFSUpload());

            await act(async () => {
                await expect(result.current.upload(FILE, 'desc', 'Token')).rejects.toThrow(
                    'IPFS upload failed (500): Internal Server Error'
                );
            });

            expect(service.uploadImage).toHaveBeenCalledTimes(1);
            expect(service.uploadMetadata).toHaveBeenCalledTimes(1);
            expect(result.current.error).toBe('IPFS upload failed (500): Internal Server Error');
            expect(result.current.progress).toBe(60);
            expect(result.current.progress).not.toBe(100);
            expect(result.current.uploading).toBe(false);
        });

        it('invalid Pinata response (no hash) surfaces the service message', async () => {
            service.uploadImage.mockRejectedValue(invalidResponseError());
            const { result } = renderHook(() => useIPFSUpload());

            await act(async () => {
                await expect(result.current.upload(FILE, 'desc', 'Token')).rejects.toThrow(
                    'IPFS upload succeeded but no hash was returned'
                );
            });

            expect(result.current.error).toBe('IPFS upload succeeded but no hash was returned');
        });

        it('invalid metadata schema response surfaces the validation message', async () => {
            service.uploadMetadata.mockRejectedValue(
                new Error('Metadata schema validation failed: name is required')
            );
            const { result } = renderHook(() => useIPFSUpload());

            await act(async () => {
                await expect(result.current.upload(FILE, 'desc', '')).rejects.toThrow(/schema validation failed/);
            });

            expect(result.current.error).toMatch(/schema validation failed/);
        });
    });

    describe('retry via useRetry', () => {
        it('retries a transient network failure and resolves with the metadata CID', async () => {
            service.uploadImage
                .mockRejectedValueOnce(networkError())
                .mockRejectedValueOnce(networkError())
                .mockResolvedValue(IMAGE_CID);
            const { result } = renderUploadWithRetry();

            let cid: string | undefined;
            await act(async () => {
                cid = await result.current.retry.execute(() =>
                    result.current.ipfs.upload(FILE, 'desc', 'Token')
                );
            });

            expect(cid).toBe(METADATA_CID);
            expect(service.uploadImage).toHaveBeenCalledTimes(3);
            expect(service.uploadMetadata).toHaveBeenCalledTimes(1);
            // Each attempt clears the previous attempt's error.
            expect(result.current.ipfs.error).toBeNull();
            expect(result.current.retry.isRetrying).toBe(false);
            expect(result.current.retry.lastError).toBeNull();
        });

        it('re-runs the whole upload when a partial upload fails transiently', async () => {
            service.uploadMetadata
                .mockRejectedValueOnce(metadataNetworkError())
                .mockResolvedValue(METADATA_CID);
            const { result } = renderUploadWithRetry();

            let cid: string | undefined;
            await act(async () => {
                cid = await result.current.retry.execute(() =>
                    result.current.ipfs.upload(FILE, 'desc', 'Token')
                );
            });

            expect(cid).toBe(METADATA_CID);
            // The hook has no resume point, so the image is pinned again on retry.
            expect(service.uploadImage).toHaveBeenCalledTimes(2);
            expect(service.uploadMetadata).toHaveBeenCalledTimes(2);
        });

        it('gives up after maxAttempts and surfaces the last error to the caller', async () => {
            service.uploadImage.mockRejectedValue(networkError());
            const { result } = renderUploadWithRetry();

            await act(async () => {
                await expect(
                    result.current.retry.execute(() => result.current.ipfs.upload(FILE, 'desc', 'Token'))
                ).rejects.toThrow('Failed to fetch');
            });

            expect(service.uploadImage).toHaveBeenCalledTimes(FAST_RETRY.maxAttempts);
            expect(result.current.retry.lastError?.message).toBe('Failed to fetch');
            expect(result.current.retry.isRetrying).toBe(false);
            expect(result.current.ipfs.error).toBe('Failed to fetch');
            expect(result.current.ipfs.uploading).toBe(false);
        });

        it('does not retry a non-retryable invalid response', async () => {
            service.uploadImage.mockRejectedValue(invalidResponseError());
            const { result } = renderUploadWithRetry();

            await act(async () => {
                await expect(
                    result.current.retry.execute(() => result.current.ipfs.upload(FILE, 'desc', 'Token'))
                ).rejects.toThrow('no hash was returned');
            });

            expect(service.uploadImage).toHaveBeenCalledTimes(1);
            expect(result.current.retry.lastError?.message).toMatch(/no hash was returned/);
        });

        it('retry() re-runs the last upload after the caller fixes the failure', async () => {
            service.uploadImage.mockRejectedValue(invalidResponseError());
            const { result } = renderUploadWithRetry();

            await act(async () => {
                await expect(
                    result.current.retry.execute(() => result.current.ipfs.upload(FILE, 'desc', 'Token'))
                ).rejects.toThrow();
            });

            service.uploadImage.mockResolvedValue(IMAGE_CID);

            let cid: string | undefined;
            await act(async () => {
                cid = await result.current.retry.retry();
            });

            expect(cid).toBe(METADATA_CID);
            expect(service.uploadImage).toHaveBeenCalledTimes(2);
            expect(result.current.ipfs.error).toBeNull();
        });
    });

    describe('error surfaced to caller', () => {
        it('rejects with an Error instance whose message matches the error state', async () => {
            service.uploadImage.mockRejectedValue(networkError());
            const { result } = renderHook(() => useIPFSUpload());

            let caught: unknown;
            await act(async () => {
                try {
                    await result.current.upload(FILE, 'desc', 'Token');
                } catch (err) {
                    caught = err;
                }
            });

            expect(caught).toBeInstanceOf(Error);
            expect((caught as Error).message).toBe(result.current.error);
        });

        it('maps timeout failures to a user-facing message for both the rejection and state', async () => {
            service.uploadMetadata.mockRejectedValue(
                Object.assign(new Error('signal timed out'), { name: 'TimeoutError' })
            );
            const { result } = renderHook(() => useIPFSUpload());

            await act(async () => {
                await expect(result.current.upload(FILE, 'desc', 'Token')).rejects.toThrow(
                    'Upload timed out. Please check your connection and try again.'
                );
            });

            expect(result.current.error).toBe('Upload timed out. Please check your connection and try again.');
        });

        it('falls back to a generic message when the service throws a non-Error value', async () => {
            service.uploadImage.mockRejectedValue({ status: 502 });
            const { result } = renderHook(() => useIPFSUpload());

            await act(async () => {
                await expect(result.current.upload(FILE, 'desc', 'Token')).rejects.toThrow('IPFS upload failed');
            });

            expect(result.current.error).toBe('IPFS upload failed');
        });
    });

    describe('abort on unmount', () => {
        it('aborts during the image step and never starts the metadata upload', async () => {
            const image = deferred<string>();
            service.uploadImage.mockReturnValue(image.promise);
            const { result, unmount } = renderHook(() => useIPFSUpload());

            let pending!: Promise<string>;
            act(() => {
                pending = result.current.upload(FILE, 'desc', 'Token');
            });
            const settled = pending.catch((err: unknown) => err);

            unmount();
            image.resolve(IMAGE_CID);

            const err = await settled;
            expect(err).toBeInstanceOf(DOMException);
            expect((err as DOMException).name).toBe('AbortError');
            expect(service.uploadMetadata).not.toHaveBeenCalled();
        });

        it('aborts during the metadata step and does not return the CID', async () => {
            const metadata = deferred<string>();
            service.uploadMetadata.mockReturnValue(metadata.promise);
            const { result, unmount } = renderHook(() => useIPFSUpload());

            let pending!: Promise<string>;
            await act(async () => {
                pending = result.current.upload(FILE, 'desc', 'Token');
                await Promise.resolve();
            });
            const settled = pending.then(
                () => 'resolved',
                (err: unknown) => err
            );

            unmount();
            metadata.resolve(METADATA_CID);

            const err = await settled;
            expect(err).not.toBe('resolved');
            expect((err as DOMException).name).toBe('AbortError');
        });

        it('reports an abort, not the service error, when the upload fails after unmount', async () => {
            const image = deferred<string>();
            service.uploadImage.mockReturnValue(image.promise);
            const { result, unmount } = renderHook(() => useIPFSUpload());

            let pending!: Promise<string>;
            act(() => {
                pending = result.current.upload(FILE, 'desc', 'Token');
            });
            const settled = pending.catch((err: unknown) => err);

            unmount();
            image.reject(networkError());

            const err = await settled;
            expect((err as DOMException).name).toBe('AbortError');
        });

        it('stops the simulated progress interval after unmount', async () => {
            vi.useFakeTimers();
            try {
                const image = deferred<string>();
                service.uploadImage.mockReturnValue(image.promise);
                const { result, unmount } = renderHook(() => useIPFSUpload());

                act(() => {
                    void result.current.upload(FILE, 'desc', 'Token').catch(() => {});
                });

                unmount();
                act(() => {
                    vi.advanceTimersByTime(200);
                });
                // The interval clears itself on its first tick after the abort.
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                vi.useRealTimers();
            }
        });
    });
});
