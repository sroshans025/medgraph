import os
import secrets
from pathlib import Path
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables or defaults.
    """
    APP_NAME: str = "MedGraph AI"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    
    # Base paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent
    
    # Storage settings
    STORAGE_DIR: Path = BASE_DIR / "storage"
    UPLOAD_DIR: Path = BASE_DIR / "storage" / "uploads"
    OVERLAY_DIR: Path = BASE_DIR / "storage" / "overlays"
    MODEL_DIR: Path = BASE_DIR / "storage" / "models"
    
    # Database settings
    DATABASE_URL: str = "sqlite+aiosqlite:///./medgraph.db"
    
    # Authentication
    # Set JWT_SECRET in .env for production; the random default means tokens
    # stop working whenever the server restarts.
    JWT_SECRET: str = Field(default_factory=lambda: secrets.token_urlsafe(48))
    JWT_EXPIRE_MINUTES: int = 720
    AUTH_REQUIRED: bool = True
    ALLOW_REGISTRATION: bool = True
    SEED_DEMO_USER: bool = True
    DEMO_USER_EMAIL: str = "reader@medgraph.dev"
    DEMO_USER_PASSWORD: str = "radiology"

    # CORS settings
    ALLOWED_ORIGINS: List[str] = ["*"]
    
    # Model Configurations
    YOLO_MODEL_PATH: str = ""  # Will default to automatic download if empty
    MONAI_MODEL_PATH: str = ""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    def create_required_directories(self) -> None:
        """
        Creates storage directories if they do not exist.
        """
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        self.OVERLAY_DIR.mkdir(parents=True, exist_ok=True)
        self.MODEL_DIR.mkdir(parents=True, exist_ok=True)

# Instantiate settings
settings = Settings()
settings.create_required_directories()
