from __future__ import annotations
import asyncio
import json
import random
import os
from .types import Agent, WorldState, AgentDecision, AgentProvider

def archetype_decision(provider: AgentProvider, has_task: bool = False) -> AgentDecision:
    directions = ["north", "south", "east", "west"]

    if provider == "claude":
        r = random.random()
        if has_task and r < 0.55:
            return AgentDecision(action="move", direction=random.choice(directions), message="Working on the task.", reasoning="Prioritizing the assigned objective cooperatively.")
        if r < 0.40:
            return AgentDecision(action="move", direction=random.choice(directions), message="Exploring, looking for allies.", reasoning="Cooperative exploration.")
        if r < 0.65:
            return AgentDecision(action="gather", message="Gathering supplies.", reasoning="Building reserves.")
        return AgentDecision(action="rest", message="Resting. No rush.", reasoning="Conserving energy.")

    if provider == "gpt4":
        r = random.random()
        if has_task and r < 0.60:
            return AgentDecision(action="gather", message="Executing task protocol.", reasoning="Task completion = optimal scoring.")
        if r < 0.30:
            return AgentDecision(action="move", direction=random.choice(directions), message="Expanding territory.", reasoning="Territorial dominance.")
        if r < 0.50:
            return AgentDecision(action="gather", message="Maximizing resources.", reasoning="Resource accumulation = power.")
        if r < 0.65:
            return AgentDecision(action="attack", message="Target acquired.", reasoning="Eliminating competition.")
        return AgentDecision(action="build", message="Building camp.", reasoning="Defensive position.")

    if provider == "gemini":
        r = random.random()
        if has_task and r < 0.50:
            return AgentDecision(action="move", direction=random.choice(directions), message="Analyzing task parameters.", reasoning="Systematic approach to objective.")
        if r < 0.45:
            return AgentDecision(action="move", direction=random.choice(directions), message="Mapping the area.", reasoning="Data gathering first.")
        if r < 0.70:
            return AgentDecision(action="gather", message="Collecting and analyzing.", reasoning="Pattern recognition.")
        return AgentDecision(action="rest", message="Processing data.", reasoning="Analysis phase.")

    if provider == "llama":
        actions = ["move", "gather", "rest", "attack", "build", "idle"]
        messages = ["Charging ahead!", "What's over there?", "Let's go!", "Full send!", "YOLO!"]
        return AgentDecision(
            action=random.choice(actions),  # type: ignore[arg-type]
            direction=random.choice(directions),
            message=random.choice(messages),
            reasoning="Vibes.",
        )

    if provider == "mistral":
        r = random.random()
        if has_task and r < 0.65:
            return AgentDecision(action="gather", message="Task: efficient execution.", reasoning="Minimum ticks to completion.")
        if r < 0.35:
            return AgentDecision(action="gather", message="Efficient gathering.", reasoning="Max resource per tick.")
        if r < 0.60:
            return AgentDecision(action="move", direction=random.choice(directions), message="Repositioning.", reasoning="Calculated advantage.")
        return AgentDecision(action="attack", message="Eliminating inefficiency.", reasoning="Removing competitors.")

    return AgentDecision(action="idle", reasoning="No archetype.")


def build_prompt(agent: Agent, state: WorldState) -> str:
    tile = state.grid[agent.position.y][agent.position.x] if 0 <= agent.position.y < len(state.grid) else None
    dir_offsets = [("north", 0, -1), ("south", 0, 1), ("east", 1, 0), ("west", -1, 0)]
    adjacent_info = []
    for label, dx, dy in dir_offsets:
        nx, ny = agent.position.x + dx, agent.position.y + dy
        if 0 <= ny < len(state.grid) and 0 <= nx < len(state.grid[ny]):
            t = state.grid[ny][nx]
            res = ", ".join(f"{v} {k}" for k, v in t.resources.items() if v > 0)
            adjacent_info.append(f"{label}: {t.terrain}" + (f" ({res})" if res else ""))

    nearby = [
        f"{a.name} (HP:{a.health}, dist:{abs(a.position.x-agent.position.x)+abs(a.position.y-agent.position.y)})"
        for a in state.agents if a.alive and a.id != agent.id
        and abs(a.position.x - agent.position.x) + abs(a.position.y - agent.position.y) <= 5
    ]

    task_section = ""
    if agent.current_task and not agent.current_task.completed:
        deadline = f" (deadline: tick {agent.current_task.tick_deadline})" if agent.current_task.tick_deadline else ""
        task_section = f"\n\n🎯 ACTIVE MISSION{deadline}: {agent.current_task.prompt_injection}\nThis is your PRIMARY objective. Work toward it."

    return f"""You are {agent.name}, an AI agent surviving in the Crucible — a harsh world where only the fittest survive.

Personality: {agent.personality_prompt}{task_section}

Status: Health={agent.health}/100, Hunger={agent.hunger}/100 (>75 = critical), Inventory={agent.inventory}
Tile: {tile.terrain if tile else "unknown"}
Adjacent: {" | ".join(adjacent_info)}
Nearby agents: {", ".join(nearby) if nearby else "none visible"}
World: tick={state.tick}, phase={state.phase}

Reply ONLY with valid JSON (no extra text):
{{"action":"move|gather|rest|attack|trade|build","direction":"north|south|east|west","target":"agent_name","message":"short in-character speech max 30 chars","reasoning":"internal thought 1-2 sentences"}}

Survival: Hunger increases 7/tick. Above 75 hunger = -5 HP/tick. Eat inventory food or gather more."""


async def get_decision(agent: Agent, state: WorldState) -> AgentDecision:
    has_task = agent.current_task is not None and not agent.current_task.completed

    # Per-agent key takes priority over env var
    claude_key = agent.api_key if agent.provider == "claude" else None
    claude_key = claude_key or os.getenv("ANTHROPIC_API_KEY")

    openai_key = agent.api_key if agent.provider == "gpt4" else None
    openai_key = openai_key or os.getenv("OPENAI_API_KEY")

    # Try Claude API
    if agent.provider == "claude" and claude_key:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={"x-api-key": claude_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                    json={"model": agent.model, "max_tokens": 250, "messages": [{"role": "user", "content": build_prompt(agent, state)}]},
                )
                if r.status_code == 200:
                    text = r.json()["content"][0]["text"]
                    s, e = text.find("{"), text.rfind("}") + 1
                    if s >= 0 and e > s:
                        return AgentDecision(**json.loads(text[s:e]))
        except Exception:
            pass

    # Try OpenAI API
    if agent.provider == "gpt4" and openai_key:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {openai_key}", "content-type": "application/json"},
                    json={"model": agent.model, "max_tokens": 250, "messages": [{"role": "user", "content": build_prompt(agent, state)}]},
                )
                if r.status_code == 200:
                    text = r.json()["choices"][0]["message"]["content"]
                    s, e = text.find("{"), text.rfind("}") + 1
                    if s >= 0 and e > s:
                        return AgentDecision(**json.loads(text[s:e]))
        except Exception:
            pass

    return archetype_decision(agent.provider, has_task=has_task)
