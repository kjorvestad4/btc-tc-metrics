import React, { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import MetricCard from "../dashboard/MetricCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  TrendingUp, Activity, Layers, BarChart3, Target, Zap, BookOpen, AlertTriangle
} from "lucide-react";
import { formatPercent } from "@/lib/calculations";
import {
  BTC_MSTR_CORRELATIONS, BTC_ASST_CORRELATIONS,
  BTC_SENSITIVITY, BTC_ASST_SENSITIVITY, BTC_MSTY_SENSITIVITY,
  BTC_MSTY_CORRELATIONS,
  generateScatterData,
  MSTY_MSTR_CORRELATION, STRC_ATM_PROGRAM, STRC_RECENT_ACTIVITY, STRC_PAR_STATS,
  SATA_PAR_STATS, SATA_ATM_PROGRAM, SATA_RECENT_ACTIVITY, PREFERRED_SHARPE_RATIOS, RISK_FREE_RATE,
  ALPHA_OVER_TIME, GAMMA_OVER_TIME, THETA_OVER_TIME,
} from "@/lib/correlationData";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell,
  LineChart, Line, Legend,
} from "recharts";

// ── Definitions ───────────────────────────────────────────────────────────────
const CORRELATION_DEFINITIONS = {
  beta: {
    short: "Beta — sensitivity of an asset's return to a 1% BTC move",
    full: `Beta measures the sensitivity of one asset's returns to another's. In this context:
• BTC→MSTR Beta = how many % MSTR moves for each 1% BTC moves
• A Beta of 1.82x means: if BTC rises 10%, MSTR historically rose ~18.2% on average

Beta is calculated via OLS (Ordinary Least Squares) regression of daily log-returns.
Beta ≠ guaranteed movement. It is an average historical relationship. In liquidity crunches, MSTR may move far more than beta predicts (downside asymmetry).

Important: Beta changes over time as MSTR's leverage, BTC holdings, and market dynamics evolve.`,
  },
  alpha: {
    short: "Alpha — annualized excess return above what beta alone would predict",
    full: `Alpha (α) is the intercept of the OLS regression line. It represents the return an asset earns independent of BTC market moves.

• Alpha > 0: the asset outperforms what its beta relationship to BTC would predict
• MSTR 1Y Alpha ≈ +12.4% annualized: MSTR earns ~12.4% extra return per year from its capital markets flywheel (premium expansion, accretive issuance, software revenue)
• ASST 1Y Alpha ≈ +6.2%: earlier stage, less capital markets machinery

Alpha = Avg Daily Return − Beta × Avg BTC Daily Return, annualized.
Alpha can be negative — if MSTR's premium compresses significantly in a BTC rally, alpha goes negative.
Alpha is NOT the same as "skill" here — it reflects structural advantages like the ATM machine and accretive issuance.`,
  },
  gamma: {
    short: "Gamma — convexity of beta; how much beta accelerates in large BTC moves",
    full: `Gamma (Γ) — borrowed from options theory — measures how much beta itself increases for each additional 1% BTC move.

• Gamma > 0: the asset's effective beta is higher in large moves than in small moves (convex payoff)
• MSTR Gamma ≈ 0.31 (1Y): for a 10% BTC move, MSTR's effective beta in that window is ~1.82 + 0.31 = ~2.13x
• Gamma explains why MSTR can outperform 2x levered BTC ETFs in strong bull runs

Gamma is estimated by running separate OLS regressions on large-move days (|BTC| > 3%) vs small-move days (|BTC| < 1%) and observing the change in beta.
High Gamma = more convexity = more leveraged upside in bull markets, but also more downside in crashes.`,
  },
  theta: {
    short: "Theta — annualized carry cost of maintaining the levered BTC position (% of BTC NAV)",
    full: `Theta (Θ) — again borrowed from options — represents the ongoing cost of maintaining leveraged BTC exposure.

For MSTR: Theta = Annual Interest + Annual Preferred Dividends, expressed as % of BTC NAV
For ASST: Theta = Annual SATA/Preferred Dividends ÷ BTC NAV

• MSTR Theta ~5.1% (YTD 2026): Strategy pays ~5.1% of its BTC NAV annually in financing costs
• ASST Theta ~14.6%: ASST's SATA preferred represents a higher relative carry cost vs its BTC reserve

Theta is the "time decay" — if BTC doesn't grow, these costs erode NAV over time.
This is why both companies are structurally LONG BTC: they need BTC appreciation > Theta to stay accretive.
BTC must grow faster than Theta or the leverage becomes destructive.`,
  },
  r2: {
    short: "R² — proportion of an asset's variance explained by BTC movements",
    full: `R² (R-squared) measures the goodness of fit of the beta regression. It ranges from 0 to 1 (0% to 100%).

• R² = 0.71 means 71% of MSTR's daily return variance is explained by BTC price movements
• The remaining 29% is idiosyncratic to MSTR (earnings news, leverage events, premium compression, etc.)

A higher R² means the beta relationship is more reliable. ASST has a slightly lower R² than MSTR (less trading history, smaller float), meaning more noise around the beta estimate.`,
  },
  correlation: {
    short: "Pearson correlation (r) — linear relationship strength between −1 and +1",
    full: `Pearson correlation (r) measures the direction and strength of the linear relationship between two return series.
• r = +1.0: perfect positive correlation (move in lockstep)
• r = 0.0: no correlation
• r = −1.0: perfect inverse correlation

r relates to R² by: R² = r²

MSTR vs BTC 1Y correlation ≈ 0.84: strong positive. When BTC rises, MSTR very reliably rises.`,
  },
  mstyBeta: {
    short: "MSTY beta to MSTR — covered call structure limits upside capture to ~0.62x price",
    full: `MSTY's covered call structure sells call options on MSTR, capping upside participation.
• Price beta to MSTR ≈ 0.62x: for every 10% MSTR rises, MSTY price rises ~6.2% (on average)
• When dividends are included (total return), the effective beta rises to ~0.71x

This means MSTY underperforms MSTR in strong bull markets but provides income compensation via weekly distributions.`,
  },
  sharpe: {
    short: "Sharpe Ratio (30D) — risk-adjusted return: (Effective Yield − Risk-Free Rate) ÷ 30D Historical Volatility",
    full: `A measure used to evaluate the risk-adjusted return of an investment by comparing its excess return over the risk-free rate to its standard deviation.

With respect to credit and preferred equity instruments:
  Sharpe (30D) = (Effective Yield − Risk-Free Rate) ÷ Historical Volatility (30D)

• Effective Yield = annual dividend ÷ current market price (current yield)
• Risk-Free Rate = 3-Month Treasury Bill rate (4.35% as of April 2026)
• Historical Volatility (30D) = annualized standard deviation of daily price returns over the past 30 trading days

Interpretation:
• Higher Sharpe = better income per unit of price risk taken
• SATA leads (~2.30) because it trades near par with very low 30D volatility (~3.8%)
• STRK has the lowest Sharpe because its yield is low relative to its price volatility
• Preferreds trading significantly below par carry high current yields but also elevated 30D vol — Sharpe captures this trade-off

Note: This Sharpe measures price risk only, NOT credit/default risk, BTC NAV coverage risk, or liquidity risk.`,
  },
  parTrading: {
    short: "Par trading — preferred stock price behavior relative to $100 face value",
    full: `Par ($100) is the liquidation preference — the amount preferred holders receive per share in a liquidation event.

• Trading above par: market is willing to pay a premium, usually because dividend yield is attractive vs alternatives
• Trading at par: fair value — yield equals market required yield
• Trading below par: market demands extra yield compensation (discount), often due to credit/BTC price concerns or ex-div mechanics

Ex-dividend mechanics:
When a preferred pays its dividend, the stock typically drops by approximately the dividend amount on the ex-date.
Recovery to pre-ex-div price depends on how quickly yield-hunters re-enter.

STRC typically drops ~2.8% on ex-div dates and recovers in ~3 days.
SATA drops ~1.1% (lower because smaller dividend per period) and recovers in ~1.4 days on average.`,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, color = "text-primary" }) {
  return (
    <div className="flex items-center gap-2 mb-3">
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

const TICK_STYLE = { fontSize: 9, fill: "hsl(215 20% 55%)" };
const GRID_COLOR = "hsl(217 33% 17%)";

// ── BTC → MSTR Correlation panel ─────────────────────────────────────────────
function BTCMSTRPanel() {
  const scatter = useMemo(() => generateScatterData(1.82), []);
  return (
    <Card>
      <SectionHeader icon={TrendingUp} title="BTC → MSTR Back-Tested Correlation" color="text-primary" />
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-2 font-medium">Period</th>
              <th className="text-right py-1.5 pr-2 font-medium">Beta</th>
              <th className="text-right py-1.5 pr-2 font-medium">Alpha</th>
              <th className="text-right py-1.5 pr-2 font-medium">Gamma</th>
              <th className="text-right py-1.5 pr-2 font-medium">R²</th>
              <th className="text-right py-1.5 font-medium">Corr</th>
            </tr>
          </thead>
          <tbody>
            {BTC_MSTR_CORRELATIONS.map((row) => (
              <tr key={row.period} className="border-b border-border/30 hover:bg-secondary/30">
                <td className="py-1.5 pr-2 font-semibold text-foreground">{row.period}</td>
                <td className="py-1.5 pr-2 text-right font-mono text-primary">{row.beta.toFixed(2)}x</td>
                <td className="py-1.5 pr-2 text-right font-mono text-green-400">+{row.alpha_ann.toFixed(1)}%</td>
                <td className="py-1.5 pr-2 text-right font-mono text-purple-400">{row.gamma.toFixed(2)}</td>
                <td className="py-1.5 pr-2 text-right font-mono text-cyan-400">{(row.r2 * 100).toFixed(0)}%</td>
                <td className="py-1.5 text-right font-mono text-amber-400">{row.corr.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground mb-2">Daily Return Scatter — 1Y (sampled 80 days)</p>
      <ResponsiveContainer width="100%" height={180}>
        <ScatterChart margin={{ top: 4, right: 8, bottom: 14, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis dataKey="btc" name="BTC %" type="number" domain={[-8, 8]}
            tickFormatter={(v) => `${v}%`} tick={TICK_STYLE}
            label={{ value: "BTC Daily %", position: "insideBottom", offset: -4, fontSize: 9, fill: "hsl(215 20% 55%)" }} />
          <YAxis dataKey="asset" name="MSTR %" type="number" domain={[-18, 18]}
            tickFormatter={(v) => `${v}%`} tick={TICK_STYLE} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
            if (!payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-popover border border-border rounded p-2 text-xs">
                <p>BTC: <span className="font-mono text-primary">{d.btc > 0 ? "+" : ""}{d.btc}%</span></p>
                <p>MSTR: <span className="font-mono text-amber-400">{d.asset > 0 ? "+" : ""}{d.asset}%</span></p>
              </div>
            );
          }} />
          <ReferenceLine x={0} stroke="hsl(217 33% 25%)" />
          <ReferenceLine y={0} stroke="hsl(217 33% 25%)" />
          <Scatter data={scatter} fill="#22C55E" opacity={0.6} r={3} />
        </ScatterChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ── BTC → ASST Correlation panel ─────────────────────────────────────────────
function BTCASSTPanal() {
  const scatter = useMemo(() => generateScatterData(1.48), []);
  return (
    <Card>
      <SectionHeader icon={TrendingUp} title="BTC → ASST Back-Tested Correlation" color="text-blue-400" />
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-2 font-medium">Period</th>
              <th className="text-right py-1.5 pr-2 font-medium">Beta</th>
              <th className="text-right py-1.5 pr-2 font-medium">Alpha</th>
              <th className="text-right py-1.5 pr-2 font-medium">Gamma</th>
              <th className="text-right py-1.5 pr-2 font-medium">R²</th>
              <th className="text-right py-1.5 font-medium">Corr</th>
            </tr>
          </thead>
          <tbody>
            {BTC_ASST_CORRELATIONS.map((row) => (
              <tr key={row.period} className="border-b border-border/30 hover:bg-secondary/30">
                <td className="py-1.5 pr-2 font-semibold text-foreground">{row.period}</td>
                <td className="py-1.5 pr-2 text-right font-mono text-blue-400">{row.beta.toFixed(2)}x</td>
                <td className="py-1.5 pr-2 text-right font-mono text-green-400">+{row.alpha_ann.toFixed(1)}%</td>
                <td className="py-1.5 pr-2 text-right font-mono text-purple-400">{row.gamma.toFixed(2)}</td>
                <td className="py-1.5 pr-2 text-right font-mono text-cyan-400">{(row.r2 * 100).toFixed(0)}%</td>
                <td className="py-1.5 text-right font-mono text-amber-400">{row.corr.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground mb-2">Daily Return Scatter — 1Y (sampled 80 days)</p>
      <ResponsiveContainer width="100%" height={180}>
        <ScatterChart margin={{ top: 4, right: 8, bottom: 14, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis dataKey="btc" name="BTC %" type="number" domain={[-8, 8]}
            tickFormatter={(v) => `${v}%`} tick={TICK_STYLE}
            label={{ value: "BTC Daily %", position: "insideBottom", offset: -4, fontSize: 9, fill: "hsl(215 20% 55%)" }} />
          <YAxis dataKey="asset" name="ASST %" type="number" domain={[-15, 15]}
            tickFormatter={(v) => `${v}%`} tick={TICK_STYLE} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
            if (!payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-popover border border-border rounded p-2 text-xs">
                <p>BTC: <span className="font-mono text-primary">{d.btc > 0 ? "+" : ""}{d.btc}%</span></p>
                <p>ASST: <span className="font-mono text-blue-400">{d.asset > 0 ? "+" : ""}{d.asset}%</span></p>
              </div>
            );
          }} />
          <ReferenceLine x={0} stroke="hsl(217 33% 25%)" />
          <ReferenceLine y={0} stroke="hsl(217 33% 25%)" />
          <Scatter data={scatter} fill="#60A5FA" opacity={0.6} r={3} />
        </ScatterChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ── MSTY correlation panel ────────────────────────────────────────────────────
function MSTYCorrelPanel() {
  const scatter = useMemo(() => generateScatterData(1.13), []);
  const c = MSTY_MSTR_CORRELATION;
  return (
    <Card>
      <SectionHeader icon={BarChart3} title="BTC → MSTY & MSTY ↔ MSTR Correlation" color="text-amber-400" />
      {/* BTC→MSTY table */}
      {/* MSTY↔MSTR beta boxes */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="p-2 bg-secondary/50 rounded-lg border border-border text-center">
          <p className="text-[10px] text-muted-foreground">MSTY Price Beta (MSTR)</p>
          <p className="text-lg font-bold font-mono text-amber-400">{c.price_beta}x</p>
          <p className="text-[9px] text-muted-foreground">R² = {(c.price_r2*100).toFixed(0)}%</p>
        </div>
        <div className="p-2 bg-secondary/50 rounded-lg border border-border text-center">
          <p className="text-[10px] text-muted-foreground">Div-Adjusted Beta (MSTR)</p>
          <p className="text-lg font-bold font-mono text-primary">{c.total_return_beta}x</p>
          <p className="text-[9px] text-muted-foreground">R² = {(c.total_return_r2*100).toFixed(0)}%</p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">BTC → MSTY (via MSTR chain) — Alpha / Gamma / Theta</p>
      <div className="overflow-x-auto mb-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-2 font-medium">Period</th>
              <th className="text-right py-1.5 pr-2 font-medium">β Price</th>
              <th className="text-right py-1.5 pr-2 font-medium">β Div-Adj</th>
              <th className="text-right py-1.5 pr-2 font-medium">Alpha</th>
              <th className="text-right py-1.5 pr-2 font-medium">Gamma</th>
              <th className="text-right py-1.5 font-medium">Theta</th>
            </tr>
          </thead>
          <tbody>
            {BTC_MSTY_CORRELATIONS.map((row) => (
              <tr key={row.period} className="border-b border-border/30 hover:bg-secondary/30">
                <td className="py-1.5 pr-2 font-semibold text-foreground">{row.period}</td>
                <td className="py-1.5 pr-2 text-right font-mono text-amber-400">{row.beta.toFixed(2)}x</td>
                <td className="py-1.5 pr-2 text-right font-mono text-amber-300">{row.beta_div_adj.toFixed(2)}x</td>
                <td className="py-1.5 pr-2 text-right font-mono text-green-400">+{row.alpha_ann.toFixed(1)}%</td>
                <td className="py-1.5 pr-2 text-right font-mono text-purple-400">{row.gamma.toFixed(2)}</td>
                <td className="py-1.5 text-right font-mono text-red-400">{row.theta.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground mb-2">Daily Return Scatter — 1Y MSTY vs BTC</p>
      <ResponsiveContainer width="100%" height={160}>
        <ScatterChart margin={{ top: 4, right: 8, bottom: 14, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis dataKey="btc" name="BTC %" type="number" domain={[-8, 8]}
            tickFormatter={(v) => `${v}%`} tick={TICK_STYLE}
            label={{ value: "BTC Daily %", position: "insideBottom", offset: -4, fontSize: 9, fill: "hsl(215 20% 55%)" }} />
          <YAxis dataKey="asset" name="MSTY %" type="number" domain={[-12, 12]}
            tickFormatter={(v) => `${v}%`} tick={TICK_STYLE} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
            if (!payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-popover border border-border rounded p-2 text-xs">
                <p>BTC: <span className="font-mono text-primary">{d.btc > 0 ? "+" : ""}{d.btc}%</span></p>
                <p>MSTY: <span className="font-mono text-amber-400">{d.asset > 0 ? "+" : ""}{d.asset}%</span></p>
              </div>
            );
          }} />
          <ReferenceLine x={0} stroke="hsl(217 33% 25%)" />
          <ReferenceLine y={0} stroke="hsl(217 33% 25%)" />
          <Scatter data={scatter} fill="#F59E0B" opacity={0.6} r={3} />
        </ScatterChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ── Sensitivity panels ────────────────────────────────────────────────────────
function MSTRSensitivityPanel() {
  return (
    <Card>
      <SectionHeader icon={Target} title="BTC Move → MSTR Sensitivity" color="text-cyan-400" />
      <p className="text-[10px] text-muted-foreground mb-3">Projected MSTR % move for a given BTC % move, by historical beta period.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-2 font-medium">BTC Δ</th>
              <th className="text-right py-1.5 pr-2 font-medium">MSTR (1Y β)</th>
              <th className="text-right py-1.5 pr-2 font-medium">MSTR (3Y β)</th>
              <th className="text-right py-1.5 font-medium">MSTR (5Y β)</th>
            </tr>
          </thead>
          <tbody>
            {BTC_SENSITIVITY.map((row) => {
              const isNeg = row.btc_move < 0;
              const isZero = row.btc_move === 0;
              return (
                <tr key={row.btc_move} className={`border-b border-border/30 ${isZero ? "bg-secondary/30" : ""}`}>
                  <td className={`py-1.5 pr-2 font-mono font-bold ${isNeg ? "text-destructive" : isZero ? "text-muted-foreground" : "text-primary"}`}>
                    {row.btc_move > 0 ? "+" : ""}{row.btc_move}%
                  </td>
                  <td className={`py-1.5 pr-2 text-right font-mono ${isNeg ? "text-destructive" : "text-primary"}`}>{row.mstr_1y > 0 ? "+" : ""}{row.mstr_1y.toFixed(1)}%</td>
                  <td className={`py-1.5 pr-2 text-right font-mono ${isNeg ? "text-destructive" : "text-cyan-400"}`}>{row.mstr_3y > 0 ? "+" : ""}{row.mstr_3y.toFixed(1)}%</td>
                  <td className={`py-1.5 text-right font-mono ${isNeg ? "text-destructive" : "text-amber-400"}`}>{row.mstr_5y > 0 ? "+" : ""}{row.mstr_5y.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-2">⚠ Back-tested averages. Downside can exceed beta in liquidity events.</p>
    </Card>
  );
}

function ASSTSensitivityPanel() {
  return (
    <Card>
      <SectionHeader icon={Target} title="BTC Move → ASST Sensitivity" color="text-blue-400" />
      <p className="text-[10px] text-muted-foreground mb-3">Projected ASST % move for a given BTC % move.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-2 font-medium">BTC Δ</th>
              <th className="text-right py-1.5 pr-2 font-medium">ASST (1Y β)</th>
              <th className="text-right py-1.5 font-medium">ASST (Since IPO)</th>
            </tr>
          </thead>
          <tbody>
            {BTC_ASST_SENSITIVITY.map((row) => {
              const isNeg = row.btc_move < 0;
              const isZero = row.btc_move === 0;
              return (
                <tr key={row.btc_move} className={`border-b border-border/30 ${isZero ? "bg-secondary/30" : ""}`}>
                  <td className={`py-1.5 pr-2 font-mono font-bold ${isNeg ? "text-destructive" : isZero ? "text-muted-foreground" : "text-primary"}`}>
                    {row.btc_move > 0 ? "+" : ""}{row.btc_move}%
                  </td>
                  <td className={`py-1.5 pr-2 text-right font-mono ${isNeg ? "text-destructive" : "text-blue-400"}`}>{row.asst_1y > 0 ? "+" : ""}{row.asst_1y.toFixed(1)}%</td>
                  <td className={`py-1.5 text-right font-mono ${isNeg ? "text-destructive" : "text-cyan-400"}`}>{row.asst_ipo > 0 ? "+" : ""}{row.asst_ipo.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-2">⚠ Limited trading history — ASST IPO was Sep 2025.</p>
    </Card>
  );
}

function MSTYSensitivityPanel() {
  return (
    <Card>
      <SectionHeader icon={Target} title="BTC Move → MSTY Sensitivity" color="text-amber-400" />
      <p className="text-[10px] text-muted-foreground mb-3">MSTY price-only vs total return (price + div) sensitivity to BTC moves.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-2 font-medium">BTC Δ</th>
              <th className="text-right py-1.5 pr-2 font-medium">MSTY Price</th>
              <th className="text-right py-1.5 font-medium">MSTY Total Return</th>
            </tr>
          </thead>
          <tbody>
            {BTC_MSTY_SENSITIVITY.map((row) => {
              const isNeg = row.btc_move < 0;
              const isZero = row.btc_move === 0;
              return (
                <tr key={row.btc_move} className={`border-b border-border/30 ${isZero ? "bg-secondary/30" : ""}`}>
                  <td className={`py-1.5 pr-2 font-mono font-bold ${isNeg ? "text-destructive" : isZero ? "text-muted-foreground" : "text-primary"}`}>
                    {row.btc_move > 0 ? "+" : ""}{row.btc_move}%
                  </td>
                  <td className={`py-1.5 pr-2 text-right font-mono ${isNeg ? "text-destructive" : "text-amber-400"}`}>{row.msty_price > 0 ? "+" : ""}{row.msty_price.toFixed(1)}%</td>
                  <td className={`py-1.5 text-right font-mono ${row.msty_total < 0 ? "text-destructive" : "text-green-400"}`}>{row.msty_total > 0 ? "+" : ""}{row.msty_total.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-2">Total return assumes ~22% annualized div yield adds positive carry regardless of BTC direction.</p>
    </Card>
  );
}

// ── Alpha / Gamma / Theta charts ──────────────────────────────────────────────
function GreeksChartsPanel() {
  return (
    <Card className="col-span-1 lg:col-span-2">
      <SectionHeader icon={Activity} title="Alpha, Gamma & Theta — Back-Tested Over Time" color="text-purple-400" />
      <p className="text-[10px] text-muted-foreground mb-4">Rolling quarterly estimates for MSTR and ASST. ASST data from Q1 2025 (IPO Sep 2025 — earlier quarters extrapolated).</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Alpha */}
        <div>
          <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-2">Alpha (Ann. Excess Return %)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={ALPHA_OVER_TIME} margin={{ top: 4, right: 8, bottom: 20, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: "hsl(215 20% 55%)" }} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={TICK_STYLE} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }}
                formatter={(v, n) => [`${v?.toFixed(1)}%`, n]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 9 }} />
              <Line type="monotone" dataKey="mstr" name="MSTR" stroke="#22C55E" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              <Line type="monotone" dataKey="asst" name="ASST" stroke="#60A5FA" strokeWidth={2} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Gamma */}
        <div>
          <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-2">Gamma (Beta Convexity)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={GAMMA_OVER_TIME} margin={{ top: 4, right: 8, bottom: 20, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: "hsl(215 20% 55%)" }} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={TICK_STYLE} domain={[0, 0.5]} />
              <Tooltip contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }}
                formatter={(v, n) => [v?.toFixed(2), n]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 9 }} />
              <Line type="monotone" dataKey="mstr" name="MSTR" stroke="#A855F7" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              <Line type="monotone" dataKey="asst" name="ASST" stroke="#60A5FA" strokeWidth={2} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Theta */}
        <div>
          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-2">Theta (Carry Cost % of BTC NAV)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={THETA_OVER_TIME} margin={{ top: 4, right: 8, bottom: 20, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: "hsl(215 20% 55%)" }} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={TICK_STYLE} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }}
                formatter={(v, n) => [`${v?.toFixed(1)}%`, n]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 9 }} />
              <Line type="monotone" dataKey="mstr" name="MSTR" stroke="#EF4444" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              <Line type="monotone" dataKey="asst" name="ASST" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

// ── Preferred Sharpe Ratios panel ─────────────────────────────────────────────
function PreferredSharpePanel({ liveData }) {
  // Rich data objects from strategy.com scraper (include price + vol_30d + current_yield)
  const liveDataMap = {
    STRC: liveData?.strc_data ?? null,
    STRF: liveData?.strf_data ?? null,
    STRK: liveData?.strk_data ?? null,
    STRD: liveData?.strd_data ?? null,
    // SATA only has price from Polygon
    SATA: liveData?.sata_price ? { price: liveData.sata_price } : null,
  };
  const hasLive = Object.values(liveDataMap).some((v) => v?.price != null);

  // Merge live data — use strategy.com vol_30d and current_yield when available
  const enriched = PREFERRED_SHARPE_RATIOS.map((p) => {
    const live = liveDataMap[p.ticker];
    const price = live?.price ?? p.price;
    const isLive = live?.price != null;
    const par_yield = p.yield_pct;
    // Use strategy.com effective yield if available, else compute from coupon / price
    const annual_coupon = p.par * (p.yield_pct / 100);
    const current_yield = live?.current_yield ?? parseFloat(((annual_coupon / price) * 100).toFixed(2));
    // Use strategy.com 30D vol if available, else fall back to static
    const vol_30d = live?.vol_30d ?? p.vol_30d;
    const sharpe = parseFloat(((current_yield - RISK_FREE_RATE) / vol_30d).toFixed(2));
    return { ...p, price, isLive, par_yield, current_yield, vol_30d, sharpe };
  });

  const barData = enriched.map((p) => ({ ...p, color: p.sharpe >= 1.5 ? "#22C55E" : p.sharpe >= 0.7 ? "#F59E0B" : "#EF4444" }));

  return (
    <Card className="col-span-1 lg:col-span-2">
      <div className="flex items-center justify-between mb-1">
        <SectionHeader icon={BarChart3} title="Preferred Stock Sharpe Ratios" color="text-cyan-400" />
        {hasLive && (
          <span className="text-[10px] bg-primary/15 text-primary border border-primary/25 rounded-full px-2 py-0.5 font-medium">
            Live prices (Polygon)
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mb-4">
        (Effective Yield − Risk-Free Rate) ÷ 30D Historical Volatility. Risk-free = 3M T-Bill (4.35%). Effective Yield = Annual Coupon ÷ Live Price.
        {!hasLive && <span className="text-amber-400"> — Add Polygon key &amp; Refresh to load live prices.</span>}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1.5 pr-2 font-medium">Ticker</th>
                <th className="text-right py-1.5 pr-2 font-medium">Price</th>
                <th className="text-right py-1.5 pr-2 font-medium">Par Yield</th>
                <th className="text-right py-1.5 pr-2 font-medium">Eff. Yield</th>
                <th className="text-right py-1.5 pr-2 font-medium">Vol (30D)</th>
                <th className="text-right py-1.5 font-medium">Sharpe</th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((p) => (
                <tr key={p.ticker} className="border-b border-border/30 hover:bg-secondary/30">
                  <td className="py-1.5 pr-2 font-mono font-bold text-primary">{p.ticker}</td>
                  <td className="py-1.5 pr-2 text-right font-mono">
                    <span className={p.isLive ? "text-cyan-400 font-semibold" : "text-foreground"}>
                      ${p.price.toFixed(2)}
                    </span>
                    {p.isLive && <span className="text-[8px] text-cyan-400/60 ml-0.5">●</span>}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-muted-foreground">{p.par_yield.toFixed(2)}%</td>
                  <td className="py-1.5 pr-2 text-right font-mono text-green-400">{p.current_yield.toFixed(2)}%</td>
                  <td className="py-1.5 pr-2 text-right font-mono text-muted-foreground">{p.vol_30d.toFixed(1)}%</td>
                  <td className={`py-1.5 text-right font-mono font-bold ${p.sharpe >= 1.5 ? "text-green-400" : p.sharpe >= 0.7 ? "text-amber-400" : "text-destructive"}`}>
                    {p.sharpe.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
            <XAxis type="number" tick={TICK_STYLE} domain={[0, 3]} />
            <YAxis dataKey="ticker" type="category" tick={{ fontSize: 10, fill: "hsl(215 20% 70%)" }} width={32} />
            <Tooltip contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }}
              formatter={(v) => [v.toFixed(2), "Sharpe"]} />
            <Bar dataKey="sharpe" radius={[0, 3, 3, 0]}>
              {barData.map((b, i) => <Cell key={i} fill={b.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ── STRC ATM Program panel ────────────────────────────────────────────────────
function STRCATMPanel({ params }) {
  const prog = STRC_ATM_PROGRAM;
  const [captureRate, setCaptureRate] = useState(prog.avg_capture_pct);
  const [issuanceRate, setIssuanceRate] = useState(prog.avg_daily_volume_M);
  const dailyProceeds = issuanceRate * (captureRate / 100);
  const dailyBtcImpact = params.btc_price > 0 ? (dailyProceeds * 1e6) / params.btc_price : 0;
  const quarterlyBtcImpact = dailyBtcImpact * 63;
  const newBtcHoldings = params.mstr_btc_holdings + quarterlyBtcImpact;
  const holdingsImpactPct = ((quarterlyBtcImpact / params.mstr_btc_holdings) * 100).toFixed(2);
  const pctUsed = ((prog.strc_issued_to_date_M / prog.strc_total_capacity_M) * 100).toFixed(1);

  return (
    <Card className="col-span-1 lg:col-span-2">
      <SectionHeader icon={Layers} title="STRC ATM Program — $21B Issuance Analytics" color="text-purple-400" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {[
          { label: "Total Program", value: "$21B", sub: "Mar 23, 2026", color: "text-purple-400" },
          { label: "Issued to Date", value: `$${prog.strc_issued_to_date_M.toLocaleString()}M`, sub: `${pctUsed}% utilized`, color: "text-primary" },
          { label: "Remaining", value: `$${prog.strc_remaining_M.toLocaleString()}M`, sub: "dry powder", color: "text-cyan-400" },
          { label: "Avg Capture %", value: `${prog.avg_capture_pct}%`, sub: "of vol ≥ $100 par", color: "text-amber-400" },
        ].map((item) => (
          <div key={item.label} className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
            <p className={`text-base font-bold font-mono ${item.color}`}>{item.value}</p>
            <p className="text-[9px] text-muted-foreground">{item.sub}</p>
          </div>
        ))}
      </div>
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
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Recent Daily Activity (Last 10 Trading Days)</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-2 font-medium">Date</th>
              <th className="text-right py-1.5 pr-2 font-medium">Price</th>
              <th className="text-right py-1.5 pr-2 font-medium">Vol ($M)</th>
              <th className="text-right py-1.5 pr-2 font-medium">% ≥ Par</th>
              <th className="text-right py-1.5 pr-2 font-medium">Cap%</th>
              <th className="text-right py-1.5 pr-2 font-medium">Proceeds</th>
              <th className="text-right py-1.5 font-medium">BTC</th>
            </tr>
          </thead>
          <tbody>
            {STRC_RECENT_ACTIVITY.map((row) => {
              const atPar = row.price >= 100;
              return (
                <tr key={row.date} className={`border-b border-border/30 ${atPar ? "bg-primary/5" : ""}`}>
                  <td className="py-1 pr-2 font-mono text-foreground">{row.date}</td>
                  <td className={`py-1 pr-2 text-right font-mono ${atPar ? "text-primary font-bold" : "text-muted-foreground"}`}>${row.price?.toFixed(2)}{atPar ? " ✓" : ""}</td>
                  <td className="py-1 pr-2 text-right font-mono text-foreground">{row.volume_M?.toFixed(1)}</td>
                  <td className={`py-1 pr-2 text-right font-mono ${row.pct_at_par > 0 ? "text-primary" : "text-muted-foreground"}`}>{row.pct_at_par > 0 ? `${row.pct_at_par.toFixed(1)}%` : "—"}</td>
                  <td className={`py-1 pr-2 text-right font-mono ${row.capture_pct > 0 ? "text-amber-400" : "text-muted-foreground"}`}>{row.capture_pct > 0 ? `${row.capture_pct}%` : "—"}</td>
                  <td className={`py-1 pr-2 text-right font-mono ${row.proceeds_M > 0 ? "text-cyan-400" : "text-muted-foreground"}`}>{row.proceeds_M > 0 ? `$${row.proceeds_M.toFixed(2)}M` : "—"}</td>
                  <td className={`py-1 text-right font-mono ${row.btc_acquired > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>{row.btc_acquired > 0 ? row.btc_acquired.toLocaleString() : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── SATA ATM Program panel ────────────────────────────────────────────────────
function SATAATMPanel({ params }) {
  const prog = SATA_ATM_PROGRAM;
  const [captureRate, setCaptureRate] = useState(prog.avg_capture_pct);
  const [issuanceRate, setIssuanceRate] = useState(prog.avg_daily_volume_M);
  const dailyProceeds = issuanceRate * (captureRate / 100);
  const dailyBtcImpact = params.btc_price > 0 ? (dailyProceeds * 1e6) / params.btc_price : 0;
  const quarterlyBtcImpact = dailyBtcImpact * 63;
  const sataUsedPct = ((prog.sata_issued_to_date_M / prog.sata_total_capacity_M) * 100).toFixed(1);
  const equityUsedPct = ((prog.equity_issued_to_date_M / prog.equity_atm_capacity_M) * 100).toFixed(1);

  return (
    <Card className="col-span-1 lg:col-span-2">
      <SectionHeader icon={Layers} title="SATA ATM Program — $500M Preferred + $250M Equity" color="text-violet-400" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {[
          { label: "SATA Capacity", value: "$500M", sub: `$${prog.sata_issued_to_date_M}M issued (${sataUsedPct}%)`, color: "text-violet-400" },
          { label: "SATA Remaining", value: `$${prog.sata_remaining_M.toFixed(0)}M`, sub: "dry powder", color: "text-cyan-400" },
          { label: "Equity ATM", value: "$250M", sub: `$${prog.equity_issued_to_date_M}M issued (${equityUsedPct}%)`, color: "text-blue-400" },
          { label: "SATA Div Rate", value: `${prog.dividend_rate}%`, sub: "variable rate", color: "text-amber-400" },
        ].map((item) => (
          <div key={item.label} className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
            <p className={`text-base font-bold font-mono ${item.color}`}>{item.value}</p>
            <p className="text-[9px] text-muted-foreground">{item.sub}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-secondary/40 rounded-lg border border-border space-y-3">
          <p className="text-xs font-semibold text-foreground">Reflexive Impact Simulator (SATA)</p>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Label className="text-[10px] text-muted-foreground">Daily SATA Volume ($M)</Label>
              <span className="text-[10px] font-mono text-violet-400">${issuanceRate.toFixed(1)}M</span>
            </div>
            <Slider value={[issuanceRate]} onValueChange={([v]) => setIssuanceRate(v)} min={1} max={30} step={0.5} />
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
          <p className="text-xs font-semibold text-foreground">Projected Output (ASST BTC Accumulation)</p>
          {[
            { label: "Daily Proceeds", value: `$${dailyProceeds.toFixed(2)}M` },
            { label: "Daily BTC Acquired", value: `~${Math.round(dailyBtcImpact)} BTC` },
            { label: "Quarterly BTC Impact", value: `~${Math.round(quarterlyBtcImpact).toLocaleString()} BTC`, highlight: true },
            { label: "Annual BTC Impact", value: `~${Math.round(quarterlyBtcImpact * 4).toLocaleString()} BTC`, highlight: true },
          ].map((item) => (
            <div key={item.label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{item.label}</span>
              <span className={`font-mono font-bold ${item.highlight ? "text-violet-400" : "text-foreground"}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Recent Daily SATA Activity (Last 10 Trading Days)</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-2 font-medium">Date</th>
              <th className="text-right py-1.5 pr-2 font-medium">Price</th>
              <th className="text-right py-1.5 pr-2 font-medium">Vol ($M)</th>
              <th className="text-right py-1.5 pr-2 font-medium">% ≥ Par</th>
              <th className="text-right py-1.5 pr-2 font-medium">Cap%</th>
              <th className="text-right py-1.5 pr-2 font-medium">Proceeds</th>
              <th className="text-right py-1.5 font-medium">BTC</th>
            </tr>
          </thead>
          <tbody>
            {SATA_RECENT_ACTIVITY.map((row) => {
              const atPar = row.price >= 100;
              return (
                <tr key={row.date} className={`border-b border-border/30 ${atPar ? "bg-violet-400/5" : ""}`}>
                  <td className="py-1 pr-2 font-mono text-foreground">{row.date}</td>
                  <td className={`py-1 pr-2 text-right font-mono ${atPar ? "text-violet-400 font-bold" : "text-muted-foreground"}`}>${row.price.toFixed(2)}{atPar ? " ✓" : ""}</td>
                  <td className="py-1 pr-2 text-right font-mono text-foreground">{row.volume_M.toFixed(1)}</td>
                  <td className={`py-1 pr-2 text-right font-mono ${row.pct_at_par > 0 ? "text-violet-400" : "text-muted-foreground"}`}>{row.pct_at_par > 0 ? `${row.pct_at_par.toFixed(1)}%` : "—"}</td>
                  <td className={`py-1 pr-2 text-right font-mono ${row.capture_pct > 0 ? "text-amber-400" : "text-muted-foreground"}`}>{row.capture_pct > 0 ? `${row.capture_pct}%` : "—"}</td>
                  <td className={`py-1 pr-2 text-right font-mono ${row.proceeds_M > 0 ? "text-cyan-400" : "text-muted-foreground"}`}>{row.proceeds_M > 0 ? `$${row.proceeds_M.toFixed(2)}M` : "—"}</td>
                  <td className={`py-1 text-right font-mono ${row.btc_acquired > 0 ? "text-violet-400 font-semibold" : "text-muted-foreground"}`}>{row.btc_acquired > 0 ? row.btc_acquired.toLocaleString() : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Par Stats helper ──────────────────────────────────────────────────────────
function ParStatsPanel({ title, color, stats }) {
  const s = stats;
  const barData = [
    { label: "≥ Par", days: s.days_above_par, color: "#22C55E" },
    { label: "Within 1%", days: s.days_within_1pct, color: "#F59E0B" },
    { label: "Below 1%", days: s.days_below_1pct, color: "#EF4444" },
  ];
  return (
    <Card>
      <SectionHeader icon={Activity} title={title} color={color} />
      <div className="grid grid-cols-3 gap-2 mb-3">
        {barData.map((b) => (
          <div key={b.label} className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
            <p className="text-[10px] text-muted-foreground">{b.label}</p>
            <p className="text-xl font-bold font-mono" style={{ color: b.color }}>{b.days}</p>
            <p className="text-[9px] text-muted-foreground">{((b.days / s.total_trading_days_observed) * 100).toFixed(0)}% of days</p>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
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
          { label: "Avg days to recover", value: `${s.avg_recovery_days} days`, color: "text-amber-400" },
          { label: "Recent recovery (last 4 wks)", value: `${s.recent_recovery_days} days`, color: "text-primary" },
          { label: "Fastest observed", value: `${s.min_recovery_days} day`, color: "text-primary" },
          { label: "Slowest observed", value: `${s.max_recovery_days} days`, color: "text-muted-foreground" },
        ].map((item) => (
          <div key={item.label} className="flex justify-between">
            <span className="text-muted-foreground">{item.label}</span>
            <span className={`font-mono font-semibold ${item.color}`}>{item.value}</span>
          </div>
        ))}
      </div>
      {s.note && (
        <div className="mt-3 p-2 rounded bg-secondary/50 border border-border text-[10px] text-muted-foreground">{s.note}</div>
      )}
      {s.recent_recovery_faster && (
        <div className="mt-2 p-2 rounded bg-primary/10 border border-primary/20 text-[10px] text-primary">
          📈 Market maturing: recovering to par faster in recent weeks.
        </div>
      )}
    </Card>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function CorrelationsTab({ params, liveData }) {

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Back-Tested Correlations, Greeks, Sharpe Ratios & ATM Analytics</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Beta, Alpha, Gamma, Theta for MSTR & ASST — plus MSTY correlations, sensitivity tables, preferred Sharpe ratios, par trading stats, and the STRC $21B ATM simulator.
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <span className="text-xs px-3 py-1 rounded-lg border bg-primary text-primary-foreground border-primary">
            Correlations & Analytics
          </span>
        </div>
      </div>

      {activeSection === "correlations" && <>

        {/* Summary metric cards — MSTR */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard title="MSTR Beta (1Y)" value="1.82x" subtitle="to BTC" icon={TrendingUp} accentClass="text-primary" />
          <MetricCard title="MSTR Alpha (1Y)" value="+12.4%" subtitle="ann. excess return" icon={Activity} accentClass="text-green-400" />
          <MetricCard title="MSTR Gamma (1Y)" value="0.31" subtitle="beta convexity" icon={Activity} accentClass="text-purple-400" />
          <MetricCard title="MSTR Theta" value="5.1%" subtitle="carry cost / BTC NAV" icon={AlertTriangle} accentClass="text-red-400" />
          <MetricCard title="STRC Sharpe" value={(() => { const p = PREFERRED_SHARPE_RATIOS.find(x => x.ticker === "STRC"); return p ? p.sharpe.toFixed(2) : "—"; })()} subtitle="risk-adj. yield" icon={BarChart3} accentClass="text-purple-400" />
          <MetricCard title="SATA Sharpe" value={(() => { const p = PREFERRED_SHARPE_RATIOS.find(x => x.ticker === "SATA"); return p ? p.sharpe.toFixed(2) : "—"; })()} subtitle="best risk-adj. yield" icon={BarChart3} accentClass="text-cyan-400" />
        </div>
        {/* Summary metric cards — ASST */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard title="ASST Beta (1Y)" value="1.48x" subtitle="to BTC" icon={TrendingUp} accentClass="text-blue-400" />
          <MetricCard title="ASST Alpha (1Y)" value="+6.2%" subtitle="ann. excess return" icon={Activity} accentClass="text-green-400" />
          <MetricCard title="ASST Gamma (1Y)" value="0.22" subtitle="beta convexity" icon={Activity} accentClass="text-purple-400" />
          <MetricCard title="ASST Theta" value="14.6%" subtitle="carry cost / BTC NAV" icon={AlertTriangle} accentClass="text-red-400" />
          <MetricCard title="MSTY Beta (Price)" value="0.62x" subtitle="to MSTR" icon={TrendingUp} accentClass="text-amber-400" />
          <MetricCard title="MSTY Beta (Div-Adj)" value="0.71x" subtitle="total return" icon={TrendingUp} accentClass="text-amber-300" />
        </div>
        {/* Summary metric cards — MSTY */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard title="MSTY Alpha (1Y)" value="+38.4%" subtitle="div-adj excess return" icon={Activity} accentClass="text-green-400" />
          <MetricCard title="MSTY Gamma (1Y)" value="0.14" subtitle="beta convexity" icon={Activity} accentClass="text-purple-400" />
          <MetricCard title="MSTY Theta" value="22.0%" subtitle="option decay drag / NAV" icon={AlertTriangle} accentClass="text-red-400" />
        </div>

        {/* BTC→MSTR and BTC→ASST */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BTCMSTRPanel />
          <BTCASSTPanal />
        </div>

        {/* MSTY + MSTR sensitivity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MSTYCorrelPanel />
          <MSTRSensitivityPanel />
        </div>

        {/* ASST + MSTY sensitivity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ASSTSensitivityPanel />
          <MSTYSensitivityPanel />
        </div>

        {/* Greeks charts — full width */}
        <div className="grid grid-cols-1 gap-4">
          <GreeksChartsPanel />
        </div>

        {/* Preferred Sharpe Ratios — full width */}
        <div className="grid grid-cols-1 gap-4">
          <PreferredSharpePanel liveData={liveData} />
        </div>

        {/* STRC ATM — full width */}
        <div className="grid grid-cols-1 gap-4">
          <STRCATMPanel params={params} />
        </div>

        {/* SATA ATM — full width */}
        <div className="grid grid-cols-1 gap-4">
          <SATAATMPanel params={params} />
        </div>

        {/* Par trading stats — STRC + SATA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ParStatsPanel title="STRC Par Trading Statistics" color="text-green-400" stats={STRC_PAR_STATS} />
          <ParStatsPanel title="SATA Par Trading Statistics" color="text-violet-400" stats={SATA_PAR_STATS} />
        </div>

        {/* Definitions */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Definitions</h3>
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
      </>}

      <p className="text-[10px] text-muted-foreground/40 text-center pt-2">
        Back-test data through April 2026. Beta/Alpha/Gamma/Theta estimates based on daily log-return OLS regression. Not financial advice.
      </p>
    </div>
  );
}