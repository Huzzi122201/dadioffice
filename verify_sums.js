const mongoose = require('mongoose');
require('dotenv').config();

const CashbookParty = require('./models/CashbookParty');

// 1. User provided Credit (Jama) list:
const userJamaList = [
  { name: 'ibrahimII', amount: 421925 },
  { name: 'usama faisal', amount: 833510 },
  { name: 'basit qammar', amount: 2072274 },
  { name: 'jawad aftab', amount: 2307000 },
  { name: 'rehman a/c', amount: 1666574 },
  { name: 'subhania umer', amount: 586180 },
  { name: 'usama huzaifa', amount: 11977750 },
  { name: 'naveed munawar', amount: 2890535 },
  { name: 'amin asif', amount: 3953210 },
  { name: 'N.A', amount: 100000000 },
  { name: 'safdar sahab', amount: 7916410 },
  { name: 'hussain sabir', amount: 1047195 },
  { name: 'dukan karaya', amount: 197600 },
  { name: 'N', amount: 30034891 },
  { name: 'nadeem lasani', amount: 14879085 },
  { name: 'kwist gudaam', amount: 278515 },
  { name: 'altaf lasani', amount: 4041425 },
  { name: 'abdullah suleman', amount: 3082730 },
  { name: 'fahad zain', amount: 648750 },
  { name: 'nadia asif', amount: 7224598 },
  { name: 'ahmed imran', amount: 5623195 },
  { name: 'suhail lal', amount: 3786590 },
  { name: 'ali nadeem', amount: 1266123 },
  { name: 'ala print', amount: 32748284 },
  { name: 'ramzan A/C', amount: 581560 },
  { name: 'ali bahadur', amount: 2806180 },
  { name: 'zunaira usama', amount: 535100 },
  { name: 'waqas ahmed', amount: 687105 },
  { name: 'murtaza sahab', amount: 1006126 },
  { name: 'musharaf jamil', amount: 11099155 },
  { name: 'khawaja imran', amount: 4913000 },
  { name: 'zahid sitara', amount: 1000000 },
  { name: 'nabeel kusar', amount: 2752795 },
  { name: 'mubashir kameti', amount: 1800000 },
  { name: 'ala print comission', amount: 450755 },
  { name: 'mohsin ala print', amount: 18562750 },
  { name: 'ismail textile', amount: 28655 },
  { name: 'ghafoor shehzad', amount: 2145000 },
  { name: 'alnoor tax', amount: 138105 },
  { name: 'afzal wada', amount: 26268 },
  { name: 'zafar saddique', amount: 4000 },
];

// 2. User provided Debit (Banam) list:
const userBanamList = [
  { name: 'haji gafoor', amount: 132773 },
  { name: 'new mubarak weaving', amount: 9030000 },
  { name: 'imtaiz weaving', amount: 5029000 },
  { name: 'mubarak weaving', amount: 1801942 },
  { name: 'amjad lal', amount: 200000 },
  { name: 'fazal shafique', amount: 20400000 },
  { name: 'abid zafar', amount: 1108260 },
  { name: 'ahmed imtiaz', amount: 7409278 },
  { name: 'waqar shafique', amount: 1512860 },
  { name: 'tariq fabrics', amount: 16435 },
  { name: 'amir enterprise', amount: 61085 },
  { name: 'haroon nisar', amount: 132000 },
  { name: 'asif nisar', amount: 9524141 },
  { name: 'embHN', amount: 446588 },
  { name: 'malik liaqat', amount: 698270 },
  { name: 'brokri khata', amount: 594596 },
  { name: 'hanan broker', amount: 270000 },
  { name: 'chacha ashraf', amount: 32950 },
  { name: 'azeem broker', amount: 23000 },
  { name: 'yarana textile', amount: 9035936 },
  { name: 'invoice kharcha', amount: 1651769 },
  { name: 'iqbal ala print', amount: 30963556 },
  { name: '786 textile mils', amount: 372022 },
  { name: 'sitara gudaam', amount: 5266199 },
  { name: 'city housing', amount: 3803250 },
  { name: 'emrid gudaam', amount: 51915 },
  { name: 'new haram iqbal shah', amount: 5155312 },
  { name: 'zis gudaam', amount: 1098797 },
  { name: 'shafi textile', amount: 348064 },
  { name: 'salman textile', amount: 150782 },
  { name: 'maheen gudaam', amount: 31061038 },
  { name: 'sajjad sitara ali print', amount: 11470250 },
  { name: 'baloria factory', amount: 3113741 },
  { name: 'kamal industry', amount: 38330 },
  { name: 'sutar mandi dukan', amount: 20278917 },
  { name: 'arshad K&S', amount: 11570953 },
  { name: 'yasin weaving', amount: 6952016 },
  { name: 'nadeem sahab kharcha', amount: 10298868 },
  { name: 'mutfarq ikhrajat', amount: 1328863 },
  { name: 'zis textile', amount: 6724588 },
  { name: 'qosar print', amount: 7568034 },
  { name: 'kamran rocker', amount: 221949 },
  { name: 'raza ajmal wolori', amount: 9917000 },
  { name: 'ajmal qasuri', amount: 78284 },
  { name: 'azhar advance', amount: 100000 },
  { name: 'daftar advance', amount: 35500 },
  { name: 'maazII', amount: 66448 },
  { name: 'cash rocker', amount: 38928419 },
];

async function verify() {
  const sumJama = userJamaList.reduce((s, i) => s + i.amount, 0);
  const sumBanam = userBanamList.reduce((s, i) => s + i.amount, 0);

  console.log('=== USER PROVIDED RAW LIST CALCULATIONS ===');
  console.log(`Total Credit (Jama) Parties: ${userJamaList.length}`);
  console.log(`Total Credit (Jama) Sum: ${sumJama.toLocaleString('en-IN')} (Raw: ${sumJama})`);
  console.log(`Total Debit (Banam) Parties: ${userBanamList.length}`);
  console.log(`Total Debit (Banam) Sum: ${sumBanam.toLocaleString('en-IN')} (Raw: ${sumBanam})`);
  console.log(`Net Difference (Jama - Banam): ${(sumJama - sumBanam).toLocaleString('en-IN')} (Raw: ${sumJama - sumBanam})`);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('\n=== MONGODB ATLAS STORED PARTIES ===');
  const dbParties = await CashbookParty.find().lean();
  console.log(`Total DB Parties: ${dbParties.length}`);

  const dbJama = dbParties.filter(p => p.balanceType === 'jama');
  const dbBanam = dbParties.filter(p => p.balanceType === 'banam');
  const dbOther = dbParties.filter(p => p.balanceType !== 'jama' && p.balanceType !== 'banam');

  const dbJamaSum = dbJama.reduce((s, p) => s + (p.openingBalance || 0), 0);
  const dbBanamSum = dbBanam.reduce((s, p) => s + (p.openingBalance || 0), 0);

  console.log(`DB Jama Parties Count: ${dbJama.length}, Sum: ${dbJamaSum.toLocaleString('en-IN')}`);
  console.log(`DB Banam Parties Count: ${dbBanam.length}, Sum: ${dbBanamSum.toLocaleString('en-IN')}`);
  if (dbOther.length > 0) {
    console.log(`DB Other Parties (${dbOther.length}):`, dbOther.map(p => ({ name: p.name, balanceType: p.balanceType, openingBalance: p.openingBalance })));
  }

  // Check differences if any
  console.log('\n=== INTEGRITY CHECKS ===');
  console.log(`Jama Sum Match: ${sumJama === dbJamaSum ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`Banam Sum Match: ${sumBanam === dbBanamSum ? '✅ MATCH' : '❌ MISMATCH'}`);

  process.exit(0);
}

verify();
