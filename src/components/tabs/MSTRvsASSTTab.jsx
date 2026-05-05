import React, { useState } from "react";
import { TrendingUp, Bitcoin, RefreshCw, ExternalLink, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/calculations";
import { ASST_DEFAULTS } from "./ASSTModelTab";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line
} from "recharts";

const TICK = { fontSize: 9, fill: "hsl(215 20% 55%)" };
const GRID = "hsl(217 33% 17%)";

// Static data for companies we can't fetch live (updated May 5, 2026)
const COMPANIES_STATIC = [
  {
    name: "Strategy Inc.",
    ticker: "MSTR",
    color: "#f97316",
    treasury_url: "https://saylortracker.com",
    btc_holdings: 553555,      // updated live below
    btc_yield_ytd: 9.57,
    btc_yield_qtd: 5.92,
    bse_return: 1412.14,
    avg_cost: 68459,
  },
  {
    name: "Strive, Inc.",
    ticker: "ASST",
    color: "#f43f5e",
    treasury_url: "https://treasury.strive.com",
    btc_holdings: ASST_DEFAULTS.btc_holdings,
    btc_yield_ytd: 18.70,
    btc_yield_qtd: 4.34,
    bse_return: 35.33,
    avg_cost: null,
  },
  {
    name: "Metaplanet Inc.",
    ticker: "3350.T",
    color: "#a855f7",
    treasury_url: "https://treasury.metaplanet.jp",
    btc_holdings: 40177,
    btc_yield_ytd: 2.87,
    btc_yield_qtd: 0.00,
    bse_return: 1610.53,
    avg_cost: null,
    price_static: 2.06,
    market_cap_static: 2.62e9,
    mnav_static: 1.02,
    sats_per_share_static: 2473,
  },
  {
    name: "Semler Scientific",
    ticker: "SMLR",
    color: "#06b6d4",
    treasury_url: "https://www.semlerscientific.com",
    btc_holdings: 3192,
    btc_yield_ytd: 12.4,
    btc_yield_qtd: 3.1,
    bse_return: 120.5,
    avg_cost: null,
    price_static: 36.80,
    market_cap_static: 0.21e9,
    mnav_static: 0.98,
    sats_per_share_static: 5430,
  },
  {
    name: "Marathon Digital",
    ticker: "MARA",
    color: "#eab308",
    treasury_url: "https://www.mara.com",
    btc_holdings: 47600,
    btc_yield_ytd: 6.2,
    btc_yield_qtd: 1.8,
    bse_return: -38.4,
    avg_cost: null,
    price_static: 13.40,
    market_cap_static: 3.1e9,
    mnav_static: 1.36,
    sats_per_share_static: 9820,
  },
];

// Approximate MSTR figures (updated May 4 2026 — strategy.com/credit)
const MSTR_DEBT_PREF_M = 21750;
const MSTR_CASH_M = 2250;
const MSTR_SHARES_M = 351.8;

export default function MSTRvsASSTTab({ params, liveData, onRefresh, refreshing }) {
  const [sortKey, setSortKey] = useState("btc_holdings");
  const [sortDir, setSortDir] = useState("desc");

  const btcPrice = liveData?.btc_price ?? params.btc_price;
  const mstrPrice = liveData?.mstr_price ?? params.mstr_price;
  const asstPrice = liveData?.asst_price ?? ASST_DEFAULTS.price;

  // Build enriched company list
  const companies = COMPANIES_STATIC.map(c => {
    let price, marketCap, mnav, satsPerShare;

    if (c.ticker === "MSTR") {
      price = mstrPrice;
      marketCap = price * MSTR_SHARES_M * 1e6;
      const btcNav = c.btc_holdings * btcPrice;
      const ev = marketCap + (MSTR_DEBT_PREF_M - MSTR_CASH_M) * 1e6;
      mnav = btcNav > 0 ? ev / btcNav : 0;
      satsPerShare = ((c.btc_holdings / (MSTR_SHARES_M * 1.18 * 1e6)) * 1e8);
    } else if (c.ticker === "ASST") {
      price = asstPrice;
      marketCap = price * ASST_DEFAULTS.shares_outstanding_M * 1e6;
      const btcNav = c.btc_holdings * btcPrice;
      const ev = marketCap + ASST_DEFAULTS.total_debt_pref_M * 1e6;
      mnav = btcNav > 0 ? ev / btcNav : 0;
      satsPerShare = ((c.btc_holdings / (ASST_DEFAULTS.shares_outstanding_M * 1e6)) * 1e8);
    } else {
      price = c.price_static;
      marketCap = c.market_cap_static;
      mnav = c.mnav_static;
      satsPerShare = c.sats_per_share_static;
    }

    return {
      ...c,
      price,
      marketCap,
      mnav,
      satsPerShare,
      btcNav: c.btc_holdings * btcPrice,
    };
  });

  const sorted = [...companies].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  // Bar chart — BTC holdings comparison
  const barData = companies
    .sort((a, b) => b.btc_holdings - a.btc_holdings)
    .map(c => ({ name: c.ticker, btc: c.btc_holdings, nav: parseFloat((c.btcNav / 1e9).toFixed(2)) }));

  const mNavData = companies.map(c => ({ name: c.ticker, mnav: parseFloat(c.mnav.toFixed(2)) }))
    .sort((a, b) => b.mnav - a.mnav);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">BTC Treasury Companies — Comparison</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Side-by-side metrics for major Bitcoin treasury equities. Live prices for MSTR & ASST; static for others.
              <a href="https://strategytracker.com/?tab=comparison" target="_blank" rel="noopener noreferrer"
                className="ml-1.5 inline-flex items-center gap-0.5 text-primary hover:underline">
                strategytracker.com <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </p>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5 border-primary/30 text-primary" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Company Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {companies.map(c => (
          <div key={c.ticker} className="bg-card border border-border rounded-xl p-4 space-y-3">
            {/* Card header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                  <span className="text-sm font-bold text-foreground">{c.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{c.ticker}</span>
              </div>
              <a href={c.treasury_url} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5">
                View Portal <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            {/* Metrics */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center py-1 border-b border-border/30">
                <span className="text-xs text-muted-foreground">Stock Price</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {c.price != null ? `$${c.price.toFixed(2)}` : "—"}
                  {(c.ticker === "MSTR" && liveData?.mstr_price) || (c.ticker === "ASST" && liveData?.asst_price)
                    ? <span className="text-[9px] text-green-400 ml-1">●</span> : null}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/30">
                <span className="text-xs text-muted-foreground">Market Cap</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {c.marketCap >= 1e9 ? `$${(c.marketCap / 1e9).toFixed(2)}B` : `$${(c.marketCap / 1e6).toFixed(0)}M`}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/30">
                <span className="text-xs text-muted-foreground">BTC Holdings</span>
                <span className="text-xs font-mono font-bold text-amber-400">₿{c.btc_holdings.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/30">
                <span className="text-xs text-muted-foreground">BTC NAV</span>
                <span className="text-xs font-mono font-bold text-amber-300">
                  {c.btcNav >= 1e9 ? `$${(c.btcNav / 1e9).toFixed(2)}B` : `$${(c.btcNav / 1e6).toFixed(0)}M`}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/30">
                <span className="text-xs text-muted-foreground">Sats / Dil. Share</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {c.satsPerShare != null ? `₿${Math.round(c.satsPerShare).toLocaleString()} sats` : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/30">
                <span className="text-xs text-muted-foreground">Dil. mNAV</span>
                <span className={`text-xs font-mono font-bold ${c.mnav > 1.5 ? "text-amber-400" : c.mnav > 1.05 ? "text-green-400" : "text-blue-400"}`}>
                  {c.mnav.toFixed(2)}x
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/30">
                <span className="text-xs text-muted-foreground">BTC Yield (YTD)</span>
                <span className={`text-xs font-mono font-bold ${c.btc_yield_ytd >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {c.btc_yield_ytd >= 0 ? "+" : ""}{c.btc_yield_ytd.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/30">
                <span className="text-xs text-muted-foreground">BTC Yield (QTD)</span>
                <span className={`text-xs font-mono font-bold ${c.btc_yield_qtd >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {c.btc_yield_qtd >= 0 ? "+" : ""}{c.btc_yield_qtd.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-xs text-muted-foreground">BSE Return</span>
                <span className={`text-xs font-mono font-bold ${c.bse_return >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {c.bse_return >= 0 ? "+" : ""}{c.bse_return.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sortable table */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" /> Full Comparison Table
          <span className="text-[10px] text-muted-foreground font-normal normal-case">— click headers to sort</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 pr-3">Company</th>
                {[
                  { key: "price", label: "Price" },
                  { key: "marketCap", label: "Mkt Cap" },
                  { key: "btc_holdings", label: "BTC ₿" },
                  { key: "btcNav", label: "BTC NAV" },
                  { key: "satsPerShare", label: "Sats/Share" },
                  { key: "mnav", label: "mNAV" },
                  { key: "btc_yield_ytd", label: "Yield YTD" },
                  { key: "btc_yield_qtd", label: "Yield QTD" },
                  { key: "bse_return", label: "BSE Ret." },
                ].map(col => (
                  <th key={col.key} onClick={() => toggleSort(col.key)}
                    className="text-right py-2 pr-3 cursor-pointer hover:text-foreground transition-colors select-none whitespace-nowrap">
                    {col.label} {sortKey === col.key ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => (
                <tr key={c.ticker} className="border-b border-border/30 hover:bg-secondary/20">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />
                      <div>
                        <div className="font-semibold text-foreground">{c.ticker}</div>
                        <div className="text-[9px] text-muted-foreground">{c.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right pr-3 font-mono text-foreground">{c.price != null ? `$${c.price.toFixed(2)}` : "—"}</td>
                  <td className="text-right pr-3 font-mono text-foreground">
                    {c.marketCap >= 1e9 ? `$${(c.marketCap / 1e9).toFixed(1)}B` : `$${(c.marketCap / 1e6).toFixed(0)}M`}
                  </td>
                  <td className="text-right pr-3 font-mono text-amber-400 font-bold">₿{c.btc_holdings.toLocaleString()}</td>
                  <td className="text-right pr-3 font-mono text-amber-300">
                    {c.btcNav >= 1e9 ? `$${(c.btcNav / 1e9).toFixed(1)}B` : `$${(c.btcNav / 1e6).toFixed(0)}M`}
                  </td>
                  <td className="text-right pr-3 font-mono text-foreground">
                    {c.satsPerShare != null ? Math.round(c.satsPerShare).toLocaleString() : "—"}
                  </td>
                  <td className={`text-right pr-3 font-mono font-bold ${c.mnav > 1.5 ? "text-amber-400" : c.mnav > 1.05 ? "text-green-400" : "text-blue-400"}`}>
                    {c.mnav.toFixed(2)}x
                  </td>
                  <td className={`text-right pr-3 font-mono font-bold ${c.btc_yield_ytd >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {c.btc_yield_ytd >= 0 ? "+" : ""}{c.btc_yield_ytd.toFixed(2)}%
                  </td>
                  <td className={`text-right pr-3 font-mono font-bold ${c.btc_yield_qtd >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {c.btc_yield_qtd >= 0 ? "+" : ""}{c.btc_yield_qtd.toFixed(2)}%
                  </td>
                  <td className={`text-right pr-3 font-mono font-bold ${c.bse_return >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {c.bse_return >= 0 ? "+" : ""}{c.bse_return.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Bitcoin className="w-3.5 h-3.5 text-amber-400" /> BTC Holdings
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="name" tick={TICK} />
              <YAxis tick={TICK} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
              <Tooltip contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }}
                formatter={(v, name) => [name === "btc" ? `₿${v.toLocaleString()}` : `$${v.toFixed(1)}B`, name === "btc" ? "BTC" : "NAV ($B)"]} />
              <Bar dataKey="btc" fill="#f59e0b" radius={[3, 3, 0, 0]} name="BTC Holdings" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-green-400" /> Diluted mNAV
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mNavData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="name" tick={TICK} />
              <YAxis tick={TICK} tickFormatter={v => `${v}x`} domain={[0, "auto"]} />
              <Tooltip contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }}
                formatter={v => [`${v}x`, "mNAV"]} />
              <Bar dataKey="mnav" radius={[3, 3, 0, 0]}
                fill="#22c55e"
                label={{ position: "top", fontSize: 9, fill: "hsl(215 20% 65%)", formatter: v => `${v}x` }} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-1 mt-1">
            <div className="h-px flex-1 border-t border-dashed border-muted-foreground/30" />
            <span className="text-[9px] text-muted-foreground">Parity = 1.0x</span>
            <div className="h-px flex-1 border-t border-dashed border-muted-foreground/30" />
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/40 text-center">
        MSTR/ASST prices live. Metaplanet, Semler, Marathon data static (May 5 2026). Source: strategytracker.com, strategy.com, treasury.strive.com. Educational use only.
      </p>
    </div>
  );
}