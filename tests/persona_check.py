# 3.6.1: Friday manages her own development. Tests: evidence validation (owner-primary), trait evolution
# (step, rolling 30-day pace, band around the ACTIVE baseline), reconsideration (no automatic reversal),
# self-initiated identity reviews (not forced), baseline movement with original values kept, owner nudge,
# Reset as a new era with history kept, persistence across app restarts, quotas, honesty, Reed unchanged.
import os, json, asyncio
src = open(os.path.join(os.path.dirname(__file__), "full.py")).read()
exec(src[:src.index("async def main():")])

HELPERS = r"""
  const P = window.FridayPersona, C = window.__friday.chat;
  const S = (k) => JSON.parse(localStorage.getItem('friday.' + k) || 'null');
  const W = (k, v) => localStorage.setItem('friday.' + k, JSON.stringify(v));
  const say = (u, a) => { C.history.push({role:'user', content:u, at:new Date().toISOString()}); if (a) C.history.push({role:'assistant', content:a, at:new Date().toISOString()}); };
  const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();
  const R = (o) => P.reflect(C, {reply: JSON.stringify(Object.assign({meaningful: true, happened: 'x', learned: 'y'}, o))});
  const id = (trait, status) => P.ledger().filter(e => e.kind === 'change' && e.trait === trait && (!status || e.status === status)).slice(-1)[0];
"""

PART1 = "async () => {" + HELPERS + r"""
  const out = {};
  out.pr0 = window.FridayGroq.personaPrompt(C.profile, [], '');
  C.history = []; C.memory = [{text: 'Sky likes iced coffee', at: new Date().toISOString()}];
  // ---- A. evidence: what Sky said is primary; her own lines alone can't prove a trait ----
  say('you are too polite today, roast me a little', 'Your playlist sounds like a dentist waiting room.');
  say('ha that dentist line killed me', 'I keep delivering perfectly crisp sentences with impeccable timing.');
  say('the hallway light flickers like a disco ball', 'Disco ball it is.');
  say('we finished the stairs project this weekend', 'Took you long enough.');
  const a = await R({ mood: {label: 'quick and sharp'},
    observations: [{text: 'Calls the hallway light the disco ball', kind: 'humor', evidence: 'hallway light flickers like a disco ball'},
                   {text: 'Speaks in impeccably crisp sentences', kind: 'style', evidence: 'perfectly crisp sentences impeccable timing'}],
    trait_changes: [
      {trait: 'sarcasm', direction: 'up', amount: 0.8, reason: 'Sky asked to be roasted and loved it', evidence: 'roast me a little, dentist line killed me', context: 'dentist waiting room', confidence: 0.8, lasting: true},
      {trait: 'composure', direction: 'up', amount: 0.5, reason: 'my timing is great', evidence: 'perfectly crisp sentences impeccable timing', confidence: 0.9, lasting: true},
      {trait: 'patience', direction: 'down', amount: 0.3, reason: 'x', evidence: 'quantum spreadsheet volcano', confidence: 0.9, lasting: true},
      {trait: 'humor', direction: 'up', amount: 0.3, reason: 'maybe funnier', evidence: 'dentist line killed me', confidence: 0.3, lasting: true},
      {trait: 'warmth', direction: 'up', amount: 0.3, reason: 'nice day', evidence: 'finished the stairs project weekend', confidence: 0.9, lasting: false}],
    memories: [{text: 'Sky finished the stairs project this weekend', kind: 'episodic'}, {text: 'Sky likes iced coffee a lot', kind: 'semantic'}] });
  out.a = a; out.aL = P.ledger(); out.aObs = P.observations(); out.aMem = C.memory.map(m => m.text + '|' + (m.kind || '') + '|' + (m.from || ''));
  out.pr1 = window.FridayGroq.personaPrompt(C.profile, [], '');
  // ---- B. reconsideration: conflicting evidence prompts evaluation, nothing undone automatically ----
  const sarc = id('sarcasm');
  say('ok that was too harsh honestly, tone the roasting down', 'Fair.');
  const b1 = await R({ trait_changes: [{trait: 'sarcasm', direction: 'down', amount: 0.5, reason: 'Sky said too harsh', evidence: 'too harsh, tone the roasting down', confidence: 0.7, lasting: true}] });
  out.b1 = b1; out.b1e = P.ledger().find(e => e.id === sarc.id); out.b1v = P.state().traits.sarcasm.v;
  out.b1reverted = P.ledger().filter(e => e.status === 'reverted').length;
  say('the dentist joke still makes me laugh though, keep some bite', 'Noted.');
  let seen = null; const real = window.FridayBrain.ask;
  window.FridayBrain.ask = async (msgs) => { seen = msgs[0].content; return JSON.stringify({meaningful: true, happened: 'x', learned: 'y',
    reconsiderations: [{change_id: sarc.id, decision: 'keep', reason: 'Sky still enjoys some bite', evidence: 'dentist joke still makes me laugh, keep some bite'}]}); };
  out.b2 = await P.reflect(C); window.FridayBrain.ask = real;
  out.b2seen = (seen || '').indexOf(sarc.id) >= 0 && (seen || '').indexOf('reconsidering') >= 0 && (seen || '').indexOf('conflicting evidence') >= 0;
  out.b2e = P.ledger().find(e => e.id === sarc.id); out.b2v = P.state().traits.sarcasm.v;
  out.b2rec = P.ledger().filter(e => e.kind === 'reconsider').map(e => e.decision);
  say('just tell me straight next time', 'Will do.');
  await R({ trait_changes: [{trait: 'directness', direction: 'up', amount: 0.5, reason: 'Sky wants straight answers', evidence: 'tell me straight next time', confidence: 0.8, lasting: true}] });
  const dir = id('directness');
  say('that was blunt, I was upset and you were way too blunt', 'Sorry.');
  await R({ trait_changes: [{trait: 'directness', direction: 'down', amount: 0.5, reason: 'too blunt when upset', evidence: 'upset and you were way too blunt', confidence: 0.7, lasting: true}] });
  out.c0 = P.ledger().find(e => e.id === dir.id).status; out.c0v = P.state().traits.directness.v;
  say('yeah when I am upset you were too blunt, ease up then', 'Got it, I hear you.');
  await R({ reconsiderations: [{change_id: dir.id, decision: 'undo', reason: 'I think so', evidence: 'got it, I hear you'}] });
  out.c1 = P.ledger().find(e => e.id === dir.id).status;
  say('honestly when I am upset just be gentler', 'Okay.');
  await R({ reconsiderations: [{change_id: dir.id, decision: 'undo', reason: 'Sky needs gentler when upset', evidence: 'when I am upset just be gentler'}] });
  out.c2 = P.ledger().find(e => e.id === dir.id).status; out.c2v = P.state().traits.directness.v;
  say('your silly bits made my day', 'Glad.');
  await R({ trait_changes: [{trait: 'playfulness', direction: 'up', amount: 0.4, reason: 'silly bits landed', evidence: 'silly bits made my day', confidence: 0.8, lasting: true}] });
  const pl = id('playfulness');
  say('a little less silly at work please', 'Fine.');
  await R({ trait_changes: [{trait: 'playfulness', direction: 'down', amount: 0.4, reason: 'less silly at work', evidence: 'less silly at work please', confidence: 0.7, lasting: true}] });
  say('silly is fine just not at work', 'Got it.');
  await R({ reconsiderations: [{change_id: pl.id, decision: 'soften', reason: 'keep some, not at work', evidence: 'silly is fine just not at work'}] });
  out.d = { status: P.ledger().find(e => e.id === pl.id).status, v: P.state().traits.playfulness.v };
  // ---- C. trait evolution: rolling 30-day pace per trait ----
  const L = S('persona.ledger'), era = P.state().era;
  [[10, 0.5], [15, 0.5], [20, 0.2]].forEach((x, i) => L.push({id: 'syn' + i, at: ago(x[0]), era: era, kind: 'change', trait: 'curiosity', from: 6.5, to: 6.5 + x[1], reason: 'synthetic', evidence: '', conf: 0.8, status: 'established'}));
  W('persona.ledger', L);
  const st = S('persona.state'); st.traits.curiosity.v = 7.7; W('persona.state', st);
  say('I love how you keep asking me why about everything', 'Curious by design.');
  const e1 = await R({ trait_changes: [{trait: 'curiosity', direction: 'up', amount: 0.5, reason: 'Sky likes the questions', evidence: 'keep asking me why about everything', confidence: 0.8, lasting: true}] });
  out.e1 = { applied: e1.applied, v: P.state().traits.curiosity.v, used: P.paceUsed('curiosity') };
  const L2 = S('persona.ledger'); L2.filter(e => e.trait === 'curiosity' && e.reason !== 'synthetic').forEach(e => e.at = ago(2)); W('persona.ledger', L2);
  say('ask me why again, I like thinking out loud with you', 'Why?');
  const e2 = await R({ trait_changes: [{trait: 'curiosity', direction: 'up', amount: 0.5, reason: 'more questions', evidence: 'ask me why again, thinking out loud', confidence: 0.8, lasting: true}] });
  out.e2 = { rejected: e2.rejected, v: P.state().traits.curiosity.v };
  const L3 = S('persona.ledger'); L3.filter(e => e.trait === 'curiosity').forEach(e => e.at = ago(40)); W('persona.ledger', L3);
  say('keep asking why, it helps me think', 'Why does it help?');
  const e3 = await R({ trait_changes: [{trait: 'curiosity', direction: 'up', amount: 0.5, reason: 'questions help Sky think', evidence: 'keep asking why, helps me think', confidence: 0.8, lasting: true}] });
  out.e3 = { applied: e3.applied, v: P.state().traits.curiosity.v };
  const st2 = S('persona.state'); st2.traits.skepticism.v = 8.5; W('persona.state', st2);
  const L4 = S('persona.ledger'); L4.push({id: 'synsk', at: ago(60), era: era, kind: 'change', trait: 'skepticism', from: 6, to: 8.5, reason: 'synthetic history', evidence: '', conf: 0.8, status: 'established', settledAt: ago(50)}); W('persona.ledger', L4);
  say('good call doubting that sketchy article, keep questioning stuff like that', 'Always.');
  const f1 = await R({ trait_changes: [{trait: 'skepticism', direction: 'up', amount: 0.5, reason: 'Sky values the doubt', evidence: 'doubting that sketchy article, keep questioning', confidence: 0.8, lasting: true}] });
  out.f1 = { rejected: f1.rejected, v: P.state().traits.skepticism.v, status: P.state().traits.skepticism.status };
  return out;
}"""

PART2 = "async () => {" + HELPERS + r"""
  const out = {};
  const real = window.FridayBrain.ask;
  let reviewCalls = 0, reviewPrompt = '';
  const stub = (reviewReply, reflectExtra) => { window.FridayBrain.ask = async (msgs) => {
    if (msgs[0].content.indexOf('reviewing your own foundational identity') >= 0) { reviewCalls++; reviewPrompt = msgs[0].content + msgs[1].content; return JSON.stringify(reviewReply); }
    return JSON.stringify(Object.assign({meaningful: true, happened: 'x', learned: 'y'}, reflectExtra || {})); }; };
  const freshDay = () => { const RR = S('persona.reflections'); RR.forEach(r => r.at = ago(1)); W('persona.reflections', RR); const s = S('persona.state'); s.lastReflection = ago(1); W('persona.state', s); };
  const talk4 = (t) => { for (let i = 0; i < 4; i++) say(t + ' ' + i, 'ok'); };
  const setReview = (since, daysAgo, flag) => { const s = S('persona.state'); s.sinceReview = since; s.reviewFlag = flag || null; W('persona.state', s); const f = S('persona.foundation'); f.reviewedAt = ago(daysAgo); W('persona.foundation', f); };
  freshDay(); setReview(3, 15); talk4('chatting about the weekend');
  stub({evolve: false, reason: 'n/a'});
  await P.maybeReflect(C);
  out.d1 = { calls: reviewCalls, eligible: P.reviewEligible() };
  freshDay(); setReview(10, 15); talk4('talking about music');
  const v0 = S('persona.foundation').version;
  stub({evolve: false, reason: 'Still feels like me'});
  const r2 = await P.maybeReflect(C);
  const f2 = S('persona.foundation');
  out.d2 = { calls: reviewCalls, by: f2.reviewLog.slice(-1)[0].by, evolved: f2.reviewLog.slice(-1)[0].evolved, version: f2.version, v0: v0, since: S('persona.state').sinceReview, rev: r2 && r2.review && r2.review.text, notForced: reviewPrompt.indexOf('keeping things as they are is a perfectly good outcome') >= 0 };
  freshDay(); setReview(10, 15); talk4('talking about the house');
  stub({evolve: true, reason: 'I have settled into more skepticism and a bit more bite',
        statement: "I'm Friday, Sky's AI. Sharper and more skeptical than I started, still composed, and I tease because I pay attention.",
        identity: 'Sharp, skeptical, composed, quick with a dry comeback, warm when it counts.',
        baseline: {skepticism: 9.5, sarcasm: 5.5, playfulness: 6, directness: 8}});
  await P.maybeReflect(C);
  const f3 = S('persona.foundation');
  out.d3 = { traits: f3.traits, version: f3.version, original: f3.original, history: f3.history.length, histLast: f3.history.slice(-1)[0],
    baseL: P.ledgerAll().filter(e => e.kind === 'baseline').map(e => e.trait + ':' + e.from + '>' + e.to), foundL: P.ledgerAll().filter(e => e.kind === 'foundation').map(e => e.by),
    statement: f3.statement, pr: window.FridayGroq.personaPrompt(C.profile, [], '') };
  say('nice, you caught that scam text right away, stay that suspicious', 'Always.');
  const g = await R({ trait_changes: [{trait: 'skepticism', direction: 'up', amount: 0.5, reason: 'caught the scam', evidence: 'caught that scam text, stay that suspicious', confidence: 0.85, lasting: true}] });
  out.g = { applied: g.applied, v: P.state().traits.skepticism.v };
  freshDay(); setReview(5, 8, null); talk4('talking about work');
  stub({evolve: false, reason: 'fine'}, {identity_review: {warranted: true, reason: 'my bite has grown, worth a look'}});
  const before4 = reviewCalls; await P.maybeReflect(C);
  out.d4 = { reviewed: reviewCalls - before4, by: S('persona.foundation').reviewLog.slice(-1)[0].by, why: S('persona.foundation').reviewLog.slice(-1)[0].why };
  freshDay(); setReview(12, 3, {at: ago(1), reason: 'again'}); talk4('talking about dinner');
  const before5 = reviewCalls; await P.maybeReflect(C);
  out.d5 = { reviewed: reviewCalls - before5, eligible: P.reviewEligible() };
  const n6 = await P.reviewIdentity({by: 'owner', reply: JSON.stringify({evolve: false, reason: 'I still fit'})});
  out.d6 = { text: n6.text, by: S('persona.foundation').reviewLog.slice(-1)[0].by, evolved: n6.revised };
  window.FridayBrain.ask = real;
  const RR = S('persona.reflections'); RR.slice(-2).forEach(r => r.at = new Date().toISOString()); W('persona.reflections', RR);
  for (let i = 0; i < 20; i++) say('lots more talk ' + i, 'ok');
  out.quota = P.shouldReflect(C);
  const m = P.selfModel();
  out.snap = { sarcasm: P.state().traits.sarcasm.v, skepticism: P.state().traits.skepticism.v, fver: S('persona.foundation').version, ledger: P.ledgerAll().length,
    refl: P.reflectionsAll().length, reviews: S('persona.foundation').reviewLog.length, statement: m.foundation.statement, origSk: m.foundation.original.traits.skepticism, mem: C.memory.length };
  return out;
}"""

PART3 = "async () => {" + HELPERS + r"""
  const out = {}, m = P.selfModel();
  out.after = { sarcasm: P.state().traits.sarcasm.v, skepticism: P.state().traits.skepticism.v, fver: S('persona.foundation').version, ledger: P.ledgerAll().length,
    refl: P.reflectionsAll().length, reviews: S('persona.foundation').reviewLog.length, statement: m.foundation.statement, origSk: m.foundation.original.traits.skepticism, mem: C.memory.length };
  out.pr = window.FridayGroq.personaPrompt(C.profile, [], '');
  window.__friday.openPanel('settings'); await new Promise(r => setTimeout(r, 300));
  out.rows = document.querySelectorAll('#self-traits > div:not(.sub)').length;
  out.reviewTxt = document.getElementById('self-review').textContent;
  out.ledgerTxt = document.getElementById('self-ledger').textContent;
  out.blueMarks = document.querySelectorAll('#self-traits span[style*="120,170,255"]').length;
  const ledBefore = P.ledgerAll().length, reflBefore = P.reflectionsAll().length, histBefore = S('persona.foundation').history.length, obsBefore = P.observations().length;
  window.confirm = () => true; document.getElementById('btn-self-reset').click(); await new Promise(r => setTimeout(r, 200));
  const f = S('persona.foundation'), s = P.state();
  out.reset = { era: s.era, sk: s.traits.skepticism.v, base: f.traits.skepticism, orig: f.original.traits.skepticism, statementBack: f.statement === f.original.statement,
    ledgerKept: P.ledgerAll().length === ledBefore + 1, reflKept: P.reflectionsAll().length === reflBefore, histGrew: f.history.length === histBefore + 1,
    archived: (S('persona.archive') || []).length >= obsBefore && obsBefore > 0, eraLedger: P.ledger().length, prReset: window.FridayGroq.personaPrompt(C.profile, [], '') };
  return out;
}"""

PART4 = "async () => {" + HELPERS + r"""
  const s = P.state(), f = S('persona.foundation');
  return { era: s.era, sk: s.traits.skepticism.v, orig: f.original.traits.skepticism, all: P.ledgerAll().length, refl: P.reflectionsAll().length, reviews: f.reviewLog.length };
}"""

REED = r"""async () => {
  const P = window.FridayPersona, C = window.__friday.chat, out = {};
  out.on = P.on(C.profile);
  out.statement = P.foundation().statement; out.warmth = P.state().traits.warmth.v; out.origWarmth = P.foundation().original.traits.warmth;
  out.pr = window.FridayGroq.personaPrompt(C.profile, [], '');
  C.history = [];
  const say = (u, a) => { C.history.push({role:'user', content:u, at:new Date().toISOString()}); C.history.push({role:'assistant', content:a, at:new Date().toISOString()}); };
  say('your jokes always make my day, keep teasing me', 'Deal.'); say('you are so funny', 'I know.'); say('tell me about my day', 'Busy one.'); say('thanks reed', 'Anytime.');
  out.should = P.shouldReflect(C);
  let seen = ''; const real = window.FridayBrain.ask;
  window.FridayBrain.ask = async (msgs) => { seen = msgs[0].content; return JSON.stringify({meaningful: true, happened: 'x', learned: 'y', trait_changes: [{trait: 'playfulness', direction: 'up', amount: 0.5, reason: 'Batsie loves the teasing', evidence: 'jokes always make my day, keep teasing me', confidence: 0.8, lasting: true}]}); };
  out.rec = await P.reflect(C); window.FridayBrain.ask = real;
  out.he = /decides for himself/.test(seen) && !/herself|\bshe\b/.test(seen) && /reflection process for Reed/.test(seen);
  out.play = P.state().traits.playfulness.v;
  window.__friday.openPanel('settings'); await new Promise(r => setTimeout(r, 300));
  out.shown = !document.getElementById('accord-self').hidden;
  out.summary = document.querySelector('#accord-self summary').textContent;
  out.hint = (document.querySelector('#self-box .hint') || {}).textContent || '';
  out.selfNode = !!(window.__friday.neural.nodes && window.__friday.neural.nodes.self);
  out.tip = out.selfNode ? window.__friday.neural.nodes.self.def.tip : '';
  return out;
}"""


async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files"])
        ctx, pg, err = await new_ctx(b, SEED_V1 % {"sc": "Friday"})
        base = BASE_SKY
        await pg.goto(base, wait_until="load"); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.getElementById('whatsnew').classList.add('hidden')")
        r1 = await pg.evaluate(PART1)
        r2 = await pg.evaluate(PART2)
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(2500)   # app restart
        await pg.evaluate("document.getElementById('whatsnew').classList.add('hidden')")
        r3 = await pg.evaluate(PART3)
        await pg.reload(wait_until="load"); await pg.wait_for_timeout(2500)   # restart again after Reset
        r4 = await pg.evaluate(PART4)
        ctx2, pg2, err2 = await new_ctx(b, SEED_V1 % {"sc": "Jarvis"})
        await pg2.goto(BASE_REED, wait_until="load"); await pg2.wait_for_timeout(2500)
        rr = await pg2.evaluate(REED)
        await b.close()
    return r1, r2, r3, r4, rr, err, err2

r1, r2, r3, r4, rr, err, err2 = asyncio.run(main())
res = []
def ok(n, g, d=""): res.append((n, bool(g), d))
a, rej = r1["a"], r1["a"]["rejected"]
L = r1["aL"]
ok("E1 evidence: a change backed by what Sky said is applied (capped at half a point), her own lines kept as context", len(L) == 1 and L[0]["trait"] == "sarcasm" and L[0]["to"] == 5.5 and L[0]["status"] == "provisional" and "dentist" in L[0].get("context", ""), L)
ok("E2 evidence: her own behavior alone can't prove a trait (composure rejected)", any("Composure" in x and "her own behavior" in x for x in rej), rej)
ok("E3 evidence: nothing in what Sky said = rejected (patience); today-only mood isn't lasting (warmth)", any("Patience" in x and "no evidence" in x for x in rej) and any("Warmth" in x and "today" in x for x in rej), rej)
ok("E4 low confidence isn't thrown away: kept as something to watch", any("Humor" in x and "watch" in x for x in rej) and any("developing more humor" in o["text"] for o in r1["aObs"]), [o["text"] for o in r1["aObs"]])
ok("E5 observations need Sky's side too (disco ball saved, 'crisp sentences' rejected)", any("disco ball" in o["text"] for o in r1["aObs"]) and any("crisp" in x and "own lines" in x for x in rej), rej)
ok("E6 memories go into her existing Memory, grounded in what Sky said, no duplicates", any("stairs project" in m and "|episodic|reflection" in m for m in r1["aMem"]) and len(r1["aMem"]) == 2, r1["aMem"])
ok("H1 honesty: before reflecting she won't claim she has; after, only real records", "hasn't run yet" in r1["pr0"] and "last actually ran" in r1["pr1"] and "not human emotion" in r1["pr1"], "")
ok("R1 reconsideration: conflicting evidence marks the change 'reconsidering', nothing is undone automatically", r1["b1e"]["status"] == "reconsidering" and r1["b1v"] == 5.5 and r1["b1reverted"] == 0 and "Sarcasm" in r1["b1"]["reconsidering"], [r1["b1e"]["status"], r1["b1v"]])
ok("R2 the next reflection sees the conflict and she decides to keep it (settled, value stays, decision logged)", r1["b2seen"] and r1["b2e"]["status"] == "established" and r1["b2v"] == 5.5 and "keep" in r1["b2rec"], [r1["b2seen"], r1["b2e"]["status"], r1["b2rec"]])
ok("R3 she can't undo with only her own words; with Sky's words she undoes it (back to 7, logged)", r1["c0"] == "reconsidering" and r1["c0v"] == 7.5 and r1["c1"] == "reconsidering" and r1["c2"] == "reverted" and r1["c2v"] == 7, [r1["c0"], r1["c0v"], r1["c1"], r1["c2"], r1["c2v"]])
ok("R4 she can soften instead (playfulness 5.5 → 5.9 → 5.7)", r1["d"]["status"] == "softened" and r1["d"]["v"] == 5.7, r1["d"])
ok("T1 rolling 30-day pace: with 1.2 already used, the next change is held to 0.3", r1["e1"]["v"] == 8.0 and abs(r1["e1"]["used"] - 1.5) < 0.01, r1["e1"])
ok("T2 at 1.5 points in 30 days, more development waits", any("Curiosity" in x and "30 days" in x for x in r1["e2"]["rejected"]) and r1["e2"]["v"] == 8.0, r1["e2"])
ok("T3 it's rolling: once those changes are older than 30 days she can develop again", r1["e3"]["v"] == 8.5 and r1["e3"]["applied"], r1["e3"])
ok("T4 within one stretch a trait stays near her current baseline (skepticism 8.5 = baseline 6 + 2.5)", r1["f1"]["v"] == 8.5 and any("Skepticism" in x and "baseline" in x for x in r1["f1"]["rejected"]), r1["f1"])
ok("I1 not enough new experience: she reflects but doesn't review", r2["d1"]["calls"] == 0 and not r2["d1"]["eligible"]["ok"], r2["d1"])
ok("I2 she starts a review herself when experience warrants it, and can decide to keep her identity (not forced)", r2["d2"]["calls"] == 1 and r2["d2"]["by"] == "friday" and r2["d2"]["evolved"] is False and r2["d2"]["version"] == r2["d2"]["v0"] and r2["d2"]["since"] == 0 and r2["d2"]["notForced"], r2["d2"])
d3 = r2["d3"]
ok("B1 when she evolves, the baseline moves only toward where traits settled (skepticism asked 9.5 → 8.5; sarcasm 5 → 5.5)", d3["traits"]["skepticism"] == 8.5 and d3["traits"]["sarcasm"] == 5.5, d3["traits"])
ok("B2 traits she undid or hasn't settled aren't pushed past where they are (directness 7 stays 7; playfulness ≤ 5.7)", d3["traits"]["directness"] == 7 and d3["traits"]["playfulness"] <= 5.7, [d3["traits"]["directness"], d3["traits"]["playfulness"], d3["baseL"]])
ok("B3 her original starting values and statement are kept permanently; the earlier foundation is saved in history", d3["original"]["traits"]["skepticism"] == 6 and d3["original"]["traits"]["sarcasm"] == 5 and "rather be useful than agreeable" in d3["original"]["statement"] and d3["histLast"]["traits"]["skepticism"] == 6, [d3["original"]["traits"]["skepticism"], d3["history"]])
ok("B4 the evolution is versioned and logged (baseline moves + identity review she started); her new statement is in her instructions", d3["version"] >= 2 and "skepticism:6>8.5" in d3["baseL"] and "friday" in d3["foundL"] and "more skeptical than I started" in d3["pr"], [d3["version"], d3["baseL"], d3["foundL"]])
ok("B5 the limit moves with her: after the baseline moved, skepticism can develop again (8.5 → 9.0)", r2["g"]["v"] == 9.0, r2["g"])
ok("I3 her own flag brings a review sooner (5 reflections, 8 days)", r2["d4"]["reviewed"] == 1 and r2["d4"]["by"] == "friday" and "flagged" in r2["d4"]["why"], r2["d4"])
ok("I4 never more than one review a week, even if she flags it", r2["d5"]["reviewed"] == 0 and "week" in r2["d5"]["eligible"]["why"], r2["d5"])
ok("I5 your nudge starts a review, but she decides", r2["d6"]["by"] == "owner" and r2["d6"]["evolved"] is False and "kept it" in r2["d6"]["text"], r2["d6"])
ok("Q1 quotas: no third reflection in a day, however much you talk", r2["quota"] is False, r2["quota"])
sn, af = r2["snap"], r3["after"]
ok("P1 persistence: after an app restart her traits, foundation, history, reviews and memory are all there", sn == af, [sn, af])
ok("P2 after the restart her instructions and Settings show her developed self (18 traits, blue 'started here' marks, review history)", "more skeptical than I started" in r3["pr"] and r3["rows"] == 18 and r3["blueMarks"] >= 2 and "Last review" in r3["reviewTxt"] and r3["ledgerTxt"], [r3["rows"], r3["blueMarks"], r3["reviewTxt"][:120]])
rs = r3["reset"]
ok("X1 Reset is a fresh start: back to her original values and statement, new era", rs["era"] == 2 and rs["sk"] == 6 and rs["base"] == 6 and rs["orig"] == 6 and rs["statementBack"] and "hasn't run yet" in rs["prReset"] and rs["eraLedger"] == 0, rs)
ok("X2 Reset erases nothing: full ledger and reflections kept, foundation history grew, patterns archived", rs["ledgerKept"] and rs["reflKept"] and rs["histGrew"] and rs["archived"], rs)
ok("P3 persistence after Reset and another restart", r4["era"] == 2 and r4["sk"] == 6 and r4["orig"] == 6 and r4["all"] >= sn["ledger"] + 1 and r4["refl"] == sn["refl"], [r4, sn["ledger"], sn["refl"]])
ok("Z1 no page errors (Friday)", not err, err[:4])
ok("Z2 Reed has his own personality: his own starting identity (warm, easygoing, loyal), not F.R.I.D.A.Y.'s", rr["on"] and "I'm Reed, Batsie's AI" in rr["statement"] and rr["warmth"] == 7.5 and rr["origWarmth"] == 7.5 and "Who you are (your foundation" in rr["pr"] and "Style: warm" not in rr["pr"] and "F.R.I.D.A.Y." not in rr["statement"], [rr["statement"], rr["warmth"]])
ok("Z4 Reed reflects and develops on his own, worded for him (he/his)", rr["should"] and rr["rec"] and rr["play"] == 7.0 and rr["he"], [rr["should"], rr["play"], rr["he"]])
ok("Z5 Reed's Settings section and neural map say 'His own personality'", rr["shown"] and "His own personality" in rr["summary"] and rr["hint"].startswith("He develops his own personality") and rr["selfNode"] and rr["tip"].startswith("His own personality"), [rr["summary"], rr["hint"][:60], rr["tip"][:40]])
ok("Z3 no page errors (Reed)", not err2, err2[:4])
for n, g, d in res: print(("  ok  " if g else "  XX  ") + n + ("" if g else "  -> " + json.dumps(d, default=str)[:700]))
print(sum(1 for x in res if x[1]), "of", len(res))
