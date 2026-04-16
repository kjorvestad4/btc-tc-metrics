import React, { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, Info, RotateCcw, Bitcoin, TrendingUp, Layers, BarChart3, Key, Eye, EyeOff } from "lucide-react";
import { DEFAULT_PARAMS } from "@/lib/calculations";
import PreferredCard from "./PreferredCard";

function ParamSlider({ label, value, onChange, min, max, step = 1, format, tooltip }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger><Info className="w-3 h-3 text-muted-foreground/40" /></TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-xs">{tooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-24 h-6 text-xs text-right font-mono bg-secondary border-border"
        />
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="py-1"
      />
      {format && <div className="text-[10px] text-muted-foreground/60 text-right">{format(value)}</div>}
    </div>
  );
}

function Section({ icon: Icon, title, children, defaultOpen = true }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-border pb-3">
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 group">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">{title}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export default function ParameterPanel({ params, onParamsChange, preferreds, onPreferredsChange, isOpen, onClose, polygonKey, onPolygonKeyChange }) {
  const [showApiKey, setShowApiKey] = useState(false);

  const updateParam = (key, value) => {
    onParamsChange({ ...params, [key]: value });
  };

  const resetDefaults = () => {
    onParamsChange(DEFAULT_PARAMS);
  };

  return (
    <aside className={`
      fixed lg:sticky top-14 left-0 z-40 h-[calc(100vh-3.5rem)] w-72 bg-card border-r border-border
      overflow-y-auto transition-transform duration-300
      ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
    `}>
      <div className="p-4 space-y-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Parameters</h2>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground" onClick={resetDefaults}>
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
        </div>

        <Section icon={Bitcoin} title="Bitcoin">
          <ParamSlider label="BTC Price" value={params.btc_price} onChange={(v) => updateParam("btc_price", v)} min={10000} max={1000000} step={500} tooltip="Current Bitcoin price in USD" />
          <ParamSlider label="BTC CAGR %" value={params.btc_cagr} onChange={(v) => updateParam("btc_cagr", v)} min={5} max={100} step={1} tooltip="Projected Bitcoin compound annual growth rate" />
          <ParamSlider label="BTC Holdings" value={params.mstr_btc_holdings} onChange={(v) => updateParam("mstr_btc_holdings", v)} min={100000} max={1000000} step={1000} tooltip="Strategy's total BTC holdings" />
          <ParamSlider label="BTC/Qtr Accum." value={params.btc_accumulation_per_quarter} onChange={(v) => updateParam("btc_accumulation_per_quarter", v)} min={0} max={50000} step={500} tooltip="Quarterly BTC acquisition rate" />
        </Section>

        <Section icon={TrendingUp} title="MSTR / Strategy">
          <ParamSlider label="MSTR Price" value={params.mstr_price} onChange={(v) => updateParam("mstr_price", v)} min={50} max={5000} step={1} tooltip="Current MSTR stock price" />
          <ParamSlider label="Shares (M)" value={params.mstr_shares_outstanding} onChange={(v) => updateParam("mstr_shares_outstanding", v)} min={100} max={2000} step={5} tooltip="Shares outstanding in millions" />
          <ParamSlider label="Amplification" value={params.amplification_ratio} onChange={(v) => updateParam("amplification_ratio", v)} min={0.5} max={5} step={0.1} tooltip="Market cap ÷ BTC NAV. Per PunterJeff: the 'amplification ratio' reflects MSTR's premium as a Bitcoin treasury / fiat debasement insurer." />
          <ParamSlider label="Premium Multiple" value={params.premium_multiple} onChange={(v) => updateParam("premium_multiple", v)} min={0.5} max={3} step={0.05} tooltip="Additional premium multiple applied to mNAV × amplification" />
          <ParamSlider label="Dilution/Qtr %" value={params.dilution_rate_per_quarter} onChange={(v) => updateParam("dilution_rate_per_quarter", v)} min={0} max={5} step={0.1} tooltip="Quarterly share dilution from ATM offerings and conversions" />
          <ParamSlider label="Earnings CAGR %" value={params.earnings_cagr} onChange={(v) => updateParam("earnings_cagr", v)} min={10} max={100} step={1} tooltip="Per @PunterJeff: 50% net-of-dilution earnings CAGR from BTC accumulation. The 'digital credit' flywheel." />
        </Section>

        <Section icon={BarChart3} title="MSTY / Volatility" defaultOpen={false}>
          <ParamSlider label="MSTR IV %" value={params.mstr_iv} onChange={(v) => updateParam("mstr_iv", v)} min={20} max={200} step={1} tooltip="MSTR implied volatility — drives MSTY option income. Higher IV = higher covered call premiums." />
          <ParamSlider label="MSTY NAV" value={params.msty_nav} onChange={(v) => updateParam("msty_nav", v)} min={5} max={100} step={0.5} tooltip="Current MSTY net asset value per share" />
          <ParamSlider label="Participation %" value={params.msty_participation_rate} onChange={(v) => updateParam("msty_participation_rate", v)} min={20} max={100} step={1} tooltip="MSTY's participation rate in MSTR upside. Capped by the covered call structure." />
          <ParamSlider label="Proj. Years" value={params.projection_years} onChange={(v) => updateParam("projection_years", v)} min={1} max={10} step={1} />
        </Section>

        <Section icon={Layers} title="Perpetual Preferreds" defaultOpen={false}>
          {preferreds.map((pref, i) => (
            <PreferredCard
              key={pref.ticker}
              preferred={pref}
              onChange={(updated) => {
                const newPrefs = [...preferreds];
                newPrefs[i] = updated;
                onPreferredsChange(newPrefs);
              }}
            />
          ))}
        </Section>

        {/* Polygon.io API Key */}
        <div className="border-b border-border pb-3">
          <div className="flex items-center gap-2 py-2">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Live Data API</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Polygon.io API Key</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger><Info className="w-3 h-3 text-muted-foreground/40" /></TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs text-xs">
                    Free Polygon.io key unlocks live MSTR/MSTY prices, 30-day ATM IV, and latest 5 MSTY dividend events. Get one free at polygon.io
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                value={polygonKey}
                onChange={(e) => onPolygonKeyChange(e.target.value)}
                placeholder="Enter key for live stock data…"
                className="h-7 text-xs pr-8 bg-secondary border-border font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
            <div className={`text-[10px] px-2 py-1 rounded ${polygonKey ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
              {polygonKey
                ? "✓ Polygon key set — Refresh to pull live MSTR/MSTY/IV"
                : "Without key: BTC (CoinGecko) + Strategy.com holdings only"}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
          Educational model inspired by @PunterJeff — not financial advice. Parameters default to approximate real-world values.
        </p>
      </div>
    </aside>
  );
}