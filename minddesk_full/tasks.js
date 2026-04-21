/* =========================
   tasks.js
   役割:
   - タスク取得 / 絞り込み / 並び替え
   - タスク追加 / 更新 / 削除
   - Supabase同期
   - 優先度計算
========================= */

/* =========================
   基本ユーティリティ
========================= */
const DAY_MS = 1000 * 60 * 60 * 24;

function toSafeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getTaskDate(task, ...keys) {
  for (const key of keys) {
    if (!key) continue;
    const value = task?.[key];
    if (!value) continue;

    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(value + "T23:59:59");
      if (!Number.isNaN(d.getTime())) return d;
    }

    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

function diffDays(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

/* 過去の日本語状態値を正規化 */
function normalizeLegacyStatus(status) {
  if (status === "未着手") return "Todo";
  if (status === "進行中") return "In Progress";
  if (status === "停滞") return "Blocked";
  if (status === "完了") return "Done";
  return status;
}

function normalizeTask(task) {
  if (!task) return task;
  return {
    ...task,
    status: normalizeLegacyStatus(task.status)
  };
}

function getTaskById(id) {
  const task = tasks.find(task => task.id === id);
  return normalizeTask(task);
}

function isTaskDone(task) {
  return normalizeLegacyStatus(task.status) === "Done";
}

function isTaskBlocked(task) {
  return normalizeLegacyStatus(task.status) === "Blocked";
}

function getTaskLastActivityDate(task) {
  return getTaskDate(task, "lastUpdatedAt", "updatedAt", "createdAtISO", "createdAt") || new Date(nowISO());
}

function getTaskFinalDueDate(task) {
  return getTaskDate(task, "finalDueDate", "dueDate");
}

function getTaskBufferDueDate(task) {
  return getTaskDate(task, "bufferDueDate");
}

function getTaskIdleDays(task, now = getNow()) {
  const updatedAt = getTaskLastActivityDate(task);
  return Math.max(0, diffDays(updatedAt, now));
}

/* =========================
   優先度ロジック
   - 状態の重さ
   - 放置
   - 重要度
   - 影響度
   - 期限（固定 + 全体平均補正）
========================= */

/* 放置スコア */
function getIdleScore(task, now = getNow()) {
  const idleDays = getTaskIdleDays(task, now);

  let score = 0;
  const reasons = [];

  if (idleDays >= 10) {
    score += 24;
    reasons.push(`${idleDays}日更新なし`);
  } else if (idleDays >= 7) {
    score += 18;
    reasons.push(`${idleDays}日更新なし`);
  } else if (idleDays >= 4) {
    score += 12;
    reasons.push(`${idleDays}日更新なし`);
  } else if (idleDays >= 2) {
    score += 6;
    reasons.push(`${idleDays}日更新なし`);
  }

  return { score, reasons, idleDays };
}

/* 重要度スコア */
function getPriorityWeightScore(task) {
  let score = 0;
  const reasons = [];

  if (task.priority === "High") {
    score += 25;
    reasons.push("重要度高");
  } else if (task.priority === "Medium") {
    score += 12;
    reasons.push("重要度中");
  }

  return { score, reasons };
}

/* 影響度スコア */
function getImpactScore(task) {
  let score = 0;
  const reasons = [];
  const impact = task.impact ?? task.impactLevel ?? task.effectLevel ?? null;

  if (impact === 4 || impact === "critical" || impact === "Critical" || impact === "致命的") {
    score += 60;
    reasons.push("影響度 致命的");
  } else if (impact === 3 || impact === "high" || impact === "High" || impact === "重要") {
    score += 30;
    reasons.push("影響度 高");
  } else if (impact === 2 || impact === "medium" || impact === "Medium" || impact === "普通") {
    score += 10;
    reasons.push("影響度 中");
  } else if (impact === 1 || impact === "low" || impact === "Low" || impact === "軽微") {
    score += 0;
    reasons.push("影響度 低");
  }

  return { score, reasons, impact };
}

/* 全体の平均残日数 */
function getAverageRemainingDays(allTasks, now = getNow()) {
  const validDays = allTasks
    .map(normalizeTask)
    .filter(task => !isTaskDone(task) && task.finalDueDate)
    .map(task => {
      const due = new Date(task.finalDueDate + "T23:59:59");
      return Math.ceil((due.getTime() - now.getTime()) / DAY_MS);
    })
    .filter(days => Number.isFinite(days) && days >= 0);

  if (validDays.length === 0) return null;

  const total = validDays.reduce((sum, days) => sum + days, 0);
  return total / validDays.length;
}

/* 期限スコア */
function getDeadlineScore(task, allTasks, now = getNow()) {
  const normalizedTask = normalizeTask(task);

  if (!normalizedTask.finalDueDate || isTaskDone(normalizedTask)) {
    return { score: 0, reasons: [], daysLeft: null, averageDays: null };
  }

  const due = new Date(normalizedTask.finalDueDate + "T23:59:59");
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / DAY_MS);
  const averageDays = getAverageRemainingDays(allTasks, now);

  let score = 0;
  const reasons = [];

  // ① 絶対日数
  if (daysLeft < 0) {
    score += 100;
    reasons.push("期限超過");
  } else if (daysLeft <= 1) {
    score += 60;
    reasons.push("期限1日以内");
  } else if (daysLeft <= 3) {
    score += 35;
    reasons.push("期限3日以内");
  } else if (daysLeft <= 7) {
    score += 15;
    reasons.push("期限7日以内");
  }

  // ② 平均比較で補正
  if (averageDays !== null && daysLeft >= 0) {
    if (daysLeft <= averageDays * 0.5) {
      score += 15;
      reasons.push("全体平均よりかなり近い");
    } else if (daysLeft <= averageDays * 0.8) {
      score += 8;
      reasons.push("全体平均より近い");
    }
  }

  return { score, reasons, daysLeft, averageDays };
}

/* 状態スコア（Blocked細分化版） */
function getStatusScore(task, now = getNow()) {
  const normalizedTask = normalizeTask(task);

  let score = 0;
  const reasons = [];

  if (normalizedTask.status === "Todo") {
    score += 0;
    reasons.push("未着手");
  } else if (normalizedTask.status === "In Progress") {
    score += 5;
    reasons.push("進行中");
  } else if (normalizedTask.status === "Blocked") {
    const reason = (normalizedTask.blockedReason || "").toLowerCase();
    const idleDays = getTaskIdleDays(normalizedTask, now);

    let blockScore = 0;

    if (reason.includes("review")) {
      blockScore += 10;
      reasons.push("レビュー待ち");
    } else if (reason.includes("depend")) {
      blockScore += 20;
      reasons.push("依存待ち");
    } else if (reason.includes("waiting")) {
      blockScore += 15;
      reasons.push("待機中");
    } else {
      blockScore += 30;
      reasons.push("完全停止");
    }

    if (idleDays >= 5) {
      blockScore += 20;
      reasons.push(`${idleDays}日放置`);
    } else if (idleDays >= 3) {
      blockScore += 10;
      reasons.push(`${idleDays}日放置`);
    }

    score += blockScore;
  }

  return { score, reasons };
}

/* 総合優先度 */
function calculateTaskPriority(task, allTasks, now = getNow()) {
  const normalizedTask = normalizeTask(task);

  if (isTaskDone(normalizedTask)) {
    return {
      level: 0,
      score: -9999,
      label: "完了",
      reasons: ["完了済み"]
    };
  }

  const statusPart = getStatusScore(normalizedTask, now);
  const idlePart = getIdleScore(normalizedTask, now);
  const priorityPart = getPriorityWeightScore(normalizedTask);
  const impactPart = getImpactScore(normalizedTask);
  const deadlinePart = getDeadlineScore(normalizedTask, allTasks, now);

  let level = 1;

  if (deadlinePart.daysLeft !== null && deadlinePart.daysLeft < 0) {
    level = 5;
  } else if (
    normalizedTask.status === "Blocked" ||
    (deadlinePart.daysLeft !== null && deadlinePart.daysLeft <= 1) ||
    impactPart.score >= 60
  ) {
    level = 4;
  } else if (
    normalizedTask.priority === "High" ||
    (deadlinePart.daysLeft !== null && deadlinePart.daysLeft <= 3) ||
    impactPart.score >= 30
  ) {
    level = 3;
  } else if (
    idlePart.idleDays >= 4 ||
    (deadlinePart.daysLeft !== null && deadlinePart.daysLeft <= 7) ||
    impactPart.score >= 10
  ) {
    level = 2;
  }

  const score =
    statusPart.score +
    idlePart.score +
    priorityPart.score +
    impactPart.score +
    deadlinePart.score;

  const reasons = [
    ...statusPart.reasons,
    ...idlePart.reasons,
    ...priorityPart.reasons,
    ...impactPart.reasons,
    ...deadlinePart.reasons
  ];

  let label = "通常";
  if (level === 5) label = "最優先";
  else if (level === 4) label = "緊急";
  else if (level === 3) label = "重要";
  else if (level === 2) label = "注意";

  return {
    level,
    score,
    label,
    reasons: [...new Set(reasons)].slice(0, 5)
  };
}

function enrichTasksWithPriority(list) {
  return list.map(task => {
    const normalizedTask = normalizeTask(task);
    const p = calculateTaskPriority(normalizedTask, tasks);

    return {
      ...normalizedTask,
      priorityLevel: p.level,
      priorityScore: p.score,
      priorityLabel: p.label,
      priorityReasons: p.reasons
    };
  });
}

function sortTasksByPriority(list) {
  return enrichTasksWithPriority(list).sort((a, b) => {
    if (b.priorityLevel !== a.priorityLevel) {
      return b.priorityLevel - a.priorityLevel;
    }

    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }

    const aUpdated = getTaskLastActivityDate(a).getTime();
    const bUpdated = getTaskLastActivityDate(b).getTime();

    return aUpdated - bUpdated;
  });
}

function getTopPriorityTasks(limit = 3) {
  return sortTasksByPriority(getFilteredTasksBase()).slice(0, limit);
}

/* =========================
   既存の基本関数
========================= */
function isDueSoon(task) {
  const normalizedTask = normalizeTask(task);
  if (!normalizedTask.finalDueDate || normalizedTask.status === "Done") return false;
  const now = getNow();
  const due = new Date(normalizedTask.finalDueDate + "T23:59:59");
  const diff = due.getTime() - now.getTime();
  return diff >= 0 && diff <= DAY_MS;
}

function isOverdue(task) {
  const normalizedTask = normalizeTask(task);
  if (!normalizedTask.finalDueDate || normalizedTask.status === "Done") return false;
  const due = new Date(normalizedTask.finalDueDate + "T23:59:59");
  return due.getTime() < getNow().getTime();
}

function isHighOpen(task) {
  const normalizedTask = normalizeTask(task);
  return normalizedTask.priority === "High" && normalizedTask.status !== "Done";
}

function isStalled(task) {
  const normalizedTask = normalizeTask(task);
  if (normalizedTask.status === "Done") return false;
  if (normalizedTask.status === "Blocked") return true;
  const hours = getHoursBetween(getNow(), getTaskLastActivityDate(normalizedTask));
  return hours >= 48;
}

function getPriorityClass(priority) {
  if (priority === "High") return "high";
  if (priority === "Medium") return "medium";
  return "low";
}

function getStatusClass(status) {
  const normalized = normalizeLegacyStatus(status);
  if (normalized === "Todo") return "todo";
  if (normalized === "In Progress") return "progress";
  if (normalized === "Blocked") return "blocked";
  return "done";
}

function getTargetTasks() {
  const visibleTasks = currentMode === "manager"
    ? tasks
    : tasks.filter(task => task.assignee === currentUser);

  return visibleTasks.map(normalizeTask);
}

/* =========================
   フィルター適用の土台
========================= */
function getFilteredTasksBase() {
  let list = [...getTargetTasks()];

  if (statusFilter !== "all") {
    list = list.filter(task => task.status === statusFilter);
  }

  if (priorityFilter !== "all") {
    list = list.filter(task => task.priority === priorityFilter);
  }

  if (overdueOnly) {
    list = list.filter(isOverdue);
  }

  if (pendingOnly) {
    list = list.filter(task => hasPendingReports(task));
  }

  if (taskSearchText) {
    const keyword = taskSearchText.toLowerCase();

    list = list.filter(task => {
      const title = (task.title || "").toLowerCase();
      const description = (task.description || "").toLowerCase();
      const assignee = (task.assignee || "").toLowerCase();
      const blockedReason = (task.blockedReason || "").toLowerCase();
      const reasons = Array.isArray(task.priorityReasons)
        ? task.priorityReasons.join(" ").toLowerCase()
        : "";

      return (
        title.includes(keyword) ||
        description.includes(keyword) ||
        assignee.includes(keyword) ||
        blockedReason.includes(keyword) ||
        reasons.includes(keyword)
      );
    });
  }

  return list;
}

/* =========================
   フィルター適用済みタスク一覧
========================= */
function getFilteredTasks() {
  let list = [...getFilteredTasksBase()];

  if (sortOrder === "dueSoon") {
    return enrichTasksWithPriority(list).sort((a, b) => {
      const aTime = a.finalDueDate
        ? new Date(a.finalDueDate + "T23:59:59").getTime()
        : Infinity;
      const bTime = b.finalDueDate
        ? new Date(b.finalDueDate + "T23:59:59").getTime()
        : Infinity;
      return aTime - bTime;
    });
  }

  if (sortOrder === "newest") {
    return enrichTasksWithPriority(list).sort((a, b) => {
      return new Date(b.createdAtISO || b.createdAt) - new Date(a.createdAtISO || a.createdAt);
    });
  }

  if (sortOrder === "oldestUpdate") {
    return enrichTasksWithPriority(list).sort((a, b) => {
      return new Date(a.lastUpdatedAt || a.createdAtISO || a.createdAt)
        - new Date(b.lastUpdatedAt || b.createdAtISO || b.createdAt);
    });
  }

  return sortTasksByPriority(list);
}

/* =========================
   フォームからタスク追加
========================= */
async function addTaskFromForm(elements) {
  const title = elements.taskTitle.value.trim();
  const description = elements.taskDescription.value.trim();
  const assignee = elements.taskAssignee.value;
  const bufferDueDate = elements.taskBufferDueDate.value;
  const finalDueDate = elements.taskFinalDueDate.value;
  const priority = elements.taskPriority.value;
  const status = elements.taskStatus.value;

  if (!title) {
    alert("タスク名を入力して");
    return false;
  }

  if (bufferDueDate && finalDueDate && new Date(bufferDueDate) > new Date(finalDueDate)) {
    alert("予備期限は最終期限より前にしてください");
    return false;
  }

  const created = nowISO();

  const supabase = window.supabaseClient;
  if (!supabase) {
    alert("Supabase接続がありません");
    return false;
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("Supabase auth getUser error:", userError);
    alert("ログインしてからタスク追加して");
    return false;
  }

  const task = {
    id: crypto.randomUUID(),
    title,
    description,
    assignee,
    bufferDueDate,
    finalDueDate,
    priority,
    status,
    createdAt: created,
    createdAtISO: created,
    lastUpdatedAt: created,
    blockedReason: "",
    user_id: user.id
  };

  const insertedTask = await addTaskToDB(task);

  if (insertedTask) {
    tasks.push(normalizeTask(insertedTask));
  } else {
    tasks.push(normalizeTask(task));
  }

  saveTasks();
  return true;
}

function clearTaskForm(elements) {
  elements.taskTitle.value = "";
  elements.taskDescription.value = "";
  elements.taskBufferDueDate.value = "";
  elements.taskFinalDueDate.value = "";
  elements.taskPriority.value = "Medium";
  elements.taskStatus.value = "Todo";
  elements.taskAssignee.value = currentUser;
}

async function deleteTask(id) {
  const ok = await deleteTaskFromDB(id);

  if (!ok) {
    alert("DB側の削除に失敗した");
    return;
  }

  tasks = tasks.filter(task => task.id !== id);
  reports = reports.filter(report => report.taskId !== id);

  saveTasks();
  saveReports();
  renderAll();
}

async function changeTaskStatus(id, value) {
  const rawTarget = tasks.find(task => task.id === id);
  if (!rawTarget) return;

  const normalizedValue = normalizeLegacyStatus(value);

  const updates = {
    status: normalizedValue,
    blockedReason: normalizedValue !== "Blocked" ? "" : (rawTarget.blockedReason || ""),
    lastUpdatedAt: nowISO()
  };

  const updatedTask = await updateTaskInDB(id, updates);

  if (!updatedTask) {
    console.warn("DB更新失敗。ローカルのみ更新します:", { id, value: normalizedValue });

    rawTarget.status = updates.status;
    rawTarget.blockedReason = updates.blockedReason;
    rawTarget.lastUpdatedAt = updates.lastUpdatedAt;

    saveTasks();
    renderAll();
    return;
  }

  Object.assign(rawTarget, {
    ...rawTarget,
    ...updatedTask,
    status: normalizeLegacyStatus(updatedTask.status ?? updates.status),
    blockedReason: updatedTask.blockedReason ?? updates.blockedReason,
    lastUpdatedAt: updatedTask.lastUpdatedAt ?? updates.lastUpdatedAt
  });

  saveTasks();
  renderAll();
}

async function quickSetStatus(id, value) {
  const rawTarget = tasks.find(task => task.id === id);
  if (!rawTarget) return;

  const normalizedValue = normalizeLegacyStatus(value);

  const updates = {
    status: normalizedValue,
    blockedReason: normalizedValue !== "Blocked" ? "" : (rawTarget.blockedReason || ""),
    lastUpdatedAt: nowISO()
  };

  const updatedTask = await updateTaskInDB(id, updates);

  if (!updatedTask) {
    console.warn("DB更新失敗。ローカルのみ更新します:", { id, value: normalizedValue });

    rawTarget.status = updates.status;
    rawTarget.blockedReason = updates.blockedReason;
    rawTarget.lastUpdatedAt = updates.lastUpdatedAt;

    saveTasks();
    renderAll();
    return;
  }

  Object.assign(rawTarget, {
    ...rawTarget,
    ...updatedTask,
    status: normalizeLegacyStatus(updatedTask.status ?? updates.status),
    blockedReason: updatedTask.blockedReason ?? updates.blockedReason,
    lastUpdatedAt: updatedTask.lastUpdatedAt ?? updates.lastUpdatedAt
  });

  saveTasks();
  renderAll();
}

function fillMemberSelects() {
  const assigneeSelect = document.getElementById("taskAssignee");
  const currentUserSelect = document.getElementById("currentUserSelect");

  if (assigneeSelect) {
    assigneeSelect.innerHTML = members
      .map(member => `<option value="${escapeHtml(member)}">${escapeHtml(member)}</option>`)
      .join("");
  }

  if (currentUserSelect) {
    currentUserSelect.innerHTML = members
      .map(member => `<option value="${escapeHtml(member)}">${escapeHtml(member)}</option>`)
      .join("");
    currentUserSelect.value = currentUser;
  }
}

function getDeadlineState(task) {
  const normalizedTask = normalizeTask(task);

  if (!normalizedTask.bufferDueDate && !normalizedTask.finalDueDate) {
    return {
      state: "no-date",
      label: "期限未設定"
    };
  }

  const now = getNow().getTime();
  const buffer = normalizedTask.bufferDueDate ? new Date(normalizedTask.bufferDueDate + "T23:59:59").getTime() : null;
  const final = normalizedTask.finalDueDate ? new Date(normalizedTask.finalDueDate + "T23:59:59").getTime() : null;

  if (final && now > final) {
    return {
      state: "overdue",
      label: "最終期限超過"
    };
  }

  if (buffer && now > buffer) {
    return {
      state: "danger",
      label: "最終フェーズ"
    };
  }

  return {
    state: "warning",
    label: "予備期限まで"
  };
}

/* =========================
   Supabase: 追加
========================= */
async function addTaskToDB(task) {
  const supabase = window.supabaseClient;
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("tasks")
    .insert([task])
    .select()
    .single();

  if (error) {
    console.error("Supabase task insert error:", error);
    return null;
  }

  return data;
}

/* Supabase: 更新 */
async function updateTaskInDB(id, updates) {
  const supabase = window.supabaseClient;
  if (!supabase) {
    console.error("Supabase client がありません");
    return null;
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select("*");

  if (error) {
    console.error("Supabase task update error DETAIL:", {
      id,
      updates,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      fullError: error
    });
    return null;
  }

  if (!Array.isArray(data) || data.length === 0) {
    console.warn("Supabase update succeeded but no row returned:", { id, updates, data });
    return null;
  }

  return data[0];
}

/* Supabase: 削除 */
async function deleteTaskFromDB(id) {
  const supabase = window.supabaseClient;
  if (!supabase) return false;

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Supabase task delete error:", error);
    return false;
  }

  return true;
}

/* Supabase: 自分のタスク取得 */
async function fetchTasksFromDB() {
  const supabase = window.supabaseClient;
  if (!supabase) return [];

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    console.error("Supabase auth getUser error:", authError);
    return [];
  }

  const user = authData.user;

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("createdAtISO", { ascending: false });

  if (error) {
    console.error("Supabase task fetch error:", error);
    return [];
  }

  return Array.isArray(data) ? data.map(normalizeTask) : [];
}

/* Supabase: 自分のタスク全削除 */
async function clearAllTasksFromDB() {
  const supabase = window.supabaseClient;
  if (!supabase) return false;

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    console.error("Supabase auth getUser error:", authError);
    return false;
  }

  const user = authData.user;

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("Supabase task delete error:", error);
    return false;
  }

  return true;
}