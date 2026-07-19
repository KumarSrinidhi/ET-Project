import { useState, useEffect } from 'react';
import { fetchQualityIntelligence } from './api';
import type { QualityIntelligenceResponse } from './api';
import DashboardShell from './components/DashboardShell';
import { TopFactorsCard, InlineShapWaterfall } from './components/ShapExplainability';

interface SPCChartPoint {
  value: number;
  ucl: number;
  lcl: number;
  center_line: number;
  out_of_control: boolean;
  timestamp: string;
}

const SEVERITY_BADGE: Record<string, string> = {
    normal: 'bg-gray-100 text-gray-600',
    warning: 'bg-gray-100 text-gray-600',
    critical: 'bg-red-50 text-red-600',
};

export default function QualityDashboard({ selectedDepotId }: { selectedDepotId: string | null }) {
    const [data, setData] = useState<QualityIntelligenceResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'spc' | 'inspections' | 'predictions'>('overview');

    useEffect(() => {
        setLoading(true);
        fetchQualityIntelligence(selectedDepotId)
            .then(setData)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [selectedDepotId]);

    return (
      <DashboardShell loading={loading} error={error} loadingMessage="Analyzing manufacturing quality data...">
        {data && <QualityContent data={data} activeTab={activeTab} setActiveTab={setActiveTab} />}
      </DashboardShell>
    );
}

function QualityContent({ data, activeTab, setActiveTab }: {
  data: QualityIntelligenceResponse;
  activeTab: 'overview' | 'spc' | 'inspections' | 'predictions';
  setActiveTab: (tab: 'overview' | 'spc' | 'inspections' | 'predictions') => void;
}) {
    const { process_parameters, inspection_records, defect_predictions, spc_charts, kpis, supplier_quality_matrix } = data;
    const driftingParams = process_parameters.filter(p => p.drift_detected);
    const activeBatchId = defect_predictions.length > 0 ? defect_predictions[0].batch_id.toLowerCase() : 'batch-501';

    return (
        <div className="mt-12 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Manufacturing Quality Intelligence</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        SPC Drift Detection - Defect Classification - Supplier Quality Correlation
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full ${driftingParams.length > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                        {driftingParams.length > 0 ? `${driftingParams.length} DRIFT ALERTS` : 'ALL PARAMETERS STABLE'}
                    </span>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                <KPICard label="Overall Yield" value={`${kpis.overall_yield_pct}%`} />
                <KPICard label="First Pass Yield" value={`${kpis.first_pass_yield_pct}%`} />
                <KPICard label="Defect Rate" value={`${kpis.defect_rate_ppm.toFixed(0)} PPM`} />
                <KPICard label="Scrap Cost" value={`₹${kpis.scrap_cost_inr.toLocaleString('en-IN')}`} critical={kpis.scrap_cost_inr > 0} />
                <KPICard label="Supplier QI" value={`${kpis.supplier_quality_index}`} />
                <KPICard label="Process Cpk" value={`${kpis.process_capability_cpk}`} subtitle={kpis.process_capability_cpk < 1.0 ? 'Cpk &lt; 1.00 — significant variation. Review process parameters.' : undefined} />
                <KPICard label="Drift Alerts" value={`${kpis.drift_alerts_active}`} critical={kpis.drift_alerts_active > 0} />
                <KPICard label="Batches at Risk" value={`${kpis.batches_at_risk}`} critical={kpis.batches_at_risk > 0} />
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-6" role="tablist" aria-label="Quality Dashboard Sections">
                    {(['overview', 'spc', 'inspections', 'predictions'] as const).map(tab => (
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
                            {tab === 'spc' ? 'SPC Charts' : tab}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* SHAP Explainability for Drifts */}
                    {driftingParams.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-1">
                                <TopFactorsCard batchId={activeBatchId} />
                            </div>
                            <div className="md:col-span-2">
                                <InlineShapWaterfall batchId={activeBatchId} />
                            </div>
                        </div>
                    )}

                    {/* Process Parameters Table */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                                Process Parameters ({process_parameters.length}) — {driftingParams.length} with drift
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="bg-gray-50/30 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                                    <tr>
                                        <th className="px-5 py-2.5">Parameter</th>
                                        <th className="px-5 py-2.5">Stage</th>
                                        <th className="px-5 py-2.5">Current</th>
                                        <th className="px-5 py-2.5">Target</th>
                                        <th className="px-5 py-2.5">UCL / LCL</th>
                                        <th className="px-5 py-2.5">EWMA</th>
                                        <th className="px-5 py-2.5">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {process_parameters.map((param, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-5 py-3 font-medium text-gray-800">{param.parameter_name}</td>
                                            <td className="px-5 py-3 text-xs text-gray-500">{param.stage}</td>
                                            <td className="px-5 py-3 font-mono text-xs text-gray-800">
                                                {param.current_value} {param.unit}
                                            </td>
                                            <td className="px-5 py-3 font-mono text-xs text-gray-500">{param.target_value}</td>
                                            <td className="px-5 py-3 font-mono text-xs text-gray-500">{param.ucl} / {param.lcl}</td>
                                            <td className="px-5 py-3 font-mono text-xs text-gray-500">{param.ewma_value}</td>
                                            <td className="px-5 py-3">
                                                <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full ${SEVERITY_BADGE[param.drift_severity]}`}>
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
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Supplier Quality Matrix</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="bg-gray-50/30 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                                    <tr>
                                        <th className="px-5 py-2.5">Supplier</th>
                                        <th className="px-5 py-2.5">Batches</th>
                                        <th className="px-5 py-2.5">Defects</th>
                                        <th className="px-5 py-2.5">Defect Rate (PPM)</th>
                                        <th className="px-5 py-2.5">Pass Rate</th>
                                        <th className="px-5 py-2.5">Quality Score</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {supplier_quality_matrix.map((supplier, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-5 py-3 font-medium text-gray-800">{supplier.supplier}</td>
                                            <td className="px-5 py-3 font-mono text-xs text-gray-800">{supplier.total_batches}</td>
                                            <td className="px-5 py-3 font-mono text-xs text-gray-500">{supplier.total_defects}</td>
                                            <td className="px-5 py-3">
                                                <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full ${supplier.defect_rate_ppm > 15000 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                                    {supplier.defect_rate_ppm}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 font-mono text-xs text-gray-500">{supplier.pass_rate_pct}%</td>
                                            <td className="px-5 py-3 font-mono text-xs font-medium text-gray-800">{supplier.avg_quality_score}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'spc' && (
                <SPCChartsTab spc_charts={spc_charts} />
            )}

            {activeTab === 'inspections' && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                            Incoming Inspection Records ({inspection_records.length} batches)
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="bg-gray-50/30 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                                <tr>
                                    <th className="px-5 py-2.5">Batch</th>
                                    <th className="px-5 py-2.5">Supplier</th>
                                    <th className="px-5 py-2.5">Material</th>
                                    <th className="px-5 py-2.5">Date</th>
                                    <th className="px-5 py-2.5">Samples</th>
                                    <th className="px-5 py-2.5">Defects</th>
                                    <th className="px-5 py-2.5">PPM</th>
                                    <th className="px-5 py-2.5">Result</th>
                                    <th className="px-5 py-2.5">Score</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {inspection_records.map((record) => (
                                    <tr key={record.batch_id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-3 font-mono text-xs text-gray-800">{record.batch_id}</td>
                                        <td className="px-5 py-3 font-medium text-gray-800 text-xs">{record.supplier}</td>
                                        <td className="px-5 py-3 text-xs text-gray-500">{record.material}</td>
                                        <td className="px-5 py-3 text-xs text-gray-500">{record.inspection_date}</td>
                                        <td className="px-5 py-3 font-mono text-xs text-gray-800">{record.sample_size}</td>
                                        <td className="px-5 py-3 font-mono text-xs text-gray-800">{record.defects_found}</td>
                                        <td className="px-5 py-3">
                                            <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full ${record.defect_rate_ppm > 10000 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                                {record.defect_rate_ppm.toFixed(0)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full ${record.pass_fail === 'PASS' ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-600'}`}>
                                                {record.pass_fail}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-xs text-gray-800">{record.quality_score}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'predictions' && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                            Defect Predictions ({defect_predictions.length} active)
                        </h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {defect_predictions.map((pred, idx) => (
                            <div key={idx} className="px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono text-xs text-gray-500">{pred.batch_id}</span>
                                            <span className="text-xs text-gray-400">·</span>
                                            <span className="text-xs text-gray-500">{pred.stage}</span>
                                        </div>
                                        <p className="text-sm font-semibold text-gray-800">{pred.predicted_defect_type}</p>
                                        <div className="mt-1.5 space-y-0.5">
                                            {pred.risk_factors.map((factor, fIdx) => (
                                                <p key={fIdx} className="text-[11px] text-gray-500 leading-relaxed">{factor}</p>
                                            ))}
                                        </div>
                                        <p className="mt-1.5 text-[11px] text-gray-500">
                                            <span className="font-medium text-gray-700">Action:</span> {pred.recommended_action}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full ${pred.confidence > 0.85 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                            {(pred.confidence * 100).toFixed(1)}%
                                        </span>
                                        <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">confidence</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function SPCChartsTab({ spc_charts }: { spc_charts: Record<string, SPCChartPoint[]> }) {
  return (
    <div className="space-y-6">
      {Object.entries(spc_charts).map(([chartName, points]) => {
        if (!points || points.length === 0) return null;
        const first = points[0];
        const violations = points.filter(p => p.out_of_control).length;
        return (
          <div key={chartName} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">{chartName}</h3>
            </div>
            <div className="p-5">
              <div className="relative h-48 rounded-lg bg-gray-50/50 border border-gray-100 p-4">
                <div className="absolute inset-x-4 top-4 flex justify-between text-[10px] text-gray-400 font-mono">
                  <span>UCL: {first.ucl}</span>
                </div>
                <div className="absolute inset-x-4 bottom-4 flex justify-between text-[10px] text-gray-400 font-mono">
                  <span>LCL: {first.lcl}</span>
                </div>
                <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between text-[10px] text-gray-400 font-mono">
                  <span>CL: {first.center_line}</span>
                </div>
                <div className="flex items-end h-full gap-[2px] pt-6 pb-6">
                  {points.map((point, idx) => {
                    const range = point.ucl - point.lcl;
                    const normalized = Math.min(Math.max((point.value - point.lcl) / range, 0), 1);
                    return (
                      <div
                        key={idx}
                        className={`flex-1 rounded-t ${point.out_of_control ? 'bg-red-500' : 'bg-gray-800'}`}
                        style={{ height: `${normalized * 100}%`, opacity: point.out_of_control ? 1 : 0.6 }}
                        title={`${point.timestamp}: ${point.value} ${point.out_of_control ? '(OUT OF CONTROL)' : ''}`}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-4 mt-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-gray-800" style={{opacity: 0.6}} /> In Control</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-500" /> Out of Control</span>
                <span className="font-mono">{violations} violations</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KPICard({ label, value, subtitle, critical }: { label: string; value: string | number; subtitle?: string; critical?: boolean }) {
    return (
        <div className="bg-gray-50/80 rounded-xl p-5 text-center">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">{label}</p>
            <p className="mt-2">
                <span className={`font-mono text-xl font-semibold tracking-tight ${critical ? 'text-red-600' : 'text-gray-900'}`}>{value}</span>
            </p>
            {subtitle && <p className="text-[10px] text-gray-500 mt-1.5 leading-tight">{subtitle}</p>}
        </div>
    );
}
