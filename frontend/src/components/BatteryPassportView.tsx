import { useState, useEffect } from 'react';
import { fetchBatteryPassport } from '../api';
import type { BatteryPassport } from '../api';
import DashboardShell from './DashboardShell';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Shield, Battery, AlertTriangle, CheckCircle, Clock, Leaf, Recycle, Truck, Factory, Pickaxe } from 'lucide-react';

const RISK_COLORS: Record<string, string> = {
    critical: 'text-status-critical-fg bg-status-critical-bg border-status-critical-border',
    high: 'text-status-warning-fg bg-status-warning-bg border-status-warning-border',
    medium: 'text-voltage-600 bg-voltage-50 border-voltage-200',
    low: 'text-status-ok-fg bg-status-ok-bg border-status-ok-border',
};

const TIER_ICONS: Record<number, typeof Pickaxe> = {
    3: Pickaxe,
    2: Factory,
    1: Truck,
};

const VEHICLE_IDS = Array.from({ length: 10 }, (_, i) => `EV-${String(i + 1).padStart(3, '0')}`);

export default function BatteryPassportView() {
    const [passport, setPassport] = useState<BatteryPassport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedVehicle, setSelectedVehicle] = useState('EV-001');
    const [expandedNode, setExpandedNode] = useState<number | null>(null);

    const loadPassport = (vid: string) => {
        setLoading(true);
        setError(null);
        setExpandedNode(null);
        fetchBatteryPassport(vid)
            .then(setPassport)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadPassport(selectedVehicle); }, [selectedVehicle]);

    const handleVehicleChange = (vid: string) => {
        setSelectedVehicle(vid);
    };

    return (
        <DashboardShell loading={loading} error={error} loadingMessage="Assembling battery passport...">
            {passport && (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-ink tracking-tight">Battery Material Passport</h2>
                            <p className="text-sm text-ink-muted mt-1">EU Battery Regulation 2027 — Full provenance traceability from mine to vehicle</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                value={selectedVehicle}
                                onChange={e => handleVehicleChange(e.target.value)}
                                className="border border-hairline rounded-lg px-3 py-2 text-base sm:text-sm bg-canvas"
                            >
                                {VEHICLE_IDS.map(vid => (
                                    <option key={vid} value={vid}>{vid}</option>
                                ))}
                            </select>
                            <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${RISK_COLORS[passport.vehicle.risk_level]}`}>
                                {passport.vehicle.risk_level.toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {/* Passport ID Badge */}
                    <div className="bg-graphite-900 rounded-xl p-5 text-white">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <Shield className="w-6 h-6 text-voltage-400" />
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-ink-faint">Digital Battery Passport ID</p>
                                    <p className="font-mono font-bold text-lg">{passport.passport_id}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-ink-faint">Chemistry</p>
                                    <p className="font-mono font-bold">{passport.vehicle.chemistry_label}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-ink-faint">Status</p>
                                    <p className="font-mono font-bold text-green-400">{passport.passport_metadata.regulatory_status}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* KPI Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                        {[
                            { label: 'SoH', value: `${passport.vehicle.current_soh}%`, icon: Battery, color: passport.vehicle.current_soh < 80 ? 'text-status-critical-fg' : 'text-status-ok-fg' },
                            { label: 'RUL', value: `${passport.vehicle.predicted_rul_days}d`, icon: Clock, color: 'text-status-warning-fg' },
                            { label: 'Cycles', value: passport.vehicle.total_cycles, icon: Truck, color: 'text-ink' },
                            { label: 'Capacity', value: `${passport.vehicle.capacity_ah} Ah`, icon: Battery, color: 'text-ink' },
                            { label: 'IR', value: `${passport.vehicle.internal_resistance_mohm} mΩ`, icon: AlertTriangle, color: 'text-ink' },
                            { label: 'Avg Temp', value: `${passport.vehicle.avg_temperature_c}°C`, icon: AlertTriangle, color: passport.vehicle.is_anomaly ? 'text-status-critical-fg' : 'text-ink' },
                            { label: 'Warranty', value: passport.passport_metadata.under_warranty ? `${passport.passport_metadata.warranty_remaining_days}d left` : 'Expired', icon: CheckCircle, color: passport.passport_metadata.under_warranty ? 'text-status-ok-fg' : 'text-status-critical-fg' },
                            { label: 'Recycled', value: `${passport.passport_metadata.recycled_content_pct}%`, icon: Recycle, color: 'text-status-ok-fg' },
                        ].map((kpi, i) => (
                            <div key={i} className="bg-canvas rounded-xl p-3 border border-hairline shadow-sm">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <kpi.icon className={`w-3 h-3 ${kpi.color}`} />
                                    <p className="text-[10px] uppercase tracking-wider text-ink-faint font-medium">{kpi.label}</p>
                                </div>
                                <p className={`text-lg font-mono font-bold ${kpi.color}`}>{kpi.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Two-Column: Supply Chain Map + Trace */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Map */}
                        <div className="lg:col-span-7 bg-canvas rounded-xl border border-hairline shadow-sm p-4">
                            <h3 className="text-[11px] uppercase tracking-wider text-ink-faint font-medium mb-3">Provenance Map — Mine to Vehicle</h3>
                            <div className="rounded-lg overflow-hidden border border-hairline" style={{ height: '400px' }}>
                                <MapContainer center={[20, 50]} zoom={1.5} style={{ height: '100%', width: '100%' }}>
                                    <TileLayer
                                        attribution='&copy; OpenStreetMap'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                    {passport.supply_chain.trace
                                        .filter(t => t.data)
                                        .map((node, i) => {
                                            const d = node.data!;
                                            return (
                                                <Marker key={i} position={[d.latitude, d.longitude]}>
                                                    <Popup>
                                                        <div className="text-sm font-bold">{d.entity_name}</div>
                                                        <div className="text-xs text-ink-muted">Tier {d.tier} · {node.role}</div>
                                                        <div className="text-xs mt-1">Risk: {d.composite_risk}/10 · ESG: {d.esg_score}/10</div>
                                                        <div className="text-xs">Lead time: {d.lead_time_days} days</div>
                                                    </Popup>
                                                </Marker>
                                            );
                                        })}
                                    {/* Flow line */}
                                    {(() => {
                                        const coords = passport.supply_chain.trace
                                            .filter(t => t.data)
                                            .map(t => [t.data!.latitude, t.data!.longitude] as [number, number]);
                                        return coords.length > 1 ? (
                                            <Polyline positions={coords} color="#3b82f6" weight={2.5} opacity={0.5} dashArray="8 6" />
                                        ) : null;
                                    })()}
                                </MapContainer>
                            </div>
                        </div>

                        {/* Trace Panel */}
                        <div className="lg:col-span-5 bg-canvas rounded-xl border border-hairline shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: '400px' }}>
                            <div className="p-4 border-b border-hairline">
                                <h3 className="text-[11px] uppercase tracking-wider text-ink-faint font-medium">Supply Chain Trace</h3>
                                <p className="text-xs text-ink-muted mt-1">{passport.vehicle.chemistry_description}</p>
                            </div>
                            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                                {passport.supply_chain.trace.map((node, i) => {
                                    const isExpanded = expandedNode === i;
                                    const d = node.data;
                                    const TierIcon = TIER_ICONS[d?.tier || 3] || Pickaxe;
                                    return (
                                        <div key={i} className="px-4 py-3 bg-canvas transition-colors">
                                            <button
                                                onClick={() => setExpandedNode(isExpanded ? null : i)}
                                                className="w-full text-left"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-md ${d ? 'bg-voltage-50 text-voltage-600' : 'bg-canvas-sunken text-ink-faint'}`}>
                                                        <TierIcon className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${d ? 'bg-canvas-sunken text-ink-muted' : 'bg-canvas text-ink-faint'}`}>
                                                                Tier {d?.tier || '?'}
                                                            </span>
                                                            <p className="text-sm font-medium text-ink truncate">{node.entity_name}</p>
                                                        </div>
                                                        <p className="text-xs text-ink-muted">{node.role}</p>
                                                    </div>
                                                    {d && (
                                                        <span className={`text-[10px] font-mono font-bold ${d.composite_risk > 6 ? 'text-status-critical-fg' : d.composite_risk > 4 ? 'text-status-warning-fg' : 'text-status-ok-fg'}`}>
                                                            {d.composite_risk}/10
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                            {isExpanded && d && (
                                                <div className="mt-3 ml-10 p-3 bg-canvas rounded-lg space-y-1.5">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-ink-muted">Country</span>
                                                        <span className="font-medium text-ink">{d.country}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-ink-muted">ESG Score</span>
                                                        <span className="font-mono font-medium text-ink">{d.esg_score}/10</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-ink-muted">Lead Time</span>
                                                        <span className="font-mono text-ink">{d.lead_time_days} days</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-ink-muted">Criticality</span>
                                                        <span className={`font-mono font-bold uppercase ${d.criticality === 'critical' ? 'text-status-critical-fg' : 'text-status-warning-fg'}`}>{d.criticality}</span>
                                                    </div>
                                                    <p className="text-xs text-ink-muted leading-relaxed mt-1 border-t border-hairline pt-1.5">{d.risk_justification}</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Row: Recycling + Metadata + SoH Forecast */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Recycling Panel */}
                        <div className="bg-canvas rounded-xl border border-hairline shadow-sm p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Recycle className="w-4 h-4 text-status-ok-fg" />
                                <h3 className="text-sm font-bold text-ink">Recycling & Recovery</h3>
                            </div>
                            <div className={`p-3 rounded-lg mb-4 ${passport.recycling.eligible_for_recycling ? 'bg-status-warning-bg border border-status-warning-border' : 'bg-status-ok-bg border border-status-ok-border'}`}>
                                <p className="text-xs font-bold text-ink">
                                    {passport.recycling.eligible_for_recycling ? 'Eligible for Recycling' : 'Above EOL Threshold'}
                                </p>
                                <p className="text-xs text-ink-muted mt-0.5">EOL threshold: {passport.recycling.end_of_life_soh_threshold}% SoH · Efficiency: {passport.recycling.recycling_efficiency_pct}%</p>
                            </div>
                            <div className="space-y-2">
                                {Object.entries(passport.recycling.recoverable_materials).map(([name, kg]) => (
                                    <div key={name} className="flex justify-between text-xs">
                                        <span className="text-ink-muted">{name}</span>
                                        <span className="font-mono font-medium text-ink">{kg} kg</span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-ink-muted mt-4 leading-relaxed border-t border-hairline pt-3">{passport.recycling.recommended_action}</p>
                        </div>

                        {/* Metadata Panel */}
                        <div className="bg-canvas rounded-xl border border-hairline shadow-sm p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Shield className="w-4 h-4 text-voltage-600" />
                                <h3 className="text-sm font-bold text-ink">Passport Metadata</h3>
                            </div>
                            <div className="space-y-2.5">
                                {[
                                    ['Manufactured', passport.passport_metadata.manufacture_date],
                                    ['Installed', passport.passport_metadata.installed_date],
                                    ['Warranty Expiry', passport.passport_metadata.warranty_expiry],
                                    ['Warranty Period', `${passport.passport_metadata.warranty_years} years`],
                                    ['Conflict Minerals', passport.supply_chain.conflict_minerals_risk],
                                    ['Carbon Footprint', `${passport.supply_chain.carbon_footprint_kg_co2_per_kwh} kg CO2/kWh`],
                                    ['Regulation', passport.passport_metadata.regulatory_status],
                                ].map(([label, value], i) => (
                                    <div key={i} className="flex justify-between text-xs">
                                        <span className="text-ink-muted">{label}</span>
                                        <span className="font-medium text-ink text-right max-w-[55%]">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* SoH Forecast Mini Chart */}
                        <div className="bg-canvas rounded-xl border border-hairline shadow-sm p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Leaf className="w-4 h-4 text-status-ok-fg" />
                                <h3 className="text-sm font-bold text-ink">SoH Degradation Forecast</h3>
                            </div>
                            <div className="relative h-[180px] mb-2">
                                <svg viewBox="0 0 200 120" className="w-full h-full" preserveAspectRatio="none">
                                    {/* Grid lines */}
                                    {[25, 50, 75, 100].map((pct, i) => (
                                        <line key={i} x1="0" y1={120 - pct * 1.2} x2="200" y2={120 - pct * 1.2} stroke="#e5e7eb" strokeWidth="0.5" />
                                    ))}
                                    {/* EOL threshold line */}
                                    <line x1="0" y1={120 - 80 * 1.2} x2="200" y2={120 - 80 * 1.2} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 3" />
                                    <text x="2" y={120 - 80 * 1.2 - 2} fill="#ef4444" fontSize="7" fontFamily="monospace">EOL 80%</text>
                                    {/* SoH curve */}
                                    {(() => {
                                        const points = passport.soh_forecast.forecast;
                                        if (!points.length) return null;
                                        const step = 200 / Math.max(points.length - 1, 1);
                                        const path = points.map((p, i) =>
                                            `${i === 0 ? 'M' : 'L'}${i * step},${120 - p.soh * 1.2}`
                                        ).join(' ');
                                        return <path d={path} fill="none" stroke="currentColor" strokeWidth="2" className="text-voltage-600" />;
                                    })()}
                                </svg>
                            </div>
                            <div className="flex justify-between text-[10px] text-ink-faint font-mono">
                                <span>Today</span>
                                <span>+365 days</span>
                            </div>
                            {passport.soh_forecast.end_of_life_day && (
                                <p className="text-xs text-status-critical-fg font-medium mt-2">{passport.soh_forecast.end_of_life_estimate}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </DashboardShell>
    );
}
