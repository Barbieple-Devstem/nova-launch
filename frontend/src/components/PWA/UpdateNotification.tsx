import { useCallback, useState } from "react";
import { usePWA } from "../../hooks/usePWA";

/**
 * Prompts the user when a new service worker version is waiting. The app is
 * only reloaded when the user clicks "Reload"; "Later" hides the prompt until
 * another update arrives.
 */
export function PWAUpdateNotification() {
  const { updateAvailable, updateDismissed, reloadApp, dismissUpdate } = usePWA();
  const [reloading, setReloading] = useState(false);

  const handleReload = useCallback(async () => {
    setReloading(true);
    try {
      await reloadApp();
    } catch {
      setReloading(false);
    }
  }, [reloadApp]);

  if (!updateAvailable || updateDismissed) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 bg-blue-50 border border-blue-200 rounded-lg shadow-lg p-4 max-w-sm z-50"
      role="alert"
      aria-live="polite"
      data-testid="pwa-update-notification"
    >
      <h3 className="font-semibold text-blue-900">Update available</h3>
      <p className="text-sm text-blue-700 mt-1">
        A new version of Nova Launch is ready. Reload to get the latest
        features. Any unsaved form input on this page will be lost.
      </p>
      <div className="flex justify-end gap-3 mt-3">
        <button
          type="button"
          onClick={dismissUpdate}
          className="text-sm text-blue-700 hover:text-blue-900"
          data-testid="pwa-update-later"
        >
          Later
        </button>
        <button
          type="button"
          onClick={handleReload}
          disabled={reloading}
          className="text-sm font-medium bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700 disabled:opacity-60"
          aria-label="Reload app to apply update"
          data-testid="pwa-update-reload"
        >
          {reloading ? "Reloading…" : "Reload"}
        </button>
      </div>
    </div>
  );
}
