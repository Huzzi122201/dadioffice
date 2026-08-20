const mongoose = require('mongoose');
require('dotenv').config();

const CashbookParty = require('./models/CashbookParty');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  await CashbookParty.updateOne(
    { nameNorm: 'cash in hand' },
    { $set: { openingBalance: 0, balanceType: 'cash' } }
  );
  const cih = await CashbookParty.findOne({ nameNorm: 'cash in hand' });
  console.log('Updated Cash In Hand:', cih);
  process.exit(0);
}

run();
