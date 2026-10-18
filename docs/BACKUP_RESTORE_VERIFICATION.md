# Backup Restore Verification

Backup creation and restore verification are separate operations. A successful `pg_basebackup` confirms that PostgreSQL produced a backup artifact; it does not prove that the artifact can be restored or that the restored data is complete.

## Runtime expectations

The verification suite creates a backup fixture, restores it into an isolated scratch directory, and compares the restored file count, byte count, and deterministic SHA-256 manifest checksum with the source. It also mutates a restored file and asserts that the checksum comparison fails.

Production restore verification must use a disposable PostgreSQL instance or an isolated data directory. Never point a verification run at the live `PGDATA` directory. The restore script is destructive when `--dry-run` is not supplied and requires an explicit `yes` confirmation.

A real PITR verification requires:

- PostgreSQL client and server tooling (`pg_basebackup`, `pg_ctl`/`pg_ctlcluster`, `psql`, and `pg_restore`/`tar` as applicable).
- A writable `BACKUP_STORAGE_PATH` with enough space for the base backup plus scratch restore.
- A valid `DATABASE_URL` and a configured WAL archive.
- An isolated `PGDATA` path for the scratch instance.
- A recovery target within the retained base-backup and WAL window.

The test suite does not contact production databases. It is safe to run in CI because its scratch fixtures are created below the operating-system temporary directory and removed after each case.

## Nightly execution

The `backup-restore-nightly` workflow runs the backend backup verification and event-contract suites on a schedule. It can also be started manually. A failure indicates that restore verification, checksum comparison, or one of the associated test contracts needs investigation; it does not automatically restore or modify a production database.

## Adding a new backup table

When a table becomes part of the backup integrity surface, add a representative record to the scratch fixture and include the table in the count/snapshot assertions. Keep values deterministic so checksum failures identify real content drift rather than timestamps or generated IDs.
