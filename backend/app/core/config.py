from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from environment variables / .env."""

    app_name: str = "HaptiQ"
    port: int = 8000
    debug: bool = False
    # Minimum confidence for a critical detection to be persisted to history.
    model_threshold: float = 0.30

    # `protected_namespaces=()` lets us use a `model_*` field name without
    # clashing with pydantic's reserved namespace.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", protected_namespaces=())


settings = Settings()
