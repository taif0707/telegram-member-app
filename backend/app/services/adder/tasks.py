from celery import shared_task
from app.services.adder.service import add_members_task, pause_job_task, cancel_job_task
import asyncio
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=120)
def add_members_celery(self, job_id: int):
    """Celery task to add members to channel"""
    try:
        result = asyncio.run(add_members_task(job_id))
        return result
    except Exception as exc:
        logger.error(f"Add members task failed for job {job_id}: {exc}")
        # Don't retry on flood wait - let the service handle it
        if "Flood wait" in str(exc):
            return {"status": "flood_wait", "error": str(exc)}
        raise self.retry(exc=exc)


@shared_task
def pause_job_celery(job_id: int):
    """Celery task to pause job"""
    return asyncio.run(pause_job_task(job_id))


@shared_task
def cancel_job_celery(job_id: int):
    """Celery task to cancel job"""
    return asyncio.run(cancel_job_task(job_id))