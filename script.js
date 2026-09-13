/* ==========================================================
   StudentSpend — application logic
   Vanilla JS, localStorage persistence, Chart.js visuals
   ========================================================== */

/* ---------------- Constants ---------------- */

const STORAGE_KEY = 'studentspend_data_v1';

const CATEGORIES = ['Food', 'Transport', 'Education', 'College Projects', 'Shopping', 'Entertainment', 'Bills', 'Other'];

const CATEGORY_COLORS = {
  'Food': '#FFB627',
  'Transport': '#4E8FF7',
  'Education': '#37B893',
  'College Projects': '#8B6FF0',
  'Shopping': '#EF5C6E',
  'Entertainment': '#F17FB1',
  'Bills': '#4C4870',
  'Other': '#9993A3'
};

const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

const DEFAULT_DATA = {
  studentName: '',
  monthlyBudget: 6500,
  currency: 'INR',
  theme: 'light',
  categoryBudgets: {},
  expenses: [],
  savingsGoals: []
};

/* ---------------- State ---------------- */

let appData = null;
let charts = {};
let editingExpenseId = null;
let editingGoalId = null;

/* ---------------- Persistence ---------------- */

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      appData = Object.assign({}, DEFAULT_DATA, parsed);
      appData.categoryBudgets = parsed.categoryBudgets || {};
      appData.expenses = parsed.expenses || [];
      appData.savingsGoals = parsed.savingsGoals || [];
    } else {
      appData = JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
  } catch (err) {
    console.error('Failed to load data, resetting.', err);
    appData = JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch (err) {
    console.error('Failed to save data', err);
    showToast('Could not save data — storage may be full.', 'error');
  }
}

/* ---------------- Helpers ---------------- */

function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function currencySymbol() {
  return CURRENCY_SYMBOLS[appData.currency] || '₹';
}

function formatCurrency(amount) {
  const n = Number(amount) || 0;
  const formatted = n.toLocaleString('en-IN', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
  return currencySymbol() + formatted;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function isSameDay(dateStr, dayStr) {
  return dateStr === dayStr;
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday as start
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ---------------- Toasts ---------------- */

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 220);
  }, 3200);
}

/* ---------------- Navigation ---------------- */

function showPage(pageId) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  document.querySelectorAll('.nav-item').forEach((n) => {
    n.classList.toggle('active', n.dataset.page === pageId);
  });
  closeMobileSidebar();
  if (pageId === 'analytics') updateAnalyticsCharts();
  if (pageId === 'budget') renderBudgetPage();
  if (pageId === 'savings') renderSavingsGoals();
  if (pageId === 'expenses') renderExpenseTable();
  if (pageId === 'settings') fillSettingsForm();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openMobileSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('show');
}
function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

/* ---------------- Theme ---------------- */

function applyTheme() {
  document.body.setAttribute('data-theme', appData.theme);
  const isDark = appData.theme === 'dark';
  document.querySelectorAll('#themeToggle span, #settingsThemeToggle span').forEach((s) => {
    s.textContent = isDark ? 'Light mode' : 'Dark mode';
  });
  document.querySelectorAll('#themeToggle i, #settingsThemeToggle i, #mobileThemeToggle i').forEach((i) => {
    i.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  });
}

function toggleTheme() {
  appData.theme = appData.theme === 'dark' ? 'light' : 'dark';
  saveData();
  applyTheme();
  updateAllCharts();
}

/* ---------------- Category selects ---------------- */

function populateCategorySelects() {
  const targets = [
    { el: document.getElementById('expenseCategory'), includeAll: false },
    { el: document.getElementById('filterCategory'), includeAll: true },
    { el: document.getElementById('catBudgetCategory'), includeAll: false }
  ];
  targets.forEach(({ el, includeAll }) => {
    if (!el) return;
    const currentVal = el.value;
    const keep = includeAll ? '<option value="all">All categories</option>' : '';
    el.innerHTML = keep + CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');
    if (currentVal) el.value = currentVal;
  });
}

/* ---------------- Expense CRUD ---------------- */

function addExpense(expense) {
  appData.expenses.push({
    id: generateId(),
    amount: Number(expense.amount),
    description: expense.description,
    category: expense.category,
    date: expense.date,
    paymentMethod: expense.paymentMethod,
    createdAt: Date.now()
  });
  saveData();
  refreshEverything();
}

function editExpense(id, updates) {
  const exp = appData.expenses.find((e) => e.id === id);
  if (!exp) return;
  Object.assign(exp, updates, { amount: Number(updates.amount) });
  saveData();
  refreshEverything();
}

function deleteExpense(id) {
  if (!confirm('Delete this expense? This cannot be undone.')) return;
  appData.expenses = appData.expenses.filter((e) => e.id !== id);
  saveData();
  refreshEverything();
  showToast('Expense deleted.', 'success');
}

/* ---------------- Dashboard ---------------- */

function updateDashboard() {
  const totalSpent = appData.expenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = appData.monthlyBudget - totalSpent;
  const today = todayStr();
  const todaySpent = appData.expenses.filter((e) => isSameDay(e.date, today)).reduce((s, e) => s + e.amount, 0);

  document.getElementById('statBudget').textContent = formatCurrency(appData.monthlyBudget);
  document.getElementById('statSpent').textContent = formatCurrency(totalSpent);
  document.getElementById('statRemaining').textContent = formatCurrency(remaining);
  document.getElementById('statToday').textContent = formatCurrency(todaySpent);
  document.getElementById('statCount').textContent = appData.expenses.length;

  const pct = appData.monthlyBudget > 0 ? Math.min(999, Math.round((totalSpent / appData.monthlyBudget) * 100)) : 0;
  const fill = document.getElementById('dashProgressFill');
  fill.style.width = Math.min(100, pct) + '%';
  fill.className = 'progress-fill' + (pct >= 100 ? ' danger' : pct >= 70 ? ' warn' : '');
  document.getElementById('budgetProgressLabel').textContent = pct + '%';

  const nameEl = document.getElementById('dashUserName');
  nameEl.textContent = appData.studentName ? `Hey, ${appData.studentName} 👋` : 'Hey there 👋';

  const hour = new Date().getHours();
  document.getElementById('dashGreeting').textContent = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  renderRecentTransactions();
  renderDashboardSavings();
  renderInsights(totalSpent, remaining, todaySpent);
}

function renderRecentTransactions() {
  const list = document.getElementById('recentTransactionsList');
  const emptyNote = document.getElementById('recentEmptyNote');
  const recent = [...appData.expenses].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

  if (recent.length === 0) {
    list.innerHTML = '';
    emptyNote.classList.add('show');
    return;
  }
  emptyNote.classList.remove('show');

  list.innerHTML = recent.map((e) => `
    <div class="tx-row">
      <div class="tx-left">
        <span class="tx-cat-dot" style="background:${CATEGORY_COLORS[e.category] || '#999'}"></span>
        <div class="tx-info">
          <div class="tx-desc">${escapeHtml(e.description)}</div>
          <div class="tx-meta">${e.category} · ${formatDate(e.date)}</div>
        </div>
      </div>
      <div class="tx-amount">${formatCurrency(e.amount)}</div>
    </div>
  `).join('');
}

function renderDashboardSavings() {
  const list = document.getElementById('dashSavingsList');
  const emptyNote = document.getElementById('dashSavingsEmpty');
  const goals = appData.savingsGoals.slice(0, 3);

  if (goals.length === 0) {
    list.innerHTML = '';
    emptyNote.classList.add('show');
    return;
  }
  emptyNote.classList.remove('show');

  list.innerHTML = goals.map((g) => {
    const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    return `
      <div class="goal-mini">
        <div class="goal-mini-top">
          <strong>${escapeHtml(g.name)}</strong>
          <span>${pct}%</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join('');
}

function renderInsights(totalSpent, remaining, todaySpent) {
  const insightList = document.getElementById('insightList');
  const insights = [];

  if (appData.expenses.length === 0) {
    insights.push({ icon: 'fa-lightbulb', text: 'Add your first expense to unlock personalized insights.' });
  } else {
    // Highest category
    const byCategory = {};
    appData.expenses.forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    if (topCategory) {
      insights.push({ icon: 'fa-tags', text: `Your highest spending category is ${topCategory[0]} (${formatCurrency(topCategory[1])}).` });
    }

    // This week vs last week
    const now = new Date();
    const thisWeekStart = startOfWeek(now);
    const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart); lastWeekEnd.setMilliseconds(-1);

    const thisWeekTotal = appData.expenses.filter((e) => new Date(e.date + 'T00:00:00') >= thisWeekStart)
      .reduce((s, e) => s + e.amount, 0);
    const lastWeekTotal = appData.expenses.filter((e) => {
      const d = new Date(e.date + 'T00:00:00');
      return d >= lastWeekStart && d <= lastWeekEnd;
    }).reduce((s, e) => s + e.amount, 0);

    insights.push({ icon: 'fa-calendar-week', text: `You've spent ${formatCurrency(thisWeekTotal)} this week.` });

    if (lastWeekTotal > 0) {
      if (thisWeekTotal > lastWeekTotal) {
        insights.push({ icon: 'fa-arrow-trend-up', text: `Your spending is higher than last week (${formatCurrency(lastWeekTotal)}).` });
      } else if (thisWeekTotal < lastWeekTotal) {
        insights.push({ icon: 'fa-arrow-trend-down', text: `Your spending is lower than last week (${formatCurrency(lastWeekTotal)}). Nice work.` });
      } else {
        insights.push({ icon: 'fa-equals', text: `Your spending matches last week's total.` });
      }
    }

    // Average daily spend since first expense
    const firstDate = appData.expenses.reduce((min, e) => (e.date < min ? e.date : min), appData.expenses[0].date);
    const dayCount = Math.max(1, Math.round((new Date(todayStr()) - new Date(firstDate)) / 86400000) + 1);
    const avgDaily = totalSpent / dayCount;
    insights.push({ icon: 'fa-chart-line', text: `Your average daily spending is ${formatCurrency(avgDaily)}.` });

    // Budget status
    if (remaining < 0) {
      insights.push({ icon: 'fa-triangle-exclamation', text: `You've exceeded your monthly budget by ${formatCurrency(Math.abs(remaining))}.` });
    } else {
      insights.push({ icon: 'fa-circle-check', text: `You're within your monthly budget, with ${formatCurrency(remaining)} remaining.` });
    }
  }

  insightList.innerHTML = insights.map((i) => `<li><i class="fa-solid ${i.icon}"></i><span>${i.text}</span></li>`).join('');
}

/* ---------------- Charts ---------------- */

function baseChartColor() {
  const dark = appData.theme === 'dark';
  return { text: dark ? '#B4AFC2' : '#6B6579', grid: dark ? '#312C40' : '#E4E1DC' };
}

function renderChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(canvas.getContext('2d'), config);
}

function categoryTotals() {
  const totals = {};
  appData.expenses.forEach((e) => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
  return totals;
}

function buildCategoryDoughnutConfig() {
  const totals = categoryTotals();
  const labels = Object.keys(totals);
  const data = Object.values(totals);
  const colors = labels.map((l) => CATEGORY_COLORS[l] || '#999');
  const colorInfo = baseChartColor();
  return {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { color: colorInfo.text, boxWidth: 10, padding: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}` } }
      }
    }
  };
}

function last7DaysLabelsAndData() {
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const dateStr = daysAgoStr(i);
    const d = new Date(dateStr + 'T00:00:00');
    labels.push(d.toLocaleDateString('en-IN', { weekday: 'short' }));
    const total = appData.expenses.filter((e) => e.date === dateStr).reduce((s, e) => s + e.amount, 0);
    data.push(total);
  }
  return { labels, data };
}

function buildLineConfig(labels, data, color) {
  const colorInfo = baseChartColor();
  return {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data, borderColor: color, backgroundColor: color + '22',
        fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: color, borderWidth: 2.5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.raw) } } },
      scales: {
        x: { ticks: { color: colorInfo.text, font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { color: colorInfo.text, font: { size: 11 }, callback: (v) => currencySymbol() + v }, grid: { color: colorInfo.grid } }
      }
    }
  };
}

function updateDashboardCharts() {
  const hasExpenses = appData.expenses.length > 0;
  document.getElementById('dashCategoryEmpty').classList.toggle('show', !hasExpenses);
  document.getElementById('dashCategoryChart').style.display = hasExpenses ? 'block' : 'none';

  if (hasExpenses) renderChart('dashCategoryChart', buildCategoryDoughnutConfig());
  else if (charts['dashCategoryChart']) { charts['dashCategoryChart'].destroy(); delete charts['dashCategoryChart']; }

  const { labels, data } = last7DaysLabelsAndData();
  renderChart('dashDailyChart', buildLineConfig(labels, data, '#4E8FF7'));
}

function last30DaysLabelsAndData() {
  const labels = [];
  const data = [];
  for (let i = 29; i >= 0; i--) {
    const dateStr = daysAgoStr(i);
    const d = new Date(dateStr + 'T00:00:00');
    labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
    const total = appData.expenses.filter((e) => e.date === dateStr).reduce((s, e) => s + e.amount, 0);
    data.push(total);
  }
  return { labels, data };
}

function last8WeeksLabelsAndData() {
  const labels = [];
  const data = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const weekStart = startOfWeek(now);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
    labels.push(weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
    const total = appData.expenses.filter((e) => {
      const d = new Date(e.date + 'T00:00:00');
      return d >= weekStart && d <= weekEnd;
    }).reduce((s, e) => s + e.amount, 0);
    data.push(total);
  }
  return { labels, data };
}

function last6MonthsLabelsAndData() {
  const labels = [];
  const data = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    labels.push(monthLabel);
    const total = appData.expenses.filter((e) => {
      const ed = new Date(e.date + 'T00:00:00');
      return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth();
    }).reduce((s, e) => s + e.amount, 0);
    data.push(total);
  }
  return { labels, data };
}

function buildBarConfig(labels, data, color) {
  const colorInfo = baseChartColor();
  return {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: color, borderRadius: 6, maxBarThickness: 34 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.raw) } } },
      scales: {
        x: { ticks: { color: colorInfo.text, font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { color: colorInfo.text, font: { size: 11 }, callback: (v) => currencySymbol() + v }, grid: { color: colorInfo.grid } }
      }
    }
  };
}

function updateAnalyticsCharts() {
  const hasExpenses = appData.expenses.length > 0;
  document.getElementById('anCategoryEmpty').classList.toggle('show', !hasExpenses);
  document.getElementById('anCategoryChart').style.display = hasExpenses ? 'block' : 'none';
  if (hasExpenses) renderChart('anCategoryChart', buildCategoryDoughnutConfig());
  else if (charts['anCategoryChart']) { charts['anCategoryChart'].destroy(); delete charts['anCategoryChart']; }

  const daily = last30DaysLabelsAndData();
  renderChart('anDailyChart', buildLineConfig(daily.labels, daily.data, '#37B893'));

  const weekly = last8WeeksLabelsAndData();
  renderChart('anWeeklyChart', buildBarConfig(weekly.labels, weekly.data, '#FFB627'));

  const monthly = last6MonthsLabelsAndData();
  renderChart('anMonthlyChart', buildBarConfig(monthly.labels, monthly.data, '#8B6FF0'));
}

function updateAllCharts() {
  updateDashboardCharts();
  const analyticsPage = document.getElementById('page-analytics');
  if (analyticsPage.classList.contains('active')) updateAnalyticsCharts();
}

/* ---------------- Expenses page (table, filters) ---------------- */

function getFilteredSortedExpenses() {
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const category = document.getElementById('filterCategory').value;
  const dateFilter = document.getElementById('filterDate').value;
  const sort = document.getElementById('sortSelect').value;

  let list = [...appData.expenses];

  if (search) list = list.filter((e) => e.description.toLowerCase().includes(search));
  if (category !== 'all') list = list.filter((e) => e.category === category);
  if (dateFilter) list = list.filter((e) => e.date === dateFilter);

  switch (sort) {
    case 'newest': list.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)); break;
    case 'oldest': list.sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt)); break;
    case 'highest': list.sort((a, b) => b.amount - a.amount); break;
    case 'lowest': list.sort((a, b) => a.amount - b.amount); break;
  }
  return list;
}

function renderExpenseTable() {
  const tbody = document.getElementById('expenseTableBody');
  const emptyNote = document.getElementById('expenseTableEmpty');
  const list = getFilteredSortedExpenses();

  if (list.length === 0) {
    tbody.innerHTML = '';
    emptyNote.classList.add('show');
    return;
  }
  emptyNote.classList.remove('show');

  tbody.innerHTML = list.map((e) => `
    <tr>
      <td>${formatDate(e.date)}</td>
      <td>${escapeHtml(e.description)}</td>
      <td><span class="cat-pill"><span class="dot" style="background:${CATEGORY_COLORS[e.category] || '#999'}"></span>${e.category}</span></td>
      <td>${e.paymentMethod}</td>
      <td class="right">${formatCurrency(e.amount)}</td>
      <td class="right">
        <div class="row-actions">
          <button class="edit-btn" data-id="${e.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="del-btn" data-id="${e.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => openExpenseModalForEdit(btn.dataset.id));
  });
  tbody.querySelectorAll('.del-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteExpense(btn.dataset.id));
  });
}

/* ---------------- Expense modal ---------------- */

function openExpenseModalForAdd() {
  editingExpenseId = null;
  document.getElementById('expenseModalTitle').textContent = 'Add Expense';
  document.getElementById('expenseSubmitBtn').textContent = 'Add Expense';
  document.getElementById('expenseForm').reset();
  document.getElementById('expenseId').value = '';
  document.getElementById('expenseDate').value = todayStr();
  document.getElementById('expenseCurrencyPrefix').textContent = currencySymbol();
  document.getElementById('expenseModalOverlay').classList.add('show');
  document.getElementById('expenseAmount').focus();
}

function openExpenseModalForEdit(id) {
  const exp = appData.expenses.find((e) => e.id === id);
  if (!exp) return;
  editingExpenseId = id;
  document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
  document.getElementById('expenseSubmitBtn').textContent = 'Save Changes';
  document.getElementById('expenseId').value = id;
  document.getElementById('expenseAmount').value = exp.amount;
  document.getElementById('expenseDescription').value = exp.description;
  document.getElementById('expenseCategory').value = exp.category;
  document.getElementById('expenseDate').value = exp.date;
  document.getElementById('expensePayment').value = exp.paymentMethod;
  document.getElementById('expenseCurrencyPrefix').textContent = currencySymbol();
  document.getElementById('expenseModalOverlay').classList.add('show');
}

function closeExpenseModal() {
  document.getElementById('expenseModalOverlay').classList.remove('show');
  editingExpenseId = null;
}

function handleExpenseFormSubmit(evt) {
  evt.preventDefault();
  const data = {
    amount: document.getElementById('expenseAmount').value,
    description: document.getElementById('expenseDescription').value.trim(),
    category: document.getElementById('expenseCategory').value,
    date: document.getElementById('expenseDate').value,
    paymentMethod: document.getElementById('expensePayment').value
  };
  if (!data.amount || Number(data.amount) <= 0 || !data.description || !data.date) {
    showToast('Please fill in all fields with a valid amount.', 'error');
    return;
  }
  if (editingExpenseId) {
    editExpense(editingExpenseId, data);
    showToast('Expense updated.', 'success');
  } else {
    addExpense(data);
    showToast('Expense added.', 'success');
  }
  closeExpenseModal();
}

/* ---------------- Budget page ---------------- */

function renderBudgetPage() {
  document.getElementById('monthlyBudgetInput').value = appData.monthlyBudget;
  document.getElementById('budgetCurrencyPrefix').textContent = currencySymbol();

  const totalSpent = appData.expenses.reduce((s, e) => s + e.amount, 0);
  const pct = appData.monthlyBudget > 0 ? Math.round((totalSpent / appData.monthlyBudget) * 100) : 0;
  document.getElementById('budgetPageSpentLabel').textContent = `${formatCurrency(totalSpent)} of ${formatCurrency(appData.monthlyBudget)} used`;
  document.getElementById('budgetPagePercentLabel').textContent = pct + '%';
  const fill = document.getElementById('budgetPageFill');
  fill.style.width = Math.min(100, pct) + '%';
  fill.className = 'progress-fill' + (pct >= 100 ? ' danger' : pct >= 70 ? ' warn' : '');

  const warningEl = document.getElementById('budgetPageWarning');
  warningEl.textContent = budgetWarningMessage(pct);
  warningEl.className = 'budget-warning' + (pct >= 100 ? ' danger' : '');

  renderCategoryBudgetList();
}

function budgetWarningMessage(pct) {
  if (pct >= 100) return "You have exceeded your budget.";
  if (pct >= 90) return "You're very close to your budget limit.";
  if (pct >= 70) return "You're approaching your budget.";
  return '';
}

function renderCategoryBudgetList() {
  const container = document.getElementById('categoryBudgetList');
  const emptyNote = document.getElementById('categoryBudgetEmpty');
  const budgets = appData.categoryBudgets;
  const categories = Object.keys(budgets);

  if (categories.length === 0) {
    container.innerHTML = '';
    emptyNote.classList.add('show');
    return;
  }
  emptyNote.classList.remove('show');

  const totals = categoryTotals();

  container.innerHTML = categories.map((cat) => {
    const budget = budgets[cat];
    const spent = totals[cat] || 0;
    const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
    const barClass = pct >= 100 ? 'danger' : pct >= 70 ? 'warn' : '';
    const warning = budgetWarningMessage(pct);
    return `
      <div class="cat-budget-item">
        <div class="cbi-top">
          <span class="cbi-name"><span class="tx-cat-dot" style="background:${CATEGORY_COLORS[cat] || '#999'}"></span>${cat}</span>
          <span class="cbi-numbers">${formatCurrency(spent)} / ${formatCurrency(budget)} · ${pct}%</span>
          <div class="cbi-actions">
            <button class="cbi-del" data-cat="${cat}" title="Remove"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="progress-track"><div class="progress-fill ${barClass}" style="width:${Math.min(100, pct)}%"></div></div>
        ${warning ? `<div class="cbi-warning${pct >= 100 ? ' danger' : ''}">${warning}</div>` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.cbi-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm(`Remove the budget for ${btn.dataset.cat}?`)) return;
      delete appData.categoryBudgets[btn.dataset.cat];
      saveData();
      renderCategoryBudgetList();
      showToast('Category budget removed.', 'success');
    });
  });
}

function handleMonthlyBudgetSubmit(evt) {
  evt.preventDefault();
  const val = Number(document.getElementById('monthlyBudgetInput').value);
  if (isNaN(val) || val < 0) { showToast('Enter a valid budget amount.', 'error'); return; }
  appData.monthlyBudget = val;
  saveData();
  refreshEverything();
  showToast('Monthly budget updated.', 'success');
}

function handleCategoryBudgetSubmit(evt) {
  evt.preventDefault();
  const cat = document.getElementById('catBudgetCategory').value;
  const amount = Number(document.getElementById('catBudgetAmount').value);
  if (!cat || isNaN(amount) || amount <= 0) { showToast('Enter a valid category and amount.', 'error'); return; }
  appData.categoryBudgets[cat] = amount;
  saveData();
  renderCategoryBudgetList();
  document.getElementById('categoryBudgetForm').reset();
  showToast('Category budget saved.', 'success');
}

/* ---------------- Savings goals ---------------- */

function renderSavingsGoals() {
  const grid = document.getElementById('goalGrid');
  const emptyNote = document.getElementById('goalEmptyNote');
  const goals = appData.savingsGoals;

  if (goals.length === 0) {
    grid.innerHTML = '';
    emptyNote.classList.add('show');
    return;
  }
  emptyNote.classList.remove('show');

  grid.innerHTML = goals.map((g) => {
    const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    const barClass = pct >= 100 ? '' : '';
    return `
      <div class="goal-card">
        <div class="goal-card-head">
          <div>
            <h4>${escapeHtml(g.name)}</h4>
            <div class="goal-date">Target: ${formatDate(g.targetDate)}</div>
          </div>
          <div class="goal-icon-btns">
            <button class="goal-edit-btn" data-id="${g.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="goal-del-btn" data-id="${g.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="goal-amounts">
          <span class="saved">${formatCurrency(g.current)}</span>
          <span>${formatCurrency(g.target)}</span>
        </div>
        <div class="goal-percent">${pct}% complete</div>
        <button class="goal-add-btn" data-id="${g.id}"><i class="fa-solid fa-plus"></i> Add funds</button>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.goal-edit-btn').forEach((btn) => btn.addEventListener('click', () => openGoalModalForEdit(btn.dataset.id)));
  grid.querySelectorAll('.goal-del-btn').forEach((btn) => btn.addEventListener('click', () => deleteSavingsGoal(btn.dataset.id)));
  grid.querySelectorAll('.goal-add-btn').forEach((btn) => btn.addEventListener('click', () => openFundsModal(btn.dataset.id)));
}

function addSavingsGoal(goal) {
  appData.savingsGoals.push({
    id: generateId(),
    name: goal.name,
    target: Number(goal.target),
    current: Number(goal.current) || 0,
    targetDate: goal.targetDate
  });
  saveData();
  renderSavingsGoals();
  renderDashboardSavings();
}

function updateSavingsGoal(id, updates) {
  const goal = appData.savingsGoals.find((g) => g.id === id);
  if (!goal) return;
  Object.assign(goal, updates);
  saveData();
  renderSavingsGoals();
  renderDashboardSavings();
}

function deleteSavingsGoal(id) {
  if (!confirm('Delete this savings goal?')) return;
  appData.savingsGoals = appData.savingsGoals.filter((g) => g.id !== id);
  saveData();
  renderSavingsGoals();
  renderDashboardSavings();
  showToast('Savings goal deleted.', 'success');
}

function openGoalModalForAdd() {
  editingGoalId = null;
  document.getElementById('goalModalTitle').textContent = 'New Savings Goal';
  document.getElementById('goalSubmitBtn').textContent = 'Save Goal';
  document.getElementById('goalForm').reset();
  document.getElementById('goalId').value = '';
  document.getElementById('goalCurrent').value = 0;
  document.getElementById('goalModalOverlay').classList.add('show');
  document.getElementById('goalName').focus();
}

function openGoalModalForEdit(id) {
  const goal = appData.savingsGoals.find((g) => g.id === id);
  if (!goal) return;
  editingGoalId = id;
  document.getElementById('goalModalTitle').textContent = 'Edit Savings Goal';
  document.getElementById('goalSubmitBtn').textContent = 'Save Changes';
  document.getElementById('goalId').value = id;
  document.getElementById('goalName').value = goal.name;
  document.getElementById('goalTarget').value = goal.target;
  document.getElementById('goalCurrent').value = goal.current;
  document.getElementById('goalDate').value = goal.targetDate;
  document.getElementById('goalModalOverlay').classList.add('show');
}

function closeGoalModal() {
  document.getElementById('goalModalOverlay').classList.remove('show');
  editingGoalId = null;
}

function handleGoalFormSubmit(evt) {
  evt.preventDefault();
  const data = {
    name: document.getElementById('goalName').value.trim(),
    target: document.getElementById('goalTarget').value,
    current: document.getElementById('goalCurrent').value,
    targetDate: document.getElementById('goalDate').value
  };
  if (!data.name || !data.target || Number(data.target) <= 0 || !data.targetDate) {
    showToast('Please fill in all goal fields correctly.', 'error');
    return;
  }
  if (editingGoalId) {
    updateSavingsGoal(editingGoalId, data);
    showToast('Savings goal updated.', 'success');
  } else {
    addSavingsGoal(data);
    showToast('Savings goal created.', 'success');
  }
  closeGoalModal();
}

let fundsTargetGoalId = null;

function openFundsModal(id) {
  fundsTargetGoalId = id;
  document.getElementById('fundsGoalId').value = id;
  document.getElementById('fundsAmount').value = '';
  document.getElementById('fundsModalOverlay').classList.add('show');
  document.getElementById('fundsAmount').focus();
}

function closeFundsModal() {
  document.getElementById('fundsModalOverlay').classList.remove('show');
  fundsTargetGoalId = null;
}

function handleFundsFormSubmit(evt) {
  evt.preventDefault();
  const amount = Number(document.getElementById('fundsAmount').value);
  if (!fundsTargetGoalId || isNaN(amount) || amount <= 0) { showToast('Enter a valid amount.', 'error'); return; }
  const goal = appData.savingsGoals.find((g) => g.id === fundsTargetGoalId);
  if (!goal) return;
  updateSavingsGoal(goal.id, { current: goal.current + amount });
  showToast(`Added ${formatCurrency(amount)} to ${goal.name}.`, 'success');
  closeFundsModal();
}

/* ---------------- Settings ---------------- */

function fillSettingsForm() {
  document.getElementById('settingsName').value = appData.studentName;
  document.getElementById('settingsBudget').value = appData.monthlyBudget;
  document.getElementById('settingsCurrency').value = appData.currency;
}

function handleProfileFormSubmit(evt) {
  evt.preventDefault();
  appData.studentName = document.getElementById('settingsName').value.trim();
  const budget = Number(document.getElementById('settingsBudget').value);
  if (!isNaN(budget) && budget >= 0) appData.monthlyBudget = budget;
  appData.currency = document.getElementById('settingsCurrency').value;
  saveData();
  refreshEverything();
  showToast('Settings saved.', 'success');
}

function clearAllExpenses() {
  if (!confirm('This will permanently delete all expenses. Continue?')) return;
  appData.expenses = [];
  saveData();
  refreshEverything();
  showToast('All expenses cleared.', 'success');
}

function resetApplication() {
  if (!confirm('This will erase everything — expenses, budgets, goals and settings. Continue?')) return;
  localStorage.removeItem(STORAGE_KEY);
  appData = JSON.parse(JSON.stringify(DEFAULT_DATA));
  saveData();
  applyTheme();
  refreshEverything();
  fillSettingsForm();
  showToast('Application reset.', 'success');
}

/* ---------------- Demo data ---------------- */

function loadDemoData() {
  if (appData.expenses.length > 0 && !confirm('This will add sample expenses on top of your current data. Continue?')) return;

  const demoItems = [
    { description: 'College canteen lunch', category: 'Food', paymentMethod: 'UPI', amountRange: [60, 150] },
    { description: 'Bus fare', category: 'Transport', paymentMethod: 'Cash', amountRange: [15, 40] },
    { description: 'Project printing & binding', category: 'College Projects', paymentMethod: 'Cash', amountRange: [80, 250] },
    { description: 'Stationery', category: 'Education', paymentMethod: 'UPI', amountRange: [40, 180] },
    { description: 'Evening snacks', category: 'Food', paymentMethod: 'Cash', amountRange: [30, 90] },
    { description: 'Movie with friends', category: 'Entertainment', paymentMethod: 'Credit Card', amountRange: [180, 350] },
    { description: 'Project materials', category: 'College Projects', paymentMethod: 'UPI', amountRange: [150, 400] },
    { description: 'Online purchase', category: 'Shopping', paymentMethod: 'Debit Card', amountRange: [200, 600] },
    { description: 'Mobile recharge', category: 'Bills', paymentMethod: 'UPI', amountRange: [150, 300] },
    { description: 'Auto fare', category: 'Transport', paymentMethod: 'Cash', amountRange: [40, 120] },
    { description: 'Coffee with classmates', category: 'Food', paymentMethod: 'UPI', amountRange: [50, 120] },
    { description: 'Textbook purchase', category: 'Education', paymentMethod: 'Debit Card', amountRange: [250, 500] }
  ];

  const newExpenses = [];
  for (let i = 0; i < 24; i++) {
    const item = demoItems[Math.floor(Math.random() * demoItems.length)];
    const amount = Math.round(item.amountRange[0] + Math.random() * (item.amountRange[1] - item.amountRange[0]));
    const daysBack = Math.floor(Math.random() * 28);
    newExpenses.push({
      id: generateId(),
      amount,
      description: item.description,
      category: item.category,
      date: daysAgoStr(daysBack),
      paymentMethod: item.paymentMethod,
      createdAt: Date.now() - daysBack * 86400000 + Math.random() * 1000
    });
  }
  appData.expenses = appData.expenses.concat(newExpenses);

  if (appData.savingsGoals.length === 0) {
    appData.savingsGoals.push({
      id: generateId(), name: 'New Headphones', target: 5000, current: 2000,
      targetDate: daysAgoStr(-45)
    });
    appData.savingsGoals.push({
      id: generateId(), name: 'Weekend Trip', target: 8000, current: 1500,
      targetDate: daysAgoStr(-70)
    });
  }
  if (Object.keys(appData.categoryBudgets).length === 0) {
    appData.categoryBudgets = { Food: 2000, Transport: 1000, 'College Projects': 1500 };
  }

  saveData();
  refreshEverything();
  showToast('Demo data loaded!', 'success');
}

/* ---------------- Refresh orchestration ---------------- */

function refreshEverything() {
  updateDashboard();
  updateAllCharts();
  renderExpenseTable();
  if (document.getElementById('page-budget').classList.contains('active')) renderBudgetPage();
  if (document.getElementById('page-savings').classList.contains('active')) renderSavingsGoals();
}

/* ---------------- Init & event wiring ---------------- */

function init() {
  loadData();
  applyTheme();
  populateCategorySelects();

  document.getElementById('filterDate').setAttribute('max', todayStr());
  document.getElementById('expenseDate').setAttribute('max', todayStr());

  // Navigation
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });
  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => showPage(btn.dataset.goto));
  });

  // Mobile sidebar
  document.getElementById('menuToggle').addEventListener('click', openMobileSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', closeMobileSidebar);

  // Theme
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('mobileThemeToggle').addEventListener('click', toggleTheme);
  document.getElementById('settingsThemeToggle').addEventListener('click', toggleTheme);

  // Demo data
  document.getElementById('loadDemoBtn').addEventListener('click', loadDemoData);

  // Expense modal
  document.getElementById('addExpenseBtnDash').addEventListener('click', openExpenseModalForAdd);
  document.getElementById('addExpenseBtnList').addEventListener('click', openExpenseModalForAdd);
  document.getElementById('closeExpenseModal').addEventListener('click', closeExpenseModal);
  document.getElementById('cancelExpenseBtn').addEventListener('click', closeExpenseModal);
  document.getElementById('expenseModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'expenseModalOverlay') closeExpenseModal(); });
  document.getElementById('expenseForm').addEventListener('submit', handleExpenseFormSubmit);

  // Expenses page filters
  document.getElementById('searchInput').addEventListener('input', renderExpenseTable);
  document.getElementById('filterCategory').addEventListener('change', renderExpenseTable);
  document.getElementById('filterDate').addEventListener('change', renderExpenseTable);
  document.getElementById('sortSelect').addEventListener('change', renderExpenseTable);
  document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterCategory').value = 'all';
    document.getElementById('filterDate').value = '';
    document.getElementById('sortSelect').value = 'newest';
    renderExpenseTable();
  });

  // Budget page
  document.getElementById('monthlyBudgetForm').addEventListener('submit', handleMonthlyBudgetSubmit);
  document.getElementById('categoryBudgetForm').addEventListener('submit', handleCategoryBudgetSubmit);

  // Savings goals
  document.getElementById('addGoalBtn').addEventListener('click', openGoalModalForAdd);
  document.getElementById('closeGoalModal').addEventListener('click', closeGoalModal);
  document.getElementById('cancelGoalBtn').addEventListener('click', closeGoalModal);
  document.getElementById('goalModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'goalModalOverlay') closeGoalModal(); });
  document.getElementById('goalForm').addEventListener('submit', handleGoalFormSubmit);

  document.getElementById('closeFundsModal').addEventListener('click', closeFundsModal);
  document.getElementById('cancelFundsBtn').addEventListener('click', closeFundsModal);
  document.getElementById('fundsModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'fundsModalOverlay') closeFundsModal(); });
  document.getElementById('fundsForm').addEventListener('submit', handleFundsFormSubmit);

  // Settings
  document.getElementById('profileForm').addEventListener('submit', handleProfileFormSubmit);
  document.getElementById('clearExpensesBtn').addEventListener('click', clearAllExpenses);
  document.getElementById('resetAppBtn').addEventListener('click', resetApplication);

  // Keyboard: close modals with Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeExpenseModal();
      closeGoalModal();
      closeFundsModal();
    }
  });

  refreshEverything();
}

document.addEventListener('DOMContentLoaded', init);
