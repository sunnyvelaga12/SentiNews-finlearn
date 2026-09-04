import os
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "SentiNews Learn API"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    
    # Database (Neon PostgreSQL)
    DATABASE_URL: str = "postgresql+asyncpg://neondb_owner:npg_Ar9WJtFUaKO6@ep-twilight-hat-ax56xdh3-pooler.c-4.us-east-2.aws.neon.tech/neondb?ssl=require"
    
    # Security
    JWT_SECRET: str = "super_secret_jwt_key_change_in_production_32bytes"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    STEP_UP_TOKEN_EXPIRE_MINUTES: int = 5
    
    # CORS & Security
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
    
    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @field_validator("DATABASE_URL")
    def validate_db_url(cls, v: str) -> str:
        if "sqlite" in v.lower():
            raise ValueError("SQLite is strictly banned. PostgreSQL must be used across all environments.")
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
