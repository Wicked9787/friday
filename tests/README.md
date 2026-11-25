# F.R.I.D.A.Y. / Reed tests

Headless-browser tests that run the real app pages (iPhone-sized) with every outside service faked:
AI providers, web pages, Wikipedia, DuckDuckGo, Google News, and the iPhone add-ons (Keychain,
HomeKit, contacts, notifications…). No keys and no network are needed.

## Setup

```
pip install playwright pillow
python -m playwright install chromium
```

By default the tests open the app straight from this repository:
`friday-sky/index.html` (F.R.I.D.A.Y.) and `friday-batsie/index.html` (Reed).

Optional environment variables:

| Variable | What it does |
| --- | --- |
| `PROFILE=batsie` | run `full.py` / `quick.py` as Reed (default: F.R.I.D.A.Y.) |
| `APP_BASE` | test another copy, e.g. an unzipped IPA's `Payload/App.app/public/index.html` |
| `APP_BASE_SKY`, `APP_BASE_REED` | the two app pages used by the files that test both apps |
| `CHROME` | path to a Chrome to use (default: `/usr/bin/google-chrome` if present, otherwise Playwright's Chromium) |
| `LIVE=1` | print results as they happen |
| `TEST_SHOTS` | where `full.py` saves screenshots (default `tests/shots/`) |

## The suites

| File | What it covers | Time |
| --- | --- | --- |
| `brain4_check.py` | 4.x: central router (task sorting, ranking, quota, fallback, key rejection, background allowance), Groq's live request count, research (sources, reliability, verification rules, conflicts, link checks), Keychain keys (migration, restart, reset, failure), memory types, the written name F.R.I.D.A.Y. | ~6 min |
| `v42_check.py` | 4.2: Apple TV remote for both apps (voice commands, the remote's layout and buttons on Settings → Lights, pairing with a code, forget, unreachable Apple TV, the website) and the safety copy in the Keychain (what's in it, no keys, restore after a wiped update, brains-only restore, removed brains stay removed, Reset, a damaged copy) | ~3 min |
| `persona_check.py` | personality development for both apps: evidence rules, 30-day pace, reconsideration, self-started identity reviews, baseline moves, original values kept, Reset as a new era, persistence across restarts, Reed's own identity | ~2 min |
| `quick.py` | live voice, phone jobs with pretend iPhone add-ons, lights, Home, keyboard, pictures, Settings hub, Gemini voices (blocks R, R2, Q, A3, H3, K2, H2, A4, T, GV of `full.py`) | ~4 min |
| `quick2.py` | upgrade from old data, every panel, 3.0 features (blocks A, B, Y of `full.py`) | ~3 min |
| `full.py` | everything, end to end | ~20 min |

Run any of them with `python tests/<file>.py`. Each prints `ok` or `XX` for every check.

Known: `quick2.py` skips the settings block, so two checks that expect the nickname set there
("I'm home" and the nightly recap) fail in that file only. They pass in `full.py`.
