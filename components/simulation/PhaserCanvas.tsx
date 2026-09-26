"use client";

import { useEffect, useRef } from "react";
import type { WorldState, Agent, TerrainType } from "lib/simulation/types";

const TILE = 44;
const WORLD_W = 28;
const WORLD_H = 20;

// Provider hex colors
const HEX_COLORS: Record<string, number> = {
  "#7C3AED": 0x7c3aed,
  "#10B981": 0x10b981,
  "#3B82F6": 0x3b82f6,
  "#F59E0B": 0xf59e0b,
  "#EF4444": 0xef4444,
};
function toHex(cssColor: string): number {
  return HEX_COLORS[cssColor] ?? parseInt(cssColor.replace("#", ""), 16);
}

// Seeded RNG for deterministic tile decoration
function seeded(x: number, y: number) {
  let s = (x * 374761393 + y * 668265263) | 0;
  s ^= s >>> 13;
  s = Math.imul(s, 1540483477);
  s ^= s >>> 15;
  return ((s >>> 0) / 0xffffffff);
}

export default function PhaserCanvas({ state }: { state: WorldState | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<unknown>(null);
  const stateRef = useRef<WorldState | null>(null);
  const lastTickRef = useRef(-1);

  // Keep stateRef current
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Mount Phaser once
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    let destroyed = false;

    import("phaser").then((mod) => {
      if (destroyed || !containerRef.current) return;
      const Phaser = mod.default;

      // ─── WorldScene ──────────────────────────────────────────────────────────
      class WorldScene extends Phaser.Scene {
        private terrainGfx!: InstanceType<typeof Phaser.GameObjects.Graphics>;
        private terrainDrawn = false;
        private agents = new Map<string, {
          container: InstanceType<typeof Phaser.GameObjects.Container>;
          body: InstanceType<typeof Phaser.GameObjects.Graphics>;
          nameTag: InstanceType<typeof Phaser.GameObjects.Text>;
          hpBar: InstanceType<typeof Phaser.GameObjects.Graphics>;
          taskRing: InstanceType<typeof Phaser.GameObjects.Graphics>;
          prevX: number; prevY: number;
        }>();
        private dayOverlay!: InstanceType<typeof Phaser.GameObjects.Graphics>;
        private particleGfx!: InstanceType<typeof Phaser.GameObjects.Graphics>;
        private particles: Array<{
          x: number; y: number; vx: number; vy: number;
          r: number; color: number; alpha: number; life: number; maxLife: number;
        }> = [];
        private waterTime = 0;
        private waterOverlays: Array<{ gfx: InstanceType<typeof Phaser.GameObjects.Graphics>; baseX: number; baseY: number }> = [];
        private phase: "day" | "night" = "day";

        constructor() {
          super({ key: "WorldScene" });
        }

        create() {
          const W = WORLD_W * TILE;
          const H = WORLD_H * TILE;

          this.cameras.main.setBounds(0, 0, W, H);
          this.cameras.main.setBackgroundColor("#040810");

          // Terrain layer (drawn once)
          this.terrainGfx = this.add.graphics();
          this.terrainGfx.setDepth(0);

          // Day/night overlay
          this.dayOverlay = this.add.graphics();
          this.dayOverlay.setDepth(80);

          // Particle layer
          this.particleGfx = this.add.graphics();
          this.particleGfx.setDepth(60);

          // Camera drag
          this.input.on("pointermove", (p: { isDown: boolean; x: number; y: number; prevPosition: { x: number; y: number } }) => {
            if (!p.isDown) return;
            const cam = this.cameras.main;
            cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
            cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
          });
          // Wheel zoom
          this.input.on("wheel", (_p: unknown, _go: unknown, _dx: number, dy: number) => {
            const cam = this.cameras.main;
            cam.zoom = Math.max(0.4, Math.min(2.5, cam.zoom - dy * 0.001));
          });

          // Start with world centered, fitting the view
          this.fitCamera();
        }

        private fitCamera() {
          const W = WORLD_W * TILE;
          const H = WORLD_H * TILE;
          const scaleX = (this.scale.width - 20) / W;
          const scaleY = (this.scale.height - 20) / H;
          this.cameras.main.zoom = Math.min(scaleX, scaleY, 1);
          this.cameras.main.centerOn(W / 2, H / 2);
        }

        update(time: number, delta: number) {
          this.waterTime += delta * 0.001;

          // Pull latest state from React ref
          const st = stateRef.current;
          if (st && st.tick !== lastTickRef.current) {
            lastTickRef.current = st.tick;
            if (!this.terrainDrawn) {
              this.drawTerrain(st.grid as Array<Array<{ terrain: TerrainType; resources: Record<string, number> }>>);
              this.terrainDrawn = true;
            }
            this.phase = st.phase as "day" | "night";
            this.syncAgents(st.agents as Agent[]);
            this.checkEvents(st.events ?? []);
          }

          // Animate water tiles
          this.animateWater();

          // Update particles
          this.updateParticles(delta * 0.001);

          // Day/night overlay
          this.updateDayNight();
        }

        // ── Terrain ────────────────────────────────────────────────────────────
        private drawTerrain(grid: Array<Array<{ terrain: TerrainType; resources: Record<string, number> }>>) {
          const g = this.terrainGfx;
          g.clear();

          for (let y = 0; y < WORLD_H; y++) {
            for (let x = 0; x < WORLD_W; x++) {
              const tile = grid[y]?.[x];
              if (!tile) continue;
              this.drawTile(g, tile.terrain, x, y);
            }
          }
        }

        private drawTile(g: InstanceType<typeof Phaser.GameObjects.Graphics>, terrain: TerrainType, tx: number, ty: number) {
          const px = tx * TILE;
          const py = ty * TILE;
          const rng = seeded(tx, ty);
          const rng2 = seeded(tx + 100, ty + 100);

          switch (terrain) {
            case "grass": {
              // Base
              g.fillStyle(0x1a3d0f);
              g.fillRect(px, py, TILE, TILE);
              // Lighter patches
              if (rng > 0.4) {
                g.fillStyle(0x22521a, 0.6);
                g.fillRect(px + 4 + rng * 10 | 0, py + 4 + rng2 * 10 | 0, 18, 14);
              }
              // Tiny flower/grass dots
              for (let i = 0; i < 4; i++) {
                const dx = seeded(tx * 7 + i, ty) * (TILE - 4) | 0;
                const dy = seeded(tx, ty * 7 + i) * (TILE - 4) | 0;
                const flowerColor = i === 0 ? 0xfef08a : i === 1 ? 0xf0fdf4 : 0x4ade80;
                g.fillStyle(flowerColor, 0.5);
                g.fillRect(px + dx, py + dy, 2, 2);
              }
              // Grid border (subtle)
              g.lineStyle(0.5, 0x0d2208, 0.4);
              g.strokeRect(px, py, TILE, TILE);
              break;
            }
            case "forest": {
              g.fillStyle(0x0a1f05);
              g.fillRect(px, py, TILE, TILE);
              // Trees (circles)
              const treeCount = 1 + (rng > 0.5 ? 1 : 0);
              for (let i = 0; i < treeCount; i++) {
                const cx = px + 8 + seeded(tx + i * 13, ty) * (TILE - 16) | 0;
                const cy = py + 8 + seeded(tx, ty + i * 13) * (TILE - 16) | 0;
                // Trunk
                g.fillStyle(0x4a2f12);
                g.fillRect(cx - 2, cy + 8, 4, 8);
                // Canopy shadow
                g.fillStyle(0x071a04, 0.8);
                g.fillCircle(cx + 2, cy + 2, 11);
                // Canopy
                g.fillStyle(0x0f3008);
                g.fillCircle(cx, cy, 11);
                // Highlight
                g.fillStyle(0x1a4a0e, 0.7);
                g.fillCircle(cx - 3, cy - 3, 6);
              }
              g.lineStyle(0.5, 0x061404, 0.3);
              g.strokeRect(px, py, TILE, TILE);
              break;
            }
            case "water": {
              g.fillStyle(0x071428);
              g.fillRect(px, py, TILE, TILE);
              // Deep water center
              g.fillStyle(0x0a1f3d, 0.8);
              g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
              // Static wave lines (animated version is in animateWater)
              g.lineStyle(1, 0x1a4a7a, 0.4);
              for (let i = 0; i < 3; i++) {
                const wy = py + 6 + i * 12 + rng * 4 | 0;
                g.beginPath();
                g.moveTo(px + 2, wy);
                g.lineTo(px + TILE - 2, wy);
                g.strokePath();
              }
              // Register water tile for animation
              if (this.waterOverlays.length < 80) { // limit for perf
                const wg = this.add.graphics();
                wg.setDepth(2);
                this.waterOverlays.push({ gfx: wg, baseX: px, baseY: py });
              }
              break;
            }
            case "mountain": {
              // Rock base
              g.fillStyle(0x1e1a14);
              g.fillRect(px, py, TILE, TILE);
              // Rock face
              g.fillStyle(0x2d2820);
              g.fillTriangle(
                px + TILE / 2, py + 3,
                px + 3, py + TILE - 4,
                px + TILE - 3, py + TILE - 4
              );
              // Snow cap
              g.fillStyle(0xe8e8f0, 0.9);
              g.fillTriangle(
                px + TILE / 2, py + 3,
                px + TILE / 2 - 8, py + 14,
                px + TILE / 2 + 8, py + 14
              );
              // Rock shading
              g.fillStyle(0x1a1510, 0.5);
              g.fillTriangle(
                px + TILE / 2, py + 3,
                px + TILE / 2, py + TILE - 4,
                px + TILE - 3, py + TILE - 4
              );
              g.lineStyle(0.5, 0x0e0c09, 0.4);
              g.strokeRect(px, py, TILE, TILE);
              break;
            }
            case "plains": {
              g.fillStyle(0x2a2a08);
              g.fillRect(px, py, TILE, TILE);
              // Horizontal texture lines
              for (let i = 0; i < 5; i++) {
                const ly = py + 4 + i * 8;
                g.lineStyle(1, 0x3a3a10, 0.35);
                g.beginPath();
                g.moveTo(px, ly);
                g.lineTo(px + TILE, ly);
                g.strokePath();
              }
              // Sparse dots
              if (rng > 0.6) {
                g.fillStyle(0x4a4a14, 0.5);
                g.fillCircle(px + (rng2 * 30 + 6 | 0), py + (rng * 30 + 6 | 0), 3);
              }
              g.lineStyle(0.5, 0x1c1c05, 0.3);
              g.strokeRect(px, py, TILE, TILE);
              break;
            }
            case "desert": {
              g.fillStyle(0x3a2a0c);
              g.fillRect(px, py, TILE, TILE);
              // Sand texture gradient (lighter center)
              g.fillStyle(0x4a3610, 0.6);
              g.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
              // Crack pattern
              if (rng > 0.3) {
                g.lineStyle(1, 0x2a1e08, 0.5);
                const cx = px + TILE / 2 + (rng2 * 8 - 4 | 0);
                const cy = py + TILE / 2 + (rng * 8 - 4 | 0);
                g.beginPath();
                g.moveTo(cx, cy);
                g.lineTo(cx + (rng * 14 - 7 | 0), cy - 10);
                g.moveTo(cx, cy);
                g.lineTo(cx - 8, cy + (rng2 * 12 | 0));
                g.strokePath();
              }
              // Small pebble dots
              if (rng > 0.6) {
                g.fillStyle(0x5a4218, 0.7);
                g.fillCircle(px + (rng2 * 28 + 6 | 0), py + (rng * 28 + 6 | 0), 2);
              }
              g.lineStyle(0.5, 0x251a07, 0.3);
              g.strokeRect(px, py, TILE, TILE);
              break;
            }
          }
        }

        // ── Animated water ──────────────────────────────────────────────────────
        private animateWater() {
          for (let i = 0; i < this.waterOverlays.length; i++) {
            const item = this.waterOverlays[i];
            if (!item) continue;
            const { gfx, baseX, baseY } = item;
            gfx.clear();
            const offset = Math.sin(this.waterTime * 1.8 + i * 0.7) * 2;
            for (let wi = 0; wi < 3; wi++) {
              const y = baseY + 6 + wi * 12 + offset;
              gfx.lineStyle(1, 0x2a6fa8, 0.35 + Math.sin(this.waterTime + wi) * 0.1);
              gfx.beginPath();
              gfx.moveTo(baseX + 3, y);
              gfx.lineTo(baseX + TILE - 3, y);
              gfx.strokePath();
            }
            // Shimmer
            const shimmerAlpha = 0.1 + Math.sin(this.waterTime * 2.5 + i * 1.3) * 0.08;
            gfx.fillStyle(0x3a8fd4, shimmerAlpha);
            gfx.fillRect(baseX + 2, baseY + 2, TILE - 4, TILE - 4);
          }
        }

        // ── Agents ─────────────────────────────────────────────────────────────
        private syncAgents(agents: Agent[]) {
          const activeIds = new Set(agents.map((a) => a.id));

          // Remove gone agents
          for (const [id, ag] of this.agents) {
            if (!activeIds.has(id)) {
              ag.container.destroy(true);
              this.agents.delete(id);
            }
          }

          for (const agent of agents) {
            const tx = agent.position.x * TILE + TILE / 2;
            const ty = agent.position.y * TILE + TILE / 2;

            if (!this.agents.has(agent.id)) {
              this.createAgent(agent, tx, ty);
            } else {
              this.updateAgent(agent, tx, ty);
            }
          }
        }

        private createAgent(agent: Agent, tx: number, ty: number) {
          const container = this.add.container(tx, ty);
          container.setDepth(50);

          const body = this.add.graphics();
          const hpBar = this.add.graphics();
          hpBar.setY(-26);
          const taskRing = this.add.graphics();
          taskRing.setDepth(52);

          const nameTag = this.add.text(0, -36, agent.name, {
            fontSize: "8px",
            color: "#e2e8f0",
            backgroundColor: "#00000088",
            padding: { x: 3, y: 1 },
            fontFamily: "monospace",
          });
          nameTag.setOrigin(0.5, 1);

          container.add([body, hpBar, nameTag, taskRing]);

          this.renderAgentBody(body, agent);
          this.renderHpBar(hpBar, agent);

          this.agents.set(agent.id, {
            container, body, nameTag, hpBar, taskRing,
            prevX: tx, prevY: ty,
          });
        }

        private updateAgent(agent: Agent, tx: number, ty: number) {
          const ag = this.agents.get(agent.id)!;

          // Move with tween if position changed
          if (ag.prevX !== tx || ag.prevY !== ty) {
            // Spawn movement dust
            const mx = (ag.prevX + tx) / 2;
            const my = (ag.prevY + ty) / 2;
            this.spawnParticles(mx, my, 0xc4a882, 4, 25, 0.5);

            this.tweens.add({
              targets: ag.container,
              x: tx,
              y: ty,
              duration: 400,
              ease: "Sine.easeInOut",
            });
            ag.prevX = tx;
            ag.prevY = ty;
          }

          ag.body.clear();
          this.renderAgentBody(ag.body, agent);

          ag.hpBar.clear();
          this.renderHpBar(ag.hpBar, agent);

          // Task ring
          ag.taskRing.clear();
          const hasTask = agent.currentTask ?? agent.current_task;
          if (hasTask && agent.alive) {
            const pulse = 0.4 + 0.3 * Math.sin(this.waterTime * 4);
            ag.taskRing.lineStyle(3, 0x7c3aed, pulse);
            ag.taskRing.strokeCircle(0, 0, 22);
          }

          // Name alpha on death
          ag.nameTag.setAlpha(agent.alive ? 1 : 0.35);
        }

        private renderAgentBody(g: InstanceType<typeof Phaser.GameObjects.Graphics>, agent: Agent) {
          const color = toHex(agent.color);

          if (!agent.alive) {
            // Dead: ghosted with X
            g.fillStyle(0x444444, 0.7);
            g.fillCircle(0, 0, 15);
            g.lineStyle(2, 0x888888, 0.5);
            g.strokeCircle(0, 0, 15);
            g.lineStyle(2.5, 0xff4444, 0.7);
            g.beginPath();
            g.moveTo(-6, -6); g.lineTo(6, 6);
            g.moveTo(6, -6); g.lineTo(-6, 6);
            g.strokePath();
            return;
          }

          // Outer glow halo
          g.fillStyle(color, 0.15);
          g.fillCircle(0, 0, 21);

          // Drop shadow
          g.fillStyle(0x000000, 0.35);
          g.fillEllipse(2, 18, 28, 8);

          // Main body
          g.fillStyle(color, 1);
          g.fillCircle(0, 0, 15);

          // Specular highlight
          g.fillStyle(0xffffff, 0.2);
          g.fillCircle(-4, -5, 8);

          // Eyes (white sclera)
          g.fillStyle(0xffffff, 1);
          g.fillCircle(-5, -2, 3.5);
          g.fillCircle(5, -2, 3.5);

          // Pupils
          const t = this.waterTime;
          const blink = Math.sin(t * 1.7 + parseInt(agent.id, 16) * 0.3);
          const pupilSize = blink > 0.9 ? 0.5 : 1.8;
          g.fillStyle(0x000000, 1);
          g.fillCircle(-5, -2, pupilSize);
          g.fillCircle(5, -2, pupilSize);
        }

        private renderHpBar(g: InstanceType<typeof Phaser.GameObjects.Graphics>, agent: Agent) {
          if (!agent.alive) return;
          const w = 32;
          const h = 3;

          // HP
          g.fillStyle(0x111111, 0.8);
          g.fillRect(-w / 2, 0, w, h);
          const hp = Math.max(0, Math.min(1, agent.health / 100));
          const hpCol = hp > 0.5 ? 0x22c55e : hp > 0.25 ? 0xf59e0b : 0xef4444;
          g.fillStyle(hpCol, 1);
          g.fillRect(-w / 2, 0, w * hp, h);

          // Hunger (orange strip below)
          g.fillStyle(0x111111, 0.8);
          g.fillRect(-w / 2, h + 2, w, h - 1);
          const hunger = Math.max(0, Math.min(1, agent.hunger / 100));
          g.fillStyle(0xf97316, 0.85);
          g.fillRect(-w / 2, h + 2, w * hunger, h - 1);
        }

        // ── Particles ───────────────────────────────────────────────────────────
        private spawnParticles(x: number, y: number, color: number, count: number, speed: number, life: number) {
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const s = speed * (0.5 + Math.random() * 0.5);
            this.particles.push({
              x, y,
              vx: Math.cos(angle) * s,
              vy: Math.sin(angle) * s,
              r: 1.5 + Math.random() * 2,
              color, alpha: 1,
              life, maxLife: life,
            });
          }
        }

        private updateParticles(dt: number) {
          this.particleGfx.clear();
          for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            if (!p) continue;
            p.life -= dt;
            if (p.life <= 0) { this.particles.splice(i, 1); continue; }
            p.x += p.vx * dt * 60;
            p.y += p.vy * dt * 60;
            p.vy += 0.5 * dt * 60;
            p.vx *= 0.94;
            const a = p.life / p.maxLife;
            this.particleGfx.fillStyle(p.color, a);
            this.particleGfx.fillCircle(p.x, p.y, p.r * a);
          }
        }

        // ── Events ──────────────────────────────────────────────────────────────
        private lastEventCount = 0;
        private checkEvents(events: Array<{ type: string; agentId?: string; message: string }>) {
          const newEvents = events.slice(this.lastEventCount);
          this.lastEventCount = events.length;

          for (const ev of newEvents) {
            const ag = ev.agentId ? this.agents.get(ev.agentId) : null;
            const x = ag?.container.x ?? WORLD_W * TILE / 2;
            const y = ag?.container.y ?? WORLD_H * TILE / 2;

            if (ev.type === "death") {
              this.spawnParticles(x, y, 0xef4444, 12, 50, 0.8);
              this.cameras.main.shake(200, 0.003);
            } else if (ev.type === "kill") {
              this.spawnParticles(x, y, 0xff6644, 8, 40, 0.5);
            } else if (ev.type === "world") {
              if (ev.message.toLowerCase().includes("meteor") || ev.message.toLowerCase().includes("storm")) {
                this.spawnParticles(
                  Math.random() * WORLD_W * TILE,
                  Math.random() * WORLD_H * TILE,
                  0xff8800, 20, 80, 1.2
                );
                this.cameras.main.shake(400, 0.006);
              }
            } else if (ev.type === "action" && ev.message.toLowerCase().includes("gather")) {
              this.spawnParticles(x, y, 0xfbbf24, 5, 30, 0.6);
            } else if (ev.type === "trade") {
              this.spawnParticles(x, y, 0x38bdf8, 6, 25, 0.5);
            }
          }
        }

        // ── Day / Night ─────────────────────────────────────────────────────────
        private updateDayNight() {
          const W = WORLD_W * TILE;
          const H = WORLD_H * TILE;
          this.dayOverlay.clear();
          if (this.phase === "night") {
            this.dayOverlay.fillStyle(0x050d1a, 0.45);
            this.dayOverlay.fillRect(0, 0, W, H);
            // Moon glow top-right
            this.dayOverlay.fillStyle(0x4466aa, 0.06);
            this.dayOverlay.fillCircle(W - 60, 60, 140);
          } else {
            // Day: subtle warm top gradient
            this.dayOverlay.fillStyle(0xfff7e0, 0.04);
            this.dayOverlay.fillRect(0, 0, W, H / 3);
          }
        }
      }

      // ── Boot / create game ────────────────────────────────────────────────────
      class BootScene extends Phaser.Scene {
        constructor() { super({ key: "Boot" }); }
        create() {
          // Show "waiting for simulation" text
          const W = WORLD_W * TILE;
          const H = WORLD_H * TILE;
          const txt = this.add.text(W / 2, H / 2, "⚗  Waiting for simulation data…", {
            fontSize: "18px",
            color: "#4c3d80",
            fontFamily: "monospace",
          });
          txt.setOrigin(0.5);
          // Start world scene
          this.scene.start("WorldScene");
        }
      }

      const W = WORLD_W * TILE;
      const H = WORLD_H * TILE;

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        width: W,
        height: H,
        backgroundColor: "#040810",
        parent: containerRef.current!,
        scene: [BootScene, WorldScene],
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        render: {
          antialias: false,
          pixelArt: false,
          roundPixels: true,
        },
        banner: false,
      } as ConstructorParameters<typeof Phaser.Game>[0]);

      gameRef.current = game;
    });

    return () => {
      destroyed = true;
      if (gameRef.current) {
        (gameRef.current as { destroy: (v: boolean) => void }).destroy(true);
        gameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      style={{ cursor: "grab" }}
    />
  );
}
