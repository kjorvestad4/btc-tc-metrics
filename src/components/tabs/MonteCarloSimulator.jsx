import React, { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/calculations";
import { Dices, TrendingUp } from "lucide-react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const TICK_STYLE = { fontSize: 9, fill: "hsl(215 20% 55%)" };
const GRID_COLOR = "hsl(217 33% 17%)";
const HORIZON = 21;
const START_YEAR = 2025;
const N_SIMS = 2000;

// Seeded LCG for deterministic but varied random numbers
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

function boxMuller(rand) {
  const u1 = rand();
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Run Monte Carlo simulations for a portfolio starting at $startValue.
 * BTC-correlated assets drive growth. Vol declines from initVol → terminalVol linearly.
 * Returns percentile bands per year.
 */
function runMonteCarlo({ startValue, initAnnReturn, initVol, terminalVol, horizon, seed = 42 }) {
  const rand = seededRandom(seed);
  const paths = [];

  for (let sim = 0; sim < N_SIMS; sim++) {
    let val = startValue;
    const path = [val];
    for (let y = 1; y <= horizon; y++) {
      // Vol declines linearly from initVol to terminalVol
      const t = y / horizon;
      const vol = initVol + (terminalVol - initVol) * t;
      // Log-normal annual return
      const z = boxMuller(rand);
      const annReturn = Math.exp((initAnnReturn - 0.5 * vol * vol) + vol * z) - 1;
      val = Math.max(0, val * (1 + annReturn));
      path.push(val);
    }
    paths.push(path);
  }

  // Compute percentiles per year
  const rows = [];
  for (let y = 0; y <= horizon; y++) {
    const vals = paths.map(p => p[y]).sort((a, b) => a - b);
    const n = vals.length;
    const pct = (p) => vals[Math.floor(p * n / 100)] ?? vals[n - 1];
    rows.push({
      year: START_YEAR + y,
      p10: pct(10),
      p25: pct(25),
      p50: pct(50),
      p75: pct(75),
      p90: pct(90),
    });
  }
  return rows;
}

function Card({ children, className = "" }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

const SCENARIO_DEFAULTS = {
  Bear: { initReturn: 25, initVol: 80, terminalVol: 40 },
  Base: { initReturn: 55, initVol: 65, terminalVol: 30 },
  Bull: { initReturn: 90, initVol: 65, terminalVol: 25 },
};

export default function MonteCarloSimulator({ portfolioValue, activePreset }) {
  const defaults = SCENARIO_DEFAULTS[activePreset] ?? SCENARIO_DEFAULTS.Base;
  const [initReturn, setInitReturn] = useState(defaults.initReturn);
  const [initVol, setInitVol] = useState(defaults.initVol);
  const [terminalVol, setTerminalVol] = useState(defaults.terminalVol);
  const [simSeed, setSimSeed] = useState(42);

  // Sync defaults when preset changes (one-time on mount via key trick handled in parent)
  const start = portfolioValue > 0 ? portfolioValue : 100000;

  const mcRows = useMemo(() => runMonteCarlo({
    startValue: start,
    initAnnReturn: initReturn / 100,
    initVol: initVol / 100,
    terminalVol: terminalVol / 100,
    horizon: HORIZON,
    seed: simSeed,
  }), [start, initReturn, initVol, terminalVol, simSeed]);

  const finalP50 = mcRows[mcRows.length - 1]?.p50 ?? 0;
  const finalP10 = mcRows[mcRows.length - 1]?.p10 ?? 0;
  const finalP90 = mcRows[mcRows.length - 1]?.p90 ?? 0;

  const successRate = useMemo(() => {
    // % of paths that end above the starting value (positive real return)
    const rand = seededRandom(simSeed);
    let above = 0;
    for (let s = 0; s < N_SIMS; s++) {
      let val = start;
      for (let y = 1; y <= HORIZON; y++) {
        const t = y / HORIZON;
        const vol = (initVol / 100) + ((terminalVol - initVol) / 100) * t;
        const z = boxMuller(rand);
        val = Math.max(0, val * Math.exp((initReturn / 100 - 0.5 * vol * vol) + vol * z));
      }
      if (val > start) above++;
    }
    return ((above / N_SIMS) * 100).toFixed(0);
  }, [start, initReturn, initVol, terminalVol, simSeed]);

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Dices className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Monte Carlo Simulator</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">{N_SIMS.toLocaleString()} simulations · {HORIZON}yr horizon</span>
      </div>
      <p className="text-[10px] text-muted-foreground mb-4">
        Randomized annual returns using log-normal distribution. Volatility declines from initial → terminal as BTC matures.
        Shaded bands show 10th–90th and 25th–75th percentile outcomes.
      </p>

      {portfolioValue <= 0 && (
        <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg p-3 mb-4">
          ⚠ Enter your holdings in the Portfolio Calculator above to see personalized projections.
        </p>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3 bg-secondary/30 rounded-xl border border-border">
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-[10px] text-muted-foreground">Initial Annual Return</Label>
            <span className="text-[10px] font-mono text-primary font-bold">{initReturn}%</span>
          </div>
          <Slider value={[initReturn]} onValueChange={([v]) => setInitReturn(v)} min={5} max={150} step={5} />
          <p className="text-[9px] text-muted-foreground">Median expected annualized return in early years</p>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-[10px] text-muted-foreground">Initial Volatility (σ)</Label>
            <span className="text-[10px] font-mono text-amber-400 font-bold">{initVol}%</span>
          </div>
          <Slider value={[initVol]} onValueChange={([v]) => setInitVol(v)} min={10} max={150} step={5} />
          <p className="text-[9px] text-muted-foreground">BTC 1Y historical vol ≈ 65%</p>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-[10px] text-muted-foreground">Terminal Volatility (σ)</Label>
            <span className="text-[10px] font-mono text-cyan-400 font-bold">{terminalVol}%</span>
          </div>
          <Slider value={[terminalVol]} onValueChange={([v]) => setTerminalVol(v)} min={5} max={80} step={5} />
          <p className="text-[9px] text-muted-foreground">Vol converges to this by year {HORIZON}</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Median (P50) at Yr 21", value: formatCurrency(finalP50), color: "text-primary" },
          { label: "Bear Case (P10) at Yr 21", value: formatCurrency(finalP10), color: "text-destructive" },
          { label: "Bull Case (P90) at Yr 21", value: formatCurrency(finalP90), color: "text-green-400" },
          { label: "% Paths Beat Starting Value", value: `${successRate}%`, color: "text-amber-400" },
        ].map(s => (
          <div key={s.label} className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
            <p className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Fan chart */}
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={mcRows} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis dataKey="year" tick={TICK_STYLE} />
          <YAxis tick={TICK_STYLE} tickFormatter={v => formatCurrency(v)} />
          <Tooltip
            contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", fontSize: 11 }}
            formatter={(v, name) => [formatCurrency(v, 0), name]}
            labelFormatter={l => `Year ${l}`}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {/* P10-P90 outer band */}
          <Area type="monotone" dataKey="p90" stroke="none" fill="#8B5CF6" fillOpacity={0.15} name="P90 (Optimistic)" dot={false} />
          <Area type="monotone" dataKey="p10" stroke="none" fill="#8B5CF6" fillOpacity={0} name="P10 (Pessimistic)" dot={false} />
          {/* P25-P75 inner band */}
          <Area type="monotone" dataKey="p75" stroke="none" fill="#8B5CF6" fillOpacity={0.2} name="P75" dot={false} legendType="none" />
          <Area type="monotone" dataKey="p25" stroke="none" fill="hsl(222 47% 10%)" fillOpacity={0.8} name="P25" dot={false} legendType="none" />
          {/* Median line */}
          <Line type="monotone" dataKey="p50" stroke="#22C55E" strokeWidth={2.5} name="Median (P50)" dot={false} />
          <Line type="monotone" dataKey="p90" stroke="#8B5CF6" strokeWidth={1} strokeDasharray="4 2" name="P90 (Optimistic)" dot={false} />
          <Line type="monotone" dataKey="p10" stroke="#EF4444" strokeWidth={1} strokeDasharray="4 2" name="P10 (Pessimistic)" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Re-roll */}
      <div className="flex justify-end mt-2">
        <button
          onClick={() => setSimSeed(s => s + 1)}
          className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors flex items-center gap-1.5"
        >
          <Dices className="w-3 h-3" /> Re-roll simulations
        </button>
      </div>

      <p className="text-[9px] text-muted-foreground/50 text-center mt-2">
        {N_SIMS.toLocaleString()} log-normal paths. Not predictive of future performance. Not financial advice.
      </p>
    </Card>
  );
}