import { useState, useEffect } from 'react';
import { fetchQualityIntelligence } from './api';
import type { QualityIntelligenceResponse } from './api';

const SEVERITY_BADGE: Record<string, string> = {
    normal: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    critical: 'bg-red-100 text-red-800',
};

export default function QualityDashboard() {
    const [data, setData] = useState<QualityIntelligenceResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'spc' | 'inspections' | 'predictions'>('overview');

    useEffect(() => {
        fetchQualityIntelligence()
            .then(setData)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                <span className="ml-3 text-gray-500">Analyzing manufacturing quality data...</span>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700">Failed to load quality intelligence: {error}</p>
            </div>
        );
    }

    const { process_parameters, inspection_records, defect_predictions, spc_charts, kpis, supplier_quality_matrix } = data;
    const driftingParams = process_parameters.filter(p => p.drift_detected);

    return (
        <div className="mt-12 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Manufacturing Quality Intelligence</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        SPC Drift Detection • Defect Classification • Supplier Quality Correlation
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${driftingParams.length > 0 ? 'bg-red-100 text-red-800 animate-pulse' : 'bg-green-100 text-green-800'}`}>
                        {driftingParams.length > 0 ? `${driftingParams.length} DRIFT ALERTS` : 'ALL PARAMETERS STABLE'}
                    </span>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                <KPICard label="Overall Yield" value={`${kpis.overall_yield_pct}%`} color="text-green-700" />
                <KPICard label="First Pass Yield" value={`${kpis.first_pass_yield_pct}%`} color="text-green-600" />
                <KPICard label="Defect Rate" value={`${kpis.defect_rate_ppm.toFixed(0)} PPM`} color="text-orange-600" />
                <KPICard label="Scrap Cost" value={`$${kpis.scrap_cost_usd.toLocaleString()}`} color="text-red-600" />
                <KPICard label="Supplier QI" value={`${kpis.supplier_quality_index}`} color="text-blue-700" />
                <KPICard label="Process Cpk" value={`${kpis.process_capability_cpk}`} color="text-purple-700" />
                <KPICard label="Drift Alerts" value={`${kpis.drift_alerts_active}`} color="text-red-600" />
                <KPICard label="Batches at Risk" value={`${kpis.batches_at_risk}`} color="text-amber-600" />
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-6">
                    {(['overview', 'spc', 'inspections', 'predictions'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === tab
                                    ? 'border-purple-600 text-purple-700'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {tab === 'spc' ? 'SPC Charts' : tab}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Process Parameters Table */}
                    <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                            Process Parameters ({process_parameters.length}) — {driftingParams.length} with drift
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                                    <tr>
                                        <th className="px-3 py-2">Parameter</th>
                                        <th className="px-3 py-2">Stage</th>
                                        <th className="px-3 py-2">Current</th>
                                        <th className="px-3 py-2">Target</th>
                                        <th className="px-3 py-2">UCL / LCL</th>
                                        <th className="px-3 py-2">EWMA</th>
                                        <th className="px-3 py-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {process_parameters.map((param, idx) => (
                                        <tr key={idx} className={`border-b hover:bg-gray-50 ${param.drift_detected ? 'bg-red-50' : 'bg-white'}`}>
                                            <td className="px-3 py-2 font-medium text-gray-900">{param.parameter_name}</td>
                                            <td className="px-3 py-2 text-xs">{param.stage}</td>
                                            <td className="px-3 py-2 font-mono text-xs">
                                                {param.current_value} {param.unit}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-xs">{param.target_value}</td>
                                            <td className="px-3 py-2 font-mono text-xs">{param.ucl} / {param.lcl}</td>
                                            <td className="px-3 py-2 font-mono text-xs">{param.ewma_value}</td>
                                            <td className="px-3 py-2">
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded capitalize ${SEVERITY_BADGE[param.drift_severity]}`}>
                                                    {param.drift_severity}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Supplier Quality Matrix */}
                    <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                            Supplier Quality Matrix
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                                    <tr>
                                        <th className="px-3 py-2">Supplier</th>
                                        <th className="px-3 py-2">Batches</th>
                                        <th className="px-3 py-2">Defects</th>
                                        <th className="px-3 py-2">Defect Rate (PPM)</th>
                                        <th className="px-3 py-2">Pass Rate</th>
                                        <th className="px-3 py-2">Quality Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {supplier_quality_matrix.map((supplier: any, idx: number) => (
                                        <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-3 py-2 font-medium text-gray-900">{supplier.supplier}</td>
                                            <td className="px-3 py-2">{supplier.total_batches}</td>
                                            <td className="px-3 py-2">{supplier.total_defects}</td>
                                            <td className="px-3 py-2">
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${supplier.defect_rate_ppm > 15000 ? 'bg-red-100 text-red-800' :
                                                        supplier.defect_rate_ppm > 8000 ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-green-100 text-green-800'
                                                    }`}>{supplier.defect_rate_ppm}</span>
                                            </td>
                                            <td className="px-3 py-2">{supplier.pass_rate_pct}%</td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 bg-gray-200 rounded-full h-2">
                                                        <div className={`h-2 rounded-full ${supplier.avg_quality_score > 90 ? 'bg-green-500' : supplier.avg_quality_score > 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                            style={{ width: `${supplier.avg_quality_score}%` }} />
                                                    </div>
                                                    <span className="text-xs">{supplier.avg_quality_score}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'spc' && (
                <div className="space-y-6">
                    {Object.entries(spc_charts).map(([chartName, points]) => (
                        <div key={chartName} className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">{chartName}</h3>
                            <div className="relative h-48 border border-gray-100 rounded bg-gray-50 p-4">
                                {/* Control limits visualization */}
                                <div className="absolute inset-x-4 top-4 flex justify-between text-[10px] text-red-400">
                                    <span>UCL: {(points as any[])[0]?.ucl}</span>
                                </div>
                                <div className="absolute inset-x-4 bottom-4 flex justify-between text-[10px] text-red-400">
                                    <span>LCL: {(points as any[])[0]?.lcl}</span>
                                </div>
                                <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between text-[10px] text-green-600">
                                    <span>CL: {(points as any[])[0]?.center_line}</span>
                                </div>
                                {/* Data points as bars */}
                                <div className="flex items-end h-full gap-[2px] pt-6 pb-6">
                                    {(points as any[]).map((point: any, idx: number) => {
                                        const range = point.ucl - point.lcl;
                                        const normalized = Math.min(Math.max((point.value - point.lcl) / range, 0), 1);
                                        return (
                                            <div
                                                key={idx}
                                                className={`flex-1 rounded-t ${point.out_of_control ? 'bg-red-500' : 'bg-purple-400'}`}
                                                style={{ height: `${normalized * 100}%` }}
                                                title={`${point.timestamp}: ${point.value} ${point.out_of_control ? '(OUT OF CONTROL)' : ''}`}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-400"></span> In Control</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500"></span> Out of Control</span>
                                <span>{(points as any[]).filter((p: any) => p.out_of_control).length} violations detected</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'inspections' && (
                <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                        Incoming Inspection Records ({inspection_records.length} batches)
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                                <tr>
                                    <th className="px-3 py-2">Batch</th>
                                    <th className="px-3 py-2">Supplier</th>
                                    <th className="px-3 py-2">Material</th>
                                    <th className="px-3 py-2">Date</th>
                                    <th className="px-3 py-2">Samples</th>
                                    <th className="px-3 py-2">Defects</th>
                                    <th className="px-3 py-2">PPM</th>
                                    <th className="px-3 py-2">Result</th>
                                    <th className="px-3 py-2">Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inspection_records.map((record) => (
                                    <tr key={record.batch_id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-3 py-2 font-mono text-xs">{record.batch_id}</td>
                                        <td className="px-3 py-2 font-medium text-gray-900 text-xs">{record.supplier}</td>
                                        <td className="px-3 py-2 text-xs">{record.material}</td>
                                        <td className="px-3 py-2 text-xs">{record.inspection_date}</td>
                                        <td className="px-3 py-2">{record.sample_size}</td>
                                        <td className="px-3 py-2">{record.defects_found}</td>
                                        <td className="px-3 py-2">
                                            <span className={`px-2 py-0.5 text-xs rounded ${record.defect_rate_ppm > 10000 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                                {record.defect_rate_ppm.toFixed(0)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`px-2 py-0.5 text-xs font-bold rounded ${record.pass_fail === 'PASS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {record.pass_fail}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs">{record.quality_score}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'predictions' && (
                <div className="space-y-4">
                    <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                            Defect Predictions ({defect_predictions.length} active)
                        </h3>
                        <div className="grid gap-4">
                            {defect_predictions.map((pred, idx) => (
                                <div key={idx} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono text-xs text-gray-500">{pred.batch_id}</span>
                                                <span className="text-xs text-gray-400">•</span>
                                                <span className="text-xs text-gray-600">{pred.stage}</span>
                                            </div>
                                            <p className="font-semibold text-gray-800">{pred.predicted_defect_type}</p>
                                            <div className="mt-2 space-y-1">
                                                {pred.risk_factors.map((factor, fIdx) => (
                                                    <p key={fIdx} className="text-xs text-red-600 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                                        {factor}
                                                    </p>
                                                ))}
                                            </div>
                                            <p className="mt-2 text-xs text-blue-700 font-medium">
                                                Action: {pred.recommended_action}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className={`px-3 py-1 rounded-full text-sm font-bold ${pred.confidence > 0.85 ? 'bg-red-100 text-red-800' :
                                                    pred.confidence > 0.70 ? 'bg-orange-100 text-orange-800' :
                                                        'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {(pred.confidence * 100).toFixed(1)}%
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1">confidence</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function KPICard({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
        </div>
    );
}
