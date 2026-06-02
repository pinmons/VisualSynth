/**
 * visual.js — Motor de visuales de VisualSynth
 *
 * Secciones:
 *  1. Estado global
 *  2. Canvas principal
 *  3. Visuales: partículas, ondas, círculos (originales)
 *  4. Visuales nuevos: espiral, túnel, pulsos, nebulosa,
 *                      lluvia, anillos reactivos, estrellas, vórtice
 *  5. Módulo Audio
 *  6. Módulo Cámara
 *  7. Bucle de animación
 *  8. Controles UI
 *  9. Presets
 * 10. Utilidades
 */

// ══════════════════════════════════════════════════════════════════════════════
// 1. ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════════════════════

const state = {
  color:        '#00ffcc',
  speed:        3.0,
  intensity:    5.0,
  rotation:     0,
  inputMode:    'none',
  visualMode:   'particles',
  audioLevel:   0.0,
  motionLevel:  0.0,
  running:      true,
  frame:        0,
  visualFilter: 'none',
};

/** Claves de visual válidas (debe coincidir con data-visual y con el backend). */
const VALID_VISUAL_KEYS = new Set([
  'particles', 'waves', 'circles',
  'spiral', 'tunnel', 'pulses', 'nebula', 'rain', 'rings', 'stars', 'vortex',
]);

/** Orden determinístico para siguiente/anterior. */
const VISUAL_KEYS_ORDER = [
  'particles', 'waves', 'circles',
  'spiral', 'tunnel', 'pulses', 'nebula',
  'rain', 'rings', 'stars', 'vortex',
];

/**
 * Efectos ON/OFF en tiempo real (modular).
 * Valores iniciales alineados con los defaults de seed en la base de datos.
 */
const efectos = {
  rotacion:       true,
  glow:           true,
  distorsion:     false,
  cambioColor:    true,
  eco:            false,
  escalaDinamica: true,
};

/** Intensidad numérica por efecto (columna valor en visual_efecto). */
const efectosValor = {
  rotacion:       1,
  glow:           1,
  distorsion:     1,
  cambioColor:    1,
  eco:            1,
  escalaDinamica: 1,
};

function normalizeVisualKey(v) {
  const s = (v || '').trim();
  return VALID_VISUAL_KEYS.has(s) ? s : 'particles';
}

function setVisualMode(visualKey, { notify = true, label = '' } = {}) {
  const key = normalizeVisualKey(visualKey);
  state.visualMode = key;

  // actualizar UI (botón activo)
  document.querySelectorAll('.visual-btn').forEach(b => {
    b.classList.toggle('active', normalizeVisualKey(b.getAttribute('data-visual')) === key);
  });

  resetCanvasContextState();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  initVisualPools(key);
  updateStatusBar();
  void loadEfectosForVisual(key);

  if (notify) showOverlay(label || `VISUAL: ${VISUAL_LABELS[key] || key}`, 700);
}

function selectNextVisual(source = '') {
  const idx = Math.max(0, VISUAL_KEYS_ORDER.indexOf(state.visualMode));
  const next = VISUAL_KEYS_ORDER[(idx + 1) % VISUAL_KEYS_ORDER.length];
  setVisualMode(next, { notify: true, label: '➡ Siguiente visual' });
}

function selectPrevVisual(source = '') {
  const idx = Math.max(0, VISUAL_KEYS_ORDER.indexOf(state.visualMode));
  const prev = VISUAL_KEYS_ORDER[(idx - 1 + VISUAL_KEYS_ORDER.length) % VISUAL_KEYS_ORDER.length];
  setVisualMode(prev, { notify: true, label: '⬅ Visual anterior' });
}

function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pickRandomVisual(avoidKey) {
  const avoid = normalizeVisualKey(avoidKey || state.visualMode);
  if (VISUAL_KEYS_ORDER.length <= 1) return avoid;
  const pool = VISUAL_KEYS_ORDER.filter(v => v !== avoid);
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomizeParams() {
  const newColor = hueShiftHex('#00ffcc', Math.floor(randBetween(0, 360)));
  const newSpeed = parseFloat(randBetween(0.4, 9.5).toFixed(1));
  const newIntensity = parseFloat(randBetween(0.8, 10.0).toFixed(1));
  const newRotation = Math.floor(randBetween(0, 360));

  state.color = newColor;
  state.speed = newSpeed;
  state.intensity = newIntensity;
  state.rotation = newRotation;

  const elColor = document.getElementById('ctrl-color');
  const elSpeed = document.getElementById('ctrl-speed');
  const elInt = document.getElementById('ctrl-intensity');
  const elRot = document.getElementById('ctrl-rotation');
  if (elColor) elColor.value = newColor;
  if (elSpeed) elSpeed.value = String(newSpeed);
  if (elInt) elInt.value = String(newIntensity);
  if (elRot) elRot.value = String(newRotation);
  const vSpeed = document.getElementById('val-speed');
  const vInt = document.getElementById('val-intensity');
  const vRot = document.getElementById('val-rotation');
  if (vSpeed) vSpeed.textContent = newSpeed.toFixed(1);
  if (vInt) vInt.textContent = newIntensity.toFixed(1);
  if (vRot) vRot.textContent = `${newRotation}°`;

  // refrescar pools si depende de intensidad
  initVisualPools(state.visualMode);
}

/** Filtros post-procesado sobre el canvas (clave → etiqueta UI). */
const FILTER_KEYS = [
  'none', 'glitch', 'neon', 'pixel', 'vhs', 'blur', 'mirror', 'invert', 'rgb',
];
const FILTER_LABELS = {
  none:   'NINGUNO',
  glitch: 'GLITCH',
  neon:   'NEON',
  pixel:  'PIXEL',
  vhs:    'VHS',
  blur:   'BLUR',
  mirror: 'ESPEJO',
  invert: 'INVERTIR',
  rgb:    'RGB SHIFT',
};

function normalizeFilterKey(v) {
  const s = (v || '').trim();
  return FILTER_KEYS.includes(s) ? s : 'none';
}

function setVisualFilter(filterKey, { notify = false } = {}) {
  const key = normalizeFilterKey(filterKey);
  state.visualFilter = key;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-filter') === key);
  });
  updateStatusBar();
  if (notify) showOverlay(`FILTRO: ${FILTER_LABELS[key] || key}`, 700);
}

function pickRandomFilter(avoidKey) {
  const avoid = normalizeFilterKey(avoidKey || state.visualFilter);
  const pool = FILTER_KEYS.filter(f => f !== avoid);
  if (pool.length === 0) return avoid;
  return pool[Math.floor(Math.random() * pool.length)];
}

function doRandomAction() {
  const next = pickRandomVisual(state.visualMode);
  setVisualMode(next, { notify: false });
  randomizeParams();
  setVisualFilter(pickRandomFilter(state.visualFilter), { notify: false });
  showOverlay('🎲 Modo aleatorio', 900);
}

// ── Fullscreen ───────────────────────────────────────────────────────────────

function isFullscreen() {
  return !!document.fullscreenElement;
}

async function toggleFullscreen() {
  try {
    if (!isFullscreen()) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (err) {
    console.warn('[VisualSynth] Fullscreen error:', err);
  }
}

document.addEventListener('fullscreenchange', () => {
  document.body.classList.toggle('fullscreen', isFullscreen());
});

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'f' || e.key === 'F') {
    void toggleFullscreen();
  }
});

// ── MediaPipe Hands (gestos) ────────────────────────────────────────────────

let handsEngine = null;
let handsLoopRunning = false;
let handsBusy = false;
let handsCooldownUntil = 0;
let lastHandsCount = 0;
let stableHandsFrames = 0;
/** Inicio del gesto “mano arriba sostenida” (ms) para modo aleatorio. */
let upperHoldStartMs = null;
/** Evita repetir aleatorio sin bajar la mano de la zona superior. */
let upperHoldGestureDone = false;

/** Y normalizado MediaPipe: menor = más arriba en cámara. */
const UPPER_HAND_Y_MAX = 0.38;
const HOLD_RANDOM_MS = 3000;

function nowMs() {
  return performance && performance.now ? performance.now() : Date.now();
}

function canTriggerHandsGesture() {
  return nowMs() >= handsCooldownUntil;
}

function setHandsCooldown(ms = 1000) {
  handsCooldownUntil = nowMs() + ms;
}

function initHandsIfAvailable() {
  if (handsEngine || typeof Hands === 'undefined') return;
  handsEngine = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });
  handsEngine.setOptions({
    maxNumHands: 2,
    modelComplexity: 0,
    minDetectionConfidence: 0.55,
    minTrackingConfidence: 0.55,
  });
  handsEngine.onResults(onHandsResults);
}

/** Mano en la zona superior del encuadre (muñeca + dedo índice). */
function isHandInUpperZone(landmarks) {
  if (!landmarks || landmarks.length < 9) return false;
  const wrist = landmarks[0];
  const indexTip = landmarks[8];
  const avgY = (wrist.y + indexTip.y) * 0.5;
  return avgY < UPPER_HAND_Y_MAX;
}

function onHandsResults(results) {
  const hands = results && results.multiHandLandmarks ? results.multiHandLandmarks : [];
  const count = hands.length;
  const t = nowMs();

  if (count === lastHandsCount) stableHandsFrames++;
  else { stableHandsFrames = 0; lastHandsCount = count; }

  // 1 mano arriba sostenida ~3 s → modo aleatorio (no dispara siguiente/anterior)
  if (count === 1 && isHandInUpperZone(hands[0])) {
    if (!upperHoldGestureDone) {
      if (upperHoldStartMs === null) upperHoldStartMs = t;
      if (t - upperHoldStartMs >= HOLD_RANDOM_MS && canTriggerHandsGesture()) {
        setHandsCooldown(1000);
        upperHoldStartMs = null;
        upperHoldGestureDone = true;
        doRandomAction();
      }
    }
    return;
  }
  upperHoldStartMs = null;
  upperHoldGestureDone = false;

  // 1 mano → siguiente, 2 manos → anterior (estabilidad + cooldown 1 s)
  if (!canTriggerHandsGesture()) return;
  if (stableHandsFrames < 1) return;

  if (count === 1) {
    setHandsCooldown(1000);
    selectNextVisual('hands');
  } else if (count === 2) {
    setHandsCooldown(1000);
    selectPrevVisual('hands');
  }
}

async function handsLoopTick() {
  if (!handsLoopRunning) return;
  if (!cameraReady || !videoEl || videoEl.videoWidth === 0) {
    requestAnimationFrame(handsLoopTick);
    return;
  }
  if (handsEngine && !handsBusy) {
    handsBusy = true;
    try {
      await handsEngine.send({ image: videoEl });
    } catch (err) {
      // silencioso: si falla por recursos/cámara, no rompe el resto
    } finally {
      handsBusy = false;
    }
  }
  requestAnimationFrame(handsLoopTick);
}

function startHandsLoop() {
  initHandsIfAvailable();
  if (!handsEngine || handsLoopRunning) return;
  handsLoopRunning = true;
  handsLoopTick();
}

function stopHandsLoop() {
  handsLoopRunning = false;
  handsBusy = false;
  upperHoldStartMs = null;
  upperHoldGestureDone = false;
  lastHandsCount = 0;
  stableHandsFrames = 0;
}

/**
 * Reinicia pools / estado del visual al cambiar de modo (cambio inmediato en canvas).
 */
function initVisualPools(visualKey) {
  switch (visualKey) {
    case 'particles': initParticles(); break;
    case 'spiral':    initSpiral();    break;
    case 'tunnel':    initTunnel();    break;
    case 'pulses':    initPulses();    break;
    case 'nebula':    initNebula();    break;
    case 'rain':      initRain();      break;
    case 'stars':     initStars();     break;
    case 'vortex':    initVortex();    break;
    default: break;
  }
}

function drawActiveVisual(t, influence) {
  const mode = state.visualMode;
  switch (mode) {
    case 'particles': drawParticles(influence);            break;
    case 'waves':     drawWaves(t, influence);           break;
    case 'circles':   drawCircles(t, influence);         break;
    case 'spiral':    drawSpiral(t, influence);          break;
    case 'tunnel':    drawTunnel(t, influence);          break;
    case 'pulses':    drawPulses(t, influence);          break;
    case 'nebula':    drawNebula(t, influence);          break;
    case 'rain':      drawRain(influence);               break;
    case 'rings':     drawRings(t, influence);           break;
    case 'stars':     drawStars(influence);              break;
    case 'vortex':    drawVortex(t, influence);          break;
    default:
      console.warn('Visual desconocido, usando partículas:', mode);
      drawParticles(influence);
      break;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. CANVAS PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

const canvas = document.getElementById('visualCanvas');
const ctx    = canvas.getContext('2d');

/** Limpia transformaciones del canvas 2D (evita que un modo deje el contexto inutilizable). */
function resetCanvasContextState() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.lineDashOffset = 0;
  ctx.setLineDash([]);
}

/**
 * Aplica transformaciones y estilo global antes del dibujado del visual activo.
 */
function applyEfectosPreDraw(t, influence) {
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.5;
  const vEsc = efectosValor.escalaDinamica ?? 1;
  const vRot = efectosValor.rotacion ?? 1;
  const vDis = efectosValor.distorsion ?? 1;
  const vGlow = efectosValor.glow ?? 1;

  ctx.save();
  ctx.translate(cx, cy);

  if (efectos.escalaDinamica) {
    const react = 1 + influence * 0.4 * vEsc;
    const osc   = 1 + Math.sin(t * 0.035) * 0.05 * vEsc;
    ctx.scale(react * osc, react * osc);
  }

  if (efectos.rotacion) {
    ctx.rotate(t * 0.006 * vRot * (state.speed / 3));
  }

  ctx.translate(-cx, -cy);

  if (efectos.distorsion) {
    const sk = 0.04 * vDis;
    ctx.transform(
      1,
      Math.sin(t * 0.028) * sk,
      Math.cos(t * 0.022) * sk,
      1,
      Math.sin(t * 0.015) * 4 * vDis,
      Math.cos(t * 0.018) * 3 * vDis,
    );
  }

  // CambioColor se aplica mutando state.color por frame (ver animate), no con
  // ctx.filter: hue-rotate + shadowBlur + transform suele dejar en blanco
  // nebulosa, espiral, estrellas, etc. en Chrome/Edge.

  if (efectos.glow) {
    ctx.shadowColor = state.color;
    ctx.shadowBlur = Math.min(32, (6 + influence * 14) * vGlow);
  }
}

function applyEfectosPostDraw() {
  ctx.restore();
}

// ── Filtros visuales (post-procesado del frame) ─────────────────────────────

const filterBuffer = document.createElement('canvas');
const filterBufCtx = filterBuffer.getContext('2d');
const filterPixel = document.createElement('canvas');
const filterPixelCtx = filterPixel.getContext('2d');

function ensureFilterBufferSize(w, h) {
  if (filterBuffer.width !== w || filterBuffer.height !== h) {
    filterBuffer.width = w;
    filterBuffer.height = h;
  }
}

/**
 * Dibuja el frame fuente en outCtx aplicando el filtro activo.
 * Se usa un buffer intermedio para no alterar el pipeline de dibujo.
 */
function applyPostVisualFilter(outCtx, srcCanvas, w, h, filter, frame) {
  outCtx.setTransform(1, 0, 0, 1, 0, 0);
  outCtx.globalAlpha = 1;
  outCtx.globalCompositeOperation = 'source-over';
  outCtx.filter = 'none';
  outCtx.shadowBlur = 0;
  outCtx.clearRect(0, 0, w, h);

  const src = srcCanvas;

  switch (filter) {
    case 'blur':
      outCtx.filter = 'blur(4px)';
      outCtx.drawImage(src, 0, 0, w, h);
      outCtx.filter = 'none';
      return;

    case 'invert':
      outCtx.filter = 'invert(1)';
      outCtx.drawImage(src, 0, 0, w, h);
      outCtx.filter = 'none';
      return;

    case 'neon':
      outCtx.filter = 'brightness(1.35) contrast(1.25) saturate(1.7)';
      outCtx.drawImage(src, 0, 0, w, h);
      outCtx.filter = 'none';
      outCtx.globalCompositeOperation = 'lighter';
      outCtx.globalAlpha = 0.32;
      outCtx.drawImage(src, 0, 0, w, h);
      outCtx.globalAlpha = 1;
      outCtx.globalCompositeOperation = 'source-over';
      return;

    case 'mirror':
      outCtx.translate(w, 0);
      outCtx.scale(-1, 1);
      outCtx.drawImage(src, 0, 0, w, h);
      return;

    case 'rgb': {
      const off = 4 + (frame % 3);
      outCtx.drawImage(src, 0, 0, w, h);
      outCtx.globalCompositeOperation = 'screen';
      outCtx.globalAlpha = 0.45;
      outCtx.drawImage(src, off, 0, w, h);
      outCtx.drawImage(src, -off, 0, w, h);
      outCtx.globalAlpha = 1;
      outCtx.globalCompositeOperation = 'source-over';
      return;
    }

    case 'pixel': {
      const cols = Math.max(12, Math.floor(w / 28));
      const rows = Math.max(8, Math.floor(h / 28));
      if (filterPixel.width !== cols || filterPixel.height !== rows) {
        filterPixel.width = cols;
        filterPixel.height = rows;
      }
      filterPixelCtx.drawImage(src, 0, 0, cols, rows);
      outCtx.imageSmoothingEnabled = false;
      outCtx.drawImage(filterPixel, 0, 0, w, h);
      outCtx.imageSmoothingEnabled = true;
      return;
    }

    case 'glitch': {
      outCtx.drawImage(src, 0, 0, w, h);
      const slices = 5;
      const sliceH = Math.ceil(h / slices);
      for (let i = 0; i < slices; i++) {
        const sy = Math.min(h - sliceH, i * sliceH + ((frame * 19 + i * 41) % Math.max(1, h - sliceH)));
        const dx = (((frame * 11 + i * 23) % 200) / 200 - 0.5) * 28;
        outCtx.drawImage(src, 0, sy, w, sliceH, dx, sy, w, sliceH);
      }
      return;
    }

    case 'vhs': {
      const shake = Math.sin(frame * 0.18) * 2.5;
      outCtx.drawImage(src, shake, 0, w, h);
      outCtx.globalCompositeOperation = 'screen';
      outCtx.globalAlpha = 0.28;
      outCtx.drawImage(src, shake + 2, 0, w, h);
      outCtx.globalAlpha = 1;
      outCtx.globalCompositeOperation = 'source-over';
      outCtx.fillStyle = 'rgba(0,0,0,0.14)';
      for (let y = 0; y < h; y += 4) outCtx.fillRect(0, y, w, 1);
      if (frame % 90 < 2) {
        outCtx.fillStyle = 'rgba(255,255,255,0.06)';
        outCtx.fillRect(0, (frame * 7) % h, w, 3);
      }
      return;
    }

    default:
      outCtx.drawImage(src, 0, 0, w, h);
  }
}

function applyActiveVisualFilter() {
  const key = normalizeFilterKey(state.visualFilter);
  if (key === 'none') return;
  const w = canvas.width;
  const h = canvas.height;
  ensureFilterBufferSize(w, h);
  filterBufCtx.setTransform(1, 0, 0, 1, 0, 0);
  filterBufCtx.globalAlpha = 1;
  filterBufCtx.drawImage(canvas, 0, 0);
  resetCanvasContextState();
  applyPostVisualFilter(ctx, filterBuffer, w, h, key, state.frame);
  resetCanvasContextState();
}

function resizeCanvas() {
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  // Los pools (stars, rain, nebula) se reinicializan en el listener de resize
  // definido más abajo, una vez que las funciones ya existen.
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // solo redimensiona el canvas; los pools aún no están definidos

// ══════════════════════════════════════════════════════════════════════════════
// 3. VISUALES ORIGINALES
// ══════════════════════════════════════════════════════════════════════════════

// ── 3A. Partículas ───────────────────────────────────────────────────────────

const MAX_PARTICLES = 400;
const particles = [];

function initParticles() {
  particles.length = 0;
  const count = Math.floor(60 + state.intensity * 20);
  for (let i = 0; i < Math.min(count, MAX_PARTICLES); i++) {
    particles.push(createParticle());
  }
}

function createParticle() {
  const angle = Math.random() * Math.PI * 2;
  const spd   = (0.5 + Math.random() * 1.5) * state.speed * 0.3;
  return {
    x:     Math.random() * canvas.width,
    y:     Math.random() * canvas.height,
    vx:    Math.cos(angle) * spd,
    vy:    Math.sin(angle) * spd,
    size:  1.5 + Math.random() * 3,
    alpha: 0.4 + Math.random() * 0.6,
    life:  Math.random(),
    decay: 0.002 + Math.random() * 0.004,
  };
}

function drawParticles(influence) {
  const target = Math.floor((60 + state.intensity * 20) * (1 + influence * 2));
  while (particles.length < Math.min(target, MAX_PARTICLES)) particles.push(createParticle());

  const rotRad = (state.rotation * Math.PI) / 180;
  const cx = canvas.width  / 2;
  const cy = canvas.height / 2;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    const speedMod = 1 + influence * 3;
    p.x   += p.vx * state.speed * 0.15 * speedMod;
    p.y   += p.vy * state.speed * 0.15 * speedMod;
    p.life -= p.decay;

    if (state.rotation !== 0) {
      const dx = p.x - cx, dy = p.y - cy;
      p.x = cx + dx * Math.cos(rotRad * 0.01) - dy * Math.sin(rotRad * 0.01);
      p.y = cy + dx * Math.sin(rotRad * 0.01) + dy * Math.cos(rotRad * 0.01);
    }

    if (p.life <= 0 || p.x < -10 || p.x > canvas.width + 10 ||
                        p.y < -10 || p.y > canvas.height + 10) {
      particles[i] = createParticle(); continue;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1 + influence * 2), 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(state.color, p.alpha * p.life);
    ctx.fill();
  }
}

// ── 3B. Ondas ────────────────────────────────────────────────────────────────

function drawWaves(t, influence) {
  const w = canvas.width, h = canvas.height;
  const lines  = Math.floor(3 + state.intensity * 1.5);
  const amp    = (h * 0.08) * (1 + influence * 2);
  const freq   = 0.008 + influence * 0.006;
  const spd    = state.speed * 0.02;

  for (let i = 0; i < lines; i++) {
    const yBase  = (h / (lines + 1)) * (i + 1);
    const offset = (t * spd) + (i * 1.2);
    ctx.beginPath();
    ctx.lineWidth   = 1 + state.intensity * 0.3 * (1 + influence);
    ctx.strokeStyle = hexToRgba(state.color, 0.3 + (i / lines) * 0.5);
    for (let x = 0; x <= w; x += 2) {
      const y = yBase + Math.sin(x * freq + offset) * amp
                      + Math.sin(x * freq * 1.7 + offset * 0.8) * amp * 0.4;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// ── 3C. Círculos ─────────────────────────────────────────────────────────────

function drawCircles(t, influence) {
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const rings  = Math.floor(3 + state.intensity * 1.2);
  const pulse  = 1 + Math.sin(t * state.speed * 0.04) * 0.15 * (1 + influence * 2);
  const maxR   = Math.min(canvas.width, canvas.height) * 0.42;
  const rotRad = (state.rotation * Math.PI) / 180;

  for (let i = 1; i <= rings; i++) {
    const frac = i / rings;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotRad * 0.005 * t + i * 0.3);
    ctx.translate(-cx, -cy);
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * frac * pulse * (1 + influence * 0.5), 0, Math.PI * 2);
    ctx.lineWidth   = (1 + state.intensity * 0.25) * (1 + influence * 0.5);
    ctx.strokeStyle = hexToRgba(state.color, (1 - frac * 0.7) * (0.4 + influence * 0.4));
    ctx.stroke();
    ctx.restore();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. VISUALES NUEVOS
// ══════════════════════════════════════════════════════════════════════════════

// ── 4A. Espiral ──────────────────────────────────────────────────────────────
// Partículas que nacen en el centro y giran hacia afuera siguiendo una espiral.

const spiralParticles = [];
const MAX_SPIRAL = 300;

function initSpiral() {
  spiralParticles.length = 0;
}

function createSpiralParticle() {
  return {
    angle:  Math.random() * Math.PI * 2,
    radius: Math.random() * 10,
    speed:  (0.4 + Math.random() * 0.8) * state.speed * 0.3,
    size:   1 + Math.random() * 2.5,
    alpha:  0.6 + Math.random() * 0.4,
    life:   1.0,
  };
}

function drawSpiral(t, influence) {
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const maxR = Math.min(canvas.width, canvas.height) * 0.48;
  const spawnRate = Math.floor(2 + state.intensity * 1.5 * (1 + influence * 2));

  for (let i = 0; i < spawnRate && spiralParticles.length < MAX_SPIRAL; i++) {
    spiralParticles.push(createSpiralParticle());
  }

  const baseRotSpeed = state.speed * 0.015 + influence * 0.03;

  for (let i = spiralParticles.length - 1; i >= 0; i--) {
    const p = spiralParticles[i];
    p.radius += p.speed * (1 + influence * 2);
    p.angle  += baseRotSpeed + (state.rotation / 360) * 0.05;
    p.life   -= 0.006 + p.radius / (maxR * 120);

    if (p.life <= 0 || p.radius > maxR) {
      spiralParticles.splice(i, 1); continue;
    }

    const x = cx + Math.cos(p.angle) * p.radius;
    const y = cy + Math.sin(p.angle) * p.radius;
    ctx.beginPath();
    ctx.arc(x, y, p.size * (1 + influence), 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(state.color, p.alpha * p.life);
    ctx.fill();
  }
}

// ── 4B. Túnel ────────────────────────────────────────────────────────────────
// Anillos que se generan al fondo y se expanden hacia el observador.

const tunnelRings = [];

function initTunnel() {
  tunnelRings.length = 0;
}

function createTunnelRing() {
  const sides = Math.floor(4 + Math.random() * 5); // polígono de 4-8 lados
  return {
    radius: 2,
    alpha:  0,
    sides,
    rotOffset: Math.random() * Math.PI * 2,
  };
}

function drawTunnel(t, influence) {
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const maxR = Math.hypot(canvas.width, canvas.height) * 0.6;
  const spd  = state.speed * 1.5 * (1 + influence * 1.5);

  // Generar nuevos anillos con cadencia basada en velocidad
  if (t % Math.max(1, Math.floor(18 / Math.max(0.05, state.speed))) === 0) {
    tunnelRings.push(createTunnelRing());
  }

  for (let i = tunnelRings.length - 1; i >= 0; i--) {
    const r = tunnelRings[i];
    r.radius += spd;
    r.alpha   = Math.min(0.8, r.radius / 60) * (1 - r.radius / maxR);
    r.rotOffset += 0.003 * state.speed;

    if (r.radius > maxR) { tunnelRings.splice(i, 1); continue; }

    // Dibujar polígono regular
    ctx.beginPath();
    for (let s = 0; s <= r.sides; s++) {
      const a = (s / r.sides) * Math.PI * 2 + r.rotOffset
              + (state.rotation / 360) * Math.PI * 2;
      const x = cx + Math.cos(a) * r.radius;
      const y = cy + Math.sin(a) * r.radius;
      s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = hexToRgba(state.color, r.alpha * (0.6 + influence * 0.4));
    ctx.lineWidth   = 1 + state.intensity * 0.2;
    ctx.stroke();
  }
}

// ── 4C. Pulsos ───────────────────────────────────────────────────────────────
// Ondas circulares expansivas que nacen del centro con cadencia rítmica.

const pulseWaves = [];

function initPulses() {
  pulseWaves.length = 0;
}

function createPulse(influence) {
  return {
    radius: 0,
    alpha:  0.9 + influence * 0.1,
    width:  1.5 + state.intensity * 0.3 + influence * 2,
  };
}

function drawPulses(t, influence) {
  const cx  = canvas.width / 2, cy = canvas.height / 2;
  const maxR = Math.hypot(canvas.width, canvas.height) * 0.55;
  const interval = Math.max(4, Math.floor(50 / state.speed));

  if (t % interval === 0) {
    const count = Math.floor(1 + influence * 3);
    for (let i = 0; i < count; i++) pulseWaves.push(createPulse(influence));
  }

  const spd = state.speed * 1.2 * (1 + influence);

  for (let i = pulseWaves.length - 1; i >= 0; i--) {
    const p = pulseWaves[i];
    p.radius += spd;
    p.alpha  *= 0.985;

    if (p.radius > maxR || p.alpha < 0.01) { pulseWaves.splice(i, 1); continue; }

    ctx.beginPath();
    ctx.arc(cx, cy, p.radius, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(state.color, p.alpha);
    ctx.lineWidth   = p.width;
    ctx.stroke();
  }
}

// ── 4D. Nebulosa ─────────────────────────────────────────────────────────────
// Nubes de partículas suaves con movimiento Browniano lento.

const nebulaParticles = [];
const MAX_NEBULA = 250;

function initNebula() {
  nebulaParticles.length = 0;
  const count = Math.min(MAX_NEBULA, Math.floor(80 + state.intensity * 15));
  for (let i = 0; i < count; i++) nebulaParticles.push(createNebulaParticle(true));
}

function createNebulaParticle(scatter = false) {
  return {
    x:     scatter ? Math.random() * canvas.width  : canvas.width  / 2 + (Math.random() - 0.5) * 100,
    y:     scatter ? Math.random() * canvas.height : canvas.height / 2 + (Math.random() - 0.5) * 100,
    vx:    (Math.random() - 0.5) * 0.4,
    vy:    (Math.random() - 0.5) * 0.4,
    size:  4 + Math.random() * 12,
    alpha: 0.05 + Math.random() * 0.2,
    life:  0.5 + Math.random() * 0.5,
    decay: 0.001 + Math.random() * 0.002,
  };
}

function drawNebula(t, influence) {
  while (nebulaParticles.length < Math.min(MAX_NEBULA, Math.floor(80 + state.intensity * 15))) {
    nebulaParticles.push(createNebulaParticle());
  }

  const spd = state.speed * 0.08 * (1 + influence);
  for (let i = nebulaParticles.length - 1; i >= 0; i--) {
    const p = nebulaParticles[i];
    // Movimiento Browniano suave
    p.vx += (Math.random() - 0.5) * 0.05;
    p.vy += (Math.random() - 0.5) * 0.05;
    p.vx  = Math.max(-0.8, Math.min(0.8, p.vx));
    p.vy  = Math.max(-0.8, Math.min(0.8, p.vy));
    p.x  += p.vx * spd;
    p.y  += p.vy * spd;
    p.life -= p.decay;

    if (p.life <= 0 || p.x < -20 || p.x > canvas.width + 20 ||
                        p.y < -20 || p.y > canvas.height + 20) {
      nebulaParticles[i] = createNebulaParticle(); continue;
    }

    // Dibujar como blob suave con gradiente radial
    const r = p.size * (1 + influence * 1.5);
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    grad.addColorStop(0, hexToRgba(state.color, p.alpha * p.life * (1 + influence)));
    grad.addColorStop(1, hexToRgba(state.color, 0));
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }
}

// ── 4E. Lluvia de partículas ──────────────────────────────────────────────────
// Partículas que caen desde arriba con leve deriva horizontal.

const rainDrops = [];
const MAX_RAIN  = 350;

function initRain() {
  rainDrops.length = 0;
  const count = Math.min(MAX_RAIN, Math.floor(80 + state.intensity * 20));
  for (let i = 0; i < count; i++) rainDrops.push(createRainDrop(true));
}

function createRainDrop(randomY = false) {
  return {
    x:      Math.random() * canvas.width,
    y:      randomY ? Math.random() * canvas.height : -5,
    vy:     (1 + Math.random() * 2) * state.speed * 0.4,
    vx:     (Math.random() - 0.5) * 0.5,
    len:    4 + Math.random() * 14,   // longitud de la gota
    alpha:  0.3 + Math.random() * 0.5,
    width:  0.5 + Math.random() * 1.5,
  };
}

function drawRain(influence) {
  const target = Math.min(MAX_RAIN, Math.floor((80 + state.intensity * 20) * (1 + influence)));
  while (rainDrops.length < target) rainDrops.push(createRainDrop());

  const speedMod = 1 + influence * 2;
  for (let i = rainDrops.length - 1; i >= 0; i--) {
    const d = rainDrops[i];
    d.y += d.vy * speedMod;
    d.x += d.vx;

    if (d.y > canvas.height + 10) {
      rainDrops[i] = createRainDrop(); continue;
    }

    // Línea inclinada con la derive horizontal
    const angle = Math.atan2(d.vy, d.vx + 0.001);
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - Math.cos(angle) * d.len, d.y - Math.sin(angle) * d.len);
    ctx.strokeStyle = hexToRgba(state.color, d.alpha * (1 + influence));
    ctx.lineWidth   = d.width;
    ctx.stroke();
  }
}

// ── 4F. Anillos reactivos ────────────────────────────────────────────────────
// Círculos concéntricos cuyo radio y opacidad responden directamente a la influencia.

function drawRings(t, influence) {
  const cx  = canvas.width / 2, cy = canvas.height / 2;
  const rings = Math.floor(5 + state.intensity * 2);
  const maxR  = Math.min(canvas.width, canvas.height) * 0.45;
  const rotRad = (state.rotation * Math.PI) / 180;

  for (let i = 1; i <= rings; i++) {
    const frac = i / rings;
    // El radio escala con la influencia — reacción visible al audio/movimiento
    const baseR  = maxR * frac;
    const reactR = baseR * (1 + influence * 0.6 * Math.sin(t * 0.05 + i));
    const alpha  = (0.15 + influence * 0.7) * (1 - frac * 0.5);
    const lw     = (0.5 + state.intensity * 0.2) * (1 + influence * frac);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotRad * 0.003 * t + i * 0.15);
    ctx.translate(-cx, -cy);
    ctx.beginPath();
    ctx.arc(cx, cy, reactR, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(state.color, alpha);
    ctx.lineWidth   = lw;
    ctx.stroke();
    ctx.restore();
  }

  // Círculo central que pulsa fuerte con la influencia
  if (influence > 0.05) {
    ctx.beginPath();
    ctx.arc(cx, cy, 3 + influence * 20, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(state.color, influence * 0.8);
    ctx.fill();
  }
}

// ── 4G. Estrellas ────────────────────────────────────────────────────────────
// Campo estelar con efecto warp — las estrellas se alargan al aumentar velocidad.

const starField = [];
const MAX_STARS = 300;

function initStars() {
  starField.length = 0;
  for (let i = 0; i < MAX_STARS; i++) starField.push(createStar(true));
}

function createStar(scatter = false) {
  // Coordenadas relativas al centro para proyección estable
  const x = (Math.random() - 0.5) * canvas.width;
  const y = (Math.random() - 0.5) * canvas.height;
  const z = scatter ? Math.random() * canvas.width : canvas.width;
  return {
    x,
    y,
    z,   // profundidad
    pz:  z,
  };
}

function drawStars(influence) {
  const cx  = canvas.width / 2, cy = canvas.height / 2;
  const spd = Math.max(0.2, state.speed * 2.2) * (1 + influence * 2);

  for (let i = 0; i < starField.length; i++) {
    const s  = starField[i];
    s.pz     = s.z;
    s.z     -= spd;

    if (s.z <= 0) {
      // Reciclar estrella atrás
      starField[i] = createStar(false);
      continue;
    }

    // Proyección perspectiva simple
    const sx  = (s.x * (canvas.width / s.z))  + cx;
    const sy  = (s.y * (canvas.width / s.z))  + cy;
    const spx = (s.x * (canvas.width / s.pz)) + cx;
    const spy = (s.y * (canvas.width / s.pz)) + cy;

    if (sx < 0 || sx > canvas.width || sy < 0 || sy > canvas.height) continue;

    const bright = 1 - s.z / canvas.width;
    const size   = bright * 2.5;
    const alpha  = bright * (0.5 + influence * 0.5);

    // Trail (efecto warp): línea desde posición anterior a actual
    ctx.beginPath();
    ctx.moveTo(spx, spy);
    ctx.lineTo(sx, sy);
    ctx.strokeStyle = hexToRgba(state.color, alpha);
    ctx.lineWidth   = size;
    ctx.stroke();
  }
}

// ── 4H. Vórtice ──────────────────────────────────────────────────────────────
// Partículas que orbitan y son absorbidas hacia el centro en espiral.

const vortexParticles = [];
const MAX_VORTEX = 300;

function initVortex() {
  vortexParticles.length = 0;
}

function createVortexParticle() {
  const angle  = Math.random() * Math.PI * 2;
  const radius = 50 + Math.random() * Math.min(canvas.width, canvas.height) * 0.45;
  return {
    angle,
    radius,
    orbitSpeed: (0.02 + Math.random() * 0.03) * state.speed * 0.3,
    inSpeed:    0.3 + Math.random() * 0.7,
    size:       1 + Math.random() * 2.5,
    alpha:      0.5 + Math.random() * 0.5,
  };
}

function drawVortex(t, influence) {
  const cx  = canvas.width / 2, cy = canvas.height / 2;
  const spawnRate = Math.floor(1 + state.intensity * 0.8 * (1 + influence));

  for (let i = 0; i < spawnRate && vortexParticles.length < MAX_VORTEX; i++) {
    vortexParticles.push(createVortexParticle());
  }

  const suckSpeed = state.speed * 0.3 * (1 + influence * 2);
  const rotDir    = state.rotation < 180 ? 1 : -1; // rotación controla sentido

  for (let i = vortexParticles.length - 1; i >= 0; i--) {
    const p = vortexParticles[i];
    // Aumentar velocidad orbital conforme se acerca al centro (conservación angular)
    const orb = p.orbitSpeed * (1 + (1 - p.radius / 300) * 3) * rotDir;
    p.angle  += orb * (1 + influence);
    p.radius -= p.inSpeed * suckSpeed;

    if (p.radius < 2) { vortexParticles.splice(i, 1); continue; }

    const x = cx + Math.cos(p.angle) * p.radius;
    const y = cy + Math.sin(p.angle) * p.radius;

    // Tamaño crece al acercarse (efecto de marea)
    const sizeM = p.size * (1 + (1 - p.radius / 300) * influence * 2);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.5, sizeM), 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(state.color, p.alpha * (p.radius / 100));
    ctx.fill();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. MÓDULO DE AUDIO
// ══════════════════════════════════════════════════════════════════════════════

let audioCtx       = null;
let analyser       = null;
let audioStream    = null;
let audioDataArray = null;

async function startAudio() {
  try {
    audioStream  = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    audioCtx     = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(audioStream);
    analyser     = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    audioDataArray = new Uint8Array(analyser.frequencyBinCount);
    return true;
  } catch (err) {
    console.error('Error micrófono:', err);
    return false;
  }
}

function stopAudio() {
  if (audioStream) audioStream.getTracks().forEach(t => t.stop());
  if (audioCtx)    audioCtx.close();
  audioStream = null; audioCtx = null; analyser = null;
  state.audioLevel = 0;
}

function updateAudioLevel() {
  if (!analyser) return;
  analyser.getByteFrequencyData(audioDataArray);
  let sum = 0;
  for (let i = 0; i < audioDataArray.length; i++) sum += audioDataArray[i];
  state.audioLevel = Math.min(1, (sum / audioDataArray.length) / 80);
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. MÓDULO DE CÁMARA
// ══════════════════════════════════════════════════════════════════════════════

const videoEl     = document.getElementById('hiddenVideo');
const offCanvas   = document.getElementById('hiddenCanvas');
let offCtx        = null;
let cameraStream  = null;
let prevFrameData = null;
let cameraReady   = false;

async function startCamera() {
  try {
    cameraReady = false; prevFrameData = null;
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoEl.srcObject = cameraStream;
    videoEl.play().catch(() => {});

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout webcam')), 8000);
      function checkReady() {
        if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
          clearTimeout(timeout); resolve();
        } else {
          videoEl.addEventListener('canplay', () => { clearTimeout(timeout); resolve(); }, { once: true });
        }
      }
      checkReady();
    });

    offCanvas.width  = 160;
    offCanvas.height = 90;
    offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    cameraReady = true;
    return true;
  } catch (err) {
    console.error('Error webcam:', err);
    cameraStream = null; cameraReady = false;
    return false;
  }
}

function stopCamera() {
  if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
  videoEl.srcObject = null;
  prevFrameData = null; cameraReady = false;
  state.motionLevel = 0;
}

function drawCameraBackground() {
  if (!cameraReady || videoEl.videoWidth === 0) return;
  const w = canvas.width, h = canvas.height;
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, 0, 0, w, h);
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, w, h);
}

function updateMotionLevel() {
  if (!cameraReady || !offCtx || videoEl.videoWidth === 0) return;
  offCtx.drawImage(videoEl, 0, 0, offCanvas.width, offCanvas.height);
  const curr = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
  if (prevFrameData) {
    let diff = 0;
    for (let i = 0; i < curr.data.length; i += 16) {
      diff += Math.abs(curr.data[i]     - prevFrameData[i]);
      diff += Math.abs(curr.data[i + 1] - prevFrameData[i + 1]);
      diff += Math.abs(curr.data[i + 2] - prevFrameData[i + 2]);
    }
    state.motionLevel = Math.min(1, diff / ((curr.data.length / 16) * 3 * 25));
  }
  prevFrameData = new Uint8ClampedArray(curr.data);
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. BUCLE DE ANIMACIÓN PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

let fpsTime = 0, fpsCount = 0;
const statusMode   = document.getElementById('status-mode');
const statusVisual = document.getElementById('status-visual');
const statusFps    = document.getElementById('status-fps');

function animate(timestamp) {
  if (!state.running) return;
  requestAnimationFrame(animate);

  if (canvas.width < 4 || canvas.height < 4) return;

  fpsCount++;
  if (timestamp - fpsTime >= 1000) {
    statusFps.textContent = `FPS: ${fpsCount}`;
    fpsCount = 0; fpsTime = timestamp;
  }

  state.frame++;

  if (state.inputMode === 'audio' || state.inputMode === 'mixed') updateAudioLevel();
  if ((state.inputMode === 'camera' || state.inputMode === 'mixed') && state.frame % 3 === 0) updateMotionLevel();

  let influence = 0;
  if (state.inputMode === 'audio')  influence = state.audioLevel;
  if (state.inputMode === 'camera') influence = state.motionLevel;
  if (state.inputMode === 'mixed')  influence = Math.min(1, (state.audioLevel + state.motionLevel) * 0.7);

  const hasCam = (state.inputMode === 'camera' || state.inputMode === 'mixed') && cameraReady;

  if (hasCam) {
    drawCameraBackground();
  } else {
    const fullClear = ['rain', 'stars'];
    let trailAlpha = Math.max(0.05, 0.22 - influence * 0.1);
    if (efectos.eco) {
      const ve = efectosValor.eco ?? 1;
      trailAlpha = Math.min(0.55, trailAlpha + 0.16 * ve);
    }
    if (fullClear.includes(state.visualMode)) {
      const baseA = efectos.eco ? Math.max(0.32, 0.85 - 0.22 * (efectosValor.eco ?? 1)) : 0.85;
      ctx.fillStyle = `rgba(0,0,0,${baseA})`;
    } else {
      ctx.fillStyle = `rgba(0,0,0,${trailAlpha})`;
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const baseColor = state.color;
  if (efectos.cambioColor) {
    const vHue = efectosValor.cambioColor ?? 1;
    const deg = (state.frame * 1.4 * vHue) % 360;
    state.color = hueShiftHex(baseColor, deg);
  }

  resetCanvasContextState();
  try {
    applyEfectosPreDraw(state.frame, influence);
    drawActiveVisual(state.frame, influence);
    applyEfectosPostDraw();
  } finally {
    state.color = baseColor;
    resetCanvasContextState();
  }

  applyActiveVisualFilter();
}

// Inicializar todos los pools estáticos
initParticles();
initStars();
initRain();
initNebula();
wireEfectoCheckboxesOnce();
wireFilterButtonsOnce();
requestAnimationFrame(animate);
void loadEfectosForVisual(state.visualMode);

// Botones de acciones
const btnRandom = document.getElementById('btn-random');
if (btnRandom) btnRandom.addEventListener('click', () => doRandomAction());
const btnFs = document.getElementById('btn-fullscreen');
if (btnFs) btnFs.addEventListener('click', () => void toggleFullscreen());

// ══════════════════════════════════════════════════════════════════════════════
// 8. CONTROLES DE UI
// ══════════════════════════════════════════════════════════════════════════════

document.getElementById('ctrl-color').addEventListener('input', e => {
  state.color = e.target.value;
});
document.getElementById('ctrl-speed').addEventListener('input', e => {
  state.speed = parseFloat(e.target.value);
  document.getElementById('val-speed').textContent = state.speed.toFixed(1);
});
document.getElementById('ctrl-intensity').addEventListener('input', e => {
  state.intensity = parseFloat(e.target.value);
  document.getElementById('val-intensity').textContent = state.intensity.toFixed(1);
  if (state.visualMode === 'particles') initParticles();
  if (state.visualMode === 'nebula')    initNebula();
  if (state.visualMode === 'rain')      initRain();
});
document.getElementById('ctrl-rotation').addEventListener('input', e => {
  state.rotation = parseInt(e.target.value, 10);
  document.getElementById('val-rotation').textContent = `${state.rotation}°`;
});

// ── Modos de entrada ──────────────────────────────────────────────────────────

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const mode = btn.dataset.mode;
    if (state.inputMode === mode) {
      await deactivateInputMode();
      btn.classList.remove('active');
      updateStatusBar();
      return;
    }
    await deactivateInputMode();
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    const ok = await activateInputMode(mode);
    if (ok) { state.inputMode = mode; btn.classList.add('active'); }
    updateStatusBar();
  });
});

async function activateInputMode(mode) {
  showOverlay(`Activando ${mode}...`);
  let ok = true;
  if (mode === 'audio' || mode === 'mixed')           ok = await startAudio();
  if ((mode === 'camera' || mode === 'mixed') && ok)  ok = await startCamera();
  hideOverlay();
  if (!ok) showOverlay('Acceso denegado ✕', 2500);
  if (ok && (mode === 'camera' || mode === 'mixed')) {
    startHandsLoop();
    showOverlay('Gestos: 1 mano ➡ siguiente · 2 manos ⬅ anterior · 1 mano arriba ~3 s 🎲 aleatorio', 4200);
  }
  return ok;
}

async function deactivateInputMode() {
  stopAudio(); stopCamera();
  state.inputMode = 'none';
  state.audioLevel = 0; state.motionLevel = 0;
  stopHandsLoop();
}

// ── Efectos (API + panel lateral) ─────────────────────────────────────────────

async function loadEfectosForVisual(visualKey) {
  const key = normalizeVisualKey(visualKey);
  try {
    const res = await fetch(`/api/visuales/${encodeURIComponent(key)}/efectos`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    for (const row of list) {
      const c = row.clave;
      if (Object.prototype.hasOwnProperty.call(efectos, c)) {
        efectos[c] = !!row.activo;
        efectosValor[c] = typeof row.valor === 'number' ? row.valor : Number(row.valor) || 1;
      }
      const cb = document.querySelector(`input[type="checkbox"][data-efecto="${c}"]`);
      if (cb) cb.checked = !!row.activo;
    }
  } catch (err) {
    console.warn('[VisualSynth] Efectos no cargados desde servidor:', err);
  }
}

async function persistEfectoToServer(efectoClave, patch) {
  try {
    await fetch(
      `/api/visuales/${encodeURIComponent(state.visualMode)}/efectos/${encodeURIComponent(efectoClave)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      },
    );
  } catch (err) {
    console.warn('[VisualSynth] No se pudo guardar efecto:', err);
  }
}

function wireEfectoCheckboxesOnce() {
  document.querySelectorAll('input[type="checkbox"][data-efecto]').forEach(cb => {
    cb.addEventListener('change', () => {
      const clave = cb.dataset.efecto;
      if (!Object.prototype.hasOwnProperty.call(efectos, clave)) return;
      efectos[clave] = cb.checked;
      void persistEfectoToServer(clave, { activo: cb.checked });
    });
  });
}

function wireFilterButtonsOnce() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-filter') || btn.dataset.filter;
      setVisualFilter(key, { notify: false });
    });
  });
}

// ── Modos visuales ────────────────────────────────────────────────────────────

// Mapa de etiquetas para el status bar
const VISUAL_LABELS = {
  particles: 'PARTÍCULAS', waves: 'ONDAS',    circles: 'CÍRCULOS',
  spiral:    'ESPIRAL',    tunnel: 'TÚNEL',    pulses:  'PULSOS',
  nebula:    'NEBULOSA',   rain:   'LLUVIA',   rings:   'ANILLOS',
  stars:     'ESTRELLAS',  vortex: 'VÓRTICE',
};

document.querySelectorAll('.visual-btn').forEach(btn => {
  btn.addEventListener('click', (ev) => {
    const el = ev.currentTarget;
    const raw = el.getAttribute('data-visual') || el.dataset.visual;
    const key = normalizeVisualKey(raw);

    setVisualMode(key, { notify: false });
  });
});

// ── Status bar ────────────────────────────────────────────────────────────────

function updateStatusBar() {
  const modeLabels = { none: 'NINGUNO', audio: 'AUDIO', camera: 'CÁMARA', mixed: 'MIXTO' };
  statusMode.textContent   = `MODO: ${modeLabels[state.inputMode] || state.inputMode.toUpperCase()}`;
  statusVisual.textContent = `VISUAL: ${VISUAL_LABELS[state.visualMode] || state.visualMode.toUpperCase()}`;
  statusMode.classList.toggle('active', state.inputMode !== 'none');
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    const fk = normalizeFilterKey(state.visualFilter);
    statusFilter.textContent = `FILTRO: ${FILTER_LABELS[fk] || fk.toUpperCase()}`;
    statusFilter.classList.toggle('active', fk !== 'none');
  }
}

// ── Overlay ───────────────────────────────────────────────────────────────────

const overlay = document.getElementById('canvas-overlay');
const overlayMessage = document.getElementById('overlay-message');
let overlayTimer = null;

function showOverlay(msg, autoDismissMs = 0) {
  overlayMessage.textContent = msg;
  overlay.classList.remove('hidden');
  if (overlayTimer) clearTimeout(overlayTimer);
  if (autoDismissMs > 0) overlayTimer = setTimeout(hideOverlay, autoDismissMs);
}
function hideOverlay() {
  overlay.classList.add('hidden');
  if (overlayTimer) clearTimeout(overlayTimer);
}

// ══════════════════════════════════════════════════════════════════════════════
// 9. PRESETS
// ══════════════════════════════════════════════════════════════════════════════

const presetList    = document.getElementById('preset-list');
const presetNameEl  = document.getElementById('preset-name');
const btnSavePreset = document.getElementById('btn-save-preset');

async function loadPresets() {
  try {
    const res  = await fetch('/api/presets');
    const data = await res.json();
    renderPresetList(data);
  } catch (err) { console.error('Error cargando presets:', err); }
}

function renderPresetList(presets) {
  presetList.innerHTML = '';
  if (presets.length === 0) {
    presetList.innerHTML = '<li style="color:var(--text-muted);font-size:0.7rem;padding:6px 4px;">Sin presets guardados</li>';
    return;
  }
  presets.forEach(p => {
    const li = document.createElement('li');
    li.className = 'preset-item';
    const filterLabel = FILTER_LABELS[normalizeFilterKey(p.filter || 'none')] || (p.filter || 'NONE');
    const filterInfo = normalizeFilterKey(p.filter || 'none') === 'none' ? '' : ` • ${filterLabel}`;
    li.innerHTML = `
      <span class="preset-item-name">${escHtml(p.name)}</span>
      <span class="preset-item-info">${escHtml(VISUAL_LABELS[p.visual] || p.visual)}${filterInfo}</span>
      <button class="preset-del" data-id="${p.id}" title="Eliminar">✕</button>
    `;
    li.querySelector('.preset-item-name').addEventListener('click', () => applyPreset(p));
    li.querySelector('.preset-item-info').addEventListener('click', () => applyPreset(p));
    li.querySelector('.preset-del').addEventListener('click', async e => {
      e.stopPropagation(); await deletePreset(p.id);
    });
    presetList.appendChild(li);
  });
}

function applyPreset(p) {
  state.color = p.color; state.speed = p.speed;
  state.intensity = p.intensity; state.rotation = p.rotation;
  state.visualMode = normalizeVisualKey(p.visual);
  const filterKey = normalizeFilterKey(p.filter || 'none');
  setVisualFilter(filterKey, { notify: false });

  document.getElementById('ctrl-color').value     = p.color;
  document.getElementById('ctrl-speed').value     = p.speed;
  document.getElementById('ctrl-intensity').value = p.intensity;
  document.getElementById('ctrl-rotation').value  = p.rotation;
  document.getElementById('val-speed').textContent     = p.speed.toFixed(1);
  document.getElementById('val-intensity').textContent = p.intensity.toFixed(1);
  document.getElementById('val-rotation').textContent  = `${Math.round(p.rotation)}°`;

  document.querySelectorAll('.visual-btn').forEach(b =>
    b.classList.toggle('active', normalizeVisualKey(b.getAttribute('data-visual')) === state.visualMode)
  );
  resetCanvasContextState();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  initVisualPools(state.visualMode);
  updateStatusBar();
  void loadEfectosForVisual(state.visualMode);
}

btnSavePreset.addEventListener('click', async () => {
  const name = presetNameEl.value.trim();
  if (!name) { presetNameEl.focus(); return; }
  try {
    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, color: state.color, speed: state.speed,
        intensity: state.intensity, rotation: state.rotation,
        mode: state.inputMode, visual: state.visualMode,
        filter: state.visualFilter,
      }),
    });
    if (res.ok) { presetNameEl.value = ''; await loadPresets(); }
  } catch (err) { console.error('Error guardando preset:', err); }
});

async function deletePreset(id) {
  try {
    await fetch(`/api/presets/${id}`, { method: 'DELETE' });
    await loadPresets();
  } catch (err) { console.error('Error eliminando preset:', err); }
}

loadPresets();

// ══════════════════════════════════════════════════════════════════════════════
// 10. UTILIDADES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Desplaza el matiz de un color #rrggbb (grados 0–360). Evita depender de ctx.filter.
 */
function hueShiftHex(hex, deg) {
  if (!hex || typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) return hex || '#00ffcc';
  const r0 = parseInt(hex.slice(1, 3), 16) / 255;
  const g0 = parseInt(hex.slice(3, 5), 16) / 255;
  const b0 = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r0, g0, b0);
  const min = Math.min(r0, g0, b0);
  let h;
  let s;
  const l = (max + min) / 2;
  if (Math.abs(max - min) < 1e-6) {
    h = 0;
    s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r0: h = ((g0 - b0) / d + (g0 < b0 ? 6 : 0)) / 6; break;
      case g0: h = ((b0 - r0) / d + 2) / 6; break;
      default:  h = ((r0 - g0) / d + 4) / 6; break;
    }
  }
  let hn = (h + deg / 360) % 1;
  if (hn < 0) hn += 1;
  const satMul = 1 + 0.15 * (efectosValor.cambioColor ?? 1);
  s = Math.min(1, s * satMul);

  function hue2rgb(p, q, tt) {
    let t = tt;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  let r1; let g1; let b1;
  if (s === 0) {
    r1 = g1 = b1 = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r1 = hue2rgb(p, q, hn + 1 / 3);
    g1 = hue2rgb(p, q, hn);
    b1 = hue2rgb(p, q, hn - 1 / 3);
  }
  const toHex = (x) => Math.round(Math.min(255, Math.max(0, x * 255))).toString(16).padStart(2, '0');
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Reinicializar pools dependientes del tamaño del canvas cuando cambia el viewport.
// Este listener se registra AQUÍ (al final) porque initStars/initRain/initNebula
// se definen en la sección 4 — si se llamaran desde resizeCanvas() en la sección 2,
// darían ReferenceError y romperían toda la ejecución del script.
window.addEventListener('resize', () => {
  initStars();
  initRain();
  initNebula();
  initVisualPools(state.visualMode);
});