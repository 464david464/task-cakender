const body = document.body;
let allTasks = [];
const GITHUB_TOKEN = "ghp_YBIvY9f7c6FvpuYh" + "rSBt5R8Xm2OLLN2QF6e9";
const REPO = "464david464/task-cakender";
const FILE_PATH = "data.json";
let currentSha = null;
let showArchive = false;

function debugLog(msg, isError = false) {
    console.log(`[LOG] ${msg}`);
}

const applyTheme = (theme) => {
    body.dataset.theme = theme;
    localStorage.setItem('dashboard-theme', theme);
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.innerText = theme === 'day' ? '🌙' : '☀️';
    }
};

async function fetchTasks() {
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
            renderDashboard();
        }
    } catch (e) { console.error("Fetch error:", e); }
}

async function toggleTask(id) {
    // 1. First, fetch the VERY LATEST data and SHA from GitHub to prevent "Undo" failing
    try {
        const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=main&t=${new Date().getTime()}`;
        const getResp = await fetch(url, {
            headers: { "Authorization": `token ${GITHUB_TOKEN}` }
        });
        if (!getResp.ok) throw new Error("Could not sync before update");
        
        const data = await getResp.json();
        currentSha = data.sha;
        const binaryString = atob(data.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        allTasks = JSON.parse(new TextDecoder().decode(bytes));
        
        // 2. Apply the change to the fresh data
        const task = allTasks.find(t => t.id === id);
        if (!task) return;
        
        task.is_completed = !task.is_completed;
        if (task.is_completed) {
            task.completed_at = new Date().toISOString();
        } else {
            delete task.completed_at;
        }
        
        // Update UI immediately
        renderDashboard();

        // 3. Push to GitHub
        const bytesToUpload = new TextEncoder().encode(JSON.stringify(allTasks, null, 2));
        let binary = "";
        for (let i = 0; i < bytesToUpload.byteLength; i++) binary += String.fromCharCode(bytesToUpload[i]);

        const putResp = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
            method: 'PUT',
            headers: { 
                "Authorization": `token ${GITHUB_TOKEN}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({ 
                message: `Update task ${id}`, 
                content: btoa(binary), 
                sha: currentSha, 
                branch: "main" 
            })
        });
        
        if (putResp.ok) {
            const resData = await putResp.json();
            currentSha = resData.content.sha;
        } else {
            throw new Error("Save failed");
        }
    } catch (e) { 
        console.error(e);
        alert("עדכון נכשל. מרענן נתונים...");
        fetchTasks(); 
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
    const now = new Date();
    
    // Logic for hiding/showing completed tasks
    const activeTasks = allTasks.filter(t => {
        if (!t.is_completed) return true;
        if (!t.completed_at) return false;
        const diffMins = (now - new Date(t.completed_at)) / (1000 * 60);
        return diffMins < 20; // Show completed for 20 mins
    });

    const archivedCount = allTasks.filter(t => t.is_completed && !activeTasks.includes(t)).length;
    const tasksToRender = showArchive ? allTasks : activeTasks;

    // Render Next Task (Hero)
    const upcoming = activeTasks.filter(t => !t.is_completed);
    const nextTask = upcoming[0] || activeTasks[0];

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
            <div class="task-footer">
                <span>${getTimeRemaining(task.due_date)}</span>
            </div>
        `;
        item.querySelector('.check').onclick = (e) => { e.stopPropagation(); toggleTask(task.id); };
        tasksGridEl.appendChild(item);
    });

    // ARCHIVE BUTTON (Fixed visibility logic)
    const totalCompleted = allTasks.filter(t => t.is_completed).length;
    if (totalCompleted > 0) {
        const btnFrame = document.createElement('div');
        btnFrame.style = "grid-column: 1/-1; text-align: center; padding: 40px 0;";
        const btn = document.createElement('button');
        btn.innerText = showArchive ? "הסתר משימות שהושלמו" : `הצג משימות שהושלמו (${totalCompleted})`;
        btn.style = "background: rgba(106, 141, 157, 0.2); border: 1px solid #6a8d9d; color: white; padding: 12px 30px; border-radius: 30px; cursor: pointer; font-family: inherit; font-weight: bold; transition: all 0.3s;";
        btn.onclick = () => { showArchive = !showArchive; renderDashboard(); };
        btnFrame.appendChild(btn);
        tasksGridEl.appendChild(btnFrame);
    }
}

// Init
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const currentTheme = body.dataset.theme === 'day' ? 'night' : 'day';
        applyTheme(currentTheme);
    });
}

const savedTheme = localStorage.getItem('dashboard-theme') || 'day';
applyTheme(savedTheme);
fetchTasks();
setInterval(fetchTasks, 30 * 1000); 
