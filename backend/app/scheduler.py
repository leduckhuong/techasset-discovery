"""
Scheduler chạy cron job quét định kỳ bằng APScheduler.
Job được lưu trong SQLite; khi app khởi động lại sẽ nạp lại các job enabled.
"""
import logging
import threading
from datetime import datetime, timezone

log = logging.getLogger("scheduler")

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from . import config, cve_engine, db, inventory, scanner

_scheduler = BackgroundScheduler(timezone=config.SCHEDULER_TZ)
_lock = threading.Lock()


def _next_run(cron_expression: str) -> str | None:
    try:
        trigger = CronTrigger.from_crontab(cron_expression, timezone=config.SCHEDULER_TZ)
        next_fire = trigger.get_next_fire_time(None, datetime.now(trigger.timezone))
        return next_fire.isoformat() if next_fire else None
    except ValueError:
        return None


def _execute_job(job_id: str) -> dict:
    """Chạy job: quét target, lưu asset, chạy agent, cập nhật thống kê job."""
    with db.get_conn() as conn:
        row = conn.execute("SELECT * FROM cron_jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            return {"error": "Cron job not found"}
        job = db.job_row_to_dict(row)
        options = job["options"] or {}
        timeout = options.get("timeoutSec", config.SCAN_DEFAULT_TIMEOUT)
        threads = max(1, min(int(options.get("threads") or 4), config.SCAN_MAX_THREADS))
        tech_detect = options.get("techDetect", True)
        follow = options.get("followRedirects", True)
        use_nuclei = bool(options.get("nuclei"))

        targets = job["targetUrls"][: config.CRON_RUN_TARGET_LIMIT]
        conn.execute(
            "UPDATE cron_jobs SET last_run_status='running', last_run=? WHERE id=?",
            (datetime.now(timezone.utc).isoformat(), job_id),
        )

    results = scanner.scan_many(
        targets, timeout_sec=timeout, threads=threads,
        tech_detect=tech_detect, follow_redirects=follow, use_nuclei=use_nuclei,
    )

    successful = 0
    new_alerts = 0
    with db.get_conn() as conn:
        for res in results:
            if res.get("statusCode", 0) > 0:
                successful += 1
            inventory.upsert_asset(conn, res)
        alerts_before = conn.execute("SELECT COUNT(*) c FROM cve_alerts").fetchone()["c"]
        cve_engine.run_agent(conn)
        alerts_after = conn.execute("SELECT COUNT(*) c FROM cve_alerts").fetchone()["c"]
        new_alerts = max(0, alerts_after - alerts_before)
        next_run = _next_run(_cron_expr(conn, job_id))
        conn.execute(
            """UPDATE cron_jobs SET last_run_status='success',
               last_discovered_count=?, total_runs=total_runs+1, next_run=? WHERE id=?""",
            (successful, next_run, job_id),
        )
        job = db.job_row_to_dict(
            conn.execute("SELECT * FROM cron_jobs WHERE id = ?", (job_id,)).fetchone()
        )

    if new_alerts:
        log.info("job '%s': %d service, %d CVE alert mới", job["name"], successful, new_alerts)

    log.info("job '%s' xong: %d/%d target OK | %d alert", job["name"], successful, len(targets), alerts_after)
    return {"job": job, "executedTargets": len(targets), "results": results}


def _cron_expr(conn, job_id: str) -> str:
    row = conn.execute("SELECT cron_expression FROM cron_jobs WHERE id=?", (job_id,)).fetchone()
    return row["cron_expression"] if row else "* * * * *"


def execute_job_sync(job_id: str) -> dict:
    """Chạy job synchronously (dùng cho POST /api/cron-jobs/{id}/run của UI)."""
    return _execute_job(job_id)


def next_run_for(cron_expression: str) -> str | None:
    return _next_run(cron_expression)


def refresh() -> None:
    """Nạp lại toàn bộ job enabled vào scheduler (gọi sau create/update/delete)."""
    with _lock:
        _scheduler.remove_all_jobs()
        with db.get_conn() as conn:
            rows = conn.execute("SELECT * FROM cron_jobs WHERE enabled = 1").fetchall()
            for row in rows:
                job = db.job_row_to_dict(row)
                try:
                    trigger = CronTrigger.from_crontab(
                        job["cronExpression"], timezone=config.SCHEDULER_TZ
                    )
                except ValueError:
                    continue
                _scheduler.add_job(
                    _execute_job, trigger, args=[job["id"]],
                    id=job["id"], name=job["name"],
                    max_instances=1, coalesce=True, misfire_grace_time=300,
                )
                conn.execute(
                    "UPDATE cron_jobs SET next_run=? WHERE id=?",
                    (_next_run(job["cronExpression"]), job["id"]),
                )


def start() -> None:
    _scheduler.start()
    refresh()


def shutdown() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
