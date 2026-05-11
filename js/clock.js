/**
 * @module clock
 * @description State-Sync Analog Clock module.
 *
 * Renders a real-time analog clock at 60fps using the HTML5 Canvas 2D API.
 * The animation loop is driven exclusively by window.requestAnimationFrame
 * (setInterval is NOT used, as per the assignment specification).
 *
 * Hand positions are calculated with Math.cos() and Math.sin() (trigonometry).
 *
 * A toggle button outside the canvas switches between Day Mode (light palette)
 * and Night Mode (dark palette with glowing hands) without ever pausing the
 * animation — demonstrating state management during live rendering.
 *
 * Technical highlights:
 *  - window.requestAnimationFrame for 60fps sync
 *  - Math.PI trigonometry for all hand coordinates
 *  - Smooth second hand using millisecond interpolation
 *  - Dual theme state toggled without stopping the rAF loop
 */

'use strict';

/* ================================================================
   THEME DEFINITIONS
================================================================ */

/**
 * @description Color theme configurations for Day Mode and Night Mode.
 *              Each property maps to a canvas drawing operation.
 *
 * @type {{ day: Object, night: Object }}
 */
const THEMES = {
  day: {
    faceInner:    '#ffffff',
    faceOuter:    '#e8eaf6',
    bezel:        '#5c6bc0',
    bezelGlow:    'rgba(92, 107, 192, 0)',
    tickHour:     '#3949ab',
    tickMinute:   '#9fa8da',
    numerals:     '#1a237e',
    handHour:     '#1a237e',
    handMinute:   '#283593',
    handSecond:   '#e53935',
    handTail:     '#e53935',
    centerOuter:  '#5c6bc0',
    centerInner:  '#ffffff',
    shadowBlur:   0,
  },
  night: {
    faceInner:    '#0d1117',
    faceOuter:    '#161b22',
    bezel:        '#22d3ee',
    bezelGlow:    'rgba(34, 211, 238, 0.6)',
    tickHour:     '#22d3ee',
    tickMinute:   '#164e63',
    numerals:     '#67e8f9',
    handHour:     '#e2e8f0',
    handMinute:   '#94a3b8',
    handSecond:   '#818cf8',
    handTail:     '#818cf8',
    centerOuter:  '#22d3ee',
    centerInner:  '#0d1117',
    shadowBlur:   10,
  },
};

/* ================================================================
   MODULE STATE
================================================================ */

let isDayMode  = true;  // Current theme flag (toggled by button)
let rafId      = null;  // requestAnimationFrame handle

/* ================================================================
   DRAWING HELPERS
================================================================ */

/**
 * @description Draws the circular clock face with a radial gradient fill
 *              and a glowing bezel ring.
 *
 * @param {CanvasRenderingContext2D} ctx    - Canvas 2D context.
 * @param {number}                  cx     - Center X coordinate.
 * @param {number}                  cy     - Center Y coordinate.
 * @param {number}                  radius - Outer radius of the clock face.
 * @param {Object}                  theme  - Active color theme object.
 * @returns {void}
 */
function drawFace(ctx, cx, cy, radius, theme) {
  // Radial gradient fill
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
  grad.addColorStop(0, theme.faceInner);
  grad.addColorStop(1, theme.faceOuter);

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Bezel ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle  = theme.bezel;
  ctx.lineWidth    = 3;
  ctx.shadowColor  = theme.bezelGlow;
  ctx.shadowBlur   = isDayMode ? 0 : 22;
  ctx.stroke();
  ctx.shadowBlur   = 0;
}

/**
 * @description Draws tick marks and hour numerals around the clock face.
 *              Uses Math.cos and Math.sin to position each element on the
 *              circumference.
 *
 * @param {CanvasRenderingContext2D} ctx    - Canvas 2D context.
 * @param {number}                  cx     - Center X coordinate.
 * @param {number}                  cy     - Center Y coordinate.
 * @param {number}                  radius - Outer radius of the clock face.
 * @param {Object}                  theme  - Active color theme object.
 * @returns {void}
 */
function drawMarkers(ctx, cx, cy, radius, theme) {
  for (let i = 0; i < 60; i++) {
    // Each tick is 6 degrees apart (360 / 60 = 6°)
    const angle   = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const isHour  = i % 5 === 0;
    const outerR  = radius - 5;
    const innerR  = isHour ? radius - 20 : radius - 11;

    // Tick coordinates using trigonometry
    const x1 = cx + Math.cos(angle) * outerR;
    const y1 = cy + Math.sin(angle) * outerR;
    const x2 = cx + Math.cos(angle) * innerR;
    const y2 = cy + Math.sin(angle) * innerR;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = isHour ? theme.tickHour : theme.tickMinute;
    ctx.lineWidth   = isHour ? 2.5 : 1;
    ctx.lineCap     = 'round';
    ctx.stroke();

    // Hour numerals (1–12)
    if (isHour) {
      const hour     = i === 0 ? 12 : i / 5;
      const numR     = radius - 36;
      const nx       = cx + Math.cos(angle) * numR;
      const ny       = cy + Math.sin(angle) * numR;
      const fontSize = Math.round(radius * 0.11);

      ctx.fillStyle      = theme.numerals;
      ctx.font           = `700 ${fontSize}px Inter, sans-serif`;
      ctx.textAlign      = 'center';
      ctx.textBaseline   = 'middle';
      ctx.shadowColor    = isDayMode ? 'transparent' : 'rgba(34,211,238,0.5)';
      ctx.shadowBlur     = isDayMode ? 0 : 6;
      ctx.fillText(hour, nx, ny);
      ctx.shadowBlur     = 0;
    }
  }
}

/**
 * @description Draws a single clock hand from the center outward using
 *              Math.cos / Math.sin trigonometry to compute tip and tail
 *              coordinates from the given angle.
 *
 * @param {CanvasRenderingContext2D} ctx        - Canvas 2D context.
 * @param {number}                  cx         - Center X coordinate.
 * @param {number}                  cy         - Center Y coordinate.
 * @param {number}                  angle      - Hand angle in radians
 *                                               (0 = 12 o'clock position).
 * @param {number}                  length     - Length of the hand tip from center.
 * @param {number}                  tailLen    - Length of the counter-tail behind center.
 * @param {number}                  width      - Stroke width in pixels.
 * @param {string}                  color      - CSS color for the hand.
 * @param {number}                  glowBlur   - Shadow blur radius (0 = no glow).
 * @returns {void}
 */
function drawHand(ctx, cx, cy, angle, length, tailLen, width, color, glowBlur) {
  // Offset by -90° so that angle 0 points to 12 o'clock
  const rad  = angle - Math.PI / 2;

  const tipX  = cx + Math.cos(rad) * length;
  const tipY  = cy + Math.sin(rad) * length;
  const tailX = cx - Math.cos(rad) * tailLen;
  const tailY = cy - Math.sin(rad) * tailLen;

  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(tipX, tipY);
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  ctx.lineCap     = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur  = glowBlur;
  ctx.stroke();
  ctx.shadowBlur  = 0;
}

/**
 * @description Draws the center pivot cap (two concentric circles).
 *
 * @param {CanvasRenderingContext2D} ctx   - Canvas 2D context.
 * @param {number}                  cx    - Center X coordinate.
 * @param {number}                  cy    - Center Y coordinate.
 * @param {Object}                  theme - Active color theme object.
 * @returns {void}
 */
function drawCenter(ctx, cx, cy, theme) {
  // Outer dot
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle   = theme.centerOuter;
  ctx.shadowColor = theme.centerOuter;
  ctx.shadowBlur  = isDayMode ? 0 : 12;
  ctx.fill();
  ctx.shadowBlur  = 0;

  // Inner dot
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = theme.centerInner;
  ctx.fill();
}

/* ================================================================
   MAIN RENDER LOOP
================================================================ */

/**
 * @description Main render function invoked each animation frame.
 *              Reads the current system time, calculates hand angles using
 *              Math trigonometry with millisecond-level smoothing, clears
 *              the canvas, and redraws all clock elements.
 *
 *              This function schedules itself via window.requestAnimationFrame
 *              to achieve ~60fps synchronisation with the browser's refresh rate.
 *              setInterval is intentionally NOT used (per assignment spec).
 *
 * @param {HTMLCanvasElement}       canvas - The target canvas element.
 * @param {CanvasRenderingContext2D} ctx   - The 2D rendering context.
 * @returns {void}
 */
function renderClock(canvas, ctx) {
  const W      = canvas.width;
  const H      = canvas.height;
  const cx     = W / 2;
  const cy     = H / 2;
  const radius = Math.min(W, H) / 2 - 12;
  const theme  = isDayMode ? THEMES.day : THEMES.night;

  // Clear the entire canvas
  ctx.clearRect(0, 0, W, H);

  // ── Draw face and markers ────────────────────────────────────
  drawFace(ctx, cx, cy, radius, theme);
  drawMarkers(ctx, cx, cy, radius, theme);

  // ── Calculate hand angles from current time ──────────────────
  const now = new Date();
  const hr  = now.getHours()        % 12;
  const min = now.getMinutes();
  const sec = now.getSeconds();
  const ms  = now.getMilliseconds();

  // Smooth angles using sub-unit fractions (fluid 60fps motion)
  const secAngle = ((sec + ms  / 1000)       / 60) * Math.PI * 2;
  const minAngle = ((min + sec / 60)         / 60) * Math.PI * 2;
  const hrAngle  = ((hr  + min / 60 + sec / 3600) / 12) * Math.PI * 2;

  const glow = theme.shadowBlur;

  // ── Draw hands (back to front: hour → minute → second) ───────
  drawHand(ctx, cx, cy, hrAngle,  radius * 0.52, radius * 0.08, 6,   theme.handHour,   glow);
  drawHand(ctx, cx, cy, minAngle, radius * 0.72, radius * 0.08, 4,   theme.handMinute, glow);
  drawHand(ctx, cx, cy, secAngle, radius * 0.83, radius * 0.12, 1.5, theme.handSecond, glow * 2);

  // Center cap drawn last so it overlaps all hands
  drawCenter(ctx, cx, cy, theme);

  // ── Update digital readout ───────────────────────────────────
  const timeStr = now.toLocaleTimeString('en-US', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  document.getElementById('clockDigital').textContent = timeStr;

  // ── Schedule next frame via requestAnimationFrame ────────────
  rafId = window.requestAnimationFrame(() => renderClock(canvas, ctx));
}

/* ================================================================
   THEME TOGGLE
================================================================ */

/**
 * @description Toggles between Day Mode and Night Mode by flipping the
 *              isDayMode flag and updating the button label and glow class.
 *              The rAF animation loop continues uninterrupted — only the
 *              theme state variable changes.
 *
 * @returns {void}
 */
function toggleTheme() {
  isDayMode = !isDayMode;

  const btn    = document.getElementById('themeToggle');
  const label  = document.getElementById('toggleLabel');
  const glow   = document.getElementById('clockGlow');

  if (isDayMode) {
    btn.className   = 'toggle-btn toggle-btn--day';
    btn.querySelector('i').className = 'fa fa-sun';
    label.textContent = 'Day Mode';
    glow.classList.remove('night');
  } else {
    btn.className   = 'toggle-btn toggle-btn--night';
    btn.querySelector('i').className = 'fa fa-moon';
    label.textContent = 'Night Mode';
    glow.classList.add('night');
  }
}

/* ================================================================
   INITIALISATION
================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('clockCanvas');
  const ctx    = canvas.getContext('2d');

  // Kick off the rAF render loop
  renderClock(canvas, ctx);

  // Wire up the theme toggle button
  document.getElementById('themeToggle')
    .addEventListener('click', toggleTheme);
});
