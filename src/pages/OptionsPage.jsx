import React, { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCw, ChevronDown, Activity, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import OptionsChainTable from "@/components/options/OptionsChainTable";
import OptionsSimulator from "@/components/options/OptionsSimulator";
import OptionsDefinitions from "@/components/options/OptionsDefinitions";
import { formatCurrency } from "@/lib/calculations";

const SUPPORTED_TICKERS = ["MSTR", "MSTY", "ASST", "STRC", "STRF", "STRK", "STRD", "SATA", "SPY", "QQQ", "NVDA", "AAPL", "TSLA"];

function Card({ children, className = "" }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

export default function OptionsPage({ liveData }) {
  const [ticker, setTicker] = useState("MSTR");
  const [customTicker, setCustomTicker] = useState("");
  const [expirations, setExpirations] = useState([]);
  const [selectedExpiry, setSelectedExpiry] = useState(null);
  const [underlyingPrice, setUnderlyingPrice] = useState(null);
  const [chainData, setChainData] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingChain, setLoadingChain] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("chain"); // "chain" | "simulator"

  // Load expiration dates for a ticker
  const loadExpirations = useCallback(async (tkr) => {
    setLoading(true);
    setError(null);
    setExpirations([]);
    setSelectedExpiry(null);
    setChainData(null);
    try {
      const res = await base44.functions.invoke("optionsChain", { ticker: tkr, action: "expirations" });
      const data = res.data;
      if (data.error) throw new Error(data.error);
      setExpirations(data.expirations ?? []);
      setUnderlyingPrice(data.underlyingPrice);
      if (data.expirations?.length > 0) {
        setSelectedExpiry(data.expirations[0]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load options chain for selected expiry
  const loadChain = useCallback(async (tkr, expiry) => {
    setLoadingChain(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("optionsChain", { ticker: tkr, expiration: expiry, action: "chain" });
      const data = res.data;
      if (data.error) throw new Error(data.error);
      setChainData(data);
      if (data.underlying_price) setUnderlyingPrice(data.underlying_price);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingChain(false);
    }
  }, []);

  const handleTickerChange = (tkr) => {
    setTicker(tkr);
    loadExpirations(tkr);
  };

  const handleExpiryChange = (expiry) => {
    setSelectedExpiry(expiry);
    loadChain(ticker, expiry);
  };

  const handleSelectContract = (contract) => {
    setSelectedContract({ ...contract, contract_type: contract.contract_type || "call" });
    setActiveTab("simulator");
  };

  const itmPct = underlyingPrice && chainData
    ? ((chainData.calls?.filter(c => underlyingPrice > c.strike_price).length ?? 0) / Math.max(1, chainData.calls?.length ?? 1) * 100).toFixed(0)
    : null;

  return (
    <div className="min-h-screen bg-background p-4 space-y-4">
      {/* Header */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Options Simulator
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live options chain (Polygon.io) · Black-Scholes pricing · Full Greeks · P&L simulator
            </p>
          </div>

          {underlyingPrice && (
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">{ticker} Price</p>
                <p className="text-lg font-bold font-mono text-amber-400">${underlyingPrice.toFixed(2)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Ticker selector */}
        <div className="flex flex-wrap gap-2 mt-4 items-end">
          <div>
            <Label className="text-[10px] text-muted-foreground mb-1 block">Underlying Ticker</Label>
            <div className="flex flex-wrap gap-1.5">
              {SUPPORTED_TICKERS.map(t => (
                <button key={t} onClick={() => handleTickerChange(t)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-mono font-semibold transition-colors ${
                    ticker === t && !customTicker
                      ? "bg-primary/20 border-primary text-primary"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}>{t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-end">
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">Custom Ticker</Label>
              <Input
                value={customTicker}
                onChange={e => setCustomTicker(e.target.value.toUpperCase())}
                placeholder="e.g. AMD"
                className="h-8 w-24 text-xs font-mono bg-secondary border-border"
                onKeyDown={e => {
                  if (e.key === "Enter" && customTicker) {
                    setTicker(customTicker);
                    loadExpirations(customTicker);
                  }
                }}
              />
            </div>
            <button
              onClick={() => { if (customTicker) { setTicker(customTicker); loadExpirations(customTicker); } }}
              className="h-8 px-3 text-xs rounded-lg border border-primary text-primary hover:bg-primary/10 transition-colors"
            >
              Load
            </button>
            <button
              onClick={() => selectedExpiry ? loadChain(ticker, selectedExpiry) : loadExpirations(ticker)}
              className="h-8 px-3 text-xs rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${loading || loadingChain ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Expiry selector */}
        {expirations.length > 0 && (
          <div className="mt-3">
            <Label className="text-[10px] text-muted-foreground mb-1.5 block">Expiration Date</Label>
            <div className="flex flex-wrap gap-1.5">
              {expirations.map(exp => {
                const d = new Date(exp);
                const dte = Math.round((d - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <button key={exp} onClick={() => handleExpiryChange(exp)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-mono transition-colors ${
                      selectedExpiry === exp
                        ? "bg-primary/20 border-primary text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}>
                    {exp} <span className="text-[9px] opacity-60">{dte}d</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Load button if no expirations yet */}
        {expirations.length === 0 && !loading && (
          <button
            onClick={() => loadExpirations(ticker)}
            className="mt-3 w-full py-2 rounded-xl border border-primary text-primary text-sm font-semibold hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
          >
            <Activity className="w-4 h-4" />
            Load {ticker} Options Chain
          </button>
        )}

        {loading && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Loading expiration dates...
          </div>
        )}

        {error && (
          <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
            ⚠ {error}. Polygon.io requires an active key with options data access.
          </div>
        )}
      </Card>

      {/* Tab switcher */}
      <div className="flex gap-2">
        {["chain", "simulator"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`text-sm px-4 py-2 rounded-xl border font-semibold capitalize transition-colors ${
              activeTab === tab
                ? "bg-primary/20 border-primary text-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}>
            {tab === "chain" ? "📊 Options Chain" : "🎯 P&L Simulator"}
            {tab === "simulator" && selectedContract && (
              <span className="ml-2 text-[10px] bg-primary/20 text-primary rounded-full px-1.5">
                {selectedContract.ticker?.split(":").pop()?.slice(0, 12)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Options Chain */}
      {activeTab === "chain" && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">
              {ticker} Options Chain
              {selectedExpiry && <span className="text-muted-foreground font-normal text-xs ml-2">— {selectedExpiry}</span>}
            </p>
            {loadingChain && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Loading...
              </span>
            )}
            {chainData && (
              <span className="text-[10px] text-muted-foreground">
                {chainData.total_calls} calls · {chainData.total_puts} puts
              </span>
            )}
          </div>

          {!chainData && !loadingChain && (
            <p className="text-xs text-muted-foreground text-center py-8">
              {expirations.length > 0 ? "Select an expiration date above to load the options chain." : "Load a ticker above to get started."}
            </p>
          )}

          {chainData && (
            <OptionsChainTable
              calls={chainData.calls}
              puts={chainData.puts}
              underlyingPrice={underlyingPrice ?? 0}
              onSelectContract={handleSelectContract}
              selectedContract={selectedContract}
            />
          )}
        </Card>
      )}

      {/* Simulator */}
      {activeTab === "simulator" && (
        <OptionsSimulator
          selectedContract={selectedContract}
          underlyingPrice={underlyingPrice ?? 200}
          selectedExpiry={selectedExpiry}
          liveData={liveData}
        />
      )}

      {/* Definitions */}
      <OptionsDefinitions />

      {/* Stats bar when chain is loaded */}
      {chainData && underlyingPrice && (
        <Card className="py-2 px-4">
          <div className="flex flex-wrap gap-6 text-[10px]">
            <span className="text-muted-foreground">Underlying: <span className="text-amber-400 font-mono font-bold">${underlyingPrice.toFixed(2)}</span></span>
            <span className="text-muted-foreground">Calls: <span className="text-green-400 font-mono">{chainData.total_calls}</span></span>
            <span className="text-muted-foreground">Puts: <span className="text-red-400 font-mono">{chainData.total_puts}</span></span>
            <span className="text-muted-foreground">Expiry: <span className="text-foreground font-mono">{selectedExpiry}</span></span>
            <span className="text-muted-foreground">Fetched: <span className="text-foreground font-mono">{chainData.fetched_at ? new Date(chainData.fetched_at).toLocaleTimeString() : "—"}</span></span>
            {selectedContract && (
              <span className="text-muted-foreground ml-auto">
                Selected: <span className="text-primary font-mono font-semibold">{selectedContract.strike_price} {selectedContract.contract_type?.toUpperCase()}</span>
              </span>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}