import React, { useState, useMemo, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/calculations";
import { MSTY_DISTRIBUTION_HISTORY } from "@/lib/marketData";
import { DollarSign, TrendingUp, Layers, BarChart3, Bitcoin, Plus, Trash2, PiggyBank, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

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

const ANNUAL_INCOME_PER_SHARE = {
  STRC: 11.50,
  SATA: 13.00,
  STRF: 10.00,
  STRK: 8.00,
  STRD: 10.00,
  MSTY: (MSTY_DISTRIBUTION_HISTORY.reduce((s, d) => s + d.amount, 0) / MSTY_DISTRIBUTION_HISTORY.length) * 52,
};

// Non-BTC growth path options
const NON_BTC_GROWTH_PRESETS = [
  { label: "S&P 500 (10% avg)", cagr: 10 },
  { label: "Tech ETF (14%)", cagr: 14 },
  { label: "Dividend Stock (7%)", cagr: 7 },
  { label: "Bond / Conservative (4%)", cagr: 4 },
  { label: "Custom", cagr: null },
];

function AssetRow({ ticker, asset, price, shares, setShares, annualIncome }) {
  const Icon = asset.icon;
  const investmentValue = shares * price;
  const yearlyIncome = annualIncome ? shares * annualIncome : null;
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
        <Input type="number" value={shares || ""} onChange={e => setShares(Math.max(0, parseFloat(e.target.value) || 0))}
          className="h-7 text-xs font-mono bg-card border-border flex-1" min={0} placeholder="0" />
        <div className="text-right shrink-0 w-28">
          <p className="text-xs font-mono font-bold text-foreground">{formatCurrency(investmentValue, 0)}</p>
          {monthlyIncome != null && <p className="text-[10px] font-mono text-green-400">{formatCurrency(monthlyIncome, 2)}/mo</p>}
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

// Custom (non-BTC correlated) stock row
function CustomStockRow({ stock, onChange, onRemove }) {
  const [showGrowthPanel, setShowGrowthPanel] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const debounceRef = useRef(null);
  const value = (stock.shares || 0) * (stock.price || 0);

  const lookupTicker = async (ticker) => {
    if (!ticker || ticker.length < 1) return;
    setFetching(true);
    setFetchError(null);
    try {
      const res = await base44.functions.invoke("polygonProxy", { tickers: [ticker] });
      const prices = res.data?.prices;
      if (prices && prices[ticker] != null) {
        onChange({ ...stock, ticker, price: prices[ticker], label: stock.label || ticker });
      } else {
        setFetchError("Not found");
      }
    } catch {
      setFetchError("Lookup failed");
    } finally {
      setFetching(false);
    }
  };

  const handleTickerChange = (raw) => {
    const ticker = raw.toUpperCase();
    onChange({ ...stock, ticker });
    clearTimeout(debounceRef.current);
    if (ticker.length >= 1) {
      debounceRef.current = setTimeout(() => lookupTicker(ticker), 800);
    }
  };

  return (
    <div className="bg-secondary/30 border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative">
            <Input value={stock.ticker} onChange={e => handleTickerChange(e.target.value)}
              placeholder="AAPL" className="h-7 w-20 text-xs font-mono font-bold bg-card border-border text-foreground pr-6" />
            {fetching && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground absolute right-1.5 top-2" />}
          </div>
          <div className="flex items-center gap-1 flex-1 min-w-24">
            <Input value={stock.label || ""} onChange={e => onChange({ ...stock, label: e.target.value })}
              placeholder="Company name" className="h-7 flex-1 text-xs bg-card border-border" />
            {fetchError && <span className="text-[9px] text-destructive shrink-0">{fetchError}</span>}
          </div>
        </div>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-1">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Label className="text-[10px] text-muted-foreground w-10 shrink-0">Price</Label>
          <Input type="number" step="0.01" value={stock.price || ""} onChange={e => onChange({ ...stock, price: parseFloat(e.target.value) || 0 })}
            placeholder="0.00" className="h-7 w-24 text-xs font-mono bg-card border-border" />
          {stock.price > 0 && !fetching && !fetchError && <span className="text-[9px] text-green-400">●</span>}
        </div>
        <div className="flex items-center gap-1">
          <Label className="text-[10px] text-muted-foreground w-12 shrink-0">Shares</Label>
          <Input type="number" value={stock.shares || ""} onChange={e => onChange({ ...stock, shares: parseFloat(e.target.value) || 0 })}
            placeholder="0" className="h-7 w-24 text-xs font-mono bg-card border-border" />
        </div>
        <div className="text-right flex-1 min-w-24">
          <p className="text-xs font-mono font-bold text-foreground">{formatCurrency(value, 0)}</p>
        </div>
        <button onClick={() => setShowGrowthPanel(v => !v)}
          className={`text-[10px] px-2 py-1 rounded border font-semibold transition-colors ${showGrowthPanel ? "bg-amber-500/20 border-amber-500 text-amber-400" : "border-border text-muted-foreground hover:bg-secondary"}`}>
          Growth Path
        </button>
      </div>
      {showGrowthPanel && (
        <div className="pt-2 border-t border-border/40 space-y-2">
          <p className="text-[10px] text-amber-400 font-semibold">Non-BTC Growth Path (used in projections)</p>
          <div className="flex flex-wrap gap-1">
            {NON_BTC_GROWTH_PRESETS.map(p => (
              <button key={p.label} onClick={() => p.cagr != null && onChange({ ...stock, cagr: p.cagr })}
                className={`text-[10px] px-2 py-0.5 rounded border font-semibold transition-colors ${
                  stock.cagr === p.cagr ? "bg-amber-500/20 border-amber-500 text-amber-400" : "border-border text-muted-foreground hover:bg-secondary"
                }`}>{p.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground shrink-0">Custom CAGR %</Label>
            <Input type="number" step="0.5" value={stock.cagr || ""} onChange={e => onChange({ ...stock, cagr: parseFloat(e.target.value) || 10 })}
              placeholder="10" className="h-7 w-20 text-xs font-mono bg-card border-border" />
            <span className="text-[10px] text-amber-400 font-mono">
              {stock.cagr ? `${stock.cagr}%/yr — $${(value * Math.pow(1 + stock.cagr / 100, 10) / 1000).toFixed(0)}K in 10y` : ""}
            </span>
          </div>
          <p className="text-[9px] text-muted-foreground/60">Projects independently from BTC model. Not correlated to crypto performance.</p>
        </div>
      )}
    </div>
  );
}

export default function InvestmentCalculator({ liveData, onHoldingsChange, onCustomStocksChange, onCashChange }) {
  const [holdings, setHoldings] = useState({
    BTC: 0, MSTR: 0, ASST: 0, STRC: 0, SATA: 0, STRF: 0, STRK: 0, STRD: 0, MSTY: 0,
  });
  const [btcUnit, setBtcUnit] = useState("coins");

  // Cash
  const [cashBalance, setCashBalance] = useState(0);
  const [cashSavingsRate, setCashSavingsRate] = useState(4.5); // APY %

  // Custom non-BTC stocks
  const [customStocks, setCustomStocks] = useState([]);
  const [nextCustomId, setNextCustomId] = useState(1);

  // Notify parent
  useEffect(() => { if (onHoldingsChange) onHoldingsChange(holdings); }, [holdings, onHoldingsChange]);
  useEffect(() => { if (onCustomStocksChange) onCustomStocksChange(customStocks); }, [customStocks, onCustomStocksChange]);
  useEffect(() => { if (onCashChange) onCashChange({ balance: cashBalance, apy: cashSavingsRate }); }, [cashBalance, cashSavingsRate, onCashChange]);

  const prices = {
    MSTR: liveData?.mstr_price ?? ASSET_DEFAULTS.MSTR.price,
    ASST: liveData?.asst_price ?? ASSET_DEFAULTS.ASST.price,
    STRC: liveData?.strc_price ?? ASSET_DEFAULTS.STRC.price,
    SATA: liveData?.sata_price ?? ASSET_DEFAULTS.SATA.price,
    STRF: liveData?.strf_price ?? ASSET_DEFAULTS.STRF.price,
    STRK: liveData?.strk_price ?? ASSET_DEFAULTS.STRK.price,
    STRD: liveData?.strd_price ?? ASSET_DEFAULTS.STRD.price,
    MSTY: liveData?.msty_price ?? ASSET_DEFAULTS.MSTY.price,
  };

  const btcPrice = liveData?.btc_price ?? 84000;

  const totals = useMemo(() => {
    let totalValue = 0, totalAnnualIncome = 0;
    Object.keys(holdings).forEach(t => {
      const p = t === "BTC" ? btcPrice : prices[t];
      totalValue += (holdings[t] || 0) * p;
      if (ANNUAL_INCOME_PER_SHARE[t]) totalAnnualIncome += (holdings[t] || 0) * ANNUAL_INCOME_PER_SHARE[t];
    });
    // Cash interest
    const cashInterest = cashBalance * (cashSavingsRate / 100);
    totalAnnualIncome += cashInterest;
    totalValue += cashBalance;
    // Custom stocks
    customStocks.forEach(s => { totalValue += (s.shares || 0) * (s.price || 0); });
    return {
      totalValue,
      totalAnnualIncome,
      totalMonthlyIncome: totalAnnualIncome / 12,
      blendedYield: totalValue > 0 ? (totalAnnualIncome / totalValue) * 100 : 0,
    };
  }, [holdings, prices, btcPrice, cashBalance, cashSavingsRate, customStocks]);

  const setShares = (ticker, val) => setHoldings(prev => ({ ...prev, [ticker]: val }));

  const addCustomStock = () => {
    setCustomStocks(prev => [...prev, { id: nextCustomId, ticker: "", label: "", price: 0, shares: 0, cagr: 10 }]);
    setNextCustomId(n => n + 1);
  };
  const updateCustomStock = (id, data) => setCustomStocks(prev => prev.map(s => s.id === id ? data : s));
  const removeCustomStock = (id) => setCustomStocks(prev => prev.filter(s => s.id !== id));

  return (
    <div className="space-y-3">
      {/* Summary */}
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
          <p className="text-[9px] text-muted-foreground">incl. cash interest</p>
        </div>
      </div>

      {/* Growth Assets — BTC Correlated */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Growth Assets</p>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold">BTC-Correlated · Bitcoin24 Model</span>
        </div>

        {/* BTC */}
        <div className="bg-secondary/30 border border-border rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bitcoin className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-sm font-bold text-amber-400">BTC</span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">Bitcoin held</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setBtcUnit(btcUnit === "coins" ? "sats" : "coins")}
                className="text-[10px] px-2 py-1 rounded border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors">
                {btcUnit === "coins" ? "SATs" : "Coins"}
              </button>
              <span className="text-xs font-mono text-foreground">${btcPrice.toLocaleString()}/BTC</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground w-14 shrink-0">{btcUnit === "coins" ? "BTC" : "SATs"}</Label>
            <Input type="number" value={holdings.BTC || ""} onChange={e => setShares("BTC", Math.max(0, parseFloat(e.target.value) || 0))}
              className="h-7 text-xs font-mono bg-card border-border flex-1" min={0} placeholder="0" />
            <div className="text-right shrink-0 w-28">
              <p className="text-xs font-mono font-bold text-amber-400">₿{holdings.BTC.toFixed(4)}</p>
              <p className="text-[10px] font-mono text-foreground">{formatCurrency(holdings.BTC * btcPrice, 0)}</p>
            </div>
          </div>
        </div>

        {["MSTR", "ASST"].map(t => (
          <AssetRow key={t} ticker={t} asset={ASSET_DEFAULTS[t]} price={prices[t]}
            shares={holdings[t]} setShares={v => setShares(t, v)} annualIncome={null} />
        ))}
      </div>

      {/* Non-BTC Correlated Stocks & Bonds — independent CAGR projection */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 pt-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Other Stocks &amp; Bonds</p>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400 font-semibold">Non-BTC · Custom CAGR</span>
        </div>
        <div className="p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl text-[10px] text-muted-foreground">
          These assets are projected using your own CAGR assumption — <span className="text-blue-400 font-semibold">completely independent</span> of the Bitcoin24 model. Set the growth rate per stock via the "Growth Path" button on each row.
        </div>
        {customStocks.map(s => (
          <CustomStockRow key={s.id} stock={s}
            onChange={data => updateCustomStock(s.id, data)}
            onRemove={() => removeCustomStock(s.id)} />
        ))}
        <button onClick={addCustomStock}
          className="w-full flex items-center justify-center gap-2 text-[11px] py-2 rounded-xl border border-dashed border-blue-500/30 text-blue-400/70 hover:border-blue-400 hover:text-blue-400 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Stock / ETF / Bond (non-BTC)
        </button>
      </div>

      {/* Income Assets */}
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-1 pt-1">Income Assets</p>
        {["STRC", "SATA", "STRF", "STRK", "STRD", "MSTY"].map(t => (
          <AssetRow key={t} ticker={t} asset={ASSET_DEFAULTS[t]} price={prices[t]}
            shares={holdings[t]} setShares={v => setShares(t, v)} annualIncome={ANNUAL_INCOME_PER_SHARE[t]} />
        ))}
      </div>

      {/* Cash */}
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-1 pt-1">Cash / Savings</p>
        <div className="bg-secondary/30 border border-border rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-sm font-bold text-emerald-400">Cash</span>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">HYSA / Savings / Money Market</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-40">
              <Label className="text-[10px] text-muted-foreground w-14 shrink-0">Balance $</Label>
              <Input type="number" value={cashBalance || ""} onChange={e => setCashBalance(Math.max(0, parseFloat(e.target.value) || 0))}
                className="h-7 text-xs font-mono bg-card border-border flex-1" placeholder="0" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-muted-foreground shrink-0">APY %</Label>
              <Input type="number" step="0.1" value={cashSavingsRate} onChange={e => setCashSavingsRate(Math.max(0, parseFloat(e.target.value) || 0))}
                className="h-7 w-20 text-xs font-mono bg-card border-border" />
              <span className="text-[10px] text-emerald-400 font-mono shrink-0">
                {cashBalance > 0 ? `${formatCurrency(cashBalance * cashSavingsRate / 100, 0)}/yr` : ""}
              </span>
            </div>
          </div>
          {cashBalance > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Monthly interest: <span className="text-emerald-400 font-mono font-bold">{formatCurrency(cashBalance * cashSavingsRate / 100 / 12, 2)}/mo</span>
            </p>
          )}
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground/50 text-center">
        Income estimates based on current/recent dividend rates. Custom stocks project at user-defined CAGR independent of BTC model. Not financial advice.
      </p>
    </div>
  );
}