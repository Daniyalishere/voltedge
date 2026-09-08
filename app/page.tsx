import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/auth";
import { FREE_CHARGE_INTERVAL, LOYAL_THRESHOLD } from "@/lib/loyalty";
import { STATIONS } from "@/lib/stations";

export default async function LandingPage() {
  // Signed-in visitors go straight to their dashboard.
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="flex-1">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <Link href="/login" className="btn-ghost">
          Sign in
        </Link>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-14 pb-20 sm:pt-24">
        <div className="rise mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-volt-500/25 bg-volt-500/10 px-3.5 py-1.5 text-xs font-medium text-volt-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-volt-400" />
            </span>
            {STATIONS.filter((s) => s.status === "available").length} stations live now
          </span>

          <h1 className="mt-7 text-[2.7rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            <span className="text-gradient">Charge smarter.</span>
            <br />
            <span className="text-mist-100">Get rewarded every mile.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-[1.05rem] leading-relaxed text-mist-500">
            Ultra-fast charging across the country, with a loyalty programme that
            actually pays you back. Start with{" "}
            <span className="font-medium text-mist-300">10% off your first charge</span>.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className="btn-primary w-full sm:w-auto">
              Get started - 10% off
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link href="#rewards" className="btn-ghost w-full sm:w-auto">
              How rewards work
            </Link>
          </div>

          <p className="mt-5 text-xs text-mist-600">
            No password to remember - we email you a secure sign-in code.
          </p>
        </div>

        {/* Stat strip */}
        <div className="rise mt-20 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:grid-cols-4">
          {[
            { value: "10%", label: "Off your first charge" },
            { value: "5%", label: `After ${LOYAL_THRESHOLD} charges, forever` },
            { value: "1 free", label: `Every ${FREE_CHARGE_INTERVAL} charges` },
            { value: "180 kW", label: "Peak charging speed" },
          ].map((s) => (
            <div key={s.label} className="bg-ink-950/70 px-6 py-7 text-center">
              <div className="text-gradient text-3xl font-semibold tracking-tight">
                {s.value}
              </div>
              <div className="mt-1.5 text-xs leading-relaxed text-mist-600">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Rewards ---------------- */}
      <section id="rewards" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Three ways we pay you back
          </h2>
          <p className="mt-4 text-mist-500">
            Rewards stack up automatically as you charge. Nothing to claim, no codes to enter.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Welcome discount",
              highlight: "10% off",
              body: "Create your account and your very first charge is automatically 10% cheaper.",
              icon: (
                <path
                  d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              ),
            },
            {
              step: "02",
              title: "Loyal customer",
              highlight: "5% forever",
              body: `Complete ${LOYAL_THRESHOLD} charges to unlock Loyal status - 5% off every single charge from then on.`,
              icon: (
                <path
                  d="m12 3 2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8L12 3Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              ),
            },
            {
              step: "03",
              title: "Free charge",
              highlight: "On the house",
              body: `Every ${FREE_CHARGE_INTERVAL} charges earns a completely free session. Redeem it whenever you like.`,
              icon: (
                <path
                  d="M20 12v9H4v-9M2 7h20v5H2V7Zm10 0v14M12 7S9.5 3 7.5 3a2.5 2.5 0 0 0 0 5M12 7s2.5-4 4.5-4a2.5 2.5 0 0 1 0 5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              ),
            },
          ].map((c) => (
            <article key={c.step} className="glass glass-hover sheen rounded-2xl p-7">
              <div className="flex items-start justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-volt-500/12 text-volt-400">
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    {c.icon}
                  </svg>
                </span>
                <span className="font-mono text-xs text-mist-600">{c.step}</span>
              </div>
              <h3 className="mt-6 text-lg font-medium text-mist-100">{c.title}</h3>
              <p className="mt-1 text-2xl font-semibold text-volt-400">{c.highlight}</p>
              <p className="mt-3 text-sm leading-relaxed text-mist-500">{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------- Stations ---------------- */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Our network</h2>
            <p className="mt-3 text-mist-500">
              Premium hardware at every site, with live availability.
            </p>
          </div>
          <Link href="/login" className="btn-ghost">
            Start charging
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STATIONS.map((s) => (
            <article key={s.id} className="glass glass-hover rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-mist-100">{s.name}</h3>
                  <p className="mt-1 truncate text-sm text-mist-600">{s.location}</p>
                </div>
                <StatusPill status={s.status} />
              </div>

              <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-white/8 pt-5 text-center">
                <div>
                  <dt className="text-[0.65rem] uppercase tracking-wider text-mist-600">Power</dt>
                  <dd className="tabular mt-1 text-sm font-medium text-mist-100">
                    {s.powerKw} kW
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] uppercase tracking-wider text-mist-600">Plug</dt>
                  <dd className="mt-1 truncate text-sm font-medium text-mist-100">
                    {s.connector}
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] uppercase tracking-wider text-mist-600">Rate</dt>
                  <dd className="tabular mt-1 text-sm font-medium text-mist-100">
                    {s.ratePerKwh}/kWh
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="glass sheen relative overflow-hidden rounded-3xl px-8 py-16 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Your first charge is <span className="text-gradient">10% off</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-mist-500">
            Sign in with your email - we&apos;ll send you a secure code. It takes about ten seconds.
          </p>
          <Link href="/login" className="btn-primary mt-9">
            Create your account
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <Logo size={26} />
          <p className="text-xs text-mist-600">
            &copy; {new Date().getFullYear()} VoltEdge Charging Network
          </p>
        </div>
      </footer>
    </main>
  );
}

function StatusPill({ status }: { status: "available" | "busy" | "offline" }) {
  const styles = {
    available: "border-volt-500/30 bg-volt-500/10 text-volt-400",
    busy: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    offline: "border-white/10 bg-white/5 text-mist-600",
  }[status];

  const label = { available: "Available", busy: "In use", offline: "Offline" }[status];

  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.7rem] font-medium ${styles}`}
    >
      {label}
    </span>
  );
}
