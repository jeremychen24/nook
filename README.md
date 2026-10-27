# Nook

A pixel-art focus timer for iPhone, built as a web app you add to your home screen.

## Run locally

```
python -m http.server 8000
```

Then open http://localhost:8000. No build step and no dependencies.

For a phone-shaped preview with the notch and home bar, open http://localhost:8000/dev/phone.html.

## Test

```
npm test
```

Runs the timer tests with Node's built-in test runner (Node 20+).

## Icons

`python tools/make_icons.py` redraws `icons/` from the pixel map in that script.

## Install on iPhone

iOS only installs web apps and grants motion access over HTTPS, so it has to be deployed to a static host first (GitHub Pages, Netlify, etc.). Then open the URL in Safari, tap Share, then Add to Home Screen.
