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

// ── GET /api/yarn/history/:partyNorm ── Transaction history & contract fulfillment ──
router.get('/history/:partyNorm', async (req, res) => {
  try {
    const partyNorm = req.params.partyNorm.toLowerCase();
    const Invoice = require('../models/Invoice');

    // Fetch invoices for contract requirements
    const invoices = await Invoice.find().lean();
    const invoiceMap = new Map();
    invoices.forEach(inv => {
      if (inv.partyName && inv.partyName.trim().toLowerCase() === partyNorm) {
        invoiceMap.set(inv._id.toString(), inv);
      }
    });

    // Fetch records in chronological order (oldest first)
    const rawRecords = await YarnIssuance.find({ partyNameNorm: partyNorm })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    let remWarp = 0;
    let remWeft = 0;
    const contractProgress = new Map();

    const recordsWithBalance = rawRecords.map(r => {
      const wBags = r.warpBags || 0;
      const fBags = r.weftBags || 0;

      if (r.type === 'issue') {
        remWarp += wBags;
        remWeft += fBags;
      } else {
        remWarp -= wBags;
        remWeft -= fBags;
      }

      let contractReqW = null;
      let contractReqF = null;
      let contractRemW = null;
      let contractRemF = null;

      const cId = (r.contractId || r.refInvoiceId)?.toString();
      if (cId && invoiceMap.has(cId)) {
        const inv = invoiceMap.get(cId);
        contractReqW = Math.round(inv.yarnBagsWarp || 0);
        contractReqF = Math.round(inv.yarnBagsWeft || 0);

        if (!contractProgress.has(cId)) {
          contractProgress.set(cId, { issuedW: 0, issuedF: 0 });
        }
        const prog = contractProgress.get(cId);

        if (r.type === 'issue') {
          prog.issuedW += wBags;
          prog.issuedF += fBags;
        }

        contractRemW = Math.max(0, contractReqW - prog.issuedW);
        contractRemF = Math.max(0, contractReqF - prog.issuedF);
      }

      return {
        ...r,
        remainingWarp: remWarp,
        remainingWeft: remWeft,
        remainingTotal: remWarp + remWeft,
        contractReqWarp: contractReqW,
        contractReqWeft: contractReqF,
        contractRemWarp: contractRemW,
        contractRemWeft: contractRemF,
      };
    });

    res.json(recordsWithBalance.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/yarn/contracts/:partyNorm ── List contracts with remaining bags needed ──
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
      const isFulfilled = remWarpNeeded === 0 && remWeftNeeded === 0;

      const title = `${inv.fabricType ? inv.fabricType + ' ' : ''}Contract (Qty: ${inv.quantity || 0})`;
      const label = `${title} — Req: ${requiredWarp}W/${requiredWeft}F | Still Needed: ${remWarpNeeded}W/${remWeftNeeded}F`;

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
        isFulfilled,
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
