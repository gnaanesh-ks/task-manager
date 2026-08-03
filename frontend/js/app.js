/**
 * app.js
 * Application controller: view switching, auth flows, and task CRUD UI logic.
 */

const el = (id) => document.getElementById(id);

const els = {
  navAuthState: el("nav-auth-state"),
  authView: el("auth-view"),
  appView: el("app-view"),
  loginForm: el("login-form"),
  signupForm: el("signup-form"),
  loginError: el("login-error"),
  signupError: el("signup-error"),
  taskForm: el("task-form"),
  taskList: el("task-list"),
  emptyState: el("empty-state"),
  filterStatus: el("filter-status"),
  toast: el("toast"),
};

let currentTasks = [];

function showToast(message, type = "success") {
  els.toast.textContent = message;
  els.toast.className = `toast ${type}`;
  els.toast.classList.remove("hidden");
  setTimeout(() => els.toast.classList.add("hidden"), 3000);
}

function renderNav() {
  const user = Storage.getUser();
  if (user) {
    els.navAuthState.innerHTML = `
      <span>Hi, ${escapeHtml(user.username)}</span>
      <button class="btn-logout" id="logout-btn">Logout</button>
    `;
    el("logout-btn").addEventListener("click", handleLogout);
  } else {
    els.navAuthState.innerHTML = "";
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function switchView(view) {
  if (view === "auth") {
    els.authView.classList.remove("hidden");
    els.appView.classList.add("hidden");
  } else {
    els.authView.classList.add("hidden");
    els.appView.classList.remove("hidden");
  }
  renderNav();
}

// --- Tab switching within auth view ---
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    if (tab === "login") {
      els.loginForm.classList.remove("hidden");
      els.signupForm.classList.add("hidden");
    } else {
      els.signupForm.classList.remove("hidden");
      els.loginForm.classList.add("hidden");
    }
  });
});

// --- Auth handlers ---
els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.loginError.textContent = "";
  const email = el("login-email").value.trim();
  const password = el("login-password").value;
  try {
    const data = await AuthAPI.login(email, password);
    Storage.setToken(data.token);
    Storage.setUser(data.user);
    switchView("app");
    await loadTasks();
    showToast("Logged in successfully");
  } catch (err) {
    els.loginError.textContent = err.body?.message || err.message;
  }
});

els.signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.signupError.textContent = "";
  const username = el("signup-username").value.trim();
  const email = el("signup-email").value.trim();
  const password = el("signup-password").value;
  try {
    const data = await AuthAPI.signup(username, email, password);
    Storage.setToken(data.token);
    Storage.setUser(data.user);
    switchView("app");
    await loadTasks();
    showToast("Account created successfully");
  } catch (err) {
    els.signupError.textContent = err.body?.message || err.message;
  }
});

function handleLogout() {
  Storage.clearToken();
  Storage.clearUser();
  currentTasks = [];
  switchView("auth");
  showToast("Logged out");
}

// --- Task handlers ---
els.taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = el("task-title").value.trim();
  const description = el("task-description").value.trim();
  const priority = el("task-priority").value;
  if (!title) return;

  try {
    const created = await TasksAPI.create({ title, description, priority });
    currentTasks.unshift(created.task);
    renderTasks();
    els.taskForm.reset();
    showToast("Task added");
  } catch (err) {
    showToast(err.body?.message || err.message, "error");
    if (err.status === 401) handleLogout();
  }
});

els.filterStatus.addEventListener("change", renderTasks);

async function loadTasks() {
  try {
    const data = await TasksAPI.list();
    currentTasks = data.tasks || [];
    renderTasks();
  } catch (err) {
    showToast(err.body?.message || "Failed to load tasks", "error");
    if (err.status === 401) handleLogout();
  }
}

function renderTasks() {
  const filter = els.filterStatus.value;
  const filtered = currentTasks.filter((t) => {
    if (filter === "all") return true;
    if (filter === "completed") return t.completed;
    if (filter === "pending") return !t.completed;
    return true;
  });

  els.taskList.innerHTML = "";
  els.emptyState.classList.toggle("hidden", filtered.length > 0);

  filtered.forEach((task) => {
    const li = document.createElement("li");
    li.className = "task-item";
    li.innerHTML = `
      <input type="checkbox" class="task-checkbox" ${task.completed ? "checked" : ""} data-id="${task._id}">
      <div class="task-body">
        <div class="task-title ${task.completed ? "completed" : ""}">${escapeHtml(task.title)}</div>
        ${task.description ? `<div class="task-desc">${escapeHtml(task.description)}</div>` : ""}
        <span class="priority-badge priority-${task.priority}">${task.priority}</span>
      </div>
      <div class="task-actions">
        <button class="icon-btn delete" data-id="${task._id}" title="Delete">🗑</button>
      </div>
    `;
    els.taskList.appendChild(li);
  });

  document.querySelectorAll(".task-checkbox").forEach((cb) => {
    cb.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const task = currentTasks.find((t) => t._id === id);
      try {
        const updated = await TasksAPI.update(id, { completed: e.target.checked });
        Object.assign(task, updated.task);
        renderTasks();
      } catch (err) {
        showToast(err.body?.message || err.message, "error");
        e.target.checked = !e.target.checked;
      }
    });
  });

  document.querySelectorAll(".icon-btn.delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id;
      try {
        await TasksAPI.remove(id);
        currentTasks = currentTasks.filter((t) => t._id !== id);
        renderTasks();
        showToast("Task deleted");
      } catch (err) {
        showToast(err.body?.message || err.message, "error");
      }
    });
  });
}

// --- Bootstrap ---
(async function init() {
  const token = Storage.getToken();
  if (!token) {
    switchView("auth");
    return;
  }
  try {
    await AuthAPI.verify();
    switchView("app");
    await loadTasks();
  } catch (err) {
    handleLogout();
  }
})();
