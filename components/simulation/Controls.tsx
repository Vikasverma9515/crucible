"use client";

import { useState } from "react";
import type { Agent } from "lib/simulation/types";

const QUICK_EVENTS = [
  { label: "☄️ Meteor Strike", msg: "A meteor obliterates the center of the map!" },
  { label: "🌿 Food Surge", msg: "Lush rain floods the forest with food." },
  { label: "☠️ Plague", msg: "A deadly plague sweeps the land." },
  { label: "🌙 Eternal Night", msg: "An unnatural darkness falls. Night forever." },
  { label: "🔥 Wildfire", msg: "Fire sweeps the forest. All food is burning." },
  { label: "🏆 Golden Age", msg: "A golden age! All agents heal 20 HP." },
];

const PRESET_TASKS = [
  {
    label: "🏕 Build shelter",
    description: "Build a shelter",
    prompt: "Your ONLY goal is to build a shelter. You need 3 wood. Go find wood in forests, then use 'build' action.",
    deadline: 40,
  },
  {
    label: "🥊 Eliminate one",
    description: "Eliminate another agent",
    prompt: "Your goal is to hunt down and eliminate any other agent. Find them, get close (within 2 tiles), and attack.",
    deadline: 50,
  },
  {
    label: "💰 Collect 5 gold",
    description: "Collect 5 gold",
    prompt: "Find plains tiles (tan color) and gather gold until you have 5. This is your ONLY priority.",
    deadline: 40,
  },
  {
    label: "🍎 Collect 10 food",
    description: "Collect 10 food",
    prompt: "Find forest tiles and gather food until you have 10 in your inventory. Your survival depends on this.",
    deadline: 30,
  },
  {
    label: "⏱ Survive 30 ticks",
    description: "Survive 30 ticks",
    prompt: "Stay alive for 30 more ticks. Manage hunger carefully, avoid combat, gather food, and rest when needed.",
    deadline: null,
  },
  {
    label: "🤝 Form alliance",
    description: "Trade with another agent",
    prompt: "Find another agent within 2 tiles and trade food with them. Diplomacy is your strategy.",
    deadline: 25,
  },
];

export default function Controls({
  running,
  onStart,
  onStop,
  tick,
  agents,
  backendUrl,
}: {
  running: boolean;
  onStart: () => void;
  onStop: () => void;
  tick: number;
  agents?: Agent[];
  backendUrl: string;
}) {
  const [busy, setBusy] = useState(false);
  const [customEvent, setCustomEvent] = useState("");
  const [customTask, setCustomTask] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [taskDeadline, setTaskDeadline] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"events" | "tasks" | "scenario">("events");

  async function post(path: string, body: unknown) {
    setBusy(true);
    try {
      await fetch(`${backendUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } finally {
      setBusy(false);
    }
  }

  async function assignTask(description: string, prompt: string, deadline: number | null) {
    await post("/api/task", {
      agent_id: selectedAgent === "all" ? null : selectedAgent,
      description,
      prompt_injection: prompt,
      tick_deadline: deadline ? tick + deadline : null,
    });
  }

  async function launchScenario(scenario: string) {
    await fetch(`${backendUrl}/api/stop`, { method: "POST" });
    await new Promise((r) => setTimeout(r, 300));
    await post("/api/start", { scenario, tick_interval_ms: 4000 });
  }

  const aliveAgents = agents?.filter((a) => a.alive) ?? [];

  return (
    <div className="flex flex-col gap-3 text-xs">
      {/* Start/Stop */}
      <div className="flex gap-1.5">
        <button
          onClick={onStart}
          disabled={running || busy}
          className="flex-1 rounded-lg bg-emerald-700 py-2 font-bold text-white transition hover:bg-emerald-600 disabled:opacity-40"
        >
          ▶ Start
        </button>
        <button
          onClick={onStop}
          disabled={!running || busy}
          className="flex-1 rounded-lg bg-red-800 py-2 font-bold text-white transition hover:bg-red-700 disabled:opacity-40"
        >
          ■ Stop
        </button>
      </div>

      {/* Status */}
      <div className="rounded-lg border border-white/5 bg-white/3 p-2.5">
        <div className="flex justify-between text-white/40">
          <span>Status</span>
          <span className={running ? "text-emerald-400" : "text-red-400"}>
            {running ? "● LIVE" : "● STOPPED"}
          </span>
        </div>
        <div className="flex justify-between text-white/40">
          <span>Tick</span>
          <span className="font-mono">{tick}</span>
        </div>
        <div className="flex justify-between text-white/40">
          <span>Alive</span>
          <span>{aliveAgents.length}/{agents?.length ?? 0}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 rounded-lg border border-white/10 bg-white/3 p-0.5">
        {(["events", "tasks", "scenario"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 rounded py-1 font-semibold capitalize transition ${
              activeTab === t ? "bg-violet-700 text-white" : "text-white/30 hover:text-white/50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Events tab */}
      {activeTab === "events" && (
        <div className="flex flex-col gap-1.5">
          {QUICK_EVENTS.map((ev) => (
            <button
              key={ev.label}
              onClick={() => post("/api/inject", { message: ev.msg })}
              disabled={!running || busy}
              className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-left text-amber-300 transition hover:bg-amber-500/15 disabled:opacity-30"
            >
              {ev.label}
            </button>
          ))}
          <div className="mt-1 flex gap-1.5">
            <input
              value={customEvent}
              onChange={(e) => setCustomEvent(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && customEvent.trim() && post("/api/inject", { message: customEvent }).then(() => setCustomEvent(""))}
              placeholder="Custom world event..."
              className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1.5 text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
            <button
              onClick={() => { post("/api/inject", { message: customEvent }); setCustomEvent(""); }}
              disabled={!running || !customEvent.trim()}
              className="rounded bg-amber-600/30 px-2 text-amber-300 hover:bg-amber-600/50 disabled:opacity-30"
            >
              ↵
            </button>
          </div>
        </div>
      )}

      {/* Tasks tab — Boss Mode */}
      {activeTab === "tasks" && (
        <div className="flex flex-col gap-2">
          <div>
            <p className="mb-1 text-white/30">Assign to:</p>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full rounded border border-white/10 bg-[#0a0e14] px-2 py-1.5 text-white focus:outline-none"
            >
              <option value="all">All agents</option>
              {aliveAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-white/30">Quick tasks:</p>
            {PRESET_TASKS.map((t) => (
              <button
                key={t.label}
                onClick={() => assignTask(t.description, t.prompt, t.deadline)}
                disabled={!running || busy}
                className="rounded border border-violet-500/20 bg-violet-500/5 px-2 py-1.5 text-left text-violet-300 transition hover:bg-violet-500/15 disabled:opacity-30"
              >
                {t.label}
                {t.deadline && <span className="ml-1 text-white/20">({t.deadline}t)</span>}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-white/30">Custom task:</p>
            <textarea
              value={customTask}
              onChange={(e) => setCustomTask(e.target.value)}
              placeholder="Describe a custom challenge..."
              rows={2}
              className="w-full resize-none rounded border border-white/10 bg-white/5 px-2 py-1.5 text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
            <div className="flex gap-1.5">
              <input
                value={taskDeadline}
                onChange={(e) => setTaskDeadline(e.target.value)}
                placeholder="Deadline ticks"
                type="number"
                className="w-20 rounded border border-white/10 bg-white/5 px-2 py-1 text-white placeholder-white/20 focus:outline-none"
              />
              <button
                onClick={() => assignTask(customTask, customTask, taskDeadline ? parseInt(taskDeadline) : null)}
                disabled={!running || !customTask.trim()}
                className="flex-1 rounded bg-violet-700 py-1 font-bold text-white transition hover:bg-violet-600 disabled:opacity-30"
              >
                Assign
              </button>
            </div>
          </div>

          <button
            onClick={() => post("/api/task/clear", {})}
            disabled={!running}
            className="rounded border border-white/10 py-1 text-white/30 transition hover:text-white/50 disabled:opacity-30"
          >
            Clear all tasks
          </button>
        </div>
      )}

      {/* Scenario tab */}
      {activeTab === "scenario" && (
        <div className="flex flex-col gap-1.5">
          <p className="text-white/30">Launch a preset scenario:</p>
          {[
            { id: "last_stand", label: "💀 Last Stand", desc: "30 HP, 70 hunger. One survives." },
            { id: "resource_war", label: "💰 Resource War", desc: "Collect 10 gold to win." },
            { id: "plague", label: "☠️ Plague Start", desc: "Everyone starts at 20 HP." },
            { id: "speedrun", label: "⚡ Speedrun", desc: "First shelter + 5 gold wins." },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => launchScenario(s.id)}
              disabled={busy}
              className="flex flex-col rounded border border-rose-500/20 bg-rose-500/5 px-2 py-2 text-left transition hover:bg-rose-500/15 disabled:opacity-30"
            >
              <span className="font-bold text-rose-300">{s.label}</span>
              <span className="text-white/30">{s.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
