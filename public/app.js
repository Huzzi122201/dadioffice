/* ═══════════════════════════════════════════════════════════
   Textile Costing Sheet — Frontend Application
   ═══════════════════════════════════════════════════════════ */

// ── Register Service Worker (PWA) ──────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ── Constants ──────────────────────────────────────────────
const API = '/api/invoices';
const YARN_API = '/api/yarn';
const CB_API = '/api/cashbook';
const CONTRACTS_API = '/api/contracts';
const PARTY_ENTRIES_API = '/api/party-entries';

// ── DOM References ─────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const viewDashboard = $('viewDashboard');
const viewForm = $('viewForm');
const viewDetail = $('viewDetail');
const viewPartyGazanaDashboard = $('viewPartyGazanaDashboard');
const viewPartyGazanaDetail = $('viewPartyGazanaDetail');
const viewPartyGazanaForm = $('viewPartyGazanaForm');
const viewCashbookDashboard = $('viewCashbookDashboard');
const viewRokerDetail = $('viewRokerDetail');
const viewKhata = $('viewKhata');
const viewEntryForm = $('viewEntryForm');
const viewTempInvoice = $('viewTempInvoice');
const views = [viewDashboard, viewForm, viewDetail, viewPartyGazanaDashboard, viewPartyGazanaDetail, viewPartyGazanaForm, viewCashbookDashboard, viewRokerDetail, viewKhata, viewEntryForm, viewTempInvoice].filter(Boolean);

const invoiceList = $('invoiceList');
const invoiceCount = $('invoiceCount');
const searchInput = $('searchInput');
const invoiceForm = $('invoiceForm');
const editIdField = $('editId');
const formTitle = $('formTitle');
const resultsPreview = $('resultsPreview');
const detailContent = $('detailContent');
const toastContainer = $('toastContainer');
const confirmModal = $('confirmModal');

// Form fields that trigger calculation
const calcFields = [
  'warpCount', 'weftCount', 'reed', 'pick', 'width',
  'warpRate', 'weftRate', 'conversionRate', 'quantity',
];

// All form input IDs
const allFields = [
  'partyName', 'date', 'fabricType', 'loomType',
  'warpCount', 'warpCountAlt', 'weftCount', 'weftCountAlt',
  'reed', 'pick', 'width', 'widthCm',
  'warpRate', 'weftRate', 'conversionRate', 'quantity',
];

// ── State ──────────────────────────────────────────────────
let currentInvoiceId = null;
let confirmCallback = null;
let searchTimeout = null;
let yarnSearchTimeout = null;
let gazanaSearchTimeout = null;
let currentTab = 'costing'; // 'costing', 'yarn', or 'cashbook'
let currentCostingSubtab = 'invoices'; // 'invoices' or 'gazana'
let gazanaViewMode = 'all'; // 'all' (recent entries) or 'parties' (grouped by party)
let gazanaStatusFilter = 'active'; // 'all', 'active', 'completed'
let partyGazanaDetailFilter = 'active'; // 'active', 'completed', 'all'
let currentGazanaAllPayments = [];
let currentGazanaPartyName = '';
let currentGazanaPartyData = null;
let currentHistoryPartyName = '';
let currentHistoryPartyNorm = '';

// ── View Routing ───────────────────────────────────────────
function showView(view) {
  views.forEach((v) => v.classList.remove('active'));
  view.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Update bottom nav active state
  const tabBtns = document.querySelectorAll('.bottom-nav-tab');
  if (view === viewPartyGazanaDashboard || view === viewPartyGazanaDetail || view === viewPartyGazanaForm) {
    currentTab = 'gazana';
  } else if (view === viewCashbookDashboard || view === viewRokerDetail || view === viewKhata || view === viewEntryForm) {
    currentTab = 'cashbook';
  } else if (view === viewTempInvoice) {
    currentTab = 'tempInvoice';
  } else {
    currentTab = 'costing';
  }
  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === currentTab);
  });
  try {
    localStorage.setItem('active_tab', currentTab);
  } catch (e) {}
}

// ── Calculator (client-side replica) ───────────────────────
function r4(v) { return v != null && !isNaN(v) && isFinite(v) ? Number(Number(v).toFixed(4)) : 0; }
function r2(v) { return v != null && !isNaN(v) && isFinite(v) ? Number(Number(v).toFixed(2)) : 0; }
function r0(v) { return v != null && !isNaN(v) && isFinite(v) ? Math.round(Number(v)) : 0; }

function calculate(inputs) {
  const warpCount = inputs.warpCount || 0;
  const weftCount = inputs.weftCount || 0;
  const reed = inputs.reed || 0;
  const pick = inputs.pick || 0;
  const width = inputs.width || 0;
  const warpRate = inputs.warpRate || 0;
  const weftRate = inputs.weftRate || 0;
  const conversionRate = inputs.conversionRate || 0;
  const quantity = inputs.quantity || 0;

  const warpWeightYard = warpCount > 0 ? (reed * width / 20 / warpCount) : 0;
  const warpWeightMeter = warpWeightYard * 1.0936;
  const weftWeightYard = weftCount > 0 ? (pick * width / 20 / weftCount) : 0;
  const weftWeightMeter = weftWeightYard * 1.0936;
  const totalWeightYard = warpWeightYard + weftWeightYard;
  const totalWeightMeter = warpWeightMeter + weftWeightMeter;
  const weightPerMtrPYard = totalWeightYard / 40;
  const weightPerMtrPMeter = totalWeightMeter / 40;
  const weightPerMtrGYard = weightPerMtrPYard / 2.2046;
  const weightPerMtrGMeter = weightPerMtrPMeter / 2.2046;
  const gsm = width > 0 ? (weightPerMtrGMeter / width * 39.37) : 0;
  const ozPerSqYd = gsm * 2.2046 / 1.0936 / 1.0936 * 16;
  const conversionCost = conversionRate * pick;
  const warpCostYard = warpWeightYard * warpRate / 40;
  const warpCostMeter = warpWeightMeter * warpRate / 40;
  const weftCostYard = weftWeightYard * weftRate / 40;
  const weftCostMeter = weftWeightMeter * weftRate / 40;
  const manfCostYard = conversionCost / 1.0936;
  const manfCostMeter = conversionCost;
  const totalCostYard = warpCostYard + weftCostYard + manfCostYard;
  const totalCostMeter = warpCostMeter + weftCostMeter + manfCostMeter;
  const yarnBagsWarp = warpWeightMeter / 40 * quantity / 100;
  const yarnBagsWeft = weftWeightMeter / 40 * quantity / 100;
  const totalYarnBags = yarnBagsWarp + yarnBagsWeft;
  const qtyInFCL = weightPerMtrGMeter > 0 ? (24000 / weightPerMtrGMeter) : 0;

  return {
    warpWeightYard: r4(warpWeightYard),
    warpWeightMeter: r4(warpWeightMeter),
    weftWeightYard: r4(weftWeightYard),
    weftWeightMeter: r4(weftWeightMeter),
    totalWeightYard: r4(totalWeightYard),
    totalWeightMeter: r4(totalWeightMeter),
    weightPerMtrPYard: r4(weightPerMtrPYard),
    weightPerMtrPMeter: r4(weightPerMtrPMeter),
    weightPerMtrGYard: r4(weightPerMtrGYard),
    weightPerMtrGMeter: r4(weightPerMtrGMeter),
    gsm: r4(gsm),
    ozPerSqYd: r4(ozPerSqYd),
    conversionCost: r2(conversionCost),
    warpCostYard: r2(warpCostYard),
    warpCostMeter: r2(warpCostMeter),
    weftCostYard: r2(weftCostYard),
    weftCostMeter: r2(weftCostMeter),
    manfCostYard: r2(manfCostYard),
    manfCostMeter: r2(manfCostMeter),
    totalCostYard: r2(totalCostYard),
    totalCostMeter: r2(totalCostMeter),
    yarnBagsWarp: r2(yarnBagsWarp),
    yarnBagsWeft: r2(yarnBagsWeft),
    totalYarnBags: r2(totalYarnBags),
    qtyInFCL: r0(qtyInFCL),
  };
}

// ── Format Number ──────────────────────────────────────────
function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toFixed(decimals);
}

function fmtInt(n) {
  if (n == null || isNaN(n)) return '—';
  return Math.round(n).toLocaleString();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Toast Notifications ────────────────────────────────────
function toast(message, type = 'success') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(100%)';
    el.style.transition = '0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ── Confirm Dialog ─────────────────────────────────────────
function showConfirm(title, text, callback) {
  $('confirmTitle').textContent = title;
  $('confirmText').textContent = text;
  confirmCallback = callback;
  confirmModal.classList.remove('hidden');
}

$('confirmCancel').addEventListener('click', () => {
  confirmModal.classList.add('hidden');
  confirmCallback = null;
});

$('confirmOk').addEventListener('click', () => {
  confirmModal.classList.add('hidden');
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
});

// ── API Helpers ────────────────────────────────────────────
async function parseApiResponse(res) {
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    if (text.trim().startsWith('<')) {
      throw new Error('Server returned HTML instead of API data. Please restart your Node.js server (node server.js) in the terminal to load the new routes.');
    }
    throw new Error('Invalid server response: ' + text.slice(0, 80));
  }
  if (!res.ok) {
    const errorMsg = data.details ? `${data.error || 'Error'}: ${data.details}` : (data.error || data.message || `Request failed (${res.status})`);
    throw new Error(errorMsg);
  }
  return data;
}

async function apiGet(url) {
  const res = await fetch(url);
  return parseApiResponse(res);
}

async function apiPost(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

async function apiPut(url, data) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

async function apiDelete(url) {
  const res = await fetch(url, { method: 'DELETE' });
  return parseApiResponse(res);
}

// ── Format Date (Date/Month/Year -> DD/MM/YYYY) ────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';

  if (typeof dateStr === 'string') {
    const trimmed = dateStr.trim();

    // Handle ISO dash dates like "2026-08-19" or "2026-08-19T00:00:00.000Z"
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2];
      const day = isoMatch[3];
      return `${day}/${month}/${year}`;
    }

    // Handle slash dates like "19/08/2026" or "19/8/2026"
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      const day = String(parseInt(slashMatch[1], 10)).padStart(2, '0');
      const month = String(parseInt(slashMatch[2], 10)).padStart(2, '0');
      const year = slashMatch[3];
      return `${day}/${month}/${year}`;
    }
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function toInputDate(dateStr) {
  return formatDate(dateStr);
}

// ═══════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════

async function loadInvoices() {
  try {
    const search = searchInput ? searchInput.value.trim() : '';
    const filterType = $('filterType') ? $('filterType').value : 'party';
    const sortBy = $('sortBy') ? $('sortBy').value : 'newest';

    const url = search ? `${API}?search=${encodeURIComponent(search)}` : API;
    const invoices = await apiGet(url);

    let displayList = invoices;
    if (search) {
      const term = search.toLowerCase();
      displayList = invoices.filter((inv) => {
        const partyStr = (inv.partyName || '').toLowerCase();
        const dateStr = formatDate(inv.date).toLowerCase();
        const qtyStr = inv.quantity != null ? String(inv.quantity) + ' ' + fmtInt(inv.quantity).toLowerCase() : '';
        const fabricStr = ((inv.fabricType || '') + ' ' + (inv.loomType || '')).toLowerCase();

        if (filterType === 'date') return dateStr.includes(term);
        if (filterType === 'qty') return qtyStr.includes(term);
        if (filterType === 'fabric') return fabricStr.includes(term);

        // Default & party filter strictly searches Party Name
        return partyStr.includes(term);
      });
    }

    // Apply sorting
    displayList.sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.date || 0) - new Date(b.date || 0);
      if (sortBy === 'qtyHigh') return (b.quantity || 0) - (a.quantity || 0);
      if (sortBy === 'costHigh') return (b.totalCostMeter || 0) - (a.totalCostMeter || 0);
      if (sortBy === 'partyAZ') return (a.partyName || '').localeCompare(b.partyName || '');
      // newest
      return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0);
    });

    invoiceCount.textContent = `(${displayList.length})`;

    if (displayList.length === 0) {
      invoiceList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>${search ? 'No invoices match your search.' : 'No invoices yet. Create your first one!'}</p>
          ${!search ? '<button class="btn btn-primary" onclick="openNewForm()">＋ Create Invoice</button>' : ''}
        </div>
      `;
      return;
    }

    invoiceList.innerHTML = displayList.map((inv) => `
      <div class="invoice-item" data-id="${inv._id}" onclick="openDetail('${inv._id}')">
        <div class="invoice-item-info">
          <div class="invoice-item-name">${escapeHtml(inv.partyName)}</div>
          <div class="invoice-item-meta">
            <span>📅 ${formatDate(inv.date)}</span>
            ${inv.quantity ? `<span>📊 ${fmtInt(inv.quantity)} m</span>` : ''}
            ${inv.fabricType ? `<span>🧵 ${escapeHtml(inv.fabricType)}</span>` : ''}
          </div>
        </div>
        <div class="invoice-item-cost">
          <div class="cost-value">${fmt(inv.totalCostMeter)}</div>
          <div class="cost-label">/ meter</div>
        </div>
        <div class="invoice-item-actions">
          <button class="btn btn-ghost btn-icon" onclick="event.stopPropagation(); openEditForm('${inv._id}')" title="Edit">✏️</button>
          <button class="btn btn-ghost btn-icon" onclick="event.stopPropagation(); deleteInvoice('${inv._id}')" title="Delete">🗑️</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Search & Filter listeners
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadInvoices();
  }, 300);
});

if ($('filterType')) {
  $('filterType').addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'date') {
      searchInput.placeholder = 'Search by date (e.g. 1 Aug 2026)...';
    } else if (val === 'qty') {
      searchInput.placeholder = 'Search by quantity (e.g. 40000)...';
    } else if (val === 'fabric') {
      searchInput.placeholder = 'Search by fabric or loom type...';
    } else {
      searchInput.placeholder = 'Search by party name...';
    }
    loadInvoices();
  });
}

if ($('sortBy')) {
  $('sortBy').addEventListener('change', () => loadInvoices());
}

// ═══════════════════════════════════════════════════════════
//  FORM (Create / Edit)
// ═══════════════════════════════════════════════════════════

function openNewForm() {
  editIdField.value = '';
  formTitle.textContent = 'New Invoice';
  invoiceForm.reset();
  $('date').value = toInputDate(new Date());
  updatePreview();
  showView(viewForm);
}

async function openEditForm(id) {
  try {
    const inv = await apiGet(`${API}/${id}`);
    editIdField.value = inv._id;
    formTitle.textContent = 'Edit Invoice';

    // Populate fields
    $('partyName').value = inv.partyName || '';
    $('date').value = toInputDate(inv.date);
    $('fabricType').value = inv.fabricType || '';
    $('loomType').value = inv.loomType || '';
    $('warpCount').value = inv.warpCount || '';
    $('warpCountAlt').value = inv.warpCountAlt || '';
    $('weftCount').value = inv.weftCount || '';
    $('weftCountAlt').value = inv.weftCountAlt || '';
    $('reed').value = inv.reed || '';
    $('pick').value = inv.pick || '';
    $('width').value = inv.width || '';
    $('widthCm').value = inv.widthCm || '';
    $('warpRate').value = inv.warpRate || '';
    $('weftRate').value = inv.weftRate || '';
    $('conversionRate').value = inv.conversionRate || '';
    $('quantity').value = inv.quantity || '';

    updatePreview();
    showView(viewForm);
  } catch (err) {
    toast(err.message, 'error');
  }
}

// Live calculation preview
function updatePreview() {
  const inputs = {};
  calcFields.forEach((f) => {
    inputs[f] = parseFloat($(f).value) || 0;
  });

  const r = calculate(inputs);

  $('preWarpWtY').textContent = fmt(r.warpWeightYard, 4);
  $('preWarpWtM').textContent = fmt(r.warpWeightMeter, 4);
  $('preWeftWtY').textContent = fmt(r.weftWeightYard, 4);
  $('preWeftWtM').textContent = fmt(r.weftWeightMeter, 4);
  $('preTotalWtY').textContent = fmt(r.totalWeightYard, 4);
  $('preTotalWtM').textContent = fmt(r.totalWeightMeter, 4);
  $('preWtMtrPY').textContent = fmt(r.weightPerMtrPYard, 4);
  $('preWtMtrPM').textContent = fmt(r.weightPerMtrPMeter, 4);
  $('preWtMtrGY').textContent = fmt(r.weightPerMtrGYard, 4);
  $('preWtMtrGM').textContent = fmt(r.weightPerMtrGMeter, 4);

  $('preGSM').textContent = fmt(r.gsm, 4);
  $('preOZ').textContent = fmt(r.ozPerSqYd, 4);

  $('preConvCost').textContent = fmt(r.conversionCost);
  $('preWarpCostY').textContent = fmt(r.warpCostYard);
  $('preWarpCostM').textContent = fmt(r.warpCostMeter);
  $('preWeftCostY').textContent = fmt(r.weftCostYard);
  $('preWeftCostM').textContent = fmt(r.weftCostMeter);
  $('preManfCostY').textContent = fmt(r.manfCostYard);
  $('preManfCostM').textContent = fmt(r.manfCostMeter);
  $('preTotalCostY').textContent = fmt(r.totalCostYard);
  $('preTotalCostM').textContent = fmt(r.totalCostMeter);

  $('preBagsWarp').textContent = fmt(r.yarnBagsWarp);
  $('preBagsWeft').textContent = fmt(r.yarnBagsWeft);
  $('preTotalBags').textContent = fmt(r.totalYarnBags);
  $('preFCL').textContent = fmtInt(r.qtyInFCL);
}

// Attach live calc listeners
calcFields.forEach((f) => {
  $(f).addEventListener('input', updatePreview);
});

// Submit form
invoiceForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {};
  allFields.forEach((f) => {
    const el = $(f);
    if (el.type === 'number') {
      data[f] = el.value ? parseFloat(el.value) : null;
    } else {
      data[f] = el.value || '';
    }
  });

  try {
    const id = editIdField.value;
    if (id) {
      await apiPut(`${API}/${id}`, data);
      toast('Invoice updated successfully');
    } else {
      await apiPost(API, data);
      toast('Invoice created successfully');
    }
    showView(viewDashboard);
    loadInvoices();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ═══════════════════════════════════════════════════════════
//  DETAIL VIEW
// ═══════════════════════════════════════════════════════════

async function openDetail(id) {
  try {
    const inv = await apiGet(`${API}/${id}`);
    currentInvoiceId = inv._id;

    detailContent.innerHTML = `
      <div class="detail-party">
        <div class="detail-party-name">${escapeHtml(inv.partyName)}</div>
        <div class="detail-meta">
          <span>📅 ${formatDate(inv.date)}</span>
          ${inv.fabricType ? `<span>🧵 ${escapeHtml(inv.fabricType)}</span>` : ''}
          ${inv.loomType ? `<span>🏭 ${escapeHtml(inv.loomType)}</span>` : ''}
        </div>
      </div>

      <!-- Single Card with Side-by-Side Specifications (Left) & Parameters (Right) -->
      <div class="detail-section">
        <div class="card">
          <div class="split-card-grid">
            
            <!-- Left Side: Specifications -->
            <div class="split-col">
              <div class="split-title">📋 Specifications</div>
              <table class="results-table">
                <thead>
                  <tr>
                    <th>Specification</th>
                    <th style="text-align: right;">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Warp Count</td><td>${inv.warpCount}${inv.warpCountAlt ? ' / ' + inv.warpCountAlt : ''}</td></tr>
                  <tr><td>Weft Count</td><td>${inv.weftCount}${inv.weftCountAlt ? ' / ' + inv.weftCountAlt : ''}</td></tr>
                  <tr><td>Reed</td><td>${inv.reed}</td></tr>
                  <tr><td>Pick</td><td>${inv.pick}</td></tr>
                  <tr><td>Width</td><td>${inv.width}"${inv.widthCm ? ' / ' + inv.widthCm + ' cm' : ''}</td></tr>
                  <tr><td>Warp Rate</td><td>${inv.warpRate}</td></tr>
                  <tr><td>Weft Rate</td><td>${inv.weftRate}</td></tr>
                  <tr><td>Conversion Rate / Pick</td><td>${inv.conversionRate}</td></tr>
                  <tr class="highlight-row"><td>Quantity</td><td class="highlight-val">${fmtInt(inv.quantity)} meters</td></tr>
                </tbody>
              </table>
            </div>

            <!-- Right Side: Calculated Parameters -->
            <div class="split-col">
              <div class="split-title">⚡ Calculated Parameters</div>
              <table class="results-table">
                <thead>
                  <tr>
                    <th class="col-param">Parameter</th>
                    <th class="col-yard">Yard</th>
                    <th class="col-meter">Meter</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="section-row"><td colspan="3">⚖️ Weight</td></tr>
                  <tr><td>Warp Weight</td><td>${fmt(inv.warpWeightYard, 4)}</td><td class="highlight-val">${fmt(inv.warpWeightMeter, 4)}</td></tr>
                  <tr><td>Weft Weight</td><td>${fmt(inv.weftWeightYard, 4)}</td><td class="highlight-val">${fmt(inv.weftWeightMeter, 4)}</td></tr>
                  <tr class="highlight-row"><td>Total Weight</td><td>${fmt(inv.totalWeightYard, 4)}</td><td class="highlight-val">${fmt(inv.totalWeightMeter, 4)}</td></tr>
                  <tr><td>Wt / Mtr (Pound)</td><td>${fmt(inv.weightPerMtrPYard, 4)}</td><td>${fmt(inv.weightPerMtrPMeter, 4)}</td></tr>
                  <tr><td>Wt / Mtr (Gram)</td><td>${fmt(inv.weightPerMtrGYard, 4)}</td><td>${fmt(inv.weightPerMtrGMeter, 4)}</td></tr>

                  <tr class="section-row"><td colspan="3">📐 Fabric Specs</td></tr>
                  <tr class="highlight-row"><td>GSM</td><td colspan="2" class="highlight-val">${fmt(inv.gsm, 4)}</td></tr>
                  <tr class="highlight-row"><td>OZ / SQ YD</td><td colspan="2" class="highlight-val">${fmt(inv.ozPerSqYd, 4)}</td></tr>

                  <tr class="section-row"><td colspan="3">💰 Costing</td></tr>
                  <tr><td>Conversion Cost</td><td colspan="2">${fmt(inv.conversionCost)}</td></tr>
                  <tr><td>Warp Cost</td><td>${fmt(inv.warpCostYard)}</td><td>${fmt(inv.warpCostMeter)}</td></tr>
                  <tr><td>Weft Cost</td><td>${fmt(inv.weftCostYard)}</td><td>${fmt(inv.weftCostMeter)}</td></tr>
                  <tr><td>Manufacturing Cost</td><td>${fmt(inv.manfCostYard)}</td><td>${fmt(inv.manfCostMeter)}</td></tr>
                  <tr class="total-row"><td>Total Fabric Cost</td><td>${fmt(inv.totalCostYard)}</td><td>${fmt(inv.totalCostMeter)}</td></tr>

                  <tr class="section-row"><td colspan="3">📦 Yarn &amp; Container</td></tr>
                  <tr><td>Yarn Bags (Warp)</td><td colspan="2">${fmt(inv.yarnBagsWarp)}</td></tr>
                  <tr><td>Yarn Bags (Weft)</td><td colspan="2">${fmt(inv.yarnBagsWeft)}</td></tr>
                  <tr class="highlight-row"><td>Total Yarn Bags</td><td colspan="2" class="highlight-val">${fmt(inv.totalYarnBags)}</td></tr>
                  <tr class="highlight-row"><td>Qty in 1 FCL</td><td colspan="2" class="highlight-val">${fmtInt(inv.qtyInFCL)}</td></tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    `;

    showView(viewDetail);
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════
//  SHARE
// ═══════════════════════════════════════════════════════════

// ── Share / Export PDF ──────────────────────────────────────
$('btnShare').addEventListener('click', async () => {
  if (!currentInvoiceId) return;

  try {
    const inv = await apiGet(`${API}/${currentInvoiceId}`);
    toast('Generating PDF document...', 'info');
    await shareInvoiceAsPDF(inv);
  } catch (err) {
    if (err.name !== 'AbortError') {
      toast('Failed to generate PDF: ' + err.message, 'error');
    }
  }
});

async function shareInvoiceAsPDF(inv) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  
  container.innerHTML = `
    <div style="padding: 24px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff; width: 720px; box-sizing: border-box;">
      
      <!-- Header Bar -->
      <div style="background: #0f172a; color: #ffffff; padding: 16px 20px; border-radius: 6px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #ffffff;">TEXTILE FABRIC COSTING SHEET</h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.95;">Party: <strong style="color: #60a5fa;">${escapeHtml(inv.partyName)}</strong></p>
        </div>
        <div style="text-align: right; font-size: 12px; opacity: 0.95; line-height: 1.5;">
          <div>📅 Date: <strong>${formatDate(inv.date)}</strong></div>
          ${inv.fabricType ? `<div>🧵 Fabric: <strong>${escapeHtml(inv.fabricType)}</strong></div>` : ''}
          ${inv.loomType ? `<div>🏭 Loom: <strong>${escapeHtml(inv.loomType)}</strong></div>` : ''}
        </div>
      </div>

      <!-- Content Grid: 2 Columns -->
      <div style="display: flex; gap: 16px; align-items: flex-start;">
        
        <!-- Left Column: Specifications -->
        <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
          <div style="background: #0f172a; color: #ffffff; padding: 8px 12px; font-size: 13px; font-weight: 700;">📋 Specifications</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tbody>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 6px 10px; font-weight: 600;">Warp Count</td><td style="padding: 6px 10px; text-align: right;">${inv.warpCount}${inv.warpCountAlt ? ' / ' + inv.warpCountAlt : ''}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 6px 10px; font-weight: 600;">Weft Count</td><td style="padding: 6px 10px; text-align: right;">${inv.weftCount}${inv.weftCountAlt ? ' / ' + inv.weftCountAlt : ''}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 6px 10px; font-weight: 600;">Reed</td><td style="padding: 6px 10px; text-align: right;">${inv.reed}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 6px 10px; font-weight: 600;">Pick</td><td style="padding: 6px 10px; text-align: right;">${inv.pick}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 6px 10px; font-weight: 600;">Width</td><td style="padding: 6px 10px; text-align: right;">${inv.width}"${inv.widthCm ? ' / ' + inv.widthCm + ' cm' : ''}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 6px 10px; font-weight: 600;">Warp Rate</td><td style="padding: 6px 10px; text-align: right;">${inv.warpRate}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 6px 10px; font-weight: 600;">Weft Rate</td><td style="padding: 6px 10px; text-align: right;">${inv.weftRate}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 6px 10px; font-weight: 600;">Conversion Rate / Pick</td><td style="padding: 6px 10px; text-align: right;">${inv.conversionRate}</td></tr>
              <tr style="background: #dbeafe;"><td style="padding: 8px 10px; font-weight: 700; color: #1e40af;">Quantity</td><td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #1e40af;">${fmtInt(inv.quantity)} m</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Right Column: Calculated Parameters -->
        <div style="flex: 1.35; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
          <div style="background: #0f172a; color: #ffffff; padding: 8px 12px; font-size: 13px; font-weight: 700;">⚡ Calculated Parameters</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
            <thead>
              <tr style="background: #0f172a; color: #ffffff; text-align: left;">
                <th style="padding: 6px 8px;">Parameter</th>
                <th style="padding: 6px 8px; text-align: right;">Yard</th>
                <th style="padding: 6px 8px; text-align: right;">Meter</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background: #0f172a; color: #ffffff; font-weight: 700;"><td colspan="3" style="padding: 5px 8px;">⚖️ Weight</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 4px 8px;">Warp Weight</td><td style="padding: 4px 8px; text-align: right;">${fmt(inv.warpWeightYard, 4)}</td><td style="padding: 4px 8px; text-align: right; background: #dbeafe; color: #1e40af; font-weight: 600;">${fmt(inv.warpWeightMeter, 4)}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 4px 8px;">Weft Weight</td><td style="padding: 4px 8px; text-align: right;">${fmt(inv.weftWeightYard, 4)}</td><td style="padding: 4px 8px; text-align: right; background: #dbeafe; color: #1e40af; font-weight: 600;">${fmt(inv.weftWeightMeter, 4)}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0; background: #f8fafc;"><td style="padding: 4px 8px; font-weight: 700;">Total Weight</td><td style="padding: 4px 8px; text-align: right; font-weight: 700;">${fmt(inv.totalWeightYard, 4)}</td><td style="padding: 4px 8px; text-align: right; background: #dbeafe; color: #1e40af; font-weight: 700;">${fmt(inv.totalWeightMeter, 4)}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 4px 8px;">Wt / Mtr (Pound)</td><td style="padding: 4px 8px; text-align: right;">${fmt(inv.weightPerMtrPYard, 4)}</td><td style="padding: 4px 8px; text-align: right;">${fmt(inv.weightPerMtrPMeter, 4)}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 4px 8px;">Wt / Mtr (Gram)</td><td style="padding: 4px 8px; text-align: right;">${fmt(inv.weightPerMtrGYard, 4)}</td><td style="padding: 4px 8px; text-align: right;">${fmt(inv.weightPerMtrGMeter, 4)}</td></tr>

              <tr style="background: #0f172a; color: #ffffff; font-weight: 700;"><td colspan="3" style="padding: 5px 8px;">📐 Fabric Specs</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0; background: #dbeafe;"><td style="padding: 4px 8px; font-weight: 700; color: #1e40af;">GSM</td><td colspan="2" style="padding: 4px 8px; text-align: right; font-weight: 700; color: #1e40af;">${fmt(inv.gsm, 4)}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0; background: #dbeafe;"><td style="padding: 4px 8px; font-weight: 700; color: #1e40af;">OZ / SQ YD</td><td colspan="2" style="padding: 4px 8px; text-align: right; font-weight: 700; color: #1e40af;">${fmt(inv.ozPerSqYd, 4)}</td></tr>

              <tr style="background: #0f172a; color: #ffffff; font-weight: 700;"><td colspan="3" style="padding: 5px 8px;">💰 Costing</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 4px 8px;">Conversion Cost</td><td colspan="2" style="padding: 4px 8px; text-align: right;">${fmt(inv.conversionCost)}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 4px 8px;">Warp Cost</td><td style="padding: 4px 8px; text-align: right;">${fmt(inv.warpCostYard)}</td><td style="padding: 4px 8px; text-align: right;">${fmt(inv.warpCostMeter)}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 4px 8px;">Weft Cost</td><td style="padding: 4px 8px; text-align: right;">${fmt(inv.weftCostYard)}</td><td style="padding: 4px 8px; text-align: right;">${fmt(inv.weftCostMeter)}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 4px 8px;">Manufacturing Cost</td><td style="padding: 4px 8px; text-align: right;">${fmt(inv.manfCostYard)}</td><td style="padding: 4px 8px; text-align: right;">${fmt(inv.manfCostMeter)}</td></tr>
              <tr style="background: #dbeafe; border-top: 1.5px solid #1e40af; border-bottom: 1.5px solid #1e40af;"><td style="padding: 6px 8px; font-weight: 800; color: #0f172a;">Total Fabric Cost</td><td style="padding: 6px 8px; text-align: right; font-weight: 800; color: #0369a1;">${fmt(inv.totalCostYard)}</td><td style="padding: 6px 8px; text-align: right; font-weight: 800; color: #1e40af;">${fmt(inv.totalCostMeter)}</td></tr>

              <tr style="background: #0f172a; color: #ffffff; font-weight: 700;"><td colspan="3" style="padding: 5px 8px;">📦 Yarn &amp; Container</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 4px 8px;">Yarn Bags (Warp)</td><td colspan="2" style="padding: 4px 8px; text-align: right;">${fmt(inv.yarnBagsWarp)}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 4px 8px;">Yarn Bags (Weft)</td><td colspan="2" style="padding: 4px 8px; text-align: right;">${fmt(inv.yarnBagsWeft)}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0; background: #dbeafe;"><td style="padding: 4px 8px; font-weight: 700; color: #1e40af;">Total Yarn Bags</td><td colspan="2" style="padding: 4px 8px; text-align: right; font-weight: 700; color: #1e40af;">${fmt(inv.totalYarnBags)}</td></tr>
              <tr style="background: #dbeafe;"><td style="padding: 4px 8px; font-weight: 700; color: #1e40af;">Qty in 1 FCL</td><td colspan="2" style="padding: 4px 8px; text-align: right; font-weight: 700; color: #1e40af;">${fmtInt(inv.qtyInFCL)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer -->
      <div style="margin-top: 16px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 11px; color: #94a3b8;">
        Generated by Textile Costing Application · Developed by HU-Software Solutions
      </div>
    </div>
  `;

  document.body.appendChild(container);

  const cleanParty = (inv.partyName || 'Invoice').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanDate = formatDate(inv.date).replace(/\s+/g, '_');
  const fileName = `Costing_${cleanParty}_${cleanDate}.pdf`;

  const opt = {
    margin:       10,
    filename:     fileName,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    if (typeof html2pdf !== 'undefined') {
      const pdfWorker = html2pdf().set(opt).from(container.firstElementChild);
      const pdfBlob = await pdfWorker.output('blob');
      
      if (container.parentNode) document.body.removeChild(container);

      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Web Share API for Mobile PDF sharing (WhatsApp, Telegram, Email, etc.)
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            files: [pdfFile],
            title: `Costing Sheet - ${inv.partyName}`,
            text: `Fabric Costing Sheet for ${inv.partyName}`,
          });
          toast('Shared PDF successfully!', 'success');
          return;
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') return;
        }
      }

      // Desktop / Browser fallback: download PDF file directly
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast('Downloaded PDF successfully!', 'success');
    } else {
      if (container.parentNode) document.body.removeChild(container);
      window.print();
    }
  } catch (err) {
    if (container.parentNode) document.body.removeChild(container);
    toast('PDF generation failed: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════
//  DELETE
// ═══════════════════════════════════════════════════════════

function deleteInvoice(id) {
  showConfirm(
    'Delete Invoice',
    'Are you sure you want to delete this invoice? This action cannot be undone.',
    async () => {
      try {
        await apiDelete(`${API}/${id}`);
        toast('Invoice deleted');
        if (currentInvoiceId === id) {
          showView(viewDashboard);
        }
        loadInvoices(searchInput.value.trim());
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  );
}

$('btnDelete').addEventListener('click', () => {
  if (currentInvoiceId) deleteInvoice(currentInvoiceId);
});

// ═══════════════════════════════════════════════════════════
//  EXPORT / IMPORT
// ═══════════════════════════════════════════════════════════

$('btnExport').addEventListener('click', async () => {
  try {
    const invoices = await apiGet(API);
    const blob = new Blob([JSON.stringify(invoices, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `costing-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${invoices.length} invoices`);
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('btnImportTrigger').addEventListener('click', () => {
  $('importFile').click();
});

$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const invoices = JSON.parse(text);
    if (!Array.isArray(invoices)) throw new Error('Invalid backup file');

    let imported = 0;
    for (const inv of invoices) {
      const { _id, __v, createdAt, updatedAt, ...data } = inv;
      await apiPost(API, data);
      imported++;
    }

    toast(`Imported ${imported} invoices`);
    loadInvoices();
  } catch (err) {
    toast(`Import failed: ${err.message}`, 'error');
  }

  e.target.value = '';
});

// ═══════════════════════════════════════════════════════════
//  NAVIGATION HANDLERS
// ═══════════════════════════════════════════════════════════

$('headerBrand').addEventListener('click', () => {
  showView(viewDashboard);
  loadInvoices();
});

$('btnNewInvoice').addEventListener('click', openNewForm);

$('btnFormBack').addEventListener('click', () => {
  showView(viewDashboard);
  loadInvoices();
});

$('btnFormCancel').addEventListener('click', () => {
  showView(viewDashboard);
  loadInvoices();
});

$('btnDetailBack').addEventListener('click', () => {
  showView(viewDashboard);
  loadInvoices();
});

$('btnEdit').addEventListener('click', () => {
  if (currentInvoiceId) openEditForm(currentInvoiceId);
});

// Make functions available globally for inline onclick handlers
window.openNewForm = openNewForm;
window.openEditForm = openEditForm;
window.openDetail = openDetail;
window.deleteInvoice = deleteInvoice;

// ═══════════════════════════════════════════════════════════
//  BOTTOM TAB NAVIGATION
// ═══════════════════════════════════════════════════════════

if ($('tabCosting')) {
  $('tabCosting').addEventListener('click', () => {
    if ($('searchInput')) $('searchInput').value = '';
    showView(viewDashboard);
    loadInvoices();
  });
}

const tabGazana = $('tabGazana') || $('tabYarn');
if (tabGazana) {
  tabGazana.addEventListener('click', () => {
    if ($('gazanaSearchInput')) $('gazanaSearchInput').value = '';
    showView(viewPartyGazanaDashboard);
    loadGazanaDashboard();
  });
}

// ═══════════════════════════════════════════════════════════
//  YARN STOCK — DASHBOARD (All Parties from Invoices & Yarn)
// ═══════════════════════════════════════════════════════════

async function loadYarnStock(search = '') {
  try {
    const [stock, invoices] = await Promise.all([
      apiGet(`${YARN_API}/stock`).catch(() => []),
      apiGet(API).catch(() => []),
    ]);

    const partyMap = new Map();

    if (Array.isArray(invoices)) {
      invoices.forEach(i => {
        if (i.partyName && i.partyName.trim()) {
          const norm = i.partyName.trim().toLowerCase();
          if (!partyMap.has(norm)) {
            partyMap.set(norm, {
              partyName: i.partyName.trim(),
              partyNameNorm: norm,
            });
          }
        }
      });
    }

    if (Array.isArray(stock)) {
      stock.forEach(s => {
        if (s.partyNameNorm) {
          partyMap.set(s.partyNameNorm, s);
        }
      });
    }

    let displayList = Array.from(partyMap.values()).sort((a, b) => a.partyName.localeCompare(b.partyName));

    if (search) {
      const term = search.toLowerCase();
      displayList = displayList.filter(s => s.partyName.toLowerCase().includes(term));
    }

    $('yarnPartyCount').textContent = `(${displayList.length})`;

    if (displayList.length === 0) {
      $('yarnStockGrid').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏢</div>
          <p>${search ? 'No parties match your search.' : 'No party entered yet. Start by issuing yarn or creating an invoice!'}</p>
          ${!search ? '<button class="btn btn-primary" onclick="openYarnForm()">＋ Issue Yarn</button>' : ''}
        </div>
      `;
      return;
    }

    $('yarnStockGrid').innerHTML = `
      <div class="party-list-container">
        ${displayList.map(s => `
          <div class="party-card" onclick="openYarnHistory('${encodeURIComponent(s.partyNameNorm)}', '${escapeHtml(s.partyName)}')">
            <div class="party-card-info">
              <span class="party-icon">🏢</span>
              <span class="party-name-text">${escapeHtml(s.partyName)}</span>
            </div>
            <div class="party-card-action">
              <span class="view-link">View Details ➔</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    toast(err.message, 'error');
  }
}

// Yarn search listener
if ($('yarnSearchInput')) {
  $('yarnSearchInput').addEventListener('input', () => {
    clearTimeout(yarnSearchTimeout);
    yarnSearchTimeout = setTimeout(() => {
      loadYarnStock($('yarnSearchInput').value.trim());
    }, 300);
  });
}

// ═══════════════════════════════════════════════════════════
//  YARN STOCK — ISSUE FORM & PARTY AUTO-COMPLETE
// ═══════════════════════════════════════════════════════════

function toTitleCase(str) {
  if (!str) return '';
  return str.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function escapeRegex(str) {
  return (str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMatches(text, query) {
  if (!text) return '';
  if (!query || !query.trim()) return escapeHtml(text);
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return escapeHtml(text);

  const pattern = new RegExp(`(${tokens.map(t => escapeRegex(t)).join('|')})`, 'gi');
  return text.split(pattern).map(chunk => {
    if (!chunk) return '';
    const isMatch = tokens.some(t => chunk.toLowerCase() === t.toLowerCase());
    if (isMatch) {
      return `<strong style="color: #2563eb; font-weight: 800; text-decoration: underline;">${escapeHtml(chunk)}</strong>`;
    }
    return escapeHtml(chunk);
  }).join('');
}

// ── Party Code Helper (e.g. "Ali Nadeem" Khata #12 -> "A12", "786 Mills" Khata #15 -> "B15")
function generatePartyCode(name, khataNo) {
  const clean = (name || '').trim();
  const first = clean.charAt(0);
  const prefix = /^[a-zA-Z]$/.test(first) ? first.toUpperCase() : 'B';
  return `${prefix}${khataNo || ''}`;
}

function getPartyCode(party, khataNo) {
  if (party && typeof party === 'object') {
    if (party.code) return party.code;
    return generatePartyCode(party.name || party.partyName, party.khataNo);
  }
  return generatePartyCode(party, khataNo);
}

// ── Multi-Tier Ranking Search for Party Autocomplete ─────────
function rankPartyMatches(partiesList, query) {
  if (!query) return [];
  const rawQ = query.trim();
  if (!rawQ) return [];
  const q = rawQ.toLowerCase();
  const qTokens = q.split(/\s+/).filter(Boolean);

  const exactMatches = [];
  const startsWithMatches = [];
  const wordStartsWithMatches = [];
  const multiTokenMatches = [];
  const khataMatches = [];
  const substringMatches = [];

  for (const party of partiesList) {
    const name = typeof party === 'string' ? party : (party.name || party.partyName || '');
    if (!name) continue;
    const lower = name.toLowerCase();

    // 0. Exact or partial party code match (e.g. typing "A12", "B15")
    const pCode = (party && party.code) ? String(party.code).toLowerCase() : (party && party.khataNo ? generatePartyCode(name, party.khataNo).toLowerCase() : '');
    if (pCode && pCode === q) {
      exactMatches.push({ party, name, score: 1200 });
      continue;
    }
    if (pCode && pCode.startsWith(q) && q.length >= 2) {
      startsWithMatches.push({ party, name, score: 950 - pCode.length });
      continue;
    }

    // 1. Exact match (e.g. user typed "N" and party name is "N")
    if (lower === q) {
      exactMatches.push({ party, name, score: 1000 });
      continue;
    }

    // 2. Starts with entire query (e.g. "N" -> "N.A", "Nadia", "Nabeel", "Nadeem")
    if (lower.startsWith(q)) {
      startsWithMatches.push({ party, name, score: 800 - name.length });
      continue;
    }

    // 3. Word starts with entire query (word boundary: after space, hyphen, slash, dot, bracket, #)
    const wordBoundaryRegex = new RegExp(`(?:^|[\\s\\-_/.#(])${escapeRegex(q)}`, 'i');
    const wordMatch = lower.search(wordBoundaryRegex);
    if (wordMatch !== -1) {
      wordStartsWithMatches.push({ party, name, score: 500 - wordMatch * 5 - name.length });
      continue;
    }

    // 4. Multi-token match (e.g. "kusar p" -> matches "Kusar Print")
    if (qTokens.length > 1) {
      const allTokensMatch = qTokens.every(token => {
        const tokenRegex = new RegExp(`(?:^|[\\s\\-_/.#(])${escapeRegex(token)}`, 'i');
        return tokenRegex.test(lower) || lower.includes(token);
      });
      if (allTokensMatch) {
        multiTokenMatches.push({ party, name, score: 400 - name.length });
        continue;
      }
    }

    // 5. Khata number match if applicable (e.g. typing "17" finds Khata #17)
    const khataStr = (party && party.khataNo) ? String(party.khataNo) : '';
    const cleanNum = rawQ.replace(/^#/, '');
    if (khataStr && (khataStr === cleanNum || khataStr.startsWith(cleanNum))) {
      khataMatches.push({ party, name, score: 350 - name.length });
      continue;
    }

    // 6. General substring match
    const subIdx = lower.indexOf(q);
    if (subIdx !== -1) {
      substringMatches.push({ party, name, score: 200 - subIdx * 5 - name.length });
      continue;
    }
  }

  // Sort each bucket:
  // Starts with query: shorter names first, then alphabetical
  startsWithMatches.sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name));
  wordStartsWithMatches.sort((a, b) => b.score - a.score || a.name.length - b.name.length || a.name.localeCompare(b.name));
  multiTokenMatches.sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name));
  khataMatches.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  substringMatches.sort((a, b) => b.score - a.score || a.name.length - b.name.length || a.name.localeCompare(b.name));

  return [
    ...exactMatches,
    ...startsWithMatches,
    ...wordStartsWithMatches,
    ...multiTokenMatches,
    ...khataMatches,
    ...substringMatches
  ].map(r => r.party);
}

// ── Mobile & Desktop Live Party Suggestion Controller ───────
let allKnownPartiesList = [];
try {
  const cachedParties = localStorage.getItem('cached_known_parties');
  if (cachedParties) {
    allKnownPartiesList = JSON.parse(cachedParties);
  }
} catch (e) {}

async function populatePartyNamesDatalist() {
  try {
    const datalist = $('partyNamesDatalist');
    const cbDatalist = $('cbPartyDatalist');
    const yarnFormPartySelect = $('yarnPartySelectDropdown');
    const contractFormPartySelect = $('contractPartySelectDropdown');
    const formGazanaPartySelect = $('formGazanaPartyDropdown');

    const [stock, invoices, cbParties, gazanaParties, gazanaEntriesRes] = await Promise.all([
      apiGet(`${YARN_API}/stock`).catch(() => []),
      apiGet(API).catch(() => []),
      apiGet(`${CB_API}/parties`).catch(() => []),
      apiGet(`${PARTY_ENTRIES_API}/parties`).catch(() => []),
      apiGet(PARTY_ENTRIES_API).catch(() => ({ entries: [] }))
    ]);

    const partyMap = new Map();
    const addParty = (rawName, khataNo = null, code = '') => {
      if (!rawName || !rawName.trim()) return;
      const cleanName = rawName.trim();
      const norm = cleanName.toLowerCase();
      const partyCode = code || (khataNo ? generatePartyCode(cleanName, khataNo) : '');
      if (!partyMap.has(norm)) {
        partyMap.set(norm, { name: cleanName, khataNo: khataNo || null, code: partyCode });
      } else {
        const item = partyMap.get(norm);
        if (khataNo && !item.khataNo) item.khataNo = khataNo;
        if (partyCode && !item.code) item.code = partyCode;
      }
    };

    if (Array.isArray(cbParties)) {
      cbParties.forEach(p => addParty(p.name, p.khataNo, p.code));
    }
    if (Array.isArray(gazanaParties)) {
      gazanaParties.forEach(p => addParty(p.partyName));
    }
    if (Array.isArray(stock)) stock.forEach(s => addParty(s.partyName));
    if (Array.isArray(invoices)) invoices.forEach(i => addParty(i.partyName));
    if (Array.isArray(gazanaEntriesRes?.entries)) {
      gazanaEntriesRes.entries.forEach(e => {
        if (e.gudaam) addParty(e.gudaam);
        if (e.loomWala) addParty(e.loomWala);
        if (e.purchaser) addParty(e.purchaser);
      });
    }

    addParty('Daily Entries');
    const sortedParties = Array.from(partyMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    allKnownPartiesList = sortedParties;
    try {
      localStorage.setItem('cached_known_parties', JSON.stringify(sortedParties));
    } catch (e) {}

    const optionsHtml = sortedParties.map(p => `<option value="${escapeHtml(p.name)}">${p.code ? `[${p.code}] ` : (p.khataNo ? `Khata #${p.khataNo} · ` : '')}${escapeHtml(p.name)}</option>`).join('');

    if (datalist) datalist.innerHTML = optionsHtml;
    if (cbDatalist) cbDatalist.innerHTML = optionsHtml;

    const selectOptionsHtml = '<option value="">-- Choose Party from Cashbook --</option>' +
      sortedParties.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}${p.code ? ` (${p.code})` : (p.khataNo ? ` (Khata #${p.khataNo})` : '')}</option>`).join('');

    if (yarnFormPartySelect) yarnFormPartySelect.innerHTML = selectOptionsHtml;
    if (contractFormPartySelect) contractFormPartySelect.innerHTML = selectOptionsHtml;
  } catch (err) {
    // silent fallback
  }
}
window.loadAllPartiesSuggestions = populatePartyNamesDatalist;

function setupPartyAutocomplete(inputId, dropdownId) {
  const input = $(inputId);
  const dropdown = $(dropdownId);
  if (!input || !dropdown) return;

  let activeIndex = -1;
  let currentMatches = [];
  let originalTypedValue = '';
  let isInteractingWithDropdown = false;
  let touchStartY = 0;
  let touchStartX = 0;
  let isTouchMoved = false;

  const renderSuggestions = async (query, showAllIfEmpty = false) => {
    const rawQ = (query || '').trim();
    activeIndex = -1;

    // Do NOT show popup if empty unless showAllIfEmpty is true (e.g. user pressed ArrowDown)
    if (!rawQ && !showAllIfEmpty) {
      currentMatches = [];
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }

    // If cache not loaded yet, fetch immediately
    if (!allKnownPartiesList || allKnownPartiesList.length === 0) {
      await populatePartyNamesDatalist();
    }

    if (!rawQ && showAllIfEmpty) {
      currentMatches = (allKnownPartiesList || []).slice(0, 40);
    } else {
      currentMatches = rankPartyMatches(allKnownPartiesList || [], rawQ).slice(0, 40);
    }

    if (currentMatches.length === 0) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }

    const itemIcon = inputId === 'formGazanaGudaam' ? '🏬' : '👤';
    dropdown.innerHTML = currentMatches.map((item, idx) => {
      const name = typeof item === 'string' ? item : item.name;
      const khataNo = (item && item.khataNo) ? item.khataNo : null;
      const pCode = (item && item.code) ? item.code : (khataNo ? generatePartyCode(name, khataNo) : null);
      const codeBadge = pCode ? `<span class="party-code-badge" style="font-size: 0.72rem; font-weight: 800; color: #1e40af; background: #dbeafe; padding: 2px 6px; border-radius: 4px; flex-shrink: 0;">${pCode}</span>` : '';
      const khataBadge = khataNo ? `<span class="party-khata-badge" style="font-size: 0.72rem; font-weight: 700; color: #475569; background: #e2e8f0; padding: 2px 7px; border-radius: 4px; flex-shrink: 0;">#${khataNo}</span>` : '';
      return `
        <div class="party-suggestion-item" data-index="${idx}" data-name="${escapeHtml(name)}" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; pointer-events: none;">
            <span style="font-size: 1rem; flex-shrink: 0;">${itemIcon}</span>
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${highlightMatches(name, rawQ)}</span>
          </div>
          <div style="display: flex; gap: 4px; align-items: center;">
            ${codeBadge}
            ${khataBadge}
          </div>
        </div>
      `;
    }).join('');

    dropdown.style.display = 'block';
  };

  const updateActiveItem = (newIndex) => {
    const items = dropdown.querySelectorAll('.party-suggestion-item');
    items.forEach(el => el.classList.remove('active'));

    if (newIndex >= 0 && newIndex < items.length) {
      activeIndex = newIndex;
      const activeEl = items[newIndex];
      activeEl.classList.add('active');
      activeEl.scrollIntoView({ block: 'nearest' });

      // Put the selected party name directly into the input
      if (currentMatches[newIndex]) {
        const item = currentMatches[newIndex];
        input.value = typeof item === 'string' ? item : item.name;
      }
    } else if (newIndex === -1) {
      activeIndex = -1;
      input.value = originalTypedValue;
    }
  };

  // Touch & Scroll listeners for mobile touchscreens
  dropdown.addEventListener('touchstart', (e) => {
    isInteractingWithDropdown = true;
    if (e.touches && e.touches[0]) {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
      isTouchMoved = false;
    }
  }, { passive: true });

  dropdown.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      const diffY = Math.abs(e.touches[0].clientY - touchStartY);
      const diffX = Math.abs(e.touches[0].clientX - touchStartX);
      if (diffY > 6 || diffX > 6) {
        isTouchMoved = true;
      }
    }
  }, { passive: true });

  dropdown.addEventListener('touchend', (e) => {
    setTimeout(() => { isInteractingWithDropdown = false; }, 350);
    if (isTouchMoved) return; // User was scrolling, do not trigger selection

    const item = e.target.closest('.party-suggestion-item');
    if (item) {
      const name = item.getAttribute('data-name');
      if (name) {
        e.preventDefault();
        selectPartyForInput(inputId, dropdownId, name);
      }
    }
  });

  // Desktop Mouse click & mousedown
  dropdown.addEventListener('mousedown', (e) => {
    isInteractingWithDropdown = true;
    const item = e.target.closest('.party-suggestion-item');
    if (item) {
      e.preventDefault(); // Prevents input blur on desktop
      const name = item.getAttribute('data-name');
      if (name) {
        selectPartyForInput(inputId, dropdownId, name);
      }
    }
  });

  dropdown.addEventListener('mouseup', () => {
    setTimeout(() => { isInteractingWithDropdown = false; }, 350);
  });

  input.addEventListener('input', (e) => {
    originalTypedValue = e.target.value;
    renderSuggestions(e.target.value, false);
  });

  input.addEventListener('focus', () => {
    if (input.value && input.value.trim()) {
      originalTypedValue = input.value;
      renderSuggestions(input.value, false);
    }
  });

  input.addEventListener('keydown', (e) => {
    const isVisible = dropdown.style.display !== 'none' && currentMatches.length > 0;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (!isVisible) {
        renderSuggestions(input.value, true);
        if (currentMatches.length > 0) {
          updateActiveItem(0);
        }
      } else {
        const nextIndex = (activeIndex < currentMatches.length - 1) ? activeIndex + 1 : 0;
        updateActiveItem(nextIndex);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (isVisible) {
        const prevIndex = (activeIndex > 0) ? activeIndex - 1 : currentMatches.length - 1;
        updateActiveItem(prevIndex);
      }
      return;
    }

    if (isVisible) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (activeIndex >= 0 && currentMatches[activeIndex]) {
          e.preventDefault();
          e.stopPropagation();
          const selected = currentMatches[activeIndex];
          const name = typeof selected === 'string' ? selected : selected.name;
          selectPartyForInput(inputId, dropdownId, name);
          return;
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        dropdown.style.display = 'none';
        input.value = originalTypedValue;
        return;
      }
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (!isInteractingWithDropdown) {
        dropdown.style.display = 'none';
      }
    }, 250);
  });

  document.addEventListener('pointerdown', (e) => {
    if (e.target !== input && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

function selectPartyForInput(inputId, dropdownId, name) {
  const input = $(inputId);
  const dropdown = $(dropdownId);
  const actualName = (typeof name === 'object' && name) ? name.name : name;
  if (input) {
    input.value = actualName;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (dropdown) {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
  }
}
window.selectPartyForInput = selectPartyForInput;

// Aliases for backwards compatibility
window.selectGazanaPartySuggestion = (name) => selectPartyForInput('formGazanaPartyName', 'formGazanaPartySuggestions', name);

// Initialize party autocomplete for Banaam Party, Loom Wala, Purchaser, Gudaam, and Cashbook Roker entry
setupPartyAutocomplete('formGazanaPartyName', 'formGazanaPartySuggestions');
setupPartyAutocomplete('formGazanaLoomWala', 'formGazanaLoomWalaSuggestions');
setupPartyAutocomplete('formGazanaPurchaser', 'formGazanaPurchaserSuggestions');
setupPartyAutocomplete('formGazanaGudaam', 'formGazanaGudaamSuggestions');
setupPartyAutocomplete('entryPartyName', 'entryPartySuggestions');

if ($('yarnPartySelectDropdown')) {
  $('yarnPartySelectDropdown').addEventListener('change', () => {
    const val = $('yarnPartySelectDropdown').value;
    if (val) {
      $('yarnPartyName').value = val;
      loadPartyContracts(val);
    }
  });
}

if ($('contractPartySelectDropdown')) {
  $('contractPartySelectDropdown').addEventListener('change', () => {
    const val = $('contractPartySelectDropdown').value;
    if (val) {
      $('partyName').value = val;
    }
  });
}

let editingYarnId = null;

async function loadPartyContracts(partyName, selectedContractId = null) {
  const select = $('yarnContractSelect');
  if (!select) return;
  select.innerHTML = '<option value="">-- Select Contract --</option>';
  if (!partyName || !partyName.trim()) return;

  try {
    const partyNorm = partyName.trim().toLowerCase();
    const contracts = await apiGet(`${YARN_API}/contracts/${encodeURIComponent(partyNorm)}`);
    if (Array.isArray(contracts) && contracts.length > 0) {
      contracts.forEach((c, idx) => {
        const opt = document.createElement('option');
        opt.value = c._id;
        opt.dataset.shortTitle = c.shortTitle || c.title || c.label;
        opt.textContent = c.label;
        if (selectedContractId) {
          if (c._id.toString() === selectedContractId.toString()) opt.selected = true;
        } else if (idx === 0) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
    }
  } catch (e) {
    // silent fallback
  }
}

if ($('yarnPartyName')) {
  $('yarnPartyName').addEventListener('input', () => {
    loadPartyContracts($('yarnPartyName').value.trim());
  });
  $('yarnPartyName').addEventListener('change', () => {
    loadPartyContracts($('yarnPartyName').value.trim());
  });
}

function openYarnForm(partyNamePreFill = '', editRecord = null) {
  $('yarnForm').reset();
  populatePartyNamesDatalist();

  const partyDropdown = $('yarnPartySelectDropdown');

  if (editRecord) {
    editingYarnId = editRecord._id;
    $('yarnFormTitle').textContent = 'Edit Yarn Issuance';
    if (partyDropdown) partyDropdown.style.display = 'none';
    $('yarnPartyName').value = editRecord.partyName || partyNamePreFill;
    $('yarnDate').value = toInputDate(editRecord.date || new Date());
    $('yarnWarpBags').value = editRecord.warpBags || '';
    $('yarnWarpQuality').value = editRecord.warpQuality || '';
    $('yarnWeftBags').value = editRecord.weftBags || '';
    $('yarnWeftQuality').value = editRecord.weftQuality || '';
    $('yarnNote').value = editRecord.note || '';
  } else {
    editingYarnId = null;
    $('yarnFormTitle').textContent = partyNamePreFill ? `Issue Yarn — ${partyNamePreFill}` : 'Issue Yarn';
    $('yarnDate').value = toInputDate(new Date());
    if (partyNamePreFill) {
      if (partyDropdown) partyDropdown.style.display = 'none';
      $('yarnPartyName').value = partyNamePreFill;
    } else {
      if (partyDropdown) partyDropdown.style.display = 'block';
    }
  }

  showView(viewYarnForm);
}

  if ($('btnNewYarnIssue')) $('btnNewYarnIssue').addEventListener('click', () => openYarnForm(''));

  if ($('btnYarnFormBack')) {
    $('btnYarnFormBack').addEventListener('click', () => {
      editingYarnId = null;
      if (currentHistoryPartyName && currentHistoryPartyNorm) {
        openYarnHistory(encodeURIComponent(currentHistoryPartyNorm), currentHistoryPartyName);
      } else if (typeof viewYarnDashboard !== 'undefined' && viewYarnDashboard) {
        showView(viewYarnDashboard);
        loadYarnStock();
      }
    });
  }

  if ($('btnYarnFormCancel')) {
    $('btnYarnFormCancel').addEventListener('click', () => {
      editingYarnId = null;
      if (currentHistoryPartyName && currentHistoryPartyNorm) {
        openYarnHistory(encodeURIComponent(currentHistoryPartyNorm), currentHistoryPartyName);
      } else if (typeof viewYarnDashboard !== 'undefined' && viewYarnDashboard) {
        showView(viewYarnDashboard);
        loadYarnStock();
      }
    });
  }

  if ($('yarnForm')) {
    $('yarnForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const partyName = $('yarnPartyName').value.trim();
  if (!partyName) {
    toast('Party name is required', 'error');
    return;
  }

  const warpBags = parseFloat($('yarnWarpBags').value) || 0;
  const weftBags = parseFloat($('yarnWeftBags').value) || 0;

  if (warpBags <= 0 && weftBags <= 0) {
    toast('Enter at least warp or weft bags', 'error');
    return;
  }

  const data = {
    partyName,
    date: $('yarnDate').value || toInputDate(new Date()),
    warpBags,
    weftBags,
    warpQuality: $('yarnWarpQuality').value.trim(),
    weftQuality: $('yarnWeftQuality').value.trim(),
    note: $('yarnNote').value.trim(),
  };

  try {
    if (editingYarnId) {
      await apiPut(`${YARN_API}/${editingYarnId}`, data);
      toast('Yarn issuance updated successfully!');
    } else {
      await apiPost(YARN_API, data);
      toast('Yarn issued successfully!');
    }

    editingYarnId = null;
    const norm = partyName.toLowerCase();
    if (currentHistoryPartyNorm === norm) {
      openYarnHistory(encodeURIComponent(currentHistoryPartyNorm), currentHistoryPartyName);
    } else {
      showView(viewYarnDashboard);
      loadYarnStock();
    }
  } catch (err) {
    toast(err.message, 'error');
  }
});
}

// ═══════════════════════════════════════════════════════════
//  YARN STOCK — PARTY HISTORY VIEW
// ═══════════════════════════════════════════════════════════

async function openYarnHistory(partyNormEncoded, partyDisplayName) {
  const partyNorm = decodeURIComponent(partyNormEncoded);
  currentHistoryPartyName = partyDisplayName;
  currentHistoryPartyNorm = partyNorm;

  $('yarnHistoryTitle').textContent = `${partyDisplayName} — Yarn History`;

  try {
    const records = await apiGet(`${YARN_API}/history/${encodeURIComponent(partyNorm)}`);

    if (!Array.isArray(records) || records.length === 0) {
      $('yarnHistoryContent').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🧶</div>
          <p>No yarn issuance or contract records found for ${escapeHtml(partyDisplayName)}.</p>
        </div>
      `;
      showView(viewYarnHistory);
      return;
    }

    const latestRemW = records[0]?.remainingWarp ?? 0;
    const latestRemF = records[0]?.remainingWeft ?? 0;
    const latestRemT = records[0]?.remainingTotal ?? (latestRemW + latestRemF);
    const contractInfo = records[0]?.contractInfo || 'Contract';

    $('yarnHistoryContent').innerHTML = `
      <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 0.75rem; padding: 0 4px; gap: 8px; flex-wrap: wrap;">
        <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--accent-navy); margin: 0;">
          📜 ${escapeHtml(contractInfo)}
        </h3>
        <span style="font-size: 0.8125rem; font-weight: 700; color: ${latestRemT === 0 ? 'var(--success)' : 'var(--accent-primary)'};">
          Remaining: ${fmt(latestRemW)}W / ${fmt(latestRemF)}F (${fmt(latestRemT)} Total)
        </span>
      </div>

      <div class="yarn-table-wrapper">
        <table class="yarn-datagrid-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Quality</th>
              <th>Warp</th>
              <th>Weft</th>
              <th>Rem. W</th>
              <th>Rem. F</th>
              <th>Rem. Tot</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${records.map(r => {
              const warp = r.warpBags || 0;
              const weft = r.weftBags || 0;
              const qParts = [];
              if (r.warpQuality && r.warpQuality.trim()) qParts.push(r.warpQuality.trim());
              if (r.weftQuality && r.weftQuality.trim() && r.weftQuality.trim() !== (r.warpQuality || '').trim()) {
                qParts.push(r.weftQuality.trim());
              }
              const qualityStr = qParts.join(' / ') || '—';
              const isIssue = r.type === 'issue';
              const sign = isIssue ? '−' : '';
              const remW = r.remainingWarp ?? 0;
              const remF = r.remainingWeft ?? 0;
              const remT = r.remainingTotal ?? (remW + remF);

              return `
                <tr class="${isIssue ? 'row-issue' : 'row-deduction'}">
                  <td>${formatDate(r.date)}</td>
                  <td class="col-quality" title="${escapeHtml(qualityStr)}">${escapeHtml(qualityStr)}</td>
                  <td class="${isIssue ? 'stock-neg' : ''}">${sign}${fmt(warp)}</td>
                  <td class="${isIssue ? 'stock-neg' : ''}">${sign}${fmt(weft)}</td>
                  <td><strong>${fmt(remW)}</strong></td>
                  <td><strong>${fmt(remF)}</strong></td>
                  <td><strong>${fmt(remT)}</strong></td>
                  <td>
                    ${isIssue ? `
                      <button class="btn-action edit" onclick="editYarnRecord('${r._id}')" title="Edit Issuance">✏️</button>
                      <button class="btn-action delete" onclick="deleteYarnRecord('${r._id}')" title="Delete Issuance">🗑️</button>
                    ` : '—'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr class="datagrid-summary-row">
              <td colspan="4"><strong>Contract Balance Remaining</strong></td>
              <td class="${latestRemW === 0 ? 'stock-pos' : ''}"><strong>${fmt(latestRemW)}</strong></td>
              <td class="${latestRemF === 0 ? 'stock-pos' : ''}"><strong>${fmt(latestRemF)}</strong></td>
              <td class="${latestRemT === 0 ? 'stock-pos' : ''}"><strong>${fmt(latestRemT)}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    showView(viewYarnHistory);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function editYarnRecord(id) {
  try {
    const record = await apiGet(`${YARN_API}/${id}`);
    if (record) {
      openYarnForm(record.partyName, record);
    }
  } catch (err) {
    toast('Failed to load issuance details', 'error');
  }
}

async function deleteYarnRecord(id) {
  if (!confirm('Are you sure you want to delete this yarn issuance record?')) return;
  try {
    await apiDelete(`${YARN_API}/${id}`);
    toast('Yarn issuance deleted');
    if (currentHistoryPartyName && currentHistoryPartyNorm) {
      openYarnHistory(encodeURIComponent(currentHistoryPartyNorm), currentHistoryPartyName);
    } else {
      showView(viewYarnDashboard);
      loadYarnStock();
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

if ($('btnYarnHistoryBack')) {
  $('btnYarnHistoryBack').addEventListener('click', () => {
    currentHistoryPartyName = '';
    currentHistoryPartyNorm = '';
    if (typeof viewYarnDashboard !== 'undefined' && viewYarnDashboard) {
      showView(viewYarnDashboard);
      loadYarnStock();
    }
  });
}

if ($('btnIssueYarnFromHistory')) {
  $('btnIssueYarnFromHistory').addEventListener('click', () => {
    openYarnForm(currentHistoryPartyName);
  });
}

// Make yarn functions globally available
window.openYarnForm = openYarnForm;
window.openYarnHistory = openYarnHistory;
window.editYarnRecord = editYarnRecord;
window.deleteYarnRecord = deleteYarnRecord;

// ═══════════════════════════════════════════════════════════
//  CASHBOOK / KHATA SYSTEM
// ═══════════════════════════════════════════════════════════

let cbSearchTimeout = null;
let currentCashbookSubtab = 'rokers'; // 'rokers' | 'khata'
let currentRokerNo = null;
let currentRokerData = null;
let currentKhataNo = null;
let currentKhataParty = null;
let cbReturnTo = 'dashboard'; // 'dashboard' | 'roker' | 'khata'

// ── Cashbook Tab Handler ──────────────────────────────────
$('tabCashbook').addEventListener('click', () => {
  if ($('cbSearchInput')) $('cbSearchInput').value = '';
  showView(viewCashbookDashboard);
  loadCashbookDashboard();
});

// ── Format Currency ───────────────────────────────────────
function fmtCurrency(n) {
  if (n == null || isNaN(n)) return '₹ 0';
  const num = Number(n);
  const hasDecimals = num % 1 !== 0;
  return '₹ ' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  });
}

// ── Format Rate (Preserves floating decimals e.g. 387.26, 430.70, 42,500) ───
function fmtRate(n) {
  if (n == null || isNaN(n) || Number(n) === 0) return '—';
  const num = Number(n);
  const hasDecimals = num % 1 !== 0;
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  });
}

// ── Get/Calculate Entry Rate (ratePerBag or Amount / Qty if rate is empty) ───
function getEntryRate(e) {
  if (e.ratePerBag && Number(e.ratePerBag) > 0) return Number(e.ratePerBag);
  const qty = (e.meters && e.meters > 0) ? e.meters : (e.bags && e.bags > 0) ? e.bags : 0;
  const amt = (e.jama && e.jama > 0) ? e.jama : (e.naam && e.naam > 0) ? e.naam : 0;
  if (qty > 0 && amt > 0) {
    return Math.round((amt / qty) * 100) / 100;
  }
  return 0;
}

// ── Subnav Switcher (Rokers vs Khata vs Parties vs PurchaseSell vs Contracts vs Investors) ──
function setCashbookSubtab(subtab) {
  currentCashbookSubtab = subtab;
  $('subnavRokers').classList.toggle('active', subtab === 'rokers');
  $('subnavKhata').classList.toggle('active', subtab === 'khata');
  if ($('subnavParties')) $('subnavParties').classList.toggle('active', subtab === 'parties');
  if ($('subnavPurchaseSell')) $('subnavPurchaseSell').classList.toggle('active', subtab === 'purchaseSell');
  if ($('subnavContracts')) $('subnavContracts').classList.toggle('active', subtab === 'contracts');
  if ($('subnavInvestors')) $('subnavInvestors').classList.toggle('active', subtab === 'investors');

  // Clear search field whenever switching subtabs
  if ($('cbSearchInput')) {
    $('cbSearchInput').value = '';
  }

  if (subtab === 'rokers') {
    $('cbSearchInput').placeholder = 'Search rokers or party...';
  } else if (subtab === 'khata') {
    $('cbSearchInput').placeholder = 'Search parties in khata...';
  } else if (subtab === 'purchaseSell') {
    $('cbSearchInput').placeholder = 'Search purchases...';
  } else if (subtab === 'contracts') {
    $('cbSearchInput').placeholder = 'Search contracts by purchaser, seller, quality, broker...';
  } else if (subtab === 'investors') {
    $('cbSearchInput').placeholder = 'Search investor jama entries, party, roker...';
  } else {
    $('cbSearchInput').placeholder = 'Search party accounts...';
  }
  loadCashbookDashboard();
}

$('subnavRokers').addEventListener('click', () => setCashbookSubtab('rokers'));
$('subnavKhata').addEventListener('click', () => setCashbookSubtab('khata'));
if ($('subnavParties')) {
  $('subnavParties').addEventListener('click', () => setCashbookSubtab('parties'));
}
if ($('subnavPurchaseSell')) {
  $('subnavPurchaseSell').addEventListener('click', () => setCashbookSubtab('purchaseSell'));
}
if ($('subnavContracts')) {
  $('subnavContracts').addEventListener('click', () => setCashbookSubtab('contracts'));
}
if ($('subnavInvestors')) {
  $('subnavInvestors').addEventListener('click', () => setCashbookSubtab('investors'));
}
if ($('btnNewContract')) {
  $('btnNewContract').addEventListener('click', () => openNewContractModal());
}
if ($('btnDownloadInvestorPDF')) {
  $('btnDownloadInvestorPDF').addEventListener('click', () => generateInvestorRegisterPDF('download'));
}
if ($('btnShareInvestorPDF')) {
  $('btnShareInvestorPDF').addEventListener('click', () => generateInvestorRegisterPDF('share'));
}
if ($('btnWhatsAppInvestor')) {
  $('btnWhatsAppInvestor').addEventListener('click', () => shareInvestorRegisterWhatsApp());
}

// ═══════════════════════════════════════════════════════════
//  CASHBOOK DASHBOARD (Rokers, Khata Ledger, All Parties, Contracts, Investors)
// ═══════════════════════════════════════════════════════════

async function loadCashbookDashboard() {
  try {
    const search = $('cbSearchInput') ? $('cbSearchInput').value.trim() : '';

    if (currentCashbookSubtab === 'contracts') {
      if ($('btnNewContract')) $('btnNewContract').style.display = '';
      if ($('btnDownloadChatha')) $('btnDownloadChatha').style.display = 'none';
      if ($('btnShareChatha')) $('btnShareChatha').style.display = 'none';
      if ($('btnDownloadInvestorPDF')) $('btnDownloadInvestorPDF').style.display = 'none';
      if ($('btnShareInvestorPDF')) $('btnShareInvestorPDF').style.display = 'none';
      if ($('btnWhatsAppInvestor')) $('btnWhatsAppInvestor').style.display = 'none';
      if ($('btnNewJamaEntry')) $('btnNewJamaEntry').style.display = 'none';
      if ($('btnNewBanamEntry')) $('btnNewBanamEntry').style.display = 'none';
      if ($('btnNewParty')) $('btnNewParty').style.display = 'none';

      await loadContractsDashboard(search);
      return;
    }

    if (currentCashbookSubtab === 'investors') {
      if ($('btnNewContract')) $('btnNewContract').style.display = 'none';
      if ($('btnDownloadChatha')) $('btnDownloadChatha').style.display = 'none';
      if ($('btnShareChatha')) $('btnShareChatha').style.display = 'none';
      if ($('btnDownloadInvestorPDF')) $('btnDownloadInvestorPDF').style.display = '';
      if ($('btnShareInvestorPDF')) $('btnShareInvestorPDF').style.display = '';
      if ($('btnWhatsAppInvestor')) $('btnWhatsAppInvestor').style.display = '';
      if ($('btnNewJamaEntry')) $('btnNewJamaEntry').style.display = 'none';
      if ($('btnNewBanamEntry')) $('btnNewBanamEntry').style.display = 'none';
      if ($('btnNewParty')) $('btnNewParty').style.display = 'none';

      await loadInvestorRegisterDashboard(search);
      return;
    }

    if ($('btnDownloadInvestorPDF')) $('btnDownloadInvestorPDF').style.display = 'none';
    if ($('btnShareInvestorPDF')) $('btnShareInvestorPDF').style.display = 'none';
    if ($('btnWhatsAppInvestor')) $('btnWhatsAppInvestor').style.display = 'none';
    if ($('btnNewContract')) $('btnNewContract').style.display = 'none';
    if ($('btnDownloadChatha')) $('btnDownloadChatha').style.display = '';
    if ($('btnShareChatha')) $('btnShareChatha').style.display = '';

    if (currentCashbookSubtab === 'rokers') {
      if ($('btnNewJamaEntry')) $('btnNewJamaEntry').style.display = '';
      if ($('btnNewBanamEntry')) $('btnNewBanamEntry').style.display = '';
      if ($('btnNewParty')) $('btnNewParty').style.display = 'none';
      // ── 1. ROKERS VIEW ───────────────────────────────────
      const url = `${CB_API}/rokers${search ? '?search=' + encodeURIComponent(search) : ''}`;
      const rokers = await apiGet(url);

      // Get Cash In Hand balance via lightweight endpoint (instead of full /parties)
      let fallbackCih = 0;
      try {
        const cihRes = await apiGet(`${CB_API}/cash-in-hand`);
        fallbackCih = cihRes.balance || 0;
      } catch (e) {}

      const totalEntries = rokers.reduce((sum, r) => sum + (r.entryCount || 0), 0);
      const totalBags = rokers.reduce((sum, r) => sum + (r.totalBags || 0), 0);
      const totalNaam = rokers.reduce((sum, r) => sum + (r.totalNaam || 0), 0);
      const totalJama = rokers.reduce((sum, r) => sum + (r.totalJama || 0), 0);

      $('cbCount').textContent = `(${rokers.length} Rokers)`;

      if (rokers.length === 0) {
        $('cbMainList').innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📜</div>
            <p>${search ? 'No rokers match your search.' : 'No rokers created yet. Start by creating your first Roker Entry!'}</p>
            ${!search ? '<button class="btn btn-primary" onclick="openNewRokerForm()">＋ New Roker</button>' : ''}
          </div>
        `;
        return;
      }

      $('cbMainList').innerHTML = `
        <div class="cb-roker-list">
          ${rokers.map(r => {
            const partiesStr = (r.parties && r.parties.length > 0) ? r.parties.filter(Boolean).join(', ') : 'No parties';
            return `
              <div class="cb-roker-card" onclick="openRokerDetail(${r.rokerNo})">
                <div class="cb-roker-card-left">
                  <span class="cb-roker-badge">#${r.rokerNo}</span>
                  <div class="cb-roker-info">
                    <div class="cb-roker-name-row">
                      <span class="cb-roker-date">${formatDate(r.date)}</span>
                      <span class="cb-roker-parties-preview">${escapeHtml(partiesStr)}</span>
                    </div>
                    <div class="cb-roker-meta">
                      <span>${r.entryCount} ${r.entryCount === 1 ? 'entry' : 'entries'}</span>
                      ${r.totalBags > 0 ? `<span> · 📦 ${r.totalBags} bags</span>` : ''}
                      ${r.totalMeters > 0 ? `<span> · 📏 ${r.totalMeters} meters</span>` : ''}
                    </div>
                  </div>
                </div>
                <div class="cb-roker-card-right">
                  <span style="color: var(--accent-primary); font-weight: 700; font-size: 0.8125rem;">View Roker ↗</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

    } else if (currentCashbookSubtab === 'khata') {
      // ── 2. KHATA (TRANSACTIONAL LEDGER) VIEW ─────────────
      if ($('btnNewJamaEntry')) $('btnNewJamaEntry').style.display = 'none';
      if ($('btnNewBanamEntry')) $('btnNewBanamEntry').style.display = 'none';
      if ($('btnNewParty')) $('btnNewParty').style.display = 'none';

      const url = `${CB_API}/parties${search ? '?search=' + encodeURIComponent(search) : ''}`;
      let parties = await apiGet(url);
      if (search) {
        parties = rankPartyMatches(parties, search);
      }

      $('cbCount').textContent = `(${parties.length} Khatas)`;

      if (parties.length === 0) {
        $('cbMainList').innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📒</div>
            <p>${search ? 'No khatas match your search.' : 'No party khatas found.'}</p>
          </div>
        `;
        return;
      }

      $('cbMainList').innerHTML = `
        <div class="cb-party-list">
          ${parties.map(p => {
            const balClass = p.balance > 0 ? 'positive' : p.balance < 0 ? 'negative' : 'zero';
            return `
              <div class="cb-party-card" onclick="openKhata(${p.khataNo})">
                <div class="cb-party-card-left">
                  <div class="cb-party-info">
                    <div class="cb-party-name-row" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span class="cb-party-name">${search ? highlightMatches(p.name, search) : escapeHtml(p.name)}</span>
                      <span class="cb-party-code" style="background: rgba(30, 64, 175, 0.12); color: #1e40af; border: 1px solid rgba(30, 64, 175, 0.3); font-weight: 800; font-size: 0.75rem; padding: 2px 7px; border-radius: 4px;">${getPartyCode(p)}</span>
                      <span class="cb-party-khata-no">Khata #${p.khataNo}</span>
                    </div>
                    <div class="cb-party-meta">
                      ${p.phone ? `<span>📞 ${escapeHtml(p.phone)}</span>` : ''}
                      <span>${p.txnCount || 0} entries</span>
                      ${p.totalBags ? `<span> · 📦 ${p.totalBags} bags</span>` : ''}
                      ${p.totalMeters ? `<span> · 📏 ${p.totalMeters} meters</span>` : ''}
                    </div>
                  </div>
                </div>
                <div class="cb-party-card-right">
                  <div>
                    <div class="cb-party-balance ${balClass}">${fmtCurrency(Math.abs(p.balance))}</div>
                    <div class="cb-party-balance-label">${p.balance > 0 ? 'Jama Balance' : p.balance < 0 ? 'Banam Balance' : 'Settled'}</div>
                  </div>
                  <span style="font-size: 0.75rem; color: var(--accent-primary); font-weight: 700;">View Ledger →</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

    } else if (currentCashbookSubtab === 'purchaseSell') {
      // ── 4. PURCHASE / SELL OVERVIEW ────────────────────────
      if ($('btnNewJamaEntry')) $('btnNewJamaEntry').style.display = 'none';
      if ($('btnNewBanamEntry')) $('btnNewBanamEntry').style.display = 'none';
      if ($('btnNewParty')) $('btnNewParty').style.display = 'none';

      const overview = await apiGet(`${CB_API}/purchase-sell-overview`);
      let filtered = overview;
      if (search) {
        const term = search.toLowerCase();
        filtered = overview.filter(p => p.partyName.toLowerCase().includes(term));
      }

      $('cbCount').textContent = `(${filtered.length} Purchases)`;

      if (filtered.length === 0) {
        $('cbMainList').innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📦</div>
            <p>${search ? 'No purchases match your search.' : 'No purchase entries yet. Mark an entry as Purchase to start tracking.'}</p>
          </div>
        `;
        return;
      }

      $('cbMainList').innerHTML = `
        <div class="cb-purchase-list">
          ${filtered.map(p => {
            if (p.isAggregateSummary) {
              const statusIcon = p.isFullySold ? '✅' : '⏳';
              const statusText = p.isFullySold ? 'Fully Sold' : `Partially Sold (${p.totalSoldQty}/${p.initialQty} ${p.unitLabel})`;
              const statusClass = p.isFullySold ? 'ps-status-sold' : 'ps-status-partial';

              let profitLossHtml = '';
              if (p.profitLoss !== null) {
                if (p.profitLoss > 0) {
                  profitLossHtml = '<span class="ps-profit">🟢 Nafa: ' + fmtCurrency(p.profitLoss) + '</span>';
                } else if (p.profitLoss < 0) {
                  profitLossHtml = '<span class="ps-loss">🔴 Nuqsaan: ' + fmtCurrency(Math.abs(p.profitLoss)) + '</span>';
                } else {
                  profitLossHtml = '<span class="ps-breakeven">⚪ Break Even</span>';
                }
              }

              const purRows = (p.purchases || []).map(pur => '<tr>' +
                '<td>' + formatDate(pur.date) + '</td>' +
                '<td><strong style="color: var(--accent-primary); cursor: pointer;" onclick="openKhata(' + pur.khataNo + ')">' + escapeHtml(pur.partyName) + ' ↗</strong></td>' +
                '<td>R#' + pur.rokerNo + '</td>' +
                '<td>' + (pur.bags > 0 ? pur.bags : '—') + '</td>' +
                '<td>' + (pur.meters > 0 ? pur.meters : '—') + '</td>' +
                '<td>' + (pur.ratePerBag || pur.rate ? fmtRate(pur.ratePerBag || pur.rate) : '—') + '</td>' +
                '<td style="text-align:right">' + fmtCurrency((pur.naam || 0) + (pur.jama || 0)) + '</td>' +
                '</tr>'
              ).join('');

              const sellRows = (p.sells || []).map(s => '<tr>' +
                '<td>' + formatDate(s.date) + '</td>' +
                '<td><strong style="color: var(--accent-primary); cursor: pointer;" onclick="openKhata(' + s.khataNo + ')">' + escapeHtml(s.partyName) + ' ↗</strong></td>' +
                '<td>R#' + s.rokerNo + '</td>' +
                '<td>' + (s.bags > 0 ? s.bags : '—') + '</td>' +
                '<td>' + (s.meters > 0 ? s.meters : '—') + '</td>' +
                '<td>' + (s.ratePerBag || s.rate ? fmtRate(s.ratePerBag || s.rate) : '—') + '</td>' +
                '<td style="text-align:right">' + fmtCurrency((s.naam || 0) + (s.jama || 0)) + '</td>' +
                '</tr>'
              ).join('');

              return '<div class="cb-purchase-card">' +
                '<div class="cb-purchase-header" onclick="this.parentElement.classList.toggle(\'expanded\')">' +
                  '<div class="cb-purchase-left">' +
                    '<span class="cb-purchase-badge" style="background: rgba(13, 148, 136, 0.15); color: #0d9488;">🏁 R#' + p.rokerNo + '</span>' +
                    '<div class="cb-purchase-info">' +
                      '<div class="cb-purchase-party">' + escapeHtml(p.partyName) + '</div>' +
                      '<div class="cb-purchase-meta">' + formatDate(p.date) + ' · Pur: ' + p.initialQty + ' ' + p.unitLabel + ' (' + fmtCurrency(p.purchaseAmount) + ') | Sell: ' + p.totalSoldQty + ' ' + p.unitLabel + ' (' + fmtCurrency(p.totalSellAmount) + ')</div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="cb-purchase-right">' +
                    '<span class="ps-status ' + statusClass + '">' + statusIcon + ' ' + statusText + '</span>' +
                    '<div class="cb-purchase-remaining">Remaining: <strong>' + p.remainingQty + '</strong> ' + p.unitLabel + '</div>' +
                    profitLossHtml +
                    '<span class="ps-expand-icon">▼</span>' +
                  '</div>' +
                '</div>' +
                '<div class="cb-purchase-sells">' +
                  '<h4 style="margin: 0.75rem 0 0.5rem; font-size: 0.875rem; color: #15803d;">🛒 Purchase Entries (' + (p.purchases || []).length + ') — Total: ' + fmtCurrency(p.purchaseAmount) + '</h4>' +
                  '<div class="cb-khata-table-wrapper" style="margin-bottom: 1rem;"><table class="cb-khata-table">' +
                    '<thead><tr><th>Date</th><th>Purchased From</th><th>Roker</th><th>Bags</th><th>Meters</th><th>Rate</th><th style="text-align:right">Amount</th></tr></thead>' +
                    '<tbody>' + (purRows || '<tr><td colspan="7">No purchases</td></tr>') + '</tbody>' +
                  '</table></div>' +
                  '<h4 style="margin: 0.75rem 0 0.5rem; font-size: 0.875rem; color: #b91c1c;">🏷️ Sell Entries (' + (p.sells || []).length + ') — Total: ' + fmtCurrency(p.totalSellAmount) + '</h4>' +
                  '<div class="cb-khata-table-wrapper"><table class="cb-khata-table">' +
                    '<thead><tr><th>Date</th><th>Sold To</th><th>Roker</th><th>Bags</th><th>Meters</th><th>Rate</th><th style="text-align:right">Amount</th></tr></thead>' +
                    '<tbody>' + (sellRows || '<tr><td colspan="7">No sells</td></tr>') + '</tbody>' +
                  '</table></div>' +
                  '<div style="margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: var(--bg-surface-secondary); border-radius: 6px; font-weight: 700; font-size: 0.8125rem; text-align: right;">' +
                    'Formula: Sell Total (' + fmtCurrency(p.totalSellAmount) + ') - Purchase Total (' + fmtCurrency(p.purchaseAmount) + ') = Net Nafa/Nuqsaan: ' + fmtCurrency(p.profitLoss || 0) +
                  '</div>' +
                '</div>' +
              '</div>';
            }

            const isMeter = p.meters > 0 || (p.bags === 0);
            const totalQty = isMeter ? (p.meters || 0) : (p.bags || 0);
            const unit = isMeter ? 'meters' : 'bags';
            const soldQty = isMeter ? (p.totalSoldMeters || 0) : (p.totalSoldBags || 0);

            const statusIcon = p.isFullySold ? '✅' : (p.sellCount > 0 ? '⏳' : '📦');
            const statusText = p.isFullySold ? 'Fully Sold' : (p.sellCount > 0 ? `Partially Sold (${soldQty}/${totalQty} ${unit})` : 'Unsold');
            const statusClass = p.isFullySold ? 'ps-status-sold' : (p.sellCount > 0 ? 'ps-status-partial' : 'ps-status-unsold');

            let profitLossHtml = '';
            if (p.isFullySold && p.profitLoss !== null) {
              if (p.profitLoss > 0) {
                profitLossHtml = '<span class="ps-profit">🟢 Nafa: ' + fmtCurrency(p.profitLoss) + '</span>';
              } else if (p.profitLoss < 0) {
                profitLossHtml = '<span class="ps-loss">🔴 Nuqsaan: ' + fmtCurrency(Math.abs(p.profitLoss)) + '</span>';
              } else {
                profitLossHtml = '<span class="ps-breakeven">⚪ Break Even</span>';
              }
            }

            const sellRows = p.sells.map(s => '<tr>' +
              '<td>' + formatDate(s.date) + '</td>' +
              '<td><strong style="color: var(--accent-primary); cursor: pointer;" onclick="openKhata(' + s.khataNo + ')">' + escapeHtml(s.partyName) + ' ↗</strong></td>' +
              '<td>R#' + s.rokerNo + '</td>' +
              '<td>' + (s.bags > 0 ? s.bags : '—') + '</td>' +
              '<td>' + (s.meters > 0 ? s.meters : '—') + '</td>' +
              '<td>' + (s.ratePerBag || s.rate ? fmtRate(s.ratePerBag || s.rate) : '—') + '</td>' +
              '<td style="text-align:right">' + fmtCurrency((s.naam || 0) + (s.jama || 0)) + '</td>' +
              '<td><button class="btn-action delete" onclick="event.stopPropagation(); deleteCbEntry(\'' + s._id + '\')" title="Delete Sell">🗑️</button></td>' +
              '</tr>'
            ).join('');

            const qtyText = isMeter ? `${p.meters} meters` : `${p.bags} bags`;

            return '<div class="cb-purchase-card">' +
              '<div class="cb-purchase-header" onclick="this.parentElement.classList.toggle(\'expanded\')">' +
                '<div class="cb-purchase-left">' +
                  '<span class="cb-purchase-badge">🛒 R#' + p.rokerNo + '</span>' +
                  '<div class="cb-purchase-info">' +
                    '<div class="cb-purchase-party">' + escapeHtml(p.partyName) + '</div>' +
                    '<div class="cb-purchase-meta">' + formatDate(p.date) + ' · ' + qtyText + ' × ' + fmtRate(p.ratePerBag || 0) + ' = ' + fmtCurrency(p.purchaseAmount) + '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="cb-purchase-right">' +
                  '<span class="ps-status ' + statusClass + '">' + statusIcon + ' ' + statusText + '</span>' +
                  '<div class="cb-purchase-remaining">Remaining: <strong>' + (p.remainingQty !== undefined ? p.remainingQty : p.remainingBags) + '</strong> ' + unit + '</div>' +
                  profitLossHtml +
                  '<span class="ps-expand-icon">▼</span>' +
                '</div>' +
              '</div>' +
              (p.sellCount > 0 ?
                '<div class="cb-purchase-sells">' +
                  '<h4 style="margin: 0.75rem 0 0.5rem; font-size: 0.875rem; color: var(--text-secondary);">🏷️ Sell Entries (' + p.sellCount + ')</h4>' +
                  '<div class="cb-khata-table-wrapper"><table class="cb-khata-table">' +
                    '<thead><tr><th>Date</th><th>Sold To</th><th>Roker</th><th>Bags</th><th>Meters</th><th>Rate</th><th style="text-align:right">Amount</th><th>Actions</th></tr></thead>' +
                    '<tbody>' + sellRows + '</tbody>' +
                    '<tfoot><tr style="font-weight:700;"><td colspan="3">Totals</td><td>' + (p.totalSoldBags || '—') + '</td><td>' + (p.totalSoldMeters || '—') + '</td><td>—</td><td style="text-align:right">' + fmtCurrency(p.totalSellAmount) + '</td><td></td></tr></tfoot>' +
                  '</table></div>' +
                '</div>'
              :
                '<div class="cb-purchase-sells"><p style="padding: 0.75rem; color: var(--text-muted); font-size: 0.8125rem;">No sell entries linked.</p></div>'
              ) +
            '</div>';
          }).join('')}
        </div>
      `;

    } else {
      // ── 3. ALL PARTIES ACCOUNTS VIEW ─────────────────────
      if ($('btnNewJamaEntry')) $('btnNewJamaEntry').style.display = 'none';
      if ($('btnNewBanamEntry')) $('btnNewBanamEntry').style.display = 'none';
      if ($('btnNewParty')) $('btnNewParty').style.display = '';

      const url = `${CB_API}/parties${search ? '?search=' + encodeURIComponent(search) : ''}`;
      let parties = await apiGet(url);
      if (search) {
        parties = rankPartyMatches(parties, search);
      }

      const cashParties = parties.filter(p => p.balanceType === 'cash' || (p.nameNorm && p.nameNorm === 'cash in hand'));
      const nonCashParties = parties.filter(p => !cashParties.some(cp => cp._id === p._id));

      const jamaParties = nonCashParties.filter(p => p.balance > 0);
      const banamParties = nonCashParties.filter(p => p.balance < 0);
      const zeroParties = nonCashParties.filter(p => p.balance === 0);
      const investorParties = parties.filter(p => Boolean(p.isInvestor || p.type === 'investor'));

      const totalCashSum = cashParties.reduce((s, p) => s + p.balance, 0);
      const totalJamaSum = jamaParties.reduce((s, p) => s + p.balance, 0);
      const totalBanamSum = banamParties.reduce((s, p) => s + Math.abs(p.balance), 0);
      const totalInvestorSum = investorParties.reduce((s, p) => s + (p.balance > 0 ? p.balance : 0), 0);

      $('cbCount').textContent = `(${parties.length} Parties)`;

      if (parties.length === 0) {
        $('cbMainList').innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">👥</div>
            <p>${search ? 'No parties match your search.' : 'No parties added yet.'}</p>
            ${!search ? '<button class="btn btn-primary" onclick="openPartyModal()">＋ Add First Party</button>' : ''}
          </div>
        `;
        return;
      }

      function renderPartyCard(p) {
        const isCashP = cashParties.some(cp => cp._id === p._id);
        const isInv = Boolean(p.isInvestor || p.type === 'investor');
        const balClass = isCashP ? (p.balance >= 0 ? 'positive' : 'negative') : (p.balance > 0 ? 'positive' : p.balance < 0 ? 'negative' : 'zero');
        const balLabel = isCashP ? 'Cash Balance' : (p.balance > 0 ? 'Jama (Credit)' : p.balance < 0 ? 'Banam (Debit)' : 'Balanced');
        return `
          <div class="cb-party-card" onclick="openKhata(${p.khataNo})">
            <div class="cb-party-card-left">
              <div class="cb-party-info">
                <div class="cb-party-name-row" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span class="cb-party-name">${search ? highlightMatches(p.name, search) : escapeHtml(p.name)}</span>
                  <span class="cb-party-code" style="background: rgba(30, 64, 175, 0.12); color: #1e40af; border: 1px solid rgba(30, 64, 175, 0.3); font-weight: 800; font-size: 0.75rem; padding: 2px 7px; border-radius: 4px;">${getPartyCode(p)}</span>
                  <span class="cb-party-khata-no">#${p.khataNo}</span>
                  ${isCashP ? '<span class="badge" style="background: #e0f2fe; color: #0284c7; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">💵 Cash Party</span>' : ''}
                  ${isInv ? '<span class="badge badge-investor" title="Marked as Investor Party">⭐ Investor</span>' : ''}
                </div>
                <div class="cb-party-meta">
                  ${p.phone ? `<span>📞 ${escapeHtml(p.phone)}</span>` : ''}
                  <span>${p.txnCount || 0} entries</span>
                  ${p.totalBags ? `<span> · 📦 ${p.totalBags} bags</span>` : ''}
                  ${p.totalMeters ? `<span> · 📏 ${p.totalMeters} meters</span>` : ''}
                </div>
              </div>
            </div>
            <div class="cb-party-card-right">
              <div>
                <div class="cb-party-balance ${balClass}">${fmtCurrency(Math.abs(p.balance))}</div>
                <div class="cb-party-balance-label">${balLabel}</div>
              </div>
              <div style="display: flex; gap: 0.25rem; align-items: center;">
                <button class="btn-action" onclick="event.stopPropagation(); toggleInvestorParty('${p._id}', '${escapeHtml(p.name)}')" title="${isInv ? 'Unmark as Investor' : 'Mark as Investor Party'}" style="${isInv ? 'background: #fef3c7; border: 1px solid #f59e0b; color: #b45309;' : 'background: #f1f5f9; border: 1px solid #cbd5e1; color: #64748b;'} font-size: 0.85rem; padding: 2px 7px; border-radius: 4px;">${isInv ? '⭐' : '☆'}</button>
                <button class="btn-action edit" onclick="event.stopPropagation(); editPartyFromCard('${p._id}', '${escapeHtml(p.name)}', ${p.openingBalance || 0}, '${p.balanceType || 'none'}', '${escapeHtml(p.phone || '')}', ${isInv})" title="Edit Party">✏️</button>
                <button class="btn-action delete" onclick="event.stopPropagation(); deleteCbParty('${p._id}', '${escapeHtml(p.name)}')" title="Delete Party">🗑️</button>
              </div>
            </div>
          </div>
        `;
      }

      const filterBarHtml = `
        <div class="cb-khata-filter-bar">
          <div class="cb-khata-filter-tabs">
            <button class="cb-filter-pill ${cbKhataFilter === 'all' ? 'active' : ''}" onclick="setKhataFilter('all')">
              All Parties (${parties.length})
            </button>
            <button class="cb-filter-pill pill-jama ${cbKhataFilter === 'jama' ? 'active' : ''}" onclick="setKhataFilter('jama')">
              🟢 Jama / Credit (${jamaParties.length}) · ${fmtCurrency(totalJamaSum)}
            </button>
            <button class="cb-filter-pill pill-banam ${cbKhataFilter === 'banam' ? 'active' : ''}" onclick="setKhataFilter('banam')">
              🔴 Banam / Debit (${banamParties.length}) · ${fmtCurrency(totalBanamSum)}
            </button>
            <button class="cb-filter-pill pill-cash ${cbKhataFilter === 'cash' ? 'active' : ''}" onclick="setKhataFilter('cash')">
              💵 Cash Parties (${cashParties.length}) · ${fmtCurrency(Math.abs(totalCashSum))}
            </button>
            <button class="cb-filter-pill pill-investor ${cbKhataFilter === 'investors' ? 'active' : ''}" onclick="setKhataFilter('investors')">
              ⭐ Investors (${investorParties.length})
            </button>
          </div>
        </div>
      `;

      let contentHtml = filterBarHtml;

      if (cbKhataFilter === 'investors') {
        contentHtml += `
          <div class="cb-section-header">
            <span class="cb-section-title" style="color: #b45309;">⭐ Marked Investor Parties (سرمایہ کار) — ${investorParties.length}</span>
            <span class="cb-section-total" style="color: #b45309;">Total Current Jama: ${fmtCurrency(totalInvestorSum)}</span>
          </div>
          <div class="cb-party-list">
            ${investorParties.length > 0 ? investorParties.map(renderPartyCard).join('') : '<p class="empty-hint" style="padding: 1rem; color: var(--text-muted);">No investor parties marked yet. Click ☆ on any party above to mark them as an investor!</p>'}
          </div>
        `;
      } else if (cbKhataFilter === 'jama') {
        contentHtml += `
          <div class="cb-section-header">
            <span class="cb-section-title title-jama">🟢 Jama Parties (Credit / جمع) — ${jamaParties.length}</span>
            <span class="cb-section-total" style="color: #15803d;">Total Jama: ${fmtCurrency(totalJamaSum)}</span>
          </div>
          <div class="cb-party-list">
            ${jamaParties.length > 0 ? jamaParties.map(renderPartyCard).join('') : '<p class="empty-hint" style="padding: 1rem; color: var(--text-muted);">No Jama parties found.</p>'}
          </div>
        `;
      } else if (cbKhataFilter === 'banam') {
        contentHtml += `
          <div class="cb-section-header">
            <span class="cb-section-title title-banam">🔴 Banam Parties (Debit / بنام) — ${banamParties.length}</span>
            <span class="cb-section-total" style="color: #b91c1c;">Total Banam: ${fmtCurrency(totalBanamSum)}</span>
          </div>
          <div class="cb-party-list">
            ${banamParties.length > 0 ? banamParties.map(renderPartyCard).join('') : '<p class="empty-hint" style="padding: 1rem; color: var(--text-muted);">No Banam parties found.</p>'}
          </div>
        `;
      } else if (cbKhataFilter === 'cash') {
        contentHtml += `
          <div class="cb-section-header">
            <span class="cb-section-title title-cash">💵 Cash Parties (نقدی / کیش کھاتہ) — ${cashParties.length}</span>
            <span class="cb-section-total" style="color: #0284c7;">Total Cash: ${fmtCurrency(Math.abs(totalCashSum))}</span>
          </div>
          <div class="cb-party-list">
            ${cashParties.length > 0 ? cashParties.map(renderPartyCard).join('') : '<p class="empty-hint" style="padding: 1rem; color: var(--text-muted);">No Cash parties found.</p>'}
          </div>
        `;
      } else {
        // 'all'
        contentHtml += `
          ${cashParties.length > 0 ? `
            <div class="cb-section-header">
              <span class="cb-section-title title-cash">💵 Cash Parties (نقدی / کیش کھاتہ) — ${cashParties.length}</span>
              <span class="cb-section-total" style="color: #0284c7;">Total: ${fmtCurrency(Math.abs(totalCashSum))}</span>
            </div>
            <div class="cb-party-list">
              ${cashParties.map(renderPartyCard).join('')}
            </div>
          ` : ''}

          ${jamaParties.length > 0 ? `
            <div class="cb-section-header" style="margin-top: 1.5rem;">
              <span class="cb-section-title title-jama">🟢 Jama Parties (Credit / جمع) — ${jamaParties.length}</span>
              <span class="cb-section-total" style="color: #15803d;">Total: ${fmtCurrency(totalJamaSum)}</span>
            </div>
            <div class="cb-party-list">
              ${jamaParties.map(renderPartyCard).join('')}
            </div>
          ` : ''}

          ${banamParties.length > 0 ? `
            <div class="cb-section-header" style="margin-top: 1.5rem;">
              <span class="cb-section-title title-banam">🔴 Banam Parties (Debit / بنام) — ${banamParties.length}</span>
              <span class="cb-section-total" style="color: #b91c1c;">Total: ${fmtCurrency(totalBanamSum)}</span>
            </div>
            <div class="cb-party-list">
              ${banamParties.map(renderPartyCard).join('')}
            </div>
          ` : ''}

          ${zeroParties.length > 0 ? `
            <div class="cb-section-header" style="margin-top: 1.5rem;">
              <span class="cb-section-title" style="color: var(--text-muted);">⚪ Settled / Balanced Parties — ${zeroParties.length}</span>
            </div>
            <div class="cb-party-list">
              ${zeroParties.map(renderPartyCard).join('')}
            </div>
          ` : ''}
        `;
      }

      $('cbMainList').innerHTML = contentHtml;
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

let cbKhataFilter = 'all'; // 'all' | 'jama' | 'banam' | 'cash'
function setKhataFilter(filter) {
  cbKhataFilter = filter;
  loadCashbookDashboard();
}
window.setKhataFilter = setKhataFilter;

// ── Search Listener ───────────────────────────────────────
if ($('cbSearchInput')) {
  $('cbSearchInput').addEventListener('input', () => {
    clearTimeout(cbSearchTimeout);
    cbSearchTimeout = setTimeout(() => loadCashbookDashboard(), 300);
  });
}

// ═══════════════════════════════════════════════════════════
//  ROKER DETAIL VIEW (All entries in a single Roker)
// ═══════════════════════════════════════════════════════════

async function openRokerDetail(rokerNo) {
  try {
    const data = await apiGet(`${CB_API}/roker/${rokerNo}`);
    currentRokerNo = rokerNo;

    // Client fallback to fetch Khata #95 Cash In Hand balance if missing from server API
    let cashInHandVal = data.summary.cashInHand;
    if (cashInHandVal === undefined || cashInHandVal === 0) {
      try {
        const parties = await apiGet(`${CB_API}/parties`);
        const cih = parties.find(p => p.khataNo === 95 || (p.nameNorm && p.nameNorm === 'cash in hand'));
        if (cih) cashInHandVal = cih.balance;
      } catch (e) {}
    }
    const prevCashInHand = data.summary.previousCashRoker !== undefined ? data.summary.previousCashRoker : (cashInHandVal || 0);
    const totalCashJama = data.summary.totalCashJama !== undefined ? data.summary.totalCashJama : (data.entries || []).filter(e => e.isCash && (e.jama || 0) > 0).reduce((sum, e) => sum + (e.jama || 0), 0);
    const totalCashNaam = data.summary.totalCashNaam !== undefined ? data.summary.totalCashNaam : (data.entries || []).filter(e => e.isCash && (e.naam || 0) > 0).reduce((sum, e) => sum + (e.naam || 0), 0);
    const totalJamaCashWithPrev = prevCashInHand + totalCashJama;
    const cashDifference = totalJamaCashWithPrev - totalCashNaam;

    data.summary.cashInHand = prevCashInHand;
    data.summary.previousCashRoker = prevCashInHand;
    data.summary.totalCashJama = totalCashJama;
    data.summary.totalCashNaam = totalCashNaam;
    data.summary.totalJamaCashWithPrev = totalJamaCashWithPrev;
    data.summary.cashDifference = cashDifference;
    data.summary.endRokerValue = (data.summary.totalJama || 0) + (prevCashInHand || 0);
    currentRokerData = data;

    $('rokerDetailTitle').textContent = `📜 Roker #${rokerNo} (${formatDate(data.date)})`;

    $('rokerInfoSummary').innerHTML = `
      <div class="cb-roker-detail-summary">
        <div class="cb-roker-detail-header-left">
          <div class="cb-roker-detail-num">Roker #${rokerNo}</div>
          <div>
            <div style="font-weight: 700; color: var(--text-primary); font-size: 0.9375rem;">${formatDate(data.date)}</div>
            <div style="font-size: 0.8125rem; color: var(--text-muted);">${data.summary.entryCount} ${data.summary.entryCount === 1 ? 'entry' : 'entries'} in this roker</div>
          </div>
        </div>
        <div class="cb-roker-detail-stats">
          ${data.summary.totalBags > 0 ? `
            <div class="cb-roker-stat-item">
              <div class="cb-roker-stat-val">📦 ${data.summary.totalBags}</div>
              <div class="cb-roker-stat-lbl">Total Bags</div>
            </div>
          ` : ''}
          ${data.summary.totalMeters > 0 ? `
            <div class="cb-roker-stat-item">
              <div class="cb-roker-stat-val">📏 ${data.summary.totalMeters}</div>
              <div class="cb-roker-stat-lbl">Total Meters</div>
            </div>
          ` : ''}
          <div class="cb-roker-stat-item">
            <div class="cb-roker-stat-val" style="color: #b91c1c;">${fmtCurrency(data.summary.totalNaam)}</div>
            <div class="cb-roker-stat-lbl">Total Naam</div>
          </div>
          <div class="cb-roker-stat-item">
            <div class="cb-roker-stat-val" style="color: #15803d;">${fmtCurrency(data.summary.totalJama)}</div>
            <div class="cb-roker-stat-lbl">Total Jama</div>
          </div>
          <div class="cb-roker-stat-item">
            <div class="cb-roker-stat-val" style="color: #0284c7;">${fmtCurrency(prevCashInHand)}</div>
            <div class="cb-roker-stat-lbl">Cash in Hand</div>
          </div>
          <div class="cb-roker-stat-item" style="background: rgba(5, 150, 105, 0.08); border: 1.5px solid rgba(5, 150, 105, 0.35);">
            <div class="cb-roker-stat-val" style="color: #059669; font-weight: 800;">${fmtCurrency(cashDifference)}</div>
            <div class="cb-roker-stat-lbl" style="color: #065f46; font-weight: 700;">💵 Cash Difference</div>
          </div>
          <div class="cb-roker-stat-item highlight-end-roker" onclick="openEndRokerModal()" title="Click to view End Roker calculation breakdown">
            <div class="cb-roker-stat-val" style="color: #d97706; font-size: 1.15rem;">${fmtCurrency(data.summary.endRokerValue || 0)}</div>
            <div class="cb-roker-stat-lbl" style="color: #d97706;">🏁 End Roker (Jama + Cash)</div>
          </div>
        </div>
      </div>
    `;

    if (!data.entries || data.entries.length === 0) {
      $('rokerContent').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📜</div>
          <p>No entries in Roker #${rokerNo} yet.</p>
          <button class="btn btn-primary" onclick="openAddEntryToCurrentRoker()">＋ Add Entry to Roker #${rokerNo}</button>
        </div>
      `;
    } else {
      $('rokerContent').innerHTML = `
        <div class="cb-khata-table-wrapper">
          <table class="cb-khata-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Party Name</th>
                <th>Khata #</th>
                <th>Description</th>
                <th>Bags</th>
                <th>Meters</th>
                <th>Rate</th>
                <th style="text-align:right">Naam (Debit)</th>
                <th style="text-align:right">Jama (Credit)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.entries.map(e => `
                <tr class="${e.isAutoCounterEntry ? 'cb-counter-row' : ''}">
                  <td>${formatDate(e.date)}</td>
                  <td>
                    <strong style="color: var(--accent-primary); cursor: pointer;" onclick="openKhata(${e.khataNo})" title="View ${escapeHtml(e.partyName)}'s Khata">
                      ${escapeHtml(e.partyName)} ↗
                    </strong>
                    ${e.isCash ? '<span class="badge" style="background: #dcfce7; color: #15803d; font-size: 0.65rem; padding: 2px 5px; margin-left: 4px; border-radius: 4px; font-weight: 700;">💵 Cash</span>' : ''}
                  </td>
                  <td class="col-roker">#${e.khataNo}</td>
                  <td class="col-desc" title="${escapeHtml(e.description)}">${escapeHtml(e.description)}</td>
                  <td class="col-bags">${e.bags > 0 ? e.bags : '—'}</td>
                  <td class="col-meters">${e.meters > 0 ? e.meters : '—'}</td>
                  <td class="col-rate">${fmtRate(getEntryRate(e))}</td>
                  <td class="col-naam">${e.naam > 0 ? fmtCurrency(e.naam) : '—'}</td>
                  <td class="col-jama">${e.jama > 0 ? fmtCurrency(e.jama) : '—'}</td>
                  <td>
                    <button class="btn-action edit" onclick="event.stopPropagation(); openEditEntry('${e._id}')" title="Edit Entry">✏️</button>
                    <button class="btn-action delete" onclick="event.stopPropagation(); deleteCbEntry('${e._id}')" title="Delete Entry">🗑️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4"><strong>Totals for Roker #${rokerNo}</strong></td>
                <td class="col-bags"><strong>${data.summary.totalBags > 0 ? data.summary.totalBags : '—'}</strong></td>
                <td class="col-meters"><strong>${data.summary.totalMeters > 0 ? data.summary.totalMeters : '—'}</strong></td>
                <td class="col-rate">—</td>
                <td class="col-naam"><strong>${fmtCurrency(data.summary.totalNaam)}</strong></td>
                <td class="col-jama"><strong>${fmtCurrency(data.summary.totalJama)}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    showView(viewRokerDetail);
  } catch (err) {
    toast(err.message, 'error');
  }
}

if ($('btnRokerDetailBack')) {
  $('btnRokerDetailBack').addEventListener('click', () => {
    showView(viewCashbookDashboard);
    loadCashbookDashboard();
  });
}

if ($('btnRokerSharePDF')) {
  $('btnRokerSharePDF').addEventListener('click', () => {
    if (currentRokerNo) {
      shareRokerAsPDF(currentRokerNo);
    }
  });
}

if ($('btnRokerAddEntry')) {
  $('btnRokerAddEntry').addEventListener('click', () => {
    openAddEntryToCurrentRoker();
  });
}

function openAddEntryToCurrentRoker() {
  cbReturnTo = 'roker';
  openEntryForm(null, currentRokerNo);
}

// ── Share / Export Roker PDF ───────────────────────────────
async function shareRokerAsPDF(rokerNo) {
  if (!rokerNo) return;
  try {
    toast('Generating Roker PDF...', 'info');
    const data = await apiGet(`${CB_API}/roker/${rokerNo}`);
    if (!data) throw new Error('Roker not found');

    let cashInHandVal = data.summary.cashInHand;
    if (cashInHandVal === undefined || cashInHandVal === 0) {
      try {
        const parties = await apiGet(`${CB_API}/parties`);
        const cih = parties.find(p => p.khataNo === 95 || (p.nameNorm && p.nameNorm === 'cash in hand'));
        if (cih) cashInHandVal = cih.balance;
      } catch (e) {}
    }
    const cih = cashInHandVal || 0;
    const endVal = (data.summary.totalJama || 0) + cih;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';

    const rowsHtml = (data.entries || []).map((e, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background: #f8fafc;' : ''}">
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 5px 3px; font-size: 9.5px;">${formatDate(e.date)}</td>
        <td style="padding: 5px 3px; font-size: 9.5px; font-weight: 700; color: #0f172a;">
          ${escapeHtml(e.partyName)}
          ${e.isCash ? '<span style="background: #dcfce7; color: #15803d; font-size: 8px; padding: 1px 3px; border-radius: 2px; font-weight: 700; margin-left: 2px;">CASH</span>' : ''}
        </td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: center; font-weight: 600; color: #2563eb;">#${e.khataNo}</td>
        <td style="padding: 5px 3px; font-size: 9px; color: #334155;">${escapeHtml(e.description || '—')}</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: center;">${e.bags > 0 ? e.bags : '—'}</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: center;">${e.meters > 0 ? e.meters : '—'}</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: right; color: #475569;">${fmtRate(getEntryRate(e))}</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: right; font-weight: 700; color: #b91c1c;">${e.naam > 0 ? fmtCurrency(e.naam) : '—'}</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: right; font-weight: 700; color: #15803d;">${e.jama > 0 ? fmtCurrency(e.jama) : '—'}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div style="padding: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; background: #ffffff; width: 680px; max-width: 680px; box-sizing: border-box;">
        
        <!-- Header Bar -->
        <div style="background: linear-gradient(135deg, #0f172a, #1e3a8a); color: #ffffff; padding: 12px 16px; border-radius: 6px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #ffffff;">📜 ROKER #${rokerNo} JOURNAL</h1>
            <p style="margin: 3px 0 0 0; font-size: 11.5px; color: #93c5fd;">Date: <strong>${formatDate(data.date)}</strong> · <strong>${data.entries.length}</strong> Entries</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px;">End Roker Value</div>
            <div style="font-size: 16px; font-weight: 800; color: #fbbf24;">${fmtCurrency(endVal)}</div>
          </div>
        </div>

        <!-- Summary Stats Chips -->
        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-bottom: 12px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 4px; text-align: center;">
            <div style="font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Bags</div>
            <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 2px;">${data.summary.totalBags > 0 ? data.summary.totalBags : '—'}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 4px; text-align: center;">
            <div style="font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Meters</div>
            <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 2px;">${data.summary.totalMeters > 0 ? data.summary.totalMeters : '—'}</div>
          </div>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 6px 4px; text-align: center;">
            <div style="font-size: 9px; color: #b91c1c; font-weight: 700; text-transform: uppercase;">Total Naam</div>
            <div style="font-size: 12px; font-weight: 800; color: #b91c1c; margin-top: 2px;">${fmtCurrency(data.summary.totalNaam)}</div>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 6px 4px; text-align: center;">
            <div style="font-size: 9px; color: #15803d; font-weight: 700; text-transform: uppercase;">Total Jama</div>
            <div style="font-size: 12px; font-weight: 800; color: #15803d; margin-top: 2px;">${fmtCurrency(data.summary.totalJama)}</div>
          </div>
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 4px; padding: 6px 4px; text-align: center;">
            <div style="font-size: 9px; color: #0284c7; font-weight: 700; text-transform: uppercase;">Cash in Hand</div>
            <div style="font-size: 12px; font-weight: 800; color: #0284c7; margin-top: 2px;">${fmtCurrency(cih)}</div>
          </div>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 6px 4px; text-align: center;">
            <div style="font-size: 9px; color: #d97706; font-weight: 700; text-transform: uppercase;">End Roker</div>
            <div style="font-size: 12px; font-weight: 800; color: #d97706; margin-top: 2px;">${fmtCurrency(endVal)}</div>
          </div>
        </div>

        <!-- Table -->
        <table style="width: 100%; table-layout: fixed; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden;">
          <colgroup>
            <col style="width: 22px;">
            <col style="width: 66px;">
            <col style="width: 110px;">
            <col style="width: 46px;">
            <col style="width: 140px;">
            <col style="width: 44px;">
            <col style="width: 46px;">
            <col style="width: 50px;">
            <col style="width: 78px;">
            <col style="width: 78px;">
          </colgroup>
          <thead>
            <tr style="background: #0f172a; color: #ffffff; font-size: 9.5px;">
              <th style="padding: 6px 3px; text-align: center;">#</th>
              <th style="padding: 6px 3px; text-align: left;">Date</th>
              <th style="padding: 6px 3px; text-align: left;">Party Name</th>
              <th style="padding: 6px 3px; text-align: center;">Khata #</th>
              <th style="padding: 6px 3px; text-align: left;">Description</th>
              <th style="padding: 6px 3px; text-align: center;">Bags</th>
              <th style="padding: 6px 3px; text-align: center;">Meters</th>
              <th style="padding: 6px 3px; text-align: right;">Rate</th>
              <th style="padding: 6px 3px; text-align: right; color: #fca5a5;">Naam (Debit)</th>
              <th style="padding: 6px 3px; text-align: right; color: #86efac;">Jama (Credit)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="10" style="padding: 12px; text-align: center; color: #64748b;">No entries</td></tr>'}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; border-top: 2px solid #0f172a; font-weight: 800; font-size: 9.5px;">
              <td colspan="5" style="padding: 6px 6px; text-align: left;">Totals for Roker #${rokerNo}</td>
              <td style="padding: 6px 3px; text-align: center;">${data.summary.totalBags > 0 ? data.summary.totalBags : '—'}</td>
              <td style="padding: 6px 3px; text-align: center;">${data.summary.totalMeters > 0 ? data.summary.totalMeters : '—'}</td>
              <td style="padding: 6px 3px; text-align: right;">—</td>
              <td style="padding: 6px 3px; text-align: right; color: #b91c1c;">${fmtCurrency(data.summary.totalNaam)}</td>
              <td style="padding: 6px 3px; text-align: right; color: #15803d;">${fmtCurrency(data.summary.totalJama)}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Footer -->
        <div style="margin-top: 14px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 9.5px; color: #94a3b8;">
          Roker #${rokerNo} · ${new Date().toLocaleDateString()} · Generated by Textile Costing & Cashbook Application · Developed by HU-Software Solutions
        </div>
      </div>
    `;

    document.body.appendChild(container);

    const fileName = `Roker_${rokerNo}_${formatDate(data.date).replace(/\s+/g, '_')}.pdf`;
    const opt = {
      margin: [6, 6, 6, 6],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0, windowWidth: 700 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
      const pdfWorker = html2pdf().set(opt).from(container.firstElementChild);
      const pdfBlob = await pdfWorker.output('blob');
      if (container.parentNode) document.body.removeChild(container);

      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            files: [pdfFile],
            title: `Roker #${rokerNo} (${formatDate(data.date)})`,
            text: `Roker #${rokerNo} Journal (${formatDate(data.date)})`,
          });
          toast('Shared Roker PDF successfully!', 'success');
          return;
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') return;
        }
      }

      // Download fallback
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast('Downloaded Roker PDF successfully!', 'success');
    } else {
      if (container.parentNode) document.body.removeChild(container);
      window.print();
    }
  } catch (err) {
    toast('PDF generation failed: ' + err.message, 'error');
  }
}

// ── Generate Chatha (Overall Parties Balance Sheet PDF) ───
if ($('btnDownloadChatha')) {
  $('btnDownloadChatha').addEventListener('click', () => {
    generateChathaPDF('download');
  });
}
if ($('btnShareChatha')) {
  $('btnShareChatha').addEventListener('click', () => {
    generateChathaPDF('share');
  });
}
if ($('btnGenerateChatha')) {
  $('btnGenerateChatha').addEventListener('click', () => {
    generateChathaPDF('download');
  });
}

async function generateChathaPDF(action = 'download') {
  try {
    toast(action === 'share' ? 'Preparing Chatha to share...' : 'Downloading Chatha PDF...', 'info');
    const parties = await apiGet(`${CB_API}/parties`);
    if (!parties || parties.length === 0) {
      toast('No party data found in Khata.', 'info');
      return;
    }

    const isCashInHand = (p) => p.khataNo === 95 || (p.nameNorm && p.nameNorm === 'cash in hand') || (p.name && p.name.trim().toLowerCase() === 'cash in hand');
    const sortAlpha = (a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });

    // Place Cash In Hand on the Banam (Debit) side with its balance value as-is, and sort alphabetically
    const jamaParties = parties
      .filter(p => !isCashInHand(p) && p.balance > 0)
      .sort(sortAlpha);

    const banamParties = parties
      .filter(p => isCashInHand(p) ? (p.balance !== 0) : (p.balance < 0))
      .sort(sortAlpha);

    const totalJama = jamaParties.reduce((s, p) => s + Math.abs(p.balance), 0);
    const totalBanam = banamParties.reduce((s, p) => s + Math.abs(p.balance), 0);

    const maxRows = Math.max(jamaParties.length, banamParties.length);

    // Build table rows side by side (without Khata No, with bigger fonts & balanced 2-column layout)
    let rowsHtml = '';
    for (let i = 0; i < maxRows; i++) {
      const bp = banamParties[i];
      const jp = jamaParties[i];
      const bgColor = i % 2 === 1 ? 'background: #f8fafc;' : '';

      rowsHtml += `<tr class="chatha-row" style="border-bottom: 1px solid #e2e8f0; page-break-inside: avoid !important; break-inside: avoid !important; ${bgColor}">`;

      // LEFT: Banam (بنام) party
      if (bp) {
        rowsHtml += `
          <td style="padding: 5.5px 3px; font-size: 11px; text-align: center; color: #1e40af; font-weight: 800; white-space: nowrap;">${getPartyCode(bp)}</td>
          <td style="padding: 5.5px 6px; font-size: 12px; font-weight: 700; color: #0f172a; word-break: break-word;">${escapeHtml(bp.name)}</td>
          <td style="padding: 5.5px 6px; font-size: 12px; text-align: right; font-weight: 800; color: #b91c1c; white-space: nowrap;">${fmtCurrency(Math.abs(bp.balance))}</td>
        `;
      } else {
        rowsHtml += `<td colspan="3" style="padding: 5.5px 3px;"></td>`;
      }

      // Divider column
      rowsHtml += `<td style="padding: 0; width: 4px; background: #0f172a;"></td>`;

      // RIGHT: Jama (جمع) party
      if (jp) {
        rowsHtml += `
          <td style="padding: 5.5px 3px; font-size: 11px; text-align: center; color: #1e40af; font-weight: 800; white-space: nowrap;">${getPartyCode(jp)}</td>
          <td style="padding: 5.5px 6px; font-size: 12px; font-weight: 700; color: #0f172a; word-break: break-word;">${escapeHtml(jp.name)}</td>
          <td style="padding: 5.5px 6px; font-size: 12px; text-align: right; font-weight: 800; color: #15803d; white-space: nowrap;">${fmtCurrency(jp.balance)}</td>
        `;
      } else {
        rowsHtml += `<td colspan="3" style="padding: 5.5px 3px;"></td>`;
      }

      rowsHtml += `</tr>`;
    }

    const container = document.createElement('div');
    container.style.cssText = 'position: fixed; left: -9999px; top: 0px; width: 700px; z-index: -99999; pointer-events: none;';

    const dateStr = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

    container.innerHTML = `
      <div id="chathaPdfRoot" style="padding: 10px 8px; font-family: 'Inter', 'Noto Sans Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif; color: #0f172a; background: #ffffff; width: 700px; max-width: 700px; box-sizing: border-box; text-rendering: optimizeLegibility;">
        <style>
          #chathaPdfRoot table { page-break-inside: auto; }
          #chathaPdfRoot tr, #chathaPdfRoot .chatha-row { page-break-inside: avoid !important; break-inside: avoid !important; }
          #chathaPdfRoot thead { display: table-header-group !important; page-break-inside: avoid !important; }
          #chathaPdfRoot tfoot { display: table-footer-group !important; page-break-inside: avoid !important; }
        </style>
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a, #1e3a8a); color: #ffffff; padding: 11px 14px; border-radius: 6px; margin-bottom: 10px; text-align: center; page-break-inside: avoid;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span style="letter-spacing: 2px; text-transform: uppercase;">CHATHA</span>
            <span style="color: #93c5fd; font-weight: 400;">/</span>
            <span dir="rtl" style="direction: rtl; unicode-bidi: embed; font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif; font-size: 26px; font-weight: 900; letter-spacing: normal;">چٹھا</span>
          </h1>
          <p style="margin: 3px 0 0 0; font-size: 12px; color: #93c5fd; font-weight: 600;">All Parties Ledger Summary · ${jamaParties.length + banamParties.length} Active Parties · ${dateStr}</p>
        </div>

        <!-- Two-Column Table -->
        <table style="width: 100%; table-layout: fixed; border-collapse: collapse; border: 1.5px solid #0f172a; border-radius: 4px; overflow: hidden; margin: 0; page-break-inside: auto;">
          <colgroup>
            <!-- Left: Banam -->
            <col style="width: 44px;">
            <col style="width: 194px;">
            <col style="width: 100px;">
            <!-- Divider -->
            <col style="width: 4px;">
            <!-- Right: Jama -->
            <col style="width: 44px;">
            <col style="width: 194px;">
            <col style="width: 100px;">
          </colgroup>
          <thead style="display: table-header-group; page-break-inside: avoid;">
            <tr style="background: #0f172a; color: #ffffff; font-size: 11.5px; page-break-inside: avoid;">
              <th colspan="3" style="padding: 8px 6px; text-align: center; border-right: 2px solid #fbbf24; font-weight: 800;"><span style="text-transform: uppercase;">BANAM</span> / <span dir="rtl" style="direction: rtl; unicode-bidi: embed; font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif; letter-spacing: normal;">بنام</span> (Debit) — ${banamParties.length} Parties</th>
              <th style="padding: 0; width: 4px; background: #fbbf24;"></th>
              <th colspan="3" style="padding: 8px 6px; text-align: center; border-left: 2px solid #fbbf24; font-weight: 800;"><span style="text-transform: uppercase;">JAMA</span> / <span dir="rtl" style="direction: rtl; unicode-bidi: embed; font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif; letter-spacing: normal;">جمع</span> (Credit) — ${jamaParties.length} Parties</th>
            </tr>
            <tr style="background: #1e293b; color: #cbd5e1; font-size: 10.5px; page-break-inside: avoid;">
              <th style="padding: 6px 3px; text-align: center;">Code</th>
              <th style="padding: 6px 6px; text-align: left;">Party Name</th>
              <th style="padding: 6px 6px; text-align: right;">Amount</th>
              <th style="padding: 0; width: 4px; background: #334155;"></th>
              <th style="padding: 6px 3px; text-align: center;">Code</th>
              <th style="padding: 6px 6px; text-align: left;">Party Name</th>
              <th style="padding: 6px 6px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot style="display: table-footer-group; page-break-inside: avoid;">
            <tr style="background: #f1f5f9; border-top: 2px solid #0f172a; font-weight: 800; font-size: 11.5px; page-break-inside: avoid;">
              <td colspan="2" style="padding: 8px 6px; text-align: left;">Total Banam (${banamParties.length})</td>
              <td style="padding: 8px 6px; text-align: right; color: #b91c1c; font-size: 12px; font-weight: 800;">${fmtCurrency(totalBanam)}</td>
              <td style="padding: 0; width: 4px; background: #0f172a;"></td>
              <td colspan="2" style="padding: 8px 6px; text-align: left;">Total Jama (${jamaParties.length})</td>
              <td style="padding: 8px 6px; text-align: right; color: #15803d; font-size: 12px; font-weight: 800;">${fmtCurrency(totalJama)}</td>
            </tr>
            <tr style="background: #e2e8f0; font-weight: 800; font-size: 11px; page-break-inside: avoid;">
              <td colspan="3" style="padding: 6px 6px; text-align: center; color: ${totalJama === totalBanam ? '#15803d' : totalJama > totalBanam ? '#15803d' : '#b91c1c'};">
                Net: ${fmtCurrency(Math.abs(totalJama - totalBanam))} (${totalJama === totalBanam ? 'Balanced / برابر' : totalJama > totalBanam ? 'Jama Surplus' : 'Banam Surplus'})
              </td>
              <td style="padding: 0; width: 4px; background: #0f172a;"></td>
              <td colspan="3" style="padding: 6px 6px; text-align: center; color: #64748b;">
                Total Parties: ${jamaParties.length + banamParties.length}
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- Footer -->
        <div style="margin-top: 8px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 4px; font-size: 9.5px; color: #94a3b8; page-break-inside: avoid;">
          Chatha / <span dir="rtl" style="direction: rtl; unicode-bidi: embed;">چٹھا</span> · ${dateStr} · Generated by Textile Costing & Cashbook Application · Developed by HU-Software Solutions
        </div>
      </div>
    `;

    document.body.appendChild(container);

    const fileName = `Chatha_${dateStr.replace(/\s+/g, '_')}.pdf`;
    const opt = {
      margin: [6, 6, 6, 6],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: {
        mode: ['css', 'legacy'],
        avoid: ['tr', '.chatha-row', 'thead', 'tfoot', '.page-break-avoid']
      }
    };

    if (typeof html2pdf !== 'undefined') {
      const pdfWorker = html2pdf().set(opt).from(container.firstElementChild);
      const pdfBlob = await pdfWorker.output('blob');
      if (container.parentNode) document.body.removeChild(container);

      if (action === 'share') {
        const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          try {
            await navigator.share({
              files: [pdfFile],
              title: `Chatha - ${dateStr}`,
              text: `Chatha / چٹھا - All Parties Balance Sheet (${dateStr})`,
            });
            toast('Shared Chatha PDF successfully!', 'success');
            return;
          } catch (shareErr) {
            if (shareErr.name === 'AbortError') return;
          }
        }
      }

      // Direct download
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast('Downloaded Chatha PDF successfully!', 'success');
    } else {
      if (container.parentNode) document.body.removeChild(container);
      window.print();
    }
  } catch (err) {
    toast('PDF generation failed: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════
//  INVESTOR REGISTER (سرمایہ کار جمع رجسٹر - Month-wise Jama)
// ═══════════════════════════════════════════════════════════

let currentInvestorMonth = 'all'; // 'all' or 'YYYY-MM'
let lastInvestorRegisterData = null;

function setInvestorMonthFilter(month) {
  currentInvestorMonth = month;
  loadCashbookDashboard();
}
window.setInvestorMonthFilter = setInvestorMonthFilter;

async function loadInvestorRegisterDashboard(search = '') {
  try {
    const url = `${CB_API}/investor-register?month=${encodeURIComponent(currentInvestorMonth)}${search ? '&search=' + encodeURIComponent(search) : ''}`;
    const data = await apiGet(url);
    lastInvestorRegisterData = data;

    const displayedEntries = (data.months || []).reduce((sum, m) => sum + (m.entryCount || 0), 0);
    const displayedJama = (data.months || []).reduce((sum, m) => sum + (m.totalJama || 0), 0);

    $('cbCount').textContent = `(${displayedEntries} Entries · ${fmtCurrency(displayedJama)})`;

    if (!data.investorsCount || data.investorsCount === 0) {
      $('cbMainList').innerHTML = `
        <div class="empty-state" style="padding: 3rem 1.5rem; text-align: center; background: var(--surface); border: 1.5px dashed #f59e0b; border-radius: 12px; margin: 1.5rem 0;">
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">⭐</div>
          <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">No Investor Parties Marked Yet</h3>
          <p style="color: var(--text-secondary); max-width: 520px; margin: 0 auto 1.25rem; line-height: 1.5; font-size: 0.925rem;">
            To track investor deposits from August 2026 onwards, go to the <strong>👥 All Parties</strong> tab and click the <strong>☆</strong> button on any party card to mark them as an Investor Party.
          </p>
          <button class="btn btn-primary" onclick="setCashbookSubtab('parties')" style="background: #d97706; border-color: #d97706; font-weight: 700; padding: 8px 18px;">
            👥 Go to All Parties List
          </button>
        </div>
      `;
      return;
    }

    // Month Selector Options
    const monthOptions = (data.availableMonths || []).map(m => {
      return `<option value="${m.key}" ${currentInvestorMonth === m.key ? 'selected' : ''}>${m.label} (${m.count} entries · ${fmtCurrency(m.totalJama)})</option>`;
    }).join('');

    const filterBarHtml = `
      <div class="investor-filter-bar">
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <label style="font-weight: 700; font-size: 0.85rem; color: #92400e; display: flex; align-items: center; gap: 4px;">
            <span>📅 Filter Month:</span>
            <select class="investor-month-select" onchange="setInvestorMonthFilter(this.value)">
              <option value="all" ${currentInvestorMonth === 'all' ? 'selected' : ''}>📅 All Months (Aug 2026 Onwards) — ${data.totalEntries} entries</option>
              ${monthOptions}
            </select>
          </label>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-secondary" onclick="setCashbookSubtab('parties'); setKhataFilter('investors');" style="font-size: 0.8rem; padding: 6px 12px; font-weight: 700; border-color: #f59e0b; color: #b45309;">
            👥 View ${data.investorsCount} Investor Parties
          </button>
        </div>
      </div>

      <div class="investor-kpi-grid">
        <div class="investor-kpi-card">
          <div class="investor-kpi-icon" style="color: #15803d; background: rgba(21, 128, 61, 0.12);">💰</div>
          <div class="investor-kpi-info">
            <span class="investor-kpi-value" style="color: #15803d;">${fmtCurrency(displayedJama)}</span>
            <span class="investor-kpi-label">Total Investment Jama</span>
          </div>
        </div>
        <div class="investor-kpi-card">
          <div class="investor-kpi-icon" style="color: #d97706; background: rgba(217, 119, 6, 0.12);">⭐</div>
          <div class="investor-kpi-info">
            <span class="investor-kpi-value" style="color: #d97706;">${data.investorsCount}</span>
            <span class="investor-kpi-label">Marked Investor Parties</span>
          </div>
        </div>
        <div class="investor-kpi-card">
          <div class="investor-kpi-icon" style="color: #0284c7; background: rgba(2, 132, 199, 0.12);">📋</div>
          <div class="investor-kpi-info">
            <span class="investor-kpi-value" style="color: #0284c7;">${displayedEntries}</span>
            <span class="investor-kpi-label">Jama Transactions</span>
          </div>
        </div>
      </div>
    `;

    if (displayedEntries === 0) {
      $('cbMainList').innerHTML = filterBarHtml + `
        <div class="empty-state" style="padding: 2.5rem 1rem; text-align: center; background: var(--surface); border: 1px dashed var(--border); border-radius: 8px;">
          <div class="empty-icon" style="font-size: 2.25rem; margin-bottom: 0.5rem;">📭</div>
          <p style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">
            ${search ? 'No investor entries matched your search.' : 'No Jama (Credit) entries found for marked investor parties from August 1, 2026 onwards.'}
          </p>
          <p style="font-size: 0.8125rem; color: var(--text-secondary);">
            Any Jama entry made in Roker for an investor party automatically appears here.
          </p>
        </div>
      `;
      return;
    }

    // Render month-by-month cards and tables
    const monthCardsHtml = (data.months || []).map(group => {
      if (!group.entries || group.entries.length === 0) return '';

      const rowsHtml = group.entries.map((e, idx) => {
        const qtyStr = (e.meters && e.meters > 0) ? `${e.meters}m` : (e.bags && e.bags > 0) ? `${e.bags}b` : '—';
        const rateStr = e.ratePerBag ? fmtRate(e.ratePerBag) : '—';
        return `
          <tr>
            <td style="color: var(--text-muted); font-size: 0.75rem; text-align: center; width: 35px;">${idx + 1}</td>
            <td style="white-space: nowrap; font-weight: 600;">${formatDate(e.date)}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span style="font-weight: 700; color: #1e40af; cursor: pointer;" onclick="openKhata(${e.khataNo})">${escapeHtml(e.partyName)}</span>
                ${e.partyCode ? `<span style="font-size: 0.68rem; background: #e0e7ff; color: #3730a3; padding: 1px 5px; border-radius: 3px; font-weight: 800;">${escapeHtml(e.partyCode)}</span>` : ''}
              </div>
            </td>
            <td style="white-space: nowrap; font-size: 0.78rem; color: var(--text-secondary); text-align: center;">#${e.khataNo}</td>
            <td style="white-space: nowrap; text-align: center;">
              <a href="javascript:void(0)" onclick="openRokerDetail(${e.rokerNo})" style="color: #0284c7; font-weight: 700; text-decoration: underline; font-size: 0.8rem;">R#${e.rokerNo}</a>
            </td>
            <td style="max-width: 250px; font-size: 0.8rem; color: var(--text-primary); word-break: break-word;">${escapeHtml(e.description || '—')}</td>
            <td style="white-space: nowrap; text-align: center; font-size: 0.8rem;">${qtyStr}</td>
            <td style="white-space: nowrap; text-align: right; font-size: 0.8rem;">${rateStr}</td>
            <td style="white-space: nowrap; text-align: right; font-weight: 800; color: #15803d; font-size: 0.9rem;">${fmtCurrency(e.jama)}</td>
          </tr>
        `;
      }).join('');

      return `
        <div class="investor-month-card">
          <div class="investor-month-header">
            <div class="investor-month-title">
              <span>📅 ${group.monthLabel}</span>
              <span class="investor-month-badge">${group.entryCount} entries</span>
            </div>
            <div class="investor-month-total">
              Month Jama: ${fmtCurrency(group.totalJama)}
            </div>
          </div>
          <div class="investor-table-wrapper">
            <table class="investor-table">
              <thead>
                <tr>
                  <th style="width: 35px; text-align: center;">#</th>
                  <th>Date</th>
                  <th>Party Name</th>
                  <th style="text-align: center;">Khata #</th>
                  <th style="text-align: center;">Roker #</th>
                  <th>Description / Details</th>
                  <th style="text-align: center;">Qty</th>
                  <th style="text-align: right;">Rate</th>
                  <th style="text-align: right;">Jama (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="8" style="text-align: right; font-weight: 800;">Month Subtotal (${group.monthLabel}):</td>
                  <td style="text-align: right; color: #15803d; font-size: 0.95rem; font-weight: 800;">${fmtCurrency(group.totalJama)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `;
    }).join('');

    let grandFooterHtml = '';
    if (currentInvestorMonth === 'all' && (data.months || []).length > 1) {
      grandFooterHtml = `
        <div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); color: #ffffff; padding: 1rem 1.25rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; margin-top: 1.25rem; flex-wrap: gap: 0.5rem; box-shadow: 0 2px 6px rgba(0,0,0,0.06);">
          <div style="font-weight: 800; font-size: 1.05rem;">
            Grand Total Investment (August 2026 Onwards · All Months)
          </div>
          <div style="font-size: 1.25rem; font-weight: 800; color: #6ee7b7;">
            ${fmtCurrency(data.grandTotalJama)}
          </div>
        </div>
      `;
    }

    $('cbMainList').innerHTML = filterBarHtml + monthCardsHtml + grandFooterHtml;
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function generateInvestorRegisterPDF(action = 'download') {
  try {
    toast(action === 'share' ? 'Preparing Investor Register to share...' : 'Downloading Investor Register PDF...', 'info');

    let data = lastInvestorRegisterData;
    if (!data) {
      const url = `${CB_API}/investor-register?month=${encodeURIComponent(currentInvestorMonth)}`;
      data = await apiGet(url);
    }

    if (!data || !data.months || data.months.length === 0 || data.totalEntries === 0) {
      toast('No investor entries available to generate PDF.', 'info');
      return;
    }

    const periodLabel = currentInvestorMonth === 'all'
      ? 'August 2026 Onwards (All Months)'
      : (data.months[0] ? data.months[0].monthLabel : currentInvestorMonth);

    const dateStr = new Date().toLocaleDateString('en-PK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const displayedEntries = (data.months || []).reduce((sum, m) => sum + (m.entryCount || 0), 0);
    const displayedJama = (data.months || []).reduce((sum, m) => sum + (m.totalJama || 0), 0);

    // Build tables per month
    let tablesHtml = '';
    data.months.forEach(group => {
      if (!group.entries || group.entries.length === 0) return;

      const rows = group.entries.map((e, idx) => {
        const qtyStr = (e.meters && e.meters > 0) ? `${e.meters}m` : (e.bags && e.bags > 0) ? `${e.bags}b` : '—';
        const rateStr = e.ratePerBag ? fmtRate(e.ratePerBag) : '—';
        const bgColor = idx % 2 === 1 ? 'background: #f8fafc;' : 'background: #ffffff;';
        return `
          <tr style="border-bottom: 1px solid #e2e8f0; ${bgColor} page-break-inside: avoid !important; break-inside: avoid !important;">
            <td style="padding: 5px 4px; font-size: 10px; text-align: center; color: #64748b;">${idx + 1}</td>
            <td style="padding: 5px 6px; font-size: 10.5px; font-weight: 700; white-space: nowrap;">${formatDate(e.date)}</td>
            <td style="padding: 5px 6px; font-size: 11px; font-weight: 700; color: #0f172a;">${escapeHtml(e.partyName)} ${e.partyCode ? `<span style="font-size: 9px; color: #1e40af;">(${e.partyCode})</span>` : ''}</td>
            <td style="padding: 5px 4px; font-size: 10px; text-align: center; color: #475569;">#${e.khataNo}</td>
            <td style="padding: 5px 4px; font-size: 10.5px; text-align: center; font-weight: 700; color: #0284c7;">R#${e.rokerNo}</td>
            <td style="padding: 5px 6px; font-size: 10px; color: #334155;">${escapeHtml(e.description || '—')}</td>
            <td style="padding: 5px 4px; font-size: 10px; text-align: center;">${qtyStr}</td>
            <td style="padding: 5px 5px; font-size: 10px; text-align: right;">${rateStr}</td>
            <td style="padding: 5px 6px; font-size: 11px; text-align: right; font-weight: 800; color: #15803d; white-space: nowrap;">${fmtCurrency(e.jama)}</td>
          </tr>
        `;
      }).join('');

      tablesHtml += `
        <div style="margin-bottom: 14px; page-break-inside: auto;">
          <div style="background: #1e293b; color: #ffffff; padding: 6px 10px; border-radius: 4px 4px 0 0; display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 800; page-break-inside: avoid;">
            <span>📅 ${group.monthLabel} (${group.entryCount} Entries)</span>
            <span style="color: #4ade80;">Month Jama: ${fmtCurrency(group.totalJama)}</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-top: none; table-layout: fixed;">
            <colgroup>
              <col style="width: 26px;">
              <col style="width: 72px;">
              <col style="width: 140px;">
              <col style="width: 44px;">
              <col style="width: 44px;">
              <col style="width: 154px;">
              <col style="width: 48px;">
              <col style="width: 50px;">
              <col style="width: 82px;">
            </colgroup>
            <thead style="background: #f1f5f9; color: #334155; font-size: 9.5px; font-weight: 800; border-bottom: 1px solid #cbd5e1; page-break-inside: avoid;">
              <tr>
                <th style="padding: 5px 2px; text-align: center;">#</th>
                <th style="padding: 5px 4px; text-align: left;">Date</th>
                <th style="padding: 5px 4px; text-align: left;">Party Name</th>
                <th style="padding: 5px 2px; text-align: center;">Khata</th>
                <th style="padding: 5px 2px; text-align: center;">Roker</th>
                <th style="padding: 5px 4px; text-align: left;">Description</th>
                <th style="padding: 5px 2px; text-align: center;">Qty</th>
                <th style="padding: 5px 4px; text-align: right;">Rate</th>
                <th style="padding: 5px 6px; text-align: right;">Jama (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
            <tfoot style="page-break-inside: avoid;">
              <tr style="background: #e2e8f0; font-weight: 800; font-size: 10.5px; border-top: 1.5px solid #0f172a;">
                <td colspan="8" style="padding: 6px 8px; text-align: right;">Subtotal for ${group.monthLabel}:</td>
                <td style="padding: 6px 8px; text-align: right; color: #15803d; font-size: 11px; font-weight: 800;">${fmtCurrency(group.totalJama)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    });

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '210mm';
    container.style.background = '#ffffff';

    container.innerHTML = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 12mm 10mm; background: #ffffff; color: #0f172a; box-sizing: border-box; width: 100%;">
        <!-- Header (General Chatha-style Header) -->
        <div style="background: linear-gradient(135deg, #0f172a, #1e3a8a); color: #ffffff; padding: 11px 14px; border-radius: 6px; margin-bottom: 12px; text-align: center; page-break-inside: avoid;">
          <h1 style="margin: 0; font-size: 21px; font-weight: 800; color: #ffffff; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span style="letter-spacing: 1.5px; text-transform: uppercase;">INVESTOR JAMA REGISTER</span>
            <span style="color: #93c5fd; font-weight: 400;">/</span>
            <span dir="rtl" style="direction: rtl; unicode-bidi: embed; font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif; font-size: 25px; font-weight: 900; letter-spacing: normal;">سرمایہ کار جمع رجسٹر</span>
          </h1>
          <p style="margin: 3px 0 0 0; font-size: 11.5px; color: #93c5fd; font-weight: 600;">Investor Accounts Ledger (August 2026 Onwards) · Period: ${periodLabel} · ${dateStr}</p>
        </div>

        <!-- KPI Strip -->
        <div style="display: flex; gap: 8px; margin-bottom: 14px; page-break-inside: avoid;">
          <div style="flex: 1; background: #ecfdf5; border: 1.5px solid #10b981; border-radius: 4px; padding: 6px 10px;">
            <div style="font-size: 8.5px; text-transform: uppercase; font-weight: 700; color: #047857;">TOTAL INVESTMENT JAMA</div>
            <div style="font-size: 15px; font-weight: 800; color: #065f46;">${fmtCurrency(displayedJama)}</div>
          </div>
          <div style="flex: 1; background: #fef3c7; border: 1.5px solid #f59e0b; border-radius: 4px; padding: 6px 10px;">
            <div style="font-size: 8.5px; text-transform: uppercase; font-weight: 700; color: #b45309;">INVESTOR PARTIES</div>
            <div style="font-size: 15px; font-weight: 800; color: #92400e;">${data.investorsCount} Parties</div>
          </div>
          <div style="flex: 1; background: #eff6ff; border: 1.5px solid #3b82f6; border-radius: 4px; padding: 6px 10px;">
            <div style="font-size: 8.5px; text-transform: uppercase; font-weight: 700; color: #1d4ed8;">TOTAL ENTRIES</div>
            <div style="font-size: 15px; font-weight: 800; color: #1e40af;">${displayedEntries} Entries</div>
          </div>
        </div>

        <!-- Tables -->
        ${tablesHtml}

        <!-- Grand Total Summary -->
        <div style="background: #0f172a; color: #ffffff; padding: 8px 12px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; margin-top: 10px; page-break-inside: avoid;">
          <span style="font-size: 12px; font-weight: 800;">GRAND TOTAL INVESTMENT (${periodLabel}):</span>
          <span style="font-size: 14px; font-weight: 800; color: #4ade80;">${fmtCurrency(displayedJama)}</span>
        </div>

        <!-- Footer -->
        <div style="margin-top: 14px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 9.5px; color: #94a3b8; page-break-inside: avoid;">
          Investor Register (سرمایہ کار رجسٹر) · ${periodLabel} · Generated on ${dateStr} · Textile Costing & Cashbook System
        </div>
      </div>
    `;

    document.body.appendChild(container);

    const safePeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Investor_Register_${safePeriod}_${dateStr.replace(/\s+/g, '_')}.pdf`;
    const opt = {
      margin: [6, 6, 6, 6],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: {
        mode: ['css', 'legacy'],
        avoid: ['tr', 'thead', 'tfoot', '.page-break-avoid']
      }
    };

    if (typeof html2pdf !== 'undefined') {
      const pdfWorker = html2pdf().set(opt).from(container.firstElementChild);
      const pdfBlob = await pdfWorker.output('blob');
      if (container.parentNode) document.body.removeChild(container);

      if (action === 'share') {
        const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          try {
            await navigator.share({
              files: [pdfFile],
              title: `Investor Register - ${periodLabel}`,
              text: `Investor Jama Register / سرمایہ کار جمع رجسٹر (${periodLabel})`,
            });
            toast('Shared Investor Register PDF successfully!', 'success');
            return;
          } catch (shareErr) {
            if (shareErr.name === 'AbortError') return;
          }
        }
      }

      // Direct download
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast('Downloaded Investor Register PDF successfully!', 'success');
    } else {
      if (container.parentNode) document.body.removeChild(container);
      window.print();
    }
  } catch (err) {
    toast('PDF generation failed: ' + err.message, 'error');
  }
}

function shareInvestorRegisterWhatsApp() {
  const data = lastInvestorRegisterData;
  if (!data || !data.months || data.months.length === 0 || data.totalEntries === 0) {
    toast('No investor data to share.', 'info');
    return;
  }

  const periodLabel = currentInvestorMonth === 'all'
    ? 'August 2026 Onwards'
    : (data.months[0] ? data.months[0].monthLabel : currentInvestorMonth);

  const displayedEntries = (data.months || []).reduce((sum, m) => sum + (m.entryCount || 0), 0);
  const displayedJama = (data.months || []).reduce((sum, m) => sum + (m.totalJama || 0), 0);

  let monthlyBreakdown = '';
  data.months.forEach(m => {
    if (m.entryCount > 0) {
      monthlyBreakdown += `\n• *${m.monthLabel}*: ${fmtCurrency(m.totalJama)} (${m.entryCount} entries)`;
    }
  });

  const text = `⭐ *INVESTOR JAMA REGISTER (سرمایہ کار جمع رجسٹر)*
📅 *Period:* ${periodLabel}
──────────────────
💰 *Total Jama:* ${fmtCurrency(displayedJama)}
📋 *Total Entries:* ${displayedEntries}
👥 *Investor Parties:* ${data.investorsCount}
──────────────────
*Month-wise Summary:*${monthlyBreakdown}
──────────────────
_Generated from Textile Costing & Cashbook_`;

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}
window.generateInvestorRegisterPDF = generateInvestorRegisterPDF;
window.shareInvestorRegisterWhatsApp = shareInvestorRegisterWhatsApp;

// ═══════════════════════════════════════════════════════════
//  CONTRACTS MANAGEMENT (معاہدے / Fabric Contracts)
// ═══════════════════════════════════════════════════════════

let contractsList = [];
let currentContractDetail = null;

async function loadContractsDashboard(search = '') {
  try {
    const url = `${CONTRACTS_API}${search ? '?q=' + encodeURIComponent(search) : ''}`;
    const contracts = await apiGet(url);
    contractsList = contracts || [];

    const totalContracts = contractsList.length;
    $('cbCount').textContent = `(${totalContracts} Contracts)`;

    if (totalContracts === 0) {
      $('cbMainList').innerHTML = `
        <div class="empty-state" style="padding: 2.5rem 1rem; text-align: center;">
          <div class="empty-icon" style="font-size: 2.5rem; margin-bottom: 0.75rem;">📝</div>
          <p style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">
            ${search ? 'No contracts match your search.' : 'No fabric contracts created yet.'}
          </p>
          <p style="font-size: 0.8125rem; color: var(--text-secondary); max-width: 400px; margin: 0 auto 1.25rem;">
            Create textile sales and purchase contracts with custom yarn counts, reed, pick, delivery terms (Hazar / Amdan), and live rate calculations.
          </p>
          <button class="btn btn-primary" onclick="openNewContractModal()" style="background: #0284c7; color: #fff; font-weight: 700; padding: 8px 18px;">
            📝 ＋ Create First Contract
          </button>
        </div>
      `;
      return;
    }

    // Contract List Cards
    const listHtml = `
      <div class="cb-contracts-list" style="display: flex; flex-direction: column; gap: 10px;">
        ${contractsList.map(c => {
          const isHazar = c.deliveryType === 'hazar';
          const deliveryBadge = isHazar
            ? `<span style="background: rgba(37,99,235,0.15); color: #60a5fa; border: 1px solid rgba(37,99,235,0.3); font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; font-weight: 700;">⚡ Hazar (${formatDate(c.date)})</span>`
            : `<span style="background: rgba(217,119,6,0.15); color: #fbbf24; border: 1px solid rgba(217,119,6,0.3); font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; font-weight: 700;">📅 Amdan (${formatDate(c.deliveryDate || c.date)})</span>`;

          const specsText = (c.warpCount || c.weftCount || c.reed || c.pick)
            ? `${c.warpCount}x${c.weftCount} / ${c.reed}x${c.pick} / ${c.width}"`
            : (c.quality || '—');

          return `
            <div class="cb-party-card" style="cursor: pointer; transition: all 0.2s ease; border-left: 4px solid ${isHazar ? '#2563eb' : '#d97706'};" onclick="openContractDetailModal('${c._id}')">
              <div class="cb-party-card-left" style="flex: 2;">
                <div class="cb-party-info">
                  <div class="cb-party-name-row" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="background: var(--accent-primary); color: #fff; font-size: 0.75rem; font-weight: 800; padding: 2px 6px; border-radius: 4px;">#${c.contractNo}</span>
                    <span class="cb-party-name" style="font-size: 0.95rem;">
                      <span style="color: #60a5fa;">${escapeHtml(c.purchaserName)}</span>
                      <span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 400; margin: 0 4px;">purchased from</span>
                      <span style="color: #4ade80;">${escapeHtml(c.sellerName)}</span>
                    </span>
                    ${deliveryBadge}
                  </div>
                  <div class="cb-party-meta" style="margin-top: 4px; display: flex; gap: 10px; flex-wrap: wrap; font-size: 0.8125rem;">
                    <span>🧵 <strong>${escapeHtml(c.quality || specsText)}</strong></span>
                    <span>📦 <strong>${(c.quantity || 0).toLocaleString()}</strong> ${escapeHtml(c.quantityUnit || 'Meters')}</span>
                    ${c.broker ? `<span>👤 Broker: <strong>${escapeHtml(c.broker)}</strong></span>` : ''}
                    ${c.gudamMuqam ? `<span>📍 <strong>${escapeHtml(c.gudamMuqam)}</strong></span>` : ''}
                  </div>
                </div>
              </div>
              <div class="cb-party-card-right" style="flex: 1; text-align: right; display: flex; flex-direction: column; justify-content: center; align-items: flex-end;">
                <div>
                  ${c.rateLabel ? `<div style="font-size: 0.75rem; font-weight: 800; color: #f59e0b; margin-bottom: 2px;">💰 ${escapeHtml(c.rateLabel)}${c.rateLabel.endsWith('+') ? ' (GST)' : ''}</div>` : ''}
                  <div style="font-size: 1.15rem; font-weight: 800; color: #10b981;">₹ ${c.rate ? c.rate.toFixed(2) : '0.00'} <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">/ ${escapeHtml(c.quantityUnit || 'Meter')}</span></div>
                </div>
                <div style="margin-top: 6px; display: flex; gap: 6px;" onclick="event.stopPropagation();">
                  <button class="btn-action edit" onclick="openEditContractModal('${c._id}')" title="Edit Contract">✏️</button>
                  <button class="btn-action delete" onclick="deleteContract('${c._id}', ${c.contractNo})" title="Delete Contract">🗑️</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    $('cbMainList').innerHTML = listHtml;
  } catch (err) {
    toast('Failed to load contracts: ' + err.message, 'error');
  }
}

// ── Contract Modal Interactions ──
function openNewContractModal() {
  $('contractForm').reset();
  $('contractModalId').value = '';
  $('contractModalTitle').textContent = '📝 New Contract (معاہدہ اندراج)';

  const today = new Date().toISOString().slice(0, 10);
  $('contractDate').value = today;
  $('contractTypeHazar').checked = true;
  $('contractDeliveryDate').value = today;

  populatePartyDatalist();
  $('contractModal').classList.remove('hidden');
}

async function openEditContractModal(id) {
  try {
    const c = await apiGet(`${CONTRACTS_API}/${id}`);
    if (!c) return;

    $('contractModalId').value = c._id;
    $('contractModalTitle').textContent = `✏️ Edit Contract #${c.contractNo}`;

    $('contractDate').value = c.date ? new Date(c.date).toISOString().slice(0, 10) : '';
    $('contractBroker').value = c.broker || '';
    $('contractPurchaser').value = c.purchaserName || '';
    $('contractSeller').value = c.sellerName || '';

    $('contractWarpCount').value = c.warpCount || '';
    $('contractWeftCount').value = c.weftCount || '';
    $('contractReed').value = c.reed || '';
    $('contractPick').value = c.pick || '';
    $('contractWidth').value = c.width || '';

    $('contractQuality').value = c.quality || '';
    $('contractQuantity').value = c.quantity || '';
    $('contractQuantityUnit').value = c.quantityUnit || 'Meters';

    if (c.deliveryType === 'amdan') {
      $('contractTypeAmdan').checked = true;
    } else {
      $('contractTypeHazar').checked = true;
    }
    $('contractDeliveryDate').value = c.deliveryDate ? new Date(c.deliveryDate).toISOString().slice(0, 10) : '';

    $('contractGudam').value = c.gudamMuqam || '';
    $('contractWarpRate').value = c.warpRate || '';
    $('contractWeftRate').value = c.weftRate || '';
    $('contractConversion').value = c.conversion || '';
    $('contractRateLabel').value = c.rateLabel || '';
    $('contractRate').value = c.rate || '';
    $('contractNote').value = c.note || '';
    // Show hint if rateLabel exists
    if (c.rateLabel && c.rateLabel.trim()) {
      parseAndApplyRateLabel(c.rateLabel.trim(), false);
    }

    populatePartyDatalist();
    $('contractModal').classList.remove('hidden');
  } catch (err) {
    toast('Failed to load contract: ' + err.message, 'error');
  }
}

function closeContractModal() {
  $('contractModal').classList.add('hidden');
}

function onContractDeliveryTypeChange() {
  const isHazar = $('contractTypeHazar').checked;
  if (isHazar) {
    const cDate = $('contractDate').value || new Date().toISOString().slice(0, 10);
    $('contractDeliveryDate').value = cDate;
  }
}

// Auto-fill quality name from specs
if ($('btnAutoQuality')) {
  $('btnAutoQuality').addEventListener('click', () => {
    const warp = $('contractWarpCount').value.trim();
    const weft = $('contractWeftCount').value.trim();
    const reed = $('contractReed').value.trim();
    const pick = $('contractPick').value.trim();
    const width = $('contractWidth').value.trim();

    if (warp && weft && reed && pick && width) {
      $('contractQuality').value = `${warp}x${weft} / ${reed}x${pick} / ${width}" Cotton`;
      toast('Quality auto-generated from specs!', 'info');
    } else if (warp && weft && reed && pick) {
      $('contractQuality').value = `${warp}x${weft} / ${reed}x${pick}`;
      toast('Quality auto-generated from specs!', 'info');
    } else {
      toast('Please enter Warp, Weft, Reed, and Pick specs first.', 'warning');
    }
  });
}

// Auto calculate fabric rate live whenever warp rate, weft rate, conversion or specs change
function autoCalculateContractRate() {
  const warpCount = parseFloat($('contractWarpCount')?.value) || 0;
  const weftCount = parseFloat($('contractWeftCount')?.value) || 0;
  const reed = parseFloat($('contractReed')?.value) || 0;
  const pick = parseFloat($('contractPick')?.value) || 0;
  const width = parseFloat($('contractWidth')?.value) || 0;
  const warpRate = parseFloat($('contractWarpRate')?.value) || 0;
  const weftRate = parseFloat($('contractWeftRate')?.value) || 0;
  const conversionRate = parseFloat($('contractConversion')?.value) || 0;

  if (warpCount > 0 && weftCount > 0 && reed > 0 && pick > 0 && width > 0 && (warpRate > 0 || weftRate > 0 || conversionRate > 0)) {
    const warpWeightMeter = (reed * width / 20 / warpCount) * 1.0936;
    const warpCostMeter = (warpWeightMeter * warpRate) / 40;

    const weftWeightMeter = (pick * width / 20 / weftCount) * 1.0936;
    const weftCostMeter = (weftWeightMeter * weftRate) / 40;

    const manfCostMeter = conversionRate * pick;
    const totalCostMeter = warpCostMeter + weftCostMeter + manfCostMeter;

    if ($('contractRate')) {
      $('contractRate').value = totalCostMeter.toFixed(2);
    }
  }
}

// ── Quick Rate Label Parser (e.g. "291+" = 291 × 1.18 GST) ──
function parseAndApplyRateLabel(label, applyToRate = true) {
  const hint = $('rateLabelHint');
  if (!label || !label.trim()) {
    if (hint) hint.style.display = 'none';
    return;
  }
  label = label.trim();

  if (label.endsWith('+')) {
    const base = parseFloat(label.replace(/\+$/, ''));
    if (!isNaN(base) && base > 0) {
      const gstRate = Math.round(base * 1.18 * 100) / 100;
      if (applyToRate && $('contractRate')) {
        $('contractRate').value = gstRate.toFixed(2);
      }
      if (hint) {
        hint.style.display = 'block';
        hint.innerHTML = `✅ <strong>${base}</strong> × 1.18 (GST) = <strong>₹ ${gstRate.toFixed(2)}</strong> final rate`;
      }
    }
  } else {
    const base = parseFloat(label);
    if (!isNaN(base) && base > 0) {
      if (applyToRate && $('contractRate')) {
        $('contractRate').value = base;
      }
      if (hint) {
        hint.style.display = 'block';
        hint.innerHTML = `✅ Direct rate: <strong>₹ ${base}</strong> (no GST)`;
      }
    } else {
      if (hint) hint.style.display = 'none';
    }
  }
}

// Bind rateLabel live input
if ($('contractRateLabel')) {
  $('contractRateLabel').addEventListener('input', function () {
    parseAndApplyRateLabel(this.value, true);
  });
  $('contractRateLabel').addEventListener('change', function () {
    parseAndApplyRateLabel(this.value, true);
  });
}

// Bind live auto-calculation listeners
[
  'contractWarpCount',
  'contractWeftCount',
  'contractReed',
  'contractPick',
  'contractWidth',
  'contractWarpRate',
  'contractWeftRate',
  'contractConversion'
].forEach(id => {
  const el = $(id);
  if (el) {
    el.addEventListener('input', autoCalculateContractRate);
    el.addEventListener('change', autoCalculateContractRate);
  }
});

// Listen to contract date change to sync Hazar delivery date
if ($('contractDate')) {
  $('contractDate').addEventListener('change', () => {
    if ($('contractTypeHazar') && $('contractTypeHazar').checked) {
      $('contractDeliveryDate').value = $('contractDate').value;
    }
  });
}

async function saveContractForm() {
  try {
    const id = $('contractModalId').value;
    const date = $('contractDate').value;
    const purchaserName = $('contractPurchaser').value.trim();
    const sellerName = $('contractSeller').value.trim();
    const broker = $('contractBroker').value.trim();

    const warpCount = parseFloat($('contractWarpCount').value) || 0;
    const weftCount = parseFloat($('contractWeftCount').value) || 0;
    const reed = parseFloat($('contractReed').value) || 0;
    const pick = parseFloat($('contractPick').value) || 0;
    const width = parseFloat($('contractWidth').value) || 0;

    const quality = $('contractQuality').value.trim();
    const quantity = parseFloat($('contractQuantity').value) || 0;
    const quantityUnit = $('contractQuantityUnit').value;

    const deliveryType = $('contractTypeAmdan').checked ? 'amdan' : 'hazar';
    let deliveryDate = $('contractDeliveryDate').value;
    if (deliveryType === 'hazar') {
      deliveryDate = date;
    }

    const warpRate = parseFloat($('contractWarpRate').value) || 0;
    const weftRate = parseFloat($('contractWeftRate').value) || 0;
    const conversion = parseFloat($('contractConversion').value) || 0;
    const rateLabel = ($('contractRateLabel')?.value || '').trim();
    const rate = parseFloat($('contractRate').value) || 0;
    const gudamMuqam = $('contractGudam').value.trim();
    const note = $('contractNote').value.trim();

    if (!purchaserName || !sellerName) {
      toast('Purchaser Name and Seller Name are required.', 'error');
      return;
    }

    if (!rate || rate <= 0) {
      toast('Please enter or calculate the final fabric rate.', 'error');
      return;
    }

    const payload = {
      date,
      purchaserName,
      sellerName,
      broker,
      warpCount,
      weftCount,
      reed,
      pick,
      width,
      quality,
      quantity,
      quantityUnit,
      deliveryType,
      deliveryDate,
      warpRate,
      weftRate,
      conversion,
      rateLabel,
      rate,
      gudamMuqam,
      status: 'active',
      note
    };

    if (id) {
      await apiPut(`${CONTRACTS_API}/${id}`, payload);
      toast('Contract updated successfully!', 'success');
    } else {
      await apiPost(CONTRACTS_API, payload);
      toast('Contract created successfully!', 'success');
    }

    closeContractModal();
    loadContractsDashboard($('cbSearchInput') ? $('cbSearchInput').value.trim() : '');
  } catch (err) {
    toast('Failed to save contract: ' + err.message, 'error');
  }
}

// ── Contract Detail View & PDF ──
async function openContractDetailModal(id) {
  try {
    const c = await apiGet(`${CONTRACTS_API}/${id}`);
    if (!c) return;

    currentContractDetail = c;
    const totalAmt = (c.quantity || 0) * (c.rate || 0);
    const isHazar = c.deliveryType === 'hazar';

    $('contractDetailModalTitle').textContent = `📜 Contract #${c.contractNo} Details`;

    const specsText = (c.warpCount || c.weftCount || c.reed || c.pick)
      ? `${c.warpCount}x${c.weftCount} / ${c.reed}x${c.pick} / ${c.width}"`
      : '—';

    $('contractDetailModalBody').innerHTML = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--text-primary);">
        
        <!-- Header Info Card -->
        <div style="background: linear-gradient(135deg, #0f172a, #1e3a8a); color: #fff; padding: 14px; border-radius: 8px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 1.15rem; font-weight: 800; letter-spacing: 0.5px;">CONTRACT #${c.contractNo} (معاہدہ)</span>
            <span style="background: ${isHazar ? '#2563eb' : '#d97706'}; color: #fff; font-size: 0.75rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
              ${isHazar ? '⚡ Hazar (حاضر)' : '📅 Amdan (آمدن)'}
            </span>
          </div>
          <div style="font-size: 0.8125rem; color: #93c5fd; display: flex; gap: 14px; flex-wrap: wrap;">
            <span>📅 Date: <strong>${formatDate(c.date)}</strong></span>
            <span>🚚 Delivery Date: <strong>${formatDate(c.deliveryDate || c.date)}</strong></span>
            ${c.broker ? `<span>👤 Broker: <strong>${escapeHtml(c.broker)}</strong></span>` : ''}
          </div>
        </div>

        <!-- Parties Box -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
          <div style="background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.25); border-radius: 6px; padding: 10px 12px;">
            <div style="font-size: 0.75rem; color: #60a5fa; font-weight: 700; text-transform: uppercase;">🛒 Purchaser / Buyer (خریدار)</div>
            <div style="font-size: 1rem; font-weight: 800; color: var(--text-primary); margin-top: 2px;">${escapeHtml(c.purchaserName)}</div>
          </div>
          <div style="background: rgba(22,163,74,0.08); border: 1px solid rgba(22,163,74,0.25); border-radius: 6px; padding: 10px 12px;">
            <div style="font-size: 0.75rem; color: #4ade80; font-weight: 700; text-transform: uppercase;">🏭 Seller / Supplier (بیچنے والا)</div>
            <div style="font-size: 1rem; font-weight: 800; color: var(--text-primary); margin-top: 2px;">${escapeHtml(c.sellerName)}</div>
          </div>
        </div>

        <!-- Specs & Commercials Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 0.875rem;">
          <tr style="border-bottom: 1px solid var(--border-color, #334155);"><td style="padding: 6px 4px; color: var(--text-secondary); width: 40%;">Quality / Description</td><td style="padding: 6px 4px; font-weight: 700; text-align: right;">${escapeHtml(c.quality || '—')}</td></tr>
          <tr style="border-bottom: 1px solid var(--border-color, #334155);"><td style="padding: 6px 4px; color: var(--text-secondary);">Construction (Specs)</td><td style="padding: 6px 4px; font-weight: 700; text-align: right;">${escapeHtml(specsText)}</td></tr>
          <tr style="border-bottom: 1px solid var(--border-color, #334155);"><td style="padding: 6px 4px; color: var(--text-secondary);">Quantity</td><td style="padding: 6px 4px; font-weight: 800; text-align: right; color: #60a5fa;">${(c.quantity || 0).toLocaleString()} ${escapeHtml(c.quantityUnit || 'Meters')}</td></tr>
          <tr style="border-bottom: 1px solid var(--border-color, #334155);"><td style="padding: 6px 4px; color: var(--text-secondary);">Fabric Rate</td><td style="padding: 6px 4px; font-weight: 800; text-align: right; color: #10b981;">₹ ${c.rate ? c.rate.toFixed(2) : '0.00'} / ${escapeHtml(c.quantityUnit || 'Meter')}${c.rateLabel ? ` <span style="font-size: 0.8rem; font-weight: 700; color: #f59e0b; margin-left: 6px;">(${escapeHtml(c.rateLabel)}${c.rateLabel.endsWith('+') ? ' GST' : ''})</span>` : ''}</td></tr>
          ${c.gudamMuqam ? `<tr style="border-bottom: 1px solid var(--border-color, #334155);"><td style="padding: 6px 4px; color: var(--text-secondary);">Gudam / Muqam (گودام / مقام)</td><td style="padding: 6px 4px; font-weight: 700; text-align: right;">${escapeHtml(c.gudamMuqam)}</td></tr>` : ''}
        </table>

        <!-- Costing Details (If Available) -->
        ${(c.warpRate || c.weftRate || c.conversion) ? `
          <div style="background: var(--bg-surface-secondary, rgba(255,255,255,0.03)); border: 1px solid var(--border-color, #334155); border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 0.8125rem;">
            <div style="font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase;">Costing Factors</div>
            <div style="display: flex; gap: 14px; flex-wrap: wrap;">
              <span>Warp Rate: <strong>₹ ${c.warpRate || 0}</strong></span>
              <span>Weft Rate: <strong>₹ ${c.weftRate || 0}</strong></span>
              <span>Conversion: <strong>₹ ${c.conversion || 0}</strong></span>
            </div>
          </div>
        ` : ''}

        <!-- Notes / Remarks -->
        ${c.note ? `
          <div style="background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.25); border-radius: 6px; padding: 8px 12px; font-size: 0.8125rem; color: var(--text-primary);">
            <strong style="color: #fbbf24;">Note / Terms:</strong> ${escapeHtml(c.note)}
          </div>
        ` : ''}
      </div>
    `;

    // Action button listeners
    $('btnShareContractPDF').onclick = () => generateContractPDF(c, 'share');
    $('btnDownloadContractPDF').onclick = () => generateContractPDF(c, 'download');
    $('btnEditContract').onclick = () => {
      closeContractDetailModal();
      openEditContractModal(c._id);
    };
    $('btnDeleteContract').onclick = () => deleteContract(c._id, c.contractNo);

    $('contractDetailModal').classList.remove('hidden');
  } catch (err) {
    toast('Failed to load contract details: ' + err.message, 'error');
  }
}

function closeContractDetailModal() {
  $('contractDetailModal').classList.add('hidden');
}

async function deleteContract(id, contractNo) {
  if (!confirm(`Are you sure you want to delete Contract #${contractNo}? This cannot be undone.`)) {
    return;
  }
  try {
    await apiDelete(`${CONTRACTS_API}/${id}`);
    toast(`Contract #${contractNo} deleted successfully!`, 'success');
    closeContractDetailModal();
    loadContractsDashboard($('cbSearchInput') ? $('cbSearchInput').value.trim() : '');
  } catch (err) {
    toast('Failed to delete contract: ' + err.message, 'error');
  }
}

// ── Generate Contract PDF (Printable & Shareable Slip) ──
async function generateContractPDF(c, action = 'download') {
  try {
    toast(action === 'share' ? 'Preparing Contract PDF to share...' : 'Downloading Contract PDF...', 'info');

    const isHazar = c.deliveryType === 'hazar';
    const dateStr = formatDate(c.date);
    const deliveryDateStr = formatDate(c.deliveryDate || c.date);

    const container = document.createElement('div');
    container.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 720px; z-index: -99999; pointer-events: none;';

    const specsText = (c.warpCount || c.weftCount || c.reed || c.pick)
      ? `${c.warpCount}x${c.weftCount} / ${c.reed}x${c.pick} / ${c.width}"`
      : '—';

    container.innerHTML = `
      <div id="contractPdfRoot" style="padding: 24px; font-family: 'Inter', 'Noto Sans Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif; color: #0f172a; background: #ffffff; width: 720px; max-width: 720px; box-sizing: border-box; margin: 0 auto; text-rendering: optimizeLegibility;">
        
        <!-- Header -->
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
          <div style="text-align: center; margin-bottom: 8px;">
            <div style="font-size: 26px; font-weight: 900; color: #1e40af; letter-spacing: 2px; text-transform: uppercase; line-height: 1.2;">
              NA TRADERS
            </div>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Textile Costing & Cashbook System</p>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 8px;">
            <h1 style="margin: 0; font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; text-transform: uppercase;">
              FABRIC CONTRACT
            </h1>
            <div style="font-size: 12px; color: #64748b;">Date: <strong>${dateStr}</strong></div>
          </div>
        </div>

        <!-- Parties Box -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
          <div style="border: 1.5px solid #2563eb; border-radius: 6px; padding: 12px; background: #f8fafc;">
            <div style="font-size: 11px; font-weight: 800; color: #2563eb; margin-bottom: 4px;">
              <span style="text-transform: uppercase;">PURCHASER</span> / <span dir="rtl" style="direction: rtl; unicode-bidi: embed; font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif;">خریدار</span>
            </div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${escapeHtml(c.purchaserName)}</div>
          </div>
          <div style="border: 1.5px solid #16a34a; border-radius: 6px; padding: 12px; background: #f8fafc;">
            <div style="font-size: 11px; font-weight: 800; color: #16a34a; margin-bottom: 4px;">
              <span style="text-transform: uppercase;">SELLER</span> / <span dir="rtl" style="direction: rtl; unicode-bidi: embed; font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif;">بیچنے والا</span>
            </div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${escapeHtml(c.sellerName)}</div>
          </div>
        </div>

        <!-- Delivery & Broker Meta -->
        <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; display: grid; grid-template-columns: ${c.broker && c.broker.trim() ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'}; gap: 10px; font-size: 12px;">
          <div>
            <span style="color: #64748b; font-weight: 600;">Delivery Mode:</span><br>
            <strong style="color: ${isHazar ? '#2563eb' : '#d97706'}; font-size: 14px;">${isHazar ? '<span dir="rtl" style="direction: rtl; unicode-bidi: embed;">حاضر</span>' : '<span dir="rtl" style="direction: rtl; unicode-bidi: embed;">آمدن</span>'}</strong>
          </div>
          <div>
            <span style="color: #64748b; font-weight: 600;">Delivery Date:</span><br>
            <strong style="font-size: 13px;">${deliveryDateStr}</strong>
          </div>
          ${c.broker && c.broker.trim() ? `
          <div>
            <span style="color: #64748b; font-weight: 600;">Broker / <span dir="rtl" style="direction: rtl; unicode-bidi: embed;">ایجنٹ</span>:</span><br>
            <strong style="font-size: 13px;">${escapeHtml(c.broker.trim())}</strong>
          </div>
          ` : ''}
        </div>

        <!-- Fabric Specifications Table -->
        <table style="width: 100%; table-layout: fixed; border-collapse: collapse; border: 1.5px solid #0f172a; margin-bottom: 16px; font-size: 12px;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff;">
              <th style="padding: 8px 10px; text-align: left; width: 45%;">Fabric Quality & Description</th>
              <th style="padding: 8px 10px; text-align: center; width: 20%;">Construction</th>
              <th style="padding: 8px 10px; text-align: center; width: 15%;">Quantity</th>
              <th style="padding: 8px 10px; text-align: right; width: 20%;">Rate / Unit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 12px 10px; font-size: 13px; font-weight: 800; color: #0f172a; border-right: 1px solid #cbd5e1;">
                ${escapeHtml(c.quality || 'Standard Cotton Fabric')}
                ${c.gudamMuqam ? `
                  <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #cbd5e1; display: flex; align-items: center; gap: 6px;">
                    <span dir="rtl" style="direction: rtl; unicode-bidi: embed; font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif; font-size: 15px; font-weight: 900; color: #1e40af;">گودام:</span>
                    <span style="font-size: 13.5px; font-weight: 800; color: #0f172a;">${escapeHtml(c.gudamMuqam)}</span>
                  </div>
                ` : ''}
              </td>
              <td style="padding: 12px 10px; text-align: center; font-size: 12px; font-weight: 700; border-right: 1px solid #cbd5e1;">
                ${escapeHtml(specsText)}
              </td>
              <td style="padding: 12px 10px; text-align: center; font-size: 13px; font-weight: 800; color: #2563eb; border-right: 1px solid #cbd5e1;">
                ${(c.quantity || 0).toLocaleString()} ${escapeHtml(c.quantityUnit || 'Mtrs')}
              </td>
              <td style="padding: 12px 10px; text-align: right; font-size: 14px; font-weight: 900; color: #16a34a;">
                ₹ ${c.rate ? c.rate.toFixed(2) : '0.00'}
                ${c.rateLabel ? `<div style="font-size: 10px; font-weight: 700; color: #b45309; margin-top: 2px;">(${escapeHtml(c.rateLabel)}${c.rateLabel.endsWith('+') ? ' GST' : ''})</div>` : ''}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Notes / Special Terms -->
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 28px; background: #fafafa; font-size: 11.5px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 4px; text-transform: uppercase;">Terms & Conditions:</div>
          <div>${escapeHtml(c.note || 'Delivery subject to standard mill quality inspection and agreed payment terms.')}</div>
        </div>


        <!-- Footer -->
        <div style="margin-top: 24px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 10px; color: #94a3b8;">
          ${new Date().toLocaleDateString()} · Generated by Textile Costing & Cashbook Application · Developed by HU-Software Solutions
        </div>
      </div>
    `;

    document.body.appendChild(container);

    const fileName = `Contract_${c.contractNo}_${(c.purchaserName || 'Party').replace(/\s+/g, '_')}.pdf`;
    const opt = {
      margin: [6, 6, 6, 6],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
      const targetElement = container.querySelector('#contractPdfRoot') || container.firstElementChild;
      const pdfWorker = html2pdf().set(opt).from(targetElement);
      const pdfBlob = await pdfWorker.output('blob');
      if (container.parentNode) document.body.removeChild(container);

      if (action === 'share') {
        const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          try {
            await navigator.share({
              files: [pdfFile],
              title: `Contract #${c.contractNo} - ${c.purchaserName}`,
              text: `Fabric Contract #${c.contractNo}: ${c.purchaserName} from ${c.sellerName} (${specsText})`,
            });
            toast('Shared Contract PDF successfully!', 'success');
            return;
          } catch (shareErr) {
            if (shareErr.name === 'AbortError') return;
          }
        }
      }

      // Direct download
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast('Downloaded Contract PDF successfully!', 'success');
    } else {
      if (container.parentNode) document.body.removeChild(container);
      window.print();
    }
  } catch (err) {
    toast('PDF generation failed: ' + err.message, 'error');
  }
}

// Window Globals for Contracts
window.openNewContractModal = openNewContractModal;
window.openEditContractModal = openEditContractModal;
window.closeContractModal = closeContractModal;
window.onContractDeliveryTypeChange = onContractDeliveryTypeChange;
window.saveContractForm = saveContractForm;
window.openContractDetailModal = openContractDetailModal;
window.closeContractDetailModal = closeContractDetailModal;
window.deleteContract = deleteContract;

// ═══════════════════════════════════════════════════════════
//  KHATA VIEW (Party History with Running Balance)
// ═══════════════════════════════════════════════════════════

async function openKhata(khataNo) {
  try {
    const data = await apiGet(`${CB_API}/khata/${khataNo}`);
    currentKhataNo = khataNo;
    currentKhataParty = data.party;

    const p = data.party;
    const s = data.summary;

    $('khataTitle').textContent = `${p.name} — Khata #${p.khataNo}`;

    const balClass = s.balance > 0 ? 'positive' : s.balance < 0 ? 'negative' : 'zero';
    $('khataPartyInfo').innerHTML = `
      <div class="cb-khata-info">
        <div class="cb-khata-info-left">
          <span class="cb-khata-info-icon">👤</span>
          <div>
            <div class="cb-khata-info-name">${escapeHtml(p.name)}</div>
            <div class="cb-khata-info-details">
              <span>Khata #${p.khataNo}</span>
              ${p.phone ? `<span>📞 ${escapeHtml(p.phone)}</span>` : ''}
              ${p.description ? `<span>${escapeHtml(p.description)}</span>` : ''}
              ${s.totalBags > 0 ? `<span> · 📦 ${s.totalBags} bags</span>` : ''}
              ${(s.totalMeters && s.totalMeters > 0) ? `<span> · 📏 ${s.totalMeters} meters</span>` : ''}
            </div>
          </div>
        </div>
        <div class="cb-khata-info-right">
          <div class="cb-khata-balance-big ${balClass}">${fmtCurrency(Math.abs(s.balance))}</div>
          <div class="cb-khata-balance-label-big">${s.balance >= 0 ? 'Jama Balance (Remaining)' : 'Naam Balance (Remaining)'}</div>
        </div>
      </div>
    `;

    const hasInitial = (data.initialAmount || 0) > 0;
    const hasEntries = data.entries && data.entries.length > 0;

    if (!hasInitial && !hasEntries) {
      $('khataContent').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📜</div>
          <p>No entries or initial amount for this party yet.</p>
        </div>
      `;
    } else {
      const initialRowHtml = hasInitial ? `
        <tr style="background: rgba(30, 64, 175, 0.04); font-weight: 600;">
          <td>${formatDate(p.createdAt || new Date())}</td>
          <td class="col-roker"><span style="font-size: 0.75rem; color: var(--accent-primary); font-weight: 800;">OPENING</span></td>
          <td class="col-desc"><em>Initial Khata Amount / ابتدائی رقم</em></td>
          <td class="col-bags">—</td>
          <td class="col-meters">—</td>
          <td class="col-rate">—</td>
          <td class="col-naam">${data.initialType === 'banam' ? fmtCurrency(data.initialAmount) : '—'}</td>
          <td class="col-jama">${(data.initialType === 'jama' || data.initialType === 'cash') ? fmtCurrency(data.initialAmount) : '—'}</td>
          <td class="col-remaining ${data.initialBalance > 0 ? 'positive' : data.initialBalance < 0 ? 'negative' : ''}"><strong>${fmtCurrency(data.initialBalance)}</strong></td>
          <td></td>
        </tr>
      ` : '';

      $('khataContent').innerHTML = `
        <div class="cb-khata-table-wrapper">
          <table class="cb-khata-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Roker #</th>
                <th>Description</th>
                <th>Bags</th>
                <th>Meters</th>
                <th>Rate</th>
                <th style="text-align:right">Naam (Debit)</th>
                <th style="text-align:right">Jama (Credit)</th>
                <th style="text-align:right">Remaining (Balance)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.entries.map(e => {
                const remClass = e.remaining > 0 ? 'positive' : e.remaining < 0 ? 'negative' : '';
                return `
                  <tr>
                    <td>${formatDate(e.date)}</td>
                    <td class="col-roker">
                      <strong style="color: var(--accent-primary); cursor: pointer;" onclick="openRokerDetail(${e.rokerNo})" title="View Roker #${e.rokerNo}">
                        #${e.rokerNo} ↗
                      </strong>
                    </td>
                    <td class="col-desc" title="${escapeHtml(e.description)}">
                      ${escapeHtml(e.description)}
                      ${e.isCash ? '<span style="background: #dcfce7; color: #15803d; font-size: 0.65rem; padding: 2px 5px; margin-left: 4px; border-radius: 4px; font-weight: 700;">💵 Cash</span>' : ''}
                    </td>
                    <td class="col-bags">${e.bags > 0 ? e.bags : '—'}</td>
                    <td class="col-meters">${e.meters > 0 ? e.meters : '—'}</td>
                    <td class="col-rate">${fmtRate(getEntryRate(e))}</td>
                    <td class="col-naam">${e.naam > 0 ? fmtCurrency(e.naam) : '—'}</td>
                    <td class="col-jama">${e.jama > 0 ? fmtCurrency(e.jama) : '—'}</td>
                    <td class="col-remaining ${remClass}">${fmtCurrency(e.remaining)}</td>
                    <td>
                      <button class="btn-action edit" onclick="event.stopPropagation(); openEditEntry('${e._id}')" title="Edit Entry">✏️</button>
                      <button class="btn-action delete" onclick="event.stopPropagation(); deleteCbEntry('${e._id}')" title="Delete Entry">🗑️</button>
                    </td>
                  </tr>
                `;
              }).join('')}
              ${initialRowHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3"><strong>Cumulative Totals</strong></td>
                <td class="col-bags"><strong>${s.totalBags > 0 ? s.totalBags : '—'}</strong></td>
                <td class="col-meters"><strong>${(s.totalMeters && s.totalMeters > 0) ? s.totalMeters : '—'}</strong></td>
                <td class="col-rate">—</td>
                <td class="col-naam"><strong>${fmtCurrency(s.totalNaam)}</strong></td>
                <td class="col-jama"><strong>${fmtCurrency(s.totalJama)}</strong></td>
                <td class="col-remaining ${balClass}"><strong>${fmtCurrency(s.balance)}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    showView(viewKhata);
  } catch (err) {
    toast(err.message, 'error');
  }
}

$('btnKhataBack').addEventListener('click', () => {
  showView(viewCashbookDashboard);
  loadCashbookDashboard();
});

if ($('btnKhataSharePDF')) {
  $('btnKhataSharePDF').addEventListener('click', () => {
    if (currentKhataNo) {
      shareKhataAsPDF(currentKhataNo);
    }
  });
}

// ── Share / Export Khata PDF ───────────────────────────────
async function shareKhataAsPDF(khataNo) {
  if (!khataNo) return;
  try {
    toast('Generating Khata PDF...', 'info');
    const data = await apiGet(`${CB_API}/khata/${khataNo}`);
    if (!data) throw new Error('Khata not found');

    const p = data.party;
    const s = data.summary;
    const hasInitial = (data.initialAmount || 0) > 0;
    const balLabel = s.balance >= 0 ? 'JAMA / CREDIT (REMAINING)' : 'NAAM / DEBIT (REMAINING)';

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';

    const initialRowHtml = hasInitial ? `
      <tr style="background: rgba(30, 64, 175, 0.04); font-weight: 700; border-bottom: 1px solid #cbd5e1;">
        <td style="padding: 5px 3px; font-size: 9.5px;">${formatDate(p.createdAt || new Date())}</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: center; color: #1e40af; font-weight: 800;">OPENING</td>
        <td style="padding: 5px 3px; font-size: 9px; color: #475569;"><em>Initial Khata Amount / ابتدائی رقم</em></td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: center;">—</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: center;">—</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: right;">—</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: right; color: #b91c1c;">${data.initialType === 'banam' ? fmtCurrency(data.initialAmount) : '—'}</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: right; color: #15803d;">${(data.initialType === 'jama' || data.initialType === 'cash') ? fmtCurrency(data.initialAmount) : '—'}</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: right; font-weight: 800; color: ${data.initialBalance >= 0 ? '#15803d' : '#b91c1c'};">${fmtCurrency(data.initialBalance)}</td>
      </tr>
    ` : '';

    const rowsHtml = (data.entries || []).map((e, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background: #f8fafc;' : ''}">
        <td style="padding: 5px 3px; font-size: 9.5px;">${formatDate(e.date)}</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: center; font-weight: 700; color: #2563eb;">#${e.rokerNo}</td>
        <td style="padding: 5px 3px; font-size: 9px; color: #334155;">
          ${escapeHtml(e.description || '—')}
          ${e.isCash ? '<span style="background: #dcfce7; color: #15803d; font-size: 8px; padding: 1px 3px; border-radius: 2px; font-weight: 700; margin-left: 2px;">CASH</span>' : ''}
        </td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: center;">${e.bags > 0 ? e.bags : '—'}</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: center;">${e.meters > 0 ? e.meters : '—'}</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: right; color: #475569;">${fmtRate(getEntryRate(e))}</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: right; font-weight: 700; color: #b91c1c;">${e.naam > 0 ? fmtCurrency(e.naam) : '—'}</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: right; font-weight: 700; color: #15803d;">${e.jama > 0 ? fmtCurrency(e.jama) : '—'}</td>
        <td style="padding: 5px 3px; font-size: 9.5px; text-align: right; font-weight: 800; color: ${e.remaining >= 0 ? '#15803d' : '#b91c1c'};">${fmtCurrency(e.remaining)}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div style="padding: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; background: #ffffff; width: 680px; max-width: 680px; box-sizing: border-box;">
        
        <!-- Header Bar -->
        <div style="background: linear-gradient(135deg, #0f172a, #1e3a8a); color: #ffffff; padding: 12px 16px; border-radius: 6px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.5px; color: #ffffff;">📒 ${escapeHtml(p.name)}</h1>
            <p style="margin: 3px 0 0 0; font-size: 11.5px; color: #93c5fd;">
              Khata <strong>#${p.khataNo}</strong>
              ${p.phone ? ` · 📞 ${escapeHtml(p.phone)}` : ''}
              ${s.totalBags > 0 ? ` · 📦 ${s.totalBags} bags` : ''}
              ${s.totalMeters > 0 ? ` · 📏 ${s.totalMeters} meters` : ''}
            </p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px;">${balLabel}</div>
            <div style="font-size: 18px; font-weight: 800; color: ${s.balance >= 0 ? '#86efac' : '#fca5a5'};">${fmtCurrency(Math.abs(s.balance))}</div>
          </div>
        </div>

        <!-- Info Bar -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 4px; text-align: center;">
            <div style="font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Bags</div>
            <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 2px;">${s.totalBags > 0 ? s.totalBags : '—'}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 4px; text-align: center;">
            <div style="font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Meters</div>
            <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 2px;">${s.totalMeters > 0 ? s.totalMeters : '—'}</div>
          </div>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 6px 4px; text-align: center;">
            <div style="font-size: 9px; color: #b91c1c; font-weight: 700; text-transform: uppercase;">Cumulative Naam</div>
            <div style="font-size: 12px; font-weight: 800; color: #b91c1c; margin-top: 2px;">${fmtCurrency(s.totalNaam)}</div>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 6px 4px; text-align: center;">
            <div style="font-size: 9px; color: #15803d; font-weight: 700; text-transform: uppercase;">Cumulative Jama</div>
            <div style="font-size: 12px; font-weight: 800; color: #15803d; margin-top: 2px;">${fmtCurrency(s.totalJama)}</div>
          </div>
        </div>

        <!-- Table -->
        <table style="width: 100%; table-layout: fixed; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden;">
          <colgroup>
            <col style="width: 68px;">
            <col style="width: 48px;">
            <col style="width: 160px;">
            <col style="width: 46px;">
            <col style="width: 48px;">
            <col style="width: 52px;">
            <col style="width: 82px;">
            <col style="width: 82px;">
            <col style="width: 94px;">
          </colgroup>
          <thead>
            <tr style="background: #0f172a; color: #ffffff; font-size: 9.5px;">
              <th style="padding: 6px 3px; text-align: left;">Date</th>
              <th style="padding: 6px 3px; text-align: center;">Roker #</th>
              <th style="padding: 6px 3px; text-align: left;">Description</th>
              <th style="padding: 6px 3px; text-align: center;">Bags</th>
              <th style="padding: 6px 3px; text-align: center;">Meters</th>
              <th style="padding: 6px 3px; text-align: right;">Rate</th>
              <th style="padding: 6px 3px; text-align: right; color: #fca5a5;">Naam (Debit)</th>
              <th style="padding: 6px 3px; text-align: right; color: #86efac;">Jama (Credit)</th>
              <th style="padding: 6px 3px; text-align: right; color: #93c5fd;">Remaining</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || ''}
            ${initialRowHtml || ''}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; border-top: 2px solid #0f172a; font-weight: 800; font-size: 9.5px;">
              <td colspan="3" style="padding: 6px 6px; text-align: left;">Cumulative Totals</td>
              <td style="padding: 6px 3px; text-align: center;">${s.totalBags > 0 ? s.totalBags : '—'}</td>
              <td style="padding: 6px 3px; text-align: center;">${s.totalMeters > 0 ? s.totalMeters : '—'}</td>
              <td style="padding: 6px 3px; text-align: right;">—</td>
              <td style="padding: 6px 3px; text-align: right; color: #b91c1c;">${fmtCurrency(s.totalNaam)}</td>
              <td style="padding: 6px 3px; text-align: right; color: #15803d;">${fmtCurrency(s.totalJama)}</td>
              <td style="padding: 6px 3px; text-align: right; color: ${s.balance >= 0 ? '#15803d' : '#b91c1c'};">${fmtCurrency(Math.abs(s.balance))}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Footer -->
        <div style="margin-top: 14px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 9.5px; color: #94a3b8;">
          Khata #${p.khataNo} (${escapeHtml(p.name)}) · ${new Date().toLocaleDateString()} · Generated by Textile Costing & Cashbook Application · Developed by HU-Software Solutions
        </div>
      </div>
    `;

    document.body.appendChild(container);

    const cleanParty = (p.name || 'Khata').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Khata_${p.khataNo}_${cleanParty}.pdf`;
    const opt = {
      margin: [6, 6, 6, 6],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0, windowWidth: 700 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
      const pdfWorker = html2pdf().set(opt).from(container.firstElementChild);
      const pdfBlob = await pdfWorker.output('blob');
      if (container.parentNode) document.body.removeChild(container);

      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            files: [pdfFile],
            title: `Khata #${p.khataNo} - ${p.name}`,
            text: `Khata Ledger for ${p.name} (Khata #${p.khataNo})`,
          });
          toast('Shared Khata PDF successfully!', 'success');
          return;
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') return;
        }
      }

      // Download fallback
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast('Downloaded Khata PDF successfully!', 'success');
    } else {
      if (container.parentNode) document.body.removeChild(container);
      window.print();
    }
  } catch (err) {
    toast('PDF generation failed: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════
//  PARTY MANAGEMENT (CRUD)
// ═══════════════════════════════════════════════════════════

if ($('btnNewParty')) {
  $('btnNewParty').addEventListener('click', () => openPartyModal());
}

function openPartyModal(id = null, name = '', amount = 0, type = 'jama', phone = '', isInvestor = false) {
  $('partyForm').reset();
  $('partyModalId').value = id || '';
  $('partyModalName').value = name || '';
  $('partyModalAmount').value = amount || '';
  $('partyModalType').value = (type === 'banam') ? 'banam' : (type === 'cash') ? 'cash' : 'jama';
  $('partyModalPhone').value = phone || '';
  if ($('partyModalIsInvestor')) {
    $('partyModalIsInvestor').checked = Boolean(isInvestor);
  }
  $('partyModalTitle').textContent = id ? '✏️ Edit Party' : '＋ Add New Party';
  $('partyModal').classList.remove('hidden');
}
window.openPartyModal = openPartyModal;

function editPartyFromCard(id, name, amount, type, phone, isInvestor = false) {
  openPartyModal(id, name, amount, type, phone, isInvestor);
}
window.editPartyFromCard = editPartyFromCard;

function closePartyModal() {
  $('partyModal').classList.add('hidden');
}
window.closePartyModal = closePartyModal;

async function savePartyModal() {
  const id = $('partyModalId').value.trim();
  const name = $('partyModalName').value.trim();
  const amount = parseFloat($('partyModalAmount').value) || 0;
  const type = $('partyModalType').value;
  const phone = $('partyModalPhone').value.trim();
  const isInvestor = $('partyModalIsInvestor') ? $('partyModalIsInvestor').checked : false;

  if (!name) {
    toast('Party name is required', 'error');
    return;
  }

  try {
    const payload = {
      name,
      openingBalance: amount,
      balanceType: type,
      phone,
      isInvestor,
    };

    if (id) {
      await apiPut(`${CB_API}/parties/${id}`, payload);
      toast('Party updated successfully');
    } else {
      await apiPost(`${CB_API}/parties`, payload);
      toast('Party added successfully');
    }

    closePartyModal();
    loadCashbookDashboard();
  } catch (err) {
    toast(err.message, 'error');
  }
}
window.savePartyModal = savePartyModal;

async function toggleInvestorParty(id, partyName = '') {
  try {
    const res = await apiPatch(`${CB_API}/parties/${id}/toggle-investor`);
    if (res.isInvestor) {
      toast(`⭐ "${partyName || 'Party'}" marked as Investor!`, 'success');
    } else {
      toast(`"${partyName || 'Party'}" unmarked from Investors.`, 'info');
    }
    loadCashbookDashboard();
  } catch (err) {
    toast(err.message, 'error');
  }
}
window.toggleInvestorParty = toggleInvestorParty;

async function deleteCbParty(id, partyName = '') {
  showConfirm('Delete Party', `Are you sure you want to delete party "${partyName || 'this party'}"?`, async () => {
    try {
      await apiDelete(`${CB_API}/parties/${id}`);
      toast('Party deleted');
      loadCashbookDashboard();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
window.deleteCbParty = deleteCbParty;

// ═══════════════════════════════════════════════════════════
//  ENTRY FORM & DATALIST (Roker Entry System)
// ═══════════════════════════════════════════════════════════

async function populatePartyDatalist() {
  const datalist = $('cbPartyDatalist');
  if (!datalist) return;

  try {
    const parties = await apiGet(`${CB_API}/parties`);
    datalist.innerHTML = parties.map(p => `<option value="${escapeHtml(p.name)}">Khata #${p.khataNo}</option>`).join('');
  } catch (err) {
    // silent
  }
}

function openNewRokerForm() {
  cbReturnTo = 'dashboard';
  openEntryForm();
}

async function populateOpenPurchasesSelect(selectedId = null) {
  const select = $('sellPurchaseSelect');
  if (!select) return;
  select.innerHTML = '<option value="">— Loading open meter purchases... —</option>';
  try {
    const url = selectedId ? `${CB_API}/open-purchases?includeId=${encodeURIComponent(selectedId)}` : `${CB_API}/open-purchases`;
    const openPurchases = await apiGet(url);
    if (!openPurchases || openPurchases.length === 0) {
      select.innerHTML = '<option value="">— None (No open meter purchases available) —</option>';
      return;
    }
    let html = '<option value="">— None (Optional / Unlinked) —</option>';
    openPurchases.forEach(p => {
      const isSel = (selectedId && (p._id === selectedId || p._id === String(selectedId))) ? 'selected' : '';
      const amount = (p.naam || 0) + (p.jama || 0);
      const qtyLeft = (p.meters && p.meters > 0) ? p.meters : p.remainingBags;
      html += `<option value="${p._id}" ${isSel}>R#${p.rokerNo} - ${escapeHtml(p.partyName)} (${qtyLeft} meters left @ ${fmtCurrency(p.ratePerBag || 0)} = ${fmtCurrency(amount)})</option>`;
    });
    select.innerHTML = html;
  } catch (err) {
    select.innerHTML = '<option value="">— Error loading purchases —</option>';
  }
}

function handleTradeTypeChange() {
  // Trade type radio changes
}

function handleCashModeToggle() {
  const isCash = $('entryModeCash') ? $('entryModeCash').checked : false;
  if (isCash) {
    if ($('entryTypeSection')) $('entryTypeSection').style.display = 'none';
  } else {
    if ($('entryTypeSection')) $('entryTypeSection').style.display = '';
  }
}

if ($('entryModeGeneral')) $('entryModeGeneral').addEventListener('change', handleCashModeToggle);
if ($('entryModeCash')) $('entryModeCash').addEventListener('change', handleCashModeToggle);

if ($('entryTypeNormal')) $('entryTypeNormal').addEventListener('change', handleTradeTypeChange);
if ($('entryTypePurchase')) $('entryTypePurchase').addEventListener('change', handleTradeTypeChange);
if ($('entryTypeSell')) $('entryTypeSell').addEventListener('change', handleTradeTypeChange);

async function openEntryForm(preSelectPartyName = null, preSelectRokerNo = null, editData = null, side = 'jama') {
  $('entryForm').reset();
  $('editEntryId').value = '';
  $('entryDate').value = new Date().toISOString().slice(0, 10);
  $('entryPartyName').value = preSelectPartyName || '';
  $('entryDescription').value = '';
  $('entryBags').value = '';
  if ($('entryMeters')) $('entryMeters').value = '';
  $('entryRate').value = '';
  $('entryNaam').value = '';
  $('entryJama').value = '';

  // Show trade type radio section
  if ($('entryTypeSection')) $('entryTypeSection').style.display = '';

  // Determine active side
  let activeSide = side || 'jama';
  if (editData) {
    activeSide = (editData.naam > 0) ? 'banam' : 'jama';
  }
  $('entrySide').value = activeSide;

  // Configure UI for active side
  if (activeSide === 'jama') {
    $('entryFormTitle').textContent = editData ? '✏️ Edit Jama Entry (جمع)' : (preSelectRokerNo ? `🟢 Add Jama Entry to Roker #${preSelectRokerNo}` : '🟢 New Jama Entry (جمع)');
    $('groupJama').style.display = '';
    $('groupNaam').style.display = 'none';
    $('btnSaveEntry').className = 'btn btn-success btn-lg';
    $('btnSaveEntry').style.background = '#15803d';
    $('btnSaveEntry').style.borderColor = '#15803d';
    $('btnSaveEntry').textContent = '💾 Save Jama Entry (جمع)';

    // Jama Entry: Show Purchase Entry & Normal Entry options (hide Sell option)
    if ($('wrapperTypeNormal')) $('wrapperTypeNormal').style.display = '';
    if ($('wrapperTypePurchase')) $('wrapperTypePurchase').style.display = '';
    if ($('wrapperTypeSell')) $('wrapperTypeSell').style.display = 'none';
    if ($('entryTypeSell')) $('entryTypeSell').checked = false;

    if (editData) {
      if (editData.isPurchase && $('entryTypePurchase')) {
        $('entryTypePurchase').checked = true;
      } else if ($('entryTypeNormal')) {
        $('entryTypeNormal').checked = true;
      }
    } else {
      if ($('entryTypePurchase')) $('entryTypePurchase').checked = true; // Default to Purchase for Jama
    }

  } else {
    $('entryFormTitle').textContent = editData ? '✏️ Edit Banam Entry (بنام)' : (preSelectRokerNo ? `🔴 Add Banam Entry to Roker #${preSelectRokerNo}` : '🔴 New Banam Entry (بنام)');
    $('groupNaam').style.display = '';
    $('groupJama').style.display = 'none';
    $('btnSaveEntry').className = 'btn btn-danger btn-lg';
    $('btnSaveEntry').style.background = '#b91c1c';
    $('btnSaveEntry').style.borderColor = '#b91c1c';
    $('btnSaveEntry').textContent = '💾 Save Banam Entry (بنام)';

    // Banam Entry: Show Sell Entry & Normal Entry options (hide Purchase option)
    if ($('wrapperTypeNormal')) $('wrapperTypeNormal').style.display = '';
    if ($('wrapperTypePurchase')) $('wrapperTypePurchase').style.display = 'none';
    if ($('wrapperTypeSell')) $('wrapperTypeSell').style.display = '';
    if ($('entryTypePurchase')) $('entryTypePurchase').checked = false;

    if (editData) {
      if (editData.isSell && $('entryTypeSell')) {
        $('entryTypeSell').checked = true;
      } else if ($('entryTypeNormal')) {
        $('entryTypeNormal').checked = true;
      }
    } else {
      if ($('entryTypeSell')) $('entryTypeSell').checked = true; // Default to Sell for Banam
    }
  }

  // Fetch or set Roker No
  if (!editData) {
    if (preSelectRokerNo) {
      $('entryRokerNo').value = preSelectRokerNo;
    } else {
      try {
        const rokerRes = await apiGet(`${CB_API}/next-roker`);
        if (rokerRes && rokerRes.nextRokerNo) {
          $('entryRokerNo').value = rokerRes.nextRokerNo;
        }
      } catch (e) {
        // silent
      }
    }
  }

  // Populate party datalist & refresh allKnownPartiesList for autocomplete
  populatePartyDatalist();
  populatePartyNamesDatalist();

  // Reset contract rate indicators
  if ($('entryContractBadge')) $('entryContractBadge').style.display = 'none';
  if ($('entryContractHint')) $('entryContractHint').style.display = 'none';

  if (preSelectPartyName) {
    $('entryPartyName').value = preSelectPartyName;
  }

  // Hide suggestions initially
  if ($('entryPartySuggestions')) {
    $('entryPartySuggestions').style.display = 'none';
    $('entryPartySuggestions').innerHTML = '';
  }

  // Fill edit data
  if (editData) {
    $('editEntryId').value = editData._id;
    $('entryDate').value = editData.date ? new Date(editData.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    $('entryRokerNo').value = editData.rokerNo || '';
    $('entryPartyName').value = editData.partyName || '';
    $('entryDescription').value = editData.description || '';
    $('entryBags').value = (editData.bags && editData.bags > 0) ? editData.bags : '';
    if ($('entryMeters')) $('entryMeters').value = (editData.meters && editData.meters > 0) ? editData.meters : '';
    $('entryRate').value = editData.ratePerBag || '';
    $('entryNaam').value = editData.naam || '';
    $('entryJama').value = editData.jama || '';
    if (editData.isCash) {
      if ($('entryModeCash')) $('entryModeCash').checked = true;
    } else {
      if ($('entryModeGeneral')) $('entryModeGeneral').checked = true;
    }
  } else {
    if ($('entryModeGeneral')) $('entryModeGeneral').checked = true;
  }

  handleCashModeToggle();
  showView(viewEntryForm);

  // Set default cursor / focus to Date input without selecting whole text
  setTimeout(() => {
    const dInput = $('entryDate');
    if (dInput) {
      dInput.focus();
      const len = dInput.value ? dInput.value.length : 0;
      if (typeof dInput.setSelectionRange === 'function') {
        dInput.setSelectionRange(len, len);
      }
    }
  }, 50);
}



// Real-time automatic multiplication (Bags or Meters x Rate)
function updateCalculatedAmount() {
  const bags = parseFloat($('entryBags').value) || 0;
  const meters = parseFloat($('entryMeters').value) || 0;
  const rate = parseFloat($('entryRate').value) || 0;
  const qty = bags > 0 ? bags : meters;
  if (qty > 0 && rate > 0) {
    const total = Math.round(qty * rate);
    const side = $('entrySide').value;
    if (side === 'jama') {
      $('entryJama').value = total;
    } else {
      $('entryNaam').value = total;
    }
  }
}

if ($('entryBags')) $('entryBags').addEventListener('input', updateCalculatedAmount);
if ($('entryMeters')) $('entryMeters').addEventListener('input', updateCalculatedAmount);
if ($('entryRate')) $('entryRate').addEventListener('input', updateCalculatedAmount);

// Submit entry form
$('entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const partyName = $('entryPartyName').value.trim() || 'Daily Entries';

  const rokerNoVal = parseInt($('entryRokerNo').value) || 0;
  const isCashVal = $('entryModeCash') ? $('entryModeCash').checked : false;
  const side = $('entrySide').value;
  const isPurchaseVal = !isCashVal && (side === 'jama') && Boolean($('entryTypePurchase')?.checked);
  const isSellVal = !isCashVal && (side === 'banam') && Boolean($('entryTypeSell')?.checked);
  const linkedPurchaseIdVal = (isSellVal && $('sellPurchaseSelect')) ? ($('sellPurchaseSelect').value || null) : null;

  const naamVal = (side === 'banam') ? Math.round(parseFloat($('entryNaam').value) || 0) : 0;
  const jamaVal = (side === 'jama') ? Math.round(parseFloat($('entryJama').value) || 0) : 0;
  const rateVal = parseFloat($('entryRate').value) || 0;

  if (naamVal <= 0 && jamaVal <= 0) {
    return toast('Please enter an amount', 'error');
  }

  const data = {
    partyName: partyName,
    partyType: 'general',
    rokerNo: rokerNoVal,
    date: $('entryDate').value,
    description: $('entryDescription').value.trim() || '—',
    bags: parseFloat($('entryBags').value) || 0,
    meters: parseFloat($('entryMeters').value) || 0,
    ratePerBag: rateVal,
    naam: naamVal,
    jama: jamaVal,
    isCash: isCashVal,
    isPurchase: isPurchaseVal,
    isSell: isSellVal,
    linkedPurchaseId: linkedPurchaseIdVal,
    txnType: 'general',
    note: '',
  };

  try {
    const editId = $('editEntryId').value;
    if (editId) {
      await apiPut(`${CB_API}/entries/${editId}`, data);
      toast('Roker entry updated!');
    } else {
      await apiPost(`${CB_API}/entries`, data);
      if (isSellVal) {
        toast(`Sell entry saved in Roker #${rokerNoVal}!`);
      } else if (isPurchaseVal) {
        toast(`Purchase entry saved in Roker #${rokerNoVal}!`);
      } else if (isCashVal) {
        toast(`Entry saved in Roker #${rokerNoVal} & Cash In Hand updated!`);
      } else {
        toast(`Entry saved in Roker #${rokerNoVal} & Party Khata updated!`);
      }
    }

    // Navigate back to where user came from
    if (cbReturnTo === 'roker' && currentRokerNo) {
      openRokerDetail(currentRokerNo);
    } else if (cbReturnTo === 'khata' && currentKhataNo) {
      openKhata(currentKhataNo);
    } else {
      showView(viewCashbookDashboard);
      loadCashbookDashboard();
    }
  } catch (err) {
    toast(err.message, 'error');
  }
});

async function openEditEntry(id) {
  try {
    const entry = await apiGet(`${CB_API}/entries/${id}`);
    cbReturnTo = (views.find(v => v.classList.contains('active')) === viewRokerDetail) ? 'roker' : (currentKhataNo ? 'khata' : 'dashboard');
    const side = (entry.naam > 0) ? 'banam' : 'jama';
    openEntryForm(entry.partyName, entry.rokerNo, entry, side);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteCbEntry(id) {
  showConfirm('Delete Entry', 'Delete this entry? This action cannot be undone.', async () => {
    try {
      await apiDelete(`${CB_API}/entries/${id}`);
      toast('Entry deleted');
      if (cbReturnTo === 'roker' && currentRokerNo) {
        openRokerDetail(currentRokerNo);
      } else if (currentKhataNo) {
        openKhata(currentKhataNo);
      } else {
        showView(viewCashbookDashboard);
        loadCashbookDashboard();
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function navigateBackFromEntryForm() {
  if (cbReturnTo === 'roker' && currentRokerNo) {
    openRokerDetail(currentRokerNo);
  } else if (cbReturnTo === 'khata' && currentKhataNo) {
    openKhata(currentKhataNo);
  } else {
    showView(viewCashbookDashboard);
    loadCashbookDashboard();
  }
}

$('btnEntryFormBack').addEventListener('click', navigateBackFromEntryForm);
$('btnEntryFormCancel').addEventListener('click', navigateBackFromEntryForm);

if ($('btnNewJamaEntry')) {
  $('btnNewJamaEntry').addEventListener('click', () => {
    cbReturnTo = 'dashboard';
    openEntryForm(null, null, null, 'jama');
  });
}

if ($('btnNewBanamEntry')) {
  $('btnNewBanamEntry').addEventListener('click', () => {
    cbReturnTo = 'dashboard';
    openEntryForm(null, null, null, 'banam');
  });
}

if ($('btnRokerAddJama')) {
  $('btnRokerAddJama').addEventListener('click', () => {
    cbReturnTo = 'roker';
    openEntryForm(null, currentRokerNo, null, 'jama');
  });
}

if ($('btnRokerAddBanam')) {
  $('btnRokerAddBanam').addEventListener('click', () => {
    cbReturnTo = 'roker';
    openEntryForm(null, currentRokerNo, null, 'banam');
  });
}

if ($('btnEndRoker')) {
  $('btnEndRoker').addEventListener('click', () => {
    openEndRokerModal();
  });
}

if ($('btnCloseEndRokerModal')) {
  $('btnCloseEndRokerModal').addEventListener('click', () => {
    closeEndRokerModal();
  });
}

if ($('btnHeaderCloseEndRoker')) {
  $('btnHeaderCloseEndRoker').addEventListener('click', () => {
    closeEndRokerModal();
  });
}

if ($('endRokerModal')) {
  $('endRokerModal').addEventListener('click', (e) => {
    if (e.target === $('endRokerModal')) {
      closeEndRokerModal();
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const erm = $('endRokerModal');
    if (erm && !erm.classList.contains('hidden')) {
      closeEndRokerModal();
    }
  }
});

function openEndRokerModal() {
  if (!currentRokerData || !currentRokerData.summary) {
    toast('No roker data available', 'error');
    return;
  }
  const s = currentRokerData.summary;
  const entries = currentRokerData.entries || [];
  const rokerNo = currentRokerNo;
  const rokerDate = formatDate(currentRokerData.date);

  const totalNaam = s.totalNaam || 0;
  const totalJama = s.totalJama || 0;
  const cashInHand = s.previousCashRoker !== undefined ? s.previousCashRoker : (s.cashInHand || 0);
  const endRokerValue = s.endRokerValue || (totalJama + cashInHand);

  // Cash Entries & Cash Difference calculations
  const cs = s.cashSummary || {};
  const previousCashRoker = (cs.previousCashRoker !== undefined) ? cs.previousCashRoker : cashInHand;

  const cashEntriesJama = (cs.jamaCashEntries && cs.jamaCashEntries.length > 0)
    ? cs.jamaCashEntries
    : entries.filter(e => e.isCash && (e.jama || 0) > 0).map(e => ({
        partyName: e.partyName,
        khataNo: e.khataNo,
        description: e.description,
        amount: e.jama
      }));

  const cashEntriesNaam = (cs.naamCashEntries && cs.naamCashEntries.length > 0)
    ? cs.naamCashEntries
    : entries.filter(e => e.isCash && (e.naam || 0) > 0).map(e => ({
        partyName: e.partyName,
        khataNo: e.khataNo,
        description: e.description,
        amount: e.naam
      }));

  const totalCashJama = cs.totalCashJama !== undefined ? cs.totalCashJama : cashEntriesJama.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalCashNaam = cs.totalCashNaam !== undefined ? cs.totalCashNaam : cashEntriesNaam.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalJamaCashWithPrev = previousCashRoker + totalCashJama;
  const cashDifference = totalJamaCashWithPrev - totalCashNaam;

  const cashJamaListHtml = cashEntriesJama.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.partyName)}</strong> <small style="color:var(--text-muted);">${p.khataNo ? '#' + p.khataNo : ''}</small></td>
      <td>${escapeHtml(p.description || '—')}</td>
      <td style="text-align:right; font-weight:700; color:#15803d;">${fmtCurrency(p.amount)}</td>
    </tr>
  `).join('');

  const cashNaamListHtml = cashEntriesNaam.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.partyName)}</strong> <small style="color:var(--text-muted);">${p.khataNo ? '#' + p.khataNo : ''}</small></td>
      <td>${escapeHtml(p.description || '—')}</td>
      <td style="text-align:right; font-weight:700; color:#b91c1c;">${fmtCurrency(p.amount)}</td>
    </tr>
  `).join('');

  const cashDetailsHtml = `
    <details style="margin-top: 0.4rem; font-size: 0.72rem; color: var(--text-muted);">
      <summary style="cursor: pointer; font-weight: 700; color: #047857; padding: 2px 0;">
        📜 View Cash Entries Breakdown (${cashEntriesJama.length} Jama, ${cashEntriesNaam.length} Banaam)
      </summary>
      <div style="margin-top: 0.35rem; border-top: 1px dashed #a7f3d0; padding-top: 0.35rem;">
        <div style="font-weight: 700; color: #15803d; margin-bottom: 2px; font-size: 0.72rem;">
          📥 Jama Cash Entries (${fmtCurrency(totalCashJama)}):
        </div>
        <table class="cb-khata-table" style="font-size: 0.7rem; margin-bottom: 0.35rem;">
          <thead><tr><th>Party</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
          <tbody>${cashJamaListHtml || '<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">No cash entries in Jama</td></tr>'}</tbody>
        </table>

        <div style="font-weight: 700; color: #b91c1c; margin-bottom: 2px; font-size: 0.72rem;">
          📤 Banaam Cash Entries (${fmtCurrency(totalCashNaam)}):
        </div>
        <table class="cb-khata-table" style="font-size: 0.7rem;">
          <thead><tr><th>Party</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
          <tbody>${cashNaamListHtml || '<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">No cash entries in Banaam</td></tr>'}</tbody>
        </table>

        <div style="font-size: 0.7rem; margin-top: 0.3rem; font-weight: 700; text-align: right; color: #065f46; background: rgba(16, 185, 129, 0.08); padding: 4px 6px; border-radius: 4px;">
          Formula: (Previous: ${fmtCurrency(previousCashRoker)} + Jama Cash: ${fmtCurrency(totalCashJama)}) - Banaam Cash: ${fmtCurrency(totalCashNaam)} = Net Cash: ${fmtCurrency(cashDifference)}
        </div>
      </div>
    </details>
  `;

  const bs = s.bagSummary || {};
  const ms = s.meterSummary || {};
  let tradeSummaryHtml = '';

  const hasBags = (bs.totalPurchaseBags > 0 || bs.totalSellBags > 0);
  const hasMeters = (ms.totalPurchaseMeters > 0 || ms.totalSellMeters > 0);

  if (hasBags) {
    const diffLabel = bs.difference > 0 ? '🟢 Net Bag Nafa' : bs.difference < 0 ? '🔴 Net Bag Nuqsaan' : '⚪ Break Even';
    const statusNotice = bs.bagsMatch
      ? (bs.isAlreadyPosted
          ? `<div style="margin-top: 0.3rem; padding: 0.25rem 0.4rem; background: #dcfce7; color: #15803d; border-radius: 4px; font-weight: 700; font-size: 0.72rem; text-align: center;">✅ Bag Nafa/Nuqsaan Posted (${fmtCurrency(Math.abs(bs.difference))})</div>`
          : `<button class="btn btn-success" style="width: 100%; margin-top: 0.3rem; background: #15803d; font-weight: 700; padding: 0.25rem; font-size: 0.75rem;" onclick="postBagNafaNuqsanToN(${rokerNo})">💾 Post Bag Nafa/Nuqsaan (${fmtCurrency(Math.abs(bs.difference))})</button>`
        )
      : `<div style="margin-top: 0.3rem; padding: 0.25rem 0.4rem; background: #fef3c7; color: #b45309; border-radius: 4px; font-size: 0.72rem; text-align: center;">⚠️ Bag Purchases (${bs.totalPurchaseBags}) & Sells (${bs.totalSellBags}) differ.</div>`;

    const bagPurListHtml = (bs.purchases || []).map(p => `<tr><td>${escapeHtml(p.partyName)}</td><td>${p.qty} bags</td><td>${fmtRate(p.rate)}</td><td style="text-align:right">${fmtCurrency(p.amount)}</td></tr>`).join('');
    const bagSellListHtml = (bs.sells || []).map(s => `<tr><td>${escapeHtml(s.partyName)}</td><td>${s.qty} bags</td><td>${fmtRate(s.rate)}</td><td style="text-align:right">${fmtCurrency(s.amount)}</td></tr>`).join('');

    const bagDetailsHtml = `
      <details style="margin-top: 0.35rem; font-size: 0.72rem; color: var(--text-muted);">
        <summary style="cursor: pointer; font-weight: 700; color: var(--accent-primary);">📜 View Bag Calculation Details (${(bs.purchases || []).length} Pur, ${(bs.sells || []).length} Sells)</summary>
        <div style="margin-top: 0.35rem; border-top: 1px dashed var(--border); padding-top: 0.35rem;">
          <div style="font-weight: 700; color: #15803d;">🛒 Bag Purchases (${fmtCurrency(bs.totalPurchaseAmount)}):</div>
          <table class="cb-khata-table" style="font-size: 0.7rem; margin-bottom: 0.35rem;">
            <thead><tr><th>Party</th><th>Bags</th><th>Rate</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>${bagPurListHtml || '<tr><td colspan="4">No bag purchases</td></tr>'}</tbody>
          </table>
          <div style="font-weight: 700; color: #b91c1c;">🏷️ Bag Sells (${fmtCurrency(bs.totalSellAmount)}):</div>
          <table class="cb-khata-table" style="font-size: 0.7rem;">
            <thead><tr><th>Party</th><th>Bags</th><th>Rate</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>${bagSellListHtml || '<tr><td colspan="4">No bag sells</td></tr>'}</tbody>
          </table>
          <div style="font-size: 0.7rem; margin-top: 0.25rem; font-weight: 700; text-align: right; color: var(--text-primary);">
            Formula: Sells (${fmtCurrency(bs.totalSellAmount)}) - Purchases (${fmtCurrency(bs.totalPurchaseAmount)}) = Net Nafa: ${fmtCurrency(bs.difference)}
          </div>
        </div>
      </details>
    `;

    tradeSummaryHtml += `
      <div class="end-roker-calc-box" style="margin-top: 0.4rem; border-color: rgba(30, 64, 175, 0.2);">
        <div style="font-weight: 700; color: var(--accent-primary); font-size: 0.78rem; margin-bottom: 0.2rem;">
          📦 Bag Purchase & Sell Summary
        </div>
        <div class="end-roker-row">
          <span>🛒 Purchases (${bs.totalPurchaseBags} bags):</span>
          <strong>${fmtCurrency(bs.totalPurchaseAmount)}</strong>
        </div>
        <div class="end-roker-row">
          <span>🏷️ Sells (${bs.totalSellBags} bags):</span>
          <strong>${fmtCurrency(bs.totalSellAmount)}</strong>
        </div>
        <div class="end-roker-row" style="border-top: 1px dashed var(--border); padding-top: 0.2rem; margin-top: 0.1rem;">
          <span>${diffLabel}:</span>
          <strong style="font-size: 0.88rem; color: ${bs.difference >= 0 ? '#15803d' : '#b91c1c'};">${fmtCurrency(Math.abs(bs.difference))}</strong>
        </div>
        ${bagDetailsHtml}
        ${statusNotice}
      </div>
    `;
  }

  if (hasMeters) {
    const diffLabel = ms.difference > 0 ? '🟢 Net Meter Nafa' : ms.difference < 0 ? '🔴 Net Meter Nuqsaan' : '⚪ Break Even';
    const statusNotice = ms.metersMatch
      ? (ms.isAlreadyPosted
          ? `<div style="margin-top: 0.3rem; padding: 0.25rem 0.4rem; background: #dcfce7; color: #15803d; border-radius: 4px; font-weight: 700; font-size: 0.72rem; text-align: center;">✅ Meter Nafa/Nuqsaan Posted (${fmtCurrency(Math.abs(ms.difference))})</div>`
          : `<button class="btn btn-success" style="width: 100%; margin-top: 0.3rem; background: #0284c7; font-weight: 700; padding: 0.25rem; font-size: 0.75rem;" onclick="postBagNafaNuqsanToN(${rokerNo})">💾 Post Meter Nafa/Nuqsaan (${fmtCurrency(Math.abs(ms.difference))})</button>`
        )
      : `<div style="margin-top: 0.3rem; padding: 0.25rem 0.4rem; background: #fef3c7; color: #b45309; border-radius: 4px; font-size: 0.72rem; text-align: center;">⚠️ Meter Purchases (${ms.totalPurchaseMeters}) & Sells (${ms.totalSellMeters}) differ.</div>`;

    const meterPurListHtml = (ms.purchases || []).map(p => `<tr><td>${escapeHtml(p.partyName)}</td><td>${p.qty} m</td><td>${fmtRate(p.rate)}</td><td style="text-align:right">${fmtCurrency(p.amount)}</td></tr>`).join('');
    const meterSellListHtml = (ms.sells || []).map(s => `<tr><td>${escapeHtml(s.partyName)}</td><td>${s.qty} m</td><td>${fmtRate(s.rate)}</td><td style="text-align:right">${fmtCurrency(s.amount)}</td></tr>`).join('');

    const meterDetailsHtml = `
      <details style="margin-top: 0.35rem; font-size: 0.72rem; color: var(--text-muted);">
        <summary style="cursor: pointer; font-weight: 700; color: #0284c7;">📜 View Meter Calculation Details (${(ms.purchases || []).length} Pur, ${(ms.sells || []).length} Sells)</summary>
        <div style="margin-top: 0.35rem; border-top: 1px dashed var(--border); padding-top: 0.35rem;">
          <div style="font-weight: 700; color: #0284c7;">🛒 Meter Purchases (${fmtCurrency(ms.totalPurchaseAmount)}):</div>
          <table class="cb-khata-table" style="font-size: 0.7rem; margin-bottom: 0.35rem;">
            <thead><tr><th>Party</th><th>Meters</th><th>Rate</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>${meterPurListHtml || '<tr><td colspan="4">No meter purchases</td></tr>'}</tbody>
          </table>
          <div style="font-weight: 700; color: #b91c1c;">🏷️ Meter Sells (${fmtCurrency(ms.totalSellAmount)}):</div>
          <table class="cb-khata-table" style="font-size: 0.7rem;">
            <thead><tr><th>Party</th><th>Meters</th><th>Rate</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>${meterSellListHtml || '<tr><td colspan="4">No meter sells</td></tr>'}</tbody>
          </table>
          <div style="font-size: 0.7rem; margin-top: 0.25rem; font-weight: 700; text-align: right; color: var(--text-primary);">
            Formula: Sells (${fmtCurrency(ms.totalSellAmount)}) - Purchases (${fmtCurrency(ms.totalPurchaseAmount)}) = Net Nafa: ${fmtCurrency(ms.difference)}
          </div>
        </div>
      </details>
    `;

    tradeSummaryHtml += `
      <div class="end-roker-calc-box" style="margin-top: 0.4rem; border-color: rgba(2, 132, 199, 0.3);">
        <div style="font-weight: 700; color: #0284c7; font-size: 0.78rem; margin-bottom: 0.2rem;">
          📏 Meter Purchase & Sell Summary
        </div>
        <div class="end-roker-row">
          <span>🛒 Purchases (${ms.totalPurchaseMeters} meters):</span>
          <strong>${fmtCurrency(ms.totalPurchaseAmount)}</strong>
        </div>
        <div class="end-roker-row">
          <span>🏷️ Sells (${ms.totalSellMeters} meters):</span>
          <strong>${fmtCurrency(ms.totalSellAmount)}</strong>
        </div>
        <div class="end-roker-row" style="border-top: 1px dashed var(--border); padding-top: 0.2rem; margin-top: 0.1rem;">
          <span>${diffLabel}:</span>
          <strong style="font-size: 0.88rem; color: ${ms.difference >= 0 ? '#15803d' : '#b91c1c'};">${fmtCurrency(Math.abs(ms.difference))}</strong>
        </div>
        ${meterDetailsHtml}
        ${statusNotice}
      </div>
    `;
  }

  $('endRokerModalTitle').textContent = `🏁 End Roker Summary (Roker #${rokerNo})`;
  $('endRokerModalBody').innerHTML = `
    <!-- Top Overall Journal Summary -->
    <div class="end-roker-calc-box">
      <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.35rem;">
        📅 Date: <strong>${rokerDate}</strong> · Roker #${rokerNo}
      </div>
      <div class="end-roker-row">
        <span style="color: var(--text-secondary);">🟢 Total Jama (کل جمع):</span>
        <strong style="color: #15803d; font-size: 0.9rem;">${fmtCurrency(totalJama)}</strong>
      </div>
      <div class="end-roker-row">
        <span style="color: var(--text-secondary);">🔴 Total Naam (کل بنام):</span>
        <strong style="color: #b91c1c; font-size: 0.9rem;">${fmtCurrency(totalNaam)}</strong>
      </div>
      <div class="end-roker-row" style="background: rgba(2, 132, 199, 0.05); padding: 0.25rem 0.35rem; border-radius: 4px; margin: 0.15rem 0;">
        <span style="color: #0284c7; font-weight: 600;">🏛️ Cash in Hand (Previous Rokar):</span>
        <strong style="color: #0284c7; font-size: 0.9rem;">+ ${fmtCurrency(previousCashRoker)}</strong>
      </div>
      <div class="end-roker-row total">
        <span style="color: #d97706;">🏁 End Roker Total (Jama + Cash):</span>
        <strong style="color: #d97706; font-size: 1.1rem;">${fmtCurrency(endRokerValue)}</strong>
      </div>
    </div>

    ${tradeSummaryHtml}
  `;

  $('endRokerModal').classList.remove('hidden');
}

function closeEndRokerModal() {
  $('endRokerModal').classList.add('hidden');
}

async function postBagNafaNuqsanToN(rokerNo) {
  try {
    await apiPost(`${CB_API}/roker/${rokerNo}/calculate-bag-nafa-nuqsan`, { postToN: true });
    toast(`Nafa/Nuqsaan posted to Party "N" for Roker #${rokerNo}!`);
    openRokerDetail(rokerNo);
    closeEndRokerModal();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// Make cashbook functions globally available
window.deleteCbParty = deleteCbParty;
window.openKhata = openKhata;
window.openRokerDetail = openRokerDetail;
window.openNewRokerForm = openNewRokerForm;
window.openEntryForm = openEntryForm;
window.openEditEntry = openEditEntry;
window.deleteCbEntry = deleteCbEntry;
window.openEndRokerModal = openEndRokerModal;
window.closeEndRokerModal = closeEndRokerModal;

// ═══════════════════════════════════════════════════════════
//  INPUT ENHANCEMENTS: Prevent Wheel Spin & Enter Key Navigation
// ═══════════════════════════════════════════════════════════

// 1. Prevent trackpad / mouse scroll wheel from changing number input values
document.addEventListener('wheel', (e) => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'number') {
    document.activeElement.blur();
  }
}, { passive: true });

// Helper to smoothly scroll any focused element / radio option to the center of the viewport
function scrollElementIntoComfortView(el) {
  if (!el) return;
  const scrollTarget = el.closest('.cb-radio-option') || el.closest('.form-section') || el.closest('.form-group') || el;
  setTimeout(() => {
    try {
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {}

    const rect = scrollTarget.getBoundingClientRect();
    const docScrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const targetY = docScrollY + rect.top - 140;
    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth'
    });
  }, 10);
}

// 2. Auto-scroll form controls and radio button cards into center view when focused
document.addEventListener('focusin', (e) => {
  const target = e.target;
  if (!target || !target.closest('form')) return;
  scrollElementIntoComfortView(target);
});

// 3. Keyboard Navigation in forms:
//    - 'Shift' key selects the focused radio button immediately.
//    - 'Enter' key advances focus to next field (or submits on final amount / submit button).
//    - 'ArrowDown' / 'ArrowRight': moves forward to next input / radio button / field.
//    - 'ArrowUp' / 'ArrowLeft': moves backward to previous input / radio button / field.
document.addEventListener('keydown', (e) => {
  const target = e.target;
  if (!target) return;

  // Handle Shift key to select the currently focused radio button
  if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    if (target.tagName === 'INPUT' && target.type === 'radio') {
      if (!target.checked) {
        target.checked = true;
        target.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
  }

  const form = target.closest('form');
  if (!form) return;

  // Do not intercept keyboard shortcuts in textareas
  if (target.tagName === 'TEXTAREA') return;

  // Helper to get all currently visible focusable controls
  const getFocusable = () => {
    return Array.from(form.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
    )).filter(el => {
      return el.offsetParent !== null && window.getComputedStyle(el).display !== 'none';
    });
  };

  const moveTo = (index) => {
    const focusable = getFocusable();
    if (index >= 0 && index < focusable.length) {
      e.preventDefault();
      const nextField = focusable[index];
      nextField.focus();

      scrollElementIntoComfortView(nextField);

      if (typeof nextField.select === 'function' && nextField.type !== 'radio') {
        nextField.select();
      }
    }
  };

  // On party suggestion textboxes, ArrowDown and ArrowUp should NEVER navigate between form fields
  if (['formGazanaPartyName', 'formGazanaLoomWala', 'formGazanaPurchaser', 'formGazanaGudaam'].includes(target.id)) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      return;
    }
    const dropdownMap = {
      formGazanaPartyName: 'formGazanaPartySuggestions',
      formGazanaLoomWala: 'formGazanaLoomWalaSuggestions',
      formGazanaPurchaser: 'formGazanaPurchaserSuggestions',
      formGazanaGudaam: 'formGazanaGudaamSuggestions'
    };
    const dd = $(dropdownMap[target.id]);
    if (dd && dd.style.display !== 'none' && (e.key === 'Enter' || e.key === 'Tab')) {
      return;
    }
  }

  // Handle Enter key navigation
  if (e.key === 'Enter') {
    if (target.tagName === 'BUTTON' || target.type === 'submit') return;

    // If user is on Naam or Jama input in entryForm and has typed a positive amount, save on Enter directly
    if ((target.id === 'entryNaam' || target.id === 'entryJama') && parseFloat(target.value) > 0) {
      e.preventDefault();
      form.requestSubmit();
      return;
    }

    const focusable = getFocusable();
    const index = focusable.indexOf(target);
    if (index >= 0 && index < focusable.length - 1) {
      moveTo(index + 1);
    } else if (index === focusable.length - 1) {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.click();
      } else {
        form.requestSubmit();
      }
    }
    return;
  }

  // Handle Arrow Down / Up / Right / Left navigation
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    // Don't intercept arrow keys inside <select> dropdowns (needed to choose dropdown options)
    if (target.tagName === 'SELECT') return;

    const focusable = getFocusable();
    const index = focusable.indexOf(target);
    if (index === -1) return;

    if (e.key === 'ArrowDown') {
      if (index < focusable.length - 1) {
        moveTo(index + 1);
      }
    } else if (e.key === 'ArrowUp') {
      if (index > 0) {
        moveTo(index - 1);
      }
    } else if (e.key === 'ArrowRight') {
      const isRadio = target.type === 'radio';
      const atEnd = target.selectionEnd === target.value?.length || target.type === 'number';
      if (isRadio || atEnd) {
        if (index < focusable.length - 1) {
          moveTo(index + 1);
        }
      }
    } else if (e.key === 'ArrowLeft') {
      const isRadio = target.type === 'radio';
      const atStart = target.selectionStart === 0 || target.type === 'number';
      if (isRadio || atStart) {
        if (index > 0) {
          moveTo(index - 1);
        }
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════
//  PARTY GAZANA ENTRIES & LEDGER SYSTEM (Costing Tab Sub-Module)
// ═══════════════════════════════════════════════════════════

let gazanaDashboardData = null;
let currentPartyGazanaEntries = [];

function switchCostingSubtab(subtab) {
  if (subtab === 'gazana') {
    showView(viewPartyGazanaDashboard);
    loadGazanaDashboard($('gazanaSearchInput') ? $('gazanaSearchInput').value.trim() : '');
  } else {
    showView(viewDashboard);
    loadInvoices(searchInput ? searchInput.value.trim() : '');
  }
}

if ($('subtabCostingInvoices')) {
  $('subtabCostingInvoices').addEventListener('click', () => switchCostingSubtab('invoices'));
}
if ($('subtabCostingGazana')) {
  $('subtabCostingGazana').addEventListener('click', () => switchCostingSubtab('gazana'));
}

// ── Helper to calculate Gazana amounts consistently ──────────
function calcGazanaAmounts(e) {
  const safi = Number(e?.safiGazana) || 0;
  const rateWO = Number(e?.rate) || (e?.gstRate ? Math.round((Number(e.gstRate) / 1.18) * 100) / 100 : 0);
  const rateW = Number(e?.gstRate) || (rateWO ? Math.round(rateWO * 1.18 * 100) / 100 : 0);
  const totalWO = Math.round(safi * rateWO * 100) / 100;
  const totalW = Math.round(safi * rateW * 100) / 100;
  const isKachy = e?.rateType === 'kachy';
  const billableTotal = isKachy ? totalWO : totalW;
  return { safi, rateWO, rateW, totalWO, totalW, isKachy, billableTotal };
}

// ── Helper to determine if a Gazana entry is Completed ──────
function isGazanaEntryCompleted(e) {
  if (!e) return false;
  const safi = Number(e.safiGazana) || 0;
  // If safi gazana is empty or 0, it is awaiting safi gazana and must remain active only
  if (safi <= 0) return false;
  return e.status === 'completed' || (e.remaining !== undefined && e.remaining !== null && e.remaining <= 0);
}

// ── Switch Gazana View Mode (Recent Entries vs By Party) ───
function setGazanaViewMode(mode) {
  gazanaViewMode = mode;
  if ($('tabGazanaEntries')) $('tabGazanaEntries').classList.toggle('active', mode === 'all');
  if ($('tabGazanaParties')) $('tabGazanaParties').classList.toggle('active', mode === 'parties');
  // Clear search input text when moving between Recent Entries and By Party tabs
  if ($('gazanaSearchInput')) {
    $('gazanaSearchInput').value = '';
  }
  loadGazanaDashboard('');
}

// ── Load Party Gazana Dashboard ────────────────────────────
async function loadGazanaDashboard(search = '') {
  try {
    const status = $('gazanaStatusFilter') ? $('gazanaStatusFilter').value : 'active';
    const viewMode = gazanaViewMode || 'all';
    gazanaStatusFilter = status;

    if ($('tabGazanaEntries')) $('tabGazanaEntries').classList.toggle('active', viewMode === 'all');
    if ($('tabGazanaParties')) $('tabGazanaParties').classList.toggle('active', viewMode === 'parties');

    const queryParams = new URLSearchParams();
    if (search) queryParams.set('q', search);
    if (status && status !== 'all') queryParams.set('status', status);

    // Only fetch what the current view mode needs (performance: halves API calls)
    let entriesRes = { entries: [], summary: {} };
    let partiesRes = [];

    if (viewMode === 'parties') {
      // Parties view only needs the parties aggregation
      partiesRes = await apiGet(`${PARTY_ENTRIES_API}/parties${search ? '?q=' + encodeURIComponent(search) : ''}`).catch(() => []);
      if (search) {
        partiesRes = rankPartyMatches(partiesRes, search);
      }
    } else {
      // Entries view only needs the entries list
      entriesRes = await apiGet(`${PARTY_ENTRIES_API}?${queryParams.toString()}`).catch(() => ({ entries: [], summary: {} }));
    }

    gazanaDashboardData = entriesRes;
    const entries = entriesRes.entries || [];
    const summary = entriesRes.summary || {};

    if ($('gazanaEntriesCount')) {
      if (viewMode === 'parties') {
        const totalEntries = partiesRes.reduce((sum, p) => sum + (p.totalEntries || 0), 0);
        $('gazanaEntriesCount').textContent = `(${totalEntries} Entries)`;
      } else {
        $('gazanaEntriesCount').textContent = `(${entries.length} Entries)`;
      }
    }

    // Render Content (Grouped by Party vs All Entries List)
    const container = $('gazanaMainContent');
    if (!container) return;

    if (viewMode === 'parties') {
      const parties = partiesRes || [];
      if (parties.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 2.5rem 1rem; text-align: center;">
            <div class="empty-icon" style="font-size: 2.5rem; margin-bottom: 0.75rem;">📋</div>
            <p style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">
              ${search ? 'No party gazana entries match your search.' : 'No party gazana entries created yet.'}
            </p>
            <p style="font-size: 0.8125rem; color: var(--text-secondary); max-width: 440px; margin: 0 auto 1.25rem;">
              Store entries against parties with Kacha &amp; Safi Gazana, GST Rate, Advance, Remaining balances, and status tracking.
            </p>
            <button class="btn btn-primary" onclick="openNewPartyEntryModal()" style="background: linear-gradient(135deg, #1e40af, #0284c7); color: #fff; font-weight: 700; padding: 8px 18px;">
              ＋ Create First Entry
            </button>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="gazana-party-grid">
          ${parties.map(p => {
            const hasActive = p.activeCount > 0;
            return `
              <div class="gazana-party-card" onclick="openPartyGazanaDetail('${escapeHtml(p.partyName)}')">
                <div class="gazana-party-card-left">
                  <div class="gazana-party-avatar">👤</div>
                  <div class="gazana-party-info">
                    <div class="gazana-party-name">${search ? highlightMatches(p.partyName, search) : escapeHtml(p.partyName)}</div>
                    <div class="gazana-party-meta">
                      <span>${p.totalEntries} ${p.totalEntries === 1 ? 'order' : 'orders'}</span>
                      <span>·</span>
                      <span class="status-pill ${hasActive ? 'active' : 'completed'}" style="font-size: 0.7rem; padding: 1px 7px;">
                        ${hasActive ? `🟢 ${p.activeCount} active` : '✅ All completed'}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="gazana-party-card-right" style="display: flex; align-items: center; gap: 6px;">
                  <button class="btn btn-ghost btn-icon" title="Add entry for this party" onclick="event.stopPropagation(); openNewPartyEntryModal('${escapeHtml(p.partyName)}');" style="color: var(--accent-primary); font-size: 1.15rem; padding: 4px 8px; border-radius: var(--radius-sm);">
                    ＋
                  </button>
                  <span style="font-size: 0.9rem; font-weight: 700; color: var(--accent-primary); margin-left: 2px;">➔</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      // All Entries Table View
      if (entries.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <p>No gazana entries found.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="gazana-table-container">
          <table class="gazana-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Banaam<br>Party</th>
                <th>Quality</th>
                <th style="text-align:right">Kacha<br>Gazana</th>
                <th style="text-align:right">Safi<br>Gazana</th>
                <th style="text-align:right" title="GST Rate">GST<br>Rate</th>
                <th style="text-align:right" title="Rate With GST">Rate<br>W/Gst</th>
                <th style="text-align:right" title="Total Without GST">Total<br>WO/Gst</th>
                <th style="text-align:right" title="Total With GST">Total<br>W/Gst</th>
                <th style="text-align:right">Advance<br>(₹)</th>
                <th style="text-align:right">Received<br>(₹)</th>
                <th style="text-align:right">Remaining<br>(₹)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map(e => {
                const isCompleted = isGazanaEntryCompleted(e);
                const displayRemaining = isCompleted ? 0 : Math.max(0, e.remaining || 0);
                const installmentsSum = (e.paymentHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                const calc = calcGazanaAmounts(e);
                const totalWO = calc.totalWO;
                const totalW = calc.totalW;
                return `
                  <tr>
                    <td>${formatDate(e.date)}</td>
                    <td>
                      <strong style="color: var(--accent-primary); cursor: pointer;" onclick="openPartyGazanaDetail('${escapeHtml(e.partyName)}')">
                        ${escapeHtml(e.partyName)} ↗
                      </strong>
                      ${e.purchaser ? `<div style="font-size: 0.82rem; color: #0369a1; margin-top: 3px;"><strong>خریدار:</strong> ${escapeHtml(e.purchaser)}</div>` : ''}
                      ${e.loomWala ? `<div style="font-size: 0.82rem; color: #4338ca; margin-top: 2px;"><strong>لوم والا:</strong> ${escapeHtml(e.loomWala)}</div>` : ''}
                      ${e.gudaam ? `<div style="font-size: 0.82rem; color: #0d9488; margin-top: 2px;"><strong>گودام:</strong> ${escapeHtml(e.gudaam)}</div>` : ''}
                    </td>
                    <td>
                      <div style="font-weight: 600;">${escapeHtml(e.variety || '—')}</div>
                      ${e.contractNo ? `<div style="font-size: 0.75rem; color: #2563eb; margin-top: 2px; font-weight: 600;">#${escapeHtml(e.contractNo)}</div>` : ''}
                      ${e.note ? `<div style="font-size: 0.78rem; color: #64748b; margin-top: 3px; word-break: break-word;"><span style="color: #94a3b8;">📝</span> ${escapeHtml(e.note)}</div>` : ''}
                    </td>
                    <td style="text-align:right">${e.kachaGazana > 0 ? e.kachaGazana.toLocaleString() : '—'}</td>
                    <td style="text-align:right; font-weight: 700; color: #1e40af;">${(e.safiGazana || 0).toLocaleString()}</td>
                    <td style="text-align:right">
                      <div style="font-weight: 700; color: #0284c7;">${fmtRate(calc.rateWO)}</div>
                      ${e.rateType === 'kachy' ? `
                        <span style="font-size: 0.65rem; background: rgba(37,99,235,0.1); color: #2563eb; padding: 1px 4px; border-radius: 3px; font-weight: 700;">کچے</span>
                      ` : ''}
                    </td>
                    <td style="text-align:right">
                      <div style="font-weight: 700; color: #7c3aed;">${fmtRate(calc.rateW)}</div>
                      ${(!e.rateType || e.rateType === 'pakay') ? `
                        <span style="font-size: 0.65rem; background: rgba(124,58,237,0.1); color: #7c3aed; padding: 1px 4px; border-radius: 3px; font-weight: 700;">پکے</span>
                      ` : ''}
                    </td>
                    <td style="text-align:right; font-weight: 700; color: #0284c7;">${fmtCurrency(totalWO)}</td>
                    <td style="text-align:right; font-weight: 700; color: #7c3aed;">${fmtCurrency(totalW)}</td>
                    <td style="text-align:right; color: #16a34a; font-weight: 600;">${e.advance > 0 ? fmtCurrency(e.advance) : '—'}</td>
                    <td style="text-align:right;">
                      ${installmentsSum > 0 ? `
                        <button class="btn btn-ghost" style="padding: 2px 6px; font-size: 0.76rem; font-weight: 700; color: #0284c7; background: rgba(2,132,199,0.08); border-radius: 4px;" onclick="openPaymentHistoryModal('${e._id}')" title="Click to view payment breakdown">
                          ${fmtCurrency(installmentsSum)} <small>(${e.paymentHistory.length})</small>
                        </button>
                      ` : '<span style="color: var(--text-muted);">—</span>'}
                    </td>
                    <td style="text-align:right; font-weight: 800; color: ${displayRemaining > 0 ? '#b91c1c' : '#16a34a'};">
                      ${fmtCurrency(displayRemaining)}
                    </td>
                    <td>
                      ${!isCompleted ? `
                        <label class="gazana-radio-wrap" title="Click radio button to mark as completed" onclick="event.stopPropagation();">
                          <input type="radio" class="gazana-status-radio" name="status_radio_${e._id}" value="completed" onclick="event.stopPropagation();" onchange="markGazanaEntryCompleted('${e._id}')" />
                          <span class="status-pill active" style="cursor: pointer;" onclick="event.stopPropagation(); toggleEntryStatus('${e._id}', '${e.status}')" title="Click to toggle status">
                            🟢 Active
                          </span>
                        </label>
                      ` : `
                        <label class="gazana-radio-wrap completed" title="Completed entry" onclick="event.stopPropagation();">
                          <input type="radio" class="gazana-status-radio" checked disabled />
                          <span class="status-pill completed" style="cursor: pointer;" onclick="event.stopPropagation(); toggleEntryStatus('${e._id}', '${e.status}')" title="Click to toggle status">
                            ✅ Completed
                          </span>
                        </label>
                      `}
                    </td>
                    <td>
                      <div style="display: flex; gap: 5px; align-items: center;">
                        <button class="btn btn-ghost" style="padding: 2px 6px; font-size: 0.75rem; font-weight: 700; color: #0284c7; background: #f0f9ff; border: 1px solid #e0f2fe; border-radius: 4px;" onclick="event.stopPropagation(); openPartyReceiptModal('${escapeHtml(e.partyName)}');" title="Generate Receipt for ${escapeHtml(e.partyName)}">
                          🧾 Receipt
                        </button>
                        ${(!isCompleted && displayRemaining > 0) ? `
                          <button class="btn-add-payment" onclick="openQuickPaymentModal('${e._id}', '${escapeHtml(e.partyName)}', ${displayRemaining})" title="Add Partial Payment">
                            ＋ Add Payment
                          </button>
                        ` : ''}
                        <button class="gazana-menu-btn" onclick="toggleGazanaActionMenu(event, '${e._id}', '${escapeHtml(e.partyName)}')" title="More Actions">⋮</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  } catch (err) {
    toast('Failed to load gazana entries: ' + err.message, 'error');
  }
}

// Search & Filter Listeners for Gazana Dashboard
if ($('gazanaSearchInput')) {
  $('gazanaSearchInput').addEventListener('input', () => {
    clearTimeout(gazanaSearchTimeout);
    gazanaSearchTimeout = setTimeout(() => {
      loadGazanaDashboard($('gazanaSearchInput').value.trim());
    }, 300);
  });
}

if ($('gazanaStatusFilter')) {
  $('gazanaStatusFilter').addEventListener('change', () => {
    loadGazanaDashboard($('gazanaSearchInput') ? $('gazanaSearchInput').value.trim() : '');
  });
}

if ($('gazanaViewMode')) {
  $('gazanaViewMode').addEventListener('change', () => {
    loadGazanaDashboard($('gazanaSearchInput') ? $('gazanaSearchInput').value.trim() : '');
  });
}

if ($('btnNewPartyEntry')) {
  $('btnNewPartyEntry').addEventListener('click', () => {
    openNewPartyEntryModal();
  });
}

// ── Switch Party Detail Filter Tab (Active vs Completed vs All)
function setPartyGazanaDetailFilter(filter) {
  partyGazanaDetailFilter = filter;
  if (currentGazanaPartyName) {
    openPartyGazanaDetail(currentGazanaPartyName, false);
  }
}

// ── Rename Party (update all entries with old name) ──────────
async function renameParty(oldName) {
  if (!oldName) return;
  const newName = prompt(`Rename party "${oldName}" to:`, oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;

  const trimmedNew = newName.trim();
  try {
    const result = await apiPut(
      `${PARTY_ENTRIES_API}/party/${encodeURIComponent(oldName)}/rename`,
      { newName: trimmedNew }
    );
    toast(`✅ Party renamed to "${trimmedNew}" — ${result.entriesUpdated} entries updated`, 'success');
    if (currentGazanaPartyName && currentGazanaPartyName.toLowerCase() === oldName.toLowerCase()) {
      currentGazanaPartyName = trimmedNew;
      openPartyGazanaDetail(trimmedNew, false);
    }
    loadGazanaDashboard('');
    if (typeof loadAllPartiesSuggestions === 'function') {
      loadAllPartiesSuggestions();
    }
  } catch (err) {
    toast(err.message || 'Failed to rename party', 'error');
  }
}

// ── Open Single Party Gazana Ledger Detail ──────────────────
async function openPartyGazanaDetail(partyName, resetTab = true) {
  if (!partyName) return;
  // If opening another party or requested to reset tab, always default to 'active' tab
  if (resetTab || currentGazanaPartyName !== partyName) {
    partyGazanaDetailFilter = 'active';
  }
  currentGazanaPartyName = partyName;

  try {
    const res = await apiGet(`${PARTY_ENTRIES_API}/party/${encodeURIComponent(partyName)}`);
    currentGazanaPartyData = res;
    const allEntries = res.entries || [];
    const summary = res.summary || {};

    const activeEntries = allEntries.filter(e => !isGazanaEntryCompleted(e));
    const completedEntries = allEntries.filter(e => isGazanaEntryCompleted(e));

    // Collect payments for Payments tab
    const storedGeneralPayments = (res.generalPayments || []).map(gp => ({
      date: gp.date,
      amount: gp.amount,
      note: gp.note || '',
      type: 'general',
      _id: gp._id
    }));

    const entrySpecificPayments = [];
    const advancePayments = [];
    allEntries.forEach(e => {
      const isCompleted = isGazanaEntryCompleted(e);
      const calc = calcGazanaAmounts(e);
      const billableTotal = calc.billableTotal;

      if (e.advance > 0) {
        advancePayments.push({
          date: e.date,
          amount: e.advance,
          note: 'Booking Advance',
          type: 'advance',
          entryVariety: e.variety || '—',
          entryDate: e.date,
          entryId: e._id
        });
      }

      let entryHistorySum = 0;
      let totalAllHistorySum = 0;
      if (Array.isArray(e.paymentHistory)) {
        e.paymentHistory.forEach(p => {
          totalAllHistorySum += Number(p.amount) || 0;

          // Skip [General] distributed records — we show those from storedGeneralPayments
          if (p.note && p.note.startsWith('[General]')) return;

          const isSettlement = p.note && (
            p.note.includes('Paid Amount') || 
            p.note.includes('Final Settlement') || 
            p.note.includes('مکمل ادائیگی')
          );

          entryHistorySum += Number(p.amount) || 0;

          entrySpecificPayments.push({
            date: p.date || e.date,
            amount: Number(p.amount) || 0,
            note: p.note || (isSettlement ? 'Paid Amount (مکمل ادائیگی)' : ''),
            type: isSettlement ? 'completed' : 'installment',
            entryVariety: e.variety || '—',
            entryDate: e.date,
            paymentId: p._id,
            entryId: e._id
          });
        });
      }

      // If entry is marked as completed but has an unrecorded balance (e.g. legacy completed entry)
      if (isCompleted && billableTotal > 0) {
        const totalRecordedForEntry = (e.advance || 0) + totalAllHistorySum;
        const unrecordedSettlement = Math.max(0, Math.round((billableTotal - totalRecordedForEntry) * 100) / 100);
        if (unrecordedSettlement > 0) {
          entrySpecificPayments.push({
            date: e.updatedAt || e.date,
            amount: unrecordedSettlement,
            note: 'Paid Amount (مکمل ادائیگی)',
            type: 'completed',
            entryVariety: e.variety || '—',
            entryDate: e.date,
            entryId: e._id
          });
        }
      }
    });

    const allPayments = [...storedGeneralPayments, ...entrySpecificPayments, ...advancePayments];
    allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
    currentGazanaAllPayments = allPayments;

    let displayedEntries = allEntries;
    if (partyGazanaDetailFilter === 'active') {
      displayedEntries = activeEntries;
    } else if (partyGazanaDetailFilter === 'completed') {
      displayedEntries = completedEntries;
    }

    $('partyGazanaDetailTitle').textContent = `📋 ${res.partyName} — Gazana Ledger`;

    if ($('partyGazanaInfoSummary')) {
      $('partyGazanaInfoSummary').innerHTML = `
        <div class="cb-khata-info" style="margin-bottom: 1.25rem;">
          <div class="cb-khata-info-left">
            <span class="cb-khata-info-icon" style="background: linear-gradient(135deg, #1e40af, #0284c7);">👤</span>
            <div>
              <div class="cb-khata-info-name" style="display: flex; align-items: center; gap: 8px;">
                <span>${escapeHtml(res.partyName)}</span>
                <button class="btn btn-secondary" title="Edit Party Name" onclick="renameParty('${escapeHtml(res.partyName)}');" style="font-size: 0.75rem; padding: 2px 7px; font-weight: 700; color: #7c3aed; border: 1px solid #ddd6fe; background: #f5f3ff; border-radius: 5px; cursor: pointer;">
                  ✏️ Edit
                </button>
              </div>
              <div class="cb-khata-info-details">
                <span>${allEntries.length} Orders (${activeEntries.length} active, ${completedEntries.length} paid)</span>
                <span> · 📦 <strong>${(summary.totalSafiGazana || 0).toLocaleString()}</strong> Safi Gazana</span>
                ${summary.totalKachaGazana > 0 ? `<span> · Kacha: ${(summary.totalKachaGazana).toLocaleString()}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="cb-khata-info-right">
            <div class="cb-khata-balance-big ${summary.totalRemaining > 0 ? 'negative' : 'positive'}">
              ${fmtCurrency(summary.totalRemaining || 0)}
            </div>
            <div class="cb-khata-balance-label-big">
              ${summary.totalRemaining > 0 ? 'Remaining Balance (بقایا رقم)' : 'Fully Paid / Settled (مکمل ادا)'}
            </div>
          </div>
        </div>

        <!-- Party Ledger Filter Tabs: Active (Default), Completed, All, Payments -->
        <div class="cb-subnav" style="margin-bottom: 1rem;">
          <button class="cb-subnav-btn ${partyGazanaDetailFilter === 'active' ? 'active' : ''}" onclick="setPartyGazanaDetailFilter('active')">
            🟢 Active (${activeEntries.length})
          </button>
          <button class="cb-subnav-btn ${partyGazanaDetailFilter === 'completed' ? 'active' : ''}" onclick="setPartyGazanaDetailFilter('completed')">
            ✅ Completed (${completedEntries.length})
          </button>
          <button class="cb-subnav-btn ${partyGazanaDetailFilter === 'all' ? 'active' : ''}" onclick="setPartyGazanaDetailFilter('all')">
            📋 All (${allEntries.length})
          </button>
          <button class="cb-subnav-btn ${partyGazanaDetailFilter === 'payments' ? 'active' : ''}" onclick="setPartyGazanaDetailFilter('payments')">
            💵 Payments (${allPayments.length})
          </button>
        </div>
      `;
    }

    if ($('partyGazanaEntriesContent')) {
      // ── Payments Tab View ──
      if (partyGazanaDetailFilter === 'payments') {
        if (allPayments.length === 0) {
          $('partyGazanaEntriesContent').innerHTML = `
            <div class="empty-state" style="padding: 2.5rem 1rem; text-align: center;">
              <div class="empty-icon">💵</div>
              <p style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">
                No payments recorded for ${escapeHtml(res.partyName)}.
              </p>
            </div>
          `;
        } else {
          const totalGeneral = storedGeneralPayments.reduce((s, p) => s + p.amount, 0);
          const grandTotal = allPayments.reduce((s, p) => s + p.amount, 0);
          const remainingBal = summary.totalRemaining || 0;

          $('partyGazanaEntriesContent').innerHTML = `
            <div style="display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1rem;">
              <div style="flex: 1; min-width: 140px; background: rgba(21,128,61,0.06); border: 1px solid rgba(21,128,61,0.2); border-radius: var(--radius-sm); padding: 0.6rem 0.75rem;">
                <div style="font-size: 0.7rem; font-weight: 600; color: #15803d; text-transform: uppercase; letter-spacing: 0.02em;">Total Received</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: #15803d; margin-top: 2px;">${fmtCurrency(grandTotal)}</div>
              </div>
              <div style="flex: 1; min-width: 140px; background: rgba(37,99,235,0.06); border: 1px solid rgba(37,99,235,0.2); border-radius: var(--radius-sm); padding: 0.6rem 0.75rem;">
                <div style="font-size: 0.7rem; font-weight: 600; color: #2563eb; text-transform: uppercase; letter-spacing: 0.02em;">General Payments (${storedGeneralPayments.length})</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: #2563eb; margin-top: 2px;">${fmtCurrency(totalGeneral)}</div>
              </div>
              <div style="flex: 1; min-width: 140px; background: ${remainingBal > 0 ? 'rgba(220,38,38,0.06)' : 'rgba(21,128,61,0.06)'}; border: 1px solid ${remainingBal > 0 ? 'rgba(220,38,38,0.25)' : 'rgba(21,128,61,0.2)'}; border-radius: var(--radius-sm); padding: 0.6rem 0.75rem;">
                <div style="font-size: 0.7rem; font-weight: 600; color: ${remainingBal > 0 ? '#b91c1c' : '#15803d'}; text-transform: uppercase; letter-spacing: 0.02em;">Remaining Balance (بقایا)</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: ${remainingBal > 0 ? '#b91c1c' : '#15803d'}; margin-top: 2px;">${fmtCurrency(remainingBal)}</div>
              </div>
            </div>
            <div class="gazana-table-container">
              <table class="gazana-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th style="text-align:right">Amount (₹)</th>
                    <th>Note / Details</th>
                    <th style="text-align:center; width: 110px;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${allPayments.map((p, idx) => {
                    const typeLabel = p.type === 'general'
                      ? '<span style="background: rgba(37,99,235,0.1); color: #2563eb; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">💵 General</span>'
                      : p.type === 'advance'
                        ? '<span style="background: rgba(124,58,237,0.1); color: #7c3aed; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">🔖 Advance</span>'
                        : p.type === 'completed'
                          ? '<span style="background: rgba(22,163,74,0.1); color: #16a34a; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">✅ Completed</span>'
                          : '<span style="background: rgba(2,132,199,0.1); color: #0284c7; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">📝 Entry</span>';
                    return `
                      <tr>
                        <td>${formatDate(p.date)}</td>
                        <td>${typeLabel}</td>
                        <td style="text-align:right; font-weight: 800; color: #15803d; font-size: 0.85rem;">${fmtCurrency(p.amount)}</td>
                        <td style="color: var(--text-secondary); font-size: 0.78rem; max-width: 260px; white-space: normal; word-break: break-word;">
                          ${p.entryVariety && p.entryVariety !== '—' ? `<span style="font-weight: 700; color: var(--text-primary); margin-right: 4px;">[${escapeHtml(p.entryVariety)}]</span>` : ''}
                          ${escapeHtml(p.note) || '<span style="color: var(--text-muted);">—</span>'}
                        </td>
                        <td style="text-align:center; white-space: nowrap;">
                          <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
                            <button class="btn btn-ghost" style="padding: 2px 7px; font-size: 0.72rem; color: #7c3aed; background: rgba(124,58,237,0.08); border-radius: 4px; font-weight: 700;" onclick="handleEditPaymentItem(${idx})" title="Edit payment">
                              ✏️ Edit
                            </button>
                            <button class="btn btn-ghost" style="padding: 2px 6px; font-size: 0.72rem; color: #dc2626; background: rgba(220,38,38,0.08); border-radius: 4px; font-weight: 700;" onclick="handleDeletePaymentItem(${idx})" title="Delete payment">
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="2" style="text-align: right; font-weight: 800;">Grand Total:</td>
                    <td style="text-align: right; font-weight: 800; color: #15803d; font-size: 0.9rem;">${fmtCurrency(grandTotal)}</td>
                    <td></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          `;
        }
      } else if (displayedEntries.length === 0) {
        $('partyGazanaEntriesContent').innerHTML = `
          <div class="empty-state" style="padding: 2.5rem 1rem; text-align: center;">
            <div class="empty-icon">📋</div>
            <p style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">
              No ${partyGazanaDetailFilter === 'active' ? 'active' : partyGazanaDetailFilter === 'completed' ? 'completed' : ''} entries found for ${escapeHtml(res.partyName)}.
            </p>
            <button class="btn btn-primary" onclick="openNewPartyEntryModal('${escapeHtml(res.partyName)}')">＋ Add Entry</button>
          </div>
        `;
      } else {
        let dSafi = 0, dTotalWO = 0, dTotalW = 0, dAdv = 0, dRem = 0;
        displayedEntries.forEach(e => {
          const calc = calcGazanaAmounts(e);
          dSafi += calc.safi;
          dTotalW += calc.totalW;
          dTotalWO += calc.totalWO;
          dAdv += e.advance || 0;
          dRem += isGazanaEntryCompleted(e) ? 0 : (e.remaining || 0);
        });

        $('partyGazanaEntriesContent').innerHTML = `
          <div class="gazana-table-container">
            <table class="gazana-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Quality</th>
                  <th style="text-align:right">Kacha<br>Gazana</th>
                  <th style="text-align:right">Safi<br>Gazana</th>
                  <th style="text-align:right" title="GST Rate">GST<br>Rate</th>
                  <th style="text-align:right" title="Rate With GST">Rate<br>W/Gst</th>
                  <th style="text-align:right" title="Total Without GST">Total<br>WO/Gst</th>
                  <th style="text-align:right" title="Total With GST">Total<br>W/Gst</th>
                  <th style="text-align:right">Advance<br>(₹)</th>
                  <th style="text-align:right">Received<br>(₹)</th>
                  <th style="text-align:right">Remaining<br>(₹)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${displayedEntries.map(e => {
                  const isCompleted = isGazanaEntryCompleted(e);
                  const displayRemaining = isCompleted ? 0 : Math.max(0, e.remaining || 0);
                  const installmentsSum = (e.paymentHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                  const calc = calcGazanaAmounts(e);
                  const totalWO = calc.totalWO;
                  const totalW = calc.totalW;
                  return `
                    <tr>
                      <td>${formatDate(e.date)}</td>
                      <td>
                        <strong>${escapeHtml(e.variety || '—')}</strong>
                        ${e.contractNo ? `<div style="font-size: 0.75rem; color: #2563eb; margin-top: 2px; font-weight: 600;">#${escapeHtml(e.contractNo)}</div>` : ''}
                        ${e.purchaser ? `<div style="font-size: 0.82rem; color: #0369a1; margin-top: 3px;"><strong>خریدار:</strong> ${escapeHtml(e.purchaser)}</div>` : ''}
                        ${e.loomWala ? `<div style="font-size: 0.82rem; color: #4338ca; margin-top: 2px;"><strong>لوم والا:</strong> ${escapeHtml(e.loomWala)}</div>` : ''}
                        ${e.gudaam ? `<div style="font-size: 0.82rem; color: #0d9488; margin-top: 2px;"><strong>گودام:</strong> ${escapeHtml(e.gudaam)}</div>` : ''}
                        ${e.note ? `<div style="font-size: 0.78rem; color: #64748b; margin-top: 3px; word-break: break-word;"><span style="color: #94a3b8;">📝</span> ${escapeHtml(e.note)}</div>` : ''}
                      </td>
                      <td style="text-align:right">${e.kachaGazana > 0 ? e.kachaGazana.toLocaleString() : '—'}</td>
                      <td style="text-align:right; font-weight: 700; color: #1e40af;">${(e.safiGazana || 0).toLocaleString()}</td>
                      <td style="text-align:right">
                        <div style="font-weight: 700; color: #0284c7;">${fmtRate(calc.rateWO)}</div>
                        ${e.rateType === 'kachy' ? `
                          <span style="font-size: 0.65rem; background: rgba(37,99,235,0.1); color: #2563eb; padding: 1px 4px; border-radius: 3px; font-weight: 700;">کچے</span>
                        ` : ''}
                      </td>
                      <td style="text-align:right">
                        <div style="font-weight: 700; color: #7c3aed;">${fmtRate(calc.rateW)}</div>
                        ${(!e.rateType || e.rateType === 'pakay') ? `
                          <span style="font-size: 0.65rem; background: rgba(124,58,237,0.1); color: #7c3aed; padding: 1px 4px; border-radius: 3px; font-weight: 700;">پکے</span>
                        ` : ''}
                      </td>
                      <td style="text-align:right; font-weight: 700; color: #0284c7;">${fmtCurrency(totalWO)}</td>
                      <td style="text-align:right; font-weight: 700; color: #7c3aed;">${fmtCurrency(totalW)}</td>
                      <td style="text-align:right; color: #16a34a; font-weight: 600;">
                        ${e.advance > 0 ? fmtCurrency(e.advance) : '—'}
                      </td>
                      <td style="text-align:right;">
                        ${installmentsSum > 0 ? `
                          <button class="btn btn-ghost" style="padding: 2px 6px; font-size: 0.76rem; font-weight: 700; color: #0284c7; background: rgba(2,132,199,0.08); border-radius: 4px;" onclick="openPaymentHistoryModal('${e._id}')" title="Click to view payment breakdown">
                            ${fmtCurrency(installmentsSum)} <small>(${e.paymentHistory.length})</small>
                          </button>
                        ` : '<span style="color: var(--text-muted);">—</span>'}
                      </td>
                      <td style="text-align:right; font-weight: 800; color: ${displayRemaining > 0 ? '#b91c1c' : '#16a34a'};">
                        ${fmtCurrency(displayRemaining)}
                      </td>
                      <td>
                        ${!isCompleted ? `
                          <label class="gazana-radio-wrap" title="Click radio button to mark as completed" onclick="event.stopPropagation();">
                            <input type="radio" class="gazana-status-radio" name="detail_status_radio_${e._id}" value="completed" onclick="event.stopPropagation();" onchange="markGazanaEntryCompleted('${e._id}')" />
                            <span class="status-pill active" style="cursor: pointer;" onclick="event.stopPropagation(); toggleEntryStatus('${e._id}', '${e.status}')" title="Click to toggle status">
                              🟢 Active
                            </span>
                          </label>
                        ` : `
                          <label class="gazana-radio-wrap completed" title="Completed entry" onclick="event.stopPropagation();">
                            <input type="radio" class="gazana-status-radio" checked disabled />
                            <span class="status-pill completed" style="cursor: pointer;" onclick="event.stopPropagation(); toggleEntryStatus('${e._id}', '${e.status}')" title="Click to toggle status">
                              ✅ Completed
                            </span>
                          </label>
                        `}
                      </td>
                      <td>
                        <div style="display: flex; gap: 5px; align-items: center;">
                          ${(!isCompleted && displayRemaining > 0) ? `
                            <button class="btn-add-payment" onclick="openQuickPaymentModal('${e._id}', '${escapeHtml(res.partyName)}', ${displayRemaining})" title="Add Partial Payment">
                              ＋ Add Payment
                            </button>
                          ` : ''}
                          <button class="gazana-menu-btn" onclick="toggleGazanaActionMenu(event, '${e._id}')" title="More Actions">⋮</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    }

    showView(viewPartyGazanaDetail);
  } catch (err) {
    toast('Failed to load party gazana details: ' + err.message, 'error');
  }
}

if ($('btnPartyGazanaBack')) {
  $('btnPartyGazanaBack').addEventListener('click', () => {
    showView(viewPartyGazanaDashboard);
    loadGazanaDashboard($('gazanaSearchInput') ? $('gazanaSearchInput').value.trim() : '');
  });
}

if ($('btnAddEntryForThisParty')) {
  $('btnAddEntryForThisParty').addEventListener('click', () => {
    openNewPartyEntryModal(currentGazanaPartyName);
  });
}

if ($('btnPartyGazanaSharePDF')) {
  $('btnPartyGazanaSharePDF').addEventListener('click', () => {
    if (currentGazanaPartyName) sharePartyGazanaPDF(currentGazanaPartyName, 'share');
  });
}

if ($('btnPartyGazanaDownloadPDF')) {
  $('btnPartyGazanaDownloadPDF').addEventListener('click', () => {
    if (currentGazanaPartyName) sharePartyGazanaPDF(currentGazanaPartyName, 'download');
  });
}

if ($('btnPartyGazanaReceipt')) {
  $('btnPartyGazanaReceipt').addEventListener('click', () => {
    if (currentGazanaPartyName) openPartyReceiptModal(currentGazanaPartyName);
  });
}

if ($('btnGeneralPayment')) {
  $('btnGeneralPayment').addEventListener('click', () => {
    if (currentGazanaPartyName && currentGazanaPartyData) {
      const totalRemaining = currentGazanaPartyData.summary ? (currentGazanaPartyData.summary.totalRemaining || 0) : 0;
      openGeneralPaymentModal(currentGazanaPartyName, totalRemaining);
    }
  });
}

// ── Open Party Gazana Form (Full Page View) ─────────────────
let gazanaReturnTo = 'dashboard'; // 'dashboard' or 'ledger'

function openPartyGazanaForm(preFillParty = '', editRecord = null) {
  if ($('partyGazanaFullForm')) $('partyGazanaFullForm').reset();
  if ($('gazanaFormEditId')) $('gazanaFormEditId').value = '';

  const isEditing = Boolean(editRecord);
  if ($('partyGazanaFormTitle')) {
    $('partyGazanaFormTitle').textContent = isEditing
      ? `✏️ Edit Entry — ${editRecord.partyName}`
      : 'New Party Gazana Entry (بنام انٹری)';
  }

  const activeView = views.find(v => v.classList.contains('active'));
  gazanaReturnTo = (activeView === viewPartyGazanaDetail) ? 'ledger' : 'dashboard';

  populatePartyNamesDatalist();

  const today = new Date().toISOString().slice(0, 10);
  if ($('formGazanaDate')) $('formGazanaDate').value = today;
  if ($('formGazanaAdvance')) $('formGazanaAdvance').value = '0';
  if ($('formGazanaStatus')) $('formGazanaStatus').value = 'active';
  if ($('formGazanaLoomWala')) $('formGazanaLoomWala').value = '';
  if ($('formGazanaPurchaser')) $('formGazanaPurchaser').value = '';
  if ($('formGazanaGudaam')) $('formGazanaGudaam').value = '';

  if (editRecord) {
    if ($('partyGazanaFormTitle')) $('partyGazanaFormTitle').textContent = '✏️ ترمیم گزانہ انٹری';
    if ($('gazanaFormEditId')) $('gazanaFormEditId').value = editRecord._id;
    if ($('formGazanaDate')) $('formGazanaDate').value = editRecord.date ? new Date(editRecord.date).toISOString().slice(0, 10) : today;
    if ($('formGazanaPartyName')) $('formGazanaPartyName').value = editRecord.partyName || '';
    if ($('formGazanaContractNo')) $('formGazanaContractNo').value = editRecord.contractNo || '';
    if ($('formGazanaLoomWala')) $('formGazanaLoomWala').value = editRecord.loomWala || '';
    if ($('formGazanaPurchaser')) $('formGazanaPurchaser').value = editRecord.purchaser || '';
    if ($('formGazanaGudaam')) $('formGazanaGudaam').value = editRecord.gudaam || '';
    if ($('formGazanaVariety')) $('formGazanaVariety').value = editRecord.variety || '';
    if ($('formGazanaKacha')) $('formGazanaKacha').value = editRecord.kachaGazana || '';
    if ($('formGazanaSafi')) $('formGazanaSafi').value = editRecord.safiGazana || '';
    const rateWithoutGst = editRecord.rate || (editRecord.gstRate ? Math.round((editRecord.gstRate / 1.18) * 100) / 100 : '');
    if ($('formGazanaRate')) $('formGazanaRate').value = rateWithoutGst || '';
    if ($('formGazanaAdvance')) $('formGazanaAdvance').value = editRecord.advance || 0;
    if ($('formGazanaStatus')) $('formGazanaStatus').value = editRecord.status || 'active';
    if ($('formGazanaNote')) $('formGazanaNote').value = editRecord.note || '';

    const rateType = editRecord.rateType || 'pakay';
    if ($('rateTypePakay')) $('rateTypePakay').checked = (rateType === 'pakay');
    if ($('rateTypeKachy')) $('rateTypeKachy').checked = (rateType === 'kachy');
  } else {
    if ($('partyGazanaFormTitle')) $('partyGazanaFormTitle').textContent = '📋 نئی گزانہ انٹری';
    if (preFillParty && $('formGazanaPartyName')) {
      $('formGazanaPartyName').value = preFillParty;
    }
    if ($('rateTypePakay')) $('rateTypePakay').checked = true;
    if ($('rateTypeKachy')) $('rateTypeKachy').checked = false;
  }

  updateGazanaFullFormCalculations();
  showView(viewPartyGazanaForm);
}

async function openEditPartyEntry(id) {
  try {
    const e = await apiGet(`${PARTY_ENTRIES_API}/${id}`);
    if (!e) return;
    openPartyGazanaForm(e.partyName, e);
  } catch (err) {
    toast('Failed to load entry: ' + err.message, 'error');
  }
}

// Aliases for compatibility
function openNewPartyEntryModal(preFillParty = '') {
  openPartyGazanaForm(preFillParty);
}
function openEditPartyEntryModal(id) {
  openEditPartyEntry(id);
}

// ── Real-time Calculations on Full Page Form ───────────────
function updateGazanaFullFormCalculations() {
  const safi = parseFloat($('formGazanaSafi')?.value) || 0;
  // User enters Rate Without GST (Rate WO/Gst)
  const rateWithoutGst = parseFloat($('formGazanaRate')?.value) || 0;
  const advance = parseFloat($('formGazanaAdvance')?.value) || 0;
  const isPakay = Boolean($('rateTypePakay')?.checked);

  // Rate With GST (18%) = rateWithoutGst * 1.18
  const rateWithGst = rateWithoutGst > 0 ? Math.round(rateWithoutGst * 1.18 * 100) / 100 : 0;
  if ($('formGazanaGstRate')) {
    $('formGazanaGstRate').value = rateWithGst > 0 ? rateWithGst.toFixed(2) : '';
  }

  // Calculate both totals: Without GST and With GST
  const totalWithoutGst = Math.round(safi * rateWithoutGst * 100) / 100;
  const totalWithGst = Math.round(safi * rateWithGst * 100) / 100;

  // Active billable total: With GST if pakay (default), Without GST if kachy
  const activeTotal = isPakay ? totalWithGst : totalWithoutGst;

  // Deduct advance from active total
  const remaining = Math.max(0, Math.round((activeTotal - advance) * 100) / 100);

  if ($('rateTypeCardKachy')) $('rateTypeCardKachy').classList.toggle('active', !isPakay);
  if ($('rateTypeCardPakay')) $('rateTypeCardPakay').classList.toggle('active', isPakay);

  if ($('formGazanaTotalWODisplay')) {
    $('formGazanaTotalWODisplay').textContent = fmtCurrency(totalWithoutGst);
  }

  if ($('formGazanaTotalDisplay')) {
    $('formGazanaTotalDisplay').textContent = fmtCurrency(totalWithGst);
  }

  if ($('formGazanaRemainingDisplay')) {
    $('formGazanaRemainingDisplay').textContent = fmtCurrency(remaining);
    $('formGazanaRemainingDisplay').style.color = remaining > 0 ? '#b91c1c' : '#16a34a';
  }

  if ($('formGazanaStatus')) {
    if (safi <= 0 || activeTotal <= 0) {
      $('formGazanaStatus').value = 'active';
    } else if (remaining <= 0 && activeTotal > 0) {
      $('formGazanaStatus').value = 'completed';
    }
  }
}

// Bind live listeners for full form calculations
['formGazanaSafi', 'formGazanaRate', 'formGazanaAdvance', 'formGazanaKacha', 'rateTypeKachy', 'rateTypePakay'].forEach(id => {
  const el = $(id);
  if (el) {
    el.addEventListener('input', updateGazanaFullFormCalculations);
    el.addEventListener('change', updateGazanaFullFormCalculations);
  }
});

// Auto-format Gazana Variety Input (e.g. 76x64=104, 74x63=98)
const varietyInput = $('formGazanaVariety');
if (varietyInput) {
  let isDeletingVariety = false;

  varietyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      isDeletingVariety = true;
      const val = varietyInput.value;
      if (val.endsWith('x') || val.endsWith('=')) {
        e.preventDefault();
        varietyInput.value = val.slice(0, -2);
      }
    } else {
      isDeletingVariety = false;
    }
  });

  varietyInput.addEventListener('input', (e) => {
    const isDelete = isDeletingVariety || (e.inputType && e.inputType.startsWith('delete'));
    let val = varietyInput.value;
    const rawDigits = val.replace(/\D/g, '');

    if (isDelete) {
      if (!rawDigits) {
        varietyInput.value = '';
        return;
      }
      if (val.endsWith('x') || val.endsWith('=')) {
        val = val.slice(0, -1);
      }
      varietyInput.value = val;
      return;
    }

    if (!rawDigits) return;

    let formatted = '';
    if (rawDigits.length <= 2) {
      formatted = rawDigits;
      if (rawDigits.length === 2) {
        formatted += 'x';
      }
    } else if (rawDigits.length <= 4) {
      formatted = rawDigits.slice(0, 2) + 'x' + rawDigits.slice(2);
      if (rawDigits.length === 4) {
        formatted += '=';
      }
    } else {
      formatted = rawDigits.slice(0, 2) + 'x' + rawDigits.slice(2, 4) + '=' + rawDigits.slice(4);
    }

    varietyInput.value = formatted;
  });
}

// Form Back & Cancel Listeners
function returnFromGazanaForm() {
  if (gazanaReturnTo === 'ledger' && currentGazanaPartyName) {
    showView(viewPartyGazanaDetail);
    openPartyGazanaDetail(currentGazanaPartyName, false);
  } else {
    showView(viewPartyGazanaDashboard);
    loadGazanaDashboard($('gazanaSearchInput') ? $('gazanaSearchInput').value.trim() : '');
  }
}

if ($('btnGazanaFormBack')) {
  $('btnGazanaFormBack').addEventListener('click', returnFromGazanaForm);
}
if ($('btnGazanaFormCancel')) {
  $('btnGazanaFormCancel').addEventListener('click', returnFromGazanaForm);
}

// Double Enter on "نوٹ / ضروری تفصیلات" to save entry
let lastGazanaNoteEnterTime = 0;
const gazanaNoteInput = $('formGazanaNote');
if (gazanaNoteInput) {
  gazanaNoteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const now = Date.now();
      if (now - lastGazanaNoteEnterTime < 650 || e.ctrlKey) {
        e.preventDefault();
        lastGazanaNoteEnterTime = 0;
        // Trim any trailing newline added by the first enter press
        if (gazanaNoteInput.value.endsWith('\n')) {
          gazanaNoteInput.value = gazanaNoteInput.value.slice(0, -1);
        }
        const saveBtn = $('btnSaveGazanaFullForm');
        if (saveBtn) {
          saveBtn.click();
        } else {
          savePartyGazanaForm();
        }
        return;
      }
      lastGazanaNoteEnterTime = now;
    } else {
      lastGazanaNoteEnterTime = 0;
    }
  });
}

// ── Save Party Gazana Entry from Full Page Form ───────────
async function savePartyGazanaForm() {
  try {
    const id = $('gazanaFormEditId') ? $('gazanaFormEditId').value : '';
    const date = $('formGazanaDate') ? $('formGazanaDate').value : '';
    const rawPartyName = $('formGazanaPartyName') ? $('formGazanaPartyName').value.trim() : '';
    const partyName = rawPartyName || 'Daily Entries';
    const loomWala = $('formGazanaLoomWala') ? $('formGazanaLoomWala').value.trim() : '';
    const purchaser = $('formGazanaPurchaser') ? $('formGazanaPurchaser').value.trim() : '';
    const gudaam = $('formGazanaGudaam') ? $('formGazanaGudaam').value.trim() : '';
    const variety = $('formGazanaVariety') ? $('formGazanaVariety').value.trim() : '';
    const kachaGazana = parseFloat($('formGazanaKacha')?.value) || 0;
    const safiGazana = parseFloat($('formGazanaSafi')?.value) || 0;
    const rateWithoutGst = parseFloat($('formGazanaRate')?.value) || 0;
    const rateWithGst = rateWithoutGst > 0 ? Math.round(rateWithoutGst * 1.18 * 100) / 100 : 0;
    const advance = parseFloat($('formGazanaAdvance')?.value) || 0;
    const contractNo = $('formGazanaContractNo') ? $('formGazanaContractNo').value.trim() : '';
    const note = $('formGazanaNote') ? $('formGazanaNote').value.trim() : '';
    const status = (safiGazana <= 0) ? 'active' : ($('formGazanaStatus') ? $('formGazanaStatus').value : 'active');

    if (safiGazana > 0 && (!rateWithoutGst || rateWithoutGst <= 0)) {
      toast('Please enter valid Rate.', 'error');
      return;
    }

    const payload = {
      date,
      partyName,
      loomWala,
      purchaser,
      gudaam,
      variety,
      kachaGazana,
      safiGazana,
      rate: rateWithoutGst,
      gstRate: rateWithGst,
      rateType: $('rateTypeKachy')?.checked ? 'kachy' : 'pakay',
      advance,
      contractNo,
      note,
      status
    };

    if (id) {
      await apiPut(`${PARTY_ENTRIES_API}/${id}`, payload);
      toast('Entry updated successfully!', 'success');
    } else {
      await apiPost(PARTY_ENTRIES_API, payload);
      toast('Party Gazana entry created successfully!', 'success');
    }

    // Return to appropriate view
    if (gazanaReturnTo === 'ledger' && currentGazanaPartyName) {
      showView(viewPartyGazanaDetail);
      openPartyGazanaDetail(currentGazanaPartyName, false);
    } else {
      showView(viewPartyGazanaDashboard);
      loadGazanaDashboard($('gazanaSearchInput') ? $('gazanaSearchInput').value.trim() : '');
    }
  } catch (err) {
    toast('Failed to save entry: ' + err.message, 'error');
  }
}

// ── Quick Add Payment Modal ────────────────────────────────
async function openQuickPaymentModal(entryId, partyName, remaining) {
  $('paymentEntryId').value = entryId;
  $('paymentDate').value = new Date().toISOString().slice(0, 10);
  $('paymentAmount').value = remaining > 0 ? remaining : '';
  $('paymentNote').value = '';

  let entryDetails = null;
  try {
    entryDetails = await apiGet(`${PARTY_ENTRIES_API}/${entryId}`);
  } catch (err) {}

  const totalAmount = entryDetails ? entryDetails.totalAmount : 0;
  const advance = entryDetails ? (entryDetails.advance || 0) : 0;
  const history = entryDetails && Array.isArray(entryDetails.paymentHistory) ? entryDetails.paymentHistory : [];
  const installmentsTotal = history.reduce((sum, p) => sum + (p.amount || 0), 0);
  const netRemaining = remaining || (entryDetails ? entryDetails.remaining : 0);

  $('partyPaymentModalSummary').innerHTML = `
    <div style="font-size: 0.82rem; display: flex; flex-direction: column; gap: 4px;">
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--text-muted);">Party:</span>
        <strong>👤 ${escapeHtml(partyName || (entryDetails ? entryDetails.partyName : ''))}</strong>
      </div>
      ${totalAmount > 0 ? `
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Total Order Amount:</span>
          <strong>${fmtCurrency(totalAmount)}</strong>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; color: #16a34a;">
        <span>Initial Booking Advance:</span>
        <strong>${fmtCurrency(advance)}</strong>
      </div>
      ${installmentsTotal > 0 ? `
        <div style="display: flex; justify-content: space-between; color: #0284c7;">
          <span>Subsequent Received (${history.length} payment${history.length > 1 ? 's' : ''}):</span>
          <strong>${fmtCurrency(installmentsTotal)}</strong>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; border-top: 1px dashed var(--border); padding-top: 5px; margin-top: 2px; color: #b91c1c; font-weight: 800;">
        <span>Net Outstanding Balance:</span>
        <span style="font-size: 0.95rem;">${fmtCurrency(netRemaining)}</span>
      </div>
    </div>
  `;

  $('partyPaymentModal').classList.remove('hidden');
  setTimeout(() => $('paymentAmount').focus(), 50);
}

function closePartyPaymentModal() {
  $('partyPaymentModal').classList.add('hidden');
}

async function submitPartyPayment() {
  try {
    const id = $('paymentEntryId').value;
    const amount = parseFloat($('paymentAmount').value);
    const date = $('paymentDate').value;
    const note = $('paymentNote').value.trim();

    if (!amount || amount <= 0) {
      toast('Please enter a valid payment amount.', 'error');
      return;
    }

    await apiPost(`${PARTY_ENTRIES_API}/${id}/payment`, { amount, date, note });
    toast(`Partial payment of ${fmtCurrency(amount)} recorded successfully!`, 'success');
    closePartyPaymentModal();

    if (views.find(v => v.classList.contains('active')) === viewPartyGazanaDetail && currentGazanaPartyName) {
      openPartyGazanaDetail(currentGazanaPartyName, false);
    } else {
      loadGazanaDashboard($('gazanaSearchInput') ? $('gazanaSearchInput').value.trim() : '');
    }
  } catch (err) {
    toast('Failed to record payment: ' + err.message, 'error');
  }
}

// ── General Party Payment Modal ────────────────────────────
function openGeneralPaymentModal(partyName, totalRemaining) {
  $('generalPaymentDate').value = new Date().toISOString().slice(0, 10);
  $('generalPaymentAmount').value = totalRemaining > 0 ? totalRemaining : '';
  $('generalPaymentNote').value = '';

  const activeEntries = (currentGazanaPartyData && currentGazanaPartyData.entries)
    ? currentGazanaPartyData.entries.filter(e => e.status === 'active' && e.remaining > 0)
    : [];

  const summary = currentGazanaPartyData ? (currentGazanaPartyData.summary || {}) : {};

  $('generalPaymentModalSummary').innerHTML = `
    <div style="font-size: 0.82rem; display: flex; flex-direction: column; gap: 4px;">
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--text-muted);">Party:</span>
        <strong>👤 ${escapeHtml(partyName)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--text-muted);">Active Entries with Balance:</span>
        <strong>${activeEntries.length} entries</strong>
      </div>
      ${summary.totalAmount ? `
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Total Order Amount:</span>
          <strong>${fmtCurrency(summary.totalAmount)}</strong>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; border-top: 1px dashed var(--border); padding-top: 5px; margin-top: 2px; color: #b91c1c; font-weight: 800;">
        <span>Total Outstanding Balance (بقایا):</span>
        <span style="font-size: 0.95rem;">${fmtCurrency(totalRemaining)}</span>
      </div>
      <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; background: rgba(21,128,61,0.06); padding: 4px 6px; border-radius: 4px; border-left: 3px solid #15803d;">
        💡 This payment will be distributed across active entries (oldest first) and deducted from outstanding balance.
      </div>
    </div>
  `;

  $('generalPaymentModal').classList.remove('hidden');
  setTimeout(() => $('generalPaymentAmount').focus(), 50);
}

function closeGeneralPaymentModal() {
  $('generalPaymentModal').classList.add('hidden');
}

async function submitGeneralPayment() {
  try {
    const amount = parseFloat($('generalPaymentAmount').value);
    const date = $('generalPaymentDate').value;
    const note = $('generalPaymentNote').value.trim();

    if (!amount || amount <= 0) {
      toast('Please enter a valid payment amount.', 'error');
      return;
    }

    if (!currentGazanaPartyName) {
      toast('No party selected.', 'error');
      return;
    }

    const res = await apiPost(
      `${PARTY_ENTRIES_API}/party/${encodeURIComponent(currentGazanaPartyName)}/general-payment`,
      { amount, date, note }
    );

    toast(`${res.message || 'General payment recorded successfully!'}`, 'success');
    closeGeneralPaymentModal();

    // Refresh the party ledger view
    if (currentGazanaPartyName) {
      openPartyGazanaDetail(currentGazanaPartyName, false);
    }
  } catch (err) {
    toast('Failed to record general payment: ' + err.message, 'error');
  }
}

// ── Payment History Breakdown Modal ────────────────────────
async function openPaymentHistoryModal(entryId) {
  try {
    const entry = await apiGet(`${PARTY_ENTRIES_API}/${entryId}`);
    if (!entry) return;

    const history = Array.isArray(entry.paymentHistory) ? entry.paymentHistory : [];
    const installmentsTotal = history.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalRec = Math.round(((entry.advance || 0) + installmentsTotal) * 100) / 100;
    const isCompleted = isGazanaEntryCompleted(entry);
    const displayRemaining = isCompleted ? 0 : Math.max(0, entry.remaining || 0);
    const calc = calcGazanaAmounts(entry);

    let historyHtml = `
      <div style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; padding: 10px; margin-bottom: 12px; font-size: 0.8125rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="color: var(--text-muted);">Party:</span>
          <strong>👤 ${escapeHtml(entry.partyName)}</strong>
        </div>
        ${entry.variety ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span style="color: var(--text-muted);">Quality:</span>
            <span>${escapeHtml(entry.variety)}</span>
          </div>
        ` : ''}
        ${entry.purchaser ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span style="color: var(--text-muted);">خریدار:</span>
            <span style="color: #0369a1; font-weight: 600;">${escapeHtml(entry.purchaser)}</span>
          </div>
        ` : ''}
        ${entry.loomWala ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span style="color: var(--text-muted);">لوم والا:</span>
            <span style="color: #4338ca; font-weight: 600;">${escapeHtml(entry.loomWala)}</span>
          </div>
        ` : ''}
        ${entry.gudaam ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span style="color: var(--text-muted);">گودام:</span>
            <span style="color: #0d9488; font-weight: 600;">${escapeHtml(entry.gudaam)}</span>
          </div>
        ` : ''}
        ${entry.contractNo ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span style="color: var(--text-muted);">Contract #:</span>
            <span style="color: #2563eb; font-weight: 600;">#${escapeHtml(entry.contractNo)}</span>
          </div>
        ` : ''}
        ${entry.note ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span style="color: var(--text-muted);">Note / Description:</span>
            <span style="color: #64748b; font-style: italic;">📝 ${escapeHtml(entry.note)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="color: var(--text-muted);">GST Rate:</span>
          <span style="color: #0284c7; font-weight: 700;">
            ₹ ${fmtRate(calc.rateWO)} ${entry.rateType === 'kachy' ? '<span style="font-size:0.68rem; color:#2563eb;">(کچے)</span>' : ''}
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="color: var(--text-muted);">Rate W/Gst (18%):</span>
          <span style="color: #7c3aed; font-weight: 700;">
            ₹ ${fmtRate(calc.rateW)} ${(!entry.rateType || entry.rateType === 'pakay') ? '<span style="font-size:0.68rem; color:#7c3aed;">(پکے)</span>' : ''}
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="color: var(--text-muted);">Total (WO/Gst):</span>
          <strong style="color: #0284c7;">${fmtCurrency(calc.totalWO)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="color: var(--text-muted);">Total (W/Gst):</span>
          <strong style="color: #7c3aed;">${fmtCurrency(calc.totalW)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px; color: #16a34a;">
          <span>Initial Booking Advance:</span>
          <strong>${fmtCurrency(entry.advance || 0)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; border-top: 1px dashed var(--border); padding-top: 5px; margin-top: 4px; font-weight: 800;">
          <span style="color: #0284c7;">Total Received:</span>
          <span style="color: #0284c7;">${fmtCurrency(totalRec)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: ${displayRemaining > 0 ? '#b91c1c' : '#16a34a'}; font-weight: 800; margin-top: 2px;">
          <span>Remaining Balance:</span>
          <span>${fmtCurrency(displayRemaining)}</span>
        </div>
      </div>

      <div style="font-weight: 700; font-size: 0.875rem; color: var(--text-primary); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
        <span>📜 Payment Log (${history.length + (entry.advance > 0 ? 1 : 0)} records)</span>
        ${(!isCompleted && displayRemaining > 0) ? `
          <button class="btn btn-sm btn-primary" onclick="closePaymentHistoryModal(); openQuickPaymentModal('${entry._id}', '${escapeHtml(entry.partyName)}', ${displayRemaining});" style="font-size: 0.72rem; padding: 3px 8px;">
            ＋ Add Payment
          </button>
        ` : ''}
      </div>

      <div style="max-height: 240px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
          <thead>
            <tr style="background: var(--bg-tertiary); border-bottom: 1px solid var(--border);">
              <th style="padding: 6px 8px; text-align: left;">Date</th>
              <th style="padding: 6px 8px; text-align: left;">Type / Note</th>
              <th style="padding: 6px 8px; text-align: right;">Amount</th>
              <th style="padding: 6px 8px; text-align: center; width: 32px;"></th>
            </tr>
          </thead>
          <tbody>
            ${entry.advance > 0 ? `
              <tr style="border-bottom: 1px solid var(--border); background: rgba(22, 163, 74, 0.04);">
                <td style="padding: 6px 8px;">${formatDate(entry.date)}</td>
                <td style="padding: 6px 8px;">
                  <strong style="color: #16a34a;">💵 Initial Booking Advance</strong>
                </td>
                <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: #16a34a;">
                  ${fmtCurrency(entry.advance)}
                </td>
                <td style="padding: 6px 8px; text-align: center; color: var(--text-muted); font-size: 0.7rem;">—</td>
              </tr>
            ` : ''}
            ${history.map(p => {
              const isAuto = p.note === 'Paid Amount' || 
                             p.note === 'Paid Amount (مکمل ادائیگی)' || 
                             p.note === 'مکمل ادائیگی (Final Settlement)' ||
                             (p.note && p.note.includes('Final Settlement')) ||
                             (p.note && p.note.includes('Paid Amount')) ||
                             (p.note && p.note.includes('مکمل ادائیگی'));
              return `
              <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 6px 8px;">${formatDate(p.date)}</td>
                <td style="padding: 6px 8px;">
                  ${isAuto ? `
                    <strong style="color: #16a34a; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                      ✅ Paid Amount
                    </strong>
                    <div style="font-size: 0.72rem; color: #15803d; font-weight: 600;">مکمل ادا شدہ رقم</div>
                  ` : `
                    <strong style="color: #0284c7; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                      📥 Partial Payment
                    </strong>
                    ${p.note ? `<div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">${escapeHtml(p.note)}</div>` : ''}
                  `}
                </td>
                <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: ${isAuto ? '#16a34a' : '#0284c7'};">
                  ${fmtCurrency(p.amount)}
                </td>
                <td style="padding: 6px 8px; text-align: center;">
                  <button class="btn-action delete" style="padding: 2px 4px; font-size: 0.75rem;" title="Delete this payment" onclick="deleteInstallmentPayment('${entry._id}', '${p._id}')">
                    🗑️
                  </button>
                </td>
              </tr>
            `;}).join('')}
            ${history.length === 0 && (!entry.advance || entry.advance <= 0) ? `
              <tr>
                <td colspan="4" style="text-align: center; padding: 12px; color: var(--text-muted);">No payments recorded yet.</td>
              </tr>
            ` : ''}
          </tbody>
        </table>
      </div>
    `;

    $('partyPaymentHistoryBody').innerHTML = historyHtml;
    $('partyPaymentHistoryModal').classList.remove('hidden');
  } catch (err) {
    toast('Failed to load payment history: ' + err.message, 'error');
  }
}

function closePaymentHistoryModal() {
  $('partyPaymentHistoryModal').classList.add('hidden');
}

async function deleteInstallmentPayment(entryId, paymentId) {
  showConfirm('Delete Payment', 'Are you sure you want to delete this payment record? This will adjust the balance.', async () => {
    try {
      await apiDelete(`${PARTY_ENTRIES_API}/${entryId}/payment/${paymentId}`);
      toast('Payment record deleted!', 'success');
      openPaymentHistoryModal(entryId);

      if (views.find(v => v.classList.contains('active')) === viewPartyGazanaDetail && currentGazanaPartyName) {
        openPartyGazanaDetail(currentGazanaPartyName, false);
      } else {
        loadGazanaDashboard($('gazanaSearchInput') ? $('gazanaSearchInput').value.trim() : '');
      }
    } catch (err) {
      toast('Failed to delete payment: ' + err.message, 'error');
    }
  });
}

// ── Mark Entry as Completed (Radio Button) ────────────────
async function markGazanaEntryCompleted(entryId) {
  try {
    const entry = await apiGet(`${PARTY_ENTRIES_API}/${entryId}`);
    if (entry && (Number(entry.safiGazana) || 0) <= 0) {
      return toast('Cannot mark entry as completed because Safi Gazana is empty or 0.', 'warning');
    }
    await apiPatch(`${PARTY_ENTRIES_API}/${entryId}/status`, { status: 'completed' });
    toast('Entry marked as completed! ✅', 'success');

    if (views.find(v => v.classList.contains('active')) === viewPartyGazanaDetail && currentGazanaPartyName) {
      openPartyGazanaDetail(currentGazanaPartyName, false);
    } else {
      loadGazanaDashboard($('gazanaSearchInput') ? $('gazanaSearchInput').value.trim() : '');
    }
  } catch (err) {
    toast('Failed to mark entry as completed: ' + err.message, 'error');
  }
}
const markEntryCompleted = markGazanaEntryCompleted;

// ── Toggle Status ──────────────────────────────────────────
async function toggleEntryStatus(entryId, currentStatus) {
  try {
    const entry = await apiGet(`${PARTY_ENTRIES_API}/${entryId}`);
    if (entry && currentStatus === 'active' && (Number(entry.safiGazana) || 0) <= 0) {
      return toast('Cannot mark entry as completed because Safi Gazana is empty or 0.', 'warning');
    }
    const newStatus = currentStatus === 'active' ? 'completed' : 'active';
    await apiPatch(`${PARTY_ENTRIES_API}/${entryId}/status`, { status: newStatus });
    toast(`Entry marked as ${newStatus}!`, 'info');

    if (views.find(v => v.classList.contains('active')) === viewPartyGazanaDetail && currentGazanaPartyName) {
      openPartyGazanaDetail(currentGazanaPartyName, false);
    } else {
      loadGazanaDashboard($('gazanaSearchInput') ? $('gazanaSearchInput').value.trim() : '');
    }
  } catch (err) {
    toast('Failed to update status: ' + err.message, 'error');
  }
}

// ── Delete Entry ───────────────────────────────────────────
function deletePartyEntry(id) {
  showConfirm('Delete Gazana Entry', 'Are you sure you want to delete this gazana entry? This cannot be undone.', async () => {
    try {
      await apiDelete(`${PARTY_ENTRIES_API}/${id}`);
      toast('Gazana entry deleted', 'success');

      if (views.find(v => v.classList.contains('active')) === viewPartyGazanaDetail && currentGazanaPartyName) {
        openPartyGazanaDetail(currentGazanaPartyName, false);
      } else {
        loadGazanaDashboard($('gazanaSearchInput') ? $('gazanaSearchInput').value.trim() : '');
      }
    } catch (err) {
      toast('Failed to delete: ' + err.message, 'error');
    }
  });
}

// ── Share / Download Party Gazana PDF ──────────────────────
async function sharePartyGazanaPDF(partyName, action = 'share') {
  if (!partyName) return;
  try {
    toast('Generating Party Gazana PDF...', 'info');
    const res = await apiGet(`${PARTY_ENTRIES_API}/party/${encodeURIComponent(partyName)}`);
    if (!res) throw new Error('Party ledger data not found');

    const entries = res.entries || [];
    const summary = res.summary || {};

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';

    const rowsHtml = entries.map((e, idx) => {
      const calc = calcGazanaAmounts(e);
      return `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background: #f8fafc;' : ''}">
        <td style="padding: 6px 4px; font-size: 9.5px;">${formatDate(e.date)}</td>
        <td style="padding: 6px 4px; font-size: 9.5px; font-weight: 700; color: #0f172a;">
          ${escapeHtml(e.variety || '—')}
          ${e.contractNo ? `<span style="color: #2563eb; font-size: 8.5px; display: block; font-weight: 600;">#${escapeHtml(e.contractNo)}</span>` : ''}
          ${e.purchaser ? `<span style="color: #0369a1; font-size: 8px; display: block;">خریدار: ${escapeHtml(e.purchaser)}</span>` : ''}
          ${e.loomWala ? `<span style="color: #4338ca; font-size: 8px; display: block;">لوم والا: ${escapeHtml(e.loomWala)}</span>` : ''}
          ${e.gudaam ? `<span style="color: #0d9488; font-size: 8px; display: block;">گودام: ${escapeHtml(e.gudaam)}</span>` : ''}
          ${e.note ? `<span style="color: #64748b; font-size: 8px; display: block; font-weight: normal; margin-top: 1px;">📝 ${escapeHtml(e.note)}</span>` : ''}
        </td>
        <td style="padding: 6px 4px; font-size: 9.5px; text-align: right;">${e.kachaGazana > 0 ? e.kachaGazana.toLocaleString() : '—'}</td>
        <td style="padding: 6px 4px; font-size: 9.5px; text-align: right; font-weight: 700; color: #1e40af;">${(e.safiGazana || 0).toLocaleString()}</td>
        <td style="padding: 6px 4px; font-size: 9.5px; text-align: right;">
          <div style="font-weight: 700; color: #0284c7;">₹ ${fmtRate(calc.rateWO)}</div>
          ${e.rateType === 'kachy' ? '<span style="font-size:7.5px; color:#2563eb;">(کچے)</span>' : ''}
        </td>
        <td style="padding: 6px 4px; font-size: 9.5px; text-align: right; color: #7c3aed;">
          <div style="font-weight: 700;">₹ ${fmtRate(calc.rateW)}</div>
          ${(!e.rateType || e.rateType === 'pakay') ? '<span style="font-size:7.5px; color:#7c3aed;">(پکے)</span>' : ''}
        </td>
        <td style="padding: 6px 4px; font-size: 9.5px; text-align: right; font-weight: 700; color: #0284c7;">${fmtCurrency(calc.totalWO)}</td>
        <td style="padding: 6px 4px; font-size: 9.5px; text-align: right; font-weight: 700; color: #7c3aed;">${fmtCurrency(calc.totalW)}</td>
        <td style="padding: 6px 4px; font-size: 9.5px; text-align: right; color: #15803d; font-weight: 700;">${fmtCurrency(e.advance)}</td>
        <td style="padding: 6px 4px; font-size: 9.5px; text-align: right; font-weight: 800; color: ${e.remaining > 0 ? '#b91c1c' : '#15803d'};">${fmtCurrency(e.remaining)}</td>
        <td style="padding: 6px 4px; font-size: 9px; text-align: center;">
          <span style="background: ${e.remaining <= 0 ? '#dcfce7' : '#dbeafe'}; color: ${e.remaining <= 0 ? '#15803d' : '#1e40af'}; padding: 2px 6px; border-radius: 4px; font-weight: 700;">
            ${e.remaining <= 0 ? 'PAID' : 'ACTIVE'}
          </span>
        </td>
      </tr>
    `}).join('');

    container.innerHTML = `
      <div id="gazanaPdfRoot" style="padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; background: #ffffff; width: 700px; max-width: 700px; box-sizing: border-box;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a, #1e3a8a); color: #ffffff; padding: 14px 18px; border-radius: 6px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.5px; color: #ffffff;">📋 ${escapeHtml(res.partyName)}</h1>
            <p style="margin: 3px 0 0 0; font-size: 11px; color: #93c5fd;">
              Gazana Order Statement · ${summary.totalEntries} Orders (${summary.activeCount} Active, ${summary.completedCount} Paid)
            </p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 9.5px; color: #cbd5e1; text-transform: uppercase;">Outstanding Balance</div>
            <div style="font-size: 18px; font-weight: 800; color: ${summary.totalRemaining > 0 ? '#fca5a5' : '#86efac'};">
              ${fmtCurrency(summary.totalRemaining || 0)}
            </div>
          </div>
        </div>

        <!-- Metric Stat Cards -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px; text-align: center;">
            <div style="font-size: 8.5px; color: #64748b; font-weight: 700; text-transform: uppercase;">Safi Gazana</div>
            <div style="font-size: 12px; font-weight: 800; color: #1e40af; margin-top: 2px;">${(summary.totalSafiGazana || 0).toLocaleString()}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px; text-align: center;">
            <div style="font-size: 8.5px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total (W/Gst)</div>
            <div style="font-size: 12px; font-weight: 800; color: #7c3aed; margin-top: 2px;">${fmtCurrency(summary.totalAmount || 0)}</div>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 6px; text-align: center;">
            <div style="font-size: 8.5px; color: #15803d; font-weight: 700; text-transform: uppercase;">Advance Received</div>
            <div style="font-size: 12px; font-weight: 800; color: #15803d; margin-top: 2px;">${fmtCurrency(summary.totalAdvance || 0)}</div>
          </div>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 6px; text-align: center;">
            <div style="font-size: 8.5px; color: #b91c1c; font-weight: 700; text-transform: uppercase;">Remaining</div>
            <div style="font-size: 12px; font-weight: 800; color: #b91c1c; margin-top: 2px;">${fmtCurrency(summary.totalRemaining || 0)}</div>
          </div>
        </div>

        <!-- Ledger Table -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; font-size: 9.5px;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff;">
              <th style="padding: 6px 4px; text-align: left;">Date</th>
              <th style="padding: 6px 4px; text-align: left;">Quality</th>
              <th style="padding: 6px 4px; text-align: right;">Kacha Gazana</th>
              <th style="padding: 6px 4px; text-align: right;">Safi Gazana</th>
              <th style="padding: 6px 4px; text-align: right;">GST Rate</th>
              <th style="padding: 6px 4px; text-align: right;">Rate W/Gst</th>
              <th style="padding: 6px 4px; text-align: right;">Total WO/Gst</th>
              <th style="padding: 6px 4px; text-align: right;">Total W/Gst</th>
              <th style="padding: 6px 4px; text-align: right; color: #86efac;">Advance</th>
              <th style="padding: 6px 4px; text-align: right; color: #fca5a5;">Remaining</th>
              <th style="padding: 6px 4px; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="11" style="text-align:center; padding: 12px;">No entries</td></tr>'}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-weight: 800; border-top: 1.5px solid #0f172a;">
              <td colspan="3" style="padding: 6px 4px;">Totals</td>
              <td style="padding: 6px 4px; text-align: right; color: #1e40af;">${(summary.totalSafiGazana || 0).toLocaleString()}</td>
              <td style="padding: 6px 4px; text-align: right;">—</td>
              <td style="padding: 6px 4px; text-align: right;">—</td>
              <td style="padding: 6px 4px; text-align: right; color: #0284c7;">${fmtCurrency(summary.totalAmountWithoutGst || 0)}</td>
              <td style="padding: 6px 4px; text-align: right; color: #7c3aed;">${fmtCurrency(summary.totalAmount || 0)}</td>
              <td style="padding: 6px 4px; text-align: right; color: #15803d;">${fmtCurrency(summary.totalAdvance || 0)}</td>
              <td style="padding: 6px 4px; text-align: right; color: ${summary.totalRemaining > 0 ? '#b91c1c' : '#15803d'};">${fmtCurrency(summary.totalRemaining || 0)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <!-- Footer -->
        <div style="margin-top: 18px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 9px; color: #94a3b8;">
          Statement for ${escapeHtml(res.partyName)} · ${new Date().toLocaleDateString()} · Generated by Textile Costing Application · Developed by HU-Software Solutions
        </div>
      </div>
    `;

    document.body.appendChild(container);
    const fileName = `Gazana_Statement_${res.partyName.replace(/\s+/g, '_')}.pdf`;
    const opt = {
      margin: [6, 6, 6, 6],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
      const targetElement = container.querySelector('#gazanaPdfRoot') || container.firstElementChild;
      const pdfWorker = html2pdf().set(opt).from(targetElement);
      const pdfBlob = await pdfWorker.output('blob');
      if (container.parentNode) document.body.removeChild(container);

      if (action === 'share') {
        const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          try {
            await navigator.share({
              files: [pdfFile],
              title: `Gazana Statement - ${res.partyName}`,
              text: `Party Gazana Statement for ${res.partyName}: Remaining Balance ${fmtCurrency(summary.totalRemaining || 0)}`,
            });
            toast('Shared Gazana PDF successfully!', 'success');
            return;
          } catch (shareErr) {
            if (shareErr.name === 'AbortError') return;
          }
        }
      }

      // Download fallback
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast('Downloaded Gazana PDF successfully!', 'success');
    } else {
      if (container.parentNode) document.body.removeChild(container);
      window.print();
    }
  } catch (err) {
    toast('PDF generation failed: ' + err.message, 'error');
  }
}

// ── 3-Dots Action Menu Controller (Floating Portal) ─────────
let activeGazanaMenuId = null;

function toggleGazanaActionMenu(event, entryId, partyName = '') {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const btn = event.currentTarget;
  const isSame = (activeGazanaMenuId === entryId);
  
  closeAllGazanaMenus();
  if (isSame) return;

  activeGazanaMenuId = entryId;
  btn.classList.add('active');

  const rect = btn.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'gazanaFloatingMenu';
  menu.className = 'gazana-floating-menu';
  menu.innerHTML = `
    ${partyName ? `
      <button class="gazana-menu-item" onclick="closeAllGazanaMenus(); openPartyReceiptModal('${escapeHtml(partyName)}')">
        <span class="menu-icon">🧾</span> Generate Receipt
      </button>
    ` : ''}
    <button class="gazana-menu-item" onclick="closeAllGazanaMenus(); openPaymentHistoryModal('${entryId}')">
      <span class="menu-icon">📋</span> View Payment Log
    </button>
    <button class="gazana-menu-item" onclick="closeAllGazanaMenus(); openEditPartyEntryModal('${entryId}')">
      <span class="menu-icon">✏️</span> Edit Entry
    </button>
    <button class="gazana-menu-item delete" onclick="closeAllGazanaMenus(); deletePartyEntry('${entryId}')">
      <span class="menu-icon">🗑️</span> Delete Entry
    </button>
  `;

  document.body.appendChild(menu);

  const menuWidth = 165;
  const menuHeight = partyName ? 145 : 115;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let top = rect.bottom + window.scrollY + 3;
  let left = rect.right + window.scrollX - menuWidth;

  // Horizontal boundary check for mobile screens
  if (left < 10) left = 10;
  if (left + menuWidth > viewportWidth - 10) {
    left = Math.max(10, viewportWidth - menuWidth - 10);
  }

  // Vertical boundary check: Flip upwards if too close to bottom
  if (rect.bottom + menuHeight > viewportHeight && rect.top > menuHeight) {
    top = rect.top + window.scrollY - menuHeight - 3;
  }

  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
}

function closeAllGazanaMenus() {
  activeGazanaMenuId = null;
  const existingMenu = $('gazanaFloatingMenu');
  if (existingMenu && existingMenu.parentNode) {
    existingMenu.parentNode.removeChild(existingMenu);
  }
  document.querySelectorAll('.gazana-menu-btn.active').forEach(el => el.classList.remove('active'));
}

// Global click handler to close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('#gazanaFloatingMenu') && !e.target.closest('.gazana-menu-btn')) {
    closeAllGazanaMenus();
  }
});
window.addEventListener('scroll', () => closeAllGazanaMenus(), { passive: true });
window.addEventListener('resize', () => closeAllGazanaMenus(), { passive: true });

// Window Globals for Party Gazana Entries
window.switchCostingSubtab = switchCostingSubtab;
window.setGazanaViewMode = setGazanaViewMode;
window.setPartyGazanaDetailFilter = setPartyGazanaDetailFilter;
window.renameParty = renameParty;
window.openPartyGazanaDetail = openPartyGazanaDetail;
window.openPartyGazanaForm = openPartyGazanaForm;
window.openEditPartyEntry = openEditPartyEntry;
window.openNewPartyEntryModal = openNewPartyEntryModal;
window.openEditPartyEntryModal = openEditPartyEntryModal;
window.updateGazanaFullFormCalculations = updateGazanaFullFormCalculations;
window.savePartyGazanaForm = savePartyGazanaForm;
window.openQuickPaymentModal = openQuickPaymentModal;
window.closePartyPaymentModal = closePartyPaymentModal;
window.submitPartyPayment = submitPartyPayment;
window.openPaymentHistoryModal = openPaymentHistoryModal;
window.closePaymentHistoryModal = closePaymentHistoryModal;
window.deleteInstallmentPayment = deleteInstallmentPayment;
window.markGazanaEntryCompleted = markGazanaEntryCompleted;
window.toggleGazanaActionMenu = toggleGazanaActionMenu;
window.closeAllGazanaMenus = closeAllGazanaMenus;
window.toggleEntryStatus = toggleEntryStatus;
window.deletePartyEntry = deletePartyEntry;
window.sharePartyGazanaPDF = sharePartyGazanaPDF;
window.openGeneralPaymentModal = openGeneralPaymentModal;
window.closeGeneralPaymentModal = closeGeneralPaymentModal;
window.submitGeneralPayment = submitGeneralPayment;

// ═══════════════════════════════════════════════════════════
//  PARTY DUE PAYMENT RECEIPT (No Decimals, No Rounding Off)
// ═══════════════════════════════════════════════════════════
let currentReceiptPartyName = '';
let currentReceiptTotal = 0;
let currentReceiptPendingEntries = [];

// Truncate decimal digits without rounding off (e.g. 1500.89 -> 1500, not 1501)
function truncNoRound(val) {
  if (val == null || isNaN(val)) return 0;
  return Math.trunc(Number(val));
}

function fmtReceiptAmount(val) {
  const truncated = truncNoRound(val);
  return truncated.toLocaleString('en-IN');
}

async function openPartyReceiptModal(partyName) {
  if (!partyName) return;
  currentReceiptPartyName = partyName;
  currentReceiptTotal = 0;
  currentReceiptPendingEntries = [];

  const modal = $('partyReceiptModal');
  const title = $('partyReceiptModalTitle');
  const container = $('partyReceiptPreviewContainer');
  if (title) title.textContent = `Receipt — ${partyName}`;
  if (container) {
    container.innerHTML = `
      <div style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem; animation: spin 1s linear infinite;">⏳</div>
        <div>Generating receipt for <strong>${escapeHtml(partyName)}</strong>...</div>
      </div>
    `;
  }
  if (modal) modal.classList.remove('hidden');

  try {
    let partyData = null;
    if (currentGazanaPartyName && currentGazanaPartyName.trim().toLowerCase() === partyName.trim().toLowerCase() && currentGazanaPartyData) {
      partyData = currentGazanaPartyData;
    } else {
      partyData = await apiGet(`${PARTY_ENTRIES_API}/party/${encodeURIComponent(partyName)}`);
    }

    if (!partyData) throw new Error('Failed to load party details');

    const allEntries = partyData.entries || [];
    // Only entries that have a remaining balance that the party has to pay
    const pendingEntries = allEntries.filter(e => (Number(e.remaining) || 0) > 0);
    currentReceiptPendingEntries = pendingEntries;

    // Calculate total by summing truncated individual amounts (skip decimals, no round off)
    let grandTotal = 0;
    pendingEntries.forEach(e => {
      grandTotal += truncNoRound(e.remaining);
    });

    currentReceiptTotal = grandTotal;
    const partyDisplayName = partyData.partyName || partyName;

    const rowsHtml = pendingEntries.length > 0 ? pendingEntries.map((e, idx) => {
      const truncatedRem = truncNoRound(e.remaining);
      const isEven = (idx % 2 === 1);
      return `
        <tr style="border-bottom: 1px solid #e2e8f0; ${isEven ? 'background: #f8fafc;' : 'background: #ffffff;'}">
          <td style="padding: 6px 6px; text-align: center; font-weight: 700; color: #64748b; font-size: 10.5px; width: 30px;">${idx + 1}</td>
          <td style="padding: 6px 10px; font-size: 11.5px; font-weight: 700; color: #0f172a;">
            ${escapeHtml(e.variety || '—')}
            ${e.contractNo ? `<div style="font-size: 9px; color: #2563eb; font-weight: 600;">#${escapeHtml(e.contractNo)}</div>` : ''}
            ${e.purchaser ? `<div style="font-size: 9px; color: #0369a1; font-weight: 600;">خریدار: ${escapeHtml(e.purchaser)}</div>` : ''}
            ${e.note ? `<div style="font-size: 9px; color: #64748b; font-weight: normal; margin-top: 1px;">📝 ${escapeHtml(e.note)}</div>` : ''}
          </td>
          <td style="padding: 6px 10px; text-align: right; font-weight: 800; font-size: 12px; color: #b91c1c; white-space: nowrap;">
            ₹ ${truncatedRem.toLocaleString('en-IN')}
          </td>
        </tr>
      `;
    }).join('') : `
      <tr>
        <td colspan="3" style="text-align: center; padding: 18px 10px; color: #15803d; font-weight: 700; font-size: 11.5px;">
          ✅ No outstanding balance! All entries are cleared.
        </td>
      </tr>
    `;

    if (container) {
      container.innerHTML = `
        <div id="partyReceiptPrintRoot" style="background: #ffffff; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; width: 440px; max-width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 6px; box-shadow: 0 1px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          
          <!-- Compact Party Name Header -->
          <div style="background: #f8fafc; border-left: 4px solid #0284c7; border: 1px solid #e2e8f0; border-left-width: 4px; border-radius: 4px; padding: 7px 10px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 15px; font-weight: 800; color: #0f172a;">
              ${escapeHtml(partyDisplayName)}
            </div>
            <span style="background: #e0f2fe; color: #0369a1; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 3px;">
              ${pendingEntries.length} ${pendingEntries.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          <!-- Compact Table: Quality and its Remaining Amount -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; font-size: 11px;">
            <thead>
              <tr style="background: #0f172a; color: #ffffff;">
                <th style="padding: 6px 6px; text-align: center; width: 30px;">#</th>
                <th style="padding: 6px 10px; text-align: left;">Quality (کوالٹی)</th>
                <th style="padding: 6px 10px; text-align: right; width: 140px; color: #fca5a5;">Remaining (بقایا رقم)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; font-weight: 800; border-top: 1.5px solid #0f172a;">
                <td colspan="2" style="padding: 8px 10px; text-align: right; color: #0f172a; font-size: 11.5px;">
                  TOTAL (کل رقم):
                </td>
                <td style="padding: 8px 10px; text-align: right; color: #b91c1c; font-size: 13.5px; font-weight: 900;">
                  ₹ ${grandTotal.toLocaleString('en-IN')}
                </td>
              </tr>
            </tfoot>
          </table>

        </div>
      `;
    }
  } catch (err) {
    if (container) {
      container.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #b91c1c;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
          <div>Failed to generate receipt: ${escapeHtml(err.message)}</div>
        </div>
      `;
    }
    toast('Failed to generate receipt: ' + err.message, 'error');
  }
}

function closePartyReceiptModal() {
  const modal = $('partyReceiptModal');
  if (modal) modal.classList.add('hidden');
}

// Close receipt modal on backdrop click
if ($('partyReceiptModal')) {
  $('partyReceiptModal').addEventListener('click', (e) => {
    if (e.target === $('partyReceiptModal')) closePartyReceiptModal();
  });
}

// Close receipt modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('partyReceiptModal') && !$('partyReceiptModal').classList.contains('hidden')) {
    closePartyReceiptModal();
  }
});

async function sharePartyReceiptPDF(action = 'download') {
  if (!currentReceiptPartyName) return;
  try {
    toast(action === 'share' ? 'Preparing Receipt to share...' : 'Downloading Receipt PDF...', 'info');

    let partyData = null;
    if (currentGazanaPartyName && currentGazanaPartyName.trim().toLowerCase() === currentReceiptPartyName.trim().toLowerCase() && currentGazanaPartyData) {
      partyData = currentGazanaPartyData;
    } else {
      partyData = await apiGet(`${PARTY_ENTRIES_API}/party/${encodeURIComponent(currentReceiptPartyName)}`);
    }

    if (!partyData) throw new Error('Party details not found');

    const allEntries = partyData.entries || [];
    const pendingEntries = allEntries.filter(e => (Number(e.remaining) || 0) > 0);
    const partyDisplayName = partyData.partyName || currentReceiptPartyName;

    let grandTotal = 0;
    pendingEntries.forEach(e => {
      grandTotal += truncNoRound(e.remaining);
    });

    const rowsHtml = pendingEntries.length > 0 ? pendingEntries.map((e, idx) => {
      const truncatedRem = truncNoRound(e.remaining);
      const isEven = (idx % 2 === 1);
      return `
        <tr style="border-bottom: 1px solid #cbd5e1; ${isEven ? 'background-color: #f8fafc;' : 'background-color: #ffffff;'}">
          <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: #475569; font-size: 11px; width: 32px;">${idx + 1}</td>
          <td style="padding: 6px 12px; font-size: 12px; font-weight: 700; color: #0f172a;">
            ${escapeHtml(e.variety || '—')}
          </td>
          <td style="padding: 6px 12px; text-align: right; font-weight: 800; font-size: 12.5px; color: #b91c1c; white-space: nowrap;">
            ₹ ${truncatedRem.toLocaleString('en-IN')}
          </td>
        </tr>
      `;
    }).join('') : `
      <tr>
        <td colspan="3" style="text-align: center; padding: 20px 10px; color: #15803d; font-weight: 700; font-size: 12px;">
          ✅ No outstanding balance! All entries are cleared.
        </td>
      </tr>
    `;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '0px';
    container.style.top = '0px';
    container.style.zIndex = '-99999';
    container.style.opacity = '1';
    container.style.pointerEvents = 'none';

    container.innerHTML = `
      <div id="receiptPdfRoot" style="background: #ffffff; color: #0f172a; font-family: Arial, Helvetica, sans-serif; width: 480px; max-width: 480px; box-sizing: border-box; padding: 16px; border: 1px solid #cbd5e1; border-radius: 6px;">
        
        <!-- Compact Party Name Header -->
        <div style="background-color: #f1f5f9; border-left: 5px solid #0284c7; border: 1px solid #cbd5e1; border-left-width: 5px; border-radius: 4px; padding: 8px 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 16px; font-weight: 800; color: #0f172a;">
            ${escapeHtml(partyDisplayName)}
          </div>
          <span style="background-color: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 3px;">
            ${pendingEntries.length} ${pendingEntries.length === 1 ? 'Item' : 'Items'}
          </span>
        </div>

        <!-- Table -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 11.5px;">
          <thead>
            <tr style="background-color: #0f172a; color: #ffffff;">
              <th style="padding: 7px 8px; text-align: center; width: 32px; color: #ffffff;">#</th>
              <th style="padding: 7px 12px; text-align: left; color: #ffffff;">Quality (کوالٹی)</th>
              <th style="padding: 7px 12px; text-align: right; width: 150px; color: #fca5a5;">Remaining (بقایا رقم)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background-color: #f8fafc; font-weight: 800; border-top: 2px solid #0f172a;">
              <td colspan="2" style="padding: 9px 12px; text-align: right; color: #0f172a; font-size: 12px;">
                TOTAL (کل رقم):
              </td>
              <td style="padding: 9px 12px; text-align: right; color: #b91c1c; font-size: 14.5px; font-weight: 900;">
                ₹ ${grandTotal.toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>
        <!-- Footer -->
        <div style="margin-top: 12px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 4px; font-size: 9px; color: #94a3b8;">
          Generated by Textile Costing Application · Developed by HU-Software Solutions
        </div>
      </div>
    `;

    document.body.appendChild(container);

    const cleanParty = currentReceiptPartyName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'Party';
    const fileName = `Receipt_${cleanParty}.pdf`;

    const opt = {
      margin: [6, 6, 6, 6],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
      const targetElement = container.querySelector('#receiptPdfRoot') || container.firstElementChild;
      const pdfWorker = html2pdf().set(opt).from(targetElement);
      const pdfBlob = await pdfWorker.output('blob');

      if (container.parentNode) document.body.removeChild(container);

      if (action === 'share') {
        const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          try {
            await navigator.share({
              files: [pdfFile],
              title: `Receipt - ${currentReceiptPartyName}`,
              text: `Payment Due Receipt for ${currentReceiptPartyName}: Total Due ₹ ${grandTotal.toLocaleString('en-IN')}`,
            });
            toast('Shared Receipt PDF successfully! ✅', 'success');
            return;
          } catch (shareErr) {
            if (shareErr.name === 'AbortError') return;
          }
        }
      }

      // Download PDF
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast('Downloaded Receipt PDF successfully! ✅', 'success');
    } else {
      if (container.parentNode) document.body.removeChild(container);
      printPartyReceipt();
    }
  } catch (err) {
    toast('Receipt PDF generation failed: ' + err.message, 'error');
  }
}

function printPartyReceipt() {
  const target = document.getElementById('partyReceiptPrintRoot');
  if (!target) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${currentReceiptPartyName}</title>
        <style>
          @page { margin: 8mm; size: A4 portrait; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 12px; color: #0f172a; }
          * { box-sizing: border-box; }
        </style>
      </head>
      <body>
        ${target.outerHTML}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        <\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function sendReceiptWhatsApp() {
  if (!currentReceiptPartyName) return;
  let msg = `*📋 DADI OFFICE — PAYMENT DUE RECEIPT*\n`;
  msg += `*Party:* ${currentReceiptPartyName}\n\n`;
  msg += `*Pending Items (کوالٹی اور بقایا رقم):*\n`;

  if (currentReceiptPendingEntries.length > 0) {
    currentReceiptPendingEntries.forEach((e, idx) => {
      const rem = truncNoRound(e.remaining);
      const quality = e.variety || 'Quality';
      msg += `${idx + 1}. *${quality}*: ₹ ${rem.toLocaleString('en-IN')}\n`;
    });
  } else {
    msg += `No pending balance. All cleared.\n`;
  }

  msg += `\n*TOTAL: ₹ ${currentReceiptTotal.toLocaleString('en-IN')}*`;

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
}

// Bind Receipt Toolbar Button Listeners
if ($('btnReceiptSharePDF')) {
  $('btnReceiptSharePDF').addEventListener('click', () => sharePartyReceiptPDF('share'));
}
if ($('btnReceiptDownloadPDF')) {
  $('btnReceiptDownloadPDF').addEventListener('click', () => sharePartyReceiptPDF('download'));
}
if ($('btnReceiptPrint')) {
  $('btnReceiptPrint').addEventListener('click', () => printPartyReceipt());
}
if ($('btnReceiptWhatsApp')) {
  $('btnReceiptWhatsApp').addEventListener('click', () => sendReceiptWhatsApp());
}

window.openPartyReceiptModal = openPartyReceiptModal;
window.closePartyReceiptModal = closePartyReceiptModal;
window.sharePartyReceiptPDF = sharePartyReceiptPDF;
window.printPartyReceipt = printPartyReceipt;
window.sendReceiptWhatsApp = sendReceiptWhatsApp;

// ── Generic API PATCH helper ──────────────────────────────
async function apiPatch(url, data) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || err.message || 'Request failed');
  }
  return res.json();
}

// ── Generic API PUT helper ────────────────────────────────
async function apiPut(url, data) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || err.message || 'Request failed');
  }
  return res.json();
}

// ── Payment Record Edit & Delete Controller ───────────────
function handleEditPaymentItem(idx) {
  const p = currentGazanaAllPayments[idx];
  if (!p) return;

  $('editPaymentRecordType').value = p.type;
  $('editPaymentRecordId').value = p._id || p.paymentId || '';
  $('editPaymentRecordEntryId').value = p.entryId || '';

  // Format date for date input (YYYY-MM-DD)
  const dt = new Date(p.date || Date.now());
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  $('editPaymentRecordDate').value = `${yyyy}-${mm}-${dd}`;

  $('editPaymentRecordAmount').value = p.amount || 0;
  $('editPaymentRecordNote').value = p.note || '';

  let summaryText = '';
  if (p.type === 'general') {
    $('editPaymentRecordModalTitle').textContent = '✏️ Edit General Payment (عمومی رقم)';
    summaryText = `General payment for <strong>${escapeHtml(currentGazanaPartyName)}</strong>. Updating amount will automatically recalculate balances across active orders.`;
  } else if (p.type === 'advance') {
    $('editPaymentRecordModalTitle').textContent = '✏️ Edit Booking Advance';
    summaryText = `Booking advance for order <strong>${escapeHtml(p.entryVariety || 'Entry')}</strong>.`;
  } else {
    $('editPaymentRecordModalTitle').textContent = '✏️ Edit Payment Record (قسط / ادائیگی)';
    summaryText = `Payment record for order <strong>${escapeHtml(p.entryVariety || 'Entry')}</strong>.`;
  }

  $('editPaymentRecordModalSummary').innerHTML = summaryText;
  $('editPaymentRecordModal').classList.remove('hidden');
}

function closeEditPaymentRecordModal() {
  if ($('editPaymentRecordModal')) {
    $('editPaymentRecordModal').classList.add('hidden');
  }
}

async function submitEditPaymentRecord() {
  try {
    const type = $('editPaymentRecordType').value;
    const id = $('editPaymentRecordId').value;
    const entryId = $('editPaymentRecordEntryId').value;
    const date = $('editPaymentRecordDate').value;
    const amount = parseFloat($('editPaymentRecordAmount').value);
    const note = $('editPaymentRecordNote').value;

    if (!amount || amount <= 0) {
      toast('Please enter a valid payment amount', 'error');
      return;
    }

    if (type === 'general') {
      await apiPut(`${PARTY_ENTRIES_API}/general-payment/${id}`, { amount, date, note });
      toast('General payment updated successfully!', 'success');
    } else if (type === 'advance') {
      await apiPatch(`${PARTY_ENTRIES_API}/${entryId}`, { advance: amount });
      toast('Booking advance updated successfully!', 'success');
    } else {
      // installment or completed with paymentId
      if (id && entryId) {
        await apiPut(`${PARTY_ENTRIES_API}/${entryId}/payment/${id}`, { amount, date, note });
        toast('Payment record updated successfully!', 'success');
      } else if (entryId) {
        // legacy entry
        await apiPatch(`${PARTY_ENTRIES_API}/${entryId}`, { note });
        toast('Payment note updated successfully!', 'success');
      }
    }

    closeEditPaymentRecordModal();
    if (currentGazanaPartyName) {
      openPartyGazanaDetail(currentGazanaPartyName, false);
    }
  } catch (err) {
    toast('Failed to update payment: ' + err.message, 'error');
  }
}

async function handleDeletePaymentItem(idx) {
  const p = currentGazanaAllPayments[idx];
  if (!p) return;

  if (p.type === 'general') {
    showConfirm(
      'Delete General Payment',
      `Are you sure you want to delete this General Payment of ${fmtCurrency(p.amount)} (${p.note || 'no note'})? This will restore the balance on all affected entries.`,
      async () => {
        try {
          await apiDelete(`${PARTY_ENTRIES_API}/general-payment/${p._id}`);
          toast('General payment deleted successfully!', 'success');
          if (currentGazanaPartyName) {
            openPartyGazanaDetail(currentGazanaPartyName, false);
          }
        } catch (err) {
          toast('Failed to delete general payment: ' + err.message, 'error');
        }
      }
    );
  } else if (p.type === 'advance') {
    showConfirm(
      'Remove Booking Advance',
      `Are you sure you want to remove the booking advance of ${fmtCurrency(p.amount)} for ${p.entryVariety || 'this entry'}? This will increase the remaining balance by ${fmtCurrency(p.amount)}.`,
      async () => {
        try {
          await apiPatch(`${PARTY_ENTRIES_API}/${p.entryId}`, { advance: 0 });
          toast('Booking advance removed!', 'success');
          if (currentGazanaPartyName) {
            openPartyGazanaDetail(currentGazanaPartyName, false);
          }
        } catch (err) {
          toast('Failed to remove advance: ' + err.message, 'error');
        }
      }
    );
  } else if (p.paymentId && p.entryId) {
    showConfirm(
      'Delete Payment Record',
      `Are you sure you want to delete this payment of ${fmtCurrency(p.amount)}? This will restore the balance on order ${p.entryVariety || ''}.`,
      async () => {
        try {
          await apiDelete(`${PARTY_ENTRIES_API}/${p.entryId}/payment/${p.paymentId}`);
          toast('Payment record deleted!', 'success');
          if (currentGazanaPartyName) {
            openPartyGazanaDetail(currentGazanaPartyName, false);
          }
        } catch (err) {
          toast('Failed to delete payment: ' + err.message, 'error');
        }
      }
    );
  } else if (p.entryId) {
    // Legacy completed entry
    showConfirm(
      'Reopen Order',
      `This order was marked as completed with full settlement. Do you want to reopen it as active?`,
      async () => {
        try {
          await toggleEntryStatus(p.entryId, 'completed');
          toast('Order reopened as active!', 'success');
          if (currentGazanaPartyName) {
            openPartyGazanaDetail(currentGazanaPartyName, false);
          }
        } catch (err) {
          toast('Failed to update status: ' + err.message, 'error');
        }
      }
    );
  }
}

window.handleEditPaymentItem = handleEditPaymentItem;
window.closeEditPaymentRecordModal = closeEditPaymentRecordModal;
window.submitEditPaymentRecord = submitEditPaymentRecord;
window.handleDeletePaymentItem = handleDeletePaymentItem;
window.apiPut = apiPut;

// ═══════════════════════════════════════════════════════════
//  TEMP INVOICE TAB (LIVE EDITABLE SHEET & PDF EXPORT)
// ═══════════════════════════════════════════════════════════

function getTodayDateFormatted() {
  const d = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

const DEFAULT_TEMP_INVOICE_DATA = {
  compName: "MUTAHIR TEXTILES",
  compAddress: "P16, AL-HAMAD INDUSTRIAL ESTATE,<br>CHAK NO. 8/JB, DAEWOO ROAD, FAISALABAD",
  compTax: "NTN. A0973067. STRN. 32-77-8762-286-30",
  buyerName: "Mian Muzamil Shb",
  buyerLine2: "",
  sellerName: "",
  sellerLine2: "",
  invDate: getTodayDateFormatted(),
  kpDate: getTodayDateFormatted(),
  ppDate: getTodayDateFormatted(),
  invNo: "",
  gstHeader: "GST # 18%",
  items: [
    {
      qty: 12608,
      unit: "Mtrs",
      desc: '76x62/32x32 101" S/L',
      subDesc: "100% CTN FABRIC",
      rate: 293.00,
      exVal: 3694144.00,
      gstVal: 664945.92,
      inclVal: 4359089.92
    },
    {
      qty: 5842,
      unit: "Mtrs",
      desc: '76x66/30x32 104" S/L',
      subDesc: "100% CTN FABRIC",
      rate: 314.00,
      exVal: 1834388.00,
      gstVal: 330189.84,
      inclVal: 2164577.84
    }
  ]
};

let currentTempInvoice = null;

function parseNumericVal(str) {
  if (str === '' || str == null) return null;
  if (typeof str === 'number') return isNaN(str) ? null : str;
  const cleaned = String(str).replace(/,/g, '').replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function formatTiCurrency(val) {
  if (val === '' || val == null) return '';
  const num = typeof val === 'number' ? val : parseNumericVal(val);
  if (num == null) return '';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getGstPercentage() {
  const gstHeaderEl = $('tiGstHeader');
  const txt = gstHeaderEl ? gstHeaderEl.innerText : '18%';
  const match = txt.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : 18;
}

function updateAutoSaveIndicator(status = 'saved') {
  const badge = $('tiAutoSaveBadge');
  if (!badge) return;
  if (status === 'saving') {
    badge.innerText = '💾 Saving...';
    badge.style.color = '#d97706';
    badge.style.background = '#fef3c7';
    badge.style.borderColor = '#fde68a';
  } else {
    badge.innerText = '✓ Auto-Saved';
    badge.style.color = '#15803d';
    badge.style.background = '#dcfce7';
    badge.style.borderColor = '#bbf7d0';
  }
}

function initTempInvoice(forceDefault = false) {
  if (forceDefault) {
    currentTempInvoice = JSON.parse(JSON.stringify(DEFAULT_TEMP_INVOICE_DATA));
  } else {
    const saved = localStorage.getItem('temp_invoice_draft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        currentTempInvoice = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_TEMP_INVOICE_DATA)), parsed);
        if (parsed.buyerName === 'Yarana Textile Mills') {
          currentTempInvoice.buyerName = 'Mian Muzamil Shb';
        }
      } catch (e) {
        currentTempInvoice = JSON.parse(JSON.stringify(DEFAULT_TEMP_INVOICE_DATA));
      }
    } else {
      currentTempInvoice = JSON.parse(JSON.stringify(DEFAULT_TEMP_INVOICE_DATA));
    }
  }

  // Restore or hide blocks
  ['tiLogoWrap', 'tiCompAddress', 'tiCompTax', 'tiKpDateRow', 'tiPpDateRow'].forEach(id => {
    const el = $(id);
    if (el) {
      const isHidden = (currentTempInvoice.hiddenBlocks && currentTempInvoice.hiddenBlocks.includes(id));
      el.style.display = isHidden ? 'none' : '';
    }
  });

  // Populate Header Fields
  if ($('tiCompName')) $('tiCompName').innerHTML = currentTempInvoice.compName != null ? currentTempInvoice.compName : '';
  if ($('tiCompAddress')) $('tiCompAddress').innerHTML = currentTempInvoice.compAddress != null ? currentTempInvoice.compAddress : '';
  if ($('tiCompTax')) $('tiCompTax').innerHTML = currentTempInvoice.compTax != null ? currentTempInvoice.compTax : '';
  if ($('tiBuyerName')) $('tiBuyerName').innerHTML = currentTempInvoice.buyerName != null ? currentTempInvoice.buyerName : '';
  if ($('tiBuyerLine2')) $('tiBuyerLine2').innerHTML = currentTempInvoice.buyerLine2 != null ? currentTempInvoice.buyerLine2 : '';
  if ($('tiSellerName')) $('tiSellerName').innerHTML = currentTempInvoice.sellerName != null ? currentTempInvoice.sellerName : '';
  if ($('tiSellerLine2')) $('tiSellerLine2').innerHTML = currentTempInvoice.sellerLine2 != null ? currentTempInvoice.sellerLine2 : '';
  if ($('tiInvDate')) $('tiInvDate').innerHTML = currentTempInvoice.invDate || getTodayDateFormatted();
  if ($('tiKpDate')) $('tiKpDate').innerHTML = currentTempInvoice.kpDate || getTodayDateFormatted();
  if ($('tiPpDate')) $('tiPpDate').innerHTML = currentTempInvoice.ppDate || getTodayDateFormatted();
  if ($('tiInvNo')) $('tiInvNo').innerHTML = currentTempInvoice.invNo || '';
  if ($('tiGstHeader')) $('tiGstHeader').innerHTML = currentTempInvoice.gstHeader || 'GST # 18%';

  bindTempInvoiceHeaderEvents();
  renderTempInvoiceItems(false);
  updateAutoSaveIndicator('saved');
}

let tiHeaderEventsBound = false;
function bindTempInvoiceHeaderEvents() {
  if (tiHeaderEventsBound) return;
  tiHeaderEventsBound = true;

  const headerFieldIds = [
    'tiCompName',
    'tiCompAddress',
    'tiCompTax',
    'tiBuyerName',
    'tiBuyerLine2',
    'tiSellerName',
    'tiSellerLine2',
    'tiInvDate',
    'tiKpDate',
    'tiPpDate',
    'tiInvNo',
    'tiGstHeader'
  ];

  headerFieldIds.forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener('input', () => {
        updateAutoSaveIndicator('saving');
        clearTimeout(el._saveTimer);
        el._saveTimer = setTimeout(() => {
          saveTempInvoiceDraft(true);
        }, 300);
      });
      el.addEventListener('blur', () => {
        saveTempInvoiceDraft(true);
      });
    }
  });
}

function renderTempInvoiceItems(shouldAutoSave = true) {
  const tbody = $('tiTableBody');
  if (!tbody || !currentTempInvoice) return;

  tbody.innerHTML = '';
  const items = currentTempInvoice.items || [];
  const gstPct = getGstPercentage();

  let totalEx = 0;
  let totalGst = 0;
  let totalIncl = 0;
  let hasNumericValues = false;

  items.forEach((item, idx) => {
    let exVal = item.exVal !== undefined && item.exVal !== null && item.exVal !== '' ? item.exVal : '';
    let gstVal = item.gstVal !== undefined && item.gstVal !== null && item.gstVal !== '' ? item.gstVal : '';
    let inclVal = item.inclVal !== undefined && item.inclVal !== null && item.inclVal !== '' ? item.inclVal : '';

    const qNum = parseNumericVal(item.qty);
    const rNum = parseNumericVal(item.rate);

    // Auto-calculate if qty & rate are present and exVal wasn't explicitly blanked
    if (qNum != null && rNum != null && exVal === '') {
      exVal = Math.round((qNum * rNum) * 100) / 100;
      gstVal = Math.round((exVal * (gstPct / 100)) * 100) / 100;
      inclVal = Math.round((exVal + gstVal) * 100) / 100;
      item.exVal = exVal;
      item.gstVal = gstVal;
      item.inclVal = inclVal;
    }

    const exNum = parseNumericVal(exVal);
    const gstNum = parseNumericVal(gstVal);
    const inclNum = parseNumericVal(inclVal);

    if (exNum != null) { totalEx += exNum; hasNumericValues = true; }
    if (gstNum != null) { totalGst += gstNum; hasNumericValues = true; }
    if (inclNum != null) { totalIncl += inclNum; hasNumericValues = true; }

    // Line 1: Main data row (6 cells only)
    const tr1 = document.createElement('tr');
    tr1.className = 'ti-item-line1';
    tr1.innerHTML = `
      <td class="ti-cell-center">
        <span contenteditable="true" class="ti-editable" data-idx="${idx}" data-field="qty">${item.qty != null ? item.qty : ''}</span>
      </td>
      <td class="ti-cell-center" style="font-weight: 700;">
        <span contenteditable="true" class="ti-editable" data-idx="${idx}" data-field="desc">${escapeHtml(item.desc || '')}</span>
      </td>
      <td class="ti-cell-center">
        <span contenteditable="true" class="ti-editable" data-idx="${idx}" data-field="rate">${item.rate !== '' && item.rate != null ? formatTiCurrency(item.rate) : ''}</span>
      </td>
      <td class="ti-cell-right">
        <span contenteditable="true" class="ti-editable" data-idx="${idx}" data-field="exVal">${formatTiCurrency(exVal)}</span>
      </td>
      <td class="ti-cell-right">
        <span contenteditable="true" class="ti-editable" data-idx="${idx}" data-field="gstVal">${formatTiCurrency(gstVal)}</span>
      </td>
      <td class="ti-cell-right">
        <span contenteditable="true" class="ti-editable" data-idx="${idx}" data-field="inclVal">${formatTiCurrency(inclVal)}</span>
      </td>
      <button type="button" class="ti-row-del-btn" title="Delete Row" onclick="deleteTempInvoiceItem(${idx})">🗑️</button>
    `;

    // Line 2: Sub-description row (6 cells only)
    const tr2 = document.createElement('tr');
    tr2.className = 'ti-item-line2';
    tr2.innerHTML = `
      <td class="ti-cell-center" style="font-weight: 600;">
        <span contenteditable="true" class="ti-editable" data-idx="${idx}" data-field="unit">${escapeHtml(item.unit || '')}</span>
      </td>
      <td class="ti-cell-center" style="font-weight: 600;">
        <span contenteditable="true" class="ti-editable" data-idx="${idx}" data-field="subDesc">${escapeHtml(item.subDesc || '')}</span>
      </td>
      <td class="ti-cell-right"></td>
      <td class="ti-cell-right"></td>
      <td class="ti-cell-right"></td>
      <td class="ti-cell-right"></td>
    `;

    tbody.appendChild(tr1);
    tbody.appendChild(tr2);
  });

  // Render blank grid lines so invoice paper has the exact full-sheet look as shown in photo
  const renderedLines = items.length * 2;
  const targetLines = Math.max(16, renderedLines + 6);
  const blankCount = Math.max(2, targetLines - renderedLines);

  for (let b = 0; b < blankCount; b++) {
    const blankTr = document.createElement('tr');
    blankTr.className = 'ti-blank-row';
    blankTr.innerHTML = `
      <td></td><td></td><td></td><td></td><td></td><td></td>
    `;
    tbody.appendChild(blankTr);
  }

  // Update Total Row
  if ($('tiTotalExVal')) $('tiTotalExVal').innerText = hasNumericValues ? formatTiCurrency(totalEx) : '';
  if ($('tiTotalGstVal')) $('tiTotalGstVal').innerText = hasNumericValues ? formatTiCurrency(totalGst) : '';
  if ($('tiTotalInclVal')) $('tiTotalInclVal').innerText = hasNumericValues ? formatTiCurrency(totalIncl) : '';

  bindTempInvoiceCellEvents();
  if (shouldAutoSave) {
    saveTempInvoiceDraft(true);
  }
}

function bindTempInvoiceCellEvents() {
  const tbody = $('tiTableBody');
  if (!tbody) return;

  const editableCells = tbody.querySelectorAll('.ti-editable');
  editableCells.forEach(cell => {
    cell.addEventListener('input', () => {
      updateAutoSaveIndicator('saving');
      const idx = parseInt(cell.dataset.idx, 10);
      const field = cell.dataset.field;
      if (isNaN(idx) || !currentTempInvoice.items[idx]) return;
      const rawVal = cell.innerText.trim();
      currentTempInvoice.items[idx][field] = rawVal;
      clearTimeout(cell._saveTimer);
      cell._saveTimer = setTimeout(() => {
        saveTempInvoiceDraft(true);
      }, 400);
    });

    cell.addEventListener('blur', () => {
      const idx = parseInt(cell.dataset.idx, 10);
      const field = cell.dataset.field;
      if (isNaN(idx) || !currentTempInvoice.items[idx]) return;

      const rawVal = cell.innerText.trim();
      const item = currentTempInvoice.items[idx];

      if (field === 'qty') {
        item.qty = rawVal === '' ? '' : (isNaN(Number(rawVal.replace(/,/g, ''))) ? rawVal : parseNumericVal(rawVal));
        if (item.qty === '') {
          item.exVal = '';
          item.gstVal = '';
          item.inclVal = '';
        } else {
          recalcTempInvoiceItem(item);
        }
      } else if (field === 'rate') {
        item.rate = rawVal === '' ? '' : parseNumericVal(rawVal);
        if (item.rate === '') {
          item.exVal = '';
          item.gstVal = '';
          item.inclVal = '';
        } else {
          recalcTempInvoiceItem(item);
        }
      } else if (field === 'exVal') {
        item.exVal = rawVal === '' ? '' : parseNumericVal(rawVal);
        if (item.exVal !== '' && item.exVal != null) {
          const gstPct = getGstPercentage();
          item.gstVal = Math.round((item.exVal * (gstPct / 100)) * 100) / 100;
          item.inclVal = Math.round((item.exVal + item.gstVal) * 100) / 100;
        } else {
          item.gstVal = '';
          item.inclVal = '';
        }
      } else if (field === 'gstVal') {
        item.gstVal = rawVal === '' ? '' : parseNumericVal(rawVal);
        if (item.gstVal !== '' && item.gstVal != null) {
          const ex = parseNumericVal(item.exVal) || 0;
          item.inclVal = Math.round((ex + item.gstVal) * 100) / 100;
        }
      } else if (field === 'inclVal') {
        item.inclVal = rawVal === '' ? '' : parseNumericVal(rawVal);
      } else if (field === 'desc') {
        item.desc = rawVal;
      } else if (field === 'subDesc') {
        item.subDesc = rawVal;
      } else if (field === 'unit') {
        item.unit = rawVal;
      }

      renderTempInvoiceItems(true);
    });
  });
}

function recalcTempInvoiceItem(item) {
  const q = parseNumericVal(item.qty);
  const r = parseNumericVal(item.rate);
  if (q != null && r != null) {
    const ex = Math.round((q * r) * 100) / 100;
    const gstPct = getGstPercentage();
    const gst = Math.round((ex * (gstPct / 100)) * 100) / 100;
    const incl = Math.round((ex + gst) * 100) / 100;

    item.exVal = ex;
    item.gstVal = gst;
    item.inclVal = incl;
  }
}

function addTempInvoiceItem() {
  if (!currentTempInvoice) initTempInvoice();
  currentTempInvoice.items.push({
    qty: '',
    unit: 'Mtrs',
    desc: 'Description / Fabric Quality',
    subDesc: '100% CTN FABRIC',
    rate: '',
    exVal: '',
    gstVal: '',
    inclVal: ''
  });
  renderTempInvoiceItems(true);
  toast('Added new item row to invoice', 'info');
}

function deleteTempInvoiceItem(idx) {
  if (!currentTempInvoice || !currentTempInvoice.items) return;
  if (currentTempInvoice.items.length <= 1) {
    currentTempInvoice.items = [{
      qty: '',
      unit: '',
      desc: '',
      subDesc: '',
      rate: '',
      exVal: '',
      gstVal: '',
      inclVal: ''
    }];
  } else {
    currentTempInvoice.items.splice(idx, 1);
  }
  renderTempInvoiceItems(true);
  toast('Item row deleted', 'info');
}

function clearTempInvoiceValues() {
  if (!currentTempInvoice || !currentTempInvoice.items) return;
  currentTempInvoice.items.forEach(item => {
    item.qty = '';
    item.rate = '';
    item.exVal = '';
    item.gstVal = '';
    item.inclVal = '';
  });
  renderTempInvoiceItems(true);
  toast('All table values cleared! You can now enter fresh numbers.', 'info');
}

function removeTempInvoiceBlock(elementId) {
  const el = $(elementId);
  if (!el) return;
  el.style.display = 'none';
  saveTempInvoiceDraft(true);
  toast('Block removed from invoice. Click Reset anytime to restore.', 'info');
}

function collectTempInvoiceHeaderData() {
  if (!currentTempInvoice) currentTempInvoice = JSON.parse(JSON.stringify(DEFAULT_TEMP_INVOICE_DATA));
  if ($('tiCompName')) currentTempInvoice.compName = $('tiCompName').innerHTML;
  if ($('tiCompAddress')) currentTempInvoice.compAddress = $('tiCompAddress').innerHTML;
  if ($('tiCompTax')) currentTempInvoice.compTax = $('tiCompTax').innerHTML;
  if ($('tiBuyerName')) currentTempInvoice.buyerName = $('tiBuyerName').innerHTML;
  if ($('tiBuyerLine2')) currentTempInvoice.buyerLine2 = $('tiBuyerLine2').innerHTML;
  if ($('tiSellerName')) currentTempInvoice.sellerName = $('tiSellerName').innerHTML;
  if ($('tiSellerLine2')) currentTempInvoice.sellerLine2 = $('tiSellerLine2').innerHTML;
  if ($('tiInvDate')) currentTempInvoice.invDate = $('tiInvDate').innerHTML;
  if ($('tiKpDate')) currentTempInvoice.kpDate = $('tiKpDate').innerHTML;
  if ($('tiPpDate')) currentTempInvoice.ppDate = $('tiPpDate').innerHTML;
  if ($('tiInvNo')) currentTempInvoice.invNo = $('tiInvNo').innerHTML;
  if ($('tiGstHeader')) currentTempInvoice.gstHeader = $('tiGstHeader').innerHTML;

  currentTempInvoice.hiddenBlocks = [];
  ['tiLogoWrap', 'tiCompAddress', 'tiCompTax', 'tiKpDateRow', 'tiPpDateRow'].forEach(id => {
    const el = $(id);
    if (el && el.style.display === 'none') {
      currentTempInvoice.hiddenBlocks.push(id);
    }
  });
}

function saveTempInvoiceDraft(silent = false) {
  collectTempInvoiceHeaderData();
  try {
    localStorage.setItem('temp_invoice_draft', JSON.stringify(currentTempInvoice));
    updateAutoSaveIndicator('saved');
    if (!silent) {
      toast('Temp Invoice draft saved successfully!', 'success');
    }
  } catch (e) {
    console.error('Failed to auto-save temp invoice:', e);
  }
}

async function downloadTempInvoicePdf() {
  try {
    toast('Generating Sale Invoice PDF...', 'info');
    collectTempInvoiceHeaderData();

    const paperEl = $('tempInvoicePaper');
    if (!paperEl) return;

    // Clone element to sanitize for print
    const clone = paperEl.cloneNode(true);
    clone.style.boxShadow = 'none';
    clone.style.width = '700px';
    clone.style.maxWidth = '700px';
    clone.style.minWidth = '0';
    clone.style.margin = '0 auto';
    clone.style.padding = '18px 22px';
    clone.style.background = '#ffffff';
    clone.style.boxSizing = 'border-box';

    // Remove buttons, handles, and editable hints
    clone.querySelectorAll('.ti-row-del-btn, .ti-remove-block-btn, .ti-remove-line-btn, .ti-remove-date-btn').forEach(el => el.remove());
    clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));

    const container = document.createElement('div');
    container.style.cssText = 'position: fixed; left: -9999px; top: 0px; width: 700px; z-index: -99999; pointer-events: none;';
    container.appendChild(clone);
    document.body.appendChild(container);

    const invNum = ($('tiInvNo') ? $('tiInvNo').innerText.trim() : '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const buyerStr = ($('tiBuyerName') ? $('tiBuyerName').innerText.trim() : 'Buyer').replace(/\s+/g, '_');
    const fileName = invNum ? `Sale_Invoice_${invNum}_${buyerStr}.pdf` : `Sale_Invoice_${buyerStr}.pdf`;

    const opt = {
      margin: [6, 6, 6, 6],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
      const pdfWorker = html2pdf().set(opt).from(clone);
      const pdfBlob = await pdfWorker.output('blob');
      if (container.parentNode) document.body.removeChild(container);

      const downloadUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast('Downloaded Sale Invoice PDF successfully!', 'success');
    } else {
      if (container.parentNode) document.body.removeChild(container);
      window.print();
    }
  } catch (err) {
    console.error('PDF error:', err);
    toast('Failed to generate PDF: ' + err.message, 'error');
  }
}

// Window Globals for Temp Invoice
window.deleteTempInvoiceItem = deleteTempInvoiceItem;
window.addTempInvoiceItem = addTempInvoiceItem;
window.clearTempInvoiceValues = clearTempInvoiceValues;
window.removeTempInvoiceBlock = removeTempInvoiceBlock;
window.initTempInvoice = initTempInvoice;
window.saveTempInvoiceDraft = saveTempInvoiceDraft;

// Auto-save before page unload / refresh
window.addEventListener('beforeunload', () => {
  if (currentTab === 'tempInvoice' || currentTempInvoice) {
    saveTempInvoiceDraft(true);
  }
});

// Event Listeners for Temp Invoice Toolbar
if ($('tabTempInvoice')) {
  $('tabTempInvoice').addEventListener('click', () => {
    showView(viewTempInvoice);
    initTempInvoice();
  });
}

if ($('btnTiAddRow')) {
  $('btnTiAddRow').addEventListener('click', addTempInvoiceItem);
}

if ($('btnTiClearValues')) {
  $('btnTiClearValues').addEventListener('click', () => {
    confirmAction(
      'Clear All Values?',
      'Are you sure you want to clear all numbers and amounts from the invoice table?',
      () => {
        clearTempInvoiceValues();
      }
    );
  });
}

if ($('btnTiReset')) {
  $('btnTiReset').addEventListener('click', () => {
    confirmAction(
      'Reset Invoice?',
      'Are you sure you want to reset all invoice fields, layout, and values back to the original default template?',
      () => {
        try { localStorage.removeItem('temp_invoice_draft'); } catch (e) {}
        currentTempInvoice = null;
        initTempInvoice(true);
        saveTempInvoiceDraft(true);
        toast('Invoice reset to default template values!', 'success');
      }
    );
  });
}

if ($('btnTiSaveDraft')) {
  $('btnTiSaveDraft').addEventListener('click', () => {
    saveTempInvoiceDraft(false);
  });
}

if ($('btnTiDownloadPdf')) {
  $('btnTiDownloadPdf').addEventListener('click', downloadTempInvoicePdf);
}

if ($('btnTiPrint')) {
  $('btnTiPrint').addEventListener('click', () => {
    window.print();
  });
}

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════

populatePartyNamesDatalist();
loadInvoices();
initTempInvoice();

try {
  const savedTab = localStorage.getItem('active_tab');
  if (savedTab === 'tempInvoice' && typeof viewTempInvoice !== 'undefined' && viewTempInvoice) {
    showView(viewTempInvoice);
  }
} catch (e) {}

