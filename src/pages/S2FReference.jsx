import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bitcoin, BookOpen, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';

function SectionCard({ icon: Icon, title, color = 'text-primary', children }) {
  return (
    <Card className="p-4 border border-border bg-card">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-5 h-5 ${color}`} />
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{title}</h3>
      </div>
      <div className="text-sm text-foreground leading-relaxed space-y-3">{children}</div>
    </Card>
  );
}

export default function S2FReference() {
  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/30 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Bitcoin className="w-7 h-7 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Plan B's Stock-to-Flow (S2F) Formula & Bitcoin Valuation Model</h1>
            <p className="text-sm text-muted-foreground mt-1">April 18, 2026 Update — Authoritative Reference</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge className="bg-primary/20 text-primary">Scarcity-Based Model</Badge>
              <Badge className="bg-accent/20 text-accent">Power-Law Regression</Badge>
              <Badge className="bg-green-500/20 text-green-400">Halving-Driven</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Reference Card (Highlighted) */}
      <Card className="p-6 border-2 border-primary bg-primary/5">
        <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" /> Quick Reference Card
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Core Definition</p>
            <div className="p-3 bg-card rounded-lg border border-border">
              <p className="text-sm font-mono text-foreground">S2F = Stock / Flow</p>
              <p className="text-xs text-muted-foreground mt-1">Stock = circulating supply (~19.8M BTC)</p>
              <p className="text-xs text-muted-foreground">Flow = annual production (~164k BTC post-2024 halving)</p>
              <p className="text-base font-bold text-amber-400 mt-2">Current S2F ≈ 120–122</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Original Power-Law Formula</p>
            <div className="p-3 bg-card rounded-lg border border-border font-mono text-xs">
              <p className="text-foreground mb-2">ln(Market Value) = 3.3 × ln(S2F) + 14.6</p>
              <p className="text-foreground mb-2">Market Value = e^14.6 × S2F^3.3</p>
              <p className="text-primary font-semibold">R² = 95% (2009–2019 data)</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-semibold uppercase">S2FX Cross-Asset Extension</p>
            <div className="p-3 bg-card rounded-lg border border-border font-mono text-xs">
              <p className="text-foreground mb-2">Market Value = e^12.7598 × S2F^4.1167</p>
              <p className="text-cyan-400 font-semibold">R² = 99.7% (includes gold, silver phases)</p>
              <p className="text-muted-foreground mt-2">2020–2024: forecast ~$288k BTC</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Predicted Price Bands (April 2026)</p>
            <div className="p-3 bg-card rounded-lg border border-border">
              <p className="text-sm"><span className="text-primary font-bold">Original S2F:</span> $150k–$300k BTC</p>
              <p className="text-sm"><span className="text-cyan-400 font-bold">S2FX variant:</span> $250k–$500k+ BTC</p>
              <p className="text-xs text-muted-foreground mt-2">Depends on live stock data; community dashboard values vary</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Main Criticisms</p>
            <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/30 space-y-1">
              <p className="text-xs text-foreground"><strong>Circular Reasoning:</strong> Market value = price × stock; stock in S2F</p>
              <p className="text-xs text-foreground"><strong>Demand Omitted:</strong> Pure supply scarcity; ignores adoption/macro</p>
              <p className="text-xs text-foreground"><strong>Timing Unknown:</strong> Fair-value bands, not precise price timing</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Best Use Case</p>
            <div className="p-3 bg-green-500/5 rounded-lg border border-green-500/30">
              <p className="text-sm font-semibold text-green-400">Long-term conviction heuristic, not short-term trading</p>
              <p className="text-xs text-muted-foreground mt-2">Combine with on-chain metrics, macro analysis, power-law corridors</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabbed Full Reference */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 mb-6">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="formula" className="text-xs">Formula</TabsTrigger>
          <TabsTrigger value="regression" className="text-xs">Regression</TabsTrigger>
          <TabsTrigger value="s2fx" className="text-xs">S2FX</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
          <TabsTrigger value="criticisms" className="text-xs">Criticisms</TabsTrigger>
          <TabsTrigger value="status" className="text-xs">Status 2026</TabsTrigger>
          <TabsTrigger value="sources" className="text-xs">Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <SectionCard icon={BookOpen} title="1. Overview and Origin of the Model" color="text-primary">
            <p>
              Plan B's Stock-to-Flow (S2F) model is a scarcity-based valuation framework for Bitcoin introduced in March 2019 by the pseudonymous analyst PlanB (@100trillionUSD) in the Medium article <em>"Modeling Bitcoin Value with Scarcity."</em> It treats Bitcoin like scarce commodities such as gold or silver, arguing that price is primarily driven by the ratio of existing supply (stock) to new annual production (flow).
            </p>
            <p>
              The model gained massive popularity for its high historical R² fit (~95%) and bold price predictions tied to Bitcoin's halving cycles, though it remains controversial due to criticisms around circular reasoning, demand omission, and recent deviations from actual price in certain market cycles.
            </p>
            <p className="text-xs text-muted-foreground italic">
              Created: March 2019 | Primary Author: PlanB | Current Update: April 18, 2026
            </p>
          </SectionCard>
        </TabsContent>

        <TabsContent value="formula" className="space-y-4">
          <SectionCard icon={TrendingUp} title="2. Core Stock-to-Flow Formula and Calculation Steps" color="text-amber-400">
            <div>
              <p className="font-semibold text-foreground mb-2">Foundational Ratio:</p>
              <div className="p-3 bg-card border border-border rounded-lg font-mono text-sm mb-3">
                S2F = Stock / Flow
              </div>
            </div>

            <div>
              <p className="font-semibold text-foreground mb-2">Where:</p>
              <ul className="space-y-1 text-sm ml-4 list-disc">
                <li><strong>Stock</strong> = current circulating supply of Bitcoin (≈19.8 million BTC as of April 2026)</li>
                <li><strong>Flow</strong> = new Bitcoin produced annually = (block reward) × (144 blocks/day) × (365.25 days/year)</li>
              </ul>
            </div>

            <div className="mt-4">
              <p className="font-semibold text-foreground mb-2">Current Calculation (Post-April 2024 Halving):</p>
              <ul className="space-y-1 text-sm ml-4 list-disc">
                <li>Block reward = 3.125 BTC</li>
                <li>Annual flow ≈ 3.125 × 144 × 365.25 ≈ 164,250 BTC/year</li>
                <li><strong>Current S2F ≈ 19,800,000 / 164,250 ≈ 120–122</strong></li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              <strong>Interpretation:</strong> Roughly 120 years of current production needed to match existing stock. Higher S2F = greater scarcity → higher modeled price. Note: S2F = 1 / supply growth rate.
            </p>
          </SectionCard>
        </TabsContent>

        <TabsContent value="regression" className="space-y-4">
          <SectionCard icon={TrendingUp} title="3. Mathematical Regression and Price Prediction Formula" color="text-primary">
            <div>
              <p className="font-semibold text-foreground mb-2">Original Model (2019):</p>
              <p className="text-sm text-muted-foreground mb-2">PlanB performed linear regression on monthly historical data (2009–2019, 111 data points) of Bitcoin's market capitalization vs. S2F, achieving a 95% R² fit. The result is:</p>
              <div className="p-4 bg-card border border-border rounded-lg space-y-3 font-mono text-sm">
                <p className="text-foreground">ln(Market Value) = 3.3 × ln(S2F) + 14.6</p>
                <p className="text-foreground">Which rewrites as the power-law function:</p>
                <p className="text-primary font-semibold">Market Value (USD) = e^14.6 × S2F^3.3</p>
                <p className="text-foreground">Or for BTC price (dividing by stock):</p>
                <p className="text-cyan-400 font-semibold">BTC Price ≈ 0.4 × S2F^3.3</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="font-semibold text-foreground mb-2">Historical Accuracy:</p>
              <ul className="space-y-1 text-sm ml-4 list-disc">
                <li>Backtested across ~11 years and 8+ orders of magnitude in market cap</li>
                <li>95% R² indicates the model explained 95% of variance in BTC market value historically</li>
                <li>Post-2020 halving: predicted ~$55,000 BTC (actual peak: ~$69k in 2021)</li>
                <li>Post-2022: model has deviated at times, raising questions about predictive power in new market regimes</li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground italic mt-3">
              Important: High historical R² does not guarantee future predictive accuracy, especially over shorter timeframes or in structural market shifts.
            </p>
          </SectionCard>
        </TabsContent>

        <TabsContent value="s2fx" className="space-y-4">
          <SectionCard icon={TrendingUp} title="4. S2FX Cross-Asset Extension" color="text-cyan-400">
            <div>
              <p className="text-sm mb-3">
                In 2020, PlanB expanded the model to the <strong>Stock-to-Flow Cross-Asset (S2FX)</strong> model by incorporating historical data from gold, silver, and other scarce assets. This variant treats Bitcoin's price history in distinct "phases" or clusters with step-function increases in S2F, allowing it to capture longer-term cycle behavior.
              </p>
            </div>

            <div className="p-4 bg-card border border-border rounded-lg space-y-3 font-mono text-sm">
              <p className="text-foreground">S2FX Regression Formula:</p>
              <p className="text-cyan-400 font-semibold">Market Value = e^12.7598 × S2F^4.1167</p>
              <p className="text-foreground">Regression R² = 99.7% (multi-asset phase data)</p>
            </div>

            <div className="mt-4">
              <p className="font-semibold text-foreground mb-2">Key Differences from Original S2F:</p>
              <ul className="space-y-1 text-sm ml-4 list-disc">
                <li>Higher exponent (4.1167 vs. 3.3) → more aggressive scarcity pricing</li>
                <li>Incorporates scarce metals and assets → treats Bitcoin as part of "digital scarcity class"</li>
                <li>2020–2024 phase: forecasted ~$288,000 BTC (significantly higher than original model)</li>
                <li>Often used for longer-term (5–10 year) cycle projections</li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              S2FX is considered more conservative on short-term timing but more bullish on long-term fair value. Community tools and dashboards often display both S2F and S2FX bands for comparison.
            </p>
          </SectionCard>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <SectionCard icon={Bitcoin} title="5. Application to Bitcoin Halvings and Historical Performance" color="text-amber-400">
            <div>
              <p className="text-sm mb-3">
                Bitcoin halvings occur approximately every 4 years (210,000 blocks). Each halving cuts the block reward and therefore the annual flow, instantly <strong>doubling S2F</strong> and creating a scarcity shock. The S2F model hypothesizes this drives subsequent price appreciation.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                <p className="font-semibold text-foreground mb-2">Historical Halving Cycles:</p>
                <ul className="space-y-1 text-sm ml-4 list-disc">
                  <li><strong>2012 Halving:</strong> S2F jumped from ~5 → ~12; preceded major bull run</li>
                  <li><strong>2016 Halving:</strong> S2F jumped to ~25; model fit remained strong</li>
                  <li><strong>2020 Halving:</strong> S2F jumped to ~50–56; bull run peak ~$69k (2021) vs. model prediction ~$55k–$100k</li>
                  <li><strong>2024 Halving:</strong> S2F jumped to ~120–122; post-halving dynamics still unfolding</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-foreground mb-2">Backtested Fit:</p>
                <ul className="space-y-1 text-sm ml-4 list-disc">
                  <li>Monthly regression (2009–2019): captured 95%+ of variance</li>
                  <li>Price swings around modeled trend visible but generally within 2–3× range historically</li>
                  <li>Pre-2022: model remained highly predictive</li>
                  <li>Post-2022: deviations noted in some cycles, partly due to macro shocks (FTX collapse, rate hikes, etc.)</li>
                </ul>
              </div>
            </div>

            <p className="text-xs text-muted-foreground italic mt-3">
              Key insight: S2F thrives in stable macro regimes; black-swan events or structural shifts can cause temporary deviations that persist for quarters or years.
            </p>
          </SectionCard>
        </TabsContent>

        <TabsContent value="criticisms" className="space-y-4">
          <SectionCard icon={AlertCircle} title="6. Criticisms, Limitations, Edge Cases, and Nuances" color="text-destructive">
            <div className="space-y-4">
              <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/30">
                <p className="font-semibold text-foreground mb-1">Circular Reasoning Critique</p>
                <p className="text-sm">Market value = price × stock. The S2F ratio uses stock in the denominator, yet stock is also embedded in the left-hand side (market value). Some economists argue this violates independence assumptions in regression.</p>
              </div>

              <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/30">
                <p className="font-semibold text-foreground mb-1">Omission of Demand Factors</p>
                <p className="text-sm">Model focuses solely on supply-side scarcity. It ignores adoption curves, macroeconomic liquidity, regulatory changes, Bitcoin's technical evolution, or investor sentiment—all of which influence price.</p>
              </div>

              <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/30">
                <p className="font-semibold text-foreground mb-1">Time-Series vs. Cross-Sectional Concerns</p>
                <p className="text-sm">Early data was time-ordered (monthly from 2009–2019), raising statistical questions about autocorrelation and whether regression parameters remain stable across market regimes.</p>
              </div>

              <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/30">
                <p className="font-semibold text-foreground mb-1">Edge Cases and Black Swans</p>
                <p className="text-sm">Extreme volatility around halvings, sudden regulatory bans, mining hardware obsolescence, or macro crises (2022 FTX collapse, Fed rate hikes) can cause major deviations from model prediction. Model does not forecast <em>exact timing</em>—only fair-value bands.</p>
              </div>

              <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/30">
                <p className="font-semibold text-foreground mb-1">Not a Trading Signal</p>
                <p className="text-sm">Like high-yield ETFs, S2F is a long-term scarcity heuristic, not a short-term trading tool. Over-reliance in volatile markets has led to disappointment and psychological pressure for some traders.</p>
              </div>

              <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/30">
                <p className="font-semibold text-foreground mb-1">Community Variants and Smoothing</p>
                <p className="text-sm">Community tools (e.g., LookIntoBitcoin, TradingView) often use 365-day smoothed S2F, blended models, or confidence intervals, which can diverge from the original formula. No single "official" version post-2020.</p>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <SectionCard icon={CheckCircle2} title="7. Current Status (April 2026) and Practical Implications" color="text-green-400">
            <div className="space-y-4">
              <div className="p-4 bg-green-500/5 rounded-lg border border-green-500/30">
                <p className="font-semibold text-foreground mb-2">S2F Snapshot (April 18, 2026):</p>
                <ul className="space-y-1 text-sm ml-4 list-disc">
                  <li>Current S2F: ~120–122 (post-April 2024 halving)</li>
                  <li>Original S2F model target: ~$150k–$300k BTC (depending on exact stock/flow data)</li>
                  <li>S2FX model target: ~$250k–$500k+ BTC (higher phase prediction)</li>
                  <li>Community dashboards show wide bands; live data varies by data source</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-foreground mb-2">Model Adoption Status:</p>
                <ul className="space-y-1 text-sm ml-4 list-disc">
                  <li>Still widely cited by macro analysts, long-term investors, and crypto newsletters</li>
                  <li>Less relied upon by quant traders due to recent deviations and timing uncertainty</li>
                  <li>Institutional interest remains high as a "scarcity heuristic" for fair-value estimates</li>
                  <li>Monitored closely ahead of 2028 halving (next major S2F jump to ~240+)</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-foreground mb-2">Best Practices for Investors:</p>
                <ul className="space-y-1 text-sm ml-4 list-disc">
                  <li><strong>Long-term conviction holders:</strong> Use S2F as part of a multi-model framework (on-chain metrics, macro analysis, power-law corridors)</li>
                  <li><strong>Not suitable for:</strong> Precise short-term trading, market timing, or sole reliance</li>
                  <li><strong>Risk awareness:</strong> Model deviations can be substantial; past performance ≠ future results</li>
                  <li><strong>Cross-reference:</strong> Always check live data from CoinMetrics, Glassnode, or PlanB's official updates</li>
                </ul>
              </div>

              <p className="text-xs text-muted-foreground italic">
                Bitcoin remains highly volatile and multifactorial. S2F provides one lens on scarcity-driven fair value, but should be combined with other tools and a clear risk management strategy.
              </p>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <SectionCard icon={BookOpen} title="8. Sources / Date / Last Updated" color="text-blue-400">
            <div className="space-y-3">
              <div className="p-3 bg-card border border-border rounded-lg">
                <p className="font-semibold text-foreground">Primary References:</p>
                <ul className="space-y-1 text-sm mt-2 ml-4 list-disc">
                  <li>PlanB, "Modeling Bitcoin Value with Scarcity" (Medium, March 2019)</li>
                  <li>PlanB, "Stock-to-Flow Cross-Asset Model" (Medium, 2020)</li>
                  <li>LookIntoBitcoin.com — Community S2F/S2FX charts and 365-day smoothing</li>
                  <li>CoinMetrics.io — On-chain S2F calculations and historical data</li>
                  <li>Glassnode — Advanced scarcity metrics and halving analysis</li>
                </ul>
              </div>

              <div className="p-3 bg-card border border-border rounded-lg">
                <p className="font-semibold text-foreground">Data Provenance:</p>
                <p className="text-sm mt-2">All formulas, R² values, historical halvings, and current S2F calculations are based on publicly available sources and PlanB's published work. Stock and flow calculations updated as of April 18, 2026.</p>
              </div>

              <div className="p-3 bg-card border border-border rounded-lg">
                <p className="font-semibold text-foreground">Last Updated:</p>
                <p className="text-sm mt-2"><strong>April 18, 2026</strong> — Entry created as authoritative reference for S2F, S2FX, PlanB, Bitcoin halvings, and scarcity-based valuation models.</p>
              </div>

              <div className="p-3 bg-card border border-border rounded-lg">
                <p className="font-semibold text-foreground">Disclaimer:</p>
                <p className="text-sm mt-2 text-muted-foreground italic">
                  This entry is for informational and educational purposes. It does not constitute financial advice. Bitcoin is highly volatile. Always conduct your own research, consult a financial advisor, and manage risk carefully. Models evolve; check live data sources regularly.
                </p>
              </div>
            </div>
          </SectionCard>

          <div className="p-4 bg-primary/5 border border-primary/30 rounded-xl">
            <p className="text-sm font-semibold text-foreground mb-2">Summary & Next Steps</p>
            <p className="text-sm text-muted-foreground">
              Plan B's Stock-to-Flow model provides a rigorous, scarcity-driven framework that has shaped Bitcoin valuation discussions for years. It highlights how halvings structurally increase scarcity, driving long-term price expectations. However, it should be used alongside other tools given its limitations and the evolving macro/micro dynamics of crypto markets. This reference is now persistent and searchable across the app.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}