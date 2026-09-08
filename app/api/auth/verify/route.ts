import { NextResponse } from "next/server";
import { z } from "zod";
import {
  MAX_CODE_ATTEMPTS,
  createSession,
  hashCode,
  newId,
  normalizeEmail,
  safeEqual,
} from "@/lib/auth";
import { withDb } from "@/lib/db";
import { sendLoginAlertEmail, sendWelcomeEmail } from "@/lib/mailer";
import type { User } from "@/lib/types";

const schema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
  name: z.string().trim().max(60).optional(),
});

type Outcome =
  | { status: "ok"; user: User; isNewUser: boolean }
  | { status: "error"; message: string; code: number };

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const email = normalizeEmail(parsed.data.email);
  const now = new Date();

  const outcome = await withDb<Outcome>((db) => {
    const entry = db.loginCodes.find((c) => c.email === email);

    if (!entry) {
      return { status: "error", message: "No code was requested for this email.", code: 400 };
    }

    if (new Date(entry.expiresAt) <= now) {
      db.loginCodes = db.loginCodes.filter((c) => c.email !== email);
      return { status: "error", message: "That code has expired. Request a new one.", code: 400 };
    }

    if (entry.attempts >= MAX_CODE_ATTEMPTS) {
      db.loginCodes = db.loginCodes.filter((c) => c.email !== email);
      return { status: "error", message: "Too many attempts. Request a new code.", code: 429 };
    }

    if (!safeEqual(entry.codeHash, hashCode(parsed.data.code))) {
      entry.attempts += 1;
      const left = MAX_CODE_ATTEMPTS - entry.attempts;
      return {
        status: "error",
        message: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many attempts. Request a new code.",
        code: 401,
      };
    }

    // Code is valid - consume it.
    db.loginCodes = db.loginCodes.filter((c) => c.email !== email);

    let user = db.users.find((u) => u.email === email);
    const isNewUser = !user;

    if (!user) {
      const fallbackName = email.split("@")[0].replace(/[._-]+/g, " ");
      user = {
        id: newId("usr"),
        email,
        name: parsed.data.name?.trim() || titleCase(fallbackName),
        createdAt: now.toISOString(),
        lastLoginAt: null,
        loginCount: 0,
        totalCharges: 0,
        totalKwh: 0,
        totalSpent: 0,
        totalSaved: 0,
        freeChargesAvailable: 0,
        freeChargesEarned: 0,
        // The 10% new-customer welcome discount.
        welcomeDiscountAvailable: true,
        charges: [],
      };
      db.users.push(user);
    } else if (parsed.data.name?.trim()) {
      user.name = parsed.data.name.trim();
    }

    user.lastLoginAt = now.toISOString();
    user.loginCount += 1;

    return { status: "ok", user, isNewUser };
  });

  if (outcome.status === "error") {
    return NextResponse.json({ error: outcome.message }, { status: outcome.code });
  }

  const { user, isNewUser } = outcome;

  await createSession(user);

  // Notification emails are best-effort: a delivery failure must not block a
  // successful login, so they are not awaited into the response path.
  const mails: Promise<unknown>[] = [
    sendLoginAlertEmail(user.email, user.name, now, user.loginCount),
  ];
  if (isNewUser) {
    mails.push(sendWelcomeEmail(user.email, user.name));
  }
  Promise.allSettled(mails).catch(() => {});

  return NextResponse.json({
    ok: true,
    isNewUser,
    user: { id: user.id, email: user.email, name: user.name },
  });
}

function titleCase(s: string): string {
  return s
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
