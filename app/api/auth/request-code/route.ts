import { NextResponse } from "next/server";
import { z } from "zod";
import { CODE_TTL_MINUTES, generateCode, hashCode, normalizeEmail } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { mailConfigured, sendLoginCodeEmail } from "@/lib/mailer";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  name: z.string().trim().max(60).optional(),
});

/** Rate limit: one code per email per 30s, tracked in memory. */
const lastSent = new Map<string, number>();
const RESEND_COOLDOWN_MS = 30_000;

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

  const previous = lastSent.get(email);
  if (previous && Date.now() - previous < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - previous)) / 1000);
    return NextResponse.json(
      { error: `Please wait ${wait}s before requesting another code.` },
      { status: 429 }
    );
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();

  const isNewUser = await withDb((db) => {
    // Only one live code per email.
    db.loginCodes = db.loginCodes.filter(
      (c) => c.email !== email && new Date(c.expiresAt) > new Date()
    );
    db.loginCodes.push({ email, codeHash: hashCode(code), expiresAt, attempts: 0 });
    return !db.users.some((u) => u.email === email);
  });

  lastSent.set(email, Date.now());

  const mail = await sendLoginCodeEmail(email, code, CODE_TTL_MINUTES);

  // Development convenience: with no SMTP configured the code cannot reach the
  // user, so surface it in the response to keep the app usable. This is
  // deliberately unreachable once real credentials are set.
  const devCode = !mailConfigured ? code : undefined;
  if (devCode) {
    console.info(`[auth] Login code for ${email}: ${code} (expires in ${CODE_TTL_MINUTES}m)`);
  }

  if (!mail.sent && mailConfigured) {
    return NextResponse.json(
      { error: `Could not send the email: ${mail.error ?? "unknown error"}` },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    isNewUser,
    emailSent: mail.sent,
    expiresInMinutes: CODE_TTL_MINUTES,
    devCode,
    message: mail.sent
      ? `We sent a 6-digit code to ${email}.`
      : "Email delivery is not configured, so the code is shown below for testing.",
  });
}
