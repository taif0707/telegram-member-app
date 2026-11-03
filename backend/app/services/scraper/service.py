import asyncio
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from telethon.tl.types import User, Channel

from app.models.models import (
    Account, SourceChannel, Member, AccountStatus, Proxy
)
from app.services.telegram.client import telegram_manager
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


class ScraperService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def scrape_channel(
        self,
        source_channel_id: int,
        account_id: Optional[int] = None,
        limit: Optional[int] = None,
        offset: int = 0,
        filter_usernames_only: bool = False,
        filter_recent_activity: bool = False,
    ) -> Dict[str, Any]:
        """Scrape members from a source channel"""
        
        # Get source channel
        stmt = select(SourceChannel).where(SourceChannel.id == source_channel_id)
        result = await self.db.execute(stmt)
        source_channel = result.scalar_one_or_none()
        
        if not source_channel:
            raise ValueError(f"Source channel {source_channel_id} not found")
        
        # Get account
        if account_id:
            stmt = select(Account).where(Account.id == account_id)
        else:
            stmt = select(Account).where(Account.id == source_channel.account_id)
        result = await self.db.execute(stmt)
        account = result.scalar_one_or_none()
        
        if not account:
            raise ValueError(f"Account not found")
        
        if account.status != AccountStatus.ACTIVE:
            raise ValueError(f"Account {account.phone} is not active (status: {account.status})")
        
        try:
            # Get Telegram entity
            channel_entity = await telegram_manager.get_entity(account, source_channel.channel_id)
            
            if not isinstance(channel_entity, Channel):
                raise ValueError("Entity is not a channel")
            
            # Scrape participants
            participants = await telegram_manager.get_participants(
                account=account,
                channel=channel_entity,
                limit=limit,
                offset=offset,
                filter_usernames_only=filter_usernames_only,
                filter_recent=filter_recent_activity,
            )
            
            # Save members to database
            saved_count = 0
            skipped_count = 0
            
            for user in participants:
                if not isinstance(user, User):
                    continue
                
                # Check if already exists
                stmt = select(Member).where(
                    Member.user_id == user.id,
                    Member.source_channel_id == source_channel_id
                )
                result = await self.db.execute(stmt)
                existing = result.scalar_one_or_none()
                
                if existing:
                    skipped_count += 1
                    continue
                
                member = Member(
                    user_id=user.id,
                    access_hash=user.access_hash,
                    username=user.username,
                    first_name=user.first_name,
                    last_name=user.last_name,
                    phone=user.phone,
                    is_bot=user.bot,
                    is_verified=user.verified,
                    is_premium=getattr(user, 'premium', False),
                    status=self._get_user_status_string(user),
                    source_channel_id=source_channel_id,
                )
                
                self.db.add(member)
                saved_count += 1
            
            # Update source channel stats
            source_channel.total_members = await self._count_channel_members(source_channel_id)
            source_channel.last_scraped_at = datetime.now(timezone.utc)
            
            await self.db.commit()
            
            return {
                "success": True,
                "scraped": saved_count,
                "skipped": skipped_count,
                "total_in_channel": source_channel.total_members,
            }
            
        except Exception as e:
            logger.error(f"Scraping failed: {e}")
            await self.db.rollback()
            raise
    
    def _get_user_status_string(self, user: User) -> str:
        """Convert user status to string"""
        from telethon.tl.types import (
            UserStatusOnline, UserStatusOffline, UserStatusRecently,
            UserStatusLastWeek, UserStatusLastMonth
        )
        
        if isinstance(user.status, UserStatusOnline):
            return "online"
        elif isinstance(user.status, UserStatusOffline):
            return "offline"
        elif isinstance(user.status, UserStatusRecently):
            return "recently"
        elif isinstance(user.status, UserStatusLastWeek):
            return "last_week"
        elif isinstance(user.status, UserStatusLastMonth):
            return "last_month"
        return "unknown"
    
    async def _count_channel_members(self, source_channel_id: int) -> int:
        """Count total members in channel"""
        stmt = select(func.count(Member.id)).where(Member.source_channel_id == source_channel_id)
        result = await self.db.execute(stmt)
        return result.scalar() or 0
    
    async def get_members(
        self,
        source_channel_id: int,
        limit: int = 100,
        offset: int = 0,
        username_only: bool = False,
        not_bots: bool = True,
    ) -> List[Member]:
        """Get scraped members with filters"""
        stmt = select(Member).where(Member.source_channel_id == source_channel_id)
        
        if username_only:
            stmt = stmt.where(Member.username.isnot(None))
        if not_bots:
            stmt = stmt.where(Member.is_bot == False)
        
        stmt = stmt.offset(offset).limit(limit).order_by(Member.scraped_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
    
    async def get_members_count(self, source_channel_id: int) -> int:
        """Get total scraped members count"""
        stmt = select(func.count(Member.id)).where(Member.source_channel_id == source_channel_id)
        result = await self.db.execute(stmt)
        return result.scalar() or 0


async def scrape_channel_task(
    source_channel_id: int,
    account_id: Optional[int] = None,
    limit: Optional[int] = None,
    offset: int = 0,
    filter_usernames_only: bool = False,
    filter_recent_activity: bool = False,
) -> Dict[str, Any]:
    """Celery task for scraping"""
    async with AsyncSessionLocal() as db:
        service = ScraperService(db)
        return await service.scrape_channel(
            source_channel_id=source_channel_id,
            account_id=account_id,
            limit=limit,
            offset=offset,
            filter_usernames_only=filter_usernames_only,
            filter_recent_activity=filter_recent_activity,
        )