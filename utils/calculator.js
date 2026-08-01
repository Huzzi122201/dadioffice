/**
 * Textile Fabric Costing Calculator
 * Replicates all 25 formulas from the Excel costing sheet.
 *
 * @param {Object} inputs
 * @param {number} inputs.warpCount   - Warp yarn count (e.g. 30)
 * @param {number} inputs.weftCount   - Weft yarn count (e.g. 31)
 * @param {number} inputs.reed        - Reed (ends per inch, e.g. 76)
 * @param {number} inputs.pick        - Pick (picks per inch, e.g. 66)
 * @param {number} inputs.width       - Width in inches (e.g. 112)
 * @param {number} inputs.warpRate    - Warp yarn rate per 40-lb bag (e.g. 123)
 * @param {number} inputs.weftRate    - Weft yarn rate per 40-lb bag (e.g. 123)
 * @param {number} inputs.conversionRate - Conversion rate per pick (e.g. 0.55)
 * @param {number} inputs.quantity    - Order quantity in meters (e.g. 40000)
 * @returns {Object} All calculated values
 */
function calculate(inputs) {
  const {
    warpCount,
    weftCount,
    reed,
    pick,
    width,
    warpRate,
    weftRate,
    conversionRate,
    quantity,
  } = inputs;

  // ── Weight Calculations ──────────────────────────────────
  // F8: =B10*B12/20/B8
  const warpWeightYard = reed * width / 20 / warpCount;
  // G8: =F8*1.0936
  const warpWeightMeter = warpWeightYard * 1.0936;

  // F9: =B11*B12/20/B9
  const weftWeightYard = pick * width / 20 / weftCount;
  // G9: =F9*1.0936
  const weftWeightMeter = weftWeightYard * 1.0936;

  // F10: =SUM(F8:F9)
  const totalWeightYard = warpWeightYard + weftWeightYard;
  // G10: =SUM(G8:G9)
  const totalWeightMeter = warpWeightMeter + weftWeightMeter;

  // F11: =F10/40
  const weightPerMtrPYard = totalWeightYard / 40;
  // G11: =G10/40
  const weightPerMtrPMeter = totalWeightMeter / 40;

  // F12: =F11/2.2046
  const weightPerMtrGYard = weightPerMtrPYard / 2.2046;
  // G12: =G11/2.2046
  const weightPerMtrGMeter = weightPerMtrPMeter / 2.2046;

  // ── Fabric Specs ─────────────────────────────────────────
  // H11: =G12/B12*39.37
  const gsm = weightPerMtrGMeter / width * 39.37;
  // I11: =H11*2.2046/1.0936/1.0936*16
  const ozPerSqYd = gsm * 2.2046 / 1.0936 / 1.0936 * 16;

  // ── Cost Calculations ────────────────────────────────────
  // B15: =C15*B11
  const conversionCost = conversionRate * pick;

  // F14: =F8*B13/40
  const warpCostYard = warpWeightYard * warpRate / 40;
  // G14: =G8*B13/40
  const warpCostMeter = warpWeightMeter * warpRate / 40;

  // F15: =F9*B14/40
  const weftCostYard = weftWeightYard * weftRate / 40;
  // G15: =G9*B14/40
  const weftCostMeter = weftWeightMeter * weftRate / 40;

  // F16: =B15/1.0936
  const manfCostYard = conversionCost / 1.0936;
  // G16: =B15
  const manfCostMeter = conversionCost;

  // F17: =SUM(F14:F16)
  const totalCostYard = warpCostYard + weftCostYard + manfCostYard;
  // G17: =SUM(G14:G16)
  const totalCostMeter = warpCostMeter + weftCostMeter + manfCostMeter;

  // ── Yarn Bags & Container ───────────────────────────────
  // I14: =G8/40*C16/100
  const yarnBagsWarp = warpWeightMeter / 40 * quantity / 100;
  // I15: =G9/40*C16/100
  const yarnBagsWeft = weftWeightMeter / 40 * quantity / 100;
  // I16: =SUM(I14:I15)
  const totalYarnBags = yarnBagsWarp + yarnBagsWeft;
  // C17: =24000/G12
  const qtyInFCL = 24000 / weightPerMtrGMeter;

  return {
    warpWeightYard,
    warpWeightMeter,
    weftWeightYard,
    weftWeightMeter,
    totalWeightYard,
    totalWeightMeter,
    weightPerMtrPYard,
    weightPerMtrPMeter,
    weightPerMtrGYard,
    weightPerMtrGMeter,
    gsm,
    ozPerSqYd,
    conversionCost,
    warpCostYard,
    warpCostMeter,
    weftCostYard,
    weftCostMeter,
    manfCostYard,
    manfCostMeter,
    totalCostYard,
    totalCostMeter,
    yarnBagsWarp,
    yarnBagsWeft,
    totalYarnBags,
    qtyInFCL,
  };
}

module.exports = { calculate };
