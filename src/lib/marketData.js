/**
 * Market Data Fetchers — PunterJeff MSTR Projection Engine
 * Supports: CoinGecko (BTC), Strategy.com scraper (holdings), Polygon.io (MSTR/MSTY/IV/dividends)
 */

// Known MSTY weekly distribution history (last 8 weeks, updated to April 2026)
export const MSTY_DISTRIBUTION_HISTORY = [
  { ex_date: "2026-04-09", amount: 0.3051, frequency: "weekly" },
  { ex_date: "2026-04-02", amount: 0.2987, frequency: "weekly" },
  { ex_date: "2026-03-26", amount: 0.3124, frequency: "weekly" },
  { ex_date: "2026-03-19", amount: 0.2876, frequency: "weekly" },
  { ex_date: "2026-03-12", amount: 0.3210, frequency: "weekly" },
  { ex_date: "2026-03-05", amount: 0.2994, frequency: "weekly" },
  { ex_date: "2026-02-26", amount: 0.3088, frequency: "weekly" },
  { ex_date: "2026-02-19", amount: 0.2845, frequency: "weekly" },
];

/**
 * Fetch live BTC price from CoinGecko public API (no key required)
 */
export async function fetchBTCPrice() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();
  return data.bitcoin.usd;
}

/**
 * Scrape Strategy.com /purchases page for BTC holdings
 * Parses the latest total BTC held from public page
 */
export async function fetchStrategyHoldings() {
  try {
    const res = await fetch("https://corsproxy.io/?url=https://www.strategy.com/purchases", {
      headers: { Accept: "text/html" },
    });
    if (!res.ok) throw new Error(`Strategy scrape ${res.status}`);
    const html = await res.text();
    // Look for total BTC pattern like "780,897" or "Total Bitcoin: 780,897"
    const patterns = [
      /Total(?:\s+Bitcoin)?[:\s]+([0-9,]+)/i,
      /([0-9]{3},[0-9]{3})\s*BTC/,
      /holdings[:\s]+([0-9,]+)/i,
    ];
    for (const pat of patterns) {
      const m = html.match(pat);
      if (m) {
        const val = parseInt(m[1].replace(/,/g, ""));
        if (val > 100000 && val < 2000000) return val;
      }
    }
    throw new Error("Holdings pattern not found");
  } catch {
    throw new Error("Strategy.com scrape failed");
  }
}

/**
 * Scrape a single preferred's price + vol from strategy.com/learn page
 * Returns { price, vol_30d, current_yield, yield_pct } or null on failure
 */
export async function fetchStrategyPreferred(ticker) {
  const url = `https://corsproxy.io/?url=https://www.strategy.com/${ticker.toLowerCase()}/learn`;
  try {
    const res = await fetch(url, { headers: { Accept: "text/html" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Extract price — looks like: Price\n\n$99.21
    const priceMatch = html.match(/Price\s*[^$]*\$([0-9]+\.[0-9]{2})/i);
    const price = priceMatch ? parseFloat(priceMatch[1]) : null;

    // Extract 30D Historical Volatility — looks like: Hist Volatility (30D)\n\n3%
    const volMatch = html.match(/Hist\s+Volatility\s+\(30D\)\s*[^0-9]*([0-9]+)%/i);
    const vol_30d = volMatch ? parseFloat(volMatch[1]) : null;

    // Extract Effective Yield — looks like: Effective Yield\n\n11.59%
    const yieldMatch = html.match(/Effective\s+Yield\s*[^0-9]*([0-9]+\.[0-9]+)%/i);
    const current_yield = yieldMatch ? parseFloat(yieldMatch[1]) : null;

    if (!price) throw new Error("Price not found");
    return { price, vol_30d, current_yield };
  } catch {
    return null;
  }
}

/**
 * Fetch all Strategy.com preferred prices in parallel
 * Returns object keyed by lowercase ticker, e.g. { strc: { price, vol_30d, current_yield }, ... }
 */
export async function fetchStrategyPreferreds() {
  const tickers = ["STRC", "STRF", "STRK", "STRD"];
  const results = await Promise.allSettled(tickers.map((t) => fetchStrategyPreferred(t)));
  const out = {};
  tickers.forEach((t, i) => {
    if (results[i].status === "fulfilled" && results[i].value) {
      out[t.toLowerCase()] = results[i].value;
    }
  });
  return out;
}

/**
 * Fetch stock price from Polygon.io (requires API key)
 */
export async function fetchPolygonPrice(ticker, apiKey) {
  // Use previous close endpoint — more reliable than last trade for all tickers
  const res = await fetch(
    `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${apiKey}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Polygon price ${ticker}: ${res.status}`);
  const data = await res.json();
  if (data.status !== "OK" && data.resultsCount === 0) throw new Error(`Polygon: no data for ${ticker}`);
  const price = data.results?.[0]?.c ?? null; // closing price
  if (!price) throw new Error(`Polygon: no close price for ${ticker}`);
  return price;
}

/**
 * Fetch 30-day ATM implied volatility for MSTR from Polygon.io options chain
 */
export async function fetchPolygonIV(apiKey) {
  try {
    // Get ATM options snapshot for MSTR — nearest expiry ~30 DTE
    const today = new Date();
    const targetExp = new Date(today);
    targetExp.setDate(today.getDate() + 30);
    const expStr = targetExp.toISOString().split("T")[0];

    const res = await fetch(
      `https://api.polygon.io/v3/snapshot/options/MSTR?expiration_date.lte=${expStr}&limit=10&apiKey=${apiKey}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) throw new Error(`Polygon IV ${res.status}`);
    const data = await res.json();
    const results = data?.results ?? [];
    const ivs = results
      .map((r) => r?.details?.implied_volatility)
      .filter((v) => v != null && v > 0.1 && v < 5);
    if (ivs.length === 0) throw new Error("No IV data");
    const avgIV = (ivs.reduce((s, v) => s + v, 0) / ivs.length) * 100;
    return Math.round(avgIV);
  } catch {
    throw new Error("Polygon IV fetch failed");
  }
}

/**
 * Fetch latest MSTY dividends from Polygon.io (last 5 weekly distributions)
 */
export async function fetchPolygonDividends(apiKey) {
  const res = await fetch(
    `https://api.polygon.io/v3/reference/dividends?ticker=MSTY&limit=10&sort=ex_dividend_date&order=desc&apiKey=${apiKey}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Polygon dividends ${res.status}`);
  const data = await res.json();
  const results = data?.results ?? [];
  return results.slice(0, 5).map((d) => ({
    ex_date: d.ex_dividend_date,
    amount: d.cash_amount,
    frequency: "weekly",
  }));
}

/**
 * Fetch all live market data in parallel
 * polygonKey: optional — if missing, Polygon sources are skipped gracefully
 * Strategy.com scraper is always attempted for preferred prices (no key needed)
 */
export async function fetchAllMarketData(polygonKey = null) {
  const tasks = {
    btc: fetchBTCPrice(),
    holdings: fetchStrategyHoldings(),
    // Always scrape strategy.com for accurate preferred prices + vols
    preferreds: fetchStrategyPreferreds(),
  };

  // Add Polygon tasks only if key is provided
  if (polygonKey) {
    tasks.mstr = fetchPolygonPrice("MSTR", polygonKey);
    tasks.msty = fetchPolygonPrice("MSTY", polygonKey);
    tasks.asst = fetchPolygonPrice("ASST", polygonKey);
    // Polygon as fallback only for preferreds if scraper fails
    tasks.strc_poly = fetchPolygonPrice("STRC", polygonKey);
    tasks.strf_poly = fetchPolygonPrice("STRF", polygonKey);
    tasks.strk_poly = fetchPolygonPrice("STRK", polygonKey);
    tasks.strd_poly = fetchPolygonPrice("STRD", polygonKey);
    tasks.sata = fetchPolygonPrice("SATA", polygonKey);
    tasks.iv = fetchPolygonIV(polygonKey);
    tasks.divs = fetchPolygonDividends(polygonKey);
  }

  const keys = Object.keys(tasks);
  const settled = await Promise.allSettled(Object.values(tasks));

  const results = {};
  const errors = [];
  keys.forEach((key, i) => {
    if (settled[i].status === "fulfilled") {
      results[key] = settled[i].value;
    } else {
      errors.push(`${key.toUpperCase()}: ${settled[i].reason?.message ?? "failed"}`);
    }
  });

  // Preferred prices: strategy.com scraper first, Polygon fallback
  const prefs = results.preferreds ?? {};
  const strc = prefs.strc ?? (results.strc_poly ? { price: results.strc_poly } : null);
  const strf = prefs.strf ?? (results.strf_poly ? { price: results.strf_poly } : null);
  const strk = prefs.strk ?? (results.strk_poly ? { price: results.strk_poly } : null);
  const strd = prefs.strd ?? (results.strd_poly ? { price: results.strd_poly } : null);

  // Build unified output
  return {
    btc_price: results.btc ?? null,
    btc_holdings: results.holdings ?? null,
    mstr_price: results.mstr ?? null,
    msty_price: results.msty ?? null,
    asst_price: results.asst ?? null,
    // Preferred stocks — full object { price, vol_30d, current_yield } from strategy.com
    strc_data: strc,
    strf_data: strf,
    strk_data: strk,
    strd_data: strd,
    // Backward-compat price fields
    strc_price: strc?.price ?? null,
    strf_price: strf?.price ?? null,
    strk_price: strk?.price ?? null,
    strd_price: strd?.price ?? null,
    sata_price: results.sata ?? null,
    mstr_iv: results.iv ?? null,
    msty_dividends: results.divs ?? null,
    msty_latest_div: results.divs?.[0]?.amount ?? null,
    polygon_used: !!polygonKey,
    errors,
  };
}