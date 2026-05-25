/**
 * visual.js — Motor de visuales de VisualSynth
 *
 * Secciones:
 *  1. Estado global
 *  2. Canvas principal
 *  3. Visuales: partículas, ondas, círculos
 *  4. Módulo Audio
 *  5. Módulo Cámara
 *  6. Bucle de animación
 *  7. Controles UI
 *  8. Presets
 *  9. Utilidades
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
};

// ══════════════════════════════════════════════════════════════════════════════
// 2. CANVAS PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

const canvas = document.getElementById('visualCanvas');
const ctx    = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ══════════════════════════════════════════════════════════════════════════════
// 3. GENERADORES DE VISUALES
// ══════════════════════════════════════════════════════════════════════════════

// ── 3A. Partículas ──────────────────────────────────────────────────────────

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
      const dx = p.x - cx;
      const dy = p.y - cy;
      p.x = cx + dx * Math.cos(rotRad * 0.01) - dy * Math.sin(rotRad * 0.01);
      p.y = cy + dx * Math.sin(rotRad * 0.01) + dy * Math.cos(rotRad * 0.01);
    }

    if (p.life <= 0 || p.x < -10 || p.x > canvas.width + 10 ||
                        p.y < -10 || p.y > canvas.height + 10) {
      particles[i] = createParticle();
      continue;
    }

    const sizeMod = p.size * (1 + influence * 2);
    ctx.beginPath();
    ctx.arc(p.x, p.y, sizeMod, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(state.color, p.alpha * p.life);
    ctx.fill();
  }
}

// ── 3B. Ondas ───────────────────────────────────────────────────────────────

function drawWaves(t, influence) {
  const w     = canvas.width;
  const h     = canvas.height;
  const lines = Math.floor(3 + state.intensity * 1.5);
  const amp   = (h * 0.08) * (1 + influence * 2);
  const freq  = 0.008 + influence * 0.006;
  const spd   = state.speed * 0.02;

  for (let i = 0; i < lines; i++) {
    const yBase  = (h / (lines + 1)) * (i + 1);
    const offset = (t * spd) + (i * 1.2);
    const alpha  = 0.3 + (i / lines) * 0.5;
    const lwidth = 1 + (state.intensity * 0.3) * (1 + influence);

    ctx.beginPath();
    ctx.lineWidth   = lwidth;
    ctx.strokeStyle = hexToRgba(state.color, alpha);

    for (let x = 0; x <= w; x += 2) {
      const y = yBase
        + Math.sin(x * freq + offset) * amp
        + Math.sin(x * freq * 1.7 + offset * 0.8) * amp * 0.4;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// ── 3C. Círculos ─────────────────────────────────────────────────────────────

function drawCircles(t, influence) {
  const cx     = canvas.width  / 2;
  const cy     = canvas.height / 2;
  const rings  = Math.floor(3 + state.intensity * 1.2);
  const pulse  = 1 + Math.sin(t * state.speed * 0.04) * 0.15 * (1 + influence * 2);
  const maxR   = Math.min(canvas.width, canvas.height) * 0.42;
  const rotRad = (state.rotation * Math.PI) / 180;

  for (let i = 1; i <= rings; i++) {
    const frac  = i / rings;
    const r     = maxR * frac * pulse * (1 + influence * 0.5);
    const alpha = (1 - frac * 0.7) * (0.4 + influence * 0.4);
    const lw    = (1 + state.intensity * 0.25) * (1 + influence * 0.5);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotRad * 0.005 * t + i * 0.3);
    ctx.translate(-cx, -cy);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth   = lw;
    ctx.strokeStyle = hexToRgba(state.color, alpha);
    ctx.stroke();

    if (state.intensity > 3) {
      const dotAlpha = alpha * 0.8;
      [[r, 0], [-r, 0], [0, r], [0, -r]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, lw * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(state.color, dotAlpha);
        ctx.fill();
      });
    }
    ctx.restore();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. MÓDULO DE AUDIO
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
  audioStream = null;
  audioCtx    = null;
  analyser    = null;
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
// 5. MÓDULO DE CÁMARA
// ══════════════════════════════════════════════════════════════════════════════

// El <video> NO puede estar en display:none — los browsers no decodifican
// frames de videos ocultos. Lo posicionamos fuera de pantalla con CSS.
const videoEl     = document.getElementById('hiddenVideo');
const offCanvas   = document.getElementById('hiddenCanvas');
let offCtx        = null;
let cameraStream  = null;
let prevFrameData = null;
let cameraReady   = false;

/**
 * Pide permiso de webcam, asigna el stream y espera a que el video
 * esté reproduciendo de verdad antes de marcar cameraReady = true.
 */
async function startCamera() {
  try {
    cameraReady   = false;
    prevFrameData = null;

    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

    // Asignar stream y forzar play() — necesario en algunos browsers
    videoEl.srcObject = cameraStream;
    videoEl.play().catch(() => {}); // ignorar error si autoplay ya lo hizo

    // Esperar a que el video tenga frames decodificados
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout webcam')), 8000);

      function checkReady() {
        // readyState 2 = HAVE_CURRENT_DATA (suficiente para drawImage)
        if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
          clearTimeout(timeout);
          resolve();
        } else {
          videoEl.addEventListener('canplay', () => {
            clearTimeout(timeout);
            resolve();
          }, { once: true });
        }
      }
      checkReady();
    });

    // Canvas offscreen pequeño solo para medir movimiento
    offCanvas.width  = 160;
    offCanvas.height = 90;
    offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    cameraReady = true;
    console.log('Cámara lista — videoWidth:', videoEl.videoWidth, 'readyState:', videoEl.readyState);
    return true;

  } catch (err) {
    console.error('Error webcam:', err);
    cameraStream = null;
    cameraReady  = false;
    return false;
  }
}

function stopCamera() {
  if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
  videoEl.srcObject = null;
  prevFrameData = null;
  cameraReady   = false;
  state.motionLevel = 0;
}

/**
 * Dibuja el video de la webcam como fondo del canvas principal.
 * Usa videoWidth/videoHeight para no dibujar un rect negro si el
 * elemento aún no tiene dimensiones reales.
 */
function drawCameraBackground() {
  // Doble check: cameraReady Y que el video tenga dimensiones reales
  if (!cameraReady || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) return;

  const w = canvas.width;
  const h = canvas.height;

  // Espejo horizontal (cámara frontal)
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, 0, 0, w, h);
  ctx.restore();

  // Oscurecimiento para que los visuales resalten
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, w, h);
}

/**
 * Mide nivel de movimiento comparando frames consecutivos.
 * Se llama cada 3 frames para no bloquear el loop principal.
 */
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
    const pixels = curr.data.length / 16;
    state.motionLevel = Math.min(1, diff / (pixels * 3 * 25));
  }
  prevFrameData = new Uint8ClampedArray(curr.data);
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. BUCLE DE ANIMACIÓN PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

let fpsTime  = 0;
let fpsCount = 0;

const statusMode   = document.getElementById('status-mode');
const statusVisual = document.getElementById('status-visual');
const statusFps    = document.getElementById('status-fps');

function animate(timestamp) {
  if (!state.running) return;
  requestAnimationFrame(animate);

  fpsCount++;
  if (timestamp - fpsTime >= 1000) {
    statusFps.textContent = `FPS: ${fpsCount}`;
    fpsCount = 0;
    fpsTime  = timestamp;
  }

  state.frame++;

  // Actualizar sensores
  if (state.inputMode === 'audio' || state.inputMode === 'mixed') {
    updateAudioLevel();
  }
  if ((state.inputMode === 'camera' || state.inputMode === 'mixed') && state.frame % 3 === 0) {
    updateMotionLevel();
  }

  // Influencia combinada (0..1) para modular los visuales
  let influence = 0;
  if (state.inputMode === 'audio')  influence = state.audioLevel;
  if (state.inputMode === 'camera') influence = state.motionLevel;
  if (state.inputMode === 'mixed')  influence = Math.min(1, (state.audioLevel + state.motionLevel) * 0.7);

  const hasCam = (state.inputMode === 'camera' || state.inputMode === 'mixed') && cameraReady;

  if (hasCam) {
    // Fondo = frame de webcam (la función ya aplica el oscurecimiento)
    drawCameraBackground();
  } else {
    // Fondo negro con trail (estela)
    const trailAlpha = Math.max(0.05, 0.25 - influence * 0.1);
    ctx.fillStyle = `rgba(0,0,0,${trailAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Dibujar visual activo encima del fondo
  switch (state.visualMode) {
    case 'particles': drawParticles(influence);            break;
    case 'waves':     drawWaves(state.frame, influence);   break;
    case 'circles':   drawCircles(state.frame, influence); break;
  }
}

initParticles();
requestAnimationFrame(animate);

// ══════════════════════════════════════════════════════════════════════════════
// 7. CONTROLES DE UI
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
    if (ok) {
      state.inputMode = mode;
      btn.classList.add('active');
    }
    updateStatusBar();
  });
});

async function activateInputMode(mode) {
  showOverlay(`Activando ${mode}...`);
  let ok = true;
  if (mode === 'audio' || mode === 'mixed')            ok = await startAudio();
  if ((mode === 'camera' || mode === 'mixed') && ok)   ok = await startCamera();
  hideOverlay();
  if (!ok) showOverlay('Acceso denegado ✕', 2500);
  return ok;
}

async function deactivateInputMode() {
  stopAudio();
  stopCamera();
  state.inputMode   = 'none';
  state.audioLevel  = 0;
  state.motionLevel = 0;
}

// ── Modos visuales ────────────────────────────────────────────────────────────

document.querySelectorAll('.visual-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.visual-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.visualMode = btn.dataset.visual;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.visualMode === 'particles') initParticles();
    updateStatusBar();
  });
});

// ── Status bar ────────────────────────────────────────────────────────────────

function updateStatusBar() {
  const modeLabels = { none: 'NINGUNO', audio: 'AUDIO', camera: 'CÁMARA', mixed: 'MIXTO' };
  const visLabels  = { particles: 'PARTÍCULAS', waves: 'ONDAS', circles: 'CÍRCULOS' };
  statusMode.textContent   = `MODO: ${modeLabels[state.inputMode] || state.inputMode.toUpperCase()}`;
  statusVisual.textContent = `VISUAL: ${visLabels[state.visualMode] || state.visualMode.toUpperCase()}`;
  statusMode.classList.toggle('active', state.inputMode !== 'none');
}

// ── Overlay de canvas ─────────────────────────────────────────────────────────

const overlay        = document.getElementById('canvas-overlay');
const overlayMessage = document.getElementById('overlay-message');
let overlayTimer     = null;

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
// 8. SISTEMA DE PRESETS
// ══════════════════════════════════════════════════════════════════════════════

const presetList    = document.getElementById('preset-list');
const presetNameEl  = document.getElementById('preset-name');
const btnSavePreset = document.getElementById('btn-save-preset');

async function loadPresets() {
  try {
    const res  = await fetch('/api/presets');
    const data = await res.json();
    renderPresetList(data);
  } catch (err) {
    console.error('Error cargando presets:', err);
  }
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
    li.innerHTML = `
      <span class="preset-item-name">${escHtml(p.name)}</span>
      <span class="preset-item-info">${p.visual}</span>
      <button class="preset-del" data-id="${p.id}" title="Eliminar">✕</button>
    `;
    li.querySelector('.preset-item-name').addEventListener('click', () => applyPreset(p));
    li.querySelector('.preset-item-info').addEventListener('click', () => applyPreset(p));
    li.querySelector('.preset-del').addEventListener('click', async e => {
      e.stopPropagation();
      await deletePreset(p.id);
    });
    presetList.appendChild(li);
  });
}

function applyPreset(p) {
  state.color      = p.color;
  state.speed      = p.speed;
  state.intensity  = p.intensity;
  state.rotation   = p.rotation;
  state.visualMode = p.visual;

  document.getElementById('ctrl-color').value     = p.color;
  document.getElementById('ctrl-speed').value     = p.speed;
  document.getElementById('ctrl-intensity').value = p.intensity;
  document.getElementById('ctrl-rotation').value  = p.rotation;
  document.getElementById('val-speed').textContent     = p.speed.toFixed(1);
  document.getElementById('val-intensity').textContent = p.intensity.toFixed(1);
  document.getElementById('val-rotation').textContent  = `${Math.round(p.rotation)}°`;

  document.querySelectorAll('.visual-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.visual === p.visual)
  );

  if (p.visual === 'particles') initParticles();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateStatusBar();
}

btnSavePreset.addEventListener('click', async () => {
  const name = presetNameEl.value.trim();
  if (!name) { presetNameEl.focus(); return; }

  try {
    const res = await fetch('/api/presets', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        color:     state.color,
        speed:     state.speed,
        intensity: state.intensity,
        rotation:  state.rotation,
        mode:      state.inputMode,
        visual:    state.visualMode,
      }),
    });
    if (res.ok) { presetNameEl.value = ''; await loadPresets(); }
  } catch (err) {
    console.error('Error guardando preset:', err);
  }
});

async function deletePreset(id) {
  try {
    await fetch(`/api/presets/${id}`, { method: 'DELETE' });
    await loadPresets();
  } catch (err) {
    console.error('Error eliminando preset:', err);
  }
}

loadPresets();

// ══════════════════════════════════════════════════════════════════════════════
// 9. UTILIDADES
// ══════════════════════════════════════════════════════════════════════════════

function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
