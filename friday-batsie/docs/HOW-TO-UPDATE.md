# How to update Friday later

This is the plain-language guide for changing Friday after the Grok Bot subscription ends. You do not need Cursor, Netlify, or a paid Apple developer account. The app is a website on GitHub Pages.

Live site: https://wicked9787.github.io/friday/

- Sky’s copy: https://wicked9787.github.io/friday/?u=sky
- Batsie’s copy (Jarvis): https://wicked9787.github.io/friday/?u=batsie

Standalone folders `friday-sky/` and `friday-batsie/` are already set to one person if you would rather host or copy just that folder.

Your Groq API key stays on the phone. Never paste it into a file you upload, and never put it in this repo.

There is also a shorter version of this guide in the app: Settings → About & updating.

## Check for updates on the phone

After you upload a change, open Friday, go to Settings, and tap **Check for updates**. That unregisters the service worker, clears the offline caches, and reloads the site so you are not looking at an old copy.

If a change still does not appear, wait a minute for GitHub Pages, then try Check for updates again. If you are editing `sw.js`, you can also bump the cache name at the top (for example from `friday-shell-v3` to `friday-shell-v4`) so phones notice the new shell.

## File map

| Path | What it is |
| --- | --- |
| `index.html` | The app page: main screen, Settings, chat, notes, and other panels. |
| `css/app.css` | Colors, layout, chips, Settings tabs, and bubble arrangements. |
| `config.js` | Names, looks, layouts, default bubbles, and site URL. Sky vs Batsie live here. |
| `js/app.js` | Startup, greetings, briefing, chips, and how the pieces talk to each other. |
| `js/orb.js` | The live WebGL orb and all of the Looks. |
| `js/bubbles.js` | Bubbles, edit mode, and screen layouts (Orbit, Ring, Dock, and the rest). |
| `js/settings.js` | Settings: Looks, App icon, Layout, chips, key, backup, Check for updates. |
| `js/chat.js` | Groq chat. |
| `js/voice.js` | Listening, Whisper, and speaking. |
| `js/tools.js` | Notes and the in-app timer. |
| `js/neural.js` | The neural map. |
| `js/storage.js` | What is saved on the phone. The API key is stored here, not in the repo. |
| `sw.js` | The offline copy of the app. |
| `manifest.webmanifest` | Name, theme, and default icons. |
| `icons/` and `icons/choices/` | Home Screen icons, including the App icon picker. |
| `profiles/` | Unsigned Web Clip files that add Friday or Jarvis to the Home Screen. |
| `make_profile.html` | A page that builds a Web Clip in the browser. |
| `scriptable/` | Widget scripts. The root scripts use `?u=sky`. |
| `friday-sky/` | Sky’s standalone copy. Keep widget URLs at `?u=sky`. |
| `friday-batsie/` | Batsie’s standalone copy. Keep widget URLs at `?u=batsie`. |
| `docs/` | This guide and the setup / Shortcuts / Scriptable notes. |

If you change a file in the main app, copy the same change into `friday-sky/` and `friday-batsie/` when you want those standalone folders to stay in sync. Do not delete `js/baked.js` in those folders, and do not change Batsie’s Scriptable `SITE_URL` away from `?u=batsie`.

## Edit on the GitHub website

1. Open https://github.com/Wicked9787/friday and sign in.
2. Click the file you want to change.
3. Click the pencil (Edit this file).
4. Make your change.
5. Click Commit changes, leave the branch as `main`, and commit.
6. Wait about a minute, then open the app and tap **Check for updates**.

To add or replace a file (for example an icon):

1. In the repo, open the folder, then click Add file → Upload files.
2. Drop the file in and commit to `main`.

To replace a whole file with a new version, upload it to the same path and let GitHub overwrite it.

If the GitHub username or repo name ever changes, update `SITE_URL` and `GITHUB_USER` in `config.js`, the URLs in `docs/` and `scriptable/`, and the Web Clip URLs in `profiles/`. Batsie’s widgets should still end with `?u=batsie`.

## Edit with a free AI helper

You do not need a paid coding app. You can paste a file into a free AI helper, say what you want changed, then put the result back on GitHub.

1. On GitHub, open the file and copy all of it.
2. In the helper, paste the file and describe the change in plain language. Example: “In this Settings file, rename the Check for updates button to Refresh app. Do not change anything else.”
3. Copy the full updated file back.
4. On GitHub, edit the same file, paste the new contents, and commit to `main`.
5. On the phone, tap **Check for updates**.

If the change should also land in the standalone copies, repeat the upload for the same path under `friday-sky/` and `friday-batsie/`.

Good prompts are specific and small: one file, one job, and “keep the Groq key out of the files.”

## What you can change without touching code much

- Names, default looks, and default bubbles: `config.js`
- Shortcut name and speaking voice: Settings in the app (saved on the phone)
- Quick-reply chips, briefing, and the wake greeting: Settings in the app
- Home Screen icon: Settings → App icon, then install the new Web Clip and delete the old one
- Layout of the bubbles: Settings → Layout
- Widget links: the `SITE_URL` line at the top of each Scriptable script

## If something goes wrong

- The app looks old: Check for updates. Confirm GitHub Pages has finished on the main branch.
- The orb or a new button is missing: make sure you edited the main files and, if you use a standalone folder, copied the change there too.
- Shortcuts do not open: iOS only allows that from a tap. Use a quick-reply chip or the “Run in Shortcuts” button, not a delayed redirect.
- A widget opens the wrong person: check the script’s `SITE_URL`. Sky is `?u=sky`. Batsie is `?u=batsie`.
- You pasted a key into a file: remove it, commit the fix, and make a new Groq key if that file was public.
