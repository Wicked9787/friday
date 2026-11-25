# 4.2: Apple TV remote (voice + the remote on Settings → Lights, both apps) and the safety copy
# of everything in the Keychain (so an update that wipes the app's storage loses nothing).
import os, json, asyncio, ast
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "full.py")).read()
exec(src[:src.index("\nasync def main():")])
_f = src[src.index('        FAKE = """') + len('        FAKE = '):]
FAKE_JS = ast.literal_eval(_f[:_f.index('"""', 3) + 3])
SHOTS = os.environ.get("TEST_SHOTS", os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots"))
os.makedirs(SHOTS, exist_ok=True)
RES = []
def chk(n, g, d=""): RES.append((n, bool(g), d))

KC_ADD = r"""
(function(){
  var K = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FridayKit;
  if (!K) return;
  function db(){ try { return JSON.parse(localStorage.getItem('__kc') || '{}'); } catch (e) { return {}; } }
  function save(d){ localStorage.setItem('__kc', JSON.stringify(d)); }
  K.secretGet = async function (o) { var d = db(); return { value: d[o.key] != null ? d[o.key] : null }; };
  K.secretSet = async function (o) { var d = db(); d[o.key] = o.value; save(d); return { ok: true }; };
  K.secretDelete = async function (o) { var d = db(); delete d[o.key]; save(d); return { ok: true }; };
})();
"""

ATV_FAKE = r"""
(function(){
  var P = window.Capacitor && window.Capacitor.Plugins;
  if (!P) return;
  var A = window.__atv = { calls: [], st: { status: 'disconnected', paired: false, known: false, name: '', id: '' } };
  try { var kept = JSON.parse(localStorage.getItem('__atvfake') || 'null'); if (kept) Object.assign(A.st, kept, { status: 'disconnected' }); } catch (e) {}
  function keep() { localStorage.setItem('__atvfake', JSON.stringify({ paired: A.st.paired, known: A.st.known, name: A.st.name, id: A.st.id })); }
  function snap(x) { return Object.assign({}, A.st, x || {}); }
  function rec(n, o) { A.calls.push([n, o || {}]); }
  function act(n) { return async function (o) { rec(n, o); if (!A.st.known) return snap({ ok: false }); if (A.offline) { A.st.status = 'error'; A.st.error = 'No route to host'; return snap({ ok: true }); } A.st.status = 'connected'; return snap({ ok: true }); }; }
  P.FridayAtv = {
    status: async function () { return snap(); },
    scan: async function (o) { rec('scan', o); return { devices: A.none ? [] : [{ id: 'ATV1', name: 'Whitfield 8823', model: 'AppleTV14,1', paired: A.st.paired }] }; },
    connect: async function (o) { rec('connect', o); A.st.id = (o && o.id) || 'ATV1'; A.st.name = 'Whitfield 8823'; A.st.known = true; A.st.error = ''; A.st.status = 'connecting'; keep();
      setTimeout(function () { A.st.status = A.st.paired ? 'connected' : 'pairing'; }, 300); return snap(); },
    pin: async function (o) { rec('pin', o); if (o.pin === '1234') { A.st.status = 'connecting'; setTimeout(function () { A.st.paired = true; A.st.status = 'connected'; keep(); }, 300); } else { A.st.status = 'error'; A.st.error = 'Pairing failed'; } return snap(); },
    press: act('press'), swipe: act('swipe'), power: act('power'), skip: act('skip'), mute: act('mute'),
    forget: async function () { rec('forget'); A.st.paired = false; A.st.known = false; A.st.status = 'disconnected'; keep(); return snap(); }
  };
})();
"""

async def native_ctx(b, base, sc="Friday"):
    ctx = await b.new_context(viewport={"width": 393, "height": 852}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id="America/New_York")
    await ctx.add_init_script(SEED_V1 % {"sc": sc})
    await ctx.add_init_script(FAKE_JS + KC_ADD + ATV_FAKE)
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    pg.on("console", lambda m: errs.append("console.error " + m.text) if m.type == "error" and "429" not in m.text and "Failed to load resource" not in m.text and "Not allowed to launch" not in m.text else None)
    await pg.route("**/*", route)
    await pg.goto(base, wait_until="load"); await pg.wait_for_timeout(2600)
    await pg.evaluate("document.getElementById('whatsnew').classList.add('hidden')")
    return ctx, pg, errs

async def say(pg, text, wait=2600):
    await pg.evaluate("t => { document.getElementById('chat-input').value = t; document.getElementById('composer').dispatchEvent(new Event('submit', {cancelable:true})); }", text)
    await pg.wait_for_timeout(wait)
    return await pg.evaluate("document.getElementById('caption-line').textContent")

async def calls(pg):
    return await pg.evaluate("window.__atv.calls.map(c => c[0] + ':' + JSON.stringify(c[1]))")

async def clear_calls(pg):
    await pg.evaluate("window.__atv.calls = []")

PARSE = r"""() => {
  const T = window.FridayTV, out = {};
  const ph = ['pause the TV', 'Play the TV.', 'resume the show', 'turn off the TV', 'turn the tv on', 'turn the TV up', 'turn the TV up 5', 'turn down the tv volume by 2', 'tv volume up', 'make the tv quieter',
    'mute the TV', 'unmute the tv', 'skip back on the TV', 'skip forward 30 seconds on the TV', 'rewind the movie', 'down on the TV', 'press OK on the TV', 'go back on the tv', 'go home on the TV', 'tv left', 'go back 30 seconds on the tv',
    'hey friday, pause the tv please', 'wake up the apple tv', 'put the tv to sleep',
    'pause the music', 'turn off the lights', "what's on tv tonight", 'turn the music up', 'skip this song', 'remind me to watch tv at 8'];
  ph.forEach(p => { const c = T.parse(p); out[p] = c ? [c.fn, c.button || '', c.on === undefined ? '' : String(c.on), c.up === undefined ? '' : String(c.up), c.times || '', c.seconds || '', c.back === undefined ? '' : String(c.back)].join('|') : null; });
  return out;
}"""

LAYOUT = r"""async () => {
  window.__friday.openPanel('settings');
  document.querySelector('.smenu-item[data-page="lights"]').click();
  await new Promise(r => setTimeout(r, 500));
  const q = s => document.querySelector(s), R = el => { const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
  const page = q('#sp-lights'), first = page.querySelector('details, .row');
  return { first: first && first.id, sub: q('.smenu-item[data-page="lights"] .smenu-s') ? q('.smenu-item[data-page="lights"] .smenu-s').textContent : '',
    mute: R(q('[data-atv="mute"]')), pill: R(q('#atv-pick')), power: R(q('[data-atv="power"]')), pad: R(q('#atv-pad')),
    padIcons: [...document.querySelectorAll('#atv-pad .atv-ico')].map(e => [e.getAttribute('aria-label'), e.disabled, R(e)]),
    play: R(q('[data-atv="playpause"]')), back: R(q('[data-atv="back"]')), tv: R(q('[data-atv="tv"]')),
    current: q('#atv-current').textContent, setupShown: !q('#atv-setup').hidden, name: q('#atv-name').textContent,
    onMain: !!document.querySelector('#bubbles [data-atv], .bubbles [data-atv]') };
}"""

PADTAP = r"""async (kind) => {
  const pad = document.getElementById('atv-pad'), b = pad.getBoundingClientRect();
  const x0 = b.left + b.width / 2, y0 = b.top + b.height / 3;
  const ev = (t, x, y) => pad.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch' }));
  ev('pointerdown', x0, y0);
  if (kind === 'tap') { ev('pointerup', x0 + 2, y0 + 1); }
  else if (kind === 'hold') { await new Promise(r => setTimeout(r, 800)); ev('pointerup', x0, y0); }
  else { const d = { left: [-90, 5], right: [90, -4], up: [3, -90], down: [-2, 90] }[kind]; ev('pointermove', x0 + d[0] / 2, y0 + d[1] / 2); ev('pointerup', x0 + d[0], y0 + d[1]); }
  await new Promise(r => setTimeout(r, 300));
}"""

DIAG = r"""async () => { const a = document.getElementById('btn-diag-again'); window.__friday.openPanel('diag'); if (a) a.click(); await new Promise(r => setTimeout(r, 3500)); return document.getElementById('panel-diag').innerText; }"""

VAULT_BODY = r"""async () => {
  const kc = JSON.parse(localStorage.getItem('__kc') || '{}'), meta = JSON.parse(kc['ai.vault.meta'] || 'null');
  if (!meta) return { meta: null, keys: Object.keys(kc) };
  let body = ''; for (let i = 0; i < meta.parts; i++) body += kc['ai.vault.' + meta.gen + '.' + i] || '';
  let text = '';
  if (body.startsWith('z:')) { const bin = atob(body.slice(2)), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    text = await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); } else text = body.slice(2);
  const data = JSON.parse(text);
  return { meta, keys: Object.keys(kc), names: Object.keys(data.items), packed: body.slice(0, 2), size: body.length, text: text.length,
    hasGroq: text.indexOf('gsk_test_key') >= 0, hasAgentKey: text.indexOf('sk-test-openai') >= 0 || text.indexOf('AIza-test') >= 0, memory: data.items.memory || '' };
}"""

WIPE = r"""() => { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('friday.') === 0) ks.push(k); } ks.forEach(k => localStorage.removeItem(k)); return ks.length; }"""

STATE_NOW = r"""() => ({ memory: (window.__friday.chat.memory || []).map(m => m.text), history: (window.__friday.chat.history || []).length,
  conns: (JSON.parse(localStorage.getItem('friday.connections') || '[]')).map(c => c.name), gemKey: FridayStorage.getAgentKey('g1'), groq: FridayStorage.getApiKey(),
  look: (JSON.parse(localStorage.getItem('friday.settings') || '{}')).look, lists: localStorage.getItem('friday.lists'), atv: localStorage.getItem('friday.atv'),
  mark: !!localStorage.getItem('friday.vaultMark'), restored: JSON.parse(localStorage.getItem('friday.vaultRestored') || 'null'), info: FridayStorage.vaultInfo(),
  toast: document.getElementById('toast').textContent, setupOpen: document.getElementById('setup').classList.contains('open') })"""

async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"])
        err = []
        # ================= Apple TV =================
        ctx, pg, e1 = await native_ctx(b, BASE_SKY)
        pr = await pg.evaluate(PARSE)
        want = {
            'pause the TV': 'playpause', 'Play the TV.': 'playpause', 'resume the show': 'playpause', 'turn off the TV': 'power||false', 'turn the tv on': 'power||true',
            'turn the TV up': 'volume|||true|3', 'turn the TV up 5': 'volume|||true|5', 'turn down the tv volume by 2': 'volume|||false|2', 'tv volume up': 'volume|||true|3', 'make the tv quieter': 'volume|||false|3',
            'mute the TV': 'mute', 'unmute the tv': 'mute', 'skip back on the TV': 'skip|||||10|true', 'skip forward 30 seconds on the TV': 'skip|||||30|false', 'rewind the movie': 'skip|||||10|true',
            'down on the TV': 'press|down', 'press OK on the TV': 'press|select', 'go back on the tv': 'press|back', 'go home on the TV': 'press|tv', 'tv left': 'press|left', 'go back 30 seconds on the tv': 'skip|||||30|true',
            'hey friday, pause the tv please': 'playpause', 'wake up the apple tv': 'power||true', 'put the tv to sleep': 'power||false'}
        bad = [k for k, v in want.items() if not (pr.get(k) or "").startswith(v)]
        chk("T1 she understands TV commands by voice (play/pause, power, volume with amounts, mute, skip 10 or 30 s, arrows, OK, back, home)", not bad, {k: pr.get(k) for k in bad})
        notv = ['pause the music', 'turn off the lights', "what's on tv tonight", 'turn the music up', 'skip this song', 'remind me to watch tv at 8']
        chk("T2 everything else stays as it was: music, lights, questions about TV, reminders are not TV button presses", all(pr.get(k) is None for k in notv), {k: pr.get(k) for k in notv})
        cap = await say(pg, "pause the TV")
        c0 = await calls(pg)
        chk("T3 before pairing, a TV command tells you how to pair (Settings → Lights) and presses nothing", "Pair your Apple TV" in cap and not any(x.startswith("press") for x in c0), [cap, c0])
        lay = await pg.evaluate(LAYOUT)
        await pg.screenshot(path=os.path.join(SHOTS, "v42_remote_unpaired.png"))
        row = lambda a, c: abs((a["y"] + a["h"] / 2) - (c["y"] + c["h"] / 2)) < 6
        chk("T4 the remote is on the Lights page (first thing there), not on her main screen, and the menu says so", lay["first"] == "accord-atv" and "Apple TV remote" in lay["sub"] and not lay["onMain"], [lay["first"], lay["sub"], lay["onMain"]])
        chk("T5 laid out like the iPhone's Apple TV Remote: mute, name pill and power in one row; the big touch area under them",
            row(lay["mute"], lay["pill"]) and row(lay["pill"], lay["power"]) and lay["mute"]["x"] < lay["pill"]["x"] < lay["power"]["x"] and lay["pad"]["y"] > lay["pill"]["y"] + lay["pill"]["h"] and lay["pad"]["h"] > 280 and lay["pad"]["w"] > 300, {k: lay[k] for k in ("mute", "pill", "power", "pad")})
        pi = lay["padIcons"]
        chk("T6 inside the touch area: back 10, info, subtitles, forward 10 along the bottom (info and subtitles dimmed: the Apple TV doesn't take them this way)",
            [x[0].split(" (")[0] for x in pi] == ["Back 10 seconds", "Info", "Subtitles", "Forward 10 seconds"] and [x[1] for x in pi] == [False, True, True, False] and all(x[2]["y"] > lay["pad"]["y"] + lay["pad"]["h"] - 110 for x in pi), pi)
        chk("T7 under it: play/pause, a big back button in the middle, and the TV button, in one row",
            row(lay["play"], lay["back"]) and row(lay["back"], lay["tv"]) and lay["play"]["x"] < lay["back"]["x"] < lay["tv"]["x"] and lay["back"]["w"] > lay["play"]["w"] and lay["play"]["y"] > lay["pad"]["y"] + lay["pad"]["h"], {k: lay[k] for k in ("play", "back", "tv")})
        chk("T8 not paired yet: it says so and shows how to pair", lay["current"] == "Not paired" and lay["setupShown"], [lay["current"], lay["setupShown"]])
        # pairing: a wrong code, then the right one
        await clear_calls(pg)
        await pg.click("#btn-atv-find"); await pg.wait_for_timeout(600)
        found = await pg.evaluate("[...document.querySelectorAll('#atv-list button')].map(b => b.textContent)")
        await pg.click("#atv-list button"); await pg.wait_for_timeout(1400)
        pinShown = await pg.evaluate("!document.getElementById('atv-pin-row').hidden")
        msg1 = await pg.evaluate("document.getElementById('atv-status').textContent")
        await pg.fill("#atv-pin", "1111"); await pg.click("#btn-atv-pin"); await pg.wait_for_timeout(1200)
        msg2 = await pg.evaluate("document.getElementById('atv-status').textContent")
        chk("T9 Find my Apple TV finds it on the Wi-Fi; tapping it asks for the 4-digit code on the TV", found == ["Whitfield 8823"] and pinShown and "4-digit code" in msg1, [found, pinShown, msg1])
        chk("T10 a wrong code says it didn't work (nothing is saved as paired)", "didn't work" in msg2 and not await pg.evaluate("window.FridayTV.isSetUp()"), msg2)
        await pg.click("#btn-atv-find"); await pg.wait_for_timeout(600)
        await pg.click("#atv-list button"); await pg.wait_for_timeout(1400)
        await pg.fill("#atv-pin", "1234"); await pg.click("#btn-atv-pin"); await pg.wait_for_timeout(1800)
        msg3 = await pg.evaluate("document.getElementById('atv-status').textContent")
        st3 = await pg.evaluate("({ cur: document.getElementById('atv-current').textContent, name: document.getElementById('atv-name').textContent, saved: JSON.parse(localStorage.getItem('friday.atv') || 'null'), setup: document.getElementById('atv-setup').hidden, off: document.getElementById('atv-remote').classList.contains('atv-off') })")
        await pg.screenshot(path=os.path.join(SHOTS, "v42_remote_paired.png"))
        chk("T11 the right code pairs it: the remote shows the Apple TV's name, wakes up, and remembers it", "Paired with Whitfield 8823" in msg3 and st3["cur"] == "Whitfield 8823" and st3["name"] == "Whitfield 8823" and st3["saved"] and st3["saved"]["paired"] and not st3["off"] and st3["setup"], [msg3, st3])
        # buttons
        await clear_calls(pg)
        for sel in ['[data-atv="playpause"]', '[data-atv="back"]', '[data-atv="tv"]', '[data-atv="mute"]', '[data-atv="power"]', '[data-atv="skipback"]', '[data-atv="skipfwd"]']:
            await pg.click(sel); await pg.wait_for_timeout(150)
        await pg.click('#atv-pad .atv-dim >> nth=0', force=True); await pg.wait_for_timeout(100)
        c1 = await calls(pg)
        chk("T12 each button does its job: play/pause, back, TV (home), mute, power, back 10 s, forward 10 s; the dimmed ones do nothing",
            c1 == ['press:{"button":"playpause","times":1,"action":"click"}', 'press:{"button":"back","times":1,"action":"click"}', 'press:{"button":"tv","times":1,"action":"click"}', 'mute:{}', 'power:{}', 'skip:{"dir":"back","seconds":10}', 'skip:{"dir":"forward","seconds":10}'], c1)
        await clear_calls(pg)
        for k in ["tap", "right", "left", "up", "down", "hold"]:
            await pg.evaluate(PADTAP, k)
        c2 = await calls(pg)
        chk("T13 the touch area: tap selects, swipes move (right, left, up, down), press and hold is a long select",
            c2 == ['press:{"button":"select","times":1,"action":"click"}', 'swipe:{"dir":"right"}', 'swipe:{"dir":"left"}', 'swipe:{"dir":"up"}', 'swipe:{"dir":"down"}', 'press:{"button":"select","times":1,"action":"hold"}'], c2)
        # voice after pairing
        await pg.evaluate("window.__friday.closePanels ? window.__friday.closePanels() : document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open'))")
        vo = {}
        for ph in ["pause the TV", "turn the TV up 5", "turn off the TV", "skip back on the TV", "skip forward 30 seconds on the TV", "mute the TV", "down on the TV", "go home on the TV"]:
            await clear_calls(pg)
            await say(pg, ph, 2600)
            capx = await pg.evaluate("(window.__friday.chat.history.slice(-1)[0] || {}).content")
            vo[ph] = [capx, await calls(pg)]
        okv = (vo["pause the TV"][0] == "Paused." and vo["pause the TV"][1] == ['press:{"button":"playpause","times":1,"action":"click"}'] and
               vo["turn the TV up 5"][0] == "Turned the TV up." and vo["turn the TV up 5"][1] == ['press:{"button":"volumeup","times":5,"action":"click"}'] and
               vo["turn off the TV"][0] == "Turning off the TV." and vo["turn off the TV"][1] == ['power:{"on":false}'] and
               vo["skip back on the TV"][1] == ['skip:{"dir":"back","seconds":10}'] and vo["skip forward 30 seconds on the TV"][1] == ['skip:{"dir":"forward","seconds":30}'] and vo["skip forward 30 seconds on the TV"][0] == "Skipped ahead 30 seconds." and
               vo["mute the TV"][1] == ['mute:{}'] and vo["down on the TV"][1] == ['press:{"button":"down","times":1,"action":"click"}'] and vo["go home on the TV"][1] == ['press:{"button":"tv","times":1,"action":"click"}'])
        chk("T14 by voice once paired: she presses the right Apple TV button and says what she did (no Shortcut)", okv, vo)
        hist = await pg.evaluate("window.__friday.chat.history.slice(-2).map(m => m.role + ':' + m.content)")
        chk("T15 TV commands show up in the chat like her other in-app jobs", hist == ["user:go home on the TV", "assistant:Done."], hist)
        await pg.evaluate("window.__atv.offline = true")
        await say(pg, "pause the TV", 5000)
        capo = await pg.evaluate("(window.__friday.chat.history.slice(-1)[0] || {}).content")
        await pg.evaluate("window.__atv.offline = false")
        chk("T16 if the Apple TV can't be reached she says so plainly (no false 'Paused.')", "couldn't reach the Apple TV" in capo, capo)
        capm = await say(pg, "pause the music", 2600)
        mc = await pg.evaluate("window.__fakeCalls.filter(c => c[0] === 'music').length")
        chk("T17 'pause the music' still pauses music on the phone, not the TV", mc >= 1, [capm, mc])
        # forget
        await pg.evaluate(LAYOUT)
        await pg.evaluate("document.getElementById('atv-setup').hidden = false")
        await pg.click("#btn-atv-forget"); await pg.wait_for_timeout(500)
        fg = await pg.evaluate("({ cur: document.getElementById('atv-current').textContent, saved: localStorage.getItem('friday.atv'), set: window.FridayTV.isSetUp(), msg: document.getElementById('atv-status').textContent })")
        chk("T18 Forget this Apple TV removes the pairing on this phone (and says how to remove it on the TV)", fg["cur"] == "Not paired" and not fg["set"] and "Remotes and Devices" in fg["msg"], fg)
        err += e1
        await ctx.close()
        # Reed has it too
        ctx, pg, e2 = await native_ctx(b, BASE_REED, "Jarvis")
        lr = await pg.evaluate(LAYOUT)
        await pg.screenshot(path=os.path.join(SHOTS, "v42_remote_reed.png"))
        await pg.evaluate("localStorage.setItem('friday.atv', JSON.stringify({id:'ATV1',name:'Living Room',paired:true})); window.__atv.st.known = true; window.__atv.st.paired = true;")
        await pg.evaluate("document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open'))")
        await clear_calls(pg)
        capr = await say(pg, "pause the TV")
        cr = await calls(pg)
        chk("T19 Reed has the same remote on his Lights page and does TV commands by voice", lr["first"] == "accord-atv" and row(lr["mute"], lr["power"]) and capr == "Paused." and cr == ['press:{"button":"playpause","times":1,"action":"click"}'], [lr["first"], capr, cr])
        err += e2
        await ctx.close()
        # the website (no app): no remote buttons that pretend to work
        ctxw, pgw, e3 = await new_ctx(b, SEED_V1 % {"sc": "Friday"})
        await pgw.goto(BASE_SKY, wait_until="load"); await pgw.wait_for_timeout(2400)
        await pgw.evaluate("document.getElementById('whatsnew').classList.add('hidden')")
        lw = await pgw.evaluate(LAYOUT)
        msgw = await pgw.evaluate("document.getElementById('atv-status').textContent")
        vw = await pgw.evaluate("FridayStorage.vaultInfo()")
        chk("T20 on the website the remote says it works in the installed app, and the safety copy stays off (nothing breaks)", lw["current"] == "In the app only" and "installed app" in msgw and vw["native"] is False, [lw["current"], msgw, vw])
        err += e3
        await ctxw.close()

        # ================= safety copy =================
        ctx, pg, e4 = await native_ctx(b, BASE_SKY)
        # set things up the way she'd be after a few days: a brain with its key, a memory, a list, a look, a paired Apple TV
        await pg.evaluate("""() => {
          const c = JSON.parse(localStorage.getItem('friday.connections')); c.push({id:'g1',name:'Gemini',type:'agent',provider:'gemini',baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai',model:'gemini-2.5-flash',kind:'chat',backup:true});
          FridayStorage.set('connections', c); FridayStorage.setAgentKey('g1', 'AIza-test-gemini-key-123');
          window.__friday.chat.addMemory('Sky drives a blue truck'); window.__friday.chat.save();
          const s = JSON.parse(localStorage.getItem('friday.settings')); s.look = 'N'; FridayStorage.set('settings', s);
          FridayStorage.set('lists', {groceries: ['milk', 'eggs']}); FridayStorage.set('atv', {id:'ATV1', name:'Whitfield 8823', paired:true});
        }""")
        await pg.wait_for_timeout(300)
        saved = await pg.evaluate("FridayStorage.vaultNow()")
        vb = await pg.evaluate(VAULT_BODY)
        chk("S1 the safety copy is saved in the Keychain (packed small), with her memories, chats, settings, lists, brains and the Apple TV",
            saved and vb["meta"] and vb["packed"] == "z:" and all(n in vb["names"] for n in ["memory", "history", "settings", "lists", "connections", "atv"]) and "blue truck" in vb["memory"], {k: vb.get(k) for k in ("meta", "names", "packed", "size", "text")})
        chk("S2 no keys are ever in the safety copy (the Groq key and brain keys stay in the Keychain on their own)", not vb["hasGroq"] and not vb["hasAgentKey"] and not any(n.startswith("agentKey") or n == "apiKey" for n in vb["names"]), [vb["hasGroq"], vb["hasAgentKey"]])
        before = await pg.evaluate(STATE_NOW)
        # a normal restart: nothing to put back
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(2800)
        n1 = await pg.evaluate(STATE_NOW)
        chk("S3 a normal restart changes nothing (her storage was fine, so nothing is put back and no message)", n1["restored"] is None and n1["mark"] and "blue truck" in " ".join(n1["memory"]) and "safety copy" not in n1["toast"], [n1["restored"], n1["toast"]])
        # an update that wipes everything except the Keychain
        wiped = await pg.evaluate(WIPE)
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(6500)
        n2 = await pg.evaluate(STATE_NOW)
        chk("S4 after an update wipes her storage, everything comes back on its own: memories, chats, settings, lists, brains with their keys, the Apple TV",
            wiped > 10 and "Sky drives a blue truck" in n2["memory"] and n2["history"] == before["history"] and n2["look"] == "N" and n2["lists"] and "milk" in n2["lists"] and "Gemini" in n2["conns"] and n2["gemKey"] == "AIza-test-gemini-key-123" and n2["groq"] == "gsk_test_key_1234567890" and n2["atv"] and not n2["setupOpen"],
            {k: n2[k] for k in ("memory", "history", "look", "conns", "gemKey", "atv", "setupOpen")})
        await pg.wait_for_timeout(1500)
        t2 = await pg.evaluate("document.getElementById('toast').textContent")
        chk("S5 and she tells you the update wiped her storage and she put everything back", "safety copy" in t2 or "safety copy" in n2["toast"], [t2, n2["toast"]])
        dg = await pg.evaluate(DIAG)
        chk("S6 Diagnostics shows when the safety copy was saved and when it was used", "Safety copy saved" in dg and "Brought back from the safety copy" in dg and "Apple TV remote: paired" in dg, dg[-400:])
        await pg.evaluate("document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open'))")
        # she keeps saving: a new memory after the restore is in the next copy
        await pg.evaluate("window.__friday.chat.addMemory('Sky starts work at 9'); window.__friday.chat.save();")
        await pg.evaluate("FridayStorage.vaultNow()")
        vb2 = await pg.evaluate(VAULT_BODY)
        chunks = [k for k in vb2["keys"] if k.startswith("ai.vault.") and k != "ai.vault.meta"]
        chk("S7 after putting things back she keeps saving new things (the newest memory is in the copy, and only one complete copy is kept)", "starts work at 9" in vb2["memory"] and chunks and all(k.startswith("ai.vault." + vb2["meta"]["gen"] + ".") for k in chunks), [vb2["meta"], chunks, vb2["memory"][-120:]])
        # only the brain list missing (storage otherwise fine): brains come back with their keys
        await pg.evaluate("localStorage.setItem('friday.connections', JSON.stringify([{id:'c1',name:'YouTube',url:'youtube://',kind:'video'}]))")
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(3000)
        n3 = await pg.evaluate(STATE_NOW)
        await pg.wait_for_timeout(1000)
        t3 = await pg.evaluate("document.getElementById('toast').textContent")
        chk("S8 if only the brain list loses its brains, she puts back each brain whose key is still there and says so", "Gemini" in n3["conns"] and "ChatGPT" in n3["conns"] and n3["gemKey"] == "AIza-test-gemini-key-123" and "Brought back 2 brains" in t3, [n3["conns"], t3])
        # removing a brain on purpose keeps it removed
        await pg.evaluate("FridayStorage.set('connections', JSON.parse(localStorage.getItem('friday.connections')).filter(c => c.id !== 'g1')); FridayStorage.setAgentKey('g1', '');")
        await pg.wait_for_timeout(300)
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(3000)
        n4 = await pg.evaluate(STATE_NOW)
        chk("S9 a brain you removed stays removed after a restart (the copy follows your changes)", "Gemini" not in n4["conns"], n4["conns"])
        # Reset stays a reset
        await pg.evaluate("FridayStorage.resetAll(false)"); await pg.wait_for_timeout(500)
        kc = await pg.evaluate("Object.keys(JSON.parse(localStorage.getItem('__kc') || '{}'))")
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(4500)
        n5 = await pg.evaluate(STATE_NOW)
        chk("S10 Reset on this phone clears the safety copy too, so a reset stays a reset (nothing comes back)", not any(k.startswith("ai.vault") or k == "ai.brains" for k in kc) and "Sky drives a blue truck" not in n5["memory"] and n5["restored"] is None, [kc, n5["memory"][:3], n5["restored"]])
        err += e4
        await ctx.close()
        # a damaged copy is never overwritten, and nothing half-restores
        ctx, pg, e5 = await native_ctx(b, BASE_SKY)
        await pg.evaluate("window.__friday.chat.addMemory('Sky likes tacos'); window.__friday.chat.save();")
        await pg.evaluate("FridayStorage.vaultNow()")
        await pg.evaluate("() => { const kc = JSON.parse(localStorage.getItem('__kc')); const m = JSON.parse(kc['ai.vault.meta']); m.parts = 2; kc['ai.vault.meta'] = JSON.stringify(m); localStorage.setItem('__kc', JSON.stringify(kc)); }")
        meta0 = await pg.evaluate("JSON.parse(localStorage.getItem('__kc'))['ai.vault.meta']")
        await pg.evaluate(WIPE)
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(5000)
        await pg.evaluate("window.__friday.chat.addMemory('new thing'); window.__friday.chat.save();")
        await pg.evaluate("FridayStorage.vaultNow()")
        n6 = await pg.evaluate(STATE_NOW)
        meta1 = await pg.evaluate("JSON.parse(localStorage.getItem('__kc'))['ai.vault.meta']")
        chk("S11 if the copy can't be read she doesn't half-restore, keeps the copy untouched for the next start, and says so in Diagnostics", n6["info"]["hold"] and meta1 == meta0 and n6["restored"] is None, [n6["info"], meta0 == meta1])
        err += e5
        await ctx.close()
        await b.close()
    real = [e for e in err if "favicon" not in e]
    chk("Z no page errors", not real, real[:6])
    for n, g, d in RES:
        print(("ok  " if g else "XX  ") + n + ("" if g else "   -> " + json.dumps(d, default=str)[:900]))
    print("%d/%d passed" % (sum(1 for r in RES if r[1]), len(RES)))

asyncio.run(main())
