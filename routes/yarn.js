const express = require('express');
const router = express.Router();
const YarnIssuance = require('../models/YarnIssuance');

// ── GET /api/yarn ── List all transactions (with search) ──
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search && search.trim()) {
      const term = search.trim();
      const regex = new RegExp(term, 'i');
      query = { partyName: regex };
    }

    const records = await YarnIssuance.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/yarn/stock ── Aggregated stock per party ──────
router.get('/stock', async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: '$partyNameNorm',
          partyName: { $first: '$partyName' },
          totalIssuedWarp: {
            $sum: { $cond: [{ $eq: ['$type', 'issue'] }, '$warpBags', 0] },
          },
          totalIssuedWeft: {
            $sum: { $cond: [{ $eq: ['$type', 'issue'] }, '$weftBags', 0] },
          },
          totalDeductedWarp: {
            $sum: { $cond: [{ $eq: ['$type', 'deduction'] }, '$warpBags', 0] },
          },
          totalDeductedWeft: {
            $sum: { $cond: [{ $eq: ['$type', 'deduction'] }, '$weftBags', 0] },
          },
          lastIssuedDate: { $max: '$date' },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          partyNameNorm: '$_id',
          partyName: 1,
          totalIssuedWarp: 1,
          totalIssuedWeft: 1,
          totalDeductedWarp: 1,
          totalDeductedWeft: 1,
          currentWarpStock: { $subtract: ['$totalIssuedWarp', '$totalDeductedWarp'] },
          currentWeftStock: { $subtract: ['$totalIssuedWeft', '$totalDeductedWeft'] },
          lastIssuedDate: 1,
          transactionCount: 1,
        },
      },
      { $sort: { partyName: 1 } },
    ];

    const stock = await YarnIssuance.aggregate(pipeline);
    res.json(stock);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function r2(v) {
  return v != null && !isNaN(v) && isFinite(v) ? Number(Number(v).toFixed(2)) : 0;
}

// ── GET /api/yarn/history/:partyNorm ── Transaction history & contract balance ──
router.get('/history/:partyNorm', async (req, res) => {
  try {
    const partyNorm = req.params.partyNorm.toLowerCase();
    const Invoice = require('../models/Invoice');

    // Fetch the single contract for this party
    const invoices = await Invoice.find().sort({ createdAt: -1 }).lean();
    const inv = invoices.find(i => i.partyName && i.partyName.trim().toLowerCase() === partyNorm);

    let remWarp = inv ? r2(inv.yarnBagsWarp || 0) : 0;
    let remWeft = inv ? r2(inv.yarnBagsWeft || 0) : 0;
    const contractInfo = inv ? `${inv.fabricType || 'Contract'}${inv.quantity ? ' (' + Number(inv.quantity).toLocaleString() + 'm)' : ''}` : 'Contract';

    // Fetch all yarn records for this party in chronological order (oldest first)
    const rawRecords = await YarnIssuance.find({ partyNameNorm: partyNorm })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const recordsWithBalance = rawRecords.map(r => {
      let curRemWarp = remWarp;
      let curRemWeft = remWeft;

      if (r.type === 'deduction' && inv) {
        r.date = inv.date || r.date;
        r.warpBags = r2(inv.yarnBagsWarp || 0);
        r.weftBags = r2(inv.yarnBagsWeft || 0);
        r.contractInfo = contractInfo;
        curRemWarp = remWarp;
        curRemWeft = remWeft;
      } else if (r.type === 'issue') {
        remWarp = r2(Math.max(0, remWarp - (r.warpBags || 0)));
        remWeft = r2(Math.max(0, remWeft - (r.weftBags || 0)));
        curRemWarp = remWarp;
        curRemWeft = remWeft;
      } else {
        curRemWarp = remWarp;
        curRemWeft = remWeft;
      }

      return {
        ...r,
        contractInfo: r.contractInfo || contractInfo,
        remainingWarp: r2(curRemWarp),
        remainingWeft: r2(curRemWeft),
        remainingTotal: r2(curRemWarp + curRemWeft),
      };
    });

    // Return newest first for history presentation
    res.json(recordsWithBalance.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/yarn/contracts/:partyNorm ── List contracts for a party ──
router.get('/contracts/:partyNorm', async (req, res) => {
  try {
    const partyNorm = req.params.partyNorm.toLowerCase();
    const Invoice = require('../models/Invoice');
    
    const invoices = await Invoice.find().sort({ createdAt: -1 }).lean();
    const partyInvoices = invoices.filter(inv => 
      inv.partyName && inv.partyName.trim().toLowerCase() === partyNorm
    );

    const issuances = await YarnIssuance.find({ partyNameNorm: partyNorm, type: 'issue' }).lean();

    const formatted = partyInvoices.map(inv => {
      const contractIssuances = issuances.filter(i => 
        i.contractId && i.contractId.toString() === inv._id.toString()
      );

      const issuedWarp = r2(contractIssuances.reduce((sum, i) => sum + (i.warpBags || 0), 0));
      const issuedWeft = r2(contractIssuances.reduce((sum, i) => sum + (i.weftBags || 0), 0));

      const requiredWarp = r2(inv.yarnBagsWarp || 0);
      const requiredWeft = r2(inv.yarnBagsWeft || 0);

      const remWarpNeeded = r2(Math.max(0, requiredWarp - issuedWarp));
      const remWeftNeeded = r2(Math.max(0, requiredWeft - issuedWeft));

      const shortTitle = `${inv.fabricType || 'Contract'}${inv.quantity ? ' (' + Number(inv.quantity).toLocaleString() + 'm)' : ''}`;
      const title = `${inv.fabricType ? inv.fabricType + ' ' : ''}Contract (Qty: ${inv.quantity || 0})`;
      const label = `${shortTitle} — Req: ${requiredWarp}W/${requiredWeft}F | Rem: ${remWarpNeeded}W/${remWeftNeeded}F`;

      return {
        _id: inv._id,
        date: inv.date,
        fabricType: inv.fabricType || 'Contract',
        loomType: inv.loomType || '',
        quantity: inv.quantity || 0,
        requiredWarp,
        requiredWeft,
        issuedWarp,
        issuedWeft,
        remWarpNeeded,
        remWeftNeeded,
        shortTitle,
        title,
        label,
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function toTitleCase(str) {
  if (!str) return '';
  return str.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function toUtcDate(dateStr) {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) {
    return new Date(Date.UTC(dateStr.getUTCFullYear(), dateStr.getUTCMonth(), dateStr.getUTCDate(), 0, 0, 0));
  }
  const str = String(dateStr).trim();
  const dashMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dashMatch) {
    const y = parseInt(dashMatch[1], 10);
    const m = parseInt(dashMatch[2], 10) - 1;
    const d = parseInt(dashMatch[3], 10);
    return new Date(Date.UTC(y, m, d, 0, 0, 0));
  }
  const dObj = new Date(str);
  if (isNaN(dObj.getTime())) return new Date();
  return new Date(Date.UTC(dObj.getFullYear(), dObj.getMonth(), dObj.getDate(), 0, 0, 0));
}

// ── POST /api/yarn ── Create new issuance record ──────────
router.post('/', async (req, res) => {
  try {
    const { partyName, date, warpBags, weftBags, warpQuality, weftQuality, contractId, contractInfo, note } = req.body;

    if (!partyName || !partyName.trim()) {
      return res.status(400).json({ error: 'Party name is required' });
    }

    const cleanParty = toTitleCase(partyName);
    const cleanDate = toUtcDate(date);

    const record = new YarnIssuance({
      partyName: cleanParty,
      date: cleanDate,
      warpBags: r2(warpBags),
      weftBags: r2(weftBags),
      warpQuality: warpQuality || '',
      weftQuality: weftQuality || '',
      contractId: contractId || null,
      contractInfo: contractInfo || '',
      note: note || '',
      type: 'issue',
    });

    await record.save();
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/yarn/:id ── Get single issuance record ──────
router.get('/:id', async (req, res) => {
  try {
    const record = await YarnIssuance.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/yarn/:id ── Update issuance record ─────────
router.put('/:id', async (req, res) => {
  try {
    const { partyName, date, warpBags, weftBags, warpQuality, weftQuality, contractId, contractInfo, note } = req.body;

    const record = await YarnIssuance.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });

    if (partyName && partyName.trim()) {
      const cleanParty = toTitleCase(partyName);
      record.partyName = cleanParty;
      record.partyNameNorm = cleanParty.toLowerCase();
    }
    if (date) record.date = toUtcDate(date);
    if (warpBags !== undefined) record.warpBags = r2(warpBags);
    if (weftBags !== undefined) record.weftBags = r2(weftBags);
    if (warpQuality !== undefined) record.warpQuality = warpQuality || '';
    if (weftQuality !== undefined) record.weftQuality = weftQuality || '';
    if (contractId !== undefined) record.contractId = contractId || null;
    if (contractInfo !== undefined) record.contractInfo = contractInfo || '';
    if (note !== undefined) record.note = note || '';

    await record.save();
    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE /api/yarn/:id ── Delete a record ────────────────
router.delete('/:id', async (req, res) => {
  try {
    const record = await YarnIssuance.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
