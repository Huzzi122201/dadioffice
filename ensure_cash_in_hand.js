const mongoose = require('mongoose');
require('dotenv').config();

const CashbookParty = require('./models/CashbookParty');
const CashbookEntry = require('./models/CashbookEntry');

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
        balanceType: 'none',
      });
      await cashInHand.save();
      console.log(`Created Cash In Hand party with Khata #${cashInHand.khataNo}`);
    } else {
      console.log(`Cash In Hand already exists with Khata #${cashInHand.khataNo}`);
    }

    // If there were any previous counter entries for 'Cash Rocker', re-link them to 'Cash In Hand'
    const cashRocker = await CashbookParty.findOne({ nameNorm: 'cash rocker' });
    if (cashRocker) {
      const updatedEntries = await CashbookEntry.updateMany(
        { partyId: cashRocker._id, isAutoCounterEntry: true },
        { 
          $set: { 
            partyId: cashInHand._id, 
            khataNo: cashInHand.khataNo, 
            partyName: 'Cash In Hand' 
          } 
        }
      );
      console.log(`Re-linked ${updatedEntries.modifiedCount} counter entries to Cash In Hand.`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
