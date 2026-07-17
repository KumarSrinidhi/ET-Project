import { useState, useEffect } from 'react';
import { fetchNetZeroReport } from './api';
import type { NetZeroReport } from './api';
import DashboardShell from './components/DashboardShell';

export default function NetZeroDashboard({ selectedDepotId }: { selectedDepotId: string | null }) {
    const [data, setData] = useState<NetZeroReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'fleet' | 'supply_chain' | 'progress'>('overview');

    useEffect(() => {
        setLoading(true);
        fetchNetZeroReport(selectedDepotId)
            .then(setData)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [selectedDepotId]);

    return (
      <DashboardShell loading={loading} error={error} loadingMessage="Calculating carbon intelligence...">
        {data && <NetZeroContent data={data} activeTab={activeTab} setActiveTab={setActiveTab} />}
      </DashboardShell>
    );
}

function NetZeroContent({ data, activeTab, setActiveTab }: {
  data: NetZeroReport;
  activeTab: 'overview' | 'fleet' | 'supply_chain' | 'progress';
  setActiveTab: (tab: 'overview' | 'fleet' | 'supply_chain' | 'progress') => void;
}) {

    const { kpis, emission_sources, fleet_comparison, supply_chain_carbon, monthly_progress, scope_breakdown, recommendations } = data;

    return (
        <div className="mt-12 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Net Zero Progress & Carbon Intelligence</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Scope 1/2/3 Tracking · EV vs ICE Comparison · Supply Chain Footprint · Target: Net Zero by {kpis.target_year}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {kpis.yoy_reduction_pct}% YoY
                    </span>
                    <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {kpis.years_to_net_zero} years to net zero
                    </span>
                </div>
            </div>

            {/* Primary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <KPICard label="Total Emissions" value={`${kpis.total_emissions_tons_co2} t`} subtitle="CO₂e/year" />
                <KPICard label="Scope 1 (Direct)" value={`${kpis.scope_1_tons} t`} subtitle="Fleet + Facility" />
                <KPICard label="Scope 2 (Energy)" value={`${kpis.scope_2_tons} t`} subtitle="Purchased electricity" />
                <KPICard label="Scope 3 (Chain)" value={`${kpis.scope_3_tons} t`} subtitle="Value chain" />
                <KPICard label="Avoided Emissions" value={`${kpis.avoided_emissions_tons} t`} subtitle="EV vs ICE savings" />
                <KPICard label="Carbon Intensity" value={`${kpis.carbon_intensity_g_per_km}`} subtitle="Based on India blended grid (460 gCO₂/kWh)" />
            </div>

            {/* Scope Breakdown Visual */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Emission Scope Breakdown</h3>
                </div>
                <div className="p-5 space-y-3">
                    {Object.entries(scope_breakdown).map(([scope, tons], idx) => {
                        const total = Object.values(scope_breakdown).reduce((a: number, b: number) => a + b, 0);
                        const pct = (tons / total) * 100;
                        return (
                            <div key={scope}>
                                <div className="flex justify-between text-[11px] uppercase tracking-wider text-gray-400 font-medium mb-1.5">
                                    <span>{scope}</span>
                                    <span className="font-mono text-gray-700">{(tons as number)} t · <span className="text-gray-900 font-semibold">{pct.toFixed(1)}%</span></span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div className="h-2 rounded-full bg-gray-800 transition-all" style={{ width: `${pct}%`, opacity: idx === 0 ? 1 : idx === 1 ? 0.6 : 0.3 }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <KPICard label="Renewable Energy" value={`${kpis.renewable_energy_pct}%`} subtitle="Procurement share" />
                <KPICard label="Fleet Electrified" value={`${kpis.ev_fleet_pct}%`} subtitle="EV penetration" />
                <KPICard label="Carbon Offsets" value={`${kpis.offset_credits_tons} t`} subtitle="Purchased credits" />
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-6" role="tablist" aria-label="Net Zero Dashboard Sections">
                    {(['overview', 'fleet', 'supply_chain', 'progress'] as const).map(tab => (
                        <button
                            key={tab}
                            role="tab"
                            aria-selected={activeTab === tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === tab
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {tab === 'supply_chain' ? 'Supply Chain Carbon' : tab === 'fleet' ? 'Fleet Comparison' : tab}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Emission Sources */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Emission Sources Detail</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="bg-gray-50/30 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                                    <tr>
                                        <th className="px-5 py-2.5">Source</th>
                                        <th className="px-5 py-2.5">Scope</th>
                                        <th className="px-5 py-2.5">Category</th>
                                        <th className="px-5 py-2.5">Emissions (kgCO₂)</th>
                                        <th className="px-5 py-2.5">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {emission_sources.map((source: { source_name: string; scope: string; category: string; emissions_kg_co2: number; description: string }, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-5 py-3 font-medium text-gray-800">{source.source_name}</td>
                                            <td className="px-5 py-3">
                                                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                                    {source.scope}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-xs text-gray-500">{source.category}</td>
                                            <td className="px-5 py-3 font-mono text-xs text-gray-800">{source.emissions_kg_co2.toLocaleString()}</td>
                                            <td className="px-5 py-3 text-xs text-gray-500 max-w-xs">{source.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recommendations - Divided list */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Reduction Recommendations</h3>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {recommendations.map((rec: string, idx: number) => (
                                <div key={idx} className="px-5 py-3.5 hover:bg-gray-50/50 transition-colors flex items-start gap-3">
                                    <span className="flex-shrink-0 text-[11px] uppercase tracking-wider text-gray-400 font-mono font-medium w-6">
                                        {String(idx + 1).padStart(2, '0')}
                                    </span>
                                    <p className="text-sm text-gray-700 leading-relaxed">{rec}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'fleet' && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">EV vs ICE Fleet Emission Comparison</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="bg-gray-50/30 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                                <tr>
                                    <th className="px-5 py-2.5">Vehicle</th>
                                    <th className="px-5 py-2.5">Annual km</th>
                                    <th className="px-5 py-2.5">EV (kg)</th>
                                    <th className="px-5 py-2.5">ICE (kg)</th>
                                    <th className="px-5 py-2.5">Avoided (kg)</th>
                                    <th className="px-5 py-2.5">Savings</th>
                                    <th className="px-5 py-2.5">Energy Source</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {fleet_comparison.map((vehicle: { vehicle_id: string; annual_km: number; ev_emissions_kg_co2_per_year: number; ice_equivalent_kg_co2_per_year: number; avoided_emissions_kg_co2: number; avoided_pct: number; energy_source: string }) => (
                                    <tr key={vehicle.vehicle_id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-3 font-medium text-gray-800">{vehicle.vehicle_id}</td>
                                        <td className="px-5 py-3 font-mono text-xs text-gray-800">{vehicle.annual_km.toLocaleString()}</td>
                                        <td className="px-5 py-3 font-mono text-xs text-gray-800">{vehicle.ev_emissions_kg_co2_per_year.toLocaleString()}</td>
                                        <td className="px-5 py-3 font-mono text-xs text-gray-500">{vehicle.ice_equivalent_kg_co2_per_year.toLocaleString()}</td>
                                        <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-900">{vehicle.avoided_emissions_kg_co2.toLocaleString()}</td>
                                        <td className="px-5 py-3">
                                            <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full ${vehicle.avoided_pct > 60 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                                {vehicle.avoided_pct}%
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-xs text-gray-500">{vehicle.energy_source}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Summary */}
                    <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Total EV Emissions</p>
                                <p className="font-mono text-base font-semibold text-gray-900 mt-0.5">
                                    {(fleet_comparison.reduce((a: number, b: { ev_emissions_kg_co2_per_year: number }) => a + b.ev_emissions_kg_co2_per_year, 0) / 1000).toFixed(1)} t
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">ICE Equivalent</p>
                                <p className="font-mono text-base font-semibold text-gray-900 mt-0.5">
                                    {(fleet_comparison.reduce((a: number, b: { ice_equivalent_kg_co2_per_year: number }) => a + b.ice_equivalent_kg_co2_per_year, 0) / 1000).toFixed(1)} t
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Total Avoided</p>
                                <p className="font-mono text-base font-semibold text-gray-900 mt-0.5">
                                    {(fleet_comparison.reduce((a: number, b: { avoided_emissions_kg_co2: number }) => a + b.avoided_emissions_kg_co2, 0) / 1000).toFixed(1)} t
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'supply_chain' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Supply Chain Carbon Footprint (Scope 3)</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="bg-gray-50/30 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                                    <tr>
                                        <th className="px-5 py-2.5">Supplier</th>
                                        <th className="px-5 py-2.5">Material</th>
                                        <th className="px-5 py-2.5">Country</th>
                                        <th className="px-5 py-2.5">Transport</th>
                                        <th className="px-5 py-2.5">Distance (km)</th>
                                        <th className="px-5 py-2.5">Production (kg)</th>
                                        <th className="px-5 py-2.5">Transport (kg)</th>
                                        <th className="px-5 py-2.5">Total (kg)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {supply_chain_carbon.map((item: { supplier: string; material: string; country: string; transport_mode: string; transport_distance_km: number; production_emissions_kg_co2: number; transport_emissions_kg_co2: number; total_emissions_kg_co2: number; material_carbon_intensity_kg_co2_per_ton: number }, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-5 py-3 font-medium text-gray-800">{item.supplier}</td>
                                            <td className="px-5 py-3 text-xs text-gray-500">{item.material}</td>
                                            <td className="px-5 py-3 text-xs text-gray-500">{item.country}</td>
                                            <td className="px-5 py-3 text-xs text-gray-500">{item.transport_mode}</td>
                                            <td className="px-5 py-3 font-mono text-xs text-gray-800">{item.transport_distance_km.toLocaleString()}</td>
                                            <td className="px-5 py-3 font-mono text-xs text-gray-500">{item.production_emissions_kg_co2.toLocaleString()}</td>
                                            <td className="px-5 py-3 font-mono text-xs text-gray-500">{item.transport_emissions_kg_co2.toLocaleString()}</td>
                                            <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-900">{item.total_emissions_kg_co2.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Carbon intensity bar chart */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                            <h4 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Material Carbon Intensity (kgCO₂/ton)</h4>
                        </div>
                        <div className="p-5 space-y-3">
                            {supply_chain_carbon.map((item: { material: string; material_carbon_intensity_kg_co2_per_ton: number }, idx: number) => {
                                const maxIntensity = Math.max(...supply_chain_carbon.map((s: { material_carbon_intensity_kg_co2_per_ton: number }) => s.material_carbon_intensity_kg_co2_per_ton));
                                const pct = (item.material_carbon_intensity_kg_co2_per_ton / maxIntensity) * 100;
                                return (
                                    <div key={idx} className="flex items-center gap-3">
                                        <span className="text-xs text-gray-600 w-40 truncate font-medium">{item.material}</span>
                                        <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                                            <div className="h-2.5 rounded-full bg-gray-800 transition-all" style={{ width: `${pct}%`, opacity: 0.4 + (pct / 200) }} />
                                        </div>
                                        <span className="font-mono text-xs font-medium text-gray-900 w-20 text-right">
                                            {item.material_carbon_intensity_kg_co2_per_ton.toLocaleString()}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'progress' && (
                <div className="space-y-6">
                    {/* Monthly Progress Chart */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Monthly Emissions vs Target Trajectory</h3>
                        </div>
                        <div className="p-5">
                            <div className="relative h-56 rounded-lg bg-gray-50/50 border border-gray-100 p-4">
                                <div className="absolute top-4 left-4 right-4 border-t-2 border-dashed border-gray-300" style={{ top: '10%' }}>
                                    <span className="absolute -top-4 right-0 text-[11px] text-gray-400 font-mono uppercase tracking-wider">Baseline {monthly_progress[0]?.baseline_emissions_tons_co2} t</span>
                                </div>
                                <div className="flex items-end h-full gap-2 pt-8 pb-6">
                                    {monthly_progress.map((month: { month: string; actual_emissions_tons_co2: number; target_emissions_tons_co2: number; baseline_emissions_tons_co2: number; on_track: boolean }, idx: number) => {
                                        const maxVal = monthly_progress[0]?.baseline_emissions_tons_co2 || 120;
                                        const actualH = (month.actual_emissions_tons_co2 / maxVal) * 100;
                                        const targetH = (month.target_emissions_tons_co2 / maxVal) * 100;
                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center gap-1 relative h-full justify-end">
                                                <div className="absolute w-full border-t-2 border-gray-800"
                                                    style={{ bottom: `${targetH}%`, opacity: 0.4 }} />
                                                <div
                                                    className={`w-full rounded-t ${month.on_track ? 'bg-gray-800' : 'bg-red-500'}`}
                                                    style={{ height: `${actualH}%`, opacity: month.on_track ? 0.8 : 1 }}
                                                    title={`${month.month}: ${month.actual_emissions_tons_co2} t (target: ${month.target_emissions_tons_co2} t)`}
                                                />
                                                <span className="text-[9px] text-gray-400 -rotate-45 origin-top-left mt-1 font-mono">
                                                    {month.month.split('-')[1]}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex gap-4 mt-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-gray-800" style={{opacity: 0.8}} /> On Track</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-500" /> Above Target</span>
                                <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-gray-800" style={{opacity: 0.4}}></span> Target Line</span>
                            </div>
                        </div>
                    </div>

                    {/* Monthly Data Table */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Monthly Reduction Progress</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="bg-gray-50/30 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                                    <tr>
                                        <th className="px-5 py-2.5">Month</th>
                                        <th className="px-5 py-2.5">Actual (t)</th>
                                        <th className="px-5 py-2.5">Target (t)</th>
                                        <th className="px-5 py-2.5">Baseline (t)</th>
                                        <th className="px-5 py-2.5">Reduction</th>
                                        <th className="px-5 py-2.5">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {monthly_progress.map((month: { month: string; actual_emissions_tons_co2: number; target_emissions_tons_co2: number; baseline_emissions_tons_co2: number; reduction_pct: number; on_track: boolean }) => (
                                        <tr key={month.month} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-5 py-3 font-medium text-gray-800">{month.month}</td>
                                            <td className="px-5 py-3 font-mono text-xs text-gray-800">{month.actual_emissions_tons_co2}</td>
                                            <td className="px-5 py-3 font-mono text-xs text-gray-500">{month.target_emissions_tons_co2}</td>
                                            <td className="px-5 py-3 font-mono text-xs text-gray-400">{month.baseline_emissions_tons_co2}</td>
                                            <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-900">{month.reduction_pct}%</td>
                                            <td className="px-5 py-3">
                                                <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full ${month.on_track ? 'bg-gray-900 text-white' : 'bg-red-50 text-red-600'}`}>
                                                    {month.on_track ? 'On Track' : 'Behind'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function KPICard({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string }) {
    return (
        <div className="bg-gray-50/80 rounded-xl p-5 text-center">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">{label}</p>
            <p className="mt-2">
                <span className="font-mono text-xl font-semibold text-gray-900 tracking-tight">{value}</span>
            </p>
            {subtitle && <p className="text-[10px] text-gray-500 mt-1.5 leading-tight">{subtitle}</p>}
        </div>
    );
}
