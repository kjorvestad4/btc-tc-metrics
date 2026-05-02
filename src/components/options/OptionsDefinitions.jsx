import React, { useState } from "react";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";

const DEFINITIONS = [
  {
    term: "Call Option",
    short: "Right to BUY the underlying at the strike price",
    full: `A call option gives the buyer the right (but not the obligation) to purchase 100 shares of the underlying stock at the strike price before or on the expiration date.

Example: MSTR is trading at $400. You buy a $420 call expiring in 30 days for $8.50 (mid).
• Cost: $8.50 × 100 = $850 per contract
• If MSTR rises to $450 at expiry, your profit = ($450 - $420 - $8.50) × 100 = $2,150
• If MSTR stays below $420, the option expires worthless — you lose the $850 premium.

Calls are bullish directional bets. The further OTM, the cheaper but less likely to profit.`,
  },
  {
    term: "Put Option",
    short: "Right to SELL the underlying at the strike price",
    full: `A put option gives the buyer the right (but not the obligation) to sell 100 shares of the underlying stock at the strike price before or on the expiration date.

Example: MSTR is at $400. You buy a $380 put expiring in 30 days for $7.00.
• Cost: $7.00 × 100 = $700 per contract
• If MSTR drops to $350 at expiry, your profit = ($380 - $350 - $7.00) × 100 = $2,300
• If MSTR stays above $380, the option expires worthless.

Puts are used for bearish bets or as portfolio hedges (insurance).`,
  },
  {
    term: "Strike Price",
    short: "The fixed price at which the option can be exercised",
    full: `The strike price (also called exercise price) is the pre-agreed price at which the option holder can buy (call) or sell (put) the underlying asset.

• ITM (In-the-Money): For calls, underlying > strike. For puts, underlying < strike.
• ATM (At-the-Money): Strike ≈ current underlying price.
• OTM (Out-of-the-Money): For calls, underlying < strike. For puts, underlying > strike.

Example: With MSTR at $400:
• $380 call is ITM (intrinsic value = $20)
• $400 call is ATM
• $450 call is OTM (purely time value)`,
  },
  {
    term: "IV — Implied Volatility",
    short: "The market's forecast of future price movement, derived from option premiums",
    full: `IV is the market's consensus estimate of how much the underlying will move over the life of the option. It is derived by back-solving the Black-Scholes formula given the option's market price.

• Higher IV → more expensive options (market expects large moves)
• Lower IV → cheaper options (market expects calm)
• MSTR typically has IV of 80–140% vs. SPY at 15–20%

Example: A 30-day $400 call on MSTR with 100% IV will cost significantly more than the same call with 50% IV, because the market prices in a higher probability of large swings.

IV is often quoted as an annual figure — a 100% IV means the market expects roughly ±100% annualized moves (roughly ±6% per day on average).`,
  },
  {
    term: "Delta (Δ)",
    short: "Rate of change of option price per $1 move in the underlying",
    full: `Delta measures how much the option's price changes when the underlying moves $1.

• Call deltas range from 0 to +1.0
• Put deltas range from -1.0 to 0
• ATM options have delta ≈ ±0.50 (50 cents move per $1 underlying move)
• Deep ITM options have delta → ±1.0 (behaves like owning the stock)
• Deep OTM options have delta → 0

Example: You hold a MSTR call with delta = 0.45. If MSTR rises $10, the option gains approximately $0.45 × $10 = $4.50 (× 100 shares = $450 per contract).

Note: Greeks (Delta, Gamma, Theta, Vega) are only available when using the Polygon.io options data source. Yahoo Finance / RapidAPI does not provide Greeks — this is why you see "—" in those columns.`,
  },
  {
    term: "Theta (Θ)",
    short: "Daily time decay — how much the option loses in value per day",
    full: `Theta measures the dollar amount an option loses each day purely from the passage of time, all else equal (underlying price, IV unchanged).

• Theta is always negative for option buyers (you lose value daily)
• Theta is positive for option sellers (you collect time decay)
• Theta accelerates rapidly in the final 30 days before expiration

Example: A MSTR call is priced at $12.00 with a theta of -0.35. After one trading day with MSTR unchanged, the option is worth approximately $11.65.

Short-dated OTM options have the highest theta decay rate — a common pitfall for buyers who wait too long.

Note: Greeks are only returned by the Polygon.io options snapshot endpoint. RapidAPI / Yahoo Finance data shows "—" for all Greeks.`,
  },
  {
    term: "Gamma (Γ)",
    short: "Rate of change of Delta per $1 move in the underlying",
    full: `Gamma measures how fast delta changes as the underlying price moves. It is the second derivative of option price with respect to underlying price.

• High gamma = delta changes rapidly with price moves (typical near ATM and near expiry)
• Low gamma = delta is stable (deep ITM/OTM or long-dated options)
• Gamma is highest for ATM options close to expiration

Example: MSTR call has delta = 0.50 and gamma = 0.015. If MSTR rises $10, the new delta ≈ 0.50 + (0.015 × 10) = 0.65.

For traders: "Long gamma" means you profit from large moves in either direction. "Short gamma" (e.g., covered calls) means you're hurt by large moves.`,
  },
  {
    term: "Vega (ν)",
    short: "Sensitivity of option price to a 1% change in implied volatility",
    full: `Vega measures how much an option's price changes for every 1 percentage point increase in implied volatility.

• Positive for all option buyers (rising IV increases option value)
• Negative for option sellers
• Long-dated options have higher vega than short-dated ones
• ATM options have the highest vega

Example: A MSTR call has vega = 0.25. If IV rises from 100% to 105% (+5 points), the option gains approximately $0.25 × 5 = $1.25 (× 100 = $125 per contract).

Buying options before an earnings announcement is a "vega play" — IV tends to spike before and collapse after ("IV crush").`,
  },
  {
    term: "Intrinsic Value",
    short: "The real, exercise value of an option right now",
    full: `Intrinsic value is the amount an option is worth if exercised immediately.

• Call intrinsic value = max(0, Underlying Price − Strike Price)
• Put intrinsic value = max(0, Strike Price − Underlying Price)
• OTM options have zero intrinsic value — they are 100% time value
• ITM options have both intrinsic value and time value

Example: MSTR at $400, $370 call:
• Intrinsic value = $400 − $370 = $30
• If the option is priced at $38, then time value = $38 − $30 = $8

At expiry, an option is worth exactly its intrinsic value (or zero if OTM).`,
  },
  {
    term: "Bid / Ask / Mid",
    short: "Market quotes for buying and selling an option contract",
    full: `• Bid: The highest price a buyer is currently willing to pay for the option.
• Ask: The lowest price a seller is currently willing to accept.
• Mid (Midpoint): (Bid + Ask) / 2 — used as the theoretical fair value for modeling.
• Spread: Ask − Bid. Wide spreads indicate low liquidity (common in low-volume tickers).

Example: MSTR $400 call: Bid $8.00 / Ask $8.80 / Mid $8.40
• If you buy at market, you pay $8.80 (the ask).
• For modeling P&L, the simulator uses the mid price.

Tip: Always try to trade near the mid, especially in liquid names like MSTR. Wide spreads can make a theoretically profitable trade unprofitable in practice.`,
  },
  {
    term: "Open Interest (OI)",
    short: "Total number of outstanding (open) contracts for a given strike/expiry",
    full: `Open interest is the total number of contracts that are currently open (not yet exercised, expired, or closed). Unlike volume, it does not reset each day.

• High OI = many participants have positions at that strike → better liquidity
• Low OI = thin market, wide spreads
• OI increases when new contracts are created and decreases when positions are closed

Example: MSTR $400 call expiring in 3 weeks has OI = 15,000. This means 15,000 contracts (representing 1,500,000 shares) are currently open.

OI concentrations at round strikes (e.g., $400, $450) often create "gamma pinning" near expiry — market makers hedge in ways that can attract the price toward high-OI strikes.`,
  },
  {
    term: "DTE — Days to Expiration",
    short: "Number of calendar days remaining until the option expires",
    full: `DTE is the number of calendar days (or trading days, depending on context) until the option contract expires.

• Options with 0–7 DTE are "weekly" options — highest theta, most speculative
• 30–45 DTE is the "sweet spot" for many options sellers (sufficient premium, manageable gamma)
• 90+ DTE options (LEAPs) are used for longer-term directional bets with lower theta decay rate

Example: An option listed as "2026-06-20" with today being May 1, 2026 has approximately 50 DTE.

Theta decay is NOT linear — it accelerates exponentially in the last 30 days. An OTM option loses value much faster in its final weeks.`,
  },
  {
    term: "Black-Scholes Model",
    short: "Mathematical formula for pricing European-style options",
    full: `Black-Scholes (1973) is the foundational options pricing model. It calculates the theoretical fair value of a European option given:

Inputs:
• S = Current underlying price
• K = Strike price
• T = Time to expiration (in years)
• r = Risk-free interest rate
• σ = Implied volatility (annualized)

Formula (call): C = S·N(d1) − K·e^(−rT)·N(d2)
where d1 = [ln(S/K) + (r + σ²/2)·T] / (σ·√T)
      d2 = d1 − σ·√T

Limitations:
• Assumes constant volatility (real markets have "vol smile/skew")
• Assumes continuous trading and no dividends
• Does not model jumps or gaps
• Works best for European-style options (exercised only at expiry)

The P&L Simulator in this app uses Black-Scholes to model theoretical option values across different price and time scenarios.`,
  },
];

export default function OptionsDefinitions() {
  const [expanded, setExpanded] = useState(null);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Options Glossary & Definitions</h3>
        <span className="text-[10px] text-muted-foreground ml-2">— {DEFINITIONS.length} terms with worked examples</span>
      </div>

      <div className="space-y-1.5">
        {DEFINITIONS.map((def) => {
          const isOpen = expanded === def.term;
          return (
            <div
              key={def.term}
              className="border border-border/50 rounded-lg overflow-hidden"
            >
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/40 transition-colors"
                onClick={() => setExpanded(isOpen ? null : def.term)}
              >
                {isOpen
                  ? <ChevronDown className="w-3.5 h-3.5 text-primary shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                }
                <span className="text-xs font-mono font-bold text-primary min-w-[130px]">{def.term}</span>
                <span className="text-xs text-muted-foreground">{def.short}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-3 pt-1 border-t border-border/30 bg-secondary/20">
                  <pre className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans">
                    {def.full}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground/50 mt-4 text-center">
        Greeks (Delta, Gamma, Theta, Vega) are only available via Polygon.io options snapshot. Yahoo Finance / RapidAPI does not return Greeks — those columns will show "—" when using that data source.
      </p>
    </div>
  );
}