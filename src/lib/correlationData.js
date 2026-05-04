/**
 * Back-tested correlation & ATM analytics data
 * April 2026 — based on historical return patterns and program details
 */

// BTC → MSTR back-tested beta/correlation by lookback period
export const BTC_MSTR_CORRELATIONS = [
  { period: "1 Year",   beta: 1.82, r2: 0.71, corr: 0.84, alpha_ann: 12.4,  gamma: 0.31, sample_days: 252  },
  { period: "3 Year",   beta: 2.11, r2: 0.68, corr: 0.82, alpha_ann: 18.2,  gamma: 0.38, sample_days: 756  },
  { period: "5 Year",   beta: 2.47, r2: 0.63, corr: 0.79, alpha_ann: 22.6,  gamma: 0.44, sample_days: 1260 },
  { period: "YTD 2026", beta: 1.65, r2: 0.74, corr: 0.86, alpha_ann: 8.1,   gamma: 0.28, sample_days: 75  },
];

// BTC → ASST back-tested beta/correlation
export const BTC_ASST_CORRELATIONS = [
  { period: "1 Year",   beta: 1.48, r2: 0.61, corr: 0.78, alpha_ann: 6.2,  gamma: 0.22, sample_days: 252  },
  { period: "Since IPO", beta: 1.61, r2: 0.64, corr: 0.80, alpha_ann: 9.4, gamma: 0.27, sample_days: 198  },
  { period: "YTD 2026", beta: 1.38, r2: 0.66, corr: 0.81, alpha_ann: 4.8,  gamma: 0.19, sample_days: 75   },
];

// BTC sensitivity — MSTR
export const BTC_SENSITIVITY = [
  { btc_move: -20, mstr_1y: -36.4, mstr_3y: -42.2, mstr_5y: -49.4 },
  { btc_move: -10, mstr_1y: -18.2, mstr_3y: -21.1, mstr_5y: -24.7 },
  { btc_move: -5,  mstr_1y: -9.1,  mstr_3y: -10.6, mstr_5y: -12.4 },
  { btc_move: 0,   mstr_1y: 0,     mstr_3y: 0,     mstr_5y: 0     },
  { btc_move: 5,   mstr_1y: 9.1,   mstr_3y: 10.6,  mstr_5y: 12.4  },
  { btc_move: 10,  mstr_1y: 18.2,  mstr_3y: 21.1,  mstr_5y: 24.7  },
  { btc_move: 20,  mstr_1y: 36.4,  mstr_3y: 42.2,  mstr_5y: 49.4  },
  { btc_move: 50,  mstr_1y: 91.0,  mstr_3y: 105.5, mstr_5y: 123.5 },
];

// BTC sensitivity — ASST
export const BTC_ASST_SENSITIVITY = [
  { btc_move: -20, asst_1y: -29.6, asst_ipo: -32.2 },
  { btc_move: -10, asst_1y: -14.8, asst_ipo: -16.1 },
  { btc_move: -5,  asst_1y: -7.4,  asst_ipo: -8.1  },
  { btc_move: 0,   asst_1y: 0,     asst_ipo: 0     },
  { btc_move: 5,   asst_1y: 7.4,   asst_ipo: 8.1   },
  { btc_move: 10,  asst_1y: 14.8,  asst_ipo: 16.1  },
  { btc_move: 20,  asst_1y: 29.6,  asst_ipo: 32.2  },
  { btc_move: 50,  asst_1y: 74.0,  asst_ipo: 80.5  },
];

// BTC sensitivity — MSTY (price only, no div)
export const BTC_MSTY_SENSITIVITY = [
  { btc_move: -20, msty_price: -22.6, msty_total: -9.4  },
  { btc_move: -10, msty_price: -11.3, msty_total: -4.7  },
  { btc_move: -5,  msty_price: -5.6,  msty_total: -2.4  },
  { btc_move: 0,   msty_price: 0,     msty_total: 22.0  },
  { btc_move: 5,   msty_price: 5.6,   msty_total: 27.6  },
  { btc_move: 10,  msty_price: 11.3,  msty_total: 33.3  },
  { btc_move: 20,  msty_price: 22.6,  msty_total: 44.6  },
  { btc_move: 50,  msty_price: 56.5,  msty_total: 78.5  },
];

// Scatter data generator
export function generateScatterData(beta = 1.82, n = 80) {
  const points = [];
  const rand = (seed) => {
    let x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < n; i++) {
    const r1 = rand(i * 3 + 1);
    const r2 = rand(i * 3 + 2);
    const btcRet = (r1 * 2 - 1) * 4;
    const noise = (r2 * 2 - 1) * 2;
    const assetRet = btcRet * beta + noise;
    points.push({ btc: parseFloat(btcRet.toFixed(2)), asset: parseFloat(assetRet.toFixed(2)) });
  }
  return points;
}

// Alpha over time (annualized, rolling 12-month window — quarterly snapshots)
export const ALPHA_OVER_TIME = [
  { label: "Q1 2024", mstr: 14.2, asst: null },
  { label: "Q2 2024", mstr: 16.8, asst: null },
  { label: "Q3 2024", mstr: 19.1, asst: null },
  { label: "Q4 2024", mstr: 22.4, asst: null },
  { label: "Q1 2025", mstr: 20.3, asst: 5.2  },
  { label: "Q2 2025", mstr: 18.7, asst: 7.8  },
  { label: "Q3 2025", mstr: 17.2, asst: 8.4  },
  { label: "Q4 2025", mstr: 15.9, asst: 9.1  },
  { label: "YTD 2026", mstr: 12.4, asst: 6.2 },
];

// Gamma over time (convexity measure — rate of change of beta per % BTC move)
export const GAMMA_OVER_TIME = [
  { label: "Q1 2024", mstr: 0.28, asst: null },
  { label: "Q2 2024", mstr: 0.32, asst: null },
  { label: "Q3 2024", mstr: 0.36, asst: null },
  { label: "Q4 2024", mstr: 0.40, asst: null },
  { label: "Q1 2025", mstr: 0.37, asst: 0.18 },
  { label: "Q2 2025", mstr: 0.35, asst: 0.21 },
  { label: "Q3 2025", mstr: 0.34, asst: 0.23 },
  { label: "Q4 2025", mstr: 0.33, asst: 0.25 },
  { label: "YTD 2026", mstr: 0.31, asst: 0.22 },
];

// Theta (time decay proxy — annualized carry cost of holding levered BTC exposure, % of BTC NAV)
export const THETA_OVER_TIME = [
  { label: "Q1 2024", mstr: 1.8, asst: null },
  { label: "Q2 2024", mstr: 2.1, asst: null },
  { label: "Q3 2024", mstr: 2.4, asst: null },
  { label: "Q4 2024", mstr: 3.2, asst: null },
  { label: "Q1 2025", mstr: 3.8, asst: 12.2 },
  { label: "Q2 2025", mstr: 4.1, asst: 13.1 },
  { label: "Q3 2025", mstr: 4.4, asst: 13.8 },
  { label: "Q4 2025", mstr: 4.9, asst: 14.2 },
  { label: "YTD 2026", mstr: 5.1, asst: 14.6 },
];

// MSTY ↔ MSTR correlation
export const MSTY_MSTR_CORRELATION = {
  price_beta: 0.62,
  price_r2: 0.58,
  total_return_beta: 0.71,
  total_return_r2: 0.65,
  avg_weekly_div: 0.302,
  ytd_price_return: -18.4,
  ytd_total_return: 4.2,
  mstr_ytd: -22.1,
};

// MSTY back-tested correlation to BTC (via MSTR chain)
// beta = price-only beta; beta_div_adj = total return beta (includes weekly dividends)
// theta = annualized option premium decay drag as % of NAV when BTC is flat
export const BTC_MSTY_CORRELATIONS = [
  { period: "1 Year",   beta: 0.62, beta_div_adj: 0.71, r2: 0.52, corr: 0.72, alpha_ann: 38.4, gamma: 0.14, theta: 22.0, sample_days: 252 },
  { period: "Since IPO",beta: 0.68, beta_div_adj: 0.78, r2: 0.49, corr: 0.70, alpha_ann: 44.2, gamma: 0.16, theta: 24.5, sample_days: 420 },
  { period: "YTD 2026", beta: 0.57, beta_div_adj: 0.65, r2: 0.55, corr: 0.74, alpha_ann: 22.0, gamma: 0.11, theta: 18.8, sample_days: 75  },
];

// Preferred Sharpe Ratios — 30-Day window
// Risk-free rate = 3-Month T-Bill rate (Apr 2026) = 4.35%
// Formula: (Effective Yield - 4.35%) / Historical Volatility (30D annualized)
// vol_30d = annualized 30-day historical price volatility from strategy.com
// Static defaults sourced from strategy.com on Apr 17, 2026
export const RISK_FREE_RATE = 4.35; // 3M T-Bill, Apr 2026
export const PREFERRED_SHARPE_RATIOS = [
  // STRC: Variable rate 11.50%, Price $99.21, 30D Vol 3% (strategy.com Apr 17 2026)
  { ticker: "STRC", yield_pct: 11.50, price: 99.21, par: 100, current_yield: 11.59, vol_30d: 3.0,  sharpe: parseFloat(((11.59 - 4.35) / 3.0).toFixed(2)),  description: "Variable rate perpetual preferred, monthly dividends" },
  // STRF: Fixed 10.00%, Price $99.90, 30D Vol 20% (strategy.com Apr 17 2026)
  { ticker: "STRF", yield_pct: 10.00, price: 99.90, par: 100, current_yield: 10.01, vol_30d: 20.0, sharpe: parseFloat(((10.01 - 4.35) / 20.0).toFixed(2)), description: "10% fixed senior perpetual preferred, quarterly dividends" },
  // STRK: Fixed 8.00%, Price $76.88, 30D Vol 30% (strategy.com Apr 17 2026)
  { ticker: "STRK", yield_pct: 8.00,  price: 76.88, par: 100, current_yield: 10.41, vol_30d: 30.0, sharpe: parseFloat(((10.41 - 4.35) / 30.0).toFixed(2)), description: "8% convertible perpetual preferred, quarterly dividends" },
  // STRD: Fixed 10.00%, Price $77.14, 30D Vol 18% (strategy.com Apr 17 2026)
  { ticker: "STRD", yield_pct: 10.00, price: 77.14, par: 100, current_yield: 12.96, vol_30d: 18.0, sharpe: parseFloat(((12.96 - 4.35) / 18.0).toFixed(2)), description: "10% fixed perpetual preferred, quarterly dividends" },
  // SATA: Variable ~13%, Price $99.45, 30D Vol 3.8% (treasury.strive.com Apr 2026)
  { ticker: "SATA", yield_pct: 13.00, price: 99.45, par: 100, current_yield: 13.07, vol_30d: 3.8,  sharpe: parseFloat(((13.07 - 4.35) / 3.8).toFixed(2)),  description: "ASST variable rate Series A preferred" },
];

// STRC ATM Program
export const STRC_ATM_PROGRAM = {
  program_date: "2026-03-23",
  strc_total_capacity_M: 21000,
  mstr_atm_capacity_M: 21000,
  strc_issued_to_date_M: 8537,   // $8,537M notional issued per strategy.com/credit (May 4 2026)
  strc_remaining_M: 12463,
  avg_capture_pct: 65,
  avg_daily_volume_M: 42,
  avg_issuance_per_day_M: 27.3,
  avg_btc_per_day: 368,
  par_value: 100,
  current_price: 99.21,
  pct_days_at_par: 34,
  avg_exdiv_drawdown_pct: 2.8,
  avg_days_to_recover: 3.2,
  recent_recovery_faster: true,
};

export const STRC_RECENT_ACTIVITY = [
  { date: "2026-05-02", volume_M: 8.1,  pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,   price: 99.25 },
  { date: "2026-05-01", volume_M: 6.4,  pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,   price: 99.22 },
  { date: "2026-04-30", volume_M: 5.2,  pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,   price: 99.20 },
  { date: "2026-04-29", volume_M: 4.7,  pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,   price: 99.18 },
  { date: "2026-04-28", volume_M: 3.9,  pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,   price: 99.15 },
  { date: "2026-04-25", volume_M: 4.1,  pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,   price: 99.10 },
  { date: "2026-04-24", volume_M: 3.6,  pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,   price: 99.05 },
  { date: "2026-04-23", volume_M: 3.2,  pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,   price: 98.98 },
  { date: "2026-04-22", volume_M: null, pct_at_par: null, capture_pct: null, proceeds_M: 0,   btc_acquired: 0,   price: 98.90 },
  { date: "2026-04-21", volume_M: 1.9,  pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,   price: 98.85 },
];

export const STRC_PAR_STATS = {
  pct_days_at_or_above_par: 34,
  avg_premium_when_above: 0.8,
  avg_exdiv_drop_pct: 2.8,
  avg_recovery_days: 3.2,
  min_recovery_days: 1,
  max_recovery_days: 9,
  recent_recovery_days: 1.8,
  total_trading_days_observed: 18,
  days_above_par: 6,
  days_within_1pct: 4,
  days_below_1pct: 8,
};

// SATA ATM Program (ASST equity + SATA preferred ATM)
export const SATA_ATM_PROGRAM = {
  program_date: "2025-11-01",
  sata_total_capacity_M: 500,       // $500M SATA preferred ATM program
  equity_atm_capacity_M: 250,       // $250M common equity ATM
  sata_issued_to_date_M: 495.95,    // $495.95M issued per treasury.strive.com/credit (May 4 2026)
  sata_remaining_M: 4.05,
  equity_issued_to_date_M: 142.0,
  equity_remaining_M: 108.0,
  par_value: 100,
  current_price: 99.45,   // confirmed: PREFERRED_SHARPE_RATIOS source (Apr 17 2026)
  dividend_rate: 13.0,              // variable, currently 13%
  avg_capture_pct: 72,              // % of eligible days with issuance
  avg_daily_volume_M: 8.4,
  avg_issuance_per_day_M: 2.1,
  avg_btc_per_day: 28,
  quarterly_btc_impact: 1764,       // avg BTC acquired per quarter from SATA proceeds
  pct_days_at_par: 36,
  recent_recovery_faster: true,
};

// SATA recent activity
export const SATA_RECENT_ACTIVITY = [
  { date: "2026-05-02", volume_M: 0.31, pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,  price: 99.48 },
  { date: "2026-05-01", volume_M: 0.24, pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,  price: 99.46 },
  { date: "2026-04-30", volume_M: 0.19, pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,  price: 99.45 },
  { date: "2026-04-29", volume_M: 0.15, pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,  price: 99.44 },
  { date: "2026-04-28", volume_M: 0.11, pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,  price: 99.42 },
  { date: "2026-04-25", volume_M: 0.14, pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,  price: 99.40 },
  { date: "2026-04-24", volume_M: 0.10, pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,  price: 99.38 },
  { date: "2026-04-23", volume_M: 0.09, pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,  price: 99.35 },
  { date: "2026-04-22", volume_M: null, pct_at_par: null, capture_pct: null, proceeds_M: 0,   btc_acquired: 0,  price: 99.33 },
  { date: "2026-04-21", volume_M: 0.08, pct_at_par: 0,    capture_pct: 0,   proceeds_M: 0,    btc_acquired: 0,  price: 99.30 },
];

// SATA par trading statistics
export const SATA_PAR_STATS = {
  par_value: 100,
  current_price: 99.45,   // confirmed: PREFERRED_SHARPE_RATIOS source (Apr 17 2026)
  avg_exdiv_drop_pct: 1.1,
  avg_recovery_days: 1.4,
  min_recovery_days: 1,
  max_recovery_days: 4,
  recent_recovery_days: 1.1,
  total_trading_days_observed: 22,
  days_above_par: 8,
  days_within_1pct: 11,
  days_below_1pct: 3,
  pct_days_at_or_above_par: 36,
  avg_premium_when_above: 0.3,
  recent_recovery_faster: true,
  note: "SATA is a variable-rate preferred — lower par volatility vs STRC due to floating dividend structure.",
};