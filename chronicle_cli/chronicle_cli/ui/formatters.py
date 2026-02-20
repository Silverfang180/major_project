from datetime import datetime, timezone
import dateutil.parser

def format_time_ago(timestamp_str: str) -> str:
    """Converts an ISO timestamp into a relative 'time ago' string."""
    if not timestamp_str:
        return "unknown time"
        
    try:
        dt = dateutil.parser.isoparse(timestamp_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
            
        now = datetime.now(timezone.utc)
        diff = now - dt
        
        seconds = diff.total_seconds()
        if seconds < 60:
            return "just now"
        elif seconds < 3600:
            return f"{int(seconds // 60)}m ago"
        elif seconds < 86400:
            return f"{int(seconds // 3600)}h ago"
        else:
            return f"{int(seconds // 86400)}d ago"
    except Exception:
        return timestamp_str
