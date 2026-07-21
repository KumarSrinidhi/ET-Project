import { useState, useEffect } from 'react';
import { fetchPartsInventory, updatePartQuantity } from '../api';
import type { PartItem } from '../api';
import { AlertTriangle, TrendingDown } from 'lucide-react';

export default function PartsInventoryView() {
    const [parts, setParts] = useState<PartItem[]>([]);
    const [lowStock, setLowStock] = useState<PartItem[]>([]);
    const [totalValue, setTotalValue] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingPart, setEditingPart] = useState<{ id: number; value: string } | null>(null);
    const [savingPart, setSavingPart] = useState(false);

    const loadData = () => {
        setLoading(true);
        fetchPartsInventory()
            .then(data => {
                setParts(data.parts);
                setLowStock(data.low_stock);
                setTotalValue(data.total_value_inr);
                setError(null);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadData(); }, []);

    const startEdit = (part: PartItem) => {
        setEditingPart({ id: part.id, value: String(part.quantity) });
    };

    const cancelEdit = () => {
        setEditingPart(null);
    };

    const saveEdit = async (partName: string) => {
        if (!editingPart) return;
        const qty = parseInt(editingPart.value, 10);
        if (isNaN(qty) || qty < 0) {
            cancelEdit();
            return;
        }
        setSavingPart(true);
        try {
            await updatePartQuantity(partName, qty);
            setEditingPart(null);
            await loadData();
        } finally {
            setSavingPart(false);
        }
    };

    const handleEditKey = (e: React.KeyboardEvent<HTMLInputElement>, partName: string) => {
        if (e.key === 'Enter') saveEdit(partName);
        if (e.key === 'Escape') cancelEdit();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-voltage-500"></div>
                <span className="ml-3 text-ink-muted">Loading parts inventory...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-status-critical-bg border border-status-critical-border rounded-lg">
                <p className="text-status-critical-fg">Failed to load parts inventory: {error}</p>
            </div>
        );
    }

    const getStockLevelClass = (qty: number, threshold: number) => {
        if (qty <= 0) return 'text-status-critical-fg font-bold';
        if (qty <= threshold) return 'text-status-warning-fg font-bold';
        return 'text-ink';
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-ink tracking-tight">Parts Inventory</h2>
                <p className="text-sm text-ink-muted mt-1">Manage spare parts, monitor stock levels, and track low-stock alerts</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-canvas rounded-xl p-4 border border-hairline shadow-sm">
                    <p className="text-[11px] uppercase tracking-wider text-ink-faint font-medium">Total Parts</p>
                    <p className="text-2xl font-mono font-bold text-ink mt-1">{parts.length}</p>
                </div>
                <div className="bg-canvas rounded-xl p-4 border border-hairline shadow-sm">
                    <p className="text-[11px] uppercase tracking-wider text-ink-faint font-medium">Low Stock Alerts</p>
                    <p className={`text-2xl font-mono font-bold mt-1 ${lowStock.length > 0 ? 'text-status-warning-fg' : 'text-ink'}`}>
                        {lowStock.length}
                    </p>
                </div>
                <div className="bg-canvas rounded-xl p-4 border border-hairline shadow-sm">
                    <p className="text-[11px] uppercase tracking-wider text-ink-faint font-medium">Total Value</p>
                    <p className="text-2xl font-mono font-bold text-ink mt-1">₹{totalValue.toLocaleString('en-IN')}</p>
                </div>
            </div>

            {/* Low Stock Alerts */}
            {lowStock.length > 0 && (
                <div className="bg-status-warning-bg border border-status-warning-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-status-warning-fg" />
                        <h3 className="text-sm font-bold text-status-warning-fg">Low Stock Warnings</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {lowStock.map(part => (
                            <div key={part.id} className="flex items-center justify-between bg-canvas rounded-lg p-3 border border-status-warning-border">
                                <div>
                                    <p className="text-sm font-medium text-ink">{part.part_name}</p>
                                    <p className="text-xs text-ink-muted font-mono">
                                        {part.quantity} / {part.reorder_threshold} threshold
                                    </p>
                                </div>
                                <button onClick={() => startEdit(part)}
                                    className="px-3 py-1 bg-status-warning-fg text-ink-inverse rounded text-xs hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-voltage-500">
                                    Restock
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Inventory Table */}
            <div className="bg-canvas rounded-xl border border-hairline shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-hairline bg-canvas">
                                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-ink-faint font-medium">Part Name</th>
                                <th className="hidden md:table-cell text-left px-4 py-3 text-[11px] uppercase tracking-wider text-ink-faint font-medium">Part #</th>
                                <th className="hidden md:table-cell text-left px-4 py-3 text-[11px] uppercase tracking-wider text-ink-faint font-medium">Category</th>
                                <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-ink-faint font-medium">Qty</th>
                                <th className="hidden lg:table-cell text-right px-4 py-3 text-[11px] uppercase tracking-wider text-ink-faint font-medium">Reorder At</th>
                                <th className="hidden lg:table-cell text-right px-4 py-3 text-[11px] uppercase tracking-wider text-ink-faint font-medium">Unit Cost</th>
                                <th className="hidden md:table-cell text-left px-4 py-3 text-[11px] uppercase tracking-wider text-ink-faint font-medium">Supplier</th>
                                <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-ink-faint font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {parts.map(part => (
                                <tr key={part.id} className="bg-canvas transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {part.quantity <= part.reorder_threshold && (
                                                <TrendingDown className="w-3 h-3 text-amber-500 shrink-0" />
                                            )}
                                            <span className="text-sm font-medium text-ink">{part.part_name}</span>
                                        </div>
                                    </td>
                                    <td className="hidden md:table-cell px-4 py-3 text-xs font-mono text-ink-muted">{part.part_number}</td>
                                    <td className="hidden md:table-cell px-4 py-3 text-sm text-ink-muted">{part.category}</td>
                                    <td className={`px-4 py-3 text-sm font-mono font-bold text-right ${getStockLevelClass(part.quantity, part.reorder_threshold)}`}>
                                        {part.quantity}
                                    </td>
                                    <td className="hidden lg:table-cell px-4 py-3 text-sm font-mono text-right text-ink-muted">{part.reorder_threshold}</td>
                                    <td className="hidden lg:table-cell px-4 py-3 text-sm font-mono text-right text-ink">₹{part.unit_cost_inr.toLocaleString('en-IN')}</td>
                                    <td className="hidden md:table-cell px-4 py-3 text-sm text-ink-muted">{part.supplier}</td>
                                    <td className="px-4 py-3 text-right">
                                        {editingPart?.id === part.id ? (
                                            <div className="flex items-center justify-end gap-1">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    autoFocus
                                                    value={editingPart.value}
                                                    onChange={e => setEditingPart({ ...editingPart, value: e.target.value })}
                                                    onKeyDown={e => handleEditKey(e, part.part_name)}
                                                    className="w-20 px-2 py-1 text-base sm:text-xs text-right border border-hairline rounded text-ink font-mono focus:outline-none focus:ring-2 focus:ring-voltage-500"
                                                />
                                                <button onClick={() => saveEdit(part.part_name)} disabled={savingPart}
                                                    className="px-2 py-1 bg-voltage-500 text-graphite-950 rounded text-xs font-medium hover:bg-voltage-600 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-voltage-500">
                                                    {savingPart ? '...' : 'Save'}
                                                </button>
                                                <button onClick={cancelEdit}
                                                    className="px-2 py-1 bg-canvas-sunken text-ink rounded text-xs hover:bg-canvas-sunken/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-voltage-500">
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button onClick={() => startEdit(part)}
                                                aria-label={`Adjust quantity for ${part.part_name}`}
                                                className="px-3 py-1 bg-canvas-sunken text-ink rounded text-xs hover:bg-canvas-sunken/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-voltage-500">
                                                Adjust
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

