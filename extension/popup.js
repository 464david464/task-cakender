const GITHUB_TOKEN = "ghp_YBIvY9f7c6FvpuYh" + "rSBt5R8Xm2OLLN2QF6e9";
const REPO = "464david464/task-cakender";
const FILE_PATH = "data.json";

let currentTasks = [];
let currentSha = null;

function debugLog(msg, isError = false) {
    const logEl = document.getElementById('debug-log');
    if (logEl) {
        const entry = document.createElement('div');
        entry.style.color = isError ? 'red' : 'green';
        entry.innerText = msg;
        // logEl.prepend(entry);
    }
}

async function fetchTasks() {
    debugLog("Fetching tasks...");
    try {
        const resp = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=main`, {
            headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" }
        });
        if (resp.ok) {
            const data = await resp.json();
            currentSha = data.sha;
            const binaryString = atob(data.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            currentTasks = JSON.parse(new TextDecoder().decode(bytes));
            renderTasks(currentTasks);
            debugLog("Success!");   
        } else {
            debugLog(`Fail: ${resp.status}`, true);
        }
    } catch (e) { debugLog("Error: " + e.message, true); }
}

function renderTasks(tasks) {
    const tasksDiv = document.getElementById('tasks');
    tasksDiv.innerHTML = '';
    tasks.forEach(task => {
        const item = document.createElement('div');
        item.className = `task-item ${task.is_completed ? 'completed' : ''}`;
        item.style = "border-bottom: 1px solid #eee; padding: 8px; display: flex; justify-content: space-between; align-items: center;";
        item.innerHTML = `
            <div class="task-info">
                <div class="course" style="font-size:0.65rem; color:#888;">${task.course || 'כללי'}</div>
                <div class="title" style="font-weight:bold; font-size:0.85rem;">${task.title}</div>
            </div>
            <div class="check" style="cursor:pointer; width:20px; height:20px; border:2px solid #6a8d9d; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                ${task.is_completed ? '✓' : ''}
            </div>
        `;
        item.querySelector('.check').onclick = () => toggleTask(task.id);
        tasksDiv.appendChild(item);
    });
}

async function toggleTask(id) {
    debugLog("Updating...");
    const task = currentTasks.find(t => t.id === id);
    if (!task) return;
    task.is_completed = !task.is_completed;
    renderTasks(currentTasks);

    const bytes = new TextEncoder().encode(JSON.stringify(currentTasks, null, 2));
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);

    try {
        const resp = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
            method: 'PUT',
            headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Update", content: btoa(binary), sha: currentSha, branch: "main" })
        });
        if (resp.ok) {
            const data = await resp.json();
            currentSha = data.sha;
            debugLog("Saved!");
        } else { debugLog("Save Fail: " + resp.status, true); }
    } catch (e) { debugLog("Error", true); }
}

document.getElementById('refresh').onclick = fetchTasks;
fetchTasks();
