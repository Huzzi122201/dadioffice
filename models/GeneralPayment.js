const mongoose = require('mongoose');

const generalPaymentSchema = new mongoose.Schema(
  {
    partyName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    partyNameNorm: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    },
    amount: {
      type: Number,
      required: true
    },
    note: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

generalPaymentSchema.index({ partyNameNorm: 1, date: -1 });

module.exports = mongoose.model('GeneralPayment', generalPaymentSchema);
