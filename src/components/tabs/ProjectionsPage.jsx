import React, { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Users, Bitcoin } from "lucide-react";
import InvestmentCalculator from "./InvestmentCalculator";
import Bitcoin24Simulator from "./Bitcoin24Simulator";
import DRIPSimulator, { DRIP_ASSETS, runDRIP } from "./DRIPSimulator";
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

  // MSTY calculator
  const [shareQty, setShareQty] = useState(1000);

  // Portfolio holdings (lifted from InvestmentCalculator)
  const [portfolioHoldings, setPortfolioHoldings] = useState({
    BTC: 0, MSTR: 0, ASST: 0, STRC: 0, SATA: 0, STRF: 0, STRK: 0, STRD: 0, MSTY: 0,
  });

  // DRIP state — owned here so portfolio chart can use compounded share counts
  const [dripEnabled, setDripEnabled] = useState(true);
  const [dripYears, setDripYears] = useState(10);
  const [dripRates, setDripRates] = useState({
    STRC: 11.5, SATA: 13.0, STRF: 10.0, STRK: 8.0, STRD: 10.0,
  });
  const [mstyWeeklyDiv, setMstyWeeklyDiv] = useState(
    liveData?.msty_latest_div ?? 0.25
  );

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
      if (sh <= 0) { out[ticker] = Array(HORIZON + 1).fill(0); continue; }
      const sim = runDRIP({ shares: sh, price, annualRatesPct: rate, years: HORIZON, dripEnabled });
      out[ticker] = sim.map(r => r.shares);
    }
    return out;
  }, [portfolioHoldings, dripEnabled, dripRates, mstyWeeklyDiv, nowStrc, nowSata, nowStrf, nowStrk, nowStrd, nowMsty]);

  // Build yearly portfolio projections using sim ratios + DRIP-compounded share counts
  const portfolioProjections = useMemo(() => {
    const base = simRows[0];
    return simRows.map((r, i) => {
      const btcRatio  = r.btcPrice  / base.btcPrice;
      const mstrRatio = r.mstrPrice / Math.max(base.mstrPrice, 0.01);
      const asstRatio = r.asstPrice / Math.max(base.asstPrice, 0.01);

      const btc_val  = portfolioHoldings.BTC  * nowBtc  * btcRatio;
      const mstr_val = portfolioHoldings.MSTR * nowMstr * mstrRatio;
      const asst_val = portfolioHoldings.ASST * nowAsst * asstRatio;

      // Preferred: DRIP-compounded shares × current price (par-stable)
      const strc_val = (dripSharesByYear.STRC?.[i] ?? portfolioHoldings.STRC) * nowStrc;
      const sata_val = (dripSharesByYear.SATA?.[i] ?? portfolioHoldings.SATA) * nowSata;
      const strf_val = (dripSharesByYear.STRF?.[i] ?? portfolioHoldings.STRF) * nowStrf;
      const strk_val = (dripSharesByYear.STRK?.[i] ?? portfolioHoldings.STRK) * nowStrk;
      const strd_val = (dripSharesByYear.STRD?.[i] ?? portfolioHoldings.STRD) * nowStrd;
      // MSTY: DRIP shares × MSTY price tracks MSTR
      const msty_val = (dripSharesByYear.MSTY?.[i] ?? portfolioHoldings.MSTY) * nowMsty * mstrRatio;

      const portfolio_value = btc_val + mstr_val + asst_val + strc_val + sata_val + strf_val + strk_val + strd_val + msty_val;

      return { year: r.year, btc_val, mstr_val, asst_val, strc_val, sata_val, strf_val, strk_val, strd_val, msty_val, portfolio_value };
    });
  }, [simRows, portfolioHoldings, dripSharesByYear, nowBtc, nowMstr, nowAsst, nowStrc, nowSata, nowStrf, nowStrk, nowStrd, nowMsty]);

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
          Enter your holdings below. Growth assets (BTC, MSTR, ASST) are projected using the Bitcoin24 model. Preferred stocks are held at current price.
        </p>
        <InvestmentCalculator liveData={liveData} onHoldingsChange={setPortfolioHoldings} />
      </Card>

      {/* ── DRIP Simulator ── */}
      <Card>
        <SectionHeader icon={Users} title="Preferred & Income DRIP Simulator" color="text-green-400" />
        <p className="text-[10px] text-muted-foreground mb-3">
          Simulate dividend reinvestment (DRIP) for your preferred stock and income holdings. Adjust rates to model different yield scenarios.
        </p>
        <DRIPSimulator
          holdings={portfolioHoldings}
          prices={{ STRC: nowStrc, SATA: nowSata, STRF: nowStrf, STRK: nowStrk, STRD: nowStrd, MSTY: nowMsty }}
          liveData={liveData}
          dripEnabled={dripEnabled}   setDripEnabled={setDripEnabled}
          years={dripYears}           setYears={setDripYears}
          rates={dripRates}           setRates={setDripRates}
          mstyWeeklyDiv={mstyWeeklyDiv} setMstyWeeklyDiv={setMstyWeeklyDiv}
        />
      </Card>

      {/* ── My MSTY Investment Calculator ── */}
      <Card>
        <SectionHeader icon={Users} title="My MSTY Investment Calculator" color="text-cyan-400" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Number of MSTY Shares</Label>
              <Input
                type="number"
                value={shareQty}
                onChange={e => setShareQty(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-8 text-sm font-mono bg-secondary border-border mt-1"
                min={0}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Investment value: <span className="text-foreground font-mono font-semibold">{formatCurrency(investmentValue, 2)}</span> at ${nowMsty.toFixed(2)}/share
              </p>
            </div>

            <div className="p-3 rounded-lg bg-secondary/50 border border-border text-xs space-y-1.5">
              <p className="font-semibold text-foreground mb-1.5">Distribution History (recent monthly avg: $1.00–$1.25/share)</p>
              {MSTY_DISTRIBUTION_HISTORY.slice(0, 5).map((d, i) => (
                <div key={d.ex_date} className="flex justify-between">
                  <span className="text-muted-foreground font-mono">{d.ex_date}</span>
                  <span className={`font-mono font-bold ${i === 0 ? "text-primary" : "text-green-400"}`}>${d.amount.toFixed(4)}/sh</span>
                </div>
              ))}
              <div className="pt-1 border-t border-border flex justify-between">
                <span className="text-muted-foreground">8-week avg/wk</span>
                <span className="font-mono text-primary font-bold">
                  ${(MSTY_DISTRIBUTION_HISTORY.reduce((s, d) => s + d.amount, 0) / MSTY_DISTRIBUTION_HISTORY.length).toFixed(4)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-secondary/50 rounded-xl border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Weekly Income</p>
              <p className="text-lg font-bold font-mono text-green-400">{formatCurrency(weeklyIncome, 2)}</p>
              <p className="text-[9px] text-muted-foreground">at latest rate</p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-xl border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Monthly Income</p>
              <p className="text-lg font-bold font-mono text-green-400">{formatCurrency(monthlyIncome, 2)}</p>
              <p className="text-[9px] text-muted-foreground">weekly × 4.33</p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-xl border border-border text-center col-span-2">
              <p className="text-[10px] text-muted-foreground">Annual Income</p>
              <p className="text-lg font-bold font-mono text-cyan-400">{formatCurrency(annualIncome, 2)}</p>
              <p className="text-[9px] text-muted-foreground">weekly × 52</p>
            </div>
          </div>
        </div>
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
        portfolioValue={portfolioProjections[0]?.portfolio_value ?? 0}
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
      />

    </div>
  );
}