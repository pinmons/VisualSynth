# ⬡ VisualSynth

Generador de visuales dinámicos en tiempo real, con reacción a audio y cámara.

## Tecnologías

- **Backend**: Python · FastAPI · Jinja2 · SQLite
- **Frontend**: HTML5 Canvas 2D · CSS3 · JavaScript puro (sin frameworks)

## Estructura del proyecto

```
VisualSynth/
├── main.py           # Punto de entrada FastAPI
├── routes.py         # Rutas HTTP y endpoints API
├── models.py         # Modelos Pydantic (validación)
├── database.py       # SQLite: init y conexión
├── requirements.txt
├── templates/
│   └── index.html    # Plantilla Jinja2 principal
└── static/
    ├── css/style.css # Estilos (tema synth oscuro)
    └── js/visual.js  # Motor de visuales + controles
```

## Instalación y ejecución

### 1. Clonar / descargar el proyecto

```bash
git clone <repo-url>
cd VisualSynth
```

### 2. Crear entorno virtual e instalar dependencias

```bash
python -m venv venv
source venv/bin/activate          # Linux / macOS
# venv\Scripts\activate           # Windows

pip install -r requirements.txt
```

### 3. Ejecutar el servidor

```bash
uvicorn main:app --reload --port 8000
```

### 4. Abrir en el navegador

```
http://localhost:8000
```

> **Nota**: Los modos Audio y Cámara requieren HTTPS o `localhost` para que
> el navegador permita `getUserMedia`. Con `uvicorn` en `localhost` funciona
> directamente.

## Funcionalidades

### Modos visuales
| Modo       | Descripción                                      |
|------------|--------------------------------------------------|
| Partículas | Pool de partículas con vida, velocidad y rotación |
| Ondas      | Líneas sinusoidales superpuestas                  |
| Círculos   | Anillos concéntricos pulsantes con rotación       |

### Modos de entrada
| Modo   | Descripción                                                     |
|--------|-----------------------------------------------------------------|
| Audio  | Captura micrófono → modifica tamaño/velocidad/cantidad          |
| Cámara | Webcam → diferencia de frames → modifica intensidad y colores   |
| Mixto  | Combina audio + movimiento para máxima reactividad              |

### Controles
- **Color base** — picker de color
- **Velocidad** — slider 0.1 → 10
- **Intensidad** — slider 0.1 → 10 (afecta cantidad/tamaño de figuras)
- **Rotación** — slider 0° → 360° (campo de rotación continua)

### Presets
- Guarda la configuración actual con un nombre libre
- Lista todos los presets desde la base de datos
- Click en un preset para aplicarlo
- Botón ✕ para eliminar un preset

## Endpoints API

| Método | Ruta                    | Descripción              |
|--------|-------------------------|--------------------------|
| GET    | `/`                     | Página principal         |
| GET    | `/api/presets`          | Listar todos los presets |
| POST   | `/api/presets`          | Guardar preset nuevo     |
| DELETE | `/api/presets/{id}`     | Eliminar preset por id   |

### Ejemplo POST `/api/presets`

```json
{
  "name": "Mi preset",
  "color": "#00ffcc",
  "speed": 3.5,
  "intensity": 6.0,
  "rotation": 45,
  "mode": "audio",
  "visual": "particles"
}
```

## Notas de desarrollo

- La base de datos SQLite (`visualsynth.db`) se crea automáticamente al iniciar.
- No se usa WebGL ni shaders; todo el rendering es Canvas 2D estándar.
- El motor de visuales está completamente en `static/js/visual.js` con comentarios por sección.
