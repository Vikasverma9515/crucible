"use client";

import type { Agent } from "lib/simulation/types";

function StatBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/10">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function AgentStats({ agents }: { agents: Agent[] }) {
  const sorted = [...agents].sort((a, b) => {
    if (a.alive !== b.alive) return b.alive ? 1 : -1;
    return b.health - a.health;
  });

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((agent) => (
        <div
          key={agent.id}
          className={`rounded-lg border p-3 transition-all duration-300 ${
            agent.alive ? "border-white/10 bg-white/[0.04]" : "border-white/5 bg-white/[0.01] opacity-40"
          }`}
        >
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: agent.alive ? agent.color : "#444" }} />
              <span className="text-sm font-bold text-white">{agent.name}</span>
              {!agent.alive && <span className="text-xs text-red-400">✗ dead</span>}
            </div>
            <div className="flex gap-2.5 text-xs text-white/30">
              <span title="kills">⚔️ {agent.kills}</span>
              <span title="ticks alive">⏱ {agent.ticksAlive ?? agent.ticks_alive ?? 0}</span>
              {(agent.completedTasks ?? agent.completed_tasks ?? 0) > 0 && (
                <span title="completed tasks" className="text-emerald-400">✅ {agent.completedTasks ?? agent.completed_tasks}</span>
              )}
            </div>
          </div>

          {agent.alive && (
            <>
              {/* HP + Hunger bars */}
              <div className="mb-1 flex justify-between text-xs text-white/30">
                <span>HP {agent.health}</span>
                <span className={agent.hunger > 75 ? "text-red-400" : "text-white/30"}>
                  Hunger {agent.hunger}
                </span>
              </div>
              <div className="mb-2 flex flex-col gap-1">
                <StatBar
                  value={agent.health}
                  color={agent.health > 60 ? "#22c55e" : agent.health > 30 ? "#f59e0b" : "#ef4444"}
                />
                <StatBar
                  value={agent.hunger}
                  color={agent.hunger > 75 ? "#ef4444" : agent.hunger > 50 ? "#f97316" : "#f59e0b"}
                />
              </div>

              {/* Inventory */}
              <div className="mb-2 flex flex-wrap gap-1">
                {Object.entries(agent.inventory ?? {})
                  .filter(([, v]) => (v ?? 0) > 0)
                  .map(([k, v]) => (
                    <span key={k} className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-white/40">
                      {k} ×{v}
                    </span>
                  ))}
              </div>

              {/* Active task */}
              {(agent.currentTask ?? agent.current_task) && !(agent.currentTask ?? agent.current_task)?.completed && (
                <div className={`mb-2 rounded border px-2 py-1 text-xs ${
                  (agent.currentTask ?? agent.current_task)?.failed
                    ? "border-red-500/30 bg-red-500/10 text-red-300"
                    : "border-violet-500/30 bg-violet-500/10 text-violet-300"
                }`}>
                  <span className="font-semibold">
                    {(agent.currentTask ?? agent.current_task)?.failed ? "❌ FAILED" : "🎯 TASK"}:{" "}
                  </span>
                  {(agent.currentTask ?? agent.current_task)?.description}
                  {(agent.currentTask ?? agent.current_task)?.tickDeadline ?? (agent.currentTask ?? agent.current_task)?.tick_deadline ? (
                    <span className="ml-1 text-white/30">
                      (deadline: {(agent.currentTask ?? agent.current_task)?.tickDeadline ?? (agent.currentTask ?? agent.current_task)?.tick_deadline})
                    </span>
                  ) : null}
                </div>
              )}

              {/* Last reasoning */}
              {(agent.lastReasoning ?? agent.last_reasoning) && (
                <p className="mb-1 line-clamp-2 text-xs italic text-white/20">
                  &ldquo;{agent.lastReasoning ?? agent.last_reasoning}&rdquo;
                </p>
              )}

              {/* Last message */}
              {(agent.lastMessage ?? agent.last_message) && agent.messageAge < 5 && (
                <p className="truncate text-xs text-white/30">
                  💬 {agent.lastMessage ?? agent.last_message}
                </p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
