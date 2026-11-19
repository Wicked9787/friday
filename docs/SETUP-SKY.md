# Set up Friday on your iPhone

You can do all of this from the phone, in Safari. Friday lives at:

**https://wicked9787.github.io/friday/?u=sky**

Your GitHub username is **Wicked9787**, and the repo name is **friday**. If you ever change the username or the repo name, update the two profile files in `profiles/`, the `SITE_URL` line at the top of the Scriptable scripts, and this address.

## 1. Put the app on GitHub Pages

1. In Safari, go to [github.com](https://github.com) and sign in (or create a free account).
2. Tap the **+** button, then **New repository**.
3. Name it exactly `friday`. Leave it Public. Create it.
4. On the new repo page, tap **uploading an existing file** (or Add file → Upload files).
5. Upload everything inside the main app folder: `index.html`, `config.js`, `manifest.webmanifest`, `sw.js`, `make_profile.html`, `apple-touch-icon.png`, and the `css`, `js`, `icons`, `profiles`, `scriptable`, and `docs` folders. Do not upload `friday-sky` or `friday-batsie` unless you want those extras on the site too. They are standalone copies to keep.
6. Tap **Commit changes**.
7. Open the repo’s **Settings**, then **Pages**.
8. Under Branch, pick **main** (or **master**) and the `/ (root)` folder, then Save.
9. Wait a minute. Your app is at https://wicked9787.github.io/friday/

If GitHub is under a different username later, the address becomes `https://YOUR_USERNAME.github.io/friday/`.

## 2. Put Friday on the Home Screen

The ready-made file is `profiles/Friday-Sky.mobileconfig`. It already points at `https://wicked9787.github.io/friday/?u=sky`.

**From the phone, after the site is up:**

1. In Safari, open https://wicked9787.github.io/friday/make_profile.html
2. Leave the address as the Sky one, or fix it if needed.
3. Tap **Download profile**.
4. Open the file, then go to **Settings → General → VPN & Device Management**.
5. Tap the Friday profile, then **Install**.
6. Apple will say the profile is unsigned. That is normal for a file you made yourself. It only adds a Home Screen icon.

You can also airdrop or email `Friday-Sky.mobileconfig` to yourself and open it, then install it the same way.

If you already used Safari’s **Add to Home Screen**, that works too, but the profile gives Friday her own icon and opens full screen.

## 3. Add your Groq key (stays on this phone)

1. Open Friday from the new icon.
2. Get a free key at [console.groq.com](https://console.groq.com). Make an account, open **API Keys**, and create one.
3. Paste it into Friday’s first-launch screen and save. It is stored only in this phone’s browser storage. It is not in the GitHub files.

Never share this key, and never put it in a file you upload.

## 4. Connect the Friday 2 shortcut

Friday hands phone jobs (alarms, lights, Do Not Disturb, and the like) to your **Friday 2** shortcut.

1. Confirm the shortcut on this phone is named **Friday 2** (or change the name in Friday’s Settings to match).
2. When you ask her to set an alarm or turn on the lights, she will open Shortcuts and run it with your words.

## 5. Add the widgets

See `SCRIPTABLE.md` in this folder. Use `?u=sky` in the Scriptable `SITE_URL`.

## 6. Back Tap, Siri, and Vocal Shortcuts

- **Back Tap:** Settings → Accessibility → Touch → Back Tap. Pick a tap, then choose the Friday 2 shortcut, or a shortcut that opens https://wicked9787.github.io/friday/?u=sky&listen=1
- **Siri:** In Shortcuts, open Friday 2 and add a Siri phrase such as “Hey Friday.”
- **Vocal Shortcuts:** Settings → Accessibility → Vocal Shortcuts. Add a phrase that opens the same Friday link, with `&listen=1` if you want her listening as she opens.

Hands-free listening uses `?listen=1` on the end of the address. The phone still has to keep Safari (or the Home Screen app) in front. A web app cannot listen with the screen locked.

## If something does not load

- Give GitHub Pages a few minutes after the first upload.
- Open the site in Safari first, then install the profile.
- If you moved the repo, rebuild the profile at `make_profile.html` so the icon points at the new address.
