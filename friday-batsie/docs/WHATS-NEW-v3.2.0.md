# Friday and Jarvis 3.2.0 · Direct Lights

Coming from 2.0 or any 3.x? This one install has everything from 3.0 through 3.2.0. Your memory and settings carry over. Install it over the old one in AltStore.

## Which file is which

| File | What it is |
|---|---|
| `Friday-v3.2.0-DirectLights.ipa` | Friday 3.2.0 for Sky. |
| `Jarvis-v3.2.0-DirectLights.ipa` | **Install this one.** Jarvis 3.2.0 for Batsie. |
| `…-Backup.zip` | Everything to rebuild or reinstall later: the app, Shortcut prompt, setup notes, widgets, full source. |

The version number shows in AltStore and in the app (Settings → Backup & About).

## Direct lights with AiDot (new in 3.2)

Your AiDot (Leedarson) lights can now be switched straight from the app over your home Wi-Fi. No Shortcut, no Apple Home permission, no VPN.

**Set it up once:**

1. Make sure your lights are in the **AiDot app** and work there.
2. In the app: Settings → **Phone & Shortcut** → **AiDot lights**. Pick your country, type your AiDot email and password, tap **Sign in to AiDot**.
3. Your lights show up in a list. Tap a light's **On** button. The first time, iPhone asks to let the app find devices on your local network: tap **Allow**.

**Then just say:**

| Say | What happens |
|---|---|
| "Turn on the lights" / "Turn all off" | Every AiDot light |
| "Turn off the bedroom lamp" | Just the light whose name or room matches |
| "Lights to 40 percent" / "Dim the desk lamp" | Exact brightness |
| "Turn the bedroom lamp blue" | Colors on color bulbs (red, orange, yellow, green, teal, blue, purple, pink and more) |
| "Make the lights warm white" / "daylight" / "2700 kelvin" | White shades |
| "Are the lights on?" / "Is the bedroom lamp on?" | She checks the lights and tells you |

**Good to know:**

- **Your password stays locked** in the iPhone's Keychain. The app's own storage, backups and chat never see it. Sign out removes it.
- **At home only.** She talks to the lights over your home Wi-Fi. Away from home (or on another Wi-Fi), she hands the job to Apple Home or your Shortcut right away, like before.
- **A light she doesn't know** (for example a light that's only in Apple Home) still goes to Apple Home or your Shortcut.
- **If a light doesn't answer** (switched off at the wall), she says which one. **Find lights on Wi-Fi** looks for lights that got a new address. Added a light in AiDot? Tap **Update light list**.
- Use the same email and password as the AiDot app. If you made the AiDot account with Apple or Google sign-in, set a password in the AiDot app first.
- Your lights can stay in Apple Home too. AiDot and Apple Home both keep working.

## Paste a key: free backup brains (new in 3.2)

Settings → **Brain & Internet** → **Paste a key**. Paste any AI key and tap **Add it**. She works out whose key it is, picks a free model that service offers today, tests it, and turns it on as a **backup brain**: when Groq hits its free limit, she switches to it by herself.

| Key starts with | Service | Free? |
|---|---|---|
| `AIza…` | Google Gemini | Free tier |
| `sk-or-…` | OpenRouter | Free models |
| `gsk_…` | Groq (becomes your main key if you don't have one) | Free |
| `csk-…` | Cerebras | Free tier |
| 32 letters and numbers | Mistral | Free tier |
| `github_pat_…` | GitHub Models | Free |

The buttons under the box open each service's key page: sign in, make a key, copy it, come back and paste it. Paid keys (ChatGPT, Claude, Grok, DeepSeek) work too, but she asks first because they can cost money. You can also say "ask Gemini …" once it's added. Keys stay on this phone.

## Voice fix (3.1.4)

- **Her voice plays even on silent.** The AI voice is now marked as playback (like music or Siri), so silent mode doesn't mute her. While she talks, other music pauses and then carries on.
- **If iOS cuts her sound off** (after the mic, a call or another app), she notices within a moment, rebuilds her audio and keeps going. If that doesn't work, she finishes the sentence with the iPhone voice instead of going silent.
- **Live listening hands the audio back** as soon as it stops, and a call or Siri ends a listen cleanly.
- **Coming back from another app,** she starts a fresh listen by herself (hands-free), no tap.
- **Batsie stays Batsie.** Live listening and Whisper are told your names (Batsie, Sky, Daddy, your contacts), and if the phone still hears "Patsy", "Batsy", "Betsy" or "bats e", she turns it back into Batsie. A real contact with one of those names is left alone.
- **Music:** when she starts music, she lets it play instead of talking over it.
- **Test her voice** (Settings → Voice & Talking) plays a line and tells you how it went: AI voice, iPhone voice and why, or sound blocked.
- **Notifications:** the app now reads the real setting from iPhone Settings, so "Turn on notifications" only shows when they're really off.
- **Shortcut prompt:** a last step jumps straight back to Friday (jarvis:// for Jarvis) as soon as a job is done, except when it opens the Camera or Roku on purpose. When she hands you to a Shortcut, a call or Music, she doesn't keep listening in the background.

## In the app first (3.1.3)

She now tries every job she can right in the app, and hands it to your Shortcut only if that doesn't work.

| Job | What happens now |
|---|---|
| Lights and scenes | Tried in the app every time (no more relying on the check). "Turn all on" works. Smart plugs and switches named like a light ("Desk lamp", "Porch light") count too. |
| Music on this iPhone | Play, pause, skip, go back, start over, shuffle, and "play [artist / song / playlist / album]" from your library. If it isn't in your library, the Shortcut searches Apple Music. The first time, iOS asks to allow Media & Apple Music. |
| Calls and FaceTime | She looks up the number in your contacts. iPhone asks you to confirm the call. |
| Texts (and Friday ↔ Jarvis messages) | The message opens already written; you tap Send. iPhone never lets an app send a text without that tap. To let your Shortcut send texts on its own again, turn off Settings → Phone & Shortcut → **Texts and calls from the app**. |
| Opening apps | Already in the app. |
| HomePod, Apple TV, volume, alarms, Do Not Disturb, the Camera app | Still the Shortcut. iPhone doesn't let apps do these. |

**Check lights in the app** now tells you why, if she can't reach your lights (Home access off, no homes visible to this install, or no lights among your accessories).

The Shortcut prompt (Settings → Phone & Shortcut) also gained backup steps for "turn all on", "play [artist]" and FaceTime. Re-making your Shortcut with it is optional.

## Orb widgets

Settings → Widgets has new styles. Tap **Copy script**, then paste it into a new Scriptable script:

- **Fractured · Gold, Ice, Ember, Twin shells, Ring:** just the orb, rendered by her own HD engine, no words. Tap it to wake her.
- **StandBy clock:** a big live time over the orb. Charge the phone on its side so StandBy shows. Press and hold the widgets, tap **+**, pick **Scriptable**, then choose this script.

You can also type `fractured x7` (any of x1 to x12) or `standby` into the widget's Parameter.

## Keep talking in the background

Settings → Voice & Talking → **Keep talking in the background**: Off, 1, 3 (default), 5 or 10 minutes. If you switch apps while you're talking with her, she keeps listening and answering for that long, then goes to sleep. Back Tap or a widget wakes her. It only runs during a conversation, uses more battery while it's on, and is new: iPhone may still pause her sooner. Settings shows how long she actually stayed awake last time.

## Voices

Friday speaks with a woman's voice and Jarvis with a man's. Voice → **Automatic** is the natural AI voice: Diana for Friday, Daniel for Jarvis. If a voice of the other kind was saved from before, it goes back to Automatic once. You can still pick any voice you like afterwards.

## Neural map

- **Everything she learns becomes a bubble.** Each memory, routine, habit, list, countdown, bill and connected AI gets its own glowing bubble around the part of her it belongs to.
- **Bubbles connect to what they're about.** A memory about Batsie links to Batsie's bubble, one about rent links to Money, a birthday links to Calendar. Memories that share something (the same person, place or thing) are joined to each other too.
- **New ones arrive with a pulse** traveling from her core out to the new bubble and on to what it connects to. Its name shows for a few seconds.
- **Tap a part of her** (like Memory) to see the names of all its bubbles. **Tap a bubble** to see what it's connected to.
- **Turn it any way.** Dragging follows your finger: right turns right, up turns up, and it spins freely in every direction. Flick it and it glides, then settles into a slow turn.

## Live voice

- **She hears you live.** Your words show up on screen as you talk. This uses the iPhone's own speech recognition, so it's free and doesn't wait for a recording to upload. The first time, iOS asks to allow Speech Recognition: tap Allow.
- **She knows when you're done, like ChatGPT.** She listens to *what* you said, not just for silence. "Set a timer for…" or a trailing "and…" makes her wait; "what's the weather" gets an answer right away. Settings → Voice & Talking → **Talk time** sets how patient she is (Short, Normal, Long).
- **Smoother, more natural voice.** The AI voice clips now play back to back with even, natural pauses instead of robotic gaps. She starts talking sooner on long answers, joins short sentences into smoother phrases, and no longer reads out symbols, links or emojis.
- **Natural voice by default.** Voice → Automatic now means the natural AI voice (Diana for Friday, Daniel for Jarvis). When the free AI voice is out for the day she switches to the best iPhone voice. Any voice you picked yourself stays picked.
- **Talks like a person.** She's told to lead with the answer, use everyday words and contractions, and not open every reply with "Certainly".
- **Speed:** the AI voice changes pitch when sped up, so the speed slider only nudges it a little now. The iPhone voice still follows the slider fully.

With AirPods in, live listening uses the iPhone's mic so her voice stays full quality in your ears.

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

### Lights test (3.1)

`Friday-v3.1.4-LightsTest.ipa` (and `Jarvis-v3.1.4-LightsTest.ipa`) is the same app, plus permission for Apple Home. Install it with AltStore:

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
