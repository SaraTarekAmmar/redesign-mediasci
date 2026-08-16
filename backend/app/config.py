from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings


APP_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    APP_NAME: str = "Redesign MediaSci"
    SECRET_KEY: str = "change-me-in-production"

    # MySQL Configuration Variables
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "redesign_mediasci"
    DB_USER: str = "root"
    DB_PASSWORD: str = "password"
    DATABASE_URL: str = "mysql+pymysql://root:password@localhost:3306/redesign_mediasci"

    FRONTEND_URL: str = "http://127.0.0.1:5173"
    UPLOAD_DIR: str = "./uploads"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    ALGORITHM: str = "HS256"
    ENVIRONMENT: Literal["development", "production", "testing"] = "development"
    LOG_LEVEL: str = "INFO"

    # Optional AI provider keys (set in production .env)
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    AI_PROVIDER: Literal["openai", "gemini", "anthropic", "mock"] = "mock"

    class Config:
        env_file = ".env"
        extra = "ignore"

    def model_post_init(self, __context) -> None:
        if not self.DATABASE_URL:
            self.DATABASE_URL = f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

