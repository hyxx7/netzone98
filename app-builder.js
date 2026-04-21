/* =====================================================
   NETZONE 98 — APP BUILDER
   Create and Share Custom Mini Apps
   ===================================================== */

const ALL_USER_APPS = {};

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
        <option value="custom">💻 Custom HTML</option>
      </select>
    </div>
    
    <div id="app-config-area"></div>
    
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
  const appData = {
    id: appId,
    name,
    type,
    author: currentUser,
    createdAt: new Date().toISOString(),
    code: buildAppCode(type, name),
    downloads: 0,
    rating: 5
  };
  
  await fsSetUser(currentUser, {
    publishedApps: arrayUnion(appId)
  });
  
  await setDoc(doc(db, "publishedApps", appId), appData);
  
  document.getElementById("app-name").value = "";
  notify("🎉 App published! Others can download it now.");
  await loadMyPublishedApps();
  fsAwardBadge(currentUser, "developer");
}

function buildAppCode(type, name) {
  const templates = {
    counter: `
      <div style="text-align:center; padding:20px;">
        <div style="font-size:48px; font-weight:bold; margin:20px 0;" id="counter-display">0</div>
        <button onclick="increaseCounter()" class="xp-btn primary">+</button>
        <button onclick="decreaseCounter()" class="xp-btn">-</button>
        <button onclick="resetCounter()" class="xp-btn">Reset</button>
      </div>
      <script>
        let count = 0;
        function increaseCounter() { count++; document.getElementById('counter-display').textContent = count; }
        function decreaseCounter() { count--; document.getElementById('counter-display').textContent = count; }
        function resetCounter() { count = 0; document.getElementById('counter-display').textContent = count; }
      </script>
    `,
    timer: `
      <div style="text-align:center; padding:20px;">
        <div style="font-size:48px; font-family:monospace; margin:20px 0;" id="timer-display">00:00</div>
        <input type="number" id="timer-input" placeholder="Seconds" style="width:100px;" />
        <button onclick="startTimer()" class="xp-btn primary">Start</button>
        <button onclick="stopTimer()" class="xp-btn">Stop</button>
      </div>
      <script>
        let timerInterval = null;
        let timerSeconds = 0;
        function startTimer() {
          timerSeconds = parseInt(document.getElementById('timer-input').value) || 0;
          timerInterval = setInterval(() => {
            timerSeconds--;
            const min = Math.floor(timerSeconds / 60);
            const sec = timerSeconds % 60;
            document.getElementById('timer-display').textContent = 
              String(min).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
            if (timerSeconds <= 0) stopTimer();
          }, 1000);
        }
        function stopTimer() { clearInterval(timerInterval); }
      </script>
    `,
    notepad: `
      <textarea id="notepad" style="width:100%; height:300px; padding:8px; font-family:monospace;" 
        placeholder="Start typing..."></textarea>
      <button onclick="downloadNote()" class="xp-btn primary" style="margin-top:8px;">💾 Download Note</button>
      <script>
        function downloadNote() {
          const text = document.getElementById('notepad').value;
          const blob = new Blob([text], {type:'text/plain'});
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'note.txt';
          a.click();
        }
      </script>
    `,
    colorpicker: `
      <div style="text-align:center; padding:20px;">
        <input type="color" id="color-input" value="#ff0000" style="width:100px; height:100px; cursor:pointer;" />
        <div style="margin-top:16px; padding:20px; background:#ff0000; border:2px solid #000;" id="color-preview">
        </div>
        <div style="font-family:monospace; margin-top:8px;" id="color-hex">#FF0000</div>
        <button onclick="copyColor()" class="xp-btn primary">📋 Copy Hex</button>
      </div>
      <script>
        const input = document.getElementById('color-input');
        input.addEventListener('input', (e) => {
          document.getElementById('color-preview').style.background = e.target.value;
          document.getElementById('color-hex').textContent = e.target.value.toUpperCase();
        });
        function copyColor() {
          const hex = document.getElementById('color-hex').textContent;
          navigator.clipboard.writeText(hex);
          alert('Copied: ' + hex);
        }
      </script>
    `,
    dice: `
      <div style="text-align:center; padding:20px;">
        <button onclick="rollDice()" class="xp-btn primary" style="font-size:20px; padding:20px;">🎲 ROLL</button>
        <div style="font-size:72px; margin:40px 0;" id="dice-result">?</div>
        <select id="dice-type" class="xp-input">
          <option value="6">6-sided</option>
          <option value="20">20-sided (D&D)</option>
          <option value="100">100-sided</option>
        </select>
      </div>
      <script>
        function rollDice() {
          const sides = parseInt(document.getElementById('dice-type').value);
          const result = Math.floor(Math.random() * sides) + 1;
          document.getElementById('dice-result').textContent = result;
        }
      </script>
    `,
    todo: `
      <div style="padding:12px;">
        <input class="xp-input" id="todo-input" placeholder="Add a task..." style="margin-bottom:8px;" />
        <button onclick="addTodo()" class="xp-btn primary">Add</button>
        <ul id="todo-list" style="list-style:none; padding:0; margin-top:12px;"></ul>
      </div>
      <script>
        const todos = [];
        function addTodo() {
          const input = document.getElementById('todo-input');
          if (input.value) {
            todos.push(input.value);
            input.value = '';
            renderTodos();
          }
        }
        function renderTodos() {
          const list = document.getElementById('todo-list');
          list.innerHTML = todos.map((t, i) => 
            '<li style="padding:6px; background:#fff; border:1px solid #ccc; margin-bottom:4px;">' +
            t + ' <button onclick="deleteTodo(' + i + ')" style="float:right;">✕</button></li>'
          ).join('');
        }
        function deleteTodo(i) { todos.splice(i, 1); renderTodos(); }
      </script>
    `,
    custom: `<div style="padding:12px; text-align:center;">
      <p>Edit the HTML code in the App Browser to customize!</p>
      <p>Replace this with your own code.</p>
    </div>`
  };
  
  return templates[type] || templates.custom;
}

async function loadMyPublishedApps() {
  const user = await fsGetUser(currentUser);
  const appIds = user?.publishedApps || [];
  const list = document.getElementById("my-apps-list");
  
  if (!appIds.length) {
    list.innerHTML = "<i style='color:#888;'>No apps published yet.</i>";
    return;
  }
  
  const appCards = await Promise.all(
    appIds.map(async (id) => {
      const app = await getDoc(doc(db, "publishedApps", id));
      if (app.exists()) {
        return buildAppCard(id, app.data());
      }
    })
  );
  
  list.innerHTML = appCards.filter(Boolean).join("");
}

function buildAppCard(appId, app) {
  return `
    <div class="app-card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong>${app.name}</strong>
          <div style="font-size:10px; color:#666;">Type: ${app.type} | Downloads: ${app.downloads || 0}</div>
        </div>
        <button onclick="deletePublishedApp('${appId}')" class="xp-btn danger">🗑️</button>
      </div>
    </div>
  `;
}

async function deletePublishedApp(appId) {
  if (!confirm("Delete this app?")) return;
  await deleteDoc(doc(db, "publishedApps", appId));
  await fsSetUser(currentUser, {
    publishedApps: arrayRemove(appId)
  });
  notify("🗑️ App deleted.");
  await loadMyPublishedApps();
}

window.initAppBuilder = initAppBuilder;
window.saveUserApp = saveUserApp;
window.deletePublishedApp = deletePublishedApp;
