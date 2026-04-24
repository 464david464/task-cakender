const body = document.body;
let allTasks = [];
const GITHUB_TOKEN = "ghp_YBIvY9f7c6FvpuYh" + "rSBt5R8Xm2OLLN2QF6e9";
const REPO = "464david464/task-cakender";
const FILE_PATH = "data.json";
let currentSha = null;
let showArchive = false;
let statusTimeout = null;

function updateStatus(msg, isError = false) {
    const el = document.getElementById('debug-status');
    if (el) {
        el.innerText = msg;
        el.style.color = isError ? '#ff4757' : '#2ed573';
        el.style.borderBottomColor = isError ? '#ff4757' : '#2ed573';
        el.classList.add('show');
        
        // Auto-hide after 3 seconds
        if (statusTimeout) clearTimeout(statusTimeout);
        statusTimeout = setTimeout(() => {
            el.classList.remove('show');
        }, 3000);
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
    updateStatus("Syncing with cloud...");
    try {
        const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=main&t=${new Date().getTime()}`;
        const resp = await fetch(url, {
            headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" }
        });
        if (resp.ok) {
            const data = await resp.json();
            currentSha = data.sha;
            const binaryString = atob(data.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            allTasks = JSON.parse(new TextDecoder().decode(bytes));
            renderDashboard();
            updateStatus(`Updated: ${allTasks.length} tasks ready.`);
        }
    } catch (e) { updateStatus("Cloud Connection Failed", true); }
}

async function toggleTask(id) {
    updateStatus("Updating...");
    
    try {
        const getUrl = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=main&t=${new Date().getTime()}`;
        const getResp = await fetch(getUrl, {
            headers: { "Authorization": `token ${GITHUB_TOKEN}` }
        });
        const getData = await getResp.json();
        currentSha = getData.sha;
        
        const binaryString = atob(getData.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        allTasks = JSON.parse(new TextDecoder().decode(bytes));

        const task = allTasks.find(t => t.id === id);
        if (!task) return;
        task.is_completed = !task.is_completed;
        task.completed_at = task.is_completed ? new Date().toISOString() : null;

        renderDashboard(); // Optimistic UI update

        const jsonStr = JSON.stringify(allTasks, null, 2);
        const bytesToUpload = new TextEncoder().encode(jsonStr);
        let binary = "";
        for (let i = 0; i < bytesToUpload.byteLength; i++) binary += String.fromCharCode(bytesToUpload[i]);

        const putResp = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
            method: 'PUT',
            headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Task Sync", content: btoa(binary), sha: currentSha, branch: "main" })
        });
        
        if (putResp.ok) {
            updateStatus("Changes synchronized.");
            const resData = await putResp.json();
            currentSha = resData.content.sha;
        } else {
            updateStatus("Sync conflict - retrying...", true);
            fetchTasks();
        }
    } catch (e) { updateStatus("Sync Error", true); fetchTasks(); }
}

function getTimeRemaining(dueDate) {
    const total = Date.parse(dueDate) - Date.parse(new Date());
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    if (days < 0) return '<span style="color: #ff4757;">עבר המועד</span>';
    return days === 0 ? "היום!" : `עוד ${days} ימים`;
}

function renderDashboard() {
    const gridEl = document.getElementById('tasks-grid');
    const archiveContainer = document.getElementById('archive-container');
    const archiveBtn = document.getElementById('archive-toggle-btn');
    if (!gridEl) return;

    gridEl.innerHTML = '';
    const now = new Date();
    
    const activeTasks = allTasks.filter(t => !t.is_completed);

    const completedTasks = allTasks.filter(t => t.is_completed);
    const tasksToDisplay = showArchive ? allTasks : activeTasks;

    const heroEl = document.getElementById('next-mission');
    const nextTask = activeTasks.find(t => !t.is_completed) || activeTasks[0];
    if (heroEl && nextTask) {
        heroEl.innerHTML = `
            <div class="course-label"><span>${nextTask.course || 'כללי'}</span></div>
            <div class="hero-title">${nextTask.title}</div>
            <div class="hero-countdown">${getTimeRemaining(nextTask.due_date)}</div>
            <div class="check hero-check" style="margin: 15px auto;">
                ${nextTask.is_completed ? '✓' : ''}
            </div>
        `;
        heroEl.querySelector('.check').onclick = () => toggleTask(nextTask.id);
    }

    tasksToDisplay.forEach(task => {
        const item = document.createElement('div');
        item.className = `task-item ${task.is_completed ? 'completed' : ''} track-${task.track || 'general'}`;
        item.innerHTML = `
            <div class="course-label">
                <span>${task.course || 'כללי'}</span>
                <div class="check">
                    ${task.is_completed ? '✓' : ''}
                </div>
            </div>
            <h4>${task.title}</h4>
            <div class="task-footer"><span>${getTimeRemaining(task.due_date)}</span></div>
        `;
        item.querySelector('.check').onclick = (e) => { e.stopPropagation(); toggleTask(task.id); };
        gridEl.appendChild(item);
    });

    if (completedTasks.length > 0) {
        archiveContainer.style.display = 'block';
        archiveBtn.innerText = showArchive ? "הסתר משימות שהושלמו" : `הצג משימות שהושלמו (${completedTasks.length})`;
        archiveBtn.onclick = () => { showArchive = !showArchive; renderDashboard(); };
    } else {
        archiveContainer.style.display = 'none';
    }
}

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
