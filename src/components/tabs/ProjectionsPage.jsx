import React, { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, TrendingUp, BarChart3, Activity, Zap, Users, Bitcoin } from "lucide-react";
import CAGRModule from "./CAGRModule";
import InvestmentCalculator from "./InvestmentCalculator";
import { formatCurrency, formatPercent, formatNumber, generateProjections, DEFAULT_PREFERREDS, DEFAULT_SCENARIOS, calcMSTYDividend } from "@/lib/calculations";
import { MSTY_DISTRIBUTION_HISTORY } from "@/lib/marketData";
import ProjectionChart from "../dashboard/ProjectionChart";
import ProjectionsTable from "./ProjectionsTable";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from "recharts";

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

export default function ProjectionsPage({ liveData }) {
  // Scenario selector
  const [activeScenario, setActiveScenario] = useState("Base");

  // Custom CAGR sliders
  const [btcCagr, setBtcCagr] = useState(40);
  const [mstrPremium, setMstrPremium] = useState(1.0);
  const [mstrAmpRatio, setMstrAmpRatio] = useState(3.0);
  const [dilutionRate, setDilutionRate] = useState(1.5);
  const [accumulation, setAccumulation] = useState(15000);
  const [asstPremium, setAsstPremium] = useState(1.0);
  const [asstAmpRatio, setAsstAmpRatio] = useState(2.5);
  const [projectionYears, setProjectionYears] = useState(5);

  // MSTY calculator
  const [shareQty, setShareQty] = useState(1000);

  // Build params from sliders
  const params = useMemo(() => {
    const scenario = DEFAULT_SCENARIOS.find(s => s.name === activeScenario);
    return {
      btc_price: liveData?.btc_price ?? 84000,
      btc_cagr: activeScenario === "Custom" ? btcCagr : scenario?.btc_cagr ?? btcCagr,
      mstr_btc_holdings: liveData?.btc_holdings ?? 780897,
      mstr_shares_outstanding: 346.9,
      mstr_price: liveData?.mstr_price ?? 322.49,
      amplification_ratio: 3.0,
      btc_accumulation_per_quarter: activeScenario === "Custom" ? accumulation : scenario?.accumulation_rate ?? accumulation,
      dilution_rate_per_quarter: activeScenario === "Custom" ? dilutionRate : scenario?.dilution_rate ?? dilutionRate,
      mstr_iv: liveData?.mstr_iv ?? 60,
      msty_nav: liveData?.msty_price ?? 22.50,
      msty_participation_rate: 35,
      projection_years: projectionYears,
      premium_multiple: activeScenario === "Custom" ? mstrPremium : scenario?.premium_multiple ?? mstrPremium,
      earnings_cagr: 50,
      active_scenario: activeScenario,
      cagr_btc: activeScenario === "Custom" ? btcCagr : scenario?.btc_cagr ?? 40,
      cagr_mstr: 75,
      cagr_asst: 60,
      cagr_msty: 35,
    };
  }, [activeScenario, btcCagr, mstrPremium, dilutionRate, accumulation, projectionYears, liveData]);

  const projections = useMemo(
    () => generateProjections(params, DEFAULT_PREFERREDS, params.projection_years * 4),
    [params]
  );

  // MSTY calc
  const mstySharePrice = liveData?.msty_price ?? 22.50;
  const latestWeeklyDiv = liveData?.msty_latest_div ?? 0.2500; // ~$1.00/mo ÷ 4 weeks
  const annualDivFromWeekly = latestWeeklyDiv * 52;
  const weeklyIncomeActual = shareQty * latestWeeklyDiv;
  const monthlyIncomeActual = shareQty * (latestWeeklyDiv * 4.33);
  const annualIncomeActual = shareQty * annualDivFromWeekly;
  const investmentValue = shareQty * mstySharePrice;

  const handleExportCSV = () => {
    const headers = ["Period", "BTC Price", "BTC Holdings", "Shares (M)", "mNAV", "MSTR Price", "Market Cap", "BTC NAV", "MSTY Div/Mo"];
    const rows = projections.map(p => [
      p.label, p.btc_price.toFixed(0), p.btc_holdings.toFixed(0), p.shares_outstanding_m.toFixed(1),
      p.mnav.toFixed(2), p.mstr_price.toFixed(2), p.market_cap.toFixed(0),
      p.btc_nav.toFixed(0), p.msty_dividend_monthly.toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projections_${activeScenario.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Scenario comparison chart
  const comparisonData = useMemo(() => {
    const years = [0, 1, 2, 3, 5, 7, 10];
    return years.map(y => {
      const row = { year: y === 0 ? "Now" : `Y${y}` };
      DEFAULT_SCENARIOS.forEach(sc => {
        const p = { ...params, btc_cagr: sc.btc_cagr, btc_accumulation_per_quarter: sc.accumulation_rate, premium_multiple: sc.premium_multiple, dilution_rate_per_quarter: sc.dilution_rate };
        const btcP = params.btc_price * Math.pow(1 + sc.btc_cagr / 100, y);
        row[sc.name + "_btc"] = Math.round(btcP);
      });
      return row;
    });
  }, [params]);

  // Portfolio valuation projection based on user holdings
  const [portfolioHoldings, setPortfolioHoldings] = useState({
    BTC: 0, MSTR: 0, ASST: 0, STRC: 0, SATA: 0, STRF: 0, STRK: 0, STRD: 0, MSTY: 0,
  });

  const portfolioProjections = useMemo(() => {
    return projections.map(p => {
      const btc_val = portfolioHoldings.BTC * p.btc_price;
      const mstr_val = portfolioHoldings.MSTR * p.mstr_price;
      const asst_val = portfolioHoldings.ASST * (p.btc_price * 0.0789);
      const strc_val = portfolioHoldings.STRC * 99.21;
      const sata_val = portfolioHoldings.SATA * 99.45;
      const strf_val = portfolioHoldings.STRF * 92.50;
      const strk_val = portfolioHoldings.STRK * 87.00;
      const strd_val = portfolioHoldings.STRD * 77.14;
      const msty_val = portfolioHoldings.MSTY * (p.msty_nav || 22.50);
      
      const total = btc_val + mstr_val + asst_val + strc_val + sata_val + strf_val + strk_val + strd_val + msty_val;
      
      return { 
        ...p, 
        btc_val, mstr_val, asst_val, strc_val, sata_val, strf_val, strk_val, strd_val, msty_val,
        portfolio_value: total 
      };
    });
  }, [projections, portfolioHoldings]);

  return (
    <div className="space-y-4">
      {/* Header + Export */}
      <Card>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">Projections Hub</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Custom scenario builder, CAGR module, portfolio and MSTY calculators, and full projection table.
            </p>
          </div>
          <Button size="sm" className="h-8 gap-2 text-xs" onClick={handleExportCSV}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>

        {/* Scenario selector */}
        <div className="flex flex-wrap gap-2 mt-4">
          {[...DEFAULT_SCENARIOS.map(s => s.name), "Custom"].map(s => (
            <button
              key={s}
              onClick={() => setActiveScenario(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${
                activeScenario === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {s}
            </button>
          ))}
          <span className="text-[10px] text-muted-foreground self-center ml-2">
            BTC: ${(params.btc_price ?? 0).toLocaleString()} (live)
          </span>
        </div>
      </Card>

      {/* CAGR Assumptions Table - Moved to top */}
      <CAGRModule 
        params={params} 
        onParamsChange={(newParams) => {
          if (newParams.cagr_btc !== params.cagr_btc) setBtcCagr(newParams.cagr_btc);
        }} 
      />

      {/* My Portfolio Investment Calculator - Moved up */}
      <Card>
        <SectionHeader icon={Users} title="My Portfolio Investment Calculator" color="text-green-400" />
        <p className="text-[10px] text-muted-foreground mb-3">
          Enter your share count for each asset. Income estimates use current dividend rates. Prices update on live refresh.
        </p>
        <InvestmentCalculator liveData={liveData} onHoldingsChange={setPortfolioHoldings} />
      </Card>

      {/* My MSTY Investment Calculator - Moved below portfolio */}
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
                Investment value: <span className="text-foreground font-mono font-semibold">{formatCurrency(investmentValue, 2)}</span> at ${mstySharePrice.toFixed(2)}/share
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
              <p className="text-lg font-bold font-mono text-green-400">{formatCurrency(weeklyIncomeActual, 2)}</p>
              <p className="text-[9px] text-muted-foreground">at latest rate</p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-xl border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Monthly Income</p>
              <p className="text-lg font-bold font-mono text-green-400">{formatCurrency(monthlyIncomeActual, 2)}</p>
              <p className="text-[9px] text-muted-foreground">weekly × 4.33</p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-xl border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Annual Income</p>
              <p className="text-lg font-bold font-mono text-cyan-400">{formatCurrency(annualIncomeActual, 2)}</p>
              <p className="text-[9px] text-muted-foreground">weekly × 52</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Custom scenario builder - moved after calculators */}
      {activeScenario === "Custom" && (
        <Card>
          <SectionHeader icon={Zap} title="Custom Scenario Builder" color="text-purple-400" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { label: "BTC CAGR", value: btcCagr, set: setBtcCagr, min: 5, max: 150, step: 5, suffix: "%", color: "text-amber-400" },
              { label: "Quarterly BTC Accumulation", value: accumulation, set: setAccumulation, min: 1000, max: 100000, step: 1000, suffix: " BTC", color: "text-primary" },
              { label: "MSTR Premium Multiple", value: mstrPremium, set: setMstrPremium, min: 0.5, max: 3.0, step: 0.1, suffix: "x", color: "text-cyan-400" },
              { label: "MSTR Amplification Ratio", value: mstrAmpRatio, set: setMstrAmpRatio, min: 0.5, max: 5.0, step: 0.1, suffix: "x", color: "text-primary" },
              { label: "ASST Premium Multiple", value: asstPremium, set: setAsstPremium, min: 0.5, max: 3.0, step: 0.1, suffix: "x", color: "text-blue-400" },
              { label: "ASST Amplification Ratio", value: asstAmpRatio, set: setAsstAmpRatio, min: 0.5, max: 5.0, step: 0.1, suffix: "x", color: "text-cyan-400" },
              { label: "Quarterly Dilution Rate", value: dilutionRate, set: setDilutionRate, min: 0.5, max: 5.0, step: 0.25, suffix: "%", color: "text-orange-400" },
            ].map(s => (
              <div key={s.label} className="space-y-2">
                <div className="flex justify-between">
                  <Label className={`text-xs ${s.color} font-semibold`}>{s.label}</Label>
                  <span className={`text-xs font-mono font-bold ${s.color}`}>{s.value.toFixed(s.label.includes("CAGR") || s.label.includes("Rate") ? 1 : 2)}{s.suffix}</span>
                </div>
                <Slider value={[s.value]} onValueChange={([v]) => s.set(v)} min={s.min} max={s.max} step={s.step} className="cursor-pointer" />
              </div>
            ))}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs text-muted-foreground font-semibold">Projection Years</Label>
                <span className="text-xs font-mono font-bold text-foreground">{projectionYears}Y</span>
              </div>
              <Slider value={[projectionYears]} onValueChange={([v]) => setProjectionYears(v)} min={1} max={10} step={1} className="cursor-pointer" />
            </div>
          </div>
        </Card>
      )}

      {/* Projection summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "BTC @ Y1", val: projections.find(p => p.quarter === 4), key: "btc_price", fmt: v => formatCurrency(v), color: "text-amber-400" },
          { label: "BTC @ Y3", val: projections.find(p => p.quarter === 12), key: "btc_price", fmt: v => formatCurrency(v), color: "text-amber-400" },
          { label: "MSTR @ Y3", val: projections.find(p => p.quarter === 12), key: "mstr_price", fmt: v => formatCurrency(v, 2), color: "text-primary" },
          { label: "MSTR @ Y5", val: projections.find(p => p.quarter === 20), key: "mstr_price", fmt: v => formatCurrency(v, 2), color: "text-primary" },
        ].map(item => (
          <div key={item.label} className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
            <p className={`text-base font-bold font-mono ${item.color}`}>
              {item.val ? item.fmt(item.val[item.key]) : "—"}
            </p>
            <p className="text-[9px] text-muted-foreground">{activeScenario}</p>
          </div>
        ))}
      </div>

      {/* BTC + MSTR projection charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProjectionChart
          title={`BTC Price Projection — ${activeScenario} (${params.btc_cagr}% CAGR)`}
          data={projections}
          lines={[{ key: "btc_price", name: "BTC Price", color: "#F59E0B" }]}
          type="area"
          height={260}
        />
        <ProjectionChart
          title={`MSTR Price Projection — ${activeScenario}`}
          data={projections}
          lines={[{ key: "mstr_price", name: "MSTR Price", color: "#22C55E" }]}
          type="area"
          height={260}
        />
      </div>

      {/* Strategy BTC Accumulation Graph */}
      <Card>
        <SectionHeader icon={Bitcoin} title="Strategy BTC Accumulation Projection" color="text-amber-400" />
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={projections} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
            <XAxis dataKey="label" tick={TICK_STYLE} />
            <YAxis tick={TICK_STYLE} />
            <Tooltip contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)" }} formatter={(v) => formatNumber(v)} />
            <Line type="monotone" dataKey="btc_holdings" stroke="#F59E0B" strokeWidth={2.5} name="Total BTC Holdings" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* ASST + Personal Portfolio Valuation charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <SectionHeader icon={Bitcoin} title="ASST Price Projection" color="text-blue-400" />
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={projections} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
              <XAxis dataKey="label" tick={TICK_STYLE} />
              <YAxis tick={TICK_STYLE} />
              <Tooltip contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)" }} formatter={(v) => formatCurrency(v, 2)} />
              <Line type="monotone" dataKey="btc_price" stroke="#60A5FA" strokeWidth={2} name="BTC Price" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionHeader icon={Users} title="Your Portfolio Valuation (by Scenario)" color="text-green-400" />
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={portfolioProjections} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
              <XAxis dataKey="label" tick={TICK_STYLE} />
              <YAxis tick={TICK_STYLE} />
              <Tooltip contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)" }} formatter={(v) => formatCurrency(v, 0)} />
              <Legend />
              <Line type="monotone" dataKey="btc_val" stroke="#F59E0B" strokeWidth={1.5} name="BTC" dot={false} opacity={0.7} />
              <Line type="monotone" dataKey="mstr_val" stroke="#22C55E" strokeWidth={1.5} name="MSTR" dot={false} opacity={0.7} />
              <Line type="monotone" dataKey="asst_val" stroke="#60A5FA" strokeWidth={1.5} name="ASST" dot={false} opacity={0.7} />
              <Line type="monotone" dataKey="strc_val" stroke="#34D399" strokeWidth={1.5} name="STRC" dot={false} opacity={0.7} />
              <Line type="monotone" dataKey="sata_val" stroke="#A78BFA" strokeWidth={1.5} name="SATA" dot={false} opacity={0.7} />
              <Line type="monotone" dataKey="strf_val" stroke="#06B6D4" strokeWidth={1.5} name="STRF" dot={false} opacity={0.7} />
              <Line type="monotone" dataKey="strk_val" stroke="#FBBF24" strokeWidth={1.5} name="STRK" dot={false} opacity={0.7} />
              <Line type="monotone" dataKey="strd_val" stroke="#FB923C" strokeWidth={1.5} name="STRD" dot={false} opacity={0.7} />
              <Line type="monotone" dataKey="msty_val" stroke="#FBBF24" strokeWidth={1.5} name="MSTY" dot={false} opacity={0.7} />
              <Line type="monotone" dataKey="portfolio_value" stroke="#10B981" strokeWidth={2.5} name="Total Portfolio" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Full Projection Table */}
      <ProjectionsTable projections={projections} params={params} />
    </div>
  );
}