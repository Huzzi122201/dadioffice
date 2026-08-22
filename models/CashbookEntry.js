const mongoose = require('mongoose');

const cashbookEntrySchema = new mongoose.Schema(
  {
    // ── Roker Number ────────────────────────────────────
    // Groups entries that belong to the same roker (journal)
    rokerNo: {
      type: Number,
      required: true,
      index: true,
    },

    // ── Khata Link ──────────────────────────────────────
    khataNo: {
      type: Number,
      required: true,
      index: true,
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CashbookParty',
      required: true,
    },
    partyName: {
      type: String,
      trim: true,
      default: '',
    },
    partyType: {
      type: String,
      default: 'general',
    },

    // ── Entry Details ───────────────────────────────────
    date: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },

    // ── Naam / Jama (Debit / Credit) ────────────────────
    // Only one should have a value per entry
    naam: {
      type: Number,
      default: 0,
    },
    jama: {
      type: Number,
      default: 0,
    },

    // ── Transaction Type ────────────────────────────────
    txnType: {
      type: String,
      enum: ['purchase', 'allocate', 'buyback', 'transfer', 'general'],
      default: 'general',
    },

    // ── Bag / Meter Details (for transactions) ─────────
    bags: {
      type: Number,
      default: 0,
    },
    meters: {
      type: Number,
      default: 0,
    },
    ratePerBag: {
      type: Number,
      default: 0,
    },

    // ── Linking / References ────────────────────────────
    // Links allocate/buyback/transfer → original purchase entry
    purchaseRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CashbookEntry',
      default: null,
    },
    // Links buyback/transfer → the allocation entry
    allocateRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CashbookEntry',
      default: null,
    },

    // ── Cash Entry Linking ──────────────────────────────
    isCash: {
      type: Boolean,
      default: false,
    },
    linkedCashEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CashbookEntry',
      default: null,
    },
    isAutoCounterEntry: {
      type: Boolean,
      default: false,
    },

    // ── Purchase / Sell Tracking ─────────────────────────
    isPurchase: {
      type: Boolean,
      default: false,
    },
    isSell: {
      type: Boolean,
      default: false,
    },
    linkedPurchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CashbookEntry',
      default: null,
    },
    remainingBags: {
      type: Number,
      default: 0,
    },
    isAutoProfitLossEntry: {
      type: Boolean,
      default: false,
    },
    linkedProfitLossEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CashbookEntry',
      default: null,
    },

    // ── Optional Note ───────────────────────────────────
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

// Compound indexes for efficient queries
cashbookEntrySchema.index({ khataNo: 1, date: 1 });
cashbookEntrySchema.index({ rokerNo: 1, date: 1 });
cashbookEntrySchema.index({ purchaseRef: 1 });
cashbookEntrySchema.index({ txnType: 1 });
cashbookEntrySchema.index({ isPurchase: 1, remainingBags: 1 });
cashbookEntrySchema.index({ linkedPurchaseId: 1 });

module.exports = mongoose.model('CashbookEntry', cashbookEntrySchema);
