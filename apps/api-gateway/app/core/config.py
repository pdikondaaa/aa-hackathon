from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    AZURE_CLIENT_ID: str
    AZURE_TENANT_ID: str

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
