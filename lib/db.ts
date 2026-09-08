import { promises as fs } from "fs";
import path from "path";
import type { Database } from "./types";

/**
 * JSON-file persistence layer.
 *
 * State is split across two files in the data directory:
 *   - `users.json`    the user records, including each user's charge history
 *   - `sessions.json` login codes and active sessions (transient auth state)
 *
 * Keeping users in their own file makes the account data easy to inspect and
 * back up without the churn of short-lived session rows.
 *
 * The data directory is configurable so a deployment can point it at a mounted
 * disk (on Render, an ephemeral filesystem resets on redeploy).
 */
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

/**
 * Serializes all reads/writes. Route handlers can run concurrently, and a
 * naive read-modify-write would silently drop updates when two requests
 * overlap. Every operation is queued onto this chain instead.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  // Keep the chain alive even if a task rejects.
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * Reads and parses a JSON file, returning `fallback` when it is missing.
 * A corrupt file is set aside rather than taking the whole app down.
 */
async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    if (err instanceof SyntaxError) {
      await fs.rename(file, `${file}.corrupt-${Date.now()}`).catch(() => {});
      return fallback;
    }
    throw err;
  }
}

/** Atomic write: write to a temp file, then rename over the target. */
async function writeJson(file: string, value: unknown): Promise<void> {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmp, file);
}

async function readDb(): Promise<Database> {
  const [users, auth] = await Promise.all([
    readJson<Database["users"]>(USERS_FILE, []),
    readJson<{ loginCodes: Database["loginCodes"]; sessions: Database["sessions"] }>(
      SESSIONS_FILE,
      { loginCodes: [], sessions: [] }
    ),
  ]);

  return {
    users: users ?? [],
    loginCodes: auth?.loginCodes ?? [],
    sessions: auth?.sessions ?? [],
  };
}

async function writeDb(db: Database): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await Promise.all([
    writeJson(USERS_FILE, db.users),
    writeJson(SESSIONS_FILE, { loginCodes: db.loginCodes, sessions: db.sessions }),
  ]);
}

/**
 * Reads the database, hands it to `mutator`, then persists whatever the
 * mutator leaves behind. Runs exclusively with respect to other calls.
 */
export function withDb<T>(mutator: (db: Database) => T | Promise<T>): Promise<T> {
  return enqueue(async () => {
    const db = await readDb();
    const result = await mutator(db);
    await writeDb(db);
    return result;
  });
}

/** Read-only access; skips the write-back. */
export function readOnly<T>(reader: (db: Database) => T | Promise<T>): Promise<T> {
  return enqueue(async () => reader(await readDb()));
}

export const DATA_PATHS = { DATA_DIR, USERS_FILE, SESSIONS_FILE };
