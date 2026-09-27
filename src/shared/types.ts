/**
 * Shared Type Definitions for TENNE
 */

export interface SystemFact {
  gitBranch: string;
  gitCommitSha: string;
  command?: string;
  exitCode?: number;
  executionDurationMs?: number;
  filesAffected?: string[];
  metadata?: Record<string, unknown>;
}

export interface AgentExplanation {
  summary: string;
  rationale: string;
  guardrailNotes?: string;
}

export interface HistoryEvent {
  eventId: string;
  timestamp: string;
  eventType: string;
  taskId: string;
  actor: string;
  systemFacts: SystemFact;
  agentExplanations: AgentExplanation;
}

export interface PublicJourneyData {
  generatedAt: string;
  canonicalGoal: string;
  currentMilestone: string;
  currentAutonomyLevel: string;
  events: HistoryEvent[];
}
