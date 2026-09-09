const express = require('express');
const router = express.Router();
const PartyEntry = require('../models/PartyEntry');

// ── GET /api/party-entries ── List all entries with optional filters
router.get('/', async (req, res) => {
  try {
    const { q, status, partyName, startDate, endDate } = req.query;
    let query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (partyName && partyName.trim()) {
      query.partyNameNorm = partyName.trim().toLowerCase();
    }

    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      query.$or = [
        { partyName: regex },
        { variety: regex },
        { contractNo: regex },
        { note: regex }
      ];
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

    const entries = await PartyEntry.find(query).sort({ date: -1, createdAt: -1 }).lean();

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
      totalSafiGazana += e.safiGazana || 0;
      totalKachaGazana += e.kachaGazana || 0;
      totalAmount += e.totalAmount || 0;
      totalAmountWithoutGst += e.totalAmountWithoutGst || Math.round((e.safiGazana || 0) * (e.rate || 0) * 100) / 100;
      totalAdvance += e.advance || 0;
      totalRemaining += e.remaining || 0;
      if (e.status === 'completed') {
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
      matchStage.partyName = new RegExp(q.trim(), 'i');
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
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          completedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          lastDate: { $max: '$date' },
          lastVariety: { $last: '$variety' }
        }
      },
      { $sort: { partyName: 1 } }
    ]);

    res.json(aggregation);
  } catch (err) {
    console.error('Error fetching party summaries:', err);
    res.status(500).json({ error: 'Failed to fetch party summaries', details: err.message });
  }
});

// ── GET /api/party-entries/party/:partyName ── Details and entries for a single party
router.get('/party/:partyName', async (req, res) => {
  try {
    const norm = req.params.partyName.trim().toLowerCase();
    const entries = await PartyEntry.find({ partyNameNorm: norm }).sort({ date: -1, createdAt: -1 }).lean();

    let totalSafiGazana = 0;
    let totalKachaGazana = 0;
    let totalAmount = 0;
    let totalAmountWithoutGst = 0;
    let totalAdvance = 0;
    let totalRemaining = 0;
    let activeCount = 0;
    let completedCount = 0;
    let partyDisplayName = req.params.partyName;

    entries.forEach(e => {
      partyDisplayName = e.partyName || partyDisplayName;
      totalSafiGazana += e.safiGazana || 0;
      totalKachaGazana += e.kachaGazana || 0;
      totalAmount += e.totalAmount || 0;
      totalAmountWithoutGst += e.totalAmountWithoutGst || Math.round((e.safiGazana || 0) * (e.rate || 0) * 100) / 100;
      totalAdvance += e.advance || 0;
      totalRemaining += e.remaining || 0;
      if (e.status === 'completed') {
        completedCount++;
      } else {
        activeCount++;
      }
    });

    res.json({
      partyName: partyDisplayName,
      partyNameNorm: norm,
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
    console.error('Error fetching party ledger:', err);
    res.status(500).json({ error: 'Failed to fetch party ledger', details: err.message });
  }
});

// ── GET /api/party-entries/:id ── Single entry detail
router.get('/:id', async (req, res) => {
  try {
    const entry = await PartyEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Party entry not found' });

    // Auto-reconcile if entry is completed but missing its final settlement payment
    if (entry.status === 'completed') {
      const adv = Number(entry.advance) || 0;
      const installmentsTotal = (entry.paymentHistory || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const totalRec = Math.round((adv + installmentsTotal) * 100) / 100;
      const currentRemaining = Math.max(0, Math.round((entry.totalAmount - totalRec) * 100) / 100);

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

    if (!partyName || !partyName.trim()) {
      return res.status(400).json({ error: 'Banaam Party Name is required.' });
    }

    const safi = Number(safiGazana) || 0;
    // The entered rate is without GST (rate)
    const enteredRateWO = Number(rate !== undefined ? rate : (gstRate ? gstRate / 1.18 : 0)) || 0;
    const finalRateWO = Math.round(enteredRateWO * 100) / 100;
    const finalGstRate = Math.round(finalRateWO * 1.18 * 100) / 100;
    const totalWithGst = Math.round(safi * finalGstRate * 100) / 100;
    const totalWithoutGst = Math.round(safi * finalRateWO * 100) / 100;
    const selectedRateType = rateType === 'kachy' ? 'kachy' : 'pakay';
    const totalBill = selectedRateType === 'kachy' ? totalWithoutGst : totalWithGst;
    const adv = Number(advance) || 0;
    const rem = Math.max(0, Math.round((totalBill - adv) * 100) / 100);

    let finalStatus = status || 'active';
    if (rem <= 0 && totalBill > 0) {
      finalStatus = 'completed';
    }

    const newEntry = new PartyEntry({
      date: date ? new Date(date) : new Date(),
      partyName: partyName.trim(),
      partyNameNorm: partyName.trim().toLowerCase(),
      variety: (variety || '').trim(),
      kachaGazana: Number(kachaGazana) || 0,
      safiGazana: safi,
      rate: finalRateWO,
      rateType: selectedRateType,
      gstRate: finalGstRate,
      loomWala: (loomWala || '').trim(),
      purchaser: (purchaser || '').trim(),
      gudaam: (gudaam || '').trim(),
      totalAmount: totalBill,
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
    if (partyName) {
      entry.partyName = partyName.trim();
      entry.partyNameNorm = partyName.trim().toLowerCase();
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
    const isKachy = entry.rateType === 'kachy';
    entry.totalAmount = isKachy ? entry.totalAmountWithoutGst : Math.round(safi * (entry.gstRate || 0) * 100) / 100;
    const total = entry.totalAmount;
    const adv = entry.advance || 0;

    if (status === 'active') {
      entry.status = 'active';
      if (Array.isArray(entry.paymentHistory)) {
        entry.paymentHistory = entry.paymentHistory.filter(
          p => !p.note || (!p.note.includes('Paid Amount') && !p.note.includes('Final Settlement') && !p.note.includes('مکمل ادائیگی'))
        );
      }
      const installmentsTotal = entry.paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const totalRec = Math.round((adv + installmentsTotal) * 100) / 100;
      entry.remaining = Math.max(0, Math.round((total - totalRec) * 100) / 100);
    } else if (status === 'completed') {
      entry.status = 'completed';
      entry.remaining = 0;
    } else {
      const installmentsTotal = (entry.paymentHistory || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const totalRec = Math.round((adv + installmentsTotal) * 100) / 100;
      const rem = Math.max(0, Math.round((total - totalRec) * 100) / 100);
      entry.remaining = rem;
      if (rem <= 0 && total > 0) {
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

    // Append to payment history without changing original advance
    entry.paymentHistory.push({
      date: date ? new Date(date) : new Date(),
      amount: payAmt,
      note: (note || '').trim(),
      receivedBy: (receivedBy || '').trim()
    });

    const installmentsTotal = entry.paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalRec = Math.round((entry.advance + installmentsTotal) * 100) / 100;
    entry.remaining = Math.max(0, Math.round((entry.totalAmount - totalRec) * 100) / 100);

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

    const installmentsTotal = entry.paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalRec = Math.round((entry.advance + installmentsTotal) * 100) / 100;
    entry.remaining = Math.max(0, Math.round((entry.totalAmount - totalRec) * 100) / 100);

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

// ── PATCH /api/party-entries/:id/status ── Toggle or set status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const entry = await PartyEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Party entry not found' });

    const targetStatus = (status && ['active', 'completed'].includes(status))
      ? status
      : (entry.status === 'active' ? 'completed' : 'active');

    entry.status = targetStatus;

    if (targetStatus === 'completed') {
      const adv = Number(entry.advance) || 0;
      const installmentsTotal = (entry.paymentHistory || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const totalRec = Math.round((adv + installmentsTotal) * 100) / 100;
      const currentRemaining = Math.max(0, Math.round((entry.totalAmount - totalRec) * 100) / 100);

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
      entry.remaining = Math.max(0, Math.round((entry.totalAmount - totalRec) * 100) / 100);
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

module.exports = router;
