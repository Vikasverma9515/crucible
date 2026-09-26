"use client";

import { useState } from "react";
import type { AgentProvider } from "lib/simulation/types";

export interface AgentDraft {
  id: string;
  name: string;
  provider: AgentProvider;
  model: string;
  personalityPrompt: string;
  apiKey: string;
}

const PROVIDER_OPTIONS: {
  value: AgentProvider;
  label: string;
  color: string;
  models: string[];
  keyPlaceholder: string;
  keyPrefix: string;
}[] = [
  {
    value: "claude",
    label: "Claude (Anthropic)",
    color: "#7C3AED",
    models: ["claude-sonnet-4-5", "claude-opus-4-5", "claude-haiku-4-5-20251001"],
    keyPlaceholder: "sk-ant-api03-...",
    keyPrefix: "sk-ant-",
  },
  {
    value: "gpt4",
    label: "GPT-4 (OpenAI)",
    color: "#10B981",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    keyPlaceholder: "sk-proj-...",
    keyPrefix: "sk-",
  },
  {
    value: "gemini",
    label: "Gemini (Google)",
    color: "#3B82F6",
    models: ["gemini-pro", "gemini-1.5-pro", "gemini-1.5-flash"],
    keyPlaceholder: "AIza...",
    keyPrefix: "AIza",
  },
  {
    value: "llama",
    label: "Llama (archetype)",
    color: "#F59E0B",
    models: ["llama-3-70b", "llama-3-8b"],
    keyPlaceholder: "No key needed — uses archetype",
    keyPrefix: "",
  },
  {
    value: "mistral",
    label: "Mistral (archetype)",
    color: "#EF4444",
    models: ["mistral-large", "mistral-medium", "mistral-7b"],
    keyPlaceholder: "No key needed — uses archetype",
    keyPrefix: "",
  },
];

const DEFAULT_PERSONALITIES: Record<AgentProvider, string> = {
  claude: "You value cooperation, ethics, and long-term survival. Prefer diplomacy but will defend yourself.",
  gpt4: "Strategic and competitive. Optimize through resource dominance and tactical aggression.",
  gemini: "Curious and exploratory. Gather information before acting. Methodical.",
  llama: "Unpredictable and instinct-driven. Act on gut feeling. Full send.",
  mistral: "Ruthlessly efficient. Eliminate inefficiencies — including other agents.",
};

function newAgent(i: number): AgentDraft {
  const providers: AgentProvider[] = ["claude", "gpt4", "gemini", "llama", "mistral"];
  const provider = providers[i % providers.length];
  const meta = PROVIDER_OPTIONS.find((p) => p.value === provider)!;
  return {
    id: `draft_${i}_${Date.now()}`,
    name: meta.label.split(" ")[0],
    provider,
    model: meta.models[0],
    personalityPrompt: DEFAULT_PERSONALITIES[provider],
    apiKey: "",
  };
}

export default function AgentBuilder({
  onStart,
}: {
  onStart: (agents: AgentDraft[], tickInterval: number) => void;
}) {
  const [agents, setAgents] = useState<AgentDraft[]>(() =>
    Array.from({ length: 5 }, (_, i) => newAgent(i))
  );
  const [tickInterval, setTickInterval] = useState(4000);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  function update(id: string, patch: Partial<AgentDraft>) {
    setAgents((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const updated = { ...a, ...patch };
        // Auto-update personality when provider changes
        if (patch.provider && patch.provider !== a.provider) {
          updated.personalityPrompt = DEFAULT_PERSONALITIES[patch.provider];
          updated.model = PROVIDER_OPTIONS.find((p) => p.value === patch.provider)!.models[0];
          updated.name = PROVIDER_OPTIONS.find((p) => p.value === patch.provider)!.label.split(" ")[0];
          updated.apiKey = "";
        }
        return updated;
      })
    );
  }

  function addAgent() {
    if (agents.length >= 8) return;
    setAgents((prev) => [...prev, newAgent(prev.length)]);
  }

  function removeAgent(id: string) {
    if (agents.length <= 2) return;
    setAgents((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#080c10] text-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/5 px-8 py-4">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black tracking-tight">⚗️ CRUCIBLE</span>
          <span className="text-xs text-white/30">Configure Agents</span>
        </div>
        <a href="/" className="text-xs text-white/30 transition hover:text-white/60">← home</a>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8">
        <div className="mb-8">
          <h1 className="mb-1 text-2xl font-black">Configure your agents</h1>
          <p className="text-sm text-white/40">
            Add API keys to get real LLM decisions. Without a key, the agent uses a behavioral archetype that still behaves true to its personality.
          </p>
        </div>

        {/* Agent cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent, i) => {
            const provMeta = PROVIDER_OPTIONS.find((p) => p.value === agent.provider)!;
            return (
              <div
                key={agent.id}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                style={{ borderTopColor: provMeta.color, borderTopWidth: 2 }}
              >
                {/* Provider + remove */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/50">AGENT {i + 1}</span>
                  <button
                    onClick={() => removeAgent(agent.id)}
                    disabled={agents.length <= 2}
                    className="text-xs text-white/20 transition hover:text-red-400 disabled:opacity-20"
                  >
                    ✕
                  </button>
                </div>

                {/* Name */}
                <div>
                  <label className="mb-1 block text-xs text-white/40">Name</label>
                  <input
                    value={agent.name}
                    onChange={(e) => update(agent.id, { name: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                  />
                </div>

                {/* Provider */}
                <div>
                  <label className="mb-1 block text-xs text-white/40">Provider</label>
                  <select
                    value={agent.provider}
                    onChange={(e) => update(agent.id, { provider: e.target.value as AgentProvider })}
                    className="w-full rounded-lg border border-white/10 bg-[#0a0e14] px-3 py-2 text-sm text-white focus:outline-none"
                    style={{ color: provMeta.color }}
                  >
                    {PROVIDER_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value} style={{ color: p.color }}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Model */}
                <div>
                  <label className="mb-1 block text-xs text-white/40">Model</label>
                  <select
                    value={agent.model}
                    onChange={(e) => update(agent.id, { model: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-[#0a0e14] px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    {provMeta.models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* API Key */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs text-white/40">API Key</label>
                    {agent.apiKey && (
                      <span className="text-xs text-emerald-400">✓ set</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showKeys[agent.id] ? "text" : "password"}
                      value={agent.apiKey}
                      onChange={(e) => update(agent.id, { apiKey: e.target.value })}
                      placeholder={provMeta.keyPlaceholder}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-8 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                    {agent.apiKey && (
                      <button
                        type="button"
                        onClick={() => setShowKeys((p) => ({ ...p, [agent.id]: !p[agent.id] }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white/30 hover:text-white/60"
                      >
                        {showKeys[agent.id] ? "hide" : "show"}
                      </button>
                    )}
                  </div>
                  {!agent.apiKey && (
                    <p className="mt-1 text-xs text-white/20">
                      No key → uses {agent.provider} archetype
                    </p>
                  )}
                </div>

                {/* Personality */}
                <div>
                  <label className="mb-1 block text-xs text-white/40">Personality</label>
                  <textarea
                    value={agent.personalityPrompt}
                    onChange={(e) => update(agent.id, { personalityPrompt: e.target.value })}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                  />
                </div>
              </div>
            );
          })}

          {/* Add agent */}
          {agents.length < 8 && (
            <button
              onClick={addAgent}
              className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 text-white/30 transition hover:border-white/20 hover:text-white/50"
            >
              <span className="text-2xl">+</span>
              <span className="text-sm">Add agent</span>
            </button>
          )}
        </div>

        {/* Tick speed + Launch */}
        <div className="flex items-end justify-between gap-6 rounded-xl border border-white/5 bg-white/[0.03] p-5">
          <div>
            <label className="mb-1 block text-sm font-semibold text-white/60">Tick Speed</label>
            <div className="flex gap-2">
              {[
                { label: "Slow (6s)", value: 6000 },
                { label: "Normal (4s)", value: 4000 },
                { label: "Fast (2s)", value: 2000 },
                { label: "Turbo (1s)", value: 1000 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTickInterval(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    tickInterval === opt.value
                      ? "bg-violet-700 text-white"
                      : "border border-white/10 text-white/40 hover:text-white/70"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-white/20">
              How often each agent makes a decision
            </p>
          </div>

          <button
            onClick={() => onStart(agents, tickInterval)}
            className="rounded-xl bg-violet-600 px-10 py-3 text-base font-black text-white shadow-xl shadow-violet-900/40 transition hover:bg-violet-500 hover:shadow-violet-700/50"
          >
            Launch Simulation →
          </button>
        </div>
      </div>
    </div>
  );
}
