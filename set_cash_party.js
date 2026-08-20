const mongoose = require('mongoose');
require('dotenv').config();

const CashbookParty = require('./models/CashbookParty');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    let cashInHand = await CashbookParty.findOne({ nameNorm: 'cash in hand' });
    if (!cashInHand) {
      const last = await CashbookParty.findOne().sort({ khataNo: -1 }).lean();
      const nextKhataNo = last ? last.khataNo + 1 : 1;
      cashInHand = new CashbookParty({
        khataNo: nextKhataNo,
        name: 'Cash In Hand',
        type: 'general',
        openingBalance: 0,
        balanceType: 'cash',
      });
      await cashInHand.save();
    } else {
      cashInHand.balanceType = 'cash';
      await cashInHand.save();
    }

    console.log(`Cash In Hand party updated to balanceType: 'cash' (Khata #${cashInHand.khataNo})`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
