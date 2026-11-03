import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, BigInteger, DateTime, Enum, ForeignKey, 
    Text, Boolean, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class AccountStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    BANNED = "banned"
    FLOOD_WAIT = "flood_wait"
    AUTH_REQUIRED = "auth_required"


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class MemberAddStatus(str, enum.Enum):
    SUCCESS = "success"
    FAILED = "failed"
    FLOOD_WAIT = "flood_wait"
    USER_PRIVACY = "user_privacy"
    USER_ALREADY_PARTICIPANT = "user_already_participant"
    CHANNEL_PRIVATE = "channel_private"
    PEER_FLOOD = "peer_flood"
    BOT_METHOD_INVALID = "bot_method_invalid"
    UNKNOWN = "unknown"


class Account(Base):
    __tablename__ = "accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    api_id = Column(Integer, nullable=False)
    api_hash = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False, unique=True, index=True)
    session_string = Column(Text, nullable=True)  # Encrypted
    status = Column(Enum(AccountStatus), default=AccountStatus.ACTIVE, nullable=False)
    proxy_id = Column(Integer, ForeignKey("proxies.id"), nullable=True)
    daily_add_limit = Column(Integer, default=30)
    adds_today = Column(Integer, default=0)
    last_add_reset = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    flood_wait_until = Column(DateTime, nullable=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_used_at = Column(DateTime, nullable=True)
    
    # Relationships
    proxy = relationship("Proxy", back_populates="accounts")
    source_channels = relationship("SourceChannel", back_populates="account")
    target_channels = relationship("TargetChannel", back_populates="account")
    add_jobs = relationship("AddJob", back_populates="account")


class Proxy(Base):
    __tablename__ = "proxies"
    
    id = Column(Integer, primary_key=True, index=True)
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False)
    username = Column(String(255), nullable=True)
    password = Column(String(255), nullable=True)  # Encrypted
    proxy_type = Column(String(20), default="socks5")  # socks5, http, mtproto
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    accounts = relationship("Account", back_populates="proxy")


class SourceChannel(Base):
    __tablename__ = "source_channels"
    
    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(BigInteger, nullable=False, index=True)
    username = Column(String(255), nullable=True, index=True)
    title = Column(String(500), nullable=False)
    access_hash = Column(BigInteger, nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    last_scraped_at = Column(DateTime, nullable=True)
    total_members = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    account = relationship("Account", back_populates="source_channels")
    members = relationship("Member", back_populates="source_channel")
    add_jobs = relationship("AddJob", back_populates="source_channel")
    
    __table_args__ = (
        UniqueConstraint('channel_id', 'account_id', name='uq_channel_account'),
    )


class TargetChannel(Base):
    __tablename__ = "target_channels"
    
    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(BigInteger, nullable=False, index=True)
    username = Column(String(255), nullable=True, index=True)
    title = Column(String(500), nullable=False)
    access_hash = Column(BigInteger, nullable=True)
    invite_link = Column(String(500), nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    max_per_day = Column(Integer, default=30)
    adds_today = Column(Integer, default=0)
    last_add_reset = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    account = relationship("Account", back_populates="target_channels")
    add_jobs = relationship("AddJob", back_populates="target_channel")
    
    __table_args__ = (
        UniqueConstraint('channel_id', 'account_id', name='uq_target_channel_account'),
    )


class Member(Base):
    __tablename__ = "members"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(BigInteger, nullable=False, index=True)
    access_hash = Column(BigInteger, nullable=True)
    username = Column(String(255), nullable=True, index=True)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    is_bot = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    is_premium = Column(Boolean, default=False)
    status = Column(String(50), nullable=True)  # recently, last_week, last_month, long_time_ago
    source_channel_id = Column(Integer, ForeignKey("source_channels.id"), nullable=False)
    scraped_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    source_channel = relationship("SourceChannel", back_populates="members")
    added_logs = relationship("AddedMember", back_populates="member")
    
    __table_args__ = (
        Index('ix_member_user_source', 'user_id', 'source_channel_id'),
        UniqueConstraint('user_id', 'source_channel_id', name='uq_member_source'),
    )


class AddJob(Base):
    __tablename__ = "add_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    source_channel_id = Column(Integer, ForeignKey("source_channels.id"), nullable=False)
    target_channel_id = Column(Integer, ForeignKey("target_channels.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    status = Column(Enum(JobStatus), default=JobStatus.PENDING, nullable=False)
    total_members = Column(Integer, default=0)
    processed_members = Column(Integer, default=0)
    successful_adds = Column(Integer, default=0)
    failed_adds = Column(Integer, default=0)
    flood_wait_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Filters
    filter_usernames_only = Column(Boolean, default=False)
    filter_recent_activity = Column(Boolean, default=False)
    filter_no_bots = Column(Boolean, default=True)
    limit = Column(Integer, nullable=True)
    offset = Column(Integer, default=0)
    
    # Relationships
    source_channel = relationship("SourceChannel", back_populates="add_jobs")
    target_channel = relationship("TargetChannel", back_populates="add_jobs")
    account = relationship("Account", back_populates="add_jobs")
    added_members = relationship("AddedMember", back_populates="job")


class AddedMember(Base):
    __tablename__ = "added_members"
    
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("add_jobs.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    status = Column(Enum(MemberAddStatus), default=MemberAddStatus.FAILED, nullable=False)
    error_message = Column(Text, nullable=True)
    added_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    job = relationship("AddJob", back_populates="added_members")
    member = relationship("Member", back_populates="added_logs")
    
    __table_args__ = (
        Index('ix_added_member_job_member', 'job_id', 'member_id'),
    )


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_login = Column(DateTime, nullable=True)