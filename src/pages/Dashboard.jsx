import React, { useState, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Bitcoin, TrendingUp, BarChart3, Layers, TableProperties } from "lucide-react";
import Navbar from "@/components/dashboard/Navbar";
import ParameterPanel from "@/components/dashboard/ParameterPanel";
import OverviewTab from "@/components/tabs/OverviewTab";
import BTCModelTab from "@/components/tabs/BTCModelTab";
import MSTRModelTab from "@/components/tabs/MSTRModelTab";
import MSTYModelTab from "@/components/tabs/MSTYModelTab";
import PreferredTab from "@/components/tabs/PreferredTab";
import ProjectionsTable from "@/components/tabs/ProjectionsTable";
import { DEFAULT_PARAMS, DEFAULT_PREFERREDS, DEFAULT_SCENARIOS, generateProjections } from "@/lib/calculations";
import { fetchAllMarketData, MSTY_DISTRIBUTION_HISTORY } from "@/lib/marketData";

export default function Dashboard() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [preferreds, setPreferreds] = useState(DEFAULT_PREFERREDS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [liveData, setLiveData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshLive = useCallback(async () => {
    setRefreshing(true);
    const data = await fetchAllMarketData();
    setLiveData(data);
    // Apply fetched values to params
    setParams((prev) => ({
      ...prev,
      ...(data.btc_price != null && { btc_price: Math.round(data.btc_price) }),
      ...(data.mstr_price != null && { mstr_price: Math.round(data.mstr_price) }),
      ...(data.msty_price != null && { msty_nav: parseFloat(data.msty_price.toFixed(2)) }),
    }));
    setRefreshing(false);
    return data;
  }, []);

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
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "btc", label: "BTC", icon: Bitcoin },
    { value: "mstr", label: "MSTR", icon: TrendingUp },
    { value: "msty", label: "MSTY", icon: BarChart3 },
    { value: "preferred", label: "Preferreds", icon: Layers },
    { value: "table", label: "Table", icon: TableProperties },
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
      />

      <div className="flex">
        <ParameterPanel
          params={params}
          onParamsChange={setParams}
          preferreds={preferreds}
          onPreferredsChange={setPreferreds}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
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
            <TabsContent value="btc">
              <BTCModelTab params={params} projections={projections} />
            </TabsContent>
            <TabsContent value="mstr">
              <MSTRModelTab params={params} preferreds={preferreds} projections={projections} />
            </TabsContent>
            <TabsContent value="msty">
              <MSTYModelTab params={params} projections={projections} liveData={liveData} onRefresh={handleRefreshLive} refreshing={refreshing} />
            </TabsContent>
            <TabsContent value="preferred">
              <PreferredTab params={params} preferreds={preferreds} projections={projections} />
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