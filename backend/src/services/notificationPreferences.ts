import { prisma } from "../lib/prisma";

export interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  webhookEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  smsEnabled: true,
  webhookEnabled: true,
};

const preferenceModel = () => (prisma as any).notificationPreference;

/** Reads preferences, failing open so legacy users and temporary DB outages retain delivery. */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  try {
    const row = await preferenceModel().findUnique({ where: { userId } });
    return {
      emailEnabled: row?.emailEnabled ?? true,
      smsEnabled: row?.smsEnabled ?? true,
      webhookEnabled: row?.webhookEnabled ?? true,
    };
  } catch (error) {
    console.warn(JSON.stringify({
      level: "warn",
      message: "notification_preferences_read_failed_open",
      userId,
      error: error instanceof Error ? error.message : String(error),
    }));
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

export async function upsertNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences
): Promise<NotificationPreferences> {
  const row = await preferenceModel().upsert({
    where: { userId },
    create: { userId, ...preferences },
    update: preferences,
  });
  return {
    emailEnabled: row.emailEnabled,
    smsEnabled: row.smsEnabled,
    webhookEnabled: row.webhookEnabled,
  };
}

export function isNotificationChannelEnabled(
  preferences: NotificationPreferences,
  channel: "EMAIL" | "SMS" | "WEBHOOK"
): boolean {
  if (channel === "EMAIL") return preferences.emailEnabled;
  if (channel === "SMS") return preferences.smsEnabled;
  return preferences.webhookEnabled;
}
