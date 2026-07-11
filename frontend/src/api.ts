import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
}

export const fetchFleetReadiness = async (): Promise<ReadinessResult[]> => {
  const response = await axios.get<ReadinessResult[]>(`${BASE}/api/fleet-readiness`);
  return response.data;
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
  estimated_cost_usd: number;
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
    total_cost_usd: number;
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

export const fetchMaintenanceSchedule = async (): Promise<OptimizedScheduleResponse> => {
  const response = await axios.get<OptimizedScheduleResponse>(`${BASE}/api/maintenance-schedule`);
  return response.data;
};

// Quality
export interface QualityIntelligenceResponse {
  kpis: {
    overall_yield_pct: number;
    first_pass_yield_pct: number;
    defect_rate_ppm: number;
    scrap_cost_usd: number;
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

export const fetchQualityIntelligence = async (): Promise<QualityIntelligenceResponse> => {
  const response = await axios.get<QualityIntelligenceResponse>(`${BASE}/api/quality-intelligence`);
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

export const fetchNetZeroReport = async (): Promise<NetZeroReport> => {
  const response = await axios.get<NetZeroReport>(`${BASE}/api/carbon-tracker`);
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

export const fetchSupplyChain = async (): Promise<SupplyChainNode[]> => {
  const response = await axios.get<SupplyChainNode[]>(`${BASE}/api/supply-chain`);
  return response.data;
};
