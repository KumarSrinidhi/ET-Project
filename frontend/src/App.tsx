import { useState, useEffect } from 'react';
import { fetchFleetReadiness } from './api';
import type { ReadinessResult } from './api';

export default function App() {
  const [data, setData] = useState<ReadinessResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadData = async () => {
      const results = await fetchFleetReadiness();
      setData(results);
      setLoading(false);
    };

    loadData().catch((err) => console.error(err));
  }, []);

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
    </div>
  );
}
