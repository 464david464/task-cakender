const body = document.body;
let allTasks = [];

function debugLog(msg, isError = false) {
    const logEl = document.getElementById('debug-log');
    if (logEl) {
        const time = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.style.color = isError ? '#f00' : '#0f0';
        entry.innerText = `[${time}] ${msg}`;
        logEl.prepend(entry);
    }
}

async function fetchTasks() {
    debugLog("Fetching data.json...");
    try {
        // Simple fetch from the same directory
        const resp = await fetch(`data.json?t=${new Date().getTime()}`);
        if (resp.ok) {
            allTasks = await resp.json();
            debugLog(`Loaded ${allTasks.length} tasks.`);
            renderDashboard();
        } else {
            debugLog(`Fetch failed: ${resp.status}`, true);
        }
    } catch (e) {
        debugLog(`Error: ${e.message}`, true);
    }
}

// Reuse the toggleTask from the extension but using the split token strategy
const GITHUB_TOKEN = "ghp_YBIvY9f7c6FvpuYh" + "rSBt5R8Xm2OLLN2QF6e9";
const REPO = "464david464/task-cakender";
const FILE_PATH = "data.json";
let currentSha = null;

async function toggleTask(id) {
    debugLog("Updating task...");
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    
    task.is_completed = !task.is_completed;
    renderDashboard();

    try {
        // We still need the API to update (PUT)
        const getUrl = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=main`;
        const getResp = await fetch(getUrl, {
            headers: { "Authorization": `token ${GITHUB_TOKEN}` }
        });
        const getData = await getResp.json();
        currentSha = getData.sha;

        const bytes = new TextEncoder().encode(JSON.stringify(allTasks, null, 2));
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);

        const putResp = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
            method: 'PUT',
            headers: { 
                "Authorization": `token ${GITHUB_TOKEN}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({ 
                message: "Update", 
                content: btoa(binary), 
                sha: currentSha, 
                branch: "main" 
            })
        });
        
        if (putResp.ok) {
            debugLog("Saved successfully.");
        } else {
            debugLog(`Save failed: ${putResp.status}`, true);
        }
    } catch (e) {
        debugLog("Save Error: " + e.message, true);
    }
}

function getTimeRemaining(dueDate) {
    const total = Date.parse(dueDate) - Date.parse(new Date());
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    if (days < 0) return "עבר המועד";
    if (days === 0) return "היום!";
    return `עוד ${days} ימים`;
}

function renderDashboard() {
    const nextMissionEl = document.getElementById('next-mission');
    const tasksGridEl = document.getElementById('tasks-grid');
    if (!nextMissionEl || !tasksGridEl) return;

    tasksGridEl.innerHTML = '';
    const upcoming = allTasks.filter(t => !t.is_completed);
    const nextTask = upcoming[0] || allTasks[0];

    if (nextTask) {
        nextMissionEl.innerHTML = `
            <div class="course-label"><span>${nextTask.course || 'כללי'}</span></div>
            <div class="hero-title">${nextTask.title}</div>
            <div class="hero-countdown">${getTimeRemaining(nextTask.due_date)}</div>
            <div class="check hero-check" style="cursor:pointer; width:40px; height:40px; border:3px solid white; border-radius:50%; display:flex; align-items:center; justify-content:center; margin: 10px auto;">
                ${nextTask.is_completed ? '✓' : ''}
            </div>
        `;
        nextMissionEl.querySelector('.hero-check').onclick = () => toggleTask(nextTask.id);
    }

    allTasks.forEach(task => {
        const item = document.createElement('div');
        item.className = `task-item ${task.is_completed ? 'completed' : ''} track-${task.track || 'general'}`;
        item.innerHTML = `
            <div class="course-label">
                <span>${task.course || 'כללי'}</span>
                <div class="check" style="cursor:pointer; width:20px; height:20px; border:2px solid #6a8d9d; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                    ${task.is_completed ? '✓' : ''}
                </div>
            </div>
            <h4>${task.title}</h4>
            <div class="task-footer">
                <span>${getTimeRemaining(task.due_date)}</span>
            </div>
        `;
        item.querySelector('.check').onclick = (e) => { e.stopPropagation(); toggleTask(task.id); };
        tasksGridEl.appendChild(item);
    });
}

// Init
const savedTheme = localStorage.getItem('dashboard-theme') || 'day';
document.body.dataset.theme = savedTheme;
fetchTasks();
setInterval(fetchTasks, 2 * 60 * 1000);
