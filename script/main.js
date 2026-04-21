function bindEvents(elements) {
  elements.assignTaskBtn.addEventListener("click", async () => {
    const ok = await addTaskFromForm(elements);
    if (!ok) return;
    clearTaskForm(elements);
    renderAll();
  });

  elements.seedTaskBtn.addEventListener("click", () => {
    seedSampleTasks();
  });

  elements.clearAllBtn.addEventListener("click", async () => {
    if (!confirm("保存済みのタスクとレポートをすべて削除しますか？")) return;
    tasks = [];
    reports = [];
    saveTasks();
    saveReports();
    localStorage.removeItem(STORAGE_KEYS.seeded);
    await clearAllTasksFromDB();
    renderAll();
  });

  elements.managerModeBtn.addEventListener("click", () => {
    currentMode = "manager";
    elements.managerModeBtn.classList.add("active");
    elements.memberModeBtn.classList.remove("active");
    saveUIState();
    renderAll();
  });

  elements.memberModeBtn.addEventListener("click", () => {
    currentMode = "member";
    elements.memberModeBtn.classList.add("active");
    elements.managerModeBtn.classList.remove("active");
    saveUIState();
    renderAll();
  });

  elements.currentUserSelect.addEventListener("change", (event) => {
    currentUser = event.target.value;
    saveUIState();
    renderAll();
  });

  elements.statusFilterSelect.addEventListener("change", (event) => {
    statusFilter = event.target.value;
    saveUIState();
    renderAll();
  });

  elements.taskSearchInput.addEventListener("input", (event) => {
    taskSearchText = event.target.value.trim().toLowerCase();
    saveUIState();
    renderAll();
  });

  elements.priorityFilterSelect.addEventListener("change", (event) => {
    priorityFilter = event.target.value;
    saveUIState();
    renderAll();
  });

  elements.overdueOnlyCheckbox.addEventListener("change", (event) => {
    overdueOnly = event.target.checked;
    saveUIState();
    renderAll();
  });

  elements.pendingOnlyCheckbox.addEventListener("change", (event) => {
    pendingOnly = event.target.checked;
    saveUIState();
    renderAll();
  });

  elements.sortOrderSelect.addEventListener("change", (event) => {
    sortOrder = event.target.value;
    saveUIState();
    renderAll();
  });

  elements.resetFiltersBtn.addEventListener("click", () => {
    statusFilter = "all";
    taskSearchText = "";
    priorityFilter = "all";
    overdueOnly = false;
    pendingOnly = false;
    sortOrder = "risk";
    elements.statusFilterSelect.value = "all";
    elements.taskSearchInput.value = "";
    elements.priorityFilterSelect.value = "all";
    elements.overdueOnlyCheckbox.checked = false;
    elements.pendingOnlyCheckbox.checked = false;
    elements.sortOrderSelect.value = "risk";
    saveUIState();
    renderAll();
  });
}

async function init() {
  const elements = getElements();
  fillMemberSelects();
  loadUIState(elements);
  fillMemberSelects();
  bindEvents(elements);

  if (window.currentAuthUser) {
    const dbTasks = await fetchTasksFromDB();
    if (dbTasks.length) {
      tasks = dbTasks;
      saveTasks();
    }
  }

  if (currentMode === "manager") {
    elements.managerModeBtn.classList.add("active");
    elements.memberModeBtn.classList.remove("active");
  } else {
    elements.memberModeBtn.classList.add("active");
    elements.managerModeBtn.classList.remove("active");
  }

  clearTaskForm(elements);
  renderAll();

  Object.assign(window, {
    deleteTask,
    changeTaskStatus,
    quickSetStatus,
    sendBlockedReport,
    sendProgressReport,
    sendDoneReport,
    updateReportState,
    respondReport,
    openTaskDetail,
    closeTaskDetail,
    openTaskEdit,
    closeTaskEdit,
    saveTaskEdit,
    resetSeedFlag
  });

  document.body.classList.remove("app-loading");
  document.body.classList.add("app-ready");
}

window.addEventListener("DOMContentLoaded", init);
