import React, { useState, useMemo, useEffect } from "react";
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

// ── Black-Scholes ─────────────────────────────────────────────────────────────
function normalCDF(x) {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return 0.5*(1+sign*y);
}

function blackScholes({ S, K, T, r, sigma, type }) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0)
    return type === "call" ? Math.max(0, S-K) : Math.max(0, K-S);
  const d1 = (Math.log(S/K)+(r+0.5*sigma*sigma)*T)/(sigma*Math.sqrt(T));
  const d2 = d1 - sigma*Math.sqrt(T);
  if (type === "call") return S*normalCDF(d1)-K*Math.exp(-r*T)*normalCDF(d2);
  return K*Math.exp(-r*T)*normalCDF(-d2)-S*normalCDF(-d1);
}

// ── Projection constants ──────────────────────────────────────────────────────
const ASST_BTC_HOLD_NOW  = 13767.9;
const ASST_SHARES_M      = 69.72;
const ASST_BTC_ACCUM_PQ  = 2500;

const MSTR_BTC_HOLD_NOW  = 780897;
const MSTR_SHARES_M      = 346.9;
const MSTR_BTC_ACCUM_PQ  = 15000;
const MSTR_TOTAL_PREF_M  = 10446; // $10.4B total preferred notional
const MSTR_PREF_GROWTH_Q = 0;     // user can override via param

// ── Projection engines ────────────────────────────────────────────────────────
function projectASST({ btcPriceNow, btcCagrPct, mnavMultiple, quarters = 20 }) {
  const qGrowth = Math.pow(1 + btcCagrPct / 100, 0.25);
  let btcPrice = btcPriceNow;
  let btcHold  = ASST_BTC_HOLD_NOW;
  return Array.from({ length: quarters + 1 }, (_, q) => {
    if (q > 0) { btcPrice *= qGrowth; btcHold += ASST_BTC_ACCUM_PQ; }
    const navPerShare = (btcHold * btcPrice) / (ASST_SHARES_M * 1e6);
    const price = navPerShare * mnavMultiple;
    const yr = Math.floor(q / 4), qtr = (q % 4) + 1;
    return { q, label: q === 0 ? "Now" : `Y${yr+1}Q${qtr}`, btcPrice, navPerShare, price };
  });
}

function projectMSTR({ btcPriceNow, btcCagrPct, mnavMultiple, dilutionPct = 1.5, quarters = 20 }) {
  const qGrowth  = Math.pow(1 + btcCagrPct / 100, 0.25);
  const dilution = 1 + dilutionPct / 100;
  let btcPrice = btcPriceNow;
  let btcHold  = MSTR_BTC_HOLD_NOW;
  let sharesM  = MSTR_SHARES_M;
  return Array.from({ length: quarters + 1 }, (_, q) => {
    if (q > 0) { btcPrice *= qGrowth; btcHold += MSTR_BTC_ACCUM_PQ; sharesM *= dilution; }
    const totalPrefValue = MSTR_TOTAL_PREF_M * 1e6;
    const navPerShare = ((btcHold * btcPrice) - totalPrefValue) / (sharesM * 1e6);
    const price = Math.max(0, navPerShare * mnavMultiple);
    const yr = Math.floor(q / 4), qtr = (q % 4) + 1;
    return { q, label: q === 0 ? "Now" : `Y${yr+1}Q${qtr}`, btcPrice, navPerShare, price };
  });
}

// ── Presets ───────────────────────────────────────────────────────────────────
const PRESETS = {
  Bear: { btcCagr: 25, asstMnav: 1.0, mstrMnav: 1.0, dilution: 1.5 },
  Base: { btcCagr: 55, asstMnav: 1.3, mstrMnav: 1.5, dilution: 1.5 },
  Bull: { btcCagr: 90, asstMnav: 2.0, mstrMnav: 2.5, dilution: 2.0 },
};

const TICKER_CONFIG = {
  ASST: { label: "ASST", color: "#60A5FA", navColor: "#A78BFA", defaultIv: 120 },
  MSTR: { label: "MSTR", color: "#22C55E", navColor: "#86EFAC", defaultIv: 80 },
};

function Card({ children, className = "" }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

// ── Actual "now" NAV helpers (independent of mNAV multiple) ──────────────────
function calcAsstNavNow(btcPrice) {
  return (ASST_BTC_HOLD_NOW * btcPrice) / (ASST_SHARES_M * 1e6);
}
function calcMstrNavNow(btcPrice) {
  return ((MSTR_BTC_HOLD_NOW * btcPrice) - MSTR_TOTAL_PREF_M * 1e6) / (MSTR_SHARES_M * 1e6);
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StockPriceProjectionChart({ legs = [], daysToExpiry = 30, riskFreeRate = 5, liveData }) {
  const [activeTicker, setActiveTicker] = useState("MSTR");

  // Shared BTC params — seed from liveData if available
  const [btcPriceNow, setBtcPriceNow] = useState(() => liveData?.btc_price || 94000);
  const [btcCagr, setBtcCagr]         = useState(55);
  const [activePreset, setActivePreset] = useState("Base");

  // Actual current prices — seed from liveData if available
  const [asstPriceActual, setAsstPriceActual] = useState(() => liveData?.asst_price || 12.50);
  const [mstrPriceActual, setMstrPriceActual] = useState(() => liveData?.mstr_price || 370.00);

  // ASST-specific
  const [asstMnav, setAsstMnav] = useState(1.3);
  const [asstIv, setAsstIv]     = useState(120);

  // MSTR-specific
  const [mstrMnav, setMstrMnav]     = useState(1.5);
  const [mstrDilution, setMstrDilution] = useState(1.5);
  const [mstrIv, setMstrIv]         = useState(80);

  const [rfrRate] = useState(riskFreeRate);

  // Sync if liveData arrives/updates after mount
  useEffect(() => {
    if (liveData?.btc_price)  setBtcPriceNow(liveData.btc_price);
    if (liveData?.mstr_price) setMstrPriceActual(liveData.mstr_price);
    if (liveData?.asst_price) setAsstPriceActual(liveData.asst_price);
  }, [liveData]);

  // Actual NAV now (computed from BTC price + holdings, no mNAV applied)
  const actualNavNow = activeTicker === "ASST"
    ? calcAsstNavNow(btcPriceNow)
    : calcMstrNavNow(btcPriceNow);
  const actualPriceNow = activeTicker === "ASST" ? asstPriceActual : mstrPriceActual;
  const setActualPriceNow = activeTicker === "ASST" ? setAsstPriceActual : setMstrPriceActual;

  const applyPreset = (name) => {
    setActivePreset(name);
    setBtcCagr(PRESETS[name].btcCagr);
    setAsstMnav(PRESETS[name].asstMnav);
    setMstrMnav(PRESETS[name].mstrMnav);
    setMstrDilution(PRESETS[name].dilution);
  };

  const cfg = TICKER_CONFIG[activeTicker];
  const iv  = activeTicker === "ASST" ? asstIv : mstrIv;
  const setIv = activeTicker === "ASST" ? setAsstIv : setMstrIv;

  // Run projections for active ticker
  const projRows = useMemo(() => {
    if (activeTicker === "ASST")
      return projectASST({ btcPriceNow, btcCagrPct: btcCagr, mnavMultiple: asstMnav });
    return projectMSTR({ btcPriceNow, btcCagrPct: btcCagr, mnavMultiple: mstrMnav, dilutionPct: mstrDilution });
  }, [activeTicker, btcPriceNow, btcCagr, asstMnav, mstrMnav, mstrDilution]);

  // priceNow for % change calcs — use actual live price
  const priceNow = actualPriceNow;

  // Chart data with option P&L overlaid
  const chartData = useMemo(() => {
    const T = daysToExpiry / 365;
    const r = rfrRate / 100;
    return projRows.map(row => {
      const S = row.price;
      let optionPnl = 0;
      legs.forEach(leg => {
        const mult = leg.qty * 100 * (leg.side === "buy" ? 1 : -1);
        const bs = blackScholes({ S, K: leg.strike, T, r, sigma: leg.iv / 100, type: leg.type });
        optionPnl += (bs - leg.premium) * mult;
      });
      return {
        label: row.label,
        q: row.q,
        price: parseFloat(row.price.toFixed(2)),
        navPerShare: parseFloat(row.navPerShare.toFixed(activeTicker === "MSTR" ? 2 : 3)),
        optionPnl: legs.length > 0 ? parseFloat(optionPnl.toFixed(0)) : null,
      };
    });
  }, [projRows, legs, daysToExpiry, rfrRate, activeTicker]);

  const yearBoundaries = projRows.filter(r => r.q % 4 === 0 && r.q > 0).map(r => r.label);
  const y1Row = projRows.find(r => r.q === 4);
  const y2Row = projRows.find(r => r.q === 8);
  const y5Row = projRows.find(r => r.q === 20);
  const netLegCost = legs.reduce((s, l) => s + l.premium * l.qty * 100 * (l.side === "buy" ? 1 : -1), 0);

  // Expiry quarter: which quarter index does daysToExpiry land in (ceil, min 1)
  const expiryQuarter = Math.max(1, Math.ceil(daysToExpiry / 91.25));

  return (
    <Card>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: cfg.color }} />
            Price Projection &amp; Options Value
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Bitcoin24 decelerating-growth model · option P&amp;L at each projected price · uses your active leg(s) from the simulator above
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Ticker toggle */}
          <div className="flex gap-1">
            {["MSTR", "ASST"].map(t => (
              <button key={t} onClick={() => setActiveTicker(t)}
                className={`text-xs px-3 py-1 rounded-lg border font-mono font-bold transition-colors ${
                  activeTicker === t
                    ? t === "MSTR" ? "bg-green-500/20 border-green-500 text-green-400"
                      : "bg-blue-500/20 border-blue-500 text-blue-400"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}>{t}</button>
            ))}
          </div>
          {/* Scenario presets */}
          <div className="flex gap-1 items-center">
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
      </div>

      {/* Parameter controls — shared + ticker-specific */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">BTC Price Now ($)</Label>
          <Input type="number" value={btcPriceNow}
            onChange={e => setBtcPriceNow(Math.max(1, parseFloat(e.target.value)||1))}
            className="h-8 text-xs font-mono bg-secondary border-border mt-1" step={1000} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">BTC CAGR (%)</Label>
          <Input type="number" value={btcCagr}
            onChange={e => { setBtcCagr(Math.max(1, parseFloat(e.target.value)||1)); setActivePreset("Custom"); }}
            className="h-8 text-xs font-mono bg-secondary border-border mt-1" step={5} />
        </div>

        {activeTicker === "ASST" ? <>
          <div>
            <Label className="text-[10px] text-muted-foreground">ASST Current Price ($) <span className="text-amber-400">live</span></Label>
            <Input type="number" value={asstPriceActual}
              onChange={e => setAsstPriceActual(Math.max(0.01, parseFloat(e.target.value)||0.01))}
              className="h-8 text-xs font-mono bg-secondary border-border mt-1" step={0.5} />
            <p className="text-[9px] text-muted-foreground mt-0.5">Used for "Now" row only</p>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">ASST mNAV Multiple</Label>
            <Input type="number" value={asstMnav}
              onChange={e => { setAsstMnav(Math.max(0.1, parseFloat(e.target.value)||0.1)); setActivePreset("Custom"); }}
              className="h-8 text-xs font-mono bg-secondary border-border mt-1" step={0.1} />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">ASST IV (%)</Label>
            <Input type="number" value={asstIv}
              onChange={e => setAsstIv(Math.max(1, parseFloat(e.target.value)||1))}
              className="h-8 text-xs font-mono bg-secondary border-border mt-1" step={5} />
          </div>
        </> : <>
          <div>
            <Label className="text-[10px] text-muted-foreground">MSTR Current Price ($) <span className="text-amber-400">live</span></Label>
            <Input type="number" value={mstrPriceActual}
              onChange={e => setMstrPriceActual(Math.max(0.01, parseFloat(e.target.value)||0.01))}
              className="h-8 text-xs font-mono bg-secondary border-border mt-1" step={1} />
            <p className="text-[9px] text-muted-foreground mt-0.5">Used for "Now" row only</p>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">MSTR mNAV Multiple</Label>
            <Input type="number" value={mstrMnav}
              onChange={e => { setMstrMnav(Math.max(0.1, parseFloat(e.target.value)||0.1)); setActivePreset("Custom"); }}
              className="h-8 text-xs font-mono bg-secondary border-border mt-1" step={0.1} />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">MSTR IV (%)</Label>
            <Input type="number" value={mstrIv}
              onChange={e => setMstrIv(Math.max(1, parseFloat(e.target.value)||1))}
              className="h-8 text-xs font-mono bg-secondary border-border mt-1" step={5} />
          </div>
        </>}
      </div>

      {/* MSTR extra: dilution rate */}
      {activeTicker === "MSTR" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <Label className="text-[10px] text-muted-foreground">Share Dilution / Quarter (%)</Label>
            <Input type="number" value={mstrDilution}
              onChange={e => setMstrDilution(Math.max(0, parseFloat(e.target.value)||0))}
              className="h-8 text-xs font-mono bg-secondary border-border mt-1" step={0.25} />
            <p className="text-[9px] text-muted-foreground mt-0.5">Base: 1.5% / quarter from ATM issuance</p>
          </div>
        </div>
      )}

      {/* IV slider */}
      <div className="p-3 bg-secondary/30 rounded-xl border border-border mb-4 space-y-1.5">
        <div className="flex justify-between">
          <Label className="text-[10px] text-muted-foreground">{activeTicker} Implied Volatility (σ)</Label>
          <span className="text-[10px] font-mono text-amber-400 font-bold">{iv}%</span>
        </div>
        <Slider value={[iv]} onValueChange={([v]) => setIv(v)} min={10} max={300} step={5} />
        <p className="text-[9px] text-muted-foreground">
          {activeTicker === "MSTR" ? "MSTR typical IV: 60–120%." : "ASST typical IV: 100–150%."} Used for option value projection only.
        </p>
      </div>

      {/* Milestone cards */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-4">
        {[
          { label: `${activeTicker} Now`, value: `$${actualPriceNow.toFixed(2)}`, color: "text-foreground", sub: "actual price" },
          y1Row && { label: `${activeTicker} Y1`, value: `$${y1Row.price.toFixed(2)}`, color: cfg.color.replace("#","text-[#"), sub: `+${(((y1Row.price/priceNow)-1)*100).toFixed(0)}%` },
          y2Row && { label: `${activeTicker} Y2`, value: `$${y2Row.price.toFixed(2)}`, color: "text-cyan-400", sub: `+${(((y2Row.price/priceNow)-1)*100).toFixed(0)}%` },
          y5Row && { label: `${activeTicker} Y5`, value: `$${y5Row.price.toFixed(2)}`, color: "text-primary", sub: `+${(((y5Row.price/priceNow)-1)*100).toFixed(0)}%` },
          legs.length > 0 && {
            label: "Leg Net Cost",
            value: `${netLegCost >= 0 ? "+" : ""}${formatCurrency(netLegCost, 0)}`,
            color: netLegCost >= 0 ? "text-green-400" : "text-destructive",
            sub: netLegCost >= 0 ? "credit" : "debit",
          },
        ].filter(Boolean).map((m, i) => (
          <div key={i} className="p-2.5 bg-secondary/50 rounded-xl border border-border text-center">
            <p className="text-[9px] text-muted-foreground">{m.label}</p>
            <p className={`text-xs font-bold font-mono mt-0.5 ${m.color.startsWith("text-[") ? "" : m.color}`}
               style={m.color.startsWith("text-[#") ? { color: m.color.slice(7, -1) } : {}}>
              {m.value}
            </p>
            <p className="text-[8px] text-muted-foreground">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
        {activeTicker} Price Projection — {btcCagr}% BTC CAGR · {activeTicker === "MSTR" ? mstrMnav : asstMnav}x mNAV · 20 Quarters
        {legs.length > 0 && <span className="text-primary ml-2">· Option P&L overlaid ({legs.length} leg{legs.length !== 1 ? "s" : ""})</span>}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis dataKey="label" tick={TICK_STYLE} interval={3} angle={-30} textAnchor="end" height={36} />
          <YAxis yAxisId="price" tick={TICK_STYLE} tickFormatter={v => `$${parseFloat(v).toFixed(0)}`} />
          {legs.length > 0 && (
            <YAxis yAxisId="pnl" orientation="right" tick={TICK_STYLE} tickFormatter={v => formatCurrency(v, 0)} />
          )}
          <Tooltip
            contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", fontSize: 11 }}
            formatter={(v, name) => {
              if (name === `${activeTicker} Price` || name === "NAV/Share") return [`$${parseFloat(v).toFixed(2)}`, name];
              return [formatCurrency(v, 0), name];
            }}
            labelFormatter={l => `Quarter: ${l}`}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {yearBoundaries.map(lb => (
            <ReferenceLine key={lb} x={lb} yAxisId="price" stroke="hsl(217 33% 22%)" strokeDasharray="4 2" />
          ))}
          <ReferenceLine yAxisId="price" x="Now" stroke="hsl(217 33% 40%)" strokeDasharray="3 3"
            label={{ value: "Now", fontSize: 8, fill: "hsl(215 20% 55%)" }} />
          <Area yAxisId="price" type="monotone" dataKey="price" stroke={cfg.color} strokeWidth={2}
            fill={cfg.color} fillOpacity={0.08} name={`${activeTicker} Price`} dot={false} />
          <Line yAxisId="price" type="monotone" dataKey="navPerShare" stroke={cfg.navColor} strokeWidth={1.5}
            name="NAV/Share" dot={false} strokeDasharray="4 2" />
          {legs.length > 0 && (
            <Line yAxisId="pnl" type="monotone" dataKey="optionPnl" stroke="#F59E0B" strokeWidth={2}
              name="Option P&L at Projected Price" dot={false} />
          )}
          {legs.length > 0 && (
            <ReferenceLine yAxisId="pnl" y={0} stroke="#EF4444" strokeDasharray="4 2" strokeWidth={1} />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Quarterly table */}
      <div className="mt-4 overflow-x-auto">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
          Quarterly Projection Table
          {legs.length > 0 && <span className="text-amber-400 ml-2 normal-case">· through expiration ({daysToExpiry}d)</span>}
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-[9px]">
              <th className="text-left py-1.5 pr-3">Period</th>
              <th className="text-right py-1.5 pr-3">BTC Price</th>
              <th className="text-right py-1.5 pr-3">NAV/Share</th>
              <th className="text-right py-1.5 pr-3">{activeTicker} Price</th>
              <th className="text-right py-1.5 pr-3">vs Now</th>
              {legs.length > 0 && <th className="text-right py-1.5">Option P&L</th>}
            </tr>
          </thead>
          <tbody>
            {projRows.filter(r => r.q <= expiryQuarter).map(row => {
              const cd = chartData.find(c => c.q === row.q);
              const isNow = row.q === 0;
              const isYrEnd = row.q % 4 === 0 && row.q > 0;
              const isExpiry = row.q === expiryQuarter;
              // "Now" row always shows actual live values, not projection-derived
              const displayBtc   = isNow ? btcPriceNow    : row.btcPrice;
              const displayNav   = isNow ? actualNavNow   : row.navPerShare;
              const displayPrice = isNow ? actualPriceNow : row.price;
              const pctVsNow = ((displayPrice / priceNow - 1) * 100).toFixed(0);
              return (
                <tr key={row.q} className={`border-b ${isExpiry ? "border-amber-500/60 bg-amber-500/10" : "border-border/30"} ${isYrEnd && !isExpiry ? "bg-secondary/20" : ""} ${isNow ? "bg-secondary/40" : ""}`}>
                  <td className={`py-1 pr-3 font-mono font-semibold ${isExpiry ? "text-amber-400" : isYrEnd ? "text-primary" : isNow ? "text-foreground" : "text-muted-foreground"}`}>
                    {row.label}
                    {isNow && <span className="text-[8px] text-amber-400 ml-1">actual</span>}
                    {isExpiry && <span className="text-[8px] text-amber-400 ml-1 font-bold">← expiry</span>}
                  </td>
                  <td className="py-1 pr-3 text-right font-mono text-amber-400">${displayBtc.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                  <td className="py-1 pr-3 text-right font-mono text-purple-400">${displayNav.toFixed(2)}</td>
                  <td className="py-1 pr-3 text-right font-mono font-bold" style={{ color: cfg.color }}>${displayPrice.toFixed(2)}</td>
                  <td className={`py-1 pr-3 text-right font-mono ${isNow ? "text-muted-foreground" : parseFloat(pctVsNow) >= 0 ? "text-green-400" : "text-destructive"}`}>
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
        Bitcoin24 decelerating-growth model. MSTR NAV deducts ~$10.4B preferred. Option P&L uses Black-Scholes at projected price with fixed DTE. Not financial advice.
      </p>
    </Card>
  );
}