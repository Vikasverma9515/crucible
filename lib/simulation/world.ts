import type { Tile, TerrainType, WorldState, AgentConfig, Agent, Position } from "./types";
import { PROVIDER_META } from "./types";

const WORLD_WIDTH = 28;
const WORLD_HEIGHT = 20;

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function generateWorld(seed = Date.now()): Tile[][] {
  const rng = seededRandom(seed);
  const grid: Tile[][] = [];

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    grid[y] = [];
    for (let x = 0; x < WORLD_WIDTH; x++) {
      let terrain: TerrainType = "grass";
      const n = rng();

      // Borders = water
      if (x === 0 || y === 0 || x === WORLD_WIDTH - 1 || y === WORLD_HEIGHT - 1) {
        terrain = "water";
      } else if (n < 0.08) {
        terrain = "mountain";
      } else if (n < 0.2) {
        terrain = "forest";
      } else if (n < 0.28) {
        terrain = "plains";
      } else if (n < 0.33) {
        terrain = "desert";
      } else if (n < 0.36) {
        terrain = "water";
      }

      const resources: Tile["resources"] = {};
      if (terrain === "forest") resources.food = Math.floor(rng() * 8) + 3;
      if (terrain === "forest") resources.wood = Math.floor(rng() * 5) + 2;
      if (terrain === "plains") resources.gold = Math.floor(rng() * 4) + 1;
      if (terrain === "mountain") resources.stone = Math.floor(rng() * 6) + 2;
      if (terrain === "grass" && rng() < 0.15) resources.food = Math.floor(rng() * 3) + 1;

      grid[y][x] = { terrain, resources };
    }
  }

  return grid;
}

function findSpawnPosition(grid: Tile[][], taken: Set<string>): Position {
  const passable = ["grass", "plains", "desert"];
  const candidates: Position[] = [];
  for (let y = 2; y < WORLD_HEIGHT - 2; y++) {
    for (let x = 2; x < WORLD_WIDTH - 2; x++) {
      if (passable.includes(grid[y][x].terrain) && !taken.has(`${x},${y}`)) {
        candidates.push({ x, y });
      }
    }
  }
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx] ?? { x: 5, y: 5 };
}

export function createInitialState(configs: AgentConfig[]): WorldState {
  const grid = generateWorld();
  const taken = new Set<string>();

  const agents: Agent[] = configs.map((cfg, i) => {
    const pos = findSpawnPosition(grid, taken);
    taken.add(`${pos.x},${pos.y}`);
    const meta = PROVIDER_META[cfg.provider];
    return {
      id: `agent_${i}`,
      name: cfg.name,
      provider: cfg.provider,
      model: cfg.model,
      personalityPrompt: cfg.personalityPrompt,
      position: pos,
      health: 100,
      hunger: 20,
      inventory: { food: 3 },
      alive: true,
      lastDecision: undefined,
      lastMessage: undefined,
      messageAge: 0,
      kills: 0,
      ticksAlive: 0,
      color: meta.color,
      emoji: meta.emoji,
    };
  });

  return {
    tick: 0,
    phase: "day",
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    grid,
    agents,
    events: [
      {
        tick: 0,
        type: "world",
        message: "The Crucible begins. Agents awaken.",
        severity: "info",
      },
    ],
    running: true,
    startedAt: Date.now(),
    worldEventQueue: [],
  };
}

export function isPassable(grid: Tile[][], x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= WORLD_WIDTH || y >= WORLD_HEIGHT) return false;
  return grid[y][x].terrain !== "water" && grid[y][x].terrain !== "mountain";
}

export function replenishResources(grid: Tile[][]): void {
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const tile = grid[y][x];
      if (tile.terrain === "forest" && Math.random() < 0.15) {
        tile.resources.food = Math.min((tile.resources.food ?? 0) + 1, 10);
        tile.resources.wood = Math.min((tile.resources.wood ?? 0) + 1, 8);
      }
      if (tile.terrain === "plains" && Math.random() < 0.08) {
        tile.resources.gold = Math.min((tile.resources.gold ?? 0) + 1, 6);
      }
    }
  }
}
