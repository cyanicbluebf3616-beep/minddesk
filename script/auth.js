const SUPABASE_URL = "https://sqvmtknwywequtozlkuw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxdm10a253eXdlcXV0b3psa3V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDA4ODksImV4cCI6MjA5MDc3Njg4OX0.waulJd62-gb9LezLLdGyxzj0T5zRDFvgtBKa8BmCc4E";

window.currentAuthUser = null;
window.supabaseClient = null;

if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (error) {
    console.warn("supabase init failed:", error);
  }
}

function updateAuthStatus(user) {
  const authStatus = document.getElementById("authStatus");
  if (!authStatus) return;
  authStatus.textContent = user ? `ログイン中: ${user.email}` : "ローカルモード";
}

async function refreshAuthUser() {
  if (!window.supabaseClient) {
    window.currentAuthUser = null;
    updateAuthStatus(null);
    return null;
  }

  const { data, error } = await window.supabaseClient.auth.getUser();
  if (error) {
    console.warn("auth getUser failed:", error.message);
    window.currentAuthUser = null;
    updateAuthStatus(null);
    return null;
  }

  window.currentAuthUser = data.user || null;
  updateAuthStatus(window.currentAuthUser);
  return window.currentAuthUser;
}

window.signUp = async function signUp() {
  if (!window.supabaseClient) {
    alert("Supabase を利用できないため、ローカルモードでのみ動作します。");
    return;
  }

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const { error } = await window.supabaseClient.auth.signUp({ email, password });
  if (error) {
    alert(error.message);
    return;
  }
  await refreshAuthUser();
  alert("新規登録しました。");
};

window.login = async function login() {
  if (!window.supabaseClient) {
    alert("Supabase を利用できないため、ローカルモードでのみ動作します。");
    return;
  }

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    alert(error.message);
    return;
  }
  await refreshAuthUser();
  const dbTasks = await fetchTasksFromDB();
  if (dbTasks.length) {
    tasks = dbTasks;
    saveTasks();
  }
  renderAll();
  alert("ログインしました。");
};

window.logout = async function logout() {
  if (window.supabaseClient) {
    await window.supabaseClient.auth.signOut();
  }
  window.currentAuthUser = null;
  updateAuthStatus(null);
  renderAll();
  alert("ログアウトしました。");
};

window.addEventListener("load", () => {
  refreshAuthUser();
  if (window.supabaseClient) {
    window.supabaseClient.auth.onAuthStateChange((_event, session) => {
      window.currentAuthUser = session?.user || null;
      updateAuthStatus(window.currentAuthUser);
    });
  }
});
