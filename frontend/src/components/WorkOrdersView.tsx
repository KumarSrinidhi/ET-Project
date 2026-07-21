import { useState, useEffect } from 'react';
import { fetchWorkOrders, updateWorkOrder, createWorkOrder, fetchMaintenanceSchedule } from '../api';
import type { WorkOrder, ScheduledTask } from '../api';
import { Wrench, Plus, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-amber-100 text-amber-800',
    completed: 'bg-green-100 text-green-800',
    on_hold: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
};

const PRIORITY_BADGE: Record<string, string> = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-blue-100 text-blue-800',
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-500">Loading work orders...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700">Failed to load work orders: {error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Work Orders</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage and track maintenance work orders</p>
                </div>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-medium"
                >
                    <Plus className="w-4 h-4" /> New Work Order
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Total</p>
                    <p className="text-2xl font-mono font-bold text-gray-900 mt-1">{orders.length}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">In Progress</p>
                    <p className="text-2xl font-mono font-bold text-amber-600 mt-1">{statusCounts['in_progress'] || 0}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Completed</p>
                    <p className="text-2xl font-mono font-bold text-green-600 mt-1">{statusCounts['completed'] || 0}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Scheduled</p>
                    <p className="text-2xl font-mono font-bold text-blue-600 mt-1">{statusCounts['scheduled'] || 0}</p>
                </div>
            </div>

            {/* Create Form */}
            {showCreateForm && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <h3 className="font-bold text-gray-800 mb-4">Create Work Order</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Vehicle ID</label>
                            <input value={createVehicleId} onChange={e => setCreateVehicleId(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Task Type</label>
                            <select value={createTaskType} onChange={e => setCreateTaskType(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                                {['Preventive Inspection', 'Battery Swap', 'Thermal Inspection', 'SoH Inspection', 'Charging Calibration', 'Coolant Service', 'Brake Service'].map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Priority</label>
                            <select value={createPriority} onChange={e => setCreatePriority(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                                {['low', 'medium', 'high', 'critical'].map(p => (
                                    <option key={p} value={p} className="capitalize">{p}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs text-gray-500 mb-1">Estimated Cost (₹)</label>
                        <input type="number" value={createCost} onChange={e => setCreateCost(e.target.value)}
                            className="w-full md:w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" />
                    </div>
                    <button onClick={handleCreateManual}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-medium">
                        Create Order
                    </button>
                </div>
            )}

            {/* Unlinked Schedule Tasks */}
            {unlinkedTasks.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <h3 className="text-sm font-bold text-amber-800">{unlinkedTasks.length} scheduled tasks without work orders</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {unlinkedTasks.slice(0, 6).map((task, i) => (
                            <div key={i} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-100">
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{task.vehicle_id}</p>
                                    <p className="text-xs text-gray-500">{task.task_type} - {task.technician_name}</p>
                                </div>
                                <button onClick={() => handleCreateFromSchedule(task)}
                                    className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-500">
                                    Create WO
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Work Orders Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Order ID</th>
                                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Vehicle</th>
                                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Task</th>
                                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Priority</th>
                                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Status</th>
                                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Technician</th>
                                <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Est. Cost</th>
                                <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {orders.map(order => (
                                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-4 py-3 text-xs font-mono text-gray-500">{order.id}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{order.vehicle_id}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{order.task_type}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${PRIORITY_BADGE[order.priority] || 'bg-gray-100 text-gray-800'}`}>
                                            {order.priority}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                                            {order.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{order.technician || '—'}</td>
                                    <td className="px-4 py-3 text-sm font-mono text-right text-gray-700">{order.estimated_cost_inr > 0 ? `₹${order.estimated_cost_inr.toLocaleString('en-IN')}` : '—'}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {order.status === 'scheduled' && (
                                                <button onClick={() => handleStatusChange(order.id, 'in_progress')}
                                                    title="Start Work"
                                                    className="p-1.5 rounded hover:bg-amber-100 text-amber-600">
                                                    <Wrench className="w-4 h-4" />
                                                </button>
                                            )}
                                            {order.status === 'in_progress' && (
                                                <button onClick={() => handleStatusChange(order.id, 'completed')}
                                                    title="Mark Complete"
                                                    className="p-1.5 rounded hover:bg-green-100 text-green-600">
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                            {order.status !== 'completed' && order.status !== 'cancelled' && (
                                                <button onClick={() => handleStatusChange(order.id, 'on_hold')}
                                                    title="Put On Hold"
                                                    className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                                                    <Clock className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
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
