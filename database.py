# database.py — Configuración de la base de datos SQLite para presets
import sqlite3

DB_PATH = "visualsynth.db"


def get_connection():
    """Retorna una conexión a la base de datos SQLite."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Permite acceder columnas por nombre
    return conn


def init_db():
    """Crea la tabla de presets si no existe."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS presets (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            name     TEXT    NOT NULL,
            color    TEXT    NOT NULL,
            speed    REAL    NOT NULL,
            intensity REAL   NOT NULL,
            rotation REAL    NOT NULL,
            mode     TEXT    NOT NULL,
            visual   TEXT    NOT NULL,
            created_at TEXT  DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    conn.close()
