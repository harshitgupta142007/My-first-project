/* ---------- Data & Setup ---------- */
const CATS = ["Food", "Shopping", "Education", "Travel", "Bills", "Health", "Entertainment", "Other"];
let tx = JSON.parse(localStorage.getItem("set_tx") || "[]");
let budget = Number(localStorage.getItem("set_budget") || 0);
let page = "dashboard";
const charts = {};

const $ = (id) => document.getElementById(id);
const money = (n) => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sum = (a) => a.reduce((s, t) => s + t.amount, 0);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD (local)
const monthKey = () => today().slice(0, 7);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const monthSpent = () => sum(tx.filter((t) => t.type === "expense" && t.date.startsWith(monthKey())));

function save() {
  localStorage.setItem("set_tx", JSON.stringify(tx));
  localStorage.setItem("set_budget", budget);
}

let toastTimer;
function toast(msg, type = "success") {
  const t = $("toast");
  t.textContent = msg;
  t.className = "show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ""), 2800);
}

/* ---------- Navigation & Theme ---------- */
const titles = { dashboard: "Dashboard", add: "Add Transaction", transactions: "Transactions", reports: "Reports & Analytics", budget: "Budget Management" };

function showPage(name) {
  page = name;
  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + name));
  document.querySelectorAll(".nav-link").forEach((l) => l.classList.toggle("active", l.dataset.page === name));
  $("pageTitle").textContent = titles[name];
  closeSidebar();
  render();
}
function closeSidebar() { $("sidebar").classList.remove("open"); $("overlay").classList.remove("show"); }

document.querySelectorAll(".nav-link").forEach((l) =>
  l.addEventListener("click", (e) => {
    e.preventDefault();
    if (l.dataset.page === "add" && !$("editId").value) resetForm();
    showPage(l.dataset.page);
  })
);
$("menuBtn").onclick = () => { $("sidebar").classList.add("open"); $("overlay").classList.add("show"); };
$("overlay").onclick = closeSidebar;

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  $("themeToggle").textContent = theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
  localStorage.setItem("set_theme", theme);
  Chart.defaults.color = theme === "dark" ? "#94a3b8" : "#6b7280";
  render();
}
$("themeToggle").onclick = () => applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");

/* ---------- Form: Add / Edit ---------- */
function fillSelects() {
  $("category").innerHTML = CATS.map((c) => `<option>${c}</option>`).join("");
  $("fCat").innerHTML = '<option value="">All Categories</option>' + CATS.map((c) => `<option>${c}</option>`).join("");
}

function resetForm() {
  $("txForm").reset();
  $("editId").value = "";
  $("date").value = today();
  $("formTitle").textContent = "Add Transaction";
  $("submitBtn").textContent = "Add Transaction";
  $("cancelEdit").classList.add("hidden");
}

$("txForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = {
    title: $("title").value.trim(),
    amount: parseFloat($("amount").value),
    type: $("type").value,
    category: $("category").value,
    date: $("date").value,
    desc: $("desc").value.trim(),
  };
  if (t.title.length < 2) return toast("Title must be at least 2 characters.", "error");
  if (!(t.amount > 0)) return toast("Enter an amount greater than 0.", "error");
  if (!t.date) return toast("Please select a date.", "error");

  const id = $("editId").value;
  if (id) {
    tx = tx.map((x) => (x.id === id ? { ...x, ...t } : x));
    toast("Transaction updated successfully!");
  } else {
    tx.push({ id: uid(), ...t });
    toast("Transaction added successfully!");
  }
  save();
  resetForm();
  showPage(id ? "transactions" : "dashboard");
});

$("cancelEdit").onclick = () => { resetForm(); showPage("transactions"); };

function editTx(id) {
  const t = tx.find((x) => x.id === id);
  if (!t) return;
  $("editId").value = t.id;
  $("title").value = t.title;
  $("amount").value = t.amount;
  $("type").value = t.type;
  $("category").value = t.category;
  $("date").value = t.date;
  $("desc").value = t.desc || "";
  $("formTitle").textContent = "Edit Transaction";
  $("submitBtn").textContent = "Update Transaction";
  $("cancelEdit").classList.remove("hidden");
  showPage("add");
}

function deleteTx(id) {
  if (!confirm("Delete this transaction?")) return;
  tx = tx.filter((x) => x.id !== id);
  save();
  render();
  toast("Transaction deleted.", "error");
}

/* ---------- Transactions Table ---------- */
function filtered() {
  const q = $("search").value.toLowerCase().trim();
  const c = $("fCat").value, d = $("fDate").value, s = $("sort").value;
  const r = tx.filter((t) =>
    (!q || t.title.toLowerCase().includes(q) || (t.desc || "").toLowerCase().includes(q)) &&
    (!c || t.category === c) && (!d || t.date === d)
  );
  r.sort((a, b) =>
    s === "date-desc" ? b.date.localeCompare(a.date) :
    s === "date-asc" ? a.date.localeCompare(b.date) :
    s === "amt-desc" ? b.amount - a.amount : a.amount - b.amount
  );
  return r;
}

function renderTable() {
  const rows = filtered();
  $("txBody").innerHTML = rows.length
    ? rows.map((t) => `
      <tr>
        <td>${t.date}</td>
        <td>${esc(t.title)}${t.desc ? `<br><small class="muted">${esc(t.desc)}</small>` : ""}</td>
        <td>${t.category}</td>
        <td><span class="badge ${t.type}">${t.type}</span></td>
        <td class="${t.type === "income" ? "green" : "red"}">${t.type === "income" ? "+" : "-"}${money(t.amount)}</td>
        <td><button class="act" data-act="edit" data-id="${t.id}" title="Edit">✏️</button>
            <button class="act" data-act="del" data-id="${t.id}" title="Delete">🗑️</button></td>
      </tr>`).join("")
    : '<tr><td colspan="6" class="empty">No transactions found.</td></tr>';
}

$("txBody").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  b.dataset.act === "edit" ? editTx(b.dataset.id) : deleteTx(b.dataset.id);
});
["search", "fCat", "fDate", "sort"].forEach((id) => $(id).addEventListener("input", renderTable));
$("resetFilters").onclick = () => {
  $("search").value = ""; $("fCat").value = ""; $("fDate").value = ""; $("sort").value = "date-desc";
  renderTable();
};

/* ---------- CSV & Clear ---------- */
$("csvBtn").onclick = () => {
  if (!tx.length) return toast("No transactions to export.", "error");
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [["Date", "Title", "Type", "Category", "Amount", "Description"].join(",")];
  tx.forEach((t) => lines.push([t.date, q(t.title), t.type, t.category, t.amount, q(t.desc || "")].join(",")));
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `expense-report-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("CSV downloaded!");
};

$("clearBtn").onclick = () => {
  if (!tx.length) return toast("There is nothing to clear.", "error");
  if (!confirm("This will delete ALL transactions permanently. Continue?")) return;
  tx = [];
  save();
  render();
  toast("All transactions cleared.", "error");
};

/* ---------- Dashboard ---------- */
function budgetMessage() {
  if (!budget) return null;
  const spent = monthSpent(), pct = (spent / budget) * 100;
  if (spent > budget) return { cls: "", text: `⚠️ Budget exceeded by ${money(spent - budget)}!` };
  if (pct >= 80) return { cls: "amber", text: `⚠️ Warning: ${pct.toFixed(0)}% of your monthly budget is used.` };
  return null;
}

function setWarn(el, m) {
  el.classList.toggle("hidden", !m);
  if (m) { el.className = "warn " + m.cls; el.textContent = m.text; }
}

function renderStats() {
  const inc = sum(tx.filter((t) => t.type === "income"));
  const exp = sum(tx.filter((t) => t.type === "expense"));
  $("sIncome").textContent = money(inc);
  $("sExpense").textContent = money(exp);
  $("sBalance").textContent = money(inc - exp);
  $("sRemaining").textContent = budget ? money(budget - monthSpent()) : "Set budget";
  setWarn($("dashWarn"), budgetMessage());
}

function renderRecent() {
  const r = [...tx].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  $("recentList").innerHTML = r.length
    ? r.map((t) => `
      <div class="item">
        <div><strong>${esc(t.title)}</strong><br><small>${t.category} • ${t.date}</small></div>
        <strong class="${t.type === "income" ? "green" : "red"}">${t.type === "income" ? "+" : "-"}${money(t.amount)}</strong>
      </div>`).join("")
    : '<p class="empty">No transactions yet. Add your first one!</p>';
}

function renderMonthSummary() {
  const ex = tx.filter((t) => t.type === "expense" && t.date.startsWith(monthKey()));
  const total = sum(ex), by = {};
  ex.forEach((t) => (by[t.category] = (by[t.category] || 0) + t.amount));
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
  $("monthSummary").innerHTML =
    `<p class="muted">${new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}</p><h2 class="red">${money(total)}</h2>` +
    (rows.length
      ? rows.map(([c, v]) => `<div class="bar-row"><span>${c}</span><div class="bar"><i style="width:${(v / total) * 100}%"></i></div><b>${money(v)}</b></div>`).join("")
      : '<p class="muted">No expenses this month.</p>');
}

/* ---------- Charts ---------- */
function drawChart(id, type, data, options = {}) {
  if (typeof Chart === "undefined") return; // offline safety
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), { type, data, options: { responsive: true, maintainAspectRatio: false, ...options } });
}

function incExpChart(id) {
  const labels = [], inc = [], exp = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    labels.push(d.toLocaleString("en-US", { month: "short", year: "2-digit" }));
    inc.push(sum(tx.filter((t) => t.type === "income" && t.date.startsWith(key))));
    exp.push(sum(tx.filter((t) => t.type === "expense" && t.date.startsWith(key))));
  }
  drawChart(id, "bar", {
    labels,
    datasets: [
      { label: "Income", data: inc, backgroundColor: "#10b981", borderRadius: 6 },
      { label: "Expense", data: exp, backgroundColor: "#ef4444", borderRadius: 6 },
    ],
  }, { scales: { y: { beginAtZero: true } } });
}

function catChart() {
  const by = {};
  tx.filter((t) => t.type === "expense").forEach((t) => (by[t.category] = (by[t.category] || 0) + t.amount));
  const labels = Object.keys(by);
  drawChart("catChart", "doughnut", {
    labels: labels.length ? labels : ["No data"],
    datasets: [{
      data: labels.length ? Object.values(by) : [1],
      backgroundColor: labels.length
        ? ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#8b5cf6", "#94a3b8"]
        : ["#cbd5e1"],
    }],
  }, { plugins: { legend: { position: "bottom" } } });
}

/* ---------- Reports ---------- */
function periodKey(date, period) {
  if (period === "daily") return date;
  if (period === "monthly") return date.slice(0, 7);
  if (period === "yearly") return date.slice(0, 4);
  const d = new Date(date + "T00:00:00"); // weekly: start of week (Monday)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return "Week of " + d.toLocaleDateString("en-CA");
}

function renderReportTable() {
  const p = $("repPeriod").value, groups = {};
  tx.filter((t) => t.type === "expense").forEach((t) => {
    const k = periodKey(t.date, p);
    groups[k] = groups[k] || { n: 0, total: 0 };
    groups[k].n++;
    groups[k].total += t.amount;
  });
  const keys = Object.keys(groups).sort().reverse();
  $("repBody").innerHTML = keys.length
    ? keys.map((k) => `<tr><td>${k}</td><td>${groups[k].n}</td><td class="red">${money(groups[k].total)}</td></tr>`).join("")
    : '<tr><td colspan="3" class="empty">No expense data available.</td></tr>';
}
$("repPeriod").addEventListener("change", renderReportTable);

/* ---------- Budget ---------- */
$("saveBudget").onclick = () => {
  const v = parseFloat($("budgetInput").value);
  if (!(v > 0)) return toast("Enter a valid budget amount.", "error");
  budget = v;
  save();
  $("budgetInput").value = "";
  render();
  toast("Monthly budget saved!");
};

function renderBudget() {
  const spent = monthSpent(), pct = budget ? (spent / budget) * 100 : 0;
  $("bBudget").textContent = money(budget);
  $("bSpent").textContent = money(spent);
  $("bRemain").textContent = money(Math.max(budget - spent, 0));
  $("bBar").style.width = Math.min(pct, 100) + "%";
  $("bBar").style.background = pct >= 100 ? "#ef4444" : pct >= 80 ? "#f59e0b" : "#10b981";
  $("bPercent").textContent = budget ? `${pct.toFixed(1)}% used` : "No budget set yet.";
  setWarn($("budgetWarn"), budgetMessage());
}

/* ---------- Render Everything ---------- */
function render() {
  renderStats();
  renderRecent();
  renderMonthSummary();
  renderTable();
  renderReportTable();
  renderBudget();
  if (page === "dashboard") incExpChart("dashChart");
  if (page === "reports") { incExpChart("repChart"); catChart(); }
}

/* ---------- Init ---------- */
fillSelects();
resetForm();
applyTheme(localStorage.getItem("set_theme") || "light");