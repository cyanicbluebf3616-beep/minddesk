const SEED_FLAG_KEY = "minddesk_seeded";

function seedSampleTasks() {
  if (localStorage.getItem(SEED_FLAG_KEY)) {
    alert("すでにサンプルデータは投入済みです");
    return;
  }

  const now = new Date();

  function addDays(d) {
    const x = new Date(now);
    x.setDate(x.getDate() + d);
    return x.toISOString().slice(0, 10);
  }

  function addHoursISO(h) {
    const x = new Date(now);
    x.setHours(x.getHours() - h);
    return x.toISOString();
  }

  const seedTasks = [
    {
      id: crypto.randomUUID(),
      title: "ログイン画面の最終調整",
      description: "入力欄、ボタン、余白を整えてスマホ幅でも崩れないようにする",
      assignee: "田中",
      dueDate: addDays(0),
      priority: "High",
      status: "Todo",
      createdAt: new Date().toLocaleDateString("ja-JP"),
      createdAtISO: addHoursISO(10),
      lastUpdatedAt: addHoursISO(10),
      blockedReason: ""
    },
    {
      id: crypto.randomUUID(),
      title: "ダッシュボードカードの整理",
      description: "判断しやすい順に情報を再配置する",
      assignee: "佐藤",
      dueDate: addDays(1),
      priority: "High",
      status: "In Progress",
      createdAt: new Date().toLocaleDateString("ja-JP"),
      createdAtISO: addHoursISO(55),
      lastUpdatedAt: addHoursISO(55),
      blockedReason: ""
    }
  ];

  tasks = [...tasks, ...seedTasks];
  saveTasks();

  const taskMap = Object.fromEntries(seedTasks.map(t => [t.title, t.id]));

  const seedReports = [
    {
      id: crypto.randomUUID(),
      taskId: taskMap["ダッシュボードカードの整理"],
      taskTitle: "ダッシュボードカードの整理",
      reporter: "佐藤",
      type: "progress",
      message: "カード優先順位の見直しを進めています。現在70%程度です。",
      state: "pending",
      createdAtISO: addHoursISO(1),
      createdAtLabel: new Date(addHoursISO(1)).toLocaleString("ja-JP"),
      managerResponse: ""
    }
  ];

  reports = [...seedReports, ...reports];
  saveReports();

  // ★ここ追加
  localStorage.setItem(SEED_FLAG_KEY, "true");

  renderAll();
}

function resetSeedFlag() {
  localStorage.removeItem("minddesk_seeded");
  alert("seedの1回制限を解除した");
}