# Job queue operations (#2219, #2220)

`GET /api/admin/jobs/metrics` returns pending depth grouped by priority, oldest pending age, and stuck-job summaries. The same signals are emitted through the Prometheus registry used by `/metrics`:

- `job_queue_depth_by_priority{priority}`
- `job_queue_oldest_age_seconds`
- `job_queue_attempts{job_type}`
- `job_queue_stuck_jobs{priority}`
- `job_queue_stuck_total{job_type}`

Jobs retain the existing default priority `0`. Higher priorities are selected first, with `JOB_QUEUE_FAIRNESS_STREAK` (default `5`) limiting consecutive high-priority selections while an eligible lower-priority job is waiting. This prevents starvation without changing existing enqueue callers.

Jobs are flagged when their age since enqueue reaches `JOB_QUEUE_STUCK_THRESHOLD_MS` (default 15 minutes). Detection occurs during queue metric refresh and emits a structured `job_queue_job_stuck` warning containing id, type, priority, attempts, age, status, and threshold. The queue's existing `attempts` field and new `lastAttemptAt` field are included in dashboard summaries.
