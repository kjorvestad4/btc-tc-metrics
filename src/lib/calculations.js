// PunterJeff MSTR Projection Engine - Core Calculations

export const DEFAULT_PARAMS = {
  btc_price: 74300,
  btc_cagr: 40,
  mstr_btc_holdings: 780897,
  mstr_shares_outstanding: 220,
  mstr_price: 296,
  amplification_ratio: 3.0,
  btc_accumulation_per_quarter: 15000,
  dilution_rate_per_quarter: 1.5,
  mstr_iv: 60,
  msty_nav: 18.5,
  msty_participation_rate: 35,
  projection_years: 5,
  premium_multiple: 1.0,
  earnings_cagr: 50,
  active_scenario: "Base",
};

export const DEFAULT_PREFERREDS = [
  { ticker: "STRF", name: "Strategy 10% Perpetual Preferred", notional_amount: 3450, dividend_rate: 10, payment_frequency: "quarterly", is_btc_denominated: false, conversion_ratio: 0, current_price: 92.50, shares_outstanding: 34500000, liquidation_preference: 100 },
  { ticker: "STRK", name: "Strategy Series A Perpetual Preferred", notional_amount: 2100, dividend_rate: 8, payment_frequency: "quarterly", is_btc_denominated: false, conversion_ratio: 0.1, current_price: 87.00, shares_outstanding: 21000000, liquidation_preference: 100 },
  { ticker: "STRC", name: "Strategy Convertible Preferred C", notional_amount: 1500, dividend_rate: 10, payment_frequency: "semi-annual", is_btc_denominated: false, conversion_ratio: 0.15, current_price: 95.00, shares_outstanding: 15000000, liquidation_preference: 100 },
  { ticker: "STRE", name: "Strategy Enhanced Preferred E", notional_amount: 1210, dividend_rate: 13, payment_frequency: "monthly", is_btc_denominated: true, conversion_ratio: 0, current_price: 78.00, shares_outstanding: 12100000, liquidation_preference: 100 },
  { ticker: "STRD", name: "Strategy Digital Credit Preferred D", notional_amount: 900, dividend_rate: 11, payment_frequency: "quarterly", is_btc_denominated: true, conversion_ratio: 0.08, current_price: 82.00, shares_outstanding: 9000000, liquidation_preference: 100 },
];

export const DEFAULT_SCENARIOS = [
  { name: "Base", btc_cagr: 40, accumulation_rate: 15000, amplification_ratio: 3.0, premium_multiple: 1.0, dilution_rate: 1.5, mstr_iv: 60, earnings_cagr: 50, is_default: true },
  { name: "Bull", btc_cagr: 60, accumulation_rate: 25000, amplification_ratio: 3.5, premium_multiple: 1.2, dilution_rate: 2.0, mstr_iv: 80, earnings_cagr: 70, is_default: true },
  { name: "Bear", btc_cagr: 20, accumulation_rate: 8000, amplification_ratio: 2.0, premium_multiple: 0.8, dilution_rate: 1.0, mstr_iv: 45, earnings_cagr: 30, is_default: true },
];

/**
 * Calculate mNAV per share
 * mNAV = (BTC_holdings × BTC_price – total_pref_liquidation_preference) / shares_outstanding
 */
export function calcMNAV(btcHoldings, btcPrice, totalPrefLiquidation, sharesOutstandingM) {
  const btcValue = btcHoldings * btcPrice;
  const nav = btcValue - totalPrefLiquidation;
  return nav / (sharesOutstandingM * 1e6);
}

/**
 * Calculate total preferred liquidation preference
 */
export function calcTotalPrefLiquidation(preferreds) {
  return preferreds.reduce((sum, p) => sum + (p.notional_amount * 1e6), 0);
}

/**
 * Calculate total annual preferred dividend liability
 */
export function calcTotalAnnualDividend(preferreds) {
  return preferreds.reduce((sum, p) => sum + (p.notional_amount * 1e6 * (p.dividend_rate / 100)), 0);
}

/**
 * Calculate MSTR projected price
 */
export function calcMSTRPrice(mnav, amplificationRatio, premiumMultiple) {
  return mnav * amplificationRatio * premiumMultiple;
}

/**
 * Calculate MSTY dividend estimate (synthetic covered call)
 * Approximation: monthly premium ≈ MSTR_price × IV × sqrt(1/12) × participation_rate
 */
export function calcMSTYDividend(mstrPrice, iv, participationRate) {
  const monthlyPremium = mstrPrice * (iv / 100) * Math.sqrt(1 / 12) * (participationRate / 100);
  return monthlyPremium;
}

/**
 * Generate full projection timeline
 */
export function generateProjections(params, preferreds, quarters = 20) {
  const projections = [];
  let btcHoldings = params.mstr_btc_holdings;
  let sharesM = params.mstr_shares_outstanding;
  const quarterlyBtcGrowth = Math.pow(1 + params.btc_cagr / 100, 0.25);
  let btcPrice = params.btc_price;
  const totalPrefLiq = calcTotalPrefLiquidation(preferreds);
  const annualDividend = calcTotalAnnualDividend(preferreds);

  for (let q = 0; q <= quarters; q++) {
    if (q > 0) {
      btcPrice = btcPrice * quarterlyBtcGrowth;
      btcHoldings += params.btc_accumulation_per_quarter;
      sharesM = sharesM * (1 + params.dilution_rate_per_quarter / 100);
    }

    const mnav = calcMNAV(btcHoldings, btcPrice, totalPrefLiq, sharesM);
    const mstrPrice = calcMSTRPrice(mnav, params.amplification_ratio, params.premium_multiple);
    const premiumToNav = mnav > 0 ? ((mstrPrice / mnav) - 1) * 100 : 0;
    const btcNav = btcHoldings * btcPrice;
    const marketCap = mstrPrice * sharesM * 1e6;
    const mstyDiv = calcMSTYDividend(mstrPrice, params.mstr_iv, params.msty_participation_rate);
    const mstyNav = params.msty_nav * (mstrPrice / params.mstr_price) * 0.97; // 3% decay estimate
    const mstyYield = mstyNav > 0 ? (mstyDiv * 12 / mstyNav) * 100 : 0;

    const year = Math.floor(q / 4);
    const quarterInYear = (q % 4) + 1;

    projections.push({
      quarter: q,
      label: q === 0 ? "Now" : `Y${year + 1} Q${quarterInYear}`,
      year: year,
      btc_price: btcPrice,
      btc_holdings: btcHoldings,
      shares_outstanding_m: sharesM,
      mnav,
      mstr_price: mstrPrice,
      premium_to_nav: premiumToNav,
      btc_nav: btcNav,
      market_cap: marketCap,
      annual_dividend_liability: annualDividend,
      quarterly_dividend: annualDividend / 4,
      msty_dividend_monthly: mstyDiv,
      msty_nav: mstyNav,
      msty_yield: mstyYield,
      amplification: params.amplification_ratio,
    });
  }

  return projections;
}

/**
 * Format currency values
 */
export function formatCurrency(value, decimals = 0) {
  if (value === null || value === undefined || isNaN(value)) return "$0";
  if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(decimals > 0 ? decimals : 1)}K`;
  return `$${value.toFixed(decimals)}`;
}

export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || isNaN(value)) return "0";
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return "0%";
  return `${value.toFixed(decimals)}%`;
}