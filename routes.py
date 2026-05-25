# routes.py — Rutas de la aplicación VisualSynth
from fastapi import APIRouter, Request, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse

from models import PresetCreate, PresetResponse
from database import get_connection

router = APIRouter()
templates = Jinja2Templates(directory="templates")


# ── Página principal ──────────────────────────────────────────────────────────

@router.get("/", response_class=HTMLResponse)
def index(request: Request):
    """Renderiza la página principal con Jinja2."""
    return templates.TemplateResponse("index.html", {"request": request})


# ── API de Presets ────────────────────────────────────────────────────────────

@router.post("/api/presets", response_model=PresetResponse, status_code=201)
def save_preset(preset: PresetCreate):
    """
    Guarda la configuración actual como un preset con nombre.
    Retorna el preset creado incluyendo su id generado.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO presets (name, color, speed, intensity, rotation, mode, visual)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (preset.name, preset.color, preset.speed,
         preset.intensity, preset.rotation, preset.mode, preset.visual)
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()

    # Recuperar el registro recién creado para retornar con fecha
    conn = get_connection()
    row = conn.execute("SELECT * FROM presets WHERE id = ?", (new_id,)).fetchone()
    conn.close()

    return dict(row)


@router.get("/api/presets", response_model=list[PresetResponse])
def list_presets():
    """Retorna todos los presets guardados, ordenados del más reciente al más antiguo."""
    conn = get_connection()
    rows = conn.execute("SELECT * FROM presets ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.delete("/api/presets/{preset_id}", status_code=204)
def delete_preset(preset_id: int):
    """Elimina un preset por su id."""
    conn = get_connection()
    result = conn.execute("DELETE FROM presets WHERE id = ?", (preset_id,))
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Preset no encontrado")
