import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, AlertTriangle, TrendingUp } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface PriceData {
  price: number;
  unit: string;
  change_24h: number;
  last_updated: string;
  source: string;
  history: number[];
}

interface CapexImpact {
  current_capex: number;
  previous_capex: number;
  delta: number;
  delta_pct: number;
  breakdown: {
    lithium_contribution: number;
    cobalt_contribution: number;
    nickel_contribution: number;
    fixed_costs: number;
  };
  last_recalculated: string;
}

// Prepare sparkline data from actual historical values
const prepareSparklineData = (history: number[], currentPrice: number) => {
  if (!history || history.length === 0) {
    return [{ value: currentPrice }];
  }
  return history.map(val => ({ value: val }));
};

export const CommodityPriceWidget: React.FC = () => {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [capex, setCapex] = useState<CapexImpact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pricesRes, capexRes] = await Promise.all([
          fetch('http://127.0.0.1:8000/api/commodity/prices'),
          fetch('http://127.0.0.1:8000/api/commodity/capex-impact')
        ]);
        
        if (!pricesRes.ok || !capexRes.ok) throw new Error("Failed to fetch");

        // The prices API returns a list of CommodityPrice objects, 
        // Let's map it back to a record
        const pricesList = await pricesRes.json();
        const pricesMap: Record<string, PriceData> = {};
        
        if (Array.isArray(pricesList)) {
            pricesList.forEach((p: any) => {
                pricesMap[p.material] = {
                    price: p.price_inr_per_kg,
                    unit: p.unit,
                    change_24h: p.change_pct_24h,
                    last_updated: p.last_updated,
                    source: p.source,
                    history: p.history || []
                };
            });
        }
        
        setPrices(pricesMap);
        setCapex(await capexRes.json());
        setLoading(false);
      } catch (err) {
        setError("Error loading commodity data");
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 animate-pulse h-64"></div>;
  if (error) return <div className="p-4 bg-red-50 text-red-600 rounded-lg shadow-sm border border-red-100">{error}</div>;

  const hasHighVolatility = Object.values(prices).some(p => Math.abs(p.change_24h) > 5.0);
  const volatileMaterial = Object.entries(prices).find(([_, p]) => Math.abs(p.change_24h) > 5.0);

  const Ticker = ({ name, data, color }: { name: string, data: PriceData, color: string }) => {
    const isUp = data.change_24h >= 0;
    const sparklineData = prepareSparklineData(data.history, data.price);
    
    return (
      <div className="flex flex-col p-3 bg-gray-50 rounded-md border border-gray-100">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-semibold text-gray-600">{name}</span>
          <span className={`text-xs font-bold flex items-center ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            {isUp ? <ArrowUp size={12} className="mr-1" /> : <ArrowDown size={12} className="mr-1" />}
            {Math.abs(data.change_24h)}%
          </span>
        </div>
        <div className="text-lg font-bold text-gray-900 mb-2">₹{data.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span className="text-xs font-normal text-gray-500">/kg</span></div>
        <div className="h-10 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData}>
              <defs>
                <linearGradient id={`gradient-${name}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke={color} fill={`url(#gradient-${name})`} strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 w-full flex flex-col space-y-5">
      
      {/* Header & Warning */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <TrendingUp className="mr-2 text-indigo-500" size={20} />
            Commodity Price Feed
          </h3>
          <p className="text-sm text-gray-500">Live LME tracking & CapEx sensitivity (7-day trend)</p>
        </div>
        {hasHighVolatility && volatileMaterial && (
          <div className="flex items-center bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1.5 rounded-full text-xs font-medium">
            <AlertTriangle size={14} className="mr-1.5" />
            {volatileMaterial[0]} moved {volatileMaterial[1].change_24h > 0 ? 'up' : 'down'} {Math.abs(volatileMaterial[1].change_24h)}% — CapEx sensitivity high
          </div>
        )}
      </div>

      {/* Tickers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {prices['Lithium'] && <Ticker name="Lithium" data={prices['Lithium']} color="#10b981" />}
        {prices['Cobalt'] && <Ticker name="Cobalt" data={prices['Cobalt']} color="#3b82f6" />}
        {prices['Nickel'] && <Ticker name="Nickel" data={prices['Nickel']} color="#8b5cf6" />}
      </div>

      {/* Stacked Bar for CapEx */}
      {capex && (
        <div className="pt-2 border-t border-gray-100 mt-2">
          <div className="flex justify-between items-end mb-2">
            <div>
              <p className="text-sm text-gray-500 mb-1">Current CapEx per vehicle (5t Truck)</p>
              <div className="text-2xl font-bold text-gray-900 flex items-baseline">
                ₹{capex.current_capex.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                {capex.delta !== 0 && (
                  <span className={`ml-3 text-sm font-medium ${capex.delta > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {capex.delta > 0 ? '+' : ''}₹{capex.delta.toLocaleString(undefined, {maximumFractionDigits: 0})} ({capex.delta_pct.toFixed(2)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Stacked Bar */}
          <div className="w-full h-6 rounded-full overflow-hidden flex bg-gray-100 mt-3 shadow-inner">
            <div 
              style={{ width: `${(capex.breakdown.lithium_contribution / capex.current_capex) * 100}%` }} 
              className="bg-emerald-500 h-full tooltip-trigger relative group"
            >
              <div className="absolute opacity-0 group-hover:opacity-100 -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-xs text-white px-2 py-1 rounded whitespace-nowrap z-10 transition-opacity">
                Li: ₹{Math.round(capex.breakdown.lithium_contribution).toLocaleString()}
              </div>
            </div>
            <div 
              style={{ width: `${(capex.breakdown.cobalt_contribution / capex.current_capex) * 100}%` }} 
              className="bg-blue-500 h-full tooltip-trigger relative group"
            >
              <div className="absolute opacity-0 group-hover:opacity-100 -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-xs text-white px-2 py-1 rounded whitespace-nowrap z-10 transition-opacity">
                Co: ₹{Math.round(capex.breakdown.cobalt_contribution).toLocaleString()}
              </div>
            </div>
            <div 
              style={{ width: `${(capex.breakdown.nickel_contribution / capex.current_capex) * 100}%` }} 
              className="bg-violet-500 h-full tooltip-trigger relative group"
            >
              <div className="absolute opacity-0 group-hover:opacity-100 -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-xs text-white px-2 py-1 rounded whitespace-nowrap z-10 transition-opacity">
                Ni: ₹{Math.round(capex.breakdown.nickel_contribution).toLocaleString()}
              </div>
            </div>
            <div 
              style={{ width: `${(capex.breakdown.fixed_costs / capex.current_capex) * 100}%` }} 
              className="bg-gray-300 h-full tooltip-trigger relative group"
            >
              <div className="absolute opacity-0 group-hover:opacity-100 -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-xs text-white px-2 py-1 rounded whitespace-nowrap z-10 transition-opacity">
                Fixed: ₹{Math.round(capex.breakdown.fixed_costs).toLocaleString()}
              </div>
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex justify-between mt-3 text-xs text-gray-500 px-1">
            <div className="flex items-center"><span className="w-3 h-3 rounded-sm bg-emerald-500 mr-2"></span>Lithium</div>
            <div className="flex items-center"><span className="w-3 h-3 rounded-sm bg-blue-500 mr-2"></span>Cobalt</div>
            <div className="flex items-center"><span className="w-3 h-3 rounded-sm bg-violet-500 mr-2"></span>Nickel</div>
            <div className="flex items-center"><span className="w-3 h-3 rounded-sm bg-gray-300 mr-2"></span>Fixed Costs</div>
          </div>
        </div>
      )}
    </div>
  );
};
