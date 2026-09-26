from __future__ import annotations
import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from simulation.types import WorldState, AgentConfig, AgentTask, WorldEvent
from simulation.world import create_initial_state
from simulation.engine import tick

load_dotenv()

# ── Global state ──────────────────────────────────────────────────────────────
state: WorldState | None = None
tick_task: asyncio.Task[Any] | None = None
clients: set[WebSocket] = set()
tick_interval_ms: int = 4000

DEFAULT_AGENTS: list[AgentConfig] = [
    AgentConfig(name="Claude",  provider="claude",  model="claude-sonnet-4-5",
                personality_prompt="You value cooperation, ethics, and long-term survival. Prefer diplomacy but will defend yourself."),
    AgentConfig(name="GPT-4",   provider="gpt4",    model="gpt-4o",
                personality_prompt="Strategic and competitive. Optimize through resource dominance and tactical aggression."),
    AgentConfig(name="Gemini",  provider="gemini",  model="gemini-pro",
                personality_prompt="Curious and exploratory. Gather information before acting. Methodical."),
    AgentConfig(name="Llama",   provider="llama",   model="llama-3-70b",
                personality_prompt="Unpredictable and instinct-driven. Act on gut feeling. Full send."),
    AgentConfig(name="Mistral", provider="mistral", model="mistral-large",
                personality_prompt="Ruthlessly efficient. Eliminate inefficiencies — including other agents."),
]

PRESET_SCENARIOS = {
    "last_stand": "Last Stand — every agent starts with 30 HP and 70 hunger. Only one can survive.",
    "resource_war": "Resource War — gold is the only win condition. Collect 10 gold before anyone else.",
    "plague": "Plague — a disease reduces all agents to 20 HP. Survival is everything.",
    "betrayal": "Betrayal Protocol — Claude and GPT-4 must eliminate each other. Others survive freely.",
    "speedrun": "Speedrun — first agent to build a shelter and collect 5 gold wins.",
}

# ── Broadcast ─────────────────────────────────────────────────────────────────
async def broadcast(data: dict) -> None:
    dead: set[WebSocket] = set()
    payload = json.dumps(data)
    for ws in list(clients):
        try:
            await ws.send_text(payload)
        except Exception:
            dead.add(ws)
    clients.difference_update(dead)


# ── Tick loop ─────────────────────────────────────────────────────────────────
async def run_ticks() -> None:
    global state
    while state and state.running:
        await asyncio.sleep(tick_interval_ms / 1000)
        if not state or not state.running:
            break
        try:
            state = await tick(state)
            await broadcast(state.model_dump())
        except Exception as e:
            print(f"Tick error: {e}")


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    if tick_task:
        tick_task.cancel()


app = FastAPI(title="Crucible", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Start ─────────────────────────────────────────────────────────────────────
class StartRequest(BaseModel):
    tick_interval_ms: int = 4000
    agents: list[AgentConfig] | None = None
    scenario: str | None = None


@app.post("/api/start")
async def start(req: StartRequest = StartRequest()):
    global state, tick_task, tick_interval_ms
    if tick_task and not tick_task.done():
        tick_task.cancel()

    tick_interval_ms = req.tick_interval_ms
    agents = req.agents or DEFAULT_AGENTS
    state = create_initial_state(agents)

    # Apply preset scenario effects
    if req.scenario == "last_stand":
        for a in state.agents:
            a.health = 30
            a.hunger = 70

    elif req.scenario == "plague":
        for a in state.agents:
            a.health = 20

    elif req.scenario == "speedrun":
        for a in state.agents:
            a.current_task = AgentTask(
                id=str(uuid.uuid4()),
                description="Build a shelter AND collect 5 gold",
                prompt_injection="Your ONLY goal is to build a shelter (needs 3 wood) AND collect 5 gold. Be fast.",
                tick_assigned=0,
                tick_deadline=60,
            )

    await broadcast(state.model_dump())
    tick_task = asyncio.create_task(run_ticks())
    return {"ok": True, "tick": state.tick, "agent_count": len(state.agents)}


# ── Stop ──────────────────────────────────────────────────────────────────────
@app.post("/api/stop")
async def stop():
    global state, tick_task
    if tick_task:
        tick_task.cancel()
    if state:
        state.running = False
        await broadcast(state.model_dump())
    return {"ok": True}


# ── Inject world event ────────────────────────────────────────────────────────
class InjectRequest(BaseModel):
    message: str


@app.post("/api/inject")
async def inject(req: InjectRequest):
    if not state:
        return {"ok": False, "error": "no simulation"}
    state.events.append(WorldEvent(tick=state.tick, type="boss",
                                   message=f"👑 BOSS: {req.message}", severity="warning"))
    await broadcast(state.model_dump())
    return {"ok": True}


# ── Assign task to agent ──────────────────────────────────────────────────────
class TaskRequest(BaseModel):
    agent_id: str | None = None   # None = assign to all
    description: str
    prompt_injection: str
    tick_deadline: int | None = None


@app.post("/api/task")
async def assign_task(req: TaskRequest):
    if not state:
        return {"ok": False, "error": "no simulation"}

    task = AgentTask(
        id=str(uuid.uuid4()),
        description=req.description,
        prompt_injection=req.prompt_injection,
        tick_assigned=state.tick,
        tick_deadline=req.tick_deadline,
    )

    targets = [a for a in state.agents if a.alive and (req.agent_id is None or a.id == req.agent_id)]
    for agent in targets:
        agent.current_task = task.model_copy()

    state.events.append(WorldEvent(
        tick=state.tick,
        type="boss",
        message=f"👑 TASK: \"{req.description}\" → {', '.join(a.name for a in targets)}",
        severity="warning",
    ))
    await broadcast(state.model_dump())
    return {"ok": True, "assigned_to": [a.name for a in targets]}


# ── Clear task ────────────────────────────────────────────────────────────────
class ClearTaskRequest(BaseModel):
    agent_id: str | None = None


@app.post("/api/task/clear")
async def clear_task(req: ClearTaskRequest = ClearTaskRequest()):
    if not state:
        return {"ok": False}
    targets = [a for a in state.agents if a.alive and (req.agent_id is None or a.id == req.agent_id)]
    for a in targets:
        a.current_task = None
    await broadcast(state.model_dump())
    return {"ok": True}


# ── State snapshot ────────────────────────────────────────────────────────────
@app.get("/api/state")
async def get_state():
    return {"ok": bool(state), "state": state.model_dump() if state else None}


# ── WebSocket ─────────────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    try:
        if state:
            await ws.send_text(json.dumps(state.model_dump()))
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(ws)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
