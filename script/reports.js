/* =========================
   reports.js
   役割:
   - 報告データの検索
   - 報告作成
   - 詰まり / 進捗 / 完了報告
   - 報告状態更新
========================= */

/* タスクに紐づく報告一覧 */
function getTaskReports(taskId) {
  return reports.filter(report => report.taskId === taskId);
}

/* 未確認報告だけ取得 */
function getPendingReportsForTask(taskId) {
  return reports.filter(report => report.taskId === taskId && report.state === "pending");
}

/* メンバーごとの未確認報告数 */
function getPendingReportCountForMember(member) {
  return reports.filter(report => report.reporter === member && report.state === "pending").length;
}

/* そのタスクに未確認報告があるか */
function hasPendingReports(task) {
  return getPendingReportsForTask(task.id).length > 0;
}

/* 現在モードで見える報告一覧 */
function getTargetReports() {
  if (currentMode === "manager") return reports;
  return reports.filter(report => report.reporter === currentUser);
}

/* 報告タイプ → CSSクラス */
function getReportTypeClass(type) {
  if (type === "blocked") return "report-blocked";
  if (type === "done") return "report-done";
  return "report-progress";
}

/* 報告タイプ → 表示名 */
function getReportTypeLabel(type) {
  if (type === "blocked") return "詰まり";
  if (type === "done") return "完了";
  return "進捗";
}

/* 報告状態 → CSSクラス */
function getReportStateClass(state) {
  if (state === "resolved") return "resolved";
  if (state === "reviewing") return "reviewing";
  return "pending";
}

/* 報告状態 → 表示名 */
function getReportStateLabel(state) {
  if (state === "resolved") return "完了";
  if (state === "reviewing") return "確認中";
  return "未確認";
}

/* =========================
   報告オブジェクト作成
========================= */
function createReport(taskId, type, message) {
  const task = getTaskById(taskId);
  if (!task) return;

  const report = {
    id: crypto.randomUUID(),
    taskId,
    taskTitle: task.title,
    reporter: task.assignee,
    type,
    message,
    state: "pending",
    createdAtISO: nowISO(),
    createdAtLabel: new Date().toLocaleString("ja-JP"),
    managerResponse: ""
  };

  reports.unshift(report);
  saveReports();
}

/* 詰まり報告 */
function sendBlockedReport(id) {
  const task = getTaskById(id);
  if (!task) return;

  const reason = prompt("詰まり理由を入力\n例：仕様待ち、確認待ち、素材待ち");
  if (reason === null) return;

  const trimmed = reason.trim();
  if (!trimmed) return;

  task.status = "Blocked";
  task.blockedReason = trimmed;
  touchTask(task);

  createReport(id, "blocked", trimmed);

  saveTasks();
  renderAll();
}

/* 進捗報告 */
function sendProgressReport(id) {
  const task = getTaskById(id);
  if (!task) return;

  const note = prompt("進捗報告を入力\n例：UI調整70%完了、次はレスポンシブ対応");
  if (note === null) return;

  const trimmed = note.trim();
  if (!trimmed) return;

  task.status = "In Progress";
  touchTask(task);

  createReport(id, "progress", trimmed);

  saveTasks();
  renderAll();
}

/* 完了報告 */
function sendDoneReport(id) {
  const task = getTaskById(id);
  if (!task) return;

  const note = prompt("完了報告を入力\n例：実装完了、確認お願いします");
  if (note === null) return;

  const trimmed = note.trim() || "完了しました。確認お願いします。";

  task.status = "Done";
  task.blockedReason = "";
  touchTask(task);

  createReport(id, "done", trimmed);

  saveTasks();
  renderAll();
}

/* 報告状態更新 */
function updateReportState(reportId, value) {
  const report = reports.find(r => r.id === reportId);
  if (!report) return;

  report.state = value;
  saveReports();
  renderAll();
}

/* 管理者コメント返信 */
function respondReport(reportId) {
  const report = reports.find(r => r.id === reportId);
  if (!report) return;

  const response = prompt("管理者コメントを入力");
  if (response === null) return;

  report.managerResponse = response.trim();
  report.state = "reviewing";
  saveReports();
  renderAll();
}