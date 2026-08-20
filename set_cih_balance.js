const mongoose = require('mongoose');
require('dotenv').config();

const CashbookParty = require('./models/CashbookParty');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const cr = await CashbookParty.findOne({ nameNorm: 'cash rocker' });
  const crAmount = cr ? cr.openingBalance : 38928419;

  await CashbookParty.updateOne(
    { nameNorm: 'cash in hand' },
    { $set: { openingBalance: crAmount, balanceType: 'cash' } }
  );

  const cih = await CashbookParty.findOne({ nameNorm: 'cash in hand' });
  console.log(`Updated Cash In Hand with initial value ₹ ${cih.openingBalance.toLocaleString('en-IN')}:`, cih);
  process.exit(0);
}

run();
