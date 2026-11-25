# What's new in 4.2 · Remote

## Apple TV remote
- A remote laid out like the iPhone's Apple TV Remote, in Settings → Lights → Apple TV remote:
  mute and power at the top with the Apple TV's name between them, the touch area (swipe to move,
  tap to select, press and hold for a long select), back and forward 10 seconds, play/pause, back and
  the TV button. Info and subtitles are shown dimmed because the Apple TV doesn't take them this way.
- Pair once: tap the name, Find my Apple TV, tap it, and type the 4-digit code that shows on the TV.
  The pairing keys stay in this iPhone's Keychain. Forget this Apple TV removes them.
- By voice: "pause the TV", "play the TV", "turn the TV up" (or "up 5"), "turn the TV down",
  "mute the TV", "skip back on the TV", "skip forward 30 seconds on the TV", "turn off the TV",
  "turn on the TV", "down on the TV", "OK on the TV", "go back on the TV", "go home on the TV".
- Volume and power go through the Apple TV, so with HDMI-CEC on they change the TV the same way the
  Siri Remote does. It works on the home Wi-Fi.
- It uses Apple's own remote protocol through the open-source itsytv-core library (MIT License,
  (c) 2026 Nick Ustinov), pinned to one exact version.
- The app now needs iOS 17 or later.

## Nothing lost in an update
- Everything she keeps (memories, chats, personality, lists, notes, bills, habits, settings, layout
  and the extra brains) has a safety copy in the iPhone Keychain, saved a few seconds after changes
  and whenever you leave the app. Keys are never in it; they're in the Keychain on their own.
- If she starts after an update and the app's storage was wiped, she puts everything back and tells
  you. Diagnostics shows when the safety copy was last saved, and when it was last used.
- Extra brains also keep their own copy, so even on their own they come back with their keys.
- Reset on this phone clears the safety copy too, so a reset stays a reset.
