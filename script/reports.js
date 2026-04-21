function normalizeReport(report) {
  return {
    id: report.id || uuid(),
    taskId: report.taskId,
    taskTitle: report.taskTitle || "不明なタスク",
    reporter: report.reporter || currentUser,
    type: ["progress", "blocked", "done"].includes(report.type) ? report.type : "progress",
    message: report.message || "",
    state: ["pending", "reviewing", "resolved"].includes(report.state) ? report.state : "pending",
    createdAtISO: report.createdAtISO || nowISO(),
    createdAtLabel: report.createdAtLabel || formatDateTimeLabel(report.createdAtISO || nowISO()),
    managerResponse: report.managerResponse || ""
  };
}

reports = reports.map(normalizeReport);

function getTaskReports(taskId) {
  return reports.filter((report) => report.taskId === taskId);
}

function getPendingReportsForTask(taskId) {
  return reports.filter((report) => report.taskId === taskId && report.state === "pending");
}

function getPendingReportCountForMember(member) {
  return reports.filter((report) => report.reporter === member && report.state === "pending").length;
}

function hasPendingReports(task) {
  return getPendingReportsForTask(task.id).length > 0;
}

function getTargetReports() {
  return currentMode === "manager"
    ? reports.slice()
    : reports.filter((report) => report.reporter === currentUser);
}

function getReportTypeClass(type) {
  if (type === "blocked") return "report-blocked";
  if (type === "done") return "report-done";
  return "report-progress";
}

function getReportTypeLabel(type) {
  if (type === "blocked") return "停滞";
  if (type === "done") return "完了";
  return "進捗";
}

function getReportStateClass(state) {
  if (state === "resolved") return "resolved";
  if (state === "reviewing") return "reviewing";
  return "pending";
}

function getReportStateLabel(state) {
  if (state === "resolved") return "対応済み";
  if (state === "reviewing") return "確認中";
  return "未対応";
}

function createReport(taskId, type, message) {
  const task = getTaskById(taskId);
  if (!task) return null;

  const report = normalizeReport({
    taskId,
    taskTitle: task.title,
    reporter: task.assignee,
    type,
    message
  });

  reports.unshift(report);
  saveReports();
  return report;
}

async function sendBlockedReport(id) {
  const task = getTaskById(id);
  if (!task) return;

  const reason = prompt("停滞理由を入力してください。");
  if (reason === null) return;
  const trimmed = reason.trim();
  if (!trimmed) return;

  await updateTask(id, { status: "Blocked", blockedReason: trimmed });
  createReport(id, "blocked", trimmed);
  renderAll();
}

async function sendProgressReport(id) {
  const task = getTaskById(id);
  if (!task) return;

  const note = prompt("進捗内容を入力してください。");
  if (note === null) return;
  const trimmed = note.trim();
  if (!trimmed) return;

  await updateTask(id, { status: "In Progress" });
  createReport(id, "progress", trimmed);
  renderAll();
}

async function sendDoneReport(id) {
  const task = getTaskById(id);
  if (!task) return;

  const note = prompt("完了報告を入力してください。空欄でも登録できます。");
  if (note === null) return;
  const trimmed = note.trim() || "完了しました。";

  await updateTask(id, { status: "Done", blockedReason: "" });
  createReport(id, "done", trimmed);
  renderAll();
}

function updateReportState(reportId, value) {
  const report = reports.find((item) => item.id === reportId);
  if (!report) return;
  report.state = value;
  saveReports();
  renderAll();
}

function respondReport(reportId) {
  const report = reports.find((item) => item.id === reportId);
  if (!report) return;

  const response = prompt("管理者コメントを入力してください。", report.managerResponse || "");
  if (response === null) return;

  report.managerResponse = response.trim();
  report.state = report.managerResponse ? "reviewing" : report.state;
  saveReports();
  renderAll();
}
