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

    // GST Rate / Rate per Safi Gazana
    rate: {
      type: Number,
      required: true,
      default: 0
    },

    // Total Amount = Safi Gazana * Rate
    totalAmount: {
      type: Number,
      required: true,
      default: 0
    },

    // Advance received
    advance: {
      type: Number,
      default: 0
    },

    // Remaining Balance = Total Amount - Advance
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
  const rt = Number(this.rate) || 0;
  const adv = Number(this.advance) || 0;

  let installmentsTotal = 0;
  if (Array.isArray(this.paymentHistory)) {
    installmentsTotal = this.paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }

  const totalRec = Math.round((adv + installmentsTotal) * 100) / 100;
  this.totalAmount = Math.round(safi * 1.18 * rt * 100) / 100;

  if (this.status === 'completed') {
    const currentRemaining = Math.max(0, Math.round((this.totalAmount - totalRec) * 100) / 100);
    if (currentRemaining > 0) {
      if (!Array.isArray(this.paymentHistory)) {
        this.paymentHistory = [];
      }
      this.paymentHistory.push({
        amount: currentRemaining,
        date: new Date(),
        note: 'مکمل ادائیگی (Final Settlement)',
        receivedBy: 'Office'
      });
    }
    this.remaining = 0;
  } else {
    this.remaining = Math.max(0, Math.round((this.totalAmount - totalRec) * 100) / 100);
    if (this.remaining <= 0 && this.totalAmount > 0) {
      this.status = 'completed';
    }
  }

  next();
});

partyEntrySchema.index({ partyNameNorm: 1, date: -1 });
partyEntrySchema.index({ status: 1, date: -1 });

module.exports = mongoose.model('PartyEntry', partyEntrySchema);
