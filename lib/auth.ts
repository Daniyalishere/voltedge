import crypto from "crypto";
import { cookies } from "next/headers";
import { readOnly, withDb } from "./db";
import type { Session, User } from "./types";

export const SESSION_COOKIE = "voltedge_session";
export const CODE_TTL_MINUTES = 10;
export const MAX_CODE_ATTEMPTS = 5;
const SESSION_TTL_DAYS = 30;

export function generateCode(): string {
  // crypto.randomInt avoids the modulo bias of Math.random-based codes.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
}

/** Timing-safe comparison of two hex digests. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function createSession(user: User): Promise<Session> {
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_DAYS * 86_400_000);

  const session: Session = {
    token: crypto.randomBytes(32).toString("hex"),
    userId: user.id,
    email: user.email,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  await withDb((db) => {
    // Drop expired sessions opportunistically so the file doesn't grow forever.
    db.sessions = db.sessions.filter((s) => new Date(s.expiresAt) > now);
    db.sessions.push(session);
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });

  return session;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;

  if (token) {
    await withDb((db) => {
      db.sessions = db.sessions.filter((s) => s.token !== token);
    });
  }

  jar.delete(SESSION_COOKIE);
}

/**
 * Resolves the signed-in user from the session cookie, or null.
 */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  return readOnly((db) => {
    const session = db.sessions.find((s) => s.token === token);
    if (!session || new Date(session.expiresAt) <= new Date()) return null;
    return db.users.find((u) => u.id === session.userId) ?? null;
  });
}
