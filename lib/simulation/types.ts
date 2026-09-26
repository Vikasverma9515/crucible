export type TerrainType = "grass" | "forest" | "water" | "mountain" | "plains" | "desert";
export type ResourceType = "food" | "wood" | "gold" | "stone";
export type AgentProvider = "claude" | "gpt4" | "gemini" | "llama" | "mistral";
export type ActionType = "move" | "gather" | "rest" | "attack" | "trade" | "build" | "idle";

export const PROVIDER_META: Record<AgentProvider, { color: string; label: string }> = {
  claude:  { color: "#7C3AED", label: "Claude" },
  gpt4:    { color: "#10B981", label: "GPT-4" },
  gemini:  { color: "#3B82F6", label: "Gemini" },
  llama:   { color: "#F59E0B", label: "Llama" },
  mistral: { color: "#EF4444", label: "Mistral" },
};

export interface Position {
  x: number;
  y: number;
}

export interface Tile {
  terrain: TerrainType;
  resources: Partial<Record<ResourceType, number>>;
  structure?: string;
}

export interface AgentDecision {
  action: ActionType;
  direction?: "north" | "south" | "east" | "west";
  target?: string;
  message?: string;
  reasoning: string;
}

export interface AgentTask {
  id: string;
  description: string;
  promptInjection: string;
  completed: boolean;
  failed: boolean;
  tickAssigned: number;
  tickDeadline?: number;
}

export interface Agent {
  id: string;
  name: string;
  provider: AgentProvider;
  model: string;
  personalityPrompt: string;
  position: Position;
  health: number;
  hunger: number;
  inventory: Partial<Record<ResourceType, number>>;
  alive: boolean;
  lastDecision?: AgentDecision;
  lastMessage?: string;
  lastReasoning?: string;
  messageAge: number;
  kills: number;
  ticksAlive: number;
  color: string;
  currentTask?: AgentTask;
  completedTasks: number;
  failedTasks: number;
  // snake_case aliases (from Python backend before conversion)
  ticks_alive?: number;
  last_message?: string;
  last_reasoning?: string;
  current_task?: AgentTask;
  completed_tasks?: number;
  failed_tasks?: number;
  message_age?: number;
}

export interface WorldEvent {
  tick: number;
  type: "action" | "death" | "kill" | "world" | "trade" | "speech" | "task" | "boss";
  agentId?: string;
  agentName?: string;
  message: string;
  severity: "info" | "warning" | "danger" | "success";
}

export interface AgentConfig {
  name: string;
  provider: AgentProvider;
  model: string;
  personalityPrompt: string;
  apiKey?: string;
}

export interface WorldState {
  tick: number;
  phase: "day" | "night";
  width: number;
  height: number;
  grid: Tile[][];
  agents: Agent[];
  events: WorldEvent[];
  running: boolean;
  startedAt: number;
}
