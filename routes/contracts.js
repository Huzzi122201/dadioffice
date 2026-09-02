const express = require('express');
const router = express.Router();
const Contract = require('../models/Contract');
const { calculate } = require('../utils/calculator');

// ── GET /api/contracts ── List all contracts
router.get('/', async (req, res) => {
  try {
    const { q, status } = req.query;
    let query = {};
    if (status) query.status = status;

    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      const numQ = Number(q.trim());
      const orConditions = [
        { purchaserName: regex },
        { sellerName: regex },
        { quality: regex },
        { broker: regex },
        { gudamMuqam: regex },
        { note: regex }
      ];
      if (!isNaN(numQ)) {
        orConditions.push({ contractNo: numQ });
      }
      query.$or = orConditions;
    }

    const contracts = await Contract.find(query).sort({ contractNo: -1 }).lean();
    res.json(contracts);
  } catch (err) {
    console.error('Error fetching contracts:', err);
    res.status(500).json({ error: 'Failed to fetch contracts', details: err.message });
  }
});

// ── GET /api/contracts/:id ── Single contract detail
router.get('/:id', async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id).lean();
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    res.json(contract);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch contract', details: err.message });
  }
});

// ── POST /api/contracts ── Create new contract
router.post('/', async (req, res) => {
  try {
    const {
      date,
      purchaserName,
      sellerName,
      warpCount,
      weftCount,
      reed,
      pick,
      width,
      quality,
      quantity,
      quantityUnit,
      broker,
      deliveryType,
      deliveryDate,
      warpRate,
      weftRate,
      conversion,
      rate,
      rateType,
      gudamMuqam,
      note,
      status
    } = req.body;

    if (!purchaserName || !sellerName) {
      return res.status(400).json({ error: 'Purchaser Name and Seller Name are required.' });
    }

    // Auto calculate next contractNo
    const lastContract = await Contract.findOne().sort({ contractNo: -1 }).lean();
    const nextNo = lastContract && lastContract.contractNo ? lastContract.contractNo + 1 : 1;

    // Optional calculation if rate not provided or auto-calc requested
    let finalRate = Number(rate) || 0;
    if ((!finalRate || rateType === 'calculated') && warpCount > 0 && weftCount > 0) {
      const calcResult = calculate({
        warpCount: Number(warpCount),
        weftCount: Number(weftCount),
        reed: Number(reed),
        pick: Number(pick),
        width: Number(width),
        warpRate: Number(warpRate),
        weftRate: Number(weftRate),
        conversionRate: Number(conversion),
        quantity: Number(quantity)
      });
      finalRate = calcResult.totalCostMeter || 0;
    }

    const contractDate = date ? new Date(date) : new Date();
    let finalDeliveryDate = contractDate;
    if (deliveryType === 'amdan' && deliveryDate) {
      finalDeliveryDate = new Date(deliveryDate);
    } else if (deliveryType === 'hazar') {
      finalDeliveryDate = contractDate;
    }

    const newContract = new Contract({
      contractNo: nextNo,
      date: contractDate,
      purchaserName: purchaserName.trim(),
      sellerName: sellerName.trim(),
      warpCount: Number(warpCount) || 0,
      weftCount: Number(weftCount) || 0,
      reed: Number(reed) || 0,
      pick: Number(pick) || 0,
      width: Number(width) || 0,
      quality: (quality || '').trim(),
      quantity: Number(quantity) || 0,
      quantityUnit: quantityUnit || 'Meters',
      broker: (broker || '').trim(),
      deliveryType: deliveryType === 'amdan' ? 'amdan' : 'hazar',
      deliveryDate: finalDeliveryDate,
      warpRate: Number(warpRate) || 0,
      weftRate: Number(weftRate) || 0,
      conversion: Number(conversion) || 0,
      rate: finalRate,
      rateType: rateType || 'manual',
      gudamMuqam: (gudamMuqam || '').trim(),
      note: (note || '').trim(),
      status: status || 'active'
    });

    const saved = await newContract.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('Error creating contract:', err);
    res.status(500).json({ error: 'Failed to create contract', details: err.message });
  }
});

// ── PUT /api/contracts/:id ── Update contract
router.put('/:id', async (req, res) => {
  try {
    const {
      date,
      purchaserName,
      sellerName,
      warpCount,
      weftCount,
      reed,
      pick,
      width,
      quality,
      quantity,
      quantityUnit,
      broker,
      deliveryType,
      deliveryDate,
      warpRate,
      weftRate,
      conversion,
      rate,
      rateType,
      gudamMuqam,
      note,
      status
    } = req.body;

    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    if (purchaserName) contract.purchaserName = purchaserName.trim();
    if (sellerName) contract.sellerName = sellerName.trim();
    if (date) contract.date = new Date(date);
    if (warpCount !== undefined) contract.warpCount = Number(warpCount) || 0;
    if (weftCount !== undefined) contract.weftCount = Number(weftCount) || 0;
    if (reed !== undefined) contract.reed = Number(reed) || 0;
    if (pick !== undefined) contract.pick = Number(pick) || 0;
    if (width !== undefined) contract.width = Number(width) || 0;
    if (quality !== undefined) contract.quality = quality.trim();
    if (quantity !== undefined) contract.quantity = Number(quantity) || 0;
    if (quantityUnit !== undefined) contract.quantityUnit = quantityUnit;
    if (broker !== undefined) contract.broker = broker.trim();
    if (deliveryType !== undefined) {
      contract.deliveryType = deliveryType === 'amdan' ? 'amdan' : 'hazar';
      if (contract.deliveryType === 'hazar') {
        contract.deliveryDate = contract.date;
      } else if (deliveryDate) {
        contract.deliveryDate = new Date(deliveryDate);
      }
    } else if (deliveryDate) {
      contract.deliveryDate = new Date(deliveryDate);
    }
    if (warpRate !== undefined) contract.warpRate = Number(warpRate) || 0;
    if (weftRate !== undefined) contract.weftRate = Number(weftRate) || 0;
    if (conversion !== undefined) contract.conversion = Number(conversion) || 0;
    if (rate !== undefined) contract.rate = Number(rate) || 0;
    if (rateType !== undefined) contract.rateType = rateType;
    if (gudamMuqam !== undefined) contract.gudamMuqam = gudamMuqam.trim();
    if (note !== undefined) contract.note = note.trim();
    if (status !== undefined) contract.status = status;

    const updated = await contract.save();
    res.json(updated);
  } catch (err) {
    console.error('Error updating contract:', err);
    res.status(500).json({ error: 'Failed to update contract', details: err.message });
  }
});

// ── DELETE /api/contracts/:id ── Delete contract
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Contract.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Contract not found' });
    res.json({ message: 'Contract deleted successfully', contract: deleted });
  } catch (err) {
    console.error('Error deleting contract:', err);
    res.status(500).json({ error: 'Failed to delete contract', details: err.message });
  }
});

module.exports = router;
