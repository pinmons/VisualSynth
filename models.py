# models.py — Modelos Pydantic para validación de datos

from datetime import datetime
from pydantic import BaseModel, Field
from typing import Literal

# Claves válidas de modos visuales — se usan en validación de presets
VISUAL_MODES = Literal[
    "particles", "waves", "circles",
    "spiral", "tunnel", "pulses",
    "nebula", "rain", "rings",
    "stars", "vortex",
]

EFECTO_CLAVES = Literal[
    "rotacion",
    "distorsion",
    "cambioColor",
    "eco",
    "escalaDinamica",
]

FILTER_KEYS = Literal[
    "none",
    "glitch",
    "neon",
    "pixel",
    "vhs",
    "blur",
    "mirror",
    "invert",
    "rgb",
]


class PresetCreate(BaseModel):
    """Modelo para crear un nuevo preset."""
    name: str = Field(..., min_length=1, max_length=64)
    color: str = Field(..., description="Color en formato hex (#rrggbb)")
    speed: float = Field(..., ge=0.1, le=10.0)
    intensity: float = Field(..., ge=0.1, le=10.0)
    rotation: float = Field(..., ge=0.0, le=360.0)
    mode: str = Field(..., description="none | audio | camera | mixed")
    visual: VISUAL_MODES = Field(..., description="Clave del tipo visual activo")
    filter: FILTER_KEYS = Field(..., description="Filtro visual activo")


class PresetResponse(BaseModel):
    """Modelo de respuesta al consultar un preset."""
    id: int
    name: str
    color: str
    speed: float
    intensity: float
    rotation: float
    mode: str
    visual: str
    filter: FILTER_KEYS
    created_at: datetime


class TipoVisualResponse(BaseModel):
    """Modelo de respuesta para un tipo visual."""
    id: int
    nombre: str
    descripcion: str
    clave: str | None = None


class EfectoResponse(BaseModel):
    """Un efecto del catálogo."""
    id: int
    nombre: str
    descripcion: str
    clave: str


class VisualEfectoStateResponse(BaseModel):
    """Estado de un efecto asociado a un visual."""
    clave: str
    nombre: str
    activo: bool
    valor: float


class VisualEfectoPatch(BaseModel):
    """Actualización parcial de un efecto sobre un visual."""
    activo: bool | None = None
    valor: float | None = Field(None, ge=0.0, le=10.0)


class VisualEfectosBulkBody(BaseModel):
    """Cuerpo POST: mapa clave_efecto → campos a aplicar."""
    efectos: dict[str, VisualEfectoPatch] = Field(
        ...,
        description='Ej.: {"rotacion": {"activo": true}, "eco": {"activo": false, "valor": 1}}',
    )