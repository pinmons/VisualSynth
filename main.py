# main.py — Punto de entrada de la aplicación VisualSynth
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from database import init_db
from routes import router

# Crear instancia de la aplicación
app = FastAPI(title="VisualSynth", description="Generador de visuales dinámicos en tiempo real")

# Montar archivos estáticos (CSS, JS)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Registrar rutas definidas en routes.py
app.include_router(router)

# Inicializar la base de datos al arrancar
@app.on_event("startup")
def startup_event():
    init_db()
