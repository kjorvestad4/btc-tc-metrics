import React from "react";
import ProjectionChart from "../dashboard/ProjectionChart";
import MetricCard from "../dashboard/MetricCard";
import { BarChart3, DollarSign, Percent, Activity, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent, calcMSTYDividend } from "@/lib/calculations";
import { MSTY_DISTRIBUTION_HISTORY } from "@/lib/marketData";

export default function MSTYModelTab({ params, projections, liveData, onRefresh, refreshing }) {
  // Live values take priority if fetched
  const mstyPrice = liveData?.msty_price ?? params.msty_nav;
  const mstyNav = params.msty_nav;
  const latestDiv = liveData?.msty_latest_div ?? 0.3051; // Apr 9 known value
  const annualDivFromWeekly = latestDiv * 52;

  // Model-driven monthly dividend (PunterJeff formula)
  const monthlyDiv = calcMSTYDividend(params.mstr_price, params.mstr_iv, params.msty_participation_rate);
  const annualDivModel = monthlyDiv * 12;
  const currentYield = mstyNav > 0 ? (annualDivFromWeekly / mstyPrice) * 100 : 0;
  const premiumDiscount = mstyNav > 0 ? ((mstyPrice / mstyNav) - 1) * 100 : 0;
  const isLive = !!liveData;

  const mstyData = projections
    .filter((_, i) => i % 2 === 0 || i === projections.length - 1)
    .map((p) => ({
      ...p,
      msty_annual_div: p.msty_dividend_monthly * 12,
    }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start justify-between flex-wrap gap-2 mb-1">
          <div>
            <h3 className="text-sm font-semibold text-foreground">MSTY (YieldMax MSTR ETF) — Live Data</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              MSTY writes synthetic covered calls on MSTR. Income ≈ f(MSTR price × IV × participation).
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Fetching…" : "Refresh Live"}
          </Button>
        </div>

        {/* Live status badge */}
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium mb-3 ${
          isLive
            ? "bg-primary/15 text-primary border border-primary/25"
            : "bg-secondary text-muted-foreground border border-border"
        }`}>
          <Wifi className="w-2.5 h-2.5" />
          {isLive ? "Live market data loaded" : "Static defaults — click Refresh Live to fetch"}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            title="MSTY Price"
            value={formatCurrency(mstyPrice, 2)}
            subtitle={isLive ? "Live" : "Default"}
            icon={DollarSign}
            accentClass="text-amber-400"
          />
          <MetricCard
            title="MSTY NAV"
            value={formatCurrency(mstyNav, 2)}
            subtitle={premiumDiscount >= 0 ? `+${premiumDiscount.toFixed(1)}% premium` : `${premiumDiscount.toFixed(1)}% discount`}
            icon={DollarSign}
            accentClass="text-cyan-400"
          />
          <MetricCard
            title="Latest Weekly Div"
            value={`$${latestDiv.toFixed(4)}`}
            subtitle={`$${annualDivFromWeekly.toFixed(2)}/yr annualized`}
            icon={BarChart3}
            accentClass="text-green-400"
            tooltip="Apr 9, 2026 ex-date distribution. Annualized = weekly × 52."
          />
          <MetricCard
            title="Current Yield"
            value={formatPercent(currentYield)}
            subtitle="Weekly div × 52 ÷ price"
            icon={Percent}
            accentClass="text-amber-400"
          />
        </div>
      </div>

      {/* Distribution history table + model metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly distribution history */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-green-400" />
            Weekly Distribution History
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted-foreground font-medium py-1.5 pr-4">Ex-Date</th>
                  <th className="text-right text-muted-foreground font-medium py-1.5 pr-4">Amount</th>
                  <th className="text-right text-muted-foreground font-medium py-1.5">Ann. Run-Rate</th>
                </tr>
              </thead>
              <tbody>
                {MSTY_DISTRIBUTION_HISTORY.map((d, i) => (
                  <tr key={d.ex_date} className={`border-b border-border/40 ${i === 0 ? "bg-primary/5" : ""}`}>
                    <td className="py-1.5 pr-4 text-foreground font-mono">
                      {d.ex_date}
                      {i === 0 && <span className="ml-1.5 text-[9px] bg-primary/20 text-primary px-1 rounded">LATEST</span>}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono text-green-400">${d.amount.toFixed(4)}</td>
                    <td className="py-1.5 text-right font-mono text-muted-foreground">${(d.amount * 52).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td className="py-1.5 text-muted-foreground text-[10px]">8-week avg</td>
                  <td className="py-1.5 text-right font-mono text-primary">
                    ${(MSTY_DISTRIBUTION_HISTORY.reduce((s, d) => s + d.amount, 0) / MSTY_DISTRIBUTION_HISTORY.length).toFixed(4)}
                  </td>
                  <td className="py-1.5 text-right font-mono text-primary">
                    ${((MSTY_DISTRIBUTION_HISTORY.reduce((s, d) => s + d.amount, 0) / MSTY_DISTRIBUTION_HISTORY.length) * 52).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Model formula & IV metrics */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            PunterJeff Model Estimate
          </h4>

          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-1.5">Premium Formula</p>
            <code className="text-xs font-mono text-foreground block">
              Monthly Div ≈ MSTR × IV × √(1/12) × Part%
            </code>
            <p className="text-[10px] text-muted-foreground mt-1">
              = ${params.mstr_price.toLocaleString()} × {params.mstr_iv}% × 0.289 × {params.msty_participation_rate}%
            </p>
            <p className="text-xs font-mono text-cyan-400 mt-1">= {formatCurrency(monthlyDiv, 2)}/month model est.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-center">
              <p className="text-[10px] text-muted-foreground">MSTR IV</p>
              <p className="text-lg font-bold text-purple-400 font-mono">{params.mstr_iv}%</p>
              <p className="text-[9px] text-muted-foreground">60–70% range</p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Participation</p>
              <p className="text-lg font-bold text-amber-400 font-mono">{params.msty_participation_rate}%</p>
              <p className="text-[9px] text-muted-foreground">of MSTR upside</p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Model Monthly</p>
              <p className="text-base font-bold text-green-400 font-mono">{formatCurrency(monthlyDiv, 2)}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Model Annual</p>
              <p className="text-base font-bold text-green-400 font-mono">{formatCurrency(annualDivModel, 2)}</p>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <ul className="text-[10px] text-muted-foreground space-y-1">
              <li>• <span className="text-amber-400 font-medium">NAV decay risk:</span> covered calls cap upside in strong rallies</li>
              <li>• <span className="text-amber-400 font-medium">Roll risk:</span> timing slippage in high-vol markets</li>
              <li>• Distribution ≠ total return — reinvest for compounding</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Projection charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProjectionChart
          title="MSTY Monthly Dividend Projection (Model)"
          data={mstyData}
          lines={[{ key: "msty_dividend_monthly", name: "Monthly Dividend ($)", color: "#22C55E" }]}
          height={260}
        />
        <ProjectionChart
          title="MSTY NAV & Annualized Yield"
          data={mstyData}
          lines={[
            { key: "msty_nav", name: "MSTY NAV ($)", color: "#06B6D4" },
            { key: "msty_yield", name: "Yield (%)", color: "#F59E0B" },
          ]}
          height={260}
        />
      </div>
    </div>
  );
}