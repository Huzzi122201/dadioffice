const mongoose = require('mongoose');
require('dotenv').config();

const CashbookParty = require('./models/CashbookParty');
const CashbookEntry = require('./models/CashbookEntry');

const creditParties = [
  { name: 'IbrahimII', jama: 421925 },
  { name: 'Usama Faisal', jama: 833510 },
  { name: 'Basit Qammar', jama: 2072274 },
  { name: 'Jawad Aftab', jama: 2307000 },
  { name: 'Rehman A/C', jama: 1666574 },
  { name: 'Subhania Umer', jama: 586180 },
  { name: 'Usama Huzaifa', jama: 11977750 },
  { name: 'Naveed Munawar', jama: 2890535 },
  { name: 'Amin Asif', jama: 3953210 },
  { name: 'N.A', jama: 100000000 },
  { name: 'Safdar Sahab', jama: 7916410 },
  { name: 'Hussain Sabir', jama: 1047195 },
  { name: 'Dukan Karaya', jama: 197600 },
  { name: 'N', jama: 30034891 },
  { name: 'Nadeem Lasani', jama: 14879085 },
  { name: 'Kwist Gudaam', jama: 278515 },
  { name: 'Altaf Lasani', jama: 4041425 },
  { name: 'Abdullah Suleman', jama: 3082730 },
  { name: 'Fahad Zain', jama: 648750 },
  { name: 'Nadia Asif', jama: 7224598 },
  { name: 'Ahmed Imran', jama: 5623195 },
  { name: 'Suhail Lal', jama: 3786590 },
  { name: 'Ali Nadeem', jama: 1266123 },
  { name: 'Ala Print', jama: 32748284 },
  { name: 'Ramzan A/C', jama: 581560 },
  { name: 'Ali Bahadur', jama: 2806180 },
  { name: 'Zunaira Usama', jama: 535100 },
  { name: 'Waqas Ahmed', jama: 687105 },
  { name: 'Murtaza Sahab', jama: 1006126 },
  { name: 'Musharaf Jamil', jama: 11099155 },
  { name: 'Khawaja Imran', jama: 4913000 },
  { name: 'Zahid Sitara', jama: 1000000 },
  { name: 'Nabeel Kusar', jama: 2752795 },
  { name: 'Mubashir Kameti', jama: 1800000 },
  { name: 'Ala Print Comission', jama: 450755 },
  { name: 'Mohsin Ala Print', jama: 18562750 },
  { name: 'Ismail Textile', jama: 28655 },
  { name: 'Ghafoor Shehzad', jama: 2145000 },
  { name: 'Alnoor Tax', jama: 138105 },
  { name: 'Afzal Wada', jama: 26268 },
  { name: 'Zafar Saddique', jama: 4000 },
];

function toTitleCase(str) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1));
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Clean up "Opening Balance" entries from CashbookEntry so Rokers stay clean
    const delResult = await CashbookEntry.deleteMany({ description: 'Opening Balance' });
    console.log(`Deleted ${delResult.deletedCount} dummy opening balance entries from cashbook entries.`);

    let lastParty = await CashbookParty.findOne().sort({ khataNo: -1 }).lean();
    let nextKhataNo = lastParty ? lastParty.khataNo + 1 : 1;

    for (const item of creditParties) {
      const cleanName = toTitleCase(item.name.trim());
      const norm = item.name.trim().toLowerCase();

      let party = await CashbookParty.findOne({ nameNorm: norm });
      if (!party) {
        party = new CashbookParty({
          khataNo: nextKhataNo++,
          name: cleanName,
          type: 'general',
          openingBalance: item.jama,
          balanceType: 'jama',
        });
        await party.save();
      } else {
        party.openingBalance = item.jama;
        party.balanceType = 'jama';
        await party.save();
      }
    }

    console.log('Updated all 41 parties with openingBalance & balanceType: jama');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
