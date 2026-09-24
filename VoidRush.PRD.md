# Product Requirements Document (PRD)

## Project: First-Person Endless Voxel Obstacle Runner

**Working title:** VOIDRUSH
**Document version:** 1.0
**Status:** MVP Specification
**Target:** Desktop Chrome browser
**Development model:** Solo developer + AI/vibe coding
**Target development time:** 7–14 days

---

# 📊 Project Overview

## Product Summary

VOIDRUSH is a browser-based first-person endless obstacle game inspired by the visual language and gameplay principles of high-speed voxel tunnel runners.

The player is a **levitating entity flying continuously through an endless 3D tunnel**. The player does not walk, jump, or manually control forward movement. Instead, the player uses **WASD** to move vertically and horizontally while avoiding static, moving, and rotating obstacles approaching at increasing speeds.

The objective is to survive as long as possible, pass through obstacle gaps, accumulate score, maintain increasingly high combos, perform near misses, and achieve the highest possible run score.

---

## Platform

### MVP

- Desktop Chrome
- Windows/macOS/Linux
- Keyboard controls
- 16:9 primary display
- Responsive browser viewport
- WebGL-capable browser required

### Minimum target resolution

**1280 × 720**

### Recommended resolution

**1920 × 1080**

Mobile is explicitly excluded from MVP.

---

## Technology

The MVP should be implemented as:

- **TypeScript**
- **Three.js**
- **Vite**
- **React** for menus/HUD
- **WebGL**
- **Web Audio API** or lightweight audio library
- CSS for UI

The 3D game loop must remain independent of React rendering.

React should not control the frame-by-frame gameplay loop.

---

# 🎯 Product Vision

Create a browser game that delivers a simple but highly replayable experience:

> **Fly into the tunnel. Read the obstacle. Find the gap. Dodge it. Go faster. Repeat until you crash.**

The game should require:

- Fast visual processing
- Precise WASD control
- Spatial awareness
- Timing
- Risk management

The experience should begin approachable and progressively become visually and mechanically overwhelming.

---

## Product Principles

### 1. Immediate
The player should understand the game within seconds.

### 2. Responsive
WASD movement must respond immediately and predictably.

### 3. Fair
Difficulty can become extreme, but the procedural generator must never intentionally create an impossible path.

### 4. Fast
The game should feel continuously faster as the run progresses.

### 5. Readable
Despite the sensory-heavy presentation, obstacles must remain visually distinguishable.

### 6. Replayable
A completed run should immediately create motivation to restart and beat the previous score.

---

# 👤 Target User

## Primary User

Desktop browser gamers who enjoy:

- Arcade games
- Endless runners
- Precision games
- High-score challenges
- Fast reaction games
- Procedurally generated games
- Psychedelic/abstract visuals

### Expected session length

Typical run: **30 seconds – 5+ minutes**

The game should also support very short sessions where the player immediately crashes and restarts.

---

## User Pain Point / Motivation

The player wants a game that:

- Requires little learning
- Starts immediately
- Provides constant action
- Rewards skill
- Creates a clear "one more run" loop
- Looks visually impressive
- Does not require installation

---

# ✨ Core Features

## 1. First-Person Levitation

The player is represented entirely through the first-person camera.

There is:

- No visible character
- No body
- No weapon
- No walking animation
- No jumping
- No gravity
- No third-person camera

The player continuously flies forward.

---

## 2. WASD Movement

| Input | Movement |
|---|---|
| W | Up |
| S | Down |
| A | Left |
| D | Right |

Diagonal combinations are supported.

Examples:

```
W + D = Up + Right
W + A = Up + Left
S + D = Down + Right
S + A = Down + Left
```

### Movement behavior

Movement must use:

- Acceleration
- Velocity
- Damping
- Maximum movement speed

The player should not teleport.

### Default tuning

Initial values should be configurable:

```
Lateral acceleration: 30 units/s²
Vertical acceleration: 30 units/s²
Maximum lateral speed: 14 units/s
Maximum vertical speed: 14 units/s
Movement damping: 10
```

These values are starting points and should be tuned during playtesting.

---

## 3. Automatic Forward Movement

Forward movement is automatic.

The player cannot manually stop or reverse.

### Starting speed
**30 units/s**

### Maximum intended speed
Approximately **100–120 units/s**

The actual speed should scale continuously according to difficulty.

The world should be implemented using streamed/recycled tunnel segments rather than allowing the player to travel indefinitely through a giant static scene.

---

## 4. Tunnel System

The environment is an effectively infinite 3D tunnel.

Tunnel segments are procedurally generated.

Each segment contains:

- Floor
- Ceiling
- Left wall
- Right wall
- Voxel blocks
- Lighting
- Optional decorations
- Obstacles

### Segment length

Initial target: **30–50 world units**

The system should maintain enough segments ahead of the player to prevent visible generation.

Recommended: **8–12 active segments**

---

## 5. Voxel Environment

Tunnel walls must be constructed from actual geometric blocks rather than relying entirely on a flat brick texture.

Blocks should have:

- Rectangular/cubic geometry
- Slight depth variation
- Slight color variation
- Rough materials
- Ambient occlusion
- Directional lighting

The visual target is **stylized voxel architecture**, not photorealistic architecture.

---

## 6. Procedural Tunnel Variation

The tunnel generator should support:

### Width variation
- Standard
- Wide
- Narrow

### Height variation
- Standard
- Tall
- Narrow

### Cross-section
- Rectangular
- Rounded/polygonal
- Irregular

### Rotation
The tunnel can gradually rotate around the forward axis.

### Visual variation
- Different voxel layouts
- Different light positions
- Different palettes
- Different wall patterns

Changes should happen progressively rather than randomly every frame.

---

## 7. Obstacle System

The game must support three fundamental obstacle categories.

### Static
Obstacles remain fixed relative to their tunnel segment.

Examples: Wall gate, Cross, Ring, Bullseye, Zigzag barrier, Cage

### Moving
Obstacles move along a predefined path.

Examples: Horizontal slider, Vertical slider, Oscillating gate, Expanding ring, Contracting ring

### Rotating
Obstacles rotate around one or more axes.

Examples: Fan, Rotating cross, Rotating cage, Spinning ring

---

## 8. Initial Obstacle Library

MVP should implement at least **8 distinct obstacle archetypes**.

| ID | Name | Description |
|---|---|---|
| O1 | Static Gate | Large wall with a defined opening. |
| O2 | Cross | Four-arm obstacle containing multiple possible gaps. |
| O3 | Ring | Circular obstacle with a central opening. |
| O4 | Bullseye | Multiple concentric obstacle rings. |
| O5 | Fan | Multiple blades rotating around a central axis. |
| O6 | Moving Gate | Opening moves horizontally or vertically. |
| O7 | Cage | Several bars creating multiple openings. |
| O8 | Rotating Cross | Cross-shaped obstacle rotating around its center. |

Additional archetypes can be added after the MVP.

---

## 9. Obstacle Readability

Every obstacle must have a strong silhouette.

Obstacle materials should contrast against the tunnel.

Obstacles should support:

- Solid interior
- Bright outline
- Optional emissive edge

The player should be able to identify:

1. Obstacle location
2. Solid collision areas
3. Available gap

at gameplay speed.

---

## 10. Collision System

The player uses an invisible collision volume.

Recommended initial implementation: **Sphere/capsule approximation**

The collision system checks the player against active obstacle collision geometry.

### Collision condition

A collision occurs when:

```
Player collision volume
INTERSECTS
Obstacle solid geometry
```

### Result

One collision immediately ends the run.

There are:

- No health points
- No lives
- No damage system
- No recovery

---

## 11. Collision Feedback

On collision:

1. Detect collision.
2. Freeze/slow gameplay for approximately **100 ms**.
3. Apply impact camera shake.
4. Apply brief visual distortion.
5. Play impact sound.
6. Fade/transition into results screen.

Target total collision feedback duration: **0.7–1.2 seconds**

The run should not simply disappear instantly.

---

## 12. Successful Obstacle Passage

An obstacle is considered successfully passed when:

1. The player reaches the obstacle's detection plane.
2. The player has not collided.
3. The player crosses the obstacle.
4. The player exits its completion zone.

A successful passage:

- Adds score
- Increments combo
- May trigger a near-miss calculation
- Updates HUD
- Marks the obstacle as completed

Each obstacle can only award completion points once.

---

## 13. Scoring

The initial scoring model:

### Base obstacle score
**+100**

### Difficulty multiplier
Higher difficulty increases the base reward.

### Near miss
**+250 to +1,000** based on minimum distance.

### Combo multiplier
Applied to obstacle and near-miss rewards.

### Example

```
Obstacle passed     +100
Obstacle passed     +100
Obstacle passed     +100
Combo ×2
Obstacle passed     +200
Near miss           +750
Combo ×3
Obstacle passed     +300
```

The exact values should remain configurable.

---

## 14. Combo System

The combo rewards consecutive successful obstacle navigation.

Initial thresholds:

| Successful obstacles | Multiplier |
|---:|---:|
| 0–2 | ×1 |
| 3–5 | ×2 |
| 6–9 | ×3 |
| 10–14 | ×4 |
| 15–19 | ×5 |
| 20+ | ×6 |

Maximum MVP multiplier: **×6**

The system should be architected so the cap can later be increased.

---

## 15. Near-Miss System

A near miss occurs when:

```
Collision = false
AND
minimum player-obstacle distance < configured threshold
```

The closer the player passes, the higher the reward.

Initial tiers:

| Distance | Reward |
|---|---:|
| Safe | 0 |
| Close | +250 |
| Near miss | +500 |
| Extreme | +1,000 |

The HUD should display:

```
NEAR MISS   +500
```

on the right side.

Notifications should stack vertically and automatically disappear after approximately **1.5 seconds**.

Maximum visible notifications: **4**

---

## 16. Difficulty System

Difficulty is continuous rather than stage-based.

The system maintains:

```
difficulty ∈ [0, ∞)
```

Difficulty is primarily driven by survival time.

It controls:

- Forward speed
- Obstacle frequency
- Gap size
- Obstacle movement speed
- Rotation speed
- Number of simultaneous obstacles
- Tunnel width
- Tunnel complexity
- Visual intensity

---

## 17. Difficulty Phases

### Phase 1 — INTRO
**0–20 seconds**

Characteristics:
- Large tunnel
- Low speed
- Static obstacles
- Large gaps
- Minimal visual effects

Purpose: Teach the controls without a tutorial.

### Phase 2 — BUILD
**20–60 seconds**

Introduce:
- Higher speed
- Moving obstacles
- Rotating obstacles
- Smaller openings

### Phase 3 — INTENSE
**60–120 seconds**

Introduce:
- Multiple obstacles
- Faster rotation
- Narrower gaps
- Tunnel variation
- More aggressive visual effects

### Phase 4 — OVERLOAD
**120+ seconds**

Combine:
- High speed
- Complex obstacle patterns
- Multiple moving components
- Narrow passages
- Aggressive visual effects

Difficulty continues scaling indefinitely.

---

## 18. Procedural Generation

The obstacle generator must be **constrained random generation**, not pure randomness.

Every generated obstacle sequence must satisfy:

```
At least one physically achievable path exists.
```

The generator must account for:

- Player collision radius
- Player movement speed
- Player acceleration
- Obstacle speed
- Tunnel dimensions
- Required reaction time

### Generation Pipeline

```
Difficulty
    ↓
Select obstacle archetype
    ↓
Calculate available space
    ↓
Generate valid gap
    ↓
Validate player path
    ↓
Place obstacle
    ↓
Validate collision scenario
    ↓
Spawn
```

Invalid configurations must be discarded and regenerated.

---

## 19. Obstacle Patterns

The generator should eventually create sequences rather than isolated obstacles.

Example:

```
Static Gate
      ↓
Cross
      ↓
Moving Gate
      ↓
Rotating Fan
      ↓
Cage
      ↓
Double Gate
```

Higher difficulty allows combinations.

Example:

```
Rotating Cross
+
Moving Gate
+
Narrow Tunnel
```

However, MVP must prioritize **fairness over maximum complexity**.

---

## 20. Forward Spacing

Obstacles must have sufficient reaction distance.

Initial minimum spacing: **25–35 units**

Spacing should reduce as difficulty increases, but never below a calculated reaction threshold.

The generator should dynamically determine safe spacing based on:

```
player speed
+
movement acceleration
+
obstacle complexity
+
required reaction time
```

---

## 21. Safe Path Guarantee

Every obstacle must have at least one valid traversal path.

Before spawning:

```
Generate obstacle
       ↓
Simulate player movement envelope
       ↓
Check possible passage
       ↓
Valid?
 ↙       ↘
YES      NO
 ↓        ↓
Spawn   Regenerate
```

This is a critical requirement.

---

# 22. Visual Design System

## Design Direction

**High-speed stylized voxel psychedelic arcade aesthetic.**

The environment should feel:

- Dense
- Geometric
- Saturated
- Fast
- Futuristic
- Abstract
- Slightly disorienting
- Arcade-like

---

# 23. Color System

Primary visual palette should be dynamic.

### Palette A — Blue/Yellow
```
Blue      #1769AA
Deep Blue #0B2A4A
Yellow    #F2C230
Orange    #C87816
```

### Palette B — Cyan/White/Red
```
Cyan      #13CFE3
White     #E8E8E8
Red       #E63946
Dark Gray #292D32
```

### Palette C — Red Overload
```
Crimson   #C9182B
Red       #F02D3A
Pink      #FF6B7A
Black     #09090B
```

### Palette D — Purple/Magenta
```
Purple    #7136D9
Magenta   #D629C9
Blue      #3155E7
Dark      #120D20
```

These should be configuration values rather than hardcoded throughout the rendering code.

---

# 24. Materials

**Tunnel blocks:**
- Matte
- Roughness: approximately 0.7–0.9
- Moderate saturation
- Slight procedural color variation

**Obstacles:**
- Higher contrast
- Slight emissive component

**Outlines:**
- Emissive
- Bright
- Strongly contrasting

No photorealistic PBR material system is required for MVP.

---

# 25. Lighting

MVP lighting:

- Ambient light
- Directional light
- Local colored lights
- Ambient occlusion
- Emissive obstacle outlines
- Bloom

Lighting should emphasize tunnel depth.

Avoid excessive dynamic lights because they can damage browser performance.

---

# 26. Post-Processing

### Required
- Bloom
- Vignette
- Dynamic FOV
- Subtle camera tilt
- Screen shake
- Color grading

### Optional if performance permits
- Chromatic aberration
- Motion blur
- Radial speed lines
- Tunnel distortion

Effects must be configurable by quality level.

---

# 27. Dynamic FOV

Base FOV: **75°**

At high speed: **up to approximately 90°**

The FOV should interpolate smoothly based on velocity.

No abrupt FOV changes.

---

# 28. Camera Movement

Camera remains aligned with the forward direction.

The player does not control camera rotation.

Movement can produce subtle:

- Roll
- Position smoothing
- FOV change

Maximum roll: **approximately ±5°**

Camera shake should never prevent obstacle visibility.

---

# 29. Audio

MVP audio should include:

### Background music
Electronic/arcade soundtrack.

### SFX
- Obstacle pass
- Near miss
- Combo increase
- Collision
- UI click
- Game start
- Game over

Audio should increase in intensity as the run becomes faster.

---

# 30. Screen Inventory

## Screen 1 — Main Menu

```
VOIDRUSH

[ PLAY ]

[ SETTINGS ]

[ CREDITS ]
```

Background: Slowly moving voxel tunnel.

## Screen 2 — Gameplay

HUD:

**Top-left**
```
★ 160974
```

**Top-center**
```
×5
1:33
```

**Top-right**
```
⚡ 105 CUBES/S
```

**Right — Event notifications**
```
NEAR MISS +500
NEAR MISS +500
```

**Upper-right**
Pause button.

## Screen 3 — Pause

```
PAUSED

[ RESUME ]
[ RESTART ]
[ MAIN MENU ]
```

## Screen 4 — Game Over

```
RUN OVER

SCORE
160,974

TIME
01:33

BEST
245,812

MAX COMBO
×6

OBSTACLES
87

NEAR MISSES
24

[ RESTART ]
[ MAIN MENU ]
```

## Screen 5 — Settings

**Graphics**
- Quality
- Bloom
- Effects intensity
- FOV

**Gameplay**
- Movement sensitivity
- Camera shake
- Visual intensity

**Audio**
- Master volume
- Music
- SFX

---

# 🔄 Key User Flows

## Flow 1 — Start Game

```
Open website
 ↓
Main Menu
 ↓
Click PLAY
 ↓
Tunnel appears
 ↓
Launch animation
 ↓
Forward movement begins
 ↓
First obstacle appears
 ↓
Gameplay
```

Target time from PLAY to active gameplay: **<2 seconds**

## Flow 2 — Normal Gameplay

```
Player flies forward
 ↓
Obstacle approaches
 ↓
Player identifies gap
 ↓
WASD movement
 ↓
Player enters gap
 ↓
Obstacle passed
 ↓
Score awarded
 ↓
Combo updated
 ↓
Next obstacle
```

## Flow 3 — Near Miss

```
Obstacle approaches
 ↓
Player passes extremely close
 ↓
No collision
 ↓
Near-miss detected
 ↓
Bonus awarded
 ↓
"NEAR MISS +500"
 ↓
Short SFX
 ↓
Continue
```

## Flow 4 — Collision

```
Obstacle approaches
 ↓
Player fails to clear gap
 ↓
Collision
 ↓
Impact effect
 ↓
Run stops
 ↓
Results screen
 ↓
RESTART
 ↓
New run
```

## Flow 5 — Pause

```
Gameplay
 ↓
ESC / Pause button
 ↓
Pause
 ↓
Game simulation stops
 ↓
Resume
 ↓
Simulation continues
```

While paused:

- Physics stops
- Obstacle movement stops
- Timer stops
- Score stops
- Audio pauses/dims

---

# 📊 Success Metrics

Because this is an MVP game rather than a commercial live-service product, success should primarily be measured by **playability and technical quality**.

## Primary

### 1. Playable Run Rate
100% of completed builds must allow:

```
Start → gameplay → collision → results → restart
```

without errors.

### 2. Frame Rate
Target: **60 FPS** on a modern desktop Chrome system at 1080p.

Minimum acceptable during normal gameplay: **45 FPS**

### 3. Input Latency
WASD input should visually respond within approximately **<50 ms** under normal conditions.

### 4. Crash-Free Gameplay
No known critical crashes during **10 consecutive 5-minute runs**.

### 5. Procedural Fairness
100% of generated obstacles in the tested seed set must contain a valid traversal path.

### 6. Replayability
A player should be able to restart a run within **≤3 seconds** after reaching the results screen.

---

# 🚫 Out of Scope

The following are explicitly excluded from MVP:

- Multiplayer
- Online multiplayer
- Accounts
- Authentication
- Cloud saves
- Online leaderboards
- Social system
- Chat
- Friends
- Achievements
- Inventory
- Skins
- Shop
- Currency
- Monetization
- Ads
- Battle pass
- Story/campaign
- Character customization
- Mobile controls
- Controller support
- Level editor
- User-generated levels
- Multiplayer racing
- Online matchmaking
- VR
- Procedural music generation

These can be considered after the core game is stable.

---

# 🎯 Development Phases

## Phase 0 — Project Foundation
**Day 1**

Implement:
- Vite
- TypeScript
- Three.js
- React
- Basic project architecture
- Canvas
- Game loop
- State management
- Configuration system

**Exit condition:** A blank Three.js scene runs correctly in Chrome.

## Phase 1 — Core Flight
**Day 1–2**

Implement:
- First-person camera
- WASD
- Smooth movement
- Automatic forward movement
- Tunnel boundaries
- Pause
- Restart

**Exit condition:** Player can continuously fly through a basic tunnel using WASD.

## Phase 2 — Voxel Environment
**Day 2–4**

Implement:
- Voxel blocks
- Tunnel segments
- Procedural tunnel generation
- Segment recycling
- Lighting
- Materials
- Initial palette

**Exit condition:** Player can fly indefinitely through a visually convincing voxel tunnel.

## Phase 3 — Obstacles
**Day 4–6**

Implement:
- Static gate
- Cross
- Ring
- Bullseye
- Fan
- Moving gate
- Cage
- Rotating cross
- Collision
- Valid gaps
- Obstacle spawning
- Obstacle recycling

**Exit condition:** Player can encounter and successfully navigate multiple obstacle types.

## Phase 4 — Gameplay Systems
**Day 6–8**

Implement:
- Score
- Combo
- Near miss
- Timer
- Speed
- Difficulty progression
- Game over
- Restart

**Exit condition:** The game has a complete gameplay loop.

## Phase 5 — Visual Polish
**Day 8–10**

Implement:
- Bloom
- FOV changes
- Camera tilt
- Camera shake
- Vignette
- Color transitions
- Obstacle outlines
- Additional lighting
- Visual intensity scaling

**Exit condition:** The game visually approaches the target reference style.

## Phase 6 — UI + Audio
**Day 10–11**

Implement:
- Main menu
- HUD
- Pause
- Results
- Settings
- Audio
- SFX
- Music

**Exit condition:** The game is usable without developer tools.

## Phase 7 — Optimization + QA
**Day 11–14**

Test:
- 720p
- 1080p
- Multiple Chrome window sizes
- Long runs
- Rapid restarts
- Collision edge cases
- Procedural generation
- Extreme difficulty

Optimize:
- Draw calls
- Geometry
- Object count
- Lighting
- Post-processing
- Memory
- Garbage collection

---

# 🔐 Privacy & Safety

The MVP does not require personal data.

**No account** — No authentication.

**No server** — Gameplay should run locally in the browser.

**No tracking** — No analytics required for MVP.

**No external user data** — The game does not collect:
- Name
- Email
- Location
- IP address intentionally
- Account information

**Local storage** — Only non-sensitive settings may optionally be stored:

```
audio volume
graphics quality
movement sensitivity
best score
```

No personal information should be stored.

---

# ✅ Definition of Done

The MVP is complete only when **all** conditions below are satisfied.

## Gameplay
- [ ] Game launches in Chrome.
- [ ] Player is first-person.
- [ ] Player levitates.
- [ ] Player automatically moves forward.
- [ ] WASD controls horizontal/vertical movement.
- [ ] Diagonal movement works.
- [ ] Movement feels responsive.
- [ ] Player cannot leave tunnel boundaries.
- [ ] Game can continue indefinitely.

## Environment
- [ ] Tunnel is 3D.
- [ ] Tunnel uses voxel/block geometry.
- [ ] Tunnel segments generate procedurally.
- [ ] Segments recycle correctly.
- [ ] Multiple visual variations exist.
- [ ] Multiple color palettes exist.

## Obstacles
- [ ] At least 8 obstacle archetypes exist.
- [ ] Static obstacles work.
- [ ] Moving obstacles work.
- [ ] Rotating obstacles work.
- [ ] Obstacles have identifiable gaps.
- [ ] Obstacles have collision geometry.
- [ ] Obstacles are recycled.
- [ ] Procedural generation guarantees a valid route.

## Gameplay Systems
- [ ] Collision detection works.
- [ ] Collision ends the run.
- [ ] Successful passages are detected.
- [ ] Score works.
- [ ] Combo works.
- [ ] Near-miss detection works.
- [ ] Near-miss rewards work.
- [ ] Difficulty increases over time.
- [ ] Speed increases over time.
- [ ] Timer works.

## UI
- [ ] Main menu works.
- [ ] HUD works.
- [ ] Score is visible.
- [ ] Speed is visible.
- [ ] Combo is visible.
- [ ] Timer is visible.
- [ ] Near-miss notifications work.
- [ ] Pause works.
- [ ] Game-over screen works.
- [ ] Restart works.
- [ ] Settings work.

## Visuals
- [ ] Voxel aesthetic is present.
- [ ] Saturated palettes work.
- [ ] Obstacle outlines are visible.
- [ ] Lighting creates depth.
- [ ] Bloom works.
- [ ] FOV responds to speed.
- [ ] Camera effects work.
- [ ] Effects scale with difficulty.

## Performance
- [ ] 60 FPS target achieved on reference hardware.
- [ ] No continuous memory growth during long runs.
- [ ] No visible tunnel-generation pop-in.
- [ ] No major frame spikes during obstacle generation.
- [ ] No critical console errors.

## QA
- [ ] 10 consecutive runs completed without application failure.
- [ ] Rapid restart tested.
- [ ] Pause/resume tested.
- [ ] Window resize tested.
- [ ] Collision edge cases tested.
- [ ] Long-duration run tested.
- [ ] High-difficulty generation tested.

---

# 🎨 Design System

## Overall Style

**Stylized voxel + psychedelic arcade + high-speed sci-fi tunnel**

The game should feel visually similar in *design language* to the provided references without copying proprietary assets.

## Typography

Use **Inter** for menus and general UI.

For score/multiplier elements: Use a bold condensed/impact-style display font if available through a properly licensed font.

Fallback: **Arial / system sans-serif**

## HUD Typography

| Element | Size |
|---|---|
| Score | Bold, 32–40 px |
| Speed | Bold, 24–32 px |
| Multiplier | Large, 48–64 px |
| Timer | 20–28 px |
| Event notifications | 16–20 px |

## UI Geometry

Use:

- Sharp rectangular panels
- Slight transparency
- Thin borders
- Strong contrast
- Minimal rounded corners

Avoid modern SaaS-style UI.

This is an **arcade game**, not a productivity application.

## Obstacle Outline

Default: **4–8 px perceived screen-space thickness**

The outline should remain visible at high velocity.

## Tunnel Blocks

Approximate block dimensions: **1–3 world units** with variation.

Blocks should not appear perfectly uniform.

## Camera

Default:

```
FOV: 75°
Near clip: 0.1
Far clip: 500+
```

FOV dynamically increases with speed up to approximately **90°**

## Animation

All movement should use interpolation where appropriate.

Avoid abrupt transitions except for:

- Collision
- Impact
- Certain arcade effects

---

# Final Product Definition

VOIDRUSH is a **desktop Chrome-first, first-person, endless 3D precision runner**.

The player is permanently airborne and automatically propelled through a procedurally generated voxel tunnel. The only direct movement controls are **WASD**, allowing the player to shift up, down, left, and right to pass through gaps in incoming static, moving, and rotating obstacles.

The game is built around five systems:

```
        ┌─────────────────┐
        │   FORWARD SPEED │
        └────────┬────────┘
                 ↓
┌──────────┐  OBSTACLES  ┌───────────┐
│  PLAYER  │ ───────────→ │   GAPS    │
└────┬─────┘              └─────┬─────┘
     │                          │
     ↓                          ↓
 MOVEMENT                  SUCCESS
     │                          │
     └──────────┬───────────────┘
                ↓
        ┌───────────────┐
        │ SCORE / COMBO │
        └───────┬───────┘
                ↓
         HIGHER DIFFICULTY
                ↓
             REPEAT
                ↓
            COLLISION
                ↓
           GAME OVER
```

The architecture should prioritize **a deterministic, modular game engine over a visually impressive but unmaintainable generated prototype**. The first implementation should establish the complete playable loop, then progressively add the reference-quality voxel environment, obstacle variety, visual effects, audio, and polish.