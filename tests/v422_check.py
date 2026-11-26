# 4.2.2: Google search through Gemini uses the models that have free Google Search, Groq's shut-down
# models are skipped, Diagnostics counts Groq's current models, and she knows she can search the web.
import os, json, asyncio
HERE = os.path.dirname(os.path.abspath(__file__))
__file__ = os.path.join(HERE, "v42_check.py")
src = open(__file__).read()
exec(src[:src.index("\nasync def main():")])
RES = []
def chk(n, g, d=""): RES.append((n, bool(g), d))

GEM = {"mode": {}, "calls": []}
GROQ_SEEN = []
GQ = {"down": False}
RETIRED = ["llama-3.3-70b-versatile", "qwen/qwen3-32b", "llama-3.1-8b-instant", "meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct"]

async def extra(pg):
    async def gem(r):
        u = r.request.url
        body = r.request.post_data or ""
        if "google_search" not in body: return await r.fallback()
        model = u.split("/models/")[1].split(":")[0]
        hdrs = r.request.headers
        GEM["calls"].append((model, "bearer" if hdrs.get("authorization") else "key"))
        m = GEM["mode"].get(model, GEM["mode"].get("*", "ok"))
        if m == "nofree": return await r.fulfill(status=429, headers=CORS, body=json.dumps({"error": {"code": 429, "message": "Grounding with Google Search is not available on the free tier for this model.", "status": "RESOURCE_EXHAUSTED"}}))
        if m == "auth": return await r.fulfill(status=403, headers=CORS, body=json.dumps({"error": {"code": 403, "message": "API key not valid.", "status": "PERMISSION_DENIED"}}))
        if m == "aq401" and not hdrs.get("authorization"): return await r.fulfill(status=401, headers=CORS, body=json.dumps({"error": {"code": 401, "message": "API keys are not supported by this API. Expected OAuth2 access token"}}))
        gm = {"groundingChunks": [{"web": {"uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/x1", "title": "apnews.com"}}],
              "groundingSupports": [{"segment": {"text": "The Lions won 31 to 17."}, "groundingChunkIndices": [0]}]}
        await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"candidates": [{"content": {"parts": [{"text": "The Lions won 31 to 17."}]}, "groundingMetadata": gm}]}))
    async def groq(r):
        try: body = json.loads(r.request.post_data or "{}")
        except Exception: body = {}
        mdl = body.get("model", "")
        GROQ_SEEN.append(mdl)
        if GQ["down"]:
            return await r.fulfill(status=503, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"error": {"message": "Service unavailable"}}))
        if mdl in RETIRED:
            return await r.fulfill(status=400, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"error": {"message": "The model `%s` has been decommissioned and is no longer supported." % mdl, "type": "invalid_request_error", "code": "model_decommissioned"}}))
        return await r.fallback()
    async def models(r):
        ids = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.6-27b", "qwen/qwen3.8-27b", "whisper-large-v3-turbo", "canopylabs/orpheus-v1-english"]
        await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"data": [{"id": i} for i in ids]}))
    await pg.route("**/*:generateContent*", gem)
    await pg.route("**/api.groq.com/openai/v1/chat/completions", groq)
    await pg.route("**/api.groq.com/openai/v1/models", models)

ADD_GEM = r"""(key) => {
  const c = JSON.parse(localStorage.getItem('friday.connections') || '[]').filter(x => x.id !== 'g1');
  c.push({id:'g1', name:'Gemini', type:'agent', provider:'gemini', style:'gemini', baseUrl:'https://generativelanguage.googleapis.com/v1beta', model:'gemini-flash-latest', kind:'chat', backup:true});
  FridayStorage.set('connections', c); FridayStorage.setAgentKey('g1', key);
}"""

async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"])
        err = []
        ctx, pg, e1 = await native_ctx(b, BASE_SKY)
        await extra(pg)
        await pg.evaluate(ADD_GEM, "AIza-test-gemini-key-123")
        await pg.wait_for_timeout(300)
        # 1. a key added with the default model (now Gemini 3): Google search goes to a model with free Google Search
        GEM["mode"] = {"gemini-flash-latest": "nofree"}; GEM["calls"].clear()
        g1 = await pg.evaluate("FridayBrain.groundedSearch('who won the lions game')")
        chk("G1 Google search uses Gemini 2.5 Flash (free Google Search) even when her Gemini model is the newer default", g1 and g1.get("via") == "Google Search" and g1.get("model") == "gemini-2.5-flash" and GEM["calls"][0][0] == "gemini-2.5-flash" and len(g1.get("chunks") or []) == 1, [g1, GEM["calls"]])
        # 2. 2.5 Flash out of free searches for today: Flash-Lite next, and she remembers what worked
        GEM["mode"] = {"gemini-2.5-flash": "nofree", "gemini-flash-latest": "nofree"}; GEM["calls"].clear()
        g2 = await pg.evaluate("FridayBrain.groundedSearch('who won the lions game')")
        GEM["calls"].clear()
        g2b = await pg.evaluate("FridayBrain.groundedSearch('another question')")
        chk("G2 if one model has no free searches left she moves to the next (Flash-Lite) and starts there next time", g2 and g2.get("model") == "gemini-2.5-flash-lite" and g2b and GEM["calls"] and GEM["calls"][0][0] == "gemini-2.5-flash-lite", [g2 and g2.get("model"), GEM["calls"]])
        # 3. none free: nothing breaks, she says she couldn't (returns null) and rests it a while
        GEM["mode"] = {"*": "nofree"}; GEM["calls"].clear()
        await pg.evaluate("FridayBrain.status && 0")
        g3 = await pg.evaluate("FridayBrain.groundedSearch('q3')")
        rep = await pg.evaluate("FridayBrain.routeReport().filter(r => /Google Search/.test(r.name)).map(r => r.name)")
        c3 = list(GEM["calls"])
        chk("G3 if no model has free Google Search, she tries each once, then skips Google for a while instead of failing every question", g3 is None and sorted(x[0] for x in c3) == ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"], [g3, c3])
        await ctx.close()
        # 4. a rejected key: stops at once (no point trying other models)
        ctx, pg, e2 = await native_ctx(b, BASE_SKY)
        await extra(pg)
        await pg.evaluate(ADD_GEM, "AIza-bad-key-000000000")
        GEM["mode"] = {"*": "auth"}; GEM["calls"].clear()
        g4 = await pg.evaluate("FridayBrain.groundedSearch('q4')")
        c4 = list(GEM["calls"])
        chk("G4 a rejected Gemini key stops after one try (no wasted requests)", g4 is None and len(c4) == 1, c4)
        await ctx.close()
        # 5. new-style AQ. key: tried the other way it can be sent, like her chat already does
        ctx, pg, e3 = await native_ctx(b, BASE_SKY)
        await extra(pg)
        await pg.evaluate(ADD_GEM, "AQ.Ab8RN6test-new-style-key-1234567890")
        GEM["mode"] = {"*": "aq401"}; GEM["calls"].clear()
        g5 = await pg.evaluate("FridayBrain.groundedSearch('q5')")
        c5 = list(GEM["calls"])
        chk("G5 a new-style Gemini key (AQ.) works for Google search too", g5 and g5.get("via") == "Google Search" and c5[:2] == [("gemini-2.5-flash", "key"), ("gemini-2.5-flash", "bearer")], c5)
        # 6. research shows Google as a source
        GEM["mode"] = {"*": "ok"}
        rr = await pg.evaluate("window.FridayResearch.research('who won the lions game last night').then(r => ({ ok: r.ok, used: r.used || [], sources: (r.sources || []).map(s => s.via + '|' + s.domain) }))")
        chk("G6 her web research now gets results from Google Search", rr["ok"] and "Google Search" in rr["used"], rr)
        err += e1 + e2 + e3
        await ctx.close()
        # 7. Groq models that were shut down are never asked; Diagnostics counts the current ones
        ctx, pg, e4 = await native_ctx(b, BASE_SKY)
        await extra(pg)
        GROQ_SEEN.clear()
        await pg.evaluate("FridayBrain.ask([{role:'user', content:'sort: groceries'}], {task:'quick', priority:'background'}).catch(e => 'ERR ' + e.message)")
        await pg.evaluate("FridayBrain.ask([{role:'user', content:'hello'}], {task:'chat'}).catch(e => 'ERR ' + e.message)")
        await pg.evaluate("window.__friday.chat.learn('my sister is named dana and she lives in ohio')")
        await pg.wait_for_timeout(500)
        mem = await pg.evaluate("window.__friday.chat.memory.map(m => m.text)")
        chk("R1 she never spends a request on Groq models that were shut down, and learning still saves memories", not any(m in RETIRED for m in GROQ_SEEN) and len(GROQ_SEEN) >= 2 and any("Dana" in m for m in mem), [GROQ_SEEN, mem[-3:]])
        plan = await pg.evaluate("FridayBrain.plan([{role:'user', content:'x'}], {task:'chat'}).order.map(r => r.id)")
        chk("R2 Groq's current replacement (Qwen 3.6 27B) is one of her brains", "groq:qwen/qwen3.6-27b" in plan and not any(("groq:" + m) in plan for m in RETIRED), plan)
        await pg.evaluate("() => { const a = document.getElementById('btn-diag-again'); window.__friday.openPanel('diag'); a && a.click(); }")
        await pg.wait_for_timeout(3500)
        dg = await pg.evaluate("document.getElementById('panel-diag').innerText")
        chk("R3 Diagnostics counts Groq's current chat models (3 of 3), not ones Groq shut down", "3 of 3 chat brains available" in dg, dg[:400])
        await pg.evaluate("document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open'))")
        # 7b. a backup brain whose free model was retired moves to another free model by itself
        OR = {"seen": []}
        async def orr(r):
            u = r.request.url
            if u.endswith("/models"):
                return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"data": [{"id": "openai/gpt-oss-120b:free"}, {"id": "google/gemma-4-31b-it:free"}, {"id": "anthropic/claude-paid"}]}))
            body = json.loads(r.request.post_data or "{}")
            OR["seen"].append(body.get("model"))
            if body.get("model") == "deepseek/deepseek-old:free":
                return await r.fulfill(status=404, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"error": {"message": "No endpoints found for deepseek/deepseek-old:free.", "code": 404}}))
            return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"model": body.get("model"), "choices": [{"message": {"role": "assistant", "content": "OpenRouter here."}}]}))
        await pg.route("**/openrouter.ai/api/v1/**", orr)
        await pg.evaluate("""() => { const c = JSON.parse(localStorage.getItem('friday.connections')); c.push({id:'or1', name:'OpenRouter', type:'agent', provider:'openrouter', style:'openai', baseUrl:'https://openrouter.ai/api/v1', model:'deepseek/deepseek-old:free', kind:'chat', backup:true});
          FridayStorage.set('connections', c); FridayStorage.setAgentKey('or1', 'sk-or-v1-test-key-1234567890'); }""")
        await pg.wait_for_timeout(300)
        GQ["down"] = True
        a1 = await pg.evaluate("FridayBrain.askDetailed([{role:'user', content:'hi'}], {task:'chat'}).then(r => r.route && r.route.id).catch(e => 'ERR ' + e.kind)")
        await pg.wait_for_timeout(1500)
        a2 = await pg.evaluate("FridayBrain.askDetailed([{role:'user', content:'hi again'}], {task:'chat'}).then(r => (r.route && r.route.id) + '|' + r.text).catch(e => 'ERR ' + e.kind)")
        GQ["down"] = False
        mdl = await pg.evaluate("(JSON.parse(localStorage.getItem('friday.connections')).find(c => c.id === 'or1') || {}).model")
        chk("R4 a backup brain whose free model was retired picks another free model by itself (same brain, same key) and answers with it", mdl == "openai/gpt-oss-120b:free" and str(a2).startswith("agent:or1|OpenRouter here"), [a1, a2, mdl])
        miss = await pg.evaluate("(FridayBrain.routeReport().find(x => x.id === 'agent:or1') || {}).missing")
        chk("R5 and it's usable again right away (not left marked as gone)", miss is False, miss)
        # 7c. the Brains page and Diagnostics never list models Groq shut down
        await pg.evaluate("() => { window.__friday.openPanel('settings'); document.querySelector('.smenu-item[data-page=\"brain\"]').click(); const a = document.getElementById('accord-brain'); if (a) a.open = true; }")
        await pg.wait_for_timeout(600)
        bs = await pg.evaluate("(document.getElementById('brain-status') || {}).textContent || ''")
        busy = await pg.evaluate("(FridayBrain.status().busy || []).join(', ')")
        chk("R6 the Brains page and Diagnostics never show models Groq shut down as 'resting' or 'not available'", not any(x in bs for x in ("llama", "maverick", "scout", "qwen3-32b")) and not any(x in busy for x in ("llama", "maverick", "scout", "qwen3-32b")), [bs[:300], busy])
        await pg.evaluate("document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open'))")
        # 8. she knows she can search
        pp = await pg.evaluate("window.FridayGroq.personaPrompt(window.__friday.chat.profile, [], '')")
        chk("W1 her instructions say she can look things up on the web (no 'I can't browse', no Shortcut for searches)", "You can look things up on the internet" in pp and "never offer the Shortcut for a web search" in pp, pp[-700:])
        await pg.evaluate("() => { const s = JSON.parse(localStorage.getItem('friday.settings')); s.webMode = 'off'; localStorage.setItem('friday.settings', JSON.stringify(s)); }")
        pp2 = await pg.evaluate("window.FridayGroq.personaPrompt(window.__friday.chat.profile, [], '')")
        chk("W2 with web search turned off in Settings, she says it's switched off there instead", "Web search is turned off in Settings" in pp2 and "You can look things up on the internet" not in pp2, "")
        err += e4
        await ctx.close()
        # Reed gets the same
        ctx, pg, e5 = await native_ctx(b, BASE_REED, "Jarvis")
        await extra(pg)
        await pg.evaluate(ADD_GEM, "AIza-test-gemini-key-123")
        GEM["mode"] = {"gemini-flash-latest": "nofree"}; GEM["calls"].clear()
        g7 = await pg.evaluate("FridayBrain.groundedSearch('who won')")
        pr = await pg.evaluate("window.FridayGroq.personaPrompt(window.__friday.chat.profile, [], '')")
        chk("W3 Reed gets the same: Google search works and he knows he can search", g7 and g7.get("model") == "gemini-2.5-flash" and "You can look things up on the internet" in pr, [g7 and g7.get("model")])
        err += e5
        await ctx.close()
        await b.close()
    real = [e for e in err if "favicon" not in e]
    chk("Z no page errors", not real, real[:6])
    for n, g, d in RES:
        print(("ok  " if g else "XX  ") + n + ("" if g else "   -> " + json.dumps(d, default=str)[:900]))
    print("%d/%d passed" % (sum(1 for r in RES if r[1]), len(RES)))

asyncio.run(main())
