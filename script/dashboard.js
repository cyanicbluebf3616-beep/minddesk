function getRiskReasons(task) {
  const reasons = [];
  if (isOverdue(task)) reasons.push("期限超過");
  if (isDueSoon(task)) reasons.push("期限接近");
  if (isHighOpen(task)) reasons.push("高優先度");
  if (isStalled(task)) reasons.push("停止中");
  if (hasPendingReports(task)) reasons.push("未確認報告");
  return reasons;
}

function getRiskScore(task) {
  let score = 0;
  if (isOverdue(task)) score += 5;
  if (isDueSoon(task)) score += 3;
  if (isHighOpen(task)) score += 2;
  if (isStalled(task)) score += 4;
  score += getPendingReportsForTask(task.id).length * 2;
  return score;
}

function isRiskTask(task) {
  if (task.status === "Done") return false;
  return getRiskScore(task) > 0;
}

function getTopPriorityTasks(limit = 3) {
  return getTargetTasks()
    .filter(task => task.status !== "Done")
    .sort((a, b) => {
      const scoreDiff = getRiskScore(b) - getRiskScore(a);
      if (scoreDiff !== 0) return scoreDiff;

      const aDue = (a.finalDueDate || a.bufferDueDate) ? new Date((a.finalDueDate || a.bufferDueDate) + "T23:59:59").getTime() : Infinity;
      const bDue = (b.finalDueDate || b.bufferDueDate) ? new Date((b.finalDueDate || b.bufferDueDate) + "T23:59:59").getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;

      return new Date(b.lastUpdatedAt || b.createdAtISO) - new Date(a.lastUpdatedAt || a.createdAtISO);
    })
    .slice(0, limit);
}

function getMemberTopTasks(limit = 3) {
  return getTargetTasks()
    .filter(task => task.status !== "Done")
    .sort((a, b) => {
      const aBlocked = a.status === "Blocked" ? 1 : 0;
      const bBlocked = b.status === "Blocked" ? 1 : 0;
      if (bBlocked !== aBlocked) return bBlocked - aBlocked;

      const aOverdue = isOverdue(a) ? 1 : 0;
      const bOverdue = isOverdue(b) ? 1 : 0;
      if (bOverdue !== aOverdue) return bOverdue - aOverdue;

      const aDue = (a.finalDueDate || a.bufferDueDate) ? new Date((a.finalDueDate || a.bufferDueDate) + "T23:59:59").getTime() : Infinity;
      const bDue = (b.finalDueDate || b.bufferDueDate) ? new Date((b.finalDueDate || b.bufferDueDate) + "T23:59:59").getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;

      return getRiskScore(b) - getRiskScore(a);
    })
    .slice(0, limit);
}