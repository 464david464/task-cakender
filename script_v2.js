const body = document.body;
let allTasks = [];
const GITHUB_TOKEN = "ghp_YBIvY9f7c6FvpuYh" + "rSBt5R8Xm2OLLN2QF6e9";
const REPO = "464david464/task-cakender";
const FILE_PATH = "data.json";
let currentSha = null;

function debugLog(msg, isError = false) {
    // Disabled for clean UI
    console.log(msg);
}

const applyTheme = (theme) => {
    body.dataset.theme = theme;
    localStorage.setItem('dashboard-theme', theme);
};

async function fetchTasks() {
    debugLog("Fetching from Live API...");
    try {
        // Fetching from API instead of static file to get INSTANT updates
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
            
            debugLog(`Sync OK. ${allTasks.length} tasks.`);
            renderDashboard();
        } else {
            debugLog(`Fetch failed: ${resp.status}`, true);
        }
    } catch (e) {
        debugLog(`Error: ${e.message}`, true);
    }
}

async function toggleTask(id) {
    debugLog("Updating...");
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    
    task.is_completed = !task.is_completed;
    renderDashboard();

    try {
        // Always get fresh SHA before update
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
            body: JSON.stringify({ 
                message: "Sync from Tablet", 
                content: btoa(binary), 
                sha: currentSha, 
                branch: "main" 
            })
        });
        
        if (putResp.ok) {
            debugLog("Saved.");
            const resData = await putResp.json();
            currentSha = resData.content.sha;
        }
    } catch (e) {
        debugLog("Save failed", true);
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
}

// Theme Logic
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const currentTheme = body.dataset.theme === 'day' ? 'night' : 'day';
        applyTheme(currentTheme);
    });
}

const savedTheme = localStorage.getItem('dashboard-theme') || 'day';
document.body.dataset.theme = savedTheme;
fetchTasks();
setInterval(fetchTasks, 30 * 1000); // Check every 30 seconds for live sync
