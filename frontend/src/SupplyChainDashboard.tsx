import { useState, useEffect } from 'react';
import { fetchSupplyChain } from './api';
import type { SupplyChainNode } from './api';

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { CommodityPriceWidget } from './components/CommodityPriceWidget';
import { RiskScoreCard } from './components/RiskScoreCard';
import { useAuth } from './AuthContext';


export default function SupplyChainDashboard({ selectedDepotId }: { selectedDepotId: string | null }) {
    const { roleView } = useAuth();
    const [nodes, setNodes] = useState<SupplyChainNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        fetchSupplyChain(selectedDepotId)
            .then(setNodes)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [selectedDepotId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-ink-muted">Loading supply chain network...</span>
            </div>
        );
    }

    if (error || !nodes.length) {
        return (
            <div className="p-6 bg-status-critical-bg border border-status-critical-border rounded-lg">
                <p className="text-status-critical-fg">Failed to load supply chain: {error}</p>
            </div>
        );
    }

    // Compute KPIs from data
    const highestRiskNode = nodes.reduce((max, n) => n.composite_risk > max.composite_risk ? n : max, nodes[0]);
    const tier3Count = nodes.filter(n => n.tier === 3).length;

    // Sort nodes by tier descending (Tier 3 first, then Tier 2, then Tier 1) to draw the supply chain flow
    const sortedNodes = [...nodes].sort((a, b) => b.tier - a.tier);
    const traceabilityCoords: [number, number][] = sortedNodes.map(n => [n.latitude, n.longitude]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-ink tracking-tight">Supply Chain Risk & Traceability</h2>
                <p className="text-sm text-ink-muted mt-1">
                    Tier 1-3 supplier mapping with material flow visualization and live news-based risk scoring.
                </p>
            </div>

            {/* Top KPI Row */}
            <div className="grid grid-cols-3 gap-6 mb-6">
                <div className="bg-canvas rounded-xl p-5 text-center">
                    <p className="text-[11px] uppercase tracking-wider text-ink-faint font-medium">Nodes Tracked</p>
                    <p className="mt-2">
                        <span className="font-mono text-xl font-semibold text-ink tracking-tight">{nodes.length}</span>
                    </p>
                </div>
                <div className="bg-canvas rounded-xl p-5 text-center">
                    <p className="text-[11px] uppercase tracking-wider text-ink-faint font-medium">Highest Risk Node</p>
                    <p className="mt-2">
                        <span className="font-mono text-xl font-semibold text-ink tracking-tight">
                            {highestRiskNode.entity_name}
                        </span>
                    </p>
                    <p className="text-xs text-status-critical-fg font-mono font-medium mt-1">Risk {highestRiskNode.composite_risk}/10</p>
                </div>
                <div className="bg-canvas rounded-xl p-5 text-center">
                    <p className="text-[11px] uppercase tracking-wider text-ink-faint font-medium">Tier 3 Dependencies</p>
                    <p className="mt-2">
                        <span className="font-mono text-xl font-semibold text-ink tracking-tight">{tier3Count}</span>
                    </p>
                </div>
            </div>

            {/* Commodity Price Feed */}
            <div className="mb-6">
                <CommodityPriceWidget />
            </div>

            {/* Main Content Grid: Map + Risk Register */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Map */}
                {!roleView?.hiddenWidgets?.includes('supplyChainMap') && (
                <div className="lg:col-span-8 p-6 bg-canvas rounded-xl border border-hairline shadow-sm">
                    <h3 className="text-[11px] uppercase tracking-wider text-ink-faint font-medium mb-4">Material Flow & Supplier Network</h3>
                    <div className="rounded-xl overflow-hidden shadow-sm border border-hairline relative lg:h-[600px] h-[350px] w-full">
                        {!mapReady && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-canvas-sunken">
                                <div className="text-center">
                                    <div className="w-8 h-8 border-4 border-voltage-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                    <p className="text-xs text-ink-muted">Loading map tiles...</p>
                                </div>
                            </div>
                        )}
                        <MapContainer center={[20, 50]} zoom={2} style={{ height: '100%', width: '100%' }} whenReady={() => setMapReady(true)}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            {/* Traceability line: dashed slate-400, connects nodes in tier order */}
                            <Polyline positions={traceabilityCoords} color="#94a3b8" weight={2} opacity={0.6} dashArray="8 6" />
                            {/* Markers */}
                            {nodes.map((node, idx) => (
                                <Marker key={idx} position={[node.latitude, node.longitude]}>
                                    <Popup>
                                        <div className="font-semibold text-sm">{node.entity_name}</div>
                                        <div className="text-xs mt-1">Tier {node.tier}</div>
                                        <div className="text-xs font-bold mt-1" style={{ color: node.composite_risk > 6 ? '#dc2626' : node.composite_risk > 4 ? '#d97706' : '#16a34a' }}>
                                            Risk: {node.composite_risk}/10
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>
                </div>
                )}

                {/* Right Column: Risk Register or Risk Score Card */}
                <div className="lg:col-span-4 bg-canvas rounded-xl border border-hairline shadow-sm overflow-hidden flex flex-col lg:h-[600px] h-[400px]">
                    {selectedMaterial ? (
                        <div className="flex-1 flex flex-col overflow-hidden relative">
                            <button 
                                onClick={() => setSelectedMaterial(null)}
                                className="absolute top-3 right-3 z-30 p-1.5 bg-canvas-sunken bg-canvas-sunken rounded-full text-ink-muted transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <RiskScoreCard material={selectedMaterial} />
                        </div>
                    ) : (
                        <>
                            <div className="px-5 py-3 border-b border-hairline bg-canvas sticky top-0">
                                <h3 className="text-[11px] uppercase tracking-wider text-ink-faint font-medium">Node Risk Register (Click to view sources)</h3>
                            </div>
                            <div className="divide-y divide-gray-50 overflow-y-auto flex-1">
                                {nodes.map((node, idx) => (
                                    <div 
                                        key={idx} 
                                        className="px-5 py-3.5 bg-canvas transition-colors cursor-pointer group"
                                        onClick={() => setSelectedMaterial(node.material)}
                                    >
                                        {/* Top Line: Name + Risk badge */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-ink text-voltage-600 transition-colors">{node.entity_name}</span>
                                            <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full ${node.composite_risk > 6 ? 'bg-status-critical-bg text-status-critical-fg' : 'bg-canvas-sunken text-ink-muted'}`}>
                                                {node.composite_risk}/10
                                            </span>
                                        </div>
                                        {/* Middle Line: Material + Country */}
                                        <div className="text-xs text-ink-faint mt-0.5">
                                            {node.material} - {node.country} - Tier {node.tier}
                                        </div>
                                        {/* Bottom Line: Justification */}
                                        <div className="text-[11px] text-ink-muted leading-relaxed mt-1">
                                            {node.risk_justification}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
