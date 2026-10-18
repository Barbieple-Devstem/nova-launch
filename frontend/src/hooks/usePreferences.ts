import { useSyncExternalStore } from 'react';
import {
  getPreferences,
  resetPreferences,
  resolveTheme,
  subscribePreferences,
  updatePreferences,
  type UserPreferences,
} from '../services/preferences';

/**
 * Read and update the persisted user preferences (theme, notifications).
 * All components using this hook share one store, so a change on the
 * settings page is reflected immediately in the theme toggle and vice versa.
 */
export function usePreferences() {
  const preferences: UserPreferences = useSyncExternalStore(
    subscribePreferences,
    getPreferences,
    getPreferences
  );

  return {
    preferences,
    resolvedTheme: resolveTheme(preferences.theme),
    updatePreferences,
    resetPreferences,
  };
}
