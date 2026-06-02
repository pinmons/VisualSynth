# routes.py — Rutas de la aplicación VisualSynth (PostgreSQL)

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
    """Resuelve tipo_visual por id numérico o por clave."""
    ref = str(visual_ref).strip()

    if ref.isdigit():
        cursor.execute(
            "SELECT * FROM tipo_visual WHERE id = %s",
            (int(ref),)
        )
        return cursor.fetchone()

    cursor.execute(
        "SELECT * FROM tipo_visual WHERE clave = %s",
        (ref,)
    )
    return cursor.fetchone()


# ─────────────────────────────────────────────────────────────────────────────
# Página principal
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request}
    )


# ─────────────────────────────────────────────────────────────────────────────
# API Tipos Visuales
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/visualtypes", response_model=list[TipoVisualResponse])
def list_visual_types():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, nombre, descripcion, clave
        FROM tipo_visual
        ORDER BY id
    """)

    rows = cursor.fetchall()

    conn.close()

    return [dict(r) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# API Efectos
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/efectos", response_model=list[EfectoResponse])
@router.get("/api/efectos", response_model=list[EfectoResponse])
def list_efectos():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, nombre, descripcion, clave
        FROM efecto
        ORDER BY id
    """)

    rows = cursor.fetchall()

    conn.close()

    return [dict(r) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# Obtener efectos de un visual
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/visuales/{visual_ref}/efectos",
    response_model=list[VisualEfectoStateResponse]
)

@router.get(
    "/api/visuales/{visual_ref}/efectos",
    response_model=list[VisualEfectoStateResponse]
)

def get_visual_efectos(visual_ref: str):

    conn = get_connection()
    cursor = conn.cursor()

    tv = _resolve_tipo_visual_row(cursor, visual_ref)

    if not tv:
        conn.close()
        raise HTTPException(status_code=404, detail="Visual no encontrado")

    cursor.execute("""
        SELECT
            e.clave AS clave,
            e.nombre AS nombre,
            ve.activo AS activo,
            ve.valor AS valor
        FROM visual_efecto ve
        JOIN efecto e ON e.id = ve.efecto_id
        WHERE ve.visual_id = %s
        ORDER BY e.id
    """, (tv["id"],))

    rows = cursor.fetchall()

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


# ─────────────────────────────────────────────────────────────────────────────
# Actualizar múltiples efectos
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/visuales/{visual_ref}/efectos",
    response_model=list[VisualEfectoStateResponse]
)

@router.post(
    "/api/visuales/{visual_ref}/efectos",
    response_model=list[VisualEfectoStateResponse]
)

def post_visual_efectos(
    visual_ref: str,
    body: VisualEfectosBulkBody
):

    conn = get_connection()
    cursor = conn.cursor()

    tv = _resolve_tipo_visual_row(cursor, visual_ref)

    if not tv:
        conn.close()
        raise HTTPException(status_code=404, detail="Visual no encontrado")

    vid = tv["id"]

    for clave, patch in body.efectos.items():

        cursor.execute(
            "SELECT id FROM efecto WHERE clave = %s",
            (clave,)
        )

        erow = cursor.fetchone()

        if not erow:
            conn.close()
            raise HTTPException(
                status_code=404,
                detail=f"Efecto desconocido: {clave}"
            )

        eid = erow["id"]

        cursor.execute("""
            SELECT activo, valor
            FROM visual_efecto
            WHERE visual_id = %s
            AND efecto_id = %s
        """, (vid, eid))

        cur = cursor.fetchone()

        if not cur:
            conn.close()
            raise HTTPException(
                status_code=404,
                detail="Relación visual_efecto no inicializada"
            )

        new_activo = (
            cur["activo"]
            if patch.activo is None
            else (1 if patch.activo else 0)
        )

        new_valor = (
            cur["valor"]
            if patch.valor is None
            else float(patch.valor)
        )

        cursor.execute("""
            UPDATE visual_efecto
            SET activo = %s,
                valor = %s
            WHERE visual_id = %s
            AND efecto_id = %s
        """, (
            new_activo,
            new_valor,
            vid,
            eid
        ))

    conn.commit()
    conn.close()

    return get_visual_efectos(visual_ref)


# ─────────────────────────────────────────────────────────────────────────────
# Actualizar un efecto específico
# ─────────────────────────────────────────────────────────────────────────────

@router.put(
    "/visuales/{visual_ref}/efectos/{efecto_clave}",
    response_model=VisualEfectoStateResponse
)

@router.put(
    "/api/visuales/{visual_ref}/efectos/{efecto_clave}",
    response_model=VisualEfectoStateResponse
)

def put_visual_efecto(
    visual_ref: str,
    efecto_clave: str,
    body: VisualEfectoPatch
):

    conn = get_connection()
    cursor = conn.cursor()

    tv = _resolve_tipo_visual_row(cursor, visual_ref)

    if not tv:
        conn.close()
        raise HTTPException(status_code=404, detail="Visual no encontrado")

    cursor.execute("""
        SELECT id, nombre
        FROM efecto
        WHERE clave = %s
    """, (efecto_clave,))

    erow = cursor.fetchone()

    if not erow:
        conn.close()
        raise HTTPException(status_code=404, detail="Efecto no encontrado")

    vid = tv["id"]
    eid = erow["id"]

    cursor.execute("""
        SELECT activo, valor
        FROM visual_efecto
        WHERE visual_id = %s
        AND efecto_id = %s
    """, (vid, eid))

    cur = cursor.fetchone()

    if not cur:
        conn.close()
        raise HTTPException(
            status_code=404,
            detail="Relación visual_efecto no encontrada"
        )

    new_activo = (
        cur["activo"]
        if body.activo is None
        else (1 if body.activo else 0)
    )

    new_valor = (
        cur["valor"]
        if body.valor is None
        else float(body.valor)
    )

    cursor.execute("""
        UPDATE visual_efecto
        SET activo = %s,
            valor = %s
        WHERE visual_id = %s
        AND efecto_id = %s
    """, (
        new_activo,
        new_valor,
        vid,
        eid
    ))

    conn.commit()
    conn.close()

    return {
        "clave": efecto_clave,
        "nombre": erow["nombre"],
        "activo": bool(new_activo),
        "valor": float(new_valor),
    }


# ─────────────────────────────────────────────────────────────────────────────
# API Presets
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/api/presets",
    response_model=PresetResponse,
    status_code=201
)

def save_preset(preset: PresetCreate):

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO presets
        (
            name,
            color,
            speed,
            intensity,
            rotation,
            mode,
            visual,
            filter
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        preset.name,
        preset.color,
        preset.speed,
        preset.intensity,
        preset.rotation,
        preset.mode,
        preset.visual,
        preset.filter,
    ))

    new_id = cursor.fetchone()["id"]

    conn.commit()

    cursor.execute(
        "SELECT * FROM presets WHERE id = %s",
        (new_id,)
    )

    row = cursor.fetchone()

    conn.close()

    return dict(row)


@router.get(
    "/api/presets",
    response_model=list[PresetResponse]
)

def list_presets():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
        FROM presets
        ORDER BY id DESC
    """)

    rows = cursor.fetchall()

    conn.close()

    return [dict(r) for r in rows]


@router.delete(
    "/api/presets/{preset_id}",
    status_code=204
)

def delete_preset(preset_id: int):

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "DELETE FROM presets WHERE id = %s",
        (preset_id,)
    )

    deleted = cursor.rowcount

    conn.commit()
    conn.close()

    if deleted == 0:
        raise HTTPException(
            status_code=404,
            detail="Preset no encontrado"
        )
