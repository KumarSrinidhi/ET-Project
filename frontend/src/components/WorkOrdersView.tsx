import { useState, useEffect } from 'react';
import { fetchWorkOrders, updateWorkOrder, createWorkOrder, fetchMaintenanceSchedule } from '../api';
import type { WorkOrder, ScheduledTask } from '../api';
import { Wrench, Plus, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
    scheduled: 'bg-status-info-bg text-status-info-fg border border-status-info-border',
    in_progress: 'bg-voltage-50 text-voltage-700 border border-voltage-200',
    completed: 'bg-status-ok-bg text-status-ok-fg border border-status-ok-border',
    on_hold: 'bg-canvas-sunken text-ink-muted border border-hairline',
    cancelled: 'bg-status-critical-bg text-status-critical-fg border border-status-critical-border',
};

const PRIORITY_BADGE: Record<string, string> = {
    critical: 'bg-status-critical-bg text-status-critical-fg border border-status-critical-border',
    high: 'bg-status-warning-bg text-status-warning-fg border border-status-warning-border',
    medium: 'bg-voltage-50 text-voltage-700 border border-voltage-200',
    low: 'bg-canvas-sunken text-ink-muted border border-hairline',
};

interface Props {
    selectedDepotId: string | null;
}

export default function WorkOrdersView({ selectedDepotId }: Props) {
    const [orders, setOrders] = useState<WorkOrder[]>([]);
    const [scheduleTasks, setScheduleTasks] = useState<ScheduledTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createVehicleId, setCreateVehicleId] = useState('EV-001');
    const [createTaskType, setCreateTaskType] = useState('Preventive Inspection');
    const [createPriority, setCreatePriority] = useState('medium');
    const [createCost, setCreateCost] = useState('5000');

    const loadData = () => {
        setLoading(true);
        Promise.all([
            fetchWorkOrders(selectedDepotId),
            fetchMaintenanceSchedule(selectedDepotId)
        ])
            .then(([ordersData, scheduleData]) => {
                setOrders(ordersData);
                setScheduleTasks(scheduleData.schedule || []);
                setError(null);
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadData(); }, [selectedDepotId]);

    const handleStatusChange = (orderId: string, newStatus: string) => {
        updateWorkOrder(orderId, { status: newStatus }).then(() => loadData());
    };

    const handleCreateFromSchedule = (task: ScheduledTask) => {
        createWorkOrder({
            vehicle_id: task.vehicle_id,
            task_type: task.task_type,
            priority: task.priority,
            technician: task.technician_name,
            bay: task.bay_name,
            estimated_cost_inr: task.estimated_cost_inr,
            depot_id: selectedDepotId || '',
        }).then(() => loadData());
    };

    const handleCreateManual = () => {
        createWorkOrder({
            vehicle_id: createVehicleId,
            task_type: createTaskType,
            priority: createPriority,
            estimated_cost_inr: parseFloat(createCost) || 0,
            depot_id: selectedDepotId || '',
        }).then(() => {
            setShowCreateForm(false);
            loadData();
        });
    };

    const getStatusCounts = () => {
        const counts: Record<string, number> = {};
        orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
        return counts;
    };

    const statusCounts = getStatusCounts();
    const unlinkedTasks = scheduleTasks.filter(st =>
        !orders.some(o => o.vehicle_id === st.vehicle_id && o.task_type === st.task_type)
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-voltage-500"></div>
                <span className="ml-3 text-ink-muted">Loading work orders...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-status-critical-bg border border-status-critical-border rounded-lg">
                <p className="text-status-critical-fg">Failed to load work orders: {error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-ink tracking-tight">Work Orders</h2>
                    <p className="text-sm text-ink-muted mt-1">Manage and track maintenance work orders</p>
                </div>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    aria-expanded={showCreateForm}
                    className="flex items-center gap-2 px-4 py-2 bg-voltage-500 text-graphite-950 rounded-lg hover:bg-voltage-600 active:bg-voltage-700 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-voltage-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                    <Plus className="w-4 h-4" /> New Work Order
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-canvas rounded-xl p-4 border border-hairline shadow-sm">
                    <p className="text-[11px] uppercase tracking-wider text-ink-faint font-medium">Total</p>
                    <p className="text-2xl font-mono font-bold text-ink mt-1">{orders.length}</p>
                </div>
                <div className="bg-canvas rounded-xl p-4 border border-hairline shadow-sm">
                    <p className="text-[11px] uppercase tracking-wider text-ink-faint font-medium">In Progress</p>
                    <p className="text-2xl font-mono font-bold text-voltage-600 mt-1">{statusCounts['in_progress'] || 0}</p>
                </div>
                <div className="bg-canvas rounded-xl p-4 border border-hairline shadow-sm">
                    <p className="text-[11px] uppercase tracking-wider text-ink-faint font-medium">Completed</p>
                    <p className="text-2xl font-mono font-bold text-green-600 mt-1">{statusCounts['completed'] || 0}</p>
                </div>
                <div className="bg-canvas rounded-xl p-4 border border-hairline shadow-sm">
                    <p className="text-[11px] uppercase tracking-wider text-ink-faint font-medium">Scheduled</p>
                    <p className="text-2xl font-mono font-bold text-voltage-600 mt-1">{statusCounts['scheduled'] || 0}</p>
                </div>
            </div>

            {/* Create Form */}
            {showCreateForm && (
                <div className="bg-canvas rounded-xl border border-hairline shadow-sm p-6">
                    <h3 className="font-bold text-ink mb-4">Create Work Order</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-xs text-ink-muted mb-1">Vehicle ID</label>
                            <input value={createVehicleId} onChange={e => setCreateVehicleId(e.target.value)}
                                className="w-full border border-hairline rounded-lg px-3 py-2 text-base sm:text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs text-ink-muted mb-1">Task Type</label>
                            <select value={createTaskType} onChange={e => setCreateTaskType(e.target.value)}
                                className="w-full border border-hairline rounded-lg px-3 py-2 text-base sm:text-sm">
                                {['Preventive Inspection', 'Battery Swap', 'Thermal Inspection', 'SoH Inspection', 'Charging Calibration', 'Coolant Service', 'Brake Service'].map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-ink-muted mb-1">Priority</label>
                            <select value={createPriority} onChange={e => setCreatePriority(e.target.value)}
                                className="w-full border border-hairline rounded-lg px-3 py-2 text-base sm:text-sm">
                                {['low', 'medium', 'high', 'critical'].map(p => (
                                    <option key={p} value={p} className="capitalize">{p}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs text-ink-muted mb-1">Estimated Cost (₹)</label>
                        <input type="number" value={createCost} onChange={e => setCreateCost(e.target.value)}
                            className="w-full md:w-48 border border-hairline rounded-lg px-3 py-2 text-base sm:text-sm font-mono" />
                    </div>
                    <button onClick={handleCreateManual}
                        className="px-4 py-2 bg-voltage-500 text-graphite-950 rounded-lg hover:bg-voltage-600 text-sm font-medium">
                        Create Order
                    </button>
                </div>
            )}

            {/* Unlinked Schedule Tasks */}
            {unlinkedTasks.length > 0 && (
                <div className="bg-voltage-50 border border-voltage-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-voltage-600" />
                        <h3 className="text-sm font-bold text-voltage-700">{unlinkedTasks.length} scheduled tasks without work orders</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {unlinkedTasks.slice(0, 6).map((task, i) => (
                            <div key={i} className="flex items-center justify-between bg-canvas rounded-lg p-3 border border-voltage-200">
                                <div>
                                    <p className="text-sm font-medium text-ink">{task.vehicle_id}</p>
                                    <p className="text-xs text-ink-muted">{task.task_type} - {task.technician_name}</p>
                                </div>
                                <button onClick={() => handleCreateFromSchedule(task)}
                                    className="px-3 py-1 bg-voltage-500 text-graphite-950 rounded text-xs hover:bg-voltage-600">
                                    Create WO
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Work Orders Table */}
            <div className="bg-canvas rounded-xl border border-hairline shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-hairline bg-canvas-sunken">
                                <th className="hidden lg:table-cell text-left px-4 py-3 text-[11px] uppercase tracking-wider text-ink-faint font-medium">Order ID</th>
                                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-ink-faint font-medium">Vehicle</th>
                                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-ink-faint font-medium">Task</th>
                                <th className="hidden md:table-cell text-left px-4 py-3 text-[11px] uppercase tracking-wider text-ink-faint font-medium">Priority</th>
                                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-ink-faint font-medium">Status</th>
                                <th className="hidden md:table-cell text-left px-4 py-3 text-[11px] uppercase tracking-wider text-ink-faint font-medium">Technician</th>
                                <th className="hidden lg:table-cell text-right px-4 py-3 text-[11px] uppercase tracking-wider text-ink-faint font-medium">Est. Cost</th>
                                <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-ink-faint font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {orders.map(order => (
                                <tr key={order.id} className="hover:bg-canvas-sunken transition-colors">
                                    <td className="hidden lg:table-cell px-4 py-3 text-xs font-mono text-ink-muted">{order.id}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-ink">{order.vehicle_id}</td>
                                    <td className="px-4 py-3 text-sm text-ink">{order.task_type}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${PRIORITY_BADGE[order.priority] || 'bg-canvas-sunken text-ink-muted'}`}>
                                            {order.priority}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] || 'bg-canvas-sunken text-ink-muted'}`}>
                                            {order.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-ink-muted">{order.technician || '—'}</td>
                                    <td className="hidden lg:table-cell px-4 py-3 text-sm font-mono text-right text-ink">{order.estimated_cost_inr > 0 ? `₹${order.estimated_cost_inr.toLocaleString('en-IN')}` : '—'}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {order.status === 'scheduled' && (
                                                <button onClick={() => handleStatusChange(order.id, 'in_progress')}
                                                    aria-label={`Start work on ${order.id}`} title="Start Work" className="p-1.5 rounded hover:bg-voltage-50 text-voltage-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-voltage-500">
                                                    <Wrench className="w-4 h-4" />
                                                </button>
                                            )}
                                            {order.status === 'in_progress' && (
                                                <button onClick={() => handleStatusChange(order.id, 'completed')}
                                                    aria-label={`Mark ${order.id} complete`} title="Mark Complete" className="p-1.5 rounded hover:bg-status-ok-bg text-status-ok-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-voltage-500">
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                            {order.status !== 'completed' && order.status !== 'cancelled' && (
                                                <button onClick={() => handleStatusChange(order.id, 'on_hold')}
                                                    aria-label={`Put ${order.id} on hold`} title="Put On Hold" className="p-1.5 rounded hover:bg-canvas-sunken text-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-voltage-500">
                                                    <Clock className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-muted">
                                    <span className="hidden md:inline">No work orders yet. Create one from the schedule or manually.</span>
                                    <span className="md:hidden">No work orders yet.</span>
                                        No work orders yet. Create one from the schedule or manually.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}










