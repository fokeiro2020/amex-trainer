# AMEX Trainer Auto-Clicker

Chrome extension + auto-updating scripts for AMEX training modules.

**By Sig — IT**

---

## How It Works

- The Chrome extension fetches scripts from this GitHub repo automatically
- To update scripts: just edit `scripts/scorm_clicker.js` or `scripts/inspireplus.js` and push
- The extension checks for updates every time you click **Detect**
- Scripts are cached locally so it works offline too

---

## Supported Platforms

| Platform | Detection |
|----------|-----------|
| SCORM Slide-Object | `.slide-object.cursor-hover` elements |
| InspirePlus / Angular | `NAV_NEXT`, `PIE_PERC_QUICK_QUIZ_PROGRESS` |

---

## To Update Scripts

1. Edit `scripts/scorm_clicker.js` or `scripts/inspireplus.js`
2. Bump the version in `scripts/version.json`
3. `git add . && git commit -m "Fix: description" && git push`
4. Click **⬇️ UPDATE** in the extension popup

---

## Installation

1. Download/clone this repo
2. Go to `chrome://extensions/`
3. Enable **Developer Mode**
4. Click **Load unpacked** → select the `extension/` folder
5. Open a training page → click the 🎯 icon → **Detect** → **Start**

---

## Files

```
scripts/
  version.json          ← Version info (bump this when updating)
  scorm_clicker.js      ← SCORM slide-object automation
  inspireplus.js        ← InspirePlus/Angular automation

extension/
  manifest.json
  content.js            ← Fetches scripts from GitHub
  popup.html/js         ← Extension UI
  icon*.png
```
