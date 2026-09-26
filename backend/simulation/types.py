from __future__ import annotations
from typing import Optional, Literal
from pydantic import BaseModel

TerrainType = Literal["grass", "forest", "water", "mountain", "plains", "desert"]
ResourceType = Literal["food", "wood", "gold", "stone"]
AgentProvider = Literal["claude", "gpt4", "gemini", "llama", "mistral"]
ActionType = Literal["move", "gather", "rest", "attack", "trade", "build", "idle"]

PROVIDER_META = {
    "claude":  {"color": "#7C3AED", "label": "Claude"},
    "gpt4":    {"color": "#10B981", "label": "GPT-4"},
    "gemini":  {"color": "#3B82F6", "label": "Gemini"},
    "llama":   {"color": "#F59E0B", "label": "Llama"},
    "mistral": {"color": "#EF4444", "label": "Mistral"},
}


class Position(BaseModel):
    x: int
    y: int


class Tile(BaseModel):
    terrain: TerrainType
    resources: dict[str, int] = {}
    structure: Optional[str] = None


class AgentDecision(BaseModel):
    action: ActionType = "idle"
    direction: Optional[Literal["north", "south", "east", "west"]] = None
    target: Optional[str] = None
    message: Optional[str] = None
    reasoning: str = ""


class AgentTask(BaseModel):
    id: str
    description: str  # what you see in the UI
    prompt_injection: str  # what the LLM gets told
    completed: bool = False
    failed: bool = False
    tick_assigned: int = 0
    tick_deadline: Optional[int] = None  # None = no deadline


class Agent(BaseModel):
    id: str
    name: str
    provider: AgentProvider
    model: str
    personality_prompt: str
    position: Position
    health: int = 100
    hunger: int = 20
    inventory: dict[str, int] = {"food": 3}
    alive: bool = True
    last_decision: Optional[AgentDecision] = None
    last_message: Optional[str] = None
    last_reasoning: Optional[str] = None
    message_age: int = 0
    kills: int = 0
    ticks_alive: int = 0
    color: str = "#7C3AED"
    api_key: Optional[str] = None  # stored in memory only, never broadcast
    current_task: Optional[AgentTask] = None
    completed_tasks: int = 0
    failed_tasks: int = 0


class WorldEvent(BaseModel):
    tick: int
    type: Literal["action", "death", "kill", "world", "trade", "speech", "task", "boss"]
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    message: str
    severity: Literal["info", "warning", "danger", "success"] = "info"


class WorldState(BaseModel):
    tick: int = 0
    phase: Literal["day", "night"] = "day"
    width: int = 28
    height: int = 20
    grid: list[list[Tile]] = []
    agents: list[Agent] = []
    events: list[WorldEvent] = []
    running: bool = False
    started_at: float = 0.0


class AgentConfig(BaseModel):
    name: str
    provider: AgentProvider
    model: str
    personality_prompt: str
    api_key: Optional[str] = None  # per-agent key from frontend


class SimulationConfig(BaseModel):
    tick_interval_ms: int = 4000
    agents: list[AgentConfig] = []
