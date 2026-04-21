function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nowISO() {
  return new Date().toISOString();
}

function getNow() {
  return new Date();
}

function uuid() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateFromYmd(value) {
  if (!value) return null;
  return toDate(`${value}T23:59:59`);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatDateLabel(value) {
  const date = toDate(value);
  return date ? date.toLocaleDateString("ja-JP") : "-";
}

function formatDateTimeLabel(value) {
  const date = toDate(value);
  return date ? date.toLocaleString("ja-JP") : "-";
}

function formatRemaining(ms) {
  if (ms <= 0) return "期限超過";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
  if (days >= 1) return `${days}日 ${hours}時間`;
  const minutes = Math.max(1, Math.floor(ms / (1000 * 60)));
  if (minutes >= 60) return `${Math.floor(minutes / 60)}時間 ${minutes % 60}分`;
  return `${minutes}分`;
}

function hoursBetween(later, earlier) {
  return Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60 * 60));
}

function daysBetween(later, earlier) {
  return Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24));
}

function getRingColorByRatio(ratio) {
  const safe = clamp(ratio, 0, 1);
  const hue = safe < 0.5 ? 140 - safe * 120 : 80 - (safe - 0.5) * 140;
  return `hsl(${Math.max(0, hue)} 84% 62%)`;
}

function getDualDeadlineRingData(task, now = Date.now()) {
  const createdAt = toDate(task.createdAtISO || task.createdAt);
  const bufferDue = dateFromYmd(task.bufferDueDate);
  const finalDue = dateFromYmd(task.finalDueDate);

  if (!createdAt || !bufferDue || !finalDue || finalDue <= createdAt || finalDue < bufferDue) {
    return {
      valid: false,
      centerMain: "--",
      centerSub: "日付未設定",
      outerProgress: 0,
      innerProgress: 0,
      outerColor: "#64748b",
      innerColor: "#64748b",
      isOverdue: false
    };
  }

  const safeNow = typeof now === "number" ? now : new Date(now).getTime();
  const phaseOneTotal = Math.max(1, bufferDue.getTime() - createdAt.getTime());
  const phaseTwoTotal = Math.max(1, finalDue.getTime() - bufferDue.getTime());

  let outerProgress = 0;
  let innerProgress = 0;
  let outerColor = getRingColorByRatio(0);
  let innerColor = getRingColorByRatio(0);

  if (safeNow < bufferDue.getTime()) {
    const elapsed = clamp((safeNow - createdAt.getTime()) / phaseOneTotal, 0, 1);
    outerProgress = 1 - elapsed;
    outerColor = getRingColorByRatio(elapsed);
  } else if (safeNow < finalDue.getTime()) {
    const elapsed = clamp((safeNow - bufferDue.getTime()) / phaseTwoTotal, 0, 1);
    innerProgress = 1 - elapsed;
    outerColor = getRingColorByRatio(1);
    innerColor = getRingColorByRatio(elapsed);
  }

  const remainingMs = finalDue.getTime() - safeNow;

  return {
    valid: true,
    centerMain: remainingMs <= 0 ? "期限超過" : formatRemaining(remainingMs),
    centerSub: "最終期限まで",
    outerProgress,
    innerProgress,
    outerColor,
    innerColor,
    isOverdue: remainingMs <= 0
  };
}
