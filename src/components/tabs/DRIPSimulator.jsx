import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/calculations";
import { RefreshCw, Plus, X } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export const DRIP_ASSETS = [
  { ticker: "STRC", label: "STRC", color: "#4ADE80", defaultRate: 11.5, desc: "11.5% variable preferred" },
  { ticker: "SATA", label: "SATA", color: "#A78BFA", defaultRate: 13.0, desc: "13% variable preferred (ASST)" },
  { ticker: "STRF", label: "STRF", color: "#22D3EE", defaultRate: 10.0, desc: "10% fixed preferred" },
  { ticker: "STRK", label: "STRK", color: "#FBBF24", defaultRate: 8.0,  desc: "8% fixed preferred (convertible)" },
  { ticker: "STRD", label: "STRD", color: "#FB923C", defaultRate: 10.0, desc: "10% BTC-denom. preferred" },
  { ticker: "MSTY", label: "MSTY", color: "#E879F9", defaultRate: null,  desc: "YieldMax MSTR Income ETF" },
];

const ALL_REDIRECT_OPTIONS = ["MSTR", "ASST", "CASH", "STRC", "SATA", "STRF", "STRK", "STRD", "MSTY"];

// Default per-instrument DRIP config
// redirectTargets: [{ ticker: "MSTR", pct: 100 }]
export function defaultDripConfig() {
  const out = {};
  for (const a of DRIP_ASSETS) {
    out[a.ticker] = {
      mode: "drip",
      dripPct: 100,
      redirectTargets: [{ ticker: "MSTR", pct: 100 }],
    };
  }
  return out;
}

/**
 * Run DRIP simulation for a single asset.
 * dripConfig: { mode, dripPct, redirectTargets: [{ticker, pct}] }
 * Returns array of { year, shares, value, totalDivs, totalRedirected }
 */
export function runDRIP({ shares, price, annualRatesPct, years, dripConfig = { mode: "drip", dripPct: 100 } }) {
  const rows = [{ year: 0, shares, value: shares * price, totalDivs: 0, totalRedirected: 0,
    // legacy compat
    redirectedToMstr: 0, redirectedToAsst: 0 }];
  let currentShares = shares;
  let totalDivs = 0, totalRedirected = 0;

  for (let y = 1; y <= years; y++) {
    const annualDivIncome = currentShares * price * (annualRatesPct / 100);
    totalDivs += annualDivIncome;

    if (dripConfig.mode === "drip") {
      const reinvestPct = (dripConfig.dripPct ?? 100) / 100;
      currentShares += (annualDivIncome * reinvestPct) / price;
    } else {
      totalRedirected += annualDivIncome;
    }

    rows.push({ year: y, shares: currentShares, value: currentShares * price, totalDivs, totalRedirected,
      redirectedToMstr: totalRedirected, redirectedToAsst: 0 });
  }
  return rows;
}

const TICK_STYLE = { fontSize: 9, fill: "hsl(215 20% 55%)" };

// ── Per-instrument config row ─────────────────────────────────────────────────
function AssetDripConfig({ asset, config, onConfigChange, holdings, prices, rates, setRates, mstyWeeklyDiv, setMstyWeeklyDiv, simResult, years, allRedirectOptions }) {
  const cfg = config ?? { mode: "drip", dripPct: 100, redirectTargets: [{ ticker: "MSTR", pct: 100 }] };
  const redirectTargets = cfg.redirectTargets ?? [{ ticker: "MSTR", pct: 100 }];
  const update = (field, val) => onConfigChange({ ...cfg, [field]: val });
  const hasHoldings = (holdings?.[asset.ticker] ?? 0) > 0;

  const totalRedirectPct = redirectTargets.reduce((s, t) => s + (t.pct || 0), 0);

  const addTarget = () => {
    const used = redirectTargets.map(t => t.ticker);
    const next = allRedirectOptions.find(o => !used.includes(o));
    if (!next) return;
    update("redirectTargets", [...redirectTargets, { ticker: next, pct: 0 }]);
  };

  const updateTarget = (i, field, val) => {
    const updated = redirectTargets.map((t, idx) => idx === i ? { ...t, [field]: val } : t);
    update("redirectTargets", updated);
  };

  const removeTarget = (i) => {
    update("redirectTargets", redirectTargets.filter((_, idx) => idx !== i));
  };

  return (
    <div className={`bg-secondary/30 border border-border rounded-lg p-2.5 space-y-2 ${!hasHoldings ? "opacity-50" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: asset.color }}>{asset.ticker}</span>
        <span className="text-[9px] text-muted-foreground">{asset.desc}</span>
      </div>

      {/* Annual rate input */}
      {asset.ticker === "MSTY" ? (
        <div className="flex items-center gap-1.5">
          <Label className="text-[9px] text-muted-foreground w-16 shrink-0">Weekly Div $</Label>
          <Input
            type="number" value={mstyWeeklyDiv}
            onChange={e => setMstyWeeklyDiv(Math.max(0, parseFloat(e.target.value) || 0))}
            className="h-6 text-xs font-mono bg-card border-border flex-1" min={0} step={0.01}
          />
          <span className="text-[9px] text-amber-400 font-mono shrink-0">
            {(((mstyWeeklyDiv * 52) / (prices?.MSTY ?? 22.5)) * 100).toFixed(1)}% ann.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <Label className="text-[9px] text-muted-foreground w-16 shrink-0">Ann. Rate %</Label>
          <Input
            type="number" value={rates[asset.ticker] ?? asset.defaultRate}
            onChange={e => setRates(prev => ({ ...prev, [asset.ticker]: Math.max(0, parseFloat(e.target.value) || 0) }))}
            className="h-6 text-xs font-mono bg-card border-border flex-1" min={0} max={50} step={0.1}
          />
          <span className="text-[9px] text-amber-400 font-mono shrink-0">
            ${(((rates[asset.ticker] ?? asset.defaultRate) / 100) * (prices?.[asset.ticker] ?? 99)).toFixed(2)}/sh/yr
          </span>
        </div>
      )}

      {/* DRIP mode toggle */}
      <div className="flex gap-1">
        <button onClick={() => update("mode", "drip")}
          className={`flex-1 text-[10px] py-1 rounded border font-semibold transition-colors ${
            cfg.mode === "drip" ? "bg-green-500/20 border-green-500 text-green-400" : "border-border text-muted-foreground hover:bg-secondary"
          }`}>
          DRIP (reinvest)
        </button>
        <button onClick={() => update("mode", "redirect")}
          className={`flex-1 text-[10px] py-1 rounded border font-semibold transition-colors ${
            cfg.mode === "redirect" ? "bg-amber-500/20 border-amber-500 text-amber-400" : "border-border text-muted-foreground hover:bg-secondary"
          }`}>
          Redirect dividends
        </button>
      </div>

      {/* DRIP sub-config */}
      {cfg.mode === "drip" && (
        <div className="flex items-center gap-1.5">
          <Label className="text-[9px] text-muted-foreground w-16 shrink-0">Reinvest %</Label>
          <Input
            type="number" value={cfg.dripPct ?? 100}
            onChange={e => update("dripPct", Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
            className="h-6 text-xs font-mono bg-card border-border flex-1" min={0} max={100} step={5}
          />
          <span className="text-[9px] text-muted-foreground shrink-0">% into {asset.ticker}</span>
        </div>
      )}

      {/* Multi-target redirect config */}
      {cfg.mode === "redirect" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[9px] text-muted-foreground">Redirect targets</Label>
            <span className={`text-[9px] font-mono font-bold ${totalRedirectPct === 100 ? "text-green-400" : "text-amber-400"}`}>
              {totalRedirectPct}% total
            </span>
          </div>

          {redirectTargets.map((target, i) => (
            <div key={i} className="flex items-center gap-1">
              <select
                value={target.ticker}
                onChange={e => updateTarget(i, "ticker", e.target.value)}
                className="flex-1 h-6 text-[9px] font-mono bg-card border border-border rounded px-1 text-foreground"
              >
                {allRedirectOptions.map(opt => (
                  <option key={opt} value={opt}>{opt === "CASH" ? "Cash (save)" : opt}</option>
                ))}
              </select>
              <Input
                type="number"
                value={target.pct}
                onChange={e => updateTarget(i, "pct", Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                className="h-6 w-14 text-[10px] font-mono bg-card border-border text-center"
                min={0} max={100} step={5}
              />
              <span className="text-[9px] text-muted-foreground">%</span>
              <button onClick={() => removeTarget(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {redirectTargets.length < allRedirectOptions.length && (
            <button onClick={addTarget}
              className="w-full flex items-center justify-center gap-1 text-[9px] py-1 rounded border border-dashed border-border text-muted-foreground hover:border-amber-500 hover:text-amber-400 transition-colors">
              <Plus className="w-3 h-3" /> Add target
            </button>
          )}
        </div>
      )}

      {/* Summary */}
      {hasHoldings && simResult && (
        <div className="text-[9px] text-muted-foreground pt-0.5 border-t border-border space-y-0.5">
          <div className="flex justify-between">
            <span>Now: {holdings[asset.ticker].toLocaleString()} sh</span>
            <span className="text-green-400">
              Y{years}: {simResult[years]?.shares.toLocaleString(undefined, { maximumFractionDigits: 0 })} sh
            </span>
          </div>
          {cfg.mode === "redirect" && (simResult[years]?.totalRedirected ?? 0) > 0 && (
            <div className="flex justify-between">
              <span>Total redirected</span>
              <span className="text-amber-400">{formatCurrency(simResult[years].totalRedirected, 0)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DRIPSimulator({
  holdings, prices,
  dripEnabled, setDripEnabled,
  years, setYears,
  rates, setRates,
  mstyWeeklyDiv, setMstyWeeklyDiv,
  dripConfigs, setDripConfigs,
  customStocks = [],
}) {
  const customRedirectTargets = customStocks.filter(s => s.ticker).map(s => s.ticker);
  const allRedirectOptions = [...ALL_REDIRECT_OPTIONS, ...customRedirectTargets];
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
      const cfg = dripEnabled ? (dripConfigs?.[asset.ticker] ?? { mode: "drip", dripPct: 100 }) : { mode: "drip", dripPct: 0 };
      out[asset.ticker] = runDRIP({ shares: sh, price, annualRatesPct: annualRate, years, dripConfig: cfg });
    }
    return out;
  }, [holdings, prices, rates, mstyWeeklyDiv, years, dripEnabled, dripConfigs]);

  const aggregateRows = useMemo(() => {
    const rows = [];
    for (let y = 0; y <= years; y++) {
      let totalValue = 0, totalDivs = 0, totalRedirected = 0;
      for (const ticker of Object.keys(simResults)) {
        totalValue     += simResults[ticker]?.[y]?.value ?? 0;
        totalDivs      += simResults[ticker]?.[y]?.totalDivs ?? 0;
        totalRedirected += simResults[ticker]?.[y]?.totalRedirected ?? 0;
      }
      rows.push({ year: y, totalValue, totalDivs, totalRedirected });
    }
    return rows;
  }, [simResults, years]);

  const hasAnyHoldings = activeAssets.length > 0;
  const updateConfig = (ticker, cfg) => setDripConfigs(prev => ({ ...prev, [ticker]: cfg }));

  return (
    <div className="space-y-4">
      {/* Global controls */}
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
            type="number" value={years}
            onChange={e => setYears(Math.max(1, Math.min(30, parseInt(e.target.value) || 10)))}
            className="h-7 w-20 text-xs font-mono bg-card border-border" min={1} max={30}
          />
        </div>
        <p className="text-[10px] text-muted-foreground ml-1">
          Each instrument: <span className="text-green-400 font-semibold">DRIP</span> (reinvest) or <span className="text-amber-400 font-semibold">Redirect</span> to multiple targets with custom % split
        </p>
      </div>

      {/* Per-instrument config */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {DRIP_ASSETS.map(asset => (
          <AssetDripConfig
            key={asset.ticker}
            asset={asset}
            config={dripConfigs?.[asset.ticker]}
            onConfigChange={cfg => updateConfig(asset.ticker, cfg)}
            holdings={holdings}
            prices={prices}
            rates={rates}
            setRates={setRates}
            mstyWeeklyDiv={mstyWeeklyDiv}
            setMstyWeeklyDiv={setMstyWeeklyDiv}
            simResult={simResults[asset.ticker]}
            years={years}
            allRedirectOptions={allRedirectOptions}
          />
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
                <Line type="monotone" dataKey="totalValue" stroke="#4ADE80" strokeWidth={2} name="Portfolio Value" dot={false} />
                <Line type="monotone" dataKey="totalDivs" stroke="#FBBF24" strokeWidth={1.5} name="Cumulative Dividends" dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="totalRedirected" stroke="#FB923C" strokeWidth={1.5} name="Cumulative Redirected" dot={false} strokeDasharray="2 2" />
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
                const cfg = dripConfigs?.[asset.ticker] ?? { mode: "drip" };
                const sharesGained = last.shares - first.shares;
                const targets = cfg.redirectTargets ?? [];
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
                      {dripEnabled && cfg.mode === "drip" && sharesGained > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">DRIP shares added</span>
                          <span className="font-mono text-green-400">+{sharesGained.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                      )}
                      {dripEnabled && cfg.mode === "redirect" && last.totalRedirected > 0 && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total redirected</span>
                            <span className="font-mono text-amber-400">{formatCurrency(last.totalRedirected, 0)}</span>
                          </div>
                          {targets.map((t, i) => (
                            <div key={i} className="flex justify-between pl-2">
                              <span className="text-muted-foreground/70">→ {t.ticker}</span>
                              <span className="font-mono text-amber-300">{formatCurrency(last.totalRedirected * (t.pct / 100), 0)}</span>
                            </div>
                          ))}
                        </>
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
        DRIP reinvests dividends at current market price. Redirect mode shows capital available to deploy. Not financial advice.
      </p>
    </div>
  );
}