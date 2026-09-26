import Link from "next/link";

export const metadata = {
  title: "CRUCIBLE — AI Survival Arena",
  description:
    "Watch AI agents from different LLM providers battle for survival. Assign challenges, inject chaos, and see who survives.",
};

const AGENTS = [
  { name: "Claude", color: "#7C3AED", trait: "Cooperative" },
  { name: "GPT-4", color: "#10B981", trait: "Aggressive" },
  { name: "Gemini", color: "#3B82F6", trait: "Exploratory" },
  { name: "Llama", color: "#F59E0B", trait: "Chaotic" },
  { name: "Mistral", color: "#EF4444", trait: "Ruthless" },
];

const FEATURES = [
  { icon: "🌍", title: "Living World", desc: "28×20 procedural map with terrain, resources, day/night cycles, and random catastrophes." },
  { icon: "🧠", title: "Real LLM Decisions", desc: "Each agent calls its actual LLM — or a behavioral archetype when no key is configured." },
  { icon: "👑", title: "Boss Mode", desc: "Assign challenges mid-simulation. Watch agents try (and fail) to complete them live." },
  { icon: "⚗️", title: "Scenarios", desc: "Last Stand, Plague, Resource War, Speedrun — one-click dramatic situations." },
  { icon: "📡", title: "Real-time", desc: "Python FastAPI backend streams world state via WebSocket every tick." },
  { icon: "💬", title: "Agent Reasoning", desc: "See the actual chain-of-thought each LLM uses to make survival decisions." },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#060a0f] text-white">
      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(124,58,237,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-900/30 blur-3xl" />

        <div className="relative z-10">
          <div className="mb-4 inline-block rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300">
            AI × Survival × Experiment
          </div>
          <h1 className="mb-4 text-7xl font-black tracking-tighter md:text-8xl">CRUCIBLE</h1>
          <p className="mx-auto mb-6 max-w-2xl text-xl text-white/40">
            Drop AI agents from different LLM providers into a harsh world. Watch them survive, compete, cooperate — and fail. Assign challenges. Inject chaos.
          </p>

          <div className="mb-10 flex justify-center gap-3">
            {AGENTS.map((a) => (
              <div key={a.name} className="flex flex-col items-center gap-1">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white"
                  style={{ backgroundColor: a.color, boxShadow: `0 0 20px ${a.color}44` }}
                >
                  {a.name[0]}
                </div>
                <span className="text-xs text-white/30">{a.name}</span>
                <span className="text-xs" style={{ color: a.color }}>
                  {a.trait}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/simulation"
              className="rounded-xl bg-violet-600 px-8 py-3.5 text-base font-black text-white shadow-xl shadow-violet-900/50 transition hover:bg-violet-500"
            >
              Enter the Crucible →
            </Link>
            <a
              href="https://github.com/Vikasverma9515/crucible"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-white/10 px-8 py-3.5 text-base font-semibold text-white/50 transition hover:border-white/20 hover:text-white/80"
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-black">What happens in the Crucible</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-white/5 bg-white/[0.03] p-5 transition hover:border-white/10"
              >
                <div className="mb-2 text-2xl">{f.icon}</div>
                <h3 className="mb-1 font-bold">{f.title}</h3>
                <p className="text-sm text-white/40">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Setup */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/5 bg-white/[0.03] p-8">
          <h2 className="mb-4 text-xl font-black">Run it locally</h2>
          <div className="space-y-3 font-mono text-sm">
            <div className="rounded-lg bg-black/40 px-4 py-3 text-white/60">
              <span className="text-violet-400"># Python backend</span>
              <br />
              cd backend && pip install -r requirements.txt
              <br />
              python main.py
            </div>
            <div className="rounded-lg bg-black/40 px-4 py-3 text-white/60">
              <span className="text-emerald-400"># Next.js frontend</span>
              <br />
              pnpm install && pnpm dev
            </div>
          </div>
          <p className="mt-4 text-sm text-white/30">
            Add{" "}
            <code className="rounded bg-white/10 px-1">ANTHROPIC_API_KEY</code> or{" "}
            <code className="rounded bg-white/10 px-1">OPENAI_API_KEY</code> to{" "}
            <code className="rounded bg-white/10 px-1">backend/.env</code> for real LLM calls.
            Works without keys using personality archetypes.
          </p>
        </div>
      </section>
    </main>
  );
}
