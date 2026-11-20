# Friday and Jarvis 3.0

## New things to say

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

## Voices fixed

- **iPhone voices** now really switch. The app talks to iOS directly through the new TextToSpeech add-on, so every voice in the list sounds like itself. You can download better "Enhanced" and "Premium" voices for free in iPhone Settings → Accessibility → Spoken Content → Voices.
- **AI voices** (Troy, Daniel, Austin, Hannah, Diana, Autumn): previews always use that exact voice. If Groq turns one down, she tells you why instead of quietly using the iPhone voice. Use **Test AI voices** in Settings → Voice. If Groq needs a one-time OK, open console.groq.com/playground?model=canopylabs/orpheus-v1-english, sign in and accept.
- The first tap anywhere unlocks sound on the iPhone, so AI voices don't get blocked.

## Settings

- **Hands-free conversation** (on/off): on means she listens when you open the app and after each answer.
- **Nightly recap** (on/off, time).
- **Routines**: edit phrases and steps, one command per line.
- **Messages**: the names you'll say, their name in your Contacts, and the one-time automation steps.
- **Charging display**: open it, plus optional automation so it opens when you plug in (`friday://charging`).
- **Battery**: resting orb and calmer night orb. Low Power Mode is noticed automatically.

## Message automation (one time, on each phone)

1. Shortcuts → Automation → + → **Message**.
2. Sender: the other person. Message Contains: `From Jarvis:` on Friday's phone (`From Friday:` on Jarvis's phone).
3. **Run Immediately** → New Blank Automation.
4. Add **URL Encode**, then **Open URLs** with `friday://msg?text=` followed by the URL Encoded Text variable (`jarvis://msg?text=` on Jarvis's phone).

## Battery

- The orb rests after a minute of quiet: fewer frames per second, slower motion.
- At night (night mode hours) it keeps your look, but softer and calmer.
- In Low Power Mode it switches to a lighter orb on its own.
- The charging display keeps the screen awake only while it's open. Everywhere else, your iPhone's Auto-Lock works as normal.

## Under the hood

- The app shell now includes Capacitor's App add-on, so it can receive `friday://` and `jarvis://` links from automations.
- Backups now include spending, habits and routines.
