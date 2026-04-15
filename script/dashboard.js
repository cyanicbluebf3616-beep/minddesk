/* =========================
   dashboard.js
   役割:
   - タスクの危険理由
   - 危険度スコア
   - 今やるべき3つ抽出
========================= */

/* 締切と放置の補助情報 */
function getTaskPriorityMeta(task) {
  const now = getNow();

  const finalDue = task.finalDueDate
    ? new Date(task.finalDueDate + "T23:59:59")
    : null;

  const bufferDue = task.bufferDueDate
    ? new Date(task.bufferDueDate + "T23:59:59")
    : null;

  const lastActivity = getTaskLastActivityDate(task);
  const idleHours = getHoursBetween(now, lastActivity);
  const idleDays = Math.floor(idleHours / 24);

  let daysLeft = null;
  let hoursLeft = null;

  if (finalDue) {
    const diffMs = finalDue.getTime() - now.getTime();
    daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
  }

  return {
    finalDue,
    bufferDue,
    idleHours,
    idleDays,
    daysLeft,
    hoursLeft,
    pendingCount: getPendingReportsForTask(task.id).length
  };
}

/* タスクが危険と判断される理由一覧 */
function getRiskReasons(task) {
  const reasons = [];

  if (!task || task.status === "Done") {
    return reasons;
  }

  if (Array.isArray(task.priorityReasons) && task.priorityReasons.length > 0) {
    return [...new Set(task.priorityReasons)].slice(0, 5);
  }

  const meta = getTaskPriorityMeta(task);

  if (isOverdue(task)) {
    reasons.push("期限超過");
  } else if (meta.daysLeft !== null && meta.daysLeft <= 1) {
    reasons.push("期限1日以内");
  } else if (meta.daysLeft !== null && meta.daysLeft <= 3) {
    reasons.push("期限3日以内");
  }

  if (isHighOpen(task)) reasons.push("重要度高");

  if (task.status === "Blocked") {
    reasons.push("完全停止");
  } else if (isStalled(task)) {
    reasons.push("更新停滞");
  }

  if (meta.idleDays >= 2) {
    reasons.push(`${meta.idleDays}日放置`);
  }

  if (meta.pendingCount > 0) {
    reasons.push(`未確認報告${meta.pendingCount}件`);
  }

  return [...new Set(reasons)].slice(0, 5);
}

/* 危険度スコア */
function getRiskScore(task) {
  if (!task || task.status === "Done") return 0;

  if (typeof task.priorityScore === "number") {
    return task.priorityScore;
  }

  const meta = getTaskPriorityMeta(task);
  let score = 0;

  if (meta.daysLeft !== null) {
    if (meta.daysLeft < 0) {
      score += 120;
    } else if (meta.daysLeft <= 1) {
      score += 58;
    } else if (meta.daysLeft <= 3) {
      score += 34;
    } else if (meta.daysLeft <= 7) {
      score += 14;
    }
  }

  if (task.priority === "High") score += 22;
  else if (task.priority === "Medium") score += 10;

  if (task.status === "Blocked") {
    score += 42;
  } else if (task.status === "In Progress") {
    score += 6;
  }

  if (meta.idleHours >= 168) {
    score += 30;
  } else if (meta.idleHours >= 96) {
    score += 20;
  } else if (meta.idleHours >= 48) {
    score += 10;
  }

  score += meta.pendingCount * 18;

  return score;
}

/* 危険タスク判定 */
function isRiskTask(task) {
  if (!task || task.status === "Done") return false;
  return getRiskScore(task) > 0;
}

/* 優先カード用メタ情報 */
function enrichDashboardPriority(task) {
  const meta = getTaskPriorityMeta(task);
  const reasons = getRiskReasons(task);
  const riskScore = getRiskScore(task);

  let riskTone = "low";
  if (riskScore >= 100) {
    riskTone = "critical";
  } else if (riskScore >= 60) {
    riskTone = "high";
  } else if (riskScore >= 30) {
    riskTone = "mid";
  }

  return {
    ...task,
    riskScore,
    riskTone,
    priorityReasons: reasons,
    pendingCount: meta.pendingCount,
    idleHours: meta.idleHours,
    idleDays: meta.idleDays,
    daysLeft: meta.daysLeft,
    hoursLeft: meta.hoursLeft
  };
}

/* 管理者向け 今やるべき3つ */
function getTopPriorityTasks(limit = 3) {
  const baseList = typeof getFilteredTasksBase === "function"
    ? getFilteredTasksBase()
    : getTargetTasks();

  let enriched;

  if (typeof enrichTasksWithPriority === "function") {
    enriched = enrichTasksWithPriority(baseList).map(enrichDashboardPriority);
  } else {
    enriched = baseList.map(enrichDashboardPriority);
  }

  return enriched
    .filter(task => task.status !== "Done")
    .sort((a, b) => {
      if (b.riskScore !== a.riskScore) {
        return b.riskScore - a.riskScore;
      }

      const aDue = (a.finalDueDate || a.bufferDueDate)
        ? new Date((a.finalDueDate || a.bufferDueDate) + "T23:59:59").getTime()
        : Infinity;
      const bDue = (b.finalDueDate || b.bufferDueDate)
        ? new Date((b.finalDueDate || b.bufferDueDate) + "T23:59:59").getTime()
        : Infinity;

      if (aDue !== bDue) {
        return aDue - bDue;
      }

      const aUpdated = new Date(a.lastUpdatedAt || a.createdAtISO || a.createdAt).getTime();
      const bUpdated = new Date(b.lastUpdatedAt || b.createdAtISO || b.createdAt).getTime();

      return aUpdated - bUpdated;
    })
    .slice(0, limit);
}

/* メンバー向け 今やるべき3つ */
function getMemberTopTasks(limit = 3) {
  const baseList = typeof getFilteredTasksBase === "function"
    ? getFilteredTasksBase()
    : getTargetTasks();

  let enriched;

  if (typeof enrichTasksWithPriority === "function") {
    enriched = enrichTasksWithPriority(baseList).map(enrichDashboardPriority);
  } else {
    enriched = baseList.map(enrichDashboardPriority);
  }

  return enriched
    .filter(task => task.status !== "Done")
    .sort((a, b) => {
      const aBlocked = a.status === "Blocked" ? 1 : 0;
      const bBlocked = b.status === "Blocked" ? 1 : 0;
      if (bBlocked !== aBlocked) return bBlocked - aBlocked;

      const aOverdue = isOverdue(a) ? 1 : 0;
      const bOverdue = isOverdue(b) ? 1 : 0;
      if (bOverdue !== aOverdue) return bOverdue - aOverdue;

      if (b.riskScore !== a.riskScore) {
        return b.riskScore - a.riskScore;
      }

      const aDue = (a.finalDueDate || a.bufferDueDate)
        ? new Date((a.finalDueDate || a.bufferDueDate) + "T23:59:59").getTime()
        : Infinity;
      const bDue = (b.finalDueDate || b.bufferDueDate)
        ? new Date((b.finalDueDate || b.bufferDueDate) + "T23:59:59").getTime()
        : Infinity;

      return aDue - bDue;
    })
    .slice(0, limit);
}