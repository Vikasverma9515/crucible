import type { WorldState, SimulationConfig } from "./types";
import { createInitialState } from "./world";
import { tickSimulation } from "./engine";

// Global in-memory store (single simulation for MVP)
let currentState: WorldState | null = null;
let tickTimer: ReturnType<typeof setTimeout> | null = null;
const subscribers = new Set<(state: WorldState) => void>();

export function getState(): WorldState | null {
  return currentState;
}

export function subscribe(cb: (state: WorldState) => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function broadcast(state: WorldState) {
  for (const cb of subscribers) cb(state);
}

export function startSimulation(config: SimulationConfig): WorldState {
  if (tickTimer) clearTimeout(tickTimer);

  currentState = createInitialState(config.agents);
  broadcast(currentState);
  scheduleNextTick(config.tickIntervalMs);
  return currentState;
}

export function stopSimulation() {
  if (tickTimer) {
    clearTimeout(tickTimer);
    tickTimer = null;
  }
  if (currentState) {
    currentState.running = false;
    broadcast(currentState);
  }
}

export function injectWorldEvent(message: string) {
  if (!currentState) return;
  currentState.events.push({
    tick: currentState.tick,
    type: "world",
    message: `🌍 HOST: ${message}`,
    severity: "warning",
  });
  broadcast(currentState);
}

let tickIntervalMs = 4000;

function scheduleNextTick(intervalMs?: number) {
  if (intervalMs) tickIntervalMs = intervalMs;
  if (tickTimer) clearTimeout(tickTimer);
  tickTimer = setTimeout(async () => {
    if (!currentState?.running) return;
    try {
      currentState = await tickSimulation(currentState);
      broadcast(currentState);
    } catch (e) {
      console.error("Tick error:", e);
    }
    if (currentState?.running) scheduleNextTick();
  }, tickIntervalMs);
}
