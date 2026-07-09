import { useState, useEffect } from 'react';
import { fetchFleetReadiness, queryApmAgent } from './api';
import type { ReadinessResult, ApmAgentResponse, BatteryHealthReport } from './api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet default marker icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function App() {
  const [data, setData] = useState<ReadinessResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [apmQuery, setApmQuery] = useState<string>("");
  const [apmLoading, setApmLoading] = useState<boolean>(false);
  const [agentData, setAgentData] = useState<ApmAgentResponse | null>(null);
  const [scheduleData, setScheduleData] = useState<any[] | null>(null);
  const [mapData, setMapData] = useState<any[] | null>(null);

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
      if (result.results.length > 0 && result.results[0].bay_number !== undefined) {
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
        Loading Fleet Data...
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Fleet Electrification Readiness</h1>
      <div className="overflow-x-auto shadow-md sm:rounded-lg">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="bg-gray-50 text-gray-700 uppercase">
            <tr>
              <th className="px-6 py-3">Rank</th>
              <th className="px-6 py-3">Vehicle ID</th>
              <th className="px-6 py-3">Readiness Score</th>
              <th className="px-6 py-3">Range Feasibility</th>
              <th className="px-6 py-3">Charging Oppty</th>
              <th className="px-6 py-3">Payload Compat</th>
              <th className="px-6 py-3">Recommended Battery</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={item.vehicle_id} className="bg-white border-b hover:bg-gray-50">
                <td className="px-6 py-4">{i + 1}</td>
                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{item.vehicle_id}</td>
                <td className="px-6 py-4">
                  {item.readiness_score}
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                    <div
                      className={`h-2.5 rounded-full ${
                        item.readiness_score > 70 ? "bg-green-500" : item.readiness_score > 40 ? "bg-yellow-500" : "bg-red-500"
                      }`}
                      style={{ width: `${item.readiness_score}%` }}
                    ></div>
                  </div>
                </td>
                <td className="px-6 py-4">{item.range_feasibility.toFixed(1)}</td>
                <td className="px-6 py-4">{item.charging_opportunity.toFixed(1)}</td>
                <td className="px-6 py-4">{item.payload_compatibility.toFixed(1)}</td>
                <td className="px-6 py-4">{`${item.recommended_battery_kwh} kWh`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FEATURE 2: APM AGENT UI */}
      <div className="mt-12 p-6 bg-white shadow-md rounded-lg border border-gray-200">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">EV Asset Performance Management (APM) Agent</h2>
      
        <div className="flex gap-4 mb-6">
          <input
            type="text"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder='Try: "Show me thermal anomalies" or "Which truck needs replacement soonest?"'
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

            {agentData.results.length > 0 && 'current_soh' in agentData.results[0] && (
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="bg-gray-50 text-gray-700 uppercase">
                  <tr>
                    <th className="px-4 py-3">Vehicle ID</th>
                    <th className="px-4 py-3">Current SoH (%)</th>
                    <th className="px-4 py-3">Predicted RUL (Days)</th>
                    <th className="px-4 py-3">Degradation Rate</th>
                    <th className="px-4 py-3">Thermal Anomaly</th>
                  </tr>
                </thead>
                <tbody>
                  {agentData.results.map((item) => (
                    <tr key={item.vehicle_id} className="bg-white border-b">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.vehicle_id}</td>
                      <td className="px-4 py-3">{(item.current_soh as number).toFixed(1)}</td>
                      <td className="px-4 py-3">{item.predicted_rul_days}</td>
                      <td className="px-4 py-3">{(item.degradation_rate_per_day as number).toFixed(4)}</td>
                      <td className="px-4 py-3">
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
          </div>
        )}
      </div>

      {/* FEATURE 3: MAINTENANCE SCHEDULE */}
      {scheduleData && scheduleData.length > 0 && (
        <div className="mt-12 p-6 bg-white shadow-md rounded-lg border border-gray-200">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Maintenance Operations Optimiser</h2>
          <p className="text-sm text-gray-500 mb-4">Greedy-scheduled based on APM triggers. Constraints: 3 Bays, 16-hour max shift.</p>
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="bg-gray-50 text-gray-700 uppercase">
              <tr>
                <th className="px-4 py-3">Vehicle ID</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Assigned Bay</th>
                <th className="px-4 py-3">Start Time (Hour)</th>
              </tr>
            </thead>
            <tbody>
              {scheduleData.map((item) => (
                <tr key={item.vehicle_id} className="bg-white border-b">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.vehicle_id}</td>
                  <td className="px-4 py-3">{item.reason}</td>
                  <td className="px-4 py-3"><span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">Bay {item.bay_number}</span></td>
                  <td className="px-4 py-3">{item.start_hour}:00</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* FEATURE 4: SUPPLY CHAIN RISK MAP */}
      {mapData && mapData.length > 0 && (
        <div className="mt-12 p-6 bg-white shadow-md rounded-lg border border-gray-200">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Supply Chain Risk &amp; Traceability</h2>
          <p className="text-sm text-gray-500 mb-4">Geospatial mapping of Tier 1-3 suppliers. Red markers indicate high composite risk (Geopolitical + ESG).</p>

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
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      node.composite_risk > 6 ? "bg-red-100 text-red-800" : node.composite_risk > 4 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"
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
    </div>
  );
}
