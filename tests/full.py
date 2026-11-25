"""Full pre-install simulation for Friday / Jarvis 2.0 (headless Chrome, iPhone-sized)."""
import asyncio, json, os, struct, sys, time, io
from playwright.async_api import async_playwright
from PIL import Image

# Paths: by default the tests open the app straight from this repository (friday-sky/ is F.R.I.D.A.Y.,
# friday-batsie/ is Reed). Set APP_BASE / APP_BASE_REED to test another copy (like an unzipped IPA's
# Payload/App.app/public/index.html), and CHROME to use a specific Chrome; otherwise Playwright's own is used.
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
def _file_url(p): return "file://" + os.path.abspath(p)
PROFILE = os.environ.get("PROFILE", "sky")
BASE_SKY = os.environ.get("APP_BASE_SKY", _file_url(os.path.join(REPO, "friday-sky", "index.html")))
BASE_REED = os.environ.get("APP_BASE_REED", _file_url(os.path.join(REPO, "friday-batsie", "index.html")))
BASE = os.environ.get("APP_BASE", BASE_REED if PROFILE == "batsie" else BASE_SKY)
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
OUT = os.path.join(os.environ.get("TEST_SHOTS", os.path.join(HERE, "shots")), PROFILE) + "/"
os.makedirs(OUT, exist_ok=True)
STATE = {"mode": "ok", "tts": "ok", "calls": [], "stream_style": "plain"}
RESULTS = []

def ok(name, cond, detail=""):
    RESULTS.append((name, bool(cond), str(detail)[:220]))
    if os.environ.get("LIVE"):
        print(("  ok  " if cond else "  XX  ") + name + ("" if cond else "  -> " + str(detail)[:300]), flush=True)

def wav():
    sr, n = 16000, 4000
    data = b"".join(struct.pack("<h", int(3000 * ((i // 20) % 2 * 2 - 1))) for i in range(n))
    return b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 1, sr, sr * 2, 2, 16) + b"data" + struct.pack("<I", len(data)) + data

CORS = {"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"}

def chat_text(body, provider):
    msgs = body.get("messages") or []
    sysm = " ".join(m.get("content", "") for m in msgs if m.get("role") == "system" and isinstance(m.get("content"), str))
    last = msgs[-1] if msgs else {}
    if isinstance(last.get("content"), list):
        return "It's a coffee mug with a gold logo on it. The label says Morning Blend."
    if "You are a translator" in sysm: return "Buenas noches"
    if "Classify the user request" in sysm: return "chat"
    if "Extract lasting personal facts" in sysm: return '["Sky likes black coffee."]' if "coffee" in json.dumps(msgs) else "[]"
    if "Pick out things worth remembering" in sysm:
        d = json.dumps(msgs[-1:])
        out = []
        if "coffee" in d: out.append({"text": "Sky likes black coffee.", "type": "preference"})
        if "dentist" in d: out.append({"text": "Sky has a dentist appointment on Thursday.", "type": "context", "days": 3})
        if "meaner" in d: out.append({"text": "Friday should be meaner.", "type": "fact"})
        if "sister" in d: out.append({"text": "Sky's sister is named Dana.", "type": "fact"})
        return json.dumps(out)
    if "You weigh research evidence" in sysm:
        u = msgs[-1].get("content", "") if msgs else ""
        if "launches next Friday" in u:
            return json.dumps({"points": [{"text": "The new iPhone launches next Friday.", "evidence": [1], "status": "verified"}], "conflicts": [], "gaps": ""})
        return "not json"
    if "couldn't reach any" in sysm: return "I couldn't check any sources right now, so I won't guess."
    if "Research results for" in sysm:
        if "Harbor" in sysm: return "It closed on March 3, which Reuters and the AP both confirm. How long repairs will take is disputed."
        if "1889" in sysm: return "According to Wikipedia, the Eiffel Tower was completed in 1889."
        if "launches next Friday" in sysm: return "I checked a couple of sources: it launches next Friday."
        return "Here's what I found."
    if "running summary" in sysm: return "They talked about coffee, lists and bills."
    if "top two news headlines" in sysm: return "Markets opened higher today. A winter storm is moving east."
    if "You choose photos" in sysm: return "circular saw\nspeed square" if ("tools" in json.dumps(msgs) or "stairs" in json.dumps(msgs)) else "NONE"
    if "Reply with the single word" in json.dumps(msgs): return "ready"
    if provider != "groq": return provider + " here. Four."
    return "Sure thing. Here's a quick one. Why did the robot go on holiday? It needed to recharge."

async def route(r):
    url = r.request.url
    req = r.request
    # On the iPhone, Capacitor hands outside web links to Safari and the app stays put.
    # A 204 reply mimics that: the page stays where it is.
    if req.is_navigation_request() and not url.startswith("file:"):
        STATE["calls"].append(("navigate", url))
        return await r.fulfill(status=204, headers=CORS)
    if req.method == "OPTIONS":
        return await r.fulfill(status=204, headers=CORS)
    if url.startswith("file://"):
        return await r.continue_()
    if "wikipedia.org" in url:
        STATE["calls"].append(("wiki",))
        if "opensearch" in url:
            return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps(["eiffel", ["Eiffel Tower"], [""], ["https://en.wikipedia.org/wiki/Eiffel_Tower"]]))
        return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"extract": "The Eiffel Tower is a wrought-iron lattice tower in Paris, completed in 1889."}))
    if "apple.com/newsroom/iphone" in url or "theverge.com/iphone-date" in url:
        return await r.fulfill(status=200, headers={**CORS, "content-type": "text/html"}, body="<html><body><h1>iPhone</h1><p>The new iPhone launches next Friday in stores.</p></body></html>")
    if "api.openverse.org" in url:
        import urllib.parse as _u
        q = _u.parse_qs(_u.urlparse(url).query).get("q", [""])[0]
        STATE["calls"].append(("openverse", q))
        res = [{"title": q + " " + str(i), "url": "https://img.example.com/" + q.replace(" ", "-") + str(i) + ".jpg", "thumbnail": "https://img.example.com/t/" + q.replace(" ", "-") + str(i) + ".jpg", "foreign_landing_url": "https://example.com/" + str(i)} for i in range(4)]
        return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"results": res}))
    if "img.example.com" in url:
        return await r.fulfill(status=200, headers={**CORS, "content-type": "image/png"}, body=bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a5d10000000049454e44ae426082"))
    if "open-meteo" in url:
        return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"current": {"temperature_2m": 51, "weather_code": 2}, "daily": {"weather_code": [2, 61], "temperature_2m_max": [58, 47], "temperature_2m_min": [39, 35], "precipitation_probability_max": [40, 80]}}))
    provider = "groq" if "api.groq.com" in url else "Gemini" if "generativelanguage" in url else "ChatGPT" if "api.openai.com" in url else "other"
    if "BADKEY" in (req.headers.get("authorization") or ""):
        STATE["calls"].append(("badkey", url))
        return await r.fulfill(status=401, headers={**CORS, "content-type": "application/json"}, body='{"error":{"message":"invalid api key"}}')
    if "generativelanguage.googleapis.com" in url and "/openai/" not in url:
        gkey = req.headers.get("x-goog-api-key") or req.headers.get("authorization") or ""
        if "BADKEY" in gkey:
            return await r.fulfill(status=401, headers={**CORS, "content-type": "application/json"}, body='{"error":{"code":401,"message":"API key not valid"}}')
        if "-tts" in url and ":generateContent" in url:
            import base64
            bd = json.loads(req.post_data or "{}")
            vn = (((bd.get("generationConfig") or {}).get("speechConfig") or {}).get("voiceConfig") or {}).get("prebuiltVoiceConfig", {}).get("voiceName")
            STATE["calls"].append(("gem-tts", vn, url.split("/models/")[1].split(":")[0]))
            pcm = base64.b64encode(bytes(4800)).decode()
            return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "audio/L16;codec=pcm;rate=24000", "data": pcm}}]}}]}))
        if "/models?" in url or url.endswith("/models"):
            STATE["calls"].append(("models", "gemini-native", gkey[:3]))
            return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"models": [
                {"name": "models/gemini-flash-latest", "supportedGenerationMethods": ["generateContent", "countTokens"]},
                {"name": "models/gemini-pro-latest", "supportedGenerationMethods": ["generateContent"]},
                {"name": "models/text-embedding-004", "supportedGenerationMethods": ["embedContent"]}]}))
        if ":generateContent" in url:
            gb = json.loads(req.post_data or "{}")
            msgs = []
            si = gb.get("systemInstruction")
            if si: msgs.append({"role": "system", "content": " ".join(p.get("text", "") for p in si.get("parts", []))})
            for c in gb.get("contents", []):
                msgs.append({"role": "assistant" if c.get("role") == "model" else "user", "content": " ".join(p.get("text", "") for p in c.get("parts", []))})
            STATE["calls"].append(("chat", "Gemini", url.split("/models/")[1].split(":")[0], False, "native", gkey[:3]))
            text = chat_text({"messages": msgs}, "Gemini")
            return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"candidates": [{"content": {"role": "model", "parts": [{"text": "thinking...", "thought": True}, {"text": text}]}}]}))
    if url.endswith("/models"):
        STATE["calls"].append(("models", provider))
        return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"data": [{"id": "gemini-flash-latest"}, {"id": "gemini-pro-latest"}, {"id": "text-embedding-004"}]}))
    if "audio/transcriptions" in url:
        STATE["calls"].append(("transcribe",))
        try:
            pdata = req.post_data_buffer or b""
            STATE.setdefault("hints", []).append(b"Batsie" in pdata or b"Sky" in pdata)
        except Exception:
            pass
        return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"text": STATE.get("transcript", "")}))
    if "audio/speech" in url:
        STATE["calls"].append(("tts",))
        if STATE["tts"] == "429":
            return await r.fulfill(status=429, headers={**CORS}, body='{"error":{"message":"Rate limit reached: requests per day (RPD)"}}')
        if STATE["tts"] == "terms":
            return await r.fulfill(status=400, headers={**CORS}, body='{"error":{"message":"The model `canopylabs/orpheus-v1-english` requires terms acceptance. Please have the org admin accept the terms at https://console.groq.com/playground?model=canopylabs/orpheus-v1-english","type":"invalid_request_error","code":"model_terms_required"}}')
        body_tts = json.loads(req.post_data or "{}")
        STATE["calls"].append(("tts-voice", body_tts.get("voice")))
        return await r.fulfill(status=200, headers={**CORS, "content-type": "audio/wav"}, body=wav())
    if url.endswith("/chat/completions"):
        if STATE["mode"] == "down" and provider == "groq":
            return await r.abort()
        body = json.loads(req.post_data or "{}")
        model = body.get("model")
        STATE["calls"].append(("chat", provider, model, bool(body.get("stream"))))
        if provider == "groq" and STATE["mode"] == "all429":
            return await r.fulfill(status=429, headers=CORS, body='{"error":{"message":"Rate limit reached for model, requests per day"}}')
        if provider == "groq" and model == "openai/gpt-oss-20b" and STATE["mode"] == "20b429":
            return await r.fulfill(status=429, headers=CORS, body='{"error":{"message":"Rate limit reached"}}')
        if provider == "groq" and model in ("llama-3.3-70b-versatile",) and STATE["mode"] == "missing":
            return await r.fulfill(status=404, headers=CORS, body='{"error":{"message":"The model does not exist"}}')
        if body.get("tools") and STATE.get("websearch") == "fail":
            return await r.fulfill(status=503, headers=CORS, body='{"error":{"message":"tool unavailable"}}')
        if body.get("tools") and "research assistant" in json.dumps(body.get("messages")):
            STATE["calls"].append(("websearch", json.dumps(body.get("messages"))[-300:]))
            text = json.dumps({"findings": [{"claim": "The new iPhone launches next Friday.", "sources": [{"title": "Apple Newsroom", "url": "https://www.apple.com/newsroom/iphone"}, {"title": "The Verge", "url": "https://www.theverge.com/iphone-date"}]}]})
            return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"model": model, "choices": [{"message": {"content": text}}]}))
        if body.get("tools"):
            STATE["calls"].append(("websearch", json.dumps(body.get("messages"))[-300:]))
            text = "I checked online: it launches next Friday." if "shared a link" not in json.dumps(body.get("messages")) else "That article says the city opened a new park."
            return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"model": model, "choices": [{"message": {"content": text}}]}))
        if any("Wikipedia summary" in (m.get("content") or "") for m in body.get("messages", []) if isinstance(m.get("content"), str)):
            text = "According to Wikipedia, the Eiffel Tower was completed in 1889."
            return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"model": model, "choices": [{"message": {"content": text}}]}))
        text = chat_text(body, provider)
        if body.get("stream"):
            parts = []
            if STATE["stream_style"] == "think":
                parts += ["<thi", "nk>private ", "thoughts</think>"]
            words = text.split(" ")
            for w in words:
                parts.append(w[: len(w) // 2]); parts.append(w[len(w) // 2:] + " ")
            sse = "".join("data: " + json.dumps({"choices": [{"delta": {"content": p}}]}) + "\n\n" for p in parts if p) + "data: [DONE]\n\n"
            return await r.fulfill(status=200, headers={**CORS, "content-type": "text/event-stream"}, body=sse)
        return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"model": model, "choices": [{"message": {"content": text}}]}))
    if "api.anthropic.com" in url:
        return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"content": [{"type": "text", "text": "Claude here."}]}))
    return await r.abort()

SEED_V1 = """
if (!localStorage.getItem('__seeded')) {
  localStorage.setItem('__seeded','1');
  localStorage.setItem('friday.apiKey','gsk_test_key_1234567890');
  localStorage.setItem('friday.settings', JSON.stringify({render:'hd', renderMax33:true, look:'H2', layout:'ring', voiceURI:'', shortcutName:'%(sc)s', widgetStyle:'clear', daddySms:'', iconId:'', morningBriefing:true, wakeGreeting:true, chips:[{id:'alarm',label:'Set alarm',type:'shortcut',command:'set an alarm'},{id:'weather',label:"What's the weather",type:'weather',command:''}]}));
  localStorage.setItem('friday.memory', JSON.stringify([{text:'Sky likes black coffee.',at:'2026-11-01T10:00:00Z'},{text:"Batsie's birthday is November 23.",at:'2026-11-02T10:00:00Z',auto:true},{text:'The spare key is in the blue jar.',at:'2026-11-03T10:00:00Z'}]));
  localStorage.setItem('friday.notes', JSON.stringify([{text:'Buy a charger',at:'2026-11-19T10:00:00Z'},{text:'Call the dentist',at:'2026-11-18T10:00:00Z'}]));
  var h=[]; for (var i=0;i<24;i++) h.push({role: i%%2?'assistant':'user', content: 'old message '+i, at: '2026-11-1'+(i%%9)+'T10:00:00Z'});
  localStorage.setItem('friday.history', JSON.stringify(h));
  localStorage.setItem('friday.connections', JSON.stringify([{id:'a1',name:'ChatGPT',type:'agent',provider:'openai',baseUrl:'https://api.openai.com/v1',model:'gpt-5-mini',kind:'chat'},{id:'c1',name:'YouTube',url:'youtube://',kind:'video'}]));
  localStorage.setItem('friday.agentKey.a1','sk-test-openai');
  var d=new Date(); localStorage.setItem('friday.briefingDate', JSON.stringify(d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()));
}
"""

async def new_ctx(b, seed=None, tz="America/New_York"):
    ctx = await b.new_context(viewport={"width": 393, "height": 852}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id=tz)
    if seed:
        await ctx.add_init_script(seed)
    pg = await ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    pg.on("console", lambda m: errs.append("console.error " + m.text) if m.type == "error" and "429" not in m.text and "Failed to load resource" not in m.text and "Not allowed to launch" not in m.text else None)
    await pg.route("**/*", route)
    return ctx, pg, errs

async def say(pg, text, wait=2500):
    await pg.evaluate("t => { document.getElementById('chat-input').value = t; document.getElementById('composer').dispatchEvent(new Event('submit', {cancelable:true})); }", text)
    await pg.wait_for_timeout(wait)
    return await pg.evaluate("document.getElementById('caption-line').textContent")

async def close_panels(pg):
    await pg.evaluate("document.querySelectorAll('.panel.open').forEach(p=>p.classList.remove('open'))")
    await pg.evaluate("(()=>{const b=document.getElementById('run-shortcut-btn'); if(b) b.remove(); const m=document.getElementById('open-messages-btn'); if(m) m.remove();})()")

async def idle(pg, ms=20000):
    t0 = time.time()
    while time.time() - t0 < ms / 1000:
        st = await pg.evaluate("({speaking: !!(window.__fv && window.__fv.speaking)})")
        if not st["speaking"]: return True
        await pg.wait_for_timeout(250)
    return False

async def main():
    sc = "Jarvis" if PROFILE == "batsie" else "Friday"
    term = "ma'am" if PROFILE == "batsie" else "boss"
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"])

        # ---------- A. upgrade from v1 data ----------
        ctx, pg, errs = await new_ctx(b, SEED_V1 % {"sc": sc})
        await pg.goto(BASE, wait_until="load")
        await pg.wait_for_timeout(2500)
        wn = await pg.evaluate("!document.getElementById('whatsnew').classList.contains('hidden')")
        ok("A1 what's new card shows once after upgrade", wn)
        await pg.screenshot(path=OUT + "A1-whatsnew.png")
        await pg.click("#btn-wn-close")
        st = json.loads(await pg.evaluate("JSON.stringify({look: JSON.parse(localStorage.getItem('friday.settings')).look, layout: document.getElementById('stage').className, mem: JSON.parse(localStorage.getItem('friday.memory')).length, notes: JSON.parse(localStorage.getItem('friday.notes')).length, hist: JSON.parse(localStorage.getItem('friday.history')).length, last: JSON.stringify(JSON.parse(localStorage.getItem('friday.history')).slice(-1)[0] || {}), seen: JSON.parse(localStorage.getItem('friday.seenVersion')), render: JSON.parse(localStorage.getItem('friday.settings')).render})"))
        ok("A2 your look kept (H2)", st["look"] == "H2", st)
        ok("A3 your layout kept (ring)", "layout-ring" in st["layout"], st["layout"])
        # after 9 PM her nightly recap adds one line on its own; that's expected
        ok("A4 memories, notes and chat kept", st["mem"] == 3 and st["notes"] == 2 and (st["hist"] == 24 or (st["hist"] == 25 and "Here's your day" in st["last"])), st)
        # (the other checks run in HD so the test browser stays quick; this one checks the real update)
        ctxm, pm, errm = await new_ctx(b, (SEED_V1 % {"sc": sc}).replace("render:'hd', renderMax33:true, ", ""))
        await pm.goto(BASE, wait_until="load"); await pm.wait_for_timeout(2000)
        rm = await pm.evaluate("({r: JSON.parse(localStorage.getItem('friday.settings')).render, q: window.__friday.orb.quality.name, on: document.getElementById('render-max').classList.contains('on')})")
        await ctxm.close()
        ok("A5 Max (best quality) is the render after the update", rm["r"] == "max" and rm["q"] == "max" and rm["on"], rm)
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(1500)
        wn2 = await pg.evaluate("!document.getElementById('whatsnew').classList.contains('hidden')")
        ok("A6 what's new does not show again", not wn2)
        await pg.evaluate("window.__fv = window.__friday && null")
        await pg.evaluate("(()=>{ try { window.__fv = null; } catch(e){} })()")
        cap = await say(pg, "ask ChatGPT what is 2 plus 2", 3000)
        ok("A7 old ChatGPT connection still works", "ChatGPT says" in cap, cap)

        # ---------- B. every panel opens and closes ----------
        await close_panels(pg)
        panels = {}
        for btn, pid in [("#btn-settings", "settings"), ("#btn-chat", "chat"), ("#btn-neural", "neural")]:
            await pg.click(btn); await pg.wait_for_timeout(400)
            panels[pid] = await pg.evaluate(f"document.getElementById('panel-{pid}').classList.contains('open')")
            await pg.evaluate(f"document.querySelector('#panel-{pid} [data-close]').click()"); await pg.wait_for_timeout(200)
        for phrase, pid in [("read my notes", "notes"), ("what's on my grocery list", "lists"), ("what bills are due", "money")]:
            await say(pg, phrase, 2200)
            panels[pid] = await pg.evaluate(f"document.getElementById('panel-{pid}').classList.contains('open')")
            await pg.screenshot(path=OUT + f"B-{pid}.png")
            await close_panels(pg)
        await say(pg, "set a pasta timer for 30 minutes", 2200)
        panels["timer"] = await pg.evaluate("document.getElementById('panel-timer').classList.contains('open')")
        await pg.evaluate("document.getElementById('btn-open-countdowns').click()"); await pg.wait_for_timeout(300)
        panels["countdowns"] = await pg.evaluate("document.getElementById('panel-countdowns').classList.contains('open')")
        # The 30-minute timer also goes to the iPhone; let her finish talking so the
        # "Run in Shortcuts" button has appeared before we clear the screen for the next tap.
        await idle(pg); await pg.wait_for_timeout(400)
        bcap = await pg.evaluate("document.getElementById('caption-line').textContent")
        ok("B long timer asks before putting it on the iPhone (3.5.7: nothing runs until you say yes)", "Shortcut?" in bcap and not await pg.evaluate("!!document.getElementById('run-shortcut-btn')"), bcap)
        await say(pg, "yes", 2500); await idle(pg); await pg.wait_for_timeout(400)
        ok("B after 'yes' the long timer goes to the iPhone", await pg.evaluate("!!document.getElementById('run-shortcut-btn')"))
        # On the iPhone the Shortcuts app takes over here. In the test browser that
        # shortcuts:// link never finishes loading, so reload to clear it.
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(1500)
        await close_panels(pg)
        mem_bubble = await pg.evaluate("(()=>{ const b=[...document.querySelectorAll('#bubbles .bubble')].find(x=>/memory/i.test(x.textContent)); if(!b) return false; b.id='__memb'; return true; })()")
        if mem_bubble:
            box = await pg.evaluate("(()=>{const r=document.getElementById('__memb').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2];})()")
            await pg.touchscreen.tap(box[0], box[1])
        await pg.wait_for_timeout(500)
        panels["memory"] = await pg.evaluate("document.getElementById('panel-memory').classList.contains('open')") if mem_bubble else "no bubble"
        await pg.screenshot(path=OUT + "B-memory.png")
        for k, v in panels.items():
            ok("B panel opens: " + k, v is True, v)
        # memory editor
        if panels.get("memory") is True:
            await pg.fill("#memory-search", "coffee"); await pg.wait_for_timeout(200)
            n = await pg.evaluate("document.querySelectorAll('#memory-list .mem-card').length")
            ok("B memory search filters", n >= 1 and n < 4, n)
            await pg.fill("#memory-search", "")
            await pg.evaluate("[...document.querySelectorAll('#memory-list .mem-acts button')].find(b=>b.textContent==='Pin').click()")
            pinned = await pg.evaluate("JSON.parse(localStorage.getItem('friday.memory')).filter(m=>m.pinned).length")
            ok("B memory pin works", pinned >= 1, pinned)
            await pg.evaluate("[...document.querySelectorAll('#memory-list .mem-acts button')].find(b=>b.textContent==='Edit').click()")
            await pg.evaluate("(()=>{const ta=document.querySelector('#memory-list textarea'); ta.value='Edited memory text'; [...document.querySelectorAll('#memory-list button')].find(b=>b.textContent==='Save').click();})()")
            edited = await pg.evaluate("JSON.parse(localStorage.getItem('friday.memory')).some(m=>m.text==='Edited memory text')")
            ok("B memory edit works", edited)
        await close_panels(pg)

        # ---------- C. settings controls ----------
        await pg.click("#btn-settings"); await pg.wait_for_timeout(400)
        # 3.1: settings are split into pages; show them all so the old checks can reach every control
        await pg.evaluate("document.querySelectorAll('#panel-settings .spage').forEach(p=>p.hidden=false)")
        await pg.evaluate("['accord-looks','accord-voice','accord-brain','accord-mood','accord-addai','accord-shortcut','accord-widgets'].forEach(id=>document.getElementById(id).open=true)")
        await pg.wait_for_timeout(600)
        await pg.evaluate("document.getElementById('render-og').click()"); await pg.wait_for_timeout(1200)
        r1 = await pg.evaluate("JSON.parse(localStorage.getItem('friday.settings')).render")
        await pg.evaluate("document.getElementById('render-hd').click()"); await pg.wait_for_timeout(1200)
        r2 = await pg.evaluate("JSON.parse(localStorage.getItem('friday.settings')).render")
        q2 = await pg.evaluate("window.__friday.orb.quality.name")
        await pg.evaluate("document.getElementById('render-max').click()"); await pg.wait_for_timeout(1200)
        r3 = await pg.evaluate("JSON.parse(localStorage.getItem('friday.settings')).render")
        q3 = await pg.evaluate("({q: window.__friday.orb.quality.name, w: document.getElementById('orb-canvas').width, cw: document.getElementById('orb-canvas').clientWidth})")
        ok("C render switch saves (original, HD, then Max)", r1 == "original" and r2 == "hd" and r3 == "max" and q2 in ("ultra", "high", "med", "low"), (r1, r2, r3, q2))
        ok("C Max draws above screen resolution (or eases back to full sharpness if the phone is slow)", q3["q"] in ("max", "ultra") and q3["w"] >= q3["cw"] * 2, q3)
        await pg.evaluate("document.getElementById('render-hd').click()"); await pg.wait_for_timeout(600)
        rows = await pg.evaluate("document.querySelectorAll('#voice-list .voice-row').length")
        plays = await pg.evaluate("document.querySelectorAll('#voice-list .voice-play').length")
        ok("C voice list has a preview button on every voice", rows >= 7 and rows == plays, (rows, plays))
        STATE["calls"].clear()
        await pg.evaluate("document.querySelectorAll('#voice-list .voice-play')[1].click()")
        await pg.wait_for_timeout(2500)
        tts = len([c for c in STATE["calls"] if c[0] == "tts"])
        ok("C AI voice preview fetches the voice", tts >= 1, tts)
        still_auto = await pg.evaluate("JSON.parse(localStorage.getItem('friday.settings')).voiceURI")
        ok("C preview does not change the chosen voice", still_auto == "", still_auto)
        await pg.evaluate("document.querySelectorAll('#voice-list .voice-row')[1].click()")
        chosen = await pg.evaluate("JSON.parse(localStorage.getItem('friday.settings')).voiceURI")
        ok("C tapping a voice chooses it", chosen == "ai:troy", chosen)
        await pg.evaluate("(()=>{const s=document.getElementById('set-voice-speed'); s.value='1.15'; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change'));})()")
        spd = await pg.evaluate("JSON.parse(localStorage.getItem('friday.settings')).voiceSpeed")
        ok("C speed slider saves", abs(spd - 1.15) < 0.001, spd)
        for tid, key in [("set-fast", "fastReplies"), ("set-barge", "bargeIn"), ("set-news", "briefingNews"), ("set-iphone-timers", "iphoneTimers"), ("set-night", "nightMode")]:
            before = await pg.evaluate(f"document.getElementById('{tid}').checked")
            await pg.evaluate(f"document.getElementById('{tid}').click()")
            after = await pg.evaluate(f"JSON.parse(localStorage.getItem('friday.settings')).{key}")
            ok(f"C toggle {key} saves", after == (not before), (before, after))
            await pg.evaluate(f"document.getElementById('{tid}').click()")
        await pg.evaluate("[...document.querySelectorAll('#mood-row button')].find(b=>b.dataset.mood==='hype').click()")
        mood = await pg.evaluate("JSON.parse(localStorage.getItem('friday.settings')).mood")
        ok("C mood buttons save", mood == "hype", mood)
        await pg.evaluate("[...document.querySelectorAll('#mood-row button')].find(b=>b.dataset.mood==='normal').click()")
        prompt = await pg.evaluate("document.getElementById('shortcut-prompt').value")
        ok("C Shortcut prompt has no door lock and no weather steps", "door" not in prompt.lower() and "weather" not in prompt.lower(), "")
        ok("C Shortcut prompt sets exact light percentages", "brightness to exactly that number" in prompt and "homepod" in prompt.lower(), "")
        ok("C Shortcut prompt never talks or listens", "Do not add any Speak Text or Dictate Text step" in prompt, "")
        ok("C Shortcut prompt ends by jumping straight back to this app (not after opening the Camera)", (sc.lower() + "://") in prompt and "goes straight back to " + sc in prompt and "{BACK_URL}" not in prompt and "steps 14 or 15" in prompt, prompt[-260:])
        # add a Gemini backup brain
        await pg.select_option("#conn-type", "gemini"); await pg.wait_for_timeout(200)
        await pg.fill("#conn-key", "AIza-test")
        await pg.evaluate("document.getElementById('btn-conn-models').click()"); await pg.wait_for_timeout(3000)
        nmodels = await pg.evaluate("document.querySelectorAll('#conn-models option').length")
        ok("C Find models lists chat models (not embeddings)", nmodels == 2, nmodels)
        bk = await pg.evaluate("document.getElementById('conn-backup').checked")
        ok("C free AIs default to Backup brain", bk)
        await pg.evaluate("document.getElementById('btn-conn-add').click()"); await pg.wait_for_timeout(400)
        conns = await pg.evaluate("JSON.parse(localStorage.getItem('friday.connections')).filter(c=>c.type==='agent').map(c=>c.name+':'+!!c.backup).join(',')")
        ok("C Gemini saved as backup brain", "Gemini:true" in conns, conns)
        await pg.evaluate("[...document.querySelectorAll('#connections-list .btn')].find(b=>b.textContent==='Test' && b.closest('.connection-row').textContent.includes('Gemini')).click()")
        await pg.wait_for_timeout(3500)
        toast = await pg.evaluate("document.getElementById('toast').textContent")
        ok("C Test button reports working", "working" in toast, toast)
        await pg.screenshot(path=OUT + "C-settings.png")
        await close_panels(pg)

        # ---------- D. voice commands ----------
        await pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('friday.settings')); s.voiceURI=''; localStorage.setItem('friday.settings', JSON.stringify(s));})()")
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(1500)
        cmds = [
            ("add milk, eggs and coffee to my grocery list", "Added milk, eggs and coffee", None),
            ("we're out of paper towels", "Added paper towels", None),
            ("check off eggs", "Checked off eggs", None),
            ("add call mom to my to-do list", "Added call mom", None),
            ("add my electric bill for 142 dollars due on the 22nd", "Electric bill for $142", None),
            ("I paid the electric bill", "Marked your Electric bill as paid", None),
            ("add a countdown for the beach trip on March 5th", "Countdown set", None),
            ("how many days until christmas", "Christmas is", None),
            ("set a laundry timer for 45 seconds", "Laundry timer set for 45 seconds", None),
            ("how much time is left", "left", None),
            ("cancel the laundry timer", "Cancelled the laundry timer", None),
            ("note that I parked on level 3", "Noted", None),
            ("remember that my favorite color is gold", "", None),
            ("focus mode", "Focus mode", None),
            ("back to normal", "Back to normal", None),
            ("what's the weather", "51°", None),
            ("will it rain tomorrow", "tomorrow's forecast", None),
            ("change my lights to 50%", "shortcut", "change my lights to 50%"),
            ("dim the living room lights", "shortcut", "dim the living room lights"),
            ("turn on the tv", "shortcut", "turn on the tv"),
            ("play some music on the homepod", "shortcut", "play some music on the homepod"),
            ("pause", "shortcut", "pause"),
            ("set an alarm for 7 am", "shortcut", "set an alarm for 7 am"),
            ("remind me to take out the trash at 8pm", "shortcut", "remind me to take out the trash at 8pm"),
            ("what's on my calendar today", "shortcut", "what's on my calendar today"),
            ("turn on do not disturb", "shortcut", "turn on do not disturb"),
            ("how much battery do I have", "shortcut", "how much battery do i have"),
            ("show me the cameras", "Pulling up the cameras", None),
            ("good night", "shortcut", "good night"),
            ("lock the front door", "NOT_SHORTCUT", None),
            ("find my phone", "NOT_SHORTCUT", None),
            ("take me to the nearest gas station", "Opening Maps", None),
            ("what is this", "camera button", None),
            ("tell me a joke", "recharge", None),
            ("text mom saying I'm on my way", "Texting mom", "text mom saying i'm on my way"),
        ]
        for phrase, expect, sc_text in cmds:
            await close_panels(pg)
            cap = await say(pg, phrase, 2600)
            href = await pg.evaluate("(document.getElementById('run-shortcut-btn')||{}).href || ''")
            if expect == "NOT_SHORTCUT":
                good = "shortcuts://" not in href
            elif sc_text:
                import urllib.parse
                good = ("shortcuts://" in href) and (urllib.parse.quote(sc_text) in href.lower() or urllib.parse.quote(sc_text).replace("%27", "'") in href.lower())
            else:
                good = expect.lower() in cap.lower()
            ok("D \"" + phrase + "\"", good, cap + (" | " + href[:90] if href else ""))
        mem = await pg.evaluate("JSON.parse(localStorage.getItem('friday.memory')).some(m=>/favorite color is gold/.test(m.text))")
        ok("D 'remember that…' saves to memory", mem)
        hon = await say(pg, "set a timer for 2 seconds", 5000)
        ok("D timer done uses the right honorific", term in hon, hon)

        # ---------- W. internet ----------
        await close_panels(pg)
        STATE["calls"].clear()
        cap = await say(pg, "search for the new iPhone release date", 4000)
        srcs = await pg.evaluate("[...document.querySelectorAll('#srcs .src-chip')].map(b => b.textContent)")
        ok("W 'search for…' checks several sources and shows them (✓ = verified by two sites)", any(c[0] == "websearch" for c in STATE["calls"]) and "launches next Friday" in cap and any("✓ apple.com" in x for x in srcs) and any("theverge.com" in x for x in srcs), [cap, srcs])
        STATE["calls"].clear()
        cap = await say(pg, "what does this say https://example.com/news/park", 4000)
        ok("W reads a link you paste", "article says" in cap and any("example.com" in c[1] for c in STATE["calls"] if c[0] == "websearch"), cap)
        cap = await say(pg, "open amazon.com", 2500)
        ok("W 'open amazon.com' opens the website", "Opening amazon.com" in cap and any(c[0] == "navigate" and "amazon.com" in c[1] for c in STATE["calls"]), cap)
        STATE["websearch"] = "fail"; STATE["calls"].clear()
        cap = await say(pg, "when was the eiffel tower built", 7000)
        ok("W web search busy → other sources (Wikipedia) still answer", "1889" in cap and any(c[0] == "wiki" for c in STATE["calls"]), cap)
        STATE["websearch"] = "ok"

        # ---------- X. efficiency upgrades ----------
        await close_panels(pg)
        STATE["calls"].clear()
        cap = await say(pg, "what time is it", 1500)
        ok("X instant answer: time (no AI call)", cap.startswith("It's") and not [c for c in STATE["calls"] if c[0] == "chat"], cap)
        STATE["calls"].clear()
        cap = await say(pg, "what's a 20% tip on 45 dollars", 1500)
        ok("X instant answer: tip math (no AI call)", "$9.00" in cap and not [c for c in STATE["calls"] if c[0] == "chat"], cap)
        STATE["calls"].clear()
        cap = await say(pg, "tell me a fun fact about cats", 4000)
        chats = [c for c in STATE["calls"] if c[0] == "chat"]
        ok("X a normal chat uses fewer AI calls (no sorting call)", bool(chats) and chats[0][2] != "llama-3.1-8b-instant", [c[2] for c in chats])
        await close_panels(pg)
        cap = await say(pg, "run diagnostics", 5000)
        diag = await pg.evaluate("document.getElementById('panel-diag').classList.contains('open') ? document.getElementById('diag-list').innerText : ''")
        ok("X 'run diagnostics' checks her systems", "Groq key works" in diag and "Shortcut name" in diag, diag[:160])
        orb_paused = await pg.evaluate("!window.__friday.orb.running")
        ok("X orb pauses behind full-screen panels", orb_paused)
        await pg.evaluate("document.querySelector('#panel-diag [data-close]').click()")
        await pg.wait_for_timeout(300)
        orb_back = await pg.evaluate("window.__friday.orb.running")
        ok("X orb resumes when the panel closes", orb_back)
        await ctx.set_offline(True)
        cap = await say(pg, "tell me a story", 2500)
        ok("X offline: friendly message, no waiting", "offline" in cap.lower(), cap)
        cap = await say(pg, "add batteries to my grocery list", 2000)
        ok("X offline: lists still work", "Added batteries" in cap, cap)
        await ctx.set_offline(False)
        await pg.evaluate("document.getElementById('btn-settings').click(); document.getElementById('accord-brain').open=true")
        await pg.wait_for_timeout(400)
        meter = await pg.evaluate("document.getElementById('brain-status').textContent")
        ok("X usage meter shows today's replies", "Today:" in meter and "replies" in meter, meter[-120:])
        await close_panels(pg)

        # ---------- E. brain fallback ----------
        await close_panels(pg)
        STATE["calls"].clear(); STATE["mode"] = "20b429"
        cap = await say(pg, "tell me something fun", 4000)
        used = [c for c in STATE["calls"] if c[0] == "chat" and c[3]]
        ok("E one Groq model at its limit → next Groq model answers", "recharge" in cap and any(c[2] == "openai/gpt-oss-120b" for c in used), [c[2] for c in used])
        STATE["calls"].clear(); STATE["mode"] = "all429"
        cap = await say(pg, "tell me something else", 6000)
        ok("E all Groq models busy → Gemini backup brain answers", "Gemini here" in cap, cap)
        await pg.evaluate("(()=>{const c=JSON.parse(localStorage.getItem('friday.connections')); c.forEach(x=>x.backup=false); localStorage.setItem('friday.connections', JSON.stringify(c));})()")
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(1200)
        cap = await say(pg, "and one more", 8000)
        ok("E no backup → clear 'at its limit' message", "limit" in cap.lower(), cap)
        STATE["mode"] = "down"
        cap = await say(pg, "are you there", 6000)
        ok("E no internet → friendly message, no crash", "reach" in cap.lower() or "internet" in cap.lower(), cap)
        STATE["mode"] = "ok"
        STATE["stream_style"] = "think"
        cap = await say(pg, "tell me a joke", 4000)
        ok("E hidden <think> text never spoken", "private" not in cap and "recharge" in cap, cap)
        STATE["stream_style"] = "plain"

        # ---------- G. AI voice + fallback ----------
        await pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('friday.settings')); s.voiceURI='ai:diana'; localStorage.setItem('friday.settings', JSON.stringify(s)); localStorage.setItem('friday.aiVoicePauseUntil','0');})()")
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(1200)
        STATE["calls"].clear(); STATE["tts"] = "ok"
        t0 = time.time()
        cap = await say(pg, "tell me a joke", 8000)
        tts = len([c for c in STATE["calls"] if c[0] == "tts"])
        done = await pg.evaluate("document.getElementById('caption-line').textContent")
        ok("G AI voice used for replies", tts >= 1, tts)
        STATE["tts"] = "429"; STATE["calls"].clear()
        cap = await say(pg, "tell me another joke", 9000)
        pause = await pg.evaluate("JSON.parse(localStorage.getItem('friday.aiVoicePauseUntil')||'0')")
        ok("G AI voice limit → rests and falls back to iPhone voice", pause > time.time() * 1000, pause)
        cap2 = await say(pg, "what's on my grocery list", 4000)
        ok("G app keeps working after voice fallback", "grocery list" in cap2.lower(), cap2)
        STATE["tts"] = "ok"

        # ---------- V. voice picker (3.0 fixes) ----------
        await pg.evaluate("(()=>{document.getElementById('panel-settings').classList.add('open'); document.getElementById('accord-voice').open = true;})()")
        await pg.wait_for_timeout(500)
        STATE["calls"].clear()
        await pg.evaluate("(()=>{const rows=[...document.querySelectorAll('#voice-list .voice-row')]; const r=rows.find(x=>/Hannah/.test(x.textContent)); r.querySelector('.voice-play').click();})()")
        await pg.wait_for_timeout(2500)
        await pg.evaluate("(()=>{const rows=[...document.querySelectorAll('#voice-list .voice-row')]; const r=rows.find(x=>/Troy/.test(x.textContent)); r.querySelector('.voice-play').click();})()")
        await pg.wait_for_timeout(2500)
        vs = [c[1] for c in STATE["calls"] if c[0] == "tts-voice"]
        st_ok = await pg.evaluate("document.getElementById('ai-voice-status').textContent")
        ok("V each AI voice preview asks for that exact voice", vs[:2] == ["hannah", "troy"] and "working" in st_ok, [vs, st_ok])
        STATE["tts"] = "terms"
        await pg.evaluate("document.getElementById('btn-test-ai-voice').click()")
        await pg.wait_for_timeout(2500)
        st_bad = await pg.evaluate("document.getElementById('ai-voice-status').textContent")
        ok("V if Groq needs the one-time OK, it says so (no silent switch)", "one-time OK" in st_bad and "console.groq.com" in st_bad, st_bad)
        STATE["tts"] = "ok"
        await pg.evaluate("document.getElementById('btn-test-ai-voice').click()")
        await pg.wait_for_timeout(2500)
        ok("V Test AI voices shows working again", "working" in await pg.evaluate("document.getElementById('ai-voice-status').textContent"))
        hint = await pg.evaluate("[...document.querySelectorAll('#voice-list .hint')].map(h=>h.textContent).join(' ')")
        ok("V tells you where to get better iPhone voices", "Spoken Content" in hint, hint[:80])
        await close_panels(pg)
        await pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('friday.settings')); s.voiceURI=''; localStorage.setItem('friday.settings', JSON.stringify(s));})()")

        # ---------- H. photo ----------
        await close_panels(pg)
        img = Image.new("RGB", (900, 700), (120, 80, 40)); bio = io.BytesIO(); img.save(bio, "JPEG"); open("/tmp/mug.jpg", "wb").write(bio.getvalue())
        await pg.set_input_files("#eyes-file", "/tmp/mug.jpg")
        await pg.wait_for_timeout(3500)
        photo_open = await pg.evaluate("document.getElementById('panel-photo').classList.contains('open')")
        ans = await pg.evaluate("document.getElementById('photo-answer').textContent")
        ok("H photo: she looks and answers", photo_open and "coffee mug" in ans, ans)
        await pg.fill("#photo-q", "What does the label say?")
        await pg.evaluate("document.getElementById('photo-form').dispatchEvent(new Event('submit',{cancelable:true}))")
        await pg.wait_for_timeout(2500)
        ans2 = await pg.evaluate("document.getElementById('photo-answer').textContent")
        ok("H photo follow-up question works", "Morning Blend" in ans2, ans2)
        await pg.screenshot(path=OUT + "H-photo.png")
        await close_panels(pg)

        # ---------- L. backup / restore ----------
        rt = await pg.evaluate("""(()=>{ const d=FridayStorage.exportBackup(false); const keys=Object.keys(d); const hasKey=!!d.apiKey;
           localStorage.setItem('friday.lists','null'); FridayStorage.applyBackup(d);
           const l=JSON.parse(localStorage.getItem('friday.lists')); return {keys: keys.join(','), hasKey, restored: !!(l && l.items && l.items.grocery && l.items.grocery.length)}; })()""")
        ok("L backup includes lists, bills, countdowns (no key by default)", all(k in rt["keys"] for k in ["lists", "bills", "countdowns", "summary"]) and not rt["hasKey"], rt)
        ok("L restore brings lists back", rt["restored"], rt)

        # ---------- K. night mode ----------
        await pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('friday.settings')); s.nightMode=true; s.nightFrom=0; s.nightTo=23; localStorage.setItem('friday.settings', JSON.stringify(s));})()")
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(1200)
        night = await pg.evaluate("document.body.classList.contains('night')")
        ok("K night mode dims the orb", night)
        await pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('friday.settings')); s.nightMode=false; localStorage.setItem('friday.settings', JSON.stringify(s));})()")

        # ---------- Y. 3.0 features ----------
        partner = "Batsie" if PROFILE != "batsie" else "Sky"
        other = "Jarvis" if PROFILE != "batsie" else "Friday"
        scheme = sc.lower()
        await pg.evaluate("document.body.classList.remove('night')")
        await close_panels(pg)
        await pg.evaluate("localStorage.removeItem('friday.leaveQueue')")
        cap = await say(pg, "turn the lights to 40%, add oat milk to my grocery list and set a timer for 7 minutes", 9000)
        cap = await say(pg, "yes", 2500)
        multi = await pg.evaluate("""(()=>{ const l=JSON.parse(localStorage.getItem('friday.lists')||'{}'); const g=((l.items||{}).grocery||[]).map(x=>x.text);
            const t=JSON.parse(localStorage.getItem('friday.timers')||'[]').map(x=>x.total);
            const b=document.getElementById('run-shortcut-btn'); return {g, t, href: b?decodeURIComponent(b.href):'', q: localStorage.getItem('friday.leaveQueue')}; })()""")
        ok("Y multi-task: lights, list and timer from one sentence", "Oat milk" in multi["g"] and 420 in multi["t"] and "lights to 40%" in multi["href"] and multi["q"] in (None, "null"), multi)
        await close_panels(pg)
        cap = await say(pg, "turn on the Apple TV and turn on do not disturb", 7000)
        ok("Y 3.5.7 two jobs she can't do in the app: she asks once first", "2 of those" in cap and "Shortcut?" in cap, cap)
        cap = await say(pg, "yes", 2500)
        q1 = await pg.evaluate("JSON.parse(localStorage.getItem('friday.leaveQueue')||'null')")
        href1 = await pg.evaluate("decodeURIComponent((document.getElementById('run-shortcut-btn')||{}).href||'')")
        await pg.evaluate("window.__fridayHandleLink('" + scheme + "://')"); await pg.wait_for_timeout(1600)
        href2 = await pg.evaluate("decodeURIComponent((document.getElementById('run-shortcut-btn')||{}).href||'')")
        q2 = await pg.evaluate("localStorage.getItem('friday.leaveQueue')")
        ok("Y two Shortcut jobs: first runs, second waits, then runs when Shortcuts hands back", "apple tv" in href1.lower() and q1 and len(q1["items"]) == 1 and "disturb" in href2.lower() and q2 in (None, "null"), [href1[-50:], q1, href2[-50:], q2])
        await close_panels(pg)
        cap = await say(pg, "add rice and beans to my grocery list", 2500)
        g2 = await pg.evaluate("((JSON.parse(localStorage.getItem('friday.lists')).items||{}).grocery||[]).map(x=>x.text)")
        ok("Y 'add rice and beans' stays one task", "Rice" in g2 and "Beans" in g2, [cap, g2])
        await close_panels(pg)
        cap = await say(pg, "I spent $20 on gas", 2500)
        ok("Y spending: 'I spent $20 on gas' is logged", "Logged $20" in cap, cap)
        cap = await say(pg, "how much did I spend this month", 2500)
        spbox = await pg.evaluate("document.getElementById('spending-box').textContent")
        ok("Y spending: monthly total, shown in the money panel", "$20" in cap and "Gas" in spbox, [cap, spbox[:80]])
        await close_panels(pg)
        cap = await say(pg, "I drank two glasses of water", 2500)
        ok("Y habits: water count", "2 of 8" in cap, cap)
        cap = await say(pg, "I worked out", 2500)
        ok("Y habits: workout logged", "Workout done" in cap, cap)
        cap = await say(pg, "my habits", 2500)
        hrows = await pg.evaluate("document.querySelectorAll('#habits-box .habit-row').length")
        ok("Y habits panel shows them", hrows >= 2 and "Water" in cap, [cap, hrows])
        await close_panels(pg)
        cap = await say(pg, "tell " + partner + " dinner's ready", 3000)
        cap0 = cap
        cap = await say(pg, "yes", 2500)
        href = await pg.evaluate("decodeURIComponent((document.getElementById('run-shortcut-btn')||{}).href||'')")
        contact = "DADDY!!" if PROFILE == "batsie" else partner
        ok("Y message to partner: she asks, then after 'yes' it goes to the Shortcut as a text", "Shortcut?" in cap0 and ("text " + contact + " saying From " + ("Reed" if PROFILE == "batsie" else sc) + ": Dinner's ready") in href, [cap, href[-70:]])
        await close_panels(pg)
        await pg.evaluate("window.__fridayHandleLink(\"" + scheme + "://msg?text=From%20" + other + "%3A%20on%20my%20way\")"); await pg.wait_for_timeout(3500)
        cap = await pg.evaluate("document.getElementById('caption-line').textContent")
        ok("Y incoming message is read out loud", ("Message from " + partner + ": on my way") in cap, cap)
        cap = await say(pg, "how do you say good night in spanish", 4000)
        ok("Y translator", cap.startswith("Spanish:") and "Buenas noches" in cap, cap)
        await pg.evaluate("localStorage.removeItem('friday.leaveQueue')")
        cap = await say(pg, "movie time", 9000)
        ok("Y 3.5.7 routine asks once before its Shortcut steps", "Shortcut?" in cap, cap)
        cap = await say(pg, "yes", 2500)
        q3 = await pg.evaluate("JSON.parse(localStorage.getItem('friday.leaveQueue')||'null')")
        ok("Y routine 'movie time' runs its steps after 'yes'", q3 and len(q3["items"]) == 2, q3)
        await pg.evaluate("localStorage.removeItem('friday.leaveQueue')"); await close_panels(pg)
        cap = await say(pg, "I'm home", 3000)
        ok("Y 'I'm home' welcomes you", ("Welcome home, " + term) in cap, cap)
        cap = await say(pg, "I'm leaving", 5000)
        ok("Y 'I'm leaving' gives a rain heads-up", "Have a good one" in cap and "umbrella" in cap, cap)
        await pg.evaluate("(()=>{const r=FridayExtras.routines(); r.push({id:'t1',phrase:'Test run',steps:['add bananas to my grocery list','what time is it']}); FridayExtras.saveRoutines(r);})()")
        cap = await say(pg, "test run", 6000)
        g3 = await pg.evaluate("((JSON.parse(localStorage.getItem('friday.lists')).items||{}).grocery||[]).map(x=>x.text)")
        ok("Y custom routine works", "Bananas" in g3 and "It's" in cap, [cap, g3])
        await close_panels(pg)
        cap = await say(pg, "recap my day", 7000)
        ok("Y nightly recap by voice", "Here's your day" in cap and "Sleep well, " + term in cap and "$20" in cap, cap[:160])
        cap = await say(pg, "bedside mode", 3000)
        bs = await pg.evaluate("(()=>{const b=document.getElementById('bedside'); return {on: b.classList.contains('on'), body: document.body.classList.contains('bedside-on'), t: b.querySelector('.bs-time').textContent}})()")
        ok("Y charging display opens", bs["on"] and bs["body"] and ":" in bs["t"], bs)
        await pg.screenshot(path=OUT + "Y-bedside.png")
        await pg.evaluate("window.__friday.bedside.dim()"); await pg.wait_for_timeout(1500)
        dimmed = await pg.evaluate("({dim: document.getElementById('bedside').classList.contains('dim'), orb: window.__friday.orb.running})")
        await pg.screenshot(path=OUT + "Y-bedside-dim.png")
        await pg.evaluate("document.querySelector('#bedside .bedside-faint').parentNode.dispatchEvent(new MouseEvent('click', {bubbles:true}))"); await pg.wait_for_timeout(600)
        woke = await pg.evaluate("({dim: document.getElementById('bedside').classList.contains('dim'), orb: window.__friday.orb.running})")
        ok("Y charging display fades (orb rests) and a tap wakes it", dimmed["dim"] and not dimmed["orb"] and not woke["dim"] and woke["orb"], [dimmed, woke])
        await pg.evaluate("window.__fridayHandleLink('" + scheme + "://unplugged')"); await pg.wait_for_timeout(400)
        ok("Y unplugging closes the charging display", not await pg.evaluate("document.getElementById('bedside').classList.contains('on')"))
        ui = await pg.evaluate("""({hf: document.getElementById('set-handsfree').checked, rc: document.getElementById('set-recap').checked, hour: document.getElementById('set-recap-hour').value,
            routines: document.querySelectorAll('#routines-box .routine-card').length, pn: document.getElementById('set-partner-names').placeholder,
            url: document.getElementById('ps-url').textContent, rest: document.getElementById('set-rest-orb').checked, nightorb: document.getElementById('set-night-orb').checked})""")
        ok("Y settings: hands-free, recap, routines, messages, battery", ui["hf"] and ui["rc"] and ui["hour"] == "21" and ui["routines"] >= 4 and partner in ui["pn"] and ui["url"] == scheme + "://msg?text=" and ui["rest"] and ui["nightorb"], ui)
        await pg.evaluate("(()=>{const e=document.getElementById('set-handsfree'); e.checked=false; e.dispatchEvent(new Event('change'));})()")
        ok("Y hands-free switch saves", await pg.evaluate("JSON.parse(localStorage.getItem('friday.settings')).handsFree === false"))
        await pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('friday.settings')); s.nightMode=true; s.nightFrom=0; s.nightTo=23; localStorage.setItem('friday.settings', JSON.stringify(s));})()")
        await pg.wait_for_timeout(5600)
        pw = await pg.evaluate("window.__friday.orb.power() + '|' + window.__friday.orb._fpsCap")
        await pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('friday.settings')); s.nightMode=false; localStorage.setItem('friday.settings', JSON.stringify(s));})()")
        await pg.wait_for_timeout(5600)
        pw2 = await pg.evaluate("window.__friday.orb.power()")
        ok("Y calmer orb at night, back to normal after", pw.startswith("night") and pw2 in ("full", "rest"), [pw, pw2])
        await pg.evaluate("window.__friday.orb.lowPower = true; window.dispatchEvent(new CustomEvent('friday:lowpower', {detail:{on:true}}))"); await pg.wait_for_timeout(300)
        lp = await pg.evaluate("({p: window.__friday.orb.power(), q: window.__friday.orb.quality.name, toast: document.getElementById('toast').textContent})")
        await pg.evaluate("window.__friday.orb.lowPower = false; window.dispatchEvent(new CustomEvent('friday:lowpower', {detail:{on:false}}))")
        ok("Y Low Power Mode switches to the lighter orb", lp["p"] in ("saver", "rest") and lp["q"] in ("med", "low") and "Low Power" in lp["toast"], lp)
        bk = await pg.evaluate("Object.keys(FridayStorage.exportBackup(false)).join(',')")
        ok("Y backup includes spending, habits and routines", all(k in bk for k in ["spending", "habits", "routines"]), bk)
        await pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('friday.settings')); s.recapHour=0; s.nightlyRecap=true; s.wakeGreeting=true; localStorage.setItem('friday.settings', JSON.stringify(s)); localStorage.removeItem('friday.recapDate');})()")
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(9000)
        cap = await pg.evaluate("document.getElementById('caption-line').textContent")
        ok("Y nightly recap runs on its own after the set time", "Here's your day" in cap, cap[:120])
        await pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('friday.settings')); s.nightlyRecap=false; s.handsFree=true; localStorage.setItem('friday.settings', JSON.stringify(s)); localStorage.removeItem('friday.recapDate');})()")
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(4000)
        cap = await pg.evaluate("document.getElementById('caption-line').textContent")
        ok("Y recap switch off: no recap", "Here's your day" not in cap, cap[:120])
        await pg.evaluate("document.getElementById('whatsnew').classList.add('hidden')")

        # ---------- P. 3.1 on the web page ----------
        await pg.evaluate("document.getElementById('whatsnew').classList.add('hidden')")
        await pg.evaluate("document.getElementById('btn-settings').click()"); await pg.wait_for_timeout(400)
        nav = await pg.evaluate("""(()=>{ const n=document.querySelectorAll('.smenu-item').length; const allHidden=[...document.querySelectorAll('.spage')].every(p=>p.hidden);
            document.querySelector('.smenu-item[data-page=voice]').click(); const t=document.getElementById('settings-title').textContent; const vis=!document.getElementById('sp-voice').hidden && document.getElementById('settings-menu').hidden;
            document.getElementById('settings-back').click(); const back=!document.getElementById('settings-menu').hidden && document.getElementById('settings-title').textContent==='Settings';
            return {n, allHidden, t, vis, back}; })()""")
        ok("P Settings opens on the hub with 14 pages, back arrow works", nav["n"] == 14 and nav["allHidden"] and nav["t"] == "Voice & Talking" and nav["vis"] and nav["back"], nav)
        pv = await pg.evaluate("({p: document.querySelectorAll('#layout-grid svg.lp').length, l: document.querySelectorAll('#layout-grid .layout-choice').length, w: document.querySelectorAll('#widget-styles .wstyle').length})")
        orbs = await pg.evaluate("[...document.querySelectorAll('#widget-styles .wp-orb img')].map(i=>i.getAttribute('src'))")
        ok("P every layout has a preview, and 11 widget styles (6 with the real orb)", pv["p"] == pv["l"] and pv["l"] >= 15 and pv["w"] == 11 and len(orbs) == 6 and "icons/widget/orb-x6.png" in orbs, [pv, orbs])
        await pg.evaluate("(()=>{document.querySelector('.smenu-item[data-page=voice]').click(); document.querySelector('#talk-time button[data-talk=long]').click();})()")
        ok("P talk time setting saves", await pg.evaluate("JSON.parse(localStorage.getItem('friday.settings')).talkTime === 'long'"))
        await pg.evaluate("document.querySelector('[data-close=settings]').click()")
        oo = []
        for lid in ["immersive", "orbtop", "orbdock", "orbclock"]:
            await pg.evaluate("id => window.__friday.applyLayout(id)", lid); await pg.wait_for_timeout(500)
            oo.append(await pg.evaluate("""id => ({id, oo: document.getElementById('stage').classList.contains('layout-orbonly'), own: document.getElementById('stage').classList.contains('layout-' + id),
                hidden: getComputedStyle(document.getElementById('bubble-tray')).visibility === 'hidden' || getComputedStyle(document.getElementById('bubble-tray')).display === 'none' || getComputedStyle(document.getElementById('bubble-tray')).opacity === '0',
                clock: !document.getElementById('stage-clock').hidden && /\\d:\\d\\d/.test(document.querySelector('#stage-clock .sc-time').textContent)})""", lid))
        await pg.screenshot(path=OUT + "P-orbclock.png")
        await pg.evaluate("window.__friday.applyLayout('immersive')"); await pg.wait_for_timeout(600)
        await pg.screenshot(path=OUT + "P-immersive.png")
        ok("P four new orb-only layouts (bubbles tucked away, clock shows in Orb + clock)", all(x["oo"] and x["own"] for x in oo) and oo[3]["clock"], oo)
        await pg.evaluate("window.__friday.applyLayout('ring')"); await pg.wait_for_timeout(300)
        lb = await pg.evaluate("""(()=>{ const B=window.__friday.bubbles; B.setLearning(false); const before=B.list.length; const own=B.list.filter(b=>!b.suggest).length; B.setLearning(true); const small=B.list.length; const full=JSON.parse(localStorage.getItem('friday.bubblesFull')).length;
            const hidden=JSON.parse(localStorage.getItem('friday.bubblesFull')).find(b=>!B.list.some(x=>x.id===b.id)); const key=B.usageKey(hidden);
            for (let i=0;i<3;i++) B.noteUsage(key); B.refreshSuggestions(); const back=B.list.some(x=>x.id===hidden.id);
            B.setLearning(false); const after=B.list.length; return {before, own, small, full, back, after}; })()""")
        ok("P bubbles that learn: start small, a used one comes back, turning off restores", lb["small"] < lb["before"] and lb["full"] == lb["own"] and lb["back"] and lb["after"] >= lb["before"], lb)
        await pg.evaluate("document.getElementById('btn-neural').click()"); await pg.wait_for_timeout(1500)
        n1 = await pg.evaluate("parseInt(document.querySelector('#neural-stats div b').textContent, 10)")
        await pg.evaluate("(()=>{const m=JSON.parse(localStorage.getItem('friday.memory')); m.push({text:'Sky loves the full orb layout.', at:new Date().toISOString()}); localStorage.setItem('friday.memory', JSON.stringify(m)); window.dispatchEvent(new CustomEvent('friday:memory'));})()")
        await pg.wait_for_timeout(1500)
        n2 = await pg.evaluate("parseInt(document.querySelector('#neural-stats div b').textContent, 10)")
        await pg.screenshot(path=OUT + "P-neural.png")
        mems = await pg.evaluate("JSON.parse(localStorage.getItem('friday.memory')).length")
        ok("P neural map grows a bubble for each new thing she learns", n1 >= mems - 1 and n2 == n1 + 1, [n1, n2, mems])
        await close_panels(pg)
        looks = await pg.evaluate("Object.keys(FRIDAY_CONFIG.LOOKS).filter(k=>/^X\\d+$/.test(k)).length")
        ok("P 12 nested fracture looks (8 new)", looks == 12, looks)

        # ---------- R. 3.1.1 live voice ----------
        jt = await pg.evaluate("""() => {
          const cases = [["Set a timer for","more"],["set a timer for 5 minutes","done"],["What's the weather","done"],["um","more"],
            ["Remind me to","more"],["text mom","more"],["Text Mom saying I'm on my way.","done"],["Hey Friday","more"],["thank you","done"],
            ["Turn off the lights and","more"],["Why?","done"],["turn the lights on","done"],["what time is it","done"],["so","more"],
            ["I need to","more"],["What is the capital of","more"],["Add milk to my","more"],["Set the living room to 40%","done"],["call mom","done"]];
          return cases.filter(c => FridayVoice.judgeTurn(c[0]) !== c[1]).map(c => c[0] + ' -> ' + FridayVoice.judgeTurn(c[0]));
        }""")
        ok("R she can tell finished from unfinished (19 phrases)", jt == [], jt)
        sp = await pg.evaluate("FridayVoice.speakable('It\\'s 75% done — see https://x.com/a (soon) 😀 & 68°F, e.g. today')")
        ok("R no symbols, links or emojis read out", "75 percent" in sp and "http" not in sp and "😀" not in sp and "—" not in sp and "(" not in sp and "68 degrees" in sp and "for example" in sp and " and " in sp, sp)
        sf = await pg.evaluate("FridayVoice.splitForTTS('Okay so here is the thing, the weather today looks mostly sunny with a few clouds rolling in later this afternoon and a light breeze. Bring a jacket tonight.', 190, 110)")
        ok("R long answers start talking at the first natural break", len(sf) >= 2 and len(sf[0]) <= 110 and sf[0].endswith(","), sf)
        # Whisper listening: a quick read during a pause decides, and that text is reused (no second upload)
        STATE["transcript"] = "Set a timer for"
        wv = await pg.evaluate("""async () => {
          const v = new FridayVoice({});
          v.listening = true; v._mode = 'whisper'; v._listenId = 7; v._lastLoud = performance.now() - 700;
          v._rec = { mimeType: 'audio/webm', state: 'recording', stop() { this.state = 'inactive'; } };
          v._chunks = [new Blob([new Uint8Array(3000)], { type: 'audio/webm' })];
          v._interimCheck();
          await new Promise(r => setTimeout(r, 900));
          return { verdict: v._turn && v._turn.verdict, text: v._turn && v._turn.text };
        }""")
        STATE["transcript"] = "Set a timer for 5 minutes."
        n0 = len([c for c in STATE["calls"] if c[0] == "transcribe"])
        wv2 = await pg.evaluate("""async () => {
          const v = new FridayVoice({});
          v.listening = true; v._mode = 'whisper'; v._listenId = 8; v._lastLoud = performance.now() - 700;
          v._rec = { mimeType: 'audio/webm', state: 'recording', stop() { this.state = 'inactive'; } };
          v._chunks = [new Blob([new Uint8Array(3000)], { type: 'audio/webm' })];
          v._interimCheck();
          await new Promise(r => setTimeout(r, 900));
          const verdict = v._turn && v._turn.verdict;
          const text = await v.stopListen();
          return { verdict, text, wait: FridayVoice.turnWait(verdict, 'normal'), waitMore: FridayVoice.turnWait('more', 'normal') };
        }""")
        n1 = len([c for c in STATE["calls"] if c[0] == "transcribe"])
        ok("R Whisper: a quick read in the pause says 'keep listening' for an unfinished sentence", wv.get("verdict") == "more" and wv.get("text") == "Set a timer for", wv)
        ok("R Whisper: finished sentence is answered fast and not uploaded twice", wv2["verdict"] == "done" and wv2["text"] == "Set a timer for 5 minutes." and n1 - n0 == 1 and wv2["wait"] < 700 < wv2["waitMore"], [wv2, n1 - n0])
        # AI voice: streamed sentences join into fuller clips, played back to back with natural pauses, never overlapping
        STATE["calls"].clear(); STATE["tts"] = "ok"
        gv = await pg.evaluate("""async () => {
          const st = JSON.parse(localStorage.getItem('friday.settings')); const oldV = st.voiceURI; st.voiceURI = 'ai:troy'; localStorage.setItem('friday.settings', JSON.stringify(st));
          localStorage.setItem('friday.aiVoicePauseUntil', '0');
          const starts = []; const orig = AudioBufferSourceNode.prototype.start;
          AudioBufferSourceNode.prototype.start = function (w) { starts.push({ w: w || 0, d: this.buffer ? this.buffer.duration : 0 }); return orig.apply(this, arguments); };
          const v = new FridayVoice({}); v.setVoiceURI('ai:troy'); v.unlockAudio();
          const p = v.queue('Sure thing.', {});
          v.queue('Here is a quick one.', {}); v.queue('Why did the robot go on holiday?', {}); v.queue('It needed to recharge.', {});
          const qlen = v._queue.length;
          await p;
          AudioBufferSourceNode.prototype.start = orig;
          st.voiceURI = oldV; localStorage.setItem('friday.settings', JSON.stringify(st));
          const real = starts.filter(x => x.d > 0.05);
          let overlap = false; const gaps = [];
          for (let i = 1; i < real.length; i++) { const g = real[i].w - (real[i - 1].w + real[i - 1].d); gaps.push(+g.toFixed(3)); if (g < -0.001) overlap = true; }
          return { qlen, n: real.length, overlap, gaps };
        }""")
        ntts = len([c for c in STATE["calls"] if c[0] == "tts"])
        ok("R AI voice: streamed sentences join into fuller clips (2 clips, not 4)", gv["qlen"] in (1, 2) and ntts == 2 and gv["n"] == 2, [gv, ntts])
        ok("R AI voice: clips play back to back with a natural pause, never overlapping", not gv["overlap"] and all(0.09 <= g <= 3.0 for g in gv["gaps"]), gv)
        await pg.click("#btn-settings"); await pg.wait_for_timeout(300)
        verl = await pg.evaluate("document.getElementById('app-version').textContent")
        ok("R Settings shows the version and its label", verl == "Version 4.2.2 · Remote", verl)
        await close_panels(pg)

        nm = await pg.evaluate("""() => ['tell patsy dinner is ready', 'text Batsy I am home', 'tell bats e hello', 'I have a party tonight', 'patty melt'].map(t => FridayVoice.fixNames(t))""")
        ok("R Batsie is never 'Patsy': misheard names are fixed, ordinary words are left alone",
           nm == ["tell Batsie dinner is ready", "text Batsie I am home", "tell Batsie hello", "I have a party tonight", "patty melt"], nm)
        hint = STATE.get("hints", [])
        ok("R Whisper gets your names as a spelling hint", hint and all(hint), hint)
        # voice on silent: marked as playback while she talks, handed back after
        STATE["tts"] = "ok"
        sm = await pg.evaluate("""async () => {
          const seen = []; const AS = { _t: 'auto', get type() { return this._t; }, set type(v) { this._t = v; seen.push(v); } };
          Object.defineProperty(navigator, 'audioSession', { configurable: true, value: AS });
          const st = JSON.parse(localStorage.getItem('friday.settings')); const oldV = st.voiceURI; st.voiceURI = 'ai:diana'; localStorage.setItem('friday.settings', JSON.stringify(st));
          localStorage.setItem('friday.aiVoicePauseUntil', '0');
          const v = new FridayVoice({}); v.setVoiceURI('ai:diana'); v.unlockAudio();
          const p = v.speak('Testing, one, two.', {});
          await new Promise(r => setTimeout(r, 50)); const during = AS.type;
          await p;
          st.voiceURI = oldV; localStorage.setItem('friday.settings', JSON.stringify(st));
          const d = JSON.parse(localStorage.getItem('friday.voiceDiag') || 'null');
          return { seen, during, after: AS.type, diag: d && d.path };
        }""")
        ok("R her voice is marked as playback while she talks (so silent mode doesn't mute her), then handed back", sm["during"] == "playback" and sm["after"] == "auto" and sm["diag"] == "ai", sm)
        # stuck sound: rebuild once, then fall back to the iPhone voice instead of going silent
        sk = await pg.evaluate("""async () => {
          const v = new FridayVoice({}); v.setVoiceURI('ai:diana'); v.unlockAudio();
          const st = JSON.parse(localStorage.getItem('friday.settings')); const oldV = st.voiceURI; st.voiceURI = 'ai:diana'; localStorage.setItem('friday.settings', JSON.stringify(st));
          localStorage.setItem('friday.aiVoicePauseUntil', '0');
          v._flowing = async () => false;           // pretend iOS froze the sound
          let system = 0; v._speakSystem = async () => { system++; };
          await v.speak('Hello there.', {});
          st.voiceURI = oldV; localStorage.setItem('friday.settings', JSON.stringify(st));
          const d = JSON.parse(localStorage.getItem('friday.voiceDiag') || 'null');
          return { system, diag: d && d.path, issue: d && d.issue };
        }""")
        ok("R if iOS cuts her sound off, she rebuilds it and then uses the iPhone voice instead of going silent", sk["system"] == 1 and sk["diag"] == "iphone" and sk["issue"] == "stuck", sk)
        await pg.evaluate("document.getElementById('btn-settings').click()"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('.smenu-item[data-page=voice]').click()"); await pg.wait_for_timeout(200)
        await pg.evaluate("document.getElementById('btn-voice-test').click()"); await pg.wait_for_timeout(4000)
        vts = await pg.evaluate("document.getElementById('voice-test-status').textContent")
        ok("R Test her voice says how it went", "Played with the" in vts or "iPhone voice" in vts, vts)
        await close_panels(pg)

        # ---------- R2. 3.1.2 voices and neural map ----------
        want_ai = "diana" if PROFILE == "sky" else "daniel"
        va = await pg.evaluate("({auto: window.__friday.voice.autoAi, f1: FridayVoice.voiceFitsGender('ai:troy','female'), f2: FridayVoice.voiceFitsGender('ai:diana','female'), m1: FridayVoice.voiceFitsGender('ai:hannah','male'), m2: FridayVoice.voiceFitsGender('com.apple.voice.compact.en-GB.Daniel','male')})")
        ok("R2 " + ("Friday's automatic voice is a woman's (Diana)" if PROFILE == "sky" else "Jarvis's automatic voice is a man's (Daniel)"), va["auto"] == want_ai and va["f1"] is False and va["f2"] is True and va["m1"] is False and va["m2"] is True, va)
        wrong = "ai:troy" if PROFILE == "sky" else "ai:diana"
        seedv = (SEED_V1 % {"sc": sc}).replace("voiceURI:''", "voiceURI:'" + wrong + "'")
        ctxv, pv, errv = await new_ctx(b, seedv)
        await pv.goto(BASE, wait_until="load"); await pv.wait_for_timeout(2000)
        vv = await pv.evaluate("({uri: JSON.parse(localStorage.getItem('friday.settings')).voiceURI, fixed: JSON.parse(localStorage.getItem('friday.voiceGenderFixed')), look: JSON.parse(localStorage.getItem('friday.settings')).look})")
        ok("R2 a saved voice of the wrong kind goes back to Automatic once (look kept)", vv["uri"] == "" and vv["fixed"] is True and vv["look"] == "H2", vv)
        await ctxv.close()
        # neural map: drag follows the finger, both ways
        await pg.evaluate("document.getElementById('btn-neural').click()"); await pg.wait_for_timeout(1200)
        dr = await pg.evaluate("""() => {
          const N = window.__friday.neural; N.setMode(true); const ids = Object.keys(N.nodes);
          const pr = (id) => N._project(N.g.pos[id], 0, 0);
          const f = ids.slice().sort((a, b) => pr(b).z - pr(a).z)[0];
          const a0 = pr(f); N.turn(0.2, 0); const a1 = pr(f); N.turn(-0.2, 0);
          const b0 = pr(f); N.turn(0, 0.2); const b1 = pr(f); N.turn(0, -0.2);
          const b2 = pr(f); N.setMode(false);
          return { right: a1.x - a0.x, down: b1.y - b0.y, back: Math.abs(b2.x - b0.x) + Math.abs(b2.y - b0.y) };
        }""")
        ok("R2 3D neural map turns the way your finger moves (right is right, down is down)", dr["right"] > 0 and dr["down"] > 0 and dr["back"] < 0.5, dr)
        md = await pg.evaluate("""async () => {
          const N = window.__friday.neural; const c = document.getElementById('neural-canvas'); const r = c.getBoundingClientRect();
          N.spinY = 0; const ids = Object.keys(N.nodes);
          const f = ids.slice().sort((a, b) => N.nodes[b].sz - N.nodes[a].sz)[0];
          const x0 = N.nodes[f].sx, y0 = N.nodes[f].sy;
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          c.dispatchEvent(new MouseEvent('mousedown', { clientX: cx, clientY: cy, bubbles: true }));
          for (let i = 1; i <= 6; i++) window.dispatchEvent(new MouseEvent('mousemove', { clientX: cx + i * 10, clientY: cy - i * 8, bubbles: true }));
          await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
          const x1 = N.nodes[f].sx, y1 = N.nodes[f].sy;
          window.dispatchEvent(new MouseEvent('mouseup', { clientX: cx + 60, clientY: cy - 48, bubbles: true }));
          return { dx: x1 - x0, dy: y1 - y0 };
        }""")
        ok("R2 dragging right and up moves the map right and up", md["dx"] > 0 and md["dy"] < 0, md)
        ng = await pg.evaluate("""async () => {
          const N = window.__friday.neural; const c = document.getElementById('neural-canvas');
          const z0 = N.cam.zoom; c.dispatchEvent(new WheelEvent('wheel', { deltaY: -400, bubbles: true, cancelable: true })); const z1 = N.cam.zoom;
          document.querySelector('#neural-mode [data-mode="3d"]').click(); const m3 = N.mode3d && JSON.parse(localStorage.getItem('friday.neuralMode')) === '3d';
          document.querySelector('#neural-mode [data-mode="2d"]').click(); const m2 = !N.mode3d;
          const flat = Object.values(N.g.pos).every(p => Math.abs(p[2]) < 80);
          return { zoom: z1 > z0, m3, m2, dots: Object.keys(N.g.pos).length, edges: N._edgeList().length, flat };
        }""")
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path=OUT + "R2-neural-graph.png")
        ok("R2 Obsidian-style map: pinch/scroll zooms, Flat and 3D switch (remembered), dots and lines for everything", ng["zoom"] and ng["m3"] and ng["m2"] and ng["dots"] > 25 and ng["edges"] > ng["dots"] - 1, ng)
        # learned things become bubbles that connect to what they're about
        partner_name = "Batsie" if PROFILE == "sky" else "Sky"
        await pg.evaluate("""(pn) => {
          const m = JSON.parse(localStorage.getItem('friday.memory') || '[]');
          m.push({ text: pn + "'s birthday is in May", at: new Date().toISOString() });
          m.push({ text: 'Sky drinks coffee every morning before work', at: new Date().toISOString() });
          localStorage.setItem('friday.memory', JSON.stringify(m));
          window.dispatchEvent(new CustomEvent('friday:memory'));
        }""", partner_name)
        await pg.wait_for_timeout(1500)
        cn = await pg.evaluate("""(pn) => {
          const N = window.__friday.neural;
          const lv = Object.values(N.leaves);
          const b = lv.find(l => l.text && l.text.indexOf("birthday is in May") >= 0);
          const cof = lv.filter(l => l.parent === 'memory' && /coffee/i.test(l.text || '')).map(l => l.id);
          const joined = (N.leafLinks || []).some(L => cof.indexOf(L[0]) >= 0 && cof.indexOf(L[1]) >= 0);
          const pulses = N.packets.filter(k => k.b === (b && b.id) || k.a === (b && b.id)).length;
          return { links: b ? b.links : null, cof: cof.length, joined, pulses, born: b ? b.born > 0 : false };
        }""", partner_name)
        ok("R2 a new memory becomes a bubble connected to who and what it's about (partner, calendar)", cn["links"] is not None and "partner" in cn["links"] and "calendar" in cn["links"] and cn["born"] and cn["pulses"] >= 3, cn)
        ok("R2 memories that share something are joined to each other", cn["cof"] >= 2 and cn["joined"], cn)
        await pg.evaluate("""() => { const N = window.__friday.neural; const b = Object.values(N.leaves).find(l => l.text && l.text.indexOf('birthday is in May') >= 0);
          N.selected = b.id; N._renderCard(); }""")
        card = await pg.evaluate("document.getElementById('neural-card').textContent")
        ok("R2 tapping a bubble shows what it's connected to", "connected to Memory" in card and "Calendar" in card and "Open Memory" in card, card)
        await pg.screenshot(path=OUT + "R2-neural.png")
        await pg.evaluate("window.__friday.neural.selected = null")
        await close_panels(pg)

        # ---------- Q. 3.1 phone jobs in the installed app (pretend iPhone add-ons) ----------
        FAKE = """
        window.__fakeCalls = [];
        (function(){
          function rec(n, a){ window.__fakeCalls.push([n, JSON.stringify(a||{})]); }
          window.Capacitor = { isNativePlatform: function(){ return true; }, Plugins: {
            LocalNotifications: { checkPermissions: async()=>({display: window.__notifOk ? 'granted' : 'prompt'}), requestPermissions: async()=>{ window.__notifOk = true; return {display:'granted'}; }, schedule: async(o)=>{ rec('notify', o); return {}; }, cancel: async(o)=>{ rec('cancel', o); },
              addListener: async(ev, fn)=>{ (window.__notifTap = window.__notifTap || []).push([ev, fn]); return {remove: async()=>{}}; } },
            Device: { getBatteryInfo: async()=>({batteryLevel: 0.64, isCharging: true}) },
            Contacts: { requestPermissions: async()=>({contacts:'granted'}), getContacts: async(o)=>{ if (o && o.projection && o.projection.phones) rec('contacts-phones', {}); return {contacts:[{name:{display:'DADDY!!'},phones:[{number:'+1 (555) 010-0001',type:'mobile'}]},{name:{display:'Mom'},phones:[{number:'555-010-0002',type:'home'},{number:'555-010-0003',type:'mobile'}]},{name:{display:'Batsie Smith'},phones:[{number:'+15550100004',type:'mobile'}]},{name:{display:'Sky'},phones:[{number:'+15550100005',type:'iphone'}]}]}; } },
            FridayKit: { musicControl: async(o)=>{ rec('music', o); return {state: o.action === 'pause' ? 'paused' : 'playing', title: 'Song'}; },
              musicPlay: async(o)=>{ rec('play', o); if (/nonexistent/i.test(o.query)) throw new Error('not-found'); return {title: o.query ? o.query.replace(/\\b\\w/g, c => c.toUpperCase()) : ''}; },
              composeText: async(o)=>{ rec('compose', o); return {result: 'sent'}; }, canText: async()=>({ok:true}),
              canOpen: async(o)=>{ rec('canopen', o); var a = {}; (o.schemes||[]).forEach(function(x){ a[x] = x === 'altstore' || x === 'localdevvpn'; }); return {apps: a}; },
              darkKeyboard: async()=>{ window.__darkkb = (window.__darkkb || 0) + 1; rec('darkkb', {}); return {ok:true}; },
              personalVoice: async()=>({status:'authorized', voices:[{name:'My Voice', id:'pv1'}]}),
              health: async()=>({steps: 4210, sleepMinutes: 440}),
              wifiName: async(o)=>({ssid: window.__ssid || 'HomeNet'}),
              alarmSet: async(o)=>{ rec('alarm', o); return {id: 'A1'}; },
              camera: async(o)=>{ rec('camera', o); return {result:'saved', kind:'photo', photo:'data:image/jpeg;base64,/9j/4AAQ'}; },
              writeShared: async(o)=>{ (window.__shared = window.__shared || {})[o.name] = o.text || ('b64:' + (o.base64 || '').length); return {ok:true}; },
              thermal: async()=>({state: window.__heat || 'nominal'}),
              addListener: async(ev, fn)=>{ window.__kitL = window.__kitL || {}; (window.__kitL[ev] = window.__kitL[ev] || []).push(fn); return {remove: async()=>{}}; } },
            CapacitorHttp: { request: async(o)=>{ var au = (o.headers||{}).Authorization || ''; rec('http', {url:o.url, auth: au.slice(0, 14), stream: !!(o.data && o.data.stream), model: o.data && o.data.model});
              if (/BADCF/.test(au)) return {status:401, data:{success:false, errors:[{code:10000, message:'Authentication error'}]}};
              if (/api\\.cloudflare\\.com/.test(o.url)) return {status:200, data:{choices:[{message:{role:'assistant', content: /single word/.test(JSON.stringify(o.data)) ? 'ready' : 'Cloudflare here. Four.'}}]}};
              try { var fr = await fetch(o.url, {method: o.method || 'GET', headers: o.headers || {}, body: o.data == null ? undefined : (typeof o.data === 'string' ? o.data : JSON.stringify(o.data))});
                var hd = {}; fr.headers.forEach(function (v, k) { hd[k] = v; }); var tx = await fr.text(); var dt; try { dt = JSON.parse(tx); } catch (e) { dt = tx; }
                return {status: fr.status, data: dt, headers: hd}; } catch (e) { return {status: 404, data: 'nope'}; } } },
            CapacitorCalendar: { requestFullRemindersAccess: async()=>({result:'granted'}), requestFullCalendarAccess: async()=>({result:'granted'}),
              createReminder: async(o)=>{ rec('reminder', o); return {id:'R1'}; }, createEvent: async(o)=>{ rec('event', o); return {id:'E1'}; },
              listEventsInRange: async(o)=>{ var d=new Date(o.from); d.setHours(15,0,0,0); return {result:[{title:'Dentist', startDate:d.getTime(), endDate:d.getTime()+3600000, isAllDay:false}]}; } },
            FridayListen: (function(){ var ls = {}, last = ''; return {
              addListener: async (ev, fn) => { (ls[ev] = ls[ev] || []).push(fn); return { remove: async () => { ls[ev] = (ls[ev] || []).filter(f => f !== fn); } }; },
              start: async (o) => { rec('listen-start', { hints: (o && o.hints) || [] }); last = ''; return { started: true }; },
              stop: async () => { rec('listen-stop', {}); return { text: last }; },
              cancel: async () => { rec('listen-cancel', {}); },
              available: async () => ({ available: true, speech: 'granted' }),
              __emit: (ev, d) => { if (ev === 'partial') last = d.text; (ls[ev] || []).forEach(f => f(d)); },
              __count: (ev) => (ls[ev] || []).length }; })(),
            FridayAidot: (function(){ var signed = false;
              var devs = [{id:'d1',name:'Bedroom Lamp',room:'Bedroom',rgb:true,cct:true,cctMin:2700,cctMax:6500,lan:true,hasIp:true},{id:'d2',name:'Desk Lamp',room:'Office',rgb:false,cct:true,cctMin:2700,cctMax:6500,lan:true,hasIp:true},{id:'d3',name:'Porch Light',room:'',rgb:false,cct:false,lan:true,hasIp:true}];
              function st(){ return signed ? {signedIn:true,user:'sk•••@mail.com',country:'United States',devices:devs,at:Date.now()} : {signedIn:false,devices:[]}; }
              function nm(i){ return (devs.filter(function(d){ return d.id === i; })[0] || {}).name; }
              return {
                status: async()=>st(),
                signIn: async(o)=>{ rec('aidot-signin', {country:o.country, region:o.region, user:o.username, haspw: !!o.password}); if (o.password === 'wrong') throw new Error('wrong-password'); signed = true; return st(); },
                signOut: async()=>{ rec('aidot-signout', {}); signed = false; return {signedIn:false}; },
                refresh: async()=>st(),
                find: async()=>({found:3,total:3}),
                control: async(o)=>{ rec('aidot', o);
                  if (window.__aidotAway) return {done:[], failed:devs.map(function(d){ return {id:d.id,name:d.name,reason:'away'}; }), away:true};
                  var ids = o.ids && o.ids.length ? o.ids : devs.map(function(d){ return d.id; }); var miss = window.__aidotMiss || [];
                  return {done: ids.filter(function(i){ return miss.indexOf(i) < 0; }).map(function(i){ return {id:i,name:nm(i)}; }), failed: ids.filter(function(i){ return miss.indexOf(i) >= 0; }).map(function(i){ return {id:i,name:nm(i),reason:'timeout'}; })}; },
                state: async(o)=>{ rec('aidot-state', o); var ids = o.ids && o.ids.length ? o.ids : devs.map(function(d){ return d.id; });
                  return {done: ids.map(function(i,k){ return k === 0 ? {id:i,name:nm(i),on:true,brightness:40} : {id:i,name:nm(i),on:false}; })}; }
              }; })(),
            FridayHome: { list: async()=>({authorization:'authorized', lights:[{name:'Lamp',room:'Living Room'}], scenes:['Good Night'], rooms:['Living Room']}),
              setLights: async(o)=>{ rec('lights', o); return {count:1}; }, runScene: async(o)=>{ rec('scene', o); return {scene: o.name}; },
              devices: async()=>({devices:[{name:'Thermostat',room:'Living Room',kind:'thermostat',current:25.2,target:22.2},{name:'Ceiling Fan',room:'Bedroom',kind:'fan',on:false},{name:'Coffee Maker',room:'Kitchen',kind:'outlet',on:false},{name:'HomePod Sensor',room:'Bedroom',kind:'temp',current:24.8}]}),
              read: async(o)=>({readings:[{name:'HomePod Sensor',kind:'temp',current:24.8},{name:'Thermostat',kind:'thermostat',current:25.2,target:22.2}]}),
              control: async(o)=>{ rec('hcontrol', o); if (o.kind === 'tv') throw new Error('no-device'); return {count:1, names:[o.kind === 'fan' ? 'Ceiling Fan' : o.kind === 'climate' ? 'Thermostat' : (o.name || 'Device')]}; } }
          } };
        })();
        """
        seedq = (SEED_V1 % {"sc": sc}).replace("morningBriefing:true", "morningBriefing:true, handsFree:false, wakeGreeting:false")
        ctxq, pq, errq = await new_ctx(b, FAKE + seedq)
        await pq.goto(BASE, wait_until="load"); await pq.wait_for_timeout(2500)
        await pq.evaluate("document.getElementById('whatsnew').classList.add('hidden')")
        def calls(name): return [c for c in fake if c[0] == name]
        cap = await say(pq, "how much battery do I have", 2000)
        ok("Q battery answered in the app (no Shortcut)", "64 percent and charging" in cap and not await pq.evaluate("!!document.getElementById('run-shortcut-btn')"), cap)
        cap = await say(pq, "remind me to call mom tomorrow at 5pm", 2500)
        fake = await pq.evaluate("window.__fakeCalls")
        rem = json.loads(calls("reminder")[-1][1]) if calls("reminder") else {}
        due = await pq.evaluate("t => { const d=new Date(t); return [d.getHours(), d.getMinutes()]; }", rem.get("dueDate", 0))
        ok("Q reminder added in the app with the right time", "remind you to call mom tomorrow at 5 PM" in cap and rem.get("title") == "Call mom" and due == [17, 0], [cap, rem, due])
        cap = await say(pq, "what's on my calendar today", 2500)
        ok("Q calendar read in the app", "Dentist at 3 PM" in cap, cap)
        cap = await say(pq, "schedule dinner with Batsie friday at 7", 2500)
        fake = await pq.evaluate("window.__fakeCalls")
        ev = json.loads(calls("event")[-1][1]) if calls("event") else {}
        evh = await pq.evaluate("t => new Date(t).getHours()", ev.get("startDate", 0))
        ok("Q calendar event added in the app (7 means 7 PM for dinner)", "Added Dinner with Batsie" in cap and evh == 19, [cap, ev.get("title"), evh])
        cap = await say(pq, "set the living room lights to 40%", 2500)
        fake = await pq.evaluate("window.__fakeCalls")
        li = json.loads(calls("lights")[-1][1]) if calls("lights") else {}
        ok("Q lights to an exact percent in the app (when iOS allows it)", "40 percent" in cap and li.get("brightness") == 40 and li.get("room") == "living room", [cap, li])
        cap = await say(pq, "set a pasta timer for 30 minutes", 3000)
        fake = await pq.evaluate("window.__fakeCalls")
        ok("Q long timer rings through iPhone notifications instead of the Shortcut", "iPhone" not in cap and len(calls("notify")) >= 1 and not await pq.evaluate("!!document.getElementById('run-shortcut-btn')"), [cap, len(calls("notify"))])
        cap = await say(pq, "cancel the pasta timer", 2000)
        fake = await pq.evaluate("window.__fakeCalls")
        ok("Q cancelling a timer cancels its notification", len(calls("cancel")) >= 1, cap)
        cap = await say(pq, "sync my contacts", 2500)
        ok("Q contacts sync (names only)", "Synced 4 contacts" in cap and await pq.evaluate("JSON.parse(localStorage.getItem('friday.contacts')).names.length") == 4, cap)
        await pq.evaluate("window.__fakeCalls.length = 0")
        cap = await say(pq, "text daddy I'm on my way", 3000)
        fk = await pq.evaluate("window.__fakeCalls")
        comp = [json.loads(c[1]) for c in fk if c[0] == "compose"]
        ok("Q 'text daddy …' opens the text in the app to DADDY!!'s number (you tap Send)", comp and comp[0].get("to") == ["+15550100001"] and comp[0].get("body") == "I'm on my way" and "Sent" in cap, [cap, comp])
        await pq.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('friday.settings')); s.textsInApp=false; localStorage.setItem('friday.settings', JSON.stringify(s));})()")
        cap = await say(pq, "text daddy I'm on my way", 3000)
        hq0 = await pq.evaluate("decodeURIComponent((document.getElementById('run-shortcut-btn')||{}).href||'')")
        ok("Q 3.5.7 with in-app texts off, she asks before using the Shortcut (nothing runs yet)", "Shortcut?" in cap and "shortcuts://" not in hq0, [cap, hq0[-60:]])
        cap = await say(pq, "yes", 3000)
        hq = await pq.evaluate("decodeURIComponent((document.getElementById('run-shortcut-btn')||{}).href||'')")
        ok("Q after 'yes', 'text daddy …' goes to the Shortcut with the exact contact name DADDY!!", "text DADDY!! saying I'm on my way" in hq, [cap, hq[-60:]])
        await pq.evaluate("(()=>{const b=document.getElementById('run-shortcut-btn'); if(b) b.remove();})()")
        cap = await say(pq, "turn on do not disturb", 3000)
        cap2 = await say(pq, "no", 2500)
        hq2 = await pq.evaluate("decodeURIComponent((document.getElementById('run-shortcut-btn')||{}).href||'')")
        ok("Q 3.5.7 something she can't do in the app: she asks, and 'no' leaves it", "Shortcut?" in cap and "leave it" in cap2 and "shortcuts://" not in hq2, [cap, cap2, hq2[-50:]])
        await pq.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('friday.settings')); s.textsInApp=true; localStorage.setItem('friday.settings', JSON.stringify(s));})()")
        await close_panels(pq)
        # partner message from the app
        pn = "Batsie" if PROFILE == "sky" else "Sky"
        pnum = "+15550100004" if PROFILE == "sky" else "+15550100001"
        await pq.evaluate("window.__fakeCalls.length = 0")
        cap = await say(pq, "tell " + pn + " dinner's ready", 3000)
        comp = [json.loads(c[1]) for c in await pq.evaluate("window.__fakeCalls") if c[0] == "compose"]
        ok("Q partner message opens in the app with the 'From …:' line", comp and comp[0].get("to") == [pnum] and comp[0].get("body", "").startswith("From " + ("Reed" if PROFILE == "batsie" else sc) + ":") and "inner" in comp[0].get("body", ""), [cap, comp])
        # music on the phone
        await pq.evaluate("window.__fakeCalls.length = 0")
        await pq.evaluate("window.__spoken = []; (function(){ const V = window.__friday.voice; const o = V.speak.bind(V); V.speak = function(t, p){ window.__spoken.push(t); return o(t, p); }; })()")
        cap1 = await say(pq, "pause the music", 2500)
        cap2 = await say(pq, "play Drake", 2500)
        cap3 = await say(pq, "play my workout playlist", 2500)
        cap4 = await say(pq, "skip this song", 2500)
        fk = await pq.evaluate("window.__fakeCalls")
        mus = [json.loads(c[1]) for c in fk if c[0] in ("music", "play")]
        ok("Q music on the phone: pause, play an artist, a playlist, skip (no Shortcut)",
           [m.get("action") for m in mus if "action" in m] == ["pause", "next"] and any(m.get("query") == "drake" and m.get("kind") == "any" for m in mus) and any(m.get("query") == "workout" and m.get("kind") == "playlist" for m in mus)
           and "Paused" in cap1 and "Playing Drake" in cap2 and "Skipping" in cap4, [cap1, cap2, cap3, cap4, mus])
        spk = await pq.evaluate("window.__spoken")
        ok("Q she says 'Paused' but lets music play without talking over it", "Paused." in spk and not any(x.startswith("Playing") or x.startswith("Skipping") for x in spk), spk)
        await close_panels(pq)
        cap = await say(pq, "play nonexistent band", 3000)
        hq = await pq.evaluate("decodeURIComponent((document.getElementById('run-shortcut-btn')||{}).href||'')")
        ok("Q music not in the library: she says so and stays in the app (no Shortcut, no Music app)", "couldn't find" in cap.lower() and "nonexistent band" in cap.lower() and "nonexistent" not in hq.lower(), [cap, hq[-60:]])
        await close_panels(pq)
        # calls
        await pq.evaluate("window.__fakeCalls.length = 0")
        cap = await say(pq, "call mom", 2500)
        fk = await pq.evaluate("window.__fakeCalls")
        ok("Q 'call mom' looks up Mom's mobile number in the app", "Calling Mom" in cap and any(c[0] == "contacts-phones" for c in fk), [cap, fk[-3:]])
        await close_panels(pq)
        # lights: tried in the app even when the check says no lights; "turn all on"; failure goes to the Shortcut
        await pq.evaluate("(()=>{ const H = Capacitor.Plugins.FridayHome; H.__list = H.list; H.list = async()=>({authorization:'authorized', lights:[], scenes:[], rooms:[], homes:1, accessories:3, otherPlugs:2}); FridayNative.home._status = null; window.__fakeCalls.length = 0; })()")
        cap = await say(pq, "turn all on", 2500)
        li = [json.loads(c[1]) for c in await pq.evaluate("window.__fakeCalls") if c[0] == "lights"]
        ok("Q 'turn all on' turns the lights on in the app, even when the check found none", li and li[0].get("on") is True and not li[0].get("room") and "lights are on" in cap.lower(), [cap, li])
        await close_panels(pq)
        await pq.evaluate("(()=>{ const H = Capacitor.Plugins.FridayHome; H.__set = H.setLights; H.setLights = async()=>{ throw new Error('no-lights'); }; })()")
        cap = await say(pq, "turn off the kitchen lights", 3000)
        cap = await say(pq, "yes", 2500)
        hq = await pq.evaluate("decodeURIComponent((document.getElementById('run-shortcut-btn')||{}).href||'')")
        ok("Q if the app can't do the lights, she asks, and after 'yes' the Shortcut gets them", "kitchen lights" in hq.lower(), [cap, hq[-60:]])
        await pq.evaluate("(()=>{ const H = Capacitor.Plugins.FridayHome; H.setLights = H.__set; H.list = H.__list; FridayNative.home._status = null; })()")
        await close_panels(pq)
        # settings: why lights can't be reached, the new rows, the texts switch
        await pq.evaluate("(()=>{ const H = Capacitor.Plugins.FridayHome; H.__list = H.list; H.list = async()=>({authorization:'authorized', lights:[], scenes:[], rooms:[], homes:0, accessories:0, otherPlugs:0}); })()")
        await pq.evaluate("document.getElementById('btn-settings').click()"); await pq.wait_for_timeout(300)
        await pq.evaluate("window.__fridaySettingsShow('phone-status')"); await pq.wait_for_timeout(200)
        await pq.evaluate("document.getElementById('btn-home-check').click()"); await pq.wait_for_timeout(800)
        hs = await pq.evaluate("document.getElementById('home-status').textContent")
        rows = await pq.evaluate("[...document.querySelectorAll('#phone-list li')].map(li=>li.textContent)")
        ok("Q Check lights explains why (no homes visible) and that she still tries the app first", "isn't showing this install any homes" in hs and "tries the app first" in hs, hs)
        ok("Q status list shows music, calls and texts in the app", any("Music on this iPhone" in r and "In the app" in r for r in rows) and any(r.startswith("Calls") and "In the app" in r for r in rows) and any(r.startswith("Texts") and "tap Send" in r for r in rows), rows)
        await pq.evaluate("(()=>{ const H = Capacitor.Plugins.FridayHome; H.list = H.__list; FridayNative.home._status = null; })()")
        await close_panels(pq)
        # background window: mid-conversation she stays awake, then sleeps; off = she stops right away
        await pq.wait_for_timeout(8500)  # the Shortcut handoff above was just now; that one is meant to skip the background
        bg = await pq.evaluate("""async () => {
          const V = window.__friday.voice; window.__fakeCalls.length = 0;
          const setVis = (v) => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => v !== 'visible' }); document.dispatchEvent(new Event('visibilitychange')); };
          await V.startListen();
          setVis('hidden'); await new Promise(r => setTimeout(r, 300));
          const kept = !!V._keepOsc, still = V.listening, win = JSON.parse(localStorage.getItem('friday.bgWindow') || 'null');
          setVis('visible'); await new Promise(r => setTimeout(r, 300));
          const off = !V._keepOsc;
          V.releaseMic();
          const st = JSON.parse(localStorage.getItem('friday.settings')); st.bgMinutes = 0; localStorage.setItem('friday.settings', JSON.stringify(st));
          await V.startListen(); window.__fakeCalls.length = 0;
          setVis('hidden'); await new Promise(r => setTimeout(r, 300));
          const stopped = !V.listening && window.__fakeCalls.some(c => c[0] === 'listen-cancel') && !V._keepOsc;
          setVis('visible'); V.releaseMic();
          st.bgMinutes = 3; localStorage.setItem('friday.settings', JSON.stringify(st));
          return { kept, still, win: !!(win && win.mins === 3), off, stopped };
        }""")
        ok("Q switching apps mid-conversation: she stays awake (3 min window); coming back ends it; set to Off she stops right away", bg["kept"] and bg["still"] and bg["win"] and bg["off"] and bg["stopped"], bg)
        await pq.evaluate("(async()=>{ const V = window.__friday.voice; await V.startListen(); V.releaseMic(); })()"); await pq.wait_for_timeout(300)
        hs = [json.loads(c[1]).get("hints", []) for c in await pq.evaluate("window.__fakeCalls") if c[0] == "listen-start"]
        ok("Q live listening is told your names (so Batsie stays Batsie)", hs and "Batsie" in hs[-1] and "Sky" in hs[-1], hs[-1:] if hs else hs)
        await close_panels(pq)
        cap = await say(pq, "turn on do not disturb", 2500)
        cap = await say(pq, "yes", 2500)
        ho = await pq.evaluate("""async () => {
          const V = window.__friday.voice;
          const setVis = (v) => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => v !== 'visible' }); document.dispatchEvent(new Event('visibilitychange')); };
          await V.startListen();
          setVis('hidden'); await new Promise(r => setTimeout(r, 300));
          const r = { kept: !!V._keepOsc, listening: V.listening };
          setVis('visible'); V.releaseMic();
          return r;
        }""")
        ok("Q after she hands you to the Shortcut, she doesn't keep listening in the background", not ho["kept"] and not ho["listening"], [cap, ho])
        await close_panels(pq)
        await pq.evaluate("window.__notifOk = true")
        await pq.evaluate("(()=>{ Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); })()")
        await pq.wait_for_timeout(800)
        await pq.evaluate("document.getElementById('btn-settings').click()"); await pq.wait_for_timeout(300)
        await pq.evaluate("window.__fridaySettingsShow('phone-status')"); await pq.wait_for_timeout(300)
        nb = await pq.evaluate("document.getElementById('btn-notify-on').hidden")
        ok("Q notifications already on in iPhone Settings: no 'Turn on notifications' button", nb is True, nb)
        await close_panels(pq)
        await close_panels(pq)
        await pq.evaluate("window.__fridayHandleLink('" + scheme + "://listen')"); await pq.wait_for_timeout(1500)
        cap = await pq.evaluate("document.getElementById('caption-line').textContent")
        ok("Q Back Tap link opens her listening", "Listening" in cap or "microphone" in cap.lower() or "device" in cap.lower(), cap)
        # live listening: words as you talk, and she waits when it sounds unfinished
        await pq.evaluate("window.__friday.voice.releaseMic()"); await pq.wait_for_timeout(200)
        lv = await pq.evaluate("""async () => {
          const L = Capacitor.Plugins.FridayListen; const parts = []; let sil = 0;
          const v = new FridayVoice({ onSilence: () => { sil = performance.now(); }, onPartial: t => parts.push(t) });
          await v.startListen();
          const mode = v._mode;
          L.__emit('partial', { text: 'Set a timer for' }); L.__emit('level', { rms: 0 });
          await new Promise(r => setTimeout(r, 1700));
          const early = sil;
          L.__emit('partial', { text: 'Set a timer for 5 minutes' });
          const t1 = performance.now();
          for (let i = 0; i < 30 && !sil; i++) await new Promise(r => setTimeout(r, 100));
          const fired = sil ? Math.round(sil - t1) : -1;
          const verdict = v._verdict;
          const text = await v.stopListen();
          return { mode, early, fired, verdict, text, parts: parts.length, handles: L.__count('partial') };
        }""")
        ok("Q live listening: words show as you talk, she waits on 'set a timer for', answers fast once it's complete",
           lv["mode"] == "native" and lv["early"] == 0 and lv["verdict"] == "done" and 400 <= lv["fired"] < 2800 and lv["text"] == "Set a timer for 5 minutes" and lv["parts"] == 2 and lv["handles"] == 0, lv)
        lv2 = await pq.evaluate("""async () => {
          const st = JSON.parse(localStorage.getItem('friday.settings')); st.liveListen = false; localStorage.setItem('friday.settings', JSON.stringify(st));
          const before = window.__fakeCalls.filter(c => c[0] === 'listen-start').length;
          const v = new FridayVoice({});
          try { await v.startListen(); } catch (e) {}
          try { v.releaseMic(); } catch (e) {}
          const after = window.__fakeCalls.filter(c => c[0] === 'listen-start').length;
          st.liveListen = true; localStorage.setItem('friday.settings', JSON.stringify(st));
          return { used: after - before, mode: v._mode || '' };
        }""")
        ok("Q Live listening off: she uses Whisper instead", lv2["used"] == 0 and lv2["mode"] != "native", lv2)
        await pq.evaluate("document.getElementById('btn-settings').click()"); await pq.wait_for_timeout(300)
        lls = await pq.evaluate("(document.getElementById('live-listen-status')||{}).textContent || ''")
        ok("Q Settings shows live listening is ready", "Ready" in lls, lls)
        await close_panels(pq)

        # ---------- A3. 3.2 AiDot lights (signed in through Settings) ----------
        await close_panels(pq)
        await pq.evaluate("document.getElementById('btn-settings').click()"); await pq.wait_for_timeout(300)
        await pq.evaluate("window.__fridaySettingsShow('aidot-status')"); await pq.wait_for_timeout(300)
        cur0 = await pq.evaluate("document.getElementById('aidot-current').textContent")
        await pq.fill("#aidot-user", "sky@mail.com"); await pq.fill("#aidot-pass", "wrong")
        await pq.evaluate("document.getElementById('btn-aidot-signin').click()"); await pq.wait_for_timeout(700)
        bad = await pq.evaluate("document.getElementById('aidot-status').textContent")
        await pq.fill("#aidot-pass", "hunter2-secret")
        await pq.evaluate("document.getElementById('btn-aidot-signin').click()"); await pq.wait_for_timeout(900)
        res = await pq.evaluate("""() => ({ cur: document.getElementById('aidot-current').textContent,
          rows: [...document.querySelectorAll('#aidot-list li')].map(l => l.textContent),
          pw: document.getElementById('aidot-pass').value, signinHidden: document.getElementById('aidot-signin').hidden,
          leak: Object.keys(localStorage).some(k => (localStorage.getItem(k) || '').indexOf('hunter2') >= 0),
          phone: [...document.querySelectorAll('#phone-list li')].map(l => l.textContent).filter(t => t.indexOf('AiDot') === 0),
          status: document.getElementById('aidot-status').textContent })""")
        si = [json.loads(c[1]) for c in await pq.evaluate("window.__fakeCalls") if c[0] == "aidot-signin"]
        ok("A3 AiDot sign-in: wrong password explained; right one lists the lights; the app never keeps the password",
           cur0 == "Off" and "isn't right" in bad and res["cur"] == "3 lights" and len(res["rows"]) == 3 and res["pw"] == "" and res["signinHidden"] and not res["leak"]
           and si and si[-1]["country"] == "United States" and si[-1]["region"] == "us", [cur0, bad, res, si])
        ok("A3 the status list shows AiDot lights done in the app", res["phone"] and "In the app (3 lights" in res["phone"][0], res["phone"])
        await pq.screenshot(path=OUT + "A3-aidot-settings.png")
        await pq.evaluate("window.__fakeCalls.length = 0; document.querySelector('#aidot-list li .btn').click()"); await pq.wait_for_timeout(400)
        tap = [json.loads(c[1]) for c in await pq.evaluate("window.__fakeCalls") if c[0] == "aidot"]
        ok("A3 a light's On button switches just that light", tap and tap[0].get("ids") == ["d1"] and tap[0].get("on") is True, tap)
        await close_panels(pq); await close_panels(pq)
        await pq.evaluate("window.__fakeCalls.length = 0")
        c1 = await say(pq, "turn the bedroom lamp blue", 2500)
        c2 = await say(pq, "set the lights to 40%", 2500)
        c3 = await say(pq, "make the desk lamp warm white", 2500)
        c4 = await say(pq, "turn off the porch light", 2500)
        fk = await pq.evaluate("window.__fakeCalls")
        ad = [json.loads(c[1]) for c in fk if c[0] == "aidot"]
        hk = [c for c in fk if c[0] == "lights"]
        sc_btn = await pq.evaluate("!!document.getElementById('run-shortcut-btn')")
        ok("A3 AiDot by voice: a color, all lights to 40%, warm white, one light off (no Shortcut, no Apple Home)",
           len(ad) == 4 and ad[0].get("ids") == ["d1"] and ad[0].get("rgb") == [0, 60, 255] and ad[1].get("ids") == [] and ad[1].get("brightness") == 40
           and ad[2].get("ids") == ["d2"] and ad[2].get("cct") == 2700 and ad[3].get("ids") == ["d3"] and ad[3].get("on") is False and not hk and not sc_btn
           and "Bedroom Lamp is now blue" in c1 and "lights are at 40 percent" in c2 and "Desk Lamp is now warm white" in c3 and "Porch Light is off" in c4, [c1, c2, c3, c4, ad, hk])
        await pq.evaluate("window.__aidotMiss = ['d3']")
        c5 = await say(pq, "turn off the lights", 2500)
        await pq.evaluate("window.__aidotMiss = []")
        ok("A3 if one light doesn't answer, she says which", "lights are off, except Porch Light, which didn't answer" in c5, c5)
        c6 = await say(pq, "are the lights on", 2500)
        c7 = await say(pq, "is the bedroom lamp on", 2500)
        ok("A3 'are the lights on?' reads the lights over Wi-Fi", "1 of 3 lights are on: Bedroom Lamp" in c6 and "Bedroom Lamp is on at 40 percent" in c7, [c6, c7])
        await pq.evaluate("window.__aidotAway = true; window.__fakeCalls.length = 0")
        c8 = await say(pq, "turn on the bedroom lamp", 2500)
        fk = await pq.evaluate("window.__fakeCalls")
        hk = [json.loads(c[1]) for c in fk if c[0] == "lights"]
        ok("A3 away from home Wi-Fi, lights fall back to Apple Home in the app", hk and hk[0].get("on") is True and "lights are on" in c8.lower(), [c8, hk])
        await close_panels(pq)
        c9 = await say(pq, "turn the bedroom lamp red", 3000)
        c9 = await say(pq, "yes", 2500)
        hq = await pq.evaluate("decodeURIComponent((document.getElementById('run-shortcut-btn')||{}).href||'')")
        ok("A3 away from home, colors: she asks, and after 'yes' they go to the Shortcut", "bedroom lamp red" in hq.lower(), [c9, hq[-60:]])
        await pq.evaluate("window.__aidotAway = false")
        await close_panels(pq)

        # ---------- H3. 3.5 alarms, steps and sleep, Wi-Fi ----------
        await close_panels(pq)
        await pq.evaluate("window.__fakeCalls = []")
        capa = await say(pq, "set an alarm for 7am", 2200)
        fake = await pq.evaluate("window.__fakeCalls")
        al = [json.loads(c[1]) for c in fake if c[0] == "alarm"]
        hhmm = await pq.evaluate("t => { const d = new Date(t); return [d.getHours(), d.getMinutes(), d > new Date()]; }", al[0]["at"]) if al else None
        ok("H3 'set an alarm for 7am' sets a real alarm in the app (no Shortcut)", al and hhmm == [7, 0, True] and "Alarm set for 7 AM" in capa and not await pq.evaluate("!!document.getElementById('run-shortcut-btn')"), [capa, hhmm])
        caps = await say(pq, "how many steps have I taken", 1800)
        capsl = await say(pq, "how did I sleep", 1800)
        ok("H3 steps and sleep from Apple Health", "4,210 steps" in caps and "7 hours and 20 minutes" in capsl, [caps, capsl])
        capw = await say(pq, "what wifi am I on", 1800)
        ok("H3 'what wifi am I on'", "HomeNet" in capw, capw)
        await close_panels(pq)

        # ---------- K2. 3.5.2 keyboard sits under the bar; pictures with answers ----------
        await close_panels(pq)
        await pq.evaluate("document.getElementById('tb-type').click()"); await pq.wait_for_timeout(300)
        await pq.evaluate("((window.__kitL || {}).keyboard || []).forEach(f => f({height: 336}))"); await pq.wait_for_timeout(300)
        kb = await pq.evaluate("(()=>{ const r = document.getElementById('talkbar').getBoundingClientRect(); return {bottomGap: Math.round(innerHeight - r.bottom), kb: getComputedStyle(document.documentElement).getPropertyValue('--kb').trim(), n: ((window.__kitL || {}).keyboard || []).length}; })()")
        ok("K2 when the keyboard opens, the bar sits right on top of it", kb["n"] >= 1 and kb["kb"] == "336px" and 336 <= kb["bottomGap"] <= 360, kb)
        await pq.evaluate("document.querySelector('#ui-size') && (()=>{ document.documentElement.style.setProperty('--ui-zoom','0.72'); })()")
        await pq.evaluate("((window.__kitL || {}).keyboard || []).forEach(f => f({height: 336}))"); await pq.wait_for_timeout(300)
        kb2 = await pq.evaluate("(()=>{ const r = document.getElementById('talkbar').getBoundingClientRect(); return Math.round(innerHeight - r.bottom); })()")
        ok("K2 the bar still clears the keyboard at Tiny size", 336 <= kb2 <= 370, kb2)
        await pq.evaluate("document.documentElement.style.setProperty('--ui-zoom','1'); ((window.__kitL || {}).keyboard || []).forEach(f => f({height: 0})); window.__friday.exitTyping()")
        STATE["calls"] = [c for c in STATE["calls"] if c[0] != "openverse"]
        await say(pq, "what are the best tools for building stairs", 4500)
        pics = await pq.evaluate("({hidden: document.getElementById('pics').hidden, n: document.querySelectorAll('#pics img').length})")
        ovq = [c[1] for c in STATE["calls"] if c[0] == "openverse"]
        ok("K2 'best tools' shows photos of the tools she named", not pics["hidden"] and pics["n"] >= 4 and "circular saw" in ovq and "speed square" in ovq, [pics, ovq])
        await pq.evaluate("document.querySelector('#pics img').click()"); await pq.wait_for_timeout(300)
        pvw = await pq.evaluate("({open: !document.getElementById('pic-view').hidden, src: document.getElementById('pic-view-img').src})")
        await pq.evaluate("document.getElementById('pic-view').click()")
        ok("K2 tap a photo to see it big", pvw["open"] and "img.example.com" in pvw["src"], pvw)
        STATE["calls"] = [c for c in STATE["calls"] if c[0] != "openverse"]
        await say(pq, "tell me a joke", 3000)
        await pq.evaluate("window.__fakeCalls = []")
        c0 = await say(pq, "open the camera", 1500)
        f0 = [c for c in await pq.evaluate("window.__fakeCalls") if c[0] == "camera"]
        await close_panels(pq)
        await pq.evaluate("(()=>{ const s = JSON.parse(localStorage.getItem('friday.settings')); s.cameraInApp = true; localStorage.setItem('friday.settings', JSON.stringify(s)); window.__fridayApplyTalkbar && 0; })()")
        await pq.evaluate("(()=>{ const el = document.getElementById('set-camera-inapp'); el.checked = true; el.dispatchEvent(new Event('change')); })()")
        c1 = await say(pq, "take a picture", 1800)
        f1 = [c for c in await pq.evaluate("window.__fakeCalls") if c[0] == "camera"]
        c2 = await say(pq, "what is this", 3000)
        ok("K2 camera in the app: off by default (Shortcut), on: opens her camera, saves to Photos, and she can look at it", not f0 and f1 and "Saved to your Photos" in c1 and "coffee mug" in c2.lower() and not await pq.evaluate("!!document.getElementById('run-shortcut-btn')"), [c0, c1, c2])
        await pq.evaluate("(()=>{ const el = document.getElementById('set-camera-inapp'); el.checked = false; el.dispatchEvent(new Event('change')); })()")
        await close_panels(pq)
        await pq.evaluate("window.__shared = {}; window.__friday.applyLook('X7', false); window.__fridaySyncWidget(true)"); await pq.wait_for_timeout(5000)
        sh = await pq.evaluate("window.__shared || {}")
        wj = json.loads(sh.get("friday-widget.json", "{}") or "{}")
        frames = [k for k in sh if k.startswith("orb-")]
        sbs = await pq.evaluate("(()=>{ document.getElementById('btn-standby-copy').click(); return window.__fridayLastStandby || ''; })()")
        ok("K2 StandBy widget: her current look (4 angles) and status saved for Scriptable; script copies", wj.get("name") == ("Reed" if PROFILE == "batsie" else sc) and wj.get("look") == "X7" and wj.get("talkedAt", 0) > 0 and wj.get("reply") == "" and len(frames) == 4 and all(int(sh[f][4:]) > 1000 for f in frames) and "bookmarkedPath" in sbs and "applyTimeStyle" in sbs, [wj, frames, len(sbs)])
        ok("K2 no photos for small talk", not [c for c in STATE["calls"] if c[0] == "openverse"], [c for c in STATE["calls"] if c[0] == "openverse"])
        await close_panels(pq)

        # ---------- H2. 3.4 the whole home in Apple Home (climate, fans, plugs, TV power; never locks) ----------
        await close_panels(pq)
        await pq.evaluate("window.__fakeCalls = []; FridayNative.home.devices()"); await pq.wait_for_timeout(300)
        cap1 = await say(pq, "what's the temperature inside", 2200)
        cap2 = await say(pq, "set the thermostat to 70", 2200)
        cap3 = await say(pq, "turn on the fan", 2200)
        cap4 = await say(pq, "turn on the coffee maker", 2200)
        await close_panels(pq)
        cap5 = await say(pq, "make it cooler", 2200)
        fake = await pq.evaluate("window.__fakeCalls")
        hcs = [json.loads(c[1]) for c in fake if c[0] == "hcontrol"]
        ok("H2 'what's the temperature inside' reads Apple Home (not the weather)", "77 degrees inside" in cap1 and "set to 72" in cap1, cap1)
        ok("H2 thermostat set in the app (Fahrenheit to Apple's Celsius)", any(h.get("kind") == "climate" and abs(h.get("temperature", 0) - 21.1) < 0.05 for h in hcs) and "70 degrees" in cap2, [cap2, hcs[:2]])
        ok("H2 fans and anything else in Apple Home by name, in the app", any(h.get("kind") == "fan" and h.get("on") is True for h in hcs) and any(h.get("name") == "Coffee Maker" and h.get("on") is True for h in hcs) and "Ceiling Fan is on" in cap3 and "Coffee Maker is on" in cap4, [cap3, cap4])
        ok("H2 'make it cooler' lowers the thermostat 2 degrees", any(h.get("kind") == "climate" and abs(h.get("temperature", 0) - 21.1) < 0.05 for h in hcs[-1:]) and "70 degrees" in cap5, [cap5, hcs[-1:]])
        await pq.evaluate("window.__fakeCalls = []")
        await say(pq, "unlock the front door", 1500)
        fake = await pq.evaluate("window.__fakeCalls")
        ok("H2 door locks are never touched", not [c for c in fake if c[0] == "hcontrol"], fake[:3])
        await close_panels(pq)

        # ---------- A4. 3.2 Paste a key (free brains in one step) ----------
        await pq.evaluate("document.getElementById('btn-settings').click()"); await pq.wait_for_timeout(300)
        await pq.evaluate("window.__fridaySettingsShow('paste-key-row')"); await pq.wait_for_timeout(300)
        await pq.fill("#paste-key", "AIzaBADKEYxxxxxxxxxxxxxxxxxxxxxxxxxxx")
        await pq.evaluate("document.getElementById('btn-paste-key').click()"); await pq.wait_for_timeout(1500)
        kbad = await pq.evaluate("document.getElementById('paste-key-status').textContent")
        await pq.fill("#paste-key", "AIzaSyTESTKEY1234567890abcdefghijklmn")
        await pq.evaluate("document.getElementById('btn-paste-key').click()"); await pq.wait_for_timeout(2500)
        k1 = await pq.evaluate("document.getElementById('paste-key-status').textContent")
        await pq.evaluate("window.__gcalls0 = 0")
        await pq.fill("#paste-key", "AQ.Ab8RN6TESTnewstylekey_0123456789abcdef")
        await pq.evaluate("document.getElementById('btn-paste-key').click()"); await pq.wait_for_timeout(2500)
        kaq = await pq.evaluate("document.getElementById('paste-key-status').textContent")
        await pq.fill("#paste-key", "sk-or-v1-0123456789abcdef0123456789abcdef0123")
        await pq.evaluate("document.getElementById('btn-paste-key').click()"); await pq.wait_for_timeout(2500)
        k2 = await pq.evaluate("document.getElementById('paste-key-status').textContent")
        conns = await pq.evaluate("""() => { const c = JSON.parse(localStorage.getItem('friday.connections') || '[]');
          return c.map(x => ({ name: x.name, provider: x.provider, model: x.model, backup: !!x.backup, key: (localStorage.getItem('friday.agentKey.' + x.id) || '').slice(0, 8) })); }""")
        inconn = await pq.evaluate("(localStorage.getItem('friday.connections') || '').indexOf('AIzaSyTEST') >= 0")
        g = [c for c in conns if c["provider"] == "gemini" and c["key"] == "AIzaSyTE"]
        o = [c for c in conns if c["provider"] == "openrouter" and c["key"] == "sk-or-v1"]
        ok("A4 paste a Gemini key: she knows it's Gemini, picks a free model, tests it and turns it on as a backup brain",
           g and g[-1]["backup"] and g[-1]["model"] == "gemini-flash-latest" and "backup brain" in k1 and "Gemini" in k1 and not inconn, [k1, g, inconn])
        aq = [c for c in conns if c["provider"] == "gemini" and c["key"] == "AQ.Ab8RN"]
        nat = [c for c in STATE["calls"] if c[0] == "chat" and len(c) > 4 and c[4] == "native" and c[5] == "AQ."]
        ok("A4 Google's new AQ. Gemini keys work (through Google's own Gemini connection)", aq and aq[-1]["backup"] and aq[-1]["model"] == "gemini-flash-latest" and "Gemini" in kaq and "backup brain" in kaq and nat, [kaq, aq, nat[-1:]])
        ok("A4 paste an OpenRouter key: added with a free model", o and o[-1]["backup"] and o[-1]["model"].endswith(":free") and "OpenRouter" in k2, [k2, o])
        ok("A4 a key nobody accepts is explained, nothing added", "No AI service accepted" in kbad and not [c for c in conns if c["key"].startswith("AIzaBAD")], [kbad])
        await pq.screenshot(path=OUT + "A4-paste-key.png")
        await close_panels(pq); await close_panels(pq)
        # ---------- T. 3.3 new main screen, Settings hub, links, refresh my apps, Cloudflare, bubbles ----------
        await close_panels(pq)
        await pq.evaluate("window.__friday.applyLayout('orbit')"); await pq.wait_for_timeout(400)
        fake = await pq.evaluate("window.__fakeCalls")
        tb = await pq.evaluate("({cls: document.body.className, bar: !!document.getElementById('talkbar') && getComputedStyle(document.getElementById('talkbar')).display !== 'none', ph: document.getElementById('tb-input').placeholder})")
        ok("T pill bar sits along the bottom of her layout (camera, text box, Live)", "talkbar-on" in tb["cls"] and "talk-pill" in tb["cls"] and tb["bar"] and tb["ph"] in ("Type to " + sc, "Type to F.R.I.D.A.Y.", "Type to Reed"), tb)
        dkb = await pq.evaluate("window.__darkkb || 0")
        ok("T the iPhone keyboard is set to dark when she starts", dkb >= 1, dkb)
        await pq.screenshot(path=OUT + "T1-pill.png")
        await pq.evaluate("document.getElementById('tb-type').click()"); await pq.wait_for_timeout(500)
        ty = await pq.evaluate("({typing: document.body.classList.contains('typing'), cy: window.__friday.orb._cyN, rk: window.__friday.orb._radiusK, live: document.getElementById('tb-live').classList.contains('on')})")
        ok("T tapping Type brings up typing and moves her orb to the top (pill)", ty["typing"] and abs(ty["cy"] - 0.2) < 0.001 and ty["rk"] < 0.2 and not ty["live"], ty)
        tts0 = len([c for c in STATE["calls"] if c[0] == "tts"])
        await pq.evaluate("window.__spoke = 0; (()=>{ const v = window.__friday.voice; const sp = v.speak; })()")
        await pq.fill("#tb-input", "tell me a joke")
        await pq.evaluate("document.getElementById('tb-form').dispatchEvent(new Event('submit', {cancelable:true}))")
        await pq.wait_for_timeout(3500)
        th = await pq.evaluate("[...document.querySelectorAll('#type-thread > div')].map(d=>d.className+':'+d.textContent)")
        cy2 = await pq.evaluate("window.__friday.orb._cyN")
        ok("T her orb stays up top while you type, even after she answers", abs(cy2 - 0.2) < 0.001, cy2)
        tts1 = len([c for c in STATE["calls"] if c[0] == "tts"])
        ok("T typed question: answer shows as text above the bar, she doesn't talk", any(x.startswith("tt-me:tell me a joke") for x in th) and any(x.startswith("tt-her:") and "recharge" in x for x in th) and tts1 == tts0, [th[-3:], tts0, tts1])
        await pq.screenshot(path=OUT + "T2-typing.png")
        await pq.evaluate("document.getElementById('tb-live').click()"); await pq.wait_for_timeout(800)
        lv = await pq.evaluate("({typing: document.body.classList.contains('typing'), on: document.getElementById('tb-live').classList.contains('on'), cy: window.__friday.orb._cyN})")
        ok("T gold Live button goes back to live listening (keyboard away, orb back)", not lv["typing"] and lv["on"] and lv["cy"] > 0.3, lv)
        await pq.evaluate("document.getElementById('tb-live').click()"); await pq.wait_for_timeout(600)
        ok("T one tap on Live turns live listening off", not await pq.evaluate("document.getElementById('tb-live').classList.contains('on')"))
        # Glass dock
        await pq.evaluate("document.getElementById('btn-settings').click()"); await pq.wait_for_timeout(300)
        await pq.evaluate("window.__fridaySettingsShow('accord-mainscreen')"); await pq.wait_for_timeout(200)
        await pq.evaluate("document.querySelector('#talk-style [data-talk-style=dock]').click()"); await pq.wait_for_timeout(200)
        await close_panels(pq); await pq.wait_for_timeout(400)
        await pq.screenshot(path=OUT + "T3-dock.png")
        await pq.evaluate("document.getElementById('tb-type').click()"); await pq.wait_for_timeout(500)
        dk = await pq.evaluate("({cls: document.body.className, cy: window.__friday.orb._cyN, op: getComputedStyle(document.getElementById('orb-canvas')).opacity, saved: JSON.parse(localStorage.getItem('friday.settings')).talkStyle})")
        ok("T Glass dock: typing keeps her orb big and dimmed", "talk-dock" in dk["cls"] and "typing" in dk["cls"] and abs(dk["cy"] - 0.2) > 0.05 and float(dk["op"]) < 0.8 and dk["saved"] == "dock", dk)
        await pq.screenshot(path=OUT + "T4-dock-typing.png")
        await pq.evaluate("window.__friday.exitTyping()")
        await pq.evaluate("document.getElementById('btn-settings').click()"); await pq.wait_for_timeout(300)
        await pq.evaluate("window.__fridaySettingsShow('accord-mainscreen')")
        await pq.evaluate("document.getElementById('set-hide-orb').click()")
        await pq.evaluate("document.querySelector('#talk-style [data-talk-style=pill]').click()")
        await close_panels(pq)
        await pq.evaluate("document.getElementById('tb-type').click()"); await pq.wait_for_timeout(500)
        ho = await pq.evaluate("({op: getComputedStyle(document.getElementById('orb-canvas')).opacity, cls: document.body.className})")
        ok("T 'Hide her orb while typing' hides the orb until Live is back", float(ho["op"]) < 0.05 and "hide-orb-typing" in ho["cls"], ho)
        await pq.evaluate("window.__friday.exitTyping()")
        await pq.evaluate("document.getElementById('set-hide-orb').click()")
        # Settings hub and quick switches
        await pq.evaluate("document.getElementById('btn-settings').click()"); await pq.wait_for_timeout(300)
        await pq.evaluate("document.getElementById('settings-back') && document.getElementById('settings-back').click()"); await pq.wait_for_timeout(200)
        hub = await pq.evaluate("""(()=>{ const n = document.querySelectorAll('#settings-hub .shub-b').length;
            document.querySelector('#settings-hub .shub-b[data-group=brains]').click();
            const vis = [...document.querySelectorAll('#settings-menu .sgroup')].filter(g=>!g.hidden).map(g=>g.getAttribute('data-group'));
            const items = [...document.querySelectorAll('.sgroup[data-group=brains] .smenu-item')].map(i=>i.getAttribute('data-page'));
            return {n, vis, items, on: document.querySelector('#settings-hub .shub-b.on').getAttribute('data-group')}; })()""")
        ok("T Settings hub: 6 bubbles, tapping Brains shows only its pages", hub["n"] == 6 and hub["vis"] == ["brains"] and "brain" in hub["items"] and hub["on"] == "brains", hub)
        await pq.screenshot(path=OUT + "T5-hub.png")
        qs = await pq.evaluate("""(()=>{ const q = document.getElementById('qs-suggest'); q.checked = false; q.dispatchEvent(new Event('change'));
            return {orig: document.getElementById('set-suggestions').checked, saved: JSON.parse(localStorage.getItem('friday.settings')).suggestions, cls: document.body.classList.contains('no-suggestions'), chips: getComputedStyle(document.getElementById('chips')).display}; })()""")
        ok("T quick switch turns Suggestions off (chips gone from the main screen)", qs["orig"] is False and qs["saved"] is False and qs["cls"] and qs["chips"] == "none", qs)
        await pq.evaluate("(()=>{ const q = document.getElementById('qs-suggest'); q.checked = true; q.dispatchEvent(new Event('change')); })()")
        ql = await pq.evaluate("""(()=>{ const o = document.getElementById('set-live-listen'); const before = o.checked; const q = document.getElementById('qs-live'); q.checked = !before; q.dispatchEvent(new Event('change'));
            const after = o.checked; q.checked = before; q.dispatchEvent(new Event('change')); return {before, after, back: o.checked}; })()""")
        ok("T quick switch for Live listening flips the real setting", ql["after"] == (not ql["before"]) and ql["back"] == ql["before"], ql)
        # Fonts and size
        await pq.evaluate("window.__fridaySettingsShow('accord-font')"); await pq.wait_for_timeout(200)
        fs = await pq.evaluate("""(()=>{ const n = document.querySelectorAll('#font-grid button').length;
            document.querySelector('#font-grid [data-font=orbitron]').click(); const t = getComputedStyle(document.documentElement).getPropertyValue('--font-title');
            document.querySelector('#font-grid [data-font=inter]').click(); const f = getComputedStyle(document.documentElement).getPropertyValue('--font');
            document.querySelector('#ui-size [data-size="0.72"]').click(); const z = getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom').trim();
            const s = JSON.parse(localStorage.getItem('friday.settings')); return {n, t, f, z, font: s.font, size: s.uiSize, cur: document.getElementById('font-current').textContent}; })()""")
        await pq.screenshot(path=OUT + "T6-tiny.png")
        ok("T 8 fonts and a Tiny size (saved, applied right away)", fs["n"] == 8 and "Orbitron" in fs["t"] and "Inter" in fs["f"] and fs["z"] == "0.72" and fs["font"] == "inter" and abs(fs["size"] - 0.72) < 1e-6 and "Tiny" in fs["cur"], fs)
        loaded = await pq.evaluate("document.fonts.check('16px Inter')")
        ok("T the fonts come with the app (work offline)", loaded, loaded)
        await pq.evaluate("(()=>{ document.querySelector('#ui-size [data-size=\"1\"]').click(); document.querySelector('#font-grid [data-font=sf]').click(); })()")
        # Links
        await pq.evaluate("window.__fridaySettingsShow('links-row')"); await pq.wait_for_timeout(200)
        await pq.fill("#link-name", "Radio"); await pq.fill("#link-url", "radio.example.com")
        await pq.evaluate("document.getElementById('btn-link-add').click()"); await pq.wait_for_timeout(300)
        lk = await pq.evaluate("""(()=>({ st: document.getElementById('link-status').textContent, c: JSON.parse(localStorage.getItem('friday.connections')).filter(x=>x.name==='Radio'),
            b: window.__friday.bubbles.list.filter(x=>x.label==='Radio').length, rows: document.querySelectorAll('#links-list .connection-row').length, head: document.getElementById('connections-current').textContent }))()""")
        ok("T add a link in one step: saved, bubble on her screen, listed", lk["c"] and lk["c"][0]["url"] == "https://radio.example.com" and lk["b"] == 1 and "open Radio" in lk["st"] and lk["rows"] >= 2 and "link" in lk["head"], lk)
        await close_panels(pq)
        await pq.evaluate("window.__fridayLastUrl = ''")
        cap = await say(pq, "open radio", 1500)
        ok("T 'open radio' opens your link by its name", await pq.evaluate("window.__fridayLastUrl") == "https://radio.example.com" and "Opening Radio" in cap, cap)
        # Refresh my apps
        await pq.evaluate("document.getElementById('btn-settings').click()"); await pq.wait_for_timeout(300)
        await pq.evaluate("window.__fridaySettingsShow('links-row')")
        await pq.evaluate("document.getElementById('btn-ready-refresh').click()"); await pq.wait_for_timeout(500)
        rf = await pq.evaluate("""(()=>({ c: JSON.parse(localStorage.getItem('friday.connections')).filter(x=>x.ready==='refresh'), st: document.getElementById('refresh-status').textContent,
            b: window.__friday.bubbles.list.filter(x=>x.label==='Refresh apps').length }))()""")
        ok("T ready-made Refresh apps link (finds AltStore, turns on LocalDevVPN first)", rf["c"] and rf["c"][0]["url"] == "localdevvpn://enable?scheme=altstore" and rf["b"] == 1, rf)
        await close_panels(pq)
        await pq.evaluate("window.__fridayLastUrl = ''")
        cap = await say(pq, "refresh my apps", 2000)
        ok("T 'refresh my apps': LocalDevVPN comes on and AltStore opens (no Shortcut)", await pq.evaluate("window.__fridayLastUrl") == "localdevvpn://enable?scheme=altstore" and "AltStore" in cap and not await pq.evaluate("!!document.getElementById('run-shortcut-btn')"), cap)
        await pq.evaluate("window.__fridayLastUrl = ''")
        rb = await pq.evaluate("(()=>{ const B = window.__friday.bubbles; const b = B.list.find(x => x.label === 'Refresh apps'); if (!b) return false; B.setEdit && B.setEdit(false); B.activate(b); return true; })()")
        await pq.wait_for_timeout(1200)
        ok("T tapping the Refresh apps bubble does the same", rb and await pq.evaluate("window.__fridayLastUrl") == "localdevvpn://enable?scheme=altstore", rb)
        await pq.evaluate("(()=>{ window.__notifOk = true; FridayStorage.set('notifyAllowed', true); window.__fakeCalls = []; })()")
        await pq.evaluate("document.getElementById('btn-settings').click()"); await pq.wait_for_timeout(300)
        await pq.evaluate("window.__fridaySettingsShow('accord-refresh')")
        await pq.evaluate("document.querySelector('#refresh-every [data-every=\"5\"]').click()"); await pq.wait_for_timeout(1200)
        fake = await pq.evaluate("window.__fakeCalls")
        nts = [json.loads(c[1]) for c in fake if c[0] == "notify"]
        rem = [n["notifications"][0] for n in nts if "refresh" in n["notifications"][0]["title"].lower()]
        days = await pq.evaluate("t => Math.round((new Date(t) - Date.now()) / 86400000)", rem[0]["schedule"]["at"]) if rem else None
        ok("T refresh reminder every 5 days; tapping it does the refresh", rem and rem[0].get("extra", {}).get("action") == "refresh-apps" and days is not None and 3 <= days <= 6 and await pq.evaluate("document.getElementById('refresh-current').textContent") == "Every 5 days", [rem[:1], days])
        await close_panels(pq)
        await pq.evaluate("window.__fridayLastUrl = ''")
        ntl = await pq.evaluate("(window.__notifTap || []).filter(([ev]) => ev === 'localNotificationActionPerformed').length")
        await pq.evaluate("(window.__notifTap || []).forEach(([ev, fn]) => { if (ev === 'localNotificationActionPerformed') fn({notification: {extra: {action: 'refresh-apps'}}}); })")
        await pq.wait_for_timeout(2800)
        ok("T tapping the reminder turns on LocalDevVPN and opens AltStore", await pq.evaluate("window.__fridayLastUrl") == "localdevvpn://enable?scheme=altstore", [ntl, await pq.evaluate("window.__fridayLastUrl")])
        await pq.evaluate("document.getElementById('btn-settings').click()"); await pq.wait_for_timeout(300)
        await pq.evaluate("window.__fridaySettingsShow('accord-refresh')")
        await pq.evaluate("document.querySelector('#refresh-every [data-every=\"0\"]').click()"); await pq.wait_for_timeout(500)
        # Cloudflare
        await pq.evaluate("window.__fridaySettingsShow('paste-key-row')")
        await pq.evaluate("document.getElementById('btn-cf-open').click()")
        await pq.fill("#cf-account", "0123456789abcdef0123456789abcdef"); await pq.fill("#cf-token", "BADCF_token_0123456789abcdefgh")
        await pq.evaluate("document.getElementById('btn-cf-add').click()"); await pq.wait_for_timeout(1500)
        cfbad = await pq.evaluate("document.getElementById('paste-key-status').textContent")
        await pq.fill("#cf-token", "cfTESTtoken_0123456789abcdefghij")
        await pq.evaluate("window.__fakeCalls = []")
        await pq.evaluate("document.getElementById('btn-cf-add').click()"); await pq.wait_for_timeout(1500)
        cfok = await pq.evaluate("document.getElementById('paste-key-status').textContent")
        fake = await pq.evaluate("window.__fakeCalls")
        hc = [json.loads(c[1]) for c in fake if c[0] == "http"]
        cfc = await pq.evaluate("JSON.parse(localStorage.getItem('friday.connections')).filter(c=>c.provider==='cloudflare').map(c=>({name:c.name, model:c.model, backup:!!c.backup, base:c.baseUrl}))")
        ok("T Cloudflare: a wrong token is explained, nothing added", "didn't accept" in cfbad, cfbad)
        ok("T Cloudflare added as a free backup brain (sent straight from the iPhone)", cfc and cfc[0]["backup"] and cfc[0]["model"].startswith("@cf/") and "0123456789abcdef0123456789abcdef/ai/v1" in cfc[0]["base"] and "Cloudflare is added" in cfok and hc and "/ai/v1/chat/completions" in hc[-1]["url"] and not hc[-1]["stream"], [cfok, cfc, hc[-1:]])
        await close_panels(pq)
        cap = await say(pq, "ask Cloudflare what is 2 plus 2", 3000)
        ok("T 'ask Cloudflare …' works", "Cloudflare" in cap and "Four" in cap, cap)
        provs = await pq.evaluate("Object.keys(FridayBrain.PRESETS)")
        ok("T no GitHub, and Cerebras/Mistral marked as needing a card", "github" not in provs and not await pq.evaluate("!!FridayBrain.PRESETS.cerebras.free || !!FridayBrain.PRESETS.mistral.free") and "card" in await pq.evaluate("FridayBrain.PRESETS.mistral.label"), provs)
        # Bubbles: memories only in the neural map, unused ones fade and come back
        mb = await pq.evaluate("window.__friday.bubbles.list.filter(b => /^mem/i.test(b.suggestKey || '') || b.kind === 'fact' || b.kind === 'learned').map(b=>b.label)")
        ok("T things she learns stay in the neural map, not on the main screen", mb == [], mb)
        fd = await pq.evaluate("""(()=>{ const B = window.__friday.bubbles; if (!B.learning()) B.setLearning(true);
            const old = Date.now() - 20 * 86400000; const at = JSON.parse(localStorage.getItem('friday.usageAt') || '{}');
            const t = B.list.find(b => !(b.action === 'panel' && b.panel === 'memory') && !b.suggest); const m = B.list.find(b => b.action === 'panel' && b.panel === 'memory');
            if (!t || !m) return {missing: true};
            t.addedAt = old; m.addedAt = old; at[B.usageKey(t)] = old; at[B.usageKey(m)] = old; localStorage.setItem('friday.usageAt', JSON.stringify(at)); B.save();
            B._learnStep(); const gone = !B.list.some(b => b.id === t.id); const memStays = B.list.some(b => b.id === m.id);
            const faded = Object.keys(JSON.parse(localStorage.getItem('friday.bubblesFaded') || '{}'));
            B.noteUsage(B.usageKey(t)); B._learnStep(); const back = B.list.some(b => B.usageKey(b) === B.usageKey(t));
            return {label: t.label, gone, memStays, faded, back}; })()""")
        ok("T a bubble you stop using fades after 2 weeks and comes back when you use it; Memory always stays", fd.get("gone") and fd.get("memStays") and fd.get("back"), fd)
        await pq.screenshot(path=OUT + "T9-home.png")
        # Max but smart: extra resolution only while active, eases off when warm, back when cool
        ms = await pq.evaluate("""(()=>{ const o = window.__friday.orb; o.setPower({}); o.setRender('hd'); o.setRender('max');
            const q0 = o.quality.name, w0 = o.canvas.width, light = !!o._light; o.setPower({rest: true}); const w1 = o.canvas.width, rest = !!o._ssRest;
            o.setPower({}); const w2 = o.canvas.width; return {q0, w0, w1, w2, rest, light, dev: window.devicePixelRatio, css: o.canvas.clientWidth}; })()""")
        ok("T Max draws bigger than the screen while she's active, rests at full sharpness", ms["q0"] == "max" and ms["w0"] > ms["css"] * ms["dev"] and ms["w1"] == round(ms["css"] * ms["dev"]) and ms["rest"] and ms["w2"] == ms["w0"], ms)
        ht = await pq.evaluate("""(()=>{ const o = window.__friday.orb; const fire = s => ((window.__kitL && window.__kitL.thermal) || []).forEach(f => f({state: s}));
            const q0 = o.quality.name, w0 = o.canvas.width; fire('serious'); const s1 = {hot: !!o._hot, cap: o._heatCap, w: o.canvas.width};
            fire('critical'); const q2 = o.quality.name; fire('nominal'); return {q0, w0, s1, q2, q3: o.quality.name, cap: o._heatCap, w3: o.canvas.width, n: ((window.__kitL || {}).thermal || []).length}; })()""")
        ok("T phone gets warm: no extra resolution and 30 fps; hot: lighter look; cool again: back to Max", ht["n"] >= 1 and ht["s1"]["hot"] and ht["s1"]["cap"] == 30 and ht["s1"]["w"] < ht["w0"] and ht["q2"] == "med" and ht["q3"] == ht["q0"] and ht["cap"] == 0 and ht["w3"] == ht["w0"], ht)
        await pq.evaluate("window.__friday.orb.setRender('hd')")

        # ---------- GV. 3.4.1 Gemini voices (using the Gemini key added above) ----------
        await close_panels(pq)
        gl = await pq.evaluate("(()=>{ const V = window.__friday.voice; const g = FridayVoice.AI_VOICES.filter(a => a.gemini); return {n: g.length, key: !!FridayVoice.geminiKey()}; })()")
        await pq.evaluate("(()=>{ const s = JSON.parse(localStorage.getItem('friday.settings')); s.voiceURI = 'ai:gem-kore'; localStorage.setItem('friday.settings', JSON.stringify(s)); window.__friday.voice.setVoiceURI('ai:gem-kore'); localStorage.removeItem('friday.gemVoicePauseUntil'); })()")
        STATE["calls"] = [c for c in STATE["calls"] if c[0] not in ("gem-tts", "tts")]
        await pq.evaluate("window.__friday.voice.speak('Testing the Gemini voice.', window.__fridayProfile)"); await pq.wait_for_timeout(2500)
        gt = [c for c in STATE["calls"] if c[0] == "gem-tts"]; grt = [c for c in STATE["calls"] if c[0] == "tts"]
        ok("GV 30 Gemini voices, spoken with your Gemini key (not Groq's allowance)", gl["n"] == 30 and gl["key"] and gt and gt[0][1] == "Kore" and not grt, [gl, gt[:1], len(grt)])
        await pq.evaluate("(()=>{ const s = JSON.parse(localStorage.getItem('friday.settings')); s.voiceURI = ''; localStorage.setItem('friday.settings', JSON.stringify(s)); window.__friday.voice.setVoiceURI(''); })()")

        ok("Z no errors with the iPhone add-ons", not errq, errq[:6])

        await ctxq.close()

        # ---------- PL. 3.4 private line between Friday and Jarvis (both apps, end to end) ----------
        import urllib.parse as _up
        OTHER = BASE.replace("/build/", "/build-jarvis/") if PROFILE == "sky" else BASE.replace("/build-jarvis/", "/build/")
        osc = "Jarvis" if PROFILE == "sky" else "Friday"
        ctxA, pa, erra = await new_ctx(b, SEED_V1 % {"sc": sc})
        ctxB, pb, errb = await new_ctx(b, SEED_V1 % {"sc": osc})
        await pa.goto(BASE, wait_until="load"); await pb.goto(OTHER, wait_until="load")
        await pa.wait_for_timeout(2500); await pb.wait_for_timeout(800)
        for pgx in (pa, pb): await pgx.evaluate("document.getElementById('whatsnew').classList.add('hidden')")
        me_s, other_s = sc.lower(), osc.lower()
        partnerA = "Batsie" if PROFILE == "sky" else "Sky"
        partnerB = "Sky" if PROFILE == "sky" else "Batsie"
        async def deliver(src, dst, scheme):
            t = await src.evaluate("window.__fridayLastSms || ''")
            await src.evaluate("window.__fridayLastSms = ''")
            if t: await dst.evaluate("u => window.__fridayHandleLink(u)", scheme + "://msg?text=" + _up.quote(t))
            await dst.wait_for_timeout(2600)
            return t
        await pa.evaluate("document.getElementById('btn-settings').click()"); await pa.wait_for_timeout(300)
        await pa.evaluate("window.__fridaySettingsShow('accord-private')"); await pa.wait_for_timeout(300)
        btn0 = await pa.evaluate("document.getElementById('btn-private-pair').textContent")
        await pa.evaluate("document.getElementById('btn-private-pair').click()"); await pa.wait_for_timeout(800)
        k1 = await deliver(pa, pb, other_s)
        k2 = await deliver(pb, pa, me_s)
        sa = await pa.evaluate("FridayPrivate.status()"); sb = await pb.evaluate("FridayPrivate.status()")
        ok("PL pair by text: keys swap both ways and both phones show the same 4 safety words", btn0 == "Pair with " + osc and "🔑" in k1 and (other_s + "://pl?d=k.") in k1 and (me_s + "://pl?d=k.") in k2 and sa["paired"] and sb["paired"] and len(sa["words"]) == 4 and sa["words"] == sb["words"], [btn0, k1[:70], k2[:70], sa["words"], sb["words"]])
        await pa.evaluate("window.__fridaySettingsShow('accord-private')"); await pa.wait_for_timeout(400)
        wui = await pa.evaluate("({w: [...document.querySelectorAll('#private-words span')].map(x=>x.textContent), v: !document.getElementById('btn-private-verify').hidden, cur: document.getElementById('private-current').textContent})")
        await pa.screenshot(path=OUT + "PL1-words.png")
        ok("PL Settings shows the safety words and The words match", wui["w"] == sa["words"] and wui["v"] and "check the words" in wui["cur"], wui)
        await close_panels(pa)
        cap = await say(pa, "tell " + partnerA + " privately the code is zebra pineapple 42", 2500)
        ok("PL nothing is sent until the safety words are checked", "safety words" in cap and not await pa.evaluate("window.__fridayLastSms || ''"), cap)
        await pa.evaluate("document.getElementById('btn-settings').click()"); await pa.wait_for_timeout(300)
        await pa.evaluate("window.__fridaySettingsShow('accord-private')"); await pa.wait_for_timeout(300)
        await pa.evaluate("document.getElementById('btn-private-verify').click()"); await pa.wait_for_timeout(400)
        await pb.evaluate("FridayPrivate.verify(true)")
        await close_panels(pa)
        hist_a = await pa.evaluate("localStorage.getItem('friday.history')")
        calls0 = len([c for c in STATE["calls"] if c[0] in ("chat", "tts", "tts-voice", "transcribe", "websearch")])
        await pa.evaluate("document.getElementById('caption-line').textContent = ''")
        cap = await say(pa, "tell " + partnerA + " privately the code is zebra pineapple 42", 3000)
        m1 = await pa.evaluate("window.__fridayLastSms || ''")
        ok("PL private message: the text in Messages is scrambled with a link to the other app", "🔒" in m1 and (other_s + "://pl?d=m.") in m1 and "zebra" not in m1.lower() and "pineapple" not in m1.lower() and "Tap Send" in cap, [cap, m1[:100]])
        k = await deliver(pa, pb, other_s)
        calls1 = len([c for c in STATE["calls"] if c[0] in ("chat", "tts", "tts-voice", "transcribe", "websearch")])
        rb = await pb.evaluate("""(async()=>({ inbox: (await FridayPrivate.inbox()).map(x=>x.dir+':'+x.text), cap: document.getElementById('caption-line').textContent,
            panel: document.getElementById('panel-private').classList.contains('open'), hist: (localStorage.getItem('friday.history')||'').indexOf('zebra') >= 0,
            plain: Object.keys(localStorage).filter(k => /zebra/i.test(localStorage.getItem(k) || '')) }))()""")
        await pb.screenshot(path=OUT + "PL2-received.png")
        ok("PL the other phone unlocks it, shows it in Private and reads it out", rb["inbox"] == ["in:The code is zebra pineapple 42"] and rb["panel"] and "Private message from " + partnerB in rb["cap"], rb)
        plain_a = await pa.evaluate("Object.keys(localStorage).filter(k => /zebra/i.test(localStorage.getItem(k) || ''))")
        ok("PL never reaches her AI brain, AI voice, chat or memory, and isn't saved in plain words on either phone", calls1 == calls0 and await pa.evaluate("localStorage.getItem('friday.history')") == hist_a and not rb["hist"] and not rb["plain"] and not plain_a, [calls0, calls1, plain_a, rb["plain"]])
        cap = await say(pb, "reply privately see you at seven", 3000)
        await deliver(pb, pa, me_s)
        ia = await pa.evaluate("FridayPrivate.inbox().then(l => l.map(x => x.dir + ':' + x.text))")
        ok("PL replies come back the same way", ia[-2:] == ["out:The code is zebra pineapple 42", "in:See you at seven"], ia)
        m2 = await pb.evaluate("FridayPrivate.seal('x').then(r => r.payload)")
        before = await pa.evaluate("FridayPrivate.inbox().then(l => l.length)")
        await pa.evaluate("u => window.__fridayHandleLink(u)", me_s + "://pl?d=" + m2); await pa.wait_for_timeout(1500)
        await pa.evaluate("u => window.__fridayHandleLink(u)", me_s + "://pl?d=" + m2); await pa.wait_for_timeout(1500)
        after = await pa.evaluate("FridayPrivate.inbox().then(l => l.length)")
        bad = m2[:-6] + ("A" if m2[-6] != "A" else "B") + m2[-5:]
        await pa.evaluate("u => window.__fridayHandleLink(u)", me_s + "://pl?d=" + bad); await pa.wait_for_timeout(1500)
        capbad = await pa.evaluate("document.getElementById('caption-line').textContent")
        ok("PL the same message twice is shown once, and a changed message is refused", after == before + 1 and "couldn't unlock" in capbad, [before, after, capbad])
        cap1 = await say(pa, "send " + partnerA + " a private message", 2200)
        cap2 = await say(pa, "dinner at 7", 2800)
        m3 = await pa.evaluate("window.__fridayLastSms || ''")
        ok("PL 'send Batsie a private message' asks for it, then sends what you say next", "What's the private message" in cap1 and "Tap Send" in cap2 and "pl?d=m." in m3, [cap1, cap2])
        await pa.evaluate("window.__fridayLastSms = ''")
        await pa.evaluate("document.getElementById('tb-type').click()")
        await pa.fill("#tb-input", "tell " + partnerA + " privately quiet words 77")
        await pa.evaluate("document.getElementById('tb-form').dispatchEvent(new Event('submit', {cancelable:true}))")
        await pa.wait_for_timeout(500)
        thr = await pa.evaluate("document.getElementById('type-thread').textContent")
        await pa.wait_for_timeout(2500)
        thr2 = await pa.evaluate("document.getElementById('type-thread').textContent")
        ok("PL typed private messages don't show in the typing thread", "quiet words" not in thr and "quiet words" not in thr2.lower(), [thr[-80:], thr2[-80:]])
        await pa.evaluate("window.__friday.exitTyping()")
        pv = await pa.evaluate("(()=>{ const V = window.__friday.voice; const v = V.privateVoice(window.__fridayProfile); return {name: v && v.name, ai: !!(v && /^ai:/.test(v.voiceURI || ''))}; })()")
        nv = await pa.evaluate("window.__friday.voice.listVoices().length")
        ok("PL private messages use an iPhone voice, never the AI voice", (pv["name"] or nv == 0) and not pv["ai"], [pv, nv])
        cap = await say(pa, "read my private messages", 1800)
        ok("PL 'read my private messages' opens them", await pa.evaluate("document.getElementById('panel-private').classList.contains('open')"), cap)
        await pa.screenshot(path=OUT + "PL3-inbox.png")
        await close_panels(pa)
        await pa.evaluate("document.getElementById('btn-settings').click()"); await pa.wait_for_timeout(300)
        await pa.evaluate("window.__fridaySettingsShow('accord-private')"); await pa.wait_for_timeout(300)
        await pa.evaluate("window.confirm = () => true; document.getElementById('btn-private-unpair').click()"); await pa.wait_for_timeout(600)
        su = await pa.evaluate("FridayPrivate.status()")
        ok("PL Unpair removes the keys", not su["paired"] and not su["haveKey"], su)
        ok("PL no errors on either phone", not erra and not errb, (erra + errb)[:6])
        await ctxA.close(); await ctxB.close()

        # ---------- M. every look, HD and Original (fresh page, no competing animation loop) ----------
        mp = await ctx.new_page()
        src = BASE.replace("file://", "").rsplit("/", 1)[0]
        prefix = "../" if "friday-batsie" in src or "friday-sky" in src else ""
        html = open(os.path.join(HERE, 'looks-check.html')).read().replace('SRC/config.js', src + '/config.js').replace('SRC/orb.js', src + '/js/orb.js')
        open('/tmp/lc-full.html', 'w').write(html)
        for mode in ["hd", "original", "switch"]:
            await mp.goto("file:///tmp/lc-full.html?mode=" + mode, wait_until="commit", timeout=0)
            await mp.wait_for_function("window.done===true", timeout=400000)
            res = json.loads(await mp.title())
            ok(f"M all {res['n']} looks draw ({mode})", not res["bad"], res["bad"])
        await mp.close()
        await pg.evaluate("window.__friday.orb.setRender('hd'); window.__friday.applyLook('X2', true)")
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path=OUT + "M-home.png")
        ok("Z no errors during the upgrade session", not errs, errs[:6])
        await ctx.close()

        # ---------- I + J. timers while away, auto briefing ----------
        seed2 = """if(!localStorage.getItem('__s2')){localStorage.setItem('__s2','1');localStorage.setItem('friday.apiKey','gsk_x');localStorage.setItem('friday.seenVersion','"3.0"');
          localStorage.setItem('friday.timers', JSON.stringify([{id:'t1',name:'Pizza',end:Date.now()-60000,total:600},{id:'t2',name:'Tea',end:Date.now()+300000,total:300}]));
          localStorage.setItem('friday.bills', JSON.stringify([{id:'b1',name:'Phone',amount:85,day:new Date().getDate()+1>28?1:new Date().getDate()+1,repeat:'monthly',paid:[]}]));}"""
        ctx, pg, errs = await new_ctx(b, seed2)
        await pg.goto(BASE, wait_until="load")
        await pg.wait_for_timeout(9000)
        toast_log = await pg.evaluate("document.getElementById('toast').textContent + ' || ' + document.getElementById('caption-line').textContent")
        tl = await pg.evaluate("JSON.parse(localStorage.getItem('friday.timers')).map(t=>t.name).join(',')")
        ok("I timer that finished while closed is announced and cleared", "Pizza" not in tl and "Tea" in tl, (tl, toast_log))
        hour = await pg.evaluate("new Date().getHours()")
        if 5 <= hour < 11:
            ok("J morning briefing plays on first open (with bills and headlines)", "Good morning" in toast_log or "briefing" in toast_log.lower() or "Phone" in toast_log, toast_log)
        ok("Z no errors on reopen", not errs, errs[:6])
        await ctx.close()

        # ---------- N. fresh install ----------
        ctx, pg, errs = await new_ctx(b, None)
        await pg.goto(BASE, wait_until="load"); await pg.wait_for_timeout(1500)
        setup = await pg.evaluate("document.getElementById('setup').classList.contains('open')")
        ok("N fresh install asks for the Groq key", setup)
        await pg.fill("#setup-key", "gsk_new_key_123")
        await pg.evaluate("document.getElementById('setup-form').dispatchEvent(new Event('submit',{cancelable:true}))")
        await pg.wait_for_timeout(500)
        setup2 = await pg.evaluate("document.getElementById('setup').classList.contains('open')")
        ok("N key saves and the setup closes", not setup2)
        cap = await say(pg, "add bread to my grocery list", 2000)
        ok("N fresh install lists work", "Added bread" in cap, cap)
        ok("Z no errors on fresh install", not errs, errs[:6])
        await ctx.close()
        await b.close()

    passed = sum(1 for r in RESULTS if r[1])
    print(f"\n=== {PROFILE.upper()}: {passed}/{len(RESULTS)} passed ===")
    for name, good, detail in RESULTS:
        if not good: print("FAIL", name, "→", detail)
    print("\nAll checks:")
    for name, good, detail in RESULTS:
        print(("  ok  " if good else "  XX  ") + name)

asyncio.run(main())
