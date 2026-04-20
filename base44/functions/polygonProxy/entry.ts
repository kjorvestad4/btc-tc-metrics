import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const POLYGON_KEY = Deno.env.get("POLYGON_API_KEY");

async function fetchJSON(url, headers = {}) {
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Yahoo Finance — server-side (no CORS issues)
async function yahooPrice(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
  const data = await fetchJSON(url, {
    "User-Agent": "Mozilla/5.0",
    "Accept-Language": "en-US,en;q=0.9",
  });
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  if (!price) throw new Error(`Yahoo: no price for ${ticker}`);
  return price;
}

// Polygon snapshot (live/delayed price)
async function polygonPrice(ticker) {
  const data = await fetchJSON(
    `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_KEY}`
  );
  const price =
    data.ticker?.day?.c ||
    data.ticker?.prevDay?.c ||
    data.ticker?.lastTrade?.p ||
    null;
  if (!price) throw new Error(`Polygon: no price for ${ticker}`);
  return price;
}

// Try Yahoo first, fall back to Polygon
async function getPrice(ticker) {
  try {
    const p = await yahooPrice(ticker);
    return { ticker, price: p, source: "yahoo" };
  } catch {
    try {
      const p = await polygonPrice(ticker);
      return { ticker, price: p, source: "polygon" };
    } catch {
      return { ticker, price: null, source: "failed" };
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const tickers = ["MSTR", "MSTY", "ASST", "STRC", "STRF", "STRK", "STRD", "SATA"];

    // Fetch all prices in parallel (Yahoo primary, Polygon fallback)
    const priceResults = await Promise.all(tickers.map(getPrice));

    // IV from Polygon options
    const ivPromise = POLYGON_KEY
      ? (async () => {
          try {
            const today = new Date();
            const exp = new Date(today);
            exp.setDate(today.getDate() + 30);
            const expStr = exp.toISOString().split("T")[0];
            const data = await fetchJSON(
              `https://api.polygon.io/v3/snapshot/options/MSTR?expiration_date.lte=${expStr}&limit=10&apiKey=${POLYGON_KEY}`
            );
            const ivs = (data.results ?? [])
              .map(r => r?.details?.implied_volatility)
              .filter(v => v != null && v > 0.1 && v < 5);
            if (!ivs.length) return null;
            return Math.round((ivs.reduce((s, v) => s + v, 0) / ivs.length) * 100);
          } catch { return null; }
        })()
      : Promise.resolve(null);

    // MSTY dividends from Polygon
    const divsPromise = POLYGON_KEY
      ? fetchJSON(
          `https://api.polygon.io/v3/reference/dividends?ticker=MSTY&limit=10&sort=ex_dividend_date&order=desc&apiKey=${POLYGON_KEY}`
        ).then(d => (d.results ?? []).slice(0, 5).map(d => ({
          ex_date: d.ex_dividend_date,
          amount: d.cash_amount,
          frequency: "weekly",
        }))).catch(() => null)
      : Promise.resolve(null);

    const [iv, divs] = await Promise.all([ivPromise, divsPromise]);

    const prices = {};
    const sources = {};
    priceResults.forEach(({ ticker, price, source }) => {
      prices[ticker] = price;
      sources[ticker] = source;
    });

    return Response.json({ prices, sources, iv, divs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});