import React from "react";
import MetricCard from "../dashboard/MetricCard";
import ATMMonitorPanel from "./ATMMonitorPanel";
import { Bitcoin, TrendingUp, Layers, DollarSign, Activity, Percent, Shield, BarChart3 } from "lucide-react";
import { formatCurrency, formatNumber, calcTotalPrefLiquidation, calcTotalAnnualDividend } from "@/lib/calculations";
import { ASST_DEFAULTS } from "./ASSTModelTab";

// Official Strategy.com figures (Apr 17 2026)
const MSTR_DEBT_M = 8254;       // $8,254M debt
const MSTR_PREF_M = 11355;      // $11,355M preferred notional
const MSTR_DEBT_PREF_M = MSTR_DEBT_M + MSTR_PREF_M; // $19,609M

// SATA static defaults (Apr 2026)
const SATA_NOTIONAL_M = 437.32;
const SATA_DIVIDEND_RATE = 13.0;
const SATA_ANNUAL_DIV = SATA_NOTIONAL_M * 1e6 * (SATA_DIVIDEND_RATE / 100);

export default function OverviewTab({ params, preferreds, projections, liveData, onRefresh, refreshing }) {
  // MSTR calcs — using official balance sheet figures
  const totalPrefLiq = calcTotalPrefLiquidation(preferreds);
  const totalAnnualDiv = calcTotalAnnualDividend(preferreds);
  const mstrBtcNav = params.mstr_btc_holdings * params.btc_price;

  // mNAV = EV ÷ BTC Reserve (official definition, e.g. strategy.com shows 1.25x)
  // EV = Market Cap + Debt + Pref
  const mstrMarketCap = params.mstr_price * params.mstr_shares_outstanding * 1e6;
  const mstrEV = mstrMarketCap + MSTR_DEBT_PREF_M * 1e6;
  const mstrMnav = mstrBtcNav > 0 ? mstrEV / mstrBtcNav : 0;

  // Amplification = (Debt + Pref) ÷ BTC Reserve — official formula, strategy.com shows 33%
  const mstrAmplificationPct = mstrBtcNav > 0 ? (MSTR_DEBT_PREF_M * 1e6 / mstrBtcNav) * 100 : 0;

  // ASST calcs — from official treasury.strive.com data
  const asstPrice = liveData?.asst_price ?? ASST_DEFAULTS.price;
  const asstBtcNav = ASST_DEFAULTS.btc_holdings * params.btc_price;
  // EV = Market Cap + Debt + Pref
  const asstMarketCap = asstPrice * ASST_DEFAULTS.shares_outstanding_M * 1e6;
  const asstEV = asstMarketCap + ASST_DEFAULTS.total_debt_pref_M * 1e6;
  const asstMnav = asstBtcNav > 0 ? asstEV / asstBtcNav : 0;
  // Amplification = Total Debt+Pref ÷ BTC Reserve — official shows 42.2%
  const asstAmplificationPct = asstBtcNav > 0 ? (ASST_DEFAULTS.total_debt_pref_M * 1e6 / asstBtcNav) * 100 : 0;

  // Prices — prefer liveData, fall back to params (which also gets updated by Dashboard on refresh)
  const mstrPrice = liveData?.mstr_price ?? params.mstr_price;
  const asstPriceDisplay = liveData?.asst_price ?? asstPrice;
  const strcPrice = liveData?.strc_price ?? liveData?.strc_data?.price ?? params.strc_price ?? 99.21;
  const sataPrice = liveData?.sata_price ?? params.sata_price ?? 99.45;
  const mstyPrice = liveData?.msty_price ?? params.msty_nav;

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
          value={formatCurrency(mstrPrice, 2)}
          icon={TrendingUp}
          accentClass="text-primary"
          subtitle={liveData?.mstr_price ? "Live" : "Loading..."}
        />
        <MetricCard
          title="ASST Share Price"
          value={formatCurrency(asstPriceDisplay, 2)}
          icon={DollarSign}
          accentClass="text-blue-400"
          subtitle={liveData?.asst_price ? "Live" : "Loading..."}
        />
        <MetricCard
          title="STRC Share Price"
          value={formatCurrency(strcPrice, 2)}
          icon={Layers}
          accentClass="text-purple-400"
          subtitle={liveData?.strc_price ? "Live" : "Loading..."}
        />
        <MetricCard
          title="SATA Share Price"
          value={formatCurrency(sataPrice, 2)}
          icon={Layers}
          accentClass="text-violet-400"
          subtitle={liveData?.sata_price ? "Live" : "Loading..."}
        />
        <MetricCard
          title="MSTY Share Price"
          value={formatCurrency(mstyPrice, 2)}
          icon={BarChart3}
          accentClass="text-cyan-400"
          subtitle={liveData?.msty_price ? "Live" : "Loading..."}
        />
      </div>

      {/* Row 2: Amplification */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="MSTR Amplification"
          value={`${mstrAmplificationPct.toFixed(1)}%`}
          icon={Activity}
          accentClass="text-primary"
          subtitle={`Debt $${MSTR_DEBT_M.toLocaleString()}M + Pref $${MSTR_PREF_M.toLocaleString()}M`}
          tooltip={`Amplification = (Debt $${MSTR_DEBT_M.toLocaleString()}M + Pref $${MSTR_PREF_M.toLocaleString()}M) ÷ BTC Reserve. Official strategy.com shows 33% at BTC ~$77K. Updates dynamically with BTC price. Lower BTC = higher amplification.`}
        />
        <MetricCard
          title="ASST Amplification"
          value={`${asstAmplificationPct.toFixed(1)}%`}
          icon={Activity}
          accentClass="text-blue-400"
          subtitle={`Total Debt+Pref $${ASST_DEFAULTS.total_debt_pref_M}M`}
          tooltip={`ASST Amplification = Total Debt+Pref ($${ASST_DEFAULTS.total_debt_pref_M}M) ÷ BTC Reserve. Official treasury.strive.com shows 42.2% at BTC ~$77K. Updates dynamically with BTC price.`}
        />
      </div>

      {/* Row 3: mNAVs */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="MSTR mNAV"
          value={`${mstrMnav.toFixed(2)}x`}
          icon={Shield}
          accentClass="text-green-400"
          subtitle="EV ÷ BTC Reserve"
          tooltip="mNAV = Enterprise Value ÷ BTC Reserve. EV = Market Cap + Debt + Preferred Notional. strategy.com shows 1.25x at Apr 17 2026 prices."
        />
        <MetricCard
          title="ASST mNAV"
          value={`${asstMnav.toFixed(2)}x`}
          icon={Shield}
          accentClass="text-blue-400"
          subtitle="EV ÷ BTC Reserve"
          tooltip="mNAV = Enterprise Value ÷ BTC Reserve. EV = Market Cap + Debt + Preferred. treasury.strive.com shows 1.32x at Apr 17 2026 prices."
        />
      </div>

      {/* Row 4: Dividend Liabilities */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="MSTR Pref Div Liability"
          value="$1,237M"
          icon={Percent}
          accentClass="text-purple-400"
          subtitle="official strategy.com annual dividends"
          tooltip="Total annual preferred dividend obligation: $1,237M — source: strategy.com. Includes STRC, STRF, STRK, STRE, STRD."
        />
        <MetricCard
          title="SATA Div Liability (ASST)"
          value={formatCurrency(SATA_ANNUAL_DIV)}
          icon={Percent}
          accentClass="text-violet-400"
          subtitle={`$${SATA_NOTIONAL_M}M notional @ ${SATA_DIVIDEND_RATE}%`}
          tooltip={`Annual dividend liability from Strive's SATA preferred program. $${SATA_NOTIONAL_M}M × ${SATA_DIVIDEND_RATE}% = $${(SATA_ANNUAL_DIV / 1e6).toFixed(2)}M/yr. Profitable if BTC CAGR > ${SATA_DIVIDEND_RATE}%.`}
        />
      </div>

      {/* ATM Monitor Panel */}
      <ATMMonitorPanel liveData={liveData} />
    </div>
  );
}