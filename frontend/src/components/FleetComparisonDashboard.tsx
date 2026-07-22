import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell 
} from 'recharts';
import { MapContainer, TileLayer, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Building2, Battery, AlertTriangle, Activity, Table as TableIcon, Map as MapIcon, ArrowUpDown } from 'lucide-react';
import { fetchDepotComparison, fetchDepotsHeatmap } from '../api';
import type { DepotComparisonData } from '../api';

export default function FleetComparisonDashboard() {
  const [depots, setDepots] = useState<DepotComparisonData[]>([]);
  const [, setHeatmapData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    Promise.all([
      fetchDepotComparison(),
      fetchDepotsHeatmap()
    ]).then(([compData, heatData]) => {
      setDepots(compData?.depots || []);
      setHeatmapData(heatData?.matrix || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const kpis = useMemo(() => {
    if (!depots.length) return null;
    const totalVehicles = depots.reduce((acc, d) => acc + d.vehicle_count, 0);
    const avgSoh = depots.reduce((acc, d) => acc + d.metrics.avg_soh, 0) / depots.length;
    const avgAvail = depots.reduce((acc, d) => acc + d.metrics.availability, 0) / depots.length;
    const depotsWithAlerts = depots.filter(d => d.metrics.avg_soh < 85 || d.metrics.rul < 120).length;
    return {
      totalDepots: depots.length,
      totalVehicles,
      avgSoh: avgSoh.toFixed(1),
      avgAvail: avgAvail.toFixed(1),
      depotsWithAlerts
    };
  }, [depots]);

  const sortedDepots = useMemo(() => {
    let sortable = [...depots];
    if (sortConfig !== null) {
      sortable.sort((a, b) => {
        let aValue, bValue;
        if (sortConfig.key.includes('.')) {
          const keys = sortConfig.key.split('.');
          aValue = (a as any)[keys[0]][keys[1]];
          bValue = (b as any)[keys[0]][keys[1]];
        } else {
          aValue = (a as any)[sortConfig.key];
          bValue = (b as any)[sortConfig.key];
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [depots, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSohColor = (soh: number) => soh >= 90 ? '#22c55e' : soh >= 85 ? '#eab308' : '#ef4444';
  
  // Format heatmap data for rendering
  // const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  
  if (loading) {
    return <div className="p-8 text-center text-ink-faint">Loading comparison data...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-canvas p-4 rounded-xl border border-hairline shadow-sm">
          <div className="flex items-center gap-2 text-ink-faint mb-2">
            <Building2 size={18} />
            <span className="text-sm font-medium">Total Depots</span>
          </div>
          <div className="text-2xl font-bold text-ink">{kpis?.totalDepots}</div>
        </div>
        <div className="bg-canvas p-4 rounded-xl border border-hairline shadow-sm">
          <div className="flex items-center gap-2 text-ink-faint mb-2">
            <Battery size={18} />
            <span className="text-sm font-medium">Total Vehicles</span>
          </div>
          <div className="text-2xl font-bold text-ink">{kpis?.totalVehicles}</div>
        </div>
        <div className="bg-canvas p-4 rounded-xl border border-hairline shadow-sm">
          <div className="flex items-center gap-2 text-ink-faint mb-2">
            <Activity size={18} />
            <span className="text-sm font-medium">Avg Fleet SoH</span>
          </div>
          <div className="text-2xl font-bold text-ink">{kpis?.avgSoh}%</div>
        </div>
        <div className="bg-canvas p-4 rounded-xl border border-hairline shadow-sm">
          <div className="flex items-center gap-2 text-ink-faint mb-2">
            <Activity size={18} />
            <span className="text-sm font-medium">Fleet Availability</span>
          </div>
          <div className="text-2xl font-bold text-ink">{kpis?.avgAvail}%</div>
        </div>
        <div className="bg-canvas p-4 rounded-xl border border-status-critical-border shadow-sm bg-status-critical-bg">
          <div className="flex items-center gap-2 text-status-critical-fg mb-2">
            <AlertTriangle size={18} />
            <span className="text-sm font-medium">Depots w/ Alerts</span>
          </div>
          <div className="text-2xl font-bold text-status-critical-fg">{kpis?.depotsWithAlerts}</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-ink">Depot Performance Matrix</h2>
        <div className="flex bg-canvas-sunken p-1 rounded-lg border border-hairline">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'table' ? 'bg-canvas text-ink shadow-sm' : 'text-ink-faint text-ink-muted'}`}
          >
            <TableIcon size={16} /> Table
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'map' ? 'bg-canvas text-ink shadow-sm' : 'text-ink-faint text-ink-muted'}`}
          >
            <MapIcon size={16} /> Map
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-canvas border border-hairline rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas border-b border-hairline text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium cursor-pointer bg-canvas-sunken" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">Depot <ArrowUpDown size={14}/></div>
                  </th>
                  <th className="px-4 py-3 font-medium cursor-pointer bg-canvas-sunken" onClick={() => handleSort('region')}>
                    <div className="flex items-center gap-1">Region <ArrowUpDown size={14}/></div>
                  </th>
                  <th className="px-4 py-3 font-medium cursor-pointer bg-canvas-sunken" onClick={() => handleSort('vehicle_count')}>
                    <div className="flex items-center gap-1">Vehicles <ArrowUpDown size={14}/></div>
                  </th>
                  <th className="px-4 py-3 font-medium cursor-pointer bg-canvas-sunken" onClick={() => handleSort('metrics.avg_soh')}>
                    <div className="flex items-center gap-1">Avg SoH <ArrowUpDown size={14}/></div>
                  </th>
                  <th className="px-4 py-3 font-medium cursor-pointer bg-canvas-sunken" onClick={() => handleSort('metrics.availability')}>
                    <div className="flex items-center gap-1">Availability <ArrowUpDown size={14}/></div>
                  </th>
                  <th className="px-4 py-3 font-medium cursor-pointer bg-canvas-sunken" onClick={() => handleSort('metrics.rul')}>
                    <div className="flex items-center gap-1">Avg RUL (Days) <ArrowUpDown size={14}/></div>
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedDepots.map(depot => (
                  <tr key={depot.id} className="bg-canvas cursor-pointer transition-colors" onClick={() => window.location.hash = `#/fleet/${depot.id}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{depot.name}</div>
                      <div className="text-xs text-ink-faint font-mono">{depot.code}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{depot.region}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-canvas-sunken text-ink-muted rounded-full text-xs font-medium">{depot.vehicle_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${depot.metrics.avg_soh < 85 ? 'text-status-critical-fg' : 'text-ink-muted'}`}>
                        {depot.metrics.avg_soh.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {depot.metrics.availability}%
                    </td>
                    <td className="px-4 py-3">
                      {depot.metrics.rul}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(depot.metrics.avg_soh < 85 || depot.metrics.rul < 120) ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-status-critical-bg text-status-critical-fg rounded-full text-xs font-medium">
                          <AlertTriangle size={12} /> Needs Attention
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 bg-status-ok-bg text-status-ok-fg rounded-full text-xs font-medium">
                          Optimal
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="h-[500px] rounded-xl overflow-hidden shadow-sm border border-hairline">
          <MapContainer center={[21.0, 78.0]} zoom={4.5} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            {depots.map(depot => (
              <CircleMarker
                key={depot.id}
                center={[depot.lat, depot.lng]}
                radius={Math.max(6, Math.min(20, depot.vehicle_count * 0.5))}
                pathOptions={{ 
                  fillColor: getSohColor(depot.metrics.avg_soh),
                  color: 'white',
                  weight: 2,
                  fillOpacity: 0.8
                }}
              >
                <Popup>
                  <div className="font-medium">{depot.name}</div>
                  <div className="text-xs text-ink-faint mb-2">{depot.vehicle_count} Vehicles</div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                    <div>SoH: <strong>{depot.metrics.avg_soh}%</strong></div>
                    <div>Avail: <strong>{depot.metrics.availability}%</strong></div>
                  </div>
                  <button 
                    onClick={() => window.location.hash = `#/fleet/${depot.id}`}
                    className="w-full mt-1 bg-voltage-500 text-on-accent px-2 py-1 rounded text-xs bg-voltage-600"
                  >
                    View Details
                  </button>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SoH by Depot */}
        <div className="bg-canvas p-5 rounded-xl border border-hairline shadow-sm">
          <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wider">Avg SoH by Depot</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...depots].sort((a,b) => a.metrics.avg_soh - b.metrics.avg_soh)} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[70, 100]} />
                <YAxis dataKey="code" type="category" width={80} style={{ fontSize: '11px' }} />
                <RechartsTooltip formatter={(val: any) => [`${val}%`, 'SoH']} />
                <Bar dataKey="metrics.avg_soh" radius={[0, 4, 4, 0]}>
                  {[...depots].sort((a,b) => a.metrics.avg_soh - b.metrics.avg_soh).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getSohColor(entry.metrics.avg_soh)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SoH vs Availability Scatter */}
        <div className="bg-canvas p-5 rounded-xl border border-hairline shadow-sm">
          <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wider">Risk Matrix (SoH vs Availability)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="metrics.avg_soh" name="SoH" unit="%" domain={[70, 100]} />
                <YAxis type="number" dataKey="metrics.availability" name="Availability" unit="%" domain={[60, 100]} />
                <ZAxis type="number" dataKey="vehicle_count" range={[50, 400]} name="Vehicles" />
                <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={depots} fill="#3b82f6" fillOpacity={0.6}>
                  {depots.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getSohColor(entry.metrics.avg_soh)} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
