const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema(
  {
    contractNo: { type: Number, required: true, unique: true },
    date: { type: Date, required: true, default: Date.now },
    purchaserName: { type: String, required: true, trim: true },
    sellerName: { type: String, required: true, trim: true },
    warpCount: { type: Number, default: 0 },
    weftCount: { type: Number, default: 0 },
    reed: { type: Number, default: 0 },
    pick: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    quality: { type: String, trim: true, default: '' },
    quantity: { type: Number, default: 0 },
    quantityUnit: { type: String, default: 'Meters' },
    broker: { type: String, trim: true, default: '' },
    deliveryType: { type: String, enum: ['hazar', 'amdan'], default: 'hazar' },
    deliveryDate: { type: Date, default: Date.now },
    warpRate: { type: Number, default: 0 },
    weftRate: { type: Number, default: 0 },
    conversion: { type: Number, default: 0 },
    rate: { type: Number, required: true, default: 0 },
    rateType: { type: String, enum: ['manual', 'calculated'], default: 'manual' },
    gudamMuqam: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' }
  },
  {
    timestamps: true
  }
);

contractSchema.index({ date: 1 });
contractSchema.index({ purchaserName: 1 });
contractSchema.index({ sellerName: 1 });

module.exports = mongoose.model('Contract', contractSchema);
