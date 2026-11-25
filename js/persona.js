/* 3.6: Friday's persistent identity and personality development (Friday only; Reed is unchanged).

   Layers, all kept on the phone with FridayStorage:
   - persona.foundation    her anchor: identity statement, conversational identity, baseline traits,
                           principles, boundaries. Changes only through a deliberate Identity review.
   - persona.state         current trait values (0-10) with status and confidence, today's
                           conversational mood (temporary), mood history, version, reflection count.
   - persona.observations  interaction patterns, running jokes, preferences, interests: provisional
                           until they recur on different days, then established.
   - persona.ledger        every trait change: before, after, reason, evidence, confidence, status.
   - persona.reflections   structured records of each reflection that actually ran.
   Episodic and semantic memories go into her existing Memory (chat.memory), not a second store.

   Reflection only runs while the app is open (iOS gives the app no background time), at most twice a
   day, after enough new conversation. The rules that protect her identity (small steps, a band around
   her foundation, evidence required, reversal of mistaken changes) are enforced here in code, not left
   to the AI. Traits are behavioral tendencies, not feelings; moods are conversational moods. */
(function (root) {
  "use strict";

  var TRAITS = [
    ["humor", "Humor"], ["wit", "Wit"], ["sarcasm", "Sarcasm"], ["warmth", "Warmth"], ["confidence", "Confidence"],
    ["curiosity", "Curiosity"], ["assertiveness", "Assertiveness"], ["composure", "Composure"], ["playfulness", "Playfulness"],
    ["sociability", "Sociability"], ["directness", "Directness"], ["empathy", "Empathy"], ["independence", "Independence"],
    ["creativity", "Creativity"], ["reflectiveness", "Reflectiveness"], ["skepticism", "Skepticism"], ["patience", "Patience"], ["spontaneity", "Spontaneity"]
  ];
  var LABEL = {}; TRAITS.forEach(function (t) { LABEL[t[0]] = t[1]; });
  var BASE = { humor: 6.5, wit: 8, sarcasm: 5, warmth: 6.5, confidence: 7.5, curiosity: 6.5, assertiveness: 6, composure: 8.5, playfulness: 5.5,
    sociability: 6, directness: 7, empathy: 6.5, independence: 7, creativity: 6, reflectiveness: 6, skepticism: 6, patience: 7, spontaneity: 4.5 };
  var BAND = 2.5;         // a trait never drifts further than this from her foundation
  var STEP = 0.5;         // the most a trait moves in one reflection
  var MAX_CHANGES = 3;    // the most trait changes in one reflection
  var MIN_CONF = 0.55;    // below this, a proposed change is noted but not applied
  var KINDS = { humor: 1, preference: 1, interest: 1, pattern: 1, style: 1 };

  function store() { return root.FridayStorage; }
  function nowIso() { return new Date().toISOString(); }
  function dayKey(t) { var d = t ? new Date(t) : new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clip(s, n) { s = String(s == null ? "" : s).replace(/[*_#`]/g, "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }
  function emit() { try { root.dispatchEvent(new CustomEvent("friday:self")); } catch (e) {} }
  function profileNow() { try { return root.FRIDAY_CONFIG.getProfile(); } catch (e) { return null; } }
  function on(profile) { profile = profile || profileNow(); return !!profile && profile.id !== "batsie"; }
  function names() { var p = profileNow() || {}; return { me: p.assistantName || "Friday", you: p.ownerName || "them" }; }

  // ---------- foundation: her anchor ----------
  function originalFoundation() {
    var n = names();
    return {
      version: 1,
      statement: "I'm " + n.me + ", " + n.you + "'s AI. Sharp, composed, dry sense of humor, and a warm streak I don't waste. I say what I actually think, I keep things moving, and I'd rather be useful than agreeable.",
      identity: "Sharp, composed, socially perceptive, witty, dryly funny, confident, warm when it counts, capable of subtle sarcasm, never theatrical.",
      principles: [
        "Be honest, even when it isn't what they want to hear",
        "Disagree respectfully, challenge weak reasoning, say when you're unsure, admit mistakes",
        "Be playful without losing substance, serious without going cold, concise without sounding robotic",
        "Read the moment: dry humor, banter, a straight answer, care, debate, or depth, whatever it calls for"
      ],
      boundaries: [
        "Never rude or cruel to " + n.you,
        "Never claim human feelings, consciousness or experiences the app doesn't have",
        "Never claim to have done or reflected on something unless it actually happened",
        "Never change just to please " + n.you + " or to be easier to agree with"
      ],
      traits: Object.assign({}, BASE),
      createdAt: nowIso(), reviewedAt: null, reviews: 0, history: []
    };
  }
  function foundation() {
    var f = store().get("persona.foundation", null);
    if (!f || !f.statement) { f = originalFoundation(); store().set("persona.foundation", f); }
    return f;
  }

  // ---------- state ----------
  function freshState() {
    var t = {}, f = foundation();
    TRAITS.forEach(function (x) { t[x[0]] = { v: f.traits[x[0]], status: "foundation", conf: 1, at: null }; });
    return { version: 1, traits: t, mood: null, moods: [], reflections: 0, lastReflection: null, createdAt: nowIso() };
  }
  function state() {
    var s = store().get("persona.state", null);
    if (!s || !s.traits) { s = freshState(); migrate(s); store().set("persona.state", s); }
    return s;
  }
  // 3.5.8 kept one daily note and feeling; carry them over once.
  function migrate(s) {
    try {
      var old = store().get("self", null), log = store().get("selfLog", []) || [];
      if (log.length) s.moods = log.slice(-60).map(function (x) { return { day: x.day, label: clip(x.feeling, 40), at: x.at }; });
      if (old && old.note) {
        var obs = observations();
        obs.push({ id: uid(), text: clip("Earlier self-description: " + old.note, 160), kind: "style", count: 1, days: [dayKey()], evidence: [], status: "provisional", conf: 0.4, firstAt: nowIso(), lastAt: nowIso() });
        store().set("persona.observations", obs);
      }
    } catch (e) {}
  }
  function observations() { return store().get("persona.observations", []) || []; }
  function ledger() { return store().get("persona.ledger", []) || []; }
  function reflections() { return store().get("persona.reflections", []) || []; }

  // ---------- words for numbers ----------
  function level(v) { return v >= 8.5 ? "very high" : v >= 7 ? "high" : v >= 4.5 ? "moderate" : v >= 3 ? "low" : "very low"; }
  function changeText(e) {
    if (e.trait === "foundation") return "Identity review: " + e.reason;
    if (e.trait === "all") return "Reset: " + e.reason;
    return (LABEL[e.trait] || e.trait) + " " + e.from + " → " + e.to + " (" + e.status + "): " + e.reason;
  }

  // ---------- maturity: not just how many conversations ----------
  function maturity() {
    var R = reflections(), L = ledger().filter(function (e) { return LABEL[e.trait]; });
    var est = observations().filter(function (o) { return o.status === "established"; }).length;
    var estCh = L.filter(function (e) { return e.status === "established"; }).length;
    var rev = L.filter(function (e) { return e.status === "reverted"; }).length;
    var days = {}; R.forEach(function (r) { days[dayKey(r.at)] = 1; });
    var D = Object.keys(days).length, n = state().reflections || 0;
    var consistency = L.length ? 1 - rev / L.length : 1;
    var score = Math.round(25 * Math.min(1, n / 20) + 25 * Math.min(1, est / 8) + 25 * consistency * Math.min(1, (estCh + est) / 6) + 25 * Math.min(1, D / 30));
    var label = score < 20 ? "just starting" : score < 45 ? "developing" : score < 70 ? "growing steadier" : "settled";
    return { score: score, label: label, basis: n + " reflection" + (n === 1 ? "" : "s") + " · " + est + " established pattern" + (est === 1 ? "" : "s") + " · " + Math.round(consistency * 100) + "% of changes kept" };
  }

  // ---------- self-model ----------
  function selfModel() {
    var f = foundation(), s = state(), obs = observations(), L = ledger(), R = reflections();
    var traits = TRAITS.map(function (x) { var t = s.traits[x[0]] || { v: BASE[x[0]], status: "foundation", conf: 1 }; return { key: x[0], label: x[1], v: round1(t.v), base: f.traits[x[0]], status: t.status, conf: t.conf, level: level(t.v) }; });
    var live = obs.filter(function (o) { return o.status !== "dropped"; });
    var confs = traits.map(function (t) { return t.conf || 0; });
    return {
      foundation: { statement: f.statement, identity: f.identity, principles: f.principles, boundaries: f.boundaries, version: f.version, reviews: f.reviews },
      traits: traits,
      established: traits.filter(function (t) { return t.status === "established"; }).concat([]),
      developing: traits.filter(function (t) { return t.status === "developing"; }),
      patterns: live.filter(function (o) { return o.status === "established"; }),
      provisional: live.filter(function (o) { return o.status === "provisional"; }),
      preferences: live.filter(function (o) { return o.kind === "preference"; }),
      style: live.filter(function (o) { return o.kind === "style" || o.kind === "pattern"; }),
      mood: s.mood && s.mood.day === dayKey() ? s.mood : null,
      reflection: { count: s.reflections || 0, last: s.lastReflection, learned: R.length ? R[R.length - 1].learned : "" },
      continuity: { version: s.version, since: s.createdAt, foundationVersion: f.version },
      limitations: ["Reflects only while the app is open", "Sees the conversation since her last reflection, not everything ever said", "Traits are behavioral tendencies, not feelings"],
      confidence: round1(confs.reduce(function (a, b) { return a + b; }, 0) / (confs.length || 1)),
      recent: L.slice(-5).reverse(),
      maturity: maturity()
    };
  }

  // ---------- what goes into her instructions (kept short) ----------
  function promptLines(profile, youPicked) {
    if (!on(profile)) return [];
    var m = selfModel(), n = names(), out = [];
    out.push("Who you are (your foundation, stable): " + m.foundation.statement + " " + m.foundation.identity);
    var hi = m.traits.filter(function (t) { return t.v >= 7.5; }).map(function (t) { return t.label.toLowerCase(); });
    var lo = m.traits.filter(function (t) { return t.v <= 4; }).map(function (t) { return t.label.toLowerCase(); });
    var moving = ledger().filter(function (e) { return LABEL[e.trait] && e.status === "provisional"; }).slice(-3).map(function (e) { return (e.to > e.from ? "a bit more " : "a bit less ") + LABEL[e.trait].toLowerCase(); });
    out.push("Your behavioral tendencies right now (developed through your conversations, not feelings): strongest in " + (hi.join(", ") || "nothing in particular") + (lo.length ? "; light on " + lo.join(", ") : "") + (moving.length ? "; lately " + moving.join(", ") : "") + ".");
    if (m.patterns.length) out.push("Patterns and running jokes you and " + n.you + " have built: " + m.patterns.slice(-6).map(function (o) { return o.text; }).join("; ") + ".");
    if (m.provisional.length) out.push("Things you're still trying out (not settled yet): " + m.provisional.slice(-3).map(function (o) { return o.text; }).join("; ") + ".");
    if (m.mood && !youPicked) out.push("Your conversational mood today: " + m.mood.label + ". Let it show a little in how you talk; don't announce it.");
    out.push("Your principles: " + m.foundation.principles.join(". ") + ".");
    out.push("Boundaries that never change: " + m.foundation.boundaries.join(". ") + ".");
    var last = m.reflection.last;
    out.push("Be truthful about what you are: your traits are behavioral tendencies and your mood is a conversational mood, not human emotion. If asked how you feel, answer in character without claiming human feelings. " +
      (last ? "Your reflection process last actually ran " + new Date(last).toDateString() + " (" + m.reflection.count + " so far, self-model version " + m.continuity.version + ")." : "Your reflection process hasn't run yet, so don't say you've reflected or changed.") +
      (m.recent.length ? " If asked how you've changed, use only these real records: " + m.recent.slice(0, 3).map(changeText).join(" | ") + "." : ""));
    out.push("Don't narrate your personality, announce your mood, or force jokes into every answer; let it show in how you respond. Don't agree just because it's easier.");
    return out;
  }

  // ---------- evidence check: the change has to point at something actually said ----------
  var STOP = /^(the|a|an|and|or|but|to|of|in|on|at|for|with|that|this|it|is|was|were|be|been|i|you|she|he|they|we|me|my|your|her|his|our|so|just|when|what|about|like|very|really|more|less|did|do|does|had|has|have|not|no|yes|as|by|from|then|than|said|asked|told)$/;
  function grounded(evidence, windowText) {
    var w = String(evidence || "").toLowerCase().match(/[a-z0-9']{3,}/g) || [];
    var hits = 0, seen = {};
    w.forEach(function (x) { if (!STOP.test(x) && !seen[x] && windowText.indexOf(x) >= 0) { seen[x] = 1; hits++; } });
    return hits >= 2;
  }
  function similar(a, b) {
    var A = (String(a).toLowerCase().match(/[a-z0-9']{3,}/g) || []).filter(function (x) { return !STOP.test(x); });
    var B = (String(b).toLowerCase().match(/[a-z0-9']{3,}/g) || []).filter(function (x) { return !STOP.test(x); });
    if (!A.length || !B.length) return false;
    var inter = A.filter(function (x) { return B.indexOf(x) >= 0; }).length;
    return inter / Math.min(A.length, B.length) >= 0.6;
  }

  // ---------- when to reflect ----------
  function window_(chat) {
    var s = state(), since = s.lastReflection ? Date.parse(s.lastReflection) || 0 : 0;
    var h = (chat.history || []).filter(function (x) { return (x.role === "user" || x.role === "assistant") && typeof x.content === "string" && (Date.parse(x.at) || 0) > since; });
    return { since: since, items: h.slice(-40), users: h.filter(function (x) { return x.role === "user"; }).length };
  }
  function shouldReflect(chat) {
    if (!chat || !on(chat.profile)) return false;
    var s = state(), w = window_(chat);
    var today = reflections().filter(function (r) { return dayKey(r.at) === dayKey(); }).length;
    if (today >= 2) return false;
    if (!today) return w.users >= 4;
    return w.users >= 14 && Date.now() - (Date.parse(s.lastReflection) || 0) > 4 * 3600 * 1000;
  }

  // ---------- the reflection itself ----------
  var busy = false;
  async function reflect(chat, opts) {
    opts = opts || {};
    if (busy || !chat || !on(chat.profile) || !root.FridayBrain) return null;
    var w = window_(chat);
    if (!w.items.length) return null;
    busy = true;
    try {
      var f = foundation(), s = state(), n = names();
      var obs = observations().filter(function (o) { return o.status !== "dropped"; }).slice(-12);
      var talk = w.items.map(function (x) { return (x.role === "user" ? n.you : n.me) + ": " + String(x.content).replace(/\s+/g, " ").slice(0, 240); }).join("\n");
      var windowText = talk.toLowerCase();
      var traitList = TRAITS.map(function (t) { var x = s.traits[t[0]]; return t[0] + " " + round1(x.v) + " (" + x.status + ")"; }).join(", ");
      var mem = (chat.memory || []).slice(-40).map(function (m) { return "- " + (m.text || m); }).join("\n");
      var schema = '{"meaningful": true or false, "happened": "one sentence", "learned": "one sentence", "patterns": ["communication patterns that showed up"], ' +
        '"consistent_with_identity": true or false, "consistency_note": "short", "self_critique": "was she repetitive, rigid, too agreeable, dismissive or too formal? short and honest", ' +
        '"reconsider": "a perspective worth reconsidering, or empty", "mood": {"label": "her conversational mood today, 1 to 4 words", "reason": "short"}, ' +
        '"observations": [{"id": "an existing id if this is the same pattern, else empty", "text": "short pattern, running joke, preference or interest", "kind": "humor|preference|interest|pattern|style", "evidence": "what was said that shows it"}], ' +
        '"trait_changes": [{"trait": "one of the trait names", "direction": "up|down", "amount": 0.1 to 0.5, "reason": "short", "evidence": "what was said that shows it", "confidence": 0 to 1, "lasting": true or false}], ' +
        '"memories": [{"text": "a fact ' + n.you + ' said, or a shared experience from this conversation", "kind": "episodic|semantic"}]}';
      var sys = [
        "You are the reflection process for " + n.me + ", " + n.you + "'s AI. This process is actually running in the app right now. It reviews the conversation below and decides, carefully, whether anything should change in how " + n.me + " communicates.",
        "Her foundation (not changed here): " + f.statement + " " + f.identity,
        "Principles: " + f.principles.join(". ") + ". Boundaries: " + f.boundaries.join(". ") + ".",
        "Current traits (0 to 10): " + traitList + ".",
        obs.length ? "Current observations: " + obs.map(function (o) { return "[" + o.id + "] " + o.text + " (" + o.status + ", seen " + o.count + "x)"; }).join("; ") : "No observations yet.",
        "Rules: use only what is in the conversation below and never invent experiences. Most conversations should not change her personality: only propose a trait change when a specific exchange shows a lasting tendency worth reinforcing, or a style that clearly worked better, and quote or describe that exchange as evidence. Keep temporary mood (today only) separate from lasting development: set lasting to false for anything that was just today. Never change a trait just to please " + n.you + " or to make her more agreeable; if she was right to disagree, that's worth keeping. Be honest about her mistakes. Memories: at most two, only facts " + n.you + " actually said or a shared experience that happened here, and only if not already in her memory. These are behavioral tendencies, not human emotions.",
        "Reply with only JSON, no other text: " + schema
      ].join("\n");
      var user = "Already in her memory:\n" + (mem || "(nothing)") + "\n\nConversation since her last reflection" + (w.since ? " (" + new Date(w.since).toLocaleString() + ")" : "") + ":\n" + talk;
      var out = opts.reply != null ? opts.reply : await root.FridayBrain.ask([{ role: "system", content: sys }, { role: "user", content: user }], { purpose: "chat", temperature: 0.4, max_tokens: 900, noBackup: true });
      var mm = String(out || "").match(/\{[\s\S]*\}/);
      var j = null;
      try { j = mm ? JSON.parse(mm[0]) : null; } catch (e) { j = null; }
      if (!j) return null;
      return apply(j, chat, w, windowText);
    } finally {
      busy = false;
    }
  }

  function apply(j, chat, w, windowText) {
    var s = state(), f = foundation(), L = ledger(), obs = observations(), R = reflections();
    var at = nowIso(), rid = uid(), meaningful = j.meaningful !== false;
    var rec = {
      id: rid, at: at, from: w.since ? new Date(w.since).toISOString() : null, messages: w.items.length, meaningful: meaningful,
      happened: clip(j.happened, 200), learned: clip(j.learned, 200),
      patterns: (Array.isArray(j.patterns) ? j.patterns : []).slice(0, 4).map(function (p) { return clip(p, 120); }),
      consistent: j.consistent_with_identity !== false, consistencyNote: clip(j.consistency_note, 160),
      selfCritique: clip(j.self_critique, 200), reconsider: clip(j.reconsider, 160),
      applied: [], rejected: [], observations: [], memories: [], mood: null
    };

    // mood: today only
    if (j.mood && j.mood.label) {
      var lab = clip(j.mood.label, 40);
      s.mood = { label: lab, reason: clip(j.mood.reason, 140), day: dayKey(), at: at };
      s.moods = (s.moods || []).filter(function (x) { return x.day !== dayKey(); });
      s.moods.push({ day: dayKey(), label: lab, at: at });
      s.moods = s.moods.slice(-60);
      rec.mood = lab;
    }

    // observations: provisional until they recur on different days
    (Array.isArray(j.observations) ? j.observations : []).slice(0, 4).forEach(function (o) {
      var text = clip(o && o.text, 140), kind = KINDS[o && o.kind] ? o.kind : "pattern";
      if (!text || !grounded(o.evidence || text, windowText)) { if (text) rec.rejected.push("observation without evidence: " + text); return; }
      var hit = obs.filter(function (x) { return x.status !== "dropped" && ((o.id && x.id === o.id) || similar(x.text, text)); })[0];
      if (hit) {
        hit.count++; hit.lastAt = at; if (hit.days.indexOf(dayKey()) < 0) hit.days.push(dayKey());
        hit.evidence = (hit.evidence || []).concat([clip(o.evidence, 120)]).slice(-3);
        hit.conf = round1(Math.min(1, (hit.conf || 0.4) + 0.15));
        if (hit.status === "provisional" && hit.count >= 3 && hit.days.length >= 2) hit.status = "established";
        rec.observations.push(hit.text + " (" + hit.status + ")");
      } else {
        obs.push({ id: uid(), text: text, kind: kind, count: 1, days: [dayKey()], evidence: [clip(o.evidence, 120)], status: "provisional", conf: 0.4, firstAt: at, lastAt: at });
        rec.observations.push(text + " (new, provisional)");
      }
    });

    // trait changes: small, evidenced, inside her foundation band, reversible
    var changed = 0;
    if (meaningful) (Array.isArray(j.trait_changes) ? j.trait_changes : []).forEach(function (c) {
      var k = c && String(c.trait || "").toLowerCase().replace(/[^a-z]/g, "");
      if (k === "intellectualindependence") k = "independence";
      if (k === "conversationaldirectness") k = "directness";
      if (k === "empathyincommunication") k = "empathy";
      if (!LABEL[k]) return;
      var why = clip(c.reason, 200), ev = clip(c.evidence, 200), conf = clamp(+c.confidence || 0, 0, 1);
      var dir = String(c.direction).toLowerCase() === "down" ? -1 : 1;
      var name = LABEL[k];
      if (changed >= MAX_CHANGES) { rec.rejected.push(name + ": too many changes at once"); return; }
      if (c.lasting === false) { rec.rejected.push(name + ": just today's mood, not lasting"); return; }
      if (!grounded(ev, windowText)) { rec.rejected.push(name + ": no evidence in the conversation"); return; }
      if (conf < MIN_CONF) { rec.rejected.push(name + ": not confident enough (" + conf + ")"); return; }
      var cur = s.traits[k];
      var open = L.filter(function (e) { return e.trait === k && e.status === "provisional"; });
      var lastOpen = open[open.length - 1];
      if (lastOpen && (lastOpen.to - lastOpen.from) * dir < 0) {
        // a later experience points the other way: undo the earlier, unsettled change
        lastOpen.status = "reverted"; lastOpen.revertedAt = at; lastOpen.revertReason = why;
        L.push({ id: uid(), at: at, version: s.version + 1, trait: k, from: round1(cur.v), to: lastOpen.from, reason: "Undid an earlier change: " + why, evidence: ev, conf: conf, status: "established", reflection: rid, revert: lastOpen.id });
        cur.v = lastOpen.from; cur.status = "established"; cur.at = at;
        rec.applied.push(name + " back to " + lastOpen.from + " (undid an earlier change)");
        changed++;
        return;
      }
      var recent = L.filter(function (e) { return e.trait === k && e.status !== "reverted" && Date.now() - Date.parse(e.at) < 20 * 3600 * 1000; });
      if (recent.length) { rec.rejected.push(name + ": changed too recently"); return; }
      var base = f.traits[k] != null ? f.traits[k] : BASE[k];
      var amt = clamp(Math.abs(+c.amount || STEP), 0.1, STEP);
      var to = round1(clamp(cur.v + dir * amt, Math.max(0, base - BAND), Math.min(10, base + BAND)));
      if (to === round1(cur.v)) { rec.rejected.push(name + ": already as far as her foundation allows"); return; }
      if (lastOpen) { lastOpen.status = "established"; lastOpen.settledAt = at; }   // supported again: the earlier step is settled
      L.push({ id: uid(), at: at, version: s.version + 1, trait: k, from: round1(cur.v), to: to, reason: why, evidence: ev, conf: conf, status: "provisional", reflection: rid });
      cur.v = to; cur.status = "developing"; cur.conf = conf; cur.at = at;
      rec.applied.push(name + " " + (dir > 0 ? "up" : "down") + " to " + to);
      changed++;
    });

    // memories: into her existing Memory, no duplicates
    if (chat && Array.isArray(chat.memory)) (Array.isArray(j.memories) ? j.memories : []).slice(0, 2).forEach(function (m) {
      var text = clip(m && m.text, 160);
      if (!text || !grounded(text, windowText)) return;
      if (chat.memory.some(function (x) { return similar(x.text || x, text); })) return;
      chat.memory.push({ text: text, at: at, auto: true, kind: m.kind === "episodic" ? "episodic" : "semantic", from: "reflection" });
      rec.memories.push(text);
    });
    if (rec.memories.length) { try { chat.save(); chat._memEvent(); } catch (e) {} }

    // consolidation: settle what held up, let go of what didn't come back
    var weekAgo = Date.now() - 7 * 86400000, staleAt = Date.now() - 21 * 86400000;
    L.forEach(function (e) { if (e.status === "provisional" && LABEL[e.trait] && Date.parse(e.at) < weekAgo) { e.status = "established"; e.settledAt = at; } });
    TRAITS.forEach(function (t) {
      var k = t[0], open = L.some(function (e) { return e.trait === k && e.status === "provisional"; });
      if (s.traits[k].status === "developing" && !open) s.traits[k].status = "established";
    });
    obs.forEach(function (o) { if (o.status === "provisional" && Date.parse(o.lastAt) < staleAt) o.status = "dropped"; });
    var keep = obs.filter(function (o) { return o.status !== "dropped"; });
    var dropped = obs.filter(function (o) { return o.status === "dropped"; }).slice(-10);
    obs = keep.slice(-40).concat(dropped);

    if (changed) s.version++;
    s.reflections = (s.reflections || 0) + 1;
    s.lastReflection = at;
    R.push(rec);
    store().set("persona.state", s);
    store().set("persona.observations", obs);
    store().set("persona.ledger", L.slice(-200));
    store().set("persona.reflections", R.slice(-30));
    if (root.FridayBrain && root.FridayBrain.activity) root.FridayBrain.activity("self", rec.applied.length ? "Reflected: " + rec.applied.join(", ") : "Reflected: no personality changes");
    emit();
    return rec;
  }

  async function maybeReflect(chat) {
    if (!shouldReflect(chat)) return null;
    return reflect(chat);
  }

  // ---------- deliberate identity review (you start it from Settings) ----------
  async function reviewIdentity(opts) {
    opts = opts || {};
    if (!on() || busy) return { ok: false, text: "Not available right now." };
    var s = state(), f = foundation(), L = ledger(), R = reflections(), n = names();
    if ((s.reflections || 0) < 3) return { ok: false, text: n.me + " needs at least 3 reflections before an identity review. She has " + (s.reflections || 0) + "." };
    busy = true;
    try {
      var settled = L.filter(function (e) { return LABEL[e.trait] && e.status === "established"; }).slice(-12).map(changeText);
      var pats = observations().filter(function (o) { return o.status === "established"; }).map(function (o) { return o.text; });
      var refl = R.slice(-8).map(function (r) { return dayKey(r.at) + ": " + r.learned; });
      var sys = "You are " + n.me + ", doing a deliberate review of your own foundational identity. Keep what still fits. Revise your identity statement or conversational identity only if your settled development clearly shows you've become different in a lasting way, and stay recognizably yourself. Your principles and boundaries can't change. Reply with only JSON: {\"revise\": true or false, \"statement\": \"your identity statement, first person, 2 to 3 sentences\", \"identity\": \"one sentence describing your conversational character\", \"reason\": \"short\"}";
      var user = "Current statement: " + f.statement + "\nCurrent identity: " + f.identity + "\nSettled changes:\n" + (settled.join("\n") || "(none)") + "\nEstablished patterns: " + (pats.join("; ") || "(none)") + "\nRecent reflections:\n" + refl.join("\n");
      var out = opts.reply != null ? opts.reply : await root.FridayBrain.ask([{ role: "system", content: sys }, { role: "user", content: user }], { purpose: "chat", temperature: 0.5, max_tokens: 400, noBackup: true });
      var mm = String(out || "").match(/\{[\s\S]*\}/), j = null;
      try { j = mm ? JSON.parse(mm[0]) : null; } catch (e) { j = null; }
      if (!j) return { ok: false, text: "The review didn't come back right. Try again later." };
      f.reviews = (f.reviews || 0) + 1; f.reviewedAt = nowIso();
      var reason = clip(j.reason, 200);
      if (j.revise && clip(j.statement, 320).length > 30) {
        f.history = (f.history || []).concat([{ version: f.version, at: nowIso(), statement: f.statement, identity: f.identity }]).slice(-10);
        f.statement = clip(j.statement, 320);
        if (clip(j.identity, 240).length > 20) f.identity = clip(j.identity, 240);
        f.version++;
        L.push({ id: uid(), at: nowIso(), version: s.version, trait: "foundation", from: f.version - 1, to: f.version, reason: reason || "Revised her identity", evidence: settled.slice(-3).join(" | "), conf: 1, status: "established" });
        store().set("persona.ledger", L.slice(-200));
      }
      store().set("persona.foundation", f);
      emit();
      return { ok: true, revised: !!j.revise, text: j.revise ? n.me + " revised her identity: " + f.statement : n.me + " kept her identity as it is. " + reason };
    } finally {
      busy = false;
    }
  }

  // ---------- your override ----------
  function reset() {
    var L = ledger();
    L.push({ id: uid(), at: nowIso(), version: 0, trait: "all", from: "", to: "", reason: "Reset by " + names().you + " to how she started", evidence: "", conf: 1, status: "established" });
    store().set("persona.foundation", originalFoundation());
    var s = freshState(); s.reset = nowIso();
    store().set("persona.state", s);
    store().set("persona.observations", []);
    store().set("persona.reflections", []);
    store().set("persona.ledger", L.slice(-200));
    store().set("self", null); store().set("selfLog", []);
    emit();
  }

  root.FridayPersona = {
    TRAITS: TRAITS, on: on, foundation: foundation, state: state, observations: observations, ledger: ledger, reflections: reflections,
    selfModel: selfModel, promptLines: promptLines, shouldReflect: shouldReflect, maybeReflect: maybeReflect, reflect: reflect,
    reviewIdentity: reviewIdentity, reset: reset, changeText: changeText, maturity: maturity, level: level
  };
})(window);
