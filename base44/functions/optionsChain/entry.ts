/**
 * Options Chain — Multi-source with fallbacks
 * 1. Polygon (if key has options access)
 * 2. Yahoo Finance v8 with consent cookie workaround
 * 3. yh-finance RapidAPI proxy (free tier, set RAPIDAPI_KEY secret)
 */

const POLYGON_KEY = Deno.env.get("POLYGON_API_KEY");
const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");

// ── Yahoo Finance: get consent cookie then options ──────────────────────────
async function yahooGetConsentCookie() {
  // Yahoo now requires consent page — use a known working public crumb approach
  const res = await fetch("https://finance.yahoo.com/quote/AAPL/options/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });
  const cookieHeader = res.headers.get("set-cookie") ?? "";
  // Extract all cookies
  const cookies = cookieHeader.split(/,\s*(?=[A-Za-z_]+=)/)
    .map(c => c.split(";")[0])
    .join("; ");
  const html = await res.text();
  // Extract crumb from page
  const crumbMatch = html.match(/"crumb":"([^"]+)"/);
  return { cookies, crumb: crumbMatch?.[1] ?? null };
}

async function yahooOptionsWithConsent(ticker, dateTs = null) {
  const { cookies, crumb } = await yahooGetConsentCookie();
  if (!crumb) throw new Error("Could not extract Yahoo crumb");
  let url = `https://query1.finance.yahoo.com/v8/finance/options/${ticker}?crumb=${encodeURIComponent(crumb)}`;
  if (dateTs) url += `&date=${dateTs}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Cookie": cookies,
      "Accept": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const data = await res.json();
  return data?.optionChain?.result?.[0];
}

// ── RapidAPI: yh-finance (free 500 req/month) ──────────────────────────────
async function rapidApiOptions(ticker, expiration = null) {
  let url = `https://yh-finance.p.rapidapi.com/stock/v3/get-options?symbol=${ticker}&region=US`;
  if (expiration) url += `&date=${expiration}`;
  const res = await fetch(url, {
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": "yh-finance.p.rapidapi.com",
    },
  });
  if (!res.ok) throw new Error(`RapidAPI HTTP ${res.status}`);
  const data = await res.json();
  return data?.optionChain?.result?.[0];
}

// ── Polygon options (requires options add-on) ──────────────────────────────
async function polygonExpirations(ticker) {
  const url = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${ticker}&expired=false&limit=100&apiKey=${POLYGON_KEY}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Polygon HTTP ${res.status}`);
  const data = await res.json();
  return [...new Set((data.results ?? []).map(c => c.expiration_date))].sort().slice(0, 20);
}

async function polygonChain(ticker, expiration, contractType) {
  let url = `https://api.polygon.io/v3/snapshot/options/${ticker}?limit=80&contract_type=${contractType}&apiKey=${POLYGON_KEY}`;
  if (expiration) url += `&expiration_date=${expiration}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Polygon HTTP ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

async function polygonPrice(ticker) {
  const res = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_KEY}`, { headers: { Accept: "application/json" } });
  const data = await res.json();
  return data.ticker?.day?.c || data.ticker?.prevDay?.c || null;
}

// ── Normalizers ────────────────────────────────────────────────────────────
function normalizeYahoo(c, type) {
  const bid = c.bid ?? 0, ask = c.ask ?? 0;
  return {
    ticker: c.contractSymbol ?? "",
    contract_type: type,
    expiration_date: c.expiration ? new Date(c.expiration * 1000).toISOString().split("T")[0] : "",
    strike_price: c.strike ?? 0,
    shares_per_contract: 100,
    last_price: c.lastPrice ?? 0,
    bid, ask,
    mid: bid && ask ? +((bid + ask) / 2).toFixed(2) : (c.lastPrice ?? 0),
    volume: c.volume ?? 0,
    open_interest: c.openInterest ?? 0,
    iv: c.impliedVolatility != null ? +(c.impliedVolatility * 100).toFixed(1) : null,
    delta: null, gamma: null, theta: null, vega: null,
    in_the_money: c.inTheMoney ?? false,
  };
}

function normalizePolygon(c) {
  const bid = c.last_quote?.bid ?? 0, ask = c.last_quote?.ask ?? 0;
  return {
    ticker: c.details?.ticker ?? "",
    contract_type: c.details?.contract_type ?? "",
    expiration_date: c.details?.expiration_date ?? "",
    strike_price: c.details?.strike_price ?? 0,
    shares_per_contract: 100,
    last_price: c.day?.close ?? 0,
    bid, ask,
    mid: bid && ask ? +((bid + ask) / 2).toFixed(2) : (c.day?.close ?? 0),
    volume: c.day?.volume ?? 0,
    open_interest: c.open_interest ?? 0,
    iv: c.implied_volatility != null ? +(c.implied_volatility * 100).toFixed(1) : null,
    delta: c.greeks?.delta ?? null,
    gamma: c.greeks?.gamma ?? null,
    theta: c.greeks?.theta ?? null,
    vega: c.greeks?.vega ?? null,
    in_the_money: false,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { ticker = "MSTR", expiration = null, action = "chain" } = body;
    const sym = ticker.toUpperCase();

    // Determine source priority
    const useRapid = !!RAPIDAPI_KEY;
    const usePolygon = !!POLYGON_KEY;

    // ── EXPIRATIONS ──
    if (action === "expirations") {
      let expirations = [], underlyingPrice = null, source = "";

      if (useRapid) {
        try {
          const result = await rapidApiOptions(sym);
          expirations = (result?.expirationDates ?? []).map(ts => new Date(ts * 1000).toISOString().split("T")[0]).slice(0, 20);
          underlyingPrice = result?.quote?.regularMarketPrice ?? null;
          source = "RapidAPI / Yahoo Finance";
        } catch (e) { /* fall through */ }
      }

      if (!expirations.length) {
        try {
          const result = await yahooOptionsWithConsent(sym);
          expirations = (result?.expirationDates ?? []).map(ts => new Date(ts * 1000).toISOString().split("T")[0]).slice(0, 20);
          underlyingPrice = result?.quote?.regularMarketPrice ?? null;
          source = "Yahoo Finance";
        } catch (e) { /* fall through */ }
      }

      if (!expirations.length && usePolygon) {
        try {
          expirations = await polygonExpirations(sym);
          underlyingPrice = await polygonPrice(sym).catch(() => null);
          source = "Polygon.io";
        } catch (e) { /* fall through */ }
      }

      if (!expirations.length) throw new Error("No options data available. Add a RAPIDAPI_KEY secret for free Yahoo Finance options access.");

      return Response.json({ ticker: sym, expirations, underlyingPrice, source });
    }

    // ── FULL CHAIN ──
    let calls = [], puts = [], underlyingPrice = null, source = "";

    if (useRapid) {
      try {
        const dateTs = expiration ? Math.floor(new Date(expiration).getTime() / 1000) : null;
        const result = await rapidApiOptions(sym, dateTs);
        underlyingPrice = result?.quote?.regularMarketPrice ?? null;
        const opts = result?.options?.[0] ?? {};
        calls = (opts.calls ?? []).map(c => normalizeYahoo(c, "call"));
        puts = (opts.puts ?? []).map(c => normalizeYahoo(c, "put"));
        source = "RapidAPI / Yahoo Finance";
      } catch (e) { /* fall through */ }
    }

    if (!calls.length) {
      try {
        const dateTs = expiration ? Math.floor(new Date(expiration).getTime() / 1000) : null;
        const result = await yahooOptionsWithConsent(sym, dateTs);
        underlyingPrice = result?.quote?.regularMarketPrice ?? null;
        const opts = result?.options?.[0] ?? {};
        calls = (opts.calls ?? []).map(c => normalizeYahoo(c, "call"));
        puts = (opts.puts ?? []).map(c => normalizeYahoo(c, "put"));
        source = "Yahoo Finance";
      } catch (e) { /* fall through */ }
    }

    if (!calls.length && usePolygon) {
      try {
        const [rawCalls, rawPuts, price] = await Promise.all([
          polygonChain(sym, expiration, "call"),
          polygonChain(sym, expiration, "put"),
          polygonPrice(sym).catch(() => null),
        ]);
        calls = rawCalls.map(normalizePolygon);
        puts = rawPuts.map(normalizePolygon);
        underlyingPrice = price;
        source = "Polygon.io";
      } catch (e) { /* fall through */ }
    }

    if (!calls.length && !puts.length) {
      throw new Error("No options chain data available. Add a RAPIDAPI_KEY secret (free at rapidapi.com) for Yahoo Finance options access.");
    }

    calls.sort((a, b) => a.strike_price - b.strike_price);
    puts.sort((a, b) => a.strike_price - b.strike_price);

    return Response.json({
      ticker: sym, underlying_price: underlyingPrice, expiration_date: expiration,
      calls, puts, total_calls: calls.length, total_puts: puts.length,
      fetched_at: new Date().toISOString(), source,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});