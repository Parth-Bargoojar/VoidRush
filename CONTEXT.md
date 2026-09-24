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
| Tests | 272 passing across 19 files (as of §23) |
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
5. **No gamepad support.** Touch and tilt steering on phones and tablets were
   added after the MVP at the owner's direction (touch joystick, then tilt in
   §23), beyond the PRD's desktop-only scope.
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

---

## 23. Mobile & Tablet Tilt Controls (2026-09-24)

Owner-directed upgrade: phones and tablets steer by tilting the device, and the
keyboard is unchanged. This extends the existing input path; it does not add a
second movement system.

### Input architecture

```
InputManager (src/game/InputManager.ts)
├── keyboard           held keys → up/down/left/right booleans (unchanged)
├── touch joystick     setAxis(x, y)                (unchanged, now a fallback)
└── tilt               AnalogSource, polled once per fixed step
      GyroscopeInput (src/input/GyroscopeInput.ts)
        ├── capability detection   DeviceOrientationEvent present?
        ├── permission             iOS requestPermission, from a tap only
        ├── orientation mapping    screen.orientation.angle / window.orientation
        ├── calibration            averaged neutral pose, memory only
        ├── dead zone · sensitivity · response curve     (src/input/tilt.ts)
        ├── smoothing              in update(dt), not in the event
        └── timeout / probe        lost after 500 ms, unavailable after 1.5 s
                    ↓
InputState { up, down, left, right, axisX, axisY }
                    ↓
readSteering → NormalizedInput { horizontal, vertical } ∈ [-1, 1], |v| ≤ 1
                    ↓
stepPlayer (src/game/Player.ts): the one movement model, same physics for all sources
```

- **Sensor events only record state.** `handleReading` turns each valid
  reading into a target axis and stores it in preallocated fields. No
  allocation, no movement, no React.
- **The game loop consumes it.** `VoidrushApp.safeStep` calls
  `InputManager.update(dt)` before `Game.step`. That advances tilt smoothing with
  the fixed step's dt, checks for a silent sensor, and folds tilt into
  `axisX/axisY`.
- **React sees control state only on events.** `ControlInfo` (active source,
  tilt status, calibrated) is pushed through `AppListener.onControlChange`
  when it changes, never per frame or per sensor event.
- **One normalisation point.** `readSteering` is the existing `stepPlayer`
  direction logic, extracted unchanged. Keys give a unit direction (diagonals
  × 1/√2), analog sources add to it, and the sum is clamped to unit length.

### Processing pipeline

```
beta, gamma (alpha unused)
→ up vector in device frame: (-cos β sin γ, sin β, cos β cos γ)
→ rotate into screen frame by the screen angle (0 / 90 / 180 / 270)
→ roll  = asin(-up.x)          right edge lowered = +
  pitch = atan2(up.y, up.z)    0 flat, 90 upright
→ minus calibrated neutral
→ dead zone → sensitivity → response curve (per axis)
→ inversion
→ smoothing (first-order low-pass, τ 35 ms) in the game loop
→ clamp to [-1, 1] → InputManager
```

All tuning lives in `src/config/TiltConfig.ts`:

| Constant | Value | Notes |
|---|---|---|
| Dead zone | 2° (setting, 0–8°) | Rescaled past the edge, so leaving it never jumps |
| Maximum effective tilt | 22° | Divided by sensitivity: 11° at 2× |
| Sensitivity | 1.0 (setting, 0.5–2) | |
| Response exponent | 1.35 | Precise near neutral, full with a deliberate lean |
| Smoothing τ | 0.035 s | >90% of a step change within 100 ms; the player's own 0.1 s damping follows |
| Sensor timeout | 500 ms | Status `lost`; output eases to zero; a tilt run pauses |
| Probe timeout | 1.5 s | No reading ever: status `unavailable` (desktop browsers expose the API with no sensor) |
| Calibration | 0.7 s settle + 3·2·1 at 0.35 s | Samples averaged across the countdown (~1 s) |
| Calibration steadiness | ≤ 7° spread | Up to 2 retries ("HOLD STEADY"), then accepted anyway |

### Mobile flow

- **Auto** (default) resolves to tilt on a touch-primary device (`pointer:
  coarse`, or touch with no hover: feature detection, no user-agent sniffing)
  that has not refused or failed tilt; otherwise the keyboard, plus the joystick
  on touchscreens. **Tilt** forces tilt where usable; **Keyboard** never uses it.
- **Permission.** Android and other permission-free platforms start listening
  at load, which probes for a real sensor. iOS/iPadOS shows status
  `needs-permission` and `requestPermission()` is called synchronously from the
  PLAY, Resume, Restart or ENABLE TILT tap, before fullscreen is requested
  (fullscreen can consume the gesture). Never on page load.
- **Calibration** runs before the first tilt run, and again after any quarter
  turn of the screen. The overlay reads CALIBRATE TILT / Hold your device in
  your normal playing position / KEEP STILL / 3 · 2 · 1 / READY.
- **Rotation mid-run** pauses the run, remaps axes immediately and discards the
  neutral pose; the pause menu says so, and Resume recalibrates (the countdown
  doubles as a get-ready) then resumes.
- **Recalibrate** from the pause menu or Settings → Controls.
- **Fallbacks.** Denied, unsupported or silent sensors switch to the joystick
  and the menu says why. A signal lost mid-run pauses with "Use touch
  controls" as a way out. Settings offers Enable / Retry tilt.
- **Portrait** is no longer blocked. The previous full-screen rotate gate is now
  a dismissible ROTATE DEVICE / FOR BEST EXPERIENCE card. PLAY only locks
  landscape when the device is already sideways.
- **Pause** stays reachable through the existing HUD ❚❚ button, top right,
  safe-area inset and outside the flight path.
- **Viewport.** `#root` uses `100dvh` where supported. The canvas also resizes
  on `visualViewport` resize (mobile toolbars). During a run
  `body[data-state='PLAYING']` and the canvas use `touch-action: none`, while
  menus keep `manipulation` so their panels scroll.

### Settings

New fields in `voidrush-settings`: `controlMode` (`auto` | `keyboard` |
`tilt`), `tiltSensitivity`, `tiltDeadZone`, `tiltInvertX`, `tiltInvertY`.
Payloads now carry `version: 2`. `migrateSettings` upgrades unversioned (v1)
payloads. Every existing preference is kept, and a v1 player who had forced the
joystick **on** gets `controlMode: 'keyboard'`, so they keep the touch steering
they chose instead of being switched to tilt by the new Auto default. The
neutral pose is never persisted.

### Implementation decisions

| # | Decision | Why |
|---|---|---|
| T1 | Roll/pitch from the gravity vector, not raw beta/gamma | In landscape, gamma wraps at ±90° right where a phone is held upright sideways. The vector form has no seam (tested across the wrap). |
| T2 | Tilt the top edge away → climb; *Invert vertical* gives flight-stick style | "Lower an edge to fly toward it" is consistent across both axes. The brief did not specify a direction. |
| T3 | Per-axis dead zone and curve | Holding a pure horizontal line should not leak vertical drift. |
| T4 | Smoothing in the fixed step, not the event | Frame-rate independent, deterministic, and it keeps movement inside the game loop as required. |
| T5 | Sensor loss pauses a tilt run | Carrying on would leave the ship unsteerable and kill the player for a hardware hiccup. |
| T6 | Tilt hides the joystick unless forced on | Touch is for menus and pause in tilt mode. `touchControls: on` still shows it; inputs sum and clamp. |
| T7 | Keyboard is always live | A tablet with a keyboard case steers either way; the sum is clamped. |
| T8 | Hard rotate gate replaced by a hint | The brief makes orientation lock non-mandatory. Portrait plays. |
| T9 | Resume after rotation needs a tap | Calibrating while the player is still re-gripping would record the wrong neutral pose. |

### Files

- **New:** `src/config/TiltConfig.ts`, `src/input/tilt.ts`,
  `src/input/GyroscopeInput.ts`, `src/input/ControlMode.ts`,
  `src/ui/CalibrationOverlay.tsx`, `tests/tilt.test.ts`,
  `tests/controls.test.ts`, `scripts/mobile-qa.ts` (`npm run e2e:mobile`).
- **Changed:** `src/game/InputManager.ts` (analog composition, `update(dt)`),
  `src/game/Player.ts` (`readSteering` extracted), `src/app/AppState.ts`
  (tilt ownership, control resolution, permission, calibration, orientation /
  loss handling, diagnostics), `src/App.tsx` (launch flow, calibration
  overlay, portrait hint, gameplay touch lock), `src/types/index.ts`,
  `src/persistence/SettingsStorage.ts`, `src/ui/SettingsMenu.tsx`,
  `src/ui/PauseMenu.tsx`, `src/ui/MainMenu.tsx`, `src/ui/device.ts`,
  `src/ui/RotateGate.tsx` → `src/ui/RotateHint.tsx`, `src/ui/ui.css`,
  `src/index.css`, `README.md`, `package.json`.

### Verification

- `tsc --noEmit` and `eslint .` are clean.
- `npm test`: 272 passing across 19 files (69 new). The new tests cover
  calibration, dead zone, sensitivity, response curve, inversion, clamping,
  portrait / landscape-left / landscape-right / upside-down mapping, the ±90°
  seam, null and invalid readings, sensor timeout and no-sensor probing,
  permission granted / denied / rejected / thrown, listener hygiene, rotation,
  control-mode selection and settings migration.
- **WASD unchanged:** every key combination normalises exactly as before, and
  6,000 fixed steps of mixed key input produce bit-identical player state
  against a verbatim copy of the previous `stepPlayer`. Soak statistics match
  §22 exactly (near-miss 26.4%, fallback 0.000%).
- `npm run e2e` (desktop): all checks pass, 0 console errors.
- `npm run e2e:mobile`: 61 checks pass, 0 console errors, in headless Chromium
  emulating a touch phone with synthetic `deviceorientation` events and a
  stubbed iOS permission API. Covered: no prompt on load; one prompt on PLAY;
  calibration overlay and countdown; steering in all four directions;
  touch pause; recalibration from pause; rotation pause, remap, recalibrate
  and resume with landscape-right steering; sensor loss pause and touch
  fallback; denied and no-sensor fallbacks; settings persistence; portrait
  hint and portrait play.
- `npm run build` succeeds (app chunk 163.5 kB raw / 49.5 kB gzip).

### Physical-device testing still required

No real phone or tablet was available. Everything above ran against
emulation and synthetic sensor events, which prove the logic, not the feel.
Still to do on hardware:

1. **iPhone and iPad (Safari, iOS/iPadOS 13+):** the real motion prompt from
   PLAY; behaviour after denying (Safari may keep answering "denied" until the
   tab or app restarts); `window.orientation` on older iOS.
2. **Android Chrome, plus at least one other Android browser:** real sensor
   rates, the landscape lock, and whether any device reports readings only
   after a delay longer than the 1.5 s probe.
3. **Feel tuning:** dead zone, 22° max tilt, exponent 1.35 and τ 35 ms were
   chosen from first principles. Confirm they suit real hands, and re-check
   the near-miss band with tilt, since it was tuned against keyboard-like bot
   input.
4. **Axis signs on real hardware** in both landscape directions (the maths is
   tested, but some older Android WebViews report non-standard angles).
5. **Frame rate with tilt active** on mid-range phones. The event handler
   allocates nothing and React is not involved, but nothing has been measured
   on device.

---

## 24. Progressive Web App (2026-09-24)

VOIDRUSH is now an installable PWA. The website is unchanged for visitors who
do not install it. The PWA layer wraps the app and never touches the engine,
the render loop or input.

### Stack

- **`vite-plugin-pwa` 1.3.0** (devDependency, `generateSW` mode, Workbox 7.4).
  Configured in `vite.config.ts`. It is the only dependency added.
- The service worker is **production-only** (`devOptions.enabled: false`, and
  registration is guarded by `import.meta.env.PROD`). `npm run dev` never
  registers a worker, so localhost is never controlled by a stale cache.
  Test with `npm run build && npm run preview`.

### Manifest (generated to `dist/manifest.webmanifest`)

- `name`/`short_name`: VOIDRUSH. `display`: standalone. `orientation`: landscape.
- `start_url`, `scope` and `id` are `./`, which is relative to the manifest,
  so they resolve to `/` on the root Vercel deploy and stay correct under a
  sub-path (the build uses `base: './'`).
- `theme_color`/`background_color`: `#080a0f` (Design.md `--color-bg`).
- Icons: PNG 192/512 `any`, PNG 192/512 `maskable`, SVG `any`.
- The old hand-written `public/manifest.webmanifest` was removed. It used
  `display: fullscreen` and a single SVG icon that Android and iOS cannot use
  as a launcher icon.

### Icons

- Sources: `public/icon.svg` (the existing brand mark, unchanged) and
  `public/icon-maskable.svg` (the same art scaled to 0.7, so its corners sit
  inside the 40%-radius maskable safe circle).
- `public/icons/`: `icon-192.png`, `icon-512.png`, `icon-maskable-192.png`,
  `icon-maskable-512.png`, `apple-touch-icon-180.png` (uses the safe-zone
  art, because iOS rounds the corners), `favicon-32.png`.
- Regenerate with `npm run icons` (`scripts/generate-icons.ts`, which
  rasterises through the Playwright Chromium already in devDependencies, so
  no image library is needed).

### Caching

- **Precache** (revisioned, atomic per deploy): every build JS/CSS chunk,
  `index.html`, the manifest, icons and `robots.txt`. That is about 27
  entries and 815 KiB. The game has no other assets: fonts are a local system
  stack and all sound is synthesised.
- **Runtime `CacheFirst` `voidrush-audio`**: only the optional
  `public/soundtrack.mp3` (and other same-origin audio). It plays through
  `<audio>`, which uses range requests, so it is cached on first play and
  served with `rangeRequests`. Only 200 responses are cached, with at most 4
  entries and a 30-day expiry.
- **Navigation fallback**: `index.html` for the app URL with any query
  (`/`, `/index.html`, `/?seed=…`). Other paths are not app pages; with
  relative asset URLs the shell could not load there, and online they 404.
- Nothing cross-origin is cached. The game makes no external requests.
- `cleanupOutdatedCaches` removes caches from earlier Workbox versions.
  Hashed chunks from old deploys drop out of the precache when the new
  worker activates.
- `vercel.json`: `sw.js`, `workbox-*.js`, `manifest.webmanifest` and `/`
  are served `max-age=0, must-revalidate`. Hashed `/assets/*` stay immutable.

### Updates

- `registerType: 'prompt'`, `skipWaiting: false`, `clientsClaim: false`. A
  new deploy installs in the background and waits.
- The page checks for updates hourly and whenever the tab becomes visible,
  but only while online.
- The `UPDATE AVAILABLE` banner (`src/pwa/UpdateBanner.tsx`) renders only on
  MENU, PAUSED and GAME_OVER, never during PLAYING or calibration. On pause,
  it warns that updating ends the run. "Later" hides it for the session.
- UPDATE sends SKIP_WAITING and reloads **once**, on `controlling`. The QA
  script verified exactly one navigation.

### Install

- `src/pwa/pwa.ts` captures `beforeinstallprompt` before React mounts
  (`initPwa()` in `main.tsx`). This suppresses Chromium's mini-infobar. It
  also tracks `appinstalled` and `display-mode: standalone`.
- `src/pwa/InstallAction.tsx`: a small dashed "Install VOIDRUSH" button under
  the main-menu actions. It shows only when Chromium has offered a prompt or
  when running on iOS/iPadOS (iPadOS detected as a Mac with touch), and never
  when already installed. It never pops up unprompted.
- iOS/iPadOS has no programmatic install. Tapping the button opens a short
  Share → Add to Home Screen guide in the existing `Modal`.
- Apple meta tags (`apple-mobile-web-app-capable`, `black-translucent` status
  bar, title) were already present. The apple-touch-icon is now a 180 px PNG.

### Rendering and runtime

- React subscribes to the PWA store with `useSyncExternalStore`, and it
  changes only on SW or install events. There is no polling and nothing in
  the render loop.
- An inline `<style>` in `index.html` paints `#080a0f` before the stylesheet
  loads, so an installed launch never flashes white. The existing `.boot`
  "INITIALIZING..." surface is unchanged.
- The existing `100dvh`, safe-area variables, resize handling, rotate hint,
  fullscreen/landscape lock and gyroscope permission flow (motion access is
  requested only from PLAY) were already PWA-ready and are unchanged.
  Persistence (`voidrush-settings`, `voidrush-stats` in localStorage) is
  unchanged. An installed app shares its origin's storage on Android and
  desktop. iOS home-screen apps get their own storage, separate from Safari.

### Files

- New: `src/pwa/pwa.ts`, `src/pwa/UpdateBanner.tsx`,
  `src/pwa/InstallAction.tsx`, `public/icon-maskable.svg`, `public/icons/*`,
  `scripts/generate-icons.ts`, `scripts/pwa-qa.ts`.
- Modified: `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`,
  `src/ui/MainMenu.tsx`, `src/ui/ui.css`, `src/globals.d.ts`, `vercel.json`,
  `package.json` (scripts `icons`, `e2e:pwa`).
- Removed: `public/manifest.webmanifest`, which the plugin now generates.

### Verification

- `npm run e2e:pwa` passed **42/42** against `vite preview` in headless
  Chromium: manifest fields; icon files and pixel sizes; Chromium's own CDP
  `Page.getInstallabilityErrors` (none); SW activation; precache contents;
  control after reload; offline relaunch and offline query-URL launch;
  settings persisting across offline relaunch; an offline run with WASD and
  Esc pause; a simulated redeploy (`sw.js` changed) that waits, shows no
  banner during the run, shows the banner on pause, and reloads exactly once
  into the new worker; canvas resize; no install button without a prompt;
  the iOS install action and guide; portrait boot and rotate hint; zero
  console errors.
- `npm test` (272), `npm run lint`, `npm run build`, `browser-qa` and
  `mobile-qa` (the gyroscope flows) all pass unchanged.
- Not run: Lighthouse, whose PWA category was removed in Lighthouse 12. The
  CDP installability check was used instead.

### Physical-device testing still required

None of this was tested on a real device. It all ran in emulation.

- **Android Chrome:** install prompt; home-screen icon (maskable crop);
  standalone launch; landscape; gyroscope; offline launch; persistence;
  update banner.
- **iPhone Safari:** Add to Home Screen; icon; standalone launch and status
  bar; landscape; the motion permission from PLAY inside the home-screen app;
  offline launch; persistence (separate from Safari).
- **iPad:** the same as iPhone, plus iPadOS desktop-UA detection of the
  install guide.
- **Desktop Chrome/Edge:** install from the menu button or the address bar;
  standalone window; WASD; resize; offline launch; update.
