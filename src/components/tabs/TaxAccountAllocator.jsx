import React, { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/calculations";
import { Shield, DollarSign, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend, LineChart, Line,
} from "recharts";

const TICK_STYLE = { fontSize: 9, fill: "hsl(215 20% 55%)" };
const GRID_COLOR = "hsl(217 33% 17%)";

const ACCOUNT_TYPES = [
  {
    id: "taxable",
    label: "Taxable Brokerage",
    color: "#F59E0B",
    desc: "Long-term cap gains rate applies (0/15/20%). Dividends taxed as ordinary income (preferred) or qualified.",
    ltcg_rate: 15,
    div_rate: 22,
    grow_tax_free: false,
    withdraw_tax_free: false,
  },
  {
    id: "roth",
    label: "Roth IRA",
    color: "#22C55E",
    desc: "Contributions post-tax. Growth + qualified withdrawals 100% tax-free. No RMDs.",
    ltcg_rate: 0,
    div_rate: 0,
    grow_tax_free: true,
    withdraw_tax_free: true,
  },
  {
    id: "trad_ira",
    label: "Traditional IRA",
    color: "#60A5FA",
    desc: "Contributions pre-tax (deductible). Growth tax-deferred. Withdrawals taxed as ordinary income. RMDs at 73.",
    ltcg_rate: 0,
    div_rate: 0,
    grow_tax_free: true,
    withdraw_tax_free: false,
    withdrawal_tax: 24,
  },
  {
    id: "k401",
    label: "401(k) / 403(b)",
    color: "#A78BFA",
    desc: "Employer-sponsored pre-tax. Growth tax-deferred. Withdrawals at ordinary income rate. Often has employer match.",
    ltcg_rate: 0,
    div_rate: 0,
    grow_tax_free: true,
    withdraw_tax_free: false,
    withdrawal_tax: 24,
  },
  {
    id: "hsa",
    label: "HSA",
    color: "#34D399",
    desc: "Triple tax advantage: pre-tax contributions, tax-free growth, tax-free withdrawals for medical expenses. After 65 = traditional IRA.",
    ltcg_rate: 0,
    div_rate: 0,
    grow_tax_free: true,
    withdraw_tax_free: true,
  },
];

const ASSETS = ["BTC", "MSTR", "ASST", "STRC", "SATA", "STRF", "STRK", "STRD", "MSTY"];

// Best account placement rules (tax efficiency)
const TAX_EFFICIENCY_RULES = [
  { asset: "BTC",  best: "Roth IRA",          reason: "Highest growth potential — maximize tax-free compounding" },
  { asset: "MSTR", best: "Roth IRA",          reason: "High growth + volatility — best in tax-free wrapper" },
  { asset: "ASST", best: "Roth IRA / 401(k)", reason: "Growth equity — keep cap gains sheltered" },
  { asset: "STRC", best: "Traditional IRA",   reason: "High ordinary income — shelter from current-year tax" },
  { asset: "SATA", best: "Traditional IRA",   reason: "High ordinary income — shelter from current-year tax" },
  { asset: "STRF", best: "Traditional IRA / 401(k)", reason: "Fixed income — fully ordinary income, best sheltered" },
  { asset: "STRK", best: "Roth IRA",          reason: "Growth + convertible feature — prefer tax-free" },
  { asset: "STRD", best: "Roth IRA",          reason: "BTC-denominated — potential for high gains, tax-free best" },
  { asset: "MSTY", best: "Roth IRA",          reason: "Weekly ordinary income dividends — highest tax drag in taxable" },
];

function calcAfterTaxValue(grossValue, accountType, withdrawalTaxRate) {
  const acct = ACCOUNT_TYPES.find(a => a.id === accountType);
  if (!acct) return grossValue;
  if (acct.withdraw_tax_free) return grossValue;
  const rate = acct.withdrawal_tax ?? withdrawalTaxRate;
  return grossValue * (1 - rate / 100);
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

const STRATEGY_LABELS = {
  swr: "Safe Withdrawal Rate (SWR)",
  income_only: "Income Only (Dividends)",
  rule_72t: "Rule 72(t) / SEPP",
  fixed_income: "Fixed Monthly Draw",
};

const METHOD_72T_LABELS = {
  rmd: "RMD Method",
  amortization: "Fixed Amortization",
  annuitization: "Fixed Annuitization",
};

export default function TaxAccountAllocator({ portfolioHoldings, prices, fireState, portfolioMonthlyIncome, portfolioProjections }) {
  // Account balances per account type
  const [accountBalances, setAccountBalances] = useState({
    taxable: 0,
    roth: 0,
    trad_ira: 0,
    k401: 0,
    hsa: 0,
  });

  // Asset allocation per account type (% of each asset in each account)
  // Default: all assets in taxable
  const [assetAllocation, setAssetAllocation] = useState(
    Object.fromEntries(ASSETS.map(a => [a, { taxable: 100, roth: 0, trad_ira: 0, k401: 0, hsa: 0 }]))
  );

  // Sync growth rate from FIRE calculator when available
  const portfolioCagr = useMemo(() => {
    if (!portfolioProjections || portfolioProjections.length < 2) return null;
    const first = portfolioProjections[0]?.portfolio_value;
    const last  = portfolioProjections[portfolioProjections.length - 1]?.portfolio_value;
    if (!first || first <= 0 || !last) return null;
    const years = portfolioProjections.length - 1;
    return (Math.pow(last / first, 1 / years) - 1) * 100;
  }, [portfolioProjections]);

  // Marginal tax rates
  const [ordinaryTaxRate, setOrdinaryTaxRate] = useState(24);
  const [ltcgRate, setLtcgRate] = useState(15);
  const [stateRate, setStateRate] = useState(5);
  const [futureWithdrawalRate, setFutureWithdrawalRate] = useState(22);
  const [projGrowthRate, setProjGrowthRate] = useState(30);
  const [projYears, setProjYears] = useState(10);

  // Auto-sync portfolio CAGR from model
  useEffect(() => {
    if (portfolioCagr != null) setProjGrowthRate(parseFloat(portfolioCagr.toFixed(1)));
  }, [portfolioCagr]);

  // Auto-sync projection years from FIRE calculator
  useEffect(() => {
    if (fireState?.projYears) setProjYears(fireState.projYears);
  }, [fireState?.projYears]);

  const setAllocation = (asset, accountId, val) => {
    setAssetAllocation(prev => {
      const current = { ...prev[asset] };
      current[accountId] = val;
      // Normalize so sum = 100
      const total = Object.values(current).reduce((s, v) => s + v, 0);
      if (total > 100) {
        // Reduce others proportionally
        const excess = total - 100;
        const othersTotal = total - val;
        if (othersTotal > 0) {
          for (const k of Object.keys(current)) {
            if (k !== accountId) current[k] = Math.max(0, current[k] - (current[k] / othersTotal) * excess);
          }
        }
      }
      return { ...prev, [asset]: current };
    });
  };

  // Compute value per asset per account
  const allocationMatrix = useMemo(() => {
    const matrix = {};
    for (const asset of ASSETS) {
      const shares = portfolioHoldings?.[asset] ?? 0;
      const price = prices?.[asset] ?? 0;
      const totalVal = shares * price;
      matrix[asset] = {};
      for (const acct of ACCOUNT_TYPES) {
        matrix[asset][acct.id] = totalVal * (assetAllocation[asset]?.[acct.id] ?? 0) / 100;
      }
    }
    return matrix;
  }, [portfolioHoldings, prices, assetAllocation]);

  // Total per account
  const accountTotals = useMemo(() => {
    const totals = {};
    for (const acct of ACCOUNT_TYPES) {
      totals[acct.id] = ASSETS.reduce((s, a) => s + (allocationMatrix[a]?.[acct.id] ?? 0), 0);
    }
    return totals;
  }, [allocationMatrix]);

  const grandTotal = Object.values(accountTotals).reduce((s, v) => s + v, 0);

  // After-tax values
  const afterTaxTotals = useMemo(() => {
    const out = {};
    for (const acct of ACCOUNT_TYPES) {
      out[acct.id] = calcAfterTaxValue(accountTotals[acct.id], acct.id, futureWithdrawalRate);
    }
    return out;
  }, [accountTotals, futureWithdrawalRate]);

  const totalAfterTax = Object.values(afterTaxTotals).reduce((s, v) => s + v, 0);
  const taxDragPct = grandTotal > 0 ? ((grandTotal - totalAfterTax) / grandTotal * 100).toFixed(1) : 0;

  // Project growth per account type with tax efficiency differences
  const growthProjection = useMemo(() => {
    const rows = [];
    const currentYear = new Date().getFullYear();
    for (let y = 0; y <= projYears; y++) {
      const row = { year: currentYear + y };
      let totalGross = 0, totalAfterTaxVal = 0;
      for (const acct of ACCOUNT_TYPES) {
        const base = accountTotals[acct.id] || (accountBalances[acct.id] ?? 0);
        // Taxable accounts have annual tax drag on dividends and gains
        let effectiveRate = projGrowthRate / 100;
        if (!acct.grow_tax_free) {
          const annualTaxDrag = ((ordinaryTaxRate + stateRate) / 100) * 0.3; // ~30% of return is income
          effectiveRate = effectiveRate * (1 - annualTaxDrag);
        }
        const gross = base * Math.pow(1 + effectiveRate, y);
        const afterTax = calcAfterTaxValue(gross, acct.id, futureWithdrawalRate);
        row[acct.id + "_gross"] = gross;
        row[acct.id + "_net"] = afterTax;
        totalGross += gross;
        totalAfterTaxVal += afterTax;
      }
      row.total_gross = totalGross;
      row.total_net = totalAfterTaxVal;
      rows.push(row);
    }
    return rows;
  }, [accountTotals, accountBalances, projGrowthRate, projYears, ordinaryTaxRate, stateRate, futureWithdrawalRate]);

  const barData = ACCOUNT_TYPES.map(a => ({
    name: a.label.replace(" / ", "/"),
    gross: accountTotals[a.id],
    afterTax: afterTaxTotals[a.id],
    color: a.color,
  }));

  const hasAnyHoldings = grandTotal > 0;

  return (
    <Card>
      <SectionHeader icon={Shield} title="Tax Account Allocator" color="text-green-400" />
      <p className="text-[10px] text-muted-foreground mb-4">
        Assign your holdings across account types to model after-tax wealth. Your asset holdings from the Portfolio Calculator are used automatically.
        Allocate what % of each asset lives in each account type.
      </p>

      {!hasAnyHoldings && (
        <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg p-3 mb-4">
          ⚠ Enter your holdings in the Portfolio Calculator above to use the Tax Allocator.
        </p>
      )}

      {/* FIRE / Withdrawal Context — pulled from FIRE Calculator above */}
      {fireState && (
        <div className="mb-4 p-3 bg-secondary/30 rounded-xl border border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Withdrawal Strategy Context (from FIRE Calculator above)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="p-2 bg-secondary/50 rounded-lg border border-border text-center">
              <p className="text-[9px] text-muted-foreground">Strategy</p>
              <p className="text-xs font-bold text-primary">{STRATEGY_LABELS[fireState.strategy] ?? fireState.strategy}</p>
            </div>
            <div className="p-2 bg-secondary/50 rounded-lg border border-border text-center">
              <p className="text-[9px] text-muted-foreground">
                {fireState.strategy === "swr" ? "Withdrawal Rate" :
                 fireState.strategy === "rule_72t" ? "SEPP Method" :
                 fireState.strategy === "income_only" ? "Monthly Income" :
                 "Monthly Draw"}
              </p>
              <p className="text-xs font-bold text-cyan-400 font-mono">
                {fireState.strategy === "swr" ? `${fireState.swrPct}%` :
                 fireState.strategy === "rule_72t" ? METHOD_72T_LABELS[fireState.method72t] :
                 fireState.strategy === "income_only" ? formatCurrency(portfolioMonthlyIncome ?? 0, 0) + "/mo" :
                 formatCurrency(fireState.targetMonthlyIncome, 0) + "/mo"}
              </p>
            </div>
            <div className="p-2 bg-secondary/50 rounded-lg border border-border text-center">
              <p className="text-[9px] text-muted-foreground">Retirement Ages</p>
              <p className="text-xs font-bold text-amber-400 font-mono">
                {fireState.strategy === "rule_72t"
                  ? `SEPP @ ${fireState.retirementAge} → Full @ ${fireState.fullRetirementAge}`
                  : `Full @ ${fireState.fullRetirementAge}`}
              </p>
            </div>
            <div className="p-2 bg-secondary/50 rounded-lg border border-border text-center">
              <p className="text-[9px] text-muted-foreground">
                {fireState.strategy === "rule_72t" ? "IRA Balance (SEPP)" : "Starting Portfolio"}
              </p>
              <p className="text-xs font-bold text-green-400 font-mono">
                {fireState.strategy === "rule_72t"
                  ? formatCurrency(fireState.iraBalance, 0)
                  : formatCurrency(fireState.startBalance, 0)}
              </p>
            </div>
          </div>
          {fireState.strategy === "rule_72t" && fireState.selectedSeppAmount != null && (
            <div className="mt-2 p-2 bg-cyan-400/10 border border-cyan-400/20 rounded-lg">
              <p className="text-[10px] text-cyan-400">
                SEPP Annual Distribution ({METHOD_72T_LABELS[fireState.method72t]}):
                <span className="font-mono font-bold ml-1">{formatCurrency(fireState.selectedSeppAmount, 0)}/yr</span>
                <span className="text-muted-foreground ml-2">→</span>
                <span className="font-mono font-bold text-green-400 ml-2">{formatCurrency(fireState.selectedSeppAmount / 12, 0)}/mo</span>
              </p>
            </div>
          )}
          {fireState.strategy === "swr" && (
            <div className="mt-2 p-2 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-[10px] text-primary">
                SWR Annual Withdrawal:
                <span className="font-mono font-bold ml-1">{formatCurrency(fireState.startBalance * fireState.swrPct / 100, 0)}/yr</span>
                <span className="text-muted-foreground ml-2">→</span>
                <span className="font-mono font-bold text-green-400 ml-2">{formatCurrency(fireState.startBalance * fireState.swrPct / 100 / 12, 0)}/mo</span>
              </p>
            </div>
          )}
          <p className="text-[9px] text-muted-foreground mt-1.5">
            Employment income: <span className="font-mono text-blue-400">{formatCurrency(fireState.employmentIncome, 0)}/mo</span>
            {" · "}Inflation: <span className="font-mono text-amber-400">{fireState.inflationRate}%</span>
            {" · "}Portfolio return: <span className="font-mono text-primary">{fireState.annualReturn.toFixed(1)}%</span>
            {" · "}Horizon: <span className="font-mono text-foreground">{fireState.projYears} yrs</span>
          </p>
        </div>
      )}

      {/* Tax rate inputs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 p-3 bg-secondary/30 rounded-xl border border-border">
        {[
          { label: "Ordinary Income Rate", val: ordinaryTaxRate, set: setOrdinaryTaxRate, color: "text-destructive" },
          { label: "LT Cap Gains Rate", val: ltcgRate, set: setLtcgRate, color: "text-amber-400" },
          { label: "State Income Rate", val: stateRate, set: setStateRate, color: "text-cyan-400" },
          { label: "Future Withdrawal Rate", val: futureWithdrawalRate, set: setFutureWithdrawalRate, color: "text-purple-400" },
          { label: portfolioCagr != null ? `Portfolio CAGR (from model)` : "Portfolio Growth Rate", val: projGrowthRate, set: setProjGrowthRate, color: "text-primary" },
        ].map(({ label, val, set, color }) => (
          <div key={label}>
            <Label className="text-[10px] text-muted-foreground">{label}</Label>
            <div className="flex items-center gap-1 mt-1">
              <Input type="number" value={val} onChange={e => set(Math.max(0, parseFloat(e.target.value) || 0))}
                className="h-7 text-xs font-mono bg-card border-border" min={0} max={60} step={0.5} />
              <span className={`text-xs font-bold ${color}`}>%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Asset allocation grid */}
      {hasAnyHoldings && (
        <div className="mb-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Asset → Account Allocation (%)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1.5 pr-2 font-medium w-16">Asset</th>
                  {ACCOUNT_TYPES.map(a => (
                    <th key={a.id} className="text-center py-1.5 px-1 font-medium" style={{ color: a.color }}>
                      {a.label.split(" ")[0]}{a.id === "k401" ? " 401k" : ""}
                    </th>
                  ))}
                  <th className="text-right py-1.5 pl-2 font-medium">Total $</th>
                </tr>
              </thead>
              <tbody>
                {ASSETS.filter(a => (portfolioHoldings?.[a] ?? 0) > 0 || (prices?.[a] ?? 0) > 0).map(asset => {
                  const totalVal = (portfolioHoldings?.[asset] ?? 0) * (prices?.[asset] ?? 0);
                  if (totalVal === 0) return null;
                  return (
                    <tr key={asset} className="border-b border-border/30">
                      <td className="py-1.5 pr-2 font-bold text-foreground">{asset}</td>
                      {ACCOUNT_TYPES.map(acct => (
                        <td key={acct.id} className="py-1 px-1 text-center">
                          <Input
                            type="number"
                            value={Math.round(assetAllocation[asset]?.[acct.id] ?? 0)}
                            onChange={e => setAllocation(asset, acct.id, Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                            className="h-6 w-14 text-xs font-mono bg-card border-border text-center mx-auto"
                            min={0} max={100}
                          />
                        </td>
                      ))}
                      <td className="py-1.5 pl-2 text-right font-mono font-bold text-foreground">{formatCurrency(totalVal, 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td className="py-1.5 pr-2 font-bold text-foreground text-[10px]">Total</td>
                  {ACCOUNT_TYPES.map(a => (
                    <td key={a.id} className="py-1.5 px-1 text-center font-mono text-[10px] font-bold" style={{ color: a.color }}>
                      {formatCurrency(accountTotals[a.id], 0)}
                    </td>
                  ))}
                  <td className="py-1.5 pl-2 text-right font-mono font-bold text-primary">{formatCurrency(grandTotal, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* After-tax summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="p-3 bg-secondary/50 rounded-xl border border-border text-center col-span-2">
          <p className="text-[10px] text-muted-foreground">Total Gross Portfolio</p>
          <p className="text-lg font-bold font-mono text-foreground">{formatCurrency(grandTotal)}</p>
        </div>
        <div className="p-3 bg-secondary/50 rounded-xl border border-border text-center col-span-2">
          <p className="text-[10px] text-muted-foreground">Est. After-Tax Value</p>
          <p className="text-lg font-bold font-mono text-green-400">{formatCurrency(totalAfterTax)}</p>
          <p className="text-[9px] text-muted-foreground">Tax drag: <span className="text-destructive font-mono">{taxDragPct}%</span></p>
        </div>
      </div>

      {/* Bar chart: gross vs after-tax per account */}
      {hasAnyHoldings && (
        <div className="mb-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Gross vs After-Tax by Account</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: "hsl(215 20% 55%)" }} />
              <YAxis tick={TICK_STYLE} tickFormatter={v => formatCurrency(v)} />
              <Tooltip
                contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", fontSize: 11 }}
                formatter={(v, name) => [formatCurrency(v, 0), name]}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="gross" name="Gross Value" fill="#60A5FA" radius={[3, 3, 0, 0]} opacity={0.6} />
              <Bar dataKey="afterTax" name="After-Tax Value" fill="#22C55E" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Growth projection */}
      <div className="mb-4">
        <div className="flex justify-between mb-2 items-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">After-Tax Wealth Projection</p>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground">Years</Label>
            <Input type="number" value={projYears} onChange={e => setProjYears(Math.max(1, Math.min(30, parseInt(e.target.value) || 10)))}
              className="h-6 w-16 text-xs font-mono bg-card border-border" min={1} max={30} />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={growthProjection} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="year" tick={TICK_STYLE} />
            <YAxis tick={TICK_STYLE} tickFormatter={v => formatCurrency(v)} />
            <Tooltip
              contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", fontSize: 11 }}
              formatter={(v, name) => [formatCurrency(v, 0), name]}
              labelFormatter={l => `Year ${l}`}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="total_gross" stroke="#60A5FA" strokeWidth={1.5} name="Total Gross" dot={false} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="total_net" stroke="#22C55E" strokeWidth={2.5} name="Total After-Tax" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tax efficiency guide */}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Tax Efficiency Guide — Where to Hold Each Asset</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1.5 pr-3 font-medium">Asset</th>
                <th className="text-left py-1.5 pr-3 font-medium">Best Account</th>
                <th className="text-left py-1.5 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {TAX_EFFICIENCY_RULES.map(r => (
                <tr key={r.asset} className="border-b border-border/30 hover:bg-secondary/20">
                  <td className="py-1.5 pr-3 font-bold text-primary font-mono">{r.asset}</td>
                  <td className="py-1.5 pr-3 text-green-400 font-semibold">{r.best}</td>
                  <td className="py-1.5 text-muted-foreground text-[10px]">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground/50 text-center mt-3">
        Tax estimates are illustrative only. Actual tax treatment depends on your specific situation. Consult a CPA.
      </p>
    </Card>
  );
}