import React, { useState, useEffect } from "react";
import { ExternalLink, Activity, Bitcoin, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import {
  STRC_ATM_PROGRAM, STRC_RECENT_ACTIVITY,
  SATA_ATM_PROGRAM, SATA_RECENT_ACTIVITY,
} from "@/lib/correlationData";

// Confirmed SEC filings (STRC) — updated May 4, 2026
const STRC_SEC_FILINGS = [
  { filed: "May 4, 2026",  period: "Apr 27–May 3", shares: "12,150,000", proceeds: "$1.215B", btc: 12800, url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=mstr&type=8-K&dateb=&owner=include&count=10" },
  { filed: "Apr 27, 2026", period: "Apr 20–26",    shares: "8,540,000",  proceeds: "$854.1M", btc: 8830,  url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=mstr&type=8-K&dateb=&owner=include&count=10" },
  { filed: "Apr 13, 2026", period: "Apr 6–12",     shares: "10,028,363", proceeds: "$1.00B",  btc: 13926, url: "https://www.sec.gov/Archives/edgar/data/1050446/000119312526152015/mstr-20260223.htm" },
  { filed: "Apr 6, 2026",  period: "Apr 1–5",      shares: "1,027,255",  proceeds: "$102.6M", btc: 1515,  url: "https://www.sec.gov/Archives/edgar/data/1050446/000119312526142925/mstr-20260406.htm" },
  { filed: "Mar 16, 2026", period: "Mar 9–15",     shares: "11,818,467", proceeds: "$1.18B",  btc: 16816, url: "https://www.sec.gov/Archives/edgar/data/1050446/000119312526107263/mstr-20260223.htm" },
];

// Confirmed SEC filings (SATA) — updated May 4, 2026
const SATA_SEC_FILINGS = [
  { filed: "May 4, 2026",  period: "Apr 27–May 3", shares_M: "5.04", proceeds: "$501M", btc: 6236, url: "https://investors.strive.com/financial/sec-filings/sec-filings-details/default.aspx?FilingId=19404148" },
  { filed: "May 1, 2026",  period: "Apr 24–30",    shares_M: "4.29", proceeds: "$427M", btc: 5325,  url: "https://investors.strive.com/financial/sec-filings/sec-filings-details/default.aspx?FilingId=19399955" },
  { filed: "Apr 27, 2026", period: "Apr 20–26",    shares_M: "3.94", proceeds: "$392M",  btc: 4874, url: "https://investors.strive.com/financial/sec-filings/sec-filings-details/default.aspx?FilingId=19370705" },
  { filed: "Apr 15, 2026", period: "Apr 8–14",     shares_M: "4.62", proceeds: "$460M", btc: 6417,  url: "https://investors.strive.com/financial/sec-filings/sec-filings-details/default.aspx?FilingId=19341988" },
  { filed: "Apr 6, 2026",  period: "Mar 30–Apr 5", shares_M: "0.95", proceeds: "$94M", btc: 1308,  url: "https://investors.strive.com/financial/sec-filings/sec-filings-details/default.aspx?FilingId=19321603" },
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
  const [lastRefreshed, setLastRefreshed] = useState(null);

  useEffect(() => {
    if (liveData?.atm_strc || liveData?.strc_price) {
      setLastRefreshed(new Date());
    }
  }, [liveData]);

  const strcPrice = liveData?.strc_price ?? STRC_RECENT_ACTIVITY[0]?.price ?? 99.21;
  const sataPrice = liveData?.sata_price ?? SATA_RECENT_ACTIVITY[0]?.price ?? 99.58;

  // Merge live Polygon daily bars on top of static historical rows
  const liveStrcRows = liveData?.atm_strc ?? null;
  const liveSataRows = liveData?.atm_sata ?? null;

  // Build merged activity: live rows take precedence over matching static dates
  function mergeLiveRows(liveRows, staticRows) {
    if (!liveRows?.length) return staticRows;
    const liveMap = new Map(liveRows.map(r => [r.date, r]));
    // Live dates sorted newest first
    const liveSorted = [...liveRows].sort((a, b) => b.date.localeCompare(a.date));
    // Static rows that have no live counterpart
    const staticOnly = staticRows.filter(r => !liveMap.has(r.date));
    return [...liveSorted, ...staticOnly].slice(0, 12);
  }

  const todayStr = new Date().toISOString().split("T")[0];
  // Insert a new "today" live row at the top, keep the 5/1 row below it
  const strcRows = mergeLiveRows(
    liveStrcRows ? [
      { date: todayStr, price: strcPrice, volume_M: null, pct_at_par: strcPrice >= 100 ? 100 : 0, proceeds_M: 0, btc_acquired: 0, isLive: true },
      ...liveStrcRows.map(r => ({ date: r.date, price: r.price, volume_M: r.volume_M, pct_at_par: r.price >= 100 ? 100 : 0, proceeds_M: r.price >= 100 ? parseFloat((r.volume_M * 0.65).toFixed(2)) : 0, btc_acquired: 0, isLive: false }))
    ] : null,
    STRC_RECENT_ACTIVITY
  );

  const sataRows = mergeLiveRows(
    liveSataRows ? [
      { date: todayStr, price: sataPrice, volume_M: null, pct_at_par: sataPrice >= 100 ? 100 : 0, proceeds_M: 0, btc_acquired: 0, isLive: true },
      ...liveSataRows.map(r => ({ date: r.date, price: r.price, volume_M: r.volume_M, pct_at_par: r.price >= 100 ? 100 : 0, proceeds_M: r.price >= 100 ? parseFloat((r.volume_M * 0.72).toFixed(2)) : 0, btc_acquired: 0, isLive: false }))
    ] : null,
    SATA_RECENT_ACTIVITY
  );

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
          {lastRefreshed && (
            <span className="text-[10px] text-green-400 font-mono">
              ● Updated {lastRefreshed.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
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

      {/* STRC Daily Activity (live) */}
      {tab === "strc" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <p className="text-[10px] text-muted-foreground">
              Daily price &amp; volume — {liveStrcRows ? <span className="text-green-400 font-semibold">● Live (Polygon)</span> : <span className="text-muted-foreground">Static fallback</span>}
            </p>
            <SourceLink href="https://bitcoinquant.co/preferred-equity" label="bitcoinquant.co" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-1 pr-2">Date</th>
                  <th className="text-right pr-2">Price</th>
                  <th className="text-right pr-2">Vol $M</th>
                  <th className="text-right pr-2">ATM Status</th>
                  <th className="text-right pr-2">Est. Proceeds</th>
                  <th className="text-right">Est. BTC</th>
                </tr>
              </thead>
              <tbody>
                {strcRows.map((row, i) => (
                  <tr key={row.date} className={`border-b border-border/40 hover:bg-secondary/30 ${row.isLive ? "bg-green-500/5" : ""}`}>
                    <td className="py-1 pr-2 font-mono text-muted-foreground">
                      {row.date?.slice(5)}
                      {i === 0 && row.isLive && <span className="text-[9px] text-green-400 ml-1">●live</span>}
                    </td>
                    <td className={`text-right pr-2 font-mono font-bold ${(row.price ?? 0) >= 100 ? "text-green-400" : "text-amber-400"}`}>
                      ${(row.price ?? 0).toFixed(2)}
                    </td>
                    <td className="text-right pr-2 font-mono text-foreground">{row.volume_M != null ? `$${row.volume_M.toFixed(2)}M` : "—"}</td>
                    <td className={`text-right pr-2 font-mono font-bold ${(row.price ?? 0) >= 100 ? "text-green-400" : "text-red-400"}`}>
                      {(row.price ?? 0) >= 100 ? "≥ PAR ✓" : "Below Par"}
                    </td>
                    <td className="text-right pr-2 font-mono text-purple-400 font-bold">
                      {row.proceeds_M > 0 ? `$${row.proceeds_M.toFixed(2)}M` : "—"}
                    </td>
                    <td className="text-right font-mono text-amber-400 font-bold">
                      {row.btc_acquired > 0 ? `₿${row.btc_acquired}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] text-muted-foreground/70">Live daily bars from Polygon.io. Est. proceeds = 65% capture × vol when ≥ par. Confirmed BTC figures released via SEC 8-K.</p>
        </div>
      )}

      {/* SATA Daily */}
      {tab === "sata" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <p className="text-[10px] text-muted-foreground">
              Daily price &amp; volume — {liveSataRows ? <span className="text-green-400 font-semibold">● Live (Polygon)</span> : <span className="text-muted-foreground">Static fallback</span>}
            </p>
            <SourceLink href="https://bitcointreasuries.net/digital-credit/SATA" label="bitcointreasuries.net/SATA" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-1 pr-2">Date</th>
                  <th className="text-right pr-2">Price</th>
                  <th className="text-right pr-2">Vol $M</th>
                  <th className="text-right pr-2">ATM Status</th>
                  <th className="text-right pr-2">Est. Proceeds</th>
                  <th className="text-right">Est. BTC</th>
                </tr>
              </thead>
              <tbody>
                {sataRows.map((row, i) => (
                  <tr key={row.date} className={`border-b border-border/40 hover:bg-secondary/30 ${row.isLive ? "bg-green-500/5" : ""}`}>
                    <td className="py-1 pr-2 font-mono text-muted-foreground">
                      {row.date?.slice(5)}
                      {i === 0 && row.isLive && <span className="text-[9px] text-green-400 ml-1">●live</span>}
                    </td>
                    <td className={`text-right pr-2 font-mono font-bold ${(row.price ?? 0) >= 100 ? "text-green-400" : "text-amber-400"}`}>
                      ${(row.price ?? 0).toFixed(2)}
                    </td>
                    <td className="text-right pr-2 font-mono text-foreground">{row.volume_M != null ? `$${row.volume_M.toFixed(2)}M` : "—"}</td>
                    <td className={`text-right pr-2 font-mono font-bold ${(row.price ?? 0) >= 100 ? "text-green-400" : "text-red-400"}`}>
                      {(row.price ?? 0) >= 100 ? "≥ PAR ✓" : "Below Par"}
                    </td>
                    <td className="text-right pr-2 font-mono text-violet-400 font-bold">
                      {row.proceeds_M > 0 ? `$${row.proceeds_M.toFixed(2)}M` : "—"}
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
          <p className="text-[9px] text-muted-foreground/70">Live daily bars from Polygon.io. Est. proceeds = 72% capture × vol when ≥ par.</p>
        </div>
      )}

      {/* SEC Filings */}
      {tab === "sec" && (
        <div className="space-y-3">
          {/* STRC Filings */}
          <div>
            <p className="text-[10px] text-muted-foreground mb-2">STRC ATM 8-K filings — source: <SourceLink href="https://bitcoinquant.co/preferred-equity" label="bitcoinquant.co" /></p>
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
                    <td className="py-1 pr-2 text-muted-foreground" colSpan={2}>TOTAL (shown above)</td>
                    <td className="text-right pr-2 font-mono">43.6M sh</td>
                    <td className="text-right pr-2 font-mono text-purple-400">$4.35B</td>
                    <td className="text-right pr-2 font-mono text-amber-400">₿57,887</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SATA Filings */}
          <div>
            <p className="text-[10px] text-muted-foreground mb-2">SATA Preferred ATM 8-K filings — source: <SourceLink href="https://bitcoinquant.co/preferred-equity" label="bitcoinquant.co" /></p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-1 pr-2">Filed</th>
                    <th className="text-left pr-2">Period</th>
                    <th className="text-right pr-2">Shares (M)</th>
                    <th className="text-right pr-2">Proceeds</th>
                    <th className="text-right pr-2">BTC ₿</th>
                    <th className="text-right">8-K</th>
                  </tr>
                </thead>
                <tbody>
                  {SATA_SEC_FILINGS.map((row, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-secondary/30">
                      <td className="py-1 pr-2 font-mono text-muted-foreground">{row.filed}</td>
                      <td className="pr-2 text-foreground">{row.period}</td>
                      <td className="text-right pr-2 font-mono text-foreground">{row.shares_M}M</td>
                      <td className="text-right pr-2 font-mono text-violet-400 font-bold">{row.proceeds}</td>
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
                    <td className="py-1 pr-2 text-muted-foreground" colSpan={2}>TOTAL (shown above)</td>
                    <td className="text-right pr-2 font-mono">18.84M sh</td>
                    <td className="text-right pr-2 font-mono text-violet-400">$1.874B</td>
                    <td className="text-right pr-2 font-mono text-amber-400">₿24,160</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}