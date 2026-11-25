# What's new in 4.1 · Trust

## Reed's own personality
- Reed now has the same personality system as F.R.I.D.A.Y., starting from the Reed you know: warm, easygoing, quick with a dry joke, loyal, lightly teasing.
- He reflects on your conversations while the app is open, develops a little at a time when what Batsie says backs it up, reconsiders when things conflict, and reviews his own identity when his experience warrants it. His original starting point and full history are kept.
- Everything is worded for him (he / his): Settings → Mood & Display → His own personality, the Self part of his neural map, and his reflections.

## Safer keys
- AI keys (your Groq key and every connection's key) now live in the iPhone's Keychain: this device only, readable after the phone's first unlock.
- They moved over on their own. The old copy is removed only after the Keychain copy has been written and read back. If the Keychain isn't available, the old copy keeps working.
- Reset on this phone clears them from the Keychain too, unless you keep the Groq key.

## Smarter about free use
- For Groq, she reads the real number of requests left today from Groq's replies and uses that instead of an estimate. Settings → Brains shows "left today (from Groq)" when she has the real number. Other providers are still estimated.
- Background work (reflections, learning, summaries, sorting) never uses a paid brain or the last 30% of a free brain's day. If no free brain has that much left, the work waits for another time.

## Sources she can stand behind
- A link the AI writes itself only counts if it was in the search tool's own results, or the phone opens the page and finds the claim's key words on it.
- Links from Google Search, Google News, Wikipedia and DuckDuckGo come from those services directly.
- Unconfirmed links show with a "?" and never count toward "verified." A point backed only by unconfirmed links is "uncertain."

## Tests
- The test suites are now in the repository (`tests/`) with instructions for running them.
