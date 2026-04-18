import React from "react";
import MetricCard from "../dashboard/MetricCard";
import { Bitcoin, TrendingUp, Layers, DollarSign, Activity, Percent, Shield, BarChart3 } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent, calcMNAV, calcTotalPrefLiquidation, calcTotalAnnualDividend } from "@/lib/calculations";
import { ASST_DEFAULTS } from "./ASSTModelTab";

// SATA static defaults (April 2026)
const SATA_NOTIONAL_M = 310;
const SATA_DIVIDEND_RATE = 13.0; // %
const SATA_ANNUAL_DIV = SATA_NOTIONAL_M * 1e6 * (SATA_DIVIDEND_RATE / 100);

export default function OverviewTab({ params, preferreds, projections, liveData }) {
  // MSTR calcs
  const totalPrefLiq = calcTotalPrefLiquidation(preferreds);
  const totalAnnualDiv = calcTotalAnnualDividend(preferreds);
  const mstrMnav = calcMNAV(params.mstr_btc_holdings, params.btc_price, totalPrefLiq, params.mstr_shares_outstanding);
  const mstrMnavMultiple = mstrMnav > 0 ? params.mstr_price / mstrMnav : 0;

  // MSTR Amplification = (Debt + Pref Notional) ÷ BTC Reserve
  // Approx total debt + pref notional from MSTR balance sheet (~$9.1B pref + notes)
  const mstrDebtPrefNotional = 9_100e6; // ~$9.1B combined
  const mstrBtcNav = params.mstr_btc_holdings * params.btc_price;
  const mstrAmplificationPct = mstrBtcNav > 0 ? (mstrDebtPrefNotional / mstrBtcNav) * 100 : 0;

  // ASST calcs
  const asstPrice = liveData?.asst_price ?? ASST_DEFAULTS.price;
  const asstBtcNav = ASST_DEFAULTS.btc_holdings * params.btc_price;
  const asstMnavPerShare = asstBtcNav / (ASST_DEFAULTS.shares_outstanding_M * 1e6);
  const asstMnavMultiple = asstMnavPerShare > 0 ? asstPrice / asstMnavPerShare : 0;
  const asstAmplificationPct = asstBtcNav > 0 ? (ASST_DEFAULTS.sata_notional_M * 1e6 / asstBtcNav) * 100 : 0;

  // Prices
  const strcPrice = liveData?.strc_price ?? null;
  const sataPrice = liveData?.sata_price ?? null;
  const mstyPrice = liveData?.msty_price ?? null;

  return (
    <div className="space-y-4">
      {/* Row 1: Prices */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          title="BTC Price"
          value={formatCurrency(params.btc_price)}
          icon={Bitcoin}
          accentClass="text-amber-400"
          subtitle={`${formatNumber(params.mstr_btc_holdings)} BTC held`}
        />
        <MetricCard
          title="MSTR Share Price"
          value={formatCurrency(params.mstr_price, 2)}
          icon={TrendingUp}
          accentClass="text-primary"
          subtitle={liveData?.mstr_price ? "Live" : "Param"}
        />
        <MetricCard
          title="ASST Share Price"
          value={formatCurrency(asstPrice, 2)}
          icon={DollarSign}
          accentClass="text-blue-400"
          subtitle={liveData?.asst_price ? "Live" : "Default"}
        />
        <MetricCard
          title="STRC Share Price"
          value={strcPrice ? formatCurrency(strcPrice, 2) : "—"}
          icon={Layers}
          accentClass="text-purple-400"
          subtitle={strcPrice ? "Live" : "No Polygon key"}
        />
        <MetricCard
          title="SATA Share Price"
          value={sataPrice ? formatCurrency(sataPrice, 2) : "$99.45"}
          icon={Layers}
          accentClass="text-violet-400"
          subtitle={sataPrice ? "Live" : "Default"}
        />
        <MetricCard
          title="MSTY Share Price"
          value={mstyPrice ? formatCurrency(mstyPrice, 2) : formatCurrency(params.msty_nav, 2)}
          icon={BarChart3}
          accentClass="text-cyan-400"
          subtitle={mstyPrice ? "Live" : "Default"}
        />
      </div>

      {/* Row 2: Amplification */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
        <MetricCard
          title="MSTR Amplification"
          value={`${mstrAmplificationPct.toFixed(1)}%`}
          icon={Activity}
          accentClass="text-primary"
          subtitle="(Debt + Pref) ÷ BTC Reserve"
          tooltip="MSTR Amplification = (Total Debt + Preferred Notional) ÷ BTC Reserve Value. Measures how much fixed-cost leverage rides on the BTC treasury. ~22% means $1 of debt/pref per ~$4.5 of BTC held."
        />
        <MetricCard
          title="ASST Amplification"
          value={`${asstAmplificationPct.toFixed(1)}%`}
          icon={Activity}
          accentClass="text-blue-400"
          subtitle="SATA Notional ÷ BTC Reserve"
          tooltip="ASST Amplification = SATA Preferred Notional ÷ BTC Reserve Value. Strive's equivalent of MSTR's amplification — measures the preferred-funded leverage on ASST's Bitcoin treasury."
        />
      </div>

      {/* Row 3: mNAV Multiples */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
        <MetricCard
          title="MSTR mNAV Multiple"
          value={`${mstrMnavMultiple.toFixed(2)}x`}
          icon={Shield}
          accentClass="text-green-400"
          subtitle="Share price ÷ BTC NAV/share"
          tooltip="MSTR mNAV Multiple = MSTR Price ÷ mNAV per share. 1.0x = trading at BTC NAV. >1x = market premium over raw Bitcoin value, reflecting the capital-markets flywheel."
        />
        <MetricCard
          title="ASST mNAV Multiple"
          value={`${asstMnavMultiple.toFixed(2)}x`}
          icon={Shield}
          accentClass="text-blue-400"
          subtitle="Share price ÷ BTC NAV/share"
          tooltip="ASST mNAV Multiple = ASST Price ÷ (BTC Reserve ÷ Shares Outstanding). Equivalent metric to MSTR's mNAV multiple for comparing relative premium-to-NAV."
        />
      </div>

      {/* Row 4: Dividend Liabilities */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
        <MetricCard
          title="MSTR Pref Div Liability"
          value={formatCurrency(totalAnnualDiv)}
          icon={Percent}
          accentClass="text-purple-400"
          subtitle={`${preferreds.length} preferred series`}
          tooltip="Total annual preferred dividend obligation across Strategy's perpetual preferred series (STRC, STRF, STRE, STRK, STRD). No maturity = permanent carry cost."
        />
        <MetricCard
          title="SATA Div Liability"
          value={formatCurrency(SATA_ANNUAL_DIV)}
          icon={Percent}
          accentClass="text-violet-400"
          subtitle={`$${SATA_NOTIONAL_M}M notional @ ${SATA_DIVIDEND_RATE}%`}
          tooltip="Annual dividend liability from Strive's SATA perpetual preferred program. Variable rate (~13%). Funded by BTC reserve growth — profitable if BTC CAGR > 13%."
        />
      </div>
    </div>
  );
}