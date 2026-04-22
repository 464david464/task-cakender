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
}

async function fetchTasks() {
    updateStatus("Syncing...");
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
            updateStatus(`Online: ${allTasks.length} tasks.`);
        }
    } catch (e) { updateStatus("Connection Error", true); }
}

async function toggleTask(id) {
    updateStatus("Saving change...");
    
    try {
        // 1. Force a fresh fetch to get the absolute latest SHA (Prevents 409 Error)
        const getUrl = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=main&t=${new Date().getTime()}`;
        const getResp = await fetch(getUrl, {
            headers: { "Authorization": `token ${GITHUB_TOKEN}` }
        });
        const getData = await getResp.json();
        currentSha = getData.sha; // Get the MUST-HAVE current SHA
        
        const binaryString = atob(getData.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        allTasks = JSON.parse(new TextDecoder().decode(bytes));

        // 2. Modify the task
        const task = allTasks.find(t => t.id === id);
        if (!task) return;
        task.is_completed = !task.is_completed;
        task.completed_at = task.is_completed ? new Date().toISOString() : null;

        // 3. Save back to GitHub
        const jsonStr = JSON.stringify(allTasks, null, 2);
        const bytesToUpload = new TextEncoder().encode(jsonStr);
        let binary = "";
        for (let i = 0; i < bytesToUpload.byteLength; i++) binary += String.fromCharCode(bytesToUpload[i]);

        const putResp = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
            method: 'PUT',
            headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Task Toggle", content: btoa(binary), sha: currentSha, branch: "main" })
        });
        
        if (putResp.ok) {
            updateStatus("Saved.");
            const resData = await putResp.json();
            currentSha = resData.content.sha;
            renderDashboard();
        } else {
            const err = await putResp.json();
            updateStatus(`Error ${putResp.status}: ${err.message}`, true);
            fetchTasks();
        }
    } catch (e) { updateStatus("Update failed", true); fetchTasks(); }
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
    
    // Split: Active (Not completed) vs Completed
    const activeTasks = allTasks.filter(t => !t.is_completed);
    const completedTasks = allTasks.filter(t => t.is_completed);
    
    const tasksToDisplay = showArchive ? allTasks : activeTasks;

    // Render Hero
    const heroEl = document.getElementById('next-mission');
    const nextTask = activeTasks[0] || allTasks[0];
    if (heroEl && nextTask) {
        heroEl.innerHTML = `
            <div class="course-label"><span>${nextTask.course || 'כללי'}</span></div>
            <div class="hero-title">${nextTask.title}</div>
            <div class="hero-countdown">${getTimeRemaining(nextTask.due_date)}</div>
            <div class="check hero-check" style="cursor:pointer; width:40px; height:40px; border:3px solid white; border-radius:50%; display:flex; align-items:center; justify-content:center; margin: 15px auto;">
                ${nextTask.is_completed ? '✓' : ''}
            </div>
        `;
        heroEl.querySelector('.hero-check').onclick = () => toggleTask(nextTask.id);
    }

    // Render Grid
    tasksToDisplay.forEach(task => {
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
        gridEl.appendChild(item);
    });

    // ARCHIVE BUTTON LOGIC
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
        body.dataset.theme = currentTheme;
        localStorage.setItem('dashboard-theme', currentTheme);
        themeToggle.innerText = currentTheme === 'day' ? '🌙' : '☀️';
    };
}

const savedTheme = localStorage.getItem('dashboard-theme') || 'day';
body.dataset.theme = savedTheme;
fetchTasks();
setInterval(fetchTasks, 30 * 1000); 
