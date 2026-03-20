function getUsers() {
  const saved = localStorage.getItem("users");
  if (saved) return JSON.parse(saved);

  const initialUsers = { user: "1234", support: "1111" };
  localStorage.setItem("users", JSON.stringify(initialUsers));
  return initialUsers;
}

function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

function getGlobalHistory() {
  return JSON.parse(localStorage.getItem("globalHistory")) || [];
}

function saveGlobalHistory(data) {
  localStorage.setItem("globalHistory", JSON.stringify(data));
}

let users = getUsers();
let currentUser = localStorage.getItem("currentUser") || null;
let bestRate = 0;
let bestScore = 0;
let history = [];
let currentCategory = "";

const problemSets = {
  speed: [
    { q: "時速60kmで2時間進むと距離は？", a: 120 },
    { q: "距離150kmを3時間で進むと速さは？", a: 50 },
    { q: "時速80kmで160km進むのにかかる時間は？", a: 2 },
    { q: "時速45kmで90km進むと時間は？", a: 2 },
    { q: "距離200kmを4時間で進むと速さは？", a: 50 }
  ],
  acceleration: [
    { q: "速さが2秒で4m/sから10m/sになった。加速度は？", a: 3 },
    { q: "速さが5秒で0m/sから20m/sになった。加速度は？", a: 4 },
    { q: "速さが3秒で15m/sから6m/sになった。加速度は？", a: -3 },
    { q: "速さが4秒で8m/sから16m/sになった。加速度は？", a: 2 },
    { q: "速さが2秒で12m/sから0m/sになった。加速度は？", a: -6 }
  ],
  "relative-speed": [
    { q: "東に時速40kmで進むAと、西に時速30kmで進むBの相対速度は？", a: 70 },
    { q: "同じ向きに時速60kmと時速20kmで進む2台の車の相対速度は？", a: 40 },
    { q: "東に時速50kmで進むAから見た、西に時速10kmで進むBの相対速度は？", a: 60 },
    { q: "同じ向きに時速80kmと時速50kmで進む列車の相対速度は？", a: 30 },
    { q: "反対向きに時速25kmと時速35kmで歩く2人の相対速度は？", a: 60 }
  ]
};

function getStorageKey(name) {
  return `${currentUser}_${currentCategory}_${name}`;
}

function loadUserData() {
  if (!currentUser || !currentCategory) return;
  bestRate = Number(localStorage.getItem(getStorageKey("bestRate"))) || 0;
  bestScore = Number(localStorage.getItem(getStorageKey("bestScore"))) || 0;
  history = JSON.parse(localStorage.getItem(getStorageKey("history"))) || [];
}

function saveUserData() {
  localStorage.setItem(getStorageKey("bestRate"), bestRate);
  localStorage.setItem(getStorageKey("bestScore"), bestScore);
  localStorage.setItem(getStorageKey("history"), JSON.stringify(history));
}

function login(nextPage = "menu.html") {
  users = getUsers();
  const id = document.getElementById("id").value.trim();
  const pass = document.getElementById("pass").value;

  if (users[id] && users[id] === pass) {
    localStorage.setItem("currentUser", id);
    location.href = nextPage;
  } else {
    alert("IDまたはパスワードが違います");
  }
}

function logout() {
  localStorage.removeItem("currentUser");
  location.href = "index.html";
}

function goMenu() {
  location.href = "menu.html";
}

function registerUser() {
  const idInput = document.getElementById("newUserId");
  const passInput = document.getElementById("newUserPass");
  if (!idInput || !passInput) return;

  const newId = idInput.value.trim();
  const newPass = passInput.value;

  if (!newId || !newPass) {
    alert("IDとパスワードを入力してください");
    return;
  }

  if (users[newId]) {
    alert("そのIDはすでに存在します");
    return;
  }

  users[newId] = newPass;
  saveUsers(users);

  if (currentUser === "support") {
    updateAllUsers(true);
  } else {
    updateAllUsers(false);
  }

  idInput.value = "";
  passInput.value = "";

  alert(`ユーザー「${newId}」を登録しました`);
}

// 手入力誤答対応
function generateOptions(correct, custom = null) {
  if (custom && custom.length === 4) {
    return custom;
  }

  const candidates = [correct, correct + 10, correct - 10, Math.round(correct * 1.5)];
  const unique = Array.from(new Set(candidates)).filter(v => v !== 0 || correct === 0);

  let i = 1;
  while (unique.length < 4) {
    const val = correct + i * 5;
    if (!unique.includes(val)) unique.push(val);
    i++;
  }

  return unique.slice(0, 4);
}

function getCurrentProblems() {
  return problemSets[currentCategory] || [];
}

function loadQuestions() {
  const container = document.getElementById("questions");
  if (!container) return;
  const problems = getCurrentProblems();
  container.innerHTML = "";

  problems.forEach((p, i) => {
    const opts = generateOptions(p.a, p.options);
    let html = `<div class="question-card"><p><strong>${i + 1}. ${p.q}</strong></p><div class="options">`;

    opts.forEach(opt => {
      html += `<label class="option"><input type="radio" name="q${i}" value="${opt}"> ${opt}</label>`;
    });

    html += `</div></div>`;
    container.innerHTML += html;
  });

  const submitBtn = document.getElementById("submitBtn");
  const nextBtn = document.getElementById("nextBtn");
  if (submitBtn) submitBtn.classList.remove("hidden");
  if (nextBtn) nextBtn.classList.add("hidden");
}

function submitAnswers() {
  const problems = getCurrentProblems();
  let score = 0;

  problems.forEach((p, i) => {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);
    const labels = document.querySelectorAll(`input[name="q${i}"]`);

    labels.forEach(input => {
      input.parentElement.style.backgroundColor = "";
      if (Number(input.value) === p.a) {
        input.parentElement.style.backgroundColor = "var(--correct)";
      } else if (input.checked) {
        input.parentElement.style.backgroundColor = "var(--wrong)";
      }
    });

    if (selected && Number(selected.value) === p.a) score++;
  });

  const rate = Math.round((score / problems.length) * 100);
  if (rate > bestRate) bestRate = rate;
  if (score > bestScore) bestScore = score;

  const now = new Date().toLocaleString();
  history.push({ time: now, score, rate, category: currentCategory });
  saveUserData();

  const global = getGlobalHistory();
  global.push({ user: currentUser, time: now, score, rate, category: currentCategory });
  saveGlobalHistory(global);

  updateStats();

  if (currentUser === "support") {
    updateAllUsers(true);
    updateGlobalHistory();
  } else {
    updateAllUsers(false);
  }

  document.getElementById("submitBtn").classList.add("hidden");
  document.getElementById("nextBtn").classList.remove("hidden");
  alert(`正解数: ${score}/${problems.length}`);
}

function nextQuestion() {
  loadQuestions();
}

function updateStats() {
  const bestScoreEl = document.getElementById("bestScore");
  const rateEl = document.getElementById("rate");
  if (bestScoreEl) bestScoreEl.innerText = bestScore;
  if (rateEl) rateEl.innerText = bestRate;

  if (currentUser !== "support") return;

  const historyEl = document.getElementById("history");
  if (!historyEl) return;
  historyEl.innerHTML = "";

  history.slice().reverse().forEach(h => {
    historyEl.innerHTML += `<li>[${h.category}] ${h.time} : ${h.score}/5 (${h.rate}%)</li>`;
  });
}

function updateAllUsers(isSupportView = false) {
  users = getUsers();

  const adminList = document.getElementById("allUsers");
  const publicList = document.getElementById("publicAllUsers");

  if (adminList) adminList.innerHTML = "";
  if (publicList) publicList.innerHTML = "";

  Object.keys(users).forEach(user => {
    if (user === "support") return;

    const categories = ["speed", "acceleration", "relative-speed"];
    let totalBestScore = 0;
    let totalBestRate = 0;

    categories.forEach(cat => {
      totalBestScore += Number(localStorage.getItem(`${user}_${cat}_bestScore`)) || 0;
      totalBestRate += Number(localStorage.getItem(`${user}_${cat}_bestRate`)) || 0;
    });

    const avgBestRate = Math.round(totalBestRate / categories.length);

    if (isSupportView) {
      adminList.innerHTML += `
        <li>
          ${user}：合計最高得点 ${totalBestScore} / 平均最高正答率 ${avgBestRate}%
          <button onclick="resetUserHistory('${user}')">履歴削除</button>
          <button onclick="deleteUser('${user}')">ユーザー削除</button>
        </li>`;
    } else {
      publicList.innerHTML += `<li>${user}：合計最高得点 ${totalBestScore} / 平均最高正答率 ${avgBestRate}%</li>`;
    }
  });
}

function updateGlobalHistory() {
  const list = document.getElementById("globalHistory");
  if (!list) return;

  const data = getGlobalHistory();
  list.innerHTML = "";

  data.slice().reverse().forEach(d => {
    list.innerHTML += `<li>${d.user}｜${d.category}｜${d.time}｜${d.score}/5 (${d.rate}%)</li>`;
  });
}

function resetUserHistory(targetUser) {
  if (currentUser !== "support") {
    alert("管理者のみ可能です");
    return;
  }

  if (!confirm(`${targetUser} の履歴を削除しますか？`)) return;

  const categories = ["speed", "acceleration", "relative-speed"];
  categories.forEach(cat => {
    localStorage.removeItem(`${targetUser}_${cat}_bestRate`);
    localStorage.removeItem(`${targetUser}_${cat}_bestScore`);
    localStorage.removeItem(`${targetUser}_${cat}_history`);
  });

  const filtered = getGlobalHistory().filter(item => item.user !== targetUser);
  saveGlobalHistory(filtered);

  updateAllUsers(true);
  updateGlobalHistory();
  alert(`${targetUser} の履歴を削除しました`);
}

function deleteUser(targetUser) {
  if (currentUser !== "support") {
    alert("管理者のみ可能です");
    return;
  }

  if (!confirm(`${targetUser} を削除しますか？`)) return;

  const categories = ["speed", "acceleration", "relative-speed"];
  categories.forEach(cat => {
    localStorage.removeItem(`${targetUser}_${cat}_bestRate`);
    localStorage.removeItem(`${targetUser}_${cat}_bestScore`);
    localStorage.removeItem(`${targetUser}_${cat}_history`);
  });

  const filtered = getGlobalHistory().filter(item => item.user !== targetUser);
  saveGlobalHistory(filtered);

  users = getUsers();
  delete users[targetUser];
  saveUsers(users);

  updateAllUsers(true);
  updateGlobalHistory();
  alert(`${targetUser} を削除しました`);
}

function resetAllHistory() {
  if (currentUser !== "support") {
    alert("管理者のみ可能です");
    return;
  }

  if (!confirm("全ユーザーの履歴を削除しますか？")) return;

  Object.keys(getUsers()).forEach(user => {
    if (user === "support") return;
    const categories = ["speed", "acceleration", "relative-speed"];
    categories.forEach(cat => {
      localStorage.removeItem(`${user}_${cat}_bestRate`);
      localStorage.removeItem(`${user}_${cat}_bestScore`);
      localStorage.removeItem(`${user}_${cat}_history`);
    });
  });

  localStorage.removeItem("globalHistory");
  updateAllUsers(true);
  updateGlobalHistory();
  alert("全ユーザーの履歴を削除しました");
}

function initPage() {
  const path = location.pathname.split("/").pop();

  if (path === "menu.html") {
    currentUser = localStorage.getItem("currentUser");
    if (!currentUser) {
      location.href = "index.html";
      return;
    }

    if (currentUser === "support") {
      document.getElementById("adminPanel")?.classList.remove("hidden");
      document.getElementById("userStats")?.classList.add("hidden");
      document.getElementById("publicUsersPanel")?.classList.add("hidden");
      document.getElementById("publicRegisterPanel")?.classList.add("hidden");
      updateAllUsers(true);
      updateGlobalHistory();
    } else {
      currentCategory = "speed";
      loadUserData();
      document.getElementById("userStats")?.classList.remove("hidden");
      document.getElementById("publicUsersPanel")?.classList.remove("hidden");
      document.getElementById("publicRegisterPanel")?.classList.remove("hidden");
      updateStats();
      updateAllUsers(false);
    }
    return;
  }

  const bodyPage = document.body.dataset.page;
  if (!bodyPage) return;

  currentUser = localStorage.getItem("currentUser");
  if (!currentUser) {
    location.href = "index.html";
    return;
  }

  currentCategory = bodyPage;
  loadUserData();
  updateStats();

  if (currentUser === "support") {
    document.getElementById("userStats")?.classList.add("hidden");
    document.getElementById("publicUsersPanel")?.classList.add("hidden");
    document.getElementById("publicRegisterPanel")?.classList.add("hidden");
    updateAllUsers(true);
  } else {
    document.getElementById("userStats")?.classList.remove("hidden");
    document.getElementById("publicUsersPanel")?.classList.remove("hidden");
    document.getElementById("publicRegisterPanel")?.classList.remove("hidden");
    updateAllUsers(false);
  }

  loadQuestions();
}

document.addEventListener("DOMContentLoaded", initPage);