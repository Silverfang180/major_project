import os
import abc
import google.generativeai as genai
from groq import Groq, AsyncGroq
from config import settings

# -----------------
# 1. Base Provider
# -----------------
class LLMProvider(abc.ABC):
    @abc.abstractmethod
    async def generate(self, prompt: str, model: str) -> str:
        pass

    @abc.abstractmethod
    def count_tokens(self, text: str, model: str) -> int:
        pass
    
    @abc.abstractmethod
    def calculate_cost(self, input_tokens: int, output_tokens: int, model: str) -> float:
        pass

# -----------------
# 2. Gemini Provider
# -----------------
class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str):
        if api_key:
            genai.configure(api_key=api_key)
        else:
            print("WARNING: Gemini API Key missing")

    async def generate(self, prompt: str, model: str) -> str:
        try:
            # Use model alias if provided, else default
            model_name = model if model else 'gemini-flash-latest'
            m = genai.GenerativeModel(model_name)
            response = await m.generate_content_async(prompt)
            return response.text
        except Exception as e:
            return f"Gemini Error: {str(e)}"

    def count_tokens(self, text: str, model: str) -> int:
        # Simple heuristic for speed (approx 4 chars/token)
        return len(text) // 4

    def calculate_cost(self, input_tokens: int, output_tokens: int, model: str) -> float:
        # Gemini Flash 1.5 Pricing (Approx):
        # Input: $0.075 / 1M tokens
        # Output: $0.30 / 1M tokens
        # (Using close approximates for demo)
        return round((input_tokens / 1_000_000 * 0.075) + (output_tokens / 1_000_000 * 0.30), 8)

# -----------------
# 3. Groq Provider
# -----------------
class GroqProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.client = None
        if api_key:
            self.client = AsyncGroq(api_key=api_key)
        else:
            print("WARNING: Groq API Key missing")

    async def generate(self, prompt: str, model: str) -> str:
        if not self.client:
            return "Error: Groq API Key not configured."
        try:
            # Models: llama-3.3-70b-versatile, llama-3.1-8b-instant
            model_name = model if model else 'llama-3.3-70b-versatile'
            chat_completion = await self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=model_name,
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            return f"Groq Error: {str(e)}"

    def count_tokens(self, text: str, model: str) -> int:
        # Groq/Llama tokenizers are roughly similar to simple estimations for this demo
        return len(text) // 4

    def calculate_cost(self, input_tokens: int, output_tokens: int, model: str) -> float:
        # Llama 3 70B on Groq (Free Tier is free, but let's show "Market Value" of Llama 3)
        # Market Value ~ $0.59 / 1M Input, $0.79 / 1M Output
        return round((input_tokens / 1_000_000 * 0.59) + (output_tokens / 1_000_000 * 0.79), 8)


# -----------------
# 4. Main Service
# -----------------
class AIService:
    def __init__(self):
        self.providers = {}
        
        # Initialize Gemini
        if settings.gemini_api_key:
            self.providers['gemini'] = GeminiProvider(settings.gemini_api_key)
        
        # Initialize Groq
        if settings.groq_api_key:
            self.providers['groq'] = GroqProvider(settings.groq_api_key)
        else:
            # Fallback placeholder if no key, so app doesn't crash on init
            self.providers['groq'] = GroqProvider("")

    async def generate_response(self, prompt: str, provider: str = 'gemini', model: str = "") -> str:
        p = self.providers.get(provider)
        if not p:
            return f"Error: Provider '{provider}' not configured."
        return await p.generate(prompt, model)

    def count_tokens(self, text: str, provider: str = 'gemini') -> int:
        p = self.providers.get(provider, self.providers.get('gemini'))
        if p:
            return p.count_tokens(text, "")
        return len(text) // 4

    def calculate_cost(self, input_tokens: int, output_tokens: int, provider: str = 'gemini', model: str = "") -> float:
        p = self.providers.get(provider)
        if p:
            return p.calculate_cost(input_tokens, output_tokens, model)
        return 0.0

ai_service = AIService()
