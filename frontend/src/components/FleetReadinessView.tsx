import type { ReadinessResult } from '../api';

interface Props {
  data: ReadinessResult[];
}

export default function FleetReadinessView({ data }: Props) {
  if (data.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6 text-ink">Fleet Electrification Readiness & Procurement</h2>
        <div className="p-8 bg-canvas rounded-lg border border-hairline shadow-sm text-center">
          <p className="text-ink-muted">No fleet data available.</p>
          <p className="text-sm text-ink-faint mt-1">Ensure the backend is running and generating synthetic fleet data.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-ink">Fleet Electrification Readiness & Procurement</h2>
      <p className="text-sm text-ink-muted mb-4">Weighted scoring engine ranking 100 ICE vehicles by EV conversion feasibility.</p>

      {/* Fleet Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <KPICard label="Total Fleet" value={data.length} color="text-ink" />
        <KPICard label="Ready (Score >70)" value={data.filter(d => d.readiness_score > 70).length} color="text-status-ok-fg" />
        <KPICard label="Marginal (40-70)" value={data.filter(d => d.readiness_score > 40 && d.readiness_score <= 70).length} color="text-status-warning-fg" />
        <KPICard label="Not Ready (<40)" value={data.filter(d => d.readiness_score <= 40).length} color="text-status-critical-fg" />
        <KPICard label="Avg TCO Savings" value={`${(data.reduce((a, b) => a + b.tco_savings_pct, 0) / data.length).toFixed(1)}%`} color="text-voltage-700" />
        <KPICard label="Avg Score" value={(data.reduce((a, b) => a + b.readiness_score, 0) / data.length).toFixed(1)} color="text-indigo-700" />
      </div>

      <div className="overflow-x-auto shadow-md sm:rounded-lg">
        <table className="w-full text-sm text-left text-ink-muted">
          <thead className="bg-canvas text-ink uppercase text-xs">
            <tr>
              <th className="px-3 py-3">Rank</th>
              <th className="px-3 py-3">Vehicle ID</th>
              <th className="px-3 py-3">Readiness Score</th>
              <th className="hidden md:table-cell px-3 py-3">Range</th>
              <th className="hidden lg:table-cell px-3 py-3">Charging</th>
              <th className="hidden lg:table-cell px-3 py-3">Payload</th>
              <th className="hidden lg:table-cell px-3 py-3">Infra</th>
              <th className="hidden md:table-cell px-3 py-3">TCO Savings</th>
              <th className="hidden md:table-cell px-3 py-3">Battery</th>
              <th className="hidden sm:table-cell px-3 py-3">Chemistry</th>
              <th className="hidden lg:table-cell px-3 py-3">Est. Cost (INR)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={item.vehicle_id} className="bg-canvas border-b bg-canvas">
                <td className="px-3 py-3">{i + 1}</td>
                <td className="px-3 py-3 font-medium text-ink whitespace-nowrap">{item.vehicle_id}</td>
                <td className="px-3 py-3">
                  {item.readiness_score}
                  <div className="w-full bg-canvas-sunken rounded-full h-2.5 mt-2">
                    <div
                      className={`h-2.5 rounded-full ${item.readiness_score > 70 ? "bg-status-ok-fg" : item.readiness_score > 40 ? "bg-status-warning-fg" : "bg-status-critical-fg"}`}
                      style={{ width: `${item.readiness_score}%` }}
                    />
                  </div>
                </td>
                <td className="hidden md:table-cell px-3 py-3">{item.range_feasibility.toFixed(1)}</td>
                <td className="hidden lg:table-cell px-3 py-3">{item.charging_opportunity.toFixed(1)}</td>
                <td className="hidden lg:table-cell px-3 py-3">{item.payload_compatibility.toFixed(1)}</td>
                <td className="hidden lg:table-cell px-3 py-3">{item.infra_proximity.toFixed(1)}</td>
                <td className="px-3 py-3">
                  <span className="px-2 py-0.5 text-xs font-bold rounded bg-status-ok-bg text-status-ok-fg">{item.tco_savings_pct}%</span>
                </td>
                <td className="px-3 py-3 font-mono text-xs">{item.recommended_battery_kwh} kWh</td>
                <td className="px-3 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded ${item.recommended_chemistry === 'LFP' ? 'bg-voltage-50 text-voltage-700' : 'bg-purple-100 text-purple-800'}`}>
                    {item.recommended_chemistry}
                  </span>
                </td>
                <td className="px-3 py-3 font-mono text-xs">{(item as any).estimated_capex_inr != null ? `₹${((item as any).estimated_capex_inr).toLocaleString('en-IN')}` : '--'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPICard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="p-4 bg-canvas rounded-lg border border-hairline shadow-sm text-center">
      <p className="text-[10px] text-ink-faint uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

