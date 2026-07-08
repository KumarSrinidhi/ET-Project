import { useState, useEffect } from 'react';
import { fetchFleetReadiness, queryApmAgent } from './api';
import type { ReadinessResult, ApmAgentResponse, BatteryHealthReport } from './api';

export default function App() {
  const [data, setData] = useState<ReadinessResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [apmQuery, setApmQuery] = useState<string>("");
  const [apmLoading, setApmLoading] = useState<boolean>(false);
  const [agentData, setAgentData] = useState<ApmAgentResponse | null>(null);

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
                    <td className="px-4 py-3">{item.current_soh.toFixed(1)}</td>
                    <td className="px-4 py-3">{item.predicted_rul_days}</td>
                    <td className="px-4 py-3">{item.degradation_rate_per_day.toFixed(4)}</td>
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
          </div>
        )}
      </div>
    </div>
  );
}
