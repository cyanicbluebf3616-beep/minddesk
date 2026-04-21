function seedSampleTasks() {
  if (localStorage.getItem(STORAGE_KEYS.seeded)) {
    alert("サンプルはすでに投入済みです。");
    return;
  }

  const now = new Date();
  const addDays = (days) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };
  const addHoursAgo = (hours) => {
    const date = new Date(now);
    date.setHours(date.getHours() - hours);
    return date.toISOString();
  };

  const seedTasks = [
    normalizeTask({
      title: "ログイン画面のレイアウト調整",
      description: "フォームの余白とボタンサイズを整え、スマホでも崩れないようにする。",
      assignee: "田中",
      bufferDueDate: addDays(0),
      finalDueDate: addDays(1),
      priority: "High",
      status: "Todo",
      createdAtISO: addHoursAgo(8),
      lastUpdatedAt: addHoursAgo(8)
    }),
    normalizeTask({
      title: "ダッシュボードカードの見直し",
      description: "優先タスクの並び順と KPI 表示の改善。",
      assignee: "山本",
      bufferDueDate: addDays(1),
      finalDueDate: addDays(2),
      priority: "High",
      status: "In Progress",
      createdAtISO: addHoursAgo(60),
      lastUpdatedAt: addHoursAgo(60)
    }),
    normalizeTask({
      title: "レポートコメント機能の確認",
      description: "管理者がコメントを返した時の表示と状態遷移を確認する。",
      assignee: "佐藤",
      bufferDueDate: addDays(-1),
      finalDueDate: addDays(0),
      priority: "Medium",
      status: "Blocked",
      blockedReason: "レビュー待ち",
      createdAtISO: addHoursAgo(80),
      lastUpdatedAt: addHoursAgo(52)
    })
  ];

  tasks = [...seedTasks, ...tasks];
  saveTasks();

  reports = [
    normalizeReport({
      taskId: seedTasks[1].id,
      taskTitle: seedTasks[1].title,
      reporter: seedTasks[1].assignee,
      type: "progress",
      message: "カード UI の 7 割まで調整済み。残りは KPI 行の表示確認です。",
      createdAtISO: addHoursAgo(2)
    }),
    ...reports
  ];
  saveReports();

  localStorage.setItem(STORAGE_KEYS.seeded, "true");
  renderAll();
}

function resetSeedFlag() {
  localStorage.removeItem(STORAGE_KEYS.seeded);
  alert("サンプル再投入を許可しました。");
}
