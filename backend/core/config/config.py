import os
from pathlib import Path
from typing import List
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
