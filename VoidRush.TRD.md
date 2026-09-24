# Technical Requirements Document

## 📊 Document Overview

**Project:** VOIDRUSH

**Product Type:** Desktop browser-based 3D endless precision game.

**Primary Platform:** Google Chrome on desktop

Secondary desktop browsers may be supported if compatibility is effectively free, but Chrome is the acceptance target.

### Core Technology

TypeScript + Three.js + React + Vite + WebGL

### Architecture Principle

```
React Application
       │
       ├── Menus
       ├── HUD
       ├── Settings
       └── Results

Three.js Game Engine
       │
       ├── Game Loop
       ├── Player
       ├── Camera
       ├── Tunnel
       ├── Obstacles
       ├── Collision
       ├── Scoring
       ├── Difficulty
       ├── Effects
       └── Audio
```

React must not execute the frame-by-frame 3D game simulation.

---

## 🏗️ System Architecture

### MVP Architecture

```
                    ┌──────────────────────┐
                    │     Chrome Browser   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    React Application │
                    │                      │
                    │ Menu / HUD / Pause   │
                    │ Settings / Results   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Three.js Engine    │
                    │                      │
                    │ Game Loop             │
                    │ Player                │
                    │ Tunnel                │
                    │ Obstacles             │
                    │ Collision             │
                    │ Scoring               │
                    │ Difficulty            │
                    │ Effects               │
                    └──────────┬───────────┘
                               │
               ┌───────────────┼────────────────┐
               ▼               ▼                ▼
         WebGL Renderer    Web Audio API    localStorage
               │               │                │
               ▼               ▼                ▼
          3D Gameplay       Sound          Score/Settings
```

### No backend in MVP

There is deliberately no:

- API server
- Database
- Authentication
- Cloud storage
- AI API
- Payment provider

This eliminates unnecessary complexity.

---

## 🛠️ Technology Stack

| Component | Technology | Why |
|---|---|---|
| Language | TypeScript | Strong typing and easier AI-assisted maintenance |
| Build | Vite | Fast development and simple deployment |
| UI | React | AI tools handle React extremely well |
| 3D engine | Three.js | Mature WebGL ecosystem and extensive AI knowledge |
| Rendering | WebGL via Three.js | Browser-native GPU rendering |
| Post-processing | three/examples/jsm/postprocessing | Official Three.js ecosystem |
| UI styling | CSS Modules or standard CSS | Minimal dependency overhead |
| Icons | lucide-react | Simple, consistent UI icons |
| Audio | Web Audio API | No mandatory external service |
| Persistence | Browser localStorage | Free and sufficient for MVP |
| UUID/seeds | seedrandom | Deterministic procedural generation |
| Testing | Vitest | Fast TypeScript unit testing |
| E2E | Playwright | Browser-level testing |
| Version control | Git + GitHub | Standard development workflow |
| Deployment | Vercel | Simple static deployment |
| Package manager | npm | Lowest-friction AI tooling compatibility |

### Dependency Rules

The coding agent should not add libraries simply because they make individual tasks easier.

**Approved primary dependencies:**
- three
- react
- react-dom
- seedrandom
- lucide-react

**Development dependencies:**
- vite
- typescript
- vitest
- playwright
- eslint
- prettier

Additional Three.js functionality should preferably use `three/examples/jsm/*` before introducing another external dependency.

---

## 🗄️ Database Schema

There is no database in MVP. Persistence uses browser localStorage.

**Storage Key:** `voidrush-settings`

```json
{
  "quality": "low" | "medium" | "high" | "ultra",
  "masterVolume": "number",
  "musicVolume": "number",
  "sfxVolume": "number",
  "movementSensitivity": "number",
  "cameraShake": "number",
  "effectsIntensity": "number",
  "fov": "number"
}
```

**Storage Key:** `voidrush-stats`

```json
{
  "bestScore": "number",
  "bestTime": "number",
  "bestCombo": "number",
  "bestSpeed": "number",
  "totalRuns": "number",
  "totalObstaclesPassed": "number",
  "totalNearMisses": "number"
}
```

All numeric values must be validated before use. Corrupted localStorage data must automatically fall back to defaults.

---

## 🔌 API Design

There is no network API in MVP. Instead, the application exposes internal service interfaces.

### GameManager

**`startRun()`**
- Purpose: Start a new run.
- Input: None.
- Output: Initializes game state and procedural seed.

**`restartRun()`**
- Purpose: Immediately start a fresh run.
- Input: None.
- Output: Reset game state.

**`pauseGame()`**
- Purpose: Pause simulation.
- Input: None.
- Output: Game state becomes PAUSED.

**`resumeGame()`**
- Purpose: Resume simulation.
- Input: None.
- Output: Game state becomes PLAYING.

### PlayerController

**`updateMovement(deltaTime, inputState)`**
- Purpose: Calculate player movement.
- Input: Delta time, WASD input state
- Output: Updated player position and velocity.

### TunnelManager

**`update(deltaTime, playerPosition)`**
- Purpose: Stream/recycle tunnel segments.
- Input: Delta time, Player position
- Output: Updated active tunnel.

### ObstacleManager

**`spawnObstacle(config)`**
- Purpose: Create a validated obstacle.
- Input: Obstacle configuration.
- Output: Obstacle instance.

**`update(deltaTime)`**
- Purpose: Update moving/rotating obstacles.
- Output: Updated obstacle transforms.

**`removePassedObstacles()`**
- Purpose: Recycle obstacles behind the player.

### CollisionSystem

**`checkCollisions(player, obstacles)`**
- Purpose: Determine whether player intersects solid geometry.
- Output: Collision result.

### NearMissSystem

**`evaluateNearMiss(player, obstacle)`**
- Purpose: Calculate minimum distance between player and obstacle during traversal.
- Output: Near-miss tier and score.

### ScoreSystem

**`registerObstaclePass()`**
- Updates: Score, Combo, Multiplier

**`registerNearMiss(distance)`**
- Updates: Score, Near-miss counter

### DifficultyManager

**`getDifficulty(elapsedTime)`**
- Output:

```json
{
  "speed": "",
  "obstacleFrequency": "",
  "gapSize": "",
  "movementSpeed": "",
  "rotationSpeed": "",
  "tunnelWidth": "",
  "visualIntensity": ""
}
```

---

## 🔒 Security & Rate Limiting

Because MVP is completely client-side, traditional API security is unnecessary.

### Client security requirements

The application must:

- Validate localStorage data.
- Never execute localStorage values as code.
- Never use eval.
- Never dynamically execute arbitrary strings.
- Avoid unnecessary third-party scripts.
- Avoid collecting user data.

### Future leaderboard protection

If online leaderboards are added later, scores must not be trusted directly from the client.

A future server should validate:

- Run seed
- Run duration
- Obstacles generated
- Player movement
- Collision state
- Score calculation

---

## 🤖 AI Integration

### MVP

No AI API is required at runtime.

The AI is used exclusively during development through:

- Claude Code
- Cursor
- Other coding agents

The deployed game does not depend on OpenAI, Anthropic, or another AI provider.

This provides:

- $0 runtime AI cost
- Offline gameplay
- No API keys
- No rate limits
- No AI service outage risk

---

## 🚀 Deployment Strategy

**Step 1 — Repository**
Create a GitHub repository: `voidrush`

**Step 2 — Local Project**
Initialize: Vite, TypeScript, React, Three.js

**Step 3 — Development**
Run locally through Vite. Primary development URL: `localhost:5173`

**Step 4 — Production Build**
Run `npm run build`. The build must complete with zero TypeScript errors.

**Step 5 — Preview**
Run the production build locally. Verify:
- Game starts
- Assets load
- No console errors
- Game loop works
- localStorage works
- Audio works
- Resize works

**Step 6 — GitHub**
Push production-ready code.

**Step 7 — Vercel**
Connect GitHub repository to Vercel.
- Build command: `npm run build`
- Output directory: `dist`

**Step 8 — Production QA**
Test the deployed URL in:
- Chrome 1280×720
- Chrome 1920×1080
- Window resize
- Fullscreen
- Long run
- Restart
- Pause
- High difficulty

---

## 📊 Performance Requirements

### Frame Rate
- Target: 60 FPS
- Minimum acceptable: 45 FPS during normal gameplay.

### Frame Time
- Target: ≤16.67 ms/frame (60 FPS equivalent)
- Warning threshold: >22 ms/frame

### Initial Load
- Target: <3 seconds on a normal broadband connection.
- The initial JavaScript payload should be kept reasonably small and compressed by Vercel.

### Memory

The game must recycle:
- Tunnel segments
- Obstacles
- Temporary effects
- Event notifications

No continuously growing object arrays.

### Rendering

Use:
- InstancedMesh for repeated voxel blocks where appropriate.
- Shared geometries.
- Shared materials.
- Object pooling.
- Frustum culling.
- Limited dynamic lights.

Do not create a new geometry/material for every block.

### Active World

Recommended initial configuration:
- 8–12 tunnel segments
- 10–30 active obstacles

depending on difficulty.

### Quality Scaling

**Low**
- Reduced voxel density
- Reduced lights
- Reduced bloom
- Reduced effects
- Lower shadow quality

**Medium** — Default.

**High** — Higher voxel density and effects.

**Ultra** — Maximum supported visual quality.

Gameplay mechanics must remain identical across quality levels.

---

## 💰 Cost Estimate

### MVP Development

| Service | Cost |
|---|---|
| GitHub | $0 |
| Vercel | $0 |
| Three.js | $0 |
| React | $0 |
| Vite | $0 |
| TypeScript | $0 |
| Web Audio API | $0 |
| localStorage | $0 |
| WebGL | $0 |
| **Total infrastructure** | **$0/month** |

### 100 Users
Expected infrastructure: $0/month

### 1,000 Users
Expected: $0/month, assuming normal static-game traffic remains within Vercel's free-tier limits.

### 10,000 Users
Potentially still $0–low cost, depending primarily on:
- Bandwidth
- Game bundle size
- Asset size
- Traffic concentration

At this point, measure actual Vercel bandwidth usage before adding infrastructure.

### Cost Optimization Rule

Do not introduce:
- Supabase
- Firebase
- AWS
- Cloudflare Workers
- Database
- Backend server

until a real product requirement requires one.

---

## 📁 Recommended Project Architecture

```
src/
│
├── app/
│   ├── App.tsx
│   └── AppState.ts
│
├── game/
│   ├── Game.ts
│   ├── GameLoop.ts
│   ├── GameState.ts
│   │
│   ├── player/
│   │   ├── Player.ts
│   │   ├── PlayerController.ts
│   │   └── PlayerBounds.ts
│   │
│   ├── camera/
│   │   └── CameraController.ts
│   │
│   ├── tunnel/
│   │   ├── TunnelManager.ts
│   │   ├── TunnelSegment.ts
│   │   ├── TunnelGenerator.ts
│   │   └── VoxelGenerator.ts
│   │
│   ├── obstacles/
│   │   ├── Obstacle.ts
│   │   ├── ObstacleManager.ts
│   │   ├── ObstacleFactory.ts
│   │   ├── StaticObstacle.ts
│   │   ├── MovingObstacle.ts
│   │   └── RotatingObstacle.ts
│   │
│   ├── collision/
│   │   ├── CollisionSystem.ts
│   │   └── NearMissSystem.ts
│   │
│   ├── scoring/
│   │   ├── ScoreSystem.ts
│   │   └── ComboSystem.ts
│   │
│   ├── difficulty/
│   │   └── DifficultyManager.ts
│   │
│   ├── effects/
│   │   ├── EffectsManager.ts
│   │   ├── CameraEffects.ts
│   │   └── PostProcessing.ts
│   │
│   └── audio/
│       └── AudioManager.ts
│
├── rendering/
│   ├── Renderer.ts
│   ├── Lighting.ts
│   ├── Materials.ts
│   └── Palettes.ts
│
├── ui/
│   ├── MainMenu.tsx
│   ├── HUD.tsx
│   ├── PauseMenu.tsx
│   ├── ResultsScreen.tsx
│   └── Settings.tsx
│
├── persistence/
│   ├── SettingsStore.ts
│   └── StatsStore.ts
│
├── config/
│   ├── GameConfig.ts
│   ├── ObstacleConfig.ts
│   └── DifficultyConfig.ts
│
└── main.tsx
```

---

## 📋 Development Checklist

### Day 1 — Foundation
- [ ] Create Vite + React + TypeScript project.
- [ ] Install Three.js.
- [ ] Configure ESLint/Prettier.
- [ ] Establish folder architecture.
- [ ] Create game state machine.
- [ ] Create Three.js renderer.
- [ ] Create basic camera.
- [ ] Establish fixed timestep/game loop.
- [ ] Verify Chrome rendering.

**Milestone:** Empty game engine runs correctly.

### Day 2 — Player
- [ ] First-person camera.
- [ ] WASD input manager.
- [ ] Smooth movement.
- [ ] Player boundaries.
- [ ] Automatic forward velocity.
- [ ] Camera smoothing.
- [ ] Basic speed system.

**Milestone:** Player flies through a basic tunnel.

### Day 3 — Tunnel
- [ ] Tunnel segment abstraction.
- [ ] Procedural voxel walls.
- [ ] Shared block geometries.
- [ ] Materials.
- [ ] Lighting.
- [ ] Segment streaming.
- [ ] Segment recycling.

**Milestone:** Infinite voxel tunnel.

### Day 4 — First Obstacles

Implement:
- [ ] Static gate.
- [ ] Cross.
- [ ] Ring.
- [ ] Collision volumes.
- [ ] Obstacle spawning.
- [ ] Obstacle recycling.

**Milestone:** Player can avoid actual obstacles.

### Day 5 — Advanced Obstacles

Implement:
- [ ] Bullseye.
- [ ] Fan.
- [ ] Moving gate.
- [ ] Cage.
- [ ] Rotating cross.
- [ ] Movement animations.
- [ ] Rotation systems.

**Milestone:** Complete initial obstacle library.

### Day 6 — Collision + Fair Generation
- [ ] Collision system.
- [ ] Passage detection.
- [ ] Near-miss detection.
- [ ] Valid-path generation.
- [ ] Obstacle spacing.
- [ ] Procedural seed.
- [ ] Edge-case handling.

**Milestone:** Fair playable endless run.

### Day 7 — Scoring
- [ ] Score system.
- [ ] Combo system.
- [ ] Multiplier.
- [ ] Near-miss rewards.
- [ ] Timer.
- [ ] Speed scoring.
- [ ] Local best score.

**Milestone:** Complete gameplay loop.

### Day 8 — Difficulty
- [ ] Difficulty curve.
- [ ] Speed scaling.
- [ ] Obstacle frequency scaling.
- [ ] Gap scaling.
- [ ] Rotation scaling.
- [ ] Movement scaling.
- [ ] Tunnel variation.

**Milestone:** Game becomes progressively harder.

### Day 9 — Visual System
- [ ] Multiple palettes.
- [ ] Emissive outlines.
- [ ] Bloom.
- [ ] Vignette.
- [ ] Dynamic FOV.
- [ ] Camera tilt.
- [ ] Camera shake.
- [ ] Color transitions.

**Milestone:** Target visual identity achieved.

### Day 10 — UI
- [ ] Main menu.
- [ ] HUD.
- [ ] Pause.
- [ ] Results.
- [ ] Settings.
- [ ] Restart.
- [ ] Local persistence.

**Milestone:** Fully usable game.

### Day 11 — Audio
- [ ] Music.
- [ ] Start sound.
- [ ] Obstacle pass.
- [ ] Near miss.
- [ ] Combo.
- [ ] Collision.
- [ ] Volume settings.

**Milestone:** Complete audiovisual experience.

### Day 12 — Optimization
- [ ] Profile FPS.
- [ ] Reduce draw calls.
- [ ] Implement object pooling.
- [ ] Optimize voxel generation.
- [ ] Optimize obstacle generation.
- [ ] Optimize post-processing.
- [ ] Add quality levels.

### Day 13 — QA

Test:
- [ ] Start.
- [ ] Pause.
- [ ] Resume.
- [ ] Restart.
- [ ] Collision.
- [ ] Near miss.
- [ ] Combo.
- [ ] Long run.
- [ ] Extreme difficulty.
- [ ] Window resize.
- [ ] localStorage corruption.
- [ ] Audio permissions.
- [ ] Multiple resolutions.

### Day 14 — Production
- [ ] Remove debug UI.
- [ ] Remove console logs.
- [ ] Fix TypeScript errors.
- [ ] Run production build.
- [ ] Test production build.
- [ ] Push GitHub.
- [ ] Deploy Vercel.
- [ ] Test production URL.
- [ ] Final performance pass.

---

## 🎯 Technical Success Criteria

The project is technically complete when:

### Architecture
- [ ] TypeScript has no compilation errors.
- [ ] Game loop is independent from React.
- [ ] Game systems are modular.
- [ ] Configuration values are centralized.
- [ ] No giant monolithic component exists.
- [ ] No unnecessary backend exists.

### Gameplay
- [ ] WASD movement is responsive.
- [ ] Automatic forward movement works.
- [ ] Infinite tunnel streaming works.
- [ ] Obstacles generate indefinitely.
- [ ] Static/moving/rotating obstacles work.
- [ ] Collision is deterministic.
- [ ] Near-miss detection works.
- [ ] Score/combo systems work.
- [ ] Difficulty scales indefinitely.
- [ ] Procedural generation produces valid paths.

### Rendering
- [ ] Voxel visual system works.
- [ ] Dynamic palettes work.
- [ ] Lighting works.
- [ ] Obstacle outlines work.
- [ ] Post-processing works.
- [ ] Camera effects work.

### Performance
- [ ] 60 FPS target at 1080p on reference desktop.
- [ ] Never continuously accumulates tunnel objects.
- [ ] No significant memory leak during 10-minute run.
- [ ] No visible procedural generation pop-in.
- [ ] Quality settings correctly reduce rendering cost.

### UX
- [ ] Game starts within 2 seconds after Play.
- [ ] Restart takes ≤3 seconds.
- [ ] Pause freezes simulation.
- [ ] Results accurately display run statistics.
- [ ] Settings persist.
- [ ] Best score persists.

### Deployment
- [ ] Production build succeeds.
- [ ] Vercel deployment succeeds.
- [ ] HTTPS works.
- [ ] Chrome loads without critical console errors.
- [ ] Game works directly from the production URL.

---

## Architectural Decision Summary

The most important decision is to keep the MVP entirely client-side.

```
                    VOIDRUSH
                       │
             ┌─────────┴─────────┐
             │                   │
         React UI           Three.js
             │                   │
       Menus / HUD          Game Engine
             │                   │
             │        ┌──────────┼──────────┐
             │        │          │          │
             │      Player    Tunnel    Obstacles
             │                   │          │
             │                   └────┬─────┘
             │                        │
             │                 Collision/Score
             │                        │
             └──────────┬─────────────┘
                        │
                   localStorage
```

No Firebase. No Supabase. No API. No authentication. No database. No AI runtime dependency.

That is the lowest-complexity architecture capable of delivering the PRD's actual MVP within the 1–2 week constraint. It also gives the vibe-coding agent a clean boundary: React manages application UI; Three.js manages the game; localStorage manages persistence.