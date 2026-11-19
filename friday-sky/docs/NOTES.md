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
