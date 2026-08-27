const express = require('express');
const router = express.Router();
const CashbookParty = require('../models/CashbookParty');
const CashbookEntry = require('../models/CashbookEntry');

// ── Helpers ────────────────────────────────────────────────
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
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const d = parseInt(slashMatch[1], 10);
    const m = parseInt(slashMatch[2], 10) - 1;
    const y = parseInt(slashMatch[3], 10);
    return new Date(Date.UTC(y, m, d, 0, 0, 0));
  }
  const dObj = new Date(str);
  if (isNaN(dObj.getTime())) return new Date();
  return new Date(Date.UTC(dObj.getFullYear(), dObj.getMonth(), dObj.getDate(), 0, 0, 0));
}

// ═══════════════════════════════════════════════════════════
//  PARTY (KHATA) ENDPOINTS
// ═══════════════════════════════════════════════════════════

// ── GET /api/cashbook/parties ── List all parties ─────────
router.get('/parties', async (req, res) => {
  try {
    const { search, type } = req.query;
    let query = {};

    if (search && search.trim()) {
      query.nameNorm = new RegExp(search.trim().toLowerCase(), 'i');
    }
    if (type && type !== 'all') {
      query.type = type;
    }

    const parties = await CashbookParty.find(query).sort({ khataNo: 1 }).lean();

    // Attach summary stats for each party
    const enriched = await Promise.all(parties.map(async (p) => {
      const entries = await CashbookEntry.find({ khataNo: p.khataNo }).lean();
      let totalNaam = 0, totalJama = 0, totalBags = 0, totalMeters = 0, txnCount = entries.length;
      entries.forEach(e => {
        totalNaam += e.naam || 0;
        totalJama += e.jama || 0;
        totalBags += e.bags || 0;
        totalMeters += e.meters || 0;
      });
      const opening = Number(p.openingBalance) || 0;
      const openingNet = (p.balanceType === 'jama' || p.balanceType === 'cash') ? opening : p.balanceType === 'banam' ? -opening : 0;
      const balance = openingNet + totalJama - totalNaam;
      return {
        ...p,
        totalNaam,
        totalJama,
        balance,
        totalBags,
        totalMeters,
        txnCount,
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/cashbook/parties/:id ── Get single party ─────
router.get('/parties/:id', async (req, res) => {
  try {
    const party = await CashbookParty.findById(req.params.id).lean();
    if (!party) return res.status(404).json({ error: 'Party not found' });
    res.json(party);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/cashbook/parties ── Create new party ────────
router.post('/parties', async (req, res) => {
  try {
    const { name, type, phone, description, note, openingBalance, balanceType } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Party name is required' });
    }

    const cleanName = toTitleCase(name);
    const existing = await CashbookParty.findOne({ nameNorm: cleanName.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: `Party "${cleanName}" already exists (#${existing.khataNo})` });
    }

    const lastParty = await CashbookParty.findOne().sort({ khataNo: -1 }).lean();
    const nextKhataNo = lastParty ? lastParty.khataNo + 1 : 1;

    const party = new CashbookParty({
      khataNo: nextKhataNo,
      name: cleanName,
      type: type || 'general',
      phone: phone || '',
      description: description || '',
      note: note || '',
      openingBalance: Number(openingBalance) || 0,
      balanceType: ['jama', 'banam', 'cash', 'none'].includes(balanceType) ? balanceType : 'none',
    });

    await party.save();
    res.status(201).json(party);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── PUT /api/cashbook/parties/:id ── Update party ─────────
router.put('/parties/:id', async (req, res) => {
  try {
    const { name, type, phone, description, note, openingBalance, balanceType } = req.body;
    const party = await CashbookParty.findById(req.params.id);
    if (!party) return res.status(404).json({ error: 'Party not found' });

    if (name && name.trim()) {
      const cleanName = toTitleCase(name);
      const existing = await CashbookParty.findOne({
        nameNorm: cleanName.toLowerCase(),
        _id: { $ne: party._id },
      });
      if (existing) {
        return res.status(400).json({ error: `Party "${cleanName}" already exists` });
      }
      party.name = cleanName;
    }
    if (type) party.type = type;
    if (phone !== undefined) party.phone = phone || '';
    if (description !== undefined) party.description = description || '';
    if (note !== undefined) party.note = note || '';
    if (openingBalance !== undefined) party.openingBalance = Number(openingBalance) || 0;
    if (balanceType !== undefined && ['jama', 'banam', 'cash', 'none'].includes(balanceType)) {
      party.balanceType = balanceType;
    }

    await party.save();

    // Sync partyName in all linked entries
    await CashbookEntry.updateMany(
      { khataNo: party.khataNo },
      { $set: { partyName: party.name, partyType: party.type } }
    );

    res.json(party);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE /api/cashbook/parties/:id ── Delete party ──────
router.delete('/parties/:id', async (req, res) => {
  try {
    const party = await CashbookParty.findById(req.params.id);
    if (!party) return res.status(404).json({ error: 'Party not found' });

    await CashbookEntry.deleteMany({ khataNo: party.khataNo });
    await CashbookParty.findByIdAndDelete(req.params.id);
    res.json({ message: 'Party deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  KHATA (PARTY HISTORY) ENDPOINTS
// ═══════════════════════════════════════════════════════════

// ── GET /api/cashbook/khata/:khataNo ── Full khata history ─
router.get('/khata/:khataNo', async (req, res) => {
  try {
    const khataNo = parseInt(req.params.khataNo, 10);
    if (isNaN(khataNo)) return res.status(400).json({ error: 'Invalid khata number' });

    const party = await CashbookParty.findOne({ khataNo }).lean();
    if (!party) return res.status(404).json({ error: 'Khata not found' });

    // Get all entries for this khata, sorted by date (oldest first for balance calc)
    const entries = await CashbookEntry.find({ khataNo })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const opening = Number(party.openingBalance) || 0;
    const initialBalance = (party.balanceType === 'jama' || party.balanceType === 'cash') ? opening : party.balanceType === 'banam' ? -opening : 0;
    let runningBalance = initialBalance;

    // Calculate running balance (remaining) starting from initial khata amount
    const entriesWithBalance = entries.map(e => {
      runningBalance += (e.jama || 0) - (e.naam || 0);
      return {
        ...e,
        remaining: runningBalance,
      };
    });

    const totalNaam = entries.reduce((s, e) => s + (e.naam || 0), 0) + (party.balanceType === 'banam' ? opening : 0);
    const totalJama = entries.reduce((s, e) => s + (e.jama || 0), 0) + ((party.balanceType === 'jama' || party.balanceType === 'cash') ? opening : 0);

    // Return newest first for display
    res.json({
      party,
      initialAmount: opening,
      initialType: party.balanceType || 'none',
      initialBalance,
      entries: entriesWithBalance.reverse(),
      summary: {
        totalNaam,
        totalJama,
        balance: runningBalance,
        totalBags: entries.reduce((s, e) => s + (e.bags || 0), 0),
        totalMeters: entries.reduce((s, e) => s + (e.meters || 0), 0),
        entryCount: entries.length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  ROKER (JOURNAL) ENDPOINTS
// ═══════════════════════════════════════════════════════════


async function getCashInHandBalance(upToRokerNo = null) {
  const cashInHandParty = await CashbookParty.findOne({
    $or: [{ khataNo: 95 }, { nameNorm: 'cash in hand' }]
  }).lean();
  if (!cashInHandParty) return 0;

  const query = { khataNo: cashInHandParty.khataNo };
  if (upToRokerNo !== null && upToRokerNo !== undefined) {
    query.rokerNo = { $lt: upToRokerNo };
  }

  const cihEntries = await CashbookEntry.find(query).lean();
  let cihNaam = 0, cihJama = 0;
  cihEntries.forEach(e => {
    cihNaam += e.naam || 0;
    cihJama += e.jama || 0;
  });
  const opening = Number(cashInHandParty.openingBalance) || 0;
  const openingNet = (cashInHandParty.balanceType === 'jama' || cashInHandParty.balanceType === 'cash') ? opening : cashInHandParty.balanceType === 'banam' ? -opening : 0;
  return openingNet + cihJama - cihNaam;
}

// ── GET /api/cashbook/rokers ── List all rokers with summaries
router.get('/rokers', async (req, res) => {
  try {
    const { search } = req.query;
    const rokers = await CashbookEntry.aggregate([
      { $match: { isAutoCounterEntry: { $ne: true } } },
      {
        $group: {
          _id: '$rokerNo',
          rokerNo: { $first: '$rokerNo' },
          date: { $first: '$date' },
          createdAt: { $first: '$createdAt' },
          entryCount: { $sum: 1 },
          totalNaam: { $sum: '$naam' },
          totalJama: { $sum: '$jama' },
          totalBags: { $sum: '$bags' },
          totalMeters: { $sum: '$meters' },
          parties: { $addToSet: '$partyName' },
        },
      },
      { $sort: { rokerNo: -1 } },
    ]);

    const enriched = await Promise.all(rokers.map(async (r) => {
      const prevCashInHand = await getCashInHandBalance(r.rokerNo);
      return {
        ...r,
        cashInHand: prevCashInHand,
        endRokerValue: (r.totalJama || 0) + prevCashInHand,
      };
    }));

    let filtered = enriched;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = enriched.filter(r => 
        String(r.rokerNo).includes(q) || 
        (r.parties && r.parties.some(p => p && p.toLowerCase().includes(q)))
      );
    }

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/cashbook/roker/:rokerNo ── All entries in a roker
router.get('/roker/:rokerNo', async (req, res) => {
  try {
    const rokerNo = parseInt(req.params.rokerNo, 10);
    if (isNaN(rokerNo)) return res.status(400).json({ error: 'Invalid roker number' });

    // Exclude internal counter entries from roker view
    const entries = await CashbookEntry.find({ rokerNo, isAutoCounterEntry: { $ne: true } })
      .sort({ createdAt: 1 })
      .lean();

    const totalNaam = entries.reduce((s, e) => s + (e.naam || 0), 0);
    const totalJama = entries.reduce((s, e) => s + (e.jama || 0), 0);
    const totalBags = entries.reduce((s, e) => s + (e.bags || 0), 0);
    const totalMeters = entries.reduce((s, e) => s + (e.meters || 0), 0);
    const date = entries[0]?.date || new Date();

    const cashInHandBalance = await getCashInHandBalance(rokerNo);
    const endRokerValue = totalJama + cashInHandBalance;

    // Calculate Bag Purchases vs Bag Sells
    const bagPurchases = entries.filter(e => e.isPurchase && (e.bags || 0) > 0);
    const bagSells = entries.filter(e => e.isSell && (e.bags || 0) > 0);
    const totalPurBags = bagPurchases.reduce((s, p) => s + (p.bags || 0), 0);
    const totalPurBagAmt = bagPurchases.reduce((s, p) => s + (p.jama || 0) + (p.naam || 0), 0);
    const totalSellBags = bagSells.reduce((s, s1) => s + (s1.bags || 0), 0);
    const totalSellBagAmt = bagSells.reduce((s, s1) => s + (s1.jama || 0) + (s1.naam || 0), 0);
    const bagDiff = totalSellBagAmt - totalPurBagAmt;
    const bagsMatch = (totalPurBags > 0 && totalPurBags === totalSellBags);

    // Calculate Meter Purchases vs Meter Sells
    const meterPurchases = entries.filter(e => e.isPurchase && (e.meters || 0) > 0);
    const meterSells = entries.filter(e => e.isSell && (e.meters || 0) > 0);
    const totalPurMeters = meterPurchases.reduce((s, p) => s + (p.meters || 0), 0);
    const totalPurMeterAmt = meterPurchases.reduce((s, p) => s + (p.jama || 0) + (p.naam || 0), 0);
    const totalSellMeters = meterSells.reduce((s, s1) => s + (s1.meters || 0), 0);
    const totalSellMeterAmt = meterSells.reduce((s, s1) => s + (s1.jama || 0) + (s1.naam || 0), 0);
    const meterDiff = totalSellMeterAmt - totalPurMeterAmt;
    const metersMatch = (totalPurMeters > 0 && totalPurMeters === totalSellMeters);

    const existingBagPL = entries.find(e => e.isAutoProfitLossEntry && e.description && e.description.includes('Bag Purchase/Sell Summary'));
    const existingMeterPL = entries.find(e => e.isAutoProfitLossEntry && e.description && e.description.includes('Meter Purchase/Sell Summary'));

    res.json({
      rokerNo,
      date,
      entries,
      summary: {
        totalNaam,
        totalJama,
        totalBags,
        totalMeters,
        cashInHand: cashInHandBalance,
        endRokerValue,
        entryCount: entries.length,
        bagSummary: {
          totalPurchaseBags: totalPurBags,
          totalPurchaseAmount: totalPurBagAmt,
          totalSellBags: totalSellBags,
          totalSellAmount: totalSellBagAmt,
          difference: bagDiff,
          bagsMatch,
          isAlreadyPosted: Boolean(existingBagPL),
          purchases: bagPurchases.map(p => ({ partyName: p.partyName, qty: p.bags, rate: p.ratePerBag, amount: (p.jama || 0) + (p.naam || 0) })),
          sells: bagSells.map(s => ({ partyName: s.partyName, qty: s.bags, rate: s.ratePerBag, amount: (s.jama || 0) + (s.naam || 0) })),
        },
        meterSummary: {
          totalPurchaseMeters: totalPurMeters,
          totalPurchaseAmount: totalPurMeterAmt,
          totalSellMeters: totalSellMeters,
          totalSellAmount: totalSellMeterAmt,
          difference: meterDiff,
          metersMatch,
          isAlreadyPosted: Boolean(existingMeterPL),
          purchases: meterPurchases.map(p => ({ partyName: p.partyName, qty: p.meters, rate: p.ratePerBag, amount: (p.jama || 0) + (p.naam || 0) })),
          sells: meterSells.map(s => ({ partyName: s.partyName, qty: s.meters, rate: s.ratePerBag, amount: (s.jama || 0) + (s.naam || 0) })),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/cashbook/roker/:rokerNo/calculate-bag-nafa-nuqsan ──
// Calculates aggregated Bag & Meter Purchases vs Sells for the roker and posts Nafa/Nuqsaan entries to Party N
router.post('/roker/:rokerNo/calculate-bag-nafa-nuqsan', async (req, res) => {
  try {
    const rokerNo = parseInt(req.params.rokerNo, 10);
    if (isNaN(rokerNo)) return res.status(400).json({ error: 'Invalid roker number' });

    const entries = await CashbookEntry.find({ rokerNo, isAutoCounterEntry: { $ne: true } }).lean();

    // Bag Summary
    const bagPurchases = entries.filter(e => e.isPurchase && (e.bags || 0) > 0);
    const bagSells = entries.filter(e => e.isSell && (e.bags || 0) > 0);
    const totalPurBags = bagPurchases.reduce((s, p) => s + (p.bags || 0), 0);
    const totalPurBagAmt = bagPurchases.reduce((s, p) => s + (p.jama || 0) + (p.naam || 0), 0);
    const totalSellBags = bagSells.reduce((s, s1) => s + (s1.bags || 0), 0);
    const totalSellBagAmt = bagSells.reduce((s, s1) => s + (s1.jama || 0) + (s1.naam || 0), 0);
    const bagDiff = totalSellBagAmt - totalPurBagAmt;
    const bagsMatch = (totalPurBags > 0 && totalPurBags === totalSellBags);

    // Meter Summary
    const meterPurchases = entries.filter(e => e.isPurchase && (e.meters || 0) > 0);
    const meterSells = entries.filter(e => e.isSell && (e.meters || 0) > 0);
    const totalPurMeters = meterPurchases.reduce((s, p) => s + (p.meters || 0), 0);
    const totalPurMeterAmt = meterPurchases.reduce((s, p) => s + (p.jama || 0) + (p.naam || 0), 0);
    const totalSellMeters = meterSells.reduce((s, s1) => s + (s1.meters || 0), 0);
    const totalSellMeterAmt = meterSells.reduce((s, s1) => s + (s1.jama || 0) + (s1.naam || 0), 0);
    const meterDiff = totalSellMeterAmt - totalPurMeterAmt;
    const metersMatch = (totalPurMeters > 0 && totalPurMeters === totalSellMeters);

    let postedBagEntry = null;
    let postedMeterEntry = null;

    if (req.body.postToN) {
      const nParty = await resolveOrCreateParty('N', null, 'general');
      if (nParty) {
        // Post Bag Summary
        if (bagsMatch && bagDiff !== 0) {
          const existingBag = await CashbookEntry.findOne({
            rokerNo,
            isAutoProfitLossEntry: true,
            description: { $regex: /Bag Purchase\/Sell Summary/i }
          });
          if (existingBag) {
            existingBag.naam = bagDiff < 0 ? Math.abs(bagDiff) : 0;
            existingBag.jama = bagDiff > 0 ? bagDiff : 0;
            existingBag.description = bagDiff > 0
              ? `Nafa (نفع) — Bag Purchase/Sell Summary (Roker #${rokerNo}: ${totalPurBags} bags)`
              : `Nuqsaan (نقصان) — Bag Purchase/Sell Summary (Roker #${rokerNo}: ${totalPurBags} bags)`;
            await existingBag.save();
            postedBagEntry = existingBag;
          } else {
            const date = entries[0]?.date || new Date();
            const bagPLEntry = new CashbookEntry({
              rokerNo,
              khataNo: nParty.khataNo,
              partyId: nParty._id,
              partyName: nParty.name,
              partyType: nParty.type,
              date: toUtcDate(date),
              description: bagDiff > 0
                ? `Nafa (نفع) — Bag Purchase/Sell Summary (Roker #${rokerNo}: ${totalPurBags} bags)`
                : `Nuqsaan (نقصان) — Bag Purchase/Sell Summary (Roker #${rokerNo}: ${totalPurBags} bags)`,
              naam: bagDiff < 0 ? Math.abs(bagDiff) : 0,
              jama: bagDiff > 0 ? bagDiff : 0,
              bags: 0,
              meters: 0,
              isAutoProfitLossEntry: true,
            });
            await bagPLEntry.save();
            postedBagEntry = bagPLEntry;
          }
        }

        // Post Meter Summary
        if (metersMatch && meterDiff !== 0) {
          const existingMeter = await CashbookEntry.findOne({
            rokerNo,
            isAutoProfitLossEntry: true,
            description: { $regex: /Meter Purchase\/Sell Summary/i }
          });
          if (existingMeter) {
            existingMeter.naam = meterDiff < 0 ? Math.abs(meterDiff) : 0;
            existingMeter.jama = meterDiff > 0 ? meterDiff : 0;
            existingMeter.description = meterDiff > 0
              ? `Nafa (نفع) — Meter Purchase/Sell Summary (Roker #${rokerNo}: ${totalPurMeters} meters)`
              : `Nuqsaan (نقصان) — Meter Purchase/Sell Summary (Roker #${rokerNo}: ${totalPurMeters} meters)`;
            await existingMeter.save();
            postedMeterEntry = existingMeter;
          } else {
            const date = entries[0]?.date || new Date();
            const meterPLEntry = new CashbookEntry({
              rokerNo,
              khataNo: nParty.khataNo,
              partyId: nParty._id,
              partyName: nParty.name,
              partyType: nParty.type,
              date: toUtcDate(date),
              description: meterDiff > 0
                ? `Nafa (نفع) — Meter Purchase/Sell Summary (Roker #${rokerNo}: ${totalPurMeters} meters)`
                : `Nuqsaan (نقصان) — Meter Purchase/Sell Summary (Roker #${rokerNo}: ${totalPurMeters} meters)`,
              naam: meterDiff < 0 ? Math.abs(meterDiff) : 0,
              jama: meterDiff > 0 ? meterDiff : 0,
              bags: 0,
              meters: 0,
              isAutoProfitLossEntry: true,
            });
            await meterPLEntry.save();
            postedMeterEntry = meterPLEntry;
          }
        }
      }
    }

    res.json({
      rokerNo,
      bagSummary: {
        totalPurchaseBags: totalPurBags,
        totalPurchaseAmount: totalPurBagAmt,
        totalSellBags: totalSellBags,
        totalSellAmount: totalSellBagAmt,
        difference: bagDiff,
        bagsMatch,
        isAlreadyPosted: Boolean(postedBagEntry),
      },
      meterSummary: {
        totalPurchaseMeters: totalPurMeters,
        totalPurchaseAmount: totalPurMeterAmt,
        totalSellMeters: totalSellMeters,
        totalSellAmount: totalSellMeterAmt,
        difference: meterDiff,
        metersMatch,
        isAlreadyPosted: Boolean(postedMeterEntry),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/cashbook/next-roker ── Get next roker number ──
router.get('/next-roker', async (req, res) => {
  try {
    const last = await CashbookEntry.findOne().sort({ rokerNo: -1 }).lean();
    res.json({ nextRokerNo: last ? last.rokerNo + 1 : 61 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  TRANSACTION (ENTRY) ENDPOINTS
// ═══════════════════════════════════════════════════════════

// ── GET /api/cashbook/entries ── List all entries ──────────
router.get('/entries', async (req, res) => {
  try {
    const { search, txnType, limit } = req.query;
    let query = {};

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { partyName: regex },
        { description: regex },
      ];
    }
    if (txnType && txnType !== 'all') {
      query.txnType = txnType;
    }

    const entries = await CashbookEntry.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) || 200)
      .lean();

    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to get or create party by name or khataNo
async function resolveOrCreateParty(partyNameInput, khataNoInput, partyTypeInput) {
  let party = null;
  if (khataNoInput) {
    party = await CashbookParty.findOne({ khataNo: parseInt(khataNoInput, 10) });
  }
  if (!party && partyNameInput && partyNameInput.trim()) {
    const cleanName = toTitleCase(partyNameInput);
    const norm = partyNameInput.trim().toLowerCase();
    party = await CashbookParty.findOne({ nameNorm: norm });
    if (!party) {
      const lastParty = await CashbookParty.findOne().sort({ khataNo: -1 }).lean();
      const nextKhataNo = lastParty ? lastParty.khataNo + 1 : 1;
      party = new CashbookParty({
        khataNo: nextKhataNo,
        name: cleanName,
        type: partyTypeInput || 'general',
      });
      await party.save();
    }
  }
  return party;
}

// ── POST /api/cashbook/entries ── Create new entry (or entries array) ────────
router.post('/entries', async (req, res) => {
  try {
    const rawEntries = Array.isArray(req.body.entries) ? req.body.entries : [req.body];
    const createdEntries = [];

    // Determine rokerNo if not supplied
    let sharedRokerNo = parseInt(req.body.rokerNo, 10);
    if (isNaN(sharedRokerNo) || sharedRokerNo <= 0) {
      const last = await CashbookEntry.findOne().sort({ rokerNo: -1 }).lean();
      sharedRokerNo = last ? last.rokerNo + 1 : 61;
    }

    for (const item of rawEntries) {
      const {
        rokerNo, khataNo, partyName, partyType, date, description, naam, jama,
        txnType, bags, meters, ratePerBag, purchaseRef, allocateRef, note,
      } = item;

      // Find or create party
      const party = await resolveOrCreateParty(partyName, khataNo, partyType);
      if (!party) {
        return res.status(400).json({ error: 'Party Name is required.' });
      }

      const naamVal = parseFloat(naam) || 0;
      const jamaVal = parseFloat(jama) || 0;
      if (naamVal > 0 && jamaVal > 0) {
        return res.status(400).json({ error: 'Entry can have either Naam or Jama, not both.' });
      }

      const finalRokerNo = (rokerNo && parseInt(rokerNo, 10) > 0) ? parseInt(rokerNo, 10) : sharedRokerNo;

      // Allocation validation if applicable
      if (txnType === 'allocate' && purchaseRef) {
        const purchase = await CashbookEntry.findById(purchaseRef).lean();
        if (purchase) {
          const existingAllocations = await CashbookEntry.find({
            purchaseRef: purchaseRef,
            txnType: 'allocate',
          }).lean();

          const allocatedBags = existingAllocations.reduce((s, e) => s + (e.bags || 0), 0);
          const allocatedAmount = existingAllocations.reduce((s, e) => s + (e.jama || 0) + (e.naam || 0), 0);
          const newBags = parseInt(bags) || 0;
          const newAmount = naamVal || jamaVal;

          if (newBags > 0 && (allocatedBags + newBags) > (purchase.bags || 0)) {
            return res.status(400).json({
              error: `Cannot allocate ${newBags} bags. Purchase has ${purchase.bags} bags, ${allocatedBags} already allocated.`
            });
          }

          const purchaseTotal = purchase.naam || purchase.jama || (purchase.bags * purchase.ratePerBag) || 0;
          if (newAmount > 0 && (allocatedAmount + newAmount) > purchaseTotal) {
            return res.status(400).json({
              error: `Cannot allocate ₹${newAmount.toLocaleString()}. Purchase total is ₹${purchaseTotal.toLocaleString()}, ₹${allocatedAmount.toLocaleString()} already allocated.`
            });
          }
        }
      }

      const isCashEntry = Boolean(item.isCash);
      const isPurchaseEntry = !isCashEntry && Boolean(item.isPurchase);
      const isSellEntry = !isCashEntry && Boolean(item.isSell);
      const linkedPurchaseId = isSellEntry ? (item.linkedPurchaseId || null) : null;

      // Sell entry validation
      const entryMeters = parseFloat(meters) || parseFloat(item.meters) || 0;
      const entryBags = parseFloat(bags) || 0;
      const tradeQty = entryMeters > 0 ? entryMeters : entryBags;

      if (isSellEntry && linkedPurchaseId) {
        const purchaseDoc = await CashbookEntry.findById(linkedPurchaseId);
        if (!purchaseDoc || !purchaseDoc.isPurchase) {
          return res.status(400).json({ error: 'Invalid purchase reference for sell entry.' });
        }
        if (tradeQty > purchaseDoc.remainingBags) {
          return res.status(400).json({
            error: `Cannot sell ${tradeQty} meters/bags. Purchase has only ${purchaseDoc.remainingBags} remaining.`
          });
        }
      }

      let parsedRate = parseFloat(ratePerBag) || 0;
      if (!parsedRate && (entryBags > 0 || entryMeters > 0)) {
        const qty = entryMeters > 0 ? entryMeters : entryBags;
        const amt = jamaVal > 0 ? jamaVal : naamVal;
        if (qty > 0 && amt > 0) {
          parsedRate = Math.round((amt / qty) * 100) / 100;
        }
      }

      const entry = new CashbookEntry({
        rokerNo: finalRokerNo,
        khataNo: party.khataNo,
        partyId: party._id,
        partyName: party.name,
        partyType: party.type,
        date: toUtcDate(date),
        description: description || '',
        naam: naamVal,
        jama: jamaVal,
        txnType: txnType || 'general',
        bags: entryBags,
        meters: entryMeters,
        ratePerBag: parsedRate,
        isCash: isCashEntry,
        purchaseRef: purchaseRef || null,
        allocateRef: allocateRef || null,
        note: note || '',
        isPurchase: isPurchaseEntry,
        isSell: isSellEntry,
        linkedPurchaseId: null,
        remainingBags: 0,
      });

      await entry.save();

      // If Cash Entry is turned ON and this is not already the Cash In Hand party
      if (isCashEntry && party.name.trim().toLowerCase() !== 'cash in hand') {
        let cashInHandParty = await CashbookParty.findOne({ nameNorm: 'cash in hand' });
        if (!cashInHandParty) {
          const lastP = await CashbookParty.findOne().sort({ khataNo: -1 }).lean();
          const nextK = lastP ? lastP.khataNo + 1 : 1;
          cashInHandParty = new CashbookParty({
            khataNo: nextK,
            name: 'Cash In Hand',
            type: 'general',
            openingBalance: 0,
            balanceType: 'none',
          });
          await cashInHandParty.save();
        }

        const counterEntry = new CashbookEntry({
          rokerNo: finalRokerNo,
          khataNo: cashInHandParty.khataNo,
          partyId: cashInHandParty._id,
          partyName: cashInHandParty.name,
          partyType: cashInHandParty.type,
          date: toUtcDate(date),
          description: `Cash — ${party.name}: ${description || 'Transaction'}`,
          naam: naamVal, // Same as party entry (Naam -> Naam)
          jama: jamaVal, // Same as party entry (Jama -> Jama)
          bags: 0,
          isCash: true,
          isAutoCounterEntry: true,
          linkedCashEntryId: entry._id,
        });

        await counterEntry.save();
        entry.linkedCashEntryId = counterEntry._id;
        await entry.save();
      }

      createdEntries.push(entry);
    }

    if (Array.isArray(req.body.entries)) {
      res.status(201).json(createdEntries);
    } else {
      res.status(201).json(createdEntries[0]);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/cashbook/entries/:id ── Get single entry ─────
router.get('/entries/:id', async (req, res) => {
  try {
    const entry = await CashbookEntry.findById(req.params.id).lean();
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/cashbook/entries/:id ── Update entry ─────────
router.put('/entries/:id', async (req, res) => {
  try {
    const entry = await CashbookEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    const oldIsSell = entry.isSell;
    const oldLinkedPurchaseId = entry.linkedPurchaseId ? String(entry.linkedPurchaseId) : null;
    const oldBags = entry.bags || 0;

    const {
      rokerNo, khataNo, partyName, partyType, date, description, naam, jama,
      bags, meters, ratePerBag, note, isCash, isPurchase, isSell, linkedPurchaseId,
    } = req.body;

    if (partyName && partyName.trim()) {
      const party = await resolveOrCreateParty(partyName, khataNo, partyType);
      if (party) {
        entry.partyId = party._id;
        entry.partyName = party.name;
        entry.khataNo = party.khataNo;
        entry.partyType = party.type;
      }
    }

    if (rokerNo && parseInt(rokerNo, 10) > 0) {
      entry.rokerNo = parseInt(rokerNo, 10);
    }

    if (date) entry.date = toUtcDate(date);
    if (description !== undefined) entry.description = description || '';
    if (naam !== undefined) entry.naam = parseFloat(naam) || 0;
    if (jama !== undefined) entry.jama = parseFloat(jama) || 0;
    if (bags !== undefined) entry.bags = parseFloat(bags) || 0;
    if (meters !== undefined) entry.meters = parseFloat(meters) || 0;
    if (ratePerBag !== undefined) entry.ratePerBag = parseFloat(ratePerBag) || 0;
    if (note !== undefined) entry.note = note || '';
    if (!entry.ratePerBag && ((entry.meters || 0) > 0 || (entry.bags || 0) > 0)) {
      const qty = (entry.meters && entry.meters > 0) ? entry.meters : (entry.bags || 0);
      const amt = (entry.jama && entry.jama > 0) ? entry.jama : (entry.naam || 0);
      if (qty > 0 && amt > 0) {
        entry.ratePerBag = Math.round((amt / qty) * 100) / 100;
      }
    }

    // Validate naam/jama
    if (entry.naam > 0 && entry.jama > 0) {
      return res.status(400).json({ error: 'Entry can have either Naam or Jama, not both.' });
    }

    const previousIsCash = entry.isCash;
    if (isCash !== undefined) {
      entry.isCash = Boolean(isCash);
    }

    if (isPurchase !== undefined) entry.isPurchase = Boolean(isPurchase);
    if (isSell !== undefined) entry.isSell = Boolean(isSell);
    entry.linkedPurchaseId = null;

    if (entry.isCash) {
      entry.isPurchase = false;
      entry.isSell = false;
      entry.linkedPurchaseId = null;
    }

    await entry.save();

    // Handle linked counter entry updates
    if (entry.partyName && entry.partyName.trim().toLowerCase() !== 'cash in hand') {
      if (entry.isCash) {
        if (entry.linkedCashEntryId) {
          const counter = await CashbookEntry.findById(entry.linkedCashEntryId);
          if (counter) {
            counter.date = entry.date;
            counter.description = `Cash — ${entry.partyName}: ${entry.description || 'Transaction'}`;
            counter.naam = entry.naam;
            counter.jama = entry.jama;
            await counter.save();
          }
        } else {
          // Newly turned ON
          let cashInHandParty = await CashbookParty.findOne({ nameNorm: 'cash in hand' });
          if (cashInHandParty) {
            const counterEntry = new CashbookEntry({
              rokerNo: entry.rokerNo,
              khataNo: cashInHandParty.khataNo,
              partyId: cashInHandParty._id,
              partyName: cashInHandParty.name,
              partyType: cashInHandParty.type,
              date: entry.date,
              description: `Cash — ${entry.partyName}: ${entry.description || 'Transaction'}`,
              naam: entry.naam,
              jama: entry.jama,
              bags: 0,
              isCash: true,
              isAutoCounterEntry: true,
              linkedCashEntryId: entry._id,
            });
            await counterEntry.save();
            entry.linkedCashEntryId = counterEntry._id;
            await entry.save();
          }
        }
      } else if (previousIsCash && !entry.isCash && entry.linkedCashEntryId) {
        // Turned OFF -> remove counter entry
        await CashbookEntry.findByIdAndDelete(entry.linkedCashEntryId);
        entry.linkedCashEntryId = null;
        await entry.save();
      }
    }

    res.json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE /api/cashbook/entries/:id ── Delete entry ──────
router.delete('/entries/:id', async (req, res) => {
  try {
    const entry = await CashbookEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    // Block deletion of purchase entries that have sell entries
    if (entry.isPurchase) {
      const sellCount = await CashbookEntry.countDocuments({ linkedPurchaseId: entry._id, isSell: true });
      if (sellCount > 0) {
        return res.status(400).json({ error: `Cannot delete this purchase. ${sellCount} sell entries exist against it. Delete sell entries first.` });
      }
      // Also delete any auto profit/loss entry
      if (entry.linkedProfitLossEntryId) {
        await CashbookEntry.findByIdAndDelete(entry.linkedProfitLossEntryId);
      }
    }

    // If deleting a sell entry, restore bags to the purchase
    if (entry.isSell && entry.linkedPurchaseId) {
      const purchaseDoc = await CashbookEntry.findById(entry.linkedPurchaseId);
      if (purchaseDoc) {
        purchaseDoc.remainingBags = (purchaseDoc.remainingBags || 0) + (entry.bags || 0);
        // If purchase had a profit/loss entry and bags are being restored, remove that entry
        if (purchaseDoc.linkedProfitLossEntryId) {
          await CashbookEntry.findByIdAndDelete(purchaseDoc.linkedProfitLossEntryId);
          purchaseDoc.linkedProfitLossEntryId = null;
        }
        await purchaseDoc.save();
      }
    }

    // If this entry has a linked counter entry, delete the counter entry too
    if (entry.linkedCashEntryId) {
      await CashbookEntry.findByIdAndDelete(entry.linkedCashEntryId);
    }
    // If this is an auto counter entry linked to a main entry, clear the parent's link
    if (entry.isAutoCounterEntry) {
      await CashbookEntry.updateOne({ linkedCashEntryId: entry._id }, { $set: { linkedCashEntryId: null, isCash: false } });
    }

    await CashbookEntry.findByIdAndDelete(req.params.id);
    res.json({ message: 'Entry deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  PURCHASE / SELL TRACKING
// ═══════════════════════════════════════════════════════════

// ── GET /api/cashbook/open-purchases ── Meter purchases with remaining meters > 0 ──
router.get('/open-purchases', async (req, res) => {
  try {
    const { includeId } = req.query;

    const meterFilter = {
      $or: [
        { meters: { $gt: 0 } },
        { bags: 0 }
      ]
    };

    let query = {
      isPurchase: true,
      remainingBags: { $gt: 0 },
      ...meterFilter
    };

    if (includeId) {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(includeId)) {
        query = {
          isPurchase: true,
          $or: [
            { remainingBags: { $gt: 0 }, $or: [{ meters: { $gt: 0 } }, { bags: 0 }] },
            { _id: new mongoose.Types.ObjectId(includeId) }
          ]
        };
      }
    }

    const purchases = await CashbookEntry.find(query)
      .sort({ date: -1, createdAt: -1 })
      .lean();
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/cashbook/purchase-sell-overview ── All purchases with sell details & roker summaries ──
router.get('/purchase-sell-overview', async (req, res) => {
  try {
    const allPurchases = await CashbookEntry.find({ isPurchase: true, isAutoProfitLossEntry: { $ne: true } })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const overview = [];

    // Group purchases by rokerNo
    const rokerMap = new Map();
    allPurchases.forEach(p => {
      if (!rokerMap.has(p.rokerNo)) rokerMap.set(p.rokerNo, []);
      rokerMap.get(p.rokerNo).push(p);
    });

    const rokerNumbers = Array.from(rokerMap.keys()).sort((a, b) => b - a);

    for (const rokerNo of rokerNumbers) {
      const rokerPurchases = rokerMap.get(rokerNo);
      const purchaseIds = rokerPurchases.map(p => p._id);
      const linkedSellsCount = await CashbookEntry.countDocuments({ linkedPurchaseId: { $in: purchaseIds }, isSell: true });

      if (linkedSellsCount > 0 && rokerNo <= 62) {
        // Render individual linked purchase cards for historical rokers
        for (const p of rokerPurchases) {
          const sells = await CashbookEntry.find({ linkedPurchaseId: p._id, isSell: true })
            .sort({ date: 1 })
            .lean();

          const isMeter = (p.meters > 0) || (p.bags === 0);
          const totalSoldBags = sells.reduce((sum, s) => sum + (s.bags || 0), 0);
          const totalSoldMeters = sells.reduce((sum, s) => sum + (s.meters || 0), 0);
          const totalSellAmount = sells.reduce((sum, s) => sum + (s.jama || 0) + (s.naam || 0), 0);
          const purchaseAmount = (p.naam || 0) + (p.jama || 0);

          const initialQty = isMeter ? (p.meters || 0) : (p.bags || 0);
          const totalSoldQty = isMeter ? totalSoldMeters : totalSoldBags;
          const remainingQty = (p.remainingBags !== undefined && p.remainingBags !== null && p.remainingBags > 0)
            ? p.remainingBags
            : Math.max(0, initialQty - totalSoldQty);

          const isFullySold = (remainingQty <= 0) && (totalSoldQty > 0);
          const profitLoss = isFullySold ? totalSellAmount - purchaseAmount : null;

          overview.push({
            ...p,
            isAggregateSummary: false,
            isMeter,
            unitLabel: isMeter ? 'meters' : 'bags',
            initialQty,
            purchaseAmount,
            sells,
            totalSoldBags,
            totalSoldMeters,
            totalSoldQty,
            totalSellAmount,
            remainingQty,
            remainingBags: remainingQty,
            isFullySold,
            profitLoss,
            sellCount: sells.length,
          });
        }
      } else {
        // Aggregate Roker Summary Cards for Roker #64 (and rokers without per-purchase linking)
        const allRokerEntries = await CashbookEntry.find({ rokerNo, isAutoCounterEntry: { $ne: true } }).lean();

        // 1) Bag Summary Card
        const bagPurchases = allRokerEntries.filter(e => e.isPurchase && (e.bags || 0) > 0);
        const bagSells = allRokerEntries.filter(e => e.isSell && (e.bags || 0) > 0);

        if (bagPurchases.length > 0 || bagSells.length > 0) {
          const totalPurBags = bagPurchases.reduce((s, p) => s + (p.bags || 0), 0);
          const totalPurBagAmt = bagPurchases.reduce((s, p) => s + (p.jama || 0) + (p.naam || 0), 0);
          const totalSellBags = bagSells.reduce((s, s1) => s + (s1.bags || 0), 0);
          const totalSellBagAmt = bagSells.reduce((s, s1) => s + (s1.jama || 0) + (s1.naam || 0), 0);
          const bagDiff = totalSellBagAmt - totalPurBagAmt;
          const bagsMatch = (totalPurBags > 0 && totalPurBags === totalSellBags);

          overview.push({
            _id: `roker-${rokerNo}-bags`,
            rokerNo,
            partyName: `📦 Roker #${rokerNo} — Bag Purchase & Sell Summary`,
            date: allRokerEntries[0]?.date || new Date(),
            isAggregateSummary: true,
            unitLabel: 'bags',
            initialQty: totalPurBags,
            purchaseAmount: totalPurBagAmt,
            totalSoldQty: totalSellBags,
            totalSellAmount: totalSellBagAmt,
            remainingQty: Math.max(0, totalPurBags - totalSellBags),
            isFullySold: bagsMatch,
            profitLoss: bagsMatch ? bagDiff : null,
            purchases: bagPurchases,
            sells: bagSells,
            sellCount: bagSells.length,
          });
        }

        // 2) Meter Summary Card
        const meterPurchases = allRokerEntries.filter(e => e.isPurchase && (e.meters || 0) > 0);
        const meterSells = allRokerEntries.filter(e => e.isSell && (e.meters || 0) > 0);

        if (meterPurchases.length > 0 || meterSells.length > 0) {
          const totalPurMeters = meterPurchases.reduce((s, p) => s + (p.meters || 0), 0);
          const totalPurMeterAmt = meterPurchases.reduce((s, p) => s + (p.jama || 0) + (p.naam || 0), 0);
          const totalSellMeters = meterSells.reduce((s, s1) => s + (s1.meters || 0), 0);
          const totalSellMeterAmt = meterSells.reduce((s, s1) => s + (s1.jama || 0) + (s1.naam || 0), 0);
          const meterDiff = totalSellMeterAmt - totalPurMeterAmt;
          const metersMatch = (totalPurMeters > 0 && totalPurMeters === totalSellMeters);

          overview.push({
            _id: `roker-${rokerNo}-meters`,
            rokerNo,
            partyName: `📏 Roker #${rokerNo} — Meter Purchase & Sell Summary`,
            date: allRokerEntries[0]?.date || new Date(),
            isAggregateSummary: true,
            unitLabel: 'meters',
            initialQty: totalPurMeters,
            purchaseAmount: totalPurMeterAmt,
            totalSoldQty: totalSellMeters,
            totalSellAmount: totalSellMeterAmt,
            remainingQty: Math.max(0, totalPurMeters - totalSellMeters),
            isFullySold: metersMatch,
            profitLoss: metersMatch ? meterDiff : null,
            purchases: meterPurchases,
            sells: meterSells,
            sellCount: meterSells.length,
          });
        }
      }
    }

    res.json(overview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  PURCHASE TRACKING (Legacy)
router.get('/purchases', async (req, res) => {
  try {
    const purchases = await CashbookEntry.find({ txnType: 'purchase' })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const enriched = await Promise.all(purchases.map(async (p) => {
      const allocations = await CashbookEntry.find({ purchaseRef: p._id, txnType: 'allocate' }).lean();
      const buybacks = await CashbookEntry.find({ purchaseRef: p._id, txnType: 'buyback' }).lean();
      const transfers = await CashbookEntry.find({ purchaseRef: p._id, txnType: 'transfer' }).lean();

      const allocatedBags = allocations.reduce((s, e) => s + (e.bags || 0), 0);
      const allocatedAmount = allocations.reduce((s, e) => s + (e.jama || 0) + (e.naam || 0), 0);
      const purchaseTotal = p.naam || p.jama || (p.bags * p.ratePerBag) || 0;

      return {
        ...p,
        purchaseTotal,
        allocatedBags,
        allocatedAmount,
        remainingBags: (p.bags || 0) - allocatedBags,
        remainingAmount: purchaseTotal - allocatedAmount,
        allocationCount: allocations.length,
        buybackCount: buybacks.length,
        transferCount: transfers.length,
        allocations,
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/cashbook/purchases/:id/status ── Purchase status
router.get('/purchases/:id/status', async (req, res) => {
  try {
    const purchase = await CashbookEntry.findById(req.params.id).lean();
    if (!purchase || purchase.txnType !== 'purchase') {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const allocations = await CashbookEntry.find({
      purchaseRef: purchase._id,
      txnType: 'allocate',
    }).sort({ date: 1 }).lean();

    // For each allocation, find buybacks/transfers
    const allocationsEnriched = await Promise.all(allocations.map(async (a) => {
      const children = await CashbookEntry.find({
        allocateRef: a._id,
        txnType: { $in: ['buyback', 'transfer'] },
      }).lean();
      return {
        ...a,
        buybacks: children.filter(c => c.txnType === 'buyback'),
        transfers: children.filter(c => c.txnType === 'transfer'),
        status: children.length > 0 ? (children[0].txnType === 'buyback' ? 'bought_back' : 'transferred') : 'pending',
      };
    }));

    const allocatedBags = allocations.reduce((s, e) => s + (e.bags || 0), 0);
    const allocatedAmount = allocations.reduce((s, e) => s + (e.jama || 0) + (e.naam || 0), 0);
    const purchaseTotal = purchase.naam || purchase.jama || (purchase.bags * purchase.ratePerBag) || 0;

    res.json({
      purchase,
      purchaseTotal,
      allocatedBags,
      allocatedAmount,
      remainingBags: (purchase.bags || 0) - allocatedBags,
      remainingAmount: purchaseTotal - allocatedAmount,
      allocations: allocationsEnriched,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  DASHBOARD STATS
// ═══════════════════════════════════════════════════════════

router.get('/dashboard', async (req, res) => {
  try {
    const [partyCount, entryCount, purchases, totalNaam, totalJama] = await Promise.all([
      CashbookParty.countDocuments(),
      CashbookEntry.countDocuments(),
      CashbookEntry.find({ txnType: 'purchase' }).lean(),
      CashbookEntry.aggregate([{ $group: { _id: null, total: { $sum: '$naam' } } }]),
      CashbookEntry.aggregate([{ $group: { _id: null, total: { $sum: '$jama' } } }]),
    ]);

    const totalPurchaseBags = purchases.reduce((s, p) => s + (p.bags || 0), 0);
    const lastRoker = await CashbookEntry.findOne().sort({ rokerNo: -1 }).lean();

    res.json({
      partyCount,
      entryCount,
      purchaseCount: purchases.length,
      totalPurchaseBags,
      totalNaam: totalNaam[0]?.total || 0,
      totalJama: totalJama[0]?.total || 0,
      lastRokerNo: lastRoker?.rokerNo || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
