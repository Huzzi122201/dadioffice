const mongoose = require('mongoose');

const yarnIssuanceSchema = new mongoose.Schema(
  {
    // ── Party Info ───────────────────────────────────────
    partyName: {
      type: String,
      required: true,
      trim: true,
    },
    // Normalized lowercase version for case-insensitive matching
    partyNameNorm: {
      type: String,
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },

    // ── Yarn Bags ───────────────────────────────────────
    warpBags: {
      type: Number,
      default: 0,
    },
    weftBags: {
      type: Number,
      default: 0,
    },

    // ── Yarn Quality ────────────────────────────────────
    warpQuality: {
      type: String,
      trim: true,
      default: '',
    },
    weftQuality: {
      type: String,
      trim: true,
      default: '',
    },

    // ── Type ────────────────────────────────────────────
    // 'issue'     = manual yarn issuance (adds to stock)
    // 'deduction' = auto-deducted when conversion contract saved
    type: {
      type: String,
      enum: ['issue', 'deduction'],
      default: 'issue',
    },

    // ── Reference & Contract Link ──────────────────────
    // Links deduction or manual issuance to a specific contract/invoice
    refInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    contractInfo: {
      type: String,
      trim: true,
      default: '',
    },

    // ── Optional Note ──────────────────────────────────
    note: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate partyNameNorm before save
yarnIssuanceSchema.pre('save', function (next) {
  if (this.partyName) {
    this.partyNameNorm = this.partyName.trim().toLowerCase();
  }
  next();
});

module.exports = mongoose.model('YarnIssuance', yarnIssuanceSchema);
