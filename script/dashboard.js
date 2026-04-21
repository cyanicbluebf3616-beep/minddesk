function getDashboardRowsByMember() {
  const base = currentMode === "manager" ? members : [currentUser];
  return base.map((member) => {
    const memberTasks = tasks.filter((task) => task.assignee === member && !isTaskDone(task));
    return {
      member,
      count: memberTasks.length,
      risk: memberTasks.filter(isRiskTask).length,
      pending: getPendingReportCountForMember(member)
    };
  });
}
