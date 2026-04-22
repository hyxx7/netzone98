/* =====================================================
   NETZONE 98 — APP.JS (ULTRA ENHANCED)
   Firebase-powered | Full Customization | Social Features
   ===================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, getDocs, onSnapshot, collection, query, orderBy, limit, serverTimestamp, arrayUnion, increment, arrayRemove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAf7OQ6gKgm5sWSkpEAazoicbtjmHmGzsQ",
  authDomain: "netzone98-68e0a.firebaseapp.com",
  projectId: "netzone98-68e0a",
  storageBucket: "netzone98-68e0a.firebasestorage.app",
  messagingSenderId: "336053324952",
  appId: "1:336053324952:web:b1c3c5e4029a012fe214ed"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

/* ─────────────────────────────────────────────────────
   FIRESTORE HELPERS
   ───────────────────────────────────────────────────── */
async function fsGetUser(username) {
  const snap = await getDoc(doc(db, "users", username));
  return snap.exists() ? snap.data() : null;
}

async function fsSetUser(username, data) {
  await setDoc(doc(db, "users", username), data, { merge: true });
}

async function fsGetAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  const result = {};
  snap.forEach(d => result[d.id] = d.data());
  return result;
}

async function fsGetPosts(username) {
  const snap = await getDocs(query(collection(db, "posts", username, "items"), orderBy("ts", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fsAddPost(username, content, imageData = null) {
  await addDoc(collection(db, "posts", username, "items"), {
    content, imageData, ts: serverTimestamp()
  });
}

async function fsDeletePost(username, postId) {
  await deleteDoc(doc(db, "posts", username, "items", postId));
}

async function fsGetGuestbook(username) {
  const snap = await getDocs(query(collection(db, "guestbooks", username, "entries"), orderBy("ts", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fsAddGuestbookEntry(targetUser, by, msg) {
  await addDoc(collection(db, "guestbooks", targetUser, "entries"), { by, msg, ts: serverTimestamp() });
}

async function fsGetBadges(username) {
  const user = await fsGetUser(username);
  return user?.badges || [];
}

async function fsAwardBadge(username, badgeId) {
  const current = await fsGetBadges(username);
  if (current.includes(badgeId)) return;
  await updateDoc(doc(db, "users", username), { badges: arrayUnion(badgeId) });
  const badge = ALL_BADGES.find(b => b.id === badgeId);
  if (badge) notify("🏅 Badge earned: " + badge.name + "!");
}

async function fsGetVisits(username) {
  const snap = await getDoc(doc(db, "stats", username));
  return snap.exists() ? (snap.data().visits || 0) : 0;
}

async function fsRecordVisit(username) {
  await setDoc(doc(db, "stats", username), { visits: increment(1) }, { merge: true });
}

/* ─────────────────────────────────────────────────────
   GLOBAL STATE
   ───────────────────────────────────────────────────── */
let currentUser = null;
let currentRoom = null;
let unsubscribeChat = null;
let openWindows = {};
let windowZIndex = 1000;
let visitorCount = 0;

/* ─────────────────────────────────────────────────────
   BADGE DEFINITIONS (EXPANDED)
   ───────────────────────────────────────────────────── */
const ALL_BADGES = [
  { id: "newbie", name: "Newbie", icon: "🐣", desc: "Created account" },
  { id: "developer", name: "Developer", icon: "💻", desc: "Published an app" },
  { id: "socialite", name: "Socialite", icon: "🦋", desc: "20 visitors" },
  { id: "collector", name: "Collector", icon: "🏺", desc: "5+ badges" },
  { id: "designer", name: "Designer", icon: "🎨", desc: "Custom profile" },
  { id: "chat_master", name: "Chat Master", icon: "💬", desc: "500+ messages" },
  { id: "guestbook_star", name: "Guestbook Star", icon: "⭐", desc: "10+ guestbook entries" },
  { id: "explorer", name: "Explorer", icon: "🗺️", desc: "Visited 10 profiles" },
  { id: "speedster", name: "Speedster", icon: "⚡", desc: "Online for 1 hour" },
  { id: "trendsetter", name: "Trendsetter", icon: "🚀", desc: "First to use feature" }
];

/* ─────────────────────────────────────────────────────
   DESKTOP ICON DRAGGING
   ───────────────────────────────────────────────────── */
let draggingIcon = null;
let iconStartX = 0, iconStartY = 0, iconOffsetX = 0, iconOffsetY = 0;

function startIconDrag(e) {
  if (e.detail && e.detail > 1) return;
  draggingIcon = e.target.closest('.desk-icon');
  if (!draggingIcon) return;
  
  iconStartX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
  iconStartY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
  iconOffsetX = draggingIcon.offsetLeft;
  iconOffsetY = draggingIcon.offsetTop;
  
  draggingIcon.style.position = 'absolute';
  draggingIcon.style.zIndex = 999;
  draggingIcon.style.opacity = '0.8';
  
  document.addEventListener('mousemove', moveIcon);
  document.addEventListener('touchmove', moveIcon);
  document.addEventListener('mouseup', stopIconDrag);
  document.addEventListener('touchend', stopIconDrag);
  e.preventDefault();
}

function moveIcon(e) {
  if (!draggingIcon) return;
  const currentX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
  const currentY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
  const newX = iconOffsetX + (currentX - iconStartX);
  const newY = iconOffsetY + (currentY - iconStartY);
  draggingIcon.style.left = newX + 'px';
  draggingIcon.style.top = newY + 'px';
}

function stopIconDrag() {
  if (draggingIcon) draggingIcon.style.opacity = '1';
  draggingIcon = null;
  document.removeEventListener('mousemove', moveIcon);
  document.removeEventListener('touchmove', moveIcon);
  document.removeEventListener('mouseup', stopIconDrag);
  document.removeEventListener('touchend', stopIconDrag);
}

/* ─────────────────────────────────────────────────────
   BACKGROUND & THEME CUSTOMIZATION
   ───────────────────────────────────────────────────── */
const BACKGROUND_PRESETS = [
  { name: "Classic Blue", value: "linear-gradient(45deg, #000080, #0000FF)", id: "classic" },
  { name: "Purple Haze", value: "linear-gradient(135deg, #4B0082, #9370DB)", id: "purple" },
  { name: "Ocean Wave", value: "linear-gradient(180deg, #001a4d, #0066cc)", id: "ocean" },
  { name: "Cyberpunk", value: "linear-gradient(45deg, #ff00ff, #00ffff)", id: "cyber" },
  { name: "Green Matrix", value: "linear-gradient(90deg, #000000, #00FF00)", id: "matrix" },
  { name: "Fire", value: "linear-gradient(135deg, #FF0000, #FFA500)", id: "fire" },
  { name: "Sunset", value: "linear-gradient(to bottom, #FF6B6B, #FFE66D)", id: "sunset" },
  { name: "Galaxy", value: "radial-gradient(circle, #1a0033, #330066, #000000)", id: "galaxy" },
  { name: "Neon Pink", value: "linear-gradient(45deg, #FF1493, #FF69B4)", id: "neon" },
  { name: "Retro Green", value: "linear-gradient(90deg, #00AA00, #00FF00)", id: "retro" },
  { name: "Starfield", value: "radial-gradient(circle, #ffffff, #000000)", id: "stars" },
  { name: "Forest", value: "linear-gradient(135deg, #1a3a1a, #2d5a2d)", id: "forest" }
];

const PROFILE_THEMES = [
  { name: "Classic", layout: "classic", color: "#0000FF", bgColor: "#C0C0C0" },
  { name: "Dark", layout: "terminal", color: "#00FF00", bgColor: "#000000" },
  { name: "Neon", layout: "classic", color: "#FF00FF", bgColor: "#000000" },
  { name: "Retro", layout: "classic", color: "#FFFF00", bgColor: "#0000FF" },
  { name: "Minimal", layout: "classic", color: "#333333", bgColor: "#EEEEEE" }
];

async function setDesktopBackground(backgroundId) {
  const preset = BACKGROUND_PRESETS.find(b => b.id === backgroundId);
  if (!preset) return;
  
  document.getElementById("desktop").style.background = preset.value;
  await fsSetUser(currentUser, { desktopBackground: backgroundId });
  notify("🎨 Background updated!");
}

async function setCustomBackground(colorValue) {
  document.getElementById("desktop").style.background = colorValue;
  await fsSetUser(currentUser, { customBackground: colorValue });
  notify("🎨 Custom background set!");
}

async function applyProfileTheme(themeName) {
  const theme = PROFILE_THEMES.find(t => t.name === themeName);
  if (!theme) return;
  await fsSetUser(currentUser, {
    profileTheme: themeName,
    profileLayout: theme.layout,
    profileColor: theme.color,
    profileBgColor: theme.bgColor
  });
  notify("🎨 Profile theme applied!");
}

/* ─────────────────────────────────────────────────────
   PROFILE CUSTOMIZATION (ENHANCED)
   ───────────────────────────────────────────────────── */
async function saveProfile() {
  const data = {
    displayName: document.getElementById("edit-displayname").value || "Cool User",
    avatar: document.getElementById("edit-avatar").value || "👤",
    bio: document.getElementById("edit-bio").value || "",
    location: document.getElementById("edit-location").value || "",
    mood: document.getElementById("edit-mood").value || "😎",
    song: document.getElementById("edit-song").value || "",
    website: document.getElementById("edit-website")?.value || "",
    interests: document.getElementById("edit-interests")?.value || "",
    joinDate: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
  
  await fsSetUser(currentUser, data);
  notify("💾 Profile saved!");
  await loadProfileView();
}

async function saveCustomization() {
  const layout = document.getElementById("cust-layout").value;
  const bgColor = document.getElementById("cust-bgcolor").value;
  const textColor = document.getElementById("cust-textcolor").value;
  const accentColor = document.getElementById("cust-accentcolor")?.value || "#FF00FF";
  const borderStyle = document.getElementById("cust-borderstyle")?.value || "solid";
  const fontStyle = document.getElementById("cust-fontstyle")?.value || "Arial";
  
  await fsSetUser(currentUser, {
    profileLayout: layout,
    bgColor, textColor, accentColor, borderStyle, fontStyle
  });
  
  notify("✨ Profile customized!");
}

async function exportProfile() {
  const user = await fsGetUser(currentUser);
  const posts = await fsGetPosts(currentUser);
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${user.displayName}'s Profile</title>
      <style>
        body { background: ${user.bgColor || '#C0C0C0'}; color: ${user.textColor || '#000000'}; font-family: ${user.fontStyle || 'Arial'}; }
        .profile { max-width: 800px; margin: 0 auto; padding: 20px; }
        .avatar { font-size: 60px; }
        h1 { margin: 10px 0; }
        .post { border: 1px solid #999; padding: 10px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="profile">
        <div class="avatar">${user.avatar}</div>
        <h1>${user.displayName}</h1>
        <p>${user.bio}</p>
        <p>📍 ${user.location} | 🎵 ${user.song}</p>
        <h2>Posts</h2>
        ${posts.map(p => `<div class="post">${p.content}</div>`).join('')}
      </div>
    </body>
    </html>
  `;
  
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentUser + '.html';
  a.click();
  notify("📁 Profile exported!");
}

/* ─────────────────────────────────────────────────────
   PROFILE VIEW (ENHANCED)
   ───────────────────────────────────────────────────── */
async function loadProfileView() {
  const user = await fsGetUser(currentUser);
  const visits = await fsGetVisits(currentUser);
  const badges = user?.badges || [];
  const posts = await fsGetPosts(currentUser);
  
  const badgeHtml = badges.map(badgeId => {
    const badge = ALL_BADGES.find(b => b.id === badgeId);
    return badge ? `<span title="${badge.desc}" style="font-size:20px; cursor:help; margin:2px;">${badge.icon}</span>` : '';
  }).join('');
  
  const area = document.getElementById("profile-preview-area");
  if (!area) return;
  
  area.innerHTML = `
    <div class="profile-header-row">
      <div class="profile-avatar-container" style="background: ${user?.bgColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};">
        <div class="profile-avatar-img">${user?.avatar || '👤'}</div>
      </div>
      <div style="flex:1;">
        <div class="profile-name">${user?.displayName || currentUser}</div>
        <div style="font-size:11px; color:#666;">@${currentUser}</div>
        <div style="font-size:10px; margin-top:4px;">👁️ ${visits} visitors | 📝 ${posts.length} posts</div>
      </div>
    </div>
    
    <hr style="margin:8px 0;" />
    
    <div style="font-size:11px; line-height:1.6;">
      <div><strong>Bio:</strong> ${user?.bio || 'No bio yet'}</div>
      <div><strong>Location:</strong> ${user?.location || 'Cyberspace'}</div>
      <div><strong>Mood:</strong> ${user?.mood || '😊'}</div>
      <div><strong>Song:</strong> 🎵 ${user?.song || 'None'}</div>
      <div><strong>Website:</strong> ${user?.website ? `<a href="${user.website}" target="_blank">${user.website}</a>` : 'None'}</div>
      <div><strong>Interests:</strong> ${user?.interests || 'None listed'}</div>
    </div>
    
    <div style="margin-top:8px;">
      <div style="font-size:10px; margin-bottom:4px;"><strong>🏅 Badges (${badges.length}):</strong></div>
      <div>${badgeHtml || '<i>No badges yet</i>'}</div>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────
   CHAT WITH PROFILE PICTURES (ENHANCED)
   ───────────────────────────────────────────────────── */
async function sendChatMessage() {
  const input = document.getElementById("chat-input");
  const msg = input.value.trim();
  
  if (!msg || !currentRoom) return;
  
  const user = await fsGetUser(currentUser);
  
  await addDoc(collection(db, "rooms", currentRoom, "messages"), {
    user: currentUser,
    userAvatar: user?.avatar || '👤',
    userColor: user?.accentColor || '#FF00FF',
    msg,
    imageData: null,
    ts: serverTimestamp()
  });
  
  input.value = "";
  await cleanupOldMessages(currentRoom);
  
  notify("💬 Message sent!");
}

async function sendChatImageMessage(imageData) {
  if (!imageData || !currentRoom) return;
  
  const user = await fsGetUser(currentUser);
  
  await addDoc(collection(db, "rooms", currentRoom, "messages"), {
    user: currentUser,
    userAvatar: user?.avatar || '👤',
    userColor: user?.accentColor || '#FF00FF',
    msg: "",
    imageData,
    ts: serverTimestamp()
  });
  
  await cleanupOldMessages(currentRoom);
  notify("📸 Image sent!");
}

function displayChatMessages(messages) {
  const area = document.getElementById("chat-messages");
  if (!area) return;
  
  area.innerHTML = messages.map(m => `
    <div style="display:flex; gap:6px; margin-bottom:8px; align-items:flex-start;">
      <div style="width:32px; height:32px; background:${m.userColor || '#FF00FF'}; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;">
        ${m.userAvatar || '👤'}
      </div>
      <div style="flex:1; min-width:0;">
        <div style="font-size:9px; color:#666; font-weight:bold;">${m.user}</div>
        ${m.imageData ? `<img src="${m.imageData}" style="max-width:150px; border-radius:4px; margin-top:2px;" />` : ''}
        <div style="font-size:10px; word-wrap:break-word; background:#f0f0f0; padding:4px; border-radius:4px; margin-top:2px;">${m.msg}</div>
      </div>
    </div>
  `).join('');
  
  area.scrollTop = area.scrollHeight;
}

async function joinRoom(roomName) {
  currentRoom = roomName;
  document.getElementById("chat-room-title").textContent = "💬 " + roomName;
  
  if (unsubscribeChat) unsubscribeChat();
  
  unsubscribeChat = onSnapshot(
    query(collection(db, "rooms", roomName, "messages"), orderBy("ts", "asc"), limit(100)),
    (snap) => {
      const msgs = snap.docs.map(d => d.data());
      displayChatMessages(msgs);
    }
  );
  
  await cleanupOldMessages(roomName);
}

async function cleanupOldMessages(roomName) {
  const snap = await getDocs(query(collection(db, "rooms", roomName, "messages"), orderBy("ts", "asc")));
  const messages = snap.docs;
  
  if (messages.length > 1000) {
    const toDelete = messages.slice(0, messages.length - 1000);
    for (const doc of toDelete) {
      await deleteDoc(doc.ref);
    }
  }
}

/* ─────────────────────────────────────────────────────
   FILE UPLOAD HANDLERS
   ───────────────────────────────────────────────────── */
function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("edit-avatar").value = e.target.result;
  };
  reader.readAsDataURL(file);
}

function handlePostImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("post-content").value = JSON.stringify({ image: e.target.result });
  };
  reader.readAsDataURL(file);
}

function handleChatImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    await sendChatImageMessage(e.target.result);
  };
  reader.readAsDataURL(file);
}

/* ─────────────────────────────────────────────────────
   POSTING & TIMELINE
   ───────────────────────────────────────────────────── */
async function submitPost() {
  const content = document.getElementById("post-content").value.trim();
  if (!content) return notify("⚠️ Write something!");
  
  await fsAddPost(currentUser, content);
  document.getElementById("post-content").value = "";
  notify("📤 Post published!");
  await loadProfilePosts();
}

async function loadProfilePosts() {
  const posts = await fsGetPosts(currentUser);
  const list = document.getElementById("my-posts-list");
  
  if (!list) return;
  
  list.innerHTML = posts.map(p => `
    <div class="post-card" style="border:1px solid #ccc; padding:8px; margin:4px 0; border-radius:4px;">
      <div style="font-size:9px; color:#666; margin-bottom:4px;">
        ${new Date(p.ts?.toDate?.() || p.ts).toLocaleDateString()}
      </div>
      ${p.imageData ? `<img src="${p.imageData}" style="max-width:100%; border-radius:4px; margin-bottom:4px;" />` : ''}
      <div style="font-size:10px;">${p.content}</div>
      <button class="xp-btn danger" onclick="deletePost('${p.id}')" style="margin-top:4px; font-size:8px;">🗑️</button>
    </div>
  `).join('');
}

async function deletePost(postId) {
  if (!confirm("Delete post?")) return;
  await fsDeletePost(currentUser, postId);
  notify("🗑️ Post deleted!");
  await loadProfilePosts();
}

/* ─────────────────────────────────────────────────────
   EXPLORE & PROFILES
   ───────────────────────────────────────────────────── */
async function loadRandomProfile() {
  const users = await fsGetAllUsers();
  const usernames = Object.keys(users).filter(u => u !== currentUser);
  if (!usernames.length) return notify("No other users!");
  
  const random = usernames[Math.floor(Math.random() * usernames.length)];
  await openUserProfile(random);
}

async function loadAllUsers() {
  const users = await fsGetAllUsers();
  const usernames = Object.keys(users).filter(u => u !== currentUser);
  const area = document.getElementById("explore-content");
  
  area.innerHTML = usernames.map(u => `
    <div class="user-card" style="border:1px solid #ccc; padding:8px; margin:4px 0; cursor:pointer; border-radius:4px;" ondblclick="openUserProfile('${u}')">
      <div style="font-size:24px;">${users[u]?.avatar || '👤'}</div>
      <div style="font-size:11px; font-weight:bold;">${users[u]?.displayName || u}</div>
      <div style="font-size:9px; color:#666;">@${u}</div>
    </div>
  `).join('');
}

async function openUserProfile(username) {
  const user = await fsGetUser(username);
  if (!user) return notify("User not found!");
  
  await fsRecordVisit(username);
  
  const tpl = document.getElementById("tpl-viewuser");
  if (!tpl) return;
  
  const win = tpl.content.cloneNode(true).firstElementChild;
  const layer = document.getElementById("window-layer");
  
  win.style.left = "200px";
  win.style.top = "120px";
  win.style.zIndex = ++windowZIndex;
  win.style.display = "flex";
  win.style.flexDirection = "column";
  
  layer.appendChild(win);
  makeDraggable(win);
  openWindows["viewuser_" + username] = win;
  updateTaskbar();
  
  win.querySelector("#viewuser-title").textContent = "👤 " + (user.displayName || username);
  
  const body = win.querySelector(".window-body");
  const posts = await fsGetPosts(username);
  const badges = user.badges || [];
  
  const badgeHtml = badges.map(badgeId => {
    const badge = ALL_BADGES.find(b => b.id === badgeId);
    return badge ? `<span title="${badge.desc}" style="font-size:18px; cursor:help; margin:2px;">${badge.icon}</span>` : '';
  }).join('');
  
  body.innerHTML = `
    <div class="profile-header-row">
      <div class="profile-avatar-container" style="background: ${user.bgColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};">
        <div class="profile-avatar-img">${user.avatar || '👤'}</div>
      </div>
      <div style="flex:1;">
        <div class="profile-name">${user.displayName || username}</div>
        <div style="font-size:10px; color:#666;">@${username}</div>
      </div>
    </div>
    <hr style="margin:8px 0;" />
    <div style="font-size:10px; line-height:1.6;">
      <div><strong>Bio:</strong> ${user.bio || 'No bio'}</div>
      <div><strong>Location:</strong> ${user.location || 'Secret'}</div>
      <div><strong>Mood:</strong> ${user.mood || '😊'}</div>
    </div>
    <div style="margin-top:8px; font-size:9px;">
      <strong>🏅 Badges:</strong><br>
      ${badgeHtml || '<i>None</i>'}
    </div>
    <div style="margin-top:8px;">
      <button class="xp-btn primary" onclick="signGuestbook('${username}')" style="font-size:9px;">✍️ Sign Guestbook</button>
    </div>
    <div style="margin-top:8px; max-height:150px; overflow-y:auto; font-size:9px;">
      <strong>📝 Posts:</strong>
      ${posts.map(p => `<div style="background:#f0f0f0; padding:4px; margin:2px 0; border-radius:2px;">${p.content}</div>`).join('')}
    </div>
  `;
}

/* ─────────────────────────────────────────────────────
   GUESTBOOK
   ───────────────────────────────────────────────────── */
async function signGuestbook(targetUser) {
  const msg = prompt(`Sign ${targetUser}'s guestbook:\n\n(Leave blank to cancel)`);
  if (!msg) return;
  
  await fsAddGuestbookEntry(targetUser, currentUser, msg);
  notify("✍️ Guestbook signed!");
}

async function loadGuestbook() {
  const entries = await fsGetGuestbook(currentUser);
  const area = document.getElementById("guestbook-content");
  
  if (!area) return;
  
  area.innerHTML = `
    <div class="section-title">Sign My Guestbook</div>
    <div style="display:flex; gap:4px; margin-bottom:8px; flex-wrap:wrap;">
      <input class="xp-input" id="gb-message" placeholder="Write something cool..." style="flex:1; min-width:150px;" />
      <button class="xp-btn primary" onclick="submitGuestbookEntry()" style="font-size:9px;">✍️ Sign</button>
    </div>
    
    <div class="section-title">📖 Entries (${entries.length})</div>
    <div style="max-height:300px; overflow-y:auto;">
      ${entries.map(e => `
        <div class="gb-entry" style="border:1px solid #ccc; padding:6px; margin:4px 0; border-radius:4px; background:#f9f9f9;">
          <div style="font-size:9px; color:#666; font-weight:bold;">from <strong>${e.by}</strong></div>
          <div style="font-size:10px; margin-top:2px;">${e.msg}</div>
        </div>
      `).join('')}
    </div>
  `;
}

async function submitGuestbookEntry() {
  const msg = document.getElementById("gb-message").value.trim();
  if (!msg) return notify("⚠️ Write something!");
  
  await fsAddGuestbookEntry(currentUser, currentUser, msg);
  document.getElementById("gb-message").value = "";
  notify("✍️ Guestbook entry added!");
  await loadGuestbook();
}

/* ─────────────────────────────────────────────────────
   BADGES
   ───────────────────────────────────────────────────── */
async function loadBadges() {
  const userBadges = await fsGetBadges(currentUser);
  const area = document.getElementById("badges-content");
  
  if (!area) return;
  
  area.innerHTML = `
    <div class="section-title">🏅 Your Badges (${userBadges.length}/${ALL_BADGES.length})</div>
    <div id="badges-grid" style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
      ${ALL_BADGES.map(badge => `
        <div style="text-align:center; padding:8px; border:1px solid ${userBadges.includes(badge.id) ? '#FFD700' : '#ccc'}; border-radius:4px; background:${userBadges.includes(badge.id) ? '#fffacd' : '#f0f0f0'};" title="${badge.desc}">
          <div style="font-size:28px;">${badge.icon}</div>
          <div style="font-size:8px; margin-top:4px; font-weight:bold;">${badge.name}</div>
          <div style="font-size:7px; color:#666; margin-top:2px;">${userBadges.includes(badge.id) ? '✅ Earned' : '🔒 Locked'}</div>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:12px; font-size:9px; line-height:1.8;">
      <div><strong>How to earn badges:</strong></div>
      <ul style="margin:4px 0; padding-left:16px;">
        <li>${ALL_BADGES[0].name}: ${ALL_BADGES[0].desc}</li>
        <li>${ALL_BADGES[1].name}: ${ALL_BADGES[1].desc}</li>
        <li>${ALL_BADGES[2].name}: ${ALL_BADGES[2].desc}</li>
      </ul>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────
   SETTINGS
   ───────────────────────────────────────────────────── */
async function openSettings() {
  const tpl = document.getElementById("tpl-settings");
  if (!tpl) return;
  
  const user = await fsGetUser(currentUser);
  const win = tpl.content.cloneNode(true).firstElementChild;
  const layer = document.getElementById("window-layer");
  
  win.style.left = "240px";
  win.style.top = "160px";
  win.style.zIndex = ++windowZIndex;
  win.style.display = "flex";
  win.style.flexDirection = "column";
  
  layer.appendChild(win);
  makeDraggable(win);
  openWindows["settings"] = win;
  updateTaskbar();
  
  const settingsArea = win.querySelector("#settings-content");
  if (!settingsArea) return;
  
  settingsArea.innerHTML = `
    <div class="tab-bar">
      <div class="tab active" onclick="switchSettingsTab('general', this)">General</div>
      <div class="tab" onclick="switchSettingsTab('background', this)">Background</div>
      <div class="tab" onclick="switchSettingsTab('profile', this)">Profile Theme</div>
      <div class="tab" onclick="switchSettingsTab('privacy', this)">Privacy</div>
    </div>
    
    <div id="settings-general" class="tab-content" style="overflow-y:auto;">
      <div class="section-title">⚙️ General Settings</div>
      <table class="form-table">
        <tr>
          <td class="form-label">Username:</td>
          <td><strong>${currentUser}</strong> (cannot change)</td>
        </tr>
        <tr>
          <td class="form-label">Account Age:</td>
          <td>${Math.floor((Date.now() - new Date(user?.joinDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24))} days</td>
        </tr>
        <tr>
          <td></td>
          <td><button class="xp-btn danger" onclick="handleLogout()" style="margin-top:8px;">🚪 Log Out</button></td>
        </tr>
      </table>
    </div>
    
    <div id="settings-background" class="tab-content hidden" style="overflow-y:auto;">
      <div class="section-title">🎨 Desktop Background</div>
      <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:6px; margin-bottom:12px;">
        ${BACKGROUND_PRESETS.map(bg => `
          <button class="xp-btn" onclick="setDesktopBackground('${bg.id}')" style="background:${bg.value}; color:white; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${bg.name}</button>
        `).join('')}
      </div>
      <div class="section-title">Or Custom Color</div>
      <div style="display:flex; gap:4px;">
        <input type="color" id="custom-bg-color" value="#0000FF" style="width:60px; height:30px;" />
        <button class="xp-btn primary" onclick="setCustomBackground(document.getElementById('custom-bg-color').value)">Set</button>
      </div>
    </div>
    
    <div id="settings-profile" class="tab-content hidden" style="overflow-y:auto;">
      <div class="section-title">🎨 Profile Theme Presets</div>
      <div style="display:grid; grid-template-columns:1fr; gap:4px;">
        ${PROFILE_THEMES.map(t => `
          <button class="xp-btn" onclick="applyProfileTheme('${t.name}')" style="text-align:left; padding:8px;">${t.name} - <span style="color:${t.color};">■</span> ${t.color}</button>
        `).join('')}
      </div>
    </div>
    
    <div id="settings-privacy" class="tab-content hidden" style="padding:8px; overflow-y:auto;">
      <div class="section-title">🔒 Privacy</div>
      <div style="font-size:9px; line-height:1.8;">
        <div style="margin-bottom:8px;">
          <label>
            <input type="checkbox" id="privacy-show-email" ${user?.showEmail ? 'checked' : ''} />
            Show email on profile
          </label>
        </div>
        <div style="margin-bottom:8px;">
          <label>
            <input type="checkbox" id="privacy-hide-visitors" ${user?.hideVisitors ? 'checked' : ''} />
            Hide visitor count
          </label>
        </div>
        <button class="xp-btn primary" onclick="savePrivacySettings()" style="margin-top:8px; font-size:9px;">💾 Save</button>
      </div>
    </div>
  `;
}

function switchSettingsTab(tab, element) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('settings-' + tab).classList.remove('hidden');
  element.classList.add('active');
}

async function savePrivacySettings() {
  const settings = {
    showEmail: document.getElementById('privacy-show-email').checked,
    hideVisitors: document.getElementById('privacy-hide-visitors').checked
  };
  await fsSetUser(currentUser, settings);
  notify("🔒 Privacy settings saved!");
}

/* ─────────────────────────────────────────────────────
   WINDOW MANAGEMENT
   ───────────────────────────────────────────────────── */
function openApp(appId) {
  const tplMap = {
    profile: 'tpl-profile',
    explore: 'tpl-explore',
    chat: 'tpl-chat',
    guestbook: 'tpl-guestbook',
    games: 'tpl-games',
    badges: 'tpl-badges',
    settings: 'tpl-settings',
    appbuilder: 'tpl-appbuilder',
    appbrowser: 'tpl-appbrowser'
  };
  
  const tplId = tplMap[appId];
  if (!tplId) return;
  
  const tpl = document.getElementById(tplId);
  if (!tpl) return notify("⚠️ Window template not found");
  
  const win = tpl.content.cloneNode(true).firstElementChild;
  const layer = document.getElementById("window-layer");
  if (!layer) return;
  
  win.style.left = (100 + Math.random() * 100) + "px";
  win.style.top = (80 + Math.random() * 100) + "px";
  win.style.zIndex = ++windowZIndex;
  win.style.display = "flex";
  win.style.flexDirection = "column";
  
  layer.appendChild(win);
  makeDraggable(win);
  openWindows[appId] = win;
  updateTaskbar();
  
  if (appId === 'profile') {
    initProfileTab();
  } else if (appId === 'explore') {
    loadAllUsers();
  } else if (appId === 'chat') {
    loadChatRooms();
  } else if (appId === 'guestbook') {
    loadGuestbook();
  } else if (appId === 'badges') {
    loadBadges();
  } else if (appId === 'appbuilder') {
    initAppBuilder();
  } else if (appId === 'appbrowser') {
    initAppBrowser();
  }
}

function makeDraggable(winElement) {
  const titlebar = winElement.querySelector(".window-titlebar");
  if (!titlebar) return;
  
  let offset = { x: 0, y: 0 };
  let isDown = false;
  
  titlebar.addEventListener("mousedown", (e) => {
    isDown = true;
    offset.x = e.clientX - winElement.offsetLeft;
    offset.y = e.clientY - winElement.offsetTop;
    titlebar.style.cursor = "grabbing";
  });
  
  document.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    winElement.style.left = (e.clientX - offset.x) + "px";
    winElement.style.top = (e.clientY - offset.y) + "px";
  });
  
  document.addEventListener("mouseup", () => {
    isDown = false;
    titlebar.style.cursor = "grab";
  });
}

function closeWindow(appId) {
  const win = openWindows[appId];
  if (win) {
    win.remove();
    delete openWindows[appId];
  }
  updateTaskbar();
}

function minimizeWindow(appId) {
  const win = openWindows[appId];
  if (win) {
    win.style.display = "none";
  }
  updateTaskbar();
}

function updateTaskbar() {
  const bar = document.getElementById("taskbar-windows");
  if (!bar) return;
  
  bar.innerHTML = Object.keys(openWindows).map(appId => `
    <button class="taskbar-item" onclick="toggleWindow('${appId}')">${appId}</button>
  `).join('');
}

function toggleWindow(appId) {
  const win = openWindows[appId];
  if (!win) return;
  
  if (win.style.display === "none") {
    win.style.display = "flex";
  } else {
    win.style.display = "none";
  }
}

/* ─────────────────────────────────────────────────────
   INIT & STARTUP
   ───────────────────────────────────────────────────── */
async function initBootScreen() {
  const visitorSnap = await getDocs(collection(db, "stats"));
  visitorCount = visitorSnap.size;
  document.getElementById("visitor-count").textContent = visitorCount;
  
  let progress = 0;
  const bar = document.getElementById("boot-bar");
  const status = document.getElementById("boot-status");
  
  const messages = [
    "Loading system files...",
    "Initializing Firestore...",
    "Loading user profiles...",
    "Preparing chat rooms...",
    "Setting up desktop...",
    "Welcome to NetZone 98!"
  ];
  
  for (let i = 0; i < messages.length; i++) {
    progress = (i / messages.length) * 100;
    bar.style.width = progress + "%";
    status.textContent = messages[i];
    await new Promise(r => setTimeout(r, 400));
  }
  
  bar.style.width = "100%";
  status.textContent = "Ready!";
  await new Promise(r => setTimeout(r, 500));
  
  document.getElementById("boot-screen").classList.add("hidden");
  document.getElementById("desktop").classList.remove("hidden");
}

async function initProfileTab() {
  const user = await fsGetUser(currentUser);
  
  document.getElementById("edit-displayname").value = user?.displayName || "";
  document.getElementById("edit-avatar").value = user?.avatar || "👤";
  document.getElementById("edit-bio").value = user?.bio || "";
  document.getElementById("edit-location").value = user?.location || "";
  document.getElementById("edit-mood").value = user?.mood || "😊";
  document.getElementById("edit-song").value = user?.song || "";
  document.getElementById("edit-website").value = user?.website || "";
  document.getElementById("edit-interests").value = user?.interests || "";
  
  await loadProfileView();
  await loadProfilePosts();
}

function updateClock() {
  const clock = document.getElementById("tray-clock");
  if (clock) {
    clock.textContent = new Date().toLocaleTimeString();
  }
}

async function handleLogout() {
  if (!confirm("Log out?")) return;
  await signOut(auth);
  location.reload();
}

function switchAuthTab(tab, element) {
  document.getElementById("login-form").classList.toggle("hidden", tab !== "login");
  document.getElementById("register-form").classList.toggle("hidden", tab !== "register");
  document.getElementById("tab-login").classList.toggle("active", tab === "login");
  document.getElementById("tab-register").classList.toggle("active", tab === "register");
}

function notify(msg) {
  const notif = document.getElementById("notification");
  if (!notif) return;
  notif.textContent = msg;
  notif.classList.remove("hidden");
  setTimeout(() => notif.classList.add("hidden"), 3000);
}

/* ─────────────────────────────────────────────────────
   APP BUILDER (INLINE - EXPANDED)
   ───────────────────────────────────────────────────── */
async function initAppBuilder() {
  const area = document.getElementById("appbuilder-content");
  if (!area) return;
  
  area.innerHTML = `
    <div class="section-title">🛠️ Create New App</div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
      <input class="xp-input" id="app-name" placeholder="App Name (e.g. 'Cool Counter')" />
      <select class="xp-input" id="app-type">
        <option value="counter">🔢 Counter</option>
        <option value="timer">⏱️ Timer</option>
        <option value="notepad">📝 Notepad</option>
        <option value="colorpicker">🎨 Color Picker</option>
        <option value="dice">🎲 Dice Roller</option>
        <option value="todo">✅ Todo List</option>
        <option value="calculator">🧮 Calculator</option>
        <option value="weather">🌤️ Weather</option>
      </select>
    </div>
    <button class="xp-btn primary" onclick="saveUserApp()">📦 Publish App</button>
    <div class="section-title" style="margin-top:16px;">📱 My Published Apps</div>
    <div id="my-apps-list"></div>
  `;
  
  await loadMyPublishedApps();
}

async function saveUserApp() {
  const name = document.getElementById("app-name").value.trim();
  const type = document.getElementById("app-type").value;
  
  if (!name) return notify("⚠️ Name your app!");
  
  const appId = "app_" + Math.random().toString(36).substr(2, 9);
  
  const templates = {
    counter: `<div style="text-align:center; padding:20px;"><div style="font-size:48px; font-weight:bold; margin:20px 0;" id="counter-display">0</div><button onclick="document.getElementById('counter-display').textContent = parseInt(document.getElementById('counter-display').textContent) + 1" class="xp-btn primary">+</button><button onclick="document.getElementById('counter-display').textContent = parseInt(document.getElementById('counter-display').textContent) - 1" class="xp-btn">-</button><button onclick="document.getElementById('counter-display').textContent = 0" class="xp-btn">Reset</button></div>`,
    timer: `<div style="text-align:center; padding:20px;"><div style="font-size:48px; font-family:monospace; margin:20px 0;" id="timer-display">00:00</div><input type="number" id="timer-input" placeholder="Seconds" style="width:100px;" /><button onclick="startTimer()" class="xp-btn primary">Start</button><button onclick="clearInterval(window.timerInterval)" class="xp-btn">Stop</button></div><script>function startTimer() { let s = parseInt(document.getElementById('timer-input').value); window.timerInterval = setInterval(() => { const m = Math.floor(s/60); const ss = s%60; document.getElementById('timer-display').textContent = String(m).padStart(2,'0') + ':' + String(ss).padStart(2,'0'); s--; if(s<0) clearInterval(window.timerInterval); }, 1000); }</script>`,
    notepad: `<textarea id="notepad" style="width:100%; height:300px; padding:8px; font-family:monospace;" placeholder="Start typing..."></textarea><button onclick="const text = document.getElementById('notepad').value; const blob = new Blob([text], {type:'text/plain'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'note.txt'; a.click();" class="xp-btn primary" style="margin-top:8px;">💾 Download Note</button>`,
    colorpicker: `<div style="text-align:center; padding:20px;"><input type="color" id="color-input" value="#ff0000" style="width:100px; height:100px; cursor:pointer;" /><div style="margin-top:16px; padding:20px; background:#ff0000; border:2px solid #000;" id="color-preview"></div><div style="font-family:monospace; margin-top:8px;" id="color-hex">#FF0000</div><button onclick="navigator.clipboard.writeText(document.getElementById('color-hex').textContent); alert('Copied!')" class="xp-btn primary">📋 Copy Hex</button></div><script>document.getElementById('color-input').addEventListener('input', (e) => { document.getElementById('color-preview').style.background = e.target.value; document.getElementById('color-hex').textContent = e.target.value.toUpperCase(); });</script>`,
    dice: `<div style="text-align:center; padding:20px;"><button onclick="const sides = parseInt(document.getElementById('dice-type').value); document.getElementById('dice-result').textContent = Math.floor(Math.random() * sides) + 1;" class="xp-btn primary" style="font-size:20px; padding:20px;">🎲 ROLL</button><div style="font-size:72px; margin:40px 0;" id="dice-result">?</div><select id="dice-type" class="xp-input"><option value="6">6-sided</option><option value="20">20-sided</option><option value="100">100-sided</option></select></div>`,
    todo: `<div style="padding:12px;"><input class="xp-input" id="todo-input" placeholder="Add a task..." style="margin-bottom:8px;" /><button onclick="const inp = document.getElementById('todo-input'); if(inp.value) { if(!window.todos) window.todos=[]; window.todos.push(inp.value); inp.value=''; renderTodos(); }" class="xp-btn primary">Add</button><ul id="todo-list" style="list-style:none; padding:0; margin-top:12px;"></ul></div><script>function renderTodos() { const list = document.getElementById('todo-list'); list.innerHTML = (window.todos||[]).map((t,i) => '<li style="padding:6px; background:#fff; border:1px solid #ccc; margin-bottom:4px;">'+t+' <button onclick="window.todos.splice('+i+',1); renderTodos()" style="float:right;">✕</button></li>').join(''); }</script>`,
    calculator: `<div style="text-align:center; padding:20px;"><input type="text" id="calc-display" style="width:100%; padding:8px; font-size:20px; text-align:right; margin-bottom:8px;" readonly /><div style="display:grid; grid-template-columns:repeat(4,1fr); gap:4px;"><button onclick="appendCalc('7')" class="xp-btn">7</button><button onclick="appendCalc('8')" class="xp-btn">8</button><button onclick="appendCalc('9')" class="xp-btn">9</button><button onclick="appendCalc('/')" class="xp-btn">÷</button><button onclick="appendCalc('4')" class="xp-btn">4</button><button onclick="appendCalc('5')" class="xp-btn">5</button><button onclick="appendCalc('6')" class="xp-btn">6</button><button onclick="appendCalc('*')" class="xp-btn">×</button><button onclick="appendCalc('1')" class="xp-btn">1</button><button onclick="appendCalc('2')" class="xp-btn">2</button><button onclick="appendCalc('3')" class="xp-btn">3</button><button onclick="appendCalc('-')" class="xp-btn">-</button><button onclick="appendCalc('0')" class="xp-btn">0</button><button onclick="appendCalc('.')" class="xp-btn">.</button><button onclick="calculateCalc()" class="xp-btn primary">=</button><button onclick="clearCalc()" class="xp-btn">C</button></div></div><script>function appendCalc(v) { document.getElementById('calc-display').value += v; } function calculateCalc() { try { document.getElementById('calc-display').value = eval(document.getElementById('calc-display').value); } catch(e) {} } function clearCalc() { document.getElementById('calc-display').value = ''; }</script>`,
    weather: `<div style="text-align:center; padding:20px;"><input class="xp-input" id="weather-city" placeholder="Enter city..." style="margin-bottom:8px;" /><button onclick="getWeather()" class="xp-btn primary">🌤️ Get Weather</button><div id="weather-result" style="margin-top:12px; font-size:12px;"></div></div><script>async function getWeather() { const city = document.getElementById('weather-city').value; try { const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=51.5074&longitude=-0.1278&current=temperature_2m,weather_code'); const data = await res.json(); document.getElementById('weather-result').innerHTML = '<div>Temperature: ' + data.current.temperature_2m + '°C</div>'; } catch(e) { document.getElementById('weather-result').innerHTML = '<div style="color:red;">Error fetching weather</div>'; } }</script>`
  };

  const appData = {
    id: appId,
    name,
    type,
    author: currentUser,
    createdAt: new Date().toISOString(),
    code: templates[type] || templates.counter,
    downloads: 0,
    rating: 5
  };
  
  await fsSetUser(currentUser, { publishedApps: arrayUnion(appId) });
  await setDoc(doc(db, "publishedApps", appId), appData);
  
  document.getElementById("app-name").value = "";
  notify("🎉 App published!");
  await loadMyPublishedApps();
  fsAwardBadge(currentUser, "developer");
}

async function loadMyPublishedApps() {
  const user = await fsGetUser(currentUser);
  const appIds = user?.publishedApps || [];
  const list = document.getElementById("my-apps-list");
  
  if (!list) return;
  
  if (!appIds.length) {
    list.innerHTML = "<i style='color:#888;'>No apps published yet.</i>";
    return;
  }
  
  const appCards = await Promise.all(
    appIds.map(async (id) => {
      const appDoc = await getDoc(doc(db, "publishedApps", id));
      if (appDoc.exists()) {
        const app = appDoc.data();
        return `<div class="app-card"><strong>${app.name}</strong> (${app.type}) | 📥 ${app.downloads || 0}<button onclick="deletePublishedApp('${id}')" class="xp-btn danger" style="float:right; font-size:8px;">🗑️</button></div>`;
      }
    })
  );
  
  list.innerHTML = appCards.filter(Boolean).join("");
}

async function deletePublishedApp(appId) {
  if (!confirm("Delete this app?")) return;
  await deleteDoc(doc(db, "publishedApps", appId));
  const user = await fsGetUser(currentUser);
  const apps = (user?.publishedApps || []).filter(id => id !== appId);
  await fsSetUser(currentUser, { publishedApps: apps });
  notify("🗑️ App deleted.");
  await loadMyPublishedApps();
}

/* ─────────────────────────────────────────────────────
   APP BROWSER (INLINE - EXPANDED)
   ───────────────────────────────────────────────────── */
async function initAppBrowser() {
  const area = document.getElementById("appbrowser-content");
  if (!area) return;
  
  area.innerHTML = `
    <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
      <button class="xp-btn primary" onclick="loadAllApps()">🔍 Browse All Apps</button>
      <button class="xp-btn" onclick="loadInstalledApps()">📥 My Installed</button>
      <input class="xp-input" id="search-apps" placeholder="Search..." style="flex:1; min-width:150px;" onkeyup="searchApps()" />
    </div>
    <div id="appbrowser-list"></div>
  `;
  
  await loadAllApps();
}

async function loadAllApps() {
  const list = document.getElementById("appbrowser-list");
  list.innerHTML = "<i style='color:#888;'>Loading...</i>";
  
  const snap = await getDocs(collection(db, "publishedApps"));
  const apps = [];
  snap.forEach(d => apps.push({ id: d.id, ...d.data() }));
  
  if (!apps.length) {
    list.innerHTML = "<div style='color:#888; text-align:center; padding:20px;'>No apps yet!</div>";
    return;
  }
  
  apps.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
  
  list.innerHTML = apps.map(app => `
    <div class="app-browser-card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="flex:1;">
          <div class="app-title">${app.name}</div>
          <div class="app-meta">By ${app.author} • ${app.type} • 📥 ${app.downloads || 0}</div>
        </div>
        <button class="xp-btn primary" onclick="installApp('${app.id}')" style="font-size:9px;">📥</button>
      </div>
    </div>
  `).join("");
}

async function loadInstalledApps() {
  const list = document.getElementById("appbrowser-list");
  const user = await fsGetUser(currentUser);
  const installed = user?.installedApps || [];
  
  if (!installed.length) {
    list.innerHTML = "<div style='color:#888; text-align:center; padding:20px;'>No apps installed.</div>";
    return;
  }
  
  const apps = await Promise.all(installed.map(id => getDoc(doc(db, "publishedApps", id))));
  
  list.innerHTML = apps.map(snap => {
    const app = snap.data();
    return `<div class="app-browser-card"><strong>${app.name}</strong> by ${app.author} <button class="xp-btn" onclick="launchInstalledApp('${snap.id}')" style="float:right; margin-left:4px; font-size:9px;">▶️</button><button class="xp-btn danger" onclick="uninstallApp('${snap.id}')" style="float:right; font-size:9px;">🗑️</button></div>`;
  }).join("");
}

async function installApp(appId) {
  const appDoc = await getDoc(doc(db, "publishedApps", appId));
  if (!appDoc.exists()) return notify("Not found!");
  
  const user = await fsGetUser(currentUser);
  if ((user?.installedApps || []).includes(appId)) return notify("Already installed!");
  
  await fsSetUser(currentUser, { installedApps: arrayUnion(appId) });
  await updateDoc(doc(db, "publishedApps", appId), { downloads: increment(1) });
  
  notify("✅ Installed!");
  fsAwardBadge(currentUser, "developer");
}

async function uninstallApp(appId) {
  if (!confirm("Uninstall?")) return;
  await fsSetUser(currentUser, { installedApps: arrayRemove(appId) });
  notify("🗑️ Uninstalled.");
  await loadInstalledApps();
}

async function launchInstalledApp(appId) {
  const appDoc = await getDoc(doc(db, "publishedApps", appId));
  if (!appDoc.exists()) return;
  
  const app = appDoc.data();
  if (openWindows["appviewer"]) closeWindow("appviewer");
  
  const tpl = document.getElementById("tpl-appviewer");
  const win = tpl.content.cloneNode(true).firstElementChild;
  const layer = document.getElementById("window-layer");
  
  win.style.left = "120px"; win.style.top = "80px"; win.style.zIndex = ++windowZIndex;
  win.style.display = "flex"; win.style.flexDirection = "column";
  
  layer.appendChild(win);
  openWindows["appviewer"] = win;
  makeDraggable(win);
  updateTaskbar();
  
  win.querySelector("#appviewer-title").textContent = "▶️ " + app.name;
  win.querySelector("#appviewer-content").innerHTML = app.code;
}

function searchApps() {
  const q = document.getElementById("search-apps").value.toLowerCase();
  document.querySelectorAll(".app-browser-card").forEach(card => {
    const title = card.querySelector(".app-title")?.textContent.toLowerCase() || "";
    card.style.display = title.includes(q) ? "block" : "none";
  });
}

/* ─────────────────────────────────────────────────────
   CHAT ROOMS
   ───────────────────────────────────────────────────── */
async function loadChatRooms() {
  const snap = await getDocs(collection(db, "rooms"));
  const rooms = snap.docs.map(d => d.id);
  
  const list = document.getElementById("chat-room-list");
  if (!list) return;
  
  list.innerHTML = rooms.map(room => `
    <button class="xp-btn" onclick="joinRoom('${room}')" style="width:100%; text-align:left; margin-bottom:2px;">💬 ${room}</button>
  `).join('');
}

async function createRoom() {
  const name = document.getElementById("new-room-name").value.trim();
  if (!name) return notify("⚠️ Name the room!");
  
  await setDoc(doc(db, "rooms", name), { createdAt: serverTimestamp() });
  document.getElementById("new-room-name").value = "";
  notify("🎉 Room created!");
  await loadChatRooms();
}

/* ─────────────────────────────────────────────────────
   AUTH HANDLERS
   ───────────────────────────────────────────────────── */
async function handleLogin() {
  const user = document.getElementById("login-user").value;
  const pass = document.getElementById("login-pass").value;
  
  if (!user || !pass) return notify("⚠️ Enter credentials!");
  
  try {
    const email = user + "@netzone98.local";
    await signInWithEmailAndPassword(auth, email, pass);
    currentUser = user;
    await fsRecordVisit(user);
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("start-username").textContent = user;
    await initBootScreen();
    updateClock();
    setInterval(updateClock, 1000);
    
    const user_doc = await fsGetUser(currentUser);
    if (user_doc?.desktopBackground) {
      setDesktopBackground(user_doc.desktopBackground);
    }
    
    fsAwardBadge(currentUser, "newbie");
  } catch (err) {
    document.getElementById("login-error").classList.remove("hidden");
    document.getElementById("login-error").textContent = err.message;
  }
}

async function handleRegister() {
  const user = document.getElementById("reg-user").value;
  const pass = document.getElementById("reg-pass").value;
  const email = document.getElementById("reg-email").value;
  const vibe = document.getElementById("reg-vibe").value;
  
  if (!user || !pass || !email) return notify("⚠️ Fill all fields!");
  if (pass.length < 4) return notify("⚠️ Password too short!");
  
  try {
    const userEmail = user + "@netzone98.local";
    await createUserWithEmailAndPassword(auth, userEmail, pass);
    
    const VIBE_ICONS = {
      hacker: "💻", artist: "🎨", gamer: "🎮",
      musician: "🎸", poet: "✍️", random: "🌀"
    };
    
    await fsSetUser(user, {
      avatar: VIBE_ICONS[vibe] || "👤",
      displayName: user,
      bio: "",
      location: "Cyberspace",
      mood: "🎉",
      song: "",
      website: "",
      interests: "",
      joinDate: new Date().toISOString(),
      desktopBackground: "classic",
      profileLayout: "classic"
    });
    
    currentUser = user;
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("start-username").textContent = user;
    await initBootScreen();
    updateClock();
    setInterval(updateClock, 1000);
    fsAwardBadge(currentUser, "newbie");
  } catch (err) {
    document.getElementById("register-error").classList.remove("hidden");
    document.getElementById("register-error").textContent = err.message;
  }
}

function handleGuestLogin() {
  const guestName = "Guest_" + Math.random().toString(36).substr(2, 6).toUpperCase();
  currentUser = guestName;
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("start-username").textContent = guestName;
  initBootScreen();
  updateClock();
  setInterval(updateClock, 1000);
}

/* ─────────────────────────────────────────────────────
   START MENU & MISC
   ───────────────────────────────────────────────────── */
function toggleStartMenu() {
  const menu = document.getElementById("start-menu");
  if (menu) menu.classList.toggle("hidden");
}

/* EXPORT FOR GLOBAL ACCESS */
window.startIconDrag = startIconDrag;
window.openApp = openApp;
window.closeWindow = closeWindow;
window.minimizeWindow = minimizeWindow;
window.toggleWindow = toggleWindow;
window.toggleStartMenu = toggleStartMenu;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleGuestLogin = handleGuestLogin;
window.handleLogout = handleLogout;
window.saveProfile = saveProfile;
window.saveCustomization = saveCustomization;
window.exportProfile = exportProfile;
window.submitPost = submitPost;
window.loadProfilePosts = loadProfilePosts;
window.deletePost = deletePost;
window.loadRandomProfile = loadRandomProfile;
window.loadAllUsers = loadAllUsers;
window.openUserProfile = openUserProfile;
window.signGuestbook = signGuestbook;
window.loadGuestbook = loadGuestbook;
window.submitGuestbookEntry = submitGuestbookEntry;
window.loadBadges = loadBadges;
window.openSettings = openSettings;
window.switchSettingsTab = switchSettingsTab;
window.savePrivacySettings = savePrivacySettings;
window.setDesktopBackground = setDesktopBackground;
window.setCustomBackground = setCustomBackground;
window.applyProfileTheme = applyProfileTheme;
window.initAppBuilder = initAppBuilder;
window.saveUserApp = saveUserApp;
window.loadMyPublishedApps = loadMyPublishedApps;
window.deletePublishedApp = deletePublishedApp;
window.initAppBrowser = initAppBrowser;
window.loadAllApps = loadAllApps;
window.loadInstalledApps = loadInstalledApps;
window.installApp = installApp;
window.uninstallApp = uninstallApp;
window.launchInstalledApp = launchInstalledApp;
window.searchApps = searchApps;
window.joinRoom = joinRoom;
window.loadChatRooms = loadChatRooms;
window.createRoom = createRoom;
window.sendChatMessage = sendChatMessage;
window.sendChatImageMessage = sendChatImageMessage;
window.handleAvatarUpload = handleAvatarUpload;
window.handlePostImageUpload = handlePostImageUpload;
window.handleChatImageUpload = handleChatImageUpload;
window.notify = notify;
window.switchAuthTab = switchAuthTab;
window.loadProfileView = loadProfileView;
