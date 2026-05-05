import React, { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Users, TrendingUp } from "lucide-react";
import InvestmentCalculator from "./InvestmentCalculator";
import Bitcoin24Simulator from "./Bitcoin24Simulator";
import DRIPSimulator, { DRIP_ASSETS, runDRIP, defaultDripConfig } from "./DRIPSimulator";
import AdditionalCapitalPanel, { calcAnnualInflows } from "./AdditionalCapitalPanel";
import MonteCarloSimulator from "./MonteCarloSimulator";
import FIRECalculator from "./FIRECalculator";
import TaxAccountAllocator from "./TaxAccountAllocator";
import { formatCurrency } from "@/lib/calculations";
import { MSTY_DISTRIBUTION_HISTORY } from "@/lib/marketData";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

// ── Bitcoin24 simulation engine (mirrors Bitcoin24Simulator logic) ──────────
const START_YEAR = 2025;
const HORIZON    = 21;

const ASST_DEFAULTS = {
  btc_holdings:    13767.9,
  shares_diluted_M: 97.47,
};

const MSTR_PREF_DEFAULTS = {
  strc_notional_M: 6358,
  strd_notional_M: 1402,
  strf_notional_M: 1284,
  strk_notional_M: 1402,
};
const MSTR_TOTAL_PREF_M = Object.values(MSTR_PREF_DEFAULTS).reduce((a, v) => a + v, 0);

const PRESETS = {
  Bear: { initARR: 25, declineRate: 3,  terminal: 5,  mstrMnav: 1.0, asstMnav: 1.0, mstrAccumYr: 30000,  asstAccumYr: 5000,  mstrDilutionYr: 8,  mstrShares: 450, prefGrowthYr: 0    },
  Base: { initARR: 55, declineRate: 5,  terminal: 10, mstrMnav: 1.5, asstMnav: 1.3, mstrAccumYr: 60000,  asstAccumYr: 10000, mstrDilutionYr: 5,  mstrShares: 380, prefGrowthYr: 500  },
  Bull: { initARR: 90, declineRate: 7,  terminal: 15, mstrMnav: 2.5, asstMnav: 2.0, mstrAccumYr: 100000, asstAccumYr: 20000, mstrDilutionYr: 3,  mstrShares: 320, prefGrowthYr: 1000 },
};

function runSimulation(p) {
  const rows = [];
  let btcPrice    = p.btcStart;
  let mstrBtcHold = p.mstrBtcHoldings;
  let asstBtcHold = ASST_DEFAULTS.btc_holdings;
  let mstrSharesM = p.mstrShares;
  let growthRate  = p.initARR / 100;
  const terminal  = p.terminal / 100;

  for (let i = 0; i <= HORIZON; i++) {
    if (i > 0) {
      growthRate  = Math.max(growthRate - p.declineRate / 100, terminal);
      btcPrice    = btcPrice * (1 + growthRate);
      mstrBtcHold += p.mstrAccumYr;
      asstBtcHold += p.asstAccumYr;
      mstrSharesM = mstrSharesM * (1 + p.mstrDilutionYr / 100);
    }

    const extraPrefM   = i * p.prefGrowthYr;
    const totalPrefM   = MSTR_TOTAL_PREF_M + extraPrefM;
    const mstrNavPerSh = (mstrBtcHold * btcPrice - totalPrefM * 1e6) / (mstrSharesM * 1e6);
    const mstrPrice    = Math.max(0, mstrNavPerSh * p.mstrMnav);
    const asstNavPerSh = (asstBtcHold * btcPrice) / (ASST_DEFAULTS.shares_diluted_M * 1e6);
    const asstPrice    = asstNavPerSh * p.asstMnav;

    rows.push({ year: START_YEAR + i, btcPrice, mstrPrice, asstPrice });
  }
  return rows;
}

const TICK_STYLE = { fontSize: 9, fill: "hsl(215 20% 55%)" };

function Card({ children, className = "" }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

function SectionHeader({ icon: Icon, title, color = "text-primary" }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`w-4 h-4 ${color}`} />
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h3>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ProjectionsPage({ liveData }) {
  const [activePreset, setActivePreset] = useState("Base");
  const [fireState, setFireState] = useState(null);

  // MSTY calculator
  const [shareQty, setShareQty] = useState(1000);

  // Portfolio holdings (lifted from InvestmentCalculator)
  const [portfolioHoldings, setPortfolioHoldings] = useState({
    BTC: 0, MSTR: 0, ASST: 0, STRC: 0, SATA: 0, STRF: 0, STRK: 0, STRD: 0, MSTY: 0,
  });
  const [customStocks, setCustomStocks] = useState([]);
  const [cashState, setCashState] = useState({ balance: 0, apy: 4.5 });

  // DRIP state — owned here so portfolio chart can use compounded share counts
  const [dripEnabled, setDripEnabled] = useState(true);
  const [dripYears, setDripYears] = useState(10);
  const [dripRates, setDripRates] = useState({
    STRC: 11.5, SATA: 13.0, STRF: 10.0, STRK: 8.0, STRD: 10.0,
  });
  const [dripConfigs, setDripConfigs] = useState(() => defaultDripConfig());
  const [mstyWeeklyDiv, setMstyWeeklyDiv] = useState(
    liveData?.msty_latest_div ?? 0.25
  );

  // Additional capital inflow state
  const [inflowAmount, setInflowAmount] = useState(500);
  const [inflowFrequency, setInflowFrequency] = useState("monthly");
  const [inflowAllocations, setInflowAllocations] = useState({
    MSTR: 50, ASST: 50, MSTY: 0, STRC: 0, SATA: 0, STRF: 0, STRK: 0, STRD: 0, CASH: 0,
  });
  const [customStockInflowAllocations, setCustomStockInflowAllocations] = useState({});

  // Current (now) prices
  const nowBtc  = liveData?.btc_price  ?? 84000;
  const nowMstr = liveData?.mstr_price ?? 166.52;
  const nowAsst = liveData?.asst_price ?? 12.50;
  const nowStrc = liveData?.strc_price ?? 99.21;
  const nowSata = liveData?.sata_price ?? 99.45;
  const nowStrf = liveData?.strf_price ?? 92.50;
  const nowStrk = liveData?.strk_price ?? 87.00;
  const nowStrd = liveData?.strd_price ?? 77.14;
  const nowMsty = liveData?.msty_price ?? 22.50;

  // Run Bitcoin24 simulation for the active preset
  const simRows = useMemo(() => {
    const preset = PRESETS[activePreset] ?? PRESETS.Base;
    return runSimulation({
      btcStart:        nowBtc,
      mstrBtcHoldings: liveData?.btc_holdings ?? 780897,
      ...preset,
    });
  }, [activePreset, nowBtc, liveData]);

  // Annual inflows per ticker
  const annualInflows = useMemo(() => calcAnnualInflows({
    amount: inflowAmount, frequency: inflowFrequency, allocations: inflowAllocations,
    customStockAllocations: customStockInflowAllocations,
  }), [inflowAmount, inflowFrequency, inflowAllocations, customStockInflowAllocations]);

  // Pre-compute DRIP share counts per income asset per year (indexed by year offset 0..HORIZON)
  const dripSharesByYear = useMemo(() => {
    const incomeAssets = {
      STRC: { price: nowStrc, rate: dripRates.STRC ?? 11.5 },
      SATA: { price: nowSata, rate: dripRates.SATA ?? 13.0 },
      STRF: { price: nowStrf, rate: dripRates.STRF ?? 10.0 },
      STRK: { price: nowStrk, rate: dripRates.STRK ?? 8.0  },
      STRD: { price: nowStrd, rate: dripRates.STRD ?? 10.0 },
      MSTY: { price: nowMsty, rate: ((mstyWeeklyDiv * 52) / nowMsty) * 100 },
    };
    const out = {};
    for (const [ticker, { price, rate }] of Object.entries(incomeAssets)) {
      const sh = portfolioHoldings[ticker] ?? 0;
      if (sh <= 0 && !(annualInflows[ticker] > 0)) { out[ticker] = Array(HORIZON + 1).fill(0); continue; }
      const cfg = dripEnabled ? (dripConfigs?.[ticker] ?? { mode: "drip", dripPct: 100 }) : { mode: "drip", dripPct: 0 };
      const sim = runDRIP({ shares: sh, price, annualRatesPct: rate, years: HORIZON, dripConfig: cfg });
      // Add inflow shares per year
      out[ticker] = sim.map((r, idx) => {
        const addedShares = idx === 0 ? 0 : (annualInflows[ticker] ?? 0) / price * idx;
        return r.shares + addedShares;
      });
    }
    return out;
  }, [portfolioHoldings, dripEnabled, dripConfigs, dripRates, mstyWeeklyDiv, nowStrc, nowSata, nowStrf, nowStrk, nowStrd, nowMsty, annualInflows]);

  // Build yearly portfolio projections using sim ratios + DRIP-compounded share counts
  const portfolioProjections = useMemo(() => {
    const base = simRows[0];
    return simRows.map((r, i) => {
      const btcRatio  = r.btcPrice  / base.btcPrice;
      const mstrRatio = r.mstrPrice / Math.max(base.mstrPrice, 0.01);
      const asstRatio = r.asstPrice / Math.max(base.asstPrice, 0.01);

      // Add inflow-accumulated shares for growth assets
      const mstrInflowShares = i === 0 ? 0 : (annualInflows.MSTR ?? 0) / nowMstr * i;
      const asstInflowShares = i === 0 ? 0 : (annualInflows.ASST ?? 0) / nowAsst * i;

      const btc_val  = portfolioHoldings.BTC  * nowBtc  * btcRatio;
      const mstr_val = (portfolioHoldings.MSTR + mstrInflowShares) * nowMstr * mstrRatio;
      const asst_val = (portfolioHoldings.ASST + asstInflowShares) * nowAsst * asstRatio;

      // Preferred: DRIP-compounded shares × current price (par-stable)
      const strc_val = (dripSharesByYear.STRC?.[i] ?? portfolioHoldings.STRC) * nowStrc;
      const sata_val = (dripSharesByYear.SATA?.[i] ?? portfolioHoldings.SATA) * nowSata;
      const strf_val = (dripSharesByYear.STRF?.[i] ?? portfolioHoldings.STRF) * nowStrf;
      const strk_val = (dripSharesByYear.STRK?.[i] ?? portfolioHoldings.STRK) * nowStrk;
      const strd_val = (dripSharesByYear.STRD?.[i] ?? portfolioHoldings.STRD) * nowStrd;
      // MSTY: DRIP shares + inflow shares × MSTY price tracks MSTR
      const mstyInflowShares = i === 0 ? 0 : (annualInflows.MSTY ?? 0) / nowMsty * i;
      const msty_val = ((dripSharesByYear.MSTY?.[i] ?? portfolioHoldings.MSTY) + mstyInflowShares) * nowMsty * mstrRatio;

      // Custom stocks: grow at user-defined CAGR
      let custom_val = 0;
      customStocks.forEach(s => {
        if (!s.shares || !s.price) return;
        const cagr = (s.cagr ?? 10) / 100;
        const inflows = i === 0 ? 0 : (annualInflows[`custom_${s.id}`] ?? 0) * i / (s.price || 1);
        custom_val += ((s.shares + inflows) * s.price * Math.pow(1 + cagr, i));
      });

      // Cash: grows at savings rate
      const cashInflow = i === 0 ? 0 : (annualInflows.CASH ?? 0) * i;
      const cashApy = (cashState.apy ?? 4.5) / 100;
      const cash_val = (cashState.balance + cashInflow) * Math.pow(1 + cashApy, i);

      const portfolio_value = btc_val + mstr_val + asst_val + strc_val + sata_val + strf_val + strk_val + strd_val + msty_val + custom_val + cash_val;

      return { year: r.year, btc_val, mstr_val, asst_val, strc_val, sata_val, strf_val, strk_val, strd_val, msty_val, custom_val, cash_val, portfolio_value };
    });
  }, [simRows, portfolioHoldings, dripSharesByYear, nowBtc, nowMstr, nowAsst, nowStrc, nowSata, nowStrf, nowStrk, nowStrd, nowMsty, customStocks, cashState, annualInflows]);

  // MSTY income metrics
  const latestWeeklyDiv   = liveData?.msty_latest_div ?? 0.2500;
  const weeklyIncome      = shareQty * latestWeeklyDiv;
  const monthlyIncome     = shareQty * latestWeeklyDiv * 4.33;
  const annualIncome      = shareQty * latestWeeklyDiv * 52;
  const investmentValue   = shareQty * nowMsty;

  return (
    <div className="space-y-4">

      {/* ── Preset selector strip ── */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">Portfolio Projections</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Powered by the Bitcoin24 decelerating-growth model. Select a scenario to see how your holdings project over time.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-[10px] text-muted-foreground">Scenario:</span>
            {["Bear", "Base", "Bull"].map(p => (
              <button key={p} onClick={() => setActivePreset(p)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-semibold ${
                  activePreset === p
                    ? p === "Bull" ? "bg-primary text-primary-foreground border-primary"
                      : p === "Bear" ? "bg-destructive/80 text-white border-destructive"
                      : "bg-amber-500/80 text-white border-amber-500"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}>{p}</button>
            ))}
            <span className="text-[10px] text-muted-foreground ml-1">BTC: <span className="text-amber-400 font-mono font-bold">${nowBtc.toLocaleString()}</span></span>
          </div>
        </div>
      </Card>

      {/* ── Bitcoin24 Dynamic Equity Simulator ── */}
      <Bitcoin24Simulator liveData={liveData} />

      {/* ── My Portfolio Investment Calculator ── */}
      <Card>
        <SectionHeader icon={Users} title="My Portfolio Investment Calculator" color="text-green-400" />
        <p className="text-[10px] text-muted-foreground mb-3">
          BTC, MSTR &amp; ASST are projected using the Bitcoin24 model. Preferred stocks held at par. <span className="text-blue-400 font-semibold">Other Stocks &amp; Bonds</span> use your own per-stock CAGR — independent of crypto.
        </p>
        <InvestmentCalculator
          liveData={liveData}
          onHoldingsChange={setPortfolioHoldings}
          onCustomStocksChange={setCustomStocks}
          onCashChange={setCashState}
        />
      </Card>

      {/* ── Additional Capital Inflows ── */}
      <Card>
        <SectionHeader icon={TrendingUp} title="Additional Capital Contributions" color="text-cyan-400" />
        <p className="text-[10px] text-muted-foreground mb-3">
          Model periodic contributions and how they compound your portfolio over time. Set the amount, frequency, and allocation % per instrument.
        </p>
        <AdditionalCapitalPanel
          amount={inflowAmount}              setAmount={setInflowAmount}
          frequency={inflowFrequency}        setFrequency={setInflowFrequency}
          allocations={inflowAllocations}    setAllocations={setInflowAllocations}
          customStocks={customStocks}
          customStockAllocations={customStockInflowAllocations}
          setCustomStockAllocations={setCustomStockInflowAllocations}
        />
      </Card>

      {/* ── DRIP Simulator ── */}
      <Card>
        <SectionHeader icon={Users} title="Preferred & Income DRIP Simulator" color="text-green-400" />
        <p className="text-[10px] text-muted-foreground mb-3">
          Per-instrument: choose to <strong className="text-green-400">DRIP</strong> dividends back into the same instrument, or <strong className="text-amber-400">Redirect</strong> them to MSTR or ASST. Set allocation % for each.
        </p>
        <DRIPSimulator
          holdings={portfolioHoldings}
          prices={{ STRC: nowStrc, SATA: nowSata, STRF: nowStrf, STRK: nowStrk, STRD: nowStrd, MSTY: nowMsty }}
          liveData={liveData}
          dripEnabled={dripEnabled}     setDripEnabled={setDripEnabled}
          years={dripYears}             setYears={setDripYears}
          rates={dripRates}             setRates={setDripRates}
          mstyWeeklyDiv={mstyWeeklyDiv} setMstyWeeklyDiv={setMstyWeeklyDiv}
          dripConfigs={dripConfigs}     setDripConfigs={setDripConfigs}
          customStocks={customStocks}
        />
      </Card>

      {/* ── Your Portfolio Valuation by Scenario ── */}
      <Card>
        <SectionHeader icon={Users} title="Your Portfolio Valuation — Bitcoin24 Projection" color="text-green-400" />
        <p className="text-[10px] text-muted-foreground mb-3">
          BTC, MSTR & ASST prices from Bitcoin24 ({activePreset} scenario). Preferred & MSTY use DRIP-compounded share counts from the simulator above ({dripEnabled ? "DRIP ON" : "DRIP OFF"}).
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={portfolioProjections} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
            <XAxis dataKey="year" tick={TICK_STYLE} />
            <YAxis tick={TICK_STYLE} tickFormatter={v => formatCurrency(v)} />
            <Tooltip
              contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)" }}
              formatter={v => formatCurrency(v, 0)}
              labelFormatter={l => `Year ${l}`}
            />
            <Legend />
            <Line type="monotone" dataKey="btc_val"       stroke="#F59E0B" strokeWidth={1.5} name="BTC"        dot={false} opacity={0.8} />
            <Line type="monotone" dataKey="mstr_val"      stroke="#22C55E" strokeWidth={1.5} name="MSTR"       dot={false} opacity={0.8} />
            <Line type="monotone" dataKey="asst_val"      stroke="#60A5FA" strokeWidth={1.5} name="ASST"       dot={false} opacity={0.8} />
            <Line type="monotone" dataKey="strc_val"      stroke="#34D399" strokeWidth={1}   name="STRC"       dot={false} opacity={0.6} />
            <Line type="monotone" dataKey="sata_val"      stroke="#A78BFA" strokeWidth={1}   name="SATA"       dot={false} opacity={0.6} />
            <Line type="monotone" dataKey="strf_val"      stroke="#06B6D4" strokeWidth={1}   name="STRF"       dot={false} opacity={0.6} />
            <Line type="monotone" dataKey="strk_val"      stroke="#FBBF24" strokeWidth={1}   name="STRK"       dot={false} opacity={0.6} />
            <Line type="monotone" dataKey="strd_val"      stroke="#FB923C" strokeWidth={1}   name="STRD"       dot={false} opacity={0.6} />
            <Line type="monotone" dataKey="msty_val"      stroke="#E879F9" strokeWidth={1}   name="MSTY"       dot={false} opacity={0.6} />
            {customStocks.filter(s => s.ticker).length > 0 && (
              <Line type="monotone" dataKey="custom_val" stroke="#F97316" strokeWidth={1} name="Other Stocks" dot={false} opacity={0.7} />
            )}
            {cashState.balance > 0 && (
              <Line type="monotone" dataKey="cash_val"   stroke="#34D399" strokeWidth={1} name="Cash"         dot={false} opacity={0.7} />
            )}
            <Line type="monotone" dataKey="portfolio_value" stroke="#10B981" strokeWidth={2.5} name="Total"    dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Monte Carlo Simulator ── */}
      <MonteCarloSimulator
        portfolioValue={portfolioProjections[0]?.portfolio_value ?? 0}
        activePreset={activePreset}
      />

      {/* ── FIRE Calculator + Withdrawal Strategies ── */}
      <FIRECalculator
        portfolioProjections={portfolioProjections}
        portfolioValue={portfolioProjections[0]?.portfolio_value ?? 0}
        onStateChange={setFireState}
        portfolioMonthlyIncome={(() => {
          // Monthly income from income assets using DRIP rate data
          const incomeAssets = {
            STRC: { shares: portfolioHoldings.STRC, rate: dripRates.STRC ?? 11.5, price: nowStrc },
            SATA: { shares: portfolioHoldings.SATA, rate: dripRates.SATA ?? 13.0, price: nowSata },
            STRF: { shares: portfolioHoldings.STRF, rate: dripRates.STRF ?? 10.0, price: nowStrf },
            STRK: { shares: portfolioHoldings.STRK, rate: dripRates.STRK ?? 8.0,  price: nowStrk },
            STRD: { shares: portfolioHoldings.STRD, rate: dripRates.STRD ?? 10.0, price: nowStrd },
            MSTY: { shares: portfolioHoldings.MSTY, rate: (mstyWeeklyDiv * 52) / nowMsty * 100, price: nowMsty },
          };
          return Object.values(incomeAssets).reduce((sum, a) => {
            return sum + (a.shares * a.price * (a.rate / 100)) / 12;
          }, 0);
        })()}
      />

      {/* ── Tax Account Allocator ── */}
      <TaxAccountAllocator
        portfolioHoldings={portfolioHoldings}
        prices={{
          BTC: nowBtc, MSTR: nowMstr, ASST: nowAsst,
          STRC: nowStrc, SATA: nowSata, STRF: nowStrf,
          STRK: nowStrk, STRD: nowStrd, MSTY: nowMsty,
        }}
        fireState={fireState}
        portfolioMonthlyIncome={(() => {
          const incomeAssets = {
            STRC: { shares: portfolioHoldings.STRC, rate: dripRates.STRC ?? 11.5, price: nowStrc },
            SATA: { shares: portfolioHoldings.SATA, rate: dripRates.SATA ?? 13.0, price: nowSata },
            STRF: { shares: portfolioHoldings.STRF, rate: dripRates.STRF ?? 10.0, price: nowStrf },
            STRK: { shares: portfolioHoldings.STRK, rate: dripRates.STRK ?? 8.0,  price: nowStrk },
            STRD: { shares: portfolioHoldings.STRD, rate: dripRates.STRD ?? 10.0, price: nowStrd },
            MSTY: { shares: portfolioHoldings.MSTY, rate: (mstyWeeklyDiv * 52) / nowMsty * 100, price: nowMsty },
          };
          return Object.values(incomeAssets).reduce((sum, a) => sum + (a.shares * a.price * (a.rate / 100)) / 12, 0);
        })()}
        portfolioProjections={portfolioProjections}
      />

    </div>
  );
}