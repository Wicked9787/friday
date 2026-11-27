# 4.2.3: Reed says he / him / his on every screen (F.R.I.D.A.Y. still says she / her), chats and memories
# are never reworded, the lights check says exactly what's wrong, and Diagnostics checks Apple Home and music.
import os, json, asyncio, re
HERE = os.path.dirname(os.path.abspath(__file__))
__file__ = os.path.join(HERE, "v42_check.py")
src = open(__file__).read()
exec(src[:src.index("\nasync def main():")])
RES = []
def chk(n, g, d=""): RES.append((n, bool(g), d))

# every bit of the app's own wording on screen that still says she / her (chats, memories and the like skipped)
SCAN = r"""() => {
  const SKIP = "#chat-thread, #type-thread, #caption, #memory-list, #note-list, #lists-box, #bills-box, #countdowns-box, #habits-box, #timers-box, #private-list, #private-current, #private-words, #private-receive, #photo-answer, #pics-box, #self-note, #self-patterns, #self-reflect, #neural-card, #neural-log, #aidot-list, #atv-list, #connections-list, #links-list, input, textarea, script, style, .only-sky, [data-keep-words]";
  const re = /\b(she|her|hers|herself)\b/i, out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null); let n;
  while ((n = w.nextNode())) { const el = n.parentElement; if (!el || el.closest(SKIP)) continue; if (re.test(n.nodeValue)) out.push(n.nodeValue.trim().slice(0, 120)); }
  document.querySelectorAll('[aria-label], [title]').forEach(e => { if (e.closest(SKIP)) return; ['aria-label', 'title'].forEach(a => { const v = e.getAttribute(a); if (v && re.test(v)) out.push('@' + a + ': ' + v); }); });
  return out;
}"""

OPEN_ALL = r"""async () => {
  document.getElementById('btn-settings').click(); await new Promise(r => setTimeout(r, 300));
  const pages = [...new Set([...document.querySelectorAll('[data-page]')].map(e => e.getAttribute('data-page')))];
  for (const p of pages) { try { window.__fridaySettingsShow(p); } catch (e) {} await new Promise(r => setTimeout(r, 120)); }
  document.querySelectorAll('details').forEach(d => d.open = true);
  document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open'));
  window.__friday.openPanel('memory'); await new Promise(r => setTimeout(r, 400));
  document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open'));
  document.getElementById('whatsnew').classList.remove('hidden'); await new Promise(r => setTimeout(r, 200));
  return pages.length;
}"""

HOME_MOCK = r"""(r) => { const H = Capacitor.Plugins.FridayHome; if (!H.__orig) H.__orig = H.list; window.__homeSeq = r; H.list = async () => { const s = window.__homeSeq; return s.length > 1 ? s.shift() : s[0]; }; FridayNative.home._status = null; }"""
HOME_CHECK = r"""async (wait) => {
  document.getElementById('btn-settings').click(); await new Promise(r => setTimeout(r, 200));
  window.__fridaySettingsShow('phone-status'); await new Promise(r => setTimeout(r, 150));
  document.getElementById('home-status').textContent = '';
  document.getElementById('btn-home-check').click(); await new Promise(r => setTimeout(r, wait || 900));
  const t = document.getElementById('home-status').textContent;
  document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open'));
  return t;
}"""

async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"])
        err = []

        # ================= Reed: he / him / his =================
        ctx, pg, e1 = await native_ctx(b, BASE_REED, "Jarvis")
        await pg.evaluate("window.__friday.chat.addMemory(\"Batsie's sister said she is coming over Friday\"); window.__friday.chat.save();")
        n = await pg.evaluate(OPEN_ALL)
        left = await pg.evaluate(SCAN)
        chk("W1 every Reed screen (all %d Settings pages, Memory, What's New) says he / him / his: no she / her left" % n, n >= 10 and not left, left[:12])
        txt = await pg.evaluate("document.body.textContent")
        chk("W2 the wording reads right: 'Show him a photo', 'Talk over him', 'his brain', 'Things he knows about you'",
            await pg.evaluate("!!document.querySelector('[aria-label=\"Show him a photo\"]')") and "Talk over him" in txt and re.search(r"\bhis (AI )?brain", txt) is not None, [t for t in ["Talk over him", "his brain"] if t not in txt])
        mem = await pg.evaluate("document.getElementById('memory-list').innerText")
        chk("W3 memories are never reworded (a memory about Batsie still says 'she')", "she is coming over" in mem, mem[:200])
        pr = await pg.evaluate("document.getElementById('private-receive').textContent")
        chk("W4 the private line note about F.R.I.D.A.Y. keeps 'herself' in Reed's app", "Friday opens and reads it by herself" in pr or ("herself" in pr and "Friday" in pr), pr)
        ph = await pg.evaluate("({ chat: document.getElementById('chat-input').placeholder, mem: document.getElementById('memory-text').placeholder, sc: document.getElementById('set-shortcut').placeholder })")
        chk("W5 his own name in the text boxes (Message Reed, Something Reed should remember, Shortcut 'Jarvis')", ph["chat"] == "Message Reed" and ph["mem"] == "Something Reed should remember" and ph["sc"] == "Jarvis", ph)
        nt = await pg.evaluate("(window.FridayPersona.say('Things she knows about you, plus a summary of older chats.'))")
        chk("W6 the neural map's own wording is his too", "Things he knows" in nt, nt)
        # wording added later by the app (a toast, the lights check) follows too
        await pg.evaluate("document.getElementById('toast').textContent = 'She saved it.'"); await pg.wait_for_timeout(150)
        tst = await pg.evaluate("document.getElementById('toast').textContent")
        chk("W7 wording the app writes later turns to 'he' too (toasts, Settings messages)", tst == "He saved it.", tst)
        await pg.evaluate("document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open')); document.getElementById('whatsnew').classList.add('hidden')")

        # ================= lights check: exactly what's wrong =================
        await pg.evaluate(HOME_MOCK, [{"authorization": "notDetermined", "lights": [], "scenes": [], "rooms": [], "homes": 0, "accessories": 0, "otherPlugs": 0, "loaded": False, "entitled": "no"}])
        h1 = await pg.evaluate(HOME_CHECK)
        chk("L1 installed without the Home permission: says so and how to fix it (SideStore, not LiveContainer), in his words", "installed without the Apple Home permission" in h1 and "SideStore" in h1 and "He still tries" in h1, h1)
        await pg.evaluate(HOME_MOCK, [{"authorization": "authorized", "lights": [], "scenes": [], "rooms": [], "homes": 0, "accessories": 0, "otherPlugs": 0, "loaded": True, "entitled": "yes"}])
        h2 = await pg.evaluate(HOME_CHECK)
        chk("L2 access on but no homes: this Apple account isn't in a home, with the invite steps (no more AltStore/LightsTest)", "isn't in any home" in h2 and "Invite People" in h2 and "AltStore" not in h2 and "LightsTest" not in h2, h2)
        await pg.evaluate(HOME_MOCK, [{"authorization": "denied", "lights": [], "scenes": [], "rooms": [], "homes": 0, "accessories": 0, "otherPlugs": 0, "loaded": True, "entitled": "yes"}])
        h3 = await pg.evaluate(HOME_CHECK)
        chk("L3 access turned off: where to turn it on", "turned off for Reed" in h3 and "Privacy & Security" in h3, h3)
        await pg.evaluate(HOME_MOCK, [{"authorization": "authorized", "lights": [], "scenes": [], "rooms": [], "homes": 0, "accessories": 0, "otherPlugs": 0, "loaded": False, "entitled": "yes"},
                                      {"authorization": "authorized", "lights": [{"name": "Lamp", "room": "Living Room"}, {"name": "Porch light", "room": "Porch"}], "scenes": ["Good Night"], "rooms": ["Living Room"], "homes": 1, "accessories": 4, "otherPlugs": 0, "loaded": True, "entitled": "yes"}])
        h4 = await pg.evaluate(HOME_CHECK, 5200)
        chk("L4 a home that's slow to load: he waits and looks again, then the lights work", "Lights work right in the app: 2 lights" in h4, h4)
        dg = await pg.evaluate(DIAG)
        chk("D1 Diagnostics checks Apple Home: 2 lights, 1 scene", "Apple Home: 2 lights, 1 scene" in dg, dg[-500:])
        await pg.evaluate(HOME_MOCK, [{"authorization": "authorized", "lights": [], "scenes": [], "rooms": [], "homes": 0, "accessories": 0, "otherPlugs": 0, "loaded": True, "entitled": "yes"}])
        await pg.evaluate("Capacitor.Plugins.FridayKit.musicStatus = async () => ({ authorization: 'authorized', songs: 0 })")
        dg2 = await pg.evaluate(DIAG)
        chk("D2 Diagnostics says when this iPhone's Apple account isn't in a home, and when the music library is empty",
            "isn't in a home" in dg2 and "Music library on this iPhone is empty" in dg2, dg2[-500:])
        await pg.evaluate("Capacitor.Plugins.FridayKit.musicStatus = async () => ({ authorization: 'denied', songs: 0 })")
        dg3 = await pg.evaluate(DIAG)
        chk("D3 Diagnostics says when Media & Apple Music access is off, with where to turn it on", "Media & Apple Music access is off" in dg3 and "Reed" in dg3, dg3[-400:])
        await pg.evaluate("Capacitor.Plugins.FridayKit.musicStatus = async () => ({ authorization: 'authorized', songs: 812 })")
        dg4 = await pg.evaluate(DIAG)
        chk("D4 ...and the song count when music is ready", "Music library: 812 songs" in dg4, dg4[-300:])
        err += e1
        await ctx.close()

        # ================= F.R.I.D.A.Y. untouched =================
        ctx, pg, e2 = await native_ctx(b, BASE_SKY)
        await pg.evaluate(OPEN_ALL)
        left2 = await pg.evaluate(SCAN)
        txt2 = await pg.evaluate("document.body.textContent")
        chk("F1 F.R.I.D.A.Y.'s screens still say she / her (nothing reworded)", len(left2) > 40 and "Talk over her" in txt2 and await pg.evaluate("!!document.querySelector('[aria-label=\"Show her a photo\"]')"), len(left2))
        pr2 = await pg.evaluate("document.getElementById('private-receive').textContent")
        chk("F2 her private line note about Reed now says 'himself'", "himself" in pr2 and "Reed" in pr2, pr2)
        await pg.evaluate(HOME_MOCK, [{"authorization": "authorized", "lights": [], "scenes": [], "rooms": [], "homes": 0, "accessories": 0, "otherPlugs": 0, "loaded": True, "entitled": "yes"}])
        h5 = await pg.evaluate(HOME_CHECK)
        chk("F3 her lights check is in her words ('She still tries')", "She still tries" in h5 and "isn't in any home" in h5, h5)
        err += e2
        await ctx.close()
        chk("Z no page errors", not [e for e in err if "PAGEERROR" in e], err[:5])
        await b.close()
    ok = sum(1 for r in RES if r[1])
    for n, g, d in RES:
        print(("ok  " if g else "XX  ") + n + ("" if g else "   -> " + json.dumps(d, default=str)[:600]))
    print("%d/%d passed" % (ok, len(RES)))

asyncio.run(main())
