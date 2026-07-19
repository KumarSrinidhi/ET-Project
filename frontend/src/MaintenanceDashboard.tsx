import { useState, useEffect } from 'react';
import { fetchMaintenanceSchedule } from './api';
import type { OptimizedScheduleResponse, ScheduledTask } from './api';
import DashboardShell from './components/DashboardShell';

const PRIORITY_COLORS: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-400',
};

const PRIORITY_BADGE: Record<string, string> = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-blue-100 text-blue-800',
};

const BAY_COLORS = ['bg-indigo-400', 'bg-emerald-400', 'bg-purple-400', 'bg-cyan-400'];

import { useAuth } from './AuthContext';

export default function MaintenanceDashboard({ selectedDepotId }: { selectedDepotId: string | null }) {
    const { roleView } = useAuth();
    const [data, setData] = useState<OptimizedScheduleResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        fetchMaintenanceSchedule(selectedDepotId)
            .then(setData)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [selectedDepotId]);

    return (
      <DashboardShell loading={loading} error={error} loadingMessage="Optimizing maintenance schedule...">
        {data && <MaintenanceContent data={data} roleView={roleView} />}
      </DashboardShell>
    );
}

function MaintenanceContent({ data, roleView }: { data: OptimizedScheduleResponse; roleView: any }) {

    const { schedule, kpis, shift_date, constraints_summary } = data;
    const scheduledTasks = schedule.filter((t) => t.status === 'scheduled');
    const delayedTasks = schedule.filter((t) => t.status === 'delayed_parts');
    const overflowTasks = schedule.filter((t) => t.status === 'overflow');

    // Group scheduled tasks by bay for Gantt chart
    const bayGroups: Record<string, ScheduledTask[]> = {};
    scheduledTasks.forEach((task) => {
        if (!bayGroups[task.bay_name]) bayGroups[task.bay_name] = [];
        bayGroups[task.bay_name].push(task);
    });

    const SHIFT_START = 6;
    const SHIFT_END = 22;
    const TOTAL_HOURS = SHIFT_END - SHIFT_START;

    return (
        <div className="mt-12 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Maintenance Operations Optimiser</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Constraint-based scheduling • {constraints_summary.shift_window} • {constraints_summary.bays_available} Bays • {constraints_summary.technicians_available} Technicians
                    </p>
                </div>
                <div className="text-right">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Schedule Date</span>
                    <p className="text-lg font-semibold text-gray-700">{shift_date}</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <KPICard label="Total Tasks" value={kpis.total_tasks} color="text-gray-800" />
                <KPICard label="Scheduled" value={kpis.scheduled_tasks} color="text-green-600" />
                <KPICard label="Overflow" value={kpis.overflow_tasks} color="text-red-600" />
                <KPICard label="Delayed (Parts)" value={kpis.delayed_tasks} color="text-amber-600" />
                <KPICard label="Total Cost" value={`₹${kpis.total_cost_inr.toLocaleString('en-IN')}`} color="text-blue-700" />
                <KPICard label="Critical Same-Day" value={`${kpis.critical_tasks_same_day_pct}%`} color="text-green-700" />
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Avg Wait Time</p>
                    <p className="text-2xl font-bold text-gray-800">{kpis.avg_wait_hours}h</p>
                    <p className="text-xs text-gray-500 mt-1">From shift start to task begin</p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Fleet Downtime</p>
                    <p className="text-2xl font-bold text-gray-800">{kpis.total_downtime_hours}h</p>
                    <p className="text-xs text-gray-500 mt-1">Cumulative maintenance hours</p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Throughput</p>
                    <p className="text-2xl font-bold text-gray-800">{kpis.throughput_tasks_per_shift}</p>
                    <p className="text-xs text-gray-500 mt-1">Tasks per 8-hour shift</p>
                </div>
            </div>

            {/* Bay Utilization Bars */}
            {!roleView?.hiddenWidgets?.includes('maintenanceSchedule') && (
            <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Bay Utilization</h3>
                <div className="space-y-3">
                    {['Bay A - Heavy Duty', 'Bay B - General', 'Bay C - General', 'Bay D - Quick Service'].map((name, idx) => (
                        <div key={name} className="flex items-center gap-3">
                            <span className="text-xs text-gray-600 w-36 truncate">{name}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                <div
                                    className={`h-4 rounded-full ${BAY_COLORS[idx]} transition-all`}
                                    style={{ width: `${kpis.bay_utilization_pct[idx] || 0}%` }}
                                />
                            </div>
                            <span className="text-xs font-medium text-gray-700 w-12 text-right">
                                {kpis.bay_utilization_pct[idx] || 0}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            )}

            {/* Gantt Chart */}
            {!roleView?.hiddenWidgets?.includes('maintenanceSchedule') && (
            <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Schedule Timeline (Gantt)</h3>

                {/* Time axis */}
                <div className="flex items-center mb-2 ml-36">
                    {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                        <span key={i} className="text-[10px] text-gray-400" style={{ width: `${100 / TOTAL_HOURS}%` }}>
                            {SHIFT_START + i}:00
                        </span>
                    ))}
                </div>

                {/* Bay rows */}
                <div className="space-y-2">
                    {Object.entries(bayGroups).map(([bayName, tasks]) => (
                        <div key={bayName} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-36 truncate font-medium">{bayName}</span>
                            <div className="flex-1 relative bg-gray-50 rounded h-10 border border-gray-100">
                                {tasks.map((task) => {
                                    const left = ((task.start_hour - SHIFT_START) / TOTAL_HOURS) * 100;
                                    const width = ((task.end_hour - task.start_hour) / TOTAL_HOURS) * 100;
                                    return (
                                        <div
                                            key={task.task_id}
                                            className={`absolute top-1 h-8 rounded ${PRIORITY_COLORS[task.priority]} opacity-85 flex items-center px-1 overflow-hidden cursor-pointer hover:opacity-100 transition-opacity`}
                                            style={{ left: `${left}%`, width: `${width}%` }}
                                            title={`${task.vehicle_id} - ${task.task_type}\n${task.start_hour}:00 - ${task.end_hour}:00\nTech: ${task.technician_name}`}
                                        >
                                            <span className="text-[10px] text-white font-medium truncate">
                                                {task.vehicle_id}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Legend */}
                <div className="flex gap-4 mt-4 pt-3 border-t border-gray-100">
                    {Object.entries(PRIORITY_COLORS).map(([priority, color]) => (
                        <div key={priority} className="flex items-center gap-1">
                            <div className={`w-3 h-3 rounded ${color}`} />
                            <span className="text-xs text-gray-500 capitalize">{priority}</span>
                        </div>
                    ))}
                </div>
            </div>
            )}

            {/* Scheduled Tasks Table */}
            {!roleView?.hiddenWidgets?.includes('workOrderList') && (
            <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                    Scheduled Tasks ({scheduledTasks.length})
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                            <tr>
                                <th className="px-3 py-2">Task ID</th>
                                <th className="px-3 py-2">Vehicle</th>
                                <th className="px-3 py-2">Type</th>
                                <th className="px-3 py-2">Priority</th>
                                <th className="px-3 py-2">Bay</th>
                                <th className="px-3 py-2">Technician</th>
                                <th className="px-3 py-2">Time</th>
                                <th className="px-3 py-2">Cost</th>
                                <th className="px-3 py-2">Parts</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scheduledTasks.map((task) => (
                                <tr key={task.task_id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-3 py-2 font-mono text-xs">{task.task_id}</td>
                                    <td className="px-3 py-2 font-medium text-gray-900">{task.vehicle_id}</td>
                                    <td className="px-3 py-2 text-xs">{task.task_type}</td>
                                    <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded capitalize ${PRIORITY_BADGE[task.priority]}`}>
                                            {task.priority}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs">{task.bay_name}</td>
                                    <td className="px-3 py-2 text-xs">{task.technician_name}</td>
                                    <td className="px-3 py-2 text-xs font-mono">{task.start_hour}:00–{task.end_hour}:00</td>
                                    <td className="px-3 py-2 text-xs">{(task as any).estimated_cost_inr != null ? `₹${(task as any).estimated_cost_inr.toLocaleString('en-IN')}` : '--'}</td>
                                    <td className="px-3 py-2 text-xs text-gray-400">{task.spare_parts_needed.join(', ') || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {/* Delayed & Overflow */}
            {(delayedTasks.length > 0 || overflowTasks.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {delayedTasks.length > 0 && (
                        <div className="p-5 bg-amber-50 rounded-lg border border-amber-200">
                            <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wider mb-3">
                                Delayed — Awaiting Parts ({delayedTasks.length})
                            </h3>
                            {delayedTasks.map((task) => (
                                <div key={task.task_id} className="flex justify-between items-center py-2 border-b border-amber-100 last:border-0">
                                    <div>
                                        <span className="font-medium text-gray-900 text-sm">{task.vehicle_id}</span>
                                        <span className="text-xs text-gray-500 ml-2">{task.task_type}</span>
                                    </div>
                                    <span className="text-xs text-amber-700">Needs: {task.spare_parts_needed.join(', ')}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {overflowTasks.length > 0 && (
                        <div className="p-5 bg-red-50 rounded-lg border border-red-200">
                            <h3 className="text-sm font-semibold text-red-800 uppercase tracking-wider mb-3">
                                Overflow — Next Day ({overflowTasks.length})
                            </h3>
                            {overflowTasks.map((task) => (
                                <div key={task.task_id} className="flex justify-between items-center py-2 border-b border-red-100 last:border-0">
                                    <div>
                                        <span className="font-medium text-gray-900 text-sm">{task.vehicle_id}</span>
                                        <span className="text-xs text-gray-500 ml-2">{task.task_type}</span>
                                    </div>
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded capitalize ${PRIORITY_BADGE[task.priority]}`}>
                                        {task.priority}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Constraints Summary */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-500">
                <span className="font-semibold text-gray-700">Optimization Method: </span>
                {constraints_summary.optimization_method} •
                <span className="ml-2 font-semibold text-gray-700">Shift Pattern: </span>
                {constraints_summary.shift_pattern} •
                <span className="ml-2 font-semibold text-gray-700">Priority Levels: </span>
                {constraints_summary.priority_levels?.join(' → ')}
            </div>
        </div>
    );
}

function KPICard({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
        </div>
    );
}
