import React, { useState } from "react";
import ProjectionChart from "../dashboard/ProjectionChart";
import MetricCard from "../dashboard/MetricCard";
import { BarChart3, DollarSign, Percent, Activity, RefreshCw, Wifi } from "lucide-react";
// Investment calculator moved to Projections page
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent, calcMSTYDividend } from "@/lib/calculations";
import { MSTY_DISTRIBUTION_HISTORY } from "@/lib/marketData";

// MSTY fund-level facts (April 2026)
const MSTY_SHARES_OUTSTANDING = 275_000_000; // ~275M shares outstanding
const MSTY_MGMT_FEE = 0.99; // % annual management fee

export default function MSTYModelTab({ params, projections, liveData, onRefresh, refreshing }) {

  // Live values
  const mstySharePrice = liveData?.msty_price ?? params.msty_nav;
  const latestWeeklyDiv = liveData?.msty_latest_div ?? 0.3051;
  const annualDivFromWeekly = latestWeeklyDiv * 52;

  // MSTY Total AUM
  const mstyTotalNavAUM = mstySharePrice * MSTY_SHARES_OUTSTANDING;

  // Model-driven monthly dividend (PunterJeff formula)
  const monthlyDivPerShare = calcMSTYDividend(params.mstr_price, params.mstr_iv, params.msty_participation_rate);
  const modelYield = mstySharePrice > 0 ? (monthlyDivPerShare * 12 / mstySharePrice) * 100 : 0;

  // (Investment calculator moved to Projections page)

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
            title="MSTY Total AUM"
            value={formatCurrency(mstyTotalNavAUM)}
            subtitle={`${(MSTY_SHARES_OUTSTANDING / 1e6).toFixed(0)}M shares × price`}
            icon={DollarSign}
            accentClass="text-cyan-400"
          />
          <MetricCard
            title="Latest Weekly Div/Share"
            value={`$${latestWeeklyDiv.toFixed(4)}`}
            subtitle={`~$${(latestWeeklyDiv * 4.33).toFixed(2)}/month`}
            icon={BarChart3}
            accentClass="text-green-400"
            tooltip="Recent weekly payout. Monthly ~$1.00–$1.25/share. Annualized run rate shown."
          />
          <MetricCard
            title="8-Week Avg Monthly Est."
            value={`$${((MSTY_DISTRIBUTION_HISTORY.reduce((s,d) => s+d.amount,0)/MSTY_DISTRIBUTION_HISTORY.length)*4.33).toFixed(2)}`}
            subtitle="per share (back-tested)"
            icon={Percent}
            accentClass="text-primary"
          />
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

        {/* MSTY Dividend Projection Analysis */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            MSTY Dividend Projection Analysis — April 18, 2026
          </h4>

          {/* 1. Overview */}
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-1.5">1. Overview & Strategy</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              MSTY generates highly variable <span className="text-foreground">weekly cash distributions</span> primarily from option premiums via a synthetic covered-call strategy on MSTR. The fund does NOT own MSTR shares outright — it uses combinations of options (synthetic long + selling OTM calls/spreads, often FLEX options) plus short-term U.S. Treasuries as collateral. Premium income is the dominant driver; distributions are frequently classified as <span className="text-amber-400">return of capital (ROC, 98%+ in recent payouts)</span>. This yields high advertised yields (60–200%+ annualized) but causes significant NAV erosion over time. Distributions are not guaranteed and fluctuate sharply with MSTR implied volatility, price level, and market conditions.
            </p>
          </div>

          {/* 2. Best Projection Formulas */}
          <div className="p-3 rounded-lg bg-secondary/50 border border-border space-y-2">
            <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-1.5">3. Best Dividend Projection Formulas</p>
            <div className="space-y-2">
              <div className="p-2 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-[10px] font-bold text-primary mb-0.5">Short-Term (1–2 weeks): Naive Persistence ← EMPIRICALLY BEST</p>
                <code className="text-xs font-mono text-foreground block">Next Weekly Div ≈ Most Recent Declared Distribution</code>
                <p className="text-[10px] text-muted-foreground mt-1">
                  As of Apr 16, 2026 ex-div: <span className="text-green-400 font-mono font-bold">$0.3038</span> → next projected: <span className="text-green-400 font-mono font-bold">~$0.30–$0.31</span>
                </p>
              </div>
              <div className="p-2 bg-purple-400/10 border border-purple-400/20 rounded-lg">
                <p className="text-[10px] font-bold text-purple-400 mb-0.5">Medium-Term (1–3 months): IV Heuristic</p>
                <code className="text-xs font-mono text-foreground block">Weekly Div ≈ (MSTY Price × MSTR IV) ÷ 52</code>
                <p className="text-[10px] text-muted-foreground mt-1">
                  At MSTY ~${mstySharePrice.toFixed(2)} &amp; MSTR IV ~{params.mstr_iv}%: ≈ <span className="text-purple-400 font-mono font-bold">${((mstySharePrice * (params.mstr_iv / 100)) / 52).toFixed(4)}/week</span>. Apply 0.8–1.2× calibration factor based on recent premium capture history.
                </p>
              </div>
              <div className="p-2 bg-secondary/80 border border-border rounded-lg">
                <p className="text-[10px] font-bold text-amber-400 mb-0.5">PunterJeff Formula (Monthly)</p>
                <code className="text-xs font-mono text-foreground block">Monthly Div ≈ MSTR_Price × IV × √(1/12) × Participation%</code>
                <p className="text-[10px] text-muted-foreground mt-1">
                  = ${params.mstr_price.toLocaleString()} × {params.mstr_iv}% × 0.289 × {params.msty_participation_rate}% = <span className="text-amber-400 font-mono font-bold">{formatCurrency(monthlyDivPerShare, 4)}/share/mo</span>
                </p>
              </div>
            </div>
          </div>

          {/* 4. Backtest Results */}
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-2">4. Rigorous Backtest Results (Weekly Regime: Oct 2025 – Apr 2026, ~27 obs.)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-1 pr-3 font-medium">Model</th>
                    <th className="text-right py-1 pr-3 font-medium">MSE</th>
                    <th className="text-right py-1 font-medium">MAE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/40 bg-primary/5">
                    <td className="py-1.5 pr-3 font-bold text-primary">Naive Persistence ← BEST</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-primary">0.0055</td>
                    <td className="py-1.5 text-right font-mono text-primary">$0.059</td>
                  </tr>
                  <tr className="border-b border-border/40">
                    <td className="py-1.5 pr-3 text-foreground">3-Period Moving Avg</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">0.0079</td>
                    <td className="py-1.5 text-right font-mono text-muted-foreground">$0.071</td>
                  </tr>
                  <tr className="border-b border-border/40">
                    <td className="py-1.5 pr-3 text-foreground">EWMA (α=0.5)</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">0.0094</td>
                    <td className="py-1.5 text-right font-mono text-muted-foreground">$0.074</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3 text-foreground">5-Period Moving Avg</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">0.0296</td>
                    <td className="py-1.5 text-right font-mono text-muted-foreground">$0.114</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-2">Full history: 46 distributions (2024–Apr 2026). Weekly subset most relevant for current regime. No official YieldMax forward projections exist.</p>
          </div>

          {/* Key metrics grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-center">
              <p className="text-[10px] text-muted-foreground">MSTR IV (current)</p>
              <p className="text-lg font-bold text-purple-400 font-mono">{params.mstr_iv}%</p>
              <p className="text-[9px] text-muted-foreground">Primary premium driver</p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Next Div Projection</p>
              <p className="text-lg font-bold text-green-400 font-mono">~$0.30</p>
              <p className="text-[9px] text-muted-foreground">naive persistence model</p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Model Monthly/Share</p>
              <p className="text-base font-bold text-amber-400 font-mono">{formatCurrency(monthlyDivPerShare, 4)}</p>
              <p className="text-[9px] text-muted-foreground">PunterJeff formula</p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Model Ann. Yield</p>
              <p className="text-base font-bold text-green-400 font-mono">{formatPercent(modelYield)}</p>
              <p className="text-[9px] text-muted-foreground">annualized</p>
            </div>
          </div>

          {/* 6. Risks */}
          <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5">6. Risks, Edge Cases & Practical Implications</p>
            <ul className="text-[10px] text-muted-foreground space-y-1">
              <li>• <span className="text-amber-400 font-medium">NAV erosion (structural):</span> covered calls cap upside; typical 20–60%+ annualized NAV decay — DRIP/reinvestment critical</li>
              <li>• <span className="text-amber-400 font-medium">ROC tax treatment:</span> 98%+ of distributions classified as return of capital — lowers cost basis, defers gains, NOT qualified dividends</li>
              <li>• <span className="text-amber-400 font-medium">Vol dependence:</span> vol crush (BTC calm) → sharp div drops; vol spikes → outsized payouts. Monitor MSTR 30D IV daily</li>
              <li>• <span className="text-amber-400 font-medium">Roll risk:</span> timing slippage reduces effective premium; option-roll gaps can override models</li>
              <li>• <span className="text-amber-400 font-medium">Investor fit:</span> ideal for income-focused + BTC exposure WITHOUT custody. Not for total-return — buy-and-hold MSTR often outperforms on price appreciation alone</li>
              <li>• <span className="text-primary font-medium">Total-return reality:</span> past distributions do not predict future results. Always review the YieldMax prospectus.</li>
            </ul>
          </div>

          <p className="text-[9px] text-muted-foreground/50">Sources: YieldMax prospectus, community backtest data, strategy.com/btc (IV), dripcalc/YMTracker. Last updated: April 18, 2026.</p>
        </div>
      </div>

      {/* Monthly div projection chart moved to Projections tab */}
    </div>
  );
}