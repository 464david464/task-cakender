const body = document.body;
let allTasks = [];
const GITHUB_TOKEN = "ghp_YBIvY9f7c6FvpuYh" + "rSBt5R8Xm2OLLN2QF6e9";
const REPO = "464david464/task-cakender";
const FILE_PATH = "data.json";
let currentSha = null;
let showArchive = false;

function updateStatus(msg, isError = false) {
    const el = document.getElementById('debug-status');
    if (el) {
        el.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
        el.style.color = isError ? '#f00' : '#0f0';
    }
    console.log(msg);
}

const applyTheme = (theme) => {
    body.dataset.theme = theme;
    localStorage.setItem('dashboard-theme', theme);
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.innerText = theme === 'day' ? '🌙' : '☀️';
};

async function fetchTasks() {
    updateStatus("Fetching data...");
    try {
        const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=main&t=${new Date().getTime()}`;
        const resp = await fetch(url, {
            headers: { 
                "Authorization": `token ${GITHUB_TOKEN}`,
                "Accept": "application/vnd.github.v3+json"
            }
        });
        
        if (resp.ok) {
            const data = await resp.json();
            currentSha = data.sha;
            const binaryString = atob(data.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            allTasks = JSON.parse(new TextDecoder().decode(bytes));
            
            const completedCount = allTasks.filter(t => t.is_completed).length;
            updateStatus(`Success: ${allTasks.length} tasks loaded (${completedCount} completed).`);
            renderDashboard();
        } else {
            updateStatus(`Fetch Error: ${resp.status} ${resp.statusText}`, true);
        }
    } catch (e) { 
        updateStatus(`Connection Error: ${e.message}`, true);
    }
}

async function toggleTask(id) {
    updateStatus(`Updating task ${id.substring(0,5)}...`);
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    
    task.is_completed = !task.is_completed;
    task.completed_at = task.is_completed ? new Date().toISOString() : null;
    renderDashboard();

    try {
        const getResp = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=main`, {
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
            body: JSON.stringify({ message: "Sync", content: btoa(binary), sha: currentSha, branch: "main" })
        });
        
        if (putResp.ok) {
            updateStatus("Saved successfully to GitHub.");
            const resData = await putResp.json();
            currentSha = resData.content.sha;
        } else {
            updateStatus(`Save failed: ${putResp.status}`, true);
        }
    } catch (e) { updateStatus(`Save Error: ${e.message}`, true); fetchTasks(); }
}

function getTimeRemaining(dueDate) {
    const total = Date.parse(dueDate) - Date.parse(new Date());
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    return days < 0 ? "עבר המועד" : (days === 0 ? "היום!" : `עוד ${days} ימים`);
}

function renderDashboard() {
    const tasksGridEl = document.getElementById('tasks-grid');
    const archiveContainer = document.getElementById('archive-container');
    const archiveBtn = document.getElementById('archive-toggle-btn');
    if (!tasksGridEl) return;

    tasksGridEl.innerHTML = '';
    const now = new Date();
    
    // Logic for hiding/showing completed tasks (20 min rule)
    const activeTasks = allTasks.filter(t => {
        if (!t.is_completed) return true;
        if (!t.completed_at) return false;
        return (now - new Date(t.completed_at)) / (1000 * 60) < 20;
    });

    const completedTasks = allTasks.filter(t => t.is_completed);
    const tasksToRender = showArchive ? allTasks : activeTasks;

    // Render Hero
    const nextTask = activeTasks.find(t => !t.is_completed) || activeTasks[0];
    const heroEl = document.getElementById('next-mission');
    if (heroEl && nextTask) {
        heroEl.innerHTML = `
            <div class="course-label"><span>${nextTask.course || 'כללי'}</span></div>
            <div class="hero-title">${nextTask.title}</div>
            <div class="hero-countdown">${getTimeRemaining(nextTask.due_date)}</div>
            <div class="check hero-check" style="cursor:pointer; width:40px; height:40px; border:3px solid white; border-radius:50%; display:flex; align-items:center; justify-content:center; margin: 10px auto;">
                ${nextTask.is_completed ? '✓' : ''}
            </div>
        `;
        heroEl.querySelector('.hero-check').onclick = () => toggleTask(nextTask.id);
    }

    // Render Grid
    tasksToRender.forEach(task => {
        const item = document.createElement('div');
        item.className = `task-item ${task.is_completed ? 'completed' : ''} track-${task.track || 'general'}`;
        item.innerHTML = `
            <div class="course-label">
                <span>${task.course || 'כללי'}</span>
                <div class="check" style="cursor:pointer; width:24px; height:24px; border:2px solid #6a8d9d; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                    ${task.is_completed ? '✓' : ''}
                </div>
            </div>
            <h4>${task.title}</h4>
            <div class="task-footer"><span>${getTimeRemaining(task.due_date)}</span></div>
        `;
        item.querySelector('.check').onclick = (e) => { e.stopPropagation(); toggleTask(task.id); };
        tasksGridEl.appendChild(item);
    });

    // Handle Archive Button
    if (completedTasks.length > 0) {
        archiveContainer.style.display = 'block';
        archiveBtn.innerText = showArchive ? "הסתר משימות שהושלמו" : `הצג משימות שהושלמו (${completedTasks.length})`;
        archiveBtn.onclick = () => { showArchive = !showArchive; renderDashboard(); };
    } else {
        archiveContainer.style.display = 'none';
    }
}

// Init
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.onclick = () => {
        const currentTheme = body.dataset.theme === 'day' ? 'night' : 'day';
        applyTheme(currentTheme);
    };
}

const savedTheme = localStorage.getItem('dashboard-theme') || 'day';
applyTheme(savedTheme);
fetchTasks();
setInterval(fetchTasks, 30 * 1000); 
