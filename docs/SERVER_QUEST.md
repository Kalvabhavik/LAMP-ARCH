# LAMP: The Server Quest — technical guide

This guide covers the story-driven quest layer: registration, the house and Magic Box, the Introduction Hub, the company missions (ByteForge → NexaCore), file submissions, validation, procedures and progression. The six campus stations open configurable training pages; the terminal and tutor remain available.

## 1. Game flow

```
Register (name + gender)
 → Home (walk into the house)                      milestone entered_home
 → Find the hidden Magic Box (back room, press E)  milestone found_magic_box   · achievement Explorer
 → Mission portal (configurable URL) → Return      milestone opened_mission_portal
 → Introduction Hub (plaza)                        milestone visited_intro_hub  → ByteForge unlocked
 → ByteForge Solutions (west road)                 milestone company:byteforge:joined
 → Talk to Alex Morgan → accept BF-001             milestone mission:BF-001:accepted
 → Upload solution → validation passes             milestone mission:BF-001:passed · LAMP Builder (+ Linux Engineer)
 → Submit procedure → accepted                     milestone mission:BF-001:documented · Documentation Master (if complete)
 → ByteForge complete → NexaCore unlocked          company:byteforge:completed, company:nexacore:unlocked
 → NexaCore Technologies (east road) → Priya Nair → NC-001 → submit → procedure
 → Final completion                                game:completed · Production Ready, Server Quest Champion
```

Levels shown in the HUD: 1 Home · 2 Introduction Hub · 3 ByteForge · 4 NexaCore · 5 Complete.

Progress is saved after every step. Reloading the page or coming back later restores the player's milestones, location, score, achievements, hints, submissions and procedures, and shows "Welcome back, <name>."

## Training station pages

Each station opens its training page in an in-game popup instead of a Learn → Practice → DIY panel. Paste your links into the `url` fields in `src/content/quest/station-sites.ts`; the comment above each field identifies the station. Leave a field blank to show the “No page linked yet” placeholder.

Use HTTPS links. To display a page inside the popup, the target site must allow framing: it must not send `X-Frame-Options: DENY` or `SAMEORIGIN`, and its Content Security Policy `frame-ancestors` directive must allow this app's origin. If it blocks framing, the popup offers **Open in new tab**.

When a linked page is open, a 20-second study timer unlocks **Mark as studied** for +25 points. Each station can be recorded once. Studying the first page grants Curious Mind; studying all six grants Campus Scholar.

## 2. Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page. "Start Mission" → `NEXT_PUBLIC_STARTING_PAGE_URL`, "Enter Introduction" → `NEXT_PUBLIC_INTRODUCTION_URL` |
| `/register` | Name + gender. Signs in anonymously with Supabase and creates the player |
| `/play` | The 3D world. Sends unregistered visitors to `/register` |
| `/portal` | Default Magic Box destination (mission dossier). "Return to Game" → `NEXT_PUBLIC_RETURN_TO_GAME_URL` |
| `GET /api/health` | Supabase configuration/reachability |
| `GET /api/player` · `POST /api/player` | Load the full game state · create a player `{name, gender}` |
| `GET /api/leaderboard` | Top 10 by total points and the caller's row/rank |
| `POST /api/progress` | `{type:"milestone"\|"location"\|"hint"\|"training", ...}` |
| `POST /api/missions/:id/accept` | Accept a mission (company must be joined first) |
| `POST /api/missions/:id/submissions` | Multipart `file`: upload and validate a solution |
| `POST /api/missions/:id/procedure` | Multipart `text`+`format` (text\|markdown) or `file` (.md/.txt/.pdf) |

Every API call needs `Authorization: Bearer <supabase access token>`. Responses look like `{ ok: true, state, events, ... }` on success and `{ ok: false, error: { code, message } }` on failure.

## 3. Environment variables

| Variable | Where | Default | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | — | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser | — | Public anon key. RLS limits it to reading the player's own rows |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | — | Used only by the route handlers (`src/lib/supabase/server.ts` imports `server-only`). Never prefix it with `NEXT_PUBLIC_` |
| `SUPABASE_SUBMISSIONS_BUCKET` | server | `submissions` | Private storage bucket |
| `NEXT_PUBLIC_MAGIC_BOX_EXTERNAL_URL` | browser | `/portal` | Page the Magic Box opens. Absolute cross-origin URLs open in a new tab |
| `NEXT_PUBLIC_STARTING_PAGE_URL` | browser | `/register` | Landing "Start Mission" button |
| `NEXT_PUBLIC_INTRODUCTION_URL` | browser | `/portal?section=introduction` | Landing "Enter Introduction" link |
| `NEXT_PUBLIC_RETURN_TO_GAME_URL` | browser | `/play` | Portal "Return to Game" button |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | server | — | Optional AI tutor (existing feature) |

All of these URLs are read in one place: `src/config/game.ts`. `NEXT_PUBLIC_*` values are inlined at build time, so rebuild after changing them. If Supabase isn't configured, the API returns `503 SUPABASE_NOT_CONFIGURED` and the game shows an error screen.

## 4. Database (Supabase)

Migrations: `supabase/migrations/20261003000000_server_quest.sql` and `supabase/migrations/20261004000000_leaderboard.sql`.

| Table | Contents |
| --- | --- |
| `players` | `id` (= `auth.users.id`), name, gender, current_level, current_location, completed_missions, score, metadata (training XP/crystals), timestamps |
| `game_progress` | One row per milestone per player (unique), with level/location/status/timestamps |
| `missions` | Mission catalog (BF-001, NC-001). Full content and rules live in `src/content/quest/missions/*.ts` |
| `submissions` | Attempt number, storage path, file name/size/type, status (`checking`/`passed`/`needs_improvement`/`error`), score, feedback JSON |
| `procedures` | Attempt, format, text, storage path, status (`checking`/`accepted`/`needs_improvement`/`error`), score, review JSON |
| `achievements` | Unlocked achievements (unique per player and key) |
| `leaderboard` | Player name, quest score, training XP, total points, achievement count and refresh time |
| `hint_unlocks` | Hints revealed per mission (each hint is charged once) |
| `score_events` | Audit log of every score change |

Security model:
- Players use **Supabase anonymous auth**, so each player has a real `auth.uid()`.
- **RLS** is enabled on every table. Clients can only `SELECT` their own rows, except that every authenticated player may read the leaderboard. All insert/update/delete grants are revoked from `anon` and `authenticated`.
- All writes go through Next.js route handlers using the service-role key. These handlers verify the bearer token, check progression prerequisites, then write. A player can't skip a level, unlock a company, or change their score by calling Supabase directly.
- Score changes go through `award_score()`, a `security definer` function that only `service_role` can execute. It updates the score atomically (never below zero) and writes the audit row.
- `refresh_leaderboard()` and its triggers are security-definer functions with an empty search path. They keep the leaderboard in sync with player score/name/training XP and achievement changes; clients cannot write leaderboard rows.
- Uploads go to the private `submissions` bucket under `<player_id>/<mission_id>/<row_id>/<file>`. Players can only read their own folder.

## 5. File submission and validation

1. The client checks extension and size, then uploads with a progress bar (XHR multipart).
2. The server checks that the mission is accepted and not yet passed, applies a rate limit (20 uploads per hour) and the mission's size limit, and checks the extension against the mission's allow-list plus magic bytes (`PK\x03\x04` for zip/docx, `%PDF-` for pdf, strict UTF-8 with no NUL bytes for text).
3. It inserts a `checking` row, stores the file in Storage, then extracts text in memory:
   - **zip**: streaming inflate that counts the bytes actually decompressed. Limits are 300 entries, 2 MB per entry and 25 MB total, so zip bombs are aborted. `__MACOSX`, `.git`, `node_modules` and `vendor` are skipped. Only text-like files are read.
   - **docx**: `word/document.xml` only. **pdf**: text layer via `unpdf`.
4. `validateSubmission(mission, bundle)` (`src/lib/validation/engine.ts`) checks every requirement:

| Level | Rule kinds | Example |
| --- | --- | --- |
| 1 Required files | `file_exists` | an `index.php` (or `<?php` code in a report) |
| 2 Keywords / config | `keywords` | `ErrorLog` and `CustomLog` |
| 3 Code / structure | `pattern`, `absent`, `sql_table` | `new mysqli(`, no `GRANT ALL ON *.*`, `students(id, name, email, course)` |
| 4 Commands / config steps | `commands` | `apt install apache2`, `a2ensite`, `ufw allow` |
| 5 Execution (future) | `sandbox` | skipped: no runner is configured |

   Score = weighted passed requirements (%). A submission **passes** when the score is at least the mission's `passThreshold` and every `critical` requirement passed. The response lists passed and failed requirements, feedback, suggestions and warnings. Players can resubmit until they pass.

**Uploaded code is never executed.** Validation is static text analysis only. Level 5 is modelled through the `SandboxRunner` interface (`src/lib/validation/rules.ts`). A future implementation must run code in an isolated, network-restricted, resource-limited container, never on the app server.

## 6. Procedures

After passing a mission, the player submits a procedure (typed Markdown/text, or an uploaded .md/.txt/.pdf). `reviewProcedure()` (`src/lib/validation/procedure.ts`) scores it against `src/content/quest/procedure-rubric.ts`:
- 9 sections (Objective, Environment, Installation, Configuration, Implementation, Testing, Problems, Solutions, Final result): 8 points as a heading, 4 if only mentioned.
- Length vs. the mission's `minWords`: 8 points.
- Mission-specific topics (for example "Apache configuration"): 20 points.
- **Accepted** at 70 or more. **Complete** (Documentation Master) when every section has a heading and every topic is covered.

Feedback is specific, for example: "Your implementation is correct, but your procedure does not explain how Apache was configured."

## 7. Scoring and achievements

| Event | Points |
| --- | --- |
| Mission completed | +500 |
| Correct implementation (100%) | +300 |
| Good procedure (accepted) | +200 |
| No hints used | +100 |
| First submission success | +100 |
| Hint used (each hint, once) | −50 |
| Failed submission | −25 |
| Training page studied (each station, once) | +25 |

Achievements: First Step, Explorer, Linux Engineer, LAMP Builder, Documentation Master, Production Ready, Server Quest Champion, Curious Mind, Campus Scholar (`src/content/quest/achievements.ts`). The server reconciles milestone-derived achievements when loading the player or recording progress.

The leaderboard is available at `GET /api/leaderboard`. It returns the top 10 ordered by total points (quest score plus training XP), along with the authenticated player's own rank and score breakdown.

## 8. Extending the game

**New mission**
1. Add `src/content/quest/missions/<id>.ts` exporting a `MissionDefinition` (brief, objectives, constraints, hints, `submission` allow-list/size, weighted `requirements`, `passThreshold`, `procedure.minWords` and `topics`).
2. Register it in `src/content/quest/missions/index.ts` and add its id to the `MissionId` union in `src/types/mission.ts`.
3. Add a catalog row in a new migration (`insert into public.missions ...`), because submissions reference it.
4. Add reference solutions in `docs/samples/<id>/` and a test that they score 100 (see `src/lib/validation/missions.test.ts`).

**New company**
1. Add an entry to `src/content/quest/companies.ts` (`order`, `color`, `missionIds`, `manager`, `unlockedBy`, which is the milestone that unlocks it, usually `company:<previous>:completed`).
2. Add its building placement in the world (see `CompanyBuilding` usage in `Campus.tsx`) and a flat zone in `src/lib/world/terrain.ts`.
3. Add the manager's dialogue tree in `src/content/quest/dialogue.ts` and an NPC entry in `src/content/characters.ts`.
4. Extend the objective/tracker lists in `src/lib/game/progression.ts` and the `LOCATIONS` allow-list in `src/app/api/progress/route.ts`.

**New character**
Add an entry to `src/content/characters.ts` (palette, hair style, build). `CharacterModel` renders it procedurally. To use a GLB model instead, load it in `CharacterModel` and keep the same limb groups so the walk animation still works.

**Magic Box / portal URL**
Set `NEXT_PUBLIC_MAGIC_BOX_EXTERNAL_URL` (and `NEXT_PUBLIC_RETURN_TO_GAME_URL` on the external page's "back" link), then rebuild.

## 9. Local development

```bash
npm ci
npx supabase start            # Docker required; uses supabase/config.toml and applies migrations
npx supabase status           # copy API URL, anon key and service_role key
cp .env.example .env.local    # fill NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
npm run dev                   # http://localhost:3000

npm run test                  # vitest: validation engine, procedure review, progression, scoring
npm run typecheck && npm run lint && npm run build
node scripts/smoke-api.mjs    # end-to-end API flow against the running dev server
node scripts/e2e-flow.mjs     # browser flow (Playwright)
```

To reset local data, run `npx supabase db reset`.

## 10. Deployment

1. Create a Supabase project. Enable **Anonymous sign-ins** under Authentication → Providers (or `enable_anonymous_sign_ins = true` in config). Consider enabling CAPTCHA for anonymous sign-ins in production.
2. Apply the migration: `npx supabase link --project-ref <ref> && npx supabase db push`. This creates the tables, RLS, functions, the private `submissions` bucket and the mission catalog.
3. In your host (for example Vercel), set the environment variables from §3. Mark `SUPABASE_SERVICE_ROLE_KEY` server-only, then build and deploy (`npm run build && npm start`). Route handlers use the Node.js runtime.
4. Check `GET /api/health` → `{"supabase":"ok"}`, then register a player and walk through the flow.
