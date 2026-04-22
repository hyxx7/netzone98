/* =====================================================
   NETZONE 98 — APP BROWSER / MARKETPLACE
   Browse, Download, and Manage Apps
   ===================================================== */

import { getFirestore, doc, getDoc, setDoc, updateDoc,
         deleteDoc, addDoc, getDocs, onSnapshot,
         collection, query, orderBy, limit,
         serverTimestamp, arrayUnion, increment, arrayRemove }   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = getFirestore();

async function initAppBrowser() {
  const area = document.getElementById("appbrowser-content");
  if (!area) return;
  
  area.innerHTML = `
    <div style="display:flex; gap:8px; margin-bottom:12px;">
      <button class="xp-btn primary" onclick="loadAllApps()">🔍 Browse All Apps</button>
      <button class="xp-btn" onclick="loadInstalledApps()">📥 My Installed</button>
      <input class="xp-input" id="search-apps" placeholder="Search apps..." style="flex:1;" onkeyup="searchApps()" />
    </div>
    <div id="appbrowser-list"></div>
  `;
  
  await loadAllApps();
}

async function loadAllApps() {
  const list = document.getElementById("appbrowser-list");
  list.innerHTML = "<i style='color:#888;'>Loading apps...</i>";
  
  const snap = await getDocs(collection(db, "publishedApps"));
  const apps = [];
  snap.forEach(d => apps.push({ id: d.id, ...d.data() }));
  
  if (!apps.length) {
    list.innerHTML = "<div style='color:#888; text-align:center; padding:20px;'>No apps yet. Be the first to publish!</div>";
    return;
  }
  
  apps.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
  
  list.innerHTML = apps.map(app => `
    <div class="app-browser-card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="flex:1;">
          <div class="app-title">${app.name}</div>
          <div class="app-meta">By <strong>${app.author}</strong> • Type: ${app.type}</div>
          <div class="app-meta">⭐ ${app.rating || 5} • 📥 ${app.downloads || 0} downloads</div>
        </div>
        <button class="xp-btn primary" onclick="installApp('${app.id}')">📥 Install</button>
      </div>
    </div>
  `).join("");
}

async function loadInstalledApps() {
  const list = document.getElementById("appbrowser-list");
  const user = await fsGetUser(currentUser);
  const installed = user?.installedApps || [];
  
  if (!installed.length) {
    list.innerHTML = "<div style='color:#888; text-align:center; padding:20px;'>No apps installed yet.</div>";
    return;
  }
  
  const apps = await Promise.all(
    installed.map(id => getDoc(doc(db, "publishedApps", id)))
  );
  
  list.innerHTML = apps.map(snap => {
    const app = snap.data();
    return `
      <div class="app-browser-card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div class="app-title">${app.name}</div>
            <div class="app-meta">By ${app.author}</div>
          </div>
          <div style="display:flex; gap:4px;">
            <button class="xp-btn" onclick="launchInstalledApp('${snap.id}')">▶️ Launch</button>
            <button class="xp-btn danger" onclick="uninstallApp('${snap.id}')">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function installApp(appId) {
  const appDoc = await getDoc(doc(db, "publishedApps", appId));
  if (!appDoc.exists()) return notify("App not found!");
  
  const user = await fsGetUser(currentUser);
  const installed = user?.installedApps || [];
  
  if (installed.includes(appId)) return notify("⚠️ Already installed!");
  
  await fsSetUser(currentUser, {
    installedApps: arrayUnion(appId)
  });
  
  await updateDoc(doc(db, "publishedApps", appId), {
    downloads: increment(1)
  });
  
  notify("✅ App installed! Check 'My Installed'");
  fsAwardBadge(currentUser, "developer");
}

async function uninstallApp(appId) {
  if (!confirm("Uninstall this app?")) return;
  
  await fsSetUser(currentUser, {
    installedApps: arrayRemove(appId)
  });
  
  notify("🗑️ App uninstalled.");
  await loadInstalledApps();
}

async function launchInstalledApp(appId) {
  const appDoc = await getDoc(doc(db, "publishedApps", appId));
  if (!appDoc.exists()) return notify("App not found!");
  
  const app = appDoc.data();
  
  if (openWindows["appviewer"]) closeWindow("appviewer");
  
  const tpl = document.getElementById("tpl-appviewer");
  const win = tpl.content.cloneNode(true).firstElementChild;
  const layer = document.getElementById("window-layer");
  
  win.style.left = "120px";
  win.style.top = "80px";
  win.style.zIndex = ++windowZIndex;
  win.style.display = "flex";
  win.style.flexDirection = "column";
  
  layer.appendChild(win);
  openWindows["appviewer"] = win;
  makeDraggable(win);
  updateTaskbar();
  
  win.querySelector("#appviewer-title").textContent = "▶️ " + app.name;
  win.querySelector("#appviewer-content").innerHTML = app.code;
}

function searchApps() {
  const query = document.getElementById("search-apps").value.toLowerCase();
  const cards = document.querySelectorAll(".app-browser-card");
  cards.forEach(card => {
    const title = card.querySelector(".app-title").textContent.toLowerCase();
    card.style.display = title.includes(query) ? "block" : "none";
  });
}

window.initAppBrowser = initAppBrowser;
window.loadAllApps = loadAllApps;
window.loadInstalledApps = loadInstalledApps;
window.installApp = installApp;
window.uninstallApp = uninstallApp;
window.launchInstalledApp = launchInstalledApp;
window.searchApps = searchApps;
