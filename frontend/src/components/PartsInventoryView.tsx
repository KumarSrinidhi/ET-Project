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

    const handleRestock = (partName: string, currentQty: number) => {
        const newQty = prompt(`Enter new quantity for ${partName} (current: ${currentQty}):`, String(currentQty + 10));
        if (newQty !== null) {
            const qty = parseInt(newQty, 10);
            if (!isNaN(qty) && qty >= 0) {
                updatePartQuantity(partName, qty).then(() => loadData());
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-500">Loading parts inventory...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700">Failed to load parts inventory: {error}</p>
            </div>
        );
    }

    const getStockLevelClass = (qty: number, threshold: number) => {
        if (qty <= 0) return 'text-red-600 font-bold';
        if (qty <= threshold) return 'text-amber-600 font-bold';
        return 'text-gray-900';
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Parts Inventory</h2>
                <p className="text-sm text-gray-500 mt-1">Manage spare parts, monitor stock levels, and track low-stock alerts</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Total Parts</p>
                    <p className="text-2xl font-mono font-bold text-gray-900 mt-1">{parts.length}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Low Stock Alerts</p>
                    <p className={`text-2xl font-mono font-bold mt-1 ${lowStock.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                        {lowStock.length}
                    </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Total Value</p>
                    <p className="text-2xl font-mono font-bold text-gray-900 mt-1">₹{totalValue.toLocaleString('en-IN')}</p>
                </div>
            </div>

            {/* Low Stock Alerts */}
            {lowStock.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <h3 className="text-sm font-bold text-amber-800">Low Stock Warnings</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {lowStock.map(part => (
                            <div key={part.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-100">
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{part.part_name}</p>
                                    <p className="text-xs text-gray-500 font-mono">
                                        {part.quantity} / {part.reorder_threshold} threshold
                                    </p>
                                </div>
                                <button onClick={() => handleRestock(part.part_name, part.quantity)}
                                    className="px-3 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-500">
                                    Restock
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Inventory Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Part Name</th>
                                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Part #</th>
                                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Category</th>
                                <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Qty</th>
                                <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Reorder At</th>
                                <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Unit Cost</th>
                                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Supplier</th>
                                <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {parts.map(part => (
                                <tr key={part.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {part.quantity <= part.reorder_threshold && (
                                                <TrendingDown className="w-3 h-3 text-amber-500 shrink-0" />
                                            )}
                                            <span className="text-sm font-medium text-gray-900">{part.part_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs font-mono text-gray-500">{part.part_number}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{part.category}</td>
                                    <td className={`px-4 py-3 text-sm font-mono font-bold text-right ${getStockLevelClass(part.quantity, part.reorder_threshold)}`}>
                                        {part.quantity}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-mono text-right text-gray-500">{part.reorder_threshold}</td>
                                    <td className="px-4 py-3 text-sm font-mono text-right text-gray-700">₹{part.unit_cost_inr.toLocaleString('en-IN')}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{part.supplier}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => handleRestock(part.part_name, part.quantity)}
                                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200">
                                            Adjust
                                        </button>
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
