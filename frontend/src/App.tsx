import { useState, useEffect } from 'react';
import { fetchFleetReadiness } from './api';
import type { ReadinessResult } from './api';
import L from 'leaflet';
import ErrorBoundary from './components/ErrorBoundary';

import WorkOrdersView from './components/WorkOrdersView';
import PartsInventoryView from './components/PartsInventoryView';
import FleetReadinessView from './components/FleetReadinessView';
import IntelligenceView from './components/IntelligenceView';
import BusinessAnalyticsView from './components/BusinessAnalyticsView';
import LiveAlerts from './components/LiveAlerts';
import MaintenanceDashboard from './MaintenanceDashboard';
import QualityDashboard from './QualityDashboard';
import NetZeroDashboard from './NetZeroDashboard';
import SupplyChainDashboard from './SupplyChainDashboard';
import DepotSelector from './components/DepotSelector';
import FleetComparisonDashboard from './components/FleetComparisonDashboard';
import ExecutiveDashboard from './ExecutiveDashboard';
import Login from './Login';
import { useAuth } from './AuthContext';
import { LogOut, User as UserIcon, ChevronDown, Menu } from 'lucide-react';
import * as Icons from 'lucide-react';

// Fix Leaflet default marker icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function App() {
  const { user, roleView, logout, switchRole, isLoading } = useAuth();
  const [data, setData] = useState<ReadinessResult[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDepotId, setSelectedDepotId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Sync Path
  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Enforce access control
  useEffect(() => {
    if (user && roleView) {
      const allowedPaths = roleView.navItems.map(item => item.path);
      // Let it pass if it's an exact match or a sub-path
      const isAllowed = allowedPaths.some(p => currentPath === p || currentPath.startsWith(p + '/'));
      
      if (!isAllowed && currentPath !== '/login') {
        navigate(roleView.defaultRoute);
      }
    } else if (!user && !isLoading && currentPath !== '/login') {
      navigate('/login');
    }
  }, [user, roleView, currentPath, isLoading]);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      setLoadingData(true);
      try {
        const results = await fetchFleetReadiness(selectedDepotId);
        setData(results);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Failed to connect to the backend.");
      }
      setLoadingData(false);
    };

    loadData();
  }, [selectedDepotId, user]);

  if (isLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>;
  }

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-red-100 max-w-md">
            <p className="text-red-500 mb-4 font-medium">{error}</p>
            <button
              onClick={() => { setError(null); setLoadingData(true); window.location.reload(); }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
            >
              Retry Connection
            </button>
          </div>
        </div>
      );
    }

    if (loadingData) {
      return (
        <div className="flex h-[50vh] items-center justify-center">
           <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    if (currentPath === '/executive') return <ErrorBoundary><ExecutiveDashboard /></ErrorBoundary>;
    if (currentPath === '/procurement') return <ErrorBoundary><FleetReadinessView data={data} /></ErrorBoundary>;
    if (currentPath === '/supply-chain') return <ErrorBoundary><SupplyChainDashboard selectedDepotId={selectedDepotId} /></ErrorBoundary>;
    if (currentPath === '/quality') return <ErrorBoundary><QualityDashboard selectedDepotId={selectedDepotId} /></ErrorBoundary>;
    if (currentPath === '/carbon') return <ErrorBoundary><NetZeroDashboard selectedDepotId={selectedDepotId} /></ErrorBoundary>;
    if (currentPath.startsWith('/maintenance')) {
      if (currentPath === '/maintenance/orders') return <ErrorBoundary><WorkOrdersView selectedDepotId={selectedDepotId} /></ErrorBoundary>;
      if (currentPath === '/maintenance/parts') return <ErrorBoundary><PartsInventoryView /></ErrorBoundary>;
      return <ErrorBoundary><MaintenanceDashboard selectedDepotId={selectedDepotId} /></ErrorBoundary>;
    }
    if (currentPath.startsWith('/fleet')) {
      return selectedDepotId === null ? 
        <ErrorBoundary><FleetComparisonDashboard /></ErrorBoundary> :
        <ErrorBoundary><FleetReadinessView data={data} /></ErrorBoundary>;
    }
    if (currentPath === '/commodity') return <ErrorBoundary><IntelligenceView /></ErrorBoundary>;
    if (currentPath === '/analytics') return <ErrorBoundary><BusinessAnalyticsView /></ErrorBoundary>;

    // Default fallback
    return <div className="p-8 text-center text-gray-500">Page under construction</div>;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-40 shrink-0
        fixed inset-y-0 left-0 transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0 md:flex
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <div className="flex items-center gap-3 text-white mb-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="font-bold">ET</span>
            </div>
            <h1 className="font-bold text-lg tracking-tight">EV Intelligence</h1>
          </div>
          <p className="text-xs text-slate-500">Fleet & Supply Chain</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto mt-4">
          {roleView?.navItems.map((item) => {
            const Icon = (Icons as any)[item.icon] || Icons.Circle;
            const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path + '/'));
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium
                  ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-800">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-gray-500 hover:text-gray-900" onClick={() => setMobileSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <DepotSelector selectedDepotId={selectedDepotId} onSelectDepot={setSelectedDepotId} />
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full transition-colors border border-blue-200"
              >
                <UserIcon className="w-4 h-4" />
                <span className="text-sm font-medium capitalize">{user.role} Team</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              
              {showRoleMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                  <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Demo Only (Switch Role)</p>
                  </div>
                  {['procurement', 'maintenance', 'executive', 'admin'].map(r => (
                    <button
                      key={r}
                      onClick={() => {
                        setShowRoleMenu(false);
                        switchRole(r);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm capitalize hover:bg-gray-50 transition-colors
                        ${user.role === r ? 'text-blue-600 font-medium bg-blue-50/50' : 'text-gray-700'}`}
                    >
                      {r} View
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {renderContent()}
        </main>
      </div>
      <LiveAlerts />
    </div>
  );
}
