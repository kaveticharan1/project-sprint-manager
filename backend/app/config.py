from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# The only databases this application is ever allowed to touch.
ALLOWED_DATABASES = frozenset({"sprint_manager", "sprint_manager_test"})


def assert_allowed_database(name: str) -> str:
    if name not in ALLOWED_DATABASES:
        raise ValueError(
            f"Refusing to use database {name!r}; allowed: {', '.join(sorted(ALLOWED_DATABASES))}"
        )
    return name


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true"
    mongodb_db: str = "sprint_manager"
    mongodb_test_db: str = "sprint_manager_test"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @field_validator("mongodb_db", "mongodb_test_db")
    @classmethod
    def _allowed_db(cls, value: str) -> str:
        return assert_allowed_database(value)

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
