import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const POLYGON_KEY = Deno.env.get("POLYGON_API_KEY");

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!POLYGON_KEY) return Response.json({ error: "POLYGON_API_KEY not configured" }, { status: 500 });

    const tickers = ["MSTR", "MSTY", "ASST", "STRC", "STRF", "STRK", "STRD", "SATA"];

    // Try snapshot first (live price), fall back to prev close
    const pricePromises = tickers.map(t =>
      fetchJSON(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${t}?apiKey=${POLYGON_KEY}`)
        .then(d => {
          const price = d.ticker?.day?.c || d.ticker?.prevDay?.c || d.ticker?.lastTrade?.p || null;
          if (!price) throw new Error("no snapshot price");
          return { ticker: t, price };
        })
        .catch(() =>
          fetchJSON(`https://api.polygon.io/v2/aggs/ticker/${t}/prev?adjusted=true&apiKey=${POLYGON_KEY}`)
            .then(d => ({ ticker: t, price: d.results?.[0]?.c ?? null }))
            .catch(() => ({ ticker: t, price: null }))
        )
    );

    const today = new Date();
    const targetExp = new Date(today);
    targetExp.setDate(today.getDate() + 30);
    const expStr = targetExp.toISOString().split("T")[0];

    const ivPromise = fetchJSON(
      `https://api.polygon.io/v3/snapshot/options/MSTR?expiration_date.lte=${expStr}&limit=10&apiKey=${POLYGON_KEY}`
    ).then(d => {
      const ivs = (d.results ?? [])
        .map(r => r?.details?.implied_volatility)
        .filter(v => v != null && v > 0.1 && v < 5);
      if (!ivs.length) return null;
      return Math.round((ivs.reduce((s, v) => s + v, 0) / ivs.length) * 100);
    }).catch(() => null);

    const divsPromise = fetchJSON(
      `https://api.polygon.io/v3/reference/dividends?ticker=MSTY&limit=10&sort=ex_dividend_date&order=desc&apiKey=${POLYGON_KEY}`
    ).then(d => (d.results ?? []).slice(0, 5).map(d => ({
      ex_date: d.ex_dividend_date,
      amount: d.cash_amount,
      frequency: "weekly",
    }))).catch(() => null);

    const [priceResults, iv, divs] = await Promise.all([
      Promise.all(pricePromises),
      ivPromise,
      divsPromise,
    ]);

    const prices = {};
    priceResults.forEach(({ ticker, price }) => { prices[ticker] = price; });

    return Response.json({ prices, iv, divs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});