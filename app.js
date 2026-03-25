import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-analytics.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// -----------------------------
// Firebase
// -----------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBAtfqAKGiugdzpiISoeGQ6ZH4i7tTc6tY",
  authDomain: "ppoikamo-10.firebaseapp.com",
  projectId: "ppoikamo-10",
  storageBucket: "ppoikamo-10.firebasestorage.app",
  messagingSenderId: "303115064992",
  appId: "1:303115064992:web:4d3a012ced25b0deec5bc5",
  measurementId: "G-6CJD2224QL"
};

const app = initializeApp(firebaseConfig);
try {
  getAnalytics(app);
} catch (error) {
  console.warn("Analyticsの初期化をスキップしました:", error);
}
const db = getFirestore(app);

// -----------------------------
// 状態
// -----------------------------
let users = {};
let currentUser = localStorage.getItem("currentUser") || null;
let currentCategory = "";
let bestRate = 0;
let bestScore = 0;
let history = [];

// -----------------------------
// 問題データ
// -----------------------------
const problemSets = {
  speed: [
    { q: "時速60kmで2時間進むと距離は？", a: 120, options: [120, 60, 30, 240] },
    { q: "距離150kmを3時間で進むと速さは？", a: 50, options: [50, 150, 30, 450] },
    { q: "時速80kmで160km進むのにかかる時間は？", a: 2, options: [2, 80, 160, 40] },
    { q: "時速45kmで90km進むと時間は？", a: 2, options: [2, 45, 90, 4] },
    { q: "距離200kmを4時間で進むと速さは？", a: 50, options: [50, 200, 25, 800] }
  ],
  acceleration: [
    { q: "速さが2秒で4m/sから10m/sになった。加速度は？", a: 3, options: [3, 6, 2, 5] },
    { q: "速さが5秒で0m/sから20m/sになった。加速度は？", a: 4, options: [4, 20, 5, 25] },
    { q: "速さが3秒で15m/sから6m/sになった。加速度は？", a: -3, options: [-3, 3, -9, 9] },
    { q: "速さが4秒で8m/sから16m/sになった。加速度は？", a: 2, options: [2, 4, 8, 24] },
    { q: "速さが2秒で12m/sから0m/sになった。加速度は？", a: -6, options: [-6, 6, -12, 12] }
  ],
  "relative-speed": [
    { q: "東に時速40kmで進むAと、西に時速30kmで進むBの相対速度は？", a: 70, options: [70, 10, 40, 30] },
    { q: "同じ向きに時速60kmと時速20kmで進む2台の車の相対速度は？", a: 40, options: [40, 80, 20, 60] },
    { q: "東に時速50kmで進むAから見た、西に時速10kmで進むBの相対速度は？", a: 60, options: [60, 40, 10, 50] },
    { q: "同じ向きに時速80kmと時速50kmで進む列車の相対速度は？", a: 30, options: [30, 130, 40, 50] },
    { q: "反対向きに時速25kmと時速35kmで歩く2人の相対速度は？", a: 60, options: [60, 10, 25, 35] }
  ]
};

// -----------------------------
// パス補助
// -----------------------------
function isSubfolderPage() {
  const path = window.location.pathname;
  return /\/(english|math|physics|info)\//.test(path);
}

function getRootPath(filename) {
  return isSubfolderPage() ? `../${filename}` : filename;
}

// -----------------------------
// Firestore: ユーザー
// -----------------------------
async function getUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  const result = {};

  snapshot.forEach((item) => {
    const data = item.data();
    result[item.id] = data.role || "user";
  });

  if (!result.support) {
    await setDoc(doc(db, "users", "support"), {
      role: "support",
      createdAt: new Date().toISOString()
    });
    result.support = "support";
  }

  return result;
}

async function saveUser(userId, role = "user") {
  await setDoc(
    doc(db, "users", userId),
    {
      role,
      createdAt: new Date().toISOString()
    },
    { merge: true }
  );
}

async function registerUser() {
  currentUser = localStorage.getItem("currentUser");

  if (currentUser !== "support") {
    alert("ユーザー追加はsupportのみ可能です");
    return;
  }

  const idInput = document.getElementById("newUserId");
  if (!idInput) return;

  const newId = idInput.value.trim();

  if (!newId) {
    alert("IDを入力してください");
    return;
  }

  users = await getUsers();

  if (Object.prototype.hasOwnProperty.call(users, newId)) {
    alert("そのIDはすでに存在します");
    return;
  }

  await saveUser(newId, "user");
  idInput.value = "";
  await updateSupportUsers();

  alert(`ユーザー「${newId}」を登録しました`);
}

async function deleteUser(targetUser) {
  currentUser = localStorage.getItem("currentUser");

  if (currentUser !== "support") {
    alert("管理者のみ可能です");
    return;
  }

  if (targetUser === "support") {
    alert("support は削除できません");
    return;
  }

  if (!confirm(`${targetUser} を削除しますか？`)) return;

  await deleteDoc(doc(db, "users", targetUser));
  await deleteDoc(doc(db, "userStats", targetUser));

  const historySnapshot = await getDocs(collection(db, "globalHistory"));
  const tasks = [];

  historySnapshot.forEach((item) => {
    const data = item.data();
    if (data.user === targetUser) {
      tasks.push(deleteDoc(doc(db, "globalHistory", item.id)));
    }
  });

  await Promise.all(tasks);

  await updateSupportUsers();
  await updateAllUsers();

  alert(`${targetUser} を削除しました`);
}

// -----------------------------
// Firestore: 個人記録
// -----------------------------
async function loadUserData() {
  if (!currentUser || !currentCategory) return;

  const snap = await getDoc(doc(db, "userStats", currentUser));

  if (!snap.exists()) {
    bestRate = 0;
    bestScore = 0;
    history = [];
    return;
  }

  const data = snap.data();
  const categoryData = data[currentCategory] || {};

  bestRate = categoryData.bestRate || 0;
  bestScore = categoryData.bestScore || 0;
  history = categoryData.history || [];
}

async function saveUserData() {
  if (!currentUser || !currentCategory) return;

  await setDoc(
    doc(db, "userStats", currentUser),
    {
      [currentCategory]: {
        bestRate,
        bestScore,
        history
      }
    },
    { merge: true }
  );
}

// -----------------------------
// Firestore: 全体履歴
// -----------------------------
async function addGlobalHistory(item) {
  await addDoc(collection(db, "globalHistory"), item);
}

// -----------------------------
// ログイン・移動
// -----------------------------
async function login(nextPage = "subject-select.html") {
  try {
    users = await getUsers();

    const idInput = document.getElementById("id");
    if (!idInput) {
      alert("ID入力欄が見つかりません");
      return;
    }

    const id = idInput.value.trim();

    if (!id) {
      alert("IDを入力してください");
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(users, id)) {
      alert("そのIDは存在しません");
      return;
    }

    localStorage.setItem("currentUser", id);

    if (id === "support") {
      location.href = "support.html";
    } else {
      location.href = nextPage;
    }
  } catch (error) {
    console.error("ログインエラー:", error);
    alert("ログイン処理でエラーが起きました。コンソールを確認してください。");
  }
}

function logout() {
  localStorage.removeItem("currentUser");
  location.href = getRootPath("index.html");
}

function goSubjectSelect() {
  location.href = getRootPath("subject-select.html");
}

function goMenu() {
  location.href = "physics-menu.html";
}

// -----------------------------
// 問題表示
// -----------------------------
function getCurrentProblems() {
  return problemSets[currentCategory] || [];
}

function generateOptions(correct, custom) {
  if (Array.isArray(custom) && custom.length === 4) return custom;
  return [correct, correct + 10, correct - 10, Math.round(correct * 1.5)];
}

function loadQuestions() {
  const container = document.getElementById("questions");
  if (!container) return;

  const problems = getCurrentProblems();
  container.innerHTML = "";

  problems.forEach((p, i) => {
    const opts = generateOptions(p.a, p.options);

    let html = `<div class="question-card"><p><strong>${i + 1}. ${p.q}</strong></p><div class="options">`;

    opts.forEach((opt) => {
      html += `
        <label class="option">
          <input type="radio" name="q${i}" value="${opt}">
          ${opt}
        </label>
      `;
    });

    html += `</div></div>`;
    container.innerHTML += html;
  });

  document.getElementById("submitBtn")?.classList.remove("hidden");
  document.getElementById("nextBtn")?.classList.add("hidden");
}

async function submitAnswers() {
  const problems = getCurrentProblems();
  let score = 0;

  problems.forEach((p, i) => {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);
    const labels = document.querySelectorAll(`input[name="q${i}"]`);

    labels.forEach((input) => {
      input.parentElement.style.backgroundColor = "";
      if (Number(input.value) === p.a) {
        input.parentElement.style.backgroundColor = "var(--correct)";
      } else if (input.checked) {
        input.parentElement.style.backgroundColor = "var(--wrong)";
      }
    });

    if (selected && Number(selected.value) === p.a) {
      score++;
    }
  });

  const rate = Math.round((score / problems.length) * 100);

  if (rate > bestRate) bestRate = rate;
  if (score > bestScore) bestScore = score;

  const now = new Date().toLocaleString();

  history.push({
    time: now,
    score,
    rate,
    category: currentCategory
  });

  await saveUserData();

  await addGlobalHistory({
    user: currentUser,
    time: now,
    score,
    rate,
    category: currentCategory
  });

  await updateStats();
  await updateAllUsers();

  document.getElementById("submitBtn")?.classList.add("hidden");
  document.getElementById("nextBtn")?.classList.remove("hidden");

  alert(`正解数: ${score}/${problems.length}`);
}

function nextQuestion() {
  loadQuestions();
}

// -----------------------------
// 表示更新
// -----------------------------
async function updateStats() {
  const bestScoreEl = document.getElementById("bestScore");
  const rateEl = document.getElementById("rate");

  if (bestScoreEl) bestScoreEl.innerText = bestScore;
  if (rateEl) rateEl.innerText = bestRate;
}

async function updateAllUsers() {
  users = await getUsers();

  const publicList = document.getElementById("publicAllUsers");
  if (!publicList) return;

  publicList.innerHTML = "";

  for (const user of Object.keys(users)) {
    if (user === "support") continue;

    const snap = await getDoc(doc(db, "userStats", user));
    const data = snap.exists() ? snap.data() : {};

    const categories = ["speed", "acceleration", "relative-speed"];
    let totalBestScore = 0;
    let totalBestRate = 0;

    categories.forEach((cat) => {
      totalBestScore += data[cat]?.bestScore || 0;
      totalBestRate += data[cat]?.bestRate || 0;
    });

    const avgBestRate = Math.round(totalBestRate / categories.length);

    publicList.innerHTML += `
      <li>${user}：合計最高得点 ${totalBestScore} / 平均最高正答率 ${avgBestRate}%</li>
    `;
  }
}

async function updateSupportUsers() {
  users = await getUsers();

  const list = document.getElementById("supportUsers");
  if (!list) return;

  list.innerHTML = "";

  Object.keys(users).forEach((user) => {
    if (user === "support") return;

    list.innerHTML += `
      <li style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;">
        <span>${user}</span>
        <button onclick="deleteUser('${user}')">削除</button>
      </li>
    `;
  });
}

// -----------------------------
// 初期化
// -----------------------------
async function initSubjectSelectPage() {
  currentUser = localStorage.getItem("currentUser");

  if (!currentUser) {
    location.href = "index.html";
    return;
  }

  if (currentUser === "support") {
    location.href = "support.html";
  }
}

async function initSupportPage() {
  currentUser = localStorage.getItem("currentUser");

  if (!currentUser) {
    location.href = "index.html";
    return;
  }

  if (currentUser !== "support") {
    location.href = "subject-select.html";
    return;
  }

  await updateSupportUsers();
}

async function initGenericSubjectMenuPage() {
  currentUser = localStorage.getItem("currentUser");

  if (!currentUser) {
    location.href = "../index.html";
    return;
  }

  if (currentUser === "support") {
    location.href = "../support.html";
  }
}

async function initPhysicsMenuPage() {
  currentUser = localStorage.getItem("currentUser");

  if (!currentUser) {
    location.href = "../index.html";
    return;
  }

  if (currentUser === "support") {
    location.href = "../support.html";
    return;
  }

  currentCategory = "speed";
  await loadUserData();
  document.getElementById("userStats")?.classList.remove("hidden");
  document.getElementById("publicUsersPanel")?.classList.remove("hidden");
  await updateStats();
  await updateAllUsers();
}

async function initQuestionPage(category) {
  currentUser = localStorage.getItem("currentUser");

  if (!currentUser) {
    location.href = "../index.html";
    return;
  }

  if (currentUser === "support") {
    location.href = "../support.html";
    return;
  }

  currentCategory = category;
  await loadUserData();
  await updateStats();
  document.getElementById("userStats")?.classList.remove("hidden");
  document.getElementById("publicUsersPanel")?.classList.remove("hidden");
  await updateAllUsers();
  loadQuestions();
}

async function initPage() {
  const body = document.body;
  const pageType = body.dataset.page;
  const menuType = body.dataset.menu;
  const path = window.location.pathname;

  if (path.endsWith("/subject-select.html")) {
    await initSubjectSelectPage();
    return;
  }

  if (path.endsWith("/support.html")) {
    await initSupportPage();
    return;
  }

  if (menuType === "physics") {
    await initPhysicsMenuPage();
    return;
  }

  if (menuType === "english" || menuType === "math" || menuType === "info") {
    await initGenericSubjectMenuPage();
    return;
  }

  if (pageType) {
    await initQuestionPage(pageType);
  }
}

document.addEventListener("DOMContentLoaded", initPage);

// -----------------------------
// inline onclick 用
// -----------------------------
window.login = login;
window.logout = logout;
window.registerUser = registerUser;
window.deleteUser = deleteUser;
window.submitAnswers = submitAnswers;
window.nextQuestion = nextQuestion;
window.goMenu = goMenu;
window.goSubjectSelect = goSubjectSelect;