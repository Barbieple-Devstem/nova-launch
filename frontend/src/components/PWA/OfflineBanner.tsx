import { usePWA } from "../../hooks/usePWA";

/**
 * In-app offline fallback. Shown while the browser reports no connection so
 * users know why data isn't loading and that transactions can't be submitted.
 * Full-page navigations while offline are served /offline.html by the
 * service worker instead.
 */
export function PWAOfflineBanner() {
  const { isOnline } = usePWA();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="pwa-offline-banner"
      className="fixed top-0 inset-x-0 z-50 bg-gray-900 text-white text-sm px-4 py-2 flex items-center justify-center gap-3"
    >
      <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
      <span>
        You're offline. Showing cached content; wallet actions and
        transactions are unavailable until you reconnect.
      </span>
    </div>
  );
}
