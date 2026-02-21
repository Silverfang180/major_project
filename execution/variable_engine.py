"""
Variable Injection Engine
Heart of PromptOps - extracts, validates, and renders prompt templates.

Syntax: {{variable_name}}
Mode: Strict (rejects extra variables)
"""

import re
from string import Template
from typing import Any


class VariableError(Exception):
    """Raised when variable validation fails."""
    pass


# Custom template that uses {{var}} syntax instead of $var
class PromptTemplate(Template):
    delimiter = '{{'
    pattern = r'''
    \{\{(?:
      (?P<escaped>\{\{)|
      (?P<named>[_a-z][_a-z0-9]*)\}\}|
      (?P<braced>[_a-z][_a-z0-9]*)\}\}|
      (?P<invalid>)
    )
    '''


def extract_placeholders(template_text: str) -> set[str]:
    """
    Extract all {{variable}} placeholders from template.
    
    Args:
        template_text: The prompt template containing {{var}} placeholders
        
    Returns:
        Set of variable names found in the template
    """
    pattern = r'\{\{([_a-zA-Z][_a-zA-Z0-9]*)\}\}'
    matches = re.findall(pattern, template_text)
    return set(matches)


def validate_variables(
    required: set[str], 
    provided: dict[str, Any],
    strict: bool = True
) -> None:
    """
    Validate that provided variables match required placeholders.
    
    Args:
        required: Set of variable names required by template
        provided: Dict of variables provided at execution time
        strict: If True, reject extra variables (default: True)
        
    Raises:
        VariableError: If validation fails (missing or extra vars)
    """
    provided_keys = set(provided.keys())
    
    # Check for missing variables
    missing = required - provided_keys
    if missing:
        raise VariableError(
            f"Missing required variables: {sorted(missing)}"
        )
    
    # Strict mode: check for extra variables
    if strict:
        extra = provided_keys - required
        if extra:
            raise VariableError(
                f"Unexpected variables provided: {sorted(extra)}. "
                f"Expected only: {sorted(required)}"
            )


def render_prompt(template_text: str, variables: dict[str, Any]) -> str:
    """
    Render a prompt template with provided variables.
    
    Uses string.Template for safe, deterministic rendering.
    All values are converted to strings.
    
    Args:
        template_text: The prompt template with {{var}} placeholders
        variables: Dict of variable name -> value
        
    Returns:
        Rendered prompt string
    """
    # Convert all values to strings
    str_vars = {k: str(v) for k, v in variables.items()}
    
    # Simple replacement approach for {{var}} syntax
    result = template_text
    for key, value in str_vars.items():
        result = result.replace(f"{{{{{key}}}}}", value)
    
    return result
