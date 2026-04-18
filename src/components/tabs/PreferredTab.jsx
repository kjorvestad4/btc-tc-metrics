import React from "react";
import ProjectionChart from "../dashboard/ProjectionChart";
import MetricCard from "../dashboard/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Layers, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import { formatCurrency, formatPercent, calcTotalPrefLiquidation, calcTotalAnnualDividend } from "@/lib/calculations";

export default function PreferredTab({ params, preferreds, projections }) {
  // Exclude STRC — it has its own dedicated tab
  const filteredPreferreds = preferreds.filter(p => p.ticker !== "STRC");
  const totalLiq = calcTotalPrefLiquidation(filteredPreferreds);
  const totalDiv = calcTotalAnnualDividend(filteredPreferreds);
  const btcNav = params.mstr_btc_holdings * params.btc_price;
  const divAsPctOfNav = btcNav > 0 ? (totalDiv / btcNav) * 100 : 0;

  const divOverTime = projections
    .filter((_, i) => i % 2 === 0 || i === projections.length - 1)
    .map((p) => ({
      ...p,
      div_as_pct_nav: p.btc_nav > 0 ? (totalDiv / p.btc_nav) * 100 : 0,
      total_div: totalDiv,
      cumulative_div: totalDiv * (p.quarter / 4),
    }));

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">Perpetual Preferred Stock Simulator</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Strategy's perpetual preferreds (STRF, STRE, STRK, STRD) are "digital credit" — permanent capital that funds BTC accumulation.
          STRC has its own dedicated tab. No maturity date = no repayment obligation, only perpetual dividends.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard title="Total Notional" value={formatCurrency(totalLiq)} icon={Layers} accentClass="text-purple-400" />
          <MetricCard title="Annual Dividends" value={formatCurrency(totalDiv)} icon={DollarSign} accentClass="text-red-400" />
          <MetricCard title="Div as % of BTC NAV" value={formatPercent(divAsPctOfNav)} icon={AlertTriangle} accentClass="text-amber-400"
            tooltip="Annual dividend liability as percentage of BTC NAV. Lower is better — means BTC appreciation outpaces dividend drag." />
          <MetricCard title="Flywheel Effect" value="Active" icon={TrendingUp} accentClass="text-green-400"
            tooltip="Per @PunterJeff: Each preferred issuance funds more BTC → higher NAV → higher MSTR price → ability to issue more preferreds → reflexive amplification." />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 overflow-x-auto">
        <h3 className="text-sm font-semibold text-foreground mb-3">Preferred Series Detail</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 text-muted-foreground font-medium">Ticker</th>
              <th className="text-right py-2 text-muted-foreground font-medium">Notional</th>
              <th className="text-right py-2 text-muted-foreground font-medium">Div Rate</th>
              <th className="text-right py-2 text-muted-foreground font-medium">Annual Div</th>
              <th className="text-right py-2 text-muted-foreground font-medium">Frequency</th>
              <th className="text-center py-2 text-muted-foreground font-medium">BTC Denom.</th>
              <th className="text-right py-2 text-muted-foreground font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            {filteredPreferreds.map((p) => {
              const annDiv = p.notional_amount * 1e6 * (p.dividend_rate / 100);
              return (
                <tr key={p.ticker} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-2.5">
                    <Badge variant="outline" className="font-mono text-[10px] border-primary/30 text-primary">{p.ticker}</Badge>
                  </td>
                  <td className="text-right py-2.5 font-mono text-foreground">{formatCurrency(p.notional_amount * 1e6)}</td>
                  <td className="text-right py-2.5 font-mono text-amber-400">{p.dividend_rate}%</td>
                  <td className="text-right py-2.5 font-mono text-red-400">{formatCurrency(annDiv)}</td>
                  <td className="text-right py-2.5 text-muted-foreground capitalize">{p.payment_frequency}</td>
                  <td className="text-center py-2.5">
                    {p.is_btc_denominated ? (
                      <Badge className="bg-amber-400/10 text-amber-400 text-[10px]">BTC</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">USD</Badge>
                    )}
                  </td>
                  <td className="text-right py-2.5 font-mono text-foreground">${p.current_price}</td>
                </tr>
              );
            })}
            <tr className="bg-secondary/30">
              <td className="py-2.5 font-semibold text-foreground">TOTAL</td>
              <td className="text-right py-2.5 font-mono font-semibold text-foreground">{formatCurrency(totalLiq)}</td>
              <td className="text-right py-2.5">—</td>
              <td className="text-right py-2.5 font-mono font-semibold text-red-400">{formatCurrency(totalDiv)}</td>
              <td colSpan={3}></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProjectionChart
          title="Dividend Drag vs BTC NAV Growth"
          data={divOverTime}
          lines={[
            { key: "div_as_pct_nav", name: "Div as % of BTC NAV", color: "#EF4444" },
          ]}
          height={260}
        />
        <ProjectionChart
          title="Cumulative Dividend Outflow"
          data={divOverTime}
          lines={[
            { key: "cumulative_div", name: "Cumulative Dividends ($)", color: "#A855F7" },
            { key: "btc_nav", name: "BTC NAV ($)", color: "#F59E0B" },
          ]}
          type="area"
          height={260}
        />
      </div>

      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
        <p className="text-xs text-primary/80 leading-relaxed">
          <strong>@PunterJeff Flywheel:</strong> Issue perpetual preferred → raise capital → buy BTC → BTC appreciates →
          mNAV rises → MSTR premium grows → issue more preferred at favorable terms → repeat. The dividend "cost" shrinks
          relative to growing BTC NAV, making each subsequent issuance more accretive. This is the "digital credit" thesis.
        </p>
      </div>
    </div>
  );
}