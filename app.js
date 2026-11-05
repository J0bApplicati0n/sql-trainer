
const CDN_BASE = "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/";
const TOPICS = [
  ["select","SELECT"],["where","WHERE / NULL"],["order_by","ORDER BY"],["distinct","DISTINCT"],
  ["aggregate","Агрегаты"],["group_by","GROUP BY"],["having","HAVING"],["join","JOIN"],
  ["case","CASE"],["date","Даты"],["subquery","Подзапросы"],["cte","CTE"],
  ["window","Оконные функции"],["lag","LAG / LEAD"]
];

let SQL, tasks = [], dbSql = "", currentTask = null;

const $ = (id) => document.getElementById(id);
const defaultSettings = {
  maxLevel: 7,
  enabledTopics: TOPICS.filter(([k]) => !["window","lag"].includes(k)).map(([k]) => k)
};

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function getSettings() { return loadJson("sqlTrainer.settings", defaultSettings); }
function saveSettings(s) { localStorage.setItem("sqlTrainer.settings", JSON.stringify(s)); }
function getStats() { return loadJson("sqlTrainer.stats", {ok:0,bad:0,history:{}}); }
function saveStats(s) { localStorage.setItem("sqlTrainer.stats", JSON.stringify(s)); }

function allowedTasks() {
  const s = getSettings();
  return tasks.filter(t => t.level <= s.maxLevel && t.topics.every(topic => s.enabledTopics.includes(topic)));
}
function updateStatsUI() {
  const st = getStats();
  $("okCount").textContent = st.ok;
  $("badCount").textContent = st.bad;
}
function updatePoolSummary() {
  const s = getSettings(), pool = allowedTasks();
  $("poolSummary").textContent = `${pool.length} заданий · уровни 1–${s.maxLevel}`;
}
function renderTask(task) {
  currentTask = task;
  $("taskTitle").textContent = task.title;
  $("taskPrompt").textContent = task.prompt;
  $("levelBadge").textContent = `Level ${task.level}`;
  $("difficultyBadge").textContent = "★".repeat(task.difficulty) + "☆".repeat(Math.max(0,5-task.difficulty));
  $("topicChips").innerHTML = task.topics.map(t => `<span class="chip">${topicLabel(t)}</span>`).join("");
  $("hintBox").classList.add("hidden");
  $("hintBox").textContent = task.hint;
  $("resultCard").classList.add("hidden");
  $("solutionBox").classList.add("hidden");
  $("solutionBtn").classList.add("hidden");
  $("sqlInput").value = "";
  $("sqlInput").focus();
}
function topicLabel(k) { return TOPICS.find(([key]) => key===k)?.[1] || k; }
function randomTask() {
  const pool = allowedTasks();
  if (!pool.length) {
    alert("По текущим фильтрам нет заданий. Включи больше тем или подними максимальный уровень.");
    return;
  }
  let candidates = pool;
  if (currentTask && pool.length > 1) candidates = pool.filter(t => t.id !== currentTask.id);
  renderTask(candidates[Math.floor(Math.random()*candidates.length)]);
}

async function newDb() {
  const db = new SQL.Database();
  db.run(dbSql);
  return db;
}
function ensureReadOnly(sql) {
  const clean = sql.replace(/--.*$/gm,"").trim().toLowerCase();
  return clean.startsWith("select") || clean.startsWith("with");
}
function runOne(db, sql) {
  const results = db.exec(sql);
  if (!results.length) return {columns:[], values:[]};
  const r = results[results.length-1];
  return {columns:r.columns, values:r.values};
}
function normalizeValue(v) {
  if (typeof v === "number") {
    if (Number.isInteger(v)) return v;
    return Math.round(v * 1e8) / 1e8;
  }
  return v;
}
function canonicalRows(result, orderMatters) {
  let rows = result.values.map(row => row.map(normalizeValue));
  if (!orderMatters) rows = rows.map(r => JSON.stringify(r)).sort().map(s => JSON.parse(s));
  return rows;
}
function sameResult(a,b,orderMatters) {
  if (a.columns.length !== b.columns.length) return false;
  const ra = canonicalRows(a,orderMatters), rb = canonicalRows(b,orderMatters);
  return JSON.stringify(ra) === JSON.stringify(rb);
}
function htmlEscape(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function tableHtml(result) {
  if (!result.columns.length) return "<div class='muted'>Запрос не вернул таблицу.</div>";
  const head = result.columns.map(c => `<th>${htmlEscape(c)}</th>`).join("");
  const body = result.values.slice(0,100).map(row => `<tr>${row.map(v => `<td>${htmlEscape(v===null?"NULL":v)}</td>`).join("")}</tr>`).join("");
  const note = result.values.length > 100 ? `<div class="muted">Показаны первые 100 строк из ${result.values.length}.</div>` : "";
  return `${note}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
async function checkAnswer() {
  if (!currentTask) return;
  const sql = $("sqlInput").value.trim();
  if (!sql) return alert("Сначала напиши SQL-запрос.");
  $("resultCard").classList.remove("hidden");
  $("queryError").classList.add("hidden");
  $("resultTableWrap").classList.add("hidden");
  $("solutionBox").classList.add("hidden");

  if (!ensureReadOnly(sql)) {
    showFail("В этой версии тренажёра разрешены учебные SELECT/WITH-запросы. Изменение БД добавим отдельным режимом.");
    return;
  }

  let userDb, refDb;
  try {
    userDb = await newDb();
    refDb = await newDb();
    const userResult = runOne(userDb, sql);
    const refResult = runOne(refDb, currentTask.solution);
    const ok = sameResult(userResult, refResult, currentTask.orderMatters);
    $("resultTableWrap").innerHTML = tableHtml(userResult);
    $("resultTableWrap").classList.remove("hidden");
    recordResult(ok);
    if (ok) {
      $("resultTitle").textContent = "✅ Верно";
      $("resultMessage").textContent = "Результат совпал с эталонным. Текст запроса может отличаться — это нормально.";
      $("solutionBtn").classList.add("hidden");
    } else {
      $("resultTitle").textContent = "❌ Пока неверно";
      $("resultMessage").textContent = "Запрос выполнился, но результат отличается от ожидаемого.";
      $("solutionBtn").classList.remove("hidden");
    }
  } catch (e) {
    recordResult(false);
    $("resultTitle").textContent = "❌ Ошибка SQL";
    $("resultMessage").textContent = "SQLite не смог выполнить запрос.";
    $("queryError").textContent = e.message || String(e);
    $("queryError").classList.remove("hidden");
    $("solutionBtn").classList.remove("hidden");
  } finally {
    try { userDb?.close(); refDb?.close(); } catch {}
  }
}
function showFail(msg) {
  recordResult(false);
  $("resultTitle").textContent = "❌ Пока неверно";
  $("resultMessage").textContent = msg;
  $("solutionBtn").classList.remove("hidden");
}
function recordResult(ok) {
  const st = getStats();
  if (ok) st.ok += 1; else st.bad += 1;
  const h = st.history[currentTask.id] || {ok:0,bad:0};
  if (ok) h.ok += 1; else h.bad += 1;
  st.history[currentTask.id] = h;
  saveStats(st); updateStatsUI();
}

function renderSettings() {
  const s = getSettings();
  $("maxLevel").value = s.maxLevel;
  $("maxLevelValue").textContent = s.maxLevel;
  $("topicSettings").innerHTML = TOPICS.map(([k,label]) => {
    const checked = s.enabledTopics.includes(k) ? "checked" : "";
    const future = ["window","lag"].includes(k) ? " · будущее" : "";
    return `<label><input type="checkbox" data-topic="${k}" ${checked}> <span>${label}${future}</span></label>`;
  }).join("");
}
function saveSettingsFromUI() {
  const enabledTopics = [...document.querySelectorAll("[data-topic]:checked")].map(x => x.dataset.topic);
  saveSettings({maxLevel:Number($("maxLevel").value), enabledTopics});
  updatePoolSummary();
  if (!currentTask || !allowedTasks().some(t => t.id===currentTask.id)) randomTask();
}

async function boot() {
  try {
    [tasks, dbSql] = await Promise.all([
      fetch("tasks.json").then(r => r.json()),
      fetch("db.sql").then(r => r.text())
    ]);
    SQL = await initSqlJs({locateFile: file => CDN_BASE + file});
    updateStatsUI(); updatePoolSummary(); renderSettings(); randomTask();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(console.warn);
    }
  } catch (e) {
    document.body.innerHTML = `<main class="app"><section class="card">
      <h2>Не удалось запустить SQL-движок</h2>
      <p>Для первого запуска нужен интернет, чтобы один раз загрузить sql.js. После этого сервис-воркер кэширует файлы для офлайн-работы.</p>
      <pre class="error">${htmlEscape(e.message || e)}</pre>
    </section></main>`;
  }
}

$("newTaskBtn").addEventListener("click", randomTask);
$("hintBtn").addEventListener("click", () => $("hintBox").classList.toggle("hidden"));
$("checkBtn").addEventListener("click", checkAnswer);
$("clearBtn").addEventListener("click", () => { $("sqlInput").value=""; $("sqlInput").focus(); });
$("solutionBtn").addEventListener("click", () => {
  $("solutionBox").textContent = currentTask.solution;
  $("solutionBox").classList.toggle("hidden");
});
$("settingsBtn").addEventListener("click", () => { renderSettings(); $("settingsDialog").showModal(); });
$("maxLevel").addEventListener("input", e => $("maxLevelValue").textContent = e.target.value);
$("saveSettingsBtn").addEventListener("click", saveSettingsFromUI);
$("resetStatsBtn").addEventListener("click", () => {
  if (confirm("Сбросить всю статистику ответов?")) {
    saveStats({ok:0,bad:0,history:{}}); updateStatsUI();
  }
});
$("sqlInput").addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") checkAnswer();
});

boot();
