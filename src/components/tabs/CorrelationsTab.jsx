import React, { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import MetricCard from "../dashboard/MetricCard";
import CAGRModule from "./CAGRModule";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  TrendingUp, Activity, Layers, BarChart3, Target, Zap, BookOpen,
  ChevronRight, AlertTriangle
} from "lucide-react";

const CORRELATION_DEFINITIONS = {
  beta: {
    short: "Beta — how much an asset moves per 1% BTC move, on average",
    full: `Beta measures the sensitivity of one asset's returns to another's. In this context:
• BTC→MSTR Beta = how many % MSTR moves for each 1% BTC moves
• A Beta of 1.82x means: if BTC rises 10%, MSTR historically rose ~18.2% on average

Beta is calculated via OLS (Ordinary Least Squares) regression of daily log-returns.
Beta ≠ guaranteed movement. It is an average historical relationship. In liquidity crunches, MSTR may move far more than beta predicts (downside asymmetry).

Important: Beta changes over time as MSTR's leverage, BTC holdings, and market dynamics evolve.`
  },
  r2: {
    short: "R² — how much of an asset's variance is explained by BTC movements",
    full: `R² (R-squared) measures the goodness of fit of the beta regression. It ranges from 0 to 1 (0% to 100%).

• R² = 0.71 means 71% of MSTR's daily return variance is explained by BTC price movements
• The remaining 29% is idiosyncratic to MSTR (earnings news, leverage events, premium compression, etc.)

A higher R² means the beta relationship is more reliable. ASST has a slightly lower R² than MSTR (less trading history, smaller float), meaning more noise around the beta estimate.`
  },
  correlation: {
    short: "Pearson correlation (r) — linear relationship strength between −1 and +1",
    full: `Pearson correlation (r) measures the direction and strength of the linear relationship between two return series.
• r = +1.0: perfect positive correlation (move in lockstep)
• r = 0.0: no correlation
• r = −1.0: perfect inverse correlation

r relates to R² by: R² = r²

MSTR vs BTC 1Y correlation ≈ 0.84: strong positive. When BTC rises, MSTR very reliably rises.
Note: correlation measures direction but not magnitude. Beta captures magnitude (how much). Use both together.`
  },
  mstyBeta: {
    short: "MSTY beta to MSTR — covered call structure limits upside capture to ~0.62x price",
    full: `MSTY's covered call structure sells call options on MSTR, capping upside participation.
• Price beta to MSTR ≈ 0.62x: for every 10% MSTR rises, MSTY price rises ~6.2% (on average)
• When dividends are included (total return), the effective beta rises to ~0.71x

This means MSTY underperforms MSTR in strong bull markets but provides income compensation via weekly distributions.

The trade-off: sacrifice some upside for consistent income. In flat/volatile markets (not trending), MSTY can outperform MSTR on total return basis because the option premium is collected without giving up upside.`
  },
};

import { formatCurrency, formatPercent } from "@/lib/calculations";
import {
  BTC_MSTR_CORRELATIONS, BTC_SENSITIVITY, generateScatterData,
  MSTY_MSTR_CORRELATION, STRC_ATM_PROGRAM, STRC_RECENT_ACTIVITY, STRC_PAR_STATS
} from "@/lib/correlationData";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell
} from "recharts";

// ── helpers ──────────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, color = "text-primary" }) {
  return (
    <div className={`flex items-center gap-2 mb-3`}>
      <Icon className={`w-4 h-4 ${color}`} />
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h3>
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

// ── BTC → MSTR Correlation panel ─────────────────────────────────────────────
function BTCMSTRPanel() {
  const scatter = useMemo(() => generateScatterData(1.82), []);

  return (
    <Card>
      <SectionHeader icon={TrendingUp} title="BTC → MSTR Back-Tested Correlation" color="text-primary" />

      {/* Beta table */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-3 font-medium">Period</th>
              <th className="text-right py-1.5 pr-3 font-medium">Beta</th>
              <th className="text-right py-1.5 pr-3 font-medium">R²</th>
              <th className="text-right py-1.5 pr-3 font-medium">Corr (r)</th>
              <th className="text-right py-1.5 font-medium">Days</th>
            </tr>
          </thead>
          <tbody>
            {BTC_MSTR_CORRELATIONS.map((row) => (
              <tr key={row.period} className="border-b border-border/30 hover:bg-secondary/30">
                <td className="py-1.5 pr-3 font-semibold text-foreground">{row.period}</td>
                <td className="py-1.5 pr-3 text-right font-mono text-primary">{row.beta.toFixed(2)}x</td>
                <td className="py-1.5 pr-3 text-right font-mono text-cyan-400">{(row.r2 * 100).toFixed(0)}%</td>
                <td className="py-1.5 pr-3 text-right font-mono text-amber-400">{row.corr.toFixed(2)}</td>
                <td className="py-1.5 text-right font-mono text-muted-foreground">{row.sample_days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Scatter chart */}
      <p className="text-[10px] text-muted-foreground mb-2">Daily Return Scatter — 1Y (sampled 80 days)</p>
      <ResponsiveContainer width="100%" height={200}>
        <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
          <XAxis dataKey="btc" name="BTC %" type="number" domain={[-8, 8]}
            tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }}
            label={{ value: "BTC Daily %", position: "insideBottom", offset: -2, fontSize: 9, fill: "hsl(215 20% 55%)" }} />
          <YAxis dataKey="mstr" name="MSTR %" type="number" domain={[-18, 18]}
            tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-popover border border-border rounded p-2 text-xs">
                  <p>BTC: <span className="font-mono text-primary">{d.btc > 0 ? "+" : ""}{d.btc}%</span></p>
                  <p>MSTR: <span className="font-mono text-amber-400">{d.mstr > 0 ? "+" : ""}{d.mstr}%</span></p>
                </div>
              );
            }}
          />
          <ReferenceLine x={0} stroke="hsl(217 33% 25%)" />
          <ReferenceLine y={0} stroke="hsl(217 33% 25%)" />
          <Scatter data={scatter} fill="#22C55E" opacity={0.6} r={3} />
        </ScatterChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ── BTC Sensitivity Table panel ───────────────────────────────────────────────
function SensitivityPanel() {
  return (
    <Card>
      <SectionHeader icon={Target} title="BTC Move → MSTR Sensitivity" color="text-cyan-400" />
      <p className="text-[10px] text-muted-foreground mb-3">
        Projected MSTR % move for a given BTC % move, by historical beta period.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-3 font-medium">BTC Δ</th>
              <th className="text-right py-1.5 pr-3 font-medium">MSTR (1Y β)</th>
              <th className="text-right py-1.5 pr-3 font-medium">MSTR (3Y β)</th>
              <th className="text-right py-1.5 font-medium">MSTR (5Y β)</th>
            </tr>
          </thead>
          <tbody>
            {BTC_SENSITIVITY.map((row) => {
              const isNeg = row.btc_move < 0;
              const isZero = row.btc_move === 0;
              return (
                <tr key={row.btc_move} className={`border-b border-border/30 ${isZero ? "bg-secondary/30" : ""}`}>
                  <td className={`py-1.5 pr-3 font-mono font-bold ${isNeg ? "text-destructive" : isZero ? "text-muted-foreground" : "text-primary"}`}>
                    {row.btc_move > 0 ? "+" : ""}{row.btc_move}%
                  </td>
                  <td className={`py-1.5 pr-3 text-right font-mono ${isNeg ? "text-destructive" : "text-primary"}`}>
                    {row.mstr_1y > 0 ? "+" : ""}{row.mstr_1y.toFixed(1)}%
                  </td>
                  <td className={`py-1.5 pr-3 text-right font-mono ${isNeg ? "text-destructive" : "text-cyan-400"}`}>
                    {row.mstr_3y > 0 ? "+" : ""}{row.mstr_3y.toFixed(1)}%
                  </td>
                  <td className={`py-1.5 text-right font-mono ${isNeg ? "text-destructive" : "text-amber-400"}`}>
                    {row.mstr_5y > 0 ? "+" : ""}{row.mstr_5y.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-2">
        ⚠ Back-tested averages — MSTR volatility is asymmetric; downside can exceed beta in liquidity events.
      </p>
    </Card>
  );
}

// ── MSTY ↔ MSTR Correlation panel ────────────────────────────────────────────
function MSTYMSTRPanel() {
  const c = MSTY_MSTR_CORRELATION;
  return (
    <Card>
      <SectionHeader icon={BarChart3} title="MSTY ↔ MSTR Correlation" color="text-amber-400" />
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
          <p className="text-[10px] text-muted-foreground">Price Beta</p>
          <p className="text-xl font-bold font-mono text-amber-400">{c.price_beta}x</p>
          <p className="text-[9px] text-muted-foreground">R² = {(c.price_r2*100).toFixed(0)}%</p>
        </div>
        <div className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
          <p className="text-[10px] text-muted-foreground">Div-Adj Beta</p>
          <p className="text-xl font-bold font-mono text-primary">{c.total_return_beta}x</p>
          <p className="text-[9px] text-muted-foreground">R² = {(c.total_return_r2*100).toFixed(0)}%</p>
        </div>
      </div>
      <div className="space-y-2 mb-3">
        {[
          { label: "MSTY YTD Price Return", value: c.ytd_price_return, suffix: "%" },
          { label: "MSTY YTD Total Return (div-adj)", value: c.ytd_total_return, suffix: "%" },
          { label: "MSTR YTD Return", value: c.mstr_ytd, suffix: "%" },
          { label: "8-Wk Avg Weekly Div", value: c.avg_weekly_div, prefix: "$", suffix: "" },
        ].map((item) => (
          <div key={item.label} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{item.label}</span>
            <span className={`font-mono font-semibold ${item.value < 0 ? "text-destructive" : "text-primary"}`}>
              {item.prefix ?? ""}{item.value > 0 ? "+" : ""}{item.value}{item.suffix}
            </span>
          </div>
        ))}
      </div>
      <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[10px] text-muted-foreground space-y-1">
        <p>• MSTY covered call structure caps upside: price beta to MSTR is ~0.62x</p>
        <p>• Weekly dividends add ~22pp annualized — total return beta lifts to ~0.71x</p>
        <p>• Reinvesting dividends accelerates compounding significantly vs price-only</p>
      </div>
    </Card>
  );
}

// ── STRC ATM Program panel ────────────────────────────────────────────────────
function STRCATMPanel({ params, onParamsChange }) {
  const prog = STRC_ATM_PROGRAM;
  const [captureRate, setCaptureRate] = useState(prog.avg_capture_pct);
  const [issuanceRate, setIssuanceRate] = useState(prog.avg_daily_volume_M);

  // Reflexive calculation: adjust issuance rate → projected BTC impact
  const dailyProceeds = issuanceRate * (captureRate / 100);
  const dailyBtcImpact = params.btc_price > 0 ? (dailyProceeds * 1e6) / params.btc_price : 0;
  const quarterlyBtcImpact = dailyBtcImpact * 63; // ~63 trading days/quarter
  const remainingCapacity = prog.strc_remaining_M;
  const pctUsed = ((prog.strc_issued_to_date_M / prog.strc_total_capacity_M) * 100).toFixed(1);

  // Show reflexive mNAV impact
  const addedHoldings = quarterlyBtcImpact;
  const newBtcHoldings = params.mstr_btc_holdings + addedHoldings;
  const holdingsImpactPct = ((addedHoldings / params.mstr_btc_holdings) * 100).toFixed(2);

  return (
    <Card className="col-span-1 lg:col-span-2">
      <SectionHeader icon={Layers} title="STRC ATM Program — $21B Issuance Analytics" color="text-purple-400" />

      {/* Program overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
          <p className="text-[10px] text-muted-foreground">Total Program</p>
          <p className="text-base font-bold font-mono text-purple-400">$21B</p>
          <p className="text-[9px] text-muted-foreground">Mar 23, 2026</p>
        </div>
        <div className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
          <p className="text-[10px] text-muted-foreground">Issued to Date</p>
          <p className="text-base font-bold font-mono text-primary">${prog.strc_issued_to_date_M.toLocaleString()}M</p>
          <p className="text-[9px] text-muted-foreground">{pctUsed}% utilized</p>
        </div>
        <div className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
          <p className="text-[10px] text-muted-foreground">Remaining</p>
          <p className="text-base font-bold font-mono text-cyan-400">${remainingCapacity.toLocaleString()}M</p>
          <p className="text-[9px] text-muted-foreground">dry powder</p>
        </div>
        <div className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
          <p className="text-[10px] text-muted-foreground">Avg Capture %</p>
          <p className="text-base font-bold font-mono text-amber-400">{prog.avg_capture_pct}%</p>
          <p className="text-[9px] text-muted-foreground">of vol ≥ $100 par</p>
        </div>
      </div>

      {/* Interactive sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-secondary/40 rounded-lg border border-border space-y-3">
          <p className="text-xs font-semibold text-foreground">Reflexive Impact Simulator</p>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Label className="text-[10px] text-muted-foreground">Daily ATM Volume ($M)</Label>
              <span className="text-[10px] font-mono text-primary">${issuanceRate}M</span>
            </div>
            <Slider value={[issuanceRate]} onValueChange={([v]) => setIssuanceRate(v)} min={5} max={150} step={5} />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Label className="text-[10px] text-muted-foreground">Capture Rate (% of vol ≥ par)</Label>
              <span className="text-[10px] font-mono text-amber-400">{captureRate}%</span>
            </div>
            <Slider value={[captureRate]} onValueChange={([v]) => setCaptureRate(v)} min={10} max={100} step={5} />
          </div>
        </div>

        <div className="p-3 bg-secondary/40 rounded-lg border border-border space-y-2">
          <p className="text-xs font-semibold text-foreground">Projected Output</p>
          {[
            { label: "Daily Proceeds", value: `$${dailyProceeds.toFixed(1)}M` },
            { label: "Daily BTC Acquired", value: `~${Math.round(dailyBtcImpact).toLocaleString()} BTC` },
            { label: "Quarterly BTC Impact", value: `~${Math.round(quarterlyBtcImpact).toLocaleString()} BTC` },
            { label: "vs. Current Holdings", value: `+${holdingsImpactPct}%`, highlight: true },
          ].map((item) => (
            <div key={item.label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{item.label}</span>
              <span className={`font-mono font-bold ${item.highlight ? "text-primary" : "text-foreground"}`}>{item.value}</span>
            </div>
          ))}
          <div className="pt-1 border-t border-border">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">New BTC Holdings (est.)</span>
              <span className="font-mono font-bold text-cyan-400">{Math.round(newBtcHoldings).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity table */}
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Recent Daily Activity (Last 10 Trading Days)</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-3 font-medium">Date</th>
              <th className="text-right py-1.5 pr-3 font-medium">Price</th>
              <th className="text-right py-1.5 pr-3 font-medium">Volume ($M)</th>
              <th className="text-right py-1.5 pr-3 font-medium">% ≥ Par</th>
              <th className="text-right py-1.5 pr-3 font-medium">Cap%</th>
              <th className="text-right py-1.5 pr-3 font-medium">Proceeds</th>
              <th className="text-right py-1.5 font-medium">BTC est.</th>
            </tr>
          </thead>
          <tbody>
            {STRC_RECENT_ACTIVITY.map((row, i) => {
              const atPar = row.price >= 100;
              return (
                <tr key={row.date} className={`border-b border-border/30 ${atPar ? "bg-primary/5" : ""}`}>
                  <td className="py-1 pr-3 font-mono text-foreground">{row.date}</td>
                  <td className={`py-1 pr-3 text-right font-mono ${atPar ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    ${row.price.toFixed(2)}{atPar && " ✓"}
                  </td>
                  <td className="py-1 pr-3 text-right font-mono text-foreground">{row.volume_M.toFixed(1)}</td>
                  <td className={`py-1 pr-3 text-right font-mono ${row.pct_at_par > 0 ? "text-primary" : "text-muted-foreground"}`}>
                    {row.pct_at_par > 0 ? `${row.pct_at_par.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`py-1 pr-3 text-right font-mono ${row.capture_pct > 0 ? "text-amber-400" : "text-muted-foreground"}`}>
                    {row.capture_pct > 0 ? `${row.capture_pct}%` : "—"}
                  </td>
                  <td className={`py-1 pr-3 text-right font-mono ${row.proceeds_M > 0 ? "text-cyan-400" : "text-muted-foreground"}`}>
                    {row.proceeds_M > 0 ? `$${row.proceeds_M.toFixed(2)}M` : "—"}
                  </td>
                  <td className={`py-1 text-right font-mono ${row.btc_acquired > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                    {row.btc_acquired > 0 ? row.btc_acquired.toLocaleString() : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── STRC Par Stats panel ──────────────────────────────────────────────────────
function STRCParStatsPanel() {
  const s = STRC_PAR_STATS;

  const barData = [
    { label: "≥ Par", days: s.days_above_par, color: "#22C55E" },
    { label: "Within 1%", days: s.days_within_1pct, color: "#F59E0B" },
    { label: "Below 1%", days: s.days_below_1pct, color: "#EF4444" },
  ];

  return (
    <Card>
      <SectionHeader icon={Activity} title="STRC Par Trading Statistics" color="text-green-400" />

      <div className="grid grid-cols-3 gap-2 mb-4">
        {barData.map((b) => (
          <div key={b.label} className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
            <p className="text-[10px] text-muted-foreground">{b.label}</p>
            <p className="text-xl font-bold font-mono" style={{ color: b.color }}>{b.days}</p>
            <p className="text-[9px] text-muted-foreground">
              {((b.days / s.total_trading_days_observed) * 100).toFixed(0)}% of days
            </p>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
          <YAxis tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
          <Bar dataKey="days" radius={[3, 3, 0, 0]}>
            {barData.map((b, i) => <Cell key={i} fill={b.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 space-y-1.5 text-xs">
        {[
          { label: "Avg ex-div drawdown", value: `-${s.avg_exdiv_drop_pct}%`, color: "text-destructive" },
          { label: "Avg days to recover to par", value: `${s.avg_recovery_days} days`, color: "text-amber-400" },
          { label: "Recent recovery (last 4 wks)", value: `${s.recent_recovery_days} days ↑ faster`, color: "text-primary" },
          { label: "Fastest recovery observed", value: `${s.min_recovery_days} day`, color: "text-primary" },
          { label: "Slowest recovery observed", value: `${s.max_recovery_days} days`, color: "text-muted-foreground" },
        ].map((item) => (
          <div key={item.label} className="flex justify-between">
            <span className="text-muted-foreground">{item.label}</span>
            <span className={`font-mono font-semibold ${item.color}`}>{item.value}</span>
          </div>
        ))}
      </div>

      {s.recent_recovery_faster && (
        <div className="mt-3 p-2 rounded bg-primary/10 border border-primary/20 text-[10px] text-primary">
          📈 Market maturing: STRC recovering to par faster in recent weeks as more participants understand ex-div mechanics.
        </div>
      )}
    </Card>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function CorrelationsTab({ params, onParamsChange }) {
  const [activeSection, setActiveSection] = useState("correlations");
  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Back-Tested Correlations, ATM Analytics & CAGR Module</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Historical beta (BTC→MSTR, MSTY→MSTR), STRC $21B ATM simulator, CAGR back-testing, and user-editable CAGR assumptions driving projections.
            </p>
          </div>
        </div>
        {/* Sub-section toggle */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setActiveSection("correlations")}
            className={`text-xs px-3 py-1 rounded-lg border transition-colors ${activeSection === "correlations" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
          >
            Correlations & ATM
          </button>
          <button
            onClick={() => setActiveSection("cagr")}
            className={`text-xs px-3 py-1 rounded-lg border transition-colors ${activeSection === "cagr" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
          >
            CAGR Module
          </button>
        </div>
      </div>

      {activeSection === "correlations" && <>
        {/* Summary metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard title="MSTR Beta (1Y)" value="1.82x" subtitle="to BTC daily moves" icon={TrendingUp} accentClass="text-primary" />
          <MetricCard title="MSTR Beta (3Y)" value="2.11x" subtitle="to BTC daily moves" icon={TrendingUp} accentClass="text-cyan-400" />
          <MetricCard title="MSTY Beta (Div-Adj)" value="0.71x" subtitle="to MSTR total return" icon={BarChart3} accentClass="text-amber-400" />
          <MetricCard title="STRC ATM Capacity" value="$17.6B" subtitle="remaining dry powder" icon={Layers} accentClass="text-purple-400" />
        </div>

        {/* BTC/MSTR correlation + sensitivity side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BTCMSTRPanel />
          <SensitivityPanel />
        </div>

        {/* MSTY + STRC par stats side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MSTYMSTRPanel />
          <STRCParStatsPanel />
        </div>

        {/* Definitions accordion */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Correlation Definitions</h3>
          </div>
          <Accordion type="multiple" className="space-y-1">
            {Object.entries(CORRELATION_DEFINITIONS).map(([key, def]) => (
              <AccordionItem key={key} value={key} className="border border-border/50 rounded-lg px-3 overflow-hidden">
                <AccordionTrigger className="text-xs text-foreground font-medium py-2 hover:no-underline">
                  <span className="text-primary font-mono mr-2 uppercase">{key}</span>
                  <span className="text-muted-foreground font-normal">{def.short}</span>
                </AccordionTrigger>
                <AccordionContent>
                  <pre className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans pb-2">{def.full}</pre>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <p className="text-[10px] text-muted-foreground/40 text-center">
          Note: STRC ATM analytics have moved to the dedicated STRC tab.
        </p>
      </>}

      {activeSection === "cagr" && (
        <CAGRModule params={params} onParamsChange={onParamsChange} />
      )}

      <p className="text-[10px] text-muted-foreground/40 text-center pt-2">
        Back-test data through April 2026. Beta and correlation estimates based on daily log-return OLS regression. Not financial advice.
      </p>
    </div>
  );
}