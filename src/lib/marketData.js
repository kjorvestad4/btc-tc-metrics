/**
 * Market Data Fetchers — PunterJeff MSTR Projection Engine
 * Uses public APIs (no keys required for BTC/Yahoo Finance)
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
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
  const data = await res.json();
  return data.bitcoin.usd;
}

/**
 * Fetch MSTR + MSTY prices via Yahoo Finance v8 (public, no key)
 */
async function fetchYahooPrice(ticker) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Yahoo Finance error for ${ticker}: ${res.status}`);
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`No data returned for ${ticker}`);
  return {
    price: meta.regularMarketPrice ?? meta.previousClose,
    previousClose: meta.previousClose,
    ticker,
  };
}

/**
 * Fetch MSTY dividend data (latest distribution from Yahoo Finance)
 */
async function fetchMSTYDividend() {
  // Yahoo Finance v8 dividend events
  const res = await fetch(
    "https://query1.finance.yahoo.com/v8/finance/chart/MSTY?events=dividends&interval=1wk&range=3mo",
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Yahoo dividend error: ${res.status}`);
  const data = await res.json();
  const events = data?.chart?.result?.[0]?.events?.dividends;
  if (!events) return null;

  const sorted = Object.values(events).sort((a, b) => b.date - a.date);
  return sorted[0]?.amount ?? null;
}

/**
 * Fetch all live market data in parallel
 * Returns partial results on failure (falls back gracefully per field)
 */
export async function fetchAllMarketData() {
  const results = await Promise.allSettled([
    fetchBTCPrice(),
    fetchYahooPrice("MSTR"),
    fetchYahooPrice("MSTY"),
    fetchMSTYDividend(),
  ]);

  const [btcResult, mstrResult, mstyResult, mstyDivResult] = results;

  return {
    btc_price: btcResult.status === "fulfilled" ? btcResult.value : null,
    mstr_price: mstrResult.status === "fulfilled" ? mstrResult.value.price : null,
    msty_price: mstyResult.status === "fulfilled" ? mstyResult.value.price : null,
    msty_latest_div: mstyDivResult.status === "fulfilled" ? mstyDivResult.value : null,
    errors: results
      .map((r, i) => (r.status === "rejected" ? ["BTC", "MSTR", "MSTY", "MSTY Div"][i] : null))
      .filter(Boolean),
  };
}