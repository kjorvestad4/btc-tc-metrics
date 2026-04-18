import React, { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Info, RefreshCw, Bitcoin, TrendingUp, Layers, DollarSign, Zap, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/calculations";

// Official data from strategy.com (April 17-18, 2026)
// Basic Shares: 346,823K = 346.8M (Class A 327,183K + Class B 19,640K)
// Assumed Diluted Shares: 379,423K = 379.4M
// Total Debt: $8,214M (converts). Total Pref: $11,355M. Total Debt+Pref: $19,568M
// Cash: $2,250M. BTC Holdings: 780,897. BTC Yield QTD: 2.3%, YTD: 5.6%
// BTC Gain QTD: 17,585 BTC. BTC $ Gain QTD: $1,333M
// Annual dividends: $1,237M (official strategy.com). Net Leverage: ~10%
// Acquisition velocity: 7,403 BTC/wk pace, lifetime monthly avg 11,472 BTC/mo

const OFFICIAL_MSTR_DATA = {
  basic_shares_M: 346.8,           // Class A 327.2M + Class B 19.6M
  diluted_shares_M: 379.4,         // Assumed Diluted (fully loaded, no treasury method)
  total_debt_M: 8214,              // Convertible notes principal
  total_pref_M: 11355,             // Official preferred notional
  total_debt_pref_M: 19568,        // Total Debt + Pref
  cash_M: 2250,                    // USD cash reserve
  btc_holdings: 780897,
  btc_yield_ytd: 5.6,
  btc_yield_qtd: 2.3,
  btc_gain_qtd: 17585,
  btc_dollar_gain_qtd_M: 1333,
  annual_dividends_M: 1237,        // Official strategy.com annual dividends
  acquisition_weekly_pace: 7403,   // 2026 weekly pace (tnorth.com)
  acquisition_monthly_avg: 11472,  // Lifetime monthly avg (tnorth.com)
  bps_sats: 205812,                // Official BPS in satoshis
};

// Official Strategy.com metric definitions — verbatim/near-verbatim from strategy.com/notes, /btc, /credit
const STRATEGY_DEFINITIONS = {
  mnav: {
    short: "Multiple of Net Asset Value — market cap ÷ Bitcoin NAV",
    full: `mNAV is the multiple of the BTC Reserve, as of the specified date, calculated as the Company's enterprise value (as we define it) divided by the BTC Reserve.

Enterprise Value here = Market Capitalization of common stock + total liquidation preference of all outstanding preferred stock + total principal of all outstanding convertible notes − unrestricted cash and cash equivalents.

mNAV is NOT calculated using the traditional net asset value methodology, which would subtract all liabilities. It is a Bitcoin-specific multiple measuring how much the market values Strategy above (or below) its raw BTC reserve. When mNAV > 1.0x, the market ascribes value beyond just the Bitcoin — including the capital-markets flywheel, brand, software business, and the reflexive ATM + accumulation engine. Strategy's ability to issue equity and preferred at mNAV > 1.0 is the core mechanism by which BTC Yield is generated.

As of April 2026 (April 14): mNAV ≈ 1.15x.

Source: strategy.com/notes — "mNAV Definition"`,
  },
  bps: {
    short: "Bitcoin Per Share in Satoshis — BTC holdings ÷ assumed diluted shares × 1e8",
    full: `Bitcoin Per Share (in Sats), or BPS, is a KPI that represents the ratio between the Company's bitcoin holdings and Assumed Diluted Shares Outstanding, expressed in terms of Satoshi (or Sats), where:

BPS = (Bitcoin Holdings ÷ Assumed Diluted Shares Outstanding) × 100,000,000

A "Satoshi" or a "Sat" is one one-hundred-millionth of one bitcoin (0.00000001 BTC). We present BPS in Satoshis rather than fractional bitcoins for clarity — it avoids very small decimal numbers while conveying the same information.

BPS is designed to show whether each share is accumulating more Bitcoin over time, net of all share issuances. It is the primary per-share accumulation metric. Rising BPS means shareholders are getting more Bitcoin exposure per share despite ongoing dilution.

As of April 2026: BPS ≈ 205,812 sats per diluted share.

Source: strategy.com/btc — "Bitcoin Per Share (Satoshis)"`,
  },
  assumedDilutedShares: {
    short: "Fully-loaded diluted share count used for BPS calculations",
    full: `Assumed Diluted Shares Outstanding = the number of shares of the Company's common stock outstanding, plus the maximum number of shares of the Company's common stock issuable upon the conversion of all of the Company's outstanding convertible notes (using the principal amount of such convertible notes divided by the conversion price for each series), plus the maximum number of shares of the Company's common stock issuable upon the conversion of all of the Company's outstanding preferred stock (using the liquidation preference of such preferred stock divided by the conversion price for each series, and without giving effect to any beneficial ownership limitations), in each case as of the specified date.

IMPORTANT: Unlike standard "diluted" EPS computations under GAAP, Assumed Diluted Shares Outstanding is NOT calculated using the treasury method or any in-the-money test. It is a fully-loaded worst-case dilution number, providing a conservative baseline for BPS calculations.

This is a non-GAAP measure. We believe it provides a more comprehensive picture of potential dilution than the treasury-method diluted share count used in EPS calculations.

Source: strategy.com/notes — "Assumed Diluted Shares Outstanding Definition"`,
  },
  basicShares: {
    short: "Common shares outstanding — basic, non-diluted",
    full: `Basic Shares Outstanding = the total number of shares of the Company's Class A and Class B common stock outstanding as of the specified date, as reported in our most recent 10-K or 10-Q filing.

This is the standard GAAP share count, excluding any potential conversions of convertible notes, preferred stock, or unexercised options. It differs from Assumed Diluted Shares Outstanding primarily by the exclusion of shares issuable upon potential conversions.

Basic Shares Outstanding as of April 2026: approximately 220M shares.

Source: strategy.com SEC filings — 10-K Item 5, 10-Q Cover Page.`,
  },
  btcYield: {
    short: "% change in BPS period-over-period — Bitcoin accumulation efficiency",
    full: `BTC Yield is a KPI that represents the percentage change in BPS from the beginning of a period to the end of a period.

BTC Yield = (Period-End BPS − Period-Start BPS) ÷ Period-Start BPS × 100%

BTC Yield measures whether the Company's Bitcoin accumulation activities are outpacing the dilutive effects of share issuances. A positive BTC Yield for a period means each share's claim on Bitcoin grew during that period, net of all dilution. This is the primary performance metric of the treasury strategy.

IMPORTANT: BTC Yield is NOT an interest yield, dividend yield, or any conventional investment return. It does not represent income received by shareholders. It is purely a per-share Bitcoin accumulation metric. Investors should not equate a positive BTC Yield with investment returns.

Strategy's 2025 annual BTC Yield target: 15%. 2024 actual: approximately 74.3%.

Source: strategy.com/btc — "BTC Yield KPI" and 2024 Annual Report press release.`,
  },
  btcGain: {
    short: "Number of BTC added per diluted share × total diluted shares",
    full: `BTC Gain is a KPI that represents the number of bitcoins held by the Company at the beginning of a period multiplied by the BTC Yield for such period.

BTC Gain = Beginning BTC Holdings × BTC Yield for the period

This represents the absolute increase in Bitcoin holdings that is attributable to the accretion in BPS (i.e., the BTC that was "earned" on a per-share basis over and above dilution). It is the bitcoin equivalent of the BTC $ Gain.

Source: strategy.com/btc — "BTC Gain KPI Definition"`,
  },
  btcDollarGain: {
    short: "BTC Gain × BTC price at period end — dollar value of Bitcoin accretion",
    full: `BTC $ Gain is a KPI that represents the BTC Gain for such period multiplied by the price of bitcoin as of the last business day of such period, as reported by Coinbase at 4:00 p.m. Eastern Time.

BTC $ Gain = BTC Gain × Period-End BTC Price (Coinbase 4:00pm ET)

This metric translates the per-share Bitcoin accumulation into US dollar terms for investors who think in USD terms. It reflects the dollar value of the Bitcoin we believe was earned through accretive issuances during the period.

Note: BTC prices referenced use Coinbase's 4:00 p.m. ET spot price as the authoritative source. This price may differ from other exchange prices or market indices.

Source: strategy.com/btc — "BTC $ Gain KPI Definition"`,
  },
  btcReserve: {
    short: "Total USD value of all BTC holdings — primary balance sheet asset",
    full: `BTC Reserve = Total Bitcoin Holdings × Current BTC Price.

As of April 14, 2026: BTC Reserve = 780,897 BTC × ~$74,974/BTC ≈ $58,572M.

Under FASB ASC 350-60 (effective January 1, 2025), Strategy now accounts for its Bitcoin holdings at fair value on a mark-to-market basis each quarter. Prior to this rule change, Bitcoin was held at cost less impairments under ASC 350-30. The new fair value accounting means unrealized gains and losses flow through the income statement.

Strategy's BTC Reserve is the largest corporate Bitcoin holding globally. Unlike gold or traditional reserves, Bitcoin is digitally native, infinitely divisible, and can be pledged as collateral, lent, or deployed into yield-generating structures.

Source: strategy.com/btc — "Bitcoin Reserve" + FASB ASC 350-60 fair value disclosures.`,
  },
  amplification: {
    short: "(Total Debt + Preferred Notional) ÷ BTC Reserve — fixed-cost leverage on Bitcoin",
    full: `Amplification = (Total Debt + Preferred Notional) ÷ BTC Reserve.

This is the ratio of Strategy's total fixed-cost obligations (convertible notes + all preferred stock liquidation preference) to the current value of its Bitcoin reserve. It measures how much financial leverage the capital structure has against the BTC holdings.

As of April 2026 (est.):
• Total Debt (converts): ~$3.7B
• Preferred Notional: ~$9.16B
• Total fixed obligations: ~$12.86B
• BTC Reserve: ~$58.6B
• Amplification ≈ 21.9% (~0.22x)

A lower Amplification ratio means the fixed obligations are a smaller fraction of the BTC reserve — the balance sheet is less leveraged and more resilient to BTC price drawdowns. As BTC rises and the reserve grows faster than new issuances, Amplification compresses (improving). As Strategy issues more preferred or converts, Amplification rises.

PunterJeff context: This is distinct from the mNAV multiple. Amplification measures the leverage of the fixed-cost capital on top of BTC — not the market premium. The "digital credit flywheel" works when BTC appreciation rate > weighted avg cost of fixed obligations (~10–13% blended rate).

Source: strategy.com/btc, /credit — Amplification metric definition.`,
  },
  enterpriseValue: {
    short: "Market cap + preferred + converts − cash — full capital stack value",
    full: `Enterprise Value (as defined by Strategy) = Market Capitalization of common stock + Total liquidation preference of all outstanding preferred stock + Total principal amount of all outstanding convertible notes − Unrestricted cash and cash equivalents.

This definition differs from traditional EV (which uses book debt not par value of converts). Strategy's EV formula is designed to capture the full senior claim on the company's assets from both debt-holders and preferred-holders relative to the Bitcoin reserve.

Key components (April 2026 est.):
• Common equity market cap: ~$58B
• Preferred notional: ~$9.1B (STRF, STRK, STRC, STRE, STRD)
• Convertible notes: ~$3.7B
• Less cash: ~$700M
• Enterprise Value: ~$70B
• EV ÷ BTC Reserve: ~1.15x (= mNAV)

Source: strategy.com/notes — "Enterprise Value" definition and 10-Q balance sheet.`,
  },
  preferredNotional: {
    short: "Total face value of all perpetual preferred series outstanding",
    full: `Preferred Notional = Sum of (liquidation preference per share × shares outstanding) across all outstanding preferred series.

As of April 2026, Strategy's perpetual preferred program comprises five active series:
• STRF: 10% fixed rate, quarterly, ~$3.45B notional
• STRK: 8% fixed rate, quarterly convertible, ~$2.1B notional
• STRC: 10% semi-annual, convertible, ~$1.5B notional
• STRE: 13% BTC-denominated, monthly, ~$1.21B notional
• STRD: 11% BTC-denominated, quarterly convertible, ~$900M notional

Total: ~$9.16B notional (≈ $11.355B per official April 2026 site disclosure).

Strategy's perpetual preferred program is described as "digital credit" — permanent capital with no maturity date. Dividends are paid in cash or BTC (depending on the series), and proceeds are deployed entirely into Bitcoin. The program creates fixed-cost financial leverage without the refinancing risk of traditional debt. The positive carry trade works while BTC CAGR > weighted avg dividend rate (~10.3%).

Source: strategy.com/credit — "Preferred Stock Capital Program"`,
  },
  dilutedShares: {
    short: "Fully-diluted share count for BPS — includes converts and preferred conversions",
    full: `Assumed Diluted Shares Outstanding is NOT calculated using the treasury method. It equals:
  Common shares + Max shares from convertible note conversions + Max shares from preferred conversions

This worst-case dilution assumption means BPS is always conservative — it understates the per-share BTC claim of current common shareholders who may never see full conversion. Strategy uses this conservative definition intentionally, to ensure BTC Yield is not inflated by understating dilution.

ATM Effect: Strategy's ongoing ATM (At-The-Market) equity and STRC programs continuously increase shares outstanding. The intent is that each share issuance (at mNAV > 1.0) is accretive to BPS — the proceeds buy more BTC than the dilution reduces BPS. When this works (positive BTC Yield), the flywheel accelerates.

Estimated diluted shares as of April 2026: ~259M (220M basic + ~39M from converts and preferred).

Source: strategy.com/notes — "Assumed Diluted Shares Outstanding" + 10-K Note on EPS.`,
  },
  btcRating: {
    short: "Strategy's self-assessed creditworthiness relative to BTC reserve coverage",
    full: `BTC Rating = a qualitative and quantitative framework developed by Strategy to assess its own balance sheet strength, measured primarily by:
  • BTC Coverage Ratio = BTC Reserve ÷ Total Fixed Obligations (preferred + converts)
  • Net BTC Leverage = (Fixed Obligations − Cash) ÷ BTC Reserve

As of April 2026: Net Leverage ≈ 10%, Coverage Ratio ≈ 9.5x. Strategy presents this as evidence of a strong "BTC credit" profile — the Bitcoin reserve dramatically exceeds all fixed obligations.

The concept is analogous to a credit rating but denominated in Bitcoin rather than fiat. A higher BTC Coverage Ratio is better. Strategy targets maintaining Net Leverage below 20% to preserve financial resilience through BTC drawdowns.

Source: strategy.com/credit — "BTC Rating Framework"`,
  },
  netLeverage: {
    short: "Fixed obligations net of cash ÷ BTC Reserve — balance sheet risk gauge",
    full: `Net Leverage = (Total Preferred Notional + Total Convertible Note Principal − Cash & Equivalents) ÷ BTC Reserve.

As of April 2026 (est.): Net Leverage = ($9.16B preferred + $3.7B converts − $0.7B cash) ÷ $58.5B BTC Reserve ≈ 10%.

A Net Leverage of 10% means Strategy's fixed obligations are only 10% of its Bitcoin reserve value. Even a 90% BTC drawdown would leave the reserve above the fixed obligations — providing significant cushion. Strategy monitors this as a key risk metric. A figure above 50% would signal meaningful financial stress.

Source: strategy.com/credit — "Net Leverage Definition"`,
  },
  btcARR: {
    short: "Annualized BTC Run Rate — quarterly BTC Gain × 4",
    full: `BTC ARR (Annualized Run Rate) = Most Recent Quarter BTC Gain × 4.

This approximates how many Bitcoin the Company is accumulating per year on an annualized basis, based on the most recent quarter's performance. It is a forward-looking indicator of the treasury strategy's current velocity, not a guaranteed annual figure.

A rising BTC ARR signals accelerating accumulation — more ATM/preferred issuances deploying into Bitcoin. A declining ARR may indicate market conditions limiting issuance above par or reduced investor appetite.

Source: strategy.com/btc — "BTC ARR KPI"`,
  },
};


function DefTooltip({ defKey, children }) {
  const def = STRATEGY_DEFINITIONS[defKey];
  if (!def) return children;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {def.short}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StatRow({ label, value, sub, defKey, accent = "text-foreground", live }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-border/40 gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs text-muted-foreground truncate">{label}</span>
        {defKey && (
          <DefTooltip defKey={defKey}>
            <Info className="w-3 h-3 text-muted-foreground/40 shrink-0 cursor-help" />
          </DefTooltip>
        )}
        {live && <Badge className="text-[9px] px-1 py-0 h-4 bg-primary/20 text-primary border-primary/30">LIVE</Badge>}
      </div>
      <div className="text-right shrink-0">
        <p className={`text-xs font-mono font-bold ${accent}`}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, color, children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className={`flex items-center gap-2 mb-3`}>
        <Icon className={`w-4 h-4 ${color}`} />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function StrategyDashboardTab({ params, preferreds, projections, liveData, onRefresh, refreshing }) {
  const btcPrice = liveData?.btc_price ?? params.btc_price;
  const mstrPrice = liveData?.mstr_price ?? params.mstr_price;
  const btcHoldings = liveData?.btc_holdings ?? OFFICIAL_MSTR_DATA.btc_holdings;

  // Use official balance sheet data — not computed from params
  const { total_debt_M, total_pref_M, total_debt_pref_M, cash_M, basic_shares_M, diluted_shares_M } = OFFICIAL_MSTR_DATA;

  const btcReserve = btcHoldings * btcPrice;
  const marketCap = mstrPrice * basic_shares_M * 1e6;

  // mNAV = EV / BTC Reserve (official Strategy.com definition)
  // EV = Market Cap + Total Debt + Total Pref − Cash
  const ev = marketCap + (total_debt_M * 1e6) + (total_pref_M * 1e6) - (cash_M * 1e6);
  const mnavMultiple = btcReserve > 0 ? ev / btcReserve : 0;

  // Amplification = (Debt + Pref) / BTC Reserve  — from strategy.com/btc
  const amplificationPct = btcReserve > 0 ? (total_debt_pref_M * 1e6 / btcReserve) * 100 : 0;

  // Net Leverage = (Debt + Pref - Cash) / BTC Reserve
  const netLeveragePct = btcReserve > 0 ? ((total_debt_pref_M - cash_M) * 1e6 / btcReserve) * 100 : 0;

  // BTC Coverage Ratio = BTC Reserve / (Debt + Pref)
  const btcCoverageRatio = total_debt_pref_M > 0 ? btcReserve / (total_debt_pref_M * 1e6) : 0;

  // BTC Years of Dividend Coverage = BTC Reserve / Annual Dividends
  const btcYearsDivCoverage = btcReserve > 0 ? btcReserve / (OFFICIAL_MSTR_DATA.annual_dividends_M * 1e6) : 0;

  // USD Months of Dividend Coverage = Cash / (Annual Dividends / 12)
  const usdMonthsDivCoverage = OFFICIAL_MSTR_DATA.annual_dividends_M > 0 ? (cash_M / (OFFICIAL_MSTR_DATA.annual_dividends_M / 12)) : 0;

  // Official annual dividends from strategy.com
  const annualPrefDiv = OFFICIAL_MSTR_DATA.annual_dividends_M * 1e6;

  const isLive = !!(liveData?.btc_price || liveData?.mstr_price);
  const lastUpdated = isLive ? new Date().toLocaleTimeString() : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Bitcoin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Strategy.com Dashboard Mirror</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                All key metrics from strategy.com — with official definitions from strategy.com/notes, /btc, and /credit filings.
              </p>
              {lastUpdated && (
                <p className="text-[10px] text-primary mt-1">Last synced: {lastUpdated}</p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Syncing…" : "Refresh Live"}
          </Button>
        </div>
      </div>

      {/* Main metrics grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Bitcoin Holdings */}
        <Section title="Bitcoin Reserve" icon={Bitcoin} color="text-amber-400">
          <StatRow label="BTC Holdings" value={btcHoldings.toLocaleString()} sub="total BTC" accent="text-amber-400" live={isLive && !!liveData?.btc_holdings} />
          <StatRow label="BTC Price" value={formatCurrency(btcPrice)} sub="USD / BTC" accent="text-amber-400" live={isLive && !!liveData?.btc_price} />
          <StatRow label="BTC Reserve Value" value={formatCurrency(btcReserve)} sub="total USD value" defKey="btcReserve" accent="text-amber-400" />
          <StatRow label="Avg Cost Basis" value={formatCurrency(75_577)} sub="official strategy.com" accent="text-muted-foreground" />
          <StatRow label="Unrealized Gain" value={`${btcPrice > 75577 ? "+" : ""}${(((btcPrice / 75577) - 1) * 100).toFixed(1)}%`} sub="vs $75,577 avg cost" accent={btcPrice > 75577 ? "text-primary" : "text-destructive"} />
          <StatRow label="2026 Acquisition Pace" value="7,403 BTC/wk" sub="tnorth.com (YTD 2026 weekly pace)" accent="text-primary" />
          <StatRow label="Lifetime Monthly Avg" value="11,472 BTC/mo" sub="all-time avg acquisition rate" accent="text-cyan-400" />
        </Section>

        {/* MSTR Equity */}
        <Section title="MSTR Equity Metrics" icon={TrendingUp} color="text-primary">
          <StatRow label="MSTR Price" value={formatCurrency(mstrPrice, 2)} sub="common stock" accent="text-primary" live={isLive && !!liveData?.mstr_price} />
          <StatRow label="Basic Shares Outstanding" value={`${basic_shares_M.toFixed(1)}M`} sub="Class A 327.2M + Class B 19.6M" accent="text-foreground" />
          <StatRow label="Assumed Diluted Shares" value={`${diluted_shares_M.toFixed(1)}M`} sub="incl. converts + preferred + options" defKey="dilutedShares" accent="text-muted-foreground" />
          <StatRow label="Market Cap" value={formatCurrency(marketCap)} sub="common equity" accent="text-primary" />
          <StatRow label="mNAV" value={`${mnavMultiple.toFixed(2)}x`} sub="EV ÷ BTC Reserve" defKey="mnav" accent="text-amber-400" />
          <StatRow label="Amplification" value={`${amplificationPct.toFixed(1)}%`} sub="(Debt+Pref) ÷ BTC Reserve" defKey="amplification" accent="text-purple-400" />
        </Section>

        {/* KPIs */}
        <Section title="Strategy KPIs" icon={Zap} color="text-cyan-400">
          <StatRow label="BPS (Satoshis)" value={OFFICIAL_MSTR_DATA.bps_sats.toLocaleString()} sub="official strategy.com/btc" defKey="bps" accent="text-amber-400" />
          <StatRow label="BTC Yield (YTD 2026)" value={`${OFFICIAL_MSTR_DATA.btc_yield_ytd}%`} sub="official strategy.com/btc" defKey="btcYield" accent="text-primary" />
          <StatRow label="BTC Yield (QTD)" value={`${OFFICIAL_MSTR_DATA.btc_yield_qtd}%`} sub="official strategy.com/btc" accent="text-primary" />
          <StatRow label="BTC Gain QTD" value={`₿${OFFICIAL_MSTR_DATA.btc_gain_qtd.toLocaleString()}`} sub="official strategy.com/btc" defKey="btcGain" accent="text-primary" />
          <StatRow label="BTC $ Gain QTD" value={`$${OFFICIAL_MSTR_DATA.btc_dollar_gain_qtd_M.toLocaleString()}M`} sub="official strategy.com/btc" defKey="btcDollarGain" accent="text-green-400" />
          <StatRow label="Net Leverage" value={`${netLeveragePct.toFixed(1)}%`} sub="(Debt+Pref−Cash) ÷ BTC Reserve" defKey="netLeverage" accent="text-amber-400" />
          <StatRow label="BTC Years of Div. Coverage" value={`${btcYearsDivCoverage.toFixed(1)} yrs`} sub="BTC Reserve ÷ Annual Dividends" defKey="btcRating" accent="text-primary" />
          <StatRow label="USD Months of Div. Coverage" value={`${usdMonthsDivCoverage.toFixed(1)} mo`} sub="Cash ÷ (Annual Dividends / 12)" accent="text-cyan-400" />
          <StatRow label="MSTR IV" value={`${liveData?.mstr_iv ?? 43}%`} sub="implied vol (strategy.com/btc)" live={isLive && !!liveData?.mstr_iv} accent="text-purple-400" />
        </Section>

      </div>

      {/* Preferred + Capital Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Preferred Capital Program" icon={Layers} color="text-purple-400">
          <StatRow label="Total Pref Notional" value={formatCurrency(total_pref_M * 1e6)} sub="official strategy.com/credit" defKey="preferredNotional" accent="text-purple-400" />
          <StatRow label="Annual Dividends" value={formatCurrency(annualPrefDiv)} sub="$1,237M — official strategy.com" accent="text-destructive" />
          <StatRow label="Div / BTC Reserve" value={`${((annualPrefDiv / btcReserve) * 100).toFixed(2)}%`} sub="healthy flywheel if < 2%" accent="text-amber-400" />
          <StatRow label="STRC — 11.5% Variable" value="$6,358M" sub="semi-annual · $99.21 · 30D Sharpe 2.64" accent="text-muted-foreground" />
          <StatRow label="STRF — 10% Fixed" value="$1,284M" sub="quarterly · $92.50" accent="text-muted-foreground" />
          <StatRow label="STRK — 8% Fixed (Conv.)" value="$1,402M" sub="quarterly · $87.00" accent="text-muted-foreground" />
          <StatRow label="STRD — 10% BTC-denom." value="$1,402M" sub="quarterly · $77.14" accent="text-muted-foreground" />
        </Section>

        {/* Enterprise Value breakdown */}
        <Section title="Capital Structure & Enterprise Value" icon={DollarSign} color="text-green-400">
          <StatRow label="Market Cap (Common)" value={formatCurrency(marketCap)} accent="text-primary" />
          <StatRow label="Total Preferred Notional" value={formatCurrency(total_pref_M * 1e6)} sub="official — $11,355M" accent="text-purple-400" />
          <StatRow label="Convertible Notes" value={formatCurrency(total_debt_M * 1e6)} sub="official — $8,214M (strategy.com/credit)" accent="text-amber-400" />
          <StatRow label="USD Cash Reserve" value={formatCurrency(cash_M * 1e6)} sub="$2,250M official" accent="text-muted-foreground" />
          <StatRow label="Enterprise Value" value={formatCurrency(ev)} defKey="enterpriseValue" accent="text-cyan-400" />
          <StatRow label="mNAV (EV ÷ BTC Reserve)" value={`${mnavMultiple.toFixed(2)}x`} sub="official definition — strategy.com/btc" accent="text-amber-400" />
        </Section>
      </div>

      {/* Official Definition Accordions */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Official Strategy.com Definitions</h3>
        </div>
        <Accordion type="multiple" className="space-y-1">
          {Object.entries(STRATEGY_DEFINITIONS).map(([key, def]) => (
            <AccordionItem key={key} value={key} className="border border-border/50 rounded-lg px-3 overflow-hidden">
              <AccordionTrigger className="text-xs text-foreground font-medium py-2 hover:no-underline">
                <span className="text-primary font-mono mr-2 uppercase">{key}</span>
                <span className="text-muted-foreground font-normal">{def.short}</span>
              </AccordionTrigger>
              <AccordionContent>
                <pre className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans pb-2">
                  {def.full}
                </pre>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <p className="text-[10px] text-muted-foreground/40 text-center">
        Mirror of strategy.com metrics. Definitions sourced from strategy.com/notes, /btc, /credit, and SEC filings. Educational use only.
      </p>
    </div>
  );
}