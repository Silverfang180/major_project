"""
LLM Service Abstraction
Phase-1: Groq only, no retries/fallbacks.

Designed for swappability but not over-abstracted.
"""

import time
import logging
from typing import Any

from groq import AsyncGroq

from config import settings


logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Raised when LLM call fails."""
    pass


# Initialize Groq client (lazy, reused)
_client: AsyncGroq | None = None


def _get_client() -> AsyncGroq:
    """Get or create Groq client."""
    global _client
    if _client is None:
        if not settings.groq_api_key:
            raise LLMError("GROQ_API_KEY not configured")
        _client = AsyncGroq(api_key=settings.groq_api_key)
    return _client


async def call_llm(
    rendered_prompt: str,
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 1000
) -> dict[str, Any]:
    """
    Call Groq API with rendered prompt.
    
    Args:
        rendered_prompt: The fully rendered prompt text
        model: Model to use (defaults to settings.default_llm_model)
        temperature: Sampling temperature
        max_tokens: Maximum tokens in response
        
    Returns:
        {
            "response": str,           # The completion text
            "model": str,              # Model used
            "usage": {                 # Token usage
                "prompt_tokens": int,
                "completion_tokens": int,
                "total_tokens": int
            },
            "finish_reason": str,      # stop, length, etc.
            "latency_ms": int          # Call duration
        }
        
    Raises:
        LLMError: If the API call fails
    """
    client = _get_client()
    model = model or settings.default_llm_model
    
    start_time = time.perf_counter()
    
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": rendered_prompt}],
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        latency_ms = int((time.perf_counter() - start_time) * 1000)
        
        choice = response.choices[0]
        usage = response.usage
        
        return {
            "response": choice.message.content or "",
            "model": response.model,
            "usage": {
                "prompt_tokens": usage.prompt_tokens if usage else 0,
                "completion_tokens": usage.completion_tokens if usage else 0,
                "total_tokens": usage.total_tokens if usage else 0
            },
            "finish_reason": choice.finish_reason,
            "latency_ms": latency_ms
        }
        
    except Exception as e:
        latency_ms = int((time.perf_counter() - start_time) * 1000)
        logger.error(f"LLM call failed after {latency_ms}ms: {e}")
        raise LLMError(f"Groq API error: {str(e)}") from e
