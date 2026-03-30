const GITHUB_TOKEN = "ghp_YBIvY9f7c6FvpuYh" + "rSBt5R8Xm2OLLN2QF6e9";
const REPO = "464david464/task-cakender";
const FILE_PATH = "data.json";
const API_URL = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;

let currentTasks = [];
let currentSha = null;
let showArchive = false;
let isSyncing = false;

function updateStatus(msg, type) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    el.innerText = msg;
    el.className = type ? `status-${type}` : '';
    if (type === 'success') {
        setTimeout(() => { 
            if (el.innerText === 'JSON_SAVED') {
                el.innerText = 'READY';
                el.className = '';
            }
        }, 3000);
    }
}

async function fetchTasks() {
    if (isSyncing) return;
    const refreshBtn = document.getElementById('refresh');
    refreshBtn.style.animation = "spin 1s linear infinite";
    isSyncing = true;
    updateStatus('FETCHING...', 'syncing');

    try {
        const resp = await fetch(`${API_URL}?ref=main&t=${new Date().getTime()}`, {
            headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" }
        });
        if (resp.ok) {
            const data = await resp.json();
            currentSha = data.sha;
            const binaryString = atob(data.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            const rawTasks = JSON.parse(new TextDecoder().decode(bytes));
            // Filter out "מעבדה בפיזיקה" tasks
            currentTasks = rawTasks.filter(t => !t.course || !t.course.includes("מעבדה בפיזיקה"));
            renderTasks();
            updateStatus('READY', '');
        }
    } catch (e) { 
        console.error("Sync failed", e); 
        updateStatus('FETCH_ERROR', 'error');
    }
    
    setTimeout(() => {
        refreshBtn.style.animation = "";
        isSyncing = false;
    }, 500);
}

function getObjectStyle(courseName) {
    if (courseName.includes("גיאומטרית")) return "prism-object";
    if (courseName.includes("מעבדה באופטיקה")) return "laser-object";
    if (courseName.includes("פיסיקלית") || courseName.includes("יישומים")) return "interference-object";
    return "orbital-object";
}

function getTimeRemaining(dueDate) {
    const total = Date.parse(dueDate) - Date.parse(new Date());
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    if (days < 0) return "עבר המועד";
    if (days === 0) return "היום!";
    return `עוד ${days} ימים`;
}

function renderTasks() {
    const tasksDiv = document.getElementById('tasks');
    const archiveBtn = document.getElementById('archive-toggle');
    
    if (!currentTasks || currentTasks.length === 0) {
        tasksDiv.innerHTML = '<div class="empty-state">ENVIRONMENT_CLEAR: NO_TASKS</div>';
        return;
    }

    const completed = currentTasks.filter(t => t.is_completed);
    const active = currentTasks.filter(t => !t.is_completed);
    
    if (completed.length > 0) {
        archiveBtn.style.display = 'flex';
        archiveBtn.innerText = showArchive ? `הסתר משימות שבוצעו` : `משימות שבוצעו (${completed.length})`;
    } else {
        archiveBtn.style.display = 'none';
        showArchive = false;
    }

    tasksDiv.innerHTML = '';
    
    active.sort((a, b) => Date.parse(a.due_date) - Date.parse(b.due_date));
    
    if (showArchive && completed.length > 0) {
        htmlPrefix = `<div class="empty-state" style="padding: 0 0 15px 0; color: var(--accent); opacity: 0.8;">--- בוצעו לאחרונה ---</div>`;
        completed.sort((a, b) => {
            const timeA = a.completed_at ? Date.parse(a.completed_at) : 0;
            const timeB = b.completed_at ? Date.parse(b.completed_at) : 0;
            return timeB - timeA;
        });
        completed.forEach(task => tasksDiv.appendChild(createTaskElement(task)));
        const divider = document.createElement('div');
        divider.className = 'empty-state';
        divider.style.padding = '10px 0 20px 0';
        divider.style.borderTop = '1px solid rgba(255,255,255,0.1)';
        divider.innerText = '--- משימות פעילות ---';
        tasksDiv.appendChild(divider);
    }

    active.forEach(task => tasksDiv.appendChild(createTaskElement(task)));

    if (active.length === 0 && !showArchive) {
        tasksDiv.innerHTML = '<div class="empty-state">ALL_TASKS_COMPLETED</div>';
    }
}

function createTaskElement(task) {
    const item = document.createElement('div');
    
    // Calculate Urgency Logic
    const timeDiff = Date.parse(task.due_date) - new Date().getTime();
    const daysDiff = timeDiff / 86400000;
    // Set back to 3 days
    const isUrgent = !task.is_completed && daysDiff <= 3 && daysDiff >= -1;

    item.className = `task-card-wrapper ${task.is_completed ? 'completed' : ''} ${isUrgent ? 'urgent' : ''}`;
    
    const dueDate = new Date(task.due_date);
    const day = dueDate.getDate();
    const month = dueDate.toLocaleString('he-IL', { month: 'short' });
    const fullDate = dueDate.toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit' });
    const time = dueDate.toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' });

    item.innerHTML = `
        <div class="art-backdrop ${getObjectStyle(task.course || '')}"></div>
        <div class="glass-pane"></div>
        <div class="content-layer">
            <div class="task-top">
                <div class="course-label">${task.course || 'GENERAL'}</div>
                <label class="check-container">
                    <input type="checkbox" ${task.is_completed ? 'checked' : ''} id="check-${task.id}">
                    <div class="lens-cap"></div>
                </label>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                ${isUrgent ? '<div class="urgent-led"></div>' : ''}
                <div class="task-name" style="margin:0;">${task.title}</div>
            </div>
            <div class="due-row" style="margin-top:12px;">
                <div class="cal-icon" style="flex-shrink:0; width:35px; height:38px; background:rgba(255,255,255,0.1); border-radius:8px; overflow:hidden; display:flex; flex-direction:column; border:1px solid rgba(255,255,255,0.1);">
                    <div style="background:var(--accent); color:#000; font-size:0.5rem; font-weight:900; text-align:center; padding:1px 0;">${month}</div>
                    <div style="flex-grow:1; display:flex; align-items:center; justify-content:center; font-size:0.9rem; font-weight:800; font-family:'JetBrains Mono'; line-height:1; color:#fff;">${day}</div>
                </div>
                <div class="due-info">
                    <div class="countdown">${getTimeRemaining(task.due_date)}</div>
                    <div class="full-date">${fullDate} • ${time}</div>
                </div>
            </div>
        </div>
    `;
    
    item.querySelector('input').addEventListener('change', (e) => {
        toggleTask(task.id, e.target.checked);
    });
    
    return item;
}

async function toggleTask(id, isChecked) {
    if (isSyncing) return;
    const task = currentTasks.find(t => t.id === id);
    if (!task) return;
    
    task.is_completed = isChecked;
    if (task.is_completed) task.completed_at = new Date().toISOString();
    else delete task.completed_at;

    renderTasks();
    isSyncing = true;
    updateStatus('SYNCING...', 'syncing');
    const refreshBtn = document.getElementById('refresh');
    refreshBtn.style.opacity = "0.3";

    try {
        const getResp = await fetch(`${API_URL}?ref=main&t=${new Date().getTime()}`, {
            headers: { "Authorization": `token ${GITHUB_TOKEN}` }
        });
        if (!getResp.ok) throw new Error("SHA_FETCH_FAILED");
        const getData = await getResp.json();
        currentSha = getData.sha;

        const bytes = new TextEncoder().encode(JSON.stringify(currentTasks, null, 2));
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);

        const putResp = await fetch(API_URL, {
            method: 'PUT',
            headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Sync from UI", content: btoa(binary), sha: currentSha, branch: "main" })
        });
        
        if (putResp.ok) updateStatus('JSON_SAVED', 'success');
        else throw new Error("SAVE_FAILED");
    } catch (e) { 
        updateStatus('SAVE_FAILED', 'error');
        isSyncing = false;
        await fetchTasks();
    }
    isSyncing = false;
    refreshBtn.style.opacity = "1";
}

document.getElementById('archive-toggle').addEventListener('click', () => {
    showArchive = !showArchive;
    renderTasks();
});

document.getElementById('refresh').onclick = fetchTasks;
fetchTasks();
