/**
 * api.js
 * Centralized API client for communicating with the backend microservices.
 * In a Kubernetes deployment, these calls are routed through the Ingress
 * controller which paths /api/auth -> auth-service and /api/tasks -> task-service.
 */

const API_CONFIG = {
  // In production these are same-origin paths handled by the Ingress rules.
  // For local docker-compose development, override via window.__ENV if needed.
  AUTH_BASE: (window.__ENV && window.__ENV.AUTH_API_URL) || "/api/auth",
  TASKS_BASE: (window.__ENV && window.__ENV.TASKS_API_URL) || "/api/tasks",
};

const TOKEN_KEY = "taskflow_token";
const USER_KEY = "taskflow_user";

const Storage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
  getUser: () => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setUser: (user) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clearUser: () => localStorage.removeItem(USER_KEY),
};

async function apiRequest(url, options = {}) {
  const token = Storage.getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  let body = null;
  const text = await response.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch (e) {
    body = { message: text };
  }

  if (!response.ok) {
    const error = new Error(body?.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

const AuthAPI = {
  signup: (username, email, password) =>
    apiRequest(`${API_CONFIG.AUTH_BASE}/signup`, {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    }),

  login: (email, password) =>
    apiRequest(`${API_CONFIG.AUTH_BASE}/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  verify: () => apiRequest(`${API_CONFIG.AUTH_BASE}/verify`, { method: "GET" }),
};

const TasksAPI = {
  list: () => apiRequest(`${API_CONFIG.TASKS_BASE}/`, { method: "GET" }),

  create: (task) =>
    apiRequest(`${API_CONFIG.TASKS_BASE}/`, {
      method: "POST",
      body: JSON.stringify(task),
    }),

  update: (id, updates) =>
    apiRequest(`${API_CONFIG.TASKS_BASE}/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),

  remove: (id) =>
    apiRequest(`${API_CONFIG.TASKS_BASE}/${id}`, { method: "DELETE" }),
};
