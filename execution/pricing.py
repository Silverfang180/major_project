"""
Pricing Engine
Model-specific token pricing for cost tracking.

IDs verified against live Groq API on 2026-02-24.
Pricing: https://console.groq.com/docs/pricing
"""


MODEL_PRICING = {
    "openai/gpt-oss-120b": {
        "input_cost_per_1k": 0.00015,
        "output_cost_per_1k": 0.00060,
    },
    "openai/gpt-oss-20b": {
        "input_cost_per_1k": 0.00005,
        "output_cost_per_1k": 0.00008,
    },
    "moonshotai/kimi-k2-instruct": {
        "input_cost_per_1k": 0.00018,
        "output_cost_per_1k": 0.00050,
    },
    "meta-llama/llama-4-scout-17b-16e-instruct": {
        "input_cost_per_1k": 0.00020,
        "output_cost_per_1k": 0.00020,
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
        "input_cost_per_1k": 0.00007,
        "output_cost_per_1k": 0.00010,
    },
    "openai/gpt-oss-safeguard-20b": {
        "input_cost_per_1k": 0.00005,
        "output_cost_per_1k": 0.00010,
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
