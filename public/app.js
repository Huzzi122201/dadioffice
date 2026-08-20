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

// Enter key moves to next input field
invoiceForm.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
    e.preventDefault();
    const inputs = Array.from(invoiceForm.querySelectorAll('input:not([type="hidden"])'));
    const index = inputs.indexOf(e.target);
    if (index >= 0 && index < inputs.length - 1) {
      const nextInput = inputs[index + 1];
      nextInput.focus();
      if (nextInput.type === 'text' || nextInput.type === 'number') {
        nextInput.select();
      }
    } else {
      $('btnSave').click();
    }
  }
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
  return '₹ ' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

// ── Subnav Switcher (Rokers vs Khata vs Parties vs PurchaseSell) ─────────
function setCashbookSubtab(subtab) {
  currentCashbookSubtab = subtab;
  $('subnavRokers').classList.toggle('active', subtab === 'rokers');
  $('subnavKhata').classList.toggle('active', subtab === 'khata');
  if ($('subnavParties')) $('subnavParties').classList.toggle('active', subtab === 'parties');
  if ($('subnavPurchaseSell')) $('subnavPurchaseSell').classList.toggle('active', subtab === 'purchaseSell');

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

// ═══════════════════════════════════════════════════════════
//  CASHBOOK DASHBOARD (Rokers, Khata Ledger, All Parties)
// ═══════════════════════════════════════════════════════════

async function loadCashbookDashboard() {
  try {
    const search = $('cbSearchInput') ? $('cbSearchInput').value.trim() : '';

    if (currentCashbookSubtab === 'rokers') {
      if ($('btnNewJamaEntry')) $('btnNewJamaEntry').style.display = '';
      if ($('btnNewBanamEntry')) $('btnNewBanamEntry').style.display = '';
      if ($('btnNewParty')) $('btnNewParty').style.display = 'none';
      // ── 1. ROKERS VIEW ───────────────────────────────────
      const url = `${CB_API}/rokers${search ? '?search=' + encodeURIComponent(search) : ''}`;
      const rokers = await apiGet(url);

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
                    </div>
                  </div>
                </div>
                <div class="cb-roker-card-right">
                  <div class="cb-roker-totals-row">
                    ${r.totalNaam > 0 ? `<span class="cb-roker-naam-val">Naam: ${fmtCurrency(r.totalNaam)}</span>` : ''}
                    ${r.totalJama > 0 ? `<span class="cb-roker-jama-val">Jama: ${fmtCurrency(r.totalJama)}</span>` : ''}
                  </div>
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
            const statusIcon = p.isFullySold ? '✅' : (p.sellCount > 0 ? '⏳' : '📦');
            const statusText = p.isFullySold ? 'Fully Sold' : (p.sellCount > 0 ? 'Partially Sold (' + p.totalSoldBags + '/' + p.bags + ')' : 'Unsold');
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
              '<td>' + (s.bags || '—') + '</td>' +
              '<td>' + (s.ratePerBag ? fmtCurrency(s.ratePerBag) : '—') + '</td>' +
              '<td style="text-align:right">' + fmtCurrency((s.naam || 0) + (s.jama || 0)) + '</td>' +
              '<td><button class="btn-action delete" onclick="event.stopPropagation(); deleteCbEntry(\'' + s._id + '\')" title="Delete Sell">🗑️</button></td>' +
              '</tr>'
            ).join('');

            return '<div class="cb-purchase-card">' +
              '<div class="cb-purchase-header" onclick="this.parentElement.classList.toggle(\'expanded\')">' +
                '<div class="cb-purchase-left">' +
                  '<span class="cb-purchase-badge">🛒 R#' + p.rokerNo + '</span>' +
                  '<div class="cb-purchase-info">' +
                    '<div class="cb-purchase-party">' + escapeHtml(p.partyName) + '</div>' +
                    '<div class="cb-purchase-meta">' + formatDate(p.date) + ' · ' + p.bags + ' bags × ' + fmtCurrency(p.ratePerBag || 0) + ' = ' + fmtCurrency(p.purchaseAmount) + '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="cb-purchase-right">' +
                  '<span class="ps-status ' + statusClass + '">' + statusIcon + ' ' + statusText + '</span>' +
                  '<div class="cb-purchase-remaining">Remaining: <strong>' + p.remainingBags + '</strong> bags</div>' +
                  profitLossHtml +
                  '<span class="ps-expand-icon">▼</span>' +
                '</div>' +
              '</div>' +
              (p.sellCount > 0 ?
                '<div class="cb-purchase-sells">' +
                  '<h4 style="margin: 0.75rem 0 0.5rem; font-size: 0.875rem; color: var(--text-secondary);">🏷️ Sell Entries (' + p.sellCount + ')</h4>' +
                  '<div class="cb-khata-table-wrapper"><table class="cb-khata-table">' +
                    '<thead><tr><th>Date</th><th>Sold To</th><th>Roker</th><th>Bags</th><th>Rate</th><th style="text-align:right">Amount</th><th>Actions</th></tr></thead>' +
                    '<tbody>' + sellRows + '</tbody>' +
                    '<tfoot><tr style="font-weight:700;"><td colspan="3">Totals</td><td>' + p.totalSoldBags + '</td><td>—</td><td style="text-align:right">' + fmtCurrency(p.totalSellAmount) + '</td><td></td></tr></tfoot>' +
                  '</table></div>' +
                '</div>'
              :
                '<div class="cb-purchase-sells"><p style="padding: 0.75rem; color: var(--text-muted); font-size: 0.8125rem;">No sell entries yet.</p></div>'
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
          <div class="cb-roker-stat-item">
            <div class="cb-roker-stat-val" style="color: #b91c1c;">${fmtCurrency(data.summary.totalNaam)}</div>
            <div class="cb-roker-stat-lbl">Total Naam</div>
          </div>
          <div class="cb-roker-stat-item">
            <div class="cb-roker-stat-val" style="color: #15803d;">${fmtCurrency(data.summary.totalJama)}</div>
            <div class="cb-roker-stat-lbl">Total Jama</div>
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

if ($('btnRokerAddEntry')) {
  $('btnRokerAddEntry').addEventListener('click', () => {
    openAddEntryToCurrentRoker();
  });
}

function openAddEntryToCurrentRoker() {
  cbReturnTo = 'roker';
  openEntryForm(null, currentRokerNo);
}

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
                <th>Bags / Meters</th>
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
  select.innerHTML = '<option value="">— Loading open purchases... —</option>';
  try {
    const url = selectedId ? `${CB_API}/open-purchases?includeId=${encodeURIComponent(selectedId)}` : `${CB_API}/open-purchases`;
    const openPurchases = await apiGet(url);
    if (!openPurchases || openPurchases.length === 0) {
      select.innerHTML = '<option value="">— None (No open purchases available) —</option>';
      return;
    }
    let html = '<option value="">— None (Optional / Regular Entry) —</option>';
    openPurchases.forEach(p => {
      const isSel = (selectedId && (p._id === selectedId || p._id === String(selectedId))) ? 'selected' : '';
      const amount = (p.naam || 0) + (p.jama || 0);
      html += `<option value="${p._id}" ${isSel}>R#${p.rokerNo} - ${escapeHtml(p.partyName)} (${p.remainingBags} bags left @ ${fmtCurrency(p.ratePerBag || 0)} = ${fmtCurrency(amount)})</option>`;
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
  $('entryDate').value = toInputDate(new Date());

  // Reset trade type radio & sell section
  if ($('entryTypeNormal')) $('entryTypeNormal').checked = true;
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

    // Jama Entry: Allow Normal Entry & Purchase Entry options (hide Sell option)
    if ($('wrapperTypeNormal')) $('wrapperTypeNormal').style.display = '';
    if ($('wrapperTypePurchase')) $('wrapperTypePurchase').style.display = '';
    if ($('wrapperTypeSell')) $('wrapperTypeSell').style.display = 'none';

    if (editData && editData.isPurchase) {
      if ($('entryTypePurchase')) $('entryTypePurchase').checked = true;
    } else if (editData && !editData.isPurchase && !editData.isSell) {
      if ($('entryTypeNormal')) $('entryTypeNormal').checked = true;
    } else {
      if ($('entryTypePurchase')) $('entryTypePurchase').checked = true;
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

    // Banam Entry: Allow Normal Entry & Sell Entry options (hide Purchase option)
    if ($('wrapperTypeNormal')) $('wrapperTypeNormal').style.display = '';
    if ($('wrapperTypePurchase')) $('wrapperTypePurchase').style.display = 'none';
    if ($('wrapperTypeSell')) $('wrapperTypeSell').style.display = '';

    if (editData && editData.isSell) {
      if ($('entryTypeSell')) $('entryTypeSell').checked = true;
    } else if (editData && !editData.isPurchase && !editData.isSell) {
      if ($('entryTypeNormal')) $('entryTypeNormal').checked = true;
    } else {
      if ($('entryTypeSell')) $('entryTypeSell').checked = true;
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

  if (preSelectPartyName) {
    $('entryPartyName').value = preSelectPartyName;
  }

  // Fill edit data
  if (editData) {
    $('editEntryId').value = editData._id;
    $('entryDate').value = toInputDate(editData.date);
    $('entryRokerNo').value = editData.rokerNo || '';
    $('entryPartyName').value = editData.partyName || '';
    $('entryDescription').value = editData.description || '';
    $('entryBags').value = editData.bags || '';
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
}

// Real-time automatic multiplication (Bags/Meters x Rate)
function updateCalculatedAmount() {
  const qty = parseFloat($('entryBags').value) || 0;
  const rate = parseFloat($('entryRate').value) || 0;
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
if ($('entryRate')) $('entryRate').addEventListener('input', updateCalculatedAmount);

// Submit entry form
$('entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const partyName = $('entryPartyName').value.trim();
  if (!partyName) return toast('Party Name is required', 'error');

  const rokerNoVal = parseInt($('entryRokerNo').value) || 0;
  const isCashVal = $('entryModeCash') ? $('entryModeCash').checked : false;
  const isPurchaseVal = !isCashVal && ($('entryTypePurchase') ? $('entryTypePurchase').checked : false);
  const isSellVal = !isCashVal && ($('entryTypeSell') ? $('entryTypeSell').checked : false);
  const linkedPurchaseIdVal = (isSellVal && $('sellPurchaseSelect')) ? ($('sellPurchaseSelect').value || null) : null;

  const side = $('entrySide').value;
  const naamVal = (side === 'banam') ? (parseFloat($('entryNaam').value) || 0) : 0;
  const jamaVal = (side === 'jama') ? (parseFloat($('entryJama').value) || 0) : 0;
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

// Make cashbook functions globally available
window.deleteCbParty = deleteCbParty;
window.openKhata = openKhata;
window.openRokerDetail = openRokerDetail;
window.openNewRokerForm = openNewRokerForm;
window.openEntryForm = openEntryForm;
window.openEditEntry = openEditEntry;
window.deleteCbEntry = deleteCbEntry;

// ═══════════════════════════════════════════════════════════
//  INPUT ENHANCEMENTS: Prevent Wheel Spin & Enter Key Navigation
// ═══════════════════════════════════════════════════════════

// 1. Prevent trackpad / mouse scroll wheel from changing number input values
document.addEventListener('wheel', (e) => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'number') {
    document.activeElement.blur();
  }
}, { passive: true });

// 2. On Enter key press: advance focus to the next visible input field in the form
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const target = e.target;
  if (!target || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.type === 'submit') return;

  const form = target.closest('form');
  if (!form) return;

  // If user is on Naam input in entryForm and has typed a positive amount, save on Enter directly
  if (target.id === 'entryNaam' && parseFloat(target.value) > 0) {
    e.preventDefault();
    form.requestSubmit();
    return;
  }

  // Find all visible, focusable input controls inside the form
  const focusable = Array.from(form.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="radio"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
  )).filter(el => {
    return el.offsetParent !== null && window.getComputedStyle(el).display !== 'none';
  });

  const index = focusable.indexOf(target);
  if (index >= 0 && index < focusable.length - 1) {
    e.preventDefault();
    const nextField = focusable[index + 1];
    nextField.focus();
    if (typeof nextField.select === 'function') {
      nextField.select();
    }
  } else if (index === focusable.length - 1) {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.click();
    } else {
      form.requestSubmit();
    }
  }
});

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════

populatePartyNamesDatalist();
loadInvoices();
