from __future__ import annotations
import random
from .types import Tile, WorldState, AgentConfig, Agent, Position, WorldEvent, PROVIDER_META
import time

WORLD_WIDTH = 28
WORLD_HEIGHT = 20


def generate_world(seed: int | None = None) -> list[list[Tile]]:
    rng = random.Random(seed or int(time.time()))
    grid: list[list[Tile]] = []

    for y in range(WORLD_HEIGHT):
        row: list[Tile] = []
        for x in range(WORLD_WIDTH):
            # Borders are water
            if x == 0 or y == 0 or x == WORLD_WIDTH - 1 or y == WORLD_HEIGHT - 1:
                row.append(Tile(terrain="water"))
                continue

            n = rng.random()
            if n < 0.08:
                terrain = "mountain"
            elif n < 0.20:
                terrain = "forest"
            elif n < 0.28:
                terrain = "plains"
            elif n < 0.33:
                terrain = "desert"
            elif n < 0.36:
                terrain = "water"
            else:
                terrain = "grass"

            resources: dict[str, int] = {}
            if terrain == "forest":
                resources["food"] = rng.randint(3, 10)
                resources["wood"] = rng.randint(2, 7)
            elif terrain == "plains":
                resources["gold"] = rng.randint(1, 5)
            elif terrain == "mountain":
                resources["stone"] = rng.randint(2, 8)
            elif terrain == "grass" and rng.random() < 0.15:
                resources["food"] = rng.randint(1, 3)

            row.append(Tile(terrain=terrain, resources=resources))
        grid.append(row)

    return grid


def is_passable(grid: list[list[Tile]], x: int, y: int) -> bool:
    if x < 0 or y < 0 or x >= WORLD_WIDTH or y >= WORLD_HEIGHT:
        return False
    return grid[y][x].terrain not in ("water", "mountain")


def find_spawn(grid: list[list[Tile]], taken: set[str]) -> Position:
    passable_terrains = {"grass", "plains", "desert"}
    candidates = [
        Position(x=x, y=y)
        for y in range(2, WORLD_HEIGHT - 2)
        for x in range(2, WORLD_WIDTH - 2)
        if grid[y][x].terrain in passable_terrains and f"{x},{y}" not in taken
    ]
    if not candidates:
        return Position(x=5, y=5)
    return random.choice(candidates)


def replenish_resources(grid: list[list[Tile]]) -> None:
    for row in grid:
        for tile in row:
            if tile.terrain == "forest" and random.random() < 0.15:
                tile.resources["food"] = min(tile.resources.get("food", 0) + 1, 10)
                tile.resources["wood"] = min(tile.resources.get("wood", 0) + 1, 8)
            elif tile.terrain == "plains" and random.random() < 0.08:
                tile.resources["gold"] = min(tile.resources.get("gold", 0) + 1, 6)


def create_initial_state(configs: list[AgentConfig]) -> WorldState:
    grid = generate_world()
    taken: set[str] = set()
    agents: list[Agent] = []

    for i, cfg in enumerate(configs):
        pos = find_spawn(grid, taken)
        taken.add(f"{pos.x},{pos.y}")
        meta = PROVIDER_META.get(cfg.provider, {"color": "#888"})

        agents.append(Agent(
            id=f"agent_{i}",
            name=cfg.name,
            provider=cfg.provider,
            model=cfg.model,
            personality_prompt=cfg.personality_prompt,
            position=pos,
            color=meta["color"],
        ))

    return WorldState(
        grid=grid,
        agents=agents,
        events=[WorldEvent(tick=0, type="world", message="The Crucible begins. Agents awaken.", severity="info")],
        running=True,
        started_at=time.time(),
        width=WORLD_WIDTH,
        height=WORLD_HEIGHT,
    )
