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
  results: BatteryHealthReport[];
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