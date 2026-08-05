const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const YarnIssuance = require('../models/YarnIssuance');
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

// ── POST /api/invoices ── Create new invoice ──────────────
router.post('/', async (req, res) => {
  try {
    const {
      partyName, date, fabricType, loomType,
      warpCount, warpCountAlt, weftCount, weftCountAlt,
      reed, pick, width, widthCm,
      warpRate, weftRate, conversionRate, quantity,
    } = req.body;

    const cleanPartyName = toTitleCase(partyName);
    const cleanDate = toUtcDate(date);

    // Calculate all outputs
    const calculated = calculate({
      warpCount, weftCount, reed, pick, width,
      warpRate, weftRate, conversionRate, quantity,
    });

    const invoice = new Invoice({
      partyName: cleanPartyName, date: cleanDate, fabricType, loomType,
      warpCount, warpCountAlt, weftCount, weftCountAlt,
      reed, pick, width, widthCm,
      warpRate, weftRate, conversionRate, quantity,
      ...calculated,
    });

    await invoice.save();

    // Auto-deduct yarn bags from party stock
    if (calculated.yarnBagsWarp > 0 || calculated.yarnBagsWeft > 0) {
      const contractLabel = `${fabricType || 'Contract'} — Qty: ${quantity || 0}`;
      const deduction = new YarnIssuance({
        partyName: cleanPartyName,
        date: cleanDate,
        warpBags: calculated.yarnBagsWarp || 0,
        weftBags: calculated.yarnBagsWeft || 0,
        type: 'deduction',
        refInvoiceId: invoice._id,
        contractId: invoice._id,
        contractInfo: contractLabel,
        note: `Contract Deduction (${contractLabel})`,
      });
      await deduction.save();
    }

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

    const cleanPartyName = toTitleCase(partyName);
    const cleanDate = toUtcDate(date);

    // Recalculate
    const calculated = calculate({
      warpCount, weftCount, reed, pick, width,
      warpRate, weftRate, conversionRate, quantity,
    });

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      {
        partyName: cleanPartyName, date: cleanDate, fabricType, loomType,
        warpCount, warpCountAlt, weftCount, weftCountAlt,
        reed, pick, width, widthCm,
        warpRate, weftRate, conversionRate, quantity,
        ...calculated,
      },
      { new: true, runValidators: true }
    );

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Sync changes to YarnIssuance records linked to this contract
    const shortTitle = `${fabricType || 'Contract'}${quantity ? ' (' + Number(quantity).toLocaleString() + 'm)' : ''}`;
    const contractLabel = shortTitle;

    // 1. Update/Create auto-deduction record
    let autoDeduction = await YarnIssuance.findOne({ refInvoiceId: invoice._id, type: 'deduction' });
    if (autoDeduction) {
      autoDeduction.partyName = cleanPartyName;
      autoDeduction.partyNameNorm = cleanPartyName.toLowerCase();
      autoDeduction.date = cleanDate;
      autoDeduction.warpBags = calculated.yarnBagsWarp || 0;
      autoDeduction.weftBags = calculated.yarnBagsWeft || 0;
      autoDeduction.contractInfo = contractLabel;
      autoDeduction.note = `Contract Deduction (${contractLabel})`;
      await autoDeduction.save();
    } else if (calculated.yarnBagsWarp > 0 || calculated.yarnBagsWeft > 0) {
      autoDeduction = new YarnIssuance({
        partyName: cleanPartyName,
        date: date || new Date(),
        warpBags: calculated.yarnBagsWarp || 0,
        weftBags: calculated.yarnBagsWeft || 0,
        type: 'deduction',
        refInvoiceId: invoice._id,
        contractId: invoice._id,
        contractInfo: contractLabel,
        note: `Contract Deduction (${contractLabel})`,
      });
      await autoDeduction.save();
    }

    // 2. Update all yarn issuances targeting this contract
    await YarnIssuance.updateMany(
      { contractId: invoice._id },
      {
        $set: {
          partyName: cleanPartyName,
          partyNameNorm: cleanPartyName.toLowerCase(),
          contractInfo: contractLabel,
        }
      }
    );

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

    // Restore yarn stock by removing the deduction record linked to this invoice
    await YarnIssuance.deleteMany({ refInvoiceId: invoice._id, type: 'deduction' });

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
