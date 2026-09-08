# VoltEdge - EV Charging Network

A full-stack EV charging platform built entirely with Next.js (App Router).
Frontend, backend API and data storage all live in this one project.

## Data structures and algorithms

The routing engine models Karachi as an **undirected weighted graph**: nodes are
road junctions and charging stations positioned by real latitude/longitude, and
edge weights are haversine (great-circle) distances in kilometres. The user's
dropped pin becomes a real node in that graph, wired to its four nearest
junctions, so every algorithm runs on one uniform structure.

| Algorithm | File | Role | Complexity |
| --------- | ---- | ---- | ---------- |
| **Dijkstra** | `lib/graph/dijkstra.ts` | Shortest-distance route to the nearest station, using a hand-written binary min-heap | O((V+E) log V) |
| **BFS** | `lib/graph/bfs.ts` | Level-order reachability; excludes **closed** stations so no route is planned through one, and reports fewest-hop distance | O(V+E) |
| **DFS** | `lib/graph/dfs.ts` | Enumerates **all simple paths** (alternative routes) via backtracking, bounded by depth and result count | O(V!) worst case, bounded |

Supporting structures: adjacency list (`Map<string, Adjacent[]>`), binary
min-heap priority queue, array-and-head-index queue for O(1) BFS dequeues, and
an on-stack `visited` set for DFS backtracking.

Each algorithm also records its exploration trace (settle order, BFS levels,
recursive-call count), which the map replays as an animation so the search is
visible rather than instantaneous.

**Correctness is verified**, not assumed: Dijkstra's output is checked against a
brute-force Bellman-Ford over every node, BFS level consistency is asserted
(`level[child] == level[parent] + 1`), and every DFS path is confirmed simple
and valid across 60 randomised pin placements.

### The map flow

1. Sign in, open **Find your nearest station**
2. Click anywhere on the Karachi map (Leaflet + OpenStreetMap) to drop your pin
3. BFS runs first (reachability, skipping closed stations), then Dijkstra
   (shortest route), then DFS (alternatives) - each animated on the map
4. Review the three tabs, optionally preview an alternative route
5. **Drive** - the car animates along the route with a live distance HUD
6. On arrival the charging page opens with that station pre-selected

## Features

**Passwordless login.** Enter an email, receive a 6-digit code by email, and
sign in. Accounts are created automatically on first successful login.

**Login notifications.** Every successful sign-in triggers an email telling the
user when their account was accessed and from which address.

**Loyalty programme.**

| Reward             | Rule                                                       |
| ------------------ | ---------------------------------------------------------- |
| Welcome discount   | 10% off the first charge for every new user                 |
| Loyal customer     | After 20 charges, 5% off every charge from then on          |
| Free charge        | Every 30 charges earns 1 completely free charge             |

The welcome discount takes precedence over the loyal discount when both apply,
so the user always gets the better rate. Redeeming a free charge preserves an
unused welcome discount for a later session.

**JSON data storage.** No database. All state is persisted as JSON:

- `data/users.json` - user accounts and their full charge history
- `data/sessions.json` - login codes and active sessions

Writes are atomic (temp file + rename) and serialized through a promise queue,
so concurrent requests cannot corrupt or silently overwrite each other.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the Google OAuth2 values
npm run dev
```

Open http://localhost:3000.

> **Without email configured** the app still works end to end: the login code is
> printed to the server console and shown in the UI so you can sign in. That
> fallback switches off automatically as soon as real credentials are present.

## Email setup (Google OAuth2)

Emails are sent with Nodemailer using Google OAuth2. You supply a long-lived
refresh token and Nodemailer mints short-lived access tokens automatically.

1. In the [Google Cloud Console](https://console.cloud.google.com/), create a
   project and enable the **Gmail API**.
2. On the **OAuth consent screen**, add your Gmail address as a test user and
   add the scope `https://mail.google.com/`.
3. Under **Credentials**, create an **OAuth client ID** of type *Web
   application*, with `https://developers.google.com/oauthplayground` as an
   authorised redirect URI.
4. At the [OAuth Playground](https://developers.google.com/oauthplayground),
   tick "Use your own OAuth credentials", enter the scope
   `https://mail.google.com/`, authorise, then exchange the code for a
   **refresh token**.

Set these in `.env.local`:

```
GMAIL_USER=you@gmail.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

While the consent screen is in *Testing* mode Google expires refresh tokens
after about 7 days. Publish the app to avoid re-generating them.

An App Password (`GMAIL_APP_PASSWORD`) is still accepted as a fallback if no
OAuth2 credentials are set.

## API

| Method | Route                     | Purpose                                     |
| ------ | ------------------------- | ------------------------------------------- |
| POST   | `/api/auth/request-code`  | Email a 6-digit sign-in code                |
| POST   | `/api/auth/verify`        | Verify the code, create/sign in, set cookie |
| POST   | `/api/auth/logout`        | Destroy the session                         |
| GET    | `/api/me`                 | Current user profile and loyalty status     |
| POST   | `/api/charge`             | Record a charge, apply discounts, email receipt |
| POST   | `/api/route-plan`         | Run Dijkstra + BFS + DFS from a dropped pin |

Sessions use an httpOnly, SameSite=Lax cookie. Login codes are stored only as
SHA-256 hashes, expire after 10 minutes, and are limited to 5 attempts with a
30-second resend cooldown.

## Deploying to Render

The included `Dockerfile` builds the app in standalone mode and runs as a
non-root user.

**Blueprint (easiest):** push to GitHub, then in Render pick
**New +** -> **Blueprint** and select the repo. `render.yaml` provisions the
service and a 1 GB disk mounted at `/var/data`.

**Manual:** create a Web Service, choose **Docker**, then add a disk mounted at
`/var/data` and set `DATA_DIR=/var/data` plus the four Gmail variables.

> The disk matters. Render's container filesystem is ephemeral, so without a
> mounted disk `users.json` is wiped on every deploy.

Build and run locally with Docker:

```bash
docker build -t voltedge .
docker run -p 3000:3000 --env-file .env.local -v voltedge-data:/app/data voltedge
```

## Project structure

```
app/
  api/                    backend route handlers
    route-plan/           runs Dijkstra + BFS + DFS
  dashboard/
    map/                  Leaflet map, pin placement, route animation
    charge/               post-arrival charging screen
  login/                  two-step email -> code sign-in
lib/
  graph/
    network.ts            Karachi graph: nodes, edges, adjacency list
    dijkstra.ts           shortest path + binary min-heap
    bfs.ts                reachability, closed-station filtering
    dfs.ts                all simple paths via backtracking
    routing.ts            orchestrates the three algorithms
    projection.ts         lat/lng helpers and bounds
  auth.ts                 sessions, code generation and verification
  db.ts                   JSON persistence (atomic writes, serialized)
  loyalty.ts              discount and reward rules
  mailer.ts               Nodemailer + Google OAuth2, email templates
  profile.ts              derives loyalty figures for the UI
  stations.ts             projects graph stations into the charging UI shape
```
