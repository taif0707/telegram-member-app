from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from enum import Enum


class AccountStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    BANNED = "banned"
    FLOOD_WAIT = "flood_wait"
    AUTH_REQUIRED = "auth_required"


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class MemberAddStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    FLOOD_WAIT = "flood_wait"
    USER_PRIVACY = "user_privacy"
    USER_ALREADY_PARTICIPANT = "user_already_participant"
    CHANNEL_PRIVATE = "channel_private"
    PEER_FLOOD = "peer_flood"
    BOT_METHOD_INVALID = "bot_method_invalid"
    UNKNOWN = "unknown"


# Account Schemas
class AccountBase(BaseModel):
    api_id: int
    api_hash: str
    phone: str
    proxy_id: Optional[int] = None
    daily_add_limit: int = 30
    is_default: bool = False


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    api_id: Optional[int] = None
    api_hash: Optional[str] = None
    phone: Optional[str] = None
    proxy_id: Optional[int] = None
    daily_add_limit: Optional[int] = None
    status: Optional[AccountStatus] = None
    is_default: Optional[bool] = None


class AccountResponse(AccountBase):
    id: int
    status: AccountStatus
    adds_today: int
    last_add_reset: datetime
    flood_wait_until: Optional[datetime] = None
    is_default: bool
    created_at: datetime
    updated_at: datetime
    last_used_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class AccountLoginRequest(BaseModel):
    phone: str
    api_id: int
    api_hash: str


class AccountLoginCodeRequest(BaseModel):
    phone: str
    code: str
    phone_code_hash: str


class AccountLoginPasswordRequest(BaseModel):
    password: str


# Proxy Schemas
class ProxyBase(BaseModel):
    host: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None
    proxy_type: str = "socks5"


class ProxyCreate(ProxyBase):
    pass


class ProxyUpdate(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    proxy_type: Optional[str] = None
    is_active: Optional[bool] = None


class ProxyResponse(ProxyBase):
    id: int
    is_active: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Source Channel Schemas
class SourceChannelBase(BaseModel):
    channel_id: int
    username: Optional[str] = None
    title: str
    access_hash: Optional[int] = None


class SourceChannelCreate(SourceChannelBase):
    account_id: int


class SourceChannelUpdate(BaseModel):
    username: Optional[str] = None
    title: Optional[str] = None
    is_active: Optional[bool] = None


class SourceChannelResponse(SourceChannelBase):
    id: int
    account_id: int
    last_scraped_at: Optional[datetime] = None
    total_members: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Target Channel Schemas
class TargetChannelBase(BaseModel):
    channel_id: int
    username: Optional[str] = None
    title: str
    access_hash: Optional[int] = None
    invite_link: Optional[str] = None


class TargetChannelCreate(TargetChannelBase):
    account_id: int
    max_per_day: int = 30


class TargetChannelUpdate(BaseModel):
    username: Optional[str] = None
    title: Optional[str] = None
    invite_link: Optional[str] = None
    max_per_day: Optional[int] = None
    is_active: Optional[bool] = None


class TargetChannelResponse(TargetChannelBase):
    id: int
    account_id: int
    adds_today: int
    last_add_reset: datetime
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Member Schemas
class MemberBase(BaseModel):
    user_id: int
    access_hash: Optional[int] = None
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_bot: bool = False
    is_verified: bool = False
    is_premium: bool = False
    status: Optional[str] = None


class MemberCreate(MemberBase):
    source_channel_id: int


class MemberResponse(MemberBase):
    id: int
    source_channel_id: int
    scraped_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Add Job Schemas
class AddJobBase(BaseModel):
    source_channel_id: int
    target_channel_id: int
    account_id: int
    filter_usernames_only: bool = False
    filter_recent_activity: bool = False
    filter_no_bots: bool = True
    limit: Optional[int] = None
    offset: int = 0


class AddJobCreate(AddJobBase):
    pass


class AddJobUpdate(BaseModel):
    status: Optional[JobStatus] = None
    error_message: Optional[str] = None


class AddJobResponse(AddJobBase):
    id: int
    status: JobStatus
    total_members: int
    processed_members: int
    successful_adds: int
    failed_adds: int
    flood_wait_count: int
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    # Nested
    source_channel: Optional[SourceChannelResponse] = None
    target_channel: Optional[TargetChannelResponse] = None
    
    model_config = ConfigDict(from_attributes=True)


class AddJobProgress(BaseModel):
    job_id: int
    status: JobStatus
    total_members: int
    processed_members: int
    successful_adds: int
    failed_adds: int
    progress_percent: float
    current_member: Optional[str] = None


# Added Member Schemas
class AddedMemberResponse(BaseModel):
    id: int
    job_id: int
    member_id: int
    status: MemberAddStatus
    error_message: Optional[str] = None
    added_at: datetime
    member: Optional[MemberResponse] = None
    
    model_config = ConfigDict(from_attributes=True)


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


# Auth Schemas
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: int
    exp: int
    type: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# Scraper Schemas
class ScrapeRequest(BaseModel):
    source_channel_id: int
    account_id: Optional[int] = None
    limit: Optional[int] = None
    offset: int = 0
    filter_usernames_only: bool = False
    filter_recent_activity: bool = False


class ScrapeResponse(BaseModel):
    job_id: int
    status: JobStatus
    message: str


# Statistics Schemas
class DashboardStats(BaseModel):
    total_accounts: int
    active_accounts: int
    total_source_channels: int
    total_target_channels: int
    total_members_scraped: int
    total_members_added: int
    running_jobs: int
    pending_jobs: int


class AccountStats(BaseModel):
    account_id: int
    phone: str
    status: AccountStatus
    adds_today: int
    daily_limit: int
    source_channels_count: int
    target_channels_count: int
    members_scraped: int
    members_added: int