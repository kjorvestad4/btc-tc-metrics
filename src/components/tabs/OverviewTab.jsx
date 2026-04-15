import React from "react";
import MetricCard from "../dashboard/MetricCard";
import ProjectionChart from "../dashboard/ProjectionChart";
import { Bitcoin, TrendingUp, Layers, BarChart3, DollarSign, Activity, Percent, Shield } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent, calcMNAV, calcTotalPrefLiquidation, calcTotalAnnualDividend } from "@/lib/calculations";

export default function OverviewTab({ params, preferreds, projections }) {
  const totalPrefLiq = calcTotalPrefLiquidation(preferreds);
  const totalAnnualDiv = calcTotalAnnualDividend(preferreds);
  const mnav = calcMNAV(params.mstr_btc_holdings, params.btc_price, totalPrefLiq, params.mstr_shares_outstanding);
  const premiumToNav = mnav > 0 ? ((params.mstr_price / mnav) - 1) * 100 : 0;
  const btcNav = params.mstr_btc_holdings * params.btc_price;
  const marketCap = params.mstr_price * params.mstr_shares_outstanding * 1e6;

  const y5 = projections.find((p) => p.quarter === 20);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          title="BTC Price"
          value={formatCurrency(params.btc_price)}
          icon={Bitcoin}
          accentClass="text-amber-400"
          subtitle={`${formatNumber(params.mstr_btc_holdings)} BTC held`}
          tooltip="Current Bitcoin price. Strategy holds more BTC than any public company."
        />
        <MetricCard
          title="MSTR Price"
          value={formatCurrency(params.mstr_price)}
          icon={TrendingUp}
          accentClass="text-primary"
          subtitle={`mNAV: ${formatCurrency(mnav)}`}
          trend={premiumToNav}
          trendLabel={`${premiumToNav.toFixed(0)}% premium`}
          tooltip="MSTR trades at a premium to mNAV reflecting the amplification ratio — the market values MSTR as a leveraged BTC vehicle."
        />
        <MetricCard
          title="Amplification"
          value={`${params.amplification_ratio.toFixed(1)}x`}
          icon={Activity}
          accentClass="text-blue-400"
          subtitle={`MCap: ${formatCurrency(marketCap)}`}
          tooltip="Per @PunterJeff: Amplification = Market Cap ÷ BTC NAV. MSTR's 'digital credit' strategy creates reflexive amplification through perpetual preferred issuance."
        />
        <MetricCard
          title="Pref Div Liability"
          value={formatCurrency(totalAnnualDiv)}
          icon={Layers}
          accentClass="text-purple-400"
          subtitle={`${preferreds.length} series outstanding`}
          tooltip="Total annual preferred dividend obligation across STRC/STRF/STRE/STRK/STRD. Perpetual preferreds have no maturity — they act as 'digital credit' funding BTC accumulation."
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          title="BTC NAV"
          value={formatCurrency(btcNav)}
          icon={Shield}
          accentClass="text-amber-400"
          subtitle={`${formatCurrency(btcNav / (params.mstr_shares_outstanding * 1e6))}/share`}
        />
        <MetricCard
          title="mNAV/Share"
          value={formatCurrency(mnav)}
          icon={DollarSign}
          accentClass="text-green-400"
          subtitle="Net of pref liabilities"
          tooltip="mNAV = (BTC Holdings × BTC Price – Pref Liquidation) ÷ Shares Outstanding"
        />
        <MetricCard
          title="MSTY NAV"
          value={formatCurrency(params.msty_nav)}
          icon={BarChart3}
          accentClass="text-cyan-400"
          subtitle={`IV: ${params.mstr_iv}%`}
          tooltip="MSTY (YieldMax MSTR ETF) uses synthetic covered calls on MSTR. NAV tracks MSTR with capped upside and option premium income."
        />
        <MetricCard
          title="5Y MSTR Target"
          value={y5 ? formatCurrency(y5.mstr_price) : "—"}
          icon={Percent}
          accentClass="text-emerald-400"
          subtitle={y5 ? `BTC: ${formatCurrency(y5.btc_price)}` : ""}
          tooltip="Projected MSTR price at year 5 based on current scenario parameters."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProjectionChart
          title="BTC & MSTR Price Projection"
          data={projections.filter((_, i) => i % 2 === 0 || i === projections.length - 1)}
          lines={[
            { key: "btc_price", name: "BTC Price", color: "#F59E0B" },
            { key: "mstr_price", name: "MSTR Price", color: "#22C55E" },
          ]}
        />
        <ProjectionChart
          title="mNAV vs MSTR Price"
          data={projections.filter((_, i) => i % 2 === 0 || i === projections.length - 1)}
          lines={[
            { key: "mnav", name: "mNAV/Share", color: "#3B82F6" },
            { key: "mstr_price", name: "MSTR Price", color: "#22C55E" },
          ]}
        />
      </div>

      <ProjectionChart
        title="Market Cap & BTC NAV Growth"
        data={projections.filter((_, i) => i % 2 === 0 || i === projections.length - 1)}
        lines={[
          { key: "market_cap", name: "Market Cap", color: "#22C55E" },
          { key: "btc_nav", name: "BTC NAV", color: "#F59E0B" },
        ]}
        type="area"
        height={250}
      />
    </div>
  );
}