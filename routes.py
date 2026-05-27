# routes.py — Rutas de la aplicación VisualSynth
from fastapi import APIRouter, Request, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse

from models import (
    PresetCreate,
    PresetResponse,
    TipoVisualResponse,
    EfectoResponse,
    VisualEfectoStateResponse,
    VisualEfectoPatch,
    VisualEfectosBulkBody,
)
from database import get_connection

router = APIRouter()
templates = Jinja2Templates(directory="templates")


def _resolve_tipo_visual_row(cursor, visual_ref: str):
    """Resuelve tipo_visual por id numérico o por clave (p. ej. spiral)."""
    ref = str(visual_ref).strip()
    if ref.isdigit():
        return cursor.execute("SELECT * FROM tipo_visual WHERE id = ?", (int(ref),)).fetchone()
    return cursor.execute("SELECT * FROM tipo_visual WHERE clave = ?", (ref,)).fetchone()


# ── Página principal ──────────────────────────────────────────────────────────

@router.get("/", response_class=HTMLResponse)
def index(request: Request):
    """Renderiza la página principal con Jinja2."""
    return templates.TemplateResponse("index.html", {"request": request})


# ── API de Tipos Visuales ─────────────────────────────────────────────────────

@router.get("/api/visualtypes", response_model=list[TipoVisualResponse])
def list_visual_types():
    """Retorna el catálogo completo de tipos visuales disponibles."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, nombre, descripcion, clave FROM tipo_visual ORDER BY id"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── API de Efectos y asociación Visual ↔ Efecto ─────────────────────────────

@router.get("/efectos", response_model=list[EfectoResponse])
@router.get("/api/efectos", response_model=list[EfectoResponse])
def list_efectos():
    """Catálogo global de efectos (misma información que la tabla Efecto)."""
    conn = get_connection()
    rows = conn.execute("SELECT id, nombre, descripcion, clave FROM efecto ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/visuales/{visual_ref}/efectos", response_model=list[VisualEfectoStateResponse])
@router.get("/api/visuales/{visual_ref}/efectos", response_model=list[VisualEfectoStateResponse])
def get_visual_efectos(visual_ref: str):
    """Estado de cada efecto para un visual (id numérico o clave: particles, spiral, …)."""
    conn = get_connection()
    cursor = conn.cursor()
    tv = _resolve_tipo_visual_row(cursor, visual_ref)
    if not tv:
        conn.close()
        raise HTTPException(status_code=404, detail="Visual no encontrado")
    rows = cursor.execute(
        """
        SELECT e.clave AS clave, e.nombre AS nombre, ve.activo AS activo, ve.valor AS valor
        FROM visual_efecto ve
        JOIN efecto e ON e.id = ve.efecto_id
        WHERE ve.visual_id = ?
        ORDER BY e.id
        """,
        (tv["id"],),
    ).fetchall()
    conn.close()
    return [
        {
            "clave": r["clave"],
            "nombre": r["nombre"],
            "activo": bool(r["activo"]),
            "valor": float(r["valor"]),
        }
        for r in rows
    ]


@router.post("/visuales/{visual_ref}/efectos", response_model=list[VisualEfectoStateResponse])
@router.post("/api/visuales/{visual_ref}/efectos", response_model=list[VisualEfectoStateResponse])
def post_visual_efectos(visual_ref: str, body: VisualEfectosBulkBody):
    """Actualiza varios efectos a la vez para el visual indicado."""
    conn = get_connection()
    cursor = conn.cursor()
    tv = _resolve_tipo_visual_row(cursor, visual_ref)
    if not tv:
        conn.close()
        raise HTTPException(status_code=404, detail="Visual no encontrado")
    vid = tv["id"]

    for clave, patch in body.efectos.items():
        erow = cursor.execute("SELECT id FROM efecto WHERE clave = ?", (clave,)).fetchone()
        if not erow:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Efecto desconocido: {clave}")
        eid = erow["id"]
        cur = cursor.execute(
            "SELECT activo, valor FROM visual_efecto WHERE visual_id = ? AND efecto_id = ?",
            (vid, eid),
        ).fetchone()
        if not cur:
            conn.close()
            raise HTTPException(status_code=404, detail="Relación visual_efecto no inicializada")
        new_activo = cur["activo"] if patch.activo is None else (1 if patch.activo else 0)
        new_valor = cur["valor"] if patch.valor is None else float(patch.valor)
        cursor.execute(
            """
            UPDATE visual_efecto
            SET activo = ?, valor = ?
            WHERE visual_id = ? AND efecto_id = ?
            """,
            (new_activo, new_valor, vid, eid),
        )

    conn.commit()
    conn.close()
    return get_visual_efectos(visual_ref)


@router.put("/visuales/{visual_ref}/efectos/{efecto_clave}", response_model=VisualEfectoStateResponse)
@router.put("/api/visuales/{visual_ref}/efectos/{efecto_clave}", response_model=VisualEfectoStateResponse)
def put_visual_efecto(visual_ref: str, efecto_clave: str, body: VisualEfectoPatch):
    """Actualiza un efecto concreto (activo y/o valor) para el visual indicado."""
    conn = get_connection()
    cursor = conn.cursor()
    tv = _resolve_tipo_visual_row(cursor, visual_ref)
    if not tv:
        conn.close()
        raise HTTPException(status_code=404, detail="Visual no encontrado")
    erow = cursor.execute("SELECT id, nombre FROM efecto WHERE clave = ?", (efecto_clave,)).fetchone()
    if not erow:
        conn.close()
        raise HTTPException(status_code=404, detail="Efecto no encontrado")
    vid, eid = tv["id"], erow["id"]
    cur = cursor.execute(
        "SELECT activo, valor FROM visual_efecto WHERE visual_id = ? AND efecto_id = ?",
        (vid, eid),
    ).fetchone()
    if not cur:
        conn.close()
        raise HTTPException(status_code=404, detail="Relación visual_efecto no encontrada")
    new_activo = cur["activo"] if body.activo is None else (1 if body.activo else 0)
    new_valor = cur["valor"] if body.valor is None else float(body.valor)
    cursor.execute(
        """
        UPDATE visual_efecto
        SET activo = ?, valor = ?
        WHERE visual_id = ? AND efecto_id = ?
        """,
        (new_activo, new_valor, vid, eid),
    )
    conn.commit()
    conn.close()
    return {
        "clave": efecto_clave,
        "nombre": erow["nombre"],
        "activo": bool(new_activo),
        "valor": float(new_valor),
    }


# ── API de Presets ────────────────────────────────────────────────────────────

@router.post("/api/presets", response_model=PresetResponse, status_code=201)
def save_preset(preset: PresetCreate):
    """Guarda la configuración actual como preset. Retorna el preset creado."""
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

    conn = get_connection()
    row = conn.execute("SELECT * FROM presets WHERE id = ?", (new_id,)).fetchone()
    conn.close()
    return dict(row)


@router.get("/api/presets", response_model=list[PresetResponse])
def list_presets():
    """Retorna todos los presets guardados, del más reciente al más antiguo."""
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
