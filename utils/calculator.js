/**
 * Textile Fabric Costing Calculator
 * Replicates all 25 formulas from the Excel costing sheet.
 * Exact Excel Number Formatting:
 * - Weights & Fabric Specs: 4 decimals (formatCode: 0.0000)
 * - Costing: 2 decimals (formatCode: 0.00)
 * - Yarn Bags & Container: Whole integer rounded (formatCode: 0, numFmtId=1)
 *
 * @param {Object} inputs
 * @returns {Object} All calculated values
 */

function r4(v) { return v != null && !isNaN(v) && isFinite(v) ? Number(Number(v).toFixed(4)) : 0; }
function r2(v) { return v != null && !isNaN(v) && isFinite(v) ? Number(Number(v).toFixed(2)) : 0; }
function r0(v) { return v != null && !isNaN(v) && isFinite(v) ? Math.round(Number(v)) : 0; }

function calculate(inputs) {
  const warpCount = inputs.warpCount || 0;
  const weftCount = inputs.weftCount || 0;
  const reed = inputs.reed || 0;
  const pick = inputs.pick || 0;
  const width = inputs.width || 0;
  const warpRate = inputs.warpRate || 0;
  const weftRate = inputs.weftRate || 0;
  const conversionRate = inputs.conversionRate || 0;
  const quantity = inputs.quantity || 0;

  // ── Weight Calculations (4 decimals) ──────────────────────
  const warpWeightYard = warpCount > 0 ? (reed * width / 20 / warpCount) : 0;
  const warpWeightMeter = warpWeightYard * 1.0936;

  const weftWeightYard = weftCount > 0 ? (pick * width / 20 / weftCount) : 0;
  const weftWeightMeter = weftWeightYard * 1.0936;

  const totalWeightYard = warpWeightYard + weftWeightYard;
  const totalWeightMeter = warpWeightMeter + weftWeightMeter;

  const weightPerMtrPYard = totalWeightYard / 40;
  const weightPerMtrPMeter = totalWeightMeter / 40;

  const weightPerMtrGYard = weightPerMtrPYard / 2.2046;
  const weightPerMtrGMeter = weightPerMtrPMeter / 2.2046;

  // ── Fabric Specs (4 decimals) ────────────────────────────
  const gsm = width > 0 ? (weightPerMtrGMeter / width * 39.37) : 0;
  const ozPerSqYd = gsm * 2.2046 / 1.0936 / 1.0936 * 16;

  // ── Cost Calculations (2 decimals) ───────────────────────
  const conversionCost = conversionRate * pick;

  const warpCostYard = warpWeightYard * warpRate / 40;
  const warpCostMeter = warpWeightMeter * warpRate / 40;

  const weftCostYard = weftWeightYard * weftRate / 40;
  const weftCostMeter = weftWeightMeter * weftRate / 40;

  const manfCostYard = conversionCost / 1.0936;
  const manfCostMeter = conversionCost;

  const totalCostYard = warpCostYard + weftCostYard + manfCostYard;
  const totalCostMeter = warpCostMeter + weftCostMeter + manfCostMeter;

  // ── Yarn Bags (2 decimals) & Container (Whole Integers) ──
  const yarnBagsWarp = warpWeightMeter / 40 * quantity / 100;
  const yarnBagsWeft = weftWeightMeter / 40 * quantity / 100;
  const totalYarnBags = yarnBagsWarp + yarnBagsWeft;

  const qtyInFCL = weightPerMtrGMeter > 0 ? (24000 / weightPerMtrGMeter) : 0;

  return {
    warpWeightYard: r4(warpWeightYard),
    warpWeightMeter: r4(warpWeightMeter),
    weftWeightYard: r4(weftWeightYard),
    weftWeightMeter: r4(weftWeightMeter),
    totalWeightYard: r4(totalWeightYard),
    totalWeightMeter: r4(totalWeightMeter),
    weightPerMtrPYard: r4(weightPerMtrPYard),
    weightPerMtrPMeter: r4(weightPerMtrPMeter),
    weightPerMtrGYard: r4(weightPerMtrGYard),
    weightPerMtrGMeter: r4(weightPerMtrGMeter),
    gsm: r4(gsm),
    ozPerSqYd: r4(ozPerSqYd),
    conversionCost: r2(conversionCost),
    warpCostYard: r2(warpCostYard),
    warpCostMeter: r2(warpCostMeter),
    weftCostYard: r2(weftCostYard),
    weftCostMeter: r2(weftCostMeter),
    manfCostYard: r2(manfCostYard),
    manfCostMeter: r2(manfCostMeter),
    totalCostYard: r2(totalCostYard),
    totalCostMeter: r2(totalCostMeter),
    yarnBagsWarp: r2(yarnBagsWarp),
    yarnBagsWeft: r2(yarnBagsWeft),
    totalYarnBags: r2(totalYarnBags),
    qtyInFCL: r0(qtyInFCL),
  };
}

module.exports = { calculate };
