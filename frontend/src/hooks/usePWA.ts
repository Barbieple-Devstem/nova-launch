import { useCallback, useEffect, useState } from "react";
import {
  acceptUpdate as acceptServiceWorkerUpdate,
  isInstalledPWA,
  isUpdateAvailable,
  reloadApp as reloadPwaApp,
  showInstallPrompt as showPwaInstallPrompt,
} from "../services/pwa";

interface PWAState {
  updateAvailable: boolean;
  /** True when the user chose "Later" on the current update prompt */
  updateDismissed: boolean;
  installPromptAvailable: boolean;
  isInstalled: boolean;
  isOnline: boolean;
}

/**
 * Hook to manage PWA state and updates
 */
export function usePWA(): PWAState & {
  acceptUpdate: () => Promise<boolean>;
  reloadApp: () => Promise<void>;
  dismissUpdate: () => void;
  showInstallPrompt: () => Promise<boolean>;
} {
  const [state, setState] = useState<PWAState>({
    updateAvailable: isUpdateAvailable(),
    updateDismissed: false,
    installPromptAvailable: false,
    isInstalled: isInstalledPWA(),
    isOnline: navigator.onLine,
  });

  useEffect(() => {
    // Listen for SW update available
    const handleUpdateAvailable = () => {
      setState((prev) => ({
        ...prev,
        updateAvailable: true,
        // A newer version arriving re-surfaces the prompt
        updateDismissed: false,
      }));
    };

    // Listen for install prompt available
    const handleInstallPromptAvailable = () => {
      setState((prev) => ({
        ...prev,
        installPromptAvailable: true,
      }));
    };

    // Handle online/offline events
    const handleOnline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: true,
      }));
    };

    const handleOffline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: false,
      }));
    };

    window.addEventListener("sw-update-available", handleUpdateAvailable);
    window.addEventListener(
      "install-prompt-available",
      handleInstallPromptAvailable,
    );
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleAppInstalled = () => {
      setState((prev) => ({
        ...prev,
        isInstalled: true,
        installPromptAvailable: false,
      }));
    };

    window.addEventListener("app-installed", handleAppInstalled);

    return () => {
      window.removeEventListener("sw-update-available", handleUpdateAvailable);
      window.removeEventListener(
        "install-prompt-available",
        handleInstallPromptAvailable,
      );
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("app-installed", handleAppInstalled);
    };
  }, []);

  const acceptUpdate = useCallback(async (): Promise<boolean> => {
    return acceptServiceWorkerUpdate();
  }, []);

  const reloadApp = useCallback(async (): Promise<void> => {
    await reloadPwaApp();
  }, []);

  const dismissUpdate = useCallback(() => {
    setState((prev) => ({ ...prev, updateDismissed: true }));
  }, []);

  const showInstallPrompt = async (): Promise<boolean> => {
    const installed = await showPwaInstallPrompt();
    if (installed) {
      setState((prev) => ({
        ...prev,
        isInstalled: true,
        installPromptAvailable: false,
      }));
    }
    return installed;
  };

  return {
    ...state,
    acceptUpdate,
    reloadApp,
    dismissUpdate,
    showInstallPrompt,
  };
}
