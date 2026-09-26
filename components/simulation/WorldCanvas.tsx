"use client";

import { useEffect, useRef } from "react";
import type { WorldState, TerrainType } from "lib/simulation/types";

const TILE = 28;

const TERRAIN_COLORS: Record<TerrainType, string> = {
  grass: "#2d4a1e",
  forest: "#1a3d10",
  water: "#0d2d4a",
  mountain: "#3d3530",
  plains: "#4a3d1a",
  desert: "#4a3820",
};

const TERRAIN_BORDER: Record<TerrainType, string> = {
  grass: "#3a5a28",
  forest: "#243d15",
  water: "#1a4060",
  mountain: "#4a3d38",
  plains: "#5a4d28",
  desert: "#5a4830",
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function WorldCanvas({ state }: { state: WorldState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const renderStateRef = useRef(state);

  useEffect(() => {
    renderStateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let t = 0;
    function render() {
      t += 0.02;
      const s = renderStateRef.current;
      const W = s.width * TILE;
      const H = s.height * TILE;

      canvas!.width = W;
      canvas!.height = H;

      // Draw terrain
      for (let y = 0; y < s.height; y++) {
        for (let x = 0; x < s.width; x++) {
          const tile = s.grid[y]?.[x];
          if (!tile) continue;

          ctx.fillStyle = TERRAIN_COLORS[tile.terrain];
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);

          ctx.strokeStyle = TERRAIN_BORDER[tile.terrain];
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);

          // Resource dots
          if (tile.terrain === "forest") {
            ctx.fillStyle = "#4ade80";
            ctx.fillRect(x * TILE + 4, y * TILE + 4, 4, 4);
          }
          if (tile.terrain === "plains" && (tile.resources.gold ?? 0) > 0) {
            ctx.fillStyle = "#fbbf24";
            ctx.fillRect(x * TILE + 4, y * TILE + 4, 4, 4);
          }
          if (tile.terrain === "mountain" && (tile.resources.stone ?? 0) > 0) {
            ctx.fillStyle = "#9ca3af";
            ctx.fillRect(x * TILE + 4, y * TILE + 4, 4, 4);
          }

          // Structure indicator
          if (tile.structure === "shelter") {
            ctx.fillStyle = "#f59e0b44";
            ctx.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
            ctx.fillStyle = "#f59e0b";
            ctx.font = `${TILE - 8}px sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText("🏕", x * TILE + TILE / 2, y * TILE + TILE - 4);
          }
        }
      }

      // Night overlay
      if (s.phase === "night") {
        ctx.fillStyle = "rgba(0,0,30,0.35)";
        ctx.fillRect(0, 0, W, H);
      }

      // Draw agents
      const R = 11;
      for (const agent of s.agents) {
        if (!agent.alive) continue;
        const cx = agent.position.x * TILE + TILE / 2;
        const cy = agent.position.y * TILE + TILE / 2;

        // Pulse ring (animates)
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + s.agents.indexOf(agent));
        ctx.beginPath();
        ctx.arc(cx, cy, R + 4 + pulse * 3, 0, Math.PI * 2);
        ctx.strokeStyle = agent.color + "44";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Agent circle
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = agent.color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff33";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Agent initial
        ctx.fillStyle = "#fff";
        ctx.font = `bold 9px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(agent.name[0], cx, cy);

        // Health bar (above agent)
        const barW = TILE - 4;
        const barX = agent.position.x * TILE + 2;
        const barY = agent.position.y * TILE - 6;
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(barX, barY, barW, 4);
        const hpColor = agent.health > 60 ? "#22c55e" : agent.health > 30 ? "#f59e0b" : "#ef4444";
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, (barW * agent.health) / 100, 4);

        // Hunger bar (below health bar)
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(barX, barY + 5, barW, 3);
        const hungerColor = agent.hunger > 75 ? "#ef4444" : "#f97316";
        ctx.fillStyle = hungerColor;
        ctx.fillRect(barX, barY + 5, (barW * agent.hunger) / 100, 3);

        // Speech bubble
        if (agent.lastMessage && agent.messageAge < 4) {
          const opacity = lerp(1, 0, agent.messageAge / 4);
          const msg = agent.lastMessage.length > 22 ? agent.lastMessage.slice(0, 22) + "…" : agent.lastMessage;
          const textW = Math.min(msg.length * 6.5, 160);
          const bx = cx - textW / 2;
          const by = cy - R - 28;

          ctx.fillStyle = `rgba(15,15,25,${opacity * 0.9})`;
          ctx.beginPath();
          ctx.roundRect(bx - 6, by - 14, textW + 12, 18, 4);
          ctx.fill();

          ctx.strokeStyle = `${agent.color}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`;
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = `rgba(255,255,255,${opacity})`;
          ctx.font = "9px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(msg, cx, by - 5);
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    }

    render();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg border border-white/10 shadow-2xl"
      style={{ imageRendering: "pixelated", maxWidth: "100%", height: "auto" }}
    />
  );
}
