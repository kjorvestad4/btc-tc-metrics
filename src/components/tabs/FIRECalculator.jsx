import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/calculations";
import { Flame, Target, Shield, TrendingDown } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

const TICK_STYLE = { fontSize: 9, fill: "hsl(215 20% 55%)" };
const GRID_COLOR = "hsl(217 33% 17%)";

/**
 * Rule 72(t) — Substantially Equal Periodic Payments (SEPP)
 * Three IRS-approved methods:
 *   1. Required Minimum Distribution (RMD) — amount changes each year
 *   2. Fixed Amortization — fixed amount based on life expectancy
 *   3. Fixed Annuitization — fixed amount using annuity factor
 */
function calc72t({ balance, age, method, interestRate = 0.05 }) {
  const lifeExpectancy = Math.max(1, 85 - age); // simplified single life table

  if (method === "rmd") {
    // Annual amount changes: balance / remaining life expectancy each year
    return balance / lifeExpectancy;
  } else if (method === "amortization") {
    // Fixed amortization: balance / annuity factor
    const r = interestRate;
    const n = lifeExpectancy;
    const annuityFactor = r === 0 ? n : (1 - Math.pow(1 + r, -n)) / r;
    return balance / annuityFactor;
  } else if (method === "annuitization") {
    // Fixed annuitization using mortality table factor (~annuity factor × 1.05 typical)
    const r = interestRate;
    const n = lifeExpectancy;
    const annuityFactor = r === 0 ? n : (1 - Math.pow(1 + r, -n)) / r;
    return balance / (annuityFactor * 0.95); // slight adjustment for annuity factor
  }
  return 0;
}

/**
 * Project portfolio withdrawals over time, with selected distribution strategy.
 * Returns array of { year, balance, withdrawal, income }
 */
function projectWithdrawals({ startBalance, strategy, swrPct, annualReturn, inflationRate, targetMonthlyIncome, age, iraBalance, method72t, interestRate72t, years = 30 }) {
  const rows = [];
  let balance = startBalance;
  let iraBalanceRemaining = iraBalance;
  const startYear = new Date().getFullYear();

  for (let y = 0; y <= years; y++) {
    let withdrawal = 0;
    let sourceLabel = "";

    if (y === 0) {
      rows.push({ year: startYear + y, balance, iraBalance: iraBalanceRemaining, withdrawal: 0, income: targetMonthlyIncome * 12 });
      continue;
    }

    const inflAdj = Math.pow(1 + inflationRate / 100, y);

    if (strategy === "swr") {
      withdrawal = startBalance * (swrPct / 100) * inflAdj;
      sourceLabel = `${swrPct}% SWR`;
    } else if (strategy === "income_only") {
      // Live off dividends only — no principal touch
      withdrawal = 0;
    } else if (strategy === "rule_72t") {
      withdrawal = calc72t({ balance: iraBalanceRemaining, age: age + y, method: method72t, interestRate: interestRate72t / 100 });
      iraBalanceRemaining = Math.max(0, iraBalanceRemaining * (1 + annualReturn / 100) - withdrawal);
    } else if (strategy === "fixed_income") {
      withdrawal = targetMonthlyIncome * 12 * inflAdj;
    }

    balance = Math.max(0, balance * (1 + annualReturn / 100) - (strategy !== "rule_72t" ? withdrawal : 0));

    rows.push({
      year: startYear + y,
      balance,
      iraBalance: iraBalanceRemaining,
      withdrawal,
      income: strategy === "income_only" ? targetMonthlyIncome * 12 : withdrawal,
    });
  }
  return rows;
}

function Card({ children, className = "" }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

function SectionHeader({ icon: Icon, title, color = "text-primary" }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`w-4 h-4 ${color}`} />
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h3>
    </div>
  );
}

const DISTRIBUTION_STRATEGIES = [
  { id: "swr", label: "Safe Withdrawal Rate (SWR)", desc: "Classic 4% rule — sell assets each year to fund expenses" },
  { id: "income_only", label: "Income Only (Dividends)", desc: "Live off MSTY/preferred income — never touch principal" },
  { id: "rule_72t", label: "Rule 72(t) / SEPP", desc: "IRS-compliant early IRA withdrawals without 10% penalty" },
  { id: "fixed_income", label: "Fixed Monthly Draw", desc: "Withdraw a fixed inflation-adjusted amount each year" },
];

const RULE_72T_METHODS = [
  { id: "rmd", label: "RMD Method", desc: "Annual amount varies with balance and life expectancy" },
  { id: "amortization", label: "Fixed Amortization", desc: "Fixed annual amount (most common, highest payout)" },
  { id: "annuitization", label: "Fixed Annuitization", desc: "Uses annuity factor — typically slightly lower than amortization" },
];

export default function FIRECalculator({ portfolioValue, portfolioMonthlyIncome, portfolioProjections }) {
  // Mode: "independent" = manual inputs, "portfolio" = derived from holdings model
  const [mode, setMode] = useState("independent");

  // FIRE inputs
  const [targetMonthlyIncome, setTargetMonthlyIncome] = useState(10000);
  const [currentAge, setCurrentAge] = useState(45);
  const [retirementAge, setRetirementAge] = useState(55);
  const [manualReturn, setManualReturn] = useState(20);
  const [inflationRate, setInflationRate] = useState(3);

  // Derive CAGR from portfolioProjections when in portfolio mode
  const portfolioCagr = useMemo(() => {
    if (!portfolioProjections || portfolioProjections.length < 2) return null;
    const first = portfolioProjections[0]?.portfolio_value;
    const last  = portfolioProjections[portfolioProjections.length - 1]?.portfolio_value;
    if (!first || first <= 0 || !last) return null;
    const years = portfolioProjections.length - 1;
    return (Math.pow(last / first, 1 / years) - 1) * 100;
  }, [portfolioProjections]);

  const annualReturn = mode === "portfolio" && portfolioCagr != null ? portfolioCagr : manualReturn;
  const effectivePortfolioValue = mode === "portfolio" && portfolioValue > 0 ? portfolioValue : (mode === "independent" ? portfolioValue : 500000);

  // Distribution strategy
  const [strategy, setStrategy] = useState("income_only");
  const [swrPct, setSwrPct] = useState(4);
  const [iraBalance, setIraBalance] = useState(500000);
  const [method72t, setMethod72t] = useState("amortization");
  const [interestRate72t, setInterestRate72t] = useState(5);
  const [projYears, setProjYears] = useState(30);

  // FIRE number calculations
  const fireNumber = useMemo(() => ({
    swr4: (targetMonthlyIncome * 12) / 0.04,
    swr35: (targetMonthlyIncome * 12) / 0.035,
    swr3: (targetMonthlyIncome * 12) / 0.03,
    income_only: portfolioMonthlyIncome > 0 ? (effectivePortfolioValue * targetMonthlyIncome) / portfolioMonthlyIncome : 0,
  }), [targetMonthlyIncome, effectivePortfolioValue, portfolioMonthlyIncome]);

  const pctOfFireNumber = effectivePortfolioValue > 0 && fireNumber.swr4 > 0
    ? Math.min(100, (effectivePortfolioValue / fireNumber.swr4) * 100).toFixed(0)
    : 0;

  // Months to reach FIRE number at current growth rate
  const monthsToFire = useMemo(() => {
    if (effectivePortfolioValue >= fireNumber.swr4) return 0;
    if (annualReturn <= 0) return Infinity;
    const monthlyReturn = annualReturn / 100 / 12;
    const n = Math.log(fireNumber.swr4 / Math.max(1, effectivePortfolioValue)) / Math.log(1 + monthlyReturn);
    return Math.ceil(n);
  }, [effectivePortfolioValue, fireNumber.swr4, annualReturn]);

  const fireDate = useMemo(() => {
    if (monthsToFire === 0) return "Already FIRE!";
    if (!isFinite(monthsToFire)) return "—";
    const d = new Date();
    d.setMonth(d.getMonth() + monthsToFire);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }, [monthsToFire]);

  // 72(t) calculation
  const sepp72t = useMemo(() => {
    return RULE_72T_METHODS.map(m => ({
      ...m,
      annual: calc72t({ balance: iraBalance, age: currentAge, method: m.id, interestRate: interestRate72t / 100 }),
    }));
  }, [iraBalance, currentAge, interestRate72t]);

  // Withdrawal projection
  const withdrawalRows = useMemo(() => projectWithdrawals({
    startBalance: effectivePortfolioValue || 500000,
    strategy,
    swrPct,
    annualReturn,
    inflationRate,
    targetMonthlyIncome,
    age: currentAge,
    iraBalance,
    method72t,
    interestRate72t,
    years: projYears,
  }), [portfolioValue, strategy, swrPct, annualReturn, inflationRate, targetMonthlyIncome, currentAge, iraBalance, method72t, interestRate72t, projYears]);

  const portfolioSurvives = withdrawalRows[withdrawalRows.length - 1]?.balance > 0;

  return (
    <div className="space-y-4">
      {/* ── FIRE Number Dashboard ── */}
      <Card>
        <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">FIRE Number Calculator</h3>
          </div>
          {/* Mode toggle */}
          <div className="flex gap-1.5 items-center">
            <span className="text-[10px] text-muted-foreground">Mode:</span>
            {[
              { id: "independent", label: "Independent" },
              { id: "portfolio",   label: "Portfolio Model" },
            ].map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                className={`text-xs px-3 py-1 rounded-lg border font-semibold transition-colors ${
                  mode === m.id
                    ? "bg-primary/20 border-primary text-primary"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mb-4">
          {mode === "portfolio"
            ? `Portfolio mode: starting balance and expected return are derived from the Bitcoin24 model (${portfolioCagr != null ? portfolioCagr.toFixed(1) : "—"}% CAGR from your holdings above).`
            : "Independent mode: enter your own starting balance and expected return assumptions."}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Target Monthly Income</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  value={targetMonthlyIncome}
                  onChange={e => setTargetMonthlyIncome(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-8 text-sm font-mono bg-secondary border-border"
                  min={0}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Annual target: <span className="text-foreground font-mono font-semibold">{formatCurrency(targetMonthlyIncome * 12)}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Current Age</Label>
                <Input type="number" value={currentAge} onChange={e => setCurrentAge(parseInt(e.target.value) || 45)}
                  className="h-8 text-sm font-mono bg-secondary border-border mt-1" min={18} max={90} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Target Retirement Age</Label>
                <Input type="number" value={retirementAge} onChange={e => setRetirementAge(parseInt(e.target.value) || 55)}
                  className="h-8 text-sm font-mono bg-secondary border-border mt-1" min={18} max={90} />
              </div>
            </div>

            {mode === "independent" ? (
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">Expected Portfolio Return</Label>
                  <span className="text-[10px] font-mono text-primary">{manualReturn}%/yr</span>
                </div>
                <Slider value={[manualReturn]} onValueChange={([v]) => setManualReturn(v)} min={1} max={80} step={1} />
              </div>
            ) : (
              <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-[10px] text-muted-foreground">Expected Return (from model)</p>
                <p className="text-sm font-bold font-mono text-primary mt-0.5">
                  {portfolioCagr != null ? `${portfolioCagr.toFixed(1)}% CAGR` : "Enter holdings above"}
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Bitcoin24 {/* activePreset */} scenario · {portfolioProjections?.length ?? 0} year horizon</p>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label className="text-[10px] text-muted-foreground">Inflation Rate</Label>
                <span className="text-[10px] font-mono text-amber-400">{inflationRate}%/yr</span>
              </div>
              <Slider value={[inflationRate]} onValueChange={([v]) => setInflationRate(v)} min={0} max={10} step={0.5} />
            </div>
          </div>

          {/* FIRE number table */}
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">FIRE Numbers by Strategy</p>
            <div className="space-y-1.5">
              {[
                { label: "4% SWR (Classic FIRE)", value: fireNumber.swr4, color: "text-primary" },
                { label: "3.5% SWR (Conservative)", value: fireNumber.swr35, color: "text-amber-400" },
                { label: "3% SWR (Ultra-Safe)", value: fireNumber.swr3, color: "text-cyan-400" },
                { label: "Income Only (Current Yield)", value: fireNumber.income_only, color: "text-green-400" },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center p-2.5 bg-secondary/40 rounded-lg border border-border">
                  <span className="text-[10px] text-muted-foreground">{item.label}</span>
                  <span className={`font-mono font-bold text-sm ${item.color}`}>{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="p-3 bg-secondary/30 rounded-xl border border-border">
          <div className="flex justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground">Progress toward 4% SWR FIRE Number</span>
            <span className="text-[10px] font-mono font-bold text-primary">{pctOfFireNumber}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-3">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-primary to-green-400 transition-all"
              style={{ width: `${Math.min(100, pctOfFireNumber)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px]">
            <span className="text-muted-foreground">
              Current: <span className="text-foreground font-mono font-semibold">{formatCurrency(effectivePortfolioValue)}</span>
            </span>
            <span className="text-muted-foreground">
              Current monthly income: <span className="text-green-400 font-mono font-semibold">{formatCurrency(portfolioMonthlyIncome, 2)}/mo</span>
            </span>
            <span className="text-muted-foreground">
              FIRE date (est.): <span className="text-primary font-mono font-semibold">{fireDate}</span>
            </span>
          </div>
        </div>
      </Card>

      {/* ── Withdrawal Strategy ── */}
      <Card>
        <SectionHeader icon={TrendingDown} title="Withdrawal Strategy Modeling" color="text-cyan-400" />
        <p className="text-[10px] text-muted-foreground mb-4">
          Model how different distribution strategies affect your portfolio over time. Includes Rule 72(t) / SEPP for early IRA access without penalty.
        </p>

        {/* Strategy selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
          {DISTRIBUTION_STRATEGIES.map(s => (
            <button
              key={s.id}
              onClick={() => setStrategy(s.id)}
              className={`text-left p-3 rounded-xl border transition-colors ${
                strategy === s.id
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              <p className="text-xs font-semibold">{s.label}</p>
              <p className="text-[10px] mt-0.5 opacity-80">{s.desc}</p>
            </button>
          ))}
        </div>

        {/* Strategy-specific controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 p-3 bg-secondary/30 rounded-xl border border-border">
          {strategy === "swr" && (
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex justify-between">
                <Label className="text-[10px] text-muted-foreground">Withdrawal Rate</Label>
                <span className="text-[10px] font-mono text-primary">{swrPct}%</span>
              </div>
              <Slider value={[swrPct]} onValueChange={([v]) => setSwrPct(v)} min={1} max={8} step={0.25} />
              <p className="text-[9px] text-muted-foreground">
                Annual withdrawal: <span className="text-foreground font-mono">{formatCurrency((portfolioValue || 0) * swrPct / 100)}</span>
                {" "} → <span className="text-green-400 font-mono">{formatCurrency((portfolioValue || 0) * swrPct / 100 / 12, 2)}/mo</span>
              </p>
            </div>
          )}
          {strategy === "income_only" && (
            <div className="md:col-span-3 p-2 bg-green-400/10 border border-green-400/20 rounded-lg">
              <p className="text-xs text-green-400 font-semibold">Income-Only Strategy</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Your portfolio principal is never touched. Income comes solely from MSTY weekly dividends and preferred stock distributions.
                Current monthly income: <span className="text-green-400 font-mono font-bold">{formatCurrency(portfolioMonthlyIncome, 2)}/mo</span>.
                {portfolioMonthlyIncome < targetMonthlyIncome && (
                  <span className="text-amber-400"> Shortfall: {formatCurrency(targetMonthlyIncome - portfolioMonthlyIncome, 2)}/mo</span>
                )}
              </p>
            </div>
          )}
          {strategy === "rule_72t" && (
            <>
              <div>
                <Label className="text-[10px] text-muted-foreground">IRA / Tax-Deferred Balance</Label>
                <Input type="number" value={iraBalance} onChange={e => setIraBalance(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-7 text-xs font-mono bg-card border-border mt-1" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">120% AFR Rate (%)</Label>
                <Input type="number" value={interestRate72t} onChange={e => setInterestRate72t(Math.max(0, parseFloat(e.target.value) || 5))}
                  className="h-7 text-xs font-mono bg-card border-border mt-1" step={0.25} />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">SEPP Method</Label>
                <select
                  value={method72t}
                  onChange={e => setMethod72t(e.target.value)}
                  className="h-7 text-xs font-mono bg-card border border-border rounded-md px-2 mt-1 w-full text-foreground"
                >
                  {RULE_72T_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
            </>
          )}
          {strategy === "fixed_income" && (
            <div className="md:col-span-3 space-y-1">
              <Label className="text-[10px] text-muted-foreground">Monthly Draw Target</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input type="number" value={targetMonthlyIncome} onChange={e => setTargetMonthlyIncome(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-7 text-xs font-mono bg-card border-border" />
                <span className="text-[10px] text-muted-foreground">inflation-adjusted</span>
              </div>
            </div>
          )}

          {/* Shared: projection years */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Projection Years</Label>
            <Input type="number" value={projYears} onChange={e => setProjYears(Math.max(1, Math.min(50, parseInt(e.target.value) || 30)))}
              className="h-7 text-xs font-mono bg-card border-border mt-1" min={1} max={50} />
          </div>
        </div>

        {/* Rule 72(t) table — only show when selected */}
        {strategy === "rule_72t" && (
          <div className="mb-4 p-3 bg-secondary/30 rounded-xl border border-border">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-2">72(t) SEPP Comparison — All Three IRS Methods</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-1.5 pr-3 font-medium">Method</th>
                    <th className="text-right py-1.5 pr-3 font-medium">Annual</th>
                    <th className="text-right py-1.5 pr-3 font-medium">Monthly</th>
                    <th className="text-left py-1.5 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {sepp72t.map(m => (
                    <tr key={m.id} className={`border-b border-border/30 ${method72t === m.id ? "bg-primary/5" : ""}`}>
                      <td className="py-1.5 pr-3 font-semibold text-foreground">{m.label}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-primary">{formatCurrency(m.annual)}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-green-400">{formatCurrency(m.annual / 12, 2)}</td>
                      <td className="py-1.5 text-muted-foreground text-[10px]">{m.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 p-2 bg-amber-400/10 border border-amber-400/20 rounded-lg text-[10px] text-amber-400">
              ⚠ Rule 72(t) SEPP must continue for the longer of 5 years or until age 59½. Modifications trigger a 10% retroactive penalty + interest. Consult a tax advisor.
            </div>
          </div>
        )}

        {/* Projection chart */}
        <div>
          <div className="flex justify-between mb-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Portfolio Balance Over {projYears} Years</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${portfolioSurvives ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-destructive border-destructive/30 bg-destructive/10"}`}>
              {portfolioSurvives ? "✓ Portfolio survives" : "⚠ Portfolio depleted"}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={withdrawalRows} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="year" tick={TICK_STYLE} />
              <YAxis tick={TICK_STYLE} tickFormatter={v => formatCurrency(v)} />
              <Tooltip
                contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", fontSize: 11 }}
                formatter={(v, name) => [formatCurrency(v, 0), name]}
                labelFormatter={l => `Year ${l}`}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="4 2" />
              <Line type="monotone" dataKey="balance" stroke="#22C55E" strokeWidth={2.5} name="Portfolio Balance" dot={false} />
              {strategy === "rule_72t" && (
                <Line type="monotone" dataKey="iraBalance" stroke="#8B5CF6" strokeWidth={1.5} name="IRA Balance" dot={false} strokeDasharray="4 2" />
              )}
              <Line type="monotone" dataKey="income" stroke="#F59E0B" strokeWidth={1.5} name="Annual Income/Withdrawal" dot={false} strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Other distribution options reference */}
        <div className="mt-4 p-3 bg-secondary/30 rounded-xl border border-border">
          <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-2">Other Distribution Strategies (Reference)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-muted-foreground">
            {[
              { name: "Bucket Strategy", desc: "3 buckets: cash (1-2yr), bonds (3-7yr), growth (8+yr). Rebalance annually." },
              { name: "Guardrails (Guyton-Klinger)", desc: "Increase withdrawal 10% if portfolio beats plan; cut 10% if it falls behind." },
              { name: "RMD-Based (Age 73+)", desc: "IRS Required Minimum Distributions — mandatory from traditional IRA/401k." },
              { name: "Roth Conversion Ladder", desc: "Convert traditional IRA → Roth over 5yrs before retirement for tax-free access." },
              { name: "Social Security Bridge", desc: "Delay SS to 70 by drawing down taxable accounts first — maximizes lifetime benefit." },
              { name: "Floor + Upside", desc: "Use STRC/SATA income as guaranteed floor; BTC/MSTR for upside. Hybrid approach." },
            ].map(s => (
              <div key={s.name} className="p-2 bg-secondary/40 rounded-lg border border-border/50">
                <p className="font-semibold text-foreground">{s.name}</p>
                <p className="mt-0.5">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[9px] text-muted-foreground/50 text-center mt-3">
          Not tax or financial advice. Rule 72(t) calculations are simplified — consult a CPA or financial advisor before implementing SEPP.
        </p>
      </Card>
    </div>
  );
}