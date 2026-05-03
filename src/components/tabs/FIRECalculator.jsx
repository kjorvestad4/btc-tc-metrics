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
 * Supports three phases:
 *   1. Pre-partial-retirement: full employment income, no withdrawals
 *   2. Partial retirement (if enabled): reduced salary, no portfolio withdrawals yet
 *   3. Full retirement: withdrawals begin, employment income = 0
 *
 * When portfolioProjections is provided, balance tracks actual projected values
 * (minus cumulative withdrawals) rather than a flat compound rate.
 */
function projectWithdrawals({ startBalance, strategy, swrPct, annualReturn, inflationRate, targetMonthlyIncome, currentAge, retirementAge, partialRetirementEnabled, partialSalaryPct, fullRetirementAge, employmentIncome, iraBalance, iraPct, method72t, interestRate72t, years = 30, portfolioProjections, annualDividendIncome = 0 }) {
  const rows = [];
  const startYear = new Date().getFullYear();
  const yearsToFull = Math.max(0, fullRetirementAge - currentAge);
  const yearsToPartial = partialRetirementEnabled
    ? Math.min(yearsToFull, Math.max(0, retirementAge - currentAge))
    : yearsToFull;

  const hasProjections = portfolioProjections && portfolioProjections.length > 0;

  const projGross = {};
  if (hasProjections) {
    portfolioProjections.forEach((row, idx) => { projGross[idx] = row.portfolio_value; });
  }

  // fixedSeppAmount is locked in at first year of full retirement (amortization/annuitization)
  let fixedSeppAmount = null;
  // swrBaseAmount locked at first retirement year balance
  let swrBaseAmount = null;

  let balance = startBalance;
  let cumulativeWithdrawals = 0;
  // Track IRA independently: grows at annualReturn, seeded from iraBalance param
  let trackingIra = iraBalance;

  for (let y = 0; y <= years; y++) {
    const isPrePartial  = y < yearsToPartial;
    const isPartial     = partialRetirementEnabled && y >= yearsToPartial && y < yearsToFull;
    const isFullRetired = !isPrePartial && !isPartial;

    const empIncome = isPrePartial
      ? employmentIncome * 12
      : isPartial
        ? employmentIncome * 12 * (partialSalaryPct / 100)
        : 0;

    if (y === 0) {
      rows.push({ year: startYear, balance, iraBalance: trackingIra, withdrawal: 0, employmentIncome: empIncome, investmentIncome: 0 });
      continue;
    }

    // Step 1: grow portfolio balance
    if (hasProjections) {
      let gross;
      if (projGross[y] != null) {
        gross = projGross[y];
      } else {
        const lastIdx = portfolioProjections.length - 1;
        gross = projGross[lastIdx] * Math.pow(1 + annualReturn / 100, y - lastIdx);
      }
      balance = Math.max(0, gross - cumulativeWithdrawals);
    } else {
      balance = balance * (1 + annualReturn / 100);
    }

    // Step 2: grow IRA independently (before withdrawal)
    trackingIra = trackingIra * (1 + annualReturn / 100);

    // Step 3: compute withdrawal using the independently-tracked IRA
    let withdrawal = 0;
    if (isFullRetired) {
      if (strategy === "swr") {
        // Lock in base withdrawal at first retirement year, then inflate
        if (swrBaseAmount === null) swrBaseAmount = balance * (swrPct / 100);
        const inflAdj = Math.pow(1 + inflationRate / 100, y - yearsToFull);
        withdrawal = swrBaseAmount * inflAdj;
      } else if (strategy === "rule_72t") {
        if (method72t === "rmd") {
          // RMD recalculates each year against current IRA
          withdrawal = calc72t({ balance: trackingIra, age: currentAge + y, method: "rmd", interestRate: interestRate72t / 100 });
        } else {
          // Fixed amortization/annuitization: lock in at first retirement year
          if (fixedSeppAmount === null) {
            fixedSeppAmount = calc72t({ balance: trackingIra, age: currentAge + y, method: method72t, interestRate: interestRate72t / 100 });
          }
          withdrawal = fixedSeppAmount;
        }
      } else if (strategy === "fixed_income") {
        // Inflate from the retirement start year, not from year 0
        const inflAdj = Math.pow(1 + inflationRate / 100, y - yearsToFull);
        withdrawal = targetMonthlyIncome * 12 * inflAdj;
      }
      // income_only: withdrawal stays 0
    }

    // Step 4: subtract withdrawal from portfolio and IRA
    if (withdrawal > 0) {
      cumulativeWithdrawals += withdrawal;
      balance = Math.max(0, balance - withdrawal);
      if (strategy === "rule_72t") {
        trackingIra = Math.max(0, trackingIra - withdrawal);
      }
    }

    // Investment income
    // income_only: project dividend income proportional to balance growth
    const projectedDividendIncome = startBalance > 0
      ? annualDividendIncome * (balance / startBalance)
      : annualDividendIncome;

    let investmentIncome = 0;
    if (isFullRetired) {
      investmentIncome = strategy === "income_only" ? projectedDividendIncome : withdrawal;
    } else if (isPartial) {
      investmentIncome = annualDividendIncome * ((isPartial ? balance / startBalance : 1));
    }

    rows.push({ year: startYear + y, balance, iraBalance: trackingIra, withdrawal, employmentIncome: empIncome, investmentIncome });
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

  // IRA mode for the Withdrawal Strategy section
  const [iraMode, setIraMode] = useState("independent");
  const [iraPct, setIraPct] = useState(50);
  const [iraYearIndex, setIraYearIndex] = useState(0); // index into portfolioProjections

  // FIRE inputs — stored as monthly internally, but displayed in selected unit
  const [targetMonthlyIncome, setTargetMonthlyIncome] = useState(10000);
  const [incomeInputMode, setIncomeInputMode] = useState("monthly"); // "monthly" | "annual"
  const [targetIncomeDisplay, setTargetIncomeDisplay] = useState("10000"); // raw string for input
  const [currentAge, setCurrentAge] = useState(45);
  const [retirementAge, setRetirementAge] = useState(55);       // partial retirement age
  const [partialRetirementEnabled, setPartialRetirementEnabled] = useState(false);
  const [partialSalaryPct, setPartialSalaryPct] = useState(50); // % of salary kept during partial
  const [fullRetirementAge, setFullRetirementAge] = useState(65); // full retirement age
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
  // Use a sensible default so the chart always shows meaningful data
  const effectivePortfolioValue = (mode === "portfolio" && portfolioValue > 0)
    ? portfolioValue
    : (portfolioValue > 0 ? portfolioValue : 500000);

  // Derived IRA balance from portfolio projections
  const portfolioYearRow = portfolioProjections?.[iraYearIndex];
  const portfolioDerivedIra = portfolioYearRow
    ? portfolioYearRow.portfolio_value * (iraPct / 100)
    : 0;

  // Distribution strategy
  const [strategy, setStrategy] = useState("swr");
  const [swrPct, setSwrPct] = useState(4);
  const [iraBalance, setIraBalance] = useState(500000);
  const effectiveIraBalance = iraMode === "portfolio" ? portfolioDerivedIra : iraBalance;
  const [method72t, setMethod72t] = useState("amortization");
  const [interestRate72t, setInterestRate72t] = useState(5);
  const [projYears, setProjYears] = useState(30);
  const [employmentIncome, setEmploymentIncome] = useState(8000); // always stored as monthly internally
  const [empIncomeInputMode, setEmpIncomeInputMode] = useState("monthly"); // "monthly" | "annual"
  const [empIncomeDisplay, setEmpIncomeDisplay] = useState("8000"); // raw string for input

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

  const startBalance = effectivePortfolioValue || 500000;

  // IRA balance at retirement start = portfolio value at fullRetirementAge × iraPct
  const retirementYearIdx = Math.max(0, fullRetirementAge - currentAge);
  const portfolioAtRetirement = useMemo(() => {
    // Use projection row directly if available (index = years from now to full retirement)
    if (portfolioProjections && portfolioProjections.length > 0) {
      const clampedIdx = Math.min(retirementYearIdx, portfolioProjections.length - 1);
      return portfolioProjections[clampedIdx].portfolio_value;
    }
    // Independent mode: compound startBalance forward
    const rate = (mode === "portfolio" && portfolioCagr != null ? portfolioCagr : manualReturn) / 100;
    return startBalance * Math.pow(1 + rate, retirementYearIdx);
  }, [portfolioProjections, retirementYearIdx, startBalance, mode, portfolioCagr, manualReturn]);

  // engineIraBalance: what's fed into SEPP calc and the projection engine
  // In portfolio mode: use the user-selected year row × iraPct (portfolioDerivedIra)
  // In independent mode: use manually entered iraBalance
  const engineIraBalance = iraMode === "portfolio"
    ? portfolioDerivedIra
    : iraBalance;

  // Age at the selected IRA year (for portfolio mode) or age at full retirement (for independent mode)
  const seppAge = iraMode === "portfolio"
    ? Math.min(currentAge + iraYearIndex, 84)
    : Math.min(fullRetirementAge, 84);

  // 72(t) SEPP comparison table
  const sepp72t = useMemo(() => {
    return RULE_72T_METHODS.map(m => ({
      ...m,
      annual: calc72t({ balance: engineIraBalance, age: seppAge, method: m.id, interestRate: interestRate72t / 100 }),
    }));
  }, [engineIraBalance, seppAge, interestRate72t, iraBalance, iraMode, iraPct, portfolioDerivedIra, iraYearIndex]);

  const withdrawalRows = useMemo(() => projectWithdrawals({
    startBalance,
    strategy,
    swrPct,
    annualReturn,
    inflationRate,
    targetMonthlyIncome,
    currentAge,
    retirementAge,
    partialRetirementEnabled,
    partialSalaryPct,
    fullRetirementAge,
    employmentIncome,
    iraBalance: engineIraBalance,
    iraPct,
    method72t,
    interestRate72t,
    years: projYears,
    portfolioProjections: mode === "portfolio" ? portfolioProjections : null,
    annualDividendIncome: portfolioMonthlyIncome * 12,
  }), [startBalance, strategy, swrPct, annualReturn, inflationRate, targetMonthlyIncome, currentAge, retirementAge, partialRetirementEnabled, partialSalaryPct, fullRetirementAge, employmentIncome, engineIraBalance, iraPct, method72t, interestRate72t, projYears, portfolioProjections, portfolioMonthlyIncome, mode, iraBalance, iraMode, portfolioAtRetirement]);

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
            {/* Target Income */}
            <div>
              <div className="flex items-center justify-between mb-1">
               <Label className="text-xs text-muted-foreground">Target Retirement Income</Label>
               <div className="flex gap-0.5">
                 {["monthly", "annual"].map(m => (
                   <button key={m} onClick={() => {
                     setIncomeInputMode(m);
                     // Convert display value to new unit
                     const stored = targetMonthlyIncome;
                     setTargetIncomeDisplay(m === "monthly" ? String(stored) : String(stored * 12));
                   }}
                     className={`text-[9px] px-2 py-0.5 rounded border font-semibold capitalize transition-colors ${
                       incomeInputMode === m ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground hover:bg-secondary"
                     }`}>{m}</button>
                 ))}
               </div>
              </div>
              <div className="flex items-center gap-2">
               <span className="text-muted-foreground text-sm">$</span>
               <Input
                type="number"
                value={targetIncomeDisplay}
                onChange={e => {
                  setTargetIncomeDisplay(e.target.value);
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= 0) {
                    setTargetMonthlyIncome(incomeInputMode === "monthly" ? v : v / 12);
                  }
                }}
                className="h-8 text-sm font-mono bg-secondary border-border"
                min={0}
               />
               <span className="text-[10px] text-muted-foreground">{incomeInputMode === "monthly" ? "/mo" : "/yr"}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {incomeInputMode === "monthly"
                  ? <>Annual: <span className="text-foreground font-mono font-semibold">{formatCurrency(targetMonthlyIncome * 12)}</span></>
                  : <>Monthly: <span className="text-foreground font-mono font-semibold">{formatCurrency(targetMonthlyIncome, 0)}/mo</span></>}
              </p>
            </div>

            {/* Current Employment Income */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-muted-foreground">Current Employment Income</Label>
                <div className="flex gap-0.5">
                  {["monthly", "annual"].map(m => (
                    <button key={m} onClick={() => {
                      setEmpIncomeInputMode(m);
                      setEmpIncomeDisplay(m === "monthly" ? String(employmentIncome) : String(employmentIncome * 12));
                    }}
                      className={`text-[9px] px-2 py-0.5 rounded border font-semibold capitalize transition-colors ${
                        empIncomeInputMode === m ? "bg-blue-500/20 border-blue-500 text-blue-400" : "border-border text-muted-foreground hover:bg-secondary"
                      }`}>{m}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <span className="text-muted-foreground text-sm">$</span>
                 <Input
                  type="number"
                  value={empIncomeDisplay}
                  onChange={e => {
                    setEmpIncomeDisplay(e.target.value);
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v >= 0) {
                      setEmploymentIncome(empIncomeInputMode === "monthly" ? v : v / 12);
                    }
                  }}
                  className="h-8 text-sm font-mono bg-secondary border-border"
                  min={0}
                 />
                 <span className="text-[10px] text-muted-foreground">{empIncomeInputMode === "monthly" ? "/mo" : "/yr"}</span>
              </div>
            </div>

            {/* Current Age */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Current Age</Label>
                <Input type="number" value={currentAge} onChange={e => setCurrentAge(parseInt(e.target.value) || 45)}
                  className="h-8 text-sm font-mono bg-secondary border-border mt-1" min={18} max={90} />
              </div>
              <div />
            </div>

            {/* Retirement phases */}
            <div className="p-3 bg-secondary/40 rounded-xl border border-border space-y-3">
              {/* Partial Retirement toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground">Partial Retirement</p>
                  <p className="text-[10px] text-muted-foreground">Reduce salary before full retirement</p>
                </div>
                <button onClick={() => setPartialRetirementEnabled(v => !v)}
                  className={`px-3 py-1 text-xs rounded-lg border font-semibold transition-colors ${
                    partialRetirementEnabled ? "bg-amber-500/20 border-amber-500 text-amber-400" : "border-border text-muted-foreground hover:bg-secondary"
                  }`}>
                  {partialRetirementEnabled ? "ON" : "OFF"}
                </button>
              </div>

              {partialRetirementEnabled && (
                <div className="space-y-2 pl-1 border-l-2 border-amber-500/30">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Partial Retirement Age</Label>
                      <Input type="number" value={retirementAge}
                        onChange={e => setRetirementAge(Math.min(parseInt(e.target.value) || 55, fullRetirementAge))}
                        className="h-7 text-xs font-mono bg-card border-border mt-1" min={currentAge} max={fullRetirementAge} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">% Salary Kept</Label>
                      <Input type="number" value={partialSalaryPct}
                        onChange={e => setPartialSalaryPct(Math.min(100, Math.max(0, parseInt(e.target.value) || 50)))}
                        className="h-7 text-xs font-mono bg-card border-border mt-1" min={0} max={100} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[10, 25, 50, 75].map(p => (
                      <button key={p} onClick={() => setPartialSalaryPct(p)}
                        className={`text-[10px] px-2 py-0.5 rounded border font-semibold transition-colors ${
                          partialSalaryPct === p ? "bg-amber-500/20 border-amber-500 text-amber-400" : "border-border text-muted-foreground hover:bg-secondary"
                        }`}>{p}%</button>
                    ))}
                  </div>
                  <p className="text-[10px] text-amber-400/80">
                    Partial income: <span className="font-mono font-bold">{formatCurrency(employmentIncome * (partialSalaryPct / 100), 0)}/mo</span>
                    <span className="text-muted-foreground ml-1">({formatCurrency(employmentIncome * (partialSalaryPct / 100) * 12, 0)}/yr)</span>
                  </p>
                </div>
              )}

              {/* Full Retirement */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">Full Retirement Age</Label>
                  <span className="text-[10px] text-muted-foreground">
                    Year <span className="text-primary font-mono font-bold">{new Date().getFullYear() + Math.max(0, fullRetirementAge - currentAge)}</span>
                  </span>
                </div>
                <Input type="number" value={fullRetirementAge}
                  onChange={e => setFullRetirementAge(Math.max(partialRetirementEnabled ? retirementAge : currentAge, parseInt(e.target.value) || 65))}
                  className="h-7 text-xs font-mono bg-card border-border" min={currentAge} max={90} />
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: "+10 yrs", val: currentAge + 10 },
                    { label: "+20 yrs", val: currentAge + 20 },
                    { label: "Age 55",  val: 55 },
                    { label: "Age 60",  val: 60 },
                    { label: "Age 65",  val: 65 },
                    { label: "Age 67",  val: 67 },
                  ].map(b => (
                    <button key={b.label} onClick={() => setFullRetirementAge(Math.max(partialRetirementEnabled ? retirementAge : currentAge, b.val))}
                      className={`text-[10px] px-2 py-0.5 rounded border font-semibold transition-colors ${
                        fullRetirementAge === Math.max(partialRetirementEnabled ? retirementAge : currentAge, b.val)
                          ? "bg-primary/20 border-primary text-primary"
                          : "border-border text-muted-foreground hover:bg-secondary"
                      }`}>{b.label}</button>
                  ))}
                </div>
              </div>

              {/* If partial retirement is OFF, show a simple "first retirement date" row */}
              {!partialRetirementEnabled && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Early / Partial Retirement Age (optional)</Label>
                  <Input type="number" value={retirementAge}
                    onChange={e => setRetirementAge(Math.min(parseInt(e.target.value) || 55, fullRetirementAge))}
                    className="h-7 text-xs font-mono bg-card border-border" min={currentAge} max={fullRetirementAge} />
                  <p className="text-[10px] text-muted-foreground">Set equal to Full Retirement Age to skip partial phase</p>
                </div>
              )}
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
        <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Withdrawal Strategy Modeling</h3>
          </div>
          {/* IRA Mode toggle — only relevant for 72(t) */}
          <div className="flex gap-1.5 items-center">
            <span className="text-[10px] text-muted-foreground">IRA Balance:</span>
            {[
              { id: "independent", label: "Independent" },
              { id: "portfolio",   label: "Portfolio Model" },
            ].map(m => (
              <button key={m.id} onClick={() => setIraMode(m.id)}
                className={`text-xs px-3 py-1 rounded-lg border font-semibold transition-colors ${
                  iraMode === m.id
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mb-4">
          Model how different distribution strategies affect your portfolio over time. Includes Rule 72(t) / SEPP for early IRA access without penalty.
          {iraMode === "portfolio" && <span className="text-cyan-400 ml-1">IRA balance is derived from your Portfolio Valuation above.</span>}
        </p>

        {/* Strategy income summary — year 1 retirement income across all strategies */}
        {(() => {
          // Use whichever retirement comes first
          const firstRetireAge = partialRetirementEnabled
            ? Math.min(retirementAge, fullRetirementAge)
            : fullRetirementAge;
          const yearsToFirst = Math.max(0, firstRetireAge - currentAge);
          const retireYear = new Date().getFullYear() + yearsToFirst;

          // Balance at first retirement start (projected)
          const balanceAtRetirement = (() => {
            if (portfolioProjections && portfolioProjections.length > 0) {
              const clampedIdx = Math.min(yearsToFirst, portfolioProjections.length - 1);
              return portfolioProjections[clampedIdx].portfolio_value;
            }
            return startBalance * Math.pow(1 + annualReturn / 100, yearsToFirst);
          })();

          // SWR: % of projected balance at retirement
          const swrAnnual = balanceAtRetirement * (swrPct / 100);

          // Income Only: project dividend income proportional to portfolio growth at retirement
          const incomeOnlyAnnual = startBalance > 0
            ? portfolioMonthlyIncome * 12 * (balanceAtRetirement / startBalance)
            : portfolioMonthlyIncome * 12;

          // Fixed Draw: the target amount in today's dollars (year-1 retirement = no inflation adjustment yet)
          const fixedAnnual = targetMonthlyIncome * 12;

          // 72(t): use engineIraBalance + age at first retirement
          const sepp72tAge = iraMode === "portfolio"
            ? Math.min(currentAge + iraYearIndex, 84)
            : Math.min(firstRetireAge, 84);
          const sepp72tAnnual = calc72t({ balance: engineIraBalance, age: sepp72tAge, method: method72t, interestRate: interestRate72t / 100 });

          const method72tLabel = RULE_72T_METHODS.find(m => m.id === method72t)?.label
            .replace("Fixed ", "").replace(" Method", "").replace("ization", "iz.");

          const retireLabel = partialRetirementEnabled && retirementAge < fullRetirementAge
            ? `Partial Retirement Age ${firstRetireAge}`
            : `Full Retirement Age ${firstRetireAge}`;

          return (
            <div className="mb-4 p-3 bg-secondary/20 rounded-xl border border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                Year-1 Retirement Income — {retireLabel} ({retireYear})
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { id: "swr",          label: `SWR ${swrPct}%`,        value: swrAnnual,        color: strategy === "swr"          ? "text-primary border-primary bg-primary/10"               : "text-muted-foreground border-border" },
                  { id: "income_only",  label: "Income Only",            value: incomeOnlyAnnual, color: strategy === "income_only"  ? "text-green-400 border-green-400/50 bg-green-400/10"     : "text-muted-foreground border-border" },
                  { id: "rule_72t",     label: `72(t) ${method72tLabel}`,value: sepp72tAnnual,    color: strategy === "rule_72t"     ? "text-cyan-400 border-cyan-400/50 bg-cyan-400/10"         : "text-muted-foreground border-border" },
                  { id: "fixed_income", label: "Fixed Draw",             value: fixedAnnual,      color: strategy === "fixed_income" ? "text-amber-400 border-amber-400/50 bg-amber-400/10"     : "text-muted-foreground border-border" },
                ].map(s => (
                  <button key={s.id} onClick={() => setStrategy(s.id)}
                    className={`text-center p-2.5 rounded-xl border transition-colors cursor-pointer ${s.color}`}>
                    <p className="text-[9px] opacity-80">{s.label}</p>
                    <p className="text-sm font-bold font-mono mt-0.5">{formatCurrency(s.value, 0)}/yr</p>
                    <p className="text-[9px] opacity-70">{formatCurrency(s.value / 12, 0)}/mo</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

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
              <div className="md:col-span-3 space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">IRA / Tax-Deferred Balance</Label>
                {iraMode === "independent" ? (
                  <Input type="number" value={iraBalance} onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setIraBalance(Math.max(0, v)); }}
                   className="h-7 text-xs font-mono bg-card border-border" />
                ) : (
                  <div className="space-y-2">
                    {/* Year selector */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-muted-foreground">Portfolio Year:</span>
                      {portfolioProjections?.map((row, idx) => (
                        <button key={idx} onClick={() => setIraYearIndex(idx)}
                          className={`text-[10px] px-2 py-0.5 rounded border font-mono font-semibold transition-colors ${
                            iraYearIndex === idx
                              ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                              : "border-border text-muted-foreground hover:bg-secondary"
                          }`}>
                          {row.year ?? `Y${idx}`}
                        </button>
                      ))}
                    </div>
                    {/* IRA % of total portfolio */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-[10px] text-muted-foreground">% of Total Portfolio in IRA/Tax-Deferred</span>
                        <span className="text-[10px] font-mono text-cyan-400 font-bold">{iraPct}%</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[10, 25, 50, 75, 90, 100].map(p => (
                          <button key={p} onClick={() => setIraPct(p)}
                            className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                              iraPct === p
                                ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                                : "border-border text-muted-foreground hover:bg-secondary"
                            }`}>
                            {p}%
                          </button>
                        ))}
                        <Input
                          type="number" value={iraPct}
                          onChange={e => setIraPct(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                          className="h-7 w-16 text-xs font-mono bg-card border-border"
                          min={0} max={100}
                        />
                      </div>
                      <div className="p-2 bg-cyan-400/10 border border-cyan-400/20 rounded-lg">
                        <p className="text-[10px] text-muted-foreground">
                          Total portfolio in <span className="text-cyan-400 font-mono font-bold">{portfolioYearRow?.year ?? "—"}</span>:
                          <span className="text-foreground font-mono font-bold ml-1">{formatCurrency(portfolioYearRow?.portfolio_value ?? 0)}</span>
                        </p>
                        <p className="text-xs font-bold font-mono text-cyan-400 mt-0.5">
                          IRA Balance = {formatCurrency(portfolioDerivedIra)}
                          <span className="text-[9px] text-muted-foreground ml-2">({iraPct}% of total)</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
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
                <Input type="number" value={targetMonthlyIncome} onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setTargetMonthlyIncome(Math.max(0, v)); }}
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

        {/* Chart 1: Portfolio & IRA Balance */}
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Portfolio Balance Over {projYears} Years</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${portfolioSurvives ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-destructive border-destructive/30 bg-destructive/10"}`}>
              {portfolioSurvives ? "✓ Portfolio survives" : "⚠ Portfolio depleted"}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={withdrawalRows} margin={{ top: 4, right: 16, bottom: 4, left: -10 }}>
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
              {retirementAge > currentAge && retirementAge < fullRetirementAge && (
                <ReferenceLine
                  x={new Date().getFullYear() + Math.max(0, retirementAge - currentAge)}
                  stroke="#F59E0B" strokeDasharray="4 2"
                  label={{ value: partialRetirementEnabled ? "Semi-Retire" : "Early Retire", fontSize: 8, fill: "#F59E0B", position: "top" }}
                />
              )}
              {fullRetirementAge > currentAge && (
                <ReferenceLine
                  x={new Date().getFullYear() + Math.max(0, fullRetirementAge - currentAge)}
                  stroke="#22C55E" strokeDasharray="4 2"
                  label={{ value: "Full Retire", fontSize: 8, fill: "#22C55E", position: "top" }}
                />
              )}
              <Line type="monotone" dataKey="balance" stroke="#22C55E" strokeWidth={2.5} name="Portfolio Balance" dot={false} />
              {(strategy === "rule_72t" || (iraMode === "portfolio" && iraPct > 0)) && (
                <Line type="monotone" dataKey="iraBalance" stroke="#8B5CF6" strokeWidth={1.5} name="IRA Balance" dot={false} strokeDasharray="4 2" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Income Flows */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Annual Income Flows</p>
            {(() => {
              const firstRetirementRow = withdrawalRows.find(r => r.investmentIncome > 0);
              if (!firstRetirementRow) return null;
              return (
                <div className="flex gap-3 text-[10px]">
                  <span className="text-muted-foreground">
                    Year-1 Withdrawal Income: <span className="text-amber-400 font-mono font-bold">{formatCurrency(firstRetirementRow.investmentIncome, 0)}/yr</span>
                    <span className="text-muted-foreground ml-1">({formatCurrency(firstRetirementRow.investmentIncome / 12, 0)}/mo)</span>
                  </span>
                </div>
              );
            })()}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={withdrawalRows} margin={{ top: 4, right: 16, bottom: 4, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="year" tick={TICK_STYLE} />
              <YAxis tick={TICK_STYLE} tickFormatter={v => formatCurrency(v)} />
              <Tooltip
                contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", fontSize: 11 }}
                formatter={(v, name) => [formatCurrency(v, 0), name]}
                labelFormatter={l => `Year ${l}`}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {retirementAge > currentAge && retirementAge < fullRetirementAge && (
                <ReferenceLine
                  x={new Date().getFullYear() + Math.max(0, retirementAge - currentAge)}
                  stroke="#F59E0B" strokeDasharray="4 2"
                />
              )}
              {fullRetirementAge > currentAge && (
                <ReferenceLine
                  x={new Date().getFullYear() + Math.max(0, fullRetirementAge - currentAge)}
                  stroke="#22C55E" strokeDasharray="4 2"
                />
              )}
              <Line type="monotone" dataKey="employmentIncome" stroke="#60A5FA" strokeWidth={2} name="Employment Income" dot={false} />
              <Line type="monotone" dataKey="investmentIncome" stroke="#F59E0B" strokeWidth={2} name="Investment/Withdrawal Income" dot={false} />
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