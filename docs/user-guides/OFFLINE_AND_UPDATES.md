# Offline Use and App Updates

Nova Launch is a Progressive Web App (PWA). It can be installed on your device and keeps working partly when your connection drops.

## When you go offline

- **Inside the app:** a banner at the top of the screen says you're offline. Cached pages and data stay visible, but wallet actions and transactions are unavailable until you reconnect.
- **Opening a page you haven't visited:** the service worker shows an offline page. It reloads automatically when your connection returns, or you can press **Try Again**. It only reloads once the server is actually reachable, so it won't bounce back and forth on a flaky connection.

## When a new version is available

When a new version has been downloaded in the background, an **Update available** prompt appears in the bottom-right corner.

- **Reload** applies the update and reloads the page. Any unsaved form input on the page will be lost.
- **Later** hides the prompt. The update is applied the next time all Nova Launch tabs are closed, or the prompt reappears if a newer version arrives.

The app never reloads by itself to apply an update.

## For developers

- `frontend/public/sw.js`: caching strategy and offline fallback (`/offline.html`). Bump `CACHE_NAME` when cached shell files change.
- `frontend/src/services/pwa.ts`: registration, update detection, `acceptUpdate()` and `reloadApp()`. The `controllerchange` reload only fires after the user accepts an update.
- `frontend/src/hooks/usePWA.ts`: exposes `isOnline`, `updateAvailable`, `updateDismissed`, `reloadApp()`, `dismissUpdate()`, `acceptUpdate()`, `showInstallPrompt()`.
- `frontend/src/components/PWA/`: `PWAOfflineBanner`, `PWAUpdateNotification`, `PWAInstallButton`, `PWAConnectionStatus`.
