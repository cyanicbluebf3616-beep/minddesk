/* =========================================================
   ui.js
   ---------------------------------------------------------
   このファイルは UI 描画まわりを担当
========================================================= */

/* =========================================================
   期限リング用の補助関数
========================================================= */
function describeDeadlinePhase(task) {
  if (!task || typeof getDualDeadlineRingData !== "function") {
    return "期限未設定";
  }

  const ring = getDualDeadlineRingData(task);

  if (!ring || !ring.valid) return "期限未設定";
  if (ring.isOverdue) return "期限超過";
  if (ring.outerProgress > 0) return "予備期限";
  return "最終期限";
}

/* =========================================================
   状態表示ラベル変換（UI専用）
========================================================= */
function getStatusDisplayLabel(status) {
  switch (status) {
    case "Todo":
    case "未着手":
      return "Queued";
    case "In Progress":
    case "進行中":
      return "In Progress";
    case "Blocked":
    case "停滞":
      return "Stalled";
    case "Done":
    case "完了":
      return "Done";
    default:
      return status || "-";
  }
}

/* =========================================================
   優先理由チップ
========================================================= */
function renderPriorityReasons(task) {
  if (!task || !Array.isArray(task.priorityReasons) || task.priorityReasons.length === 0) {
    return "";
  }

  return `
    <div class="priority-reasons">
      ${task.priorityReasons
        .slice(0, 3)
        .map((reason) => `<span class="reason-chip">${escapeHtml(reason)}</span>`)
        .join("")}
    </div>
  `;
}

/* =========================================================
   状態ボタンUI
========================================================= */
function renderStatusButtons(task) {
  const current = normalizeLegacyStatus(task.status);

  const statusDefs = [
    { value: "Todo", label: "Queued", cls: "queued" },
    { value: "In Progress", label: "In Progress", cls: "progress" },
    { value: "Blocked", label: "Stalled", cls: "stalled" },
    { value: "Done", label: "Done", cls: "done" }
  ];

  return `
    <div class="status-button-group" role="group" aria-label="Task status">
      ${statusDefs
        .map(
          (item) => `
            <button
              type="button"
              class="status-btn status-btn-${item.cls} ${current === item.value ? "is-active" : ""}"
              onclick="changeTaskStatus('${task.id}', '${item.value}')"
            >
              ${item.label}
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

/* =========================================================
   粒子テーマ
========================================================= */
function getParticleThemeByRisk(riskScore) {
  if (riskScore >= 80) {
    return {
      core: "rgba(255, 110, 130, 0.9)",
      glow: "rgba(255, 90, 110, 0.28)",
      faint: "rgba(255, 220, 225, 0.12)"
    };
  }

  if (riskScore >= 40) {
    return {
      core: "rgba(255, 205, 120, 0.82)",
      glow: "rgba(255, 185, 90, 0.22)",
      faint: "rgba(255, 235, 190, 0.10)"
    };
  }

  return {
    core: "rgba(110, 225, 180, 0.78)",
    glow: "rgba(80, 210, 165, 0.16)",
    faint: "rgba(210, 255, 240, 0.08)"
  };
}

/* =========================================================
   粒子Canvas初期化
========================================================= */
function initParticleCanvas(canvas, riskScore = 0) {
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const hostCard = canvas.parentElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const theme = getParticleThemeByRisk(riskScore);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();

  const particleCount = Math.max(
    4,
    Math.min(10, Math.floor((canvas.clientWidth * canvas.clientHeight) / 18000))
  );

  const particles = [];

  for (let i = 0; i < particleCount; i += 1) {
    particles.push({
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      r: Math.random() * 1.7 + 0.8,
      vx: (Math.random() - 0.5) * 0.08,
      vy: (Math.random() - 0.5) * 0.08,
      wobbleX: Math.random() * Math.PI * 2,
      wobbleY: Math.random() * Math.PI * 2,
      wobbleSpeedX: Math.random() * 0.012 + 0.003,
      wobbleSpeedY: Math.random() * 0.011 + 0.003,
      alpha: Math.random() * 0.16 + 0.06
    });
  }

  let rafId = null;
  let destroyed = false;

  function draw() {
    if (destroyed || !document.body.contains(canvas)) {
      cancelAnimationFrame(rafId);
      return;
    }

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    ctx.clearRect(0, 0, width, height);

    particles.forEach((p) => {
      p.wobbleX += p.wobbleSpeedX;
      p.wobbleY += p.wobbleSpeedY;

      p.x += p.vx + Math.sin(p.wobbleX) * 0.08;
      p.y += p.vy + Math.cos(p.wobbleY) * 0.08;

      if (p.x < -8) p.x = width + 8;
      if (p.x > width + 8) p.x = -8;
      if (p.y < -8) p.y = height + 8;
      if (p.y > height + 8) p.y = -8;

      const glowRadius = p.r * 4.8;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
      grad.addColorStop(0, theme.core.replace(/0\.\d+\)/, `${Math.min(0.45, p.alpha + 0.12)})`));
      grad.addColorStop(0.35, theme.glow.replace(/0\.\d+\)/, `${Math.min(0.18, p.alpha)})`));
      grad.addColorStop(1, "rgba(255,255,255,0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = theme.faint.replace(/0\.\d+\)/, `${Math.min(0.11, p.alpha * 0.7)})`);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    rafId = requestAnimationFrame(draw);
  }

  const resizeObserver = new ResizeObserver(() => {
    resize();
  });

  if (hostCard) {
    resizeObserver.observe(hostCard);
  }

  canvas._particleCleanup = () => {
    destroyed = true;
    resizeObserver.disconnect();
    cancelAnimationFrame(rafId);
  };

  rafId = requestAnimationFrame(draw);
}


/* =========================================================
   今やるべき3つ 専用UI
========================================================= */
function getNowFocusTasks(limit = 3) {
  const sourceTasks =
    currentMode === "manager"
      ? (Array.isArray(getTargetTasks()) ? getTargetTasks() : [])
      : (Array.isArray(getTargetTasks()) ? getTargetTasks() : []);

  return [...sourceTasks]
    .filter((task) => normalizeLegacyStatus(task.status) !== "Done")
    .sort((a, b) => {
      const scoreDiff = getRiskScore(b) - getRiskScore(a);
      if (scoreDiff !== 0) return scoreDiff;

      const aPending = getPendingReportsForTask(a.id).length;
      const bPending = getPendingReportsForTask(b.id).length;
      if (bPending !== aPending) return bPending - aPending;

      const aDate = new Date(a.finalDueDate || a.bufferDueDate || a.createdAtISO || 0).getTime();
      const bDate = new Date(b.finalDueDate || b.bufferDueDate || b.createdAtISO || 0).getTime();
      return aDate - bDate;
    })
    .slice(0, limit);
}

function getNowFocusTone(task) {
  const risk = getRiskScore(task);
  const status = normalizeLegacyStatus(task.status);

  if (risk >= 80 || status === "Blocked") return "critical";
  if (risk >= 55) return "high";
  if (risk >= 30) return "mid";
  return "low";
}

function getNowFocusReasonIcon(reason = "") {
  if (reason.includes("期限超過")) return "🔴";
  if (reason.includes("期限") || reason.includes("今日")) return "🟠";
  if (reason.includes("停止") || reason.includes("Blocked") || reason.includes("停滞")) return "⚠️";
  if (reason.includes("報告")) return "📨";
  if (reason.includes("放置") || reason.includes("更新")) return "🟡";
  return "•";
}

function renderNowFocusActions(task) {
  const taskId = escapeHtml(task.id);

  if (currentMode === "manager") {
    return `
      <div class="now3-actions">
        <button type="button" class="now3-btn now3-btn-start" onclick="changeTaskStatus('${taskId}', 'In Progress')">開始</button>
        <button type="button" class="now3-btn now3-btn-stall" onclick="changeTaskStatus('${taskId}', 'Blocked')">停止</button>
        <button type="button" class="now3-btn now3-btn-done" onclick="changeTaskStatus('${taskId}', 'Done')">完了</button>
        <button type="button" class="now3-btn now3-btn-sub" onclick="openTaskDetail('${taskId}')">詳細</button>
      </div>
    `;
  }

  return `
    <div class="now3-actions">
      <button type="button" class="now3-btn now3-btn-start" onclick="quickSetStatus('${taskId}','In Progress')">開始</button>
      <button type="button" class="now3-btn now3-btn-stall" onclick="sendBlockedReport('${taskId}')">詰まり</button>
      <button type="button" class="now3-btn now3-btn-done" onclick="quickSetStatus('${taskId}','Done')">完了</button>
      <button type="button" class="now3-btn now3-btn-sub" onclick="openTaskDetail('${taskId}')">詳細</button>
    </div>
  `;
}

function renderNowFocusCard(task, index) {
  const reasons = getRiskReasons(task);
  const pendingCount = getPendingReportsForTask(task.id).length;
  const tone = getNowFocusTone(task);
  const normalizedStatus = normalizeLegacyStatus(task.status);
  const reasonChips = (reasons.length ? reasons.slice(0, 3) : ["通常"]).map((reason) => `
    <span class="now3-reason-chip">${getNowFocusReasonIcon(reason)} ${escapeHtml(reason)}</span>
  `).join("");

  return `
    <article class="now3-card now3-${tone}">
      <div class="now3-rank">#${index + 1}</div>

      <div class="now3-main">
        <div class="now3-head">
          <div class="now3-title-wrap">
            <div class="now3-title">${escapeHtml(task.title)}</div>
            <div class="now3-meta">
              ${currentMode === "manager" ? `<span>担当: ${escapeHtml(task.assignee || "-")}</span>` : ""}
              <span>状態: ${escapeHtml(getStatusDisplayLabel(normalizedStatus))}</span>
              <span>最終期限: ${escapeHtml(task.finalDueDate || task.bufferDueDate || "未設定")}</span>
              ${pendingCount ? `<span>未確認報告: ${pendingCount}件</span>` : ""}
            </div>
          </div>

          <div class="now3-side">
            <div class="now3-score-label">危険度</div>
            <div class="now3-score">${getRiskScore(task)}</div>
          </div>
        </div>

        <div class="now3-reasons">
          ${reasonChips}
        </div>

        <div class="now3-mode-line">
          ${currentMode === "manager" ? "管理者が今すぐ判断すべきタスク" : "自分が今すぐ動くべきタスク"}
        </div>

        ${renderNowFocusActions(task)}
      </div>
    </article>
  `;
}

function renderNowFocusList(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return `
      <div class="empty empty-state">
        <div class="empty-title">今やるべき3つはまだありません</div>
        <div class="empty-sub">未完了タスクが追加されると、ここに優先度順で表示されます。</div>
      </div>
    `;
  }

  return tasks.map((task, index) => renderNowFocusCard(task, index)).join("");
}

/* =========================================================
   統計描画
========================================================= */
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
      (task) => task.status === "Blocked" || !!task.blockedReason
    ).length;
  }

  if (elements.statPendingReports) {
    elements.statPendingReports.textContent = targetReports.filter(
      (report) => report.state === "pending"
    ).length;
  }
}

/* =========================================================
   ダッシュボード描画
========================================================= */
function renderDashboard(elements) {
  const targetTasks = Array.isArray(getTargetTasks()) ? getTargetTasks() : [];
  const targetReports = Array.isArray(getTargetReports()) ? getTargetReports() : [];

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

  const topTasks = getNowFocusTasks(3);

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
    elements.topPriorityList.innerHTML = renderNowFocusList(topTasks);
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
            ${currentMode === "manager" ? `担当者: ${escapeHtml(top.assignee)} / ` : ""}
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
      risks.slice(0, 5).forEach((task) => {
        const item = document.createElement("div");
        item.className = "mini-item";
        item.innerHTML = `
          <strong>${escapeHtml(task.title)}</strong>
          <span>${currentMode === "manager" ? `${escapeHtml(task.assignee)} / ` : ""}${getRiskReasons(task).join(" / ")}</span>
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
      stalled.slice(0, 6).forEach((task) => {
        const hours = getHoursBetween(getNow(), getTaskLastActivityDate(task));
        const item = document.createElement("div");
        item.className = "mini-item";
        item.innerHTML = `
          <strong>${escapeHtml(task.title)}</strong>
          <span>${currentMode === "manager" ? `${escapeHtml(task.assignee)} / ` : ""}${task.status === "Blocked" ? "Blocked状態" : `${hours}時間更新なし`} / 未確認報告 ${getPendingReportsForTask(task.id).length}件</span>
        `;
        elements.stalledList.appendChild(item);
      });
    }
  }

  if (elements.loadList) {
    elements.loadList.innerHTML = "";

    const loadSource = currentMode === "manager"
      ? members.map((member) => ({
          member,
          count: tasks.filter((task) => normalizeLegacyStatus(task.status) !== "Done" && task.assignee === member).length,
          risk: tasks.filter((task) => task.assignee === member && isRiskTask(task)).length,
          pending: getPendingReportCountForMember(member)
        }))
      : [{
          member: currentUser,
          count: targetTasks.filter((task) => normalizeLegacyStatus(task.status) !== "Done").length,
          risk: targetTasks.filter(isRiskTask).length,
          pending: getPendingReportCountForMember(currentUser)
        }];

    loadSource.sort((a, b) => {
      if (b.pending !== a.pending) return b.pending - a.pending;
      return b.count - a.count;
    });

    loadSource.forEach((row) => {
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
      latestReports.forEach((report) => {
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

/* =========================================================
   左パネル描画
========================================================= */
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

/* =========================================================
   タスクリスト描画
========================================================= */
function renderTaskList(elements) {
  const list = Array.isArray(getFilteredTasks()) ? getFilteredTasks() : [];

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
    const targetTasks = Array.isArray(getTargetTasks()) ? getTargetTasks() : [];
    const hasTaskData = targetTasks.length > 0;
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

  list.forEach((task) => {
    const deadlineState = getDeadlineState(task);
    const card = document.createElement("div");

    card.className = "task-card task-card-stable";
    card.classList.add(`deadline-${deadlineState.state}`);

    const risk = getRiskScore(task);
    if (risk >= 80) {
      card.classList.add("risk-high");
    } else if (risk >= 40) {
      card.classList.add("risk-mid");
    } else {
      card.classList.add("risk-low");
    }

    const riskText = getRiskReasons(task);
    const pendingCount = getPendingReportsForTask(task.id).length;
    const ring = typeof renderDualDeadlineRing === "function"
      ? renderDualDeadlineRing(task)
      : "";

    const managerActionBlock = `
      <div class="task-action-row">
        <button type="button" class="btn btn-primary" onclick="openTaskEdit('${task.id}')">編集</button>
        <button type="button" class="btn btn-sub" onclick="openTaskDetail('${task.id}')">詳細</button>
        <button type="button" class="btn btn-danger" onclick="deleteTask('${task.id}')">削除</button>
      </div>
    `;

    const memberActionBlock = `
      <div class="task-action-row">
        <button type="button" class="btn btn-sub" onclick="quickSetStatus('${task.id}','Todo')">Queued</button>
        <button type="button" class="btn btn-sub" onclick="quickSetStatus('${task.id}','In Progress')">In Progress</button>
        <button type="button" class="btn btn-warn" onclick="sendBlockedReport('${task.id}')">詰まり</button>
        <button type="button" class="btn btn-primary" onclick="openTaskDetail('${task.id}')">詳細</button>
      </div>
    `;

    card.innerHTML = `
      <div class="task-main-stable">
        <div class="task-top-row">
          <div class="task-ring-area-stable">
            ${ring || ""}
          </div>

          <div class="task-info-block">
            <div class="task-title-row-stable">
              <div class="task-title task-title-stable">${escapeHtml(task.title)}</div>
              <div class="risk-badge risk-badge-${risk >= 80 ? "high" : risk >= 40 ? "mid" : "low"}">
                危険度 ${risk}
              </div>
            </div>

            <div class="chips chips-stable">
              <span class="chip ${getPriorityClass(task.priority)}">${escapeHtml(task.priority)}</span>
              <span class="chip ${getStatusClass(task.status)}">${escapeHtml(getStatusDisplayLabel(task.status))}</span>
              ${pendingCount ? `<span class="chip pending">未確認 ${pendingCount}</span>` : ""}
              ${riskText.map((reason) => `<span class="chip">${escapeHtml(reason)}</span>`).join("")}
            </div>

            <div class="task-inline-meta task-inline-meta-stable">
              <span>担当: ${escapeHtml(task.assignee)}</span>
              <span>予備期限: ${escapeHtml(task.bufferDueDate || "-")}</span>
              <span>最終期限: ${escapeHtml(task.finalDueDate || "-")}</span>
              <span>更新: ${new Date(task.lastUpdatedAt || task.createdAtISO).toLocaleDateString("ja-JP")}</span>
            </div>

            ${task.blockedReason ? `
              <div class="task-blocked-stable">詰まり理由: ${escapeHtml(task.blockedReason)}</div>
            ` : ""}
          </div>
        </div>

        <div class="task-bottom-row">
          ${
            currentMode === "manager"
              ? renderStatusButtons(task)
              : `
                <div class="member-status-inline">
                  <span class="member-status-label">状態:</span>
                  <span class="chip ${getStatusClass(task.status)}">${escapeHtml(getStatusDisplayLabel(task.status))}</span>
                </div>
              `
          }

          ${currentMode === "manager" ? managerActionBlock : memberActionBlock}
        </div>
      </div>
    `;

    const particleCanvas = document.createElement("canvas");
    particleCanvas.className = "particle-canvas";
    card.prepend(particleCanvas);

    initParticleCanvas(particleCanvas, risk);

    elements.taskList.appendChild(card);
  });
}

/* =========================================================
   報告センター描画
========================================================= */
function renderReportCenter(elements) {
  const baseReports = Array.isArray(getTargetReports()) ? getTargetReports() : [];
  const targetReports = [...baseReports]
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

  targetReports.forEach((report) => {
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

      ${renderPriorityReasons(task)}

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

/* =========================================================
   全体再描画
========================================================= */
function renderAll() {
  document.querySelectorAll(".particle-canvas").forEach((canvas) => {
    if (typeof canvas._particleCleanup === "function") {
      canvas._particleCleanup();
    }
  });

  const elements = getElements();
  if (!elements) return;

  renderStats(elements);

  requestAnimationFrame(() => {
    renderDashboard(elements);
    renderLeftPanel(elements);
    renderTaskList(elements);
    renderReportCenter(elements);

    if (selectedTaskId) {
      renderTaskDetailPanel();
    }
  });
}

/* =========================================================
   タスク詳細パネル生成
========================================================= */
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

/* =========================================================
   タスク詳細描画
========================================================= */
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
          <span class="chip ${getStatusClass(task.status)}">${escapeHtml(getStatusDisplayLabel(task.status || "-"))}</span>
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
              ? getRiskReasons(task).map((reason) => `<span class="chip">${escapeHtml(reason)}</span>`).join(" ")
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
          : linkedReports.map((report) => `
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

/* =========================================================
   タスク編集パネル生成
========================================================= */
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
  members.forEach((member) => {
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
  document.getElementById("editTaskStatus").value = normalizeLegacyStatus(task.status) || "Todo";

  panel.classList.remove("hidden");
}

function closeTaskEdit() {
  editingTaskId = null;
  const panel = document.getElementById("taskEditPanel");
  if (!panel) return;
  panel.classList.add("hidden");
}

async function saveTaskEdit() {
  if (!editingTaskId) return;

  const rawTarget = tasks.find((task) => task.id === editingTaskId);
  if (!rawTarget) return;

  const updates = {
    title: document.getElementById("editTaskTitle")?.value || "",
    description: document.getElementById("editTaskDescription")?.value || "",
    assignee: document.getElementById("editTaskAssignee")?.value || "",
    bufferDueDate: document.getElementById("editTaskBufferDueDate")?.value || "",
    finalDueDate: document.getElementById("editTaskFinalDueDate")?.value || "",
    priority: document.getElementById("editTaskPriority")?.value || "Medium",
    status: document.getElementById("editTaskStatus")?.value || "Todo",
    blockedReason:
      (document.getElementById("editTaskStatus")?.value || "Todo") === "Blocked"
        ? (rawTarget.blockedReason || "")
        : "",
    lastUpdatedAt: nowISO()
  };

  let updatedTask = null;

  if (typeof updateTaskInDB === "function") {
    updatedTask = await updateTaskInDB(editingTaskId, updates);
  }

  if (!updatedTask) {
    Object.assign(rawTarget, updates);
  } else {
    Object.assign(rawTarget, {
      ...rawTarget,
      ...updatedTask,
      status: normalizeLegacyStatus(updatedTask.status ?? updates.status),
      blockedReason: updatedTask.blockedReason ?? updates.blockedReason,
      lastUpdatedAt: updatedTask.lastUpdatedAt ?? updates.lastUpdatedAt
    });
  }

  saveTasks();

  const keepDetailOpen = selectedTaskId === editingTaskId;

  closeTaskEdit();
  renderAll();

  if (keepDetailOpen) {
    renderTaskDetailPanel();
  }
}

/* =========================================================
   2重期限リング描画
========================================================= */
function renderDualDeadlineRing(task) {
  if (!task || typeof getDualDeadlineRingData !== "function") {
    return "";
  }

  const ring = getDualDeadlineRingData(task);
  if (!ring) {
    return "";
  }

  const phaseLabel = describeDeadlinePhase(task);

  const outerR = 46;
  const innerR = 35;
  const outerTrackW = 4.6;
  const outerProgressW = 5.4;
  const innerTrackW = 8;
  const innerProgressW = 7;

  const outerC = 2 * Math.PI * outerR;
  const innerC = 2 * Math.PI * innerR;

  const outerOffset = outerC * (1 - (ring.outerProgress || 0));
  const innerOffset = innerC * (1 - (ring.innerProgress || 0));

  if (!ring.valid) {
    return `
      <div class="task-ring-wrap">
        <div class="dual-ring dual-ring-no-date">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="dual-ring-track dual-ring-track-outer" cx="60" cy="60" r="${outerR}" stroke-width="${outerTrackW}"></circle>
            <circle class="dual-ring-track dual-ring-track-inner" cx="60" cy="60" r="${innerR}" stroke-width="${innerTrackW}"></circle>
          </svg>
          <div class="dual-ring-core"></div>
          <div class="dual-ring-center">
            <div class="dual-ring-main">--</div>
            <div class="dual-ring-sub">日付不足</div>
            <div class="dual-ring-phase">DATE NONE</div>
          </div>
        </div>
      </div>
    `;
  }

  const phaseClass =
    ring.isOverdue
      ? "phase-overdue"
      : ring.outerProgress > 0
        ? "phase-buffer"
        : "phase-final";

  return `
    <div class="task-ring-wrap">
      <div class="dual-ring ${ring.isOverdue ? "is-overdue" : ""} ${phaseClass}" title="${escapeHtml(phaseLabel)}">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="dual-ring-track dual-ring-track-outer" cx="60" cy="60" r="${outerR}" stroke-width="${outerTrackW}"></circle>
          <circle class="dual-ring-progress dual-ring-progress-outer" cx="60" cy="60" r="${outerR}" stroke-width="${outerProgressW}" stroke="${ring.outerColor}" stroke-dasharray="${outerC}" stroke-dashoffset="${outerOffset}"></circle>
          <circle class="dual-ring-track dual-ring-track-inner" cx="60" cy="60" r="${innerR}" stroke-width="${innerTrackW}"></circle>
          <circle class="dual-ring-progress dual-ring-progress-inner" cx="60" cy="60" r="${innerR}" stroke-width="${innerProgressW}" stroke="${ring.innerColor}" stroke-dasharray="${innerC}" stroke-dashoffset="${innerOffset}"></circle>
        </svg>

        <div class="dual-ring-core"></div>

        <div class="dual-ring-center">
          <div class="dual-ring-main">${escapeHtml(ring.centerMain)}</div>
          <div class="dual-ring-sub">${escapeHtml(ring.centerSub)}</div>
          <div class="dual-ring-phase">${escapeHtml(phaseLabel)}</div>
        </div>
      </div>
    </div>
  `;
}

/* =========================================================
   初期ロード安定化
========================================================= */
window.addEventListener("load", () => {
  setTimeout(() => {
    if (typeof renderAll === "function") {
      renderAll();
    }
  }, 50);
});