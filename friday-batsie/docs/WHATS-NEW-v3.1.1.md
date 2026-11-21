# Friday and Jarvis 3.1.1 · Live Voice

Coming from 2.0? This one install has everything from 3.0, 3.1 and 3.1.1. Your memory and settings carry over.

## Which file is which

| File | What it is |
|---|---|
| `Friday-v3.1.1-LiveVoice.ipa` | Friday 3.1.1 for Sky. |
| `Jarvis-v3.1.1-LiveVoice.ipa` | **Install this one.** Jarvis 3.1.1 for Batsie. |
| `…-LightsTest.ipa` | The same app plus Apple Home permission, so lights can run straight from the app. Try it first; if AltStore won't take it, use the regular one. |
| `…-Backup.zip` | Everything to rebuild or reinstall later: the app, Shortcut prompt, setup notes, widgets, full source. |

The version number shows in AltStore and in the app (Settings → Backup & About).

## Live voice (new in 3.1.1)

- **She hears you live.** Your words show up on screen as you talk. This uses the iPhone's own speech recognition, so it's free and doesn't wait for a recording to upload. The first time, iOS asks to allow Speech Recognition: tap Allow.
- **She knows when you're done, like ChatGPT.** She listens to *what* you said, not just for silence. "Set a timer for…" or a trailing "and…" makes her wait; "what's the weather" gets an answer right away. Settings → Voice & Talking → **Talk time** sets how patient she is (Short, Normal, Long).
- **Smoother, more natural voice.** The AI voice clips now play back to back with even, natural pauses instead of robotic gaps. She starts talking sooner on long answers, joins short sentences into smoother phrases, and no longer reads out symbols, links or emojis.
- **Talks like a person.** She's told to lead with the answer, use everyday words and contractions, and not open every reply with "Certainly".
- **Speed:** the AI voice changes pitch when sped up, so the speed slider only nudges it a little now. The iPhone voice still follows the slider fully.

If live listening ever acts up, turn it off in Settings → Voice & Talking → **Live listening** and she goes back to Groq's Whisper. Whisper also judges when you're done now: during each pause it takes a quick read of your words. **Talk over her** keeps the mic open the whole time, so it always uses Whisper.

**Tip for the backup voice:** when the free AI voice runs out for the day, she uses an iPhone voice. For the most natural one, download a Premium voice: iPhone Settings → Accessibility → Spoken Content → Voices → English, then pick one marked Premium (for example Zoe or Ava). Then choose it in Settings → Voice & Talking.

## Also new in 3.1

### Phone jobs, right in the app

These used to go through the Shortcut. Now the app does them itself, using built-in add-ons:

| Say | Now |
|---|---|
| "Remind me to call Mom tomorrow at 5pm" | Added to Reminders by the app. Understands "in 20 minutes", "tonight", "Friday morning", "on the 1st"… |
| "What's on my calendar today/tomorrow?" | Read by the app |
| "Schedule dinner with Batsie Friday at 7" | Added to Calendar by the app (7 means 7 PM for dinner) |
| "How much battery do I have?" | Answered by the app |
| Any timer | Rings through an iPhone notification, even if the app is closed (no Shortcut needed) |
| Bills and countdowns | A notification at 9 AM on the day |
| "Sync my contacts" | Contact names are kept on the phone so "text Daddy…" or "call Mom" uses the exact contact |
| "Text Mom I'm on my way" | Goes straight to the Shortcut with the exact contact name (no AI step) |
| "Set the living room lights to 40%" | In the app **if iOS gives it Home access** (see Lights test below), otherwise the Shortcut |

The Shortcut still handles what only it can do: Apple TV, HomePod and music, sending texts, calls, alarms, Do Not Disturb and opening the Camera. Settings → Phone & Shortcut shows a live list of what's done where.

### Lights test

`Friday-v3.1.1-LightsTest.ipa` (and `Jarvis-v3.1.1-LightsTest.ipa`) is the same app, plus permission for Apple Home. Install it with AltStore:

- If AltStore installs it and you allow Home access when asked, the lights run straight from the app, to the exact percent.
- If AltStore refuses it, or Home access doesn't show up, install the regular IPA. Lights keep working through the Shortcut.

Settings → Phone & Shortcut → **Check lights in the app** tells you which one you have.

### Wake her without Siri

1. In Shortcuts make a one-step shortcut: **Open URLs** → `friday://listen` (`jarvis://listen` for Jarvis). Name it "Wake Friday".
2. iPhone Settings → Accessibility → Touch → **Back Tap** → Double Tap → "Wake Friday".
3. On the iPhone 17e you can also put it on the **Action button** (Settings → Action Button → Shortcut).

Widgets now open the app already listening too.

### Settings in pages

Settings opens on a short menu: Looks & Layout, Voice & Talking, Brain & Internet, Phone & Shortcut, Routines, Messages & Contacts, Widgets, Display & Battery, Briefing & Recap, Backup & About. Each opens its own page with a back arrow.

### Looks and layouts

- Eight new HD nested fracture looks: **X5 Shattered core, X6 Ice fracture, X7 Seven-layer lattice, X8 Gold eclipse, X9 Fracture streams, X10 Twin shells, X11 Halo fracture, X12 Ember fracture**.
- Every layout has a preview.
- Four new orb-only layouts: **Full orb (immersive)**, **Orb up top**, **Orb dock**, **Orb + clock**. Swipe up for bubbles in all of them.
- **Bubbles that learn** (Looks & Layout → Layout): start with a few bubbles; the ones you use come back over time; removed ones stay removed. Turn it off to get your full layout back.

### Widgets

Five designs, each with a preview and a one-tap copy for Scriptable: **Obsidian, Clock, Up next** (your next events and reminders), **Minimal, Classic**. Tapping a widget opens the app listening.

### Talking

- **Talk time** (Voice & Talking): Short, Normal or Long. She waits longer before deciding you're done, learns the room's background noise, and gives short bursts like "um" extra time.
- Steadier speaking speed across voices and moods. AI voices follow the speed setting too.
- No gaps between sentences with AI voices: the next sentence loads while she says the current one.

### Neural map

The map grows: every memory, routine, habit, list, countdown, bill and AI connection appears as a small bubble around the part of her it belongs to. New ones pop in with a glow. New parts too: Translator, Routines, Habits, Spending, Calendar, Home, Contacts, and your partner. Tap any bubble for details.

### Read texts and emails out loud

iPhone doesn't let apps read other apps' notifications. A one-time automation can hand her texts or emails from people you pick (Settings → Messages & Contacts → "Read my texts and emails out loud"). She says "Text from Mom: …".

### Jarvis

Messages from Jarvis go to the contact **DADDY!!** by default. Jarvis still shows and says "Sky".

### Shortcut prompt (optional update)

The prompt got simpler: no listening step, full contact names ("text DADDY!! saying …"), original capitalization kept. Your current Shortcut keeps working; update it whenever you like (Settings → Phone & Shortcut).

## Also new in 3.0

### New things to say

| Say | What happens |
|---|---|
| "Lights to 40%, add milk and set a timer for 10 minutes" | She does all three, in order. If more than one part needs the Shortcut, they run one after another, and the Shortcut comes back to her between each. |
| "Movie time" | Runs your routine: lights to 20%, Apple TV on, Do Not Disturb on. Change it in Settings → Routines. |
| "I'm home" / "I'm leaving" | A welcome, or a weather heads-up if rain is likely, plus any steps you add in Settings → Routines. |
| "Tell Batsie dinner's ready" (Jarvis: "Tell Sky…") | Sent as a normal text that starts with "From Friday:". On the other phone, a small automation opens Jarvis and she reads it out loud. |
| "Recap my day" | Your day: things checked off, bills paid, spending, habits. Then tomorrow's weather and what's due. It also plays on its own the first time you open the app after 9 PM (change the time or turn it off in Settings). |
| "Bedside mode" | The charging display: big clock, orb, weather and what's next. It fades to a faint clock after 30 seconds; tap to bring it back. |
| "I spent $20 on gas" / "How much did I spend this month?" / "Undo last expense" | Spending log, shown in the Money panel under your bills. |
| "I drank a glass of water" / "I worked out" / "Track a habit called reading" / "My habits" | Habit and water tracker with streaks. Add the Habits bubble from the map's + button. |
| "How do you say thank you in Spanish?" | Translator. She says the translation with an iPhone voice for that language. |

### Voices fixed

- **iPhone voices** now really switch. The app talks to iOS directly through the new TextToSpeech add-on, so every voice in the list sounds like itself. You can download better "Enhanced" and "Premium" voices for free in iPhone Settings → Accessibility → Spoken Content → Voices.
- **AI voices** (Troy, Daniel, Austin, Hannah, Diana, Autumn): previews always use that exact voice. If Groq turns one down, she tells you why instead of quietly using the iPhone voice. Use **Test AI voices** in Settings → Voice. If Groq needs a one-time OK, open console.groq.com/playground?model=canopylabs/orpheus-v1-english, sign in and accept.
- The first tap anywhere unlocks sound on the iPhone, so AI voices don't get blocked.

### Settings

- **Hands-free conversation** (on/off): on means she listens when you open the app and after each answer.
- **Nightly recap** (on/off, time).
- **Routines**: edit phrases and steps, one command per line.
- **Messages**: the names you'll say, their name in your Contacts, and the one-time automation steps.
- **Charging display**: open it, plus optional automation so it opens when you plug in (`friday://charging`).
- **Battery**: resting orb and calmer night orb. Low Power Mode is noticed automatically.

### Message automation (one time, on each phone)

1. Shortcuts → Automation → + → **Message**.
2. Sender: the other person. Message Contains: `From Jarvis:` on Friday's phone (`From Friday:` on Jarvis's phone).
3. **Run Immediately** → New Blank Automation.
4. Add **URL Encode**, then **Open URLs** with `friday://msg?text=` followed by the URL Encoded Text variable (`jarvis://msg?text=` on Jarvis's phone).

### Battery

- The orb rests after a minute of quiet: fewer frames per second, slower motion.
- At night (night mode hours) it keeps your look, but softer and calmer.
- In Low Power Mode it switches to a lighter orb on its own.
- The charging display keeps the screen awake only while it's open. Everywhere else, your iPhone's Auto-Lock works as normal.

### Under the hood

- The app shell now includes Capacitor's App add-on, so it can receive `friday://` and `jarvis://` links from automations.
- Backups now include spending, habits and routines.
