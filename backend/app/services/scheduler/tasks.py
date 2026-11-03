from celery import shared_task
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
import asyncio
import logging

from app.core.database import AsyncSessionLocal
from app.core.celery_app import celery_app
from app.models.models import Account, AccountStatus, AddJob, JobStatus, TargetChannel
from app.services.adder.service import add_members_task

logger = logging.getLogger(__name__)


@shared_task
def check_pending_jobs():
    """Check for pending jobs and start them"""
    return asyncio.run(_check_pending_jobs())


async def _check_pending_jobs():
    async with AsyncSessionLocal() as db:
        # Find pending jobs that can be started
        stmt = select(AddJob).where(
            AddJob.status == JobStatus.PENDING
        ).order_by(AddJob.created_at)
        result = await db.execute(stmt)
        jobs = result.scalars().all()
        
        for job in jobs:
            # Check if account is available
            stmt = select(Account).where(Account.id == job.account_id)
            result = await db.execute(stmt)
            account = result.scalar_one_or_none()
            
            if not account:
                continue
            
            # Check account status
            if account.status != AccountStatus.ACTIVE:
                continue
            
            # Check daily limit
            if account.adds_today >= account.daily_add_limit:
                continue
            
            # Check target channel limit
            stmt = select(TargetChannel).where(TargetChannel.id == job.target_channel_id)
            result = await db.execute(stmt)
            target = result.scalar_one_or_none()
            
            if not target or target.adds_today >= target.max_per_day:
                continue
            
            # Start job
            add_members_celery.delay(job.id)
            logger.info(f"Started job {job.id}")


@shared_task
def cleanup_old_sessions():
    """Cleanup old sessions and reset daily counters"""
    return asyncio.run(_cleanup_old_sessions())


async def _cleanup_old_sessions():
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        
        # Reset daily counters for accounts
        stmt = select(Account).where(
            and_(
                Account.last_add_reset < now - timedelta(days=1),
                Account.adds_today > 0
            )
        )
        result = await db.execute(stmt)
        accounts = result.scalars().all()
        
        for account in accounts:
            account.adds_today = 0
            account.last_add_reset = now
            if account.status == AccountStatus.FLOOD_WAIT and account.flood_wait_until:
                if account.flood_wait_until < now:
                    account.status = AccountStatus.ACTIVE
                    account.flood_wait_until = None
        
        # Reset daily counters for target channels
        stmt = select(TargetChannel).where(
            and_(
                TargetChannel.last_add_reset < now - timedelta(days=1),
                TargetChannel.adds_today > 0
            )
        )
        result = await db.execute(stmt)
        targets = result.scalars().all()
        
        for target in targets:
            target.adds_today = 0
            target.last_add_reset = now
        
        await db.commit()
        logger.info(f"Reset daily counters for {len(accounts)} accounts and {len(targets)} target channels")


@shared_task
def monitor_flood_waits():
    """Monitor accounts in flood wait and reactivate when ready"""
    return asyncio.run(_monitor_flood_waits())


async def _monitor_flood_waits():
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        
        stmt = select(Account).where(
            and_(
                Account.status == AccountStatus.FLOOD_WAIT,
                Account.flood_wait_until.isnot(None),
                Account.flood_wait_until <= now
            )
        )
        result = await db.execute(stmt)
        accounts = result.scalars().all()
        
        for account in accounts:
            account.status = AccountStatus.ACTIVE
            account.flood_wait_until = None
            logger.info(f"Account {account.phone} recovered from flood wait")
        
        await db.commit()