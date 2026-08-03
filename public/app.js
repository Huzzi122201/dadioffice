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
const viewYarnDashboard = $('viewYarnDashboard');
const viewYarnForm = $('viewYarnForm');
const viewYarnHistory = $('viewYarnHistory');
const views = [viewDashboard, viewForm, viewDetail, viewYarnDashboard, viewYarnForm, viewYarnHistory];

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

  // Show/hide FAB
  const fab = $('fabNew');
  fab.style.display = view === viewDashboard ? 'flex' : 'none';

  // Update bottom nav active state
  const tabBtns = document.querySelectorAll('.bottom-nav-tab');
  if (view === viewYarnDashboard || view === viewYarnForm || view === viewYarnHistory) {
    currentTab = 'yarn';
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

// ── Format Date ────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (typeof dateStr === 'string') {
    const trimmed = dateStr.trim();
    if (trimmed.match(/^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}/)) {
      return trimmed;
    }

    // Handle slash dates like "08/01/2026" or "8/1/2026" or "01/08/2026"
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      let p1 = parseInt(slashMatch[1], 10);
      let p2 = parseInt(slashMatch[2], 10);
      const year = parseInt(slashMatch[3], 10);

      let monthIndex = p1 - 1;
      let day = p2;
      if (p1 > 12) {
        day = p1;
        monthIndex = p2 - 1;
      }
      return `${day} ${months[monthIndex] || ''} ${year}`;
    }

    // Handle ISO dash dates like "2026-08-01"
    const dashMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dashMatch) {
      const year = parseInt(dashMatch[1], 10);
      const monthIndex = parseInt(dashMatch[2], 10) - 1;
      const day = parseInt(dashMatch[3], 10);
      return `${day} ${months[monthIndex] || ''} ${year}`;
    }
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const monthStr = months[d.getMonth()] || 'Aug';
  const year = d.getFullYear();
  return `${day} ${monthStr} ${year}`;
}

function toInputDate(dateStr) {
  if (!dateStr) return formatDate(new Date());
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
  $('date').value = formatDate(new Date());
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

  $('preBagsWarp').textContent = fmtInt(r.yarnBagsWarp);
  $('preBagsWeft').textContent = fmtInt(r.yarnBagsWeft);
  $('preTotalBags').textContent = fmtInt(r.totalYarnBags);
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
                  <tr><td>Yarn Bags (Warp)</td><td colspan="2">${fmtInt(inv.yarnBagsWarp)}</td></tr>
                  <tr><td>Yarn Bags (Weft)</td><td colspan="2">${fmtInt(inv.yarnBagsWeft)}</td></tr>
                  <tr class="highlight-row"><td>Total Yarn Bags</td><td colspan="2" class="highlight-val">${fmtInt(inv.totalYarnBags)}</td></tr>
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
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 4px 8px;">Yarn Bags (Warp)</td><td colspan="2" style="padding: 4px 8px; text-align: right;">${fmtInt(inv.yarnBagsWarp)}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 4px 8px;">Yarn Bags (Weft)</td><td colspan="2" style="padding: 4px 8px; text-align: right;">${fmtInt(inv.yarnBagsWeft)}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0; background: #dbeafe;"><td style="padding: 4px 8px; font-weight: 700; color: #1e40af;">Total Yarn Bags</td><td colspan="2" style="padding: 4px 8px; text-align: right; font-weight: 700; color: #1e40af;">${fmtInt(inv.totalYarnBags)}</td></tr>
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
$('fabNew').addEventListener('click', openNewForm);

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
  showView(viewDashboard);
  loadInvoices();
});

$('tabYarn').addEventListener('click', () => {
  showView(viewYarnDashboard);
  loadYarnStock();
});

// ═══════════════════════════════════════════════════════════
//  YARN STOCK — DASHBOARD (Party Names Only)
// ═══════════════════════════════════════════════════════════

async function loadYarnStock(search = '') {
  try {
    const stock = await apiGet(`${YARN_API}/stock`);

    let displayList = stock;
    if (search) {
      const term = search.toLowerCase();
      displayList = stock.filter(s => s.partyName.toLowerCase().includes(term));
    }

    $('yarnPartyCount').textContent = `(${displayList.length})`;

    if (displayList.length === 0) {
      $('yarnStockGrid').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏢</div>
          <p>${search ? 'No parties match your search.' : 'No party yarn issued yet. Start by issuing yarn to a party!'}</p>
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
              <span class="view-link">View DataGrid ➔</span>
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

async function populatePartyNamesDatalist() {
  try {
    const datalist = $('partyNamesDatalist');
    if (!datalist) return;
    
    // Fetch parties from yarn stock as well as invoices for comprehensive autocomplete
    const [stock, invoices] = await Promise.all([
      apiGet(`${YARN_API}/stock`).catch(() => []),
      apiGet(API).catch(() => []),
    ]);

    const nameSet = new Set();
    if (Array.isArray(stock)) stock.forEach(s => s.partyName && nameSet.add(s.partyName));
    if (Array.isArray(invoices)) invoices.forEach(i => i.partyName && nameSet.add(i.partyName));

    datalist.innerHTML = Array.from(nameSet)
      .sort()
      .map(name => `<option value="${escapeHtml(name)}"></option>`)
      .join('');
  } catch (err) {
    // silent fallback
  }
}

function openYarnForm(partyNamePreFill = '') {
  $('yarnFormTitle').textContent = partyNamePreFill ? `Issue Yarn — ${partyNamePreFill}` : 'Issue Yarn';
  $('yarnForm').reset();
  $('yarnDate').value = formatDate(new Date());
  if (partyNamePreFill) {
    $('yarnPartyName').value = partyNamePreFill;
  }
  populatePartyNamesDatalist();
  showView(viewYarnForm);
}

$('btnNewYarnIssue').addEventListener('click', () => openYarnForm(''));

$('btnYarnFormBack').addEventListener('click', () => {
  if (currentHistoryPartyName && currentHistoryPartyNorm) {
    openYarnHistory(encodeURIComponent(currentHistoryPartyNorm), currentHistoryPartyName);
  } else {
    showView(viewYarnDashboard);
    loadYarnStock();
  }
});

$('btnYarnFormCancel').addEventListener('click', () => {
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

  const warpBags = parseInt($('yarnWarpBags').value) || 0;
  const weftBags = parseInt($('yarnWeftBags').value) || 0;

  if (warpBags <= 0 && weftBags <= 0) {
    toast('Enter at least warp or weft bags', 'error');
    return;
  }

  const data = {
    partyName,
    date: $('yarnDate').value || formatDate(new Date()),
    warpBags,
    weftBags,
    warpQuality: $('yarnWarpQuality').value.trim(),
    weftQuality: $('yarnWeftQuality').value.trim(),
    note: $('yarnNote').value.trim(),
  };

  try {
    await apiPost(YARN_API, data);
    toast('Yarn issued successfully!');

    // If issuing for the active history party, refresh and return to DataGrid
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
//  YARN STOCK — PARTY DATAGRID VIEW
// ═══════════════════════════════════════════════════════════

async function openYarnHistory(partyNormEncoded, partyDisplayName) {
  const partyNorm = decodeURIComponent(partyNormEncoded);
  currentHistoryPartyName = partyDisplayName;
  currentHistoryPartyNorm = partyNorm;

  $('yarnHistoryTitle').textContent = `${partyDisplayName} — Yarn DataGrid`;

  try {
    const records = await apiGet(`${YARN_API}/history/${encodeURIComponent(partyNorm)}`);

    let totalIssuedW = 0, totalIssuedF = 0, totalDeductedW = 0, totalDeductedF = 0;
    records.forEach(r => {
      if (r.type === 'issue') {
        totalIssuedW += r.warpBags || 0;
        totalIssuedF += r.weftBags || 0;
      } else {
        totalDeductedW += r.warpBags || 0;
        totalDeductedF += r.weftBags || 0;
      }
    });

    const currentW = totalIssuedW - totalDeductedW;
    const currentF = totalIssuedF - totalDeductedF;
    const currentTotal = currentW + currentF;

    $('yarnHistoryContent').innerHTML = `
      <table class="yarn-datagrid-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Quality</th>
            <th>Warp Bags</th>
            <th>Weft Bags</th>
            <th>Total Bags</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(r => {
            const warp = r.warpBags || 0;
            const weft = r.weftBags || 0;
            const totalBags = warp + weft;
            const qParts = [];
            if (r.warpQuality) qParts.push(`Warp: ${r.warpQuality}`);
            if (r.weftQuality) qParts.push(`Weft: ${r.weftQuality}`);
            const qualityStr = qParts.join(' | ') || '—';
            const isIssue = r.type === 'issue';
            const sign = isIssue ? '+' : '−';
            return `
              <tr class="${isIssue ? 'row-issue' : 'row-deduction'}">
                <td>${formatDate(r.date)}</td>
                <td>${escapeHtml(qualityStr)}</td>
                <td>${sign}${fmtInt(warp)}</td>
                <td>${sign}${fmtInt(weft)}</td>
                <td><strong>${sign}${fmtInt(totalBags)}</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr class="datagrid-summary-row">
            <td colspan="2"><strong>Net Available Stock</strong></td>
            <td class="${currentW >= 0 ? 'stock-pos' : 'stock-neg'}"><strong>${fmtInt(currentW)}</strong></td>
            <td class="${currentF >= 0 ? 'stock-pos' : 'stock-neg'}"><strong>${fmtInt(currentF)}</strong></td>
            <td class="${currentTotal >= 0 ? 'stock-pos' : 'stock-neg'}"><strong>${fmtInt(currentTotal)}</strong></td>
          </tr>
        </tfoot>
      </table>
    `;

    showView(viewYarnHistory);
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

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════

populatePartyNamesDatalist();
loadInvoices();
