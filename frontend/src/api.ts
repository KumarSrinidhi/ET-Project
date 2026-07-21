import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export interface ReadinessResult {
  vehicle_id: string;
  readiness_score: number;
  range_feasibility: number;
  charging_opportunity: number;
  payload_compatibility: number;
  infra_proximity: number;
  elevation_penalty: number;
  tco_savings_pct: number;
  recommended_battery_kwh: number;
  recommended_chemistry: string;
  estimated_capex_inr: number;
}

export const fetchFleetReadiness = async (depotId?: string | null, retries = 5): Promise<ReadinessResult[]> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get<ReadinessResult[]>(`${BASE}/api/fleet-readiness`, {
        params: { depot_id: depotId },
        timeout: 10000
      });
      return response.data;
    } catch (err: any) {
      // If it's not a network/timeout error, fail immediately
      if (err.response) throw err;
      // If it's a timeout or connection refused (backend waking up), wait and retry
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, 1000 * (i + 1))); // 1s, 2s, 3s, 4s delays
      } else {
        throw err; // Final attempt failed
      }
    }
  }
  throw new Error("Max retries reached");
};

export interface BatteryHealthReport {
  vehicle_id: string;
  current_soh: number;
  predicted_rul_days: number;
  is_anomaly: boolean;
  degradation_rate_per_day: number;
}

export interface ApmAgentResponse {
  agent_thought_process: string;
  routing_confidence?: number;
  results: any[];
}

export const queryApmAgent = async (query: string): Promise<ApmAgentResponse> => {
  const response = await axios.post<ApmAgentResponse>(`${BASE}/api/apm-agent`, { query });
  return response.data;
};

// Maintenance
export interface ScheduledTask {
  task_id: string;
  vehicle_id: string;
  task_type: string;
  priority: string;
  bay_name: string;
  technician_name: string;
  start_hour: number;
  end_hour: number;
  estimated_cost_inr: number;
  spare_parts_needed: string[];
  status: string;
}

export interface OptimizedScheduleResponse {
  shift_date: string;
  schedule: ScheduledTask[];
  kpis: {
    total_tasks: number;
    scheduled_tasks: number;
    overflow_tasks: number;
    delayed_tasks: number;
    total_cost_inr: number;
    critical_tasks_same_day_pct: number;
    avg_wait_hours: number;
    total_downtime_hours: number;
    throughput_tasks_per_shift: number;
    bay_utilization_pct: number[];
  };
  constraints_summary: {
    shift_window: string;
    bays_available: number;
    technicians_available: number;
    optimization_method: string;
    shift_pattern: string;
    priority_levels: string[];
  };
}

export const fetchMaintenanceSchedule = async (depotId?: string | null): Promise<OptimizedScheduleResponse> => {
  const response = await axios.get<OptimizedScheduleResponse>(`${BASE}/api/maintenance-schedule`, {
    params: { depot_id: depotId }
  });
  return response.data;
};

// Quality
export interface QualityIntelligenceResponse {
  kpis: {
    overall_yield_pct: number;
    first_pass_yield_pct: number;
    defect_rate_ppm: number;
    scrap_cost_inr: number;
    supplier_quality_index: number;
    process_capability_cpk: number;
    drift_alerts_active: number;
    batches_at_risk: number;
  };
  process_parameters: {
    parameter_name: string;
    stage: string;
    current_value: number;
    target_value: number;
    ucl: number;
    lcl: number;
    ewma_value: number;
    unit: string;
    drift_detected: boolean;
    drift_severity: string;
  }[];
  inspection_records: {
    batch_id: string;
    supplier: string;
    material: string;
    inspection_date: string;
    sample_size: number;
    defects_found: number;
    defect_rate_ppm: number;
    pass_fail: string;
    quality_score: number;
  }[];
  defect_predictions: {
    batch_id: string;
    stage: string;
    predicted_defect_type: string;
    confidence: number;
    risk_factors: string[];
    recommended_action: string;
  }[];
  spc_charts: Record<string, {
    value: number;
    ucl: number;
    lcl: number;
    center_line: number;
    out_of_control: boolean;
    timestamp: string;
  }[]>;
  supplier_quality_matrix: {
    supplier: string;
    total_batches: number;
    total_defects: number;
    defect_rate_ppm: number;
    pass_rate_pct: number;
    avg_quality_score: number;
  }[];
}

export const fetchQualityIntelligence = async (depotId?: string | null): Promise<QualityIntelligenceResponse> => {
  const response = await axios.get<QualityIntelligenceResponse>(`${BASE}/api/quality-intelligence`, {
    params: { depot_id: depotId }
  });
  return response.data;
};

// Net Zero
export interface NetZeroReport {
  kpis: {
    total_emissions_tons_co2: number;
    scope_1_tons: number;
    scope_2_tons: number;
    scope_3_tons: number;
    avoided_emissions_tons: number;
    carbon_intensity_g_per_km: number;
    yoy_reduction_pct: number;
    renewable_energy_pct: number;
    ev_fleet_pct: number;
    offset_credits_tons: number;
    target_year: number;
    years_to_net_zero: number;
  };
  emission_sources: {
    source_name: string;
    scope: string;
    category: string;
    emissions_kg_co2: number;
    description: string;
  }[];
  fleet_comparison: {
    vehicle_id: string;
    annual_km: number;
    ev_emissions_kg_co2_per_year: number;
    ice_equivalent_kg_co2_per_year: number;
    avoided_emissions_kg_co2: number;
    avoided_pct: number;
    energy_source: string;
  }[];
  supply_chain_carbon: {
    supplier: string;
    material: string;
    country: string;
    transport_mode: string;
    transport_distance_km: number;
    production_emissions_kg_co2: number;
    transport_emissions_kg_co2: number;
    total_emissions_kg_co2: number;
    material_carbon_intensity_kg_co2_per_ton: number;
  }[];
  monthly_progress: {
    month: string;
    actual_emissions_tons_co2: number;
    target_emissions_tons_co2: number;
    baseline_emissions_tons_co2: number;
    reduction_pct: number;
    on_track: boolean;
  }[];
  scope_breakdown: Record<string, number>;
  recommendations: string[];
}

export const fetchNetZeroReport = async (depotId?: string | null): Promise<NetZeroReport> => {
  const response = await axios.get<NetZeroReport>(`${BASE}/api/carbon-tracker`, {
    params: { depot_id: depotId }
  });
  return response.data;
};

// Supply Chain
export interface SupplyChainNode {
  entity_name: string;
  tier: number;
  material: string;
  country: string;
  latitude: number;
  longitude: number;
  composite_risk: number;
  risk_justification: string;
  esg_score: number;
  lead_time_days: number;
  criticality: string;
}

export const fetchSupplyChain = async (depotId?: string | null): Promise<SupplyChainNode[]> => {
  const response = await axios.get<SupplyChainNode[]>(`${BASE}/api/supply-chain`, {
    params: { depot_id: depotId }
  });
  return response.data;
};

// ─── News-driven Supply Chain Risk (returns dict with citations) ────────────

export interface NewsCitation {
  title: string;
  url: string;
  source: string;
  published: string;
}

export interface SupplyChainTraceResponse {
  nodes: SupplyChainNode[];
  citations: NewsCitation[];
  total_articles_analyzed: number;
}

export interface RiskCitation {
  id: string;
  title: string;
  source: string;
  url: string;
  published_date: string;
  relevance_score: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  extracted_claims: string[];
}

export interface RiskSubScore {
  score: number;
  weight: number;
  weighted_contribution: number;
  citations: RiskCitation[];
}

export interface RiskScoreResponse {
  material: string;
  overall_risk: number;
  level: 'green' | 'yellow' | 'orange' | 'high';
  last_updated: string;
  sub_scores: {
    geopolitical?: RiskSubScore;
    regulatory?: RiskSubScore;
    operational?: RiskSubScore;
    environmental?: RiskSubScore;
  };
}

export const fetchRiskScore = async (material: string): Promise<RiskScoreResponse> => {
  const response = await axios.get<RiskScoreResponse>(`${BASE}/api/supply-chain/risk/${material}`);
  return response.data;
};

// ─── Commodity Feed ─────────────────────────────────────────────────────────

export interface CommodityPrice {
  material: string;
  symbol: string;
  price_inr_per_kg: number;
  change_pct_24h: number;
  last_updated: string;
  source: string;
  unit: string;
}

export interface BatteryCostBreakdown {
  chemistry: string;
  kwh: number;
  raw_material_cost_inr: number;
  processing_margin_inr: number;
  total_battery_cost_inr: number;
  cost_per_kwh_inr: number;
  breakdown: { material: string; kg_required: number; price_inr_per_kg: number; cost_inr: number }[];
  priced_at: string;
}

export const fetchCommodities = async (): Promise<{ prices: CommodityPrice[]; count: number }> => {
  const r = await axios.get(`${BASE}/api/commodities`);
  return r.data;
};

export const fetchBatteryCost = async (kwh: number = 100, chemistry: string = "NMC 811"): Promise<BatteryCostBreakdown> => {
  const r = await axios.get(`${BASE}/api/commodities/battery-cost`, { params: { kwh, chemistry } });
  return r.data;
};

// ─── Trust & Explainability ─────────────────────────────────────────────────

export interface ShapContribution {
  parameter: string;
  stage: string;
  current_value: number;
  target_value: number;
  distance_from_target_pct: number;
  shap_value: number;
  is_drifting: boolean;
}

export interface ShapResult {
  baseline_cpk: number;
  current_cpk: number;
  driving_factors: ShapContribution[];
  all_contributions: ShapContribution[];
  interpretation: string;
}

export const fetchShapForCpk = async (): Promise<ShapResult> => {
  const r = await axios.get(`${BASE}/api/shap/cpk`);
  return r.data;
};

export interface ThermalPrediction {
  day_offset: number;
  date: string;
  projected_temp_c: number;
  z_score: number;
  anomaly_likely: boolean;
}

export interface ThermalForecast {
  predictions: ThermalPrediction[];
  high_risk_days: number[];
  model: string;
  confidence: string;
}

export const fetchThermalForecast = async (vehicleId: string): Promise<ThermalForecast> => {
  const r = await axios.get(`${BASE}/api/forecast/thermal/${vehicleId}`);
  return r.data;
};

export interface SohForecastPoint {
  day: number;
  date: string;
  soh: number;
  lower_bound: number;
  upper_bound: number;
}

export interface RulForecast {
  forecast: SohForecastPoint[];
  end_of_life_day: number | null;
  end_of_life_estimate: string;
  warning: string;
}

export const fetchRulForecast = async (vehicleId: string): Promise<RulForecast> => {
  const r = await axios.get(`${BASE}/api/forecast/rul/${vehicleId}`);
  return r.data;
};

export interface CostPrediction {
  vehicle_id: string;
  current_soh: number;
  projected_soh_180d: number;
  failure_probability_180d: number;
  battery_cost_inr: number;
  scenarios: {
    replace_now: { cost_inr: number; risk: string };
    replace_in_6_months: { cost_inr: number; risk: string };
    do_nothing: { expected_emergency_cost_inr: number; risk: string };
  };
  recommendation: string;
  estimated_savings_inr: number;
}

export const fetchCostPrediction = async (vehicleId: string): Promise<CostPrediction> => {
  const r = await axios.post(`${BASE}/api/maintenance/cost-prediction/${vehicleId}`);
  return r.data;
};

// ─── What-If Carbon Simulator ───────────────────────────────────────────────

export interface CarbonScenario {
  scenario: { ev_penetration_pct: number; renewable_energy_pct: number; scope_3_reduction_pct: number };
  baseline: { total_tons_co2: number; scope_1_tons: number; scope_2_tons: number; scope_3_tons: number; years_to_net_zero: number };
  simulated: { total_tons_co2: number; scope_1_tons: number; scope_2_tons: number; scope_3_tons: number; years_to_net_zero: number; reduction_vs_baseline_pct: number };
}

export const simulateCarbon = async (ev: number, renewable: number, scope3: number): Promise<CarbonScenario> => {
  const r = await axios.post(`${BASE}/api/carbon/simulate`, {
    ev_penetration_pct: ev,
    renewable_energy_pct: renewable,
    scope_3_reduction_pct: scope3,
  });
  return r.data;
};

// ─── Operations: Depots, RBAC, Audit Log, Approvals ─────────────────────────

export interface Depot {
  id: string;
  name: string;
  code: string;
  region: string;
  lat: number;
  lng: number;
  timezone: string;
  vehicle_count: number;
  manager_name: string;
  charging_infra: Record<string, any>;
  workshop_capacity: Record<string, any>;
}

export interface DepotComparisonRow {
  id: string;
  name: string;
  code: string;
  region: string;
  vehicle_count: number;
  lat: number;
  lng: number;
  metrics: {
    avg_soh: number;
    availability: number;
    rul: number;
  };
}

export const fetchAllDepots = async (): Promise<{ depots: Depot[] }> => {
  const r = await axios.get(`${BASE}/api/depots`);
  return r.data;
};

export interface DepotComparisonData {
  id: string;
  name: string;
  code: string;
  region: string;
  vehicle_count: number;
  lat: number;
  lng: number;
  metrics: {
    avg_soh: number;
    availability: number;
    rul: number;
  };
}

export const fetchDepotComparison = async (region?: string): Promise<{ depots: DepotComparisonData[] }> => {
  const r = await axios.get(`${BASE}/api/depots/compare`, { params: { region } });
  return r.data;
};

export const fetchDepotSummary = async (depotId: string) => {
  const r = await axios.get(`${BASE}/api/depots/${depotId}/summary`);
  return r.data;
};

// ─── Live Alerts + Business Analytics ────────────────────────────────────────

export interface Alert {
    alert_id: string;
    timestamp: string;
    severity: 'critical' | 'warning' | 'info';
    category: string;
    vehicle_id: string;
    message: string;
    value: number;
    acknowledged: boolean;
}

export const fetchAlerts = async (limit: number = 50, severity?: string): Promise<Alert[]> => {
    const r = await axios.get(`${BASE}/api/alerts`, { params: { limit, severity } });
    return r.data.alerts;
};

export const acknowledgeAlert = async (alertId: string): Promise<{ acknowledged: boolean }> => {
    const r = await axios.post(`${BASE}/api/alerts/${alertId}/acknowledge`);
    return r.data;
};

export const fetchCohort = async () => {
    const r = await axios.get(`${BASE}/api/analytics/cohort`);
    return r.data;
};

export const fetchTcoTrend = async (months: number = 12) => {
    const r = await axios.get(`${BASE}/api/analytics/tco-trend`, { params: { months } });
    return r.data;
};

export const fetchVendorScorecard = async () => {
    const r = await axios.get(`${BASE}/api/analytics/vendor-scorecard`);
    return r.data;
};

export const fetchCarbonCredits = async () => {
    const r = await axios.get(`${BASE}/api/analytics/carbon-credits`);
    return r.data;
};

export const fetchDepotsHeatmap = async (metric = "availability") => {
  const r = await axios.get(`${BASE}/api/depots/compare/heatmap`, { params: { metric } });
  return r.data;
};

export interface AuditEntry {
  entry_id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  ip_address: string;
}

export const fetchAuditLog = async (role: string = "admin"): Promise<{ can_view: boolean; entries: AuditEntry[] }> => {
  const r = await axios.get(`${BASE}/api/audit-log`, { params: { role } });
  return { can_view: r.data.can_view, entries: r.data.entries };
};

export const exportAuditLogUrl = (role: string = "admin") => `${BASE}/api/audit-log/export?role=${role}`;

export interface ApprovalRequest {
  request_id: string;
  task_id: string;
  vehicle_id: string;
  task_type: string;
  estimated_cost_inr: number;
  requested_by: string;
  requested_at: string;
  status: "pending" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  reason: string;
}

export const submitApproval = async (req: { task_id: string; vehicle_id: string; task_type: string; cost_inr: number; reason: string; requested_by?: string }): Promise<{ approval: ApprovalRequest; auto_approved: boolean; threshold_inr: number }> => {
  const r = await axios.post(`${BASE}/api/maintenance/submit-for-approval`, req);
  return r.data;
};

export const fetchPendingApprovals = async (role: string = "maintenance"): Promise<{ pending: ApprovalRequest[]; threshold_inr: number }> => {
  const r = await axios.get(`${BASE}/api/maintenance/pending-approvals`, { params: { role } });
  return r.data;
};

export const decideApproval = async (requestId: string, approved: boolean, decidedBy: string, role: string, reason: string = ""): Promise<ApprovalRequest> => {
  const r = await axios.post(`${BASE}/api/maintenance/decide-approval/${requestId}`, {
    approved, decided_by: decidedBy, role, reason,
  });
  return r.data;
};

export interface ShapFactor {
  parameter: string;
  shap_value: number;
  direction: 'helpful' | 'harmful';
  current_value: number;
  normal_range: [number, number];
}

export interface ShapExplanation {
  batch_id: string;
  cpk: number;
  threshold: number;
  status: string;
  top_factors: ShapFactor[];
  base_value: number;
  all_factors: ShapFactor[];
  summary: string;
  timestamp: string;
}

export const fetchQualityDriftExplanation = async (batchId: string): Promise<ShapExplanation> => {
  const response = await axios.get<ShapExplanation>(`${BASE}/api/quality/drift/${batchId}/explanation`);
  return response.data;
};
