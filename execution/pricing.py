"""
Pricing Engine
Model-specific token pricing for cost tracking.
"""


MODEL_PRICING = {
    "llama-3.3-70b-versatile": {
        "input_cost_per_1k": 0.00059,
        "output_cost_per_1k": 0.00079
    },
    "llama3-70b-8192": {
        "input_cost_per_1k": 0.00059,
        "output_cost_per_1k": 0.00079
    },
    "llama-3.1-8b-instant": {
        "input_cost_per_1k": 0.00005,
        "output_cost_per_1k": 0.00008
    },
    "mixtral-8x7b-32768": {
        "input_cost_per_1k": 0.00024,
        "output_cost_per_1k": 0.00024
    },
    "gemma2-9b-it": {
        "input_cost_per_1k": 0.00020,
        "output_cost_per_1k": 0.00020
    }
}


def calculate_cost(model_name: str, prompt_tokens: int, completion_tokens: int) -> float | None:
    pricing = MODEL_PRICING.get(model_name)
    if not pricing:
        return None
    return (
        (prompt_tokens / 1000 * pricing["input_cost_per_1k"]) +
        (completion_tokens / 1000 * pricing["output_cost_per_1k"])
    )
