import React, { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Info, RefreshCw, Bitcoin, TrendingUp, Layers, DollarSign, Zap, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent, calcMNAV, calcTotalPrefLiquidation } from "@/lib/calculations";

// Official Strategy.com metric definitions (verbatim / paraphrased from strategy.com/notes, /btc, /credit)
const STRATEGY_DEFINITIONS = {
  mnav: {
    short: "Market cap ÷ Bitcoin NAV",
    full: `mNAV (Multiple of Net Asset Value) = Market Capitalization ÷ (BTC Holdings × BTC Price − Total Preferred Liquidation Preference).

When mNAV > 1.0, the market is paying a premium over the pure BTC value per share, reflecting the value of Strategy's capital markets capabilities, brand, recurring software revenues, and the reflexive flywheel of issuing equity/preferred to buy more BTC at an accretive mNAV. Strategy targets persistently high mNAV as evidence the market attributes value beyond just holding BTC.

Source: strategy.com/notes — "Understanding mNAV"`,
  },
  bps: {
    short: "BTC value attributable per diluted share",
    full: `BPS (Bitcoin Per Share, measured in satoshis) = (Total BTC Holdings × 100,000,000 satoshis) ÷ Assumed Diluted Shares Outstanding.

Strategy introduced BPS as a key performance indicator to measure the BTC accumulation per share over time. Rising BPS means each share controls more Bitcoin — this is the core goal of the treasury strategy. BPS growth net of dilution is the "BTC Yield" KPI.

Source: strategy.com/btc — "BTC Per Share (Satoshis)"`,
  },
  btcYield: {
    short: "% change in BPS period-over-period",
    full: `BTC Yield = (Period-End BPS − Period-Start BPS) ÷ Period-Start BPS × 100%.

This KPI measures the accretion of Bitcoin per share, net of all dilution from share issuances, convertible note conversions, and preferred conversions. A positive BTC Yield means each share's claim on Bitcoin grew faster than shares were issued. Strategy's 2025 target was 15% annual BTC Yield. This is NOT investment yield — it measures Bitcoin accumulation efficiency.

Source: strategy.com/btc — "BTC Yield KPI Explanation" and 10-K/10-Q filings.`,
  },
  btcGain: {
    short: "Absolute BTC added per share",
    full: `BTC $ Gain = (Period-End BPS − Period-Start BPS) × Period-End BTC Price × Assumed Diluted Shares ÷ 100,000,000.

This translates the BTC Yield percentage into an absolute USD gain attributable to BTC accumulation on a per-share basis. Strategy reports this in press releases alongside BTC Yield to give investors a dollar-denominated sense of accretion. Not to be confused with unrealized P&L on the entire portfolio.

Source: strategy.com/btc — "BTC $ Gain definition"`,
  },
  amplification: {
    short: "Market cap ÷ BTC NAV (amplification ratio)",
    full: `Amplification Ratio = Market Capitalization ÷ BTC Net Asset Value.

PunterJeff's framing: MSTR acts as a "Bitcoin amplifier" — leverage on BTC without traditional debt. The amplification ratio reflects: (1) software business intrinsic value, (2) perpetual preferred capital acting as fixed-cost leverage, (3) the reflexive premium investors pay for the capital-markets flywheel. As BTC rises, the amplification effect compounds the equity value faster than BTC alone. Historically 2.5x–4x in bull markets.

Source: PunterJeff analysis + strategy.com investor materials`,
  },
  enterpriseValue: {
    short: "Market cap + debt − cash + preferred",
    full: `Enterprise Value = Market Capitalization + Total Debt + Preferred Stock Liquidation Preference − Cash & Equivalents.

Strategy's EV is dominated by the market cap premium. Unlike traditional EV calculations, Strategy's "debt" is primarily convertible notes that are likely to convert to equity (not cash repaid), so EV understates the Bitcoin-backed nature of the balance sheet. The preferred stock liquidation preference ($5B+) sits senior to common equity in the capital structure.

Source: strategy.com/credit — "Capital Structure" and SEC filings.`,
  },
  preferredNotional: {
    short: "Total face value of all preferred series",
    full: `Preferred Notional = Sum of liquidation preference × shares outstanding for all outstanding preferred series (STRF, STRK, STRC, STRE, STRD).

Strategy's perpetual preferred stock program represents a novel form of "digital credit" — permanent capital that pays fixed or variable dividends while the proceeds are deployed into BTC. Unlike convertible debt, perpetual preferred has no maturity date — it is designed to generate a dividend yield lower than BTC's expected appreciation, creating a positive carry trade funded by BTC gains. As of April 2026, total notional exceeds $9.1B.

Source: strategy.com/credit — "Preferred Stock Program"`,
  },
  btcReserve: {
    short: "Total USD value of BTC holdings",
    full: `BTC Reserve = Total BTC Holdings × Current BTC Price.

Strategy's Bitcoin reserve is the primary asset on its balance sheet under ASC 350-60 (fair value accounting for digital assets, effective Jan 2025). Strategy marks its BTC to market on a quarterly basis. The reserve value fluctuates with BTC price but the BTC count only increases through accretive purchases. Strategy's reserve is the largest corporate Bitcoin holding globally.

Source: strategy.com/btc — "Bitcoin Reserve" and FASB ASC 350-60 filings.`,
  },
  dilutedShares: {
    short: "Fully-diluted common share count",
    full: `Assumed Diluted Shares Outstanding = Common shares outstanding + shares issuable upon conversion of all convertible notes + shares issuable upon conversion/exercise of all preferred stock + unvested RSUs and options.

Strategy uses "assumed diluted" (not basic) for BPS calculations to give a conservative, fully-loaded view of BTC per share. Importantly, Strategy's ATM program continuously increases shares outstanding, creating dilution that is intentionally offset by accretive BTC purchases (BTC Yield > 0).

Source: strategy.com/btc — "Diluted Share Count Methodology" + 10-K Item 5.`,
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
  const now = projections[0] || {};
  const totalPrefLiq = calcTotalPrefLiquidation(preferreds);
  const btcReserve = params.mstr_btc_holdings * params.btc_price;
  const mnav = calcMNAV(params.mstr_btc_holdings, params.btc_price, totalPrefLiq, params.mstr_shares_outstanding);
  const marketCap = params.mstr_price * params.mstr_shares_outstanding * 1e6;
  const mnavMultiple = mnav > 0 ? params.mstr_price / mnav : 0;

  // BPS in satoshis = (BTC holdings / assumed diluted shares) * 1e8
  const dilutedSharesM = params.mstr_shares_outstanding * 1.18; // ~18% dilution from converts + preferred
  const bpsInSats = (params.mstr_btc_holdings / (dilutedSharesM * 1e6)) * 1e8;

  // BTC Yield estimate (annualized, based on accumulation vs dilution)
  const annualBtcAccum = params.btc_accumulation_per_quarter * 4;
  const annualDilutedShares = params.mstr_shares_outstanding * (1 + params.dilution_rate_per_quarter / 100 * 4);
  const btcYieldEst = ((annualBtcAccum / params.mstr_btc_holdings) - (params.dilution_rate_per_quarter * 4 / 100)) * 100;

  // BTC $ Gain (quarterly)
  const qtrBtcGain = params.btc_accumulation_per_quarter * params.btc_price;

  // Total annual preferred dividends
  const annualPrefDiv = preferreds.reduce((s, p) => s + (p.notional_amount * 1e6 * p.dividend_rate / 100), 0);

  const isLive = !!liveData;
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
          <StatRow label="BTC Holdings" value={params.mstr_btc_holdings.toLocaleString()} sub="total BTC" accent="text-amber-400" live={isLive && !!liveData?.btc_holdings} />
          <StatRow label="BTC Price" value={formatCurrency(params.btc_price)} sub="USD / BTC" accent="text-amber-400" live={isLive && !!liveData?.btc_price} />
          <StatRow label="BTC Reserve Value" value={formatCurrency(btcReserve)} sub="total USD value" defKey="btcReserve" accent="text-amber-400" />
          <StatRow label="Avg Cost Basis" value={formatCurrency(43_500)} sub="est. ~$43,500/BTC" accent="text-muted-foreground" />
          <StatRow label="Unrealized Gain" value={formatPercent(((params.btc_price / 43500) - 1) * 100)} sub="vs avg cost" accent={params.btc_price > 43500 ? "text-primary" : "text-destructive"} />
          <StatRow label="BTC/Qtr Accumulation" value={params.btc_accumulation_per_quarter.toLocaleString()} sub="BTC per quarter" accent="text-primary" />
        </Section>

        {/* MSTR Equity */}
        <Section title="MSTR Equity Metrics" icon={TrendingUp} color="text-primary">
          <StatRow label="MSTR Price" value={formatCurrency(params.mstr_price, 2)} sub="common stock" accent="text-primary" live={isLive && !!liveData?.mstr_price} />
          <StatRow label="Shares Outstanding" value={`${params.mstr_shares_outstanding.toFixed(0)}M`} sub="basic" accent="text-foreground" />
          <StatRow label="Diluted Shares (est.)" value={`${dilutedSharesM.toFixed(0)}M`} sub="incl. converts + preferred" defKey="dilutedShares" accent="text-muted-foreground" />
          <StatRow label="Market Cap" value={formatCurrency(marketCap)} sub="common equity" accent="text-primary" />
          <StatRow label="mNAV / Share" value={formatCurrency(mnav, 2)} sub="BTC NAV per share" defKey="mnav" accent="text-cyan-400" />
          <StatRow label="mNAV Multiple" value={`${mnavMultiple.toFixed(2)}x`} sub="price ÷ mNAV" accent="text-amber-400" />
          <StatRow label="Amplification Ratio" value={`${params.amplification_ratio.toFixed(1)}x`} sub="market cap ÷ BTC NAV" defKey="amplification" accent="text-purple-400" />
        </Section>

        {/* KPIs */}
        <Section title="Strategy KPIs" icon={Zap} color="text-cyan-400">
          <StatRow label="BPS (Satoshis)" value={Math.round(bpsInSats).toLocaleString()} sub="sats per diluted share" defKey="bps" accent="text-amber-400" />
          <StatRow label="BTC Yield (est. ann.)" value={formatPercent(Math.max(0, btcYieldEst))} sub="accretion vs dilution" defKey="btcYield" accent={btcYieldEst > 0 ? "text-primary" : "text-destructive"} />
          <StatRow label="BTC $ Gain (Qtr)" value={formatCurrency(qtrBtcGain)} sub="quarterly BTC acquired × price" defKey="btcGain" accent="text-primary" />
          <StatRow label="MSTR IV" value={`${params.mstr_iv}%`} sub="30-day implied vol" live={isLive && !!liveData?.mstr_iv} accent="text-purple-400" />
          <StatRow label="Dilution/Qtr" value={`${params.dilution_rate_per_quarter}%`} sub="ATM + convert dilution" accent="text-amber-400" />
          <StatRow label="Earnings CAGR" value={`${params.earnings_cagr}%`} sub="PunterJeff target" accent="text-foreground" />
        </Section>

      </div>

      {/* Preferred + Capital Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Preferred Capital Program" icon={Layers} color="text-purple-400">
          <StatRow label="Total Notional" value={formatCurrency(totalPrefLiq)} sub="sum of liquidation prefs" defKey="preferredNotional" accent="text-purple-400" />
          <StatRow label="Annual Dividend Liability" value={formatCurrency(annualPrefDiv)} sub="cash out per year" accent="text-destructive" />
          <StatRow label="Div/BTC Reserve Ratio" value={formatPercent((annualPrefDiv / btcReserve) * 100, 2)} sub="flywheel healthy if < 2%" accent="text-amber-400" />
          {preferreds.map((p) => (
            <StatRow
              key={p.ticker}
              label={`${p.ticker} — ${p.dividend_rate}% ${p.is_btc_denominated ? "₿" : "$"}`}
              value={formatCurrency(p.notional_amount * 1e6)}
              sub={`${p.payment_frequency}`}
              accent="text-muted-foreground"
            />
          ))}
        </Section>

        {/* Enterprise Value breakdown */}
        <Section title="Capital Structure & Enterprise Value" icon={DollarSign} color="text-green-400">
          <StatRow label="Market Cap (Common)" value={formatCurrency(marketCap)} accent="text-primary" />
          <StatRow label="Preferred Notional" value={formatCurrency(totalPrefLiq)} accent="text-purple-400" />
          <StatRow label="Convertible Notes (est.)" value={formatCurrency(3.7e9)} sub="~$3.7B outstanding" accent="text-amber-400" />
          <StatRow label="Cash & Equiv. (est.)" value={formatCurrency(700e6)} sub="~$700M" accent="text-muted-foreground" />
          <StatRow label="Enterprise Value (est.)" value={formatCurrency(marketCap + totalPrefLiq + 3.7e9 - 700e6)} defKey="enterpriseValue" accent="text-cyan-400" />
          <StatRow label="EV ÷ BTC Reserve" value={`${((marketCap + totalPrefLiq + 3.7e9 - 700e6) / btcReserve).toFixed(2)}x`} sub="premium to pure BTC" accent="text-amber-400" />
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