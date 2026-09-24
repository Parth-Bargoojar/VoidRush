# ⚡ VOIDRUSH — Endless Voxel Flight

> **High-speed, desktop browser-based first-person 3D obstacle runner built with React, Three.js, and Web Audio API.**

![VOIDRUSH Flight Screenshot](artifacts/browser-qa/02-mid-flight.png)

---

## 🚀 Overview

**VOIDRUSH** is an arcade-style, first-person 3D endless flight game. Carried continuously forward through an infinite, procedurally generated voxel tunnel, players dodge incoming solid geometry at extreme speeds using responsive **WASD** steering controls.

- **Zero External Assets:** 100% generated in code (procedural geometry, dynamic lighting, Web Audio synthesis).
- **Instant Loading:** Sub-second boot time with offline capability.
- **Fair & Deterministic:** Every obstacle generation is mathematically verified reachable before being committed to the tunnel.

---

## ✨ Features

- 🎮 **Intuitive Arcade Controls:** WASD / Arrow key steering with smooth inertial response, positional camera lag, and dynamic turn roll.
- 📱 **Plays on Phones & Tablets:** Steer by tilting the device, with calibration, dead zone, sensitivity and inversion settings. An analog on-screen joystick is the fallback (and an option), with vibration feedback, a safe-area-aware HUD, and a fullscreen / installable web-app mode. Designed for landscape; portrait still plays.
- 🌀 **Procedural Tunnel Pipeline:** Dynamic cross-section variations (rectangular, polygonal, twisting up to 14°) with seamless segment recycling.
- 🚧 **8 Distinct Obstacle Archetypes:**
  - **Static Gate** & **Ring / Bullseye**
  - **Rotating Cross** & **Sweeping Fan**
  - **3D Cage Frame**
  - **Oscillating Moving Gate**
  - **Off-Center Rotating Ring**
  - **Multi-Layer Combination Obstacles**
- ⚡ **Combo & Near-Miss Mechanics:** Precision reward system with proximity-based near-miss detection (+250 to +1,000 pts) and combo multipliers.
- 🎨 **Dynamic Visual Palettes:** Seamless color transitions across 4 difficulty tiers: *Intro* (Deep Navy & Amber), *Build* (Cyan & Crimson), *Intense* (Magenta & Violet), and *Overload* (Red Warning).
- 🔊 **Synthesized Web Audio Engine:** Dynamic, speed-synced electronic synthwave music and sound effects created entirely with the browser's Web Audio API.
- 💾 **Local Progress & Settings:** Best scores, maximum combos, graphics quality, and sensitivity options stored persistently in browser storage.

---

## 🛠️ Tech Stack

- **Language:** [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Frontend Framework:** [React 18](https://react.dev/)
- **3D Graphics Engine:** [Three.js](https://threejs.org/) (WebGL)
- **Build Tooling:** [Vite](https://vitejs.dev/)
- **Audio Engine:** Native Web Audio API
- **Testing Suite:** [Vitest](https://vitest.dev/) (272 unit & integration tests), plus Playwright desktop and mobile browser passes
- **Deployment:** [Vercel](https://vercel.com/) static hosting

---

## 🕹️ Controls

| Key | Action |
| --- | --- |
| `W` / `Up Arrow` | Steer Up |
| `S` / `Down Arrow` | Steer Down |
| `A` / `Left Arrow` | Steer Left |
| `D` / `Right Arrow` | Steer Right |
| `ESC` | Pause / Resume Game · Close Settings & Credits |

### Tilt (phones & tablets)

| Motion | Action |
| --- | --- |
| Lower the right / left edge | Steer right / left |
| Tip the top edge away / pull it back | Climb / dive (flip with *Invert vertical*) |
| Hold at your normal angle | Fly straight |
| Tap the ❚❚ button (top right) | Pause |

Tilt is the default on phones and tablets (**Settings → Controls → Control mode: Auto**). Before the first tilt run the game asks you to hold your device in your normal playing position and counts down *3 · 2 · 1* while it measures that position; that becomes "straight ahead". On iPhone and iPad, Safari asks for motion access when you tap **Play** — nothing is requested on page load. If access is denied or the device has no motion sensor, the on-screen joystick takes over automatically.

Under **Settings → Controls** you can pick *Auto*, *Keyboard* or *Tilt*, adjust tilt sensitivity and dead zone, invert either axis, and recalibrate (also available from the pause menu). Turning the device between orientations mid-run pauses it; tilt recalibrates when you resume. The neutral position is never saved, because how you hold the device changes between sessions.

### Touch joystick

| Gesture | Action |
| --- | --- |
| Touch & drag anywhere | Steer — the joystick appears under your thumb. Push further to fly faster. |

VOIDRUSH is designed for landscape. Held upright, a small *Rotate device — for best experience* card appears; it can be dismissed, and portrait still plays. Tapping **Play** goes fullscreen and, when the device is already sideways and the browser allows it (Chrome on Android), locks the screen to landscape so tilting the phone mid-run cannot flip the view.

The joystick is analog: a half-pushed stick steers at half speed, which makes threading narrow gaps easier on glass. The default *dynamic* stick appears under your thumb wherever you touch on its half of the screen, then holds still while you steer and returns to its corner when you let go. The *fixed* stick stays in its corner. Under **Settings → Controls** you can switch between the two, move the stick to the right hand, resize it, turn vibration on or off, or force the joystick on or off (it shows automatically once you touch the screen, unless tilt is steering).

---

## 💻 Getting Started Locally

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation & Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Parth-Bargoojar/VoidRush.git
   cd VoidRush
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local dev server:**
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

4. **Run tests:**
   ```bash
   npm run test
   npm run e2e          # desktop browser pass (builds first)
   npm run e2e:mobile   # emulated phone: tilt, permission, calibration, fallbacks
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

---

## 🌐 Deploying to Vercel

VOIDRUSH is pre-configured for one-click Vercel deployment via `vercel.json`:

1. Push your code to GitHub.
2. Import the repository into [Vercel](https://vercel.com).
3. Vercel automatically detects Vite and deploys your live game link.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
