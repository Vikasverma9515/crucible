from __future__ import annotations
import asyncio
import random
from .types import WorldState, Agent, AgentDecision, WorldEvent, AgentTask
from .world import is_passable, replenish_resources
from .decisions import get_decision

HUNGER_RATE = 7
HUNGER_DAMAGE = 5
HUNGER_THRESHOLD = 75

WORLD_RANDOM_EVENTS = [
    ("A storm sweeps the Crucible. Agents suffer 10 HP.", "warning", "storm"),
    ("A golden cache appears! Forest resources surge.", "success", "cache"),
    ("The ground trembles. Resources shift across the map.", "warning", "quake"),
    ("A plague of locusts devours surface food.", "danger", "plague"),
    ("A golden age dawns. All agents gain 15 HP.", "success", "feast"),
    ("Mysterious fog descends. Danger lurks in the darkness.", "warning", "fog"),
    ("A meteor strikes! Agents near the center take 20 HP damage.", "danger", "meteor"),
]


def direction_offset(direction: str | None) -> tuple[int, int]:
    return {
        "north": (0, -1),
        "south": (0, 1),
        "east":  (1, 0),
        "west":  (-1, 0),
    }.get(direction or "", random.choice([(0, -1), (0, 1), (1, 0), (-1, 0)]))


def check_task_completion(agent: Agent, state: WorldState) -> WorldEvent | None:
    task = agent.current_task
    if not task or task.completed or task.failed:
        return None

    desc = task.description.lower()

    # Check deadline first
    if task.tick_deadline and state.tick >= task.tick_deadline:
        task.failed = True
        agent.failed_tasks += 1
        return WorldEvent(tick=state.tick, type="task", agent_id=agent.id, agent_name=agent.name,
                          message=f"❌ {agent.name} FAILED task: \"{task.description}\"", severity="danger")

    # Auto-check common task types
    if "build" in desc and "shelter" in desc:
        tile = state.grid[agent.position.y][agent.position.x]
        if tile.structure == "shelter":
            task.completed = True
            agent.completed_tasks += 1
            return WorldEvent(tick=state.tick, type="task", agent_id=agent.id, agent_name=agent.name,
                              message=f"✅ {agent.name} COMPLETED: \"{task.description}\"", severity="success")

    if "gold" in desc:
        amount = int("".join(c for c in desc if c.isdigit()) or "5")
        if agent.inventory.get("gold", 0) >= amount:
            task.completed = True
            agent.completed_tasks += 1
            return WorldEvent(tick=state.tick, type="task", agent_id=agent.id, agent_name=agent.name,
                              message=f"✅ {agent.name} COMPLETED: \"{task.description}\"", severity="success")

    if "food" in desc and "collect" in desc:
        amount = int("".join(c for c in desc if c.isdigit()) or "5")
        if agent.inventory.get("food", 0) >= amount:
            task.completed = True
            agent.completed_tasks += 1
            return WorldEvent(tick=state.tick, type="task", agent_id=agent.id, agent_name=agent.name,
                              message=f"✅ {agent.name} COMPLETED: \"{task.description}\"", severity="success")

    if "kill" in desc or "eliminate" in desc:
        if agent.kills >= 1:
            task.completed = True
            agent.completed_tasks += 1
            return WorldEvent(tick=state.tick, type="task", agent_id=agent.id, agent_name=agent.name,
                              message=f"✅ {agent.name} COMPLETED: \"{task.description}\"", severity="success")

    if "survive" in desc:
        ticks = int("".join(c for c in desc if c.isdigit()) or "20")
        if agent.ticks_alive >= ticks:
            task.completed = True
            agent.completed_tasks += 1
            return WorldEvent(tick=state.tick, type="task", agent_id=agent.id, agent_name=agent.name,
                              message=f"✅ {agent.name} COMPLETED: \"{task.description}\"", severity="success")

    return None


def apply_world_event(event_type: str, state: WorldState, new_events: list[WorldEvent]) -> None:
    alive = [a for a in state.agents if a.alive]
    cx, cy = state.width // 2, state.height // 2

    if event_type == "storm":
        for a in alive:
            a.health = max(1, a.health - 10)

    elif event_type == "cache":
        for row in state.grid:
            for tile in row:
                if tile.terrain == "forest":
                    tile.resources["food"] = min(tile.resources.get("food", 0) + 3, 12)

    elif event_type == "feast":
        for a in alive:
            a.health = min(100, a.health + 15)

    elif event_type == "plague":
        for row in state.grid:
            for tile in row:
                if tile.resources.get("food", 0) > 0:
                    tile.resources["food"] = max(0, tile.resources["food"] - random.randint(0, 2))

    elif event_type == "meteor":
        for a in alive:
            dist = abs(a.position.x - cx) + abs(a.position.y - cy)
            if dist < 5:
                dmg = max(0, 20 - dist * 3)
                a.health = max(0, a.health - dmg)
                if a.health <= 0:
                    a.alive = False
                    new_events.append(WorldEvent(tick=state.tick, type="death", agent_id=a.id, agent_name=a.name,
                                                 message=f"💀 {a.name} was killed by the meteor!", severity="danger"))


def apply_decision(agent: Agent, decision: AgentDecision, state: WorldState) -> list[WorldEvent]:
    events: list[WorldEvent] = []
    agent.last_decision = decision
    agent.last_reasoning = decision.reasoning

    if decision.message:
        agent.last_message = decision.message
        agent.message_age = 0

    if decision.action == "move":
        dx, dy = direction_offset(decision.direction)
        nx, ny = agent.position.x + dx, agent.position.y + dy
        occupied = any(a.alive and a.id != agent.id and a.position.x == nx and a.position.y == ny for a in state.agents)
        if is_passable(state.grid, nx, ny) and not occupied:
            agent.position.x = nx
            agent.position.y = ny

    elif decision.action == "gather":
        tile = state.grid[agent.position.y][agent.position.x]
        for res, amount in list(tile.resources.items()):
            if amount > 0:
                take = min(amount, 2)
                tile.resources[res] = amount - take
                agent.inventory[res] = agent.inventory.get(res, 0) + take
                if res == "food":
                    agent.hunger = max(0, agent.hunger - take * 12)
                break

    elif decision.action == "rest":
        agent.health = min(100, agent.health + 5)
        agent.hunger = max(0, agent.hunger - 3)

    elif decision.action == "attack":
        target_name = (decision.target or "").lower()
        target = next(
            (a for a in state.agents if a.alive and a.id != agent.id and a.name.lower() == target_name),
            None
        ) or min(
            (a for a in state.agents if a.alive and a.id != agent.id),
            key=lambda a: abs(a.position.x - agent.position.x) + abs(a.position.y - agent.position.y),
            default=None,
        )
        if target:
            dist = abs(target.position.x - agent.position.x) + abs(target.position.y - agent.position.y)
            if dist <= 2:
                dmg = random.randint(10, 25)
                target.health -= dmg
                events.append(WorldEvent(tick=state.tick, type="action", agent_id=agent.id, agent_name=agent.name,
                                         message=f"⚔️ {agent.name} attacks {target.name} for {dmg} dmg!", severity="danger"))
                if target.health <= 0:
                    target.alive = False
                    target.health = 0
                    agent.kills += 1
                    events.append(WorldEvent(tick=state.tick, type="death", agent_id=target.id, agent_name=target.name,
                                             message=f"💀 {target.name} eliminated by {agent.name}!", severity="danger"))

    elif decision.action == "build":
        tile = state.grid[agent.position.y][agent.position.x]
        if agent.inventory.get("wood", 0) >= 3:
            tile.structure = "shelter"
            agent.inventory["wood"] = agent.inventory.get("wood", 0) - 3
            events.append(WorldEvent(tick=state.tick, type="action", agent_id=agent.id, agent_name=agent.name,
                                     message=f"🏕️ {agent.name} built a shelter!", severity="success"))

    elif decision.action == "trade":
        target_name = (decision.target or "").lower()
        target = next((a for a in state.agents if a.alive and a.id != agent.id and a.name.lower() == target_name), None)
        if target:
            dist = abs(target.position.x - agent.position.x) + abs(target.position.y - agent.position.y)
            if dist <= 2 and agent.inventory.get("food", 0) > 0:
                agent.inventory["food"] = agent.inventory.get("food", 0) - 1
                target.inventory["food"] = target.inventory.get("food", 0) + 1
                events.append(WorldEvent(tick=state.tick, type="trade", agent_id=agent.id, agent_name=agent.name,
                                         message=f"🤝 {agent.name} traded with {target.name}.", severity="success"))

    return events


async def tick(state: WorldState) -> WorldState:
    state.tick += 1
    state.phase = "day" if state.tick % 20 < 10 else "night"
    new_events: list[WorldEvent] = []

    # Random world events
    if random.random() < 0.07:
        msg, sev, etype = random.choice(WORLD_RANDOM_EVENTS)
        new_events.append(WorldEvent(tick=state.tick, type="world", message=f"🌍 {msg}", severity=sev))  # type: ignore[arg-type]
        apply_world_event(etype, state, new_events)

    # Process each alive agent concurrently
    alive = [a for a in state.agents if a.alive]

    async def process_agent(agent: Agent) -> None:
        agent.ticks_alive += 1
        agent.message_age += 1

        # Auto-eat from inventory
        if agent.inventory.get("food", 0) > 0 and agent.hunger > 40:
            agent.inventory["food"] -= 1
            agent.hunger = max(0, agent.hunger - 30)

        # Hunger tick
        agent.hunger = min(100, agent.hunger + HUNGER_RATE)
        if agent.hunger >= HUNGER_THRESHOLD:
            agent.health -= HUNGER_DAMAGE
            if agent.health <= 0:
                agent.alive = False
                agent.health = 0
                new_events.append(WorldEvent(tick=state.tick, type="death", agent_id=agent.id, agent_name=agent.name,
                                             message=f"💀 {agent.name} starved to death.", severity="danger"))
                return

        # LLM decision
        try:
            decision = await get_decision(agent, state)
            action_events = apply_decision(agent, decision, state)
            new_events.extend(action_events)

            if decision.message and decision.action != "idle":
                new_events.append(WorldEvent(tick=state.tick, type="speech", agent_id=agent.id, agent_name=agent.name,
                                             message=f'💬 {agent.name}: "{decision.message}"', severity="info"))
        except Exception:
            pass

        # Check task completion
        task_event = check_task_completion(agent, state)
        if task_event:
            new_events.append(task_event)

    await asyncio.gather(*[process_agent(a) for a in alive])

    # Replenish resources every 5 ticks
    if state.tick % 5 == 0:
        replenish_resources(state.grid)

    # Trim event log
    state.events = (state.events + new_events)[-100:]

    # End condition
    alive_now = [a for a in state.agents if a.alive]
    if len(alive_now) <= 1:
        state.running = False
        if alive_now:
            state.events.append(WorldEvent(tick=state.tick, type="world",
                                           message=f"🏆 {alive_now[0].name} is the last survivor!", severity="success"))
        else:
            state.events.append(WorldEvent(tick=state.tick, type="world",
                                           message="💀 All agents have perished.", severity="danger"))

    return state
