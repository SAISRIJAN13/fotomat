/* ============================================================
   FotoMat 2000 — Custom auth + CSS filter pipeline
   ============================================================ */

/* ---------- Supabase ---------- */
const SUPABASE_URL = "https://adjnzwcpwkiudqvavqgz.supabase.co";
const SUPABASE_KEY = "sb_publishable_eGJ1Ttm1DU3RZclfHOoWAQ_h_GtJmo2";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ---------- Mechanical keyboard click sound ---------- */
let _clickCtx = null;
function getClickCtx() {
  if (!_clickCtx) _clickCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _clickCtx;
}
function playKeyClick() {
  const ctx = getClickCtx();
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;

  /* short noise burst (keycap hit) */
  const bufLen = ctx.sampleRate * 0.015 | 0;
  const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 3);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.28, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 1200;
  noise.connect(hp).connect(noiseGain).connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.04);

  /* sine thud (housing resonance) */
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(380, now);
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.03);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.18, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  osc.connect(oscGain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.045);
}

/* attach click sound to all buttons */
document.addEventListener("click", (e) => {
  if (e.target.closest(".btn")) playKeyClick();
});

/* ---------- Password hashing (PBKDF2 via Web Crypto) ---------- */
const PBKDF2_ITER = 100000;

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBuf(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}
async function hashPassword(password, saltB64) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  let salt;
  if (saltB64) {
    salt = b64ToBuf(saltB64);
  } else {
    salt = crypto.getRandomValues(new Uint8Array(16));
  }
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" },
    keyMaterial, 256
  );
  return { hash: bufToB64(bits), salt: bufToB64(salt) };
}

/* ============================================================
   20 FILTERS — CSS filter params
   ============================================================ */
const FILTERS = [
  { name: "Normal",   bright: 1.0,  contrast: 1.0,  sat: 1.0,  hue: 0,   gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Glam",     bright: 1.1,  contrast: 1.0,  sat: 1.3,  hue: 0,   gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Grunge",   bright: 0.95, contrast: 1.3,  sat: 1.0,  hue: 0,   gray: 0.6,invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "VHS",      bright: 1.0,  contrast: 1.3,  sat: 1.8,  hue: -10, gray: 0.05, invert: 0, sepia: 0.05,  blur: 0.3,  tint: [0,0,0], grain: 0.35 },
  { name: "B&W",      bright: 1.1,  contrast: 1.1,  sat: 0,    hue: 0,   gray: 1,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Sepia",    bright: 1.05, contrast: 1.05, sat: 1.0,  hue: 0,   gray: 0,  invert: 0, sepia: 0.8,blur: 0,  tint: [0.9,0.75,0.55] },
  { name: "Cold",     bright: 1.05, contrast: 1.0,  sat: 1.2,  hue: 180, gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Warm",     bright: 1.05, contrast: 1.0,  sat: 1.4,  hue: -30, gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Fade",     bright: 1.15, contrast: 0.85, sat: 0.7,  hue: 0,   gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Punch",    bright: 1.0,  contrast: 1.4,  sat: 1.5,  hue: 0,   gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Dreamy",   bright: 1.15, contrast: 1.0,  sat: 1.3,  hue: 0,   gray: 0,  invert: 0, sepia: 0,  blur: 1.2,tint: [0,0,0] },
  { name: "Invert",   bright: 1.0,  contrast: 1.0,  sat: 1.0,  hue: 0,   gray: 0,  invert: 1, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Chrome",   bright: 1.1,  contrast: 1.5,  sat: 0.2,  hue: 0,   gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Neon",     bright: 1.2,  contrast: 1.3,  sat: 2.2,  hue: 15,  gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Xmas",     bright: 1.05, contrast: 1.0,  sat: 1.5,  hue: 90,  gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Halloween",bright: 0.9,  contrast: 1.2,  sat: 1.4,  hue: -90, gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Matrix",   bright: 0.85, contrast: 1.4,  sat: 3.0,  hue: 90,  gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Vintage",  bright: 1.05, contrast: 0.95, sat: 1.2,  hue: 0,   gray: 0,  invert: 0, sepia: 0.4,blur: 0, tint: [0,0,0] },
  { name: "Xray",     bright: 1.0,  contrast: 1.5,  sat: 1.0,  hue: 0,   gray: 1,  invert: 1, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Pop",      bright: 1.05, contrast: 1.25, sat: 2.0,  hue: 0,   gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] }
];

function buildCSSFilter(p) {
  const parts = [];
  if (p.bright !== 1.0) parts.push("brightness(" + p.bright + ")");
  if (p.contrast !== 1.0) parts.push("contrast(" + p.contrast + ")");
  if (p.sat !== 1.0) parts.push("saturate(" + p.sat + ")");
  if (p.hue !== 0) {
    let deg = p.hue;
    if (deg < 0) deg = 360 + deg;
    parts.push("hue-rotate(" + deg + "deg)");
  }
  if (p.gray > 0) parts.push("grayscale(" + p.gray + ")");
  if (p.invert > 0) parts.push("invert(" + p.invert + ")");
  if (p.sepia > 0) parts.push("sepia(" + p.sepia + ")");
  if (p.blur > 0) parts.push("blur(" + p.blur + "px)");
  return parts.length ? parts.join(" ") : "none";
}

/* ============================================================
   State & DOM
   ============================================================ */
const state = { user: null, photos: [], activeFilter: 0, stream: null, stickers: [[], [], [], []], timerSec: 10, film: "classic" };
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const video       = $("#video");
const flashEl     = $("#flash");
const bigTimer    = $("#big-timer");
const timerPill   = $("#timer-pill");
const shutter     = $("#shutter");
const strip       = $("#strip");
const filterGrid  = $("#filter-grid");
const downloadBtn = $("#download");
const downloadSingleBtn = $("#download-single");
const resetStripBtn = $("#reset-strip");
const welcomeUser = $("#welcome-user");
const stripDate   = $("#strip-date");

/* ============================================================
   NAVIGATION
   ============================================================ */
function showPage(id) {
  $$(".page").forEach((p) => p.classList.remove("active"));
  $("#" + id).classList.add("active");
  $$(".nav-link").forEach((n) => n.classList.toggle("active", n.dataset.nav === id));
  window.scrollTo(0, 0);
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-nav]");
  if (!t) return;
  const page = t.dataset.nav;
  if (page === "auth") {
    if (t.dataset.mode === "signin") switchTab("signin");
    else switchTab("signup");
  }
  if (page === "booth" && !state.user) { showPage("auth"); return; }
  if (page === "landing") stopCamera();
  if (page === "booth")   startCamera();
  showPage(page);
});

/* ============================================================
   AUTH  (custom — username + PBKDF2 password in fotomat_users)
   ============================================================ */
function switchTab(name) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  $$(".auth-form").forEach((f) => f.classList.toggle("active", f.id === name + "-form"));
}
$$(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
function setMsg(form, text, ok = false) {
  const m = form.querySelector(".form-msg");
  m.textContent = text;
  m.classList.toggle("ok", ok);
}
const SESSION_KEY = "fotomat_session_token";
function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
}

$("#signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const username = fd.get("username").trim();
  const password = fd.get("password");
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) { setMsg(form, "Username must be 3-24 chars (letters, numbers, _)."); return; }
  if (!password || password.length < 6) { setMsg(form, "Password must be at least 6 characters."); return; }
  setMsg(form, "Creating account…", true);
  try {
    const { data: existing } = await sb.from("fotomat_users").select("id").eq("username", username).maybeSingle();
    if (existing) { setMsg(form, "Username already taken."); return; }
    const { hash, salt } = await hashPassword(password);
    const { data: created, error } = await sb.from("fotomat_users").insert({ username, password_hash: hash + ":" + salt }).select("id, username").single();
    if (error) { setMsg(form, "Insert failed: " + error.message); console.error("signup:", error); return; }
    if (!created) { setMsg(form, "Insert returned no row (RLS may be blocking)."); return; }
    await createSession(created.id, created.username);
    setMsg(form, "Account created. Welcome.", true);
    setTimeout(() => enterBooth(created.username), 300);
  } catch (err) { setMsg(form, "Error: " + err.message); console.error(err); }
});

$("#signin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const username = fd.get("username").trim();
  const password = fd.get("password");
  setMsg(form, "Signing in…", true);
  try {
    const { data: row, error } = await sb.from("fotomat_users").select("id, username, password_hash").eq("username", username).maybeSingle();
    if (error || !row) { setMsg(form, "Invalid username or password."); return; }
    const [storedHash, storedSalt] = (row.password_hash || "").split(":");
    const { hash } = await hashPassword(password, storedSalt);
    if (!storedHash || hash !== storedHash) { setMsg(form, "Invalid username or password."); return; }
    await createSession(row.id, row.username);
    setMsg(form, "Welcome back.", true);
    setTimeout(() => enterBooth(row.username), 300);
  } catch (err) { setMsg(form, "Error: " + err.message); console.error(err); }
});

async function createSession(userId, username) {
  const token = randomToken();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await sb.from("fotomat_sessions").insert({ token, user_id: userId, expires_at: expires });
  localStorage.setItem(SESSION_KEY, token);
  state.user = { id: userId, username };
}
async function resumeSessionFromStorage() {
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) return;
  const { data: sess } = await sb.from("fotomat_sessions").select("user_id, expires_at, fotomat_users(id, username)").eq("token", token).maybeSingle();
  if (!sess || new Date(sess.expires_at) < new Date()) {
    localStorage.removeItem(SESSION_KEY);
    if (sess) await sb.from("fotomat_sessions").delete().eq("token", token);
    return;
  }
  state.user = { id: sess.fotomat_users.id, username: sess.fotomat_users.username };
  welcomeUser.textContent = "Welcome, " + state.user.username;
  stripDate.textContent = formatDate(new Date());
}
$("#logout").addEventListener("click", async () => {
  const token = localStorage.getItem(SESSION_KEY);
  if (token) await sb.from("fotomat_sessions").delete().eq("token", token);
  localStorage.removeItem(SESSION_KEY);
  state.user = null; state.photos = [];
  refreshStrip(); stopCamera(); showPage("landing");
});
function enterBooth(username) {
  welcomeUser.textContent = "Welcome, " + username;
  stripDate.textContent = formatDate(new Date());
  showPage("booth"); startCamera();
}

/* ============================================================
   FILTERS UI
   ============================================================ */
function buildFilters() {
  filterGrid.innerHTML = "";
  FILTERS.forEach((f, i) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "filter-swatch" + (i === 0 ? " active" : "");
    el.dataset.i = i;
    el.innerHTML = '<span class="label">' + f.name + "</span>";
    el.addEventListener("click", () => setFilter(i));
    filterGrid.appendChild(el);
  });
}
function setFilter(i) {
  state.activeFilter = i;
  $$(".filter-swatch").forEach((s, idx) => s.classList.toggle("active", idx === i));
  video.style.filter = buildCSSFilter(FILTERS[i]);
  const no = $("#noise-overlay");
  no.classList.toggle("visible", FILTERS[i].name === "VHS");
}

/* ============================================================
   CAMERA
   ============================================================ */
async function startCamera() {
  if (state.stream) return;
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
    video.srcObject = state.stream;
    await video.play();
    video.style.filter = buildCSSFilter(FILTERS[state.activeFilter]);
    $("#noise-overlay").classList.toggle("visible", FILTERS[state.activeFilter].name === "VHS");
    shutter.disabled = false;
    setTimerPill("Ready", false);
  } catch (err) {
    shutter.disabled = true;
    setTimerPill("No camera", true);
    alert("Camera access denied or unavailable.\n\n" + err.message);
  }
}
function stopCamera() {
  if (state.stream) { state.stream.getTracks().forEach((t) => t.stop()); state.stream = null; }
  video.srcObject = null;
  video.style.filter = "none";
  $("#noise-overlay").classList.remove("visible");
  shutter.disabled = true;
  setTimerPill("Stopped", true);
}

/* ============================================================
   CAPTURE — 4 shots, each with a 10s countdown
   ============================================================ */
const GAP_SECONDS = 10;
$("#shutter").addEventListener("click", async () => {
  if (!state.stream) {
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      video.srcObject = state.stream;
      await video.play();
      shutter.disabled = false;
      setTimerPill("Ready", false);
    } catch (err) {
      shutter.disabled = true;
      setTimerPill("No camera", true);
      alert("Camera access denied or unavailable.\n\n" + err.message);
      return;
    }
  }
  if (shutter.disabled || state.photos.length >= 4) return;
  shutter.disabled = true;
  const sec = state.timerSec;
  while (state.photos.length < 4) {
    if (state.photos.length > 0) {
      await showBigCountdown(sec, "Next shot in");
    } else {
      await showBigCountdown(sec, "Get ready");
    }
    takePhoto();
    refreshStrip();
  }
  shutter.disabled = false;
  hideBigTimer();
  setTimerPill("Done", false);
  await saveStripToDb();
});
function showBigCountdown(seconds, label) {
  return new Promise((resolve) => {
    bigTimer.classList.add("show");
    let remaining = seconds;
    bigTimer.textContent = remaining;
    setTimerPill(label + ": " + remaining + "s", true);
    const id = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(id);
        bigTimer.classList.remove("show");
        bigTimer.textContent = "";
        setTimerPill("Ready", false);
        resolve();
      } else {
        bigTimer.textContent = remaining;
        setTimerPill(label + ": " + remaining + "s", true);
      }
    }, 1000);
  });
}
function hideBigTimer() { bigTimer.classList.remove("show"); bigTimer.textContent = ""; }
function setTimerPill(text, live) { timerPill.textContent = text; timerPill.classList.toggle("live", !!live); }

function takePhoto() {
  flashEl.classList.remove("active");
  void flashEl.offsetWidth;
  flashEl.classList.add("active");
  try {
    const preset = FILTERS[state.activeFilter];
    let w = video.videoWidth || 640;
    let h = video.videoHeight || 480;
    if (w < 1 || h < 1) { w = 640; h = 480; }
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.translate(w, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
    applyFilterToPixels(ctx, w, h, preset);
    state.photos.push(canvas.toDataURL("image/jpeg", 0.92));
  } catch (err) {
    console.error("Filter failed:", err);
    alert("Filter error — " + err.message);
    const w = video.videoWidth || 640, h = video.videoHeight || 480;
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    const ctx = tmp.getContext("2d");
    ctx.translate(w, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    const preset = FILTERS[state.activeFilter];
    applyFilterToPixels(ctx, w, h, preset);
    state.photos.push(tmp.toDataURL("image/jpeg", 0.9));
  }
}

function applyFilterToPixels(ctx, w, h, p) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const src = new Float32Array(d.length);
  for (let i = 0; i < d.length; i++) src[i] = d[i];
  for (let i = 0; i < d.length; i += 4) {
    let r = src[i] / 255, g = src[i+1] / 255, b = src[i+2] / 255;
    const nlum = 0.3*r + 0.59*g + 0.11*b;
    r *= p.bright; g *= p.bright; b *= p.bright;
    r = (r - 0.5) * p.contrast + 0.5;
    g = (g - 0.5) * p.contrast + 0.5;
    b = (b - 0.5) * p.contrast + 0.5;
    r = nlum + p.sat * (r - nlum);
    g = nlum + p.sat * (g - nlum);
    b = nlum + p.sat * (b - nlum);
    if (p.hue !== 0) {
      const angle = p.hue * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const nr = r * (0.213 + cos*0.787 - sin*0.213) + g * (0.715 - cos*0.715 - sin*0.715) + b * (0.072 - cos*0.072 + sin*0.928);
      const ng = r * (0.213 - cos*0.213 + sin*0.143) + g * (0.715 + cos*0.285 + sin*0.140) + b * (0.072 - cos*0.072 - sin*0.283);
      const nb = r * (0.213 - cos*0.213 - sin*0.787) + g * (0.715 - cos*0.715 + sin*0.715) + b * (0.072 + cos*0.928 + sin*0.072);
      r = nr; g = ng; b = nb;
    }
    if (p.gray > 0) {
      const gray = 0.3*r + 0.59*g + 0.11*b;
      r += p.gray * (gray - r);
      g += p.gray * (gray - g);
      b += p.gray * (gray - b);
    }
    if (p.invert > 0) { r = 1-r; g = 1-g; b = 1-b; }
    if (p.sepia > 0) {
      const tr = Math.min(1, Math.max(0, r*(1-p.sepia) + (r*0.393+g*0.769+b*0.189)*p.sepia));
      const tg = Math.min(1, Math.max(0, g*(1-p.sepia) + (r*0.349+g*0.686+b*0.168)*p.sepia));
      const tb = Math.min(1, Math.max(0, b*(1-p.sepia) + (r*0.272+g*0.534+b*0.131)*p.sepia));
      r = tr; g = tg; b = tb;
    }
    d[i]   = Math.min(255, Math.max(0, r * 255));
    d[i+1] = Math.min(255, Math.max(0, g * 255));
    d[i+2] = Math.min(255, Math.max(0, b * 255));
  }
  ctx.putImageData(img, 0, 0);
  if (p.blur > 0) gaussianBlur(ctx, w, h, p.blur);
  if (p.grain && p.grain > 0) addGrain(ctx, w, h, p.grain);
}

function gaussianBlur(ctx, w, h, radius) {
  const tmp = document.createElement("canvas");
  tmp.width = w; tmp.height = h;
  const tmpCtx = tmp.getContext("2d");
  tmpCtx.filter = "blur(" + radius + "px)";
  tmpCtx.drawImage(ctx.canvas, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(tmp, 0, 0);
}

function addGrain(ctx, w, h, amount) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * amount * 255;
    data[i]   = Math.min(255, Math.max(0, data[i]   + noise));
    data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
    data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);
}

/* ============================================================
   STRIP REFRESH
   ============================================================ */
function refreshStrip() {
  $$(".strip-slot").forEach((s, i) => {
    s.classList.toggle("empty", !state.photos[i]);
    const hasImg = !!state.photos[i];
    const imgEl = s.querySelector("img");
    const numEl = s.querySelector(":scope > span:not(.sticker-delete)");
    if (hasImg && !imgEl) {
      s.innerHTML = '<img src="' + state.photos[i] + '" alt="shot ' + (i + 1) + '" /><div class="slot-stickers"></div>';
    } else if (!hasImg) {
      s.innerHTML = "<span>" + (i + 1) + "</span><div class=\"slot-stickers\"></div>";
    }
    renderSlotStickers(i);
  });
  applyFilmStyle(state.film);
  downloadBtn.disabled = state.photos.length === 0;
  downloadSingleBtn.disabled = state.photos.length === 0;
}


/* ============================================================
   DOWNLOAD
   ============================================================ */
downloadBtn.addEventListener("click", () => {
  if (!state.photos.length) return;
  const c = makeStripCanvas();
  c.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "fotomat-" + Date.now() + ".jpg"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/jpeg", 0.92);
});
downloadSingleBtn.addEventListener("click", () => {
  if (!state.photos.length) return;
  const a = document.createElement("a");
  a.href = state.photos[state.photos.length - 1];
  a.download = "fotomat-snap-" + Date.now() + ".jpg"; a.click();
});
resetStripBtn.addEventListener("click", () => {
  state.photos = [];
  state.stickers = [[], [], [], []];
  refreshStrip();
  shutter.disabled = false;
  setTimerPill("Ready", false);
});
function makeStripCanvas() {
  const w = 480, shotH = w * 3 / 4, h = shotH * 4 + 60;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  const f = FILM_STYLES[state.film] || FILM_STYLES.classic;
  ctx.fillStyle = f.frame.includes("gradient") ? "#e0e4ea" : f.frame;
  ctx.fillRect(0, 0, w, h);

  /* draw emoji background if present */
  if (f.emojiBg) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    const count = 40 + Math.floor(Math.random() * 20);
    for (let i = 0; i < count; i++) {
      const em = f.emojiBg[Math.floor(Math.random() * f.emojiBg.length)];
      const x = Math.random() * w;
      const y = Math.random() * h;
      const size = 16 + Math.floor(Math.random() * 14);
      ctx.font = size + "px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((Math.random() - 0.5) * 0.6);
      ctx.fillText(em, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  state.photos.forEach((src, i) => {
    const img = new Image(); img.src = src;
    const y = i * shotH;
    ctx.drawImage(img, 0, y, w, shotH);
    state.stickers[i].forEach((st) => {
      const sx = (st.x / 100) * w;
      const sy = y + (st.y / 100) * shotH;
      if (st.type === "image" && st.src) {
        const stickerImg = new Image();
        stickerImg.src = st.src;
        const sW = 60, sH = (stickerImg.naturalHeight / stickerImg.naturalWidth) * sW || 50;
        ctx.drawImage(stickerImg, sx - sW / 2, sy - sH / 2, sW, sH);
      } else {
        ctx.font = "28px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(st.emoji, sx, sy);
      }
    });
    ctx.strokeStyle = f.slotBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, y, w, shotH);
  });
  const footerY = shotH * 4 + 12;
  ctx.fillStyle = "#1e6dbf"; ctx.font = "bold 16px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FotoMat 2000 \u2014 " + formatDate(new Date()), w / 2, footerY + 14);
  ctx.fillStyle = "#4a5e76"; ctx.font = "11px 'Segoe UI', sans-serif";
  ctx.fillText("captured by " + (state.user?.username || "guest"), w / 2, footerY + 32);
  return c;
}

/* ============================================================
   SAVE STRIP TO SUPABASE
   ============================================================ */
async function saveStripToDb() {
  if (!state.user || state.photos.length !== 4) return;
  const filterName = FILTERS[state.activeFilter].name;
  const { error } = await sb.from("fotomat_strips").insert({
    user_id: state.user.id, username: state.user.username,
    filter_name: filterName,
    photo_1: state.photos[0], photo_2: state.photos[1],
    photo_3: state.photos[2], photo_4: state.photos[3]
  });
  if (error) console.warn("strip save failed:", error.message);
}

/* ============================================================
   UTIL
   ============================================================ */
function formatDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}


/* ============================================================
   STICKERS — drag & drop
   ============================================================ */
const STICKER_EMOJIS = [
  "\u2764\uFE0F", "\u2B50", "\u2728", "\uD83C\uDF89", "\uD83D\uDE0E",
  "\uD83D\uDD25", "\uD83C\uDF1F", "\uD83C\uDFAD", "\uD83D\uDC51", "\uD83D\uDC8E",
  "\uD83C\uDF08", "\uD83C\uDFB8", "\uD83C\uDFA8", "\uD83C\uDFB5", "\uD83C\uDF3A",
  "\uD83E\uDD8B", "\uD83C\uDF80", "\u2B50", "\uD83D\uDCAB", "\uD83D\uDC96"
];

const STICKER_IMAGES = [
  { file: "659080345_17884126899535655_6546928519517393912_n.png" },
  { file: "671840327_17884127115535655_385812773339957926_n.png" },
  { file: "672350594_17884127187535655_371724488335205445_n.png" },
  { file: "675348103_17884127124535655_5996297521590930211_n.png" },
  { file: "797596608_17907094689496248_8185925733102920979_n.png" },
  { file: "797596629_17907094728496248_6891190330387094743_n.png" },
  { file: "797991785_17907094776496248_1606891135962767612_n.png" },
  { file: "798115213_17907094608496248_8525871069148600826_n.png" },
  { file: "798245961_17907094317496248_1018965147158772015_n.png" },
  { file: "798432346_17907094338496248_4089780847253085097_n.png" },
  { file: "798432347_17907094710496248_5327990706809132554_n.png" },
  { file: "798432368_17907094671496248_2649935818652428654_n.png" },
  { file: "798537744_17907094626496248_472267872383870736_n.png" }
];

function buildStickerPalette() {
  const palette = $("#sticker-palette");
  palette.innerHTML = "";

  STICKER_EMOJIS.forEach((emoji) => {
    const el = document.createElement("div");
    el.className = "sticker-item sticker-emoji";
    el.textContent = emoji;
    el.draggable = true;
    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", JSON.stringify({ type: "emoji", emoji }));
      e.dataTransfer.effectAllowed = "copy";
    });
    palette.appendChild(el);
  });

  STICKER_IMAGES.forEach((img) => {
    const el = document.createElement("div");
    el.className = "sticker-item sticker-img-item";
    el.draggable = true;
    const thumb = document.createElement("img");
    thumb.src = img.thumb || ("stickers/thumbs/" + img.file);
    thumb.draggable = false;
    el.appendChild(thumb);
    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", JSON.stringify({ type: "image", src: img.src || ("stickers/resized/" + img.file) }));
      e.dataTransfer.effectAllowed = "copy";
    });
    palette.appendChild(el);
  });
}
function initStickerDrop() {
  $$(".strip-slot").forEach((slot) => {
    slot.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      slot.classList.add("drag-over");
    });
    slot.addEventListener("dragleave", () => {
      slot.classList.remove("drag-over");
    });
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      slot.classList.remove("drag-over");
      let raw;
      try { raw = JSON.parse(e.dataTransfer.getData("text/plain")); } catch { return; }
      if (!raw) return;
      const i = parseInt(slot.dataset.i);
      const rect = slot.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const cx = Math.max(5, Math.min(95, x));
      const cy = Math.max(5, Math.min(95, y));
      if (raw.type === "image") {
        state.stickers[i].push({ type: "image", src: raw.src, x: cx, y: cy });
      } else {
        state.stickers[i].push({ type: "emoji", emoji: raw.emoji, x: cx, y: cy });
      }
      renderSlotStickers(i);
    });
  });
}
function renderSlotStickers(i) {
  const slot = $$(".strip-slot")[i];
  if (!slot) return;
  const container = slot.querySelector(".slot-stickers");
  if (!container) return;
  container.innerHTML = "";
  state.stickers[i].forEach((st, si) => {
    const el = document.createElement("div");
    const isImg = st.type === "image";
    el.className = "slot-sticker" + (isImg ? " slot-sticker-img" : "");
    el.style.left = st.x + "%";
    el.style.top = st.y + "%";
    if (isImg) {
      const img = document.createElement("img");
      img.src = st.src;
      img.style.width = "40px";
      img.style.height = "auto";
      img.style.pointerEvents = "none";
      el.appendChild(img);
    } else {
      el.textContent = st.emoji;
    }
    const del = document.createElement("span");
    del.className = "sticker-delete";
    del.textContent = "\u2715";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      state.stickers[i].splice(si, 1);
      renderSlotStickers(i);
    });
    el.appendChild(del);
    container.appendChild(el);
  });
}
function renderAllStickers() {
  for (let i = 0; i < 4; i++) renderSlotStickers(i);
}

/* ============================================================
   TIMER OPTIONS
   ============================================================ */
function initTimerButtons() {
  $$(".timer-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".timer-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.timerSec = parseInt(btn.dataset.sec, 10);
    });
  });
}

/* ============================================================
   FILM SELECTION
   ============================================================ */
const FILM_STYLES = {
  /* ---- solid / gradient films ---- */
  classic:   { frame: "linear-gradient(180deg, #f0f2f6 0%, #e0e4ea 100%)", slot: "linear-gradient(180deg, #1a2030, #0f1824)", slotBorder: "#3a4656", footerBg: "#e0e4ea", footerBorder: "#8a96a4" },
  white:     { frame: "#fdfdfd", slot: "linear-gradient(180deg, #f8f8f8, #eee)", slotBorder: "#ccc", footerBg: "#f5f5f5", footerBorder: "#ddd" },
  pink:      { frame: "linear-gradient(180deg, #fce4ec 0%, #f8bbd0 100%)", slot: "linear-gradient(180deg, #f48fb1, #ec407a)", slotBorder: "#d81b60", footerBg: "#f8bbd0", footerBorder: "#f48fb1" },
  yellow:    { frame: "linear-gradient(180deg, #fff9c4 0%, #fff176 100%)", slot: "linear-gradient(180deg, #ffee58, #fdd835)", slotBorder: "#f9a825", footerBg: "#fff176", footerBorder: "#ffee58" },
  red:       { frame: "linear-gradient(180deg, #ffebee 0%, #ffcdd2 100%)", slot: "linear-gradient(180deg, #ef5350, #e53935)", slotBorder: "#c62828", footerBg: "#ffcdd2", footerBorder: "#ef9a9a" },
  blue:      { frame: "linear-gradient(180deg, #e3f2fd 0%, #bbdefb 100%)", slot: "linear-gradient(180deg, #42a5f5, #1e88e5)", slotBorder: "#1565c0", footerBg: "#bbdefb", footerBorder: "#90caf9" },
  purple:    { frame: "linear-gradient(180deg, #ede7f6 0%, #d1c4e9 100%)", slot: "linear-gradient(180deg, #7e57c2, #5e35b1)", slotBorder: "#4527a0", footerBg: "#d1c4e9", footerBorder: "#b39ddb" },
  mint:      { frame: "linear-gradient(180deg, #e0f2f1 0%, #b2dfdb 100%)", slot: "linear-gradient(180deg, #26a69a, #00897b)", slotBorder: "#00695c", footerBg: "#b2dfdb", footerBorder: "#80cbc4" },
  peach:     { frame: "linear-gradient(180deg, #fff3e0 0%, #ffe0b2 100%)", slot: "linear-gradient(180deg, #ffa726, #fb8c00)", slotBorder: "#ef6c00", footerBg: "#ffe0b2", footerBorder: "#ffcc80" },
  lavender:  { frame: "linear-gradient(180deg, #f3e5f5 0%, #e1bee7 100%)", slot: "linear-gradient(180deg, #ab47bc, #8e24aa)", slotBorder: "#6a1b9a", footerBg: "#e1bee7", footerBorder: "#ce93d8" },
  vintage:   { frame: "linear-gradient(180deg, #efebe9 0%, #d7ccc8 100%)", slot: "linear-gradient(180deg, #8d6e63, #6d4c41)", slotBorder: "#4e342e", footerBg: "#d7ccc8", footerBorder: "#bcaaa4" },
  galaxy:    { frame: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", slot: "linear-gradient(135deg, #4a148c, #1a237e, #0d47a1)", slotBorder: "#311b92", footerBg: "#1a1a2e", footerBorder: "#4a148c" },
  coral:     { frame: "linear-gradient(180deg, #fff1e6 0%, #ffccbc 50%, #ff8a80 100%)", slot: "linear-gradient(180deg, #ff7043, #e64a19)", slotBorder: "#bf360c", footerBg: "#ffccbc", footerBorder: "#ff8a80" },
  aurora:    { frame: "linear-gradient(135deg, #1b5e20 0%, #00bcd4 50%, #7c4dff 100%)", slot: "linear-gradient(135deg, #00e5ff, #69f0ae, #b388ff)", slotBorder: "#004d40", footerBg: "#004d40", footerBorder: "#00bcd4" },
  roseGold:  { frame: "linear-gradient(180deg, #fce4ec 0%, #f8bbd0 30%, #e8b4b8 60%, #d4a0a0 100%)", slot: "linear-gradient(180deg, #c48b9f, #a06070)", slotBorder: "#884050", footerBg: "#e8b4b8", footerBorder: "#c48b9f" },
  ocean:     { frame: "linear-gradient(180deg, #e0f7fa 0%, #80deea 30%, #26c6da 60%, #00acc1 100%)", slot: "linear-gradient(180deg, #00838f, #006064)", slotBorder: "#004d40", footerBg: "#80deea", footerBorder: "#4dd0e1" },
  cyberpunk: { frame: "linear-gradient(135deg, #ff00ff 0%, #0a0a2e 40%, #00ffff 100%)", slot: "linear-gradient(135deg, #ff00ff, #0d0d3b, #00ffff)", slotBorder: "#ff00ff", footerBg: "#0a0a2e", footerBorder: "#ff00ff" },
  cottonCandy:{ frame: "linear-gradient(180deg, #f8bbd0 0%, #e1bee7 30%, #b3e5fc 60%, #c8e6c9 100%)", slot: "linear-gradient(180deg, #f48fb1, #ba68c8, #4fc3f7)", slotBorder: "#ce93d8", footerBg: "#e1bee7", footerBorder: "#ce93d8" },
  emerald:   { frame: "linear-gradient(180deg, #e8f5e9 0%, #a5d6a7 50%, #66bb6a 100%)", slot: "linear-gradient(180deg, #2e7d32, #1b5e20)", slotBorder: "#0d3311", footerBg: "#a5d6a7", footerBorder: "#81c784" },
  midnight:  { frame: "linear-gradient(135deg, #0d0d2b 0%, #1a1a4e 30%, #2d1b69 60%, #0d0d2b 100%)", slot: "linear-gradient(135deg, #4a148c, #283593, #1a237e)", slotBorder: "#311b92", footerBg: "#1a1a4e", footerBorder: "#4a148c" },

  /* ---- emoji background films ---- */
  romance:   { frame: "linear-gradient(180deg, #fce4ec 0%, #f8bbd0 100%)", slot: "linear-gradient(180deg, #f48fb1, #ec407a)", slotBorder: "#d81b60", footerBg: "#fce4ec", footerBorder: "#f48fb1", emojiBg: ["\u2764\uFE0F","\uD83D\uDC95","\uD83D\uDC9C","\uD83D\uDC94","\uD83E\uDD0D"] },
  celebration:{ frame: "linear-gradient(180deg, #fff8e1 0%, #ffecb3 100%)", slot: "linear-gradient(180deg, #ffb300, #ff8f00)", slotBorder: "#ff6f00", footerBg: "#fff8e1", footerBorder: "#ffd54f", emojiBg: ["\uD83C\uDF89","\uD83C\uDF8A","\uD83C\uDF88","\uD83C\uDF81","\uD83C\uDF82"] },
  nature:    { frame: "linear-gradient(180deg, #e8f5e9 0%, #c8e6c9 100%)", slot: "linear-gradient(180deg, #66bb6a, #43a047)", slotBorder: "#2e7d32", footerBg: "#c8e6c9", footerBorder: "#a5d6a7", emojiBg: ["\uD83C\uDF3A","\uD83C\uDF3B","\uD83C\uDF38","\uD83C\uDF3C","\uD83E\uDD8B"] },
  cosmic:    { frame: "linear-gradient(135deg, #0d0d2b 0%, #1a1a4e 50%, #0d0d2b 100%)", slot: "linear-gradient(135deg, #283593, #1a237e)", slotBorder: "#0d47a1", footerBg: "#0d0d2b", footerBorder: "#311b92", emojiBg: ["\uD83C\uDF1F","\uD83C\uDF19","\uD83C\uDF0C","\u2B50","\uD83D\uDCAB"] },
  summer:    { frame: "linear-gradient(180deg, #fff9c4 0%, #81d4fa 50%, #4fc3f7 100%)", slot: "linear-gradient(180deg, #0288d1, #01579b)", slotBorder: "#01579b", footerBg: "#81d4fa", footerBorder: "#4fc3f7", emojiBg: ["\u2600\uFE0F","\uD83C\uDFD6\uFE0F","\uD83C\uDF0A","\uD83C\uDF34","\uD83C\uDF53"] },
  music:     { frame: "linear-gradient(180deg, #f3e5f5 0%, #e1bee7 100%)", slot: "linear-gradient(180deg, #ab47bc, #8e24aa)", slotBorder: "#6a1b9a", footerBg: "#f3e5f5", footerBorder: "#ce93d8", emojiBg: ["\uD83C\uDFB5","\uD83C\uDFB6","\uD83C\uDFB8","\uD83C\uDFB9","\uD83C\uDFBB"] },
  sweets:    { frame: "linear-gradient(180deg, #fce4ec 0%, #f3e5f5 30%, #e8eaf6 60%, #e0f2f1 100%)", slot: "linear-gradient(180deg, #f06292, #ba68c8, #7986cb)", slotBorder: "#9c27b0", footerBg: "#f3e5f5", footerBorder: "#ce93d8", emojiBg: ["\uD83C\uDF70","\uD83C\uDF6D","\uD83C\uDF6C","\uD83C\uDF6E","\uD83C\uDF71"] },
  space:     { frame: "linear-gradient(135deg, #000033 0%, #000066 30%, #000033 60%, #191970 100%)", slot: "linear-gradient(135deg, #1a237e, #0d47a1)", slotBorder: "#0d47a1", footerBg: "#000033", footerBorder: "#1a237e", emojiBg: ["\uD83D\uDE80","\uD83D\uDC0D","\uD83D\uDC0D","\uD83D\uDD2D","\u2604\uFE0F"] },
  emojiRain: { frame: "linear-gradient(180deg, #e3f2fd 0%, #bbdefb 100%)", slot: "linear-gradient(180deg, #42a5f5, #1e88e5)", slotBorder: "#1565c0", footerBg: "#e3f2fd", footerBorder: "#90caf9", emojiBg: ["\uD83D\uDE00","\uD83D\uDE02","\uD83E\uDD29","\uD83E\uDD70","\uD83D\uDE0E","\uD83C\uDF1F","\uD83D\uDC4D","\uD83D\uDD25"] }
};
/* generate a tiled emoji background pattern as a data URL */
function makeEmojiPattern(emojis, tileW, tileH, alpha) {
  const c = document.createElement("canvas");
  c.width = tileW; c.height = tileH;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, tileW, tileH);
  ctx.globalAlpha = alpha || 0.15;
  const count = 6 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const em = emojis[Math.floor(Math.random() * emojis.length)];
    const x = Math.random() * tileW;
    const y = Math.random() * tileH;
    const size = 14 + Math.floor(Math.random() * 12);
    ctx.font = size + "px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.random() - 0.5) * 0.6);
    ctx.fillText(em, 0, 0);
    ctx.restore();
  }
  return c.toDataURL();
}

function initFilmSelection() {
  $$(".film-swatch").forEach((sw) => {
    sw.addEventListener("click", () => {
      $$(".film-swatch").forEach((s) => s.classList.remove("active"));
      sw.classList.add("active");
      state.film = sw.dataset.film;
      applyFilmStyle(state.film);
    });
  });
  applyFilmStyle("classic");
}
function applyFilmStyle(filmKey) {
  const f = FILM_STYLES[filmKey] || FILM_STYLES.classic;
  const frame = $(".strip-frame");
  const footer = $(".strip-footer");
  frame.style.background = f.frame;
  frame.style.borderColor = f.slotBorder;
  footer.style.background = f.footerBg;
  footer.style.borderTop = "1px solid " + f.footerBorder;

  if (f.emojiBg) {
    const pat = makeEmojiPattern(f.emojiBg, 120, 120, 0.18);
    frame.style.backgroundImage = "url(" + pat + ")";
    frame.style.backgroundRepeat = "repeat";
  }

  $$(".strip-slot").forEach((slot) => {
    slot.style.background = f.slot;
    slot.style.borderColor = f.slotBorder;
    if (f.emojiBg) {
      const pat = makeEmojiPattern(f.emojiBg, 80, 80, 0.22);
      slot.style.backgroundImage = "url(" + pat + ")";
      slot.style.backgroundRepeat = "repeat";
    }
  });
}

/* ============================================================
   INIT
   ============================================================ */
(async () => {
  await resumeSessionFromStorage();
})();
buildFilters();
buildStickerPalette();
initStickerDrop();
initTimerButtons();
initFilmSelection();
stripDate.textContent = formatDate(new Date());
setTimerPill("Click Take 4 Shots to start", true);