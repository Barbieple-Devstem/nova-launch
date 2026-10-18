import { useState, useCallback, useRef, useEffect } from 'react';
import type { ConfirmDialogAction, FeeItem } from '../components/UI/ConfirmDialog';

export interface ConfirmDialogOptions {
    title: string;
    message: string;
    action: ConfirmDialogAction;
    fees?: FeeItem[];
    consequences?: string[];
    confirmText?: string;
    cancelText?: string;
    requireExplicitConfirm?: boolean;
    confirmButtonVariant?: 'primary' | 'danger';
}

/**
 * Returns focus to the element that was focused before the dialog opened.
 * Deferred one frame so the dialog has unmounted (and its own focus handling
 * has run) before focus moves back; skipped if the trigger was removed or
 * disabled in the meantime, since focusing it would silently fail.
 */
function restoreFocus(element: HTMLElement | null) {
    if (!element) return;
    const schedule =
        typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
            ? window.requestAnimationFrame.bind(window)
            : (cb: () => void) => setTimeout(cb, 0);

    schedule(() => {
        if (!element.isConnected) return;
        if ((element as HTMLButtonElement).disabled) return;
        element.focus();
    });
}

export function useConfirmDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
    const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);
    // Element that had focus when `confirm()` was called — usually the trigger button.
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);

    const confirm = useCallback((opts: ConfirmDialogOptions): Promise<boolean> => {
        const active = typeof document !== 'undefined' ? document.activeElement : null;
        previouslyFocusedRef.current =
            active instanceof HTMLElement && active !== document.body ? active : null;

        setOptions(opts);
        setIsOpen(true);

        return new Promise<boolean>((resolve) => {
            setResolvePromise(() => resolve);
        });
    }, []);

    const close = useCallback((result: boolean) => {
        setIsOpen(false);
        if (resolvePromise) {
            resolvePromise(result);
            setResolvePromise(null);
        }
        const trigger = previouslyFocusedRef.current;
        previouslyFocusedRef.current = null;
        restoreFocus(trigger);
    }, [resolvePromise]);

    const handleConfirm = useCallback(() => close(true), [close]);

    const handleCancel = useCallback(() => close(false), [close]);

    // Drop the stored reference if the consumer unmounts mid-dialog.
    useEffect(() => () => {
        previouslyFocusedRef.current = null;
    }, []);

    return {
        isOpen,
        options,
        confirm,
        handleConfirm,
        handleCancel,
    };
}
