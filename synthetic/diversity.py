"""
Diversity checker — pure Python, no LLM calls.
Uses Jaccard similarity on word sets to detect near-duplicate examples.
"""

import re
import string


def _word_set(text: str) -> set[str]:
    """Lowercase and strip punctuation, return word set."""
    text = text.lower()
    text = text.translate(str.maketrans("", "", string.punctuation))
    return set(text.split())


def is_too_similar(candidate: str, existing: list[str], threshold: float) -> bool:
    """
    Returns True if candidate shares more than `threshold` word overlap
    with any single example in `existing`.
    Uses Jaccard similarity on word sets (lowercased, punctuation stripped).
    """
    candidate_words = _word_set(candidate)
    if not candidate_words:
        return False

    for existing_text in existing:
        existing_words = _word_set(existing_text)
        if not existing_words:
            continue
        intersection = candidate_words & existing_words
        union = candidate_words | existing_words
        jaccard = len(intersection) / len(union)
        if jaccard > threshold:
            return True

    return False
