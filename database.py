# database.py — Configuración PostgreSQL para VisualSynth

import psycopg2
from psycopg2.extras import RealDictCursor
import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://usuario:password@localhost:5432/visualsynth"
)

# Catálogo completo de tipos visuales
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

EFECTO_TYPES = [
    ("rotacion",       "Rotación",        "Giro continuo del visual alrededor del centro"),
    ("glow",           "Glow",            "Resplandor alrededor de las formas dibujadas"),
    ("distorsion",     "Distorsión",      "Deforma levemente el plano de dibujo en el tiempo"),
    ("cambioColor",    "CambioColor",     "Ciclo dinámico de tono sobre el visual"),
    ("eco",            "Eco",             "Rastro más persistente entre fotogramas"),
    ("escalaDinamica", "EscalaDinamica",  "Escala pulsátil ligada al audio o al movimiento"),
]

DEFAULT_EFECTO_ACTIVO = {
    "rotacion":       1,
    "glow":           1,
    "distorsion":     0,
    "cambioColor":    1,
    "eco":            0,
    "escalaDinamica": 1,
}


def get_connection():
    return psycopg2.connect(
        DATABASE_URL,
        cursor_factory=RealDictCursor
    )


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Tabla presets
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS presets (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            speed REAL NOT NULL,
            intensity REAL NOT NULL,
            rotation REAL NOT NULL,
            mode TEXT NOT NULL,
            visual TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Tabla tipo_visual
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tipo_visual (
            id SERIAL PRIMARY KEY,
            nombre TEXT NOT NULL UNIQUE,
            descripcion TEXT NOT NULL,
            clave TEXT UNIQUE
        )
    """)

    # Tabla efecto
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS efecto (
            id SERIAL PRIMARY KEY,
            nombre TEXT NOT NULL,
            descripcion TEXT NOT NULL,
            clave TEXT NOT NULL UNIQUE
        )
    """)

    # Tabla visual_efecto
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS visual_efecto (
            visual_id INTEGER NOT NULL,
            efecto_id INTEGER NOT NULL,
            activo INTEGER NOT NULL DEFAULT 0,
            valor REAL NOT NULL DEFAULT 1.0,
            PRIMARY KEY (visual_id, efecto_id),
            FOREIGN KEY (visual_id) REFERENCES tipo_visual(id) ON DELETE CASCADE,
            FOREIGN KEY (efecto_id) REFERENCES efecto(id) ON DELETE CASCADE
        )
    """)

    # Insertar visuales
    for clave, nombre, desc in VISUAL_TYPES:
        cursor.execute("""
            INSERT INTO tipo_visual (nombre, descripcion, clave)
            VALUES (%s, %s, %s)
            ON CONFLICT (nombre)
            DO UPDATE SET
                descripcion = EXCLUDED.descripcion,
                clave = EXCLUDED.clave
        """, (nombre, desc, clave))

    # Insertar efectos
    for clave, nombre, desc in EFECTO_TYPES:
        cursor.execute("""
            INSERT INTO efecto (nombre, descripcion, clave)
            VALUES (%s, %s, %s)
            ON CONFLICT (clave)
            DO UPDATE SET
                nombre = EXCLUDED.nombre,
                descripcion = EXCLUDED.descripcion
        """, (nombre, desc, clave))

    # Poblar relaciones
    cursor.execute("SELECT id, clave FROM tipo_visual")
    visuals = cursor.fetchall()

    cursor.execute("SELECT id, clave FROM efecto")
    efectos = cursor.fetchall()

    for v in visuals:
        for e in efectos:
            def_act = DEFAULT_EFECTO_ACTIVO.get(e["clave"], 0)

            cursor.execute("""
                INSERT INTO visual_efecto
                (visual_id, efecto_id, activo, valor)
                VALUES (%s, %s, %s, 1.0)
                ON CONFLICT (visual_id, efecto_id)
                DO NOTHING
            """, (v["id"], e["id"], def_act))

    conn.commit()
    cursor.close()
    conn.close()
