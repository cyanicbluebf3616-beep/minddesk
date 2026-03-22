function renderStats(elements) {
  const targetTasks = Array.isArray(getTargetTasks()) ? getTargetTasks() : [];
  const targetReports = Array.isArray(getTargetReports()) ? getTargetReports() : [];

  if (elements.statTotal) {
    elements.statTotal.textContent = targetTasks.length;
  }

  if (elements.statRisk) {
    elements.statRisk.textContent = targetTasks.filter(isRiskTask).length;
  }

  if (elements.statBlocked) {
    elements.statBlocked.textContent = targetTasks.filter(
      task => task.status === "Blocked" || !!task.blockedReason
    ).length;
  }

  if (elements.statPendingReports) {
    elements.statPendingReports.textContent = targetReports.filter(
      report => report.state === "pending"
    ).length;
  }
}

function renderDashboard(elements) {
  const targetTasks = getTargetTasks();
  const targetReports = getTargetReports();

  if (elements.dashboardTitle) {
    elements.dashboardTitle.textContent = currentMode === "manager"
      ? "判断ダッシュボード"
      : `${currentUser} の実行ダッシュボード`;
  }

  if (elements.dashboardSub) {
    elements.dashboardSub.textContent = currentMode === "manager"
      ? "危険タスクと未確認報告をまとめて優先判断"
      : "自分が今やるべきことを優先表示";
  }

  const risks = targetTasks
    .filter(isRiskTask)
    .sort((a, b) => getRiskScore(b) - getRiskScore(a));

  const stalled = targetTasks.filter(isStalled);

  const latestReports = [...targetReports]
    .sort((a, b) => {
      const ap = a.state === "pending" ? 0 : 1;
      const bp = b.state === "pending" ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return new Date(b.createdAtISO) - new Date(a.createdAtISO);
    })
    .slice(0, 6);

  const topTasks =
    currentMode === "manager"
      ? (typeof getTopPriorityTasks === "function" ? getTopPriorityTasks(3) : [])
      : (typeof getMemberTopTasks === "function" ? getMemberTopTasks(3) : []);

  if (elements.kpiDueSoon) {
    elements.kpiDueSoon.textContent = targetTasks.filter(isDueSoon).length;
  }

  if (elements.kpiHighOpen) {
    elements.kpiHighOpen.textContent = targetTasks.filter(isHighOpen).length;
  }

  if (elements.kpiPendingLinked) {
    elements.kpiPendingLinked.textContent = targetTasks.filter(hasPendingReports).length;
  }

  if (elements.topPriorityList) {
    elements.topPriorityList.innerHTML = "";

    if (topTasks.length === 0) {
      elements.topPriorityList.innerHTML = `
        <div class="empty empty-state">
          <div class="empty-title">優先タスクなし</div>
          <div class="empty-sub">新しいタスクが追加されると表示されます</div>
        </div>
      `;
    } else {
      topTasks.forEach((task, i) => {
        const el = document.createElement("div");
        el.className = "priority-item";

        const priorityLabel = currentMode === "manager" ? "今やるべき判断" : "今やるべきタスク";
        const reasons = getRiskReasons(task);
        const pendingCount = getPendingReportsForTask(task.id).length;

        el.innerHTML = `
          <div class="priority-rank">${i + 1}</div>
          <div class="priority-main">
            <div class="priority-title-row">
              <strong>${escapeHtml(task.title)}</strong>
              <span class="badge">危険度 ${getRiskScore(task)}</span>
            </div>

            <div class="priority-meta">
              ${currentMode === "manager" ? `<span>担当者: ${escapeHtml(task.assignee)}</span>` : ""}
              <span>期限: ${escapeHtml(task.finalDueDate || task.bufferDueDate || "未設定")}</span>
              <span>状態: ${escapeHtml(task.status)}</span>
              ${pendingCount ? `<span>未確認報告: ${pendingCount}件</span>` : ""}
            </div>

            <div class="chips">
              ${reasons.length
                ? reasons.map(reason => `<span class="chip">${escapeHtml(reason)}</span>`).join("")
                : `<span class="chip">通常</span>`
              }
            </div>

            <div class="priority-mode-line">${priorityLabel}</div>

            <div class="priority-actions">
              <button class="btn btn-sub" onclick="openTaskDetail('${task.id}')">詳細を見る</button>
            </div>
          </div>
        `;

        elements.topPriorityList.appendChild(el);
      });
    }
  }

  if (elements.loadCard) {
    elements.loadCard.classList.toggle("hidden", currentMode !== "manager");
  }

  if (elements.loadCardTitle) {
    elements.loadCardTitle.textContent = currentMode === "manager"
      ? "負荷 + 未確認報告"
      : "自分の状況";
  }

  if (elements.loadCardSub) {
    elements.loadCardSub.textContent = currentMode === "manager"
      ? "担当件数と報告の偏りを見る"
      : "自分の未完了と報告状況を見る";
  }

  if (elements.riskHero) {
    if (risks.length > 0) {
      const top = risks[0];
      const reasons = getRiskReasons(top).join(" / ");

      elements.riskHero.innerHTML = `
        <div class="hero-alert">
          <div class="hero-title">${escapeHtml(top.title)}</div>
          <div class="hero-sub">
            ${currentMode === "manager" ? "担当者: " + escapeHtml(top.assignee) + " / " : ""}
            ${reasons} / 最終期限: ${escapeHtml(top.finalDueDate || top.bufferDueDate || "未設定")} / 危険度: ${getRiskScore(top)}
          </div>
        </div>
      `;
    } else {
      elements.riskHero.innerHTML = `
        <div class="empty empty-state">
          <div class="empty-title">今は強い危険タスクはありません</div>
          <div class="empty-sub">
            ${currentMode === "manager"
              ? "期限超過・停止・未確認報告が増えると、ここに優先表示されます。"
              : "自分の期限接近・詰まり・未確認報告があると、ここに表示されます。"}
          </div>
        </div>
      `;
    }
  }

  if (elements.riskList) {
    elements.riskList.innerHTML = "";

    if (risks.length === 0) {
      elements.riskList.innerHTML = `<div class="empty">一覧なし</div>`;
    } else {
      risks.slice(0, 5).forEach(task => {
        const item = document.createElement("div");
        item.className = "mini-item";
        item.innerHTML = `
          <strong>${escapeHtml(task.title)}</strong>
          <span>${currentMode === "manager" ? escapeHtml(task.assignee) + " / " : ""}${getRiskReasons(task).join(" / ")}</span>
        `;
        elements.riskList.appendChild(item);
      });
    }
  }

  if (elements.stalledList) {
    elements.stalledList.innerHTML = "";

    if (stalled.length === 0) {
      elements.stalledList.innerHTML = `<div class="empty">停止タスクなし</div>`;
    } else {
      stalled.slice(0, 6).forEach(task => {
        const hours = getHoursBetween(getNow(), getTaskLastActivityDate(task));
        const item = document.createElement("div");
        item.className = "mini-item";
        item.innerHTML = `
          <strong>${escapeHtml(task.title)}</strong>
          <span>${currentMode === "manager" ? escapeHtml(task.assignee) + " / " : ""}${task.status === "Blocked" ? "Blocked状態" : hours + "時間更新なし"} / 未確認報告 ${getPendingReportsForTask(task.id).length}件</span>
        `;
        elements.stalledList.appendChild(item);
      });
    }
  }

  if (elements.loadList) {
    elements.loadList.innerHTML = "";

    const loadSource = currentMode === "manager"
      ? members.map(member => ({
          member,
          count: tasks.filter(task => task.assignee === member && task.status !== "Done").length,
          risk: tasks.filter(task => task.assignee === member && isRiskTask(task)).length,
          pending: getPendingReportCountForMember(member)
        }))
      : [{
          member: currentUser,
          count: targetTasks.filter(task => task.status !== "Done").length,
          risk: targetTasks.filter(isRiskTask).length,
          pending: getPendingReportCountForMember(currentUser)
        }];

    loadSource.sort((a, b) => {
      if (b.pending !== a.pending) return b.pending - a.pending;
      return b.count - a.count;
    });

    loadSource.forEach(row => {
      const item = document.createElement("div");
      item.className = "mini-item";
      item.innerHTML = `
        <strong>${escapeHtml(row.member)}</strong>
        <span>未完了 ${row.count}件 / 要介入 ${row.risk}件 / 未確認報告 ${row.pending}件</span>
      `;
      elements.loadList.appendChild(item);
    });
  }

  if (elements.latestReportList) {
    elements.latestReportList.innerHTML = "";

    if (latestReports.length === 0) {
      elements.latestReportList.innerHTML = `<div class="empty">新着報告なし</div>`;
    } else {
      latestReports.forEach(report => {
        const item = document.createElement("div");
        item.className = "mini-item";
        item.innerHTML = `
          <strong>[${getReportTypeLabel(report.type)}] ${escapeHtml(report.taskTitle)}</strong>
          <span>${escapeHtml(report.reporter)} / ${report.createdAtLabel} / ${getReportStateLabel(report.state)}</span>
        `;
        elements.latestReportList.appendChild(item);
      });
    }
  }
}

function renderLeftPanel(elements) {
  const isManager = currentMode === "manager";

  elements.managerForm.classList.toggle("hidden", !isManager);
  elements.memberGuide.classList.toggle("hidden", isManager);

  elements.leftPanelTitle.textContent = isManager ? "タスク割り振り" : "メンバーガイド";
  elements.leftPanelSub.textContent = isManager
    ? "管理者からメンバーへ仕事を渡す"
    : "報告が危険判定に直結する";
  elements.leftPanelBadge.textContent = isManager ? "ASSIGN" : "MEMBER";
}

function renderTaskList(elements) {
  const list = getFilteredTasks();

  elements.taskListTitle.textContent = currentMode === "manager"
    ? "チームタスク一覧"
    : `${currentUser} の今日やること`;

  const activeFilters = [];

  if (statusFilter !== "all") activeFilters.push(`状態:${statusFilter}`);
  if (priorityFilter !== "all") activeFilters.push(`優先度:${priorityFilter}`);
  if (overdueOnly) activeFilters.push("期限超過");
  if (pendingOnly) activeFilters.push("未確認報告あり");
  if (taskSearchText) activeFilters.push(`検索:${taskSearchText}`);

  if (typeof sortOrder !== "undefined") {
    const sortLabelMap = {
      risk: "危険度順",
      dueSoon: "期限が近い順",
      newest: "新しい順",
      oldestUpdate: "更新が古い順"
    };
    activeFilters.push(`並び:${sortLabelMap[sortOrder] || "危険度順"}`);
  }

  const baseSub = currentMode === "manager"
    ? "危険理由と未確認報告を含めて確認"
    : "自分の優先タスクと期限を確認";

  elements.taskListSub.textContent = activeFilters.length
    ? `${baseSub} / 絞り込み: ${activeFilters.join(" / ")}`
    : baseSub;

  elements.taskList.innerHTML = "";

  if (list.length === 0) {
    const hasTaskData = getTargetTasks().length > 0;
    const hasFilter =
      statusFilter !== "all" ||
      priorityFilter !== "all" ||
      overdueOnly ||
      pendingOnly ||
      !!taskSearchText ||
      (typeof sortOrder !== "undefined" && sortOrder !== "risk");

    let emptyTitle = "";
    let emptySub = "";

    if (!hasTaskData) {
      emptyTitle = currentMode === "manager"
        ? "まだタスクがありません"
        : "まだ担当タスクがありません";

      emptySub = currentMode === "manager"
        ? "左のフォームから最初のタスクを割り振ると、ここに一覧表示されます。"
        : "管理者からタスクが割り振られると、ここに表示されます。";
    } else if (hasFilter) {
      emptyTitle = "絞り込み条件に一致するタスクがありません";
      emptySub = "検索条件やフィルターをゆるめると、対象タスクが表示されます。";
    } else {
      emptyTitle = currentMode === "manager"
        ? "表示できるタスクがありません"
        : "今表示できる自分のタスクがありません";

      emptySub = "条件を見直すか、新しいタスクの追加を確認してください。";
    }

    elements.taskList.innerHTML = `
      <div class="empty empty-state">
        <div class="empty-title">${emptyTitle}</div>
        <div class="empty-sub">${emptySub}</div>
      </div>
    `;
    return;
  }

  list.forEach(task => {
    const deadlineState = getDeadlineState(task);
    const card = document.createElement("div");
    card.className = `task-card deadline-${deadlineState.state}`;

    const riskText = getRiskReasons(task);
    const pendingCount = getPendingReportsForTask(task.id).length;
    const ring = renderDualDeadlineRing(task);

    const actionBlock = currentMode === "manager"
      ? `
        <div class="task-actions">
          <select onchange="changeTaskStatus('${task.id}', this.value)">
            <option value="Todo" ${task.status === "Todo" ? "selected" : ""}>Todo</option>
            <option value="In Progress" ${task.status === "In Progress" ? "selected" : ""}>In Progress</option>
            <option value="Blocked" ${task.status === "Blocked" ? "selected" : ""}>Blocked</option>
            <option value="Done" ${task.status === "Done" ? "selected" : ""}>Done</option>
          </select>
          <button class="btn btn-sub" onclick="openTaskEdit('${task.id}')">編集</button>
          <button class="btn btn-danger" onclick="deleteTask('${task.id}')">削除</button>
        </div>
      `
      : `
        <div class="task-actions">
          <button class="btn btn-sub" onclick="quickSetStatus('${task.id}','Todo')">Todo</button>
          <button class="btn btn-sub" onclick="quickSetStatus('${task.id}','In Progress')">進行中</button>
          <button class="btn btn-warn" onclick="sendBlockedReport('${task.id}')">詰まり報告</button>
          <button class="btn btn-sub" onclick="sendProgressReport('${task.id}')">進捗報告</button>
          <button class="btn btn-primary" onclick="sendDoneReport('${task.id}')">完了報告</button>
        </div>
      `;

    card.innerHTML = `
      <div class="task-head">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-head-right">
          <div class="task-deadline-badge">
            ${escapeHtml(deadlineState.label)}
          </div>
          ${ring || ""}
          ${riskText.length ? `<div class="badge">危険度 ${getRiskScore(task)}</div>` : ""}
        </div>
      </div>

      <div class="task-desc">${escapeHtml(task.description || "説明なし")}</div>

      <div class="chips">
        <span class="chip ${getPriorityClass(task.priority)}">${task.priority}</span>
        <span class="chip ${getStatusClass(task.status)}">${task.status}</span>
        ${pendingCount ? `<span class="chip pending">未確認報告 ${pendingCount}</span>` : ""}
        ${riskText.map(reason => `<span class="chip">${escapeHtml(reason)}</span>`).join("")}
      </div>

      <div class="task-meta">
        <div class="meta">
          <div class="meta-label">担当者</div>
          <div class="meta-value">${escapeHtml(task.assignee)}</div>
        </div>
        <div class="meta">
          <div class="meta-label">最終期限</div>
          <div class="meta-value">${escapeHtml(task.finalDueDate || task.bufferDueDate || "-")}</div>
        </div>
        <div class="meta">
          <div class="meta-label">作成日</div>
          <div class="meta-value">${escapeHtml(formatDateLabel(task.createdAtISO || task.createdAt))}</div>
        </div>
        <div class="meta">
          <div class="meta-label">最終更新</div>
          <div class="meta-value">${new Date(task.lastUpdatedAt || task.createdAtISO).toLocaleString("ja-JP")}</div>
        </div>
      </div>

      ${actionBlock}

      <div class="task-detail-row">
        <button class="btn btn-sub" onclick="openTaskDetail('${task.id}')">詳細を見る</button>
      </div>

      ${task.blockedReason ? `
        <div class="response-box">
          <div class="response-title">詰まり理由</div>
          <div class="response-text">${escapeHtml(task.blockedReason)}</div>
        </div>
      ` : ""}
    `;

    elements.taskList.appendChild(card);
  });
}

function renderReportCenter(elements) {
  const targetReports = [...getTargetReports()]
    .sort((a, b) => {
      const ap = a.state === "pending" ? 0 : 1;
      const bp = b.state === "pending" ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return new Date(b.createdAtISO) - new Date(a.createdAtISO);
    });

  elements.reportCenterTitle.textContent = currentMode === "manager"
    ? "報告センター"
    : `${currentUser} の返信待ち / 報告一覧`;

  elements.reportCenterSub.textContent = currentMode === "manager"
    ? "未確認報告は危険度に直接影響"
    : "自分が送った報告と管理者からの反応を確認";

  elements.reportList.innerHTML = "";

  if (targetReports.length === 0) {
    const emptyTitle = currentMode === "manager"
      ? "報告はまだありません"
      : "まだ自分の報告はありません";

    const emptySub = currentMode === "manager"
      ? "メンバーが進捗・詰まり・完了を報告すると、ここに集まります。"
      : "タスクカードから進捗報告・詰まり報告・完了報告を送ると、ここに表示されます。";

    elements.reportList.innerHTML = `
      <div class="empty empty-state">
        <div class="empty-title">${emptyTitle}</div>
        <div class="empty-sub">${emptySub}</div>
      </div>
    `;
    return;
  }

  targetReports.forEach(report => {
    const card = document.createElement("div");
    card.className = "report-card";

    const task = getTaskById(report.taskId);
    const linkedRisk = task ? getRiskScore(task) : 0;

    const managerActionBlock = currentMode === "manager"
      ? `
        <div class="report-actions">
          <select onchange="updateReportState('${report.id}', this.value)">
            <option value="pending" ${report.state === "pending" ? "selected" : ""}>未確認</option>
            <option value="reviewing" ${report.state === "reviewing" ? "selected" : ""}>確認中</option>
            <option value="resolved" ${report.state === "resolved" ? "selected" : ""}>完了</option>
          </select>
          <button class="btn btn-sub" onclick="respondReport('${report.id}')">返信</button>
        </div>
      `
      : "";

    card.innerHTML = `
      <div class="report-head">
        <div>
          <div class="report-title">${escapeHtml(report.taskTitle)}</div>
          <div class="chips">
            <span class="chip ${getReportTypeClass(report.type)}">${getReportTypeLabel(report.type)}</span>
            <span class="chip ${getReportStateClass(report.state)}">${getReportStateLabel(report.state)}</span>
            ${task && isRiskTask(task) ? `<span class="chip">危険度 ${linkedRisk}</span>` : ""}
          </div>
        </div>
        <div class="badge">${report.createdAtLabel}</div>
      </div>

      <div class="task-meta">
        <div class="meta">
          <div class="meta-label">報告者</div>
          <div class="meta-value">${escapeHtml(report.reporter)}</div>
        </div>
        <div class="meta">
          <div class="meta-label">対象タスク</div>
          <div class="meta-value">${escapeHtml(report.taskTitle)}</div>
        </div>
        <div class="meta">
          <div class="meta-label">報告種別</div>
          <div class="meta-value">${getReportTypeLabel(report.type)}</div>
        </div>
        <div class="meta">
          <div class="meta-label">対応状態</div>
          <div class="meta-value">${getReportStateLabel(report.state)}</div>
        </div>
      </div>

      <div class="report-body">${escapeHtml(report.message)}</div>

      ${managerActionBlock}

      ${task ? `
        <div class="task-detail-row">
          <button class="btn btn-sub" onclick="openTaskDetail('${task.id}')">詳細を見る</button>
        </div>
      ` : ""}

      ${report.managerResponse ? `
        <div class="response-box">
          <div class="response-title">管理者コメント</div>
          <div class="response-text">${escapeHtml(report.managerResponse)}</div>
        </div>
      ` : ""}
    `;

    elements.reportList.appendChild(card);
  });
}

function renderAll() {
  const elements = getElements();
  renderStats(elements);
  renderDashboard(elements);
  renderLeftPanel(elements);
  renderTaskList(elements);
  renderReportCenter(elements);

  if (selectedTaskId) {
    renderTaskDetailPanel();
  }
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
          <div class="task-detail-kicker">TASK DETAIL</div>
          <div class="task-detail-title" id="taskDetailTitle">タスク詳細</div>
        </div>
        <button class="btn btn-sub" onclick="closeTaskDetail()">閉じる</button>
      </div>

      <div class="task-detail-body" id="taskDetailBody"></div>
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
  const panel = document.getElementById("taskDetailPanel");
  if (!panel) return;
  panel.classList.add("hidden");
}

function renderTaskDetailPanel() {
  const panel = ensureTaskDetailPanel();
  const titleEl = document.getElementById("taskDetailTitle");
  const bodyEl = document.getElementById("taskDetailBody");

  if (!titleEl || !bodyEl) return;

  const task = getTaskById(selectedTaskId);

  if (!task) {
    titleEl.textContent = "タスク詳細";
    bodyEl.innerHTML = `<div class="empty">対象タスクが見つかりません</div>`;
    panel.classList.remove("hidden");
    return;
  }

  const linkedReports = getTaskReports(task.id)
    .slice()
    .sort((a, b) => new Date(b.createdAtISO) - new Date(a.createdAtISO));

  const ring = renderDualDeadlineRing(task);

  titleEl.textContent = task.title;

  bodyEl.innerHTML = `
    ${ring ? `
      <div class="detail-card detail-card-wide">
        <div class="detail-label">期限リング</div>
        <div class="detail-value">${ring}</div>
      </div>
    ` : ""}

    <div class="task-detail-grid">
      <div class="detail-card detail-card-wide">
        <div class="detail-label">説明</div>
        <div class="detail-value">${escapeHtml(task.description || "説明なし")}</div>
      </div>

      <div class="detail-card">
        <div class="detail-label">担当者</div>
        <div class="detail-value">${escapeHtml(task.assignee || "-")}</div>
      </div>

      <div class="detail-card">
        <div class="detail-label">予備期限</div>
        <div class="detail-value">${escapeHtml(task.bufferDueDate || "-")}</div>
      </div>

      <div class="detail-card">
        <div class="detail-label">最終期限</div>
        <div class="detail-value">${escapeHtml(task.finalDueDate || "-")}</div>
      </div>

      <div class="detail-card">
        <div class="detail-label">優先度</div>
        <div class="detail-value">
          <span class="chip ${getPriorityClass(task.priority)}">${escapeHtml(task.priority || "-")}</span>
        </div>
      </div>

      <div class="detail-card">
        <div class="detail-label">状態</div>
        <div class="detail-value">
          <span class="chip ${getStatusClass(task.status)}">${escapeHtml(task.status || "-")}</span>
        </div>
      </div>

      <div class="detail-card">
        <div class="detail-label">危険度</div>
        <div class="detail-value">${getRiskScore(task)}</div>
      </div>

      <div class="detail-card">
        <div class="detail-label">危険理由</div>
        <div class="detail-value">
          ${
            getRiskReasons(task).length
              ? getRiskReasons(task).map(reason => `<span class="chip">${escapeHtml(reason)}</span>`).join(" ")
              : "なし"
          }
        </div>
      </div>

      <div class="detail-card detail-card-wide">
        <div class="detail-label">詰まり理由</div>
        <div class="detail-value">${escapeHtml(task.blockedReason || "なし")}</div>
      </div>

      <div class="detail-card">
        <div class="detail-label">作成日</div>
        <div class="detail-value">${escapeHtml(formatDateLabel(task.createdAtISO || task.createdAt))}</div>
      </div>

      <div class="detail-card">
        <div class="detail-label">最終更新</div>
        <div class="detail-value">${new Date(task.lastUpdatedAt || task.createdAtISO).toLocaleString("ja-JP")}</div>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">関連報告</div>
      ${
        linkedReports.length === 0
          ? `<div class="empty">このタスクの報告はまだありません</div>`
          : linkedReports.map(report => `
              <div class="detail-report-card">
                <div class="detail-report-head">
                  <strong>[${getReportTypeLabel(report.type)}] ${escapeHtml(report.taskTitle)}</strong>
                  <span>${escapeHtml(report.createdAtLabel)} / ${getReportStateLabel(report.state)}</span>
                </div>

                <div class="detail-report-meta">
                  <span>報告者: ${escapeHtml(report.reporter)}</span>
                </div>

                <div class="detail-report-body">${escapeHtml(report.message)}</div>

                ${
                  report.managerResponse
                    ? `
                      <div class="response-box">
                        <div class="response-title">管理者コメント</div>
                        <div class="response-text">${escapeHtml(report.managerResponse)}</div>
                      </div>
                    `
                    : ""
                }
              </div>
            `).join("")
      }
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
          <div class="task-detail-kicker">TASK EDIT</div>
          <div class="task-detail-title">タスク編集</div>
        </div>
        <button class="btn btn-sub" onclick="closeTaskEdit()">閉じる</button>
      </div>

      <div class="task-detail-body">
        <div class="form-group">
          <label for="editTaskTitle">タスク名</label>
          <input type="text" id="editTaskTitle">
        </div>

        <div class="form-group">
          <label for="editTaskDescription">内容</label>
          <textarea id="editTaskDescription"></textarea>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="editTaskAssignee">担当者</label>
            <select id="editTaskAssignee"></select>
          </div>

          <div class="form-group">
            <label for="editTaskBufferDueDate">予備期限</label>
            <input type="date" id="editTaskBufferDueDate">
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="editTaskFinalDueDate">最終期限</label>
            <input type="date" id="editTaskFinalDueDate">
          </div>

          <div class="form-group">
            <label for="editTaskPriority">優先度</label>
            <select id="editTaskPriority">
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="editTaskStatus">状態</label>
            <select id="editTaskStatus">
              <option value="Todo">Todo</option>
              <option value="In Progress">In Progress</option>
              <option value="Blocked">Blocked</option>
              <option value="Done">Done</option>
            </select>
          </div>
        </div>

        <div class="btn-row">
          <button class="btn btn-primary" onclick="saveTaskEdit()">保存</button>
          <button class="btn btn-sub" onclick="closeTaskEdit()">キャンセル</button>
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

  select.innerHTML = "";
  members.forEach(member => {
    const option = document.createElement("option");
    option.value = member;
    option.textContent = member;
    select.appendChild(option);
  });
}

function openTaskEdit(taskId) {
  const task = getTaskById(taskId);
  if (!task) return;

  editingTaskId = taskId;
  const panel = ensureTaskEditPanel();

  document.getElementById("editTaskTitle").value = task.title || "";
  document.getElementById("editTaskDescription").value = task.description || "";
  document.getElementById("editTaskAssignee").value = task.assignee || members[0];
  document.getElementById("editTaskBufferDueDate").value = task.bufferDueDate || "";
  document.getElementById("editTaskFinalDueDate").value = task.finalDueDate || "";
  document.getElementById("editTaskPriority").value = task.priority || "Medium";
  document.getElementById("editTaskStatus").value = task.status || "Todo";

  panel.classList.remove("hidden");
}

function closeTaskEdit() {
  editingTaskId = null;
  const panel = document.getElementById("taskEditPanel");
  if (!panel) return;
  panel.classList.add("hidden");
}

function saveTaskEdit() {
  if (!editingTaskId) return;

  const ok = updateTask(editingTaskId, {
    title: document.getElementById("editTaskTitle")?.value || "",
    description: document.getElementById("editTaskDescription")?.value || "",
    assignee: document.getElementById("editTaskAssignee")?.value || "",
    bufferDueDate: document.getElementById("editTaskBufferDueDate")?.value || "",
    finalDueDate: document.getElementById("editTaskFinalDueDate")?.value || "",
    priority: document.getElementById("editTaskPriority")?.value || "Medium",
    status: document.getElementById("editTaskStatus")?.value || "Todo"
  });

  if (!ok) return;

  const keepDetailOpen = selectedTaskId === editingTaskId;

  closeTaskEdit();
  renderAll();

  if (keepDetailOpen) {
    renderTaskDetailPanel();
  }
}


function renderDualDeadlineRing(task) {
  const ring = getDualDeadlineRingData(task);
  const phaseLabel = describeDeadlinePhase(task);

  const outerR = 39;
  const innerR = 31;
  const strokeW = 2;

  const outerC = 2 * Math.PI * outerR;
  const innerC = 2 * Math.PI * innerR;

  const outerOffset = outerC * (1 - ring.outerProgress);
  const innerOffset = innerC * (1 - ring.innerProgress);

  if (!ring.valid) {
    return `
      <div class="task-ring-wrap">
        <div class="dual-ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle class="dual-ring-track" cx="50" cy="50" r="${outerR}" stroke-width="1.5"></circle>
            <circle class="dual-ring-track" cx="50" cy="50" r="${innerR}" stroke-width="1.5"></circle>
          </svg>
          <div class="dual-ring-center">
            <div class="dual-ring-main">--</div>
            <div class="dual-ring-sub">日付不足</div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="task-ring-wrap">
      <div class="dual-ring ${ring.isOverdue ? "is-overdue" : ""}" title="${escapeHtml(phaseLabel)}">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <!-- outer track -->
          <circle
            class="dual-ring-track"
            cx="50"
            cy="50"
            r="${outerR}"
            stroke-width="2.2"
          ></circle>

          <!-- outer progress -->
          <circle
            class="dual-ring-progress"
            cx="50"
            cy="50"
            r="${outerR}"
            stroke-width="2.2"
            stroke="${ring.outerColor}"
            stroke-dasharray="${outerC}"
            stroke-dashoffset="${outerOffset}"
          ></circle>

          <!-- inner track -->
          <circle
            class="dual-ring-track"
            cx="50"
            cy="50"
            r="${innerR}"
            stroke-width="2.2"
          ></circle>

          <!-- inner progress -->
          <circle
            class="dual-ring-progress"
            cx="50"
            cy="50"
            r="${innerR}"
            stroke-width="2.2"
            stroke="${ring.innerColor}"
            stroke-dasharray="${innerC}"
            stroke-dashoffset="${innerOffset}"
          ></circle>
        </svg>

        <div class="dual-ring-center">
          <div class="dual-ring-main">${escapeHtml(ring.centerMain)}</div>
          <div class="dual-ring-sub">${escapeHtml(ring.centerSub)}</div>
        </div>
      </div>
    </div>
  `;
}