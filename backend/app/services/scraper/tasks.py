from celery import shared_task
from app.services.scraper.service import scrape_channel_task
import asyncio


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def scrape_channel_celery(
    self,
    source_channel_id: int,
    account_id: int = None,
    limit: int = None,
    offset: int = 0,
    filter_usernames_only: bool = False,
    filter_recent_activity: bool = False,
):
    """Celery task to scrape channel members"""
    try:
        result = asyncio.run(scrape_channel_task(
            source_channel_id=source_channel_id,
            account_id=account_id,
            limit=limit,
            offset=offset,
            filter_usernames_only=filter_usernames_only,
            filter_recent_activity=filter_recent_activity,
        ))
        return result
    except Exception as exc:
        logger.error(f"Scraping task failed: {exc}")
        raise self.retry(exc=exc)


# Import logger after to avoid circular import
import logging
logger = logging.getLogger(__name__)