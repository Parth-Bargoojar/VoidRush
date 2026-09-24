# 🎨 Design System & UI/UX Specification

# VOIDRUSH — Design.md

**Version:** 1.0
**Status:** MVP Design Specification
**Platform:** Desktop Web / Chrome
**Design source of truth:** VOIDRUSH PRD + provided gameplay references
**Primary implementation:** React + Three.js + TypeScript + Vite

---

# 1. Design Overview

## Overall Design Philosophy

VOIDRUSH is not a conventional application UI. It is a **high-speed arcade experience** in which the 3D environment is the primary interface.

The design system therefore has two layers:

1. **Gameplay visual system**
   - Voxel geometry
   - Saturated colors
   - High contrast
   - Emissive obstacles
   - Dynamic lighting
   - Speed effects

2. **2D interface system**
   - Main menu
   - HUD
   - Pause
   - Results
   - Settings

The 2D UI must remain visually subordinate to gameplay.

---

## Visual Personality

VOIDRUSH should feel:

- Fast
- Geometric
- Futuristic
- Arcade-oriented
- Aggressive
- Colorful
- Technical
- Slightly chaotic
- Precise underneath the chaos

It should **not** feel:

- Corporate
- SaaS-like
- Minimalist productivity software
- Photorealistic
- Cartoonish
- Fantasy RPG-like
- Luxury/premium
- Generic sci-fi dashboard

---

## UX Philosophy

The game should communicate its mechanics primarily through **visual feedback rather than instructions**.

The player should understand:

> "Move through the opening."

without needing a tutorial.

Every important gameplay event must have immediate visual and/or audio feedback.

---

## Design Goals

1. Make obstacles readable at high speed.
2. Make player movement feel precise.
3. Establish a strong visual identity immediately.
4. Make speed visually perceptible.
5. Keep HUD information readable without distracting from gameplay.
6. Make failure visually satisfying.
7. Make restarting extremely fast.
8. Keep implementation simple enough for AI coding tools.

---

## Design Principles

### 01 — Gameplay First
Nothing should obstruct the player's view unnecessarily.

### 02 — Contrast Creates Readability
Obstacles must contrast against the tunnel.

### 03 — Motion Communicates Speed
FOV, camera movement, lighting and environmental movement should reinforce velocity.

### 04 — Geometry Over Decoration
The voxel geometry itself provides visual interest.

### 05 — Controlled Chaos
The game may become visually intense, but critical gameplay information must remain readable.

### 06 — Consistency
Every UI element must use the same token system.

### 07 — No UI Bloat
The player should spend almost all of their time looking at the game world.

---

## Design North Star

> **A neon voxel tunnel moving at impossible speed, with the player threading through increasingly complex geometric obstacles while the interface stays almost invisible.**

When uncertain about a design decision, prioritize:

**Gameplay readability → speed perception → visual identity → simplicity.**

---

# 2. Design Direction

## Primary Visual Style

**Stylized voxel psychedelic arcade.**

The environment should resemble a continuously moving block-built tunnel rather than a realistic architectural structure.

---

## Secondary Characteristics

- Chunky geometry
- Hard edges
- Saturated colors
- Dark environmental base
- Bright obstacle highlights
- Emissive surfaces
- High-frequency environmental detail
- Strong depth
- Controlled bloom
- Motion-driven composition

---

## Visual Hierarchy

The visual hierarchy is:

```
1. Obstacle / gap
2. Player's movement path
3. Tunnel depth
4. Speed feedback
5. Score / combo
6. Secondary HUD
7. Decorative geometry
```

Decorative geometry must never visually overpower obstacles.

---

## Density

### Early game
Moderate geometry density.

### Mid game
High geometry density.

### Late game
Very high perceived density, but actual collision geometry must remain optimized.

The game should increase **visual complexity** without proportionally increasing rendering complexity.

---

## Whitespace

Traditional UI whitespace is intentionally limited.

HUD elements should have enough spacing to remain legible but should not create large empty interface regions.

---

## Surface Treatment

UI surfaces use:

- Semi-transparent dark backgrounds
- Thin borders
- Minimal shadows
- Sharp or lightly rounded corners
- High contrast typography

Avoid large floating glass panels.

---

# 3. Color System

VOIDRUSH uses a dark neutral base with dynamically changing accent palettes.

## Core UI Tokens

| Token | Hex | Usage |
|---|---|---|
| Background | `#080A0F` | Menus and dark UI |
| Surface | `#10141B` | UI panels |
| Surface Elevated | `#171C24` | Elevated panels |
| Border | `#303844` | UI borders |
| Border Strong | `#566171` | Focus/active borders |
| Text Primary | `#F5F7FA` | Main text |
| Text Secondary | `#AAB2BE` | Secondary text |
| Text Muted | `#6E7785` | Supporting text |
| White | `#FFFFFF` | High-priority UI |
| Black | `#000000` | Effects/overlays |
| Success | `#39E58C` | Successful events |
| Warning | `#FFD447` | Warnings |
| Error | `#FF3D4F` | Collision/error |
| Info | `#38CFFF` | Informational UI |

---

## Primary Gameplay Palette — Blue / Yellow

| Token | Hex | Usage |
|---|---|---|
| Gameplay Blue | `#1769AA` | Tunnel |
| Deep Blue | `#0B2A4A` | Tunnel depth |
| Gameplay Yellow | `#F2C230` | Obstacles |
| Gameplay Orange | `#C87816` | Secondary obstacle geometry |
| Bright Yellow | `#FFE66D` | Emissive highlight |

This is the default palette.

---

## Alternate Palette — Cyan / Red

| Token | Hex | Usage |
|---|---|---|
| Cyan | `#13CFE3` | Environment |
| Cyan Dark | `#064B59` | Environment depth |
| Red | `#E63946` | Obstacles |
| Bright Red | `#FF5260` | Emissive elements |
| White | `#E8E8E8` | Highlights |

---

## Alternate Palette — Purple / Magenta

| Token | Hex | Usage |
|---|---|---|
| Purple | `#7136D9` | Environment |
| Deep Purple | `#24103F` | Depth |
| Magenta | `#D629C9` | Obstacles |
| Bright Magenta | `#FF58E7` | Emissive highlights |
| Blue | `#3155E7` | Secondary geometry |

---

## Alternate Palette — Red Overload

| Token | Hex | Usage |
|---|---|---|
| Crimson | `#C9182B` | Environment |
| Red | `#F02D3A` | Obstacles |
| Pink | `#FF6B7A` | Highlights |
| Black | `#09090B` | Depth |

This palette should be reserved for high-intensity gameplay.

---

## Color Hierarchy

The following hierarchy must be maintained:

```
Dark environment
       ↓
Colored tunnel
       ↓
Bright obstacle
       ↓
Bright gap boundary
       ↓
White/high-intensity event feedback
```

The player's intended path must remain identifiable.

---

## Gradient Rules

Gradients may be used for:

- Background depth
- Lighting
- Post-processing
- Menu background atmosphere

Gradients must **not** be used as the default treatment for every UI component.

---

## Opacity Rules

| Usage | Opacity |
|---|---:|
| UI surface | 85–95% |
| Secondary overlay | 65–80% |
| Disabled UI | 40–50% |
| Decorative glow | 10–40% |
| Vignette | 15–45% |
| Collision flash | up to 80% |

---

## Accessibility

UI text must maintain approximately:

- **4.5:1 minimum** contrast for normal text
- **3:1 minimum** for large text

Gameplay colors do not need to conform independently when they are part of the game-world aesthetic, but obstacle/gap distinction must not rely exclusively on color.

---

# 4. Typography System

## Primary Font

**Inter**

Fallback:

```
Arial, Helvetica, sans-serif
```

Inter should be loaded locally or through a production-safe font asset rather than relying on the user's installed version.

---

## Font Weights

| Weight | Usage |
|---|---|
| 400 | Secondary text |
| 500 | Standard UI |
| 600 | Buttons |
| 700 | Headings |
| 800 | Score / game branding |
| 900 | Major display text |

---

## Typography Tokens

| Token | Size | Weight | Line Height | Usage |
|---|---:|---:|---:|---|
| Display | 64px | 900 | 1.0 | Main logo/title |
| H1 | 40px | 800 | 1.1 | Major screen title |
| H2 | 28px | 700 | 1.15 | Section title |
| H3 | 20px | 700 | 1.2 | Subheading |
| Body | 16px | 400 | 1.5 | Standard text |
| Small | 14px | 500 | 1.4 | Supporting text |
| Caption | 12px | 500 | 1.3 | Metadata |
| Button | 16px | 700 | 1 | Buttons |
| Score | 36px | 800 | 1 | Score |
| Multiplier | 48px | 900 | 1 | Combo |
| Speed | 24px | 800 | 1 | Speed |
| Timer | 22px | 700 | 1 | Timer |
| Event | 18px | 800 | 1 | Near miss |

---

## Number Typography

Score, speed, combo and timer should use:

- Tabular numerals where available
- No unnecessary decimal values
- Strong weight
- High contrast

---

# 5. Spacing & Layout System

Use a **4px base spacing unit**.

```
4
8
12
16
20
24
32
40
48
64
80
96
```

No arbitrary spacing values should be introduced without justification.

---

## UI Page Padding

Desktop: **32px**

Large desktop: **48px**

---

## Component Spacing

Standard: **16px**

Compact: **8px**

Section: **32px**

Major section: **48px**

---

## Menu Layout

Main menu content should occupy approximately:

**320–480px**

centered horizontally and vertically.

---

# 6. Grid & Responsive System

Although the game is desktop-first, the layout should remain responsive.

| Breakpoint | Width | Behavior |
|---|---:|---|
| Compact | `<1024px` | Reduced HUD spacing |
| Desktop | `1024–1439px` | Standard |
| Large | `1440–1919px` | Increased visual margins |
| Ultra-wide | `≥1920px` | Maintain centered HUD structure |

---

## Gameplay Canvas

Canvas:

```
width: 100vw
height: 100vh
```

No fixed game viewport.

The 3D camera aspect ratio must update whenever the browser viewport changes.

---

## HUD

HUD should use viewport-relative positioning but preserve minimum margins.

Minimum edge distance: **24px**

---

## Compact Desktop

At widths below 1024px:

- Reduce score size from 36px → 30px
- Reduce combo from 48px → 40px
- Reduce HUD margins to 16px
- Reduce notification width
- Keep all gameplay controls unchanged

---

# 7. Border, Radius & Elevation System

## Border

Standard: **1px**

Strong: **2px**

No decorative 3px+ borders except gameplay effects.

---

## Radius

VOIDRUSH intentionally uses restrained rounding.

| Token | Value | Usage |
|---|---:|---|
| Radius XS | 2px | Small UI |
| Radius SM | 4px | Buttons/controls |
| Radius MD | 6px | Panels |
| Radius LG | 10px | Major modal |
| Radius Full | 9999px | Status indicators |

Avoid excessive rounded-card styling.

---

## Shadows

### Shadow SM
```
0 2px 8px rgba(0,0,0,0.25)
```

### Shadow MD
```
0 8px 24px rgba(0,0,0,0.35)
```

### Shadow LG
```
0 16px 48px rgba(0,0,0,0.45)
```

Shadows are primarily for UI separation.

Gameplay depth should come from lighting rather than CSS shadows.

---

# 8. Iconography

## Library

Use: **`lucide-react`**

All interface icons must come from this library.

Do not mix:

- Font Awesome
- Material Icons
- Heroicons
- Random SVG downloads

unless a gameplay-specific icon cannot reasonably be represented by Lucide.

---

## Sizes

| Size | Usage |
|---|---|
| 16px | Small controls |
| 20px | Standard controls |
| 24px | Primary controls |
| 32px | Major controls |

---

## Stroke

Default: **2px**

---

## Icon Buttons

Minimum: **44 × 44px**

Desktop may visually render a smaller icon while maintaining a 44px interaction area.

---

# 9. Component System

## PrimaryButton

### Purpose

Primary actions such as:

- Play
- Restart
- Resume

### Dimensions

Height: **48px**

Minimum width: **160px**

Padding: **16px 24px**

Radius: **4px**

### Default

Background: `#FFFFFF`

Text: `#080A0F`

### Hover

Background: `#E5E7EB`

### Active

Transform: `scale(0.98)`

### Disabled

Opacity: **50%**

No pointer interaction.

---

## SecondaryButton

Height: **44px**

Border: **1px solid #566171**

Background: `transparent`

Text: `#F5F7FA`

---

## IconButton

Size: **44 × 44px**

Background: `rgba(16,20,27,0.85)`

Border: `1px solid #303844`

---

## Panel

Background: `rgba(16,20,27,0.92)`

Border: `1px solid #303844`

Radius: **6px**

Padding: **24px**

---

## Badge

Used for:

- Combo
- Status
- Difficulty

Height: **28px**

Padding: **6px 10px**

Radius: **9999px**

---

## Notification

Used for:

- Near miss
- Combo increase
- Major events

Minimum height: **36px**

Padding: **8px 12px**

Background: `rgba(8,10,15,0.85)`

Border: **1px solid current event color**

---

## Slider

Used in settings.

Track: **4px**

Thumb: **16px**

Minimum interaction height: **44px**

---

# 10. Screen-by-Screen Design Specification

## Main Menu

### Purpose

Provide immediate access to gameplay.

### Layout

Full-screen 3D tunnel background.

The tunnel moves slowly at approximately **20–30% of gameplay intensity**.

A dark gradient/vignette overlays the scene.

Central content:

```
VOIDRUSH

ENDLESS FLIGHT
```

Then:

```
[ PLAY ]
```

Secondary controls:

```
SETTINGS
CREDITS
```

### Logo

"VOIDRUSH"

- 64px
- Weight 900
- Uppercase
- Letter spacing: `0.08em`
- White
- Subtle glow

Subtitle:

**16px**

- Uppercase
- Letter spacing `0.16em`
- Muted gray

### Play Button

Width: **220px**

Height: **52px**

Centered.

### Interaction

Play:

```
Main Menu
→ brief launch transition
→ Gameplay
```

Target transition: **500–800ms**

---

## Gameplay HUD

The HUD must be intentionally sparse.

### Top-left — Score

Position: **32px from left, 28px from top**

Example:

```
SCORE
160974
```

Score number: 36px / 800.

### Top-center — Combo

Centered horizontally.

Example:

```
×5
COMBO
```

Multiplier: 48px / 900.

Only display combo prominently when: **combo ≥ 2**

### Top-right — Speed

Position: **32px right, 28px top**

Example:

```
105
CUBES/S
```

Speed number: 24px / 800.

### Timer

Placed near the combo.

Example:

```
01:33
```

22px / 700.

### Near-Miss Notifications

Right side beneath speed.

Maximum: **4 simultaneously**

Each notification remains visible for approximately: **1.5 seconds**

Animation:

```
opacity 0 → 1
translateX(12px) → 0
hold
opacity 1 → 0
```

---

## Pause Menu

Gameplay should freeze behind a darkened overlay.

Overlay: `rgba(0,0,0,0.65)`

Center panel:

Maximum width: **420px**

Content:

```
PAUSED

[ RESUME ]
[ RESTART ]
[ MAIN MENU ]
```

---

## Results Screen

The environment remains visible behind the results interface but should stop or slow dramatically.

Dark overlay: **70–80%**

Main title:

```
RUN OVER
```

Then statistics:

```
SCORE
160974

TIME
01:33

BEST
245812

MAX COMBO
×6

OBSTACLES
87

NEAR MISSES
24
```

Primary action: **RESTART**

Secondary: **MAIN MENU**

---

## Settings

Use a centered panel.

Sections:

### Graphics
- Quality
- Effects intensity
- Bloom
- FOV

### Gameplay
- Movement sensitivity
- Camera shake

### Audio
- Master volume
- Music
- SFX

Controls should use sliders/toggles rather than complex forms.

---

# 11. User Flow UX Specifications

## Start Run

```
Main Menu
 ↓
PLAY
 ↓
Launch animation
 ↓
Gameplay
```

No confirmation dialog.

---

## Pause

```
Gameplay
 ↓
ESC
 ↓
Pause
 ↓
Resume
```

ESC toggles pause.

---

## Restart

From results:

```
Results
 ↓
RESTART
 ↓
New seeded run
```

No confirmation required.

Restart should feel immediate.

---

## Collision

```
Collision
 ↓
Impact effect
 ↓
Run statistics
 ↓
Results
```

The player must receive immediate feedback.

---

# 12. Navigation Architecture

VOIDRUSH has a simple state-based navigation model.

```
                    ┌────────────┐
                    │ MAIN MENU  │
                    └─────┬──────┘
                          │
             ┌────────────┼────────────┐
             ↓            ↓            ↓
          PLAY        SETTINGS       CREDITS
             │
             ↓
         GAMEPLAY
             │
             ├──────────→ PAUSE
             │              │
             │              ├→ RESUME
             │              ├→ RESTART
             │              └→ MAIN MENU
             │
             ↓
         GAME OVER
             │
             ├→ RESTART
             └→ MAIN MENU
```

There is no traditional website navigation.

The application is fundamentally a **finite state machine**.

---

# 13. Forms & Input UX

The game has minimal forms.

## Settings

### Sliders

Validation:

- Clamp values to allowed range.
- Update preview immediately.
- Persist after modification.

### Keyboard

Global shortcuts:

| Key | Action |
|---|---|
| W | Move up |
| A | Move left |
| S | Move down |
| D | Move right |
| ESC | Pause |
| Enter | Activate focused action |

WASD must not trigger browser scrolling during gameplay.

---

# 14. Feedback & System States

## Loading

Initial load should display a minimal:

```
VOIDRUSH
INITIALIZING...
```

No elaborate loading screen.

---

## Loading Failure

If WebGL cannot initialize:

```
UNABLE TO START

Your browser or graphics hardware does not support
the required graphics features.

Please try the latest version of Chrome.
```

---

## Audio Permission

If audio cannot start immediately, gameplay must continue.

Audio should initialize after the first valid user interaction.

---

## Corrupt Settings

If localStorage contains invalid values:

1. Ignore invalid values.
2. Restore defaults.
3. Continue gameplay.

Do not show a technical error to the player.

---

# 15. Motion & Animation System

Animation is critical to VOIDRUSH, but should primarily exist inside gameplay.

## Duration Tokens

| Token | Duration | Usage |
|---|---:|---|
| Instant | 0ms | State changes |
| Micro | 100ms | Button feedback |
| Fast | 180ms | UI transitions |
| Standard | 250ms | Panels |
| Medium | 400ms | Screen transitions |
| Slow | 700ms | Major transitions |

---

## Easing

Default UI: **cubic-bezier(0.2, 0.8, 0.2, 1)**

Exit: **cubic-bezier(0.4, 0, 1, 1)**

Gameplay motion should primarily use frame-rate-independent interpolation.

---

## Gameplay Motion

Required:

- Dynamic FOV
- Camera roll
- Camera shake
- Obstacle rotation
- Tunnel movement
- Lighting changes

---

## Collision Animation

Duration: **700–1200ms**

Effects:

- Camera impact
- Brief screen flash
- Motion reduction
- Chromatic aberration if enabled
- Sound impact

---

## Reduced Motion

If `prefers-reduced-motion: reduce`:

Reduce:

- Menu transitions
- Camera shake
- UI movement

Gameplay movement cannot be disabled because it is fundamental to the game, but non-essential screen effects should be reduced.

---

# 16. Interaction Patterns

## Hover

Desktop hover:

- Slight brightness increase
- Border becomes more visible
- Optional 1–2px movement

No large scale animations.

---

## Press

Button: **scale 0.98**

Duration: **100ms**

---

## Focus

Keyboard focus: **2px solid #FFFFFF**

with: **2px offset**

---

## Disabled

Opacity: **50%**

No hover effect.

---

## Keyboard Navigation

All UI controls must be reachable using: **Tab**

Activation: **Enter / Space**

ESC: **Close/pause where applicable**

---

# 17. Accessibility Requirements

## Target

**WCAG 2.1 AA** for interface components.

---

## Keyboard

All UI functions must be accessible without a mouse.

---

## Focus

Visible focus indicator required.

---

## Contrast

Normal UI text: **≥4.5:1**

Large text: **≥3:1**

---

## Touch Targets

Although mobile is out of scope, interactive UI elements should maintain:

**44 × 44px minimum interaction area**

---

## Screen Reader

Gameplay canvas must have an accessible label explaining:

> "VOIDRUSH gameplay area. Use W A S D to move through incoming obstacles. Press Escape to pause."

Dynamic gameplay statistics should not be aggressively announced every frame.

Critical events such as game over can be exposed through an appropriate live region.

---

# 18. Content & Microcopy Guidelines

## Voice

Short.

Direct.

Arcade-oriented.

Confident.

---

## Avoid

- "Would you like to..."
- "Please click here..."
- Long instructions
- Technical terminology
- Corporate language

---

## Preferred

```
PLAY
RESUME
RESTART
PAUSED
RUN OVER
BEST SCORE
NEAR MISS
NEW BEST
```

---

## Capitalization

Primary UI labels: **UPPERCASE**

Supporting text: **Sentence case**

---

# 19. Data Visualization Design

No charts are required for MVP.

Run statistics are displayed as simple numeric values.

---

# 20. Image & Media Guidelines

VOIDRUSH should avoid external raster artwork wherever possible.

## Primary Visual Assets

Generated through:

- Three.js geometry
- Materials
- Lighting
- Post-processing

This reduces asset-loading complexity.

---

## Logo

The VOIDRUSH wordmark should initially be typography-based.

No complex image logo is required for MVP.

---

## Audio

Audio assets should be compressed appropriately for web delivery.

Avoid loading large uncompressed audio files.

---

# 21. Design Tokens

## Colors

```
--color-bg: #080A0F
--color-surface: #10141B
--color-surface-elevated: #171C24
--color-border: #303844
--color-border-strong: #566171

--color-text-primary: #F5F7FA
--color-text-secondary: #AAB2BE
--color-text-muted: #6E7785

--color-success: #39E58C
--color-warning: #FFD447
--color-error: #FF3D4F
--color-info: #38CFFF
```

---

## Spacing

```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
--space-20: 80px
--space-24: 96px
```

---

## Radius

```
--radius-xs: 2px
--radius-sm: 4px
--radius-md: 6px
--radius-lg: 10px
--radius-full: 9999px
```

---

## Z-Index

```
game-canvas: 0
game-effects: 1
hud: 10
notifications: 20
pause-overlay: 50
modal: 100
critical-dialog: 200
```

---

## Animation

```
--duration-micro: 100ms
--duration-fast: 180ms
--duration-standard: 250ms
--duration-medium: 400ms
--duration-slow: 700ms
```

---

# 22. UI Consistency Rules

AI coding agents must follow these rules strictly.

### Rule 1
Do not introduce a new color without adding it to the design token system.

### Rule 2
Do not introduce arbitrary spacing values.

### Rule 3
Do not introduce another icon library.

### Rule 4
Do not create one-off button styles.

### Rule 5
Do not use excessive rounded cards.

### Rule 6
Do not add gradients to UI components unless explicitly justified.

### Rule 7
Do not use glassmorphism as a default visual treatment.

### Rule 8
Reuse existing components before creating a new component.

### Rule 9
Gameplay visual effects must not reduce obstacle readability.

### Rule 10
Do not place important UI directly over the player's central flight path.

### Rule 11
Do not use CSS to recreate 3D gameplay visuals that should exist in Three.js.

### Rule 12
Do not use React state for frame-by-frame player position, obstacle position, or physics.

### Rule 13
All gameplay values must be controlled by centralized configuration.

### Rule 14
No screen should invent its own typography scale.

---

# 23. Design Anti-Patterns

VOIDRUSH must avoid:

- Generic SaaS dashboard aesthetics
- Excessive glassmorphism
- Excessive rounded cards
- Pastel colors
- Soft corporate shadows
- Flat 2D gameplay
- Photorealistic textures
- Excessive UI
- Giant HUD panels
- Tiny score text
- Random icon styles
- Excessive gradients
- Excessive bloom
- Excessive screen shake
- Unreadable visual effects
- Constant UI animation
- Unnecessary loading screens
- Complex menus
- Long instructional text
- Decorative UI that looks more important than obstacles

---

# 24. Implementation Guidance for AI Coding Tools

## Recommended UI Stack

Use: **React** for application UI.

Use standard CSS or CSS Modules for styling.

Avoid introducing a heavyweight UI framework for the MVP because the application has only a handful of interface screens.

---

## Icon Library

```
lucide-react
```

---

## Animation

For UI:

Prefer CSS transitions and keyframes.

Do not introduce Framer Motion solely for basic buttons or menus.

Three.js handles gameplay animation.

---

## 3D Rendering

Use:

```
three
```

and official Three.js examples where appropriate.

Post-processing should use the Three.js ecosystem rather than an unrelated rendering framework.

---

## Component Architecture

Components should be divided by responsibility:

```
UI Components
    ↓
Application State
    ↓
Game Engine
    ↓
Rendering
```

Never create a single `Game.tsx` containing the entire game.

---

## State Architecture

Application state:

```
MENU
PLAYING
PAUSED
GAME_OVER
SETTINGS
```

should be separate from high-frequency simulation state.

---

## High-Frequency State

Three.js/game-engine-owned:

- Player position
- Player velocity
- Obstacle transforms
- Tunnel transforms
- Physics
- Camera movement
- Collision state

---

## Low-Frequency React State

React-owned:

- Current screen
- Display score
- Display combo
- Settings panels
- Pause state
- Results data

HUD updates should be throttled or synchronized efficiently rather than causing React renders every frame.

---

# 25. Design QA Checklist

## Visual
- [ ] Correct colors
- [ ] Correct typography
- [ ] Correct spacing
- [ ] Correct border system
- [ ] Correct radius system
- [ ] Correct icon library
- [ ] HUD hierarchy is clear
- [ ] Obstacles visually dominate decorative elements
- [ ] Score remains readable at speed

---

## Gameplay
- [ ] Obstacles remain visible.
- [ ] Gaps are visually identifiable.
- [ ] Camera effects don't obscure collisions.
- [ ] Bloom doesn't wash out geometry.
- [ ] Tunnel depth remains readable.
- [ ] High-speed mode remains playable.

---

## UX
- [ ] Play starts immediately.
- [ ] Pause works.
- [ ] Restart works.
- [ ] Results are clear.
- [ ] Settings are understandable.
- [ ] Keyboard navigation works.

---

## Accessibility
- [ ] UI contrast checked.
- [ ] Keyboard focus visible.
- [ ] All buttons keyboard accessible.
- [ ] Reduced-motion behavior implemented.
- [ ] Canvas has accessible description.
- [ ] Error state is readable.

---

## Responsive
- [ ] 1024px width tested.
- [ ] 1280px tested.
- [ ] 1440px tested.
- [ ] 1920px tested.
- [ ] Ultra-wide tested.
- [ ] HUD doesn't overlap.
- [ ] Score doesn't clip.
- [ ] Menu remains centered.

---

## Consistency
- [ ] No arbitrary colors.
- [ ] No arbitrary spacing.
- [ ] No random iconography.
- [ ] No one-off button designs.
- [ ] No inconsistent typography.
- [ ] Existing components reused.

---

# 26. Definition of Design Done

The design implementation is considered complete when:

- [ ] Every PRD screen has a defined visual specification.
- [ ] Every screen uses the centralized token system.
- [ ] Gameplay HUD is implemented consistently.
- [ ] Main menu is implemented.
- [ ] Pause screen is implemented.
- [ ] Results screen is implemented.
- [ ] Settings screen is implemented.
- [ ] All interactive states are implemented.
- [ ] Keyboard interactions are implemented.
- [ ] Focus states exist.
- [ ] Responsive desktop behavior is verified.
- [ ] Reduced-motion behavior exists.
- [ ] Typography is consistent.
- [ ] Colors are tokenized.
- [ ] Spacing is tokenized.
- [ ] Border/radius values are tokenized.
- [ ] No unnecessary UI framework has been introduced.
- [ ] No duplicate component implementations exist.
- [ ] Gameplay effects preserve obstacle readability.
- [ ] Visual intensity increases with gameplay difficulty.
- [ ] The interface feels like an arcade game rather than a conventional web application.

---

# Final Design Direction

VOIDRUSH should **not** be designed like a website with a game embedded inside it.

The hierarchy is:

```
             VOIDRUSH
                 │
                 ▼
        ┌─────────────────┐
        │   3D GAME WORLD │
        │                 │
        │  OBSTACLES      │
        │       ↓         │
        │     GAPS        │
        │       ↓         │
        │    PLAYER       │
        └────────┬────────┘
                 │
          Minimal HUD
                 │
          Minimal Menus
```

The **3D world is the product**. The React interface exists to start, control, configure, and conclude a run.

The visual target is therefore a **dark, saturated, voxel-built, high-speed tunnel with bright geometric obstacles and controlled psychedelic post-processing**, while the 2D interface remains monochrome, compact, sharp, and functional.

This gives the AI coding agent a clear rule for every future implementation decision:

> **Make the world visually intense. Make the controls precise. Make the HUD minimal. Make the UI disappear when the game begins.**