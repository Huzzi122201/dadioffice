const mongoose = require('mongoose');

const cashbookPartySchema = new mongoose.Schema(
  {
    // ── Khata Number (auto-increment) ────────────────────
    khataNo: {
      type: Number,
      unique: true,
      required: true,
    },

    // ── Party Code (e.g. A12, B15) ───────────────────────
    code: {
      type: String,
      index: true,
      default: '',
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

    // ── Party Type & Investor Flag ──────────────────────
    type: {
      type: String,
      enum: ['supplier', 'investor', 'loomwala', 'general'],
      default: 'supplier',
    },
    isInvestor: {
      type: Boolean,
      default: false,
      index: true,
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

// Helper to compute party code (e.g. "Ali Nadeem" #12 -> "A12", "786 Mills" #15 -> "B15")
function computePartyCode(name, khataNo) {
  const clean = (name || '').trim();
  const first = clean.charAt(0);
  const prefix = /^[a-zA-Z]$/.test(first) ? first.toUpperCase() : 'B';
  return `${prefix}${khataNo || ''}`;
}

// Auto-generate nameNorm and code before save
cashbookPartySchema.pre('save', function (next) {
  if (this.name) {
    this.nameNorm = this.name.trim().toLowerCase();
  }
  if (this.name && this.khataNo) {
    this.code = computePartyCode(this.name, this.khataNo);
  }
  next();
});

cashbookPartySchema.statics.computePartyCode = computePartyCode;

const CashbookParty = mongoose.model('CashbookParty', cashbookPartySchema);
CashbookParty.computePartyCode = computePartyCode;

module.exports = CashbookParty;
