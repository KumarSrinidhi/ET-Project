import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Activity, Leaf, Globe, TrendingUp, ShieldAlert, Battery } from 'lucide-react';

const SOH_TREND_DATA = [
  { month: 'Jan', soh: 89.1 },
  { month: 'Feb', soh: 88.8 },
  { month: 'Mar', soh: 88.5 },
  { month: 'Apr', soh: 88.3 },
  { month: 'May', soh: 88.1 },
  { month: 'Jun', soh: 87.9 },
  { month: 'Jul', soh: 87.7 },
  { month: 'Aug', soh: 87.5 },
  { month: 'Sep', soh: 87.3 },
  { month: 'Oct', soh: 87.2 },
  { month: 'Nov', soh: 87.1 },
  { month: 'Dec', soh: 87.0 },
];

const CARBON_SCOPE_DATA = [
  { name: 'Scope 1', value: 18, color: 'rgb(var(--color-chart-1))' },
  { name: 'Scope 2', value: 24, color: 'rgb(var(--color-chart-2))' },
  { name: 'Scope 3', value: 58, color: 'rgb(var(--color-chart-3))' },
];

const CARBON_MONTHLY = [
  { month: 'J', tons: 420 },
  { month: 'F', tons: 405 },
  { month: 'M', tons: 398 },
  { month: 'A', tons: 385 },
  { month: 'M', tons: 372 },
  { month: 'J', tons: 368 },
  { month: 'J', tons: 360 },
  { month: 'A', tons: 355 },
  { month: 'S', tons: 348 },
  { month: 'O', tons: 342 },
  { month: 'N', tons: 336 },
  { month: 'D', tons: 330 },
];

const GAUGE_DATA = [
  { name: 'Progress', value: 37 },
  { name: 'Remaining', value: 63 },
];
const GAUGE_COLORS = ['rgb(var(--color-chart-3))', 'rgb(var(--color-hairline))'];

const ExecutiveDashboard: React.FC = () => {

  const targetTons = useMemo(() => 330, []);
  const latestTons = useMemo(() => CARBON_MONTHLY[CARBON_MONTHLY.length - 1].tons, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-ink">Executive Dashboard</h2>
          <p className="text-ink-muted">High-level KPIs and Fleet Overview</p>
        </div>
      </div>

      {/* Top Row: 4 Big KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-canvas rounded-xl shadow-sm border border-hairline p-6 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-voltage-50 p-2 rounded-lg text-voltage-600">
              <Activity className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center text-sm text-status-ok-fg font-medium">+2.4%</span>
          </div>
          <h3 className="text-ink-muted text-sm font-medium">Fleet Availability</h3>
          <p className="text-3xl font-bold text-ink mt-1">91.2%</p>
        </div>

        <div className="bg-canvas rounded-xl shadow-sm border border-hairline p-6 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-status-ok-bg p-2 rounded-lg text-status-ok-fg">
              <Battery className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center text-sm text-status-critical-fg font-medium">-1.2%</span>
          </div>
          <h3 className="text-ink-muted text-sm font-medium">Avg Battery SoH</h3>
          <p className="text-3xl font-bold text-ink mt-1">87%</p>
        </div>

        <div className="bg-canvas rounded-xl shadow-sm border border-hairline p-6 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-teal-50 p-2 rounded-lg text-teal-600">
              <Leaf className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center text-sm text-status-ok-fg font-medium">On Track</span>
          </div>
          <h3 className="text-ink-muted text-sm font-medium">Carbon Reduction YTD</h3>
          <p className="text-3xl font-bold text-ink mt-1">-12.4%</p>
        </div>

        <div className="bg-canvas rounded-xl shadow-sm border border-hairline p-6 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-status-warning-bg p-2 rounded-lg text-status-warning-fg">
              <Globe className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-ink-muted text-sm font-medium">Supply Chain Risk</h3>
          <p className="text-3xl font-bold text-orange-500 mt-1">Medium</p>
        </div>
      </div>

      {/* Second Row: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet SoH Trend */}
        <div className="bg-canvas rounded-xl shadow-sm border border-hairline p-6">
          <h3 className="text-lg font-bold text-ink mb-4">Fleet SoH Trend (12 Months)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={SOH_TREND_DATA} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-hairline))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgb(var(--color-ink-muted))' }} axisLine={false} tickLine={false} />
                <YAxis domain={[86, 90]} tick={{ fontSize: 11, fill: 'rgb(var(--color-ink-muted))' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--tw-bg-canvas, #fff)',
                    border: '1px solid var(--tw-border-hairline, #e2e8f0)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value) => [`${value}%`, 'SoH']}
                />
                <Line
                  type="monotone"
                  dataKey="soh"
                  stroke="rgb(var(--color-chart-3))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'rgb(var(--color-chart-3))' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-right">
            <button onClick={() => window.location.pathname = '/fleet/health'} className="text-voltage-600 hover:text-voltage-700 text-sm font-medium">Drill down to Fleet Health &rarr;</button>
          </div>
        </div>

        {/* Net Zero Progress */}
        <div className="bg-canvas rounded-xl shadow-sm border border-hairline p-6">
          <h3 className="text-lg font-bold text-ink mb-4">Net Zero Progress</h3>
          <div className="flex items-center gap-6">
            {/* Semi-circular gauge */}
            <div className="relative w-40 h-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={GAUGE_DATA}
                    cx="50%"
                    cy="90%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={50}
                    outerRadius={70}
                    dataKey="value"
                    stroke="none"
                  >
                    {GAUGE_DATA.map((_, i) => (
                      <Cell key={i} fill={GAUGE_COLORS[i]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pb-4">
                <div className="text-center">
                  <span className="text-2xl font-bold text-ink">{GAUGE_DATA[0].value}%</span>
                  <p className="text-[10px] text-ink-muted uppercase tracking-wider">to Net Zero</p>
                </div>
              </div>
            </div>

            {/* Monthly projection */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-ink-muted uppercase tracking-wider">Monthly Emissions</span>
                <span className="text-xs font-mono text-ink-faint">tons CO2</span>
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={CARBON_MONTHLY} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-hairline))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'rgb(var(--color-ink-faint))' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[300, 440]} tick={{ fontSize: 10, fill: 'rgb(var(--color-ink-faint))' }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--tw-bg-canvas, #fff)',
                        border: '1px solid var(--tw-border-hairline, #e2e8f0)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value) => [`${value} t`, 'CO2']}
                    />
                    <Line type="monotone" dataKey="tons" stroke="rgb(var(--color-chart-2))" strokeWidth={2} dot={false} />
                    <Line
                      type="monotone"
                      data={CARBON_MONTHLY.map(d => ({ ...d, target: targetTons }))}
                      dataKey="target"
                      stroke="rgb(var(--color-chart-3))"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-ink-muted">Current: <span className="font-mono font-medium text-ink">{latestTons} t</span></span>
                <span className="text-[10px] text-ink-muted">Target: <span className="font-mono font-medium text-ink">{targetTons} t</span></span>
              </div>
            </div>
          </div>

          {/* Scope breakdown */}
          <div className="mt-4 pt-4 border-t border-hairline">
            <div className="flex items-center gap-4">
              {CARBON_SCOPE_DATA.map(scope => (
                <div key={scope.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: scope.color }} />
                  <span className="text-xs text-ink-muted">{scope.name}</span>
                  <span className="text-xs font-mono font-medium text-ink">{scope.value}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 text-right">
            <button onClick={() => window.location.pathname = '/carbon'} className="text-voltage-600 hover:text-voltage-700 text-sm font-medium">Drill down to Carbon &rarr;</button>
          </div>
        </div>
      </div>

      {/* Third Row: Risks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-canvas rounded-xl shadow-sm border border-hairline p-6">
          <h3 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-status-critical-fg" />
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
              <li key={i} className="flex justify-between items-center p-3 bg-canvas rounded-lg border border-hairline">
                <div>
                  <p className="font-medium text-ink">{r.v}</p>
                  <p className="text-sm text-ink-muted">{r.risk}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${r.severity === 'Critical' ? 'bg-status-critical-bg text-status-critical-fg' : r.severity === 'High' ? 'bg-status-warning-bg text-status-warning-fg' : 'bg-status-warning-bg text-status-warning-fg'}`}>
                  {r.severity}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 text-right">
            <button onClick={() => window.location.pathname = '/maintenance'} className="text-voltage-600 text-voltage-700 text-sm font-medium">Drill down to Maintenance &rarr;</button>
          </div>
        </div>

        <div className="bg-canvas rounded-xl shadow-sm border border-hairline p-6">
          <h3 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
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
              <li key={i} className="flex justify-between items-center p-3 bg-canvas rounded-lg border border-hairline">
                <div>
                  <p className="font-medium text-ink">{r.mat} ({r.source})</p>
                  <p className="text-sm text-ink-muted">{r.risk}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${r.severity === 'Critical' ? 'bg-status-critical-bg text-status-critical-fg' : r.severity === 'High' ? 'bg-status-warning-bg text-status-warning-fg' : 'bg-status-warning-bg text-status-warning-fg'}`}>
                  {r.severity}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 text-right">
            <button onClick={() => window.location.pathname = '/supply-chain'} className="text-voltage-600 text-voltage-700 text-sm font-medium">Drill down to Supply Chain &rarr;</button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Cost Summary */}
      <div className="bg-canvas rounded-xl shadow-sm border border-hairline p-6">
        <h3 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-voltage-500" />
          Financial Overview (Quarterly)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-canvas rounded-lg">
            <p className="text-sm text-ink-muted font-medium">CapEx (Vehicles & Infrastructure)</p>
            <p className="text-2xl font-bold text-ink mt-2">₹14.2 Cr</p>
            <p className="text-sm text-status-ok-fg mt-1">-5% vs Budget</p>
          </div>
          <div className="p-4 bg-canvas rounded-lg">
            <p className="text-sm text-ink-muted font-medium">OpEx (Maintenance & Operations)</p>
            <p className="text-2xl font-bold text-ink mt-2">₹3.8 Cr</p>
            <p className="text-sm text-status-critical-fg mt-1">+2% vs Budget</p>
          </div>
          <div className="p-4 bg-canvas rounded-lg">
            <p className="text-sm text-ink-muted font-medium">Projected ROI (End of Year)</p>
            <p className="text-2xl font-bold text-ink mt-2">18.5%</p>
            <p className="text-sm text-status-ok-fg mt-1">+1.5% YoY</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
