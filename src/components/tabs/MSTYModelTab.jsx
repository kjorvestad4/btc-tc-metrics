import React, { useState } from "react";
import ProjectionChart from "../dashboard/ProjectionChart";
import MetricCard from "../dashboard/MetricCard";
import { BarChart3, DollarSign, Percent, Activity, RefreshCw, Wifi, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatPercent, calcMSTYDividend } from "@/lib/calculations";
import { MSTY_DISTRIBUTION_HISTORY } from "@/lib/marketData";

// MSTY fund-level facts (April 2026)
const MSTY_SHARES_OUTSTANDING = 275_000_000; // ~275M shares outstanding
const MSTY_MGMT_FEE = 0.99; // % annual management fee

export default function MSTYModelTab({ params, projections, liveData, onRefresh, refreshing }) {
  const [shareQty, setShareQty] = useState(1000);

  // Live values
  const mstySharePrice = liveData?.msty_price ?? params.msty_nav;
  const latestWeeklyDiv = liveData?.msty_latest_div ?? 0.3051;
  const annualDivFromWeekly = latestWeeklyDiv * 52;

  // MSTY NAV = total fund AUM = share price × shares outstanding
  // (For an ETF, NAV per share ≈ share price; total NAV = price × shares outstanding)
  const mstyTotalNavAUM = mstySharePrice * MSTY_SHARES_OUTSTANDING;
  const mstyNavPerShare = mstySharePrice; // ETF NAV/share ≈ market price for liquid ETFs

  // Current yield based on actual weekly div
  const currentYield = mstySharePrice > 0 ? (annualDivFromWeekly / mstySharePrice) * 100 : 0;

  // Model-driven monthly dividend (PunterJeff formula) — per share
  // MSTR price × IV × sqrt(1/12) × participation rate = monthly premium per unit of MSTR
  // MSTY NAV per share ≈ MSTR price × participation, so scale accordingly
  const monthlyDivPerShare = calcMSTYDividend(params.mstr_price, params.mstr_iv, params.msty_participation_rate);
  const annualDivModelPerShare = monthlyDivPerShare * 12;
  const modelYield = mstySharePrice > 0 ? (annualDivModelPerShare / mstySharePrice) * 100 : 0;

  // User's investment calculator
  const investmentValue = shareQty * mstySharePrice;
  const annualIncomeActual = shareQty * annualDivFromWeekly;
  const annualIncomeModel = shareQty * annualDivModelPerShare;
  const weeklyIncomeActual = shareQty * latestWeeklyDiv;

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
            <h3 className="text-sm font-semibold text-foreground">MSTY (YieldMax MSTR Option Income ETF)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Writes synthetic covered calls on MSTR. Weekly income ≈ f(MSTR price × IV × participation rate).
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
            title="MSTY Share Price"
            value={formatCurrency(mstySharePrice, 2)}
            subtitle={isLive ? "Live (Polygon)" : "Default"}
            icon={DollarSign}
            accentClass="text-amber-400"
          />
          <MetricCard
            title="MSTY Total AUM (NAV)"
            value={formatCurrency(mstyTotalNavAUM)}
            subtitle={`${(MSTY_SHARES_OUTSTANDING / 1e6).toFixed(0)}M shares × price`}
            icon={DollarSign}
            accentClass="text-cyan-400"
            tooltip="Total fund NAV = Share Price × Shares Outstanding (~275M). This is the total value of all MSTY assets under management, not the per-share price."
          />
          <MetricCard
            title="Latest Weekly Div/Share"
            value={`$${latestWeeklyDiv.toFixed(4)}`}
            subtitle={`$${annualDivFromWeekly.toFixed(2)}/yr annualized`}
            icon={BarChart3}
            accentClass="text-green-400"
            tooltip="Apr 9, 2026 ex-date distribution per share. Annualized = weekly × 52."
          />
          <MetricCard
            title="Current Yield"
            value={formatPercent(currentYield)}
            subtitle="Weekly div × 52 ÷ share price"
            icon={Percent}
            accentClass="text-amber-400"
          />
        </div>
      </div>

      {/* Share Qty Calculator */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">My MSTY Investment Calculator</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Number of Shares</Label>
            <Input
              type="number"
              value={shareQty}
              onChange={(e) => setShareQty(Math.max(0, parseInt(e.target.value) || 0))}
              className="h-8 text-sm font-mono bg-secondary border-border"
              min={0}
            />
            <p className="text-[10px] text-muted-foreground">Investment value: <span className="text-foreground font-mono font-semibold">{formatCurrency(investmentValue, 2)}</span></p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Weekly Income</p>
              <p className="text-base font-bold font-mono text-green-400">{formatCurrency(weeklyIncomeActual, 2)}</p>
              <p className="text-[9px] text-muted-foreground">at latest rate</p>
            </div>
            <div className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Annual Income</p>
              <p className="text-base font-bold font-mono text-green-400">{formatCurrency(annualIncomeActual, 2)}</p>
              <p className="text-[9px] text-muted-foreground">at latest rate × 52</p>
            </div>
            <div className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Model Monthly</p>
              <p className="text-base font-bold font-mono text-cyan-400">{formatCurrency(shareQty * monthlyDivPerShare, 2)}</p>
              <p className="text-[9px] text-muted-foreground">PunterJeff formula</p>
            </div>
            <div className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Model Annual</p>
              <p className="text-base font-bold font-mono text-cyan-400">{formatCurrency(annualIncomeModel, 2)}</p>
              <p className="text-[9px] text-muted-foreground">model × 12</p>
            </div>
          </div>
        </div>
      </div>

      {/* Distribution history + model */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly distribution history */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-green-400" />
            Weekly Distribution History (per share)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted-foreground font-medium py-1.5 pr-4">Ex-Date</th>
                  <th className="text-right text-muted-foreground font-medium py-1.5 pr-4">$/Share</th>
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
                    <td className="py-1.5 text-right font-mono text-muted-foreground">${(d.amount * 52).toFixed(2)}/yr</td>
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
                    ${((MSTY_DISTRIBUTION_HISTORY.reduce((s, d) => s + d.amount, 0) / MSTY_DISTRIBUTION_HISTORY.length) * 52).toFixed(2)}/yr
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Model formula */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            PunterJeff Model — Per-Share Dividend Estimate
          </h4>

          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-1.5">Covered Call Premium Formula</p>
            <code className="text-xs font-mono text-foreground block">
              Monthly Div/Share ≈ MSTR_Price × IV × √(1/12) × Part%
            </code>
            <p className="text-[10px] text-muted-foreground mt-1">
              = ${params.mstr_price.toLocaleString()} × {params.mstr_iv}% × 0.289 × {params.msty_participation_rate}%
            </p>
            <p className="text-xs font-mono text-cyan-400 mt-1">= {formatCurrency(monthlyDivPerShare, 4)}/share/month</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Note: This is a rough model estimate. Actual distributions depend on realized IV, option strike selection, and roll mechanics.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-center">
              <p className="text-[10px] text-muted-foreground">MSTR IV</p>
              <p className="text-lg font-bold text-purple-400 font-mono">{params.mstr_iv}%</p>
              <p className="text-[9px] text-muted-foreground">30-day implied vol</p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Participation</p>
              <p className="text-lg font-bold text-amber-400 font-mono">{params.msty_participation_rate}%</p>
              <p className="text-[9px] text-muted-foreground">of MSTR upside</p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Model Monthly/Share</p>
              <p className="text-base font-bold text-green-400 font-mono">{formatCurrency(monthlyDivPerShare, 4)}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Model Yield</p>
              <p className="text-base font-bold text-green-400 font-mono">{formatPercent(modelYield)}</p>
              <p className="text-[9px] text-muted-foreground">annualized</p>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <ul className="text-[10px] text-muted-foreground space-y-1">
              <li>• <span className="text-amber-400 font-medium">NAV decay risk:</span> covered calls cap upside in strong rallies — NAV erodes over time</li>
              <li>• <span className="text-amber-400 font-medium">Roll risk:</span> timing slippage reduces effective premium in high-vol markets</li>
              <li>• <span className="text-amber-400 font-medium">MSTY NAV ≠ share price parity:</span> ETF can trade at small premium/discount to daily NAV</li>
              <li>• Distribution ≠ total return — reinvesting dividends significantly improves compounding</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Projection charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProjectionChart
          title="MSTY Monthly Dividend/Share Projection (Model)"
          data={mstyData}
          lines={[{ key: "msty_dividend_monthly", name: "Monthly Div/Share ($)", color: "#22C55E" }]}
          height={260}
        />
        <ProjectionChart
          title="MSTY NAV (per share) & Annualized Yield"
          data={mstyData}
          lines={[
            { key: "msty_nav", name: "NAV/Share ($)", color: "#06B6D4" },
            { key: "msty_yield", name: "Yield (%)", color: "#F59E0B" },
          ]}
          height={260}
        />
      </div>
    </div>
  );
}