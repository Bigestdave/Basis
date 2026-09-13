import { api } from "./api";
import type { MoneyDto } from "./credit";

export interface FarmTestScenarioDto {
  key: string;
  label: string;
  description: string;
  narrative: string;
  expectation: string;
  activityCount: number;
  volume: MoneyDto;
}

export interface FarmTestResultDto {
  scenario: {
    key: string;
    label: string;
    description: string;
    narrative: string;
    expectation: string;
  };
  activityCount: number;
  volume: MoneyDto;
  capitalIndependence: number;
  economicDiversity: number;
  behavioralCoherence: number;
  evidenceScore: number;
  strength: string;
  creditBefore: MoneyDto;
  creditIncrease: MoneyDto;
  creditAfter: MoneyDto;
  awarded: boolean;
  blockedBy: string[];
  explanations: {
    capital: string;
    diversity: string;
    coherence: string;
  };
  runId?: string;
  createdAt?: number;
}

export async function getFarmScenarios(): Promise<FarmTestScenarioDto[]> {
  const data = await api.get<{ scenarios: FarmTestScenarioDto[] }>("/api/farm-test/scenarios");
  return data.scenarios ?? [];
}

export async function runFarmTest(scenario: "manufactured" | "genuine"): Promise<FarmTestResultDto> {
  const data = await api.post<{ result: FarmTestResultDto }>("/api/farm-test/run", {
    scenario,
  });
  return data.result;
}
