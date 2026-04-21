const members = ["田中", "山本", "佐藤", "中村"];

const STORAGE_KEYS = {
  tasks: "minddesk_linked_tasks",
  reports: "minddesk_linked_reports",
  ui: "minddesk_ui_state",
  seeded: "minddesk_seeded"
};

let currentMode = "manager";
let currentUser = members[0];
let statusFilter = "all";
let taskSearchText = "";
let priorityFilter = "all";
let overdueOnly = false;
let pendingOnly = false;
let sortOrder = "risk";

let selectedTaskId = null;
let editingTaskId = null;

let tasks = loadStoredArray(STORAGE_KEYS.tasks);
let reports = loadStoredArray(STORAGE_KEYS.reports);

function loadStoredArray(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("storage parse error:", key, error);
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
}

function saveReports() {
  localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(reports));
}
