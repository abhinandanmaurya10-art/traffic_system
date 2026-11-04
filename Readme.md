# Smart Traffic System

A browser-based traffic-signal simulator built with React, JavaScript, HTML, and CSS. It supports adaptive and fixed-time signal control, configurable traffic and priority weights, pedestrian crossing requests, and emergency vehicle overrides. No backend, database, or environment variables are required.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Run locally

From the repository root:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the React development server |
| `npm run build` | Create the production frontend build in `client/dist` |
| `npm test` | Run the traffic-simulation logic tests |

## Deploy to GitHub Pages

The GitHub Actions workflow builds the client and publishes it to GitHub Pages. It uses the repository path `/smart_traffic_system-/` when building asset links.

1. Push the repository to the `main` branch on GitHub.
2. In the repository, open **Settings → Pages** and change **Source** to **GitHub Actions**.
3. If Pages shows an invalid custom-domain warning, remove the value `mart_traffic_system` from the **Custom domain** setting and save. Leave the custom domain empty unless you own a properly formatted domain.
4. Open the **Actions** tab and wait for the **Deploy to GitHub Pages** workflow to finish successfully.
5. Visit `https://abhinandanmaurya10-art.github.io/smart_traffic_system-/`.

The deployment uses GitHub's default Pages domain. No database, environment variables, or custom domain are required.

## Simulation and saved runs

- Adaptive mode scores each road using vehicle count, waiting cycles, and pedestrian requests. Emergency flags take precedence; roads beyond the starvation threshold are served before ordinary score comparisons.
- Fixed-time mode cycles through North, South, East, and West in order unless an emergency override is active.
- Green duration is bounded between 5 and 30 seconds; each cycle includes a 3-second yellow phase and a 1-second all-red safety gap.
- Starting a simulation animates each signal through green, yellow, and all-red phases; playback runs at an accelerated pace for a quick visual demo.
- Traffic for subsequent cycles is randomized between 0 and 40 vehicles. Initial road counts can be set from 0 to 100.
- The last 10 simulation runs are saved in the current browser's local storage on the current device. They are not shared across browsers or devices and are cleared if that browser storage is cleared.

## Project layout

```text
.github/workflows/pages.yml GitHub Pages build and deployment workflow
package.json            Root scripts and project dependencies
package-lock.json       Locked dependency versions
client/
  src/
    App.jsx             React dashboard
    simulation.js       Traffic scheduling and simulation logic
    styles.css          Dashboard styles
  tests/                Node.js built-in test runner
```
