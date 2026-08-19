const API_BASE = '/api';

let donutChart        = null;
let trendChart        = null;
let machineHourChart  = null;
let machineDowChart   = null;
let currentPeriod     = 'weekly';
let currentMachine    = '';
let allMachines       = [];

let profitMode        = false;
let cachedSummary     = null;
let cachedTrend       = null;

function setProfitMode(enabled) {
  profitMode = enabled;
  document.getElementById('revProfitRevBtn').classList.toggle('active', !enabled);
  document.getElementById('revProfitProfBtn').classList.toggle('active', enabled);

  // Show/hide profit column in recent sales table
  const profHdr = document.getElementById('recentSalesProfitHeader');
  if (profHdr) profHdr.style.display = enabled ? '' : 'none';
  document.querySelectorAll('.recent-sales-profit-cell').forEach(el => {
    el.style.display = enabled ? '' : 'none';
  });

  if (cachedSummary) renderSummary();
  if (cachedTrend)   renderTrend();
  renderCalendar();
}

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
    data = { total_ytd: 0, profit_ytd: 0, growth_percent: 0, categories: [] };
  }
  cachedSummary = data;
  renderSummary();
}

function renderSummary() {
  const data = cachedSummary;
  if (!data) return;

  const ytd = profitMode ? (data.profit_ytd ?? 0) : data.total_ytd;
  document.getElementById('ytdAmount').textContent = formatCurrency(ytd);
  document.getElementById('donutCenter').querySelector('.donut-center__label').textContent =
    profitMode ? 'Total Profit YTD' : 'Total YTD';

  const growthEl = document.getElementById('ytdGrowth');
  const sign = data.growth_percent >= 0 ? '+' : '';
  growthEl.textContent = `${sign}${data.growth_percent}%`;
  growthEl.style.color = data.growth_percent >= 0 ? '#22c55e' : '#ef4444';

  const legendEl = document.getElementById('donutLegend');
  const ctx = document.getElementById('donutChart').getContext('2d');
  if (donutChart) donutChart.destroy();

  const valueKey = profitMode ? 'profit' : 'revenue';
  const cats = (data.categories ?? []).filter(c => (c[valueKey] ?? 0) > 0);
  const catTotal = cats.reduce((s, c) => s + (c[valueKey] ?? 0), 0);

  if (cats.length) {
    legendEl.innerHTML = cats.map(c => {
      const val = c[valueKey] ?? 0;
      const pct = catTotal > 0 ? (val / catTotal * 100).toFixed(1) : '0.0';
      return `
        <div class="legend-item">
          <span class="legend-dot" style="background:${c.color}"></span>
          <span>${c.label}</span>
          <strong>${pct}%</strong>
        </div>`;
    }).join('');

    donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: cats.map(c => c.label),
        datasets: [{
          data:            cats.map(c => c[valueKey] ?? 0),
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
            label: c => {
              const val = c.raw;
              const pct = catTotal > 0 ? (val / catTotal * 100).toFixed(1) : '0.0';
              return ` ${c.label}: ${formatCurrency(val)} (${pct}%)`;
            },
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
          data:            [ytd || 1],
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
            label: () => ` ${formatCurrency(ytd)}`,
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
      daily:   { labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], data: [620,740,590,810,930,470,380],  profit: [430,510,410,560,645,325,265] },
      weekly:  { labels: ['Week 1','Week 2','Week 3','Week 4'],       data: [3100,3300,3700,4500],          profit: [2145,2285,2565,3115] },
      monthly: { labels: ['Jan','Feb','Mar','Apr'],                   data: [18200,19400,21500,23800],      profit: [12600,13430,14880,16480] },
    };
    data = defaults[period] ?? defaults.weekly;
    data.period = period;
  }
  cachedTrend = data;
  renderTrend();
}

function renderTrend() {
  const data = cachedTrend;
  if (!data) return;

  const revLabel   = { daily: 'Daily Revenue Trend', weekly: 'Weekly Revenue Trend', monthly: 'Monthly Revenue Trend' };
  const profLabel  = { daily: 'Daily Profit Trend',  weekly: 'Weekly Profit Trend',  monthly: 'Monthly Profit Trend'  };
  const titles     = profitMode ? profLabel : revLabel;
  document.getElementById('trendTitle').textContent = titles[data.period] ?? (profitMode ? 'Profit Trend' : 'Revenue Trend');

  const values = profitMode ? (data.profit ?? data.data) : data.data;

  const ctx = document.getElementById('trendChart').getContext('2d');
  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{
        data:            values,
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

let selectedMachineId      = '';
let selectedMachineHasData = false;

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
  selectedMachineId      = machineId;
  selectedMachineHasData = !!(allMachines.find(m => m.machine_id === machineId)?.has_data);

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

  const profHdr = document.getElementById('recentSalesProfitHeader');
  if (profHdr) profHdr.style.display = profitMode ? '' : 'none';

  tbody.innerHTML = sales.map(s => {
    const d    = new Date(s.sale_time);
    const time = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
               + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const profitCell = `<td class="recent-sales-profit-cell" style="display:${profitMode ? '' : 'none'}">${
      s.profit != null ? formatCurrency(s.profit) : '<span style="color:var(--text-muted)">—</span>'
    }</td>`;
    return `<tr>
      <td style="white-space:nowrap">${escHtml(time)}</td>
      <td>${s.vend_column ? escHtml(s.vend_column) : '<span style="color:var(--text-muted)">--</span>'}</td>
      <td>${s.product_name ? escHtml(s.product_name) : '<span style="color:var(--text-muted)">--</span>'}</td>
      <td>${formatCurrency(s.amount)}</td>
      ${profitCell}
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
      <td><span class="item-tag" style="background:${CAT_COLORS[c.category] ?? '#e5e7eb'}22;color:${CAT_COLORS[c.category] ?? '#6b7280'}">${escHtml(c.category ?? '')}</span></td>
      <td>
        <input class="cap-inline-input" type="number" min="1" max="999"
          value="${c.capacity ?? ''}" placeholder="—"
          data-col-id="${c.id}" data-machine="${escHtml(selectedMachineId)}"
          data-col-num="${escHtml(c.column_num)}" data-product="${escHtml(c.product_name)}"
          data-category="${escHtml(c.category ?? '')}"
          onblur="saveCapacityInline(this)" onkeydown="if(event.key==='Enter')this.blur()" />
      </td>
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
  const capVal      = document.getElementById('newCapacity').value.trim();
  const capacity    = capVal !== '' ? parseInt(capVal) || null : null;
  const btn         = document.getElementById('addMappingBtn');

  if (!colNum || !productName || !category || !selectedMachineId) return;

  btn.disabled = true;
  try {
    await fetch(`${API_BASE}/machines/columns.php`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ machine_id: selectedMachineId, column_num: colNum, product_name: productName, category, capacity }),
    });
    document.getElementById('newColumnNum').value   = '';
    document.getElementById('newProductName').value = '';
    document.getElementById('newCategory').value    = '';
    document.getElementById('newCapacity').value    = '';
    await loadColumnMappings(selectedMachineId);
    await loadInventory(selectedMachineId);
  } finally {
    btn.disabled = false;
  }
}

async function deleteColumnMapping(id) {
  try {
    await fetch(`${API_BASE}/machines/columns.php?id=${id}`, { method: 'DELETE' });
    await loadColumnMappings(selectedMachineId);
    await loadInventory(selectedMachineId);
  } catch {}
}

async function saveCapacityInline(input) {
  const capVal  = input.value.trim();
  const capacity = capVal !== '' ? parseInt(capVal) || null : null;
  try {
    await fetch(`${API_BASE}/machines/columns.php`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        machine_id:   input.dataset.machine,
        column_num:   input.dataset.colNum,
        product_name: input.dataset.product,
        category:     input.dataset.category,
        capacity,
      }),
    });
    await loadInventory(selectedMachineId);
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
  const el = document.getElementById('inventorySummary');

  const needRestock = inventoryData.filter(r => {
    if (!r.updated_at) return false;
    const qty = parseInt(r.current_qty) || 0;
    const cap = r.capacity != null ? parseInt(r.capacity) : null;
    return qty === 0 || (cap !== null && qty / cap < 0.3);
  });
  const unknown = inventoryData.filter(r => !r.updated_at);

  const latestDate = inventoryData.reduce((best, r) => {
    if (!r.updated_at) return best;
    const d = new Date(r.updated_at.replace(' ', 'T') + 'Z');
    return (!best || d > best) ? d : best;
  }, null);

  let lastCountText;
  if (latestDate) {
    const days = Math.floor((Date.now() - latestDate) / 86400000);
    lastCountText = days === 0 ? 'Last count: today' : days === 1 ? 'Last count: yesterday' : `Last count: ${days} days ago`;
  } else {
    lastCountText = 'Never counted — use Record Count to set initial quantities';
  }

  const restockList = needRestock.length > 0
    ? `<div class="inv-restock-list">${needRestock.map(r => {
        const qty = parseInt(r.current_qty) || 0;
        const cap = r.capacity != null ? parseInt(r.capacity) : null;
        const need = cap !== null ? cap - qty : null;
        const needStr = need !== null ? `bring ${need}` : 'empty';
        return `<div class="inv-restock-item"><span class="inv-restock-name">${escHtml(r.product_name)}</span><span class="inv-restock-need">${needStr}</span></div>`;
      }).join('')}</div>`
    : '';

  const parts = [];
  if (needRestock.length > 0) parts.push(`<div class="inv-summary-item" style="color:#ef4444"><span class="inv-dot" style="background:#ef4444"></span>${needRestock.length} need restocking</div>`);
  if (unknown.length > 0)     parts.push(`<div class="inv-summary-item" style="color:#9ca3af"><span class="inv-dot" style="background:#9ca3af"></span>${unknown.length} uncounted</div>`);
  if (needRestock.length === 0 && unknown.length === 0 && inventoryData.length > 0)
    parts.push(`<div class="inv-summary-item" style="color:#22c55e"><span class="inv-dot inv-dot--ok"></span>All slots stocked</div>`);

  el.innerHTML = `
    <div class="inv-summary-row">${parts.join('')}<div class="inv-summary-item" style="color:var(--text-muted)">${lastCountText}</div></div>
    ${restockList}
  `;
}

function renderInventoryTable() {
  const tbody = document.getElementById('inventoryTbody');

  if (!inventoryData.length) {
    tbody.innerHTML = '<tr class="table-loading"><td colspan="6">No mapped columns yet — add mappings first.</td></tr>';
    return;
  }

  tbody.innerHTML = inventoryData.map(row => {
    const qty         = parseInt(row.current_qty) || 0;
    const cap         = row.capacity != null ? parseInt(row.capacity) : null;
    const neverCounted = !row.updated_at;

    // Status dot
    let dotClass, dotTitle;
    if (neverCounted) {
      dotClass = 'inv-status-dot--unknown'; dotTitle = 'Never counted';
    } else if (qty === 0) {
      dotClass = 'inv-status-dot--empty';   dotTitle = 'Empty';
    } else if (cap !== null && qty / cap < 0.3) {
      dotClass = 'inv-status-dot--low';     dotTitle = 'Low';
    } else {
      dotClass = 'inv-status-dot--ok';      dotTitle = 'OK';
    }

    // Qty / Cap cell
    let qtyCell;
    if (inventoryCountMode) {
      qtyCell = `<input class="inv-qty-input" type="number" min="0" data-col="${escHtml(row.column_num)}" value="${neverCounted ? '' : qty}" placeholder="${neverCounted ? '?' : ''}" />`;
    } else {
      const qtyStr  = neverCounted ? '—' : String(qty);
      const capStr  = cap !== null ? `<span class="inv-cap-frac"> / ${cap}</span>` : '';
      const isEmpty = !neverCounted && qty === 0;
      qtyCell = `<div class="inv-qty">
        <span class="inv-status-dot ${dotClass}" title="${dotTitle}"></span>
        <span class="inv-qty-value${isEmpty ? ' empty' : ''}">${qtyStr}${capStr}</span>
      </div>`;
    }

    // To Bring
    let toBring;
    if (cap === null) {
      toBring = '<span style="color:var(--text-muted)">—</span>';
    } else if (neverCounted) {
      toBring = `<span class="inv-to-bring inv-to-bring--unknown">up to ${cap}</span>`;
    } else {
      const need = cap - qty;
      toBring = need > 0
        ? `<span class="inv-to-bring">${need}</span>`
        : `<span style="color:#22c55e;font-weight:600">✓</span>`;
    }

    // Last Counted
    let lastCounted;
    if (!row.updated_at) {
      lastCounted = '<span style="color:#9ca3af">Never</span>';
    } else {
      const days = Math.floor((Date.now() - new Date(row.updated_at.replace(' ', 'T') + 'Z')) / 86400000);
      lastCounted = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`;
    }

    return `<tr>
      <td><strong>${escHtml(row.column_num)}</strong></td>
      <td>${escHtml(row.product_name)}</td>
      <td><span class="item-tag" style="background:${CAT_COLORS[row.category] ?? '#e5e7eb'}22;color:${CAT_COLORS[row.category] ?? '#6b7280'}">${escHtml(row.category ?? '')}</span></td>
      <td>${qtyCell}</td>
      <td>${toBring}</td>
      <td style="color:var(--text-muted);font-size:.78rem">${lastCounted}</td>
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
    const res = await fetch(`${API_BASE}/inventory/adjust.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machine_id: selectedMachineId, counts, note: 'Manual inventory count' }),
    });
    if (!res.ok) throw new Error(`Save failed (${res.status})`);
    await loadInventory(selectedMachineId);
    cancelCountMode();
    showToast('Inventory count saved');
  } catch (err) {
    showToast('Failed to save count');
    console.error('[saveCount]', err);
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
    selectedMachineId      = '';
    selectedMachineHasData = false;
    document.getElementById('detailMachineTitle').textContent = 'Machine Detail';
    document.getElementById('columnsBody').innerHTML     = '<tr class="table-loading"><td colspan="5">Select a machine above</td></tr>';
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

  // Analytics collapse toggle
  document.getElementById('analyticsToggle').addEventListener('click', () => {
    const body = document.getElementById('analyticsCollapse');
    const btn  = document.getElementById('analyticsCollapseBtn');
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
      if (target === 'items')    loadItemStats();
      if (target === 'calendar') initCalendar();
      if (target === 'profit')   loadProfitAnalysis();
    });
  });
}

// ── Profit Analysis ───────────────────────────────────────────────────────────

let profitAnalysisLoaded = false;

let profitMachineId = '';
let profitItems     = [];

async function loadProfitAnalysis() {
  const params = profitMachineId ? `?machine_id=${encodeURIComponent(profitMachineId)}` : '';
  let data;
  try {
    data = await apiFetch(`/sales/item_stats.php${params}`);
  } catch { return; }
  profitItems = data.items ?? [];
  renderProfitAnalysis();
}

function initProfitMachineSelect() {
  const sel = document.getElementById('profitMachineSelect');
  // Populate from already-loaded machine list
  document.querySelectorAll('#machineSelect option').forEach(opt => {
    if (opt.value) sel.appendChild(opt.cloneNode(true));
  });
  sel.addEventListener('change', () => {
    profitMachineId = sel.value;
    loadProfitAnalysis();
  });
}

function renderProfitAnalysis() {
  const priced = profitItems.filter(i => i.profit_margin_pct != null);

  // ── Summary strip ──────────────────────────────────────────────────────
  const totalRev    = profitItems.reduce((s, i) => s + (i.total_revenue ?? 0), 0);
  const totalProfit = priced.reduce((s, i) => s + (i.total_profit ?? 0), 0);
  const overallMargin = totalRev > 0 ? (totalProfit / totalRev * 100).toFixed(1) : null;
  document.getElementById('profitSumRevenue').textContent = formatCurrency(totalRev);
  document.getElementById('profitSumProfit').textContent  = formatCurrency(totalProfit);
  document.getElementById('profitSumMargin').textContent  = overallMargin != null ? `${overallMargin}%` : '—';
  document.getElementById('profitSumItems').textContent   = `${priced.length} / ${profitItems.length}`;

  // ── Top 5 by margin % ──────────────────────────────────────────────────
  const topMargin = [...priced].sort((a, b) => b.profit_margin_pct - a.profit_margin_pct).slice(0, 5);
  document.getElementById('profitTopMarginBody').innerHTML = topMargin.length
    ? topMargin.map(i => profitRankRow(i, 'margin')).join('')
    : '<tr><td colspan="4" class="table-loading">No data</td></tr>';

  // ── Top 5 by total profit ───────────────────────────────────────────────
  const topTotal = [...priced].sort((a, b) => b.total_profit - a.total_profit).slice(0, 5);
  document.getElementById('profitTopTotalBody').innerHTML = topTotal.length
    ? topTotal.map(i => profitRankRow(i, 'total')).join('')
    : '<tr><td colspan="4" class="table-loading">No data</td></tr>';

  // ── Bottom 5 by margin % ───────────────────────────────────────────────
  const botMargin = [...priced].sort((a, b) => a.profit_margin_pct - b.profit_margin_pct).slice(0, 5);
  document.getElementById('profitBotMarginBody').innerHTML = botMargin.length
    ? botMargin.map(i => profitRankRow(i, 'margin')).join('')
    : '<tr><td colspan="4" class="table-loading">No data</td></tr>';

  // ── Profit by category ─────────────────────────────────────────────────
  const catMap = {};
  profitItems.forEach(i => {
    const cat = i.category ?? 'Other';
    catMap[cat] = (catMap[cat] ?? 0) + i.total_profit;
  });
  const catEntries = Object.entries(catMap).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const maxCat = catEntries[0]?.[1] ?? 1;
  document.getElementById('profitCategoryBars').innerHTML = catEntries.map(([cat, profit]) => {
    const color = CAT_COLORS[cat] ?? '#6b7280';
    const pct   = Math.round(profit / maxCat * 100);
    return `<div class="profit-cat-row">
      <span class="profit-cat-label">${escHtml(cat)}</span>
      <div class="profit-cat-bar-wrap">
        <div class="profit-cat-bar" style="width:${pct}%;background:${color}"></div>
      </div>
      <span class="profit-cat-value">${formatCurrency(profit)}</span>
    </div>`;
  }).join('') || '<p style="color:var(--text-muted);padding:16px">No profit data yet</p>';

  // ── Top 5 by profit per unit sold ─────────────────────────────────────
  const perUnit = priced
    .filter(i => i.total_qty > 0)
    .map(i => ({ ...i, profit_per_unit: i.total_profit / i.total_qty }))
    .sort((a, b) => b.profit_per_unit - a.profit_per_unit)
    .slice(0, 5);
  document.getElementById('profitPerUnitBody').innerHTML = perUnit.length
    ? perUnit.map(i => {
        const col = CAT_COLORS[i.category ?? ''] ?? '#6b7280';
        const tag = `<span class="item-tag" style="background:${col}22;color:${col}">${escHtml(i.category ?? '')}</span>`;
        return `<tr>
          <td><strong>${escHtml(i.product_name)}</strong></td>
          <td>${tag}</td>
          <td><strong style="color:#22c55e">${formatCurrency(i.profit_per_unit)}</strong></td>
          <td>${i.total_qty.toLocaleString()}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="4" class="table-loading">No data</td></tr>';

  // ── High volume, low margin ────────────────────────────────────────────
  // Items with 5+ units sold but margin in bottom third of priced items
  const marginThreshold = priced.length
    ? [...priced].sort((a, b) => a.profit_margin_pct - b.profit_margin_pct)[Math.floor(priced.length / 3)]?.profit_margin_pct ?? 40
    : 40;
  const hvlm = priced
    .filter(i => i.total_qty >= 5 && i.profit_margin_pct <= marginThreshold)
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, 5);
  // "Lost potential" = what profit would be at median margin vs actual
  const medianMargin = priced.length
    ? [...priced].sort((a, b) => a.profit_margin_pct - b.profit_margin_pct)[Math.floor(priced.length / 2)]?.profit_margin_pct ?? 50
    : 50;
  document.getElementById('profitHvlmBody').innerHTML = hvlm.length
    ? hvlm.map(i => {
        const potential = i.total_revenue * (medianMargin / 100) - i.total_profit;
        return `<tr>
          <td><strong>${escHtml(i.product_name)}</strong></td>
          <td>${i.total_qty.toLocaleString()}</td>
          <td><strong style="color:#f59e0b">${i.profit_margin_pct}%</strong></td>
          <td style="color:#ef4444">${formatCurrency(Math.max(0, potential))}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="4" class="table-loading" style="color:#22c55e">All high-volume items have strong margins</td></tr>';
}

function profitRankRow(item, primary) {
  const col = CAT_COLORS[item.category ?? ''] ?? '#6b7280';
  const tag = `<span class="item-tag" style="background:${col}22;color:${col}">${escHtml(item.category ?? '')}</span>`;
  if (primary === 'margin') {
    return `<tr>
      <td><strong>${escHtml(item.product_name)}</strong></td>
      <td>${tag}</td>
      <td><strong style="color:#22c55e">${item.profit_margin_pct}%</strong></td>
      <td>${formatCurrency(item.total_profit)}</td>
    </tr>`;
  }
  return `<tr>
    <td><strong>${escHtml(item.product_name)}</strong></td>
    <td>${tag}</td>
    <td><strong style="color:#22c55e">${formatCurrency(item.total_profit)}</strong></td>
    <td>${item.profit_margin_pct != null ? item.profit_margin_pct + '%' : '—'}</td>
  </tr>`;
}

// ── Item Statistics ───────────────────────────────────────────────────────────

let allItemStats   = [];
let itemMonthChart = null;

async function loadItemStats() {
  if (allItemStats.length) return;
  let data;
  try {
    data = await apiFetch('/sales/item_stats.php');
  } catch { return; }

  allItemStats = data.items ?? [];
  initItemSearch();
}

function initItemSearch() {
  const input    = document.getElementById('itemSearchInput');
  const dropdown = document.getElementById('itemSearchDropdown');
  let activeIdx  = -1;

  function positionDropdown() {
    const rect = input.getBoundingClientRect();
    dropdown.style.top    = `${rect.bottom + 4}px`;
    dropdown.style.left   = `${rect.left}px`;
    dropdown.style.width  = `${rect.width}px`;
  }

  function showDropdown(items) {
    activeIdx = -1;
    if (!items.length) { dropdown.classList.remove('open'); return; }
    dropdown.innerHTML = items.map((item, i) => {
      const col = CAT_COLORS[item.category ?? ''] ?? '#6b7280';
      return `<div class="item-search-option" data-name="${escHtml(item.product_name)}" data-idx="${i}">
        <span>${escHtml(item.product_name)}</span>
        <span class="item-tag" style="background:${col}22;color:${col};font-size:.7rem">${escHtml(item.category ?? '')}</span>
      </div>`;
    }).join('');
    positionDropdown();
    dropdown.classList.add('open');
    dropdown.querySelectorAll('.item-search-option').forEach(opt => {
      opt.addEventListener('mousedown', e => {
        e.preventDefault();
        selectItem(opt.dataset.name);
      });
    });
  }

  function setActive(idx) {
    const opts = dropdown.querySelectorAll('.item-search-option');
    opts.forEach(o => o.classList.remove('active'));
    if (idx >= 0 && idx < opts.length) {
      opts[idx].classList.add('active');
      opts[idx].scrollIntoView({ block: 'nearest' });
      activeIdx = idx;
    }
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { dropdown.classList.remove('open'); return; }
    const filtered = allItemStats.filter(i => i.product_name.toLowerCase().includes(q));
    showDropdown(filtered.slice(0, 20));
  });

  input.addEventListener('keydown', e => {
    const opts = dropdown.querySelectorAll('.item-search-option');
    if (e.key === 'ArrowDown')  { e.preventDefault(); setActive(Math.min(activeIdx + 1, opts.length - 1)); }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setActive(Math.max(activeIdx - 1, 0)); }
    if (e.key === 'Enter')      { e.preventDefault(); if (activeIdx >= 0) opts[activeIdx]?.dispatchEvent(new MouseEvent('mousedown')); }
    if (e.key === 'Escape')     { dropdown.classList.remove('open'); input.blur(); }
  });

  input.addEventListener('focus', () => {
    const q = input.value.trim().toLowerCase();
    if (q) {
      const filtered = allItemStats.filter(i => i.product_name.toLowerCase().includes(q));
      showDropdown(filtered.slice(0, 20));
    }
  });

  document.addEventListener('click', e => {
    if (!document.getElementById('itemSearchWrap').contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });
}

async function selectItem(name) {
  const input    = document.getElementById('itemSearchInput');
  const dropdown = document.getElementById('itemSearchDropdown');
  input.value = name;
  dropdown.classList.remove('open');

  const detail = document.getElementById('itemDetail');
  const empty  = document.getElementById('itemEmptyState');

  const item = allItemStats.find(i => i.product_name === name);
  if (!item) return;

  detail.classList.remove('hidden');
  empty.classList.add('hidden');

  // Header
  const cat      = item.category ?? '';
  const catColor = CAT_COLORS[cat] ?? '#6b7280';
  document.getElementById('itemDetailName').textContent = item.product_name;
  const catEl = document.getElementById('itemDetailCat');
  catEl.textContent = cat;
  catEl.style.background = `${catColor}22`;
  catEl.style.color = catColor;

  const firstSold = item.first_sold ? new Date(item.first_sold).toLocaleDateString() : '—';
  const lastSold  = item.last_sold  ? new Date(item.last_sold).toLocaleDateString()  : '—';
  const daysActive = item.first_sold
    ? Math.max(1, Math.ceil((Date.now() - new Date(item.first_sold)) / 86400000))
    : null;
  document.getElementById('itemDetailDates').textContent = `First sold ${firstSold}`;

  // KPIs
  document.getElementById('ikpiQty').textContent   = item.total_qty.toLocaleString();
  document.getElementById('ikpiTxns').textContent  = `${item.txn_count} transactions`;
  document.getElementById('ikpiRev').textContent      = formatCurrency(item.total_revenue);
  document.getElementById('ikpiAvgPrice').textContent = `avg ${formatCurrency(item.avg_price)} each`;

  const ppu = item.net_profit_per_unit;
  document.getElementById('ikpiProfit').textContent    = ppu != null ? formatCurrency(ppu) : '—';
  document.getElementById('ikpiProfitSub').textContent = ppu != null && item.profit_margin_pct != null
    ? `${item.profit_margin_pct}% margin`
    : 'no pricing data';
  document.getElementById('ikpiLastSold').textContent = lastSold;
  document.getElementById('ikpiLastSub').textContent  =
    item.days_since_last !== null ? `${item.days_since_last} days ago` : '';

  // Stock bars
  const stockEl = document.getElementById('itemStockBars');
  if (item.stock.length) {
    stockEl.innerHTML = item.stock.map(s => {
      const pct   = s.capacity ? Math.min(100, Math.round((s.current_qty / s.capacity) * 100)) : null;
      const color = pct === null ? '#6b7280' : pct === 0 ? '#ef4444' : pct < 30 ? '#f59e0b' : '#22c55e';
      const barW  = pct !== null ? pct : 0;
      const label = s.capacity ? `${s.current_qty} / ${s.capacity}` : `${s.current_qty}`;
      return `<div class="istock-row">
        <span class="istock-loc">${escHtml(s.location)}</span>
        <div class="istock-bar-wrap">
          <div class="istock-bar-fill" style="width:${barW}%;background:${color}"></div>
        </div>
        <span class="istock-label" style="color:${color}">${label}</span>
      </div>`;
    }).join('');
  } else {
    stockEl.innerHTML = '<p style="color:var(--text-muted);font-size:.82rem;margin:0">No count recorded yet</p>';
  }

  // Monthly chart
  let monthly = [];
  try {
    const detail = await apiFetch(`/sales/item_detail.php?name=${encodeURIComponent(name)}`);
    monthly = detail.monthly ?? [];
  } catch {}

  const labels   = monthly.map(r => r.month);
  const qtyData  = monthly.map(r => parseInt(r.qty));

  if (itemMonthChart) itemMonthChart.destroy();
  const ctx = document.getElementById('itemMonthChart').getContext('2d');
  itemMonthChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Units Sold',
        data: qtyData,
        backgroundColor: `${catColor}99`,
        borderColor: catColor,
        borderWidth: 1,
        borderRadius: 5,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,.06)' } },
      },
    },
  });
}

// ── Sales Calendar ────────────────────────────────────────────────────────────

let calYear      = new Date().getFullYear();
let calMonth     = new Date().getMonth() + 1;
let calDayData   = {};
let calInitDone  = false;
let calMachineId = '';

async function initCalendar() {
  if (calInitDone) return;
  calInitDone = true;

  // Populate machine filter from already-loaded machines
  const sel = document.getElementById('calMachineFilter');
  (allMachines ?? []).forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.machine_id;
    opt.textContent = `${m.machine_id} — ${m.location}`;
    sel.appendChild(opt);
  });

  sel.addEventListener('change', () => {
    calMachineId = sel.value;
    loadCalendarMonth();
  });

  document.getElementById('calPrev').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 1) { calMonth = 12; calYear--; }
    loadCalendarMonth();
  });
  document.getElementById('calNext').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 12) { calMonth = 1; calYear++; }
    loadCalendarMonth();
  });
  document.getElementById('calDetailClose').addEventListener('click', () => {
    document.getElementById('calDayDetail').classList.add('hidden');
  });

  await loadCalendarMonth();
}

async function loadCalendarMonth() {
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  document.getElementById('calDayDetail').classList.add('hidden');

  const params = `year=${calYear}&month=${calMonth}` + (calMachineId ? `&machine_id=${encodeURIComponent(calMachineId)}` : '');
  let data;
  try {
    data = await apiFetch(`/sales/calendar_month.php?${params}`);
  } catch { return; }

  calDayData = data.days ?? {};

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calMonthLabel').textContent = `${MONTHS[calMonth - 1]} ${calYear}`;

  renderCalendar();
}

function renderCalendar() {
  if (!calDayData) return;
  const grid = document.getElementById('calGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const maxVal    = Math.max(...Object.values(calDayData).map(d => d.revenue ?? 0), 1);
  const bestDate  = Object.entries(calDayData).sort((a, b) => (b[1].revenue ?? 0) - (a[1].revenue ?? 0))[0]?.[0];

  const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-cell cal-cell--blank';
    grid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const info    = calDayData[dateStr];
    const cell    = document.createElement('div');
    cell.className = 'cal-cell' + (dateStr === today ? ' cal-cell--today' : '') + (info ? ' cal-cell--has-data' : '') + (dateStr === bestDate ? ' cal-cell--best' : '');
    cell.dataset.date = dateStr;

    if (info) {
      const val = info.revenue ?? 0;
      const intensity = Math.round((val / maxVal) * 100);
      cell.style.setProperty('--cal-intensity', intensity);
      cell.innerHTML = `
        <span class="cal-cell-day">${d}</span>
        <span class="cal-cell-rev">${formatCurrency(val)}</span>
        <span class="cal-cell-txn">${info.txn_count} sale${info.txn_count !== 1 ? 's' : ''}</span>`;
    } else {
      cell.innerHTML = `<span class="cal-cell-day">${d}</span>`;
    }

    cell.addEventListener('click', () => info && openCalDay(dateStr));
    grid.appendChild(cell);
  }
}

async function openCalDay(dateStr) {
  const panel = document.getElementById('calDayDetail');
  panel.classList.remove('hidden');
  document.getElementById('calDetailDate').textContent = new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('calDetailSummary').textContent = 'Loading...';
  document.getElementById('calItemsGrid').innerHTML = '';
  document.getElementById('calTxnList').innerHTML = '';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const params = `date=${dateStr}` + (calMachineId ? `&machine_id=${encodeURIComponent(calMachineId)}` : '');
  let data;
  try {
    data = await apiFetch(`/sales/day_detail.php?${params}`);
  } catch { return; }

  const s = data.summary;
  document.getElementById('calDetailSummary').textContent =
    `${s.txn_count} transaction${s.txn_count !== 1 ? 's' : ''} · ${formatCurrency(s.revenue)} total · avg ${formatCurrency(s.avg_price)}`;

  // Items grid
  document.getElementById('calItemsGrid').innerHTML = (data.items ?? []).map(item => {
    const cat = item.category ?? '';
    const col = CAT_COLORS[cat] ?? '#6b7280';
    return `<div class="cal-item-row">
      <span class="cal-item-name">${escHtml(item.product_name ?? '—')}</span>
      <span class="item-tag" style="background:${col}22;color:${col}">${escHtml(cat)}</span>
      <span class="cal-item-qty">${item.qty}×</span>
      <span class="cal-item-rev">${formatCurrency(item.revenue)}</span>
    </div>`;
  }).join('') || '<p style="color:var(--text-muted);font-size:.82rem">No items</p>';

  // Transaction log
  document.getElementById('calTxnList').innerHTML = (data.transactions ?? []).map(t => {
    return `<div class="cal-txn-row">
      <span class="cal-txn-time">${escHtml(t.time)}</span>
      <span class="cal-txn-name">${escHtml(t.product_name ?? '—')}</span>
      ${t.location ? `<span class="cal-txn-loc">${escHtml(t.location)}</span>` : ''}
      <span class="cal-txn-price">${t.quantity > 1 ? `${t.quantity}× ` : ''}${formatCurrency(t.amount)}</span>
    </div>`;
  }).join('') || '<p style="color:var(--text-muted);font-size:.82rem">No transactions</p>';
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

// ── Theme ─────────────────────────────────────────────────────────────────────

let currentUsername = null;

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  if (currentUsername) localStorage.setItem(`theme_${currentUsername}`, dark ? 'dark' : 'light');
}

function initTheme() {
  document.getElementById('themeToggle').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyTheme(!isDark);
  });
}

function initRevProfitToggle() {
  document.getElementById('revProfitRevBtn')?.addEventListener('click',  () => setProfitMode(false));
  document.getElementById('revProfitProfBtn')?.addEventListener('click', () => setProfitMode(true));
}

async function init() {
  initNav();
  initTheme();
  initPeriodToggle();
  initRevProfitToggle();
  initQrModal();
  initMachineDetail();
  initInventory();
  await loadMachinesFromApi();
  initProfitMachineSelect();
  await Promise.all([loadSummary(), loadTrend(currentPeriod), loadFeedback(), loadAnalyticsStats(), loadLatestSale()]);

  // Username embedded by PHP at page load — no AJAX needed
  currentUsername = (typeof window.CURRENT_USER === 'string' && window.CURRENT_USER) ? window.CURRENT_USER : 'guest';
  const saved = localStorage.getItem(`theme_${currentUsername}`);
  if (saved) {
    applyTheme(saved === 'dark');
  } else if (currentUsername === 'travenyarbro') {
    applyTheme(true);
  }

  setInterval(() => {
    loadFeedback();
    loadTrend(currentPeriod);
  }, 60_000);
}

init();
