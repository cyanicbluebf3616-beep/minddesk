/* =========================
   auth.js
   役割:
   - Supabase認証クライアント作成
   - 登録 / ログイン / ログアウト
   - ログイン状態表示
========================= */

/* Supabase接続情報 */
const SUPABASE_URL = "https://sqvmtknwywequtozlkuw.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxdm10a253eXdlcXV0b3psa3V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDA4ODksImV4cCI6MjA5MDc3Njg4OX0.waulJd62-gb9LezLLdGyxzj0T5zRDFvgtBKa8BmCc4E"

/* 認証用Supabaseクライアント作成 */
const authSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
)

/* 他ファイルから使えるようにwindowへ公開 */
window.authSupabase = authSupabase

/* =========================
   ログイン状態表示更新
   - userがいればメール表示
   - いなければ未ログイン表示
========================= */
function updateAuthStatus(user) {
  const authStatus = document.getElementById("authStatus")
  if (!authStatus) return

  authStatus.textContent = user
    ? "ログイン中: " + user.email
    : "未ログイン"
}

/* =========================
   現在ログイン中ユーザー取得
========================= */
window.getCurrentUser = async function () {
  const { data, error } = await authSupabase.auth.getUser()
  if (error) {
    console.error(error)
    return null
  }
  return data.user
}

/* =========================
   新規登録
   - email / password を取得
   - SupabaseでsignUp
========================= */
window.signUp = async function () {
  const email = document.getElementById("email").value.trim()
  const password = document.getElementById("password").value.trim()

  const { data, error } = await authSupabase.auth.signUp({
    email,
    password
  })

  console.log("signup result:", { data, error })

  if (error) {
    alert(error.message)
    return
  }

  updateAuthStatus(data.session?.user ?? null)
  alert("登録成功")
}

/* =========================
   ログイン
========================= */
window.login = async function () {
  const email = document.getElementById("email").value.trim()
  const password = document.getElementById("password").value.trim()

  const { data, error } = await authSupabase.auth.signInWithPassword({
    email,
    password
  })

  console.log("login result:", { data, error })

  if (error) {
    alert(error.message)
    return
  }

  /* ログイン成功後、状態表示を更新 */
  updateAuthStatus(data.session.user)

  alert("ログイン成功")
}

/* =========================
   ログアウト
========================= */
window.logout = async function () {
  const { error } = await authSupabase.auth.signOut()

  if (error) {
    alert(error.message)
    return
  }

  updateAuthStatus(null)
  alert("ログアウト成功")
}

/* =========================
   ページ読み込み時
   - すでにログイン済みなら状態表示を復元
========================= */
window.addEventListener("load", async () => {
  const { data, error } = await authSupabase.auth.getUser()

  if (error) {
    console.error(error)
    updateAuthStatus(null)
    return
  }

  updateAuthStatus(data.user)
})

/* =========================
   認証状態変化監視
   - ログイン / ログアウト時に自動反映
========================= */
authSupabase.auth.onAuthStateChange((event, session) => {
  console.log("auth change:", event, session)
  updateAuthStatus(session?.user ?? null)
})