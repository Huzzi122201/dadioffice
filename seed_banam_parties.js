const mongoose = require('mongoose');
require('dotenv').config();

const CashbookParty = require('./models/CashbookParty');

const banamParties = [
  { name: 'Haji Gafoor', banam: 132773 },
  { name: 'New Mubarak Weaving', banam: 9030000 },
  { name: 'Imtiaz Weaving', banam: 5029000 },
  { name: 'Mubarak Weaving', banam: 1801942 },
  { name: 'Amjad Lal', banam: 200000 },
  { name: 'Fazal Shafique', banam: 20400000 },
  { name: 'Abid Zafar', banam: 1108260 },
  { name: 'Ahmed Imtiaz', banam: 7409278 },
  { name: 'Waqar Shafique', banam: 1512860 },
  { name: 'Tariq Fabrics', banam: 16435 },
  { name: 'Amir Enterprise', banam: 61085 },
  { name: 'Haroon Nisar', banam: 132000 },
  { name: 'Asif Nisar', banam: 9524141 },
  { name: 'EmbHN', banam: 446588 },
  { name: 'Malik Liaqat', banam: 698270 },
  { name: 'Brokri Khata', banam: 594596 },
  { name: 'Hanan Broker', banam: 270000 },
  { name: 'Chacha Ashraf', banam: 32950 },
  { name: 'Azeem Broker', banam: 23000 },
  { name: 'Yarana Textile', banam: 9035936 },
  { name: 'Invoice Kharcha', banam: 1651769 },
  { name: 'Iqbal Ala Print', banam: 30963556 },
  { name: '786 Textile Mils', banam: 372022 },
  { name: 'Sitara Gudaam', banam: 5266199 },
  { name: 'City Housing', banam: 3803250 },
  { name: 'Emrid Gudaam', banam: 51915 },
  { name: 'New Haram Iqbal Shah', banam: 5155312 },
  { name: 'Zis Gudaam', banam: 1098797 },
  { name: 'Shafi Textile', banam: 348064 },
  { name: 'Salman Textile', banam: 150782 },
  { name: 'Maheen Gudaam', banam: 31061038 },
  { name: 'Sajjad Sitara Ali Print', banam: 11470250 },
  { name: 'Baloria Factory', banam: 3113741 },
  { name: 'Kamal Industry', banam: 38330 },
  { name: 'Sutar Mandi Dukan', banam: 20278917 },
  { name: 'Arshad K&S', banam: 11570953 },
  { name: 'Yasin Weaving', banam: 6952016 },
  { name: 'Nadeem Sahab Kharcha', banam: 10298868 },
  { name: 'Mutfarq Ikhrajat', banam: 1328863 },
  { name: 'Zis Textile', banam: 6724588 },
  { name: 'Qosar Print', banam: 7568034 },
  { name: 'Kamran Rocker', banam: 221949 },
  { name: 'Raza Ajmal Wolori', banam: 9917000 },
  { name: 'Ajmal Qasuri', banam: 78284 },
  { name: 'Azhar Advance', banam: 100000 },
  { name: 'Daftar Advance', banam: 35500 },
  { name: 'MaazII', banam: 66448 },
  { name: 'Cash Rocker', banam: 38928419 },
];

function toTitleCase(str) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1));
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB Atlas');

    let lastParty = await CashbookParty.findOne().sort({ khataNo: -1 }).lean();
    let nextKhataNo = lastParty ? lastParty.khataNo + 1 : 1;

    let created = 0;
    let updated = 0;

    for (const item of banamParties) {
      const cleanName = toTitleCase(item.name.trim());
      const norm = item.name.trim().toLowerCase();

      let party = await CashbookParty.findOne({ nameNorm: norm });
      if (!party) {
        party = new CashbookParty({
          khataNo: nextKhataNo++,
          name: cleanName,
          type: 'general',
          openingBalance: item.banam,
          balanceType: 'banam',
        });
        await party.save();
        created++;
      } else {
        party.openingBalance = item.banam;
        party.balanceType = 'banam';
        await party.save();
        updated++;
      }
    }

    console.log(`Seeding Banam parties complete! Created: ${created}, Updated: ${updated}, Total: ${banamParties.length}`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
