function getTaskById(id) {
  return tasks.find(task => task.id === id);
}

function getTaskLastActivityDate(task) {
  return new Date(task.lastUpdatedAt || task.createdAtISO || nowISO());
}

function isDueSoon(task) {
  if (!task.dueDate || task.status === "Done") return false;
  const now = getNow();
  const due = new Date(task.dueDate + "T23:59:59");
  const diff = due.getTime() - now.getTime();
  return diff >= 0 && diff <= 1000 * 60 * 60 * 24;
}

function isOverdue(task) {
  if (!task.dueDate || task.status === "Done") return false;
  const due = new Date(task.dueDate + "T23:59:59");
  return due.getTime() < getNow().getTime();
}

function isHighOpen(task) {
  return task.priority === "High" && task.status !== "Done";
}

function isStalled(task) {
  if (task.status === "Done") return false;
  if (task.status === "Blocked") return true;
  const hours = getHoursBetween(getNow(), getTaskLastActivityDate(task));
  return hours >= 48;
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

function getTargetTasks() {
  return currentMode === "manager"
    ? tasks
    : tasks.filter(task => task.assignee === currentUser);
}

function getFilteredTasks() {
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
    list = list.filter(task => {
      const title = (task.title || "").toLowerCase();
      const description = (task.description || "").toLowerCase();
      const assignee = (task.assignee || "").toLowerCase();
      const blockedReason = (task.blockedReason || "").toLowerCase();

      return (
        title.includes(taskSearchText) ||
        description.includes(taskSearchText) ||
        assignee.includes(taskSearchText) ||
        blockedReason.includes(taskSearchText)
      );
    });
  }

  if (sortOrder === "dueSoon") {
    return list.sort((a, b) => {
      const aTime = a.dueDate ? new Date(a.dueDate + "T23:59:59").getTime() : Infinity;
      const bTime = b.dueDate ? new Date(b.dueDate + "T23:59:59").getTime() : Infinity;
      return aTime - bTime;
    });
  }

  if (sortOrder === "newest") {
    return list.sort((a, b) => {
      return new Date(b.createdAtISO) - new Date(a.createdAtISO);
    });
  }

  if (sortOrder === "oldestUpdate") {
    return list.sort((a, b) => {
      return new Date(a.lastUpdatedAt || a.createdAtISO) - new Date(b.lastUpdatedAt || b.createdAtISO);
    });
  }

  return list.sort((a, b) => getRiskScore(b) - getRiskScore(a));
}

function addTaskFromForm(elements) {
  const title = elements.taskTitle.value.trim();
  const description = elements.taskDescription.value.trim();
  const assignee = elements.taskAssignee.value;
  const dueDate = elements.taskDueDate.value;
  const priority = elements.taskPriority.value;
  const status = elements.taskStatus.value;

  if (!title) {
    alert("タスク名を入力して");
    return;
  }

  const created = nowISO();

  const task = {
    id: crypto.randomUUID(),
    title,
    description,
    assignee,
    dueDate,
    priority,
    status,
    createdAt: new Date().toLocaleDateString("ja-JP"),
    createdAtISO: created,
    lastUpdatedAt: created,
    blockedReason: ""
  };

  tasks.push(task);
  saveTasks();
}

function clearTaskForm(elements) {
  elements.taskTitle.value = "";
  elements.taskDescription.value = "";
  elements.taskDueDate.value = "";
  elements.taskPriority.value = "Medium";
  elements.taskStatus.value = "Todo";
  elements.taskAssignee.value = currentUser;
}

function deleteTask(id) {
  tasks = tasks.filter(task => task.id !== id);
  reports = reports.filter(report => report.taskId !== id);
  saveTasks();
  saveReports();
  renderAll();
}

function changeTaskStatus(id, value) {
  const target = getTaskById(id);
  if (!target) return;

  target.status = value;
  if (value !== "Blocked") target.blockedReason = "";
  touchTask(target);
  saveTasks();
  renderAll();
}

function quickSetStatus(id, value) {
  const target = getTaskById(id);
  if (!target) return;

  target.status = value;
  if (value !== "Blocked") target.blockedReason = "";
  touchTask(target);
  saveTasks();
  renderAll();
}

function fillMemberSelects() {
  const currentUserSelect = document.getElementById("currentUserSelect");
  const taskAssignee = document.getElementById("taskAssignee");

  if (!currentUserSelect || !taskAssignee) return;

  currentUserSelect.innerHTML = "";
  taskAssignee.innerHTML = "";

  members.forEach(member => {
    const o1 = document.createElement("option");
    o1.value = member;
    o1.textContent = member;
    currentUserSelect.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = member;
    o2.textContent = member;
    taskAssignee.appendChild(o2);
  });

  currentUserSelect.value = currentUser;
  taskAssignee.value = currentUser;
}

function updateTask(taskId, payload) {
  const task = getTaskById(taskId);
  if (!task) return false;

  const nextTitle = (payload.title || "").trim();
  if (!nextTitle) {
    alert("タスク名を入力して");
    return false;
  }

  task.title = nextTitle;
  task.description = (payload.description || "").trim();
  task.assignee = payload.assignee || task.assignee;
  task.dueDate = payload.dueDate || "";
  task.priority = payload.priority || task.priority;
  task.status = payload.status || task.status;

  if (task.status !== "Blocked") {
    task.blockedReason = "";
  }

  touchTask(task);

  reports.forEach(report => {
    if (report.taskId === task.id) {
      report.taskTitle = task.title;
      if (report.reporter && members.includes(task.assignee) && report.reporter !== task.assignee && report.type !== "progress" && report.type !== "done" && report.type !== "blocked") {
        report.reporter = task.assignee;
      }
    }
  });

  saveTasks();
  saveReports();
  return true;
}