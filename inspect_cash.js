const mongoose = require('mongoose');
require('dotenv').config();

const CashbookParty = require('./models/CashbookParty');
const CashbookEntry = require('./models/CashbookEntry');

async function inspect() {
  await mongoose.connect(process.env.MONGODB_URI);
  const parties = await CashbookParty.find({}).lean();
  const cih = parties.find(p => p.nameNorm === 'cash in hand');
  const cr = parties.find(p => p.nameNorm === 'cash rocker');

  console.log('Cash In Hand party:', cih);
  console.log('Cash Rocker party:', cr);

  if (cih) {
    const cihEntries = await CashbookEntry.find({ khataNo: cih.khataNo }).lean();
    console.log(`CIH entries (${cihEntries.length}):`, cihEntries);
  }

  process.exit(0);
}

inspect();
