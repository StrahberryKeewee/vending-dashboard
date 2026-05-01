const API_BASE = '/api';

let donutChart     = null;
let trendChart     = null;
let currentPeriod  = 'weekly';
let currentMachine = '';
let allMachines    = [];

async function apiFetch(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function machineParam() {
  return currentMachine ? `&machine_id=${encodeURIComponent(currentMachine)}` : '';
}

async function loadMachinesFromApi() {
  try {
    const data = await apiFetch('/machines/list.php');
    allMachines = data.machines ?? [];
  } catch {
    allMachines = [];
  }

  const select = document.getElementById('machineSelect');
  allMachines.forEach(m => {
    const opt = document.createElement('option');
    opt.value       = m.machine_id;
    opt.textContent = `${m.machine_id} — ${m.location}`;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    currentMachine = select.value;
    loadSummary();
    loadTrend(currentPeriod);
  });
}

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function buildStars(rating) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="star${i < rating ? ' filled' : ''}">&#9733;</span>`
  ).join('') + `<span class="rating-label">${rating}/5</span>`;
}

async function loadSummary() {
  let data;
  try {
    data = await apiFetch('/sales/summary.php?year=' + new Date().getFullYear() + machineParam());
  } catch {
    data = {
      total_ytd: 220800,
      growth_percent: 18.5,
      categories: [
        { key: 'beverages', label: 'Beverages',      color: '#22c55e', percent: 45, revenue: 99360 },
        { key: 'snacks',    label: 'Snacks',          color: '#3b82f6', percent: 30, revenue: 66240 },
        { key: 'candy',     label: 'Candy',           color: '#f59e0b', percent: 15, revenue: 33120 },
        { key: 'healthy',   label: 'Healthy Options', color: '#ef4444', percent: 10, revenue: 22080 },
      ],
    };
  }

  document.getElementById('ytdAmount').textContent = formatCurrency(data.total_ytd);

  const growthEl = document.getElementById('ytdGrowth');
  const sign = data.growth_percent >= 0 ? '+' : '';
  growthEl.textContent = `${sign}${data.growth_percent}%`;
  growthEl.style.color = data.growth_percent >= 0 ? '#22c55e' : '#ef4444';

  const legendEl = document.getElementById('donutLegend');
  legendEl.innerHTML = `
    <div class="legend-item" style="grid-column:1/-1;color:var(--text-muted);font-style:italic;font-size:.78rem;">
      Category breakdown unavailable
    </div>`;

  const ctx = document.getElementById('donutChart').getContext('2d');
  if (donutChart) donutChart.destroy();

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Total Sales'],
      datasets: [{
        data:            [data.total_ytd || 1],
        backgroundColor: ['#2d6af4'],
        borderWidth:     3,
        borderColor:     '#ffffff',
        hoverOffset:     6,
      }],
    },
    options: {
      cutout: '68%',
      plugins: { legend: { display: false }, tooltip: {
        callbacks: {
          label: ctx => ` ${formatCurrency(data.total_ytd)}`,
        },
      }},
      animation: { animateRotate: true, duration: 800 },
    },
  });
}

async function loadAnalyticsStats() {
  let data;
  try {
    data = await apiFetch('/sales/stats.php?' + (currentMachine ? `machine_id=${encodeURIComponent(currentMachine)}` : ''));
  } catch {
    return;
  }

  const transactions = document.getElementById('statTransactions');
  const avgSale      = document.getElementById('statAvgSale');
  const topCat       = document.getElementById('statTopCat');
  const avgRating    = document.getElementById('statAvgRating');

  if (transactions) transactions.textContent = data.total_transactions;
  if (avgSale)      avgSale.textContent      = formatCurrency(data.avg_sale);
  if (topCat)       topCat.textContent       = data.top_category ?? '--';
  if (avgRating)    avgRating.textContent    = data.avg_rating > 0 ? data.avg_rating + ' / 5' : '--';
}

async function loadLatestSale() {
  let data;
  try {
    data = await apiFetch('/sales/latest.php');
  } catch {
    return;
  }

  const sale = data.sale;

  const itemEl     = document.getElementById('latestItem');
  const timeEl     = document.getElementById('latestTime');
  const amountEl   = document.getElementById('latestAmount');
  const locationEl = document.getElementById('latestLocation');

  if (!sale) {
    if (itemEl)     itemEl.textContent     = '--';
    if (timeEl)     timeEl.textContent     = '--';
    if (amountEl)   amountEl.textContent   = '--';
    if (locationEl) locationEl.textContent = '--';
    return;
  }

  if (itemEl)     itemEl.textContent     = sale.product_name ?? '--';
  if (amountEl)   amountEl.textContent   = formatCurrency(sale.amount);
  if (locationEl) locationEl.textContent = sale.location ?? '--';

  if (timeEl && sale.sale_time) {
    const d = new Date(sale.sale_time);
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    timeEl.innerHTML = `${date}<br><span style="font-weight:400;color:var(--text-secondary)">${time}</span>`;
  }
}

async function loadTrend(period) {
  let data;
  try {
    data = await apiFetch(`/sales/weekly.php?period=${period}${machineParam()}`);
  } catch {
    const defaults = {
      daily:   { labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], data: [620,740,590,810,930,470,380] },
      weekly:  { labels: ['Week 1','Week 2','Week 3','Week 4'],       data: [3100,3300,3700,4500] },
      monthly: { labels: ['Jan','Feb','Mar','Apr'],                   data: [18200,19400,21500,23800] },
    };
    data = defaults[period] ?? defaults.weekly;
    data.period = period;
  }

  const titles = { daily: 'Daily Profit Trend', weekly: 'Weekly Profit Trend', monthly: 'Monthly Profit Trend' };
  document.getElementById('trendTitle').textContent = titles[data.period] ?? 'Profit Trend';

  const ctx = document.getElementById('trendChart').getContext('2d');
  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{
        data:            data.data,
        borderColor:     '#22c55e',
        backgroundColor: 'rgba(34,197,94,.08)',
        borderWidth:     2.5,
        pointRadius:     5,
        pointBackgroundColor: '#22c55e',
        pointBorderColor:     '#fff',
        pointBorderWidth:     2,
        tension: 0.35,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` },
      }},
      scales: {
        x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
        y: {
          grid: { color: '#f0f2f8' },
          ticks: {
            color: '#9ca3af',
            font: { size: 11 },
            callback: v => '$' + (v >= 1000 ? (v / 1000).toFixed(2) + 'k' : v.toFixed(2)),
          },
          beginAtZero: true,
        },
      },
    },
  });
}

async function loadFeedback() {
  const tbody = document.getElementById('feedbackBody');
  tbody.innerHTML = '<tr class="table-loading"><td colspan="5">Loading feedback...</td></tr>';

  let data;
  try {
    data = await apiFetch('/feedback/list.php?limit=25');
  } catch {
    data = {
      feedback: [
        { id:1, rating:5, comments:'Great selection and fresh products!',        location:'Building A - Lobby',     items_purchased:['Coca Cola'],           suggestions:'More healthy snack options' },
        { id:2, rating:4, comments:'Machine works well, could use more variety', location:'Building B - 2nd Floor', items_purchased:['Chips'],               suggestions:'Add energy drinks' },
        { id:3, rating:5, comments:'Convenient and fast service',                location:'Building C - Cafeteria', items_purchased:['Snickers Bar'],        suggestions:null },
        { id:4, rating:3, comments:'Sometimes out of stock on popular items',    location:'Building A - 3rd Floor', items_purchased:['Sprite'],              suggestions:'Stock more popular drinks' },
        { id:5, rating:4, comments:'Good variety but prices are a bit high',     location:'Building D - Break Room',items_purchased:['Water','Granola Bar'], suggestions:'Lower prices on water' },
      ],
    };
  }

  if (!data.feedback.length) {
    tbody.innerHTML = '<tr class="table-loading"><td colspan="5">No feedback submitted yet.</td></tr>';
    return;
  }

  tbody.innerHTML = data.feedback.map(row => {
    const items = Array.isArray(row.items_purchased) ? row.items_purchased : [];
    const itemsHtml = items.length
      ? `<div class="items-list">${items.map(i => `<span class="item-tag">${escHtml(i)}</span>`).join('')}</div>`
      : '<span class="no-suggestion">None</span>';

    const suggHtml = row.suggestions
      ? `<span class="suggestion-text">${escHtml(row.suggestions)}</span>`
      : '<span class="no-suggestion">None</span>';

    return `<tr id="feedback-row-${row.id}">
      <td><div class="stars">${buildStars(row.rating)}</div></td>
      <td>${escHtml(row.comments ?? '')}</td>
      <td>
        <div class="cell-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          ${escHtml(row.location)}
        </div>
      </td>
      <td>${itemsHtml}</td>
      <td>${suggHtml}</td>
      <td>
        <button class="btn-delete" onclick="deleteFeedback(${row.id})" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </td>
    </tr>`;
  }).join('');

}


const CATEGORIES = ['Snack', 'Beverage', 'Health Products', 'School Supplies'];

let selectedMachineId = '';

function loadMachines() {
  const tbody = document.getElementById('machinesBody');

  if (!allMachines.length) {
    tbody.innerHTML = '<tr class="table-loading"><td colspan="6">No machines found.</td></tr>';
    return;
  }

  const feedbackBase = 'http://atlasvendingoperations.com/feedback/';

  tbody.innerHTML = allMachines.map(m => {
    const url = `${feedbackBase}?machine=${encodeURIComponent(m.machine_id)}&location=${encodeURIComponent(m.location)}`;
    return `<tr class="machine-row" data-machine-id="${escHtml(m.machine_id)}" data-location="${escHtml(m.location)}">
      <td><strong>${escHtml(m.machine_id)}</strong></td>
      <td>${escHtml(m.location)}</td>
      <td>${escHtml(m.building ?? '')}</td>
      <td>${escHtml(m.floor ?? '')}</td>
      <td><a class="qr-link" href="${url}" target="_blank">${url}</a></td>
      <td>
        <button class="btn-qr" onclick="event.stopPropagation();showQrModal('${escHtml(m.machine_id)}', '${escHtml(m.location)}')">
          Show QR
        </button>
      </td>
    </tr>`;
  }).join('');

  document.querySelectorAll('.machine-row').forEach(row => {
    row.addEventListener('click', () => openMachineDetail(row.dataset.machineId, row.dataset.location));
  });
}

function populateCategorySelect() {
  const sel = document.getElementById('newCategory');
  if (sel.options.length > 1) return;
  CATEGORIES.forEach(cat => {
    const opt = document.createElement('option');
    opt.value       = cat;
    opt.textContent = cat;
    sel.appendChild(opt);
  });
}

async function openMachineDetail(machineId, location) {
  selectedMachineId = machineId;

  document.querySelectorAll('.machine-row').forEach(r => r.classList.toggle('selected', r.dataset.machineId === machineId));

  const panel = document.getElementById('machineDetail');
  panel.classList.remove('hidden');
  document.getElementById('detailMachineTitle').textContent = `${machineId} — ${location}`;

  populateCategorySelect();
  await loadColumnMappings(machineId);

  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadColumnMappings(machineId) {
  const tbody = document.getElementById('columnsBody');
  tbody.innerHTML = '<tr class="table-loading"><td colspan="5">Loading...</td></tr>';

  let data;
  try {
    data = await apiFetch(`/machines/columns.php?machine_id=${encodeURIComponent(machineId)}`);
  } catch {
    tbody.innerHTML = '<tr class="table-loading"><td colspan="5">Failed to load.</td></tr>';
    return;
  }

  const cols = data.columns ?? [];
  if (!cols.length) {
    tbody.innerHTML = '<tr class="table-loading"><td colspan="5">No mappings yet. Add one below.</td></tr>';
    return;
  }

  tbody.innerHTML = cols.map(c => `
    <tr>
      <td><strong>${escHtml(c.column_num)}</strong></td>
      <td>${escHtml(c.product_name)}</td>
      <td><span class="item-tag">${escHtml(c.category ?? '')}</span></td>
      <td>
        <button class="btn-delete" onclick="deleteColumnMapping(${c.id})" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </td>
    </tr>
  `).join('');
}

async function addColumnMapping() {
  const colNum      = document.getElementById('newColumnNum').value.trim();
  const productName = document.getElementById('newProductName').value.trim();
  const category    = document.getElementById('newCategory').value;
  const btn         = document.getElementById('addMappingBtn');

  if (!colNum || !productName || !category || !selectedMachineId) return;

  btn.disabled = true;
  try {
    await fetch(`${API_BASE}/machines/columns.php`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ machine_id: selectedMachineId, column_num: colNum, product_name: productName, category }),
    });
    document.getElementById('newColumnNum').value   = '';
    document.getElementById('newProductName').value = '';
    document.getElementById('newCategory').value    = '';
    await loadColumnMappings(selectedMachineId);
  } finally {
    btn.disabled = false;
  }
}

async function deleteColumnMapping(id) {
  try {
    await fetch(`${API_BASE}/machines/columns.php?id=${id}`, { method: 'DELETE' });
    await loadColumnMappings(selectedMachineId);
  } catch {}
}

function initMachineDetail() {
  document.getElementById('closeDetail').addEventListener('click', () => {
    document.getElementById('machineDetail').classList.add('hidden');
    document.querySelectorAll('.machine-row').forEach(r => r.classList.remove('selected'));
    selectedMachineId = '';
  });

  document.getElementById('addMappingBtn').addEventListener('click', addColumnMapping);

  document.getElementById('newColumnNum').addEventListener('keydown',   e => { if (e.key === 'Enter') addColumnMapping(); });
  document.getElementById('newProductName').addEventListener('keydown', e => { if (e.key === 'Enter') addColumnMapping(); });
}

function showQrModal(machineId, location) {
  const url = `http://atlasvendingoperations.com/feedback/?machine=${encodeURIComponent(machineId)}&location=${encodeURIComponent(location)}`;
  const qrApiUrl     = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;

  document.getElementById('qrModalTitle').textContent = `QR Code — ${machineId}`;
  document.getElementById('qrModalImg').src           = qrApiUrl;
  document.getElementById('qrModalUrl').textContent   = url;
  document.getElementById('qrModalDownload').href     = qrApiUrl;
  document.getElementById('qrModal').classList.remove('hidden');
}

function initQrModal() {
  document.getElementById('qrModalClose').addEventListener('click',   () => document.getElementById('qrModal').classList.add('hidden'));
  document.getElementById('qrBackdrop').addEventListener('click',     () => document.getElementById('qrModal').classList.add('hidden'));
}

async function deleteFeedback(id) {
  if (!confirm('Delete this review?')) return;

  try {
    const res = await fetch(`${API_BASE}/feedback/delete.php?id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    document.getElementById(`feedback-row-${id}`)?.remove();
    showToast('Review deleted');
  } catch {
    showToast('Failed to delete review');
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg) {
  let t = document.getElementById('_toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function initNav() {
  const links   = document.querySelectorAll('.sidebar__link');
  const sections = document.querySelectorAll('.section');

  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = link.dataset.section;

      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      sections.forEach(s => s.classList.toggle('hidden', !s.id.endsWith(target)));

      if (target === 'machines') loadMachines();
    });
  });
}

function initPeriodToggle() {
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      loadTrend(currentPeriod);
    });
  });
}

document.getElementById('refreshFeedback').addEventListener('click', () => {
  loadFeedback();
  showToast('Feedback refreshed');
});

async function init() {
  initNav();
  initPeriodToggle();
  initQrModal();
  initMachineDetail();
  await loadMachinesFromApi();
  await Promise.all([loadSummary(), loadTrend(currentPeriod), loadFeedback(), loadAnalyticsStats(), loadLatestSale()]);

  setInterval(() => {
    loadFeedback();
    loadTrend(currentPeriod);
  }, 60_000);
}

init();
