import json
from pathlib import Path
from typing import Optional, Dict, Any

CONFIG_DIR = Path.home() / ".chronicle"
CONFIG_FILE = CONFIG_DIR / "config.json"

def get_config_path() -> Path:
    return CONFIG_FILE

def load_config() -> Optional[Dict[str, Any]]:
    if not CONFIG_FILE.exists():
        return None
    try:
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    except json.JSONDecodeError:
        return None

def save_environment(env_name: str, backend_url: str, api_key: str) -> None:
    """Saves or updates an environment configuration."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    
    config_data = load_config() or {"current_env": env_name, "environments": {}}
    
    clean_url = backend_url.rstrip("/")
    
    if "environments" not in config_data:
        config_data["environments"] = {}
        
    config_data["environments"][env_name] = {
        "backend_url": clean_url,
        "api_key": api_key
    }
    
    # If it's the first environment added, set it as current
    if not config_data.get("current_env"):
        config_data["current_env"] = env_name
        
    with open(CONFIG_FILE, "w") as f:
        json.dump(config_data, f, indent=2)

def set_current_environment(env_name: str) -> bool:
    """Sets the active environment. Returns False if env doesn't exist."""
    config_data = load_config()
    if not config_data or env_name not in config_data.get("environments", {}):
        return False
        
    config_data["current_env"] = env_name
    with open(CONFIG_FILE, "w") as f:
        json.dump(config_data, f, indent=2)
    return True

def get_current_context() -> Optional[Dict[str, str]]:
    """Returns the credentials for the currently active environment."""
    config_data = load_config()
    if not config_data:
        return None
        
    current_env = config_data.get("current_env")
    if not current_env:
        return None
        
    return config_data.get("environments", {}).get(current_env)
