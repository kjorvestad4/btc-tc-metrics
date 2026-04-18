import React, { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/calculations";
import { MSTY_DISTRIBUTION_HISTORY } from "@/lib/marketData";
import { DollarSign, TrendingUp, Layers, BarChart3, Bitcoin } from "lucide-react";

// Static default prices (overridden by liveData when available)
const ASSET_DEFAULTS = {
  MSTR:  { label: "MSTR",  color: "text-primary",    price: 166.52, icon: TrendingUp,  desc: "Strategy common stock" },
  ASST:  { label: "ASST",  color: "text-blue-400",   price: 12.50,  icon: TrendingUp,  desc: "Strive Asset Management" },
  STRC:  { label: "STRC",  color: "text-green-400",  price: 99.21,  icon: Layers,      desc: "11.5% variable preferred · $0.959/sh/mo" },
  SATA:  { label: "SATA",  color: "text-violet-400", price: 99.45,  icon: Layers,      desc: "13% variable preferred (ASST)" },
  STRF:  { label: "STRF",  color: "text-cyan-400",   price: 92.50,  icon: Layers,      desc: "10% fixed preferred · $10/sh/yr" },
  STRK:  { label: "STRK",  color: "text-amber-400",  price: 87.00,  icon: Layers,      desc: "8% fixed preferred (convertible)" },
  STRD:  { label: "STRD",  color: "text-orange-400", price: 77.14,  icon: Layers,      desc: "10% BTC-denom. preferred" },
  MSTY:  { label: "MSTY",  color: "text-yellow-400", price: 22.50,  icon: BarChart3,   desc: "YieldMax MSTR Income ETF · weekly divs" },
};

// Annual income per share for income instruments (static fallbacks)
const ANNUAL_INCOME_PER_SHARE = {
  STRC: 11.50,   // 11.5% × $100 par — variable, approximately
  SATA: 13.00,   // 13% × $100 par — variable
  STRF: 10.00,   // 10% × $100 par
  STRK: 8.00,    // 8% × $100 par
  STRD: 10.00,   // 10% × $100 par (BTC-denom, approximate)
  MSTY: (MSTY_DISTRIBUTION_HISTORY.reduce((s, d) => s + d.amount, 0) / MSTY_DISTRIBUTION_HISTORY.length) * 52,
};

function AssetRow({ ticker, asset, price, shares, setShares, annualIncome }) {
  const Icon = asset.icon;
  const investmentValue = shares * price;
  const yearlyIncome = annualIncome ? shares * (annualIncome / 1) : null;
  const monthlyIncome = yearlyIncome ? yearlyIncome / 12 : null;
  const yieldPct = yearlyIncome && investmentValue > 0 ? (yearlyIncome / investmentValue) * 100 : null;

  return (
    <div className="bg-secondary/30 border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-3.5 h-3.5 ${asset.color}`} />
          <span className={`text-sm font-bold ${asset.color}`}>{ticker}</span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">{asset.desc}</span>
        </div>
        <span className="text-xs font-mono text-foreground">${price.toFixed(2)}/sh</span>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-[10px] text-muted-foreground w-14 shrink-0">Shares</Label>
        <Input
          type="number"
          value={shares || ""}
          onChange={e => setShares(Math.max(0, parseFloat(e.target.value) || 0))}
          className="h-7 text-xs font-mono bg-card border-border flex-1"
          min={0}
          placeholder="0"
        />
        <div className="text-right shrink-0 w-28">
          <p className="text-xs font-mono font-bold text-foreground">{formatCurrency(investmentValue, 0)}</p>
          {monthlyIncome != null && (
            <p className="text-[10px] font-mono text-green-400">{formatCurrency(monthlyIncome, 2)}/mo</p>
          )}
        </div>
      </div>

      {yieldPct != null && (
        <div className="flex justify-between text-[10px] text-muted-foreground pt-0.5">
          <span>Annual income: <span className="text-green-400 font-mono">{formatCurrency(yearlyIncome, 0)}</span></span>
          <span>Eff. yield: <span className="text-amber-400 font-mono">{yieldPct.toFixed(1)}%</span></span>
        </div>
      )}
    </div>
  );
}

export default function InvestmentCalculator({ liveData, onHoldingsChange }) {
  const [holdings, setHoldings] = useState({
    MSTR: 0, ASST: 0, STRC: 0, SATA: 0, STRF: 0, STRK: 0, STRD: 0, MSTY: 0,
  });

  // Notify parent component of holdings changes
  useEffect(() => {
    if (onHoldingsChange) onHoldingsChange(holdings);
  }, [holdings, onHoldingsChange]);

  // Live prices
  const prices = {
    MSTR: liveData?.mstr_price  ?? ASSET_DEFAULTS.MSTR.price,
    ASST: liveData?.asst_price  ?? ASSET_DEFAULTS.ASST.price,
    STRC: liveData?.strc_price  ?? ASSET_DEFAULTS.STRC.price,
    SATA: liveData?.sata_price  ?? ASSET_DEFAULTS.SATA.price,
    STRF: liveData?.strf_price  ?? ASSET_DEFAULTS.STRF.price,
    STRK: liveData?.strk_price  ?? ASSET_DEFAULTS.STRK.price,
    STRD: liveData?.strd_price  ?? ASSET_DEFAULTS.STRD.price,
    MSTY: liveData?.msty_price  ?? ASSET_DEFAULTS.MSTY.price,
  };

  const totals = useMemo(() => {
    let totalValue = 0, totalAnnualIncome = 0, totalMonthlyIncome = 0;
    Object.keys(holdings).forEach(t => {
      const sh = holdings[t];
      const p = prices[t];
      totalValue += sh * p;
      if (ANNUAL_INCOME_PER_SHARE[t]) {
        const inc = sh * ANNUAL_INCOME_PER_SHARE[t];
        totalAnnualIncome += inc;
        totalMonthlyIncome += inc / 12;
      }
    });
    const blendedYield = totalValue > 0 ? (totalAnnualIncome / totalValue) * 100 : 0;
    return { totalValue, totalAnnualIncome, totalMonthlyIncome, blendedYield };
  }, [holdings, prices]);

  const setShares = (ticker, val) => setHoldings(prev => ({ ...prev, [ticker]: val }));

  return (
    <div className="space-y-3">
      {/* Summary totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-secondary/50 border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Total Portfolio Value</p>
          <p className="text-base font-bold font-mono text-foreground">{formatCurrency(totals.totalValue)}</p>
        </div>
        <div className="bg-secondary/50 border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Annual Income</p>
          <p className="text-base font-bold font-mono text-green-400">{formatCurrency(totals.totalAnnualIncome)}</p>
        </div>
        <div className="bg-secondary/50 border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Monthly Income</p>
          <p className="text-base font-bold font-mono text-green-400">{formatCurrency(totals.totalMonthlyIncome, 2)}</p>
        </div>
        <div className="bg-secondary/50 border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Blended Yield</p>
          <p className="text-base font-bold font-mono text-amber-400">{totals.blendedYield.toFixed(1)}%</p>
          <p className="text-[9px] text-muted-foreground">on income assets only</p>
        </div>
      </div>

      {/* Individual asset rows */}
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-1">Growth Assets</p>
        {["MSTR", "ASST"].map(t => (
          <AssetRow key={t} ticker={t} asset={ASSET_DEFAULTS[t]} price={prices[t]}
            shares={holdings[t]} setShares={v => setShares(t, v)} annualIncome={null} />
        ))}
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-1 pt-1">Income Assets</p>
        {["STRC", "SATA", "STRF", "STRK", "STRD", "MSTY"].map(t => (
          <AssetRow key={t} ticker={t} asset={ASSET_DEFAULTS[t]} price={prices[t]}
            shares={holdings[t]} setShares={v => setShares(t, v)}
            annualIncome={ANNUAL_INCOME_PER_SHARE[t]} />
        ))}
      </div>

      <p className="text-[9px] text-muted-foreground/50 text-center">
        Income estimates based on current/recent dividend rates. Actual distributions may vary. Not financial advice.
      </p>
    </div>
  );
}