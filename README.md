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
- **Testing Suite:** [Vitest](https://vitest.dev/) (168 unit & integration tests)
- **Deployment:** [Vercel](https://vercel.com/) static hosting

---

## 🕹️ Controls

| Key | Action |
| --- | --- |
| `W` / `Up Arrow` | Steer Up |
| `S` / `Down Arrow` | Steer Down |
| `A` / `Left Arrow` | Steer Left |
| `D` / `Right Arrow` | Steer Right |
| `ESC` | Pause / Resume Game |

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
