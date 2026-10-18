// Canonical shapes for the Agent Room multi-agent workflow state machine. Numbers here always
// come from a deterministic engine (order-engine.ts / financing-engine.ts); only `text` and
// `statusText` may come from an LLM narration pass. See lib/workflow-engine.ts.

import type { SupplierAgentId } from "@/app/data/supplier-agents";

export interface AgentRoomStep {
  id: string;
  label: string;
}

export interface AgentRoomEvent {
  id: string;
  stageIndex: number;
  from: SupplierAgentId;
  to: SupplierAgentId;
  statusText: string;
  text: string;
  tool?: string;
  reasoning?: string[];
  isChallenge?: boolean;
  tier: 0 | 1 | 2 | 3;
}

export interface ApprovalCard {
  id: string;
  agent: SupplierAgentId;
  tier: 2;
  title: string;
  detail: string;
  impact: string;
}

export type WorkflowType = "order_plan" | "collect";

export interface WorkflowRun {
  runId: string;
  workflow: WorkflowType;
  title: string;
  steps: AgentRoomStep[];
  events: AgentRoomEvent[];
  approvals: ApprovalCard[];
}
