import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard, Bitcoin, TrendingUp, BarChart3, Layers,
  GitBranch, Building2, Wallet, LineChart, Target
} from "lucide-react";
import Navbar from "@/components/dashboard/Navbar";
import OverviewTab from "@/components/tabs/OverviewTab";
import BTCModelsTab from "@/components/tabs/BTCModelsTab";
import MSTRvsASSTTab from "@/components/tabs/MSTRvsASSTTab";
import MSTYModelTab from "@/components/tabs/MSTYModelTab";
import OtherPreferredsTab from "@/components/tabs/OtherPreferredsTab";
import CorrelationsTab from "@/components/tabs/CorrelationsTab";
import StrategyDashboardTab from "@/components/tabs/StrategyDashboardTab";
import STRCvsSATATab from "@/components/tabs/STRCvsSATATab";
import ProjectionsPage from "@/components/tabs/ProjectionsPage";
import { DEFAULT_PARAMS, DEFAULT_PREFERREDS, DEFAULT_SCENARIOS, generateProjections } from "@/lib/calculations";
import { fetchAllMarketData } from "@/lib/marketData";
import { toast } from "sonner";

const AUTO_REFRESH_INTERVAL = 60000; // 60 seconds

export default function Dashboard() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [preferreds] = useState(DEFAULT_PREFERREDS);
  const [activeTab, setActiveTab] = useState("overview");
  const [liveData, setLiveData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefreshLive = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchAllMarketData();
      setLiveData(data);

      // Update params with live prices
      setParams((prev) => ({
        ...prev,
        ...(data.btc_price != null && { btc_price: Math.round(data.btc_price) }),
        ...(data.btc_holdings != null && { mstr_btc_holdings: data.btc_holdings }),
        ...(data.mstr_price != null && { mstr_price: parseFloat(data.mstr_price.toFixed(2)) }),
        ...(data.msty_price != null && { msty_nav: parseFloat(data.msty_price.toFixed(2)) }),
        ...(data.mstr_iv != null && { mstr_iv: data.mstr_iv }),
      }));

      const parts = [];
      if (data.btc_price) parts.push(`BTC $${data.btc_price.toLocaleString()}`);
      if (data.mstr_price) parts.push(`MSTR $${data.mstr_price.toFixed(2)}`);
      if (data.msty_price) parts.push(`MSTY $${data.msty_price.toFixed(2)}`);

      const hasErrors = data.errors?.length > 0;
      if (hasErrors) {
        toast.warning(`Partial data — ${parts.join(" · ")}`, { duration: 4000 });
      } else {
        toast.success(`Live data synced — ${parts.join(" · ")}`, { duration: 3000 });
      }

      return data;
    } catch (e) {
      console.error("Refresh failed", e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    // Initial load
    handleRefreshLive();
    const interval = setInterval(handleRefreshLive, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [handleRefreshLive]);

  const projections = useMemo(() => {
    return generateProjections(params, preferreds, params.projection_years * 4);
  }, [params, preferreds]);

  const tabItems = [
    { value: "overview",      label: "Overview",        icon: LayoutDashboard },
    { value: "correlations",  label: "Correlations",    icon: GitBranch },
    { value: "strategy",      label: "Strategy",        icon: Building2 },
    { value: "btc",           label: "BTC Models",      icon: Bitcoin },
    { value: "mstr-asst",     label: "MSTR vs ASST",    icon: TrendingUp },
    { value: "strc-sata",     label: "STRC vs SATA",    icon: Layers },
    { value: "preferred",     label: "Other Preferreds",icon: Wallet },
    { value: "msty",          label: "MSTY",            icon: BarChart3 },
    { value: "projections",   label: "Projections",     icon: LineChart },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        activeScenario={params.active_scenario}
        onScenarioChange={() => {}}
        onRefresh={handleRefreshLive}
        onExport={() => {}}
        onToggleSidebar={() => {}}
        refreshing={refreshing}
        liveData={liveData}
        hasPolygonKey={true}
        params={params}
      />

      <main className="p-4 lg:p-6">
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
            <OverviewTab
              params={params}
              preferreds={preferreds}
              projections={projections}
              liveData={liveData}
              onRefresh={handleRefreshLive}
              refreshing={refreshing}
            />
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
            <BTCModelsTab params={params} liveData={liveData} />
          </TabsContent>

          <TabsContent value="mstr-asst">
            <MSTRvsASSTTab
              params={params}
              liveData={liveData}
              onRefresh={handleRefreshLive}
              refreshing={refreshing}
            />
          </TabsContent>

          <TabsContent value="strc-sata">
            <STRCvsSATATab
              params={params}
              liveData={liveData}
              onRefresh={handleRefreshLive}
              refreshing={refreshing}
            />
          </TabsContent>

          <TabsContent value="preferred">
            <OtherPreferredsTab liveData={liveData} />
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

          <TabsContent value="correlations">
            <CorrelationsTab params={params} liveData={liveData} />
          </TabsContent>

          <TabsContent value="projections">
            <ProjectionsPage liveData={liveData} />
          </TabsContent>
        </Tabs>

        <footer className="mt-8 pt-4 border-t border-border">
          <p className="text-[10px] text-muted-foreground/40 text-center">
            PunterJeff MSTR Projection Engine — Educational model inspired by @PunterJeff — Not financial advice.
            All projections are hypothetical. Past performance does not guarantee future results.
            Live data refreshes every 60 seconds via Polygon.io + CoinGecko.
          </p>
        </footer>
      </main>
    </div>
  );
}