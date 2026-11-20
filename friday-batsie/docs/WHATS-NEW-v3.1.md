# Friday and Jarvis 3.1

## Phone jobs, right in the app

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

## Lights test

`Friday-v3.1-LightsTest.ipa` (and `Jarvis-v3.1-LightsTest.ipa`) is the same app, plus permission for Apple Home. Install it with AltStore:

- If AltStore installs it and you allow Home access when asked, the lights run straight from the app, to the exact percent.
- If AltStore refuses it, or Home access doesn't show up, install the regular IPA. Lights keep working through the Shortcut.

Settings → Phone & Shortcut → **Check lights in the app** tells you which one you have.

## Wake her without Siri

1. In Shortcuts make a one-step shortcut: **Open URLs** → `friday://listen` (`jarvis://listen` for Jarvis). Name it "Wake Friday".
2. iPhone Settings → Accessibility → Touch → **Back Tap** → Double Tap → "Wake Friday".
3. On the iPhone 17e you can also put it on the **Action button** (Settings → Action Button → Shortcut).

Widgets now open the app already listening too.

## Settings in pages

Settings opens on a short menu: Looks & Layout, Voice & Talking, Brain & Internet, Phone & Shortcut, Routines, Messages & Contacts, Widgets, Display & Battery, Briefing & Recap, Backup & About. Each opens its own page with a back arrow.

## Looks and layouts

- Eight new HD nested fracture looks: **X5 Shattered core, X6 Ice fracture, X7 Seven-layer lattice, X8 Gold eclipse, X9 Fracture streams, X10 Twin shells, X11 Halo fracture, X12 Ember fracture**.
- Every layout has a preview.
- Four new orb-only layouts: **Full orb (immersive)**, **Orb up top**, **Orb dock**, **Orb + clock**. Swipe up for bubbles in all of them.
- **Bubbles that learn** (Looks & Layout → Layout): start with a few bubbles; the ones you use come back over time; removed ones stay removed. Turn it off to get your full layout back.

## Widgets

Five designs, each with a preview and a one-tap copy for Scriptable: **Obsidian, Clock, Up next** (your next events and reminders), **Minimal, Classic**. Tapping a widget opens the app listening.

## Talking

- **Talk time** (Voice & Talking): Short, Normal or Long. She waits longer before deciding you're done, learns the room's background noise, and gives short bursts like "um" extra time.
- Steadier speaking speed across voices and moods. AI voices follow the speed setting too.
- No gaps between sentences with AI voices: the next sentence loads while she says the current one.

## Neural map

The map grows: every memory, routine, habit, list, countdown, bill and AI connection appears as a small bubble around the part of her it belongs to. New ones pop in with a glow. New parts too: Translator, Routines, Habits, Spending, Calendar, Home, Contacts, and your partner. Tap any bubble for details.

## Read texts and emails out loud

iPhone doesn't let apps read other apps' notifications. A one-time automation can hand her texts or emails from people you pick (Settings → Messages & Contacts → "Read my texts and emails out loud"). She says "Text from Mom: …".

## Jarvis

Messages from Jarvis go to the contact **DADDY!!** by default. Jarvis still shows and says "Sky".

## Shortcut prompt (optional update)

The prompt got simpler: no listening step, full contact names ("text DADDY!! saying …"), original capitalization kept. Your current Shortcut keeps working; update it whenever you like (Settings → Phone & Shortcut).
