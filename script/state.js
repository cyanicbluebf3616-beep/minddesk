/* =========================
   state.js
   役割:
   - メンバー一覧
   - 現在の表示状態
   - フィルター状態
   - タスク / 報告データ保持
========================= */

/* メンバー一覧 */
const members = ["田中", "佐藤", "山本", "中村"];

/* 表示モード */
let currentMode = "manager"; // manager / member
let currentUser = members[0];

/* フィルター状態 */
let statusFilter = "all";
let taskSearchText = "";
let priorityFilter = "all";
let overdueOnly = false;
let pendingOnly = false;
let sortOrder = "risk";

/* ローカル保存されているデータ読込 */
let tasks = JSON.parse(localStorage.getItem("minddesk_linked_tasks")) || [];
let reports = JSON.parse(localStorage.getItem("minddesk_linked_reports")) || [];

/* =========================
   保存処理
========================= */
function saveTasks() {
  localStorage.setItem("minddesk_linked_tasks", JSON.stringify(tasks));
}

function saveReports() {
  localStorage.setItem("minddesk_linked_reports", JSON.stringify(reports));
}

/* UI状態保存キー */
const UI_STATE_KEY = "minddesk_ui_state";

/* 選択中状態 */
let selectedTaskId = null;
let editingTaskId = null;