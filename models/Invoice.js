const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    // ── Party Info ───────────────────────────────────────
    partyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },

    // ── Fabric Info ─────────────────────────────────────
    fabricType: {
      type: String,
      trim: true,
      default: '',
    },
    loomType: {
      type: String,
      trim: true,
      default: '',
    },

    // ── Inputs ──────────────────────────────────────────
    warpCount: { type: Number, required: true },
    warpCountAlt: { type: Number, default: null },
    weftCount: { type: Number, required: true },
    weftCountAlt: { type: Number, default: null },
    reed: { type: Number, required: true },
    pick: { type: Number, required: true },
    width: { type: Number, required: true },
    widthCm: { type: Number, default: null },
    warpRate: { type: Number, required: true },
    weftRate: { type: Number, required: true },
    conversionRate: { type: Number, required: true },
    quantity: { type: Number, required: true },

    // ── Calculated Outputs ──────────────────────────────
    warpWeightYard: Number,
    warpWeightMeter: Number,
    weftWeightYard: Number,
    weftWeightMeter: Number,
    totalWeightYard: Number,
    totalWeightMeter: Number,
    weightPerMtrPYard: Number,
    weightPerMtrPMeter: Number,
    weightPerMtrGYard: Number,
    weightPerMtrGMeter: Number,
    gsm: Number,
    ozPerSqYd: Number,
    conversionCost: Number,
    warpCostYard: Number,
    warpCostMeter: Number,
    weftCostYard: Number,
    weftCostMeter: Number,
    manfCostYard: Number,
    manfCostMeter: Number,
    totalCostYard: Number,
    totalCostMeter: Number,
    yarnBagsWarp: Number,
    yarnBagsWeft: Number,
    totalYarnBags: Number,
    qtyInFCL: Number,
  },
  {
    timestamps: true,
  }
);

// Text index for search
invoiceSchema.index({ partyName: 'text' });

module.exports = mongoose.model('Invoice', invoiceSchema);
