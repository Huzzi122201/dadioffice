const express = require('express');
const router = express.Router();
const PartyEntry = require('../models/PartyEntry');
const GeneralPayment = require('../models/GeneralPayment');

// ── GET /api/party-entries ── List all entries with optional filters
router.get('/', async (req, res) => {
  try {
    const { q, status, partyName, startDate, endDate } = req.query;
    let query = {};

    if (status && status !== 'all') {
      if (status === 'completed') {
        query.status = 'completed';
        query.safiGazana = { $gt: 0 };
      } else if (status === 'active') {
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { status: 'active' },
            { safiGazana: { $lte: 0 } },
            { safiGazana: null },
            { safiGazana: { $exists: false } }
          ]
        });
      } else {
        query.status = status;
      }
    }

    if (partyName && partyName.trim()) {
      query.partyNameNorm = partyName.trim().toLowerCase();
    }

    if (q && q.trim()) {
      const qTrim = q.trim();
      const escapedQ = qTrim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedQ, 'i');
      const orConditions = [
        { partyName: regex },
        { variety: regex },
        { contractNo: regex },
        { note: regex },
        { purchaser: regex },
        { loomWala: regex },
        { gudaam: regex }
      ];

      const numVal = parseFloat(qTrim);
      if (!isNaN(numVal)) {
        orConditions.push({ safiGazana: numVal });
        orConditions.push({ kachaGazana: numVal });
      }

      orConditions.push({
        $expr: {
          $or: [
            {
              $regexMatch: {
                input: { $toString: { $ifNull: ['$safiGazana', ''] } },
                regex: escapedQ,
                options: 'i'
              }
            },
            {
              $regexMatch: {
                input: { $toString: { $ifNull: ['$kachaGazana', ''] } },
                regex: escapedQ,
                options: 'i'
              }
            }
          ]
        }
      });

      query.$and = query.$and || [];
      query.$and.push({ $or: orConditions });
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        query.date.$lte = eDate;
      }
    }

    const limit = parseInt(req.query.limit) || 200;
    const entries = await PartyEntry.find(query).sort({ date: -1, createdAt: -1 }).limit(limit).lean();

    // Summary calculation for this filtered set
    let totalSafiGazana = 0;
    let totalKachaGazana = 0;
    let totalAmount = 0;
    let totalAmountWithoutGst = 0;
    let totalAdvance = 0;
    let totalRemaining = 0;
    let activeCount = 0;
    let completedCount = 0;

    entries.forEach(e => {
      const safi = Number(e.safiGazana) || 0;
      const rateWO = Number(e.rate) || (e.gstRate ? Math.round((Number(e.gstRate) / 1.18) * 100) / 100 : 0);
      const rateW = Number(e.gstRate) || (rateWO ? Math.round(rateWO * 1.18 * 100) / 100 : 0);
      const wGst = Math.round(safi * rateW * 100) / 100;
      const woGst = Math.round(safi * rateWO * 100) / 100;
      if (e.partyNameNorm === 'default party' || (e.partyName && e.partyName.toLowerCase() === 'default party')) {
        e.partyName = 'Daily Entries';
        e.partyNameNorm = 'daily entries';
      }

      e.totalAmountWithoutGst = woGst;
      e.totalAmount = wGst;
      e.rate = rateWO;
      e.gstRate = rateW;

      totalSafiGazana += safi;
      totalKachaGazana += e.kachaGazana || 0;
      totalAmount += wGst;
      totalAmountWithoutGst += woGst;
      totalAdvance += e.advance || 0;
      totalRemaining += e.remaining || 0;
      if (e.status === 'completed' && safi > 0) {
        completedCount++;
      } else {
        activeCount++;
      }
    });

    res.json({
      entries,
      summary: {
        totalEntries: entries.length,
        totalSafiGazana: Math.round(totalSafiGazana * 100) / 100,
        totalKachaGazana: Math.round(totalKachaGazana * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        totalAmountWithoutGst: Math.round(totalAmountWithoutGst * 100) / 100,
        totalAdvance: Math.round(totalAdvance * 100) / 100,
        totalRemaining: Math.round(totalRemaining * 100) / 100,
        activeCount,
        completedCount
      }
    });
  } catch (err) {
    console.error('Error fetching party entries:', err);
    res.status(500).json({ error: 'Failed to fetch party entries', details: err.message });
  }
});

// ── GET /api/party-entries/parties ── Group by party with totals
router.get('/parties', async (req, res) => {
  try {
    const { q } = req.query;
    let matchStage = {};
    if (q && q.trim()) {
      const qTrim = q.trim();
      const escapedQ = qTrim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedQ, 'i');
      const orConditions = [
        { partyName: regex },
        { variety: regex },
        { contractNo: regex },
        { purchaser: regex },
        { loomWala: regex },
        { gudaam: regex }
      ];

      const numVal = parseFloat(qTrim);
      if (!isNaN(numVal)) {
        orConditions.push({ safiGazana: numVal });
        orConditions.push({ kachaGazana: numVal });
      }

      orConditions.push({
        $expr: {
          $or: [
            {
              $regexMatch: {
                input: { $toString: { $ifNull: ['$safiGazana', ''] } },
                regex: escapedQ,
                options: 'i'
              }
            },
            {
              $regexMatch: {
                input: { $toString: { $ifNull: ['$kachaGazana', ''] } },
                regex: escapedQ,
                options: 'i'
              }
            }
          ]
        }
      });

      matchStage.$or = orConditions;
    }

    const aggregation = await PartyEntry.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$partyNameNorm',
          partyName: { $first: '$partyName' },
          totalEntries: { $sum: 1 },
          totalSafiGazana: { $sum: '$safiGazana' },
          totalKachaGazana: { $sum: '$kachaGazana' },
          totalAmount: { $sum: '$totalAmount' },
          totalAdvance: { $sum: '$advance' },
          totalRemaining: { $sum: '$remaining' },
          activeCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$status', 'active'] },
                    { $lte: ['$safiGazana', 0] },
                    { $eq: ['$safiGazana', null] }
                  ]
                },
                1,
                0
              ]
            }
          },
          completedCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'completed'] },
                    { $gt: ['$safiGazana', 0] }
                  ]
                },
                1,
                0
              ]
            }
          },
          lastDate: { $max: '$date' },
          lastVariety: { $last: '$variety' }
        }
      },
      { $sort: { partyName: 1 } }
    ]);

    aggregation.forEach(p => {
      if (p._id === 'default party' || (p.partyName && p.partyName.toLowerCase() === 'default party')) {
        p._id = 'daily entries';
        p.partyName = 'Daily Entries';
      }
    });

    if (q && q.trim()) {
      const qLower = q.trim().toLowerCase();
      const wordRegex = new RegExp(`(?:^|[\\s\\-_/.#(])${q.trim().replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`, 'i');
      aggregation.sort((a, b) => {
        const aName = (a.partyName || '').toLowerCase();
        const bName = (b.partyName || '').toLowerCase();

        // 1. Exact match
        const aExact = aName === qLower;
        const bExact = bName === qLower;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // 2. Starts with query
        const aStarts = aName.startsWith(qLower);
        const bStarts = bName.startsWith(qLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        if (aStarts && bStarts) {
          return aName.length - bName.length || aName.localeCompare(bName);
        }

        // 3. Word starts with query
        const aWord = wordRegex.test(aName);
        const bWord = wordRegex.test(bName);
        if (aWord && !bWord) return -1;
        if (!aWord && bWord) return 1;
        if (aWord && bWord) {
          return aName.length - bName.length || aName.localeCompare(bName);
        }

        return aName.localeCompare(bName);
      });
    }

    res.json(aggregation);
  } catch (err) {
    console.error('Error fetching party summaries:', err);
    res.status(500).json({ error: 'Failed to fetch party summaries', details: err.message });
  }
});

// ── GET /api/party-entries/party/:partyName ── Details and entries for a single party
router.get('/party/:partyName', async (req, res) => {
  try {
    let norm = req.params.partyName.trim().toLowerCase();
    const queryNorms = (norm === 'default party' || norm === 'daily entries')
      ? ['default party', 'daily entries']
      : [norm];
    const [entries, generalPayments] = await Promise.all([
      PartyEntry.find({ partyNameNorm: { $in: queryNorms } }).sort({ date: -1, createdAt: -1 }).lean(),
      GeneralPayment.find({ partyNameNorm: { $in: queryNorms } }).sort({ date: -1, createdAt: -1 }).lean()
    ]);

    let totalSafiGazana = 0;
    let totalKachaGazana = 0;
    let totalAmount = 0;
    let totalAmountWithoutGst = 0;
    let totalAdvance = 0;
    let totalRemaining = 0;
    let activeCount = 0;
    let completedCount = 0;
    let partyDisplayName = (norm === 'default party' || norm === 'daily entries') ? 'Daily Entries' : req.params.partyName;

    entries.forEach(e => {
      if (e.partyNameNorm === 'default party' || (e.partyName && e.partyName.toLowerCase() === 'default party')) {
        e.partyName = 'Daily Entries';
        e.partyNameNorm = 'daily entries';
      }
      partyDisplayName = e.partyName || partyDisplayName;
      const safi = Number(e.safiGazana) || 0;
      const rateWO = Number(e.rate) || (e.gstRate ? Math.round((Number(e.gstRate) / 1.18) * 100) / 100 : 0);
      const rateW = Number(e.gstRate) || (rateWO ? Math.round(rateWO * 1.18 * 100) / 100 : 0);
      const wGst = Math.round(safi * rateW * 100) / 100;
      const woGst = Math.round(safi * rateWO * 100) / 100;

      e.totalAmountWithoutGst = woGst;
      e.totalAmount = wGst;
      e.rate = rateWO;
      e.gstRate = rateW;

      totalSafiGazana += safi;
      totalKachaGazana += e.kachaGazana || 0;
      totalAmount += wGst;
      totalAmountWithoutGst += woGst;
      totalAdvance += e.advance || 0;
      totalRemaining += e.remaining || 0;
      if (e.status === 'completed' && safi > 0) {
        completedCount++;
      } else {
        activeCount++;
      }
    });

    res.json({
      partyName: partyDisplayName,
      partyNameNorm: norm,
      entries,
      generalPayments,
      summary: {
        totalEntries: entries.length,
        totalSafiGazana: Math.round(totalSafiGazana * 100) / 100,
        totalKachaGazana: Math.round(totalKachaGazana * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        totalAmountWithoutGst: Math.round(totalAmountWithoutGst * 100) / 100,
        totalAdvance: Math.round(totalAdvance * 100) / 100,
        totalRemaining: Math.round(totalRemaining * 100) / 100,
        activeCount,
        completedCount
      }
    });
  } catch (err) {
    console.error('Error fetching party ledger:', err);
    res.status(500).json({ error: 'Failed to fetch party ledger', details: err.message });
  }
});

// ── GET /api/party-entries/:id ── Single entry detail
router.get('/:id', async (req, res) => {
  try {
    const entry = await PartyEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Party entry not found' });

    const safi = Number(entry.safiGazana) || 0;
    const rateWO = Number(entry.rate) || (entry.gstRate ? Math.round((Number(entry.gstRate) / 1.18) * 100) / 100 : 0);
    const rateW = Number(entry.gstRate) || (rateWO ? Math.round(rateWO * 1.18 * 100) / 100 : 0);
    entry.totalAmountWithoutGst = Math.round(safi * rateWO * 100) / 100;
    entry.totalAmount = Math.round(safi * rateW * 100) / 100;
    const billableTotal = entry.rateType === 'kachy' ? entry.totalAmountWithoutGst : entry.totalAmount;

    // Auto-reconcile if entry is completed but missing its final settlement payment
    if (entry.status === 'completed') {
      const adv = Number(entry.advance) || 0;
      const installmentsTotal = (entry.paymentHistory || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const totalRec = Math.round((adv + installmentsTotal) * 100) / 100;
      const currentRemaining = Math.max(0, Math.round((billableTotal - totalRec) * 100) / 100);

      if (currentRemaining > 0) {
        if (!Array.isArray(entry.paymentHistory)) {
          entry.paymentHistory = [];
        }
        entry.paymentHistory.push({
          amount: currentRemaining,
          date: new Date(),
          note: 'Paid Amount',
          receivedBy: 'Office'
        });
        entry.remaining = 0;
        await entry.save();
      }
    }

    res.json(entry.toObject ? entry.toObject() : entry);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch entry', details: err.message });
  }
});

// ── POST /api/party-entries ── Create new party entry
router.post('/', async (req, res) => {
  try {
    const {
      date,
      partyName,
      variety,
      kachaGazana,
      safiGazana,
      rate,
      gstRate,
      rateType,
      loomWala,
      purchaser,
      gudaam,
      advance,
      contractNo,
      note,
      status
    } = req.body;

    let resolvedPartyName = (partyName && partyName.trim()) ? partyName.trim() : 'Daily Entries';
    if (resolvedPartyName.toLowerCase() === 'default party') {
      resolvedPartyName = 'Daily Entries';
    }

    const safi = Number(safiGazana) || 0;
    // The entered rate is without GST (rate)
    const enteredRateWO = Number(rate !== undefined ? rate : (gstRate ? gstRate / 1.18 : 0)) || 0;
    const finalRateWO = Math.round(enteredRateWO * 100) / 100;
    const finalGstRate = Math.round(finalRateWO * 1.18 * 100) / 100;
    const totalWithGst = Math.round(safi * finalGstRate * 100) / 100;
    const totalWithoutGst = Math.round(safi * finalRateWO * 100) / 100;
    const selectedRateType = rateType === 'kachy' ? 'kachy' : 'pakay';
    const billableTotal = selectedRateType === 'kachy' ? totalWithoutGst : totalWithGst;
    const adv = Number(advance) || 0;
    const rem = Math.max(0, Math.round((billableTotal - adv) * 100) / 100);

    let finalStatus = status || 'active';
    if (safi <= 0) {
      finalStatus = 'active';
    } else if (rem <= 0 && billableTotal > 0) {
      finalStatus = 'completed';
    }

    const newEntry = new PartyEntry({
      date: date ? new Date(date) : new Date(),
      partyName: resolvedPartyName,
      partyNameNorm: resolvedPartyName.toLowerCase(),
      variety: (variety || '').trim(),
      kachaGazana: Number(kachaGazana) || 0,
      safiGazana: safi,
      rate: finalRateWO,
      rateType: selectedRateType,
      gstRate: finalGstRate,
      loomWala: (loomWala || '').trim(),
      purchaser: (purchaser || '').trim(),
      gudaam: (gudaam || '').trim(),
      totalAmount: totalWithGst,
      totalAmountWithoutGst: totalWithoutGst,
      advance: adv,
      remaining: rem,
      contractNo: (contractNo || '').toString().trim(),
      note: (note || '').trim(),
      status: finalStatus,
      paymentHistory: []
    });

    const saved = await newEntry.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('Error creating party entry:', err);
    res.status(500).json({ error: 'Failed to create party entry', details: err.message });
  }
});

// ── PUT /api/party-entries/:id ── Update entry
router.put('/:id', async (req, res) => {
  try {
    const {
      date,
      partyName,
      variety,
      kachaGazana,
      safiGazana,
      rate,
      gstRate,
      rateType,
      loomWala,
      purchaser,
      gudaam,
      advance,
      contractNo,
      note,
      status
    } = req.body;

    const entry = await PartyEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Party entry not found' });

    if (date) entry.date = new Date(date);
    if (partyName !== undefined) {
      let resolvedPartyName = (partyName && partyName.trim()) ? partyName.trim() : 'Daily Entries';
      if (resolvedPartyName.toLowerCase() === 'default party') {
        resolvedPartyName = 'Daily Entries';
      }
      entry.partyName = resolvedPartyName;
      entry.partyNameNorm = resolvedPartyName.toLowerCase();
    }
    if (variety !== undefined) entry.variety = (variety || '').trim();
    if (kachaGazana !== undefined) entry.kachaGazana = Number(kachaGazana) || 0;
    if (safiGazana !== undefined) entry.safiGazana = Number(safiGazana) || 0;
    if (rate !== undefined || gstRate !== undefined) {
      if (rate !== undefined) {
        entry.rate = Math.round(Number(rate) * 100) / 100;
        entry.gstRate = Math.round(entry.rate * 1.18 * 100) / 100;
      } else if (gstRate !== undefined) {
        entry.gstRate = Math.round(Number(gstRate) * 100) / 100;
        entry.rate = Math.round((entry.gstRate / 1.18) * 100) / 100;
      }
    }
    if (rateType !== undefined) entry.rateType = rateType;
    if (loomWala !== undefined) entry.loomWala = (loomWala || '').trim();
    if (purchaser !== undefined) entry.purchaser = (purchaser || '').trim();
    if (gudaam !== undefined) entry.gudaam = (gudaam || '').trim();
    if (advance !== undefined) entry.advance = Number(advance) || 0;
    if (contractNo !== undefined) entry.contractNo = (contractNo || '').toString().trim();
    if (note !== undefined) entry.note = (note || '').trim();

    const safi = entry.safiGazana || 0;
    entry.totalAmountWithoutGst = Math.round(safi * (entry.rate || 0) * 100) / 100;
    entry.totalAmount = Math.round(safi * (entry.gstRate || 0) * 100) / 100;
    const billableTotal = entry.rateType === 'kachy' ? entry.totalAmountWithoutGst : entry.totalAmount;
    const adv = entry.advance || 0;

    if (safi <= 0) {
      entry.status = 'active';
      entry.remaining = 0;
    } else if (status === 'active') {
      entry.status = 'active';
      if (Array.isArray(entry.paymentHistory)) {
        entry.paymentHistory = entry.paymentHistory.filter(
          p => !p.note || (!p.note.includes('Paid Amount') && !p.note.includes('Final Settlement') && !p.note.includes('مکمل ادائیگی'))
        );
      }
      const installmentsTotal = entry.paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const totalRec = Math.round((adv + installmentsTotal) * 100) / 100;
      entry.remaining = Math.max(0, Math.round((billableTotal - totalRec) * 100) / 100);
    } else if (status === 'completed') {
      entry.status = 'completed';
      entry.remaining = 0;
    } else {
      const installmentsTotal = (entry.paymentHistory || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const totalRec = Math.round((adv + installmentsTotal) * 100) / 100;
      const rem = Math.max(0, Math.round((billableTotal - totalRec) * 100) / 100);
      entry.remaining = rem;
      if (rem <= 0 && billableTotal > 0) {
        entry.status = 'completed';
      }
    }

    const updated = await entry.save();
    res.json(updated);
  } catch (err) {
    console.error('Error updating party entry:', err);
    res.status(500).json({ error: 'Failed to update party entry', details: err.message });
  }
});

// ── POST /api/party-entries/:id/payment ── Record additional installment payment
router.post('/:id/payment', async (req, res) => {
  try {
    const { amount, date, note, receivedBy } = req.body;
    const payAmt = Number(amount);

    if (!payAmt || payAmt <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required.' });
    }

    const entry = await PartyEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Party entry not found' });

    const safi = Number(entry.safiGazana) || 0;
    const rateWO = Number(entry.rate) || (entry.gstRate ? Math.round((Number(entry.gstRate) / 1.18) * 100) / 100 : 0);
    const rateW = Number(entry.gstRate) || (rateWO ? Math.round(rateWO * 1.18 * 100) / 100 : 0);
    entry.totalAmountWithoutGst = Math.round(safi * rateWO * 100) / 100;
    entry.totalAmount = Math.round(safi * rateW * 100) / 100;
    const billableTotal = entry.rateType === 'kachy' ? entry.totalAmountWithoutGst : entry.totalAmount;

    // Append to payment history without changing original advance
    entry.paymentHistory.push({
      date: date ? new Date(date) : new Date(),
      amount: payAmt,
      note: (note || '').trim(),
      receivedBy: (receivedBy || '').trim()
    });

    const installmentsTotal = entry.paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalRec = Math.round((entry.advance + installmentsTotal) * 100) / 100;
    entry.remaining = Math.max(0, Math.round((billableTotal - totalRec) * 100) / 100);

    if (entry.remaining <= 0) {
      entry.status = 'completed';
    }

    const updated = await entry.save();
    res.json(updated);
  } catch (err) {
    console.error('Error recording payment:', err);
    res.status(500).json({ error: 'Failed to record payment', details: err.message });
  }
});

// ── DELETE /api/party-entries/:id/payment/:paymentId ── Delete installment payment
router.delete('/:id/payment/:paymentId', async (req, res) => {
  try {
    const entry = await PartyEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Party entry not found' });

    entry.paymentHistory = entry.paymentHistory.filter(
      p => p._id.toString() !== req.params.paymentId
    );

    const safi = Number(entry.safiGazana) || 0;
    const rateWO = Number(entry.rate) || (entry.gstRate ? Math.round((Number(entry.gstRate) / 1.18) * 100) / 100 : 0);
    const rateW = Number(entry.gstRate) || (rateWO ? Math.round(rateWO * 1.18 * 100) / 100 : 0);
    entry.totalAmountWithoutGst = Math.round(safi * rateWO * 100) / 100;
    entry.totalAmount = Math.round(safi * rateW * 100) / 100;
    const billableTotal = entry.rateType === 'kachy' ? entry.totalAmountWithoutGst : entry.totalAmount;

    const installmentsTotal = entry.paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalRec = Math.round((entry.advance + installmentsTotal) * 100) / 100;
    entry.remaining = Math.max(0, Math.round((billableTotal - totalRec) * 100) / 100);

    if (entry.remaining > 0 && entry.status === 'completed') {
      entry.status = 'active';
    }

    const updated = await entry.save();
    res.json(updated);
  } catch (err) {
    console.error('Error deleting payment:', err);
    res.status(500).json({ error: 'Failed to delete payment', details: err.message });
  }
});

// ── PUT /api/party-entries/:id/payment/:paymentId ── Edit installment payment
router.put('/:id/payment/:paymentId', async (req, res) => {
  try {
    const { amount, date, note, receivedBy } = req.body;
    const entry = await PartyEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Party entry not found' });

    const payItem = (entry.paymentHistory || []).find(
      p => p._id.toString() === req.params.paymentId
    );
    if (!payItem) return res.status(404).json({ error: 'Payment record not found' });

    if (amount !== undefined) {
      const payAmt = Number(amount);
      if (!payAmt || payAmt <= 0) {
        return res.status(400).json({ error: 'Valid payment amount is required.' });
      }
      payItem.amount = payAmt;
    }
    if (date) payItem.date = new Date(date);
    if (note !== undefined) payItem.note = (note || '').trim();
    if (receivedBy !== undefined) payItem.receivedBy = (receivedBy || '').trim();

    const safi = Number(entry.safiGazana) || 0;
    const rateWO = Number(entry.rate) || (entry.gstRate ? Math.round((Number(entry.gstRate) / 1.18) * 100) / 100 : 0);
    const rateW = Number(entry.gstRate) || (rateWO ? Math.round(rateWO * 1.18 * 100) / 100 : 0);
    entry.totalAmountWithoutGst = Math.round(safi * rateWO * 100) / 100;
    entry.totalAmount = Math.round(safi * rateW * 100) / 100;
    const billableTotal = entry.rateType === 'kachy' ? entry.totalAmountWithoutGst : entry.totalAmount;

    const installmentsTotal = entry.paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalRec = Math.round(((entry.advance || 0) + installmentsTotal) * 100) / 100;
    entry.remaining = Math.max(0, Math.round((billableTotal - totalRec) * 100) / 100);

    if (entry.remaining <= 0) {
      entry.status = 'completed';
    } else {
      entry.status = 'active';
    }

    const updated = await entry.save();
    res.json(updated);
  } catch (err) {
    console.error('Error updating payment:', err);
    res.status(500).json({ error: 'Failed to update payment', details: err.message });
  }
});

// ── POST /api/party-entries/party/:partyName/general-payment ── General party-level payment (distributed across entries)
router.post('/party/:partyName/general-payment', async (req, res) => {
  try {
    const { amount, date, note } = req.body;
    const payAmt = Number(amount);

    if (!payAmt || payAmt <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required.' });
    }

    let norm = req.params.partyName.trim().toLowerCase();
    const queryNorms = (norm === 'default party' || norm === 'daily entries')
      ? ['default party', 'daily entries']
      : [norm];

    // Find all active entries with remaining > 0, oldest first
    const entries = await PartyEntry.find({
      partyNameNorm: { $in: queryNorms },
      status: 'active',
      remaining: { $gt: 0 }
    }).sort({ date: 1, createdAt: 1 });

    if (entries.length === 0) {
      return res.status(400).json({ error: 'No active entries with outstanding balance found for this party.' });
    }

    const totalOutstanding = entries.reduce((sum, e) => sum + (e.remaining || 0), 0);
    if (payAmt > Math.round(totalOutstanding * 100) / 100 + 0.01) {
      return res.status(400).json({
        error: `Payment amount (₹${payAmt.toLocaleString()}) exceeds total outstanding balance (₹${totalOutstanding.toLocaleString()}).`
      });
    }

    // Save the original general payment record
    const partyDisplayName = entries[0].partyName || req.params.partyName;
    const savedPayment = await GeneralPayment.create({
      partyName: partyDisplayName,
      partyNameNorm: norm,
      date: date ? new Date(date) : new Date(),
      amount: payAmt,
      note: (note || '').trim()
    });

    let remainingPayment = payAmt;
    const affectedEntries = [];

    for (const entry of entries) {
      if (remainingPayment <= 0) break;

      const deduction = Math.min(remainingPayment, entry.remaining);
      remainingPayment = Math.round((remainingPayment - deduction) * 100) / 100;

      const payNote = note ? `[General] ${note.trim()}` : '[General] Party Payment';
      entry.paymentHistory.push({
        date: date ? new Date(date) : new Date(),
        amount: deduction,
        note: payNote,
        receivedBy: '',
        generalPaymentId: savedPayment._id
      });

      const safi = Number(entry.safiGazana) || 0;
      const rateWO = Number(entry.rate) || (entry.gstRate ? Math.round((Number(entry.gstRate) / 1.18) * 100) / 100 : 0);
      const rateW = Number(entry.gstRate) || (rateWO ? Math.round(rateWO * 1.18 * 100) / 100 : 0);
      entry.totalAmountWithoutGst = Math.round(safi * rateWO * 100) / 100;
      entry.totalAmount = Math.round(safi * rateW * 100) / 100;
      const billableTotal = entry.rateType === 'kachy' ? entry.totalAmountWithoutGst : entry.totalAmount;

      const installmentsTotal = entry.paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const totalRec = Math.round(((entry.advance || 0) + installmentsTotal) * 100) / 100;
      entry.remaining = Math.max(0, Math.round((billableTotal - totalRec) * 100) / 100);

      if (entry.remaining <= 0) {
        entry.status = 'completed';
      }

      await entry.save();
      affectedEntries.push({
        _id: entry._id,
        variety: entry.variety,
        deduction,
        newRemaining: entry.remaining,
        newStatus: entry.status
      });
    }

    res.json({
      message: `General payment of ₹${payAmt.toLocaleString()} distributed across ${affectedEntries.length} entries.`,
      totalPaid: payAmt,
      generalPaymentId: savedPayment._id,
      affectedEntries
    });
  } catch (err) {
    console.error('Error recording general party payment:', err);
    res.status(500).json({ error: 'Failed to record general payment', details: err.message });
  }
});

// ── DELETE /api/party-entries/general-payment/:id ── Delete a general payment & restore entry balances
router.delete('/general-payment/:id', async (req, res) => {
  try {
    const gp = await GeneralPayment.findById(req.params.id);
    if (!gp) return res.status(404).json({ error: 'General payment not found' });

    let norm = gp.partyNameNorm || (gp.partyName || '').trim().toLowerCase();
    const queryNorms = (norm === 'default party' || norm === 'daily entries')
      ? ['default party', 'daily entries']
      : [norm];

    const entries = await PartyEntry.find({
      partyNameNorm: { $in: queryNorms },
      'paymentHistory.0': { $exists: true }
    });

    const gpIdStr = gp._id.toString();
    const cleanNote = gp.note ? `[General] ${gp.note.trim()}` : '[General] Party Payment';
    const gpTime = new Date(gp.createdAt || gp.date).getTime();

    let totalRestored = 0;
    for (const entry of entries) {
      let modified = false;
      const initialLen = entry.paymentHistory.length;

      entry.paymentHistory = entry.paymentHistory.filter(p => {
        // Direct link match
        if (p.generalPaymentId && p.generalPaymentId.toString() === gpIdStr) {
          totalRestored += p.amount || 0;
          modified = true;
          return false;
        }
        // Fallback match for legacy items without generalPaymentId
        if (!p.generalPaymentId && p.note === cleanNote) {
          const pTime = new Date(p.createdAt || p.date).getTime();
          if (Math.abs(pTime - gpTime) < 60000) {
            totalRestored += p.amount || 0;
            modified = true;
            return false;
          }
        }
        return true;
      });

      if (modified || entry.paymentHistory.length !== initialLen) {
        const safi = Number(entry.safiGazana) || 0;
        const rateWO = Number(entry.rate) || (entry.gstRate ? Math.round((Number(entry.gstRate) / 1.18) * 100) / 100 : 0);
        const rateW = Number(entry.gstRate) || (rateWO ? Math.round(rateWO * 1.18 * 100) / 100 : 0);
        entry.totalAmountWithoutGst = Math.round(safi * rateWO * 100) / 100;
        entry.totalAmount = Math.round(safi * rateW * 100) / 100;
        const billableTotal = entry.rateType === 'kachy' ? entry.totalAmountWithoutGst : entry.totalAmount;

        const installmentsTotal = entry.paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const totalRec = Math.round(((entry.advance || 0) + installmentsTotal) * 100) / 100;
        entry.remaining = Math.max(0, Math.round((billableTotal - totalRec) * 100) / 100);

        if (entry.remaining > 0 && entry.status === 'completed') {
          entry.status = 'active';
        }

        await entry.save();
      }
    }

    await GeneralPayment.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: `Deleted general payment of ₹${gp.amount.toLocaleString()} and restored ₹${totalRestored.toLocaleString()} balance.`,
      removedAmount: gp.amount
    });
  } catch (err) {
    console.error('Error deleting general payment:', err);
    res.status(500).json({ error: 'Failed to delete general payment', details: err.message });
  }
});

// ── PUT /api/party-entries/general-payment/:id ── Edit a general payment (date, note, amount)
router.put('/general-payment/:id', async (req, res) => {
  try {
    const { amount, date, note } = req.body;
    const gp = await GeneralPayment.findById(req.params.id);
    if (!gp) return res.status(404).json({ error: 'General payment not found' });

    const newAmt = amount !== undefined ? Number(amount) : gp.amount;
    const newDate = date ? new Date(date) : gp.date;
    const newNote = note !== undefined ? note.trim() : gp.note;

    if (!newAmt || newAmt <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required.' });
    }

    const gpIdStr = gp._id.toString();
    const oldCleanNote = gp.note ? `[General] ${gp.note.trim()}` : '[General] Party Payment';
    const newCleanNote = newNote ? `[General] ${newNote.trim()}` : '[General] Party Payment';
    const gpTime = new Date(gp.createdAt || gp.date).getTime();

    let norm = gp.partyNameNorm || (gp.partyName || '').trim().toLowerCase();
    const queryNorms = (norm === 'default party' || norm === 'daily entries')
      ? ['default party', 'daily entries']
      : [norm];

    // If amount is unchanged, simply update date and note in GeneralPayment and linked history items
    if (Math.abs(newAmt - gp.amount) < 0.01) {
      gp.date = newDate;
      gp.note = newNote;
      await gp.save();

      const entries = await PartyEntry.find({
        partyNameNorm: { $in: queryNorms },
        'paymentHistory.0': { $exists: true }
      });

      for (const entry of entries) {
        let modified = false;
        entry.paymentHistory.forEach(p => {
          if ((p.generalPaymentId && p.generalPaymentId.toString() === gpIdStr) ||
              (!p.generalPaymentId && p.note === oldCleanNote && Math.abs(new Date(p.createdAt || p.date).getTime() - gpTime) < 60000)) {
            p.date = newDate;
            p.note = newCleanNote;
            p.generalPaymentId = gp._id;
            modified = true;
          }
        });
        if (modified) await entry.save();
      }

      return res.json({ success: true, generalPayment: gp });
    }

    // If amount is changed:
    // 1. Remove previous distribution from paymentHistory
    const entries = await PartyEntry.find({
      partyNameNorm: { $in: queryNorms }
    });

    for (const entry of entries) {
      let modified = false;
      const initialLen = (entry.paymentHistory || []).length;
      entry.paymentHistory = (entry.paymentHistory || []).filter(p => {
        if (p.generalPaymentId && p.generalPaymentId.toString() === gpIdStr) {
          modified = true;
          return false;
        }
        if (!p.generalPaymentId && p.note === oldCleanNote && Math.abs(new Date(p.createdAt || p.date).getTime() - gpTime) < 60000) {
          modified = true;
          return false;
        }
        return true;
      });

      if (modified || entry.paymentHistory.length !== initialLen) {
        const safi = Number(entry.safiGazana) || 0;
        const rateWO = Number(entry.rate) || (entry.gstRate ? Math.round((Number(entry.gstRate) / 1.18) * 100) / 100 : 0);
        const rateW = Number(entry.gstRate) || (rateWO ? Math.round(rateWO * 1.18 * 100) / 100 : 0);
        entry.totalAmountWithoutGst = Math.round(safi * rateWO * 100) / 100;
        entry.totalAmount = Math.round(safi * rateW * 100) / 100;
        const billableTotal = entry.rateType === 'kachy' ? entry.totalAmountWithoutGst : entry.totalAmount;
        const installmentsTotal = entry.paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const totalRec = Math.round(((entry.advance || 0) + installmentsTotal) * 100) / 100;
        entry.remaining = Math.max(0, Math.round((billableTotal - totalRec) * 100) / 100);
        if (entry.remaining > 0 && entry.status === 'completed') {
          entry.status = 'active';
        }
        await entry.save();
      }
    }

    // 2. Redistribute new amount across active entries with remaining > 0 (oldest first)
    const activeEntries = await PartyEntry.find({
      partyNameNorm: { $in: queryNorms },
      status: 'active',
      remaining: { $gt: 0 }
    }).sort({ date: 1, createdAt: 1 });

    let remainingPayment = newAmt;
    for (const entry of activeEntries) {
      if (remainingPayment <= 0) break;
      const deduction = Math.min(remainingPayment, entry.remaining);
      remainingPayment = Math.round((remainingPayment - deduction) * 100) / 100;

      entry.paymentHistory.push({
        date: newDate,
        amount: deduction,
        note: newCleanNote,
        receivedBy: '',
        generalPaymentId: gp._id
      });

      const safi = Number(entry.safiGazana) || 0;
      const rateWO = Number(entry.rate) || (entry.gstRate ? Math.round((Number(entry.gstRate) / 1.18) * 100) / 100 : 0);
      const rateW = Number(entry.gstRate) || (rateWO ? Math.round(rateWO * 1.18 * 100) / 100 : 0);
      entry.totalAmountWithoutGst = Math.round(safi * rateWO * 100) / 100;
      entry.totalAmount = Math.round(safi * rateW * 100) / 100;
      const billableTotal = entry.rateType === 'kachy' ? entry.totalAmountWithoutGst : entry.totalAmount;
      const installmentsTotal = entry.paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const totalRec = Math.round(((entry.advance || 0) + installmentsTotal) * 100) / 100;
      entry.remaining = Math.max(0, Math.round((billableTotal - totalRec) * 100) / 100);
      if (entry.remaining <= 0) {
        entry.status = 'completed';
      }
      await entry.save();
    }

    gp.amount = newAmt;
    gp.date = newDate;
    gp.note = newNote;
    await gp.save();

    res.json({ success: true, generalPayment: gp });
  } catch (err) {
    console.error('Error updating general payment:', err);
    res.status(500).json({ error: 'Failed to update general payment', details: err.message });
  }
});

// ── PATCH /api/party-entries/:id/status ── Toggle or set status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const entry = await PartyEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Party entry not found' });

    const targetStatus = (status && ['active', 'completed'].includes(status))
      ? status
      : (entry.status === 'active' ? 'completed' : 'active');

    if (targetStatus === 'completed' && (Number(entry.safiGazana) || 0) <= 0) {
      return res.status(400).json({ error: 'Cannot mark entry as completed when Safi Gazana is empty or 0.' });
    }

    entry.status = targetStatus;

    const safi = Number(entry.safiGazana) || 0;
    const rateWO = Number(entry.rate) || (entry.gstRate ? Math.round((Number(entry.gstRate) / 1.18) * 100) / 100 : 0);
    const rateW = Number(entry.gstRate) || (rateWO ? Math.round(rateWO * 1.18 * 100) / 100 : 0);
    entry.totalAmountWithoutGst = Math.round(safi * rateWO * 100) / 100;
    entry.totalAmount = Math.round(safi * rateW * 100) / 100;
    const billableTotal = entry.rateType === 'kachy' ? entry.totalAmountWithoutGst : entry.totalAmount;

    if (targetStatus === 'completed') {
      const adv = Number(entry.advance) || 0;
      const installmentsTotal = (entry.paymentHistory || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const totalRec = Math.round((adv + installmentsTotal) * 100) / 100;
      const currentRemaining = Math.max(0, Math.round((billableTotal - totalRec) * 100) / 100);

      if (currentRemaining > 0) {
        if (!Array.isArray(entry.paymentHistory)) {
          entry.paymentHistory = [];
        }
        entry.paymentHistory.push({
          amount: currentRemaining,
          date: new Date(),
          note: 'Paid Amount',
          receivedBy: 'Office'
        });
      }
      entry.remaining = 0;
    } else if (targetStatus === 'active') {
      if (Array.isArray(entry.paymentHistory)) {
        entry.paymentHistory = entry.paymentHistory.filter(
          p => !p.note || (!p.note.includes('Paid Amount') && !p.note.includes('Final Settlement') && !p.note.includes('مکمل ادائیگی'))
        );
      }
      const adv = Number(entry.advance) || 0;
      const installmentsTotal = (entry.paymentHistory || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const totalRec = Math.round((adv + installmentsTotal) * 100) / 100;
      entry.remaining = Math.max(0, Math.round((billableTotal - totalRec) * 100) / 100);
      entry.status = 'active';
    }

    const updated = await entry.save();
    res.json(updated);
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ error: 'Failed to update status', details: err.message });
  }
});

// ── DELETE /api/party-entries/:id ── Delete entry
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await PartyEntry.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Party entry not found' });
    res.json({ message: 'Party entry deleted successfully', entry: deleted });
  } catch (err) {
    console.error('Error deleting party entry:', err);
    res.status(500).json({ error: 'Failed to delete party entry', details: err.message });
  }
});


// ── PUT /api/party-entries/party/:partyName/rename ── Rename a party across all entries
router.put('/party/:partyName/rename', async (req, res) => {
  try {
    const oldNorm = req.params.partyName.trim().toLowerCase();
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
      return res.status(400).json({ error: 'New party name is required.' });
    }

    const newNameTrimmed = newName.trim();
    const newNorm = newNameTrimmed.toLowerCase();

    if (oldNorm === newNorm) {
      return res.status(400).json({ error: 'New name is the same as the old name.' });
    }

    const queryNorms = (oldNorm === 'default party' || oldNorm === 'daily entries')
      ? ['default party', 'daily entries']
      : [oldNorm];

    // Check if a party with the new name already exists
    const existingParty = await PartyEntry.findOne({ partyNameNorm: newNorm });
    if (existingParty && !queryNorms.includes(newNorm)) {
      return res.status(409).json({ error: `A party with the name "${newNameTrimmed}" already exists. Please choose a different name.` });
    }

    const escapedOld = req.params.partyName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const oldRegex = new RegExp(`^${escapedOld}$`, 'i');

    // Update all PartyEntry documents with the old name
    const entryResult = await PartyEntry.updateMany(
      { $or: [{ partyNameNorm: { $in: queryNorms } }, { partyName: oldRegex }] },
      { $set: { partyName: newNameTrimmed, partyNameNorm: newNorm } }
    );

    // Update purchaser, gudaam, and loomWala fields where old name was used
    await Promise.all([
      PartyEntry.updateMany(
        { purchaser: oldRegex },
        { $set: { purchaser: newNameTrimmed } }
      ),
      PartyEntry.updateMany(
        { gudaam: oldRegex },
        { $set: { gudaam: newNameTrimmed } }
      ),
      PartyEntry.updateMany(
        { loomWala: oldRegex },
        { $set: { loomWala: newNameTrimmed } }
      )
    ]);

    // Update all GeneralPayment documents with the old name
    const paymentResult = await GeneralPayment.updateMany(
      { $or: [{ partyNameNorm: { $in: queryNorms } }, { partyName: oldRegex }] },
      { $set: { partyName: newNameTrimmed, partyNameNorm: newNorm } }
    );

    res.json({
      message: `Party renamed successfully.`,
      entriesUpdated: entryResult.modifiedCount,
      paymentsUpdated: paymentResult.modifiedCount
    });
  } catch (err) {
    console.error('Error renaming party:', err);
    res.status(500).json({ error: 'Failed to rename party', details: err.message });
  }
});

module.exports = router;

