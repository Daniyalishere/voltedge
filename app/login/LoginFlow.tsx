"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";

type Step = "email" | "code";

export function LoginFlow() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const codeInputRef = useRef<HTMLInputElement>(null);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setIsNewUser(Boolean(data.isNewUser));
      setDevCode(data.devCode ?? null);
      setNotice(data.message ?? null);
      setStep("code");
      setCooldown(30);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, name: name || undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not verify that code.");
        setCode("");
        codeInputRef.current?.focus();
        return;
      }

      router.push(data.isNewUser ? "/dashboard?welcome=1" : "/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" aria-label="VoltEdge home">
          <Logo />
        </Link>
        <Link href="/" className="text-sm text-mist-500 transition-colors hover:text-mist-300">
          Back to home
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="rise w-full max-w-md">
          <div className="glass sheen rounded-2xl p-8 sm:p-10">
            {step === "email" ? (
              <>
                <h1 className="text-2xl font-semibold tracking-tight">Sign in to VoltEdge</h1>
                <p className="mt-2.5 text-sm leading-relaxed text-mist-500">
                  Enter your email and we&apos;ll send you a secure 6-digit code. New here?
                  Your account is created automatically - with{" "}
                  <span className="font-medium text-volt-400">10% off your first charge</span>.
                </p>

                <form onSubmit={requestCode} className="mt-8 space-y-4">
                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-medium text-mist-300">
                      Email address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="field"
                    />
                  </div>

                  <div>
                    <label htmlFor="name" className="mb-2 block text-sm font-medium text-mist-300">
                      Name <span className="font-normal text-mist-600">(optional)</span>
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="How should we greet you?"
                      className="field"
                    />
                  </div>

                  {error && <Alert tone="error">{error}</Alert>}

                  <button type="submit" disabled={pending || !email} className="btn-primary w-full">
                    {pending ? "Sending code…" : "Send sign-in code"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError(null);
                    setDevCode(null);
                  }}
                  className="mb-6 inline-flex items-center gap-1.5 text-sm text-mist-500 transition-colors hover:text-mist-300"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M19 12H5m0 0 5.5 5.5M5 12l5.5-5.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Use a different email
                </button>

                <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
                <p className="mt-2.5 text-sm leading-relaxed text-mist-500">
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-mist-100">{email}</span>. It expires in
                  10 minutes.
                </p>

                {devCode && (
                  <div className="mt-6 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-amber-400">
                      Email not configured - test mode
                    </p>
                    <p className="mt-2 font-mono text-3xl font-bold tracking-[0.3em] text-amber-300">
                      {devCode}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-amber-500/80">
                      Set the Google OAuth2 variables to send real emails.
                    </p>
                  </div>
                )}

                <form onSubmit={verifyCode} className="mt-7 space-y-4">
                  <div>
                    <label htmlFor="code" className="mb-2 block text-sm font-medium text-mist-300">
                      6-digit code
                    </label>
                    <input
                      ref={codeInputRef}
                      id="code"
                      name="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      className="field text-center font-mono text-2xl tracking-[0.55em]"
                    />
                  </div>

                  {error && <Alert tone="error">{error}</Alert>}
                  {!error && notice && !devCode && <Alert tone="info">{notice}</Alert>}

                  <button
                    type="submit"
                    disabled={pending || code.length !== 6}
                    className="btn-primary w-full"
                  >
                    {pending ? "Verifying…" : isNewUser ? "Create account & sign in" : "Sign in"}
                  </button>

                  <button
                    type="button"
                    onClick={() => requestCode()}
                    disabled={pending || cooldown > 0}
                    className="btn-ghost w-full"
                  >
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-mist-600">
            We&apos;ll email you whenever your account is signed in to, so you always know
            it&apos;s you.
          </p>
        </div>
      </div>
    </main>
  );
}

function Alert({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  const styles =
    tone === "error"
      ? "border-red-500/25 bg-red-500/10 text-red-300"
      : "border-white/10 bg-white/5 text-mist-300";

  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </p>
  );
}
