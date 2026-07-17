import React from 'react';
import { useAuth } from './AuthContext';
import { Activity, Leaf, Globe, TrendingUp, ShieldAlert, CheckCircle, Battery, Zap } from 'lucide-react';

const ExecutiveDashboard: React.FC = () => {
  const { roleView } = useAuth();
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Executive Dashboard</h2>
          <p className="text-gray-500">High-level KPIs and Fleet Overview</p>
        </div>
      </div>

      {/* Top Row: 4 Big KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
              <Activity className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center text-sm text-green-600 font-medium">+2.4%</span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Fleet Availability</h3>
          <p className="text-3xl font-bold text-gray-900 mt-1">91.2%</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-green-50 p-2 rounded-lg text-green-600">
              <Battery className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center text-sm text-red-500 font-medium">-1.2%</span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Avg Battery SoH</h3>
          <p className="text-3xl font-bold text-gray-900 mt-1">87%</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-teal-50 p-2 rounded-lg text-teal-600">
              <Leaf className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center text-sm text-green-600 font-medium">On Track</span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Carbon Reduction YTD</h3>
          <p className="text-3xl font-bold text-gray-900 mt-1">-12.4%</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-orange-50 p-2 rounded-lg text-orange-600">
              <Globe className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Supply Chain Risk</h3>
          <p className="text-3xl font-bold text-orange-500 mt-1">Medium</p>
        </div>
      </div>

      {/* Second Row: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Fleet SoH Trend (12 Months)</h3>
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
            <p className="text-gray-400">Line Chart Visualization</p>
          </div>
          <div className="mt-4 text-right">
            <button onClick={() => window.location.pathname = '/fleet/health'} className="text-blue-600 hover:text-blue-700 text-sm font-medium">Drill down to Fleet Health &rarr;</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Net Zero Progress</h3>
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
            <p className="text-gray-400">Gauge & Projection Line</p>
          </div>
          <div className="mt-4 text-right">
            <button onClick={() => window.location.pathname = '/carbon'} className="text-blue-600 hover:text-blue-700 text-sm font-medium">Drill down to Carbon &rarr;</button>
          </div>
        </div>
      </div>

      {/* Third Row: Risks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            Top 5 Maintenance Risks
          </h3>
          <ul className="space-y-3">
            {[
              { v: 'DEP-MUM-V042', risk: 'SoH dropped 4% in 30 days', severity: 'Critical' },
              { v: 'DEP-DEL-V019', risk: 'RUL < 60 days', severity: 'High' },
              { v: 'DEP-BLR-V088', risk: 'Thermal anomaly detected', severity: 'Critical' },
              { v: 'DEP-CHE-V005', risk: 'Overdue scheduled maintenance', severity: 'Medium' },
              { v: 'DEP-PUN-V012', risk: 'Cooling system efficiency loss', severity: 'Medium' },
            ].map((r, i) => (
              <li key={i} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">{r.v}</p>
                  <p className="text-sm text-gray-500">{r.risk}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${r.severity === 'Critical' ? 'bg-red-100 text-red-700' : r.severity === 'High' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {r.severity}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 text-right">
            <button onClick={() => window.location.pathname = '/maintenance'} className="text-blue-600 hover:text-blue-700 text-sm font-medium">Drill down to Maintenance &rarr;</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-orange-500" />
            Top 5 Supply Chain Risks
          </h3>
          <ul className="space-y-3">
            {[
              { mat: 'Lithium', source: 'Chile', risk: 'Port strike announced', severity: 'Critical' },
              { mat: 'Cobalt', source: 'DRC', risk: 'Regulatory changes pending', severity: 'High' },
              { mat: 'Nickel', source: 'Indonesia', risk: 'Export quota reached', severity: 'Medium' },
              { mat: 'Graphite', source: 'China', risk: 'Tariff increase expected', severity: 'High' },
              { mat: 'Cells', source: 'Korea', risk: 'Shipping delays (+4 days)', severity: 'Medium' },
            ].map((r, i) => (
              <li key={i} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">{r.mat} ({r.source})</p>
                  <p className="text-sm text-gray-500">{r.risk}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${r.severity === 'Critical' ? 'bg-red-100 text-red-700' : r.severity === 'High' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {r.severity}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 text-right">
            <button onClick={() => window.location.pathname = '/supply-chain'} className="text-blue-600 hover:text-blue-700 text-sm font-medium">Drill down to Supply Chain &rarr;</button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Cost Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          Financial Overview (Quarterly)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 font-medium">CapEx (Vehicles & Infrastructure)</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">₹14.2 Cr</p>
            <p className="text-sm text-green-600 mt-1">-5% vs Budget</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 font-medium">OpEx (Maintenance & Operations)</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">₹3.8 Cr</p>
            <p className="text-sm text-red-500 mt-1">+2% vs Budget</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 font-medium">Projected ROI (End of Year)</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">18.5%</p>
            <p className="text-sm text-green-600 mt-1">+1.5% YoY</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
