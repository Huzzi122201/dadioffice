const mongoose = require('mongoose');

const cashbookPartySchema = new mongoose.Schema(
  {
    // ── Khata Number (auto-increment) ────────────────────
    khataNo: {
      type: Number,
      unique: true,
      required: true,
    },

    // ── Party Info ───────────────────────────────────────
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameNorm: {
      type: String,
      index: true,
    },

    // ── Party Type ──────────────────────────────────────
    type: {
      type: String,
      enum: ['supplier', 'investor', 'loomwala', 'general'],
      default: 'supplier',
    },

    // ── Opening Balance ─────────────────────────────────
    openingBalance: {
      type: Number,
      default: 0,
    },
    balanceType: {
      type: String,
      enum: ['jama', 'banam', 'cash', 'none'],
      default: 'none',
    },

    // ── Contact & Notes ─────────────────────────────────
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
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

// Auto-generate nameNorm before save
cashbookPartySchema.pre('save', function (next) {
  if (this.name) {
    this.nameNorm = this.name.trim().toLowerCase();
  }
  next();
});

module.exports = mongoose.model('CashbookParty', cashbookPartySchema);
