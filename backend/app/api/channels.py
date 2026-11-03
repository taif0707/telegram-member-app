from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional

from app.api.deps import get_db, get_current_active_user, get_current_superuser
from app.models.models import (
    SourceChannel, TargetChannel, Account, AccountStatus, Member
)
from app.schemas.schemas import (
    SourceChannelCreate, SourceChannelUpdate, SourceChannelResponse,
    TargetChannelCreate, TargetChannelUpdate, TargetChannelResponse,
    ScrapeRequest, ScrapeResponse
)
from app.services.telegram.client import telegram_manager
from app.services.scraper.tasks import scrape_channel_celery

router = APIRouter()


# Source Channel Routes
@router.get("/source", response_model=List[SourceChannelResponse])
async def list_source_channels(
    skip: int = 0,
    limit: int = 100,
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """List source channels"""
    stmt = select(SourceChannel)
    if account_id:
        stmt = stmt.where(SourceChannel.account_id == account_id)
    stmt = stmt.offset(skip).limit(limit).order_by(SourceChannel.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/source", response_model=SourceChannelResponse, status_code=status.HTTP_201_CREATED)
async def create_source_channel(
    channel_in: SourceChannelCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Add a source channel"""
    # Verify account exists and is active
    stmt = select(Account).where(Account.id == channel_in.account_id)
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    if account.status != AccountStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is not active"
        )
    
    # Check if already exists
    stmt = select(SourceChannel).where(
        SourceChannel.channel_id == channel_in.channel_id,
        SourceChannel.account_id == channel_in.account_id
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Channel already added for this account"
        )
    
    # Try to resolve channel entity to get title
    try:
        entity = await telegram_manager.get_entity(account, channel_in.channel_id)
        if hasattr(entity, 'title'):
            channel_in.title = entity.title
        if hasattr(entity, 'username'):
            channel_in.username = entity.username
        if hasattr(entity, 'access_hash'):
            channel_in.access_hash = entity.access_hash
    except Exception as e:
        # If we can't resolve, still allow creation
        pass
    
    channel = SourceChannel(**channel_in.model_dump())
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    return channel


@router.get("/source/{channel_id}", response_model=SourceChannelResponse)
async def get_source_channel(
    channel_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get source channel by ID"""
    stmt = select(SourceChannel).where(SourceChannel.id == channel_id)
    result = await db.execute(stmt)
    channel = result.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    return channel


@router.put("/source/{channel_id}", response_model=SourceChannelResponse)
async def update_source_channel(
    channel_id: int,
    channel_in: SourceChannelUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Update source channel"""
    stmt = select(SourceChannel).where(SourceChannel.id == channel_id)
    result = await db.execute(stmt)
    channel = result.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    update_data = channel_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(channel, field, value)
    
    await db.commit()
    await db.refresh(channel)
    return channel


@router.delete("/source/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source_channel(
    channel_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Delete source channel"""
    stmt = select(SourceChannel).where(SourceChannel.id == channel_id)
    result = await db.execute(stmt)
    channel = result.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    await db.delete(channel)
    await db.commit()


@router.post("/source/{channel_id}/scrape", response_model=ScrapeResponse)
async def scrape_source_channel(
    channel_id: int,
    request: ScrapeRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Start scraping members from source channel"""
    # Verify channel exists
    stmt = select(SourceChannel).where(SourceChannel.id == channel_id)
    result = await db.execute(stmt)
    channel = result.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    # Start scraping task
    task = scrape_channel_celery.delay(
        source_channel_id=channel_id,
        account_id=request.account_id,
        limit=request.limit,
        offset=request.offset,
        filter_usernames_only=request.filter_usernames_only,
        filter_recent_activity=request.filter_recent_activity,
    )
    
    return ScrapeResponse(
        job_id=task.id,
        status="pending",
        message="Scraping started"
    )


@router.get("/source/{channel_id}/members")
async def get_channel_members(
    channel_id: int,
    limit: int = 100,
    offset: int = 0,
    username_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get scraped members from channel"""
    from app.services.scraper.service import ScraperService
    
    service = ScraperService(db)
    members = await service.get_members(
        source_channel_id=channel_id,
        limit=limit,
        offset=offset,
        username_only=username_only,
    )
    total = await service.get_members_count(channel_id)
    
    return {
        "members": members,
        "total": total,
        "limit": limit,
        "offset": offset
    }


# Target Channel Routes
@router.get("/target", response_model=List[TargetChannelResponse])
async def list_target_channels(
    skip: int = 0,
    limit: int = 100,
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """List target channels"""
    stmt = select(TargetChannel)
    if account_id:
        stmt = stmt.where(TargetChannel.account_id == account_id)
    stmt = stmt.offset(skip).limit(limit).order_by(TargetChannel.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/target", response_model=TargetChannelResponse, status_code=status.HTTP_201_CREATED)
async def create_target_channel(
    channel_in: TargetChannelCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Add a target channel"""
    # Verify account exists and is active
    stmt = select(Account).where(Account.id == channel_in.account_id)
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    if account.status != AccountStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is not active"
        )
    
    # Check if already exists
    stmt = select(TargetChannel).where(
        TargetChannel.channel_id == channel_in.channel_id,
        TargetChannel.account_id == channel_in.account_id
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Channel already added for this account"
        )
    
    # Try to resolve channel and get invite link
    try:
        entity = await telegram_manager.get_entity(account, channel_in.channel_id)
        if hasattr(entity, 'title'):
            channel_in.title = entity.title
        if hasattr(entity, 'username'):
            channel_in.username = entity.username
        if hasattr(entity, 'access_hash'):
            channel_in.access_hash = entity.access_hash
        
        # Get invite link
        invite_link = await telegram_manager.get_invite_link(account, entity)
        if invite_link:
            channel_in.invite_link = invite_link
    except Exception as e:
        pass
    
    channel = TargetChannel(**channel_in.model_dump())
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    return channel


@router.get("/target/{channel_id}", response_model=TargetChannelResponse)
async def get_target_channel(
    channel_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get target channel by ID"""
    stmt = select(TargetChannel).where(TargetChannel.id == channel_id)
    result = await db.execute(stmt)
    channel = result.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    return channel


@router.put("/target/{channel_id}", response_model=TargetChannelResponse)
async def update_target_channel(
    channel_id: int,
    channel_in: TargetChannelUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Update target channel"""
    stmt = select(TargetChannel).where(TargetChannel.id == channel_id)
    result = await db.execute(stmt)
    channel = result.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    update_data = channel_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(channel, field, value)
    
    await db.commit()
    await db.refresh(channel)
    return channel


@router.delete("/target/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_target_channel(
    channel_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Delete target channel"""
    stmt = select(TargetChannel).where(TargetChannel.id == channel_id)
    result = await db.execute(stmt)
    channel = result.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    await db.delete(channel)
    await db.commit()


@router.post("/target/{channel_id}/invite-link")
async def get_invite_link(
    channel_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Get or create invite link for target channel"""
    stmt = select(TargetChannel).where(TargetChannel.id == channel_id)
    result = await db.execute(stmt)
    channel = result.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    stmt = select(Account).where(Account.id == channel.account_id)
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    try:
        entity = await telegram_manager.get_entity(account, channel.channel_id)
        invite_link = await telegram_manager.get_invite_link(account, entity)
        
        if invite_link:
            channel.invite_link = invite_link
            await db.commit()
            return {"invite_link": invite_link}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not generate invite link"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get invite link: {str(e)}"
        )