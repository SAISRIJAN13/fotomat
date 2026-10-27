/* ============================================================
   FotoMat × Navaratri — Main Entry Point
   Wire modules, routing, UI interactions.
   ============================================================ */

import { state, bus, resetCapture } from './modules/state.js';
import { getNavaratriNight } from './modules/utils.js';
import { initScrollEffects } from './modules/effects.js';
import { LOOKS, buildLandingChips, buildLookRail } from './modules/looks.js';
import { FRAMES, buildLandingCards, buildFrameRail } from './modules/frames.js';
import { startCamera, stopCamera, flipCamera } from './modules/camera.js';
import { initCapture } from './modules/capture.js';
import { renderStrip, renderStripToBlob, shareOrDownload } from './modules/compose.js';
import { initAuth, openAuth, signOut, resumeSessionFromStorage } from './modules/auth.js';
import { renderGallery, saveStrip } from './modules/gallery.js';
import { initEditor, openEditor } from './modules/editor.js';

// Expose LOOKS and FRAMES globally for state helpers
window.__LOOKS = LOOKS;
window.__FRAMES = FRAMES;

/* ============================================================
   ROUTING
   ============================================================ */
const pages = {
  landing: document.getElementById('landing'),
  booth: document.getElementById('booth'),
  gallery: document.getElementById('gallery'),
};

let currentPage = 'landing';

function showPage(id) {
  Object.values(pages).forEach((p) => p && p.classList.remove('active'));
  if (pages[id]) pages[id].classList.add('active');

  currentPage = id;
  window.scrollTo(0, 0);
}

/* ============================================================
   NIGHT LOGIC
   ============================================================ */
function applyNight() {
  const night = getNavaratriNight();
  state.navaratriNight = night;

  const badge = document.getElementById('hero-badge-text');
  const footerLabel = document.getElementById('footer-night-label');
  const footerRing = document.getElementById('footer-ring-svg');

  if (badge) badge.textContent = night.label === 'See you next year' ? 'Navaratri 2026' : night.label;
  if (footerLabel) footerLabel.textContent = night.label === 'See you next year' ? 'See you next year' : night.label;
  if (footerRing) footerRing.dataset.night = night.night || 1;
}

/* ============================================================
   BOOTH OPEN / CLOSE
   ============================================================ */
async function openBooth() {
  showPage('booth');
  initCapture();
  // Build desktop rails
  buildLookRail(document.getElementById('look-rail'));
  buildFrameRail(document.getElementById('frame-rail-booth'));
  // Build mobile rails
  buildLookRail(document.getElementById('look-rail-mobile'));
  buildFrameRail(document.getElementById('frame-rail-mobile'));
  await startCamera();
  // Enable both shutters
  const shutters = ['shutter-ring', 'shutter-ring-mobile'];
  shutters.forEach((id) => {
    const s = document.getElementById(id);
    if (s) s.disabled = !state.cameraReady;
  });
}

function closeBooth() {
  stopCamera();
  resetCapture();
  showPage('landing');
}

/* ============================================================
   RESULT / DOWNLOAD
   ============================================================ */
async function showResult() {
  const canvas = await renderStrip();
  const dataURL = canvas.toDataURL('image/jpeg', 0.92);
  const img = document.getElementById('strip-img');
  if (img) img.src = dataURL;

  const result = document.getElementById('strip-result');
  if (result) result.classList.add('active');

  // Pre-render blob for download
  state.lastStripBlob = await renderStripToBlob();
}

async function downloadStrip() {
  if (!state.lastStripBlob) state.lastStripBlob = await renderStripToBlob();
  const night = state.navaratriNight?.night || 1;
  const result = await shareOrDownload(state.lastStripBlob, `fotomat-night${night}-${Date.now()}.jpg`);

  // Save to gallery
  await saveStrip(state.lastStripBlob, {
    night: state.navaratriNight?.night || null,
    format: state.exportFormat,
  });

  return result;
}

/* ============================================================
   EVENT WIRING
   ============================================================ */
function wireUI() {
  // CTA buttons → booth if already signed in, otherwise auth first (auth-gated flow)
  const handleCTA = () => {
    if (state.user) { openBooth(); }
    else { openAuth(); }
  };
  document.getElementById('btn-hero-cta')?.addEventListener('click', handleCTA);
  document.getElementById('btn-sticky-cta')?.addEventListener('click', handleCTA);

  // Auth events → open booth after successful sign in / sign up
  bus.addEventListener('auth:success', openBooth);

  // Close booth
  document.getElementById('btn-close-booth')?.addEventListener('click', closeBooth);

  // Retry camera
  document.getElementById('btn-retry-cam')?.addEventListener('click', () => startCamera());

  // Flip camera (double-tap viewfinder)
  document.getElementById('viewfinder')?.addEventListener('dblclick', () => flipCamera());

  // Legacy dialog download
  document.getElementById('btn-download')?.addEventListener('click', downloadStrip);

  // Right-panel actions
  document.getElementById('btn-download-strip')?.addEventListener('click', downloadStrip);
  document.getElementById('btn-new-strip')?.addEventListener('click', startNewStrip);

  // Legacy full-screen result (no longer auto-opened; kept for share/edit)
  document.getElementById('btn-next-group')?.addEventListener('click', startNewStrip);
  document.getElementById('btn-share')?.addEventListener('click', async () => {
    if (!state.lastStripBlob) state.lastStripBlob = await renderStripToBlob();
    const night = state.navaratriNight?.night || 1;
    await shareOrDownload(state.lastStripBlob, `fotomat-night${night}-${Date.now()}.jpg`);
  });
  document.getElementById('btn-close-result')?.addEventListener('click', () => {
    document.getElementById('strip-result')?.classList.remove('active');
  });

  // Sign out from the booth topbar
  document.getElementById('btn-signout-booth')?.addEventListener('click', async () => {
    await signOut();
    closeBooth();
  });

  // Listen for capture done → refresh the live strip preview in-panel
  bus.addEventListener('capture:done', () => {
    updateStripPreview();
  });

  // Editor
  document.getElementById('btn-edit-strip')?.addEventListener('click', openEditor);
  initEditor();
}

/* ============================================================
   STICKERS — Drag, drop, and scroll-while-holding
   ============================================================ */

// Sticker SVG references matching the <symbol> defs in dist/index.html
const STICKER_SVG = [
  'sticker-dandiya-1', 'sticker-dandiya-2', 'sticker-dandiya-3', 'sticker-dandiya-4',
  'sticker-diya-1', 'sticker-diya-2', 'sticker-diya-3', 'sticker-diya-4',
  'sticker-sparkle-1', 'sticker-sparkle-2', 'sticker-sparkle-3', 'sticker-sparkle-4',
  'sticker-marigold-1', 'sticker-marigold-2', 'sticker-marigold-3', 'sticker-marigold-4',
  'sticker-pattern-1', 'sticker-pattern-2', 'sticker-pattern-3', 'sticker-pattern-4',
  'sticker-word-namaste', 'sticker-word-jaimata', 'sticker-word-festival', 'sticker-word-night',
];

// Track active sticker drags so we can clean up
const activeDrags = new Set();

function renderStickerPalette() {
  const body = document.getElementById('editor-body');
  if (!body) return;

  const grid = document.createElement('div');
  grid.className = 'sticker-palette-grid';
  grid.setAttribute('role', 'list');
  grid.setAttribute('aria-label', 'Sticker palette');

  STICKER_SVG.forEach((id) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sticker-palette-item';
    btn.setAttribute('data-sticker', id);
    btn.setAttribute('draggable', 'true');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('width', '32');
    svg.setAttribute('height', '32');

    // Use <use> to reference the existing symbol
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#' + id);
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);

    btn.appendChild(svg);
    grid.appendChild(btn);
  });

  body.innerHTML = '';
  body.appendChild(grid);
  attachStickerPaletteEvents(grid);
}

function attachStickerPaletteEvents(palette) {
  // --- Desktop / mouse drag ---
  palette.addEventListener('dragstart', (e) => {
    e.preventDefault(); // We do manual positioning, so suppress native drag image
    const item = e.target.closest('.sticker-palette-item');
    if (!item) return;

    const stickerId = item.getAttribute('data-sticker');
    state.draggedSticker = stickerId;
    state.isDraggingSticker = true;

    // Hide cursor default ghost
    item.style.opacity = '0.5';
  });

  palette.addEventListener('dragend', (e) => {
    const item = e.target.closest('.sticker-palette-item');
    if (item) item.style.opacity = '';
  });

  // --- Touch: allow scrolling while holding a sticker ---
  palette.addEventListener('touchstart', (e) => {
    const item = e.target.closest('.sticker-palette-item');
    if (!item) return;

    // Do NOT preventDefault here — we want the browser to keep scrolling.
    // This is the "scroll-while-holding" feature.
    const stickerId = item.getAttribute('data-sticker');
    state.draggedSticker = stickerId;
    state.isTouchHoldingSticker = true;
    item.style.opacity = '0.5';
  });

  palette.addEventListener('touchend', (e) => {
    const item = e.target.closest('.sticker-palette-item');
    if (item) {
      item.style.opacity = '';
      state.draggedSticker = null;
      state.isTouchHoldingSticker = false;
    }
  });

  palette.addEventListener('touchmove', (e) => {
    const item = e.target.closest('.sticker-palette-item');
    if (!item) return;

    // If user is scrolling (touch moving vertically without placing sticker),
    // allow native scroll. Only start actual drag placement if movement is
    // small/none or if they lift the finger.
    if (state.isTouchHoldingSticker) {
      // We deliberately do NOT call preventDefault here, so scrolling proceeds.
    }
  });
}

/* ============================================================
   KEYBOARD SHORTCUTS (desktop)
   ============================================================ */
function wireKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (currentPage !== 'booth') return;
    if (e.key === ' ') {
      e.preventDefault();
      document.getElementById('shutter-ring')?.click();
    } else if (e.key === 'Escape') {
      closeBooth();
    } else if (e.key === 'f' || e.key === 'F') {
      flipCamera();
    }
  });
}

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  applyNight();
  initScrollEffects();
  initAuth();
  await resumeSessionFromStorage();

  // Build landing content
  buildLandingChips(document.getElementById('chip-grid'));
  buildLandingCards(document.getElementById('frame-rail'));

  // Render sticker palette in editor (for booth and gallery)
  renderStickerPalette();

  wireUI();
  wireKeyboard();

  // Default page
  showPage('landing');
}

init();
