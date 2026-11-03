import os
from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Telegram Member Manager"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/telegram_app",
        description="Async PostgreSQL connection string"
    )
    DATABASE_URL_SYNC: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/telegram_app",
        description="Sync PostgreSQL connection string for Alembic"
    )
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    
    # Security
    SECRET_KEY: str = "your-super-secret-key-change-in-production-min-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Encryption for session strings
    ENCRYPTION_KEY: str = Field(
        default="",
        description="32-byte key for encrypting session strings (generate with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"
    )
    
    # Telegram
    TELEGRAM_API_ID: int = 0
    TELEGRAM_API_HASH: str = ""
    
    # Default limits (per account per day)
    DEFAULT_DAILY_ADD_LIMIT: int = 30
    DEFAULT_SCRAPE_BATCH_SIZE: int = 100
    DEFAULT_DELAY_BETWEEN_ADDS: int = 60  # seconds
    
    # Flood wait handling
    MAX_FLOOD_WAIT: int = 3600  # Max seconds to wait for flood wait
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()