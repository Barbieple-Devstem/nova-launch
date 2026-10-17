import { useState, useCallback, useEffect, useRef } from 'react';
import { IPFSService } from '../services/IPFSService';

interface UseIPFSUploadReturn {
    upload: (image: File, description: string, tokenName: string) => Promise<string>;
    uploading: boolean;
    progress: number;
    estimatedTimeMs?: number;
    error: string | null;
    reset: () => void;
}

export function useIPFSUpload(): UseIPFSUploadReturn {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [estimatedTimeMs, setEstimatedTimeMs] = useState<number | undefined>();
    const [error, setError] = useState<string | null>(null);

    // Aborted on unmount so an in-flight upload stops updating state and never
    // starts the metadata step for a component that is gone.
    const abortRef = useRef<AbortController | null>(null);
    useEffect(() => () => abortRef.current?.abort(), []);

    const upload = useCallback(async (
        image: File,
        description: string,
        tokenName: string
    ): Promise<string> => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const { signal } = controller;
        const abortError = () => new DOMException('IPFS upload aborted', 'AbortError');

        setUploading(true);
        setProgress(0);
        setError(null);
        
        const startTime = Date.now();
        const ipfsService = new IPFSService();

        try {
            // ... (rest of the try block remains mostly same but we want to ensure errors are descriptive)
            // Simulate progress for image upload (0-50%)
            setProgress(10);
            const imageUploadPromise = ipfsService.uploadImage(image);
            
            // Estimate time based on file size (rough estimate: 100KB/s)
            const estimatedMs = (image.size / 100000) * 1000;
            setEstimatedTimeMs(estimatedMs);

            const progressInterval = setInterval(() => {
                if (signal.aborted) {
                    clearInterval(progressInterval);
                    return;
                }
                setProgress(prev => {
                    if (prev < 45) return prev + 5;
                    return prev;
                });
                
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, estimatedMs - elapsed);
                setEstimatedTimeMs(remaining);
            }, 200);

            try {
                await imageUploadPromise;
            } catch (imageErr) {
                clearInterval(progressInterval);
                throw imageErr;
            }
            
            clearInterval(progressInterval);
            if (signal.aborted) throw abortError();
            setProgress(50);

            // Upload metadata (50-100%)
            setProgress(60);
            const metadataUri = await ipfsService.uploadMetadata(image, description, tokenName);
            if (signal.aborted) throw abortError();

            setProgress(100);
            setEstimatedTimeMs(0);
            
            return metadataUri;
        } catch (err) {
            if (signal.aborted) {
                throw err instanceof DOMException && err.name === 'AbortError' ? err : abortError();
            }
            let message = 'IPFS upload failed';
            if (err instanceof Error) {
                if (err.name === 'TimeoutError' || err.message.includes('timeout')) {
                    message = 'Upload timed out. Please check your connection and try again.';
                } else {
                    message = err.message;
                }
            }
            setError(message);
            throw new Error(message); // Re-throw with descriptive message
        } finally {
            if (!signal.aborted) setUploading(false);
        }
    }, []);

    const reset = useCallback(() => {
        setUploading(false);
        setProgress(0);
        setEstimatedTimeMs(undefined);
        setError(null);
    }, []);

    return {
        upload,
        uploading,
        progress,
        estimatedTimeMs,
        error,
        reset,
    };
}
