"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { WorldState } from "lib/simulation/types";
import AgentStats from "components/simulation/AgentStats";
import EventLog from "components/simulation/EventLog";
import Controls from "components/simulation/Controls";
import AgentBuilder, { type AgentDraft } from "components/simulation/AgentBuilder";

const WorldCanvas = dynamic(() => import("components/simulation/WorldCanvas"), { ssr: false });

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const WS_BACKEND = BACKEND.replace(/^http/, "ws");

type Screen = "builder" | "simulation";

export default function SimulationPage() {
  const [screen, setScreen] = useState<Screen>("builder");
  const [state, setState] = useState<WorldState | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Connect to WebSocket once we enter simulation screen
  useEffect(() => {
    if (screen !== "simulation") return;

    function connect() {
      const ws = new WebSocket(`${WS_BACKEND}/ws`);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          setState(snakeToCamel(JSON.parse(e.data)) as WorldState);
        } catch { /* ignore */ }
      };
    }
    connect();
    return () => { wsRef.current?.close(); wsRef.current = null; };
  }, [screen]);

  const handleLaunch = useCallback(async (agents: AgentDraft[], tickIntervalMs: number) => {
    setScreen("simulation");

    // Small delay so WebSocket connection can establish first
    await new Promise((r) => setTimeout(r, 400));

    await fetch(`${BACKEND}/api/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tick_interval_ms: tickIntervalMs,
        agents: agents.map((a) => ({
          name: a.name,
          provider: a.provider,
          model: a.model,
          personality_prompt: a.personalityPrompt,
          api_key: a.apiKey || null,
        })),
      }),
    });
  }, []);

  const handleStop = useCallback(async () => {
    await fetch(`${BACKEND}/api/stop`, { method: "POST" });
  }, []);

  const handleRestart = useCallback(() => {
    handleStop();
    setState(null);
    setScreen("builder");
  }, [handleStop]);

  const handleStart = useCallback(async () => {
    await fetch(`${BACKEND}/api/start`, { method: "POST" });
  }, []);

  if (screen === "builder") {
    return <AgentBuilder onStart={handleLaunch} />;
  }

  return (
    <div className="flex h-screen flex-col bg-[#080c10] text-white">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-white/5 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-black tracking-tight">⚗️ CRUCIBLE</span>
          <span className="rounded border border-white/10 px-2 py-0.5 text-xs text-white/30">
            AI Survival Arena
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className={`h-2 w-2 rounded-full ${connected ? "animate-pulse bg-emerald-400" : "bg-red-500"}`} />
          <span className="text-white/30">{connected ? "connected" : "reconnecting..."}</span>
          {state && (
            <span className="font-mono text-white/20">
              {state.phase === "day" ? "☀️" : "🌙"} tick {state.tick}
            </span>
          )}
        </div>
        <button
          onClick={handleRestart}
          className="text-xs text-white/20 transition hover:text-white/50"
        >
          ← reconfigure
        </button>
      </header>

      {!state ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="text-center">
            <div className="mb-3 text-5xl">⚗️</div>
            <h2 className="text-xl font-bold">Launching simulation...</h2>
            <p className="mt-1 text-sm text-white/40">
              {!connected
                ? "⚠️ Backend not responding — is the Python server running on port 8000?"
                : "Connecting to world..."}
            </p>
          </div>
          {connected && (
            <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-violet-500" />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar — controls */}
          <aside className="w-52 shrink-0 overflow-y-auto border-r border-white/5 bg-white/[0.02] p-3">
            <Controls
              running={state.running}
              onStart={handleStart}
              onStop={handleStop}
              tick={state.tick}
              agents={state.agents}
              backendUrl={BACKEND}
            />
          </aside>

          {/* Main canvas */}
          <main className="flex flex-1 items-start justify-center overflow-auto p-4">
            <WorldCanvas state={state} />
          </main>

          {/* Right panel */}
          <aside className="flex w-64 shrink-0 flex-col border-l border-white/5 bg-white/[0.02]">
            <div className="shrink-0 overflow-y-auto border-b border-white/5 p-3" style={{ maxHeight: "55%" }}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">
                Agents ({state.agents.filter((a) => a.alive).length}/{state.agents.length})
              </p>
              <AgentStats agents={state.agents} />
            </div>
            <div className="flex flex-1 flex-col overflow-hidden p-3">
              <p className="mb-1 shrink-0 text-xs font-semibold uppercase tracking-wider text-white/30">
                Event Feed
              </p>
              <div className="flex-1 overflow-hidden">
                <EventLog events={state.events} tick={state.tick} />
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function snakeToCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
        snakeToCamel(v),
      ])
    );
  }
  return obj;
}
