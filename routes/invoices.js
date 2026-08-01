const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const { calculate } = require('../utils/calculator');

// ── GET /api/invoices ── List all (with optional search) ──
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search && search.trim()) {
      const term = search.trim();
      const regex = new RegExp(term, 'i');
      const numVal = parseFloat(term.replace(/,/g, ''));

      const orConditions = [
        { partyName: regex },
        { fabricType: regex },
        { loomType: regex },
      ];

      if (!isNaN(numVal)) {
        orConditions.push({ quantity: numVal });
      }

      query = { $or: orConditions };
    }

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/invoices/:id ── Get single invoice ───────────
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).lean();
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/invoices ── Create new invoice ──────────────
router.post('/', async (req, res) => {
  try {
    const {
      partyName, date, fabricType, loomType,
      warpCount, warpCountAlt, weftCount, weftCountAlt,
      reed, pick, width, widthCm,
      warpRate, weftRate, conversionRate, quantity,
    } = req.body;

    // Calculate all outputs
    const calculated = calculate({
      warpCount, weftCount, reed, pick, width,
      warpRate, weftRate, conversionRate, quantity,
    });

    const invoice = new Invoice({
      partyName, date, fabricType, loomType,
      warpCount, warpCountAlt, weftCount, weftCountAlt,
      reed, pick, width, widthCm,
      warpRate, weftRate, conversionRate, quantity,
      ...calculated,
    });

    await invoice.save();
    res.status(201).json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── PUT /api/invoices/:id ── Update invoice ───────────────
router.put('/:id', async (req, res) => {
  try {
    const {
      partyName, date, fabricType, loomType,
      warpCount, warpCountAlt, weftCount, weftCountAlt,
      reed, pick, width, widthCm,
      warpRate, weftRate, conversionRate, quantity,
    } = req.body;

    // Recalculate
    const calculated = calculate({
      warpCount, weftCount, reed, pick, width,
      warpRate, weftRate, conversionRate, quantity,
    });

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      {
        partyName, date, fabricType, loomType,
        warpCount, warpCountAlt, weftCount, weftCountAlt,
        reed, pick, width, widthCm,
        warpRate, weftRate, conversionRate, quantity,
        ...calculated,
      },
      { new: true, runValidators: true }
    );

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE /api/invoices/:id ── Delete invoice ────────────
router.delete('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/invoices/actions/export ── Export all as JSON ─
router.get('/actions/export', async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 }).lean();
    res.setHeader('Content-Disposition', 'attachment; filename=invoices-backup.json');
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
