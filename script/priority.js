// priority.js
// MD用 優先ロジック / 詰まり検知 / 上位抽出

const DAY_MS = 1000 * 60 * 60 * 24;

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diffDays(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function hasTag(task, tagName) {
  if (!Array.isArray(task.tags)) return false;
  return task.tags.some(tag => normalizeText(tag) === normalizeText(tagName));
}

function getTaskById(tasks, id) {
  return tasks.find(task => String(task.id) === String(id));
}

/**
 * 依存タスクが未完了か
 */
function hasUnfinishedDependencies(task, tasks) {
  if (!Array.isArray(task.blockedBy) || task.blockedBy.length === 0) return false;

  return task.blockedBy.some(depId => {
    const depTask = getTaskById(tasks, depId);
    if (!depTask) return false;
    return depTask.status !== "done";
  });
}

/**
 * 担当者の抱えている未完了件数
 */
function getAssigneeLoad(task, tasks) {
  if (!task.assigneeId) return 0;

  return tasks.filter(t => {
    return (
      String(t.assigneeId) === String(task.assigneeId) &&
      t.status !== "done"
    );
  }).length;
}

/**
 * このタスクに依存している他タスク数
 */
function getImpactCount(task, tasks) {
  return tasks.filter(t => {
    if (!Array.isArray(t.blockedBy)) return false;
    return t.blockedBy.some(depId => String(depId) === String(task.id));
  }).length;
}

/**
 * 更新されていない日数
 */
function getIdleDays(task, now = new Date()) {
  const updatedAt = toDate(task.updatedAt || task.lastActivityAt || task.createdAt);
  if (!updatedAt) return 0;
  return Math.max(0, diffDays(updatedAt, now));
}

/**
 * 期限危険度
 */
function getDeadlineScore(task, now = new Date()) {
  const bufferDate = toDate(task.bufferDueDate);
  const finalDate = toDate(task.finalDueDate || task.dueDate);

  let score = 0;
  const reasons = [];

  if (bufferDate) {
    const daysToBuffer = diffDays(now, bufferDate);

    if (daysToBuffer < 0) {
      score += 45;
      reasons.push("予備期限超過");
    } else if (daysToBuffer <= 1) {
      score += 28;
      reasons.push("予備期限が近い");
    } else if (daysToBuffer <= 3) {
      score += 16;
      reasons.push("予備期限が接近");
    }
  }

  if (finalDate) {
    const daysToFinal = diffDays(now, finalDate);

    if (daysToFinal < 0) {
      score += 80;
      reasons.push("最終期限超過");
    } else if (daysToFinal <= 1) {
      score += 40;
      reasons.push("最終期限が近い");
    } else if (daysToFinal <= 3) {
      score += 22;
      reasons.push("最終期限が接近");
    } else if (daysToFinal <= 7) {
      score += 10;
      reasons.push("期限が近づいている");
    }
  }

  return { score, reasons };
}

/**
 * 放置危険度
 */
function getIdleScore(task, now = new Date()) {
  const idleDays = getIdleDays(task, now);

  let score = 0;
  const reasons = [];

  if (idleDays >= 7) {
    score += 28;
    reasons.push(`${idleDays}日更新なし`);
  } else if (idleDays >= 4) {
    score += 18;
    reasons.push(`${idleDays}日更新なし`);
  } else if (idleDays >= 2) {
    score += 10;
    reasons.push(`${idleDays}日更新なし`);
  }

  return { score, reasons, idleDays };
}

/**
 * 重要度スコア
 */
function getImportanceScore(task) {
  let score = 0;
  const reasons = [];

  const importance = safeNumber(task.importance, 0);

  if (importance >= 5) {
    score += 25;
    reasons.push("重要度高");
  } else if (importance >= 3) {
    score += 12;
    reasons.push("重要度中");
  }

  if (hasTag(task, "urgent")) {
    score += 18;
    reasons.push("緊急タグ");
  }

  if (hasTag(task, "client")) {
    score += 14;
    reasons.push("顧客影響あり");
  }

  if (hasTag(task, "revenue")) {
    score += 14;
    reasons.push("売上影響あり");
  }

  if (hasTag(task, "approval")) {
    score += 10;
    reasons.push("承認系タスク");
  }

  return { score, reasons };
}

/**
 * 依存・影響スコア
 */
function getDependencyScore(task, tasks) {
  let score = 0;
  const reasons = [];

  const blocked = hasUnfinishedDependencies(task, tasks);
  const impactCount = getImpactCount(task, tasks);

  if (blocked) {
    score += 22;
    reasons.push("依存先待ち");
  }

  if (impactCount >= 3) {
    score += 24;
    reasons.push(`他${impactCount}件に影響`);
  } else if (impactCount >= 1) {
    score += 10;
    reasons.push(`他${impactCount}件に影響`);
  }

  return { score, reasons, blocked, impactCount };
}

/**
 * 進捗異常スコア
 */
function getProgressScore(task, now = new Date()) {
  let score = 0;
  const reasons = [];

  const progress = safeNumber(task.progress, 0);
  const idleDays = getIdleDays(task, now);
  const finalDate = toDate(task.finalDueDate || task.dueDate);

  if (progress === 0 && idleDays >= 3) {
    score += 16;
    reasons.push("未着手のまま放置");
  }

  if (progress > 0 && progress < 100 && idleDays >= 5) {
    score += 14;
    reasons.push("進捗停滞");
  }

  if (finalDate) {
    const daysToFinal = diffDays(now, finalDate);
    if (daysToFinal <= 3 && progress < 50) {
      score += 20;
      reasons.push("期限近いのに進捗不足");
    }
  }

  if (task.reportWaiting === true) {
    score += 14;
    reasons.push("報告待ち");
  }

  if (task.needsReview === true) {
    score += 10;
    reasons.push("確認待ち");
  }

  return { score, reasons };
}

/**
 * 担当者負荷スコア
 */
function getLoadScore(task, tasks) {
  const load = getAssigneeLoad(task, tasks);

  let score = 0;
  const reasons = [];

  if (load >= 8) {
    score += 12;
    reasons.push("担当者負荷高");
  } else if (load >= 5) {
    score += 6;
    reasons.push("担当者負荷中");
  }

  return { score, reasons, load };
}

/**
 * 詰まり検知
 */
export function detectJam(task, tasks, now = new Date()) {
  const idleDays = getIdleDays(task, now);
  const blocked = hasUnfinishedDependencies(task, tasks);
  const progress = safeNumber(task.progress, 0);
  const finalDate = toDate(task.finalDueDate || task.dueDate);

  let jamLevel = "none";
  const jamReasons = [];

  if (blocked) {
    jamReasons.push("依存タスク未完了");
  }

  if (idleDays >= 3 && progress === 0) {
    jamReasons.push("未着手のまま更新なし");
  }

  if (idleDays >= 5 && progress > 0 && progress < 100) {
    jamReasons.push("作業途中で停滞");
  }

  if (task.reportWaiting === true && idleDays >= 2) {
    jamReasons.push("報告待ちで停止");
  }

  if (finalDate) {
    const daysToFinal = diffDays(now, finalDate);
    if (daysToFinal <= 2 && progress < 50) {
      jamReasons.push("期限直前で進捗不足");
    }
  }

  if (jamReasons.length >= 3) {
    jamLevel = "high";
  } else if (jamReasons.length >= 2) {
    jamLevel = "medium";
  } else if (jamReasons.length >= 1) {
    jamLevel = "low";
  }

  return {
    jamLevel,
    jamReasons,
    isJammed: jamLevel !== "none"
  };
}

/**
 * 優先度計算本体
 */
export function calculateTaskPriority(task, tasks, now = new Date()) {
  if (task.status === "done") {
    return {
      score: -9999,
      label: "完了",
      reasons: ["完了済み"],
      jamLevel: "none",
      jamReasons: []
    };
  }

  const deadline = getDeadlineScore(task, now);
  const idle = getIdleScore(task, now);
  const importance = getImportanceScore(task);
  const dependency = getDependencyScore(task, tasks);
  const progress = getProgressScore(task, now);
  const load = getLoadScore(task, tasks);
  const jam = detectJam(task, tasks, now);

  let score =
    deadline.score +
    idle.score +
    importance.score +
    dependency.score +
    progress.score +
    load.score;

  if (jam.jamLevel === "high") score += 35;
  if (jam.jamLevel === "medium") score += 20;
  if (jam.jamLevel === "low") score += 8;

  const reasons = [
    ...deadline.reasons,
    ...idle.reasons,
    ...importance.reasons,
    ...dependency.reasons,
    ...progress.reasons,
    ...load.reasons,
    ...jam.jamReasons
  ];

  let label = "通常";
  if (score >= 120) label = "最優先";
  else if (score >= 80) label = "高";
  else if (score >= 45) label = "中";

  return {
    score,
    label,
    reasons: [...new Set(reasons)].slice(0, 5),
    jamLevel: jam.jamLevel,
    jamReasons: jam.jamReasons
  };
}

/**
 * 優先度付き配列を返す
 */
export function enrichTasksWithPriority(tasks, now = new Date()) {
  return tasks.map(task => {
    const priority = calculateTaskPriority(task, tasks, now);
    return {
      ...task,
      priorityScore: priority.score,
      priorityLabel: priority.label,
      priorityReasons: priority.reasons,
      jamLevel: priority.jamLevel,
      jamReasons: priority.jamReasons
    };
  });
}

/**
 * 優先順で並び替え
 */
export function sortTasksByPriority(tasks, now = new Date()) {
  const enriched = enrichTasksWithPriority(tasks, now);

  return enriched.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }

    const aUpdated = toDate(a.updatedAt || a.createdAt)?.getTime() || 0;
    const bUpdated = toDate(b.updatedAt || b.createdAt)?.getTime() || 0;

    return aUpdated - bUpdated;
  });
}

/**
 * 今やるべき3つ
 */
export function getTopPriorityTasks(tasks, limit = 3, now = new Date()) {
  return sortTasksByPriority(tasks, now)
    .filter(task => task.status !== "done")
    .slice(0, limit);
}