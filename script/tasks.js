function normalizeTask(task) {
  return {
    id: task.id || uuid(),
    title: task.title || "無題タスク",
    description: task.description || "",
    assignee: members.includes(task.assignee) ? task.assignee : members[0],
    bufferDueDate: task.bufferDueDate || "",
    finalDueDate: task.finalDueDate || "",
    priority: ["High", "Medium", "Low"].includes(task.priority) ? task.priority : "Medium",
    status: ["Todo", "In Progress", "Blocked", "Done"].includes(task.status) ? task.status : "Todo",
    blockedReason: task.blockedReason || "",
    createdAt: task.createdAt || nowISO(),
    createdAtISO: task.createdAtISO || task.createdAt || nowISO(),
    lastUpdatedAt: task.lastUpdatedAt || task.createdAtISO || task.createdAt || nowISO(),
    user_id: task.user_id || null
  };
}

tasks = tasks.map(normalizeTask);

function getTaskById(id) {
  return tasks.find((task) => task.id === id) || null;
}

function getTaskLastActivityDate(task) {
  return toDate(task.lastUpdatedAt || task.createdAtISO || task.createdAt) || getNow();
}

function getTaskFinalDueDate(task) {
  return dateFromYmd(task.finalDueDate);
}

function getTaskBufferDueDate(task) {
  return dateFromYmd(task.bufferDueDate);
}

function isTaskDone(task) {
  return task.status === "Done";
}

function isDueSoon(task) {
  const due = getTaskFinalDueDate(task);
  if (!due || isTaskDone(task)) return false;
  const diff = due.getTime() - Date.now();
  return diff >= 0 && diff <= 1000 * 60 * 60 * 24;
}

function isOverdue(task) {
  const due = getTaskFinalDueDate(task);
  return !!due && !isTaskDone(task) && due.getTime() < Date.now();
}

function isHighOpen(task) {
  return task.priority === "High" && !isTaskDone(task);
}

function getTaskIdleHours(task) {
  return hoursBetween(getNow(), getTaskLastActivityDate(task));
}

function getTaskIdleDays(task) {
  return daysBetween(getNow(), getTaskLastActivityDate(task));
}

function isStalled(task) {
  if (isTaskDone(task)) return false;
  return task.status === "Blocked" || getTaskIdleHours(task) >= 48;
}

function hasDates(task) {
  return !!(task.bufferDueDate && task.finalDueDate);
}

function getRiskReasons(task) {
  const reasons = [];
  if (isOverdue(task)) reasons.push("期限超過");
  if (isDueSoon(task)) reasons.push("期限が近い");
  if (isHighOpen(task)) reasons.push("High 優先");
  if (isStalled(task)) reasons.push("停滞中");
  if (hasPendingReports(task)) reasons.push("未対応レポートあり");
  return reasons;
}

function getRiskScore(task) {
  if (isTaskDone(task)) return 0;
  let score = 0;
  if (isOverdue(task)) score += 50;
  else if (isDueSoon(task)) score += 22;

  if (task.priority === "High") score += 18;
  else if (task.priority === "Medium") score += 8;

  if (task.status === "Blocked") score += 25;
  else if (task.status === "In Progress") score += 6;

  const idleDays = getTaskIdleDays(task);
  if (idleDays >= 7) score += 18;
  else if (idleDays >= 4) score += 10;
  else if (idleDays >= 2) score += 5;

  score += getPendingReportsForTask(task.id).length * 8;
  return score;
}

function isRiskTask(task) {
  return getRiskScore(task) > 0;
}

function getPriorityClass(priority) {
  if (priority === "High") return "high";
  if (priority === "Medium") return "medium";
  return "low";
}

function getStatusClass(status) {
  if (status === "Todo") return "todo";
  if (status === "In Progress") return "progress";
  if (status === "Blocked") return "blocked";
  return "done";
}

function enrichTask(task) {
  return {
    ...task,
    riskScore: getRiskScore(task),
    riskReasons: getRiskReasons(task)
  };
}

function sortTasksBySelectedOrder(list) {
  const enriched = list.map(enrichTask);

  if (sortOrder === "dueSoon") {
    return enriched.sort((a, b) => {
      const aTime = getTaskFinalDueDate(a)?.getTime() ?? Infinity;
      const bTime = getTaskFinalDueDate(b)?.getTime() ?? Infinity;
      return aTime - bTime;
    });
  }

  if (sortOrder === "newest") {
    return enriched.sort((a, b) => {
      return new Date(b.createdAtISO).getTime() - new Date(a.createdAtISO).getTime();
    });
  }

  if (sortOrder === "oldestUpdate") {
    return enriched.sort((a, b) => {
      return getTaskLastActivityDate(a).getTime() - getTaskLastActivityDate(b).getTime();
    });
  }

  return enriched.sort((a, b) => {
    if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
    const aDue = getTaskFinalDueDate(a)?.getTime() ?? Infinity;
    const bDue = getTaskFinalDueDate(b)?.getTime() ?? Infinity;
    return aDue - bDue;
  });
}

function getTargetTasks() {
  return currentMode === "manager"
    ? tasks.slice()
    : tasks.filter((task) => task.assignee === currentUser);
}

function getFilteredTasksBase() {
  let list = getTargetTasks();

  if (statusFilter !== "all") {
    list = list.filter((task) => task.status === statusFilter);
  }

  if (priorityFilter !== "all") {
    list = list.filter((task) => task.priority === priorityFilter);
  }

  if (overdueOnly) {
    list = list.filter(isOverdue);
  }

  if (pendingOnly) {
    list = list.filter(hasPendingReports);
  }

  if (taskSearchText) {
    const keyword = taskSearchText.toLowerCase();
    list = list.filter((task) => {
      return [
        task.title,
        task.description,
        task.assignee,
        task.blockedReason
      ].some((value) => String(value || "").toLowerCase().includes(keyword));
    });
  }

  return list;
}

function getFilteredTasks() {
  return sortTasksBySelectedOrder(getFilteredTasksBase());
}

function getTopPriorityTasks(limit = 3) {
  return sortTasksBySelectedOrder(getFilteredTasksBase())
    .filter((task) => !isTaskDone(task))
    .slice(0, limit);
}

function getMemberTopTasks(limit = 3) {
  return getTopPriorityTasks(limit);
}

function fillMemberSelects() {
  const assigneeSelect = document.getElementById("taskAssignee");
  const currentUserSelect = document.getElementById("currentUserSelect");

  const options = members
    .map((member) => `<option value="${escapeHtml(member)}">${escapeHtml(member)}</option>`)
    .join("");

  if (assigneeSelect) assigneeSelect.innerHTML = options;
  if (currentUserSelect) {
    currentUserSelect.innerHTML = options;
    currentUserSelect.value = currentUser;
  }
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

function validateTaskPayload(payload) {
  if (!payload.title.trim()) {
    alert("タスク名を入力してください。");
    return false;
  }

  if (!payload.finalDueDate) {
    alert("最終期限を設定してください。");
    return false;
  }

  if (payload.bufferDueDate && payload.bufferDueDate > payload.finalDueDate) {
    alert("中間期限は最終期限より前に設定してください。");
    return false;
  }

  return true;
}

async function addTaskFromForm(elements) {
  const payload = {
    title: elements.taskTitle.value.trim(),
    description: elements.taskDescription.value.trim(),
    assignee: elements.taskAssignee.value,
    bufferDueDate: elements.taskBufferDueDate.value,
    finalDueDate: elements.taskFinalDueDate.value,
    priority: elements.taskPriority.value,
    status: elements.taskStatus.value
  };

  if (!validateTaskPayload(payload)) return false;

  const created = nowISO();
  const task = normalizeTask({
    ...payload,
    id: uuid(),
    createdAt: created,
    createdAtISO: created,
    lastUpdatedAt: created,
    user_id: window.currentAuthUser?.id || null
  });

  const saved = await addTaskToDB(task);
  tasks.unshift(normalizeTask(saved || task));
  saveTasks();
  return true;
}

async function deleteTask(id) {
  if (!confirm("このタスクと関連レポートを削除しますか？")) return;

  await deleteTaskFromDB(id);
  tasks = tasks.filter((task) => task.id !== id);
  reports = reports.filter((report) => report.taskId !== id);
  saveTasks();
  saveReports();
  renderAll();
}

async function updateTask(id, updates) {
  const target = getTaskById(id);
  if (!target) return null;

  const merged = normalizeTask({
    ...target,
    ...updates,
    lastUpdatedAt: nowISO()
  });

  const saved = await updateTaskInDB(id, merged);
  Object.assign(target, normalizeTask(saved || merged));
  saveTasks();
  return target;
}

async function changeTaskStatus(id, nextStatus) {
  const target = getTaskById(id);
  if (!target) return;

  const updates = {
    status: nextStatus,
    blockedReason: nextStatus === "Blocked" ? target.blockedReason : ""
  };

  await updateTask(id, updates);
  renderAll();
}

async function quickSetStatus(id, nextStatus) {
  await changeTaskStatus(id, nextStatus);
}

async function addTaskToDB(task) {
  const supabase = window.supabaseClient;
  if (!supabase || !window.currentAuthUser) return null;

  const { data, error } = await supabase.from("tasks").insert([task]).select().single();
  if (error) {
    console.warn("task insert skipped:", error.message);
    return null;
  }
  return data;
}

async function updateTaskInDB(id, updates) {
  const supabase = window.supabaseClient;
  if (!supabase || !window.currentAuthUser) return null;

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.warn("task update skipped:", error.message);
    return null;
  }
  return data;
}

async function deleteTaskFromDB(id) {
  const supabase = window.supabaseClient;
  if (!supabase || !window.currentAuthUser) return false;

  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) {
    console.warn("task delete skipped:", error.message);
    return false;
  }
  return true;
}

async function fetchTasksFromDB() {
  const supabase = window.supabaseClient;
  if (!supabase || !window.currentAuthUser) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", window.currentAuthUser.id)
    .order("createdAtISO", { ascending: false });

  if (error) {
    console.warn("task fetch skipped:", error.message);
    return [];
  }

  return Array.isArray(data) ? data.map(normalizeTask) : [];
}

async function clearAllTasksFromDB() {
  const supabase = window.supabaseClient;
  if (!supabase || !window.currentAuthUser) return false;

  const { error } = await supabase.from("tasks").delete().eq("user_id", window.currentAuthUser.id);
  if (error) {
    console.warn("task clear skipped:", error.message);
    return false;
  }
  return true;
}
