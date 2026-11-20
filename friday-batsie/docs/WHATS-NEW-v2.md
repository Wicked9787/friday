# Friday and Jarvis 2.0

Everything here works on the free Groq plan. Nothing that was there before was removed.

## Her brain
- **Backup brain.** If a Groq model hits its free limit she tries the next Groq model (each has its own limit), then any connection marked **Backup brain** in Settings → Connections.
- **Any AI in Connections.** Presets for Groq, Gemini, OpenRouter, Cerebras, Mistral and GitHub Models (free tiers), plus ChatGPT, Grok, DeepSeek and Claude (paid), or any OpenAI-compatible service. **Find models** lists what a key can use; **Test** checks it.
- **Faster replies.** She starts speaking the first sentence while the rest streams in (Settings → Brain).
- **Long-chat memory.** Older conversation is folded into a short running summary, so she remembers more than the last 12 lines.
- **Moods.** Normal, Focus, Hype, Calm, Bedtime. Say "focus mode", "hype mode", "back to normal".

## Her voice
- Six free Groq AI voices (Troy, Daniel, Austin, Hannah, Diana, Autumn). The free plan allows about 100 short clips a day; when they run out she uses the iPhone voice you pick as the fallback.
- Every iPhone voice in the picker, Premium and Enhanced first, with Preview and a speed slider.
- **Talk over her** (optional): start talking and she stops to listen.

## Day to day (all by voice, all saved on the phone and in Backup)
- **Lists:** "add milk and eggs to my grocery list", "what's on my list", "check off milk", "we're out of coffee", "make a hardware list".
- **Bills:** "add my phone bill for 85 dollars due on the 28th", "what bills are due", "I paid the phone bill". The briefing mentions bills due within 3 days.
- **Countdowns:** "add a countdown for the beach trip on March 5th", "how many days until Christmas".
- **Timers:** several at once, named, and they survive closing the app. Timers of 10 minutes or more are also handed to the Shortcut so the iPhone rings.
- **Notes:** "note that I parked on level 3", "read my notes".
- **Directions:** "take me to the nearest gas station", "directions to Walmart".
- **Show her a photo:** camera button in the top bar, or say "what is this".
- **Fuller morning briefing:** high, low and rain chance, bills, countdowns, birthdays from memory, to-do list, timers, and two headlines.
- **Memory editor:** search, pin, edit, and filter learned memories.

## Looks
- **HD realistic** render style for every look (Settings → Looks): full phone resolution, depth of field, glass reflections on the black core, finer light. **Original** is one tap away and unchanged.
- Four new looks: **X1 Nested fracture**, **X2 Nested + black orb**, **X3 Nested silver**, **X4 Six-layer fracture**.
- **Night mode** dims the orb and softens her voice between the hours you pick.

## Shortcut
- New chunks **29 Calendar today** and **30 Add a calendar event** in `friday-2-shortcut/MASTER.md`.
- The in-app copy-and-paste prompt (Settings → Shortcut setup) now also handles timers and the calendar.

## Widgets and Control Center
- Scriptable widgets can show the HD orb (see SCRIPTABLE.md) and open the app directly.
- Control Center: add **Open App → Friday/Jarvis** and **Shortcut → Friday/Jarvis** controls (Settings → Widgets and Control Center).

## Neural map (upgraded)
- A 3D map that slowly turns: her skills on top, her mind in the middle, your tools below.
- Pulses travel along the links when she really listens, thinks, searches, learns, or sends a job to the Shortcut.
- Live badges (memories, list items, bills, next timer), tap a node for details and an Open button, stats (replies today, resting brains, backups, AI voice left), and an activity log.

## Internet
- Searches the web for anything current; "search for …", "look up …", "google …" force a search.
- Reads links you paste; "open amazon.com" opens a website.
- Free Wikipedia backup when web search is busy.
- Settings → Brain → Internet: When needed, Always check, or Off.

## Smoother and more efficient
- Requests are sorted on the phone, so most messages use one less AI call (about double the free daily talk time).
- Instant answers with no AI: time, date, math, percentages, tips, unit and temperature conversions.
- The orb pauses behind full-screen panels and when the app is in the background (battery).
- Warms up the connection to Groq when the app opens (faster first reply).
- "Run diagnostics" (or Settings → Brain → Run diagnostics) checks key, brains, voices, vision, mic, Shortcut name and storage.
- Usage meter in Settings → Brain.
- Weekly backup reminder.
- Offline mode: lists, timers, notes, bills and countdowns keep working; chat says it needs the internet.

## New files
`js/brain.js` (AI calls and backup brain), `js/life.js` (lists, bills, countdowns, timers, night mode), `js/eyes.js` (photos), `js/neural.js` (rewritten neural map), `icons/widget/` (HD widget orbs).
