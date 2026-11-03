import asyncio
import logging
import random
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from telethon.tl.types import User, Channel, InputPeerUser
from telethon import errors

from app.models.models import (
    Account, SourceChannel, TargetChannel, Member, AddJob, AddedMember,
    JobStatus, MemberAddStatus, AccountStatus
)
from app.services.telegram.client import telegram_manager
from app.core.database import AsyncSessionLocal
from app.core.config import settings

logger = logging.getLogger(__name__)


class AdderService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def start_add_job(self, job_id: int) -> Dict[str, Any]:
        """Start or resume an add job"""
        
        # Get job with relations
        stmt = select(AddJob).where(AddJob.id == job_id)
        result = await self.db.execute(stmt)
        job = result.scalar_one_or_none()
        
        if not job:
            raise ValueError(f"Job {job_id} not found")
        
        if job.status not in [JobStatus.PENDING, JobStatus.PAUSED, JobStatus.FAILED]:
            raise ValueError(f"Job {job_id} cannot be started (status: {job_status})")
        
        # Get related entities
        stmt = select(SourceChannel).where(SourceChannel.id == job.source_channel_id)
        result = await self.db.execute(stmt)
        source_channel = result.scalar_one_or_none()
        
        stmt = select(TargetChannel).where(TargetChannel.id == job.target_channel_id)
        result = await self.db.execute(stmt)
        target_channel = result.scalar_one_or_none()
        
        stmt = select(Account).where(Account.id == job.account_id)
        result = await self.db.execute(stmt)
        account = result.scalar_one_or_none()
        
        if not all([source_channel, target_channel, account]):
            raise ValueError("Missing related entities")
        
        # Check account status
        if account.status != AccountStatus.ACTIVE:
            raise ValueError(f"Account {account.phone} is not active")
        
        # Check daily limit
        if account.adds_today >= account.daily_add_limit:
            raise ValueError(f"Account {account.phone} reached daily limit")
        
        if target_channel.adds_today >= target_channel.max_per_day:
            raise ValueError(f"Target channel reached daily limit")
        
        # Update job status
        job.status = JobStatus.RUNNING
        job.started_at = job.started_at or datetime.now(timezone.utc)
        await self.db.commit()
        
        try:
            # Get target channel entity
            target_entity = await telegram_manager.get_entity(account, target_channel.channel_id)
            
            if not isinstance(target_entity, Channel):
                raise ValueError("Target is not a channel")
            
            # Get members to add
            members = await self._get_members_to_add(job)
            job.total_members = len(members)
            await self.db.commit()
            
            # Process members in batches
            return await self._process_members(job, account, target_entity, members)
            
        except errors.FloodWaitError as e:
            job.status = JobStatus.FAILED
            job.error_message = f"Flood wait: {e.seconds}s"
            account.status = AccountStatus.FLOOD_WAIT
            account.flood_wait_until = e.seconds
            await self.db.commit()
            raise
        except Exception as e:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            await self.db.commit()
            logger.error(f"Add job {job_id} failed: {e}")
            raise
    
    async def _get_members_to_add(self, job: AddJob) -> List[Member]:
        """Get members to add based on job filters"""
        stmt = select(Member).where(Member.source_channel_id == job.source_channel_id)
        
        if job.filter_usernames_only:
            stmt = stmt.where(Member.username.isnot(None))
        if job.filter_no_bots:
            stmt = stmt.where(Member.is_bot == False)
        
        # Exclude already added members
        subquery = select(AddedMember.member_id).where(
            AddedMember.job_id == job.id,
            AddedMember.status == MemberAddStatus.SUCCESS
        )
        stmt = stmt.where(Member.id.not_in(subquery))
        
        stmt = stmt.offset(job.offset).limit(job.limit or 1000)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
    
    async def _process_members(
        self,
        job: AddJob,
        account: Account,
        target_entity: Channel,
        members: List[Member]
    ) -> Dict[str, Any]:
        """Process members in batches with rate limiting"""
        
        successful = 0
        failed = 0
        flood_wait_count = 0
        
        batch_size = 10  # Process in small batches
        delay_between_adds = settings.DEFAULT_DELAY_BETWEEN_ADDS
        
        for i in range(0, len(members), batch_size):
            # Check if job was cancelled
            await self.db.refresh(job)
            if job.status == JobStatus.CANCELLED:
                break
            
            # Check daily limits
            if account.adds_today >= account.daily_add_limit:
                job.error_message = "Daily account limit reached"
                break
            
            if target_entity and hasattr(target_entity, 'adds_today'):
                # Reload target channel
                stmt = select(TargetChannel).where(TargetChannel.id == job.target_channel_id)
                result = await self.db.execute(stmt)
                target_channel = result.scalar_one()
                if target_channel.adds_today >= target_channel.max_per_day:
                    job.error_message = "Daily target channel limit reached"
                    break
            
            batch = members[i:i + batch_size]
            
            # Convert members to users for Telethon
            users = []
            for member in batch:
                if member.access_hash:
                    users.append(InputPeerUser(
                        user_id=member.user_id,
                        access_hash=member.access_hash
                    ))
                else:
                    # Try to get user entity
                    try:
                        user = await telegram_manager.get_entity(account, member.user_id)
                        users.append(user)
                    except Exception:
                        logger.warning(f"Could not resolve user {member.user_id}")
                        continue
            
            if not users:
                continue
            
            # Add users
            try:
                results = await telegram_manager.invite_to_channel(
                    account=account,
                    channel=target_entity,
                    users=users
                )
                
                # Record results
                for user_id, status in results.items():
                    # Find corresponding member
                    member = next((m for m in batch if m.user_id == user_id), None)
                    if not member:
                        continue
                    
                    added_member = AddedMember(
                        job_id=job.id,
                        member_id=member.id,
                        status=status,
                        error_message=None if status == MemberAddStatus.SUCCESS else status.value
                    )
                    self.db.add(added_member)
                    
                    if status == MemberAddStatus.SUCCESS:
                        successful += 1
                        job.successful_adds += 1
                        # Update target channel counter
                        stmt = select(TargetChannel).where(TargetChannel.id == job.target_channel_id)
                        result = await self.db.execute(stmt)
                        tc = result.scalar_one()
                        tc.adds_today += 1
                    else:
                        failed += 1
                        job.failed_adds += 1
                        if status == MemberAddStatus.FLOOD_WAIT:
                            flood_wait_count += 1
                            job.flood_wait_count += 1
                
                job.processed_members += len(batch)
                await self.db.commit()
                
            except errors.FloodWaitError as e:
                # Handle flood wait
                job.status = JobStatus.PAUSED
                job.error_message = f"Flood wait: {e.seconds}s"
                account.status = AccountStatus.FLOOD_WAIT
                account.flood_wait_until = e.seconds
                await self.db.commit()
                
                # Wait and retry
                logger.info(f"Flood wait {e.seconds}s for account {account.phone}")
                await asyncio.sleep(min(e.seconds, settings.MAX_FLOOD_WAIT))
                
                # Retry this batch
                continue
            
            except Exception as e:
                logger.error(f"Batch add failed: {e}")
                failed += len(batch)
                job.failed_adds += len(batch)
                await self.db.commit()
            
            # Rate limiting delay
            if i + batch_size < len(members):
                # Add some jitter
                delay = delay_between_adds + random.uniform(0, 5)
                await asyncio.sleep(delay)
        
        # Finalize job
        job.processed_members = successful + failed
        job.completed_at = datetime.now(timezone.utc)
        
        if job.status != JobStatus.CANCELLED:
            if successful + failed == job.total_members:
                job.status = JobStatus.COMPLETED
            elif successful > 0:
                job.status = JobStatus.COMPLETED  # Partial success
            else:
                job.status = JobStatus.FAILED
        
        await self.db.commit()
        
        return {
            "job_id": job.id,
            "status": job.status.value,
            "total": job.total_members,
            "processed": job.processed_members,
            "successful": successful,
            "failed": failed,
            "flood_waits": flood_wait_count,
        }
    
    async def pause_job(self, job_id: int) -> bool:
        """Pause a running job"""
        stmt = select(AddJob).where(AddJob.id == job_id)
        result = await self.db.execute(stmt)
        job = result.scalar_one_or_none()
        
        if job and job.status == JobStatus.RUNNING:
            job.status = JobStatus.PAUSED
            await self.db.commit()
            return True
        return False
    
    async def cancel_job(self, job_id: int) -> bool:
        """Cancel a job"""
        stmt = select(AddJob).where(AddJob.id == job_id)
        result = await self.db.execute(stmt)
        job = result.scalar_one_or_none()
        
        if job and job.status in [JobStatus.PENDING, JobStatus.RUNNING, JobStatus.PAUSED]:
            job.status = JobStatus.CANCELLED
            job.completed_at = datetime.now(timezone.utc)
            await self.db.commit()
            return True
        return False
    
    async def get_job_progress(self, job_id: int) -> Optional[Dict[str, Any]]:
        """Get job progress"""
        stmt = select(AddJob).where(AddJob.id == job_id)
        result = await self.db.execute(stmt)
        job = result.scalar_one_or_none()
        
        if not job:
            return None
        
        progress = 0.0
        if job.total_members > 0:
            progress = (job.processed_members / job.total_members) * 100
        
        return {
            "job_id": job.id,
            "status": job.status.value,
            "total_members": job.total_members,
            "processed_members": job.processed_members,
            "successful_adds": job.successful_adds,
            "failed_adds": job.failed_adds,
            "progress_percent": round(progress, 2),
            "error_message": job.error_message,
            "started_at": job.started_at,
            "completed_at": job.completed_at,
        }


async def add_members_task(job_id: int) -> Dict[str, Any]:
    """Celery task for adding members"""
    async with AsyncSessionLocal() as db:
        service = AdderService(db)
        return await service.start_add_job(job_id)


async def pause_job_task(job_id: int) -> bool:
    """Celery task to pause job"""
    async with AsyncSessionLocal() as db:
        service = AdderService(db)
        return await service.pause_job(job_id)


async def cancel_job_task(job_id: int) -> bool:
    """Celery task to cancel job"""
    async with AsyncSessionLocal() as db:
        service = AdderService(db)
        return await service.cancel_job(job_id)