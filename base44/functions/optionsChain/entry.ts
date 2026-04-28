/**
 * Options Chain Proxy — Polygon.io
 * Fetches live options chain (calls + puts) for a given underlying ticker.
 * Also returns Greeks, IV, OI, volume via the Polygon v3 options snapshot API.
 */

const POLYGON_KEY = Deno.env.get("POLYGON_API_KEY");

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Fetch underlying stock price via Polygon snapshot
async function getUnderlyingPrice(ticker) {
  const data = await fetchJSON(
    `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_KEY}`
  );
  return (
    data.ticker?.day?.c ||
    data.ticker?.prevDay?.c ||
    data.ticker?.lastTrade?.p ||
    null
  );
}

// Fetch options contracts for a ticker, optionally filtered by expiration date
async function fetchOptionsChain({ ticker, expiration, contractType, limit = 100 }) {
  let url = `https://api.polygon.io/v3/snapshot/options/${ticker}?limit=${limit}&apiKey=${POLYGON_KEY}`;
  if (expiration) url += `&expiration_date=${expiration}`;
  if (contractType) url += `&contract_type=${contractType}`;

  const data = await fetchJSON(url);
  return data.results ?? [];
}

// Fetch available expiration dates for a ticker
async function fetchExpirations(ticker) {
  const url = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${ticker}&expired=false&limit=100&apiKey=${POLYGON_KEY}`;
  const data = await fetchJSON(url);
  const dates = [...new Set((data.results ?? []).map(c => c.expiration_date))].sort();
  return dates.slice(0, 20); // Return up to 20 nearest expirations
}

Deno.serve(async (req) => {
  try {
    if (!POLYGON_KEY) {
      return Response.json({ error: "POLYGON_API_KEY not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { ticker = "MSTR", expiration = null, action = "chain" } = body;

    const underlyingTicker = ticker.toUpperCase();

    if (action === "expirations") {
      // Just return available expiration dates
      const [expirations, underlyingPrice] = await Promise.all([
        fetchExpirations(underlyingTicker),
        getUnderlyingPrice(underlyingTicker).catch(() => null),
      ]);
      return Response.json({ ticker: underlyingTicker, expirations, underlyingPrice });
    }

    // Full chain fetch — calls + puts in parallel
    const [underlyingPrice, calls, puts] = await Promise.all([
      getUnderlyingPrice(underlyingTicker).catch(() => null),
      fetchOptionsChain({ ticker: underlyingTicker, expiration, contractType: "call", limit: 80 }),
      fetchOptionsChain({ ticker: underlyingTicker, expiration, contractType: "put", limit: 80 }),
    ]);

    // Normalize contract data
    const normalize = (contracts) =>
      contracts.map((c) => ({
        ticker: c.details?.ticker ?? "",
        contract_type: c.details?.contract_type ?? "",
        expiration_date: c.details?.expiration_date ?? "",
        strike_price: c.details?.strike_price ?? 0,
        shares_per_contract: c.details?.shares_per_contract ?? 100,
        // Market data
        last_price: c.last_quote?.ask ?? c.day?.close ?? 0,
        bid: c.last_quote?.bid ?? 0,
        ask: c.last_quote?.ask ?? 0,
        mid: c.last_quote?.bid != null && c.last_quote?.ask != null
          ? (c.last_quote.bid + c.last_quote.ask) / 2
          : (c.day?.close ?? 0),
        volume: c.day?.volume ?? 0,
        open_interest: c.open_interest ?? 0,
        // Greeks
        iv: c.implied_volatility != null ? +(c.implied_volatility * 100).toFixed(1) : null,
        delta: c.greeks?.delta ?? null,
        gamma: c.greeks?.gamma ?? null,
        theta: c.greeks?.theta ?? null,
        vega: c.greeks?.vega ?? null,
        // Computed
        intrinsic_value: null, // computed client-side with underlying price
        itm: null, // computed client-side
      }));

    const normalizedCalls = normalize(calls);
    const normalizedPuts = normalize(puts);

    // Sort by strike
    normalizedCalls.sort((a, b) => a.strike_price - b.strike_price);
    normalizedPuts.sort((a, b) => a.strike_price - b.strike_price);

    return Response.json({
      ticker: underlyingTicker,
      underlying_price: underlyingPrice,
      expiration_date: expiration,
      calls: normalizedCalls,
      puts: normalizedPuts,
      total_calls: normalizedCalls.length,
      total_puts: normalizedPuts.length,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});