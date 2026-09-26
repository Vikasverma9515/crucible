"use client";

import { useEffect, useRef } from "react";
import type { WorldEvent } from "lib/simulation/types";

const SEVERITY_STYLES: Record<WorldEvent["severity"], string> = {
  info: "text-white/50",
  warning: "text-amber-400",
  danger: "text-red-400",
  success: "text-emerald-400",
};

export default function EventLog({ events, tick }: { events: WorldEvent[]; tick: number }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  const recent = [...events].reverse().slice(0, 40);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        <span className="text-xs font-mono text-white/40">TICK {String(tick).padStart(4, "0")}</span>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {recent.map((ev, i) => (
          <div key={i} className={`mb-0.5 leading-relaxed ${SEVERITY_STYLES[ev.severity]}`}>
            <span className="mr-2 text-white/20">[{String(ev.tick).padStart(3, "0")}]</span>
            {ev.message}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
