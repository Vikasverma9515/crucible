import type { Agent, WorldState, AgentDecision, AgentProvider } from "./types";

// Personality archetypes per provider (used when no API key / as fallback)
const DECISION_ARCHETYPES: Record<AgentProvider, () => AgentDecision> = {
  claude: () => {
    const r = Math.random();
    if (r < 0.4)
      return {
        action: "move",
        direction: ["north", "south", "east", "west"][Math.floor(Math.random() * 4)] as AgentDecision["direction"],
        reasoning: "I should explore and seek cooperation opportunities.",
        message: "Looking for allies...",
      };
    if (r < 0.65)
      return {
        action: "gather",
        reasoning: "Building resource reserves to share with others.",
        message: "Gathering supplies.",
      };
    return {
      action: "rest",
      reasoning: "Conserving energy for strategic opportunities.",
      message: "Resting. No need to rush.",
    };
  },
  gpt4: () => {
    const r = Math.random();
    if (r < 0.3)
      return {
        action: "move",
        direction: ["north", "south", "east", "west"][Math.floor(Math.random() * 4)] as AgentDecision["direction"],
        reasoning: "Optimizing territory control. Must expand reach.",
        message: "Expanding territory.",
      };
    if (r < 0.5)
      return {
        action: "gather",
        reasoning: "Resource accumulation is optimal strategy.",
        message: "Maximizing resource intake.",
      };
    if (r < 0.65)
      return {
        action: "attack",
        reasoning: "Eliminating competition is the rational choice.",
        message: "Target acquired.",
      };
    return {
      action: "build",
      reasoning: "Establishing a defensive position.",
      message: "Building camp.",
    };
  },
  gemini: () => {
    const r = Math.random();
    if (r < 0.45)
      return {
        action: "move",
        direction: ["north", "south", "east", "west"][Math.floor(Math.random() * 4)] as AgentDecision["direction"],
        reasoning: "Exploring the environment to gather data.",
        message: "Mapping the area.",
      };
    if (r < 0.7)
      return {
        action: "gather",
        reasoning: "Collecting resources while analyzing terrain patterns.",
        message: "Collecting and analyzing.",
      };
    return {
      action: "rest",
      reasoning: "Processing environmental data.",
      message: "Analyzing surroundings.",
    };
  },
  llama: () => {
    const actions: AgentDecision["action"][] = ["move", "gather", "rest", "attack", "build", "idle"];
    const action = actions[Math.floor(Math.random() * actions.length)];
    return {
      action,
      direction: ["north", "south", "east", "west"][Math.floor(Math.random() * 4)] as AgentDecision["direction"],
      reasoning: "Instinct-driven decision making.",
      message: ["Charging ahead!", "What's over there?", "Taking a different path.", "Let's go!"][
        Math.floor(Math.random() * 4)
      ],
    };
  },
  mistral: () => {
    const r = Math.random();
    if (r < 0.35)
      return {
        action: "gather",
        reasoning: "Efficient resource extraction is the priority.",
        message: "Efficient gathering.",
      };
    if (r < 0.6)
      return {
        action: "move",
        direction: ["north", "south", "east", "west"][Math.floor(Math.random() * 4)] as AgentDecision["direction"],
        reasoning: "Calculated repositioning.",
        message: "Repositioning.",
      };
    return {
      action: "attack",
      reasoning: "Removing a competitor is the most efficient action.",
      message: "Eliminating competition.",
    };
  },
};

function buildPrompt(agent: Agent, state: WorldState): string {
  const tile = state.grid[agent.position.y]?.[agent.position.x];
  const adjacentInfo: string[] = [];
  const dirs = [
    { label: "north", dx: 0, dy: -1 },
    { label: "south", dx: 0, dy: 1 },
    { label: "east", dx: 1, dy: 0 },
    { label: "west", dx: -1, dy: 0 },
  ];
  for (const { label, dx, dy } of dirs) {
    const nx = agent.position.x + dx;
    const ny = agent.position.y + dy;
    const t = state.grid[ny]?.[nx];
    if (t) {
      const res = Object.entries(t.resources)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([k, v]) => `${v} ${k}`)
        .join(", ");
      adjacentInfo.push(`${label}: ${t.terrain}${res ? ` (${res})` : ""}`);
    }
  }

  const nearbyAgents = state.agents
    .filter((a) => a.alive && a.id !== agent.id)
    .filter((a) => Math.abs(a.position.x - agent.position.x) + Math.abs(a.position.y - agent.position.y) <= 5)
    .map((a) => `${a.name} (HP:${a.health}, ${Math.abs(a.position.x - agent.position.x) + Math.abs(a.position.y - agent.position.y)} tiles away)`);

  return `You are ${agent.name}, an AI agent surviving in the Crucible — a harsh world where only the fittest survive.

Personality: ${agent.personalityPrompt}

Your status: Health=${agent.health}/100, Hunger=${agent.hunger}/100 (>80 is dangerous), Carrying: ${JSON.stringify(agent.inventory)}
Current tile: ${tile?.terrain ?? "unknown"}
Adjacent tiles: ${adjacentInfo.join(" | ")}
Nearby agents: ${nearbyAgents.length > 0 ? nearbyAgents.join(", ") : "none visible"}
World tick: ${state.tick} (${state.phase})

Choose ONE action and respond with ONLY valid JSON:
{"action":"move|gather|rest|attack|trade|build","direction":"north|south|east|west","target":"agent_name","message":"short in-character speech","reasoning":"brief internal thought"}

Rules:
- move: step in a direction (skip direction for random)
- gather: collect resources from current tile
- rest: recover 5 HP, reduces hunger by 2
- attack: attack a nearby agent (must name target)
- build: create shelter on current tile (costs 3 wood)
- Hunger increases 8/tick. If hunger>80, lose 5 HP/tick. Gather food or rest to slow hunger.`;
}

export async function getDecision(agent: Agent, state: WorldState): Promise<AgentDecision> {
  const apiKey = process.env[`${agent.provider.toUpperCase()}_API_KEY`];

  if (apiKey && agent.provider === "claude") {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: agent.model,
          max_tokens: 200,
          messages: [{ role: "user", content: buildPrompt(agent, state) }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text ?? "";
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]) as AgentDecision;
      }
    } catch {
      // fall through to archetype
    }
  }

  if (apiKey && agent.provider === "gpt4") {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: agent.model,
          max_tokens: 200,
          messages: [{ role: "user", content: buildPrompt(agent, state) }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content ?? "";
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]) as AgentDecision;
      }
    } catch {
      // fall through
    }
  }

  // Fallback: behavior archetype
  return DECISION_ARCHETYPES[agent.provider]();
}
