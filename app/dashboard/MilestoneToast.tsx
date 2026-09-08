"use client";

import { useEffect } from "react";
import type { Charge } from "@/lib/types";

export type Milestone =
  | { kind: "welcome" }
  | { kind: "loyal" }
  | { kind: "free-charge" }
  | { kind: "charged"; charge: Charge };

export function MilestoneToast({
  milestone,
  onDismiss,
}: {
  milestone: Milestone | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!milestone) return;
    // Celebrations linger; a plain receipt clears quickly.
    const ms = milestone.kind === "charged" ? 4000 : 8000;
    const t = setTimeout(onDismiss, ms);
    return () => clearTimeout(t);
  }, [milestone, onDismiss]);

  if (!milestone) return null;

  const content = {
    welcome: {
      title: "Welcome to VoltEdge",
      body: "Your account is ready and 10% off your first charge is already applied.",
      emoji: "⚡",
    },
    loyal: {
      title: "You're now a Loyal customer",
      body: "20 charges complete. Enjoy 5% off every charge from here on.",
      emoji: "⭐",
    },
    "free-charge": {
      title: "You've earned a free charge",
      body: "30 charges reached. Redeem it whenever you like from this dashboard.",
      emoji: "\u{1F381}",
    },
    charged: {
      title: "Charge complete",
      body:
        milestone.kind === "charged"
          ? `${milestone.charge.kwh.toFixed(2)} kWh at ${milestone.charge.stationName}. A receipt is on its way to your inbox.`
          : "",
      emoji: "✅",
    },
  }[milestone.kind];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md sm:inset-x-auto sm:right-6 sm:top-6"
    >
      <div className="glass sheen rise flex items-start gap-4 rounded-2xl p-5 shadow-2xl shadow-black/60">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-volt-500/15 text-xl">
          {content.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-mist-100">{content.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-mist-500">{content.body}</p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 rounded-lg p-1 text-mist-600 transition-colors hover:text-mist-300"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M18 6 6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
