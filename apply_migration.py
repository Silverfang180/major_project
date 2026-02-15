import psycopg2
import sys
import os
from dotenv import load_dotenv
from urllib.parse import urlparse

# Load .env file (check root, then chronicle subdir)
load_dotenv()
if not os.getenv("DATABASE_URL"):
    load_dotenv(os.path.join("chronicle", ".env"))

# Get DB config from environment or defaults
DATABASE_URL = os.getenv("DATABASE_URL")

# Parse DATABASE_URL if available, otherwise use defaults
if DATABASE_URL:
    try:
        result = urlparse(DATABASE_URL)
        DB_USER = result.username or "postgres"
        DB_PASS = result.password or "password"
        DB_HOST = result.hostname or "localhost"
        DB_PORT = result.port or "5433"
        DB_NAME = result.path[1:] if result.path else "chronicle"
    except Exception:
        print("Error parsing DATABASE_URL, falling back to defaults")
        DB_NAME = "chronicle"
        DB_USER = "postgres"
        DB_PASS = "password"
        DB_HOST = "localhost"
        DB_PORT = "5433"
else:
    # Fallback to defaults (user might need to edit this if not using .env)
    DB_NAME = "chronicle"
    DB_USER = "postgres"
    DB_PASS = "password"
    DB_HOST = "localhost"
    DB_PORT = "5433"

def apply_migration():
    print(f"Connecting to {DB_NAME} on {DB_HOST}:{DB_PORT}...")
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            host=DB_HOST,
            port=str(DB_PORT)
        )
        conn.autocommit = True
        cur = conn.cursor()
        
        print("Applying migration...")
        
        # Add deleted_at to prompts
        try:
            cur.execute("ALTER TABLE prompts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;")
            print("✓ Added deleted_at to prompts")
        except Exception as e:
            print(f"⚠ Error adding column to prompts: {e}")

        # Add deleted_at to prompt_versions
        try:
            cur.execute("ALTER TABLE prompt_versions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;")
            print("✓ Added deleted_at to prompt_versions")
        except Exception as e:
            print(f"⚠ Error adding column to prompt_versions: {e}")

        cur.close()
        conn.close()
        print("\nMigration applied successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration Failed: {e}")
        print("Please verify your database credentials in config.py or .env")
        sys.exit(1)

if __name__ == "__main__":
    apply_migration()
