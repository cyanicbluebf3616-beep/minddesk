/* =========================
   utils.js
   役割:
   - HTMLエスケープ
   - 日時共通関数
   - リング表示用計算
========================= */

/* HTMLエスケープ */
function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* 現在時刻ISO */
function nowISO() {
  return new Date().toISOString();
}

/* Dateオブジェクトで今 */
function getNow() {
  return new Date();
}

/* 2日時差を時間で返す */
function getHoursBetween(dateA, dateB) {
  return Math.floor((dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60));
}

/* タスク更新日時を今にする */
function touchTask(task) {
  task.lastUpdatedAt = nowISO();
}

/* 数値を範囲内に丸める */
function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

/* 時刻文字列をミリ秒へ */
function toTime(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/* 残り時間表示 */
function formatRemaining(ms) {
  if (ms <= 0) return "期限切れ";

  const totalMinutes = Math.floor(ms / (1000 * 60));
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const totalDays = Math.floor(ms / (1000 * 60 * 60 * 24));

  if (totalDays >= 1) {
    const hours = totalHours % 24;
    return `${totalDays}日${hours}時間`;
  }

  if (totalHours >= 1) {
    const minutes = totalMinutes % 60;
    return `${totalHours}時間${minutes}分`;
  }

  return `${Math.max(1, totalMinutes)}分`;
}

/* 日付だけ表示 */
function formatDateLabel(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return escapeHtml(String(value));
  return d.toLocaleDateString("ja-JP");
}

/* 日時表示 */
function formatDateTimeLabel(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return escapeHtml(String(value));
  return d.toLocaleString("ja-JP");
}

/* 進捗比率に応じたリング色 */
function getRingColorByRatio(ratio) {
  const r = clamp(ratio, 0, 1);

  let hue;
  if (r <= 0.5) {
    hue = 120 - (r / 0.5) * 60;
  } else {
    hue = 60 - ((r - 0.5) / 0.5) * 60;
  }

  return `hsl(${hue} 85% 62%)`;
}

/* =========================
   2重リング描画データ計算
========================= */
function getDualDeadlineRingData(task, now = Date.now()) {
  const createdAt = toTime(task.createdAtISO || task.createdAt || task.createdDate || task.created_at);
  const bufferDue = toTime(task.bufferDueDate);
  const finalDue = toTime(task.finalDueDate);

  if (!createdAt || !bufferDue || !finalDue || finalDue <= createdAt || finalDue < bufferDue) {
    return {
      valid: false,
      centerMain: "--",
      centerSub: "日付不足",
      outerProgress: 0,
      innerProgress: 0,
      outerColor: "#64748b",
      innerColor: "#64748b",
      isOverdue: false,
      bufferDue: null,
      finalDue: null
    };
  }

  const safeNow = typeof now === "number" ? now : new Date(now).getTime();
  const phase1Total = Math.max(1, bufferDue - createdAt);
  const phase2Total = Math.max(1, finalDue - bufferDue);

  let outerProgress = 0;
  let innerProgress = 0;
  let outerColor = getRingColorByRatio(0);
  let innerColor = getRingColorByRatio(0);

  if (safeNow <= createdAt) {
    outerProgress = 1;
    innerProgress = 0;
    outerColor = getRingColorByRatio(0);
    innerColor = getRingColorByRatio(0);
  } else if (safeNow < bufferDue) {
    const elapsedRatio = clamp((safeNow - createdAt) / phase1Total);
    const remainRatio = 1 - elapsedRatio;

    outerProgress = remainRatio;
    innerProgress = 0;

    outerColor = getRingColorByRatio(elapsedRatio);
    innerColor = getRingColorByRatio(0);
  } else if (safeNow < finalDue) {
    const elapsedRatio = clamp((safeNow - bufferDue) / phase2Total);
    const remainRatio = 1 - elapsedRatio;

    outerProgress = 0;
    innerProgress = remainRatio;

    outerColor = getRingColorByRatio(1);
    innerColor = getRingColorByRatio(elapsedRatio);
  } else {
    outerProgress = 0;
    innerProgress = 0;

    outerColor = getRingColorByRatio(1);
    innerColor = getRingColorByRatio(1);
  }

  const remainingMs = finalDue - safeNow;
  const isOverdue = remainingMs <= 0;

  return {
    valid: true,
    createdAt,
    bufferDue,
    finalDue,
    outerProgress,
    innerProgress,
    outerColor,
    innerColor,
    remainingMs,
    isOverdue,
    centerMain: isOverdue ? "期限切れ" : formatRemaining(remainingMs),
    centerSub: isOverdue ? "over" : "最終期限まで"
  };
}

/* 今どの期限フェーズか */
function describeDeadlinePhase(task, now = Date.now()) {
  const data = getDualDeadlineRingData(task, now);
  if (!data.valid) return "日付不足";

  const safeNow = typeof now === "number" ? now : new Date(now).getTime();

  if (data.isOverdue) return "最終期限超過";
  if (safeNow < data.bufferDue) return "予備期限まで";
  if (safeNow < data.finalDue) return "最終期限まで";
  return "完了";
}

/* タスク締切状態 */
function getDeadlineState(task, now = Date.now()) {
  if (task.status === "Done" || task.completed === true) {
    return { state: "normal", label: "完了" };
  }

  const createdAt = toTime(task.createdAtISO || task.createdAt || task.createdDate || task.created_at);
  const bufferDue = toTime(task.bufferDueDate);
  const finalDue = toTime(task.finalDueDate);
  const safeNow = typeof now === "number" ? now : new Date(now).getTime();

  if (!createdAt || !bufferDue || !finalDue) {
    return { state: "no-date", label: "日付不足" };
  }

  if (safeNow >= finalDue) {
    return { state: "overdue", label: "最終期限超過" };
  }

  const remainToFinal = finalDue - safeNow;
  const oneDay = 24 * 60 * 60 * 1000;

  if (remainToFinal <= oneDay) {
    return { state: "danger", label: "最終期限24時間以内" };
  }

  if (safeNow >= bufferDue) {
    return { state: "warning", label: "予備期限超過" };
  }

  return { state: "normal", label: "進行中" };
}