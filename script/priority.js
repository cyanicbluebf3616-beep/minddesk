function calculateTaskPriority(task) {
  return {
    score: getRiskScore(task),
    label: getRiskScore(task) >= 55 ? "最優先" : getRiskScore(task) >= 25 ? "高" : "通常",
    reasons: getRiskReasons(task)
  };
}
