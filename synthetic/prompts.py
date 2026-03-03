"""
LLM prompt templates for the synthetic dataset generator.
Pure constants — no logic. All placeholders use {name} format.
"""

# ---------------------------------------------------------------------------
# Topic variant listing (shared between classification and QA)
# ---------------------------------------------------------------------------

TOPIC_VARIANTS_PROMPT = """\
You are helping generate a diverse evaluation dataset.

Domain topic: {topic}
Task type: {task_type}

Generate exactly {n} distinct sub-topics or angles for this domain that would \
produce varied evaluation examples. Return a JSON array of strings only.

Example output format:
["sub-topic 1", "sub-topic 2", "sub-topic 3"]

Return only the JSON array. No preamble, no markdown, no explanation.
"""

# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

CLASSIFICATION_GENERATOR_PROMPT = """\
You are generating synthetic evaluation examples for a text classification dataset.

Task: {topic}
Labels: {labels}
Difficulty: {difficulty_level}
Difficulty definition: {difficulty_definition}
Edge case type (if applicable): {edge_case_type}
Required topic variant: {topic_variant}

Generate exactly ONE example. Return a JSON object with these exact keys:
{{
  "input_text": "<the text to classify>",
  "expected_label": "<one of: {labels}>",
  "difficulty": "{difficulty_level}",
  "edge_case_type": "<edge case type or null>",
  "topic_variant": "<sub-topic this example covers>",
  "generation_reasoning": "<one sentence explaining why this example has the stated difficulty>"
}}

Return only the JSON object. No preamble, no markdown, no explanation.
Keep your response under 400 tokens.
"""

CLASSIFICATION_VALIDATOR_PROMPT = """\
You are validating a synthetic classification example for quality and correctness.

Task: {topic}
Labels: {labels}

Example to validate:
Input: {input_text}
Expected label: {expected_label}
Stated difficulty: {difficulty_level}
Difficulty definition: {difficulty_definition}
Edge case type: {edge_case_type}

Validation criteria:
{criteria}

Return a JSON object with these exact keys:
{{
  "passes": true | false,
  "confidence": <float 0.0-1.0>,
  "failed_criteria": [<list of failed criteria strings, empty if passes>],
  "reasoning": "<one sentence>"
}}

Return only the JSON object. No preamble, no markdown, no explanation.
"""

# ---------------------------------------------------------------------------
# QA
# ---------------------------------------------------------------------------

QA_GENERATOR_PROMPT = """\
You are generating synthetic evaluation examples for a question-answering dataset.

Domain topic: {topic}
Context style: {context_style}
Answer type: {answer_type}
Difficulty: {difficulty_level}
Difficulty definition: {difficulty_definition}
Edge case type (if applicable): {edge_case_type}
Required topic variant: {topic_variant}

Generate exactly ONE example. Return a JSON object with these exact keys:
{{
  "context": "<a passage of text that contains or relates to the answer>",
  "question": "<a question answerable from the context>",
  "expected_answer": "<the correct answer>",
  "answer_span": "<exact substring from context if extractive, else null>",
  "difficulty": "{difficulty_level}",
  "edge_case_type": "<edge case type or null>",
  "topic_variant": "<sub-topic this example covers>",
  "generation_reasoning": "<one sentence explaining why this example has the stated difficulty>"
}}

Return only the JSON object. No preamble, no markdown, no explanation.
Keep your response under 400 tokens.
"""

QA_VALIDATOR_PROMPT = """\
You are validating a synthetic question-answering example for quality and correctness.

Domain topic: {topic}
Answer type: {answer_type}

Example to validate:
Context: {context}
Question: {question}
Expected answer: {expected_answer}
Answer span: {answer_span}
Stated difficulty: {difficulty_level}
Difficulty definition: {difficulty_definition}
Edge case type: {edge_case_type}

Validation criteria:
{criteria}

Return a JSON object with these exact keys:
{{
  "passes": true | false,
  "confidence": <float 0.0-1.0>,
  "failed_criteria": [<list of failed criteria strings, empty if passes>],
  "reasoning": "<one sentence>"
}}

Return only the JSON object. No preamble, no markdown, no explanation.
"""
