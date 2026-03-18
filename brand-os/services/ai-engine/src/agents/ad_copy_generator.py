"""Ad Copy Generator agent using LLM providers."""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from ..main import CopyRequest


class AdCopyGenerator:
    """Generates ad copy variations via OpenAI / Anthropic."""

    def __init__(self) -> None:
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        self.model_name = "gpt-4o" if self.openai_key else "claude-3-opus-20240229"

    async def generate(self, req: Any) -> list[str]:
        """Generate `req.variations` copy variants for the given request."""
        prompt = self._build_prompt(req)

        if self.openai_key:
            return await self._generate_openai(prompt, req.variations)
        if self.anthropic_key:
            return await self._generate_anthropic(prompt, req.variations)
        return self._mock_generate(req)

    def _build_prompt(self, req: Any) -> str:
        platforms_str = ", ".join(req.platforms) if req.platforms else "all platforms"
        return (
            f"Generate {req.variations} distinct ad copy variations for the following:\n"
            f"Product/Service: {req.product}\n"
            f"Target Audience: {req.audience}\n"
            f"Tone: {req.tone}\n"
            f"Platforms: {platforms_str}\n\n"
            "Each variation should be concise, compelling, and platform-appropriate. "
            "Return only the copy text, one variation per line."
        )

    async def _generate_openai(self, prompt: str, variations: int) -> list[str]:
        import openai

        client = openai.AsyncOpenAI(api_key=self.openai_key)
        response = await client.chat.completions.create(
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.8,
        )
        raw = response.choices[0].message.content or ""
        lines = [l.strip() for l in raw.splitlines() if l.strip()]
        return lines[:variations] or [raw]

    async def _generate_anthropic(self, prompt: str, variations: int) -> list[str]:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=self.anthropic_key)
        message = await client.messages.create(
            model=self.model_name,
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text if message.content else ""
        lines = [l.strip() for l in raw.splitlines() if l.strip()]
        return lines[:variations] or [raw]

    def _mock_generate(self, req: Any) -> list[str]:
        return [f"[Mock copy {i+1}] {req.product} — {req.tone}" for i in range(req.variations)]
