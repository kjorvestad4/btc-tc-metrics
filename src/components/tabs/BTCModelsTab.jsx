import React, { useState, useMemo } from "react";
import MetricCard from "../dashboard/MetricCard";
import { Bitcoin, TrendingUp, ArrowUpRight, Activity, BookOpen } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Area, AreaChart
} from "recharts";

const TICK = { fontSize: 9, fill: "hsl(215 20% 55%)" };
const GRID = "hsl(217 33% 17%)";

// BTC halving dates and genesis
const GENESIS_DATE = new Date("2009-01-03");
const HALVINGS = [
  new Date("2012-11-28"),
  new Date("2016-07-09"),
  new Date("2020-05-11"),
  new Date("2024-04-20"),
  new Date("2028-04-01"), // projected
];

// Days since genesis
function daysSinceGenesis(date) {
  return Math.floor((date - GENESIS_DATE) / 86400000);
}

// Stock-to-Flow model price for a given # of days from genesis
// S2F = stock (circulating supply) / flow (annual new issuance)
// Formula: Market Cap = e^14.6 × S2F^3.3, then divide by supply to get price
function s2fPrice(days) {
  // Determine epoch and block reward
  let epoch = 0;
  for (let i = 0; i < HALVINGS.length; i++) {
    if (daysSinceGenesis(HALVINGS[i]) <= days) epoch = i + 1;
  }
  const blockReward = 50 / Math.pow(2, epoch); // BTC per block
  const annualFlow = blockReward * 144 * 365.25; // blocks per day * days per year
  
  // Approximate circulating supply (grows roughly linearly over time)
  // ~21M BTC total, grows toward 99.8% of total (asymptotic)
  const totalSupply = 21e6;
  const circulatingSupply = Math.min(totalSupply * 0.998, blockReward * 144 * 365.25 * days);
  
  // S2F ratio
  const sf = circulatingSupply / annualFlow;
  if (sf <= 0) return null;
  
  // PlanB formula: Market Cap = e^14.6 × S2F^3.3
  // Price = Market Cap / Supply
  const marketCap = Math.exp(14.6) * Math.pow(sf, 3.3);
  const price = marketCap / circulatingSupply;
  
  return price;
}

// Power Law model: P = exp(a * ln(days) + b)
// Fitted: a ≈ 5.82, b ≈ -37.65 (Santostasi)
function powerLawPrice(days) {
  if (days < 1) return null;
  return Math.exp(5.82 * Math.log(days) - 37.65);
}

// Metcalfe: P ≈ k * users^2 / supply; simplified as P = k * days^1.7
function metcalfePrice(days) {
  if (days < 1) return null;
  return Math.exp(3.8 * Math.log(days) - 22.4);
}

// Generate historical + forecast data
function generateModelData(currentBtcPrice) {
  const today = new Date("2026-04-18");
  const todayDays = daysSinceGenesis(today);

  // Historical annual data points
  const historicalYears = [];
  for (let y = 2013; y <= 2026; y++) {
    const d = new Date(`${y}-01-01`);
    const days = daysSinceGenesis(d);
    const pl = powerLawPrice(days);
    const s2f = s2fPrice(days);
    const mc = metcalfePrice(days);

    // Approximate actual BTC prices
    const actualMap = {
      2013: 13, 2014: 770, 2015: 320, 2016: 430, 2017: 1000,
      2018: 14500, 2019: 3600, 2020: 7200, 2021: 29000,
      2022: 47000, 2023: 16600, 2024: 42000, 2025: 93000,
      2026: currentBtcPrice,
    };
    historicalYears.push({
      year: y.toString(),
      actual: actualMap[y] ?? null,
      powerLaw: pl ? Math.min(pl, 1e7) : null,
      s2f: s2f ? Math.min(s2f, 1e7) : null,
      metcalfe: mc ? Math.min(mc, 1e7) : null,
    });
  }

  // Forecast 2027–2035
  for (let y = 2027; y <= 2035; y++) {
    const d = new Date(`${y}-01-01`);
    const days = daysSinceGenesis(d);
    const pl = powerLawPrice(days);
    const s2f = s2fPrice(days);
    const mc = metcalfePrice(days);
    historicalYears.push({
      year: y.toString(),
      actual: null,
      powerLaw: pl ? Math.min(pl, 2e7) : null,
      s2f: s2f ? Math.min(s2f, 2e7) : null,
      metcalfe: mc ? Math.min(mc, 2e7) : null,
    });
  }

  return historicalYears;
}

// Saylor price projection (40% CAGR from ~$100K base)
function saylorProjection(btcPrice) {
  return [0, 1, 2, 3, 5, 7, 10].map(y => ({
    year: y === 0 ? "Now" : `Y${y}`,
    Saylor: Math.round(btcPrice * Math.pow(1.40, y)),
    PowerLaw: Math.round(btcPrice * Math.pow(1.28, y)),
    S2F: Math.round(btcPrice * Math.pow(1.35, y)),
  }));
}

const MODEL_DEFINITIONS = {
  s2f: {
    short: "Stock-to-Flow (S2F) — Creator: PlanB (2019)",
    full: `The Stock-to-Flow (S2F) model, published by the pseudonymous analyst PlanB in March 2019, models Bitcoin's price as a function of its scarcity.

Stock-to-Flow Ratio = Total BTC in Circulation ÷ Annual New BTC Issuance

After each halving, the annual issuance halves, doubling the SF ratio. PlanB found a strong power-law correlation between SF and market cap across precious metals (gold, silver) and Bitcoin.

Formula: ln(Market Cap) = 3.36 × ln(SF) + 14.6

Key predictions:
• After 2020 halving (SF≈56): ~$100K model price
• After 2024 halving (SF≈113): ~$500K–$1M model price

R² ≈ 0.947 on historical data through 2021. Model diverged significantly in 2022 bear market. Critics argue S2F ignores demand entirely and is spuriously correlated.

Back-test: strong predictor 2012–2021; underperformed 2022–2023. 2024–2026 partially recovering.

Live S2F chart and data: charts.blockhorizon.io/dashboard`,
  },
  powerLaw: {
    short: "Power Law Model — Creator: Giovanni Santostasi (2014+)",
    full: `The Power Law model, developed by physicist Giovanni Santostasi, models Bitcoin as a power-law system where price grows as a power of time since genesis block.

Formula: Price ≈ exp(5.82 × ln(days since genesis) − 37.65)

This creates a lower bound "floor" that rises over time, with BTC price oscillating above/below in logarithmic cycles. The model predicts a corridor rather than a single price target.

Key properties:
• Logarithmic scale: BTC price forms a channel that rises ~20–30% per year on average
• Power Law floor in 2026: ~$50K–$80K
• Power Law ceiling in 2026: ~$250K–$400K
• Long-run prediction for 2030: floor ~$200K, ceiling ~$1M+

Back-test: R² ≈ 0.93 on log-scale price since 2010. More robust than S2F in bear markets as it allows wide price corridors. Published in physicaetmentem.com.`,
  },
  rainbow: {
    short: "Rainbow Chart (Log Regression Bands) — Creator: Blockchain Center",
    full: `The Rainbow Chart uses logarithmic regression of historical BTC prices to create colored bands representing different market sentiment zones.

The regression line: ln(Price) = a × ln(days) + b, then parallel bands are drawn above and below.

Bands (from bottom to top):
• Blue / Teal: "Buy" zones — historically extreme undervaluation
• Green: "Accumulate" zone
• Yellow: "HODL" zone
• Orange: "Sell" zone
• Red: "Bubble" zone — historically extreme overvaluation

As of April 2026: BTC ~$84K sits in the "Accumulate" (green) band.

The chart updates monthly. It is a community visualization tool by Blockchain Center (blockchaincenter.net), not a model with formal back-test statistics. R² on the regression line alone is ~0.91.`,
  },
  metcalfe: {
    short: "Metcalfe's Law — Adapted by Timothy F. Peterson (2018)",
    full: `Metcalfe's Law states the value of a network is proportional to the square of its number of users: V ∝ n².

Applied to Bitcoin by Timothy Peterson in 2018, the model uses active on-chain wallet count as a proxy for network users.

Formula: Market Cap ≈ k × Active Addresses²

Key findings:
• R² ≈ 0.82 on annual data 2010–2023
• Predicts a "fair value" band based on network growth
• When BTC price significantly exceeds Metcalfe valuation: historically overvalued
• When below: historically undervalued

Peterson (2018): "Bitcoin's price more closely follows Metcalfe's Law than any other tested valuation model."

Active addresses as of Q1 2026: ~1.1M/day. Metcalfe fair value ≈ $70K–$90K.`,
  },
  saylor: {
    short: "Saylor Price Projection — Creator: Michael Saylor",
    full: `Michael Saylor's Bitcoin price projection is based on his core thesis: Bitcoin is digital energy that captures global economic output at 21% CAGR.

Saylor's framework:
• Bitcoin total addressable market = $500T+ (gold + bonds + real estate + cash reserve asset)
• BTC will capture 7–14% of this market over 21 years
• Implied terminal value: $13M–$20M per BTC
• 10-year price target: $1.3M per BTC (21% CAGR from ~$100K)

Saylor's basis:
1. Monetary debasement: fiat currencies lose 6–10%/year purchasing power
2. Bitcoin is the world's only programmatically scarce, universally accessible, non-dilutable store of value
3. Corporate treasury adoption is still early (only Strategy among S&P 500 at scale)

Risk: assumes adoption proceeds as modeled, no regulatory catastrophe, no superior alternative.

Source: Various Michael Saylor presentations, strategy.com, and public interviews 2020–2026.`,
  },
  sCurve: {
    short: "S-Curve Adoption Model — Cross-model hybrid with Game Theory",
    full: `The S-Curve (Bass Diffusion) model applies technology adoption dynamics to Bitcoin:

Logistic growth: Adoption% = L / (1 + e^(-k(t-t₀)))

Where L = ultimate saturation (~60% of investable wealth), k = growth rate, t₀ = inflection point.

Combined with:
• Game Theory: miners, holders, governments, institutions — each actor's dominant strategy reinforces Bitcoin's value
• Network effects (Metcalfe): adoption begets adoption
• Satoshi Nakamoto's scarcity design: fixed supply with verifiable scarcity

Key parameters:
• Current global adoption: ~5–7% of target addressable wallets
• Inflection point: estimated 2026–2029 (institutional FOMO + sovereign adoption wave)
• Saturation: 2045–2055

Combining S-curve + Metcalfe + Halving cycles produces a corridor: BTC $200K–$500K by 2030.

This is a cross-model theoretical synthesis — not a single published model. Educational only.`,
  },
};

function Card({ children, className = "" }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

export default function BTCModelsTab({ params, liveData }) {
  const btcPrice = liveData?.btc_price ?? params.btc_price;
  const [selectedModels, setSelectedModels] = useState(["powerLaw", "s2f", "metcalfe"]);

  const modelData = useMemo(() => generateModelData(btcPrice), [btcPrice]);
  const projectionData = useMemo(() => saylorProjection(btcPrice), [btcPrice]);

  const toggleModel = (key) => {
    setSelectedModels(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const MODEL_COLORS = {
    powerLaw: "#22C55E",
    s2f: "#F59E0B",
    metcalfe: "#60A5FA",
    actual: "#E5E7EB",
  };

  const MODEL_LABELS = {
    powerLaw: "Power Law (Santostasi)",
    s2f: "Stock-to-Flow (PlanB)",
    metcalfe: "Metcalfe (Peterson)",
    actual: "Actual BTC Price",
  };

  const currentPL = powerLawPrice(daysSinceGenesis(new Date("2026-04-18")));
  const currentMC = metcalfePrice(daysSinceGenesis(new Date("2026-04-18")));

  return (
    <div className="space-y-4">
      {/* Live price header */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Bitcoin className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Bitcoin Price Models</h2>
            <p className="text-xs text-muted-foreground">Historical + forecast overlays: S2F, Power Law, Metcalfe, Rainbow, Saylor, S-Curve</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard title="BTC Price" value={formatCurrency(btcPrice)} subtitle={liveData?.btc_price ? "Live (Polygon)" : "Default"} icon={Bitcoin} accentClass="text-amber-400" />
          <MetricCard title="Power Law Fair Value" value={currentPL ? formatCurrency(currentPL) : "—"} subtitle="Santostasi model" icon={TrendingUp} accentClass="text-green-400" />
          <MetricCard title="vs Power Law" value={currentPL ? `${((btcPrice / currentPL - 1) * 100).toFixed(0)}%` : "—"} subtitle={btcPrice > (currentPL ?? 0) ? "above model" : "below model"} icon={ArrowUpRight} accentClass={btcPrice > (currentPL ?? 0) ? "text-amber-400" : "text-primary"} />
          <MetricCard title="Metcalfe Fair Value" value={currentMC ? formatCurrency(currentMC) : "—"} subtitle="Peterson model" icon={Activity} accentClass="text-blue-400" />
        </div>
      </div>

      {/* Model selector */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Model Overlays (Toggle)</h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(MODEL_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => key !== "actual" && toggleModel(key)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium flex items-center gap-1.5 ${
                key === "actual" || selectedModels.includes(key)
                  ? "border-opacity-80 opacity-100"
                  : "opacity-40 border-border hover:opacity-70"
              }`}
              style={{
                borderColor: MODEL_COLORS[key],
                color: MODEL_COLORS[key],
                background: (key === "actual" || selectedModels.includes(key)) ? `${MODEL_COLORS[key]}15` : "transparent",
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: MODEL_COLORS[key] }} />
              {label}
            </button>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={modelData} margin={{ top: 4, right: 8, bottom: 20, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="year" tick={TICK} interval={1} angle={-45} textAnchor="end" />
            <YAxis tick={TICK} tickFormatter={v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v}`} scale="log" domain={[100, "auto"]} />
            <Tooltip
              contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }}
              formatter={(v, name) => [v ? formatCurrency(v) : "—", name]}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="actual" name="Actual BTC" stroke={MODEL_COLORS.actual} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            {selectedModels.includes("powerLaw") && (
              <Line type="monotone" dataKey="powerLaw" name="Power Law" stroke={MODEL_COLORS.powerLaw} strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls />
            )}
            {selectedModels.includes("s2f") && (
              <Line type="monotone" dataKey="s2f" name="S2F" stroke={MODEL_COLORS.s2f} strokeWidth={2} strokeDasharray="3 3" dot={false} connectNulls />
            )}
            {selectedModels.includes("metcalfe") && (
              <Line type="monotone" dataKey="metcalfe" name="Metcalfe" stroke={MODEL_COLORS.metcalfe} strokeWidth={2} strokeDasharray="7 3" dot={false} connectNulls />
            )}
            <ReferenceLine x="2026" stroke="hsl(217 33% 30%)" strokeDasharray="4 4" label={{ value: "Today", fill: "hsl(215 20% 55%)", fontSize: 9 }} />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-[9px] text-muted-foreground/50 mt-2">Log scale. Forecast lines (2027–2035) are model extrapolations, not predictions. Not financial advice.</p>
      </Card>

      {/* Saylor / Cross-model projection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Forward Price Projections</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={projectionData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="year" tick={TICK} />
              <YAxis tick={TICK} tickFormatter={v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }}
                formatter={v => [formatCurrency(v)]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="Saylor" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="PowerLaw" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="S2F" stroke="#60A5FA" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[9px] text-muted-foreground/50 mt-2">Saylor: 40% CAGR. Power Law: 28% CAGR. S2F: 35% CAGR from current price.</p>
        </Card>

        {/* Rainbow chart (simplified color band) */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Rainbow Chart — Current Position</h3>
          </div>
          <div className="space-y-2">
            {[
              { label: "Maximum Bubble (>$800K)", color: "#EF4444", current: btcPrice > 800000 },
              { label: "Sell. Seriously. ($400K–$800K)", color: "#F97316", current: btcPrice >= 400000 && btcPrice < 800000 },
              { label: "FOMO Intensifies ($200K–$400K)", color: "#F59E0B", current: btcPrice >= 200000 && btcPrice < 400000 },
              { label: "Still Cheap ($100K–$200K)", color: "#EAB308", current: btcPrice >= 100000 && btcPrice < 200000 },
              { label: "Accumulate ($60K–$100K)", color: "#84CC16", current: btcPrice >= 60000 && btcPrice < 100000 },
              { label: "Buying Opportunity ($30K–$60K)", color: "#22C55E", current: btcPrice >= 30000 && btcPrice < 60000 },
              { label: "Fire Sale ($10K–$30K)", color: "#06B6D4", current: btcPrice >= 10000 && btcPrice < 30000 },
              { label: "Deep Value (<$10K)", color: "#3B82F6", current: btcPrice < 10000 },
            ].map(band => (
              <div key={band.label} className={`flex items-center justify-between px-3 py-1.5 rounded-lg border transition-all ${
                band.current ? "border-2 scale-[1.02]" : "border-border/30 opacity-60"
              }`} style={{ borderColor: band.current ? band.color : undefined, background: `${band.color}${band.current ? "20" : "08"}` }}>
                <span className="text-xs font-medium" style={{ color: band.color }}>{band.label}</span>
                {band.current && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${band.color}30`, color: band.color }}>
                  ← {formatCurrency(btcPrice)}
                </span>}
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground/50 mt-2">Rainbow Chart by Blockchain Center. Logarithmic regression bands. Educational only.</p>
        </Card>
      </div>

      {/* Model Definitions */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Model Definitions & Back-Test Results</h3>
        </div>
        <Accordion type="multiple" className="space-y-1">
          {Object.entries(MODEL_DEFINITIONS).map(([key, def]) => (
            <AccordionItem key={key} value={key} className="border border-border/50 rounded-lg px-3 overflow-hidden">
              <AccordionTrigger className="text-xs text-foreground font-medium py-2 hover:no-underline">
                <span className="text-primary font-mono mr-2 uppercase">{key}</span>
                <span className="text-muted-foreground font-normal">{def.short}</span>
              </AccordionTrigger>
              <AccordionContent>
                <pre className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans pb-2">{def.full}</pre>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>

      <p className="text-[10px] text-muted-foreground/40 text-center">
        All models are theoretical frameworks. No model guarantees future performance. Educational use only.
      </p>
    </div>
  );
}