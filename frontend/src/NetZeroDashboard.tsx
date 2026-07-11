import { useState, useEffect } from 'react';
import { fetchNetZeroReport } from './api';
import type { NetZeroReport } from './api';

export default function NetZeroDashboard() {
    const [data, setData] = useState<NetZeroReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'fleet' | 'supply_chain' | 'progress'>('overview');

    useEffect(() => {
        fetchNetZeroReport()
            .then(setData)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-500">Calculating carbon intelligence...</span>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700">Failed to load carbon tracker: {error}</p>
            </div>
        );
    }

    const { kpis, emission_sources, fleet_comparison, supply_chain_carbon, monthly_progress, scope_breakdown, recommendations } = data;

    return (
        <div className="mt-12 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Net Zero Progress & Carbon Intelligence</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Scope 1/2/3 Tracking • EV vs ICE Comparison • Supply Chain Footprint • Target: Net Zero by {kpis.target_year}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        ↓ {kpis.yoy_reduction_pct}% YoY
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {kpis.years_to_net_zero} years to Net Zero
                    </span>
                </div>
            </div>

            {/* Primary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <KPICard label="Total Emissions" value={`${kpis.total_emissions_tons_co2} t`} color="text-gray-800" subtitle="CO₂e/year" />
                <KPICard label="Scope 1 (Direct)" value={`${kpis.scope_1_tons} t`} color="text-red-600" subtitle="Fleet + Facility" />
                <KPICard label="Scope 2 (Energy)" value={`${kpis.scope_2_tons} t`} color="text-orange-600" subtitle="Purchased electricity" />
                <KPICard label="Scope 3 (Chain)" value={`${kpis.scope_3_tons} t`} color="text-blue-700" subtitle="Value chain" />
                <KPICard label="Avoided Emissions" value={`${kpis.avoided_emissions_tons} t`} color="text-blue-600" subtitle="EV vs ICE savings" />
                <KPICard label="Carbon Intensity" value={`${kpis.carbon_intensity_g_per_km}`} color="text-blue-700" subtitle="gCO₂/km (EV fleet)" />
            </div>

            {/* Scope Breakdown Visual */}
            <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Emission Scope Breakdown</h3>
                <div className="flex items-center gap-4">
                    {Object.entries(scope_breakdown).map(([scope, tons], idx) => {
                        const total = Object.values(scope_breakdown).reduce((a: number, b: number) => a + b, 0);
                        const pct = (tons / total) * 100;
                        const colors = ['bg-red-400', 'bg-orange-400', 'bg-blue-500'];
                        return (
                            <div key={scope} className="flex-1">
                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                    <span>{scope}</span>
                                    <span className="font-bold">{(tons as number)} t ({pct.toFixed(1)}%)</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-6">
                                    <div className={`h-6 rounded-full ${colors[idx]} transition-all`} style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Renewable Energy</p>
                    <p className="text-2xl font-bold text-blue-600">{kpis.renewable_energy_pct}%</p>
                    <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${kpis.renewable_energy_pct}%` }} />
                    </div>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Fleet Electrified</p>
                    <p className="text-2xl font-bold text-blue-700">{kpis.ev_fleet_pct}%</p>
                    <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${kpis.ev_fleet_pct}%` }} />
                    </div>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Carbon Offsets</p>
                    <p className="text-2xl font-bold text-gray-700">{kpis.offset_credits_tons} t</p>
                    <p className="text-xs text-gray-500 mt-1">Purchased carbon credits</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-6">
                    {(['overview', 'fleet', 'supply_chain', 'progress'] as const).map(tab => (
                        <button
                            key={tab}
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
                    <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                            Emission Sources Detail
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                                    <tr>
                                        <th className="px-3 py-2">Source</th>
                                        <th className="px-3 py-2">Scope</th>
                                        <th className="px-3 py-2">Category</th>
                                        <th className="px-3 py-2">Emissions (kgCO₂)</th>
                                        <th className="px-3 py-2">Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {emission_sources.map((source: { source_name: string; scope: string; category: string; emissions_kg_co2: number; description: string }, idx: number) => (
                                        <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-3 py-2 font-medium text-gray-900">{source.source_name}</td>
                                            <td className="px-3 py-2">
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${source.scope === 'Scope 1' ? 'bg-red-100 text-red-800' :
                                                        source.scope === 'Scope 2' ? 'bg-orange-100 text-orange-800' :
                                                            'bg-blue-100 text-blue-800'
                                                    }`}>{source.scope}</span>
                                            </td>
                                            <td className="px-3 py-2 text-xs">{source.category}</td>
                                            <td className="px-3 py-2 font-mono">{source.emissions_kg_co2.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-xs text-gray-500 max-w-xs">{source.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recommendations */}
                    <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                            AI-Generated Reduction Recommendations
                        </h3>
                        <div className="space-y-3">
                            {recommendations.map((rec: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                                        {idx + 1}
                                    </span>
                                    <p className="text-sm text-gray-700">{rec}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'fleet' && (
                <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                        EV vs ICE Fleet Emission Comparison
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                                <tr>
                                    <th className="px-3 py-2">Vehicle</th>
                                    <th className="px-3 py-2">Annual km</th>
                                    <th className="px-3 py-2">EV Emissions (kg)</th>
                                    <th className="px-3 py-2">ICE Equivalent (kg)</th>
                                    <th className="px-3 py-2">Avoided (kg)</th>
                                    <th className="px-3 py-2">Savings %</th>
                                    <th className="px-3 py-2">Energy Source</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fleet_comparison.map((vehicle: { vehicle_id: string; annual_km: number; ev_emissions_kg_co2_per_year: number; ice_equivalent_kg_co2_per_year: number; avoided_emissions_kg_co2: number; avoided_pct: number; energy_source: string }) => (
                                    <tr key={vehicle.vehicle_id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-3 py-2 font-medium text-gray-900">{vehicle.vehicle_id}</td>
                                        <td className="px-3 py-2 font-mono text-xs">{vehicle.annual_km.toLocaleString()}</td>
                                        <td className="px-3 py-2 font-mono text-xs text-blue-700">{vehicle.ev_emissions_kg_co2_per_year.toLocaleString()}</td>
                                        <td className="px-3 py-2 font-mono text-xs text-red-700">{vehicle.ice_equivalent_kg_co2_per_year.toLocaleString()}</td>
                                        <td className="px-3 py-2 font-mono text-xs font-bold text-blue-600">{vehicle.avoided_emissions_kg_co2.toLocaleString()}</td>
                                        <td className="px-3 py-2">
                                            <span className={`px-2 py-0.5 text-xs font-bold rounded ${vehicle.avoided_pct > 60 ? 'bg-blue-100 text-blue-800' :
                                                    vehicle.avoided_pct > 30 ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-red-100 text-red-800'
                                                }`}>{vehicle.avoided_pct}%</span>
                                        </td>
                                        <td className="px-3 py-2 text-xs text-gray-500">{vehicle.energy_source}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Summary */}
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-xs text-gray-500">Total EV Emissions</p>
                                <p className="text-lg font-bold text-blue-700">
                                    {(fleet_comparison.reduce((a: number, b: { ev_emissions_kg_co2_per_year: number }) => a + b.ev_emissions_kg_co2_per_year, 0) / 1000).toFixed(1)} t
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">ICE Equivalent</p>
                                <p className="text-lg font-bold text-red-700">
                                    {(fleet_comparison.reduce((a: number, b: { ice_equivalent_kg_co2_per_year: number }) => a + b.ice_equivalent_kg_co2_per_year, 0) / 1000).toFixed(1)} t
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Total Avoided</p>
                                <p className="text-lg font-bold text-blue-600">
                                    {(fleet_comparison.reduce((a: number, b: { avoided_emissions_kg_co2: number }) => a + b.avoided_emissions_kg_co2, 0) / 1000).toFixed(1)} t
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'supply_chain' && (
                <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                        Supply Chain Carbon Footprint (Scope 3)
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                                <tr>
                                    <th className="px-3 py-2">Supplier</th>
                                    <th className="px-3 py-2">Material</th>
                                    <th className="px-3 py-2">Country</th>
                                    <th className="px-3 py-2">Transport</th>
                                    <th className="px-3 py-2">Distance (km)</th>
                                    <th className="px-3 py-2">Production CO₂ (kg)</th>
                                    <th className="px-3 py-2">Transport CO₂ (kg)</th>
                                    <th className="px-3 py-2">Total CO₂ (kg)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {supply_chain_carbon.map((item: { supplier: string; material: string; country: string; transport_mode: string; transport_distance_km: number; production_emissions_kg_co2: number; transport_emissions_kg_co2: number; total_emissions_kg_co2: number; material_carbon_intensity_kg_co2_per_ton: number }, idx: number) => (
                                    <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-3 py-2 font-medium text-gray-900">{item.supplier}</td>
                                        <td className="px-3 py-2 text-xs">{item.material}</td>
                                        <td className="px-3 py-2">{item.country}</td>
                                        <td className="px-3 py-2 text-xs">{item.transport_mode}</td>
                                        <td className="px-3 py-2 font-mono text-xs">{item.transport_distance_km.toLocaleString()}</td>
                                        <td className="px-3 py-2 font-mono text-xs">{item.production_emissions_kg_co2.toLocaleString()}</td>
                                        <td className="px-3 py-2 font-mono text-xs">{item.transport_emissions_kg_co2.toLocaleString()}</td>
                                        <td className="px-3 py-2 font-mono text-xs font-bold text-red-700">{item.total_emissions_kg_co2.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Carbon intensity bar chart */}
                    <div className="mt-6">
                        <h4 className="text-xs font-semibold text-gray-600 uppercase mb-3">Material Carbon Intensity (kgCO₂/ton)</h4>
                        <div className="space-y-2">
                            {supply_chain_carbon.map((item: { material: string; material_carbon_intensity_kg_co2_per_ton: number }, idx: number) => {
                                const maxIntensity = Math.max(...supply_chain_carbon.map((s: { material_carbon_intensity_kg_co2_per_ton: number }) => s.material_carbon_intensity_kg_co2_per_ton));
                                const pct = (item.material_carbon_intensity_kg_co2_per_ton / maxIntensity) * 100;
                                return (
                                    <div key={idx} className="flex items-center gap-3">
                                        <span className="text-xs text-gray-600 w-40 truncate">{item.material}</span>
                                        <div className="flex-1 bg-gray-100 rounded-full h-4">
                                            <div className="h-4 rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-all"
                                                style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-xs font-mono text-gray-700 w-16 text-right">
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
                    <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                            Monthly Emissions vs Target Trajectory
                        </h3>
                        <div className="relative h-56 border border-gray-100 rounded bg-gray-50 p-4">
                            <div className="absolute top-4 left-4 right-4 border-t-2 border-dashed border-gray-300" style={{ top: '10%' }}>
                                <span className="absolute -top-4 right-0 text-[10px] text-gray-400">Baseline: {monthly_progress[0]?.baseline_emissions_tons_co2} t</span>
                            </div>
                            <div className="flex items-end h-full gap-2 pt-8 pb-6">
                                {monthly_progress.map((month: { month: string; actual_emissions_tons_co2: number; target_emissions_tons_co2: number; baseline_emissions_tons_co2: number; on_track: boolean }, idx: number) => {
                                    const maxVal = monthly_progress[0]?.baseline_emissions_tons_co2 || 120;
                                    const actualH = (month.actual_emissions_tons_co2 / maxVal) * 100;
                                    const targetH = (month.target_emissions_tons_co2 / maxVal) * 100;
                                    return (
                                        <div key={idx} className="flex-1 flex flex-col items-center gap-1 relative h-full justify-end">
                                            <div className="absolute w-full border-t-2 border-blue-500"
                                                style={{ bottom: `${targetH}%` }} />
                                            <div
                                                className={`w-full rounded-t ${month.on_track ? 'bg-blue-500' : 'bg-red-400'}`}
                                                style={{ height: `${actualH}%` }}
                                                title={`${month.month}: ${month.actual_emissions_tons_co2} t (target: ${month.target_emissions_tons_co2} t)`}
                                            />
                                            <span className="text-[9px] text-gray-400 -rotate-45 origin-top-left mt-1">
                                                {month.month.split('-')[1]}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex gap-4 mt-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500"></span> On Track</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400"></span> Above Target</span>
                            <span className="flex items-center gap-1"><span className="w-6 border-t-2 border-blue-500"></span> Target Line</span>
                        </div>
                    </div>

                    {/* Monthly Data Table */}
                    <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                            Monthly Reduction Progress
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                                    <tr>
                                        <th className="px-3 py-2">Month</th>
                                        <th className="px-3 py-2">Actual (t CO₂)</th>
                                        <th className="px-3 py-2">Target (t CO₂)</th>
                                        <th className="px-3 py-2">Baseline (t CO₂)</th>
                                        <th className="px-3 py-2">Reduction %</th>
                                        <th className="px-3 py-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthly_progress.map((month: { month: string; actual_emissions_tons_co2: number; target_emissions_tons_co2: number; baseline_emissions_tons_co2: number; reduction_pct: number; on_track: boolean }) => (
                                        <tr key={month.month} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-3 py-2 font-medium text-gray-900">{month.month}</td>
                                            <td className="px-3 py-2 font-mono">{month.actual_emissions_tons_co2}</td>
                                            <td className="px-3 py-2 font-mono text-blue-600">{month.target_emissions_tons_co2}</td>
                                            <td className="px-3 py-2 font-mono text-gray-400">{month.baseline_emissions_tons_co2}</td>
                                            <td className="px-3 py-2 font-bold text-blue-700">{month.reduction_pct}%</td>
                                            <td className="px-3 py-2">
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${month.on_track ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                                                    {month.on_track ? 'ON TRACK' : 'BEHIND'}
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

function KPICard({ label, value, color, subtitle }: { label: string; value: string | number; color: string; subtitle?: string }) {
    return (
        <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
    );
}
