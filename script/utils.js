function escapeHtml(text) {
  return String(text)
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

function getHoursBetween(dateA, dateB) {
  return Math.floor((dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60));
}

function touchTask(task) {
  task.lastUpdatedAt = nowISO();
}