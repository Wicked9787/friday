# Friday notes — architecture and how to keep going

This is the handoff file. Friday is a free web app (PWA) hosted on GitHub Pages. There is no IPA, no $99 Apple account, no Netlify, and no always-on computer.

Site: **https://wicked9787.github.io/friday/**  
Repo name: **friday**  
GitHub user: **Wicked9787**

If the username or repo changes, update `config.js` (`SITE_URL` and `GITHUB_USER`), the two `.mobileconfig` files in `profiles/`, the `SITE_URL` in the Scriptable scripts, and the setup guides. Or just open `make_profile.html` on the live site and download a fresh profile.

## How it is put together

- The phone opens a website that looks like an app. A configuration profile (or Add to Home Screen) puts Friday on the Home Screen with the black orb icon.
- Chat and speech go straight from the phone to Groq. The API key is typed on first launch and stored only in that phone’s localStorage. It is never in these files.
- Things a website cannot do (alarms, lights, real texts, Do Not Disturb) are handed to the **Friday 2** shortcut with `shortcuts://run-shortcut?...`
- Widgets are Scriptable scripts. They only open the site. They do not hold a key.
- Memory, notes, chat history, bubble layout, and settings live on the phone. Settings has Backup (a JSON file you can put in Files or iCloud Drive) and Restore.

## File map

```
index.html                 main screen
manifest.webmanifest       PWA name, icon, standalone, black theme
sw.js                      offline shell
config.js                  Sky and Batsie profiles, no secrets
make_profile.html          builds a Home Screen profile in Safari
css/app.css
js/orb.js                  live WebGL orb (looks N, F, M, H)
js/bubbles.js              floating bubbles + edit mode
js/voice.js                tap to talk, Whisper, fallback listener, speaking
js/chat.js                 Groq chat, persona, helpers, phone intents
js/neural.js               neural map
js/tools.js                timer, notes
js/agent.js                multi-step tasks, routines, habit learning, safety limits
js/settings.js
js/storage.js              localStorage, backup, restore
js/app.js                  puts it all together
icons/                     180, 192, 512
apple-touch-icon.png
profiles/Friday-Sky.mobileconfig
profiles/Friday-Batsie.mobileconfig
scriptable/                widget scripts
docs/                      these guides
friday-sky/                standalone copy, Sky baked in
friday-batsie/             standalone copy, Batsie baked in
```

The shared site uses `?u=sky` or `?u=batsie` and remembers the choice. One hosted repo serves both people.

## Looks

In Settings → Looks:

- **N** (default) — glossy black core, four fractured shells, gold and silver dust while talking, shells flip spin on each syllable
- **F** — streams that stay on and rise and fall while talking, plus a fractured gold shell
- **M** — N plus the streams
- **H** — fractured gold and silver particle shell around a ring core

The orb is drawn live (not a looping video). On a slower phone it will quietly drop particle count and bloom to keep moving smoothly.

## Persona

`config.js` holds the assistant name, owner name, and address terms. Sky gets a mix of “boss” and “sir.” Batsie gets “ma’am.” Change those words in `config.js` (or the baked copy) and reload.

## How to continue with a free helper (for example FreeMilk)

After this subscription ends, you can keep going with any free coding helper.

1. Give it this `NOTES.md` file and the app folder.
2. Say what you want changed (a new look, a new bubble, a bug).
3. Ask it not to put API keys in the code.
4. Upload the changed files to the same GitHub `friday` repo, overwriting the old ones. Pages will update in a minute or two.

You do not need a new host. You do not need to rebuild the profile unless the site address changes.

## Multi-step, routines, and learning

- **Several things at once:** "dim the lights to 30 percent and turn off the TV, then set a 10 minute timer." Friday works out the steps (on the phone when she can, otherwise with Groq), says the plan, runs the in-app steps (timer, note, remember, weather), and sends the home steps to the shortcut in one go, split by `;`. The shortcut needs chunks 29 and 30 for that.
- **Goals:** "get the house ready for bed" — Groq turns it into steps from the allowed list, using your Memory (for example "I like the lights at 30% at night").
- **Routines:** "when I say movie night, dim the lights to 20 percent and turn on the TV." After that, just say "movie night." Ask "what routines do I have?" or say "delete the movie night routine." They are listed in the Memory panel.
- **Habits:** if you do the same thing around the same time on 3 or more days in two weeks, she asks when you open the app ("Want lights to 30% like usual?"). "Yes" runs it, "no" skips it for today, "stop asking" ends that suggestion for good. Settings → Learn my habits turns it off.
- **What she knows:** "what do you know about me?", "forget my dog's name", "forget everything" (she asks you to confirm).
- Sky's and Batsie's copies learn separately. Each phone keeps its own.

## Safety

Already in place:

- The Groq key is never in this repo. It is typed on each phone and stays in that phone's storage. Backups leave it out unless you tick the box.
- Memory, notes, chat history, routines, and habits live only on the phone. You can see and delete them in Memory, or use Settings → Reset.
- Every phone action goes through your shortcut, and iOS makes you tap "Run in Shortcuts" first, so Friday can't change anything in your home without your tap.

Added with multi-step:

- **Allowed list only.** Friday can only use these steps: lights (on, off, percent), TV on/off, Do Not Disturb, music, cameras, good night, alarm, reminder, timer, note, remember, weather, speak. Texting, money, buying, calling, opening other apps, and deleting are not on the list. If you ask for one inside a multi-step request, she leaves it out and tells you.
- **Limits.** At most 6 steps per request, lights 0–100%, timers up to 24 hours, at most 20 routines.
- **Says it first.** She reads the plan out before the home steps run, and you still tap Run.
- **Asks, never assumes.** A habit is only ever a question. She never does one by herself.
- **Learning is yours to control.** Turn it off, clear it, or delete single items.

Worth knowing:

- What you say to Friday is sent to Groq to get her answers. Don't tell her passwords, card numbers, or anything you wouldn't want to leave the phone.
- The shortcut command "text batsie" (chunk 01) sends the text straight away. If you want a check first, turn on "Show When Run" on its Send Message step in Shortcuts.

## Known limits

- A web app cannot set alarms or change lights by itself. That is why the shortcut is still needed.
- Hands-free listening (`?listen=1`) only works while Friday is on screen. It cannot listen when the phone is locked.
- Groq has a free daily limit. If Friday says she is rate-limited, wait and try again.
- The Home Screen profile is unsigned. Apple will warn you. That is expected.
- The “Daddy” bubble opens Messages. It cannot look up the contact named DADDY!! by itself; add the number in Settings if you want it addressed.
- Backup leaves the API key out unless you check the box. If you include the key, keep that file private.
- GitHub Pages is public. That is why the key must never be committed.

## Phone commands Friday will hand off

Alarms, lights, TV, Do Not Disturb, cameras, weather, music, “good night,” “find my phone,” battery, reminders, morning briefing. Timers can run inside the app. “Remember …” is saved to Memory on the phone.
