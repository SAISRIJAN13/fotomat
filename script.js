/* ============================================================
   FotoMat 2000 — Custom auth (Supabase Postgres) + photobooth
   ============================================================ */

/* ---------- Supabase (data only, no auth.users) ---------- */
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
    keyMaterial,
    256
  );
  return { hash: bufToB64(bits), salt: bufToB64(salt) };
}

/* ---------- 20 filters ---------- */
const FILTERS = [
  { name: "Normal",    css: "none" },
  { name: "Glam",      css: "brightness(1.1) contrast(1.15) saturate(1.3)" },
  { name: "Grunge",    css: "grayscale(0.6) contrast(1.3) brightness(0.95)" },
  { name: "VHS",       css: "contrast(1.2) saturate(1.6) hue-rotate(-10deg)" },
  { name: "B&W",       css: "grayscale(1) contrast(1.1)" },
  { name: "Sepia",     css: "sepia(0.8) contrast(1.05) brightness(1.05)" },
  { name: "Cold",      css: "hue-rotate(180deg) saturate(1.2) brightness(1.05)" },
  { name: "Warm",      css: "hue-rotate(-30deg) saturate(1.4) brightness(1.05)" },
  { name: "Fade",      css: "contrast(0.85) saturate(0.7) brightness(1.15)" },
  { name: "Punch",     css: "contrast(1.4) saturate(1.5)" },
  { name: "Dreamy",    css: "blur(1.2px) brightness(1.15) saturate(1.3) contrast(0.95)" },
  { name: "Invert",    css: "invert(1) hue-rotate(180deg)" },
  { name: "Chrome",    css: "saturate(0.2) contrast(1.5) brightness(1.1)" },
  { name: "Neon",      css: "saturate(2.2) contrast(1.3) hue-rotate(15deg)" },
  { name: "Xmas",      css: "hue-rotate(90deg) saturate(1.5) brightness(1.05)" },
  { name: "Halloween", css: "hue-rotate(-90deg) saturate(1.4) contrast(1.2) brightness(0.9)" },
  { name: "Matrix",    css: "hue-rotate(90deg) saturate(3) contrast(1.4) brightness(0.85)" },
  { name: "Vintage",   css: "sepia(0.4) saturate(1.2) contrast(0.95) brightness(1.05)" },
  { name: "Xray",      css: "invert(1) grayscale(1) contrast(1.5)" },
  { name: "Pop",       css: "saturate(2) contrast(1.25) brightness(1.05)" }
];

/* ---------- state ---------- */
const state = {
  user: null,
  photos: [],
  activeFilter: 0,
  stream: null
};

/* ---------- DOM ---------- */
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
    const mode = t.dataset.mode;
    if (mode === "signin") switchTab("signin");
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

$$(".tab").forEach((t) =>
  t.addEventListener("click", () => switchTab(t.dataset.tab))
);

function setMsg(form, text, ok = false) {
  const m = form.querySelector(".form-msg");
  m.textContent = text;
  m.classList.toggle("ok", ok);
}

const SESSION_KEY = "fotomat_session_token";

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
}

$("#signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const username = fd.get("username").trim();
  const password = fd.get("password");

  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    setMsg(form, "Username must be 3-24 chars (letters, numbers, _).");
    return;
  }
  if (!password || password.length < 6) {
    setMsg(form, "Password must be at least 6 characters.");
    return;
  }

  setMsg(form, "Creating account…", true);
  try {
    const { data: existing } = await sb
      .from("fotomat_users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      setMsg(form, "Username already taken.");
      return;
    }

    const { hash, salt } = await hashPassword(password);
    const { data: created, error } = await sb
      .from("fotomat_users")
      .insert({
        username,
        password_hash: hash + ":" + salt
      })
      .select("id, username")
      .single();

    if (error) {
      setMsg(form, "Insert failed: " + error.message);
      console.error("signup insert error:", error);
      return;
    }
    if (!created) {
      setMsg(form, "Insert returned no row (RLS may be blocking).");
      return;
    }

    await createSession(created.id, created.username);
    setMsg(form, "Account created. Welcome.", true);
    setTimeout(() => enterBooth(created.username), 300);
  } catch (err) {
    setMsg(form, "Error: " + err.message);
    console.error(err);
  }
});

$("#signin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const username = fd.get("username").trim();
  const password = fd.get("password");

  setMsg(form, "Signing in…", true);
  try {
    const { data: row, error } = await sb
      .from("fotomat_users")
      .select("id, username, password_hash")
      .eq("username", username)
      .maybeSingle();

    if (error || !row) {
      setMsg(form, "Invalid username or password.");
      return;
    }

    const [storedHash, storedSalt] = (row.password_hash || "").split(":");
    const { hash } = await hashPassword(password, storedSalt);
    if (!storedHash || hash !== storedHash) {
      setMsg(form, "Invalid username or password.");
      return;
    }

    await createSession(row.id, row.username);
    setMsg(form, "Welcome back.", true);
    setTimeout(() => enterBooth(row.username), 300);
  } catch (err) {
    setMsg(form, "Error: " + err.message);
    console.error(err);
  }
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
  const { data: sess } = await sb
    .from("fotomat_sessions")
    .select("user_id, expires_at, fotomat_users(id, username)")
    .eq("token", token)
    .maybeSingle();
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
  state.user = null;
  state.photos = [];
  refreshStrip();
  stopCamera();
  showPage("landing");
});

function enterBooth(username) {
  welcomeUser.textContent = "Welcome, " + username;
  stripDate.textContent = formatDate(new Date());
  showPage("booth");
  startCamera();
}

/* ============================================================
   FILTERS
   ============================================================ */
function buildFilters() {
  filterGrid.innerHTML = "";
  FILTERS.forEach((f, i) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "filter-swatch";
    el.dataset.i = i;
    el.innerHTML = '<span class="label">' + f.name + "</span>";
    if (i === 0) el.classList.add("active");
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
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }
  video.srcObject = null;
}

$("#start-cam").addEventListener("click", () => startCamera());

/* ============================================================
   CAPTURE  — 4 shots with a visible 10-second timer between each
   ============================================================ */
const GAP_SECONDS = 10;

$("#shutter").addEventListener("click", async () => {
  if (!state.stream || shutter.disabled) return;
  if (state.photos.length >= 4) return;
  shutter.disabled = true;

  while (state.photos.length < 4) {
    await showBigCountdown(3, "Get ready");
    takePhoto();
    refreshStrip();
    if (state.photos.length < 4) {
      await showBigCountdown(GAP_SECONDS, "Next shot in");
    }
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

function hideBigTimer() {
  bigTimer.classList.remove("show");
  bigTimer.textContent = "";
}

function setTimerPill(text, live) {
  timerPill.textContent = text;
  timerPill.classList.toggle("live", !!live);
}

function takePhoto() {
  flashEl.classList.remove("active");
  void flashEl.offsetWidth;
  flashEl.classList.add("active");

  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  const filterCss = FILTERS[state.activeFilter].css;

  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext("2d");
  tctx.translate(w, 0);
  tctx.scale(-1, 1);
  tctx.drawImage(video, 0, 0, w, h);

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d");
  octx.filter = filterCss;
  octx.drawImage(tmp, 0, 0);

  const dataURL = out.toDataURL("image/jpeg", 0.9);
  state.photos.push(dataURL);
}

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
  state.photos = [];
  refreshStrip();
  hideBigTimer();
  setTimerPill("Ready", false);
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
    a.href = url;
    a.download = "fotomat-" + Date.now() + ".jpg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/jpeg", 0.92);
});

downloadSingleBtn.addEventListener("click", () => {
  if (!state.photos.length) return;
  const a = document.createElement("a");
  a.href = state.photos[state.photos.length - 1];
  a.download = "fotomat-snap-" + Date.now() + ".jpg";
  a.click();
});

function makeStripCanvas() {
  const w = 480;
  const shotH = w * 3 / 4;
  const h = shotH * 4 + 60;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  state.photos.forEach((src, i) => {
    const img = new Image();
    img.src = src;
    const y = i * shotH;
    ctx.drawImage(img, 0, y, w, shotH);
    ctx.strokeStyle = "#dddddd";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, y, w, shotH);
  });

  const footerY = shotH * 4 + 12;
  ctx.fillStyle = "#1e6dbf";
  ctx.font = "bold 16px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FotoMat 2000 — " + formatDate(new Date()), w / 2, footerY + 14);
  ctx.fillStyle = "#4a5e76";
  ctx.font = "11px 'Segoe UI', sans-serif";
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
    user_id: state.user.id,
    username: state.user.username,
    filter_name: filterName,
    photo_1: state.photos[0],
    photo_2: state.photos[1],
    photo_3: state.photos[2],
    photo_4: state.photos[3]
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