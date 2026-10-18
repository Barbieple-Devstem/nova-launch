/**
 * User preferences store.
 *
 * Holds the preferences that have no other owner: theme and notification
 * toggles. Language is owned by i18next (`nova_language`) and the default
 * network by useNetwork (`nova_network_preference`); the settings page reads
 * and writes those through their existing APIs instead of duplicating them.
 *
 * Everything read back from localStorage is validated field by field, so a
 * corrupted, outdated, or hand-edited value falls back to the default for that
 * field rather than breaking the app.
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface NotificationPreferences {
  /** Toasts when a submitted transaction confirms or fails. */
  transactions: boolean;
  /** Alerts for new proposals and votes on governance pages. */
  governance: boolean;
  /** Updates about campaigns the user participates in. */
  campaigns: boolean;
}

export interface UserPreferences {
  theme: ThemePreference;
  notifications: NotificationPreferences;
}

export const PREFERENCES_STORAGE_KEY = 'nova_preferences';

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  notifications: {
    transactions: true,
    governance: true,
    campaigns: true,
  },
};

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Coerce arbitrary (possibly untrusted) data into a valid preferences object. */
export function sanitizePreferences(raw: unknown): UserPreferences {
  const source = isRecord(raw) ? raw : {};
  const notifications = isRecord(source.notifications) ? source.notifications : {};
  const defaults = DEFAULT_PREFERENCES.notifications;

  const bool = (value: unknown, fallback: boolean) =>
    typeof value === 'boolean' ? value : fallback;

  return {
    theme: THEMES.includes(source.theme as ThemePreference)
      ? (source.theme as ThemePreference)
      : DEFAULT_PREFERENCES.theme,
    notifications: {
      transactions: bool(notifications.transactions, defaults.transactions),
      governance: bool(notifications.governance, defaults.governance),
      campaigns: bool(notifications.campaigns, defaults.campaigns),
    },
  };
}

export function loadPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (stored) return sanitizePreferences(JSON.parse(stored));
  } catch {
    // localStorage unavailable or value is not valid JSON
  }
  return sanitizePreferences(undefined);
}

function persist(preferences: UserPreferences): void {
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to save preferences:', error);
  }
}

// ── Shared store (consumed via useSyncExternalStore) ─────────────────────────

let current: UserPreferences = loadPreferences();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getPreferences(): UserPreferences {
  return current;
}

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updatePreferences(
  patch: Partial<Omit<UserPreferences, 'notifications'>> & {
    notifications?: Partial<NotificationPreferences>;
  }
): void {
  current = sanitizePreferences({
    ...current,
    ...patch,
    notifications: { ...current.notifications, ...patch.notifications },
  });
  persist(current);
  applyTheme(current.theme);
  emit();
}

export function resetPreferences(): void {
  current = sanitizePreferences(undefined);
  persist(current);
  applyTheme(current.theme);
  emit();
}

// Keep tabs in sync when preferences change in another window.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== PREFERENCES_STORAGE_KEY) return;
    current = loadPreferences();
    applyTheme(current.theme);
    emit();
  });
}

// ── Theme ─────────────────────────────────────────────────────────────────────

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(theme: ThemePreference): ResolvedTheme {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/** Stamp the resolved theme on <html> so the CSS tokens in index.css switch. */
export function applyTheme(theme: ThemePreference = current.theme): void {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(theme);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

// Follow OS changes while the preference is "system".
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia(DARK_QUERY).addEventListener?.('change', () => {
    if (current.theme === 'system') {
      applyTheme('system');
      // New reference so useSyncExternalStore subscribers re-render and
      // recompute the resolved theme.
      current = { ...current };
      emit();
    }
  });
}
