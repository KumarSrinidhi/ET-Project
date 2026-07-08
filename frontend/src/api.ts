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