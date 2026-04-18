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
 */
export async function fetchAllMarketData(polygonKey = null) {
  const tasks = {
    btc: fetchBTCPrice(),
    holdings: fetchStrategyHoldings(),
  };

  // Add Polygon tasks only if key is provided
  if (polygonKey) {
    tasks.mstr = fetchPolygonPrice("MSTR", polygonKey);
    tasks.msty = fetchPolygonPrice("MSTY", polygonKey);
    tasks.asst = fetchPolygonPrice("ASST", polygonKey);
    tasks.strc = fetchPolygonPrice("STRC", polygonKey);
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

  // Build unified output
  return {
    btc_price: results.btc ?? null,
    btc_holdings: results.holdings ?? null,
    mstr_price: results.mstr ?? null,
    msty_price: results.msty ?? null,
    asst_price: results.asst ?? null,
    strc_price: results.strc ?? null,
    sata_price: results.sata ?? null,
    mstr_iv: results.iv ?? null,
    msty_dividends: results.divs ?? null,
    msty_latest_div: results.divs?.[0]?.amount ?? null,
    polygon_used: !!polygonKey,
    errors,
  };
}