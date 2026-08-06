<?php
$username = $_SERVER['REMOTE_USER']
         ?? $_SERVER['PHP_AUTH_USER']
         ?? (function() {
                $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
                if (preg_match('/Basic\s+(.+)/i', $h, $m)) {
                    return explode(':', base64_decode($m[1]), 2)[0] ?: null;
                }
                return null;
            })()
         ?? 'guest';
?><!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vending Machine Dashboard</title>
  <link rel="stylesheet" href="css/dashboard.css" />
  <script>window.CURRENT_USER = '<?= htmlspecialchars($username, ENT_QUOTES) ?>';</script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>

<div class="layout">

  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar__brand">
      <img src="/assets/logo.png" alt="Atlas Vending Logo" />
    </div>

    <nav class="sidebar__nav">
      <a href="#overview"  class="sidebar__link active" data-section="overview"  title="Overview">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      </a>
      <a href="#analytics" class="sidebar__link" data-section="analytics" title="Analytics">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6"  y1="20" x2="6"  y2="14"/>
        </svg>
      </a>
      <a href="#calendar" class="sidebar__link" data-section="calendar" title="Sales Calendar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8"  y1="2" x2="8"  y2="6"/>
          <line x1="3"  y1="10" x2="21" y2="10"/>
        </svg>
      </a>
      <a href="#items" class="sidebar__link" data-section="items" title="Item Statistics">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/>
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          <line x1="12" y1="12" x2="12" y2="12.01"/>
        </svg>
      </a>
      <a href="#machines" class="sidebar__link" data-section="machines" title="Machines">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="5" y="2" width="14" height="20" rx="2"/>
          <line x1="5" y1="8"  x2="19" y2="8"/>
          <line x1="5" y1="14" x2="19" y2="14"/>
          <rect x="9" y="10" width="6" height="3" rx="1"/>
        </svg>
      </a>
    </nav>
  </aside>

  <!-- Main content -->
  <main class="main">

    <!-- Top bar -->
    <header class="topbar">
      <div class="topbar__title">
        <h1>Vending Machine Dashboard</h1>
        <p>Track performance and customer satisfaction</p>
      </div>
      <div class="topbar__right">
        <button class="btn-theme-toggle" id="themeToggle" title="Toggle dark mode">
          <svg class="theme-icon theme-icon--moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          <svg class="theme-icon theme-icon--sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        </button>
        <div class="topbar__status" id="liveStatus">
          <span class="status-dot"></span>
          Live monitoring active
        </div>
      </div>
    </header>

    <!-- Overview Section -->
    <section class="section" id="section-overview">

      <!-- Profit Overview Card -->
      <div class="card">
        <div class="card__header">
          <div class="card__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
            Sales Overview
          </div>
          <div class="card__controls">
            <select class="machine-select" id="machineSelect">
              <option value="">All Machines</option>
            </select>
            <div class="period-toggle">
              <button class="period-btn" data-period="daily">Daily</button>
              <button class="period-btn active" data-period="weekly">Weekly</button>
              <button class="period-btn" data-period="monthly">Monthly</button>
            </div>
          </div>
        </div>

        <div class="profit-grid">
          <!-- Donut chart -->
          <div class="donut-wrap">
            <div class="donut-canvas-container">
              <canvas id="donutChart"></canvas>
              <div class="donut-center" id="donutCenter">
                <span class="donut-center__label">Total YTD</span>
                <span class="donut-center__amount" id="ytdAmount">--</span>
                <span class="donut-center__growth" id="ytdGrowth">--</span>
              </div>
            </div>
            <div class="donut-legend" id="donutLegend"></div>
          </div>

          <!-- Line chart -->
          <div class="trend-wrap">
            <div class="trend-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8"  y1="2" x2="8"  y2="6"/>
                <line x1="3"  y1="10" x2="21" y2="10"/>
              </svg>
              <span id="trendTitle">Weekly Profit Trend</span>
            </div>
            <canvas id="trendChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Feedback Table Card -->
      <div class="card" id="section-feedback">
        <div class="card__header">
          <div class="card__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Customer Feedback Forms
          </div>
          <button class="btn-refresh" id="refreshFeedback" title="Refresh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>

        <div class="table-container">
          <table class="feedback-table" id="feedbackTable">
            <thead>
              <tr>
                <th>Rating</th>
                <th>Comments / Concerns</th>
                <th>Location</th>
                <th>Item Purchased</th>
                <th>Item Suggestions</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="feedbackBody">
              <tr class="table-loading">
                <td colspan="5">Loading feedback...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </section>

    <!-- Analytics Section -->
    <!-- Sales Calendar Section -->
    <section class="section hidden" id="section-calendar">
      <div class="card cal-card">

        <!-- Calendar header -->
        <div class="cal-header">
          <div class="cal-nav">
            <button class="cal-nav-btn" id="calPrev">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="cal-month-label" id="calMonthLabel"></span>
            <button class="cal-nav-btn" id="calNext">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 6 15 12 9 18"/></svg>
            </button>
          </div>
          <select id="calMachineFilter" class="item-select">
            <option value="">All Machines</option>
          </select>
        </div>

        <!-- Day-of-week headers -->
        <div class="cal-dow-row">
          <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div>
          <div>Thu</div><div>Fri</div><div>Sat</div>
        </div>

        <!-- Grid -->
        <div class="cal-grid" id="calGrid"></div>

      </div>

      <!-- Day detail panel -->
      <div class="card cal-detail-card hidden" id="calDayDetail">
        <div class="cal-detail-header">
          <div>
            <div class="cal-detail-date" id="calDetailDate"></div>
            <div class="cal-detail-summary" id="calDetailSummary"></div>
          </div>
          <button class="btn-refresh" id="calDetailClose" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="cal-detail-body">
          <!-- Items sold -->
          <div class="cal-detail-section">
            <div class="cal-detail-section-title">Items Sold</div>
            <div id="calItemsGrid"></div>
          </div>
          <!-- Transaction log -->
          <div class="cal-detail-section">
            <div class="cal-detail-section-title">Transaction Log</div>
            <div id="calTxnList"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Item Statistics Section -->
    <section class="section hidden" id="section-items">

      <!-- Picker -->
      <div class="card item-picker-card">
        <div class="item-picker-row">
          <div class="item-picker-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/>
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            </svg>
          </div>
          <div class="item-picker-text">
            <span class="item-picker-title">Item Statistics</span>
            <span class="item-picker-hint">Select an item to see its full performance breakdown</span>
          </div>
          <select id="itemSelect" class="item-select">
            <option value="">— Select an item —</option>
          </select>
        </div>
      </div>

      <!-- Empty state -->
      <div id="itemEmptyState" class="item-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
          <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/>
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        </svg>
        <p>Pick an item from the dropdown above</p>
      </div>

      <!-- Detail panel (hidden until item chosen) -->
      <div id="itemDetail" class="hidden">

        <!-- Header -->
        <div class="item-detail-header">
          <div>
            <h2 class="item-detail-name" id="itemDetailName"></h2>
            <span class="item-tag" id="itemDetailCat"></span>
          </div>
          <div class="item-detail-dates" id="itemDetailDates"></div>
        </div>

        <!-- KPI row -->
        <div class="item-kpi-row">
          <div class="item-kpi-card">
            <span class="item-kpi-label">Total Sold</span>
            <span class="item-kpi-value" id="ikpiQty">—</span>
            <span class="item-kpi-sub" id="ikpiTxns"></span>
          </div>
          <div class="item-kpi-card">
            <span class="item-kpi-label">Total Revenue</span>
            <span class="item-kpi-value item-kpi-value--green" id="ikpiRev">—</span>
            <span class="item-kpi-sub" id="ikpiAvgPrice"></span>
          </div>
          <div class="item-kpi-card">
            <span class="item-kpi-label">Avg / Day</span>
            <span class="item-kpi-value" id="ikpiDaily">—</span>
            <span class="item-kpi-sub" id="ikpiDaysActive"></span>
          </div>
          <div class="item-kpi-card">
            <span class="item-kpi-label">Last Sale</span>
            <span class="item-kpi-value" id="ikpiLastSold">—</span>
            <span class="item-kpi-sub" id="ikpiLastSub"></span>
          </div>
        </div>

        <!-- Chart + Stock -->
        <div class="item-bottom-row">
          <div class="card item-chart-card">
            <div class="item-section-title">Monthly Sales</div>
            <canvas id="itemMonthChart" height="160"></canvas>
          </div>
          <div class="card item-stock-card">
            <div class="item-section-title">Current Stock</div>
            <div id="itemStockBars"></div>
          </div>
        </div>

      </div>
    </section>

    <section class="section hidden" id="section-analytics">

      <!-- Most Recent Sale -->
      <div class="card">
        <div class="card__header">
          <div class="card__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Most Recent Sale
          </div>
        </div>
        <div class="stats-grid" id="latestGrid">
          <div class="stat-card">
            <span class="stat-card__label">Item Purchased</span>
            <span class="stat-card__value" id="latestItem">--</span>
          </div>
          <div class="stat-card">
            <span class="stat-card__label">Purchase Time</span>
            <span class="stat-card__value stat-card__value--sm" id="latestTime">--</span>
          </div>
          <div class="stat-card">
            <span class="stat-card__label">Sale Amount</span>
            <span class="stat-card__value" id="latestAmount">--</span>
          </div>
          <div class="stat-card">
            <span class="stat-card__label">Machine Location</span>
            <span class="stat-card__value stat-card__value--sm" id="latestLocation">--</span>
          </div>
        </div>
      </div>

      <!-- Overall Analytics -->
      <div class="card">
        <div class="card__header">
          <div class="card__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6"  y1="20" x2="6"  y2="14"/>
            </svg>
            Sales Analytics
          </div>
        </div>
        <div class="stats-grid" id="statsGrid">
          <div class="stat-card">
            <span class="stat-card__label">Total Transactions</span>
            <span class="stat-card__value" id="statTransactions">--</span>
          </div>
          <div class="stat-card">
            <span class="stat-card__label">Avg. Sale Value</span>
            <span class="stat-card__value" id="statAvgSale">--</span>
          </div>
          <div class="stat-card">
            <span class="stat-card__label">Top Category</span>
            <span class="stat-card__value" id="statTopCat">--</span>
          </div>
          <div class="stat-card">
            <span class="stat-card__label">Avg. Rating</span>
            <span class="stat-card__value" id="statAvgRating">--</span>
          </div>
        </div>
      </div>

    </section>

    <!-- Machines Section -->
    <section class="section hidden" id="section-machines">

      <!-- Machines list -->
      <div class="card">
        <div class="card__header">
          <div class="card__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="5" y="2" width="14" height="20" rx="2"/>
              <line x1="5" y1="8"  x2="19" y2="8"/>
              <line x1="5" y1="14" x2="19" y2="14"/>
              <rect x="9" y="10" width="6" height="3" rx="1"/>
            </svg>
            Machine Locations
          </div>
          <span class="card__hint">Select a machine to manage its column mapping</span>
        </div>
        <div class="table-container">
          <table class="feedback-table" id="machinesTable">
            <thead>
              <tr>
                <th>Machine ID</th>
                <th>Location</th>
                <th>Building</th>
                <th>Floor</th>
                <th>QR Code Link</th>
                <th>QR Code</th>
              </tr>
            </thead>
            <tbody id="machinesBody">
              <tr class="table-loading"><td colspan="6">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Machine detail panel (shown when a machine is selected) -->
      <div class="card hidden" id="machineDetail">
        <div class="card__header">
          <div class="card__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
            <span id="detailMachineTitle">Machine Detail</span>
          </div>
          <button class="btn-refresh" id="closeDetail" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Column mapping -->
        <div class="detail-section" id="columnMappingSection">
          <div class="detail-section__header detail-section__header--toggle" id="columnMappingToggle">
            <div class="detail-section__header-text">
              <span class="detail-section__title">Column → Product Mapping</span>
              <span class="detail-section__hint">Map each slot number to a product so sales data can be tracked by item</span>
            </div>
            <button class="btn-collapse" id="columnMappingBtn" aria-expanded="false" title="Expand">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>
          <div class="detail-section__body collapsed" id="columnMappingBody">
            <div class="table-container">
              <table class="feedback-table" id="columnsTable">
                <thead>
                  <tr>
                    <th>Column #</th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Cap</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="columnsBody">
                  <tr class="table-loading"><td colspan="5">Select a machine above</td></tr>
                </tbody>
              </table>
            </div>

            <!-- Add mapping row -->
            <div class="mapping-add-row">
              <input type="text" class="mapping-input" id="newColumnNum" placeholder="Col #" maxlength="10" />
              <input type="text" class="mapping-input mapping-input--name" id="newProductName" placeholder="Item name" maxlength="100" />
              <select class="mapping-select mapping-select--cat" id="newCategory">
                <option value="">Category...</option>
              </select>
              <input type="number" class="mapping-input mapping-input--cap" id="newCapacity" placeholder="Cap" min="1" max="999" />
              <button class="btn-add-mapping" id="addMappingBtn">Add</button>
            </div>
          </div>
        </div>

        <!-- Recent sales -->
        <div class="detail-section">
          <div class="detail-section__header detail-section__header--toggle" id="recentSalesToggle">
            <div class="detail-section__header-text">
              <span class="detail-section__title">Recent Sales</span>
              <span class="detail-section__hint">Use this to verify column mappings and remove test vends</span>
            </div>
            <button class="btn-collapse" id="recentSalesBtn" aria-expanded="false" title="Expand">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>
          <div class="detail-section__body collapsed" id="recentSalesBody_wrap">
            <div class="table-container">
              <table class="feedback-table" id="recentSalesTable">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Column</th>
                    <th>Item</th>
                    <th>Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="recentSalesBody">
                  <tr class="table-loading"><td colspan="5">Select a machine above</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Inventory -->
        <div class="detail-section">
          <div class="detail-section__header detail-section__header--toggle" id="inventoryToggle">
            <div class="detail-section__header-text">
              <span class="detail-section__title">Restock Planner</span>
              <span class="detail-section__hint">Track qty per slot and see what to bring on your next visit</span>
            </div>
            <div class="inventory-header-actions">
              <button class="btn-record-count hidden" id="cancelCountBtn">Cancel</button>
              <button class="btn-record-count" id="recordCountBtn">Record Count</button>
              <button class="btn-collapse" id="inventoryCollapseBtn" aria-expanded="false" title="Expand">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="detail-section__body collapsed" id="inventoryCollapse">
            <div class="inventory-summary" id="inventorySummary"></div>
            <div class="table-container">
              <table class="feedback-table" id="inventoryTable">
                <thead>
                  <tr>
                    <th>Slot</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Qty / Cap</th>
                    <th>To Bring</th>
                    <th>Last Counted</th>
                  </tr>
                </thead>
                <tbody id="inventoryTbody">
                  <tr class="table-loading"><td colspan="6">Select a machine above</td></tr>
                </tbody>
              </table>
            </div>
            <div class="inventory-count-footer hidden" id="inventoryCountFooter">
              <button class="btn-add-mapping" id="saveCountBtn">Save Count</button>
            </div>
          </div>
        </div>

        <!-- Machine Analytics -->
        <div class="detail-section" id="machineAnalyticsSection">
          <div class="detail-section__header detail-section__header--toggle" id="analyticsToggle">
            <div class="detail-section__header-text">
              <span class="detail-section__title">Sales Analytics</span>
              <span class="detail-section__hint">Performance breakdown for this machine</span>
            </div>
            <button class="btn-collapse" id="analyticsCollapseBtn" aria-expanded="false" title="Expand">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>
          <div class="detail-section__body collapsed" id="analyticsCollapse">

          <!-- Period comparison cards -->
          <div class="machine-period-grid" id="machinePeriodGrid">
            <div class="stat-card">
              <span class="stat-card__label">Last 7 Days</span>
              <span class="stat-card__value stat-card__value--sm" id="mStatWeekRev">--</span>
              <span class="stat-card__change" id="mStatWeekChange"></span>
            </div>
            <div class="stat-card">
              <span class="stat-card__label">Prior 7 Days</span>
              <span class="stat-card__value stat-card__value--sm" id="mStatLastWeekRev">--</span>
              <span class="stat-card__change" id="mStatWeekTxns"></span>
            </div>
            <div class="stat-card">
              <span class="stat-card__label">This Month</span>
              <span class="stat-card__value stat-card__value--sm" id="mStatMonthRev">--</span>
              <span class="stat-card__change" id="mStatMonthChange"></span>
            </div>
            <div class="stat-card">
              <span class="stat-card__label">Last Month</span>
              <span class="stat-card__value stat-card__value--sm" id="mStatLastMonthRev">--</span>
              <span class="stat-card__change" id="mStatMonthTxns"></span>
            </div>
          </div>

          <!-- Charts row -->
          <div class="machine-charts-row">
            <div class="machine-chart-wrap">
              <div class="machine-chart-title">Sales by Hour of Day</div>
              <canvas id="machineHourChart"></canvas>
            </div>
            <div class="machine-chart-wrap">
              <div class="machine-chart-title">Sales by Day of Week</div>
              <canvas id="machineDowChart"></canvas>
            </div>
          </div>

          <!-- Top sellers -->
          <div class="machine-sub-section">
            <div class="machine-chart-title">Top Sellers</div>
            <div class="table-container">
              <table class="feedback-table" id="topSellersTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Units Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody id="topSellersBody">
                  <tr class="table-loading"><td colspan="5">Loading...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Slow movers -->
          <div class="machine-sub-section" id="deadStockSection">
            <div class="machine-chart-title">
              Slow Movers
              <span class="dead-stock-badge hidden" id="deadStockBadge">0</span>
            </div>
            <p class="detail-section__hint" style="margin-bottom:12px">Mapped items with no sales in the last 30 days</p>
            <div id="deadStockList"></div>
          </div>

          </div><!-- /analyticsCollapse -->
        </div>

      </div>

    </section>

  </main>
</div>

<!-- QR Code Modal -->
<div class="qr-modal hidden" id="qrModal">
  <div class="qr-modal__backdrop" id="qrBackdrop"></div>
  <div class="qr-modal__box">
    <div class="qr-modal__header">
      <span id="qrModalTitle">QR Code</span>
      <button class="qr-modal__close" id="qrModalClose">&times;</button>
    </div>
    <img id="qrModalImg" src="" alt="QR Code" />
    <p id="qrModalUrl" class="qr-modal__url"></p>
    <a id="qrModalDownload" download="qr-code.png" class="btn-submit" style="margin-top:12px;text-decoration:none;display:inline-flex;justify-content:center;">Download QR</a>
  </div>
</div>

<script src="js/dashboard.js"></script>
</body>
</html>
