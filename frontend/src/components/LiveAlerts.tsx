import { useEffect, useState, useRef } from 'react';
import { fetchAlerts, acknowledgeAlert } from '../api';

interface Alert {
    alert_id: string;
    timestamp: string;
    severity: 'critical' | 'warning' | 'info';
    category: string;
    vehicle_id: string;
    message: string;
    value: number;
    acknowledged: boolean;
}

const SEVERITY_STYLES: Record<string, { bar: string; dot: string; text: string }> = {
    critical: { bar: 'border-l-red-600',     dot: 'bg-red-500',    text: 'text-red-700' },
    warning:  { bar: 'border-l-orange-500',  dot: 'bg-orange-500', text: 'text-orange-700' },
    info:     { bar: 'border-l-gray-400',    dot: 'bg-gray-400',   text: 'text-gray-600' },
};

const SEVERITY_LABEL: Record<string, string> = {
    critical: 'CRITICAL',
    warning: 'WARN',
    info: 'INFO',
};

export default function LiveAlerts() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [toasts, setToasts] = useState<Alert[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const seenIds = useRef<Set<string>>(new Set());
    const wsRef = useRef<WebSocket | null>(null);

    // Initial fetch from REST
    useEffect(() => {
        fetchAlerts(50).then(setAlerts).catch(() => {});
    }, []);

    // WebSocket live stream
    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname || 'localhost';
        const port = (import.meta as any).env?.VITE_API_PORT || '8000';
        const url = `${protocol}//${host}:${port}/api/alerts/stream`;

        let reconnectTimer: number | undefined;
        const connect = () => {
            try {
                const ws = new WebSocket(url);
                wsRef.current = ws;
                ws.onmessage = (event) => {
                    try {
                        const alert: Alert = JSON.parse(event.data);
                        // Dedup: skip alerts we've already seen
                        if (seenIds.current.has(alert.alert_id)) return;
                        seenIds.current.add(alert.alert_id);

                        // Add to history (newest first)
                        setAlerts(prev => [alert, ...prev].slice(0, 100));
                        // Trigger toast for warning/critical only (skip info noise)
                        if (alert.severity !== 'info') {
                            setToasts(prev => [...prev, alert].slice(-4));
                            setUnreadCount(prev => prev + 1);
                            // Auto-dismiss toast after 8s
                            setTimeout(() => {
                                setToasts(prev => prev.filter(t => t.alert_id !== alert.alert_id));
                            }, 8000);
                        }
                    } catch (e) {
                        // skip malformed messages
                    }
                };
                ws.onclose = () => {
                    wsRef.current = null;
                    // Reconnect after 5s
                    reconnectTimer = window.setTimeout(connect, 5000);
                };
                ws.onerror = () => {
                    wsRef.current?.close();
                };
            } catch (e) {
                reconnectTimer = window.setTimeout(connect, 5000);
            }
        };
        connect();
        return () => {
            if (reconnectTimer) clearTimeout(reconnectTimer);
            wsRef.current?.close();
        };
    }, []);

    const handleAcknowledge = async (alertId: string) => {
        try {
            await acknowledgeAlert(alertId);
            setAlerts(prev => prev.map(a => a.alert_id === alertId ? { ...a, acknowledged: true } : a));
            setToasts(prev => prev.filter(t => t.alert_id !== alertId));
        } catch (e) {
            // ack failed; keep UI unchanged
        }
    };

    const dismissToast = (alertId: string) => {
        setToasts(prev => prev.filter(t => t.alert_id !== alertId));
    };

    const openHistory = () => {
        setShowHistory(true);
        setUnreadCount(0);
    };

    const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length;
    const warningCount = alerts.filter(a => a.severity === 'warning' && !a.acknowledged).length;

    return (
        <>
            {/* Floating action button — bottom-right */}
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={openHistory}
                    className="relative bg-gray-900 hover:bg-gray-800 text-white rounded-full p-3.5 shadow-lg transition-colors"
                    aria-label="View alerts"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Toast stack — top-right */}
            <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
                {toasts.map(toast => {
                    const styles = SEVERITY_STYLES[toast.severity];
                    return (
                        <div
                            key={toast.alert_id}
                            className={`pointer-events-auto bg-white rounded-lg shadow-lg border border-gray-200 border-l-4 ${styles.bar} p-3 max-w-sm animate-in slide-in-from-right`}
                        >
                            <div className="flex items-start gap-3">
                                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${styles.dot}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${styles.text}`}>
                                            {SEVERITY_LABEL[toast.severity]}
                                        </span>
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">{toast.category}</span>
                                    </div>
                                    <p className="text-xs font-medium text-gray-900 leading-snug">{toast.vehicle_id}</p>
                                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{toast.message}</p>
                                </div>
                                <button
                                    onClick={() => dismissToast(toast.alert_id)}
                                    className="shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none"
                                    aria-label="Dismiss"
                                >
                                    ×
                                </button>
                            </div>
                            <button
                                onClick={() => handleAcknowledge(toast.alert_id)}
                                className="mt-2 text-[10px] uppercase tracking-wider font-medium text-gray-500 hover:text-gray-900"
                            >
                                Acknowledge
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* History drawer */}
            {showHistory && (
                <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowHistory(false)}>
                    <div
                        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold text-gray-900 tracking-tight">Live Alerts</h2>
                                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mt-0.5">
                                    {criticalCount} critical · {warningCount} warning · streaming
                                </p>
                            </div>
                            <button
                                onClick={() => setShowHistory(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                            {alerts.length === 0 ? (
                                <div className="p-8 text-center text-sm text-gray-500">
                                    No alerts yet. Waiting for scheduler to scan...
                                </div>
                            ) : alerts.map(alert => {
                                const styles = SEVERITY_STYLES[alert.severity];
                                return (
                                    <div
                                        key={alert.alert_id}
                                        className={`px-5 py-3 hover:bg-gray-50 transition-colors ${alert.acknowledged ? 'opacity-50' : ''}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${styles.dot}`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${styles.text}`}>
                                                        {SEVERITY_LABEL[alert.severity]}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">{alert.category}</span>
                                                    <span className="text-[10px] text-gray-400 font-mono ml-auto shrink-0">
                                                        {alert.timestamp.slice(11, 19)} UTC
                                                    </span>
                                                </div>
                                                <p className="text-xs font-medium text-gray-900">{alert.vehicle_id}</p>
                                                <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{alert.message}</p>
                                            </div>
                                            {!alert.acknowledged && (
                                                <button
                                                    onClick={() => handleAcknowledge(alert.alert_id)}
                                                    className="shrink-0 text-[10px] uppercase tracking-wider font-medium text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
                                                >
                                                    Ack
                                                </button>
                                            )}
                                            {alert.acknowledged && (
                                                <span className="shrink-0 text-[10px] uppercase tracking-wider font-medium text-gray-400">
                                                    ✓
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
