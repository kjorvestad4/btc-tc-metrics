import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/calculations";
import { RefreshCw } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export const DRIP_ASSETS = [
  { ticker: "STRC", label: "STRC", color: "#4ADE80", defaultRate: 11.5, desc: "11.5% variable preferred" },
  { ticker: "SATA", label: "SATA", color: "#A78BFA", defaultRate: 13.0, desc: "13% variable preferred (ASST)" },
  { ticker: "STRF", label: "STRF", color: "#22D3EE", defaultRate: 10.0, desc: "10% fixed preferred" },
  { ticker: "STRK", label: "STRK", color: "#FBBF24", defaultRate: 8.0,  desc: "8% fixed preferred (convertible)" },
  { ticker: "STRD", label: "STRD", color: "#FB923C", defaultRate: 10.0, desc: "10% BTC-denom. preferred" },
  { ticker: "MSTY", label: "MSTY", color: "#E879F9", defaultRate: null, desc: "YieldMax MSTR Income ETF" },
];

/**
 * Run DRIP simulation for a single asset.
 * Returns array of { year, shares, value, totalDivs } from year 0..years.
 */
export function runDRIP({ shares, price, annualRatesPct, years, dripEnabled }) {
  const rows = [{ year: 0, shares, value: shares * price, totalDivs: 0 }];
  let currentShares = shares;
  let totalDivs = 0;

  for (let y = 1; y <= years; y++) {
    const annualDivIncome = currentShares * price * (annualRatesPct / 100);
    totalDivs += annualDivIncome;
    if (dripEnabled) {
      currentShares += annualDivIncome / price;
    }
    rows.push({ year: y, shares: currentShares, value: currentShares * price, totalDivs });
  }
  return rows;
}

const TICK_STYLE = { fontSize: 9, fill: "hsl(215 20% 55%)" };

export default function DRIPSimulator({
  holdings, prices,
  // Controlled state from parent
  dripEnabled, setDripEnabled,
  years, setYears,
  rates, setRates,
  mstyWeeklyDiv, setMstyWeeklyDiv,
}) {
  const setRate = (ticker, val) => setRates(prev => ({ ...prev, [ticker]: val }));

  const activeAssets = DRIP_ASSETS.filter(a => (holdings?.[a.ticker] ?? 0) > 0);

  const simResults = useMemo(() => {
    const out = {};
    for (const asset of DRIP_ASSETS) {
      const sh = holdings?.[asset.ticker] ?? 0;
      if (sh <= 0) continue;
      const price = prices?.[asset.ticker] ?? 99;
      const annualRate = asset.ticker === "MSTY"
        ? ((mstyWeeklyDiv * 52) / price) * 100
        : (rates[asset.ticker] ?? asset.defaultRate);

      out[asset.ticker] = runDRIP({ shares: sh, price, annualRatesPct: annualRate, years, dripEnabled });
    }
    return out;
  }, [holdings, prices, rates, mstyWeeklyDiv, years, dripEnabled]);

  const aggregateRows = useMemo(() => {
    const rows = [];
    for (let y = 0; y <= years; y++) {
      let totalValue = 0, totalDivs = 0;
      for (const ticker of Object.keys(simResults)) {
        totalValue += simResults[ticker]?.[y]?.value ?? 0;
        totalDivs  += simResults[ticker]?.[y]?.totalDivs ?? 0;
      }
      rows.push({ year: y, totalValue, totalDivs });
    }
    return rows;
  }, [simResults, years]);

  const hasAnyHoldings = activeAssets.length > 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 p-3 bg-secondary/30 rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-green-400" />
          <span className="text-xs font-semibold text-foreground">DRIP Simulation</span>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground">DRIP</Label>
          <button
            onClick={() => setDripEnabled(!dripEnabled)}
            className={`text-xs px-3 py-1 rounded-lg border font-semibold transition-colors ${
              dripEnabled ? "bg-green-500/20 border-green-500 text-green-400" : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {dripEnabled ? "ON" : "OFF"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground w-14">Years</Label>
          <Input
            type="number"
            value={years}
            onChange={e => setYears(Math.max(1, Math.min(30, parseInt(e.target.value) || 10)))}
            className="h-7 w-20 text-xs font-mono bg-card border-border"
            min={1} max={30}
          />
        </div>
        {dripEnabled && (
          <span className="text-[10px] text-green-400 ml-1">
            ✓ DRIP shares feed into the Portfolio Valuation chart below
          </span>
        )}
      </div>

      {/* Rate editors */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {DRIP_ASSETS.map(asset => (
          <div key={asset.ticker} className="bg-secondary/30 border border-border rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: asset.color }}>{asset.ticker}</span>
              <span className="text-[9px] text-muted-foreground">{asset.desc}</span>
            </div>
            {asset.ticker === "MSTY" ? (
              <div className="flex items-center gap-1.5">
                <Label className="text-[9px] text-muted-foreground w-16 shrink-0">Weekly Div $</Label>
                <Input
                  type="number"
                  value={mstyWeeklyDiv}
                  onChange={e => setMstyWeeklyDiv(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="h-6 text-xs font-mono bg-card border-border flex-1"
                  min={0} step={0.01}
                />
                <span className="text-[9px] text-amber-400 font-mono shrink-0">
                  {(((mstyWeeklyDiv * 52) / (prices?.MSTY ?? 22.5)) * 100).toFixed(1)}% ann.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Label className="text-[9px] text-muted-foreground w-16 shrink-0">Ann. Rate %</Label>
                <Input
                  type="number"
                  value={rates[asset.ticker] ?? asset.defaultRate}
                  onChange={e => setRate(asset.ticker, Math.max(0, parseFloat(e.target.value) || 0))}
                  className="h-6 text-xs font-mono bg-card border-border flex-1"
                  min={0} max={50} step={0.1}
                />
                <span className="text-[9px] text-amber-400 font-mono shrink-0">
                  ${(((rates[asset.ticker] ?? asset.defaultRate) / 100) * (prices?.[asset.ticker] ?? 99)).toFixed(2)}/sh/yr
                </span>
              </div>
            )}
            {(holdings?.[asset.ticker] ?? 0) > 0 && simResults[asset.ticker] && (
              <div className="text-[9px] text-muted-foreground pt-0.5 border-t border-border flex justify-between">
                <span>Now: {holdings[asset.ticker].toLocaleString()} sh</span>
                <span className="text-green-400">
                  Y{years}: {simResults[asset.ticker][years]?.shares.toLocaleString(undefined, { maximumFractionDigits: 0 })} sh
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {!hasAnyHoldings && (
        <p className="text-[11px] text-muted-foreground text-center py-4">
          Enter holdings in the calculator above to see DRIP projections.
        </p>
      )}

      {hasAnyHoldings && (
        <>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Total Income Portfolio Value (Preferred + MSTY)</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={aggregateRows} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                <XAxis dataKey="year" tick={TICK_STYLE} />
                <YAxis tick={TICK_STYLE} tickFormatter={v => formatCurrency(v)} />
                <Tooltip
                  contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", fontSize: 11 }}
                  formatter={(v, name) => [formatCurrency(v, 0), name]}
                  labelFormatter={l => `Year ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="totalValue" stroke="#4ADE80" strokeWidth={2} name={dripEnabled ? "Portfolio Value (DRIP)" : "Portfolio Value"} dot={false} />
                <Line type="monotone" dataKey="totalDivs"  stroke="#FBBF24" strokeWidth={1.5} name="Cumulative Dividends Received" dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Per-Asset at Year {years}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {activeAssets.map(asset => {
                const sim = simResults[asset.ticker];
                if (!sim) return null;
                const last = sim[years];
                const first = sim[0];
                const sharesGained = last.shares - first.shares;
                return (
                  <div key={asset.ticker} className="bg-secondary/30 border border-border rounded-lg p-2.5">
                    <p className="text-xs font-bold mb-1" style={{ color: asset.color }}>{asset.ticker}</p>
                    <div className="space-y-0.5 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">End value</span>
                        <span className="font-mono font-bold text-foreground">{formatCurrency(last.value, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total divs rcvd</span>
                        <span className="font-mono text-amber-400">{formatCurrency(last.totalDivs, 0)}</span>
                      </div>
                      {dripEnabled && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">DRIP shares added</span>
                          <span className="font-mono text-green-400">+{sharesGained.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <p className="text-[9px] text-muted-foreground/50 text-center">
        DRIP assumes dividends reinvested at current market price. Rates are user-adjustable. Not financial advice.
      </p>
    </div>
  );
}