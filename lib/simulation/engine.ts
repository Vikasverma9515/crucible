import type { WorldState, Agent, AgentDecision, WorldEvent } from "./types";
import { isPassable, replenishResources } from "./world";
import { getDecision } from "./decisions";

const HUNGER_RATE = 7;
const HUNGER_DAMAGE = 5;
const HUNGER_THRESHOLD = 75;

function directionOffset(dir?: string): { dx: number; dy: number } {
  switch (dir) {
    case "north": return { dx: 0, dy: -1 };
    case "south": return { dx: 0, dy: 1 };
    case "east":  return { dx: 1, dy: 0 };
    case "west":  return { dx: -1, dy: 0 };
    default: {
      const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 }];
      return dirs[Math.floor(Math.random() * 4)];
    }
  }
}

function applyDecision(agent: Agent, decision: AgentDecision, state: WorldState): WorldEvent[] {
  const events: WorldEvent[] = [];

  agent.lastDecision = decision;
  if (decision.message) {
    agent.lastMessage = decision.message;
    agent.messageAge = 0;
  }

  switch (decision.action) {
    case "move": {
      const { dx, dy } = directionOffset(decision.direction);
      const nx = agent.position.x + dx;
      const ny = agent.position.y + dy;
      if (isPassable(state.grid, nx, ny) && !state.agents.find((a) => a.alive && a.id !== agent.id && a.position.x === nx && a.position.y === ny)) {
        agent.position = { x: nx, y: ny };
      }
      break;
    }

    case "gather": {
      const tile = state.grid[agent.position.y]?.[agent.position.x];
      if (tile) {
        let gathered = false;
        for (const [res, amount] of Object.entries(tile.resources) as [keyof typeof tile.resources, number][]) {
          if ((amount ?? 0) > 0) {
            const take = Math.min(amount, 2);
            tile.resources[res] = (amount - take) as number;
            agent.inventory[res] = (agent.inventory[res] ?? 0) + take;
            if (res === "food") {
              agent.hunger = Math.max(0, agent.hunger - take * 12);
            }
            gathered = true;
            break;
          }
        }
        if (!gathered) {
          events.push({ tick: state.tick, type: "action", agentId: agent.id, agentName: agent.name, message: `${agent.name} finds nothing to gather here.`, severity: "info" });
        }
      }
      break;
    }

    case "rest":
      agent.health = Math.min(100, agent.health + 5);
      agent.hunger = Math.max(0, agent.hunger - 3);
      break;

    case "attack": {
      const targetName = decision.target;
      const target = state.agents.find((a) => a.alive && a.name.toLowerCase() === targetName?.toLowerCase());
      if (target) {
        const dist = Math.abs(target.position.x - agent.position.x) + Math.abs(target.position.y - agent.position.y);
        if (dist <= 2) {
          const dmg = Math.floor(Math.random() * 20) + 10;
          target.health -= dmg;
          events.push({ tick: state.tick, type: "action", agentId: agent.id, agentName: agent.name, message: `⚔️ ${agent.name} attacks ${target.name} for ${dmg} damage!`, severity: "danger" });
          if (target.health <= 0) {
            target.alive = false;
            target.health = 0;
            agent.kills += 1;
            events.push({ tick: state.tick, type: "death", agentId: target.id, agentName: target.name, message: `💀 ${target.name} has been eliminated by ${agent.name}!`, severity: "danger" });
          }
        }
      }
      break;
    }

    case "build": {
      const tile = state.grid[agent.position.y]?.[agent.position.x];
      if (tile && (agent.inventory.wood ?? 0) >= 3) {
        tile.structure = "shelter";
        agent.inventory.wood = (agent.inventory.wood ?? 0) - 3;
        events.push({ tick: state.tick, type: "action", agentId: agent.id, agentName: agent.name, message: `🏕️ ${agent.name} built a shelter.`, severity: "success" });
      }
      break;
    }

    case "trade": {
      const targetName = decision.target;
      const target = state.agents.find((a) => a.alive && a.name.toLowerCase() === targetName?.toLowerCase());
      if (target) {
        const dist = Math.abs(target.position.x - agent.position.x) + Math.abs(target.position.y - agent.position.y);
        if (dist <= 2 && (agent.inventory.food ?? 0) > 0 && (target.inventory.gold ?? 0) > 0) {
          agent.inventory.food = (agent.inventory.food ?? 0) - 1;
          target.inventory.food = (target.inventory.food ?? 0) + 1;
          events.push({ tick: state.tick, type: "trade", agentId: agent.id, agentName: agent.name, message: `🤝 ${agent.name} traded with ${target.name}.`, severity: "success" });
        }
      }
      break;
    }
  }

  return events;
}

export async function tickSimulation(state: WorldState): Promise<WorldState> {
  state.tick += 1;
  state.phase = state.tick % 20 < 10 ? "day" : "night";

  const newEvents: WorldEvent[] = [];

  // Random world events
  if (Math.random() < 0.05) {
    const worldEvents = [
      "A storm sweeps the Crucible. Visibility reduced.",
      "A hidden cache of food is discovered nearby.",
      "The ground trembles. Resources shift.",
      "A plague of locusts devours surface food.",
      "A golden age dawns. Resources surge.",
    ];
    const msg = worldEvents[Math.floor(Math.random() * worldEvents.length)];
    newEvents.push({ tick: state.tick, type: "world", message: `🌍 ${msg}`, severity: "warning" });
    state.worldEventQueue.push(msg);
  }

  // Process each alive agent
  const aliveAgents = state.agents.filter((a) => a.alive);

  for (const agent of aliveAgents) {
    agent.ticksAlive += 1;
    agent.messageAge += 1;

    // Consume food from inventory to reduce hunger
    if ((agent.inventory.food ?? 0) > 0 && agent.hunger > 40) {
      agent.inventory.food = (agent.inventory.food ?? 0) - 1;
      agent.hunger = Math.max(0, agent.hunger - 30);
    }

    // Increase hunger
    agent.hunger = Math.min(100, agent.hunger + HUNGER_RATE);

    // Hunger damage
    if (agent.hunger >= HUNGER_THRESHOLD) {
      agent.health -= HUNGER_DAMAGE;
      if (agent.health <= 0) {
        agent.alive = false;
        agent.health = 0;
        newEvents.push({ tick: state.tick, type: "death", agentId: agent.id, agentName: agent.name, message: `💀 ${agent.name} perished from starvation.`, severity: "danger" });
        continue;
      }
    }

    // Get LLM decision
    try {
      const decision = await getDecision(agent, state);
      const actionEvents = applyDecision(agent, decision, state);
      newEvents.push(...actionEvents);

      if (decision.message && decision.action !== "idle") {
        newEvents.push({ tick: state.tick, type: "speech", agentId: agent.id, agentName: agent.name, message: `💬 ${agent.name}: "${decision.message}"`, severity: "info" });
      }
    } catch {
      // agent skips turn
    }
  }

  // Replenish world resources occasionally
  if (state.tick % 5 === 0) replenishResources(state.grid);

  // Keep event log trimmed
  state.events = [...state.events, ...newEvents].slice(-80);

  // Check if simulation should end
  const alive = state.agents.filter((a) => a.alive);
  if (alive.length <= 1) {
    state.running = false;
    if (alive.length === 1) {
      state.events.push({ tick: state.tick, type: "world", message: `🏆 ${alive[0].name} is the last survivor of the Crucible!`, severity: "success" });
    } else {
      state.events.push({ tick: state.tick, type: "world", message: "💀 All agents have perished. The Crucible claims all.", severity: "danger" });
    }
  }

  return state;
}
