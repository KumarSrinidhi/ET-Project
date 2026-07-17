import { useState, useEffect } from 'react';
import { fetchFleetReadiness, queryApmAgent } from './api';
import type { ReadinessResult } from './api';
import L from 'leaflet';
import ErrorBoundary from './components/ErrorBoundary';
import ApmAgentView from './components/ApmAgentView';
import FleetReadinessView from './components/FleetReadinessView';
import IntelligenceView from './components/IntelligenceView';
import MaintenanceDashboard from './MaintenanceDashboard';
import QualityDashboard from './QualityDashboard';
import NetZeroDashboard from './NetZeroDashboard';
import SupplyChainDashboard from './SupplyChainDashboard';
import DepotSelector from './components/DepotSelector';
import FleetComparisonDashboard from './components/FleetComparisonDashboard';

// Fix Leaflet default marker icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type ActiveView = 'readiness' | 'apm' | 'maintenance' | 'supply_chain' | 'quality' | 'carbon' | 'intelligence';

export default function App() {
  const [data, setData] = useState<ReadinessResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('readiness');
  const [selectedDepotId, setSelectedDepotId] = useState<string | null>(null);

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/fleet/')) {
        const parts = hash.split('/');
        if (parts[2]) {
          setSelectedDepotId(parts[2]);
        }
      } else {
        setSelectedDepotId(null);
      }
    };
    window.addEventListener('hashchange', syncHash);
    syncHash(); // Initial load
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const handleSelectDepot = (depotId: string | null) => {
    setSelectedDepotId(depotId);
    if (depotId) {
      window.location.hash = `#/fleet/${depotId}`;
    } else {
      window.location.hash = '';
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const results = await fetchFleetReadiness(selectedDepotId);
      setData(results);
      setLoading(false);
    };

    loadData().catch((err) => {
      console.error(err);
      setError("Failed to connect to the backend. It may be starting up.");
      setLoading(false);
    });
  }, [selectedDepotId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Connecting to platform...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center p-8 bg-slate-900 rounded-2xl shadow-xl max-w-md">
          <p className="text-red-400 mb-4 font-medium">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); window.location.reload(); }}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const NAV_ITEMS: { key: ActiveView; label: string }[] = [
    { key: 'readiness', label: '1. Fleet Readiness' },
    { key: 'apm', label: '2. APM' },
    { key: 'maintenance', label: '3. Maintenance' },
    { key: 'supply_chain', label: '4. Supply Chain' },
    { key: 'quality', label: '5. Quality' },
    { key: 'carbon', label: '6. Net Zero' },
    { key: 'intelligence', label: '7. Intelligence' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Platform Header */}
      <header className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-lg relative z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">EV Supply Chain & Asset Intelligence Platform</h1>
            <p className="text-blue-200 text-sm mt-1">Fleet APM | Manufacturing Supply Chain | End-to-End Operations</p>
          </div>
          <DepotSelector selectedDepotId={selectedDepotId} onSelectDepot={handleSelectDepot} />
        </div>
        {/* Navigation */}
        <nav className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto pb-0" role="tablist" aria-label="Feature Navigation">
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                role="tab"
                aria-selected={activeView === item.key}
                onClick={() => setActiveView(item.key)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${activeView === item.key
                    ? 'bg-gray-50 text-gray-900'
                    : 'text-blue-200 hover:text-white hover:bg-white/10'
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">

        {selectedDepotId === null ? (
          <ErrorBoundary>
            <FleetComparisonDashboard />
          </ErrorBoundary>
        ) : (
          <>
            {/* FEATURE 1: FLEET READINESS */}
            {activeView === 'readiness' && (
              <ErrorBoundary>
                <FleetReadinessView data={data} />
              </ErrorBoundary>
            )}

            {/* FEATURE 2: APM AGENT */}
            {activeView === 'apm' && (
              <ErrorBoundary>
                <ApmAgentView queryApmAgent={queryApmAgent} />
              </ErrorBoundary>
            )}

            {/* FEATURE 3: MAINTENANCE OPERATIONS OPTIMISER */}
            {activeView === 'maintenance' && (
              <ErrorBoundary>
                <MaintenanceDashboard selectedDepotId={selectedDepotId} />
              </ErrorBoundary>
            )}

            {/* FEATURE 4: SUPPLY CHAIN RISK & TRACEABILITY */}
            {activeView === 'supply_chain' && (
              <ErrorBoundary>
                <SupplyChainDashboard selectedDepotId={selectedDepotId} />
              </ErrorBoundary>
            )}

            {/* FEATURE 5: MANUFACTURING QUALITY */}
            {activeView === 'quality' && (
              <ErrorBoundary>
                <QualityDashboard selectedDepotId={selectedDepotId} />
              </ErrorBoundary>
            )}

            {/* FEATURE 6: NET ZERO & CARBON */}
            {activeView === 'carbon' && (
              <ErrorBoundary>
                <NetZeroDashboard selectedDepotId={selectedDepotId} />
              </ErrorBoundary>
            )}

            {/* FEATURE 7: INTELLIGENCE (Commodity, SHAP, Forecast, Simulator, Operations) */}
            {activeView === 'intelligence' && (
              <ErrorBoundary>
                <IntelligenceView />
              </ErrorBoundary>
            )}
          </>
        )}

      </main>
    </div>
  );
}
