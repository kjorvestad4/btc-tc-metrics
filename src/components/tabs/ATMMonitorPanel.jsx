import React, { useState } from "react";
import { ExternalLink, Activity, Bitcoin, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import {
  STRC_ATM_PROGRAM, STRC_RECENT_ACTIVITY,
  SATA_ATM_PROGRAM, SATA_RECENT_ACTIVITY,
} from "@/lib/correlationData";

// ── Weekly aggregated data from bitcoinquant.co (STRC) ──────────────────────
const STRC_WEEKLY = [
  { week: "This Week (4/13–4/17)", total_vol_B: 3.9,  pct_at_par: 70, est_proceeds_B: 1.8,  est_btc: 23934, days_active: 2 },
  { week: "Last Week (4/6–4/10)",  total_vol_B: 1.5,  pct_at_par: 84, est_proceeds_B: 1.0,  est_btc: 13926, days_active: 3 },
  { week: "Mar 30 – Apr 3",       total_vol_B: null, pct_at_par: null, est_proceeds_B: 1.33, est_btc: 19653, days_active: null },
  { week: "Mar 16–20",            total_vol_B: null, pct_at_par: null, est_proceeds_B: 1.18, est_btc: 16816, days_active: null },
  { week: "Mar 9–13",             total_vol_B: null, pct_at_par: null, est_proceeds_B: 0.377, est_btc: 5315, days_active: null },
];

// Confirmed SEC filings (STRC)
const STRC_SEC_FILINGS = [
  { filed: "Apr 13, 2026", period: "Apr 6–12", shares: "10,028,363", proceeds: "$1.00B",   btc: 13926, url: "https://www.sec.gov/Archives/edgar/data/1050446/000119312526152015/mstr-20260223.htm" },
  { filed: "Apr 6, 2026",  period: "Apr 1–5",  shares: "1,027,255",  proceeds: "$102.6M",  btc: 1515,  url: "https://www.sec.gov/Archives/edgar/data/1050446/000119312526142925/mstr-20260406.htm" },
  { filed: "Mar 16, 2026", period: "Mar 9–15", shares: "11,818,467", proceeds: "$1.18B",   btc: 16816, url: "https://www.sec.gov/Archives/edgar/data/1050446/000119312526107263/mstr-20260223.htm" },
  { filed: "Mar 9, 2026",  period: "Mar 2–8",  shares: "3,776,205",  proceeds: "$377.1M",  btc: 5315,  url: "https://www.sec.gov/Archives/edgar/data/1050446/000119312526097598/d122015d8k.htm" },
  { filed: "Feb 17, 2026", period: "Feb 9–16", shares: "785,354",    proceeds: "$78.4M",   btc: 1158,  url: "https://www.sec.gov/Archives/edgar/data/1050446/000119312526053105/mstr-20260105.htm" },
];

function StatusBadge({ price, par = 100 }) {
  const diff = price - par;
  if (diff >= 0) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
      <TrendingUp className="w-2.5 h-2.5" /> ATM ACTIVE +{diff.toFixed(2)}
    </span>
  );
  if (diff >= -1.5) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
      <Minus className="w-2.5 h-2.5" /> STANDBY {diff.toFixed(2)}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
      <TrendingDown className="w-2.5 h-2.5" /> BELOW PAR {diff.toFixed(2)}
    </span>
  );
}

function ParBar({ price, par = 100 }) {
  const pct = Math.min(100, Math.max(0, (price / par) * 100));
  const color = price >= par ? "bg-green-500" : price >= 98.5 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-12 text-right">${price.toFixed(2)}</span>
    </div>
  );
}

function SourceLink({ href, label }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors">
      {label} <ExternalLink className="w-2.5 h-2.5" />
    </a>
  );
}

export default function ATMMonitorPanel({ liveData }) {
  const [tab, setTab] = useState("strc");

  const strcPrice = liveData?.strc_price ?? STRC_RECENT_ACTIVITY[0]?.price ?? 99.21;
  const sataPrice = liveData?.sata_price ?? SATA_RECENT_ACTIVITY[0]?.price ?? 99.58;

  // Live yield
  const strcYield = ((STRC_ATM_PROGRAM.strc_total_capacity_M > 0 ? 11.50 : 11.50) / strcPrice * 100).toFixed(2);
  const sataYield = (12.75 / sataPrice * 100).toFixed(2);

  // Capacity remaining
  const strcUsedPct = (STRC_ATM_PROGRAM.strc_issued_to_date_M / STRC_ATM_PROGRAM.strc_total_capacity_M * 100).toFixed(1);
  const sataUsedPct = (SATA_ATM_PROGRAM.sata_issued_to_date_M / SATA_ATM_PROGRAM.sata_total_capacity_M * 100).toFixed(1);

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">ATM Program Monitor</h3>
          <span className="text-[10px] text-muted-foreground">STRC & SATA Real-Time</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SourceLink href="https://strc.live/" label="strc.live" />
          <SourceLink href="https://bitcointreasuries.net/digital-credit/STRC" label="bitcointreasuries/STRC" />
          <SourceLink href="https://bitcointreasuries.net/digital-credit/SATA" label="bitcointreasuries/SATA" />
          <SourceLink href="https://bitcoinquant.co/preferred-equity" label="bitcoinquant" />
        </div>
      </div>

      {/* Quick Status Strip */}
      <div className="grid grid-cols-2 gap-3">
        {/* STRC */}
        <div className="bg-secondary/40 rounded-lg p-3 border border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400">STRC</span>
            <StatusBadge price={strcPrice} />
          </div>
          <ParBar price={strcPrice} />
          <div className="grid grid-cols-3 gap-1 text-center">
            <div>
              <p className="text-[9px] text-muted-foreground">Eff. Yield</p>
              <p className="text-xs font-mono font-bold text-green-400">{strcYield}%</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">vs Par</p>
              <p className={`text-xs font-mono font-bold ${strcPrice >= 100 ? "text-green-400" : "text-red-400"}`}>
                {(strcPrice - 100).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">ATM Cap</p>
              <p className="text-xs font-mono font-bold text-foreground">$21B</p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
              <span>Capacity Used</span><span>{strcUsedPct}%</span>
            </div>
            <div className="h-1 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${strcUsedPct}%` }} />
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5">${STRC_ATM_PROGRAM.strc_issued_to_date_M.toLocaleString()}M issued · ${STRC_ATM_PROGRAM.strc_remaining_M.toLocaleString()}M remaining</p>
          </div>
        </div>

        {/* SATA */}
        <div className="bg-secondary/40 rounded-lg p-3 border border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-violet-400">SATA</span>
            <StatusBadge price={sataPrice} />
          </div>
          <ParBar price={sataPrice} />
          <div className="grid grid-cols-3 gap-1 text-center">
            <div>
              <p className="text-[9px] text-muted-foreground">Eff. Yield</p>
              <p className="text-xs font-mono font-bold text-green-400">{sataYield}%</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">vs Par</p>
              <p className={`text-xs font-mono font-bold ${sataPrice >= 100 ? "text-green-400" : "text-red-400"}`}>
                {(sataPrice - 100).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">ATM Cap</p>
              <p className="text-xs font-mono font-bold text-foreground">$500M</p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
              <span>Capacity Used</span><span>{sataUsedPct}%</span>
            </div>
            <div className="h-1 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full" style={{ width: `${sataUsedPct}%` }} />
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5">${SATA_ATM_PROGRAM.sata_issued_to_date_M.toLocaleString()}M issued · ${SATA_ATM_PROGRAM.sata_remaining_M.toFixed(1)}M remaining</p>
          </div>
        </div>
      </div>

      {/* Tabs: STRC Weekly / SATA Daily / SEC Filings */}
      <div className="flex gap-1 border-b border-border pb-0.5">
        {["strc", "sata", "sec"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-[10px] px-2.5 py-1 rounded-t font-semibold transition-colors ${
              tab === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t === "strc" ? "STRC Weekly" : t === "sata" ? "SATA Daily" : "SEC Filings"}
          </button>
        ))}
      </div>

      {/* STRC Weekly Breakdown */}
      {tab === "strc" && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground">Weekly ATM activity — source: <SourceLink href="https://bitcoinquant.co/preferred-equity" label="bitcoinquant.co" /></p>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-1 pr-2">Week</th>
                  <th className="text-right pr-2">Total Vol</th>
                  <th className="text-right pr-2">% ≥ $100</th>
                  <th className="text-right pr-2">Est. Proceeds</th>
                  <th className="text-right">Est. BTC ₿</th>
                </tr>
              </thead>
              <tbody>
                {STRC_WEEKLY.map((row, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-secondary/30">
                    <td className="py-1 pr-2 text-foreground font-medium">{row.week}</td>
                    <td className="text-right pr-2 font-mono text-foreground">{row.total_vol_B != null ? `$${row.total_vol_B}B` : "—"}</td>
                    <td className={`text-right pr-2 font-mono font-bold ${row.pct_at_par >= 80 ? "text-green-400" : row.pct_at_par >= 50 ? "text-amber-400" : row.pct_at_par === 0 ? "text-red-400" : "text-muted-foreground"}`}>
                      {row.pct_at_par != null ? `${row.pct_at_par}%` : "—"}
                    </td>
                    <td className="text-right pr-2 font-mono text-purple-400 font-bold">{row.est_proceeds_B != null ? `$${row.est_proceeds_B}B` : "—"}</td>
                    <td className="text-right font-mono text-amber-400 font-bold">₿{row.est_btc.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] text-muted-foreground/70">65% ATM capture rate applied to vol ≥ $100. Confirmed figures released weekly via SEC 8-K.</p>
        </div>
      )}

      {/* SATA Daily */}
      {tab === "sata" && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground">Daily activity — source: <SourceLink href="https://bitcointreasuries.net/digital-credit/SATA" label="bitcointreasuries.net/SATA" /></p>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-1 pr-2">Date</th>
                  <th className="text-right pr-2">Price</th>
                  <th className="text-right pr-2">Vol $M</th>
                  <th className="text-right pr-2">% ≥ Par</th>
                  <th className="text-right pr-2">Est. Proceeds</th>
                  <th className="text-right">Est. BTC</th>
                </tr>
              </thead>
              <tbody>
                {SATA_RECENT_ACTIVITY.map((row, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-secondary/30">
                    <td className="py-1 pr-2 font-mono text-muted-foreground">{row.date.slice(5)}</td>
                    <td className={`text-right pr-2 font-mono font-bold ${row.price >= 100 ? "text-green-400" : "text-amber-400"}`}>${row.price.toFixed(2)}</td>
                    <td className="text-right pr-2 font-mono text-foreground">${row.volume_M.toFixed(2)}M</td>
                    <td className={`text-right pr-2 font-mono ${row.pct_at_par > 0 ? "text-green-400 font-bold" : "text-muted-foreground"}`}>
                      {row.pct_at_par > 0 ? `${row.pct_at_par}%` : "—"}
                    </td>
                    <td className="text-right pr-2 font-mono text-violet-400 font-bold">
                      {row.proceeds_M > 0 ? `$${row.proceeds_M.toFixed(1)}M` : "—"}
                    </td>
                    <td className="text-right font-mono text-amber-400 font-bold">
                      {row.btc_acquired > 0 ? `₿${row.btc_acquired}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="bg-secondary/30 rounded p-2 text-center">
              <p className="text-[9px] text-muted-foreground">Program Remaining</p>
              <p className="text-xs font-mono font-bold text-violet-400">${SATA_ATM_PROGRAM.sata_remaining_M.toFixed(0)}M</p>
            </div>
            <div className="bg-secondary/30 rounded p-2 text-center">
              <p className="text-[9px] text-muted-foreground">Div Rate</p>
              <p className="text-xs font-mono font-bold text-green-400">12.75%</p>
            </div>
          </div>
        </div>
      )}

      {/* SEC Filings */}
      {tab === "sec" && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground">Confirmed STRC ATM 8-K filings — source: <SourceLink href="https://bitcoinquant.co/preferred-equity" label="bitcoinquant.co" /></p>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-1 pr-2">Filed</th>
                  <th className="text-left pr-2">Period</th>
                  <th className="text-right pr-2">Shares</th>
                  <th className="text-right pr-2">Proceeds</th>
                  <th className="text-right pr-2">BTC ₿</th>
                  <th className="text-right">8-K</th>
                </tr>
              </thead>
              <tbody>
                {STRC_SEC_FILINGS.map((row, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-secondary/30">
                    <td className="py-1 pr-2 font-mono text-muted-foreground">{row.filed}</td>
                    <td className="pr-2 text-foreground">{row.period}</td>
                    <td className="text-right pr-2 font-mono text-foreground">{row.shares}</td>
                    <td className="text-right pr-2 font-mono text-purple-400 font-bold">{row.proceeds}</td>
                    <td className="text-right pr-2 font-mono text-amber-400 font-bold">₿{row.btc.toLocaleString()}</td>
                    <td className="text-right">
                      <a href={row.url} target="_blank" rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-0.5">
                        View <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border font-bold text-foreground">
                  <td className="py-1 pr-2 text-muted-foreground" colSpan={2}>TOTAL (to date)</td>
                  <td className="text-right pr-2 font-mono">35.6M sh</td>
                  <td className="text-right pr-2 font-mono text-purple-400">$3.55B</td>
                  <td className="text-right pr-2 font-mono text-amber-400">₿48,210</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}