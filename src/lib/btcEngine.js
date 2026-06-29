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