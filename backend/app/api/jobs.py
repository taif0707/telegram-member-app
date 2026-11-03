from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional

from app.api.deps import get_db, get_current_active_user, get_current_superuser
from app.models.models import (
    AddJob, SourceChannel, TargetChannel, Account, AddedMember, Member,
    JobStatus, MemberAddStatus
)
from app.schemas.schemas import (
    AddJobCreate, AddJobUpdate, AddJobResponse, AddJobProgress,
    AddedMemberResponse
)
from app.services.adder.tasks import add_members_celery, pause_job_celery, cancel_job_celery

router = APIRouter()


@router.get("", response_model=List[AddJobResponse])
async def list_jobs(
    skip: int = 0,
    limit: int = 100,
    status: Optional[JobStatus] = None,
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """List add jobs"""
    stmt = select(AddJob)
    
    if status:
        stmt = stmt.where(AddJob.status == status)
    if account_id:
        stmt = stmt.where(AddJob.account_id == account_id)
    
    stmt = stmt.order_by(desc(AddJob.created_at)).offset(skip).limit(limit)
    result = await db.execute(stmt)
    jobs = list(result.scalars().all())
    
    # Load relationships
    for job in jobs:
        await db.refresh(job, ["source_channel", "target_channel"])
    
    return jobs


@router.post("", response_model=AddJobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_in: AddJobCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Create a new add job"""
    # Verify source channel
    stmt = select(SourceChannel).where(SourceChannel.id == job_in.source_channel_id)
    result = await db.execute(stmt)
    source = result.scalar_one_or_none()
    
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source channel not found"
        )
    
    # Verify target channel
    stmt = select(TargetChannel).where(TargetChannel.id == job_in.target_channel_id)
    result = await db.execute(stmt)
    target = result.scalar_one_or_none()
    
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target channel not found"
        )
    
    # Verify account
    stmt = select(Account).where(Account.id == job_in.account_id)
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    # Check if source and target use same account (or compatible)
    if source.account_id != job_in.account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source channel must belong to the same account"
        )
    
    # Count available members
    stmt = select(func.count(Member.id)).where(Member.source_channel_id == job_in.source_channel_id)
    if job_in.filter_usernames_only:
        stmt = stmt.where(Member.username.isnot(None))
    if job_in.filter_no_bots:
        stmt = stmt.where(Member.is_bot == False)
    
    result = await db.execute(stmt)
    total_available = result.scalar() or 0
    
    job = AddJob(**job_in.model_dump())
    job.total_members = min(total_available, job_in.limit or total_available)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    
    # Load relationships
    await db.refresh(job, ["source_channel", "target_channel"])
    return job


@router.get("/{job_id}", response_model=AddJobResponse)
async def get_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get job by ID"""
    stmt = select(AddJob).where(AddJob.id == job_id)
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    await db.refresh(job, ["source_channel", "target_channel"])
    return job


@router.get("/{job_id}/progress", response_model=AddJobProgress)
async def get_job_progress(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get job progress"""
    stmt = select(AddJob).where(AddJob.id == job_id)
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    progress = 0.0
    if job.total_members > 0:
        progress = (job.processed_members / job.total_members) * 100
    
    # Get current member being processed
    current_member = None
    if job.status == JobStatus.RUNNING:
        stmt = select(AddedMember).where(
            AddedMember.job_id == job_id
        ).order_by(desc(AddedMember.added_at)).limit(1)
        result = await db.execute(stmt)
        latest = result.scalar_one_or_none()
        if latest:
            await db.refresh(latest, ["member"])
            if latest.member:
                current_member = f"{latest.member.first_name or ''} {latest.member.last_name or ''} (@{latest.member.username or latest.member.user_id})"
    
    return AddJobProgress(
        job_id=job.id,
        status=job.status,
        total_members=job.total_members,
        processed_members=job.processed_members,
        successful_adds=job.successful_adds,
        failed_adds=job.failed_adds,
        progress_percent=round(progress, 2),
        current_member=current_member
    )


@router.post("/{job_id}/start")
async def start_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Start a job"""
    stmt = select(AddJob).where(AddJob.id == job_id)
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    if job.status not in [JobStatus.PENDING, JobStatus.PAUSED, JobStatus.FAILED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job cannot be started (status: {job.status})"
        )
    
    # Start async task
    task = add_members_celery.delay(job_id)
    
    return {"task_id": task.id, "message": "Job started"}


@router.post("/{job_id}/pause")
async def pause_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Pause a running job"""
    task = pause_job_celery.delay(job_id)
    return {"task_id": task.id, "message": "Pause requested"}


@router.post("/{job_id}/cancel")
async def cancel_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Cancel a job"""
    task = cancel_job_celery.delay(job_id)
    return {"task_id": task.id, "message": "Cancel requested"}


@router.put("/{job_id}", response_model=AddJobResponse)
async def update_job(
    job_id: int,
    job_in: AddJobUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Update job"""
    stmt = select(AddJob).where(AddJob.id == job_id)
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    update_data = job_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(job, field, value)
    
    await db.commit()
    await db.refresh(job, ["source_channel", "target_channel"])
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser)
):
    """Delete job"""
    stmt = select(AddJob).where(AddJob.id == job_id)
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    if job.status == JobStatus.RUNNING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete running job"
        )
    
    await db.delete(job)
    await db.commit()


@router.get("/{job_id}/added-members", response_model=List[AddedMemberResponse])
async def get_job_added_members(
    job_id: int,
    skip: int = 0,
    limit: int = 100,
    status: Optional[MemberAddStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get members added in a job"""
    stmt = select(AddedMember).where(AddedMember.job_id == job_id)
    
    if status:
        stmt = stmt.where(AddedMember.status == status)
    
    stmt = stmt.order_by(desc(AddedMember.added_at)).offset(skip).limit(limit)
    result = await db.execute(stmt)
    added = list(result.scalars().all())
    
    # Load member relationships
    for item in added:
        await db.refresh(item, ["member"])
    
    return added