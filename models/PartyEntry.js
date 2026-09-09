const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    amount: { type: Number, required: true },
    note: { type: String, trim: true, default: '' },
    receivedBy: { type: String, trim: true, default: '' }
  },
  { _id: true, timestamps: true }
);

const partyEntrySchema = new mongoose.Schema(
  {
    // Date of Entry
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },

    // Banaam Party (Customer / Buyer)
    partyName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    partyNameNorm: {
      type: String,
      trim: true,
      index: true
    },

    // Variety / Quality description
    variety: {
      type: String,
      trim: true,
      default: ''
    },

    // Gazana specs
    kachaGazana: {
      type: Number,
      default: 0
    },
    safiGazana: {
      type: Number,
      required: true,
      default: 0
    },

    // Rate specs: Base Rate (Without GST) & GST Rate
    rate: {
      type: Number,
      required: true,
      default: 0
    },
    rateType: {
      type: String,
      enum: ['kachy', 'pakay'],
      default: 'pakay'
    },
    gstRate: {
      type: Number,
      default: 0
    },

    // Loom Wala, Purchaser, and Gudaam
    loomWala: {
      type: String,
      trim: true,
      default: ''
    },
    purchaser: {
      type: String,
      trim: true,
      default: ''
    },
    gudaam: {
      type: String,
      trim: true,
      default: ''
    },

    // Total Amount with GST = Safi Gazana * gstRate
    totalAmount: {
      type: Number,
      required: true,
      default: 0
    },

    // Total Amount without GST = Safi Gazana * rate
    totalAmountWithoutGst: {
      type: Number,
      default: 0
    },

    // Advance received
    advance: {
      type: Number,
      default: 0
    },

    // Remaining Balance = Total Amount (W/Gst) - Advance - Installments
    remaining: {
      type: Number,
      required: true,
      default: 0
    },

    // Contract Reference
    contractNo: {
      type: String,
      trim: true,
      default: ''
    },

    // Note / remarks
    note: {
      type: String,
      trim: true,
      default: ''
    },

    // Status: active until completed (when all payment received)
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
      index: true
    },

    // Optional payment history installments
    paymentHistory: [paymentHistorySchema]
  },
  {
    timestamps: true
  }
);

// Auto-populate normalized party name and calculate amounts before saving
partyEntrySchema.pre('save', function (next) {
  if (this.partyName) {
    this.partyNameNorm = this.partyName.trim().toLowerCase();
  }

  const safi = Number(this.safiGazana) || 0;
  // User enters Rate Without GST (rate)
  const rt = Number(this.rate) || 0;
  const gstRt = Number(this.gstRate) || 0;

  if (rt > 0) {
    this.rate = Math.round(rt * 100) / 100;
    this.gstRate = Math.round(this.rate * 1.18 * 100) / 100;
  } else if (gstRt > 0) {
    this.gstRate = Math.round(gstRt * 100) / 100;
    this.rate = Math.round((this.gstRate / 1.18) * 100) / 100;
  }

  const adv = Number(this.advance) || 0;
  if (!this.rateType) {
    this.rateType = 'pakay';
  }

  let installmentsTotal = 0;
  if (Array.isArray(this.paymentHistory)) {
    installmentsTotal = this.paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }

  const totalRec = Math.round((adv + installmentsTotal) * 100) / 100;
  // Total without GST
  this.totalAmountWithoutGst = Math.round(safi * this.rate * 100) / 100;
  // If kachy, bill is without GST; if pakay (default), bill is with GST
  if (this.rateType === 'kachy') {
    this.totalAmount = this.totalAmountWithoutGst;
  } else {
    this.totalAmount = Math.round(safi * this.gstRate * 100) / 100;
  }

  if (this.status === 'completed') {
    const currentRemaining = Math.max(0, Math.round((this.totalAmount - totalRec) * 100) / 100);
    if (currentRemaining > 0) {
      if (!Array.isArray(this.paymentHistory)) {
        this.paymentHistory = [];
      }
      this.paymentHistory.push({
        amount: currentRemaining,
        date: new Date(),
        note: 'Paid Amount',
        receivedBy: 'Office'
      });
    }
    this.remaining = 0;
  } else {
    // If status is active, remove auto final settlement payment record to restore original balance
    if (Array.isArray(this.paymentHistory)) {
      this.paymentHistory = this.paymentHistory.filter(
        p => !p.note || (!p.note.includes('Paid Amount') && !p.note.includes('Final Settlement') && !p.note.includes('مکمل ادائیگی'))
      );
    }
    const cleanInstallmentsTotal = (this.paymentHistory || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const cleanTotalRec = Math.round((adv + cleanInstallmentsTotal) * 100) / 100;
    this.remaining = Math.max(0, Math.round((this.totalAmount - cleanTotalRec) * 100) / 100);
  }

  next();
});

partyEntrySchema.index({ partyNameNorm: 1, date: -1 });
partyEntrySchema.index({ status: 1, date: -1 });

module.exports = mongoose.model('PartyEntry', partyEntrySchema);
