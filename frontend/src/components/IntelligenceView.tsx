import { useState, useEffect } from 'react';
import {
    fetchCommodities, fetchBatteryCost, fetchShapForCpk, fetchThermalForecast,
    fetchRulForecast, fetchCostPrediction, simulateCarbon, fetchDepotComparison,
    fetchAuditLog, exportAuditLogUrl, fetchPendingApprovals, submitApproval, decideApproval,
} from '../api';
import type {
    CommodityPrice, BatteryCostBreakdown, ShapResult, ThermalForecast, RulForecast,
    CostPrediction, CarbonScenario, DepotComparison, AuditEntry, ApprovalRequest,
} from '../api';

type SubTab = 'commodity' | 'explainability' | 'forecast' | 'simulator' | 'operations';

export default function IntelligenceView() {
    const [subTab, setSubTab] = useState<SubTab>('commodity');

    return (
        <div className="mt-12 space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Trust, Forecast & Operations</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Commodity pricing, SHAP explainability, predictive forecasting, what-if scenarios, multi-fleet, audit, and approvals.
                </p>
            </div>

            <div className="border-b border-gray-200">
                <nav className="flex gap-6 overflow-x-auto" role="tablist">
                    {([
                        ['commodity',      'Commodity Feed'],
                        ['explainability', 'Cpk Explainability (SHAP)'],
                        ['forecast',       'Predictive Forecasts'],
                        ['simulator',      'What-If Carbon'],
                        ['operations',     'Multi-Fleet & Approvals'],
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

            {subTab === 'commodity'      && <CommodityPanel />}
            {subTab === 'explainability' && <ExplainabilityPanel />}
            {subTab === 'forecast'       && <ForecastPanel />}
            {subTab === 'simulator'      && <SimulatorPanel />}
            {subTab === 'operations'     && <OperationsPanel />}
        </div>
    );
}

// ─── Commodity Feed Panel ───────────────────────────────────────────────────

function CommodityPanel() {
    const [prices, setPrices] = useState<CommodityPrice[]>([]);
    const [batteryCost, setBatteryCost] = useState<BatteryCostBreakdown | null>(null);
    const [kwh, setKwh] = useState(100);
    const [chemistry, setChemistry] = useState('NMC 811');

    useEffect(() => {
        fetchCommodities().then(d => setPrices(d.prices));
        fetchBatteryCost(kwh, chemistry).then(setBatteryCost);
    }, []);

    const updateCost = () => fetchBatteryCost(kwh, chemistry).then(setBatteryCost);

    return (
        <div className="space-y-6">
            {/* Live prices table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                        BSE / MCX Live Commodity Prices
                    </h3>
                    <span className="text-[10px] text-gray-400 font-mono">Updates hourly</span>
                </div>
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="bg-gray-50/30 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                        <tr>
                            <th className="px-5 py-2.5">Material</th>
                            <th className="px-5 py-2.5">Symbol</th>
                            <th className="px-5 py-2.5">Price (INR/kg)</th>
                            <th className="px-5 py-2.5">24h Change</th>
                            <th className="px-5 py-2.5">Source</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {prices.map(p => (
                            <tr key={p.material} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-5 py-3 font-medium text-gray-800">{p.material}</td>
                                <td className="px-5 py-3 font-mono text-xs text-gray-500">{p.symbol}</td>
                                <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-900">
                                    ₹{p.price_inr_per_kg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-5 py-3">
                                    <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full ${
                                        p.change_pct_24h > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {p.change_pct_24h > 0 ? '+' : ''}{p.change_pct_24h.toFixed(2)}%
                                    </span>
                                </td>
                                <td className="px-5 py-3 text-xs text-gray-500">{p.source}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Battery cost calculator */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                        Live Battery Cost Estimator
                    </h3>
                </div>
                <div className="p-5 space-y-4">
                    <div className="flex items-end gap-4">
                        <div>
                            <label className="text-[11px] uppercase tracking-wider text-gray-400 font-medium block mb-1.5">Capacity (kWh)</label>
                            <input
                                type="number" value={kwh} onChange={e => setKwh(Number(e.target.value))}
                                className="w-32 px-3 py-2 border border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] uppercase tracking-wider text-gray-400 font-medium block mb-1.5">Chemistry</label>
                            <select value={chemistry} onChange={e => setChemistry(e.target.value)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option>NMC 811</option>
                                <option>LFP</option>
                            </select>
                        </div>
                        <button onClick={updateCost}
                            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
                            Recalculate
                        </button>
                    </div>
                    {batteryCost && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-gray-50/80 rounded-xl p-5 text-center">
                                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Raw Material</p>
                                <p className="mt-2 font-mono text-xl font-semibold text-gray-900 tracking-tight">
                                    ₹{batteryCost.raw_material_cost_inr.toLocaleString('en-IN')}
                                </p>
                            </div>
                            <div className="bg-gray-50/80 rounded-xl p-5 text-center">
                                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Processing Margin</p>
                                <p className="mt-2 font-mono text-xl font-semibold text-gray-900 tracking-tight">
                                    ₹{batteryCost.processing_margin_inr.toLocaleString('en-IN')}
                                </p>
                            </div>
                            <div className="bg-gray-900 rounded-xl p-5 text-center">
                                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Total Pack Cost</p>
                                <p className="mt-2 font-mono text-xl font-semibold text-white tracking-tight">
                                    ₹{batteryCost.total_battery_cost_inr.toLocaleString('en-IN')}
                                </p>
                            </div>
                        </div>
                    )}
                    {batteryCost && (
                        <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                            <div className="px-4 py-2 border-b border-gray-100">
                                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Material Breakdown</p>
                            </div>
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-gray-100">
                                    {batteryCost.breakdown.map(b => (
                                        <tr key={b.material} className="hover:bg-white transition-colors">
                                            <td className="px-4 py-2.5 font-medium text-gray-800 text-sm">{b.material}</td>
                                            <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{b.kg_required} kg</td>
                                            <td className="px-4 py-2.5 font-mono text-xs text-gray-500">₹{b.price_inr_per_kg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/kg</td>
                                            <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-900 text-right">
                                                ₹{b.cost_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── SHAP Explainability Panel ──────────────────────────────────────────────

function ExplainabilityPanel() {
    const [shap, setShap] = useState<ShapResult | null>(null);

    useEffect(() => { fetchShapForCpk().then(setShap); }, []);

    if (!shap) return <div className="p-5 text-gray-500 text-sm">Loading SHAP analysis...</div>;

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                        SHAP Parameter Contribution to Cpk
                    </h3>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-gray-50/80 rounded-xl p-5 text-center">
                            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Baseline Cpk</p>
                            <p className="mt-2 font-mono text-xl font-semibold text-gray-900 tracking-tight">
                                {shap.baseline_cpk.toFixed(2)}
                            </p>
                        </div>
                        <div className="bg-gray-900 rounded-xl p-5 text-center">
                            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Current Cpk</p>
                            <p className="mt-2 font-mono text-xl font-semibold text-white tracking-tight">
                                {shap.current_cpk.toFixed(2)}
                            </p>
                        </div>
                        <div className="bg-gray-50/80 rounded-xl p-5 text-center">
                            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Drifting Params</p>
                            <p className="mt-2 font-mono text-xl font-semibold text-gray-900 tracking-tight">
                                {shap.driving_factors.length}
                            </p>
                        </div>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                        {shap.interpretation}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Per-Parameter SHAP Values</h3>
                </div>
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="bg-gray-50/30 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                        <tr>
                            <th className="px-5 py-2.5">Parameter</th>
                            <th className="px-5 py-2.5">Current</th>
                            <th className="px-5 py-2.5">Target</th>
                            <th className="px-5 py-2.5">Distance %</th>
                            <th className="px-5 py-2.5">SHAP</th>
                            <th className="px-5 py-2.5">Drifting</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {shap.all_contributions.map((c, i) => (
                            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-5 py-3 font-medium text-gray-800">{c.parameter}</td>
                                <td className="px-5 py-3 font-mono text-xs text-gray-800">{c.current_value}</td>
                                <td className="px-5 py-3 font-mono text-xs text-gray-500">{c.target_value}</td>
                                <td className="px-5 py-3 font-mono text-xs text-gray-500">{c.distance_from_target_pct}%</td>
                                <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-900">{c.shap_value.toFixed(4)}</td>
                                <td className="px-5 py-3">
                                    <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${c.is_drifting ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                        {c.is_drifting ? 'Yes' : 'No'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Forecast Panel ─────────────────────────────────────────────────────────

function ForecastPanel() {
    const [vehicleId, setVehicleId] = useState('EV-003');
    const [thermal, setThermal] = useState<ThermalForecast | null>(null);
    const [rul, setRul] = useState<RulForecast | null>(null);
    const [cost, setCost] = useState<CostPrediction | null>(null);

    useEffect(() => {
        setThermal(null); setRul(null); setCost(null);
        fetchThermalForecast(vehicleId).then(setThermal);
        fetchRulForecast(vehicleId).then(setRul);
        fetchCostPrediction(vehicleId).then(setCost);
    }, [vehicleId]);

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Select Vehicle</h3>
                </div>
                <div className="p-5 flex items-center gap-3">
                    <label className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Vehicle ID</label>
                    <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {['EV-001','EV-002','EV-003','EV-004','EV-005','EV-006','EV-007','EV-008','EV-009','EV-010'].map(v => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                </div>
            </div>

            {rul && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">365-day SoH Forecast (with confidence band)</h3>
                        <span className="text-xs font-mono text-gray-700">{rul.end_of_life_estimate}</span>
                    </div>
                    <div className="p-5">
                        <ForecastChart rul={rul} />
                        <p className="text-xs text-gray-500 mt-3 leading-relaxed">{rul.warning}</p>
                    </div>
                </div>
            )}

            {thermal && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">7-day Thermal Anomaly Forecast</h3>
                        <span className="text-[10px] font-mono text-gray-400">{thermal.model} · {thermal.confidence} confidence</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50/30 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                                <tr>
                                    <th className="px-5 py-2.5">Day</th>
                                    <th className="px-5 py-2.5">Date</th>
                                    <th className="px-5 py-2.5">Projected Temp (°C)</th>
                                    <th className="px-5 py-2.5">Z-Score</th>
                                    <th className="px-5 py-2.5">Anomaly</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {thermal.predictions.map(p => (
                                    <tr key={p.day_offset} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-3 font-mono text-xs text-gray-800">+{p.day_offset}d</td>
                                        <td className="px-5 py-3 text-xs text-gray-500">{p.date}</td>
                                        <td className="px-5 py-3 font-mono text-xs text-gray-800">{p.projected_temp_c}°C</td>
                                        <td className="px-5 py-3 font-mono text-xs text-gray-500">{p.z_score}</td>
                                        <td className="px-5 py-3">
                                            <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${p.anomaly_likely ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                                {p.anomaly_likely ? 'Likely' : 'Normal'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {cost && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Maintenance Cost Decision (Replace Now vs 6 Months)</h3>
                        <span className="text-xs font-mono font-semibold text-gray-900">{cost.recommendation}</span>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <CostCard label="Replace Now" cost={cost.scenarios.replace_now.cost_inr} risk={cost.scenarios.replace_now.risk} />
                            <CostCard label="Replace in 6 mo" cost={cost.scenarios.replace_in_6_months.cost_inr} risk={cost.scenarios.replace_in_6_months.risk} />
                            <CostCard label="Do Nothing" cost={cost.scenarios.do_nothing.expected_emergency_cost_inr} risk={cost.scenarios.do_nothing.risk} accent />
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">
                            {cost.estimated_savings_inr > 0
                                ? `Following this recommendation saves approximately ₹${cost.estimated_savings_inr.toLocaleString('en-IN')} over the 6-month horizon.`
                                : 'No immediate action required based on current degradation trajectory.'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

function CostCard({ label, cost, risk, accent }: { label: string; cost: number; risk: string; accent?: boolean }) {
    return (
        <div className={`${accent ? 'bg-gray-900' : 'bg-gray-50/80'} rounded-xl p-5`}>
            <p className={`text-[11px] uppercase tracking-wider font-medium ${accent ? 'text-gray-400' : 'text-gray-400'}`}>{label}</p>
            <p className={`mt-2 font-mono text-xl font-semibold tracking-tight ${accent ? 'text-white' : 'text-gray-900'}`}>
                ₹{cost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className={`text-[10px] mt-1.5 leading-tight ${accent ? 'text-gray-400' : 'text-gray-500'}`}>{risk}</p>
        </div>
    );
}

function ForecastChart({ rul }: { rul: RulForecast }) {
    const max = 100;
    const w = 800, h = 180;
    const xStep = w / rul.forecast.length;
    const yScale = (v: number) => h - (v / max) * h;
    const pathLine = rul.forecast.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * xStep} ${yScale(p.soh)}`).join(' ');
    const pathUpper = rul.forecast.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * xStep} ${yScale(p.upper_bound)}`).join(' ');
    const pathLower = rul.forecast.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * xStep} ${yScale(p.lower_bound)}`).join(' ');
    const pathBand = `${pathUpper} ${[...rul.forecast].reverse().map((p, i) => `L ${(rul.forecast.length - 1 - i) * xStep} ${yScale(p.lower_bound)}`).join(' ')} Z`;

    return (
        <svg viewBox={`0 -20 ${w} ${h + 40}`} className="w-full" style={{ height: 200 }}>
            <line x1="0" y1={yScale(80)} x2={w} y2={yScale(80)} stroke="#dc2626" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
            <text x={w - 60} y={yScale(80) - 4} fontSize="10" fill="#dc2626" fontFamily="monospace">80% (EoL)</text>
            <path d={pathBand} fill="#1c1917" opacity="0.08" />
            <path d={pathLine} fill="none" stroke="#1c1917" strokeWidth="2" />
            <path d={pathUpper} fill="none" stroke="#1c1917" strokeWidth="1" strokeDasharray="2 3" opacity="0.3" />
            <path d={pathLower} fill="none" stroke="#1c1917" strokeWidth="1" strokeDasharray="2 3" opacity="0.3" />
        </svg>
    );
}

// ─── What-If Carbon Simulator ───────────────────────────────────────────────

function SimulatorPanel() {
    const [ev, setEv] = useState(80);
    const [renewable, setRenewable] = useState(60);
    const [scope3, setScope3] = useState(25);
    const [result, setResult] = useState<CarbonScenario | null>(null);
    const [loading, setLoading] = useState(false);

    const run = async () => {
        setLoading(true);
        try { setResult(await simulateCarbon(ev, renewable, scope3)); } finally { setLoading(false); }
    };

    useEffect(() => { run(); }, []);

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Scenario Sliders</h3>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
                    <Slider label="EV Fleet Penetration" value={ev} onChange={setEv} min={0} max={100} unit="%" />
                    <Slider label="Renewable Energy" value={renewable} onChange={setRenewable} min={0} max={100} unit="%" />
                    <Slider label="Scope 3 Reduction" value={scope3} onChange={setScope3} min={0} max={100} unit="%" />
                </div>
                <div className="px-5 pb-5">
                    <button onClick={run} disabled={loading}
                        className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:bg-gray-400 transition-colors">
                        {loading ? 'Recalculating...' : 'Run Simulation'}
                    </button>
                </div>
            </div>

            {result && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Simulated Outcome</h3>
                    </div>
                    <div className="p-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                            <div className="bg-gray-50/80 rounded-xl p-5 text-center">
                                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Total Emissions</p>
                                <p className="mt-2 font-mono text-xl font-semibold text-gray-900 tracking-tight">
                                    {result.simulated.total_tons_co2.toFixed(0)} t
                                </p>
                                <p className="text-[10px] text-gray-500 mt-1">
                                    was {result.baseline.total_tons_co2.toFixed(0)} t
                                </p>
                            </div>
                            <div className="bg-gray-50/80 rounded-xl p-5 text-center">
                                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Reduction</p>
                                <p className="mt-2 font-mono text-xl font-semibold text-gray-900 tracking-tight">
                                    {result.simulated.reduction_vs_baseline_pct.toFixed(1)}%
                                </p>
                            </div>
                            <div className="bg-gray-900 rounded-xl p-5 text-center">
                                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Years to Net Zero</p>
                                <p className="mt-2 font-mono text-xl font-semibold text-white tracking-tight">
                                    {result.simulated.years_to_net_zero}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-1">
                                    was {result.baseline.years_to_net_zero}
                                </p>
                            </div>
                            <div className="bg-gray-50/80 rounded-xl p-5 text-center">
                                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Scope 3</p>
                                <p className="mt-2 font-mono text-xl font-semibold text-gray-900 tracking-tight">
                                    {result.simulated.scope_3_tons.toFixed(0)} t
                                </p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <ScopeBar label="Scope 1 (Direct)" value={result.simulated.scope_1_tons} baseline={result.baseline.scope_1_tons} max={result.baseline.scope_1_tons} />
                            <ScopeBar label="Scope 2 (Energy)" value={result.simulated.scope_2_tons} baseline={result.baseline.scope_2_tons} max={result.baseline.scope_2_tons} />
                            <ScopeBar label="Scope 3 (Value Chain)" value={result.simulated.scope_3_tons} baseline={result.baseline.scope_3_tons} max={result.baseline.scope_3_tons} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Slider({ label, value, onChange, min, max, unit }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; unit: string }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">{label}</label>
                <span className="font-mono text-sm font-semibold text-gray-900">{value}{unit}</span>
            </div>
            <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
                className="w-full accent-gray-900" />
        </div>
    );
}

function ScopeBar({ label, value, baseline, max }: { label: string; value: number; baseline: number; max: number }) {
    const v = Math.max(0.001, max);
    const delta = ((value - baseline) / baseline) * 100;
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">{label}</span>
                <span className="font-mono text-xs">
                    <span className="text-gray-900 font-semibold">{value.toFixed(1)} t</span>
                    <span className="text-gray-400 ml-2">was {baseline.toFixed(1)}</span>
                    <span className={`ml-2 ${delta < 0 ? 'text-gray-700' : 'text-gray-500'}`}>({delta > 0 ? '+' : ''}{delta.toFixed(1)}%)</span>
                </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="h-2 rounded-full bg-gray-800 transition-all" style={{ width: `${(value / v) * 100}%`, opacity: value < baseline ? 1 : 0.4 }} />
            </div>
        </div>
    );
}

// ─── Operations: Depots, Audit Log, Approvals ──────────────────────────────

function OperationsPanel() {
    const [depots, setDepots] = useState<DepotComparison | null>(null);
    const [audit, setAudit] = useState<{ can_view: boolean; entries: AuditEntry[] }>({ can_view: true, entries: [] });
    const [pending, setPending] = useState<ApprovalRequest[]>([]);
    const decision = { decided_by: 'supervisor@evplatform.io', role: 'maintenance', reason: '' };

    const reload = () => {
        fetchDepotComparison().then(setDepots);
        fetchAuditLog('admin').then(setAudit);
        fetchPendingApprovals('maintenance').then(d => setPending(d.pending));
    };

    useEffect(reload, []);

    const handleSubmitApproval = () => {
        submitApproval({
            task_id: `TASK-${Date.now()}`,
            vehicle_id: 'EV-003',
            task_type: 'battery replacement',
            cost_inr: 850000,
            reason: 'SoH dropped below 80%, thermal anomaly flagged',
            requested_by: 'maintenance-system',
        }).then(reload);
    };

    const handleDecide = (id: string, approved: boolean) => {
        decideApproval(id, approved, decision.decided_by, decision.role, decision.reason).then(reload);
    };

    return (
        <div className="space-y-6">
            {/* Depot comparison */}
            {depots && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                            Multi-Fleet Depot Comparison ({depots.summary.total_vehicles} vehicles)
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="bg-gray-50/30 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                                <tr>
                                    <th className="px-5 py-2.5">Depot</th>
                                    <th className="px-5 py-2.5">City</th>
                                    <th className="px-5 py-2.5">Use</th>
                                    <th className="px-5 py-2.5">Vehicles</th>
                                    <th className="px-5 py-2.5">Avg SoH</th>
                                    <th className="px-5 py-2.5">Anomalies</th>
                                    <th className="px-5 py-2.5">Monthly Cost (INR)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {depots.depots.map(d => (
                                    <tr key={d.depot_id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-3 font-medium text-gray-800">{d.name}</td>
                                        <td className="px-5 py-3 text-xs text-gray-500">{d.city}</td>
                                        <td className="px-5 py-3 text-xs text-gray-500">{d.primary_use}</td>
                                        <td className="px-5 py-3 font-mono text-xs text-gray-800">{d.vehicle_count}</td>
                                        <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-900">{d.avg_soh}%</td>
                                        <td className="px-5 py-3">
                                            <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${d.active_anomalies > 2 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                                {d.active_anomalies}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-xs text-gray-800">₹{d.monthly_cost_inr.toLocaleString('en-IN')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Approval workflow */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Maintenance Approval Workflow</h3>
                    <button onClick={handleSubmitApproval}
                        className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800">
                        Submit Sample Task (₹8.5L)
                    </button>
                </div>
                <div className="divide-y divide-gray-50">
                    {pending.length === 0 ? (
                        <div className="px-5 py-8 text-center text-sm text-gray-500">No pending approvals. Submit a sample task above.</div>
                    ) : pending.map(a => (
                        <div key={a.request_id} className="px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-xs text-gray-500">{a.request_id}</span>
                                        <span className="text-xs text-gray-400">·</span>
                                        <span className="font-mono text-xs text-gray-800">{a.vehicle_id}</span>
                                        <span className="text-xs text-gray-400">·</span>
                                        <span className="text-xs text-gray-500">{a.task_type}</span>
                                    </div>
                                    <p className="text-sm text-gray-700 leading-relaxed">{a.reason}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="font-mono text-sm font-semibold text-gray-900">₹{a.estimated_cost_inr.toLocaleString('en-IN')}</p>
                                    <div className="flex gap-1.5 mt-2">
                                        <button onClick={() => handleDecide(a.request_id, true)}
                                            className="px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded uppercase tracking-wider">Approve</button>
                                        <button onClick={() => handleDecide(a.request_id, false)}
                                            className="px-2.5 py-1 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded uppercase tracking-wider hover:bg-gray-50">Reject</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Audit log */}
            {audit.can_view && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Audit Log (Role-Gated)</h3>
                        <a href={exportAuditLogUrl('admin')} target="_blank" rel="noreferrer"
                            className="text-[11px] uppercase tracking-wider text-gray-700 font-medium hover:text-gray-900 underline">
                            Open Print Report
                        </a>
                    </div>
                    <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                        {audit.entries.length === 0 ? (
                            <div className="px-5 py-8 text-center text-sm text-gray-500">No audit entries yet. Submit an approval above to generate one.</div>
                        ) : audit.entries.map(e => (
                            <div key={e.entry_id} className="px-5 py-3 hover:bg-gray-50/50 transition-colors">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-mono text-[11px] text-gray-400">{e.timestamp}</span>
                                    <span className="text-[11px] text-gray-400">·</span>
                                    <span className="text-[11px] font-medium text-gray-700">{e.user}</span>
                                    <span className="text-[11px] uppercase tracking-wider text-gray-400">{e.role}</span>
                                </div>
                                <p className="text-sm text-gray-700">
                                    <span className="font-medium text-gray-900">{e.action}</span> on <span className="font-mono text-xs">{e.resource}</span>
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
