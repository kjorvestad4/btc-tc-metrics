import React, { useState } from "react";
import MetricCard from "../dashboard/MetricCard";
import { Bitcoin, TrendingUp, Layers, DollarSign, Activity, Percent, Shield, BarChart3, Key, Eye, EyeOff, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber, formatPercent, calcMNAV, calcTotalPrefLiquidation, calcTotalAnnualDividend } from "@/lib/calculations";
import { ASST_DEFAULTS } from "./ASSTModelTab";

// Official Strategy.com figures (Apr 17 2026)
const MSTR_DEBT_M = 8254;       // $8,254M debt
const MSTR_PREF_M = 11355;      // $11,355M preferred notional
const MSTR_DEBT_PREF_M = MSTR_DEBT_M + MSTR_PREF_M; // $19,609M

// SATA static defaults (Apr 2026)
const SATA_NOTIONAL_M = 437.32;
const SATA_DIVIDEND_RATE = 13.0;
const SATA_ANNUAL_DIV = SATA_NOTIONAL_M * 1e6 * (SATA_DIVIDEND_RATE / 100);

export default function OverviewTab({ params, preferreds, projections, liveData, polygonKey, onPolygonKeyChange, onRefresh, refreshing }) {
  const [showKey, setShowKey] = useState(false);

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

  // Prices
  const strcPrice = liveData?.strc_price ?? liveData?.strc_data?.price ?? 99.21; // fallback to last known static price
  const sataPrice = liveData?.sata_price ?? 99.45;
  const mstyPrice = liveData?.msty_price ?? params.msty_nav;

  const hasPolygonKey = !!(polygonKey && polygonKey.trim().length > 0);

  return (
    <div className="space-y-4">
      {/* Polygon API Key Banner */}
      <div className={`rounded-xl border p-3 flex flex-wrap items-center gap-3 ${hasPolygonKey ? "bg-primary/5 border-primary/20" : "bg-amber-500/5 border-amber-500/20"}`}>
        <Key className={`w-4 h-4 shrink-0 ${hasPolygonKey ? "text-primary" : "text-amber-400"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">
            {hasPolygonKey ? "Polygon.io connected — live stock prices active" : "Add Polygon.io API key for live stock prices"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {hasPolygonKey ? "MSTR, ASST, STRC, SATA, MSTY prices pulled from Polygon on Refresh" : "Free key at polygon.io — unlocks live MSTR, ASST, STRC, SATA, MSTY prices & IV"}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Input
              type={showKey ? "text" : "password"}
              value={polygonKey}
              onChange={(e) => onPolygonKeyChange(e.target.value)}
              placeholder="Paste Polygon API key…"
              className="h-8 text-xs pr-8 bg-secondary border-border font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 shrink-0"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Fetching…" : "Refresh Live"}
          </Button>
        </div>
      </div>

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
          value={formatCurrency(strcPrice, 2)}
          icon={Layers}
          accentClass="text-purple-400"
          subtitle={liveData?.strc_price ?? liveData?.strc_data?.price ? "Live" : "Static default"}
        />
        <MetricCard
          title="SATA Share Price"
          value={formatCurrency(sataPrice, 2)}
          icon={Layers}
          accentClass="text-violet-400"
          subtitle={liveData?.sata_price ? "Live" : "Default"}
        />
        <MetricCard
          title="MSTY Share Price"
          value={formatCurrency(mstyPrice, 2)}
          icon={BarChart3}
          accentClass="text-cyan-400"
          subtitle={liveData?.msty_price ? "Live" : "Default"}
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
          value={formatCurrency(totalAnnualDiv)}
          icon={Percent}
          accentClass="text-purple-400"
          subtitle={`${preferreds.length} preferred series`}
          tooltip="Total annual preferred dividend obligation across Strategy's perpetual preferred series. Official strategy.com shows $1,237M annual dividends."
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
    </div>
  );
}