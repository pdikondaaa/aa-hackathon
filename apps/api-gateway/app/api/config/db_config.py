import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

# Load root .env so API code can use shared parent environment values.
ROOT_ENV = Path(__file__).resolve().parents[5] / ".env"
load_dotenv(ROOT_ENV)

DB_CONFIG = {
    "host": os.getenv("DB_HOST", os.getenv("SQL_HOST", "hackathon.alignedautomation.com")),
    "port": int(os.getenv("DB_PORT", os.getenv("SQL_PORT", 5432))),
    "dbname": os.getenv("DB_NAME", os.getenv("SQL_DB", "squadrons")),
    "user": os.getenv("DB_USER", os.getenv("SQL_USERNAME", "squadrons")),
    "password": os.getenv("DB_PASSWORD", os.getenv("SQL_PWD", "TwlU0KL1LZbZLYS$")),
}


def get_db_connection():
    return psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)
