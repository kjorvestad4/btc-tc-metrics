import React from "react";
import ProjectionChart from "../dashboard/ProjectionChart";
import MetricCard from "../dashboard/MetricCard";
import { BarChart3, DollarSign, Percent, Activity } from "lucide-react";
import { formatCurrency, formatPercent, calcMSTYDividend } from "@/lib/calculations";

export default function MSTYModelTab({ params, projections }) {
  const monthlyDiv = calcMSTYDividend(params.mstr_price, params.mstr_iv, params.msty_participation_rate);
  const annualDiv = monthlyDiv * 12;
  const currentYield = params.msty_nav > 0 ? (annualDiv / params.msty_nav) * 100 : 0;

  const mstyData = projections
    .filter((_, i) => i % 2 === 0 || i === projections.length - 1)
    .map((p) => ({
      ...p,
      msty_annual_div: p.msty_dividend_monthly * 12,
    }));

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">MSTY (YieldMax MSTR ETF) Model</h3>
        <p className="text-xs text-muted-foreground mb-4">
          MSTY writes synthetic covered calls on MSTR. Income ≈ f(MSTR price × IV × participation).
          Higher IV = more premium income but capped upside. NAV decays over time due to call writing.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard title="MSTY NAV" value={formatCurrency(params.msty_nav)} icon={DollarSign} accentClass="text-cyan-400" />
          <MetricCard title="Monthly Div Est." value={formatCurrency(monthlyDiv, 2)} icon={BarChart3} accentClass="text-green-400"
            tooltip="Estimated monthly dividend = MSTR Price × (IV/100) × √(1/12) × Participation Rate" />
          <MetricCard title="Annual Yield" value={formatPercent(currentYield)} icon={Percent} accentClass="text-amber-400" />
          <MetricCard title="MSTR IV" value={`${params.mstr_iv}%`} icon={Activity} accentClass="text-purple-400"
            tooltip="MSTR implied volatility drives MSTY option premiums. Typical range: 60-120%. @PunterJeff notes MSTR's extreme vol is a feature, not a bug." />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProjectionChart
          title="MSTY Monthly Dividend Projection"
          data={mstyData}
          lines={[{ key: "msty_dividend_monthly", name: "Monthly Dividend ($)", color: "#22C55E" }]}
          height={280}
        />
        <ProjectionChart
          title="MSTY NAV & Yield Projection"
          data={mstyData}
          lines={[
            { key: "msty_nav", name: "MSTY NAV ($)", color: "#06B6D4" },
            { key: "msty_yield", name: "Annualized Yield (%)", color: "#F59E0B" },
          ]}
          height={280}
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Covered Call Mechanics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-1">Premium Formula</p>
            <code className="text-xs font-mono text-foreground block">
              Monthly Div ≈ MSTR × IV × √(1/12) × Part%
            </code>
            <p className="text-[10px] text-muted-foreground mt-1">
              = ${params.mstr_price} × {params.mstr_iv}% × 0.289 × {params.msty_participation_rate}%
            </p>
            <p className="text-xs font-mono text-cyan-400 mt-1">= {formatCurrency(monthlyDiv, 2)}/month</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-1">Income Drivers</p>
            <ul className="text-[10px] text-muted-foreground space-y-1 mt-1">
              <li>• Higher MSTR IV → more premium</li>
              <li>• Higher MSTR price → higher notional</li>
              <li>• Higher participation → more income</li>
              <li>• Shorter DTE → more frequent rolls</li>
            </ul>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1">NAV Decay Risk</p>
            <ul className="text-[10px] text-muted-foreground space-y-1 mt-1">
              <li>• Covered calls cap upside participation</li>
              <li>• NAV erodes in strong rallies (missed gains)</li>
              <li>• Roll timing risk in volatile markets</li>
              <li>• Dividend ≠ total return guarantee</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}