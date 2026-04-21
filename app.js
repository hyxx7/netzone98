/* =====================================================
   NETZONE 98 — APP.JS
   Full client-side app with localStorage persistence
   ===================================================== */

"use strict";

/* ─────────────────────────────────────────────────────
   STORAGE HELPERS
   ───────────────────────────────────────────────────── */
const DB = {
  get(key) {
    try { return JSON.parse(localStorage.getItem("nz98_" + key)); }
    catch { return null; }
  },
  set(key, val) {
    localStorage.setItem("nz98_" + key, JSON.stringify(val));
  },
  del(key) { localStorage.removeItem("nz98_" + key); },

  getUsers()     { return DB.get("users")    || {}; },
  setUsers(u)    { DB.set("users", u); },
  getPosts()     { return DB.get("posts")    || {}; },
  setPosts(p)    { DB.set("posts", p); },
  getChat()      { return DB.get("chat")     || { rooms: { General: [], Tech: [], Gaming: [], Music: [] }, custom: [] }; },
  setChat(c)     { DB.set("chat", c); },
  getGuestbooks(){ return DB.get("guestbooks") || {}; },
  setGuestbooks(g){ DB.set("guestbooks", g); },
  getStats()     { return DB.get("stats")    || { visitors: 1337, visits: {} }; },
  setStats(s)    { DB.set("stats", s); }
};

/* ─────────────────────────────────────────────────────
   APP STATE
   ───────────────────────────────────────────────────── */
let currentUser   = null;   // username string
let currentRoom   = null;   // chat room name
let viewingUser   = null;   // username being viewed
let chatPollTimer = null;
let clockTimer    = null;
let openWindows   = {};     // appid → dom element
let windowZIndex  = 200;
let gameState     = null;
let gameLoop      = null;

/* ─────────────────────────────────────────────────────
   BOOT SEQUENCE
   ───────────────────────────────────────────────────── */
const bootMessages = [
  "Loading system files...",
  "Initializing NetZone kernel...",
  "Mounting user database...",
  "Starting social engine...",
  "Calibrating 56k modem... (just kidding, we use DSL now)",
  "Applying GeoCities patch...",
  "Almost ready — preparing your cyberspace...",
  "Welcome to NetZone 98!",
];

window.addEventListener("DOMContentLoaded", () => {
  const bar    = document.getElementById("boot-bar");
  const status = document.getElementById("boot-status");
  let step = 0;

  function tick() {
    if (step >= bootMessages.length) {
      setTimeout(showAuthOrDesktop, 400);
      return;
    }
    const pct = Math.round(((step + 1) / bootMessages.length) * 100);
    bar.style.width = pct + "%";
    status.textContent = bootMessages[step];
    step++;
    setTimeout(tick, 350 + Math.random() * 200);
  }

  // Seed visitor count
  const stats = DB.getStats();
  stats.visitors = (stats.visitors || 1337) + 1;
  DB.setStats(stats);
  document.getElementById("visitor-count").textContent = stats.visitors;

  tick();
});

function showAuthOrDesktop() {
  document.getElementById("boot-screen").style.display = "none";

  // Restore logged-in session
  const saved = sessionStorage.getItem("nz98_session");
  if (saved) {
    currentUser = saved;
    const users = DB.getUsers();
    if (users[currentUser]) {
      showDesktop();
      return;
    }
  }
  document.getElementById("auth-screen").classList.remove("hidden");
}

/* ─────────────────────────────────────────────────────
   AUTH
   ───────────────────────────────────────────────────── */
function switchAuthTab(tab) {
  document.getElementById("login-form").classList.toggle("hidden",    tab !== "login");
  document.getElementById("register-form").classList.toggle("hidden", tab !== "register");
  document.getElementById("tab-login").classList.toggle("active",     tab === "login");
  document.getElementById("tab-register").classList.toggle("active",  tab === "register");
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
}

function handleLogin() {
  const username = document.getElementById("login-user").value.trim();
  const password = document.getElementById("login-pass").value;

  if (!username || !password) return showError("login-error", "Please fill in all fields.");

  const users = DB.getUsers();
  if (!users[username])        return showError("login-error", "Username not found.");
  if (users[username].password !== btoa(password)) return showError("login-error", "Wrong password.");

  currentUser = username;
  sessionStorage.setItem("nz98_session", username);
  recordVisit(username);
  showDesktop();
}

function handleGuestLogin() {
  currentUser = "Guest_" + Math.floor(Math.random() * 9000 + 1000);
  const users = DB.getUsers();
  users[currentUser] = {
    password: "",
    email: "",
    vibe: "random",
    profile: {
      displayName: currentUser,
      bio: "Just visiting!",
      avatar: "",
      location: "The Web",
      mood: "👀 lurking",
      bgColor: "#d4d0c8",
      textColor: "#000000",
      layout: "classic",
      font: "'Tahoma', sans-serif",
      bgImage: "",
      music: "",
      song: "",
      friends: [],
      blinkText: false,
      marqueeText: false,
      vhsMode: false,
      glitchMode: false,
      customCursor: false,
      customCss: "",
    },
    joined: Date.now(),
    isGuest: true,
  };
  DB.setUsers(users);
  sessionStorage.setItem("nz98_session", currentUser);
  showDesktop();
}

function handleRegister() {
  const username = document.getElementById("reg-user").value.trim();
  const password = document.getElementById("reg-pass").value;
  const email    = document.getElementById("reg-email").value.trim();
  const vibe     = document.getElementById("reg-vibe").value;

  if (!username || !password || !email) return showError("register-error", "Please fill in all fields.");
  if (username.length < 3)              return showError("register-error", "Username must be at least 3 characters.");
  if (password.length < 4)              return showError("register-error", "Password must be at least 4 characters.");
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return showError("register-error", "Username: letters, numbers, underscores only.");

  const users = DB.getUsers();
  if (users[username]) return showError("register-error", "Username already taken!");

  users[username] = {
    password: btoa(password),
    email,
    vibe,
    profile: {
      displayName: username,
      bio: "Hi, I just joined NetZone 98! 🎉",
      avatar: "",
      location: "Cyberspace",
      mood: "😎 just arrived",
      bgColor: "#000080",
      textColor: "#ffff00",
      layout: "classic",
      font: "'Courier New', monospace",
      bgImage: "",
      music: "",
      song: "🎵 Loading awesome music...",
      friends: [],
      blinkText: false,
      marqueeText: false,
      vhsMode: false,
      glitchMode: false,
      customCursor: false,
      customCss: "",
    },
    joined: Date.now(),
    isGuest: false,
  };
  DB.setUsers(users);

  // Award "Newbie" badge
  awardBadge(username, "newbie");

  currentUser = username;
  sessionStorage.setItem("nz98_session", username);
  showDesktop();
}

function handleLogout() {
  currentUser = null;
  sessionStorage.removeItem("nz98_session");
  clearInterval(chatPollTimer);
  clearInterval(clockTimer);
  if (gameLoop) cancelAnimationFrame(gameLoop);
  openWindows = {};
  document.getElementById("window-layer").innerHTML = "";
  document.getElementById("taskbar-windows").innerHTML = "";
  document.getElementById("desktop").classList.add("hidden");
  document.getElementById("auth-screen").classList.remove("hidden");
  toggleStartMenu(true);
}

/* ─────────────────────────────────────────────────────
   DESKTOP
   ───────────────────────────────────────────────────── */
function showDesktop() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("desktop").classList.remove("hidden");

  updateTrayUser();
  startClock();

  // Apply desktop BG setting
  const settings = DB.get("settings_" + currentUser) || {};
  if (settings.bg) applyDesktopBgValue(settings.bg);

  // VHS / glitch from profile
  const users = DB.getUsers();
  const p = users[currentUser]?.profile || {};
  if (p.vhsMode)   enableVHS(true);
  if (p.glitchMode) enableGlitch(true);
  if (p.customCursor) document.body.classList.add("custom-cursor");

  notify("👋 Welcome back, " + (p.displayName || currentUser) + "!");
}

function updateTrayUser() {
  const users = DB.getUsers();
  const p = users[currentUser]?.profile || {};
  document.getElementById("tray-user-info").textContent =
    "👤 " + (p.displayName || currentUser);
  document.getElementById("start-username").textContent = p.displayName || currentUser;
}

function startClock() {
  function tick() {
    const now = new Date();
    document.getElementById("tray-clock").textContent =
      now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  tick();
  clockTimer = setInterval(tick, 10000);
}

/* ─────────────────────────────────────────────────────
   START MENU
   ───────────────────────────────────────────────────── */
function toggleStartMenu(forceClose) {
  const menu = document.getElementById("start-menu");
  if (forceClose) { menu.classList.add("hidden"); return; }
  menu.classList.toggle("hidden");
}

document.addEventListener("click", (e) => {
  if (!e.target.closest("#start-menu") && !e.target.closest("#start-btn")) {
    document.getElementById("start-menu").classList.add("hidden");
  }
});

/* ─────────────────────────────────────────────────────
   WINDOW MANAGEMENT
   ───────────────────────────────────────────────────── */
function openApp(appId) {
  if (openWindows[appId]) {
    // Bring to front
    const win = openWindows[appId];
    win.style.display = "flex";
    win.style.zIndex = ++windowZIndex;
    updateTaskbar();
    return;
  }

  const tpl = document.getElementById("tpl-" + appId);
  if (!tpl) return;

  const win = tpl.content.cloneNode(true).firstElementChild;
  const layer = document.getElementById("window-layer");

  // Position with slight cascade
  const offset = Object.keys(openWindows).length * 20;
  win.style.left = (80 + offset) + "px";
  win.style.top  = (40 + offset) + "px";
  win.style.zIndex = ++windowZIndex;
  win.style.display = "flex";
  win.style.flexDirection = "column";

  layer.appendChild(win);
  openWindows[appId] = win;

  makeDraggable(win);
  updateTaskbar();

  // Initialize app content
  switch (appId) {
    case "profile":   initProfile();    break;
    case "explore":   initExplore();    break;
    case "chat":      initChat();       break;
    case "guestbook": initGuestbook();  break;
    case "games":     initGames();      break;
    case "badges":    initBadges();     break;
    case "settings":  initSettings();   break;
  }
}

function closeWindow(appId) {
  const win = openWindows[appId];
  if (win) {
    win.remove();
    delete openWindows[appId];
  }
  if (appId === "chat" && chatPollTimer) {
    clearInterval(chatPollTimer);
    chatPollTimer = null;
  }
  if ((appId === "games") && gameLoop) {
    cancelAnimationFrame(gameLoop);
    gameLoop = null;
  }
  updateTaskbar();
}

function minimizeWindow(appId) {
  const win = openWindows[appId];
  if (win) win.style.display = "none";
  updateTaskbar();
}

function updateTaskbar() {
  const bar = document.getElementById("taskbar-windows");
  bar.innerHTML = "";
  for (const [id, win] of Object.entries(openWindows)) {
    const titleEl = win.querySelector(".window-title");
    const title   = titleEl ? titleEl.textContent : id;
    const btn = document.createElement("button");
    btn.className = "taskbar-btn" + (win.style.display !== "none" ? " active" : "");
    btn.textContent = title;
    btn.onclick = () => {
      if (win.style.display === "none") {
        win.style.display = "flex";
        win.style.zIndex = ++windowZIndex;
      } else {
        win.style.display = "none";
      }
      updateTaskbar();
    };
    bar.appendChild(btn);
  }
}

function bringToFront(appId) {
  const win = openWindows[appId];
  if (win) win.style.zIndex = ++windowZIndex;
}

/* ─────────────────────────────────────────────────────
   DRAGGING
   ───────────────────────────────────────────────────── */
function makeDraggable(win) {
  const titlebar = win.querySelector(".window-titlebar");
  if (!titlebar) return;

  let startX, startY, startLeft, startTop;
  let dragging = false;

  titlebar.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("win-btn")) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = win.getBoundingClientRect();
    startLeft = parseInt(win.style.left) || rect.left;
    startTop  = parseInt(win.style.top)  || rect.top;
    win.style.zIndex = ++windowZIndex;
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    win.style.left = (startLeft + e.clientX - startX) + "px";
    win.style.top  = Math.max(0, startTop  + e.clientY - startY) + "px";
  });

  document.addEventListener("mouseup", () => { dragging = false; });

  win.addEventListener("mousedown", () => {
    win.style.zIndex = ++windowZIndex;
  });
}

/* ─────────────────────────────────────────────────────
   PROFILE APP
   ───────────────────────────────────────────────────── */
function initProfile() {
  renderProfilePreview();
  loadProfileEdit();
  loadCustomization();
  loadMyPosts();
}

function switchProfileTab(tab, el) {
  ["view", "edit", "customize", "posts"].forEach(t => {
    document.getElementById("profile-tab-" + t)?.classList.toggle("hidden", t !== tab);
  });
  document.querySelectorAll("#win-profile .tab").forEach(t => t.classList.remove("active"));
  if (el) el.classList.add("active");

  if (tab === "view") renderProfilePreview();
  if (tab === "posts") loadMyPosts();
}

function getUserProfile() {
  return DB.getUsers()[currentUser]?.profile || {};
}

function renderProfilePreview() {
  const area = document.getElementById("profile-preview-area");
  if (!area) return;
  const users = DB.getUsers();
  const user  = users[currentUser];
  if (!user) return;
  area.innerHTML = buildProfileHTML(currentUser, user, true);
  applyCSSEffects(user.profile, area);
}

function buildProfileHTML(username, user, isOwn) {
  const p = user.profile || {};
  const layout = p.layout || "classic";

  if (layout === "terminal") return buildTerminalLayout(username, user);
  if (layout === "room")     return buildRoomLayout(username, user);
  return buildClassicLayout(username, user, isOwn);
}

function buildClassicLayout(username, user, isOwn) {
  const p = user.profile || {};
  const stats = DB.getStats();
  const visits = stats.visits?.[username] || 0;

  const friends = (p.friends || []).map(f =>
    `<span class="friend-chip" onclick="viewUserProfile('${f}')">${f}</span>`
  ).join("");

  const avatarContent = p.avatar
    ? `<img src="${p.avatar}" alt="avatar" style="width:80px;height:80px;object-fit:cover;" onerror="this.style.display='none'" />`
    : "👤";

  const marqueeEl = p.marqueeText
    ? `<marquee behavior="scroll" direction="left" scrollamount="2" style="color:${p.textColor || "#fff"}; font-family:VT323,monospace; font-size:18px;">
        ★ Welcome to ${p.displayName || username}'s page! ★ &nbsp;&nbsp; ${p.bio || ""} &nbsp;&nbsp; ★
       </marquee>`
    : "";

  const blinkStyle = p.blinkText ? "animation: blink 0.8s step-end infinite;" : "";

  let html = `
    <div style="
      background-color: ${p.bgColor || "#000080"};
      color: ${p.textColor || "#ffff00"};
      font-family: ${p.font || "'Courier New', monospace"};
      padding: 10px;
      min-height: 280px;
      ${p.bgImage ? `background-image: url('${p.bgImage}'); background-repeat: tile;` : ""}
    ">
      ${marqueeEl}
      <div class="profile-header-row">
        <div class="profile-avatar">${avatarContent}</div>
        <div style="flex:1;">
          <div class="profile-name" style="color:${p.textColor || "#ffff00"}; ${blinkStyle}">
            ${p.displayName || username}
          </div>
          <div class="profile-mood">Mood: ${p.mood || "🤔 unknown"}</div>
          <div class="profile-location">📍 ${p.location || "Unknown"}</div>
          <div style="margin-top:4px;">
            <span class="retro-badge blue">${user.vibe || "random"}</span>
          </div>
        </div>
        <div>
          <div class="profile-visitor">Visitor #<span class="hit-counter">${String(visits).padStart(6, "0")}</span></div>
          <div style="font-size:10px; margin-top:2px; text-align:right; color:${p.textColor || "#ffff00"};">
            Joined: ${new Date(user.joined || Date.now()).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div class="profile-section-header">✦ About Me</div>
      <div class="profile-bio-box">${p.bio || "(no bio yet)"}</div>

      ${p.song ? `<div class="profile-song">♪ Now playing: ${p.song}</div>` : ""}

      ${friends ? `
        <div class="profile-section-header">★ Top Friends</div>
        <div class="profile-top-friends">${friends}</div>
      ` : ""}

      <div class="profile-section-header">🏅 Badges</div>
      <div class="profile-badges-row" id="inline-badges-${username}"></div>

      <div style="margin-top:8px; font-size:10px; text-align:center; color:${p.textColor || "#ffff00"}; opacity:0.6;">
        ⚠️ This page best viewed in NetZone 98 at 800×600 resolution ⚠️
      </div>

      ${p.music ? `<audio id="profile-audio" src="${p.music}" autoplay loop style="display:none;"></audio>` : ""}
    </div>
  `;

  // Inject badges after render
  setTimeout(() => {
    const el = document.getElementById("inline-badges-" + username);
    if (el) el.innerHTML = getBadgesHTML(username);
  }, 50);

  return html;
}

function buildTerminalLayout(username, user) {
  const p = user.profile || {};
  const joined = new Date(user.joined || Date.now()).toLocaleDateString();
  return `
    <div class="profile-terminal" id="terminal-${username}">
      <div class="terminal-line">NetZone Terminal v2.0 — Connected.</div>
      <div class="terminal-line">─────────────────────────────────────</div>
      <div class="terminal-line">USER: <span style="color:#fff">${p.displayName || username}</span></div>
      <div class="terminal-line">VIBE: <span style="color:#fff">${user.vibe || "unknown"}</span></div>
      <div class="terminal-line">LOC:  <span style="color:#fff">${p.location || "unknown"}</span></div>
      <div class="terminal-line">MOOD: <span style="color:#fff">${p.mood || "unknown"}</span></div>
      <div class="terminal-line">JOIN: <span style="color:#fff">${joined}</span></div>
      <div class="terminal-line">─────────────────────────────────────</div>
      <div class="terminal-line">BIO:  <span style="color:#88ff88">${p.bio || "N/A"}</span></div>
      <div class="terminal-line">─────────────────────────────────────</div>
      <div class="terminal-line" style="color:#aaa;">Type a command below:</div>
      <div class="terminal-line">
        <span style="color:#00ff44;">root@netzone:~$</span>
        <input class="terminal-cmd-input" id="term-input-${username}"
          placeholder="view posts / open gallery / help"
          onkeydown="handleTerminalCmd(event,'${username}')" />
      </div>
      <div id="term-output-${username}" style="margin-top:8px;"></div>
    </div>
  `;
}

function buildRoomLayout(username, user) {
  const p = user.profile || {};
  const objects = ["🖥️", "🛋️", "🎵", "📻", "🖼️", "🌱", "🐱", "🎮", "📚", "🪴"];
  const placed  = objects.slice(0, 7).map((obj, i) => {
    const x = 20 + (i % 4) * 100;
    const y = 30 + Math.floor(i / 4) * 100;
    return `<div class="room-object" style="left:${x}px; top:${y}px;" title="${obj}">${obj}</div>`;
  }).join("");

  return `
    <div class="profile-room">
      <div class="room-wall"></div>
      ${placed}
      <div class="room-name-plate">${p.displayName || username}'s Room</div>
      <div class="room-floor"></div>
    </div>
  `;
}

function handleTerminalCmd(e, username) {
  if (e.key !== "Enter") return;
  const input = document.getElementById("term-input-" + username);
  const output = document.getElementById("term-output-" + username);
  const cmd = input.value.trim().toLowerCase();
  input.value = "";

  const responses = {
    "help":         "Commands: view posts, open gallery, show bio, show friends, clear",
    "view posts":   getTerminalPosts(username),
    "open gallery": "[ Gallery not found — upload images in Edit Profile ]",
    "show bio":     (DB.getUsers()[username]?.profile?.bio || "No bio set."),
    "show friends": (DB.getUsers()[username]?.profile?.friends?.join(", ") || "No friends listed."),
    "clear":        "__CLEAR__",
  };

  if (cmd === "clear") { output.innerHTML = ""; return; }

  const result = responses[cmd] || `Command not found: ${cmd}. Type 'help' for commands.`;
  output.innerHTML += `<div style="color:#ffff44;">$ ${cmd}</div>`;
  output.innerHTML += `<div style="color:#aaffaa; margin-bottom:4px;">${result}</div>`;
  output.scrollTop = output.scrollHeight;
}

function getTerminalPosts(username) {
  const posts = DB.getPosts()[username] || [];
  if (!posts.length) return "No posts found.";
  return posts.slice(-3).map((p, i) =>
    `[${i + 1}] ${new Date(p.ts).toLocaleDateString()} — ${p.content.substring(0, 60)}...`
  ).join("<br/>");
}

function applyCSSEffects(p, container) {
  if (!p || !container) return;
  if (p.customCss) {
    let style = container.querySelector(".custom-css-inject");
    if (!style) {
      style = document.createElement("style");
      style.className = "custom-css-inject";
      container.appendChild(style);
    }
    style.textContent = p.customCss;
  }
}

function loadProfileEdit() {
  const p = getUserProfile();
  setValue("edit-displayname", p.displayName || "");
  setValue("edit-avatar",      p.avatar      || "");
  setValue("edit-bio",         p.bio         || "");
  setValue("edit-location",    p.location    || "");
  setValue("edit-mood",        p.mood        || "");
  setValue("edit-music",       p.music       || "");
  setValue("edit-song",        p.song        || "");
  setValue("edit-friends",     (p.friends || []).join(", "));
}

function loadCustomization() {
  const p = getUserProfile();
  setValue("cust-layout",    p.layout    || "classic");
  setValue("cust-bgcolor",   p.bgColor   || "#000080");
  setValue("cust-textcolor", p.textColor || "#ffff00");
  setValue("cust-bgimage",   p.bgImage   || "");
  setValue("cust-font",      p.font      || "'Courier New', monospace");
  setValue("cust-css",       p.customCss || "");
  setChecked("cust-blink",   p.blinkText   || false);
  setChecked("cust-marquee", p.marqueeText || false);
  setChecked("cust-vhs",     p.vhsMode     || false);
  setChecked("cust-glitch",  p.glitchMode  || false);
  setChecked("cust-cursor",  p.customCursor || false);
}

function saveProfile() {
  const users = DB.getUsers();
  const p = users[currentUser].profile;

  p.displayName = document.getElementById("edit-displayname").value.trim() || currentUser;
  p.avatar      = document.getElementById("edit-avatar").value.trim();
  p.bio         = document.getElementById("edit-bio").value.trim();
  p.location    = document.getElementById("edit-location").value.trim();
  p.mood        = document.getElementById("edit-mood").value.trim();
  p.music       = document.getElementById("edit-music").value.trim();
  p.song        = document.getElementById("edit-song").value.trim();
  p.friends     = document.getElementById("edit-friends").value.split(",").map(s => s.trim()).filter(Boolean);

  DB.setUsers(users);
  updateTrayUser();
  notify("✅ Profile saved!");
  awardBadge(currentUser, "customizer");
}

function saveCustomization() {
  const users = DB.getUsers();
  const p = users[currentUser].profile;

  p.layout       = document.getElementById("cust-layout").value;
  p.bgColor      = document.getElementById("cust-bgcolor").value;
  p.textColor    = document.getElementById("cust-textcolor").value;
  p.bgImage      = document.getElementById("cust-bgimage").value.trim();
  p.font         = document.getElementById("cust-font").value;
  p.customCss    = document.getElementById("cust-css").value;
  p.blinkText    = document.getElementById("cust-blink").checked;
  p.marqueeText  = document.getElementById("cust-marquee").checked;
  p.vhsMode      = document.getElementById("cust-vhs").checked;
  p.glitchMode   = document.getElementById("cust-glitch").checked;
  p.customCursor = document.getElementById("cust-cursor").checked;

  DB.setUsers(users);

  enableVHS(p.vhsMode);
  enableGlitch(p.glitchMode);
  document.body.classList.toggle("custom-cursor", p.customCursor);

  renderProfilePreview();
  notify("🎨 Theme applied!");
  awardBadge(currentUser, "designer");
}

function exportProfile() {
  const users = DB.getUsers();
  const user  = users[currentUser];
  const html  = `<!DOCTYPE html>
<html>
<head>
  <title>${user.profile.displayName || currentUser} — NetZone 98 Profile</title>
  <style>
    body { margin: 0; padding: 0; }
    .profile-name { font-family: VT323, monospace; font-size: 32px; }
    .hit-counter { background:#000; color:#0f0; font-family:monospace; padding:2px 8px; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  </style>
</head>
<body>
  ${buildProfileHTML(currentUser, user, false)}
  <p style="text-align:center; font-size:10px; margin-top:16px;">
    Made with ❤️ on NetZone 98 — ${new Date().toLocaleDateString()}
  </p>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (currentUser + "_netzone98.html");
  a.click();
  URL.revokeObjectURL(a.href);
  notify("📁 Profile exported!");
}

/* ─────────────────────────────────────────────────────
   POSTS
   ───────────────────────────────────────────────────── */
function loadMyPosts() {
  const list  = document.getElementById("my-posts-list");
  if (!list) return;
  const posts = DB.getPosts()[currentUser] || [];
  if (!posts.length) { list.innerHTML = "<i style='color:#888;'>No posts yet.</i>"; return; }

  list.innerHTML = [...posts].reverse().map((p, i) => {
    const realIdx = posts.length - 1 - i;
    const isImage = /\.(gif|png|jpg|jpeg|webp)$/i.test(p.content.trim()) || p.content.trim().startsWith("http");
    const contentHtml = isImage
      ? `<img src="${p.content.trim()}" alt="" style="max-width:100%; max-height:150px; display:block; margin-top:4px;" />`
      : p.content;
    return `
      <div class="post-card">
        <div class="post-header">
          <span>📅 ${new Date(p.ts).toLocaleString()}</span>
          <button class="post-delete-btn" onclick="deletePost(${realIdx})">✕ Delete</button>
        </div>
        <div class="post-content">${contentHtml}</div>
      </div>`;
  }).join("");
}

function submitPost() {
  const content = document.getElementById("post-content").value.trim();
  if (!content) return;
  const posts = DB.getPosts();
  if (!posts[currentUser]) posts[currentUser] = [];
  posts[currentUser].push({ content, ts: Date.now() });
  DB.setPosts(posts);
  document.getElementById("post-content").value = "";
  loadMyPosts();
  notify("📤 Posted!");
  awardBadge(currentUser, "poster");
}

function deletePost(idx) {
  const posts = DB.getPosts();
  posts[currentUser].splice(idx, 1);
  DB.setPosts(posts);
  loadMyPosts();
}

/* ─────────────────────────────────────────────────────
   EXPLORE APP
   ───────────────────────────────────────────────────── */
function initExplore() {
  loadAllUsers();
}

function loadAllUsers() {
  const users   = DB.getUsers();
  const content = document.getElementById("explore-content");
  if (!content) return;
  const others = Object.entries(users).filter(([u]) => u !== currentUser);
  if (!others.length) {
    content.innerHTML = "<div class='explore-hint'>No other users yet. Be the first to sign up!</div>";
    return;
  }
  content.innerHTML = others.map(([uname, u]) => userCardHTML(uname, u)).join("");
}

function loadTopProfiles() {
  const users   = DB.getUsers();
  const stats   = DB.getStats();
  const content = document.getElementById("explore-content");
  if (!content) return;
  const sorted = Object.entries(users)
    .sort(([a], [b]) => (stats.visits?.[b] || 0) - (stats.visits?.[a] || 0));
  content.innerHTML = `<div class="section-title">🏆 Top Visited</div>` +
    sorted.map(([uname, u]) => userCardHTML(uname, u)).join("");
}

function loadRandomProfile() {
  const users = DB.getUsers();
  const keys  = Object.keys(users).filter(u => u !== currentUser);
  if (!keys.length) return notify("No other users to explore!");
  const pick = keys[Math.floor(Math.random() * keys.length)];
  viewUserProfile(pick);
}

function userCardHTML(username, user) {
  const p       = user.profile || {};
  const stats   = DB.getStats();
  const visits  = stats.visits?.[username] || 0;
  const avatar  = p.avatar ? `<img src="${p.avatar}" style="width:36px;height:36px;object-fit:cover;" onerror="this.style.display='none'" />` : "👤";
  return `
    <div class="user-card" onclick="viewUserProfile('${username}')">
      <div class="user-card-avatar">${avatar}</div>
      <div class="user-card-info">
        <div class="user-card-name">${p.displayName || username}</div>
        <div class="user-card-bio">${p.bio || "(no bio)"}</div>
      </div>
      <div class="user-card-visits">${visits}</div>
    </div>`;
}

/* ─────────────────────────────────────────────────────
   VIEW USER PROFILE
   ───────────────────────────────────────────────────── */
function viewUserProfile(username) {
  const users = DB.getUsers();
  if (!users[username]) return notify("User not found: " + username);

  viewingUser = username;
  recordVisit(username);

  // Close old viewuser window if open
  if (openWindows["viewuser"]) closeWindow("viewuser");

  const tpl = document.getElementById("tpl-viewuser");
  const win = tpl.content.cloneNode(true).firstElementChild;
  const layer = document.getElementById("window-layer");

  const offset = Object.keys(openWindows).length * 20;
  win.style.left = (100 + offset) + "px";
  win.style.top  = (60 + offset)  + "px";
  win.style.zIndex = ++windowZIndex;
  win.style.display = "flex";
  win.style.flexDirection = "column";

  layer.appendChild(win);
  openWindows["viewuser"] = win;
  makeDraggable(win);
  updateTaskbar();

  const user = users[username];
  const p    = user.profile || {};
  win.querySelector("#viewuser-title").textContent = "👤 " + (p.displayName || username) + "'s Profile";
  const content = win.querySelector("#viewuser-content");
  content.innerHTML = buildProfileHTML(username, user, false);
  applyCSSEffects(p, content);

  // Show guestbook entries
  const gbs = DB.getGuestbooks()[username] || [];
  const gbSection = document.createElement("div");
  gbSection.style.marginTop = "8px";
  gbSection.innerHTML = `
    <div class="section-title">📖 Guestbook (${gbs.length} entries)</div>
    ${gbs.slice(-5).reverse().map(e => `
      <div class="gb-entry">
        <div class="gb-entry-header">
          <span class="gb-entry-user">${e.by}</span>
          <span>${new Date(e.ts).toLocaleDateString()}</span>
        </div>
        <div class="gb-entry-text">${e.msg}</div>
      </div>`).join("") || "<i style='color:#888;'>No entries yet.</i>"}
  `;
  content.appendChild(gbSection);
}

function signOtherGuestbook() {
  const form = document.querySelector("#win-viewuser #viewuser-guestbook-form");
  if (form) form.classList.toggle("hidden");
}

function followUser() {
  if (!viewingUser) return;
  notify("⭐ You are now following " + viewingUser + "!");
  awardBadge(currentUser, "social");
}

function submitOtherGuestbook() {
  const msg = document.querySelector("#win-viewuser #viewuser-gb-msg")?.value.trim();
  if (!msg || !viewingUser) return;

  const gbs = DB.getGuestbooks();
  if (!gbs[viewingUser]) gbs[viewingUser] = [];
  gbs[viewingUser].push({ by: currentUser, msg, ts: Date.now() });
  DB.setGuestbooks(gbs);

  document.querySelector("#win-viewuser #viewuser-gb-msg").value = "";
  document.querySelector("#win-viewuser #viewuser-guestbook-form").classList.add("hidden");
  notify("✍️ Guestbook signed!");
  awardBadge(currentUser, "social");
  viewUserProfile(viewingUser); // refresh
}

function recordVisit(username) {
  const stats = DB.getStats();
  if (!stats.visits) stats.visits = {};
  stats.visits[username] = (stats.visits[username] || 0) + 1;
  DB.setStats(stats);
}

/* ─────────────────────────────────────────────────────
   CHAT APP
   ───────────────────────────────────────────────────── */
function initChat() {
  renderRoomList();
  joinRoom("General");

  if (chatPollTimer) clearInterval(chatPollTimer);
  chatPollTimer = setInterval(refreshChatMessages, 2000);
}

function renderRoomList() {
  const list = document.getElementById("chat-room-list");
  if (!list) return;
  const chat  = DB.getChat();
  const rooms = Object.keys(chat.rooms);
  list.innerHTML = rooms.map(r =>
    `<button class="chat-room-btn ${r === currentRoom ? 'active' : ''}" onclick="joinRoom('${r}')"># ${r}</button>`
  ).join("");
}

function joinRoom(room) {
  currentRoom = room;
  const title = document.getElementById("chat-room-title");
  if (title) title.textContent = "# " + room;
  renderRoomList();
  refreshChatMessages();
  notify("💬 Joined #" + room);

  // System message
  const chat = DB.getChat();
  if (!chat.rooms[room]) chat.rooms[room] = [];
  chat.rooms[room].push({ user: "SYSTEM", msg: currentUser + " joined the room.", ts: Date.now(), system: true });
  DB.setChat(chat);
}

function refreshChatMessages() {
  const el = document.getElementById("chat-messages");
  if (!el || !currentRoom) return;
  const chat = DB.getChat();
  const msgs = (chat.rooms[currentRoom] || []).slice(-80);
  el.innerHTML = msgs.map(m => {
    if (m.system) return `<div class="chat-msg chat-msg-system">*** ${m.msg}</div>`;
    const time = new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `<div class="chat-msg"><span class="chat-msg-user">[${m.user}]</span> ${m.msg} <span style="color:#aaa;font-size:9px;">${time}</span></div>`;
  }).join("");
  el.scrollTop = el.scrollHeight;
}

function sendChatMessage() {
  const input = document.getElementById("chat-input");
  if (!input) return;
  const msg = input.value.trim();
  if (!msg || !currentRoom) return;

  const chat = DB.getChat();
  if (!chat.rooms[currentRoom]) chat.rooms[currentRoom] = [];
  chat.rooms[currentRoom].push({ user: currentUser, msg, ts: Date.now() });
  // Keep last 200 messages per room
  if (chat.rooms[currentRoom].length > 200) chat.rooms[currentRoom] = chat.rooms[currentRoom].slice(-200);
  DB.setChat(chat);

  input.value = "";
  refreshChatMessages();
  awardBadge(currentUser, "chatter");
}

function createRoom() {
  const name = document.getElementById("new-room-name").value.trim();
  if (!name) return;
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return notify("Room name: letters/numbers/dashes only.");
  const chat = DB.getChat();
  if (chat.rooms[name]) return notify("Room already exists!");
  chat.rooms[name] = [];
  DB.setChat(chat);
  document.getElementById("new-room-name").value = "";
  renderRoomList();
  joinRoom(name);
  notify("🆕 Room #" + name + " created!");
}

/* ─────────────────────────────────────────────────────
   GUESTBOOK APP
   ───────────────────────────────────────────────────── */
function initGuestbook() {
  renderGuestbookEntries();
}

function renderGuestbookEntries() {
  const el = document.getElementById("guestbook-entries");
  if (!el) return;
  const gbs = DB.getGuestbooks()[currentUser] || [];
  if (!gbs.length) { el.innerHTML = "<i style='color:#888;'>No entries yet. Share your page!</i>"; return; }
  el.innerHTML = [...gbs].reverse().map(e => `
    <div class="gb-entry">
      <div class="gb-entry-header">
        <span class="gb-entry-user" onclick="viewUserProfile('${e.by}')">${e.by}</span>
        <span>${new Date(e.ts).toLocaleDateString()}</span>
      </div>
      <div class="gb-entry-text">${e.msg}</div>
    </div>`).join("");
}

function signGuestbook() {
  const msg = document.getElementById("guestbook-msg").value.trim();
  if (!msg) return;
  const gbs = DB.getGuestbooks();
  if (!gbs[currentUser]) gbs[currentUser] = [];
  gbs[currentUser].push({ by: currentUser, msg, ts: Date.now() });
  DB.setGuestbooks(gbs);
  document.getElementById("guestbook-msg").value = "";
  renderGuestbookEntries();
  notify("✍️ Entry added!");
}

/* ─────────────────────────────────────────────────────
   GAMES APP
   ───────────────────────────────────────────────────── */
function initGames() {
  const area = document.getElementById("game-area");
  if (area) area.innerHTML = `
    <div class="game-msg" style="padding:20px;">
      🕹️ Select a game above to play!<br/>
      <span style="font-size:13px; color:#aaa;">Snake · Pong · Memory</span>
    </div>`;
}

function loadGame(name) {
  if (gameLoop) { cancelAnimationFrame(gameLoop); gameLoop = null; }
  const area = document.getElementById("game-area");
  if (!area) return;
  if (name === "snake")  startSnake(area);
  if (name === "pong")   startPong(area);
  if (name === "memory") startMemory(area);
}

/* ── SNAKE ── */
function startSnake(area) {
  const W = 300, H = 300, SZ = 15;
  area.innerHTML = `
    <div class="game-score">🐍 Score: <span id="snake-score">0</span></div>
    <canvas id="snake-canvas" width="${W}" height="${H}"></canvas>
    <div class="game-msg" style="font-size:13px; margin-top:4px;">Arrow Keys to move</div>`;
  const canvas = document.getElementById("snake-canvas");
  const ctx = canvas.getContext("2d");

  let snake = [{ x: 10, y: 10 }];
  let dir   = { x: 1, y: 0 };
  let food  = randomFood(W, H, SZ);
  let score = 0;
  let speed = 150;
  let lastTime = 0;

  const keyMap = {
    ArrowUp:    { x:  0, y: -1 }, ArrowDown:  { x: 0, y: 1 },
    ArrowLeft:  { x: -1, y:  0 }, ArrowRight: { x: 1, y: 0 },
    w:          { x:  0, y: -1 }, s:          { x: 0, y: 1 },
    a:          { x: -1, y:  0 }, d:          { x: 1, y: 0 },
  };

  function keydown(e) {
    const nd = keyMap[e.key];
    if (nd && !(nd.x === -dir.x && nd.y === -dir.y)) { dir = nd; e.preventDefault(); }
  }
  document.addEventListener("keydown", keydown);

  function randomFood(W, H, SZ) {
    return {
      x: Math.floor(Math.random() * (W / SZ)),
      y: Math.floor(Math.random() * (H / SZ))
    };
  }

  function draw(ts) {
    gameLoop = requestAnimationFrame(draw);
    if (ts - lastTime < speed) return;
    lastTime = ts;

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // Wall collision
    if (head.x < 0 || head.y < 0 || head.x >= W / SZ || head.y >= H / SZ) return gameOver("snake", score);
    // Self collision
    if (snake.some(s => s.x === head.x && s.y === head.y)) return gameOver("snake", score);

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score++;
      document.getElementById("snake-score").textContent = score;
      food = randomFood(W, H, SZ);
      speed = Math.max(60, speed - 5);
    } else {
      snake.pop();
    }

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);

    // Food
    ctx.fillStyle = "#ff4444";
    ctx.fillRect(food.x * SZ, food.y * SZ, SZ - 1, SZ - 1);

    // Snake
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? "#00ff44" : "#00cc33";
      ctx.fillRect(s.x * SZ, s.y * SZ, SZ - 1, SZ - 1);
    });
  }

  function cleanup() { document.removeEventListener("keydown", keydown); }
  gameLoop = requestAnimationFrame(draw);

  // Override close to clean up
  const origClose = window.closeWindow;
  canvas.dataset.cleanup = "snake";
}

/* ── PONG ── */
function startPong(area) {
  const W = 400, H = 280;
  area.innerHTML = `
    <div class="game-score">🏓 Player: <span id="pong-pscore">0</span> | CPU: <span id="pong-cscore">0</span></div>
    <canvas id="pong-canvas" width="${W}" height="${H}"></canvas>
    <div class="game-msg" style="font-size:12px; margin-top:4px;">W/S or ↑/↓ to move</div>`;
  const canvas = document.getElementById("pong-canvas");
  const ctx = canvas.getContext("2d");

  const PH = 50, PW = 8, BR = 7;
  let py = H / 2 - PH / 2, cy = H / 2 - PH / 2;
  let bx = W / 2, by = H / 2, vx = 4, vy = 3;
  let pscore = 0, cscore = 0;
  const keys = {};

  const kd = e => { keys[e.key] = true; };
  const ku = e => { keys[e.key] = false; };
  document.addEventListener("keydown", kd);
  document.addEventListener("keyup",   ku);

  function draw() {
    gameLoop = requestAnimationFrame(draw);

    // Player movement
    if ((keys["ArrowUp"] || keys["w"]) && py > 0)        py -= 5;
    if ((keys["ArrowDown"] || keys["s"]) && py < H - PH) py += 5;

    // CPU AI
    if (cy + PH / 2 < by - 4) cy += 3.5;
    else if (cy + PH / 2 > by + 4) cy -= 3.5;
    cy = Math.max(0, Math.min(H - PH, cy));

    // Ball movement
    bx += vx; by += vy;

    // Top/bottom bounce
    if (by <= BR || by >= H - BR) vy *= -1;

    // Paddle collision
    if (bx - BR <= PW && by >= py && by <= py + PH) { vx = Math.abs(vx); }
    if (bx + BR >= W - PW && by >= cy && by <= cy + PH) { vx = -Math.abs(vx); }

    // Score
    if (bx < 0) {
      cscore++; document.getElementById("pong-cscore").textContent = cscore;
      bx = W / 2; by = H / 2; vx = 4; vy = 3;
    }
    if (bx > W) {
      pscore++; document.getElementById("pong-pscore").textContent = pscore;
      bx = W / 2; by = H / 2; vx = -4; vy = -3;
    }

    // Draw
    ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#333"; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#00ff44";
    ctx.fillRect(0, py, PW, PH);
    ctx.fillRect(W - PW, cy, PW, PH);
    ctx.beginPath(); ctx.arc(bx, by, BR, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
  }

  gameLoop = requestAnimationFrame(draw);
}

/* ── MEMORY ── */
function startMemory(area) {
  const emojis = ["🎮","🌟","🎵","🚀","💎","🔥","🌈","🎭"];
  const cards  = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
  let flipped = [], matched = 0, locked = false;

  area.innerHTML = `
    <div class="game-score" style="margin-top:8px;">🧠 Memory — Matches: <span id="mem-score">0</span>/8</div>
    <div class="memory-grid" id="memory-grid"></div>`;
  const grid = document.getElementById("memory-grid");

  cards.forEach((emoji, i) => {
    const card = document.createElement("div");
    card.className = "memory-card hidden-face";
    card.dataset.emoji = emoji;
    card.dataset.index = i;
    card.onclick = () => flipCard(card);
    grid.appendChild(card);
  });

  function flipCard(card) {
    if (locked || card.classList.contains("flipped") || card.classList.contains("matched")) return;
    card.textContent = card.dataset.emoji;
    card.classList.remove("hidden-face");
    card.classList.add("flipped");
    flipped.push(card);

    if (flipped.length === 2) {
      locked = true;
      if (flipped[0].dataset.emoji === flipped[1].dataset.emoji) {
        flipped.forEach(c => c.classList.add("matched"));
        matched++;
        document.getElementById("mem-score").textContent = matched;
        flipped = []; locked = false;
        if (matched === 8) {
          setTimeout(() => notify("🧠 Memory complete! Amazing!"), 200);
          awardBadge(currentUser, "gamer");
        }
      } else {
        setTimeout(() => {
          flipped.forEach(c => { c.textContent = ""; c.classList.remove("flipped"); c.classList.add("hidden-face"); });
          flipped = []; locked = false;
        }, 800);
      }
    }
  }
}

function gameOver(game, score) {
  cancelAnimationFrame(gameLoop);
  gameLoop = null;
  const area = document.getElementById("game-area");
  if (area) area.innerHTML = `
    <div class="game-msg" style="padding:20px;">
      GAME OVER<br/>
      Score: ${score}<br/>
      <button class="xp-btn primary" onclick="loadGame('${game}')" style="margin-top:8px;">Try Again</button>
    </div>`;
  if (score > 5) awardBadge(currentUser, "gamer");
}

/* ─────────────────────────────────────────────────────
   BADGES
   ───────────────────────────────────────────────────── */
const ALL_BADGES = [
  { id: "newbie",     icon: "🌱", name: "Newbie",      desc: "Joined NetZone 98" },
  { id: "customizer", icon: "✏️",  name: "Customizer",  desc: "Edited your profile" },
  { id: "designer",   icon: "🎨", name: "Designer",    desc: "Applied a custom theme" },
  { id: "poster",     icon: "📝", name: "Poster",      desc: "Made your first post" },
  { id: "chatter",    icon: "💬", name: "Chatter",     desc: "Sent a chat message" },
  { id: "social",     icon: "⭐", name: "Social",      desc: "Signed a guestbook" },
  { id: "gamer",      icon: "🎮", name: "Gamer",       desc: "Played a mini game" },
  { id: "explorer",   icon: "🔭", name: "Explorer",    desc: "Visited another profile" },
];

function getUserBadges(username) {
  return DB.get("badges_" + username) || [];
}

function awardBadge(username, badgeId) {
  const current = getUserBadges(username);
  if (current.includes(badgeId)) return;
  current.push(badgeId);
  DB.set("badges_" + username, current);
  const badge = ALL_BADGES.find(b => b.id === badgeId);
  if (badge) notify("🏅 Badge earned: " + badge.name + "!");
}

function initBadges() {
  const grid = document.getElementById("badges-grid");
  if (!grid) return;
  const earned = getUserBadges(currentUser);
  grid.innerHTML = ALL_BADGES.map(b => `
    <div class="badge-card ${earned.includes(b.id) ? "" : "locked"}">
      <div class="badge-icon">${b.icon}</div>
      <div class="badge-name">${b.name}</div>
      <div class="badge-desc">${b.desc}</div>
      ${earned.includes(b.id) ? "<div style='color:#008800;font-size:9px;'>✅ Earned</div>" : "<div style='color:#aaa;font-size:9px;'>🔒 Locked</div>"}
    </div>`).join("");
}

function getBadgesHTML(username) {
  const earned = getUserBadges(username);
  return ALL_BADGES.filter(b => earned.includes(b.id))
    .map(b => `<span title="${b.name}" style="font-size:20px;">${b.icon}</span>`)
    .join(" ");
}

/* ─────────────────────────────────────────────────────
   SETTINGS APP
   ───────────────────────────────────────────────────── */
function initSettings() {
  const saved = DB.get("settings_" + currentUser) || {};
  setValue("set-bg", saved.bg || "default");
}

function applyDesktopBg() {
  const val = document.getElementById("set-bg").value;
  applyDesktopBgValue(val);
  const saved = DB.get("settings_" + currentUser) || {};
  saved.bg = val;
  DB.set("settings_" + currentUser, saved);
}

function applyDesktopBgValue(val) {
  document.body.className = document.body.className
    .replace(/\bbg-\S+/g, "").trim();
  const map = { space: "bg-space", matrix: "bg-matrix", sunset: "bg-sunset", black: "bg-black" };
  if (map[val]) document.body.classList.add(map[val]);
}

function changePassword() {
  const oldpass = document.getElementById("set-oldpass").value;
  const newpass = document.getElementById("set-newpass").value;
  if (!oldpass || !newpass) return showSettingsMsg("Fill in both fields.", "red");
  if (newpass.length < 4)   return showSettingsMsg("Password too short.", "red");

  const users = DB.getUsers();
  const user  = users[currentUser];
  if (user.isGuest) return showSettingsMsg("Guests can't change passwords.", "red");
  if (user.password !== btoa(oldpass)) return showSettingsMsg("Old password incorrect.", "red");

  users[currentUser].password = btoa(newpass);
  DB.setUsers(users);
  showSettingsMsg("✅ Password changed!", "green");
}

function deleteAccount() {
  if (!confirm("Delete your account permanently? This cannot be undone.")) return;
  const users = DB.getUsers();
  delete users[currentUser];
  DB.setUsers(users);
  handleLogout();
}

function showSettingsMsg(msg, color) {
  const el = document.getElementById("settings-msg");
  if (!el) return;
  el.textContent = msg;
  el.style.color = color;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3000);
}

/* ─────────────────────────────────────────────────────
   VHS / GLITCH EFFECTS
   ───────────────────────────────────────────────────── */
function enableVHS(on) {
  const el = document.getElementById("vhs-overlay");
  el.classList.toggle("hidden", !on);
  if (on) {
    setInterval(() => {
      document.getElementById("vhs-timestamp").textContent =
        "REC ● " + new Date().toLocaleTimeString();
    }, 1000);
  }
}

function enableGlitch(on) {
  document.getElementById("glitch-overlay").classList.toggle("hidden", !on);
}

/* ─────────────────────────────────────────────────────
   NOTIFICATION TOAST
   ───────────────────────────────────────────────────── */
let notifyTimer = null;
function notify(msg) {
  const el = document.getElementById("notification");
  el.textContent = msg;
  el.classList.remove("hidden");
  if (notifyTimer) clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => el.classList.add("hidden"), 3000);
}

/* ─────────────────────────────────────────────────────
   UTILITY HELPERS
   ───────────────────────────────────────────────────── */
function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function setChecked(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = val;
}