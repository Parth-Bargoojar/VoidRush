# Project Context: VOIDRUSH

> **Metadata**
> - **Source Files Read:** [VoidRush.PRD.md](file:///c:/Users/admin/Desktop/VOIDRUSH.Project/VoidRush.PRD.md), [VoidRush.TRD.md](file:///c:/Users/admin/Desktop/VOIDRUSH.Project/VoidRush.TRD.md), [Design.md](file:///c:/Users/admin/Desktop/VOIDRUSH.Project/Design.md)
> - **Date Generated:** 2026-08-12
> - **Project Identifier:** VOIDRUSH — Desktop browser-based first-person endless voxel 3D obstacle runner

---

## 1. Product Summary

VOIDRUSH is a browser-based first-person endless 3D obstacle runner built in WebGL. Inspired by the visual language and high-speed gameplay of voxel tunnel runners, the player controls a levitating entity flying continuously forward through an infinite, procedurally generated 3D voxel tunnel.

- **Target Audience:** Desktop browser gamers who enjoy arcade runners, precision action, high-score challenges, and fast-reaction gameplay.
- **Value Proposition:** Instant loading (<2s to gameplay), zero setup/installation, zero account requirement, hyper-responsive WASD controls, highly replayable score-chasing loop, and high-contrast voxel aesthetic.
- **Expected Session Length:** 30 seconds to 5+ minutes per run.

---

## 2. Core Features & Scope

### In-Scope Features (MVP)
1. **First-Person Airborne Flight:** Permanent levitation; camera represents player; no physical avatar body or third-person camera.
2. **WASD Movement:** Directional lateral/vertical steering with acceleration (30 units/s²), max speed (14 units/s), damping (10), and diagonal input support.
3. **Automatic Forward Velocity:** Auto-propulsion starting at 30 units/s, scaling to 100–120+ units/s as difficulty increases. No stopping or reversing.
4. **Procedural Voxel Tunnel System:** Streamed and recycled tunnel segments (30–50 world units long, 8–12 active segments ahead). Wall, floor, ceiling block variation with dynamic width, height, cross-section, and axial rotation.
5. **Obstacle System:** 8 distinct archetypes spanning 3 categories:
   - *Static:* Gate (O1), Cross (O2), Ring (O3), Bullseye (O4), Cage (O7).
   - *Moving:* Moving Gate (O6).
   - *Rotating:* Fan (O5), Rotating Cross (O8).
6. **Collision & Fair Spacing:** Sphere/capsule player bounding volume. Single-hit instant death (no health/lives). Constrained procedural generator guarantees at least one valid traversal route per obstacle with dynamic 25–35 unit spacing.
7. **Scoring & Combo System:** Base score (+100/obstacle), combo multiplier (x1 up to x6 cap for MVP), near-miss detection bonus (+250 to +1,000 based on proximity threshold).
8. **Continuous Difficulty Scaling:** Survival time-driven progression across 4 phases: Intro (0–20s), Build (20–60s), Intense (60–120s), and Overload (120s+).
9. **Visual Polish & Camera:** Dynamic FOV (75° scaling to ~90° at top speed), subtle camera roll (±5° max), impact camera shake, bloom, emissive obstacle outlines, and 4 dynamic visual color palettes.
10. **2D Interface & Audio:** React-based HUD (score, speed, combo, timer, event notifications), Main Menu, Pause Menu, Results Screen, Settings Screen, Web Audio API soundtrack & sound effects.

### Out-of-Scope (Explicitly Excluded from MVP)
- Multiplayer, online lobbies, matchmaking, or social racing
- User accounts, authentication, or cloud saves
- Online leaderboards, friends lists, or social chat
- Achievements, inventories, skins, shop, monetization, ads, or battle passes
- Story/campaign mode, character customization, level editor, or custom user maps
- Mobile devices, touch controls, gamepad/controller support, or VR
- Server-side infrastructure, databases, or runtime AI APIs

---

## 3. User Flows / Key Use Cases

### Flow 1: Start Game
`Open Website` → `Main Menu (slow-moving 3D tunnel background)` → `Click PLAY` → `Launch transition (<2s total target)` → `Gameplay begins`

### Flow 2: Normal Gameplay
`Player flies forward automatically` → `Obstacle approaches` → `Player identifies gap` → `WASD directional steering` → `Player enters gap cleanly` → `Obstacle completion registered` → `Score & Combo updated on HUD` → `Next obstacle generated`

### Flow 3: Near Miss
`Obstacle approaches` → `Player steers through gap within close proximity threshold without colliding` → `Near miss triggered` → `Tiered score bonus (+250 / +500 / +1000) awarded` → `HUD displays "NEAR MISS +500" for 1.5s` → `Audio feedback plays` → `Run continues`

### Flow 4: Collision & Restart
`Player intersects solid obstacle geometry` → `Collision detected` → `100ms freeze-frame / hit-stop` → `Impact shake & visual distortion (0.7–1.2s total transition)` → `Run halts` → `Results Screen opens (Score, Time, Best Score, Max Combo, Obstacles Passed, Near Misses)` → `Click RESTART (≤3s transition)` → `Fresh seeded run starts immediately`

### Flow 5: Pause / Resume
`Active Gameplay` → `Press ESC or Pause Icon` → `Simulation freezes (Physics, Timers, Audio dimming)` → `Pause Panel overlaid` → `Click RESUME (Simulation unfreezes)` or `Click RESTART / MAIN MENU`

---

## 4. Tech Stack

- **Primary Language:** TypeScript
- **Frontend Framework:** React (UI, Menus, HUD, Results, Settings)
- **3D Engine & Graphics:** Three.js via WebGL
- **Build Tool / Dev Server:** Vite
- **Audio Engine:** Web Audio API (native browser audio)
- **Styling:** CSS Modules / Standard CSS with CSS Custom Properties (Design Tokens)
- **UI Icon Library:** `lucide-react`
- **Randomness / Seeding:** `seedrandom` (deterministic seed generation)
- **Persistence:** Browser `localStorage`
- **Testing:** Vitest (unit tests), Playwright (E2E browser tests)
- **Deployment:** Vercel (static site deployment) + GitHub repository

---

## 5. Architecture Overview

```
                      ┌───────────────────────────┐
                      │    Desktop Chrome Browser │
                      └─────────────┬─────────────┘
                                    │
                                    ▼
                      ┌───────────────────────────┐
                      │     React Application     │
                      │                           │
                      │  Main Menu / HUD / Pause  │
                      │   Settings / Results UI   │
                      └─────────────┬─────────────┘
                                    │
                                    ▼
                      ┌───────────────────────────┐
                      │    Three.js Game Engine   │
                      │                           │
                      │  Game Loop (60 FPS fixed) │
                      │  Player Flight & Camera   │
                      │  Tunnel & Obstacle Pool   │
                      │  Collision & Near-Miss    │
                      │  Scoring & Difficulty     │
                      └─────────────┬─────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
  WebGL Renderer              Web Audio API               localStorage
        │                           │                           │
        ▼                           ▼                           ▼
   3D Visuals                 Sound & SFX               Local Stats & Config
```

### Decoupled Engine-UI Architecture
- **React UI Layer:** Handles low-frequency state transitions (`MENU`, `PLAYING`, `PAUSED`, `GAME_OVER`, `SETTINGS`). React does **not** run or control the frame-by-frame 3D simulation loop.
- **Three.js Engine Layer:** Self-contained TypeScript engine running an independent `requestAnimationFrame` game loop. Owns player transforms, voxel generation, segment recycling, obstacle movement/rotation, bounding collision, near-miss checks, and WebGL rendering.
- **Zero Backend Client-Only Design:** No backend server, zero API requests, zero databases, zero external AI runtime endpoints. All calculation and rendering occurs locally in Chrome.

---

## 6. Data Model / Schema

Persistence uses browser `localStorage` with JSON serialization.

### 1. Key: `voidrush-settings`
```json
{
  "quality": "low | medium | high | ultra",
  "masterVolume": 1.0,
  "musicVolume": 0.8,
  "sfxVolume": 1.0,
  "movementSensitivity": 1.0,
  "cameraShake": 1.0,
  "effectsIntensity": 1.0,
  "fov": 75
}
```

### 2. Key: `voidrush-stats`
```json
{
  "bestScore": 0,
  "bestTime": 0,
  "bestCombo": 0,
  "bestSpeed": 0,
  "totalRuns": 0,
  "totalObstaclesPassed": 0,
  "totalNearMisses": 0
}
```

*Data Validation Rule:* Corrupted or invalid `localStorage` payloads must automatically trigger a fallback to hardcoded default values without breaking execution.

---

## 7. API Contracts

No HTTP/REST or WebSocket network endpoints exist in the project. The application exposes internal TypeScript service module contracts:

- **`GameManager`**
  - `startRun(): void` — Initializes state and procedural seed for a new run.
  - `restartRun(): void` — Immediately resets and restarts active run state.
  - `pauseGame(): void` — Sets simulation state to `PAUSED`.
  - `resumeGame(): void` — Sets simulation state to `PLAYING`.
- **`PlayerController`**
  - `updateMovement(deltaTime: number, inputState: InputState): { position: Vector3, velocity: Vector3 }`
- **`TunnelManager`**
  - `update(deltaTime: number, playerPosition: Vector3): void` — Streams and recycles tunnel segments.
- **`ObstacleManager`**
  - `spawnObstacle(config: ObstacleConfig): ObstacleInstance`
  - `update(deltaTime: number): void` — Updates moving and rotating obstacle geometries.
  - `removePassedObstacles(): void` — Recycles passed obstacles.
- **`CollisionSystem`**
  - `checkCollisions(player: Player, obstacles: Obstacle[]): CollisionResult`
- **`NearMissSystem`**
  - `evaluateNearMiss(player: Player, obstacle: Obstacle): NearMissResult`
- **`ScoreSystem`**
  - `registerObstaclePass(): ScoreUpdate`
  - `registerNearMiss(distance: number): ScoreUpdate`
- **`DifficultyManager`**
  - `getDifficulty(elapsedTime: number): DifficultyState`

---

## 8. Design System

- **Aesthetic Direction:** Stylized Voxel + Psychedelic Arcade + Sci-Fi Tunnel. Saturated colors, high contrast, emissive obstacle edges, dark environment base.

### Color Tokens
- **Core UI:** Background `#080A0F`, Surface `#10141B`, Surface Elevated `#171C24`, Border `#303844`, Border Strong `#566171`, Text Primary `#F5F7FA`, Text Secondary `#AAB2BE`, Text Muted `#6E7785`, White `#FFFFFF`, Black `#000000`, Success `#39E58C`, Warning `#FFD447`, Error `#FF3D4F`, Info `#38CFFF`.
- **Palette A (Default Blue/Yellow):** Gameplay Blue `#1769AA`, Deep Blue `#0B2A4A`, Yellow `#F2C230`, Orange `#C87816`, Bright Yellow `#FFE66D`.
- **Palette B (Cyan/Red):** Cyan `#13CFE3`, Dark Cyan `#064B59`, Red `#E63946`, Bright Red `#FF5260`, White `#E8E8E8`.
- **Palette C (Purple/Magenta):** Purple `#7136D9`, Deep Purple `#24103F`, Magenta `#D629C9`, Bright Magenta `#FF58E7`, Blue `#3155E7`.
- **Palette D (Red Overload):** Crimson `#C9182B`, Red `#F02D3A`, Pink `#FF6B7A`, Black `#09090B`.

### Typography & Spacing
- **Font Family:** `Inter`, fallback `Arial, Helvetica, sans-serif`. Tabular numerals for numbers.
- **Weights:** 400 (secondary text), 500 (standard UI), 600 (buttons), 700 (headings), 800 (score/branding), 900 (display text).
- **Spacing Grid:** 4px base (`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px`).
- **Borders & Radii:** 1px standard / 2px strong borders. Radii: `2px` (XS), `4px` (SM), `6px` (MD), `10px` (LG), `9999px` (Full).

### UI Component Guidelines
- **Icon Library:** `lucide-react` exclusively (2px stroke width, 44x44px minimum interaction targets).
- **Primary Button:** 48px height, white background, `#080A0F` text, `4px` radius, hover `#E5E7EB`, active scale `0.98`.
- **Panels & Overlays:** Background `rgba(16, 20, 27, 0.92)`, border `1px solid #303844`, `6px` radius.

---

## 9. Non-Functional Requirements

- **Performance:**
  - Target Frame Rate: 60 FPS at 1080p on modern desktop Chrome (minimum acceptable: 45 FPS).
  - Frame Budget: ≤16.67 ms/frame.
  - Load Time: <3 seconds initial web load.
  - Memory Management: Zero continuous memory growth; instanced meshes, shared geometries/materials, segment recycling, and object pooling are mandatory.
- **Latency:** WASD movement input visual response latency <50 ms.
- **Reliability:** Zero application crashes during 10 consecutive 5-minute test runs.
- **Graphics Support:** WebGL browser support mandatory (graceful failure message displayed if WebGL is unavailable).
- **Graphics Quality Levels:** Low, Medium (default), High, Ultra (adjusts block density, lighting complexity, bloom quality, shadow map resolution without changing mechanics).

---

## 10. Constraints & Assumptions

- **Target Platform:** Desktop Google Chrome on Windows, macOS, and Linux. Responsive 16:9 viewports (minimum target 1280x720, recommended 1920x1080).
- **Development Schedule:** 7–14 days development window for solo developer + AI vibe-coding workflow.
- **Hardware & Inputs:** Keyboard input (WASD + ESC) only. No touch or gamepad support expected in MVP.
- **Cost Constraint:** $0/month infrastructure cost using static Vercel hosting.
- **Architectural Principle:** Clean separation between React 2D DOM UI and Three.js 3D WebGL Engine. Centralized configuration objects for all gameplay values.

---

## 11. Open Questions / Ambiguities

1. **Sound Asset Delivery:** Documents describe background music and SFX cues (pass, near-miss, combo, collision, clicks), but specific audio asset URLs, licensing, or procedural Web Audio synth fallback parameters are not defined.
2. **Batching Limits on Ultra Quality:** Maximum limits for instanced voxel geometry under High/Ultra settings are left to playtest performance tuning on reference hardware.

---

## 12. Gaps Identified

- **No Missing Primary Documents:** PRD (`VoidRush.PRD.md`), TRD (`VoidRush.TRD.md`), and Design (`Design.md`) documents are all present and detailed.
- **Audio Asset Files:** Sound asset source files or sound generation library specifics are omitted.
- **No Backend Spec Required:** Backend, database, and authentication specifications are absent by design as the application is client-side only.

---

## 13. Conflicts Found

1. **HUD Wireframe Presentation vs. Design Tokens:**
   - *PRD (Section 10, Screen 2 Wireframe):* Displays score as `★ 160974` and speed as `⚡ 105 CUBES/S`.
   - *Design.md (Section 10):* Specifies HUD elements with text label blocks (`SCORE 160974` and `105 CUBES/S`).
2. **Palette B Definition Variations:**
   - *PRD (Section 23):* Lists Palette B (Cyan/White/Red) with `#13CFE3` (Cyan), `#E8E8E8` (White), `#E63946` (Red), `#292D32` (Dark Gray).
   - *Design.md (Section 3):* Lists Palette B as Cyan `#13CFE3`, Dark Cyan `#064B59`, Red `#E63946`, Bright Red `#FF5260`, White `#E8E8E8`.
3. **Combo Multiplier Cap Representation:**
   - *PRD (Section 14):* States initial multiplier cap is ×6 for MVP but notes architecture should allow future scaling.
   - *Design.md (Section 4):* Specifies multiplier display typography token up to 48px/900 without hardcoding a UI limit.

---

# PART II — IMPLEMENTATION STATUS

> Sections 1–13 above are the pre-build analysis and are left unchanged.
> Everything below records what was actually built.

## 14. Build Status

**MVP complete and verified.** The repository was empty of code at the start of
this build (documentation only); the entire game was implemented from scratch.

| Area | State |
|---|---|
| Simulation core | Complete — renderer-free, deterministic, fixed timestep |
| Rendering | Complete — Three.js, instanced, post-processed |
| Tunnel variation | Complete — width, height, cross-section, roll, wall pattern, lights (added in §21 audit) |
| Collision feedback | Complete — hit-stop, shake, distortion, fade (distortion/fade added in §21 audit) |
| Obstacles | Complete — 10 archetypes (PRD's 8, plus Rotating Ring and Combination) |
| Fairness | Complete — every obstacle proved passable before it is committed |
| UI | Complete — menu, HUD, pause, results, settings, credits |
| Audio | Complete — procedural synthwave soundtrack (tempo follows speed), optional `public/soundtrack.mp3` override |
| Persistence | Complete — validated, corruption-tolerant |
| Tests | 180 passing across 16 files |
| Soak | Passing — 5 simulated minutes × 10 seeds × 2 bot profiles |
| Browser QA | Passing — headless Chromium, screenshots captured |

---

## 15. Architecture As Built

The single most important structural decision: **the simulation imports no
Three.js.** `src/game`, `src/obstacles` and `src/world` are pure TypeScript.

That one constraint buys three things:

1. The identical simulation runs in the browser, in Vitest and in the Node soak
   harness. The fairness and determinism guarantees are tested against the code
   that actually ships, not a model of it.
2. Rendering cannot influence gameplay. Nothing in `src/rendering` writes to
   simulation state, so no visual change can alter whether a run is winnable.
3. The engine↔React boundary is enforceable rather than aspirational.

```
src/game, src/obstacles, src/world      pure simulation, no Three.js
        │  reads only
        ▼
src/rendering                            Three.js, instanced meshes
        │
src/app/GameBridge                       15 Hz snapshot, the only React channel
        ▼
src/ui                                   React screens + HUD
```

### Position is solved, not integrated

Obstacle and tunnel Z positions are a closed-form function of simulation time,
not an accumulated sum:

```
speed(t)      = min(SPEED_MAX, SPEED_START + RAMP·t)
distance(t)   = ∫ speed          (solved analytically, piecewise)
obstacle.z(t) = distance(t) − obstacle.zeroDistance
```

Because `distance(t)` is exactly invertible, the generator can ask *"at what
time will the player reach this obstacle?"* and get an answer the simulation
then reproduces exactly. Rotating and sliding obstacles are likewise closed-form
in `t`, so their openings can be evaluated at the predicted crossing time. This
is what makes the reachability proof meaningful rather than approximate; an
integrated position would drift from the plan.

### Geometry is collision

`Obstacle.parts` is a list of boxes. `getSolidVolumes()` transforms that list
into world space, and the renderer builds its instance matrices from the *same*
list. A solid that is visible but not collidable cannot exist by construction,
and a test asserts the counts match for every archetype.

### Rendering cost is per body, not per box

Instance matrices are baked once in each obstacle's local space when it spawns.
Per frame only the body's own transform moves — one position and one rotation
per obstacle regardless of how many hundreds of boxes it contains. Measured
draw calls during gameplay: **1**.

---

## 16. Fairness: How An Obstacle Is Proved Passable

Every obstacle passes two independent checks before entering the world.

**1. Analytic envelope.** Starting from the previous obstacle's opening centre —
where the player provably was, since they survived it — at rest, and charged two
time constants for accelerating and settling:

```
travel = tCross(new) − tCross(previous)
reach  = MAX_LATERAL_SPEED · max(0, travel − 2·TAU) · 0.7
```

The opening must lie within `reach` on both axes, be at least
`PLAYER_RADIUS + margin(d)` in half-extent, and sit fully inside the clamp box.

**2. Direct geometric proof.** A player-sized sphere parked at the opening
centre must clear the *actual* collision volumes — at the crossing time and at
both edges of a ±0.12 s window. This catches any disagreement between what an
archetype declares and what it really built, which the analytic check alone
would miss.

Time-varying openings are evaluated at the predicted crossing time and shrunk by
however far they drift across the window, so the player is never required to be
frame-perfect.

**Generation samples inside the envelope rather than rejecting outside it.**
That is why the fallback rate is 0.000% instead of climbing with difficulty.

---

## 17. Ambiguity Ledger

Decisions made where the source documents were silent, self-contradictory, or
specified something that could not hold.

| # | Decision | Why |
|---|---|---|
| 1 | Simulation steps at 120 Hz | The documents state 60 FPS as the *render* target; the TRD asks only for "fixed timestep" for the simulation. 120 Hz gives collision headroom. Rendering is still once per animation frame. |
| 2 | Spacing derived as `speed × gapSeconds` | PRD §20 explicitly asks for spacing computed from speed and reaction time. A fixed 25–35 units would be unplayable at 120 u/s: the reach budget would fall to ~1 unit. At start this yields 28.5 units, inside the PRD's stated initial range. |
| 3 | `mulberry32` instead of the `seedrandom` dependency | The TRD approves `seedrandom` but also says not to add libraries that a few lines would replace. A 10-line PRNG avoids a dependency entirely and satisfies the determinism requirement. |
| 4 | Moving-gate frequency derived from a peak-speed cap | The naive amplitude×frequency ramp produced openings sliding at 34 u/s — faster than the player's 14 u/s. That is not a difficulty setting, it is an unwinnable obstacle. Frequency now follows from a peak speed that stays well under the player's. |
| 5 | Obstacle tones lifted toward white for contrast | Palette C's blue (`#3155E7`) cannot reach 4.5:1 against *any* background — its own luminance caps the ratio at 3.58. Darkening every tunnel to near-black would have satisfied the numbers while destroying the palette identity the design system exists to establish. Lifting the obstacle tone preserves hue, keeps the tunnel coloured, and satisfies the rule in every palette. |
| 6 | Near-miss distance tiers set at 1.5 / 0.9 / 0.45 units | The PRD gives reward values (+250/+500/+1000) but no distances. Tuned until the observed rate landed inside the 15–35% band. |
| 7 | Combination and Rotating Ring added beyond the PRD's 8 | The PRD asks for "at least 8"; the build directive additionally requires these two. Implementing all ten satisfies both. |
| 8 | Segment length 45 units | PRD allows 30–50. Twelve segments of 45 leave enough slack that the tunnel still spans the spawn plane at the moment just before a segment recycles; 40 did not, and left a 5-unit gap. |
| 9 | Inter not bundled | Design.md asks for Inter loaded as an asset. Bundling a font would break the zero-external-asset / offline requirement both documents also state. The stack names Inter first and falls back exactly as Design.md specifies. |
| 10 | Diagnostics hook gated behind `?qa=1` | The automated browser pass needs to read engine state. Gating it means a normal session gets no debug surface, honouring the TRD's "remove debug UI" instruction. |
| 11 | Past 150 s, difficulty keeps rising only through rotation, sliding and an overload colour pulse (superseded by §22) | PRD says difficulty scales "indefinitely". Speed, gaps and spacing stay put because they bound human reaction. The added rates follow a curve that rises forever toward a ceiling that is still provably passable. |
| 12 | HUD shows `SCORE` / `CUBES/S` label blocks | CONTEXT.md §13 flags a conflict between the PRD's icon wireframe (`★`, `⚡`) and Design.md's label blocks. Design.md is the more specific UI specification and gives exact positions and sizes. |
| 13 | Tunnel shell varies; the player clamp box does not | PRD §6/§16 ask the tunnel to vary in width and narrow with difficulty. Moving the reachable box with it would put the tunnel inside the fairness proof. Instead the tunnel is a decorative shell that is provably kept outside the fixed reachable box (separating-axis check per block), and every obstacle carries a frame out to the widest wall so no section shows a false gap. |
| 14 | "Narrow" is 12 units, the current tunnel | That is the narrowest a fully protruding block can sit and still clear the reachable box. The tunnel therefore varies between 12 and 16, starting large (14.5) in INTRO. |
| 15 | Geometric tunnel variation begins in INTENSE | PRD §17 lists "Tunnel variation" under INTENSE and "Large tunnel" under INTRO. Wall patterns and light positions (PRD §6 "visual variation") vary from the start. |
| 16 | "Visual intensity" setting scales difficulty-driven effects | PRD Screen 5 lists the control without defining it. PRD §16 and the TRD define "visual intensity" as a difficulty output, so the setting scales that output: 0 holds the calm INTRO look, 1 lets effects build fully. |
| 17 | Settings schema extended additively | The TRD `voidrush-settings` schema omits controls PRD Screen 5 requires (bloom, visual intensity). They are added as extra fields; older payloads load with defaults. |

---

## 18. Divergences From The Build Directive

The build directive supplied its own constants. Per the stated precedence
(`CONTEXT.md → PRD → TRD → Design → directive`), the documents win. Recorded here
for traceability.

| Value | Directive | Built | Source |
|---|---|---|---|
| Max lateral speed | 26 u/s | **14 u/s** | PRD §2 |
| Movement damping | TAU 0.075 | **TAU 0.1** (damping 10) | PRD §2 |
| Start / max speed | 55 / 180 u/s | **30 / 120 u/s** | PRD §3 |
| Combo cap | ×10 | **×6**, configurable | PRD §14 |
| Combo curve | linear | **tiered thresholds** | PRD §14 |
| Near miss | +50 × combo | **+250 / +500 / +1000 × combo** | PRD §15 |
| Spacing | 95 → 58 units | **speed × 0.95→0.62 s** | PRD §20 |
| Segment length | 60 units | **45 units** | PRD §4 |
| Quality levels | 3 | **4** (adds Ultra) | TRD |
| Difficulty tiers | EARLY/MID/LATE/EXTREME at d thresholds | **INTRO/BUILD/INTENSE/OVERLOAD at 20/60/120 s** | PRD §17 |
| Static-only period | first 12 s | **first 20 s** | PRD §17 |
| Palettes | directive hexes | **CONTEXT.md §8 hexes** | CONTEXT.md |
| Combination obstacles from | d ≥ 0.45 | **INTENSE phase (60 s)** | PRD §17 |

Two directive items were kept because no document addresses them: the survival
score trickle (+2/s) and the reachability-proof methodology itself.

---

## 19. Known Limitations

Stated plainly, and separate from the completed work above.

1. **Frame-rate measurement is not representative.** The build machine has no
   GPU; headless Chromium falls back to SwiftShader, a software rasteriser,
   which measures ~2 FPS at 1080p. That number reflects the absence of a GPU,
   not the game. Draw calls (1), material count (3) and simulation step time
   (0.0013 ms) are hardware-independent and are within budget by wide margins,
   but **the 60 FPS target has not been verified on real hardware.**
2. **Overdrive is asymptotic.** Past 150 s difficulty rises continuously but
   toward a ceiling (ledger #11), so it never becomes unprovable.
3. **Combination obstacles do not chain across the join.** Each layer is
   validated against the one before it, but the archetypes inside a combination
   are chosen independently rather than composed for a designed sequence.
4. **The autopilot is not a player.** Soak statistics come from a bot with a
   150 ms reaction delay and human-like aim scatter. It is a reasonable proxy
   and the basis for the near-miss tuning, but it is not playtesting.
5. **No gamepad, touch or mobile support**, as scoped out by the PRD.
6. **Bundle is 719 kB raw / 195 kB gzipped**, dominated by Three.js. Within the
   TRD's "reasonably small" guidance but not aggressively optimised; the
   post-processing passes are the obvious code-splitting candidate.
7. **Wide tunnel sections have an unreachable margin.** The reachable box is
   fixed at ±10 so the fairness proof stays independent of the tunnel (ledger
   #13). In the widest sections the walls sit up to ~5 units beyond it. Obstacles
   fill that margin, so it only shows in open air between obstacles.
8. **Procedural music vs PRD Out of Scope.** The PRD lists "procedural music
   generation" as out of scope. The owner directed a procedural synth soundtrack
   anyway (§22); a produced track can replace it by adding `public/soundtrack.mp3`.

---

## 20. Next Improvements

1. Verify frame rate on GPU hardware; the auto-downgrade path is implemented but
   has only been exercised synthetically.
2. Author designed combination sequences rather than sampling members
   independently.
3. Code-split post-processing so the initial payload drops below 150 kB gzipped.
4. Supply a licensed `public/soundtrack.mp3` if a produced track is wanted.
5. Real playtesting to re-tune the near-miss thresholds against human play
   rather than bot play.

---

## 21. Completion Audit (2026-09-24)

An audit of the build against the PRD and TRD. The baseline was green
(typecheck, lint, 147 tests, soak), so the audit targeted behaviour the
documents specify that the code did not deliver.

### Defects fixed

| # | Defect | Fix |
|---|---|---|
| D1 | Main-menu tunnel was frozen. The loop only stepped in `PLAYING`, so the idle drift in `Game.step` never ran in the browser (PRD Screen 1: "slowly moving voxel tunnel"). | `shouldStep` also steps while the engine is `IDLE`, which only advances the drift. |
| D2 | Returning to the menu after a run left the tunnel at the run's distance: an empty void behind the menu, player off-centre, OVERLOAD palette stuck. | `Game.returnToMenu` rebuilds the menu tunnel, re-centres the player and resets difficulty to t = 0. |

### Specification gaps closed

| # | Requirement | Implementation |
|---|---|---|
| G1 | PRD §11 steps 4 and 6: visual distortion on collision, then fade into results | The grading shader carries an impact ripple, channel split, desaturation and hit-stop flash, then a fade that holds behind the results screen. The results screen fades in. `IMPACT.FREEZE_SECONDS` now drives the hit-stop window. |
| G2 | PRD §6/§16/§17, TRD `getDifficulty.tunnelWidth`, TRD Day 8 "Tunnel variation" | `TunnelProfile` keyframes (every 3 segments, eased): width and height variants, rectangular / polygonal / irregular cross-sections, roll up to 14°, four wall patterns, moving light positions. `DifficultyState.tunnelWidth` narrows the tunnel with difficulty. |
| G3 | PRD Screen 5 "Visual intensity"; PRD §17 "minimal effects" in INTRO; DoD "Effects scale with difficulty" | New setting. Bloom and vignette now build with difficulty × setting instead of running at full strength from the first second. |
| G4 | TRD Quality Scaling: Low reduces bloom and effects | Bloom strength and bloom render-target resolution scale per quality level. |

### Requirement gaps (flagged, not guessed)

| # | Gap | Current handling |
|---|---|---|
| R1 (closed in §22) | PRD §29 requires an "electronic/arcade soundtrack", but no asset is supplied and PRD Out of Scope excludes procedural music generation. | Speed-reactive synthesised drone kept. A licensed track is needed to close this. |
| R2 (closed in §22) | PRD §16/§17 say difficulty "continues scaling indefinitely"; PRD §3 caps speed at ~120 u/s. | Unchanged: parameters saturate at 150 s (ledger #11). Needs a product decision on what scales after the cap. |
| R3 (addressed in §22) | PRD §13 "Higher difficulty increases the base reward" gives no curve or magnitude. | Unchanged: per-archetype weights (harder archetypes appear later). A time-based multiplier needs a specified curve. |
| R4 | TRD settings schema vs PRD Screen 5 controls. | Extended additively (ledger #17). |
| R5 | TRD Deployment steps 6–8 (GitHub, Vercel, production-URL QA). | Not performed: the folder is not a git repository and deployment needs the owner's accounts. `npm run build` produces `dist/` ready for Vercel. |
| R6 | TRD Day 1 "Configure ESLint/Prettier". | ESLint only; Prettier is not installed. |
| R7 | 60 FPS at 1080p on reference hardware. | Still unverified; see §19 item 1. |

### Verification

- `npm run typecheck`, `npm run lint`: clean.
- `npm test`: 168 passing across 15 files. New: `tests/tunnel.test.ts`,
  `tests/lifecycle.test.ts`, plus additions to simulation and persistence.
- Tunnel fairness: over 1,000,000 blocks across 25 seeds and every phase, the
  minimum separating-axis clearance from the reachable box is ≥ 0. Each
  archetype is solid across the whole band between the near-miss range and the
  widest wall, at sampled times.
- `npm run soak`: 10/10 five-minute runs, fallback 0.000%, near-miss rate 26%.
- `npm run e2e`: all browser checks pass, with 0 console errors (the new
  shader compiles). New checks cover menu drift, return to menu,
  collision-feedback completion, results fade-in, and the Visual intensity
  control.
- Bundle: 728.6 kB raw / 198.3 kB gzipped.

---

## 22. Release Candidate Polish (2026-09-24)

Owner-directed changes, made on top of §21.

| # | Change | Where |
|---|---|---|
| P1 | **Soundtrack.** A lookahead-scheduled synthwave sequencer: kick, off-beat hats, eighth-note bass and a sixteenth-note arpeggio over Am-F-C-G. Tempo runs from 112 to 158 BPM with forward speed, and layers join as the run speeds up. If the build finds `public/soundtrack.mp3` (checked at build time, so there is never a 404 at runtime), that track fades in instead and falls back to the synth if it fails to load or play. Music starts only on a user gesture; if audio is blocked the game stays silent. | `src/audio/MusicSequencer.ts`, `AudioEngine.ts`, `SoundBank.ts`, `vite.config.ts` |
| P2 | **Overdrive past 150 s.** `overdrive = 1 - exp(-(t - 150) / 150)` adds up to +0.8 rad/s rotation and +2 u/s peak slide, and drives a sub-3 Hz overload colour pulse. Speed stays capped at 120. Obstacles read the same `rotationSpeedFor` / `oscillationPeakSpeedFor` helpers as the curve, so the validator judges exactly what is built. | `DifficultyConfig.ts`, `DifficultyManager.ts`, archetypes, `PostProcessing.ts` |
| P3 | **Survival milestones.** ×1 before 60 s, ×1.5 from 60 s, ×2 from 120 s, ×3 "OVERLOAD SURVIVOR" from 180 s. The multiplier applies to clears, near misses and the survival trickle, and stacks with the combo. It shows on the HUD under the score, and each milestone is announced once. | `ScoreConfig.ts`, `ScoreSystem.ts`, `Game.ts`, `HUD.tsx` |
| P4 | **Git.** Repository initialised; `.gitignore` covers `node_modules/`, `dist/`, `artifacts/`, `.env*`, `.vercel/` and local Claude settings. | `.gitignore` |
| P5 | **Vercel.** `vercel.json`: framework `vite`, `npm ci`, `npm run build`, output `dist`. Hashed `/assets/*` are cached immutably for a year; `index.html` is always revalidated so deploys go live immediately. | `vercel.json` |

### Defect found and fixed during this pass

**Obstacles planned after a combination got ~0.2 s of phantom reaction time.**
The generator recorded a combination's *centre* as the moment the player left
it, but the player leaves at the last layer, which crosses later. The next
obstacle's reach budget therefore assumed time the player did not have. It
predates §21. It surfaced when the soak autopilot was corrected to follow
combinations layer by layer (it had only ever aimed at the first layer). The
proof now reports `exitTCross`, and the generator plans from it. A regression
test pins it.

### Verification

typecheck and lint clean; 180 tests passing across 16 files; soak 10/10
five-minute runs (deep into overdrive), fallback 0.000%, near-miss rate 26.4%;
browser pass clean with 0 console errors; production build succeeds.

