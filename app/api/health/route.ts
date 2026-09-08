import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { DATA_PATHS, readOnly } from "@/lib/db";
import { BASE_GRAPH, STATION_NODES } from "@/lib/graph/network";
import { mailConfigured, mailMode } from "@/lib/mailer";

/**
 * Liveness/readiness probe.
 *
 * A health check that always returns 200 is not worth calling, so this
 * exercises the things that actually break in production:
 *
 *   - storage : the JSON data directory is readable AND writable
 *   - graph   : the road network loaded and is non-empty
 *   - email   : whether Gmail credentials are configured (informational)
 *
 * Returns 200 when every critical check passes, 503 otherwise, so uptime
 * monitors and Render's health check can act on the status code alone.
 */

// Never cache: a cached probe would report stale health.
export const dynamic = "force-dynamic";

type CheckStatus = "pass" | "fail" | "warn";

interface Check {
  status: CheckStatus;
  detail: string;
  /** Only present when the check does real work. */
  durationMs?: number;
}

const startedAt = Date.now();

export async function GET() {
  const checks: Record<string, Check> = {};

  checks.storage = await checkStorage();
  checks.graph = checkGraph();
  checks.email = checkEmail();

  // Only "fail" is fatal; "warn" keeps the service healthy.
  const healthy = Object.values(checks).every((c) => c.status !== "fail");

  const body = {
    status: healthy ? "healthy" : "unhealthy",
    service: "voltedge-ev-charging",
    version: process.env.npm_package_version ?? "0.1.0",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    checks,
  };

  return NextResponse.json(body, {
    status: healthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

/** Supports HEAD probes, which many uptime monitors prefer. */
export async function HEAD() {
  const storage = await checkStorage();
  const ok = storage.status !== "fail" && checkGraph().status !== "fail";
  return new Response(null, {
    status: ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

/* ------------------------------------------------------------------ */

/**
 * Verifies the data directory can be read AND written. A read-only or missing
 * volume is the most likely production failure (e.g. a Render disk that was
 * not mounted), and it would otherwise only surface when a user tries to sign in.
 */
async function checkStorage(): Promise<Check> {
  const t0 = performance.now();

  try {
    await fs.mkdir(DATA_PATHS.DATA_DIR, { recursive: true });

    // Round-trip a scratch file rather than assuming the mount is writable.
    const probe = path.join(DATA_PATHS.DATA_DIR, `.health-${process.pid}`);
    await fs.writeFile(probe, "ok", "utf8");
    await fs.readFile(probe, "utf8");
    await fs.unlink(probe).catch(() => {});

    // Confirm the store itself parses.
    const userCount = await readOnly((db) => db.users.length);

    return {
      status: "pass",
      detail: `Data directory readable and writable (${userCount} user${userCount === 1 ? "" : "s"} stored)`,
      durationMs: round(performance.now() - t0),
    };
  } catch (err) {
    return {
      status: "fail",
      detail: `Data directory unavailable: ${err instanceof Error ? err.message : String(err)}`,
      durationMs: round(performance.now() - t0),
    };
  }
}

/** Confirms the routing graph loaded, since the map is useless without it. */
function checkGraph(): Check {
  const nodes = BASE_GRAPH.nodes.size;
  const edges =
    [...BASE_GRAPH.adjacency.values()].reduce((sum, list) => sum + list.length, 0) / 2;
  const openStations = STATION_NODES.filter((s) => s.status !== "offline").length;

  if (nodes === 0 || edges === 0) {
    return { status: "fail", detail: "Road network graph is empty" };
  }

  return {
    status: "pass",
    detail: `${nodes} nodes, ${edges} edges, ${openStations}/${STATION_NODES.length} stations open`,
  };
}

/**
 * Email is reported but never fatal: the app stays usable without it, and
 * actually sending a probe message on every health check would be abusive.
 */
function checkEmail(): Check {
  if (!mailConfigured) {
    return {
      status: "warn",
      detail: "Gmail not configured - login codes fall back to the server console",
    };
  }
  return { status: "pass", detail: `Gmail configured (${mailMode})` };
}

function round(n: number): number {
  return Number(n.toFixed(2));
}
