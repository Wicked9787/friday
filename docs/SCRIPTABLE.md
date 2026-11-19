# Scriptable widgets (Concept 28 "Obsidian")

You need the free **Scriptable** app from the App Store.

Copy each script from Safari (open the link, select all, copy):

| Script | Sky (Friday) | Batsie (Jarvis) |
|---|---|---|
| Home Screen widget | https://wicked9787.github.io/friday/scriptable/Friday-Widget.js | https://wicked9787.github.io/friday/friday-batsie/scriptable/Friday-Widget.js |
| Lock Screen widget | https://wicked9787.github.io/friday/scriptable/Friday-LockScreen.js | https://wicked9787.github.io/friday/friday-batsie/scriptable/Friday-LockScreen.js |
| Clear background helper | https://wicked9787.github.io/friday/scriptable/Friday-Clear-Background.js | https://wicked9787.github.io/friday/friday-batsie/scriptable/Friday-Clear-Background.js |

No API keys are in these scripts.

## What each size shows

- **Small**: the gold and silver orb with a **Talk** button. Tap anywhere to talk.
- **Medium**: day, greeting, weather (temp, high, low), the orb, and **Talk**.
- **Large**: six round quick bubbles around the orb: Lights, TV, Timer (10 min), Alarm, Music, Notes. Greeting and **Talk** at the bottom. Each bubble runs that command in the shortcut. Notes opens the Notes app.
- **Lock Screen**: circular orb (tap to talk), circular weather, circular alarm, a rectangular one with greeting and temp, and an inline one.

Bubbles and Talk run the shortcut with text, so the shortcut needs the "If Shortcut Input has any value" step at the top.

## Replace or add the code

1. Open the script link above in Safari, select all, copy.
2. In Scriptable, open the script (or tap **+** for a new one), select all, paste, tap **Done**.
3. Names: **Friday Widget**, **Friday Lock**, **Friday Clear Background** (Jarvis on Batsie's phone).

## Widget Parameter

Press the widget, **Edit Widget**, pick the script, then type in **Parameter**:

- `clear` (default), `tinted`, or `solid`
- add a number for tint strength, e.g. `tinted 40` (default 25)
- add the spot word the Clear Background helper gives you, e.g. `clear medium-top`
- add `app` to make taps open the Friday site instead of Talk

Lock Screen circular: `orb` (default), `weather`, or `alarm`.

## Clear background

1. Press and hold the Home Screen until the icons wiggle, swipe to an empty page, take a screenshot.
2. Run **Friday Clear Background**, pick size and spot, pick the screenshot.
3. It saves the crop and copies the Parameter text (like `clear medium-top`). Paste it into the widget's Parameter.

Do this once per widget. If you change wallpaper, do it again.
