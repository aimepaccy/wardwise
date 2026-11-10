from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parent.parent / '.env'


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra='ignore')

    # Comma-separated list of front-end addresses allowed to call this API.
    allowed_origins: str = 'http://localhost:5173'
    max_request_mb: int = 110

    # Any OpenAI-compatible provider. SecretStr keeps the key out of logs and error messages.
    llm_base_url: str = 'https://api.groq.com/openai/v1'
    llm_api_key: SecretStr = SecretStr('')
    llm_model: str = 'openai/gpt-oss-120b'
    # The provider's limit on tokens per minute (in and out together). It caps how much material fits in one go.
    llm_tokens_per_minute: int = 8000
    # How long a reasoning model thinks before answering. Left empty, it is not sent (not every provider knows it).
    llm_reasoning_effort: str = 'low'

    # Not every provider offers speech-to-text, so transcription can use its own.
    # Left empty, it uses the same provider as the LLM.
    transcribe_base_url: str = ''
    transcribe_api_key: SecretStr = SecretStr('')
    transcribe_model: str = 'whisper-large-v3-turbo'

    # A model that can read images, for photos of handwritten notes. Same provider as the LLM.
    vision_model: str = 'qwen/qwen3.8-27b'

    # Further reading. Without a YouTube key the videos are left out; without an NCBI key
    # PubMed and StatPearls still work, at 3 requests a second instead of 10.
    youtube_api_key: SecretStr = SecretStr('')
    ncbi_api_key: SecretStr = SecretStr('')

    @property
    def transcription_provider(self) -> tuple[str, str]:
        base_url = self.transcribe_base_url or self.llm_base_url
        key = self.transcribe_api_key.get_secret_value() or self.llm_api_key.get_secret_value()
        return base_url, key

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(',') if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
