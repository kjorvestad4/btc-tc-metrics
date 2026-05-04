import React from "react";
import MetricCard from "../dashboard/MetricCard";
import ATMMonitorPanel from "./ATMMonitorPanel";
import { Bitcoin, TrendingUp, Layers, DollarSign, Activity, Percent, Shield, BarChart3 } from "lucide-react";
import { formatCurrency, formatNumber, calcTotalPrefLiquidation, calcTotalAnnualDividend } from "@/lib/calculations";
import { ASST_DEFAULTS } from "./ASSTModelTab";

// Official Strategy.com figures (May 4 2026) — from strategy.com/credit
const MSTR_DEBT_M = 8214;       // $8,214M total debt (strategy.com/credit, May 4 2026)
const MSTR_PREF_M = 13536;      // $13,536M preferred notional (STRF+STRC+STRE+STRK+STRD)
const MSTR_DEBT_PREF_M = MSTR_DEBT_M + MSTR_PREF_M; // $21,750M total
const MSTR_CASH_M = 2250;       // $2,250M USD Reserve (strategy.com/credit, May 4 2026)

// SATA static defaults (May 2026) — from treasury.strive.com credit tab
const SATA_NOTIONAL_M = 495.95;
const SATA_DIVIDEND_RATE = 13.0;
const SATA_ANNUAL_DIV = SATA_NOTIONAL_M * 1e6 * (SATA_DIVIDEND_RATE / 100);

export default function OverviewTab({ params, preferreds, projections, liveData, onRefresh, refreshing }) {
  // Prices — prefer liveData, fall back to params (declared first so calcs below can use them)
  const btcPrice = liveData?.btc_price ?? params.btc_price;
  const mstrPrice = liveData?.mstr_price ?? params.mstr_price;

  // MSTR calcs — using official balance sheet figures
  const totalPrefLiq = calcTotalPrefLiquidation(preferreds);
  const totalAnnualDiv = calcTotalAnnualDividend(preferreds);
  const mstrBtcNav = params.mstr_btc_holdings * btcPrice;

  // mNAV = EV ÷ BTC Reserve (strategy.com/learn definition)
  // EV = Market Cap + Debt + Pref − Cash
  const mstrMarketCap = mstrPrice * params.mstr_shares_outstanding * 1e6;
  const mstrEV = mstrMarketCap + (MSTR_DEBT_PREF_M - MSTR_CASH_M) * 1e6;
  const mstrMnav = mstrBtcNav > 0 ? mstrEV / mstrBtcNav : 0;

  // Amplification = (Debt + Pref) ÷ BTC Reserve — official formula
  const mstrAmplificationPct = mstrBtcNav > 0 ? (MSTR_DEBT_PREF_M * 1e6 / mstrBtcNav) * 100 : 0;

  // ASST calcs — from official treasury.strive.com data (May 4 2026)
  // EV mNAV = EV ÷ BTC NAV  (matches treasury.strive.com navPremium chart: 1.29x)
  // EV = Market Cap + Total Debt + Total Preferred (no cash deduction per strive definition)
  const asstPrice = liveData?.asst_price ?? ASST_DEFAULTS.price;
  const asstBtcNav = ASST_DEFAULTS.btc_holdings * btcPrice;
  const asstMarketCap = asstPrice * ASST_DEFAULTS.shares_outstanding_M * 1e6;
  const asstEV = asstMarketCap + ASST_DEFAULTS.total_debt_pref_M * 1e6;
  const asstMnav = asstBtcNav > 0 ? asstEV / asstBtcNav : 0;
  // Amplification = Total Debt+Pref ÷ BTC Reserve — official shows 42.2%
  const asstAmplificationPct = asstBtcNav > 0 ? (ASST_DEFAULTS.total_debt_pref_M * 1e6 / asstBtcNav) * 100 : 0;
  const asstPriceDisplay = asstPrice;
  const strcPrice = liveData?.strc_price ?? liveData?.strc_data?.price ?? params.strc_price ?? 99.21;
  const sataPrice = liveData?.sata_price ?? params.sata_price ?? 99.45;
  const mstyPrice = liveData?.msty_price ?? params.msty_nav;

  return (
    <div className="space-y-4">
      {/* Row 1: Prices */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          title="BTC Price"
          value={formatCurrency(btcPrice)}
          icon={Bitcoin}
          accentClass="text-amber-400"
          subtitle={liveData?.btc_price ? "Live" : "Loading..."}
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
          tooltip={`Amplification = (Debt $${MSTR_DEBT_M.toLocaleString()}M + Pref $${MSTR_PREF_M.toLocaleString()}M) ÷ BTC Reserve. Total Debt+Pref = $${MSTR_DEBT_PREF_M.toLocaleString()}M per strategy.com/credit (May 4 2026). Updates live with BTC price — higher BTC = lower amplification.`}
        />
        <MetricCard
          title="ASST Amplification"
          value={`${asstAmplificationPct.toFixed(1)}%`}
          icon={Activity}
          accentClass="text-blue-400"
          subtitle={`Total Debt+Pref $${ASST_DEFAULTS.total_debt_pref_M}M`}
          tooltip={`ASST Amplification = (Debt $${ASST_DEFAULTS.debt_M}M + SATA Pref $${ASST_DEFAULTS.sata_notional_M}M) ÷ BTC Reserve (${ASST_DEFAULTS.btc_holdings.toLocaleString()} BTC × live price). treasury.strive.com credit tab shows ${ASST_DEFAULTS.amplification_pct}% as of May 4 2026. Updates live with BTC price — higher BTC = lower amplification.`}
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
          tooltip={`mNAV = Enterprise Value ÷ BTC Reserve. EV = Market Cap + Debt ($${MSTR_DEBT_M.toLocaleString()}M) + Pref ($${MSTR_PREF_M.toLocaleString()}M) − Cash ($${MSTR_CASH_M.toLocaleString()}M). Source: strategy.com/learn & strategy.com/credit (May 4 2026). Updates live with BTC price and MSTR share price.`}
        />
        <MetricCard
          title="ASST mNAV"
          value={`${asstMnav.toFixed(2)}x`}
          icon={Shield}
          accentClass="text-blue-400"
          subtitle="EV ÷ BTC Reserve"
          tooltip={`ASST EV mNAV = EV ÷ BTC NAV. EV = Market Cap + Debt ($${ASST_DEFAULTS.debt_M}M) + Pref ($${ASST_DEFAULTS.sata_notional_M}M). Source: treasury.strive.com/navPremium (shows 1.29x as of May 4 2026). Updates live with BTC price and ASST share price.`}
        />
      </div>

      {/* Row 4: Dividend Liabilities */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="MSTR Pref Div Liability"
          value="$1,481M"
          icon={Percent}
          accentClass="text-purple-400"
          subtitle="strategy.com/credit annual dividends"
          tooltip="Total annual preferred dividend obligation: $1,481M — source: strategy.com/credit (May 4 2026). STRC $8,537M×11.5% + STRF $1,284M×10% + STRK $1,402M×8% + STRE $911M×13% + STRD $1,402M×10%."
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