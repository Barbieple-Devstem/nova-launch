# Notification preferences (#2221)

Administrators can manage per-user channel preferences:

- `GET /api/admin/users/:id/notification-preferences`
- `PUT /api/admin/users/:id/notification-preferences`

The PUT body must contain boolean `emailEnabled`, `smsEnabled`, and `webhookEnabled` fields. Invalid or unknown values receive the existing `VALIDATION_ERROR` response shape. Notification-producing callers may set `NotificationRequest.userId`; the notification service then suppresses disabled channels. Requests without `userId` preserve the existing system-notification behavior.

Preference rows default all channels to enabled. Missing rows are treated as enabled, so existing users and legacy sends are backward compatible. A transient preference read failure fails open and emits a warning rather than silently dropping a notification. Storage is the `NotificationPreference` Prisma model, linked one-to-one to `User`.
