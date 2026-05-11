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

async function fetchBTC() {
  // Try CoinGecko first, fall back to Polygon BTC/USD
  try {
    const data = await fetchJSON("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
    const price = data?.bitcoin?.usd;
    if (price) return price;
  } catch { /* fall through */ }

  // Polygon fallback for BTC
  if (POLYGON_KEY) {
    const data = await fetchJSON(
      `https://api.polygon.io/v2/snapshot/locale/global/markets/crypto/tickers/X:BTCUSD?apiKey=${POLYGON_KEY}`
    );
    const price = data?.ticker?.day?.c || data?.ticker?.prevDay?.c || null;
    if (price) return price;
  }

  throw new Error("BTC price unavailable");
}

Deno.serve(async (req) => {
  try {
    // No auth required — public price data endpoint

    // Support dynamic ticker lookups — if body has `tickers` array, just return those prices
    let body = {};
    try { body = await req.json(); } catch { /* no body */ }

    if (Array.isArray(body.tickers) && body.tickers.length > 0) {
      const results = await Promise.all(body.tickers.map(getPrice));
      const prices = {};
      results.forEach(({ ticker, price }) => { prices[ticker] = price; });
      return Response.json({ prices });
    }

    const tickers = ["MSTR", "MSTY", "ASST", "STRC", "STRF", "STRK", "STRD", "SATA"];

    // Fetch BTC + all stock prices in parallel
    const [btcResult, ...priceResults] = await Promise.all([
      fetchBTC().catch(() => null),
      ...tickers.map(getPrice),
    ]);

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

    // Fetch last 15 trading days of OHLCV for STRC and SATA
    const atmPromise = POLYGON_KEY
      ? (async () => {
          try {
            const toDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
            const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
            const [strcData, sataData] = await Promise.all([
              fetchJSON(`https://api.polygon.io/v2/aggs/ticker/STRC/range/1/day/${fromDate}/${toDate}?adjusted=true&sort=desc&limit=15&apiKey=${POLYGON_KEY}`),
              fetchJSON(`https://api.polygon.io/v2/aggs/ticker/SATA/range/1/day/${fromDate}/${toDate}?adjusted=true&sort=desc&limit=15&apiKey=${POLYGON_KEY}`),
            ]);
            const mapBar = (bar) => ({
              date: new Date(bar.t).toLocaleDateString("en-CA", { timeZone: "America/New_York" }),
              price: bar.c,
              volume_M: parseFloat(((bar.v * bar.vw) / 1_000_000).toFixed(2)),
              open: bar.o,
              high: bar.h,
              low: bar.l,
              close: bar.c,
              vwap: parseFloat(bar.vw?.toFixed(2) ?? bar.c),
            });
            const strc = (strcData.results ?? []).map(mapBar);
            const sata = (sataData.results ?? []).map(mapBar);
            return { strc, sata };
          } catch (e) {
            return null;
          }
        })()
      : Promise.resolve(null);

    const [iv, divs, atmData] = await Promise.all([ivPromise, divsPromise, atmPromise]);

    const prices = {};
    const sources = {};
    priceResults.forEach(({ ticker, price, source }) => {
      prices[ticker] = price;
      sources[ticker] = source;
    });

    return Response.json({ btc: btcResult, prices, sources, iv, divs, atm: atmData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});