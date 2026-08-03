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

// ── GET /api/yarn/history/:partyNorm ── Transaction history for a party ──
router.get('/history/:partyNorm', async (req, res) => {
  try {
    const partyNorm = req.params.partyNorm.toLowerCase();
    // Fetch in chronological order (oldest first) to calculate line-by-line running stock balance
    const rawRecords = await YarnIssuance.find({ partyNameNorm: partyNorm })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    let remWarp = 0;
    let remWeft = 0;

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

      return {
        ...r,
        remainingWarp: remWarp,
        remainingWeft: remWeft,
        remainingTotal: remWarp + remWeft,
      };
    });

    // Return in reverse order (newest first) for presentation
    res.json(recordsWithBalance.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/yarn ── Create new issuance record ──────────
router.post('/', async (req, res) => {
  try {
    const { partyName, date, warpBags, weftBags, warpQuality, weftQuality, note } = req.body;

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
