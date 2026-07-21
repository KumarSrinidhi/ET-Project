import { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp, Activity, Info, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { fetchQualityDriftExplanation } from '../api';
import type { ShapExplanation } from '../api';

interface WaterfallData {
  name: string;
  value: [number, number];
  raw_shap: number;
  color: string;
  current_val?: number;
}

export const ShapWaterfallChart = ({ batchId, onClose }: { batchId: string, onClose: () => void }) => {
  const [data, setData] = useState<WaterfallData[]>([]);
  const [explanation, setExplanation] = useState<ShapExplanation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShap = async () => {
      try {
        const json = await fetchQualityDriftExplanation(batchId);
        setExplanation(json);
        
        let currentBase = json.base_value;
        const chartData: WaterfallData[] = [];
        
        // Base value bar
        chartData.push({
          name: 'Base Expected Cpk',
          value: [0, currentBase],
          raw_shap: currentBase,
          color: '#6b7280' // gray-500
        });

        json.all_factors.forEach(f => {
          const nextBase = currentBase + f.shap_value;
          chartData.push({
            name: f.parameter.replace(/_/g, ' '),
            value: [currentBase, nextBase],
            raw_shap: f.shap_value,
            color: f.shap_value > 0 ? '#10b981' : '#ef4444', // green or red
            current_val: f.current_value
          });
          currentBase = nextBase;
        });

        // Final output bar
        chartData.push({
          name: 'Actual Cpk',
          value: [0, currentBase],
          raw_shap: currentBase,
          color: '#3b82f6' // blue-500
        });

        setData(chartData);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    };
    fetchShap();
  }, [batchId]);

  if (loading) return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-canvas border border-hairline rounded-xl p-8 animate-pulse w-full max-w-4xl h-96 shadow-xl"></div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-canvas border border-hairline rounded-xl w-full max-w-5xl shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-hairline">
          <div>
            <h2 className="text-2xl font-bold text-ink flex items-center">
              <Activity className="mr-3 text-status-critical-fg" />
              Root Cause Analysis (SHAP)
            </h2>
            <p className="text-ink-muted mt-1">Batch {batchId} • Final Cpk: {explanation?.cpk}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-canvas-sunken bg-canvas-sunken rounded-full text-ink-muted transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1">
          <div className="bg-canvas rounded-lg p-4 mb-6 border border-hairline">
            <p className="text-ink text-sm">{explanation?.summary}</p>
          </div>

          <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 20, right: 30, left: 180, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                <XAxis type="number" domain={['dataMin - 0.1', 'dataMax + 0.1']} tick={{ fill: '#6b7280' }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#374151', fontSize: 12 }} width={170} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#1f2937' }}
                  formatter={(_value: any, _name: any, props: any) => {
                    const raw = props.payload.raw_shap;
                    return [`${raw > 0 && props.payload.name !== 'Base Expected Cpk' && props.payload.name !== 'Actual Cpk' ? '+' : ''}${raw.toFixed(4)}`, 'Impact'];
                  }}
                  labelStyle={{ color: '#4b5563', marginBottom: '4px' }}
                />
                <Bar dataKey="value" isAnimationActive={false}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};


export const TopFactorsCard = ({ batchId }: { batchId: string }) => {
  const [explanation, setExplanation] = useState<ShapExplanation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchShap = async () => {
      try {
        const json = await fetchQualityDriftExplanation(batchId);
        setExplanation(json);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    };
    fetchShap();
  }, [batchId]);

  if (loading) return <div className="h-48 bg-canvas rounded-xl border border-hairline animate-pulse"></div>;
  if (!explanation) return null;

  const isDrift = explanation.status === 'drift';

  return (
    <>
      <div className="bg-canvas border border-hairline rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-hairline bg-canvas flex justify-between items-center">
          <h3 className="text-sm font-semibold text-ink flex items-center uppercase tracking-wider">
            <Info size={16} className={`mr-2 ${isDrift ? 'text-status-critical-fg' : 'text-emerald-500'}`} />
            {isDrift ? 'Top Drift Factors' : 'Process Parameters (Stable)'}
          </h3>
          <span className={`text-xs px-2 py-1 rounded-full border ${isDrift ? 'bg-status-critical-bg text-status-critical-fg border-status-critical-border' : 'bg-status-ok-bg text-status-ok-fg border-status-ok-border'}`}>
            Cpk: {explanation.cpk}
          </span>
        </div>
        
        <div className="flex-1 divide-y divide-gray-100 p-2">
          {!isDrift && (
            <div className="p-3 text-sm text-ink-muted">
              All process parameters are currently within standard control limits. Process capability is healthy.
            </div>
          )}
          {explanation.top_factors.slice(0, 3).map((factor, idx) => (
            <div 
              key={idx} 
              className="flex justify-between items-center p-3 bg-canvas transition-colors cursor-pointer rounded-lg"
              onClick={() => setShowModal(true)}
            >
              <div className="flex items-center">
                <span className="text-ink-faint font-mono text-xs w-5">{idx + 1}.</span>
                <div>
                  <div className="text-sm text-ink capitalize">{factor.parameter.replace(/_/g, ' ')}</div>
                  <div className="text-[11px] text-ink-muted mt-0.5">
                    Current: <span className="text-ink">{factor.current_value}</span> (Normal: {factor.normal_range[0]}-{factor.normal_range[1]})
                  </div>
                </div>
              </div>
              
              <div className={`flex flex-col items-end ${factor.direction === 'harmful' ? 'text-status-critical-fg' : 'text-status-ok-fg'}`}>
                {factor.direction === 'harmful' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                <span className="text-xs font-mono mt-1 font-medium">{Math.abs(factor.shap_value).toFixed(3)}</span>
              </div>
            </div>
          ))}
        </div>
        
        <button 
          onClick={() => setShowModal(true)}
          className="w-full py-3 text-xs text-center text-indigo-600 hover:text-indigo-700 bg-canvas border-t border-hairline transition-colors font-medium"
        >
          View Full SHAP Waterfall
        </button>
      </div>

      {showModal && <ShapWaterfallChart batchId={batchId} onClose={() => setShowModal(false)} />}
    </>
  );
};

export const InlineShapWaterfall = ({ batchId }: { batchId: string }) => {
  const [data, setData] = useState<WaterfallData[]>([]);
  const [explanation, setExplanation] = useState<ShapExplanation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShap = async () => {
      try {
        const json = await fetchQualityDriftExplanation(batchId);
        setExplanation(json);
        
        let currentBase = json.base_value;
        const chartData: WaterfallData[] = [];
        
        chartData.push({
          name: 'Base Expected Cpk',
          value: [0, currentBase],
          raw_shap: currentBase,
          color: '#6b7280'
        });

        json.all_factors.forEach(f => {
          const nextBase = currentBase + f.shap_value;
          chartData.push({
            name: f.parameter.replace(/_/g, ' '),
            value: [currentBase, nextBase],
            raw_shap: f.shap_value,
            color: f.shap_value > 0 ? '#10b981' : '#ef4444',
            current_val: f.current_value
          });
          currentBase = nextBase;
        });

        chartData.push({
          name: 'Actual Cpk',
          value: [0, currentBase],
          raw_shap: currentBase,
          color: '#3b82f6'
        });

        setData(chartData);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    };
    fetchShap();
  }, [batchId]);

  if (loading) {
    return <div className="h-[400px] bg-canvas rounded-xl border border-hairline animate-pulse"></div>;
  }
  if (!explanation) return null;

  return (
    <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm flex flex-col h-[450px]">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-ink font-semibold text-base">Model Attribution (SHAP Waterfall)</h3>
          <p className="text-xs text-ink-muted mt-0.5">Quantified impact of parameter deviations on overall Cpk yield score</p>
        </div>
        <span className="text-xs px-2.5 py-1 bg-status-critical-bg text-status-critical-fg border border-status-critical-border rounded-full font-mono font-medium">
          Drift Detected (Cpk: {explanation.cpk})
        </span>
      </div>
      
      {/* Alert summary of the cause */}
      <div className="bg-status-warning-bg border border-status-warning-border rounded-lg p-3 mb-4 text-xs text-status-warning-fg font-medium">
        {explanation.summary}
      </div>

      <div className="flex-1 w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 15, left: 120, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
            <XAxis type="number" domain={['dataMin - 0.1', 'dataMax + 0.1']} tick={{ fill: '#6b7280', fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#374151', fontSize: 10 }} width={110} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#1f2937', fontSize: '11px' }}
              formatter={(_value: any, _name: any, props: any) => {
                const raw = props.payload.raw_shap;
                return [`${raw > 0 && props.payload.name !== 'Base Expected Cpk' && props.payload.name !== 'Actual Cpk' ? '+' : ''}${raw.toFixed(4)}`, 'Impact'];
              }}
              labelStyle={{ color: '#4b5563', marginBottom: '4px' }}
            />
            <Bar dataKey="value" isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
