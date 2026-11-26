# 4.0: central intelligence router, research, memory types, and her written name.
import os, json, asyncio
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "full.py")).read()
exec(src[:src.index("\nasync def main():")])
W_BLOCK = src[src.index("        # ---------- W. internet ----------"):src.index("        # ---------- X. efficiency upgrades ----------")]
BASE = BASE_SKY
RES = []
def chk(n, g, d=""): RES.append((n, bool(g), d))

RSS = """<?xml version="1.0"?><rss><channel>
<item><title>Harbor Bridge closed for repairs - Reuters</title><link>https://news.google.com/rss/articles/a1</link><pubDate>Mon, 23 Nov 2026 10:00:00 GMT</pubDate><source url="https://www.reuters.com">Reuters</source></item>
<item><title>Bridge reopening delayed - Riverton Ledger</title><link>https://news.google.com/rss/articles/a2</link><pubDate>Tue, 24 Nov 2026 10:00:00 GMT</pubDate><source url="https://rivertonledger.com">Riverton Ledger</source></item>
</channel></rss>"""

BRIDGE_FINDINGS = {"findings": [
    {"claim": "The Harbor Bridge closed on March 3 after inspectors found cracked welds.", "sources": [{"title": "Reuters", "url": "https://www.reuters.com/bridge"}, {"title": "AP", "url": "https://apnews.com/bridge"}]},
    {"claim": "Repairs are expected to take about eight months.", "sources": [{"title": "Riverton Ledger", "url": "https://rivertonledger.com/bridge"}]},
    {"claim": "Repairs will take two months.", "sources": [{"title": "r/riverton", "url": "https://www.reddit.com/r/riverton/x"}]},
    {"claim": "The bridge carries about 40,000 cars a day.", "sources": [{"title": "Riverton Ledger", "url": "https://rivertonledger.com/traffic"}]}]}
BRIDGE_SYNTH = {"points": [
    {"text": "The Harbor Bridge closed on March 3 after cracked welds were found.", "evidence": [1, 5, 7], "status": "verified"},
    {"text": "Repairs are expected to take about eight months.", "evidence": [2], "status": "likely"},
    {"text": "The bridge carries about 40,000 cars a day.", "evidence": [4], "status": "verified"},
    {"text": "Locals say it will reopen in a week.", "evidence": [6], "status": "verified"},
    {"text": "Ghost point with no real evidence.", "evidence": [99], "status": "verified"}],
    "conflicts": [{"about": "how long repairs will take", "claims": [{"text": "About eight months", "evidence": [2]}, {"text": "About two months", "evidence": [3]}]}],
    "gaps": "No official reopening date."}

async def extra_routes(pg):
    async def ddg(r):
        if "harbor" not in r.request.url.lower(): return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body="{}")
        await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"AbstractText": "The Harbor Bridge is a bridge in Riverton.", "AbstractURL": "https://en.wikipedia.org/wiki/Harbor_Bridge", "AbstractSource": "Wikipedia", "Answer": ""}))
    async def news(r):
        if STATE.get("research") == "down": return await r.fulfill(status=500, headers=CORS, body="")
        await r.fulfill(status=200, headers={**CORS, "content-type": "application/rss+xml"}, body=RSS)
    async def gen(r):
        body = r.request.post_data or ""
        if "google_search" not in body: return await r.fallback()
        if STATE.get("research") == "down": return await r.fulfill(status=503, headers=CORS, body='{"error":{"message":"unavailable"}}')
        STATE["calls"].append(("grounded",))
        gm = {"groundingChunks": [{"web": {"uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", "title": "apnews.com"}}, {"web": {"uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/def", "title": "reddit.com"}}],
              "groundingSupports": [{"segment": {"text": "The Harbor Bridge closed on March 3."}, "groundingChunkIndices": [0]}, {"segment": {"text": "Locals say it will reopen in a week."}, "groundingChunkIndices": [1]}]}
        await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"candidates": [{"content": {"parts": [{"text": "It closed on March 3."}]}, "groundingMetadata": gm}]}))
    async def chatc(r):
        body = json.loads(r.request.post_data or "{}")
        d = json.dumps(body.get("messages") or [])
        if body.get("tools") and "research assistant" in d and ("Harbor" in d or "harbor" in d):
            if STATE.get("research") == "down": return await r.fulfill(status=503, headers=CORS, body='{"error":{"message":"tool unavailable"}}')
            STATE["calls"].append(("websearch", "harbor"))
            msg = {"content": json.dumps(BRIDGE_FINDINGS), "executed_tools": [{"type": "search", "search_results": {"results": [{"title": "Reuters", "url": "https://www.reuters.com/bridge", "content": ""}]}}]}
            return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"model": body.get("model"), "choices": [{"message": msg}]}))
        if "You weigh research evidence" in d and "Harbor" in d:
            return await r.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body=json.dumps({"model": body.get("model"), "choices": [{"message": {"content": json.dumps(BRIDGE_SYNTH)}}]}))
        if STATE.get("limits") is not None and "api.groq.com" in r.request.url and not body.get("stream") and not body.get("tools"):
            hd = {**CORS, "content-type": "application/json", "x-ratelimit-limit-requests": "1000", "x-ratelimit-remaining-requests": str(STATE["limits"]), "access-control-expose-headers": "x-ratelimit-limit-requests, x-ratelimit-remaining-requests"}
            return await r.fulfill(status=200, headers=hd, body=json.dumps({"model": body.get("model"), "choices": [{"message": {"content": "[]"}}]}))
        return await r.fallback()
    async def pages(r):
        u = r.request.url
        if "rivertonledger.com/traffic" in u:
            return await r.fulfill(status=200, headers={**CORS, "content-type": "text/html"}, body="<html><body><p>Traffic: the Harbor Bridge carries about 40,000 cars a day.</p></body></html>")
        if "rivertonledger.com/bridge" in u:
            return await r.fulfill(status=200, headers={**CORS, "content-type": "text/html"}, body="<html><body><p>Weather: sunny all weekend in Riverton.</p></body></html>")
        if "apnews.com/bridge" in u:
            return await r.fulfill(status=404, headers=CORS, body="not found")
        return await r.fallback()
    await pg.route("**/rivertonledger.com/**", pages)
    await pg.route("**/apnews.com/**", pages)
    await pg.route("**/api.duckduckgo.com/**", ddg)
    await pg.route("**/news.google.com/rss/**", news)
    await pg.route("**/*:generateContent*", gen)
    await pg.route("**/chat/completions", chatc)

async def open_app(b, sc="Friday", base=BASE):
    ctx, pg, err = await new_ctx(b, SEED_V1 % {"sc": sc})
    await extra_routes(pg)
    await pg.goto(base, wait_until="load"); await pg.wait_for_timeout(2500)
    await pg.evaluate("document.getElementById('whatsnew').classList.add('hidden')")
    return ctx, pg, err

SETUP_CONNS = r"""() => {
  const S = window.FridayStorage;
  S.set('connections', [
    {id:'g1', name:'Gemini', type:'agent', provider:'gemini', style:'gemini', baseUrl:'https://generativelanguage.googleapis.com/v1beta', model:'gemini-flash-latest', kind:'chat', backup:true},
    {id:'o1', name:'OpenRouter', type:'agent', provider:'openrouter', style:'openai', baseUrl:'https://openrouter.ai/api/v1', model:'openai/gpt-oss-20b:free', kind:'chat', backup:true},
    {id:'c2', name:'Claude', type:'agent', provider:'anthropic', style:'anthropic', baseUrl:'https://api.anthropic.com/v1', model:'claude-haiku-5-5', kind:'chat', backup:true}]);
  S.setAgentKey('g1', 'AIzaFAKEKEY_1234567890abcdefghij'); S.setAgentKey('o1', 'sk-or-fake'); S.setAgentKey('c2', 'sk-ant-fake');
}"""

ROUTER = r"""async () => {
  const B = window.FridayBrain, S = window.FridayStorage, out = {};
  const U = (t) => [{role: 'user', content: t}];
  out.tasks = { chat: B.classifyTask(U('hey how was your day'), {}), code: B.classifyTask(U('fix this javascript function'), {}),
    think: B.classifyTask(U('explain why the sky is blue step by step'), {}), quick: B.classifyTask(U('x'), {purpose: 'small'}),
    vision: B.classifyTask(U('x'), {purpose: 'vision'}), web: B.classifyTask(U('x'), {tools: [{type: 'browser_search'}]}), explicit: B.classifyTask(U('x'), {task: 'reflection'}) };
  const names = (p) => p.order.map(r => r.name);
  out.chat = names(B.plan(U('hey'), {task: 'chat'}));
  out.reasoning = names(B.plan(U('x'), {task: 'reasoning'}));
  out.coding = names(B.plan(U('x'), {task: 'coding'}));
  out.vision = B.plan(U('x'), {task: 'vision'}).all.map(r => r.name + '|' + r.caps.vision);
  out.web = B.plan(U('x'), {task: 'web'}).all.map(r => r.name);
  out.reflection = B.plan(U('x'), {task: 'reflection'}).all.map(r => r.name);
  out.chatAll = B.plan(U('hey'), {task: 'chat'}).all.map(r => r.name);
  const top = B.plan(U('hey'), {task: 'chat'}).order[0];
  out.topBefore = top.name;
  S.set('brain.usage', {date: new Date().toDateString(), counts: {[top.id]: 990}});
  out.topAfterQuota = B.plan(U('hey'), {task: 'chat'}).order[0].name;
  out.topLeft = B.routeReport().find(r => r.id === top.id).left;
  localStorage.removeItem('friday.brain.usage');
  out.explain = B.explain().map(x => x.task + ':' + (x.order[0] || {}).name);
  // a new brain added in Settings joins the router with its strengths, no code change
  const c = S.get('connections'); c.push({id:'d9', name:'DeepSeek', type:'agent', provider:'deepseek', style:'openai', baseUrl:'https://api.deepseek.com/v1', model:'deepseek-chat', kind:'chat', backup:true});
  S.set('connections', c); S.setAgentKey('d9', 'sk-fake-deepseek');
  const d = B.routeReport().find(r => r.id === 'agent:d9');
  out.newRoute = d ? {code: d.caps.code, free: d.free} : null;
  out.codingWithDeepseek = names(B.plan(U('x'), {task: 'coding'})).slice(0, 4);
  out.bgNoPaid = B.plan(U('x'), {task: 'summary'}).all.map(r => r.name);
  S.set('connections', c.filter(x => x.id !== 'd9'));
  return out;
}"""

BGQUOTA = r"""async () => {
  const B = window.FridayBrain, S = window.FridayStorage, U = (t) => [{role: 'user', content: t}];
  const counts = {}; B.routeReport().forEach(r => { if (r.limit) counts[r.id] = Math.ceil(r.limit * 0.8); });
  S.set('brain.usage', {date: new Date().toDateString(), counts: counts});
  const bgOrder = B.plan(U('x'), {task: 'summary'}).order.length;
  let kind = null; try { await B.askDetailed(U('x'), {task: 'reflection'}); } catch (e) { kind = e.kind; }
  const fgOrder = B.plan(U('hey'), {task: 'chat'}).order.length;
  counts['groq:openai/gpt-oss-20b'] = 10; S.set('brain.usage', {date: new Date().toDateString(), counts: counts});
  const onlyFresh = B.plan(U('x'), {task: 'summary'}).order.map(r => r.id);
  localStorage.removeItem('friday.brain.usage');
  return { bgOrder: bgOrder, kind: kind, fgOrder: fgOrder, onlyFresh: onlyFresh };
}"""

FALLBACK = r"""async () => {
  const B = window.FridayBrain;
  const r = await B.askDetailed([{role: 'user', content: 'hello there'}], {task: 'chat'});
  await new Promise(x => setTimeout(x, 700));
  const h = JSON.parse(localStorage.getItem('friday.brain.health') || '{}');
  const groqFails = Object.keys(h).filter(k => k.indexOf('groq:') === 0).reduce((a, k) => a + (h[k].fail || 0), 0);
  return { route: r.route && r.route.name, text: r.text, task: r.task, groqFails: groqFails, busy: B.status().busy.filter(x => x.indexOf('groq:') === 0).length };
}"""

AUTH = r"""async () => {
  const B = window.FridayBrain, S = window.FridayStorage;
  S.setApiKey('gsk_BADKEY_1234567890abcdef');
  const r = await B.askDetailed([{role: 'user', content: 'hello again'}], {task: 'chat'});
  const busy = B.status().busy.filter(x => x.indexOf('groq:') === 0).length;
  S.setApiKey('gsk_test_key_1234567890');
  return { route: r.route && r.route.name, groqResting: busy };
}"""

CAPTURE = r"""() => { window.__bodies = []; const of = window.fetch; window.fetch = function (u, init) {
  try { if (/chat\/completions|generateContent/.test(String(u)) && init && init.body) window.__bodies.push({u: String(u), b: JSON.parse(init.body)}); } catch (e) {}
  return of.apply(this, arguments); }; }"""

PERSONA_ASK = r"""async () => { const C = window.__friday.chat; const r = await C.ask('tell me something fun about space'); return r.text; }"""
PERSONA_CMP = r"""() => {
  const g = window.__bodies.filter(x => /api\.groq\.com/.test(x.u) && x.b.messages && x.b.messages[0] && /You are Friday/.test(x.b.messages[0].content)).slice(-1)[0];
  const m = window.__bodies.filter(x => /generateContent/.test(x.u) && x.b.systemInstruction && /You are Friday/.test(JSON.stringify(x.b.systemInstruction))).slice(-1)[0];
  const gs = g ? g.b.messages[0].content : '', ms = m ? m.b.systemInstruction.parts.map(p => p.text).join('\n\n') : '';
  const cut = (t) => t.split('\nKeep answers concise')[0];
  return { haveBoth: !!(g && m), same: !!(g && m) && cut(gs) === cut(ms).slice(0, cut(gs).length), groqHead: gs.slice(0, 160), hasMem: /Facts about Sky/.test(gs) && /Facts about Sky/.test(ms), hasSelf: /Who you are \(your foundation/.test(gs) && /Who you are \(your foundation/.test(ms) };
}"""

PERSIST = r"""() => { const h = JSON.parse(localStorage.getItem('friday.brain.health') || '{}'); const rep = window.FridayBrain.routeReport();
  return { stored: Object.keys(h).length, reportFails: rep.filter(r => r.fail > 0).length, usage: !!localStorage.getItem('friday.brain.usage') }; }"""

RESEARCH = r"""async () => {
  const R = window.FridayResearch;
  const r = await R.research('is the harbor bridge closed today');
  const lc = (part) => (r.linkChecks.find(x => x.url.indexOf(part) >= 0) || {});
  const st = (t) => (r.points.find(p => p.text.indexOf(t) >= 0) || {}).status;
  return { ok: r.ok, used: r.used, statuses: { closed: st('closed on March 3'), repairs: st('eight months'), cars: st('40,000'), locals: st('reopen in a week'), ghost: st('Ghost') },
    conflicts: r.conflicts.map(c => c.about + ':' + c.claims.length), gaps: r.gaps,
    sources: r.sources.map(s => s.domain + '|' + s.tier + '|' + (s.verified ? 'v' : '-')), brief: r.brief,
    kind: r.kind, judgeReddit: R.judge([R.makeSource('x', 'https://www.reddit.com/r/a', 'w')], 'verified'),
    judgeTwo: R.judge([R.makeSource('a', 'https://www.cnn.com/a', 'w'), R.makeSource('b', 'https://www.nbcnews.com/b', 'w')]),
    judgeOneHigh: R.judge([R.makeSource('a', 'https://www.cdc.gov/a', 'w')]), groundDomain: (r.sources.find(s => s.domain === 'apnews.com') || {}).via,
    lcReuters: lc('reuters.com/bridge'), lcTraffic: lc('rivertonledger.com/traffic'), lcLedger: lc('rivertonledger.com/bridge'), lcAp: lc('apnews.com/bridge'),
    judgeUnconfirmed: R.judge([Object.assign(R.makeSource('a', 'https://www.cdc.gov/x', 'w', '', null, 'model'), {confirmed: false})]),
    judgeConfirmed: R.judge([Object.assign(R.makeSource('a', 'https://www.cdc.gov/x', 'w', '', null, 'model'), {confirmed: 'page'})]) };
}"""

KC_ADD = r"""
(function(){
  var K = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FridayKit;
  if (!K) return;
  function db(){ try { return JSON.parse(localStorage.getItem('__kc') || '{}'); } catch (e) { return {}; } }
  function save(d){ localStorage.setItem('__kc', JSON.stringify(d)); }
  K.secretGet = async function (o) { var d = db(); return { value: d[o.key] != null ? d[o.key] : null }; };
  K.secretSet = async function (o) { if (window.__kcFail) throw new Error('keychain--34018'); var d = db(); d[o.key] = o.value; save(d); return { ok: true }; };
  K.secretDelete = async function (o) { var d = db(); delete d[o.key]; save(d); return { ok: true }; };
})();
"""
KC_STATE = r"""() => ({ ls: localStorage.getItem('friday.apiKey'), lsAgent: localStorage.getItem('friday.agentKey.a1'), kc: JSON.parse(localStorage.getItem('__kc') || '{}'),
  key: FridayStorage.getApiKey(), agent: FridayStorage.getAgentKey('a1'), store: FridayStorage.keyStore(), setupOpen: document.getElementById('setup').classList.contains('open') })"""

LIVE = r"""async () => {
  const B = window.FridayBrain, U = (t) => [{role: 'user', content: t}];
  const before = B.plan(U('x'), {task: 'quick'}).order[0];
  const r = await B.askDetailed(U('sort this'), {task: 'quick'});
  await new Promise(x => setTimeout(x, 600));
  const live = B.routeReport().find(x => x.live);
  const after = B.plan(U('x'), {task: 'quick'}).order[0];
  window.__friday.openPanel('settings'); document.querySelector('.smenu-item[data-page="brain"]').click(); document.getElementById('accord-brain').open = true;
  await new Promise(x => setTimeout(x, 500));
  return { answeredBy: r.route && r.route.id, before: before.id, live: live ? {id: live.id, remaining: live.live.remaining, limit: live.live.limit, left: live.left} : null, after: after.id,
    settings: document.getElementById('brain-status').textContent, stored: !!(JSON.parse(localStorage.getItem('friday.brain.health') || '{}')[r.route.id] || {}).live };
}"""

MEMORY = r"""async () => {
  const C = window.__friday.chat, M = window.FridayMemory, out = {};
  out.types = C.memory.map(m => m.text.slice(0, 22) + '|' + m.type);
  out.expired = (JSON.parse(localStorage.getItem('friday.memory.expired') || '[]')).map(m => m.text);
  out.stillHasBeach = C.memory.some(m => /beach/.test(m.text));
  await C.learn('my sister is named dana and I have a dentist thing, also friday should be meaner');
  out.learned = C.memory.filter(m => /Dana|dentist|meaner/.test(m.text)).map(m => m.text + '|' + m.type + '|' + (m.expiresAt ? Math.round((Date.parse(m.expiresAt) - Date.now()) / 86400000) : ''));
  C.addMemory('Sky has a meeting tomorrow');
  const mt = C.memory.find(m => /meeting tomorrow/.test(m.text));
  out.remembered = mt ? mt.type + '|' + Math.round((Date.parse(mt.expiresAt) - Date.now()) / 86400000) : null;
  out.block = M.promptBlock(C.memory, C.profile, "what's my sister's name");
  out.factsFirst = (out.block.split('Facts about Sky:\n')[1] || '').split('\n')[0];
  window.__friday.openPanel('memory'); await new Promise(r => setTimeout(r, 300));
  out.headers = [...document.querySelectorAll('#memory-list .sgroup-h')].map(e => e.textContent);
  out.summaryNote = (document.getElementById('memory-summary') || {}).textContent || '';
  return out;
}"""

NAME = r"""() => ({ caption: document.getElementById('caption-name').textContent, title: document.title,
  ph: (document.getElementById('tb-input') || document.getElementById('chat-input') || {}).placeholder,
  spoken: window.FridayVoice.speakable("I'm F.R.I.D.A.Y., and F. R. I. D. A. Y. too."),
  prompt: /Your name is written F\.R\.I\.D\.A\.Y\. and said "Friday"/.test(window.FridayGroq.personaPrompt(window.__friday.chat.profile, [], '')),
  shown: window.FRIDAY_CONFIG.shownName(), assistant: window.__friday.chat.profile.assistantName })"""

async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"])
        sc = "Friday"
        # ---- existing internet checks (W block from the full suite) ----
        ctx, pg, err = await open_app(b)
        exec_globals = dict(globals()); exec_globals.update({"pg": pg, "sc": sc})
        code = "async def _w():\n    pg = __pg\n" + "\n".join("    " + l[8:] if l.startswith("        ") else l for l in W_BLOCK.split("\n"))
        exec_globals["__pg"] = pg
        exec(code, exec_globals)
        await exec_globals["_w"]()
        await ctx.close()
        # ---- router ----
        STATE["mode"] = "ok"; STATE["websearch"] = "ok"
        ctx, pg, err1 = await open_app(b)
        await pg.evaluate(SETUP_CONNS)
        r = await pg.evaluate(ROUTER)
        chk("A1 task sorting: chat, code, reasoning, quick, vision, web, and an explicit task", r["tasks"] == {"chat": "chat", "code": "coding", "think": "reasoning", "quick": "quick", "vision": "vision", "web": "web", "explicit": "reflection"}, r["tasks"])
        chk("A2 conversation goes to a fast free brain first (Groq), with others behind it", r["chat"][0].startswith("Groq") and any(n in r["chatAll"] for n in ("Gemini", "OpenRouter")), r["chat"][:4])
        chk("A3 reasoning prefers the strongest thinkers (Groq gpt-oss-120b or Gemini) over the fast small model", r["reasoning"][0] in ("Groq gpt-oss-120b", "Gemini") and ("Groq llama-3.1-8b-instant" not in r["reasoning"] or r["reasoning"].index("Groq llama-3.1-8b-instant") > 2), r["reasoning"][:5])
        chk("A4 photos only go to brains that can see (Groq vision models, Gemini); never text-only ones", all(x.endswith("|true") for x in r["vision"]) and any(x.startswith("Gemini") for x in r["vision"]) and not any("llama-3.3" in x for x in r["vision"]), r["vision"])
        chk("A5 web search only goes to brains with the web tool", r["web"] and all("gpt-oss" in x for x in r["web"]), r["web"])
        chk("A6 background work (her reflections) never uses a paid brain", "Claude" not in r["reflection"] and "Claude" not in r["bgNoPaid"] and r["reflection"], [r["reflection"], r["bgNoPaid"]])
        chk("A7 quota awareness: a brain at 99% of its free day drops down the list", r["topAfterQuota"] != r["topBefore"] and r["topLeft"] <= 1, [r["topBefore"], r["topAfterQuota"], r["topLeft"]])
        chk("A8 adding a brain in Settings adds it to the router with its strengths (DeepSeek: strong at code, paid)", r["newRoute"] == {"code": 3, "free": False}, r["newRoute"])
        q = await pg.evaluate(BGQUOTA)
        chk("A14 background work waits when every free brain is under 30% left (never spends the last of it); your questions still get answered", q["bgOrder"] == 0 and q["kind"] == "deferred" and q["fgOrder"] > 0 and q["onlyFresh"] == ["groq:openai/gpt-oss-20b"], q)
        STATE["mode"] = "all429"
        f = await pg.evaluate(FALLBACK)
        chk("A9 automatic fallback: every Groq model at its limit → another provider answers", f["route"] in ("Gemini", "OpenRouter") and f["text"] and f["groqFails"] >= 1 and f["busy"] >= 1, f)
        STATE["mode"] = "ok"
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(2000)
        ps = await pg.evaluate(PERSIST)
        chk("A10 how each brain has been doing is remembered across app restarts", ps["stored"] >= 2 and ps["reportFails"] >= 1 and ps["usage"], ps)
        a = await pg.evaluate(AUTH)
        chk("A11 a rejected Groq key rests every Groq model and another brain answers", a["route"] in ("Gemini", "OpenRouter") and a["groqResting"] >= 3, a)
        await pg.evaluate("localStorage.removeItem('friday.brain.health'); localStorage.removeItem('friday.brain.usage')")   # fresh record, so Groq is first again
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(2000)
        await pg.evaluate("document.getElementById('whatsnew').classList.add('hidden')")
        await pg.evaluate(CAPTURE)
        t1 = await pg.evaluate(PERSONA_ASK)
        STATE["mode"] = "all429"
        t2 = await pg.evaluate(PERSONA_ASK)
        STATE["mode"] = "ok"
        pc = await pg.evaluate(PERSONA_CMP)
        chk("A12 same personality and memory whichever brain answers (Groq and Gemini got the same instructions)", pc["haveBoth"] and pc["same"] and pc["hasMem"] and pc["hasSelf"], pc)
        await pg.evaluate("window.__friday.openPanel('settings'); document.querySelector('.smenu-item[data-page=\"brain\"]').click(); document.getElementById('accord-brain').open = true;")
        await pg.wait_for_timeout(400)
        await pg.evaluate("window.__settingsSync && window.__settingsSync()")
        rtxt = await pg.evaluate("document.getElementById('brain-router').textContent")
        stxt = await pg.evaluate("document.getElementById('brain-status').textContent")
        chk("A13 Settings shows who she'd ask for each job and each brain's use today", "Conversation:" in rtxt and "Looking at photos:" in rtxt and "today" in stxt, [rtxt[:200], stxt[:160]])
        await ctx.close()
        # ---- research ----
        ctx, pg, err2 = await open_app(b)
        await pg.evaluate(SETUP_CONNS)
        rr = await pg.evaluate(RESEARCH)
        s = rr["statuses"]
        chk("B1 several sources checked at once (web search, Google Search via Gemini, Google News)", rr["ok"] and set(["Web search", "Google Search", "Google News"]).issubset(set(rr["used"])), rr["used"])
        chk("B2 verified only when two sites (one reliable) or one highly reliable site back it", s["closed"] == "verified" and rr["judgeTwo"] == "verified" and rr["judgeOneHigh"] == "verified", [s, rr["judgeTwo"], rr["judgeOneHigh"]])
        chk("B3 the AI can't overclaim: 'verified' from one unrated site becomes single-source; from Reddit only, uncertain", s["cars"] == "single" and s["locals"] == "uncertain" and rr["judgeReddit"] == "uncertain", s)
        chk("B4 disagreements are flagged: repair time is 'conflicting', with both sides kept", s["repairs"] == "conflicting" and rr["conflicts"] == ["how long repairs will take:2"], [s, rr["conflicts"]])
        chk("B5 a point that cites evidence that doesn't exist is dropped", s["ghost"] is None, s)
        chk("B6 every source is rated, Google's redirect links are named by their real site, verified ones are marked", any(x.startswith("reuters.com|high|v") for x in rr["sources"]) and any(x.startswith("apnews.com|high|v") for x in rr["sources"]) and any(x.startswith("reddit.com|low") for x in rr["sources"]) and not any("vertexaisearch" in x for x in rr["sources"]), rr["sources"])
        chk("B7 her brief separates verified, single-source, uncertain and disputed, and says not to read links", all(k in rr["brief"] for k in ("Verified", "From one reliable site only", "Uncertain", "Sources disagree", "Never read out links", "Couldn't confirm")), rr["brief"][:300])
        chk("C1 a link the AI wrote that's in Groq's own search results is trusted without opening it (Reuters)", rr["lcReuters"].get("confirmed") == "search", rr["lcReuters"])
        chk("C2 a link not in the results is opened: the page mentions the claim, so it's trusted (40,000 cars)", rr["lcTraffic"].get("confirmed") == "page", rr["lcTraffic"])
        chk("C3 links that don't check out don't count: a page that doesn't mention it, and one that won't open", rr["lcLedger"].get("confirmed") is False and "mention" in rr["lcLedger"].get("note", "") and rr["lcAp"].get("confirmed") is False and "open" in rr["lcAp"].get("note", ""), [rr["lcLedger"], rr["lcAp"]])
        chk("C4 even a highly reliable site can't verify a point until its link is confirmed", rr["judgeUnconfirmed"] == "uncertain" and rr["judgeConfirmed"] == "verified", [rr["judgeUnconfirmed"], rr["judgeConfirmed"]])
        STATE["calls"].clear()
        cap = await say(pg, "is the harbor bridge closed today", 9000)
        chips = await pg.evaluate("[...document.querySelectorAll('#srcs .src-chip')].map(b => b.textContent)")
        saved = await pg.evaluate("(window.__friday.chat.history.slice(-1)[0] || {}).sources || []")
        chk("B8 one answer in her voice, built from the research, with tappable sources (✓ verified) under it", "Reuters and the AP" in cap and any("✓ reuters.com" in c for c in chips) and len(saved) >= 3, [cap, chips, len(saved)])
        await pg.evaluate("window.__friday.openPanel('chat')"); await pg.wait_for_timeout(300)
        inchat = await pg.evaluate("document.querySelectorAll('#chat-thread .msg-srcs .src-chip').length")
        chk("B9 the sources stay with her answer in the chat", inchat >= 3, inchat)
        STATE["research"] = "down"; STATE["websearch"] = "fail"
        cap2 = await say(pg, "is the harbor bridge closed today", 9000)
        chk("B10 if no source can be reached she says so instead of guessing", "couldn't check" in cap2, cap2)
        STATE["research"] = "ok"; STATE["websearch"] = "ok"
        await ctx.close()
        # ---- Keychain ----
        fake_src = src[src.index('        FAKE = """') + len('        FAKE = '):]
        fake_src = fake_src[:fake_src.index('"""', 3) + 3]
        import ast
        FAKE_JS = ast.literal_eval(fake_src)
        ctxk = await b.new_context(viewport={"width": 393, "height": 852}, device_scale_factor=2, is_mobile=True, has_touch=True)
        await ctxk.add_init_script(SEED_V1 % {"sc": "Friday"})
        await ctxk.add_init_script(FAKE_JS + KC_ADD)
        pk = await ctxk.new_page(); errk = []
        pk.on("pageerror", lambda e: errk.append("PAGEERROR " + str(e)))
        await pk.route("**/*", route)
        await pk.goto(BASE, wait_until="load"); await pk.wait_for_timeout(2500)
        k1 = await pk.evaluate(KC_STATE)
        chk("K1 on the iPhone, the Groq key and connection keys move into the Keychain (and out of app storage)", k1["ls"] is None and k1["lsAgent"] is None and k1["kc"].get("ai.apiKey") == "gsk_test_key_1234567890" and k1["kc"].get("ai.agentKey.a1") == "sk-test-openai" and k1["key"] == "gsk_test_key_1234567890" and k1["store"] == "keychain", {**k1, "kc": list(k1["kc"].keys())})
        await pk.reload(wait_until="load"); await pk.wait_for_timeout(2500)
        k2 = await pk.evaluate(KC_STATE)
        ans = await pk.evaluate("async () => { try { return await window.FridayBrain.ask([{role:'user', content:'hello'}], {task:'chat'}); } catch (e) { return 'ERR ' + e.message; } }")
        chk("K2 after a restart her keys load from the Keychain: no setup screen, and her brain works", k2["key"] == "gsk_test_key_1234567890" and k2["ls"] is None and not k2["setupOpen"] and ans and not ans.startswith("ERR"), [k2["key"], k2["setupOpen"], ans[:60]])
        await pk.evaluate("FridayStorage.setApiKey('gsk_new_key_0987654321')"); await pk.wait_for_timeout(300)
        k3 = await pk.evaluate(KC_STATE)
        await pk.evaluate("window.__friday.openPanel('settings'); document.querySelector('.smenu-item[data-page=\"brain\"]').click();"); await pk.wait_for_timeout(400)
        mtxt = await pk.evaluate("(document.getElementById('key-mask') || {}).textContent || ''")
        chk("K3 a new key goes straight to the Keychain, and Settings says so", k3["kc"].get("ai.apiKey") == "gsk_new_key_0987654321" and k3["ls"] is None and "Keychain" in mtxt, [k3["ls"], mtxt])
        await pk.evaluate("FridayStorage.resetAll(false)"); await pk.wait_for_timeout(300)
        k4 = await pk.evaluate(KC_STATE)
        chk("K4 Reset on this phone clears the keys from the Keychain too", not any(k.startswith("ai.") for k in k4["kc"].keys()) and k4["key"] == "", list(k4["kc"].keys()))
        await ctxk.close()
        ctxf = await b.new_context(viewport={"width": 393, "height": 852}, device_scale_factor=2, is_mobile=True, has_touch=True)
        await ctxf.add_init_script(SEED_V1 % {"sc": "Friday"})
        await ctxf.add_init_script("window.__kcFail = true;" + FAKE_JS + KC_ADD)
        pf = await ctxf.new_page()
        await pf.route("**/*", route)
        await pf.goto(BASE, wait_until="load"); await pf.wait_for_timeout(2500)
        k5 = await pf.evaluate(KC_STATE)
        chk("K5 if the Keychain can't be written, the key stays where it was and keeps working (nothing is lost)", k5["ls"] == "gsk_test_key_1234567890" and k5["key"] == "gsk_test_key_1234567890" and not k5["setupOpen"], {**k5, "kc": list(k5["kc"].keys())})
        await ctxf.close()
        # ---- Groq's live count ----
        ctx, pg, errl = await open_app(b)
        await pg.evaluate(SETUP_CONNS)
        STATE["limits"] = 120
        lv = await pg.evaluate(LIVE)
        STATE["limits"] = None
        chk("L1 she reads Groq's real requests-left count from its reply and keeps it", lv["live"] and lv["live"]["remaining"] == 120 and lv["live"]["limit"] == 1000 and lv["live"]["left"] == 12 and lv["stored"], lv)
        chk("L2 the real count steers her: that brain (12% left) drops down for the next request, and Settings shows it", lv["after"] != lv["answeredBy"] and "left today (from Groq)" in lv["settings"], [lv["answeredBy"], lv["after"], lv["settings"][:160]])
        await ctx.close()
        err = err + errk + errl
        # ---- memory ----
        ctx, pg, err3 = await open_app(b)
        await pg.evaluate("""() => { const m = JSON.parse(localStorage.getItem('friday.memory')); m.push({text: 'Sky is at the beach today', at: new Date(Date.now() - 3*86400000).toISOString(), type: 'context', expiresAt: new Date(Date.now() - 86400000).toISOString()}); localStorage.setItem('friday.memory', JSON.stringify(m)); }""")
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(2200)
        await pg.evaluate("document.getElementById('whatsnew').classList.add('hidden')")
        m = await pg.evaluate(MEMORY)
        chk("M1 older memories get a type when she starts (coffee = preference, birthday and spare key = facts)", any(t.startswith("Sky likes black coffee") and t.endswith("|preference") for t in m["types"]) and any(t.startswith("Batsie's birthday") and t.endswith("|fact") for t in m["types"]) and any(t.startswith("The spare key") and t.endswith("|fact") for t in m["types"]), m["types"])
        chk("M2 temporary context that's over clears itself (moved to an expired list)", not m["stillHasBeach"] and any("beach" in x for x in m["expired"]), m["expired"])
        chk("M3 learning sorts what she picks up (sister = fact, dentist = temporary for 3 days) and never files 'Friday should be meaner'", any(x.startswith("Sky's sister is named Dana.|fact") for x in m["learned"]) and any("dentist" in x and "|context|3" in x for x in m["learned"]) and not any("meaner" in x for x in m["learned"]), m["learned"])
        chk("M4 'remember that … tomorrow' is filed as temporary (about 2 days)", m["remembered"] == "context|2", m["remembered"])
        chk("M5 every brain gets the same typed memory block, picked for what you're asking (sister first)", "Facts about Sky:" in m["block"] and "Sky's preferences:" in m["block"] and "Right now (temporary" in m["block"] and "Dana" in m["factsFirst"], m["block"][:300])
        chk("M6 the Memory panel is grouped by type, and points to where her personality conclusions live", any("Right now" in h for h in m["headers"]) and "Preferences" in m["headers"] and "Facts" in m["headers"] and "Her own personality" in m["summaryNote"], [m["headers"], m["summaryNote"][-90:]])
        # ---- her name ----
        n = await pg.evaluate(NAME)
        chk("N1 her name is written F.R.I.D.A.Y. (top of screen, title, text box) but she says 'Friday'", n["caption"] == "F.R.I.D.A.Y." and n["title"] == "F.R.I.D.A.Y." and "F.R.I.D.A.Y." in (n["ph"] or "") and n["spoken"] == "I'm Friday, and Friday too." and n["prompt"] and n["assistant"] == "Friday", n)
        await ctx.close()
        ctx, pg, err4 = await open_app(b, "Jarvis", BASE_REED)
        rn = await pg.evaluate("() => ({ shown: window.FRIDAY_CONFIG.shownName(), caption: document.getElementById('caption-name').textContent })")
        chk("N2 Reed keeps his name", rn["shown"] == "Reed" and rn["caption"] == "reed", rn)
        await ctx.close()
        await b.close()
    errs = err + err1 + err2 + err3 + err4
    chk("Z no page errors", not errs, errs[:6])

asyncio.run(main())
for name, good, detail in RESULTS:
    print(("  ok  " if good else "  XX  ") + name + ("" if good else "  -> " + str(detail)[:400]))
for n, g, d in RES: print(("  ok  " if g else "  XX  ") + n + ("" if g else "  -> " + json.dumps(d, default=str)[:600]))
print(sum(1 for x in RES if x[1]) + sum(1 for x in RESULTS if x[1]), "of", len(RES) + len(RESULTS))
