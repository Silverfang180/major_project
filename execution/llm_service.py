"""
LLM Service Abstraction
Multi-provider support: Groq and Gemini.
"""

import time
import logging
import asyncio
from typing import Any

from groq import AsyncGroq
import google.genai as genai
from google.genai import types

from config import settings


logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Raised when LLM call fails."""
    pass


# Initialize clients (lazy, reused)
_groq_client: AsyncGroq | None = None

def _get_groq_client(groq_api_key: str | None = None) -> AsyncGroq:
    global _groq_client
    key = groq_api_key or settings.groq_api_key
    if not key:
        raise LLMError("GROQ_API_KEY not configured")
    
    # If using system key, reuse cached client if available
    if not groq_api_key and _groq_client is not None:
        return _groq_client
        
    client = AsyncGroq(api_key=key)
    if not groq_api_key:
        _groq_client = client
    return client

async def call_llm(
    rendered_prompt: str,
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 1000,
    gemini_api_key: str | None = None,
    groq_api_key: str | None = None
) -> dict[str, Any]:
    """
    Call either Groq or Gemini based on the model name.
    """
    model = model or settings.default_llm_model
    is_gemini = "gemini" in model.lower()

    if is_gemini:
        return await _call_gemini(rendered_prompt, model, temperature, max_tokens, gemini_api_key)
    else:
        return await _call_groq(rendered_prompt, model, temperature, max_tokens, groq_api_key)

async def _call_groq(rendered_prompt, model, temperature, max_tokens, groq_api_key):
    client = _get_groq_client(groq_api_key)
    max_retries = 3
    base_delay = 1.0
    
    for attempt in range(max_retries + 1):
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
            if "429" in str(e) and attempt < max_retries:
                await asyncio.sleep(base_delay * (2 ** attempt))
                continue
            
            error_str = str(e)
            if "400" in error_str and "API_KEY_INVALID" in error_str:
                friendly_error = "Invalid API Key. Please check your Groq API key in Settings or .env file."
            elif "429" in error_str:
                friendly_error = "Rate limit exceeded. Please wait a moment before trying again."
            elif "status_code=404" in error_str:
                friendly_error = f"Model '{model}' not found or you don't have access to it."
            else:
                friendly_error = f"Groq Error: {error_str}"
            raise LLMError(friendly_error)

async def _call_gemini(rendered_prompt, model, temperature, max_tokens, gemini_api_key):
    key = gemini_api_key or settings.gemini_api_key
    if not key:
        raise LLMError("Gemini API Key is missing. Please add it in Settings or .env file.")
    
    start_time = time.perf_counter()
    try:
        client = genai.Client(api_key=key)
        
        # Mapping temp and tokens
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens
        )
        
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=model,
            contents=rendered_prompt,
            config=config
        )
        
        latency_ms = int((time.perf_counter() - start_time) * 1000)
        
        # Token usage estimation
        try:
            usage = response.usage_metadata
            prompt_tokens = usage.prompt_token_count
            completion_tokens = usage.candidates_token_count
        except:
            # Fallback estimation
            prompt_tokens = len(rendered_prompt.split())
            completion_tokens = len(response.text.split())

        return {
            "response": response.text,
            "model": model,
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens
            },
            "finish_reason": "stop",
            "latency_ms": latency_ms
        }
    except Exception as e:
        latency_ms = int((time.perf_counter() - start_time) * 1000)
        error_str = str(e)
        if "API_KEY_INVALID" in error_str or "400" in error_str and "key" in error_str.lower():
            friendly_error = "Invalid Gemini API Key. Please update it in Settings or the .env file."
        elif "429" in error_str:
            friendly_error = "Gemini rate limit exceeded. Please slow down and try again later."
        elif "blocked" in error_str.lower():
            friendly_error = "The request was blocked by Gemini's safety filters."
        else:
            friendly_error = f"Gemini Error: {error_str}"
        raise LLMError(friendly_error)
