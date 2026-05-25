# models.py — Modelos Pydantic para validación de datos
from pydantic import BaseModel, Field


class PresetCreate(BaseModel):
    """Modelo para crear un nuevo preset."""
    name: str = Field(..., min_length=1, max_length=64, description="Nombre del preset")
    color: str = Field(..., description="Color principal en formato hex (#rrggbb)")
    speed: float = Field(..., ge=0.1, le=10.0, description="Velocidad de la animación")
    intensity: float = Field(..., ge=0.1, le=10.0, description="Intensidad visual")
    rotation: float = Field(..., ge=0.0, le=360.0, description="Ángulo de rotación base")
    mode: str = Field(..., description="Modo de entrada: audio | camera | mixed | none")
    visual: str = Field(..., description="Modo visual: particles | waves | circles")


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
    created_at: str
