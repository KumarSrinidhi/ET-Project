import axios from 'axios';

export interface ReadinessResult {
  vehicle_id: string;
  readiness_score: number;
  range_feasibility: number;
  charging_opportunity: number;
  payload_compatibility: number;
  infra_proximity: number;
  recommended_battery_kwh: number;
}

export const fetchFleetReadiness = async (): Promise<ReadinessResult[]> => {
  const response = await axios.get<ReadinessResult[]>('http://localhost:8000/api/fleet-readiness');
  return response.data;
};

export interface ApmAgentResponse {
  agent_thought_process: string;
  results: any[];
}

export interface BatteryHealthReport {
  vehicle_id: string;
  current_soh: number;
  predicted_rul_days: number;
  is_anomaly: boolean;
  degradation_rate_per_day: number;
}

export const queryApmAgent = async (query: string): Promise<ApmAgentResponse> => {
  const response = await axios.post<ApmAgentResponse>('http://localhost:8000/api/apm-agent', { query });
  return response.data;
};

// ─── Feature 3: Maintenance Operations Optimiser ─────────────────────────────

export interface ScheduledTask {
  task_id: string;
  vehicle_id: string;
  task_type: string;
  priority: string;
  bay_id: number;
  bay_name: string;
  technician_id: string;
  technician_name: string;
  start_hour: number;
  end_hour: number;
  estimated_cost_usd: number;
  spare_parts_needed: string[];
  status: string;
}

export interface ScheduleKPIs {
  total_tasks: number;
  scheduled_tasks: number;
  overflow_tasks: number;
  delayed_tasks: number;
  total_cost_usd: number;
  avg_wait_hours: number;
  bay_utilization_pct: number[];
  total_downtime_hours: number;
  throughput_tasks_per_shift: number;
  critical_tasks_same_day_pct: number;
}

export interface OptimizedScheduleResponse {
  schedule: ScheduledTask[];
  kpis: ScheduleKPIs;
  shift_date: string;
  constraints_summary: Record<string, any>;
}

export const fetchMaintenanceSchedule = async (): Promise<OptimizedScheduleResponse> => {
  const response = await axios.get<OptimizedScheduleResponse>('http://localhost:8000/api/maintenance-schedule');
  return response.data;
};