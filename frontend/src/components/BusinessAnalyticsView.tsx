import { useEffect, useState } from 'react';
import { fetchCohort, fetchTcoTrend, fetchVendorScorecard, fetchCarbonCredits } from '../api';

type SubTab = 'cohort' | 'tco' | 'scorecard' | 'credits';

interface Cohort {
    cohort_year: number;
    label: string;
    vehicle_count: number;
    avg_soh: number;
    avg_degradation_rate: number;
    interpretation: string;
}
interface CohortResponse { cohorts: Cohort[]; insight: string }

interface TcoPoint { month: string; cost_per_km_inr: number; delta_from_baseline_pct: number }
interface TcoResponse {
    history: TcoPoint[];
    current_cost_per_km_inr: number;
    trend_pct_12mo: number;
    interpretation: string;
}

interface Vendor {
    supplier: string;
    country: string;
    tier: number;
    material: string;
    batches_inspected: number;
    defect_rate_ppm: number;
    avg_quality_score: number;
    esg_score: number;
    lead_time_days: number;
    composite_risk: number;
    composite_score: number;
    grade: string;
    recommendation: string;
}
interface ScorecardResponse {
    quarter: string;
    vendors: Vendor[];
    summary: { total_suppliers: number; grade_a_count: number; grade_d_count: number; avg_score: number };
}

interface CreditResponse {
    fleet_id: string;
    avoided_emissions_tons: number;
    offset_credits_purchased_tons: number;
    net_tradable_credits_tons: number;
    valuation: { conservative_inr: number; market_inr: number; premium_inr: number };
    market_data: { price_low_inr_per_ton: number; price_mid_inr_per_ton: number; price_high_inr_per_ton: number; source: string };
    equivalent_impact: { passenger_cars_off_road_1yr: number; homes_electricity_1yr: number; flights_delhi_mumbai: number };
    recommendation: string;
}

export default function BusinessAnalyticsView() {
    const [subTab, setSubTab] = useState<SubTab>('cohort');

    return (
        <div className="mt-12 space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Business Analytics</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Vehicle cohorts, TCO trends, vendor scorecards, and carbon credit market valuation.
                </p>
            </div>

            <div className="border-b border-gray-200">
                <nav className="flex gap-6 overflow-x-auto" role="tablist">
                    {([
                        ['cohort',     'Fleet Cohorts'],
                        ['tco',        'TCO Trend'],
                        ['scorecard',  'Vendor Scorecard'],
                        ['credits',    'Carbon Credits'],
                    ] as [SubTab, string][]).map(([key, label]) => (
                        <button
                            key={key}
                            role="tab"
                            aria-selected={subTab === key}
                            onClick={() => setSubTab(key)}
                            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                subTab === key
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </nav>
            </div>

            {subTab === 'cohort'    && <CohortPanel />}
            {subTab === 'tco'       && <TcoPanel />}
            {subTab === 'scorecard' && <ScorecardPanel />}
            {subTab === 'credits'   && <CreditsPanel />}
        </div>
    );
}

function CohortPanel() {
    const [data, setData] = useState<CohortResponse | null>(null);
    useEffect(() => { fetchCohort().then(setData).catch(() => {}); }, []);
    if (!data) return <div className="p-5 text-sm text-gray-500">Loading cohort data...</div>;

    const maxSoH = Math.max(...data.cohorts.map(c => c.avg_soh), 100);

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                        Battery Health by Vehicle Age Cohort
                    </h3>
                </div>
                <div className="p-5 space-y-4">
                    {data.cohorts.map(c => (
                        <div key={c.cohort_year}>
                            <div className="flex items-center justify-between mb-1.5">
                                <div>
                                    <span className="text-sm font-medium text-gray-900">{c.label}</span>
                                    <span className="text-[11px] text-gray-400 ml-2">{c.vehicle_count} vehicles</span>
                                </div>
                                <div className="font-mono text-xs">
                                    <span className="text-gray-900 font-semibold">{c.avg_soh}%</span>
                                    <span className="text-gray-400 ml-3">deg {c.avg_degradation_rate.toFixed(4)}/d</span>
                                </div>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3">
                                <div
                                    className="h-3 rounded-full bg-gray-800 transition-all"
                                    style={{ width: `${(c.avg_soh / maxSoH) * 100}%`, opacity: c.avg_soh < 85 ? 1 : 0.6 }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed">{data.insight}</p>
            </div>
        </div>
    );
}

function TcoPanel() {
    const [data, setData] = useState<TcoResponse | null>(null);
    useEffect(() => { fetchTcoTrend(12).then(setData).catch(() => {}); }, []);
    if (!data) return <div className="p-5 text-sm text-gray-500">Loading TCO trend...</div>;

    const w = 800;
    const h = 200;
    const xStep = data.history.length > 1 ? w / (data.history.length - 1) : 0;
    const maxCost = Math.max(...data.history.map(p => p.cost_per_km_inr)) * 1.05;
    const minCost = Math.min(...data.history.map(p => p.cost_per_km_inr)) * 0.95;
    const yScale = (v: number) => h - ((v - minCost) / (maxCost - minCost)) * h;
    const path = data.history.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * xStep} ${yScale(p.cost_per_km_inr)}`).join(' ');

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                        Total Cost of Ownership per km — 12-month trend
                    </h3>
                    <span className={`text-[11px] uppercase tracking-wider font-mono font-semibold ${data.trend_pct_12mo < 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {data.trend_pct_12mo > 0 ? '+' : ''}{data.trend_pct_12mo}%
                    </span>
                </div>
                <div className="p-5">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-gray-50/80 rounded-xl p-5 text-center">
                            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Current TCO</p>
                            <p className="mt-2 font-mono text-xl font-semibold text-gray-900 tracking-tight">
                                ₹{data.current_cost_per_km_inr.toFixed(2)}/km
                            </p>
                        </div>
                        <div className="bg-gray-50/80 rounded-xl p-5 text-center">
                            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">12-month change</p>
                            <p className={`mt-2 font-mono text-xl font-semibold tracking-tight ${data.trend_pct_12mo < 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                {data.trend_pct_12mo > 0 ? '+' : ''}{data.trend_pct_12mo}%
                            </p>
                        </div>
                    </div>
                    <svg viewBox={`0 -10 ${w} ${h + 30}`} className="w-full" style={{ height: 230 }}>
                        <path d={path} fill="none" stroke="#1c1917" strokeWidth="2" />
                        {data.history.map((p, i) => (
                            <circle key={i} cx={i * xStep} cy={yScale(p.cost_per_km_inr)} r="3" fill="#1c1917" />
                        ))}
                        <text x={4} y={h + 18} fontSize="10" fill="#a8a29e" fontFamily="monospace">
                            {data.history[0]?.month}
                        </text>
                        <text x={w - 50} y={h + 18} fontSize="10" fill="#a8a29e" fontFamily="monospace">
                            {data.history[data.history.length - 1]?.month}
                        </text>
                    </svg>
                    <p className="text-xs text-gray-500 mt-3 leading-relaxed">{data.interpretation}</p>
                </div>
            </div>
        </div>
    );
}

function ScorecardPanel() {
    const [data, setData] = useState<ScorecardResponse | null>(null);
    useEffect(() => { fetchVendorScorecard().then(setData).catch(() => {}); }, []);
    if (!data) return <div className="p-5 text-sm text-gray-500">Loading vendor scorecard...</div>;

    const GRADE_COLORS: Record<string, string> = {
        A: 'bg-gray-900 text-white',
        B: 'bg-gray-100 text-gray-900',
        C: 'bg-gray-200 text-gray-700',
        D: 'bg-red-50 text-red-700 border border-red-200',
    };

    return (
        <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50/80 rounded-xl p-5 text-center">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Quarter</p>
                    <p className="mt-2 font-mono text-lg font-semibold text-gray-900 tracking-tight">{data.quarter}</p>
                </div>
                <div className="bg-gray-50/80 rounded-xl p-5 text-center">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Suppliers</p>
                    <p className="mt-2 font-mono text-xl font-semibold text-gray-900 tracking-tight">{data.summary.total_suppliers}</p>
                </div>
                <div className="bg-gray-50/80 rounded-xl p-5 text-center">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">A-Grade</p>
                    <p className="mt-2 font-mono text-xl font-semibold text-gray-900 tracking-tight">{data.summary.grade_a_count}</p>
                </div>
                <div className="bg-gray-50/80 rounded-xl p-5 text-center">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">D-Grade (Action)</p>
                    <p className="mt-2 font-mono text-xl font-semibold text-red-600 tracking-tight">{data.summary.grade_d_count}</p>
                </div>
            </div>

            {/* Scorecard table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="bg-gray-50/30 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                            <tr>
                                <th className="px-5 py-2.5">Grade</th>
                                <th className="px-5 py-2.5">Supplier</th>
                                <th className="px-5 py-2.5">Tier</th>
                                <th className="px-5 py-2.5">Material</th>
                                <th className="px-5 py-2.5">Country</th>
                                <th className="px-5 py-2.5">Quality</th>
                                <th className="px-5 py-2.5">ESG</th>
                                <th className="px-5 py-2.5">Lead</th>
                                <th className="px-5 py-2.5">Risk</th>
                                <th className="px-5 py-2.5">Score</th>
                                <th className="px-5 py-2.5">Recommendation</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {data.vendors.map((v, i) => (
                                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-5 py-3">
                                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-mono font-bold ${GRADE_COLORS[v.grade]}`}>
                                            {v.grade}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 font-medium text-gray-900 text-xs">{v.supplier}</td>
                                    <td className="px-5 py-3 font-mono text-xs text-gray-500">T{v.tier}</td>
                                    <td className="px-5 py-3 text-xs text-gray-500">{v.material}</td>
                                    <td className="px-5 py-3 text-xs text-gray-500">{v.country}</td>
                                    <td className="px-5 py-3 font-mono text-xs text-gray-800">{v.avg_quality_score}</td>
                                    <td className="px-5 py-3 font-mono text-xs text-gray-800">{v.esg_score}</td>
                                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{v.lead_time_days}d</td>
                                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{v.composite_risk}</td>
                                    <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-900">{v.composite_score}</td>
                                    <td className="px-5 py-3 text-[11px] text-gray-600 max-w-xs">{v.recommendation}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function CreditsPanel() {
    const [data, setData] = useState<CreditResponse | null>(null);
    useEffect(() => { fetchCarbonCredits().then(setData).catch(() => {}); }, []);
    if (!data) return <div className="p-5 text-sm text-gray-500">Loading carbon credit market data...</div>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-gray-50/80 rounded-xl p-5 text-center">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Avoided Emissions</p>
                    <p className="mt-2 font-mono text-xl font-semibold text-gray-900 tracking-tight">
                        {data.avoided_emissions_tons} t
                    </p>
                </div>
                <div className="bg-gray-50/80 rounded-xl p-5 text-center">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Already Purchased</p>
                    <p className="mt-2 font-mono text-xl font-semibold text-gray-900 tracking-tight">
                        {data.offset_credits_purchased_tons} t
                    </p>
                </div>
                <div className="bg-gray-900 rounded-xl p-5 text-center">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Net Tradable</p>
                    <p className="mt-2 font-mono text-xl font-semibold text-white tracking-tight">
                        {data.net_tradable_credits_tons} t
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                        Market Valuation (Indian Carbon Market)
                    </h3>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-gray-50/30 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                        <tr>
                            <th className="px-5 py-2.5 text-left">Scenario</th>
                            <th className="px-5 py-2.5 text-right">Price (₹/tCO₂)</th>
                            <th className="px-5 py-2.5 text-right">Value (₹)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        <tr className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-5 py-3 font-medium text-gray-900">Conservative (compliance floor)</td>
                            <td className="px-5 py-3 text-right font-mono text-xs text-gray-500">₹{data.market_data.price_low_inr_per_ton}</td>
                            <td className="px-5 py-3 text-right font-mono text-xs font-semibold text-gray-900">₹{data.valuation.conservative_inr.toLocaleString('en-IN')}</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50 transition-colors bg-gray-50/30">
                            <td className="px-5 py-3 font-medium text-gray-900">Market (voluntary average)</td>
                            <td className="px-5 py-3 text-right font-mono text-xs text-gray-500">₹{data.market_data.price_mid_inr_per_ton}</td>
                            <td className="px-5 py-3 text-right font-mono text-xs font-semibold text-gray-900">₹{data.valuation.market_inr.toLocaleString('en-IN')}</td>
                        </tr>
                        <tr className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-5 py-3 font-medium text-gray-900">Premium (removal credits)</td>
                            <td className="px-5 py-3 text-right font-mono text-xs text-gray-500">₹{data.market_data.price_high_inr_per_ton}</td>
                            <td className="px-5 py-3 text-right font-mono text-xs font-semibold text-gray-900">₹{data.valuation.premium_inr.toLocaleString('en-IN')}</td>
                        </tr>
                    </tbody>
                </table>
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
                    <p className="text-[11px] text-gray-400 font-mono uppercase tracking-wider">{data.market_data.source}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                        Equivalent Environmental Impact
                    </h3>
                </div>
                <div className="grid grid-cols-3 divide-x divide-gray-100">
                    <div className="p-5 text-center">
                        <p className="font-mono text-2xl font-bold text-gray-900">{data.equivalent_impact.passenger_cars_off_road_1yr.toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Passenger cars off-road for 1 year</p>
                    </div>
                    <div className="p-5 text-center">
                        <p className="font-mono text-2xl font-bold text-gray-900">{data.equivalent_impact.homes_electricity_1yr.toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Homes' annual electricity</p>
                    </div>
                    <div className="p-5 text-center">
                        <p className="font-mono text-2xl font-bold text-gray-900">{data.equivalent_impact.flights_delhi_mumbai.toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Delhi-Mumbai flights</p>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-gray-900 rounded-xl">
                <p className="text-sm text-white leading-relaxed">{data.recommendation}</p>
            </div>
        </div>
    );
}
