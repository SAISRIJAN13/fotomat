/* ============================================================
   FotoMat × Navaratri — Main Entry Point
   Wire UI, routing, and sticker drag-drop-with-scroll-while-holding.
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

// Render sticker palette into the editor bottom sheet / side panel
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

    // Use <use> to reference the existing symbol from dist/index.html
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
    e.preventDefault();
    const item = e.target.closest('.sticker-palette-item');
    if (!item) return;

    const stickerId = item.getAttribute('data-sticker');
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

    // Do NOT preventDefault — we want the browser to keep scrolling.
    // This is the "scroll-while-holding" feature.
    const stickerId = item.getAttribute('data-sticker');
    item.style.opacity = '0.5';
  });

  palette.addEventListener('touchend', (e) => {
    const item = e.target.closest('.sticker-palette-item');
    if (item) {
      item.style.opacity = '';
    }
  });

  palette.addEventListener('touchmove', (e) => {
    const item = e.target.closest('.sticker-palette-item');
    if (!item) return;

    // We deliberately do NOT call preventDefault here, so scrolling proceeds naturally.
  });
}

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

function closeBooth() {
  showPage('landing');
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
    }
  });
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  // Ensure Navaratri theme attribute
  const html = document.documentElement;
  if (html.getAttribute('data-theme') !== 'navaratri') {
    html.setAttribute('data-theme', 'navaratri');
  }

  // Render sticker palette in editor
  renderStickerPalette();

  // Simple close-booth handler
  document.getElementById('btn-close-booth')?.addEventListener('click', closeBooth);
  // CTA buttons → open booth
  document.getElementById('btn-hero-cta')?.addEventListener('click', () => showPage('booth'));
  document.getElementById('btn-sticky-cta')?.addEventListener('click', () => showPage('booth'));

  wireKeyboard();

  showPage('landing');
}

init();
