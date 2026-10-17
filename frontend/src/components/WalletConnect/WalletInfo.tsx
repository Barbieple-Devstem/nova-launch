import { useState, useEffect, useCallback } from "react";
import { Button, Tooltip } from "../UI";
import { WalletService } from "../../services/wallet";
import { formatXLM } from "../../utils/formatting";
import { AddressDisplay } from "../UI/AddressDisplay";
import type { WalletState } from "../../types";

interface WalletInfoProps {
    wallet: WalletState;
    onDisconnect: () => void;
    className?: string;
}

export function WalletInfo({ wallet, onDisconnect, className = "" }: WalletInfoProps) {
    const [balance, setBalance] = useState<string | null>(null);
    const [isLoadingBalance, setIsLoadingBalance] = useState(false);
    const [balanceError, setBalanceError] = useState<string | null>(null);
    const [bannerDismissed, setBannerDismissed] = useState(false);

    const appNetwork = import.meta.env.VITE_NETWORK as string | undefined;
    const walletNetwork = wallet.network;
    const showMismatchBanner =
        !bannerDismissed &&
        !!appNetwork &&
        !!walletNetwork &&
        appNetwork.toLowerCase() !== walletNetwork.toLowerCase();

    const fetchBalance = useCallback(async () => {
        if (!wallet.address) return;
        setIsLoadingBalance(true);
        setBalanceError(null);
        try {
            const bal = await WalletService.getBalance(wallet.address);
            setBalance(bal);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to fetch balance";
            setBalanceError(message);
            setBalance(null);
        } finally {
            setIsLoadingBalance(false);
        }
    }, [wallet.address]);

    useEffect(() => {
        fetchBalance();
        const interval = setInterval(fetchBalance, 30_000);
        return () => clearInterval(interval);
    }, [fetchBalance]);

    if (!wallet.connected || !wallet.address) {
        return null;
    }

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {showMismatchBanner && (
                <div
                    role="alert"
                    aria-live="polite"
                    className="flex items-start justify-between gap-2 rounded-lg bg-yellow-50 border border-yellow-400 text-yellow-800 px-3 py-2 text-sm"
                >
                    <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <span>
                            Your wallet is connected to <strong>{walletNetwork}</strong> but this app is configured for <strong>{appNetwork}</strong>. Please switch networks in your wallet before continuing.
                        </span>
                    </div>
                    <button
                        onClick={() => setBannerDismissed(true)}
                        className="flex-shrink-0 p-0.5 rounded hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        aria-label="Dismiss network mismatch warning"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            <div
                className="flex items-center gap-2 rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200 px-3 py-2 shadow-sm"
                role="region"
                aria-label="Wallet information"
            >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 013 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 013 6v3" />
                    </svg>
                </div>

                <div className="flex flex-col min-w-0">
                    {wallet.walletType && (
                        <p className="text-xs text-blue-600 font-medium capitalize mb-0.5">
                            {wallet.walletType}
                        </p>
                    )}
                    <div className="flex items-center gap-1">
                        <AddressDisplay
                            address={wallet.address}
                            network={wallet.network}
                            type="account"
                            className="text-sm font-medium text-gray-800"
                        />
                    </div>

                    <div className="text-xs text-gray-500">
                        {isLoadingBalance ? (
                            <span className="inline-flex items-center gap-1">
                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Loading...
                            </span>
                        ) : balanceError ? (
                            <Tooltip content={balanceError} position="bottom">
                                <button
                                    onClick={fetchBalance}
                                    className="text-amber-600 hover:text-amber-700 underline decoration-dotted cursor-pointer"
                                    aria-label="Balance unavailable, click to retry"
                                >
                                    Balance unavailable
                                </button>
                            </Tooltip>
                        ) : balance !== null ? (
                            <span aria-label={`Balance: ${formatXLM(balance)} XLM`}>
                                {formatXLM(balance)} <span className="text-gray-400 font-medium">XLM</span>
                            </span>
                        ) : null}
                    </div>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onDisconnect}
                    className="ml-1 flex-shrink-0 !border-gray-200 !text-gray-500 hover:!text-red-600 hover:!border-red-200 hover:!bg-red-50"
                    aria-label="Disconnect wallet"
                >
                    <svg className="w-4 h-4 sm:mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    <span className="hidden sm:inline">Disconnect</span>
                </Button>
            </div>
        </div>
    );
}
