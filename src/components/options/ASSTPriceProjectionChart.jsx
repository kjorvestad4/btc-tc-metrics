import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/calculations";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

const TICK_STYLE = { fontSize: 9, fill: "hsl(215 20% 55%)" };
const GRID_COLOR = "hsl(217 33% 17%)";

// ── Black-Scholes (duplicated locally to keep component self-contained) ──────
function normalCDF(x) {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return 0.5 * (1 + sign * y);
}

function blackScholes({ S, K, T, r, sigma, type }) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0)
    return type === "call" ? Math.max(0, S - K) : Math.max(0, K - S);
  const d1 = (Math.log(S/K) + (r + 0.5*sigma*sigma)*T) / (sigma*Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  if (type === "call") return S*normalCDF(d1) - K*Math.exp(-r*T)*normalCDF(d2);
  return K*Math.exp(-r*T)*normalCDF(-d2) - S*normalCDF(-d1);
}

// ── ASST price projection engine (mirrors Bitcoin24 / generateProjections) ───
const ASST_BTC_HOLD_NOW = 13767.9;
const ASST_SHARES_M     = 69.72;
const ASST_BTC_ACCUM_PQ = 2500;      // BTC accumulated per quarter

function projectASST({ btcPriceNow, btcCagrPct, asstMnavMultiple, quarters = 20 }) {
  const qGrowth = Math.pow(1 + btcCagrPct / 100, 0.25);
  let btcPrice = btcPriceNow;
  let asstBtcHold = ASST_BTC_HOLD_NOW;
  const rows = [];
  for (let q = 0; q <= quarters; q++) {
    if (q > 0) {
      btcPrice    = btcPrice * qGrowth;
      asstBtcHold += ASST_BTC_ACCUM_PQ;
    }
    const navPerShare = (asstBtcHold * btcPrice) / (ASST_SHARES_M * 1e6);
    const asstPrice   = navPerShare * asstMnavMultiple;
    const yr  = Math.floor(q / 4);
    const qtr = (q % 4) + 1;
    rows.push({
      q,
      label: q === 0 ? "Now" : `Y${yr + 1}Q${qtr}`,
      btcPrice,
      asstBtcHold,
      navPerShare,
      asstPrice,
    });
  }
  return rows;
}

function Card({ children, className = "" }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function ASSTPriceProjectionChart({ legs = [], daysToExpiry = 30, riskFreeRate = 5, underlyingPrice: liveAsstPrice }) {

  // Projection params (mirroring Bitcoin24 presets)
  const [btcPriceNow, setBtcPriceNow]     = useState(94000);
  const [btcCagr, setBtcCagr]             = useState(55);       // Base preset initARR ≈55%
  const [asstMnav, setAsstMnav]           = useState(1.3);      // Base preset asstMnav
  const [asstIv, setAsstIv]               = useState(120);      // ASST typical IV %
  const [rfrRate, setRfrRate]             = useState(riskFreeRate);

  // PRESET buttons
  const PRESETS = {
    Bear: { btcCagr: 25, asstMnav: 1.0 },
    Base: { btcCagr: 55, asstMnav: 1.3 },
    Bull: { btcCagr: 90, asstMnav: 2.0 },
  };
  const [activePreset, setActivePreset] = useState("Base");

  const applyPreset = (name) => {
    setActivePreset(name);
    setBtcCagr(PRESETS[name].btcCagr);
    setAsstMnav(PRESETS[name].asstMnav);
  };

  // Run ASST price projection
  const projRows = useMemo(() =>
    projectASST({ btcPriceNow, btcCagrPct: btcCagr, asstMnavMultiple: asstMnav }),
    [btcPriceNow, btcCagr, asstMnav]
  );

  // Current ASST price from projections (q=0) — but prefer live price if passed
  const asstNow = liveAsstPrice ?? projRows[0]?.asstPrice ?? 12.50;

  // For each projected quarter, compute option value for each leg
  // Uses: S = projected ASST price, T = remaining DTE from that quarter perspective
  // We keep DTE fixed at the user-set value from the Simulator (options expire at that fixed DTE)
  // but we shift S to the projected price at each future quarter.
  const chartData = useMemo(() => {
    const T = daysToExpiry / 365;
    const r = rfrRate / 100;
    const sigma = asstIv / 100;

    return projRows.map((row) => {
      const S = row.asstPrice;
      // Compute combined options value for all legs at projected ASST price
      let optionValue = 0;
      let optionPnl   = 0;
      legs.forEach(leg => {
        const legSigma = leg.iv / 100;  // use per-leg IV for more accuracy
        const mult = leg.qty * 100 * (leg.side === "buy" ? 1 : -1);
        const bs = blackScholes({ S, K: leg.strike, T, r, sigma: legSigma, type: leg.type });
        optionValue += bs * Math.abs(mult);
        optionPnl   += (bs - leg.premium) * mult;
      });

      return {
        label: row.label,
        q: row.q,
        asstPrice: parseFloat(row.asstPrice.toFixed(2)),
        navPerShare: parseFloat(row.navPerShare.toFixed(2)),
        optionValue: legs.length > 0 ? parseFloat(optionValue.toFixed(0)) : null,
        optionPnl:   legs.length > 0 ? parseFloat(optionPnl.toFixed(0)) : null,
      };
    });
  }, [projRows, legs, daysToExpiry, rfrRate, asstIv]);

  // Highlight quarters — year boundaries
  const yearBoundaries = projRows.filter(r => r.q % 4 === 0 && r.q > 0).map(r => r.label);

  // Key milestones
  const endRow   = projRows[projRows.length - 1];
  const y5Row    = projRows.find(r => r.q === 20) ?? endRow;
  const y1Row    = projRows.find(r => r.q === 4);
  const y2Row    = projRows.find(r => r.q === 8);

  const netLegCost = legs.reduce((s, l) => s + l.premium * l.qty * 100 * (l.side === "buy" ? 1 : -1), 0);

  return (
    <Card>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            ASST Price Projection &amp; Options Value
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Projected ASST price via Bitcoin24 model · option P&amp;L at each projected price · uses your active leg(s) from the simulator above
          </p>
        </div>
        {/* Preset buttons */}
        <div className="flex gap-1.5 items-center">
          <span className="text-[10px] text-muted-foreground">Scenario:</span>
          {["Bear", "Base", "Bull"].map(p => (
            <button key={p} onClick={() => applyPreset(p)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                activePreset === p
                  ? p === "Bull" ? "bg-primary text-primary-foreground border-primary"
                    : p === "Bear" ? "bg-destructive/80 text-white border-destructive"
                    : "bg-amber-500/80 text-white border-amber-500"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}>{p}</button>
          ))}
        </div>
      </div>

      {/* Parameter controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div>
          <Label className="text-[10px] text-muted-foreground">BTC Price Now ($)</Label>
          <Input type="number" value={btcPriceNow}
            onChange={e => setBtcPriceNow(Math.max(1, parseFloat(e.target.value) || 1))}
            className="h-8 text-xs font-mono bg-secondary border-border mt-1" step={1000} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">BTC CAGR (%)</Label>
          <Input type="number" value={btcCagr}
            onChange={e => { setBtcCagr(Math.max(1, parseFloat(e.target.value) || 1)); setActivePreset("Custom"); }}
            className="h-8 text-xs font-mono bg-secondary border-border mt-1" step={5} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">ASST mNAV Multiple</Label>
          <Input type="number" value={asstMnav}
            onChange={e => { setAsstMnav(Math.max(0.1, parseFloat(e.target.value) || 0.1)); setActivePreset("Custom"); }}
            className="h-8 text-xs font-mono bg-secondary border-border mt-1" step={0.1} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">ASST IV for Options (%)</Label>
          <Input type="number" value={asstIv}
            onChange={e => setAsstIv(Math.max(1, parseFloat(e.target.value) || 1))}
            className="h-8 text-xs font-mono bg-secondary border-border mt-1" step={5} />
        </div>
      </div>

      {/* IV slider */}
      <div className="p-3 bg-secondary/30 rounded-xl border border-border mb-4 space-y-1.5">
        <div className="flex justify-between">
          <Label className="text-[10px] text-muted-foreground">ASST Implied Volatility Override (σ)</Label>
          <span className="text-[10px] font-mono text-amber-400 font-bold">{asstIv}%</span>
        </div>
        <Slider value={[asstIv]} onValueChange={([v]) => setAsstIv(v)} min={10} max={300} step={5} />
        <p className="text-[9px] text-muted-foreground">ASST typical IV: 100–150%. Overrides per-leg IV for option value projection only.</p>
      </div>

      {/* Milestone summary */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-4">
        {[
          { label: "ASST Now", value: `$${asstNow.toFixed(2)}`, color: "text-foreground", sub: "current / q0" },
          y1Row && { label: "ASST Y1", value: `$${y1Row.asstPrice.toFixed(2)}`, color: "text-blue-400", sub: `+${(((y1Row.asstPrice/asstNow)-1)*100).toFixed(0)}%` },
          y2Row && { label: "ASST Y2", value: `$${y2Row.asstPrice.toFixed(2)}`, color: "text-cyan-400", sub: `+${(((y2Row.asstPrice/asstNow)-1)*100).toFixed(0)}%` },
          y5Row && { label: "ASST Y5", value: `$${y5Row.asstPrice.toFixed(2)}`, color: "text-primary", sub: `+${(((y5Row.asstPrice/asstNow)-1)*100).toFixed(0)}%` },
          legs.length > 0 && {
            label: "Leg Net Cost",
            value: `${netLegCost >= 0 ? "+" : ""}${formatCurrency(netLegCost, 0)}`,
            color: netLegCost >= 0 ? "text-green-400" : "text-destructive",
            sub: netLegCost >= 0 ? "credit" : "debit",
          },
        ].filter(Boolean).map(m => (
          <div key={m.label} className="p-2.5 bg-secondary/50 rounded-xl border border-border text-center">
            <p className="text-[9px] text-muted-foreground">{m.label}</p>
            <p className={`text-xs font-bold font-mono mt-0.5 ${m.color}`}>{m.value}</p>
            <p className="text-[8px] text-muted-foreground">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Main chart */}
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
        ASST Price Projection — {btcCagr}% BTC CAGR · {asstMnav}x mNAV · 20 Quarters
        {legs.length > 0 && <span className="text-primary ml-2">· Options P&L overlaid ({legs.length} leg{legs.length !== 1 ? "s" : ""})</span>}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis dataKey="label" tick={TICK_STYLE} interval={3} angle={-30} textAnchor="end" height={36} />
          <YAxis yAxisId="price" tick={TICK_STYLE} tickFormatter={v => `$${v.toFixed(0)}`} />
          {legs.length > 0 && (
            <YAxis yAxisId="pnl" orientation="right" tick={TICK_STYLE} tickFormatter={v => formatCurrency(v, 0)} />
          )}
          <Tooltip
            contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", fontSize: 11 }}
            formatter={(v, name) => {
              if (name === "ASST Price") return [`$${parseFloat(v).toFixed(2)}`, name];
              if (name === "NAV/Share")  return [`$${parseFloat(v).toFixed(3)}`, name];
              return [formatCurrency(v, 0), name];
            }}
            labelFormatter={l => `Quarter: ${l}`}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {/* Year boundary reference lines */}
          {yearBoundaries.map(lb => (
            <ReferenceLine key={lb} x={lb} yAxisId="price" stroke="hsl(217 33% 22%)" strokeDasharray="4 2" />
          ))}
          <ReferenceLine yAxisId="price" x="Now" stroke="hsl(217 33% 40%)" strokeDasharray="3 3"
            label={{ value: "Now", fontSize: 8, fill: "hsl(215 20% 55%)" }} />
          {/* ASST Price filled area */}
          <Area yAxisId="price" type="monotone" dataKey="asstPrice" stroke="#60A5FA" strokeWidth={2}
            fill="#60A5FA" fillOpacity={0.08} name="ASST Price" dot={false} />
          {/* NAV per share */}
          <Line yAxisId="price" type="monotone" dataKey="navPerShare" stroke="#A78BFA" strokeWidth={1.5}
            name="NAV/Share" dot={false} strokeDasharray="4 2" />
          {/* Option P&L if legs exist */}
          {legs.length > 0 && (
            <Line yAxisId="pnl" type="monotone" dataKey="optionPnl" stroke="#22C55E" strokeWidth={2}
              name="Option P&L at Projected Price" dot={false} />
          )}
          {legs.length > 0 && (
            <ReferenceLine yAxisId="pnl" y={0} stroke="#EF4444" strokeDasharray="4 2" strokeWidth={1} />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Quarterly projection table (first 8 quarters + Y3/Y5) */}
      <div className="mt-4 overflow-x-auto">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Quarterly Projection Table</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-[9px]">
              <th className="text-left py-1.5 pr-3">Period</th>
              <th className="text-right py-1.5 pr-3">BTC Price</th>
              <th className="text-right py-1.5 pr-3">ASST NAV/Sh</th>
              <th className="text-right py-1.5 pr-3">ASST Price</th>
              <th className="text-right py-1.5 pr-3">vs Now</th>
              {legs.length > 0 && <th className="text-right py-1.5">Option P&L</th>}
            </tr>
          </thead>
          <tbody>
            {/* Show q=0..8 then q=12,16,20 */}
            {[...projRows.slice(0, 9), ...projRows.filter(r => [12,16,20].includes(r.q))].map(row => {
              const cd = chartData.find(c => c.q === row.q);
              const pctVsNow = ((row.asstPrice / asstNow - 1) * 100).toFixed(0);
              const isNow = row.q === 0;
              const isYearEnd = row.q % 4 === 0 && row.q > 0;
              return (
                <tr key={row.q} className={`border-b border-border/30 ${isYearEnd ? "bg-secondary/20" : ""} ${isNow ? "bg-secondary/40" : ""}`}>
                  <td className={`py-1 pr-3 font-mono font-semibold ${isYearEnd ? "text-primary" : "text-muted-foreground"}`}>
                    {row.label}
                  </td>
                  <td className="py-1 pr-3 text-right font-mono text-amber-400">${row.btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="py-1 pr-3 text-right font-mono text-purple-400">${row.navPerShare.toFixed(3)}</td>
                  <td className="py-1 pr-3 text-right font-mono text-blue-400 font-bold">${row.asstPrice.toFixed(2)}</td>
                  <td className={`py-1 pr-3 text-right font-mono ${isNow ? "text-muted-foreground" : parseFloat(pctVsNow) > 0 ? "text-green-400" : "text-destructive"}`}>
                    {isNow ? "—" : `+${pctVsNow}%`}
                  </td>
                  {legs.length > 0 && (
                    <td className={`py-1 text-right font-mono font-bold ${(cd?.optionPnl ?? 0) >= 0 ? "text-green-400" : "text-destructive"}`}>
                      {cd?.optionPnl != null ? formatCurrency(cd.optionPnl, 0) : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground/50 mt-3 text-center">
        ASST projection uses Bitcoin24 decelerating-growth model. Option values use Black-Scholes at projected price with fixed DTE from simulator. Not financial advice.
      </p>
    </Card>
  );
}