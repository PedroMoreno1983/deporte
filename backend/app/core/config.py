from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./deporte.db"
    REDIS_URL: str = "redis://localhost:6379"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Two-factor auth (TOTP) ───────────────────────────────────────────
    MFA_ISSUER: str = "Deporte FC"          # shown as the account label in authenticator apps
    MFA_TOKEN_EXPIRE_MINUTES: int = 5       # lifetime of the short-lived post-password challenge token
    MFA_REQUIRED_FOR_ADMINS: bool = True    # flag (not hard-lock) forcing admins/superadmins to enrol

    # ── Encryption at rest ───────────────────────────────────────────────
    # urlsafe-base64 32-byte Fernet key; if empty, derived from SECRET_KEY (dev only).
    DATA_ENCRYPTION_KEY: str = ""

    # ── Verified backups (compliance #13) ────────────────────────────────
    BACKUP_DIR: str = "./backups"        # where backup artifacts + manifest are written
    BACKUP_RETENTION: int = 7            # most-recent artifacts to keep (0 = never prune)
    PG_DUMP_PATH: str = ""               # path to pg_dump   (empty → resolve on PATH)
    PG_RESTORE_PATH: str = ""            # path to pg_restore (empty → resolve on PATH)
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "deporte-files"
    ENVIRONMENT: str = "development"
    GROQ_API_KEY: str = ""
    # Email (SMTP) — set in Railway env vars
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "Deporte FC <noreply@deportefc.com>"
    EMAIL_ALERTS_ENABLED: bool = False

    class Config:
        env_file = ".env"


settings = Settings()
