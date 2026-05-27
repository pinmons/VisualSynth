# database.py — Configuración de la base de datos SQLite para presets, visuales y efectos
import sqlite3

DB_PATH = "visualsynth.db"

# Catálogo completo de tipos visuales: (clave_api, nombre_ui, descripción)
VISUAL_TYPES = [
    ("particles",  "Partículas",           "Pool de partículas con vida, velocidad y rotación"),
    ("waves",      "Ondas",                "Líneas sinusoidales superpuestas y animadas"),
    ("circles",    "Círculos",             "Anillos concéntricos pulsantes con rotación"),
    ("spiral",     "Espiral",              "Partículas girando desde el centro hacia afuera"),
    ("tunnel",     "Túnel",                "Objetos aproximándose generando sensación de profundidad"),
    ("pulses",     "Pulsos",               "Ondas expansivas repetidas desde el centro"),
    ("nebula",     "Nebulosa",             "Partículas suaves y difusas flotando en el espacio"),
    ("rain",       "Lluvia de partículas", "Partículas cayendo continuamente desde la parte superior"),
    ("rings",      "Anillos reactivos",    "Círculos concéntricos que reaccionan a audio o movimiento"),
    ("stars",      "Estrellas",            "Campo estelar en movimiento con efecto parallax"),
    ("vortex",     "Vórtice",              "Partículas absorbidas en espiral hacia el centro"),
]

# Catálogo de efectos: (clave_api, nombre, descripción)
EFECTO_TYPES = [
    ("rotacion",       "Rotación",        "Giro continuo del visual alrededor del centro"),
    ("glow",           "Glow",            "Resplandor alrededor de las formas dibujadas"),
    ("distorsion",     "Distorsión",      "Deforma levemente el plano de dibujo en el tiempo"),
    ("cambioColor",    "CambioColor",     "Ciclo dinámico de tono sobre el visual"),
    ("eco",            "Eco",             "Rastro más persistente entre fotogramas"),
    ("escalaDinamica", "EscalaDinamica",  "Escala pulsátil ligada al audio o al movimiento"),
]

# Valores iniciales de activo por clave de efecto (al poblar visual_efecto)
DEFAULT_EFECTO_ACTIVO = {
    "rotacion":       1,
    "glow":           1,
    "distorsion":     0,
    "cambioColor":    1,
    "eco":            0,
    "escalaDinamica": 1,
}


def get_connection():
    """Retorna una conexión a la base de datos SQLite."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _column_names(cursor, table: str) -> set[str]:
    cursor.execute("PRAGMA table_info(%s)" % table)
    return {row[1] for row in cursor.fetchall()}


def init_db():
    """Crea las tablas necesarias, migra columnas e inserta datos base."""
    conn = get_connection()
    cursor = conn.cursor()

    # ── Tabla de presets ─────────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS presets (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL,
            color      TEXT    NOT NULL,
            speed      REAL    NOT NULL,
            intensity  REAL    NOT NULL,
            rotation   REAL    NOT NULL,
            mode       TEXT    NOT NULL,
            visual     TEXT    NOT NULL,
            created_at TEXT    DEFAULT (datetime('now'))
        )
    """)

    # ── Tabla de tipos visuales ───────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tipo_visual (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre      TEXT    NOT NULL UNIQUE,
            descripcion TEXT    NOT NULL
        )
    """)

    cols_tv = _column_names(cursor, "tipo_visual")
    if "clave" not in cols_tv:
        cursor.execute("ALTER TABLE tipo_visual ADD COLUMN clave TEXT")

    cursor.executemany(
        "INSERT OR IGNORE INTO tipo_visual (nombre, descripcion) VALUES (?, ?)",
        [(nombre, desc) for (_, nombre, desc) in VISUAL_TYPES],
    )

    for clave, nombre, desc in VISUAL_TYPES:
        cursor.execute(
            """
            UPDATE tipo_visual
            SET descripcion = ?, clave = ?
            WHERE nombre = ?
            """,
            (desc, clave, nombre),
        )

    # ── Tabla Efecto ──────────────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS efecto (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre      TEXT    NOT NULL,
            descripcion TEXT    NOT NULL,
            clave       TEXT    NOT NULL UNIQUE
        )
    """)

    cursor.executemany(
        """
        INSERT OR IGNORE INTO efecto (nombre, descripcion, clave)
        VALUES (?, ?, ?)
        """,
        [(nombre, desc, clave) for (clave, nombre, desc) in EFECTO_TYPES],
    )

    for clave, nombre, desc in EFECTO_TYPES:
        cursor.execute(
            """
            UPDATE efecto
            SET nombre = ?, descripcion = ?
            WHERE clave = ?
            """,
            (nombre, desc, clave),
        )

    # ── Tabla visual_efecto (N:N) ─────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS visual_efecto (
            visual_id INTEGER NOT NULL,
            efecto_id INTEGER NOT NULL,
            activo    INTEGER NOT NULL DEFAULT 0,
            valor     REAL    NOT NULL DEFAULT 1.0,
            PRIMARY KEY (visual_id, efecto_id),
            FOREIGN KEY (visual_id) REFERENCES tipo_visual(id) ON DELETE CASCADE,
            FOREIGN KEY (efecto_id) REFERENCES efecto(id) ON DELETE CASCADE
        )
    """)

    # Poblar combinaciones (solo filas nuevas)
    rows_v = cursor.execute(
        "SELECT id, clave FROM tipo_visual WHERE clave IS NOT NULL AND clave != ''"
    ).fetchall()
    rows_e = cursor.execute("SELECT id, clave FROM efecto").fetchall()
    for v in rows_v:
        vid = v["id"]
        for e in rows_e:
            eid = e["id"]
            def_act = DEFAULT_EFECTO_ACTIVO.get(e["clave"], 0)
            cursor.execute(
                """
                INSERT OR IGNORE INTO visual_efecto (visual_id, efecto_id, activo, valor)
                VALUES (?, ?, ?, 1.0)
                """,
                (vid, eid, def_act),
            )

    conn.commit()
    conn.close()
