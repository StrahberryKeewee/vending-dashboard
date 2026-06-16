const API_BASE = '/api';

let donutChart        = null;
let trendChart        = null;
let machineHourChart  = null;
let machineDowChart   = null;
let currentPeriod     = 'weekly';
let currentMachine    = '';
let allMachines       = [];

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
    data = { total_ytd: 0, growth_percent: 0, categories: [] };
  }

  document.getElementById('ytdAmount').textContent = formatCurrency(data.total_ytd);

  const growthEl = document.getElementById('ytdGrowth');
  const sign = data.growth_percent >= 0 ? '+' : '';
  growthEl.textContent = `${sign}${data.growth_percent}%`;
  growthEl.style.color = data.growth_percent >= 0 ? '#22c55e' : '#ef4444';

  const legendEl = document.getElementById('donutLegend');
  const ctx = document.getElementById('donutChart').getContext('2d');
  if (donutChart) donutChart.destroy();

  const cats = (data.categories ?? []).filter(c => c.revenue > 0);

  if (cats.length) {
    legendEl.innerHTML = cats.map(c => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${c.color}"></span>
        <span>${c.label}</span>
        <strong>${c.percent}%</strong>
      </div>
    `).join('');

    donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: cats.map(c => c.label),
        datasets: [{
          data:            cats.map(c => c.revenue),
          backgroundColor: cats.map(c => c.color),
          borderWidth:     3,
          borderColor:     '#ffffff',
          hoverOffset:     6,
        }],
      },
      options: {
        cutout: '68%',
        plugins: { legend: { display: false }, tooltip: {
          callbacks: {
            label: c => ` ${c.label}: ${formatCurrency(c.raw)} (${cats[c.dataIndex].percent}%)`,
          },
        }},
        animation: { animateRotate: true, duration: 800 },
      },
    });
  } else {
    legendEl.innerHTML = `
      <div class="legend-item" style="grid-column:1/-1;color:var(--text-muted);font-style:italic;font-size:.78rem;">
        Map columns to products to see category breakdown
      </div>`;

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
            label: () => ` ${formatCurrency(data.total_ytd)}`,
          },
        }},
        animation: { animateRotate: true, duration: 800 },
      },
    });
  }
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
  await Promise.all([loadColumnMappings(machineId), loadRecentSales(machineId), loadMachineAnalytics(machineId), loadInventory(machineId)]);

  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadRecentSales(machineId) {
  const tbody = document.getElementById('recentSalesBody');
  tbody.innerHTML = '<tr class="table-loading"><td colspan="5">Loading...</td></tr>';

  let data;
  try {
    data = await apiFetch(`/sales/recent.php?machine_id=${encodeURIComponent(machineId)}`);
  } catch {
    tbody.innerHTML = '<tr class="table-loading"><td colspan="5">Failed to load.</td></tr>';
    return;
  }

  const sales = data.sales ?? [];
  if (!sales.length) {
    tbody.innerHTML = '<tr class="table-loading"><td colspan="5">No sales yet.</td></tr>';
    return;
  }

  tbody.innerHTML = sales.map(s => {
    const d    = new Date(s.sale_time);
    const time = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
               + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `<tr>
      <td style="white-space:nowrap">${escHtml(time)}</td>
      <td>${s.vend_column ? escHtml(s.vend_column) : '<span style="color:var(--text-muted)">--</span>'}</td>
      <td>${s.product_name ? escHtml(s.product_name) : '<span style="color:var(--text-muted)">--</span>'}</td>
      <td>${formatCurrency(s.amount)}</td>
      <td>
        <button class="btn-delete" onclick="deleteSale(${s.id})" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

async function deleteSale(id) {
  if (!confirm('Delete this sale record? This cannot be undone.')) return;
  try {
    await fetch(`${API_BASE}/sales/delete.php?id=${id}`, { method: 'DELETE' });
    await loadRecentSales(selectedMachineId);
  } catch {}
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

// ── Inventory ─────────────────────────────────────────────────────────────────

let inventoryData    = [];
let inventoryCountMode = false;

async function loadInventory(machineId) {
  const tbody = document.getElementById('inventoryTbody');
  tbody.innerHTML = '<tr class="table-loading"><td colspan="6">Loading...</td></tr>';

  let data;
  try {
    data = await apiFetch(`/inventory/list.php?machine_id=${encodeURIComponent(machineId)}`);
  } catch {
    tbody.innerHTML = '<tr class="table-loading"><td colspan="6">Failed to load.</td></tr>';
    return;
  }

  inventoryData = data.inventory ?? [];
  inventoryCountMode = false;
  renderInventoryTable();
  renderInventorySummary();
}

function renderInventorySummary() {
  const el      = document.getElementById('inventorySummary');
  const total   = inventoryData.reduce((s, r) => s + (parseInt(r.current_qty) || 0), 0);
  const empty   = inventoryData.filter(r => parseInt(r.current_qty) === 0).length;
  const inStock = inventoryData.length - empty;

  el.innerHTML = `
    <div class="inv-summary-item"><span class="inv-dot inv-dot--ok"></span>${inStock} slot${inStock !== 1 ? 's' : ''} in stock</div>
    ${empty > 0 ? `<div class="inv-summary-item"><span class="inv-dot inv-dot--empty"></span>${empty} empty</div>` : ''}
    <div class="inv-summary-item" style="color:var(--text-muted)">${total} total items</div>
  `;
}

function renderInventoryTable() {
  const tbody = document.getElementById('inventoryTbody');

  if (!inventoryData.length) {
    tbody.innerHTML = '<tr class="table-loading"><td colspan="6">No mapped columns yet — add mappings first.</td></tr>';
    return;
  }

  tbody.innerHTML = inventoryData.map(row => {
    const qty     = parseInt(row.current_qty) || 0;
    const isEmpty = qty === 0;
    const updated = row.updated_at
      ? new Date(row.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '—';

    const qtyCell = inventoryCountMode
      ? `<input class="inv-qty-input" type="number" min="0" data-col="${escHtml(row.column_num)}" value="${qty}" />`
      : `<div class="inv-qty">
           <span class="inv-qty-value${isEmpty ? ' empty' : ''}">${qty}</span>
           <button class="btn-inv-adj" onclick="quickAdjust('${escHtml(row.column_num)}', -1)" ${qty === 0 ? 'disabled' : ''}>−</button>
           <button class="btn-inv-adj" onclick="quickAdjust('${escHtml(row.column_num)}', 1)">+</button>
         </div>`;

    return `<tr>
      <td><strong>${escHtml(row.column_num)}</strong></td>
      <td>${escHtml(row.product_name)}</td>
      <td><span class="item-tag" style="background:${CAT_COLORS[row.category] ?? '#e5e7eb'}22;color:${CAT_COLORS[row.category] ?? '#6b7280'}">${escHtml(row.category ?? '')}</span></td>
      <td>${qtyCell}</td>
      <td style="color:var(--text-muted);font-size:.78rem">${updated}</td>
      <td></td>
    </tr>`;
  }).join('');
}

async function quickAdjust(columnNum, delta) {
  const row = inventoryData.find(r => r.column_num === columnNum);
  if (!row) return;
  const newQty = Math.max(0, (parseInt(row.current_qty) || 0) + delta);
  try {
    await fetch(`${API_BASE}/inventory/adjust.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machine_id: selectedMachineId, column_num: columnNum, qty: newQty }),
    });
    row.current_qty = newQty;
    row.updated_at  = new Date().toISOString();
    renderInventoryTable();
    renderInventorySummary();
  } catch {}
}

function startCountMode() {
  inventoryCountMode = true;
  renderInventoryTable();
  document.getElementById('recordCountBtn').classList.add('hidden');
  document.getElementById('cancelCountBtn').classList.remove('hidden');
  document.getElementById('inventoryCountFooter').classList.remove('hidden');
}

function cancelCountMode() {
  inventoryCountMode = false;
  renderInventoryTable();
  document.getElementById('recordCountBtn').classList.remove('hidden');
  document.getElementById('cancelCountBtn').classList.add('hidden');
  document.getElementById('inventoryCountFooter').classList.add('hidden');
}

async function saveCount() {
  const inputs = document.querySelectorAll('.inv-qty-input');
  const counts = Array.from(inputs).map(inp => ({
    column_num: inp.dataset.col,
    qty: Math.max(0, parseInt(inp.value) || 0),
  }));

  try {
    await fetch(`${API_BASE}/inventory/adjust.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machine_id: selectedMachineId, counts, note: 'Manual inventory count' }),
    });
    await loadInventory(selectedMachineId);
    cancelCountMode();
    showToast('Inventory count saved');
  } catch {
    showToast('Failed to save count');
  }
}

function initInventory() {
  document.getElementById('inventoryToggle').addEventListener('click', e => {
    if (e.target.closest('.inventory-header-actions button:not(.btn-collapse)')) return;
    const body = document.getElementById('inventoryCollapse');
    const btn  = document.getElementById('inventoryCollapseBtn');
    const open = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', open);
    btn.setAttribute('aria-expanded', String(!open));
    btn.title = open ? 'Expand' : 'Collapse';
  });

  document.getElementById('recordCountBtn').addEventListener('click', e => { e.stopPropagation(); startCountMode(); });
  document.getElementById('cancelCountBtn').addEventListener('click',  e => { e.stopPropagation(); cancelCountMode(); });
  document.getElementById('saveCountBtn').addEventListener('click',    saveCount);
}

const CAT_COLORS = {
  'Snack':           '#ef4444',
  'Beverage':        '#f59e0b',
  'Health Products': '#3b82f6',
  'School Supplies': '#22c55e',
};

async function loadMachineAnalytics(machineId) {
  let data;
  try {
    data = await apiFetch(`/sales/machine_stats.php?machine_id=${encodeURIComponent(machineId)}`);
  } catch {
    return;
  }

  // ── Period comparison cards ─────────────────────────────────────────────────
  const setChange = (elId, pct) => {
    const el = document.getElementById(elId);
    if (pct === null) { el.textContent = 'No prior period data'; el.className = 'stat-card__change flat'; return; }
    const sign = pct >= 0 ? '+' : '';
    el.textContent = `${sign}${pct}% vs prior period`;
    el.className   = `stat-card__change ${pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'}`;
  };

  const setTxns = (elId, txns) => {
    const el = document.getElementById(elId);
    el.textContent = `${txns} transaction${txns !== 1 ? 's' : ''}`;
    el.className   = 'stat-card__change flat';
  };

  const w = data.period_compare.week;
  const m = data.period_compare.month;

  document.getElementById('mStatWeekRev').textContent      = formatCurrency(w.current);
  document.getElementById('mStatLastWeekRev').textContent  = formatCurrency(w.previous);
  document.getElementById('mStatMonthRev').textContent     = formatCurrency(m.current);
  document.getElementById('mStatLastMonthRev').textContent = formatCurrency(m.previous);
  setChange('mStatWeekChange',  w.change_pct);
  setChange('mStatMonthChange', m.change_pct);
  setTxns('mStatWeekTxns',  w.txns_previous);   // subtext under Last Week card
  setTxns('mStatMonthTxns', m.txns_previous);   // subtext under Last Month card

  // ── Hour of day bar chart ───────────────────────────────────────────────────
  const hourLabels = Array.from({ length: 24 }, (_, h) => {
    if (h === 0)  return '12a';
    if (h < 12)   return h + 'a';
    if (h === 12) return '12p';
    return (h - 12) + 'p';
  });

  const hourRevenue = data.by_hour.map(h => h.revenue);
  const peakHour    = data.by_hour.reduce((a, b) => b.revenue > a.revenue ? b : a, data.by_hour[0]);

  if (machineHourChart) machineHourChart.destroy();
  machineHourChart = new Chart(
    document.getElementById('machineHourChart').getContext('2d'),
    {
      type: 'bar',
      data: {
        labels: hourLabels,
        datasets: [{
          data:            hourRevenue,
          backgroundColor: hourRevenue.map((_, i) =>
            i === peakHour.hour ? '#2d6af4' : 'rgba(45,106,244,.25)'
          ),
          borderRadius:    3,
          borderSkipped:   false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${formatCurrency(c.raw)}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 9 }, maxRotation: 0 } },
          y: {
            grid: { color: '#f0f2f8' },
            ticks: { color: '#9ca3af', font: { size: 10 }, callback: v => '$' + v.toFixed(0) },
            beginAtZero: true,
          },
        },
      },
    }
  );

  // ── Day of week bar chart ───────────────────────────────────────────────────
  const dowRevenue = data.by_dow.map(d => d.revenue);
  const peakDow    = data.by_dow.reduce((a, b) => b.revenue > a.revenue ? b : a, data.by_dow[0]);

  if (machineDowChart) machineDowChart.destroy();
  machineDowChart = new Chart(
    document.getElementById('machineDowChart').getContext('2d'),
    {
      type: 'bar',
      data: {
        labels: data.by_dow.map(d => d.label),
        datasets: [{
          data:            dowRevenue,
          backgroundColor: dowRevenue.map((_, i) =>
            i === peakDow.dow - 1 ? '#22c55e' : 'rgba(34,197,94,.25)'
          ),
          borderRadius:    3,
          borderSkipped:   false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${formatCurrency(c.raw)}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
          y: {
            grid: { color: '#f0f2f8' },
            ticks: { color: '#9ca3af', font: { size: 10 }, callback: v => '$' + v.toFixed(0) },
            beginAtZero: true,
          },
        },
      },
    }
  );

  // ── Top sellers table ───────────────────────────────────────────────────────
  const tbody = document.getElementById('topSellersBody');
  if (!data.top_sellers.length) {
    tbody.innerHTML = '<tr class="table-loading"><td colspan="5">No mapped sales yet</td></tr>';
  } else {
    tbody.innerHTML = data.top_sellers.map((s, i) => `
      <tr>
        <td><strong>${i + 1}</strong></td>
        <td>${escHtml(s.product_name)}</td>
        <td>
          <span class="item-tag" style="background:${CAT_COLORS[s.category] ?? '#e5e7eb'}22;color:${CAT_COLORS[s.category] ?? '#6b7280'}">
            ${escHtml(s.category ?? '')}
          </span>
        </td>
        <td>${s.quantity}</td>
        <td>${formatCurrency(s.revenue)}</td>
      </tr>
    `).join('');
  }

  // ── Slow movers ─────────────────────────────────────────────────────────────
  const deadList  = document.getElementById('deadStockList');
  const deadBadge = document.getElementById('deadStockBadge');

  if (!data.dead_stock.length) {
    deadBadge.classList.add('hidden');
    deadList.innerHTML = '<div class="dead-stock-none">✓ All mapped items have recent sales</div>';
  } else {
    deadBadge.textContent = data.dead_stock.length;
    deadBadge.classList.remove('hidden');
    deadList.innerHTML = `<div class="dead-stock-list">${
      data.dead_stock.map(d => `
        <div class="dead-stock-chip">
          <span class="dead-stock-chip__col">Col ${escHtml(d.column_num)}</span>
          <span class="dead-stock-chip__name">${escHtml(d.product_name)}</span>
          <span class="dead-stock-chip__days">${
            d.days_since === null ? 'Never sold' : `${d.days_since}d ago`
          }</span>
        </div>
      `).join('')
    }</div>`;
  }
}

function initMachineDetail() {
  // Close / X button — hide panel, deselect row, reset table contents
  document.getElementById('closeDetail').addEventListener('click', () => {
    document.getElementById('machineDetail').classList.add('hidden');
    document.querySelectorAll('.machine-row').forEach(r => r.classList.remove('selected'));
    selectedMachineId = '';
    document.getElementById('detailMachineTitle').textContent = 'Machine Detail';
    document.getElementById('columnsBody').innerHTML     = '<tr class="table-loading"><td colspan="4">Select a machine above</td></tr>';
    document.getElementById('recentSalesBody').innerHTML = '<tr class="table-loading"><td colspan="5">Select a machine above</td></tr>';
    document.getElementById('topSellersBody').innerHTML  = '<tr class="table-loading"><td colspan="5">Select a machine above</td></tr>';
    document.getElementById('deadStockList').innerHTML   = '';
    document.getElementById('deadStockBadge').classList.add('hidden');
    // Reset period cards
    ['mStatWeekRev','mStatLastWeekRev','mStatMonthRev','mStatLastMonthRev'].forEach(id => {
      document.getElementById(id).textContent = '--';
    });
    ['mStatWeekChange','mStatWeekTxns','mStatMonthChange','mStatMonthTxns'].forEach(id => {
      const el = document.getElementById(id);
      el.textContent = '';
      el.className   = 'stat-card__change';
    });
    // Destroy machine charts
    if (machineHourChart) { machineHourChart.destroy(); machineHourChart = null; }
    if (machineDowChart)  { machineDowChart.destroy();  machineDowChart  = null; }
    // Reset inventory
    inventoryData = [];
    inventoryCountMode = false;
    document.getElementById('inventoryTbody').innerHTML = '<tr class="table-loading"><td colspan="6">Select a machine above</td></tr>';
    document.getElementById('inventorySummary').innerHTML = '';
    cancelCountMode();

    // Re-collapse all collapsible sections
    [
      ['columnMappingBody', 'columnMappingBtn'],
      ['recentSalesBody_wrap', 'recentSalesBtn'],
      ['inventoryCollapse', 'inventoryCollapseBtn'],
    ].forEach(([bodyId, btnId]) => {
      document.getElementById(bodyId).classList.add('collapsed');
      const btn = document.getElementById(btnId);
      btn.setAttribute('aria-expanded', 'false');
      btn.title = 'Expand';
    });
  });

  // Column mapping collapse toggle
  document.getElementById('columnMappingToggle').addEventListener('click', () => {
    const body = document.getElementById('columnMappingBody');
    const btn  = document.getElementById('columnMappingBtn');
    const open = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', open);
    btn.setAttribute('aria-expanded', String(!open));
    btn.title = open ? 'Expand' : 'Collapse';
  });

  // Recent sales collapse toggle
  document.getElementById('recentSalesToggle').addEventListener('click', () => {
    const body = document.getElementById('recentSalesBody_wrap');
    const btn  = document.getElementById('recentSalesBtn');
    const open = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', open);
    btn.setAttribute('aria-expanded', String(!open));
    btn.title = open ? 'Expand' : 'Collapse';
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
  initInventory();
  await loadMachinesFromApi();
  await Promise.all([loadSummary(), loadTrend(currentPeriod), loadFeedback(), loadAnalyticsStats(), loadLatestSale()]);

  setInterval(() => {
    loadFeedback();
    loadTrend(currentPeriod);
  }, 60_000);
}

init();
