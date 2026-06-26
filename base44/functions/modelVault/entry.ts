import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const POLYGON_KEY = Deno.env.get("POLYGON_API_KEY");

async function fetchJSON(url, headers = {}) {
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── On-chain polling (same as btcOnChain) ──────────────────────────────────
async function pollOnChain() {
  const [btcPrice, hashData, activeAddresses, txVolume] = await Promise.all([
    fetchBTCPrice().catch(() => null),
    fetchHashRate().catch(() => null),
    fetchActiveAddresses().catch(() => null),
    fetchTxVolume().catch(() => null),
  ]);

  let realized_cap_ratio = 1.18;
  try {
    const mcData = await fetchJSON("https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false");
    const mcap = mcData?.market_data?.market_cap?.usd;
    const rcap = mcData?.market_data?.fully_diluted_valuation?.usd ?? mcap;
    if (mcap && rcap) realized_cap_ratio = parseFloat((mcap / rcap).toFixed(2));
  } catch { /* keep default */ }

  const treasury_flow = Math.round(450 + Math.random() * 800);
  const hashHealth = hashData?.hash_health ?? 0.9;
  const treasuryBoost = Math.min(treasury_flow / 5000, 0.2);
  const drift_signal = parseFloat((hashHealth * 0.5 + treasuryBoost * 2 + 0.3).toFixed(2));

  return {
    btc_price: btcPrice,
    hash_rate: hashData?.hash_rate ?? null,
    hash_health: hashData?.hash_health ?? null,
    active_addresses: activeAddresses,
    tx_volume_usd: txVolume,
    treasury_flow,
    drift_signal,
    realized_cap_ratio,
    timestamp: new Date().toISOString(),
    polled: true,
  };
}

async function fetchBTCPrice() {
  try {
    const data = await fetchJSON("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
    if (data?.bitcoin?.usd) return data.bitcoin.usd;
  } catch { /* fall through */ }
  if (POLYGON_KEY) {
    try {
      const data = await fetchJSON(`https://api.polygon.io/v2/snapshot/locale/global/markets/crypto/tickers/X:BTCUSD?apiKey=${POLYGON_KEY}`);
      const price = data?.ticker?.day?.c || data?.ticker?.prevDay?.c;
      if (price) return price;
    } catch { /* fall through */ }
  }
  return null;
}

async function fetchHashRate() {
  try {
    const data = await fetchJSON("https://api.blockchain.info/charts/hash-rate?timespan=30days&format=json");
    const values = data?.values ?? [];
    if (!values.length) return null;
    const latest = values[values.length - 1]?.y ?? null;
    const prev = values[0]?.y ?? latest;
    if (!latest) return null;
    const changeRatio = prev > 0 ? latest / prev : 1;
    const hash_health = Math.min(1, Math.max(0, 0.5 + (changeRatio - 1) * 2));
    return { hash_rate: latest, hash_health: parseFloat(hash_health.toFixed(2)) };
  } catch { return null; }
}

async function fetchActiveAddresses() {
  try {
    const data = await fetchJSON("https://api.blockchain.info/charts/n-unique-addresses?timespan=7days&format=json");
    const values = data?.values ?? [];
    if (!values.length) return null;
    const recent = values.slice(-7).map(v => v.y);
    return Math.round(recent.reduce((s, v) => s + v, 0) / recent.length);
  } catch { return null; }
}

async function fetchTxVolume() {
  try {
    const data = await fetchJSON("https://api.blockchain.info/charts/estimated-transaction-volume-usd?timespan=1days&format=json");
    const values = data?.values ?? [];
    if (!values.length) return null;
    return Math.round(values[values.length - 1]?.y ?? 0);
  } catch { return null; }
}

// ── Monte Carlo simulation (inlined from lib/btcEngine.js) ────────────────
const SCENARIOS = {
  general: { drift: 0.35, volatility: 0.65, herding_boost: 2.8, beta1: 5.45, treasury_pressure: 0, hash_shock: 0 },
  high_treasury_nash: { drift: 0.55, volatility: 0.72, herding_boost: 3.6, beta1: 6.1, treasury_pressure: 1200, hash_shock: 0 },
  miner_capitulation: { drift: -0.15, volatility: 0.85, herding_boost: 1.9, beta1: 4.8, treasury_pressure: 200, hash_shock: -0.35 },
  "2028_shock": { drift: 0.45, volatility: 0.95, herding_boost: 3.2, beta1: 5.7, treasury_pressure: 800, hash_shock: -0.1 },
  custom: { drift: 0.40, volatility: 0.70, herding_boost: 2.8, beta1: 5.45, treasury_pressure: 500, hash_shock: 0 },
};

function gaussian() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function simulatePath(startPrice, params, days, onChainState) {
  const dt = 1 / 365.25;
  let price = startPrice;
  const finalPrices = [];

  const hashMultiplier = onChainState?.hash_health != null ? 1 + (onChainState.hash_health - 0.5) * 0.3 : 1;
  const treasuryMultiplier = onChainState?.treasury_flow != null ? 1 + Math.min(onChainState.treasury_flow / 5000, 0.2) : 1;

  let prevPrice = startPrice;
  for (let d = 1; d <= days; d++) {
    const z = gaussian();
    const recentReturn = d > 1 ? Math.log(price / prevPrice) : 0;
    const herdingFactor = 1 + params.herding_boost * recentReturn * 0.5;
    const treasuryDrift = (params.treasury_pressure / 1e6) * 365.25;
    const hashDrift = params.hash_shock * (d < 60 ? (60 - d) / 60 : 0);
    const effectiveDrift = (params.drift * hashMultiplier * treasuryMultiplier + treasuryDrift + hashDrift) * herdingFactor;
    const effectiveVol = params.volatility;
    const driftTerm = (effectiveDrift - 0.5 * effectiveVol * effectiveVol) * dt;
    const volTerm = effectiveVol * Math.sqrt(dt) * z;
    prevPrice = price;
    price = Math.max(price * Math.exp(driftTerm + volTerm), 1);
  }
  return price;
}

function runSimulation(startPrice, params, scenarioKey, onChainState, numSims = 200) {
  const scenario = SCENARIOS[scenarioKey] || SCENARIOS.general;
  const mergedParams = scenarioKey === "custom" ? params : { ...params, ...scenario };
  const days = Math.round((params.horizon_years ?? 3.5) * 365.25);
  const finalPrices = [];
  for (let i = 0; i < numSims; i++) {
    finalPrices.push(simulatePath(startPrice, mergedParams, days, onChainState));
  }
  finalPrices.sort((a, b) => a - b);
  const idx = (pct) => finalPrices[Math.floor(pct * numSims)] || finalPrices[0];
  return {
    p5: idx(0.05), p25: idx(0.25), p50: idx(0.50), p75: idx(0.75), p95: idx(0.95),
  };
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch { /* no body */ }
    const action = body.action || "daily";

    // ── SAVE: serialize current engine state from frontend ──
    if (action === "save") {
      const vaultKey = body.vault_key || "apbpe_netss_v2";
      const params = body.params || {};
      const scenario = body.scenario || "custom";
      const tags = body.tags || ["charting", "treasury", "realtime"];
      const onChainSnapshot = body.on_chain_snapshot || null;

      const existing = await base44.asServiceRole.entities.ModelVault.filter({ vault_key: vaultKey });
      const record = {
        vault_key: vaultKey,
        model_name: body.model_name || "BTC Price Engine",
        version: body.version || "v2.1",
        serialized_params: JSON.stringify(params),
        scenario,
        on_chain_snapshot: onChainSnapshot ? JSON.stringify(onChainSnapshot) : null,
        simulation_result: null,
        btc_price: body.btc_price ?? null,
        tags,
        source: "manual",
      };

      if (existing?.length > 0) {
        const updated = await base44.asServiceRole.entities.ModelVault.update(existing[0].id, record);
        return Response.json({ status: "updated", record: updated });
      } else {
        const created = await base44.asServiceRole.entities.ModelVault.create(record);
        return Response.json({ status: "created", record: created });
      }
    }

    // ── DAILY: poll on-chain + run simulation + save to vault ──
    if (action === "daily") {
      const onChain = await pollOnChain();
      const btcPrice = onChain.btc_price ?? 85000;
      const scenarioKey = "high_treasury_nash";
      const params = { horizon_years: 3.5, simulations: 200, ...SCENARIOS[scenarioKey] };
      const simResult = runSimulation(btcPrice, params, scenarioKey, onChain, 200);

      const vaultKey = "apbpe_netss_v2";
      const record = {
        vault_key: vaultKey,
        model_name: "BTC Price Engine",
        version: "v2.1",
        serialized_params: JSON.stringify(params),
        scenario: scenarioKey,
        on_chain_snapshot: JSON.stringify(onChain),
        simulation_result: JSON.stringify(simResult),
        btc_price: btcPrice,
        tags: ["charting", "treasury", "realtime"],
        source: "scheduled",
      };

      // Upsert by vault_key
      const existing = await base44.asServiceRole.entities.ModelVault.filter({ vault_key: vaultKey });
      let saved;
      if (existing?.length > 0) {
        saved = await base44.asServiceRole.entities.ModelVault.update(existing[0].id, record);
      } else {
        saved = await base44.asServiceRole.entities.ModelVault.create(record);
      }

      return Response.json({
        status: "daily_complete",
        vault: saved,
        on_chain: onChain,
        simulation: simResult,
      });
    }

    // ── LIST: return vault records ──
    if (action === "list") {
      const records = await base44.asServiceRole.entities.ModelVault.list('-updated_date', 20);
      return Response.json({ records });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});