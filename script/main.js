function getElements() {
  return {
    managerModeBtn: document.getElementById("managerModeBtn"),
    memberModeBtn: document.getElementById("memberModeBtn"),
    currentUserSelect: document.getElementById("currentUserSelect"),
    statusFilterSelect: document.getElementById("statusFilter"),
    taskSearchInput: document.getElementById("taskSearch"),
    priorityFilterSelect: document.getElementById("priorityFilter"),
    overdueOnlyCheckbox: document.getElementById("overdueOnly"),
    pendingOnlyCheckbox: document.getElementById("pendingOnly"),
    resetFiltersBtn: document.getElementById("resetFiltersBtn"),
    sortOrderSelect: document.getElementById("sortOrder"),

    taskTitle: document.getElementById("taskTitle"),
    taskDescription: document.getElementById("taskDescription"),
    taskAssignee: document.getElementById("taskAssignee"),
    taskBufferDueDate: document.getElementById("taskBufferDueDate"),
    taskFinalDueDate: document.getElementById("taskFinalDueDate"),
    taskPriority: document.getElementById("taskPriority"),
    taskStatus: document.getElementById("taskStatus"),

    assignTaskBtn: document.getElementById("assignTaskBtn"),
    seedTaskBtn: document.getElementById("seedTaskBtn"),
    clearAllBtn: document.getElementById("clearAllBtn"),

    statTotal: document.getElementById("statTotal"),
    statRisk: document.getElementById("statRisk"),
    statBlocked: document.getElementById("statBlocked"),
    statPendingReports: document.getElementById("statPendingReports"),

    dashboardTitle: document.getElementById("dashboardTitle"),
    dashboardSub: document.getElementById("dashboardSub"),
    riskHero: document.getElementById("riskHero"),
    riskList: document.getElementById("riskList"),
    topPriorityList: document.getElementById("topPriorityList"),
    stalledList: document.getElementById("stalledList"),
    loadCard: document.getElementById("loadCard"),
    loadCardTitle: document.getElementById("loadCardTitle"),
    loadCardSub: document.getElementById("loadCardSub"),
    loadList: document.getElementById("loadList"),
    latestReportList: document.getElementById("latestReportList"),
    kpiDueSoon: document.getElementById("kpiDueSoon"),
    kpiHighOpen: document.getElementById("kpiHighOpen"),
    kpiPendingLinked: document.getElementById("kpiPendingLinked"),

    managerForm: document.getElementById("managerForm"),
    memberGuide: document.getElementById("memberGuide"),
    leftPanelTitle: document.getElementById("leftPanelTitle"),
    leftPanelSub: document.getElementById("leftPanelSub"),
    leftPanelBadge: document.getElementById("leftPanelBadge"),

    taskListTitle: document.getElementById("taskListTitle"),
    taskListSub: document.getElementById("taskListSub"),
    taskList: document.getElementById("taskList"),

    reportCenterTitle: document.getElementById("reportCenterTitle"),
    reportCenterSub: document.getElementById("reportCenterSub"),
    reportList: document.getElementById("reportList")
  };
}

function saveUIState() {
  const uiState = {
    currentMode,
    currentUser,
    statusFilter,
    taskSearchText,
    priorityFilter,
    overdueOnly,
    pendingOnly,
    sortOrder
  };

  localStorage.setItem(UI_STATE_KEY, JSON.stringify(uiState));
}

function loadUIState(elements) {
  const raw = localStorage.getItem(UI_STATE_KEY);
  if (!raw) return;

  try {
    const uiState = JSON.parse(raw);

    currentMode = uiState.currentMode || "manager";
    currentUser = members.includes(uiState.currentUser) ? uiState.currentUser : members[0];
    statusFilter = uiState.statusFilter || "all";
    taskSearchText = uiState.taskSearchText || "";
    priorityFilter = uiState.priorityFilter || "all";
    overdueOnly = !!uiState.overdueOnly;
    pendingOnly = !!uiState.pendingOnly;
    sortOrder = uiState.sortOrder || "risk";

    if (elements.currentUserSelect) {
      elements.currentUserSelect.value = currentUser;
    }

    if (elements.statusFilterSelect) {
      elements.statusFilterSelect.value = statusFilter;
    }

    if (elements.taskSearchInput) {
      elements.taskSearchInput.value = taskSearchText;
    }

    if (elements.priorityFilterSelect) {
      elements.priorityFilterSelect.value = priorityFilter;
    }

    if (elements.overdueOnlyCheckbox) {
      elements.overdueOnlyCheckbox.checked = overdueOnly;
    }

    if (elements.pendingOnlyCheckbox) {
      elements.pendingOnlyCheckbox.checked = pendingOnly;
    }

    if (elements.sortOrderSelect) {
      elements.sortOrderSelect.value = sortOrder;
    }

    if (currentMode === "manager") {
      elements.managerModeBtn?.classList.add("active");
      elements.memberModeBtn?.classList.remove("active");
    } else {
      elements.memberModeBtn?.classList.add("active");
      elements.managerModeBtn?.classList.remove("active");
    }
  } catch (error) {
    console.error("UI状態の読み込みに失敗:", error);
  }
}

function bindEvents(elements) {
  elements.assignTaskBtn.addEventListener("click", () => {
    addTaskFromForm(elements);
    clearTaskForm(elements);
    renderAll();
  });

  elements.sortOrderSelect?.addEventListener("change", (e) => {
   sortOrder = e.target.value;
   renderAll();
   saveUIState();
  });

  elements.seedTaskBtn.addEventListener("click", seedSampleTasks);

  elements.clearAllBtn.addEventListener("click", () => {
    if (!confirm("全タスクと報告を削除する？")) return;
    tasks = [];
    reports = [];
    saveTasks();
    saveReports();
    renderAll();
    localStorage.removeItem("minddesk_seeded");
  });

  elements.managerModeBtn.addEventListener("click", () => {
    currentMode = "manager";
    elements.managerModeBtn.classList.add("active");
    elements.memberModeBtn.classList.remove("active");
    renderAll();
    saveUIState();
  });

  elements.memberModeBtn.addEventListener("click", () => {
    currentMode = "member";
    elements.memberModeBtn.classList.add("active");
    elements.managerModeBtn.classList.remove("active");
    renderAll();
    saveUIState();
  });

  elements.currentUserSelect.addEventListener("change", (e) => {
    currentUser = e.target.value;
    renderAll();
    saveUIState();
  });

  elements.statusFilterSelect.addEventListener("change", (e) => {
    statusFilter = e.target.value;
    renderAll();
    saveUIState();
  });

    elements.taskSearchInput?.addEventListener("input", (e) => {
    taskSearchText = e.target.value.trim().toLowerCase();
    renderAll();
    saveUIState();
  });

  elements.priorityFilterSelect?.addEventListener("change", (e) => {
    priorityFilter = e.target.value;
    renderAll();
    saveUIState();
  });

  elements.overdueOnlyCheckbox?.addEventListener("change", (e) => {
    overdueOnly = e.target.checked;
    renderAll();
    saveUIState();
  });

  elements.pendingOnlyCheckbox?.addEventListener("change", (e) => {
    pendingOnly = e.target.checked;
    renderAll();
    saveUIState();
  });

  elements.resetFiltersBtn?.addEventListener("click", () => {
   resetAllFilters(elements);
  });
}

function resetAllFilters(elements) {
  statusFilter = "all";
  taskSearchText = "";
  priorityFilter = "all";
  overdueOnly = false;
  pendingOnly = false;
  sortOrder = "risk";

  if (elements.statusFilterSelect) {
    elements.statusFilterSelect.value = "all";
  }

  if (elements.taskSearchInput) {
    elements.taskSearchInput.value = "";
  }

  if (elements.priorityFilterSelect) {
    elements.priorityFilterSelect.value = "all";
  }

  if (elements.overdueOnlyCheckbox) {
    elements.overdueOnlyCheckbox.checked = false;
  }

  if (elements.pendingOnlyCheckbox) {
    elements.pendingOnlyCheckbox.checked = false;
  }

  if (elements.sortOrderSelect) {
    elements.sortOrderSelect.value = "risk";
  }

  renderAll();
  saveUIState();
}

function init() {
  const elements = getElements();
  fillMemberSelects();
  loadUIState(elements);
  bindEvents(elements);
  renderAll();

  window.deleteTask = deleteTask;
  window.changeTaskStatus = changeTaskStatus;
  window.quickSetStatus = quickSetStatus;
  window.sendBlockedReport = sendBlockedReport;
  window.sendProgressReport = sendProgressReport;
  window.sendDoneReport = sendDoneReport;
  window.updateReportState = updateReportState;
  window.respondReport = respondReport;
  window.openTaskDetail = openTaskDetail;
  window.closeTaskDetail = closeTaskDetail;
  window.openTaskEdit = openTaskEdit;
  window.closeTaskEdit = closeTaskEdit;
  window.saveTaskEdit = saveTaskEdit;
  window.resetSeedFlag = resetSeedFlag;

  // 👇ここに集約
  setTimeout(() => {
    window.dispatchEvent(new Event("resize"));
  }, 50);
}

init();