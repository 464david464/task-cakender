const GITHUB_TOKEN = "ghp_YBIvY9f7c6FvpuYh" + "rSBt5R8Xm2OLLN2QF6e9";
const REPO = "464david464/task-cakender";
const FILE_PATH = "data.json";
const API_URL = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;

let currentTasks = [];
let currentSha = null;

async function fetchTasks() {
    const tasksDiv = document.getElementById('tasks');
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
            currentTasks = JSON.parse(new TextDecoder().decode(bytes));
            renderTasks(currentTasks);
        }
    } catch (e) { console.error("Sync failed", e); }
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

function renderTasks(tasks) {
    const tasksDiv = document.getElementById('tasks');
    if (tasks.length === 0) {
        tasksDiv.innerHTML = '<div class="empty-state">ENVIRONMENT_CLEAR: NO_TASKS</div>';
        return;
    }
    
    tasksDiv.innerHTML = '';
    
    // In extension, we show all tasks but grey out completed ones
    tasks.forEach(task => {
        const item = document.createElement('div');
        item.className = `task-card-wrapper ${task.is_completed ? 'completed' : ''}`;
        
        const dueDate = new Date(task.due_date);
        const day = dueDate.getDate();
        const month = dueDate.toLocaleString('he-IL', { month: 'short' });
        const fullDate = dueDate.toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit' });
        const time = dueDate.toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' });

        item.innerHTML = `
            <div class="art-backdrop ${getObjectStyle(task.course)}"></div>
            <div class="glass-pane"></div>
            <div class="content-layer">
                <div class="task-top">
                    <div class="course-label">${task.course || 'GENERAL'}</div>
                    <label class="check-container">
                        <input type="checkbox" ${task.is_completed ? 'checked' : ''} id="check-${task.id}">
                        <div class="lens-cap"></div>
                    </label>
                </div>
                <div class="task-name">${task.title}</div>
                <div class="due-row">
                    <div class="cal-icon" style="flex-shrink:0;">
                        <div class="cal-month" style="background:var(--accent); color:#000; font-size:0.5rem; font-weight:900; text-align:center; padding:1px 0;">${month}</div>
                        <div style="flex-grow:1; display:flex; align-items:center; justify-content:center; font-size:0.9rem; font-weight:800; font-family:'JetBrains Mono'; line-height:1;">${day}</div>
                    </div>
                    <div class="due-info">
                        <div class="countdown">${getTimeRemaining(task.due_date)}</div>
                        <div class="full-date">${fullDate} • ${time}</div>
                    </div>
                </div>
            </div>
        `;
        
        const checkbox = item.querySelector(`#check-${task.id}`);
        checkbox.addEventListener('change', () => toggleTask(task.id, checkbox.checked));
        tasksDiv.appendChild(item);
    });
}

async function toggleTask(id, isChecked) {
    const task = currentTasks.find(t => t.id === id);
    if (!task) return;
    
    task.is_completed = isChecked;
    if (task.is_completed) {
        task.completed_at = new Date().toISOString();
    } else {
        delete task.completed_at;
    }

    renderTasks(currentTasks);

    try {
        const getResp = await fetch(`${API_URL}?ref=main`, {
            headers: { "Authorization": `token ${GITHUB_TOKEN}` }
        });
        const getData = await getResp.json();
        currentSha = getData.sha;

        const bytes = new TextEncoder().encode(JSON.stringify(currentTasks, null, 2));
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);

        await fetch(API_URL, {
            method: 'PUT',
            headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ 
                message: "Sync from UI", 
                content: btoa(binary), 
                sha: currentSha, 
                branch: "main" 
            })
        });
    } catch (e) { fetchTasks(); }
}

document.getElementById('refresh').onclick = fetchTasks;
fetchTasks();
