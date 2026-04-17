from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "HRCloud Biometric Admin API"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8090
    log_level: str = "INFO"
    api_prefix: str = "/api/v1"

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_schema: str = "attendance"
    sb_timeout: float = 10.0

    default_timezone: str = "America/Guayaquil"
    enable_mock_provider: bool = True


settings = Settings()
