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
      <div className="bg-white border border-gray-100 rounded-xl p-8 animate-pulse w-full max-w-4xl h-96 shadow-xl"></div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-xl w-full max-w-5xl shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <Activity className="mr-3 text-red-500" />
              Root Cause Analysis (SHAP)
            </h2>
            <p className="text-gray-500 mt-1">Batch {batchId} • Final Cpk: {explanation?.cpk}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1">
          <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100">
            <p className="text-gray-700 text-sm">{explanation?.summary}</p>
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

  if (loading) return <div className="h-48 bg-white rounded-xl border border-gray-100 animate-pulse"></div>;
  if (!explanation) return null;

  const isDrift = explanation.status === 'drift';

  return (
    <>
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center uppercase tracking-wider">
            <Info size={16} className={`mr-2 ${isDrift ? 'text-red-500' : 'text-emerald-500'}`} />
            {isDrift ? 'Top Drift Factors' : 'Process Parameters (Stable)'}
          </h3>
          <span className={`text-xs px-2 py-1 rounded-full border ${isDrift ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
            Cpk: {explanation.cpk}
          </span>
        </div>
        
        <div className="flex-1 divide-y divide-gray-100 p-2">
          {!isDrift && (
            <div className="p-3 text-sm text-gray-500">
              All process parameters are currently within standard control limits. Process capability is healthy.
            </div>
          )}
          {explanation.top_factors.slice(0, 3).map((factor, idx) => (
            <div 
              key={idx} 
              className="flex justify-between items-center p-3 hover:bg-gray-50/50 transition-colors cursor-pointer rounded-lg"
              onClick={() => setShowModal(true)}
            >
              <div className="flex items-center">
                <span className="text-gray-400 font-mono text-xs w-5">{idx + 1}.</span>
                <div>
                  <div className="text-sm text-gray-800 capitalize">{factor.parameter.replace(/_/g, ' ')}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Current: <span className="text-gray-700">{factor.current_value}</span> (Normal: {factor.normal_range[0]}-{factor.normal_range[1]})
                  </div>
                </div>
              </div>
              
              <div className={`flex flex-col items-end ${factor.direction === 'harmful' ? 'text-red-600' : 'text-emerald-600'}`}>
                {factor.direction === 'harmful' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                <span className="text-xs font-mono mt-1 font-medium">{Math.abs(factor.shap_value).toFixed(3)}</span>
              </div>
            </div>
          ))}
        </div>
        
        <button 
          onClick={() => setShowModal(true)}
          className="w-full py-3 text-xs text-center text-indigo-600 hover:text-indigo-700 hover:bg-gray-50/50 border-t border-gray-100 transition-colors font-medium"
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
    return <div className="h-[400px] bg-white rounded-xl border border-gray-100 animate-pulse"></div>;
  }
  if (!explanation) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex flex-col h-[450px]">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-gray-800 font-semibold text-base">Model Attribution (SHAP Waterfall)</h3>
          <p className="text-xs text-gray-500 mt-0.5">Quantified impact of parameter deviations on overall Cpk yield score</p>
        </div>
        <span className="text-xs px-2.5 py-1 bg-red-50 text-red-600 border border-red-100 rounded-full font-mono font-medium">
          Drift Detected (Cpk: {explanation.cpk})
        </span>
      </div>
      
      {/* Alert summary of the cause */}
      <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 mb-4 text-xs text-amber-800 font-medium">
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
