"""
Pricing Engine
Model-specific token pricing for cost tracking.

IDs verified against live Groq API on 2026-02-24.
Pricing: https://console.groq.com/docs/pricing
"""


MODEL_PRICING = {
    "openai/gpt-oss-120b": {
        "input_cost_per_1k": 0.0,   # TODO: update from https://console.groq.com/docs/pricing
        "output_cost_per_1k": 0.0,  # TODO: update from https://console.groq.com/docs/pricing
    },
    "openai/gpt-oss-20b": {
        "input_cost_per_1k": 0.0,   # TODO: update from https://console.groq.com/docs/pricing
        "output_cost_per_1k": 0.0,  # TODO: update from https://console.groq.com/docs/pricing
    },
    "moonshotai/kimi-k2-instruct": {
        "input_cost_per_1k": 0.0,   # TODO: update from https://console.groq.com/docs/pricing
        "output_cost_per_1k": 0.0,  # TODO: update from https://console.groq.com/docs/pricing
    },
    "meta-llama/llama-4-scout-17b-16e-instruct": {
        "input_cost_per_1k": 0.0,   # TODO: update from https://console.groq.com/docs/pricing
        "output_cost_per_1k": 0.0,  # TODO: update from https://console.groq.com/docs/pricing
    },
    "llama-3.3-70b-versatile": {
        "input_cost_per_1k": 0.00059,
        "output_cost_per_1k": 0.00079,
    },
    "llama-3.1-8b-instant": {
        "input_cost_per_1k": 0.00005,
        "output_cost_per_1k": 0.00008,
    },
    "qwen/qwen3-32b": {
        "input_cost_per_1k": 0.0,   # TODO: update from https://console.groq.com/docs/pricing
        "output_cost_per_1k": 0.0,  # TODO: update from https://console.groq.com/docs/pricing
    },
    "openai/gpt-oss-safeguard-20b": {
        "input_cost_per_1k": 0.0,   # TODO: update from https://console.groq.com/docs/pricing
        "output_cost_per_1k": 0.0,  # TODO: update from https://console.groq.com/docs/pricing
    },
}


def calculate_cost(model_name: str, prompt_tokens: int, completion_tokens: int) -> float | None:
    pricing = MODEL_PRICING.get(model_name)
    if not pricing:
        return None
    return (
        (prompt_tokens / 1000 * pricing["input_cost_per_1k"]) +
        (completion_tokens / 1000 * pricing["output_cost_per_1k"])
    )
