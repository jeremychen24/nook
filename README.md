# Nook

A cozy pixel-art focus timer, built as a web app you add to your iPhone's Home Screen.
Live at https://jeremychen24.github.io/nook/.

- **Focus:** Pomodoro timer in a pixel scene (café, library, classroom, train, rooftop) that follows the time of day, with rain and ambient sounds.
- **Phone lock:** leaving Nook mid-session ends it; face-down mode; an "are you sure?" screen with Gentle, Firm or Strict quitting; a Guided Access guide with a spare key so nobody gets locked out.
- **Plan:** weekly classes (including A/B days), tests and study hours become suggested sessions, sent to your calendar with alerts.
- **Rewards:** coins for focus, a shop of decorations and scenes, a plant that wilts when you quit, badges.
- **Stats:** today, week, streak, month heatmap, by class, by task, time of day, and a weekly review.

Everything is saved on the device (localStorage). Settings › Backup exports and imports a JSON file.

## Run locally

```
python -m http.server 8000
```

Then open http://localhost:8000. No build step and no dependencies.

For a phone-shaped preview with the notch and home bar, open http://localhost:8000/dev/phone.html. Its buttons switch phone size, time of day and rain, and add test coins. The app itself also reads `?tod=night`, `?rain=1` and `?scene=train`.

## Test

```
npm test
```

Runs the tests in `tests/` with Node's built-in test runner (Node 20+): timer, rewards, stats, badges, planner, calendar file and passcodes.

## Deploy

GitHub Pages serves the `main` branch, so pushing to `main` updates the live site in about a minute. Bump `CACHE` in `sw.js` and list any new files in its `SHELL` when adding files.

## Where things are

| | |
|---|---|
| `js/app.js` | Wires the screens together: tabs, focus view, sheets, settings, startup |
| `js/store.js` | Saved state and its defaults |
| `js/timer.js` | Pomodoro engine (timestamp-based) and leaving-the-app detection |
| `js/lock.js` | Wake lock and face-down mode |
| `js/quit.js`, `js/spare.js` | The quit screen and the Guided Access spare key |
| `js/plan.js`, `js/planview.js`, `js/ics.js`, `js/exams.js` | Study planner, Plan tab, calendar file, test countdown |
| `js/rewards.js`, `js/decor.js`, `js/badges.js` | Coins and shop, decorations, badges |
| `js/stats.js`, `js/charts.js` | Stats numbers and SVG charts |
| `js/sounds.js` | Chime and generated ambient sounds |
| `js/pixel.js`, `js/scenes/` | Pixel drawing toolkit and the scenes (each can draw wider for big screens) |
| `dev/` | Phone preview and the link-preview poster |
| `tools/make_icons.py` | Redraws `icons/` from a pixel map |

## Link preview

`og.png` is a screenshot of `dev/poster.html?tod=dusk` at 1200×630.
