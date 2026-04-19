import React, { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, Zap, Bitcoin, BarChart3, RefreshCw } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from "recharts";

// ─── Constants ─────────────────────────────────────────────────────────────
const START_YEAR = 2025;
const HORIZON    = 21; // 2025–2045

// ASST defaults (Strive, April 2026)
const ASST_DEFAULTS = {
  btc_holdings: 13767.9,
  shares_diluted_M: 97.47,
  btc_accum_per_year: 10000,
  mnav: 1.32,
};

// Preferred programs (MSTR)
const MSTR_PREF_DEFAULTS = {
  strc_notional_M:  6358,  // $6.358B
  strc_rate:        0.115, // 11.5%
  strd_notional_M:  1402,
  strd_rate:        0.10,
  strf_notional_M:  1284,
  strf_rate:        0.10,
  strk_notional_M:  1402,
  strk_rate:        0.08,
};
const MSTR_TOTAL_PREF_M = Object.values(MSTR_PREF_DEFAULTS)
  .filter((_, i) => i % 2 === 0).reduce((a, v) => a + v, 0);

const PRESETS = {
  Bear: { initARR: 25, declineRate: 3,  terminal: 5,  mstrMnav: 1.0, asstMnav: 1.0, mstrAccumYr: 30000, asstAccumYr: 5000,  mstrDilutionYr: 8,  mstrShares: 450, prefGrowthYr: 0    },
  Base: { initARR: 55, declineRate: 5,  terminal: 10, mstrMnav: 1.5, asstMnav: 1.3, mstrAccumYr: 60000, asstAccumYr: 10000, mstrDilutionYr: 5,  mstrShares: 380, prefGrowthYr: 500  },
  Bull: { initARR: 90, declineRate: 7,  terminal: 15, mstrMnav: 2.5, asstMnav: 2.0, mstrAccumYr: 100000,asstAccumYr: 20000, mstrDilutionYr: 3,  mstrShares: 320, prefGrowthYr: 1000 },
};

// Global wealth for % calc (~$500T)
const GLOBAL_WEALTH_T = 500;

function SliderRow({ label, value, set, min, max, step, fmt, color = "text-foreground" }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <Label className={`text-[11px] font-medium ${color}`}>{label}</Label>
        <span className={`text-[11px] font-mono font-bold ${color}`}>{fmt ? fmt(value) : value}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => set(v)} min={min} max={max} step={step} className="cursor-pointer" />
    </div>
  );
}

function StatBox({ label, value, sub, color = "text-foreground" }) {
  return (
    <div className="bg-secondary/40 rounded-xl p-3 text-center border border-border">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold font-mono mt-0.5 ${color}`}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

const TICK = { fontSize: 9, fill: "hsl(215 20% 55%)" };
const GRID = "hsl(217 33% 17%)";
const TOOLTIP_STYLE = { background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 };

// ─── Core simulation ────────────────────────────────────────────────────────
function runSimulation(p) {
  const rows = [];
  let btcPrice      = p.btcStart;
  let mstrBtcHold   = p.mstrBtcHoldings;
  let asstBtcHold   = ASST_DEFAULTS.btc_holdings;
  let mstrSharesM   = p.mstrShares;
  let asstSharesM   = p.asstShares ?? ASST_DEFAULTS.shares_diluted_M;
  let growthRate    = p.initARR / 100;
  const terminal    = p.terminal / 100;
  const asstDilYr   = p.asstDilutionYr ?? 2;
  const asstPrefGr  = p.asstPrefGrowthYr ?? 0;
  const ASST_INIT_PREF_M = 437.32; // SATA notional

  for (let i = 0; i <= HORIZON; i++) {
    const year = START_YEAR + i;

    // BTC price path
    if (i > 0) {
      growthRate = Math.max(growthRate - p.declineRate / 100, terminal);
      btcPrice   = btcPrice * (1 + growthRate);
      mstrBtcHold += p.mstrAccumYr;
      asstBtcHold += p.asstAccumYr;
      mstrSharesM = mstrSharesM * (1 + p.mstrDilutionYr / 100);
      asstSharesM = asstSharesM * (1 + asstDilYr / 100);
    }

    // MSTR equity price
    const mstrBtcNav = mstrBtcHold * btcPrice;
    const extraPrefM = i * p.prefGrowthYr;
    const totalPrefM = MSTR_TOTAL_PREF_M + extraPrefM;
    const mstrNavPerShare = (mstrBtcNav - totalPrefM * 1e6) / (mstrSharesM * 1e6);
    const mstrPrice = Math.max(0, mstrNavPerShare * p.mstrMnav);
    const mstrAmplPct = mstrBtcNav > 0 ? (totalPrefM * 1e6 / mstrBtcNav) * 100 : 0;

    // ASST equity price (net of preferred liabilities)
    const asstBtcNav = asstBtcHold * btcPrice;
    const asstExtraPrefM = i * asstPrefGr;
    const asstTotalPrefM = ASST_INIT_PREF_M + asstExtraPrefM;
    const asstBtcNavPerShare = (asstBtcNav - asstTotalPrefM * 1e6) / (asstSharesM * 1e6);
    const asstPrice = Math.max(0, asstBtcNavPerShare * p.asstMnav);
    const asstAmplPct = asstBtcNav > 0 ? (asstTotalPrefM * 1e6 / asstBtcNav) * 100 : 0;

    // BTC market cap
    const btcMcapT = (btcPrice * 21e6) / 1e12;
    const pctGlobalWealth = (btcMcapT / GLOBAL_WEALTH_T) * 100;

    rows.push({
      year,
      growthRate: (growthRate * 100).toFixed(1),
      btcPrice:   +btcPrice.toFixed(0),
      btcMcapT:   +btcMcapT.toFixed(2),
      pctGlobalWealth: +pctGlobalWealth.toFixed(1),
      mstrBtcHold: +mstrBtcHold.toFixed(0),
      mstrSharesM: +mstrSharesM.toFixed(1),
      mstrNavPerShare: +mstrNavPerShare.toFixed(2),
      mstrPrice:  +mstrPrice.toFixed(2),
      mstrAmplPct: +mstrAmplPct.toFixed(1),
      asstBtcHold:  +asstBtcHold.toFixed(0),
      asstSharesM:  +asstSharesM.toFixed(1),
      asstPrice:    +asstPrice.toFixed(2),
      asstAmplPct:  +asstAmplPct.toFixed(1),
    });
  }
  return rows;
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function Bitcoin24Simulator({ liveData }) {
  const [preset,       setPreset]       = useState("Base");
  const [logScale,     setLogScale]     = useState(true);

  const initFromPreset = (name) => PRESETS[name] ?? PRESETS.Base;

  const [initARR,       setInitARR]       = useState(PRESETS.Base.initARR);
  const [declineRate,   setDeclineRate]   = useState(PRESETS.Base.declineRate);
  const [terminal,      setTerminal]      = useState(PRESETS.Base.terminal);
  const [mstrMnav,      setMstrMnav]      = useState(PRESETS.Base.mstrMnav);
  const [asstMnav,      setAsstMnav]      = useState(PRESETS.Base.asstMnav);
  const [mstrAccumYr,   setMstrAccumYr]   = useState(PRESETS.Base.mstrAccumYr);
  const [asstAccumYr,    setAsstAccumYr]    = useState(PRESETS.Base.asstAccumYr);
  const [asstDilutionYr, setAsstDilutionYr] = useState(2);
  const [asstShares,     setAsstShares]     = useState(97);
  const [asstPrefGrowthYr, setAsstPrefGrowthYr] = useState(0);
  const [mstrDilutionYr,setMstrDilutionYr]= useState(PRESETS.Base.mstrDilutionYr);
  const [mstrShares,    setMstrShares]    = useState(PRESETS.Base.mstrShares);
  const [prefGrowthYr,  setPrefGrowthYr]  = useState(PRESETS.Base.prefGrowthYr);
  const [mstrBtcHoldings, setMstrBtcHoldings] = useState(780897);

  const btcStart = liveData?.btc_price ?? 84000;

  const applyPreset = (name) => {
    const p = initFromPreset(name);
    setPreset(name);
    setInitARR(p.initARR);
    setDeclineRate(p.declineRate);
    setTerminal(p.terminal);
    setMstrMnav(p.mstrMnav);
    setAsstMnav(p.asstMnav);
    setMstrAccumYr(p.mstrAccumYr);
    setAsstAccumYr(p.asstAccumYr);
    setMstrDilutionYr(p.mstrDilutionYr);
    setMstrShares(p.mstrShares);
    setPrefGrowthYr(p.prefGrowthYr);
  };

  const rows = useMemo(() => runSimulation({
    btcStart, initARR, declineRate, terminal,
    mstrMnav, asstMnav,
    mstrAccumYr, asstAccumYr,
    mstrDilutionYr, mstrShares,
    prefGrowthYr, mstrBtcHoldings,
    asstDilutionYr, asstShares, asstPrefGrowthYr,
  }), [btcStart, initARR, declineRate, terminal, mstrMnav, asstMnav,
       mstrAccumYr, asstAccumYr, mstrDilutionYr, mstrShares, prefGrowthYr, mstrBtcHoldings,
       asstDilutionYr, asstShares, asstPrefGrowthYr]);

  const last  = rows[rows.length - 1];
  const now   = rows[0];

  const mstrCAGR = now.mstrPrice > 0
    ? ((Math.pow(last.mstrPrice / now.mstrPrice, 1 / HORIZON) - 1) * 100).toFixed(1) : "—";
  const asstCAGR = now.asstPrice > 0
    ? ((Math.pow(last.asstPrice / now.asstPrice, 1 / HORIZON) - 1) * 100).toFixed(1) : "—";
  const btcCAGR  = ((Math.pow(last.btcPrice  / now.btcPrice,  1 / HORIZON) - 1) * 100).toFixed(1);
  const mstrMult = (last.mstrPrice / now.mstrPrice).toFixed(1);
  const asstMult = (last.asstPrice / now.asstPrice).toFixed(1);
  const btcMult  = (last.btcPrice  / now.btcPrice ).toFixed(1);

  const handleExport = () => {
    const headers = ["Year","BTC Price","BTC MCAP ($T)","% Global Wealth","Growth Rate","MSTR BTC","MSTR Shares(M)","MSTR NAV/sh","MSTR Price","MSTR Ampl%","ASST BTC","ASST Price","ASST Ampl%"];
    const csvRows = rows.map(r => [
      r.year, r.btcPrice, r.btcMcapT, r.pctGlobalWealth, r.growthRate,
      r.mstrBtcHold, r.mstrSharesM, r.mstrNavPerShare, r.mstrPrice, r.mstrAmplPct,
      r.asstBtcHold, r.asstPrice, r.asstAmplPct,
    ]);
    const csv = [headers.join(","), ...csvRows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url;
    a.download = `btc24_simulator_${preset.toLowerCase()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Chart data — thin for log scale readability
  const chartData = rows;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 flex items-center justify-center shrink-0">
              <Bitcoin className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                MSTR & ASST — Bitcoin24 Dynamic Equity Simulator
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Decelerating BTC growth path (Bitcoin24-style) → derives MSTR & ASST equity prices from BTC reserve, mNAV multiple, diluted shares, and preferred amplification. 2025–2045 horizon.
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5" onClick={() => setLogScale(v => !v)}>
              <BarChart3 className="w-3.5 h-3.5" />
              {logScale ? "Linear" : "Log"} Scale
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5" onClick={handleExport}>
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Preset buttons */}
        <div className="flex gap-2 mt-4 flex-wrap items-center">
          <span className="text-[10px] text-muted-foreground">Preset:</span>
          {["Bear", "Base", "Bull"].map(p => (
            <button key={p} onClick={() => applyPreset(p)}
              className={`text-xs px-3 py-1 rounded-lg border transition-colors font-semibold ${
                preset === p
                  ? p === "Bull" ? "bg-primary text-primary-foreground border-primary"
                    : p === "Bear" ? "bg-destructive/80 text-white border-destructive"
                    : "bg-amber-500/80 text-white border-amber-500"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}>{p}</button>
          ))}
          <span className="text-[10px] text-muted-foreground ml-3">BTC live: <span className="text-amber-400 font-mono font-bold">${btcStart.toLocaleString()}</span></span>
        </div>
      </div>

      {/* ── Summary KPIs ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <StatBox label="BTC 21Y CAGR"   value={`${btcCAGR}%`}  color="text-amber-400" />
        <StatBox label="BTC 21Y Return"  value={`${btcMult}x`}  color="text-amber-400" sub={`→ ${formatCurrency(last.btcPrice)}`} />
        <StatBox label="MSTR 21Y CAGR"  value={`${mstrCAGR}%`} color="text-primary" />
        <StatBox label="MSTR 21Y Return" value={`${mstrMult}x`} color="text-primary" sub={`→ ${formatCurrency(last.mstrPrice, 2)}`} />
        <StatBox label="ASST 21Y CAGR"  value={`${asstCAGR}%`} color="text-blue-400" />
        <StatBox label="ASST 21Y Return" value={`${asstMult}x`} color="text-blue-400" sub={`→ ${formatCurrency(last.asstPrice, 2)}`} />
      </div>

      {/* ── Controls + Main Chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sliders panel */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">BTC Growth Path</h3>
          </div>
          <SliderRow label="Initial Annual Growth Rate (Y1)" value={initARR}     set={setInitARR}     min={10} max={150} step={5} fmt={v => `${v}%`} color="text-amber-400" />
          <SliderRow label="Annual Decline Rate (δ/yr)"      value={declineRate} set={setDeclineRate} min={1}  max={15}  step={1} fmt={v => `${v}%`} color="text-orange-400" />
          <SliderRow label="Terminal Growth Floor"            value={terminal}    set={setTerminal}    min={1}  max={30}  step={1} fmt={v => `${v}%`} color="text-muted-foreground" />

          <div className="border-t border-border pt-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">MSTR Parameters</h3>
            </div>
            <div className="space-y-3">
              <SliderRow label="mNAV Multiple"             value={mstrMnav}       set={setMstrMnav}       min={0.5} max={5}      step={0.1}  fmt={v => `${v.toFixed(1)}x`} color="text-primary" />
              <SliderRow label="Annual BTC Accumulation"   value={mstrAccumYr}    set={setMstrAccumYr}    min={0}   max={200000} step={5000} fmt={v => formatNumber(v) + " BTC"} color="text-amber-400" />
              <SliderRow label="Annual Share Dilution"     value={mstrDilutionYr} set={setMstrDilutionYr} min={0}   max={20}     step={0.5}  fmt={v => `${v}%`} color="text-orange-400" />
              <SliderRow label="Diluted Shares Now (M)"    value={mstrShares}     set={setMstrShares}     min={200} max={800}    step={10}   fmt={v => `${v}M`} color="text-muted-foreground" />
              <SliderRow label="New Pref Raised/Year ($M)" value={prefGrowthYr}   set={setPrefGrowthYr}   min={0}   max={5000}   step={100}  fmt={v => `$${v}M`} color="text-purple-400" />
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">ASST Parameters</h3>
            </div>
            <div className="space-y-3">
              <SliderRow label="mNAV Multiple"              value={asstMnav}        set={setAsstMnav}        min={0.5} max={5}      step={0.1}  fmt={v => `${v.toFixed(1)}x`} color="text-blue-400" />
              <SliderRow label="Annual BTC Accumulation"    value={asstAccumYr}     set={setAsstAccumYr}     min={0}   max={50000}  step={1000} fmt={v => formatNumber(v) + " BTC"} color="text-cyan-400" />
              <SliderRow label="Annual Share Dilution"      value={asstDilutionYr}  set={setAsstDilutionYr}  min={0}   max={20}     step={0.5}  fmt={v => `${v}%`} color="text-orange-400" />
              <SliderRow label="Diluted Shares Now (M)"     value={asstShares}      set={setAsstShares}      min={50}  max={500}    step={5}    fmt={v => `${v}M`} color="text-muted-foreground" />
              <SliderRow label="New Pref Raised/Year ($M)"  value={asstPrefGrowthYr} set={setAsstPrefGrowthYr} min={0} max={2000}  step={50}   fmt={v => `$${v}M`} color="text-purple-400" />
            </div>
          </div>
        </div>

        {/* Main price chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Price Projection 2025–2045</h3>
              <p className="text-[10px] text-muted-foreground">BTC · MSTR · ASST ({logScale ? "log" : "linear"} scale)</p>
            </div>
            <div className="flex gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-3 h-[2px] bg-amber-400 inline-block rounded" /> BTC</span>
              <span className="flex items-center gap-1"><span className="w-3 h-[2px] bg-green-400 inline-block rounded" /> MSTR</span>
              <span className="flex items-center gap-1"><span className="w-3 h-[2px] bg-blue-400  inline-block rounded" /> ASST</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="year" tick={TICK} />
              <YAxis
                scale={logScale ? "log" : "linear"}
                domain={logScale ? ["auto", "auto"] : [0, "auto"]}
                allowDataOverflow
                tickFormatter={v => formatCurrency(v)}
                tick={TICK}
                width={68}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v, name) => [formatCurrency(v, 2), name]}
                labelFormatter={l => `Year ${l}`}
              />
              <Line type="monotone" dataKey="btcPrice"  name="BTC"  stroke="#F59E0B" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="mstrPrice" name="MSTR" stroke="#22C55E" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="asstPrice" name="ASST" stroke="#60A5FA" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Sub-charts row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Growth rate decay */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] font-semibold text-foreground mb-1">BTC Annual Growth Rate Decay</p>
          <p className="text-[10px] text-muted-foreground mb-2">{"g_t = max(g_{t-1} − δ, g_terminal)"}</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 2, right: 8, bottom: 2, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="year" tick={{ fontSize: 8, fill: "hsl(215 20% 55%)" }} />
              <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 8, fill: "hsl(215 20% 55%)" }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v}%`, "Growth Rate"]} labelFormatter={l => `Year ${l}`} />
              <ReferenceLine y={terminal} stroke="hsl(215 20% 40%)" strokeDasharray="4 2" label="Floor" />
              <Line type="monotone" dataKey="growthRate" name="Annual Growth %" stroke="#F59E0B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* MSTR vs ASST amplification */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] font-semibold text-foreground mb-1">Amplification % Over Time</p>
          <p className="text-[10px] text-muted-foreground mb-2">Pref Liabilities ÷ BTC Reserve × 100</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 2, right: 8, bottom: 2, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="year" tick={{ fontSize: 8, fill: "hsl(215 20% 55%)" }} />
              <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 8, fill: "hsl(215 20% 55%)" }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v}%`]} labelFormatter={l => `Year ${l}`} />
              <Line type="monotone" dataKey="mstrAmplPct" name="MSTR Ampl%" stroke="#22C55E" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="asstAmplPct" name="ASST Ampl%" stroke="#60A5FA" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* BTC market cap & global wealth */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] font-semibold text-foreground mb-1">BTC Market Cap & % Global Wealth</p>
          <p className="text-[10px] text-muted-foreground mb-2">21M supply × BTC price vs $500T global wealth</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 2, right: 8, bottom: 2, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="year" tick={{ fontSize: 8, fill: "hsl(215 20% 55%)" }} />
              <YAxis yAxisId="left"  tick={{ fontSize: 8, fill: "hsl(215 20% 55%)" }} tickFormatter={v => `$${v}T`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 8, fill: "hsl(215 20% 55%)" }} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => name.includes("%") ? [`${v}%`, name] : [`$${v}T`, name]} labelFormatter={l => `Year ${l}`} />
              <Line yAxisId="left"  type="monotone" dataKey="btcMcapT"         name="BTC MCAP ($T)" stroke="#F59E0B" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="pctGlobalWealth"  name="% Global Wealth" stroke="#A78BFA" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Year-by-year table ── */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Year-by-Year Projection Table</h3>
          </div>
          <span className="text-[10px] text-muted-foreground">Preset: <span className="font-semibold text-foreground">{preset}</span> · BTC start: <span className="font-mono text-amber-400">{formatCurrency(btcStart)}</span></span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[10px] min-w-[900px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1.5 pr-2 font-medium">Year</th>
                <th className="text-right py-1.5 pr-2 font-medium text-amber-400">BTC Price</th>
                <th className="text-right py-1.5 pr-2 font-medium text-amber-400">Growth</th>
                <th className="text-right py-1.5 pr-2 font-medium text-amber-400">BTC MCAP</th>
                <th className="text-right py-1.5 pr-2 font-medium text-muted-foreground">% Wealth</th>
                <th className="text-right py-1.5 pr-2 font-medium text-primary">MSTR BTC</th>
                <th className="text-right py-1.5 pr-2 font-medium text-primary">MSTR NAV/sh</th>
                <th className="text-right py-1.5 pr-2 font-medium text-primary">MSTR Price</th>
                <th className="text-right py-1.5 pr-2 font-medium text-primary">MSTR Ampl%</th>
                <th className="text-right py-1.5 pr-2 font-medium text-blue-400">ASST BTC</th>
                <th className="text-right py-1.5 font-medium text-blue-400">ASST Price</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const mstrRet = i > 0 ? ((r.mstrPrice / rows[0].mstrPrice - 1) * 100).toFixed(0) : null;
                const asstRet = i > 0 ? ((r.asstPrice / rows[0].asstPrice - 1) * 100).toFixed(0) : null;
                const isHalf  = i === Math.floor(HORIZON / 2);
                return (
                  <tr key={r.year} className={`border-b border-border/30 hover:bg-secondary/20 ${i === 0 ? "bg-secondary/10 font-semibold" : ""} ${isHalf ? "bg-primary/5" : ""}`}>
                    <td className="py-1 pr-2 font-semibold text-foreground">{r.year}</td>
                    <td className="py-1 pr-2 text-right font-mono text-amber-400">{formatCurrency(r.btcPrice)}</td>
                    <td className="py-1 pr-2 text-right font-mono text-orange-400">{r.growthRate}%</td>
                    <td className="py-1 pr-2 text-right font-mono text-amber-400">${r.btcMcapT}T</td>
                    <td className="py-1 pr-2 text-right font-mono text-muted-foreground">{r.pctGlobalWealth}%</td>
                    <td className="py-1 pr-2 text-right font-mono text-primary">{r.mstrBtcHold.toLocaleString()}</td>
                    <td className="py-1 pr-2 text-right font-mono text-primary">{formatCurrency(r.mstrNavPerShare, 2)}</td>
                    <td className="py-1 pr-2 text-right font-mono text-primary font-bold">{formatCurrency(r.mstrPrice, 2)}{mstrRet ? <span className="text-primary/60 ml-1">({mstrRet}%)</span> : null}</td>
                    <td className="py-1 pr-2 text-right font-mono text-purple-400">{r.mstrAmplPct}%</td>
                    <td className="py-1 pr-2 text-right font-mono text-blue-400">{r.asstBtcHold.toLocaleString()}</td>
                    <td className="py-1 text-right font-mono text-blue-400 font-bold">{formatCurrency(r.asstPrice, 2)}{asstRet ? <span className="text-blue-400/60 ml-1">({asstRet}%)</span> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="MSTR 21Y CAGR"  value={`${mstrCAGR}%`}  color="text-primary"   sub={`${mstrMult}x total return`} />
          <StatBox label="MSTR 2045 Price" value={formatCurrency(last.mstrPrice, 0)} color="text-primary" />
          <StatBox label="ASST 21Y CAGR"  value={`${asstCAGR}%`}  color="text-blue-400"  sub={`${asstMult}x total return`} />
          <StatBox label="ASST 2045 Price" value={formatCurrency(last.asstPrice, 0)} color="text-blue-400" />
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground/40 text-center">
        Bitcoin24-style decelerating growth model. Not financial advice. MSTR price = (BTC Holdings × BTC Price − Total Pref) ÷ Diluted Shares × mNAV. ASST price = BTC NAV/sh × mNAV. Preferred amplification = Pref Liabilities ÷ BTC Reserve.
      </p>
    </div>
  );
}