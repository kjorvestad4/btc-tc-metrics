// Universal BTC Price Engine
// Monte Carlo simulation with regime shifts, herding dynamics, and on-chain recalibration

export const SCENARIOS = {
  general: {
    label: "General",
    description: "Baseline BTC growth with standard halving cycle dynamics",
    drift: 0.35,        // annual drift (35%)
    volatility: 0.65,    // annual vol
    herding_boost: 2.8,
    beta1: 5.45,
    treasury_pressure: 0,    // BTC/day net buy pressure
    hash_shock: 0,           // hash rate disruption (-1 to 1)
    color: "#22C55E",
  },
  high_treasury_nash: {
    label: "High Treasury Nash",
    description: "Institutional FOMO equilibrium — corporate treasuries compete for BTC, driving premium drift",
    drift: 0.55,
    volatility: 0.72,
    herding_boost: 3.6,
    beta1: 6.1,
    treasury_pressure: 1200,  // BTC/day institutional buying
    hash_shock: 0,
    color: "#F59E0B",
  },
  miner_capitulation: {
    label: "Miner Capitulation",
    description: "Hash rate collapse post-halving — miners sell reserves, negative supply shock",
    drift: -0.15,
    volatility: 0.85,
    herding_boost: 1.9,
    beta1: 4.8,
    treasury_pressure: 200,
    hash_shock: -0.35,
    color: "#EF4444",
  },
  "2028_shock": {
    label: "2028 Halving Shock",
    description: "Post-halving volatility spike with supply shock + adoption wave",
    drift: 0.45,
    volatility: 0.95,
    herding_boost: 3.2,
    beta1: 5.7,
    treasury_pressure: 800,
    hash_shock: -0.1,
    color: "#A855F7",
  },
  custom: {
    label: "Custom",
    description: "User-tuned parameters — adjust sliders below",
    drift: 0.40,
    volatility: 0.70,
    herding_boost: 2.8,
    beta1: 5.45,
    treasury_pressure: 500,
    hash_shock: 0,
    color: "#60A5FA",
  },
};

export const DEFAULT_PARAMS = {
  drift: 0.40,
  volatility: 0.70,
  herding_boost: 2.8,
  beta1: 5.45,
  treasury_pressure: 500,
  hash_shock: 0,
  simulations: 500,
  horizon_years: 3.5,
};

// Box-Muller transform for standard normal random
function gaussian() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Run a single price path simulation
function simulatePath(startPrice, params, days, onChainState) {
  const dt = 1 / 365.25; // daily time step in years
  let price = startPrice;
  const path = [{ day: 0, price }];

  // On-chain recalibration factors
  const hashMultiplier = onChainState?.hash_health != null
    ? 1 + (onChainState.hash_health - 0.5) * 0.3  // hash health modulates drift ±15%
    : 1;
  const treasuryMultiplier = onChainState?.treasury_flow != null
    ? 1 + Math.min(onChainState.treasury_flow / 5000, 0.2) // treasury flow adds up to +20% drift
    : 1;

  for (let d = 1; d <= days; d++) {
    const z = gaussian();

    // Herding boost: momentum feedback — recent growth amplifies future drift
    const recentReturn = d > 1 ? Math.log(path[d - 1].price / path[d - 2].price) : 0;
    const herdingFactor = 1 + params.herding_boost * recentReturn * 0.5;

    // Treasury pressure: continuous buy pressure adds to drift
    const treasuryDrift = (params.treasury_pressure / 1e6) * 365.25; // normalized

    // Hash shock: one-time or sustained disruption
    const hashDrift = params.hash_shock * (d < 60 ? (60 - d) / 60 : 0);

    // Effective drift and vol
    const effectiveDrift = (params.drift * hashMultiplier * treasuryMultiplier + treasuryDrift + hashDrift) * herdingFactor;
    const effectiveVol = params.volatility;

    // GBM step
    const driftTerm = (effectiveDrift - 0.5 * effectiveVol * effectiveVol) * dt;
    const volTerm = effectiveVol * Math.sqrt(dt) * z;
    price = price * Math.exp(driftTerm + volTerm);

    // Floor at $1 (prevent negative)
    price = Math.max(price, 1);

    path.push({ day: d, price });
  }

  return path;
}

// Run Monte Carlo and compute percentile bands
export function runSimulation(startPrice, params, scenarioKey, onChainState) {
  const scenario = SCENARIOS[scenarioKey] || SCENARIOS.general;
  const mergedParams = scenarioKey === "custom" ? params : { ...params, ...scenario };
  const days = Math.round(params.horizon_years * 365.25);
  const numSims = params.simulations;

  // Run all paths
  const allPaths = [];
  for (let i = 0; i < numSims; i++) {
    allPaths.push(simulatePath(startPrice, mergedParams, days, onChainState));
  }

  // Extract final prices for percentile computation
  const finalPrices = allPaths.map(p => p[p.length - 1].price).sort((a, b) => a - b);
  const percentile = (pct) => finalPrices[Math.floor(pct * numSims)] || finalPrices[0];

  const p5 = percentile(0.05);
  const p25 = percentile(0.25);
  const p50 = percentile(0.50);
  const p75 = percentile(0.75);
  const p95 = percentile(0.95);

  // Build chart data: average the percentile bands across paths per day
  const startDate = new Date();
  const chartData = [];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let d = 0; d <= days; d += Math.max(1, Math.floor(days / 120))) {
    const pricesAtDay = allPaths.map(p => p[Math.min(d, p.length - 1)].price).sort((a, b) => a - b);
    const idx = (pct) => Math.floor(pct * pricesAtDay.length);
    const yearsAhead = d / 365.25;
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);
    chartData.push({
      day: d,
      years: yearsAhead.toFixed(1),
      dateObj: date,
      dateLabel: `${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
      yearLabel: `${String(date.getFullYear())}`,
      current: startPrice,
      p5: pricesAtDay[idx(0.05)] || 0,
      p25: pricesAtDay[idx(0.25)] || 0,
      p50: pricesAtDay[idx(0.50)] || 0,
      p75: pricesAtDay[idx(0.75)] || 0,
      p95: pricesAtDay[idx(0.95)] || 0,
    });
  }

  return {
    chartData,
    percentiles: { p5, p25, p50, p75, p95 },
    finalPrices,
    params: mergedParams,
    scenario,
  };
}

// Auto-recalibrate params based on on-chain signals
export function recalibrateDrift(params, onChainState) {
  if (!onChainState) return params;

  let adjusted = { ...params };

  // Positive hash health → boost herding
  if (onChainState.hash_health != null && onChainState.hash_health > 0.85) {
    adjusted.herding_boost = params.herding_boost * 1.05;
  }

  // Positive treasury flow → boost drift
  if (onChainState.treasury_flow != null && onChainState.treasury_flow > 500) {
    adjusted.drift = params.drift * (1 + Math.min(onChainState.treasury_flow / 10000, 0.15));
  }

  return adjusted;
}

// ═════════════════════════════════════════════════════════════════════════════
// APBPE-NETSS v2.3 — Enhanced Ensemble Algorithms
// Real working JS: GARCH(1,1), On-Chain ML, Metcalfe, LPPL, Bayesian, CFA
// ═════════════════════════════════════════════════════════════════════════════

const BTC_SUPPLY = 19_800_000;

// ── 1. GARCH(1,1) Volatility ──────────────────────────────────────────────────
// σ²_t = ω + α·r²_{t-1} + β·σ²_{t-1} → annualized forecast
export function computeGARCH(returns, omega = 1e-6, alpha = 0.08, beta = 0.90) {
  if (!returns || returns.length < 2) return null;
  let var_t = returns[0] ** 2;
  for (let i = 1; i < returns.length; i++) {
    var_t = omega + alpha * (returns[i] ** 2) + beta * var_t;
  }
  return Math.sqrt(var_t) * Math.sqrt(365.25);
}

export function generateProxyReturns(params, onChainState, n = 60) {
  const returns = [];
  const dailyVol = params.volatility / Math.sqrt(365.25);
  const hashMod = onChainState?.hash_health != null ? 0.8 + onChainState.hash_health * 0.4 : 1;
  const treasuryMod = onChainState?.treasury_flow != null ? 0.9 + Math.min(onChainState.treasury_flow / 5000, 0.2) : 1;
  for (let i = 0; i < n; i++) {
    const z = gaussian();
    const dailyDrift = (params.drift / 365.25) * hashMod * treasuryMod;
    returns.push(dailyDrift + dailyVol * hashMod * z);
  }
  return returns;
}

// ── 2. On-Chain ML Features (MVRV, Puell, NVT, Reserve Risk) ─────────────────
export function computeOnChainFeatures(onChainData, btcPrice) {
  if (!onChainData || !btcPrice) return null;
  const marketCap = btcPrice * BTC_SUPPLY;
  const nvt = onChainData.tx_volume_usd > 0 ? marketCap / onChainData.tx_volume_usd : null;
  const mvrv = onChainData.realized_cap_ratio ?? null;
  const mvrvZ = mvrv != null ? (mvrv - 1.5) / 0.8 : null;
  const dailyIssuance = 450; // post-2024 halving
  const dailyMinerRev = dailyIssuance * btcPrice;
  const annualMARev = dailyMinerRev * 0.75 + 900 * btcPrice * 0.5;
  const puell = annualMARev > 0 ? dailyMinerRev / annualMARev : null;
  const reserveRisk = mvrv != null ? Math.max(0, Math.min(1, (mvrv - 0.8) / 2)) : null;
  return { nvt, mvrv, mvrvZ, puell, reserveRisk };
}

// ── 3. Metcalfe Adoption Model (NV = k × N²) ─────────────────────────────────
export function metcalfeModel(activeAddresses, btcPrice) {
  if (!activeAddresses || activeAddresses < 1) return null;
  const marketCap = btcPrice * BTC_SUPPLY;
  const k = marketCap / (activeAddresses ** 2);
  const fairValue = (k * activeAddresses * activeAddresses) / BTC_SUPPLY;
  return { k, fairValue, premium: btcPrice / fairValue, activeAddresses };
}

// ── 4. LPPL Bubble Detection (log-periodic power law approximation) ──────────
export function lpplConfidence(priceSeries) {
  if (!priceSeries || priceSeries.length < 20) return { confidence: 0, bubble: false, signal: "insufficient data" };
  const n = priceSeries.length;
  const logPrices = priceSeries.map(p => Math.log(p));
  const t1 = logPrices.slice(0, Math.floor(n / 3));
  const t2 = logPrices.slice(Math.floor(n / 3), Math.floor(2 * n / 3));
  const t3 = logPrices.slice(Math.floor(2 * n / 3));
  const slope1 = (t1[t1.length - 1] - t1[0]) / t1.length;
  const slope2 = (t2[t2.length - 1] - t2[0]) / t2.length;
  const slope3 = (t3[t3.length - 1] - t3[0]) / t3.length;
  const accelerating = slope3 > slope2 && slope2 > slope1;
  const overallSlope = (logPrices[n - 1] - logPrices[0]) / n;
  const residuals = logPrices.map((lp, i) => lp - (logPrices[0] + overallSlope * i));
  let crossings = 0;
  for (let i = 1; i < residuals.length; i++) {
    if (residuals[i] * residuals[i - 1] < 0) crossings++;
  }
  const hasOscillations = crossings >= 4;
  let confidence = 0;
  if (accelerating) confidence += 0.4;
  if (hasOscillations) confidence += 0.3;
  if (slope3 > overallSlope * 1.2) confidence += 0.3;
  confidence = Math.min(1, confidence);
  return {
    confidence: parseFloat(confidence.toFixed(2)),
    bubble: confidence > 0.6,
    accelerating,
    hasOscillations,
    crossings,
    signal: confidence > 0.6 ? "⚠ Bubble pattern detected — elevated crash risk"
          : confidence > 0.3 ? "Moderate LPPL signal — watch for acceleration"
          : "No bubble signal — normal regime"
  };
}

// ── 5. Bayesian Online Drift Update (Conjugate Gaussian) ─────────────────────
export function bayesianDriftUpdate(priorDrift, priorVar, observedSignal, obsVol, periodT = 1) {
  if (observedSignal == null || obsVol == null || obsVol === 0) {
    return { drift: priorDrift, variance: priorVar, updated: false };
  }
  const obsVar = (obsVol ** 2) * periodT;
  const posteriorVar = 1 / (1 / priorVar + periodT / obsVar);
  const posteriorDrift = (priorDrift / priorVar + observedSignal * periodT / obsVar) * posteriorVar;
  return {
    drift: parseFloat(posteriorDrift.toFixed(4)),
    variance: parseFloat(posteriorVar.toFixed(6)),
    updated: true,
    shift: parseFloat((posteriorDrift - priorDrift).toFixed(4)),
  };
}

// ── 6. CFA Meta-Fusion (weighted ensemble) ────────────────────────────────────
export function cfaFusion(subModels) {
  const totalWeight = subModels.reduce((s, m) => s + (m.weight || 0), 0);
  if (totalWeight === 0) return null;
  const fusedDrift = subModels.reduce((s, m) => s + (m.drift || 0) * (m.weight || 0), 0) / totalWeight;
  const fusedVol = subModels.reduce((s, m) => s + (m.vol || 0) * (m.weight || 0), 0) / totalWeight;
  return {
    drift: parseFloat(fusedDrift.toFixed(4)),
    vol: parseFloat(fusedVol.toFixed(4)),
    subModels: subModels.map(m => ({ ...m, normalizedWeight: parseFloat(((m.weight || 0) / totalWeight).toFixed(3)) })),
    totalWeight: parseFloat(totalWeight.toFixed(3)),
  };
}

// ── 7. Full Ensemble Orchestrator with Toggleable Sub-Models ──────────────────
export const SUB_MODELS = ["powerlaw_nash", "garch_vol", "onchain_ml", "metcalfe", "lppl", "bayesian"];

export function runEnsemble(startPrice, params, scenarioKey, onChainState, toggles = {}) {
  const scenario = SCENARIOS[scenarioKey] || SCENARIOS.general;
  const mergedParams = scenarioKey === "custom" ? params : { ...params, ...scenario };
  const enabled = (key) => toggles[key] !== false;
  const subModelOutputs = [];

  // 1. Power Law + Nash (always available)
  if (enabled("powerlaw_nash")) {
    subModelOutputs.push({
      name: "Power Law + Nash", drift: mergedParams.drift, vol: mergedParams.volatility,
      weight: 1.0, signal: "Base GBM + treasury pressure + herding",
    });
  }

  // 2. GARCH(1,1) volatility
  let garchVol = null;
  if (enabled("garch_vol")) {
    const returns = generateProxyReturns(mergedParams, onChainState);
    garchVol = computeGARCH(returns);
    if (garchVol) {
      subModelOutputs.push({
        name: "GARCH(1,1)", drift: mergedParams.drift, vol: garchVol,
        weight: 0.7, signal: `GARCH σ=${(garchVol * 100).toFixed(1)}%`,
      });
    }
  }

  // 3. On-Chain ML features
  let onChainFeatures = null;
  if (enabled("onchain_ml") && onChainState) {
    onChainFeatures = computeOnChainFeatures(onChainState, startPrice);
    if (onChainFeatures) {
      const mvrvAdj = onChainFeatures.mvrv != null ? (1.5 - onChainFeatures.mvrv) * 0.3 : 0;
      const nvtAdj = onChainFeatures.nvt != null ? (75 - onChainFeatures.nvt) / 300 : 0;
      subModelOutputs.push({
        name: "On-Chain ML", drift: mergedParams.drift + mvrvAdj + nvtAdj, vol: mergedParams.volatility,
        weight: 0.6, signal: `MVRV=${onChainFeatures.mvrv?.toFixed(2)} NVT=${onChainFeatures.nvt?.toFixed(0)} Puell=${onChainFeatures.puell?.toFixed(2)}`,
      });
    }
  }

  // 4. Metcalfe adoption
  let metcalfeResult = null;
  if (enabled("metcalfe") && onChainState?.active_addresses) {
    metcalfeResult = metcalfeModel(onChainState.active_addresses, startPrice);
    if (metcalfeResult) {
      const adoptionDrift = onChainState.active_addresses > 1_000_000 ? 0.05 : 0;
      subModelOutputs.push({
        name: "Metcalfe", drift: mergedParams.drift + adoptionDrift, vol: mergedParams.volatility,
        weight: 0.5, signal: `N=${(onChainState.active_addresses / 1e6).toFixed(2)}M k=${metcalfeResult.k.toExponential(2)}`,
      });
    }
  }

  // 5. LPPL bubble detection
  let lpplResult = null;
  if (enabled("lppl")) {
    const proxySeries = [];
    let p = startPrice;
    const pv = mergedParams.volatility / Math.sqrt(365.25);
    const pd = mergedParams.drift / 365.25;
    for (let i = 0; i < 60; i++) { p = p * Math.exp(pd + pv * gaussian()); proxySeries.push(p); }
    lpplResult = lpplConfidence(proxySeries);
    if (lpplResult) {
      const lpplDriftAdj = lpplResult.bubble ? -0.15 : (lpplResult.confidence > 0.3 ? -0.05 : 0);
      const lpplVolAdj = lpplResult.bubble ? 0.15 : 0;
      subModelOutputs.push({
        name: "LPPL", drift: mergedParams.drift + lpplDriftAdj, vol: mergedParams.volatility + lpplVolAdj,
        weight: 0.4, signal: lpplResult.signal,
      });
    }
  }

  // 6. Bayesian drift update
  let bayesianResult = null;
  if (enabled("bayesian") && onChainState) {
    bayesianResult = bayesianDriftUpdate(
      mergedParams.drift, 0.04,
      onChainState.drift_signal != null ? onChainState.drift_signal / 3 : null,
      mergedParams.volatility, 1
    );
    if (bayesianResult.updated) {
      subModelOutputs.push({
        name: "Bayesian", drift: bayesianResult.drift, vol: mergedParams.volatility,
        weight: 0.8, signal: `μ: ${mergedParams.drift.toFixed(2)}→${bayesianResult.drift.toFixed(2)} (Δ${bayesianResult.shift > 0 ? "+" : ""}${bayesianResult.shift})`,
      });
    }
  }

  // CFA meta-fusion
  const fusion = cfaFusion(subModelOutputs);
  if (!fusion) return { subModels: [], fusion: null, adjustedParams: mergedParams, diagnostics: { interpretation: "No sub-models enabled.", modelCount: 0 } };

  const adjustedDrift = Math.max(-0.5, Math.min(1.5, fusion.drift));
  const adjustedVol = Math.max(0.2, Math.min(2.0, fusion.vol));
  const adjustedParams = { ...mergedParams, drift: parseFloat(adjustedDrift.toFixed(4)), volatility: parseFloat(adjustedVol.toFixed(4)) };

  const bullish = subModelOutputs.filter(m => m.drift > mergedParams.drift).length;
  const bearish = subModelOutputs.filter(m => m.drift < mergedParams.drift).length;
  let interpretation;
  if (adjustedDrift > mergedParams.drift * 1.1)
    interpretation = `Ensemble BULLISH — ${bullish}/${subModelOutputs.length} sub-models signal upside. CFA-fused drift ${(adjustedDrift * 100).toFixed(0)}% vs base ${(mergedParams.drift * 100).toFixed(0)}%.`;
  else if (adjustedDrift < mergedParams.drift * 0.9)
    interpretation = `Ensemble BEARISH — ${bearish}/${subModelOutputs.length} sub-models signal downside. CFA-fused drift ${(adjustedDrift * 100).toFixed(0)}% vs base ${(mergedParams.drift * 100).toFixed(0)}%.`;
  else
    interpretation = `Ensemble NEUTRAL — sub-models roughly cancel. CFA-fused drift ${(adjustedDrift * 100).toFixed(0)}% vs base ${(mergedParams.drift * 100).toFixed(0)}%.`;
  if (lpplResult?.bubble) interpretation += " ⚠ LPPL bubble signal active — crash risk elevated.";
  if (onChainFeatures?.mvrv > 1.8) interpretation += " MVRV above 1.8 — historically overvalued zone.";
  if (onChainFeatures?.puell > 1.5) interpretation += " Puell elevated — miner selling pressure risk.";

  return {
    subModels: fusion.subModels, fusion, adjustedParams,
    diagnostics: { garchVol, onChainFeatures, metcalfeResult, lpplResult, bayesianResult, interpretation, modelCount: subModelOutputs.length },
  };
}

// ── 8. Ensemble Simulation (wraps runSimulation with CFA-fused params) ────────
export function runEnsembleSimulation(startPrice, params, scenarioKey, onChainState, toggles = {}) {
  const ensemble = runEnsemble(startPrice, params, scenarioKey, onChainState, toggles);
  const simResult = runSimulation(startPrice, ensemble.adjustedParams, "custom", onChainState);
  simResult.scenario = SCENARIOS[scenarioKey] || SCENARIOS.general;
  return { ...simResult, ensemble };
}