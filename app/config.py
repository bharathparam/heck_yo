from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "RailBus Backend API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True

    # Database
    # Default to local sqlite for development if Postgres is not provided
    DATABASE_URL: str = "sqlite+aiosqlite:///./railbus.db"
    DATABASE_ECHO: bool = False

    # Security & JWT
    SECRET_KEY: str = "railbus-production-jwt-secret-replace-in-env-key-928374928"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Conductor & Ticket QR HMAC Security
    QR_HMAC_SECRET: str = "railbus-qr-signature-secret-key-3847293847293847"
    TICKET_VALIDITY_WINDOW_HOURS: int = 6

    # Minimum demand threshold for trip activation/approval
    DEMAND_ACTIVATION_THRESHOLD: int = 20

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )

    @field_validator("SECRET_KEY", "QR_HMAC_SECRET")
    @classmethod
    def validate_secrets_in_production(cls, v: str, info) -> str:
        # Check if running in production mode
        # info.data might contain DEBUG
        debug = info.data.get("DEBUG", True)
        default_insecure = [
            "railbus-production-jwt-secret-replace-in-env-key-928374928",
            "railbus-qr-signature-secret-key-3847293847293847"
        ]
        if not debug and v in default_insecure:
            raise ValueError(f"CRITICAL SECURITY: Cannot start with default {info.field_name} when DEBUG is false. Please configure {info.field_name} in environment variables.")
        return v


settings = Settings()

