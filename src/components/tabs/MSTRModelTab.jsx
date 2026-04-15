import React from "react";
import ProjectionChart from "../dashboard/ProjectionChart";
import MetricCard from "../dashboard/MetricCard";
import { TrendingUp, Activity, DollarSign, BarChart3 } from "lucide-react";
import { formatCurrency, formatPercent, calcMNAV, calcTotalPrefLiquidation } from "@/lib/calculations";

export default function MSTRModelTab({ params, preferreds, projections }) {
  const totalPrefLiq = calcTotalPrefLiquidation(preferreds);
  const mnav = calcMNAV(params.mstr_btc_holdings, params.btc_price, totalPrefLiq, params.mstr_shares_outstanding);
  const premiumToNav = mnav > 0 ? ((params.mstr_price / mnav) - 1) * 100 : 0;
  const y5 = projections.find((p) => p.quarter === 20);

  // Earnings-based valuation (50% CAGR)
  const earningsProjections = [];
  let earningsBase = params.mstr_price;
  for (let y = 0; y <= 5; y++) {
    earningsProjections.push({
      label: y === 0 ? "Now" : `Year ${y}`,
      earnings_price: earningsBase,
      nav_price: projections.find((p) => p.quarter === y * 4)?.mstr_price || 0,
    });
    earningsBase *= (1 + params.earnings_cagr / 100);
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">Strategy (MSTR) Valuation Model</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Two approaches: <span className="text-primary">mNAV × Amplification</span> and{" "}
          <span className="text-blue-400">Earnings-based ({params.earnings_cagr}% CAGR)</span>.
          Per @PunterJeff, MSTR is a "Bitcoin treasury / fiat-debasement insurer" — not a software company.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard title="mNAV/Share" value={formatCurrency(mnav)} icon={DollarSign} accentClass="text-blue-400"
            tooltip="mNAV = (BTC Holdings × BTC Price – Pref Liquidation) ÷ Shares Outstanding" />
          <MetricCard title="Premium to mNAV" value={formatPercent(premiumToNav)} icon={Activity} accentClass={premiumToNav >= 0 ? "text-green-400" : "text-red-400"} />
          <MetricCard title="Amplification" value={`${params.amplification_ratio.toFixed(1)}x`} icon={TrendingUp} accentClass="text-primary"
            tooltip="The amplification ratio = Market Cap ÷ BTC NAV. Reflexive: higher premium → more capital → more BTC → higher NAV" />
          <MetricCard title="5Y Price Target" value={y5 ? formatCurrency(y5.mstr_price) : "—"} icon={BarChart3} accentClass="text-emerald-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProjectionChart
          title="MSTR Price: mNAV-Based vs Earnings-Based"
          data={earningsProjections}
          lines={[
            { key: "nav_price", name: "mNAV × Amplification", color: "#22C55E" },
            { key: "earnings_price", name: `${params.earnings_cagr}% Earnings CAGR`, color: "#3B82F6" },
          ]}
          height={300}
        />
        <ProjectionChart
          title="MSTR Premium to mNAV Over Time"
          data={projections.filter((_, i) => i % 2 === 0 || i === projections.length - 1)}
          lines={[{ key: "premium_to_nav", name: "Premium to mNAV (%)", color: "#A855F7" }]}
          height={300}
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Formulas (Transparent)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1">mNAV Calculation</p>
            <code className="text-xs font-mono text-foreground block">
              mNAV = (BTC_Holdings × BTC_Price − Pref_Liquidation) ÷ Shares
            </code>
            <p className="text-[10px] text-muted-foreground mt-1">
              = ({params.mstr_btc_holdings.toLocaleString()} × ${params.btc_price.toLocaleString()} − ${(totalPrefLiq/1e6).toFixed(0)}M) ÷ {params.mstr_shares_outstanding}M
            </p>
            <p className="text-xs font-mono text-primary mt-1">= {formatCurrency(mnav)}/share</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1">Price Projection</p>
            <code className="text-xs font-mono text-foreground block">
              MSTR_Price = mNAV × Amplification × Premium
            </code>
            <p className="text-[10px] text-muted-foreground mt-1">
              = {formatCurrency(mnav)} × {params.amplification_ratio} × {params.premium_multiple}
            </p>
            <p className="text-xs font-mono text-blue-400 mt-1">= {formatCurrency(mnav * params.amplification_ratio * params.premium_multiple)}/share</p>
          </div>
        </div>
      </div>

      <ProjectionChart
        title="Shares Outstanding (Dilution Over Time)"
        data={projections.filter((_, i) => i % 2 === 0 || i === projections.length - 1)}
        lines={[{ key: "shares_outstanding_m", name: "Shares (Millions)", color: "#EF4444" }]}
        height={220}
      />
    </div>
  );
}