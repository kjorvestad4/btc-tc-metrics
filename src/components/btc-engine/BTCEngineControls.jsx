import React, { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal, RotateCcw, HelpCircle } from "lucide-react";
import { DEFAULT_PARAMS } from "@/lib/btcEngine";

function ParamSlider({ label, value, min, max, step, onChange, format, color, explanation }) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1 relative">
          <Label className="text-[10px] text-muted-foreground">{label}</Label>
          {explanation && (
            <button
              onMouseEnter={() => setShowHelp(true)}
              onMouseLeave={() => setShowHelp(false)}
              onClick={() => setShowHelp(!showHelp)}
              className="text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <HelpCircle className="w-3 h-3" />
            </button>
          )}
          {showHelp && explanation && (
            <div className="absolute left-0 top-5 z-20 w-52 p-2.5 rounded-lg bg-popover border border-border text-[9px] text-muted-foreground leading-relaxed shadow-xl">
              {explanation}
            </div>
          )}
        </div>
        <span className="text-[10px] font-mono font-semibold" style={{ color }}>{format(value)}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
    </div>
  );
}

export default function BTCEngineControls({ params, onChange, onReset }) {
  const update = (key, val) => onChange({ ...params, [key]: val });

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Parameter Tuning</h3>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ParamSlider
          label="Drift (annual %)"
          value={params.drift}
          min={-0.3} max={0.8} step={0.01}
          onChange={(v) => update("drift", v)}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          color="#22C55E"
          explanation="The baseline annual growth rate of BTC. 40% means the simulation assumes BTC grows 40% per year on average before volatility. Higher drift = more bullish projection. Negative values model decline scenarios."
        />
        <ParamSlider
          label="Volatility (annual %)"
          value={params.volatility}
          min={0.2} max={1.5} step={0.01}
          onChange={(v) => update("volatility", v)}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          color="#F59E0B"
          explanation="How much BTC price swings up and down each year. 70% means annual price can easily swing ±70%. Higher volatility = wider spread between bear and bull outcomes. BTC historically runs 60–80% annual vol."
        />
        <ParamSlider
          label="Herding Boost"
          value={params.herding_boost}
          min={0} max={6} step={0.1}
          onChange={(v) => update("herding_boost", v)}
          format={(v) => `${v.toFixed(1)}x`}
          color="#A855F7"
          explanation="Momentum feedback factor — how much recent price movement amplifies future movement. Higher values model stronger FOMO/panic cycles where rising prices attract more buyers (and vice versa). 0 = no momentum effect."
        />
        <ParamSlider
          label="Beta1 (growth coef)"
          value={params.beta1}
          min={3} max={8} step={0.05}
          onChange={(v) => update("beta1", v)}
          format={(v) => v.toFixed(2)}
          color="#60A5FA"
          explanation="Long-term adoption curve coefficient — models BTC's network growth trajectory over multi-year horizons. Higher values produce steeper long-term growth. Based on Metcalfe's Law and power-law Bitcoin valuation models."
        />
        <ParamSlider
          label="Treasury Pressure (BTC/day)"
          value={params.treasury_pressure}
          min={0} max={3000} step={50}
          onChange={(v) => update("treasury_pressure", v)}
          format={(v) => `${v} BTC`}
          color="#06B6D4"
          explanation="Estimated daily net BTC buying from corporate treasuries, ETFs, and institutional buyers. 500 BTC/day = ~$30M daily buy pressure at $60K. Higher values push prices up faster by adding sustained demand."
        />
        <ParamSlider
          label="Hash Shock (-1 to 1)"
          value={params.hash_shock}
          min={-1} max={1} step={0.05}
          onChange={(v) => update("hash_shock", v)}
          format={(v) => v.toFixed(2)}
          color="#EF4444"
          explanation="Simulates a disruption to Bitcoin's mining network. Negative values (e.g. -0.35) model miner capitulation — miners shutting down and selling reserves, creating negative supply shock. Positive models hash rate surges. Fades over ~60 days."
        />
        <ParamSlider
          label="Simulations"
          value={params.simulations}
          min={100} max={2000} step={100}
          onChange={(v) => update("simulations", v)}
          format={(v) => `${v}`}
          color="#94A3B8"
          explanation="Number of independent price paths to simulate. More paths = smoother percentile bands and more statistically reliable results, but takes longer to compute. 500 is a good balance of accuracy and speed."
        />
        <ParamSlider
          label="Horizon (years)"
          value={params.horizon_years}
          min={0.5} max={10} step={0.5}
          onChange={(v) => update("horizon_years", v)}
          format={(v) => `${v.toFixed(1)}y`}
          color="#94A3B8"
          explanation="How far into the future to project BTC prices. The chart X-axis shows calendar years starting from today. Longer horizons produce wider outcome ranges due to compounding volatility."
        />
      </div>
    </div>
  );
}