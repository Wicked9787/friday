# Set up Friday on Batsie’s iPhone

Sky, this is what to send Batsie, and what she taps. She gets her own Friday, already set to call her ma’am and to use a UK English female voice when the phone has one.

**Her address:** https://wicked9787.github.io/friday/?u=batsie

Do not send Batsie your Groq API key. She should create her own, or you can type one on her phone yourself. Never put your key in a text, email, or the GitHub repo.

## What to send her

Send these three things:

1. The link https://wicked9787.github.io/friday/?u=batsie
2. The profile file `profiles/Friday-Batsie.mobileconfig` (or the make-profile link below)
3. The three Scriptable files, if she wants widgets: `Friday-Widget.js`, `Friday-LockScreen.js`, and `Friday-Clear-Background.js`. Tell her to change the `SITE_URL` at the top to the Batsie address above.

You can also send her this page.

## What she taps

1. Open the link in **Safari** on her iPhone.
2. To put Friday on the Home Screen with her own icon:
   - Open https://wicked9787.github.io/friday/make_profile.html
   - Choose **Batsie**, download the profile, then go to **Settings → General → VPN & Device Management**, tap Friday, and **Install**.
   - Apple will say the profile is unsigned. That is normal.
3. Friday will ask for a Groq API key on first launch. She goes to [console.groq.com](https://console.groq.com), makes a free account, creates a key, and pastes it there. The key stays on her phone only.
4. If she uses your Friday 2 shortcut (or a copy), she should set the shortcut name in Settings so it matches.
5. Optional: in Settings, add a number for the **Daddy** bubble. On her phone, Sky is saved as **DADDY!!**. The bubble opens Messages. If she adds the number, it can start a text to that number.

## If you set it up on her phone for her

1. Open the Batsie link in Safari.
2. Install the Batsie profile.
3. Enter a Groq key **on her phone**. Do not use a screenshot or a message to move your own key if you can avoid it. A new key for her is safer.
4. In Settings, confirm the look, the voice, and the shortcut name.
5. Add the Daddy number only if she wants it.

## Standalone copy

The folder `friday-batsie/` is a full copy of the app with Batsie’s profile already chosen, so she does not need `?u=batsie`. If she ever hosts her own GitHub Pages site, she can upload that folder as-is and build a new profile with `make_profile.html`.
