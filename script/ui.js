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
  localStorage.setItem(STORAGE_KEYS.ui, JSON.stringify({
    currentMode,
    currentUser,
    statusFilter,
    taskSearchText,
    priorityFilter,
    overdueOnly,
    pendingOnly,
    sortOrder
  }));
}

function loadUIState(elements) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ui);
    if (!raw) return;
    const ui = JSON.parse(raw);
    currentMode = ui.currentMode || "manager";
    currentUser = members.includes(ui.currentUser) ? ui.currentUser : members[0];
    statusFilter = ui.statusFilter || "all";
    taskSearchText = ui.taskSearchText || "";
    priorityFilter = ui.priorityFilter || "all";
    overdueOnly = !!ui.overdueOnly;
    pendingOnly = !!ui.pendingOnly;
    sortOrder = ui.sortOrder || "risk";

    elements.currentUserSelect.value = currentUser;
    elements.statusFilterSelect.value = statusFilter;
    elements.taskSearchInput.value = taskSearchText;
    elements.priorityFilterSelect.value = priorityFilter;
    elements.overdueOnlyCheckbox.checked = overdueOnly;
    elements.pendingOnlyCheckbox.checked = pendingOnly;
    elements.sortOrderSelect.value = sortOrder;
  } catch (error) {
    console.error("ui state load failed:", error);
  }
}

function renderStats(elements) {
  const targetTasks = getTargetTasks();
  const targetReports = getTargetReports();
  elements.statTotal.textContent = String(targetTasks.length);
  elements.statRisk.textContent = String(targetTasks.filter(isRiskTask).length);
  elements.statBlocked.textContent = String(targetTasks.filter(isStalled).length);
  elements.statPendingReports.textContent = String(targetReports.filter((report) => report.state === "pending").length);
}

function renderDashboard(elements) {
  const targetTasks = getTargetTasks();
  const targetReports = getTargetReports();
  const topTasks = currentMode === "manager" ? getTopPriorityTasks(3) : getMemberTopTasks(3);
  const riskTasks = sortTasksBySelectedOrder(targetTasks.filter(isRiskTask)).slice(0, 5);
  const stalledTasks = sortTasksBySelectedOrder(targetTasks.filter(isStalled)).slice(0, 6);
  const latestReports = targetReports
    .slice()
    .sort((a, b) => new Date(b.createdAtISO).getTime() - new Date(a.createdAtISO).getTime())
    .slice(0, 6);

  elements.dashboardTitle.textContent = currentMode === "manager" ? "判断ダッシュボード" : `${currentUser} の作業ダッシュボード`;
  elements.dashboardSub.textContent = currentMode === "manager"
    ? "チーム全体の判断材料をまとめています"
    : "自分の仕事の優先順位と詰まりを確認できます";

  elements.kpiDueSoon.textContent = String(targetTasks.filter(isDueSoon).length);
  elements.kpiHighOpen.textContent = String(targetTasks.filter(isHighOpen).length);
  elements.kpiPendingLinked.textContent = String(targetTasks.filter(hasPendingReports).length);

  if (riskTasks.length) {
    const top = enrichTask(riskTasks[0]);
    elements.riskHero.innerHTML = `
      <div class="hero-alert">
        <div class="hero-title">${escapeHtml(top.title)}</div>
        <div class="hero-sub">
          ${currentMode === "manager" ? `担当: ${escapeHtml(top.assignee)} / ` : ""}
          ${escapeHtml(top.riskReasons.join(" / ") || "要確認")} / リスクスコア ${top.riskScore}
        </div>
      </div>
    `;
  } else {
    elements.riskHero.innerHTML = `<div class="empty"><div class="empty-title">大きなリスクはありません</div><div>このまま維持できています。</div></div>`;
  }

  elements.riskList.innerHTML = riskTasks.length
    ? riskTasks.map((task) => `
        <div class="mini-item">
          <strong>${escapeHtml(task.title)}</strong>
          <span>${currentMode === "manager" ? `${escapeHtml(task.assignee)} / ` : ""}${escapeHtml(getRiskReasons(task).join(" / "))}</span>
        </div>
      `).join("")
    : `<div class="empty">表示するタスクはありません</div>`;

  elements.stalledList.innerHTML = stalledTasks.length
    ? stalledTasks.map((task) => `
        <div class="mini-item">
          <strong>${escapeHtml(task.title)}</strong>
          <span>${task.status === "Blocked" ? "Blocked" : `${getTaskIdleHours(task)} 時間更新なし`} / 未対応レポート ${getPendingReportsForTask(task.id).length} 件</span>
        </div>
      `).join("")
    : `<div class="empty">停滞タスクはありません</div>`;

  const loadRows = getDashboardRowsByMember().sort((a, b) => (b.pending + b.count) - (a.pending + a.count));
  elements.loadList.innerHTML = loadRows.map((row) => `
    <div class="mini-item">
      <strong>${escapeHtml(row.member)}</strong>
      <span>未完了 ${row.count} 件 / リスク ${row.risk} 件 / 未対応レポート ${row.pending} 件</span>
    </div>
  `).join("");

  elements.latestReportList.innerHTML = latestReports.length
    ? latestReports.map((report) => `
        <div class="mini-item">
          <strong>[${escapeHtml(getReportTypeLabel(report.type))}] ${escapeHtml(report.taskTitle)}</strong>
          <span>${escapeHtml(report.reporter)} / ${escapeHtml(report.createdAtLabel)} / ${escapeHtml(getReportStateLabel(report.state))}</span>
        </div>
      `).join("")
    : `<div class="empty">レポートはまだありません</div>`;

  elements.topPriorityList.innerHTML = topTasks.length
    ? topTasks.map((task, index) => {
        const enriched = enrichTask(task);
        return `
          <div class="priority-item">
            <div class="priority-rank">${index + 1}</div>
            <div class="priority-main">
              <div class="priority-title-row">
                <strong>${escapeHtml(task.title)}</strong>
                <span class="badge">Risk ${enriched.riskScore}</span>
              </div>
              <div class="priority-meta">
                ${currentMode === "manager" ? `<span>担当: ${escapeHtml(task.assignee)}</span>` : ""}
                <span>期限: ${escapeHtml(task.finalDueDate || "-")}</span>
                <span>状態: ${escapeHtml(task.status)}</span>
              </div>
              <div class="chips">
                ${(enriched.riskReasons.length ? enriched.riskReasons : ["平常"]).map((reason) => `<span class="chip">${escapeHtml(reason)}</span>`).join("")}
              </div>
              <div class="priority-actions">
                <button class="btn btn-sub" type="button" onclick="openTaskDetail('${task.id}')">詳細を見る</button>
              </div>
            </div>
          </div>
        `;
      }).join("")
    : `<div class="empty"><div class="empty-title">表示対象のタスクがありません</div><div>新しいタスクを追加するとここに出ます。</div></div>`;
}

function renderLeftPanel(elements) {
  const isManager = currentMode === "manager";
  elements.managerForm.classList.toggle("hidden", !isManager);
  elements.memberGuide.classList.toggle("hidden", isManager);
  elements.leftPanelTitle.textContent = isManager ? "タスク登録" : "メンバーガイド";
  elements.leftPanelSub.textContent = isManager
    ? "新しい仕事を追加し、担当と期限を設定します"
    : "進捗共有や停滞報告をここから行ってください";
  elements.leftPanelBadge.textContent = isManager ? "ASSIGN" : "MEMBER";
}

function renderStatusButtons(task) {
  const statuses = [
    { value: "Todo", label: "Queued" },
    { value: "In Progress", label: "Active" },
    { value: "Blocked", label: "Stalled" },
    { value: "Done", label: "Done" }
  ];

  return `
    <div class="status-button-group">
      ${statuses.map((item) => `
        <button class="status-btn ${task.status === item.value ? "is-active" : ""}" type="button" onclick="changeTaskStatus('${task.id}', '${item.value}')">
          ${item.label}
        </button>
      `).join("")}
    </div>
  `;
}

function renderDualDeadlineRing(task) {
  const ring = getDualDeadlineRingData(task);
  const outerR = 46;
  const innerR = 35;
  const outerC = 2 * Math.PI * outerR;
  const innerC = 2 * Math.PI * innerR;

  if (!ring.valid) {
    return `
      <div class="task-ring-wrap">
        <div class="dual-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="dual-ring-track" cx="60" cy="60" r="${outerR}" stroke-width="5"></circle>
            <circle class="dual-ring-track" cx="60" cy="60" r="${innerR}" stroke-width="7"></circle>
          </svg>
          <div class="dual-ring-core"></div>
          <div class="dual-ring-center">
            <div class="dual-ring-main">--</div>
            <div class="dual-ring-sub">日付未設定</div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="task-ring-wrap">
      <div class="dual-ring">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="dual-ring-track" cx="60" cy="60" r="${outerR}" stroke-width="5"></circle>
          <circle class="dual-ring-progress" cx="60" cy="60" r="${outerR}" stroke-width="5" stroke="${ring.outerColor}" stroke-dasharray="${outerC}" stroke-dashoffset="${outerC * (1 - ring.outerProgress)}"></circle>
          <circle class="dual-ring-track" cx="60" cy="60" r="${innerR}" stroke-width="7"></circle>
          <circle class="dual-ring-progress" cx="60" cy="60" r="${innerR}" stroke-width="7" stroke="${ring.innerColor}" stroke-dasharray="${innerC}" stroke-dashoffset="${innerC * (1 - ring.innerProgress)}"></circle>
        </svg>
        <div class="dual-ring-core"></div>
        <div class="dual-ring-center">
          <div class="dual-ring-main">${escapeHtml(ring.centerMain)}</div>
          <div class="dual-ring-sub">${escapeHtml(ring.centerSub)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderTaskCard(task) {
  const enriched = enrichTask(task);
  const riskClass = enriched.riskScore >= 55 ? "risk-high" : enriched.riskScore >= 25 ? "risk-mid" : "risk-low";
  const blockedBox = task.blockedReason
    ? `<div class="task-blocked-stable">停滞理由: ${escapeHtml(task.blockedReason)}</div>`
    : "";

  const managerButtons = currentMode === "manager"
    ? `
      <div class="task-action-row">
        <button class="btn btn-sub" type="button" onclick="openTaskDetail('${task.id}')">詳細</button>
        <button class="btn btn-sub" type="button" onclick="openTaskEdit('${task.id}')">編集</button>
        <button class="btn btn-danger" type="button" onclick="deleteTask('${task.id}')">削除</button>
      </div>
    `
    : `
      <div class="task-action-row">
        <button class="btn btn-sub" type="button" onclick="sendProgressReport('${task.id}')">進捗報告</button>
        <button class="btn btn-warn" type="button" onclick="sendBlockedReport('${task.id}')">停滞報告</button>
        <button class="btn btn-primary" type="button" onclick="sendDoneReport('${task.id}')">完了報告</button>
      </div>
    `;

  return `
    <article class="task-card ${riskClass}">
      <div class="task-main-stable">
        <div class="task-top-row">
          <div class="task-ring-area-stable">${renderDualDeadlineRing(task)}</div>
          <div class="task-info-block">
            <div class="task-title-row-stable">
              <div>
                <div class="task-title-stable">${escapeHtml(task.title)}</div>
                <div class="task-inline-meta-stable">
                  <span>担当: ${escapeHtml(task.assignee)}</span>
                  <span>中間期限: ${escapeHtml(task.bufferDueDate || "-")}</span>
                  <span>最終期限: ${escapeHtml(task.finalDueDate || "-")}</span>
                  <span>更新: ${escapeHtml(formatDateTimeLabel(task.lastUpdatedAt))}</span>
                </div>
              </div>
              <span class="risk-badge ${riskClass === "risk-high" ? "risk-badge-high" : riskClass === "risk-mid" ? "risk-badge-mid" : "risk-badge-low"}">
                Risk ${enriched.riskScore}
              </span>
            </div>

            <div class="chips">
              <span class="chip ${getPriorityClass(task.priority)}">${escapeHtml(task.priority)}</span>
              <span class="chip ${getStatusClass(task.status)}">${escapeHtml(task.status)}</span>
              ${(enriched.riskReasons.length ? enriched.riskReasons : ["通常"]).map((reason) => `<span class="chip">${escapeHtml(reason)}</span>`).join("")}
            </div>

            <div>${escapeHtml(task.description || "説明はまだありません。")}</div>
            ${blockedBox}
          </div>
        </div>

        <div class="task-bottom-row">
          <div>${renderStatusButtons(task)}</div>
          ${managerButtons}
        </div>
      </div>
    </article>
  `;
}

function renderTaskList(elements) {
  const list = getFilteredTasks();
  elements.taskListTitle.textContent = currentMode === "manager" ? "チームタスク一覧" : `${currentUser} の担当タスク`;
  const filters = [];
  if (statusFilter !== "all") filters.push(`状態: ${statusFilter}`);
  if (priorityFilter !== "all") filters.push(`優先度: ${priorityFilter}`);
  if (overdueOnly) filters.push("期限超過のみ");
  if (pendingOnly) filters.push("未対応レポートあり");
  if (taskSearchText) filters.push(`検索: ${taskSearchText}`);
  const sortLabelMap = {
    risk: "リスク順",
    dueSoon: "期限が近い順",
    newest: "新しい順",
    oldestUpdate: "更新が古い順"
  };
  filters.push(`並び: ${sortLabelMap[sortOrder]}`);
  elements.taskListSub.textContent = filters.join(" / ");

  elements.taskList.innerHTML = list.length
    ? list.map(renderTaskCard).join("")
    : `<div class="empty"><div class="empty-title">表示条件に合うタスクがありません</div><div>フィルターを緩めるか、新しいタスクを追加してください。</div></div>`;
}

function renderReportCenter(elements) {
  const targetReports = getTargetReports()
    .slice()
    .sort((a, b) => new Date(b.createdAtISO).getTime() - new Date(a.createdAtISO).getTime());

  elements.reportCenterTitle.textContent = currentMode === "manager" ? "レポートセンター" : `${currentUser} の送信レポート`;
  elements.reportCenterSub.textContent = currentMode === "manager"
    ? "メンバーから上がってきた進捗共有と返答を確認できます"
    : "自分が送った進捗共有を確認できます";

  elements.reportList.innerHTML = targetReports.length
    ? targetReports.map((report) => {
        const task = getTaskById(report.taskId);
        return `
          <div class="report-card">
            <div class="report-head">
              <div>
                <div class="report-title">${escapeHtml(report.taskTitle)}</div>
                <div class="chips">
                  <span class="chip ${getReportTypeClass(report.type)}">${escapeHtml(getReportTypeLabel(report.type))}</span>
                  <span class="chip ${getReportStateClass(report.state)}">${escapeHtml(getReportStateLabel(report.state))}</span>
                  ${task ? `<span class="chip">Risk ${getRiskScore(task)}</span>` : ""}
                </div>
              </div>
              <div class="badge">${escapeHtml(report.createdAtLabel)}</div>
            </div>

            <div class="task-meta">
              <div class="meta">
                <div class="meta-label">報告者</div>
                <div class="meta-value">${escapeHtml(report.reporter)}</div>
              </div>
              <div class="meta">
                <div class="meta-label">状態</div>
                <div class="meta-value">${escapeHtml(getReportStateLabel(report.state))}</div>
              </div>
            </div>

            <div class="report-body">${escapeHtml(report.message)}</div>

            ${currentMode === "manager" ? `
              <div class="report-actions">
                <select onchange="updateReportState('${report.id}', this.value)">
                  <option value="pending" ${report.state === "pending" ? "selected" : ""}>未対応</option>
                  <option value="reviewing" ${report.state === "reviewing" ? "selected" : ""}>確認中</option>
                  <option value="resolved" ${report.state === "resolved" ? "selected" : ""}>対応済み</option>
                </select>
                <button class="btn btn-sub" type="button" onclick="respondReport('${report.id}')">コメント</button>
                ${task ? `<button class="btn btn-sub" type="button" onclick="openTaskDetail('${task.id}')">タスク詳細</button>` : ""}
              </div>
            ` : ""}

            ${report.managerResponse ? `
              <div class="response-box">
                <div class="meta-label">管理者コメント</div>
                <div class="response-text">${escapeHtml(report.managerResponse)}</div>
              </div>
            ` : ""}
          </div>
        `;
      }).join("")
    : `<div class="empty"><div class="empty-title">レポートはまだありません</div><div>進捗報告を送るとここに表示されます。</div></div>`;
}

function ensureTaskDetailPanel() {
  let panel = document.getElementById("taskDetailPanel");
  if (panel) return panel;
  panel = document.createElement("div");
  panel.id = "taskDetailPanel";
  panel.className = "task-detail-panel hidden";
  panel.innerHTML = `
    <div class="task-detail-backdrop" onclick="closeTaskDetail()"></div>
    <div class="task-detail-box">
      <div class="task-detail-header">
        <div>
          <div class="badge">TASK DETAIL</div>
          <div class="task-detail-title" id="taskDetailTitle">タスク詳細</div>
        </div>
        <button class="btn btn-sub" type="button" onclick="closeTaskDetail()">閉じる</button>
      </div>
      <div id="taskDetailBody" class="task-detail-body"></div>
    </div>
  `;
  document.body.appendChild(panel);
  return panel;
}

function openTaskDetail(taskId) {
  selectedTaskId = taskId;
  renderTaskDetailPanel();
}

function closeTaskDetail() {
  selectedTaskId = null;
  document.getElementById("taskDetailPanel")?.classList.add("hidden");
}

function renderTaskDetailPanel() {
  const panel = ensureTaskDetailPanel();
  const task = getTaskById(selectedTaskId);
  const titleEl = document.getElementById("taskDetailTitle");
  const bodyEl = document.getElementById("taskDetailBody");
  if (!task) {
    titleEl.textContent = "タスク詳細";
    bodyEl.innerHTML = `<div class="empty">対象タスクが見つかりません。</div>`;
    panel.classList.remove("hidden");
    return;
  }

  const linkedReports = getTaskReports(task.id)
    .slice()
    .sort((a, b) => new Date(b.createdAtISO).getTime() - new Date(a.createdAtISO).getTime());

  titleEl.textContent = task.title;
  bodyEl.innerHTML = `
    <div class="detail-card detail-card-wide">${renderDualDeadlineRing(task)}</div>
    <div class="task-detail-grid">
      <div class="detail-card detail-card-wide">
        <div class="detail-label">説明</div>
        <div class="detail-value">${escapeHtml(task.description || "説明はありません。")}</div>
      </div>
      <div class="detail-card">
        <div class="detail-label">担当者</div>
        <div class="detail-value">${escapeHtml(task.assignee)}</div>
      </div>
      <div class="detail-card">
        <div class="detail-label">優先度</div>
        <div class="detail-value"><span class="chip ${getPriorityClass(task.priority)}">${escapeHtml(task.priority)}</span></div>
      </div>
      <div class="detail-card">
        <div class="detail-label">状態</div>
        <div class="detail-value"><span class="chip ${getStatusClass(task.status)}">${escapeHtml(task.status)}</span></div>
      </div>
      <div class="detail-card">
        <div class="detail-label">中間期限</div>
        <div class="detail-value">${escapeHtml(task.bufferDueDate || "-")}</div>
      </div>
      <div class="detail-card">
        <div class="detail-label">最終期限</div>
        <div class="detail-value">${escapeHtml(task.finalDueDate || "-")}</div>
      </div>
      <div class="detail-card">
        <div class="detail-label">リスクスコア</div>
        <div class="detail-value">${getRiskScore(task)}</div>
      </div>
      <div class="detail-card">
        <div class="detail-label">停滞理由</div>
        <div class="detail-value">${escapeHtml(task.blockedReason || "-")}</div>
      </div>
      <div class="detail-card">
        <div class="detail-label">作成日</div>
        <div class="detail-value">${escapeHtml(formatDateTimeLabel(task.createdAtISO || task.createdAt))}</div>
      </div>
      <div class="detail-card">
        <div class="detail-label">最終更新</div>
        <div class="detail-value">${escapeHtml(formatDateTimeLabel(task.lastUpdatedAt))}</div>
      </div>
    </div>
    <div class="detail-section">
      <div class="task-detail-title" style="font-size:18px;">関連レポート</div>
      ${linkedReports.length ? linkedReports.map((report) => `
        <div class="detail-report-card">
          <div class="report-head">
            <strong>[${escapeHtml(getReportTypeLabel(report.type))}] ${escapeHtml(report.taskTitle)}</strong>
            <span>${escapeHtml(report.createdAtLabel)}</span>
          </div>
          <div class="detail-value">${escapeHtml(report.message)}</div>
          ${report.managerResponse ? `<div class="response-box"><div class="meta-label">管理者コメント</div><div class="response-text">${escapeHtml(report.managerResponse)}</div></div>` : ""}
        </div>
      `).join("") : `<div class="empty">関連レポートはまだありません。</div>`}
    </div>
  `;
  panel.classList.remove("hidden");
}

function ensureTaskEditPanel() {
  let panel = document.getElementById("taskEditPanel");
  if (panel) return panel;
  panel = document.createElement("div");
  panel.id = "taskEditPanel";
  panel.className = "task-detail-panel hidden";
  panel.innerHTML = `
    <div class="task-detail-backdrop" onclick="closeTaskEdit()"></div>
    <div class="task-detail-box">
      <div class="task-detail-header">
        <div>
          <div class="badge">TASK EDIT</div>
          <div class="task-detail-title">タスク編集</div>
        </div>
        <button class="btn btn-sub" type="button" onclick="closeTaskEdit()">閉じる</button>
      </div>
      <div class="task-detail-body">
        <div class="form-group"><label for="editTaskTitle">タスク名</label><input id="editTaskTitle" type="text"></div>
        <div class="form-group"><label for="editTaskDescription">説明</label><textarea id="editTaskDescription"></textarea></div>
        <div class="form-grid">
          <div class="form-group"><label for="editTaskAssignee">担当者</label><select id="editTaskAssignee"></select></div>
          <div class="form-group"><label for="editTaskBufferDueDate">中間期限</label><input id="editTaskBufferDueDate" type="date"></div>
        </div>
        <div class="form-grid">
          <div class="form-group"><label for="editTaskFinalDueDate">最終期限</label><input id="editTaskFinalDueDate" type="date"></div>
          <div class="form-group"><label for="editTaskPriority">優先度</label><select id="editTaskPriority"><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></div>
        </div>
        <div class="form-grid">
          <div class="form-group"><label for="editTaskStatus">状態</label><select id="editTaskStatus"><option value="Todo">Queued</option><option value="In Progress">Active</option><option value="Blocked">Stalled</option><option value="Done">Completed</option></select></div>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" type="button" onclick="saveTaskEdit()">保存</button>
          <button class="btn btn-sub" type="button" onclick="closeTaskEdit()">キャンセル</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  fillEditMemberSelect();
  return panel;
}

function fillEditMemberSelect() {
  const select = document.getElementById("editTaskAssignee");
  if (!select) return;
  select.innerHTML = members.map((member) => `<option value="${escapeHtml(member)}">${escapeHtml(member)}</option>`).join("");
}

function openTaskEdit(taskId) {
  const task = getTaskById(taskId);
  if (!task) return;
  editingTaskId = taskId;
  ensureTaskEditPanel().classList.remove("hidden");
  document.getElementById("editTaskTitle").value = task.title;
  document.getElementById("editTaskDescription").value = task.description;
  document.getElementById("editTaskAssignee").value = task.assignee;
  document.getElementById("editTaskBufferDueDate").value = task.bufferDueDate;
  document.getElementById("editTaskFinalDueDate").value = task.finalDueDate;
  document.getElementById("editTaskPriority").value = task.priority;
  document.getElementById("editTaskStatus").value = task.status;
}

function closeTaskEdit() {
  editingTaskId = null;
  document.getElementById("taskEditPanel")?.classList.add("hidden");
}

async function saveTaskEdit() {
  if (!editingTaskId) return;
  const updates = {
    title: document.getElementById("editTaskTitle").value.trim(),
    description: document.getElementById("editTaskDescription").value.trim(),
    assignee: document.getElementById("editTaskAssignee").value,
    bufferDueDate: document.getElementById("editTaskBufferDueDate").value,
    finalDueDate: document.getElementById("editTaskFinalDueDate").value,
    priority: document.getElementById("editTaskPriority").value,
    status: document.getElementById("editTaskStatus").value
  };

  if (!validateTaskPayload(updates)) return;

  if (updates.status !== "Blocked") {
    updates.blockedReason = "";
  }

  await updateTask(editingTaskId, updates);
  closeTaskEdit();
  renderAll();
}

function renderAll() {
  const elements = getElements();
  renderStats(elements);
  renderDashboard(elements);
  renderLeftPanel(elements);
  renderTaskList(elements);
  renderReportCenter(elements);
  if (selectedTaskId) renderTaskDetailPanel();
}
