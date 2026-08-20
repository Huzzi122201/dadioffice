const mongoose = require('mongoose');
require('dotenv').config();

const CashbookParty = require('./models/CashbookParty');
const CashbookEntry = require('./models/CashbookEntry');

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);

  const cih = await CashbookParty.findOne({ nameNorm: 'cash in hand' });
  const cr = await CashbookParty.findOne({ nameNorm: 'cash rocker' });

  console.log('Cash In Hand:', cih);
  console.log('Cash Rocker:', cr);

  // All entries
  const allEntries = await CashbookEntry.find({}).lean();
  console.log(`Total entries: ${allEntries.length}`);

  for (const e of allEntries) {
    console.log(`Entry #${e._id} | Roker #${e.rokerNo} | Party: ${e.partyName} (khata #${e.khataNo}) | Naam: ${e.naam} | Jama: ${e.jama} | isCash: ${e.isCash} | isAutoCounterEntry: ${e.isAutoCounterEntry} | linkedCashEntryId: ${e.linkedCashEntryId}`);
  }

  process.exit(0);
}

fix();
