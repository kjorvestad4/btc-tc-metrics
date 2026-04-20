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
 * Fetch stock price from Yahoo Finance (no key required) via CORS proxy
 */
export async function fetchYahooPrice(ticker) {
  const res = await fetch(
    `https://corsproxy.io/?url=https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Yahoo ${ticker}: ${res.status}`);
  const data = await res.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  if (!price) throw new Error(`Yahoo: no price for ${ticker}`);
  return price;
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
  const price = data.results?.[0]?.c ?? null; // closing price
  if (!price) throw new Error(`Polygon: no close price for ${ticker} (status: ${data.status})`);
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
 * Fetch all live market data.
 * All stock prices go through the backend polygonProxy (Yahoo primary, Polygon fallback).
 * BTC comes from CoinGecko public API directly. Holdings scraped from strategy.com.
 */
export async function fetchAllMarketData() {
  const [holdingsResult, polyResult] = await Promise.allSettled([
    fetchStrategyHoldings(),
    import("@/api/base44Client").then(({ base44 }) =>
      base44.functions.invoke("polygonProxy", {}).then(r => r.data)
    ),
  ]);

  const errors = [];
  if (holdingsResult.status === "rejected") errors.push(`HOLDINGS: ${holdingsResult.reason?.message}`);
  if (polyResult.status === "rejected") errors.push(`PROXY: ${polyResult.reason?.message}`);

  const poly = polyResult.status === "fulfilled" ? (polyResult.value ?? {}) : {};
  const prices = poly.prices ?? {};

  return {
    btc_price: poly.btc ?? null,
    btc_holdings: holdingsResult.status === "fulfilled" ? holdingsResult.value : null,
    mstr_price: prices.MSTR ?? null,
    msty_price: prices.MSTY ?? null,
    asst_price: prices.ASST ?? null,
    strc_price: prices.STRC ?? null,
    strf_price: prices.STRF ?? null,
    strk_price: prices.STRK ?? null,
    strd_price: prices.STRD ?? null,
    sata_price: prices.SATA ?? null,
    strc_data: prices.STRC ? { price: prices.STRC } : null,
    strf_data: prices.STRF ? { price: prices.STRF } : null,
    strk_data: prices.STRK ? { price: prices.STRK } : null,
    strd_data: prices.STRD ? { price: prices.STRD } : null,
    price_sources: poly.sources ?? {},
    mstr_iv: poly.iv ?? null,
    msty_dividends: poly.divs ?? null,
    msty_latest_div: poly.divs?.[0]?.amount ?? null,
    polygon_used: true,
    errors,
  };
}