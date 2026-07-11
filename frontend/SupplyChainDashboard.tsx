import { useState, useEffect } from 'react';
import { fetchSupplyChain } from './api';
import type { SupplyChainNode } from './api';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';

export default function SupplyChainDashboard() {
    const [nodes, setNodes] = useState<SupplyChainNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSupplyChain()
            .then(setNodes)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-500">Loading supply chain network...</span>
            </div>
        );
    }

    if (error || !nodes.length) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700">Failed to load supply chain: {error}</p>
            </div>
        );
    }

    // Group by tier for the flow visualization
    const tier3 = nodes.filter(n => n.tier === 3);
    const tier2 = nodes.filter(n => n.tier === 2);
    const tier1 = nodes.filter(n => n.tier === 1);

    // Create supply chain flow lines (tier3 -> tier2 -> tier1)
    const flowLines: [number, number][][] = [];
    tier3.forEach(source => {
        tier2.forEach(mid => {
            flowLines.push([[source.latitude, source.longitude], [mid.latitude, mid.longitude]]);
        });
    });
    tier2.forEach(mid => {
        tier1.forEach(dest => {
            flowLines.push([[mid.latitude, mid.longitude], [dest.latitude, dest.longitude]]);
        });
    });

    const avgRisk = (nodes.reduce((a, b) => a + b.composite_risk, 0) / nodes.length).toFixed(1);
    const criticalNodes = nodes.filter(n => n.criticality === 'critical').length;
    const highRiskNodes = nodes.filter(n => n.composite_risk > 6).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Supply Chain Risk & Traceability</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Geospatial mapping of Tier 1-3 suppliers • Real-time coordinates • ESG scoring • Lead time tracking
                    </p>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total Nodes</p>
                    <p className="text-2xl font-bold text-gray-800">{nodes.length}</p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Critical Suppliers</p>
                    <p className="text-2xl font-bold text-red-600">{criticalNodes}</p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Avg Risk Score</p>
                    <p className="text-2xl font-bold text-orange-600">{avgRisk}/10</p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">High Risk Nodes</p>
                    <p className="text-2xl font-bold text-red-700">{highRiskNodes}</p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Tier Coverage</p>
                    <p className="text-2xl font-bold text-blue-700">{tier3.length}-{tier2.length}-{tier1.length}</p>
                    <p className="text-[10px] text-gray-400">Raw-Mid-Final</p>
                </div>
            </div>

            {/* Map */}
            <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Global Supply Network</h3>
                <div className="rounded overflow-hidden border border-gray-200" style={{ height: '450px', width: '100%' }}>
                    <MapContainer center={[20, 50]} zoom={2} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {/* Flow lines */}
                        {flowLines.map((line, idx) => (
                            <Polyline key={idx} positions={line} color="#6366f1" weight={1} opacity={0.4} dashArray="5,10" />
                        ))}
                        {/* Markers */}
                        {nodes.map((node, idx) => (
                            <Marker key={idx} position={[node.latitude, node.longitude]}>
                                <Popup>
                                    <div className="font-semibold text-sm">{node.entity_name}</div>
                                    <div className="text-xs mt-1">Tier {node.tier} • {node.material}</div>
                                    <div className="text-xs">Country: {node.country}</div>
                                    <div className="text-xs font-bold mt-1" style={{ color: node.composite_risk > 6 ? '#dc2626' : node.composite_risk > 4 ? '#d97706' : '#16a34a' }}>
                                        Risk: {node.composite_risk}/10
                                    </div>
                                    <div className="text-xs">ESG: {node.esg_score}/10 • Lead: {node.lead_time_days}d</div>
                                    <div className="text-xs italic mt-1 text-gray-600">{node.risk_justification}</div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                    Supply Chain Nodes ({nodes.length})
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                            <tr>
                                <th className="px-3 py-2">Entity</th>
                                <th className="px-3 py-2">Tier</th>
                                <th className="px-3 py-2">Material</th>
                                <th className="px-3 py-2">Country</th>
                                <th className="px-3 py-2">Risk</th>
                                <th className="px-3 py-2">ESG</th>
                                <th className="px-3 py-2">Lead Time</th>
                                <th className="px-3 py-2">Criticality</th>
                            </tr>
                        </thead>
                        <tbody>
                            {nodes.map((node, idx) => (
                                <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-3 py-2 font-medium text-gray-900">{node.entity_name}</td>
                                    <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 text-xs rounded ${node.tier === 3 ? 'bg-orange-100 text-orange-800' : node.tier === 2 ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                            Tier {node.tier}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs">{node.material}</td>
                                    <td className="px-3 py-2">{node.country}</td>
                                    <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${node.composite_risk > 6 ? 'bg-red-100 text-red-800' : node.composite_risk > 4 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                            {node.composite_risk}/10
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 text-xs rounded ${node.esg_score >= 7 ? 'bg-green-100 text-green-800' : node.esg_score >= 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                            {node.esg_score}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{node.lead_time_days}d</td>
                                    <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded capitalize ${node.criticality === 'critical' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {node.criticality}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="text-xs text-gray-400 text-center">
                Use the APM Agent (Tab 2) with "Trace supply chain" for LIVE news-based risk scoring powered by LLM analysis of 12 RSS feeds.
            </p>
        </div>
    );
}
