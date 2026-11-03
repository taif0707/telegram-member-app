from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "telegram_member_manager",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.services.scraper.tasks",
        "app.services.adder.tasks",
        "app.services.scheduler.tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    task_soft_time_limit=3000,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,
    beat_schedule={
        "check-pending-jobs": {
            "task": "app.services.scheduler.tasks.check_pending_jobs",
            "schedule": 60.0,  # Every minute
        },
        "cleanup-old-sessions": {
            "task": "app.services.scheduler.tasks.cleanup_old_sessions",
            "schedule": 3600.0,  # Every hour
        },
    },
)

celery_app.autodiscover_tasks()