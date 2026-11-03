from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional

from app.api.deps import get_db, get_current_active_user, get_current_superuser
from app.models.models import Account, Proxy, AccountStatus, SourceChannel, TargetChannel, Member, AddJob
from app.schemas.schemas import (
    AccountCreate, AccountUpdate, AccountResponse, AccountLoginRequest,
    AccountLoginCodeRequest, AccountLoginPasswordRequest, ProxyCreate,
    ProxyUpdate, ProxyResponse, DashboardStats, AccountStats
)
from app.services.telegram.client import telegram_manager

router = APIRouter()


@router.get("", response_model=List[AccountResponse])
async def list_accounts(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """List all accounts"""
    stmt = select(Account).offset(skip).limit(limit).order_by(Account.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get dashboard statistics"""
    # Total accounts
    total_accounts = await db.scalar(select(func.count(Account.id)))
    active_accounts = await db.scalar(
        select(func.count(Account.id)).where(Account.status == AccountStatus.ACTIVE)
    )
    
    # Channels
    total_source = await db.scalar(select(func.count(SourceChannel.id)))
    total_target = await db.scalar(select(func.count(TargetChannel.id)))
    
    # Members
    total_scraped = await db.scalar(select(func.count(Member.id)))
    
    # Added members
    from app.models.models import AddedMember, MemberAddStatus
    total_added = await db.scalar(
        select(func.count(AddedMember.id)).where(AddedMember.status == MemberAddStatus.SUCCESS)
    )
    
    # Jobs
    from app.models.models import JobStatus
    running_jobs = await db.scalar(
        select(func.count(AddJob.id)).where(AddJob.status == JobStatus.RUNNING)
    )
    pending_jobs = await db.scalar(
        select(func.count(AddJob.id)).where(AddJob.status == JobStatus.PENDING)
    )
    
    return DashboardStats(
        total_accounts=total_accounts or 0,
        active_accounts=active_accounts or 0,
        total_source_channels=total_source or 0,
        total_target_channels=total_target or 0,
        total_members_scraped=total_scraped or 0,
        total_members_added=total_added or 0,
        running_jobs=running_jobs or 0,
        pending_jobs=pending_jobs or 0,
    )


@router.get("/account-stats", response_model=List[AccountStats])
async def get_account_stats(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get statistics for all accounts"""
    stmt = select(Account)
    result = await db.execute(stmt)
    accounts = result.scalars().all()
    
    stats = []
    for account in accounts:
        source_count = await db.scalar(
            select(func.count(SourceChannel.id)).where(SourceChannel.account_id == account.id)
        )
        target_count = await db.scalar(
            select(func.count(TargetChannel.id)).where(TargetChannel.account_id == account.id)
        )
        scraped = await db.scalar(
            select(func.count(Member.id)).join(SourceChannel).where(SourceChannel.account_id == account.id)
        )
        from app.models.models import AddedMember, MemberAddStatus
        added = await db.scalar(
            select(func.count(AddedMember.id))
            .join(AddJob)
            .where(and_(AddJob.account_id == account.id, AddedMember.status == MemberAddStatus.SUCCESS))
        )
        
        stats.append(AccountStats(
            account_id=account.id,
            phone=account.phone,
            status=account.status,
            adds_today=account.adds_today,
            daily_limit=account.daily_add_limit,
            source_channels_count=source_count or 0,
            target_channels_count=target_count or 0,
            members_scraped=scraped or 0,
            members_added=added or 0,
        ))
    
    return stats


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    account_in: AccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Create a new account"""
    # Check if phone already exists
    stmt = select(Account).where(Account.phone == account_in.phone)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered"
        )
    
    # Verify proxy if provided
    if account_in.proxy_id:
        stmt = select(Proxy).where(Proxy.id == account_in.proxy_id)
        result = await db.execute(stmt)
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Proxy not found"
            )
    
    account = Account(**account_in.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.post("/login/send-code")
async def send_login_code(
    request: AccountLoginRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Send login code to phone"""
    # Find or create account
    stmt = select(Account).where(Account.phone == request.phone)
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    
    if not account:
        account = Account(
            phone=request.phone,
            api_id=request.api_id,
            api_hash=request.api_hash,
        )
        db.add(account)
        await db.commit()
        await db.refresh(account)
    else:
        account.api_id = request.api_id
        account.api_hash = request.api_hash
        await db.commit()
    
    try:
        phone_code_hash = await telegram_manager.send_code(account)
        return {"phone_code_hash": phone_code_hash}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to send code: {str(e)}"
        )


@router.post("/login/verify-code")
async def verify_login_code(
    request: AccountLoginCodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Verify login code"""
    stmt = select(Account).where(Account.phone == request.phone)
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    try:
        success = await telegram_manager.sign_in(account, request.code, request.phone_code_hash)
        await db.commit()
        return {"success": success, "requires_password": False}
    except Exception as e:
        if "SessionPasswordNeededError" in str(type(e)):
            return {"success": False, "requires_password": True}
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to verify code: {str(e)}"
        )


@router.post("/login/verify-password")
async def verify_login_password(
    request: AccountLoginPasswordRequest,
    phone: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Verify 2FA password"""
    stmt = select(Account).where(Account.phone == phone)
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    try:
        success = await telegram_manager.sign_in_with_password(account, request.password)
        await db.commit()
        return {"success": success}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to verify password: {str(e)}"
        )


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get account by ID"""
    stmt = select(Account).where(Account.id == account_id)
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    return account


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    account_in: AccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Update account"""
    stmt = select(Account).where(Account.id == account_id)
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    update_data = account_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(account, field, value)
    
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Delete account"""
    stmt = select(Account).where(Account.id == account_id)
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    # Disconnect client
    await telegram_manager.disconnect_client(account_id)
    
    await db.delete(account)
    await db.commit()


# Proxy routes
@router.get("/proxies/", response_model=List[ProxyResponse])
async def list_proxies(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """List all proxies"""
    stmt = select(Proxy).where(Proxy.is_active == True)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/proxies/", response_model=ProxyResponse, status_code=status.HTTP_201_CREATED)
async def create_proxy(
    proxy_in: ProxyCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Create a new proxy"""
    proxy = Proxy(**proxy_in.model_dump())
    db.add(proxy)
    await db.commit()
    await db.refresh(proxy)
    return proxy


@router.put("/proxies/{proxy_id}", response_model=ProxyResponse)
async def update_proxy(
    proxy_id: int,
    proxy_in: ProxyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Update proxy"""
    stmt = select(Proxy).where(Proxy.id == proxy_id)
    result = await db.execute(stmt)
    proxy = result.scalar_one_or_none()
    
    if not proxy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proxy not found"
        )
    
    update_data = proxy_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(proxy, field, value)
    
    await db.commit()
    await db.refresh(proxy)
    return proxy


@router.delete("/proxies/{proxy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_proxy(
    proxy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Delete proxy"""
    stmt = select(Proxy).where(Proxy.id == proxy_id)
    result = await db.execute(stmt)
    proxy = result.scalar_one_or_none()
    
    if not proxy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proxy not found"
        )
    
    await db.delete(proxy)
    await db.commit()


# Import needed
from sqlalchemy import and_