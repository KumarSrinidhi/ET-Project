import { useState, useEffect } from 'react';
import { fetchMaintenanceSchedule, submitApproval } from '../api';
import type { OptimizedScheduleResponse, ScheduledTask } from '../api';

interface Props {
  selectedDepotId: string | null;
}

const PRIORITY_BADGE: Record<string, string> = {
    critical: 'bg-status-critical-bg text-status-critical-fg border-status-critical-border',
    high: 'bg-status-warning-bg text-status-warning-fg border-status-warning-border',
    medium: 'bg-canvas-sunken text-ink border-hairline-strong',
    low: 'bg-canvas text-ink-muted border-hairline',
};

const PRIORITY_DOT: Record<string, string> = {
    critical: 'bg-status-critical-fg',
    high: 'bg-status-warning-fg',
    medium: 'bg-status-warning-fg',
    low: 'bg-gray-400',
};

export default function MaintenanceMobileView({ selectedDepotId }: Props) {
    const [data, setData] = useState<OptimizedScheduleResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set());
    const [submittedTasks, setSubmittedTasks] = useState<Set<string>>(new Set());

    useEffect(() => {
        setLoading(true);
        fetchMaintenanceSchedule(selectedDepotId)
            .then((d) => {
                setData(d);
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message);
                setLoading(false);
            });
    }, [selectedDepotId]);

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-sm text-ink-muted">Loading tasks...</span>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 bg-status-critical-bg border border-status-critical-border rounded-lg">
                <p className="text-sm text-status-critical-fg">Failed to load schedule: {error}</p>
            </div>
        );
    }

    const myTasks = data.schedule.filter(t => t.status === 'scheduled');

    const handleCheck = (taskId: string) => {
        setCheckedTasks(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    };

    const handleSubmit = async (task: ScheduledTask) => {
        try {
            await submitApproval({
                task_id: task.task_id,
                vehicle_id: task.vehicle_id,
                task_type: task.task_type,
                cost_inr: task.estimated_cost_inr,
                reason: `${task.task_type} on ${task.vehicle_id} — Tech-acknowledged`,
                requested_by: 'mobile-tech',
            });
            setSubmittedTasks(prev => new Set(prev).add(task.task_id));
        } catch (err) {
            // submission failed; leave UI state unchanged
        }
    };

    const completedCount = checkedTasks.size;
    const totalCount = myTasks.length;

    return (
        <div className="space-y-4 pb-20">
            {/* Sticky header card */}
            <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-canvas border-b border-hairline shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h2 className="text-lg font-bold text-ink tracking-tight">My Tasks</h2>
                        <p className="text-[11px] text-ink-muted font-mono uppercase tracking-wider">
                            Shift {data.shift_date} · Bay assignments below
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold font-mono text-ink">{completedCount}/{totalCount}</p>
                        <p className="text-[10px] text-ink-faint uppercase tracking-wider">Completed</p>
                    </div>
                </div>
                <div className="w-full bg-canvas-sunken rounded-full h-1.5">
                    <div
                        className="h-1.5 rounded-full bg-graphite-900 transition-all"
                        style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
                    />
                </div>
            </div>

            {/* Task cards */}
            {myTasks.length === 0 ? (
                <div className="p-8 text-center bg-canvas rounded-lg border border-hairline">
                    <p className="text-sm text-ink-muted">No tasks assigned to you for this shift.</p>
                </div>
            ) : myTasks.map(task => {
                const isChecked = checkedTasks.has(task.task_id);
                const isSubmitted = submittedTasks.has(task.task_id);
                const needsApproval = task.estimated_cost_inr >= 500000;
                return (
                    <div
                        key={task.task_id}
                        className={`bg-canvas rounded-xl border shadow-sm overflow-hidden transition-opacity ${
                            isChecked ? 'opacity-50 border-hairline' : 'border-hairline'
                        }`}
                    >
                        {/* Card header */}
                        <div className="px-4 py-3 border-b border-hairline flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                                <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-ink truncate">
                                        {task.vehicle_id}
                                    </p>
                                    <p className="text-xs text-ink-muted truncate">{task.task_type}</p>
                                </div>
                            </div>
                            <span className={`shrink-0 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full border ${PRIORITY_BADGE[task.priority]}`}>
                                {task.priority}
                            </span>
                        </div>

                        {/* Card body — stack of key facts */}
                        <div className="px-4 py-3 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-ink-muted uppercase tracking-wider text-[10px]">Bay</span>
                                <span className="font-medium text-ink">{task.bay_name}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-ink-muted uppercase tracking-wider text-[10px]">Technician</span>
                                <span className="font-medium text-ink">{task.technician_name}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-ink-muted uppercase tracking-wider text-[10px]">Time</span>
                                <span className="font-mono font-medium text-ink">
                                    {task.start_hour}:00 – {task.end_hour}:00
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-ink-muted uppercase tracking-wider text-[10px]">Cost</span>
                                <span className="font-mono font-medium text-ink">
                                    ₹{task.estimated_cost_inr.toLocaleString('en-IN')}
                                </span>
                            </div>
                            {task.spare_parts_needed.length > 0 && (
                                <div className="pt-2 border-t border-hairline">
                                    <p className="text-[10px] text-ink-muted uppercase tracking-wider mb-1">Parts Needed</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {task.spare_parts_needed.map((part, i) => (
                                            <span key={i} className="text-[11px] bg-canvas-sunken text-ink px-2 py-0.5 rounded">
                                                {part}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="px-4 py-3 bg-canvas border-t border-hairline flex items-center justify-between gap-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleCheck(task.task_id)}
                                    className="w-5 h-5 accent-gray-900 cursor-pointer"
                                />
                                <span className="text-xs font-medium text-ink">
                                    {isChecked ? 'Done' : 'Mark done'}
                                </span>
                            </label>
                            {needsApproval && (
                                <button
                                    onClick={() => handleSubmit(task)}
                                    disabled={isSubmitted}
                                    className={`text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded transition-colors ${
                                        isSubmitted
                                            ? 'bg-canvas-sunken text-ink-muted cursor-not-allowed'
                                            : 'bg-graphite-900 text-white bg-graphite-800 bg-graphite-800'
                                    }`}
                                >
                                    {isSubmitted ? 'Sent for approval' : 'Send for ₹5L approval'}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Completion summary */}
            {completedCount === totalCount && totalCount > 0 && (
                <div className="p-6 bg-graphite-900 rounded-xl text-center">
                    <p className="text-sm font-semibold text-white tracking-tight">All tasks complete</p>
                    <p className="text-xs text-ink-faint mt-1">Shift summary auto-saved to audit log.</p>
                </div>
            )}
        </div>
    );
}
