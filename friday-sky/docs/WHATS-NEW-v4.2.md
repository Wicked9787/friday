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

## 4.2.1
- Backups to Files hold everything: memories, personality, chats, lists, settings, brains and the
  Apple TV. With "Include keys" on, the Groq key, every brain's key and the Apple TV pairing go in
  too, so restoring needs nothing re-entered. Without it, no keys are in the file.
- Restoring a backup also refreshes the safety copy, so the two never disagree.
- Diagnostics by voice understands more ways of asking: "can you run diagnostics", "run diagnostics
  please", "hey Friday, run a diagnostic check", "diagnose yourself", "check your systems",
  "are your systems OK". Her summary now shows in the chat too.

## 4.2.2
- Google Search works again in her research. Google only gives free Google Search through Gemini on
  some models (on the free tier, Gemini 2.5 Flash and Flash-Lite), and a Gemini key added with the
  default model now points at Gemini 3, which has none. She now searches with 2.5 Flash first, then
  2.5 Flash-Lite, then your Gemini model, remembers which one worked, and new-style AQ. keys work for
  it too. Your Gemini model for chatting is unchanged.
- She knows she can look things up online: she won't say she can't browse or offer the Shortcut for
  a search. With web search turned off in Settings → Internet, she says that instead.
- Groq shut down Llama 3.1 8B and Llama 3.3 70B in August (and Qwen3 32B and Llama 4 earlier). She
  no longer spends a request finding that out each time, Groq's recommended replacement Qwen 3.6 27B
  is added to her Groq brains, and Diagnostics counts the chat models Groq still offers.
- If a backup brain's free model is retired (OpenRouter's free list changes every few weeks), she
  moves that brain to another free model from the same service on her own. Same brain, same key.

## 4.2.3
- Reed is a he everywhere in his app: Settings, Memory, the neural map, Diagnostics and What's New say
  he, him and his. Only the app's own wording changed; chats, memories, notes and private messages are
  left exactly as written. F.R.I.D.A.Y.'s screens are unchanged.
- Check lights in the app says exactly what's in the way: the installed copy is missing the Home
  permission (for example when an installer left it out; install the HomeKit file through SideStore),
  Home access is turned off, the Apple account on the phone isn't in a home (with the invite steps), or
  the home is still loading. It no longer mentions AltStore or the LightsTest file.
- If Home access is on but the home hasn't loaded yet, the app waits 6 seconds more before giving up.
- Diagnostics checks Apple Home (lights and scenes, or the reason they can't be reached) and the music
  library (access, and how many songs the app can see).
