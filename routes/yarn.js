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

// ── GET /api/yarn/history/:partyNorm ── Transaction history & contract balance ──
router.get('/history/:partyNorm', async (req, res) => {
  try {
    const partyNorm = req.params.partyNorm.toLowerCase();
    const Invoice = require('../models/Invoice');

    // Fetch invoices for this party
    const invoices = await Invoice.find().lean();
    const invoiceMap = new Map();
    invoices.forEach(inv => {
      if (inv.partyName && inv.partyName.trim().toLowerCase() === partyNorm) {
        invoiceMap.set(inv._id.toString(), inv);
      }
    });

    // Fetch all yarn records for this party in chronological order (oldest first)
    const rawRecords = await YarnIssuance.find({ partyNameNorm: partyNorm })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    // Track running remaining balance per contract
    const contractBalanceMap = new Map();

    const recordsWithBalance = rawRecords.map(r => {
      const cId = (r.contractId || r.refInvoiceId)?.toString();

      // Initialize contract balance if first time processing this contract
      if (cId && invoiceMap.has(cId) && !contractBalanceMap.has(cId)) {
        const inv = invoiceMap.get(cId);
        contractBalanceMap.set(cId, {
          remWarp: Math.round(inv.yarnBagsWarp || 0),
          remWeft: Math.round(inv.yarnBagsWeft || 0),
        });
      }

      let curRemWarp = 0;
      let curRemWeft = 0;

      if (cId && contractBalanceMap.has(cId)) {
        const bal = contractBalanceMap.get(cId);

        if (r.type === 'issue') {
          // Issuing yarn deducts from contract required bags!
          bal.remWarp = Math.max(0, bal.remWarp - (r.warpBags || 0));
          bal.remWeft = Math.max(0, bal.remWeft - (r.weftBags || 0));
        }

        curRemWarp = bal.remWarp;
        curRemWeft = bal.remWeft;
      } else {
        curRemWarp = Math.max(0, (r.warpBags || 0));
        curRemWeft = Math.max(0, (r.weftBags || 0));
      }

      return {
        ...r,
        remainingWarp: curRemWarp,
        remainingWeft: curRemWeft,
        remainingTotal: curRemWarp + curRemWeft,
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

      const issuedWarp = contractIssuances.reduce((sum, i) => sum + (i.warpBags || 0), 0);
      const issuedWeft = contractIssuances.reduce((sum, i) => sum + (i.weftBags || 0), 0);

      const requiredWarp = Math.round(inv.yarnBagsWarp || 0);
      const requiredWeft = Math.round(inv.yarnBagsWeft || 0);

      const remWarpNeeded = Math.max(0, requiredWarp - issuedWarp);
      const remWeftNeeded = Math.max(0, requiredWeft - issuedWeft);

      const title = `${inv.fabricType ? inv.fabricType + ' ' : ''}Contract (Qty: ${inv.quantity || 0})`;
      const label = `${title} — Req: ${requiredWarp}W/${requiredWeft}F | Rem: ${remWarpNeeded}W/${remWeftNeeded}F`;

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
        title,
        label,
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/yarn ── Create new issuance record ──────────
router.post('/', async (req, res) => {
  try {
    const { partyName, date, warpBags, weftBags, warpQuality, weftQuality, contractId, contractInfo, note } = req.body;

    if (!partyName || !partyName.trim()) {
      return res.status(400).json({ error: 'Party name is required' });
    }

    const record = new YarnIssuance({
      partyName: partyName.trim(),
      date: date || new Date(),
      warpBags: warpBags || 0,
      weftBags: weftBags || 0,
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
      record.partyName = partyName.trim();
      record.partyNameNorm = partyName.trim().toLowerCase();
    }
    if (date) record.date = date;
    if (warpBags !== undefined) record.warpBags = warpBags || 0;
    if (weftBags !== undefined) record.weftBags = weftBags || 0;
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
