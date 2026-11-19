# Scriptable widgets for Friday

You need the free **Scriptable** app from the App Store.

The scripts are in the `scriptable` folder:

- `Friday-Widget.js` — Home Screen, small, medium, or large
- `Friday-LockScreen.js` — Lock Screen circular, rectangular, or inline
- `Friday-Clear-Background.js` — crops a wallpaper screenshot so the Home Screen widget can look clear

At the top of `Friday-Widget.js` and `Friday-LockScreen.js`, set:

```
const SITE_URL = "https://wicked9787.github.io/friday/?u=sky"
```

For Batsie’s phone, use `?u=batsie` instead. If the GitHub username or repo ever changes, change this line to match.

There is no API key in these scripts.

## Home Screen widget

1. Open Scriptable, tap **+**, and delete the sample code.
2. Paste in the contents of `Friday-Widget.js`. Name the script **Friday Widget**.
3. On the Home Screen, press and hold, tap **Edit**, then **Add Widget**.
4. Find Scriptable, pick small, medium, or large, and add it.
5. Press the widget, tap **Edit Widget**, and choose the Friday Widget script.
6. In **Parameter**, type `clear`, `tinted`, or `solid`. Clear is the default look.

Tap the widget to open Friday.

## Clear background

Clear widgets look best if the background matches your wallpaper.

1. Go to the Home Screen and take a screenshot of just the wallpaper (you can move widgets out of the way).
2. Run `Friday-Clear-Background.js` in Scriptable.
3. Pick the widget size and roughly where it will sit, then choose the screenshot.
4. The script saves `Friday-Widget-Background.png` in Scriptable’s iCloud folder.
5. Set the widget parameter to `clear`.

If the crop is a little off, run the helper again and pick a different position, or edit the pad numbers at the top of that script.

## Lock Screen widget

1. Add a new script in Scriptable and paste `Friday-LockScreen.js`. Name it **Friday Lock**.
2. Press the Lock Screen, tap **Customize**, then the lock screen, then **Add Widget**.
3. Choose Scriptable, pick a circular, rectangular, or inline slot, and select the Friday Lock script.

## Style reminder

Friday’s Settings has a “widget style hint.” That is only a reminder for you. The real style is the Parameter on the widget (`clear`, `tinted`, or `solid`).
