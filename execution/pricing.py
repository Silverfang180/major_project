"""
Pricing Engine
Model-specific token pricing for cost tracking.

IDs verified against live Groq API on 2026-02-24.
Pricing: https://console.groq.com/docs/pricing
"""


MODEL_PRICING = {
    # Groq
    "llama-3.3-70b-versatile": {
        "input_cost_per_1k": 0.00059,
        "output_cost_per_1k": 0.00079,
    },
    "llama-3.1-8b-instant": {
        "input_cost_per_1k": 0.00005,
        "output_cost_per_1k": 0.00008,
    },
    "llama3-8b-8192": {
        "input_cost_per_1k": 0.00005,
        "output_cost_per_1k": 0.00008,
    },
    "mixtral-8x7b-32768": {
        "input_cost_per_1k": 0.00024,
        "output_cost_per_1k": 0.00024,
    },
    # Gemini
    "gemini-1.5-flash": {
        "input_cost_per_1k": 0.0001,
        "output_cost_per_1k": 0.0003,
    },
    "gemini-1.5-pro": {
        "input_cost_per_1k": 0.00125,
        "output_cost_per_1k": 0.00375,
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
