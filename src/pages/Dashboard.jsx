import React, { useState, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Bitcoin, TrendingUp, BarChart3, Layers, TableProperties, GitBranch, Building2, Wallet } from "lucide-react";
import Navbar from "@/components/dashboard/Navbar";
import ParameterPanel from "@/components/dashboard/ParameterPanel";
import OverviewTab from "@/components/tabs/OverviewTab";
import BTCModelTab from "@/components/tabs/BTCModelTab";
import MSTRModelTab from "@/components/tabs/MSTRModelTab";
import MSTYModelTab from "@/components/tabs/MSTYModelTab";
import PreferredTab from "@/components/tabs/PreferredTab";
import ProjectionsTable from "@/components/tabs/ProjectionsTable";
import CorrelationsTab from "@/components/tabs/CorrelationsTab";
import StrategyDashboardTab from "@/components/tabs/StrategyDashboardTab";
import ASSTModelTab from "@/components/tabs/ASSTModelTab";
import SATAModelTab from "@/components/tabs/SATAModelTab";
import STRCModelTab from "@/components/tabs/STRCModelTab";
import { DEFAULT_PARAMS, DEFAULT_PREFERREDS, DEFAULT_SCENARIOS, generateProjections } from "@/lib/calculations";
import { fetchAllMarketData } from "@/lib/marketData";
import { toast } from "sonner";

export default function Dashboard() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [preferreds, setPreferreds] = useState(DEFAULT_PREFERREDS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [liveData, setLiveData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [polygonKey, setPolygonKey] = useState(() => sessionStorage.getItem("polygon_api_key") || "");

  const handlePolygonKeyChange = useCallback((key) => {
    setPolygonKey(key);
    sessionStorage.setItem("polygon_api_key", key);
  }, []);

  const handleRefreshLive = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchAllMarketData(polygonKey || null);
      setLiveData(data);

      // Apply fetched values to params
      setParams((prev) => ({
        ...prev,
        ...(data.btc_price != null && { btc_price: Math.round(data.btc_price) }),
        ...(data.btc_holdings != null && { mstr_btc_holdings: data.btc_holdings }),
        ...(data.mstr_price != null && { mstr_price: Math.round(data.mstr_price) }),
        ...(data.msty_price != null && { msty_nav: parseFloat(data.msty_price.toFixed(2)) }),
        ...(data.mstr_iv != null && { mstr_iv: data.mstr_iv }),
      }));

      // Build toast summary
      const parts = [];
      if (data.btc_price) parts.push(`BTC $${data.btc_price.toLocaleString()}`);
      if (data.btc_holdings) parts.push(`Holdings ${data.btc_holdings.toLocaleString()} BTC`);
      if (data.mstr_price) parts.push(`MSTR $${data.mstr_price.toFixed(2)}`);
      if (data.msty_price) parts.push(`MSTY $${data.msty_price.toFixed(2)}`);
      if (data.mstr_iv) parts.push(`IV ${data.mstr_iv}%`);

      const hasErrors = data.errors?.length > 0;
      if (hasErrors) {
        // Show helpful message if polygon key missing
        const noPolygon = !polygonKey && data.errors.some(e => e.includes("MSTR") || e.includes("MSTY"));
        if (noPolygon) {
          toast.warning(
            parts.length > 0
              ? `Partial refresh: ${parts.join(" · ")} — Enter Polygon key in sidebar for live stock data`
              : "Enter Polygon.io API key in sidebar for live MSTR/MSTY/IV data",
            { duration: 6000 }
          );
        } else {
          toast.warning(`Partial data — ${parts.join(" · ")} | Failed: ${data.errors.join(", ")}`, { duration: 5000 });
        }
      } else {
        toast.success(`Live data synced — ${parts.join(" · ")}`, { duration: 5000 });
      }

      return data;
    } finally {
      setRefreshing(false);
    }
  }, [polygonKey]);

  const projections = useMemo(() => {
    return generateProjections(params, preferreds, params.projection_years * 4);
  }, [params, preferreds]);

  const handleScenarioChange = useCallback((scenarioName) => {
    const scenario = DEFAULT_SCENARIOS.find((s) => s.name === scenarioName);
    if (scenario) {
      setParams((prev) => ({
        ...prev,
        btc_cagr: scenario.btc_cagr,
        btc_accumulation_per_quarter: scenario.accumulation_rate,
        amplification_ratio: scenario.amplification_ratio,
        premium_multiple: scenario.premium_multiple,
        dilution_rate_per_quarter: scenario.dilution_rate,
        mstr_iv: scenario.mstr_iv,
        earnings_cagr: scenario.earnings_cagr,
        active_scenario: scenarioName,
      }));
    }
  }, []);

  const handleExport = useCallback(() => {
    const headers = ["Period", "BTC Price", "BTC Holdings", "Shares (M)", "mNAV", "MSTR Price", "Premium %", "Market Cap", "BTC NAV", "MSTY Div/Mo", "MSTY Yield %"];
    const rows = projections.map((p) => [
      p.label, p.btc_price.toFixed(0), p.btc_holdings.toFixed(0), p.shares_outstanding_m.toFixed(1),
      p.mnav.toFixed(2), p.mstr_price.toFixed(2), p.premium_to_nav.toFixed(1), p.market_cap.toFixed(0),
      p.btc_nav.toFixed(0), p.msty_dividend_monthly.toFixed(2), p.msty_yield.toFixed(1),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `punterjeff_projections_${params.active_scenario}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [projections, params.active_scenario]);

  const tabItems = [
    { value: "overview",      label: "Overview",         icon: LayoutDashboard },
    { value: "correlations",  label: "Correlations",     icon: GitBranch },
    { value: "strategy",      label: "Strategy",         icon: Building2 },
    { value: "btc",           label: "BTC",              icon: Bitcoin },
    { value: "mstr",          label: "MSTR",             icon: TrendingUp },
    { value: "strc",          label: "STRC",             icon: Layers },
    { value: "asst",          label: "ASST",             icon: Building2 },
    { value: "sata",          label: "SATA",             icon: Wallet },
    { value: "msty",          label: "MSTY",             icon: BarChart3 },
    { value: "preferred",     label: "Other Preferreds", icon: Layers },
    { value: "table",         label: "Table",            icon: TableProperties },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        activeScenario={params.active_scenario}
        onScenarioChange={handleScenarioChange}
        onRefresh={handleRefreshLive}
        onExport={handleExport}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        refreshing={refreshing}
        liveData={liveData}
        hasPolygonKey={!!polygonKey}
      />

      <div className="flex">
        <ParameterPanel
          params={params}
          onParamsChange={setParams}
          preferreds={preferreds}
          onPreferredsChange={setPreferreds}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          polygonKey={polygonKey}
          onPolygonKeyChange={handlePolygonKeyChange}
        />

        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <main className="flex-1 min-w-0 p-4 lg:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-secondary mb-4 flex-wrap h-auto gap-0.5 p-1">
              {tabItems.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5"
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab params={params} preferreds={preferreds} projections={projections} />
            </TabsContent>
            <TabsContent value="strategy">
              <StrategyDashboardTab
                params={params}
                preferreds={preferreds}
                projections={projections}
                liveData={liveData}
                onRefresh={handleRefreshLive}
                refreshing={refreshing}
              />
            </TabsContent>
            <TabsContent value="btc">
              <BTCModelTab params={params} projections={projections} />
            </TabsContent>
            <TabsContent value="mstr">
              <MSTRModelTab params={params} preferreds={preferreds} projections={projections} />
            </TabsContent>
            <TabsContent value="msty">
              <MSTYModelTab
                params={params}
                projections={projections}
                liveData={liveData}
                onRefresh={handleRefreshLive}
                refreshing={refreshing}
              />
            </TabsContent>
            <TabsContent value="preferred">
              <PreferredTab params={params} preferreds={preferreds} projections={projections} />
            </TabsContent>
            <TabsContent value="correlations">
              <CorrelationsTab params={params} onParamsChange={setParams} />
            </TabsContent>
            <TabsContent value="strc">
              <STRCModelTab
                params={params}
                liveData={liveData}
                onRefresh={handleRefreshLive}
                refreshing={refreshing}
              />
            </TabsContent>
            <TabsContent value="asst">
              <ASSTModelTab
                params={params}
                liveData={liveData}
                onRefresh={handleRefreshLive}
                refreshing={refreshing}
              />
            </TabsContent>
            <TabsContent value="sata">
              <SATAModelTab
                params={params}
                liveData={liveData}
                onRefresh={handleRefreshLive}
                refreshing={refreshing}
              />
            </TabsContent>
            <TabsContent value="table">
              <ProjectionsTable projections={projections} params={params} />
            </TabsContent>
          </Tabs>

          <footer className="mt-8 pt-4 border-t border-border">
            <p className="text-[10px] text-muted-foreground/40 text-center">
              PunterJeff MSTR Projection Engine — Educational model inspired by @PunterJeff — Not financial advice.
              All projections are hypothetical. Past performance does not guarantee future results.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}