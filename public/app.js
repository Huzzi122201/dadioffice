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

// ── DOM References ─────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const viewDashboard = $('viewDashboard');
const viewForm = $('viewForm');
const viewDetail = $('viewDetail');
const viewCashbookDashboard = $('viewCashbookDashboard');
const viewRokerDetail = $('viewRokerDetail');
const viewKhata = $('viewKhata');
const viewEntryForm = $('viewEntryForm');
const views = [viewDashboard, viewForm, viewDetail, viewYarnDashboard, viewYarnForm, viewYarnHistory, viewCashbookDashboard, viewRokerDetail, viewKhata, viewEntryForm].filter(Boolean);

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
let currentTab = 'costing'; // 'costing' or 'yarn'
let currentHistoryPartyName = '';
let currentHistoryPartyNorm = '';

// ── View Routing ───────────────────────────────────────────
function showView(view) {
  views.forEach((v) => v.classList.remove('active'));
  view.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Update bottom nav active state
  const tabBtns = document.querySelectorAll('.bottom-nav-tab');
  if (view === viewYarnDashboard || view === viewYarnForm || view === viewYarnHistory) {
    currentTab = 'yarn';
  } else if (view === viewCashbookDashboard || view === viewRokerDetail || view === viewKhata || view === viewEntryForm) {
    currentTab = 'cashbook';
  } else {
    currentTab = 'costing';
  }
  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === currentTab);
  });
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
async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
}

async function apiPost(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
}

async function apiPut(url, data) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
}

async function apiDelete(url) {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
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
        Generated via Textile Costing Web Application
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

$('tabCosting').addEventListener('click', () => {
  if ($('searchInput')) $('searchInput').value = '';
  showView(viewDashboard);
  loadInvoices();
});

$('tabYarn').addEventListener('click', () => {
  if ($('yarnSearchInput')) $('yarnSearchInput').value = '';
  showView(viewYarnDashboard);
  loadYarnStock();
});

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

async function populatePartyNamesDatalist() {
  try {
    const datalist = $('partyNamesDatalist');
    const yarnFormPartySelect = $('yarnPartySelectDropdown');
    const contractFormPartySelect = $('contractPartySelectDropdown');

    const [stock, invoices] = await Promise.all([
      apiGet(`${YARN_API}/stock`).catch(() => []),
      apiGet(API).catch(() => []),
    ]);

    const partyMap = new Map();
    const addParty = (rawName) => {
      if (!rawName || !rawName.trim()) return;
      const cleanName = toTitleCase(rawName);
      const norm = cleanName.toLowerCase();
      if (!partyMap.has(norm)) {
        partyMap.set(norm, cleanName);
      }
    };

    if (Array.isArray(stock)) stock.forEach(s => addParty(s.partyName));
    if (Array.isArray(invoices)) invoices.forEach(i => addParty(i.partyName));

    const sortedParties = Array.from(partyMap.values()).sort();

    if (datalist) {
      datalist.innerHTML = sortedParties.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    }

    if (yarnFormPartySelect) {
      yarnFormPartySelect.innerHTML = '<option value="">-- Choose Existing Party --</option>' +
        sortedParties.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    }

    if (contractFormPartySelect) {
      contractFormPartySelect.innerHTML = '<option value="">-- Choose Existing Party --</option>' +
        sortedParties.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    }
  } catch (err) {
    // silent fallback
  }
}

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

$('btnNewYarnIssue').addEventListener('click', () => openYarnForm(''));

$('btnYarnFormBack').addEventListener('click', () => {
  editingYarnId = null;
  if (currentHistoryPartyName && currentHistoryPartyNorm) {
    openYarnHistory(encodeURIComponent(currentHistoryPartyNorm), currentHistoryPartyName);
  } else {
    showView(viewYarnDashboard);
    loadYarnStock();
  }
});

$('btnYarnFormCancel').addEventListener('click', () => {
  editingYarnId = null;
  if (currentHistoryPartyName && currentHistoryPartyNorm) {
    openYarnHistory(encodeURIComponent(currentHistoryPartyNorm), currentHistoryPartyName);
  } else {
    showView(viewYarnDashboard);
    loadYarnStock();
  }
});

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

$('btnYarnHistoryBack').addEventListener('click', () => {
  currentHistoryPartyName = '';
  currentHistoryPartyNorm = '';
  showView(viewYarnDashboard);
  loadYarnStock();
});

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

const CB_API = '/api/cashbook';
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

const CONTRACTS_API = '/api/contracts';

// ── Subnav Switcher (Rokers vs Khata vs Parties vs PurchaseSell vs Contracts) ─────────
function setCashbookSubtab(subtab) {
  currentCashbookSubtab = subtab;
  $('subnavRokers').classList.toggle('active', subtab === 'rokers');
  $('subnavKhata').classList.toggle('active', subtab === 'khata');
  if ($('subnavParties')) $('subnavParties').classList.toggle('active', subtab === 'parties');
  if ($('subnavPurchaseSell')) $('subnavPurchaseSell').classList.toggle('active', subtab === 'purchaseSell');
  if ($('subnavContracts')) $('subnavContracts').classList.toggle('active', subtab === 'contracts');

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
if ($('btnNewContract')) {
  $('btnNewContract').addEventListener('click', () => openNewContractModal());
}

// ═══════════════════════════════════════════════════════════
//  CASHBOOK DASHBOARD (Rokers, Khata Ledger, All Parties, Contracts)
// ═══════════════════════════════════════════════════════════

async function loadCashbookDashboard() {
  try {
    const search = $('cbSearchInput') ? $('cbSearchInput').value.trim() : '';

    if (currentCashbookSubtab === 'contracts') {
      if ($('btnNewContract')) $('btnNewContract').style.display = '';
      if ($('btnDownloadChatha')) $('btnDownloadChatha').style.display = 'none';
      if ($('btnShareChatha')) $('btnShareChatha').style.display = 'none';
      if ($('btnNewJamaEntry')) $('btnNewJamaEntry').style.display = 'none';
      if ($('btnNewBanamEntry')) $('btnNewBanamEntry').style.display = 'none';
      if ($('btnNewParty')) $('btnNewParty').style.display = 'none';

      await loadContractsDashboard(search);
      return;
    }

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

      // Client fallback for Cash In Hand balance if server hasn't restarted
      let fallbackCih = 0;
      try {
        const parties = await apiGet(`${CB_API}/parties`);
        const cih = parties.find(p => p.khataNo === 95 || (p.nameNorm && p.nameNorm === 'cash in hand'));
        if (cih) fallbackCih = cih.balance;
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
      const parties = await apiGet(url);

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
                    <div class="cb-party-name-row">
                      <span class="cb-party-name">${escapeHtml(p.name)}</span>
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
      const parties = await apiGet(url);

      const cashParties = parties.filter(p => p.balanceType === 'cash' || (p.nameNorm && p.nameNorm === 'cash in hand'));
      const nonCashParties = parties.filter(p => !cashParties.some(cp => cp._id === p._id));

      const jamaParties = nonCashParties.filter(p => p.balance > 0);
      const banamParties = nonCashParties.filter(p => p.balance < 0);
      const zeroParties = nonCashParties.filter(p => p.balance === 0);

      const totalCashSum = cashParties.reduce((s, p) => s + p.balance, 0);
      const totalJamaSum = jamaParties.reduce((s, p) => s + p.balance, 0);
      const totalBanamSum = banamParties.reduce((s, p) => s + Math.abs(p.balance), 0);

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
        const balClass = isCashP ? (p.balance >= 0 ? 'positive' : 'negative') : (p.balance > 0 ? 'positive' : p.balance < 0 ? 'negative' : 'zero');
        const balLabel = isCashP ? 'Cash Balance' : (p.balance > 0 ? 'Jama (Credit)' : p.balance < 0 ? 'Banam (Debit)' : 'Balanced');
        return `
          <div class="cb-party-card" onclick="openKhata(${p.khataNo})">
            <div class="cb-party-card-left">
              <div class="cb-party-info">
                <div class="cb-party-name-row">
                  <span class="cb-party-name">${escapeHtml(p.name)}</span>
                  <span class="cb-party-khata-no">#${p.khataNo}</span>
                  ${isCashP ? '<span class="badge" style="background: #e0f2fe; color: #0284c7; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">💵 Cash Party</span>' : ''}
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
              <div style="display: flex; gap: 0.25rem;">
                <button class="btn-action edit" onclick="event.stopPropagation(); editPartyFromCard('${p._id}', '${escapeHtml(p.name)}', ${p.openingBalance || 0}, '${p.balanceType || 'none'}', '${escapeHtml(p.phone || '')}')" title="Edit Party">✏️</button>
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
          </div>
        </div>
      `;

      let contentHtml = filterBarHtml;

      if (cbKhataFilter === 'jama') {
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
    data.summary.cashInHand = cashInHandVal || 0;
    data.summary.endRokerValue = (data.summary.totalJama || 0) + (cashInHandVal || 0);
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
            <div class="cb-roker-stat-val" style="color: #0284c7;">${fmtCurrency(data.summary.cashInHand || 0)}</div>
            <div class="cb-roker-stat-lbl">Cash in Hand</div>
          </div>
          <div class="cb-roker-stat-item highlight-end-roker" onclick="openEndRokerModal()" title="Click to view End Roker calculation breakdown">
            <div class="cb-roker-stat-val" style="color: #d97706; font-size: 1.25rem;">${fmtCurrency(data.summary.endRokerValue || 0)}</div>
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
          Generated via Textile Costing & Cashbook Application · Roker #${rokerNo} · ${new Date().toLocaleDateString()}
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

    // Build table rows side by side (without Khata No, with bigger fonts)
    let rowsHtml = '';
    for (let i = 0; i < maxRows; i++) {
      const bp = banamParties[i];
      const jp = jamaParties[i];
      const bgColor = i % 2 === 1 ? 'background: #f8fafc;' : '';

      rowsHtml += `<tr class="chatha-row" style="border-bottom: 1px solid #e2e8f0; page-break-inside: avoid !important; break-inside: avoid !important; ${bgColor}">`;

      // LEFT: Banam (بنام) party
      if (bp) {
        rowsHtml += `
          <td style="padding: 7px 4px; font-size: 11.5px; text-align: center; color: #64748b; font-weight: 600;">${i + 1}</td>
          <td style="padding: 7px 6px; font-size: 12px; font-weight: 700; color: #0f172a;">${escapeHtml(bp.name)}</td>
          <td style="padding: 7px 6px; font-size: 12px; text-align: right; font-weight: 800; color: #b91c1c;">${fmtCurrency(Math.abs(bp.balance))}</td>
        `;
      } else {
        rowsHtml += `<td colspan="3" style="padding: 7px 4px;"></td>`;
      }

      // Divider column
      rowsHtml += `<td style="padding: 0; width: 4px; background: #0f172a;"></td>`;

      // RIGHT: Jama (جمع) party
      if (jp) {
        rowsHtml += `
          <td style="padding: 7px 4px; font-size: 11.5px; text-align: center; color: #64748b; font-weight: 600;">${i + 1}</td>
          <td style="padding: 7px 6px; font-size: 12px; font-weight: 700; color: #0f172a;">${escapeHtml(jp.name)}</td>
          <td style="padding: 7px 6px; font-size: 12px; text-align: right; font-weight: 800; color: #15803d;">${fmtCurrency(jp.balance)}</td>
        `;
      } else {
        rowsHtml += `<td colspan="3" style="padding: 7px 4px;"></td>`;
      }

      rowsHtml += `</tr>`;
    }

    const container = document.createElement('div');
    container.style.cssText = 'position: absolute; left: 0; top: 0; width: 720px; z-index: -99999; opacity: 0; pointer-events: none;';

    const dateStr = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

    container.innerHTML = `
      <style>
        #chathaPdfRoot table { page-break-inside: auto; }
        #chathaPdfRoot tr, #chathaPdfRoot .chatha-row { page-break-inside: avoid !important; break-inside: avoid !important; }
        #chathaPdfRoot thead { display: table-header-group !important; page-break-inside: avoid !important; }
        #chathaPdfRoot tfoot { display: table-footer-group !important; page-break-inside: avoid !important; }
      </style>
      <div id="chathaPdfRoot" style="padding: 16px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; background: #ffffff; width: 720px; max-width: 720px; box-sizing: border-box; margin: 0 auto;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a, #1e3a8a); color: #ffffff; padding: 14px 18px; border-radius: 6px; margin-bottom: 14px; text-align: center; page-break-inside: avoid;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #ffffff;">📋 CHATHA / چٹھا</h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #93c5fd; font-weight: 600;">All Parties Ledger Summary · ${jamaParties.length + banamParties.length} Active Parties · ${dateStr}</p>
        </div>

        <!-- Two-Column Table -->
        <table style="width: 100%; table-layout: fixed; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; margin: 0; page-break-inside: auto;">
          <colgroup>
            <!-- Left: Banam -->
            <col style="width: 32px;">
            <col style="width: 200px;">
            <col style="width: 114px;">
            <!-- Divider -->
            <col style="width: 4px;">
            <!-- Right: Jama -->
            <col style="width: 32px;">
            <col style="width: 200px;">
            <col style="width: 114px;">
          </colgroup>
          <thead style="display: table-header-group; page-break-inside: avoid;">
            <tr style="background: #0f172a; color: #ffffff; font-size: 11.5px; page-break-inside: avoid;">
              <th colspan="3" style="padding: 9px 6px; text-align: center; border-right: 2px solid #fbbf24; font-weight: 800;">🔴 BANAM / بنام (Debit) — ${banamParties.length} Parties</th>
              <th style="padding: 0; width: 4px; background: #fbbf24;"></th>
              <th colspan="3" style="padding: 9px 6px; text-align: center; border-left: 2px solid #fbbf24; font-weight: 800;">🟢 JAMA / جمع (Credit) — ${jamaParties.length} Parties</th>
            </tr>
            <tr style="background: #1e293b; color: #cbd5e1; font-size: 10.5px; page-break-inside: avoid;">
              <th style="padding: 7px 4px; text-align: center;">#</th>
              <th style="padding: 7px 6px; text-align: left;">Party Name</th>
              <th style="padding: 7px 6px; text-align: right;">Amount</th>
              <th style="padding: 0; width: 4px; background: #334155;"></th>
              <th style="padding: 7px 4px; text-align: center;">#</th>
              <th style="padding: 7px 6px; text-align: left;">Party Name</th>
              <th style="padding: 7px 6px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot style="display: table-footer-group; page-break-inside: avoid;">
            <tr style="background: #f1f5f9; border-top: 2px solid #0f172a; font-weight: 800; font-size: 11.5px; page-break-inside: avoid;">
              <td colspan="2" style="padding: 9px 6px; text-align: left;">Total Banam (${banamParties.length})</td>
              <td style="padding: 9px 6px; text-align: right; color: #b91c1c; font-size: 12px; font-weight: 800;">${fmtCurrency(totalBanam)}</td>
              <td style="padding: 0; width: 4px; background: #0f172a;"></td>
              <td colspan="2" style="padding: 9px 6px; text-align: left;">Total Jama (${jamaParties.length})</td>
              <td style="padding: 9px 6px; text-align: right; color: #15803d; font-size: 12px; font-weight: 800;">${fmtCurrency(totalJama)}</td>
            </tr>
            <tr style="background: #e2e8f0; font-weight: 800; font-size: 11px; page-break-inside: avoid;">
              <td colspan="3" style="padding: 7px 6px; text-align: center; color: ${totalJama === totalBanam ? '#15803d' : totalJama > totalBanam ? '#15803d' : '#b91c1c'};">
                Net: ${fmtCurrency(Math.abs(totalJama - totalBanam))} (${totalJama === totalBanam ? 'Balanced / برابر' : totalJama > totalBanam ? 'Jama Surplus' : 'Banam Surplus'})
              </td>
              <td style="padding: 0; width: 4px; background: #0f172a;"></td>
              <td colspan="3" style="padding: 7px 6px; text-align: center; color: #64748b;">
                Total Parties: ${jamaParties.length + banamParties.length}
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- Footer -->
        <div style="margin-top: 14px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 10px; color: #94a3b8; page-break-inside: avoid;">
          Chatha / چٹھا · Generated via Textile Costing & Cashbook Application · ${dateStr}
        </div>
      </div>
    `;

    document.body.appendChild(container);

    const fileName = `Chatha_${dateStr.replace(/\s+/g, '_')}.pdf`;
    const opt = {
      margin: [8, 4, 8, 4],
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
        mode: ['avoid-all', 'css', 'legacy'],
        avoid: ['tr', 'thead', 'tfoot', '.chatha-row', '.page-break-avoid']
      }
    };

    if (typeof html2pdf !== 'undefined') {
      const targetElement = container.querySelector('#chathaPdfRoot') || container.firstElementChild;
      const pdfWorker = html2pdf().set(opt).from(targetElement);
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
    $('contractRate').value = c.rate || '';
    $('contractNote').value = c.note || '';

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
          <tr style="border-bottom: 1px solid var(--border-color, #334155);"><td style="padding: 6px 4px; color: var(--text-secondary);">Fabric Rate</td><td style="padding: 6px 4px; font-weight: 800; text-align: right; color: #10b981;">₹ ${c.rate ? c.rate.toFixed(2) : '0.00'} / ${escapeHtml(c.quantityUnit || 'Meter')}</td></tr>
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
            <strong style="color: #fbbf24;">Note / Terms (نوٹ):</strong> ${escapeHtml(c.note)}
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
    container.style.cssText = 'position: absolute; left: 0; top: 0; width: 720px; z-index: -99999; opacity: 0; pointer-events: none;';

    const specsText = (c.warpCount || c.weftCount || c.reed || c.pick)
      ? `${c.warpCount}x${c.weftCount} / ${c.reed}x${c.pick} / ${c.width}"`
      : '—';

    container.innerHTML = `
      <div id="contractPdfRoot" style="padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; background: #ffffff; width: 720px; max-width: 720px; box-sizing: border-box; margin: 0 auto;">
        
        <!-- Header -->
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; letter-spacing: 1px; text-transform: uppercase;">
              📝 FABRIC CONTRACT / معاہدہ نامہ
            </h1>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b; font-weight: 600;">Textile Costing & Cashbook System</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: 900; color: #2563eb;">CONTRACT #${c.contractNo}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Date: <strong>${dateStr}</strong></div>
          </div>
        </div>

        <!-- Parties Box -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
          <div style="border: 1.5px solid #2563eb; border-radius: 6px; padding: 12px; background: #f8fafc;">
            <div style="font-size: 11px; font-weight: 800; color: #2563eb; text-transform: uppercase; margin-bottom: 4px;">
              🛒 PURCHASER / خریدار (بنام)
            </div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${escapeHtml(c.purchaserName)}</div>
          </div>
          <div style="border: 1.5px solid #16a34a; border-radius: 6px; padding: 12px; background: #f8fafc;">
            <div style="font-size: 11px; font-weight: 800; color: #16a34a; text-transform: uppercase; margin-bottom: 4px;">
              🏭 SELLER / بیچنے والا (جمع)
            </div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${escapeHtml(c.sellerName)}</div>
          </div>
        </div>

        <!-- Delivery & Broker Meta -->
        <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 12px;">
          <div>
            <span style="color: #64748b; font-weight: 600;">Delivery Mode:</span><br>
            <strong style="color: ${isHazar ? '#2563eb' : '#d97706'}; font-size: 13px;">${isHazar ? '⚡ Hazar (حاضر - Ready)' : '📅 Amdan (آمدن - Delivery)'}</strong>
          </div>
          <div>
            <span style="color: #64748b; font-weight: 600;">Delivery Date:</span><br>
            <strong style="font-size: 13px;">${deliveryDateStr}</strong>
          </div>
          <div>
            <span style="color: #64748b; font-weight: 600;">Broker / ایجنٹ:</span><br>
            <strong style="font-size: 13px;">${escapeHtml(c.broker || 'Direct')}</strong>
          </div>
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
                ${c.gudamMuqam ? `<div style="font-size: 11px; font-weight: 600; color: #64748b; margin-top: 4px;">📍 Warehouse: ${escapeHtml(c.gudamMuqam)}</div>` : ''}
              </td>
              <td style="padding: 12px 10px; text-align: center; font-size: 12px; font-weight: 700; border-right: 1px solid #cbd5e1;">
                ${escapeHtml(specsText)}
              </td>
              <td style="padding: 12px 10px; text-align: center; font-size: 13px; font-weight: 800; color: #2563eb; border-right: 1px solid #cbd5e1;">
                ${(c.quantity || 0).toLocaleString()} ${escapeHtml(c.quantityUnit || 'Mtrs')}
              </td>
              <td style="padding: 12px 10px; text-align: right; font-size: 14px; font-weight: 900; color: #16a34a;">
                ₹ ${c.rate ? c.rate.toFixed(2) : '0.00'}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Notes / Special Terms -->
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 28px; background: #fafafa; font-size: 11.5px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 4px; text-transform: uppercase;">Terms & Conditions / شرائط و نوٹ:</div>
          <div>${escapeHtml(c.note || 'Delivery subject to standard mill quality inspection and agreed payment terms.')}</div>
        </div>

        <!-- Signatures Row -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; margin-top: 30px; font-size: 12px;">
          <div>
            <div style="border-bottom: 1.5px dashed #64748b; height: 35px; margin-bottom: 6px;"></div>
            <strong style="color: #0f172a;">Purchaser Signature</strong><br>
            <span style="font-size: 10px; color: #64748b;">(دستخط خریدار)</span>
          </div>
          <div>
            <div style="border-bottom: 1.5px dashed #64748b; height: 35px; margin-bottom: 6px;"></div>
            <strong style="color: #0f172a;">Broker Signature</strong><br>
            <span style="font-size: 10px; color: #64748b;">(دستخط بروکر)</span>
          </div>
          <div>
            <div style="border-bottom: 1.5px dashed #64748b; height: 35px; margin-bottom: 6px;"></div>
            <strong style="color: #0f172a;">Seller Signature</strong><br>
            <span style="font-size: 10px; color: #64748b;">(دستخط بیچنے والا)</span>
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 24px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 10px; color: #94a3b8;">
          Contract #${c.contractNo} · Generated via Textile Costing & Cashbook Application · ${new Date().toLocaleDateString()}
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
          Generated via Textile Costing & Cashbook Application · Khata #${p.khataNo} (${escapeHtml(p.name)}) · ${new Date().toLocaleDateString()}
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

function openPartyModal(id = null, name = '', amount = 0, type = 'jama', phone = '') {
  $('partyForm').reset();
  $('partyModalId').value = id || '';
  $('partyModalName').value = name || '';
  $('partyModalAmount').value = amount || '';
  $('partyModalType').value = (type === 'banam') ? 'banam' : (type === 'cash') ? 'cash' : 'jama';
  $('partyModalPhone').value = phone || '';
  $('partyModalTitle').textContent = id ? '✏️ Edit Party' : '＋ Add New Party';
  $('partyModal').classList.remove('hidden');
}
window.openPartyModal = openPartyModal;

function editPartyFromCard(id, name, amount, type, phone) {
  openPartyModal(id, name, amount, type, phone);
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
  const isSell = $('entryTypeSell') ? $('entryTypeSell').checked : false;
  const isCash = $('entryModeCash') ? $('entryModeCash').checked : false;
  if ($('sellPurchaseSection')) {
    if (isSell && !isCash) {
      $('sellPurchaseSection').style.display = '';
      populateOpenPurchasesSelect();
    } else {
      $('sellPurchaseSection').style.display = 'none';
    }
  }
}

function handleCashModeToggle() {
  const isCash = $('entryModeCash') ? $('entryModeCash').checked : false;
  const isSell = $('entryTypeSell') ? $('entryTypeSell').checked : false;

  if (isCash) {
    if ($('entryTypeSection')) $('entryTypeSection').style.display = 'none';
    if ($('sellPurchaseSection')) $('sellPurchaseSection').style.display = 'none';
  } else {
    if ($('entryTypeSection')) $('entryTypeSection').style.display = '';
    if (isSell) {
      if ($('sellPurchaseSection')) $('sellPurchaseSection').style.display = '';
    } else {
      if ($('sellPurchaseSection')) $('sellPurchaseSection').style.display = 'none';
    }
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
  if ($('sellPurchaseSection')) $('sellPurchaseSection').style.display = 'none';

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

    if (editData) {
      if (editData.isPurchase && $('entryTypePurchase')) {
        $('entryTypePurchase').checked = true;
      } else if ($('entryTypeNormal')) {
        $('entryTypeNormal').checked = true;
      }
    } else {
      if ($('entryTypePurchase')) $('entryTypePurchase').checked = true; // Default to Purchase for Jama
    }
    if ($('sellPurchaseSection')) $('sellPurchaseSection').style.display = 'none';

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

    if (editData) {
      if (editData.isSell && $('entryTypeSell')) {
        $('entryTypeSell').checked = true;
      } else if ($('entryTypeNormal')) {
        $('entryTypeNormal').checked = true;
      }
    } else {
      if ($('entryTypeSell')) $('entryTypeSell').checked = true; // Default to Sell for Banam
    }

    if ($('entryTypeSell') && $('entryTypeSell').checked) {
      if ($('sellPurchaseSection')) $('sellPurchaseSection').style.display = '';
      await populateOpenPurchasesSelect(editData ? editData.linkedPurchaseId : null);
    } else {
      if ($('sellPurchaseSection')) $('sellPurchaseSection').style.display = 'none';
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

  // Populate party datalist
  populatePartyDatalist();

  // Reset contract rate indicators
  if ($('entryContractBadge')) $('entryContractBadge').style.display = 'none';
  if ($('entryContractHint')) $('entryContractHint').style.display = 'none';

  if (preSelectPartyName) {
    $('entryPartyName').value = preSelectPartyName;
    if (!editData) {
      fetchContractRateForSeller(preSelectPartyName, false);
    }
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

// ── Auto-fetch Contract Rate for Seller Party ──
let fetchContractRateTimeout = null;
async function fetchContractRateForSeller(partyName, overwrite = false) {
  if (!partyName || !partyName.trim()) {
    if ($('entryContractBadge')) $('entryContractBadge').style.display = 'none';
    if ($('entryContractHint')) $('entryContractHint').style.display = 'none';
    return;
  }

  const pNorm = partyName.trim().toLowerCase();
  try {
    const contracts = await apiGet(`${CONTRACTS_API}?q=${encodeURIComponent(partyName.trim())}`);
    if (contracts && contracts.length > 0) {
      // Find contract where sellerName matches this partyName
      const match = contracts.find(c => (c.sellerName || '').trim().toLowerCase() === pNorm) || contracts.find(c => (c.sellerName || '').trim().toLowerCase().includes(pNorm));
      if (match && match.rate > 0) {
        const currentRate = parseFloat($('entryRate')?.value) || 0;
        if (overwrite || currentRate === 0) {
          if ($('entryRate')) $('entryRate').value = match.rate;
          updateCalculatedAmount();
        }
        if ($('entryContractBadge')) $('entryContractBadge').style.display = 'inline-block';
        if ($('entryContractHint')) {
          $('entryContractHint').style.display = 'block';
          $('entryContractHint').textContent = `Contract #${match.contractNo}: Rate ₹ ${match.rate.toFixed(2)}${match.quality ? ' (' + match.quality + ')' : ''}`;
        }
        return;
      }
    }
  } catch (err) {
    // silent fallback
  }

  if ($('entryContractBadge')) $('entryContractBadge').style.display = 'none';
  if ($('entryContractHint')) $('entryContractHint').style.display = 'none';
}

if ($('entryPartyName')) {
  $('entryPartyName').addEventListener('input', () => {
    clearTimeout(fetchContractRateTimeout);
    fetchContractRateTimeout = setTimeout(() => {
      fetchContractRateForSeller($('entryPartyName').value, true);
    }, 300);
  });
  $('entryPartyName').addEventListener('change', () => {
    fetchContractRateForSeller($('entryPartyName').value, true);
  });
  $('entryPartyName').addEventListener('blur', () => {
    fetchContractRateForSeller($('entryPartyName').value, true);
  });
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

  const partyName = $('entryPartyName').value.trim();
  if (!partyName) return toast('Party Name is required', 'error');

  const rokerNoVal = parseInt($('entryRokerNo').value) || 0;
  const isCashVal = $('entryModeCash') ? $('entryModeCash').checked : false;
  const side = $('entrySide').value;
  const isPurchaseVal = !isCashVal && (side === 'jama');
  const isSellVal = !isCashVal && (side === 'banam');
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

function openEndRokerModal() {
  if (!currentRokerData || !currentRokerData.summary) {
    toast('No roker data available', 'error');
    return;
  }
  const s = currentRokerData.summary;
  const rokerNo = currentRokerNo;
  const rokerDate = formatDate(currentRokerData.date);

  const totalNaam = s.totalNaam || 0;
  const totalJama = s.totalJama || 0;
  const cashInHand = s.cashInHand || 0;
  const endRokerValue = s.endRokerValue || (totalJama + cashInHand);

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
    <div class="end-roker-calc-box">
      <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.35rem;">
        📅 Date: <strong>${rokerDate}</strong> · Roker #${rokerNo}
      </div>
      <div class="end-roker-row">
        <span style="color: var(--text-secondary);">🟢 Total Jama (جمع):</span>
        <strong style="color: #15803d; font-size: 0.9rem;">${fmtCurrency(totalJama)}</strong>
      </div>
      <div class="end-roker-row">
        <span style="color: var(--text-secondary);">🔴 Total Naam (بنام):</span>
        <strong style="color: #b91c1c; font-size: 0.9rem;">${fmtCurrency(totalNaam)}</strong>
      </div>
      <div class="end-roker-row" style="background: rgba(2, 132, 199, 0.05); padding: 0.25rem 0.35rem; border-radius: 4px; margin: 0.15rem 0;">
        <span style="color: #0284c7; font-weight: 600;">💵 Cash in Hand:</span>
        <strong style="color: #0284c7; font-size: 0.9rem;">+ ${fmtCurrency(cashInHand)}</strong>
      </div>
      <div class="end-roker-row total">
        <span style="color: #d97706;">🏁 End Roker Total:</span>
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
//  INIT
// ═══════════════════════════════════════════════════════════

populatePartyNamesDatalist();
loadInvoices();
