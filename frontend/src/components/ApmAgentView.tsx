import { useState } from 'react';
import { queryApmAgent } from '../api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

interface ApmAgentViewProps {
  queryApmAgent: typeof queryApmAgent;
}

interface AgentResponse {
  agent_thought_process: string;
  routing_confidence?: number;
  results: any[];
}

export default function ApmAgentView({ queryApmAgent }: ApmAgentViewProps) {
  const [apmQuery, setApmQuery] = useState<string>("");
  const [apmLoading, setApmLoading] = useState<boolean>(false);
  const [agentData, setAgentData] = useState<AgentResponse | null>(null);
  const [scheduleData, setScheduleData] = useState<any[] | null>(null);
  const [mapData, setMapData] = useState<any[] | null>(null);

  const handleAgentQuery = async () => {
    if (!apmQuery.trim()) return;
    setApmLoading(true);
    try {
      const result = await queryApmAgent(apmQuery);
      setAgentData(result);

      // Route display based on result shape
      const r = result.results as any;
      if (Array.isArray(r) && r.length > 0 && r[0].task_id !== undefined) {
        setScheduleData(r);
        setMapData(null);
      } else if (r && Array.isArray(r.nodes)) {
        // Supply chain tool returns { nodes, citations, total_articles_analyzed }
        setMapData(r.nodes);
        setScheduleData(null);
      } else if (Array.isArray(r) && r.length > 0 && r[0].latitude !== undefined) {
        setMapData(r);
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

  return (
    <>
      <div className="p-6 bg-canvas shadow-md rounded-lg border border-hairline">
        <h2 className="text-2xl font-bold mb-4 text-ink">EV Asset Performance Management (APM)</h2>
        <p className="text-sm text-ink-muted mb-4">Search fleet health, detect anomalies, schedule maintenance, trace supply chains, analyze quality, and track carbon.</p>

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
              className="px-3 py-1.5 text-xs font-medium bg-canvas-sunken text-ink rounded-full border border-hairline bg-voltage-50 border-voltage-200 text-voltage-700 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex gap-4 mb-6">
          <input
            type="text"
            className="flex-1 text-base sm:text-sm px-4 py-2 border border-hairline-strong rounded-md focus:outline-none focus:ring-2 focus:ring-voltage-500"
            placeholder="Search fleet data, supply chain, or maintenance..."
            value={apmQuery}
            onChange={(e) => setApmQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAgentQuery()}
          />
          <button
            onClick={handleAgentQuery}
            disabled={apmLoading}
            className="px-6 py-2 bg-voltage-500 text-on-accent font-medium rounded-md bg-voltage-600 disabled:bg-gray-400"
          >
            {apmLoading ? "Searching..." : "Search"}
          </button>
        </div>

        {agentData && (
          <div>
            <div className="mb-4 p-4 bg-canvas border-l-4 border-voltage-500 text-sm text-ink italic flex items-center justify-between gap-3">
              <strong className="font-bold not-italic text-ink">{agentData.agent_thought_process}</strong>
              {typeof agentData.routing_confidence === 'number' && (
                <span className={`flex-shrink-0 text-[11px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${
                  agentData.routing_confidence < 0.6
                    ? 'bg-status-critical-bg text-status-critical-fg'
                    : agentData.routing_confidence < 0.8
                    ? 'bg-canvas-sunken text-ink'
                    : 'bg-graphite-900 text-white'
                }`}>
                  Routing {Math.round(agentData.routing_confidence * 100)}%
                </span>
              )}
            </div>

            {typeof agentData.routing_confidence === 'number' && agentData.routing_confidence < 0.6 && (
              <div className="mb-4 p-4 bg-status-critical-bg border border-status-critical-border rounded-lg">
                <p className="text-sm font-medium text-red-900">Low routing confidence</p>
                <p className="text-xs text-status-critical-fg mt-1 leading-relaxed">
                  I am not certain which tool best matches your request. Try one of these instead:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { label: 'Show fleet health',           query: 'Show me the battery health of all vehicles' },
                    { label: 'Check thermal anomalies',     query: 'Which vehicles have thermal anomalies?' },
                    { label: 'Get maintenance schedule',    query: 'Generate the maintenance schedule' },
                    { label: 'Trace supply chain',          query: 'Trace the battery supply chain and show risk scores' },
                    { label: 'Manufacturing quality',       query: 'Show manufacturing quality and drift alerts' },
                    { label: 'Carbon emissions report',     query: 'What are our carbon emissions by scope?' },
                  ].map(p => (
                    <button
                      key={p.label}
                      onClick={() => setApmQuery(p.query)}
                      className="px-3 py-1.5 text-xs font-medium bg-canvas text-status-critical-fg rounded-full border border-status-critical-border bg-status-critical-bg transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fleet Health / Anomalies table */}
            {agentData.results.length > 0 && 'current_soh' in agentData.results[0] && (
              <table className="w-full text-sm text-left text-ink-muted">
                <thead className="bg-canvas text-ink uppercase text-xs">
                  <tr>
                    <th className="px-3 py-3">Vehicle ID</th>
                    <th className="px-3 py-3">Chemistry</th>
                    <th className="px-3 py-3">SoH (%)</th>
                    <th className="px-3 py-3">RUL (Days)</th>
                    <th className="px-3 py-3">Capacity (Ah)</th>
                    <th className="px-3 py-3">IR (mOhm)</th>
                    <th className="px-3 py-3">Deg. Rate</th>
                    <th className="px-3 py-3">Risk</th>
                    <th className="px-3 py-3">Anomaly</th>
                  </tr>
                </thead>
                <tbody>
                  {agentData.results.map((item) => (
                    <tr key={item.vehicle_id} className="bg-canvas border-b">
                      <td className="px-3 py-3 font-medium text-ink">{item.vehicle_id}</td>
                      <td className="px-3 py-3 text-xs">{item.chemistry}</td>
                      <td className="px-3 py-3">{(item.current_soh as number).toFixed(1)}</td>
                      <td className="px-3 py-3">{item.predicted_rul_days}</td>
                      <td className="px-3 py-3">{item.capacity_ah}</td>
                      <td className="px-3 py-3">{item.internal_resistance_mohm}</td>
                      <td className="px-3 py-3 font-mono text-xs">{(item.degradation_rate_per_day as number).toFixed(4)}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded capitalize ${
                          item.risk_level === 'critical' ? 'bg-status-critical-bg text-status-critical-fg' :
                          item.risk_level === 'high' ? 'bg-status-warning-bg text-orange-800' :
                          item.risk_level === 'medium' ? 'bg-status-warning-bg text-yellow-800' :
                          'bg-status-ok-bg text-status-ok-fg'
                        }`}>{item.risk_level}</span>
                      </td>
                      <td className="px-3 py-3">
                        {item.is_anomaly ? (
                          <span className="px-2 py-1 bg-status-critical-bg text-status-critical-fg text-xs font-medium rounded">FLAGGED</span>
                        ) : (
                          <span className="px-2 py-1 bg-status-ok-bg text-status-ok-fg text-xs font-medium rounded">NORMAL</span>
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
                <p className="text-sm text-ink-muted mb-3">Optimized maintenance schedule -- {scheduleData.length} tasks</p>
                <table className="w-full text-sm text-left text-ink-muted">
                  <thead className="bg-canvas text-ink uppercase text-xs">
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
                      <tr key={task.task_id} className="bg-canvas border-b bg-canvas">
                        <td className="px-3 py-2 font-mono text-xs">{task.task_id}</td>
                        <td className="px-3 py-2 font-medium text-ink">{task.vehicle_id}</td>
                        <td className="px-3 py-2 text-xs">{task.task_type}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded capitalize ${task.priority === 'critical' ? 'bg-status-critical-bg text-status-critical-fg' :
                            task.priority === 'high' ? 'bg-status-warning-bg text-orange-800' :
                              task.priority === 'medium' ? 'bg-status-warning-bg text-yellow-800' :
                                'bg-voltage-50 text-voltage-700'
                            }`}>{task.priority}</span>
                        </td>
                        <td className="px-3 py-2 text-xs">{task.bay_name}</td>
                        <td className="px-3 py-2 text-xs">{task.technician_name}</td>
                        <td className="px-3 py-2 text-xs font-mono">{task.status === 'scheduled' ? `${task.start_hour}:00-${task.end_hour}:00` : '--'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${task.status === 'scheduled' ? 'bg-status-ok-bg text-status-ok-fg' :
                            task.status === 'overflow' ? 'bg-status-critical-bg text-status-critical-fg' :
                              'bg-status-warning-bg text-status-warning-fg'
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
                <p className="text-sm text-ink-muted mb-3">Supply chain trace -- {mapData.length} nodes</p>
                <table className="w-full text-sm text-left text-ink-muted">
                  <thead className="bg-canvas text-ink uppercase text-xs">
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
                      <tr key={idx} className="bg-canvas border-b bg-canvas">
                        <td className="px-3 py-2 font-medium text-ink">{node.entity_name}</td>
                        <td className="px-3 py-2">Tier {node.tier}</td>
                        <td className="px-3 py-2 text-xs">{node.material}</td>
                        <td className="px-3 py-2">{node.country}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${node.composite_risk > 6 ? 'bg-status-critical-bg text-status-critical-fg' :
                            node.composite_risk > 4 ? 'bg-status-warning-bg text-yellow-800' :
                              'bg-status-ok-bg text-status-ok-fg'
                            }`}>{node.composite_risk}/10</span>
                        </td>
                        <td className="px-3 py-2 text-xs text-ink-muted max-w-xs truncate">{node.risk_justification}</td>
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div><p className="text-xs text-ink-muted">Yield</p><p className="font-bold text-purple-700">{(agentData.results as any).kpis.overall_yield_pct}%</p></div>
                  <div><p className="text-xs text-ink-muted">Cpk</p><p className="font-bold text-purple-700">{(agentData.results as any).kpis.process_capability_cpk}</p></div>
                  <div><p className="text-xs text-ink-muted">Drift Alerts</p><p className="font-bold text-status-critical-fg">{(agentData.results as any).kpis.drift_alerts_active}</p></div>
                  <div><p className="text-xs text-ink-muted">Defect PPM</p><p className="font-bold text-status-warning-fg">{(agentData.results as any).kpis.defect_rate_ppm?.toFixed(0)}</p></div>
                </div>
                <p className="text-xs text-purple-600 mt-3">Switch to the Quality (QMS) tab for full SPC charts, inspections, and predictions.</p>
              </div>
            )}

            {/* Carbon results (from agent) */}
            {agentData.results && 'kpis' in agentData.results && (agentData.results as any).kpis?.total_emissions_tons_co2 !== undefined && (
              <div className="p-4 bg-status-ok-bg rounded-lg border border-status-ok-border">
                <h3 className="font-semibold text-status-ok-fg mb-2">Net Zero & Carbon Intelligence</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div><p className="text-xs text-ink-muted">Total Emissions</p><p className="font-bold text-ink">{(agentData.results as any).kpis.total_emissions_tons_co2} t</p></div>
                  <div><p className="text-xs text-ink-muted">Avoided</p><p className="font-bold text-status-ok-fg">{(agentData.results as any).kpis.avoided_emissions_tons} t</p></div>
                  <div><p className="text-xs text-ink-muted">YoY Reduction</p><p className="font-bold text-status-ok-fg">{(agentData.results as any).kpis.yoy_reduction_pct}%</p></div>
                  <div><p className="text-xs text-ink-muted">Intensity</p><p className="font-bold text-voltage-700">{(agentData.results as any).kpis.carbon_intensity_g_per_km} g/km</p></div>
                </div>
                <p className="text-xs text-status-ok-fg mt-3">Switch to the Net Zero tab for full scope breakdown, fleet comparison, and progress tracking.</p>
              </div>
            )}

            {agentData.results.length === 0 && !scheduleData && !mapData && (
              <p className="text-sm text-ink-muted italic">No results returned. Click a preset button above or enter a search query.</p>
            )}
          </div>
        )}
      </div>

      {/* FEATURE 4: SUPPLY CHAIN RISK MAP */}
      {mapData && mapData.length > 0 && (
        <div className="mt-6 p-6 bg-canvas shadow-md rounded-lg border border-hairline">
          <h2 className="text-2xl font-bold mb-4 text-ink">Supply Chain Risk & Traceability</h2>
          <p className="text-sm text-ink-muted mb-4">Geospatial mapping of Tier 1-3 suppliers with live news-based risk scoring. Red markers indicate high composite risk.</p>

          <div className="mb-6 rounded overflow-hidden border border-hairline" style={{ height: '450px', width: '100%' }}>
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
                    <div className="font-bold text-status-critical-fg">Live Risk: {node.composite_risk}/10</div>
                    <div className="text-xs mt-1 max-w-[200px] italic text-ink">{node.risk_justification}</div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <table className="w-full text-sm text-left text-ink-muted">
            <thead className="bg-canvas text-ink uppercase">
              <tr>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Composite Risk</th>
              </tr>
            </thead>
            <tbody>
              {mapData.map((node: any, idx: number) => (
                <tr key={idx} className="bg-canvas border-b">
                  <td className="px-4 py-3 font-medium text-ink">{node.entity_name}</td>
                  <td className="px-4 py-3">Tier {node.tier}</td>
                  <td className="px-4 py-3">{node.material}</td>
                  <td className="px-4 py-3">{node.country}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${node.composite_risk > 6 ? "bg-status-critical-bg text-status-critical-fg" : node.composite_risk > 4 ? "bg-status-warning-bg text-yellow-800" : "bg-status-ok-bg text-status-ok-fg"
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
  );
}

