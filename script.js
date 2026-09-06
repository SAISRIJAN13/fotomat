/* ============================================================
   FotoMat 2000 — Custom auth + WebGL filter pipeline
   ============================================================ */

/* ---------- Supabase ---------- */
const SUPABASE_URL = "https://adjnzwcpwkiudqvavqgz.supabase.co";
const SUPABASE_KEY = "sb_publishable_eGJ1Ttm1DU3RZclfHOoWAQ_h_GtJmo2";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
   20 FILTERS + WebGL pipeline
   ============================================================ */
const FILTERS = [
  { name: "Normal",   filter: 0,  bright: 1.0,  contrast: 1.0,  sat: 1.0,  hue: 0,   gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Glam",     filter: 1,  bright: 1.1,  contrast: 1.0,  sat: 1.3,  hue: 0,   gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Grunge",   filter: 2,  bright: 0.95, contrast: 1.3,  sat: 1.0,  hue: 0,   gray: 0.6,invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "VHS",      filter: 3,  bright: 1.0,  contrast: 1.2,  sat: 1.6,  hue: -10, gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "B&W",      filter: 4,  bright: 1.1,  contrast: 1.1,  sat: 0,    hue: 0,   gray: 1,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Sepia",    filter: 5,  bright: 1.05, contrast: 1.05, sat: 1.0,  hue: 0,   gray: 0,  invert: 0, sepia: 0.8,blur: 0,  tint: [0.9,0.75,0.55] },
  { name: "Cold",     filter: 6,  bright: 1.05, contrast: 1.0,  sat: 1.2,  hue: 180, gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Warm",     filter: 7,  bright: 1.05, contrast: 1.0,  sat: 1.4,  hue: -30, gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Fade",     filter: 8,  bright: 1.15, contrast: 0.85, sat: 0.7,  hue: 0,   gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Punch",    filter: 9,  bright: 1.0,  contrast: 1.4,  sat: 1.5,  hue: 0,   gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Dreamy",   filter: 10, bright: 1.15, contrast: 1.0,  sat: 1.3,  hue: 0,   gray: 0,  invert: 0, sepia: 0,  blur: 1.2,tint: [0,0,0] },
  { name: "Invert",   filter: 11, bright: 1.0,  contrast: 1.0,  sat: 1.0,  hue: 0,   gray: 0,  invert: 1, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Chrome",   filter: 12, bright: 1.1,  contrast: 1.5,  sat: 0.2,  hue: 0,   gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Neon",     filter: 13, bright: 1.2,  contrast: 1.3,  sat: 2.2,  hue: 15,  gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Xmas",     filter: 14, bright: 1.05, contrast: 1.0,  sat: 1.5,  hue: 90,  gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Halloween",filter: 15, bright: 0.9,  contrast: 1.2,  sat: 1.4,  hue: -90, gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Matrix",   filter: 16, bright: 0.85, contrast: 1.4,  sat: 3.0,  hue: 90,  gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Vintage",  filter: 17, bright: 1.05, contrast: 0.95, sat: 1.2,  hue: 0,   gray: 0,  invert: 0, sepia: 0.4,blur: 0, tint: [0,0,0] },
  { name: "Xray",     filter: 18, bright: 1.0,  contrast: 1.5,  sat: 1.0,  hue: 0,   gray: 1,  invert: 1, sepia: 0,  blur: 0,  tint: [0,0,0] },
  { name: "Pop",      filter: 19, bright: 1.05, contrast: 1.25, sat: 2.0,  hue: 0,   gray: 0,  invert: 0, sepia: 0,  blur: 0,  tint: [0,0,0] }
];

const VERT_SRC = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`;

const FRAG_SRC = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform int uFilter;
  uniform float uBright;
  uniform float uContrast;
  uniform float uSat;
  uniform float uHue;
  uniform float uGray;
  uniform float uInvert;
  uniform float uSepia;
  uniform float uBlur;
  uniform vec3 uTint;

  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    vec4 col = texture2D(uTex, vUv);
    if (uInvert > 0.5) col.rgb = 1.0 - col.rgb;
    col.rgb = vec3(mix(col.rgb, vec3(dot(col.rgb, vec3(0.3))), uGray));
    col.rgb = col.rgb * (0.3 + 0.7 * uSepia) + uTint * uSepia;
    col.rgb *= uBright;
    col.rgb = (col.rgb - 0.5) * uContrast + 0.5;
    col.rgb *= uSat;
    float h = (hsv2rgb(col.rgb).x + uHue / 360.0);
    h = fract(h);
    col.rgb = hsv2rgb(vec3(h, col.rgb.y, col.rgb.z));
    if (uFilter == 1)       col.rgb *= 1.1;
    else if (uFilter == 2)  col.rgb = (col.rgb - 0.5) * 1.3 + 0.5; col.rgb *= 0.95;
    else if (uFilter == 4)  col.rgb += vec3(0.0, 0.05, 0.1);
    else if (uFilter == 5)  col.rgb += vec3(0.1, 0.03, 0.0);
    else if (uFilter == 6)  col.rgb = mix(col.rgb, vec3(0.9), 0.3);
    else if (uFilter == 7)  col.rgb = pow(col.rgb, vec3(0.85));
    else if (uFilter == 10) col.rgb *= 1.15;
    else if (uFilter == 11) { float lum = dot(col.rgb, vec3(0.3)); col.rgb = mix(col.rgb, vec3(lum), 0.5); }
    else if (uFilter == 12) col.rgb = pow(col.rgb, vec3(0.45)); col.rgb = clamp(col.rgb * 1.2, 0.0, 1.0);
    else if (uFilter == 13) { col.rgb.r *= 0.7; col.rgb.g *= 1.2; col.rgb.b *= 0.3; }
    else if (uFilter == 14) { col.rgb.r *= 1.3; col.rgb.g *= 0.8; col.rgb.b *= 0.2; }
    else if (uFilter == 15) { col.rgb.r *= 0.3; col.rgb.g *= 1.3; col.rgb.b *= 0.2; }
    else if (uFilter == 16) col.rgb = mix(col.rgb, vec3(0.8,0.75,0.6), 0.2);
    else if (uFilter == 17) { col.rgb = 1.0 - col.rgb; col.rgb = vec3(dot(col.rgb, vec3(0.3))); }
    else if (uFilter == 18) col.rgb = pow(col.rgb, vec3(0.8));
    gl_FragColor = vec4(col.rgb, 1.0);
  }`;

let gl = null, program = null, buf = null, tex = null;

function initWebGL(w, h) {
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  gl = off.getContext("webgl", { preserveDrawingBuffer: true, alpha: false });
  if (!gl) return false;
  gl.viewport(0, 0, w, h);
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, VERT_SRC);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) { console.error("vs", gl.getShaderInfoLog(vs)); return false; }
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, FRAG_SRC);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) { console.error("fs", gl.getShaderInfoLog(fs)); return false; }
  program = gl.createProgram();
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.error("link", gl.getProgramInfoLog(program)); return false; }
  gl.useProgram(program);
  buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return true;
}

function renderFilter(video, preset) {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  if (!gl || !program) initWebGL(w, h);
  gl.viewport(0, 0, w, h);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  const L = (n) => gl.getUniformLocation(program, n);
  gl.uniform1i(L("uTex"), 0);
  gl.uniform1i(L("uFilter"), preset.filter);
  gl.uniform1f(L("uBright"), preset.bright);
  gl.uniform1f(L("uContrast"), preset.contrast);
  gl.uniform1f(L("uSat"), preset.sat);
  gl.uniform1f(L("uHue"), preset.hue);
  gl.uniform1f(L("uGray"), preset.gray);
  gl.uniform1f(L("uInvert"), preset.invert);
  gl.uniform1f(L("uSepia"), preset.sepia);
  gl.uniform1f(L("uBlur"), preset.blur);
  gl.uniform3fv(L("uTint"), new Float32Array(preset.tint));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return gl.canvas.toDataURL("image/jpeg", 0.92);
}

/* ============================================================
   State & DOM
   ============================================================ */
const state = { user: null, photos: [], activeFilter: 0, stream: null };
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
}
$("#start-cam").addEventListener("click", () => startCamera());

/* ============================================================
   CAPTURE — 4 shots, each with a 10s countdown
   ============================================================ */
const GAP_SECONDS = 10;
$("#shutter").addEventListener("click", async () => {
  if (!state.stream || shutter.disabled) return;
  if (state.photos.length >= 4) return;
  shutter.disabled = true;
  while (state.photos.length < 4) {
    if (state.photos.length > 0) {
      await showBigCountdown(GAP_SECONDS, "Next shot in");
    } else {
      await showBigCountdown(GAP_SECONDS, "Get ready");
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
    const dataURL = renderFilter(video, preset);
    state.photos.push(dataURL);
  } catch (err) {
    console.error("WebGL filter failed:", err);
    alert("Filter error — " + err.message);
    const w = video.videoWidth || 640, h = video.videoHeight || 480;
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    const ctx = tmp.getContext("2d");
    ctx.translate(w, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    state.photos.push(tmp.toDataURL("image/jpeg", 0.9));
  }
}

/* ============================================================
   STRIP REFRESH
   ============================================================ */
function refreshStrip() {
  $$(".strip-slot").forEach((s, i) => {
    s.classList.toggle("empty", !state.photos[i]);
    s.innerHTML = state.photos[i]
      ? '<img src="' + state.photos[i] + '" alt="shot ' + (i + 1) + '" />'
      : "<span>" + (i + 1) + "</span>";
  });
  downloadBtn.disabled = state.photos.length === 0;
  downloadSingleBtn.disabled = state.photos.length === 0;
}
$("#reset").addEventListener("click", () => {
  if (state.photos.length === 0) return;
  if (!confirm("Clear all shots?")) return;
  state.photos = []; refreshStrip(); hideBigTimer(); setTimerPill("Ready", false);
});

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
function makeStripCanvas() {
  const w = 480, shotH = w * 3 / 4, h = shotH * 4 + 60;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
  state.photos.forEach((src, i) => {
    const img = new Image(); img.src = src;
    const y = i * shotH;
    ctx.drawImage(img, 0, y, w, shotH);
    ctx.strokeStyle = "#dddddd"; ctx.lineWidth = 1;
    ctx.strokeRect(0, y, w, shotH);
  });
  const footerY = shotH * 4 + 12;
  ctx.fillStyle = "#1e6dbf"; ctx.font = "bold 16px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FotoMat 2000 — " + formatDate(new Date()), w / 2, footerY + 14);
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
   INIT
   ============================================================ */
(async () => {
  await resumeSessionFromStorage();
})();
buildFilters();
stripDate.textContent = formatDate(new Date());
