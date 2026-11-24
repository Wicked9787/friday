# Friday and Reed 3.5.6 · StandBy

Install over 3.5.5 (or any 3.x). Memory, settings and keys carry over.

## New in 3.5.6: her orb on StandBy

A Scriptable widget for StandBy that shows the orb look you're using right now. It shifts to a new angle each time iPhone refreshes it (about every 15 minutes). Apple only lets its own widgets animate, so it doesn't spin live, but the clock option ticks live. Tap it to talk to her.

1. Settings → Your stuff → Widgets & Charging → **StandBy: her own orb** → **Copy StandBy script**. In Scriptable: **+**, paste, name it "Friday StandBy".
2. Scriptable → Settings → **File Bookmarks** → **+** → **Pick Folder** → On My iPhone → Friday → **Widget**. Name the bookmark **Friday** (Reed: **Reed**).
3. Charge the phone sideways so StandBy shows, press and hold the widgets → **+** → Scriptable → small → Done. Press and hold it → **Edit Widget** → Script: Friday StandBy. Parameter: empty (just the orb), **clock** (orb + live clock) or **info** (time since you talked, plus her last reply if you turn on Show her latest reply).

Nothing on your Lock Screen changes. Change her look in the app and the widget follows.

# 3.5.5 · Keyboard & Camera

Install over 3.5.4 (or any 3.x). Memory, settings and keys carry over.

## New in 3.5.5

- **Keyboard:** the typing bar now sits right on top of the keyboard instead of hiding behind it, at every text size. The ^ v Done bar above the keyboard is gone.
- **Photos without asking:** when photos would help (tools, how-to, things she names), she shows a few free photos under her answer. "What are the best tools?" shows the tools she lists. Tap a photo to see it big. Asking for "pictures" or "photos" still opens the full Pictures panel. Turn the automatic ones off in Settings → Her → Looks & Layout → Main screen → Pictures with answers.
- **Camera in the app (optional):** Settings → Phone → In the app → **Camera in the app**. On: "open the camera" or "take a picture" opens Apple's simple camera inside her (photo and video, flash, flip, zoom), saves to your Photos, and "what is this?" lets her look at the picture. Off (the default): your Shortcut opens the Camera app.
- **Apple Home with SideStore:** install the **HomeKit** file, which has the Home permission built in.

# 3.5.4

- **Save backup** (Settings → Backup & About) now opens the iPhone share menu in the app. Pick **Save to Files** (or AirDrop, or send it to yourself). Before, the app tried to "download" the file, which goes nowhere inside an installed app.
- **Restore from file** brings it back. **Restore from a copied backup** works if a backup was copied as text instead.
- Her mic switches back on by itself if her audio got stuck in speaker-only mode ("AudioSession category is not compatible with audio capture").
- Everything from 3.5.2 (pictures, the robot) and 3.5.3 (no "robot" needed, wake her from anywhere) is included.

Two files are built for each app: the regular one, and a **Home** one that carries the Apple Home permission for installing on her own with SideStore.
