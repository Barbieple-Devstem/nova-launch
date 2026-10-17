import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '../components/LanguageSelector';
import { usePreferences } from '../hooks/usePreferences';
import { useBurnNotificationPrefs } from '../components/BurnToken/useBurnNotificationPrefs';
import type { NotificationPreferences, ThemePreference } from '../services/preferences';

type Network = 'testnet' | 'mainnet';

interface SettingsPageProps {
  /** The app's live network, so changes apply immediately and persist. */
  network: Network;
  onNetworkChange: (network: Network) => void;
}

const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];
const NETWORK_OPTIONS: Network[] = ['testnet', 'mainnet'];
const NOTIFICATION_OPTIONS: Array<keyof NotificationPreferences> = [
  'transactions',
  'governance',
  'campaigns',
];

function Section({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-card border border-border-medium bg-background-card p-6">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      <p className="mt-1 mb-4 text-sm text-text-secondary">{description}</p>
      {children}
    </section>
  );
}

function SegmentedControl<T extends string>({ name, value, options, label, onChange }: {
  name: string;
  value: T;
  options: T[];
  label: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <div role="radiogroup" className="inline-flex flex-wrap gap-2">
      {options.map((option) => (
        <label
          key={option}
          className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            value === option
              ? 'border-primary bg-primary/15 text-primary'
              : 'border-border-medium text-text-secondary hover:text-text-primary'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            className="sr-only"
          />
          {label(option)}
        </label>
      ))}
    </div>
  );
}

function Toggle({ id, label, description, checked, onChange }: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <label htmlFor={id} className="font-medium text-text-primary">{label}</label>
        <p className="text-sm text-text-muted">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-border-medium border border-border-medium'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

/**
 * Central place for language, theme, default network and notification
 * preferences. Every change is saved immediately.
 */
export default function SettingsPage({ network, onNetworkChange }: SettingsPageProps) {
  const { t } = useTranslation();
  const { preferences, updatePreferences, resetPreferences } = usePreferences();
  const { enabled: burnAlerts, setEnabled: setBurnAlerts } = useBurnNotificationPrefs();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">{t('settings.title')}</h1>
        <p className="mt-1 text-text-secondary">{t('settings.subtitle')}</p>
      </header>

      <Section title={t('settings.language.title')} description={t('settings.language.description')}>
        <LanguageSelector variant="inline" />
      </Section>

      <Section title={t('settings.theme.title')} description={t('settings.theme.description')}>
        <SegmentedControl
          name="theme"
          value={preferences.theme}
          options={THEME_OPTIONS}
          label={(option) => t(`settings.theme.${option}`)}
          onChange={(theme) => updatePreferences({ theme })}
        />
      </Section>

      <Section title={t('settings.network.title')} description={t('settings.network.description')}>
        <SegmentedControl
          name="network"
          value={network}
          options={NETWORK_OPTIONS}
          label={(option) => t(`settings.network.${option}`)}
          onChange={onNetworkChange}
        />
        {network === 'mainnet' && (
          <p className="mt-3 text-sm text-amber-500" role="note">
            {t('settings.network.mainnetWarning')}
          </p>
        )}
      </Section>

      <Section title={t('settings.notifications.title')} description={t('settings.notifications.description')}>
        <div className="divide-y divide-border-subtle">
          {NOTIFICATION_OPTIONS.map((key) => (
            <Toggle
              key={key}
              id={`notify-${key}`}
              label={t(`settings.notifications.${key}.label`)}
              description={t(`settings.notifications.${key}.description`)}
              checked={preferences.notifications[key]}
              onChange={(checked) => updatePreferences({ notifications: { [key]: checked } })}
            />
          ))}
          <Toggle
            id="notify-burns"
            label={t('settings.notifications.burns.label')}
            description={t('settings.notifications.burns.description')}
            checked={burnAlerts}
            onChange={setBurnAlerts}
          />
        </div>
      </Section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={resetPreferences}
          className="text-sm text-text-secondary underline hover:text-text-primary"
        >
          {t('settings.reset')}
        </button>
      </div>
    </div>
  );
}
