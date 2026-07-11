import { useState, useEffect } from 'react';
import { fetchFleetReadiness, queryApmAgent } from './api';
import type { ReadinessResult } from './api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import MaintenanceDashboard from './MaintenanceDashboard';
import QualityDashboard from './QualityDashboard';
import NetZeroDashboard from './NetZeroDashboard';
import SupplyChainDashboard from './SupplyChainDashboard';

interface AgentResponse {
  agent_thought_process: string;
  results: any[];
}

// Fix Leaflet default marker icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type ActiveView = 'readiness' | 'apm' | 'maintenance' | 'supply_chain' | 'quality' | 'carbon';

export default function App() {
  const [data, setData] = useState<ReadinessResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [apmQuery, setApmQuery] = useState<string>("");
  const [apmLoading, setApmLoading] = useState<boolean>(false);
  const [agentData, setAgentData] = useState<AgentResponse | null>(null);
  const [scheduleData, setScheduleData] = useState<any[] | null>(null);
  const [mapData, setMapData] = useState<any[] | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('readiness');

  useEffect(() => {
    const loadData = async () => {
      const results = await fetchFleetReadiness();
      setData(results);
      setLoading(false);
    };

    loadData().catch((err) => console.error(err));
  }, []);

  const handleAgentQuery = async () => {
    if (!apmQuery.trim()) return;
    setApmLoading(true);
    try {
      const result = await queryApmAgent(apmQuery);
      setAgentData(result);

      // Route frontend display based on LLM tool choice
      if (result.results.length > 0 && result.results[0].task_id !== undefined) {
        setScheduleData(result.results);
        setMapData(null);
      } else if (result.results.length > 0 && result.results[0].latitude !== undefined) {
        setMapData(result.results);
        setScheduleData(null);
      } else {
        setScheduleData(null);
        setMapData(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setApmLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-xl text-gray-500">
        Loading Platform...
      </div>
    );
  }

  const NAV_ITEMS: { key: ActiveView; label: string; icon: string }[] = [
    { key: 'readiness', label: '1. Fleet Readiness', icon: '🔋' },
    { key: 'apm', label: '2. APM Agent', icon: '🤖' },
    { key: 'maintenance', label: '3. Maintenance', icon: '🔧' },
    { key: 'supply_chain', label: '4. Supply Chain', icon: '🌐' },
    { key: 'quality', label: '5. Quality (QMS)', icon: '📊' },
    { key: 'carbon', label: '6. Net Zero', icon: '🌱' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Platform Header */}
      <header className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold">EV Supply Chain & Asset Intelligence Platform</h1>
          <p className="text-blue-200 text-sm mt-1">Fleet APM + Manufacturing Supply Chain — End-to-End Intelligence</p>
        </div>
        {/* Navigation */}
        <nav className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto pb-0">
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${activeView === item.key
                    ? 'bg-gray-50 text-gray-900'
                    : 'text-blue-200 hover:text-white hover:bg-white/10'
                  }`}
              >
                <span className="mr-1.5">{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">

        {/* FEATURE 1: FLEET READINESS */}
        {activeView === 'readiness' && (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Fleet Electrification Readiness & Procurement Intelligence</h2>
            <p className="text-sm text-gray-500 mb-4">Weighted scoring engine ranking 100 ICE vehicles by EV conversion feasibility — route, payload, dwell-time, and charging infrastructure analysis.</p>

            {/* Fleet Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total Fleet</p>
                <p className="text-2xl font-bold text-gray-800">{data.length}</p>
              </div>
              <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Ready (Score &gt;70)</p>
                <p className="text-2xl font-bold text-green-700">{data.filter(d => d.readiness_score > 70).length}</p>
              </div>
              <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Marginal (40-70)</p>
                <p className="text-2xl font-bold text-yellow-600">{data.filter(d => d.readiness_score > 40 && d.readiness_score <= 70).length}</p>
              </div>
              <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Not Ready (&lt;40)</p>
                <p className="text-2xl font-bold text-red-600">{data.filter(d => d.readiness_score <= 40).length}</p>
              </div>
              <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Avg TCO Savings</p>
                <p className="text-2xl font-bold text-blue-700">{(data.reduce((a, b) => a + b.tco_savings_pct, 0) / data.length).toFixed(1)}%</p>
              </div>
              <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Avg Score</p>
                <p className="text-2xl font-bold text-indigo-700">{(data.reduce((a, b) => a + b.readiness_score, 0) / data.length).toFixed(1)}</p>
              </div>
            </div>

            <div className="overflow-x-auto shadow-md sm:rounded-lg">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-3">Rank</th>
                    <th className="px-3 py-3">Vehicle ID</th>
                    <th className="px-3 py-3">Readiness Score</th>
                    <th className="px-3 py-3">Range</th>
                    <th className="px-3 py-3">Charging</th>
                    <th className="px-3 py-3">Payload</th>
                    <th className="px-3 py-3">Infra</th>
                    <th className="px-3 py-3">TCO Savings</th>
                    <th className="px-3 py-3">Battery</th>
                    <th className="px-3 py-3">Chemistry</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, i) => (
                    <tr key={item.vehicle_id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-3 py-3">{i + 1}</td>
                      <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">{item.vehicle_id}</td>
                      <td className="px-3 py-3">
                        {item.readiness_score}
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                          <div
                            className={`h-2.5 rounded-full ${item.readiness_score > 70 ? "bg-green-500" : item.readiness_score > 40 ? "bg-yellow-500" : "bg-red-500"
                              }`}
                            style={{ width: `${item.readiness_score}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-3 py-3">{item.range_feasibility.toFixed(1)}</td>
                      <td className="px-3 py-3">{item.charging_opportunity.toFixed(1)}</td>
                      <td className="px-3 py-3">{item.payload_compatibility.toFixed(1)}</td>
                      <td className="px-3 py-3">{item.infra_proximity.toFixed(1)}</td>
                      <td className="px-3 py-3">
                        <span className="px-2 py-0.5 text-xs font-bold rounded bg-green-100 text-green-800">
                          {item.tco_savings_pct}%
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{item.recommended_battery_kwh} kWh</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded ${item.recommended_chemistry === 'LFP' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                          {item.recommended_chemistry}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FEATURE 2: APM AGENT UI */}
        {activeView === 'apm' && (
          <>
            <div className="p-6 bg-white shadow-md rounded-lg border border-gray-200">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">EV Asset Performance Management (APM) Agent</h2>
              <p className="text-sm text-gray-500 mb-4">AI-powered agent with tool-calling capabilities — queries fleet health, detects anomalies, schedules maintenance, traces supply chain, analyzes quality, and tracks carbon.</p>

              {/* Preset Query Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { label: 'Fleet Health', query: 'Show me the battery health of all vehicles' },
                  { label: 'Thermal Anomalies', query: 'Which vehicles have thermal anomalies?' },
                  { label: 'Maintenance Schedule', query: 'Generate the maintenance schedule' },
                  { label: 'Supply Chain Risk', query: 'Trace the battery supply chain and show risk scores' },
                  { label: 'Quality Report', query: 'Show manufacturing quality and drift alerts' },
                  { label: 'Carbon Emissions', query: 'What are our carbon emissions by scope?' },
                ].map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => { setApmQuery(preset.query); }}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full border border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-4 mb-6">
                <input
                  type="text"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder='Ask anything about fleet health, supply chain, quality, or carbon...'
                  value={apmQuery}
                  onChange={(e) => setApmQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAgentQuery()}
                />
                <button
                  onClick={handleAgentQuery}
                  disabled={apmLoading}
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {apmLoading ? "Thinking..." : "Run Query"}
                </button>
              </div>

              {agentData && (
                <div>
                  <div className="mb-4 p-4 bg-gray-50 border-l-4 border-blue-500 text-sm text-gray-700 italic">
                    <strong className="font-bold not-italic text-gray-900">Agent Thought Process:</strong> {agentData.agent_thought_process}
                  </div>

                  {/* Fleet Health / Anomalies table */}
                  {agentData.results.length > 0 && 'current_soh' in agentData.results[0] && (
                    <table className="w-full text-sm text-left text-gray-500">
                <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-3">Vehicle ID</th>
                    <th className="px-3 py-3">Chemistry</th>
                    <th className="px-3 py-3">SoH (%)</th>
                    <th className="px-3 py-3">RUL (Days)</th>
                    <th className="px-3 py-3">Capacity (Ah)</th>
                    <th className="px-3 py-3">IR (mΩ)</th>
                    <th className="px-3 py-3">Deg. Rate</th>
                    <th className="px-3 py-3">Risk</th>
                    <th className="px-3 py-3">Anomaly</th>
                  </tr>
                </thead>
                <tbody>
                  {agentData.results.map((item) => (
                    <tr key={item.vehicle_id} className="bg-white border-b">
                      <td className="px-3 py-3 font-medium text-gray-900">{item.vehicle_id}</td>
                      <td className="px-3 py-3 text-xs">{item.chemistry}</td>
                      <td className="px-3 py-3">{(item.current_soh as number).toFixed(1)}</td>
                      <td className="px-3 py-3">{item.predicted_rul_days}</td>
                      <td className="px-3 py-3">{item.capacity_ah}</td>
                      <td className="px-3 py-3">{item.internal_resistance_mohm}</td>
                      <td className="px-3 py-3 font-mono text-xs">{(item.degradation_rate_per_day as number).toFixed(4)}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded capitalize ${
                          item.risk_level === 'critical' ? 'bg-red-100 text-red-800' :
                          item.risk_level === 'high' ? 'bg-orange-100 text-orange-800' :
                          item.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>{item.risk_level}</span>
                      </td>
                      <td className="px-3 py-3">
                        {item.is_anomaly ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">FLAGGED</span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">NORMAL</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Maintenance schedule table (from agent) */}
                  {scheduleData && scheduleData.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-3">Optimized maintenance schedule — {scheduleData.length} tasks</p>
                      <table className="w-full text-sm text-left text-gray-500">
                        <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                          <tr>
                            <th className="px-3 py-2">Task ID</th>
                            <th className="px-3 py-2">Vehicle</th>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Priority</th>
                            <th className="px-3 py-2">Bay</th>
                            <th className="px-3 py-2">Technician</th>
                            <th className="px-3 py-2">Time</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scheduleData.map((task: any) => (
                            <tr key={task.task_id} className="bg-white border-b hover:bg-gray-50">
                              <td className="px-3 py-2 font-mono text-xs">{task.task_id}</td>
                              <td className="px-3 py-2 font-medium text-gray-900">{task.vehicle_id}</td>
                              <td className="px-3 py-2 text-xs">{task.task_type}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded capitalize ${task.priority === 'critical' ? 'bg-red-100 text-red-800' :
                                  task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                    task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-blue-100 text-blue-800'
                                  }`}>{task.priority}</span>
                              </td>
                              <td className="px-3 py-2 text-xs">{task.bay_name}</td>
                              <td className="px-3 py-2 text-xs">{task.technician_name}</td>
                              <td className="px-3 py-2 text-xs font-mono">{task.status === 'scheduled' ? `${task.start_hour}:00–${task.end_hour}:00` : '—'}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${task.status === 'scheduled' ? 'bg-green-100 text-green-800' :
                                  task.status === 'overflow' ? 'bg-red-100 text-red-800' :
                                    'bg-amber-100 text-amber-800'
                                  }`}>{task.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Supply chain table (from agent) */}
                  {mapData && mapData.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-3">Supply chain trace — {mapData.length} nodes</p>
                      <table className="w-full text-sm text-left text-gray-500">
                        <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                          <tr>
                            <th className="px-3 py-2">Entity</th>
                            <th className="px-3 py-2">Tier</th>
                            <th className="px-3 py-2">Material</th>
                            <th className="px-3 py-2">Country</th>
                            <th className="px-3 py-2">Risk Score</th>
                            <th className="px-3 py-2">Justification</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mapData.map((node: any, idx: number) => (
                            <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium text-gray-900">{node.entity_name}</td>
                              <td className="px-3 py-2">Tier {node.tier}</td>
                              <td className="px-3 py-2 text-xs">{node.material}</td>
                              <td className="px-3 py-2">{node.country}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${node.composite_risk > 6 ? 'bg-red-100 text-red-800' :
                                  node.composite_risk > 4 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                  }`}>{node.composite_risk}/10</span>
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-500 max-w-xs truncate">{node.risk_justification}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Quality Intelligence results (from agent) */}
                  {agentData.results && 'kpis' in agentData.results && (agentData.results as any).kpis?.overall_yield_pct !== undefined && (
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <h3 className="font-semibold text-purple-800 mb-2">Manufacturing Quality Intelligence</h3>
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div><p className="text-xs text-gray-500">Yield</p><p className="font-bold text-purple-700">{(agentData.results as any).kpis.overall_yield_pct}%</p></div>
                        <div><p className="text-xs text-gray-500">Cpk</p><p className="font-bold text-purple-700">{(agentData.results as any).kpis.process_capability_cpk}</p></div>
                        <div><p className="text-xs text-gray-500">Drift Alerts</p><p className="font-bold text-red-600">{(agentData.results as any).kpis.drift_alerts_active}</p></div>
                        <div><p className="text-xs text-gray-500">Defect PPM</p><p className="font-bold text-orange-600">{(agentData.results as any).kpis.defect_rate_ppm?.toFixed(0)}</p></div>
                      </div>
                      <p className="text-xs text-purple-600 mt-3">Switch to the "5. Quality (QMS)" tab for full SPC charts, inspections, and predictions.</p>
                    </div>
                  )}

                  {/* Carbon results (from agent) */}
                  {agentData.results && 'kpis' in agentData.results && (agentData.results as any).kpis?.total_emissions_tons_co2 !== undefined && (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <h3 className="font-semibold text-green-800 mb-2">Net Zero & Carbon Intelligence</h3>
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div><p className="text-xs text-gray-500">Total Emissions</p><p className="font-bold text-gray-800">{(agentData.results as any).kpis.total_emissions_tons_co2} t</p></div>
                        <div><p className="text-xs text-gray-500">Avoided</p><p className="font-bold text-green-700">{(agentData.results as any).kpis.avoided_emissions_tons} t</p></div>
                        <div><p className="text-xs text-gray-500">YoY Reduction</p><p className="font-bold text-green-700">↓{(agentData.results as any).kpis.yoy_reduction_pct}%</p></div>
                        <div><p className="text-xs text-gray-500">Intensity</p><p className="font-bold text-blue-700">{(agentData.results as any).kpis.carbon_intensity_g_per_km} g/km</p></div>
                      </div>
                      <p className="text-xs text-green-600 mt-3">Switch to the "6. Net Zero" tab for full scope breakdown, fleet comparison, and progress tracking.</p>
                    </div>
                  )}

                  {agentData.results.length === 0 && !scheduleData && !mapData && (
                    <p className="text-sm text-gray-500 italic">No results returned. Click a preset button above or type a question.</p>
                  )}
                </div>
              )}
            </div>

            {/* FEATURE 4: SUPPLY CHAIN RISK MAP */}
            {mapData && mapData.length > 0 && (
              <div className="mt-6 p-6 bg-white shadow-md rounded-lg border border-gray-200">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">Supply Chain Risk &amp; Traceability</h2>
                <p className="text-sm text-gray-500 mb-4">Geospatial mapping of Tier 1-3 suppliers with LIVE news-based risk scoring. Red markers indicate high composite risk.</p>

                <div className="mb-6 rounded overflow-hidden border border-gray-200" style={{ height: '450px', width: '100%' }}>
                  <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {mapData.map((node, idx) => (
                      <Marker key={idx} position={[node.latitude, node.longitude]}>
                        <Popup>
                          <div className="font-semibold">{node.entity_name}</div>
                          <div>Tier: {node.tier} | Material: {node.material}</div>
                          <div className="font-bold text-red-600">Live Risk: {node.composite_risk}/10</div>
                          <div className="text-xs mt-1 max-w-[200px] italic text-gray-700">{node.risk_justification}</div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>

                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="bg-gray-50 text-gray-700 uppercase">
                    <tr>
                      <th className="px-4 py-3">Entity</th>
                      <th className="px-4 py-3">Tier</th>
                      <th className="px-4 py-3">Material</th>
                      <th className="px-4 py-3">Country</th>
                      <th className="px-4 py-3">Composite Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapData.map((node, idx) => (
                      <tr key={idx} className="bg-white border-b">
                        <td className="px-4 py-3 font-medium text-gray-900">{node.entity_name}</td>
                        <td className="px-4 py-3">Tier {node.tier}</td>
                        <td className="px-4 py-3">{node.material}</td>
                        <td className="px-4 py-3">{node.country}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${node.composite_risk > 6 ? "bg-red-100 text-red-800" : node.composite_risk > 4 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"
                            }`}>
                            {node.composite_risk}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* FEATURE 3: MAINTENANCE OPERATIONS OPTIMISER */}
        {activeView === 'maintenance' && (
          <MaintenanceDashboard />
        )}

        {/* FEATURE 4: SUPPLY CHAIN RISK & TRACEABILITY */}
        {activeView === 'supply_chain' && (
          <SupplyChainDashboard />
        )}

        {/* FEATURE 5: MANUFACTURING QUALITY INTELLIGENCE */}
        {activeView === 'quality' && (
          <QualityDashboard />
        )}

        {/* FEATURE 6: NET ZERO & CARBON INTELLIGENCE */}
        {activeView === 'carbon' && (
          <NetZeroDashboard />
        )}

      </main>
    </div>
  );
}
