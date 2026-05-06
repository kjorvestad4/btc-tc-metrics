import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FREQUENCIES = [
  { label: "Weekly",        value: "weekly",       perYear: 52 },
  { label: "Twice Monthly", value: "twice_monthly", perYear: 24 },
  { label: "Monthly",       value: "monthly",      perYear: 12 },
  { label: "Quarterly",     value: "quarterly",    perYear: 4  },
  { label: "Annual",        value: "annual",       perYear: 1  },
];

const ALLOC_ASSETS = [
  { ticker: "BTC",   label: "BTC",   color: "#F59E0B" },
  { ticker: "MSTR",  label: "MSTR",  color: "#22C55E" },
  { ticker: "ASST",  label: "ASST",  color: "#60A5FA" },
  { ticker: "MSTY",  label: "MSTY",  color: "#E879F9" },
  { ticker: "STRC",  label: "STRC",  color: "#4ADE80" },
  { ticker: "SATA",  label: "SATA",  color: "#A78BFA" },
  { ticker: "STRF",  label: "STRF",  color: "#22D3EE" },
  { ticker: "STRK",  label: "STRK",  color: "#FBBF24" },
  { ticker: "STRD",  label: "STRD",  color: "#FB923C" },
  { ticker: "CASH",  label: "Cash",  color: "#34D399" },
];

export { FREQUENCIES, ALLOC_ASSETS };

export function calcAnnualInflows({ amount, frequency, allocations, customStockAllocations = {} }) {
  const freq = FREQUENCIES.find(f => f.value === frequency) ?? FREQUENCIES[2];
  const annualTotal = amount * freq.perYear;
  const out = {};
  for (const [ticker, pct] of Object.entries(allocations)) {
    out[ticker] = annualTotal * (pct / 100);
  }
  // Custom stocks
  for (const [id, pct] of Object.entries(customStockAllocations)) {
    out[`custom_${id}`] = annualTotal * (pct / 100);
  }
  return out;
}

export default function AdditionalCapitalPanel({
  amount, setAmount, frequency, setFrequency,
  allocations, setAllocations,
  customStocks = [], customStockAllocations = {}, setCustomStockAllocations,
}) {
  const standardTotal = Object.values(allocations).reduce((s, v) => s + v, 0);
  const customTotal = Object.values(customStockAllocations).reduce((s, v) => s + v, 0);
  const totalAlloc = standardTotal + customTotal;
  const isValid = Math.abs(totalAlloc - 100) < 0.01 || totalAlloc === 0;

  const setAlloc = (ticker, val) => {
    setAllocations(prev => ({ ...prev, [ticker]: Math.max(0, Math.min(100, parseFloat(val) || 0)) }));
  };

  const setCustomAlloc = (id, val) => {
    if (setCustomStockAllocations) {
      setCustomStockAllocations(prev => ({ ...prev, [id]: Math.max(0, Math.min(100, parseFloat(val) || 0)) }));
    }
  };

  const freq = FREQUENCIES.find(f => f.value === frequency) ?? FREQUENCIES[2];
  const annualTotal = amount * freq.perYear;

  // All assets including custom stocks for preset calculations
  const allAssetsForClear = Object.fromEntries(ALLOC_ASSETS.map(a => [a.ticker, 0]));

  return (
    <div className="space-y-3">
      {/* Amount + Frequency */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Additional Capital ($)</Label>
          <Input type="number" value={amount} onChange={e => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
            className="h-8 text-xs font-mono bg-secondary border-border mt-1" min={0} step={100} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Frequency</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {FREQUENCIES.map(f => (
              <button key={f.value} onClick={() => setFrequency(f.value)}
                className={`text-[10px] px-2 py-1 rounded border font-semibold transition-colors ${
                  frequency === f.value ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground hover:bg-secondary"
                }`}>{f.label}</button>
            ))}
          </div>
        </div>
        <div className="md:col-span-2 flex flex-col justify-end">
          <p className="text-[10px] text-muted-foreground">Annual total contribution</p>
          <p className="text-base font-bold font-mono text-primary">${annualTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          {!isValid && totalAlloc > 0 && (
            <p className="text-[10px] text-destructive mt-0.5">Allocations must sum to 100% (currently {totalAlloc.toFixed(0)}%)</p>
          )}
        </div>
      </div>

      {/* Standard allocation */}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
          Allocation per Instrument — total: <span className={isValid ? "text-primary" : "text-destructive"}>{totalAlloc.toFixed(0)}%</span>
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {ALLOC_ASSETS.map(a => (
            <div key={a.ticker} className="bg-secondary/30 border border-border rounded-lg p-2 flex items-center gap-2">
              <span className="text-[10px] font-bold w-10 shrink-0" style={{ color: a.color }}>{a.label}</span>
              <Input type="number" value={allocations[a.ticker] ?? 0} onChange={e => setAlloc(a.ticker, e.target.value)}
                className="h-6 text-xs font-mono bg-card border-border flex-1" min={0} max={100} step={5} />
              <span className="text-[9px] text-muted-foreground shrink-0">%</span>
            </div>
          ))}

          {/* Custom stocks */}
          {customStocks.filter(s => s.ticker).map(s => (
            <div key={s.id} className="bg-secondary/30 border border-border rounded-lg p-2 flex items-center gap-2">
              <span className="text-[10px] font-bold w-10 shrink-0 text-amber-400">{s.ticker}</span>
              <Input type="number" value={customStockAllocations[s.id] ?? 0}
                onChange={e => setCustomAlloc(s.id, e.target.value)}
                className="h-6 text-xs font-mono bg-card border-border flex-1" min={0} max={100} step={5} />
              <span className="text-[9px] text-muted-foreground shrink-0">%</span>
            </div>
          ))}
        </div>

        {/* Quick presets */}
        <div className="flex gap-2 mt-2 flex-wrap">
          <button onClick={() => setAllocations({ BTC: 100, MSTR: 0, ASST: 0, MSTY: 0, STRC: 0, SATA: 0, STRF: 0, STRK: 0, STRD: 0, CASH: 0 })}
            className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary">All BTC</button>
          <button onClick={() => setAllocations({ BTC: 0, MSTR: 100, ASST: 0, MSTY: 0, STRC: 0, SATA: 0, STRF: 0, STRK: 0, STRD: 0, CASH: 0 })}
            className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary">All MSTR</button>
          <button onClick={() => setAllocations({ BTC: 0, MSTR: 0, ASST: 100, MSTY: 0, STRC: 0, SATA: 0, STRF: 0, STRK: 0, STRD: 0, CASH: 0 })}
            className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary">All ASST</button>
          <button onClick={() => setAllocations({ BTC: 0, MSTR: 50, ASST: 50, MSTY: 0, STRC: 0, SATA: 0, STRF: 0, STRK: 0, STRD: 0, CASH: 0 })}
            className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary">50/50 MSTR+ASST</button>
          <button onClick={() => setAllocations({ BTC: 0, MSTR: 0, ASST: 0, MSTY: 100, STRC: 0, SATA: 0, STRF: 0, STRK: 0, STRD: 0, CASH: 0 })}
            className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary">All MSTY</button>
          <button onClick={() => setAllocations({ BTC: 25, MSTR: 25, ASST: 0, MSTY: 25, STRC: 0, SATA: 0, STRF: 0, STRK: 0, STRD: 25, CASH: 0 })}
            className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary">Balanced</button>
          <button onClick={() => setAllocations({ BTC: 30, MSTR: 40, ASST: 0, MSTY: 0, STRC: 0, SATA: 0, STRF: 0, STRK: 0, STRD: 0, CASH: 30 })}
            className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary">Growth+Cash</button>
          <button onClick={() => {
            setAllocations({ BTC: 0, MSTR: 0, ASST: 0, MSTY: 0, STRC: 0, SATA: 0, STRF: 0, STRK: 0, STRD: 0, CASH: 0 });
            if (setCustomStockAllocations) setCustomStockAllocations({});
          }} className="text-[10px] px-2 py-1 rounded border border-destructive/40 text-destructive/70 hover:bg-destructive/10">Clear</button>
        </div>
      </div>
    </div>
  );
}