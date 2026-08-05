"""TTS Provider 抽象基类."""

from abc import ABC, abstractmethod


class TTSProvider(ABC):
    name: str

    @abstractmethod
    async def synthesize(self, text: str, voice: str = "xiaoyan", **kwargs) -> bytes:
        """文本 -> 音频字节 (mp3)."""

    @abstractmethod
    async def healthcheck(self) -> bool:
        """provider 是否就绪."""
